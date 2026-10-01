import * as THREE from 'three';
import { box, taperBox, cyl, cylY, ico } from '../core/geo.js';
import { C } from '../core/palette.js';
import { createItem } from './items.js';
import { M, finish, railTicks, magGroup } from './weapon_util.js';

// Yeni silahlar. Her biri ayırt edilebilir siluet; origin = kabza (sağ el), namlu -Z.
// mag: şarjör alt grubu (reload animasyonu), bolt: sürgü kolu alt grubu.
const BLK = C.black, STL = C.steel;
const GLASSY = '#8a919b';

// Nişangâh montaj noktaları (weapons.js MOUNT ile birleşir)
export const MOUNT_MORE = {
  scarh: { z: -0.12, y: 0.103, front: 0.145, rearZ: 0.0, frontZ: -0.74, frontBase: 0.103 },
  aug: { z: -0.04, y: 0.123, front: 0.153, rearZ: 0.12, frontZ: -0.33, frontBase: 0.123 },
  g36: { z: -0.1, y: 0.1235, front: 0.158, rearZ: 0.04, ownFront: true },
  ak74u: { z: -0.08, y: 0.083, front: 0.1, rearZ: -0.12, ownFront: true },
  vector: { z: -0.1, y: 0.082, front: 0.115, rearZ: 0.05, frontZ: -0.46, frontBase: 0.08 },
  p90: { z: -0.06, y: 0.105, front: 0.14, rearZ: 0.08, ownFront: true },
  mac10: { z: -0.03, y: 0.062, front: 0.085, rearZ: 0.04, ownFront: true, scale: 0.75 },
  aa12: { z: -0.06, y: 0.103, front: 0.138, rearZ: 0.06, ownFront: true },
  dbl: { z: 0.0, y: 0.068, front: 0.088, rearZ: 0.03, ownFront: true, scale: 0.8 },
  deagle: { z: -0.02, y: 0.075, front: 0.093, rearZ: 0.04, frontZ: -0.2, frontBase: 0.075, scale: 0.8 },
  revolver: { z: 0.0, y: 0.07, front: 0.09, rearZ: 0.05, ownFront: true, scale: 0.75 },
  m1911: { z: -0.02, y: 0.071, front: 0.087, rearZ: 0.035, frontZ: -0.15, frontBase: 0.07, scale: 0.75 },
  svd: { z: -0.06, y: 0.092 },
  pkm: { z: -0.12, y: 0.1, front: 0.14, rearZ: -0.05, frontZ: -0.84, frontBase: 0.045 },
  m79: { z: 0.0, y: 0.08, front: 0.095, rearZ: 0.02, ownFront: true },
};

function curvedMag(mg, color, x = 0, z = -0.13, s = 1) {
  box(mg, [0.04, 0.11 * s, 0.075], color, [x, -0.075, z], [0.12, 0, 0], M);
  box(mg, [0.04, 0.1 * s, 0.075], color, [x, -0.165, z - 0.025], [0.36, 0, 0], M);
  box(mg, [0.04, 0.09 * s, 0.07], color, [x, -0.25, z - 0.07], [0.62, 0, 0], M);
}

// ───────────────────────── SCAR-H ─────────────────────────
function scarh() {
  const g = new THREE.Group(), T = C.tan;
  box(g, [0.05, 0.07, 0.2], BLK, [0, 0, -0.02], null, M);                        // alt gövde
  box(g, [0.052, 0.062, 0.5], T, [0, 0.062, -0.2], null, M);                     // üst gövde
  box(g, [0.06, 0.075, 0.3], T, [0, 0.0555, -0.58], null, M);                    // tutamaç
  box(g, [0.024, 0.01, 0.84], BLK, [0, 0.098, -0.32]);                           // uzun ray
  railTicks(g, -0.72, 0.0, 0.1, 14);
  for (let i = 0; i < 3; i++) box(g, [0.062, 0.012, 0.03], BLK, [0, 0.03, -0.48 - i * 0.07]);   // havalandırma
  cyl(g, 0.01, 0.01, 0.14, STL, [0, 0.05, -0.79], 8, M);                         // namlu
  cyl(g, 0.017, 0.017, 0.07, BLK, [0, 0.05, -0.87], 8, M);                       // alev kırıcı
  box(g, [0.018, 0.026, 0.024], STL, [0, 0.115, -0.74]);                         // gaz bloğu
  box(g, [0.01, 0.014, 0.05], C.steel, [0.033, 0.07, -0.15]);                    // sürgü kolu
  const mg = magGroup(g);
  box(mg, [0.038, 0.14, 0.07], STL, [0, -0.095, -0.1], [0.08, 0, 0], M);        // şarjör
  box(mg, [0.042, 0.014, 0.074], BLK, [0, -0.17, -0.11], [0.08, 0, 0]);
  box(g, [0.042, 0.105, 0.05], BLK, [0, -0.075, 0.045], [0.3, 0, 0]);            // kabza
  box(g, [0.012, 0.012, 0.1], STL, [0, -0.04, -0.01]);
  box(g, [0.03, 0.09, 0.036], BLK, [0, -0.04, -0.55], [-0.12, 0, 0]);            // ön kabza
  taperBox(g, [0.046, 0.1, 0.28], T, [0, 0.0, 0.2], [0.06, 0, 0], [1, 1], [1, 1], M);  // dipçik
  box(g, [0.05, 0.11, 0.014], BLK, [0, -0.012, 0.345], [0.06, 0, 0]);
  return finish(g, { name: 'SCAR-H', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.035, -0.55], muzzle: [0, 0.05, -0.92], length: 1.28 });
}

