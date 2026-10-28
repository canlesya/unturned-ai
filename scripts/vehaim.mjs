// 12.201 araç nişanı: sağ tık araçta piyade optiği açmasın (aracın kendi yakınlaştırması), helikopter burnu fareyle eğilir + burun topu / roket
// burnun yönünde (aşağıya ateş), tank / jip yükseliş sınırları gövdeye göre. Önce / sonra görüntü + sayısal ölçüm (merminin çıkış pitch'i).
//   URL=http://127.0.0.1:5183 OUT=/tmp/wb-vaim/sonra node scripts/vehaim.mjs
// Çevrimdışı, gerçek GPU (pencereli). Oyuncunun silahına 4× ACOG takılır (şikâyetteki durum). Çıktı: OUT/*.png + OUT/olcum.json; sonda OK / HATA.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5183', OUT = process.env.OUT || '/tmp/wb-vaim/sonra', MOB = process.env.MOB !== '0';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [], R = {};
let bad = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  HATA ') + m); if (!c) bad++; };
async function open(ctxOpt = { viewport: { width: 1280, height: 720 } }, q = '') {
  const page = await (await browser.newContext(ctxOpt)).newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1${q}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true;
    const me = g.playerSoldier;
    me.setOptic?.('acog');                                                      // şikâyetteki durum: piyade silahında 4× nişangâh
    window.__shots = [];
    const sr = g.shootRay.bind(g);
    g.shootRay = (s, o, d, st, mz, co) => { if (s === me) { const cam = g.camera, cd = new cam.position.constructor(); cam.getWorldDirection(cd); const h = g.world.raycast(cam.position, cd, 800, {}); window.__shots.push({ o: { x: o.x, y: o.y, z: o.z }, d: { x: d.x, y: d.y, z: d.z }, st: s.veh ? { pitch: s.veh.st.pitch, yaw: s.veh.st.yaw, y: s.veh.st.y } : null, P: h ? { x: cam.position.x + cd.x * h.t, y: cam.position.y + cd.y * h.t, z: cam.position.z + cd.z * h.t, t: h.t } : null }); } return sr(s, o, d, st, mz, co); };      // P: o anki ekran ortasının gösterdiği nokta
    window.__rk = [];
    const as = g.vehicles.addShell.bind(g.vehicles);
    g.vehicles.addShell = (sh) => { if (sh.w) window.__rk.push({ x: sh.x, y: sh.y, z: sh.z, vx: sh.vx, vy: sh.vy, vz: sh.vz }); return as(sh); };
    window.__seat = (id, seat, x, z, yaw, opt = {}) => {
      const V = g.vehicles, v = V.list.find((o) => o.id === id);
      if (me.veh) V.exit(me);
      if (!v.alive) V.trySpawn(v, true);
      v.st.x = x; v.st.z = z; v.st.y = opt.y ?? g.world.heightAt(x, z); v.st.yaw = yaw; v.st.pitch = 0; v.st.roll = 0; if (v.def.turret) { v.st.tyaw = yaw; v.st.gp = 0; } v.st.vx = v.st.vy = v.st.vz = 0; v.sleep = false;
      if (opt.air) { v.st.air = true; v.st.rpm = 1; }
      me.pos.set(x + 3, g.world.heightAt(x + 3, z), z); g.world.settle(me);
      V.enter(me, v, seat); g.player.vehCam = opt.cam || 'third'; me.yaw = opt.look ?? yaw; me.pitch = opt.pitch ?? -0.02; me.ads = !!opt.ads;
      window.__shots.length = 0; window.__rk.length = 0;
    };
    // durum: kamera FOV'u, piyade nişanı (adsT), optik örtüleri
    window.__st = () => {
      const P = g.player, lens = document.getElementById('lens'), sc = document.getElementById('scope');
      const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > 0.05;
      return { fov: +g.camera.fov.toFixed(2), base: +P.baseFov().toFixed(2), adsT: +me.adsT.toFixed(2), ads: me.ads, optic: me.opticId, lens: vis(lens), scope: vis(sc) || !!P.scopeOn, zoom: +(g.camera.fov ? P.baseFov() / g.camera.fov : 1).toFixed(2) };
    };
    window.__pitchStats = () => {
      const S = window.__shots; if (!S.length) return null;
      const p = S.map((s) => Math.asin(Math.max(-1, Math.min(1, s.d.y))));
      const hits = S.map((s) => { const h = g.world.raycast(s.o, s.d, 600, {}); return h ? { t: h.t, y: s.o.y + s.d.y * h.t, gy: g.world.heightAt(s.o.x + s.d.x * h.t, s.o.z + s.d.z * h.t) } : null; });
      const hh = hits.filter(Boolean);
      return { n: S.length, pitch: +(p.reduce((a, b) => a + b, 0) / p.length).toFixed(3), pmin: +Math.min(...p).toFixed(3), pmax: +Math.max(...p).toFixed(3), ground: hh.length, dist: hh.length ? +(hh.reduce((a, b) => a + b.t, 0) / hh.length).toFixed(1) : null, nose: S[0].st ? +S[0].st.pitch.toFixed(3) : null };
    };
  });
  return page;
}
const page = await open();
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 1500, pg = page) => { await pg.waitForTimeout(w); await pg.screenshot({ path: `${OUT}/${n}.png` }); console.log('  ' + n); };
const YE = -Math.PI / 2, TX = 292;
const after = await ev(() => !!window.__game.binds.codes('vehAlt')?.length);
console.log(after ? 'SONRA (yeni sistem)' : 'ÖNCE (eski sistem)');

