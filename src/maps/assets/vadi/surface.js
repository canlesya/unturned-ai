import * as THREE from 'three';

// VADİ v3 yüzeyleri (12.169) — doku dosyası / UV yok, dünya koordinatlı prosedürel gölgelendiriciler (telefon için 2-3 oktav, ince çizgiler piksel altına inince söner):
//   makeVadiMaterial()        yapı / eşya (MapBuilder.surface.material): tüm düz parçalar TEK köşe-renkli ağda, aKind alt 4 bit sınıf, üst 4 bit parça tohumu
//   makeVadiGroundMaterial()  arazi: köşe rengi + aAux (patika, ıslak kıyı, kaya, tarla) ağırlıkları
//   makeVadiWaterMaterial()   nehir: köşe derinliği (aDepth) → renk / saydamlık / kıyı köpüğü, akış yönünde kayan dalga normali
//   makeInstMaterial(kind)    örnekli (InstancedMesh) ağaç / kaya / çimen: örnek rengi + aynı sınıf gölgelendiricisi (instanceMatrix dahil dünya konumu)
export const VK = { PLAIN: 0, STONE: 1, PLASTER: 2, WOOD: 3, PLANK: 4, ROOF: 5, ROOFM: 6, METAL: 7, CONC: 8, ROCK: 9, BARK: 10, LEAF: 11, HAY: 12, CANVAS: 13, PAINT: 14, CRATE: 15 };

// Uyumlu palet (tek yerde): yapılar sınıfını renkten değil açıkça (withKind / opt.kind) alır; bu tablo yalnız renkle gelen parçalar için yedek.
export const PAL = {
  stone: '#8f897c', stoneD: '#77715f', stoneL: '#a59e8c', cap: '#9c9686', plinth: '#7d776a',
  plaster: '#e3d9bf', plasterB: '#d8c9a2', plasterC: '#cfd2c4', trim: '#efe9da',
  wood: '#7a5a38', woodD: '#5a3f26', woodL: '#9c7a52', plank: '#94724a', beam: '#4f3722',
  barnRed: '#8e3a2c', barnBlue: '#3c5f8a', roofTile: '#9a4a34', roofTileB: '#7d5a40', roofSlate: '#5d6470', roofMetal: '#6a6f75', roofMoss: '#5e6a48',
  conc: '#9a9c92', concD: '#7c7f76', metal: '#8a8f95', metalD: '#4e5358', rust: '#8a5a3a',
  rock: '#8a877e', rockD: '#6f6c64', rockL: '#a39e92', bark: '#5e4329', barkB: '#6a4e33',
  hay: '#d2b155', hayD: '#b99a42', canvas: '#cdbf95', canvasG: '#a7b38a', canvasB: '#9fb0c8', sack: '#c9b98e',
  blue: '#2c5aa0', red: '#b0332a', glow: '#ffd98a', glass: '#a9d0e0',
};
const KIND_OF = new Map();
const put = (kind, ...cols) => { for (const c of cols) KIND_OF.set(c.toLowerCase(), kind); };
put(VK.STONE, PAL.stone, PAL.stoneD, PAL.stoneL, PAL.cap, PAL.plinth);
put(VK.PLASTER, PAL.plaster, PAL.plasterB, PAL.plasterC, PAL.trim);
put(VK.WOOD, PAL.wood, PAL.woodD, PAL.woodL, PAL.beam, PAL.barnRed, PAL.barnBlue);
put(VK.PLANK, PAL.plank);
put(VK.ROOF, PAL.roofTile, PAL.roofTileB, PAL.roofSlate, PAL.roofMoss);
put(VK.ROOFM, PAL.roofMetal);
put(VK.CONC, PAL.conc, PAL.concD);
put(VK.METAL, PAL.metal, PAL.metalD, PAL.rust);
put(VK.ROCK, PAL.rock, PAL.rockD, PAL.rockL);
put(VK.BARK, PAL.bark, PAL.barkB);
put(VK.HAY, PAL.hay, PAL.hayD);
put(VK.CANVAS, PAL.canvas, PAL.canvasG, PAL.canvasB, PAL.sack);
put(VK.PAINT, PAL.blue, PAL.red);
export function vadiKindOf(hex) { const k = KIND_OF.get(String(hex).toLowerCase()); return k === undefined ? VK.PLAIN : k; }