// ───────────────────────── AUG (bullpup) ─────────────────────────
function aug() {
  const g = new THREE.Group(), OD = C.oliveDark;
  box(g, [0.056, 0.095, 0.6], C.olive, [0, 0.022, 0.05], null, M);               // gövde (kabzanın arkasına uzanır)
  box(g, [0.052, 0.07, 0.2], OD, [0, 0.015, -0.34], null, M);                    // ön tutamaç
  box(g, [0.05, 0.036, 0.72], OD, [0, 0.0955, 0.0], null, M);                    // üst taşıma gövdesi
  box(g, [0.024, 0.008, 0.68], BLK, [0, 0.1175, 0.0]);
  railTicks(g, -0.3, 0.3, 0.123, 12);
  box(g, [0.012, 0.03, 0.05], STL, [0.032, 0.06, 0.1]);                          // dışarı atış kapağı
  cyl(g, 0.009, 0.009, 0.11, STL, [0, 0.025, -0.495], 8, M);                     // namlu
  cyl(g, 0.015, 0.015, 0.055, BLK, [0, 0.025, -0.575], 8, M);                    // alev kırıcı
  box(g, [0.03, 0.09, 0.03], BLK, [0, -0.05, -0.33]);                            // dik ön kabza
  box(g, [0.04, 0.1, 0.05], BLK, [0, -0.07, 0.01], [0.3, 0, 0]);                 // kabza
  box(g, [0.012, 0.012, 0.085], STL, [0, -0.04, -0.05]);
  const mg = magGroup(g);
  box(mg, [0.038, 0.14, 0.058], GLASSY, [0, -0.09, 0.15], [-0.04, 0, 0], M);     // şeffaf şarjör (kabzanın arkasında)
  box(mg, [0.04, 0.012, 0.06], BLK, [0, -0.16, 0.152], [-0.04, 0, 0]);
  box(g, [0.05, 0.1, 0.016], BLK, [0, 0.01, 0.355]);                             // dipçik pedi
  return finish(g, { name: 'AUG', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.015], gripL: [0, -0.04, -0.33], muzzle: [0, 0.025, -0.62], length: 0.99 });
}

// ───────────────────────── G36 ─────────────────────────
function g36() {
  const g = new THREE.Group();
  box(g, [0.05, 0.075, 0.34], C.gun, [0, 0.02, -0.07], null, M);
  box(g, [0.048, 0.06, 0.2], BLK, [0, -0.005, 0.0]);
  box(g, [0.058, 0.07, 0.2], BLK, [0, 0.012, -0.38], null, M);                   // tutamaç
  for (let i = 0; i < 3; i++) box(g, [0.06, 0.012, 0.016], C.gun, [0, 0.018, -0.32 - i * 0.05]);
  cyl(g, 0.01, 0.01, 0.14, STL, [0, 0.025, -0.55], 8, M);
  cyl(g, 0.016, 0.016, 0.06, BLK, [0, 0.025, -0.63], 8, M);
  // taşıma sapı + sabit nişan kulesi
  box(g, [0.036, 0.04, 0.3], BLK, [0, 0.0975, -0.03], null, M);
  box(g, [0.024, 0.008, 0.26], BLK, [0, 0.1195, -0.03]);
  box(g, [0.018, 0.058, 0.022], BLK, [0, 0.093, -0.52]);                         // ön kule
  box(g, [0.006, 0.03, 0.006], STL, [0, 0.137, -0.52]);                          // arpacık
  const mg = magGroup(g);
  box(mg, [0.038, 0.11, 0.06], GLASSY, [0, -0.08, -0.13], [0.1, 0, 0], M);       // şeffaf kavisli şarjör
  box(mg, [0.038, 0.09, 0.06], GLASSY, [0, -0.17, -0.155], [0.3, 0, 0], M);
  box(g, [0.042, 0.105, 0.05], BLK, [0, -0.075, 0.045], [0.3, 0, 0]);
  box(g, [0.012, 0.012, 0.09], STL, [0, -0.045, -0.02]);
  // katlanır dipçik (iskelet)
  box(g, [0.012, 0.012, 0.3], STL, [0, 0.04, 0.24], null, M);
  box(g, [0.012, 0.012, 0.28], STL, [0, -0.04, 0.23], [0.12, 0, 0], M);
  box(g, [0.044, 0.12, 0.02], BLK, [0, -0.0, 0.385], [0.1, 0, 0]);
  return finish(g, { name: 'G36', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.38], muzzle: [0, 0.025, -0.67], length: 1.08 });
}

