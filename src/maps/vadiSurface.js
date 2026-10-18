import * as THREE from 'three';

// Vadi yüzeyi (kır / çiftlik / orman): Depo / Liman yöntemi — tüm düz parçalar tek köşe-renkli ağda, doku yerine dünya koordinatlı prosedürel
// gölgelendirici (UV yok, çizim çağrısı artmaz). aKind alt 4 bit = sınıf, üst 4 bit = parça tohumu (her tahta / taş / sandık kendi tonunda).
// Telefon için hafif: 2-3 oktav gürültü, ince çizgiler piksel altına inince söner (uzakta titreme yok). Sınıf: açık withKind / opt.kind, yoksa renk paletinden.
export const VK = { PLAIN: 0, STONE: 1, PLASTER: 2, WOOD: 3, PLANK: 4, ROOF: 5, ROOFM: 6, METAL: 7, CONC: 8, ROCK: 9, BARK: 10, LEAF: 11, HAY: 12, CANVAS: 13, PAINT: 14, CRATE: 15 };

const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };
const PAL = new Map();
const put = (kind, ...cols) => { for (const c of cols) PAL.set(c.toLowerCase(), kind); };
put(VK.STONE, '#86817a', '#8e897c', '#9a9486', '#867f72', '#a09a8b', '#8a8578', '#99937f', '#7f7a6d', '#9a8f7e', '#8f8575', '#6f685c', '#8a8070', '#8b8a84', '#9a948a', '#8a8479');
put(VK.ROCK, '#7f7e77', '#8f8d85', '#76756e', '#85827a', '#7a7870', '#8a8880', '#8a8a84', '#a5a296', '#76766f');
put(VK.WOOD, '#7a5a38', '#5e3c1d', '#6e4a2a', '#4a3220', '#6e5034', '#a07a50', '#6a5238', '#8b5a2b', '#7d5126', '#a6845a', '#35577f', '#9a3a2e', '#7d2f23', '#8b6a45');
put(VK.PLANK, '#94724a', '#a58a68', '#8a7048', '#b58a57', '#9c7a52', '#a58a62', '#8a6a48', '#b09068');
put(VK.CRATE, '#b58a57');
put(VK.BARK, '#5a3d24', '#5e4026', '#7a5230');
put(VK.LEAF, '#2f5a2c', '#2a4f28', '#34632f', '#27472a', '#5f8f3a', '#6b9a3f', '#547f33', '#4f7a33', '#5d8a3a');
put(VK.HAY, '#d2b155', '#b99a42', '#d6b85a');
put(VK.CANVAS, '#c7b98a', '#b9b184', '#a7b38a', '#9fb0c8', '#c9a58f', '#3a3226', '#a89468', '#b3a073', '#cfc4a1');
put(VK.METAL, '#b9bdc2', '#9ea3a8', '#8a8f95', '#8a8d90', '#7a7f85', '#5a5f65', '#4a4d52');
put(VK.CONC, '#8d9389', '#6f756d', '#6a6d66', '#9aa09a');
put(VK.PLASTER, '#d6cfb4', '#d9c79a', '#c9c1a4', '#c2bba9', '#e8e6df', '#e8e8e4');
put(VK.PAINT, '#2c5aa0', '#b0332a', '#4d5b3a', '#d9a921', '#4a6a8a', '#3a6aa8', '#a8402f', '#b7392d', '#3a7d44', '#2f6a3a');
// çatılar: ev üreteci mahya / kiremit sırası için aynı rengin koyu-açık tonlarını da kullanır
for (const r of ['#7a3b2e', '#5d6a4a', '#6a6560', '#4d5b3a', '#3f4a30', '#6b3f33', '#6b4a3a', '#5b6f8a', '#8a4b3f', '#a8432f']) { put(VK.ROOF, r); for (const k of [0.7, 0.8, 1.12]) put(VK.ROOF, shade(r, k)); }
put(VK.ROOFM, '#5f646c', '#6a5a4a', '#6c7078');
const _c = new THREE.Color(), _h = {};
export function vadiKindOf(hex) {
  const k = PAL.get(String(hex).toLowerCase());
  if (k !== undefined) return k;
  _c.set(hex).getHSL(_h, THREE.SRGBColorSpace);
  const { h, s, l } = _h;
  if (h > 0.05 && h < 0.16 && s > 0.2 && l < 0.5) return VK.WOOD;
  return VK.PLAIN;                                             // mobilya / araç / bilinmeyen: hafif kir + ton oynaması
}

