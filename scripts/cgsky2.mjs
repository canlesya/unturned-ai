// Gökyüzü sızıntısı: bölgedeki yürünebilir hücrelerden 8 yöne yukarı (eğim 60° ve 75°) ışın atar; gökyüzüne ulaşanlar sızıntıdır.  node scripts/cgsky2.mjs x0 z0 x1 z1
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { World } from '../src/game/collision.js';
import { NavGrid } from '../src/game/nav.js';
import * as THREE from 'three';
const [x0, z0, x1, z1] = process.argv.slice(2).map(Number);
const m = buildColGecidi(); const w = new World(m.colliders, m.bounds, m.terrain); const nav = new NavGrid(m.colliders, m.bounds, m.terrain, !!m.layered);
const b = m.spawns.blue[0], seen = nav.reachable(b.x, b.z);
let leak = 0, tot = 0; const cells = new Map();
for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) {
  const i = nav.idx(x, z); if (!seen[i]) continue;
  const y = (nav.floor ? nav.floorAt(x, z) : m.terrain.heightAt(x, z)) + 1.7;
  for (const el of [60, 75, 90]) for (let a = 0; a < 8; a++) {
    const e = (el * Math.PI) / 180, az = (a * Math.PI) / 4, d = new THREE.Vector3(Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az));
    tot++;
    if (!w.raycast(new THREE.Vector3(x, y, z), d, 60, {})) { leak++; const k = `${x},${z}`; cells.set(k, (cells.get(k) || 0) + 1); }
  }
}
console.log(`ışın ${tot}, gökyüzüne ulaşan ${leak} (${((100 * leak) / tot).toFixed(1)}%), sızdıran hücre ${cells.size}`, [...cells.entries()].slice(0, 12).map(([k, v]) => `(${k}):${v}`).join(' '));
