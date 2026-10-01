import * as THREE from 'three';
import { box, taperBox, cyl, cylY, ico, V, mergeStatic } from '../core/geo.js';
import { C } from '../core/palette.js';

// Her silah: origin = tabanca kabzası (sağ el), namlu -Z yönünde.
// userData: name, hold (rifle|pistol|launcher|melee|grenade), gripR, gripL, muzzle, length
const M = { metalness: 0.15, roughness: 0.6 }; // metal parçalar için

function finish(g, meta) {
  g.userData = {
    ...meta,
    gripR: V(...meta.gripR),
    gripL: meta.gripL ? V(...meta.gripL) : null,
    muzzle: V(...meta.muzzle),
  };
  return g;
}

function railTicks(g, z0, z1, y, n, color = C.black) {
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / (n - 1);
    box(g, [0.026, 0.008, 0.012], color, [0, y, z]);
  }
}

// ───────────────────────── AK-47 ─────────────────────────
function ak47() {
  const g = new THREE.Group();
  box(g, [0.05, 0.075, 0.3], C.gun, [0, 0.02, -0.11], null, M);                // alt gövde
  taperBox(g, [0.044, 0.026, 0.3], C.gunLight, [0, 0.077, -0.11], null, [0.85, 1], [1, 1], M); // üst kapak
  box(g, [0.012, 0.012, 0.1], C.steel, [0, -0.045, -0.04]);                    // tetik koruması
  box(g, [0.012, 0.035, 0.012], C.steel, [0, -0.03, -0.09]);
  box(g, [0.012, 0.035, 0.012], C.steel, [0, -0.03, 0.005]);
  box(g, [0.042, 0.115, 0.052], '#3a281a', [0, -0.075, 0.05], [0.32, 0, 0]);   // kabza
  // kavisli şarjör
  box(g, [0.04, 0.11, 0.075], C.steel, [0, -0.075, -0.13], [0.12, 0, 0], M);
  box(g, [0.04, 0.1, 0.075], C.steel, [0, -0.165, -0.155], [0.36, 0, 0], M);
  box(g, [0.04, 0.09, 0.07], C.steel, [0, -0.25, -0.2], [0.62, 0, 0], M);
  // ahşap tutamaçlar
  box(g, [0.06, 0.05, 0.2], C.wood, [0, -0.002, -0.35]);
  taperBox(g, [0.052, 0.03, 0.2], C.wood, [0, 0.04, -0.35], null, [0.9, 1]);
  cyl(g, 0.011, 0.011, 0.26, C.steel, [0, 0.06, -0.37], 6, M);                 // gaz borusu
  cyl(g, 0.011, 0.011, 0.24, C.steel, [0, 0.015, -0.56], 8, M);                // namlu
  box(g, [0.018, 0.05, 0.022], C.steel, [0, 0.045, -0.66]);                    // arpacık kulesi
  box(g, [0.006, 0.03, 0.006], C.steel, [0, 0.085, -0.66]);
  cyl(g, 0.015, 0.015, 0.05, C.black, [0, 0.015, -0.7], 8, M);                 // namlu ucu
  box(g, [0.028, 0.016, 0.05], C.steel, [0, 0.096, -0.21]);                    // arka gez
  // ahşap dipçik
  taperBox(g, [0.046, 0.115, 0.3], C.wood, [0, -0.015, 0.24], [0.1, 0, 0], [1, 1], [1, 1]);
  box(g, [0.05, 0.12, 0.014], C.black, [0, -0.03, 0.4], [0.1, 0, 0]);
  return finish(g, {
    name: 'AK-47', hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.35], muzzle: [0, 0.015, -0.74], length: 1.14,
  });
}

