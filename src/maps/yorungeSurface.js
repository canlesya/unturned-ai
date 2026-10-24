import * as THREE from 'three';

// Yörünge Üssü yüzeyi (12.157): Maden / Depo yöntemi — tüm düz parçalar tek köşe-renkli ağ, doku yerine dünya koordinatlı prosedürel gölgelendirici (UV yok, çizim çağrısı artmaz).
// aKind alt 4 bit = sınıf, üst 4 bit = parça tohumu. Telefon için hafif: 2–3 oktav gürültü, ince çizgiler piksel altına inince söner (titreme yok).
// Renk dili: gri regolit + kırık beyaz modül gövdesi + koyu metal çerçeve; turuncu uyarı şeridi küçük yüzeylerde (asker silueti öne çıksın).
export const YK = { PLAIN: 0, REGOLITH: 1, ROCK: 2, HULL: 3, PLATE: 4, SOLAR: 5, PAD: 6, STRIPE: 7, METAL: 8, GRATE: 9, CRATE: 10, DUST: 11, PANEL: 12 };

const NOISE = `
float yh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float yn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(yh(i), yh(i+vec2(1.,0.)), f.x), mix(yh(i+vec2(0.,1.)), yh(i+vec2(1.,1.)), f.x), f.y); }
float yf(vec2 p){ return yn(p) * 0.6 + yn(p * 2.07 + 3.1) * 0.28 + yn(p * 4.3 + 7.7) * 0.12; }
// küçük krater çukurları: hücre başına bir çukur (karanlık iç, aydınlık kenar); r = hücre boyuna göre yarıçap
float pits(vec2 p, float cell, float aa){
  vec2 c = floor(p / cell), f = fract(p / cell) - 0.5;
  vec2 o = vec2(yh(c), yh(c + 17.0)) - 0.5; float r = 0.12 + 0.22 * yh(c + 41.0);
  float d = length(f - o * 0.5) / r;
  if (yh(c + 7.0) < 0.55) return 0.0;
  return (-0.22 * (1.0 - smoothstep(0.55, 0.95, d)) + 0.12 * smoothstep(0.8, 1.0, d) * (1.0 - smoothstep(1.0, 1.25, d))) * aa;
}
`;

