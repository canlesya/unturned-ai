// Cephe Hattı doğuş aşamaları istatistiği (12.161):  node scripts/frontstages.mjs — etkin nokta başına iki takımın doğuş sayısı / uzaklığı, noktadan görünen, üs bölgesi ∩ nokta, A* yürüme yolu
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
MapBuilder.noVisual = true;
const g = new Game(null, { headless: true, map: 'cephe', diff: 'normal', match: { perTeam: 1, type: 'front', time: 1200 }, bots: false });
const m = g.map, T = m.terrain, W = g.world, O = m.objectives;
const a = new THREE.Vector3(), b = new THREE.Vector3();
m.front.stages.forEach((S, i) => {
  const o = O[i];
  const st = (pts) => { const d = pts.map((p) => Math.hypot(p.x - o.x, p.z - o.z)).sort((x, y) => x - y); return `${pts.length} nokta, uzaklık ${d[0]?.toFixed(0)}–${d[d.length - 1]?.toFixed(0)} (orta ${d[d.length >> 1]?.toFixed(0)})`; };
  const vis = (pts) => { let v = 0; for (const p of pts) { b.set(p.x, T.heightAt(p.x, p.z) + 1.62, p.z); let s = false; for (const [dx, dz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]]) { a.set(o.x + dx, T.heightAt(o.x + dx, o.z + dz) + 1.62, o.z + dz); if (W.clear(a, b)) s = true; } if (s) v++; } return v; };
  const zin = (z) => !z ? "YOK" : O.filter((q) => q.x + q.r > z.minX && q.x - q.r < z.maxX && q.z + q.r > z.minZ && q.z - q.r < z.maxZ).map((q) => q.id).join(',');
  console.log(`${i} ${o.id}: Mavi ${st(S.blue)} görünen ${vis(S.blue)} bölge∩${zin(S.zones.blue)} | Kırmızı ${st(S.red)} görünen ${vis(S.red)} bölge∩${zin(S.zones.red)}`);
});
// yürüme yolu uzunluğu (nav A*): her takımın doğuşlarından etkin noktaya (8 örnek, orta değer)
const plen = (p, o) => { const P = g.nav.findPath(p.x, p.z, o.x, o.z); if (!P) return NaN; let L = 0, x = p.x, z = p.z; for (const q of P) { L += Math.hypot(q.x - x, q.z - z); x = q.x; z = q.z; } return L; };
m.front.stages.forEach((S, i) => {
  const o = O[i], med = (pts) => { const L = pts.filter((_, k) => k % Math.max(1, Math.floor(pts.length / 8)) === 0).map((p) => plen(p, o)).sort((a, b) => a - b); return `${L[L.length >> 1]?.toFixed(0)} m (${L[0]?.toFixed(0)}–${L[L.length - 1]?.toFixed(0)})`; };
  console.log(`yol ${i} ${o.id}: Mavi ${med(S.blue)} · Kırmızı ${med(S.red)}`);
});
