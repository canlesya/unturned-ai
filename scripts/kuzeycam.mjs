// Kuzey Vadisi (12.172) serbest kamera kareleri:  GPU=1 URL=http://127.0.0.1:5391 OUT=/tmp/wb-buyuk/taslak node scripts/kuzeycam.mjs [görünüm,…]
// Görünüm: [ad, kamera [x,y,z], hedef [x,y,z], fov, saat]. y değerleri ZEMİNDEN yükseklik ('k-' kuşbakışı hariç). saat: atmosfer anahtar karesi ('night': gece maçı).
// HUD + silah gizli, botlar kaldırılır.
// WEATHER=rain|fog ile hava; MOBILE=1: Pixel 7 görüntü alanı (412×915 @2,6) + mobil kalite. Çizim çağrısı / üçgen report.json'a yazılır.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5391', OUT = process.env.OUT || '/tmp/wb-buyuk/taslak';
fs.mkdirSync(OUT, { recursive: true });
export const CAMS = [
  ['k-tepeden', [0, 2300, 1], [0, 0, 0], 42, null],
  ['a1-sabah-pus', [-520, 80, 150], [40, 0, -10], 62, 6.9],
  ['a2-ogle-kopru', [-75, 16, 128], [0, 5, 0], 62, 12.5],
  ['a3-altin-saat', [130, 60, 640], [-60, 10, 0], 60, 18.8],
  ['a4-ikindi-baraj', [560, 44, 60], [700, 20, -60], 62, 16.5],
  ['a5-heli', [380, 190, 520], [-150, 0, -250], 58, 9.5],
  ['g-koy-sokak', [-212, 1.7, 268], [-238, 5, 226], 70, 10.5],
  ['g-fabrika', [330, 1.7, -220], [240, 6, -320], 70, 10.5],
  ['g-orman', [-330, 1.7, -400], [-380, 6, -460], 70, 10.5],
  ['g-radar', [-600, 60, 180], [-555, 62, 112], 66, 10.5],
  ['h-inek', [262, 3.5, 585], [300, 1, 545], 60, 11],
  ['h-koyun', [-80, 3.5, 405], [-120, 1, 370], 60, 11],
  ['h-geyik', [-282, 2.5, -335], [-300, 1.2, -360], 60, 8.5],
  ['h-karga', [290, 6, 395], [330, 3, 360], 62, 15],
  ['g-bugday', [300, 1.0, 372], [345, 1.2, 352], 70, 16.5],
  ['g-cit', [330, 1.6, 300], [330, 1.2, 345], 70, 12],
  ['a6-gece-koy', [-150, 30, 330], [-230, 5, 240], 62, 'night'],
  ['a7-gece-sokak', [-212, 1.7, 296], [-232, 2.5, 262], 70, 'night'],
  ['a8-gece-fabrika', [330, 12, -200], [250, 4, -310], 62, 'night'],
];
const want = process.argv[2] ? process.argv[2].split(',') : null;
const mobile = !!process.env.MOBILE;
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', locale: 'tr-TR' } : { viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) }, locale: 'tr-TR' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const night = !!(want && want.every((w) => w.includes('gece')));
await page.goto(`${URL0}/?autostart=${process.env.SIZE || '8v8'}&map=kuzey&type=conquest&debug=1&nolock=1&tod=${night ? 'night' : process.env.TOD || 'day'}&weather=${process.env.WEATHER || 'clear'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.waitForTimeout(1500);
const load = await page.evaluate(() => ({ stats: window.__game.map.stats }));
await page.evaluate((h) => { window.__hide = h; }, (process.env.HIDE || '').split(',').filter(Boolean));
await page.evaluate(() => {
  const g = window.__game;
  for (const s of g.soldiers) if (s !== g.playerSoldier) { s.brain = null; s.alive = false; s.respawnT = 1e9; if (s.model) s.model.root.visible = false; }
  g.brains.length = 0; g.timeLeft = 900; if (g.playerSoldier.model) g.playerSoldier.model.root.visible = false;
  for (const k of (window.__hide || [])) { const fx = g.map.fx; const o = fx[k]?.group || fx[k]; if (o) o.visible = false; if (k === 'outer') for (const m of fx.tm.outer) m.visible = false; if (k === 'clouds') fx.atm.clouds.visible = false; }
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orig.call(this); };
  const r = g.renderer, ro = r.render.bind(r);
  r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; };
});
const rep = { load };
for (const [n, pos, tgt, fov, hour] of CAMS) {
  if (want && !want.some((w) => n.startsWith(w))) continue;
  if ((hour === 'night') !== night) continue;
  await page.evaluate(([pos, tgt, fov, top, hour]) => {
    const g = window.__game, f = g.scene.fog, H = (p) => (top ? p : [p[0], p[1] + g.world.heightAt(p[0], p[2]), p[2]]);
    g.playerSoldier.pos.set(pos[0], g.world.heightAt(pos[0], pos[2]), pos[2]); g.playerSoldier.fly = true; g._cam = [H(pos), H(tgt), fov];
    if (typeof hour === 'number' && g.map.fx?.setHour) g.map.fx.setHour(hour, g);
    if (f) { f._far ??= f.far; f._near ??= f.near; f._den ??= f.density; if (top) { f.far = 1e5; f.near = 9e4; if (f.isFogExp2) f.density = 0.00004; } }
  }, [pos, tgt, fov, n.startsWith('k-'), hour]);
  await page.waitForTimeout(+(process.env.WAIT || 1400));
  await page.screenshot({ path: `${OUT}/${n}${mobile ? '-pixel7' : ''}${process.env.WEATHER ? '-' + process.env.WEATHER : ''}.png` });
  rep[n] = await page.evaluate(() => window.__info);
}
rep.map = await page.evaluate(() => { let n = 0, t = 0; window.__game.map.group.traverse((o) => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); return { meshes: n, tris: Math.round(t) }; });
rep.errs = errs;
fs.writeFileSync(`${OUT}/report${mobile ? '-pixel7' : ''}${night ? '-gece' : ''}.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep));
await browser.close();