const NOISE = `
float vh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(vh(i), vh(i+vec2(1.,0.)), f.x), mix(vh(i+vec2(0.,1.)), vh(i+vec2(1.,1.)), f.x), f.y); }
float vf(vec2 p){ return vn(p) * 0.6 + vn(p * 2.07 + 3.1) * 0.28 + vn(p * 4.3 + 7.7) * 0.12; }
`;

// Sınıf gölgelendiricisi (yapı + örnekli ağlar ortak): c = taban renk, n = dünya normali, P = dünya konumu, kind / seed
const KINDS = `
vec3 vadiKind(vec3 c, vec3 n, vec3 P, float kind, float seed, float pxw, inout float gRough, inout float gMetal) {
  float aaF = 1.0 - smoothstep(0.012, 0.035, pxw), aaM = 1.0 - smoothstep(0.03, 0.09, pxw);
  float up = smoothstep(0.6, 0.85, n.y), side = 1.0 - smoothstep(0.35, 0.6, abs(n.y));
  vec2 hz = normalize(vec2(-n.z, n.x) + vec2(1e-4, 0.0));
  float u = dot(P.xz, hz);
  vec2 p = P.xz, wq = vec2(u, P.y);
  if (kind == 1.0) {                                           // kuru taş / kâgir: düzensiz sıralı taşlar, derz, altta yosun
    vec2 q = side > 0.5 ? wq : p;
    float rh = 0.27 + 0.09 * vh(vec2(floor(q.y / 0.3), 3.0));
    float row = floor(q.y / rh);
    float sl = 0.44 + 0.3 * vh(vec2(row, 7.0));
    float sx = q.x / sl + vh(vec2(row, 1.0)) * 3.0;
    float cell = floor(sx);
    vec2 f = vec2(fract(sx), fract(q.y / rh));
    float edge = min(min(f.x, 1.0 - f.x) * sl, min(f.y, 1.0 - f.y) * rh);
    c *= 0.84 + 0.28 * vh(vec2(cell, row) + seed);
    c *= 0.94 + 0.1 * vf(q * 3.1 + cell);
    c *= 1.0 - 0.34 * (1.0 - smoothstep(0.012, 0.03, edge)) * aaF * (1.0 - up * 0.6);
    c = mix(c, c * vec3(0.74, 0.9, 0.6), smoothstep(0.58, 0.82, vf(q * 0.6 + 4.0)) * (0.3 + 0.7 * up) * 0.45);
  } else if (kind == 2.0) {                                    // sıva: ince pürüz, yağmur izi, alt sıçrama kiri
    c *= 0.95 + 0.07 * vf(wq * 2.3 + p * 1.7 + seed) + 0.03 * (vn(wq * 19.0 + p * 19.0) - 0.5) * aaM;
    c *= 1.0 - 0.08 * smoothstep(0.6, 0.85, vn(vec2(u * 1.4, P.y * 0.18) + seed * 3.0)) * side;
    c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.9, fract(P.y / 3.3) * 3.3)) * side;
  } else if (kind == 3.0) {                                    // tahta kaplama: dikey tahtalar, damar, aralık gölgesi
    float bw = 0.22;
    float bu = side > 0.5 ? u : (abs(n.x) > 0.5 ? P.z : P.x);
    float bi = floor(bu / bw), bf = fract(bu / bw);
    c *= 0.85 + 0.25 * vh(vec2(bi, seed));
    float along = side > 0.5 ? P.y : (abs(n.x) > 0.5 ? P.x : P.z);
    c *= 0.92 + 0.14 * vn(vec2(bi * 3.7 + bf * 9.0, along * 1.3)) * aaM + 0.05 * (vn(vec2(bf * 40.0, along * 4.0)) - 0.5) * aaF;
    c *= 1.0 - 0.3 * (1.0 - smoothstep(0.035, 0.07, min(bf, 1.0 - bf))) * aaM;
    c = mix(c, c * vec3(0.8, 0.82, 0.78), smoothstep(0.6, 0.85, vf(wq * 0.4 + 3.0)) * 0.35);
  } else if (kind == 4.0 || kind == 15.0) {                    // döşeme / sandık tahtası: yatay tahtalar
    float pw = kind == 15.0 ? 0.17 : 0.2;
    float pv = up > 0.5 ? (fract(seed * 0.37) > 0.5 ? P.x : P.z) : P.y;
    float pi = floor(pv / pw), pf = fract(pv / pw);
    c *= 0.87 + 0.22 * vh(vec2(pi, seed));
    float along = up > 0.5 ? (fract(seed * 0.37) > 0.5 ? P.z : P.x) : u;
    c *= 0.93 + 0.12 * vn(vec2(along * 1.6, pi * 5.0 + pf * 12.0)) * aaM;
    c *= 1.0 - 0.28 * (1.0 - smoothstep(0.03, 0.07, min(pf, 1.0 - pf))) * aaM;
  } else if (kind == 5.0) {                                    // kiremit: eğim boyunca sıralar, şaşırtmalı derz, yosun
    float ry = P.y / 0.22;
    float rr = floor(ry), rf = fract(ry);
    float tx = u / 0.28 + 0.5 * mod(rr, 2.0);
    float ti = floor(tx), tf = fract(tx);
    c *= 0.87 + 0.2 * vh(vec2(ti, rr) + seed);
    c *= 1.0 - 0.3 * smoothstep(0.72, 0.98, rf) * aaM;
    c *= 1.0 - 0.18 * (1.0 - smoothstep(0.03, 0.08, min(tf, 1.0 - tf))) * aaM;
    c = mix(c, c * vec3(0.72, 0.82, 0.58), smoothstep(0.62, 0.86, vf(wq * 0.5 + p * 0.5)) * 0.3);
  } else if (kind == 6.0) {                                    // oluklu sac: eğim yönünde oluk, pas lekesi
    float rib = abs(fract(u / 0.18) - 0.5) * 2.0;
    c *= mix(1.0, 0.85 + 0.2 * smoothstep(0.15, 0.85, rib), aaM);
    c *= 0.92 + 0.12 * vf(wq * 0.35 + p * 0.35 + seed);
    c = mix(c, c * vec3(0.94, 0.8, 0.7), smoothstep(0.68, 0.88, vf(vec2(u * 2.5, P.y * 1.2) + 9.0)) * 0.45);
    gMetal = 0.25; gRough = 0.6;
  } else if (kind == 7.0) {                                    // galvaniz / metal: panel ek yeri, pas akıntısı
    float pan = abs(fract(u / 0.9) - 0.5) * 2.0;
    c *= 1.0 - 0.12 * smoothstep(0.92, 1.0, pan) * aaM;
    c *= 1.0 - 0.1 * (1.0 - smoothstep(0.01, 0.03, abs(fract(P.y / 1.2) - 0.5) * 0.4)) * aaM * side;
    c *= 0.93 + 0.1 * vf(wq * vec2(0.6, 0.2) + seed);
    c = mix(c, vec3(0.5, 0.34, 0.22), smoothstep(0.62, 0.86, vf(vec2(u * 2.4, P.y * 0.25) + seed * 5.0)) * 0.32 * side);
    gMetal = 0.35; gRough = 0.55;
  } else if (kind == 8.0) {                                    // kalıp betonu: yatay kalıp izi, su lekesi
    c *= 0.91 + 0.13 * vf(wq * 0.8 + p * 0.8 + seed);
    c *= 1.0 - 0.12 * (1.0 - smoothstep(0.01, 0.025, abs(fract(P.y / 0.3) - 0.5) * 0.3)) * aaM * side;
    c *= 1.0 - 0.12 * smoothstep(0.55, 0.85, vn(vec2(u * 1.3, P.y * 0.2) + 6.0)) * side;
    c = mix(c, c * vec3(0.78, 0.88, 0.66), smoothstep(0.62, 0.86, vf(wq * 0.7 + p)) * 0.3);
  } else if (kind == 9.0) {                                    // kaya: tabaka, çatlak, üstte liken
    float st = vn(vec2(dot(P.xz, vec2(0.6, 0.8)) * 0.8, P.y * 4.0) + seed);
    c *= 0.84 + 0.26 * st;
    c *= 0.9 + 0.15 * vf(p * 1.7 + P.y * 1.3 + seed);
    c = mix(c, vec3(0.6, 0.64, 0.44), smoothstep(0.62, 0.8, vf(p * 2.3 + P.y * 2.0 + 11.0)) * (0.35 + 0.65 * up) * 0.38);
    c = mix(c, c * vec3(0.74, 0.86, 0.58), up * 0.22 * vf(p * 0.8));
  } else if (kind == 10.0) {                                   // kabuk: boyuna yarıklar
    float a = atan(n.z, n.x) * 2.5 + (P.x + P.z) * 1.7;
    c *= 0.8 + 0.32 * smoothstep(0.25, 0.75, vn(vec2(a * 2.0, P.y * 1.1 + seed)));
    c *= 0.95 + 0.08 * vn(vec2(a * 9.0, P.y * 7.0)) * aaM;
  } else if (kind == 11.0) {                                   // yaprak / iğne: küme gölgesi, uçlarda açık
    float cl = vf(P.xz * 1.4 + P.y * 1.7 + seed);
    c *= 0.8 + 0.34 * cl;
    c = mix(c, c * vec3(1.08, 1.12, 0.82), smoothstep(0.65, 0.9, vn(P.xz * 4.0 + P.y * 3.0)) * 0.38 * aaM);
    c *= 0.86 + 0.14 * up;
    gRough = 0.95;
  } else if (kind == 12.0) {                                   // saman: lif çizgileri
    float fib = vn(vec2(u * 18.0 + P.x * 3.0, P.y * 2.0) + seed);
    c *= 0.84 + 0.28 * fib * aaM + 0.14 * (1.0 - aaM);
    c *= 0.92 + 0.1 * vf(wq * 1.3 + p);
  } else if (kind == 13.0) {                                   // bez / çuval: dokuma, toz
    c *= 0.95 + 0.06 * (vn(wq * 34.0 + p * 34.0) - 0.5) * aaF + 0.1 * vf(wq * 1.1 + p * 1.1 + seed);
    c = mix(c, c * vec3(0.87, 0.82, 0.72), smoothstep(0.55, 0.85, vf(wq * 0.5 + p * 0.5 + 2.0)) * 0.36);
  } else if (kind == 14.0) {                                   // boyalı metal / tahta: aşınma, kir
    c *= 0.92 + 0.12 * vf(wq * 1.1 + p * 0.6 + seed);
    c = mix(c, c * vec3(0.68, 0.64, 0.6), smoothstep(0.66, 0.84, vf(wq * 2.3 + p * 1.7 + 11.0)) * 0.5);
    gRough = 0.6; gMetal = 0.12;
  } else {
    c *= 0.95 + 0.08 * vf(wq * 0.9 + p * 0.9 + seed);
  }
  return clamp(c, 0.0, 1.0);
}
`;

