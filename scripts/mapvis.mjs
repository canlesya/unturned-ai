// Görsel kutular dahil nesne ↔ nesne örtüşmesi (çarpışmasız süs: tente, çatı, kamuflaj ağı, çadır...):  node scripts/mapvis.mjs [harita] [yatay=0.4] [dikey=0.6]
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const LAYOUT = /(vadi|us|kasaba|dev|vadiLayout)\.js:\d+:\d+/;
const lay = () => { const f = new Error().stack.split('\n').map((l) => l.trim()).find((l) => LAYOUT.test(l)); const m = f && f.match(/((?:vadi|us|kasaba|dev|vadiLayout)\.js:\d+:\d+)/); return m ? m[1] : null; };
const vis = [];
const _box = MapBuilder.prototype.box;
MapBuilder.prototype.box = function (x, y, z, w, h, d, color, opt = {}) {
  if (Math.min(w, h, d) >= 0.3 && w * h * d >= 0.6 && Math.max(w, d) < 60 && y + h > 0.5 && !(opt.o && (opt.o.transparent || opt.o.glow))) {
    const l = lay();
    if (l) {
      const m = this.M.clone().multiply(this._local(x, y + h / 2, z, opt.rx, opt.ry, opt.rz));
      const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? w / 2 : -w / 2, i & 2 ? h / 2 : -h / 2, i & 4 ? d / 2 : -d / 2).applyMatrix4(m));
      vis.push({ pts, ax: new THREE.Vector3(m.elements[0], 0, m.elements[2]).normalize(), az: new THREE.Vector3(m.elements[8], 0, m.elements[10]).normalize(), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)), lay: l, cx: m.elements[12], cz: m.elements[14], r: Math.hypot(w, d) / 2 });
    }
  }
  return _box.call(this, x, y, z, w, h, d, color, opt);
};
// ağaç tepeleri: ico (meşe/çalı) ve geniş koni/silindir (çam) AABB olarak eklenir
const addAabb = (b, cx, cy, cz, rx, ry, rz) => {
  const l = lay(); if (!l) return;
  const m = new THREE.Vector3(cx, cy, cz).applyMatrix4(b.M);
  const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(m.x + (i & 1 ? rx : -rx), m.y + (i & 2 ? ry : -ry), m.z + (i & 4 ? rz : -rz)));
  vis.push({ pts, ax: new THREE.Vector3(1, 0, 0), az: new THREE.Vector3(0, 0, 1), y0: m.y - ry, y1: m.y + ry, lay: l + ' (ağaç/kaya)', cx: m.x, cz: m.z, r: Math.hypot(rx, rz), crown: true });
};
const _ico = MapBuilder.prototype.ico, _cyl = MapBuilder.prototype.cyl;
MapBuilder.prototype.ico = function (x, y, z, r, color, opt = {}) { const sc = opt.scale || [1, 1, 1]; if (r * Math.max(...sc) >= 0.8 && y - r * sc[1] > 0.3) addAabb(this, x, y, z, r * sc[0] * 0.8, r * sc[1] * 0.8, r * sc[2] * 0.8); return _ico.call(this, x, y, z, r, color, opt); };
MapBuilder.prototype.cyl = function (x, y, z, rTop, rBot, h, color, opt = {}) { if (!opt.rx && !opt.rz && Math.max(rTop, rBot) >= 1.0 && h >= 1.0 && y > 0.3) { const cy = opt.center ? y : y + h / 2; addAabb(this, x, cy, z, Math.max(rTop, rBot) * 0.8, h / 2, Math.max(rTop, rBot) * 0.8); } return _cyl.call(this, x, y, z, rTop, rBot, h, color, opt); };
const proj = (pts, ax) => { let lo = 1e9, hi = -1e9; for (const p of pts) { const d = p.x * ax.x + p.z * ax.z; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
const id = process.argv[2] || 'vadi', HX = +(process.argv[3] || 0.4), HY = +(process.argv[4] || 0.6);
MAPS[id].build();
vis.sort((a, b) => a.cx - b.cx);
const pairs = new Map();
for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length && vis[j].cx - vis[i].cx < 40; j++) {
  const a = vis[i], b = vis[j];
  if (a.lay === b.lay || (a.crown && b.crown)) continue;
  if (Math.hypot(a.cx - b.cx, a.cz - b.cz) > a.r + b.r) continue;
  if (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) < HY) continue;
  let pen = 1e9;
  for (const ax of [a.ax, a.az, b.ax, b.az]) { const [a0, a1] = proj(a.pts, ax), [b0, b1] = proj(b.pts, ax); pen = Math.min(pen, Math.min(a1, b1) - Math.max(a0, b0)); if (pen < HX) break; }
  if (pen < HX) continue;
  const key = [a.lay, b.lay].sort().join('  ×  ');
  const e = pairs.get(key) || { n: 0, at: `${((a.cx + b.cx) / 2).toFixed(1)},${((a.cz + b.cz) / 2).toFixed(1)}`, pen: 0 };
  e.n++; e.pen = Math.max(e.pen, pen); pairs.set(key, e);
}
console.log(`${id}: ${vis.length} görsel kutu, ${pairs.size} iç içe nesne çifti`);
for (const [k, e] of [...pairs].sort((a, b) => b[1].pen - a[1].pen).slice(0, +(process.env.TOP || 70))) console.log(`  ${k}   örn. (${e.at}) ≤${e.pen.toFixed(2)} m, ${e.n} kutu`);
process.exit(pairs.size ? 1 : 0);
