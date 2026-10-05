// Çöl Geçidi görüş hattı uzunlukları (kural: çoğu < 70 m, en uzunu ≤ ~85 m).  node scripts/cgsight.mjs
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import * as THREE from 'three';
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { NavGrid } from '../src/game/nav.js';
import { World } from '../src/game/collision.js';
const m = buildColGecidi(), nav = new NavGrid(m.colliders, m.bounds, m.terrain, !!m.layered), w = new World(m.colliders, m.bounds, m.terrain);
const base = m.spawns.blue[0], seen = nav.reachable(base.x, base.z);
const pts = []; for (let i = 0; i < nav.w * nav.h; i += 7) if (!nav.blocked[i] && seen[i]) pts.push([nav.cx(i), nav.cz(i)]);
const o = new THREE.Vector3(), d = new THREE.Vector3(), L = [];
let best = { t: 0 };
for (const [x, z] of pts) {
  o.set(x, m.terrain.heightAt(x, z) + 1.6, z);
  let mx = 0;
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; d.set(Math.cos(a), 0, Math.sin(a)); const h = w.raycast(o, d, 160, {}); const t = h ? h.t : 160; if (t > mx) mx = t; if (t > best.t) best = { t, x, z, a }; }
  L.push(mx);
}
L.sort((a, b) => a - b); const q = (p) => L[Math.floor(L.length * p)].toFixed(0);
console.log(`örnek ${L.length} nokta · en uzun görüş: medyan ${q(0.5)} m · %90 ${q(0.9)} m · %99 ${q(0.99)} m · en çok ${best.t.toFixed(0)} m @(${best.x.toFixed(0)},${best.z.toFixed(0)})`);
process.exit(0);
