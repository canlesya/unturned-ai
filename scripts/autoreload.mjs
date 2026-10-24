// 12.140 Otomatik şarjör değiştirme + bıçak 3 / ekipman 4 testi.
//   node scripts/autoreload.mjs [sim,off,net,menu]   (varsayılan: hepsi)
//   sim : tarayıcısız sunucu Game'i — her gun / launcher silahında son mermi → otomatik reload (tık, basılı, nişan, koşu, zıplama), yedek yoksa boş tetik, boş silaha geçince reload, bot useGadget
//   off : çevrimdışı autostart (BASE, varsayılan http://127.0.0.1:5180) — yerel oyuncu aynı durumlar + 3 / 4 tuşları + HUD şeridi
//   net : çevrimiçi (WSURL, BF_DEBUG=1 sunucu) — istemci tahmini ile sunucunun reload'ı aynı anda başlıyor mu, cephane sonunda eşit mi
//   mob : telefon (Pixel 7) — HUD şeridi, şeride dokunma, dokunmatik ateşle otomatik reload
//   menu: Kontroller sayfası (yeni varsayılan + eski kayıtlı özel atama)
// Ekran görüntüleri: OUT (varsayılan /tmp/wb-autoreload)
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import fs from 'fs';

const parts = (process.argv[2] || 'sim,off,net,mob,menu').split(',');
const BASE = process.env.BASE || 'http://127.0.0.1:5180', WSURL = process.env.WSURL || 'ws://127.0.0.1:8787', OUT = process.env.OUT || '/tmp/wb-autoreload';
fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const IDS = Object.keys(WSTATS).filter((id) => WSTATS[id].kind === 'gun' || WSTATS[id].kind === 'launcher');
const MODES = { tik: {}, basili: { fh: 1 }, nisan: { a: 1 }, kosu: { s: 1, f: 1 }, zipla: { j: 1 } };

// ───────── 1) sunucu simülasyonu (insan oyuncu = girdi güdümlü humanTick) ─────────
if (parts.includes('sim')) {
  const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
  const A = g.claimSlot('blue', 'Ali'), h = g.humans.get(A.id);
  g.brains.length = 0;
  const DT = 1 / 60; let q = 0;
  const input = (extra) => h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 1.2, c: 0, p: 0, u: 0, w: A.cur, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, ...extra });
  const tick = (extra) => { input(extra); g.step(DT); };
  for (let i = 0; i < 140; i++) tick({});
  const prep = (id, mag, reserve, idx = WSTATS[id].kind === 'launcher' ? 2 : 0) => {
    A.alive = true; A.hp = A.maxHp; A.protT = 0;
    A.items[idx] = { id, mag, reserve }; A.cur = idx; A.reloadT = 0; A.cd = 0; A.switchT = 0; A.swing = null; A.useT = 0; A.burstLeft = 0;
    for (let i = 0; i < 3; i++) tick({ w: idx });
  };
  const bad = [];
  for (const id of IDS) for (const [mn, ex] of Object.entries(MODES)) {
    const st = WSTATS[id];
    prep(id, 1, st.reserve || 3);
    let shotT = -1, relT = -1, refill = false;
    for (let t = 0; t < 600; t++) {
      tick({ ...ex, fp: t === 0 ? 1 : 0, fh: ex.fh || (t === 0 ? 1 : 0) });
      A.hp = A.maxHp;
      if (shotT < 0 && A.item.mag === 0) shotT = t;
      if (relT < 0 && A.reloadT > 0) relT = t;
      if (relT >= 0 && A.item.mag > 0) { refill = true; break; }
    }
    if (!(shotT >= 0 && relT >= 0 && relT - shotT <= 1 && refill)) bad.push(`${id}/${mn} atış ${shotT} reload ${relT} doldu ${refill}`);
  }
  check(!bad.length, `sunucu: ${IDS.length} silah × ${Object.keys(MODES).length} durum — son mermiden ≤ 1 adım sonra otomatik reload, şarjör doluyor${bad.length ? ' · ' + bad.join(' | ') : ''}`);
  // yedek yok → reload yok, boş tetik (cd 0,3). Doğma noktasındaki ikmal yedeği doldurabildiği için her adım 0'a çekilir
  prep('m4a1', 1, 0); tick({ fp: 1, fh: 1 }); let anyRel = false, dryCd = false; for (let i = 0; i < 30; i++) { A.item.reserve = 0; tick({ fh: 1 }); anyRel ||= A.reloadT > 0; dryCd ||= A.cd > 0.2; }
  check(A.item.mag === 0 && !anyRel && dryCd, 'sunucu: yedek yoksa reload başlamaz (boş tetik: cd 0,3 kalır)');
  prep('rpg', 1, 0); tick({ fp: 1 }); for (let i = 0; i < 10; i++) { A.items[2].reserve = 0; tick({}); }
  check(A.items[2].mag === 0 && A.reloadT === 0, 'sunucu: RPG yedeksiz → reload yok');
  // boş şarjörlü silaha geçiş → çekiş biter bitmez reload
  prep('m4a1', 30, 90); A.items[1] = { id: 'pistol', mag: 0, reserve: 24 };
  let sw = -1; for (let t = 0; t < 60; t++) { tick({ w: 1 }); if (A.reloadT > 0) { sw = t; break; } }
  check(sw > 0 && A.cur === 1, `sunucu: boş tabancaya geçince çekiş sonrası (${sw}. adım) otomatik reload`);
  // bot: useGadget (RPG elde değilken) birincil silahın reload'unu tetiklememeli
  const bot = g.soldiers.find((e) => e !== A && e.team === 'red');
  bot.alive = true; bot.cur = 0; bot.items[2] = { id: 'rpg', mag: 1, reserve: 2 }; bot.cd = 0; bot.reloadT = 0; bot.switchT = 0; bot.items[0].mag = 30;
  const ok = bot.useGadget('rpg'); bot.update(DT);
  check(ok && bot.cur === 0 && bot.reloadT === 0 && bot.items[2].mag === 1 && bot.items[2].reserve === 1, 'bot useGadget(RPG): eldeki silah reload olmaz, roket eskisi gibi hemen dolar');
}

