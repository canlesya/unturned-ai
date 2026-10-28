import * as THREE from 'three';
import { box, cylY, mat, mergeVC } from '../core/geo.js';
import { JEEP_MATS } from './jeep.js';

// 12.204 Arazi motosikleti (2 kişilik) — düşük poligon, jip / tank diliyle: düz renk, sert kenar, köşe rengiyle tek çizim (gövde).
// Konvansiyon: ileri = −Z, yukarı = +Y, sağ = +X; kök = zemin ortası (fizik gövdesi: sim/moto.js MOTO — hl 1,0 · hw 0,36 · üst 1,0 · dingil 1,42).
// Parçalı: arka teker (döner), ön çatal ekseni (yatık: kafa borusundan ön tekere) + çatal (direksiyonla döner) + ön teker (döner), gidon, far
// (çatalla döner) / stop (ayrı ışıyan malzeme: jip malzemesi, araç başına kopyalanır). Gövde: çift beşik şasi, motor bloğu + silindir kanatları,
// depo (takım rengi), uzun sele, yan numara plakaları (takım rengi), kalkık arka çamurluk, salıncak + amortisör, sağda egzoz + susturucu, basamaklar.
export const MOTO_M = { wheelR: 0.34, wb: 1.42, head: [0, 1.02, -0.47], grip: 0.35 };
const BODY = { blue: '#3f6fb8', red: '#b8432f', null: '#c9a640' };
const MARK = { blue: '#e8edf5', red: '#f3e6d0', null: '#26282b' };
const DK = '#1c1d1f', TIRE = '#18181a', METAL = '#3a3c3f', CHROME = '#8d9196', SEAT = '#212224', ENG = '#4a4c4f';
const cache = {};

function wheel() {
  const g = new THREE.Group(), R = MOTO_M.wheelR;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.13, 14), mat(TIRE)); t.rotation.z = Math.PI / 2; g.add(t);
  for (let i = 0; i < 14; i++) {                                     // arazi lastiği çivileri (dönüş görünsün)
    const a = (i / 14) * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.07), mat('#262628'));
    b.position.set(0, Math.cos(a) * (R + 0.012), Math.sin(a) * (R + 0.012)); b.rotation.x = -a; g.add(b);
  }
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, 0.02, 12), mat('#5b5f63')); r.rotation.z = Math.PI / 2; r.position.x = sx * 0.06; g.add(r);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), mat(CHROME)); h.rotation.z = Math.PI / 2; h.position.x = sx * 0.07; g.add(h);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.012, R * 1.35, 0.018), mat('#9a9ea3')); sp.position.x = sx * 0.072; sp.rotation.x = (i / 3) * Math.PI + (sx > 0 ? 0.5 : 0); g.add(sp); }      // jant telleri
  }
  mergeVC(g);
  return g;
}

