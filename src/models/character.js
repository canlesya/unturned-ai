import * as THREE from 'three';
import { box, taperBox, cylY, ico, V, mergeStatic, mergeVC } from '../core/geo.js';
import { C, TEAMS, SKINS } from '../core/palette.js';
import { createWeapon } from './weapons.js';
import { reloadAnim, meleePose } from '../game/anim.js';
import { ZTYPES, ZBOSS, BOSS } from '../game/stats.js';
import { buildZombie, ZMAT } from './zombieBody.js';
import { ww2Gear, ww2Look } from './ww2gear.js';                       // 12.158: Cephe modu 1940'lar üniformaları
import { buildWear, WEAR_MAT, attachCapeSway } from './wear.js';         // 12.167: karakter v2 + kıyafet kaplamaları
import { wearDecode } from '../game/wearIds.js';

// Unturned/BattleBit tarzı kutu karakter. ~1.79 m boyunda, ileri = -Z.
// Hiyerarşi: root > torso(> head, kollar, silah bağlantısı) + bacaklar. Kollar iki kemikli IK ile silaha kilitlenir.

export const CLASSES = {
  assault: { label: 'Saldırı', weapon: { blue: 'm4a1', red: 'ak47' } },
  medic: { label: 'Sıhhiye', weapon: { blue: 'mp5', red: 'mp5' } },
  sniper: { label: 'Keskin Nişancı', weapon: { blue: 'sniper', red: 'sniper' } },
  heavy: { label: 'Ağır Destek', weapon: { blue: 'lmg', red: 'lmg' } },
  engineer: { label: 'Mühendis', weapon: { blue: 'shotgun', red: 'shotgun' } },
  zombie: { label: 'Zombi', weapon: { blue: 'claws', red: 'claws', zomb: 'claws' } },
};

const L1 = 0.32; // üst kol
const L2 = 0.3; // ön kol (+el)
const TORSO_Y = 1.17;
const SHOULDER_X = 0.3;
const SHOULDER_Y = 0.22;

// ── İki kemikli IK: omuz S, hedef T, dirsek yönü (pole) → dirsek konumu ──
function solveElbow(S, T, pole, l1 = L1, l2 = L2) {
  const dir = T.clone().sub(S);
  let d = dir.length();
  dir.normalize();
  d = THREE.MathUtils.clamp(d, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a)).add(p.multiplyScalar(h));
  const H = S.clone().add(dir.clone().multiplyScalar(d));
  return { E, H };
}

const DOWN = V(0, -1, 0);
function aim(group, from, to) {
  group.position.copy(from);
  group.quaternion.setFromUnitVectors(DOWN, to.clone().sub(from).normalize());
}

function makeArm(torso, side, c) {
  const upper = new THREE.Group();
  const fore = new THREE.Group();
  const hand = new THREE.Group();
  taperBox(upper, [0.14, L1 + 0.01, 0.14], c.shirt, [0, -L1 / 2, 0], null, [1, 1], [0.88, 0.88]);
  taperBox(fore, [0.125, L2 + 0.01, 0.125], c.shirt, [0, -L2 / 2, 0], null, [1, 1], [0.86, 0.86]);
  box(fore, [0.13, 0.05, 0.13], c.gloves, [0, -L2 + 0.045, 0]);        // bilek bandı
  if (!c.ww2) box(fore, [0.1, 0.09, 0.05], '#1b1c20', [0, -0.03, 0.075]);           // dirsek koruyucu (1940'lar üniformasında yok)
  if (!c.ww2) box(upper, [0.01, 0.075, 0.07], side === 'L' ? c.accent : '#d8d8d2', [side === 'R' ? 0.075 : -0.075, -0.1, 0]);   // omuz yaması
  else if (side === 'L') box(upper, [0.152, 0.06, 0.152], c.accent, [0, -0.11, 0]);                                     // 12.158: takım kol bandı (nişansız)
  box(upper, [0.152, 0.025, 0.152], new THREE.Color(c.shirt).multiplyScalar(0.78).getStyle(), [0, -L1 + 0.04, 0]);   // kol kıvrımı
  box(hand, [0.1, 0.11, 0.115], c.gloves, [0, -0.05, 0.0]);             // eldiven
  box(hand, [0.085, 0.03, 0.04], c.gloves, [0, -0.1, -0.03]);           // parmak ucu
  for (let i = 0; i < 4; i++) box(hand, [0.02, 0.05, 0.02], c.gloves, [-0.036 + i * 0.024, -0.105, -0.045]);   // parmaklar
  box(hand, [0.03, 0.045, 0.026], c.gloves, [side === 'R' ? -0.06 : 0.06, -0.07, -0.02], [0, 0, side === 'R' ? 0.35 : -0.35]);   // başparmak
  if (!c.ww2) box(hand, [0.102, 0.03, 0.117], '#15161a', [0, -0.02, 0.0]);           // el sırtı koruması
  torso.add(upper, fore, hand);
  return { upper, fore, hand, side, shoulder: V(side === 'R' ? SHOULDER_X : -SHOULDER_X, SHOULDER_Y, 0) };
}

function poseArm(arm, target) {
  const pole = arm.side === 'R' ? V(0.55, -1, 0.35) : V(-0.55, -1, 0.35);
  const { E, H } = solveElbow(arm.shoulder, target, pole, arm.l1, arm.l2);           // zombi kolu daha uzun (l1 / l2)
  aim(arm.upper, arm.shoulder, E);
  aim(arm.fore, E, H);
  arm.hand.position.copy(H);
  arm.hand.quaternion.copy(arm.fore.quaternion);
}

// ── Sınıf teçhizatı ──
function face(head, skin, o = {}) {
  const dark = new THREE.Color(skin).multiplyScalar(0.82).getStyle();
  const hair = o.hair || '#3a2a1c';
  box(head, [0.3, 0.3, 0.3], skin);
  box(head, [0.04, 0.05, 0.03], dark, [0, -0.025, -0.16]);                       // burun
  box(head, [0.02, 0.07, 0.04], dark, [0.16, -0.01, 0.0]);                      // kulaklar
  box(head, [0.02, 0.07, 0.04], dark, [-0.16, -0.01, 0.0]);
  box(head, [0.05, 0.04, 0.012], '#16161a', [0.075, 0.02, -0.152]);             // gözler
  box(head, [0.05, 0.04, 0.012], '#16161a', [-0.075, 0.02, -0.152]);
  box(head, [0.07, 0.014, 0.012], hair, [0.075, 0.062, -0.152]);                // kaşlar
  box(head, [0.07, 0.014, 0.012], hair, [-0.075, 0.062, -0.152]);
  box(head, [0.075, 0.014, 0.012], '#7a3b30', [0, -0.085, -0.152]);             // ağız
  if (!o.noHair) {
    box(head, [0.31, 0.07, 0.31], hair, [0, 0.14, 0.01]);
    box(head, [0.31, 0.16, 0.06], hair, [0, 0.07, 0.135]);
  }
}