// ───────────────────────── AK-74U ─────────────────────────
function ak74u() {
  const g = new THREE.Group(), PLUM = '#6b3a2a';
  box(g, [0.05, 0.07, 0.28], C.gun, [0, 0.02, -0.08], null, M);
  taperBox(g, [0.044, 0.026, 0.28], C.gunLight, [0, 0.07, -0.08], null, [0.85, 1], [1, 1], M);
  box(g, [0.012, 0.012, 0.1], STL, [0, -0.045, -0.04]);
  box(g, [0.058, 0.055, 0.14], BLK, [0, 0.0, -0.27]);                            // kısa tutamaç
  box(g, [0.04, 0.02, 0.12], C.gunLight, [0, 0.043, -0.27]);
  cyl(g, 0.011, 0.011, 0.07, STL, [0, 0.015, -0.4], 8, M);
  cyl(g, 0.019, 0.017, 0.07, BLK, [0, 0.015, -0.46], 8, M);                      // namlu ağzı yükseltici
  box(g, [0.018, 0.05, 0.022], STL, [0, 0.045, -0.42]);                          // ön kule
  box(g, [0.006, 0.03, 0.006], STL, [0, 0.085, -0.42]);
  const mg = magGroup(g);
  curvedMag(mg, PLUM, 0, -0.13, 0.85);
  box(g, [0.042, 0.115, 0.052], BLK, [0, -0.075, 0.05], [0.32, 0, 0]);
  // tel dipçik
  box(g, [0.012, 0.012, 0.26], STL, [0, 0.035, 0.22], null, M);
  box(g, [0.012, 0.012, 0.26], STL, [0, -0.035, 0.22], [0.1, 0, 0], M);
  box(g, [0.044, 0.1, 0.016], BLK, [0, 0.0, 0.36], [0.1, 0, 0]);
  return finish(g, { name: 'AK-74U', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.27], muzzle: [0, 0.015, -0.5], length: 0.88 });
}

// ───────────────────────── Vector ─────────────────────────
function vector() {
  const g = new THREE.Group();
  box(g, [0.06, 0.1, 0.34], C.gun, [0, 0.02, -0.1], null, M);
  taperBox(g, [0.058, 0.075, 0.2], BLK, [0, 0.03, -0.34], null, [1, 1], [1, 0.8]);     // ön kılıf (eğimli uç)
  box(g, [0.024, 0.008, 0.42], BLK, [0, 0.078, -0.15]);
  railTicks(g, -0.34, 0.04, 0.084, 8);
  cyl(g, 0.012, 0.012, 0.08, STL, [0, 0.03, -0.5], 8, M);
  box(g, [0.062, 0.03, 0.06], C.gunLight, [0, -0.02, -0.14]);                    // tetik bloğu
  const mg = magGroup(g);
  box(mg, [0.04, 0.15, 0.06], STL, [0, -0.1, 0.03], [0.0, 0, 0], M);             // şarjör (kabzanın içinde)
  box(mg, [0.044, 0.014, 0.064], BLK, [0, -0.178, 0.03]);
  box(g, [0.042, 0.1, 0.04], BLK, [0, -0.07, 0.095], [0.4, 0, 0]);               // kabza arkası
  box(g, [0.03, 0.08, 0.04], BLK, [0, -0.05, -0.3], [-0.1, 0, 0]);               // ön kabza
  box(g, [0.014, 0.075, 0.012], STL, [0, 0.04, 0.19], null, M);                   // omuz çubuğu
  box(g, [0.014, 0.014, 0.1], STL, [0, 0.07, 0.15], null, M);
  box(g, [0.04, 0.1, 0.02], BLK, [0, 0.01, 0.245]);
  return finish(g, { name: 'Vector', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.065], gripL: [0, -0.04, -0.3], muzzle: [0, 0.03, -0.55], length: 0.8 });
}

// ───────────────────────── P90 ─────────────────────────
function p90() {
  const g = new THREE.Group();
  taperBox(g, [0.064, 0.115, 0.44], BLK, [0, 0.0, -0.02], null, [0.9, 1], [1, 1], M);
  const mg = magGroup(g);
  box(mg, [0.056, 0.032, 0.32], GLASSY, [0, 0.0765, -0.05], null, M);            // üst yatay şarjör (50 mermi)
  box(mg, [0.058, 0.012, 0.32], BLK, [0, 0.0955, -0.05]);
  box(g, [0.03, 0.012, 0.34], BLK, [0, 0.108, -0.05]);                           // ray
  railTicks(g, -0.2, 0.1, 0.116, 8);
  box(g, [0.05, 0.06, 0.12], BLK, [0, -0.025, -0.2]);                            // ön tutamaç
  cyl(g, 0.011, 0.011, 0.1, STL, [0, 0.02, -0.28], 8, M);
  cyl(g, 0.015, 0.015, 0.05, BLK, [0, 0.02, -0.345], 8, M);
  box(g, [0.04, 0.09, 0.045], BLK, [0, -0.075, 0.02], [0.12, 0, 0]);             // kabza
  box(g, [0.012, 0.012, 0.13], STL, [0, -0.05, -0.06]);                          // büyük tetik koruması
  box(g, [0.012, 0.04, 0.012], STL, [0, -0.07, -0.12]);
  box(g, [0.05, 0.09, 0.06], BLK, [0, 0.01, 0.21]);                              // omuz kısmı
  box(g, [0.05, 0.1, 0.014], BLK, [0, 0.005, 0.245]);
  box(g, [0.02, 0.07, 0.022], BLK, [0, 0.06, -0.3]);                             // ön kule
  box(g, [0.006, 0.02, 0.006], STL, [0, 0.13, -0.3]);
  box(g, [0.016, 0.07, 0.016], BLK, [0, 0.105, -0.3]);
  return finish(g, { name: 'P90', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.02], gripL: [0, -0.03, -0.2], muzzle: [0, 0.02, -0.37], length: 0.62 });
}

