// Harita geometri denetimi (tarayıcısız, görsel + çarpışma):  node scripts/mapgeo.mjs <harita> [--list] [--json=dosya]
// Her parça (box/cyl/ico/prism) dünya OBB'si ve onu yerleştiren DÜZEN çağrısıyla (harita dosyası:satır:sütun + dönmüş yarı) kaydedilir; aynı çağrının parçaları bir nesnedir.
//   1 KESİŞEN NESNE   : farklı nesnelerin opak parçaları (OBB, SAT) ≥3 cm iç içe (zemin kaplaması / yol / çizgi hariç)
//   2 HAVADA NESNE    : nesnenin en alt yüzü zemin/arazinin >5 cm üstünde ve altında taşıyıcı yüz yok
//   3 GÖMÜK NESNE     : nesnenin altı zeminin >25 cm altında (tepe / dağ / zemin levhası hariç)
//   4 ALT BOŞLUK      : zemine oturan parçanın bir alt köşesinde arazi >5 cm aşağıda (yamaçta duvar altı boşluğu)
//   5 Z-FIGHT         : aynı yöne bakan farklı malzemeli çakışık yüzler (MapBuilder.resolveZFight'ın düzelttiği / ikinci geçişte kalan)
//   6 GÖRSELSİZ ÇARPIŞMA: hacminin <%25'i görünen parçayla dolu çarpışma kutusu (görünmez duvar)
//   7 ÇARPIŞMASIZ ENGEL: gövde yüksekliğinde (0,2–1,9 m), ≥0,25 m kalın opak süs; çarpışmayla örtülmemiş (içinden geçilen)
//   8 KAPI ÖNÜ ENGEL  : duvar kapı açıklığının iki yanında 0,9 m içinde gövde yüksekliğinde çarpışma
//   9 SINIR DIŞI      : çarpışmalı nesne harita sınırının >1,5 m dışında
//  10 YOL ÜSTÜ        : ≥2,2 m yüksek yapı (araç değil) asfalt kaplamanın üstünde (yola taşan bina / duvar)
import * as THREE from 'three';
Error.stackTraceLimit = 60;
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const id = process.argv[2] || 'kasaba', LIST = process.argv.includes('--list'), JS = (process.argv.find((a) => a.startsWith('--json=')) || '').slice(7);
const LAYOUT = /src[\/]maps[\/]([a-zA-Z]+)\.js:(\d+):(\d+)/;
const HELPER = /^at (lamp|cont|tree|shrub|stone|car|ftree|road|walk|dashX|dashZ) \(/;
const MAPFILE = new RegExp(`(^|[\\/])(${id}|${id}Layout|${id}Edits)\\.js:`);
const siteOf = () => {                                                    // nesne = haritanın kendi dosyasındaki EN İÇ çağrı satırı; en dış çağrı farklıysa (simetrik yarılar: half(VA) / half(VB)) ·satır eki
  const fr = new Error().stack.split('\n').map((l) => l.trim()).filter((l) => LAYOUT.test(l) && !/builder\.js|mapgeo\.mjs/.test(l));
  const own = fr.filter((l) => MAPFILE.test(l.match(/src[\/]maps[\/].*$/)[0]) && !HELPER.test(l));   // küçük yardımcıların (lamba / ağaç …) kendisi değil, çağrıldığı satır
  const m = (own[0] || fr[0] || '').match(LAYOUT), kit = fr[0] && fr[0] !== own[0] ? fr[0].match(LAYOUT) : null;
  const outer = own.length > 1 ? own[own.length - 1].match(LAYOUT)[2] : '';
  return { site: m ? `${m[1]}.js:${m[2]}:${m[3]}${outer && outer !== m[2] ? '·' + outer : ''}` : '?', kit: kit ? `${kit[1]}.js:${kit[2]}` : '' };
};
const P = [];                                                             // parçalar
const rec = (b, kind, local, hx, hy, hz, opt, color, extra = {}) => {
  const m = b.M.clone().multiply(local), e = m.elements;
  const c = new THREE.Vector3(e[12], e[13], e[14]);
  const ax = [new THREE.Vector3(e[0], e[1], e[2]), new THREE.Vector3(e[4], e[5], e[6]), new THREE.Vector3(e[8], e[9], e[10])];
  const h = [hx * ax[0].length(), hy * ax[1].length(), hz * ax[2].length()]; ax.forEach((a) => a.normalize());
  const ext = [0, 1, 2].map((k) => Math.abs(ax[0].getComponent(k)) * h[0] + Math.abs(ax[1].getComponent(k)) * h[1] + Math.abs(ax[2].getComponent(k)) * h[2]);
  const o = opt.o || {};
  const alt = kind === 'cyl' && Math.abs(ax[1].y) > 0.999 ? { c, ax: [ax[0].clone().add(ax[2]).normalize(), ax[1], ax[2].clone().sub(ax[0]).normalize()], h } : null;   // dik silindir: 45° kare (kesişim = iki karenin kesişimi)
  P.push({ kind, alt, c, ax, h, mn: [c.x - ext[0], c.y - ext[1], c.z - ext[2]], mx: [c.x + ext[0], c.y + ext[1], c.z + ext[2]], col: opt.collide !== false, see: !o.transparent, glow: !!o.glow, color, ...siteOf(), ...extra });
};
const _box = MapBuilder.prototype.box, _cyl = MapBuilder.prototype.cyl, _ico = MapBuilder.prototype.ico, _prism = MapBuilder.prototype.prism, _wall = MapBuilder.prototype.wall, _aabb = MapBuilder.prototype._aabb;
MapBuilder.prototype.box = function (x, y, z, w, h, d, color, opt = {}) { rec(this, 'box', this._local(x, y + h / 2, z, opt.rx, opt.ry, opt.rz), w / 2, h / 2, d / 2, opt, color); return _box.call(this, x, y, z, w, h, d, color, opt); };
MapBuilder.prototype.cyl = function (x, y, z, rT, rB, h, color, opt = {}) { const r = Math.max(rT, rB); rec(this, 'cyl', this._local(x, opt.center ? y : y + h / 2, z, opt.rx, opt.ry, opt.rz), r * 0.96, h / 2, r * 0.96, opt, color, { cone: Math.min(rT, rB) < r * 0.5 }); return _cyl.call(this, x, y, z, rT, rB, h, color, opt); };
MapBuilder.prototype.ico = function (x, y, z, r, color, opt = {}) { const s = opt.scale || [1, 1, 1]; rec(this, 'ico', this._local(x, y, z, 0, opt.ry || 0, 0), r * s[0] * 0.8, r * s[1] * 0.8, r * s[2] * 0.8, { ...opt, collide: false }, color); return _ico.call(this, x, y, z, r, color, opt); };
MapBuilder.prototype.prism = function (x, y, z, w, h, d, color, opt = {}) { rec(this, 'prism', this._local(x, y + h / 2, z, 0, opt.ry || 0, 0), w / 2 * 0.75, h / 2, d / 2, { ...opt, collide: false }, color); return _prism.call(this, x, y, z, w, h, d, color, opt); };
const doors = [];
MapBuilder.prototype.wall = function (axis, a0, a1, c, y0, h, t, color, openings = [], opt = {}) {
  for (const o of openings) if (!(o.b > 0.05) && o.top >= 1.8 && o.w >= 0.7) {      // kapı: zeminden başlayan ≥1,8 m açıklık
    const lx = axis === 'x' ? o.at : c, lz = axis === 'x' ? c : o.at;
    const p = new THREE.Vector3(lx, y0, lz).applyMatrix4(this.M), n = new THREE.Vector3(axis === 'x' ? 0 : 1, 0, axis === 'x' ? 1 : 0).transformDirection(this.M);
    doors.push({ p, n, w: o.w, t, top: o.top, ...siteOf() });
  }
  return _wall.call(this, axis, a0, a1, c, y0, h, t, color, openings, opt);
};
MapBuilder.prototype._aabb = function (...a) { const n = this.colliders.length; _aabb.apply(this, a); for (let i = n; i < this.colliders.length; i++) Object.assign(this.colliders[i], siteOf()); };
MapBuilder.zfix = true;
let zb = [];
const _build = MapBuilder.prototype.build;
MapBuilder.prototype.build = function () { const g = _build.call(this); zb.push(this); return g; };

const t0 = Date.now();
const M = MAPS[id].build();
const T = M.terrain || null, gh = (x, z) => (T ? T.heightAt(x, z) : 0);
const B = M.bounds;
const big = (p) => Math.max(p.h[0], p.h[2]) > 150 || p.mn[1] < -1.2 && p.mx[1] < 0.05 || p.mn[1] < -1.2 && Math.max(p.h[0], p.h[2]) > 8;      // zemin levhası / dağ / tepe
const decal = (p) => p.mx[1] - p.mn[1] <= 0.075 && p.mn[1] <= gh(p.c.x, p.c.z) + 0.08;          // yol, çimen yaması, çizgi
const slab = (p) => p.mx[1] - p.mn[1] <= 0.22 && p.mn[1] <= gh(p.c.x, p.c.z) + 0.02 && p.h[0] * p.h[2] > 1;   // kaldırım / kaide: üstüne konan şeyin tabanı içine girebilir
const leaf = (p) => p.kind === 'ico' || p.cone;
const solid = P.filter((p) => !big(p) && p.see && !decal(p) && p.mx[1] > gh(p.c.x, p.c.z) + 0.02);
const out = { map: id, parts: P.length, cats: {} };
const add = (cat, item) => (out.cats[cat] ||= []).push(item);
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);

