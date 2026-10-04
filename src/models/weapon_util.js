import * as THREE from 'three';
import { box, V, mat } from '../core/geo.js';
import { C } from '../core/palette.js';

// Silah modelleri için ortak yardımcılar.
// userData sözleşmesi: name, hold, gripR, gripL, muzzle, length
//   mag: şarjör alt grubu (animasyonda dışarı çıkar) · bolt: { g, ... } sürgü kolu alt grubu · belt: kemer vb.
export const M = { metalness: 0.15, roughness: 0.6 };

export function finish(g, meta) {
  g.userData = {
    ...meta,
    gripR: V(...meta.gripR),
    gripL: meta.gripL ? V(...meta.gripL) : null,
    muzzle: V(...meta.muzzle),
  };
  return g;
}

// Ön arpacık / ön kule: birleştirmeden ayrı bir alt grup olarak tutulur. Demir nişanda görünür, optik (red dot/holo...) takılıyken
// nişan çizgisini kapatmasın diye gizlenir (bkz. createWeapon).
export function frontSight(g, size, color, pos, mat) {
  const fs = new THREE.Group();
  fs.userData.frontSight = true;
  box(fs, size, color, pos, null, mat);
  g.add(fs);
  return fs;
}

export function railTicks(g, z0, z1, y, n, color = C.black) {
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / (n - 1);
    box(g, [0.026, 0.008, 0.012], color, [0, y, z]);
  }
}

// Şarjör alt grubu: animasyon bunu aşağı çekip geri sokar (mergeStatic alt grupları ayrı tutar)
export function magGroup(g) {
  const mg = new THREE.Group();
  g.add(mg);
  return mg;
}

// ── Ortak ayrıntı yardımcıları (nişan hattının üstüne eklenmez: yanlara / alta / namlu ucuna) ──
// Şarjör yan kaburgaları: mg grubunun yan yüzlerinde yatay çizgiler (w: şarjör genişliği, d: derinliği, yTop: ilk kaburga yüksekliği)
export function magRibs(mg, w, d, yTop, z, n, step = 0.03, color = C.black) {
  for (let i = 0; i < n; i++) for (const sx of [-1, 1]) box(mg, [0.004, 0.005, d * 0.8], color, [sx * (w / 2), yTop - i * step, z]);
}
// Çıkıntılı yan perçin/vida (iki yana)
export function studs(g, pts, color = C.steel, sz = 0.008, half = 0.026) {
  for (const [y, z] of pts) for (const sx of [-1, 1]) box(g, [0.004, sz, sz], color, [sx * half, y, z]);
}
// Yan havalandırma yarıkları (koyu): y merkez, z0'dan başlayarak n adet, adım step
export function vents(g, y, z0, n, step, half, h = 0.03, d = 0.012, color = '#0a0a0c') {
  for (let i = 0; i < n; i++) for (const sx of [-1, 1]) box(g, [0.004, h, d], color, [sx * half, y, z0 - i * step]);
}
// Kabza dokusu: yatay oluklar
export function gripTexture(g, y0, z, w, h, n = 5, tilt = 0.3, color = '#101012') {
  for (let i = 0; i < n; i++) for (const sx of [-1, 1]) box(g, [0.004, 0.004, 0.044], color, [sx * (w / 2 + 0.001), y0 - i * (h / n), z], [tilt, 0, 0]);
}
// Askı halkası
export function sling(g, pos, color = C.steel) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0025, 4, 8), mat(color, { metalness: 0.4 }));
  t.position.set(...pos); t.rotation.y = Math.PI / 2; t.castShadow = true; g.add(t);
}