// ───────────────────────── MAC-10 ─────────────────────────
function mac10() {
  const g = new THREE.Group();
  box(g, [0.05, 0.08, 0.18], C.gun, [0, 0.02, -0.03], null, M);
  box(g, [0.042, 0.022, 0.18], BLK, [0, 0.07, -0.03]);
  cyl(g, 0.013, 0.013, 0.1, STL, [0, 0.035, -0.17], 8, M);
  cyl(g, 0.019, 0.019, 0.04, BLK, [0, 0.035, -0.235], 8, M);                     // namlu manşonu
  box(g, [0.006, 0.03, 0.006], STL, [0, 0.085, -0.2]);                           // arpacık
  box(g, [0.012, 0.012, 0.09], STL, [0, -0.03, -0.01]);                          // tetik koruması
  const mg = magGroup(g);
  box(mg, [0.034, 0.14, 0.05], STL, [0, -0.09, 0.015], null, M);
  box(g, [0.04, 0.09, 0.04], BLK, [0, -0.045, 0.06], [0.1, 0, 0]);
  box(g, [0.012, 0.012, 0.22], STL, [0, 0.03, 0.2], null, M);                     // tel dipçik
  box(g, [0.012, 0.012, 0.22], STL, [0, -0.015, 0.2], [0.05, 0, 0], M);
  box(g, [0.012, 0.06, 0.012], STL, [0, 0.01, 0.31], null, M);
  return finish(g, { name: 'MAC-10', mag: mg, hold: 'pistol', gripR: [0, -0.025, 0.04], gripL: null, muzzle: [0, 0.035, -0.26], length: 0.58 });
}

// ───────────────────────── AA-12 ─────────────────────────
function aa12() {
  const g = new THREE.Group();
  box(g, [0.062, 0.09, 0.42], C.gun, [0, 0.02, -0.06], null, M);
  box(g, [0.05, 0.03, 0.4], BLK, [0, 0.08, -0.06]);
  box(g, [0.026, 0.008, 0.36], BLK, [0, 0.099, -0.06]);
  railTicks(g, -0.22, 0.08, 0.105, 8);
  cyl(g, 0.018, 0.018, 0.4, STL, [0, 0.04, -0.46], 8, M);                        // kalın namlu
  cyl(g, 0.024, 0.024, 0.08, BLK, [0, 0.04, -0.7], 8, M);                        // namlu freni
  for (let i = 0; i < 3; i++) box(g, [0.05, 0.008, 0.014], C.gun, [0, 0.062, -0.68 - i * 0.02]);
  box(g, [0.064, 0.07, 0.22], BLK, [0, 0.02, -0.4]);
  box(g, [0.02, 0.05, 0.03], BLK, [0, 0.085, -0.66]);
  box(g, [0.006, 0.03, 0.006], STL, [0, 0.125, -0.66]);
  const mg = magGroup(g);
  box(mg, [0.05, 0.17, 0.1], BLK, [0, -0.12, -0.06], null, M);                   // kutu şarjör
  for (let i = 0; i < 3; i++) box(mg, [0.052, 0.012, 0.102], STL, [0, -0.07 - i * 0.05, -0.06]);
  box(g, [0.042, 0.1, 0.05], BLK, [0, -0.075, 0.08], [0.3, 0, 0]);
  box(g, [0.03, 0.09, 0.034], BLK, [0, -0.045, -0.34]);
  taperBox(g, [0.05, 0.11, 0.28], BLK, [0, 0.0, 0.27], [0.08, 0, 0], [1, 1], [1, 1], M);
  box(g, [0.054, 0.12, 0.014], STL, [0, -0.02, 0.41], [0.08, 0, 0]);
  return finish(g, { name: 'AA-12', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.08], gripL: [0, -0.04, -0.34], muzzle: [0, 0.04, -0.75], length: 1.2 });
}

