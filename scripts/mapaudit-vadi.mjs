// Vadi harita denetimi (tarayıcısız): görsel parçaların gerçek dünya geometrisi (dışbükey: kutu / silindir / ico / prizma) + çarpışma kutuları + arazi.
//   node scripts/mapaudit-vadi.mjs [V=1 ayrıntı] [OUT=/tmp/x.json]
// Denetimler: havada kalan parça grupları (zemine / başka parçaya değmeyen), yamaçta altı boş kalan taban (≥10 cm), gömülü parça, iç içe geçen nesneler
// (çarpışma × çarpışma, görsel × görsel), görseli olmayan çarpışma (görünmez engel), çarpışmasız ama yürüme bölgesini kapatan görsel, z-fighting (yüz yüze + arazi
// ile eş düzlem + su kıyısı), patika / köprü üstündeki ağaç-kaya, sudaki nesne, sınır dışı oyun nesnesi.
import * as THREE from 'three';
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
import { TRAILS, VADI_BOUNDS, riverX, PADS } from '../src/maps/vadiLayout.js';
import { WATER_LEVEL } from '../src/maps/terrain.js';
import { NavGrid } from '../src/game/nav.js';

MapBuilder.zfix = true;
const V = !!process.env.V;
const parts = [];                     // {g, oid, bi, o, color, site, fns}
const bIdx = new WeakMap(); let nB = 0;
const _add = MapBuilder.prototype.addGeo;
MapBuilder.prototype.addGeo = function (geometry, color, local, o) {
  const r = _add.call(this, geometry, color, local, o);
  if (!bIdx.has(this)) bIdx.set(this, nB++);
  const st = new Error().stack.split('\n').slice(2, 16).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l));
  parts.push({ g: r.g, oid: r.g.userData.oid, bi: bIdx.get(this), o: o || {}, color, site: st.slice(0, 2).map((l) => l.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '')).join(' < '), fns: st.map((l) => (l.match(/^at (\S+) \(/) || [])[1] || '').join(',') });
  return r;
};
let zrep = 0;
const _build = MapBuilder.prototype.build;
MapBuilder.prototype.build = function () { const g = _build.call(this); if (this.zfightReport) zrep += this.zfightReport.length; return g; };

const t0 = Date.now();
const m = MAPS.vadi.build();
const T = m.terrain, H = (x, z) => T.heightAt(x, z);
const C = m.colliders;

// ── parça hazırlığı: köşe kümesi, AABB, yüzey düzlemleri (dışbükey içerme testi) ──
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
  p.foliage = /pine|oak/.test(p.fns) && !/^#5[ae]3d24$|^#5e4026$/.test(p.color) || /^çalı/.test(p.oid);
  p.soft = p.o.glow || p.o.transparent;
}
const inside = (p, x, y, z, eps = 0) => { for (const q of p.pl) if (q[0] * x + q[1] * y + q[2] * z - q[3] > eps) return false; return true; };
// ızgara
const G = 4, grid = new Map();
const cells = (mn, mx, f) => { for (let i = Math.floor(mn[0] / G); i <= Math.floor(mx[0] / G); i++) for (let j = Math.floor(mn[2] / G); j <= Math.floor(mx[2] / G); j++) f(i + ',' + j); };
P.forEach((p, i) => { if (p.mx[0] - p.mn[0] > 60 || p.mx[2] - p.mn[2] > 60) return; cells(p.mn, p.mx, (k) => (grid.get(k) || grid.set(k, []).get(k)).push(i)); });
const nearParts = (mn, mx, e = 0.05) => { const s = new Set(); cells([mn[0] - e, 0, mn[2] - e], [mx[0] + e, 0, mx[2] + e], (k) => { for (const i of grid.get(k) || []) s.add(i); }); return [...s].map((i) => P[i]).filter((q) => q.mn[0] <= mx[0] + e && q.mx[0] >= mn[0] - e && q.mn[1] <= mx[1] + e && q.mx[1] >= mn[1] - e && q.mn[2] <= mx[2] + e && q.mx[2] >= mn[2] - e); };
const cgrid = new Map();
C.forEach((c, i) => { if (c.max[0] - c.min[0] > 60 || c.max[2] - c.min[2] > 60) return; cells(c.min, c.max, (k) => (cgrid.get(k) || cgrid.set(k, []).get(k)).push(i)); });
const nearCol = (mn, mx, e = 0.05) => { const s = new Set(); cells([mn[0] - e, 0, mn[2] - e], [mx[0] + e, 0, mx[2] + e], (k) => { for (const i of cgrid.get(k) || []) s.add(i); }); return [...s].map((i) => C[i]).filter((c) => c.min[0] <= mx[0] + e && c.max[0] >= mn[0] - e && c.min[1] <= mx[1] + e && c.max[1] >= mn[1] - e && c.min[2] <= mx[2] + e && c.max[2] >= mn[2] - e); };
const inCol = (c, x, y, z, e = 0) => x >= c.min[0] - e && x <= c.max[0] + e && y >= c.min[1] - e && y <= c.max[1] + e && z >= c.min[2] - e && z <= c.max[2] + e;
const cat = (oid) => { const k = oid.split(':')[0]; return k === 'parça' ? 'parça' : k; };
const fmt = (v) => v.map((q) => q.toFixed(1)).join(',');
const objSite = new Map(); for (const p of P) if (!objSite.has(p.oid)) objSite.set(p.oid, p.site);
const label = (oid) => oid + ' [' + (objSite.get(oid) || '').replace(/:\d+(?= <|$)/g, (s) => s) + ']';
const main = P.filter((p) => p.bi === 0);

