import * as THREE from 'three';
import { box, V } from '../core/geo.js';
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
