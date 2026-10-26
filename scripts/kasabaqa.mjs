// Parça düzeyinde harita kalite taraması (tarayıcısız):  node scripts/kasabaqa.mjs [harita=kasaba] [--list] [--json=dosya]
// mapgeo.mjs nesne (çağrı yeri) düzeyinde sayar; bu betik HER görsel parçayı (box / cyl / ico / prism / özel dışbükey geometri) dünya
// koordinatında dışbükey çokyüzlü olarak kaydeder ve şunları sayar:
//   1 İÇ İÇE         : iki opak parça ≥ 1 cm iç içe (SAT; aynı nesnenin parçaları da sayılır). Yaprak ↔ yaprak / yaprak ↔ gövde hariç.
//   2 Z-FIGHT        : aynı yöne bakan, < 2 cm aralıklı iki yüzün ortak alanı ≥ 4 cm² (renk farkı aranmaz: kasaba gölgelendiricisi her parçaya ayrı ton verir).
//                      Builder'ın otomatik itmesinden ÖNCEKİ geometri sayılır (itme uzakta derinlik duyarlılığının altında kalır → titreşen piksel).
//   3 GÖRÜNMEZ ÇARP. : hacminin > %3'ü hiçbir opak parçanın içinde olmayan çarpışma kutusu (görünmez duvar / taşan çarpışma).
//   4 ÇARPIŞMASIZ    : gövde yüksekliğinde (0,25–1,8 m) en az 0,2 m kalın opak parça, hacminin > %50'si çarpışma dışında (içinden geçilen).
//   5 HAVADA         : temas grafiğinde (≤ 1 cm) zemine bağlanmayan parça kümesi.
//   6 GÖMÜK          : zeminin > 15 cm altına inen ya da tamamen zemin altında kalan parça (zemin levhası / uzak dağ hariç).
//   7 İNCE ŞERİT     : iki boyutu da < 3 cm opak parça (uzakta piksel altı, titreşir).
//   8 SINIR DIŞI     : çarpışma kutusu harita sınırının > 1,5 m dışında.
import * as THREE from 'three';
import fs from 'fs';
Error.stackTraceLimit = 40;
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';

const id = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'kasaba';
const LIST = process.argv.includes('--list'), JS = (process.argv.find((a) => a.startsWith('--json=')) || '').slice(7);
const SITE = /src[\/]maps[\/](.*?\.js):(\d+)/;
const siteOf = () => {
  const fr = new Error().stack.split('\n').map((l) => l.trim()).filter((l) => SITE.test(l) && !/builder\.js|kasabaqa|kasaba-shapes\.js|maps[\/]index\.js/.test(l));
  const a = fr[0] ? fr[0].match(SITE) : null, z = fr.length > 1 ? fr[fr.length - 1].match(SITE) : null;
  return a ? `${a[1]}:${a[2]}${z && z[2] !== a[2] ? '<' + z[1].replace(/^.*\//, '') + ':' + z[2] : ''}` : '?';
};