// ───────────────────────── Çift namlulu ─────────────────────────
function dbl() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) cyl(g, 0.016, 0.017, 0.62, C.gun, [sx * 0.0175, 0.045, -0.4], 8, M);
  box(g, [0.01, 0.012, 0.62], STL, [0, 0.066, -0.4]);                            // üst şerit
  box(g, [0.058, 0.08, 0.14], STL, [0, 0.02, -0.03], null, M);                   // kırılma gövdesi
  box(g, [0.062, 0.045, 0.2], C.woodDark, [0, -0.002, -0.21]);                   // ön kundak
  box(g, [0.01, 0.014, 0.1], C.brass, [0, 0.0, -0.1]);                           // menteşe
  box(g, [0.008, 0.02, 0.008], C.brass, [0, 0.078, -0.7]);                       // arpacık boncuğu
  box(g, [0.012, 0.012, 0.08], STL, [0, -0.045, 0.0]);
  box(g, [0.04, 0.09, 0.05], C.wood, [0, -0.05, 0.06], [0.28, 0, 0]);
  taperBox(g, [0.05, 0.115, 0.32], C.wood, [0, -0.012, 0.25], [0.14, 0, 0], [1, 1], [1, 1]);
  box(g, [0.054, 0.12, 0.014], BLK, [0, -0.04, 0.415], [0.14, 0, 0]);
  box(g, [0.014, 0.03, 0.02], STL, [0, 0.07, 0.03]);                             // horoz
  return finish(g, { name: 'Çift Namlu', hold: 'rifle', gripR: [0, -0.03, 0.055], gripL: [0, -0.03, -0.22], muzzle: [0, 0.045, -0.72], length: 1.14 });
}

// ───────────────────────── Desert Eagle ─────────────────────────
function deagle() {
  const g = new THREE.Group();
  box(g, [0.04, 0.05, 0.26], C.chrome, [0, 0.05, -0.08], null, { metalness: 0.5, roughness: 0.35 });   // sürgü
  taperBox(g, [0.036, 0.045, 0.07], C.chrome, [0, 0.04, -0.245], null, [1, 0.8], [1, 1], { metalness: 0.5, roughness: 0.35 });
  box(g, [0.038, 0.035, 0.2], BLK, [0, 0.012, -0.06]);
  box(g, [0.014, 0.008, 0.2], BLK, [0, 0.078, -0.1]);                           // üst ray
  for (let i = 0; i < 4; i++) box(g, [0.042, 0.034, 0.005], BLK, [0, 0.055, 0.035 + i * 0.012]);
  box(g, [0.012, 0.012, 0.08], BLK, [0, -0.012, -0.03]);
  box(g, [0.012, 0.03, 0.012], BLK, [0, -0.005, -0.075]);
  box(g, [0.04, 0.11, 0.06], BLK, [0, -0.045, 0.045], [0.2, 0, 0]);
  const mg = magGroup(g);
  box(mg, [0.03, 0.05, 0.05], STL, [0, -0.11, 0.055], [0.2, 0, 0], M);
  return finish(g, { name: 'Desert Eagle', mag: mg, hold: 'pistol', gripR: [0, -0.03, 0.045], gripL: null, muzzle: [0, 0.04, -0.285], length: 0.36 });
}

// ───────────────────────── Revolver ─────────────────────────
function revolver() {
  const g = new THREE.Group(), CH = { metalness: 0.55, roughness: 0.3 };
  box(g, [0.036, 0.07, 0.15], C.chrome, [0, 0.035, 0.0], null, CH);             // çerçeve
  cyl(g, 0.032, 0.032, 0.075, C.chrome, [0, 0.042, -0.07], 8, CH);              // silindir
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; box(g, [0.01, 0.012, 0.078], BLK, [Math.cos(a) * 0.026, 0.042 + Math.sin(a) * 0.026, -0.07]); }
  cyl(g, 0.014, 0.014, 0.28, C.chrome, [0, 0.062, -0.25], 8, CH);                // namlu
  box(g, [0.016, 0.02, 0.22], C.gun, [0, 0.03, -0.23], null, M);                 // alt kütle
  box(g, [0.006, 0.02, 0.008], BLK, [0, 0.084, -0.37]);                          // arpacık
  box(g, [0.01, 0.03, 0.02], STL, [0, 0.08, 0.06], [-0.3, 0, 0]);                // horoz
  box(g, [0.012, 0.012, 0.07], STL, [0, -0.005, -0.04]);
  box(g, [0.042, 0.1, 0.055], C.wood, [0, -0.04, 0.055], [0.35, 0, 0]);         // ahşap kabza
  return finish(g, { name: 'Revolver', hold: 'pistol', gripR: [0, -0.03, 0.05], gripL: null, muzzle: [0, 0.062, -0.4], length: 0.5 });
}

// ───────────────────────── M1911 ─────────────────────────
function m1911() {
  const g = new THREE.Group();
  box(g, [0.034, 0.04, 0.2], STL, [0, 0.05, -0.05], null, M);                    // sürgü
  box(g, [0.03, 0.03, 0.18], C.gun, [0, 0.018, -0.05], null, M);                 // çerçeve
  cyl(g, 0.009, 0.009, 0.03, C.chrome, [0, 0.05, -0.16], 8, M);
  box(g, [0.012, 0.012, 0.07], STL, [0, -0.002, -0.03]);
  box(g, [0.01, 0.03, 0.01], STL, [0, 0.005, -0.065]);
  box(g, [0.034, 0.1, 0.055], C.gun, [0, -0.04, 0.025], [0.2, 0, 0]);
  for (const sx of [-1, 1]) box(g, [0.008, 0.09, 0.05], C.woodDark, [sx * 0.02, -0.04, 0.025], [0.2, 0, 0]);   // ahşap yan paneller
  box(g, [0.012, 0.03, 0.02], STL, [0, 0.07, 0.055], [-0.3, 0, 0]);              // horoz
  for (let i = 0; i < 3; i++) box(g, [0.036, 0.03, 0.005], BLK, [0, 0.055, 0.025 + i * 0.012]);
  const mg = magGroup(g);
  box(mg, [0.028, 0.04, 0.045], C.chrome, [0, -0.1, 0.04], [0.2, 0, 0], M);
  return finish(g, { name: 'M1911', mag: mg, hold: 'pistol', gripR: [0, -0.03, 0.025], gripL: null, muzzle: [0, 0.05, -0.18], length: 0.28 });
}