// ───────────────────────── M4A1 ─────────────────────────
function m4a1() {
  const g = new THREE.Group();
  box(g, [0.046, 0.07, 0.17], C.black, [0, 0, -0.07], null, M);                // alt gövde
  box(g, [0.05, 0.055, 0.27], C.gun, [0, 0.062, -0.13], null, M);              // üst gövde
  box(g, [0.01, 0.012, 0.04], C.steel, [0.03, 0.05, -0.2]);                    // fişek atım kapağı
  // tutamaç + ray
  box(g, [0.06, 0.06, 0.27], C.gunLight, [0, 0.05, -0.39], null, M);
  box(g, [0.02, 0.01, 0.27], C.black, [0, 0.085, -0.39]);
  railTicks(g, -0.27, -0.52, 0.092, 9);
  cyl(g, 0.01, 0.01, 0.12, C.steel, [0, 0.05, -0.59], 8, M);
  cyl(g, 0.016, 0.016, 0.065, C.black, [0, 0.05, -0.66], 8, M);                // alev gizleyici
  box(g, [0.014, 0.04, 0.016], C.steel, [0, 0.105, -0.55]);                    // arpacık
  // kırmızı nokta nişangah
  box(g, [0.04, 0.012, 0.075], C.black, [0, 0.1, -0.14]);
  box(g, [0.04, 0.05, 0.012], C.black, [0, 0.13, -0.105]);
  box(g, [0.036, 0.036, 0.008], C.lens, [0, 0.135, -0.172], null, { emissive: C.lens, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 });
  // şarjör, kabza, ön kabza
  box(g, [0.038, 0.16, 0.062], C.steel, [0, -0.105, -0.115], [0.1, 0, 0], M);
  box(g, [0.042, 0.105, 0.05], C.black, [0, -0.075, 0.04], [0.3, 0, 0]);
  box(g, [0.03, 0.09, 0.036], C.black, [0, -0.04, -0.4], [-0.12, 0, 0]);
  // teleskopik dipçik
  cyl(g, 0.019, 0.019, 0.2, C.black, [0, 0.03, 0.17], 8, M);
  taperBox(g, [0.046, 0.11, 0.16], C.gun, [0, 0.0, 0.26], [0.08, 0, 0], [1, 1], [1, 1], M);
  box(g, [0.05, 0.11, 0.014], C.black, [0, -0.005, 0.345], [0.08, 0, 0]);
  return finish(g, {
    name: 'M4A1', hold: 'rifle', gripR: [0, -0.03, 0.04], gripL: [0, -0.035, -0.4], muzzle: [0, 0.05, -0.7], length: 1.0,
  });
}

// ───────────────────────── MP5 (hafif makineli) ─────────────────────────
function mp5() {
  const g = new THREE.Group();
  box(g, [0.05, 0.075, 0.26], C.gun, [0, 0.02, -0.1], null, M);
  box(g, [0.062, 0.06, 0.17], C.black, [0, 0.005, -0.32]);                     // tutamaç
  cyl(g, 0.016, 0.016, 0.07, C.steel, [0, 0.025, -0.44], 8, M);                // namlu manşonu
  cyl(g, 0.01, 0.01, 0.05, C.steel, [0, 0.025, -0.49], 8, M);
  box(g, [0.012, 0.035, 0.016], C.steel, [0, 0.075, -0.45]);                   // arpacık
  box(g, [0.03, 0.03, 0.03], C.steel, [0, 0.07, -0.01]);                       // arka gez
  box(g, [0.04, 0.04, 0.05], C.black, [0, 0.0, -0.01]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, -0.045, -0.04]);
  box(g, [0.04, 0.105, 0.05], C.black, [0, -0.07, 0.045], [0.3, 0, 0]);
  // kavisli şarjör
  box(g, [0.034, 0.1, 0.05], C.steel, [0, -0.06, -0.12], [0.1, 0, 0], M);
  box(g, [0.034, 0.1, 0.05], C.steel, [0, -0.155, -0.14], [0.3, 0, 0], M);
  box(g, [0.034, 0.08, 0.05], C.steel, [0, -0.23, -0.175], [0.55, 0, 0], M);
  // tel dipçik
  box(g, [0.014, 0.014, 0.28], C.steel, [0, 0.03, 0.24], null, M);
  box(g, [0.014, 0.014, 0.28], C.steel, [0, -0.04, 0.24], [0.15, 0, 0], M);
  box(g, [0.012, 0.09, 0.012], C.steel, [0, -0.005, 0.38], null, M);
  box(g, [0.048, 0.1, 0.02], C.black, [0, -0.01, 0.395]);
  return finish(g, {
    name: 'MP5', hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.02, -0.32], muzzle: [0, 0.025, -0.53], length: 0.92,
  });
}

// ───────────────────────── Tabanca ─────────────────────────
function pistol() {
  const g = new THREE.Group();
  box(g, [0.034, 0.042, 0.19], C.gun, [0, 0.05, -0.06], null, M);               // sürgü
  box(g, [0.03, 0.02, 0.17], C.black, [0, 0.015, -0.055]);                      // çerçeve
  box(g, [0.036, 0.1, 0.055], C.black, [0, -0.04, 0.02], [0.2, 0, 0]);           // kabza
  box(g, [0.01, 0.012, 0.07], C.black, [0, -0.012, -0.04]);                      // tetik koruması
  box(g, [0.01, 0.03, 0.01], C.black, [0, -0.005, -0.075]);
  cyl(g, 0.009, 0.009, 0.03, C.steel, [0, 0.05, -0.165], 8, M);
  box(g, [0.01, 0.012, 0.014], C.steel, [0, 0.078, -0.14]);
  box(g, [0.018, 0.012, 0.014], C.steel, [0, 0.078, 0.025]);
  for (let i = 0; i < 4; i++) box(g, [0.036, 0.03, 0.005], C.black, [0, 0.055, 0.025 + i * 0.012]); // sürgü tırtılı
  return finish(g, {
    name: 'Glock 17', hold: 'pistol', gripR: [0, -0.03, 0.02], gripL: null, muzzle: [0, 0.05, -0.18], length: 0.28,
  });
}

