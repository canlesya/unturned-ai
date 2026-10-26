import * as THREE from 'three';

// Çöl kasabası yüzeyi (12.171, Çöl Geçidi v2; başka çöl haritaları da kullanabilir). Depo / Maden yöntemi: tüm düz parçalar TEK köşe-renkli ağ,
// doku dosyası / UV yok — dünya koordinatlı prosedürel gölgelendirici. aKind alt 4 bit = sınıf (CK), üst 4 bit = parça tohumu (her parça kendi tonu).
// aGnd = köşenin altındaki zemin kotu (duvar dibi kiri / kaide bandı). İsteğe bağlı AO dokusu (uAO, 0,5 m hücre): duvar dibi gölgesi, çatı altı loşluğu,
// rüzgârın duvar dibine yığdığı kum. İnce çizgiler pikselden incelince söner (fwidth): uzakta moire / titreme yok.
export const CK = { PLAIN: 0, PLASTER: 1, BRICK: 2, STONE: 3, WOOD: 4, PAINT: 5, CLOTH: 6, SAND: 7, SLAB: 8, COBBLE: 9, ROOF: 10, METAL: 11, LEAF: 12, DIRT: 13, GLASS: 14, COPING: 15 };

const NOISE = `
float ch(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(ch(i), ch(i+vec2(1.,0.)), f.x), mix(ch(i+vec2(0.,1.)), ch(i+vec2(1.,1.)), f.x), f.y); }
float cf(vec2 p){ return cn(p) * 0.55 + cn(p * 2.03 + 3.1) * 0.3 + cn(p * 4.1 + 7.7) * 0.15; }
vec2 ch2(vec2 p){ float n = ch(p); return vec2(n, ch(p + n * 17.0)); }
float cvor(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 r = g + ch2(i + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return sqrt(d2) - sqrt(d1); }
`;

