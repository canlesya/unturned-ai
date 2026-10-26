// Vadi plan görüntüsü (12.169): arazi gölgelemesi + su + düzlükler + patikalar + çarpışma kutuları + doğuş / hedef → JSON (vadiplan.py çizer)
//   node scripts/vadiplan.mjs [OUT=/tmp/wb-vadi/plan.json] [TERRAIN_ONLY=1]
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
const L = await import('../src/maps/assets/vadi/layout.js');
const OUT = process.env.OUT || '/tmp/wb-vadi/plan.json';
let m = null;
if (!process.env.TERRAIN_ONLY) { const { MAPS } = await import('../src/maps/index.js'); m = MAPS.vadi.build(); }
L.finalizeLayout();
const H = m ? (x, z) => m.terrain.heightAt(x, z) : L.vadiHeight;
const S = 0.5, X0 = -100, X1 = 100, Z0 = -70, Z1 = 70, nx = (X1 - X0) / S, nz = (Z1 - Z0) / S, h = [];
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h.push(+H(X0 + (i + 0.5) * S, Z0 + (j + 0.5) * S).toFixed(2));
const trails = L.TRAILS.map((t) => ({ name: t.name, w: t.w, p: t.p }));
const out = {
  X0, Z0, S, nx, nz, h, water: L.WATER_LEVEL, pads: L.PADS, trails,
  cols: m ? m.colliders.filter((c) => c.max[0] - c.min[0] < 60).map((c) => [c.min[0], c.min[2], c.max[0], c.max[2], c.tag || '', c.min[1], c.max[1]]) : [],
  spawns: m ? m.spawns : null, obj: m ? m.objectives : [], bounds: L.BOUNDS, callouts: m ? m.callouts || [] : [],
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('yazıldı', OUT, nx, nz);
