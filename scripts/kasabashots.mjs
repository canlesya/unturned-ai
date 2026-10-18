// Kasaba görüntüleri: serbest kamera bakışları (göz hizası + yüksek) + kuşbakışı, gündüz / gece, masaüstü / Pixel 7; çizim çağrısı / üçgen / kare süresi.
//   node scripts/kasabashots.mjs   [URL=http://127.0.0.1:5213] [OUT=/tmp/wb-kasaba-shots/after] [ONLY=desktop,pixel7] [TODS=day,night] [VIEWS=01,02]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5213', OUT = process.env.OUT || '/tmp/wb-kasaba-shots/after';
fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY || 'desktop,pixel7').split(','), TODS = (process.env.TODS || 'day,night').split(',');
const PROFILES = { desktop: { viewport: { width: 1280, height: 720 }, q: '' }, pixel7: { ...devices['Pixel 7 landscape'], q: '&touch=1' } };
// bakış: [ad, kamera [x,y,z], hedef [x,y,z], fov]
const VIEWS = [
  ['01-mavi-avlu', [-63, 1.7, 1], [-78, 1.5, -4], 70],
  ['02-sikan', [-60, 1.7, -1], [-44, 1.4, 1], 70],
  ['03-evler', [-36, 1.7, -3], [-36, 3, -18], 70],
  ['04-okul', [-50, 1.7, -6], [-58, 3, -17], 70],
  ['05-belediye', [-8, 1.7, -6], [-16, 3, -17], 70],
  ['06-kilise', [-24.5, 2.4, 3.2], [-36, 5.0, 16], 64],
  ['07-park', [-22, 4.5, 5.5], [-13, 0.5, 17], 66],
  ['08-kavsak', [-8, 4.5, -8], [0, 0.5, 0], 66],
  ['09-su-kulesi', [-17, 1.7, -35], [-24, 4, -45], 70],
  ['10-mezarlik', [-38, 1.7, 37.5], [-46, 1.5, 46], 70],
  ['11-kuzey-sokak', [-64, 1.7, -30], [-40, 1.5, -30], 70],
  ['12-kirmizi-avlu', [63, 1.7, -1], [78, 1.5, 4], 70],
  ['13-benzinlik', [24.5, 1.8, -7.2], [33, 2.5, -17], 70],
  ['14-pazar', [30, 1.7, 5], [37, 3, 17], 70],
  ['15-garaj', [-48.5, 1.8, 6.2], [-56, 2.5, 16], 70],
  ['16-ciftlik', [-66, 1.7, -2], [-76, 3, -12], 70],
  ['17-kirmizi-depo', [63.5, 1.8, 6.5], [72, 3, 13.5], 70],
  ['18-orta-cadde', [-2, 1.7, -30], [-2, 1.5, -6], 70],
];
const AIR = [['00-kusbakisi', [-70, 70, 80], [-10, 0, 0], 50], ['00-kusbakisi-kd', [70, 70, -80], [10, 0, 0], 50], ['00-tepeden', [0, 190, 0.01], [0, 0, 0], 44]];
const want = process.env.VIEWS ? process.env.VIEWS.split(',') : null;
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};
for (const pn of ONLY) for (const tod of TODS) {
  const P = PROFILES[pn];
  const ctx = await browser.newContext({ ...P, q: undefined });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await page.goto(`${URL0}/?autostart=5v5&map=kasaba&type=tdm&debug=1&nolock=1&tod=${tod}${P.q}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__game;
    for (const s of g.soldiers) { if (s !== g.playerSoldier) s.brain = null; s.pos.set(0, -50, 0); }
    g.brains.length = 0; g.timeLeft = 6000;
    g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
    const r = g.renderer, c = g.camera, Pp = Object.getPrototypeOf(g), orig = Pp.render;
    Pp.render = function () { for (const q of this.soldiers) if (q.model && q.model.root) q.model.root.visible = false; if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orig.call(this); };
    const ro = r.render.bind(r); window.__rt = [];
    r.render = (sc, cam) => { const t0 = performance.now(); ro(sc, cam); if (sc === g.scene) { window.__rt.push(performance.now() - t0); if (window.__rt.length > 300) window.__rt.shift(); window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; } };
    window.__ft = []; let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length > 600) window.__ft.shift(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  });
  const rep = { views: {}, errs, mapMeshes: await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); return n + ' ağ / ' + Math.round(t) + ' üçgen'; }) };
  const list = [...(pn === 'desktop' ? AIR : AIR.slice(0, 1)), ...VIEWS];
  for (const v of list) {
    if (want && !want.some((w) => v[0].startsWith(w))) continue;
    await page.evaluate((cam) => { window.__game._cam = cam; }, [v[1], v[2], v[3]]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${pn}-${tod}-${v[0]}.png` });
    rep.views[v[0]] = await page.evaluate(() => window.__info);
  }
  if (process.env.THUMB && pn === 'desktop' && tod === 'day') {   // THUMB=1: menü küçük resmi (public/img/kasaba.jpg)
    await page.setViewportSize({ width: 960, height: 540 });
    await page.evaluate(() => { window.__game._cam = [[-76, 72, 84], [2, 0, 4], 46]; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'public/img/kasaba.jpg', type: 'jpeg', quality: 86 });
    await page.setViewportSize(P.viewport);
  }
  if (!want) {                                            // kare süresi: meydan + evler
    for (const vn of ['08-kavsak', '03-evler']) {
      const v = VIEWS.find((q) => q[0] === vn);
      await page.evaluate((cam) => { window.__game._cam = cam; window.__ft.length = 0; window.__rt.length = 0; }, [v[1], v[2], v[3]]);
      await page.waitForTimeout(2500);
      rep['ft-' + vn] = await page.evaluate(() => { const a = window.__ft.slice(5).sort((p, q) => p - q); if (!a.length) a.push(0); return { avg: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), info: window.__info, cpu: +(window.__rt.reduce((s, x) => s + x, 0) / Math.max(1, window.__rt.length)).toFixed(2) }; });
    }
  }
  report[`${pn}-${tod}`] = rep;
  await ctx.close();
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const [pn, r] of Object.entries(report)) {
  console.log(`── ${pn}  hata ${r.errs.length} ${r.errs.slice(0, 2).join(' | ')} · harita ağı ${r.mapMeshes}`);
  for (const [n, v] of Object.entries(r.views)) console.log(`  ${n.padEnd(20)} çağrı ${v?.calls} üçgen ${v?.tris}`);
  for (const k of Object.keys(r)) if (k.startsWith('ft-')) console.log(`  kare ${k.slice(3)}: ort ${r[k].avg} ms p95 ${r[k].p95} ms çağrı ${r[k].info?.calls} üçgen ${r[k].info?.tris} CPU ${r[k].cpu} ms`);
}
await browser.close();
