import * as THREE from 'three';
import { Kit } from './s3kit.js';
import { skinMaterial, STD } from './skins.js';

// S3 (BattleBit tarzı) yakın dövüş + atılan / kurulan eşyalar (12.123): bıçak, satır, tomahawk, el bombası, duman, flaş, claymore, cephane kutusu, ilk yardım.
// Aynı Kit (tek ağ, tek malzeme → 1 çizim çağrısı; lod = 3. şahıs ≤ 400 üçgen). finish() sözleşmesi eski modellerle aynı (gripR / muzzle / length ±1 cm, kutu eller aynı yerde tutar).
// Kaplama: yakın dövüş 5 kaplama (SKIN_WEAPONS'a eklendi), eşyalar yalnız Standart. Yuvalar: body = bıçak / gövde, furn = sap / bant, metal = ağız / siper / fünye, acc = ayrıntı.

// Standart paletler (skins.js STD'ye buradan eklenir → diğer silah dosyalarıyla çakışmaz): [renk, pürüzlülük, metaliklik]
Object.assign(STD, {
  knife: { body: ['#3b3e43', 0.36, 0.7], furn: ['#4f5a3a', 0.78, 0], metal: ['#b9c0c7', 0.22, 0.9], acc: ['#a8281f', 0.7, 0] },
  machete: { body: ['#5b6066', 0.34, 0.75], furn: ['#6b3f24', 0.62, 0], metal: ['#c3c8ce', 0.2, 0.9], acc: ['#1b1c1f', 0.6, 0.2] },
  tomahawk: { body: ['#3d4045', 0.4, 0.7], furn: ['#7a4a2a', 0.6, 0], metal: ['#b9c0c7', 0.22, 0.9], acc: ['#1d1e21', 0.7, 0] },
  grenade: { body: ['#4f5a36', 0.62, 0.05], furn: ['#c9a83a', 0.6, 0], metal: ['#8d9298', 0.35, 0.8], acc: ['#2a2c2f', 0.6, 0.3] },
  smoke: { body: ['#8a9097', 0.55, 0.2], furn: ['#e8eaec', 0.6, 0], metal: ['#8d9298', 0.35, 0.8], acc: ['#2a2c2f', 0.6, 0.3] },
  flash: { body: ['#3e434b', 0.5, 0.3], furn: ['#e0b52e', 0.55, 0], metal: ['#8d9298', 0.35, 0.8], acc: ['#15161a', 0.7, 0.1] },
  claymore: { body: ['#59603e', 0.72, 0.02], furn: ['#cdb64e', 0.6, 0], metal: ['#4a4d52', 0.4, 0.7], acc: ['#1d1e20', 0.7, 0.1] },
  ammobox: { body: ['#56603c', 0.66, 0.15], furn: ['#d8b93a', 0.6, 0], metal: ['#7d8288', 0.35, 0.75], acc: ['#1d1e21', 0.6, 0.2] },
  medkit: { body: ['#dcdcd6', 0.6, 0], furn: ['#c22a22', 0.55, 0], metal: ['#8a8d92', 0.35, 0.7], acc: ['#1e1f22', 0.65, 0.1] },
});

const build = (k, mat, meta) => k.build(mat, meta);

// ───────────────────────── Bıçak (taktik, damla uç) ─────────────────────────
// Sap z=0 merkezli (yumruk burada), siper -0,066, ağız aşağıda (-y), uç -0,262
export function knife(mat = skinMaterial('knife'), lod = false) {
  const k = new Kit(lod);
  k.prof([[0.062, 0.015], [0.062, -0.013], [0.042, -0.02], [0.03, -0.015], [0.016, -0.02], [0.002, -0.015], [-0.012, -0.02], [-0.026, -0.015], [-0.04, -0.02], [-0.058, -0.017], [-0.058, 0.017], [0.04, 0.019]], 0.028, 'furn', { c: 0.004, pat: lod ? 0 : 1 });   // oluklu sap (parmak yuvaları altta)
  k.box([0.031, 0.034, 0.014], [0, 0.001, 0.069], 'metal', { c: 0.003, sh: 0.7 });                            // kafa (çekiç ucu)
  k.box([0.006, 0.008, 0.045], [0, -0.022, 0.092], 'acc', { rot: [0.5, 0, 0], d: 1 });                         // kordon
  k.box([0.012, 0.058, 0.012], [0, -0.002, -0.066], 'metal', { c: 0.002, sh: 0.8 });                          // siper (haç)
  // 12.132: gövde + parlak ağız yan yana iki parça (eskiden şerit gövdenin üstüne 0,35 mm kalın bindiriliyordu → ağızda titreyen pikseller); oluk / tırtıl yok (aynı sebep, sade)
  if (lod) k.prof([[-0.072, 0.016], [-0.186, 0.016], [-0.222, 0.01], [-0.262, -0.003], [-0.238, -0.013], [-0.205, -0.018], [-0.072, -0.018]], 0.0065, 'body');
  else {
    k.prof([[-0.072, 0.016], [-0.186, 0.016], [-0.222, 0.01], [-0.259, -0.0015], [-0.232, -0.0075], [-0.2, -0.011], [-0.072, -0.011]], 0.0065, 'body');   // bıçak gövdesi
    k.prof([[-0.072, -0.011], [-0.2, -0.011], [-0.232, -0.0075], [-0.259, -0.0015], [-0.262, -0.003], [-0.238, -0.013], [-0.205, -0.018], [-0.072, -0.018]], 0.0065, 'metal');   // parlak ağız
  }
  return build(k, mat, { name: 'Bıçak', hold: 'melee', gripR: [0, 0, 0.0], gripL: null, muzzle: [0, 0, -0.26], length: 0.34 });
}

