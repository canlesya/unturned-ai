// Çöl Geçidi: iki doğuş merkezinden yol mesafesi farkı haritası → adil hedef (bayrak) yerleri.  node scripts/cgdist.mjs
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { NavGrid } from '../src/game/nav.js';
const m = buildColGecidi();
const nav = new NavGrid(m.colliders, m.bounds, m.terrain, false);
const W = nav.w, H = nav.h, C = 0.5;
const mean = (a) => [a.reduce((s, p) => s + p.x, 0) / a.length, a.reduce((s, p) => s + p.z, 0) / a.length];
const field = (sx, sz) => {                                           // Dijkstra (8 komşu)
  const d = new Float64Array(W * H).fill(1e9), s = nav.nearestFree(sx, sz, 30);
  if (s < 0) throw new Error('başlangıç noktası serbest değil ' + sx + ',' + sz);
  d[s] = 0; const q = [[0, s]];
  const heap = []; const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { let a = 2 * i + 1, b = a + 1, k = i; if (a < heap.length && heap[a][0] < heap[k][0]) k = a; if (b < heap.length && heap[b][0] < heap[k][0]) k = b; if (k === i) break; [heap[k], heap[i]] = [heap[i], heap[k]]; i = k; } } return t; };
  push([0, s]);
  let guard = 0;
  while (heap.length) {
    if (++guard > 5e6) throw new Error("döngü sınırı " + heap.length);
    const [dd, i] = pop(); if (dd > d[i]) continue;
    const x = i % W, z = (i / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const j = nz * W + nx; if (nav.blocked[j]) continue;
      if (dx && dz && (nav.blocked[z * W + nx] || nav.blocked[nz * W + x])) continue;
      const nd = dd + (dx && dz ? 1.4142 : 1) * C; if (nd < d[j]) { d[j] = nd; push([nd, j]); }
    }
  }
  return d;
};
const [bx, bz] = mean(m.spawns.blue), [rx, rz] = mean(m.spawns.red);
const dT = field(bx, bz), dC = field(rx, rz);
const pt = (n, x, z) => { const i = nav.nearestFree(x, z); return `${n}: T ${dT[i].toFixed(0)} m · CT ${dC[i].toFixed(0)} m`; };
for (const o of m.objectives) console.log(pt(o.id, o.x, o.z));
// adil aday bölgeler: |fark| küçük, iki taraf da 35–110 m
const cand = [];
for (let i = 0; i < W * H; i++) if (!nav.blocked[i] && dT[i] < 1e8 && dC[i] < 1e8 && Math.abs(dT[i] - dC[i]) < 5 && dT[i] > 35 && dT[i] < 110 && dC[i] > 35 && dC[i] < 110) cand.push(i);
console.log('adil aday hücre', cand.length);
const cl = []; // kaba kümeleme (8 m)
for (const i of cand) { const x = nav.cx(i), z = nav.cz(i); const c = cl.find((k) => Math.hypot(k.x - x, k.z - z) < 9); if (c) { c.n++; c.x += (x - c.x) / c.n; c.z += (z - c.z) / c.n; } else cl.push({ x, z, n: 1 }); }
console.log(cl.filter((c) => c.n > 30).sort((a, b) => b.n - a.n).slice(0, 12).map((c) => `(${c.x.toFixed(0)},${c.z.toFixed(0)}) n${c.n}`).join('  '));
if (process.env.VIZ) {
  const { chromium } = await import('playwright');
  const cv = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { let c = [40, 34, 28]; if (!nav.blocked[i] && dT[i] < 1e8) { const f = Math.max(-1, Math.min(1, (dT[i] - dC[i]) / 40)); c = f < 0 ? [255 + f * 150, 255 + f * 100, 255] : [255, 255 - f * 150, 255 - f * 150]; } cv.set([...c, 255], i * 4); }
  const mk = (x, z, c) => { const i = nav.idx(x, z); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) cv.set([...c, 255], (i + dz * W + dx) * 4); };
  for (const o of m.objectives) mk(o.x, o.z, [0, 0, 0]);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: W * 3, height: H * 3 } });
  await pg.setContent(`<body style="margin:0"><canvas id=c width=${W} height=${H} style="width:${W * 3}px;height:${H * 3}px;image-rendering:pixelated"></canvas></body>`);
  await pg.evaluate(([d, W, H]) => { document.getElementById('c').getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d), W, H), 0, 0); }, [Array.from(cv), W, H]);
  await pg.screenshot({ path: 'screenshots/cg-dist.png' }); await b.close();
}
process.exit(0);
