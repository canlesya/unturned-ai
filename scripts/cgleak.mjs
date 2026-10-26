// Harita dışına sızma denetimi: T doğuşundan yürünebilen hücrelerden plan ızgarasının DIŞINA düşenleri listeler.  node scripts/cgleak.mjs
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { NavGrid } from '../src/game/nav.js';
import { GRID } from '../src/maps/assets/colgecidi/plan.js';            // 12.171: oynanış alanı = plan ızgarası (eski radar kapsamı)
const m = buildColGecidi(); const nav = (m.makeNav ? m.makeNav() : new NavGrid(m.colliders, m.bounds, m.terrain, !!m.layered));
const b = m.spawns.blue[0], seen = nav.reachable(b.x, b.z);
const X0 = GRID.x0, Z0 = GRID.z0, X1 = X0 + GRID.nx * GRID.cell, Z1 = Z0 + GRID.nz * GRID.cell;
console.log('plan ızgarası x', X0.toFixed(1), '…', X1.toFixed(1), ' z', Z0.toFixed(1), '…', Z1.toFixed(1), ' sınırlar', JSON.stringify(m.bounds));
let out = 0; const rows = new Map();
for (let i = 0; i < seen.length; i++) {
  if (!seen[i]) continue;
  const x = nav.cx(i), z = nav.cz(i);
  if (x < X0 - 0.01 || x > X1 + 0.01 || z < Z0 - 0.01 || z > Z1 + 0.01) { out++; const k = (z > Z1 ? 'güney' : z < Z0 ? 'kuzey' : x > X1 ? 'doğu' : 'batı') + ' ' + Math.round(z / 4) * 4 + ',' + Math.round(x / 4) * 4; rows.set(k, (rows.get(k) || 0) + 1); }
}
console.log('dışarıdaki erişilebilir hücre', out); console.log([...rows.entries()].slice(0, 30).map(([k, v]) => k + ':' + v).join('  '));
