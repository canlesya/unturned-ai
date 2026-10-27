// 12.195 Birinci şahıs yükleme denetimi (tarayıcısız, node): her silah × boş / taktik yükleme, k = 0..1 (varsayılan 41 kare).
//   node scripts/reloadfp.mjs [silah regex]     V=1 (kare kare) · JSON=yol · LEFT=1 (sol el modu) · N=kare sayısı
// Her karede sol el (destek eli) şu üçünden biri olmalı: (a) silaha / şarjöre değiyor (kutu yüzeyi ≤ TOUCH mm), (b) ekran dışında (cep),
// (c) yolda — cebe gidip gelirken serbest; silahın yanında ardışık temassız kareler ≤ AIR sn (el havada asılı kalmaz). Ayrıca: şarjör yerinden çıkmışken ele ≤ 12 mm (süzülmez),
// el kutusu silaha gömülü hacim ≤ %8 (şarjörü tutarken şarjör hariç), kol kutusu silaha gömülü ≤ %4, sağ el (sürgü) aynı kurallar.
import * as THREE from 'three';
import { writeFileSync } from 'fs';
globalThis.document ||= { documentElement: {}, createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }), width: 0, height: 0 }) };
const R = process.env.SRC ? 'file://' + process.env.SRC : '..';                    // SRC=/başka/kök → aynı denetim eski kodda (önce / sonra)
const { WSTATS } = await import(`${R}/src/game/stats.js`);
const { ViewModel } = await import(`${R}/src/game/player.js`);
const reloadMode = (await import(`${R}/src/game/reloadPlan.js`).catch(() => ({}))).reloadMode || ((id, st) => st.reloadStyle || 'mag');
const only = process.argv[2] ? new RegExp(process.argv[2]) : null, VB = !!process.env.V, N = +(process.env.N || 41);
const TOUCH = 30, MAGGAP = 12;      // havada kalma sınırı: max(0,2 sn, süre × %9) — fişekte bir fişek döngüsünün %60'ı
const game = { scene: { environment: null }, time: 0, leftHand: !!process.env.LEFT };
const vm = new ViewModel(game);
vm.cam.aspect = 16 / 9; vm.cam.updateProjectionMatrix();
const inv = new THREE.Matrix4(), M = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

