// 12.211 World.raycast (ızgara DDA) eskisiyle aynı mı: rastgele ışınlar (asker gözünden / harita noktalarından, 1–700 m) eski sınır kutusu taramasıyla
// karşılaştırılır (t ve kutu). node scripts/raycmp.mjs [harita=kuzey] [ışın=20000]
import { Game } from '../src/game/game.js';
import * as THREE from 'three';
const map = process.argv[2] || 'kuzey', N = +(process.argv[3] || 20000);
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 16, type: 'conquest', time: 900 } });
const W = g.world;
function oldRay(o, d, maxT = 300, skipTag = null) {
  let best = maxT, bc = null;
  const inv = [1 / (d.x || 1e-9), 1 / (d.y || 1e-9), 1 / (d.z || 1e-9)];
  const ex = o.x + d.x * maxT, ez = o.z + d.z * maxT;
  const list = W.query(Math.min(o.x, ex) - 0.1, Math.min(o.z, ez) - 0.1, Math.max(o.x, ex) + 0.1, Math.max(o.z, ez) + 0.1, []);
  for (const c of list) {
    if (skipTag && c.tag === skipTag) continue;
    let t0 = 0, t1 = best;
    const oo = [o.x, o.y, o.z];
    for (let a = 0; a < 3; a++) {
      let ta = (c.min[a] - oo[a]) * inv[a], tb = (c.max[a] - oo[a]) * inv[a];
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 < best && t1 > 0) { best = t0; bc = c; }
  }
  return { t: best, c: bc };
}
const cols = W.colliders;
let bad = 0, tOld = 0, tNew = 0;
const o = new THREE.Vector3(), d = new THREE.Vector3(), out = {};
for (let i = 0; i < N; i++) {
  if (i % 3 === 0) { const s = g.soldiers[i % g.soldiers.length]; o.copy(s.pos); o.y += 1.6; }
  else if (i % 3 === 1) { const c = cols[Math.floor(rnd() * cols.length)]; o.set(c.min[0] - 5 + rnd() * (c.max[0] - c.min[0] + 10), c.min[1] + rnd() * (c.max[1] - c.min[1] + 4), c.min[2] - 5 + rnd() * (c.max[2] - c.min[2] + 10)); }
  else { const b = g.map.bounds || { minX: -500, maxX: 500, minZ: -500, maxZ: 500 }; o.set((b.minX ?? -500) + rnd() * ((b.maxX ?? 500) - (b.minX ?? -500)), 0, (b.minZ ?? -500) + rnd() * ((b.maxZ ?? 500) - (b.minZ ?? -500))); o.y = W.heightAt(o.x, o.z) + 0.5 + rnd() * 6; }
  d.set(rnd() * 2 - 1, (rnd() * 2 - 1) * (i % 5 === 0 ? 1 : 0.15), rnd() * 2 - 1).normalize();
  if (i % 97 === 0) d.set(0, -1, 0);
  if (i % 89 === 0) d.set(1, 0, 0);
  const maxT = [5, 30, 120, 300, 700][i % 5], tag = i % 2 ? 'wood' : null;
  // yalnız kutular (arazi aynı kod): arazisiz karşılaştırma için geçici olarak kapat
  const T = W.terrain; W.terrain = null;
  let t = performance.now(); const a = oldRay(o, d, maxT, tag); tOld += performance.now() - t;
  t = performance.now(); const b = W.raycast(o, d, maxT, out, tag); tNew += performance.now() - t;
  W.terrain = T;
  // arazisiz World.raycast d.y < 0'da y = 0 düzlemini de sınar: eskisini de aynı kurala getir
  let at = a.t, ac = a.c; if (d.y < -1e-6) { const tg = -o.y / d.y; if (tg > 0 && tg < at) { at = tg; ac = null; } }
  const bt = b ? b.t : maxT, bcol = b ? b.collider : null;
  if (Math.abs(at - bt) > 1e-6 || (at < maxT && ac !== bcol && Math.abs(at - bt) > 1e-9)) { bad++; if (bad < 6) console.log('FARK', i, at, bt, ac?._i, bcol?._i, maxT, o.toArray().map((v) => +v.toFixed(2)), d.toArray().map((v) => +v.toFixed(3))); }
}
console.log(`${map}: ${N} ışın, kutu ${cols.length}, fark ${bad} · eski ${(tOld * 1000 / N).toFixed(1)} µs / ışın, yeni ${(tNew * 1000 / N).toFixed(1)} µs`);
process.exit(bad ? 1 : 0);