function combatHelmet(head, color, accent) {
  taperBox(head, [0.35, 0.17, 0.36], color, [0, 0.12, 0.0], null, [0.86, 0.9], [1, 1]);
  box(head, [0.36, 0.03, 0.37], C.black, [0, 0.04, 0.0]);
  box(head, [0.09, 0.05, 0.04], C.black, [0, 0.11, -0.19]);
  box(head, [0.1, 0.05, 0.012], accent, [0, 0.16, -0.18]);
  box(head, [0.02, 0.13, 0.02], C.black, [0.166, -0.04, -0.07]);                // çene kayışı
  box(head, [0.02, 0.13, 0.02], C.black, [-0.166, -0.04, -0.07]);
  box(head, [0.06, 0.05, 0.1], C.black, [0.186, 0.08, 0.0]);                    // yan ray
  box(head, [0.06, 0.05, 0.1], C.black, [-0.186, 0.08, 0.0]);
}

function goggles(head, lens = '#0c0d10') {
  box(head, [0.32, 0.04, 0.32], C.black, [0, 0.035, 0.0]);
  box(head, [0.11, 0.05, 0.014], lens, [0.07, 0.035, -0.162], null, { metalness: 0.5, roughness: 0.2 });
  box(head, [0.11, 0.05, 0.014], lens, [-0.07, 0.035, -0.162], null, { metalness: 0.5, roughness: 0.2 });
  box(head, [0.03, 0.02, 0.014], C.black, [0, 0.04, -0.162]);
}

function backpack(torso, w, h, d, color, y = 0.0, z = 0.13 + d / 2) {
  box(torso, [w, h, d], color, [0, y, z]);
  box(torso, [w * 0.86, h * 0.8, 0.03], new THREE.Color(color).multiplyScalar(0.8).getStyle(), [0, y - 0.02, z + d / 2 + 0.012]);
}

function pouches(torso, vestColor, n = 3, color = '#2c2e33') {
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.13;
    box(torso, [0.11, 0.13, 0.05], color, [x, -0.07, -0.18]);
    box(torso, [0.11, 0.025, 0.056], vestColor, [x, -0.015, -0.18]);
  }
}

// ── Paintball kıyafeti (mod pb): kişisel boya renginde dolgulu forma + kontrast paneller + numara, tam yüz maskesi (lens + havalandırma),
// dizlikli pantolon, dolgulu eldiven, belde bölmeli top kabı (pod pack). Vuruş kutuları değişmez (mantık modelden bağımsız).
const lum = (h) => { const k = new THREE.Color(h); return 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b; };
// renk takımı: forma = boya rengi, panel = açık renkte koyu / koyu renkte beyaz, pantolon / eldiven koyu (birinci şahıs kolu da bunu kullanır)
export function pbLook(col) {
  const light = lum(col) > 0.5, k = new THREE.Color(col);
  return { shirt: col, pants: '#272a31', vest: '#1c1e23', helmet: '#1c1e23', gloves: '#1f2126', boots: '#17171a', accent: light ? '#1c1e23' : '#f1f1ec',
    panel: light ? '#22252b' : '#f1f1ec', dark: '#' + k.clone().multiplyScalar(0.62).getHexString(), lens: light ? '#2b3d55' : '#3a2f52', pod: '#' + k.clone().lerp(new THREE.Color('#ffffff'), 0.45).getHexString() };
}
// 7 parçalı rakam (kutu): a üst, b sağ üst, c sağ alt, d alt, e sol alt, f sol üst, g orta
const SEG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
function digits(p, n, col, x0, y0, z, h = 0.11, front = false) {      // front: önden bakana göre aynalanır (ileri = −Z)
  const str = String(n), w = h * 0.55, t = h * 0.16, gap = w + h * 0.22, sx = front ? -1 : 1;
  [...str].forEach((ch, i) => {
    const cx = x0 + sx * (i - (str.length - 1) / 2) * gap, S = SEG[+ch] || '';
    const H = (y) => box(p, [w, t, 0.008], col, [cx, y0 + y, z]), Vt = (x, y) => box(p, [t, h / 2, 0.008], col, [cx + sx * x, y0 + y, z]);
    if (S.includes('a')) H(h / 2); if (S.includes('g')) H(0); if (S.includes('d')) H(-h / 2);
    if (S.includes('b')) Vt(w / 2 - t / 2, h / 4); if (S.includes('c')) Vt(w / 2 - t / 2, -h / 4);
    if (S.includes('f')) Vt(-w / 2 + t / 2, h / 4); if (S.includes('e')) Vt(-w / 2 + t / 2, -h / 4);
  });
}
function paintballGear(parts, c, skin, num) {
  const { torso, head, legs } = parts, col = c.shirt, P = c.panel, D = '#1c1e23';
  // forma: bol, dolgulu gövde (forma rengi) + omuz boyunduruğu / yan paneller / etek bandı kontrast renkte, yaka koyu
  box(torso, [0.5, 0.47, 0.3], col, [0, 0.035, 0]);
  box(torso, [0.506, 0.085, 0.306], P, [0, 0.235, 0]);
  for (const sx of [-1, 1]) {
    box(torso, [0.012, 0.38, 0.2], P, [sx * 0.253, 0.0, 0]);
    box(torso, [0.18, 0.1, 0.19], col, [sx * SHOULDER_X, SHOULDER_Y + 0.05, 0]);              // dolgulu omuz
    box(torso, [0.182, 0.03, 0.192], P, [sx * SHOULDER_X, SHOULDER_Y + 0.105, 0]);
    for (let i = 0; i < 2; i++) box(torso, [0.2, 0.012, 0.012], c.dark, [sx * 0.13, 0.12 - i * 0.12, -0.152]);   // dolgu dikişleri
  }
  box(torso, [0.506, 0.05, 0.306], P, [0, -0.17, 0]);
  box(torso, [0.2, 0.045, 0.2], D, [0, 0.31, 0]);
  digits(torso, num, P, 0, 0.06, -0.156, 0.1, true);                                                    // göğüs numarası
  digits(torso, num, P, 0, 0.08, 0.156, 0.16);                                              // sırt numarası (iri)
  // bel kemeri + bölmeli top kabı (sırtta 4 top tüpü, kapaklar koyu) + göğüs çapraz askısı
  box(torso, [0.49, 0.07, 0.32], D, [0, -0.25, 0]);
  box(torso, [0.08, 0.05, 0.02], '#9aa0a6', [0, -0.25, -0.165]);
  box(torso, [0.36, 0.12, 0.06], D, [0, -0.26, 0.19]);
  for (let i = 0; i < 4; i++) {
    const x = -0.12 + i * 0.08;
    cylY(torso, 0.034, 0.034, 0.2, c.pod, [x, -0.2, 0.225], 8);                                    // yarı saydam görünümlü tüp (içindeki boya renginde, açık)
    box(torso, [0.012, 0.15, 0.012], '#ffffff', [x - 0.016, -0.2, 0.256]);                          // tüp parlaması
    cylY(torso, 0.038, 0.038, 0.035, '#15161a', [x, -0.085, 0.225], 8);                             // kapak
  }
  box(torso, [0.06, 0.012, 0.36], D, [0.15, 0.0, 0.0], [0.7, 0, 0]);                              // askı (omuzdan bele)
  // pantolon: dışta boya renkli şerit, kalın dizlik (renk çizgili), bilekte koyu manşet
  box(torso, [0.42, 0.11, 0.26], c.pants, [0, -0.33, 0]);
  for (const s of ['L', 'R']) {
    const sx = s === 'R' ? 1 : -1, th = legs[s].thigh, kn = legs[s].knee, ft = legs[s].foot;
    box(th, [0.012, 0.36, 0.07], col, [sx * 0.092, -0.22, 0]);
    box(th, [0.17, 0.1, 0.07], D, [0, -0.43, -0.095]);
    box(kn, [0.17, 0.12, 0.07], D, [0, -0.04, -0.09]);
    box(kn, [0.172, 0.022, 0.074], col, [0, -0.02, -0.09]);
    box(kn, [0.168, 0.05, 0.2], D, [0, -0.33, 0]);
    box(ft, [0.175, 0.03, 0.31], '#e8e8e2', [0, -0.05, -0.045]);                                    // spor ayakkabı tabanı
    box(ft, [0.06, 0.012, 0.12], col, [sx * 0.088, 0.0, -0.05]);
  }
  // tam yüz maske: kafa bandı, geniş lens (koyu yansıtıcı), kulak koruması, havalandırmalı çene parçası, üstte siperlik; boya renkli şerit
  face(head, skin, { noHair: false });
  box(head, [0.322, 0.05, 0.322], D, [0, 0.04, 0.0]);
  box(head, [0.33, 0.12, 0.05], D, [0, 0.03, -0.165]);
  box(head, [0.28, 0.085, 0.012], c.lens, [0, 0.033, -0.195], null, { metalness: 0.6, roughness: 0.15 });
  box(head, [0.12, 0.016, 0.006], '#c9d6e6', [-0.07, 0.058, -0.2], null, { metalness: 0.6, roughness: 0.15 });     // lens parlaması
  taperBox(head, [0.27, 0.16, 0.09], D, [0, -0.085, -0.165], null, [1, 1], [0.7, 0.8]);
  for (let i = 0; i < 3; i++) box(head, [0.13 - i * 0.025, 0.012, 0.012], '#050506', [0, -0.06 - i * 0.032, -0.209]);   // havalandırma yarıkları
  for (const sx of [-1, 1]) {
    box(head, [0.045, 0.15, 0.13], D, [sx * 0.17, -0.02, -0.08]);
    box(head, [0.012, 0.06, 0.06], col, [sx * 0.193, -0.02, -0.08]);
    for (let i = 0; i < 2; i++) box(head, [0.008, 0.012, 0.05], '#050506', [sx * 0.193, -0.08 - i * 0.025, -0.11]);
  }
  box(head, [0.3, 0.022, 0.08], D, [0, 0.1, -0.2], [-0.15, 0, 0]);                                // siperlik
  box(head, [0.09, 0.03, 0.012], col, [0, -0.13, -0.19]);                                           // çene şeridi
}