function tris(g, filter) {
  inv.copy(g.matrixWorld).invert();
  const out = [];
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position || !filter(o)) return;
    const mt = o.material; if (mt && (mt.userData?.glass || mt.blending === THREE.AdditiveBlending || (mt.transparent && mt.opacity < 0.5 && !mt.userData?.skinMat))) return;
    M.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      out.push([a.fromBufferAttribute(pos, ia).applyMatrix4(M).toArray(), b.fromBufferAttribute(pos, ib).applyMatrix4(M).toArray(), c.fromBufferAttribute(pos, ic).applyMatrix4(M).toArray()]);
    }
  });
  const bb = new THREE.Box3(); for (const t of out) for (const v of t) bb.expandByPoint(a.fromArray(v));
  return { t: out, bb };
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
const inside = (S, o) => { const bb = S.bb; if (o[0] > bb.max.x || o[1] < bb.min.y || o[1] > bb.max.y || o[2] < bb.min.z || o[2] > bb.max.z) return false; let n = 0; for (const t of S.t) if (rayTri(o, t)) n++; return (n & 1) === 1; };
// yönlü kutu (silah yerelinde)
function obb(mesh, g) {
  mesh.updateMatrixWorld(true);
  const T = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(g.matrixWorld).invert(), mesh.matrixWorld), P = mesh.geometry.parameters;
  return { T, Ti: T.clone().invert(), h: [P.width / 2, P.height / 2, P.depth / 2], at: (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(T).toArray() };
}
function occ(S, G, step = 0.012) {
  if (!S.t.length) return 0;
  let n = 0, k = 0;
  for (let x = -G.h[0] + step / 2; x < G.h[0]; x += step) for (let y = -G.h[1] + step / 2; y < G.h[1]; y += step) for (let z = -G.h[2] + step / 2; z < G.h[2]; z += step) { n++; if (inside(S, G.at(x, y, z))) k++; }
  return k / n * 100;
}
function gap(S, G) {
  let best = 1; const pt = new THREE.Vector3();
  const C = new THREE.Vector3().applyMatrix4(G.T), R = Math.hypot(...G.h) + 0.06;
  for (const t of S.t) {
    if (Math.abs(t[0][0] - C.x) > R + 0.1 || Math.abs(t[0][1] - C.y) > R + 0.1 || Math.abs(t[0][2] - C.z) > R + 0.3) continue;
    for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3 - i; j++) {
      const u = i / 3, v = j / 3, w = 1 - u - v; pt.set(t[0][0] * w + t[1][0] * u + t[2][0] * v, t[0][1] * w + t[1][1] * u + t[2][1] * v, t[0][2] * w + t[1][2] * u + t[2][2] * v).applyMatrix4(G.Ti);
      const dx = Math.max(0, Math.abs(pt.x) - G.h[0]), dy = Math.max(0, Math.abs(pt.y) - G.h[1]), dz = Math.max(0, Math.abs(pt.z) - G.h[2]);
      best = Math.min(best, Math.hypot(dx, dy, dz));
    }
  }
  return best * 1000;
}
// ekranda mi: kutunun herhangi bir köşesi görüş alanında (kamera önünde, |ndc| ≤ 1)
function onScreen(mesh) {
  mesh.updateMatrixWorld(true); const P = mesh.geometry.parameters, v = new THREE.Vector3();
  vm.cam.updateMatrixWorld(true);
  let any = false;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.set(sx * P.width / 2, sy * P.height / 2, sz * P.depth / 2).applyMatrix4(mesh.matrixWorld);
    const cl = v.clone().applyMatrix4(vm.cam.matrixWorldInverse); if (cl.z > -0.01) continue;
    v.project(vm.cam); if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) any = true;
  }
  return any;
}
const fake = (id) => ({ stat: WSTATS[id], adsT: 0, ads: false, vel: new THREE.Vector3(), onGround: true, sprinting: false, reloadT: 0, useT: 0, swing: null, overlay: 'none', leanK: 0, reloadTotal: 1, reloadStyle: 'mag', reloadEmpty: false, alive: true, item: { id, mag: 0, reserve: 90 }, cd: 0 });

