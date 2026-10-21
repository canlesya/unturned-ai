import * as THREE from 'three';
import { box, taperBox, V, mat, mergeStatic, mergeVC } from '../core/geo.js';
import { finish, magGroup, frontSight } from '../models/weapon_util.js';
import { WEAPONS } from '../models/weapons.js';
import { WSTATS, resolveOptic } from '../game/stats.js';

// Unturned tarzı silah taslakları (lab4): iri blok parçalar, büyük düz yüzler, silah başına 2–3 düz renk, ince süs yok.
// finish() sözleşmesi aynen korunur (gripR / gripL / muzzle / length / mag / magAxis / bolt / hold) → oyundaki değerler değişmez (mermi çıkışı, el noktaları, nişan).
// Lab eki: userData.charge (kurma kolu alt grubu, +Z kayar) · pump (pompa alt grubu) · slide (tabanca sürgüsü) · port (fişek yuvası) · ring (halka nişangâh merkezi).
const TAN = '#b9a884', TAN2 = '#8f8468', GREY = '#4a4d52', DARK = '#2a2c30', BLACK = '#1b1c1f', OLIVE = '#5b6644', OLIVE2 = '#3e4731', STEEL = '#8e949c', RED = '#d8322a', LENS = '#4fb3ff';
const GLOW = { emissive: RED, emissiveIntensity: 1.6 };

// Namlu ucu kırmızı ışık vurgusu (referans: lazer / susturucu ucu)
function muzzleTip(g, p) { box(g, [0.012, 0.012, 0.014], RED, p, null, GLOW); }
// Kurma kolu alt grubu (+Z geri çekilir)
function chargeHandle(g, size, color, pos) { const c = new THREE.Group(); c.userData.home = V(0, 0, 0); g.add(c); box(c, size, color, pos); g.userData.charge = c; return c; }
// Unturned halka nişangâh: kalın sekizgen halka + taban + kırmızı nokta. yb = oturduğu yüzeyin üstü; nişan merkezi yüksekliği döner
function ringSight(g, yb, z, s = 1) {
  const R = 0.025 * s, r = 0.005 * s, cy = yb + 0.012 * s + R + r;
  box(g, [0.03 * s, 0.012 * s, 0.05 * s], DARK, [0, yb + 0.006 * s, z]);
  const t = new THREE.Mesh(new THREE.TorusGeometry(R, r, 4, 8), mat(GREY)); t.position.set(0, cy, z); t.rotation.z = Math.PI / 8; g.add(t);
  box(g, [0.004 * s, 0.004 * s, 0.004 * s], RED, [0, cy, z - 0.004], null, GLOW);                 // kırmızı nokta
  return cy;
}
// Şarjör üstüne küçük renkli etiket şeridi (koyu plaka + kırmızı şerit)
function magLabel(mg, w, y, z, rx = 0) { box(mg, [w + 0.004, 0.03, 0.028], DARK, [0, y, z], [rx, 0, 0]); box(mg, [w + 0.006, 0.011, 0.02], RED, [0, y, z], [rx, 0, 0]); }

