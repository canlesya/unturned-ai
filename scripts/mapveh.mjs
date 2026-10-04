// Araç ↔ yapı/prop örtüşmesi (GÖRSEL kutularla; çarpışmasız süs dahil):  node scripts/mapveh.mjs [harita...]
// Araç ayak izi (OBB, b.vehicles) ile araç dışı her kutunun yatay izi SAT ile karşılaştırılır; dikeyde araç gövdesiyle ≥0,15 m ve yatayda ≥0,12 m içe girenler raporlanır.
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const site = () => (new Error().stack.split('\n').slice(3, 14).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l)).slice(0, 3).map((l) => l.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '')).join(' < '));
const boxes = [];
const _box = MapBuilder.prototype.box;
MapBuilder.prototype.box = function (x, y, z, w, h, d, color, opt = {}) {
  if (Math.min(w, h, d) >= 0.12 && w * h * d >= 0.08 && !(opt.o && (opt.o.transparent || opt.o.glow)) && y + h > 0.18) {
    const st = site();
    if (!/vehicles\.js/.test(st)) {
      const m = this.M.clone().multiply(this._local(x, y + h / 2, z, opt.rx, opt.ry, opt.rz));
      const pts = [];
      for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? w / 2 : -w / 2, i & 2 ? h / 2 : -h / 2, i & 4 ? d / 2 : -d / 2).applyMatrix4(m));
      const ax = new THREE.Vector3(m.elements[0], 0, m.elements[2]).normalize(), az = new THREE.Vector3(m.elements[8], 0, m.elements[10]).normalize();
      boxes.push({ pts, ax, az, y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)), site: st, cx: m.elements[12], cz: m.elements[14], b: this });
    }
  }
  return _box.call(this, x, y, z, w, h, d, color, opt);
};
const proj = (pts, ax) => { let lo = 1e9, hi = -1e9; for (const p of pts) { const d = p.x * ax.x + p.z * ax.z; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAPS);
const builders = new Set(); const _build = MapBuilder.prototype.build;
MapBuilder.prototype.build = function () { builders.add(this); return _build.call(this); };
let total = 0;
for (const id of ids) {
  boxes.length = 0; builders.clear();
  MAPS[id].build();
  const hits = [];
  for (const b of builders) for (const v of b.vehicles) {
    const c = Math.cos(v.ry), s = Math.sin(v.ry);
    const rect = [[v.hl, v.hw], [v.hl, -v.hw], [-v.hl, -v.hw], [-v.hl, v.hw]].map(([x, z]) => new THREE.Vector3(v.x + x * c + z * s, 0, v.z - x * s + z * c));
    const axes = [new THREE.Vector3(c, 0, -s), new THREE.Vector3(s, 0, c)];
    for (const q of boxes) {
      if (q.b !== b || q.y1 < 0.2 || q.y0 > v.h - 0.1 || Math.min(q.y1, v.h) - Math.max(q.y0, 0.15) < 0.15) continue;
      if (Math.hypot(q.cx - v.x, q.cz - v.z) > 14) continue;
      let pen = 1e9;
      for (const ax of [...axes, q.ax, q.az]) { const [a0, a1] = proj(rect, ax), [b0, b1] = proj(q.pts, ax); pen = Math.min(pen, Math.min(a1, b1) - Math.max(a0, b0)); if (pen < 0.12) break; }
      if (pen >= 0.12) hits.push({ v, q, pen });
    }
  }
  const by = new Map();
  for (const h of hits) { const k = `${h.v.kind}(${h.v.x.toFixed(1)},${h.v.z.toFixed(1)})`; const e = by.get(k) || { sites: new Set(), pen: 0 }; e.sites.add(h.q.site.split(' < ')[0]); e.pen = Math.max(e.pen, h.pen); by.set(k, e); }
  console.log(`\n=== ${id}: ${[...builders].reduce((n, b) => n + b.vehicles.length, 0)} araç, örtüşen araç ${by.size}`);
  for (const [k, e] of by) console.log(`  ${k}  iç içe ≤${e.pen.toFixed(2)} m  ← ${[...e.sites].slice(0, 4).join(' | ')}`);
  total += by.size;
}
process.exit(total ? 1 : 0);
