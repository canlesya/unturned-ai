import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { NavGrid } from '../src/game/nav.js';
const m = buildColGecidi(); const nav = new NavGrid(m.colliders, m.bounds, m.terrain, false);
const [ax, az, bx, bz] = process.argv.slice(2).map(Number);
const p = nav.findPath(ax, az, bx, bz, 1.2); let L = 0; const pts = [];
for (let i = 0; i < p.length; i++) { if (i) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); if (i % 8 === 0) pts.push(`(${p[i].x.toFixed(0)},${p[i].z.toFixed(0)})`); }
console.log(L.toFixed(0) + ' m', pts.join(' '));
