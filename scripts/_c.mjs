import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
const m = buildColGecidi();
const [x0, z0, x1, z1] = process.argv.slice(2).map(Number);
for (const c of m.colliders) if (c.max[0] >= x0 && c.min[0] <= x1 && c.max[2] >= z0 && c.min[2] <= z1 && c.max[1] - m.terrain.heightAt((c.min[0]+c.max[0])/2,(c.min[2]+c.max[2])/2) > 0.3) console.log(c.tag, c.min.map((v) => v.toFixed(2)).join(','), '→', c.max.map((v) => v.toFixed(2)).join(','));