// ── kayıt: addGeo'dan geçen her geometri ──
const P = [];
const _addGeo = MapBuilder.prototype.addGeo;
MapBuilder.prototype.addGeo = function (geometry, color, local, o) {
  const r = _addGeo.call(this, geometry, color, local, o);
  const g = r.g, pos = g.attributes.position;
  const V = [];
  const key = new Set();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (key.has(k)) continue; key.add(k); V.push(new THREE.Vector3(x, y, z));
  }
  // yüz düzlemleri (üçgen normallerinden; yinelenenler birleşir) + kenar yönleri
  const N = [], E = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e = new THREE.Vector3();
  const addDir = (L, v) => { for (const q of L) if (Math.abs(q.dot(v)) > 0.9999) return; L.push(v.clone()); };
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(e.subVectors(c, a)); if (n.lengthSq() < 1e-12) continue; n.normalize();
    let dup = false; for (const q of N) if (q.n.dot(n) > 0.9999) { dup = true; break; }
    if (!dup) N.push({ n: n.clone(), d: n.dot(a) });
    for (const [p0, p1] of [[a, b], [b, c], [c, a]]) { e.subVectors(p1, p0); if (e.lengthSq() > 1e-10) addDir(E, e.normalize()); }
  }
  for (const f of N) { let mx = -1e9; for (const v of V) mx = Math.max(mx, v.dot(f.n)); f.d = mx; }    // dışbükey zarf düzlemi
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const v of V) { mn[0] = Math.min(mn[0], v.x); mn[1] = Math.min(mn[1], v.y); mn[2] = Math.min(mn[2], v.z); mx[0] = Math.max(mx[0], v.x); mx[1] = Math.max(mx[1], v.y); mx[2] = Math.max(mx[2], v.z); }
  const op = o || {};
  P.push({ i: P.length, V, N, E: E.length > 40 ? E.slice(0, 40) : E, mn, mx, color, oid: g.userData.oid, kind: g.userData.kind, site: siteOf(), see: !op.transparent, glow: !!op.glow, geoType: geometry.type });
  return r;
};
const _aabb = MapBuilder.prototype._aabb;
MapBuilder.prototype._aabb = function (...args) { const n0 = this.colliders.length; _aabb.apply(this, args); for (let i = n0; i < this.colliders.length; i++) this.colliders[i].site = siteOf(); };
MapBuilder.zfix = false;                                                  // ham geometri (itme öncesi)

const t0 = Date.now();
const M = MAPS[id].build();
const B = M.bounds, C = M.colliders;
const isGround = (p) => (p.mx[0] - p.mn[0]) > 150 || (p.mx[2] - p.mn[2]) > 150 || Math.hypot((p.mn[0] + p.mx[0]) / 2, (p.mn[2] + p.mx[2]) / 2) > Math.hypot(B.maxX, B.maxZ) + 60;
// koni (çam katmanı): üst yarıçap alt yarıçapın yarısından küçük silindir
for (const p of P) if (p.geoType === 'CylinderGeometry') { const top = p.V.filter((v) => v.y > p.mx[1] - 1e-3), bot = p.V.filter((v) => v.y < p.mn[1] + 1e-3); const rr = (L) => { let cx = 0, cz = 0; for (const v of L) { cx += v.x / L.length; cz += v.z / L.length; } let r = 0; for (const v of L) r = Math.max(r, Math.hypot(v.x - cx, v.z - cz)); return r; }; if (top.length && bot.length && rr(top) < rr(bot) * 0.5) p.cone = true; }
const foliage = (p) => p.geoType === 'IcosahedronGeometry' || p.cone || /^(yaprak|çalı)/.test(p.oid || '');
// ağaç gövdesi: zemine oturan dik silindir, ekseni yaprağın yatay izdüşümü içinde
const trunkIn = (T, Lf) => foliage(Lf) && T.geoType === 'CylinderGeometry' && !T.cone && T.mn[1] < 0.05 && (() => { const cx = (T.mn[0] + T.mx[0]) / 2, cz = (T.mn[2] + T.mx[2]) / 2; return cx > Lf.mn[0] && cx < Lf.mx[0] && cz > Lf.mn[2] && cz < Lf.mx[2]; })();
const inBounds = (p, m = 2) => (p.mn[0] + p.mx[0]) / 2 > B.minX - m && (p.mn[0] + p.mx[0]) / 2 < B.maxX + m && (p.mn[2] + p.mx[2]) / 2 > B.minZ - m && (p.mn[2] + p.mx[2]) / 2 < B.maxZ + m;
const scenery = (p) => (p.mn[0] + p.mx[0]) / 2 < B.minX - 30 || (p.mn[0] + p.mx[0]) / 2 > B.maxX + 30 || (p.mn[2] + p.mx[2]) / 2 < B.minZ - 30 || (p.mn[2] + p.mx[2]) / 2 > B.maxZ + 30;   // uzak dekor (dağ / tepe)
const opaque = P.filter((p) => p.see && !isGround(p) && !scenery(p));
const out = { map: id, parts: P.length, colliders: C.length, cats: {} };
const add = (cat, item) => (out.cats[cat] ||= []).push(item);
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);

