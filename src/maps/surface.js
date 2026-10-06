import * as THREE from 'three';

// Çöl Geçidi yüzey detayı: harita tek bir köşe-renkli ağda birleşik olduğu için dokular dünya koordinatlı prosedürel gölgelendirici ile eklenir
// (UV yok, çizim çağrısı artmaz). Her köşe iki ek öznitelik taşır: aKind (malzeme sınıfı) ve aGnd (köşenin altındaki zemin kotu → duvar tabanı kirlenmesi).
// Sınıflar renkten çıkarılır (kindOfColor): sıva / ahşap / boyalı-metal / taş. Yalnız bu malzeme Çöl Geçidi'nde kullanılır; diğer haritalar eskisi gibi.
export const KIND = { PLASTER: 1, WOOD: 2, PAINT: 3, STONE: 4 };
const _c = new THREE.Color(), _h = { h: 0, s: 0, l: 0 };

export function kindOfColor(hex) {
  _c.set(hex).getHSL(_h, THREE.SRGBColorSpace);               // sRGB uzayında (varsayılan doğrusal uzay: açık sıva 'koyu' çıkıp ahşap sayılıyordu)
  const { h, s, l } = _h;
  if (h > 0.06 && h < 0.16 && s > 0.2) return l < 0.43 ? KIND.WOOD : KIND.PLASTER;          // sıcak tonlar: koyu = ahşap / kiriş, açık = sıva
  if (s < 0.16) return KIND.STONE;                                                           // nötr gri / beyaz: taş, beton, metal
  return KIND.PAINT;                                                                         // mavi / kırmızı / yeşil: boyalı yüzey
}

const GLSL_NOISE = `
float sh21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 sh22(vec2 p){ float n = sh21(p); return vec2(n, sh21(p + n * 17.0)); }
float svn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(sh21(i), sh21(i+vec2(1.,0.)), f.x), mix(sh21(i+vec2(0.,1.)), sh21(i+vec2(1.,1.)), f.x), f.y); }
float sfbm(vec2 p){ return svn(p) * 0.55 + svn(p * 2.03 + 3.1) * 0.30 + svn(p * 4.1 + 7.7) * 0.15; }
float scrack(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 r = g + sh22(i + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return sqrt(d2) - sqrt(d1); }
`;

