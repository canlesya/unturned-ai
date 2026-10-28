// 12.222 Maç → menü döngüsü sızıntı denetimi: menüden maça gir (Enter), birkaç saniye oyna, Esc menüsünden çıkış yolu (game.exit) ile menüye dön; N kez.
// Her menü dönüşünde: menü kare süresi (ort / p99 / max), JS yığını, açık WebGL bağlamı, etkin setInterval, kare başı rAF geri çağrısı, DOM düğümü.
//   node scripts/lobbycycle.mjs [döngü=5] [maç sn=8]   URL=http://127.0.0.1:8990  HEADFUL=1 · GPU=swiftshader
import { chromium } from 'playwright';
const N = +(process.argv[2] || 5), playS = +(process.argv[3] || 8), base = process.env.URL || 'http://127.0.0.1:8990';
const gpu = process.env.GPU === 'swiftshader' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ headless: !process.env.HEADFUL, args: [...gpu, '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
let code = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' });
  await ctx.addInitScript(() => {
    const W = (window.__lc = { ctx: 0, ctxLost: 0, iv: new Set(), raf: 0, ft: [], last: 0 });
    const gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (k, a) { const c = gc.call(this, k, a); if (c && /webgl/.test(k) && !this.__wb) { this.__wb = 1; W.ctx++; this.addEventListener('webglcontextlost', () => W.ctxLost++); } return c; };
    const si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function (...a) { const id = si.apply(this, a); W.iv.add(id); return id; };
    window.clearInterval = function (id) { W.iv.delete(id); return ci.call(this, id); };
    const ra = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { return ra.call(this, (t) => { W.raf++; cb(t); }); };
    const f = (t) => { if (W.last) W.ft.push(t - W.last); W.last = t; ra(f); }; ra(f);
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '/?nolock=1&debug=1&nologin=1');
  await page.waitForSelector('#mnStage .home', { timeout: 60000 });
  const lobby = async (tag) => {
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const W = window.__lc; W.ft.length = 0; W.raf = 0; W.t0 = performance.now(); });
    await page.waitForTimeout(6000);
    const r = await page.evaluate(() => { window.gc?.(); const W = window.__lc, a = [...W.ft].sort((x, y) => x - y), s = (performance.now() - W.t0) / 1000;
      return { n: a.length, avg: a.reduce((x, y) => x + y, 0) / a.length, p99: a[Math.floor(a.length * 0.99)], max: a[a.length - 1], heap: performance.memory.usedJSHeapSize / 1048576, ctx: W.ctx - W.ctxLost, ctxAll: W.ctx, iv: W.iv.size, rafPerFrame: W.raf / a.length, dom: document.getElementsByTagName('*').length, canv: document.querySelectorAll('canvas').length }; });
    console.log(`${tag.padEnd(10)} menü kare ort ${r.avg.toFixed(2)} p99 ${r.p99.toFixed(1)} max ${r.max.toFixed(1)} ms | yığın ${r.heap.toFixed(0)} MB | WebGL bağlam açık ${r.ctx} (toplam ${r.ctxAll}) | setInterval ${r.iv} | rAF/kare ${r.rafPerFrame.toFixed(2)} | DOM ${r.dom} | tuval ${r.canv}`);
    return r;
  };
  const rows = [await lobby('başlangıç')];
  for (let i = 1; i <= N; i++) {
    await page.keyboard.press('Enter');
    await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier && window.__game.playerSoldier.alive', null, { timeout: 120000 });
    await page.waitForTimeout(playS * 1000);
    await page.evaluate(() => window.__game.exit());
    await page.waitForSelector('#mnStage .home', { timeout: 60000 });
    rows.push(await lobby(`döngü ${i}`));
  }
  const a = rows[0], b = rows[rows.length - 1];
  console.log(`ÖZET: yığın ${a.heap.toFixed(0)}→${b.heap.toFixed(0)} MB · WebGL ${a.ctx}→${b.ctx} · setInterval ${a.iv}→${b.iv} · rAF/kare ${a.rafPerFrame.toFixed(2)}→${b.rafPerFrame.toFixed(2)} · menü ort ${a.avg.toFixed(2)}→${b.avg.toFixed(2)} ms`);
  if (errs.length) console.log('hata:', errs.slice(0, 3).join(' / '));
} catch (e) { console.error('HATA', e.message); code = 1; }
finally { await browser.close(); }
process.exit(code);
