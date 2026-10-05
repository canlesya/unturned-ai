// İki nokta arası görüş hattı: hangi çarpışma kutuları keser?  node scripts/cglos.mjs x0 y0 z0 x1 y1 z1
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { World } from '../src/game/collision.js';
import * as THREE from 'three';
const [x0, y0, z0, x1, y1, z1] = process.argv.slice(2).map(Number);
const m = buildColGecidi(); const w = new World(m.colliders, m.bounds, m.terrain);
const o = new THREE.Vector3(x0, y0, z0), tgt = new THREE.Vector3(x1, y1, z1), d = tgt.clone().sub(o), L = d.length(); d.normalize();
let pos = o.clone(), left = L, n = 0;
while (left > 0.05 && n++ < 12) {
  const h = w.raycast(pos, d, left, {});
  if (!h) { console.log('görüş açık (kalan', left.toFixed(1), 'm)'); break; }
  const c = h.collider; console.log('engel @', h.point.x.toFixed(1), h.point.y.toFixed(1), h.point.z.toFixed(1), c ? c.tag + ' ' + JSON.stringify([c.min.map((v) => +v.toFixed(1)), c.max.map((v) => +v.toFixed(1))]) : 'zemin');
  pos = h.point.clone().addScaledVector(d, 0.3); left = L - pos.distanceTo(o);
  if (!c) break;
}
