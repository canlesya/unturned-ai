import * as THREE from 'three';

// Kasaba yüzeyi: Depo / Liman yöntemi — tüm düz parçalar tek köşe-renkli ağda, doku yerine dünya koordinatlı prosedürel gölgelendirici (UV yok, çizim çağrısı artmaz).
// aKind alt 4 bit = sınıf, üst 4 bit = parça tohumu (her ev / sandık kendi tonunda). Sınıf renkten (kasaba.js KIND tablosu) ya da opt.kind / withKind ile gelir.
// İnce çizgiler (derz, harç, kiremit) piksel altına inince söner (telefonda titreme yok); 2-3 oktav gürültü. Gece: lamba direkleri için sahte ışık (kameraya en yakın 12, gölgesiz).
export const KK = { PLAIN: 0, VEG: 1, DIRT: 2, ASPH: 3, PAVER: 4, PLASTER: 5, BRICK: 6, STONE: 7, ROOF: 8, WOOD: 9, BOARD: 10, CONC: 11, FLOOR: 12, INWALL: 13, PAINT: 14, CORR: 15 };
export const kasabaU = { night: { value: 0 } };
const MAXL = 12;

const NOISE = `
float kh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float kn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(kh(i), kh(i+vec2(1.,0.)), f.x), mix(kh(i+vec2(0.,1.)), kh(i+vec2(1.,1.)), f.x), f.y); }
float kf(vec2 p){ return kn(p) * 0.55 + kn(p * 2.07 + 3.1) * 0.3 + kn(p * 4.3 + 7.7) * 0.15; }
`;

