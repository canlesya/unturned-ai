import * as THREE from 'three';
import { box, taperBox, cyl, cylY, ico, V, mergeStatic, mergeVC } from '../core/geo.js';
import { C } from '../core/palette.js';
import { mat } from '../core/geo.js';
import { resolveOptic, WSTATS } from '../game/stats.js';
import { M, finish, railTicks, magGroup, frontSight, magRibs, studs, gripTexture, sling, vents } from './weapon_util.js';
import { MORE, MOUNT_MORE } from './weapons_more.js';
import { finishWeapon } from './weaponFinish.js';
import { PAINTBALL, MOUNT_PB } from './paintball.js';

// Her silah: origin = tabanca kabzası (sağ el), namlu -Z yönünde.
// userData: name, hold (rifle|pistol|launcher|melee|grenade), gripR, gripL, muzzle, length, mag (şarjör grubu), bolt
// ─────────────── Nişangâhlar ───────────────
// Hepsi (g, x, yBase, z, s) alır; yBase = monte edildiği yüzeyin üstü. Pencere merkezi yüksekliğini (y) döndürür.
const BLK = C.black;
const GLASS = { transparent: true, opacity: 0.13, roughness: 0.08, depthWrite: false, metalness: 0.3 };

function ring(g, R, r, color, pos, seg = 14) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 5, seg), mat(color));
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

// Kompakt red dot: tüp şeklinde halka, yuvarlak cam
function opticRedDot(g, x, yb, z, s = 1) {
  const R = 0.0175 * s, r = 0.0026 * s, cy = yb + 0.012 * s + R + r;
  box(g, [0.03 * s, 0.012 * s, 0.05 * s], BLK, [x, yb + 0.006 * s, z]);                       // taban
  box(g, [0.012 * s, 0.014 * s, 0.032 * s], BLK, [x, yb + 0.017 * s, z]);                     // halka altı destek
  for (const dz of [-0.012, 0, 0.012]) ring(g, R + (dz === 0 ? 0 : 0.0008 * s), r, dz === 0 ? '#2b2d31' : BLK, [x, cy, z + dz * s]);
  cyl(g, R, R, 0.002 * s, '#a8d8ff', [x, cy, z - 0.014 * s], 14, GLASS);                      // cam
  box(g, [0.004 * s, R * 1.5, 0.002 * s], '#ffffff', [x + R * 0.35, cy + R * 0.2, z - 0.0145 * s], [0, 0, 0.6], { transparent: true, opacity: 0.16, depthWrite: false }); // yansıma çizgisi
  box(g, [0.008 * s, 0.006 * s, 0.01 * s], '#2b2d31', [x, cy + R + r + 0.003 * s, z]);        // ayar topuzu
  return cy;
}

// Holografik (EOTech/PUBG tarzı): geniş dikdörtgen siyah gövde, büyük pencere
function opticHolo(g, x, yb, z, s = 1) {
  const cy = yb + 0.026 * s;
  box(g, [0.052 * s, 0.007 * s, 0.078 * s], BLK, [x, yb + 0.0035 * s, z]);                    // taban
  for (const sx of [-1, 1]) {
    box(g, [0.004 * s, 0.04 * s, 0.07 * s], BLK, [x + sx * 0.0235 * s, yb + 0.027 * s, z]);   // ince yan duvarlar
    box(g, [0.0025 * s, 0.024 * s, 0.05 * s], '#3b3e44', [x + sx * 0.0255 * s, yb + 0.027 * s, z]); // yan vurgu
  }
  box(g, [0.053 * s, 0.005 * s, 0.07 * s], BLK, [x, yb + 0.0485 * s, z]);                     // tavan
  box(g, [0.042 * s, 0.0025 * s, 0.05 * s], '#3b3e44', [x, yb + 0.0525 * s, z]);              // tavan vurgusu
  box(g, [0.041 * s, 0.04 * s, 0.002 * s], '#a8d8ff', [x, cy + 0.001 * s, z - 0.02 * s], null, GLASS); // geniş cam
  box(g, [0.004 * s, 0.032 * s, 0.002 * s], '#ffffff', [x + 0.009 * s, cy + 0.003 * s, z - 0.0215 * s], [0, 0, 0.35], { transparent: true, opacity: 0.14, depthWrite: false });
  box(g, [0.05 * s, 0.01 * s, 0.01 * s], '#2b2d31', [x, yb + 0.005 * s, z + 0.04 * s]);       // arka ayak
  return cy;
}

// ACOG 3x: kısa dürbün; göz tarafı (arka uç) z + 0.07 m
function opticAcog(g, x, yb, z) {
  const cy = yb + 0.034;
  box(g, [0.034, 0.012, 0.09], BLK, [x, yb + 0.006, z]);
  box(g, [0.014, 0.012, 0.05], BLK, [x, yb + 0.018, z]);
  cyl(g, 0.0215, 0.019, 0.1, '#2a2c30', [x, cy, z], 12);                                          // gövde
  cyl(g, 0.026, 0.0215, 0.028, BLK, [x, cy, z - 0.062], 12);                                      // objektif
  cyl(g, 0.0235, 0.0235, 0.002, '#3fb7ff', [x, cy, z - 0.077], 12, { emissive: '#3fb7ff', emissiveIntensity: 0.5, transparent: true, opacity: 0.8 });
  cyl(g, 0.02, 0.025, 0.026, BLK, [x, cy, z + 0.062], 12);                                        // göz kapağı
  box(g, [0.01, 0.012, 0.06], '#2a2c30', [x, cy + 0.027, z - 0.005]);                             // taşıma kolu
  return cy;
}