// ───────── tarayıcı ortak ─────────
let browser;
const launch = async () => { if (!browser) { const { chromium } = await import('playwright'); browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); } return browser; };
// sayfada: tek silah denemesi (rAF ile izler)
const TRY = async ({ id, mag, reserve, mode }) => {
  const g = window.__game, s = g.playerSoldier, p = g.player, st = { m: {} };
  const idx = id === 'rpg' || id === 'm79' ? 2 : 0;
  s.alive = true; s.hp = s.maxHp; g.devGod = true;
  s.items[idx] = { id, mag, reserve }; if (s.cur !== idx) s.switchTo(idx); s.reloadT = 0; s.cd = 0; s.switchT = 0; s.swing = null;
  p.refreshWeapon(); s._syncWeaponModel?.();
  await new Promise((r) => setTimeout(r, 250));
  s.pitch = 1.1; s.cd = 0; s.switchT = 0;
  if (mode === 'kosu') { p.keys.add('ShiftLeft'); p.keys.add('KeyW'); }
  if (mode === 'zipla') p.keys.add('Space');
  const t0 = performance.now(); let shotF = -1, relF = -1, full = false, f = 0, adsAtShot = null, sprintAtShot = null;
  if (mode === 'nisan') { s.ads = true; const ta = performance.now(); while (s.adsT < 0.9 && performance.now() - ta < 8000) await new Promise((r) => setTimeout(r, 30)); }      // makine yükündeyken kare yavaş: nişan tam oturana dek bekle
  await new Promise((r) => setTimeout(r, 50));
  adsAtShot = s.adsT; sprintAtShot = s.sprinting;
  p.fireBuf = 0.15; p.fireHeld = true;
  await new Promise((res) => {
    const loop = () => {
      f++;
      if (shotF < 0 && s.items[idx].mag === 0) shotF = f;
      if (shotF < 0) p.fireBuf = 0.15;                                   // yavaş karede tampon (0,15 sn) atıştan önce sönmesin
      else if (mode !== 'basili') p.fireHeld = false;
      if (relF < 0 && s.reloadT > 0) relF = f;
      if (relF >= 0 && s.items[idx].mag > 0) { full = true; return res(); }
      if (performance.now() - t0 > 30000) return res();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  p.fireHeld = false; p.keys.clear(); s.ads = false;
  return { shotF, relF, full, adsAtShot: +(adsAtShot || 0).toFixed(2), sprintAtShot, mag: s.items[idx].mag, res: s.items[idx].reserve };
};

// ───────── 2) çevrimdışı ─────────
if (parts.includes('off')) {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); });
  const pick = ['m4a1', 'ak47', 'pistol', 'deagle', 'shotgun', 'dbl', 'sniper', 'barrett', 'pkm', 'aa12', 'pbrifle', 'rpg', 'm79'].filter((id) => WSTATS[id]);
  const list = [...new Set([...pick, ...IDS.filter((id) => WSTATS[id].reloadStyle).slice(0, 4)])];
  const bad = [];
  for (const id of list) for (const mode of Object.keys(MODES)) {
    const r = await page.evaluate(TRY, { id, mag: 1, reserve: WSTATS[id].reserve || 3, mode });
    if (!(r.shotF > 0 && r.relF > 0 && r.relF - r.shotF <= 2 && r.full)) bad.push(`${id}/${mode} ${JSON.stringify(r)}`);
    if (mode === 'nisan' && id === 'm4a1' && !(r.adsAtShot > 0.5)) bad.push('m4a1 nişan alınmamıştı');
  }
  check(!bad.length, `çevrimdışı oyuncu: ${list.join(', ')} × ${Object.keys(MODES).join('/')} → son mermiden hemen sonra otomatik reload${bad.length ? ' · ' + bad.join(' | ') : ''}`);
  const dry = await page.evaluate(TRY, { id: 'rpg', mag: 1, reserve: 0, mode: 'tik' });
  check(dry.relF < 0 && dry.mag === 0, 'çevrimdışı: RPG yedeksiz → reload yok');
  // RPG ateşlenip reload sürerken görüntü
  await page.evaluate(async () => { const g = window.__game, s = g.playerSoldier, p = g.player; s.items[2] = { id: 'rpg', mag: 1, reserve: 2 }; s.switchTo(2); await new Promise((r) => setTimeout(r, 600)); s.pitch = 0.05; s.cd = 0; p.fireBuf = 0.15; await new Promise((r) => setTimeout(r, 900)); });
  await page.screenshot({ path: `${OUT}/rpg-otoreload.png` });
  check(await page.evaluate(() => window.__game.playerSoldier.reloadT > 0), 'RPG atıldı → kendiliğinden yeniden dolduruyor (ekran: rpg-otoreload.png)');
  // tuşlar: 3 bıçak, 4 ekipman, HUD şeridi
  await page.evaluate(async () => { const g = window.__game, s = g.playerSoldier; s.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; s.reloadT = 0; await new Promise((r) => setTimeout(r, 300)); s.switchTo(0); });
  await page.waitForTimeout(500);
  const cur = async () => page.evaluate(() => window.__game.playerSoldier.cur);
  await page.keyboard.press('Digit3'); await page.waitForTimeout(500); const c3 = await cur();
  await page.screenshot({ path: `${OUT}/tus3-bicak.png` });
  await page.keyboard.press('Digit4'); await page.waitForTimeout(500); const c4 = await cur();
  await page.screenshot({ path: `${OUT}/tus4-ekipman.png` });
  await page.keyboard.press('KeyV'); await page.waitForTimeout(400); const cv = await cur();
  await page.keyboard.press('KeyG'); await page.waitForTimeout(400); const cg = await cur();
  await page.keyboard.press('Digit2'); await page.waitForTimeout(400); const c2 = await cur();
  check(c3 === 3 && c4 === 2 && cv === 3 && cg === 2 && c2 === 1, `masaüstü: 3 → bıçak (items[3]), 4 → el bombası (items[2]), V → bıçak, G → ekipman, 2 → tabanca (cur ${c3}/${c4}/${cv}/${cg}/${c2})`);
  const strip = await page.evaluate(() => [...document.querySelectorAll('#slots .slot')].map((e) => e.innerText.replace(/\s+/g, ' ').trim() + '@' + e.dataset.i));
  console.log('      HUD şeridi:', strip.join(' · '));
  check(strip.length === 4 && /^1/.test(strip[0]) && /^2/.test(strip[1]) && /^3.*@3$/.test(strip[2]) && /^4.*@2$/.test(strip[3]) && /BIÇAK|KNIFE/i.test(strip[2]), 'HUD şeridi: 1 ana · 2 yedek · 3 bıçak · 4 ekipman');
  await page.evaluate(() => window.__game.playerSoldier.switchTo(0)); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/hud-serit.png`, clip: { x: 520, y: 400, width: 440, height: 140 } });
  // fare tekerleği: ana → yedek → bıçak → ekipman → ana
  const wh = [];
  await page.evaluate(() => { window.__game.playerSoldier.fly = false; });          // dev=1 uçuşta başlar: tekerlek uçuş hızını ayarlar
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))); await page.waitForTimeout(300); wh.push(await cur()); }
  check(wh.join() === '1,3,2,0', `fare tekerleği sırası tuş sırasıyla aynı (cur ${wh.join(' → ')})`);
  check(!errs.length, 'çevrimdışı: sayfa hatası yok' + (errs.length ? ' · ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();
}

// ───────── 3) çevrimiçi: istemci tahmini ↔ sunucu ─────────
if (parts.includes('net')) {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const q = new URLSearchParams({ online: 'new', type: 'tdm', per: '2', map: 'colgecidi', debug: '1', nolock: '1', server: WSURL, name: 'Doldur', cls: 'assault' });
  await page.goto(`${BASE}/?${q}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const g = window.__game, net = g.online, me = g.playerSoldier, L = (window.__L = { srv: [], cli: [], am: null });
    const om = net.onMessage.bind(net);
    net.onMessage = (m) => { if (m.t === 'ev') for (const e of m.l) if (e.e === 'rld' && e.by === me.id) L.srv.push({ t: performance.now(), q: net.seq }); if (m.t === 'snap' && m.me) L.am = m.me.am; return om(m); };
    g.on('reload', (s) => { if (s === me) L.cli.push({ t: performance.now(), q: net.seq }); });
    net.send({ t: 'dbg', bots: false }); setInterval(() => net.send({ t: 'dbg', hp: 99999 }), 400);
  });
  const res = [];
  for (const [id, mode] of [['m4a1', 'basili'], ['m4a1', 'nisan'], ['pistol', 'tik'], ['shotgun', 'kosu'], ['sniper', 'tik'], ['rpg', 'tik'], ['rpg', 'nisan'], ['m79', 'zipla']].filter(([i]) => WSTATS[i])) {
    const idx = WSTATS[id].kind === 'launcher' ? 2 : 0, reserve = WSTATS[id].reserve || 3;
    await page.evaluate(([idx, id, reserve]) => { const g = window.__game; window.__L.srv.length = 0; window.__L.cli.length = 0; g.online.send({ t: 'dbg', item: [idx, id, 1, reserve] }); }, [idx, id, reserve]);
    await page.waitForFunction(([idx, id]) => { const s = window.__game.playerSoldier; return s.items[idx]?.id === id && s.items[idx].mag === 1; }, [idx, id], { timeout: 30000 }).catch(() => {});
    // tuşla geç (ekipman 4, ana 1)
    await page.keyboard.press(idx === 2 ? 'Digit4' : 'Digit1'); await page.waitForTimeout(700);
    const r = await page.evaluate(([id, mode]) => (async () => {
      const g = window.__game, s = g.playerSoldier, p = g.player, idx = s.cur;
      if (s.items[idx].id !== id) return { err: 'silah yok ' + s.items[idx].id };
      s.pitch = 1.1;
      if (mode === 'kosu') { p.keys.add('ShiftLeft'); p.keys.add('KeyW'); }
      if (mode === 'zipla') p.keys.add('Space');
      if (mode === 'nisan') { s.ads = true; const ta = performance.now(); while (s.adsT < 0.9 && performance.now() - ta < 8000) await new Promise((r) => setTimeout(r, 30)); }
      p.fireHeld = true;
      const t0 = performance.now();
      while (s.items[idx].mag > 0 && performance.now() - t0 < 8000) { p.fireBuf = 0.15; g.online.edge('fp'); await new Promise((r) => setTimeout(r, 30)); }      // atış olana dek tık (yavaş kare)
      if (mode !== 'basili') p.fireHeld = false;
      while (performance.now() - t0 < 9000 && !(s.reloadT <= 0 && s.items[idx].mag > 0 && window.__L.cli.length)) await new Promise((r) => setTimeout(r, 50));
      p.fireHeld = false; p.keys.clear(); s.ads = false;
      await new Promise((r) => setTimeout(r, 900));                                           // sunucu snapshot'ı gelsin
      const L = window.__L, am = L.am && L.am[idx];
      return { cli: L.cli.length, srv: L.srv.length, dq: L.cli[0] && L.srv[0] ? L.srv[0].q - L.cli[0].q : null, dtMs: L.cli[0] && L.srv[0] ? Math.round(L.srv[0].t - L.cli[0].t) : null, cliAm: [s.items[idx].mag, s.items[idx].reserve], srvAm: am, rtt: Math.round(g.online.stats.rtt || 0) };
    })(), [id, mode]);
    res.push(`${id}/${mode}: ${JSON.stringify(r)}`);
    const ok = !r.err && r.cli >= 1 && r.srv >= 1 && r.srvAm && r.cliAm[0] === r.srvAm[0] && r.cliAm[1] === r.srvAm[1] && r.cliAm[0] > 0;
    check(ok, `çevrimiçi ${id} (${mode}): istemci ve sunucu reload'ı kendiliğinden başlattı, cephane eşit ${JSON.stringify(r)}`);
    if (id === 'rpg' && mode === 'tik') await page.screenshot({ path: `${OUT}/cevrimici-rpg.png` });
  }
  check(!errs.length, 'çevrimiçi: sayfa hatası yok' + (errs.length ? ' · ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();
}

// ───────── 3b) telefon: HUD şeridi sırası + şeride dokununca doğru yuva + dokunmatik ateşle otomatik reload ─────────
if (parts.includes('mob')) {
  const b = await launch();
  const { devices } = await import('playwright');
  const { defaultBrowserType, ...dev } = devices['Pixel 7 landscape'];
  const ctx = await b.newContext(dev), page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive && window.__game.player.touch', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true; });
  const strip = await page.evaluate(() => [...document.querySelectorAll('#slots .slot')].map((e) => e.innerText.replace(/\s+/g, ' ').trim() + '@' + e.dataset.i));
  console.log('      telefon HUD şeridi:', strip.join(' · '));
  const box = await page.evaluate(() => { const r = document.querySelectorAll('#slots .slot')[2].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(box.x, box.y); await page.waitForTimeout(600);
  const c = await page.evaluate(() => window.__game.playerSoldier.cur);
  await page.screenshot({ path: `${OUT}/telefon-serit-bicak.png` });
  check(strip.length === 4 && /@3$/.test(strip[2]) && /@2$/.test(strip[3]) && c === 3, `telefon: şerit 1 ana · 2 yedek · 3 bıçak · 4 ekipman, 3. kutuya dokununca bıçak (cur ${c})`);
  // dokunmatik ateş düğmesiyle son mermi → otomatik reload
  await page.evaluate(() => { const s = window.__game.playerSoldier; s.items[0] = { id: 'shotgun', mag: 1, reserve: 30 }; s.switchTo(0); });
  await page.waitForTimeout(800);
  const fb = await page.evaluate(() => { const e = document.querySelector('[data-b=fire]'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.evaluate(() => { window.__game.playerSoldier.pitch = 1.0; });
  for (let i = 0; i < 20 && (await page.evaluate(() => window.__game.playerSoldier.items[0].mag)) > 0; i++) { await page.touchscreen.tap(fb.x, fb.y); await page.waitForTimeout(250); }
  await page.waitForFunction(() => window.__game.playerSoldier.reloadT > 0, null, { timeout: 15000 }).catch(() => {});
  const rl = await page.evaluate(() => { const s = window.__game.playerSoldier; return { r: s.reloadT, mag: s.items[0].mag }; });
  await page.screenshot({ path: `${OUT}/telefon-otoreload.png` });
  check(rl.r > 0, `telefon: ateş düğmesiyle son pompalı fişeği → otomatik reload ${JSON.stringify(rl)}`);
  check(!errs.length, 'telefon: sayfa hatası yok' + (errs.length ? ' · ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

// ───────── 4) menü Kontroller ─────────
if (parts.includes('menu')) {
  const b = await launch();
  for (const [tag, keys] of [['yeni', {}], ['eski-ozel', { slot3: ['Digit3'] }]]) {
    const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto(`${BASE}/?debug=1`);
    await page.evaluate((keys) => { localStorage.clear(); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); localStorage.setItem('warbyte.v2', JSON.stringify({ keys })); }, keys);
    await page.goto(`${BASE}/?debug=1`);
    await page.waitForSelector('.mn-nav', { timeout: 60000 }); await page.waitForTimeout(800);
    await page.click('.mn-nav[data-v=controls]'); await page.waitForTimeout(600);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.kbrow')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()).filter((t) => /silah|Gadget|Bıçak|Knife|weapon/i.test(t)));
    console.log(`      Kontroller (${tag}):`, rows.join(' · '));
    const el = await page.$('.kbrow:has-text("Knife"), .kbrow:has-text("Bıçak")');
    if (el) { await el.scrollIntoViewIfNeeded(); const box = await (await el.evaluateHandle((e) => e.closest('.pan'))).asElement().boundingBox(); await page.screenshot({ path: `${OUT}/kontroller-${tag}.png`, clip: box }); }
    if (tag === 'yeni') check(rows.length === 4 && /(Bıçak|Knife) 3 V/.test(rows[2]) && /Gadget 4 G/.test(rows[3]), 'Kontroller: Ana 1 · Yedek 2 · Bıçak 3/V · Gadget 4/G (sıra da öyle)');
    else check(/(Bıçak|Knife) V/.test(rows[2]) && /Gadget 3/.test(rows[3]), 'Kontroller: eski özel atama (gadget = 3) korunuyor, bıçakta yalnız V');
    await page.close();
  }
}

if (browser) await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK'); process.exit(fail ? 1 : 0);