// ── 1) kesişen nesneler (OBB SAT; en küçük ayırıcı eksen örtüşmesi = içe girme) ──
const corners = (p) => { const r = []; for (let i = 0; i < 8; i++) r.push(p.c.clone().addScaledVector(p.ax[0], i & 1 ? p.h[0] : -p.h[0]).addScaledVector(p.ax[1], i & 2 ? p.h[1] : -p.h[1]).addScaledVector(p.ax[2], i & 4 ? p.h[2] : -p.h[2])); return r; };
const pen = (A, Bq) => Math.min(pen1(A, Bq), A.alt ? pen1(A.alt, Bq) : 1e9, Bq.alt ? pen1(A, Bq.alt) : 1e9, A.alt && Bq.alt ? pen1(A.alt, Bq.alt) : 1e9);
const pen1 = (A, Bq) => {
  const axes = [...A.ax, ...Bq.ax]; for (const a of A.ax) for (const q of Bq.ax) { const c = a.clone().cross(q); if (c.lengthSq() > 1e-6) axes.push(c.normalize()); }
  const ca = A._k ||= corners(A), cb = Bq._k ||= corners(Bq);
  let best = 1e9;
  for (const ax of axes) {
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const v of ca) { const d = v.dot(ax); a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of cb) { const d = v.dot(ax); b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    const o = Math.min(a1, b1) - Math.max(a0, b0); if (o <= 0) return 0; best = Math.min(best, o);
  }
  return best;
};
{
  const S = solid.slice().sort((a, b) => a.mn[0] - b.mn[0]), pairs = new Map();
  for (let i = 0; i < S.length; i++) {
    const A = S[i];
    for (let j = i + 1; j < S.length && S[j].mn[0] < A.mx[0] - 0.03; j++) {
      const Q = S[j]; if (Q.site === A.site) continue;
      if (Q.mn[1] > A.mx[1] - 0.03 || A.mn[1] > Q.mx[1] - 0.03 || Q.mn[2] > A.mx[2] - 0.03 || A.mn[2] > Q.mx[2] - 0.03) continue;
      if (leaf(A) && leaf(Q)) continue;                                  // yaprak ↔ yaprak doğal
      if (slab(A) && Q.mn[1] <= A.mx[1] + 0.01 || slab(Q) && A.mn[1] <= Q.mx[1] + 0.01) continue;   // kaldırıma oturan ayak
      const d = pen(A, Q); if (d < 0.03) continue;
      const k = [A.site, Q.site].sort().join(' × ');
      const e = pairs.get(k) || { n: 0, pen: 0 }; e.n++;
      if (d > e.pen) Object.assign(e, { pen: d, at: `${f1((Math.max(A.mn[0], Q.mn[0]) + Math.min(A.mx[0], Q.mx[0])) / 2)},${f1((Math.max(A.mn[1], Q.mn[1]) + Math.min(A.mx[1], Q.mx[1])) / 2)},${f1((Math.max(A.mn[2], Q.mn[2]) + Math.min(A.mx[2], Q.mx[2])) / 2)}`, what: `${A.kit || A.kind}(${A.color}) ↔ ${Q.kit || Q.kind}(${Q.color})` });
      pairs.set(k, e);
    }
  }
  for (const [k, e] of [...pairs].sort((a, b) => b[1].pen - a[1].pen)) add('1-kesisen', `${k}  (${e.at}) ≤${f2(e.pen)} m, ${e.n} parça çifti  ${e.what}`);
}
// nesne kümeleri (aynı düzen çağrısı)
const objs = new Map();
for (const p of P) { if (big(p)) continue; const o = objs.get(p.site) || { site: p.site, parts: [] }; o.parts.push(p); objs.set(p.site, o); }
// ── 2) havada / 3) gömük: parçalar temas grafiği (AABB ≤2 cm) ile birleştirilir; hiçbir parçası zemine (≤5 cm) değmeyen bileşen havadadır ──
{
  const Q = P.filter((p) => p.see && !big(p));
  for (const p of Q) {                                                    // temas kutusu (prizma: tam taban genişliği)
    if (p.kind !== 'prism') { p.tmn = p.mn; p.tmx = p.mx; continue; }
    const hx = p.h[0] / 0.75, e = [0, 1, 2].map((k) => Math.abs(p.ax[0].getComponent(k)) * hx + Math.abs(p.ax[1].getComponent(k)) * p.h[1] + Math.abs(p.ax[2].getComponent(k)) * p.h[2]);
    p.tmn = [p.c.x - e[0], p.c.y - e[1], p.c.z - e[2]]; p.tmx = [p.c.x + e[0], p.c.y + e[1], p.c.z + e[2]];
  }
  const par = Q.map((_, i) => i), find = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, uni = (i, j) => { i = find(i); j = find(j); if (i !== j) par[i] = j; };
  const ord = Q.map((_, i) => i).sort((i, j) => Q[i].tmn[0] - Q[j].tmn[0]), E = 0.05;
  for (let a = 0; a < ord.length; a++) {
    const A = Q[ord[a]];
    for (let b = a + 1; b < ord.length && Q[ord[b]].tmn[0] <= A.tmx[0] + E; b++) {
      const B = Q[ord[b]];
      if (B.tmn[1] > A.tmx[1] + E || A.tmn[1] > B.tmx[1] + E || B.tmn[2] > A.tmx[2] + E || A.tmn[2] > B.tmx[2] + E) continue;
      uni(ord[a], ord[b]);
    }
  }
  const grounded = new Set();
  Q.forEach((p, i) => { if (p.tmn[1] <= gh(p.c.x, p.c.z) + 0.05) grounded.add(find(i)); });
  const comp = new Map();
  Q.forEach((p, i) => { const r = find(i); if (grounded.has(r)) return; const c = comp.get(r) || []; c.push(p); comp.set(r, c); });
  for (const c of comp.values()) {
    let lo = 1e9, cx = 0, cz = 0; for (const p of c) { lo = Math.min(lo, p.mn[1]); cx += p.c.x / c.length; cz += p.c.z / c.length; }
    if (c.every((p) => p.glow)) continue;
    const sites = [...new Set(c.map((p) => `${p.site} ${p.kit || p.kind}`))].slice(0, 2).join(' + ');
    add('2-havada', `${sites} ${c.length} parça (${c[0].color}) taban y=${f2(lo)} zemin ${f2(gh(cx, cz))} @(${f1(cx)},${f1(cz)})`);
  }
  for (const p of Q) { const g = gh(p.c.x, p.c.z); if (p.mn[1] < g - 0.25 && p.mx[1] > g - 0.02 && p.kind !== 'ico' && !(p.h[1] * 2 > 3 && p.mn[1] > g - 0.6)) add('3-gomuk', `${p.site} ${p.kit || p.kind}(${p.color}) taban ${f2(p.mn[1])} zemin ${f2(g)} @(${f1(p.c.x)},${f1(p.c.z)})`); }
}
// ── 4) alt boşluk (arazi) ──
if (T) for (const p of solid) {
  const g = gh(p.c.x, p.c.z); if (Math.abs(p.mn[1] - g) > 0.3 || p.kind === 'ico') continue;
  let worst = 0; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = p.c.x + sx * (p.mx[0] - p.mn[0]) / 2 * 0.98, z = p.c.z + sz * (p.mx[2] - p.mn[2]) / 2 * 0.98; worst = Math.max(worst, p.mn[1] - gh(x, z)); }
  if (worst > 0.05) add('4-alt-bosluk', `${p.site} ${p.kit || p.kind} boşluk ${f2(worst)} m @(${f1(p.c.x)},${f1(p.c.z)})`);
}
// ── 5) z-fight ──
{ const rep = zb.flatMap((q) => q.zfightReport || []); const again = zb.reduce((n, q) => n + q.resolveZFight().length, 0); out.zfight = { fixed: rep.length, remaining: again }; if (again) add('5-zfight', `ikinci geçişte kalan ${again}`); }
// ── 6) görselsiz çarpışma / 7) çarpışmasız engel ──
const inBox = (p, x, y, z, e = 0.03) => x >= p.mn[0] - e && x <= p.mx[0] + e && y >= p.mn[1] - e && y <= p.mx[1] + e && z >= p.mn[2] - e && z <= p.mx[2] + e;
const insideObb = (p, v, e = 0.03) => { const d = v.clone().sub(p.c); for (let k = 0; k < 3; k++) if (Math.abs(d.dot(p.ax[k])) > p.h[k] + e) return false; return true; };
{
  // 6: çarpışma kutusunun 3×3 yatay örnek sütununda (kutunun dikey aralığında) görünen bir parça (cam dahil) var mı?
  const vis = P.filter((p) => !big(p)).sort((a, b) => a.mn[0] - b.mn[0]);
  const near = (x0, x1) => vis.filter((p) => p.mn[0] <= x1 && p.mx[0] >= x0);
  const C = M.colliders.filter((c) => c.tag !== 'roof' && c.max[0] - c.min[0] < 80 && c.max[2] - c.min[2] < 80);
  const by = new Map(); const _v = new THREE.Vector3();
  for (const c of C) {
    if (c.max[1] - c.min[1] <= 0.3) continue;
    const cand = near(c.min[0], c.max[0]).filter((p) => p.mx[1] >= c.min[1] && p.mn[1] <= c.max[1] && p.mx[2] >= c.min[2] && p.mn[2] <= c.max[2]);
    let n = 0, hit = 0;
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      const x = c.min[0] + (c.max[0] - c.min[0]) * (i + 0.5) / 3, z = c.min[2] + (c.max[2] - c.min[2]) * (k + 0.5) / 3; n++;
      if (cand.some((p) => { _v.set(x, Math.min(c.max[1], Math.max(c.min[1], p.c.y)), z); return (p.kind === 'box' || p.kind === 'cyl') ? insideObb(p, _v, 0.06) : inBox(p, _v.x, _v.y, _v.z, 0.06); })) hit++;
    }
    if (hit / n < 0.5) { const k = `${c.site} ${c.kit}`; const e = by.get(k) || { n: 0, at: `${f1((c.min[0] + c.max[0]) / 2)},${f1(c.min[1])},${f1((c.min[2] + c.max[2]) / 2)}`, size: `${f2(c.max[0] - c.min[0])}x${f2(c.max[1] - c.min[1])}x${f2(c.max[2] - c.min[2])}`, cov: hit / n }; e.n++; by.set(k, e); }
  }
  for (const [k, e] of by) add('6-gorselsiz-carpisma', `${k} ×${e.n} örn. (${e.at}) ${e.size} dolu %${Math.round(e.cov * 100)}`);
  // 7: gövde yüksekliğinde opak, çarpışmasız parça; yatay örnek noktaları gövde bandında (0,3–1,9 m) bir çarpışma kutusuyla örtülü mü? (diz altı ekin / çalı / sınır dışı hariç)
  const CC = M.colliders.filter((c) => c.tag !== 'roof');
  const by7 = new Map();
  for (const p of P) {
    if (p.col || !p.see || p.glow || big(p) || p.kind === 'ico' || p.kind === 'prism' || decal(p) || p.cone) continue;
    if (p.c.x < B.minX || p.c.x > B.maxX || p.c.z < B.minZ || p.c.z > B.maxZ) continue;
    const g = gh(p.c.x, p.c.z), lo = Math.max(p.mn[1], g + 0.3), hi = Math.min(p.mx[1], g + 1.9);
    if (p.mx[1] < g + 0.7 || hi - lo < 0.25 || Math.min(p.mx[0] - p.mn[0], p.mx[2] - p.mn[2]) < 0.25 || (p.mx[0] - p.mn[0]) * (p.mx[2] - p.mn[2]) < 0.12) continue;
    const cand = CC.filter((c) => c.min[0] <= p.mx[0] && c.max[0] >= p.mn[0] && c.min[2] <= p.mx[2] && c.max[2] >= p.mn[2] && c.max[1] >= g + 0.3 && c.min[1] <= g + 1.9);
    let n = 0, hit = 0;
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      _v.copy(p.c).addScaledVector(p.ax[0], p.h[0] * ((i - 1) * 0.66)).addScaledVector(p.ax[2], p.h[2] * ((k - 1) * 0.66)); _v.y = (lo + hi) / 2;
      if (!insideObb(p, _v, 0)) continue; n++;
      if (cand.some((c) => _v.x >= c.min[0] - 0.05 && _v.x <= c.max[0] + 0.05 && _v.z >= c.min[2] - 0.05 && _v.z <= c.max[2] + 0.05)) hit++;
    }
    if (n && hit / n < 0.3) { const k = `${p.site} ${p.kit || p.kind}(${p.color})`; const e = by7.get(k) || { n: 0, at: `${f1(p.c.x)},${f1(p.mn[1])},${f1(p.c.z)}`, size: `${f2(p.mx[0] - p.mn[0])}x${f2(p.mx[1] - p.mn[1])}x${f2(p.mx[2] - p.mn[2])}` }; e.n++; by7.set(k, e); }
  }
  for (const [k, e] of by7) add('7-carpismasiz-engel', `${k} ×${e.n} örn. (${e.at}) ${e.size}`);
}
// ── 8) kapı önü engel ──
{
  const C = M.colliders.filter((c) => c.tag !== 'roof' && c.tag !== 'deck');
  for (const d of doors) {
    const t = new THREE.Vector3(-d.n.z, 0, d.n.x), y0 = d.p.y;
    for (const s of [-1, 1]) {
      const pts = [];
      for (let a = -0.5; a <= 0.5; a += 0.25) for (let q = 0.25; q <= 0.9; q += 0.3) pts.push(d.p.clone().addScaledVector(t, a * (d.w - 0.3)).addScaledVector(d.n, s * (d.t / 2 + q)));
      const blk = C.find((c) => c.max[1] > y0 + 0.35 && c.min[1] < y0 + 1.7 && pts.filter((v) => v.x > c.min[0] && v.x < c.max[0] && v.z > c.min[2] && v.z < c.max[2]).length >= 3);
      if (blk) add('8-kapi-onu', `${d.site} ${d.kit} kapı (${f1(d.p.x)},${f1(d.p.y)},${f1(d.p.z)}) ${s > 0 ? '+' : '−'}yüz ← ${blk.site} ${blk.kit} ${f2(blk.max[0] - blk.min[0])}x${f2(blk.max[1] - blk.min[1])}x${f2(blk.max[2] - blk.min[2])}${blk.tag ? ' ' + blk.tag : ''}`);
    }
  }
}
// ── 10) yol üstünde yapı: ≥2,2 m yüksek çarpışma kutusu (bina / duvar / kule; araç hariç) asfalt kaplamanın (koyu, ≥20 m² ince zemin parçası) üstünde ──
{
  const lum = (h) => { const n = parseInt(new THREE.Color(h).getHexString(), 16); return (0.3 * (n >> 16 & 255) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255)) / 255; };   // sRGB parlaklık
  const roads = P.filter((p) => decal(p) && (p.mx[0] - p.mn[0]) * (p.mx[2] - p.mn[2]) >= 20 && lum(p.color) < 0.3);
  const by = new Map();
  for (const c of M.colliders) {
    if (c.tag === 'veh' || c.tag === 'roof' || c.max[1] - c.min[1] < 2.2 || c.max[0] - c.min[0] > 80) continue;
    for (const r of roads) {
      const ox = Math.min(c.max[0], r.mx[0]) - Math.max(c.min[0], r.mn[0]), oz = Math.min(c.max[2], r.mx[2]) - Math.max(c.min[2], r.mn[2]);
      if (ox > 0.15 && oz > 0.15 && ox * oz > 0.1) { const k = `${c.site} ${c.kit}`; const e = by.get(k) || { n: 0, at: `${f1((c.min[0] + c.max[0]) / 2)},${f1((c.min[2] + c.max[2]) / 2)}`, a: 0 }; e.n++; e.a = Math.max(e.a, ox * oz); by.set(k, e); break; }
    }
  }
  for (const [k, e] of by) add('10-yol-ustu', `${k} ×${e.n} örn. (${e.at}) ≤${f2(e.a)} m²`);
}
// ── 9) sınır dışı ──
for (const c of M.colliders) { if (c.max[0] - c.min[0] > 200) continue; const m = 1.5; if (c.max[0] < B.minX - m || c.min[0] > B.maxX + m || c.max[2] < B.minZ - m || c.min[2] > B.maxZ + m) add('9-sinir-disi', `${c.site} ${c.kit} (${f1(c.min[0])},${f1(c.min[2])})`); }

const cats = ['1-kesisen', '2-havada', '3-gomuk', '4-alt-bosluk', '5-zfight', '6-gorselsiz-carpisma', '7-carpismasiz-engel', '8-kapi-onu', '9-sinir-disi', '10-yol-ustu'];
console.log(`=== ${id}: ${P.length} parça, ${objs.size} nesne, ${M.colliders.length} çarpışma, ${doors.length} kapı · z-fight düzeltilen ${out.zfight.fixed} / kalan ${out.zfight.remaining} (${Date.now() - t0} ms)`);
for (const k of cats) console.log(`  ${k.padEnd(22)} ${(out.cats[k] || []).length}`);
if (LIST) for (const k of cats) { const L = out.cats[k] || []; if (!L.length) continue; console.log(`\n── ${k} (${L.length})`); for (const s of L.slice(0, +(process.env.TOP || 400))) console.log('  ' + s); }
if (JS) fs.writeFileSync(JS, JSON.stringify(out, null, 1));