// Demir nişan: arka peep (delikli) nişangâh. h = ön arpacık tepe yüksekliği = nişan çizgisi
function ironRear(g, x, yb, z, h, s = 1) {
  const bot = h - 0.014 * s;
  if (bot > yb) box(g, [0.02 * s, bot - yb, 0.012 * s], C.steel, [x, (yb + bot) / 2, z]);
  for (const sx of [-1, 1]) box(g, [0.005 * s, 0.022 * s, 0.012 * s], C.steel, [x + sx * 0.0095 * s, h - 0.001 * s, z]);
  box(g, [0.022 * s, 0.004 * s, 0.012 * s], C.steel, [x, h + 0.012 * s, z]);
}
function ironFront(g, x, z, base, h) {
  box(g, [0.006, h - base, 0.006], C.steel, [x, (base + h) / 2, z]);
  for (const sx of [-1, 1]) box(g, [0.004, 0.02, 0.01], C.steel, [x + sx * 0.011, h - 0.006, z]);   // koruyucu kulaklar
}

// Nişangâh gövde ölçekleri: nişan alırken rakibi örtmesin diye küçük tutulur (bkz. scripts/adsview.mjs)
const OPT_K = { dot: 0.68, holo: 0.72 };
const ADS_K = 1.3;              // nişan alırken göz-nişangâh mesafesi çarpanı: silah ve nişangâh ekranda daha küçük, rakip görünür

// Silaha göre montaj noktaları (z: nişangâh merkezi, y: üst yüzey, front: ön arpacık yüksekliği)
const MOUNT = {
  ...MOUNT_MORE, ...MOUNT_PB,
  // Unturned tarzı modeller (ring: red dot = halka nişangâh · ownRear: demir nişanda modelin kendi gezi): y = gövde üstü, front = arpacık tepesi = demir nişan çizgisi
  ak47: { z: -0.1, y: 0.097, front: 0.115, rearZ: 0.0, ownFront: true, ring: true },
  m4a1: { z: -0.14, y: 0.104, front: 0.125, rearZ: -0.03, ownFront: true, ring: true },
  mp5: { z: -0.08, y: 0.0575, front: 0.0925, rearZ: -0.01, ownFront: true },
  shotgun: { z: -0.03, y: 0.06, front: 0.076, rearZ: 0.02, ownFront: true, ring: true },
  lmg: { z: -0.1, y: 0.111, front: 0.126, rearZ: -0.12, frontZ: -0.62, frontBase: 0.055, lift: 0.01 },
  pistol: { z: -0.02, y: 0.072, front: 0.084, rearZ: 0.03, ownFront: true, ownRear: true, scale: 0.75, ring: true },
};

// Optik tabanı gövde üstüne oturmalı: nişangâh ayağının altında kalan en yüksek parçanın tepesini bul (en çok 3 cm yükseltir)
function mountY(g, m, z) {
  const bb = new THREE.Box3();
  let top = m.y;
  for (const n of g.children) {
    if (!n.isMesh) continue;
    bb.setFromObject(n);
    if (bb.max.z < z - 0.05 || bb.min.z > z + 0.05 || bb.min.x > 0.03 || bb.max.x < -0.03) continue;
    if (bb.max.y > top + 0.001 && bb.max.y < m.y + 0.03) top = bb.max.y;
  }
  return top;
}

// Optik (red dot / holo) takılıyken göz hattının önünde kalan KÜÇÜK ön parçaları (arpacık, kule artığı, boncuk) gizle.
// Işınlar gözden nişan noktasından geçip ~%2 eğimle açılır (≈ 6 mm yarıçaplı koridor).
function clearSightLine(g, sight, dist, first) {
  const [, sy, sz] = sight, ze = sz + dist, bb = new THREE.Box3(), sz3 = new THREE.Vector3(), rm = [];
  for (let i = 0; i < first; i++) {
    const n = g.children[i];
    if (!n.isMesh) continue;
    bb.setFromObject(n);
    if (bb.min.z > sz - 0.03) continue;                                // yalnızca nişangâhın önündekiler
    const w = 0.022 * (ze - bb.max.z);                                 // en yakın yüzde koridor yarı genişliği
    if (bb.min.x > w || bb.max.x < -w || bb.min.y > sy + w || bb.max.y < sy - w) continue;
    bb.getSize(sz3);
    if (sz3.x <= 0.035 && sz3.z <= 0.06 && sz3.y <= 0.09) rm.push(n);   // küçük parça: ön nişan kalıntısı
  }
  for (const n of rm) g.remove(n);                                      // birleştirme görünürlüğe bakmaz: parçayı tamamen çıkar
}