export function makeVadiMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vKind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvKind = aKind;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
varying float vKind;
${NOISE}
${KINDS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float gRough = -1.0, gMetal = -1.0;
{
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);
  float kr = floor(vKind + 0.5);
  diffuseColor.rgb = vadiKind(diffuseColor.rgb, normalize(vWN), vWP, mod(kr, 16.0), floor(kr / 16.0), pxw, gRough, gMetal);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;');
  };
  material.customProgramCacheKey = () => 'vadi3-surface';
  return material;
}

// Örnekli ağ malzemesi: örnek rengi (instanceColor) taban renk, sınıf gölgelendiricisi dünya konumunda (instanceMatrix dahil), tohum örnek başına
// o.bark: geometride aBark = 1 olan köşeler (ağaç gövdesi) bu renkte ve KABUK sınıfında (örnek rengi yalnız yaprağa)
export function makeInstMaterial(kind, o = {}) {
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: o.roughness ?? 0.9, metalness: 0, side: o.side ?? THREE.FrontSide });
  const bark = o.bark ? new THREE.Color(o.bark) : null;
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vSeed;' + (bark ? '\nattribute float aBark;\nvarying float vBark;' : ''))
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${bark ? 'vBark = aBark;' : ''}
{
  vec4 wp = vec4(transformed, 1.0);
  vec3 wn = objectNormal;
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
  vSeed = floor(fract(instanceMatrix[3].x * 0.731 + instanceMatrix[3].z * 0.377) * 15.0);
#else
  vSeed = 0.0;
#endif
  vWP = (modelMatrix * wp).xyz; vWN = normalize(mat3(modelMatrix) * wn);
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
varying float vSeed;
${bark ? 'varying float vBark;' : ''}
${NOISE}
${KINDS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float gRough = -1.0, gMetal = -1.0;
{
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);
  ${bark ? `if (vBark > 0.5) diffuseColor.rgb = vadiKind(vec3(${bark.r.toFixed(4)}, ${bark.g.toFixed(4)}, ${bark.b.toFixed(4)}), normalize(vWN), vWP, 10.0, vSeed, pxw, gRough, gMetal); else` : ''}
  diffuseColor.rgb = vadiKind(diffuseColor.rgb, normalize(vWN), vWP, ${kind.toFixed(1)}, vSeed, pxw, gRough, gMetal);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;');
  };
  material.customProgramCacheKey = () => 'vadi3-inst-' + kind + (o.bark || '');
  return material;
}

