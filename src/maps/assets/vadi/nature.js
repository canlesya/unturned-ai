import * as THREE from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VK, PAL, makeInstMaterial } from './surface.js';

// VADİ v3 doğa (12.169):
//  · kaya: tohumlu dışbükey gövde (ConvexHull) — birleşik ağa girer (kaya sınıfı gölgelendirici), çarpışma = gövdenin İÇİNE çizilmiş en büyük eksen hizalı kutu
//  · ağaç (çam / meşe / huş) ve çalı / çimen / çiçek / kamış / çakıl: InstancedMesh (tür + parça başına tek ağ; bölge parçalarına ayrılır → görüş konisi dışı çizilmez)
//    gövde çarpışması = sekizgen gövdenin içine çizilmiş kare (iki dilim: gövde incelir), yaprak = bot görüşünü kesen yumuşak küre (map.sight)

// ───────── kaya ─────────
const ROCK_CACHE = new Map();
export const ROCK_BOXES = [   // 6 biçim × ≤ 6 iç kutu [x0, y0, z0, x1, y1, z1] (birim kaya çerçevesi) — scripts/vadirocks.mjs
  [[-0.2969, 0.137, -0.357, 0.2704, 0.7331, 0.3016], [-0.2401, 0.0873, -0.2971, 0.3271, 0.7828, 0.1818], [-0.3536, 0.3357, -0.357, 0.3839, 0.7331, 0.122], [-0.2969, 0.2861, -0.4168, -0.0133, 0.6834, 0.4213], [-0.2969, 0.137, -0.357, 0.2704, 0.6337, 0.3615], [-0.3536, 0.2861, -0.2372, 0.2704, 0.7828, 0.2417]],
  [[-0.3035, 0.2087, -0.3447, 0.3156, 0.7058, 0.3292], [-0.3598, 0.3578, -0.1762, 0.3719, 0.7555, 0.2731], [-0.2472, 0.1589, -0.2323, 0.2593, 0.6561, 0.3854], [-0.1909, 0.2087, -0.4009, 0.3156, 0.7555, -0.1763], [-0.2472, 0.1092, -0.0638, 0.0905, 0.8053, 0.2731], [-0.3598, 0.2584, -0.2885, 0.3719, 0.7058, 0.1046]],
  [[-0.3434, 0.1245, -0.1922, 0.3296, 0.7399, 0.3125], [-0.2313, 0.0732, -0.3043, 0.2735, 0.6373, 0.1442], [-0.3995, 0.4835, -0.2482, 0.2174, 0.7912, 0.2003], [-0.3995, 0.2271, -0.0239, 0.1052, 0.6373, 0.3685], [-0.2874, 0.1245, -0.2482, 0.3857, 0.5347, 0.3125], [-0.2874, 0.4322, 0.1443, 0.3857, 0.7399, 0.3685]],
  [[-0.3021, 0.2445, -0.3316, 0.3394, 0.7559, 0.3608], [-0.3604, 0.1934, -0.2162, 0.3394, 0.807, 0.2454], [-0.1854, 0.2445, -0.3894, 0.3977, 0.7047, 0.2454], [-0.3604, 0.1422, 0.0146, 0.3394, 0.7559, 0.3031], [-0.4187, 0.2957, -0.2739, -0.3022, 0.7559, 0.1299], [-0.1854, 0.1934, -0.2739, 0.2227, 0.6024, 0.4185]],
  [[-0.2861, 0.1939, -0.3549, 0.3517, 0.759, 0.2271], [-0.3441, 0.1939, -0.3549, 0.4097, 0.5535, 0.2853], [-0.2861, 0.1425, -0.2967, 0.3517, 0.3993, 0.3435], [-0.1701, 0.1939, -0.4132, 0.3517, 0.7076, 0.2853], [-0.3441, 0.1939, -0.1221, 0.2357, 0.8104, 0.2271], [-0.0541, 0.0911, -0.2385, 0.2357, 0.5535, 0.3435]],
  [[-0.1915, 0.3979, -0.2389, 0.3421, 0.7714, 0.281], [-0.2508, 0.2378, 0.05, 0.2235, 0.6646, 0.3966], [-0.3101, 0.6114, -0.2967, 0.1642, 0.8247, 0.281], [0.0457, 0.1845, -0.2967, 0.3421, 0.718, 0.0499], [-0.4287, 0.4513, 0.05, 0.3421, 0.718, 0.3388], [-0.0729, 0.1311, -0.0656, 0.2235, 0.3978, 0.3388]],
];
// varyant v (0..5): biçim tohumu. Birim boyut ±0,5 (x, z), y 0…1 (taban düz değil: alt yarısı gömülmek için)
export function rockShape(v) {
  if (ROCK_CACHE.has(v)) return ROCK_CACHE.get(v);
  let s = (v * 2654435761 + 977) >>> 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pts = [];
  const flat = 0.55 + 0.35 * r();                                    // üst düzlüğü
  for (let i = 0; i < 26; i++) {
    // süper-elips yüzeyinden nokta: kutuya yakın, köşeler yontulmuş
    const u = r() * Math.PI * 2, w = (r() * 2 - 1);
    const c = Math.sqrt(1 - w * w);
    let x = Math.cos(u) * c, z = Math.sin(u) * c, y = w;
    const k = 0.35;                                                  // kutuya yakın (iç kutular gövdenin ~%70'ini kaplar)
    x = Math.sign(x) * Math.abs(x) ** k; z = Math.sign(z) * Math.abs(z) ** k; y = Math.sign(y) * Math.abs(y) ** k;
    const j = 0.86 + 0.14 * r();
    pts.push(new THREE.Vector3(x * 0.5 * j, (y > 0 ? y * flat : y) * 0.5 * j + 0.5, z * 0.5 * j));
  }
  const hull = new ConvexHull().setFromPoints(pts);
  const planes = hull.faces.map((f) => [f.normal.x, f.normal.y, f.normal.z, f.constant]);      // iç: n·p ≤ constant (ConvexHull Face: constant = n · orta nokta)
  const box = new THREE.Box3().setFromPoints(pts);
  const boxes = ROCK_BOXES[v] ? ROCK_BOXES[v].map((q) => ({ min: q.slice(0, 3), max: q.slice(3) })) : inscribedBoxes(planes, box);     // tablo: scripts/vadirocks.mjs üretir (kurulumda 0,8 sn arama yok)
  const geo = new ConvexGeometry(pts);
  const out = { geo, planes, boxes, low: Math.min(...boxes.map((q) => q.min[1])), box: { min: box.min.toArray(), max: box.max.toArray() } };
  ROCK_CACHE.set(v, out);
  return out;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
// kaya yerleştir: (x, z) merkez, ölçek sx × sy × sz, q90: 0..3 (90° dönüş). seat: zemin kotu (ayak izinin en alçağı) → kaya, içine çizilmiş
// çarpışma kutusunun tabanı tam bu kota gelecek şekilde oturur (kutu altı boşluk yok; kayanın yuvarlak altı toprağa gömülü). y: doğrudan taban kotu.
export function rock(b, v, x, z, sx, sy, sz, q90 = 0, { seat = null, y = null, collide = true, color } = {}) {
  const R = rockShape(v % 6);
  const by = y ?? seat - R.low * sy;                    // en alçak iç kutunun tabanı zemine (seat) gelir
  const ry = q90 * Math.PI / 2, sw = q90 % 2 === 1;
  _m.compose(_p.set(x, by, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(sx, sy, sz));
  const col = color || (v % 3 === 0 ? PAL.rock : v % 3 === 1 ? PAL.rockD : PAL.rockL);
  b.withKind(VK.ROCK, () => b.addGeo(R.geo.clone(), col, _m.clone()));
  const top = by + R.box.max[1] * sy, bot = by + R.box.min[1] * sy;
  if (!collide) return { top, bot, by };
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const q of R.boxes) {
    const lx = (q.min[0] + q.max[0]) / 2 * sx, lz = (q.min[2] + q.max[2]) / 2 * sz;
    const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
    const ex = (q.max[0] - q.min[0]) * sx, ez = (q.max[2] - q.min[2]) * sz;
    b.collide(wx, by + q.min[1] * sy, wz, sw ? ez : ex, (q.max[1] - q.min[1]) * sy, sw ? ex : ez);
  }
  return { top, bot, by };
}


// içine çizilmiş kutular: gövdeyi 16³ hücreye böl, 8 köşesi de içeride olan hücreler (dışbükey → hücre tamamen içeride); açgözlü en çok yeni hacmi
// kapsayan en büyük kutu, en çok 6 kutu (her kutu tamamen gövdenin içinde → görünmez çarpışma yok; birleşim gövdenin ~%70'ini kaplar)
export function inscribedBoxes(planes, box) {
  const inside = (x, y, z) => { for (const q of planes) if (q[0] * x + q[1] * y + q[2] * z > q[3] - 0.003) return false; return true; };
  const N = 16, mn = box.min, sz = box.getSize(new THREE.Vector3()), cs = [sz.x / N, sz.y / N, sz.z / N];
  const cell = new Uint8Array(N * N * N), id = (i, j, k) => (k * N + j) * N + i;
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let ok = 1;
    for (let q = 0; q < 8 && ok; q++) if (!inside(mn.x + (i + (q & 1)) * cs[0], mn.y + (j + ((q >> 1) & 1)) * cs[1], mn.z + (k + ((q >> 2) & 1)) * cs[2])) ok = 0;
    cell[id(i, j, k)] = ok;
  }
  const boxes = [], used = new Uint8Array(N * N * N);
  for (let it = 0; it < 6; it++) {
    // önek toplamları: dolu hücre (full) ve henüz kapsanmamış dolu hücre (gain)
    const P1 = new Int32Array((N + 1) ** 3), P2 = new Int32Array((N + 1) ** 3), pid = (i, j, k) => (k * (N + 1) + j) * (N + 1) + i;
    for (let k = 1; k <= N; k++) for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) {
      const c1 = cell[id(i - 1, j - 1, k - 1)], c2 = c1 && !used[id(i - 1, j - 1, k - 1)] ? 1 : 0;
      for (const [P, v] of [[P1, c1], [P2, c2]]) P[pid(i, j, k)] = v + P[pid(i - 1, j, k)] + P[pid(i, j - 1, k)] + P[pid(i, j, k - 1)] - P[pid(i - 1, j - 1, k)] - P[pid(i - 1, j, k - 1)] - P[pid(i, j - 1, k - 1)] + P[pid(i - 1, j - 1, k - 1)];
    }
    const S = (P, i0, i1, j0, j1, k0, k1) => P[pid(i1, j1, k1)] - P[pid(i0, j1, k1)] - P[pid(i1, j0, k1)] - P[pid(i1, j1, k0)] + P[pid(i0, j0, k1)] + P[pid(i0, j1, k0)] + P[pid(i1, j0, k0)] - P[pid(i0, j0, k0)];
    let best = null, bg = 0;
    for (let i0 = 0; i0 < N; i0++) for (let i1 = i0 + 1; i1 <= N; i1++) for (let k0 = 0; k0 < N; k0++) for (let k1 = k0 + 1; k1 <= N; k1++) for (let j0 = 0; j0 < N; j0++) for (let j1 = j0 + 1; j1 <= N; j1++) {
      const vol = (i1 - i0) * (j1 - j0) * (k1 - k0);
      if (S(P1, i0, i1, j0, j1, k0, k1) !== vol) break;                // j1 büyüdükçe dolu kalmaz → bu j0 için dur
      const g = S(P2, i0, i1, j0, j1, k0, k1);
      if (g > bg) { bg = g; best = [i0, i1, j0, j1, k0, k1]; }
    }
    if (!best || bg < 4) break;
    const [i0, i1, j0, j1, k0, k1] = best;
    for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) used[id(i, j, k)] = 1;
    boxes.push({ min: [mn.x + i0 * cs[0], mn.y + j0 * cs[1], mn.z + k0 * cs[2]], max: [mn.x + i1 * cs[0], mn.y + j1 * cs[1], mn.z + k1 * cs[2]] });
  }
  return boxes;
}

