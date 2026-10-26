import * as THREE from 'three';

// Kuzey Vadisi bitki örtüsü + kaya varlıkları (12.172; paylaşılabilir, harita önekli dosya). Hepsi köşe-renkli, düşük poligon, 1 m ölçekli
// (örnekte ölçeklenir). Her tür iki kademe: L0 (yakın, gölgeli) / L1 (uzak, kaba silüet). Örnekleme: yığın (chunk) başına tür × kademe bir InstancedMesh.
// Türler: 'pine' (çam: ince uzun, dalları kat kat), 'spruce' (ladin: koyu, sık koni), 'birch' (huş: beyaz gövde, açık yaprak), 'oak' (yayvan yapraklı),
// 'bush' (çalı), 'rock' (kaya: bozuk ikosahedron). Ağaç gövdesi çarpışma kutusu + tepe yaprak küresi (bot görüşü) kurulumda eklenir.

const C = (h) => new THREE.Color(h);
function paint(g, col, jitter = 0.06, seed = 1) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3), c = new THREE.Color();
  let s = seed;
  for (let i = 0; i < n; i += 3) {                                  // üçgen başına ton (düz gölgeli görünüm)
    s = (s * 16807) % 2147483647; const k = 1 + ((s / 2147483647) - 0.5) * 2 * jitter;
    c.copy(col).multiplyScalar(k);
    for (let v = 0; v < 3 && i + v < n; v++) { a[(i + v) * 3] = c.r; a[(i + v) * 3 + 1] = c.g; a[(i + v) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function cone(r, h, y, seg, col, jit, seed, tilt = 0) {
  const g0 = new THREE.ConeGeometry(r, h, seg, 1, false), g = g0.index ? g0.toNonIndexed() : g0;
  g.rotateY(seed * 0.7); if (tilt) g.rotateZ(tilt);
  g.translate(0, y + h / 2, 0);
  // kenar köşelerini hafif boz (kusursuz koni olmasın)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const yy = p.getY(i); if (yy < y + 0.02) { const k = 1 + Math.sin(i * 12.9898 + seed) * 0.12; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, yy - Math.abs(Math.sin(i * 78.233 + seed)) * h * 0.08); } }
  return paint(g, col, jit, seed * 31 + 7);
}
function blob(r, x, y, z, col, detail = 0, seed = 1, sy = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 7.1 + p.getY(i) * 5.3 + p.getZ(i) * 3.7 + seed) * 0.13; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * sy, p.getZ(i) * k); }
  g.translate(x, y, z);
  return paint(g, col, 0.09, seed * 13 + 3);
}
function trunk(r0, r1, h, col, seg = 6) {
  const g0 = new THREE.CylinderGeometry(r1, r0, h, seg, 1, true), g = g0.index ? g0.toNonIndexed() : g0; g.translate(0, h / 2, 0);
  return paint(g, col, 0.05, 5);
}
function merge(list) {
  const geos = list.map((g) => { g.deleteAttribute('uv'); return g; });
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), top = new Float32Array(n);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (let i = 0; i < n; i++) top[i] = Math.max(0, pos[i * 3 + 1]);                      // rüzgâr salınımı ağırlığı (yükseklik)
  out.setAttribute('aSway', new THREE.BufferAttribute(top, 1));
  out.computeVertexNormals(); out.computeBoundingSphere();
  return out;
}

// Türler (yükseklik 1 = ağacın boyu; örnek ölçeği gerçek boyu verir). trunkH: gövde çarpışma payı (oran), crown: [merkez y oranı, yarıçap oranı] bot görüşü.
export const FLORA = {
  pine: {
    h: [15, 24], trunkR: 0.022, trunkH: 0.55, crown: [0.68, 0.17],
    L0: () => merge([trunk(0.024, 0.008, 1.0, C('#5a4636')),
      cone(0.2, 0.32, 0.36, 7, C('#3e5530'), 0.1, 1), cone(0.165, 0.28, 0.52, 7, C('#43592f'), 0.1, 2), cone(0.13, 0.24, 0.66, 7, C('#48602f'), 0.1, 3), cone(0.085, 0.2, 0.8, 6, C('#4f6733'), 0.1, 4)]),
    L1: () => merge([trunk(0.022, 0.01, 0.5, C('#4d3d30'), 4), cone(0.19, 0.42, 0.34, 5, C('#3f5530'), 0.05, 1), cone(0.12, 0.3, 0.66, 5, C('#465d30'), 0.05, 2)]),
  },
  spruce: {
    h: [12, 21], trunkR: 0.024, trunkH: 0.3, crown: [0.45, 0.2],
    L0: () => merge([trunk(0.026, 0.01, 0.4, C('#4a3b2f')),
      cone(0.24, 0.36, 0.08, 8, C('#2f4628'), 0.1, 5), cone(0.2, 0.32, 0.3, 8, C('#324a29'), 0.1, 6), cone(0.15, 0.28, 0.5, 7, C('#36502b'), 0.1, 7), cone(0.1, 0.24, 0.68, 7, C('#3b552d'), 0.1, 8), cone(0.05, 0.16, 0.86, 5, C('#41592f'), 0.1, 9)]),
    L1: () => merge([cone(0.24, 0.62, 0.06, 5, C('#30472a'), 0.05, 5), cone(0.12, 0.4, 0.6, 5, C('#38512c'), 0.05, 6)]),
  },
  birch: {
    h: [10, 16], trunkR: 0.02, trunkH: 0.5, crown: [0.68, 0.2],
    L0: () => merge([trunk(0.022, 0.01, 0.92, C('#d8d4c8'), 6),
      blob(0.16, 0.03, 0.62, 0.02, C('#7f9a45'), 1, 1, 1.2), blob(0.13, -0.08, 0.76, -0.04, C('#8aa34b'), 0, 2, 1.25), blob(0.12, 0.07, 0.82, 0.07, C('#94ad50'), 0, 3, 1.2), blob(0.1, -0.02, 0.5, 0.09, C('#7a9442'), 0, 4)]),
    L1: () => merge([trunk(0.02, 0.012, 0.6, C('#cfcabd'), 4), blob(0.2, 0, 0.68, 0, C('#86a049'), 0, 1, 1.3)]),
  },
  oak: {
    h: [11, 17], trunkR: 0.035, trunkH: 0.38, crown: [0.62, 0.3],
    L0: () => merge([trunk(0.04, 0.022, 0.55, C('#54442f'), 7),
      blob(0.24, 0, 0.6, 0, C('#5d7536'), 1, 1, 0.85), blob(0.18, 0.17, 0.66, 0.06, C('#66803a'), 0, 2, 0.9), blob(0.17, -0.15, 0.68, -0.08, C('#56702f'), 0, 3, 0.9), blob(0.15, 0.03, 0.84, -0.04, C('#6d8740'), 0, 4, 0.9)]),
    L1: () => merge([trunk(0.04, 0.025, 0.45, C('#4c3e2c'), 4), blob(0.32, 0, 0.66, 0, C('#5f7736'), 0, 1, 0.8)]),
  },
  bush: {
    h: [1.2, 2.2], trunkR: 0, trunkH: 0, crown: [0.42, 0.45],
    L0: () => merge([blob(0.42, 0, 0.38, 0, C('#56693a'), 1, 1, 0.8), blob(0.3, 0.28, 0.32, 0.1, C('#617540'), 0, 2, 0.8), blob(0.28, -0.22, 0.3, -0.16, C('#4d6034'), 0, 3, 0.8)]),
    L1: () => merge([blob(0.5, 0, 0.38, 0, C('#56693a'), 0, 1, 0.75)]),
  },
  rock: {
    h: [1.4, 4.5], trunkR: 0, trunkH: 0, crown: null,
    L0: () => { const g = blob(0.5, 0, 0.3, 0, C('#7a776f'), 1, 4, 0.62); return merge([g]); },
    L1: () => merge([blob(0.5, 0, 0.3, 0, C('#76736b'), 0, 4, 0.62)]),
  },
};