// ───────── AK-47: tan gövde + koyu metal + siyah kabza (15 parça; eski 45) ─────────
function ak47() {
  const g = new THREE.Group();
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
  frontSight(g, [0.016, 0.05, 0.02], DARK, [0, 0.045, -0.66]);                // arpacık (optikte gizli)
  taperBox(g, [0.05, 0.11, 0.3], TAN, [0, -0.012, 0.24], [0.1, 0, 0], [1, 1], [1, 1]);   // dipçik
  box(g, [0.054, 0.12, 0.02], BLACK, [0, -0.028, 0.4], [0.1, 0, 0]);          // dipçik plakası
  chargeHandle(g, [0.022, 0.016, 0.04], DARK, [0.038, 0.05, -0.08]);           // kurma kolu (sağ yan)
  return finish(g, { name: 'AK-47', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.35], muzzle: [0, 0.015, -0.74], length: 1.14, ringY: 0.097, ringZ: -0.1 });
}
// ───────── M4A1: tan üst / kundak + siyah alt + koyu metal (16 parça; eski 50) ─────────
function m4a1() {
  const g = new THREE.Group();
  box(g, [0.05, 0.075, 0.19], BLACK, [0, 0.0, -0.07]);                         // alt gövde
  box(g, [0.056, 0.06, 0.28], TAN, [0, 0.062, -0.13]);                         // üst gövde
  box(g, [0.024, 0.012, 0.26], DARK, [0, 0.098, -0.13]);                       // üst ray
  box(g, [0.066, 0.066, 0.26], TAN, [0, 0.05, -0.39]);                         // el kundağı
  box(g, [0.024, 0.012, 0.24], DARK, [0, 0.089, -0.39]);                       // kundak rayı
  box(g, [0.026, 0.026, 0.12], DARK, [0, 0.05, -0.59]);                        // namlu
  box(g, [0.036, 0.036, 0.07], BLACK, [0, 0.05, -0.66]);                       // alev gizleyici
  muzzleTip(g, [0, 0.05, -0.7]);
  frontSight(g, [0.016, 0.07, 0.018], DARK, [0, 0.09, -0.55]);
  const mg = magGroup(g);
  box(mg, [0.042, 0.17, 0.066], GREY, [0, -0.105, -0.115], [0.1, 0, 0]);       // şarjör
  magLabel(mg, 0.042, -0.12, -0.117, 0.1);
  box(g, [0.044, 0.105, 0.05], BLACK, [0, -0.066, 0.012], [0.3, 0, 0]);        // kabza
  box(g, [0.014, 0.012, 0.09], DARK, [0, -0.045, -0.05]);                      // tetik koruması
  box(g, [0.04, 0.04, 0.26], BLACK, [0, 0.03, 0.14]);                          // tampon tüpü
  taperBox(g, [0.05, 0.1, 0.16], TAN, [0, 0.0, 0.26], [0.08, 0, 0], [1, 1], [1, 1]);   // dipçik
  box(g, [0.054, 0.11, 0.016], BLACK, [0, -0.005, 0.345], [0.08, 0, 0]);
  chargeHandle(g, [0.034, 0.018, 0.05], DARK, [0, 0.078, 0.03]);               // kurma kolu (arka üst)
  return finish(g, { name: 'M4A1', mag: mg, hold: 'rifle', gripR: [0, -0.03, 0.04], gripL: [0, -0.035, -0.4], muzzle: [0, 0.05, -0.7], length: 1.0, ringY: 0.104, ringZ: -0.14 });
}
// ───────── Pompalı: koyu metal + tan kundak / pompa + kırmızı fişek şeridi (12 parça; eski 35) ─────────
function shotgun() {
  const g = new THREE.Group();
  box(g, [0.056, 0.08, 0.2], GREY, [0, 0.02, -0.05]);                          // alıcı
  box(g, [0.032, 0.032, 0.5], DARK, [0, 0.04, -0.4]);                          // namlu
  box(g, [0.028, 0.028, 0.46], DARK, [0, -0.005, -0.38]);                      // şarjör tüpü
  box(g, [0.038, 0.038, 0.03], BLACK, [0, -0.005, -0.62]);                     // tüp kapağı
  frontSight(g, [0.01, 0.016, 0.01], '#d9b25a', [0, 0.068, -0.65]);           // boncuk
  const pump = new THREE.Group(); g.add(pump); g.userData.pump = pump;
  box(pump, [0.068, 0.058, 0.17], TAN, [0, -0.01, -0.3]);                      // pompa
  box(g, [0.014, 0.012, 0.09], DARK, [0, -0.047, -0.01]);                      // tetik koruması
  box(g, [0.044, 0.07, 0.05], TAN, [0, -0.06, 0.05], [0.3, 0, 0]);             // kabza boynu
  taperBox(g, [0.052, 0.11, 0.34], TAN, [0, -0.01, 0.23], [0.14, 0, 0], [1, 1], [1, 1]);   // dipçik
  box(g, [0.056, 0.12, 0.016], BLACK, [0, -0.035, 0.4], [0.14, 0, 0]);
  box(g, [0.012, 0.03, 0.07], RED, [0.034, 0.0, 0.03]);                        // fişek tutucu şeridi
  box(g, [0.04, 0.012, 0.03], DARK, [0, -0.02, -0.03]);                        // yükleme kapısı
  return finish(g, { name: 'Pompalı', hold: 'rifle', gripR: [0, -0.03, 0.05], gripL: [0, -0.03, -0.3], muzzle: [0, 0.04, -0.66], length: 1.05, port: [0, -0.03, -0.03], ringY: 0.062, ringZ: -0.03 });
}
// ───────── Glock: koyu gri sürgü + siyah çerçeve (10 parça; eski 30) ─────────
function pistol() {
  const g = new THREE.Group();
  const sl = new THREE.Group(); g.add(sl); g.userData.slide = sl;
  box(sl, [0.036, 0.044, 0.19], GREY, [0, 0.05, -0.06]);                       // sürgü
  box(sl, [0.03, 0.012, 0.012], DARK, [0, 0.078, 0.03]);                       // arka gez
  box(g, [0.032, 0.024, 0.17], BLACK, [0, 0.016, -0.055]);                     // çerçeve
  box(g, [0.038, 0.1, 0.056], BLACK, [0, -0.04, 0.02], [0.2, 0, 0]);           // kabza
  box(g, [0.012, 0.012, 0.07], BLACK, [0, -0.012, -0.04]);                     // tetik koruması
  box(g, [0.012, 0.03, 0.01], BLACK, [0, -0.005, -0.075]);
  box(g, [0.01, 0.018, 0.01], DARK, [0, 0.0, -0.043]);                         // tetik
  box(g, [0.018, 0.018, 0.02], STEEL, [0, 0.05, -0.165]);                      // namlu ağzı
  frontSight(g, [0.006, 0.012, 0.008], DARK, [0, 0.077, -0.14]);
  const mg = magGroup(g);
  box(mg, [0.04, 0.014, 0.062], DARK, [0, -0.094, 0.036], [0.2, 0, 0]);        // şarjör tabanı
  return finish(g, { name: 'Glock 17', mag: mg, hold: 'pistol', gripR: [0, -0.03, 0.02], gripL: null, muzzle: [0, 0.05, -0.18], length: 0.28, ringY: 0.072, ringZ: -0.02, ringS: 0.75 });
}
// ───────── M24: zeytin kundak + koyu metal + siyah dürbün (17 parça; eski 50) ─────────
function sniper() {
  const g = new THREE.Group();
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
  return finish(g, { name: 'M24 Keskin', mag: mg, bolt: { g: bolt, pivot: 0.055 }, hold: 'rifle', gripR: [0, -0.03, 0.045], gripL: [0, -0.03, -0.36], muzzle: [0, 0.055, -0.92], length: 1.3 });
}
// ───────── Bıçak: siyah sap + çelik ağız, kama uç (6 parça; eski 20) ─────────
function knife() {
  const g = new THREE.Group();
  box(g, [0.03, 0.038, 0.12], BLACK, [0, 0, 0]);                               // sap
  box(g, [0.032, 0.044, 0.016], STEEL, [0, 0, 0.066]);                         // kafa
  box(g, [0.012, 0.066, 0.014], STEEL, [0, 0, -0.066]);                        // siper
  box(g, [0.008, 0.036, 0.15], STEEL, [0, 0.002, -0.14]);                      // ağız gövdesi
  box(g, [0.0085, 0.008, 0.15], '#d8dde3', [0, -0.016, -0.14]);               // parlak keskin kenar
  taperBox(g, [0.008, 0.05, 0.036], STEEL, [0, 0.002, -0.24], [-Math.PI / 2, 0, 0], [1, 0.12], [1, 1]);   // kama uç (yerel +Y → −Z)
  return finish(g, { name: 'Bıçak', hold: 'melee', gripR: [0, 0, 0.0], gripL: null, muzzle: [0, 0, -0.26], length: 0.34 });
}