// ── 12.157 Uzay kıyafeti (mod space): kırık beyaz basınçlı kıyafet + takım rengi paneller (omuz, göğüs, uyluk bandı, kask şeridi, sırt ışığı),
// alçak poligon kask (kürecik kabuk) + koyu altın yansıtıcı vizör + ışıyan vizör kenarı, sırtta yaşam destek ünitesi + iki oksijen tankı, kalın eklem halkaları, ay botları.
// Vuruş kutuları değişmez (mantık modelden bağımsız). Birinci şahıs kolu / eldiveni spaceLook ile (player.js vm.look).
export const SPACE_TEAM = { blue: '#2f6fd6', red: '#d0443a' };
export function spaceLook(team) {
  const tc = SPACE_TEAM[team] || '#8a8f96';
  return { shirt: '#dedcd5', pants: '#d4d2ca', vest: '#2b2f35', helmet: '#e4e2db', gloves: new THREE.Color(tc).multiplyScalar(0.62).getStyle(), boots: '#3a3d42', accent: tc, team: tc, cuff: '#2b2f35' };
}
function spaceGear(parts, c, cls) {
  const { torso, head, legs } = parts, T = c.team, D = '#2b2f35', SH = '#c4c2ba', W = '#e4e2db';
  const glow = { emissive: T, emissiveIntensity: 1.3 };
  // gövde: göğüs paneli (takım), kumanda kutusu + ışıklar, bel kemeri, boyun bileziği
  for (const sx of [-1, 1]) box(torso, [0.13, 0.17, 0.02], T, [sx * 0.125, 0.13, -0.14]);
  box(torso, [0.2, 0.13, 0.06], D, [0, -0.06, -0.15]);
  box(torso, [0.03, 0.03, 0.01], T, [-0.06, -0.04, -0.185], null, glow);
  box(torso, [0.03, 0.03, 0.01], '#58d68d', [0, -0.04, -0.185]);                                  // kumanda ışıkları (düz renk: asker başına ek çizim çağrısı olmasın)
  box(torso, [0.03, 0.03, 0.01], '#f0b443', [0.06, -0.04, -0.185]);
  box(torso, [0.48, 0.08, 0.28], D, [0, -0.25, 0]);
  box(torso, [0.08, 0.05, 0.02], '#9aa3ad', [0, -0.25, -0.145]);
  cylY(torso, 0.16, 0.17, 0.07, D, [0, 0.31, 0], 10);
  // omuz yastıkları (takım rengi, kalın) + kol bandı
  const heavy = cls === 'heavy';
  for (const sx of [-1, 1]) {
    box(torso, [heavy ? 0.27 : 0.24, heavy ? 0.13 : 0.12, heavy ? 0.29 : 0.26], T, [sx * (SHOULDER_X + 0.015), SHOULDER_Y + 0.06, 0]);      // 12.157 v2: geniş takım rengi omuz (30–40 m'de okunur)
    box(torso, [heavy ? 0.275 : 0.245, 0.025, heavy ? 0.295 : 0.265], D, [sx * (SHOULDER_X + 0.015), SHOULDER_Y + (heavy ? 0.135 : 0.125), 0]);
  }
  if (heavy) { box(torso, [0.42, 0.34, 0.06], new THREE.Color(T).multiplyScalar(0.55).getStyle(), [0, 0.08, -0.17]); box(torso, [0.2, 0.06, 0.065], D, [0, -0.05, -0.18]); }
  // sırt: yaşam destek ünitesi + iki oksijen tankı (kapaklı) + hortumlar + takım rengi ışık şeridi
  box(torso, heavy ? [0.42, 0.5, 0.18] : [0.38, 0.46, 0.16], T, [0, 0.04, heavy ? 0.22 : 0.21]);                                   // sırt ünitesi takım renginde
  box(torso, heavy ? [0.43, 0.06, 0.185] : [0.39, 0.06, 0.165], W, [0, -0.17, heavy ? 0.22 : 0.21]);
  box(torso, [0.3, 0.035, 0.012], T, [0, 0.2, heavy ? 0.316 : 0.296], null, glow);
  for (const sx of [-1, 1]) {
    cylY(torso, 0.06, 0.06, 0.36, '#aeb3b9', [sx * 0.1, 0.06, heavy ? 0.355 : 0.335], 8);
    cylY(torso, 0.064, 0.064, 0.05, sx < 0 ? '#e07a2a' : D, [sx * 0.1, 0.26, heavy ? 0.355 : 0.335], 10);
    box(torso, [0.025, 0.025, 0.2], D, [sx * 0.17, 0.27, 0.1], [0.5, 0, 0]);                 // hortum (tanktan kaska)
  }
  if (cls === 'medic') { box(torso, [0.15, 0.15, 0.008], W, [0, -0.06, heavy ? 0.314 : 0.294]); for (const [w, h] of [[0.12, 0.035], [0.035, 0.12]]) box(torso, [w, h, 0.012], '#d23a2e', [0, -0.06, heavy ? 0.316 : 0.296]); }
  if (cls === 'engineer') { box(torso, [0.14, 0.11, 0.07], '#e07a2a', [0.19, -0.2, -0.12]); box(torso, [0.16, 0.02, 0.075], D, [0.19, -0.14, -0.12]); }
  // bacaklar: uyluk bandı (takım), kalın diz halkası, ay botu
  for (const s of ['L', 'R']) {
    const th = legs[s].thigh, kn = legs[s].knee, ft = legs[s].foot;
    box(th, [0.19, 0.05, 0.22], T, [0, -0.13, 0]);
    box(th, [0.2, 0.08, 0.23], D, [0, -0.44, 0]);
    if (cls === 'engineer') box(th, [0.012, 0.3, 0.07], '#e07a2a', [(s === 'R' ? 1 : -1) * 0.096, -0.25, 0]);
    box(kn, [0.18, 0.06, 0.21], D, [0, -0.3, 0]);
    box(ft, [0.2, 0.17, 0.24], '#cfcdc6', [0, 0.02, 0.0]);
    box(ft, [0.2, 0.09, 0.33], '#cfcdc6', [0, -0.03, -0.045]);
    box(ft, [0.205, 0.035, 0.335], D, [0, -0.08, -0.045]);
  }
  // kask: alçak poligon kabuk + koyu altın vizör (yansıtıcı) + ışıyan vizör kenarı + takım şeridi; sınıfa göre anten / dürbün / lamba
  ico(head, 0.215, W, [0, 0.015, 0.01], 1, [1, 0.97, 1.03]);
  ico(head, 0.19, new THREE.Color(T).multiplyScalar(0.25).getStyle(), [0, 0.0, -0.075], 1, [0.95, 0.66, 0.62], { metalness: 0.7, roughness: 0.14, emissive: T, emissiveIntensity: 0.85 });      // parlayan vizör (takım renginde hafif ışıma)
  box(head, [0.26, 0.018, 0.04], T, [0, 0.105, -0.165], [-0.35, 0, 0], glow);
  box(head, [0.17, 0.035, 0.2], T, [0, 0.222, 0.01]); box(head, [0.17, 0.035, 0.13], T, [0, 0.18, -0.14], [-0.65, 0, 0]); box(head, [0.17, 0.035, 0.13], T, [0, 0.18, 0.16], [0.65, 0, 0]);      // geniş takım rengi kask şeridi (kubbeyi izleyen üç parça)
  for (const sx of [-1, 1]) box(head, [0.05, 0.1, 0.12], D, [sx * 0.2, 0.0, 0.03]);           // kulak modülleri
  if (cls === 'sniper') { box(head, [0.05, 0.06, 0.14], D, [0.235, 0.05, -0.04]); box(head, [0.012, 0.36, 0.012], D, [-0.2, 0.25, 0.08]); }
  else if (cls === 'engineer') { box(head, [0.08, 0.05, 0.06], D, [0.17, 0.1, -0.12]); box(head, [0.05, 0.035, 0.01], '#fff4d6', [0.17, 0.1, -0.152]); }
  else if (cls === 'medic') for (const [w, h] of [[0.08, 0.025], [0.025, 0.08]]) box(head, [0.012, h, w], '#d23a2e', [-0.218, 0.07, 0.03]);
  else box(head, [0.012, 0.18, 0.012], D, [-0.19, 0.2, 0.08]);
}