// Silaha seçilen nişangâhı ekler; ADS nişan noktası, uzaklık ve örtü türünü döndürür
function attachSight(g, id, optic) {
  const m0 = MOUNT[id];
  if (!m0) return null;
  const nBody = g.children.length;
  const m = optic === 'iron' ? m0 : { ...m0, y: mountY(g, m0, m0.z) + (m0.lift || 0) };      // lift: üst kapak/besleme tepsisi için ek yükseltme
  const sc = m.scale || 1;
  let cy, sz, dist, overlay = 'none';
  if (optic === 'iron') {
    if (!m.ownRear) ironRear(g, 0, m.y, m.rearZ, m.front, sc);
    if (!m.ownFront) ironFront(g, 0, m.frontZ, m.frontBase, m.front);
    cy = m.front; sz = m.rearZ; dist = 0.22;
  } else {
    if (optic === 'holo') { cy = opticHolo(g, 0, m.y, m.z, sc * OPT_K.holo); sz = m.z; dist = 0.3; overlay = 'holo'; }
    else if (optic === 'acog') { cy = opticAcog(g, 0, m.y, m.z); sz = m.z + 0.075; dist = 0.05; overlay = 'scope'; }
    else if (m.ring) { cy = ringSight(g, m.y, m.z, sc); sz = m.z; dist = 0.28; overlay = 'dot'; }     // Unturned tarzı halka (handlab4)
    else { cy = opticRedDot(g, 0, m.y, m.z, sc * OPT_K.dot); sz = m.z; dist = 0.28; overlay = 'dot'; }
  }
  if (optic !== 'iron') clearSightLine(g, [0, cy, sz], dist, nBody);
  return { sight: [0, cy, sz], dist: optic === 'acog' ? dist : dist * ADS_K, overlay };
}

// ─────────────── Unturned tarzı silahlar (handlab4 → oyun): iri blok parçalar, büyük düz yüzler, silah başına 2–3 düz renk, ince süs yok ───────────────
// finish() sözleşmesi aynı (gripR / gripL / muzzle / length / mag / magAxis / bolt / hold) → mermi çıkışı, üçüncü şahıs el noktaları değişmez. flat: cila (weaponFinish) uygulanmaz.
// Ek alt gruplar (birinci şahıs animasyonu): charge (kurma kolu, +Z) · pump (pompa) · slide (tabanca sürgüsü) · port (fişek yuvası). Red dot = kalın sekizgen halka (ringSight).
const U = { TAN: '#b9a884', GREY: '#4a4d52', DARK: '#2a2c30', BLACK: '#1b1c1f', OLIVE: '#5b6644', OLIVE2: '#3e4731', STEEL: '#8e949c', RED: '#d8322a', LENS: '#4fb3ff' };
const GLOW = { emissive: U.RED, emissiveIntensity: 1.6 };
function muzzleTip(g, p) { box(g, [0.012, 0.012, 0.014], U.RED, p, null, GLOW); }                                 // namlu ucu kırmızı vurgu
function chargeHandle(g, size, color, pos) { const c = new THREE.Group(); g.add(c); box(c, size, color, pos); g.userData.charge = c; return c; }   // kurma kolu alt grubu (+Z geri)
// halka nişangâh: kalın sekizgen halka + taban + kırmızı nokta; yb = oturduğu yüzeyin üstü → nişan merkezi yüksekliği
function ringSight(g, yb, z, s = 1) {
  const R = 0.025 * s, r = 0.005 * s, cy = yb + 0.012 * s + R + r;
  box(g, [0.03 * s, 0.012 * s, 0.05 * s], U.DARK, [0, yb + 0.006 * s, z]);
  const t = new THREE.Mesh(new THREE.TorusGeometry(R, r, 4, 8), mat(U.GREY)); t.position.set(0, cy, z); t.rotation.z = Math.PI / 8; g.add(t);
  box(g, [0.004 * s, 0.004 * s, 0.004 * s], U.RED, [0, cy, z - 0.004], null, GLOW);
  return cy;
}
function magLabel(mg, w, y, z, rx = 0) { box(mg, [w + 0.004, 0.03, 0.028], U.DARK, [0, y, z], [rx, 0, 0]); box(mg, [w + 0.006, 0.011, 0.02], U.RED, [0, y, z], [rx, 0, 0]); }   // şarjör etiketi