// ───────────────────────── Satır (uca doğru genişleyen kılıç ağzı) ─────────────────────────
export function machete(mat = skinMaterial('machete'), lod = false) {
  const k = new Kit(lod);
  k.prof([[0.08, 0.018], [0.086, 0.004], [0.098, -0.03], [0.084, -0.036], [0.066, -0.02], [0.04, -0.02], [0.0, -0.022], [-0.064, -0.02], [-0.064, 0.02], [0.05, 0.021]], 0.032, 'furn', { c: 0.004 });   // sap + kanca
  for (let i = 0; i < 3; i++) k.cyl(0.0065, 0.0065, 0.034, [0, 0, -0.04 + i * 0.04], 'metal', { ax: 'x', seg: 8, sh: 0.85, d: 1 });   // perçinler
  k.box([0.016, 0.054, 0.016], [0, 0, -0.072], 'acc', { c: 0.002 });                                          // siper
  // 12.132: sırt / gövde / ağız yan yana üç parça (üst üste bindirme titriyordu)
  if (lod) k.prof([[-0.078, 0.018], [-0.3, 0.023], [-0.46, 0.025], [-0.515, 0.02], [-0.545, 0.006], [-0.515, -0.026], [-0.44, -0.045], [-0.3, -0.042], [-0.16, -0.031], [-0.078, -0.022]], 0.0075, 'body');
  else {
    k.prof([[-0.078, 0.018], [-0.3, 0.023], [-0.46, 0.025], [-0.46, 0.019], [-0.3, 0.017], [-0.078, 0.012]], 0.0075, 'acc');   // koyu sırt
    k.prof([[-0.078, 0.012], [-0.3, 0.017], [-0.46, 0.019], [-0.46, 0.025], [-0.515, 0.02], [-0.545, 0.006], [-0.54, 0.004], [-0.508, -0.02], [-0.44, -0.037], [-0.3, -0.034], [-0.16, -0.024], [-0.078, -0.016]], 0.0075, 'body');   // gövde
    k.prof([[-0.078, -0.016], [-0.16, -0.024], [-0.3, -0.034], [-0.44, -0.037], [-0.508, -0.02], [-0.54, 0.004], [-0.545, 0.006], [-0.515, -0.026], [-0.44, -0.045], [-0.3, -0.042], [-0.16, -0.031], [-0.078, -0.022]], 0.0075, 'metal');   // parlak ağız
  }
  return build(k, mat, { name: 'Satır', hold: 'melee', gripR: [0, 0, 0.0], gripL: null, muzzle: [0, 0, -0.56], length: 0.7 });
}

// ───────────────────────── Tomahawk (taktik balta) ─────────────────────────
export function tomahawk(mat = skinMaterial('tomahawk'), lod = false) {
  const k = new Kit(lod);
  k.box([0.026, 0.03, 0.47], [0, 0, -0.135], 'furn', { c: 0.006, ax: 'z' });                                  // sap (sekizgen)
  k.box([0.031, 0.035, 0.05], [0, 0, 0.098], 'acc', { c: 0.005, ax: 'z' });                                   // uç tutacağı
  if (!lod) for (let i = 0; i < 5; i++) k.box([0.029, 0.033, 0.012], [0, 0, 0.055 - i * 0.022], 'acc', { c: 0.004, ax: 'z', sh: 0.9 });   // paracord sargı
  // 12.132: baş + ağız yan yana (bindirme titriyordu); hafifletme deliği gerçek delik
  if (lod) k.prof([[-0.31, 0.022], [-0.37, 0.022], [-0.372, -0.012], [-0.432, -0.08], [-0.428, -0.09], [-0.252, -0.09], [-0.248, -0.08], [-0.308, -0.012]], 0.013, 'body');
  else {
    k.prof([[-0.31, 0.022], [-0.37, 0.022], [-0.372, -0.012], [-0.4294, -0.077], [-0.2506, -0.077], [-0.308, -0.012]], 0.013, 'body', { holes: [[[-0.325, -0.017], [-0.355, -0.017], [-0.355, -0.045], [-0.325, -0.045]]] });   // balta başı
    k.prof([[-0.4294, -0.077], [-0.432, -0.08], [-0.428, -0.09], [-0.252, -0.09], [-0.248, -0.08], [-0.2506, -0.077]], 0.013, 'metal');   // parlak ağız (aşağıda)
  }
  k.prof([[-0.318, 0.022], [-0.362, 0.022], [-0.346, 0.066], [-0.334, 0.066]], 0.012, 'body', { sh: 0.85 });   // arka sivri uç
  k.box([0.016, 0.02, 0.012], [0, 0.0, -0.375], 'acc', { c: 0.002, d: 1 });                                   // sap tıpası
  return build(k, mat, { name: 'Tomahawk', hold: 'melee', gripR: [0, 0, 0.02], gripL: null, muzzle: [0, -0.06, -0.36], length: 0.56 });
}