// 1) helikopter pilotu havada, sağ tık
const HY = await ev(([TX]) => window.__game.world.heightAt(TX + 2, -404) + 45, [TX]);
await ev(([YE, TX, HY]) => window.__seat('B-H1', 0, TX + 2, -404, YE, { pitch: -0.1, air: true, y: HY }), [YE, TX, HY]);
await shot('01-heli-pilot', 2500);
R.heli0 = await ev(() => window.__st());
await ev(() => { window.__game.playerSoldier.ads = true; });
await shot('02-heli-pilot-sagtik', 900);
R.heli1 = await ev(() => window.__st());
console.log('  heli sağ tık', JSON.stringify(R.heli1));
ok(!R.heli1.lens && !R.heli1.scope && R.heli1.adsT === 0, 'heli pilotu sağ tık: piyade optiği açılmadı (adsT 0, mercek / dürbün yok)');
if (after) ok(R.heli1.zoom > 1.3 && R.heli1.zoom < 1.8, `heli pilotu sağ tık: araç yakınlaştırması ×${R.heli1.zoom}`);
await ev(() => { window.__game.playerSoldier.ads = false; });

// 2) heli burun aşağı ateş (hover, bakış −0,55 rad)
await ev(([YE, TX, HY]) => window.__seat('B-H1', 0, TX + 2, -404, YE, { pitch: -0.55, air: true, y: HY }), [YE, TX, HY]);
await page.waitForTimeout(2200);
R.heliNose = await ev(() => +window.__game.playerSoldier.veh.st.pitch.toFixed(3));
await ev(() => { window.__shots.length = 0; window.__game.player.fireHeld = true; });
await shot('03-heli-burun-asagi-ates', 1300);
await ev(() => { window.__game.player.fireHeld = false; });
R.heliShots = await ev(() => window.__pitchStats());
// yandan bakış (yalnız görüntü: çizimden hemen önce kamera helikopterin soluna, 60 m yana) — burun eğimi + izlerin yere inişi
await ev(() => {
  const g = window.__game, r = g.renderer, rr = r.render.bind(r);
  r.render = (sc, cam) => { const S = window.__side; if (S && cam === g.camera) { const v = g.playerSoldier.veh?.st; if (v) { cam.position.set(v.x + 34, v.y - 14, v.z - 78); cam.lookAt(v.x + 34, v.y - 22, v.z); cam.fov = 62; cam.updateProjectionMatrix(); } } return rr(sc, cam); };
});
await ev(() => { window.__side = true; window.__shots.length = 0; window.__game.player.fireHeld = true; });
await shot('03y-heli-burun-asagi-ates-yandan', 700);
await ev(() => { window.__game.player.fireHeld = false; window.__side = false; });
await ev(() => { window.__game.player.vehCam = 'first'; window.__game.player.fireHeld = true; });
await shot('03k-heli-kokpit-burun-asagi-ates', 900);
await ev(() => { window.__game.player.fireHeld = false; window.__game.player.vehCam = 'third'; });
console.log('  heli burun', R.heliNose, 'atış', JSON.stringify(R.heliShots));
if (after) {
  ok(R.heliNose < -0.3, `heli burnu bakışla eğildi (pitch ${R.heliNose})`);
  ok(R.heliShots && R.heliShots.pitch < -0.45 && R.heliShots.ground >= R.heliShots.n * 0.8, `burun topu aşağı: çıkış pitch ${R.heliShots?.pitch} rad, ${R.heliShots?.ground}/${R.heliShots?.n} yere (ort. ${R.heliShots?.dist} m)`);
}
// artı = isabet: koni içinde (bakış −0,3) burun topu ekran ortasının gösterdiği noktaya; HUD burun artısı ortada
await ev(([YE, TX, HY]) => window.__seat('B-H1', 0, TX + 2, -404, YE, { pitch: -0.3, air: true, y: HY }), [YE, TX, HY]);
await page.waitForTimeout(2000);
await ev(() => { window.__shots.length = 0; window.__game.player.fireHeld = true; });
await page.waitForTimeout(700);
await ev(() => { window.__game.player.fireHeld = false; });
R.acc = await ev(() => {
  const g = window.__game, S = window.__shots, h = S[0]?.P;
  const err = S.map((s) => { const q = g.world.raycast(s.o, s.d, 800, {}), P = s.P; return q && P ? Math.hypot(s.o.x + s.d.x * q.t - P.x, s.o.y + s.d.y * q.t - P.y, s.o.z + s.d.z * q.t - P.z) : 99; });
  const n = document.getElementById('vhNose'), r = n.getBoundingClientRect();
  return { n: S.length, dist: h ? +h.t.toFixed(1) : null, err: +(err.reduce((a, b) => a + b, 0) / Math.max(1, err.length)).toFixed(2), px: +Math.hypot(r.left + r.width / 2 - innerWidth / 2, r.top + r.height / 2 - innerHeight / 2).toFixed(1), vis: getComputedStyle(n).display !== 'none' };
});
console.log('  artı = isabet', JSON.stringify(R.acc));
if (after) ok(R.acc.n > 3 && R.acc.err < 3 && R.acc.vis && R.acc.px < 12, `burun topu artının noktasına (ort. sapma ${R.acc.err} m, ${R.acc.dist} m'de; HUD burun artısı ortadan ${R.acc.px} px)`);
await shot('03b-heli-arti-isabet', 300);
await ev(([YE, TX, HY]) => window.__seat('B-H1', 0, TX + 2, -404, YE, { pitch: -0.55, air: true, y: HY }), [YE, TX, HY]);
await page.waitForTimeout(2200);
// roket (12.206: Q ile roket seç + sol tık; 12.201: Q / orta tık; önce: sağ tık)
const sel = await ev(() => typeof window.__game.vehicles.rocketAimFor === 'function');
await ev(([after, sel]) => { const g = window.__game; window.__rk.length = 0; if (sel) { g.player.vehWeapon(1); g.player.fireHeld = true; } else if (after) g.player.mmb = true; else g.playerSoldier.ads = true; }, [after, sel]);
await shot('04-heli-roket-asagi', 900);
await ev(() => { const g = window.__game; g.player.mmb = false; g.player.fireHeld = false; g.playerSoldier.ads = false; g.player.vehWeapon(0); });
R.rk = await ev(() => { const a = window.__rk; return { n: a.length, pitch: a.length ? +(a.reduce((s, r) => s + Math.atan2(r.vy, Math.hypot(r.vx, r.vz)), 0) / a.length).toFixed(3) : null }; });
console.log('  roket', JSON.stringify(R.rk));
if (after) ok(R.rk.n >= 2 && R.rk.pitch < -0.4, `roket burnun yönünde aşağı (${R.rk.n} roket, pitch ${R.rk.pitch})`);
await shot('05-heli-roket-isabet', 1200);

