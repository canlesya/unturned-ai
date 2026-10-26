// Vadi görüntüleri: kuşbakışı + 14 bakış noktası (masaüstü / Pixel 7 yatay touch=1), çizim çağrısı / üçgen / kare süresi.
//   node scripts/vadishots.mjs  [URL=http://127.0.0.1:5214] [OUT=/tmp/wb-vadi-shots/after] [ONLY=desktop,pixel7] [VIEWS=01,02] [TOD=day|sunset|night] [GPU=1]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5214', OUT = process.env.OUT || '/tmp/wb-vadi-shots/after', TOD = process.env.TOD || 'day';
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY || 'desktop,pixel7').split(',');
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, q: '' },
  pixel7: { ...devices['Pixel 7 landscape'], q: '&touch=1' },
};
// bakış: [ad, x, z, yaw, pitch]   (yaw 0 = −z / kuzey, π/2 = batı, −π/2 = doğu, π = güney); ayak yüksekliği araziden
const P2 = Math.PI / 2, PI = Math.PI;
const VIEWS = [
  ['01-mavi-canak', -66, 6, P2 + 0.35, -0.05],
  ['02-ahir-silo', -73, 4.5, 1.25, 0.08],
  ['03-kopru-bati', -15, 2.2, -P2 + 0.06, -0.04],
  ['04-kopru-kiyi', -7.5, -9.5, -0.55, 0.0],
  ['05-mezra', -25, -2.5, -0.62, 0.0],
  ['06-karakol-kule', -14.5, 2.5, -2.75, 0.02],
  ['07-ambar-avlu', -32.5, 17, -2.4, -0.05],
  ['08-degirmen', 18, -32, -0.4, 0.02],
  ['09-tepe-bunker', -24, -36, -0.95, 0.0],
  ['10-orman-kampi', 22, 39, 2.6, -0.04],
  ['11-asma-kopru', -12, -46.4, -P2, -0.05],
  ['12-sig-gecit', -12, -24, -P2 - 0.3, -0.08],
  ['13-gizli-kamp', -51.5, -35.5, -0.9, -0.12],
  ['14-kuzey-mezra', -30, -11, 0.9, 0.0],
];
// SET=yeni: 12.169 yeniden yapımının bakış noktaları (eski konumlardan bazıları yeni düzende şeve bakıyor)
if (process.env.SET === 'yeni') VIEWS.splice(0, VIEWS.length,
  ['21-kopru-nehir', -7.5, -9.5, -0.55, 0.0], ['22-kopru-ustu', -9.4, 0.6, -P2, -0.02], ['23-mezra-sokak', -27, 0.5, -P2 + 0.25, 0.0], ['24-ambar-kapi', -24, 12.5, PI, -0.05],
  ['25-degirmen-avlu', 26, -18, 0.35, 0.08], ['26-tepe-kule', -14, -33.5, 0.75, 0.05], ['27-orman-kampi', 16, 34.5, 2.35, -0.02], ['28-asma-kopru', -13, -47.2, -P2 - 0.05, -0.12],
  ['29-mavi-ciftlik', -66, 2, P2 + 0.15, 0.02], ['30-sig-gecit', -9.5, -27.5, -P2 - 0.15, -0.1], ['31-kuzey-mezra', -36, -9, 2.6, 0.0], ['32-ledge-yuva', -46, -52.3, -2.2, -0.06]);
