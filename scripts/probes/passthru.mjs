// "İçinden geçilen" katı hacimler (Node, tarayıcı gerekmez):  node scripts/probes/passthru.mjs [harita=kasaba] [res=0.4]
// Çarpışması olmayan ama görsel olarak katı kutu/prizma/koni hacimlerini kaydeder; iki takımın doğuşundan GERÇEK yürüme grafiğiyle
// ulaşılabilen her ayakta durma noktasında gövde sütununun (y+0,3 / y+1,0 / y+1,6) bu hacimlerin içine girip girmediğine bakar.
import * as THREE from 'three';
import { MapBuilder } from '../../src/maps/builder.js';
import { MAPS } from '../../src/maps/index.js';
import { Walk } from './nav3d.mjs';

const id = process.argv[2] || 'kasaba', res = +(process.argv[3] || 0.4);
const site = () => (new Error().stack.split('\n').slice(3, 14).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l)).slice(0, 2).map((l) => l.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '')).join(' < '));
const vols = [];
const inv = (m) => m.clone().invert();
const _box = MapBuilder.prototype.box, _prism = MapBuilder.prototype.prism, _cyl = MapBuilder.prototype.cyl;
MapBuilder.prototype.box = function (x, y, z, w, h, d, color, opt = {}) {
  if (opt.collide === false && Math.min(w, h, d) >= 0.3 && w * h * d >= 0.4 && !(opt.o && (opt.o.transparent || opt.o.glow))) {
    const m = this.M.clone().multiply(this._local(x, y + h / 2, z, opt.rx, opt.ry, opt.rz));
    vols.push({ t: 'box', inv: inv(m), hx: w / 2, hy: h / 2, hz: d / 2, site: site() });
  }
  return _box.call(this, x, y, z, w, h, d, color, opt);
};
MapBuilder.prototype.prism = function (x, y, z, w, h, d, color, opt = {}) {
  const m = this.M.clone().multiply(this._local(x, y, z, 0, opt.ry || 0, 0));
  vols.push({ t: 'prism', inv: inv(m), w, h, hz: d / 2, site: site() });
  return _prism.call(this, x, y, z, w, h, d, color, opt);
};
MapBuilder.prototype.cyl = function (x, y, z, rTop, rBot, h, color, opt = {}) {
  if (opt.collide === false && !opt.rx && !opt.rz && Math.max(rTop, rBot) >= 0.5 && h >= 1.0 && !(opt.o && (opt.o.transparent || opt.o.glow))) {
    const cy = opt.center ? y : y + h / 2;
    const m = this.M.clone().multiply(this._local(x, cy, z, 0, opt.ry || 0, 0));
    vols.push({ t: 'cone', inv: inv(m), rTop, rBot, hy: h / 2, site: site() });
  }
  return _cyl.call(this, x, y, z, rTop, rBot, h, color, opt);
};
const inside = (v, p) => {
  const q = p.clone().applyMatrix4(v.inv);
  if (v.t === 'box') return Math.abs(q.x) < v.hx - 0.02 && Math.abs(q.y) < v.hy - 0.02 && Math.abs(q.z) < v.hz - 0.02;
  if (v.t === 'prism') return q.y > 0.02 && q.y < v.h - 0.02 && Math.abs(q.z) < v.hz - 0.02 && Math.abs(q.x) < (v.w / 2) * (1 - q.y / v.h) - 0.02;
  if (Math.abs(q.y) >= v.hy - 0.02) return false;
  const r = v.rBot + (v.rTop - v.rBot) * ((q.y + v.hy) / (2 * v.hy));
  return Math.hypot(q.x, q.z) < r - 0.05;
};
const map = MAPS[id].build();
console.log(`${map.name}: çarpışmasız katı hacim ${vols.length}`);
const w = new Walk(map.colliders, map.bounds, { res, terrain: map.terrain || null });
const hits = new Map();
for (const team of ['blue', 'red']) {
  const sp = map.spawns[team][0];
  const r = w.reach({ x: sp.x, y: w.world.heightAt(sp.x, sp.z), z: sp.z }, process.env.JUMP ? { maxDrop: 2.2, stepUp: 0.95 } : { maxDrop: 0.6 });
  if (!r) continue;
  for (const k of r.seen.keys()) {
    const n = k % 8, cell = (k - n) / 8, i = cell % w.nx, j = Math.floor(cell / w.nx);
    const y = w.surf[cell][n], x = w.cx(i), z = w.cz(j);
    for (const dy of [0.3, 1.0, 1.6]) {
      const p = new THREE.Vector3(x, y + dy, z);
      for (const v of vols) if (inside(v, p)) { const h = hits.get(v) || { n: 0, at: `${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}` }; h.n++; hits.set(v, h); break; }
    }
  }
}
const bySite = new Map();
for (const [v, h] of hits) { const s = `${v.t} ${v.site}`; const e = bySite.get(s) || { n: 0, vols: 0, at: h.at }; e.n += h.n; e.vols++; bySite.set(s, e); }
if (!bySite.size) console.log('OK    ulaşılabilir hiçbir noktada gövde çarpışmasız katı hacmin içinde değil');
for (const [s, e] of [...bySite].sort((a, b) => b[1].n - a[1].n).slice(0, 40)) console.log(`HATA  ${s}  · ${e.vols} hacim, ${e.n} nokta (örn. ${e.at})`);
process.exit(bySite.size ? 1 : 0);
