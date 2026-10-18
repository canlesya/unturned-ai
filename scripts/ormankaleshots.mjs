// Orman Kalesi ekran görüntüleri: kuşbakışı (3) + 10 bakış (masaüstü 1280×720) + Pixel 7 yatay (dokunmatik, HUD açık) + kare süresi / çizim çağrısı.
// Çıktı: /tmp/wb-pb3-shots/*.png (depoya girmez). Yerel vite (BASE) çalışırken:
//   GPU=1 BASE=http://127.0.0.1:5229 node scripts/ormankaleshots.mjs     ONLY=desk|mob   VIEW=ad-parçası   THUMB=1 → public/img/ormankale.jpg   TOD=sunset|night
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const OUT = process.env.OUT || '/tmp/wb-pb3-shots', BASE = process.env.BASE || 'http://127.0.0.1:5229', TOD = process.env.TOD || 'day';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const D = Math.PI / 4;
const look = (name, p, t) => { const dx = t[0] - p[0], dz = t[2] - p[2], dy = t[1] - (p[1] + 1.6); return [name, p, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
const VIEWS = (process.env.VIEW ? (v) => v.filter((q) => q[0].includes(process.env.VIEW)) : (v) => v)([   // ad, ayak konumu, bakılan nokta
  look('01-kale-kuzey', [-3.0, 0, -15.5], [0, 2.2, 0]),
  ['02-gozcu-tepe', [0.6, 5.64, 0.6], -3 * D, -0.28],
  ['03-kale-guverte', [-4.4, 3.0, 4.4], -D * 0.6, -0.08],
  look('04-kale-ici', [3.8, 0, 3.6], [-3, 0.9, -3]),
  ['05-dere-kopru', [-1.5, 0, 9.8], -0.4 + Math.PI, -0.12],
  look('06-kulube', [-12.0, 0, -13.0], [-19, 1.0, -19.5]),
  look('07-hurda', [11.0, 0, -10.5], [19, 0.6, -19]),
  look('08-gozetleme', [18.6, 3.6, 21.8], [0, 2.0, 0]),
  look('09-saman', [-11.5, 0, 17.4], [-20, 0.6, 22]),
  look('10-koru', [-25.0, 0, -9.0], [-17, 0.8, 1]),
  look('11-cit-hatti', [24.6, 0, 9.8], [16, 0.7, -3]),
  look('12-dere-ici', [-12.0, -0.9, creek(-12)], [0, -0.3, creek(0)]),
]);
function creek(x) { return 14.5 + 2.2 * Math.sin(0.15 * x + 0.8); }
async function open(ctxOpts, touch, hud) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && !/404|favicon/.test(m.text()) && errs.push(m.text().slice(0, 200)));
  await page.goto(`${BASE}/?autostart=8v8&map=ormankale&type=pb&debug=1&nolock=1&dev=1&shadows=1&tod=${TOD}${touch ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.evaluate((hud) => {
    const g = window.__game; g.simulate = true; g.timeLeft = 900;
    for (const b of g.brains) b.update = () => {};
    if (!hud) { document.getElementById('hud').style.display = 'none'; g.player.vm.render = () => {}; }
    g.playerSoldier.fly = true; g.playerSoldier.protT = 1e9;
    const r = g.renderer, orig = r.render.bind(r);
    window.__rt = []; r.render = (sc, cam) => { const t0 = performance.now(); orig(sc, cam); if (sc === g.scene) { window.__rt.push(performance.now() - t0); if (window.__rt.length > 300) window.__rt.shift(); window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; } };
    window.__ft = []; let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length > 600) window.__ft.shift(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    const bots = g.soldiers.filter((s) => s !== g.playerSoldier);                // botları sahneye diz (ölçek): kale, köprü, kule, kulübe önü
    const P = [[-1.2, 3.0, -4.4], [3.6, 3.0, 4.6], [3.0, 0.15, 15.4], [-17, 0.15, 13.6], [13.0, 0.15, 15.3], [-17.0, 0, -16.6], [16.2, 0, -14.6], [-20.8, 0, 18.6], [0.6, 5.64, -0.4], [-6, -0.9, 13.0], [19.4, 0, -1.4], [-0.4, 0, -16.6], [-4.0, 0, 8.0], [8.0, 0, -8.0], [-14.6, 0, -4.0]];
    bots.forEach((s, i) => { const p = P[i % P.length]; s.pos.set(p[0], p[1], p[2]); s.vel.set(0, 0, 0); s.yaw = Math.atan2(p[0], p[2]); });
  }, hud);
  return { ctx, page, errs };
}
async function shoot(page, tag, list) {
  for (const [name, p, yaw, pitch] of list) {
    for (let k = 0; k < 2; k++) {
      await page.evaluate(([p, yaw, pitch]) => { const g = window.__game, s = g.playerSoldier; s.fly = true; s.pos.set(p[0], p[1], p[2]); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; g.player.pitchT = pitch; }, [p, yaw, pitch]);
      await page.waitForTimeout(k ? 300 : 500);
    }
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  }
}
async function perf(page, at) {
  await page.evaluate(([p, yaw, pitch]) => { const s = window.__game.playerSoldier; s.pos.set(...p); s.yaw = yaw; s.pitch = pitch; window.__ft.length = 0; window.__rt.length = 0; }, at);
  await page.waitForTimeout(3000);
  return page.evaluate(() => { const a = window.__ft.slice(5).sort((p, q) => p - q); if (!a.length) a.push(0); return { avg: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), px: window.__game.renderer.getPixelRatio(), calls: window.__info?.calls, tris: window.__info?.tris, cpu: +(window.__rt.reduce((s, x) => s + x, 0) / Math.max(1, window.__rt.length)).toFixed(2) }; });
}
const only = process.env.ONLY;
const overview = async (page, tag) => {
  await page.evaluate(() => { const g = window.__game, c = g.camera, P = Object.getPrototypeOf(g), orig = P.render; document.getElementById('hud').style.display = 'none'; g.player.vm.render = () => {};
    if (!P._okPatched) { P._okPatched = true; P.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orig.call(this); }; } });
  for (const [n, pos, tgt, fov] of [['00-kusbakisi', [-40, 40, 46], [0, 0, 2], 50], ['00-tepeden', [0, 92, 0.01], [0, 0, 0], 37], ['00-kusbakisi-kd', [42, 34, -44], [0, 0, 0], 50]]) {
    await page.evaluate((cam) => { window.__game._cam = cam; }, [pos, tgt, fov]);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  }
  if (process.env.THUMB) {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.evaluate(() => { window.__game._cam = [[-34, 30, 38], [0, 0, 1], 46]; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'public/img/ormankale.jpg', type: 'jpeg', quality: 86 });
  }
  await page.evaluate(() => { window.__game._cam = null; });
};
if (only !== 'mob') {
  const { ctx, page, errs } = await open({ viewport: { width: 1280, height: 720 } }, false, false);
  const info = await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); const c = window.__game.renderer.getContext(), e = c.getExtension('WEBGL_debug_renderer_info'); return { mesh: n, tris: Math.round(t), gpu: e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?' }; });
  await shoot(page, 'masa', VIEWS);
  const p1 = await perf(page, [[0.6, 5.64, 0.6], -3 * D, -0.2]), p2 = await perf(page, [[-1.5, 0, 9.8], Math.PI - 0.4, -0.1]);
  if (!process.env.VIEW) await overview(page, 'masa');
  console.log('masa', JSON.stringify(info), 'kare gözcü', JSON.stringify(p1), 'kare dere', JSON.stringify(p2), 'hata', errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
if (only !== 'desk') {
  const dev = devices['Pixel 7 landscape'] || { viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true };
  const { ctx, page, errs } = await open({ ...dev }, true, true);
  await shoot(page, 'mobil', [VIEWS[0], VIEWS[1], VIEWS[4], ['13-mobil-dogus', [-25.4, 0, -25.4], -3 * D + Math.PI, 0.0]]);
  const p1 = await perf(page, [[0.6, 5.64, 0.6], -3 * D, -0.2]);
  console.log('mobil kare gözcü', JSON.stringify(p1), 'hata', errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
