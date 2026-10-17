import * as THREE from 'three';

// Depo haritası yüzeyi (gündüz endüstri): Çöl Geçidi / New York yöntemi — tüm düz parçalar tek köşe-renkli ağda, doku yerine dünya koordinatlı
// prosedürel gölgelendirici (UV yok, çizim çağrısı artmaz). aKind alt 4 bit = sınıf, üst 4 bit = parça tohumu (her konteyner / koli kendi tonunda).
// Telefon için hafif: 2-3 oktav gürültü, ince çizgiler piksel altına inince söner (titreme yok). Renkler açık-orta ton: koyu asker silueti öne çıksın.
export const DK = { PLAIN: 0, YARD: 1, FLOOR: 2, CLAD: 3, BOX: 4, WOOD: 5, BLOCK: 6, STEEL: 7, MARK: 8, CARTON: 9, ROOF: 10, ASPH: 11, RUBBER: 12, CONC: 13 };

const NOISE = `
float dh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float dn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(dh(i), dh(i+vec2(1.,0.)), f.x), mix(dh(i+vec2(0.,1.)), dh(i+vec2(1.,1.)), f.x), f.y); }
float df(vec2 p){ return dn(p) * 0.6 + dn(p * 2.07 + 3.1) * 0.28 + dn(p * 4.3 + 7.7) * 0.12; }
`;

