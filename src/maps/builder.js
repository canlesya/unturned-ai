import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from '../core/geo.js';

// Harita üreticisi: tüm statik parçalar renk/materyal başına tek geometride birleştirilir (az draw call),
// her katı parça için AABB çarpışma kutusu da kaydedilir (oyuncu + bot hareketi için).
// Konvansiyon: box(x, y(taban), z, w, h, d) — x/z merkez, y zeminden başlar.

export function makeRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);

export class MapBuilder {
  constructor() {
    this.buckets = new Map();
    this.colliders = [];
    this.autoPlace = false;        // true: araçlar ertelenir, flushVehicles() çakışmayanı en yakın boş yere koyar
    this.pendingVeh = [];
    this.vehicles = [];            // araç ayak izleri (dünya OBB): denetim için scripts/vehaudit.mjs
    this.stack = [new THREE.Matrix4()];
  }

  get M() { return this.stack[this.stack.length - 1]; }

  push(x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
    this.stack.push(this.M.clone().multiply(m));
  }
  pop() { this.stack.pop(); }
  with(x, y, z, ry, fn) { this.push(x, y, z, ry); fn(); this.pop(); }

  addGeo(geometry, color, local, o) {
    const key = color + '|' + JSON.stringify(o || {});
    let b = this.buckets.get(key);
    if (!b) { b = { color, o: o || {}, geos: [] }; this.buckets.set(key, b); }
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.applyMatrix4(this.M.clone().multiply(local));
    g.deleteAttribute('uv');
    b.geos.push(g);
  }