function build(team) {
  const C = BODY[team] ?? BODY.null, M = MARK[team] ?? MARK.null;
  const root = new THREE.Group(); root.name = 'motor';
  const body = new THREE.Group(); body.name = 'gövde'; root.add(body);
  const B = (sz, col, pos, rot) => box(body, sz, col, pos, rot);
  const R = MOTO_M.wheelR, zr = MOTO_M.wb / 2, [, hy, hz] = MOTO_M.head;
  // şasi: kafa borusu → üst boru (depo altı) → sele altı; alt boru kafa borusundan motorun önüne, beşik motorun altından salıncak eksenine
  B([0.07, 0.24, 0.07], METAL, [0, hy - 0.06, hz], [0.34, 0, 0]);                     // kafa borusu
  B([0.06, 0.06, 0.62], METAL, [0, 0.9, -0.17], [-0.2, 0, 0]);                        // üst boru
  B([0.06, 0.06, 0.5], METAL, [0, 0.84, 0.34], [0.12, 0, 0]);                         // sele altı borusu
  B([0.06, 0.62, 0.06], METAL, [0, 0.67, -0.38], [-0.32, 0, 0]);                      // alt boru
  for (const sx of [-1, 1]) B([0.04, 0.04, 0.52], METAL, [sx * 0.07, 0.3, -0.04]);    // beşik (motorun altı)
  B([0.05, 0.42, 0.05], METAL, [0, 0.52, 0.2], [0.15, 0, 0]);                         // arka dikme (salıncak ekseni)
  // motor: blok + silindir (kanatlı) + karter kapağı + zincir dişlisi
  B([0.26, 0.24, 0.36], ENG, [0, 0.42, -0.02]);
  B([0.2, 0.22, 0.2], '#55585b', [0, 0.62, -0.12], [-0.25, 0, 0]);                   // silindir
  for (let i = 0; i < 4; i++) B([0.26, 0.018, 0.24], '#2e3033', [0, 0.55 + i * 0.05, -0.13 + i * 0.012], [-0.25, 0, 0]);   // soğutma kanatları
  cylY(body, 0.11, 0.11, 0.04, '#5f6266', [-0.15, 0.4, 0.0], 10, [0, 0, Math.PI / 2]);  // sol karter kapağı
  cylY(body, 0.08, 0.08, 0.03, '#303234', [0.15, 0.36, 0.12], 10, [0, 0, Math.PI / 2]); // ön dişli
  // salıncak (iki kol, eksen → arka teker) + amortisör + zincir
  for (const sx of [-1, 1]) B([0.04, 0.06, 0.6], METAL, [sx * 0.1, (0.38 + R) / 2, (0.2 + zr) / 2], [Math.atan2(0.38 - R, zr - 0.2) * -1, 0, 0]);
  B([0.05, 0.38, 0.05], '#b88a2a', [0, 0.62, 0.32], [-0.55, 0, 0]);                   // amortisör yayı
  B([0.012, 0.05, 0.62], '#202122', [0.13, 0.36, 0.42], [-0.04, 0, 0]);               // zincir
  // depo (takım rengi) + kapağı, sele, yan plakalar, kalkık arka çamurluk, el tutamağı (yolcu)
  B([0.34, 0.2, 0.42], C, [0, 0.98, -0.24], [-0.12, 0, 0]);
  B([0.26, 0.05, 0.36], C, [0, 1.09, -0.25], [-0.12, 0, 0]);
  cylY(body, 0.04, 0.04, 0.03, CHROME, [0, 1.12, -0.3], 8);                            // depo kapağı
  for (const sx of [-1, 1]) B([0.03, 0.1, 0.3], M, [sx * 0.175, 0.98, -0.24], [-0.12, 0, 0]);      // depo şeridi
  B([0.26, 0.08, 0.9], SEAT, [0, 0.9, 0.27], [0.03, 0, 0]);                           // uzun sele (sürücü + yolcu)
  B([0.22, 0.03, 0.86], '#2b2c2f', [0, 0.945, 0.27], [0.03, 0, 0]);
  for (const sx of [-1, 1]) {
    B([0.03, 0.26, 0.36], C, [sx * 0.15, 0.74, 0.36], [0.3, 0, 0]);                   // yan kapak (takım rengi)
    B([0.032, 0.14, 0.18], M, [sx * 0.156, 0.76, 0.36], [0.3, 0, 0]);                 // numara plakası
    B([0.18, 0.03, 0.04], METAL, [sx * 0.2, 0.36, 0.02]);                             // sürücü basamağı
    B([0.14, 0.03, 0.04], METAL, [sx * 0.19, 0.46, 0.5]);                             // yolcu basamağı
    B([0.03, 0.03, 0.34], METAL, [sx * 0.13, 0.98, 0.72], [0.08, 0, 0]);              // yolcu tutamağı
  }
  B([0.2, 0.03, 0.6], C, [0, 0.97, 0.93], [-0.32, 0, 0]);                             // arka çamurluk (kalkık)
  B([0.2, 0.08, 0.12], DK, [0, 1.06, 1.18], [-0.32, 0, 0]);                           // stop yuvası
  // egzoz: silindirden aşağı → sağdan arkaya susturucu
  B([0.05, 0.05, 0.28], CHROME, [0.12, 0.56, -0.24], [0.9, 0, 0]);                    // dirsek
  B([0.05, 0.05, 0.5], CHROME, [0.17, 0.58, 0.08], [-0.25, 0, 0]);                    // boru
  cylY(body, 0.065, 0.06, 0.5, '#5a5d61', [0.19, 0.82, 0.62], 10, [Math.PI / 2 - 0.35, 0, 0]);       // susturucu
  cylY(body, 0.035, 0.035, 0.06, '#151516', [0.19, 0.91, 0.86], 8, [Math.PI / 2 - 0.35, 0, 0]);          // çıkış ağzı
  mergeVC(body);
  body.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // stop lambası (ayrı malzeme)
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.03), JEEP_MATS.TAIL); tl.position.set(0, 1.08, 1.245); tl.rotation.x = -0.32; root.add(tl);
  // arka teker
  const wr = new THREE.Group(); wr.name = 'arkaTeker'; wr.position.set(0, R, zr); root.add(wr); wr.add(wheel());
  // ön: yatık direksiyon ekseni (kafa borusundan ön teker göbeğine) → çatal (direksiyonla döner) → teker, çamurluk, gidon, far + numara plakası
  const dx = (R - hy), dz = (-zr - hz), L = Math.hypot(dx, dz), rake = Math.atan2(-dz, -dx);       // eksen: yerel −Y kafa borusundan tekere
  const ax = new THREE.Group(); ax.name = 'çatalEksen'; ax.position.set(0, hy, hz); ax.rotation.x = rake; root.add(ax);
  const fk = new THREE.Group(); fk.name = 'çatal'; ax.add(fk);
  const F = (sz, col, pos, rot) => box(fk, sz, col, pos, rot);
  for (const sx of [-1, 1]) {
    F([0.055, 0.42, 0.055], '#2a2c2e', [sx * 0.09, -0.12, 0]);                       // üst boru (kalın)
    F([0.04, 0.42, 0.04], CHROME, [sx * 0.09, -0.5, 0]);                             // alt boru (krom)
  }
  F([0.24, 0.05, 0.08], METAL, [0, 0.05, 0]); F([0.24, 0.05, 0.08], METAL, [0, -0.1, 0]);            // üçgen tablalar
  F([0.2, 0.025, 0.42], C, [0, -0.3, -0.08], [0.2 - rake, 0, 0]);             // ön çamurluk (yüksek, takım rengi)
  // gidon: yükseltiler + boru + elcikler + manetler
  for (const sx of [-1, 1]) F([0.03, 0.12, 0.03], METAL, [sx * 0.06, 0.12, 0.02]);
  F([MOTO_M.grip * 2 - 0.1, 0.03, 0.03], '#1e1f21', [0, 0.19, 0.04]);
  for (const sx of [-1, 1]) { F([0.12, 0.045, 0.045], '#121213', [sx * (MOTO_M.grip - 0.02), 0.19, 0.04]); F([0.1, 0.012, 0.03], METAL, [sx * (MOTO_M.grip - 0.08), 0.2, -0.04], [0, sx * 0.4, 0]); }
  F([0.26, 0.24, 0.04], '#e9e5d6', [0, -0.08, -0.08], [0, 0, 0]);                    // ön numara plakası (far çevresi)
  F([0.2, 0.06, 0.042], C, [0, 0.02, -0.082]);
  mergeVC(fk);
  const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), JEEP_MATS.LENS); hl.rotation.x = Math.PI / 2; hl.position.set(0, -0.08, -0.11); fk.add(hl);
  const wf = new THREE.Group(); wf.name = 'önTeker'; wf.position.set(0, -L, 0); wf.rotation.x = -rake; fk.add(wf); wf.add(wheel());
  return root;                                                   // başvurular kopyada bağlanır
}

// Takım rengine göre şablon (bir kez) → kopya
export function createMoto(team) {
  const k = team || 'null';
  const T = (cache[k] ||= build(team));
  const r = T.clone(true);
  const find = (n) => r.getObjectByName(n);
  r.userData = { moto: true, wr: find('arkaTeker'), wf: find('önTeker'), fork: find('çatal'), axis: find('çatalEksen'), body: find('gövde'), fx: r, team: k, wheels: [] };
  return r;
}