const NOISE = `
float vh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(vh(i), vh(i+vec2(1.,0.)), f.x), mix(vh(i+vec2(0.,1.)), vh(i+vec2(1.,1.)), f.x), f.y); }
float vf(vec2 p){ return vn(p) * 0.6 + vn(p * 2.07 + 3.1) * 0.28 + vn(p * 4.3 + 7.7) * 0.12; }
`;

// Arazi malzemesi: köşe rengi (çimen / toprak / kaya / kıyı tonu JS'te) + aAux = (patika, ıslak kıyı, kaya) ağırlıkları → dünya koordinatlı ayrıntı:
// çimen tutam benekleri + kümeler, orman tabanı iğne / yaprak lekesi, patikada çakıl + teker izi + nemli kenar, kayada tabaka + liken, kıyıda ıslak çamur (parlak).
export function makeVadiGroundMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aAux;\nvarying vec3 vWP;\nvarying vec3 vAux;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAux = aAux;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vAux;
float gRough = -1.0;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 p = vWP.xz;
  float pxw = max(fwidth(vWP.x) + fwidth(vWP.z), 1e-4);
  float aaF = 1.0 - smoothstep(0.02, 0.06, pxw), aaM = 1.0 - smoothstep(0.05, 0.16, pxw);
  vec3 c = diffuseColor.rgb;
  float trail = vAux.x, wet = vAux.y, rock = vAux.z;
  float forest = smoothstep(26.0, 44.0, abs(vWP.z));
  float big = vf(p * 0.045), mid = vf(p * 0.32 + 5.0);
  c *= 0.9 + 0.2 * big;                                                            // büyük ölçek ton
  // çimen: tutam benekleri (yakında), kümeler, kuru sarı lekeler
  float tuft = vn(p * 5.5) * 0.65 + (vn(p * 16.0 + 2.0) * aaF + 0.5 * (1.0 - aaF)) * 0.35;
  float grass = (1.0 - trail) * (1.0 - rock) * (1.0 - wet);
  c *= mix(1.0, 0.88 + 0.22 * tuft, grass * 0.8);
  c = mix(c, c * vec3(1.12, 1.06, 0.78), grass * smoothstep(0.62, 0.82, mid) * 0.5);
  // orman tabanı: iğne yaprak / gölge lekeleri
  c = mix(c, c * vec3(0.78, 0.74, 0.62), grass * forest * smoothstep(0.45, 0.75, vf(p * 0.7 + 13.0)) * 0.55);
  // patika: çakıl benekleri, iki teker izi yönünden bağımsız ince çizgiler, nemli kenar
  float peb = vn(p * 7.0 + 3.0) * aaF + 0.5 * (1.0 - aaF);
  c *= mix(1.0, 0.86 + 0.24 * peb, trail * 0.85);
  c = mix(c, c * vec3(1.14, 1.11, 1.04), trail * smoothstep(0.72, 0.86, vn(p * 12.0 + 7.0)) * aaF * 0.8);     // açık çakıl taşı
  c *= 1.0 - trail * 0.12 * smoothstep(0.55, 0.8, vn(p * 0.9 + 21.0));             // ezilmiş / ıslak leke
  // kaya: tabaka + liken
  float st = vn(vec2(dot(p, vec2(0.7, 0.7)) * 0.22, vWP.y * 0.9)) * 0.7 + vn(p * 0.9 + vWP.y) * 0.3;
  c = mix(c, c * (0.82 + 0.3 * st), rock);
  c = mix(c, c * vec3(0.95, 1.0, 0.82), rock * smoothstep(0.6, 0.9, vf(p * 0.5 + vWP.y * 0.3)) * 0.3);   // yumuşak liken lekesi (gece beyaz benek olmasın)
  // kıyı: ıslak çamur, kum dalgacığı
  c = mix(c, c * vec3(0.72, 0.68, 0.62), wet * 0.6);
  c *= 1.0 - wet * 0.08 * (abs(fract(dot(p, vec2(0.2, 0.98)) * 2.2 + vn(p * 0.5) * 2.0) - 0.5) * 2.0) * aaM;
  gRough = 1.0 - 0.55 * wet;
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;');
  };
  material.customProgramCacheKey = () => 'vadi-ground-v1';
  return material;
}

