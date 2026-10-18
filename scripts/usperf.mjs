// Askeri Üs kare süresi / çizim yükü (gerçek GPU: Metal ANGLE):  node scripts/usperf.mjs [url=http://127.0.0.1:5215] [etiket]
// Masaüstü 1280×720 ve Pixel 7 yatay (2×); gündüz + gece; 3 sabit bakış (göz hizası cadde, kamp, kuşbakışı) — her biri 3 sn ortalama kare süresi.
import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5215', tag = process.argv[3] || '';
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, pixel7: strip(devices['Pixel 7 landscape']) };
const VIEWS = [['cadde', [-46, 1.7, 1.5], [-10, 1.2, 0]], ['kamp', [-40, 26, 0], [-68, 0, 0]], ['kus', [-70, 95, 105], [0, 0, 0]]];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
for (const dk of (process.env.DEV || 'desktop,pixel7').split(',')) for (const tod of ['day', 'night']) {
  const ctx = await browser.newContext({ ...DEVS[dk] }); const page = await ctx.newPage();
  await page.goto(`${base}/?autostart=8v8&map=us&type=conquest&debug=1&nolock=1&tod=${tod}${dk !== 'desktop' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const gpu = await page.evaluate(() => { const gl = window.__game.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  await page.evaluate(() => { const g = window.__game, P = Object.getPrototypeOf(g); g.simOff = true; g.hud.root.style.display = 'none'; const orig = P.render; g.render = function () { const v = window.__cam; if (v) { const c = this.camera; c.position.set(...v.p); c.lookAt(...v.t); c.updateProjectionMatrix(); } orig.call(this); }; });
  const out = [];
  for (const [nm, p, t] of VIEWS) {
    await page.evaluate(([p, t]) => { window.__cam = { p, t }; }, [p, t]); await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const g = window.__game, rd = g.renderer; rd.info.autoReset = false; rd.info.reset(); rd.render(g.scene, g.camera); const calls = rd.info.render.calls, tris = rd.info.render.triangles; rd.info.autoReset = true;
      const ts = []; let last = performance.now(); await new Promise((res) => { const f = () => { const n = performance.now(); ts.push(n - last); last = n; if (ts.length < 180) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      ts.sort((a, b) => a - b); return { calls, tris, ms: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1) };
    });
    out.push(`${nm} ${r.ms}ms(p95 ${r.p95}) ${r.calls}çç ${Math.round(r.tris / 1000)}k`);
  }
  console.log(`${tag} ${dk} ${tod} [${gpu.slice(0, 40)}]  ${out.join(' · ')}`);
  await ctx.close();
}
await browser.close();