// ───────────────────────── AK-47: tan gövde + koyu metal + siyah kabza ─────────────────────────
function ak47() {
  const g = new THREE.Group(), { TAN, GREY, DARK, BLACK } = U;
  box(g, [0.056, 0.085, 0.32], TAN, [0, 0.025, -0.11]);                       // alıcı
  box(g, [0.05, 0.03, 0.3], GREY, [0, 0.082, -0.11]);                          // üst kapak
  box(g, [0.044, 0.11, 0.05], BLACK, [0, -0.07, 0.05], [0.32, 0, 0]);          // kabza
  box(g, [0.014, 0.012, 0.1], DARK, [0, -0.047, -0.04]);                       // tetik koruması
  box(g, [0.014, 0.036, 0.012], DARK, [0, -0.03, -0.09]);
  const mg = magGroup(g);                                                       // kavisli şarjör (2 blok)
  box(mg, [0.046, 0.13, 0.08], GREY, [0, -0.085, -0.14], [0.22, 0, 0]);
  box(mg, [0.046, 0.12, 0.076], GREY, [0, -0.2, -0.19], [0.5, 0, 0]);
  magLabel(mg, 0.046, -0.1, -0.145, 0.22);
  box(g, [0.062, 0.07, 0.22], TAN, [0, 0.01, -0.36]);                          // el kundağı
  box(g, [0.03, 0.03, 0.24], GREY, [0, 0.062, -0.36]);                         // gaz borusu
  box(g, [0.026, 0.026, 0.26], DARK, [0, 0.015, -0.6]);                        // namlu
  box(g, [0.036, 0.036, 0.06], BLACK, [0, 0.015, -0.71]);                      // namlu ucu
  muzzleTip(g, [0, 0.015, -0.74]);
  frontSight(g, [0.016, 0.087, 0.02], DARK, [0, 0.0715, -0.66]);              // arpacık (demir nişan çizgisi 0,115; optikte gizli)
  taperBox(g, [0.05, 0.11, 0.3], TAN, [0, -0.012, 0.24], [0.1, 0, 0], [1, 1], [1, 1]);   // dipçik
  box(g, [0.054, 0.12, 0.02], BLACK, [0, -0.028, 0.4], [0.1, 0, 0]);          // dipçik plakası
  chargeHandle(g, [0.022, 0.016, 0.04], DARK, [0.038, 0.05, -0.08]);           // kurma kolu (sağ yan)
  return finish(g, { name: 'AK-47', mag: mg, hold: 'rifle', flat: true, gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.35], muzzle: [0, 0.015, -0.74], length: 1.14 });
}
// ───────────────────────── M4A1: tan üst / kundak + siyah alt + koyu metal ─────────────────────────
function m4a1() {
  const g = new THREE.Group(), { TAN, GREY, DARK, BLACK } = U;
  box(g, [0.05, 0.075, 0.19], BLACK, [0, 0.0, -0.07]);                         // alt gövde
  box(g, [0.056, 0.06, 0.28], TAN, [0, 0.062, -0.13]);                         // üst gövde
  box(g, [0.024, 0.012, 0.26], DARK, [0, 0.098, -0.13]);                       // üst ray
  box(g, [0.066, 0.066, 0.26], TAN, [0, 0.05, -0.39]);                         // el kundağı
  box(g, [0.024, 0.012, 0.24], DARK, [0, 0.089, -0.39]);                       // kundak rayı
  box(g, [0.026, 0.026, 0.12], DARK, [0, 0.05, -0.59]);                        // namlu
  box(g, [0.036, 0.036, 0.07], BLACK, [0, 0.05, -0.66]);                       // alev gizleyici
  muzzleTip(g, [0, 0.05, -0.7]);
  frontSight(g, [0.016, 0.07, 0.018], DARK, [0, 0.09, -0.55]);                // ön kule (tepe 0,125)
  const mg = magGroup(g);
  box(mg, [0.042, 0.17, 0.066], GREY, [0, -0.105, -0.115], [0.1, 0, 0]);       // şarjör
  magLabel(mg, 0.042, -0.12, -0.117, 0.1);
  box(g, [0.044, 0.105, 0.05], BLACK, [0, -0.066, 0.012], [0.3, 0, 0]);        // kabza
  box(g, [0.014, 0.012, 0.09], DARK, [0, -0.045, -0.05]);                      // tetik koruması
  box(g, [0.04, 0.04, 0.26], BLACK, [0, 0.03, 0.14]);                          // tampon tüpü
  taperBox(g, [0.05, 0.1, 0.16], TAN, [0, 0.0, 0.26], [0.08, 0, 0], [1, 1], [1, 1]);   // dipçik
  box(g, [0.054, 0.11, 0.016], BLACK, [0, -0.005, 0.345], [0.08, 0, 0]);
  chargeHandle(g, [0.034, 0.018, 0.05], DARK, [0, 0.078, 0.03]);               // kurma kolu (arka üst)
  return finish(g, { name: 'M4A1', mag: mg, hold: 'rifle', flat: true, gripR: [0, -0.03, 0.04], gripL: [0, -0.035, -0.4], muzzle: [0, 0.05, -0.7], length: 1.0 });
}
// ───────────────────────── Pompalı: koyu metal + tan kundak / pompa + kırmızı fişek şeridi ─────────────────────────
function shotgun() {
  const g = new THREE.Group(), { TAN, GREY, DARK, BLACK, RED } = U;
  box(g, [0.056, 0.08, 0.2], GREY, [0, 0.02, -0.05]);                          // alıcı
  box(g, [0.032, 0.032, 0.5], DARK, [0, 0.04, -0.4]);                          // namlu
  box(g, [0.028, 0.028, 0.46], DARK, [0, -0.005, -0.38]);                      // şarjör tüpü
  box(g, [0.038, 0.038, 0.03], BLACK, [0, -0.005, -0.62]);                     // tüp kapağı
  frontSight(g, [0.01, 0.02, 0.01], '#d9b25a', [0, 0.066, -0.65]);            // boncuk (tepe 0,076)
  const pump = new THREE.Group(); g.add(pump); g.userData.pump = pump;
  box(pump, [0.068, 0.058, 0.17], TAN, [0, -0.01, -0.3]);                      // pompa
  box(g, [0.014, 0.012, 0.09], DARK, [0, -0.047, -0.01]);                      // tetik koruması
  box(g, [0.044, 0.07, 0.05], TAN, [0, -0.06, 0.05], [0.3, 0, 0]);             // kabza boynu
  taperBox(g, [0.052, 0.11, 0.34], TAN, [0, -0.01, 0.23], [0.14, 0, 0], [1, 1], [1, 1]);   // dipçik
  box(g, [0.056, 0.12, 0.016], BLACK, [0, -0.035, 0.4], [0.14, 0, 0]);
  box(g, [0.012, 0.03, 0.07], RED, [0.034, 0.0, 0.03]);                        // fişek tutucu şeridi
  box(g, [0.04, 0.012, 0.03], DARK, [0, -0.02, -0.03]);                        // yükleme kapısı
  return finish(g, { name: 'Pompalı', hold: 'rifle', flat: true, gripR: [0, -0.03, 0.05], gripL: [0, -0.03, -0.3], muzzle: [0, 0.04, -0.66], length: 1.05, port: [0, -0.03, -0.03] });
}
// ───────────────────────── Glock: koyu gri sürgü + siyah çerçeve ─────────────────────────
function pistol() {
  const g = new THREE.Group(), { GREY, DARK, BLACK, STEEL } = U;
  const sl = new THREE.Group(); g.add(sl); g.userData.slide = sl;
  box(sl, [0.036, 0.044, 0.19], GREY, [0, 0.05, -0.06]);                       // sürgü
  box(sl, [0.03, 0.012, 0.012], DARK, [0, 0.078, 0.03]);                       // arka gez (tepe 0,084)
  box(g, [0.032, 0.024, 0.17], BLACK, [0, 0.016, -0.055]);                     // çerçeve
  box(g, [0.038, 0.1, 0.056], BLACK, [0, -0.04, 0.02], [0.2, 0, 0]);           // kabza
  box(g, [0.012, 0.012, 0.07], BLACK, [0, -0.012, -0.04]);                     // tetik koruması
  box(g, [0.012, 0.03, 0.01], BLACK, [0, -0.005, -0.075]);
  box(g, [0.01, 0.018, 0.01], DARK, [0, 0.0, -0.043]);                         // tetik
  box(g, [0.018, 0.018, 0.02], STEEL, [0, 0.05, -0.165]);                      // namlu ağzı
  frontSight(g, [0.006, 0.012, 0.008], DARK, [0, 0.078, -0.14]);              // arpacık (tepe 0,084)
  const mg = magGroup(g);
  box(mg, [0.04, 0.014, 0.062], DARK, [0, -0.094, 0.036], [0.2, 0, 0]);        // şarjör tabanı
  return finish(g, { name: 'Glock 17', mag: mg, hold: 'pistol', flat: true, gripR: [0, -0.03, 0.02], gripL: null, muzzle: [0, 0.05, -0.18], length: 0.28 });
}
// ───────────────────────── M24: zeytin kundak + koyu metal + siyah kutu dürbün ─────────────────────────
function sniper() {
  const g = new THREE.Group(), { GREY, DARK, BLACK, OLIVE, OLIVE2, STEEL, LENS } = U;
  taperBox(g, [0.058, 0.09, 0.46], OLIVE, [0, -0.01, -0.3], null, [0.9, 1], [1, 1]);     // ön kundak
  box(g, [0.056, 0.085, 0.24], OLIVE, [0, 0.0, -0.04]);                        // gövde bloğu
  box(g, [0.05, 0.05, 0.26], GREY, [0, 0.055, -0.09]);                         // alıcı
  box(g, [0.03, 0.03, 0.5], DARK, [0, 0.055, -0.6]);                           // ağır namlu
  box(g, [0.04, 0.04, 0.07], BLACK, [0, 0.055, -0.88]);                        // namlu freni
  muzzleTip(g, [0, 0.055, -0.92]);
  box(g, [0.042, 0.1, 0.05], OLIVE, [0, -0.07, 0.04], [0.3, 0, 0]);            // kabza
  box(g, [0.056, 0.125, 0.3], OLIVE, [0, -0.01, 0.22], [0.08, 0, 0]);          // dipçik
  box(g, [0.044, 0.045, 0.17], OLIVE2, [0, 0.075, 0.22], [0.08, 0, 0]);        // yanak desteği
  box(g, [0.06, 0.13, 0.016], BLACK, [0, -0.02, 0.38], [0.08, 0, 0]);
  box(g, [0.056, 0.056, 0.34], BLACK, [0, 0.14, -0.08]);                       // dürbün tüpü
  box(g, [0.072, 0.072, 0.08], BLACK, [0, 0.14, -0.3]);                        // objektif
  box(g, [0.056, 0.056, 0.004], LENS, [0, 0.14, -0.342], null, { emissive: LENS, emissiveIntensity: 0.5 });
  box(g, [0.064, 0.064, 0.07], BLACK, [0, 0.14, 0.12]);                        // göz tarafı
  for (const dz of [-0.17, 0.0]) box(g, [0.034, 0.045, 0.03], DARK, [0, 0.095, dz]);   // dürbün ayakları
  const bolt = new THREE.Group(); bolt.position.set(0, 0.055, 0); g.add(bolt);
  box(bolt, [0.06, 0.014, 0.014], STEEL, [0.045, -0.006, 0], [0, 0, -0.5]);    // sürgü kolu
  box(bolt, [0.024, 0.024, 0.024], BLACK, [0.078, -0.022, 0]);                 // topuz
  const mg = magGroup(g);
  box(mg, [0.036, 0.05, 0.06], DARK, [0, -0.06, -0.06], [0.1, 0, 0]);
  return finish(g, { name: 'M24 Keskin', mag: mg, bolt: { g: bolt, pivot: 0.055 }, hold: 'rifle', flat: true, gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.36], muzzle: [0, 0.055, -0.92], length: 1.3 });
}

