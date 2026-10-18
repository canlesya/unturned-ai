import * as THREE from 'three';

// Maden Ocağı yüzeyi: Depo / Liman yöntemi — tüm düz parçalar tek köşe-renkli ağ, doku yerine dünya koordinatlı prosedürel gölgelendirici (UV yok, çizim çağrısı artmaz).
// aKind alt 4 bit = sınıf, üst 4 bit = parça tohumu (her tahta / taş kendi tonunda). Telefon için hafif: 2-3 oktav gürültü, ince çizgi piksel altına inince söner (titreme yok).
// Renkler toprak / ahşap / taş; takım renkleri (mavi / kırmızı) büyük yüzeyde yok: asker silueti ve vagon öne çıksın.
export const MK = { PLAIN: 0, DIRT: 1, GRAVEL: 2, PAVE: 3, PLANK: 4, WOOD: 5, STONE: 6, ROCK: 7, TIN: 8, STEEL: 9, MARK: 10, ORE: 11, TILE: 12, CONC: 13, RUBBER: 14 };

const NOISE = `
float mh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float mn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mh(i), mh(i+vec2(1.,0.)), f.x), mix(mh(i+vec2(0.,1.)), mh(i+vec2(1.,1.)), f.x), f.y); }
float mf(vec2 p){ return mn(p) * 0.6 + mn(p * 2.07 + 3.1) * 0.28 + mn(p * 4.3 + 7.7) * 0.12; }
`;

