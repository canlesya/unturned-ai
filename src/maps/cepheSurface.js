import * as THREE from 'three';

// Batı Cephesi yüzeyi (12.158): Maden / Depo yöntemi — tüm düz parçalar + arazi tek köşe-renkli ağ, doku yerine dünya koordinatlı prosedürel gölgelendirici
// (UV yok, çizim çağrısı artmaz). aKind alt 4 bit = sınıf, üst 4 bit = parça tohumu (her kalas / torba kendi tonunda).
// Kasvetli 1940'lar cephe paleti: çamur, ıslak toprak, soluk çimen, çuval bezi kum torbası, yıpranmış kalas, moloz taş, beton. Telefon için hafif: 2-3 oktav gürültü,
// ince çizgi piksel altına inince söner (titreme yok).
export const FK = { PLAIN: 0, FIELD: 1, MUD: 2, DUCKX: 3, DUCKZ: 4, SANDBAG: 5, PLANK: 6, STONE: 7, PLASTER: 8, CONC: 9, TILE: 10, METAL: 11, BARK: 12, LEAF: 13, TIMBER: 14, EARTH: 15 };

const NOISE = `
float fh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float fn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(fh(i), fh(i+vec2(1.,0.)), f.x), mix(fh(i+vec2(0.,1.)), fh(i+vec2(1.,1.)), f.x), f.y); }
float ff(vec2 p){ return fn(p) * 0.6 + fn(p * 2.07 + 3.1) * 0.28 + fn(p * 4.3 + 7.7) * 0.12; }
`;

