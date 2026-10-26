import * as THREE from 'three';
import { box, cylY, mat, mergeVC } from '../core/geo.js';

// 12.177 Jip (askeri, üstü açık, 4 kişilik) — düşük poligon, BattleBit / S3 dili: düz renk, sert kenar, köşe rengiyle tek çizim (gövde).
// Konvansiyon: ileri = −Z, yukarı = +Y, sağ = +X; kök = zemin ortası (fizik gövdesi: sim/vehicle.js VT.jip — hl 1,95 · hw 0,94 · üst 1,2).
// Parçalı: 4 teker (dönen + ön tekerler direksiyonla), direksiyon simidi (+ 1. şahıs sürücü elleri), hız göstergesi ibresi, farlar / stop lambaları
// (ayrı ışıyan malzeme), ön cam (saydam). Takım rengi: kapı plakaları, kaput yıldızı çevresi, çerçeve şeridi, anten flaması.
// Tek şablon her takım için bir kez kurulur; araçlar şablonun kopyası (geometri + malzeme paylaşılır).
export const JEEP = { wheelR: 0.4, wheels: [[-0.81, -1.2], [0.81, -1.2], [-0.81, 1.2], [0.81, 1.2]], wheelPos: { y: 0.4 }, steerC: [-0.42, 1.2, -0.47], gauge: [-0.42, 1.1, -0.57] };
const BODY = { blue: '#4f5a42', red: '#6b6448', null: '#5a5e4c' };
const MARK = { blue: '#3f7fd8', red: '#d2483a', null: '#c9c6b8' };
const DK = '#1d1e20', TIRE = '#1b1b1d', RIM = '#4a4d47', SEAT = '#34362f', METAL = '#2d2f31';
const LENS = new THREE.MeshStandardMaterial({ color: '#fff3c8', emissive: '#fff1c0', emissiveIntensity: 0.25, flatShading: true, roughness: 0.3 });
const TAIL = new THREE.MeshStandardMaterial({ color: '#b3241b', emissive: '#ff2a1a', emissiveIntensity: 0.2, flatShading: true, roughness: 0.4 });
const GLASS = new THREE.MeshStandardMaterial({ color: '#9fb8c4', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
export const JEEP_MATS = { LENS, TAIL, GLASS };

const cache = {};
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

function star(r, color) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat(color)); return m;
}

function wheel(team) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), mat(TIRE)); t.rotation.z = Math.PI / 2; g.add(t);
  for (let i = 0; i < 12; i++) {                                    // diş blokları (dönüş görünsün)
    const a = (i / 12) * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.05, 0.1), mat('#232325'));
    b.position.set(0, Math.cos(a) * 0.405, Math.sin(a) * 0.405); b.rotation.x = -a; g.add(b);
  }
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 10), mat(RIM)); r.rotation.z = Math.PI / 2; r.position.x = sx * 0.152; g.add(r);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 6), mat('#6b6e66')); h.rotation.z = Math.PI / 2; h.position.x = sx * 0.165; g.add(h);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, n = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.035), mat('#8a8c84')); n.position.set(sx * 0.17, Math.cos(a) * 0.15, Math.sin(a) * 0.15); g.add(n); }
  }
  mergeVC(g);
  return g;
}

