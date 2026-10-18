// Ses + öldürme hissi testi (Playwright; vite çalışırken).  node scripts/sfxtest.mjs [url=http://127.0.0.1:5180] [süre_sn=60]
//   1) OfflineAudioContext ile sesleri çevrimdışı çizer: sessiz değil (RMS), kırpma yok (tepe < 1,0) — silahlar, patlama, öldürme, adım, yükleme, lobi müziği
//   2) Gerçek maçta N sn boyunca sürekli ateş / çarpma / adım / isabet: çalan kaynak sayısı (sfx.live) sınırlı kalır ve sonunda sıfıra iner (düğüm sızıntısı yok),
//      ses kurma süresi (JS, çağrı başına) ölçülür; konsol hatası yok
//   3) Öldürme hissi ekran görüntüleri (tek / kafadan / çift / üçlü; masaüstü + Pixel 7 touch=1) → /tmp/wb-c-shots/
import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const DUR = +(process.argv[3] || 60);
const OUT = '/tmp/wb-c-shots'; fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const watch = (page, tag) => { page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|WebSocket|ERR_CONNECTION/i.test(m.text())) errs.push(`${tag}: ${m.text()}`); }); };

// ── 1) çevrimdışı çizim
{
  const page = await browser.newPage(); watch(page, 'offline');
  await page.goto(base + '/?debug=1');
  const res = await page.evaluate(async () => {
    const { Sfx } = await import('/src/game/audio.js');
    const { LobbySynth, STEP } = await import('/src/game/music.js');
    const SR = 44100;
    const meas = (buf) => { let pk = 0, ss = 0, n = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; ss += d[i] * d[i]; n++; } } return { peak: +pk.toFixed(3), rms: +Math.sqrt(ss / n).toFixed(4) }; };
    const render = async (sec, fn) => { const off = new OfflineAudioContext(2, Math.ceil(SR * sec), SR); const s = new Sfx(); s.setVolume(1); s.init(off); fn(s, off); return meas(await off.startRendering()); };
    const P = (x, z) => ({ x, y: 0, z });
    const out = {};
    for (const k of ['pistol', 'smg', 'carbine', 'battle', 'shotgun', 'sniper', 'barrett', 'lmg', 'rpg', 'marker']) out['shot:' + k] = await render(1.6, (s) => s.shot(k, null));
    out['shot:carbine@80m'] = await render(1.6, (s) => s.shot('carbine', P(80, 0)));
    out['otomatik 10 atış'] = await render(1.8, (s) => { s._dd = 0; const orig = s._voice.bind(s); s._voice = (p, g, o = {}) => orig(p, g, { ...o, delay: (o.delay || 0) + s._dd }); for (let i = 0; i < 10; i++) { s._dd = i * 0.09; s.shot('battle', null); } });
    out['explosion@1m'] = await render(3, (s) => s.explosion(P(1, 0)));
    out['explosion@25m'] = await render(3, (s) => s.explosion(P(25, 0)));
    out['3 patlama üst üste'] = await render(3, (s) => { s.explosion(P(1, 0)); s.explosion(P(-1, 1)); s.explosion(P(0, 2)); s.shot('barrett', null); });
    out['kill+hs+multi'] = await render(1, (s) => s.kill(true, 3));
    out['hit'] = await render(0.4, (s) => s.hit(40));
    out['step'] = await render(0.3, (s) => s.step(null));
    out['reload'] = await render(1.8, (s) => s.reload(null, 'mag', 1.4, true));
    out['impact@5m'] = await render(0.5, (s) => s.impact(P(5, 0)));
    // lobi müziği: 12 sn çevrimdışı (zamanlayıcı yerine elle sıralanır)
    { const off = new OfflineAudioContext(2, SR * 12, SR); const m = new LobbySynth(); m.vol = 0.5; m.start(off); clearInterval(m.timer); while (m.next < 11.5) { m.play(m.step++, m.next); m.next += STEP; } const b = await off.startRendering(); out['lobi müziği 12 sn'] = meas(b); const d = b.getChannelData(0); let late = 0; for (let i = SR * 6; i < SR * 11; i++) late = Math.max(late, Math.abs(d[i])); out['lobi müziği 12 sn'].late = +late.toFixed(3); }
    return out;
  });
  for (const [k, r] of Object.entries(res)) {
    const silentOk = r.rms > (k.includes('@80m') || k === 'step' || k.startsWith('impact') ? 0.0004 : 0.002);
    check(silentOk && r.peak < 1.0, `${k.padEnd(22)} tepe ${r.peak}  rms ${r.rms}${r.late != null ? '  6–11 sn tepe ' + r.late : ''}`);
  }
  check(res['lobi müziği 12 sn'].late > 0.02, 'lobi müziği döngüde sürüyor (sönmüyor)');
  check(res['shot:carbine@80m'].rms < res['shot:carbine'].rms * 0.5, 'uzak atış yakından belirgin kısık');
  await page.close();
}

