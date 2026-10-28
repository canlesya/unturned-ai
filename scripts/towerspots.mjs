// 12.213 kule / yuva yeri arama (planlama betiği): node scripts/towerspots.mjs — bayrak çevresinde düz, yapısız, ağaçsız, yolsuz, bayrağı gören yerler
// KIND=tower (platform 4×4 + +x yönünde 6,6 m merdiven) | nest (4,8 × 4,4 kum torbası yuvası). FLAGS=A,B,...
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
const { buildKuzey } = await import('../src/maps/kuzey.js');
const { FLAGS, HQ } = await import('../src/maps/assets/kuzey/layout.js');
const { World } = await import('../src/game/collision.js');
const map = buildKuzey(), T = map.terrain, W = new World(map.colliders, map.bounds, T);
const want = (process.env.FLAGS || 'A,B,C,D,F,G').split(',');
const kind = process.env.KIND || 'tower';
const FP = kind === 'tower' ? [-2.6, 9.2, -2.6, 2.6] : [-2.8, 2.8, -2.6, 2.6];
const rot = (lx, lz, ry) => [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)];
function ok(x, z, ry) {
  const c = [[FP[0], FP[2]], [FP[1], FP[2]], [FP[0], FP[3]], [FP[1], FP[3]]].map(([a, b]) => { const [dx, dz] = rot(a, b, ry); return [x + dx, z + dz]; });
  const x0 = Math.min(...c.map((p) => p[0])), x1 = Math.max(...c.map((p) => p[0])), z0 = Math.min(...c.map((p) => p[1])), z1 = Math.max(...c.map((p) => p[1]));
  let hmin = 1e9, hmax = -1e9;
  for (let px = x0; px <= x1; px += 1) for (let pz = z0; pz <= z1; pz += 1) {
    const h = T.heightAt(px, pz); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
    if (T.roadAt(px, pz)) return null;
    if (T.slopeAt(px, pz, 0.6) > 0.3) return null;
  }
  if (hmax - hmin > 1.4) return null;
  for (const q of map.colliders) if (q.max[0] > x0 - 1.2 && q.min[0] < x1 + 1.2 && q.max[2] > z0 - 1.2 && q.min[2] < z1 + 1.2 && q.max[1] > T.heightAt((q.min[0] + q.max[0]) / 2, (q.min[2] + q.max[2]) / 2) + 0.15) return null;
  for (const s of map.sight) if (s[0] > x0 - s[3] - 1 && s[0] < x1 + s[3] + 1 && s[2] > z0 - s[3] - 1 && s[2] < z1 + s[3] + 1) return null;
  for (const v of map.vehicles) if (Math.hypot(v.x - x, v.z - z) < 14) return null;
  for (const o of map.objectives) if (Math.hypot(o.x - x, o.z - z) < (kind === 'tower' ? 18 : 10)) return null;
  return { hmin, hmax };
}
for (const id of want) {
  const f = FLAGS.find((q) => q.id === id), fy = T.heightAt(f.x, f.z), out = [];
  for (let k = 0; k < 5000; k++) {
    const a = Math.random() * Math.PI * 2, d = (kind === 'tower' ? 22 : 14) + Math.random() * (kind === 'tower' ? 40 : 34);
    const x = Math.round((f.x + Math.cos(a) * d) * 2) / 2, z = Math.round((f.z + Math.sin(a) * d) * 2) / 2;
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const r = ok(x, z, ry); if (!r) continue;
      const eye = { x, y: r.hmax + (kind === 'tower' ? 7.4 : 1.4), z }, tg = { x: f.x, y: fy + 1.2, z: f.z };
      if (!W.clear(eye, tg)) continue;
      let see = 0;
      for (const t of ['blue', 'red']) { const H = HQ[t], dd = Math.hypot(H.x - f.x, H.z - f.z); for (const L of [60, 110]) { const px = f.x + (H.x - f.x) / dd * L, pz = f.z + (H.z - f.z) / dd * L; if (W.clear(eye, { x: px, y: T.heightAt(px, pz) + 1.4, z: pz })) see++; } }
      out.push({ x, z, ry: +ry.toFixed(4), d: +d.toFixed(1), y: +r.hmax.toFixed(2), dh: +(r.hmax - r.hmin).toFixed(2), see, sc: see * 6 - Math.abs(d - 34) * 0.15 - (r.hmax - r.hmin) * 2 + (T.roadAt(x + 10, z) || T.roadAt(x - 10, z) || T.roadAt(x, z + 10) || T.roadAt(x, z - 10) ? 3 : 0) });
    }
  }
  out.sort((a, b) => b.sc - a.sc);
  const pick = []; for (const o of out) { if (pick.every((p) => Math.hypot(p.x - o.x, p.z - o.z) > 15)) pick.push(o); if (pick.length >= 3) break; }
  console.log(id, f.x, f.z, JSON.stringify(pick));
}
