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
