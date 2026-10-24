// Cephe modu telefonda (Pixel 7 profili, dokunmatik): botlu maç, birkaç bakış; çizim çağrısı / üçgen / kare süresi.  node scripts/frontmobile.mjs [url] [çıktı]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', OUT = process.argv[3] || '/tmp/wb-cephe/mobil';
fs.mkdirSync(OUT, { recursive: true });
const { defaultBrowserType, ...px } = devices['Pixel 7 landscape'] || devices['Pixel 7'];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ ...px, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=12v12&map=cephe&type=front&debug=1&nolock=1&touch=1&team=${process.env.TEAM || 'blue'}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 180000 });
await page.evaluate(() => {
  const g = window.__game, r = g.renderer, ro = r.render.bind(r);
  window.__ft = []; let last = performance.now();
  r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) { window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; const t = performance.now(); window.__ft.push(t - last); last = t; } };
});
const VIEWS = [['siper', null], ['koy', [4, 0, 10, 0]], ['ana-hat', [10, 0, -88, 0]]];
const rep = {};
for (const [n, P] of VIEWS) {
  if (P) await page.evaluate((P) => { const s = window.__game.playerSoldier; s.pos.set(P[0], window.__game.world.heightAt(P[0], P[2]), P[2]); s.yaw = P[3]; s.protT = 5; window.__game.devGod = true; }, P);
  await page.evaluate(() => { window.__ft.length = 0; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/pixel7-${n}.png` });
  rep[n] = await page.evaluate(() => { const f = window.__ft.slice(5).sort((a, b) => a - b); return { ...window.__info, msMed: +(f[f.length >> 1] || 0).toFixed(1), ms95: +(f[Math.floor(f.length * 0.95)] || 0).toFixed(1), w: innerWidth, h: innerHeight, pr: devicePixelRatio }; });
}
rep.errs = errs;
console.log(JSON.stringify(rep));
await browser.close();
