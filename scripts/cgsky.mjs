// Tünel çatısı denetimi: verilen bölgedeki yürünebilir hücrelerin tepesi açık mı (gökyüzü görünüyor mu)?  node scripts/cgsky.mjs x0 z0 x1 z1
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { World } from '../src/game/collision.js';
import { NavGrid } from '../src/game/nav.js';
import * as THREE from 'three';
const [x0, z0, x1, z1] = process.argv.slice(2).map(Number);
const m = buildColGecidi(); const w = new World(m.colliders, m.bounds, m.terrain); const nav = new NavGrid(m.colliders, m.bounds, m.terrain, !!m.layered);
const b = m.spawns.blue[0], seen = nav.reachable(b.x, b.z); const up = new THREE.Vector3(0, 1, 0);
let open = 0, tot = 0; const pts = [];
for (let z = z0; z <= z1; z += 0.5) for (let x = x0; x <= x1; x += 0.5) {
  const i = nav.idx(x, z); if (!seen[i]) continue; tot++;
  const y = nav.floor ? nav.floorAt(x, z) : m.terrain.heightAt(x, z);
  if (!w.raycast(new THREE.Vector3(x, y + 1.8, z), up, 30, {})) { open++; if (pts.length < 8) pts.push(`(${x},${z})`); }
}
console.log(`yürünebilir ${tot} hücre, tepesi açık ${open}`, pts.join(' '));