function build(team) {
  const C = BODY[team] ?? BODY.null, M = MARK[team] ?? MARK.null, dk = shade(C, 0.72), lt = shade(C, 1.12);
  const root = new THREE.Group(); root.name = 'jip';
  const body = new THREE.Group(); body.name = 'gövde'; root.add(body);
  const B = (sz, col, pos, rot) => box(body, sz, col, pos, rot);
  // şasi + altlık
  B([1.36, 0.16, 3.7], DK, [0, 0.42, 0]);
  B([1.5, 0.08, 0.5], DK, [0, 0.36, -1.2]); B([1.5, 0.08, 0.5], DK, [0, 0.36, 1.2]);           // dingiller
  // kasa (içi oyuk): taban, yanlar, arka duvar, kaput, ızgara
  B([1.7, 0.07, 2.36], dk, [0, 0.54, 0.6]);                                                   // taban (kabin + arka)
  for (const sx of [-1, 1]) {
    B([0.06, 0.5, 2.4], C, [sx * 0.9, 0.73, 0.58]);                                          // yan panel
    B([0.08, 0.06, 2.4], lt, [sx * 0.9, 0.99, 0.58]);                                        // üst kenar
    B([0.06, 0.16, 0.7], C, [sx * 0.9, 1.07, 1.4]);                                          // arka yan yükseltisi
    B([0.03, 0.22, 0.46], M, [sx * 0.935, 0.75, -0.05]);                                     // takım plakası (kapı)
    B([0.032, 0.06, 0.2], '#e8e4d8', [sx * 0.95, 0.75, -0.05]);                              // plaka çizgisi
    B([0.34, 0.06, 0.95], C, [sx * 0.83, 0.92, -1.2]);                                       // ön çamurluk (düz)
    B([0.06, 0.32, 0.5], dk, [sx * 0.69, 0.72, -1.2]);                                       // çamurluk iç sacı
    B([0.3, 0.05, 0.55], dk, [sx * 0.86, 0.46, -0.32]);                                      // basamak
    B([0.04, 0.26, 0.3], DK, [sx * 0.82, 0.38, 1.62]);                                       // çamurluk paçası
    B([0.12, 0.06, 0.04], METAL, [sx * 0.93, 1.32, -0.64]);                                  // ayna kolu
    B([0.04, 0.14, 0.1], '#1a1c1e', [sx * 1.0, 1.36, -0.64]);                                // ayna
  }
  B([1.86, 0.5, 0.06], C, [0, 0.73, 1.77]);                                                   // arka duvar
  B([1.5, 0.43, 1.32], C, [0, 0.775, -1.27]);                                                 // motor kaputu (dolu)
  B([1.52, 0.04, 1.3], lt, [0, 1.005, -1.27]);                                                // kaput üstü
  for (let i = -2; i <= 2; i++) B([0.04, 0.012, 1.1], dk, [i * 0.22, 1.03, -1.27]);           // kaput nervürleri
  B([1.36, 0.46, 0.05], dk, [0, 0.76, -1.95]);                                                // ızgara
  for (let i = -3; i <= 3; i++) if (Math.abs(i) !== 3) B([0.06, 0.36, 0.02], '#141516', [i * 0.12, 0.76, -1.98]);   // ızgara yarıkları
  B([1.92, 0.14, 0.16], METAL, [0, 0.44, -2.0]); B([1.86, 0.14, 0.14], METAL, [0, 0.44, 1.93]);   // tamponlar
  for (const sx of [-1, 1]) B([0.1, 0.1, 0.2], METAL, [sx * 0.5, 0.6, -2.08]);               // çeki kancaları
  // ön cam çerçevesi (cam ayrı, saydam)
  const tilt = -0.22;
  for (const sx of [-1, 1]) B([0.06, 0.68, 0.06], DK, [sx * 0.82, 1.33, -0.63], [tilt, 0, 0]);
  B([1.7, 0.06, 0.07], DK, [0, 1.66, -0.56], [tilt, 0, 0]); B([1.7, 0.06, 0.08], DK, [0, 1.0, -0.71], [tilt, 0, 0]);
  B([0.04, 0.6, 0.04], DK, [0, 1.33, -0.63], [tilt, 0, 0]);                                   // orta dikme
  // gösterge paneli + saatler
  B([1.64, 0.2, 0.18], '#2a2b27', [0, 1.06, -0.55]);
  B([1.64, 0.05, 0.3], '#24251f', [0, 1.17, -0.52]);
  for (const [x, r] of [[-0.42, 0.075], [-0.24, 0.05], [-0.6, 0.05], [0.25, 0.05]]) { const g = cylY(body, r, r, 0.02, '#0f1011', [x, 1.1, -0.455], 10, [Math.PI / 2, 0, 0]); g.rotation.x = Math.PI / 2 - 0.25; const f = cylY(body, r * 0.82, r * 0.82, 0.005, '#d9d3bf', [x, 1.1, -0.443], 10); f.rotation.x = Math.PI / 2 - 0.25; }
  B([0.04, 0.32, 0.04], METAL, [-0.42, 1.12, -0.42], [0.95, 0, 0]);                          // direksiyon mili
  B([0.05, 0.3, 0.05], '#202122', [-0.02, 0.72, -0.15], [-0.3, 0, 0]); B([0.08, 0.08, 0.08], '#141414', [-0.02, 0.87, -0.11]);   // vites kolu
  // koltuklar: ön iki, arka sıra
  for (const [x, z, y] of [[-0.42, -0.12, 0.78], [0.42, -0.12, 0.78], [-0.42, 0.78, 0.84], [0.42, 0.78, 0.84]]) {
    B([0.5, 0.12, 0.46], SEAT, [x, y - 0.06, z + 0.02]);
    B([0.5, 0.5, 0.1], SEAT, [x, y + 0.24, z + 0.3], [0.18, 0, 0]);
    B([0.4, 0.2, 0.42], dk, [x, y - 0.22, z + 0.02]);                                         // koltuk ayağı (tabana)
  }
  // devrilme çerçevesi (takım şeridi)
  for (const sx of [-1, 1]) B([0.07, 0.95, 0.07], DK, [sx * 0.83, 1.46, 1.28]);
  B([1.73, 0.07, 0.07], DK, [0, 1.93, 1.28]); B([1.0, 0.075, 0.075], M, [0, 1.93, 1.28]);
  for (const sx of [-1, 1]) B([0.06, 0.06, 0.62], DK, [sx * 0.83, 1.17, 1.55], [0.85, 0, 0]);   // arka destek
  // arka: yedek teker + bidonlar
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 12), mat(TIRE)); sp.rotation.x = Math.PI / 2; sp.position.set(0.45, 0.98, 1.92); body.add(sp);
  const sr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.24, 10), mat(RIM)); sr.rotation.x = Math.PI / 2; sr.position.set(0.45, 0.98, 1.92); body.add(sr);
  B([0.3, 0.42, 0.14], '#3b4a32', [-0.5, 1.0, 1.88]); B([0.08, 0.06, 0.1], '#2b3524', [-0.5, 1.24, 1.88]);   // bidon
  // kaput yıldızı (beyaz + takım rengi halka)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.27, 0.32, 16), mat(M)); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 1.029, -1.3); body.add(ring);
  const st = star(0.24, '#e9e5d6'); st.position.set(0, 1.03, -1.3); body.add(st);
  for (const sx of [-1, 1]) { const s2 = star(0.13, '#e9e5d6'); s2.rotation.set(0, 0, 0); s2.geometry = s2.geometry.clone().rotateZ(Math.PI / 2).rotateY(sx * Math.PI / 2); s2.position.set(sx * 0.906, 0.75, 0.95); body.add(s2); }   // yan yıldız (arka)
  // anten + flama
  B([0.025, 2.1, 0.025], '#151617', [-0.82, 2.0, 1.62]);
  B([0.02, 0.16, 0.3], M, [-0.82, 2.9, 1.78]);
  mergeVC(body);
  body.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // farlar + stoplar + cam (ayrı malzemeler)
  const fx = new THREE.Group(); fx.name = 'ışık'; root.add(fx);
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), LENS); hl.rotation.x = Math.PI / 2; hl.position.set(sx * 0.5, 0.86, -1.97); fx.add(hl);
    const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.05, 10), mat('#202122')); hr.rotation.x = Math.PI / 2; hr.position.set(sx * 0.5, 0.86, -1.95); fx.add(hr);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.03), TAIL); tl.position.set(sx * 0.74, 0.86, 1.81); fx.add(tl);
  }
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 0.6), GLASS); gl.position.set(0, 1.33, -0.63); gl.rotation.x = tilt; gl.renderOrder = 3; root.add(gl);
  // dönen parçalar
  JEEP.wheels.forEach(([x, z]) => {
    const piv = new THREE.Group(); piv.name = 'teker'; piv.position.set(x, 0.4, z); root.add(piv);
    piv.add(wheel(team));
  });
  const steer = new THREE.Group(); steer.name = 'direksiyon'; steer.position.set(...JEEP.steerC); steer.rotation.x = -0.62; root.add(steer);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 5, 14), mat('#18191a')); steer.add(sw);
  for (const a of [0, 2.1, 4.2]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), mat('#18191a')); sk.position.set(Math.sin(a) * 0.09, Math.cos(a) * 0.09, 0); sk.rotation.z = -a; steer.add(sk); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), mat('#2a2b2c')); hub.rotation.x = Math.PI / 2; steer.add(hub);
  // 1. şahıs sürücü elleri (eldiven + kol), yalnız yerel sürücüye görünür
  const hands = new THREE.Group(); hands.name = 'eller'; hands.visible = false; steer.add(hands);
  for (const sx of [-1, 1]) {
    const gv = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.1), mat('#1d2530')); gv.position.set(sx * 0.18, 0.02, 0.03); hands.add(gv);
    const th = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.04), mat('#1d2530')); th.position.set(sx * 0.15, 0.06, 0.0); hands.add(th);
  }
  const arms = new THREE.Group(); arms.name = 'kollar'; arms.visible = false; root.add(arms);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.004), mat('#d23a22')); needle.geometry.translate(0, 0.028, 0);
  needle.name = 'ibre'; needle.position.set(JEEP.gauge[0], JEEP.gauge[1], JEEP.gauge[2] + 0.13); needle.rotation.x = -0.25; root.add(needle);
  return root;                                                   // başvurular kopyada bağlanır (şablonun userData'sı boş kalmalı: clone JSON kopyalar)
}

// Takım rengine göre şablon (bir kez) → kopya. Kopyada döner parçaların başvuruları yeniden bağlanır.
export function createJeep(team) {
  const k = team || 'null';
  const T = (cache[k] ||= build(team));
  const r = T.clone(true);
  const find = (n) => r.getObjectByName(n);
  const wheels = r.children.filter((c) => c.name === 'teker').map((c) => ({ piv: c, w: c.children[0], front: c.position.z < 0 }));
  r.userData = { wheels, steer: find('direksiyon'), hands: find('eller'), arms: find('kollar'), needle: find('ibre'), fx: find('ışık'), body: find('gövde'), team: k };
  return r;
}
