// Batı Cephesi (Cephe modu) serbest kamera kareleri:  GPU=1 URL=http://127.0.0.1:5180 OUT=/tmp/wb-cephe/cam node scripts/frontcam.mjs [görünüm,…]
// Görünüm: [ad, kamera [x,y,z], hedef [x,y,z], fov]. HUD + birinci şahıs silahı gizli; BOTS=1 ise botlar dondurulmadan sahnede kalır (mevzi görünümü).
// Ayrıca SECTOR=n ile doğuş aşaması / sektör ileri alınır. Renderer çağrı / üçgen sayısı report.json'a yazılır.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-cephe/cam';
fs.mkdirSync(OUT, { recursive: true });
export const CAMS = [
  ['k-tepeden', [0, 330, 0.01], [0, 0, 0], 52],
  ['k-guneyden', [30, 120, 210], [0, 0, 10], 48],
  ['k-kuzeyden', [10, 90, -200], [0, 0, -40], 50],
  ['g-siper-ici', [-8.6, 0.02, 88.9], [2, -0.4, 88.1], 74],
  ['g-atis-basamagi', [-7, 0.52, 86.35], [-7, 0.3, 50], 70],
  ['g-k1-siper-ici', [-26.6, 0.02, 50.6], [-17, -0.3, 49.6], 74],
  ['g-olum-bolgesi', [8, 1.6, 76], [10, 0.6, 46], 70],
  ['g-tabya', [-37, 1.62, 39.6], [-37, 1.0, 70], 70],
  ['g-koy-yolu', [4, 1.6, 15], [3, 1.4, -20], 70],
  ['g-kilise', [-6, 1.7, 12], [-22, 5.5, -8], 62],
  ['g-kule', [-22, 10.02, -0.9], [-20, 2, 60], 74],
  ['g-cukur-yol', [-21, 0.02, -40.4], [10, -0.4, -39.6], 72],
  ['g-ambar', [18, 1.6, -38], [30, 2.5, -64], 64],
  ['g-orman', [-24, 1.6, -50], [-37, 1.5, -63], 64],
  ['g-ana-hat', [0, 1.6, -84], [-6, 0.5, -116], 66],
  ['g-batarya', [24, 1.8, -122], [42, 1, -131], 64],
  ['y-k1', [-62, 26, 72], [-20, 0, 40], 55],
  ['y-koy', [34, 30, 26], [-2, 0, -12], 55],
  ['y-ana', [44, 30, -78], [8, 0, -118], 55],
];
const want = process.argv[2] ? process.argv[2].split(',') : null;
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${URL0}/?autostart=${process.env.SIZE || '8v8'}&map=cephe&type=front&debug=1&nolock=1&tod=${process.env.TOD || 'day'}&weather=${process.env.WEATHER || 'clear'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(([bots, sector]) => {
  const g = window.__game;
  if (sector) while (g.front.sector < sector) g.front.advance(true);
  if (!bots) { for (const s of g.soldiers) if (s !== g.playerSoldier) { s.brain = null; s.alive = false; s.respawnT = 1e9; s.model.root.visible = false; } g.brains.length = 0; }
  g.timeLeft = 900; if (g.playerSoldier.model) g.playerSoldier.model.root.visible = false;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.far = 900; c.updateProjectionMatrix(); } orig.call(this); };
  const r = g.renderer, ro = r.render.bind(r);
  r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; };
}, [!!process.env.BOTS, +(process.env.SECTOR || 0)]);
const rep = {};
for (const [n, pos, tgt, fov] of CAMS) {
  if (want && !want.some((w) => n.startsWith(w))) continue;
  await page.evaluate(([pos, tgt, fov, top]) => {
    const g = window.__game, f = g.scene.fog; g.playerSoldier.pos.set(pos[0], g.world.heightAt(pos[0], pos[2]), pos[2]); g.playerSoldier.fly = true; g._cam = [pos, tgt, fov];
    if (f) { f._far ??= f.far; f._near ??= f.near; f.far = top ? 5000 : f._far; f.near = top ? 4000 : f._near; }          // kuşbakışında sis yok
  }, [pos, tgt, fov, n.startsWith('k-')]);
  await page.waitForTimeout(+(process.env.WAIT || 900));
  await page.screenshot({ path: `${OUT}/${n}.png` });
  rep[n] = await page.evaluate(() => window.__info);
}
rep.map = await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); return { meshes: n, tris: Math.round(t) }; });
rep.errs = errs;
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep));
await browser.close();