function addGear(cls, team, c, parts, skin, ztype, look) {
  if (look?.ww2) { ww2Gear(parts, c, team, cls, skin, face); return; }                                 // 12.158: Cephe modu üniforması
  if (look?.space) { spaceGear(parts, c, cls); return; }
  if (look) { paintballGear(parts, c, skin, look.num); return; }
  const { torso, head, legs } = parts;
  // ortak: yelek + kemer + omuz kayışları
  box(torso, [0.5, 0.42, 0.3], c.vest, [0, 0.07, 0]);
  box(torso, [0.1, 0.14, 0.31], c.vest, [0.16, 0.26, 0]);                       // omuz kayışı
  box(torso, [0.1, 0.14, 0.31], c.vest, [-0.16, 0.26, 0]);
  box(torso, [0.47, 0.07, 0.28], C.black, [0, -0.26, 0]);
  box(torso, [0.07, 0.05, 0.02], C.chrome, [0, -0.26, -0.145], null, { metalness: 0.5 });
  // sol kol bandı (takım rengi)
  box(torso, [0.15, 0.08, 0.15], c.accent, [-SHOULDER_X, SHOULDER_Y - 0.14, 0]);
  // omuz başı, boyun bandı, kemer cepleri, telsiz
  for (const sx of [-1, 1]) box(torso, [0.17, 0.09, 0.17], c.shirt, [sx * SHOULDER_X, SHOULDER_Y + 0.045, 0]);
  box(torso, [0.17, 0.05, 0.17], c.vest, [0, 0.33, 0.0]);                          // yaka
  box(torso, [0.4, 0.32, 0.03], new THREE.Color(c.vest).multiplyScalar(0.82).getStyle(), [0, 0.1, -0.162]);   // plaka cebi
  for (let i = 0; i < 3; i++) box(torso, [0.42, 0.012, 0.036], '#15161a', [0, 0.2 - i * 0.07, -0.165]);   // MOLLE bantları
  for (const sx of [-1, 1]) {
    box(torso, [0.09, 0.1, 0.06], '#23252a', [sx * 0.2, -0.2, -0.12]);               // kemer cebi
    box(torso, [0.09, 0.02, 0.066], c.vest, [sx * 0.2, -0.15, -0.12]);
    box(torso, [0.02, 0.1, 0.012], '#15161a', [sx * 0.2, 0.0, -0.18]);               // göğüs kayışı tokası
  }
  box(torso, [0.05, 0.1, 0.035], C.black, [-0.17, 0.2, -0.178]);                   // telsiz
  box(torso, [0.008, 0.12, 0.008], C.black, [-0.17, 0.31, -0.17]);                 // anten
  box(torso, [0.46, 0.04, 0.27], new THREE.Color(c.pants).multiplyScalar(0.9).getStyle(), [0, -0.3, 0]);   // pantolon kemeri
  // sol uyluk cebi + bot ayrıntıları
  box(legs.L.thigh, [0.04, 0.14, 0.13], new THREE.Color(c.pants).multiplyScalar(0.85).getStyle(), [-0.1, -0.2, 0.0]);
  box(legs.L.thigh, [0.042, 0.03, 0.134], '#15161a', [-0.1, -0.13, 0.0]);
  for (const s of ['L', 'R']) {
    const ft = legs[s].foot;
    box(ft, [0.175, 0.025, 0.205], '#101012', [0, -0.0475, 0.0]);                    // taban
    box(ft, [0.175, 0.025, 0.31], '#101012', [0, -0.0475, -0.045]);
    box(ft, [0.18, 0.035, 0.21], new THREE.Color(c.boots).multiplyScalar(1.35).getStyle(), [0, 0.065, 0.0]);   // bot manşeti
    box(ft, [0.07, 0.014, 0.11], '#cfcabd', [0, 0.012, -0.085]);                      // bağcık
    for (let i = 0; i < 3; i++) box(ft, [0.09, 0.006, 0.01], '#101012', [0, 0.02, -0.06 - i * 0.03]);
  }
  // tabanca kılıfı (sağ uyluk)
  box(legs.R.thigh, [0.06, 0.15, 0.11], C.black, [0.1, -0.2, -0.01]);
  box(legs.R.thigh, [0.04, 0.05, 0.1], C.gun, [0.1, -0.11, -0.01]);
  // diz koruyucu
  for (const s of ['L', 'R']) box(legs[s].thigh, [0.14, 0.09, 0.05], C.black, [0, -0.45, -0.1]);

  if (cls === 'assault') {
    pouches(torso, c.vest, 3);
    face(head, skin);
    combatHelmet(head, c.helmet, c.accent);
    goggles(head);
    box(head, [0.05, 0.045, 0.035], C.black, [0, 0.2, -0.195]);                      // gece görüş tutucu
    box(head, [0.022, 0.08, 0.075], C.black, [-0.186, -0.01, 0.0]);                   // kulaklık
    box(head, [0.01, 0.01, 0.1], C.black, [-0.17, -0.07, -0.1]);                       // mikrofon kolu
    box(head, [0.025, 0.02, 0.02], C.black, [-0.17, -0.075, -0.155]);
    backpack(torso, 0.34, 0.38, 0.16, C.oliveDark, 0.0);
    cylY(torso, 0.07, 0.07, 0.34, '#6b6a52', [0, 0.23, 0.24], 8, [0, 0, Math.PI / 2]); // uyku tulumu
    ico(torso, 0.04, C.olive, [-0.2, -0.1, -0.2], 1, [1, 1.2, 1]);                     // el bombası
  } else if (cls === 'medic') {
    pouches(torso, c.vest, 2, C.white);
    face(head, skin);
    combatHelmet(head, '#e8e8e2', C.red);
    box(head, [0.07, 0.02, 0.012], C.red, [0, 0.12, -0.184]);
    box(head, [0.02, 0.07, 0.012], C.red, [0, 0.12, -0.184]);
    backpack(torso, 0.36, 0.42, 0.18, C.white, 0.0);
    box(torso, [0.15, 0.04, 0.01], C.red, [0, 0.02, 0.33]);                           // sırtta kızıl haç
    box(torso, [0.04, 0.15, 0.01], C.red, [0, 0.02, 0.33]);
    box(torso, [0.1, 0.12, 0.05], C.white, [0.17, 0.2, -0.18]);                        // göğüs ilk yardım cebi
    box(torso, [0.06, 0.016, 0.006], C.red, [0.17, 0.2, -0.208]);
    box(torso, [0.016, 0.06, 0.006], C.red, [0.17, 0.2, -0.208]);
  } else if (cls === 'sniper') {
    pouches(torso, c.vest, 2, C.oliveDark);
    face(head, skin, { noHair: true });
    // bonny şapka + yüz eşarbı
    cylY(head, 0.27, 0.27, 0.025, C.olive, [0, 0.14, 0], 8);
    cylY(head, 0.17, 0.2, 0.11, C.olive, [0, 0.2, 0], 8);
    box(head, [0.31, 0.12, 0.31], C.tan, [0, -0.085, 0.0]);
    box(head, [0.32, 0.03, 0.02], C.oliveDark, [0, 0.12, -0.16]);
    for (let i = 0; i < 7; i++) {                                                     // gili bitki parçaları
      const a = (i / 7) * Math.PI * 2;
      box(head, [0.07, 0.025, 0.05], i % 2 ? C.oliveDark : '#6d7a4a', [Math.cos(a) * 0.2, 0.17, Math.sin(a) * 0.2], [0, -a, 0.2]);
    }
    for (const s of [-1, 1]) {
      box(torso, [0.16, 0.05, 0.2], C.oliveDark, [s * 0.32, 0.31, 0.0], [0, 0, s * 0.15]);
      box(torso, [0.1, 0.035, 0.12], '#6d7a4a', [s * 0.33, 0.34, 0.03], [0, 0.3, s * 0.15]);
    }
    backpack(torso, 0.3, 0.34, 0.14, C.oliveDark, 0.0);
    cylY(torso, 0.06, 0.06, 0.3, C.tan, [0, -0.22, 0.25], 8, [0, 0, Math.PI / 2]);
  } else if (cls === 'heavy') {
    // büyük göğüs plakası, omuzluk, mermi kuşağı
    box(torso, [0.46, 0.4, 0.07], C.gun, [0, 0.07, -0.19], null, { metalness: 0.3 });
    box(torso, [0.3, 0.1, 0.075], C.black, [0, -0.1, -0.2]);
    pouches(torso, c.vest, 3, C.black);
    for (const s of [-1, 1]) {
      box(torso, [0.22, 0.09, 0.26], C.gun, [s * 0.31, 0.3, 0.0], [0, 0, s * 0.12], { metalness: 0.3 });
      box(torso, [0.22, 0.04, 0.27], c.accent, [s * 0.31, 0.34, 0.0], [0, 0, s * 0.12]);
    }
    for (let i = 0; i < 7; i++) {                                                     // çapraz mermi kuşağı
      const t = i / 6;
      box(torso, [0.045, 0.06, 0.03], C.brass, [-0.2 + t * 0.4, 0.2 - t * 0.36, -0.235], [0, 0, 0.8], { metalness: 0.5 });
    }
    face(head, skin, { noHair: true });
    // ağır kask + vizör
    taperBox(head, [0.37, 0.2, 0.38], '#3a3d42', [0, 0.11, 0.0], null, [0.9, 0.92], [1, 1]);
    box(head, [0.36, 0.1, 0.03], '#0e1419', [0, 0.04, -0.185], null, { metalness: 0.6, roughness: 0.15 });
    box(head, [0.31, 0.1, 0.04], '#2a2d31', [0, -0.12, -0.17]);                     // çene siperi
    box(head, [0.1, 0.03, 0.012], c.accent, [0, 0.19, -0.185]);
    backpack(torso, 0.4, 0.46, 0.2, C.black, 0.0);
    box(torso, [0.2, 0.22, 0.12], C.olive, [0.28, -0.1, 0.22]);
  } else if (cls === 'engineer') {
    pouches(torso, c.vest, 3, '#3a332a');
    box(torso, [0.5, 0.08, 0.31], '#e0762b', [0, 0.2, 0.0]);                        // turuncu yelek şeridi
    face(head, skin);
    // sarı baret
    cylY(head, 0.17, 0.2, 0.15, C.yellow, [0, 0.17, 0.0], 8);
    box(head, [0.34, 0.025, 0.14], C.yellow, [0, 0.1, -0.2]);
    box(head, [0.04, 0.04, 0.34], '#caa01a', [0, 0.25, 0.0]);
    goggles(head, '#7ec8e8');
    // alet çantası sırt çantası + İngiliz anahtarı
    backpack(torso, 0.36, 0.3, 0.16, '#b3331f', 0.0);
    box(torso, [0.2, 0.025, 0.03], C.black, [0, 0.19, 0.32]);
    box(torso, [0.025, 0.5, 0.03], C.chrome, [0.15, 0.1, 0.33], [0, 0, 0.12], { metalness: 0.6 });
    box(torso, [0.07, 0.05, 0.035], C.chrome, [0.18, 0.36, 0.33], [0, 0, 0.12], { metalness: 0.6 });
    box(torso, [0.1, 0.1, 0.05], C.yellow, [-0.17, 0.2, -0.18]);                    // çekiç cebi
  }
}