export function makeMadenMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
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
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  if (kind == 1.0) {                                           // ── SIKIŞMIŞ TOPRAK: geniş ton lekeleri, çakıl benekleri, tekerlek izi ──
    c *= 0.88 + 0.2 * mf(p * 0.06 + seed) + 0.06 * (mn(p * 2.6) - 0.5);
    c *= 1.0 - 0.1 * smoothstep(0.62, 0.85, mf(p * 0.18 + 21.0));
    c *= 1.0 + 0.1 * (step(0.93, mh(floor(p * 7.0))) - 0.5) * aaF;
  } else if (kind == 2.0) {                                    // ── BALAST ÇAKILI (ray yatağı) ──
    vec2 g = floor(p * 9.0);
    c *= 0.78 + 0.36 * mh(g + seed) * aaF + 0.12 * mf(p * 0.5);
  } else if (kind == 3.0) {                                    // ── TAŞ DÖŞEME (köy meydanı / avlu): düzensiz parke + derz ──
    vec2 q = p / vec2(0.62, 0.42); q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 f = fract(q), i = floor(q);
    float ln = min(min(f.x, 1.0 - f.x) * 0.62, min(f.y, 1.0 - f.y) * 0.42);
    c *= 0.86 + 0.22 * mh(i + seed);
    c *= 1.0 - 0.3 * (1.0 - smoothstep(0.012, 0.03, ln)) * aaM;
    c *= 0.94 + 0.1 * mf(p * 0.15);
  } else if (kind == 4.0) {                                    // ── EV CEPHESİ: 0,8 m taş kaide + üstü yatay bindirme tahta ──
    if (side > 0.5) {
      if (vWP.y < 0.8) {
        vec2 bq = vec2(u / 0.55, vWP.y / 0.27); bq.x += 0.5 * mod(floor(bq.y), 2.0);
        vec2 bf = fract(bq); float ln = min(min(bf.x, 1.0 - bf.x) * 0.55, min(bf.y, 1.0 - bf.y) * 0.27);
        c = vec3(0.52, 0.49, 0.45) * (0.86 + 0.24 * mh(floor(bq) + seed));
        c *= 1.0 - 0.3 * (1.0 - smoothstep(0.008, 0.02, ln)) * aaM;
      } else {
        float pl = floor((vWP.y - 0.8) / 0.19), e = fract((vWP.y - 0.8) / 0.19);
        c *= 0.88 + 0.16 * mh(vec2(pl, seed));
        c *= 0.94 + 0.1 * mn(vec2(u * 1.3, pl * 7.0));
        c *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.12, e)) * aaM;               // bindirme gölgesi
        c *= 1.0 - 0.12 * smoothstep(0.6, 0.85, mn(vec2(u * 0.7, vWP.y * 0.2) + 4.0));   // hava lekesi
      }
    } else c *= 0.9;
  } else if (kind == 5.0) {                                    // ── AHŞAP (sandık, kiriş, travers, iskele) ──
    float pv = side > 0.5 ? vWP.y : (abs(n.x) > 0.5 ? vWP.z : vWP.x);
    float pl = floor(pv / 0.18), edge = abs(fract(pv / 0.18) - 0.5);
    c *= 0.84 + 0.26 * mh(vec2(pl, seed));
    c *= 0.93 + 0.12 * mn(vec2((side > 0.5 ? u : pv) * 1.5, pv * 26.0));
    c *= 1.0 - 0.26 * smoothstep(0.42, 0.5, edge) * aaM;
  } else if (kind == 6.0) {                                    // ── MOLOZ TAŞ DUVAR (avlu duvarı): düzensiz taş + harç ──
    if (side > 0.5) {
      vec2 bq = vec2(u / 0.7, vWP.y / 0.34); bq.x += 0.37 * mod(floor(bq.y), 3.0);
      vec2 bf = fract(bq), bi = floor(bq);
      float ln = min(min(bf.x, 1.0 - bf.x) * 0.7, min(bf.y, 1.0 - bf.y) * 0.34);
      c *= 0.8 + 0.3 * mh(bi + seed);
      c *= 1.0 - 0.32 * (1.0 - smoothstep(0.01, 0.028, ln)) * aaM;
      c *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.5, vWP.y));
    } else c *= 0.95 + 0.08 * mn(p * 2.0);
  } else if (kind == 7.0) {                                    // ── KAYA (taş ocağı basamağı): yatay katman, düşey çatlak, tepede toz ──
    float lw = vWP.y / 0.85 + (mn(vec2(u * 0.06, 1.0)) - 0.5) * 0.9;
    float layer = floor(lw), lf = fract(lw);
    c *= 0.82 + 0.2 * mh(vec2(layer, seed)) + 0.08 * (mf(wq * vec2(0.25, 0.6) + seed) - 0.5);
    c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.07, min(lf, 1.0 - lf))) * aaM * side;          // katman çizgisi
    float jt = abs(fract(u / (1.9 + 1.4 * mh(vec2(layer, 7.0))) + mh(vec2(layer, 3.0))) - 0.5);
    c *= 1.0 - 0.26 * (1.0 - smoothstep(0.0, 0.025, jt)) * aaM * side;                       // düşey çatlak (katman başına kayık)
    if (up > 0.5) { c = mix(c, vec3(0.6, 0.52, 0.4), 0.5); c *= 0.9 + 0.16 * mf(p * 0.4 + seed); }   // basamak tepesi tozlu
  } else if (kind == 8.0) {                                    // ── OLUKLU SAC (çatı / kaplama): oluk, pas ──
    float a = side > 0.5 ? u : vWP.x;
    float rib = abs(fract(a / 0.2) - 0.5) * 2.0;
    c *= mix(1.0, 0.82 + 0.24 * smoothstep(0.2, 0.8, rib), aaM);
    float rs = smoothstep(0.6, 0.85, mf(vec2(a * 0.6, (side > 0.5 ? vWP.y : vWP.z) * 0.5) + seed * 3.0));
    c = mix(c, vec3(0.45, 0.27, 0.15), rs * 0.55);
    gMetal = 0.2; gRough = 0.62;
  } else if (kind == 9.0) {                                    // ── ÇELİK (ray, makine, korkuluk): aşınma ──
    c *= 0.9 + 0.14 * mf(wq * 1.1 + p * 0.6 + seed);
    c = mix(c, c * vec3(0.72, 0.62, 0.55), smoothstep(0.64, 0.82, mf(wq * 2.3 + p * 1.7 + 11.0)) * 0.6);
    gRough = 0.5; gMetal = 0.3;
  } else if (kind == 10.0) {                                   // ── BOYA ŞERİDİ (kontrol noktası çizgisi): aşınmış ──
    float wear = smoothstep(0.5, 0.85, mf(p * 1.4 + 5.0) + 0.25 * mn(p * 9.0));
    c = mix(c, c * 0.6, wear * 0.7);
  } else if (kind == 11.0) {                                   // ── CEVHER YIĞINI: iri taneli, koyu damar ──
    vec2 g = floor((side > 0.5 ? wq : p) * 5.0);
    c *= 0.72 + 0.4 * mh(g + seed) * aaF + 0.1 * mf(p * 0.7);
    c = mix(c, vec3(0.18, 0.17, 0.16), smoothstep(0.7, 0.8, mf(p * 0.9 + wq * 0.4)) * 0.5);
  } else if (kind == 12.0) {                                   // ── KİREMİT ÇATI: sıra + kiremit başı ──
    float ra = abs(n.x) > abs(n.z) ? vWP.z : vWP.x;
    float row = fract(vWP.y / 0.22), col = abs(fract(ra / 0.3) - 0.5);
    c *= 0.86 + 0.18 * mh(vec2(floor(vWP.y / 0.22), floor(ra / 0.3)) + seed);
    c *= 1.0 - 0.24 * (1.0 - smoothstep(0.0, 0.18, row)) * aaM;
    c *= 1.0 - 0.1 * smoothstep(0.38, 0.5, col) * aaM;
  } else if (kind == 13.0) {                                   // ── DÖKME BETON ──
    c *= 0.9 + 0.14 * mf(wq * 0.8 + p * 0.8 + seed) + 0.05 * (mn(wq * 9.0 + p * 9.0) - 0.5) * aaM;
    if (side > 0.5) c *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.4, vWP.y));
  } else if (kind == 14.0) {                                   // ── LASTİK / KÖMÜR ──
    c *= 0.9 + 0.12 * mn(wq * 6.0 + p * 4.0);
    gRough = 0.95;
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;');
  };
  material.customProgramCacheKey = () => 'maden-surface-v1';
  return material;
}
