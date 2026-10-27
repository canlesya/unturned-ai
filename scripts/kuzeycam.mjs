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
// 12.182 doldurma önce / sonra bakış noktaları (CAMSET=fill)
export const FILL = [
  ['f01-c-merkez', [-55, 5, 62], [0, 3, 9], 66, 10.5],
  ['f02-c-yukari', [90, 45, 95], [0, 0, 5], 60, 10.5],
  ['f03-demir', [-415, 16, 30], [-470, 4, -31], 64, 10.5],
  ['f04-A-radar', [-490, 28, 185], [-560, 0, 120], 64, 10.5],
  ['f05-B-koy', [-175, 6, 305], [-230, 3, 250], 66, 10.5],
  ['f06-D-fabrika', [335, 10, -205], [250, 4, -300], 64, 10.5],
  ['f07-E-baraj', [630, 12, 20], [700, 14, -60], 64, 10.5],
  ['f08-F-ciftlik', [345, 6, 475], [400, 3, 420], 66, 10.5],
  ['f09-G-kamp', [-362, 3.2, -430], [-400, 2, -456], 66, 10.5],
  ['f10-heli', [320, 260, 520], [-80, 0, -120], 58, 10.5],
  ['f11-yol', [44, 1.7, 300], [12, 2.5, 160], 70, 10.5],
  ['f12-ara-CF', [200, 1.7, 160], [110, 2.5, 70], 70, 10.5],
  ['f13-ara-BC', [-130, 1.7, 160], [-40, 2.5, 60], 70, 10.5],
  ['f14-ara-DG', [-80, 14, -270], [-200, 2, -380], 64, 10.5],
  ['k-tepeden', [0, 2300, 1], [0, 0, 0], 42, null],
];
// 12.182 yakın denetim (yeni varlıklar)
export const DETAY = [
  ['d01-C-bayrak', [-16, 1.7, 24], [0, 1.5, 0], 70, 10.5], ['d02-C-yikik', [-8, 2.4, 14], [-17, 1.2, 3], 66, 10.5], ['d03-C-mevzi', [-5, 2.2, -7], [-11, 0.4, -13], 66, 10.5],
  ['d04-C-enkaz', [13, 1.8, 7], [8.4, 0.5, 1], 66, 10.5], ['d05-C-sapel', [19, 2.2, -13], [30, 2.5, -24], 66, 10.5], ['d06-C-durak', [2.5, 1.7, 51], [8.3, 1.2, 47], 66, 10.5],
  ['d07-benzinlik', [72, 5, 296], [41, 2, 324], 64, 10.5], ['d08-degirmen', [-478, 3, -28], [-492, 6, -48], 66, 10.5], ['d09-cadir', [42, 2.5, 738], [29, 1.5, 752], 66, 10.5],
  ['d10-trafo', [492, 5, -118], [476, 1, -138], 64, 10.5], ['d11-ciftlik', [138, 5, -34], [158, 2, -62], 64, 10.5], ['d12-dolusavak', [636, 7, -58], [700, 8, -60], 64, 16.5],
  ['d13-gecit', [-192, 3, 62], [-209, 2, 40], 66, 10.5], ['d14-kontrol', [27, 2.2, 166], [14, 1, 150], 66, 10.5], ['d15-calilik', [-210, 2, -150], [-150, 2, -110], 70, 10.5],
];
export const IC = [
  ['i01-han-alt', [-27.4, 1.9, 34.4], [-35, 1.0, 38.5], 80, 10.5], ['i02-han-ust', [-27.6, 4.9, 37], [-35, 3.8, 33], 80, 10.5],
  ['i03-ciftlik-alt', [150.5, 1.9, -57.6], [150, 0.9, -62.5], 80, 10.5], ['i04-sapel-ic', [27.6, 1.8, -24], [33.5, 1.2, -24], 80, 10.5],
];
// 12.184 QA bakışları (CAMSET=qa)
export const QA = [
  ['k-baraj', [690, 150, -30], [700, 0, -60], 55, null],
  ['q01-baraj-guney', [700, 1.7, -8], [700, 0, -60], 70, 10.5],
  ['q02-baraj-yol', [688, 1.7, 14], [690, 0, -60], 70, 10.5],
  ['q03-baraj-alt', [660, 1.7, -60], [700, 14, -60], 70, 10.5],
  ['q04-tel-ev', [-138, 14, 326], [-156, 6, 338], 62, 10.5],
  ['q05-tel-agac', [-60, 4, 404], [-100, 7, 372], 66, 10.5],
  ['q06-tel-agac2', [24, 3, 226], [8, 7, 172], 66, 10.5],
  ['q07-tel-agac3', [-330, 3, -490], [-310, 7, -540], 66, 10.5],
  ['q10-ciftlik-KB', [-90, 2, -80], [-110, 2, -100], 70, 10.5], ['q11-ciftlik-BA', [-280, 2, 80], [-300, 2, 102], 70, 10.5],
  ['q12-ciftlik-GD', [556, 2, 216], [536, 2, 236], 70, 10.5], ['q13-ciftlik-KK', [162, 2, -508], [182, 2, -528], 70, 10.5],
  ['q14-ciftlik-BB', [-520, 2, 354], [-540, 2, 334], 70, 10.5], ['q15-ciftlik-SD', [490, 2, 90], [470, 2, 70], 70, 10.5],
  ['q16-kontrol-R9', [662, 2, 162], [650, 1, 150], 70, 10.5], ['q17-ocak', [-640, 3, -350], [-662, 1, -372], 70, 10.5],
  ['q20-ahir-GD', [547, 1.8, 216], [537, 1.5, 220], 70, 10.5], ['q21-avci-kulube', [-629, 1.8, -244], [-638, 1.5, -240], 70, 10.5], ['q22-ahir-BB', [-551, 1.8, 346], [-541, 1.5, 350], 70, 10.5],
  ['q18-dg-gecit', [350, 2, -60], [330, 1, -76], 70, 10.5], ['q19-gece-ciftlik', [-90, 3, -80], [-110, 2, -100], 70, 'night'],
];
const LIST = process.env.CAMSET === 'qa' ? QA : process.env.CAMSET === 'fill' ? FILL : process.env.CAMSET === 'detay' ? DETAY : process.env.CAMSET === 'ic' ? IC : CAMS;
const want = process.argv[2] ? process.argv[2].split(',') : null;
const mobile = !!process.env.MOBILE;
const browser = await chromium.launch({ headless: !process.env.HEADFUL, args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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
for (const [n, pos, tgt, fov, hour] of LIST) {
  if (want && !want.some((w) => n.startsWith(w))) continue;
  if ((hour === 'night') !== night) continue;
  await page.evaluate(([pos, tgt, fov, top, hour]) => {
    const g = window.__game, f = g.scene.fog, H = (p) => (top ? p : [p[0], p[1] + g.world.heightAt(p[0], p[2]), p[2]]);
    g.playerSoldier.pos.set(pos[0], g.world.heightAt(pos[0], pos[2]), pos[2]); g.playerSoldier.fly = true; g._cam = [H(pos), H(tgt), fov];
    if (typeof hour === 'number' && g.map.fx?.setHour) g.map.fx.setHour(hour, g);
    if (f) { f._far ??= f.far; f._near ??= f.near; f._den ??= f.density; if (top) { f.far = 1e5; f.near = 9e4; if (f.isFogExp2) f.density = 0.00004; } }
    const fx = g.map.fx; if (fx && !fx._shWrap) { const sh = fx.setHour; fx.setHour = function (...a) { if (this._noHour) return; return sh.apply(this, a); }; fx._shWrap = true; } if (fx) fx._noHour = !!top;   // kuşbakışında gün döngüsü sisi geri yazmasın
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