export function makeCepheMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.93, metalness: 0 });
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
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);
  float aaF = 1.0 - smoothstep(0.012, 0.035, pxw), aaM = 1.0 - smoothstep(0.03, 0.08, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.35);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  if (kind == 1.0) {                                           // ── TARLA: soluk çimen + çamur lekeleri, kuru ot benekleri ──
    float m = ff(p * 0.09 + 3.0);
    float mud = smoothstep(0.52, 0.7, m + 0.25 * (fn(p * 0.6) - 0.5));
    c = mix(c, c * vec3(0.78, 0.7, 0.6), mud * 0.75);
    c *= 0.9 + 0.16 * fn(p * 1.7) + 0.1 * (fh(floor(p * 9.0)) - 0.5) * aaF;
    c = mix(c, vec3(0.2, 0.19, 0.09), step(0.95, fh(floor(p * 9.0 + 1.7))) * 0.22 * aaF * (1.0 - mud));   // kuru ot tutamı
  } else if (kind == 2.0) {                                    // ── ÇAMUR: koyu ıslak toprak, su birikintisi parlaması, ayak izi pürüzü ──
    float w = ff(p * 0.35 + seed);
    c *= 0.78 + 0.3 * w + 0.1 * (fn(p * 6.0) - 0.5);
    vec2 fp = p * vec2(2.2, 1.4); vec2 fi = floor(fp), ffr = fract(fp) - 0.5;                                              // ayak izi / çukurcuk
    c *= 1.0 - 0.22 * step(0.78, fh(fi + 3.0)) * (1.0 - smoothstep(0.12, 0.28, length(ffr * vec2(1.0, 0.6)))) * aaM;
    c = mix(c, c * vec3(1.08, 1.0, 0.86), smoothstep(0.6, 0.8, ff(p * 0.12 + 4.0)) * 0.4);                                 // kuru kabuk
    float pud = smoothstep(0.62, 0.7, ff(p * 0.22 + 11.0)) * up;
    c = mix(c, c * 0.55 + vec3(0.006, 0.008, 0.01), pud);
    gRough = mix(0.95, 0.28, pud);
  } else if (kind == 3.0 || kind == 4.0) {                     // ── ÖRDEK TAHTASI (siper tabanı şeridi): enine çıtalar (3: x boyunca, 4: z boyunca), aralarda çamur ──
    float a = kind == 3.0 ? vWP.x : vWP.z, bb = kind == 3.0 ? vWP.z : vWP.x;
    float sl = fract(a / 0.2), si = floor(a / 0.2);
    c *= 0.78 + 0.32 * fh(vec2(si, seed)) * aaF;
    c *= 0.92 + 0.12 * fn(vec2(a * 3.0, bb * 22.0));
    float gap = (1.0 - smoothstep(0.0, 0.18, min(sl, 1.0 - sl) * 1.6)) * aaM;
    c = mix(c, vec3(0.03, 0.022, 0.016), gap * 0.85);
    c = mix(c, c * vec3(0.7, 0.62, 0.55), smoothstep(0.55, 0.8, ff(p * 0.9 + seed)) * 0.6);      // çamur sıçraması
  } else if (kind == 5.0) {                                    // ── KUM TORBASI: şaşırtmalı sıralar, yastık (yuvarlak kenar + sırt), çuval bezi, bağ ucu, çamur lekesi ──
    vec2 bq = side > 0.5 ? vec2(u / 0.56, vWP.y / 0.17) : vec2(p.x / 0.56, p.y / 0.34);
    float row = floor(bq.y);
    bq.x += 0.5 * mod(row, 2.0) + 0.13 * (fh(vec2(row, seed)) - 0.5);
    vec2 bf = fract(bq), bi = floor(bq);
    vec2 e = min(bf, 1.0 - bf);
    float pil = smoothstep(0.0, 0.16, e.x) * smoothstep(0.0, 0.34, e.y);
    float bulge = 1.0 - pow(abs(bf.y - 0.42) * 2.0, 2.0) * 0.35;                              // torbanın ortası kabarık (üstten ışık)
    c *= 0.72 + 0.34 * fh(bi + seed);
    c *= mix(0.5, 1.0, mix(1.0, pil, aaM)) * mix(1.0, bulge, aaM);
    c *= 1.0 - 0.045 * (step(0.5, fract((side > 0.5 ? u : p.x) * 32.0)) * step(0.5, fract((side > 0.5 ? vWP.y : p.y) * 32.0))) * aaF;   // bez örgüsü
    c *= 1.0 - 0.25 * smoothstep(0.86, 0.95, bf.x) * step(abs(bf.y - 0.5), 0.18) * aaM;                          // bağ ucu
    c = mix(c, c * vec3(0.62, 0.55, 0.47), smoothstep(0.55, 0.85, ff(wq * 1.1 + p * 0.6)) * 0.65);                 // çamur lekesi
  } else if (kind == 6.0) {                                    // ── KALAS (siper kaplaması / sandık / kapı): düşey tahtalar, ek çizgisi ──
    float pv = side > 0.5 ? u : vWP.x;
    float pl = floor(pv / 0.21), edge = abs(fract(pv / 0.21) - 0.5);
    c *= 0.8 + 0.3 * fh(vec2(pl, seed));
    c *= 0.92 + 0.12 * fn(vec2(pv * 30.0, (side > 0.5 ? vWP.y : vWP.z) * 1.6));
    c *= 1.0 - 0.3 * smoothstep(0.42, 0.5, edge) * aaM;
    if (side > 0.5) c *= 1.0 - 0.18 * (1.0 - smoothstep(-1.7, -1.1, vWP.y));                                                // dibi ıslak
  } else if (kind == 7.0) {                                    // ── MOLOZ TAŞ: düzensiz taş + harç ──
    if (side > 0.5) {
      vec2 bq = vec2(u / 0.62, vWP.y / 0.3); bq.x += 0.37 * mod(floor(bq.y), 3.0);
      vec2 bf = fract(bq), bi = floor(bq);
      float ln = min(min(bf.x, 1.0 - bf.x) * 0.62, min(bf.y, 1.0 - bf.y) * 0.3);
      c *= 0.7 + 0.38 * fh(bi + seed);
      c *= 1.0 - 0.45 * (1.0 - smoothstep(0.012, 0.03, ln)) * aaM;
      c = mix(c, c * vec3(0.72, 0.76, 0.66), smoothstep(0.62, 0.85, ff(wq * 0.7 + 3.0)) * 0.6);                              // yosun / is lekesi
      c *= 1.0 - 0.14 * (1.0 - smoothstep(0.0, 0.6, vWP.y));
    } else c *= 0.9 + 0.12 * fn(p * 2.0);
  } else if (kind == 8.0) {                                    // ── SIVA (köy evi): kirli badana, dökülmüş yerlerde taş, is lekesi ──
    float dmg = smoothstep(0.5, 0.58, ff(wq * vec2(0.42, 0.55) + p * 0.3 + seed * 1.7) + 0.12 * (1.0 - smoothstep(0.0, 1.2, vWP.y)));
    c *= 0.9 + 0.12 * ff(wq * 1.2 + p * 0.9);
    if (side > 0.5 && dmg > 0.0) {
      vec2 bq = vec2(u / 0.55, vWP.y / 0.28); bq.x += 0.5 * mod(floor(bq.y), 2.0);
      vec2 bf = fract(bq); float ln = min(min(bf.x, 1.0 - bf.x) * 0.55, min(bf.y, 1.0 - bf.y) * 0.28);
      vec3 st = vec3(0.25, 0.22, 0.18) * (0.82 + 0.26 * fh(floor(bq) + seed)) * (1.0 - 0.3 * (1.0 - smoothstep(0.008, 0.02, ln)) * aaM);
      c = mix(c, st, dmg);
    }
    c *= 1.0 - 0.32 * smoothstep(0.5, 0.9, ff(wq * vec2(0.3, 0.12) + 5.0)) * side;                                        // is / yağmur akıntısı
    c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.012, abs(fn(wq * vec2(2.6, 1.8) + 2.0) - 0.5) * 0.5)) * aaM * side * step(0.62, fn(wq * 0.7 + 5.0));   // ince çatlak (seyrek)
    c = mix(c, c * vec3(0.55, 0.52, 0.5), smoothstep(0.62, 0.8, ff(wq * 0.25 + 9.0 + seed)) * 0.6 * side);                // yangın isi
    c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.7, vWP.y)) * side;
  } else if (kind == 9.0) {                                    // ── BETON (sığınak): kalıp tahtası izleri, leke ──
    c *= 0.88 + 0.14 * ff(wq * 0.8 + p * 0.8 + seed) + 0.05 * (fn(wq * 9.0 + p * 9.0) - 0.5) * aaM;
    if (side > 0.5) {
      float fm = abs(fract(vWP.y / 0.3) - 0.5);
      c *= 1.0 - 0.1 * smoothstep(0.44, 0.5, fm) * aaM;
      c *= 1.0 - 0.2 * smoothstep(0.55, 0.85, ff(vec2(u * 0.8, vWP.y * 0.2) + 9.0));
    }
  } else if (kind == 10.0) {                                   // ── KİREMİT ──
    float ra = abs(n.x) > abs(n.z) ? vWP.z : vWP.x;
    float row = fract(vWP.y / 0.2), col = abs(fract(ra / 0.28) - 0.5);
    c *= 0.84 + 0.2 * fh(vec2(floor(vWP.y / 0.2), floor(ra / 0.28)) + seed);
    c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.18, row)) * aaM;
    c *= 1.0 - 0.1 * smoothstep(0.38, 0.5, col) * aaM;
    c = mix(c, c * 0.5, smoothstep(0.5, 0.8, ff(p * 0.5 + 2.0)) * 0.7);                                                     // is / yosun
    c = mix(c, vec3(dot(c, vec3(0.33))), 0.35);                                                                              // soluk
  } else if (kind == 11.0) {                                   // ── PASLI ÇELİK (tel kazığı, top, kapak) ──
    c *= 0.9 + 0.14 * ff(wq * 1.1 + p * 0.6 + seed);
    c = mix(c, vec3(0.15, 0.06, 0.03), smoothstep(0.55, 0.8, ff(wq * 2.3 + p * 1.7 + 11.0)) * 0.7);
    gRough = 0.6; gMetal = 0.35;
  } else if (kind == 12.0) {                                   // ── AĞAÇ KABUĞU: düşey çizgiler ──
    c *= 0.82 + 0.26 * fn(vec2(u * 9.0 + seed, vWP.y * 1.2));
    c *= 1.0 - 0.2 * step(0.8, fn(vec2(u * 22.0, vWP.y * 0.8))) * aaM;
  } else if (kind == 13.0) {                                   // ── YAPRAK (soluk, tozlu) ──
    c *= 0.8 + 0.3 * fh(floor((side > 0.5 ? wq : p) * 4.0) + seed) * aaF + 0.1 * ff(p * 0.5);
  } else if (kind == 14.0) {                                   // ── KİRİŞ / DİREK: uzun eksende damar ──
    vec2 g = side > 0.5 ? vec2(u, vWP.y) : p;
    float gl = abs(n.x) > 0.5 ? vWP.z : abs(n.z) > 0.5 ? vWP.x : vWP.x;
    c *= 0.84 + 0.2 * fh(vec2(seed, 1.0)) + 0.1 * fn(vec2(gl * 1.5, (side > 0.5 ? vWP.y : vWP.z) * 25.0));
    c *= 1.0 - 0.12 * smoothstep(0.7, 0.9, ff(g * 3.0 + seed));
  } else if (kind == 15.0) {                                   // ── HAM TOPRAK (siper duvarı): yatay katmanlar, kök, ıslak dip ──
    float lw = vWP.y / 0.32 + (fn(vec2(u * 0.5, 1.0)) - 0.5) * 0.8;
    c *= 0.84 + 0.18 * fh(vec2(floor(lw), seed)) + 0.1 * (ff(wq * vec2(1.4, 3.0)) - 0.5);
    c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.08, abs(fract(lw) - 0.5) * 2.0 - 0.8)) * aaM * side;
    c *= 1.0 - 0.28 * (1.0 - smoothstep(-1.65, -0.9, vWP.y)) * side;                                                       // dibi ıslak, koyu
    c *= 1.0 - 0.18 * step(0.93, fh(floor(wq * 11.0) + seed)) * aaF;                                                       // çakıl
    c *= 1.0 - 0.2 * smoothstep(0.7, 0.9, ff(vec2(u * 3.0, vWP.y * 0.6) + seed)) * side;                                   // kök / ıslak leke
    if (up > 0.5) c *= 0.95;
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;');
  };
  material.customProgramCacheKey = () => 'cephe-surface-v1';
  return material;
}
