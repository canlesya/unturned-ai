// 12.229 Bomba modu bombası (tek model: yerde / kurulu / elde / sırtta / uçarken; birinci şahıs sahnesinde de aynısı).
// Düşük poligonlu C4 demeti: üç krem macun kalıbı + iki siyah koli bandı + üstte siyah ateşleme kutusu (yeşil ışıklı tuş takımı, küçük ekran,
// kırmızı lamba) + kalıplara inen iki kablo. Taban y = 0, ileri = −Z (tuş takımı kurana dönük: +Z kenarı), boyut ≈ 0,42 × 0,17 × 0,28 m (12.226 yer modeliyle aynı).
// userData: lampMat (örneğe özgü, yanıp söner), keys (tuş grubu: birinci şahısta basılan tuş parlar), top (tuş takımının üst yüzü, model yereli y)
import * as THREE from 'three';
import { box } from '../core/geo.js';

export const BOMB_SIZE = { w: 0.42, h: 0.17, d: 0.28, top: 0.17 };

export function makeBomb() {
  const g = new THREE.Group();
  const P = '#cdbf93', PD = '#b3a57a', T = '#1d1e1b', K = '#141513';
  for (let i = 0; i < 3; i++) box(g, [0.132, 0.1, 0.27], i === 1 ? PD : P, [-0.137 + i * 0.137, 0.05, 0]);      // macun kalıpları (ortadaki bir ton koyu: ayrı kalıp olduğu seçilsin)
  for (const x of [-0.12, 0.12]) box(g, [0.05, 0.104, 0.276], T, [x, 0.05, 0]);                                     // koli bandı (kalıpları saran iki şerit)
  box(g, [0.2, 0.06, 0.15], K, [0.0, 0.13, 0.03]);                                                                    // ateşleme kutusu
  box(g, [0.09, 0.008, 0.035], '#0d2a14', [-0.035, 0.164, -0.02], null, { emissive: '#2bd94a', emissiveIntensity: 0.55 });      // ekran
  const keys = new THREE.Group(); keys.position.set(0.0, 0.16, 0.05); g.add(keys);                                    // 3 × 3 tuş
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box(keys, [0.026, 0.012, 0.018], '#3a3d36', [-0.045 + c * 0.03, 0.002, -0.022 + r * 0.024]);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#5a1410' });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.022), lampMat);
  lamp.position.set(0.075, 0.168, -0.03); g.add(lamp);
  box(g, [0.008, 0.008, 0.09], '#b8261c', [0.07, 0.105, 0.105], [0.5, 0, 0]);                                       // kablolar (kutudan kalıplara)
  box(g, [0.008, 0.008, 0.09], '#2a5bb8', [0.085, 0.105, 0.105], [0.5, 0, 0]);
  g.userData = { lampMat, lamp, keys, top: 0.17 };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}