export function makeYorungeMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
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
  float aaF = 1.0 - smoothstep(0.012, 0.035, pxw), aaM = 1.0 - smoothstep(0.03, 0.08, pxw), aaL = 1.0 - smoothstep(0.08, 0.2, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  if (kind == 1.0 || kind == 11.0) {                            // ── REGOLİT (Ay tozu): geniş ton lekeleri, iki boy krater çukuru, ince tane; DUST = krater tabanı (koyu, pürüzsüz)
    float big = yf(p * 0.035 + seed);
    c *= 0.84 + 0.26 * big + 0.05 * (yn(p * 3.1) - 0.5) * aaM;
    c *= 1.0 - 0.1 * smoothstep(0.6, 0.85, yf(p * 0.11 + 13.0));
    c *= 1.0 + pits(p, 3.2, aaL) + 0.7 * pits(p + 11.0, 1.1, aaM);
    c *= 1.0 + 0.08 * (step(0.9, yh(floor(p * 9.0))) - 0.5) * aaF;     // ince tane / çakıl beneği
    if (kind == 11.0) c *= 0.86;
    gRough = 0.97;
  } else if (kind == 2.0) {                                     // ── AY KAYASI: köşeli, koyu gri, katmansız çatlaklar, tepede toz
    c *= 0.82 + 0.22 * yf(wq * 0.5 + p * 0.3 + seed) + 0.05 * (yn(wq * 6.0 + p * 6.0) - 0.5) * aaM;
    float cr = abs(yn(wq * vec2(2.2, 0.7) + p * 0.9 + seed * 3.0) - 0.5);
    c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.03, cr)) * aaM * side;
    if (up > 0.5) { c = mix(c, vec3(0.62, 0.62, 0.6), 0.45); c *= 0.92 + 0.12 * yf(p * 0.6 + seed); }
    gRough = 0.96;
  } else if (kind == 3.0) {                                     // ── MODÜL GÖVDESİ: kırık beyaz panel (1,2 × 0,9 m), derz, perçin, altta toz
    if (side > 0.5) {
      vec2 q = vec2(u / 1.2, vWP.y / 0.9); vec2 f = fract(q), i = floor(q);
      float ln = min(min(f.x, 1.0 - f.x) * 1.2, min(f.y, 1.0 - f.y) * 0.9);
      c *= 0.94 + 0.08 * yh(i + seed);
      c *= 1.0 - 0.26 * (1.0 - smoothstep(0.008, 0.022, ln)) * aaM;
      vec2 bq = abs(f - 0.5) - vec2(0.44, 0.42);
      c *= 1.0 - 0.18 * step(max(bq.x, bq.y), 0.0) * step(length(fract(vec2(u / 0.3, vWP.y / 0.9)) - vec2(0.5, 0.06)), 0.08) * aaF;   // perçin sırası
      c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.8, vWP.y));                                                      // tabanda regolit tozu
    } else c *= 0.92 + 0.08 * yf(p * 0.4 + seed);
    gRough = 0.55; gMetal = 0.05;
  } else if (kind == 4.0) {                                     // ── İÇ ZEMİN PLAKASI: 1,5 m kare plakalar + kabartma tırtıl
    vec2 q = p / 1.5; vec2 f = fract(q), i = floor(q);
    float ln = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 1.5;
    c *= 0.9 + 0.12 * yh(i + seed);
    c *= 1.0 - 0.3 * (1.0 - smoothstep(0.008, 0.02, ln)) * aaM;
    vec2 t = fract(p * 6.0 + vec2(0.25 * mod(floor(p.y * 6.0), 2.0), 0.0));
    c *= 1.0 + 0.06 * (step(0.7, t.x) * step(0.4, t.y) - 0.15) * aaF;
    gRough = 0.7; gMetal = 0.12;
  } else if (kind == 5.0) {                                     // ── GÜNEŞ PANELİ: koyu lacivert hücre ızgarası, ince gümüş çizgi, hafif metal parlama
    vec2 q = vec2(abs(n.x) > 0.5 ? vWP.z : vWP.x, abs(n.y) > 0.5 ? (abs(n.x) > 0.5 ? vWP.x : vWP.z) : vWP.y) / 0.16;
    vec2 f = fract(q);
    float ln = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    c = mix(c, vec3(0.62, 0.66, 0.72), (1.0 - smoothstep(0.02, 0.07, ln)) * aaM * 0.7);
    c *= 0.92 + 0.12 * yh(floor(q) + seed);
    gRough = 0.22; gMetal = 0.55;
  } else if (kind == 6.0) {                                     // ── İNİŞ PİSTİ BETONU: altıgen döşeme + is lekesi (merkezde yanık)
    vec2 q = p / 1.6; q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 f = fract(q); float ln = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 1.6;
    c *= 0.9 + 0.14 * yh(floor(q) + seed) + 0.06 * (yf(p * 0.5) - 0.5);
    c *= 1.0 - 0.24 * (1.0 - smoothstep(0.01, 0.025, ln)) * aaM;
    c *= 1.0 - 0.35 * smoothstep(0.75, 0.15, yf(p * 0.25 + 3.0) * 0.6 + length(p - vec2(0.0, 26.0)) / 16.0);
    gRough = 0.85;
  } else if (kind == 7.0) {                                     // ── UYARI ŞERİDİ: sarı-siyah çapraz, aşınmış
    float s = step(0.5, fract((u + vWP.y + p.x * up + p.y * up) / 0.5));
    c = mix(c, vec3(0.06, 0.06, 0.07), s * aaL);
    c = mix(c, c * 0.65, smoothstep(0.55, 0.85, yf(p * 1.6 + wq * 1.3 + 5.0)) * 0.6);
  } else if (kind == 8.0) {                                     // ── KOYU METAL (çerçeve, payanda, anten): fırçalı, kenar aşınması
    c *= 0.9 + 0.14 * yf(wq * 1.3 + p * 0.7 + seed);
    c *= 1.0 + 0.06 * (yn(vec2(u * 0.6, vWP.y * 40.0)) - 0.5) * aaF;
    gRough = 0.45; gMetal = 0.6;
  } else if (kind == 9.0) {                                     // ── IZGARA (iskele / köprü yürüme yolu): delikli kare ızgara
    vec2 q = (up > 0.5 ? p : wq) / 0.12; vec2 f = fract(q);
    float hole = step(0.22, f.x) * step(f.x, 0.78) * step(0.22, f.y) * step(f.y, 0.78);
    c *= mix(1.0, 0.45, hole * aaM);
    gRough = 0.5; gMetal = 0.55;
  } else if (kind == 10.0) {                                    // ── KARGO KONTEYNERİ: dikey kaburga + köşe şeridi + şablon yazısı lekesi
    float rib = abs(fract(u / 0.28) - 0.5) * 2.0;
    c *= mix(1.0, 0.86 + 0.2 * smoothstep(0.25, 0.75, rib), aaM * side);
    c *= 0.94 + 0.08 * yf(wq * 0.8 + seed);
    gRough = 0.6; gMetal = 0.2;
  } else if (kind == 12.0) {                                    // ── İÇ DUVAR PANELİ: açık gri, yatay çizgi + koyu süpürgelik
    if (side > 0.5) {
      float row = fract(vWP.y / 0.6);
      c *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.05, min(row, 1.0 - row))) * aaM;
      c *= 0.95 + 0.06 * yh(vec2(floor(u / 1.8), floor(vWP.y / 0.6)) + seed);
      if (vWP.y - floor(vWP.y / 6.2) * 6.2 < 0.22) c *= 0.55;
    }
    gRough = 0.5;
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;');
  };
  material.customProgramCacheKey = () => 'yorunge-surface-v1';
  return material;
}
