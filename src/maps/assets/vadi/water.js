import * as THREE from 'three';
import { makeVadiWaterMaterial } from './surface.js';

// Nehir yüzeyi (12.169): nehir eksenini izleyen 1 × 2,5 m ızgara, düz su düzlemi (WATER_LEVEL). Köşe derinliği (aDepth) gölgelendiriciye gider
// (sığ / derin rengi, kıyı köpüğü, kıyıda saydamlık sıfıra iner → kıyı çizgisi yumuşak). Dört köşesi de kuru (arazi su üstünde > 25 cm) olan
// hücre çizilmez. Kanyon boyunca harita dışına kadar sürer (kıvrılır, ucu görünmez).
export function riverMesh(terrain, riverX, level, { z0 = -124, z1 = 124, half = 14, dz = 2.5 } = {}) {
  const pos = [], dep = [], idx = [];
  const NW = half * 2 + 1;
  let row = 0;
  for (let z = z0; z <= z1 + 1e-6; z += dz, row++) {
    const cx = Math.round(riverX(z));
    for (let k = 0; k < NW; k++) { const x = cx - half + k; pos.push(x, level, z); dep.push(level - terrain.heightAt(x, z)); }
    if (row > 0) for (let k = 0; k < NW - 1; k++) {
      const a = (row - 1) * NW + k, q = [a, a + 1, a + NW, a + NW + 1];
      if (Math.max(...q.map((i) => dep[i])) < -0.25) continue;
      idx.push(a, a + NW, a + 1, a + 1, a + NW, a + NW + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  const WM = makeVadiWaterMaterial();
  const mesh = new THREE.Mesh(g, WM.material);
  mesh.renderOrder = 1;
  mesh.receiveShadow = true;
  mesh.onBeforeRender = () => { WM.uT.value = performance.now() / 1000; };
  mesh.userData.water = true;
  return mesh;
}
