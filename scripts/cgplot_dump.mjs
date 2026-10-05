// Bölge üstten görünüm verisi (arazi yüksekliği + çarpışma kutuları) → JSON.  node scripts/cgplot_dump.mjs x0 z0 x1 z1 > out.json
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
const [x0, z0, x1, z1] = process.argv.slice(2).map(Number);
const m = buildColGecidi();
const H = [];
for (let z = z0; z <= z1; z += 0.25) { const r = []; for (let x = x0; x <= x1; x += 0.25) r.push(+m.terrain.heightAt(x, z).toFixed(2)); H.push(r); }
const C = m.colliders.filter((c) => c.max[0] > x0 && c.min[0] < x1 && c.max[2] > z0 && c.min[2] < z1).map((c) => [c.min, c.max, c.tag || '']);
console.log(JSON.stringify({ x0, z0, x1, z1, H, C, callouts: m.callouts }));
