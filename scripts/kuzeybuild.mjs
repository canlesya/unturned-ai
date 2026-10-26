// Kuzey Vadisi (12.172) başsız kurulum ölçümü: süre + bellek (sunucu yolu: MapBuilder.noVisual) + nav ızgarası + örnek yollar.
//   node --expose-gc scripts/kuzeybuild.mjs        (VIS=1: görsel kurulum da — tarayıcı dışı, yalnız süre)
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = !process.env.VIS;
const { buildKuzey } = await import('../src/maps/kuzey.js');
const { NavGrid } = await import('../src/game/nav.js');
global.gc?.(); const m0 = process.memoryUsage();
const t0 = performance.now(); const m = buildKuzey(); const t1 = performance.now();
const t2 = performance.now(); const nav = new NavGrid(m.colliders, m.bounds, m.terrain, false, m.navCell); const t3 = performance.now();
global.gc?.(); const m1 = process.memoryUsage();
const out = { buildMs: Math.round(t1 - t0), navMs: Math.round(t3 - t2), heapMB: +((m1.heapUsed - m0.heapUsed) / 1e6).toFixed(1), rssMB: +((m1.rss - m0.rss) / 1e6).toFixed(1), nav: nav.w + 'x' + nav.h, ...m.stats };
const a = performance.now(); const cm = nav.comps(0.7); out.compsMs = Math.round(performance.now() - a);
const paths = {};
for (const team of ['blue', 'red']) for (const f of m.objectives) {
  const s = m.spawns[team][0], q0 = performance.now(), q = nav.findPath(s.x, s.z, f.x, f.z);
  let L = 0; if (q) { let px = s.x, pz = s.z; for (const p of q) { L += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; } }
  paths[team[0] + '→' + f.id] = q ? `${Math.round(L)} m / ${(performance.now() - q0).toFixed(1)} ms` : 'YOK';
}
out.paths = paths; out.spawns = [m.spawns.blue.length, m.spawns.red.length];
console.log(JSON.stringify(out, null, 1));