// ───────────────────────── Pompalı ─────────────────────────
function shotgun() {
  const g = new THREE.Group();
  box(g, [0.052, 0.075, 0.2], C.steel, [0, 0.02, -0.05], null, M);
  cyl(g, 0.016, 0.016, 0.52, C.gun, [0, 0.04, -0.4], 8, M);                      // namlu
  cyl(g, 0.014, 0.014, 0.48, C.gun, [0, -0.0, -0.38], 8, M);                     // şarjör tüpü
  cyl(g, 0.018, 0.018, 0.02, C.steel, [0, -0.0, -0.63], 8, M);
  box(g, [0.008, 0.016, 0.008], C.brass, [0, 0.068, -0.65]);                     // arpacık
  box(g, [0.062, 0.05, 0.17], C.woodDark, [0, -0.01, -0.3]);                    // pompa
  for (let i = 0; i < 3; i++) box(g, [0.066, 0.052, 0.01], C.black, [0, -0.01, -0.36 + i * 0.05]);
  box(g, [0.012, 0.012, 0.09], C.steel, [0, -0.047, -0.01]);
  box(g, [0.04, 0.07, 0.05], C.woodDark, [0, -0.06, 0.05], [0.3, 0, 0]);
  taperBox(g, [0.05, 0.11, 0.34], C.wood, [0, -0.01, 0.23], [0.14, 0, 0], [1, 1], [1, 1]);
  box(g, [0.054, 0.12, 0.014], C.black, [0, -0.035, 0.4], [0.14, 0, 0]);
  // fişek tutucu
  for (let i = 0; i < 3; i++) cylY(g, 0.009, 0.009, 0.045, C.red, [0.032, 0.0, 0.0 + i * 0.022], 6, [0, 0, Math.PI / 2]);
  return finish(g, {
    name: 'Pompalı', hold: 'rifle', gripR: [0, -0.03, 0.05], gripL: [0, -0.03, -0.3], muzzle: [0, 0.04, -0.66], length: 1.05,
  });
}

// ───────────────────────── Keskin Nişancı (M24) ─────────────────────────
function sniper() {
  const g = new THREE.Group();
  const stock = C.oliveDark;
  taperBox(g, [0.056, 0.085, 0.44], stock, [0, -0.01, -0.3], null, [0.9, 1], [1, 1]);   // ön kundak
  box(g, [0.05, 0.075, 0.22], stock, [0, 0.0, -0.06]);                                  // gövde bloğu
  cyl(g, 0.025, 0.025, 0.25, C.gun, [0, 0.055, -0.09], 8, M);                           // alıcı
  cyl(g, 0.014, 0.017, 0.5, C.steel, [0, 0.055, -0.6], 8, M);                           // ağır namlu
  cyl(g, 0.02, 0.02, 0.07, C.black, [0, 0.055, -0.88], 8, M);                           // namlu freni
  box(g, [0.056, 0.08, 0.05], stock, [0, 0.0, 0.0]);
  box(g, [0.04, 0.1, 0.05], stock, [0, -0.07, 0.04], [0.3, 0, 0]);                      // kabza
  box(g, [0.056, 0.125, 0.3], stock, [0, -0.01, 0.22], [0.08, 0, 0]);                   // dipçik
  box(g, [0.04, 0.045, 0.17], C.olive, [0, 0.075, 0.22], [0.08, 0, 0]);                 // yanak desteği
  box(g, [0.06, 0.13, 0.016], C.black, [0, -0.02, 0.38], [0.08, 0, 0]);
  // dürbün
  cyl(g, 0.03, 0.03, 0.34, C.black, [0, 0.14, -0.08], 10, M);
  cyl(g, 0.045, 0.03, 0.09, C.black, [0, 0.14, -0.3], 10, M);                           // objektif
  cyl(g, 0.036, 0.036, 0.006, C.lens, [0, 0.14, -0.347], 10, { emissive: C.lens, emissiveIntensity: 0.5 });
  cyl(g, 0.03, 0.04, 0.07, C.black, [0, 0.14, 0.12], 10, M);                            // göz tarafı
  cylY(g, 0.011, 0.011, 0.03, C.gunLight, [0, 0.185, -0.05], 6);
  cylY(g, 0.011, 0.011, 0.03, C.gunLight, [0.04, 0.14, -0.05], 6, [0, 0, Math.PI / 2]);
  box(g, [0.03, 0.045, 0.03], C.steel, [0, 0.095, -0.17]);
  box(g, [0.03, 0.045, 0.03], C.steel, [0, 0.095, 0.0]);
  // sürgü kolu
  cylY(g, 0.006, 0.006, 0.07, C.steel, [0.05, 0.05, -0.0], 6, [0, 0, Math.PI / 2.4]);
  ico(g, 0.014, C.black, [0.083, 0.035, 0.0], 0);
  // bipod (katlanmış)
  box(g, [0.01, 0.01, 0.2], C.steel, [-0.02, -0.065, -0.38], [0.05, 0, 0]);
  box(g, [0.01, 0.01, 0.2], C.steel, [0.02, -0.065, -0.38], [0.05, 0, 0]);
  box(g, [0.05, 0.03, 0.04], C.steel, [0, -0.055, -0.3]);
  box(g, [0.034, 0.05, 0.06], C.steel, [0, -0.06, -0.06], [0.1, 0, 0]);                   // şarjör
  return finish(g, {
    name: 'M24 Keskin', hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.36], muzzle: [0, 0.055, -0.92], length: 1.3,
  });
}

