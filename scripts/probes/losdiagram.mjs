// Doğuş görüş hattı diyagramı (Node): kuş bakışı plan + doğuş noktalarından 360° göz hizası (1.62 m) ışın yelpazesi.
// Çıktı: ImageMagick MVG dosyası → `convert -size WxH xc:#e8e6df mvg:OUT.mvg OUT.png`
// Kullanım: node scripts/probes/losdiagram.mjs [harita] [out.mvg]
import fs from 'fs';
import * as THREE from 'three';
import { MAPS } from '../../src/maps/index.js';
import { World } from '../../src/game/collision.js';

const id = process.argv[2] || 'kasaba';
const out = process.argv[3] || '/tmp/los.mvg';
const map = MAPS[id].build();
const world = new World(map.colliders, map.bounds, map.terrain || null);
const S = 6, b = map.bounds, PAD = 10;
const W = Math.round((b.maxX - b.minX) * S + PAD * 2), H = Math.round((b.maxZ - b.minZ) * S + PAD * 2);
const X = (x) => PAD + (x - b.minX) * S, Z = (z) => PAD + (z - b.minZ) * S;
const L = [];
L.push(`push graphic-context`, `fill '#7a7f86'`, 'stroke none');
for (const c of map.colliders) {
  if (c.max[1] < 0.5 || c.min[1] > 1.8) continue;
  const w = c.max[0] - c.min[0], d = c.max[2] - c.min[2];
  if (w > 60 || d > 60) continue;
  L.push(`rectangle ${X(c.min[0]).toFixed(1)},${Z(c.min[2]).toFixed(1)} ${X(c.max[0]).toFixed(1)},${Z(c.max[2]).toFixed(1)}`);
}
// ışın yelpazeleri: her takımdan 6 doğuş noktası, 2° adım
const o = new THREE.Vector3(), d = new THREE.Vector3();
let maxFree = 0;
for (const [team, col] of [['blue', '#2b6fd6'], ['red', '#d63a2b']]) {
  const sp = map.spawns[team];
  const pick = sp.filter((_, i) => i % Math.ceil(sp.length / 6) === 0);
  L.push(`stroke '${col}'`, 'stroke-opacity 0.22', 'stroke-width 1');
  for (const s of pick) {
    o.set(s.x, 1.62, s.z);
    for (let a = 0; a < 360; a += 2) {
      const r = (a * Math.PI) / 180; d.set(Math.sin(r), 0, -Math.cos(r));
      const h = world.raycast(o, d, 400, {});
      let t = h ? h.t : 400;
      // sınıra kırp
      let tb = 1e9;
      if (d.x > 1e-6) tb = Math.min(tb, (b.maxX - o.x) / d.x); else if (d.x < -1e-6) tb = Math.min(tb, (b.minX - o.x) / d.x);
      if (d.z > 1e-6) tb = Math.min(tb, (b.maxZ - o.z) / d.z); else if (d.z < -1e-6) tb = Math.min(tb, (b.minZ - o.z) / d.z);
      t = Math.min(t, tb); maxFree = Math.max(maxFree, t);
      L.push(`line ${X(s.x).toFixed(1)},${Z(s.z).toFixed(1)} ${X(s.x + d.x * t).toFixed(1)},${Z(s.z + d.z * t).toFixed(1)}`);
    }
  }
  L.push('stroke none', 'stroke-opacity 1', `fill '${col}'`);
  for (const s of sp) L.push(`circle ${X(s.x).toFixed(1)},${Z(s.z).toFixed(1)} ${(X(s.x) + 3).toFixed(1)},${Z(s.z).toFixed(1)}`);
}
// hedefler
L.push(`fill none`, `stroke '#222'`, 'stroke-width 2');
for (const ob of map.objectives) L.push(`circle ${X(ob.x).toFixed(1)},${Z(ob.z).toFixed(1)} ${(X(ob.x) + ob.r * S).toFixed(1)},${Z(ob.z).toFixed(1)}`);
if (map.baseZones) { L.push(`stroke '#1a8a3a'`, 'stroke-width 3'); for (const z of Object.values(map.baseZones)) L.push(`rectangle ${X(z.minX)},${Z(z.minZ)} ${X(z.maxX)},${Z(z.maxZ)}`); }
L.push('pop graphic-context');
fs.writeFileSync(out, L.join('\n'));
console.log(`${W}x${H} ${out} (en uzun açık hat ${maxFree.toFixed(0)} m)`);
