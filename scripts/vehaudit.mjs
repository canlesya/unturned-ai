// Araç çakışma denetimi: araçlar birbirine ve binalara/props'a girmiyor mu?  node scripts/vehaudit.mjs [harita...]
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const made = []; const orig = MapBuilder.prototype.vparts;
MapBuilder.prototype.vparts = function (...a) { if (!made.includes(this)) made.push(this); return orig.apply(this, a); };
const corners = (v) => { const c = Math.cos(v.ry), s = Math.sin(v.ry); return [[v.hl, v.hw], [v.hl, -v.hw], [-v.hl, -v.hw], [-v.hl, v.hw]].map(([x, z]) => [v.x + x * c + z * s, v.z - x * s + z * c]); };
const axes = (P) => [0, 1].map((i) => { const a = P[i], b = P[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [-dz / l, dx / l]; });
const proj = (P, ax) => { let lo = 1e9, hi = -1e9; for (const p of P) { const d = p[0] * ax[0] + p[1] * ax[1]; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
// m: en az bu kadar (m) iç içe girme sayılır (küçük temaslar yok sayılır)
const overlap = (P, Q, m = 0.12) => { for (const ax of [...axes(P), ...axes(Q)]) { const a = proj(P, ax), b = proj(Q, ax); if (Math.min(a[1], b[1]) - Math.max(a[0], b[0]) < m) return false; } return true; };
const box = (c) => [[c.min[0], c.min[2]], [c.max[0], c.min[2]], [c.max[0], c.max[2]], [c.min[0], c.max[2]]];
let total = 0;
for (const id of (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAPS))) {
  made.length = 0; const m = MAPS[id].build(); const b = made[0];
  if (!b) { console.log(id, 'araç yok'); continue; }
  const V = b.vehicles.map((v) => ({ ...v, P: corners(v) })); let bad = 0;
  for (let i = 0; i < V.length; i++) {
    for (let j = i + 1; j < V.length; j++) if (overlap(V[i].P, V[j].P)) { bad++; console.log(`  ${id}: ${V[i].kind}(${V[i].x.toFixed(1)},${V[i].z.toFixed(1)}) ↔ ${V[j].kind}(${V[j].x.toFixed(1)},${V[j].z.toFixed(1)})`); }
    for (const c of b.colliders) {
      if (c.tag === 'veh' || c.tag === 'deck' || c.min[1] > 2.2 || c.max[1] < 0.2) continue;
      if (c.max[0] - c.min[0] > 150 || c.max[2] - c.min[2] > 150) continue;
      if (overlap(V[i].P, box(c))) { bad++; console.log(`  ${id}: ${V[i].kind}(${V[i].x.toFixed(1)},${V[i].z.toFixed(1)}) ↔ engel [${c.min.map((x) => x.toFixed(1))}]..[${c.max.map((x) => x.toFixed(1))}]`); }
    }
  }
  console.log(`${id}: ${V.length} araç, ${bad} çakışma`); total += bad;
}
process.exit(total ? 1 : 0);
