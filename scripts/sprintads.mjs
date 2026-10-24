// Koşu ↔ nişan geçişi (12.145): koşarken nişan → koşu anında biter, nişana geçilir; nişan bırakılınca koşu tuşu hâlâ basılıysa koşuya dönülür.
//   node scripts/sprintads.mjs [taban url]     WS=ws://127.0.0.1:8787 (çevrim içi bölüm; BF_DEBUG=1 sunucu)  SHOT=klasör (kare kare görüntü)  ONLY=desk|hold|toggle|touch|net
// Çevrimdışı bölümler gerçek g.step(1/60) ile kare kare yürür; girdi gerçek DOM olaylarıyla (keydown ShiftLeft / KeyW, canvas mousedown button 2) ya da dokunmatik düğme / joystick ile verilir.
// Ölçüler: koşu (s.sprinting), nişan isteği (s.ads), adsT, yatay hız, birinci şahıs koşu pozu (vm.sprK: ekranda kalan koşu pozu payı).
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', WS = process.env.WS || 'ws://127.0.0.1:8787', SHOT = process.env.SHOT || '', ONLY = process.env.ONLY || '';
const want = (k) => !ONLY || ONLY.split(',').includes(k);
if (SHOT) mkdirSync(SHOT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };

// sayfaya ölçüm yardımcıları
const HELPERS = () => {
  const g = window.__game, p = g.player, s = p.s;
  window.__h = {
    key: (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true })),
    rmb: (down) => (down ? g.canvas : window).dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button: 2, bubbles: true })),
    // n kare ilerlet; konum her kare başlangıca döner (duvara çarpıp hız sıfırlanmasın), hız korunur
    step: (n, tag) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        g.step(1 / 60);
        s.pos.x = window.__p0.x; s.pos.z = window.__p0.z;
        out.push({ tag, sp: s.sprinting ? 1 : 0, ads: s.ads ? 1 : 0, adsT: +s.adsT.toFixed(3), v: +Math.hypot(s.vel.x, s.vel.z).toFixed(2), sprK: +(p.vm.sprK ?? p.vm.sprintT ?? 0).toFixed(3) });
      }
      return out;
    },
    reset: () => {
      for (const k of [...p.keys]) window.__h.key(k, false);
      p.keys.clear(); s.ads = false; s.adsT = 0; s.sprinting = false; s.vel.set(0, 0, 0); s.reloadT = 0; s.switchT = 0; s.crouching = false; s.prone = false;
      if (p.touch) { p.touch.runLock = false; p.touch.setJoy(0, 0); }
      s.cur = 0; p.refreshWeapon?.();
      for (let i = 0; i < 30; i++) g.step(1 / 60);
      s.pos.x = window.__p0.x; s.pos.z = window.__p0.z;
    },
  };
};