// 3) kapı nişancısı aşağı (bakış −1,2 rad)
await ev(([TX, HY]) => window.__seat('B-H1', 1, TX + 2, -404, 0, { look: Math.PI / 2, pitch: -1.4, air: true, y: HY }), [TX, HY]);
await page.waitForTimeout(800);
await ev(() => { window.__shots.length = 0; window.__game.player.fireHeld = true; });
await shot('06-heli-kapi-asagi', 1000);
await ev(() => { window.__game.player.fireHeld = false; });
R.door = await ev(() => window.__pitchStats());
console.log('  kapı', JSON.stringify(R.door));
if (after) ok(R.door && R.door.pitch < -1.35, `kapı nişancısı dik aşağı (${R.door?.pitch}; eski sınır −1,25)`);
await ev(() => { window.__game.playerSoldier.ads = true; });
await shot('07-heli-kapi-sagtik', 900);
R.door1 = await ev(() => window.__st());
ok(!R.door1.lens && !R.door1.scope && R.door1.adsT === 0, 'kapı nişancısı sağ tık: piyade optiği yok');
await ev(() => { window.__game.playerSoldier.ads = false; });

// 4) tank sürücüsü sağ tık (takip + dürbün), tank nişancısı sağ tık
await ev(([YE, TX]) => window.__seat('B-T1', 0, TX, -390, YE, { pitch: -0.02 }), [YE, TX]);
await shot('08-tank-surucu', 3000);
await ev(() => { window.__game.playerSoldier.ads = true; });
await shot('09-tank-surucu-sagtik', 900);
R.tank1 = await ev(() => window.__st());
console.log('  tank sağ tık', JSON.stringify(R.tank1));
ok(!R.tank1.lens && !R.tank1.scope && R.tank1.adsT === 0 && R.tank1.zoom > 1.4, `tank sürücüsü sağ tık: tank yakınlaştırması ×${R.tank1.zoom}, piyade optiği yok`);
await ev(() => { window.__game.player.vehCam = 'first'; });
await shot('10-tank-durbun-sagtik', 1200);
R.tank2 = await ev(() => window.__st());
ok(R.tank2.zoom > 2.3 && !R.tank2.lens, `tank dürbünü sağ tık ×${R.tank2.zoom}`);
await ev(([YE, TX]) => window.__seat('B-T1', 1, TX, -390, YE, { look: YE + 0.2, pitch: -0.03 }), [YE, TX]);
await page.waitForTimeout(1200);
await ev(() => { window.__game.playerSoldier.ads = true; });
await shot('11-tank-nisanci-sagtik', 900);
R.tankMg = await ev(() => window.__st());
console.log('  tank nişancı sağ tık', JSON.stringify(R.tankMg));
ok(!R.tankMg.lens && !R.tankMg.scope && R.tankMg.adsT === 0, 'tank nişancısı sağ tık: piyade optiği yok');
if (after) ok(R.tankMg.zoom > 1.2 && R.tankMg.zoom < 1.7, `tank nişancısı hafif yakınlaştırma ×${R.tankMg.zoom}`);
await ev(() => { window.__game.playerSoldier.ads = false; });

