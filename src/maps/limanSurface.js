import * as THREE from 'three';

// Liman yüzeyi: Çöl Geçidi / New York ile aynı yöntem (tek köşe-renkli birleşik ağ + dünya koordinatlı gölgelendirici; UV / doku yok, çizim çağrısı artmaz).
// aKind alt 4 bit = sınıf, üst 4 bit = parça başına tohum (her konteyner kendi solgunluğunda). Sınıf kutuda açıkça verilir (opt.kind / withKind).
// Gece / gün batımı: lamba direkleri ve vinç projektörleri için ucuz sahte ışık (uL: en çok 10 nokta, gölgesiz) — gerçek ışık yok, telefonda da ucuz.
export const LK = { PLAIN: 0, ASPHALT: 1, CONC: 2, BOX: 3, STEEL: 4, WOOD: 5, MARK: 6, CLAD: 7, SHUTTER: 8, RUBBER: 9 };
export const limanU = { time: { value: 0 }, night: { value: 0 } };
const MAXL = 12;

const NOISE = `
float sh21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float svn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(sh21(i), sh21(i+vec2(1.,0.)), f.x), mix(sh21(i+vec2(0.,1.)), sh21(i+vec2(1.,1.)), f.x), f.y); }
float sfbm(vec2 p){ return svn(p) * 0.55 + svn(p * 2.03 + 3.1) * 0.30 + svn(p * 4.1 + 7.7) * 0.15; }
`;

// lamps: [{ x, y, z, r, c:'#hex', k (şiddet) }]
export function makeLimanMaterial(lamps = []) {
  const L = [], LC = [];
  for (let i = 0; i < MAXL; i++) {
    const l = lamps[i];
    L.push(l ? new THREE.Vector4(l.x, l.y, l.z, l.r) : new THREE.Vector4(0, -999, 0, 0.001));
    LC.push(l ? new THREE.Color(l.c || '#ffd9a0').multiplyScalar(l.k ?? 1) : new THREE.Color(0, 0, 0));
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 });
  material.userData.glow = true;                                   // environment.applyGlow emissiveIntensity'yi günün saatine göre yazar → fx.update uNight'a çevirir
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = limanU.time; sh.uniforms.uNight = limanU.night;
    sh.uniforms.uL = { value: L }; sh.uniforms.uLC = { value: LC };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nattribute float aGnd;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vKind;\nvarying float vGnd;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvKind = aKind;\nvGnd = aGnd;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