// ───────────────────────── MP5 (hafif makineli) ─────────────────────────
function mp5() {
  const g = new THREE.Group();
  box(g, [0.05, 0.075, 0.26], C.gun, [0, 0.02, -0.1], null, M);
  box(g, [0.062, 0.06, 0.17], C.black, [0, 0.005, -0.32]);                     // tutamaç
  cyl(g, 0.016, 0.016, 0.07, C.steel, [0, 0.025, -0.44], 8, M);                // namlu manşonu
  cyl(g, 0.01, 0.01, 0.05, C.steel, [0, 0.025, -0.49], 8, M);
  frontSight(g, [0.012, 0.06, 0.016], C.steel, [0, 0.0625, -0.45]);           // arpacık
  box(g, [0.04, 0.04, 0.05], C.black, [0, 0.0, -0.01]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, -0.045, -0.04]);
  box(g, [0.04, 0.105, 0.05], C.black, [0, -0.07, 0.045], [0.3, 0, 0]);
  // kavisli şarjör
  const mg = magGroup(g);
  box(mg, [0.034, 0.1, 0.05], C.steel, [0, -0.06, -0.12], [0.1, 0, 0], M);
  box(mg, [0.034, 0.1, 0.05], C.steel, [0, -0.155, -0.14], [0.3, 0, 0], M);
  box(mg, [0.034, 0.08, 0.05], C.steel, [0, -0.23, -0.175], [0.55, 0, 0], M);
  // tel dipçik
  box(g, [0.014, 0.014, 0.28], C.steel, [0, 0.03, 0.24], null, M);
  box(g, [0.014, 0.014, 0.28], C.steel, [0, -0.04, 0.24], [0.15, 0, 0], M);
  box(g, [0.012, 0.09, 0.012], C.steel, [0, -0.005, 0.38], null, M);
  box(g, [0.048, 0.1, 0.02], C.black, [0, -0.01, 0.395]);
  // ayrıntılar
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) box(g, [0.004, 0.035, 0.008], '#0a0a0c', [sx * 0.0315, 0.005, -0.27 - i * 0.025]);   // tutamak yarıkları
  box(g, [0.064, 0.012, 0.02], C.steel, [0, 0.03, -0.405]);                                // tutamak ucu halkası
  box(g, [0.01, 0.014, 0.06], C.steel, [0.03, 0.01, -0.02]);                                // seçici kolu
  box(g, [0.006, 0.02, 0.05], '#0a0a0c', [0.0265, 0.034, -0.11]);                          // atım penceresi
  box(g, [0.04, 0.05, 0.09], C.black, [0, 0.015, 0.07]);                                    // dipçik bağlantı bloğu (tel dipçik gövdeye otursun)
  for (const dz of [-0.09, 0.0]) box(g, [0.012, 0.03, 0.012], C.steel, [0, -0.034, dz]);   // tetik koruması direkleri
  studs(g, [[0.02, -0.2], [0.04, -0.1]], C.steel, 0.007, 0.0255);
  box(mg, [0.038, 0.012, 0.055], C.black, [0, -0.275, -0.19], [0.55, 0, 0]);
  sling(g, [0, 0.0, 0.4]);
  gripTexture(g, -0.04, 0.045, 0.04, 0.08, 4, 0.3);
  return finish(g, {
    name: 'MP5', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.02, -0.32], muzzle: [0, 0.025, -0.53], length: 0.92,
  });
}

