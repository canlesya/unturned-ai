// Vadi otomatik hata taraması (12.169; tarayıcısız, önce / sonra karşılaştırması için TEK ölçüt seti):
//   node scripts/vadiscan.mjs [OUT=/tmp/wb-vadi/scan.json] [V=1 ayrıntı] [WALK=1500 fizik yürüyücü sayısı]
// Ölçütler (hepsi dünya geometrisi üstünde, MapBuilder kancalarıyla):
//   1 iç içe nesne (görsel): iki FARKLI nesnenin katı parçaları birbirine ≥ 6 cm giriyor (yaprak × yaprak hariç)
//   2 iç içe nesne (çarpışma): iki farklı nesnenin çarpışma kutuları üç eksende ≥ 5 cm örtüşüyor
//   3 parça içi iç içe (bilgi): aynı nesnede farklı renkli iki katı parça ≥ 3 cm iç içe
//   4 z-fighting: (a) aynı yöne bakan, ≤ 1,2 cm aralıklı, örtüşen farklı malzemeli yüz çifti (builder'ın İTEREK gizlediği dahil, ham sayı),
//     (b) yukarı bakan yüzün araziyle eş düzlem olması, (c) su düzlemiyle eş düzlem arazi düğümü
//   5 görünmez çarpışma: çarpışma kutusunun örnek noktalarının < %97'si görsel parça / arazi içinde (katı) → görünmeyen engel
//   6 çarpışmasız katı görsel: yürüme bandında (zemin +0,3…+1,7) ≥ 0,15 m³ katı hacim, çarpışma %50'den az
//   7 havada grup / altı boş taban (≥ 10 cm) / gömülü görünmez / yarı gömülü nesne
//   8 bina–arazi birleşimi: yapı ayak izinde arazinin tabanın üstüne çıkması (zemin içeri giriyor) ya da altının boşta kalması
//   9 sızıntı: fizik yürüyücüleri (World.move, rastgele yön + zıplama) → katı kutunun içine giren / arazinin altına inen / sınır dışı
//  10 nav: ulaşılamayan serbest cep (≥ 1,5 m²), erişilemeyen hedef / doğuş; doğuştan doğuşa görüş hattı
import * as THREE from 'three';
import fs from 'fs';
import { MapBuilder, makeRng } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
import { WATER_LEVEL } from '../src/maps/terrain.js';
import { NavGrid } from '../src/game/nav.js';
import { World, R as BODY_R } from '../src/game/collision.js';

MapBuilder.zfix = true;
const V = !!process.env.V;
const parts = [];
const bIdx = new WeakMap(); let nB = 0;
const _add = MapBuilder.prototype.addGeo;
MapBuilder.prototype.addGeo = function (geometry, color, local, o) {
  const r = _add.call(this, geometry, color, local, o);
  if (!bIdx.has(this)) bIdx.set(this, nB++);
  const st = new Error().stack.split('\n').slice(2, 16).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l));
  parts.push({ g: r.g, oid: r.g.userData.oid, bi: bIdx.get(this), o: o || {}, color, site: st.slice(0, 2).map((l) => l.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '')).join(' < '), fns: st.map((l) => (l.match(/^at (\S+) \(/) || [])[1] || '').join(',') });
  return r;
};
let zrep = 0; const zsites = [];
const _build = MapBuilder.prototype.build;
const _zr = MapBuilder.prototype._zrec;               // z-fight raporuna parça kimliği + çağrı yeri
MapBuilder.prototype._zrec = function (r, ...a) {
  const n = (this._zitems || []).length; _zr.call(this, r, ...a);
  if (this._zitems && this._zitems.length > n) { const st = new Error().stack.split('\n').slice(2, 8).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l)); this._zitems[n].site = r.g.userData.oid + ' ' + (st[0] || '').replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, ''); }
};
const zAll = [];                                   // bölge yapıcıları ayrı ayrı çözer; yapıcılar ARASI eş düzlem yüzler aşağıda birlikte taranır
MapBuilder.prototype.build = function () { const g = _build.call(this); if (this.zfightReport) { zrep += this.zfightReport.length; zsites.push(...this.zfightReport.slice(0, 50)); } if (this._zitems) zAll.push(...this._zitems); return g; };