// ───────── ağaç / çalı şablonları (örnekli) ─────────
// Her şablon: parçalar [{geo, kind, cast}] (yerel, taban = 0, ölçek 1) + gövde yarıçapı / boyu (çarpışma) + yaprak küreleri (bot görüşü)
function octFrustum(rb, rt, h, seg = 8) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, true); g.rotateY(Math.PI / seg); g.translate(0, h / 2, 0); return g; }     // açık uçlu: alt / üst kapak görünmez (gömülü / yaprak içinde)
function cone(r, h, y, seg = 7, rot = 0, open = false) { const g = new THREE.ConeGeometry(r, h, seg, 1, open); g.rotateY(rot); g.translate(0, y + h / 2, 0); return g; }
function blob(r, x, y, z, sy = 0.85, det = 1, seed = 0) {
  const g = new THREE.IcosahedronGeometry(r, det);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.9 + 0.2 * Math.abs(Math.sin(p.getX(i) * 7.1 + p.getY(i) * 3.3 + p.getZ(i) * 5.7 + seed)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * sy, p.getZ(i) * k); }
  g.translate(x, y, z); return g;
}
const merge = (gs) => { const o = gs.map((g) => (g.index ? g.toNonIndexed() : g)); for (const g of o) { g.deleteAttribute('uv'); g.deleteAttribute('normal'); } const m = mergeGeometries(o, false); m.computeVertexNormals(); return m; };
export const TREE = {
  pine: { trunk: [0.25, 0.2, 2.3], sight: [[0, 2.6, 0, 1.25], [0, 4.0, 0, 0.95], [0, 5.3, 0, 0.62]], h: 7.2 },
  oak: { trunk: [0.3, 0.25, 2.6], sight: [[0, 3.9, 0, 1.75], [0.95, 3.3, 0.4, 1.1], [-0.85, 3.5, -0.5, 1.15]], h: 5.6 },
  birch: { trunk: [0.18, 0.15, 3.0], sight: [[0, 4.2, 0, 1.15], [0.3, 5.2, 0.2, 0.8]], h: 6.2 },
  bush: { sight: [[0, 0.45, 0, 0.7]] },
};
let GEO = null;
// ağaç = gövde + yaprak TEK geometri (aBark: 1 gövde, 0 yaprak) → tür başına tek InstancedMesh (çizim çağrısı yarıya iner)
const tag = (g, v) => { const n = (g.index ? g.toNonIndexed() : g).attributes.position.count; const gg = g.index ? g.toNonIndexed() : g; gg.setAttribute('aBark', new THREE.Float32BufferAttribute(new Float32Array(n).fill(v), 1)); return gg; };
const mergeTree = (trunk, leaf) => { const a = tag(trunk, 1), b = tag(leaf, 0); for (const g of [a, b]) { g.deleteAttribute('uv'); g.deleteAttribute('normal'); } const m = mergeGeometries([a, b], false); m.computeVertexNormals(); return m; };
export function treeGeos() {
  if (GEO) return GEO;
  GEO = {
    pineTrunk: octFrustum(0.25, 0.12, 3.4),
    pineLeaf: merge([cone(1.55, 2.0, 1.5, 7, 0.0), cone(1.25, 1.8, 2.75, 7, 0.4), cone(0.95, 1.6, 3.9, 7, 0.8), cone(0.62, 1.5, 5.0, 7, 1.2)]),
    oakTrunk: merge([octFrustum(0.3, 0.2, 3.1), (() => { const g = new THREE.CylinderGeometry(0.09, 0.13, 1.4, 6); g.rotateZ(-0.8); g.translate(0.55, 2.6, 0.25); return g; })()]),
    oakLeaf: merge([blob(1.85, 0, 3.9, 0, 0.82, 1, 1), blob(1.15, 0.95, 3.3, 0.4, 0.9, 0, 2), blob(1.2, -0.85, 3.5, -0.5, 0.9, 0, 3)]),
    birchTrunk: octFrustum(0.18, 0.1, 4.6),
    birchLeaf: merge([blob(1.2, 0, 4.3, 0, 1.15, 1, 4), blob(0.85, 0.3, 5.3, 0.2, 1.0, 0, 5)]),
    bush: merge([blob(0.75, 0, 0.42, 0, 0.7, 0, 6), blob(0.55, 0.5, 0.32, 0.25, 0.8, 0, 7), blob(0.45, -0.45, 0.3, -0.3, 0.8, 0, 10)]),
    tuft: (() => { const gs = []; for (let k = 0; k < 4; k++) { const g = new THREE.ConeGeometry(0.035, 0.38 + (k % 3) * 0.08, 3, 1, true); g.translate(0, 0.19 + (k % 3) * 0.04, 0); g.rotateZ((k - 2) * 0.16); g.rotateY(k * 1.3); g.translate(Math.cos(k * 2.1) * 0.06, 0, Math.sin(k * 2.1) * 0.06); gs.push(g); } return merge(gs); })(),
    flower: merge([(() => { const g = new THREE.ConeGeometry(0.02, 0.34, 3, 1, true); g.translate(0, 0.17, 0); return g; })(), (() => { const g = new THREE.IcosahedronGeometry(0.06, 0); g.translate(0, 0.36, 0); return g; })()]),
    reed: (() => { const gs = []; for (let k = 0; k < 4; k++) { const g = new THREE.ConeGeometry(0.03, 1.0 + k * 0.15, 3, 1, true); g.translate(0, 0.5 + k * 0.07, 0); g.rotateZ((k - 1.5) * 0.12); g.rotateY(k * 1.7); g.translate(Math.cos(k * 1.9) * 0.08, 0, Math.sin(k * 1.9) * 0.08); gs.push(g); } return merge(gs); })(),
    pebble: (() => { const g = new THREE.IcosahedronGeometry(0.16, 0); g.scale(1.3, 0.55, 1); g.translate(0, 0.03, 0); return g; })(),
    // uzak (oyun alanı dışı) ağaçlar: aynı siluet, üçte bir üçgen (tek ağ: gövde + yaprak birlikte, örnek rengi yaprak; gövde koyu ton gölgelendiriciden)
    pineFar: mergeTree(octFrustum(0.25, 0.15, 1.3, 4), cone(1.6, 5.6, 1.0, 6, 0, true)),
    oakFar: mergeTree(octFrustum(0.3, 0.2, 2.6, 4), blob(2.0, 0, 3.8, 0, 0.82, 0, 8)),
    birchFar: mergeTree(octFrustum(0.18, 0.1, 3.0, 4), blob(1.3, 0, 4.4, 0, 1.15, 0, 9)),
  };
  GEO.pine = mergeTree(GEO.pineTrunk, GEO.pineLeaf); GEO.oak = mergeTree(GEO.oakTrunk, GEO.oakLeaf); GEO.birch = mergeTree(GEO.birchTrunk, GEO.birchLeaf);
  return GEO;
}
// gövde çarpışması: üç dilim (zemin −0,3…0,8 · 0,8…1,8 · 1,8…gövde tepesi), her dilim kendi ÜST ucundaki yarıçapın sekizgenine içten çizilmiş kare
export const TRUNK = { pine: [0.25, 0.12, 3.4], oak: [0.3, 0.2, 3.1], birch: [0.18, 0.1, 4.6] };
export function trunkCollide(b, x, y, z, s, kind) {
  const [rb, rt, th] = TRUNK[kind], ap = (r) => r * 0.9239 * 0.7071 * 2;
  const rAt = (hh) => rb + (rt - rb) * Math.min(1, hh / th);
  const cuts = [-0.3, 0.8, 1.8, th];
  for (let i = 0; i < 3; i++) {
    const y0 = cuts[i] * (i ? s : 1), y1 = cuts[i + 1] * s, q = ap(rAt(cuts[i + 1]) * s);
    b.collide(x, y + y0, z, q, y1 - y0, q);
  }
  return th * s;
}

