// Askeri Üs yerleşim denetimi (tarayıcısız):  node scripts/mapaudit-us.mjs [--v] [--json çıktı.json] [harita=us]
// Her görsel parça / çarpışma kutusu, onu üreten us.js çağrı zincirine (nesne) ve kit işlevine bağlanır; sonra:
//  1 İÇ İÇE: farklı nesnelerin eksen hizalı katı parçaları her eksende ≥8 cm iç içe   2 GÖMÜLÜ: parçanın ≥%80'i başka nesnenin katısı içinde
//  3 HAVADA: yere hiçbir parça zinciriyle değmeyen görsel öbek   4 GÖRÜNMEZ ÇARPIŞMA: görseli olmayan / görselden ≥25 cm taşan çarpışma
//  5 ÇARPIŞMASIZ KATI: gövde hizasında (≤1,8 m) içinden geçilen katı görsel   6 KAPI / MERDİVEN / TÜNEL AĞZI ÖNÜNDE ENGEL
//  7 EŞYA DUVARDA: iç mekân eşyası duvar / bölme / merdivene giriyor   8 Z-FIGHT: çözüm SONRASI kalan eş düzlemli farklı renkli yüz (≤2 mm)
//  9 SINIR DIŞI: çevre duvarı dışına taşan oynanış çarpışması, katı içinde doğuş / hedef
import * as THREE from 'three';
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
Error.stackTraceLimit = 60;
MapBuilder.zfix = true;
const args = process.argv.slice(2), V = args.includes('--v'), jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const mapId = args.find((a) => !a.startsWith('--') && a !== jsonOut) || 'us';
const LAYF = new RegExp(`${mapId}\\.js:(\\d+):\\d+`);