// ── 1) bağlantı: dokunan parçalar birleşir; araziye değmeyen bileşen = havada ──
const par = main.map((_, i) => i); const fnd = (i) => (par[i] === i ? i : (par[i] = fnd(par[i])));
const mIdx = new Map(main.map((p, i) => [p, i]));
const samp = (p) => p.S || (p.S = [...p.V, ...p.tris.map((t) => t.cen), ...p.tris.flatMap((t) => [[(t.A[0] + t.B[0]) / 2, (t.A[1] + t.B[1]) / 2, (t.A[2] + t.B[2]) / 2], [(t.B[0] + t.D[0]) / 2, (t.B[1] + t.D[1]) / 2, (t.B[2] + t.D[2]) / 2], [(t.A[0] + t.D[0]) / 2, (t.A[1] + t.D[1]) / 2, (t.A[2] + t.D[2]) / 2]])]);
const touch = (A, B) => { for (const v of samp(A)) if (inside(B, v[0], v[1], v[2], 0.06)) return true; for (const v of samp(B)) if (inside(A, v[0], v[1], v[2], 0.06)) return true; return false; };
for (const A of main) {
  for (const B of nearParts(A.mn, A.mx, 0.03)) { if (B.bi !== 0 || B === A) continue; const ia = mIdx.get(A), ib = mIdx.get(B); if (ia > ib || fnd(ia) === fnd(ib)) continue; if (touch(A, B)) par[fnd(ia)] = fnd(ib); }
}
const gnd = new Set();
const minGap = (p) => { let g = 1e9; for (const v of p.V) g = Math.min(g, v[1] - H(v[0], v[2])); return g; };
for (const p of main) { p.gap = minGap(p); if (p.gap <= 0.05) gnd.add(fnd(mIdx.get(p))); }
const comps = new Map();
main.forEach((p, i) => { const r = fnd(i); if (gnd.has(r)) return; (comps.get(r) || comps.set(r, []).get(r)).push(p); });
const outD = (q, v) => { let m = -1e9; for (const k of q.pl) m = Math.max(m, k[0] * v[0] + k[1] * v[1] + k[2] * v[2] - k[3]); return m; };   // dışbükey parçaya dışarıdan uzaklık (alt sınır)
const floating = [];
for (const ps of comps.values()) {
  const set = new Set(ps), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of ps) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p.mn[k]); mx[k] = Math.max(mx[k], p.mx[k]); }
  if ((mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]) < 0.003) continue;         // süs çıtası (cm ölçeği): yok say
  let sep = Math.min(...ps.map((p) => p.gap));                                       // en yakın destek: arazi ya da başka parça
  for (const q of nearParts(mn, mx, 0.4)) { if (set.has(q) || q.bi !== 0) continue; for (const p of ps) for (const v of samp(p)) sep = Math.min(sep, outD(q, v)); for (const v of samp(q)) for (const p of ps) sep = Math.min(sep, outD(p, v)); }
  if (sep < 0.08) continue;                                                          // birkaç cm: değiyor sayılır (süs ek yeri)
  floating.push({ oids: [...new Set(ps.map((p) => p.oid))], n: ps.length, gap: sep, h: Math.min(...ps.map((p) => p.gap)), at: ps[0].c, site: ps[0].site });
}

