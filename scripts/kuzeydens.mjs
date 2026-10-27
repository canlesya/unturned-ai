// Kuzey Vadisi doluluk haritası (12.182): yapı kutuları + görüş küreleri (ağaç / çalı / buğday) + yollar + bayraklar → JSON (+ kuzeydens.py → PNG).
//   node scripts/kuzeydens.mjs çıktı.json && python3 scripts/kuzeydens.py çıktı.json çıktı.png
// "Açık hücre" ölçüsü: 20 m'lik örnek noktaların (yol hariç) kaçında ~15 m içinde hiç örtü (≥ 0,9 m yapı / ağaç / çalı / buğday) yok.
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
const { buildKuzey } = await import('../src/maps/kuzey.js');
const m = buildKuzey(), T = m.terrain;
const N = 400, S = 4, h = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h.push(+T.heightAt(-800 + i * S, -800 + j * S).toFixed(1));
const cols = m.colliders.map((c) => [c.min[0], c.min[2], c.max[0], c.max[2], c.max[1] - c.min[1]].map((v) => +v.toFixed(1)));
const sight = m.sight.map((s) => [Math.round(s[0]), Math.round(s[2]), +s[3].toFixed(1)]);
const G = 10, grid = new Set(), put = (x, z) => grid.add(Math.floor(x / G) + ',' + Math.floor(z / G));
for (const c of m.colliders) if (c.max[1] - c.min[1] > 0.9) for (let x = c.min[0]; x <= c.max[0] + G; x += G) for (let z = c.min[2]; z <= c.max[2] + G; z += G) put(Math.min(x, c.max[0]), Math.min(z, c.max[2]));
for (const s of m.sight) put(s[0], s[2]);
let open = 0, tot = 0;
for (let z = -760; z < 760; z += 20) for (let x = -760; x < 760; x += 20) {
  if (T.roadAt(x, z)) continue; tot++;
  let hit = false;
  for (let dz = -1; dz <= 1 && !hit; dz++) for (let dx = -1; dx <= 1 && !hit; dx++) if (grid.has((Math.floor(x / G) + dx) + ',' + (Math.floor(z / G) + dz))) hit = true;
  if (!hit) open++;
}
const out = { N, S, h, cols, sight, roads: m.roadGraph, flags: m.objectives, stats: { ...m.stats, openPct: +(100 * open / tot).toFixed(1), totCells: tot } };
fs.writeFileSync(process.argv[2] || '/tmp/wb-kzfill/dens.json', JSON.stringify(out));
console.log(JSON.stringify(out.stats));
