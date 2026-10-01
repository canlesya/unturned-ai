import * as THREE from 'three';
import { box, taperBox, cylY, ico, V, mergeStatic } from '../core/geo.js';
import { C, TEAMS, SKINS } from '../core/palette.js';
import { createWeapon } from './weapons.js';

// Unturned/BattleBit tarzı kutu karakter. ~1.79 m boyunda, ileri = -Z.
// Hiyerarşi: root > torso(> head, kollar, silah bağlantısı) + bacaklar. Kollar iki kemikli IK ile silaha kilitlenir.

export const CLASSES = {
  assault: { label: 'Saldırı', weapon: { blue: 'm4a1', red: 'ak47' } },
  medic: { label: 'Sıhhiye', weapon: { blue: 'mp5', red: 'mp5' } },
  sniper: { label: 'Keskin Nişancı', weapon: { blue: 'sniper', red: 'sniper' } },
  heavy: { label: 'Ağır Destek', weapon: { blue: 'lmg', red: 'lmg' } },
  engineer: { label: 'Mühendis', weapon: { blue: 'shotgun', red: 'shotgun' } },
};

const L1 = 0.32; // üst kol
const L2 = 0.3; // ön kol (+el)
const TORSO_Y = 1.17;
const SHOULDER_X = 0.3;
const SHOULDER_Y = 0.22;

// ── İki kemikli IK: omuz S, hedef T, dirsek yönü (pole) → dirsek konumu ──
function solveElbow(S, T, pole) {
  const dir = T.clone().sub(S);
  let d = dir.length();
  dir.normalize();
  d = THREE.MathUtils.clamp(d, Math.abs(L1 - L2) + 0.01, (L1 + L2) * 0.995);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
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
  box(hand, [0.1, 0.11, 0.115], c.gloves, [0, -0.05, 0.0]);             // eldiven
  box(hand, [0.085, 0.03, 0.04], c.gloves, [0, -0.1, -0.03]);           // parmak ucu
  torso.add(upper, fore, hand);
  return { upper, fore, hand, side, shoulder: V(side === 'R' ? SHOULDER_X : -SHOULDER_X, SHOULDER_Y, 0) };
}