// ───────────────────────── SVD (DMR) ─────────────────────────
function svd() {
  const g = new THREE.Group();
  box(g, [0.048, 0.07, 0.34], C.gun, [0, 0.02, -0.1], null, M);
  taperBox(g, [0.042, 0.026, 0.3], C.gunLight, [0, 0.07, -0.1], null, [0.85, 1], [1, 1], M);
  box(g, [0.024, 0.008, 0.3], BLK, [0, 0.088, -0.1]);                            // optik rayı
  box(g, [0.012, 0.012, 0.1], STL, [0, -0.045, -0.04]);
  box(g, [0.054, 0.05, 0.34], C.wood, [0, -0.002, -0.4]);                        // ahşap kundak
  taperBox(g, [0.048, 0.03, 0.3], C.woodDark, [0, 0.04, -0.4], null, [0.9, 1]);
  cyl(g, 0.011, 0.011, 0.44, STL, [0, 0.03, -0.79], 8, M);                       // ince uzun namlu
  cyl(g, 0.018, 0.015, 0.07, BLK, [0, 0.03, -1.03], 8, M);                       // alev kırıcı (kafes)
  box(g, [0.018, 0.05, 0.022], STL, [0, 0.06, -0.97]);                           // arpacık kulesi
  const mg = magGroup(g);
  curvedMag(mg, STL, 0, -0.13, 0.8);
  box(g, [0.042, 0.115, 0.052], C.woodDark, [0, -0.075, 0.05], [0.32, 0, 0]);
  // iskelet dipçik (delikli)
  box(g, [0.04, 0.03, 0.32], C.wood, [0, 0.035, 0.22], [0.02, 0, 0]);
  box(g, [0.04, 0.03, 0.3], C.wood, [0, -0.07, 0.22], [-0.08, 0, 0]);
  box(g, [0.04, 0.16, 0.03], C.wood, [0, -0.02, 0.37], [0.08, 0, 0]);
  box(g, [0.04, 0.04, 0.14], C.woodDark, [0, 0.07, 0.28], [0.02, 0, 0]);          // yanak desteği
  box(g, [0.05, 0.13, 0.014], BLK, [0, -0.03, 0.395], [0.08, 0, 0]);
  return finish(g, { name: 'SVD', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.05], gripL: [0, -0.03, -0.42], muzzle: [0, 0.03, -1.07], length: 1.5 });
}

// ───────────────────────── Barrett .50 ─────────────────────────
function barrett() {
  const g = new THREE.Group(), T = C.tan;
  box(g, [0.07, 0.1, 0.5], C.gun, [0, 0.03, -0.1], null, M);                     // gövde
  box(g, [0.075, 0.07, 0.3], T, [0, 0.0, -0.5], null, M);                        // tutamaç
  box(g, [0.034, 0.012, 0.7], BLK, [0, 0.09, -0.15]);                            // uzun ray
  cyl(g, 0.024, 0.024, 0.45, STL, [0, 0.05, -0.72], 8, M);                       // kalın namlu
  cyl(g, 0.03, 0.03, 0.2, C.gun, [0, 0.05, -0.62], 8, M);
  const brk = cyl(g, 0.036, 0.036, 0.15, BLK, [0, 0.05, -1.04], 8, M);          // büyük namlu freni
  for (let i = 0; i < 4; i++) box(g, [0.08, 0.01, 0.012], STL, [0, 0.05, -0.99 - i * 0.03]);
  const mg = magGroup(g);
  box(mg, [0.055, 0.1, 0.14], STL, [0, -0.08, -0.1], null, M);                   // kutu şarjör
  box(mg, [0.058, 0.014, 0.144], BLK, [0, -0.135, -0.1]);
  box(g, [0.045, 0.11, 0.05], BLK, [0, -0.075, 0.06], [0.3, 0, 0]);
  box(g, [0.014, 0.014, 0.1], STL, [0, -0.03, 0.0]);
  // büyük dürbün
  cyl(g, 0.032, 0.032, 0.4, BLK, [0, 0.145, -0.1], 10, M);
  cyl(g, 0.052, 0.034, 0.1, BLK, [0, 0.145, -0.36], 10, M);
  cyl(g, 0.043, 0.043, 0.006, C.lens, [0, 0.145, -0.412], 10, { emissive: C.lens, emissiveIntensity: 0.5 });
  cyl(g, 0.032, 0.044, 0.07, BLK, [0, 0.145, 0.13], 10, M);
  box(g, [0.03, 0.04, 0.03], STL, [0, 0.1, -0.22]);
  box(g, [0.03, 0.04, 0.03], STL, [0, 0.1, 0.0]);
  // bipod (katlanmış) + dipçik
  box(g, [0.012, 0.012, 0.3], STL, [-0.05, -0.05, -0.62], [0.05, 0, 0]);
  box(g, [0.012, 0.012, 0.3], STL, [0.05, -0.05, -0.62], [0.05, 0, 0]);
  taperBox(g, [0.06, 0.125, 0.32], T, [0, 0.0, 0.3], [0.08, 0, 0], [1, 1], [1, 1]);
  box(g, [0.062, 0.14, 0.02], BLK, [0, -0.02, 0.47], [0.08, 0, 0]);
  return finish(g, { name: 'Barrett .50', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.06], gripL: [0, -0.05, -0.5], muzzle: [0, 0.05, -1.13], length: 1.65 });
}

