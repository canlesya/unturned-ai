// Harita yapı denetimi (tarayıcısız):  node scripts/mapaudit.mjs [harita...]   (varsayılan: hepsi)
//   1) YÜKSEK ÇARPIŞMASIZ DÖŞEME: yerden ≥0,9 m yüksekte, alanı ≥1 m², ince (≤0,5 m) ama çarpışması olmayan kutu (içinden geçilen zemin/merdiven sahanlığı adayı)
//   2) ÇATI: çarpışması olmayan prizma (içine girilebilen çatı)
//   3) İÇ İÇE YAPI: farklı kutularda yatayda ≥0,6 m, dikeyde ≥1 m ortak hacim (iki duvar/yapı iç içe)
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const site = () => (new Error().stack.split('\n').slice(3, 12).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l)).slice(0, 2).map((l) => l.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '')).join(' < '));
const suspects = [], prisms = [];
const _box = MapBuilder.prototype.box, _prism = MapBuilder.prototype.prism;
const worldY = (b, y) => new THREE.Vector3(0, y, 0).applyMatrix4(b.M).y;
MapBuilder.prototype.box = function (x, y, z, w, h, d, color, opt = {}) {
  if (opt.collide === false && h <= 0.5 && w * d >= 1.0 && !(opt.o && (opt.o.transparent || opt.o.glow))) {
    const wp = new THREE.Vector3(x, y, z).applyMatrix4(this.M);
    if (wp.y >= 0.9) suspects.push({ at: `${wp.x.toFixed(1)},${wp.y.toFixed(1)},${wp.z.toFixed(1)}`, size: `${w.toFixed(1)}x${h.toFixed(2)}x${d.toFixed(1)}`, site: site() });
  }
  return _box.call(this, x, y, z, w, h, d, color, opt);
};
MapBuilder.prototype.prism = function (x, y, z, w, h, d, color, opt = {}) {
  const wp = new THREE.Vector3(x, y, z).applyMatrix4(this.M);
  prisms.push({ at: `${wp.x.toFixed(1)},${wp.y.toFixed(1)},${wp.z.toFixed(1)}`, size: `${w.toFixed(1)}x${h.toFixed(1)}x${d.toFixed(1)}`, site: site() });
  return _prism.call(this, x, y, z, w, h, d, color, opt);
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAPS);
let total = 0;
for (const id of ids) {
  suspects.length = 0; prisms.length = 0;
  const m = MAPS[id].build();
  const C = m.colliders.filter((c) => c.tag !== 'veh' && c.tag !== 'roof' && c.tag !== 'deck' && c.max[0] - c.min[0] < 120 && c.max[2] - c.min[2] < 120);
  const pairs = [];
  for (let i = 0; i < C.length; i++) {
    const a = C[i]; if (a.max[1] - a.min[1] < 1.8) continue;
    for (let j = i + 1; j < C.length; j++) {
      const b = C[j]; if (b.max[1] - b.min[1] < 1.8) continue;
      const px = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
      const pz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
      const py = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
      if (px >= 0.6 && pz >= 0.6 && py >= 1.0) pairs.push({ x: ((Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2).toFixed(1), z: ((Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2).toFixed(1), pen: `${px.toFixed(1)}x${pz.toFixed(1)}x${py.toFixed(1)}`, a: `${a.min.map((v) => v.toFixed(1))}..${a.max.map((v) => v.toFixed(1))}`, b: `${b.min.map((v) => v.toFixed(1))}..${b.max.map((v) => v.toFixed(1))}` });
    }
  }
  console.log(`\n=== ${id}: ${m.colliders.length} kutu · çarpışmasız yüksek döşeme ${suspects.length} · çatı prizması ${prisms.length} · iç içe yapı ${pairs.length}`);
  if (process.env.V) {
    const by = (arr) => { const o = {}; for (const s of arr) o[s.site] = (o[s.site] || 0) + 1; return Object.entries(o).sort((a, b) => b[1] - a[1]); };
    console.log('-- çarpışmasız döşeme kaynakları:'); for (const [k, n] of by(suspects).slice(0, 25)) console.log(`  ${n}×  ${k}`);
    console.log('-- kalın (>=0.18) çarpışmasız yüksek döşemeler:'); for (const x of suspects.filter((q) => +q.size.split('x')[1] >= 0.18)) console.log('  ', x.at, x.size, x.site);
    console.log('-- çatı prizmaları:'); for (const [k, n] of by(prisms).slice(0, 25)) console.log(`  ${n}×  ${k}`);
    console.log('-- iç içe yapılar:'); for (const p of pairs.slice(0, 40)) console.log(`  (${p.x},${p.z}) ${p.pen}  A[${p.a}]  B[${p.b}]`);
  }
  total += pairs.length;
}
