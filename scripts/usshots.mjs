// Askeri Üs ekran görüntüleri: kuşbakışı + bölge bakışları (göz hizası ve alçak drone) + 3 iç mekân; masaüstü / Pixel 7 yatay; gündüz / gece. Ayrıca çizim yükü + kare süresi.
//   node scripts/usshots.mjs [url=http://127.0.0.1:5215] [etiket=now]   → /tmp/wb-us-shots/<etiket>/<cihaz>-<saat>-<ad>.png
//   DEV=desktop,pixel7  TOD=day,night  ONLY=ad1,ad2 ile süzülür.  THUMB=1: public/img/us.jpg (960×540) üretir.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5215';
const tag = process.argv[3] || 'now';
const OUT = `/tmp/wb-us-shots/${tag}`;
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, pixel7: strip(devices['Pixel 7 landscape']) };
const want = (process.env.DEV || 'desktop,pixel7').split(',');
const tods = (process.env.TOD || 'day,night').split(',');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
// ad, kamera [x,y,z], bakılan [x,y,z]  (serbest kamera; HUD ve silah gizli)
const VIEWS = [
  ['00-kusbakisi', [-70, 95, 105], [0, 0, 0]],
  ['01-mavi-kamp', [-74, 1.7, -1], [-56, 1.5, 3]],
  ['02-mavi-kapi-disi', [-46, 1.7, 4], [-60, 1.6, 0]],
  ['03-ana-cadde', [-46, 1.7, 1.5], [-10, 1.2, 0]],
  ['04-komuta-meydan', [9, 1.7, 16], [-2, 3, 0]],
  ['05-hangar-onu', [7, 1.7, -27], [0, 3, -45]],
  ['06-radar', [-9, 1.7, 31], [3, 4, 46]],
  ['07-tunel-agzi', [-58, 1.7, -32], [-46, 1.5, -36]],
  ['08-akaryakit', [26, 1.7, -4], [36, 2, -20]],
  ['09-kisla', [-45.5, 1.7, 17.2], [-24, 1.6, 18.5]],
  ['10-konteyner', [-55.5, 1.7, 28.6], [-70, 1.5, 42]],
  ['11-garaj', [-55, 1.7, -36], [-68, 1.6, -50]],
  ['12-helipad', [24, 1.7, -36], [36, 2, -50]],
  ['13-bunker-gb', [-30, 1.7, 30], [-45, 1.2, 40]],
  ['14-drone-kuzey', [-25, 22, -14], [-5, 0, -42]],
  ['15-drone-guney', [25, 22, 22], [0, 0, 46]],
  ['16-drone-kd', [10, 24, -5], [36, 0, -30]],
  ['17-drone-gb', [-12, 24, 8], [-40, 0, 30]],
  ['18-drone-kamp', [-40, 26, 0], [-68, 0, 0]],
  ['i1-komuta-ic', [-7.3, 1.65, 5.6], [-7, 1.2, -5]],
  ['i2-savas-odasi', [8.8, 8.05, 5.6], [0, 7.0, -3]],
  ['i3-hangar-ic', [9, 1.7, -37.5], [-6, 2.2, -48]],
  ['i4-tunel-ic', [-45, 1.6, -36.6], [-20, 1.3, -36]],
  ['i5-kisla-ic', [-44.5, 1.65, 9.3], [-37, 1, 14]],
];
const browser = await chromium.launch({ args: process.env.SW ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });   // varsayılan gerçek GPU (Metal); SW=1 yazılım
const perf = [];
for (const dk of want) for (const tod of tods) {
  const D = DEVS[dk]; const mob = dk !== 'desktop';
  const ctx = await browser.newContext({ ...D });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${base}/?autostart=8v8&map=us&type=conquest&debug=1&nolock=1&tod=${tod}${mob ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.__game; g.simOff = true; g.playerSoldier.protT = 99; for (const s of g.soldiers || []) if (!s.isPlayer && s.mesh) s.mesh.visible = false; });
  const r = await page.evaluate(async () => {
    const g = window.__game, rd = g.renderer; rd.info.autoReset = false; rd.info.reset(); rd.render(g.scene, g.camera);
    const calls = rd.info.render.calls, tris = rd.info.render.triangles; rd.info.autoReset = true;
    const t0 = performance.now(); let n = 0; await new Promise((res) => { const f = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { calls, tris, fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), pr: rd.getPixelRatio(), w: rd.domElement.width, h: rd.domElement.height };
  });
  perf.push({ dk, tod, ...r }); console.log('çizim', dk, tod, JSON.stringify(r));
  await page.evaluate(() => {
    const g = window.__game, P = Object.getPrototypeOf(g); g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
    const orig = P.render; window.__cam = null;
    g.render = function () { const c = this.camera, v = window.__cam; for (const s of this.soldiers) if (s.model) s.model.root.visible = false; if (v) { c.position.set(...v.p); c.rotation.order = 'YXZ'; c.lookAt(...v.t); c.fov = v.fov; c.updateProjectionMatrix(); if (this.scene.fog) this.scene.fog.far = v.far; this.playerSoldier.pos.set(v.p[0], 0, v.p[2]); } orig.call(this); };
  });
  for (const [name, p, t] of VIEWS) {
    if (only && !only.includes(name)) continue;
    const aerial = p[1] > 20;
    const far0 = await page.evaluate(() => window.__game.scene.fog?.far || 400);
    await page.evaluate(([p, t, fov, far]) => { window.__cam = { p, t, fov, far }; }, [p, t, aerial ? 50 : 70, aerial && p[1] > 60 ? 900 : far0]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${dk}-${tod}-${name}.png`, timeout: 180000 });
    if (name === '00-kusbakisi' && process.env.THUMB === '1' && dk === 'desktop' && tod === 'day') {
      await page.setViewportSize({ width: 960, height: 540 }); await page.waitForTimeout(900);
      await page.screenshot({ path: 'public/img/us.jpg', type: 'jpeg', quality: 86 });
      await page.setViewportSize(D.viewport);
    }
    await page.evaluate((f) => { if (window.__game.scene.fog) window.__game.scene.fog.far = f; }, far0);
  }
  console.log(dk, tod, 'hata:', errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/perf.json`, JSON.stringify(perf, null, 1));
await browser.close();