function poseArm(arm, target) {
  const pole = arm.side === 'R' ? V(0.55, -1, 0.35) : V(-0.55, -1, 0.35);
  const { E, H } = solveElbow(arm.shoulder, target, pole);
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

function addGear(cls, team, c, parts, skin) {
  const { torso, head, legs } = parts;
  // ortak: yelek + kemer + omuz kayışları
  box(torso, [0.5, 0.42, 0.3], c.vest, [0, 0.07, 0]);
  box(torso, [0.1, 0.14, 0.31], c.vest, [0.16, 0.26, 0]);                       // omuz kayışı
  box(torso, [0.1, 0.14, 0.31], c.vest, [-0.16, 0.26, 0]);
  box(torso, [0.47, 0.07, 0.28], C.black, [0, -0.26, 0]);
  box(torso, [0.07, 0.05, 0.02], C.chrome, [0, -0.26, -0.145], null, { metalness: 0.5 });
  // sol kol bandı (takım rengi)
  box(torso, [0.15, 0.08, 0.15], c.accent, [-SHOULDER_X, SHOULDER_Y - 0.14, 0]);
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
export function createCharacter({ team = 'blue', cls = 'assault', skinIndex = 0, weapon = null, blade = 0.38, optic = 'reddot' } = {}) {
  const c = TEAMS[team];
  const skin = SKINS[skinIndex % SKINS.length];
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';   // önce yön (yaw), sonra gövde eğimi/yatma: baktığı yöne göre devrilir

  // gövde
  const torso = new THREE.Group();
  torso.position.set(0, TORSO_Y, 0);
  root.add(torso);
  box(torso, [0.46, 0.58, 0.26], c.shirt);
  taperBox(torso, [0.4, 0.1, 0.24], c.pants, [0, -0.33, 0], null, [1, 1], [1, 1]); // leğen

  const head = new THREE.Group();
  head.position.set(0, 0.29 + 0.03 + 0.15, 0);
  torso.add(head);
  box(torso, [0.13, 0.07, 0.13], skin, [0, 0.31, 0]);                              // boyun

  // bacaklar
  const legs = {};
  for (const s of ['L', 'R']) {
    const sign = s === 'R' ? 1 : -1;
    const hip = new THREE.Group();
    hip.position.set(sign * 0.105, 0.88, 0);
    const knee = new THREE.Group();
    knee.position.set(0, -0.45, 0);
    taperBox(hip, [0.18, 0.46, 0.21], c.pants, [0, -0.225, 0], null, [1, 1], [0.9, 0.9]);
    taperBox(knee, [0.16, 0.43, 0.19], c.pants, [0, -0.205, 0], null, [1, 1], [0.92, 0.92]);
    box(knee, [0.17, 0.12, 0.2], c.boots, [0, -0.37, 0]);                             // bot gövdesi
    box(knee, [0.17, 0.07, 0.3], c.boots, [0, -0.395, -0.045]);                      // bot burnu
    hip.add(knee);
    root.add(hip);
    legs[s] = { hip, knee, thigh: hip };
  }
  // duruş (sol bacak ileride)
  legs.L.hip.rotation.x = 0.22;
  legs.L.knee.rotation.x = -0.18;
  legs.R.hip.rotation.x = -0.2;
  legs.R.knee.rotation.x = 0.22;

  const parts = { torso, head, legs };
  addGear(cls, team, c, parts, skin);

  // kollar + silah
  const armR = makeArm(torso, 'R', c);
  const armL = makeArm(torso, 'L', c);
  const mount = new THREE.Group();
  torso.add(mount);

  mergeStatic(root);

  const api = {
    root,
    parts: { torso, head, legs, armR, armL, mount },
    team,
    cls,
    weapon: null,
    setWeapon(id, opt) {
      if (opt) api.optic = opt;
      if (api.weapon) mount.remove(api.weapon);
      const w = id ? createWeapon(id, api.optic) : null;
      api.weapon = w;
      if (w) mount.add(w);
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
  api.setWeapon(wid);
  root.userData.character = api;
  return api;
}

const MOUNTS = {
  rifle: { pos: [0.13, 0.1, -0.27], rotX: 0.0 },
  pistol: { pos: [0.12, 0.12, -0.42], rotX: 0.0 },
  launcher: { pos: [0.2, 0.24, -0.12], rotX: 0.0 },
  melee: { pos: [0.2, 0.0, -0.36], rotX: -0.5 },
  grenade: { pos: [0.18, 0.12, -0.38], rotX: 0.0 },
};
// koşarken silah aşağıda, gövdeye yakın ("low ready")
const SPRINT = {
  rifle: { pos: [0.1, -0.04, -0.2], rotX: -0.8, yaw: 0.28 },
  pistol: { pos: [0.1, 0.0, -0.28], rotX: -0.9, yaw: 0.2 },
  launcher: { pos: [0.16, 0.12, -0.1], rotX: -0.3, yaw: 0.2 },
  melee: { pos: [0.18, -0.06, -0.3], rotX: -0.6, yaw: 0.1 },
  grenade: { pos: [0.16, 0.02, -0.28], rotX: -0.5, yaw: 0.1 },
};
const mix = (a, b, t) => a + (b - a) * t;

// o: { sprint (0..1), kick (0..1), twist (rad), swing (-1..1) }
function applyPose(api, w, o = {}) {
  const { sprint = 0, kick = 0, twist = 0, swing = 0, prone = 0, aimP = 0 } = o;
  const { torso, head, mount, armR, armL } = api.parts;
  const blade = api.blade;
  torso.rotation.y = -blade + twist;
  head.rotation.y = blade * 0.92 - twist * 0.9;
  if (!w) {
    // silahsız: kollar ters yönde sallanır
    const k = 0.6 + 0.12 * sprint;
    poseArm(armR, armR.shoulder.clone().add(V(0.03, -Math.cos(swing * 0.9) * k, 0.04 - swing * 0.32)));
    poseArm(armL, armL.shoulder.clone().add(V(-0.03, -Math.cos(swing * 0.9) * k, 0.04 + swing * 0.32)));
    return;
  }
  const hold = w.userData.hold;
  const m = MOUNTS[hold] || MOUNTS.rifle, sp = SPRINT[hold] || SPRINT.rifle;
  // yatarken gövde yerle paralel: silah gövde yerelinde +Y yönüne (dünyada ileri) uzanır
  const PR = { pos: [0.1, 0.62, 0.02], rotX: Math.PI / 2 };
  mount.position.set(mix(mix(m.pos[0], sp.pos[0], sprint), PR.pos[0], prone), mix(mix(m.pos[1], sp.pos[1], sprint), PR.pos[1], prone), mix(mix(m.pos[2], sp.pos[2], sprint) + kick * 0.05, PR.pos[2], prone));
  mount.rotation.set(mix(mix(m.rotX, sp.rotX, sprint) + kick * 0.07, PR.rotX + aimP + kick * 0.05, prone), mix(blade + sprint * sp.yaw, 0.12, prone), 0);
  mount.updateMatrix();
  const toTorso = (v) => v.clone().applyMatrix4(mount.matrix);
  poseArm(armR, toTorso(w.userData.gripR));
  if (w.userData.gripL) poseArm(armL, toTorso(w.userData.gripL));
  else poseArm(armL, armL.shoulder.clone().add(V(-0.03, -0.55, -0.05 + swing * 0.3)));
}

function groundFeet(root) {
  root.position.y = 0;
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  bb.setFromObject(root);
  root.position.y = -bb.min.y;
}
