// Kuzey Vadisi (12.172) kare süresi / çizim çağrısı: botlu maç (16v16), oyuncu birkaç bölgeye ışınlanır, 3 sn ölçülür.
//   node scripts/kuzeyperf.mjs [masaustu|pixel7] [çıktı]   (Mac GPU; Pixel 7 = görüntü alanı + DPR + mobil UA + dokunmatik → harita 'low' kalite)
import { chromium, devices } from 'playwright';
import fs from 'fs';
const prof = process.argv[2] || 'masaustu', OUT = process.argv[3] || '/tmp/wb-buyuk/perf', URL0 = process.env.URL || 'http://127.0.0.1:5391';
fs.mkdirSync(OUT, { recursive: true });
const { defaultBrowserType, ...px } = devices['Pixel 7 landscape'] || devices['Pixel 7'];
const browser = await chromium.launch({ headless: !process.env.HEADFUL, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext(prof === 'pixel7' ? { ...px, locale: 'tr-TR' } : { viewport: { width: 1600, height: 900 }, locale: 'tr-TR' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const t0 = Date.now();
await page.goto(`${URL0}/?autostart=${process.env.SIZE || '16v16'}&map=kuzey&type=conquest&debug=1&nolock=1${prof === 'pixel7' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
const loadMs = Date.now() - t0;
await page.evaluate(() => {
  const g = window.__game, r = g.renderer, ro = r.render.bind(r);
  window.__ft = []; let last = performance.now();
  r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) { window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; const t = performance.now(); window.__ft.push(t - last); last = t; } };
  g.devGod = true;
});
const VIEWS = [['us', null], ['kopru', [-8, 80, Math.PI]], ['koy', [-200, 262, 1.2]], ['fabrika', [300, -250, -2.3]], ['orman', [-360, -400, 2.6]], ['radar', [-560, 118, -1.0]], ['baraj', [700, -40, 0]]];
const rep = { prof, loadMs, stats: await page.evaluate(() => window.__game.map.stats) };
for (const [n, P] of VIEWS) {
  if (P) await page.evaluate((P) => { const g = window.__game, s = g.playerSoldier; s.pos.set(P[0], g.world.heightAt(P[0], P[1]) + 0.05, P[1]); s.yaw = P[2]; s.protT = 5; }, P);
  await page.evaluate(() => { window.__ft.length = 0; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${prof}-${n}.png` });
  rep[n] = await page.evaluate(() => {
    const f = window.__ft.slice(5).sort((a, b) => a - b), g = window.__game, by = {};
    // görünür üçgen (kamera kırpması hariç kaba üst sınır) katman başına: arazi / orman / yapı / ot / su / diğer
    g.map.group.traverse((o) => { if (!o.isMesh || !o.visible) return; let v = o, vis = true; while (v) { if (!v.visible) { vis = false; break; } v = v.parent; } if (!vis) return;
      let top = o; while (top.parent && top.parent !== g.map.group) top = top.parent; const k = top.name || 'yapı';
      const t = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : o.geometry.isInstancedBufferGeometry ? o.geometry.instanceCount : 1);
      by[k] = (by[k] || 0) + Math.round(t); });
    return { ...window.__info, msMed: +(f[f.length >> 1] || 0).toFixed(1), ms95: +(f[Math.floor(f.length * 0.95)] || 0).toFixed(1), n: f.length, by };
  });
}
rep.mem = await page.evaluate(() => { const i = window.__game.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(0) : null }; });
rep.errs = errs;
fs.writeFileSync(`${OUT}/${prof}.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep));
await browser.close();