const t0 = Date.now();
const m = MAPS.vadi.build();
const T = m.terrain, H = (x, z) => T.heightAt(x, z);
const C = m.colliders;
let AUD = m.audit;                                   // yeni harita denetim verisini kendisi verir; eski harita: vadiLayout.js
if (!AUD) { const L = await import('../src/maps/vadiLayout.js'); AUD = { riverX: L.riverX, trails: L.TRAILS, bounds: L.VADI_BOUNDS }; }
const riverX = AUD.riverX, BOUNDS = m.bounds;
// örnekli (instanced) görseller: m.audit.solids = [{oid, min, max, kind}] (kaya / gövde) — kutu yaklaşımıyla katı sayılır
// örnekli gövde: sekizgen kesik koni (kenarlar eksenlere bakar) → yarı uzay düzlemleri
const frustum = ([x, y, z, rb, rt, h]) => {
  const ab = rb * 0.9239, at = rt * 0.9239, k = (at - ab) / h, pl = [[0, 1, 0, y + h], [0, -1, 0, -y]];
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, cx = Math.cos(a), cz = Math.sin(a); pl.push([cx, -k, cz, ab + cx * x + cz * z - k * y]); }
  return { mn: [x - rb, y, z - rb], mx: [x + rb, y + h, z + rb], pl };
};
const extraSolids = (AUD.solids || []).map((s) => (s.trunk ? { oid: s.oid, ...frustum(s.trunk), inst: true } : { oid: s.oid, mn: s.min, mx: s.max, foliage: !!s.foliage, pl: [[1, 0, 0, s.max[0]], [-1, 0, 0, -s.min[0]], [0, 1, 0, s.max[1]], [0, -1, 0, -s.min[1]], [0, 0, 1, s.max[2]], [0, 0, -1, -s.min[2]]], inst: true }));
// yapıcılar arası z-fighting (aynı yöne bakan, ≤ 1,2 cm, örtüşen farklı malzemeli yüzler)
{ const zb = new MapBuilder(); zb._zitems = zAll; const r = zb.resolveZFight(); zrep += r.length; zsites.push(...r.slice(0, 50)); }

// ── parça hazırlığı ──
const P = parts.filter((p) => p.g.attributes.position.count >= 12);
for (const p of P) {
  const a = p.g.attributes.position.array, n = a.length / 3;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], uniq = new Map();
  for (let i = 0; i < n; i++) { const v = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } uniq.set(v.map((q) => q.toFixed(3)).join(','), v); }
  p.mn = mn; p.mx = mx; p.V = [...uniq.values()];
  const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]; p.c = c;
  const pl = new Map(); p.tris = [];
  for (let i = 0; i < n; i += 3) {
    const A = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]], B = [a[i * 3 + 3], a[i * 3 + 4], a[i * 3 + 5]], D = [a[i * 3 + 6], a[i * 3 + 7], a[i * 3 + 8]];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    let nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const L = Math.hypot(...nn); if (L < 1e-7) continue;
    nn = nn.map((q) => q / L); let d = nn[0] * A[0] + nn[1] * A[1] + nn[2] * A[2];
    if (nn[0] * c[0] + nn[1] * c[1] + nn[2] * c[2] - d > 0) { nn = nn.map((q) => -q); d = -d; }
    pl.set(nn.map((q) => q.toFixed(3)).join(',') + '|' + d.toFixed(3), [nn[0], nn[1], nn[2], d]);
    p.tris.push({ n: nn, area: L / 2, cen: [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3, (A[2] + B[2] + D[2]) / 3], A, B, D });
  }
  p.pl = [...pl.values()];
  p.foliage = !!p.o.foliage || /pine|oak|foliage|leaf|canopy|bush|yaprak/i.test(p.fns) && !/trunk|gövde/i.test(p.fns) && !/^#5[ae]3d24$|^#5e4026$/.test(p.color) || /^(çalı|yaprak)/.test(p.oid);
  p.soft = p.o.glow || p.o.transparent || p.o.water;
}
const inside = (p, x, y, z, eps = 0) => { for (const q of p.pl) if (q[0] * x + q[1] * y + q[2] * z - q[3] > eps) return false; return true; };
const G = 4, grid = new Map();
const cells = (mn, mx, f) => { for (let i = Math.floor(mn[0] / G); i <= Math.floor(mx[0] / G); i++) for (let j = Math.floor(mn[2] / G); j <= Math.floor(mx[2] / G); j++) f(i + ',' + j); };
const SOL = [...P, ...extraSolids];
SOL.forEach((p, i) => { if (p.mx[0] - p.mn[0] > 60 || p.mx[2] - p.mn[2] > 60) return; cells(p.mn, p.mx, (k) => (grid.get(k) || grid.set(k, []).get(k)).push(i)); });
const nearParts = (mn, mx, e = 0.05) => { const s = new Set(); cells([mn[0] - e, 0, mn[2] - e], [mx[0] + e, 0, mx[2] + e], (k) => { for (const i of grid.get(k) || []) s.add(i); }); return [...s].map((i) => SOL[i]).filter((q) => q.mn[0] <= mx[0] + e && q.mx[0] >= mn[0] - e && q.mn[1] <= mx[1] + e && q.mx[1] >= mn[1] - e && q.mn[2] <= mx[2] + e && q.mx[2] >= mn[2] - e); };
const cgrid = new Map();
C.forEach((c, i) => { if (c.max[0] - c.min[0] > 60 || c.max[2] - c.min[2] > 60) return; cells(c.min, c.max, (k) => (cgrid.get(k) || cgrid.set(k, []).get(k)).push(i)); });
const nearCol = (mn, mx, e = 0.05) => { const s = new Set(); cells([mn[0] - e, 0, mn[2] - e], [mx[0] + e, 0, mx[2] + e], (k) => { for (const i of cgrid.get(k) || []) s.add(i); }); return [...s].map((i) => C[i]).filter((c) => c.min[0] <= mx[0] + e && c.max[0] >= mn[0] - e && c.min[1] <= mx[1] + e && c.max[1] >= mn[1] - e && c.min[2] <= mx[2] + e && c.max[2] >= mn[2] - e); };
const inCol = (c, x, y, z, e = 0) => x >= c.min[0] - e && x <= c.max[0] + e && y >= c.min[1] - e && y <= c.max[1] + e && z >= c.min[2] - e && z <= c.max[2] + e;
const cat = (oid) => oid.split(/[:/]/)[0];
const fmt = (v) => v.map((q) => (+q).toFixed(1)).join(',');
for (const p of P) p.main = AUD.allMain ? true : p.bi === 0;      // eski harita: 0 = yapı yapıcısı, 1 = dekor; yeni harita: bölge yapıcılarının hepsi
const main = P.filter((p) => p.main);
const solidMain = [...main.filter((p) => !p.soft), ...extraSolids];