// opts.ao = { tex: DataTexture (R: duvar dibi AO 0..1, G: çatı altı, B: kum birikintisi), x0, z0, w, d } (dünya dikdörtgeni)
export function makeCgMaterial(opts = {}) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
  const ao = opts.ao;
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uAO = { value: ao ? ao.tex : null };
    sh.uniforms.uAOR = { value: ao ? new THREE.Vector4(ao.x0, ao.z0, 1 / ao.w, 1 / ao.d) : new THREE.Vector4(0, 0, 0, 0) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nattribute float aGnd;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vKind;\nvarying float vGnd;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvKind = aKind;\nvGnd = aGnd;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
varying float vKind;
varying float vGnd;
uniform sampler2D uAO;
uniform vec4 uAOR;
float gRough = -1.0;
float gMetal = -1.0;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float dist = length(cameraPosition - vWP);
  float near = 1.0 - smoothstep(16.0, 50.0, dist);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);
  float aaF = 1.0 - smoothstep(0.012, 0.035, pxw), aaM = 1.0 - smoothstep(0.025, 0.07, pxw), aaL = 1.0 - smoothstep(0.05, 0.14, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  float hg = vWP.y - vGnd;
  vec3 c = diffuseColor.rgb;
  vec3 A = vec3(0.0);
  if (uAOR.z > 0.0) A = texture2D(uAO, vec2((p.x - uAOR.x) * uAOR.z, (p.y - uAOR.y) * uAOR.w)).rgb;
  if (kind == 1.0) {                                           // ── SIVA (kerpiç / kireç): büyük ton lekesi, nem akıntısı, kaide, dökük sıva altından tuğla, badana, is, çatlak ──
    float big = cf(wq * 0.19 + seed * 3.7 + p * 0.03 * up);
    c *= 0.9 + 0.2 * big;
    c *= 0.97 + 0.06 * cf(wq * 0.9 + 9.1);
    c *= mix(vec3(1.035, 0.995, 0.93), vec3(0.965, 0.99, 1.035), cn(p * 0.07 + 5.3));
    if (side > 0.5) {
      float st = cf(vec2(u * 1.25, vWP.y * 0.1) + 21.0 + seed);
      c *= 1.0 - 0.14 * smoothstep(0.52, 0.86, st) * (0.5 + 0.5 * smoothstep(0.0, 4.0, hg));
      float gr = 1.0 - smoothstep(0.0, 1.3, hg);
      c *= 1.0 - 0.24 * gr * (0.55 + 0.45 * cf(wq * 1.7));
      c = mix(c, c * vec3(0.93, 0.9, 0.84), smoothstep(1.15, 1.5, hg) * (1.0 - smoothstep(1.5, 1.9, hg)) * 0.5);
      float bq = cn(wq * 0.42 + 11.0 + seed) * 0.72 + cn(wq * 1.1 + 4.0) * 0.28;
      float bm = smoothstep(0.7, 0.73, bq) * (1.0 - smoothstep(1.4, 3.2, hg + 0.5 * (cf(vec2(u, 0.0) * 2.0) - 0.5) * 3.0));
      if (bm > 0.01) {
        vec2 bp = vec2(u / 0.6, vWP.y / 0.3); float row = floor(bp.y); bp.x += 0.5 * mod(row, 2.0);
        vec2 bf = fract(bp), bi = floor(bp);
        float ln = min(min(bf.x, 1.0 - bf.x) * 0.6, min(bf.y, 1.0 - bf.y) * 0.3);
        float mort = 1.0 - smoothstep(0.014, 0.04, ln);
        vec3 brick = vec3(0.42, 0.2, 0.1) * (0.8 + 0.4 * ch(bi + 3.0)) * (0.88 + 0.24 * cn(bp * 3.0));
        brick = mix(brick, vec3(0.5, 0.4, 0.27), mort * mix(0.3, 0.8, near) * (0.35 + 0.65 * aaM) + (1.0 - aaM) * 0.22);
        float bk = smoothstep(0.35, 0.55, bm);
        c *= 1.0 - 0.28 * smoothstep(0.02, 0.16, bm) * (1.0 - bk);
        c = mix(c, brick, bk);
      }
      float pl = 1.0 - smoothstep(0.62, 0.66, hg);                                                // kaide bandı (taban 0,65 m koyu kireç)
      c = mix(c, c * vec3(0.88, 0.83, 0.77), pl * 0.75);
      float lq = cn(wq * 0.5 + 33.0 + seed) * 0.7 + cn(wq * 1.3 + 8.0) * 0.3;
      c = mix(c, c * vec3(1.09, 1.08, 1.03) + 0.02, smoothstep(0.66, 0.69, lq) * 0.8 * (1.0 - smoothstep(2.0, 4.5, hg)));
      float sq = cn(vec2(u * 1.1, vWP.y * 0.28) + 77.0) * 0.8 + cn(wq * 1.4 + 51.0) * 0.2;
      c *= 1.0 - 0.22 * smoothstep(0.66, 0.76, sq) * (0.4 + 0.6 * smoothstep(0.5, 3.0, hg));
      float cm = smoothstep(0.66, 0.78, cf(wq * 0.28 + 5.0 + seed)) * near;
      if (cm > 0.01) { float ck = cvor(wq * 1.7 + 40.0); c *= 1.0 - 0.18 * (1.0 - smoothstep(0.008, 0.026, ck)) * cm * aaF; }
      c *= 1.0 - 0.3 * A.r * (1.0 - smoothstep(0.0, 1.6, hg));                                    // duvar dibi (zemin AO ile aynı)
    } else if (up > 0.5) {
      c *= 0.93 + 0.12 * cf(p * 0.55 + 2.0);
      c = mix(c, c * vec3(0.66, 0.62, 0.58), smoothstep(0.64, 0.7, cf(p * 0.3 + 14.0)) * 0.7);
    } else c *= 0.88;
  } else if (kind == 2.0) {                                    // ── TUĞLA (kemer, söve, baca): derzli sıra, tuğla başına ton ──
    vec2 bp = side > 0.5 ? vec2(u / 0.42, vWP.y / 0.11) : vec2(p.x / 0.42, p.y / 0.21);
    bp.x += 0.5 * mod(floor(bp.y), 2.0);
    vec2 bf = fract(bp), bi = floor(bp);
    float ln = min(min(bf.x, 1.0 - bf.x) * 0.42, min(bf.y, 1.0 - bf.y) * 0.11);
    c *= 0.82 + 0.3 * ch(bi + seed);
    c = mix(c, vec3(0.62, 0.55, 0.45), (1.0 - smoothstep(0.008, 0.02, ln)) * 0.7 * aaM);
    c *= 0.94 + 0.1 * cf(wq * 0.6);
  } else if (kind == 3.0) {                                    // ── KESME TAŞ (istinat duvarı, söve, dikme): sıra yüksekliği değişen bloklar, ince derz, kireç / toz örtüsü ──
    if (side > 0.5) {
      float rw = 0.5 + 0.14 * ch(vec2(floor(vWP.y / 0.5), 3.0));
      vec2 sp = vec2(u / 1.15, vWP.y / 0.5); sp.x += 0.41 * mod(floor(sp.y), 3.0) + 0.23 * ch(vec2(floor(sp.y), 7.0));
      vec2 sf = fract(sp), si = floor(sp);
      float ln = min(min(sf.x, 1.0 - sf.x) * 1.15, min(sf.y, 1.0 - sf.y) * 0.5);
      c *= 0.9 + 0.14 * ch(si + seed) + 0.05 * (cf(wq * 1.6) - 0.5);
      c *= 1.0 - 0.17 * (1.0 - smoothstep(0.01, 0.028, ln)) * aaM;
      c *= 0.94 + 0.06 * smoothstep(0.0, 0.12, ln);                                           // blok kenarı hafif aşınmış
      c = mix(c, c * vec3(1.07, 1.05, 0.98) + 0.02, smoothstep(0.55, 0.8, cf(wq * 0.22 + 9.0)) * 0.55);   // kireç / toz örtüsü (derzleri yumuşatır)
      c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.9, hg));
      c *= 1.0 - 0.28 * A.r * (1.0 - smoothstep(0.0, 1.4, hg));
      c = mix(c, c * vec3(0.86, 0.82, 0.76), smoothstep(0.68, 0.86, cf(vec2(u * 0.9, vWP.y * 0.18) + 41.0)) * 0.35);   // nem / su izi
    } else c *= 0.95 + 0.08 * cf(p * 1.6);
  } else if (kind == 4.0) {                                    // ── AHŞAP: tahta + damar + çivi izi ──
    float pv = side > 0.5 ? vWP.y : (abs(n.x) > 0.5 ? vWP.z : vWP.x);
    float pa = side > 0.5 ? u : (abs(n.x) > 0.5 ? vWP.x : vWP.z);
    float pl = floor(pv / 0.16), e = abs(fract(pv / 0.16) - 0.5);
    c *= 0.84 + 0.26 * ch(vec2(pl, seed));
    c *= 0.92 + 0.14 * mix(0.5, cn(vec2(pa * 2.2, pv * 34.0)), aaF);
    c *= 1.0 - 0.3 * smoothstep(0.43, 0.5, e) * aaM;
    c = mix(c, c * vec3(0.8, 0.82, 0.86), smoothstep(0.55, 0.9, cf(vec2(pa, pv) * 0.7 + seed)) * 0.4);   // güneşte ağarmış
  } else if (kind == 5.0) {                                    // ── BOYALI (kapı, kepenk, tabela): solmuş boya, kalkan boya altından ahşap, pas ──
    float pn = cf(wq * 1.3 + p * 0.2 + seed);
    c *= 0.92 + 0.14 * pn;
    float flake = smoothstep(0.7, 0.74, cf(wq * 3.0 + 31.0 + seed)) * near;
    c = mix(c, vec3(0.42, 0.33, 0.24), flake * 0.8);
    c = mix(c, vec3(0.32, 0.15, 0.07), smoothstep(0.62, 0.8, cf(wq * 0.9 + 61.0)) * (side > 0.5 ? 0.35 * (1.0 - smoothstep(0.0, 1.2, hg)) : 0.3));
    c = mix(c, c * 1.12 + 0.03, smoothstep(0.5, 1.0, cn(wq * 0.25)) * 0.25);
  } else if (kind == 6.0) {                                    // ── KUMAŞ (tente, perde): dokuma, solma, kat izi ──
    float a = side > 0.5 ? u : (abs(n.x) > abs(n.z) ? vWP.z : vWP.x);
    c *= 0.9 + 0.12 * cf(vec2(a, vWP.y) * 1.5 + seed);
    c *= 1.0 - 0.06 * (step(0.5, fract(a * 22.0)) - 0.5) * aaF;
    c = mix(c, c * 1.15 + 0.04, smoothstep(0.4, 1.0, cn(vec2(a * 0.6, vWP.y * 0.6))) * 0.3);
    gRough = 0.96;
  } else if (kind == 7.0) {                                    // ── KUM ZEMİN: geniş leke, rüzgâr dalgası, tanecik, çakıl, duvar dibi kum birikintisi ──
    c *= 0.93 + 0.14 * cf(p * 0.16 + 4.0);
    c *= mix(vec3(1.03, 1.0, 0.94), vec3(0.97, 0.99, 1.03), cn(p * 0.05 + 8.0));
    float rip = sin(dot(p, vec2(0.92, 0.38)) * 3.1 + cf(p * 0.35) * 7.0);
    c *= 1.0 + 0.024 * rip * (0.4 + 0.6 * near);
    c *= 1.0 + (ch(floor(p * 14.0)) - 0.5) * 0.07 * near * aaL;
    float peb = step(0.982, ch(floor(p * 5.0) + 17.0));
    c = mix(c, c * 0.68, peb * 0.6 * near * aaL);
    c = mix(c, c * vec3(1.05, 1.02, 0.95), A.b * 0.6);                                           // savrulmuş açık kum
  } else if (kind == 8.0) {                                    // ── TAŞ LEVHA (saha / avlu): derz + levha tonu + aşınma + üstünde kum ──
    float sz = 1.0 + 0.5 * step(0.5, ch(floor(p / 6.0) + 2.0));
    vec2 q = p / vec2(sz, sz * 0.75); q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 f = fract(q), id = floor(q);
    float ln = min(min(f.x, 1.0 - f.x) * sz, min(f.y, 1.0 - f.y) * sz * 0.75);
    c *= (0.88 + 0.22 * ch(id + 5.0)) * (0.95 + 0.1 * cf(p * 2.0));
    c *= 1.0 - 0.26 * (1.0 - smoothstep(0.015, 0.045, ln)) * mix(0.5, 1.0, near) * mix(0.3, 1.0, aaM);
    c = mix(c, vec3(0.83, 0.74, 0.57), smoothstep(0.6, 0.8, cf(p * 0.45 + 9.0)) * 0.45 + A.b * 0.4);
  } else if (kind == 9.0) {                                    // ── KALDIRIM TAŞI (Long): düzensiz hücre ──
    vec2 q = p / 0.62;
    float ed = cvor(q);
    float tone = 0.8 + 0.34 * ch(floor(q) + 11.0);
    vec3 stone = c * tone * (0.95 + 0.1 * cf(p * 3.0));
    stone *= 0.86 + 0.14 * smoothstep(0.0, 0.5, ed * 3.0);
    stone *= 1.0 - 0.42 * (1.0 - smoothstep(0.05, 0.16, ed)) * mix(0.55, 1.0, near) * mix(0.35, 1.0, aaM);
    c = mix(stone, vec3(0.8, 0.71, 0.55), A.b * 0.5 + smoothstep(0.62, 0.85, cf(p * 0.3 + 2.0)) * 0.3);
  } else if (kind == 10.0) {                                   // ── ÇATI (sıkıştırılmış toprak / mala sıva): onarım yaması, su izi ──
    c *= 0.92 + 0.13 * cf(p * 0.4 + seed);
    c = mix(c, c * vec3(0.7, 0.66, 0.6), smoothstep(0.64, 0.7, cf(p * 0.25 + 14.0)) * 0.6);
    c *= 0.985 + 0.03 * ch(floor(p * 7.0)) * aaL;
  } else if (kind == 11.0) {                                   // ── OLUKLU SAC (konteyner, çatı sacı): oluk, pas, boya ──
    float a = side > 0.5 ? u : vWP.x;
    float rib = abs(fract(a / 0.18) - 0.5) * 2.0;
    c *= mix(1.0, 0.82 + 0.26 * smoothstep(0.2, 0.8, rib), aaM);
    c = mix(c, vec3(0.38, 0.18, 0.08), smoothstep(0.6, 0.82, cf(vec2(a * 0.6, (side > 0.5 ? vWP.y : vWP.z) * 0.6) + seed * 3.0)) * 0.6);
    gMetal = 0.25; gRough = 0.6;
  } else if (kind == 12.0) {                                   // ── HURMA YAPRAĞI: damar + uç kuruması ──
    c *= 0.86 + 0.2 * cn(wq * 4.0 + p * 4.0 + seed);
    c = mix(c, vec3(0.55, 0.47, 0.25), smoothstep(0.6, 0.9, cf(p * 1.3 + seed)) * 0.45);
  } else if (kind == 13.0) {                                   // ── SIKIŞMIŞ TOPRAK (tünel / kapalı geçit tabanı) ──
    c *= 0.88 + 0.18 * cf(p * 0.3 + 6.0) + 0.06 * (cn(p * 3.0) - 0.5);
    c *= 1.0 - 0.12 * smoothstep(0.6, 0.85, cf(p * 0.9 + 21.0));
  } else if (kind == 14.0) {                                   // ── CAM (koyu pencere): gökyüzü yansıması çizgisi ──
    c *= 0.8 + 0.3 * smoothstep(0.3, 0.9, fract((vWP.y + u * 0.4) * 0.7));
    gRough = 0.25; gMetal = 0.1;
  } else if (kind == 15.0) {                                   // ── KENAR TAŞI / BAŞLIK (istinat tepesi, basamak, eşik): uzun bloklar ──
    float a = abs(n.x) > abs(n.z) ? vWP.z : vWP.x;
    if (side > 0.5) a = u;
    float bl = abs(fract(a / 0.9 + 0.25 * ch(vec2(floor(a / 0.9), seed))) - 0.5);
    c *= 0.88 + 0.2 * ch(vec2(floor(a / 0.9), seed + 3.0));
    c *= 1.0 - 0.28 * smoothstep(0.47, 0.5, bl) * aaM;
    c *= 0.95 + 0.08 * cf(p * 2.0 + wq);
  }
  if (kind >= 7.0 && kind <= 9.0 || kind == 13.0) c *= 1.0 - 0.36 * A.r - 0.3 * A.g;            // zemin: duvar dibi + çatı altı gölgesi
  else if (kind == 15.0 && up > 0.5) c *= 1.0 - 0.25 * A.g;
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;');
  };
  material.customProgramCacheKey = () => 'cg-surface-v1' + (ao ? '-ao' : '');
  return material;
}