// ───────────────────────── Hafif Makineli (M249) ─────────────────────────
function lmg() {
  const g = new THREE.Group();
  box(g, [0.07, 0.095, 0.4], C.gun, [0, 0.02, -0.15], null, M);                         // gövde
  box(g, [0.06, 0.03, 0.2], C.black, [0, 0.085, -0.1]);                                 // besleme kapağı
  box(g, [0.035, 0.012, 0.3], C.black, [0, 0.105, -0.17]);                              // ray
  // fişek kutusu + kemer
  box(g, [0.1, 0.12, 0.16], C.olive, [0, -0.115, -0.13]);
  box(g, [0.104, 0.02, 0.164], C.oliveDark, [0, -0.06, -0.13]);
  for (let i = 0; i < 6; i++) box(g, [0.06, 0.016, 0.012], C.brass, [0.0, -0.03, -0.2 + i * 0.022], [0, 0, 0], M);
  box(g, [0.05, 0.05, 0.02], C.brass, [0, -0.01, -0.11], null, M);
  // namlu & ısı kalkanı
  box(g, [0.07, 0.06, 0.2], C.black, [0, 0.025, -0.45]);
  cyl(g, 0.016, 0.016, 0.28, C.steel, [0, 0.028, -0.65], 8, M);
  cyl(g, 0.022, 0.022, 0.07, C.black, [0, 0.028, -0.8], 8, M);
  // taşıma sapı
  box(g, [0.012, 0.07, 0.012], C.steel, [0, 0.085, -0.58]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, 0.12, -0.58]);
  // bipod
  box(g, [0.08, 0.02, 0.03], C.steel, [0, -0.012, -0.62]);
  box(g, [0.012, 0.14, 0.012], C.steel, [-0.045, -0.075, -0.65], [0.0, 0, -0.25]);
  box(g, [0.012, 0.14, 0.012], C.steel, [0.045, -0.075, -0.65], [0.0, 0, 0.25]);
  box(g, [0.045, 0.11, 0.055], C.black, [0, -0.07, 0.06], [0.3, 0, 0]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, -0.052, -0.02]);
  box(g, [0.06, 0.13, 0.3], C.black, [0, -0.0, 0.27], [0.08, 0, 0]);
  box(g, [0.064, 0.14, 0.016], C.steel, [0, -0.02, 0.43], [0.08, 0, 0]);
  return finish(g, {
    name: 'M249 LMG', hold: 'rifle', gripR: [0, -0.03, 0.06], gripL: [0, -0.01, -0.45], muzzle: [0, 0.028, -0.84], length: 1.28,
  });
}