// ── SAT: en büyük ayrılma (>0 ayrık; ≤0 iç içe, -değer = içe girme derinliği) ──
const _ax = [];
function sep(A, Q) {
  _ax.length = 0;
  for (const f of A.N) _ax.push(f.n); for (const f of Q.N) _ax.push(f.n);
  for (const ea of A.E) for (const eb of Q.E) { const c = new THREE.Vector3().crossVectors(ea, eb); if (c.lengthSq() > 1e-8) _ax.push(c.normalize()); }
  let best = -1e9;
  for (const ax of _ax) {
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const v of A.V) { const d = v.dot(ax); if (d < a0) a0 = d; if (d > a1) a1 = d; }
    for (const v of Q.V) { const d = v.dot(ax); if (d < b0) b0 = d; if (d > b1) b1 = d; }
    const g = Math.max(b0 - a1, a0 - b1);
    if (g > best) { best = g; if (best > 0.02) return best; }
  }
  return best;
}
const inside = (p, v, eps = 1e-4) => { if (v.x < p.mn[0] - eps || v.x > p.mx[0] + eps || v.y < p.mn[1] - eps || v.y > p.mx[1] + eps || v.z < p.mn[2] - eps || v.z > p.mx[2] + eps) return false; for (const f of p.N) if (f.n.dot(v) > f.d + eps) return false; return true; };
// yatay ızgara (4 m) ile komşu arama
const grid = (L, cell = 4) => { const G = new Map(); for (const p of L) for (let i = Math.floor(p.mn[0] / cell); i <= Math.floor(p.mx[0] / cell); i++) for (let k = Math.floor(p.mn[2] / cell); k <= Math.floor(p.mx[2] / cell); k++) { const q = i * 100000 + k; (G.get(q) || G.set(q, []).get(q)).push(p); } return { G, cell, near(x0, z0, x1, z1) { const s = new Set(); for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let k = Math.floor(z0 / cell); k <= Math.floor(z1 / cell); k++) for (const p of G.get(i * 100000 + k) || []) s.add(p); return s; } }; };
const PG = grid(opaque);
const ovAABB = (A, Q, m = 0) => !(Q.mn[0] > A.mx[0] + m || A.mn[0] > Q.mx[0] + m || Q.mn[1] > A.mx[1] + m || A.mn[1] > Q.mx[1] + m || Q.mn[2] > A.mx[2] + m || A.mn[2] > Q.mx[2] + m);

