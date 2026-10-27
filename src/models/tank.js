import * as THREE from 'three';
import { box, taperBox, mat, mergeVC } from '../core/geo.js';
import { JEEP_MATS } from './jeep.js';

// 12.178 Tank (ana muharebe tankı, düşük poligon; BattleBit / S3 dili). Konvansiyon: ileri = −Z, kök = zemin ortası.
// Fizik kutusu sim/vehicle.js VT.tank (gövde hl 3,3 · hw 1,7 · üst 1,75; kule kutusu). Parçalar: gövde (tek köşe-renkli çizim), paletler (iki
// yanda 44'er bakla tek InstancedMesh: hıza göre döngü boyunca kayar), yol tekerleri (14, tek InstancedMesh: döner), kule (bakışla döner),
// top (açı), nişancı halkası + makineli (nişancının bakışıyla döner), farlar / stop (araç başına ışıyan malzeme). Takım rengi: kule şeridi,
// kule yan plakası + numara bandı, etek şeridi, anten flaması (Mavi koyu zeytin / Kırmızı kum).
export const TANK = { turretZ: 0.35, pivotY: 2.18, ringX: 0.42, ringZ: 0.15, trackX: 1.42, linkN: 44, wheelZ: [-2.15, -1.43, -0.72, 0, 0.72, 1.43, 2.15] };
const BODY = { blue: '#4b5340', red: '#857655', null: '#5d5c4a' };
const MARK = { blue: '#3f7fd8', red: '#d2483a', null: '#c9c6b8' };
const DK = '#1c1d1e', TRACK = '#2a2a2a', METAL = '#3a3c3d', RUB = '#191919';
const cache = {};
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

// palet döngüsü (yerel z, y): ön dişli (−2,75, 0,6 r 0,5) · arka gergi (2,75, 0,6 r 0,5) · alt 0,1 · üst 1,1
export function trackPoint(s, out) {
  const r = 0.5, zf = -2.75, zb = 2.75, cy = 0.6, L1 = zb - zf, arc = Math.PI * r, P = 2 * L1 + 2 * arc;
  s = ((s % P) + P) % P;
  if (s < L1) { out.z = zf + s; out.y = cy - r; out.a = 0; return out; }                     // alt (öne doğru: s ↑ → z ↑)
  s -= L1;
  if (s < arc) { const t = s / r; out.z = zb + Math.sin(t) * r; out.y = cy - Math.cos(t) * r; out.a = t; return out; }
  s -= arc;
  if (s < L1) { out.z = zb - s; out.y = cy + r; out.a = Math.PI; return out; }
  s -= L1;
  const t = s / r; out.z = zf - Math.sin(t) * r; out.y = cy + Math.cos(t) * r; out.a = Math.PI + t; return out;
}
export const TRACK_LEN = 2 * 5.5 + 2 * Math.PI * 0.5;