// ───────────────────────── PKM ─────────────────────────
function pkm() {
  const g = new THREE.Group();
  box(g, [0.07, 0.09, 0.4], BLK, [0, 0.02, -0.12], null, M);
  box(g, [0.06, 0.03, 0.22], C.gun, [0, 0.085, -0.1], null, M);                  // besleme kapağı
  box(g, [0.03, 0.012, 0.4], BLK, [0, 0.106, -0.1]);
  cyl(g, 0.014, 0.014, 0.45, STL, [0, 0.03, -0.62], 8, M);                       // namlu
  cyl(g, 0.009, 0.009, 0.36, STL, [0, 0.08, -0.6], 6, M);                        // gaz borusu
  cyl(g, 0.02, 0.02, 0.07, BLK, [0, 0.03, -0.88], 8, M);                         // alev kırıcı
  box(g, [0.012, 0.07, 0.012], STL, [0, 0.085, -0.5]);                           // taşıma sapı
  box(g, [0.012, 0.012, 0.1], STL, [0, 0.12, -0.5]);
  box(g, [0.014, 0.05, 0.02], STL, [0, 0.05, -0.84]);                            // ön kule
  const mg = magGroup(g);
  box(mg, [0.1, 0.12, 0.16], C.oliveDark, [0, -0.115, -0.12]);                   // fişek kutusu
  box(mg, [0.104, 0.02, 0.164], BLK, [0, -0.06, -0.12]);
  for (let i = 0; i < 6; i++) box(mg, [0.06, 0.016, 0.012], C.brass, [0, -0.03, -0.19 + i * 0.022], null, M);
  box(g, [0.012, 0.14, 0.012], STL, [-0.04, -0.06, -0.62], [0, 0, -0.25], M);     // bipod
  box(g, [0.012, 0.14, 0.012], STL, [0.04, -0.06, -0.62], [0, 0, 0.25], M);
  box(g, [0.045, 0.11, 0.055], BLK, [0, -0.07, 0.06], [0.3, 0, 0]);
  box(g, [0.012, 0.012, 0.1], STL, [0, -0.052, -0.02]);
  taperBox(g, [0.058, 0.13, 0.3], C.wood, [0, -0.0, 0.27], [0.08, 0, 0], [1, 1], [1, 1]);
  box(g, [0.062, 0.14, 0.016], BLK, [0, -0.02, 0.43], [0.08, 0, 0]);
  return finish(g, { name: 'PKM', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.06], gripL: [0, -0.01, -0.42], muzzle: [0, 0.03, -0.93], length: 1.38 });
}

// ───────────────────────── M79 bomba atar ─────────────────────────
function m79() {
  const g = new THREE.Group();
  cyl(g, 0.026, 0.026, 0.4, STL, [0, 0.045, -0.24], 10, M);                      // kalın namlu
  cyl(g, 0.03, 0.03, 0.025, BLK, [0, 0.045, -0.45], 10, M);                      // namlu ağzı halkası
  box(g, [0.052, 0.075, 0.1], STL, [0, 0.02, 0.0], null, M);                     // kırılma gövdesi
  box(g, [0.062, 0.045, 0.13], C.wood, [0, -0.005, -0.21]);                      // ön kundak
  box(g, [0.012, 0.012, 0.08], STL, [0, -0.04, 0.0]);
  box(g, [0.012, 0.014, 0.02], STL, [0, 0.075, 0.035]);                          // arka nişangah kulesi
  box(g, [0.006, 0.02, 0.008], STL, [0, 0.085, -0.43]);                          // arpacık
  box(g, [0.04, 0.09, 0.05], C.wood, [0, -0.055, 0.05], [0.3, 0, 0]);
  taperBox(g, [0.05, 0.11, 0.3], C.wood, [0, -0.012, 0.22], [0.12, 0, 0], [1, 1], [1, 1]);
  box(g, [0.054, 0.12, 0.014], BLK, [0, -0.035, 0.38], [0.12, 0, 0]);
  return finish(g, { name: 'M79', hold: 'rifle', gripR: [0, -0.03, 0.05], gripL: [0, -0.03, -0.2], muzzle: [0, 0.045, -0.47], length: 0.86 });
}

