// 12.234 FramePacer benzetimi (tarayıcısız): sanal saatte ekran yenilemesi (60 / 120 / 144 / 240 Hz), rAF geri çağrısı yenilemeden 0–1,5 ms sonra
// gelir; zaman damgası ya yenileme anı (Chromium) ya da geri çağrı anı (oynak: Electron'da 120 Hz'de 6,7–10,3 ms ölçüldü). Çizilen karelerin ekran
// karesi aralıkları + kamera adımı (dtFix) çıkar → "kaç karede bir, düzenli mi, kaçan kare var mı".
//   import { simulate } from './lib/pacesim.mjs'; await simulate({ hz: 144, fps: 30, snap: false, secs: 5, jitterTs: true })
let T = 0, seq = 0;
const Q = [];
const push = (t, fn) => { Q.push({ t, fn, s: seq++ }); };
const g = globalThis;
const realPerf = g.performance;
Object.defineProperty(g, 'performance', { configurable: true, value: { now: () => T } });
let HZ = 60, JTS = false, rnd = 1;
const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
let rafId = 0; const rafs = new Map();
g.requestAnimationFrame = (f) => { const id = ++rafId; const P = 1000 / HZ; const vs = (Math.floor(T / P + 1e-9) + 1) * P; const at = vs + rand() * 1.5; rafs.set(id, true); push(at, () => { if (!rafs.delete(id)) return; f(JTS ? at : vs); }); return id; };
g.cancelAnimationFrame = (id) => { rafs.delete(id); };
let tmId = 0; const tms = new Map();
const realST = g.setTimeout, realCT = g.clearTimeout;
const { FramePacer } = await import('../../src/framePace.js');

export async function simulate({ hz = 60, fps = 60, snap = true, secs = 5, jitterTs = false, seed = 7 } = {}) {
  HZ = hz; JTS = jitterTs; rnd = seed; T = 0; Q.length = 0; rafs.clear(); tms.clear();
  g.setTimeout = (f, ms = 0) => { const id = ++tmId; tms.set(id, true); push(T + Math.max(1, ms) + rand(), () => { if (tms.delete(id)) f(); }); return id; };
  g.clearTimeout = (id) => { tms.delete(id); };
  const draws = [], steps = [], owner = {};
  let last = 0;
  const p = new FramePacer(owner, (now) => { const vs = Math.round(T / (1000 / hz) - 0.5 + 1e-6); draws.push(vs); if (last) steps.push(p.dtFix(now - last)); last = now; }, () => fps, { snap, name: 'sim' });
  p.start();
  const end = secs * 1000;
  while (Q.length && T < end) { Q.sort((a, b) => a.t - b.t || a.s - b.s); const e = Q.shift(); T = Math.max(T, e.t); e.fn(); }
  p.dispose();
  g.setTimeout = realST; g.clearTimeout = realCT;
  const iv = []; for (let i = 1; i < draws.length; i++) iv.push(draws[i] - draws[i - 1]);           // ekran karesi cinsinden aralık
  const w = iv.slice(10), st = steps.slice(10);                                                        // ölçüm oturduktan sonra
  const hist = {}; for (const x of w) hist[x] = (hist[x] || 0) + 1;
  const av = (x) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length), sd = (x) => { const m = av(x); return Math.sqrt(av(x.map((v) => (v - m) ** 2))); };
  const mode = +Object.entries(hist).sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
  return { hz, fps, snap, drawnFps: +(w.length / ((w.reduce((a, b) => a + b, 0) || 1) / hz)).toFixed(1), hist, mode, uneven: w.filter((x) => x !== mode).length, n: w.length,
    sdMs: +(sd(w) * 1000 / hz).toFixed(2), stepCV: +(sd(st) / (av(st) || 1)).toFixed(4) };
}
export const restorePerf = () => Object.defineProperty(g, 'performance', { configurable: true, value: realPerf });