// lamps: [[x, y, z], ...] (dünya) — gece kameraya en yakın MAXL tanesi her karede uL'ye yazılır (mesh.onBeforeRender)
export function makeKasabaMaterial(lamps = []) {
  const L = [], LC = [];
  for (let i = 0; i < MAXL; i++) { L.push(new THREE.Vector4(0, -999, 0, 0.001)); LC.push(new THREE.Color(0, 0, 0)); }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 });
  material.userData.glow = true;                                   // environment.applyGlow emissiveIntensity'yi günün saatine göre yazar → uNight
  material.userData.lamps = lamps;
  material.userData.uL = L; material.userData.uLC = LC;
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = kasabaU.night; sh.uniforms.uL = { value: L }; sh.uniforms.uLC = { value: LC };
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
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);     // bir pikselin dünya boyu
  float aaF = 1.0 - smoothstep(0.008, 0.024, pxw), aaM = 1.0 - smoothstep(0.02, 0.06, pxw), aaC = 1.0 - smoothstep(0.05, 0.14, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3), slope = (1.0 - up) * (1.0 - side) * step(0.0, n.y);
  vec2 wt = normalize(vec2(-n.z, n.x) + vec2(1e-5, 0.0));
  float u = dot(vWP.xz, wt);                                   // yüzeyde yatay koordinat (duvar / çatı eğimi boyunca)
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  float sat = (max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b))) / max(max(c.r, max(c.g, c.b)), 1e-3);
  if (kind == 1.0) {                                           // ── BİTKİ: çim (üst) / yaprak kümesi (yan, eğik) ──
    if (up > 0.5) {
      c *= 0.86 + 0.24 * kf(p * 0.07 + seed);
      c = mix(c, c * vec3(1.13, 1.06, 0.78), smoothstep(0.58, 0.82, kf(p * 0.045 + 3.0)) * 0.55);     // kuru (sarımsı) çim lekesi
      c = mix(c, c * vec3(0.82, 0.94, 0.86), smoothstep(0.6, 0.85, kn(p * 0.11 + 17.0)) * 0.4);      // gür (koyu) çim
      c *= 1.0 + (kn(p * 13.0) - 0.5) * 0.2 * aaF + (kn(p * 3.3) - 0.5) * 0.08 * aaC;        // ot dokusu
      gRough = 0.97;
    } else {
      float cl = kn(wq * 2.6 + p * 1.9 + seed * 3.0);
      c *= 0.78 + 0.36 * cl;
      c *= 1.0 + (kn(wq * 8.0 + p * 8.0) - 0.5) * 0.22 * aaM;                               // yaprak benekleri
      c *= 0.9 + 0.16 * clamp(n.y + 0.4, 0.0, 1.0);
      gRough = 0.95;
    }
  } else if (kind == 2.0) {                                    // ── TOPRAK: çakıl, iz ──
    c *= 0.84 + 0.26 * kf(p * 0.28 + seed);
    c *= 1.0 - 0.2 * smoothstep(0.68, 0.85, kn(p * 6.5)) * aaF;                                   // çakıl
    c *= 1.0 + (kn(p * 5.0) - 0.5) * 0.1 * aaC;
    c *= 1.0 - 0.1 * smoothstep(0.55, 0.8, kn(vec2(p.x * 0.3, p.y * 2.4) + 5.0)) * smoothstep(0.45, 0.65, kn(p * 0.04 + 1.0));   // tekerlek izi
    if (up < 0.5) c *= 0.85;
    gRough = 1.0;
  } else if (kind == 3.0) {                                    // ── ASFALT (yol / otopark / çatı membranı): agrega, yama, çatlak ──
    if (up > 0.5) {
      c *= 0.84 + 0.26 * kf(p * 0.12 + 3.0);
      c *= 1.0 + (kn(p * 26.0) - 0.5) * 0.26 * aaF + (kn(p * 6.0) - 0.5) * 0.08 * aaC;
      vec2 pg = p / vec2(3.7, 2.6); vec2 pf = abs(fract(pg) - 0.5);
      c = mix(c, c * 0.8, step(0.93, kh(floor(pg) + 9.0)) * (1.0 - smoothstep(0.38, 0.42, max(pf.x, pf.y))));   // yama
      float ck = 1.0 - smoothstep(0.0, 0.022, abs(kn(p * 0.55 + 4.0) - 0.5));
      c *= 1.0 - 0.3 * ck * smoothstep(0.62, 0.8, kn(p * 0.07 + 11.0)) * aaM;                       // çatlak
      c *= 1.0 - 0.15 * smoothstep(0.65, 0.88, kf(p * 0.22 + 40.0));                                // yağ lekesi
      gRough = 0.92;
    } else c *= 0.78;
  } else if (kind == 4.0) {                                    // ── KALDIRIM: 1 m beton plak, derz; bordür yüzü ──
    if (up > 0.5) {
      vec2 g = abs(fract(p) - 0.5);
      c *= 0.9 + 0.12 * kh(floor(p) + seed);
      c *= 1.0 - 0.24 * smoothstep(0.47, 0.49, max(g.x, g.y)) * aaM;                                // plak derzi
      c *= 0.95 + 0.08 * kf(p * 0.8);
    } else { c *= 0.84 + 0.1 * kn(wq * 3.0); }
    gRough = 0.9;
  } else if (kind == 5.0) {                                    // ── SIVA (dış cephe): serpme doku, taban nemi, akıntı ──
    c *= 0.95 + 0.1 * kh(vec2(seed, 1.0));
    if (side > 0.5) {
      c *= 0.94 + 0.08 * kf(wq * 0.9 + seed * 2.0);
      c *= 1.0 + (kn(wq * 16.0) - 0.5) * 0.07 * aaM;
      c *= 1.0 - 0.13 * (1.0 - smoothstep(0.0, 0.75, vWP.y));                                       // taban nemi / sıçrama kiri
      c *= 1.0 - 0.09 * smoothstep(0.62, 0.9, kn(vec2(u * 1.4, vWP.y * 0.18) + seed * 5.0)) * smoothstep(0.6, 3.0, vWP.y);   // yağmur akıntısı
    } else c *= 0.9;
  } else if (kind == 6.0) {                                    // ── TUĞLA: yarım kaydırmalı örgü, açık harç ──
    if (side > 0.5) {
      vec2 bp = vec2(u / 0.25, vWP.y / 0.08); bp.x += 0.5 * mod(floor(bp.y), 2.0);
      vec2 bf = fract(bp), bi = floor(bp);
      float ln = min(min(bf.x, 1.0 - bf.x) * 0.25, min(bf.y, 1.0 - bf.y) * 0.08);
      vec3 brick = c * (0.82 + 0.3 * kh(bi + seed)) * (0.95 + 0.08 * kn(wq * 9.0));
      float mo = (1.0 - smoothstep(0.005, 0.012, ln)) * aaF;
      c = mix(mix(c * 0.96, brick, aaF), vec3(0.74, 0.71, 0.66), mo * 0.8);
      c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.6, vWP.y));
    } else c *= 0.9;
  } else if (kind == 7.0) {                                    // ── TAŞ (köy duvarı, kaide, mezar): düzensiz sıralar, harç ──
    if (side > 0.5) {
      float row = floor(vWP.y / 0.27);
      vec2 bp = vec2(u / (0.42 + 0.2 * kh(vec2(row, 3.0))) + kh(vec2(row, 7.0)), vWP.y / 0.27);
      vec2 bf = fract(bp), bi = floor(bp);
      float ln = min(min(bf.x, 1.0 - bf.x) * 0.45, min(bf.y, 1.0 - bf.y) * 0.27);
      float tn = kh(bi + seed * 3.0);
      vec3 st = c * (0.78 + 0.36 * tn) * mix(vec3(1.0), vec3(1.06, 1.0, 0.9), step(0.6, kh(bi + 5.0)));
      st *= 0.92 + 0.12 * kn(wq * 6.0 + bi);
      float mo = (1.0 - smoothstep(0.01, 0.025, ln)) * aaM;
      c = mix(mix(c * 0.95, st, aaM), c * 0.6, mo * 0.75);
      c *= 1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.5, vWP.y));
      c = mix(c, c * vec3(0.78, 0.9, 0.7), smoothstep(0.7, 0.9, kf(wq * 0.8 + 9.0)) * 0.35);       // yosun
    } else c *= 0.88 + 0.14 * kf(p * 2.0 + vWP.y);
    gRough = 0.95;
  } else if (kind == 8.0) {                                    // ── ÇATI: eğik yüz kiremit (renkli) / oluklu sac (gri); dik yüz sıva; üst yüz çakıl ──
    if (slope > 0.5) {
      if (sat > 0.17) {
        float ry = vWP.y / 0.13, rw = floor(ry);
        float cx = u / 0.24 + 0.5 * mod(rw, 2.0);
        c *= 0.8 + 0.28 * kh(vec2(floor(cx), rw) + seed);
        c *= mix(1.0, 0.72 + 0.34 * fract(ry), aaM);                                                // sıra bindirme gölgesi
        c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06, abs(fract(cx) - 0.5) * 2.0 - 0.9)) * aaF;   // kiremit arası
        c = mix(c, c * vec3(0.7, 0.86, 0.6), smoothstep(0.66, 0.88, kf(p * 0.35 + seed)) * 0.3);   // yosun
      } else {
        float rib = abs(fract(u / 0.3) - 0.5) * 2.0;
        c *= mix(1.0, 0.84 + 0.22 * smoothstep(0.2, 0.8, rib), aaM);
        c *= 0.92 + 0.12 * kf(wq * 0.4 + p * 0.2 + seed);
        c = mix(c, vec3(0.36, 0.22, 0.14), smoothstep(0.72, 0.9, kn(vec2(u * 2.0, vWP.y * 0.6) + seed)) * 0.35);   // pas akıntısı
        gMetal = 0.25; gRough = 0.6;
      }
    } else if (up > 0.5) { c *= 0.9 + 0.1 * kn(p * 3.0); c *= 1.0 + (kn(p * 16.0) - 0.5) * 0.16 * aaF; }
    else { c *= 0.92 + 0.1 * kf(wq * 0.8 + seed); }
  } else if (kind == 9.0) {                                    // ── AHŞAP: tahta (yan: yatay, üst: z boyunca), damar, aralık ──
    float pv = side > 0.5 ? vWP.y : (abs(n.x) > 0.5 ? vWP.z : vWP.x);
    float pl = floor(pv / 0.15), edge = abs(fract(pv / 0.15) - 0.5);
    c *= 0.84 + 0.28 * kh(vec2(pl, seed));
    c *= 0.92 + 0.14 * mix(0.5, kn(vec2((side > 0.5 ? u : (abs(n.x) > 0.5 ? vWP.x : vWP.z)) * 2.0, pv * 34.0)), aaM);
    c *= 1.0 - 0.38 * smoothstep(0.42, 0.5, edge) * aaM;
    gRough = 0.95;
  } else if (kind == 10.0) {                                   // ── DİKEY TAHTA (ambar, kulübe, ağaç kabuğu) ──
    if (side > 0.5 || slope > 0.5) {
      float bw = 0.21, bi = floor(u / bw), e = abs(fract(u / bw) - 0.5);
      c *= 0.84 + 0.26 * kh(vec2(bi, seed));
      c *= 0.92 + 0.14 * mix(0.5, kn(vec2(u * 30.0, vWP.y * 1.6)), aaM);
      c *= 1.0 - 0.4 * smoothstep(0.43, 0.5, e) * aaM;
      c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.6, vWP.y));
    } else c *= 0.88;
    gRough = 0.96;
  } else if (kind == 11.0) {                                   // ── BETON (bariyer, havuz, kaide): döküm lekesi, gözenek, taban kiri ──
    c *= 0.9 + 0.14 * kf(wq * 0.7 + p * 0.7 + seed) + (kn(wq * 11.0 + p * 11.0) - 0.5) * 0.06 * aaM;
    if (side > 0.5) c *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.45, vWP.y));
    gRough = 0.9;
  } else if (kind == 12.0) {                                   // ── İÇ ZEMİN: gri/açık → karo, kahverengi → parke ──
    if (up > 0.5) {
      if (sat < 0.14) {
        vec2 g = abs(fract(p / 0.5) - 0.5);
        c *= 0.94 + 0.08 * kh(floor(p / 0.5) + seed);
        c = mix(c, c * 0.72, smoothstep(0.465, 0.49, max(g.x, g.y)) * aaF);
        gRough = 0.5;
      } else {
        float pw = 0.13, pr = floor(p.y / pw), pz = fract(p.y / pw);
        float pc = floor(p.x / 1.3 + kh(vec2(pr, 2.0)));
        c *= 0.85 + 0.26 * kh(vec2(pr, pc) + seed);
        c *= 0.94 + 0.1 * mix(0.5, kn(vec2(p.x * 3.0, p.y * 40.0)), aaM);
        c *= 1.0 - 0.3 * smoothstep(0.44, 0.5, abs(pz - 0.5)) * aaF;
        float bj = fract(p.x / 1.3 + kh(vec2(pr, 2.0))); c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.012, min(bj, 1.0 - bj))) * aaF;   // parke uç derzi
        gRough = 0.7;
      }
    }
  } else if (kind == 13.0) {                                   // ── İÇ DUVAR: düz boya, süpürgelik ──
    c *= 0.97 + 0.05 * kf(wq * 0.6 + seed);
    if (side > 0.5) { float fy = mod(vWP.y - 0.15 + 0.001, 3.0); c *= 1.0 - 0.3 * (1.0 - step(0.1, fy)); c *= 1.0 - 0.06 * (1.0 - smoothstep(0.1, 0.9, fy)); }
  } else if (kind == 14.0) {                                   // ── YOL BOYASI: aşınmış ──
    float wear = smoothstep(0.5, 0.85, kf(p * 1.4 + 5.0) + 0.25 * kn(p * 11.0));
    c = mix(c, vec3(0.2, 0.21, 0.22), wear * 0.55);
    gRough = 0.75;
  } else if (kind == 15.0) {                                   // ── OLUKLU SAC (konteyner, depo kaplaması, silo): oluk, solma, pas ──
    c *= 0.9 + 0.16 * kh(vec2(seed, 3.0));
    if (side > 0.5) {
      float rib = abs(fract(u / 0.27) - 0.5) * 2.0;
      c *= mix(1.0, 0.8 + 0.26 * smoothstep(0.2, 0.8, rib), aaM);
      c *= 0.93 + 0.1 * kf(wq * 0.45 + seed * 3.0);
      c = mix(c, vec3(0.4, 0.22, 0.12), smoothstep(0.66, 0.86, kf(vec2(u * 2.2, vWP.y * 0.32) + seed * 5.0)) * 0.42);
      c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.5, vWP.y));
    } else c *= 0.9 + 0.08 * kn(p * 2.0);
    gRough = 0.68; gMetal = 0.18;
  } else {                                                     // ── DÜZ (araç, süs, metal): çok hafif ton farkı ──
    c *= 0.97 + 0.05 * kn(wq * 0.8 + p * 0.8 + seed * 3.0);
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
    acc += uLC[i] * a * (0.25 + 0.75 * max(dot(nn, d / max(r, 1e-3)), 0.0));
  }
  totalEmissiveRadiance += diffuseColor.rgb * acc * uNight;
}`);
  };
  material.customProgramCacheKey = () => 'kasaba-surface-v2';
  return material;
}

// Birleşik ağa bağla: her karede (gölge geçişinden sonra ana kamera en son yazar) kameraya en yakın lambaları uL'ye yazar; uNight = gece parlaması.
export function attachKasabaLights(mesh) {
  const m = mesh.material, lamps = m.userData.lamps || [], L = m.userData.uL, LC = m.userData.uLC;
  const warm = new THREE.Color('#ffcf8a'), idx = lamps.map((_, i) => i), d2 = new Float32Array(lamps.length), cols = lamps.map((l) => (l[4] ? new THREE.Color(l[4]) : warm).clone().multiplyScalar(l[5] ?? 2.4));
  mesh.onBeforeRender = (r, s, cam) => {
    kasabaU.night.value = Math.min(1, (m.emissiveIntensity || 0) / 1.5);
    if (kasabaU.night.value < 0.001 || !lamps.length) return;
    const cx = cam.position.x, cz = cam.position.z;
    for (let i = 0; i < lamps.length; i++) { const l = lamps[i]; d2[i] = (l[0] - cx) ** 2 + (l[2] - cz) ** 2; }
    idx.sort((a, b) => d2[a] - d2[b]);
    for (let k = 0; k < L.length; k++) {
      const l = lamps[idx[k]];
      if (!l) { L[k].set(0, -999, 0, 0.001); LC[k].setRGB(0, 0, 0); continue; }
      L[k].set(l[0], l[1], l[2], l[3] || 11); LC[k].copy(cols[idx[k]]);
    }
  };
}