// Nehir suyu: köşede derinlik (aDepth) → sığda açık yeşil-kum, derinde koyu camgöbeği; akış yönünde kayan iki dalga katmanı normali bozar
// (güneş parıltısı), kıyıda ince köpük. Zaman: ağ onBeforeRender'da güncellenir (oyun döngüsüne dokunmaz).
export function makeVadiWaterMaterial() {
  const uT = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, roughness: 0.12, metalness: 0.05, depthWrite: false, side: THREE.DoubleSide });
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
float wv(vec2 q){ return vn(q + vec2(0.0, uT * 0.9)) * 0.6 + vn(q * 2.3 + vec2(3.0, uT * 1.7)) * 0.4; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float d = clamp(vDepth, -0.2, 3.0);
  vec3 shallow = vec3(0.42, 0.62, 0.52), deep = vec3(0.1, 0.33, 0.42);
  vec3 c = mix(shallow, deep, smoothstep(0.05, 1.6, d));
  c *= 0.94 + 0.12 * vf(vWP.xz * 0.15 + vec2(0.0, uT * 0.2));
  float foam = (1.0 - smoothstep(0.0, 0.12, d)) * smoothstep(0.35, 0.65, wv(vWP.xz * vec2(1.2, 0.5) * 2.0));
  c = mix(c, vec3(0.82, 0.88, 0.86), foam * 0.35);
  diffuseColor.rgb = c;
  diffuseColor.a = mix(0.42, 0.86, smoothstep(0.0, 1.2, d)) * (1.0 - smoothstep(-0.05, -0.2, d)) + foam * 0.12;
}`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
{
  vec2 q = vWP.xz * vec2(0.9, 0.35);
  float e = 0.15, h0 = wv(q);
  vec3 wn = normalize(vec3(-(wv(q + vec2(e, 0.0)) - h0) * 1.6, 1.0, -(wv(q + vec2(0.0, e)) - h0) * 1.6));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`);
  };
  material.customProgramCacheKey = () => 'vadi-water-v1';
  return { material, uT };
}

