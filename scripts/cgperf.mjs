// Çöl Geçidi performans (12.171): 8v8 botlu maç, sabit bakışlarda çizim çağrısı / üçgen / kare süresi; masaüstü + Pixel 7 profili.
//   BASE=http://127.0.0.1:5180 node scripts/cgperf.mjs [çıktı.json]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5180';
const VIEWS = [['T Spawn', 0, 4, 0], ['Mid', 0, 3, 0], ['Long', 0, 6, 0], ['A Site', 0, 6, 0.4], ['B Site', 6, 6, 0.8], ['CT Mid', -10, 0, 1.57], ['Outside Long', 0, 5, 0.4], ['Upper Tunnels', 4, 0, -1.57]];
const out = {};
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
for (const [prof, ctxOpt] of [['masaüstü', { viewport: { width: 1280, height: 720 } }], ['pixel7', { ...devices['Pixel 7'] }]]) {
  const ctx = await browser.newContext(ctxOpt), page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=8v8&map=colgecidi&type=tdm&tod=day&debug=1&nolock=1&dev=1`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  const rows = [];
  for (const [nm, dx, dz, yaw] of VIEWS) {
    const r = await page.evaluate(async ([nm, dx, dz, yaw]) => {
      const g = window.__game, s = g.player.s, c = g.map.callouts.find((q) => q.name === nm);
      s.fly = true; s.pos.set(c.x + dx, g.world.heightAt(c.x + dx, c.z + dz), c.z + dz); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = -0.03;
      await new Promise((res) => setTimeout(res, 700));
      const rd = g.renderer; rd.info.autoReset = false;
      const ts = []; let calls = 0, tris = 0, n = 0;
      await new Promise((res) => { let last = performance.now(); const f = () => { const t = performance.now(); ts.push(t - last); last = t; rd.info.reset(); if (ts.length < 120) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      rd.info.reset(); g.renderer.render(g.scene, g.camera); calls = rd.info.render.calls; tris = rd.info.render.triangles; rd.info.autoReset = true;
      ts.shift(); ts.sort((a, b) => a - b);
      const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
      return { yer: nm, cagri: calls, ucgen: tris, kareMs: +avg.toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1) };
    }, [nm, dx, dz, yaw]);
    rows.push(r);
  }
  const mem = await page.evaluate(() => { const g = window.__game; let mt = 0; g.map.group.traverse((o) => { if (o.isMesh) mt += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return { haritaUcgen: mt, ag: g.map.group.children.length, geo: g.renderer.info.memory.geometries, prog: g.renderer.info.programs?.length }; });
  out[prof] = { rows, mem, hata: errs.length };
  console.log(prof, JSON.stringify(mem), 'hata', errs.length); for (const r of rows) console.log('  ', JSON.stringify(r));
  await ctx.close();
}
await browser.close();
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