// 5) jip makinelisi sağ tık + jip arka yolcu (kendi silahı: piyade optiği normal)
await ev(([YE, TX]) => window.__seat('B-J1', 1, TX + 4, -376, YE, { look: YE + 0.15, pitch: -0.04 }), [YE, TX]);
await page.waitForTimeout(1200);
await ev(() => { window.__game.playerSoldier.ads = true; });
await shot('12-jip-makineli-sagtik', 900);
R.jeep = await ev(() => window.__st());
ok(!R.jeep.lens && !R.jeep.scope && R.jeep.adsT === 0, 'jip makinelisi sağ tık: piyade optiği yok');
if (after) ok(R.jeep.zoom > 1.2 && R.jeep.zoom < 1.7, `jip makinelisi hafif yakınlaştırma ×${R.jeep.zoom}`);
await ev(([YE, TX]) => window.__seat('B-J1', 2, TX + 4, -376, YE, { look: YE + 0.4 }), [YE, TX]);
await page.waitForTimeout(300);
await ev(() => { window.__game.playerSoldier.ads = true; });
await shot('13-jip-yolcu-sagtik', 1200);
R.pas = await ev(() => window.__st());
ok(R.pas.adsT > 0.9, `jip arka yolcusu kendi silahıyla nişan alır (adsT ${R.pas.adsT})`);