// ── atılanlar: fünye + kaşık + pim halkası (kabza = gövde merkezi) ──
function fuze(k, top) {
  k.cyl(0.0125, 0.014, 0.022, [0, top + 0.009, 0], 'metal', { ax: 'y', seg: 8 });                              // fünye gövdesi
  k.box([0.014, 0.008, 0.052], [0, top + 0.022, 0.018], 'metal', { c: 0.002, rot: [-0.12, 0, 0] });          // kaşık (üst)
  k.box([0.014, 0.07, 0.007], [0, top - 0.02, 0.043], 'metal', { c: 0.002, rot: [0.08, 0, 0] });             // kaşık (yan, gövdeye yaslı)
  k.ring(0.012, 0.0025, [0.022, top + 0.014, -0.004], 'acc', { d: 1, seg: 6, rs: 3 });                                        // pim halkası
  k.box([0.012, 0.003, 0.003], [0.012, top + 0.012, -0.004], 'acc', { d: 1 });                                 // pim
}
// ───────────────────────── El bombası (M67 tarzı küre) ─────────────────────────
export function grenade(mat = skinMaterial('grenade'), lod = false) {
  const k = new Kit(lod);
  const sp = new THREE.SphereGeometry(0.04, lod ? 7 : 10, lod ? 5 : 7); sp.scale(1, 1.2, 1);
  k._push(sp, 'body', {});
  k.cyl(0.025, 0.025, 0.006, [0, 0.044, 0], 'acc', { ax: 'y', seg: 10 });                                     // boyun
  k.cyl(0.034, 0.034, 0.006, [0, -0.012, 0], 'furn', { ax: 'y', seg: 12, d: 1 });                            // sarı tanım bandı
  fuze(k, 0.047);
  return build(k, mat, { name: 'El Bombası', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.1 });
}
// Silindir bomba (duman / flaş): gövde + bantlar; flaşta delikler
function canister(k, holes) {
  k.cyl(0.032, 0.032, 0.1, [0, 0, 0], 'body', { ax: 'y', seg: 10 });
  k.cyl(0.0336, 0.0336, 0.026, [0, 0.012, 0], 'furn', { ax: 'y', seg: 10 });                                 // tanım bandı
  k.cyl(0.0336, 0.0336, 0.008, [0, -0.046, 0], 'metal', { ax: 'y', seg: 10, sh: 0.8 });                       // alt kapak
  k.cyl(0.027, 0.032, 0.008, [0, 0.054, 0], 'metal', { ax: 'y', seg: 10, sh: 0.8 });                          // üst omuz
  if (holes && !k.lod) for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + r * 1.05; k.box([0.009, 0.012, 0.004], [Math.sin(a) * 0.0322, -0.022 - r * 0.016, Math.cos(a) * 0.0322], 'acc', { rot: [0, a, 0] }); }   // flaş delikleri
  fuze(k, 0.058);
}
export function smoke(mat = skinMaterial('smoke'), lod = false) {
  const k = new Kit(lod); canister(k, false);
  if (!lod) k.cyl(0.0338, 0.0338, 0.004, [0, 0.03, 0], 'acc', { ax: 'y', seg: 10 });                          // ince koyu çizgi
  return build(k, mat, { name: 'Dumanlı Bomba', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.1 });
}
export function flash(mat = skinMaterial('flash'), lod = false) {
  const k = new Kit(lod); canister(k, true);
  return build(k, mat, { name: 'Flaşbang', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.1 });
}

