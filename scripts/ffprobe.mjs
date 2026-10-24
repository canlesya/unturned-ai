// Firefox ↔ Chromium: WebGL arka ucu, kanvas / DPR, kalite ayarlarının oyundaki karşılığı.
//   node scripts/ffprobe.mjs [firefox,chromium]   BASE=http://127.0.0.1:5180  DPR=2  SUPPORT=1 (Firefox about:support grafik bölümü)
import { firefox, chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5180';
const which = (process.argv[2] || 'firefox,chromium').split(',');
// macOS: bu ortamda ~/Library/Application Support/Firefox yazılamıyor (gerçek tarayıcı profili korunuyor) → Firefox'a geçici bir "ev" dizini verilir (CFFIXED_USER_HOME)
export function launchOpt(name) {
  if (name !== 'firefox') return { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] };
  const home = process.env.FF_HOME || '/tmp/wb-ff/home';
  for (const d of ['Library/Caches', 'Library/Application Support']) fs.mkdirSync(`${home}/${d}`, { recursive: true });
  const prefs = process.env.RFP ? { 'privacy.resistFingerprinting': true } : {};          // RFP=1: LibreWolf / Mullvad / Tor varsayılanı (parmak izi direnci)
  return { headless: false, env: { ...process.env, CFFIXED_USER_HOME: home }, firefoxUserPrefs: prefs };
}
for (const name of which) {
  const bt = name === 'firefox' ? firefox : chromium;
  const browser = await bt.launch(launchOpt(name));
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: +(process.env.DPR || 2) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [sayfa hatası]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [konsol]', m.type(), m.text().slice(0, 200)); });
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1${process.env.Q || ''}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => {
    const g = window.__game, r = g.renderer, gl = r.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const ani = gl.getExtension('EXT_texture_filter_anisotropic');
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT), mp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT);
    return {
      ua: navigator.userAgent, dpr: devicePixelRatio, inner: [innerWidth, innerHeight],
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      ctxAttr: gl.getContextAttributes(), samples: gl.getParameter(gl.SAMPLES), maxSamples: gl.getParameter(gl.MAX_SAMPLES),
      maxAniso: ani ? gl.getParameter(ani.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0,
      precision: r.capabilities.precision, fragHighp: [hp.rangeMax, hp.precision], fragMediump: [mp.rangeMax, mp.precision],
      parallelCompile: !!gl.getExtension('KHR_parallel_shader_compile'),
      settings: g.settings, pixelRatio: r.getPixelRatio(), drawBuf: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      canvasCss: [g.canvas.clientWidth, g.canvas.clientHeight],
      perf: g._perf, post: !!g.post?.on, shadow: r.shadowMap.enabled ? g.sun.shadow.mapSize.x : 0,
      programs: r.info.programs?.length, calls: r.info.render.calls, warm: g.warm,
      maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxRb: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), maxVp: [...gl.getParameter(gl.MAX_VIEWPORT_DIMS)], extList: gl.getSupportedExtensions(), glErr: gl.getError(), exts: gl.getSupportedExtensions().length, colorBufFloat: !!gl.getExtension('EXT_color_buffer_float'),
      timerStep: (() => { const a = []; let l = performance.now(); for (let i = 0; i < 2e6 && a.length < 6; i++) { const n = performance.now(); if (n !== l) { a.push(+(n - l).toFixed(3)); l = n; } } return a; })(),
    };
  });
  info.raf = await page.evaluate(() => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); if (ts.length < 121) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]); const u = [...new Set(d.map((x) => +x.toFixed(2)))].slice(0, 8); res({ avg: +((ts[120] - ts[0]) / 120).toFixed(2), distinct: u }); } }; requestAnimationFrame(f); }));
  info.loopDt = await page.evaluate(() => new Promise((res) => { const g = window.__game, out = []; const o = g.perfTick.bind(g); g.perfTick = (n, dt) => { out.push(+(dt * 1000).toFixed(1)); o(n, dt); }; setTimeout(() => { g.perfTick = o; res(out.slice(0, 30)); }, 600); }));
  console.log(`\n=== ${name} ${browser.version()} ${process.env.RFP ? '(RFP)' : ''} ===`);
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `/tmp/wb-ff/probe-${name}.png` });
  if (name === 'firefox' && process.env.SUPPORT) {
    try {
      const p2 = await ctx.newPage(); await p2.goto('about:support'); await p2.waitForTimeout(3000);
      const t = await p2.evaluate(() => document.body.innerText); const i = t.indexOf('Graphics'); console.log(t.slice(i, i + 7000));
    } catch (e) { console.log('about:support açılamadı:', e.message); }
  }
  await browser.close();
}
