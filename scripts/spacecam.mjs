// Yörünge Üssü (Uzay modu, 12.157) serbest kamera kareleri:  GPU=1 URL=http://127.0.0.1:5180 OUT=/tmp/wb-uzay/x node scripts/spacecam.mjs [görünüm,…]
// Görünüm: [ad, kamera [x,y,z], hedef [x,y,z], fov]. HUD ve birinci şahıs silahı gizlenir; botlar durur (BOTS=1: botlar sahnede kalır, poz verilir).
// report.json: görünüm başına çizim çağrısı / üçgen, harita ağ / üçgen sayısı, sayfa hataları. MOB=1: Pixel 7 yatay.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-uzay/cam';
fs.mkdirSync(OUT, { recursive: true });
export const CAMS = [
  ['k-tepeden', [0, 128, 0.01], [0, 0, 0], 50],
  ['t-1', [34, 11, 34], [-8, 9, -8], 62],
  ['t-2', [22, 7, 28], [-14, 11, -10], 66],
  ['t-3', [-2, 4.5, 30], [-24, 17, -6], 70],
  ['t-4', [30, 13, 32], [-10, 15, -10], 74],
  ['k-gb', [-72, 52, 62], [-4, 0, 2], 52],
  ['k-kd', [70, 46, -58], [0, 0, 0], 52],
  ['g-mavi-hangar', [-53.5, 1.65, 3.5], [-44, 1.4, -1], 72],
  ['g-hangar-cikis', [-47.5, 1.65, -11.5], [-30, 1.6, -26], 72],
  ['g-koridor', [-42.5, 1.65, 0.6], [-33, 1.5, 0], 72],
  ['g-lab', [-31.5, 1.65, -4.5], [-22, 1.5, 3], 72],
  ['g-merkez-ic', [-10.5, 1.65, 4.6], [3, 4.8, -4], 72],
  ['g-merkez-kat', [-10, 5.25, -9.5], [6, 2.4, 2], 72],
  ['g-kuzey-hat', [-44, 1.65, -24], [0, 2.5, -28], 72],
  ['g-gunes-tarlasi', [-29, 1.65, -32], [-40, 1.8, -28], 72],
  ['g-anten-cati', [-3.6, 5.65, -26.6], [-30, 1.5, -20], 72],
  ['g-kopru', [-16, 5.25, -12], [-16, 3.6, 12], 72],
  ['g-guney-pist', [-26, 1.65, 26], [0, 2.0, 26], 72],
  ['g-mekik-ust', [0.4, 4.85, 28], [30, 1.5, 18], 72],
  ['g-guney-krater', [-46, 1.65, 33], [-30, 1.5, 24], 72],
  ['g-gok', [-3.6, 5.65, -25.5], [-31, 31, -54], 72],
];
const want = process.argv[2] ? process.argv[2].split(',') : null;
const browser = await chromium.launch({ headless: !process.env.HEADFUL, args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = process.env.MOB ? await browser.newContext({ ...strip(devices['Pixel 7 landscape']), locale: 'tr-TR' }) : await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=6v6&map=yorunge&type=space&debug=1&nolock=1${process.env.MOB ? '&touch=1' : ''}${process.env.Q ? '&q=' + process.env.Q : ''}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate((keepBots) => {
  const g = window.__game;
  if (!keepBots) for (const s of g.soldiers) if (s !== g.playerSoldier) { s.brain = null; s.pos.set(58, -30, 0); }
  g.brains.length = 0; g.timeLeft = 900;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  for (const e of document.body.children) if (e !== g.renderer.domElement && !e.contains(g.renderer.domElement)) e.style.visibility = 'hidden';
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orig.call(this); };
  const r = g.renderer, ro = r.render.bind(r);
  r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; };
}, !!process.env.BOTS);
const rep = {};
for (const [n, pos, tgt, fov] of CAMS) {
  if (want && !want.some((w) => n.startsWith(w))) continue;
  await page.evaluate(([pos, tgt, fov]) => { const g = window.__game; g.playerSoldier.pos.set(pos[0], 0, pos[2]); g._cam = [pos, tgt, fov]; }, [pos, tgt, fov]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${n}.png` });
  rep[n] = await page.evaluate(() => window.__info);
}
rep.map = await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); return { meshes: n, tris: Math.round(t) }; });
rep.errs = errs;
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep));
await browser.close();