varying float vKind;
varying float vGnd;
uniform float uTime;
uniform float uNight;
uniform vec4 uL[${MAXL}];
uniform vec3 uLC[${MAXL}];
float gRough = -1.0;
float gMetal = -1.0;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float dist = length(cameraPosition - vWP);
  float near = 1.0 - smoothstep(14.0, 50.0, dist);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);
  float aaB = 1.0 - smoothstep(0.012, 0.035, pxw), aaP = 1.0 - smoothstep(0.02, 0.06, pxw), aaJ = 1.0 - smoothstep(0.03, 0.09, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  float hg = vWP.y - vGnd;
  vec2 p = vWP.xz;
  vec2 wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  if (kind == 1.0) {                                           // ── ASFALT: agrega, yama, yağ lekesi, lastik izi ──
    if (up > 0.5) {
      c *= 0.84 + 0.32 * sfbm(p * 0.08 + 3.0);
      c *= 1.0 + (sh21(floor(p * 22.0)) - 0.5) * 0.22 * aaP + (svn(p * 8.0) - 0.5) * 0.12;
      vec2 pg = p / vec2(4.6, 3.1); vec2 pf = abs(fract(pg) - 0.5);
      c = mix(c, c * 0.78, step(0.9, sh21(floor(pg) + 9.0)) * (1.0 - smoothstep(0.4, 0.43, max(pf.x, pf.y))));
      c *= 1.0 - 0.32 * smoothstep(0.62, 0.86, sfbm(p * 0.3 + 70.0));                              // yağ lekesi
      float tr = abs(fract(p.x / 2.9 + 0.13 * svn(p * 0.05)) - 0.5);                                // forklift / tır lastik izi (kuzey-güney)
      c *= 1.0 - 0.1 * (1.0 - smoothstep(0.03, 0.09, tr)) * smoothstep(0.35, 0.7, svn(p * vec2(0.4, 0.05) + 4.0)) * aaJ;
      gRough = 0.9;
    } else c *= 0.8;
  } else if (kind == 2.0) {                                    // ── BETON: levha derzi (üst), akıntı + taban kiri (yan) ──
    c *= 0.88 + 0.22 * sfbm(wq * 0.5 + p * 0.3 + seed);
    c *= 1.0 + (svn(wq * 7.0 + p * 7.0) - 0.5) * 0.08 * aaP;
    if (up > 0.5) {
      vec2 q = p / 4.0; vec2 f = fract(q);
      float ln = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 4.0;
      c *= 1.0 - 0.35 * (1.0 - smoothstep(0.015, 0.05, ln)) * aaJ;
      c *= 0.92 + 0.16 * sh21(floor(q) + 2.0);
    }
    if (side > 0.5) { c *= 1.0 - 0.25 * smoothstep(0.6, 0.85, sfbm(vec2(u * 0.9, vWP.y * 0.12) + seed * 1.3)); c *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.7, hg)); }
    gRough = 0.92;
  } else if (kind == 3.0) {                                    // ── KONTEYNER: oluklu sac, alt / üst kiriş, solmuş boya, pas akıntısı ──
    float hc = mod(vWP.y + 0.0005, 2.6);
    vec3 base = c;
    c *= 0.92 + 0.1 * sfbm(wq * 0.6 + seed * 1.7);
    float fade = smoothstep(0.35, 0.8, sfbm(wq * 0.18 + p * 0.05 + seed * 3.3));
    c = mix(c, mix(c, vec3(dot(c, vec3(0.333))), 0.45) * 1.18 + 0.03, fade * 0.55);              // güneşte solmuş, tebeşirleşmiş boya
    if (side > 0.5) {
      float t = fract(u / 0.28);
      float rib = smoothstep(0.06, 0.16, t) - smoothstep(0.56, 0.66, t);
      float edge = (1.0 - smoothstep(0.0, 0.07, abs(t - 0.11))) + (1.0 - smoothstep(0.0, 0.07, abs(t - 0.61)));
      c *= mix(1.0, mix(0.8, 1.06, rib) - 0.08 * edge, aaP);
      float rail = 1.0 - step(0.13, hc) * step(hc, 2.47);
      c = mix(c, base * 0.62, rail * 0.85);                                                      // alt / üst çerçeve kirişi
      float drip = svn(vec2(u * 4.2 + seed * 7.0, vWP.y * 0.3)) * (0.55 + 0.5 * smoothstep(1.3, 2.5, hc));
      float rust = max(smoothstep(0.7, 0.92, drip) * 0.8, smoothstep(0.76, 0.9, sfbm(wq * 2.3 + seed * 5.1)));
      rust = max(rust, rail * smoothstep(0.5, 0.8, svn(wq * 3.0 + seed)) * 0.8);
      c = mix(c, vec3(0.3, 0.15, 0.075) * (0.8 + 0.4 * svn(wq * 9.0)), rust * 0.55);
      c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.8, hg));
      gRough = mix(0.62, 0.9, rust);
    } else if (up > 0.5) {
      float t = fract(dot(p, vec2(0.7, 0.7)) / 0.5);
      c *= 0.88 + 0.12 * smoothstep(0.2, 0.5, t) * aaP;
      float rust = smoothstep(0.62, 0.85, sfbm(p * 1.3 + seed * 2.0));
      c = mix(c * 0.8, vec3(0.28, 0.14, 0.07), rust * 0.45);
      gRough = 0.88;
    } else c *= 0.55;
    gMetal = 0.12;
  } else if (kind == 4.0) {                                    // ── BOYALI ÇELİK (vinç, forklift): boya aşınması, pas ──
    c *= 0.9 + 0.14 * sfbm(wq * 1.1 + p * 0.4 + seed);
    float chip = smoothstep(0.7, 0.82, sfbm(wq * 3.5 + p * 2.0 + seed * 3.0));
    c = mix(c, vec3(0.2, 0.19, 0.18), chip * 0.7);
    float rs = smoothstep(0.74, 0.92, svn(vec2(u * 3.0, vWP.y * 0.25) + seed * 4.0)) * side;
    c = mix(c, vec3(0.3, 0.15, 0.07), rs * 0.3);
    if (side > 0.5) c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.6, hg));
    gRough = mix(0.5, 0.85, max(chip, rs)); gMetal = 0.25;
  } else if (kind == 5.0) {                                    // ── AHŞAP (palet, makara) ──
    float pv = side > 0.5 ? vWP.y : vWP.x;
    float pl = floor(pv / 0.14), edge = abs(fract(pv / 0.14) - 0.5);
    c *= 0.86 + 0.26 * sh21(vec2(pl, seed));
    c *= 0.92 + 0.14 * mix(0.5, svn(vec2((side > 0.5 ? u : vWP.z) * 2.2, pv * 38.0)), aaP);
    c *= 1.0 - 0.45 * smoothstep(0.42, 0.5, edge) * aaP;
    gRough = 0.95;
  } else if (kind == 6.0) {                                    // ── YOL BOYASI: aşınmış ──
    float wear = smoothstep(0.42, 0.82, sfbm(p * 1.3 + 5.0) + 0.2 * svn(p * 11.0));
    c = mix(c * 0.92, vec3(0.2, 0.2, 0.2), wear * 0.6);
    gRough = 0.7;
  } else if (kind == 7.0 || kind == 8.0) {                     // ── DEPO KAPLAMASI (dik oluk) / KEPENK (yatay çıta) ──
    if (side > 0.5) {
      float t = kind == 7.0 ? fract(u / 0.22) : fract(vWP.y / 0.11);
      c *= mix(1.0, 0.86 + 0.16 * smoothstep(0.1, 0.4, t) * (1.0 - smoothstep(0.6, 0.9, t)), aaP);
      c *= 0.92 + 0.12 * sfbm(wq * 0.3 + seed);
      float st = svn(vec2(u * 1.6 + seed, vWP.y * 0.1));
      c *= 1.0 - 0.22 * smoothstep(0.55, 0.85, st);
      c = mix(c, vec3(0.3, 0.15, 0.07), smoothstep(0.72, 0.86, sfbm(wq * 1.2 + 40.0)) * 0.45);
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 1.2, hg));
    } else if (up > 0.5) {                                      // trapez sac çatı: oluk + kir
      float t = fract(p.x / 0.5);
      c *= 0.78 * mix(1.0, 0.86 + 0.18 * smoothstep(0.15, 0.4, t) * (1.0 - smoothstep(0.6, 0.85, t)), aaP);
      c *= 0.85 + 0.25 * sfbm(p * 0.12 + seed);
    } else c *= 0.8;
    gRough = 0.7; gMetal = 0.15;
  } else if (kind == 9.0) {                                    // ── LASTİK / KAUÇUK ──
    c *= 0.85 + 0.2 * svn(wq * 6.0 + p * 6.0);
    gRough = 0.95;
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uNight > 0.001) {                                          // sahte lamba ışığı (gece): mesafe + yüzey yönü, gölgesiz
  vec3 nn = normalize(vWN), acc = vec3(0.0);
  for (int i = 0; i < ${MAXL}; i++) {
    vec3 d = uL[i].xyz - vWP; float r = length(d);
    float a = 1.0 - clamp(r / uL[i].w, 0.0, 1.0); a *= a * (1.6 - 0.6 * a);
    acc += uLC[i] * a * (0.2 + 0.8 * max(dot(nn, d / max(r, 1e-3)), 0.0));
  }
  totalEmissiveRadiance += diffuseColor.rgb * acc * uNight;
}`);
  };
  material.customProgramCacheKey = () => 'liman-surface-v1';
  return material;
}

// Su: koyu yeşil-mavi, hafif dalga (normal oynatma); gece lamba ışığı yok, ay ışığı yansır
export function makeWaterMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#1e4651', roughness: 0.34, metalness: 0.05 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = limanU.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP2;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP2;\nuniform float uTime;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 q = vWP2.xz; float t = uTime;
  vec2 g = vec2(cos(q.x * 0.45 + q.y * 0.2 + t * 0.9) + 0.5 * cos(q.x * 1.1 - q.y * 0.6 + t * 1.4), sin(q.y * 0.4 - q.x * 0.15 - t * 0.7) + 0.5 * sin(q.y * 1.2 + q.x * 0.5 + t * 1.1));
  float fade = 1.0 - smoothstep(30.0, 140.0, length(cameraPosition.xz - q));
  normal = normalize(normal + (viewMatrix * vec4(g.x * 0.035 * fade, 0.0, g.y * 0.035 * fade, 0.0)).xyz);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= 0.85 + 0.25 * (0.5 + 0.5 * sin(vWP2.x * 0.13 + vWP2.z * 0.07));`);
  };
  m.customProgramCacheKey = () => 'liman-water-v1';
  return m;
}