const rows = [], bad = [];
for (const [id, st] of Object.entries(WSTATS)) {
  if ((st.kind !== 'gun' && st.kind !== 'launcher') || (only && !only.test(id))) continue;
  const mode = reloadMode(id, st);
  for (const empty of (st.mag <= 1 || mode === 'rocket' || mode === 'break' ? [true] : [true, false])) {
    vm.setItem(id, 'blue', st.kind, 'iron'); vm.raise = 0; vm.noSway = true;
    const s = fake(id), p = { s, lookDX: 0, lookDY: 0, touch: false };
    s.reloadStyle = st.reloadStyle || 'mag'; s.reloadEmpty = empty;
    const shell = s.reloadStyle === 'shell';
    s.reloadTotal = shell ? st.shell * 0.8 + st.shell * 3 : st.reload * (empty ? 1 : 0.65);
    s.item.mag = empty ? 0 : 3;
    for (let i = 0; i < 30; i++) vm.update(1 / 60, p);
    const fr = [], dtK = 1 / (N - 1);
    let air = 0, airMax = 0, err = [], rL = 0, rR = 0;
    const AIR = shell ? st.shell * 0.6 : Math.max(0.2, s.reloadTotal * 0.09);
    for (let i = 0; i < N; i++) {
      const k = Math.min(0.9999, i * dtK);
      s.reloadT = Math.max(1e-4, s.reloadTotal * (1 - k));
      vm.update(s.reloadTotal * dtK, p);
      vm.scene.updateMatrixWorld(true);
      const g = vm.model, u = g.userData, hl = vm.handL;
      const gunS = tris(g, (o) => { for (let q = o; q && q !== g; q = q.parent) if (q === vm.handL || q === vm.handR || q === u.mag || (u.mag && q === u.mag) || !q.visible) return false; return true; });
      const magS = u.mag && u.mag.visible ? tris(g, (o) => { for (let q = o; q && q !== g; q = q.parent) if (q === u.mag) return true; return false; }) : { t: [], bb: new THREE.Box3() };
      const f = { k: +k.toFixed(3) };
      if (hl && hl.visible) {
        const G = obb(hl.userData.glove, g), on = onScreen(hl.userData.glove);
        const gg = gap(gunS, G), gm = magS.t.length ? gap(magS, G) : 1e3;
        f.on = on; f.gap = Math.round(Math.min(gg, gm)); f.occ = +occ(gunS, G).toFixed(1);
        const magOff = u.mag && u.mag.visible ? u.mag.position.length() : 0;
        if (i === 0) rL = f.occ;                                                          // dinlenme tutuşunun kendi payı (gripfit'in işi) düşülür
        if (vm._rlMag === 'hand' && magOff > 0.01 && u.mag.visible && gm > MAGGAP) err.push(`k${f.k} şarjör elden ${Math.round(gm)} mm`);
        if (f.occ > Math.max(8, rL + 2)) err.push(`k${f.k} el gövdede %${f.occ}`);
        const sl = hl.userData.sleeve; if (sl && on) { const SL = obb(sl, g); const so = occ(gunS, SL, 0.02); f.sl = +so.toFixed(1); if (so > 4) err.push(`k${f.k} kol gövdede %${so.toFixed(1)}`); }
        const touch = f.gap <= TOUCH;
        const pw = (vm.rlLast?.L || []).reduce((a, [n, c]) => a + (n === 'pouch' ? Math.abs(c) : 0), 0);      // cebe gidip gelme (savurma) yol sayılır, havada kalma değil
        if (on && !touch && pw < 0.05) { air += s.reloadTotal * dtK; airMax = Math.max(airMax, air); } else air = 0;
      }
      if (vm.handR && vm.handR.visible && vm.handR.userData.glove) {
        const G = obb(vm.handR.userData.glove, g); f.rocc = +occ(gunS, G).toFixed(1);
        if (i === 0) rR = f.rocc;
        if (f.rocc > Math.max(30, rR + 3)) err.push(`k${f.k} sağ el gövdede %${f.rocc}`);
      }
      fr.push(f);
    }
    if (airMax > AIR) err.push(`el havada ${airMax.toFixed(2)} sn`);
    const sum = { id, mode, empty, total: +s.reloadTotal.toFixed(2), airMax: +airMax.toFixed(2), maxOcc: Math.max(0, ...fr.map((f) => f.occ || 0)), maxGapOn: Math.max(0, ...fr.filter((f) => f.on).map((f) => f.gap || 0)), err: [...new Set(err)].slice(0, 6), nErr: err.length };
    rows.push({ ...sum, fr }); if (err.length) bad.push(`${id}${empty ? '' : '-T'}`);
    console.log(`${err.length ? '✗' : '✓'} ${id.padEnd(10)} ${mode.padEnd(6)} ${empty ? 'boş ' : 'takt'} ${sum.total}s hava ${sum.airMax}s occ ${sum.maxOcc.toFixed(1)}% ${err.length ? '→ ' + sum.err.join(' · ') + (err.length > 6 ? ` (+${err.length - 6})` : '') : ''}`);
    if (VB) for (const f of fr) console.log('   ', JSON.stringify(f));
  }
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
console.log(`\n${rows.length - bad.length}/${rows.length} uygun${bad.length ? ' · sorunlu: ' + bad.join(', ') : ''}`);
process.exit(bad.length ? 1 : 0);