// ── 1b) lobi müziği gerçek menüde: ilk tıklamadan sonra başlar, ses ayarına uyar, maça girince durur
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); watch(page, 'menu');
  await page.goto(base + '/?debug=1');
  await page.waitForTimeout(2500);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(1500);
  const m = await page.evaluate(async () => { const { music } = await import('/src/game/music.js'); const s = music.synth; return { on: s.on, live: s.live, vol: music.vol, g: s.out?.gain.value }; });
  check(m.on && m.live > 0, `menüde prosedürel lobi müziği çalıyor (çalan nota ${m.live}, ses ${m.vol.toFixed(2)})`);
  const off = await page.evaluate(async () => { const { music } = await import('/src/game/music.js'); music.play('match'); await new Promise((d) => setTimeout(d, 1600)); return { on: music.synth.on, g: music.synth.out.gain.value, live: music.synth.live }; });
  check(!off.on && off.g < 0.01, `maça geçince müzik söndü (kazanç ${off.g.toFixed(4)}, kalan nota ${off.live})`);
  await page.close();
}

// ── 2) gerçek maçta sızıntı / CPU
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); watch(page, 'live');
  await page.goto(base + '/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1');
  await page.waitForFunction(() => window.__game?.sfx?.ctx, null, { timeout: 60000 });
  await page.mouse.click(640, 360);
  const r = await page.evaluate(async (DUR) => {
    const g = window.__game, s = g.sfx; s.setVolume(0.6);
    await s.ctx.resume();
    const kinds = ['smg', 'carbine', 'battle', 'shotgun', 'sniper', 'lmg', 'pistol'];
    let calls = 0, js = 0, maxLive = 0; const samples = [];
    const me = g.playerSoldier.pos;
    const t0 = performance.now();
    await new Promise((done) => {
      const id = setInterval(() => {
        const a = performance.now();
        const p = { x: me.x + (Math.random() - 0.5) * 60, y: me.y, z: me.z + (Math.random() - 0.5) * 60 };
        s.shot(kinds[calls % kinds.length], calls % 3 ? p : null); s.impact(p); s.step(calls % 2 ? null : p);
        if (calls % 10 === 0) { s.hit(30); s.reload(p); } if (calls % 40 === 0) { s.explosion(p); s.kill(calls % 80 === 0, 2); }
        js += performance.now() - a; calls++;
        maxLive = Math.max(maxLive, s.live);
        if ((performance.now() - t0) % 5000 < 50) samples.push(s.live);
        if (performance.now() - t0 > DUR * 1000) { clearInterval(id); done(); }
      }, 50);
    });
    const liveEnd = s.live;
    await new Promise((d) => setTimeout(d, 3500));
    return { calls, usPer: +(js / calls * 1000).toFixed(1), maxLive, liveEnd, liveAfter: s.live, samples, state: s.ctx.state };
  }, DUR);
  console.log(`      ${r.calls} tur (her turda atış + çarpma + adım …), tur başı JS ${r.usPer} µs, en çok çalan kaynak ${r.maxLive}, örnekler ${r.samples.join(',')}, bitişte ${r.liveEnd} → 3,5 sn sonra ${r.liveAfter} (ctx ${r.state})`);
  check(r.state === 'running', 'AudioContext çalışıyor');
  check(r.maxLive < 400, 'çalan kaynak sayısı sınırlı (< 400)');
  check(r.liveAfter <= 4, 'ateş bitince kaynaklar temizlendi (sızıntı yok)');
  check(r.usPer < 1500, 'ses kurma maliyeti makul (tur başı < 1,5 ms)');
  // maç bitip yeniden başlayınca yeni AudioContext açılmıyor
  const same = await page.evaluate(async () => { const c1 = window.__game.sfx.ctx; window.__game.restart(); await new Promise((d) => { const w = () => (window.__game && window.__game.sfx?.ctx && window.__game.running !== undefined ? d() : setTimeout(w, 200)); setTimeout(w, 500); }); return window.__game.sfx.ctx === c1; });
  check(same, 'yeniden başlatmada ortak AudioContext kullanıldı');
  await page.close();
}