// Arazi: köşe rengi + aAux = (patika, ıslak kıyı, kaya, tarla) → çimen tutam benekleri, orman tabanı lekeleri, patikada çakıl / teker izi,
// kayada tabaka + liken, kıyıda ıslak çamur (parlak), tarlada sürülmüş sıralar
export function makeVadiGroundMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aAux;\nvarying vec3 vWP;\nvarying vec4 vAux;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAux = aAux;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec4 vAux;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float gRough = -1.0;
{
  vec2 p = vWP.xz;
  float pxw = max(fwidth(vWP.x) + fwidth(vWP.z), 1e-4);
  float aaF = 1.0 - smoothstep(0.02, 0.06, pxw), aaM = 1.0 - smoothstep(0.05, 0.16, pxw);
  vec3 c = diffuseColor.rgb;
  float trail = vAux.x, wet = vAux.y, rock = vAux.z, field = vAux.w;
  float big = vf(p * 0.045), mid = vf(p * 0.32 + 5.0);
  c *= 0.92 + 0.16 * big;
  float grass = (1.0 - trail) * (1.0 - rock) * (1.0 - wet) * (1.0 - field);
  float tuft = vn(p * 5.5) * 0.65 + (vn(p * 16.0 + 2.0) * aaF + 0.5 * (1.0 - aaF)) * 0.35;
  c *= mix(1.0, 0.88 + 0.22 * tuft, grass * 0.8);
  c = mix(c, c * vec3(1.1, 1.05, 0.8), grass * smoothstep(0.62, 0.82, mid) * 0.45);
  float forest = smoothstep(28.0, 46.0, abs(vWP.z));
  c = mix(c, c * vec3(0.8, 0.76, 0.64), grass * forest * smoothstep(0.45, 0.75, vf(p * 0.7 + 13.0)) * 0.5);
  float peb = vn(p * 7.0 + 3.0) * aaF + 0.5 * (1.0 - aaF);
  c *= mix(1.0, 0.86 + 0.24 * peb, trail * 0.85);
  c = mix(c, c * vec3(1.12, 1.1, 1.04), trail * smoothstep(0.72, 0.86, vn(p * 12.0 + 7.0)) * aaF * 0.75);
  c *= 1.0 - trail * 0.12 * smoothstep(0.55, 0.8, vn(p * 0.9 + 21.0));
  float st = vn(vec2(dot(p, vec2(0.7, 0.7)) * 0.22, vWP.y * 0.9)) * 0.7 + vn(p * 0.9 + vWP.y) * 0.3;
  c = mix(c, c * (0.82 + 0.3 * st), rock);
  c = mix(c, c * vec3(0.95, 1.0, 0.82), rock * smoothstep(0.6, 0.9, vf(p * 0.5 + vWP.y * 0.3)) * 0.3);
  c *= 1.0 - field * 0.22 * (0.5 + 0.5 * sin(dot(p, vec2(0.0, 1.0)) * 7.0)) * aaM;
  c = mix(c, c * vec3(0.72, 0.68, 0.62), wet * 0.55);
  gRough = 1.0 - 0.5 * wet;
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;');
  };
  material.customProgramCacheKey = () => 'vadi3-ground';
  return material;
}