export function makeDepoMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 });
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
  float aaF = 1.0 - smoothstep(0.012, 0.035, pxw), aaM = 1.0 - smoothstep(0.03, 0.08, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);                                   // duvar düzleminde yatay koordinat
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  if (kind == 1.0 || kind == 2.0) {                            // ── BETON ZEMİN: avlu levhası (1) / iç mekân epoksi (2) ──
    float big = df(p * 0.07 + seed), fine = dn(p * 3.1);
    c *= 0.9 + 0.16 * big + 0.05 * (fine - 0.5);
    float L = kind == 1.0 ? 4.0 : 6.0;                         // levha derzi (avlu 4 m, iç 6 m)
    vec2 g = abs(fract(p / L) - 0.5) * L;
    c *= 1.0 - 0.28 * (1.0 - smoothstep(0.012, 0.035, min(g.x, g.y))) * aaM * up;
    c *= 1.0 - 0.06 * step(0.8, dh(floor(p / L) + 4.0));       // tek tük farklı tonda levha
    c *= 1.0 - 0.12 * smoothstep(0.66, 0.86, df(p * 0.21 + 30.0));           // yağ / is lekesi (hafif: asker silueti zeminde kaybolmasın)
    if (kind == 1.0) c *= 1.0 - 0.1 * smoothstep(0.55, 0.75, dn(vec2(p.x * 0.35, p.y * 3.2) + 9.0)) * smoothstep(0.5, 0.7, dn(p * 0.05 + 2.0));   // lastik izi
    else { gRough = 0.55 + 0.25 * big; }                       // iç zemin hafif parlak
  } else if (kind == 3.0) {                                    // ── OLUKLU SAC CEPHE (alt 1,1 m beton kaide, 2,4 m'de boya bandı) ──
    if (side > 0.5) {
      float rib = abs(fract(u / 0.25) - 0.5) * 2.0;
      c *= mix(1.0, 0.86 + 0.18 * smoothstep(0.15, 0.85, rib), aaM);
      c *= 0.94 + 0.1 * df(wq * vec2(0.4, 0.15) + seed);
      c *= 1.0 - 0.14 * smoothstep(0.55, 0.85, dn(vec2(u * 1.6, vWP.y * 0.12) + 5.0)) * smoothstep(1.2, 4.0, vWP.y);   // akıntı izleri
      float pl = 1.0 - step(1.1, vWP.y);
      vec3 conc = vec3(0.56, 0.55, 0.52) * (0.9 + 0.16 * df(wq * 1.3));
      c = mix(c, conc, pl);
      c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.035, abs(vWP.y - 1.1))) * aaM;
      float band = step(2.3, vWP.y) * (1.0 - step(2.65, vWP.y));
      c = mix(c, vec3(0.2, 0.36, 0.42), band * 0.85);                                          // petrol mavisi şirket bandı (koyu değil, gri-mavi)
      c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.5, vWP.y));                                    // taban kiri
    } else c *= 0.82;
  } else if (kind == 4.0) {                                    // ── KONTEYNER: oluklu boyalı çelik, solma, pas akıntısı ──
    c *= 0.9 + 0.16 * dh(vec2(seed, 3.0));
    if (side > 0.5) {
      float rib = abs(fract(u / 0.3) - 0.5) * 2.0;
      c *= mix(1.0, 0.8 + 0.26 * smoothstep(0.2, 0.8, rib), aaM);
    } else if (up > 0.5) c *= 0.92 + 0.08 * smoothstep(0.3, 0.7, abs(fract(dot(p, vec2(0.7071)) / 0.3) - 0.5) * 2.0);
    c *= 0.93 + 0.1 * df(wq * 0.5 + p * 0.3 + seed * 3.0);
    float rs = smoothstep(0.62, 0.82, df(vec2(u * 2.2, vWP.y * 0.35) + seed * 5.0));             // pas akıntısı
    c = mix(c, vec3(0.42, 0.24, 0.13), rs * 0.45);
    gRough = 0.7; gMetal = 0.15;
  } else if (kind == 5.0) {                                    // ── AHŞAP (sandık, palet) ──
    float pv = side > 0.5 ? vWP.y : (abs(n.x) > 0.5 ? vWP.z : vWP.x);
    float pl = floor(pv / 0.16), edge = abs(fract(pv / 0.16) - 0.5);
    c *= 0.86 + 0.24 * dh(vec2(pl, seed));
    c *= 0.93 + 0.12 * dn(vec2((side > 0.5 ? u : pv) * 1.7, pv * 30.0));
    c *= 1.0 - 0.3 * smoothstep(0.42, 0.5, edge) * aaM;
  } else if (kind == 6.0) {                                    // ── BETON BLOK DUVAR (çevre) ──
    if (side > 0.5) {
      vec2 bp = vec2(u / 0.4, vWP.y / 0.2); bp.x += 0.5 * mod(floor(bp.y), 2.0);
      vec2 bf = fract(bp), bi = floor(bp);
      float ln = min(min(bf.x, 1.0 - bf.x) * 0.4, min(bf.y, 1.0 - bf.y) * 0.2);
      c *= 0.9 + 0.14 * dh(bi + seed);
      c *= 1.0 - 0.24 * (1.0 - smoothstep(0.006, 0.016, ln)) * aaF;
      c *= 1.0 - 0.18 * smoothstep(0.6, 0.85, dn(vec2(u * 0.8, vWP.y * 0.15) + 3.0));
      c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.6, vWP.y));
    } else c *= 0.95 + 0.08 * dn(p * 2.0);
  } else if (kind == 7.0) {                                    // ── BOYALI ÇELİK (raf, korkuluk, merdiven, forklift) ──
    c *= 0.92 + 0.12 * df(wq * 1.1 + p * 0.6 + seed);
    c = mix(c, c * vec3(0.7, 0.66, 0.62), smoothstep(0.66, 0.82, df(wq * 2.3 + p * 1.7 + 11.0)) * 0.6);   // aşınma
    gRough = 0.55; gMetal = 0.25;
  } else if (kind == 8.0) {                                    // ── ZEMİN BOYASI: aşınmış ──
    float wear = smoothstep(0.5, 0.85, df(p * 1.2 + 5.0) + 0.25 * dn(p * 9.0));
    c = mix(c, c * 0.62, wear * 0.7);
    gRough = 0.6;
  } else if (kind == 9.0) {                                    // ── KOLİ / STREÇ: karton tonu, bant çizgisi ──
    c *= 0.86 + 0.24 * dh(vec2(seed, 9.0));
    c *= 0.95 + 0.08 * dn(wq * 2.5 + p * 2.5);
    float tp = side > 0.5 ? abs(fract(vWP.y / 0.45) - 0.5) : abs(fract((abs(n.x) > 0.5 ? vWP.z : vWP.x) / 0.5) - 0.5);
    c = mix(c, c * vec3(1.12, 1.05, 0.9), (1.0 - smoothstep(0.03, 0.05, tp)) * aaM * 0.7);
  } else if (kind == 10.0) {                                   // ── ÇATI SACI ──
    float rib = abs(fract(vWP.x / 0.35) - 0.5) * 2.0;
    c *= mix(1.0, 0.85 + 0.2 * smoothstep(0.2, 0.8, rib), aaM);
    c *= 0.92 + 0.12 * df(p * 0.3);
    gMetal = 0.2; gRough = 0.6;
  } else if (kind == 11.0) {                                   // ── ASFALT (dış yol) ──
    c *= 0.82 + 0.3 * df(p * 0.12) + 0.08 * (dh(floor(p * 20.0)) - 0.5) * aaF;
  } else if (kind == 13.0) {                                   // ── DÖKME BETON (bariyer, kaide) ──
    c *= 0.9 + 0.14 * df(wq * 0.8 + p * 0.8 + seed) + 0.05 * (dn(wq * 9.0 + p * 9.0) - 0.5) * aaM;
    if (side > 0.5) c *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.4, vWP.y));
  } else if (kind == 12.0) {                                   // ── LASTİK ──
    c *= 0.9 + 0.1 * dn(wq * 6.0);
    gRough = 0.95;
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;');
  };
  material.customProgramCacheKey = () => 'depo-surface-v1';
  return material;
}
