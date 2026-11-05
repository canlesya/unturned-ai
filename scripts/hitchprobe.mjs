// 12.232 Takılma avı (ölçüm sondası, regresyon testi değil): başsız (pw-quiet) Çöl Geçidi TDM maçında her rAF karesini kaydeder, uzun karelerde
// (> 25 ms) nedeni bulmaya çalışır: döngünün bölümleri (adım / çizim / HUD), yeni gölgelendirici programı, doku / geometri sayısı değişimi, yığın düşüşü (GC),
// o karede yayılan oyun olayları, Long Animation Frame (LoAF) betik kaynağı. Sonda dakika başına > 33 / > 50 ms kare, en uzun, 1% düşük.
//   node --import ./scripts/lib/pw-quiet.mjs scripts/hitchprobe.mjs [offline|online] [saniye=60]
//   URL=http://127.0.0.1:5199 WS=ws://127.0.0.1:8978 · SIZE=5v5 · TRACE=/tmp/x.json (CDP izi) · Q='&x=1'
import { chromium } from 'playwright';
const mode = process.argv[2] || 'offline', secs = +(process.argv[3] || 60);
const URL = process.env.URL || 'http://127.0.0.1:5199', WS = process.env.WS || 'ws://127.0.0.1:8978';
const size = process.env.SIZE || '5v5';
const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info', ...(process.env.UNCAP ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [])] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
if (process.env.GLT) await ctx.addInitScript(() => {
  // GLT=1: her WebGL çağrısını zamanla, > 3 ms süreni (eşzamanlı GPU beklemesi / derleme) yığın izinin kısa haliyle kaydet
  const slow = (window.__glslow = []), P = WebGL2RenderingContext.prototype;
  for (const k of Object.getOwnPropertyNames(P)) {
    const d = Object.getOwnPropertyDescriptor(P, k); if (typeof d.value !== 'function') continue;
    const f = d.value;
    P[k] = function (...a) { const t = performance.now(), r = f.apply(this, a), dt = performance.now() - t; if (dt > 3 && window.__hp?.on) slow.push({ t, k, dt: +dt.toFixed(1), st: (new Error().stack || '').split('\n').slice(2, 9).map((x) => x.trim().replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:]*/, '')).join(' < ') }); return r; };
  }
});
await ctx.addInitScript((DETAIL) => {
  const H = (window.__hp = { ft: [], loaf: [], lt: [], detail: DETAIL });
  let last = 0;
  const f = (t) => { if (last && H.on) H.ft.push([t, t - last]); last = t; requestAnimationFrame(f); };
  requestAnimationFrame(f);
  const loafOf = (e) => ({ t: e.startTime, d: e.duration, block: e.blockingDuration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, style: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0,
    scripts: (e.scripts || []).map((x) => ({ d: Math.round(x.duration), inv: x.invoker, src: (x.sourceURL || '').split('/').pop().split('?')[0] + ':' + (x.sourceFunctionName || ''), fwd: Math.round(x.forcedStyleAndLayoutDuration || 0) })) });
  try { new PerformanceObserver((l) => { if (H.on) for (const e of l.getEntries()) H.loaf.push(loafOf(e)); }).observe({ type: 'long-animation-frame' }); } catch { /* yok */ }
  try { new PerformanceObserver((l) => { if (H.on) for (const e of l.getEntries()) H.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' }); } catch { /* yok */ }
}, !!process.env.DETAIL);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const q = mode === 'online'
  ? `online=new&name=Perf&map=colgecidi&type=tdm&per=${parseInt(size)}&dev=1&debug=1&nolock=1&server=${encodeURIComponent(WS)}`
  : `autostart=${size}&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1&autoplay=1`;
await page.goto(`${URL}/?${q}${process.env.Q || ''}`);
await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier, null, { timeout: 120000 });
await page.waitForTimeout(2500);                                                     // açılış karesi / ilk snapshot geçsin
const cdp = process.env.TRACE ? await ctx.newCDPSession(page) : null;
if (cdp) await browser.startTracing(page, { path: process.env.TRACE, screenshots: false, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'v8.execute', 'disabled-by-default-v8.gc', 'gpu', 'blink.user_timing'] });
await page.evaluate(() => {
  const g = window.__game, H = window.__hp, r = g.renderer;
  g.devGod = true;
  const F = (H.cur = { parts: {}, ev: [] });
  H.frames = [];
  const wrap = (o, k, name) => { const f = o?.[k]; if (typeof f !== 'function') return; o[k] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const c = H.cur.parts; c[name] = (c[name] || 0) + performance.now() - t; } }; };
  wrap(g, 'step', 'step'); wrap(g, 'stepOnline', 'stepOnline'); wrap(g, 'render', 'render'); wrap(g.hud, 'update', 'hud'); wrap(g.effects, 'update', 'effects');
  wrap(g, 'updateBots', 'bots'); wrap(g.online, 'interpolate', 'interp'); wrap(g.online, 'onMessage', 'netMsg'); wrap(g.online, 'onSnap', 'snap'); wrap(g, 'onNetEvents', 'netEv');
  wrap(g.player?.vm, 'render', 'vmRender'); wrap(g.post, 'end', 'post');
  // adım içi ayrıntı (DETAIL=1): yol bulma, bot beyinleri, manga ataması, gözetleme noktası, mermiler, mod
  if (H.detail) {
    wrap(g.nav, 'findPath', 'findPath'); wrap(g, 'assignSquads', 'squads'); wrap(g, 'perch', 'perch'); wrap(g, 'updateProjectiles', 'proj'); wrap(g, 'updateMode', 'mode'); wrap(g.world, 'move', 'move'); wrap(g.player, 'update', 'player');
    for (const b of g.brains || []) wrap(b, 'tick', 'brains');
    const HP = Object.getPrototypeOf(g.hud);
    for (const k of Object.getOwnPropertyNames(HP)) { const d = Object.getOwnPropertyDescriptor(HP, k); if (typeof d.value !== 'function' || k === 'constructor' || k === 'update') continue; const f = d.value; HP[k] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const c = H.cur.parts, n = 'hud.' + k; c[n] = (c[n] || 0) + performance.now() - t; } }; }
    const B = g.brains?.[0] && Object.getPrototypeOf(g.brains[0]);
    if (B) for (const k of Object.getOwnPropertyNames(B)) if (typeof B[k] === 'function' && k !== 'constructor' && k !== 'tick') { const f = B[k]; B[k] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const c = H.cur.parts, n = 'bot.' + k; c[n] = (c[n] || 0) + performance.now() - t; } }; }
  }
  for (const b of g.brains || []) { /* bot beyinleri tek tek sarılmaz (çok); toplamı step içinde */ }
  const em = g.emit?.bind(g); if (em) g.emit = (n, ...a) => { H.cur.ev.push(n); return em(n, ...a); };
  // geç ilk kullanım: ön ısıtmada derlenip hiç çizilmemiş program (three onFirstUse → getProgramInfoLog = GPU'yu bekleyen eşzamanlı çağrı)
  H.late = [];
  const hook = (p) => { if (p.__h) return; p.__h = 1; const gu = p.getUniforms; let first = true; p.getUniforms = function () { if (first) { first = false; const t = performance.now(), u = gu.call(this); const dt = performance.now() - t; H.late.push({ at: +((t - H.t0) / 1000).toFixed(1), dt: +dt.toFixed(1), name: p.name, key: String(p.cacheKey).slice(0, 90) }); return u; } return gu.call(this); }; };
  // ön ısıtmada çizilmiş programlarda getUniforms önceden çağrılmış: sarmak zararsız (önbellekten döner, kayıt yalnız ilk çağrıda)
  for (const p of r.info.programs) { const cached = (() => { try { return p.getUniforms.toString().includes('cachedUniforms'); } catch { return false; } })(); hook(p); }
  H.hook = hook;
  const rbd = r.renderBufferDirect.bind(r);
  const desc = (o, m) => { const ch = []; for (let x = o, i = 0; x && i < 6; x = x.parent, i++) ch.push((x.name || x.type) + (x.userData && Object.keys(x.userData).length ? '{' + Object.keys(x.userData).slice(0, 3).join(',') + '}' : '')); return `${m.type}${m.transparent ? ' saydam' : ''}${m.map ? ' doku' : ''}${m.vertexColors ? ' vc' : ''}${m.fog === false ? ' sissiz' : ''} blend${m.blending} · ${ch.join(' < ')}`; };
  r.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) { const n0 = r.info.programs.length, t = performance.now(); const out = rbd(cam, sc, geo, mat, obj, grp); const dt = performance.now() - t; if (dt > 8) H.late.push({ at: +((t - H.t0) / 1000).toFixed(1), dt: +dt.toFixed(1), draw: desc(obj, mat), newProg: r.info.programs.length - n0 }); return out; };
  const loop = g.loop;
  g.loop = function (now, draw) {
    if (draw === false) return loop.call(this, now, draw);
    const p0 = r.info.programs?.length || 0, tx0 = r.info.memory.textures, ge0 = r.info.memory.geometries, h0 = performance.memory?.usedJSHeapSize || 0, t = performance.now();
    H.cur = { parts: {}, ev: [] };
    loop.call(this, now, draw);
    const d = performance.now() - t, h1 = performance.memory?.usedJSHeapSize || 0;
    if ((r.info.programs?.length || 0) > p0) for (const p of r.info.programs.slice(p0)) { H.late.push({ at: +((t - H.t0) / 1000).toFixed(1), dt: +d.toFixed(1), name: p.name, key: String(p.cacheKey).slice(0, 90), created: 1 }); }
    H.frames.push({ t, now, d, parts: H.cur.parts, ev: H.cur.ev, prog: (r.info.programs?.length || 0) - p0, tex: r.info.memory.textures - tx0, geo: r.info.memory.geometries - ge0, heap: h1, dh: h1 - h0 });
    if (H.frames.length > 20000) H.frames.splice(0, 5000);
  };
  // sarmalayıcı bir sonraki karede devrede: eski döngü rAF(this.loop), 12.232 FramePacer da this.loop'u her karede yeniden okur
  H.on = true; H.t0 = performance.now(); H.ft.length = 0; H.loaf.length = 0; H.lt.length = 0;
});
// çevrim içi: oyuncu ara ara yürüsün / dönsün (kamera hareketi)
const t0 = Date.now();
while (Date.now() - t0 < secs * 1000) {
  if (mode === 'online') { await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW'); await page.mouse.move(700 + Math.random() * 200, 400); }
  await page.waitForTimeout(mode === 'online' ? 500 : 2000);
}
if (cdp) await browser.stopTracing();
const res = await page.evaluate(() => {
  const H = window.__hp, el = (performance.now() - H.t0) / 1000;
  const ft = H.ft.map((x) => x[1]);
  const s = [...ft].sort((a, b) => a - b), n = s.length, m = Math.max(1, Math.round(n * 0.01));
  const low1 = s.slice(n - m).reduce((a, b) => a + b, 0) / m;
  const avg = ft.reduce((a, b) => a + b, 0) / Math.max(1, n), sd = Math.sqrt(ft.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, n));
  // uzun rAF aralıklarını döngü kayıtlarıyla eşle (aralığın sonunda biten kare → o karenin döngüsü bir önceki kareyi uzatmış olabilir: aralık içine düşen döngüler)
  const long = [];
  for (const [t, d] of H.ft) {
    if (d <= 33) continue;
    const fr = H.frames.filter((f) => f.t >= t - d - 1 && f.t <= t + 1);
    const lf = H.loaf.filter((l) => l.t >= t - d - 5 && l.t <= t + 5);
    // GC: aralıktaki karelerin yığını bir öncekinden ≥ 2 MB düşük mü
    let gc = 0; for (const f of fr) if (f.dh < -2e6) gc += f.dh;
    long.push({ at: +((t - H.t0) / 1000).toFixed(1), d: +d.toFixed(1), loops: fr.map((f) => ({ d: +f.d.toFixed(1), parts: Object.fromEntries(Object.entries(f.parts).filter(([, v]) => v > 1).map(([k, v]) => [k, +v.toFixed(1)])), ev: [...new Set(f.ev)].slice(0, 8), prog: f.prog, tex: f.tex, geo: f.geo, dh: +(f.dh / 1e6).toFixed(1) })), gcMB: +(gc / 1e6).toFixed(1),
      loaf: lf.map((l) => ({ d: Math.round(l.d), render: Math.round(l.render), style: Math.round(l.style), scripts: l.scripts.filter((x) => x.d > 2).slice(0, 4) })) });
  }
  // yığın testere dişi: kare başına ayırma (artışların toplamı / süre)
  let alloc = 0, drops = 0, dropMB = 0;
  for (let i = 1; i < H.frames.length; i++) { const dh = H.frames[i].heap - H.frames[i - 1].heap; if (dh > 0) alloc += dh; else if (dh < -1e6) { drops++; dropMB += -dh / 1e6; } }
  const progNew = H.frames.filter((f) => f.prog > 0).map((f) => ({ at: +((f.t - H.t0) / 1000).toFixed(1), prog: f.prog, d: +f.d.toFixed(1), ev: [...new Set(f.ev)].slice(0, 6) }));
  const loopMs = H.frames.map((f) => f.d).sort((a, b) => a - b);
  return { el, n, avg: +avg.toFixed(2), sd: +sd.toFixed(2), max: +(s[n - 1] || 0).toFixed(1), low1Ms: +low1.toFixed(1), low1Fps: +(1000 / low1).toFixed(1),
    gt33: ft.filter((x) => x > 33).length, gt50: ft.filter((x) => x > 50).length, perMin33: +(ft.filter((x) => x > 33).length / el * 60).toFixed(1), perMin50: +(ft.filter((x) => x > 50).length / el * 60).toFixed(1),
    loopP99: +(loopMs[Math.floor(loopMs.length * 0.99)] || 0).toFixed(2), loopMax: +(loopMs[loopMs.length - 1] || 0).toFixed(1),
    allocMBs: +(alloc / 1e6 / el).toFixed(1), allocKBframe: +(alloc / 1e3 / Math.max(1, H.frames.length)).toFixed(1), gcDrops: drops, gcDropMB: +dropMB.toFixed(0),
    topLoops: [...H.frames].sort((a, b) => b.d - a.d).slice(0, 8).map((f) => ({ at: +((f.t - H.t0) / 1000).toFixed(1), d: +f.d.toFixed(1), parts: Object.fromEntries(Object.entries(f.parts).filter(([, v]) => v > 0.5).map(([k, v]) => [k, +v.toFixed(1)])), ev: [...new Set(f.ev)].slice(0, 6), dhMB: +(f.dh / 1e6).toFixed(1) })),
    warm: window.__game.warm, late: H.late.filter((x) => x.created || x.dt > 1), lt: H.lt.length, ltMax: Math.round(Math.max(0, ...H.lt.map((x) => x[1]))), progNew, long: long.slice(0, 40), programs: window.__game.renderer.info.programs.length };
});
console.log(`ÖZET ${mode} ${secs}s (ön ısıtma ${JSON.stringify(res.warm)}): kare ${res.n} ort ${res.avg} ms (sd ${res.sd}) | >33 ${res.gt33} (${res.perMin33}/dk) >50 ${res.gt50} (${res.perMin50}/dk) | en uzun ${res.max} | 1% düşük ${res.low1Ms} ms (${res.low1Fps} FPS) | döngü p99 ${res.loopP99} en ${res.loopMax} ms | ayırma ${res.allocMBs} MB/sn (${res.allocKBframe} KB/kare), yığın düşüşü ${res.gcDrops} (${res.gcDropMB} MB) | uzun görev ${res.lt} (en ${res.ltMax}) | program ${res.programs}`);
console.log('en uzun döngüler:'); for (const x of res.topLoops) console.log('  ' + JSON.stringify(x));
if (res.late.length) console.log('geç program:', JSON.stringify(res.late));
if (res.progNew.length) console.log('yeni program:', JSON.stringify(res.progNew));
for (const l of res.long) console.log(JSON.stringify(l));
if (process.env.GLT) { const sl = await page.evaluate(() => window.__glslow); const by = {}; for (const x of sl) { const k = x.k; (by[k] ||= { n: 0, ms: 0 }); by[k].n++; by[k].ms += x.dt; } console.log('yavaş GL çağrıları:', JSON.stringify(by)); for (const x of sl.sort((a, b) => b.dt - a.dt).slice(0, 12)) console.log(`  ${x.dt} ms ${x.k} @${((x.t) / 1000).toFixed(1)}s  ${x.st}`); }
if (errs.length) console.log('sayfa hatası:', errs.slice(0, 5));
if (process.env.JSON) console.log('JSON ' + JSON.stringify({ ...res, long: undefined, progNew: res.progNew.length }));
await page.evaluate(() => removeEventListener('beforeunload', window.__game?._bu));
await browser.close();
