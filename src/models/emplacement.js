import * as THREE from 'three';
import { box, cyl, cylY, mergeVC } from '../core/geo.js';

// 12.213 sabit silah yuvası modelleri (ağır makineli M2 benzeri .50 cal tripodlu + çelik kalkan; TOW benzeri güdümlü tanksavar tripodu).
// Konvansiyon: ileri = −Z, yukarı = +Y; kök = dönme ekseninin tabanı (yuvanın zemini). Kök silahın yönüyle döner (st.yaw); 'ayak' grubu (tripod)
// yuvanın yönünde sabit kalır (vehicleView: ayak.rotation.y = base − yaw); 'silah' grubu nişancının bakışıyla yükselir (pitch).
// Vuruş kutuları (sim/emplacement.js) bu ölçülerle aynı: HMG gövde 0,24 × 0,24 × 0,84 (0,98–1,24 m) + kalkan 0,88 × 0,62 × 0,06 (0,38–0,44 m önde);
// TOW tüp + dürbün 0,26 × 0,38 × 1,56 (1,04–1,42 m).
const OLIVE = '#4b5238', DK = '#1c1d1f', STEEL = '#3a3e40', WOOD = '#6d5440';
const cache = {};

function tripod(g, top, legs) {
  for (const [x, z] of legs) {                                                    // ince borular (≤ 4 cm: görsel)
    const L = Math.hypot(x, top, z);
    const leg = cylY(g, 0.02, 0.025, L, DK, [x / 2, top / 2, z / 2], 5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-x, top, -z).normalize());
    box(g, [0.08, 0.03, 0.12], DK, [x, 0.015, z]);                                // ayak tabanı
  }
}

function buildHmg() {
  const root = new THREE.Group(), body = new THREE.Group(); body.name = 'gövde'; root.add(body);
  const base = new THREE.Group(); base.name = 'ayak'; body.add(base);
  tripod(base, 0.62, [[0, -0.72], [-0.52, 0.5], [0.52, 0.5]]);
  cylY(base, 0.05, 0.06, 0.08, DK, [0, 0.6, 0], 8);
  mergeVC(base);
  // dönen kısım: pintle, kalkan, cephane sandığı (tabure), nişancı tabure
  const turn = new THREE.Group(); turn.name = 'dönen'; body.add(turn);
  cylY(turn, 0.035, 0.035, 0.36, STEEL, [0, 0.8, 0], 6);
  box(turn, [0.88, 0.62, 0.06], OLIVE, [0, 0.93, -0.41]);                         // kalkan (0,62–1,24 m)
  box(turn, [0.88, 0.04, 0.07], '#3b4130', [0, 1.22, -0.41]);                     // üst kenar
  for (const sx of [-1, 1]) box(turn, [0.04, 0.62, 0.07], '#3b4130', [sx * 0.42, 0.93, -0.41]);
  for (const [x, z] of [[-0.12, 0.66], [0.12, 0.66], [-0.12, 0.9], [0.12, 0.9]]) cylY(turn, 0.018, 0.018, 0.54, DK, [x, 0.27, z], 4);      // tabure ayakları
  box(turn, [0.36, 0.05, 0.34], WOOD, [0, 0.56, 0.78]);                           // tabure (nişancı oturağı 0,6 m)
  mergeVC(turn);
  // silah (yükselir): alıcı, namlu, soğutma gömleği, tutamaklar, fişek kutusu
  const gun = new THREE.Group(); gun.name = 'silah'; gun.position.set(0, 1.1, 0); body.add(gun);
  box(gun, [0.22, 0.22, 0.8], '#26282a', [0, 0, 0.02]);
  cyl(gun, 0.03, 0.035, 1.15, '#151617', [0, 0.02, -0.95], 8);
  cyl(gun, 0.055, 0.055, 0.5, '#2b2d2f', [0, 0.02, -0.6], 8);                   // namlu gömleği (delikli kılıf)
  box(gun, [0.07, 0.07, 0.12], '#0e0e0f', [0, 0.02, -1.55]);                       // ağız
  box(gun, [0.2, 0.18, 0.28], '#3b4a32', [-0.21, -0.02, 0.0]);                     // fişek kutusu
  box(gun, [0.06, 0.08, 0.04], '#3b4a32', [-0.13, 0.04, 0.0]);                     // besleme
  for (const sx of [-1, 1]) box(gun, [0.03, 0.12, 0.03], '#111', [sx * 0.07, -0.05, 0.45]);
  box(gun, [0.18, 0.03, 0.05], '#111', [0, -0.11, 0.45]);
  box(gun, [0.02, 0.08, 0.02], '#111', [0, 0.15, -0.25]);                          // arpacık
  mergeVC(gun);
  const fx = new THREE.Group(); fx.name = 'ışık'; root.add(fx);
  return root;
}

function buildAtgm() {
  const root = new THREE.Group(), body = new THREE.Group(); body.name = 'gövde'; root.add(body);
  const base = new THREE.Group(); base.name = 'ayak'; body.add(base);
  tripod(base, 0.82, [[0, -0.75], [-0.6, 0.45], [0.6, 0.45]]);
  mergeVC(base);
  const turn = new THREE.Group(); turn.name = 'dönen'; body.add(turn);
  box(turn, [0.3, 0.2, 0.3], OLIVE, [0, 0.92, 0]);                                // dönme / yükselme kafası
  cylY(turn, 0.05, 0.05, 0.12, STEEL, [0, 0.78, 0], 8);
  box(turn, [0.42, 0.3, 0.3], '#3a4230', [0.0, 0.15, 0.55]);                       // füze sandığı (yerde)
  for (const [x, z] of [[-0.12, 0.85], [0.12, 0.85], [-0.12, 1.15], [0.12, 1.15]]) cylY(turn, 0.018, 0.018, 0.56, DK, [x, 0.28, z], 4);
  box(turn, [0.36, 0.05, 0.34], WOOD, [0, 0.58, 1.0]);                             // nişancı taburesi
  mergeVC(turn);
  const gun = new THREE.Group(); gun.name = 'silah'; gun.position.set(0, 1.18, 0); body.add(gun);
  cyl(gun, 0.12, 0.12, 1.52, '#4a5236', [0, 0, 0], 12);                           // fırlatma tüpü (1,06–1,30 m)
  cyl(gun, 0.13, 0.13, 0.08, '#2c3022', [0, 0, -0.72], 12);
  cyl(gun, 0.13, 0.13, 0.08, '#2c3022', [0, 0, 0.72], 12);
  box(gun, [0.1, 0.12, 0.42], '#2a2c2e', [0, 0.18, 0.18]);                         // nişan dürbünü (1,30–1,42 m)
  box(gun, [0.08, 0.08, 0.04], '#6fa8c8', [0, 0.18, -0.04]);
  for (const sx of [-1, 1]) box(gun, [0.03, 0.1, 0.03], '#111', [sx * 0.08, -0.16, 0.45]);
  mergeVC(gun);
  const fx = new THREE.Group(); fx.name = 'ışık'; root.add(fx);
  return root;
}

export function createEmplacement(type) {
  const T = (cache[type] ||= type === 'atgm' ? buildAtgm() : buildHmg());
  const r = T.clone(true), find = (n) => r.getObjectByName(n);
  r.userData = { emp: type, body: find('gövde'), base: find('ayak'), gun: find('silah'), fx: find('ışık') };
  return r;
}
