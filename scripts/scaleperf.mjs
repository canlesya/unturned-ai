// 12.203 Kalabalık maç kare ölçümü (gerçek GPU, pencereli Chromium, --use-angle=metal): Kuzey Vadisi NvN, çevrim dışı (tarayıcı simi + çizim) ya da
// çevrim içi (yerel sunucu simler; istemci yalnız interpolasyon + çizim). Bakışlar: üs (doğuş), Kavşak (C) üstünden vadi, en kalabalık çatışmaya 45 m.
// Her bakışta 6 sn: rAF aralığı (FPS ort / %1 düşük / p95), döngü JS süresi (sim + çizim CPU), render() süresi, çizim çağrısı, üçgen, görünen asker.
//   node scripts/scaleperf.mjs [offline|online] [NvN=64] [etiket=now]   BASE=http://127.0.0.1:5185  WS=ws://127.0.0.1:8968  OUT=/tmp/wb-scale
//   → OUT/perf-<etiket>-<mod>-<N>.json + ekran görüntüleri OUT/shot-<etiket>-<mod>-<N>-<bakış>.png
import { chromium } from 'playwright';
import fs from 'fs';
const mode = process.argv[2] || 'offline', N = +(process.argv[3] || 64), tag = process.argv[4] || 'now';
const BASE = process.env.BASE || 'http://127.0.0.1:5185', WS = process.env.WS || 'ws://127.0.0.1:8968', OUT = process.env.OUT || '/tmp/wb-scale';
const WARM = +(process.env.WARM || 40), SECS = +(process.env.SECS || 6);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', ...(process.env.VSYNC ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']), '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const url = mode === 'online'
  ? `${BASE}/?online=new&name=Olcum&server=${encodeURIComponent(WS)}&map=kuzey&type=conquest&per=${N}&time=1800&debug=1&nolock=1&nologin=1${process.env.LOD === "0" ? "&lod=0" : ""}`
  : `${BASE}/?autostart=${N}v${N}&map=kuzey&type=conquest&time=1800&debug=1&nolock=1${process.env.LOD === "0" ? "&lod=0" : ""}`;
