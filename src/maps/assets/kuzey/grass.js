import * as THREE from 'three';
import { SURF } from './terrain.js';

// Kuzey Vadisi yakın plan ot / buğday (12.172, yalnız görsel): kameranın çevresinde ızgaraya kenetli tek örnekli çizim (gl_InstanceID → hücre),
// konum / yoğunluk / tür gölgelendiricide: yükseklik dokusu (2 m, half float) + maske dokusu (R çayır otu, G buğday; yol / su / yapı izi 0).
// Tutam: 7 ince yaprak (7 üçgen). Uzaklıkla küçülüp söner (yarıçap masaüstü 50 m / telefon 30 m). Rüzgârda salınır. Gölge almaz / atmaz (ucuz).
// Bot görüşü buradan etkilenmez (yalnız buğday tarlası küreleri — vegetation.js fieldCover); oyuncu gözünde çömelen asker otta / buğdayda seçilmez.
export function makeGrass(T, occ, { quality = 'high' } = {}) {
  const R = quality === 'low' ? 30 : 48, SP = quality === 'low' ? 0.8 : 0.62, side = Math.ceil((2 * R) / SP), N = side * side;
  // dokular
  const nx = T.nx, nz = T.nz, hd = new Uint16Array(nx * nz), md = new Uint8Array(nx * nz * 4);
  for (let i = 0; i < nx * nz; i++) hd[i] = THREE.DataUtils.toHalfFloat(T.h[i]);
  const dens = { [SURF.GRASS]: 0.62, [SURF.MEADOW]: 0.95, [SURF.FOREST]: 0.28, [SURF.SAND]: 0.08, [SURF.PLOW]: 0.06 };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, sf = T.surf[k];
    let r = dens[sf] ?? 0, g = sf === SURF.WHEAT ? 1 : 0;
    if (T.road[k] || T.h[k] < 0.6) { r = 0; g = 0; }
    if (T.redge && T.redge[k] < 40) { r = 0; g = 0; }                                         // yol kenarından 1,2 m içerisi
    md[k * 4] = r * 255; md[k * 4 + 1] = g * 255; md[k * 4 + 3] = 255;
  }
  for (const [x0, x1, z0, z1] of occ) {                                                          // yapı / eşya ayak izi: ot zeminden döşemeye çıkmasın
    for (let j = Math.max(0, Math.floor((z0 - T.minZ) / T.cell)); j <= Math.min(nz - 1, Math.ceil((z1 - T.minZ) / T.cell)); j++)
      for (let i = Math.max(0, Math.floor((x0 - T.minX) / T.cell)); i <= Math.min(nx - 1, Math.ceil((x1 - T.minX) / T.cell)); i++) { const k = j * nx + i; md[k * 4] = 0; md[k * 4 + 1] = 0; }
  }
  const hTex = new THREE.DataTexture(hd, nx, nz, THREE.RedFormat, THREE.HalfFloatType); hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.needsUpdate = true;
  const mTex = new THREE.DataTexture(md, nx, nz, THREE.RGBAFormat); mTex.magFilter = mTex.minFilter = THREE.LinearFilter; mTex.needsUpdate = true;
  // tutam geometrisi: 3 yaprak, her biri iki üçgen (alt geniş, uç dar); aTip: yükseklik oranı (salınım / renk)
  const pos = [], tip = [];
  // 7 ince yaprak, tabanda dağınık, uçları dışa eğik (koni / piramit gibi görünmesin)
  for (let k = 0; k < 7; k++) {
    const a = k * 2.399, r0 = 0.05 + (k % 3) * 0.06, bx = Math.cos(a) * r0, bz = Math.sin(a) * r0, la = a + 0.9, cx = Math.cos(la), cz = Math.sin(la), w = 0.035;
    const lean = 0.18 + (k % 2) * 0.12, hk = 0.75 + ((k * 37) % 10) / 40;
    const P = [[bx - w * cx, 0, bz - w * cz], [bx + w * cx, 0, bz + w * cz], [bx * (1 + lean * 6) + 0.002, hk, bz * (1 + lean * 6)]];
    for (const q of [0, 1, 2]) { pos.push(...P[q]); tip.push(P[q][1]); }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.instanceCount = N;
  const U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uH: { value: hTex }, uM: { value: mTex }, uB: { value: new THREE.Vector4(T.minX, T.minZ, T.maxX - T.minX, T.maxZ - T.minZ) },
    uR: { value: R }, uSP: { value: SP }, uSide: { value: side }, uWind: { value: 1 } };
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, side: THREE.DoubleSide, vertexColors: false });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aTip;
uniform vec3 uCam; uniform float uTime, uR, uSP, uSide, uWind; uniform sampler2D uH, uM; uniform vec4 uB;
varying vec3 vGC; varying float vGT;
float gh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <begin_vertex>', `
  float id = float(gl_InstanceID), iz = floor(id / uSide), ix = id - iz * uSide;
  vec2 base = floor(uCam.xz / uSP) * uSP;
  vec2 cell = base + (vec2(ix, iz) - uSide * 0.5) * uSP;
  vec2 jit = vec2(gh(cell), gh(cell + 17.3));
  vec2 wp = cell + (jit - 0.5) * uSP * 0.95;
  vec2 uv = (wp - uB.xy) / uB.zw;
  vec4 msk = texture2D(uM, uv);
  float rnd = gh(cell + 3.7), wheat = step(0.5, msk.g);
  float keep = step(rnd, max(msk.r, msk.g * 1.4));
  float d = length(wp - uCam.xz);
  float fade = 1.0 - smoothstep(uR * 0.62, uR, d);
  float hgt = mix(0.28 + 0.38 * gh(cell + 9.1), 0.92 + 0.28 * gh(cell + 9.1), wheat) * keep * fade;
  float ang = gh(cell + 5.5) * 6.2832, ca = cos(ang), sa = sin(ang);
  vec3 transformed = vec3(position.x * ca - position.z * sa, position.y, position.x * sa + position.z * ca);
  transformed.xz *= mix(1.0, 0.7, wheat) * (0.8 + 0.5 * gh(cell + 2.2));
  transformed.y *= hgt;
  float sw = aTip * aTip * uWind;
  transformed.x += (sin(uTime * 1.7 + wp.x * 0.21 + wp.y * 0.13) * 0.09 + sin(uTime * 3.9 + wp.y * 0.7) * 0.03) * sw * (1.0 + wheat);
  transformed.z += cos(uTime * 1.3 + wp.x * 0.17) * 0.06 * sw * (1.0 + wheat);
  float y0 = texture2D(uH, uv).r;
  transformed += vec3(wp.x, y0 - 0.03, wp.y);
  vec3 gcol = mix(vec3(0.1, 0.2, 0.035), vec3(0.17, 0.29, 0.06), gh(cell + 1.1));
  gcol = mix(gcol, vec3(0.29, 0.24, 0.1), smoothstep(0.6, 0.95, gh(floor(cell / 9.0) + 4.0)) * 0.35);        // kuru ot lekesi
  vec3 wcol = mix(vec3(0.42, 0.33, 0.13), vec3(0.52, 0.42, 0.18), gh(cell + 1.1));
  vGC = mix(gcol, wcol, wheat) * mix(0.62, 1.18, aTip);
  vGT = aTip;`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = vec3(0.0, 1.0, 0.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGC; varying float vGT;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vGC;');
  };
  m.customProgramCacheKey = () => 'kuzey-grass-v1';
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'kuzey-ot';
  mesh.userData.U = U;
  return { mesh, count: N, update(cam, t) { U.uCam.value.copy(cam); U.uTime.value = t; } };
}
