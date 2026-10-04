// Çizim yükü: draw call / üçgen sayısı (GPU yükünün göstergesi). node scripts/renderinfo.mjs "<query>"  örn. "autostart=10v10&map=kasaba"
import { chromium } from 'playwright';
const q = process.argv[2] || 'autostart=10v10&map=kasaba';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?${q}&debug=1&nolock=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(() => {
  const g = window.__game, rd = g.renderer; rd.info.autoReset = false; rd.info.reset();
  g.step(1 / 30); rd.info.reset(); rd.clear(); rd.render(g.scene, g.camera);
  const main = { calls: rd.info.render.calls, tris: rd.info.render.triangles };
  let meshes = 0, shadowCasters = 0; g.scene.traverse((o) => { if (o.isMesh) { meshes++; if (o.castShadow) shadowCasters++; } });
  const sold = g.soldiers.length; let sm = 0; g.soldiers.forEach((s) => s.model.root.traverse((o) => { if (o.isMesh) sm++; }));
  return { ...main, meshes, shadowCasters, soldiers: sold, soldierMeshes: sm, perSoldier: +(sm / sold).toFixed(1), shadow: !!g.sun?.castShadow, pr: rd.getPixelRatio(), geoms: rd.info.memory.geometries, tex: rd.info.memory.textures };
});
console.log(q, JSON.stringify(r));
await browser.close();