// ── 1) iç içe + 5) temas grafiği ──
const par = P.map((_, i) => i), find = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, uni = (i, j) => { i = find(i); j = find(j); if (i !== j) par[i] = j; };
{
  const S = opaque.slice().sort((a, b) => a.mn[0] - b.mn[0]), groups = new Map();
  let nPairs = 0;
  for (let i = 0; i < S.length; i++) {
    const A = S[i];
    for (let j = i + 1; j < S.length && S[j].mn[0] <= A.mx[0] + 0.01; j++) {
      const Q = S[j];
      if (!ovAABB(A, Q, 0.01)) continue;
      const s = sep(A, Q);
      if (s <= 0.01) uni(A.i, Q.i);
      if (s > -0.01) continue;
      if (foliage(A) && foliage(Q)) continue;                                                  // yaprak kümeleri doğal olarak iç içe
      if ((foliage(A) || foliage(Q)) && (A.oid === Q.oid || trunkIn(A, Q) || trunkIn(Q, A))) continue;   // yaprak ↔ kendi gövdesi
      nPairs++;
      const k = [A.site, Q.site].sort().join(' × ');
      const e = groups.get(k) || { n: 0, pen: 0 };
      e.n++; if (-s > e.pen) Object.assign(e, { pen: -s, at: `${f1((Math.max(A.mn[0], Q.mn[0]) + Math.min(A.mx[0], Q.mx[0])) / 2)},${f1((Math.max(A.mn[1], Q.mn[1]) + Math.min(A.mx[1], Q.mx[1])) / 2)},${f1((Math.max(A.mn[2], Q.mn[2]) + Math.min(A.mx[2], Q.mx[2])) / 2)}`, what: `${A.oid}(${A.color}) ↔ ${Q.oid}(${Q.color})` });
      groups.set(k, e);
    }
  }
  out.overlapPairs = nPairs;
  for (const [k, e] of [...groups].sort((a, b) => b[1].n - a[1].n)) add('1-ic-ice', `${String(e.n).padStart(5)}×  ${k}  (${e.at}) ≤${f2(e.pen)} m  ${e.what}`);
}
// ── 2) z-fight: yüz çokgenleri ──
{
  const faces = [];
  for (const p of opaque) {
    for (const f of p.N) {
      const on = p.V.filter((v) => Math.abs(v.dot(f.n) - f.d) < 1e-3);
      if (on.length < 3) continue;
      // düzlem tabanı
      const t1 = Math.abs(f.n.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(f.n).normalize() : new THREE.Vector3(1, 0, 0).cross(f.n).normalize(), t2 = new THREE.Vector3().crossVectors(f.n, t1);
      const pts = on.map((v) => [v.dot(t1), v.dot(t2)]);
      const poly = hull2(pts); if (poly.length < 3 || area2(poly) < 4e-4) continue;
      faces.push({ p, n: f.n, d: f.d, t1, t2, poly, on });
    }
  }
  // kova: normal yönü (kuantize) + düzlem uzaklığı (2 cm)
  const buck = new Map();
  const nk = (n) => `${Math.round(n.x * 200)},${Math.round(n.y * 200)},${Math.round(n.z * 200)}`;
  for (const F of faces) { const k = nk(F.n) + '|' + Math.round(F.d / 0.02); (buck.get(k) || buck.set(k, []).get(k)).push(F); }
  const groups = new Map(); let nZ = 0;
  for (const F of faces) {
    for (const dd of [-1, 0, 1]) {
      const L = buck.get(nk(F.n) + '|' + (Math.round(F.d / 0.02) + dd)); if (!L) continue;
      for (const G of L) {
        if (G.p.i <= F.p.i || G.p === F.p) continue;
        if (Math.abs(G.d - F.d) >= 0.0195 || G.n.dot(F.n) < 0.9999) continue;
        if (!ovAABB(F.p, G.p, 0.02)) continue;
        if (foliage(F.p) && foliage(G.p)) continue;
        if (F.p.oid === G.p.oid && F.p.color === G.p.color && F.p.kind === G.p.kind && /^ağaç/.test(F.p.oid || '')) continue;
        const pg = G.on.map((v) => [v.dot(F.t1), v.dot(F.t2)]), polyG = hull2(pg);
        const ar = area2(clip2(F.poly, polyG));
        if (ar < 4e-4) continue;
        nZ++;
        const k = [F.p.site, G.p.site].sort().join(' ↔ ');
        const e = groups.get(k) || { n: 0 }; e.n++; e.at ||= `${f1(F.on[0].x)},${f1(F.on[0].y)},${f1(F.on[0].z)} ${F.p.oid}(${F.p.color}) / ${G.p.oid}(${G.p.color}) Δ${(Math.abs(G.d - F.d) * 1000).toFixed(0)} mm ${(ar * 1e4).toFixed(0)} cm²`;
        groups.set(k, e);
      }
    }
  }
  out.zfight = nZ;
  for (const [k, e] of [...groups].sort((a, b) => b[1].n - a[1].n)) add('2-zfight', `${String(e.n).padStart(5)}×  ${k}  ${e.at}`);
}
function hull2(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-12) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 1e-12) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
function area2(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
function clip2(subj, clipP) {                                                   // Sutherland–Hodgman (ikisi de saat yönü tersine dışbükey)
  let outP = subj;
  for (let i = 0; i < clipP.length && outP.length; i++) {
    const a = clipP[i], b = clipP[(i + 1) % clipP.length], inp = outP; outP = [];
    const side = (q) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    for (let j = 0; j < inp.length; j++) {
      const P1 = inp[j], P2 = inp[(j + 1) % inp.length], s1 = side(P1), s2 = side(P2);
      if (s1 >= 0) outP.push(P1);
      if ((s1 >= 0) !== (s2 >= 0)) { const t = s1 / (s1 - s2); outP.push([P1[0] + (P2[0] - P1[0]) * t, P1[1] + (P2[1] - P1[1]) * t]); }
    }
  }
  return outP;
}
// ── 3) görünmez çarpışma (hacim örnekleme) ──
let rs = 12345; const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
{
  const solidVis = opaque.filter((p) => !foliage(p) || true);
  let nBad = 0, vol = 0;
  const groups = new Map();
  for (const c of C) {
    const dx = c.max[0] - c.min[0], dy = c.max[1] - c.min[1], dz = c.max[2] - c.min[2];
    if (dx > 150 || dz > 150) continue;
    const near = [...PG.near(c.min[0], c.min[2], c.max[0], c.max[2])].filter((p) => ovAABB(p, { mn: c.min, mx: c.max }, 0.01));
    const NS = 300; let miss = 0;
    const v = new THREE.Vector3();
    for (let s = 0; s < NS; s++) {
      v.set(c.min[0] + (0.02 + rnd() * 0.96) * dx, c.min[1] + (0.02 + rnd() * 0.96) * dy, c.min[2] + (0.02 + rnd() * 0.96) * dz);
      if (v.y < 0.005 && c.min[1] < 0) continue;                          // zemin altı (gömülü taban) sayılmaz
      let inn = false; for (const p of near) if (inside(p, v, 0.012)) { inn = true; break; }
      if (!inn) miss++;
    }
    const fr = miss / NS;
    if (fr > 0.03) {
      nBad++; vol += fr * dx * dy * dz;
      const k = c.site || '?', e = groups.get(k) || { n: 0, fr: 0 }; e.n++;
      if (fr > e.fr) Object.assign(e, { fr, at: `(${f1((c.min[0] + c.max[0]) / 2)},${f1(c.min[1])},${f1((c.min[2] + c.max[2]) / 2)}) ${f2(dx)}×${f2(dy)}×${f2(dz)} ${c.tag || ''} ${c.oid || ''}` });
      groups.set(k, e);
    }
  }
  out.invisible = nBad; out.invisibleVol = +vol.toFixed(2);
  for (const [k, e] of [...groups].sort((a, b) => b[1].n - a[1].n)) add('3-gorunmez-carpisma', `${String(e.n).padStart(5)}×  ${k}  en kötü %${(e.fr * 100).toFixed(0)} ${e.at}`);
}
// ── 4) çarpışmasız engel ──
{
  const CG = grid(C.filter((c) => c.max[0] - c.min[0] < 150).map((c) => ({ mn: c.min, mx: c.max, c })));
  let nBad = 0; const groups = new Map();
  for (const p of opaque) {
    if (foliage(p) || p.glow || !inBounds(p)) continue;
    const lo = Math.max(p.mn[1], 0.25), hi = Math.min(p.mx[1], 1.8);
    if (hi - lo < 0.2) continue;
    // yatay kalınlık: en küçük yatay genişlik (OBB değil AABB; dönük ince parça yanılmasın diye yüz normallerinden)
    let thin = 1e9;
    for (const f of p.N) { if (Math.abs(f.n.y) > 0.2) continue; let a = 1e9, b = -1e9; for (const v of p.V) { const d = v.dot(f.n); a = Math.min(a, d); b = Math.max(b, d); } thin = Math.min(thin, b - a); }
    if (thin < 0.2) continue;
    const near = [...CG.near(p.mn[0], p.mn[2], p.mx[0], p.mx[2])].map((q) => q.c);
    const NS = 120; let miss = 0, tot = 0; const v = new THREE.Vector3();
    for (let s = 0; s < NS * 4 && tot < NS; s++) {
      v.set(p.mn[0] + rnd() * (p.mx[0] - p.mn[0]), lo + rnd() * (hi - lo), p.mn[2] + rnd() * (p.mx[2] - p.mn[2]));
      if (!inside(p, v, -0.01)) continue; tot++;
      let inn = false; for (const c of near) if (v.x >= c.min[0] - 0.03 && v.x <= c.max[0] + 0.03 && v.y >= c.min[1] - 0.03 && v.y <= c.max[1] + 0.03 && v.z >= c.min[2] - 0.03 && v.z <= c.max[2] + 0.03) { inn = true; break; }
      if (!inn) miss++;
    }
    if (tot >= 20 && miss / tot > 0.5) {
      nBad++;
      const k = p.site, e = groups.get(k) || { n: 0 }; e.n++; e.at ||= `(${f1((p.mn[0] + p.mx[0]) / 2)},${f1(p.mn[1])},${f1((p.mn[2] + p.mx[2]) / 2)}) ${p.oid}(${p.color}) ${p.geoType}`;
      groups.set(k, e);
    }
  }
  out.noCollide = nBad;
  for (const [k, e] of [...groups].sort((a, b) => b[1].n - a[1].n)) add('4-carpismasiz-engel', `${String(e.n).padStart(5)}×  ${k}  ${e.at}`);
}
// ── 5) havada (temas grafiği; zemin y ≤ 1 cm) ──
{
  const grounded = new Set();
  for (const p of opaque) if (p.mn[1] <= 0.01) grounded.add(find(p.i));
  const comp = new Map();
  for (const p of opaque) { const r = find(p.i); if (grounded.has(r)) continue; (comp.get(r) || comp.set(r, []).get(r)).push(p); }
  let n = 0;
  for (const L of comp.values()) {
    if (L.every((p) => p.glow)) continue;
    n++;
    let lo = 1e9; for (const p of L) lo = Math.min(lo, p.mn[1]);
    add('5-havada', `${L.length} parça taban y=${f2(lo)} @(${f1(L[0].mn[0])},${f1(L[0].mn[2])}) ${[...new Set(L.map((p) => p.site))].slice(0, 2).join(' + ')} ${L[0].oid}(${L[0].color})`);
  }
  out.floating = n;
}
// ── 6) gömük, 7) ince şerit ──
{
  let nb = 0, nt = 0; const gt = new Map();
  for (const p of opaque) {
    if ((p.mn[1] < -0.15 || p.mx[1] < -0.005) && !foliage(p)) { nb++; add('6-gomuk', `${p.site} ${p.oid}(${p.color}) taban ${f2(p.mn[1])} @(${f1(p.mn[0])},${f1(p.mn[2])})`); }
    const d = [p.mx[0] - p.mn[0], p.mx[1] - p.mn[1], p.mx[2] - p.mn[2]].sort((a, b) => a - b);
    if (d[1] < 0.03 && !p.glow) { nt++; const e = gt.get(p.site) || 0; gt.set(p.site, e + 1); }
  }
  out.buried = nb; out.thin = nt;
  for (const [k, n] of [...gt].sort((a, b) => b[1] - a[1])) add('7-ince-serit', `${String(n).padStart(5)}×  ${k}`);
}
// ── 8) sınır dışı ──
{
  let n = 0;
  for (const c of C) { if (c.max[0] - c.min[0] > 150) continue; if (c.min[0] < B.minX - 1.5 || c.max[0] > B.maxX + 1.5 || c.min[2] < B.minZ - 1.5 || c.max[2] > B.maxZ + 1.5) { n++; add('8-sinir-disi', `${c.site} (${f1(c.min[0])},${f1(c.min[2])})`); } }
  out.outside = n;
}
// çizim / üçgen
{
  let meshes = 0, tris = 0;
  M.group.traverse((o) => { if (o.isMesh) { meshes++; const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
  out.meshes = meshes; out.tris = Math.round(tris);
}
const ms = Date.now() - t0;
console.log(`=== ${id}: ${P.length} parça (${opaque.length} opak), ${C.length} çarpışma kutusu, ${out.meshes} ağ / ${out.tris} üçgen (${ms} ms)`);
const rows = [['1 iç içe parça çifti', out.overlapPairs], ['2 z-fight yüz çifti', out.zfight], ['3 görünmez çarpışma kutusu', `${out.invisible} (${out.invisibleVol} m³)`], ['4 çarpışmasız engel', out.noCollide], ['5 havada küme', out.floating], ['6 gömük parça', out.buried], ['7 ince şerit (< 3 cm)', out.thin], ['8 sınır dışı çarpışma', out.outside]];
for (const [k, v] of rows) console.log(`  ${k.padEnd(30)} ${v}`);
for (const [cat, L] of Object.entries(out.cats)) { console.log(`--- ${cat} (${L.length} grup)`); for (const s of L.slice(0, LIST ? 400 : +(process.env.TOP || 8))) console.log('   ' + s); }
if (JS) fs.writeFileSync(JS, JSON.stringify(out, null, 1));
