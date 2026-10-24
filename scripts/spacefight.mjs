// Uzay modu (12.157) çatışma anı kareleri: oyuncu bot beyniyle oynar (autoplay, ölümsüz), HUD açık; ekranda enerji izi (tracer) olan kareler seçilir.
//   URL=… OUT=… [MOB=1 Pixel 7] [N=40 kare] node scripts/spacefight.mjs      → OUT/fight-*.png + fight.json (kare başına çizim çağrısı / üçgen / kare süresi)
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-uzay/fight', N = +(process.env.N || 40);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = process.env.MOB ? await browser.newContext({ ...strip(devices['Pixel 7 landscape']) }) : await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=6v6&map=yorunge&type=space&debug=1&nolock=1&autoplay=1&team=${process.env.TEAM || 'blue'}${process.env.MOB ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__game; g.devGod = true; g.timeLeft = 900;
  const r = g.renderer, ro = r.render.bind(r); let t0 = performance.now();
  window.__fr = []; r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) { const t = performance.now(); window.__fr.push(t - t0); t0 = t; if (window.__fr.length > 120) window.__fr.shift(); window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; } };
});
await page.waitForTimeout(12000);
const shots = [];
for (let i = 0; i < N; i++) {
  await page.waitForTimeout(450);
  const st = await page.evaluate(() => { const g = window.__game, f = [...window.__fr].sort((a, b) => a - b); return { tr: g.effects.tracers.length, enemy: g.soldiers.filter((s) => s.alive && s.team !== g.playerSoldier.team && g.camera.position.distanceTo(s.pos) < 45).length, ...window.__info, ms: +(f[Math.floor(f.length / 2)] || 0).toFixed(1) }; });
  if (st.tr >= 2 || i === N - 1) { const fn = `fight-${String(i).padStart(2, '0')}.png`; await page.screenshot({ path: `${OUT}/${fn}` }); shots.push({ fn, ...st }); }
}
fs.writeFileSync(`${OUT}/fight.json`, JSON.stringify({ shots, errs }, null, 1));
console.log(shots.map((s) => `${s.fn} iz ${s.tr} düşman ${s.enemy} · ${s.calls} çağrı · ${Math.round(s.tris / 1000)} bin üçgen · ${s.ms} ms`).join('\n'));
console.log('hatalar:', errs);
await browser.close();
