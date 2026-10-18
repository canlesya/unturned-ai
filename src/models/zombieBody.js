import * as THREE from 'three';
import { box, taperBox, V } from '../core/geo.js';

// Zombi gövdesi (3. şahıs): asker gövdesi yerine türe özgü siluet — kambur, uzun kollu, pençeli; yırtık giysi, açıkta kaburga / kemik, yaralar.
// Hiyerarşi asker modeliyle aynı (root > torso > head / kollar, root > kalça > diz > ayak): animasyon (soldier.syncModel) ve IK (character.poseArm) aynen çalışır.
// Deri ve kan parçaları köşe rengine işaret taşır (userData.vcOff: deri +2, kan +4); ZMAT gölgelendiricisi bunu çözer: deride damar ağı, çürük / morluk lekesi,
// açık yara; giyside kir + kan lekesi, ıslak kan parlar. Tüm düz parçalar grup başına tek ağda (mergeVC, ortak ZMAT): çizim çağrısı asker kadar.
// Vuruş kutusu modelden bağımsız (soldier.hbW / hbH = ZTYPES / BOSS ölçeği); burada yalnız görünüm.

const ZNOISE = `
float zh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float zn3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(zh3(i), zh3(i + vec3(1, 0, 0)), f.x), mix(zh3(i + vec3(0, 1, 0)), zh3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(zh3(i + vec3(0, 0, 1)), zh3(i + vec3(1, 0, 1)), f.x), mix(zh3(i + vec3(0, 1, 1)), zh3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
`;
export const ZMAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0 });
ZMAT.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vZP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvZP = position;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vZP;\nfloat zRough = -1.0;\n${ZNOISE}`)
    .replace('#include <color_fragment>', `
{
  vec3 vc = vColor.rgb; float off = vc.r > 7.5 ? 8.0 : vc.r > 5.5 ? 6.0 : vc.r > 3.5 ? 4.0 : vc.r > 1.5 ? 2.0 : 0.0; vc -= off;
  vec3 q = vZP * 11.0;
  vec3 c = vc;
  if (off == 2.0) {                                                      // DERİ: çürük benekler, damar ağı, açık yara
    float m = zn3(q * 0.6) * 0.6 + zn3(q * 1.7) * 0.4;
    c *= 0.78 + 0.42 * m;                                                                               // benekli, düzensiz ten
    c = mix(c, c * vec3(0.8, 0.72, 0.95) * 0.75, smoothstep(0.62, 0.8, zn3(q * 0.5 + 11.0)) * 0.55);  // morluk (mor-gri)
    c = mix(c, c * vec3(1.05, 1.0, 0.72), smoothstep(0.7, 0.85, zn3(q * 0.6 + 31.0)) * 0.35);           // sarımsı çürük
    float vn = abs(zn3(q * 1.1 + 5.0) - 0.5) * 2.0, vn2 = abs(zn3(q * 2.6 + 9.0) - 0.5) * 2.0;
    float vein = (1.0 - smoothstep(0.03, 0.07, vn)) * 0.75 + (1.0 - smoothstep(0.025, 0.055, vn2)) * 0.4;
    c = mix(c, vec3(0.05, 0.03, 0.07), clamp(vein, 0.0, 1.0) * 0.5);                                   // koyu damar ağı
    float wd = zn3(q * 0.85 + 71.0);
    float wound = smoothstep(0.8, 0.83, wd), rim = smoothstep(0.74, 0.8, wd) * (1.0 - wound);
    c = mix(c, vec3(0.1, 0.018, 0.012) * (0.6 + 0.7 * zn3(q * 4.0)), wound);                           // küçük açık yaralar (koyu et)
    c = mix(c, c * vec3(0.6, 0.5, 0.42), rim);                                                          // yara kenarı (kurumuş, koyu)
    if (wound > 0.5) zRough = 0.35;
  } else if (off == 4.0) {                                               // KAN: koyu, ıslak, pıhtılı
    c *= 0.6 + 0.6 * zn3(q * 1.5);
    zRough = 0.28;
  } else if (off == 8.0) {                                               // HAYALET DERİSİ: ölü solukluk, buz mavisi damar ağı, kırağı lekeleri
    c *= 0.82 + 0.3 * (zn3(q * 0.7) * 0.6 + zn3(q * 1.9) * 0.4);
    float vn = abs(zn3(q * 1.2 + 5.0) - 0.5) * 2.0;
    c = mix(c, vec3(0.08, 0.16, 0.24), (1.0 - smoothstep(0.03, 0.07, vn)) * 0.55);
    c = mix(c, c * 1.25 + 0.03, smoothstep(0.68, 0.8, zn3(q * 0.9 + 13.0)) * 0.5);
    zRough = 0.55;
  } else if (off == 6.0) {                                               // KEMİK: kirli sarı-gri, kılcal çatlak, oyuklarda koyu
    c *= 0.7 + 0.4 * zn3(q * 1.2 + 2.0);
    c *= 1.0 - 0.45 * (1.0 - smoothstep(0.02, 0.06, abs(zn3(q * 2.5 + 8.0) - 0.5) * 2.0));
    zRough = 0.6;
  } else {                                                               // GİYSİ: kir + kan lekesi
    float lum = dot(vc, vec3(0.333));
    float g = zn3(q * 0.5 + 3.0) * 0.6 + zn3(q * 1.7) * 0.4;
    c *= 0.78 + 0.4 * g;
    float bl = smoothstep(0.7, 0.78, zn3(q * 0.5 + 17.0)) * step(lum, 0.45);
    c = mix(c, vec3(0.08, 0.015, 0.012), bl * 0.75);                                                     // kurumuş kan lekesi
    if (bl > 0.5) zRough = 0.45;
  }
  diffuseColor.rgb *= c;
}`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (zRough >= 0.0) roughnessFactor = zRough;');
};
ZMAT.customProgramCacheKey = () => 'zombie-skin-v1';

const CRYSTAL = { emissive: '#8a4cff', emissiveIntensity: 1.7, roughness: 0.25 };
const col = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const mul = (a, k) => '#' + new THREE.Color(a).multiplyScalar(k).getHexString();
let SKIN_OFF = 2;                                                            // deri sınıfı: 2 çürümüş (yara / damar), 8 hayalet (soluk, buz mavisi damar, yarasız)
const skin = (m) => { m.userData.vcOff = SKIN_OFF; return m; };
const blood = (m) => { m.userData.vcOff = 4; return m; };
const bone = (m) => { m.userData.vcOff = 6; return m; };                  // kemik / diş / tırnak: kirli, çatlaklı; kan lekesi almaz

// gövde biçimi: tw/th/td göğüs, waist bel daralması, sh omuz yarı genişliği, hd kafa boyutu, l1/l2 üst / ön kol, aw kol kalınlığı, lw bacak kalınlığı, claw pençe boyu
export const ZSHAPE = {
  walker: { tw: 0.42, th: 0.56, td: 0.23, waist: 0.76, sh: 0.29, hd: [0.26, 0.3, 0.28], l1: 0.36, l2: 0.35, aw: 0.105, lw: 0.15, claw: 0.06, hunch: 0.42 },
  runner: { tw: 0.37, th: 0.54, td: 0.2, waist: 0.7, sh: 0.27, hd: [0.24, 0.28, 0.26], l1: 0.35, l2: 0.37, aw: 0.088, lw: 0.13, claw: 0.085, hunch: 0.52 },
  brute: { tw: 0.62, th: 0.6, td: 0.36, waist: 0.84, sh: 0.39, hd: [0.25, 0.25, 0.27], l1: 0.37, l2: 0.37, aw: 0.17, lw: 0.2, claw: 0.07, hunch: 0.34 },
  ghost: { tw: 0.36, th: 0.58, td: 0.19, waist: 0.74, sh: 0.26, hd: [0.24, 0.31, 0.26], l1: 0.37, l2: 0.39, aw: 0.082, lw: 0.125, claw: 0.09, hunch: 0.24 },
  blinker: { tw: 0.41, th: 0.56, td: 0.22, waist: 0.8, sh: 0.29, hd: [0.26, 0.3, 0.27], l1: 0.36, l2: 0.36, aw: 0.1, lw: 0.145, claw: 0.07, hunch: 0.36 },
  boss: { tw: 0.58, th: 0.62, td: 0.33, waist: 0.74, sh: 0.37, hd: [0.29, 0.29, 0.3], l1: 0.38, l2: 0.38, aw: 0.155, lw: 0.19, claw: 0.11, hunch: 0.3 },
};
const SHIRTS = ['#3a3f34', '#3b3430', '#2e343d', '#463a2f', '#3f3d38', '#2f3a33'];
const PANTS = ['#2a2c28', '#25282e', '#2e2a25', '#232523'];
const BONE = '#a1967c', BONED = '#6c6353', FLESH = '#3c0f0b', BLOOD = '#2c0806', MOUTH = '#0c0303', SOCK = '#070504', CLAW = '#120e0a', HAIR = '#0f0d0c';
// 3. şahıs ten rengi (türün oyun içi rengi ZTYPES.skin 1. şahıs ellerinde kalır): koyu, soluk, hastalıklı; tür siluetle birlikte renk tonundan da seçilir
const ZSKIN = { walker: '#56604b', runner: '#5f5b45', brute: '#474e40', ghost: '#76838a', blinker: '#5b5269', boss: '#55322b' };

// kol: üst kol + ön kol (deri; yırtık kol yeni), kemikli dirsek, uzun parmaklı pençe el. Dönüş: character.makeArm ile aynı arayüz (+ l1 / l2)
function zArm(torso, side, P, C, type) {
  const upper = new THREE.Group(), fore = new THREE.Group(), hand = new THREE.Group();
  const sx = side === 'R' ? 1 : -1, aw = P.aw, l1 = P.l1, l2 = P.l2;
  skin(taperBox(upper, [aw, l1 + 0.02, aw * 1.05], C.sk, [0, -l1 / 2, 0], null, [1.05, 1.05], [0.78, 0.8]));
  if (C.sleeve) box(upper, [aw * 1.18, l1 * (type === 'walker' && side === 'L' ? 0.3 : 0.55), aw * 1.22], C.shirt, [0, -l1 * 0.2, 0]);        // yırtık kol yeni
  if (C.sleeve) box(upper, [aw * 0.5, 0.09, 0.012], C.shirt, [sx * aw * 0.2, -l1 * 0.48, -aw * 0.55], [0, 0, sx * 0.4]);                        // sarkan kumaş
  bone(box(upper, [aw * 0.62, aw * 0.5, aw * 0.6], BONED, [0, -l1 + 0.01, aw * 0.38]));                                                               // dirsek kemiği
  skin(taperBox(fore, [aw * 0.88, l2 + 0.02, aw * 0.92], C.skd, [0, -l2 / 2, 0], null, [1, 1], [0.72, 0.75]));
  skin(box(fore, [aw * 0.5, l2 * 0.5, 0.02], C.sk, [sx * aw * 0.1, -l2 * 0.45, -aw * 0.42]));                                                   // ön kol kası (yan ışıkta damar)
  if (type !== 'ghost' && side === (type === 'runner' ? 'L' : 'R')) {                                                                                               // ön kolda yarık: et + kemik
    box(fore, [aw * 0.5, l2 * 0.36, 0.014], FLESH, [0, -l2 * 0.55, -aw * 0.47]);
    bone(box(fore, [aw * 0.18, l2 * 0.32, 0.016], BONE, [aw * 0.05, -l2 * 0.55, -aw * 0.48]));
  }
  if (type === 'brute' || type === 'boss') for (let i = 0; i < 3; i++) bone(box(fore, [aw * 0.95, 0.05, aw * 0.5], BONE, [0, -l2 * (0.25 + i * 0.22), aw * 0.42], [0.3, 0, 0]));   // ön kol kemik plakaları
  // el: avuç + 4 uzun parmak (iki boğum, içe kıvrık) + kara tırnak / pençe + başparmak
  const hk = aw / 0.105;
  skin(box(hand, [0.085 * hk, 0.1, 0.045 * hk], C.sk, [0, -0.045, 0]));
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.022 * hk, k = [0.9, 1, 0.95, 0.8][i];
    skin(box(hand, [0.018 * hk, 0.065 * k, 0.019 * hk], C.sk, [x, -0.12 * k, -0.005]));
    skin(box(hand, [0.016 * hk, 0.055 * k, 0.017 * hk], C.skd, [x, -0.17 * k, -0.022], [0.45, 0, 0]));
    bone(taperBox(hand, [0.015 * hk, P.claw * k, 0.017 * hk], CLAW, [x, -0.2 * k - P.claw * 0.38, -0.048], [0.85, 0, 0], [1, 1], [0.15, 0.25]));
  }
  skin(box(hand, [0.02 * hk, 0.06, 0.02 * hk], C.sk, [-sx * 0.05 * hk, -0.06, -0.025], [0.3, 0, -sx * 0.5]));
  bone(taperBox(hand, [0.016 * hk, P.claw * 0.7, 0.016 * hk], CLAW, [-sx * 0.07 * hk, -0.1 - P.claw * 0.25, -0.045], [0.7, 0, -sx * 0.5], [1, 1], [0.15, 0.25]));
  torso.add(upper, fore, hand);
  return { upper, fore, hand, side, shoulder: V(sx * P.sh, 0.22, 0.02), l1, l2 };
}

// kafa: kafatası, sarkık açık çene, diş sırası, çökük göz çukuru + parlayan göz, kaş kemiği, yanakta yarık, yolunmuş saç, açıkta kafatası
function zHead(head, P, C, T, type) {
  const [hw, hh, hd] = P.hd, fz = -hd / 2;
  const eye = { emissive: T.eye, emissiveIntensity: type === 'ghost' ? 2.2 : 2.8 };
  skin(taperBox(head, [hw, hh * 0.66, hd], C.sk, [0, 0.045, 0], null, [0.9, 0.95], [0.92, 0.96]));
  skin(taperBox(head, [hw * 0.8, hh * 0.22, hd * 0.8], C.skd, [0, -0.1, -0.012], null, [1, 1], [0.72, 0.85]));           // çökük yanak / üst çene (yüz aşağı daralır)
  const jaw = type === 'brute' ? 0.14 : type === 'runner' ? 0.5 : 0.38;
  skin(box(head, [hw * 0.78, 0.065, hd * 0.72], C.skd, [0, -0.175, -0.03], [jaw, 0, 0]));                                      // sarkık alt çene
  box(head, [hw * 0.6, 0.07, 0.03], MOUTH, [0, -0.135, fz + 0.008]);                                                           // açık ağız boşluğu
  for (let i = 0; i < 6; i++) bone(box(head, [0.016, 0.026, 0.012], BONE, [(i - 2.5) * 0.024, -0.112, fz - 0.002]));               // üst dişler
  for (let i = 0; i < 5; i++) bone(box(head, [0.016, 0.022, 0.012], BONED, [(i - 2) * 0.024, -0.168, fz + 0.02], [jaw, 0, 0]));   // alt dişler
  if (type === 'brute' || type === 'boss') for (const s of [-1, 1]) bone(taperBox(head, [0.02, 0.06, 0.02], BONE, [s * 0.075, -0.13, fz + 0.005], [0, 0, -s * 0.2], [0.2, 0.2], [1, 1]));   // diş / yabani diş
  for (const s of [-1, 1]) {
    box(head, [0.075, 0.055, 0.016], SOCK, [s * 0.062, 0.035, fz - 0.002]);                                                    // göz çukuru
    box(head, [0.036, 0.024, 0.012], T.eye, [s * 0.062, 0.03, fz - 0.009], [0, 0, s * 0.25], eye);                           // parlayan göz (içe eğik)
  }
  for (const s of [-1, 1]) skin(box(head, [hw * 0.52, 0.035, 0.05], C.skd, [s * hw * 0.24, 0.072, fz + 0.01], [0.25, 0, s * 0.32]));   // çatık kaş kemiği: içe-aşağı eğik (öfkeli, sert bakış)
  box(head, [0.028, 0.04, 0.014], SOCK, [0, -0.025, fz - 0.002]);                                                               // burun boşluğu
  box(head, [0.05, 0.03, 0.012], FLESH, [0.07, -0.085, fz + 0.002], [0, 0, 0.3]);                                             // yanak yarığı
  bone(box(head, [0.014, 0.022, 0.012], BONE, [0.085, -0.088, fz - 0.002]));
  skin(box(head, [0.02, 0.06, 0.04], C.skd, [-hw / 2 - 0.008, -0.01, 0.01]));                                                  // tek kulak (öteki kopuk)
  box(head, [0.012, 0.03, 0.03], FLESH, [hw / 2 + 0.003, -0.01, 0.01]);
  if (type !== 'brute' && type !== 'boss') {
    bone(box(head, [0.08, 0.012, 0.08], BONE, [0.05, 0.16, -0.01]));                                                                  // açıkta kafatası + kenarı
    box(head, [0.1, 0.008, 0.1], FLESH, [0.05, 0.155, -0.01]);
    for (const [x, z, w] of [[-0.07, 0.03, 0.1], [0.0, 0.1, 0.12], [-0.05, -0.08, 0.06]]) box(head, [w, 0.03, w * 0.8], HAIR, [x, 0.165, z]);   // seyrek saç
  }
  if (type === 'ghost') {                                                                                                         // hayalet: yüzü örten uzun ıslak saç perdesi
    const L = [0.34, 0.46, 0.22, 0.4], W = [0.034, 0.024, 0.03, 0.028], X = [-0.1, -0.05, 0.015, 0.1];      // yüze düşen birkaç ıslak tutam (gözlerden biri açıkta)
    for (let i = 0; i < 4; i++) { const x = X[i]; box(head, [W[i], L[i], 0.016], HAIR, [x, 0.17 - L[i] / 2, fz - 0.02 - (i % 2) * 0.006], [0.06 + (i % 3) * 0.03, 0, (i - 3.5) * 0.035]); }   // yüzü örten ıslak saç telleri (sağ göz açıkta)
    for (let i = 0; i < 7; i++) box(head, [0.04, 0.4 + (i % 3) * 0.12, 0.025], HAIR, [(i - 3) * 0.04, -0.06 - (i % 3) * 0.06, hd / 2 + 0.012], [-0.12, 0, (i - 3) * 0.04]);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(head, [0.02, 0.24 + i * 0.07, 0.03], HAIR, [s * (hw / 2 + 0.01), -0.0 - i * 0.04, -0.06 + i * 0.07], [0, 0, s * (0.04 + i * 0.03)]);
    box(head, [hw + 0.02, 0.05, hd + 0.02], HAIR, [0, 0.17, 0.0]);
  }
}

export function buildZombie(root, { ztype = 'walker', T, skinIndex = 0 }) {
  const type = ZSHAPE[ztype] ? ztype : 'walker', P = ZSHAPE[type];
  SKIN_OFF = type === 'ghost' ? 8 : 2;
  const base = T.skin;
  const sk = ZSKIN[type] || col(base, '#3a3c33', 0.4);
  const C = { sk, skd: mul(sk, 0.72), shirt: SHIRTS[skinIndex % SHIRTS.length], pants: PANTS[skinIndex % PANTS.length], sleeve: type === 'walker' || type === 'blinker' || type === 'boss' };
  if (type === 'ghost') { C.shirt = '#2c3338'; C.pants = '#22282c'; }
  const { tw, th, td } = P;
  // ── gövde ──
  const torso = new THREE.Group();
  torso.position.set(0, 1.17, 0);
  root.add(torso);
  skin(taperBox(torso, [tw, th, td], C.sk, [0, 0.02, 0], null, [1, 1], [P.waist, 0.88]));                                     // göğüs (deri): V biçimli, bel ince
  skin(box(torso, [tw * 0.78, 0.2, 0.1], C.skd, [0, 0.17, td / 2 + 0.01], [-0.35, 0, 0]));                                     // kamburlaşmış sırt
  taperBox(torso, [tw * 0.86, 0.13, td * 0.95], C.pants, [0, -0.33, 0], null, [1, 1], [0.95, 1]);                            // leğen
  skin(box(torso, [0.1, 0.12, 0.1], C.skd, [0, 0.32, -0.03], [0.35, 0, 0]));                                                   // öne uzanan boyun
  for (const s of [-1, 1]) skin(box(torso, [0.025, 0.12, 0.03], C.sk, [s * 0.035, 0.31, -0.075], [0.35, 0, 0]));             // boyun kirişleri
  // göğüs boşluğu: kaburgalar, iman tahtası, koyu et
  const fz = -td / 2;
  box(torso, [tw * 0.5, 0.22, 0.012], FLESH, [0.02, 0.0, fz - 0.004]);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) bone(box(torso, [tw * 0.24, 0.02, 0.022], BONE, [0.02 + s * tw * 0.13, 0.085 - i * 0.05, fz - 0.012], [0, 0, s * (0.18 + i * 0.05)]));
  bone(box(torso, [0.03, 0.2, 0.024], BONE, [0.02, 0.0, fz - 0.014]));
  if (type === 'runner' || type === 'ghost') {                                                                                // çıplak sırtta omurga + kürek kemikleri
    for (let i = 0; i < 6; i++) bone(box(torso, [0.04, 0.035, 0.03], BONED, [0, 0.2 - i * 0.075, td / 2 + 0.012]));
    for (const s of [-1, 1]) box(torso, [0.1, 0.12, 0.02], C.skd, [s * 0.1, 0.13, td / 2 + 0.005], [0, 0, s * 0.3]);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) bone(box(torso, [0.04, 0.012, 0.15], BONED, [s * (tw / 2 - 0.004), 0.06 - i * 0.05, -0.02]));   // yan kaburgalar
  }
  if (type !== 'runner') {                                                                                                      // yırtık gömlek: omuz, sırt, iki yandan sarkan parçalar
    box(torso, [tw + 0.02, 0.12, td + 0.02], C.shirt, [0, 0.23, 0]);
    if (type !== 'ghost') box(torso, [tw * 0.94, 0.4, 0.02], C.shirt, [0, 0.0, td / 2 + 0.006]);
    box(torso, [0.12, 0.4, 0.02], C.shirt, [-tw / 2 + 0.07, 0.0, fz - 0.006], [0, 0, 0.05]);
    box(torso, [0.08, 0.26, 0.02], C.shirt, [tw / 2 - 0.05, 0.07, fz - 0.006], [0, 0, -0.08]);
    for (const [x, h, r] of [[-0.14, 0.17, 0.12], [-0.04, 0.12, -0.08], [0.1, 0.2, 0.1]]) box(torso, [0.08, h, 0.018], C.shirt, [x, -0.25 - h / 2 + 0.06, td / 2 + 0.008], [0, 0, r]);   // sırtta sarkan paçavra
    blood(box(torso, [0.11, 0.15, 0.006], BLOOD, [-tw / 2 + 0.07, -0.05, fz - 0.017]));
  } else {                                                                                                                       // koşucu: yırtık reflektörlü yelek askısı
    box(torso, [0.06, 0.62, 0.018], '#a99632', [0.04, 0.02, fz - 0.016], [0, 0, 0.55]);
    box(torso, [0.06, 0.62, 0.018], '#a99632', [0.04, 0.02, td / 2 + 0.01], [0, 0, 0.55]);
  }
  blood(box(torso, [0.09, 0.1, 0.006], BLOOD, [0.06, 0.2, fz - 0.016]));
  box(torso, [tw * 0.84, 0.045, td * 0.95], '#1d1c18', [0, -0.27, 0]);                                                         // kemer
  // ── türe özgü siluet ──
  if (type === 'brute') {                                                                                                        // Dev: dev kambur, kemik plakalı omuz / sırt, kısa kalın boyun
    skin(box(torso, [0.5, 0.26, 0.2], C.sk, [0, 0.2, td / 2 + 0.06], [-0.3, 0, 0]));
    for (let i = 0; i < 4; i++) bone(box(torso, [0.16 - i * 0.02, 0.09, 0.05], BONE, [(i % 2 ? 0.06 : -0.06), 0.3 - i * 0.11, td / 2 + 0.15 - i * 0.03], [-0.4, 0, (i % 2 ? -0.2 : 0.2)]));
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) bone(box(torso, [0.15 - i * 0.025, 0.045, 0.2 - i * 0.03], i % 2 ? BONED : BONE, [s * (P.sh - 0.03 + i * 0.045), 0.3 - i * 0.045, 0.01], [0, 0, -s * (0.5 + i * 0.25)]));   // katmanlı kemik omuz plakası
      for (let i = 0; i < 3; i++) bone(taperBox(torso, [0.035, 0.12 - i * 0.02, 0.035], BONED, [s * (P.sh + i * 0.03), 0.35 + i * 0.01, -0.06 + i * 0.07], [0.2, 0, -s * (0.4 + i * 0.2)], [0.12, 0.12], [1, 1]));
    }
    skin(taperBox(torso, [tw * 0.7, 0.2, 0.1], C.skd, [0, -0.17, fz - 0.03], null, [1, 1], [0.85, 0.7]));                     // şiş göbek + dikiş
    for (let i = 0; i < 4; i++) box(torso, [0.06, 0.008, 0.012], '#120d0a', [0.02, -0.12 - i * 0.04, fz - 0.082]);
  } else if (type === 'boss') {                                                                                                  // BOSS: kemik zırh, sırt dikenleri, parlayan göğüs yarığı
    for (let i = 0; i < 3; i++) bone(box(torso, [tw * 0.3, 0.07, 0.035], i % 2 ? BONED : BONE, [-tw * 0.24, 0.17 - i * 0.085, fz - 0.026 - i * 0.004], [0, 0.12, 0.08 - i * 0.05]));   // sol göğüste kaburga zırhı
    box(torso, [0.22, 0.27, 0.02], '#140503', [0.08, 0.02, fz - 0.03]);
    const glow = { emissive: '#ff3a0a', emissiveIntensity: 2.6 };
    for (const [x, y, rz, l] of [[0.06, 0.15, 0.55, 0.11], [0.1, 0.07, -0.6, 0.12], [0.06, -0.02, 0.5, 0.11], [0.11, -0.1, -0.45, 0.1], [0.15, 0.02, 1.2, 0.08], [0.0, 0.05, -1.1, 0.07]]) box(torso, [0.026, l, 0.012], '#ffb070', [x, y, fz - 0.05], [0, 0, rz], glow);   // zikzak yarık
    for (let i = 0; i < 6; i++) bone(taperBox(torso, [0.06, 0.24 - Math.abs(i - 2.5) * 0.03, 0.06], i % 2 ? BONE : BONED, [0, 0.27 - i * 0.09, td / 2 + 0.08], [-0.85, 0, 0], [0.12, 0.12], [1, 1]));   // sırt dikenleri
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) bone(box(torso, [0.17 - i * 0.03, 0.05, 0.22 - i * 0.04], i ? BONED : BONE, [s * (P.sh - 0.01 + i * 0.05), 0.31 - i * 0.04, 0], [0, 0, -s * (0.35 + i * 0.3)]));
      for (let i = 0; i < 3; i++) bone(taperBox(torso, [0.05, 0.2 - i * 0.03, 0.05], i ? BONED : BONE, [s * (P.sh + 0.06 + i * 0.03), 0.4, -0.08 + i * 0.08], [0, 0, -s * (0.35 + i * 0.25)], [0.12, 0.12], [1, 1]));
    }
  } else if (type === 'blinker') {                                                                                               // Işınlanan: sırttan / omuzdan fışkıran mor kristaller
    for (const [x, y, z, rx, rz, l] of [[-0.1, 0.18, 0.13, -0.7, 0.4, 0.3], [0.03, 0.22, 0.13, -0.9, -0.1, 0.36], [0.12, 0.1, 0.12, -0.6, -0.5, 0.24], [-0.02, 0.0, 0.12, -0.4, 0.2, 0.18], [-0.24, 0.27, 0.0, 0, 1.0, 0.2], [-0.26, 0.24, 0.06, -0.5, 0.7, 0.15]])
      taperBox(torso, [0.05, l, 0.05], '#c79bff', [x, y, z], [rx, 0, rz], [0.1, 0.1], [1, 1], CRYSTAL);
  } else if (type === 'ghost') {                                                                                                 // Hayalet: kefen gibi uzun paçavralar (yarı saydam)
    const rag = { transparent: true, opacity: 0.55, emissive: '#3a6a7a', emissiveIntensity: 0.3 };
    for (let i = 0; i < 6; i++) box(torso, [0.07, 0.5 + (i % 3) * 0.1, 0.02], '#4a5a62', [-0.2 + i * 0.08, -0.55 - (i % 3) * 0.05, td / 2 + 0.03], [0.12, 0, (i - 2.5) * 0.06], rag);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) box(torso, [0.02, 0.55, 0.07], '#4a5a62', [s * (tw / 2 + 0.01), -0.55, -0.05 + i * 0.1], [0, 0, s * 0.08], rag);
  }
  // ── kafa ──
  const head = new THREE.Group();
  head.position.set(0, type === 'brute' ? 0.39 : 0.43, type === 'brute' ? -0.1 : -0.08);                                    // kafa öne uzanmış (dev: omuzların arasına gömük)
  torso.add(head);
  zHead(head, P, C, T, type);
  if (type === 'boss') {                                                                                                         // boynuzlar: üç boğumlu, dışa-yukarı-geriye kıvrık
    for (const s of [-1, 1]) {
      let x = s * 0.1, y = 0.15, z = 0.0;
      for (let i = 0; i < 4; i++) {
        const w = 0.07 - i * 0.014, l = 0.12 - i * 0.012, a = -s * (0.5 + i * 0.32);
        bone(taperBox(head, [w, l, w], i < 2 ? BONE : '#2a2018', [x, y + l / 2, z], [-0.25 - i * 0.2, 0, a], i === 3 ? [0.1, 0.1] : [0.78, 0.78], [1, 1]));
        x += Math.sin(-a) * l * 0.9; y += Math.cos(a) * l * 0.85; z += 0.03 + i * 0.012;
      }
      bone(taperBox(head, [0.03, 0.07, 0.03], BONE, [s * 0.06, 0.1, -0.13], [-0.6, 0, -s * 0.3], [0.1, 0.1], [1, 1]));         // kaş dikeni
    }
  }
  if (type === 'blinker') for (const [x, y, z, rz, l] of [[0.12, 0.08, 0.03, -0.9, 0.14], [0.11, 0.0, -0.03, -1.3, 0.1], [0.08, 0.14, 0.06, -0.5, 0.12]]) taperBox(head, [0.04, l, 0.04], '#c79bff', [x, y, z], [0, 0, rz], [0.1, 0.1], [1, 1], CRYSTAL);
  // ── bacaklar ──
  const legs = {};
  for (const s of ['L', 'R']) {
    const sign = s === 'R' ? 1 : -1, lw = P.lw;
    const hip = new THREE.Group(); hip.position.set(sign * 0.105, 0.88, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.45, 0);
    const foot = new THREE.Group(); foot.position.set(0, -0.37, 0);
    knee.add(foot); hip.add(knee); root.add(hip);
    const shortP = type === 'runner' || (type === 'walker' && s === 'R');
    taperBox(hip, [lw + 0.03, shortP ? 0.3 : 0.46, lw + 0.06], C.pants, [0, shortP ? -0.15 : -0.225, 0], null, [1, 1], [0.92, 0.92]);
    if (shortP) { skin(taperBox(hip, [lw + 0.005, 0.18, lw + 0.03], C.sk, [0, -0.36, 0], null, [1, 1], [0.85, 0.85])); for (let i = 0; i < 3; i++) box(hip, [0.05, 0.07, 0.02], C.pants, [(i - 1) * 0.05, -0.32, -(lw + 0.06) / 2], [0, 0, (i - 1) * 0.3]); }   // yırtık paça, çıplak diz
    bone(box(hip, [lw * 0.6, 0.06, 0.03], BONED, [0, -0.45, -(lw + 0.05) / 2]));                                               // diz kapağı
    const bare = type !== 'walker' || s === 'L';
    if (type === 'ghost') { skin(taperBox(knee, [lw, 0.43, lw + 0.03], C.skd, [0, -0.205, 0], null, [1, 1], [0.7, 0.75])); }
    else if (bare) { skin(taperBox(knee, [lw, 0.43, lw + 0.03], C.skd, [0, -0.205, 0], null, [1, 1], [0.72, 0.78])); bone(box(knee, [lw * 0.3, 0.3, 0.014], BONED, [0, -0.2, -(lw + 0.03) / 2 - 0.002])); }   // kuru incik kemiği
    else taperBox(knee, [lw + 0.01, 0.43, lw + 0.04], C.pants, [0, -0.205, 0], null, [1, 1], [0.9, 0.9]);
    if (bare) {                                                                                                                  // çıplak ayak: uzun, kemikli, kara tırnaklı parmaklar
      skin(box(foot, [lw * 0.75, 0.08, 0.2], C.skd, [0, -0.02, -0.03]));
      for (let i = 0; i < 4; i++) { skin(box(foot, [0.022, 0.03, 0.05], C.skd, [(i - 1.5) * 0.026, -0.045, -0.15])); bone(box(foot, [0.018, 0.014, 0.018], CLAW, [(i - 1.5) * 0.026, -0.048, -0.18])); }
    } else {
      box(foot, [0.16, 0.11, 0.2], '#1c1a17', [0, 0, 0]); box(foot, [0.16, 0.07, 0.29], '#1c1a17', [0, -0.025, -0.045]);
      box(foot, [0.17, 0.025, 0.3], '#0e0d0c', [0, -0.0475, -0.045]);
    }
    legs[s] = { hip, knee, foot, thigh: hip };
  }
  if (type === 'ghost') for (const s of ['L', 'R']) box(legs[s].hip, [P.lw + 0.07, 0.3, 0.02], '#4a5a62', [0, -0.2, 0.1], null, { transparent: true, opacity: 0.55 });
  legs.L.hip.rotation.x = 0.22; legs.L.knee.rotation.x = -0.18; legs.R.hip.rotation.x = -0.2; legs.R.knee.rotation.x = 0.22;
  const armR = zArm(torso, 'R', P, C, type), armL = zArm(torso, 'L', P, C, type);
  if (type === 'blinker') for (const [y, rz, l] of [[-0.12, 0.6, 0.12], [-0.22, -0.4, 0.09]]) taperBox(armR.fore, [0.035, l, 0.035], '#c79bff', [0.05, y, 0.03], [0, 0, rz], [0.1, 0.1], [1, 1], CRYSTAL);
  return { torso, head, legs, armR, armL, shape: P };
}
