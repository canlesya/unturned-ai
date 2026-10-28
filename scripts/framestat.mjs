// 12.222 Kare süresi / takılma ölçümü (istemci): rAF kare aralığı (ort / p95 / p99 / en çok, >33 / >50 ms sayısı), uzun görevler,
// DOM düğüm sayısı + DOM değişikliği / sn (MutationObserver), JS yığını, renderer.info (çizim, üçgen, geometri, doku, program) zamanla.
//   node scripts/framestat.mjs [menu|match|online] [saniye=60]      URL=http://127.0.0.1:8990  MAP=colgecidi SIZE=3v3 TYPE=tdm  PROF=1 (CDP CPU profili, en çok öz-süre)
//   VW / VH / DPR (görüntü alanı, varsayılan 1600x900 @1) · HEADFUL=1 (görünür pencere) · GPU=swiftshader · JSON=1 (son satır özet JSON) · Q='&x=1' (URL'ye ek)
import { chromium } from 'playwright';
const scen = process.argv[2] || 'match', secs = +(process.argv[3] || 60);
const base = process.env.URL || 'http://127.0.0.1:8990';
const map = process.env.MAP || 'colgecidi', size = process.env.SIZE || '3v3', type = process.env.TYPE || 'tdm';
const gpu = process.env.GPU === 'swiftshader' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ headless: !process.env.HEADFUL, args: [...gpu, '--enable-precise-memory-info', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
let exitCode = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: +(process.env.VW || 1600), height: +(process.env.VH || 900) }, deviceScaleFactor: +(process.env.DPR || 1), locale: 'tr-TR' });
  await ctx.addInitScript(() => {
    const W = (window.__fs = { ft: [], lt: [], mut: 0, mutBy: {} });
    let last = 0;
    const f = (t) => { if (last) W.ft.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) W.lt.push([performance.now(), e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* yok */ }
    const startMO = () => {
      new MutationObserver((recs) => {
        W.mut += recs.length;
        for (const r of recs) {
          let el = r.target.nodeType === 1 ? r.target : r.target.parentElement, k = '';
          for (let i = 0; el && i < 4 && !k; i++, el = el.parentElement) k = el.id ? '#' + el.id : '';
          k = (k || (r.target.parentElement?.className?.toString?.().split(' ')[0] || r.target.nodeName)) + ':' + r.type[0];
          W.mutBy[k] = (W.mutBy[k] || 0) + 1;
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    };
    if (document.documentElement) startMO(); else document.addEventListener('DOMContentLoaded', startMO);
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const url = scen === 'menu' ? `${base}/?nolock=1${process.env.Q || ''}` : scen === 'online' ? `${base}/?online=${process.env.ROOM || 'new'}&name=Perf&map=${map}&type=${type}&per=${parseInt(size)}&dev=1&debug=1&nolock=1${process.env.Q || ''}` : `${base}/?autostart=${size}&map=${map}&type=${type}&dev=1&debug=1&nolock=1${process.env.Q || ''}`;
  await page.goto(url, { waitUntil: 'load' });
  if (scen === 'menu') await page.waitForTimeout(6000);
  else { await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier && window.__game.playerSoldier.alive', null, { timeout: 240000 }); await page.waitForTimeout(3000);
    await page.evaluate(() => { const g = window.__game; if (!g.net) g.devGod = true;
      const r = g.renderer, ro = r.render.bind(r); window.__fs.calls = 0; window.__fs.tris = 0; window.__fs.rn = 0;
      r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) { const W = window.__fs; W.calls += r.info.render.calls; W.tris += r.info.render.triangles; W.rn++; } }; }); }
  const PROF = !!process.env.PROF;
  if (PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start'); }
  await page.evaluate(() => { const W = window.__fs; W.ft.length = 0; W.lt.length = 0; W.mut = 0; W.mutBy = {}; W.t0 = performance.now(); });
  const rows = [], STEP = 10;
  const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0;
  for (let t = STEP; t <= secs; t += STEP) {
    // oyuncuyu canlı tut / hareket ettir (kamera dönsün): maçta her adımda biraz dön
    await page.waitForTimeout(STEP * 1000);
    const r = await page.evaluate(() => {
      const W = window.__fs, ft = W.ft.splice(0), _x = 0, lt = W.lt.splice(0), mut = W.mut, mutBy = W.mutBy; W.mut = 0; W.mutBy = {};
      const g = window.__game, i = g?.renderer?.info;
      return { ft, lt: lt.map((x) => x[1]), mut, mutTop: Object.entries(mutBy).sort((a, b) => b[1] - a[1]).slice(0, 6),
        dom: document.getElementsByTagName('*').length, heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0,
        gl: i ? { calls: Math.round(W.calls / Math.max(1, W.rn)), tris: Math.round(W.tris / Math.max(1, W.rn)), rn: W.rn, geo: i.memory.geometries, tex: i.memory.textures, prog: i.programs?.length } : null,
        alive: g?.playerSoldier?.alive, soldiers: g?.soldiers?.length, _r: (W.calls = 0, W.tris = 0, W.rn = 0) };
    });
    const a = [...r.ft].sort((x, y) => x - y), avg = r.ft.reduce((x, y) => x + y, 0) / Math.max(1, r.ft.length);
    const row = { t, n: r.ft.length, avg: +avg.toFixed(2), p95: +pct(a, 0.95).toFixed(1), p99: +pct(a, 0.99).toFixed(1), max: +(a[a.length - 1] || 0).toFixed(1),
      gt33: r.ft.filter((x) => x > 33).length, gt50: r.ft.filter((x) => x > 50).length, lt: r.lt.length, ltMax: +(Math.max(0, ...r.lt)).toFixed(0),
      dom: r.dom, mutPerS: +(r.mut / STEP).toFixed(0), heap: +r.heap.toFixed(0), gl: r.gl, mutTop: r.mutTop };
    rows.push(row);
    console.log(`t=${String(t).padStart(3)} kare ${row.n} ort ${row.avg} p95 ${row.p95} p99 ${row.p99} max ${row.max} | >33 ${row.gt33} >50 ${row.gt50} | uzun görev ${row.lt} (en ${row.ltMax}) | DOM ${row.dom} değişiklik/sn ${row.mutPerS} | yığın ${row.heap} MB`
      + (r.gl ? ` | çizim ${r.gl.calls} üçgen ${(r.gl.tris / 1e3).toFixed(0)}k geo ${r.gl.geo} doku ${r.gl.tex} prog ${r.gl.prog} sahne çizimi ${r.gl.rn}` : '') + `\n      DOM yazanlar: ${r.mutTop.map(([k, v]) => `${k} ${(v / STEP).toFixed(0)}/sn`).join(' · ')}`);
  }
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  const all = rows.reduce((s, r) => s + r.n, 0);
  const sum = { scen, map, size, type, secs, frames: all, avg: +(rows.reduce((s, r) => s + r.avg * r.n, 0) / all).toFixed(2), p95: Math.max(...rows.map((r) => r.p95)), p99: Math.max(...rows.map((r) => r.p99)),
    max: Math.max(...rows.map((r) => r.max)), gt33: rows.reduce((s, r) => s + r.gt33, 0), gt50: rows.reduce((s, r) => s + r.gt50, 0), lt: rows.reduce((s, r) => s + r.lt, 0),
    mutPerS: +(rows.reduce((s, r) => s + r.mutPerS, 0) / rows.length).toFixed(0), dom0: rows[0].dom, dom1: rows[rows.length - 1].dom, heap0: rows[0].heap, heap1: rows[rows.length - 1].heap,
    gl0: rows[0].gl, gl1: rows[rows.length - 1].gl, errs: errs.slice(0, 5) };
  console.log(`ÖZET ${scen} ${scen === 'match' ? `${map} ${size} ${type}` : ''}: ${all} kare, ort ${sum.avg} ms, p95≤${sum.p95} p99≤${sum.p99} max ${sum.max} | >33 ${sum.gt33} >50 ${sum.gt50} | uzun görev ${sum.lt} | DOM ${sum.dom0}→${sum.dom1} (${sum.mutPerS} değişiklik/sn) | yığın ${sum.heap0}→${sum.heap1} MB` + (errs.length ? ` | hata: ${errs.slice(0, 3).join(' / ')}` : ''));
  if (PROF) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map((n) => [n.id, n]));
    let tot = 0;
    profile.samples.forEach((id, i) => { const n = byId.get(id), cf = n.callFrame; const d = (dt[i] || 0) / 1000; if (/^\(idle\)$/.test(cf.functionName)) return; tot += d;
      const k = `${cf.functionName || '(anon)'}@${cf.url.split('/').pop().split('?')[0]}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + d); });
    console.log(`CPU (boşta hariç) ${tot.toFixed(0)} ms / ${secs * 1000} ms; en çok öz-süre:`);
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP || 25))) console.log(`  ${(v).toFixed(0).padStart(6)} ms ${(100 * v / tot).toFixed(1).padStart(5)}%  ${k}`);
  }
  if (process.env.JSON) console.log(JSON.stringify(sum));
} catch (e) { console.error('HATA', e.message); exitCode = 1; }
finally { await browser.close(); }
process.exit(exitCode);