// ── Karakter oluşturucu ──
// outfit 'paintball' + paint (renk) + num (forma numarası): paintball oyuncusu görünümü (sınıf teçhizatı yerine)
export function createCharacter({ team = 'blue', cls = 'assault', skinIndex = 0, weapon = null, blade = 0.38, optic = 'reddot', ztype = 'walker', outfit = null, paint = '#ff2b3a', num = 7, wskin = 'std', wear = null, body = 'A' } = {}) {
  const look = outfit === 'paintball' && cls !== 'zombie' ? { num } : outfit === 'space' && cls !== 'zombie' ? { space: true } : outfit === 'ww2' && cls !== 'zombie' ? { ww2: true } : null;      // 12.157: Uzay kıyafeti · 12.158: 1940'lar üniforması
  const c = look?.space ? { ...TEAMS[team], ...spaceLook(team) } : look?.ww2 ? { ...TEAMS[team], ...ww2Look(team) } : look ? { ...TEAMS[team], ...pbLook(paint) } : TEAMS[team];
  const skin = SKINS[skinIndex % SKINS.length];
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';   // önce yön (yaw), sonra gövde eğimi/yatma: baktığı yöne göre devrilir

  if (cls === 'zombie') return createZombie({ root, team, skinIndex, weapon, ztype });
  // 12.167: v2 gövde + kıyafet kaplaması (wear: kombin nesnesi ya da 10 haneli kod; yoksa sınıf varsayılanı). Uzay / Cephe / paintball kendi kostümünü kullanır;
  // body 'old' = 12.166 öncesi kutu model (yalnız karşılaştırma sayfası)
  const wearOn = !look && body !== 'old';
  let torso, head, legs, armR, armL, wearOut = null, cape = false;
  if (wearOn) ({ torso, head, legs, armR, armL, wear: wearOut, cape } = buildWear(root, { team, cls, c, skin, wear: typeof wear === 'string' || !wear ? wearDecode(wear, cls) : wear, style: body }));
  else {
    // gövde
    torso = new THREE.Group();
    torso.position.set(0, TORSO_Y, 0);
    root.add(torso);
    box(torso, [0.46, 0.58, 0.26], c.shirt);
    taperBox(torso, [0.4, 0.1, 0.24], c.pants, [0, -0.33, 0], null, [1, 1], [1, 1]); // leğen

    head = new THREE.Group();
    head.position.set(0, 0.29 + 0.03 + 0.15, 0);
    torso.add(head);
    box(torso, [0.13, 0.07, 0.13], skin, [0, 0.31, 0]);                              // boyun

    // bacaklar
    legs = {};
    for (const s of ['L', 'R']) {
      const sign = s === 'R' ? 1 : -1;
      const hip = new THREE.Group();
      hip.position.set(sign * 0.105, 0.88, 0);
      const knee = new THREE.Group();
      knee.position.set(0, -0.45, 0);
      taperBox(hip, [0.18, 0.46, 0.21], c.pants, [0, -0.225, 0], null, [1, 1], [0.9, 0.9]);
      taperBox(knee, [0.16, 0.43, 0.19], c.pants, [0, -0.205, 0], null, [1, 1], [0.92, 0.92]);
      const foot = new THREE.Group();                                                  // ayak: diz çerçevesinde bilek noktası; animasyon yere paralel tutar
      foot.position.set(0, -0.37, 0);
      knee.add(foot);
      box(foot, [0.17, 0.12, 0.2], c.boots, [0, 0, 0]);                                 // bot gövdesi
      box(foot, [0.17, 0.07, 0.3], c.boots, [0, -0.025, -0.045]);                      // bot burnu
      hip.add(knee);
      root.add(hip);
      legs[s] = { hip, knee, foot, thigh: hip };
    }
    // duruş (sol bacak ileride)
    legs.L.hip.rotation.x = 0.22;
    legs.L.knee.rotation.x = -0.18;
    legs.R.hip.rotation.x = -0.2;
    legs.R.knee.rotation.x = 0.22;

    const parts = { torso, head, legs };
    addGear(cls, team, c, parts, skin, ztype, look);
    armR = makeArm(torso, 'R', c);
    armL = makeArm(torso, 'L', c);
  }
  // silah bağlantıları
  const mount = new THREE.Group();
  torso.add(mount);
  const mountL = new THREE.Group();                         // zombi: sol elde de pençe (iki elde pençe)
  torso.add(mountL);

  mergeVC(root, false, wearOn ? WEAR_MAT : null);      // 12.167: v2'de tüm düz / kamuflaj / ışıma / metal parçalar tek paylaşılan malzemede · renk başına değil köşe rengiyle birleştir: karakter başına ~70 yerine ~15 çizim çağrısı

  if (cape) attachCapeSway(root, torso);                   // pelerin: köşe gölgelendiricisinde hıza bağlı salınım (ek çizim çağrısı yok)
  const api = {
    root, wear: wearOut,
    parts: { torso, head, legs, armR, armL, mount, mountL },
    weaponL: null,
    team,
    cls,
    weapon: null,
    setWeapon(id, opt, skin = 'std') {
      if (opt) api.optic = opt;
      if (api.weapon) { mount.remove(api.weapon); api.weapon.traverse((o) => o.geometry?.dispose()); }
      if (api.weaponL) { mountL.remove(api.weaponL); api.weaponL.traverse((o) => o.geometry?.dispose()); api.weaponL = null; }
      const w = id ? createWeapon(id, api.optic, true, skin) : null;      // skin: S3 silah kaplaması (paylaşılan LOD malzemesi)
      api.weapon = w;
      if (w) mount.add(w);
      if (id === 'claws') { api.weaponL = createWeapon('claws', 'reddot', true); mountL.add(api.weaponL); }          // ikinci pençe
      applyPose(api, w);
      if (api.groundOffset === undefined) { groundFeet(root); api.groundOffset = root.position.y; } else root.position.y = api.groundOffset;
      return w;
    },
    // Her kare: koşu pozu, geri tepme, gövde bükülmesi, kol sallanması ile kolları yeniden çöz
    refreshHold(o) { applyPose(api, api.weapon, o); },
  };

  const wid = weapon === undefined ? null : weapon || CLASSES[cls].weapon[team];
  api.blade = blade;
  api.optic = optic;
  api.setWeapon(wid, null, wskin);
  root.userData.character = api;
  return api;
}