const t0 = Date.now();
await page.goto(url);
await page.waitForFunction('window.__game && window.__game.running && window.__game.soldiers.length > 10', null, { timeout: 300000 });
const loadMs = Date.now() - t0;
await page.evaluate(() => {
  const g = window.__game, r = g.renderer;
  const R = (window.__rec = { t: [], cb: [], rd: [], calls: 0, tris: 0 });
  const ro = g.render.bind(g); g.render = function () { const a = performance.now(); ro(); R._rd = (R._rd || 0) + performance.now() - a; };
  const rr = r.render.bind(r); r.render = (sc, cam) => { rr(sc, cam); if (sc === g.scene) { R.calls = r.info.render.calls; R.tris = r.info.render.triangles; R.lod = g.farView ? { ...g.farView.stats } : null; } };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => raf((ts) => { const a = performance.now(); fn(ts); if (fn === g.loop || fn.name === 'loop' || R.on) { R.t.push(a); R.cb.push(performance.now() - a); R.rd.push(R._rd || 0); R._rd = 0; } });
  R.on = true;
  if (!g.online) g.devGod = true;
});
// ısınma: botlar dağılsın, çatışma başlasın (çevrim içi: sunucu simler)
await page.waitForTimeout(WARM * 1000);
const views = [
  ['us', null],
  ['kavsak', { x: 30, z: 90, look: [0, 9] }],
  ['catisma', 'dense'],
  ['tepe', { x: 60, z: 230, y: 60, look: [0, 9], pitch: -0.3 }],          // vadinin üstünden Kavşak'a (yalnız çevrim dışı: uçuş)
];
const rep = { mode, N, tag, loadMs, views: {} };
for (const [name, v] of views) {
  const pos = await page.evaluate((v) => {
    const g = window.__game, me = g.playerSoldier;
    let P = v;
    if (v === 'dense') {                          // en kalabalık 60 m'lik küme (canlı askerler), ona 45 m uzaktan bak
      let best = null, bn = -1;
      for (const a of g.soldiers) { if (!a.alive || a === me) continue; let n = 0; for (const b of g.soldiers) if (b.alive && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 60) n++; if (n > bn) { bn = n; best = a; } }
      if (!best) return null;
      const ang = Math.random() * Math.PI * 2;
      let x = best.pos.x + Math.cos(ang) * 45, z = best.pos.z + Math.sin(ang) * 45;
      const vi = g.nav.nearestFree(x, z, 20); if (vi >= 0) { x = g.nav.cx(vi); z = g.nav.cz(vi); }
      P = { x, z, look: [best.pos.x, best.pos.z], n: bn };
    }
    if (!P) return { x: me.pos.x, z: me.pos.z };
    if (P.y && g.online) return null;
    const yaw = P.look ? Math.atan2(-(P.look[0] - P.x), -(P.look[1] - P.z)) : me.yaw;
    if (g.online) g.online.send({ t: 'dbg', tp: [P.x, P.z] });
    else if (P.y) { me.fly = true; me.pos.set(P.x, g.world.heightAt(P.x, P.z) + P.y, P.z); me.vel.set(0, 0, 0); }
    else { me.fly = false; me.pos.set(P.x, g.world.heightAt(P.x, P.z) + 0.05, P.z); me.vel.set(0, 0, 0); g.world.settle(me); }
    me.yaw = yaw; me.pitch = P.pitch ?? -0.04;
    return P;
  }, v);
  if (pos === null) continue;
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const R = window.__rec; R.t.length = R.cb.length = R.rd.length = 0; });
  await page.waitForTimeout(SECS * 1000);
  await page.screenshot({ path: `${OUT}/shot-${tag}-${mode}-${N}-${name}.png` });
  rep.views[name] = await page.evaluate(() => {
    const R = window.__rec, g = window.__game, cam = g.camera;
    const dts = []; for (let i = 1; i < R.t.length; i++) dts.push(R.t[i] - R.t[i - 1]);
    const s = [...dts].sort((a, b) => a - b), tot = s.reduce((a, b) => a + b, 0), worst = s.slice(Math.floor(s.length * 0.99));
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    // görüş konisinde (yatay 50°, 300 m) canlı asker sayısı
    const fx = -Math.sin(g.playerSoldier.yaw), fz = -Math.cos(g.playerSoldier.yaw);
    let vis = 0, near = 0; for (const e of g.soldiers) { if (!e.alive || e === g.playerSoldier) continue; const dx = e.pos.x - cam.position.x, dz = e.pos.z - cam.position.z, d = Math.hypot(dx, dz); if (d < 300 && (dx * fx + dz * fz) / (d + 1e-6) > 0.64) { vis++; if (d < 80) near++; } }
    return { frames: dts.length, fps: +(1000 * dts.length / tot).toFixed(1), low1: +(1000 / avg(worst)).toFixed(1), p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1),
      cbMs: +avg(R.cb).toFixed(2), renderMs: +avg(R.rd).toFixed(2), calls: R.calls, tris: R.tris, lod: R.lod, alive: g.soldiers.filter((e) => e.alive).length, inView: vis, inView80: near,
      net: g.online ? { snaps: g.online.stats.snaps, delay: Math.round(g.online.stats.delay), hold: g.online.stats.hold } : null };
  });
  rep.views[name].at = pos;
  console.log(name, JSON.stringify(rep.views[name]));
}
rep.errs = errs.slice(0, 5);
fs.writeFileSync(`${OUT}/perf-${tag}-${mode}-${N}.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify({ mode, N, tag, loadMs, fps: Object.fromEntries(Object.entries(rep.views).map(([k, v]) => [k, v.fps])), errs: errs.length }));
await browser.close();