// ── kayıt kancaları ──
const prims = [], cols = [], doors = [], stairsRec = [], tunnels = [];
let curVeh = null;
const stackInfo = () => {
  const L = new Error().stack.split('\n').slice(3).map((l) => l.trim());
  const lay = []; let fn = null, rot = false, item = false, wall = false, tunnel = false;
  for (const l of L) {
    const m = l.match(LAYF);
    if (m) { if (m[1] === '16') rot = true; else lay.push(m[1]); }
    if (!fn && /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l)) fn = (l.match(/at ([^\s(]+) \(/)?.[1] || '?') + ' ' + l.replace(/^.*src[\/]maps[\/]/, '').replace(/:\d+\)?$/, '');
    if (/placeItem/.test(l)) item = true;
    if (/MapBuilder\.wall /.test(l)) wall = true;
    if (/at tunnel /.test(l)) tunnel = true;
  }
  const obj = curVeh || (lay.length ? lay.slice().reverse().join('>') + (rot ? 'R' : '') : 'harita');
  return { obj, short: curVeh ? curVeh.split('|')[1] : (lay[0] ? `${mapId}.js:${lay[0]}${rot ? '(R)' : ''}` : 'harita'), fn: fn || '?', item, wall, tunnel };
};
let itemN = 0, curItem = null, dims = null, primKind = null;
const P = MapBuilder.prototype;
const _with = P.with; P.with = function (x, y, z, ry, fn) { const s = new Error().stack; if (/at placeItem/.test(s)) { const prev = curItem; curItem = ++itemN; try { return _with.call(this, x, y, z, ry, fn); } finally { curItem = prev; } } return _with.call(this, x, y, z, ry, fn); };
const _defer = P.defer; P.defer = function (kind, fn, o) { const si = stackInfo(); return _defer.call(this, kind, (bb, oo) => { const prev = curVeh; curVeh = `${si.obj}|${si.short}:${kind}`; try { return fn(bb, oo); } finally { curVeh = prev; } }, o); };
const _box = P.box; P.box = function (x, y, z, w, h, d, color, opt = {}) { dims = [w, h, d]; primKind = 'box'; try { return _box.call(this, x, y, z, w, h, d, color, opt); } finally { dims = null; primKind = null; } };
const _cyl = P.cyl; P.cyl = function (...a) { primKind = a[7]?.rx || a[7]?.rz ? 'cylR' : 'cyl'; try { return _cyl.apply(this, a); } finally { primKind = null; } };
const _ico = P.ico; P.ico = function (...a) { primKind = 'ico'; try { return _ico.apply(this, a); } finally { primKind = null; } };
const _prism = P.prism; P.prism = function (...a) { primKind = 'prism'; try { return _prism.apply(this, a); } finally { primKind = null; } };
const _addGeo = P.addGeo; P.addGeo = function (geometry, color, local, o) {
  const r = _addGeo.call(this, geometry, color, local, o);
  const si = stackInfo();
  const p = { i: prims.length, g: r.g, key: r.key, color, o: o || {}, kind: primKind || 'geo', dims, ...si, itemId: si.item ? curItem : null, col: false };
  prims.push(p); this._lastPrim = p;
  return r;
};
const _aabb = P._aabb; P._aabb = function (w, h, d, local, tag, ...rest) {
  const n = this.colliders.length; _aabb.call(this, w, h, d, local, tag, ...rest);
  const c = this.colliders[n]; const si = stackInfo();
  const fromBox = /at MapBuilder\.(box|cyl) /.test(new Error().stack);
  c._a = { ...si, tag, prim: fromBox ? this._lastPrim : null, itemId: si.item ? curItem : null, n: cols.length };
  if (fromBox && this._lastPrim) this._lastPrim.col = true;
  cols.push(c);
};
const _wall = P.wall; P.wall = function (axis, a0, a1, c, y0, h, t, color, openings = [], opt = {}) {
  for (const o of openings) if ((o.b || 0) <= 0.05 && o.top >= 1.9 && o.w >= 0.8) {
    const A = axis === 'x' ? new THREE.Vector3(o.at - o.w / 2, y0, c) : new THREE.Vector3(c, y0, o.at - o.w / 2);
    const B = axis === 'x' ? new THREE.Vector3(o.at + o.w / 2, y0, c) : new THREE.Vector3(c, y0, o.at + o.w / 2);
    A.applyMatrix4(this.M); B.applyMatrix4(this.M);
    doors.push({ A, B, t, y0: A.y, ...stackInfo() });
  }
  return _wall.call(this, axis, a0, a1, c, y0, h, t, color, openings, opt);
};
const _stairs = P.stairs; P.stairs = function (x, z, y0, dir, width, steps, rise, run, color, opt = {}) {
  const n0 = this.colliders.length; const r = _stairs.call(this, x, z, y0, dir, width, steps, rise, run, color, opt);
  const cs = this.colliders.slice(n0); if (!cs.length) return r;
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const c of cs) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], c.min[a]); hi[a] = Math.max(hi[a], c.max[a]); }
  const dl = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[dir];
  const dv = new THREE.Vector3(dl[0], 0, dl[1]).transformDirection(this.M);
  const base = new THREE.Vector3(x, y0, z).applyMatrix4(this.M);
  stairsRec.push({ lo, hi, dv: [Math.round(dv.x), Math.round(dv.z)], base, top: y0 + steps * rise + (this.M.elements[13]), y0: base.y, width, cs, ...stackInfo() });
  return r;
};