// ───────────────────────── Hafif Makineli (M249) ─────────────────────────
function lmg() {
  const g = new THREE.Group();
  box(g, [0.07, 0.095, 0.4], C.gun, [0, 0.02, -0.15], null, M);                         // gövde
  box(g, [0.06, 0.03, 0.2], C.black, [0, 0.085, -0.1]);                                 // besleme kapağı
  box(g, [0.035, 0.012, 0.3], C.black, [0, 0.105, -0.17]);                              // ray
  // fişek kutusu + kemer
  const mg = magGroup(g);
  box(mg, [0.1, 0.12, 0.16], C.olive, [0, -0.115, -0.13]);
  box(mg, [0.104, 0.02, 0.164], C.oliveDark, [0, -0.06, -0.13]);
  for (let i = 0; i < 6; i++) box(mg, [0.06, 0.016, 0.012], C.brass, [0.0, -0.03, -0.2 + i * 0.022], [0, 0, 0], M);
  box(mg, [0.05, 0.05, 0.02], C.brass, [0, -0.01, -0.11], null, M);
  // namlu & ısı kalkanı
  box(g, [0.07, 0.06, 0.2], C.black, [0, 0.025, -0.45]);
  cyl(g, 0.016, 0.016, 0.28, C.steel, [0, 0.028, -0.65], 8, M);
  cyl(g, 0.022, 0.022, 0.07, C.black, [0, 0.028, -0.8], 8, M);
  // taşıma sapı
  box(g, [0.012, 0.07, 0.012], C.steel, [0, 0.085, -0.58]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, 0.12, -0.58]);
  // bipod
  box(g, [0.08, 0.02, 0.03], C.steel, [0, 0.005, -0.62]);
  box(g, [0.012, 0.14, 0.012], C.steel, [-0.045, -0.075, -0.65], [0.0, 0, -0.25]);
  box(g, [0.012, 0.14, 0.012], C.steel, [0.045, -0.075, -0.65], [0.0, 0, 0.25]);
  box(g, [0.045, 0.11, 0.055], C.black, [0, -0.07, 0.06], [0.3, 0, 0]);
  box(g, [0.012, 0.012, 0.1], C.steel, [0, -0.052, -0.02]);
  box(g, [0.05, 0.08, 0.1], C.black, [0, 0.0, 0.1]);                                       // dipçik bağlantısı
  box(g, [0.06, 0.13, 0.3], C.black, [0, -0.0, 0.27], [0.08, 0, 0]);
  box(g, [0.064, 0.14, 0.016], C.steel, [0, -0.02, 0.43], [0.08, 0, 0]);
  // ayrıntılar
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) box(g, [0.004, 0.02, 0.008], '#0a0a0c', [sx * 0.037, 0.03, -0.38 - i * 0.025]);   // ısı kalkanı delikleri
  for (let i = 0; i < 3; i++) box(g, [0.074, 0.01, 0.012], C.steel, [0, 0.025, -0.53 - i * 0.04]);
  box(g, [0.02, 0.012, 0.04], C.steel, [0.045, 0.04, -0.02]);                                   // doldurma kolu
  box(g, [0.012, 0.03, 0.012], C.steel, [0.052, 0.03, -0.02]);
  box(g, [0.012, 0.012, 0.12], C.steel, [-0.045, 0.06, -0.25]);
  for (let i = 0; i < 5; i++) box(mg, [0.012, 0.014, 0.01], C.brass, [-0.05, -0.03 + 0.0, -0.215 + i * 0.015]);   // kemer halkaları
  box(mg, [0.106, 0.012, 0.166], C.black, [0, -0.17, -0.13]);                                  // kutu tabanı
  for (let i = 0; i < 3; i++) box(mg, [0.002, 0.08, 0.004], C.oliveDark, [0.0505, -0.115, -0.18 + i * 0.05]);
  cyl(g, 0.022, 0.022, 0.03, C.black, [0, 0.028, -0.82], 8, M);                                 // alev gizleyici halkası
  for (let i = 0; i < 3; i++) box(g, [0.05, 0.006, 0.006], '#0a0a0c', [0, 0.028, -0.8 + i * 0.012]);
  box(g, [0.066, 0.1, 0.014], C.steel, [0, -0.01, 0.32], [0.08, 0, 0]);
  sling(g, [0, 0.0, 0.42]); sling(g, [0, 0.01, -0.5]);
  gripTexture(g, -0.04, 0.06, 0.046, 0.08, 4, 0.3);
  return finish(g, {
    name: 'M249 LMG', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.06], gripL: [0, -0.01, -0.45], muzzle: [0, 0.028, -0.84], length: 1.28,
  });
}