const want = process.env.VIEWS ? process.env.VIEWS.split(',') : null;
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};
for (const pn of ONLY) {
  const P = PROFILES[pn];
  const ctx = await browser.newContext({ ...P, q: undefined });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon|WebSocket/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await page.goto(`${URL0}/?autostart=5v5&map=vadi&type=tdm&debug=1&nolock=1&tod=${TOD}${P.q}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__game;
    for (const s of g.soldiers) if (s !== g.playerSoldier) s.brain = null;
    g.brains.length = 0; g.timeLeft = 900;
    g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
    for (const s of g.soldiers) if (s !== g.playerSoldier) { s.pos.set(150, -30, 150); s.vel.set(0, 0, 0); }
    const r = g.renderer, orig = r.render.bind(r);
    window.__rt = []; r.render = (sc, cam) => { const t0 = performance.now(); orig(sc, cam); if (sc === g.scene) { window.__rt.push(performance.now() - t0); if (window.__rt.length > 300) window.__rt.shift(); window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; } };
    window.__ft = []; let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length > 600) window.__ft.shift(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    const c = g.camera, Pp = Object.getPrototypeOf(g), orender = Pp.render;
    Pp.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orender.call(this); };
  });
  const place = (v) => page.evaluate(([x, z, yaw, pitch]) => {
    const g = window.__game, me = g.playerSoldier, y = g.map.terrain ? g.map.terrain.heightAt(x, z) : 0;
    me.pos.set(x, y, z); me.vel.set(0, 0, 0); me.yaw = yaw; me.pitch = pitch; me.protT = 1e9; me.hp = me.maxHp;
  }, [v[1], v[2], v[3], v[4]]);
  const rep = { views: {}, errs, gpu: await page.evaluate(() => { const c = window.__game.renderer.getContext(), e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; }),
    mapMeshes: await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); return n + ' ağ / ' + Math.round(t) + ' üçgen'; }) };
  for (const v of VIEWS) {
    if (want && !want.some((w) => v[0].startsWith(w))) continue;
    await place(v);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${pn}-${TOD}-${v[0]}.png` });
    rep.views[v[0]] = { info: await page.evaluate(() => window.__info) };
  }
  if (pn === 'desktop' && !want && process.env.SET !== 'yeni') {
    for (const [n, pos, tgt, fov] of [['00-kusbakisi', [-70, 75, 70], [-5, 0, 0], 50], ['00-tepeden', [0, 190, 0.01], [0, 0, 0], 50], ['00-kusbakisi-bati', [-110, 45, -25], [-40, 0, 0], 50]]) {
      await page.evaluate((cam) => { window.__game._cam = cam; }, [pos, tgt, fov]);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${pn}-${TOD}-${n}.png` });
    }
    await page.evaluate(() => { window.__game._cam = null; });
  }
  for (const vn of ['01-mavi-canak', '03-kopru-bati']) {             // kare süresi
    const v = VIEWS.find((q) => q[0] === vn); if (!v) continue; await place(v); await page.waitForTimeout(800);
    await page.evaluate(() => { window.__ft.length = 0; window.__rt.length = 0; }); await page.waitForTimeout(3000);
    rep['ft-' + vn] = await page.evaluate(() => { const a = window.__ft.slice(5).sort((p, q) => p - q); if (!a.length) a.push(0); return { avg: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), px: window.__game.renderer.getPixelRatio(), info: window.__info, cpu: +(window.__rt.reduce((s, x) => s + x, 0) / Math.max(1, window.__rt.length)).toFixed(2) }; });
  }
  report[pn] = rep;
  await ctx.close();
}
fs.writeFileSync(`${OUT}/report-${TOD}.json`, JSON.stringify(report, null, 1));
for (const [pn, r] of Object.entries(report)) {
  console.log(`── ${pn}  hata ${r.errs.length} ${r.errs.slice(0, 2).join(' | ')} · GPU ${r.gpu} · harita ağı ${r.mapMeshes}`);
  for (const [n, v] of Object.entries(r.views)) console.log(`  ${n.padEnd(18)} çağrı ${v.info?.calls} üçgen ${v.info?.tris}`);
  for (const k of Object.keys(r)) if (k.startsWith('ft-')) console.log(`  kare ${k.slice(3)}: ort ${r[k].avg} ms, p95 ${r[k].p95} ms, piksel oranı ${r[k].px}, çağrı ${r[k].info?.calls}, sahne çizimi CPU ${r[k].cpu} ms`);
}
await browser.close();