// ── kurulum ──
let builder = null;
const _build = P.build; P.build = function () { builder = this; return _build.call(this); };
const t0 = Date.now();
const map = MAPS[mapId].build();
const tBuild = Date.now() - t0;
const zres = builder.zfightReport?.length || 0;
const colsAll = map.colliders;
for (const c of colsAll) if (!c._a) c._a = { obj: 'harita', short: '?', fn: '?', prim: null };
// görsel AABB (z-fight çözümünden SONRA, son köşe konumlarıyla)
for (const p of prims) {
  p.g.computeBoundingBox(); const bb = p.g.boundingBox; p.mn = [bb.min.x, bb.min.y, bb.min.z]; p.mx = [bb.max.x, bb.max.y, bb.max.z];
  p.vol = (p.mx[0] - p.mn[0]) * (p.mx[1] - p.mn[1]) * (p.mx[2] - p.mn[2]);
  p.aa = p.kind === 'box' && p.dims ? Math.abs(p.vol / (p.dims[0] * p.dims[1] * p.dims[2]) - 1) < 0.03 : p.kind === 'cyl';
  p.fx = !!(p.o.glow || p.o.transparent || p.o.blending);
  p.flat = p.mx[1] - p.mn[1] <= 0.06 && p.mn[1] < 0.12;
}
const live = new Set(builder.buckets ? [...builder.buckets.values()].flatMap((b) => b.geos) : []);
const PR = prims.filter((p) => live.has(p.g));
const B = map.bounds, IN = (p, m = 0) => p.mx[0] > B.minX - 1.4 - m && p.mn[0] < B.maxX + 1.4 + m && p.mx[2] > B.minZ - 1.4 - m && p.mn[2] < B.maxZ + 1.4 + m;
const ov = (a, b, e = 0) => Math.min(a.mx[0], b.mx[0]) - Math.max(a.mn[0], b.mn[0]) + e > 0 && Math.min(a.mx[1], b.mx[1]) - Math.max(a.mn[1], b.mn[1]) + e > 0 && Math.min(a.mx[2], b.mx[2]) - Math.max(a.mn[2], b.mn[2]) + e > 0;
const pen = (a, b) => [0, 1, 2].map((k) => Math.min(a.mx[k], b.mx[k]) - Math.max(a.mn[k], b.mn[k]));
const C = (c) => ({ mn: c.min, mx: c.max });
// ızgara (xz, 4 m)
const grid = (list, get) => { const G = new Map(), S = 4; for (const it of list) { const q = get(it); for (let gx = Math.floor(q.mn[0] / S); gx <= Math.floor(q.mx[0] / S); gx++) for (let gz = Math.floor(q.mn[2] / S); gz <= Math.floor(q.mx[2] / S); gz++) { const k = gx * 100003 + gz; let a = G.get(k); if (!a) G.set(k, (a = [])); a.push(it); } } return { near(q, e = 0) { const out = new Set(); for (let gx = Math.floor((q.mn[0] - e) / S); gx <= Math.floor((q.mx[0] + e) / S); gx++) for (let gz = Math.floor((q.mn[2] - e) / S); gz <= Math.floor((q.mx[2] + e) / S); gz++) for (const it of G.get(gx * 100003 + gz) || []) out.add(it); return out; } }; };
const fmt = (v) => v.map((x) => x.toFixed(1)).join(',');
const ctr = (q) => [(q.mn[0] + q.mx[0]) / 2, (q.mn[1] + q.mx[1]) / 2, (q.mn[2] + q.mx[2]) / 2];
const R = {}, INFO = [];
const add = (k, key, e) => { const m = (R[k] ||= new Map()); const o = m.get(key) || { n: 0, worst: 0, at: e.at, info: e.info }; o.n++; if (e.v > o.worst) { o.worst = e.v; o.at = e.at; o.info = e.info; } m.set(key, o); };

