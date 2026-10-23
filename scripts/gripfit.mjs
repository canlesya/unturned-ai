// Birinci şahıs kutu el ↔ kabza / kundak oturuş denetimi (tarayıcısız, node, 12.127). Ölçüler silah yerelinde (VM_SCALE öncesi), mm.
//   node scripts/gripfit.mjs [silah regex]     V=1 (tüm ölçüler) · JSON=yol (ham sonuç) · OLD=1 (eşik dışını da 0 ile çık)
// Hedefler: tetik eli (R) gövdeye gömülü hacim < %25, kabza eğimi ile eldiven eğimi farkı < 5°, eldiven üstü gövde altına ≤ 6 mm, kabza eldiven altından ≥ 10 mm görünür;
// destek eli (L) boşluk 0 (≤ 1 mm), eldiven üstü kundak altına 0…+10 mm, gömülü hacim < %25; eşyalar (bomba / mayın / kutu / ilk yardım) gömülü hacim < %25.
// Yöntem: silah ağı bağlı bileşenlere ayrılır, nokta içerde mi = ışın-üçgen kesişim sayısı tek mi. Eldiven yönlü kutudur (tetik eli kabza açısında döner) → örnekler kutunun kendi ekseninde alınır.
import * as THREE from 'three';
import { writeFileSync } from 'fs';
import { WSTATS, OPTIC_ALLOWED } from '../src/game/stats.js';
const { ViewModel, FP_GRIP } = await import(process.env.VM || '../src/game/player.js');
const only = process.argv[2] ? new RegExp(process.argv[2]) : null, V = !!process.env.V;
const vm = new ViewModel({ scene: { environment: null }, time: 0 });
const fake = (id) => ({ stat: WSTATS[id], adsT: 0, ads: false, vel: new THREE.Vector3(), onGround: true, sprinting: false, reloadT: 0, useT: 0, swing: null, overlay: 'none', leanT: 0, reloadTotal: 1, reloadStyle: 'mag', reloadEmpty: false, alive: true });
const inv = new THREE.Matrix4(), M = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const mm = (x) => Math.round(x * 1000);