// ───────────────────────── Claymore (M18 tarzı kavisli plaka, ön yüz -Z) ─────────────────────────
export function claymore(mat = skinMaterial('claymore'), lod = false) {
  const k = new Kit(lod), N = lod ? 4 : 6, pts = [];
  const zf = (x) => -0.034 + 0.022 * (x / 0.11) ** 2;                                                         // ön yüz kavisi (ortası öne çıkık)
  for (let i = 0; i <= N; i++) { const x = -0.11 + (0.22 * i) / N; pts.push([x, zf(x)]); }
  for (let i = N; i >= 0; i--) { const x = -0.11 + (0.22 * i) / N; pts.push([x, zf(x) + 0.034]); }
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const c = lod ? 0 : 0.003, g = new THREE.ExtrudeGeometry(sh, { depth: 0.1 - 2 * c, bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelOffset: -c, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -0.05 + c); g.rotateX(-Math.PI / 2);                                                       // XY şekli → XZ, Y boyunca 0,1 m
  k._push(g, 'body', {});
  k.box([0.12, 0.022, 0.004], [0, 0.012, -0.0355], 'furn', { d: 1 });                                         // "FRONT TOWARD ENEMY" bandı
  k.box([0.02, 0.012, 0.024], [0, 0.056, -0.012], 'acc', { c: 0.002 });                                       // nişan yarığı
  for (const sx of [-1, 1]) k.cyl(0.0075, 0.0075, 0.014, [sx * 0.045, 0.056, -0.012], 'metal', { ax: 'y', seg: 8 });   // fünye yuvaları
  k.box([0.006, 0.01, 0.07], [0.045, 0.058, 0.03], 'acc', { d: 1, rot: [0.25, 0, 0] });                       // kablo
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box([0.006, 0.08, 0.006], [sx * 0.085, -0.075, -0.006 + sz * 0.014], 'metal', { rot: [sz * 0.32, 0, sx * 0.12] });   // makas ayaklar
  return build(k, mat, { name: 'Claymore', hold: 'grenade', gripR: [0, 0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.22 });
}

// ───────────────────────── Cephane kutusu (M2A1 tarzı) — kabza = kutu ortası, eski modelle aynı ölçü ─────────────────────────
export function ammobox(mat = skinMaterial('ammobox'), lod = false) {
  const k = new Kit(lod);
  k.box([0.32, 0.18, 0.16], [0, 0, 0], 'body', { c: 0.006 });
  k.box([0.336, 0.03, 0.172], [0, 0.1, 0], 'body', { c: 0.004, sh: 0.9 });                                    // kapak
  k.box([0.12, 0.012, 0.022], [0, 0.135, 0], 'acc', { c: 0.003 });                                            // sap
  for (const sx of [-1, 1]) k.box([0.012, 0.022, 0.018], [sx * 0.055, 0.122, 0], 'acc');
  k.box([0.012, 0.06, 0.05], [0.166, 0.07, 0], 'metal', { c: 0.002 });                                        // kilit kolu
  for (const sz of [-1, 1]) k.box([0.11, 0.05, 0.003], [-0.03, 0.0, sz * 0.0805], 'furn', { d: 1 });          // sarı yazı plakası
  if (!lod) for (const x of [-0.11, 0.11]) for (const sz of [-1, 1]) k.box([0.03, 0.15, 0.003], [x, -0.005, sz * 0.0805], 'body', { sh: 0.82 });   // preslenmiş kaburgalar
  return build(k, mat, { name: 'Cephane Kutusu', hold: 'grenade', gripR: [0, 0.0, 0], gripL: null, muzzle: [0, 0, 0], length: 0.3 });
}

// ───────────────────────── İlk yardım çantası (köken = taban merkezi, eski createItem('medkit') ölçüsü) ─────────────────────────
export function medkit(mat = skinMaterial('medkit'), lod = false) {
  const k = new Kit(lod);
  k.box([0.3, 0.168, 0.12], [0, 0.084, 0], 'body', { c: 0.008 });
  k.box([0.31, 0.03, 0.126], [0, 0.18, 0], 'body', { c: 0.005, sh: 0.88 });                                   // kapak
  k.box([0.1, 0.016, 0.026], [0, 0.212, 0], 'acc', { c: 0.004 });                                             // sap
  for (const sx of [-1, 1]) k.box([0.014, 0.022, 0.02], [sx * 0.04, 0.2, 0], 'acc');
  for (const sz of [-1, 1]) { k.box([0.09, 0.026, 0.004], [0, 0.088, sz * 0.0605], 'furn'); k.box([0.026, 0.09, 0.004], [0, 0.088, sz * 0.0605], 'furn'); }   // kırmızı haç (iki yüz)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box([0.022, 0.034, 0.008], [sx * 0.11, 0.166, sz * 0.062], 'metal', { c: 0.002, d: 1 });   // kilitler
  return build(k, mat, { name: 'İlk Yardım', hold: 'item', gripR: [0.02, -0.02, 0.0], gripL: null, muzzle: [0, 0, 0], length: 0.3 });
}

export const S3I = { knife, machete, tomahawk, grenade, smoke, flash, claymore, ammobox, medkit };