// Zombi: türe özgü gövde (zombieBody.js) + aynı api; pençe silah modeli 3. şahısta gizli (eller gövdenin kendi pençeli elleri, kol IK'sı silah bağlantısını izler)
function createZombie({ root, team, skinIndex, weapon, ztype }) {
  const T = ztype === 'boss' ? ZBOSS : ZTYPES[ztype] || ZTYPES.walker;
  const z = buildZombie(root, { ztype, T, skinIndex });
  const mount = new THREE.Group(), mountL = new THREE.Group();
  z.torso.add(mount, mountL);
  mergeVC(root, false, ZMAT);                                                   // düz parçalar grup başına tek ağ (prosedürel deri gölgelendiricisi)
  const api = {
    root, team, cls: 'zombie', ztype, zshape: z.shape,
    parts: { torso: z.torso, head: z.head, legs: z.legs, armR: z.armR, armL: z.armL, mount, mountL },
    weaponL: null, weapon: null, blade: 0.06, optic: 'reddot',
    setWeapon(id, opt, skin = 'std') {
      if (opt) api.optic = opt;
      if (api.weapon) { mount.remove(api.weapon); api.weapon.traverse((o) => o.geometry?.dispose()); }
      if (api.weaponL) { mountL.remove(api.weaponL); api.weaponL.traverse((o) => o.geometry?.dispose()); api.weaponL = null; }
      const w = id ? createWeapon(id, api.optic, true, skin) : null;      // skin: S3 silah kaplaması (paylaşılan LOD malzemesi)
      api.weapon = w;
      if (w) { mount.add(w); if (id === 'claws') w.visible = false; }
      if (id === 'claws') { api.weaponL = createWeapon('claws', 'reddot', true); api.weaponL.visible = false; mountL.add(api.weaponL); }
      applyPose(api, w);
      if (api.groundOffset === undefined) { groundFeet(root); api.groundOffset = root.position.y; } else root.position.y = api.groundOffset;
      return w;
    },
    refreshHold(o) { applyPose(api, api.weapon, o); },
  };
  if (ztype === 'boss') root.scale.set(...BOSS.scale); else root.scale.setScalar(T.scale);             // model ölçeği = vuruş kutusu ölçeği (soldier.hbW / hbH)
  api.setWeapon(weapon === undefined ? null : weapon || 'claws');
  root.userData.character = api;
  return api;
}