export const WEAPONS_U = { ak47, m4a1, shotgun, pistol, sniper, knife };

// createWeapon muadili: taslak silah + halka nişangâh (reddot / holo → halka; iron → arpacık görünür), malzeme başına birleştirme (alt gruplar ayrı kalır).
// lod: üçüncü şahıs (köşe renkli, 2–3 çizim çağrısı). Taslakta olmayan silah (bomba vb.) oyunun kendi modeline düşer.
export function createWeaponU(id, optic = 'reddot', lod = false) {
  const fn = WEAPONS_U[id] || WEAPONS[id];
  if (!fn) throw new Error('Bilinmeyen silah: ' + id);
  const g = fn(), u = g.userData, st = WSTATS[id] || {};
  g.userData.id = id; g.userData.parts = g.children.filter((c) => c.isMesh).length + g.children.filter((c) => c.isGroup).reduce((n, c) => n + c.children.length, 0);
  const o = resolveOptic(id, optic); g.userData.optic = o;
  if (o && o !== 'scope' && o !== 'iron' && u.ringY !== undefined) {
    const cy = ringSight(g, u.ringY, u.ringZ, u.ringS || 1);
    g.userData.sight = [0, cy, u.ringZ]; g.userData.dist = 0.28 * 1.3; g.userData.overlay = 'dot';
    g.traverse((n) => { if (n.userData.frontSight) n.visible = false; });
  } else { g.userData.sight = st.sight; g.userData.dist = st.dist; }
  if (lod) mergeVC(g, true); else mergeStatic(g);
  if (u.mag) { g.updateMatrixWorld(true); g.userData.magPos = new THREE.Box3().setFromObject(u.mag).getCenter(new THREE.Vector3()); }
  return g;
}
export const isNew = (id) => !!WEAPONS_U[id];
