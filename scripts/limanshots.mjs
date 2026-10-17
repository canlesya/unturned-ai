// Liman ekran görüntüleri: kuşbakışı + bakış noktaları; masaüstü / Pixel 7 yatay (touch=1) / iPhone 14 yatay; gündüz + gece. Ayrıca çizim yükü + kare süresi.
//   node scripts/limanshots.mjs [url=http://127.0.0.1:5196] [etiket=now]     → /tmp/wb-liman-shots/<etiket>/<cihaz>-<saat>-<ad>.png
//   DEV=desktop,pixel7,iphone14  TOD=day,night  ONLY=ad1,ad2 ile süzülür.  THUMB=1: public/img/liman.jpg (960×540) üretir.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5196';
const tag = process.argv[3] || 'now';
const OUT = `/tmp/wb-liman-shots/${tag}`;
fs.mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  pixel7: strip(devices['Pixel 7 landscape']),
  iphone14: strip(devices['iPhone 14 landscape']),
};
const want = (process.env.DEV || 'desktop,pixel7,iphone14').split(',');
const tods = (process.env.TOD || 'day,night').split(',');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
// ad, x, z, yaw (0 = kuzey, −π/2 = doğu), pitch, y (null = zemin)
const VIEWS = [
  ['1-mavi-avlu', 0, 30.5, 0, 0.02],
  ['2-orta-guney', 4.9, 21, 0, 0.0],
  ['3-kule-cati', 2.6, 4.5, 0.15, -0.05, 2.6],
  ['4-tunel', 0, 8.5, 0, 0.0],
  ['5-rihtim', 27.6, 20, 0.12, 0.08],
  ['6-a-portal', -20, 14, 0.05, 0.12],
  ['7-bati-gecit', -20, 5.5, -1.25, 0.0],
  ['8-kirmizi-avlu', 0, -30.5, Math.PI, 0.02],
  ['9-c-bati', 22.5, -4.5, Math.PI / 2 - 0.2, 0.0],
  ['10-gemi', 28.6, -4, -Math.PI / 2 + 0.25, 0.1],
];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const perf = [];
for (const dk of want) for (const tod of tods) {
  const D = DEVS[dk]; const mob = dk !== 'desktop';
  const ctx = await browser.newContext({ ...D });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${base}/?autostart=5v5&map=liman&type=conquest&debug=1&nolock=1&tod=${tod}${mob ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const adv = (n = 6) => page.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) g.step(1 / 30); }, n);
  await page.evaluate(() => { const g = window.__game; g.simOff = true; g.playerSoldier.protT = 99; });
  // çizim yükü (ana geçiş) + ortalama kare süresi (yazılım GPU: yalnız göreli karşılaştırma)
  const r = await page.evaluate(async () => {
    const g = window.__game, rd = g.renderer; rd.info.autoReset = false; rd.info.reset(); rd.render(g.scene, g.camera);
    const calls = rd.info.render.calls, tris = rd.info.render.triangles; rd.info.autoReset = true;
    const t0 = performance.now(); let n = 0; await new Promise((res) => { const f = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { calls, tris, fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), pr: rd.getPixelRatio(), w: rd.domElement.width, h: rd.domElement.height, shadow: !!g.sun?.castShadow };
  });
  perf.push({ dk, tod, ...r }); console.log('çizim', dk, tod, JSON.stringify(r));
  for (const [name, x, z, yaw, pitch, y = null] of VIEWS) {
    if (only && !only.includes(name)) continue;
    await page.evaluate(([x, z, yaw, pitch, y]) => { const g = window.__game, p = g.playerSoldier; p.pos.set(x, y ?? 0, z); g.world.settle(p); if (y !== null) p.pos.y = y; p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; }, [x, z, yaw, pitch, y]);
    await adv(6); await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${dk}-${tod}-${name}.png` });
  }
  if (!only || only.includes('0-kusbakisi')) {             // kuşbakışı (HUD gizli)
    await page.evaluate(() => {
      const g = window.__game, P = Object.getPrototypeOf(g); g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
      g._ovOrig ||= P.render; const orig = g._ovOrig;
      g.render = function () { const c = this.camera; c.position.set(-34, 62, 58); c.rotation.order = 'YXZ'; c.lookAt(2, 0, 0); c.fov = 50; c.updateProjectionMatrix(); this.scene.fog && (this.scene.fog.far = 900); orig.call(this); };
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${dk}-${tod}-0-kusbakisi.png` });
    if (process.env.THUMB === '1' && dk === 'desktop' && tod === 'day') {
      await page.setViewportSize({ width: 960, height: 540 }); await page.waitForTimeout(900);
      await page.screenshot({ path: 'public/img/liman.jpg', type: 'jpeg', quality: 86 });
    }
  }
  console.log(dk, tod, 'hata:', errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/perf.json`, JSON.stringify(perf, null, 1));
await browser.close();