// zombi kolları: dururken / yürürken öne uzanır (pençeler göğüs önünde, avını arar), koşarken alçak ve ileride
const ZMOUNT = { pos: [0.21, 0.2, -0.48], rotX: 0.9, rotZ: -0.15 };
const ZSPRINT = { pos: [0.27, -0.2, -0.36], rotX: 1.25, yaw: 0.05, rotZ: -0.3 };

const MOUNTS = {
  rifle: { pos: [0.13, 0.1, -0.27], rotX: 0.0 },
  pistol: { pos: [0.12, 0.12, -0.42], rotX: 0.0 },
  launcher: { pos: [0.2, 0.24, -0.12], rotX: 0.0 },
  melee: { pos: [0.27, 0.07, -0.34], rotX: 0.85, rotZ: -0.1 },
  grenade: { pos: [0.18, 0.12, -0.38], rotX: 0.0 },
};
// koşarken silah aşağıda, gövdeye yakın ("low ready"); bıçak yukarıda tutulur
const SPRINT = {
  rifle: { pos: [0.1, -0.04, -0.2], rotX: -0.8, yaw: 0.28 },
  pistol: { pos: [0.1, 0.0, -0.28], rotX: -0.9, yaw: 0.2 },
  launcher: { pos: [0.16, 0.12, -0.1], rotX: -0.3, yaw: 0.2 },
  melee: { pos: [0.18, 0.1, -0.3], rotX: 1.0, yaw: 0.1, rotZ: -0.1 },
  grenade: { pos: [0.16, 0.02, -0.28], rotX: -0.5, yaw: 0.1 },
};
const mix = (a, b, t) => a + (b - a) * t;
const POUCH = V(-0.13, -0.13, -0.2);   // yelek şarjör cebi (gövde yerelinde)