// ───────────────────────── RPG-7 ─────────────────────────
function rpg() {
  const g = new THREE.Group();
  cyl(g, 0.03, 0.03, 0.95, C.olive, [0, 0.05, 0.05], 10, M);                      // tüp
  cyl(g, 0.036, 0.036, 0.3, C.wood, [0, 0.05, -0.12], 10);                         // ahşap koruma
  cyl(g, 0.03, 0.06, 0.14, C.oliveDark, [0, 0.05, 0.57], 10, M);                  // arka huni
  // mühimmat başlığı
  const mg = magGroup(g);                                                          // roket başlığı (doldururken çıkar/girer)
  cyl(mg, 0.012, 0.05, 0.14, C.olive, [0, 0.05, -0.6], 10, M);                    // koni burun
  cyl(mg, 0.05, 0.05, 0.1, C.oliveDark, [0, 0.05, -0.48], 10, M);                 // gövde
  cyl(mg, 0.034, 0.034, 0.06, C.oliveDark, [0, 0.05, -0.41], 10, M);
  box(g, [0.04, 0.115, 0.05], C.black, [0, -0.04, 0.04], [0.3, 0, 0]);             // kabza
  box(g, [0.012, 0.012, 0.09], C.steel, [0, -0.012, -0.01]);                       // tetik koruması
  box(g, [0.04, 0.09, 0.04], C.black, [0, -0.025, -0.2], [-0.1, 0, 0]);            // ön kabza
  // nişangâh (tüpün solunda): arkada halka (göze yakın), önde turuncu uçlu arpacık. Halkanın ortasından arpacığın turuncu ucu görününce nişan hizalıdır.
  box(g, [0.04, 0.012, 0.022], C.steel, [-0.027, 0.082, -0.05]);                    // arka kelepçe
  box(g, [0.01, 0.045, 0.014], C.steel, [-0.045, 0.1, -0.05]);                      // arka halka sapı
  ring(g, 0.017, 0.0032, C.black, [-0.045, 0.14, -0.05], 12);                       // arka halka (nişan penceresi)
  box(g, [0.04, 0.012, 0.022], C.steel, [-0.027, 0.082, -0.4]);                     // ön kelepçe
  box(g, [0.007, 0.062, 0.009], C.steel, [-0.045, 0.114, -0.4]);                    // arpacık
  box(g, [0.009, 0.014, 0.011], '#ff9a2e', [-0.045, 0.143, -0.4]);                  // turuncu uç (nişan noktası)
  // ayrıntılar
  for (let i = 0; i < 4; i++) cyl(g, 0.038, 0.038, 0.012, C.black, [0, 0.05, -0.2 + i * 0.1], 10);       // tüp bantları
  for (let i = 0; i < 5; i++) box(g, [0.004, 0.012, 0.3 / 5], '#2a2d30', [0.0, 0.086, -0.12 - 0.15 + i * 0.06]);   // ahşap damarı
  for (let k = 0; k < 4; k++) box(mg, [0.01, 0.07, 0.035], C.oliveDark, [Math.cos(k * Math.PI / 2) * 0.052, 0.05 + Math.sin(k * Math.PI / 2) * 0.052, -0.42], [0, 0, k * Math.PI / 2 + Math.PI / 2]);  // stabilizör kanatları
  cyl(mg, 0.014, 0.014, 0.03, C.brass, [0, 0.05, -0.68], 8, M);                                  // fünye ucu
  cyl(g, 0.065, 0.062, 0.02, C.black, [0, 0.05, 0.64], 10, M);                                    // arka huni halkası
  box(g, [0.06, 0.02, 0.1], C.black, [0, 0.0, -0.04]);                                            // kabza gövdesi
  sling(g, [0, 0.0, 0.3]); sling(g, [0, 0.0, -0.3]);
  return finish(g, {
    name: 'RPG-7', mag: mg, magAxis: [0, 0, -1], hold: 'launcher', gripR: [0, -0.03, 0.04], gripL: [0, -0.03, -0.2], muzzle: [0, 0.05, -0.68], length: 1.3,
  });
}