function build(team) {
  const C = BODY[team] ?? BODY.null, M = MARK[team] ?? MARK.null, dk = shade(C, 0.72), lt = shade(C, 1.12);
  const root = new THREE.Group(); root.name = 'tank';
  const body = new THREE.Group(); body.name = 'gövde'; root.add(body);
  const B = (sz, col, pos, rot) => box(body, sz, col, pos, rot);
  // alt gövde (paletler arası) + üst güverte + eğik ön zırh
  B([2.1, 0.95, 6.0], dk, [0, 0.78, 0.1]);
  B([3.36, 0.36, 5.4], C, [0, 1.56, 0.35]);
  taperBox(body, [3.36, 0.36, 1.1], C, [0, 1.38, -2.55], [0.42, 0, 0], [1, 1], [1, 1]);         // eğik ön zırh plakası
  B([2.2, 0.5, 0.5], dk, [0, 0.9, -3.05], [0.6, 0, 0]);                                          // alt ön plaka
  B([3.3, 0.5, 0.2], C, [0, 1.48, 3.1]);                                                         // arka plaka
  for (const sx of [-1, 1]) {
    B([0.66, 0.08, 6.7], lt, [sx * 1.4, 1.39, 0]);                                               // çamurluk
    B([0.06, 0.48, 5.4], C, [sx * 1.72, 1.13, 0.1]);                                             // yan etek
    B([0.065, 0.08, 5.0], M, [sx * 1.735, 1.27, 0.1]);                                           // takım şeridi (etek)
    for (let i = 0; i < 4; i++) B([0.04, 0.4, 0.04], dk, [sx * 1.74, 1.13, -2.2 + i * 1.5]);     // etek ek yerleri
    B([0.5, 0.36, 0.6], dk, [sx * 1.25, 1.92, 2.6]);                                             // arka saklama kutuları
    B([0.08, 0.1, 0.25], METAL, [sx * 0.9, 1.12, -3.25]);                                        // çeki kancası
    for (let i = 0; i < 3; i++) B([0.62, 0.03, 0.12], '#151617', [sx * 0.75, 1.75, 1.5 + i * 0.35]);   // motor ızgarası
    B([0.18, 0.18, 0.12], METAL, [sx * 1.0, 1.55, 3.2]);                                         // egzoz
  }
  B([0.5, 0.06, 0.5], METAL, [-0.62, 1.76, -1.85]); B([0.12, 0.08, 0.12], '#14161a', [-0.62, 1.82, -2.12]);     // sürücü kapağı + periskop
  // palet içi: dişli / gergi teker gövdeleri (sabit)
  for (const sx of [-1, 1]) for (const z of [-2.75, 2.75]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 10), mat(METAL)); w.rotation.z = Math.PI / 2; w.position.set(sx * TANK.trackX, 0.6, z); body.add(w); }
  mergeVC(body);
  // kule
  const tur = new THREE.Group(); tur.name = 'kule'; tur.position.set(0, 1.75, TANK.turretZ); root.add(tur);
  const T = (sz, col, pos, rot) => box(tur, sz, col, pos, rot);
  taperBox(tur, [2.5, 0.72, 2.9], C, [0, 0.36, 0.05], [0, 0, 0], [0.86, 0.84], [1, 1]);
  T([2.2, 0.55, 0.9], C, [0, 0.33, 1.75]);                                                       // arka çıkıntı (bustle)
  T([2.3, 0.06, 0.9], dk, [0, 0.62, 1.75]);
  for (const sx of [-1, 1]) {
    T([0.04, 0.32, 0.9], M, [sx * 1.08, 0.42, 0.1], [0, sx * 0.08, 0]);                          // yan takım plakası
    T([0.05, 0.14, 0.4], '#e8e4d8', [sx * 1.1, 0.42, 0.1], [0, sx * 0.08, 0]);                   // numara bandı
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 6), mat(DK)); d.rotation.x = Math.PI / 2 - 0.5; d.position.set(sx * (0.8 + i * 0.12), 0.62, -1.05); tur.add(d); }   // sis havanları
  }
  T([2.36, 0.08, 0.12], M, [0, 0.66, -0.4]);                                                    // kule üstü takım şeridi
  T([0.6, 0.12, 0.6], dk, [-0.55, 0.78, 0.3]);                                                   // komutan kapağı (kapalı)
  T([0.3, 0.22, 0.25], '#202122', [-0.75, 0.82, -0.85]);                                         // nişan dürbünü kutusu
  T([0.04, 2.2, 0.04], '#151617', [-0.95, 1.6, 1.9]); T([0.02, 0.18, 0.34], M, [-0.95, 2.62, 2.05]);   // anten + flama
  mergeVC(tur);
  // top (pivot)
  const gun = new THREE.Group(); gun.name = 'top'; gun.position.set(0, TANK.pivotY - 1.75, -1.35); tur.add(gun);
  box(gun, [0.9, 0.6, 0.6], dk, [0, 0, -0.05]);                                                  // kalkan (mantle)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 4.2, 10), mat(C)); bar.rotation.x = Math.PI / 2; bar.position.set(0, 0, -2.3); gun.add(bar);
  const fume = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.6, 10), mat(dk)); fume.rotation.x = Math.PI / 2; fume.position.set(0, 0, -2.4); gun.add(fume);
  const brk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.36, 8), mat(DK)); brk.rotation.x = Math.PI / 2; brk.position.set(0, 0, -4.3); gun.add(brk);
  mergeVC(gun);
  // nişancı halkası + makineli (kule üstü, sağ)
  const ring = new THREE.Group(); ring.name = 'halka'; ring.position.set(TANK.ringX, 0.72, TANK.ringZ); tur.add(ring);
  const rg = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12), mat(dk)); ring.add(rg);
  const mg = new THREE.Group(); mg.name = 'makineli'; mg.position.set(0, 0.2, -0.5); ring.add(mg);         // nişancının gözünün (kapak + 0,78) altında: namlu görüşün altında kalır
  box(mg, [0.07, 0.07, 1.15], '#1b1c1d', [0, 0.02, -0.5]); box(mg, [0.12, 0.16, 0.42], '#262728', [0, 0, 0]);
  box(mg, [0.16, 0.14, 0.16], '#3d4632', [0.13, -0.04, 0.05]); box(mg, [0.03, 0.12, 0.03], '#111', [-0.05, -0.1, 0.2]); box(mg, [0.03, 0.12, 0.03], '#111', [0.05, -0.1, 0.2]);
  box(mg, [0.56, 0.26, 0.04], C, [0, -0.04, -0.28]);                                             // kalkan (alçak)
  box(ring, [0.08, 0.26, 0.08], DK, [0, 0.12, -0.5]);                                             // makineli ayağı
  mergeVC(ring);                                                  // makineli alt grubu da (özyineli; iki kez birleştirilirse köşe rengi beyaza döner)
  // farlar + stoplar
  const fx = new THREE.Group(); fx.name = 'ışık'; root.add(fx);
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), JEEP_MATS.LENS); hl.rotation.x = Math.PI / 2; hl.position.set(sx * 1.3, 1.55, -3.0); fx.add(hl);
    const hr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.12), mat('#202122')); hr.position.set(sx * 1.3, 1.55, -2.95); fx.add(hr);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.03), JEEP_MATS.TAIL); tl.position.set(sx * 1.5, 1.55, 3.21); fx.add(tl);
  }
  mergeVC(fx);
  return root;
}

