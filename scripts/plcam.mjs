// Maden Ocağı serbest kamera kareleri (önce / sonra karşılaştırma):  GPU=1 URL=http://127.0.0.1:5180 OUT=/tmp/wb-maden/x node scripts/plcam.mjs [görünüm,…]
// Görünüm: [ad, kamera [x,y,z], hedef [x,y,z], fov, vagon d]. HUD ve birinci şahıs silahı gizlenir; botlar durur; renderer çağrı / üçgen sayısı da yazılır.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-maden/cam';
fs.mkdirSync(OUT, { recursive: true });
export const CAMS = [
  ['k-tepeden', [0, 150, 0.01], [0, 0, 0], 38, 30],
  ['k-gb', [-70, 66, 66], [-2, 0, 0], 50, 30],
  ['k-kd', [66, 60, -66], [0, 0, 0], 50, 100],
  ['g-mavi-avlu', [-44, 1.6, 30], [-30, 1.3, 25], 70, 12],
  ['g-a-guneyden', [-18.8, 1.6, 17], [-18, 1.2, 4], 70, 40],
  ['g-a-kuzeyden', [-19.5, 3.0, -4.2], [-18, 1.2, 18], 70, 30],
  ['g-koy-caddesi', [-15.5, 1.6, 7.6], [8, 1.2, 6], 70, 52],
  ['g-b-guneyden', [8.6, 1.6, 2.5], [8, 1.2, -16], 70, 88],
  ['g-lavvar', [12.5, 1.6, -16.4], [30, 1.2, -16], 70, 100],
  ['g-c-meydan', [30.6, 1.6, -14], [30, 1.6, -33], 70, 118],
  ['g-vinc-avlu', [43, 1.6, -21.5], [43, 1.2, -34], 70, 118],
  ['g-kuzey-avlu', [-4, 1.6, -33.5], [-4, 1.2, -24], 70, 30],
  ['d-iskele-a', [-17.5, 2.0, 4.0], [-19.8, 1.2, -5], 60, 40],
  ['d-cevher-iskele', [31, 3.5, -19], [25.5, 1, -30], 60, 118],
  ['d-barut', [8, 2.5, 13], [17, 1, 8.5], 60, 60],
  ['d-vinc-dis', [29, 3, -18.5], [40, 1.5, -28], 60, 118],
  ['d-kuzey-ara', [10, 2, -23.4], [26, 1.5, -23.6], 60, 100],
  ['d-nw-sirt', [-37, 2.2, -9], [-28, 2.5, -20], 60, 30],
  ['y-a', [-30, 22, 18], [-17, 0, 2], 55, 40],
  ['y-b', [-6, 22, 4], [9, 0, -14], 55, 88],
  ['y-c', [16, 24, -2], [31, 0, -26], 55, 118],
];
const want = process.argv[2] ? process.argv[2].split(',') : null;
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=5v5&map=maden&type=payload&debug=1&nolock=1&tod=${process.env.TOD || 'day'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = window.__game;
  for (const s of g.soldiers) if (s !== g.playerSoldier) { s.brain = null; s.pos.set(44, 0, 12); }
  g.brains.length = 0; g.timeLeft = 900;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orig.call(this); };
  const r = g.renderer, ro = r.render.bind(r);
  r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; };
});
const rep = {};
for (const [n, pos, tgt, fov, d] of CAMS) {
  if (want && !want.some((w) => n.startsWith(w))) continue;
  await page.evaluate(([pos, tgt, fov, d]) => { const g = window.__game, pl = g.payload; pl.d = pl.shown = pl.netD = d; pl.idleT = 0; g.playerSoldier.pos.set(pos[0], 0, pos[2]); g._cam = [pos, tgt, fov]; }, [pos, tgt, fov, d]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${n}.png` });
  rep[n] = await page.evaluate(() => window.__info);
}
rep.map = await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); return { meshes: n, tris: Math.round(t) }; });
rep.errs = errs;
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep));
await browser.close();