async function offline(dev) {
  const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1280, height: 720 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev !== 'desk' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__game, s = g.player.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; });
    s.protT = 1e9; g.devGod = true; g.simulate = false; s.fly = false;
    s.items[0] = { id: 'm4a1', mag: 30, reserve: 90 }; s.cur = 0; g.player.refreshWeapon?.();
    window.__p0 = { x: s.pos.x, z: s.pos.z };
    const V = s.pos.constructor; let best = 0;                                // ekran görüntüsü için en açık yöne bak
    for (let k = 0; k < 32; k++) { const yw = (k / 32) * Math.PI * 2, h = g.world.raycast(new V(s.pos.x, s.pos.y + 1.5, s.pos.z), new V(-Math.sin(yw), 0, -Math.cos(yw)), 80, {}); const d = h ? h.t : 80; if (d > best) { best = d; s.yaw = yw; } }
    s.pitch = 0;
    const t = g.player.touch;                                                 // dokunmatik denetim kendi rAF'ında g.simulate kapalıyken kendini sıfırlar: test adımlarıyla sürülürken açık say
    if (t) { const u = t.update.bind(t); t.update = () => { const sv = g.simulate; g.simulate = true; u(); g.simulate = sv; }; }
  });
  await page.evaluate(HELPERS);
  const ev = (f, a) => page.evaluate(f, a);
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const shot = async (name) => { if (!SHOT) return; await frame(); await page.screenshot({ path: `${SHOT}/${dev}-${name}.png` }); };
  const res = {};

  if (dev === 'desk' && want('hold')) {
    // ── basılı tutma nişanı: Shift + W ile koş → sağ tık basılı → bırak ──
    await ev(() => window.__h.reset());
    await ev(() => { window.__h.key('KeyW', true); window.__h.key('ShiftLeft', true); });
    const run = await ev(() => window.__h.step(60, 'run'));
    await shot('hold-0-kosu');
    await ev(() => window.__h.rmb(true));
    const ads = [];
    for (let i = 0; i < 4; i++) { ads.push(...(await ev(() => window.__h.step(3, 'ads')))); await shot(`hold-${i + 1}-nisan-${(i + 1) * 3}kare`); }
    ads.push(...(await ev(() => window.__h.step(28, 'ads'))));
    await shot('hold-5-nisan-tam');
    await ev(() => window.__h.rmb(false));
    const back = await ev(() => window.__h.step(40, 'back'));
    await shot('hold-6-birakinca-kosu');
    res.hold = { run, ads, back };
    const R = run.at(-1), A1 = ads[0], A = ads.at(-1), B = back.at(-1);
    const firstAds = ads.findIndex((f) => f.adsT > 0), fullAds = ads.findIndex((f) => f.adsT >= 1);
    console.log(`      basılı: koşu ${R.v} m/sn · nişan basıldı → 1. kare koşu ${A1.sp}, adsT>0 ilk kare ${firstAds + 1}, tam nişan ${fullAds + 1}. kare · hız ${A.v} · koşu pozu ${ads[fullAds]?.sprK}`);
    check(R.sp === 1 && R.v > 7, `koşuyor (${R.v} m/sn)`);
    check(A1.sp === 0, 'nişan basıldığı ilk karede koşu bitti');
    check(firstAds >= 0 && firstAds <= 1, `nişan geçişi ${firstAds + 1}. karede başladı (≤ 2; koşu bayrağı önceki kareden, sunucu da aynı sırayla)`);
    check(fullAds >= 0 && fullAds <= 9, `tam nişan ${fullAds + 1}. karede (≤ 10)`);
    check(A.sp === 0 && A.v < 5, `nişandayken koşu yok, hız ${A.v} m/sn (< yürüme)`);
    check((ads[fullAds]?.sprK ?? 1) < 0.02, `tam nişanda birinci şahıs koşu pozu kalmadı (${ads[fullAds]?.sprK})`);
    check(ads.every((f) => f.sp === 0), 'Shift basılıyken nişan boyunca koşulmadı (nişan öncelikli)');
    check(B.sp === 1 && B.v > 7 && B.adsT === 0, `sağ tık bırakılınca Shift hâlâ basılı → koşuya dönüldü (${B.v} m/sn)`);
  }

  if (dev === 'desk' && want('toggle')) {
    // ── aç-kapa nişan: koşarken sağ tık (bas-bırak) → nişan açık kalır, Shift basılı olsa da koşu yok; Shift yeniden basılınca nişan kapanır, koşu ──
    await ev(() => { window.__game.opts.adsToggle = true; window.__h.reset(); window.__h.key('KeyW', true); window.__h.key('ShiftLeft', true); });
    const run = await ev(() => window.__h.step(60, 'run'));
    await ev(() => { window.__h.rmb(true); window.__h.rmb(false); });
    const ads = await ev(() => window.__h.step(40, 'ads'));
    await shot('toggle-1-nisan');
    // nişan kapat (sağ tık): Shift hâlâ basılı → koşu
    await ev(() => { window.__h.rmb(true); window.__h.rmb(false); });
    const off = await ev(() => window.__h.step(40, 'off'));
    // yeniden nişan, sonra Shift bırak + yeniden bas → nişan kapanır, koşu
    await ev(() => { window.__h.rmb(true); window.__h.rmb(false); });
    const ads2 = await ev(() => window.__h.step(30, 'ads2'));
    await ev(() => { window.__h.key('ShiftLeft', false); });
    const walk = await ev(() => window.__h.step(10, 'walk'));
    await ev(() => { window.__h.key('ShiftLeft', true); });
    const re = await ev(() => window.__h.step(30, 're'));
    await shot('toggle-2-shift-yeniden');
    // duran oyuncu nişandayken Shift: yok sayılır (koşu yok, nişan kalır)
    await ev(() => { window.__h.key('KeyW', false); window.__h.key('ShiftLeft', false); window.__h.rmb(true); window.__h.rmb(false); });
    const still = await ev(() => window.__h.step(20, 'still'));
    await ev(() => window.__h.key('ShiftLeft', true));
    const still2 = await ev(() => window.__h.step(10, 'still2'));
    await ev(() => { window.__game.opts.adsToggle = false; });
    res.toggle = { run, ads, off, ads2, walk, re, still, still2 };
    const A = ads.at(-1);
    console.log(`      aç-kapa: koşarken tık → nişan ${A.ads} adsT ${A.adsT} koşu ${A.sp} hız ${A.v} · tekrar tık → koşu ${off.at(-1).sp} · Shift yeniden → nişan ${re.at(-1).ads} koşu ${re.at(-1).sp}`);
    check(run.at(-1).sp === 1, 'koşuyor');
    check(A.ads === 1 && A.adsT === 1 && A.sp === 0 && ads[0].sp === 0, `koşarken tık: nişan açıldı, koşu bitti (hız ${A.v})`);
    check(off.at(-1).ads === 0 && off.at(-1).sp === 1, 'nişan kapatılınca (Shift basılı) koşuya dönüldü');
    check(ads2.at(-1).adsT === 1 && walk.at(-1).ads === 1 && walk.at(-1).sp === 0, 'Shift bırakıldı: nişan sürüyor');
    check(re.at(-1).ads === 0 && re.at(-1).sp === 1 && re.at(-1).v > 7, 'nişandayken Shift yeniden basıldı → nişan kapandı, koşuldu');
    check(still2.at(-1).ads === 1 && still2.at(-1).sp === 0, 'dururken (W yok) Shift nişanı kapatmaz');
  }

  if (dev !== 'desk' && want('touch')) {
    // ── dokunmatik: joystick kenara (koşu) + nişan düğmesi; otomatik koşu kilidi + nişan ──
    const T = (f, a) => ev(f, a);
    await T(() => { window.__h.reset(); const t = window.__game.player.touch; t.setJoy(0, -(t.jR || 60)); });
    const run = await ev(() => window.__h.step(60, 'run'));
    await shot('touch-0-kosu');
    await T(() => window.__game.player.touch.press('ads', true, {}));
    const ads = await ev(() => window.__h.step(30, 'ads'));
    await shot('touch-1-nisan');
    await T(() => window.__game.player.touch.press('ads', true, {}));
    const off = await ev(() => window.__h.step(40, 'off'));
    // otomatik koşu (kilit)
    await T(() => { const t = window.__game.player.touch; t.setJoy(0, 0); t.runLock = true; t.setJoy(0, -1); });
    const lock = await ev(() => window.__h.step(60, 'lock'));
    await T(() => window.__game.player.touch.press('ads', true, {}));
    const ladsF = await ev(() => window.__h.step(30, 'lads'));
    await shot('touch-2-kilit-nisan');
    await T(() => window.__game.player.touch.press('ads', true, {}));
    const loff = await ev(() => window.__h.step(40, 'loff'));
    // aç-kapa ayarı açıkken de aynı
    await T(() => { window.__game.opts.adsToggle = true; window.__game.player.touch.press('ads', true, {}); });
    const tog = await ev(() => window.__h.step(30, 'tog'));
    await T(() => { window.__game.opts.adsToggle = false; const t = window.__game.player.touch; t.runLock = false; t.setJoy(0, 0); window.__game.player.s.ads = false; });
    res.touch = { run, ads, off, lock, ladsF, loff, tog };
    console.log(`      dokunmatik: koşu ${run.at(-1).v} → nişan ${ads.at(-1).adsT}/${ads.at(-1).v} m/sn → kapat koşu ${off.at(-1).sp} · kilit ${lock.at(-1).sp} → nişan ${ladsF.at(-1).adsT}/${ladsF.at(-1).v} → kapat ${loff.at(-1).sp} · aç-kapa ayarında ${tog.at(-1).adsT}`);
    check(run.at(-1).sp === 1, 'joystick kenarda: koşu');
    check(ads[0].sp === 0 && ads.at(-1).adsT === 1 && ads.at(-1).v < 5, 'nişan düğmesi: koşu bitti, tam nişan');
    check(off.at(-1).sp === 1 && off.at(-1).adsT === 0, 'nişan kapatılınca joystick kenarda → koşu');
    check(lock.at(-1).sp === 1, 'otomatik koşu kilidi: koşu');
    check(ladsF[0].sp === 0 && ladsF.at(-1).adsT === 1 && ladsF.at(-1).v > 1 && ladsF.at(-1).v < 5, `kilitte nişan: koşu kesildi, nişanla yürüyor (${ladsF.at(-1).v} m/sn)`);
    check(loff.at(-1).sp === 1, 'kilitte nişan kapatılınca koşuya dönüldü');
    check(tog.at(-1).adsT === 1 && tog.at(-1).sp === 0, 'aç-kapa ayarı açıkken de dokunmatik nişan koşuyu keser');
  }
  check(!errs.length, `${dev}: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
  return res;
}

if (want('desk') || want('hold') || want('toggle')) await offline('desk');
if (want('touch')) await offline('mob');

if (want('net')) {
  // ── çevrim içi: koşarken nişan (basılı + aç-kapa), tahmin düzeltmesi artmamalı ──
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?online=new&server=${encodeURIComponent(WS)}&debug=1&nolock=1&name=Kosu&map=colgecidi&per=1&type=tdm`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player && window.__game.online && window.__game.playerSoldier && window.__game.playerSoldier.alive', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.evaluate(HELPERS);
  // botları sustur, en açık yöne dön (60 m ışın)
  const yaw = await page.evaluate(() => {
    const g = window.__game, s = g.player.s, T3 = s.pos.constructor;
    g.online.send({ t: 'dbg', bots: false });
    let best = 0, by = 0;
    for (let k = 0; k < 32; k++) {
      const yw = (k / 32) * Math.PI * 2, d = new T3(-Math.sin(yw), 0, -Math.cos(yw)), from = new T3(s.pos.x, s.pos.y + 1, s.pos.z);
      const h = g.world.raycast(from, d, 80, {}); const dist = h ? (h.dist ?? h.distance ?? h.t ?? 80) : 80;
      if (dist > best) { best = dist; by = yw; }
    }
    s.yaw = by; return { by, best };
  });
  console.log(`      çevrim içi: en açık yön ${yaw.best.toFixed(1)} m`);
  const sample = async (ms, tag) => {
    const out = [];
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      out.push(await page.evaluate((tag) => { const g = window.__game, s = g.player.s; return { tag, sp: s.sprinting ? 1 : 0, ads: s.ads ? 1 : 0, adsT: +s.adsT.toFixed(2), v: +Math.hypot(s.vel.x, s.vel.z).toFixed(2), gr: s.onGround ? 1 : 0, x: +s.pos.x.toFixed(1), z: +s.pos.z.toFixed(1), corr: g.online.stats.corrections, err: +(g.online.stats.lastErr || 0).toFixed(3) }; }, tag));
      await page.waitForTimeout(40);
    }
    return out;
  };
  const back = async () => { await page.evaluate((y) => { window.__game.player.s.yaw = y + Math.PI; }, yaw.by); await page.evaluate(() => window.__h.key('KeyW', true)); await page.waitForTimeout(1200); await page.evaluate((y) => { window.__h.key('KeyW', false); window.__game.player.s.yaw = y; }, yaw.by); await page.waitForTimeout(500); };
  const corr0 = await page.evaluate(() => window.__game.online.stats.corrections);
  const runs = [];
  for (const mode of ['ctl', 'hold', 'toggle', 'ctl', 'hold', 'toggle']) {
    await page.evaluate((m) => { window.__game.opts.adsToggle = m === 'toggle'; window.__game.player.s.ads = false; }, mode);
    await page.evaluate(() => { window.__h.key('KeyW', true); window.__h.key('ShiftLeft', true); });
    const r1 = await sample(700, 'run');
    if (mode !== 'ctl') await page.evaluate(() => window.__h.rmb(true));
    if (mode === 'toggle') await page.evaluate(() => window.__h.rmb(false));
    const r2 = await sample(600, 'ads');
    if (mode === 'hold') await page.evaluate(() => window.__h.rmb(false)); else if (mode === 'toggle') await page.evaluate(() => { window.__h.rmb(true); window.__h.rmb(false); });
    const r3 = await sample(600, 'back');
    await page.evaluate(() => { window.__h.key('KeyW', false); window.__h.key('ShiftLeft', false); });
    await page.waitForTimeout(300);
    await back();
    const r = { mode, r1, r2, r3 }; runs.push(r);
    r.corr = [r1[0].corr, r3.at(-1).corr];
    console.log(`      ${mode}: koşu ${r1.at(-1).v} (${r1.at(-1).sp}) → nişan adsT ${r2.at(-1).adsT} hız ${r2.at(-1).v} koşu ${r2.at(-1).sp} → bırak koşu ${r3.at(-1).sp} ${r3.at(-1).v} · düzeltme bu turda ${r.corr[1] - r.corr[0]} (geri yürüme dahil değil)`);
  }
  const corr1 = await page.evaluate(() => window.__game.online.stats.corrections);
  if (process.env.V) for (const r of runs) console.log(r.mode, JSON.stringify([...r.r1, ...r.r2, ...r.r3].map((f) => [f.tag[0], f.sp, f.adsT, f.v, f.gr, f.x, f.z, f.corr, f.err].join(' '))));
  for (const r of runs.filter((r) => r.mode !== 'ctl')) {
    check(r.r1.at(-1).sp === 1 && r.r2.at(-1).sp === 0 && r.r2.at(-1).adsT === 1 && r.r2.at(-1).v < 5 && r.r3.at(-1).sp === 1, `çevrim içi ${r.mode}: koşu → nişan (koşu yok) → koşuya dönüş`);
  }
  const cRun = runs.filter((r) => r.mode !== 'ctl').reduce((a, r) => a + r.corr[1] - r.corr[0], 0), cCtl = runs.filter((r) => r.mode === 'ctl').reduce((a, r) => a + r.corr[1] - r.corr[0], 0);
  check(cRun <= 1, `çevrim içi koşu ↔ nişan geçişlerinde tahmin düzeltmesi yok (${cRun}; nişansız koşu denetimi ${cCtl}; tüm test ${corr0} → ${corr1})`);
  check(!errs.length, `çevrim içi sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