const LINK = new THREE.BoxGeometry(0.62, 0.09, 0.24), RW = (() => { const g = new THREE.CylinderGeometry(0.36, 0.36, 0.42, 12); g.rotateZ(Math.PI / 2); return g; })();
const LINK_M = new THREE.MeshStandardMaterial({ color: TRACK, flatShading: true, roughness: 0.9 }), RW_M = new THREE.MeshStandardMaterial({ color: '#2f302c', flatShading: true, roughness: 0.85 });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _tp = {};

export function createTank(team) {
  const k = team || 'null';
  const r = (cache[k] ||= build(team)).clone(true);
  const find = (n) => r.getObjectByName(n);
  // paletler + yol tekerleri: araç başına iki InstancedMesh (her karede yakındaysa güncellenir)
  const links = new THREE.InstancedMesh(LINK, LINK_M, TANK.linkN * 2); links.castShadow = true; links.frustumCulled = false; r.add(links);
  const wheels = new THREE.InstancedMesh(RW, RW_M, TANK.wheelZ.length * 2); wheels.castShadow = true; wheels.frustumCulled = false; r.add(wheels);
  const U = { turret: find('kule'), gun: find('top'), ring: find('halka'), mg: find('makineli'), fx: find('ışık'), body: find('gövde'), links, rw: wheels, team: k, tank: true };
  r.userData = U;
  setTracks(r, 0, 0, 0);
  return r;
}

// palet / teker animasyonu: sL / sR = sol / sağ paletin katettiği yol (m), spin = teker açısı
export function setTracks(model, sL, sR, ign) {
  const U = model.userData, n = TANK.linkN, step = TRACK_LEN / n;
  let k = 0;
  for (const [sx, sd] of [[-1, sL], [1, sR]]) {
    for (let i = 0; i < n; i++) {
      trackPoint(i * step + sd, _tp);
      _e.set(-_tp.a, 0, 0); _q.setFromEuler(_e); _p.set(sx * TANK.trackX, _tp.y + 0.05, _tp.z);
      U.links.setMatrixAt(k++, _m.compose(_p, _q, _s));
    }
  }
  U.links.instanceMatrix.needsUpdate = true;
  k = 0;
  for (const [sx, sd] of [[-1, sL], [1, sR]]) for (const z of TANK.wheelZ) {
    _e.set(-sd / 0.36, 0, 0); _q.setFromEuler(_e); _p.set(sx * TANK.trackX, 0.42, z);
    U.rw.setMatrixAt(k++, _m.compose(_p, _q, _s));
  }
  U.rw.instanceMatrix.needsUpdate = true;
}