// Örnek toplayıcı: tür → parça (bölge) → [matris, renk]; build() InstancedMesh'ler döndürür
export class Instancer {
  constructor(cell = 48, cells = {}) { this.cell = cell; this.cells = cells; this.sets = new Map(); }       // cells: tür başına bölge boyu (uzak ağaç / çimen: büyük bölge = az ağ)
  add(type, x, y, z, ry, s, color, sy = s) {
    const cs = this.cells[type] || this.cell, k = type + '|' + Math.floor(x / cs) + ',' + Math.floor(z / cs);
    let a = this.sets.get(k); if (!a) { a = { type, list: [] }; this.sets.set(k, a); }
    a.list.push([x, y, z, ry, s, sy, color]);
  }
  build(defs) {                     // defs[type] = { geo, mat, cast }
    const out = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
    for (const { type, list } of this.sets.values()) {
      const d = defs[type]; if (!d) continue;
      const im = new THREE.InstancedMesh(d.geo, d.mat, list.length);
      list.forEach(([x, y, z, ry, s, sy, col], i) => { m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), sc.set(s, sy, s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(col)); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.computeBoundingBox?.();
      im.castShadow = !!d.cast; im.receiveShadow = true;
      im.userData.vadiInst = type;
      out.push(im);
    }
    return out;
  }
}
export function instDefs() {
  const G = treeGeos();
  const leaf = makeInstMaterial(VK.LEAF), rockM = makeInstMaterial(VK.ROCK);
  const tDark = makeInstMaterial(VK.LEAF, { bark: '#5e4329' }), tBirch = makeInstMaterial(VK.LEAF, { bark: '#e2ddd0' });
  const grass = makeInstMaterial(VK.LEAF, { side: THREE.DoubleSide, roughness: 1 });
  return {
    pine: { geo: G.pine, mat: tDark, cast: true }, oak: { geo: G.oak, mat: tDark, cast: true }, birch: { geo: G.birch, mat: tBirch, cast: true },
    bush: { geo: G.bush, mat: leaf, cast: true },
    tuft: { geo: G.tuft, mat: grass, cast: false }, flower: { geo: G.flower, mat: grass, cast: false }, reed: { geo: G.reed, mat: grass, cast: false },
    pebble: { geo: G.pebble, mat: rockM, cast: false },
    pineFar: { geo: G.pineFar, mat: tDark, cast: true }, oakFar: { geo: G.oakFar, mat: tDark, cast: true }, birchFar: { geo: G.birchFar, mat: tBirch, cast: true },
  };
}
