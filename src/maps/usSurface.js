import * as THREE from 'three';

// Askeri Üs yüzeyi: Depo / Liman yöntemi — tüm düz parçalar tek köşe-renkli ağda, doku yerine dünya koordinatlı prosedürel gölgelendirici (UV / doku yok, çizim çağrısı artmaz).
// aKind alt 4 bit = sınıf, üst 4 bit = parça tohumu. Sınıf: önce kutudaki opt.kind / withKind, yoksa renk eşlemesi (usKindOf), o da yoksa DÜZ.
// Gece / gün batımı: kameraya en yakın 12 lamba (direk, projektör, tavan lambası) sahte ışık verir (gölgesiz, kaydırmalı geçiş); seçimi ağın onBeforeRender'ı yapar.
export const UK = { PLAIN: 0, ASPH: 1, CONC: 2, BOX: 3, STEEL: 4, WOOD: 5, MARK: 6, CLAD: 7, BAG: 8, HESCO: 9, CAMO: 10, CANVAS: 11, GROUND: 12, FLOOR: 13, BLOCK: 14, SLAB: 15 };
export const usU = { night: { value: 0 } };
const MAXL = 12;

// renk → sınıf (açık sınıf verilmemiş parçalar; mobilya, araç, kit parçaları)
const K = UK, CMAP = new Map();
const put = (k, cols) => { for (const c of cols) CMAP.set(c, k); };
put(K.CONC, ['#8d9389', '#6f756d', '#8a9087', '#757b72', '#a2a79e', '#74786f', '#9a9c94', '#8b8f88', '#7f867d', '#808880', '#686e66', '#5b615a', '#4e5256', '#7d867c', '#55595c', '#a9a9a3', '#8c8c86', '#a3a39b', '#6c7173', '#686d70', '#72777a', '#63696b']);
for (const k of [1.18, 0.62, 0.55]) CMAP.set(new THREE.Color('#8b8f88').multiplyScalar(k).getStyle(), K.CONC);        // merdiven süsü (açık basamak yüzü, koyu burun / kiriş)
put(K.STEEL, ['#59606a', '#3f4348', '#2a2d30', '#454a50', '#9aa0a8', '#3f444b', '#8a929b', '#5f6b78', '#7b8795', '#4a5058', '#cfd2cc', '#c0392b', '#7b8660', '#59623f', '#4a4d52', '#6a4a3a', '#3f4a5e', '#4a5a3a', '#6a3f35', '#6b7480', '#5a6068', '#d8d8d2', '#6a6d73', '#c58a1f', '#26282b', '#3f4a3f', '#d8dde0', '#e0e3de', '#c8c8c0']);
put(K.WOOD, ['#b58a57', '#a07a4c', '#5e4429', '#5e3c1d', '#6a5436', '#4a3a28', '#8a7a5a', '#9a8a64', '#5a4a30']);
put(K.BAG, ['#a89468', '#b3a073']);
put(K.HESCO, ['#b6a47a', '#aa986f', '#5a5d44']);
put(K.CLAD, ['#7d857f', '#8a8f86', '#808a84', '#6e766f', '#6c737b']);
put(K.CAMO, ['#4d5c3a', '#5b6a45', '#3f4d33', '#6b6f4a']);
put(K.CANVAS, ['#6f7d62', '#857b62', '#55688a', '#8a5648', '#5e6648', '#4d553a', '#6a6a55', '#8a8f6a']);
put(K.GROUND, ['#667049', '#7a745f', '#6a6451', '#4a3f2e', '#5c6a3e', '#53624f', '#485544', '#5d6a57', '#4d5c4c', '#2a4f28', '#2f5a2c', '#34632f', '#27472a', '#5a3d24']);
put(K.ASPH, ['#41444a', '#585c61', '#5d6165', '#51555a', '#4e5358', '#43474c']);
put(K.SLAB, ['#4c5156', '#585d62', '#a9aba3']);
export const usKindOf = (color) => CMAP.get(color) ?? K.PLAIN;

