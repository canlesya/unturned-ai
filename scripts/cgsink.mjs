// Gömülme denetimi: yürünebilir hücrelerde oyuncunun ayağı (fizik) ile çizilen zemin ağı (üçgen) arasındaki fark + kasa / duvar içinde durma.  node scripts/cgsink.mjs x0 z0 x1 z1
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { NavGrid } from '../src/game/nav.js';
const [x0, z0, x1, z1] = process.argv.slice(2).map(Number);
const m = buildColGecidi(); const t = m.terrain; const nav = new NavGrid(m.colliders, m.bounds, t, !!m.layered);
const b = m.spawns.blue[0], seen = nav.reachable(b.x, b.z);
// çizilen ağ yüksekliği: köşe değerlerinden üçgen (terrain.js buildMesh ile aynı kural), bağımsız hesap
const hv = (i, j) => t.h[j * t.nx + i];
const mesh = (x, z) => { const fx = (x - t.minX) / t.cell, fz = (z - t.minZ) / t.cell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j; const a = hv(i, j), bb = hv(i + 1, j), c = hv(i, j + 1), d = hv(i + 1, j + 1);
  if ((i + j) & 1) return u + v <= 1 ? a + (bb - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (bb - d) * (1 - v); return u >= v ? a + (bb - a) * u + (d - bb) * v : a + (d - c) * u + (c - a) * v; };
let n = 0, worst = 0, wp = '', inside = 0; const ip = [];
for (let z = z0; z <= z1; z += 0.25) for (let x = x0; x <= x1; x += 0.25) {
  const i = nav.idx(x, z); if (!seen[i]) continue; n++;
  const d = Math.abs(t.heightAt(x, z) - mesh(x, z)); if (d > worst) { worst = d; wp = `${x},${z}`; }
  for (const c of m.colliders) { if (x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2] && c.max[1] > t.heightAt(x, z) + 0.45 && c.min[1] < t.heightAt(x, z) + 1.2) { inside++; if (ip.length < 6) ip.push(`(${x},${z}:${c.tag})`); break; } }
}
console.log(`yürünebilir ${n} nokta · fizik↔ağ en büyük fark ${worst.toFixed(3)} m @${wp} · engelin içinde durulan nokta ${inside}`, ip.join(' '));
