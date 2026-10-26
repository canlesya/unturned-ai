import * as THREE from 'three';

// Kuzey Vadisi yapı yüzeyi (12.172): MapBuilder'ın birleşik köşe-renkli ağı + dünya koordinatlı prosedürel gölgelendirici (UV yok, çizim çağrısı artmaz).
// aKind alt 4 bit = sınıf (KK), üst 4 bit = parça tohumu (her tuğla duvar / kalas kendi tonunda). Ilıman dağ köyü + sanayi paleti.
export const KK = { PLAIN: 0, PLASTER: 1, BRICK: 2, PLANK: 3, CORR: 4, CONC: 5, TILE: 6, STONE: 7, METAL: 8, SHEET: 9, BARK: 10, LEAF: 11, ASPH: 12, WIN: 13, LOG: 14, RUST: 15 };

const NOISE = `
float kh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float kn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(kh(i), kh(i+vec2(1.,0.)), f.x), mix(kh(i+vec2(0.,1.)), kh(i+vec2(1.,1.)), f.x), f.y); }
float kf(vec2 p){ return kn(p) * 0.6 + kn(p * 2.07 + 3.1) * 0.28 + kn(p * 4.3 + 7.7) * 0.12; }
`;

export function makeKuzeyMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nattribute float aGnd;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vKind;\nvarying float vGnd;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvKind = aKind;\nvGnd = aGnd;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
varying float vKind;
varying float vGnd;
float gRough = -1.0;
float gMetal = -1.0;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);
  float aaF = 1.0 - smoothstep(0.012, 0.035, pxw), aaM = 1.0 - smoothstep(0.03, 0.09, pxw), aaL = 1.0 - smoothstep(0.2, 0.8, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.35);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  float hy = vWP.y - vGnd;                                      // zeminden yükseklik (taban kirlenmesi / ıslaklık)
  vec3 c = diffuseColor.rgb;
  if (kind == 1.0) {                                           // SIVA: ince pürüz, yağmur izi, taban kiri
    c *= 0.9 + 0.12 * kf(wq * 1.3 + p * 0.9 + seed) + 0.05 * (kn(wq * 14.0 + p * 14.0) - 0.5) * aaF;
    c *= 1.0 - 0.2 * smoothstep(0.55, 0.9, kf(vec2(u * 0.7, vWP.y * 0.12) + 3.0 + seed)) * side;
  } else if (kind == 2.0) {                                    // TUĞLA: 0,25 × 0,075 m, derz, tuğla başına ton
    if (side > 0.5) {
      vec2 bq = vec2(u / 0.25, vWP.y / 0.075); bq.x += 0.5 * mod(floor(bq.y), 2.0);
      vec2 bf = fract(bq), bi = floor(bq);
      float ln = min(min(bf.x, 1.0 - bf.x) * 0.25, min(bf.y, 1.0 - bf.y) * 0.075);
      c *= 0.78 + 0.32 * kh(bi + seed) * aaF;
      c = mix(c, vec3(0.42, 0.4, 0.37), (1.0 - smoothstep(0.004, 0.009, ln)) * aaF * 0.8);
    } else c *= 0.9 + 0.1 * kn(p * 3.0);
    c *= 1.0 - 0.16 * smoothstep(0.55, 0.85, kf(wq * 0.4 + 7.0)) * side;
  } else if (kind == 3.0) {                                    // KALAS: düşey tahta (cephe) / yatay döşeme, ek çizgisi
    float pv = side > 0.5 ? u : vWP.x;
    float pl = floor(pv / 0.18), edge = abs(fract(pv / 0.18) - 0.5);
    c *= 0.8 + 0.3 * kh(vec2(pl, seed));
    c *= 0.92 + 0.12 * kn(vec2(pv * 30.0, (side > 0.5 ? vWP.y : vWP.z) * 1.6)) * aaF;
    c *= 1.0 - 0.32 * smoothstep(0.42, 0.5, edge) * aaM;
  } else if (kind == 4.0) {                                    // OLUKLU SAC (fabrika / ambar): 0,15 m oluk, pas akıntısı
    float pv = side > 0.5 ? u : vWP.x;
    float w = sin(pv / 0.15 * 6.2832) * 0.5 + 0.5;
    c *= mix(1.0, 0.78 + 0.32 * w, aaM);
    c = mix(c, vec3(0.33, 0.18, 0.09), smoothstep(0.6, 0.85, kf(vec2(pv * 0.9, vWP.y * 0.25) + seed)) * 0.55 * side);
    gRough = 0.6; gMetal = 0.3;
  } else if (kind == 5.0) {                                    // BETON: kalıp izi, leke, taban ıslaklığı
    c *= 0.88 + 0.14 * kf(wq * 0.8 + p * 0.8 + seed) + 0.05 * (kn(wq * 9.0 + p * 9.0) - 0.5) * aaM;
    if (side > 0.5) {
      c *= 1.0 - 0.08 * smoothstep(0.45, 0.5, abs(fract(vWP.y / 0.6) - 0.5)) * aaM;
      c *= 1.0 - 0.08 * smoothstep(0.47, 0.5, abs(fract(u / 1.2) - 0.5)) * aaM;
      c *= 1.0 - 0.22 * smoothstep(0.55, 0.85, kf(vec2(u * 0.8, vWP.y * 0.2) + 9.0));
    }
  } else if (kind == 6.0) {                                    // KİREMİT: sıra + kiremit başı ton
    float ra = abs(n.x) > abs(n.z) ? vWP.z : vWP.x;
    float row = fract(vWP.y / 0.16), col = abs(fract(ra / 0.25) - 0.5);
    c *= 0.82 + 0.22 * kh(vec2(floor(vWP.y / 0.16), floor(ra / 0.25)) + seed) * aaF;
    c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.2, row)) * aaM;
    c *= 1.0 - 0.1 * smoothstep(0.38, 0.5, col) * aaM;
    c = mix(c, c * vec3(0.6, 0.66, 0.5), smoothstep(0.55, 0.85, kf(p * 0.4 + 2.0)) * 0.5);                               // yosun
  } else if (kind == 7.0) {                                    // TAŞ ÖRGÜ (köprü / kilise / istinat): düzensiz taş + harç
    if (side > 0.5) {
      vec2 bq = vec2(u / 0.55, vWP.y / 0.32); bq.x += 0.37 * mod(floor(bq.y), 3.0);
      vec2 bf = fract(bq), bi = floor(bq);
      float ln = min(min(bf.x, 1.0 - bf.x) * 0.55, min(bf.y, 1.0 - bf.y) * 0.32);
      c *= 0.7 + 0.38 * kh(bi + seed) * aaL;
      c *= 1.0 - 0.42 * (1.0 - smoothstep(0.01, 0.028, ln)) * aaM;
      c = mix(c, c * vec3(0.7, 0.78, 0.62), smoothstep(0.6, 0.85, kf(wq * 0.6 + 3.0)) * 0.55);
    } else c *= 0.88 + 0.14 * kn(p * 2.0);
  } else if (kind == 8.0) {                                    // BOYALI ÇELİK: hafif çizik, pas noktası
    c *= 0.92 + 0.1 * kf(wq * 1.1 + p * 0.6 + seed);
    c = mix(c, vec3(0.3, 0.15, 0.08), smoothstep(0.72, 0.9, kf(wq * 3.0 + p * 2.0 + 11.0)) * 0.5);
    gRough = 0.5; gMetal = 0.45;
  } else if (kind == 9.0) {                                    // SAC ÇATI: dikiş çizgisi (0,5 m), soluk
    float ra = abs(n.x) > abs(n.z) ? vWP.z : vWP.x;
    c *= 1.0 - 0.22 * smoothstep(0.44, 0.5, abs(fract(ra / 0.5) - 0.5)) * aaM;
    c *= 0.9 + 0.14 * kf(p * 0.5 + seed);
    gRough = 0.55; gMetal = 0.35;
  } else if (kind == 10.0) {                                   // AĞAÇ KABUĞU
    c *= 0.82 + 0.26 * kn(vec2(u * 9.0 + seed, vWP.y * 1.2));
    c *= 1.0 - 0.2 * step(0.8, kn(vec2(u * 22.0, vWP.y * 0.8))) * aaM;
  } else if (kind == 11.0) {                                   // YAPRAK / ÇİT
    c *= 0.8 + 0.3 * kh(floor((side > 0.5 ? wq : p) * 4.0) + seed) * aaF + 0.1 * kf(p * 0.5);
  } else if (kind == 12.0) {                                   // ASFALT / PİST KAPLAMASI
    c *= 0.88 + 0.14 * kn(p * 3.0) * aaF + 0.08 * kf(p * 0.2);
    gRough = 0.92;
  } else if (kind == 13.0) {                                   // CAM / PENCERE: koyu, gök yansıması (çevre haritası), kayıt (çerçeve) çizgisi
    c *= 0.85 + 0.25 * smoothstep(0.3, 0.9, fract(vWP.y * 0.21 + u * 0.13 + seed * 0.37));
    gRough = 0.12; gMetal = 0.6;
  } else if (kind == 14.0) {                                   // KÜTÜK (kesit / kabuk): yatay halkalar
    c *= 0.8 + 0.28 * kn(vec2(u * 4.0 + seed, vWP.y * 14.0)) * aaF;
  } else if (kind == 15.0) {                                   // PASLI SAC / ENKAZ
    c *= 0.84 + 0.2 * kf(wq * 1.3 + p * 0.7 + seed);
    c = mix(c, vec3(0.32, 0.16, 0.07), smoothstep(0.45, 0.8, kf(wq * 2.2 + p * 1.6 + 5.0)) * 0.75);
    gRough = 0.8; gMetal = 0.25;
  }
  if (kind != 13.0 && kind != 11.0) c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.5, hy)) * side;            // taban: toprak / ıslaklık
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;');
  };
  material.customProgramCacheKey = () => 'kuzey-surface-v1';
  return material;
}
