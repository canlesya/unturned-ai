// Kuzey Vadisi (12.172) kuşbakışı plan verisi: arazi (4 m örnek) + yüzey + yollar / nehir / bayraklar / doğuşlar / araç / heliped / yapı izleri → JSON.
//   node scripts/kuzeyplan.mjs /tmp/wb-buyuk/plan.json && python3 scripts/kuzeyplan.py /tmp/wb-buyuk/plan.json /tmp/wb-buyuk/taslak/plan.png
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
const { KuzeyTerrain } = await import('../src/maps/assets/kuzey/terrain.js');
const L = await import('../src/maps/assets/kuzey/layout.js');
const { buildKuzey } = await import('../src/maps/kuzey.js');
const m = buildKuzey(), T = new KuzeyTerrain({ visual: true }), N = 401, S = 4;
const h = [], sf = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -800 + i * S, z = -800 + j * S; h.push(+T.heightAt(x, z).toFixed(2)); sf.push(T.surfAt(x, z)); }
const big = m.colliders.filter((c) => c.max[1] - c.min[1] > 2 && (c.max[0] - c.min[0]) * (c.max[2] - c.min[2]) > 6 && c.tag !== 'deck').map((c) => [c.min[0], c.min[2], c.max[0], c.max[2]].map((v) => +v.toFixed(1)));
const { NavGrid } = await import('../src/game/nav.js');
const nav = new NavGrid(m.colliders, m.bounds, m.terrain, false, m.navCell), paths = {};
for (const team of ['blue', 'red']) for (const f of m.objectives) {
  const s = m.spawns[team][0], q = nav.findPath(s.x, s.z, f.x, f.z);
  let len = 0; if (q) { let px = s.x, pz = s.z; for (const p of q) { len += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; } }
  paths[team[0] + f.id] = q ? Math.round(len) : 'yok';
}
m.stats.paths = paths;
const out = {
  N, S, h, sf, roads: m.roadGraph, river: L.RIVER, lake: L.LAKE, fords: L.FORDS, bridges: L.BRIDGES, dam: L.DAM, flags: m.objectives, hq: L.HQ, pads: L.PADS,
  spawns: m.spawns, helipads: L.HELIPADS, vehicles: L.VEHICLES, tdm: L.TDM_AREA, callouts: L.CALLOUTS, forest: L.FOREST_ZONES, fields: L.FIELDS, hedges: L.HEDGES, loot: m.lootSpots, big, wires: m.wires.map(([a, b]) => [a[0], a[2], b[0], b[2]]),
  stats: m.stats,
};
fs.writeFileSync(process.argv[2] || '/tmp/wb-buyuk/plan.json', JSON.stringify(out));
console.log('ok', out.big.length, 'yapı kutusu');