function components(g, skip) {
  inv.copy(g.matrixWorld).invert();
  const comps = [];
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    for (let p = o; p && p !== g; p = p.parent) if (skip.includes(p) || !p.visible) return;
    const mt = o.material; if (mt && (mt.userData?.glass || mt.blending === THREE.AdditiveBlending || (mt.transparent && mt.opacity < 0.5))) return;
    M.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count, tris = [];
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      tris.push([a.fromBufferAttribute(pos, ia).applyMatrix4(M).toArray(), b.fromBufferAttribute(pos, ib).applyMatrix4(M).toArray(), c.fromBufferAttribute(pos, ic).applyMatrix4(M).toArray()]);
    }
    const key = (v) => v.map((x) => Math.round(x * 1e5)).join(','), par = new Map();
    const find = (k) => { while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; };
    const uni = (x, y) => { x = find(x); y = find(y); if (x !== y) par.set(x, y); };
    for (const t of tris) { const ks = t.map(key); for (const k of ks) if (!par.has(k)) par.set(k, k); uni(ks[0], ks[1]); uni(ks[1], ks[2]); }
    const groups = new Map();
    for (const t of tris) { const r = find(key(t[0])); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
    for (const ts of groups.values()) { const bb = new THREE.Box3(); for (const t of ts) for (const v of t) bb.expandByPoint(a.fromArray(v)); comps.push({ tris: ts, bb }); }
  });
  return comps;
}
const D = [1, 0.00123, 0.000771];
function rayTri(o, t) {
  const [A, B, C] = t, e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  const p = [D[1] * e2[2] - D[2] * e2[1], D[2] * e2[0] - D[0] * e2[2], D[0] * e2[1] - D[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return false;
  const iv = 1 / det, s = [o[0] - A[0], o[1] - A[1], o[2] - A[2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * iv; if (u < 0 || u > 1) return false;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (D[0] * q[0] + D[1] * q[1] + D[2] * q[2]) * iv; if (v < 0 || u + v > 1) return false;
  return (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * iv > 0;
}
const inside = (comps, o) => {
  for (const cp of comps) {
    const bb = cp.bb; if (o[0] > bb.max.x || o[1] < bb.min.y || o[1] > bb.max.y || o[2] < bb.min.z || o[2] > bb.max.z) continue;
    let n = 0; for (const t of cp.tris) if (rayTri(o, t)) n++;
    if (n & 1) return true;
  }
  return false;
};
// eldiven: yönlü kutu (silah yerelinde merkez + eksen + yarı boy)
function glove(grp) {
  const gl = grp.userData.glove || grp.children.find((m) => m.isMesh && m !== grp.userData.sleeve);
  gl.updateMatrixWorld(true);
  const T = new THREE.Matrix4().multiplyMatrices(inv, gl.matrixWorld), P = gl.geometry.parameters;
  return { T, h: [P.width / 2, P.height / 2, P.depth / 2], at: (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(T).toArray(), rx: -new THREE.Euler().setFromRotationMatrix(T).x * 180 / Math.PI };
}
function occ(comps, G) {
  const S = 0.005; let n = 0, k = 0;
  for (let x = -G.h[0] + S / 2; x < G.h[0]; x += S) for (let y = -G.h[1] + S / 2; y < G.h[1]; y += S) for (let z = -G.h[2] + S / 2; z < G.h[2]; z += S) { n++; if (inside(comps, G.at(x, y, z))) k++; }
  return +(k / n * 100).toFixed(1);
}
function gap(comps, G) {
  // en kısa eldiven ↔ silah yüzeyi mesafesi (temas yoksa)
  let best = 1; const loc = new THREE.Matrix4().copy(G.T).invert(), pt = new THREE.Vector3();
  for (const cp of comps) for (const t of cp.tris) for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4 - i; j++) {
    const u = i / 4, v = j / 4, w = 1 - u - v; pt.set(t[0][0] * w + t[1][0] * u + t[2][0] * v, t[0][1] * w + t[1][1] * u + t[2][1] * v, t[0][2] * w + t[1][2] * u + t[2][2] * v).applyMatrix4(loc);
    const dx = Math.max(0, Math.abs(pt.x) - G.h[0]), dy = Math.max(0, Math.abs(pt.y) - G.h[1]), dz = Math.max(0, Math.abs(pt.z) - G.h[2]);
    best = Math.min(best, Math.hypot(dx, dy, dz));
  }
  return mm(best);
}
function trigger(comps, G) {
  const [cx, cy, cz] = G.at(0, 0, 0), res = {};
  const sl = [];
  for (let y = cy + 0.08; y > cy - 0.16; y -= 0.002) {
    const zs = []; for (let z = cz - 0.1; z < cz + 0.1; z += 0.002) if (inside(comps, [cx, y, z])) zs.push(z);
    if (!zs.length) { sl.push({ y, n: 0 }); continue; }
    const segs = []; let s0 = zs[0], p = zs[0];
    for (const z of zs.slice(1)) { if (z - p > 0.0025) { segs.push([s0, p]); s0 = z; } p = z; } segs.push([s0, p]);
    segs.sort((A, B) => Math.abs((A[0] + A[1]) / 2 - cz) - Math.abs((B[0] + B[1]) / 2 - cz));
    sl.push({ y, n: zs.length, z0: segs[0][0], z1: segs[0][1], w: segs[0][1] - segs[0][0], zc: (segs[0][0] + segs[0][1]) / 2 });
  }
  const top = G.at(0, G.h[1], 0)[1], bot = G.at(0, -G.h[1], 0)[1];
  let recv = null; for (const s of [...sl].reverse()) if (s.y >= cy - 0.01 && s.n && s.w >= 0.07) { recv = s.y; break; }      // gövde altı: el merkezinin üstünde ilk geniş (≥ 7 cm) dilim
  res.topInto = recv != null ? mm(top - recv) : null;
  // kabza: eldiven tepesi ile 7 cm altı arasında, merkeze 4 cm içinde, eni < 6 cm sürekli dilimler (gövdenin altından başlar)
  const grip = sl.filter((s) => s.n && s.w < 0.06 && s.y < (recv ?? top) - 0.004 && s.y > bot - 0.07 && Math.abs(s.zc - cz) < 0.045);
  if (grip.length > 8) {
    const ys = grip.map((s) => s.y), zc = grip.map((s) => s.zc), my = ys.reduce((x, y) => x + y) / ys.length, mz = zc.reduce((x, y) => x + y) / zc.length;
    let sxy = 0, sxx = 0; ys.forEach((y, i) => { sxy += (y - my) * (zc[i] - mz); sxx += (y - my) ** 2; });
    res.rake = +(Math.atan(-sxy / sxx) * 180 / Math.PI).toFixed(1);
    res.below = mm(bot - Math.min(...ys));                                       // kabza eldiven altından kaç mm görünüyor
    const at = grip.reduce((A, B) => (Math.abs(B.y - cy) < Math.abs(A.y - cy) ? B : A));
    res.offZ = mm(at.zc - cz);                                                   // kabza merkezi − eldiven merkezi (+ = kabza geride)
  }
  return res;
}
function support(comps, G) {
  // eldiven üst yüzü ızgarası (10 mm): içerdeyse aşağı çıkışa kadar derinlik (+ = kundak ele gömülü), dışardaysa yukarı ilk temasa boşluk (− = havada);
  // her z sırasında en yakın temas (x boyunca en büyük), sonuç = sıraların %75'lik dilimi (tek kelepçe / ray dişi yanıltmasın)
  const gt = G.at(0, G.h[1], 0)[1], rowsV = [];
  for (let z = -G.h[2] + 0.005; z < G.h[2]; z += 0.01) {
    let best = -0.06;
    for (let x = -G.h[0] + 0.01; x < G.h[0]; x += 0.01) {
      const [px, , pz] = G.at(x, G.h[1], z);
      if (inside(comps, [px, gt, pz])) { let d = 0; while (d < 0.08 && inside(comps, [px, gt - d - 0.001, pz])) d += 0.001; best = Math.max(best, d); }
      else { let d = 0; while (d < 0.06 && !inside(comps, [px, gt + d + 0.001, pz])) d += 0.001; best = Math.max(best, -d); }
    }
    rowsV.push(best);
  }
  rowsV.sort((x, y) => x - y);
  return { topMinusHg: mm(rowsV[Math.floor(rowsV.length * 0.75)]) };
}

const rows = [], bad = [];
for (const [id, st] of Object.entries(WSTATS)) {
  if (st.ball || id === 'claws' || st.kind === 'melee' || (only && !only.test(id))) continue;
  const optic = (OPTIC_ALLOWED[id] || ['iron'])[0];
  vm.setItem(id, 'blue', st.kind, optic); vm.raise = 0; vm.noSway = true;
  const p = { s: fake(id), lookDX: 0, lookDY: 0, touch: false };
  for (let i = 0; i < 40; i++) vm.update(1 / 60, p);
  vm.scene.updateMatrixWorld(true);
  const g = vm.model, u = g.userData, gun = st.kind === 'gun' || st.kind === 'launcher';
  inv.copy(g.matrixWorld).invert();
  const comps = components(g, [vm.handR, vm.handL].filter(Boolean));
  const fp = FP_GRIP?.[id] || {}, row = { id, hold: u.hold }, err = [];
  if (vm.handR) {
    const G = glove(vm.handR), R = { occ: occ(comps, G), rx: +G.rx.toFixed(1) };
    if (!R.occ) R.gap = gap(comps, G);
    if (gun && !fp.wrist) Object.assign(R, trigger(comps, G));      // düz dipçik (wrist): kabza ölçüsü yok, yalnız gömülü hacim / boşluk
    row.R = R;
    if (R.occ >= 25) err.push(`R gömülü %${R.occ}`);
    if (!R.occ && R.gap > 1) err.push(`R havada ${R.gap} mm`);
    if (gun && R.rake != null && Math.abs(R.rake - R.rx) >= 5) err.push(`R açı ${R.rx}° / kabza ${R.rake}°`);
    if (gun && R.topInto != null && R.topInto > 6) err.push(`R üstü gövdeye ${R.topInto} mm`);
    if (gun && R.below != null && R.below < 10) err.push(`R kabza altta ${R.below} mm`);
  }
  if (vm.handL && vm.handL.visible) {
    const G = glove(vm.handL), L = { occ: occ(comps, G) };
    if (!L.occ) L.gap = gap(comps, G);
    Object.assign(L, support(comps, G));
    row.L = L;
    if (L.occ >= 25) err.push(`L gömülü %${L.occ}`);
    if (!L.occ && L.gap > 1) err.push(`L havada ${L.gap} mm`);
    if (!fp.vg && L.topMinusHg != null && (L.topMinusHg < 0 || L.topMinusHg > 10)) err.push(`L üst − kundak altı ${L.topMinusHg} mm`);
  }
  row.err = err; rows.push(row); if (err.length) bad.push(id);
  const f = (o) => o ? Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' ') : '';
  console.log(`${err.length ? '✗' : '✓'} ${id.padEnd(9)} R: ${f(row.R)}${row.L ? ' | L: ' + f(row.L) : ''}${err.length ? '  → ' + err.join(', ') : ''}`);
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
console.log(`\n${rows.length - bad.length}/${rows.length} uygun${bad.length ? ' · sorunlu: ' + bad.join(', ') : ''}`);
process.exit(bad.length && !process.env.OLD ? 1 : 0);