const NOISE = `
float uh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float un(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(uh(i), uh(i+vec2(1.,0.)), f.x), mix(uh(i+vec2(0.,1.)), uh(i+vec2(1.,1.)), f.x), f.y); }
float uf(vec2 p){ return un(p) * 0.55 + un(p * 2.03 + 3.1) * 0.30 + un(p * 4.1 + 7.7) * 0.15; }
float gridLn(vec2 q, vec2 cell, float w){ vec2 f = fract(q / cell); vec2 d = min(f, 1.0 - f) * cell; return 1.0 - smoothstep(w * 0.5, w, min(d.x, d.y)); }
`;

// lamps: [{ x, y, z, r, c:'#hex', k }] — tümü; her karede kameraya en yakın MAXL tanesi yüklenir
export function makeUsMaterial(lamps = []) {
  const L = [], LC = [];
  for (let i = 0; i < MAXL; i++) { L.push(new THREE.Vector4(0, -999, 0, 0.001)); LC.push(new THREE.Color(0, 0, 0)); }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 });
  material.userData.glow = true;                                   // environment.applyGlow emissiveIntensity'yi günün saatine göre yazar → uNight
  material.userData.usLamps = { all: lamps.map((l) => ({ ...l, col: new THREE.Color(l.c || '#ffd9a0').multiplyScalar(l.k ?? 1) })), L, LC, t: -1, cx: 1e9, cz: 1e9 };
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = usU.night; sh.uniforms.uL = { value: L }; sh.uniforms.uLC = { value: LC };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vKind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvKind = aKind;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
varying float vKind;
uniform float uNight;
uniform vec4 uL[${MAXL}];
uniform vec3 uLC[${MAXL}];
float gRough = -1.0;
float gMetal = -1.0;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);     // bir pikselin dünya boyu: ince çizgi pikselden küçülünce söner (titreme yok)
  float aaB = 1.0 - smoothstep(0.012, 0.035, pxw), aaP = 1.0 - smoothstep(0.02, 0.06, pxw), aaJ = 1.0 - smoothstep(0.03, 0.09, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), dn = step(n.y, -0.72), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);                                   // duvar düzleminde yatay koordinat
  float hg = vWP.y;                                            // düz harita: zeminden yükseklik
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  float lum = dot(c, vec3(0.333));
  if (kind == 0.0) {                                           // ── DÜZ: hafif ton oynaması + taban kiri ──
    c *= 0.95 + 0.09 * uf(wq * 0.8 + p * 0.6 + seed);
    if (side > 0.5) c *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.45, hg));
  } else if (kind == 1.0) {                                    // ── ASFALT: agrega, yama, çatlak, yağ lekesi, lastik izi ──
    if (up > 0.5) {
      c *= 0.84 + 0.3 * uf(p * 0.07 + 3.0);
      c *= 1.0 + (uh(floor(p * 22.0)) - 0.5) * 0.22 * aaP + (un(p * 8.0) - 0.5) * 0.1;
      vec2 pg = p / vec2(5.2, 3.4); vec2 pf = abs(fract(pg) - 0.5);
      c = mix(c, c * 0.8, step(0.9, uh(floor(pg) + 9.0)) * (1.0 - smoothstep(0.4, 0.43, max(pf.x, pf.y))));        // yama
      float cr = abs(un(p * 0.9 + 11.0) - 0.5);
      c *= 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.022, cr)) * smoothstep(0.45, 0.75, un(p * 0.13 + 2.0)) * aaJ;      // çatlak
      c *= 1.0 - 0.3 * smoothstep(0.64, 0.88, uf(p * 0.28 + 70.0));                                               // yağ lekesi
      float tx = abs(fract(p.y / 2.6 + 0.12 * un(p * 0.04)) - 0.5), tz = abs(fract(p.x / 2.6 + 0.12 * un(p * 0.04 + 5.0)) - 0.5);
      c *= 1.0 - 0.08 * (1.0 - smoothstep(0.03, 0.1, min(tx, tz))) * aaJ;                                          // lastik izi
      gRough = 0.92;
    } else c *= 0.8;
  } else if (kind == 2.0) {                                    // ── BETON: kalıp panosu + bağ deliği (yan), derz (üst), akıntı + taban kiri ──
    c *= 0.9 + 0.2 * uf(wq * 0.45 + p * 0.3 + seed);
    c *= 1.0 + (un(wq * 7.0 + p * 7.0) - 0.5) * 0.08 * aaP;
    if (side > 0.5) {
      c *= 1.0 - 0.12 * gridLn(vec2(u + 0.3, vWP.y), vec2(2.4, 1.2), 0.025) * aaJ;
      vec2 tq = fract(vec2(u + 0.3, vWP.y) / vec2(0.6, 0.6)) - 0.5;
      c *= 1.0 - 0.16 * (1.0 - smoothstep(0.016, 0.026, length(tq * 0.6))) * aaB;                                   // kalıp bağ deliği (küçük, silik)
      c *= 1.0 - 0.2 * smoothstep(0.55, 0.85, un(vec2(u * 1.4 + seed, vWP.y * 0.09)));
      c *= 1.0 - 0.26 * (1.0 - smoothstep(0.0, 0.6, hg));
    } else if (up > 0.5) {
      c *= 1.0 - 0.3 * gridLn(p, vec2(4.0), 0.06) * aaJ;
      c *= 0.93 + 0.14 * uh(floor(p / 4.0) + 2.0);
      c *= 1.0 - 0.18 * smoothstep(0.62, 0.86, uf(p * 0.2 + 30.0));
    }
    gRough = 0.92;
  } else if (kind == 3.0) {                                    // ── KONTEYNER: oluklu sac, alt / üst kiriş, solmuş boya, pas akıntısı ──
    float hc = mod(vWP.y + 0.0005, 2.6);
    vec3 base = c;
    c *= 0.92 + 0.1 * uf(wq * 0.6 + seed * 1.7);
    float fade = smoothstep(0.35, 0.8, uf(wq * 0.18 + p * 0.05 + seed * 3.3));
    c = mix(c, mix(c, vec3(dot(c, vec3(0.333))), 0.45) * 1.18 + 0.03, fade * 0.5);
    if (side > 0.5) {
      float t = fract(u / 0.28);
      float rib = smoothstep(0.06, 0.16, t) - smoothstep(0.56, 0.66, t);
      float edge = (1.0 - smoothstep(0.0, 0.07, abs(t - 0.11))) + (1.0 - smoothstep(0.0, 0.07, abs(t - 0.61)));
      c *= mix(1.0, mix(0.8, 1.06, rib) - 0.08 * edge, aaP);
      float rail = 1.0 - step(0.13, hc) * step(hc, 2.47);
      c = mix(c, base * 0.62, rail * 0.85);
      float drip = un(vec2(u * 4.2 + seed * 7.0, vWP.y * 0.3)) * (0.55 + 0.5 * smoothstep(1.3, 2.5, hc));
      float rust = max(smoothstep(0.7, 0.92, drip) * 0.8, smoothstep(0.76, 0.9, uf(wq * 2.3 + seed * 5.1)));
      rust = max(rust, rail * smoothstep(0.5, 0.8, un(wq * 3.0 + seed)) * 0.8);
      c = mix(c, vec3(0.3, 0.15, 0.075) * (0.8 + 0.4 * un(wq * 9.0)), rust * 0.55);
      c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.8, hg));
      gRough = mix(0.62, 0.9, rust);
    } else if (up > 0.5) {
      float t = fract(dot(p, vec2(0.7, 0.7)) / 0.5);
      c *= 0.88 + 0.12 * smoothstep(0.2, 0.5, t) * aaP;
      c = mix(c * 0.8, vec3(0.28, 0.14, 0.07), smoothstep(0.62, 0.85, uf(p * 1.3 + seed * 2.0)) * 0.45);
      gRough = 0.88;
    } else c *= 0.55;
    gMetal = 0.12;
  } else if (kind == 4.0) {                                    // ── BOYALI ÇELİK (direk, boru, araç, dolap): boya aşınması, pas ──
    c *= 0.9 + 0.14 * uf(wq * 1.1 + p * 0.4 + seed);
    float chip = smoothstep(0.72, 0.84, uf(wq * 3.5 + p * 2.0 + seed * 3.0));
    c = mix(c, vec3(0.2, 0.19, 0.18), chip * 0.6);
    float rs = smoothstep(0.74, 0.92, un(vec2(u * 3.0, vWP.y * 0.25) + seed * 4.0)) * side;
    c = mix(c, vec3(0.3, 0.15, 0.07), rs * 0.28);
    if (side > 0.5) c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.6, hg));
    gRough = mix(0.5, 0.85, max(chip, rs)); gMetal = 0.25;
  } else if (kind == 5.0) {                                    // ── AHŞAP (sandık, tahta, masa) ──
    float pv = side > 0.5 ? vWP.y : vWP.x + vWP.z * 0.02;
    float pl = floor(pv / 0.14), edge = abs(fract(pv / 0.14) - 0.5);
    c *= 0.86 + 0.26 * uh(vec2(pl, seed));
    c *= 0.92 + 0.14 * mix(0.5, un(vec2((side > 0.5 ? u : vWP.z) * 2.2, pv * 38.0)), aaP);
    c *= 1.0 - 0.4 * smoothstep(0.42, 0.5, edge) * aaP;
    gRough = 0.95;
  } else if (kind == 6.0) {                                    // ── YOL BOYASI: aşınmış ──
    float wear = smoothstep(0.42, 0.82, uf(p * 1.3 + 5.0) + 0.2 * un(p * 11.0));
    c = mix(c * 0.94, vec3(0.24, 0.25, 0.26), wear * 0.55);
    gRough = 0.7;
  } else if (kind == 7.0) {                                    // ── OLUKLU SAC (hangar / garaj): dik oluk, pas, taban kiri; çatıda trapez oluk ──
    if (side > 0.5) {
      float t = fract(u / 0.22);
      c *= mix(1.0, 0.85 + 0.17 * smoothstep(0.1, 0.4, t) * (1.0 - smoothstep(0.6, 0.9, t)), aaP);
      c *= 0.92 + 0.12 * uf(wq * 0.3 + seed);
      c *= 1.0 - 0.2 * smoothstep(0.55, 0.85, un(vec2(u * 1.6 + seed, vWP.y * 0.1)));
      c = mix(c, vec3(0.32, 0.17, 0.08), smoothstep(0.72, 0.86, uf(wq * 1.2 + 40.0)) * 0.4);
      c *= 1.0 - 0.06 * gridLn(vec2(u, vWP.y), vec2(1.1, 2.4), 0.03) * aaJ;                                     // levha birleşimi
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 1.1, hg));
    } else if (n.y > 0.3) {
      float t = fract(p.x / 0.5);
      c *= 0.86 * mix(1.0, 0.86 + 0.18 * smoothstep(0.15, 0.4, t) * (1.0 - smoothstep(0.6, 0.85, t)), aaP);
      c *= 0.86 + 0.24 * uf(p * 0.12 + seed);
      c = mix(c, vec3(0.3, 0.18, 0.1), smoothstep(0.7, 0.9, uf(p * 0.5 + 9.0)) * 0.3);
    } else c *= 0.8;
    gRough = 0.7; gMetal = 0.18;
  } else if (kind == 8.0) {                                    // ── KUM TORBASI: sıra başına şişkin torba, dokuma, kir ──
    if (side > 0.5) {
      float fy = fract(vWP.y / 0.32);
      c *= 0.62 + 0.42 * pow(max(sin(3.14159 * fy), 0.0), 0.7);                                                    // şişkin torba: üst / alt kenar koyu
      c *= 1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.05, abs(fy - 0.5))) * aaB;                                       // dikiş
    } else c *= 0.9 + 0.14 * un(p * 6.0 + seed);
    c *= 0.93 + 0.1 * mix(0.5, uh(floor(wq * 55.0 + p * 55.0)), aaB);
    c *= 0.9 + 0.16 * uf(wq * 0.9 + p * 0.9 + seed);
    c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.35, hg));
    gRough = 0.97;
  } else if (kind == 9.0) {                                    // ── HESCO: tel kafes + jeotekstil, üstte toprak ──
    if (up > 0.5) {
      c = mix(c, vec3(0.34, 0.29, 0.21), 0.55); c *= 0.8 + 0.4 * uf(p * 3.0 + seed);
      c *= 0.85 + 0.3 * mix(0.5, uh(floor(p * 30.0)), aaB);
    } else {
      c *= 0.9 + 0.16 * uf(wq * 0.8 + seed);
      c *= 1.0 - 0.24 * gridLn(wq, vec2(0.076), 0.011) * aaB;
      c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.07, abs(fract(u / 1.08 + 0.5) - 0.5))) * aaP;                  // sepet arası dikme
      c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.5, hg));
    }
    gRough = 0.95;
  } else if (kind == 10.0) {                                   // ── KAMUFLAJ AĞI: üç tonlu leke + ağ gözü ──
    float b1 = uf(p * 0.55 + seed * 3.0), b2 = uf(p * 1.3 + 17.0);
    c = mix(c, c * 0.62, smoothstep(0.48, 0.56, b1));
    c = mix(c, c * 1.32 + vec3(0.02, 0.03, 0.0), smoothstep(0.6, 0.66, b2) * 0.8);
    c *= 1.0 - 0.35 * (1.0 - smoothstep(0.08, 0.2, length(fract(p * 4.0) - 0.5))) * aaB;
    gRough = 1.0;
  } else if (kind == 11.0) {                                   // ── ÇADIR BEZİ: dokuma, dikiş, solma, etek kiri ──
    vec2 q = abs(n.y) > 0.5 ? p : wq;
    c *= 0.93 + 0.08 * mix(0.5, uh(floor(q * 45.0)), aaB);
    c *= 0.92 + 0.12 * uf(q * 0.7 + seed);
    float sc = abs(n.y) > 0.3 ? p.x + p.y : u, sf = fract(sc / 1.25);
    c *= 1.0 - 0.14 * (1.0 - smoothstep(0.01, 0.025, min(sf, 1.0 - sf) * 1.25)) * aaP;                                // dikiş
    c *= 1.0 + 0.06 * n.y;
    c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.45, hg));
    gRough = 0.98;
  } else if (kind == 12.0) {                                   // ── TOPRAK: çimen (yeşil) / çakıl ──
    vec2 q = p + vec2(vWP.y * 0.6);
    if (c.g > c.r * 1.08) {
      c *= 0.82 + 0.3 * uf(q * 0.09);
      c *= 0.9 + 0.16 * un(q * 2.6);
      c *= 1.0 - 0.12 * smoothstep(0.55, 0.8, un(q * 0.6 + 8.0));
    } else {
      c *= 0.84 + 0.28 * uf(q * 0.18 + seed);
      c *= 0.82 + 0.36 * mix(0.5, uh(floor(q * 28.0)), aaB);
      c = mix(c, c * 1.25, step(0.93, uh(floor(q * 11.0) + 3.0)) * aaP);
    }
    gRough = 1.0;
  } else if (kind == 13.0) {                                   // ── İÇ ZEMİN: vinil karo, derz, aşınma izi ──
    if (up > 0.5) {
      c *= 1.0 - 0.18 * gridLn(p, vec2(0.5), 0.012) * aaJ;
      c *= 0.96 + 0.07 * mod(floor(p.x / 0.5) + floor(p.y / 0.5), 2.0);
      c *= 0.95 + 0.08 * uh(floor(p / 0.5) + seed);
      c *= 1.0 - 0.12 * smoothstep(0.6, 0.9, uf(p * 0.7 + seed));
      gRough = 0.55;
    }
  } else if (kind == 14.0) {                                   // ── BOYALI BRİKET DUVAR (bina dış / iç): örgü derzi, su lekesi, süpürgelik ──
    if (side > 0.5) {
      float by = vWP.y / 0.2, row = floor(by), bx = u / 0.4 + 0.5 * mod(row, 2.0);
      vec2 d = vec2(min(fract(bx), 1.0 - fract(bx)) * 0.4, min(fract(by), 1.0 - fract(by)) * 0.2);
      c *= 1.0 - 0.13 * (1.0 - smoothstep(0.004, 0.011, min(d.x, d.y))) * aaP;
      c *= 0.985 + 0.03 * uh(vec2(floor(bx), row) + seed);
      c *= 1.0 - 0.13 * smoothstep(0.6, 0.86, uf(wq * 0.22 + seed * 2.0));
      c *= 1.0 - 0.1 * (1.0 - step(0.9, hg));                                                                         // taban bandı / süpürgelik
      c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.45, hg));
    }
    gRough = 0.9;
  } else if (kind == 15.0) {                                   // ── DÖŞEME / ÇATI: üstte membran (koyu) ya da beton, altta tavan karosu ──
    if (up > 0.5) {
      if (lum < 0.4) {
        c *= 0.88 + 0.22 * uf(p * 0.5 + seed);
        c *= 0.86 + 0.3 * mix(0.5, uh(floor(p * 24.0)), aaB);
        float rf = fract(p.x); c *= 1.0 + 0.12 * (1.0 - smoothstep(0.01, 0.03, min(rf, 1.0 - rf))) * aaJ;          // rulo bindirmesi
      } else { c *= 1.0 - 0.25 * gridLn(p, vec2(3.0), 0.05) * aaJ; c *= 0.92 + 0.14 * uf(p * 0.4 + seed); }
      gRough = 0.95;
    } else if (dn > 0.5) {
      c = mix(c, vec3(0.73, 0.74, 0.71), 0.78);
      c *= 1.0 - 0.14 * gridLn(p, vec2(0.6), 0.02) * aaJ;
      c *= 0.97 + 0.05 * uh(floor(p / 0.6));
      gRough = 0.9;
    } else c *= 0.9 + 0.1 * uf(wq * 0.6);
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uNight > 0.001) {                                          // sahte lamba ışığı (gece / gün batımı): mesafe + yüzey yönü, gölgesiz
  vec3 nn = normalize(vWN), acc = vec3(0.0);
  for (int i = 0; i < ${MAXL}; i++) {
    vec3 d = uL[i].xyz - vWP; float r = length(d);
    float a = 1.0 - clamp(r / uL[i].w, 0.0, 1.0); a *= a * (1.6 - 0.6 * a);
    acc += uLC[i] * a * (0.12 + 0.88 * max(dot(nn, d / max(r, 1e-3)), 0.0));
  }
  totalEmissiveRadiance += diffuseColor.rgb * acc * uNight;
}`);
  };
  material.customProgramCacheKey = () => 'us-surface-v1';
  return material;
}

// Ağa bağla: her çizimde (gölge geçişi hariç) kamera 2 m'den fazla kaydıysa en yakın MAXL lamba yüklenir; en uzak üçte biri uzaklıkla söner (seçim değişince patlama yok).
export function attachUsLamps(mesh) {
  const S = mesh.material.userData.usLamps; if (!S) return;
  mesh.onBeforeRender = (r, s, camera) => {
    if (!camera.isPerspectiveCamera) return;
    usU.night.value = Math.min(1, (mesh.material.emissiveIntensity || 0) / 1.5);
    if (usU.night.value <= 0.001) return;
    const cp = camera.position;
    if (Math.hypot(cp.x - S.cx, cp.z - S.cz) < 2) return;
    S.cx = cp.x; S.cz = cp.z;
    const near = S.all.map((l) => ({ l, d: Math.hypot(l.x - cp.x, l.y - cp.y, l.z - cp.z) - l.r * 0.5 })).sort((a, b) => a.d - b.d).slice(0, MAXL + 1);
    const far = near.length > MAXL ? Math.max(near[MAXL].d, 1) : 1e9;
    for (let i = 0; i < MAXL; i++) {
      const q = near[i];
      if (!q) { S.L[i].set(0, -999, 0, 0.001); S.LC[i].setRGB(0, 0, 0); continue; }
      const f = 1 - THREE.MathUtils.smoothstep(q.d, far * 0.72, far);
      S.L[i].set(q.l.x, q.l.y, q.l.z, q.l.r); S.LC[i].copy(q.l.col).multiplyScalar(f);
    }
  };
}
