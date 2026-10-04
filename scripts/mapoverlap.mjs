// Katı hacim örtüşmesi (iç içe geçen çarpışma kutuları), kaynak çiftlerine göre gruplu:  node scripts/mapoverlap.mjs [harita] [min=0.08]
// Her çarpışma kutusuna oluşturulduğu yer (dosya:satır) yazılır; 3 eksende de ≥min örtüşen çiftler "kaynakA × kaynakB" olarak sayılır.
// Aynı kaynak çifti çok tekrarlanıyorsa genelde bilinçli (duvar köşesi, direk-duvar); az ve alışılmadık çiftler hatadır (ör. merdiven × döşeme).
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const site = () => (new Error().stack.split('\n').slice(3, 14).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l)).slice(0, 2).map((l) => l.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '').replace(/:\d+$/, '')).join(' < '));
const _aabb = MapBuilder.prototype._aabb;
MapBuilder.prototype._aabb = function (...a) { const n = this.colliders.length; _aabb.apply(this, a); if (this.colliders.length > n) this.colliders[n].site = site(); };
const id = process.argv[2] || 'kasaba', MIN = +(process.argv[3] || 0.08);
const m = MAPS[id].build();
const C = m.colliders.filter((c) => c.tag !== 'veh' && c.tag !== 'roof' && c.tag !== 'deck' && c.max[0] - c.min[0] < 120 && c.max[2] - c.min[2] < 120 && c.max[1] - c.min[1] > 0.05);
C.sort((a, b) => a.min[0] - b.min[0]);
const groups = new Map();
for (let i = 0; i < C.length; i++) {
  const a = C[i];
  for (let j = i + 1; j < C.length && C[j].min[0] < a.max[0] - MIN; j++) {
    const b = C[j];
    const px = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
    const py = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
    const pz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    if (px < MIN || py < MIN || pz < MIN) continue;
    const key = [a.site || '?', b.site || '?'].sort().join('  ×  ');
    const g = groups.get(key) || { n: 0, at: `${((Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2).toFixed(1)},${((Math.max(a.min[1], b.min[1]) + Math.min(a.max[1], b.max[1])) / 2).toFixed(1)},${((Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2).toFixed(1)}`, pen: `${px.toFixed(2)}x${py.toFixed(2)}x${pz.toFixed(2)}` };
    g.n++; groups.set(key, g);
  }
}
console.log(`${id}: ${C.length} kutu, ${[...groups.values()].reduce((s, g) => s + g.n, 0)} örtüşen çift, ${groups.size} kaynak çifti`);
for (const [k, g] of [...groups].sort((a, b) => a[1].n - b[1].n).slice(0, +(process.env.TOP || 45))) console.log(`${String(g.n).padStart(4)}×  ${k}   örn. (${g.at}) ${g.pen}`);