// 1-2 iç içe / gömülü (eksen hizalı katı görseller; zemin kaplaması, ışık, saydam, ico hariç)
const SOL = PR.filter((p) => p.aa && !p.fx && !p.flat && IN(p) && Math.min(p.mx[0] - p.mn[0], p.mx[1] - p.mn[1], p.mx[2] - p.mn[2]) >= 0.03);
const gS = grid(SOL, (p) => p);
for (const a of SOL) for (const b of gS.near(a)) {
  if (b.i <= a.i || a.obj === b.obj) continue;
  const q = pen(a, b); if (q[0] < 0.08 || q[1] < 0.08 || q[2] < 0.08) continue;
  const vI = q[0] * q[1] * q[2], small = a.vol < b.vol ? a : b, big = small === a ? b : a;
  const key = [a.short + ' ' + a.fn, b.short + ' ' + b.fn].sort().join('  ×  ');
  if (vI / small.vol >= 0.8) add('gomulu', `${small.short} ${small.fn}  ⊂  ${big.short} ${big.fn}`, { v: vI / small.vol, at: fmt(ctr(small)) });
  else add('icice', key, { v: Math.min(...q), at: fmt([(Math.max(a.mn[0], b.mn[0]) + Math.min(a.mx[0], b.mx[0])) / 2, Math.max(a.mn[1], b.mn[1]), (Math.max(a.mn[2], b.mn[2]) + Math.min(a.mx[2], b.mx[2])) / 2]) });
}
// 3 havada duran öbekler (görsel parçalar 3 cm temas toleransıyla birleşir; yere (y ≤ 0,08) değmeyen öbek)
{
  const VIS = PR.filter((p) => !p.o.blending && !(p.o.transparent && p.o.opacity < 0.3) && IN(p, 12));
  const par = VIS.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i]))), uni = (i, j) => { i = find(i); j = find(j); if (i !== j) par[i] = j; };
  VIS.forEach((p, i) => (p._v = i));
  const gV = grid(VIS, (p) => p);
  for (const a of VIS) for (const b of gV.near(a, 0.03)) if (b._v > a._v && ov(a, b, 0.03)) uni(a._v, b._v);
  const comp = new Map();
  for (const p of VIS) { const r = find(p._v); let c = comp.get(r); if (!c) comp.set(r, (c = { ps: [], mnY: 1e9 })); c.ps.push(p); c.mnY = Math.min(c.mnY, p.mn[1]); }
  for (const c of comp.values()) if (c.mnY > 0.08 && c.ps.some((p) => IN(p))) {
    const p0 = c.ps.reduce((a, b) => (b.vol > a.vol ? b : a));
    add('havada', `${p0.short} ${p0.fn}`, { v: c.mnY, at: fmt(ctr(p0)), info: `${c.ps.length} parça, alt y=${c.mnY.toFixed(2)}` });
  }
}
// 4 görünmez / taşan çarpışma
{
  const VIS = PR.filter((p) => !p.o.blending && !p.o.glow);
  const gV = grid(VIS, (p) => p);
  for (const c of colsAll) {
    const q = C(c); if (!IN(q)) continue;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], any = false;
    for (const p of gV.near(q, 0.02)) { if (!ov(p, q, 0.02)) continue; any = true; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], Math.max(p.mn[k], q.mn[k])); hi[k] = Math.max(hi[k], Math.min(p.mx[k], q.mx[k])); } }
    const a = c._a;
    if (!any) { add('gorunmez', `${a.short} ${a.fn}`, { v: 9, at: fmt(ctr(q)), info: `kutu ${fmt(q.mn)}..${fmt(q.mx)}` }); continue; }
    const over = Math.max(...[0, 1, 2].flatMap((k) => [lo[k] - q.mn[k], q.mx[k] - hi[k]]));
    if (over >= 0.25) add('tasan', `${a.short} ${a.fn}`, { v: over, at: fmt(ctr(q)), info: `taşma ${over.toFixed(2)} m` });
  }
}
// 5 çarpışmasız katı görsel (gövde hizasında içinden geçilir)
{
  const gC = grid(colsAll, C);
  const inC = (x, y, z, near) => { for (const c of near) if (x >= c.min[0] - 0.05 && x <= c.max[0] + 0.05 && y >= c.min[1] - 0.05 && y <= c.max[1] + 0.05 && z >= c.min[2] - 0.05 && z <= c.max[2] + 0.05) return true; return false; };
  for (const p of PR) {
    if (p.fx || p.kind === 'ico' || !IN(p, -1.5) || p.color === '#22333f') continue;          // araç camı: mermi / görüş için bilerek çarpışmasız
    const sx = p.mx[0] - p.mn[0], sy = p.mx[1] - p.mn[1], sz = p.mx[2] - p.mn[2];
    if (Math.min(sx, sz) < 0.2 || Math.max(sx, sz) < 0.35 || sy < 0.5 || p.mn[1] > 1.6 || (p.mn[1] > 0.6 && p.mn[1] < 2.6 && false)) continue;
    if (p.mn[1] > 0.3 && !colsAll.length) continue;
    const near = [...gC.near(p, 0.1)].map((c) => c);
    const y0 = Math.max(p.mn[1], 0.3), y1 = Math.min(p.mx[1], 1.7); if (y1 <= y0) continue;
    let tot = 0, hit = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 4; k++) { tot++; if (inC(p.mn[0] + sx * (i + 0.5) / 4, y0 + (y1 - y0) * (j + 0.5) / 3, p.mn[2] + sz * (k + 0.5) / 4, near)) hit++; }
    if (hit / tot < 0.5) add('carpismasiz', `${p.short} ${p.fn}`, { v: sx * sz, at: fmt(ctr(p)), info: `${sx.toFixed(1)}×${sy.toFixed(1)}×${sz.toFixed(1)} örtü %${Math.round(hit / tot * 100)}` });
  }
}
// 6 kapı / merdiven / tünel ağzı önünde engel
{
  const gC = grid(colsAll, C);
  const blockers = (zone, ignore) => { const out = []; for (const c of gC.near(zone, 0)) { if (ignore(c)) continue; const q = pen(zone, C(c)); if (q[0] > 0.12 && q[1] > 0.1 && q[2] > 0.12) out.push(c); } return out; };
  for (const d of doors) {
    if (!IN({ mn: [d.A.x, 0, d.A.z], mx: [d.B.x, 0, d.B.z] })) continue;
    const alongX = Math.abs(d.B.x - d.A.x) > Math.abs(d.B.z - d.A.z);
    for (const s of [-1, 1]) {
      const off0 = d.t / 2 + 0.02, off1 = d.t / 2 + 1.1;
      const zone = alongX
        ? { mn: [Math.min(d.A.x, d.B.x) + 0.1, d.y0 + 0.25, d.A.z + (s > 0 ? off0 : -off1)], mx: [Math.max(d.A.x, d.B.x) - 0.1, d.y0 + 1.7, d.A.z + (s > 0 ? off1 : -off0)] }
        : { mn: [d.A.x + (s > 0 ? off0 : -off1), d.y0 + 0.25, Math.min(d.A.z, d.B.z) + 0.1], mx: [d.A.x + (s > 0 ? off1 : -off0), d.y0 + 1.7, Math.max(d.A.z, d.B.z) - 0.1] };
      const bl = blockers(zone, (c) => c._a.wall && c._a.obj === d.obj && (alongX ? c.max[2] - c.min[2] : c.max[0] - c.min[0]) <= d.t + 0.05);
      // kapı ekseni boyunca en geniş boş aralık: < min(1,2 m, kapı − 0,2) ise kapı tıkalı sayılır (geniş hangar ağzında tek kuyruk sorun değil)
      const k = alongX ? 0 : 2, a0 = zone.mn[k], a1 = zone.mx[k], iv = bl.map((c) => [Math.max(a0, c.min[k]), Math.min(a1, c.max[k])]).sort((p, q) => p[0] - q[0]);
      let cur = a0, gap = 0; for (const [p, q] of iv) { gap = Math.max(gap, p - cur); cur = Math.max(cur, q); } gap = Math.max(gap, a1 - cur);
      if (bl.length && gap < Math.min(1.2, a1 - a0 - 0.2)) for (const c of bl) add('kapi', `${d.short} kapı ← ${c._a.short} ${c._a.fn}`, { v: 1, at: fmt(ctr(zone)), info: `boş ${gap.toFixed(2)} m, engel ${fmt(c.min)}..${fmt(c.max)}` });
    }
  }
  for (const s of stairsRec) {
    if (!IN({ mn: s.lo, mx: s.hi })) continue;
    const [dx, dz] = s.dv, own = new Set(s.cs);
    const W = s.width / 2 - 0.1, top = s.hi[1];
    const end = (k, y, len) => { // k=-1 alt uç, +1 üst uç önündeki sahanlık
      const cx = (s.lo[0] + s.hi[0]) / 2, cz = (s.lo[2] + s.hi[2]) / 2;
      const ex = dx ? (k > 0 ? (dx > 0 ? s.hi[0] : s.lo[0]) : (dx > 0 ? s.lo[0] : s.hi[0])) : cx, ez = dz ? (k > 0 ? (dz > 0 ? s.hi[2] : s.lo[2]) : (dz > 0 ? s.lo[2] : s.hi[2])) : cz;
      const sx = dx ? k * dx : 0, sz = dz ? k * dz : 0;
      return dx ? { mn: [Math.min(ex, ex + sx * len) + 0.02 * sx, y + 0.3, cz - W], mx: [Math.max(ex, ex + sx * len) + 0.02 * sx, y + 1.7, cz + W] } : { mn: [cx - W, y + 0.3, Math.min(ez, ez + sz * len) + 0.02 * sz], mx: [cx + W, y + 1.7, Math.max(ez, ez + sz * len) + 0.02 * sz] };
    };
    for (const [nm, zone] of [['alt', end(-1, s.y0, 1.0)], ['üst', end(1, top, 0.9)]]) for (const c of blockers(zone, (c) => own.has(c))) add('merdiven', `${s.short} ${s.fn} ${nm} ucu ← ${c._a.short} ${c._a.fn}`, { v: 1, at: fmt(ctr(zone)), info: `engel ${fmt(c.min)}..${fmt(c.max)}` });
    // baş yüksekliği: basamağın 1,9 m üstüne kadar başka kutu
    for (const st of s.cs) { const z = { mn: [st.min[0] + 0.05, st.max[1] + 0.25, st.min[2] + 0.05], mx: [st.max[0] - 0.05, st.max[1] + 1.85, st.max[2] - 0.05] }; for (const c of blockers(z, (c) => own.has(c))) add('merdiven', `${s.short} ${s.fn} baş hizası ← ${c._a.short} ${c._a.fn}`, { v: 1, at: fmt(ctr(z)), info: `engel ${fmt(c.min)}..${fmt(c.max)}` }); }
  }
  // tünel ağızları: tünel taban kaplamasının iki ucunda 2 m
  const floors = PR.filter((p) => p.tunnel && p.flat && p.mx[1] - p.mn[1] <= 0.06 && (p.mx[0] - p.mn[0] > 8 || p.mx[2] - p.mn[2] > 8));
  for (const f of floors) {
    const ax = f.mx[0] - f.mn[0] > f.mx[2] - f.mn[2] ? 0 : 2, o = 2 - ax;
    for (const s of [-1, 1]) {
      const e = s > 0 ? f.mx[ax] : f.mn[ax], z = { mn: [0, 0.3, 0], mx: [0, 1.7, 0] };
      z.mn[ax] = Math.min(e + s * 0.6, e + s * 2.4); z.mx[ax] = Math.max(e + s * 0.6, e + s * 2.4); z.mn[o] = f.mn[o] + 0.5; z.mx[o] = f.mx[o] - 0.5;
      for (const c of blockers(z, (c) => c._a.obj === f.obj && c._a.tunnel)) add('tunel', `${f.short} tünel ağzı ← ${c._a.short} ${c._a.fn}`, { v: 1, at: fmt(ctr(z)), info: `engel ${fmt(c.min)}..${fmt(c.max)}` });
    }
  }
}
// 7 iç mekân eşyası duvara / bölmeye / merdivene / başka eşyaya giriyor
{
  const ITEMP = PR.filter((p) => p.itemId && !p.fx && !p.flat);
  const WALLP = PR.filter((p) => p.wall && !p.fx);
  const gW = grid(WALLP, (p) => p), gI = grid(ITEMP, (p) => p);
  const STP = stairsRec.flatMap((s) => s.cs.map((c) => ({ mn: c.min, mx: c.max, s })));
  const gT = grid(STP, (p) => p);
  for (const a of ITEMP) {
    for (const w of gW.near(a)) { const q = pen(a, w); if (q[0] > 0.025 && q[1] > 0.025 && q[2] > 0.025) add('esya', `${a.short} ${a.fn} → duvar`, { v: Math.min(...q), at: fmt(ctr(a)) }); }
    for (const t of gT.near(a)) { const q = pen(a, t); if (q[0] > 0.025 && q[1] > 0.025 && q[2] > 0.025) add('esya', `${a.short} ${a.fn} → merdiven`, { v: Math.min(...q), at: fmt(ctr(a)) }); }
    for (const b of gI.near(a)) { if (b.itemId === a.itemId || b.i < a.i) continue; const q = pen(a, b); if (q[0] > 0.025 && q[1] > 0.025 && q[2] > 0.025) add('esya', `${a.short} ${a.fn} → ${b.fn}`, { v: Math.min(...q), at: fmt(ctr(a)) }); }
  }
}
// 8 kalan z-fight: aynı yöne bakan, ≤2 mm eş düzlemli, farklı malzemeli, örtüşen (≥1 cm²) yüzler (görünür: aynı yüzü örten üçüncü katı yok sayılmaz → kaba üst sınır)
{
  const Z = PR.filter((p) => p.aa && !p.o.blending);
  const gZ = grid(Z, (p) => p);
  for (const a of Z) for (const b of gZ.near(a, 0.003)) {
    if (b.i <= a.i || a.key === b.key) continue;
    if (a.flat && b.flat) continue;
    for (let k = 0; k < 3; k++) {
      const o = [0, 1, 2].filter((x) => x !== k);
      const q0 = Math.min(a.mx[o[0]], b.mx[o[0]]) - Math.max(a.mn[o[0]], b.mn[o[0]]), q1 = Math.min(a.mx[o[1]], b.mx[o[1]]) - Math.max(a.mn[o[1]], b.mn[o[1]]);
      if (q0 < 0.01 || q1 < 0.01 || q0 * q1 < 1e-4) continue;
      if (k !== 1 && (a.kind === 'cyl' || b.kind === 'cyl')) continue;
      if (k === 1 && a.kind === 'cyl' && b.kind === 'cyl' && Math.hypot((a.mn[0] + a.mx[0] - b.mn[0] - b.mx[0]) / 2, (a.mn[2] + a.mx[2] - b.mn[2] - b.mx[2]) / 2) >= (a.mx[0] - a.mn[0] + b.mx[0] - b.mn[0]) / 2 - 0.01) continue;   // iki silindir kapağı: daireler değmiyor
      for (const side of [0, 1]) { const fa = side ? a.mx[k] : a.mn[k], fb = side ? b.mx[k] : b.mn[k]; if (k === 1 && !side) continue; if (Math.abs(fa - fb) <= 0.002) add('zfight', [a.short + ' ' + a.fn, b.short + ' ' + b.fn].sort().join('  ↔  '), { v: q0 * q1, at: fmt(ctr(a)) }); }
    }
  }
}
// 9 sınır dışı + doğuş / hedef katı içinde
{
  for (const c of colsAll) { if (c.min[0] < B.minX - 1.3 || c.max[0] > B.maxX + 1.3 || c.min[2] < B.minZ - 1.3 || c.max[2] > B.maxZ + 1.3) add('sinir', `${c._a.short} ${c._a.fn}`, { v: 1, at: fmt(ctr(C(c))) }); }
  const solidAt = (x, z, r = 0.45) => colsAll.find((c) => c.min[1] < 1.6 && c.max[1] > 0.25 && x > c.min[0] - r && x < c.max[0] + r && z > c.min[2] - r && z < c.max[2] + r);
  for (const t of ['blue', 'red']) for (const s of map.spawns[t]) { const c = solidAt(s.x, s.z); if (c) add('dogus', `${t} doğuşu ← ${c._a.short} ${c._a.fn}`, { v: 1, at: `${s.x},${s.z}` }); }
  for (const o of map.objectives) { const c = solidAt(o.x, o.z, 0.2); if (c) INFO.push(`hedef ${o.id} merkezi bir katının içinde (yalnız bilgi: sahnede bayrak yok, botlar r içinde rastgele noktaya gider) ← ${c._a.short} ${c._a.fn}`); }
}

