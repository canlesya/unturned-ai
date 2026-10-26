// Vadi sızıntı ayrıntısı (12.169): fizik yürüyücüleri (vadiscan ile aynı) — bir kutunun içine girenin kutusunu, son adımlarını ve çevresindeki kutuları yazar.
//   node scripts/vadileak.mjs [WALK=800] [N=8]
import * as THREE from 'three';
import { MapBuilder, makeRng } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
import { NavGrid } from '../src/game/nav.js';
import { World, R as BODY_R } from '../src/game/collision.js';
MapBuilder.noVisual = true;
const m = MAPS.vadi.build(), C = m.colliders, T = m.terrain;
const world = new World(C, m.bounds, T), nav = new NavGrid(C, m.bounds, T, !!m.layered);
const sb = m.spawns.blue[0], seen = nav.reachable(sb.x, sb.z);
const free = []; for (let i = 0; i < seen.length; i += 7) if (seen[i]) free.push(i);
const rng = makeRng(99), NW = +(process.env.WALK || 800), NS = +(process.env.N || 8);
const f = (v) => v.map((q) => q.toFixed(2)).join(',');
let shown = 0;
for (let w = 0; w < NW && shown < NS; w++) {
  const i = free[Math.floor(rng() * free.length)];
  const s = { pos: new THREE.Vector3(nav.cx(i), 0, nav.cz(i)), vel: new THREE.Vector3(), height: 1.78, onGround: true };
  world.settle(s); s.onCollider = s.pos.y > T.heightAt(s.pos.x, s.pos.z) + 0.001;
  let yaw = rng() * 6.283; const hist = []; let un = 0;
  for (let st = 0; st < 30 * 12; st++) {
    if (st % 45 === 0) yaw += (rng() - 0.5) * 2.5;
    const sp = rng() < 0.3 ? 8.4 : 5.6;
    s.vel.x = Math.sin(yaw) * sp; s.vel.z = Math.cos(yaw) * sp;
    if (s.onGround && rng() < 0.04) s.vel.y = 5.2;
    world.move(s, 1 / 30);
    const p = s.pos; hist.push([p.x, p.y, p.z]); if (hist.length > (process.env.ROOF ? 40 : 4)) hist.shift();
    const c = C.find((c) => p.x + BODY_R - 0.05 > c.min[0] && p.x - BODY_R + 0.05 < c.max[0] && p.z + BODY_R - 0.05 > c.min[2] && p.z - BODY_R + 0.05 < c.max[2] && p.y + 1.6 > c.min[1] + 0.05 && p.y + 0.1 < c.max[1] - 0.05);
    un = p.y < T.heightAt(p.x, p.z) - 0.3 ? un + 1 : 0;
    if (process.env.ROOF && s.onGround) { const rc = C.find((q) => q.tag === 'roof' && p.x > q.min[0] && p.x < q.max[0] && p.z > q.min[2] && p.z < q.max[2] && Math.abs(p.y - q.max[1]) < 0.05); if (rc) { shown++; console.log(`\n#${w} ÇATI ${rc.oid} ayak ${f([p.x, p.y, p.z])}\n  yol: ${hist.filter((_, i) => i % 3 === 0).map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' → ')}`); break; } }
    if (un >= 3 && !c) {
      shown++;
      console.log(`\n#${w} ARAZİ ALTI ayak ${f([p.x, p.y, p.z])} · zemin ${T.heightAt(p.x, p.z).toFixed(2)} · son adımlar ${hist.map(f).join(' | ')}`);
      for (const q of C) if (p.x + 1 > q.min[0] && p.x - 1 < q.max[0] && p.z + 1 > q.min[2] && p.z - 1 < q.max[2] && p.y + 2 > q.min[1] && p.y - 0.5 < q.max[1]) console.log('   yakın', q.oid, q.tag || '', f(q.min), '…', f(q.max));
      break;
    }
    if (c) {
      shown++;
      console.log(`\n#${w} içinde ${c.oid} ${c.tag || ''} kutu ${f(c.min)} … ${f(c.max)} · ayak ${f([p.x, p.y, p.z])} · zemin ${T.heightAt(p.x, p.z).toFixed(2)} · son adımlar ${hist.map(f).join(' | ')}`);
      for (const q of C) if (q !== c && p.x + 1 > q.min[0] && p.x - 1 < q.max[0] && p.z + 1 > q.min[2] && p.z - 1 < q.max[2] && p.y + 2 > q.min[1] && p.y - 0.5 < q.max[1]) console.log('   yakın', q.oid, q.tag || '', f(q.min), '…', f(q.max));
      break;
    }
  }
}