// ── 2) yamaçta altı boş taban: zemine yakın parçanın alt köşeleri araziden > 8 cm yukarıda ve altında başka parça yok ──
const gapObj = new Map();
for (const p of main) {
  if (p.foliage || p.soft || /^(asma|köprü)/.test(p.oid)) continue;
  if (p.mx[0] - p.mn[0] < 0.2 && p.mx[2] - p.mn[2] < 0.2) continue;
  const bot = p.V.filter((v) => v[1] < p.mn[1] + 0.03);
  if (bot.length < 3) continue;
  if (Math.min(...bot.map((v) => v[1] - H(v[0], v[2]))) > 0.05) continue;     // zemine hiç değmeyen parça (pencere süsü, çatı, üst üste sandık): bu denetim değil
  let worst = 0, wv = null;
  for (const v of bot) {
    const g = v[1] - H(v[0], v[2]);
    if (g <= 0.08) continue;
    const below = nearParts([v[0] - 0.01, v[1] - 0.1, v[2] - 0.01], [v[0] + 0.01, v[1] - 0.02, v[2] + 0.01], 0.02).some((q) => q !== p && inside(q, v[0], v[1] - 0.05, v[2], 0.03));
    if (below) continue;
    if (g > worst) { worst = g; wv = v; }
  }
  if (worst > 0.1) { const o = gapObj.get(p.oid) || { oid: p.oid, gap: 0, n: 0, at: null, site: p.site }; o.n++; if (worst > o.gap) { o.gap = worst; o.at = wv; o.site = p.site; o.pc = p.c; o.sz = [p.mx[0] - p.mn[0], p.mx[1] - p.mn[1], p.mx[2] - p.mn[2]]; } gapObj.set(p.oid, o); }
}
const gaps = [...gapObj.values()].sort((a, b) => b.gap - a.gap);

// ── 3) gömülü: tepe noktası araziden aşağıda kalan (görünmez) parça; ya da yüksekliğinin yarısından fazlası gömülü oyun nesnesi ──
const buried = [], sunk = [];
for (const p of main) {
  if (/foundation|temel|steppingStone/.test(p.fns) || /^(asma|köprü)/.test(p.oid)) continue;
  let top = -1e9; for (const v of p.V) top = Math.max(top, v[1] - H(v[0], v[2]));
  if (top < -0.01) { buried.push({ oid: p.oid, at: p.c, depth: -top, site: p.site }); continue; }
  const h = p.mx[1] - p.mn[1], bf = (H(p.c[0], p.c[2]) - p.mn[1]) / h;
  if (!p.foliage && h > 0.3 && bf > 0.55 && !/rock|stoneWall|ruin|rockTunnel|campfire/.test(p.fns) && cat(p.oid) !== 'kaya') sunk.push({ oid: p.oid, at: p.c, frac: bf, h, site: p.site });
}

// ── 4) iç içe: farklı nesnelerin çarpışma kutuları / görsel parçaları ──
const colPairs = new Map();
for (let i = 0; i < C.length; i++) {
  const a = C[i]; if (a.max[0] - a.min[0] > 60) continue;
  for (const b of nearCol(a.min, a.max, 0)) {
    if (b === a || b.oid === a.oid || C.indexOf(b) < i) continue;
    const px = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]), py = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]), pz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    if (px < 0.15 || py < 0.15 || pz < 0.15) continue;
    const k = [a.oid, b.oid].sort().join(' × ');
    if (!colPairs.has(k)) colPairs.set(k, { k, at: [(Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2, Math.max(a.min[1], b.min[1]), (Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2], pen: [px, py, pz] });
  }
}
const visPairs = new Map();
for (const A of main) {
  for (const B of nearParts(A.mn, A.mx, 0)) {
    if (B.bi !== 0 || B.oid === A.oid || B === A) continue;
    if (A.foliage && B.foliage) continue;                    // yaprak × yaprak doğal
    const k = [A.oid, B.oid].sort().join(' × ');
    if (visPairs.has(k)) continue;
    let deep = 0;
    for (const v of A.V) if (inside(B, v[0], v[1], v[2], -0.06)) { if (v[1] > H(v[0], v[2]) + 0.02) deep++; }
    if (deep) visPairs.set(k, { k, at: A.c, n: deep, a: A.site, b: B.site, ca: cat(A.oid), cb: cat(B.oid), fol: A.foliage || B.foliage });
  }
}