// Yapı / eşya malzemesi (MapBuilder.surface.material)
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
float gRough = -1.0;
float gMetal = -1.0;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);     // bir pikselin dünya boyu: çizgi pikselden inceyse sönsün
  float aaF = 1.0 - smoothstep(0.012, 0.035, pxw), aaM = 1.0 - smoothstep(0.03, 0.09, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = smoothstep(0.6, 0.85, n.y), side = 1.0 - smoothstep(0.35, 0.6, abs(n.y));
  vec2 hz = normalize(vec2(-n.z, n.x) + vec2(1e-4, 0.0));
  float u = dot(vWP.xz, hz);                                   // duvar düzleminde yatay koordinat
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  if (kind == 1.0) {                                           // ── KURU TAŞ / KÂRGİR: düzensiz sıralı taşlar, harç / derz, alt kenarda yosun ──
    vec2 q = side > 0.5 ? wq : p;
    float rh = 0.26 + 0.1 * vh(vec2(floor(q.y / 0.3), 3.0));
    float row = floor(q.y / rh);
    float sl = 0.42 + 0.3 * vh(vec2(row, 7.0));
    float sx = q.x / sl + vh(vec2(row, 1.0)) * 3.0;
    float cell = floor(sx);
    vec2 f = vec2(fract(sx), fract(q.y / rh));
    float edge = min(min(f.x, 1.0 - f.x) * sl, min(f.y, 1.0 - f.y) * rh);
    float tone = vh(vec2(cell, row) + seed);
    c *= 0.82 + 0.3 * tone;
    c *= 0.93 + 0.12 * vf(q * 3.1 + cell);
    c *= 1.0 - 0.38 * (1.0 - smoothstep(0.012, 0.03, edge)) * aaF * (1.0 - up * 0.6);
    float moss = smoothstep(0.55, 0.8, vf(q * 0.6 + 4.0)) * (0.35 + 0.65 * up);
    c = mix(c, c * vec3(0.72, 0.9, 0.58), moss * 0.5);
  } else if (kind == 2.0) {                                    // ── SIVA (ev): ince pürüz, yağmur izi, alt sıçrama kiri, dökülmüş sıva altından taş ──
    c *= 0.95 + 0.07 * vf(wq * 2.3 + p * 1.7 + seed) + 0.03 * (vn(wq * 19.0 + p * 19.0) - 0.5) * aaM;
    c *= 1.0 - 0.1 * smoothstep(0.6, 0.85, vn(vec2(u * 1.4, vWP.y * 0.18) + seed * 3.0)) * side;
    float chip = smoothstep(0.78, 0.86, vf(wq * 0.55 + seed * 7.0)) * side;
    c = mix(c, vec3(0.55, 0.52, 0.47) * (0.85 + 0.25 * vh(floor(wq * vec2(3.0, 5.0)))), chip * 0.75);
  } else if (kind == 3.0) {                                    // ── TAHTA KAPLAMA (ahır, kule, kulübe): dikey tahtalar, damar, aralık gölgesi ──
    float bw = 0.22;
    float bu = side > 0.5 ? u : (abs(n.x) > 0.5 ? vWP.z : vWP.x);
    float bi = floor(bu / bw), bf = fract(bu / bw);
    c *= 0.84 + 0.26 * vh(vec2(bi, seed));
    float along = side > 0.5 ? vWP.y : (abs(n.x) > 0.5 ? vWP.x : vWP.z);
    c *= 0.92 + 0.14 * vn(vec2(bi * 3.7 + bf * 9.0, along * 1.3)) * aaM + 0.05 * (vn(vec2(bf * 40.0, along * 4.0)) - 0.5) * aaF;
    c *= 1.0 - 0.32 * (1.0 - smoothstep(0.035, 0.07, min(bf, 1.0 - bf))) * aaM;
    c = mix(c, c * vec3(0.78, 0.8, 0.76), smoothstep(0.6, 0.85, vf(wq * 0.4 + 3.0)) * 0.4);   // yaşlanma / güneş solması
  } else if (kind == 4.0 || kind == 15.0) {                    // ── DÖŞEME / SANDIK TAHTASI: yatay tahtalar (sandıkta çerçeve çıtası) ──
    float pw = kind == 15.0 ? 0.18 : 0.2;
    float pv = up > 0.5 ? (abs(fract(seed * 0.37) - 0.5) > 0.25 ? vWP.x : vWP.z) : vWP.y;
    float pi = floor(pv / pw), pf = fract(pv / pw);
    c *= 0.86 + 0.24 * vh(vec2(pi, seed));
    float along = up > 0.5 ? (pv == vWP.x ? vWP.z : vWP.x) : u;
    c *= 0.93 + 0.12 * vn(vec2(along * 1.6, pi * 5.0 + pf * 12.0)) * aaM;
    c *= 1.0 - 0.3 * (1.0 - smoothstep(0.03, 0.07, min(pf, 1.0 - pf))) * aaM;
  } else if (kind == 5.0) {                                    // ── KİREMİT ÇATI: eğim boyunca sıralar, şaşırtmalı derz, yosun / is ──
    float ry = vWP.y / 0.24;
    float rr = floor(ry), rf = fract(ry);
    float tx = u / 0.3 + 0.5 * mod(rr, 2.0);
    float ti = floor(tx), tf = fract(tx);
    c *= 0.86 + 0.22 * vh(vec2(ti, rr) + seed);
    c *= 1.0 - 0.34 * smoothstep(0.72, 0.98, rf) * aaM;           // sıra altı gölgesi (alt kiremidin üstü)
    c *= 1.0 - 0.2 * (1.0 - smoothstep(0.03, 0.08, min(tf, 1.0 - tf))) * aaM;
    c = mix(c, c * vec3(0.7, 0.8, 0.55), smoothstep(0.6, 0.85, vf(wq * 0.5 + p * 0.5)) * 0.35);
  } else if (kind == 6.0) {                                    // ── OLUKLU SAC ÇATI: eğim yönünde oluk, pas lekesi ──
    float rib = abs(fract(u / 0.18) - 0.5) * 2.0;
    c *= mix(1.0, 0.84 + 0.22 * smoothstep(0.15, 0.85, rib), aaM);
    c *= 0.92 + 0.12 * vf(wq * 0.35 + p * 0.35 + seed);
    c = mix(c, c * vec3(0.92, 0.82, 0.74), smoothstep(0.68, 0.88, vf(vec2(u * 2.5, vWP.y * 1.2) + 9.0)) * 0.5);   // hafif pas lekesi
    gMetal = 0.25; gRough = 0.6;
  } else if (kind == 7.0) {                                    // ── GALVANİZ / METAL (silo): dikey panel ek yeri, perçin bantları, pas akıntısı ──
    float pan = abs(fract(u / 0.9) - 0.5) * 2.0;
    c *= 1.0 - 0.14 * smoothstep(0.92, 1.0, pan) * aaM;
    c *= 0.93 + 0.1 * vf(wq * vec2(0.6, 0.2) + seed);
    float rs = smoothstep(0.6, 0.85, vf(vec2(u * 2.4, vWP.y * 0.25) + seed * 5.0));
    c = mix(c, vec3(0.5, 0.33, 0.2), rs * 0.35 * side);
    gMetal = 0.35; gRough = 0.55;
  } else if (kind == 8.0) {                                    // ── KALIP BETONU (bunker): yatay kalıp izi, su lekesi, yosun ──
    c *= 0.9 + 0.14 * vf(wq * 0.8 + p * 0.8 + seed);
    c *= 1.0 - 0.14 * (1.0 - smoothstep(0.01, 0.025, abs(fract(vWP.y / 0.3) - 0.5) * 0.3)) * aaM * side;
    c *= 1.0 - 0.14 * smoothstep(0.55, 0.85, vn(vec2(u * 1.3, vWP.y * 0.2) + 6.0)) * side;
    c = mix(c, c * vec3(0.75, 0.88, 0.62), smoothstep(0.6, 0.85, vf(wq * 0.7 + p)) * 0.35);
  } else if (kind == 9.0) {                                    // ── KAYA: tabakalanma, çatlak, likenler (üstte) ──
    float st = vn(vec2(dot(vWP.xz, vec2(0.6, 0.8)) * 0.8, vWP.y * 5.0) + seed);
    c *= 0.82 + 0.3 * st;
    c *= 0.9 + 0.15 * vf(p * 1.7 + vWP.y * 1.3 + seed);
    float lich = smoothstep(0.62, 0.8, vf(p * 2.3 + vWP.y * 2.0 + 11.0)) * (0.4 + 0.6 * up);
    c = mix(c, vec3(0.62, 0.66, 0.42), lich * 0.4);
    c = mix(c, c * vec3(0.7, 0.85, 0.55), up * 0.25 * vf(p * 0.8));
  } else if (kind == 10.0) {                                   // ── KABUK (gövde / kütük): boyuna yarıklar ──
    float a = atan(n.z, n.x) * 2.5 + (vWP.x + vWP.z) * 1.7;
    float fis = vn(vec2(a * 2.0, vWP.y * 1.1 + seed));
    c *= 0.78 + 0.34 * smoothstep(0.25, 0.75, fis);
    c *= 0.95 + 0.08 * vn(vec2(a * 9.0, vWP.y * 7.0)) * aaM;
  } else if (kind == 11.0) {                                   // ── YAPRAK / İĞNE: küme gölgeleri, uçlarda açık ──
    float cl = vf(vWP.xz * 1.4 + vWP.y * 1.7 + seed);
    c *= 0.8 + 0.36 * cl;
    c = mix(c, c * vec3(1.08, 1.12, 0.8), smoothstep(0.65, 0.9, vn(vWP.xz * 4.0 + vWP.y * 3.0)) * 0.4 * aaM);
    gRough = 0.95;
  } else if (kind == 12.0) {                                   // ── SAMAN: lif çizgileri, koyu iç ──
    float fib = vn(vec2(u * 18.0 + vWP.x * 3.0, vWP.y * 2.0) + seed);
    c *= 0.82 + 0.3 * fib * aaM + 0.15 * (1.0 - aaM);
    c *= 0.92 + 0.1 * vf(wq * 1.3 + p);
  } else if (kind == 13.0) {                                   // ── BEZ / ÇUVAL (çadır, kum torbası): dokuma, dikiş, toz ──
    float wv = (vn(wq * 34.0 + p * 34.0) - 0.5) * aaF;
    c *= 0.95 + 0.06 * wv + 0.1 * vf(wq * 1.1 + p * 1.1 + seed);
    c = mix(c, c * vec3(0.86, 0.8, 0.7), smoothstep(0.55, 0.85, vf(wq * 0.5 + p * 0.5 + 2.0)) * 0.4);
  } else if (kind == 14.0) {                                   // ── BOYALI METAL / TAHTA (varil, traktör, bayrak): aşınma, kir ──
    c *= 0.92 + 0.12 * vf(wq * 1.1 + p * 0.6 + seed);
    c = mix(c, c * vec3(0.66, 0.62, 0.58), smoothstep(0.66, 0.84, vf(wq * 2.3 + p * 1.7 + 11.0)) * 0.55);
    gRough = 0.6; gMetal = 0.15;
  } else {                                                     // ── DÜZ: hafif ton oynaması ──
    c *= 0.95 + 0.08 * vf(wq * 0.9 + p * 0.9 + seed);
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;');
  };
  material.customProgramCacheKey = () => 'vadi-surface-v1';
  return material;
}