// 6) araçtan inince nişan temiz sıfırlanır
await ev(([YE, TX]) => window.__seat('B-H1', 0, TX + 2, -404, YE, { pitch: -0.1 }), [YE, TX]);
await ev(() => { const g = window.__game; g.opts.adsToggle = true; g.playerSoldier.ads = true; });
await page.waitForTimeout(600);
await ev(() => { const g = window.__game; g.vehicles.exit(g.playerSoldier); });
await page.waitForTimeout(700);
R.exit = await ev(() => { const g = window.__game; g.opts.adsToggle = false; return window.__st(); });
console.log('  inince', JSON.stringify(R.exit));
if (after) ok(!R.exit.ads && R.exit.adsT === 0 && Math.abs(R.exit.zoom - 1) < 0.02, 'inince nişan / yakınlaştırma sıfır');

// 7) tank yükseliş sınırları (gövdeye göre)
R.tankLim = await ev(() => { const { VT } = window.__game.vehicles.list[0].def ? { VT: null } : {}; const d = window.__game.vehicles.list.find((o) => o.def.turret).def.turret; return [d.gunMin, d.gunMax]; });
console.log('  tank top sınırı', JSON.stringify(R.tankLim));
if (after) ok(R.tankLim[0] <= -0.17 && R.tankLim[1] >= 0.34, `tank topu −10°…+20° (${R.tankLim.map((x) => (x * 57.3).toFixed(1)).join('° … ')}°)`);
await page.close();

if (MOB) {
  const mp = await open({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true }, '&touch=1');
  const HYm = await mp.evaluate(([TX]) => window.__game.world.heightAt(TX + 2, -404) + 45, [TX]);
  await mp.evaluate(([YE, TX, HY]) => window.__seat('B-H1', 0, TX + 2, -404, YE, { pitch: -0.5, air: true, y: HY }), [YE, TX, HYm]);
  await mp.waitForTimeout(2200);
  const tapHold = async (k, ms) => { const b = await mp.$(`#tc [data-b="${k}"]`); if (!b) return 'yok'; const r = await b.boundingBox(); if (!r) return 'gizli'; const cdp = await mp.context().newCDPSession(mp), pt = [{ x: r.x + r.width / 2, y: r.y + r.height / 2, id: 7 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }); await mp.waitForTimeout(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); return 'ok'; };
  await mp.evaluate(() => { window.__rk.length = 0; });
  const a1 = await tapHold('ads', 120);
  await mp.waitForTimeout(500);
  R.mob = await mp.evaluate(() => window.__st());
  await shot('20-telefon-heli-nisan', 300, mp);
  const sel = await mp.evaluate(() => typeof window.__game.vehicles.rocketAimFor === 'function');
  const rkb = !after ? 'yok' : sel ? await tapHold('rk', 120) : await tapHold('rk', 900);      // 12.206: SİLAH düğmesi (dokun = roket seç) + ATEŞ basılı
  if (sel) { await mp.waitForTimeout(200); R.mobVw = await mp.evaluate(() => window.__game.playerSoldier.vw); await tapHold('fire', 900); }
  R.mobRk = await mp.evaluate(() => window.__rk.length);
  await shot('21-telefon-heli-roket', 900, mp);
  console.log('  telefon', a1, JSON.stringify(R.mob), 'roket butonu', rkb, R.mobRk);
  ok(!R.mob.lens && R.mob.adsT === 0, 'telefon pilot nişan butonu: piyade optiği yok');
  if (after) { ok(R.mob.zoom > 1.3, `telefon pilot nişan butonu = yakınlaştırma ×${R.mob.zoom}`); ok(rkb === 'ok' && R.mobRk >= 2 && (!sel || R.mobVw === 1), `telefon SİLAH düğmesi → roket seçili (vw ${R.mobVw}) + ATEŞ (${R.mobRk} roket)`); }
}
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(R, null, 1));
await browser.close();
console.log('sayfa hatası', errs.length, errs.slice(0, 3).join(' | '));
if (errs.length) bad++;
console.log(bad ? `HATA ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
