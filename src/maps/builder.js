import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from '../core/geo.js';
import { makeDesertMaterial, kindOfColor } from './surface.js';

const VC_MAP = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0 });     // mat() düz malzemesiyle aynı, rengi köşelerden alır

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
    this.surface = null;           // { ground(x, z) }: Çöl Geçidi yüzey detayı (aKind + aGnd öznitelikleri, desert malzemesi); null = düz köşe rengi
    this.autoPlace = false;        // true: araçlar ertelenir, flushVehicles() çakışmayanı en yakın boş yere koyar
    this.pendingVeh = [];
    this.vehicles = [];            // araç ayak izleri (dünya OBB): denetim için scripts/vehaudit.mjs
    this.stack = [new THREE.Matrix4()];
    this.objStack = [];            // harita editörü: o an kurulan mantıksal nesnenin kimliği (obj()); yoksa her parça kendi otomatik kimliğini alır
    this._autoN = 0; this._lastOid = null;
  }

  // ── harita editörü desteği ──
  // obj(id, fn): fn içinde eklenen tüm görsel parçalar ve çarpışma kutuları bu kimliği taşır (seç / sil / taşı / boyutla tek nesne olarak).
  obj(id, fn) { this.objStack.push(id); try { return fn(); } finally { this.objStack.pop(); } }
  get curOid() { return this.objStack.length ? this.objStack[this.objStack.length - 1] : null; }

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
    g.userData.oid = this.curOid || 'parça:' + this._autoN++;
    this._lastOid = g.userData.oid;
    g.deleteAttribute('uv');
    b.geos.push(g);
    return { g, key };
  }

  _aabb(w, h, d, local, tag, yCenterOffset = 0) {
    const final = this.M.clone().multiply(local);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < 8; i++) {
      _p.set(i & 1 ? w / 2 : -w / 2, i & 2 ? h / 2 : -h / 2, i & 4 ? d / 2 : -d / 2).applyMatrix4(final);
      mn[0] = Math.min(mn[0], _p.x); mn[1] = Math.min(mn[1], _p.y); mn[2] = Math.min(mn[2], _p.z);
      mx[0] = Math.max(mx[0], _p.x); mx[1] = Math.max(mx[1], _p.y); mx[2] = Math.max(mx[2], _p.z);
    }
    this.colliders.push({ min: mn, max: mx, tag, oid: this.curOid || this._lastOid || 'çarpışma:' + this._autoN++ });
  }

  _local(x, y, z, rx = 0, ry = 0, rz = 0, scale = _s) {
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), scale);
  }

  box(x, y, z, w, h, d, color, opt = {}) {
    const local = this._local(x, y + h / 2, z, opt.rx, opt.ry, opt.rz);
    const r = this.addGeo(new THREE.BoxGeometry(w, h, d), color, local, opt.o);
    if (opt.collide !== false) this._aabb(w, h, d, local, opt.tag);
    if (MapBuilder.zfix) this._zrec(r, local, w, h, d);
  }

  // ── Z-fighting (dokuların gidip gelmesi) toplu çözümü ──
  // Eksen hizalı her kutunun dünya AABB'si ve geometrisi kaydedilir; build()'de farklı malzemeli iki kutunun AYNI YÖNE bakan yüzleri
  // (üst-üst, alt-alt, ön-ön …) ≤ ZEPS aralıkla çakışıyorsa (ortak alan > 4 cm²) ve yüzler örtüşüyorsa, küçük yüzlü kutunun (eşitse sonrakinin)
  // yüzü ZGAP kadar öne itilir (üstündeki ek/kaplama). Çarpışma kutuları değişmez.
  _zrec(r, local, w, h, d) {
    const e = this.M.clone().multiply(local).elements;
    const col = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]], half = [w / 2, h / 2, d / 2];
    for (const c of col) if (Math.max(Math.abs(c[0]), Math.abs(c[1]), Math.abs(c[2])) < 0.9999) return;       // yalnızca eksen hizalı
    const mn = [e[12], e[13], e[14]], mx = [e[12], e[13], e[14]];
    for (let i = 0; i < 3; i++) for (let a = 0; a < 3; a++) { const v = Math.abs(col[i][a]) * half[i]; mn[a] -= v; mx[a] += v; }
    (this._zitems ||= []).push({ mn, mx, geo: r.g, key: r.key, site: MapBuilder.zsite ? MapBuilder.zsite() : null });
  }

  resolveZFight() {                                       // zincirleme itmeler için en çok 5 geçiş (ikinci çağrıda 0 dönmeli)
    const all = [];
    for (let p = 0; p < 5; p++) { const r = this._zpass(); if (!r.length) break; all.push(...r); }
    return all;
  }

  _zpass() {
    const it = this._zitems || [], ZEPS = 0.012, ZGAP = 0.013, rep = [];
    if (it.length < 2) return rep;
    const order = it.map((_, i) => i).sort((a, c) => it[a].mn[0] - it[c].mn[0]);
    const flat = (q) => q.mx[1] - q.mn[1] <= 0.045 && q.mn[1] < 0.02;
    const area = (q, a) => { const o = [0, 1, 2].filter((k) => k !== a); return (q.mx[o[0]] - q.mn[o[0]]) * (q.mx[o[1]] - q.mn[o[1]]); };
    const push = (q, a, side, delta) => {                                           // q kutusunun a ekseni, side yüzü (1: max, -1: min) delta kadar dışarı
      const pos = q.geo.attributes.position, plane = side > 0 ? q.mx[a] : q.mn[a];
      for (let i = 0; i < pos.count; i++) {
        const v = a === 0 ? pos.getX(i) : a === 1 ? pos.getY(i) : pos.getZ(i);
        if (Math.abs(v - plane) < 1e-3) { if (a === 0) pos.setX(i, v + side * delta); else if (a === 1) pos.setY(i, v + side * delta); else pos.setZ(i, v + side * delta); }
      }
      pos.needsUpdate = true;
      if (side > 0) q.mx[a] += side * delta; else q.mn[a] += side * delta;
    };
    for (let oi = 0; oi < order.length; oi++) {
      const A = it[order[oi]];
      for (let oj = oi + 1; oj < order.length; oj++) {
        const B = it[order[oj]];
        if (B.mn[0] > A.mx[0] + ZEPS) break;
        if (A.key === B.key) continue;                                              // aynı malzeme: görsel fark yok
        if (flat(A) && flat(B)) continue;                                           // zemin kaplamaları (çimen yaması / asfalt / toprak): birbirini itip yolun üstüne çıkmasın
        for (let a = 0; a < 3; a++) {
          const o = [0, 1, 2].filter((k) => k !== a);
          const ov0 = Math.min(A.mx[o[0]], B.mx[o[0]]) - Math.max(A.mn[o[0]], B.mn[o[0]]);
          const ov1 = Math.min(A.mx[o[1]], B.mx[o[1]]) - Math.max(A.mn[o[1]], B.mn[o[1]]);
          if (ov0 < 0.01 || ov1 < 0.01 || ov0 * ov1 < 0.0004) continue;
          for (const side of [1, -1]) {
            const fa = side > 0 ? A.mx[a] : A.mn[a], fb = side > 0 ? B.mx[a] : B.mn[a];
            if (Math.abs(fa - fb) >= ZEPS) continue;
            const aA = area(A, a), aB = area(B, a);
            const win = aA < aB * 0.66 ? A : aB < aA * 0.66 ? B : B, lose = win === A ? B : A;   // küçük yüz üstte; yakınsa sonradan eklenen
            const target = (side > 0 ? lose.mx[a] : lose.mn[a]) + side * ZGAP;
            const cur = side > 0 ? win.mx[a] : win.mn[a];
            const delta = side > 0 ? target - cur : cur - target;
            // zincirleme yığılma sınırı: bir yüz toplamda en çok ZCAP itilir (üst üste binen çimen yamaları yolun üstüne çıkmasın)
            const pk = a * 2 + (side > 0 ? 1 : 0), used = (win.pushed ||= [0, 0, 0, 0, 0, 0])[pk];
            if (used + delta > 0.027) continue;
            if (delta > 1e-5) { win.pushed[pk] += delta; push(win, a, side, delta); rep.push({ a, side, at: ((fa + fb) / 2).toFixed(2), s1: win.site, s2: lose.site }); }
          }
        }
      }
    }
    return rep;
  }

  // Yalnızca çarpışma kutusu (görünmez)
  collide(x, y, z, w, h, d, tag) {
    this._lastOid = null;                                    // yalnız çarpışma: önceki görsel parçanın kimliğini almasın
    this._aabb(w, h, d, this._local(x, y + h / 2, z), tag);
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

  // Araç gövdesi profili: [x0, x1, yükseklik, (genişlik), (taban y), (z merkezi)] parçaları (araç yerelinde, +X ileri). Her parça kendi çarpışma kutusu olur;
  // böylece kaput/bagaj üstünden ve cam boşluklarından atış geçer, uzun gövde dönük durunca tek dev kutuya şişmez.
  // off/len/wid: ayak izi (üst üste binme denetimi için bir kez kaydedilir).
  vparts(kind, off, len, wid, parts) {
    let top = 0;
    for (const [x0, x1, h, w = wid, y0 = 0, zc = 0] of parts) {
      this._aabb(x1 - x0, h, w, this._local((x0 + x1) / 2, y0 + h / 2, zc), 'veh');
      top = Math.max(top, y0 + h);
    }
    const final = this.M.clone().multiply(this._local(off, 0, 0));
    const pos = new THREE.Vector3(), q = new THREE.Quaternion();
    final.decompose(pos, q, new THREE.Vector3());
    this.vehicles.push({ kind, x: pos.x, z: pos.z, ry: new THREE.Euler().setFromQuaternion(q, 'YXZ').y, hl: len / 2, hw: wid / 2, h: top });
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
    const pr = this.addGeo(g, color, this._local(x, y, z, 0, opt.ry || 0, 0), opt.o);
    if (MapBuilder.zfix) this._zrec(pr, this._local(x, y, z, 0, opt.ry || 0, 0).multiply(new THREE.Matrix4().makeTranslation(0, h / 2, 0)), w, h, d);   // alın yüzleri (çadır kapısı vb. ile z-fight)
    // Çatı katıdır (içine girilemez): eğimi basamaklı kutularla (yarım genişlik başına 4 dilim, dilim ortasındaki yükseklik) örter.
    // opt.collide === false veya ince (≤0,3 m) alın üçgenlerinde çarpışma yok.
    if (opt.collide !== false && d > 0.3) {
      const N = 4, sw = w / 2 / N;
      for (const sgn of [-1, 1]) for (let k = 0; k < N; k++) {
        const hk = h * (1 - (k + 0.5) / N);
        this._aabb(sw, hk, d, this._local(x, y, z, 0, opt.ry || 0, 0).multiply(new THREE.Matrix4().makeTranslation(sgn * (k + 0.5) * sw, hk / 2, 0)), 'roof');
      }
    }
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
  // opt.base: basamakların altı bu yüksekliğe kadar dolar (zeminden havada başlayan merdivenin altı boş kalmasın; varsayılan y0)
  // opt.deco === false: görsel süs yok. Süs (çarpışmasız): basamak yüzeyi kaplaması, yan kirişler, korkuluk direkleri + el tutamağı.
  stairs(x, z, y0, dir, width, steps, rise, run, color, opt = {}) {
    const base = opt.base ?? y0;
    const horiz = dir === '+x' || dir === '-x';
    const sgn = dir === '+x' || dir === '+z' ? 1 : -1;
    const at = (s) => (horiz ? [x + sgn * s, z] : [x, z + sgn * s]);                 // yön boyunca s mesafesindeki merkez
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * rise;
      const [cx, cz] = at(i * run + run / 2);
      this.box(cx, base, cz, horiz ? run : width, top + (y0 - base), horiz ? width : run, color, opt.tag ? { tag: opt.tag } : undefined);
    }
    if (opt.posts) {                                                                 // havada duran merdivenin altına yere inen destek direkleri
      for (const i of [Math.round(steps * 0.3), steps - 1]) {                      // iki direk çifti: orta + yüksek uç
        const [px, pz] = at(i * run + run / 2);
        for (const sd of [-1, 1]) {
          const [lx, lz] = horiz ? [0, sd * (width / 2 - 0.12)] : [sd * (width / 2 - 0.12), 0];
          const bot = opt.posts.to ?? 0, top = y0 + i * rise;
          if (top - bot > 0.3) this.box(px + lx, bot, pz + lz, 0.24, top - bot, 0.24, new THREE.Color(color).multiplyScalar(0.55).getStyle(), { collide: false });
        }
      }
    }
    if (opt.deco === false || steps < 3) return;
    const NC = { collide: false };
    const light = new THREE.Color(color).multiplyScalar(1.18).getStyle(), dark = new THREE.Color(color).multiplyScalar(0.62).getStyle();
    for (let i = 0; i < steps; i++) {                                                // basamak yüzeyi (açık ton) + burun şeridi (koyu)
      const top = (i + 1) * rise;
      const [cx, cz] = at(i * run + run / 2), [nx, nz] = at(i * run + 0.03);
      this.box(cx, y0 + top, cz, horiz ? run : width, 0.02, horiz ? width : run, light, NC);
      this.box(nx, y0 + top - 0.004, nz, horiz ? 0.05 : width + 0.02, 0.04, horiz ? width + 0.02 : 0.05, dark, NC);
    }
    const len = steps * run, hgt = steps * rise, L = Math.hypot(len, hgt), a = Math.atan2(hgt, len);
    const [mx, mz] = at(len / 2);
    const rot = dir === '+z' ? { rx: -a } : dir === '-z' ? { rx: a } : dir === '+x' ? { rz: a } : { rz: -a };
    const lat = (o) => (horiz ? [0, o] : [o, 0]);                                    // yanal kayma (genişlik yönü)
    for (const sd of [-1, 1]) {
      const [lx, lz] = lat(sd * (width / 2 + 0.035));
      // yan kiriş: eğimin altında, çizgiye paralel
      this.box(mx + lx, y0 + hgt / 2 - 0.12, mz + lz, horiz ? L : 0.07, 0.26, horiz ? 0.07 : L, dark, { collide: false, ...rot });
      // korkuluk: içeride (genişlikten 0,05 içeri) direkler + üstte eğik tutamak
      const [ix, iz] = lat(sd * (width / 2 - 0.05));
      this.box(mx + ix, y0 + hgt / 2 + 0.9, mz + iz, horiz ? L : 0.05, 0.05, horiz ? 0.05 : L, dark, { collide: false, ...rot });
      for (let i = 0; i < steps; i += Math.max(2, Math.round(steps / 5))) {
        const [px, pz] = at(i * run + run / 2);
        this.box(px + ix, y0 + (i + 1) * rise, pz + iz, 0.05, 0.9, 0.05, light, NC);
      }
    }
  }

  // Düzenlemeleri uygula (harita editörü çıktısı; kurulumun SONUNDA, build()'den önce — sunucu ve istemci aynı sonucu alır).
  // e = { id, at:[x,y,z] (nesnenin ilk taban-merkezi, doğrulama), del?:true, d?:[dx,dy,dz], s?:[sx,sy,sz] }. Kimlik bulunamaz ya da konum 1,5 m'den
  // fazla kaymışsa (harita verisi değişmiş) düzenleme atlanır ve this.editSkipped'e yazılır.
  applyEdits(list) {
    this.editSkipped ||= [];
    if (!list || !list.length) return;
    const geos = []; for (const b of this.buckets.values()) for (const g of b.geos) geos.push([b, g]);
    for (const e of list) {
      const cs = this.colliders.filter((c) => c.oid === e.id), gs = geos.filter(([, g]) => g.userData.oid === e.id);
      if (!cs.length && !gs.length) { this.editSkipped.push(e.id + ' (yok)'); continue; }
      const piv = MapBuilder.pivotOf(cs, gs.map(([, g]) => g));
      if (e.at && Math.hypot(piv[0] - e.at[0], piv[1] - e.at[1], piv[2] - e.at[2]) > 1.5) { this.editSkipped.push(e.id + ' (konum değişmiş)'); continue; }
      if (e.del) {
        this.colliders = this.colliders.filter((c) => c.oid !== e.id);
        for (const [b, g] of gs) b.geos.splice(b.geos.indexOf(g), 1);
        continue;
      }
      const m = MapBuilder.editMatrix(piv, e.d, e.s);
      for (const [, g] of gs) g.applyMatrix4(m);
      for (const c of cs) MapBuilder.editBox(c, piv, e.d, e.s);
    }
  }
  static pivotOf(cs, gs) {                                    // nesnenin taban-merkezi: çarpışma kutuları varsa onlardan (sunucu = istemci), yoksa görsel
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    if (cs.length) for (const c of cs) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], c.min[a]); mx[a] = Math.max(mx[a], c.max[a]); }
    else for (const g of gs) { g.computeBoundingBox(); const bb = g.boundingBox; mn[0] = Math.min(mn[0], bb.min.x); mn[1] = Math.min(mn[1], bb.min.y); mn[2] = Math.min(mn[2], bb.min.z); mx[0] = Math.max(mx[0], bb.max.x); mx[1] = Math.max(mx[1], bb.max.y); mx[2] = Math.max(mx[2], bb.max.z); }
    return [+((mn[0] + mx[0]) / 2).toFixed(3), +mn[1].toFixed(3), +((mn[2] + mx[2]) / 2).toFixed(3)];
  }
  static editMatrix(p, d = [0, 0, 0], s = [1, 1, 1]) {
    return new THREE.Matrix4().makeTranslation(p[0] + d[0], p[1] + d[1], p[2] + d[2]).multiply(new THREE.Matrix4().makeScale(s[0], s[1], s[2])).multiply(new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2]));
  }
  static editBox(c, p, d = [0, 0, 0], s = [1, 1, 1]) {
    for (let a = 0; a < 3; a++) { const lo = p[a] + d[a] + (c.min[a] - p[a]) * s[a], hi = p[a] + d[a] + (c.max[a] - p[a]) * s[a]; c.min[a] = Math.min(lo, hi); c.max[a] = Math.max(lo, hi); }
  }

  build() {
    this.flushVehicles();
    if (MapBuilder.pendingEdits) this.applyEdits(MapBuilder.pendingEdits);
    if (MapBuilder.noVisual) return new THREE.Group();                 // sunucu: görsel geometri gerekmez (yalnızca çarpışma kutuları + yerleşim)
    if (MapBuilder.zfix) this.zfightReport = this.resolveZFight();
    const group = new THREE.Group();
    // Düz malzemeli (seçeneksiz) tüm kutular köşe rengiyle TEK mesh'te birleşir (renk başına ~400 çizim çağrısı yerine 1); parlayan/saydam/özel
    // malzemeler eskisi gibi kendi kovasında kalır. Çizim çağrısı hem ana hem gölge geçişinde ciddi azalır.
    const plainGeos = [];
    for (const b of this.buckets.values()) {
      if (Object.keys(b.o).length === 0 && !MapBuilder.noVC) {
        const c = new THREE.Color(b.color), kind = this.surface ? kindOfColor(b.color) : 0;
        for (const g of b.geos) {
          const n = g.attributes.position.count, arr = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
          g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
          if (this.surface) {
            const P = g.attributes.position, kd = new Uint8Array(n), gd = new Float32Array(n);
            const oid = g.userData.oid || '', kk = /^palmiye/.test(oid) ? 3 : kind === 1 && /^(kasa|sandık|araç|fıçı|varil)/.test(oid) ? 2 : kind;       // açık renkli sandıklar sıva değil ahşap
            for (let i = 0; i < n; i++) { kd[i] = kk; gd[i] = this.surface.ground(P.getX(i), P.getZ(i)); }
            g.setAttribute('aKind', new THREE.BufferAttribute(kd, 1)); g.setAttribute('aGnd', new THREE.BufferAttribute(gd, 1));
          }
          plainGeos.push(g);
        }
        continue;
      }
      if (!b.geos.length) continue;
      const merged = mergeGeometries(b.geos, false);
      const mesh = new THREE.Mesh(merged, mat(b.color, { ...b.o }));
      mesh.userData.ranges = MapBuilder.rangesOf(b.geos);
      mesh.castShadow = !b.o.transparent;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (plainGeos.length) {
      const merged = mergeGeometries(plainGeos, false);
      const ranges = MapBuilder.rangesOf(plainGeos);
      const c32 = merged.attributes.color.array, c16 = new Uint16Array(c32.length);            // bellek: köşe rengi 12 → 6 bayt (yarım duyarlık)
      for (let i = 0; i < c32.length; i++) c16[i] = THREE.DataUtils.toHalfFloat(c32[i]);
      merged.setAttribute('color', new THREE.Float16BufferAttribute(c16, 3));
      const mesh = new THREE.Mesh(merged, this.surface ? (this._desertMat ||= makeDesertMaterial()) : VC_MAP);
      mesh.userData.ranges = ranges;
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
  // birleşik ağda her parçanın köşe aralığı: [{oid, start, count}] (editör: üçgen → nesne kimliği, nesnenin köşeleri)
  static rangesOf(geos) {
    const out = []; let at = 0;
    for (const g of geos) { const n = g.attributes.position.count; out.push({ oid: g.userData.oid, start: at, count: n }); at += n; }
    return out;
  }
}

// Tarayıcıda varsayılan açık (görsel); Node'da (sunucu/testler) görsele gerek olmadığından kapalı — denetim betikleri MapBuilder.zfix = true yapar.
MapBuilder.zfix = typeof window !== 'undefined';
MapBuilder.zsite = null;
MapBuilder.noVisual = false;       // true: build() görsel geometriyi birleştirmez (sunucu belleği)
MapBuilder.pendingEdits = null;    // harita editörü (geliştirici modu, yerel): sonraki build()'de uygulanacak düzenlemeler