// ── rapor ──
const NAMES = { icice: '1 iç içe (farklı nesne, ≥8 cm)', gomulu: '2 gömülü (≥%80 başka katının içinde)', havada: '3 havada duran öbek', gorunmez: '4a görünmez çarpışma (görseli yok)', tasan: '4b görselden ≥25 cm taşan çarpışma', carpismasiz: '5 çarpışmasız katı görsel (içinden geçilir)', kapi: '6a kapı önünde engel', merdiven: '6b merdiven ucunda / başında engel', tunel: '6c tünel ağzında engel', esya: '7 eşya duvara / merdivene / eşyaya giriyor', zfight: '8 kalan z-fight (çözüm sonrası)', sinir: '9a sınır dışı çarpışma', dogus: '9b katı içinde doğuş' };
const summary = {};
console.log(`\n=== ${mapId}: ${PR.length} görsel parça, ${colsAll.length} çarpışma, ${doors.length} kapı, ${stairsRec.length} merdiven · kurulum ${tBuild} ms · z-fight çözümü ${zres} yüz itti`);
for (const k of Object.keys(NAMES)) {
  const m = R[k] || new Map(); const n = [...m.values()].reduce((s, o) => s + o.n, 0);
  summary[k] = { gruplar: m.size, adet: n };
  console.log(`${NAMES[k].padEnd(46)} ${String(m.size).padStart(4)} grup  ${String(n).padStart(5)} adet`);
  if (V || process.env.SHOW?.split(',').includes(k)) for (const [key, o] of [...m].sort((a, b) => b[1].n - a[1].n).slice(0, +(process.env.TOP || 40))) console.log(`     ${String(o.n).padStart(4)}×  ${key}   @(${o.at})${o.worst ? ' ' + o.worst.toFixed(2) : ''}${o.info ? '  ' + o.info : ''}`);
}
if (V) for (const t of INFO) console.log('  bilgi: ' + t);
const total = Object.values(summary).reduce((n, o) => n + o.adet, 0);
console.log(`TOPLAM SORUN: ${total}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ map: mapId, summary, detail: Object.fromEntries(Object.entries(R).map(([k, m]) => [k, [...m].map(([key, o]) => ({ key, ...o }))])) }, null, 1));
