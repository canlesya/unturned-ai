import * as THREE from 'three';
import { box, taperBox, mat, mergeVC } from '../core/geo.js';
import { JEEP_MATS } from './jeep.js';

// 12.179 Nakliye helikopteri (düşük poligon, BattleBit / S3 dili). İleri = −Z, kök = kızak altı (zemin). Fizik: sim/vehicle.js VT['heli-n']
// (kabin kutusu hl 2,5 · hw 1,25 · üst 2,7; kuyruk kirişi kutusu; rotor / kuyruk ucu yoklamaları). Parçalar: gövde (tek köşe-renkli çizim: kabin,
// burun, kokpit camı çerçevesi, açık yan kapılar + kabin içi sıra / zemin, motor kaportası, egzoz, kızaklar, kuyruk kirişi, dikey / yatay dengeleyici),
// ana rotor (dönen 4 pal + hızda saydam bulanıklık diski), kuyruk rotoru (dönen), iki kapı makinelisi (nişancının bakışıyla döner), seyir lambaları
// (kırmızı sol / yeşil sağ), iniş farı. Takım rengi: kuyruk bandı, kapı yanı yuvarlak işaret, burun şeridi.
export const HELI = { rotorY: 3.25, rotorR: 6.6, tail: [0.38, 2.95, 7.55], door: [[-1.36, 1.32, 0.25], [1.36, 1.32, 0.25]] };
const BODY = { blue: '#4a5642', red: '#7d7254', null: '#5b5e50' };
const MARK = { blue: '#3f7fd8', red: '#d2483a', null: '#c9c6b8' };
const DK = '#1d1e20', METAL = '#3a3c3d';
const GLASS = new THREE.MeshStandardMaterial({ color: '#8fb0bf', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
const NAV_R = new THREE.MeshStandardMaterial({ color: '#c41d12', emissive: '#ff2010', emissiveIntensity: 1.2, flatShading: true });
const NAV_G = new THREE.MeshStandardMaterial({ color: '#1aa83a', emissive: '#20ff50', emissiveIntensity: 1.2, flatShading: true });
const BLUR = new THREE.MeshBasicMaterial({ color: '#2a2b2c', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
export const HELI_MATS = { GLASS, BLUR };
const cache = {};
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

function build(team) {
  const C = BODY[team] ?? BODY.null, M = MARK[team] ?? MARK.null, dk = shade(C, 0.72), lt = shade(C, 1.1);
  const root = new THREE.Group(); root.name = 'heli';
  const body = new THREE.Group(); body.name = 'gövde'; root.add(body);
  const B = (sz, col, pos, rot) => box(body, sz, col, pos, rot);
  // kabin: taban, tavan, arka duvar, ön alt; yan kapılar AÇIK (orta bölüm boş), ön / arka yan paneller
  B([2.36, 0.12, 4.2], dk, [0, 0.8, -0.2]);                                   // taban
  B([2.3, 0.12, 4.3], C, [0, 2.6, -0.15]);                                    // tavan
  B([2.36, 1.8, 0.12], C, [0, 1.7, 1.9]);                                     // arka duvar
  for (const sx of [-1, 1]) {
    B([0.1, 1.8, 1.1], C, [sx * 1.18, 1.7, -1.75]);                          // ön yan panel (kokpit kapısı)
    B([0.1, 1.8, 0.9], C, [sx * 1.18, 1.7, 1.45]);                           // arka yan panel
    B([0.1, 0.5, 1.6], C, [sx * 1.18, 1.05, 0.25]);                          // kapı altı eşik
    B([0.11, 0.22, 3.6], M, [sx * 1.19, 2.35, -0.1]);                        // takım bandı (üst)
    const rd = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), mat('#e9e5d6')); rd.position.set(sx * 1.24, 1.7, 1.45); rd.rotation.y = sx * Math.PI / 2; body.add(rd);
    const rd2 = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), mat(M)); rd2.position.set(sx * 1.25, 1.7, 1.45); rd2.rotation.y = sx * Math.PI / 2; body.add(rd2);
    // kızaklar + dikmeler
    B([0.12, 0.1, 4.2], METAL, [sx * 1.2, 0.08, -0.2]);
    B([0.1, 0.1, 0.35], METAL, [sx * 1.2, 0.18, -2.4], [-0.6, 0, 0]);
    for (const z of [-1.3, 0.9]) B([0.08, 0.75, 0.08], METAL, [sx * 1.12, 0.45, z], [0, 0, sx * 0.25]);
  }
  // burun + kokpit (cam ayrı)
  taperBox(body, [2.3, 0.62, 0.9], C, [0, 1.05, -2.75], [0, 0, 0], [0.82, 0.85], [0.9, 1]);      // burun (pilot gözünün altında: ön görüş açık)
  B([1.95, 0.06, 0.9], M, [0, 1.38, -2.75]);                                  // burun takım şeridi
  B([0.06, 1.25, 0.06], DK, [0, 1.95, -2.62], [-0.5, 0, 0]);                 // ön cam orta dikmesi
  B([2.2, 0.08, 0.08], DK, [0, 2.55, -2.1]);
  B([1.9, 0.28, 0.3], '#2a2b27', [0, 1.28, -2.15]);                          // gösterge paneli (alçak)
  for (const sx of [-1, 1]) { B([0.5, 0.1, 0.5], '#34362f', [sx * 0.42, 1.0, -1.55]); B([0.5, 0.6, 0.1], '#34362f', [sx * 0.42, 1.35, -1.25]); }   // pilot koltukları
  B([2.0, 0.12, 0.45], '#34362f', [0, 1.0, 1.4]); B([2.0, 0.6, 0.1], '#34362f', [0, 1.35, 1.75]);   // arka sıra
  // motor kaportası + egzoz
  taperBox(body, [1.5, 0.6, 3.0], dk, [0, 2.95, 0.3], [0, 0, 0], [0.75, 0.85], [1, 1]);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), mat('#2b2c2d')); e.rotation.x = Math.PI / 2; e.position.set(sx * 0.55, 2.95, 1.9); body.add(e); }
  B([0.25, 0.3, 0.25], METAL, [0, 3.15, -0.1]);                               // rotor mili
  // kuyruk kirişi (konik) + dikey / yatay dengeleyici
  taperBox(body, [0.75, 6.0, 0.75], C, [0, 2.0, 4.8], [Math.PI / 2, 0, 0], [0.5, 0.55], [1, 1]);          // y ekseni → +z (geri): uç incelir
  B([0.1, 1.4, 1.1], C, [0, 2.95, 7.45], [-0.35, 0, 0]);                     // dikey kanat
  B([0.11, 0.45, 0.9], M, [0, 2.75, 7.4], [-0.35, 0, 0]);                    // kuyruk takım bandı
  B([2.0, 0.08, 0.6], C, [0, 2.05, 6.4]);                                     // yatay dengeleyici
  mergeVC(body);
  // cam (ön + yan kokpit)
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), GLASS); gl.position.set(0, 1.95, -2.62); gl.rotation.x = -0.5; gl.renderOrder = 3; root.add(gl);
  for (const sx of [-1, 1]) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), GLASS); sg.position.set(sx * 1.235, 2.05, -1.75); sg.rotation.y = Math.PI / 2; sg.renderOrder = 3; root.add(sg); }
  // lambalar
  const fx = new THREE.Group(); fx.name = 'ışık'; root.add(fx);
  const navL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), NAV_R); navL.position.set(-1.25, 2.5, -1.2); fx.add(navL);
  const navR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), NAV_G); navR.position.set(1.25, 2.5, -1.2); fx.add(navR);
  const ld = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10), JEEP_MATS.LENS); ld.position.set(0, 0.78, -2.6); fx.add(ld);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04), JEEP_MATS.TAIL); tl.position.set(0, 3.6, 7.6); fx.add(tl);
  // ana rotor
  const rot = new THREE.Group(); rot.name = 'rotor'; rot.position.set(0, HELI.rotorY, -0.1); root.add(rot);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 8), mat(METAL)); rot.add(hub);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, HELI.rotorR), mat('#1f2021')); b.geometry.translate(0, 0, HELI.rotorR / 2 + 0.2); b.rotation.y = (i * Math.PI) / 2; rot.add(b); }
  mergeVC(rot);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(HELI.rotorR + 0.2, 28), BLUR); disc.name = 'bulanıklık'; disc.rotation.x = -Math.PI / 2; disc.position.set(0, HELI.rotorY + 0.02, -0.1); disc.renderOrder = 4; root.add(disc);
  // kuyruk rotoru (x ekseninde döner)
  const tr = new THREE.Group(); tr.name = 'kuyrukRotor'; tr.position.set(...HELI.tail); root.add(tr);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.18), mat('#1f2021')); b.rotation.x = (i * Math.PI) / 2; tr.add(b); }
  mergeVC(tr);
  // kapı makineleri (nişancının bakışıyla döner; ayak dışarıda)
  HELI.door.forEach((p, i) => {
    const g = new THREE.Group(); g.name = 'kapıMG' + (i + 1); g.position.set(...p); root.add(g);
    box(g, [0.08, 0.4, 0.08], DK, [0, -0.2, 0]);
    const gun = new THREE.Group(); gun.name = 'mg'; g.add(gun);
    box(gun, [0.07, 0.07, 1.2], '#1b1c1d', [0, 0.05, -0.55]); box(gun, [0.13, 0.17, 0.42], '#262728', [0, 0.02, 0]); box(gun, [0.18, 0.15, 0.18], '#3d4632', [0.12, -0.03, 0.05]);
    box(gun, [0.03, 0.12, 0.03], '#111', [-0.05, -0.08, 0.22]); box(gun, [0.03, 0.12, 0.03], '#111', [0.05, -0.08, 0.22]);
    mergeVC(g);
  });
  return root;
}

export function createHeli(team) {
  const k = team || 'null';
  const r = (cache[k] ||= build(team)).clone(true);
  const find = (n) => r.getObjectByName(n);
  const doors = [find('kapıMG1'), find('kapıMG2')];
  r.userData = { heli: true, rotor: find('rotor'), tailRotor: find('kuyrukRotor'), blur: find('bulanıklık'), doors, doorGuns: doors.map((d) => d.getObjectByName('mg')), fx: find('ışık'), body: find('gövde'), team: k };
  return r;
}