// Nehir: derinlik (aDepth) → sığda açık yeşil-kum, derinde koyu camgöbeği; akış yönünde (−z → +z) kayan iki dalga katmanı normali bozar, kıyıda köpük.
// Tek taraflı, depthWrite kapalı; su altına kamera inmez (yatak en derin 1,2 m, göz 1,62 m). uT: ağ onBeforeRender'da güncellenir.
export function makeVadiWaterMaterial() {
  const uT = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, roughness: 0.1, metalness: 0.05, depthWrite: false });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDepth;\nvarying vec3 vWP;\nvarying float vDepth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDepth = aDepth;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uT;
varying vec3 vWP;
varying float vDepth;
${NOISE}
float wv(vec2 q){ return vn(q + vec2(0.0, uT * 0.9)) * 0.6 + vn(q * 2.3 + vec2(3.0, uT * 1.6)) * 0.4; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float d = clamp(vDepth, 0.0, 1.4);
  vec3 shallow = vec3(0.46, 0.6, 0.5), deep = vec3(0.09, 0.28, 0.36);
  vec3 c = mix(shallow, deep, smoothstep(0.08, 1.1, d));
  c *= 0.94 + 0.12 * vf(vWP.xz * 0.15 + vec2(0.0, uT * 0.25));
  float streak = smoothstep(0.62, 0.8, vn(vec2(vWP.x * 1.3, vWP.z * 0.18 - uT * 0.5)));
  c = mix(c, c * 1.18, streak * 0.25 * smoothstep(0.2, 0.8, d));
  float foam = (1.0 - smoothstep(0.0, 0.14, d)) * smoothstep(0.35, 0.65, wv(vWP.xz * vec2(1.2, 0.5) * 2.0));
  c = mix(c, vec3(0.86, 0.9, 0.88), foam * 0.4);
  diffuseColor.rgb = c;
  diffuseColor.a = mix(0.5, 0.9, smoothstep(0.0, 0.9, d)) * smoothstep(0.0, 0.05, d) + foam * 0.1;
}`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
{
  vec2 q = vWP.xz * vec2(0.9, 0.35);
  float e = 0.15, h0 = wv(q);
  vec3 wn = normalize(vec3(-(wv(q + vec2(e, 0.0)) - h0) * 1.5, 1.0, -(wv(q + vec2(0.0, e)) - h0) * 1.5));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`);
  };
  material.customProgramCacheKey = () => 'vadi3-water';
  return { material, uT };
}