// ───────────────────────── Bıçak: siyah sap + çelik ağız, kama uç (Unturned tarzı; sap z=0 merkezli, el burada tutar) ─────────────────────────
function knife() {
  const g = new THREE.Group(), { BLACK, STEEL } = U;
  box(g, [0.03, 0.038, 0.12], BLACK, [0, 0, 0]);                               // sap
  box(g, [0.032, 0.044, 0.016], STEEL, [0, 0, 0.066]);                         // kafa
  box(g, [0.012, 0.066, 0.014], STEEL, [0, 0, -0.066]);                        // siper
  box(g, [0.008, 0.036, 0.15], STEEL, [0, 0.002, -0.14]);                      // ağız gövdesi
  box(g, [0.0085, 0.008, 0.15], '#d8dde3', [0, -0.016, -0.14]);               // parlak keskin kenar
  taperBox(g, [0.008, 0.05, 0.036], STEEL, [0, 0.002, -0.24], [-Math.PI / 2, 0, 0], [1, 0.12], [1, 1]);   // kama uç (yerel +Y → −Z)
  return finish(g, { name: 'Bıçak', hold: 'melee', flat: true, gripR: [0, 0, 0.0], gripL: null, muzzle: [0, 0, -0.26], length: 0.34 });
}
const BLK_K = '#15161a';

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
  ak47, m4a1, mp5, pistol, shotgun, sniper, lmg, rpg, knife, grenade, ...MORE, ...PAINTBALL,
};

// Görüntüleyici alt yazısı: WSTATS açıklamasından
export const WEAPON_INFO = new Proxy({}, { get: (_, id) => WSTATS[id]?.desc || '' });

// lod: true → uzaktan görünen savaşçı modeli için sadeleştirilmiş silah (köşe renkli, 2-3 çizim çağrısı; metal/ahşap doku katmanı yok)
export function createWeapon(id, optic = 'reddot', lod = false) {
  const fn = WEAPONS[id];
  if (!fn) throw new Error('Bilinmeyen silah: ' + id);
  const g = fn();
  g.userData.id = id;
  const o = resolveOptic(id, optic);
  g.userData.optic = o;
  const sg = o && o !== 'scope' ? attachSight(g, id, o) : null;
  if (sg) { g.userData.sight = sg.sight; g.userData.dist = sg.dist; g.userData.overlay = sg.overlay; }
  // optik takılıyken ön arpacık nişan çizgisini kapatmasın (demir nişanda ve dürbünsüz silahlarda görünür)
  const showFront = !sg || o === 'iron';
  g.traverse((n) => { if (n.userData.frontSight) n.visible = showFront; });
  if (lod) mergeVC(g, true);
  else { if (!g.userData.flat) finishWeapon(g); mergeStatic(g); }   // düz renkli (flat) Unturned modelleri cilasız                              // önce cila (kenar aşınması öznitelikleri + tür malzemesi), sonra malzeme başına birleştirme
  if (g.userData.mag) {                         // şarjör merkezi (animasyonda sol elin hedefi)
    g.updateMatrixWorld(true);
    g.userData.magPos = new THREE.Box3().setFromObject(g.userData.mag).getCenter(new THREE.Vector3());
  }
  return g;
}