// ── 1 / 3) iç içe görsel ──
const visPairs = new Map(), selfPairs = new Map();
for (const A of solidMain) {
  for (const B of nearParts(A.mn, A.mx, 0)) {
    if (B === A || B.soft || (!B.inst && !B.main)) continue;
    if (A.foliage || B.foliage) continue;
    const same = A.oid === B.oid;
    if (same && A.color === B.color) continue;
    const key = same ? A.oid + '#' + [A.color, B.color].sort().join('') : [A.oid, B.oid].sort().join(' × ');
    const map = same ? selfPairs : visPairs;
    if (map.has(key)) continue;
    const eps = same ? -0.03 : -0.06;
    const Vs = A.V || [[A.mn[0], A.mn[1], A.mn[2]], [A.mx[0], A.mn[1], A.mn[2]], [A.mn[0], A.mx[1], A.mn[2]], [A.mx[0], A.mx[1], A.mn[2]], [A.mn[0], A.mn[1], A.mx[2]], [A.mx[0], A.mn[1], A.mx[2]], [A.mn[0], A.mx[1], A.mx[2]], [A.mx[0], A.mx[1], A.mx[2]]];
    let deep = 0;
    for (const v of Vs) if (inside(B, v[0], v[1], v[2], eps) && v[1] > H(v[0], v[2]) + 0.02) deep++;
    if (deep) map.set(key, { k: key, at: A.c || [(A.mn[0] + A.mx[0]) / 2, A.mn[1], (A.mn[2] + A.mx[2]) / 2], n: deep, a: A.site || A.oid, b: B.site || B.oid });
  }
}
// ── 2) iç içe çarpışma ──
const colPairs = new Map();
for (let i = 0; i < C.length; i++) {
  const a = C[i]; if (a.max[0] - a.min[0] > 60) continue;
  for (const b of nearCol(a.min, a.max, 0)) {
    if (b === a || b.oid === a.oid || C.indexOf(b) < i) continue;
    const px = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]), py = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]), pz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    if (px < 0.05 || py < 0.05 || pz < 0.05) continue;
    const k = [a.oid, b.oid].sort().join(' × ');
    if (!colPairs.has(k)) colPairs.set(k, { k, at: [(Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2, Math.max(a.min[1], b.min[1]), (Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2], pen: [px, py, pz] });
  }
}
// ── 4) z-fighting ──
const zTerr = [];
for (const p of main) {
  if (p.soft) continue;
  let area = 0, ok = 0;
  for (const t of p.tris) { if (t.n[1] < 0.97) continue; area += t.area; const d = Math.abs(t.cen[1] - H(t.cen[0], t.cen[2])); const tn = T.normalAt(t.cen[0], t.cen[2]); if (d < 0.015 && t.n[0] * tn.x + t.n[1] * tn.y + t.n[2] * tn.z > 0.995 && !nearParts([t.cen[0], t.cen[1], t.cen[2]], [t.cen[0], t.cen[1] + 0.04, t.cen[2]], 0.01).some((q) => q !== p && inside(q, t.cen[0], t.cen[1] + 0.03, t.cen[2], 0.005))) ok += t.area; }
  if (area > 0.05 && ok / area > 0.25) zTerr.push({ oid: p.oid, at: p.c, frac: ok / area, color: p.color, site: p.site });
}
let zWater = 0;
const WL = AUD.waterLevel ?? WATER_LEVEL;
for (let j = 0; j < T.nz; j++) for (let i = 0; i < T.nx; i++) { const x = T.minX + i * T.cell, z = T.minZ + j * T.cell; if (Math.abs(x - riverX(z)) > 16) continue; const h = T.h[j * T.nx + i]; if (Math.abs(h - WL) < 0.03) zWater++; }
// ── 5) görünmez çarpışma (sıkı: %97) ──
const ghost = [];
for (const c of C) {
  if (c.max[0] - c.min[0] > 60) continue;
  const near = nearParts(c.min, c.max, 0.06).filter((q) => (q.inst || q.main) && !q.soft);
  let tot = 0, cov = 0; const N = 5;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const x = c.min[0] + (c.max[0] - c.min[0]) * (i + 0.5) / N, y = c.min[1] + (c.max[1] - c.min[1]) * (j + 0.5) / N, z = c.min[2] + (c.max[2] - c.min[2]) * (k + 0.5) / N;
    tot++;
    if (y <= H(x, z) + 0.02 || near.some((q) => inside(q, x, y, z, 0.03))) cov++;
  }
  if (cov / tot < 0.97) ghost.push({ oid: c.oid, cov: cov / tot, size: [c.max[0] - c.min[0], c.max[1] - c.min[1], c.max[2] - c.min[2]], at: [(c.min[0] + c.max[0]) / 2, c.min[1], (c.min[2] + c.max[2]) / 2], tag: c.tag });
}
// ── 6) çarpışmasız katı görsel ──
const walkThru = [];
for (const p of solidMain) {
  if (p.foliage || p.inst) continue;
  if (p.c[0] < BOUNDS.minX - 0.5 || p.c[0] > BOUNDS.maxX + 0.5 || p.c[2] < BOUNDS.minZ - 0.5 || p.c[2] > BOUNDS.maxZ + 0.5) continue;     // oyun alanı dışı (erişilemez) dekor
  if (p.mx[0] - p.mn[0] < 0.35 || p.mx[2] - p.mn[2] < 0.35) continue;
  const near = nearCol(p.mn, p.mx, 0.05);
  let tot = 0, cov = 0; const N = 6;
  for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) {
    const x = p.mn[0] + (p.mx[0] - p.mn[0]) * (i + 0.5) / N, z = p.mn[2] + (p.mx[2] - p.mn[2]) * (k + 0.5) / N, y = p.mn[1] + (p.mx[1] - p.mn[1]) * (j + 0.5) / N;
    const gy = H(x, z); if (y < gy + 0.3 || y > gy + 1.7) continue;
    if (!inside(p, x, y, z)) continue;
    tot++; if (near.some((c) => inCol(c, x, y, z, 0.05))) cov++;
  }
  const vol = (p.mx[0] - p.mn[0]) * (p.mx[1] - p.mn[1]) * (p.mx[2] - p.mn[2]) * tot / (N * N * N);
  if (tot >= 4 && cov / tot < 0.5 && vol > 0.15) walkThru.push({ oid: p.oid, at: p.c, cov: cov / tot, vol, color: p.color, site: p.site });
}
// ── 7) havada / altı boş / gömülü ──
const par = main.map((_, i) => i); const fnd = (i) => (par[i] === i ? i : (par[i] = fnd(par[i])));
const mIdx = new Map(main.map((p, i) => [p, i]));
const samp = (p) => p.S || (p.S = [...p.V, ...p.tris.map((t) => t.cen), ...p.tris.flatMap((t) => [[(t.A[0] + t.B[0]) / 2, (t.A[1] + t.B[1]) / 2, (t.A[2] + t.B[2]) / 2], [(t.B[0] + t.D[0]) / 2, (t.B[1] + t.D[1]) / 2, (t.B[2] + t.D[2]) / 2], [(t.A[0] + t.D[0]) / 2, (t.A[1] + t.D[1]) / 2, (t.A[2] + t.D[2]) / 2]])]);
const touch = (A, B) => { for (const v of samp(A)) if (inside(B, v[0], v[1], v[2], 0.06)) return true; for (const v of samp(B)) if (inside(A, v[0], v[1], v[2], 0.06)) return true; return false; };
for (const A of main) for (const B of nearParts(A.mn, A.mx, 0.03)) { if (B.inst || !B.main || B === A) continue; const ia = mIdx.get(A), ib = mIdx.get(B); if (ia > ib || fnd(ia) === fnd(ib)) continue; if (touch(A, B)) par[fnd(ia)] = fnd(ib); }
const gnd = new Set();
for (const p of main) { let g = 1e9; for (const v of p.V) g = Math.min(g, v[1] - H(v[0], v[2])); p.gap = g; if (g <= 0.05) gnd.add(fnd(mIdx.get(p))); }
const comps = new Map();
main.forEach((p, i) => { const r = fnd(i); if (gnd.has(r)) return; (comps.get(r) || comps.set(r, []).get(r)).push(p); });
const outD = (q, v) => { let mm = -1e9; for (const k of q.pl) mm = Math.max(mm, k[0] * v[0] + k[1] * v[1] + k[2] * v[2] - k[3]); return mm; };
const floating = [];
for (const ps of comps.values()) {
  const set = new Set(ps), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of ps) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p.mn[k]); mx[k] = Math.max(mx[k], p.mx[k]); }
  if ((mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]) < 0.003) continue;
  let sep = Math.min(...ps.map((p) => p.gap));
  for (const q of nearParts(mn, mx, 0.4)) { if (set.has(q) || !q.main) continue; for (const p of ps) for (const v of samp(p)) sep = Math.min(sep, outD(q, v)); if (q.V) for (const v of samp(q)) for (const p of ps) sep = Math.min(sep, outD(p, v)); }
  if (sep < 0.08) continue;
  floating.push({ oids: [...new Set(ps.map((p) => p.oid))], n: ps.length, gap: sep, at: ps[0].c, site: ps[0].site });
}
const gapObj = new Map();
for (const p of main) {
  if (p.foliage || p.soft || /^(asma|köprü)/.test(p.oid)) continue;          // köprü açıklığının altı bilerek boş (eski taramayla aynı istisna)
  if (p.mx[0] - p.mn[0] < 0.2 && p.mx[2] - p.mn[2] < 0.2) continue;
  const bot = p.V.filter((v) => v[1] < p.mn[1] + 0.03);
  if (bot.length < 3) continue;
  if (Math.min(...bot.map((v) => v[1] - H(v[0], v[2]))) > 0.05) continue;
  let worst = 0, wv = null;
  for (const v of bot) {
    const g = v[1] - H(v[0], v[2]);
    if (g <= 0.08) continue;
    if (nearParts([v[0] - 0.01, v[1] - 0.1, v[2] - 0.01], [v[0] + 0.01, v[1] - 0.02, v[2] + 0.01], 0.02).some((q) => q !== p && inside(q, v[0], v[1] - 0.05, v[2], 0.03))) continue;
    if (g > worst) { worst = g; wv = v; }
  }
  if (worst > 0.1) { const o = gapObj.get(p.oid) || { oid: p.oid, gap: 0, at: null, site: p.site }; if (worst > o.gap) { o.gap = worst; o.at = wv; o.site = p.site; } gapObj.set(p.oid, o); }
}
const gaps = [...gapObj.values()].sort((a, b) => b.gap - a.gap);
const buried = [], sunk = [];
for (const p of main) {
  if (/foundation|temel|footing|steppingStone|pile/i.test(p.fns) || /^(asma|köprü)/.test(p.oid)) continue;
  let top = -1e9; for (const v of p.V) top = Math.max(top, v[1] - H(v[0], v[2]));
  if (top < -0.01) { buried.push({ oid: p.oid, at: p.c, depth: -top, site: p.site }); continue; }
  const h = p.mx[1] - p.mn[1], bf = (H(p.c[0], p.c[2]) - p.mn[1]) / h;
  if (!p.foliage && h > 0.3 && bf > 0.55 && !/rock|boulder|kaya|stoneWall|ruin|rockTunnel|campfire/i.test(p.fns) && !/^kaya/.test(p.oid)) sunk.push({ oid: p.oid, at: p.c, frac: bf, h, site: p.site });
}
// ── 8) bina–arazi birleşimi: yapı ayak izinde arazi tabanın üstüne çıkıyor / altı boş ──
const objs = new Map();
for (const c of C) { if (c.tag === 'deck' || /^(asma|köprü)/.test(c.oid)) continue; const o = objs.get(c.oid) || { oid: c.oid, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], cs: [] }; for (let k = 0; k < 3; k++) { o.mn[k] = Math.min(o.mn[k], c.min[k]); o.mx[k] = Math.max(o.mx[k], c.max[k]); } o.cs.push(c); objs.set(c.oid, o); }
const junction = [];
for (const o of objs.values()) {
  const fx = o.mx[0] - o.mn[0], fz = o.mx[2] - o.mn[2];
  if (o.mx[1] - o.mn[1] < 2.2 || fx * fz < 6 || fx > 40 || fz > 40) continue;
  // taban: ayak izi içindeki en geniş yatay yüzey (zemin / döşeme) — görsel parçaların yukarı bakan, yerden en alçak geniş yüzleri
  const ps = main.filter((p) => p.oid === o.oid && !p.soft && !p.foliage);
  let floorY = null, best = 0;
  for (const p of ps) for (const t of p.tris) { if (t.n[1] < 0.97 || t.cen[1] > o.mn[1] + 1.2) continue; if (t.area > best) { best = t.area; floorY = t.cen[1]; } }
  if (floorY == null) continue;
  let poke = 0, hang = 0, pAt = null, hAt = null;
  for (let i = 0; i <= 8; i++) for (let k = 0; k <= 8; k++) {
    const x = o.mn[0] + 0.3 + (fx - 0.6) * i / 8, z = o.mn[2] + 0.3 + (fz - 0.6) * k / 8;
    const h = H(x, z), edge = i === 0 || i === 8 || k === 0 || k === 8;
    // içeride arazi döşemenin üstüne çıkmasın (zemin içeri giriyor / kapı eşiği gömülü)
    const cover = ps.some((p) => inside(p, x, h + 0.01, z, 0.01));
    if (h > floorY + 0.03 && !cover) { if (h - floorY > poke) { poke = h - floorY; pAt = [x, h, z]; } }
    // kenarda: taban parçasının altı boş (arazi tabanın en alt köşesinden aşağıda, altında başka parça yok)
    if (edge) { let lo = 1e9; for (const p of ps) if (x >= p.mn[0] - 0.05 && x <= p.mx[0] + 0.05 && z >= p.mn[2] - 0.05 && z <= p.mx[2] + 0.05 && p.mn[1] < floorY + 0.1) lo = Math.min(lo, p.mn[1]); if (lo < 1e8 && lo - h > hang) { hang = lo - h; hAt = [x, h, z]; } }
  }
  if (poke > 0.05 || hang > 0.08) junction.push({ oid: o.oid, poke, hang, floorY, pAt, hAt });
}
// ── 9) sızıntı: fizik yürüyücüleri ──
const world = new World(C, m.bounds, T);
const nav = new NavGrid(C, m.bounds, T, !!m.layered);
const sb = m.spawns.blue[0], seen = nav.reachable(sb.x, sb.z);
const free = []; for (let i = 0; i < seen.length; i += 7) if (seen[i]) free.push(i);
const rng = makeRng(99);
const NW = +(process.env.WALK || 1500);
const leaks = { icinde: 0, arazi_alti: 0, sinir_disi: 0, catida: 0 }, leakAt = [];
const roofTop = (x, z, y) => C.some((c) => c.tag === 'roof' && x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2] && Math.abs(y - c.max[1]) < 0.05);
for (let w = 0; w < NW; w++) {
  const i = free[Math.floor(rng() * free.length)];
  const s = { pos: new THREE.Vector3(nav.cx(i), 0, nav.cz(i)), vel: new THREE.Vector3(), height: 1.78, onGround: true };
  world.settle(s); s.onCollider = s.pos.y > H(s.pos.x, s.pos.z) + 0.001;      // oyunda doğuş gibi: kutu üstüne oturtulduysa üstünde başlar
  let yaw = rng() * 6.283, inN = 0, underN = 0;
  for (let st = 0; st < 30 * 12; st++) {
    if (st % 45 === 0) yaw += (rng() - 0.5) * 2.5;
    const sp = rng() < 0.3 ? 8.4 : 5.6;
    s.vel.x = Math.sin(yaw) * sp; s.vel.z = Math.cos(yaw) * sp;
    if (s.onGround && rng() < 0.04) s.vel.y = 5.2;
    world.move(s, 1 / 30);
    const p = s.pos;
    const inBox = C.find((c) => p.x + BODY_R - 0.05 > c.min[0] && p.x - BODY_R + 0.05 < c.max[0] && p.z + BODY_R - 0.05 > c.min[2] && p.z - BODY_R + 0.05 < c.max[2] && p.y + 1.6 > c.min[1] + 0.05 && p.y + 0.1 < c.max[1] - 0.05);
    // kalıcı olanı say (≥ 3 ardışık adım): fizik itmesinin tek karelik ara durumu sızıntı değil (sonraki adımda düzelir)
    inN = inBox ? inN + 1 : 0; underN = p.y < H(p.x, p.z) - 0.3 ? underN + 1 : 0;
    if (inN >= 3) { leaks.icinde++; leakAt.push(['içinde ' + inBox.oid + ' ' + (inBox.tag || ''), p.x, p.y, p.z]); break; }
    if (underN >= 3) { leaks.arazi_alti++; leakAt.push(['arazi altı', p.x, p.y, p.z]); break; }
    if (p.x < BOUNDS.minX - 0.01 || p.x > BOUNDS.maxX + 0.01 || p.z < BOUNDS.minZ - 0.01 || p.z > BOUNDS.maxZ + 0.01) { leaks.sinir_disi++; break; }
    if (s.onGround && roofTop(p.x, p.z, p.y)) { leaks.catida++; const rc = C.find((c) => c.tag === 'roof' && p.x > c.min[0] && p.x < c.max[0] && p.z > c.min[2] && p.z < c.max[2] && Math.abs(p.y - c.max[1]) < 0.05); leakAt.push(['çatı ' + (rc ? rc.oid : ''), p.x, p.y, p.z]); break; }
  }
}
// ── 10) nav cepleri, erişim, doğuş görüşü ──
const W = nav.w, Hh = nav.h, comp = new Uint8Array(W * Hh), islands = [];
for (let i = 0; i < W * Hh; i++) {
  if (nav.blocked[i] || seen[i] || comp[i]) continue;
  const stq = [i]; comp[i] = 1; let n = 0, sx = 0, sz = 0;
  while (stq.length) { const c = stq.pop(); n++; sx += nav.cx(c); sz += nav.cz(c); const cx = c % W, cz = (c / W) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= Hh) continue; const j = z * W + x; if (nav.blocked[j] || seen[j] || comp[j]) continue; comp[j] = 1; stq.push(j); } }
  if (n * 0.25 >= 1.5) islands.push({ area: n * 0.25, x: sx / n, z: sz / n });
}
const reachAt = (x, z) => { const i = nav.nearestFree(x, z); return i >= 0 && seen[i] === 1; };
const unreach = [...m.objectives.map((o) => [o.name, o.x, o.z]), ...m.spawns.red.map((s, i) => ['kırmızı doğuş ' + i, s.x, s.z]), ...m.spawns.blue.map((s, i) => ['mavi doğuş ' + i, s.x, s.z])].filter(([, x, z]) => !reachAt(x, z)).map((q) => q[0]);
let spawnLos = 0;
const o3 = new THREE.Vector3(), d3 = new THREE.Vector3();
for (const a of m.spawns.blue) for (const b of m.spawns.red) {
  o3.set(a.x, (a.y ?? H(a.x, a.z)) + 1.62, a.z); d3.set(b.x, (b.y ?? H(b.x, b.z)) + 1.62, b.z).sub(o3); const L = d3.length(); d3.normalize();
  const hit = world.raycast(o3, d3, L - 0.3); if (!hit) spawnLos++;
}
// patika / köprü üstü ağaç, sudaki nesne, sınır dışı
const _o = {};
const trailD = (x, z) => { let best = 99; for (const t of AUD.trails || []) { const q = t.near(x, z, _o); if (q) best = Math.min(best, q.d - t.w / 2); } return best; };
const treeOnPath = [];
for (const c of C) { if (!/^(ağaç|agac|tree)/.test(c.oid)) continue; const x = (c.min[0] + c.max[0]) / 2, z = (c.min[2] + c.max[2]) / 2; if (trailD(x, z) < 0.4) treeOnPath.push({ oid: c.oid, at: [x, c.min[1], z] }); }