// ───────────────────────── RPG-7 ─────────────────────────
function rpg() {
  const g = new THREE.Group();
  cyl(g, 0.03, 0.03, 0.95, C.olive, [0, 0.05, 0.05], 10, M);                      // tüp
  cyl(g, 0.036, 0.036, 0.3, C.wood, [0, 0.05, -0.12], 10);                         // ahşap koruma
  cyl(g, 0.03, 0.06, 0.14, C.oliveDark, [0, 0.05, 0.57], 10, M);                  // arka huni
  // mühimmat başlığı
  cyl(g, 0.012, 0.05, 0.14, C.olive, [0, 0.05, -0.6], 10, M);                     // koni burun
  cyl(g, 0.05, 0.05, 0.1, C.oliveDark, [0, 0.05, -0.48], 10, M);                  // gövde
  cyl(g, 0.034, 0.034, 0.06, C.oliveDark, [0, 0.05, -0.41], 10, M);
  box(g, [0.04, 0.115, 0.05], C.black, [0, -0.04, 0.04], [0.3, 0, 0]);             // kabza
  box(g, [0.012, 0.012, 0.09], C.steel, [0, -0.012, -0.01]);                       // tetik koruması
  box(g, [0.04, 0.09, 0.04], C.black, [0, -0.025, -0.2], [-0.1, 0, 0]);            // ön kabza
  box(g, [0.02, 0.05, 0.06], C.steel, [-0.045, 0.1, -0.05]);                       // nişangah
  box(g, [0.03, 0.01, 0.01], C.steel, [-0.06, 0.13, -0.05]);
  return finish(g, {
    name: 'RPG-7', hold: 'launcher', gripR: [0, -0.03, 0.04], gripL: [0, -0.03, -0.2], muzzle: [0, 0.05, -0.68], length: 1.3,
  });
}

// ───────────────────────── Bıçak ─────────────────────────
function knife() {
  const g = new THREE.Group();
  box(g, [0.01, 0.035, 0.16], C.chrome, [0, 0.0, -0.14], null, { metalness: 0.6, roughness: 0.35 });
  box(g, [0.01, 0.026, 0.026], C.chrome, [0, -0.004, -0.235], [Math.PI / 4, 0, 0], { metalness: 0.6, roughness: 0.35 });
  box(g, [0.012, 0.01, 0.15], C.black, [0, 0.016, -0.14]);                         // sırt
  box(g, [0.03, 0.05, 0.014], C.steel, [0, 0.0, -0.055], null, M);                 // siper
  box(g, [0.026, 0.034, 0.11], C.black, [0, 0.0, 0.0]);                            // sap
  for (let i = 0; i < 4; i++) box(g, [0.03, 0.036, 0.008], C.steel, [0, 0, -0.03 + i * 0.026]);
  box(g, [0.03, 0.04, 0.02], C.steel, [0, 0.0, 0.065], null, M);
  return finish(g, {
    name: 'Bıçak', hold: 'melee', gripR: [0, 0, 0.0], gripL: null, muzzle: [0, 0, -0.25], length: 0.34,
  });
}

// ───────────────────────── El Bombası ─────────────────────────
function grenade() {
  const g = new THREE.Group();
  ico(g, 0.04, C.olive, [0, 0, 0], 1, [1, 1.25, 1]);
  cylY(g, 0.018, 0.018, 0.025, C.steel, [0, 0.062, 0], 8, null, M);
  box(g, [0.014, 0.012, 0.075], C.steel, [0, 0.07, 0.03], null, M);                  // kol
  box(g, [0.014, 0.075, 0.012], C.steel, [0, 0.03, 0.045], [0.0, 0, 0], M);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 4, 8), new THREE.MeshStandardMaterial({ color: C.chrome, flatShading: true, metalness: 0.5 }));
  ring.position.set(0.02, 0.075, 0.0);
  ring.rotation.y = Math.PI / 2;
  g.add(ring);
  return finish(g, {
    name: 'El Bombası', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.1,
  });
}

export const WEAPONS = {
  ak47, m4a1, mp5, pistol, shotgun, sniper, lmg, rpg, knife, grenade,
};

export const WEAPON_INFO = {
  ak47: 'Tüfek · Yüksek hasar',
  m4a1: 'Tüfek · Dengeli',
  mp5: 'SMG · Hızlı atış',
  pistol: 'Yan silah',
  shotgun: 'Pompalı · Yakın mesafe',
  sniper: 'Keskin nişancı · Tek atış',
  lmg: 'LMG · Bastırma ateşi',
  rpg: 'Roketatar · Patlayıcı',
  knife: 'Yakın dövüş',
  grenade: 'Atılabilir · Patlayıcı',
};

export function createWeapon(id) {
  const fn = WEAPONS[id];
  if (!fn) throw new Error('Bilinmeyen silah: ' + id);
  const g = fn();
  g.userData.id = id;
  mergeStatic(g);
  return g;
}