// ── 3) öldürme hissi görüntüleri
async function killShots(ctxOpts, tag, q = '') {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); watch(page, tag);
  await page.addInitScript(() => { try { localStorage.setItem('warbyte.lang', 'tr'); } catch (e) { /* yok */ } });
  await page.goto(base + `/?autostart=4v4&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1${q}`);
  await page.waitForFunction(() => window.__game?.playerSoldier && window.__game.running, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.mouse.click(ctxOpts.viewport.width / 2, ctxOpts.viewport.height / 2);
  await page.evaluate(() => { const g = window.__game; if (!g.brainsOff) g.brainsOff = g.brains.splice(0); });
  const killOne = (hs, wpn) => page.evaluate(([hs, wpn]) => {
    const g = window.__game, me = g.playerSoldier;
    const v = g.soldiers.find((s) => s.team !== me.team && s.alive && !s.vacant);
    if (!v) return false;
    v.protT = 0; v.takeDamage(500, me, hs ? 'head' : 'body', me.pos.clone(), wpn); return v.name;
  }, [hs, wpn]);
  // 380 ms sonra canlandırmalar dondurulur (yazılım GL'de ekran görüntüsü yavaş: bildirim sönmesin), metin okunur, görüntü alınır, sonra sürdürülür
  const shot = async (name) => {
    await page.waitForTimeout(380);
    const st = await page.evaluate(() => { const k = window.__game.killfx; clearTimeout(k._clr); document.getAnimations().forEach((a) => { a.pause(); a.currentTime = Math.min(360, a.effect.getTiming().duration * 0.5); }); return { cd: document.querySelector('#kfx .cd')?.textContent || '', sk: document.querySelector('#kfx .sk')?.textContent || '', mk: document.querySelectorAll('#killfeed .kf.mk').length, box: (() => { const r = document.querySelector('#kfx .nt')?.getBoundingClientRect(); return r ? [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight] : null; })() }; });
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
    await page.evaluate(() => { document.getAnimations().forEach((a) => a.finish()); window.__game.killfx.nt.innerHTML = ''; });
    return st;
  };
  const hitOnly = () => page.evaluate(() => { const g = window.__game; g.emit('hitmark', { zone: 'body', dead: false, dmg: 28 }); });
  await hitOnly(); await page.waitForTimeout(40); await page.screenshot({ path: `${OUT}/${tag}-hit.png` });
  await page.waitForTimeout(800);
  check(!!(await killOne(false, 'AK-47')), `${tag}: tek öldürme`); const txt = (await shot('1-tek')).cd;
  check(/ELENDİ/.test(txt) && /\+100/.test(txt), `${tag}: bildirim metni "${txt}"`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__game.killfx.lastKill = -99; });     // çoklu öldürme penceresi sıfır
  await killOne(true, 'M4A1'); check(/KAFADAN|HEADSHOT/.test((await shot('2-kafadan')).cd), `${tag}: kafadan rozeti`);
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__game.killfx.lastKill = performance.now() / 1000; });   // görüntü süresi pencereyi aşmasın: az önce öldürmüş say
  await killOne(false, 'M4A1'); check(/ÇİFT|DOUBLE/.test((await shot('3-cift')).sk), `${tag}: çift öldürme çağrısı`);
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__game.killfx.lastKill = performance.now() / 1000; });
  await killOne(true, 'M4A1'); const s4 = await shot('4-uclu'); const feed = s4.mk;
  check(/ÜÇLÜ|TRIPLE/.test(s4.sk), `${tag}: üçlü çağrısı "${s4.sk}"`);
  check(feed >= 1, `${tag}: öldürme akışında kendi öldürmelerin vurgulu (${feed})`);
  // taşma denetimi: bildirim ekranın içinde
  const box = s4.box;
  check(box && box[0] >= 0 && box[2] <= box[4] && box[3] <= box[5], `${tag}: bildirim ekranın içinde ${box?.map(Math.round).join(',')}`);
  await ctx.close();
}
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
await killShots({ viewport: { width: 1600, height: 900 } }, 'masaustu');
await killShots(strip(devices['Pixel 7 landscape']), 'pixel7', '&touch=1');

check(errs.length === 0, 'konsol hatası yok' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