  _aabb(w, h, d, local, tag, yCenterOffset = 0) {
    const final = this.M.clone().multiply(local);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < 8; i++) {
      _p.set(i & 1 ? w / 2 : -w / 2, i & 2 ? h / 2 : -h / 2, i & 4 ? d / 2 : -d / 2).applyMatrix4(final);
      mn[0] = Math.min(mn[0], _p.x); mn[1] = Math.min(mn[1], _p.y); mn[2] = Math.min(mn[2], _p.z);
      mx[0] = Math.max(mx[0], _p.x); mx[1] = Math.max(mx[1], _p.y); mx[2] = Math.max(mx[2], _p.z);
    }
    this.colliders.push({ min: mn, max: mx, tag });
  }

  _local(x, y, z, rx = 0, ry = 0, rz = 0, scale = _s) {
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), scale);
  }

  box(x, y, z, w, h, d, color, opt = {}) {
    const local = this._local(x, y + h / 2, z, opt.rx, opt.ry, opt.rz);
    this.addGeo(new THREE.BoxGeometry(w, h, d), color, local, opt.o);
    if (opt.collide !== false) this._aabb(w, h, d, local, opt.tag);
  }

  // Yalnızca çarpışma kutusu (görünmez)
  collide(x, y, z, w, h, d, tag) {
    this._aabb(w, h, d, this._local(x, y + h / 2, z), tag);
  }

  // Araç gövdesi çarpışması: normal collide + yönlü ayak izi kaydı (araçların birbirine/binalara girmediğini denetlemek için)
  vcollide(x, y, z, w, h, d, kind = 'car') {
    const local = this._local(x, y + h / 2, z);
    this._aabb(w, h, d, local, 'veh');
    const final = this.M.clone().multiply(local);
    const pos = new THREE.Vector3(), q = new THREE.Quaternion();
    final.decompose(pos, q, new THREE.Vector3());
    this.vehicles.push({ kind, x: pos.x, z: pos.z, ry: new THREE.Euler().setFromQuaternion(q, 'YXZ').y, hl: w / 2, hw: d / 2, h });
  }

  // Araç çizimini erteler (autoPlace açıksa); aksi halde hemen çizer
  defer(kind, fn, o) {
    if (!this.autoPlace || this.flushing) return fn(this, o);
    this.pendingVeh.push({ kind, fn, o, M: this.M.clone() });
  }

  // Ertelenmiş araçları yerleştirir: orijinal konum başka araca/engele giriyorsa çevresinde en yakın boş konum aranır,
  // bulunamazsa araç konmaz (iç içe geçmiş araç/bina olmasın).
  flushVehicles() {
    if (!this.pendingVeh.length) return;
    const FOOT = { car: [0, 4.4, 1.85], bus: [0, 10, 2.55], truck: [0.25, 8.8, 2.55], tanker: [0.1, 8.6, 2.5], apc: [0, 5.4, 2.8], tank: [0, 6.4, 3.4], ambulance: [0.4, 6, 2.5], jeep: [0, 3.9, 1.9] };
    const solids = this.colliders.filter((c) => c.tag !== 'veh' && c.tag !== 'deck' && c.min[1] < 2.2 && c.max[1] > 0.25 && c.max[0] - c.min[0] < 150 && c.max[2] - c.min[2] < 150);
    const obb = (cx, cz, ry, hl, hw) => { const c = Math.cos(ry), s = Math.sin(ry); return [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]); };
    const axes = (P) => [0, 1].map((i) => { const a = P[i], q = P[i + 1], dx = q[0] - a[0], dz = q[1] - a[1], l = Math.hypot(dx, dz); return [-dz / l, dx / l]; });
    const pr = (P, ax) => { let lo = 1e9, hi = -1e9; for (const p of P) { const d = p[0] * ax[0] + p[1] * ax[1]; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
    const hit = (P, Q) => { for (const ax of [...axes(P), ...axes(Q)]) { const a = pr(P, ax), q = pr(Q, ax); if (Math.min(a[1], q[1]) - Math.max(a[0], q[0]) < 0.03) return false; } return true; };
    const boxP = (c) => [[c.min[0], c.min[2]], [c.max[0], c.min[2]], [c.max[0], c.max[2]], [c.min[0], c.max[2]]];
    const sol = solids.map((c) => ({ c, P: boxP(c) }));
    const placed = [];
    const saved = this.stack; this.flushing = true;
    const todo = this.pendingVeh; this.pendingVeh = [];
    for (const pv of todo) {
      const [off, len, wid] = FOOT[pv.kind] || [0, 4, 2];
      const pos = new THREE.Vector3(), q = new THREE.Quaternion();
      pv.M.decompose(pos, q, new THREE.Vector3());
      const mry = new THREE.Euler().setFromQuaternion(q, 'YXZ').y, ry = mry + (pv.o.ry || 0);
      const worldOf = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyMatrix4(pv.M);
      const bad = (dx, dz) => {
        const w = worldOf((pv.o.x || 0) + dx, (pv.o.z || 0) + dz);
        const P = obb(w.x + off * Math.cos(ry), w.z - off * Math.sin(ry), ry, len / 2, wid / 2);
        for (const s of sol) { if (s.c.min[0] > Math.max(...P.map((p) => p[0])) || s.c.max[0] < Math.min(...P.map((p) => p[0]))) continue; if (hit(P, s.P)) return true; }
        for (const v of placed) if (hit(P, v)) return true;
        return false;
      };
      let best = null;
      if (!bad(0, 0)) best = [0, 0];
      else {
        const cand = [];
        for (let r = 0.25; r <= 3.2; r += 0.25) for (let k = 0; k < 16; k++) cand.push([r * Math.cos(k * Math.PI / 8), r * Math.sin(k * Math.PI / 8), r]);
        for (const [dx, dz] of cand) if (!bad(dx, dz)) { best = [dx, dz]; break; }
      }
      if (!best) continue;
      const w = worldOf((pv.o.x || 0) + best[0], (pv.o.z || 0) + best[1]);
      placed.push(obb(w.x + off * Math.cos(ry), w.z - off * Math.sin(ry), ry, len / 2, wid / 2));
      this.stack = [pv.M.clone()];
      pv.fn(this, { ...pv.o, x: (pv.o.x || 0) + best[0], z: (pv.o.z || 0) + best[1] });
    }
    this.stack = saved; this.flushing = false;
  }

  cyl(x, y, z, rTop, rBot, h, color, opt = {}) {
    const cy = opt.center ? y : y + h / 2;
    const local = this._local(x, cy, z, opt.rx, opt.ry, opt.rz);
    this.addGeo(new THREE.CylinderGeometry(rTop, rBot, h, opt.seg || 8), color, local, opt.o);
    if (opt.collide !== false && !opt.rx && !opt.rz) {
      const r = Math.max(rTop, rBot);
      this._aabb(r * 2, h, r * 2, local, opt.tag);
    }
  }

  ico(x, y, z, r, color, opt = {}) {
    const local = this._local(x, y, z, 0, opt.ry || 0, 0, opt.scale ? new THREE.Vector3(...opt.scale) : _s);
    this.addGeo(new THREE.IcosahedronGeometry(r, opt.detail || 0), color, local, opt.o);
  }

  // Üçgen kesitli prizma (çatı). Kesit XY düzleminde, uzunluk Z ekseninde.
  prism(x, y, z, w, h, d, color, opt = {}) {
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    this.addGeo(g, color, this._local(x, y, z, 0, opt.ry || 0, 0), opt.o);
  }

  // Boşluklu (kapı/pencere) duvar. axis 'x': x0→x1 boyunca, z=c'de. axis 'z': z0→z1 boyunca, x=c'de.
  wall(axis, a0, a1, c, y0, h, t, color, openings = [], opt = {}) {
    const ops = [...openings].sort((p, q) => p.at - q.at);
    const piece = (s, e, yb, yt) => {
      if (e - s < 0.01 || yt - yb < 0.01) return;
      const mid = (s + e) / 2, len = e - s;
      if (axis === 'x') this.box(mid, y0 + yb, c, len, yt - yb, t, color, opt);
      else this.box(c, y0 + yb, mid, t, yt - yb, len, color, opt);
    };
    let cur = a0;
    for (const o of ops) {
      const s = o.at - o.w / 2, e = o.at + o.w / 2;
      piece(cur, s, 0, h);
      if (o.b > 0) piece(s, e, 0, o.b);
      piece(s, e, o.top, h);
      if (o.glass) {
        // o.glow: pencere geceleri sarı parlar (içeride ışık var)
        const gl = o.glow ? (o.glassColor || '#ffd98a') : (o.glassColor || '#a9d6ee');
        const gh = o.top - o.b, mid = (s + e) / 2;
        const go = { collide: false, o: o.glow ? { glow: true, transparent: true, opacity: 0.62, roughness: 0.4 } : { transparent: true, opacity: 0.32, roughness: 0.15 } };
        if (axis === 'x') this.box(mid, y0 + o.b, c, o.w, gh, 0.05, gl, go);
        else this.box(c, y0 + o.b, mid, 0.05, gh, o.w, gl, go);
        const tr = opt.trim || '#e8e6df';
        if (axis === 'x') this.box(mid, y0 + o.b - 0.06, c, o.w + 0.3, 0.07, t + 0.18, tr, { collide: false });
        else this.box(c, y0 + o.b - 0.06, mid, t + 0.18, 0.07, o.w + 0.3, tr, { collide: false });
      }
      cur = e;
    }
    piece(cur, a1, 0, h);
  }

  // Dikdörtgen bina kabuğu: dört dış duvar, köşeler tam örtüşür (T/2 çentik/boşluk kalmaz).
  // ops = { n, s, e, w } her duvar için açıklık listesi; kuzey/güney duvarı (z0/z1) x ekseninde uzar ve köşeleri kapsar.
  shell(x0, x1, z0, z1, y0, h, t, color, ops = {}, opt = {}) {
    this.wall('x', x0 - t / 2, x1 + t / 2, z0, y0, h, t, color, ops.n || [], opt);
    this.wall('x', x0 - t / 2, x1 + t / 2, z1, y0, h, t, color, ops.s || [], opt);
    this.wall('z', z0 + t / 2, z1 - t / 2, x0, y0, h, t, color, ops.w || [], opt);
    this.wall('z', z0 + t / 2, z1 - t / 2, x1, y0, h, t, color, ops.e || [], opt);
  }

  // Basamaklar: (x,z)=alt basamağın başlangıç kenarı ortası, dir yönünde yükselir.
  stairs(x, z, y0, dir, width, steps, rise, run, color) {
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * rise;
      const off = i * run + run / 2;
      const [dx, dz] = dir === '+x' ? [off, 0] : dir === '-x' ? [-off, 0] : dir === '+z' ? [0, off] : [0, -off];
      const horiz = dir === '+x' || dir === '-x';
      this.box(x + dx, y0, z + dz, horiz ? run : width, top, horiz ? width : run, color);
    }
  }

  build() {
    this.flushVehicles();
    const group = new THREE.Group();
    for (const b of this.buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      const mesh = new THREE.Mesh(merged, mat(b.color, { ...b.o }));
      mesh.castShadow = !b.o.transparent;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}