// Bitki malzemesi: köşe rengi + hafif rüzgâr salınımı (örnek başına evre); kaya salınmaz (aSway 0 değil ama malzemesi ayrı)
export function makeFloraMaterial(sway = true) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
  const U = { uTime: { value: 0 } };
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSway;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${sway ? `#ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
  float sw = aSway * aSway;
  transformed.x += sin(uTime * 1.1 + ph) * 0.018 * sw + sin(uTime * 2.7 + ph * 1.7) * 0.006 * sw;
  transformed.z += cos(uTime * 0.9 + ph) * 0.014 * sw;
#endif` : ''}`);
  };
  m.customProgramCacheKey = () => 'kuzey-flora-' + (sway ? 's' : 'r');
  return m;
}

// Orman: yığın başına tür × kademe örnekli ağ. trees = [{x, y, z, s (boy m), ry, k (tür)}]. near/far: kademe uzaklıkları.
export class Forest {
  constructor(trees, { chunk = 200, quality = 'high' } = {}) {
    this.group = new THREE.Group(); this.group.name = 'kuzey-orman';
    this.D = quality === 'low' ? [95, 560] : [165, 1150];
    this.mat = makeFloraMaterial(true); this.rockMat = makeFloraMaterial(false);
    const geo = {}; for (const k in FLORA) geo[k] = [FLORA[k].L0(), FLORA[k].L1()];
    const by = new Map();
    for (const t of trees) { const key = Math.floor(t.x / chunk) + ',' + Math.floor(t.z / chunk); let a = by.get(key); if (!a) by.set(key, (a = [])); a.push(t); }
    this.cells = [];
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (const [key, list] of by) {
      const [ci, cj] = key.split(',').map(Number), cell = { x0: ci * chunk, z0: cj * chunk, size: chunk, lod: -1, L: [[], []] };
      const kinds = {}; for (const t of list) (kinds[t.k] ||= []).push(t);
      for (const k in kinds) for (let l = 0; l < 2; l++) {
        const arr = kinds[k];
        const im = new THREE.InstancedMesh(geo[k][l], k === 'rock' ? this.rockMat : this.mat, arr.length);
        arr.forEach((t, i) => {
          const s = t.s, wide = k === 'rock' ? (t.w || 1.3) : 1;
          M.compose(p.set(t.x, t.y - (k === 'rock' ? s * 0.12 : 0.15), t.z), q.setFromEuler(e.set(k === 'rock' ? t.tilt || 0 : 0, t.ry, 0)), sc.set(s * wide, s, s * (k === 'rock' ? (t.d || 1.1) : 1)));
          im.setMatrixAt(i, M);
        });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
        im.castShadow = l === 0; im.receiveShadow = l === 0; im.visible = false;
        this.group.add(im); cell.L[l].push(im);
      }
      this.cells.push(cell);
    }
    this.count = trees.length;
  }
  update(cam, t = 0) {
    this.mat.userData.U.uTime.value = t;
    for (const c of this.cells) {
      const dx = Math.max(c.x0 - cam.x, 0, cam.x - c.x0 - c.size), dz = Math.max(c.z0 - cam.z, 0, cam.z - c.z0 - c.size), d = Math.hypot(dx, dz);
      const l = d < this.D[0] ? 0 : d < this.D[1] ? 1 : 2;
      if (l === c.lod) continue;
      c.lod = l;
      for (const m of c.L[0]) m.visible = l === 0;
      for (const m of c.L[1]) m.visible = l === 1;
    }
  }
}