// o: { sprint (0..1), kick (0..1), twist (rad), swing (-1..1), reload: {style,k,empty,ph}, melee: {kind,k} }
function applyPose(api, w, o = {}) {
  const { sprint = 0, kick = 0, twist = 0, swing = 0, prone = 0, aimP = 0, reload = null, melee = null, side = 1 } = o;
  const { torso, head, mount, armR, armL } = api.parts;
  const blade = api.blade * side;                       // side: +1 sağ omuz duruşu, −1 sol omuz (aynalı: gövde ters yöne döner, silah yine sağ elde)
  const mp = melee ? meleePose(melee.kind, melee.k, melee.hv) : null;
  const body = mp ? mp.body * 0.6 : 0;
  torso.rotation.y = -blade + twist + body;
  head.rotation.y = blade * 0.92 - twist * 0.9 - body * 0.9;
  if (o.drive) {                                        // 12.177: araç sürücüsü: silah gizli, iki el direksiyonda (o.wheelA = direksiyon simidinin açısı, rad)
    if (w) w.visible = false;
    const a = o.wheelA || 0, c = Math.cos(a), s = Math.sin(a);
    torso.rotation.y = 0; head.rotation.y = -twist * 0.5;
    poseArm(armR, V(0.17 * c, 0.05 + 0.15 * s, -0.36));
    poseArm(armL, V(-0.17 * c, 0.05 - 0.15 * s, -0.36));
    return;
  }
  if (w && w.visible === false) w.visible = true;
  if (!w) {
    // silahsız: kollar ters yönde sallanır
    const k = 0.6 + 0.12 * sprint;
    poseArm(armR, armR.shoulder.clone().add(V(0.03, -Math.cos(swing * 0.9) * k, 0.04 - swing * 0.32)));
    poseArm(armL, armL.shoulder.clone().add(V(-0.03, -Math.cos(swing * 0.9) * k, 0.04 + swing * 0.32)));
    return;
  }
  const u = w.userData;
  const hold = u.hold;
  const zm = api.cls === 'zombie' && hold === 'melee';
  const m = zm ? ZMOUNT : MOUNTS[hold] || MOUNTS.rifle, sp = zm ? ZSPRINT : SPRINT[hold] || SPRINT.rifle;
  const ra = reload ? reloadAnim(reload.style, reload.k, reload.empty, reload.ph) : null;
  const spr = sprint * (1 - (ra ? ra.tilt * 0.75 : 0)) * (mp ? 0.3 : 1);
  // yatarken gövde yerle paralel: silah gövde yerelinde +Y yönüne (dünyada ileri) uzanır
  const PR = { pos: [0.1, 0.62, 0.02], rotX: Math.PI / 2 };
  const mz = (m.rotZ || 0), sz = (sp.rotZ || 0);
  mount.position.set(mix(mix(m.pos[0], sp.pos[0], spr), PR.pos[0], prone), mix(mix(m.pos[1], sp.pos[1], spr), PR.pos[1], prone), mix(mix(m.pos[2], sp.pos[2], spr) + kick * 0.05, PR.pos[2], prone));
  mount.rotation.set(mix(mix(m.rotX, sp.rotX, spr) + kick * 0.07, PR.rotX + aimP + kick * 0.05, prone), mix(blade + spr * sp.yaw, 0.12, prone), mix(mz, sz, spr));
  // 12.193 bomba atışı (3. şahıs): hazırlarken kol üstten geri-yukarı / alttan aşağı-geri kurulur, atışta ileri savrulur (o.nade: prep 0..1, swing 0..1, under)
  let nadeL = 0;
  if (o.nade && hold === 'grenade' && !prone) {
    const nd = o.nade, P = nd.under ? NADE_PREP_U : NADE_PREP_O, F = nd.under ? NADE_FOL_U : NADE_FOL_O;
    let t = P, w = nd.prep;
    if (nd.swing > 0) { const e = Math.sin(Math.min(1, nd.swing / 0.45) * Math.PI / 2); t = [mix(P[0], F[0], e), mix(P[1], F[1], e), mix(P[2], F[2], e), mix(P[3], F[3], e)]; w = 1 - Math.max(0, (nd.swing - 0.55) / 0.45); }
    mount.position.set(mix(mount.position.x, t[0], w), mix(mount.position.y, t[1], w), mix(mount.position.z, t[2], w));
    mount.rotation.x = mix(mount.rotation.x, t[3], w);
    torso.rotation.y += (nd.swing > 0 ? 0.3 * (1 - nd.swing) - 0.1 : 0.3) * w * (nd.under ? 0.5 : 1);
    nadeL = nd.under ? 0 : w * (nd.swing > 0 ? 1 - nd.swing : 1);
  }
  if (ra) {
    mount.position.y += ra.lift * 0.03 - ra.slap * 0.015; mount.position.z += ra.slap * 0.02;
    mount.rotation.x -= ra.tilt * 0.22;
    mount.rotation.z -= ra.tilt * 0.55;                       // şarjör yuvası sola (sol ele) döner
  }
  if (mp) {
    mount.position.x += mp.x * 0.85; mount.position.y += mp.y * 0.85; mount.position.z += mp.z * 0.85;
    mount.rotation.x += mp.rx; mount.rotation.y += mp.ry; mount.rotation.z += mp.rz;
  }
  // şarjör / sürgü alt grupları
  if (u.mag) {
    const ax = u.magAxis || [0, -1, 0], off = ra ? ra.magOut * 0.24 : 0;
    u.mag.visible = ra ? ra.magVis : !u.magHidden;
    u.mag.position.set(ax[0] * off, ax[1] * off, ax[2] * off);
    u.mag.rotation.x = ra ? -ra.magOut * 0.35 : 0;
  }
  if (u.bolt) {
    const b = ra ? ra.bolt : 0;
    u.bolt.g.position.set(0, u.bolt.pivot, b * 0.085);
    u.bolt.g.rotation.z = u.boltSlide ? 0 : b * 0.9;
  }
  mount.updateMatrix();
  const toTorso = (v) => v.clone().applyMatrix4(mount.matrix);
  poseArm(armR, toTorso(u.gripR));
  if (api.weaponL) {                                    // iki elde pençe: sol kol sağın aynası (konum x'i ters, savurma yönü ters)
    const { mountL } = api.parts;
    mountL.position.set(-mount.position.x, mount.position.y, mount.position.z);
    mountL.rotation.set(mount.rotation.x, 2 * blade - mount.rotation.y, -mount.rotation.z);
    mountL.updateMatrix();
    poseArm(armL, u.gripR.clone().applyMatrix4(mountL.matrix));
    return;
  }
  const restL = () => armL.shoulder.clone().add(V(-0.03, -0.55, -0.05 + swing * 0.3));
  if (ra) {
    const fg = u.gripL ? toTorso(u.gripL) : restL();
    const mg = u.magPos ? u.magPos.clone().add(V(0, -0.03, 0)) : V(0.0, -0.03, -0.03);
    if (u.mag && ra.magOut > 0 && ra.w.mag > 0.5) mg.addScaledVector(V(...(u.magAxis || [0, -1, 0])), ra.magOut * 0.24);
    const magT = toTorso(mg);
    const chT = toTorso(V(0, 0.075, 0.0));
    const wt = ra.w;
    const tgt = fg.multiplyScalar(wt.fg).add(magT.multiplyScalar(wt.mag)).add(POUCH.clone().multiplyScalar(wt.pouch)).add(chT.multiplyScalar(wt.charge));
    poseArm(armL, tgt);
  } else if (u.gripL) poseArm(armL, toTorso(u.gripL));
  else if (nadeL > 0.01) poseArm(armL, restL().lerp(NADE_AIM_L, nadeL));         // üstten atışta sol kol hedefi gösterir
  else poseArm(armL, restL());
}
// bomba pozları (gövde yerelinde x, y, z, rotX)
const NADE_PREP_O = [0.24, 0.44, 0.14, 1.2], NADE_FOL_O = [0.1, -0.02, -0.5, -0.9];
const NADE_PREP_U = [0.22, -0.26, 0.14, -0.9], NADE_FOL_U = [0.14, 0.08, -0.48, 0.7];
const NADE_AIM_L = V(-0.12, 0.24, -0.44);

function groundFeet(root) {
  root.position.y = 0;
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  bb.setFromObject(root);
  root.position.y = -bb.min.y;
}