// ───────────────────────── Gadgetlar ─────────────────────────
function leverGrenade(g, bodyColor, bandColor) {
  cylY(g, 0.032, 0.032, 0.1, bodyColor, [0, 0, 0], 10);
  cylY(g, 0.0335, 0.0335, 0.03, bandColor, [0, 0.01, 0], 10);
  cylY(g, 0.018, 0.018, 0.025, C.steel, [0, 0.062, 0], 8, null, M);
  box(g, [0.014, 0.012, 0.075], C.steel, [0, 0.07, 0.03], null, M);
  box(g, [0.014, 0.075, 0.012], C.steel, [0, 0.03, 0.045], null, M);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 4, 8), new THREE.MeshStandardMaterial({ color: C.chrome, flatShading: true, metalness: 0.5 }));
  ring.position.set(0.02, 0.075, 0.0);
  ring.rotation.y = Math.PI / 2;
  g.add(ring);
}
function smoke() {
  const g = new THREE.Group();
  leverGrenade(g, '#8f959c', '#e6e8ea');
  return finish(g, { name: 'Dumanlı Bomba', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.1 });
}
function flash() {
  const g = new THREE.Group();
  leverGrenade(g, '#3b3f46', C.yellow);
  return finish(g, { name: 'Flaşbang', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.1 });
}
function claymore() {
  const g = new THREE.Group();
  taperBox(g, [0.22, 0.1, 0.035], C.olive, [0, 0, -0.01], null, [1, 1], [1, 1]);   // eğri plaka
  box(g, [0.2, 0.08, 0.012], C.oliveDark, [0, 0, -0.03]);                          // ön yüz (düşmana)
  box(g, [0.14, 0.02, 0.014], C.yellow, [0, 0.0, -0.038]);
  for (const sx of [-1, 1]) box(g, [0.012, 0.07, 0.012], STL, [sx * 0.09, -0.07, 0.01], [0.3, 0, 0]);   // ayaklar
  box(g, [0.03, 0.02, 0.03], BLK, [0, 0.055, 0.0]);                               // tetik kapağı
  box(g, [0.01, 0.014, 0.06], C.red, [0.03, 0.055, 0.04]);                         // kablo
  return finish(g, { name: 'Claymore', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.22 });
}
function ammobox() {
  const g = new THREE.Group();
  const it = createItem('ammoBox');
  it.position.set(0, -0.09, 0);
  it.scale.setScalar(1.0);
  g.add(it);
  return finish(g, { name: 'Cephane Kutusu', hold: 'grenade', gripR: [0, 0.0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.3 });
}

// ───────────────────────── Yakın dövüş ─────────────────────────
function machete() {
  const g = new THREE.Group(), CH = { metalness: 0.6, roughness: 0.35 };
  taperBox(g, [0.008, 0.06, 0.34], C.chrome, [0, 0.0, -0.25], null, [1, 1], [1, 1], CH).rotation.z = 0;
  box(g, [0.008, 0.055, 0.1], C.chrome, [0, -0.0, -0.46], null, CH);
  box(g, [0.008, 0.04, 0.06], C.chrome, [0, -0.012, -0.53], [0.4, 0, 0], CH);     // eğimli uç
  box(g, [0.012, 0.012, 0.52], BLK, [0, 0.03, -0.3]);                              // sırt
  box(g, [0.014, 0.045, 0.016], STL, [0, 0.0, -0.065], null, M);                   // siper
  box(g, [0.028, 0.036, 0.13], BLK, [0, 0.0, 0.0]);                                // sap
  for (let i = 0; i < 3; i++) box(g, [0.03, 0.038, 0.008], STL, [0, 0, -0.025 + i * 0.03]);
  box(g, [0.03, 0.042, 0.02], STL, [0, 0.0, 0.07], null, M);
  return finish(g, { name: 'Satır', hold: 'melee', gripR: [0, 0, 0.0], gripL: null, muzzle: [0, 0, -0.55], length: 0.68 });
}
function tomahawk() {
  const g = new THREE.Group(), CH = { metalness: 0.6, roughness: 0.35 };
  box(g, [0.026, 0.028, 0.46], C.wood, [0, 0, -0.14]);                             // sap
  box(g, [0.03, 0.034, 0.05], BLK, [0, 0, 0.1]);                                   // uç tutacağı
  taperBox(g, [0.014, 0.1, 0.12], STL, [0, -0.03, -0.34], null, [1, 1], [1, 1.5], M);   // balta başı (kesici ağız aşağıda)
  box(g, [0.006, 0.014, 0.17], C.chrome, [0, -0.082, -0.34], null, CH);            // ağız
  box(g, [0.018, 0.03, 0.05], STL, [0, 0.03, -0.31], null, M);                     // arka çıkıntı
  box(g, [0.014, 0.016, 0.07], BLK, [0, 0.03, -0.275]);
  return finish(g, { name: 'Tomahawk', hold: 'melee', gripR: [0, 0, 0.02], gripL: null, muzzle: [0, -0.06, -0.36], length: 0.56 });
}

export const MORE = {
  scarh, aug, g36, ak74u, vector, p90, mac10, aa12, dbl, deagle, revolver, m1911, svd, barrett, pkm, m79,
  smoke, flash, claymore, ammobox, machete, tomahawk,
};