// Bina / sahne malzemesi (köşe rengi + aKind + aGnd)
export function makeDesertMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 });
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nattribute float aGnd;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vKind;\nvarying float vGnd;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvKind = aKind;\nvGnd = aGnd;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
varying float vKind;
varying float vGnd;
${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float dist = length(cameraPosition - vWP);
  float near = 1.0 - smoothstep(14.0, 46.0, dist);            // ince çizgiler uzakta kaybolur (titreme olmasın)
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);   // bir pikselin dünya boyu (m): çizgi pikselden inceyse soldur (moire / titreme yok)
  float aaB = 1.0 - smoothstep(0.014, 0.04, pxw), aaP = 1.0 - smoothstep(0.02, 0.06, pxw);
  float kind = floor(vKind + 0.5);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);                                   // duvar düzleminde yatay koordinat
  float hg = vWP.y - vGnd;                                     // zeminden yükseklik
  vec3 c = diffuseColor.rgb;
  float lum = dot(c, vec3(0.333));
  if (kind == 1.0) {                                           // ── SIVA ──
    float big = sfbm(vec2(u, vWP.y) * 0.21 + 3.7 * side + vWP.xz * 0.05 * up);
    float mid = sfbm(vec2(u, vWP.y) * 0.9 + 9.1);
    c *= 0.9 + 0.2 * big;                                       // büyük lekeler: her duvar kendi tonunda
    c *= 0.97 + 0.06 * mid;
    c *= mix(vec3(1.035, 0.995, 0.93), vec3(0.965, 0.99, 1.035), svn(vWP.xz * 0.07 + 5.3));      // ılık / soğuk ton kayması
    if (side > 0.5) {
      float st = sfbm(vec2(u * 1.25, vWP.y * 0.1) + 21.0);                                        // yağmur / nem akıntıları
      c *= 1.0 - 0.15 * smoothstep(0.52, 0.86, st) * (0.5 + 0.5 * smoothstep(0.0, 4.0, hg));
      float gr = 1.0 - smoothstep(0.0, 1.35, hg);                                                 // taban kirlenmesi (kum + nem)
      c *= 1.0 - 0.26 * gr * (0.55 + 0.45 * sfbm(vec2(u, vWP.y) * 1.7));
      c = mix(c, c * vec3(0.93, 0.9, 0.84), smoothstep(1.15, 1.5, hg) * (1.0 - smoothstep(1.5, 1.9, hg)) * 0.55);   // tuz / nem çizgisi
      float bq = svn(vec2(u, vWP.y) * 0.42 + 11.0) * 0.72 + svn(vec2(u, vWP.y) * 1.1 + 4.0) * 0.28;       // yalnız düşük frekanslar: büyük, tek parça yamalar (ufak çil yok)
      float bm = smoothstep(0.69, 0.72, bq) * (1.0 - smoothstep(1.5, 3.4, hg + 0.5 * (sfbm(vec2(u, 0.0) * 2.0) - 0.5) * 3.0));   // dökülmüş sıva: altından tuğla (keskin kenarlı yama)
      if (bm > 0.01) {
        vec2 bp = vec2(u / 0.6, vWP.y / 0.3); float row = floor(bp.y); bp.x += 0.5 * mod(row, 2.0);
        vec2 bf = fract(bp), bi = floor(bp);
        float ln = min(min(bf.x, 1.0 - bf.x) * 0.6, min(bf.y, 1.0 - bf.y) * 0.3);
        float mort = 1.0 - smoothstep(0.014, 0.04, ln);
        vec3 brick = vec3(0.36, 0.13, 0.06) * (0.8 + 0.4 * sh21(bi + 3.0)) * (0.88 + 0.24 * svn(bp * 3.0));
        brick = mix(brick, vec3(0.46, 0.34, 0.2), mort * mix(0.3, 0.8, near) * (0.35 + 0.65 * aaB) + (1.0 - aaB) * 0.22);            // uzakta derz ortalama rengine karışır
        float bk = smoothstep(0.35, 0.55, bm);
        c *= 1.0 - 0.3 * smoothstep(0.02, 0.16, bm) * (1.0 - bk);                           // yama kenarı: sıva kalınlığı gölgesi
        c = mix(c, brick, bk);
        c *= 1.0 - 0.22 * bk * (1.0 - smoothstep(0.0, 0.5, ln * 7.0)) * aaB;
      }
      float pl = 1.0 - smoothstep(0.86, 0.9, hg);                                                    // kaide bandı: tabanda 0,9 m taş sıva
      c = mix(c, c * vec3(0.9, 0.84, 0.78), pl * 0.8);
      c *= 1.0 + 0.05 * smoothstep(0.9, 0.93, hg) * (1.0 - smoothstep(0.93, 1.0, hg));
      float lq = svn(vec2(u, vWP.y) * 0.5 + 33.0) * 0.7 + svn(vec2(u, vWP.y) * 1.3 + 8.0) * 0.3;                // kireç badana yamaları (açık, düzgün kenarlı)
      c = mix(c, c * vec3(1.1, 1.09, 1.03) + 0.025, smoothstep(0.66, 0.69, lq) * 0.85 * (1.0 - smoothstep(2.0, 4.5, hg)));
      float sq = svn(vec2(u * 1.1, vWP.y * 0.28) + 77.0) * 0.8 + svn(vec2(u, vWP.y) * 1.4 + 51.0) * 0.2;       // is / duman lekesi (dikey akıntı)
      c *= 1.0 - 0.26 * smoothstep(0.66, 0.76, sq) * (0.4 + 0.6 * smoothstep(0.5, 3.0, hg));
      float cm = smoothstep(0.66, 0.78, sfbm(vec2(u, vWP.y) * 0.28 + 5.0)) * near;
      if (cm > 0.01) { float ck = scrack(vec2(u * 1.7, vWP.y * 1.7) + 40.0); c *= 1.0 - 0.2 * (1.0 - smoothstep(0.008, 0.026, ck)) * cm; }                           // çatlaklar
      c *= 1.0 - 0.07 * (1.0 - near) * 0.0;
    } else if (up > 0.5) {                                      // çatı / duvar tepesi: toz ve katran lekeleri
      float tp = sfbm(vWP.xz * 0.55 + 2.0);
      c *= 0.93 + 0.12 * tp;
      c = mix(c, c * vec3(0.62, 0.58, 0.54), smoothstep(0.64, 0.7, sfbm(vWP.xz * 0.3 + 14.0)) * 0.85);      // katran onarım yamaları
      c = mix(c, c * vec3(1.12, 1.1, 1.05), smoothstep(0.7, 0.76, sfbm(vWP.xz * 0.22 + 61.0)) * 0.6);       // kireçlenmiş açık bölgeler
      vec2 sg = abs(fract(vWP.xz / 3.2) - 0.5);                                                          // beton levha derzleri
      c *= 1.0 - 0.18 * (1.0 - smoothstep(0.455, 0.48, max(sg.x, sg.y))) * 0.0 - 0.2 * smoothstep(0.484, 0.5, max(sg.x, sg.y)) * aaP;
      c *= 0.985 + 0.03 * sh21(floor(vWP.xz * 9.0)) * aaP;
    } else {
      c *= 0.9;                                                  // alt yüzler
    }
  } else if (kind == 2.0) {                                    // ── AHŞAP: tahta çizgileri + damar ──
    float pu = side > 0.5 ? u : vWP.x;
    float pv = side > 0.5 ? vWP.y : vWP.z;
    float w = side > 0.5 ? 0.2 : 0.2;
    float pl = floor((side > 0.5 ? vWP.y : pu) / w);
    float edge = abs(fract((side > 0.5 ? vWP.y : pu) / w) - 0.5);
    float tone = 0.88 + 0.24 * sh21(vec2(pl, floor(side > 0.5 ? u * 0.4 : vWP.z * 0.4)));
    float grain = svn(vec2((side > 0.5 ? u : vWP.z) * 2.2, (side > 0.5 ? vWP.y : pu) * 38.0));
    c *= tone * (0.92 + 0.14 * mix(0.5, grain, aaP));
    c *= 1.0 - 0.34 * smoothstep(0.44, 0.5, edge) * mix(0.55, 1.0, near) * aaP;      // tahta arası boşluk
    c *= 0.94 + 0.1 * sfbm(vWP.xz * 0.5 + vWP.y);
    if (side > 0.5) c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.5, hg));
  } else if (kind == 4.0) {                                    // ── TAŞ / BETON ──
    c *= 0.93 + 0.14 * sfbm(vWP.xz * 0.9 + vWP.y * 0.7);
    c *= 0.97 + 0.06 * sh21(floor(vec2(u, vWP.y) * 6.0));
    if (side > 0.5) c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.8, hg));
  } else if (kind == 3.0) {                                    // ── BOYALI YÜZEY (konteyner, kapı, tabela): solmuş boya, pas, oluklu sac ──
    float pn = sfbm(vec2(u, vWP.y) * 1.3 + vWP.xz * 0.2);
    c *= 0.93 + 0.12 * pn;
    float ch = smoothstep(0.7, 0.8, sfbm(vec2(u, vWP.y) * 2.1 + 31.0));
    c = mix(c, c * vec3(1.18, 1.1, 0.95) + 0.05, ch * 0.5 * near);
    float rustN = sfbm(vec2(u, vWP.y) * 0.9 + vWP.xz * 0.4 + 61.0);
    float rust = smoothstep(0.6, 0.76, rustN) * (side > 0.5 ? 0.35 + 0.65 * (1.0 - smoothstep(0.0, 1.2, hg)) : 0.7);      // pas: alt kenarlarda ve üst yüzlerde yoğun
    c = mix(c, vec3(0.3, 0.13, 0.06) * (0.8 + 0.4 * svn(vWP.xz * 6.0)), clamp(rust, 0.0, 1.0) * 0.75);
    if (up > 0.5) c *= 1.0 - 0.14 * smoothstep(0.55, 0.9, sin(dot(vWP.xz, vec2(0.7, 0.7)) * 14.0) * 0.5 + 0.5) * near;           // oluklu sac
    if (side > 0.5) c *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.6, hg));
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`);
  };
  material.customProgramCacheKey = () => 'desert-surface-v2';
  return material;
}

// Zemin malzemesi (ek: aAux = vec3(saha döşemesi, kaldırım taşı, avlu levhası) maskeleri): kum dalgaları, çakıl noktaları, döşeme çizgileri
export function applyDesertGround(material) {
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aAux;\nvarying vec3 vWP;\nvarying vec3 vAux;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAux = aAux;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vAux;
${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float dist = length(cameraPosition - vWP);
  float near = 1.0 - smoothstep(16.0, 55.0, dist);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.z)) * 0.7, 1e-4);
  float aaJ = 1.0 - smoothstep(0.03, 0.09, pxw), aaS = 1.0 - smoothstep(0.05, 0.14, pxw);          // derz / tanecik pikselden inceyse soldur
  vec3 c = diffuseColor.rgb;
  vec2 p = vWP.xz;
  float slab = smoothstep(0.45, 0.55, vAux.x), cob = smoothstep(0.45, 0.55, vAux.y), yard = smoothstep(0.45, 0.55, vAux.z);
  float paved = max(slab, max(cob, yard));
  float bl = sfbm(p * 0.16 + 4.0);
  c *= 0.93 + 0.14 * bl;                                                     // geniş leke / kum rengi dalgalanması
  c *= mix(vec3(1.03, 1.0, 0.94), vec3(0.97, 0.99, 1.03), svn(p * 0.05 + 8.0));
  float rip = sin(dot(p, vec2(0.92, 0.38)) * 3.1 + sfbm(p * 0.35) * 7.0);   // rüzgâr dalgaları (tek yön)
  c *= 1.0 + (1.0 - paved) * 0.022 * rip * (0.4 + 0.6 * near);
  float sp = sh21(floor(p * 14.0));                                          // ince tanecik
  c *= 1.0 + (sp - 0.5) * 0.07 * near * aaS;
  float peb = step(0.985, sh21(floor(p * 5.0) + 17.0)) * (1.0 - paved);      // dağınık çakıl
  c = mix(c, c * 0.66, peb * 0.6 * near);
  if (slab > 0.01 || yard > 0.01) {                                          // taş levha döşeme: derz + her levhaya ton + aşınma
    float sz = slab > yard ? 1.5 : 2.0;
    vec2 q = p / sz; vec2 f = fract(q), id = floor(q);
    float ln = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * sz;
    float joint = 1.0 - smoothstep(0.02, 0.055, ln);
    float tone = 0.88 + 0.24 * sh21(id + 5.0);
    float m = max(slab, yard);
    c = mix(c, c * tone * (0.94 + 0.1 * sfbm(p * 2.0)), m);
    c *= 1.0 - 0.26 * joint * m * mix(0.45, 1.0, near) * mix(0.3, 1.0, aaJ);
    c = mix(c, c * vec3(0.8, 0.77, 0.72), m * smoothstep(0.6, 0.8, sfbm(p * 0.45 + 9.0)) * 0.6);   // levha üstünde kum / toz birikmesi
  }
  if (cob > 0.01) {                                                          // kaldırım taşı: düzensiz hücreler
    vec2 q = p / 0.62;
    float ed = scrack(q);
    float joint = 1.0 - smoothstep(0.05, 0.16, ed);
    vec2 id = floor(q);
    float tone = 0.82 + 0.34 * sh21(id + 11.0);
    vec3 stone = c * vec3(0.9, 0.9, 0.93) * tone * (0.95 + 0.1 * sfbm(p * 3.0));
    stone *= 0.85 + 0.15 * smoothstep(0.0, 0.5, ed * 3.0);                   // taş ortası hafif yüksek
    stone *= 1.0 - 0.45 * joint * mix(0.55, 1.0, near) * mix(0.35, 1.0, aaJ);
    c = mix(c, stone, cob);
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`);
  };
  material.customProgramCacheKey = () => 'desert-ground-v3';
}