const vp = [...visPairs.values()], sp = [...selfPairs.values()];
const sum = {
  parca: main.length + extraSolids.length, carpisma: C.length, sure_ms: Date.now() - t0,
  ic_ice_nesne_gorsel: vp.length,
  ic_ice_nesne_carpisma: colPairs.size,
  parca_ici_ic_ice_bilgi: sp.length,
  zfight_yuz_cifti: zrep,
  zfight_arazi: zTerr.length,
  zfight_su_kiyisi_dugum: zWater,
  gorunmez_carpisma: ghost.length,
  carpismasiz_kati_gorsel: walkThru.length,
  havada_grup: floating.length,
  alti_bos_taban: gaps.length,
  gomulu_gorunmez: buried.length,
  yari_gomulu_nesne: sunk.length,
  bina_arazi_birlesim: junction.length,
  sizinti: leaks, yuruyucu: NW,
  nav_cep: islands.length,
  nav_erisilemeyen: unreach.length ? unreach.join(', ') : 0,
  dogus_gorus_cifti: spawnLos + '/' + m.spawns.blue.length * m.spawns.red.length,
  agac_patikada: treeOnPath.length,
};
console.log('VADİ TARAMA', JSON.stringify(sum, null, 1));
const show = (t, arr, f, n = 40) => { if (!arr.length) return; console.log(`\n-- ${t} (${arr.length})`); for (const x of arr.slice(0, n)) console.log('  ' + f(x)); };
if (V) {
  show('iç içe nesne (görsel)', vp, (x) => `${x.k} ${x.n} köşe @${fmt(x.at)}  ${x.a} × ${x.b}`, 80);
  show('iç içe nesne (çarpışma)', [...colPairs.values()], (x) => `${x.k} pen ${fmt(x.pen)} @${fmt(x.at)}`, 80);
  show('parça içi iç içe', sp, (x) => `${x.k} ${x.n} @${fmt(x.at)} ${x.a} × ${x.b}`, 30);
  show('z-fight (yüz çifti, ilk 50)', zsites, (x) => `eksen ${x.a} ${x.side} @${x.at}  ${x.s1} × ${x.s2}`, 50);
  show('z-fight arazi', zTerr, (x) => `${x.oid} %${(x.frac * 100).toFixed(0)} ${x.color} @${fmt(x.at)} ${x.site}`);
  show('görünmez çarpışma', ghost.sort((a, b) => a.cov - b.cov), (x) => `${x.oid} %${(x.cov * 100).toFixed(0)} ${fmt(x.size)} @${fmt(x.at)} ${x.tag || ''}`, 80);
  show('çarpışmasız katı görsel', walkThru, (x) => `${x.oid} %${(x.cov * 100).toFixed(0)} ${x.vol.toFixed(2)} m³ @${fmt(x.at)} ${x.site}`);
  show('havada', floating, (x) => `${x.oids.slice(0, 3).join(',')} n${x.n} ayrık ${x.gap.toFixed(2)} @${fmt(x.at)} ${x.site}`, 60);
  show('altı boş taban', gaps, (x) => `${x.oid} ${x.gap.toFixed(2)} m @${fmt(x.at)} ${x.site}`, 60);
  show('gömülü', buried, (x) => `${x.oid} ${x.depth.toFixed(2)} @${fmt(x.at)} ${x.site}`);
  show('yarı gömülü', sunk, (x) => `${x.oid} %${(x.frac * 100).toFixed(0)} @${fmt(x.at)} ${x.site}`);
  show('bina-arazi', junction, (x) => `${x.oid} zemin içeri ${x.poke.toFixed(2)} m ${x.pAt ? '@' + fmt(x.pAt) : ''} · altı boş ${x.hang.toFixed(2)} m ${x.hAt ? '@' + fmt(x.hAt) : ''}`, 60);
  show('sızıntı', leakAt, (x) => `${x[0]} @${fmt(x.slice(1))}`, 40);
  show('nav cebi', islands, (x) => `(${x.x.toFixed(1)},${x.z.toFixed(1)}) ${x.area.toFixed(1)} m²`, 40);
  show('ağaç patikada', treeOnPath, (x) => `${x.oid} @${fmt(x.at)}`);
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ sum, vis: vp, col: [...colPairs.values()], self: sp, zTerr, ghost, walkThru, floating, gaps, buried, sunk, junction, leakAt, islands }, null, 1));