// ── 5) görünmez çarpışma: kutunun içi görsel parça ya da arazi ile örtülmüyor ──
const ghost = [];
for (const c of C) {
  if (c.max[0] - c.min[0] > 60) continue;
  const near = nearParts(c.min, c.max, 0.06).filter((q) => q.bi === 0);
  let tot = 0, cov = 0;
  const N = 4;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const x = c.min[0] + (c.max[0] - c.min[0]) * (i + 0.5) / N, y = c.min[1] + (c.max[1] - c.min[1]) * (j + 0.5) / N, z = c.min[2] + (c.max[2] - c.min[2]) * (k + 0.5) / N;
    tot++;
    if (y <= H(x, z) + 0.02 || near.some((q) => inside(q, x, y, z, 0.06))) cov++;
  }
  if (cov / tot < 0.75) ghost.push({ oid: c.oid, cov: cov / tot, size: [c.max[0] - c.min[0], c.max[1] - c.min[1], c.max[2] - c.min[2]], at: [(c.min[0] + c.max[0]) / 2, c.min[1], (c.min[2] + c.max[2]) / 2], tag: c.tag });
}

// ── 6) çarpışmasız katı görsel: yürüme bölgesinde (zemin +0,3…+1,7) hacmi var ama içinden geçiliyor ──
const walkThru = [];
for (const p of main) {
  if (p.foliage || p.soft) continue;
  if (p.mx[0] - p.mn[0] < 0.35 || p.mx[2] - p.mn[2] < 0.35) continue;
  const near = nearCol(p.mn, p.mx, 0.05);
  let tot = 0, cov = 0;
  const N = 6;
  for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) {
    const x = p.mn[0] + (p.mx[0] - p.mn[0]) * (i + 0.5) / N, z = p.mn[2] + (p.mx[2] - p.mn[2]) * (k + 0.5) / N, y = p.mn[1] + (p.mx[1] - p.mn[1]) * (j + 0.5) / N;
    const gy = H(x, z); if (y < gy + 0.3 || y > gy + 1.7) continue;
    if (!inside(p, x, y, z)) continue;
    tot++; if (near.some((c) => inCol(c, x, y, z, 0.05))) cov++;
  }
  const vol = (p.mx[0] - p.mn[0]) * (p.mx[1] - p.mn[1]) * (p.mx[2] - p.mn[2]) * tot / (N * N * N);
  if (tot >= 4 && cov / tot < 0.5 && vol > 0.15) walkThru.push({ oid: p.oid, at: p.c, cov: cov / tot, vol, color: p.color, site: p.site });
}

// ── 7) z-fighting: (a) builder'ın kendi çözdüğü yüz yüze çiftler (bilgi), (b) yukarı bakan yüzün araziyle eş düzlem olması, (c) su kıyısında araziyle su eş düzlem ──
const zTerr = [];
for (const p of main) {
  let area = 0, ok = 0;
  if (/foundation|temel/.test(p.fns)) continue;                               // temel üstü bilerek zeminin 2 cm altında (görünmez)
  for (const t of p.tris) { if (t.n[1] < 0.97) continue; area += t.area; const d = Math.abs(t.cen[1] - H(t.cen[0], t.cen[2])); if (d < 0.02 && !nearParts([t.cen[0], t.cen[1], t.cen[2]], [t.cen[0], t.cen[1] + 0.04, t.cen[2]], 0.01).some((q) => q !== p && inside(q, t.cen[0], t.cen[1] + 0.03, t.cen[2], 0.005))) ok += t.area; }   // üstü başka parçayla kapalı yüz görünmez: sayma
  if (area > 0.05 && ok / area > 0.25) zTerr.push({ oid: p.oid, at: p.c, frac: ok / area, color: p.color, site: p.site });
}
let zWater = 0;
for (let j = 0; j < T.nz; j++) for (let i = 0; i < T.nx; i++) { const x = T.minX + i * T.cell, z = T.minZ + j * T.cell; if (Math.abs(x - riverX(z)) > 12 || Math.abs(z) > 170) continue; const h = T.h[j * T.nx + i]; if (Math.abs(h - WATER_LEVEL) < 0.03) zWater++; }

