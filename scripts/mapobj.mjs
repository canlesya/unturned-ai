// Nesne (yapı/prop) ↔ nesne örtüşmesi:  node scripts/mapobj.mjs [harita] [yatay=0.35] [dikey=0.5]
// Her çarpışma kutusu, onu üreten DÜZEN çağrısına (vadi.js/us.js/kasaba.js/dev.js içindeki ilk çağrı yeri: dosya:satır:sütun) bağlanır.
// Farklı düzen çağrılarından gelen kutuların yatayda ≥yatay, dikeyde ≥dikey içe girmesi "iç içe yapı" sayılır (aynı çağrının kendi parçaları sayılmaz).
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const LAYOUT = /(vadi|us|kasaba|dev|vadiLayout)\.js:\d+:\d+/;
const lay = () => { const f = new Error().stack.split('\n').map((l) => l.trim()).find((l) => LAYOUT.test(l)); const m = f && f.match(/((?:vadi|us|kasaba|dev|vadiLayout)\.js:\d+:\d+)/); return m ? m[1] : 'harita'; };
const _aabb = MapBuilder.prototype._aabb;
MapBuilder.prototype._aabb = function (...a) { const n = this.colliders.length; _aabb.apply(this, a); if (this.colliders.length > n) this.colliders[n].lay = lay(); };
const id = process.argv[2] || 'vadi', HX = +(process.argv[3] || 0.35), HY = +(process.argv[4] || 0.5);
const m = MAPS[id].build();
const C = m.colliders.filter((c) => c.tag !== 'deck' && c.tag !== 'roof' && c.lay && c.lay !== 'harita' && c.max[1] - c.min[1] >= 0.4 && c.max[0] - c.min[0] < 60 && c.max[2] - c.min[2] < 60);
C.sort((a, b) => a.min[0] - b.min[0]);
const pairs = new Map();
for (let i = 0; i < C.length; i++) {
  const a = C[i];
  for (let j = i + 1; j < C.length && C[j].min[0] < a.max[0] - HX; j++) {
    const b = C[j];
    if (a.lay === b.lay) continue;
    const px = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
    const pz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    const py = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
    if (px < HX || pz < HX || py < HY) continue;
    const key = [a.lay, b.lay].sort().join('  ×  ');
    const e = pairs.get(key) || { n: 0, at: `${((Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2).toFixed(1)},${((Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2).toFixed(1)}`, pen: 0 };
    e.n++; e.pen = Math.max(e.pen, Math.min(px, pz)); pairs.set(key, e);
  }
}
console.log(`${id}: ${C.length} kutu, ${pairs.size} iç içe nesne çifti`);
for (const [k, e] of [...pairs].sort((a, b) => b[1].pen - a[1].pen).slice(0, +(process.env.TOP || 60))) console.log(`  ${k}   örn. (${e.at}) içe girme ≤${e.pen.toFixed(2)} m, ${e.n} kutu çifti`);
process.exit(pairs.size ? 1 : 0);