// ── 8) patika / köprü üstünde ağaç-kaya, sudaki nesne, sınır dışı ──
const _o = {};
const trailD = (x, z) => { let best = 99; for (const t of TRAILS) { const q = t.near(x, z, _o); if (q) best = Math.min(best, q.d - t.w / 2); } return best; };
const objs = new Map();
for (const p of main) { const o = objs.get(p.oid) || { oid: p.oid, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], parts: [] }; for (let k = 0; k < 3; k++) { o.mn[k] = Math.min(o.mn[k], p.mn[k]); o.mx[k] = Math.max(o.mx[k], p.mx[k]); } o.parts.push(p); objs.set(p.oid, o); }
const onPath = [], inWater = [], oob = [];
const bridge = objs.get('köprü');
for (const o of objs.values()) {
  const k = cat(o.oid), cx = (o.mn[0] + o.mx[0]) / 2, cz = (o.mn[2] + o.mx[2]) / 2;
  if (k === 'ağaç') {
    const trunk = o.parts.find((p) => !p.foliage) || o.parts[0];
    const tx = trunk.c[0], tz = trunk.c[2];
    if (trailD(tx, tz) < 0.6) onPath.push({ oid: o.oid, at: trunk.c, d: trailD(tx, tz), what: 'gövde patikada' });
    if (bridge && o.mx[0] > bridge.mn[0] && o.mn[0] < bridge.mx[0] && o.mx[2] > bridge.mn[2] && o.mn[2] < bridge.mx[2]) onPath.push({ oid: o.oid, at: trunk.c, what: 'köprü üstünde' });
  }
  if (k === 'kaya') {
    const c = C.find((q) => q.oid === o.oid);
    if (c) { let dmin = 99; for (const [x, z] of [[c.min[0], c.min[2]], [c.max[0], c.min[2]], [c.min[0], c.max[2]], [c.max[0], c.max[2]], [cx, cz]]) dmin = Math.min(dmin, trailD(x, z)); if (dmin < 0) onPath.push({ oid: o.oid, at: [cx, o.mn[1], cz], d: dmin, what: 'kaya patika yatağında' }); }
  }
  if (k !== 'köprü' && k !== 'asma') {
    const wet = o.parts.filter((p) => !p.foliage && !/steppingStone/.test(p.fns) && H(p.c[0], p.c[2]) < WATER_LEVEL - 0.03 && Math.abs(p.c[0] - riverX(p.c[2])) < 12);
    if (wet.length) inWater.push({ oid: o.oid, at: wet[0].c, n: wet.length, ground: H(wet[0].c[0], wet[0].c[2]), site: wet[0].site });
  }
  if (!/^(ağaç|kaya|çalı)$/.test(k) && (cx < VADI_BOUNDS.minX - 1 || cx > VADI_BOUNDS.maxX + 1 || cz < VADI_BOUNDS.minZ - 1 || cz > VADI_BOUNDS.maxZ + 1)) oob.push({ oid: o.oid, at: [cx, o.mn[1], cz] });
}
// ağaç gövdesi yapı düzlüğünde / yapı çarpışmasına değiyor
const treeInBuild = [];
for (const o of objs.values()) {
  if (cat(o.oid) !== 'ağaç') continue;
  const hit = new Set();
  const trunk = o.parts.filter((q) => !q.foliage);                                 // yalnız gövde: dallar kayanın / çatının üstüne sarkabilir (doğal)
  for (const p of trunk) for (const c of nearCol(p.mn, p.mx, 0)) { if (c.oid === o.oid || c.tag === 'deck' || /^ağaç/.test(c.oid)) continue; if (p.V.some((v) => inCol(c, v[0], v[1], v[2], -0.05))) hit.add(c.oid); }
  if (hit.size) treeInBuild.push({ oid: o.oid, with: [...hit], at: o.parts[0].c });
}
// dekor (çimen / çiçek / kamış / çakıl) havada
let decFloat = 0, decN = 0;
for (const p of parts) { if (p.bi !== 1 || /^#(f2e46a|ee6f9c|f6f2ea|a98be8|ff9b4a)$/.test(p.color)) continue;   // çiçek başı sapın ucunda (bilerek yerden yüksek)
  decN++; const a = p.g.attributes.position.array; let mn = 1e9, mx = 0; for (let i = 0; i < a.length; i += 3) mn = Math.min(mn, a[i + 1] - H(a[i], a[i + 2])); if (mn > 0.05) decFloat++; }

// ── 9) bot yolu: mavi doğuştan yürünebilen alan, hedeflere / kırmızı doğuşa erişim, doğuşun zemin / geometri durumu ──
const nav = new NavGrid(m.colliders, m.bounds, m.terrain, !!m.layered);
const sb = m.spawns.blue[0], seen = nav.reachable(sb.x, sb.z);
let reach = 0; for (let i = 0; i < seen.length; i++) reach += seen[i];
const reachAt = (x, z) => { const i = nav.nearestFree(x, z); return i >= 0 && seen[i] === 1; };
const unreach = [...m.objectives.map((o) => [o.name, o.x, o.z]), ...m.spawns.red.map((s, i) => ['kırmızı doğuş ' + i, s.x, s.z]), ...m.spawns.blue.map((s, i) => ['mavi doğuş ' + i, s.x, s.z])].filter(([, x, z]) => !reachAt(x, z)).map((q) => q[0]);
const vp = [...visPairs.values()];
const sum = {
  parca: main.length, carpisma: C.length, sure_ms: Date.now() - t0,
  havada_grup: floating.length,
  alti_bos_taban: gaps.length,
  gomulu_gorunmez: buried.length,
  yari_gomulu_nesne: sunk.length,
  ic_ice_carpisma: colPairs.size,
  ic_ice_gorsel: vp.filter((q) => !q.fol).length,
  ic_ice_yaprak_yapi: vp.filter((q) => q.fol).length,
  gorunmez_carpisma: ghost.length,
  carpismasiz_kati_gorsel: walkThru.length,
  zfight_cozulen_yuz: zrep,
  zfight_arazi: zTerr.length,
  su_kiyisi_esduzlem_dugum: zWater,
  patika_kopru_ustu: onPath.length,
  agac_yapiya_giriyor: treeInBuild.length,
  sudaki_nesne: inWater.length,
  sinir_disi: oob.length,
  dekor_havada: decFloat + "/" + decN,
  nav_erisilen_hucre: reach, nav_erisilemeyen_hedef: unreach.length ? unreach.join(", ") : 0, gorus_kuresi: (m.sight || []).length,
};
console.log('VADİ DENETİM', JSON.stringify(sum, null, 1));
const show = (t, arr, f, n = 40) => { if (!arr.length) return; console.log(`\n-- ${t} (${arr.length})`); for (const x of arr.slice(0, n)) console.log('  ' + f(x)); };
if (V) {
  show('havada', floating.sort((a, b) => b.gap - a.gap), (x) => `${x.oids.slice(0, 3).join(',')} n${x.n} ayrık ${x.gap.toFixed(2)} yerden ${x.h.toFixed(2)} @${fmt(x.at)} ${x.site}`, 300);
  show('altı boş taban', gaps, (x) => `${x.oid} ${x.gap.toFixed(2)} m (${x.n} parça) köşe @${fmt(x.at)} parça ${fmt(x.pc)} boy ${fmt(x.sz)} ${x.site}`, 400);
  show('gömülü görünmez', buried, (x) => `${x.oid} ${x.depth.toFixed(2)} @${fmt(x.at)} ${x.site}`);
  show('yarı gömülü', sunk, (x) => `${x.oid} %${(x.frac * 100).toFixed(0)} h${x.h.toFixed(2)} @${fmt(x.at)} ${x.site}`);
  show('iç içe çarpışma', [...colPairs.values()], (x) => `${x.k} pen ${fmt(x.pen)} @${fmt(x.at)}`, 60);
  show('iç içe görsel (yapı)', vp.filter((q) => !q.fol), (x) => `${x.k} ${x.n} köşe @${fmt(x.at)}  ${x.a}  ×  ${x.b}`, 60);
  show('yaprak × yapı', vp.filter((q) => q.fol), (x) => `${x.k} @${fmt(x.at)}  ${x.a}  ×  ${x.b}`, 30);
  show('görünmez çarpışma', ghost.sort((a, b) => a.cov - b.cov), (x) => `${x.oid} %${(x.cov * 100).toFixed(0)} ${fmt(x.size)} @${fmt(x.at)} ${x.tag || ''} ${label(x.oid)}`, 60);
  show('çarpışmasız katı görsel', walkThru.sort((a, b) => b.vol - a.vol), (x) => `${x.oid} %${(x.cov * 100).toFixed(0)} ${x.vol.toFixed(2)} m³ ${x.color} @${fmt(x.at)} ${x.site}`, 60);
  show('z-fight arazi', zTerr, (x) => `${x.oid} %${(x.frac * 100).toFixed(0)} ${x.color} @${fmt(x.at)} ${x.site}`);
  show('patika / köprü', onPath, (x) => `${x.oid} ${x.what} ${x.d?.toFixed?.(2) ?? ''} @${fmt(x.at)}`);
  show('ağaç yapıya giriyor', treeInBuild, (x) => `${x.oid} × ${x.with.join(',')} @${fmt(x.at)}`);
  show('suda', inWater, (x) => `${x.oid} ${x.n} parça zemin ${x.ground.toFixed(2)} @${fmt(x.at)} ${x.site}`);
  show('sınır dışı', oob, (x) => `${x.oid} @${fmt(x.at)}`);
}
if (process.env.DBG) {                                         // DBG=x,y,z: o merkezli parçanın komşuları ve dokunma sonucu
  const [x, y, z] = process.env.DBG.split(',').map(Number);
  const A = main.find((p) => Math.abs(p.c[0] - x) < 0.3 && Math.abs(p.c[1] - y) < 0.3 && Math.abs(p.c[2] - z) < 0.3);
  console.log('A', A.oid, A.site, fmt(A.mn), fmt(A.mx), A.pl.length);
  for (const B of nearParts(A.mn, A.mx, 0.03)) { if (B === A) continue; console.log(" B", B.oid, B.site, fmt(B.mn), fmt(B.mx), "touch", touch(A, B), "root", fnd(mIdx.get(A)), fnd(mIdx.get(B)), gnd.has(fnd(mIdx.get(B))), mIdx.get(A), mIdx.get(B)); }
}
if (process.env.DBGG) {                                        // DBGG=x,y,z: parçanın alt köşeleri, boşluk ve altındaki adaylar
  const [x, y, z] = process.env.DBGG.split(',').map(Number);
  const A = main.find((p) => Math.abs(p.c[0] - x) < 0.3 && Math.abs(p.c[1] - y) < 0.3 && Math.abs(p.c[2] - z) < 0.3);
  console.log('A', A.oid, A.site, fmt(A.mn), fmt(A.mx));
  for (const v of A.V.filter((v) => v[1] < A.mn[1] + 0.03)) {
    const cand = nearParts([v[0] - 0.01, v[1] - 0.1, v[2] - 0.01], [v[0] + 0.01, v[1] - 0.02, v[2] + 0.01], 0.02).filter((q) => q !== A);
    console.log(' v', fmt(v), 'gap', (v[1] - H(v[0], v[2])).toFixed(2), cand.map((q) => q.site + ' ' + fmt(q.mn) + '..' + fmt(q.mx) + ' in=' + inside(q, v[0], v[1] - 0.05, v[2], 0.03)).join(' | '));
  }
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ sum, floating, gaps, buried, sunk, colPairs: [...colPairs.values()], vis: vp, ghost, walkThru, zTerr, onPath, treeInBuild, inWater, oob }, null, 1));
