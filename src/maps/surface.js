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

// ───────── Şehir (New York, gece) yüzeyi ─────────
// Aynı yöntem (birleşik köşe-renkli ağ + dünya koordinatlı gölgelendirici, UV / doku yok, çizim çağrısı artmaz), şehir sınıflarıyla:
// asfalt (çatlak, yama, yağ lekesi, ıslak birikinti → düşük pürüz), kaldırım (levha derzi), tuğla (örgü + derz + kat silmeleri + is), beton cephe
// (panel derzi, yağmur akıntısı, kurum), cam (yansıma + bazı pencerelerde loş iç ışık / TV titremesi), boyalı metal (araç: yanık, pas), moloz, demir, yol boyası, ahşap.
// aKind alt 4 bit = sınıf, üst 4 bit = parça başına rastgele tohum (her pencere / araç kendi tonunda). Sınıf kutuda açıkça verilir (opt.kind / withKind), yoksa renkten çıkar.
export const CITY = { PLAIN: 0, ASPHALT: 1, WALK: 2, BRICK: 3, CONC: 4, GLASS: 5, PAINT: 6, RUBBLE: 7, IRON: 8, MARK: 9, WOOD: 10, FACADE: 11 };
export const cityTime = { value: 0 };                          // gölgelendirici zamanı (TV titremesi): newyork fx.update yazar

export function cityKindOfColor(hex) {
  _c.set(hex).getHSL(_h, THREE.SRGBColorSpace);
  const { h, s, l } = _h;
  if (s < 0.16) return l < 0.2 ? CITY.IRON : CITY.CONC;                                     // nötr: koyu = demir / lastik, açık = beton
  if (h > 0.05 && h < 0.16 && s > 0.2 && l < 0.45) return CITY.WOOD;                        // koyu sıcak: sandık, palet, bank
  return CITY.PAINT;                                                                         // doygun: boyalı metal
}

export function makeCityMaterial() {
  // ortam haritasının aynasal yansıması kullanılmaz (aşağıda radiance = 0): yerine gölgelendiricide sahte gece göğü yansıması (nightRefl)
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = cityTime;
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
float gRough = -1.0;
float gMetal = -1.0;
vec3 gEmis = vec3(0.0);
${GLSL_NOISE}
vec3 nightRefl(vec3 n, vec3 wp) {                              // sahte yansıma: ufukta yangın kızıllığı, tepede koyu lacivert
  vec3 r = reflect(normalize(wp - cameraPosition), n);
  float hz = exp(-abs(r.y - 0.08) * 7.0);                       // ufuk bandı (yangın kızıllığı); aşağı = koyu sokak, yukarı = gece göğü
  return vec3(0.024, 0.011, 0.006) * hz + vec3(0.003, 0.005, 0.012) * smoothstep(0.0, 0.6, r.y);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float dist = length(cameraPosition - vWP);
  float near = 1.0 - smoothstep(16.0, 60.0, dist);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);
  float aaB = 1.0 - smoothstep(0.01, 0.03, pxw), aaP = 1.0 - smoothstep(0.02, 0.06, pxw), aaJ = 1.0 - smoothstep(0.03, 0.09, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 16.0), seed = floor(kr / 16.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  float hg = vWP.y - vGnd;
  vec2 p = vWP.xz;
  vec2 wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  if (kind == 1.0) {                                           // ── ASFALT ──
    if (up > 0.5) {
      c *= 1.15 * (0.78 + 0.44 * sfbm(p * 0.09 + 3.0));
      c *= mix(vec3(1.03, 1.0, 0.97), vec3(0.96, 0.99, 1.04), svn(p * 0.04 + 1.0));
      c *= 1.0 + (sh21(floor(p * 24.0)) - 0.5) * 0.3 * aaP + (svn(p * 9.0) - 0.5) * 0.16;            // agrega taneleri
      vec2 pg = p / vec2(3.8, 2.4); vec2 pf = abs(fract(pg) - 0.5);
      float pm = step(0.88, sh21(floor(pg) + 9.0)) * (1.0 - smoothstep(0.4, 0.43, max(pf.x, pf.y)));
      c = mix(c, c * 0.7, pm);                                                                     // onarım yamaları (koyu, köşeli)
      float cr = scrack(p * 0.26 + 11.0);
      c *= 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.035, cr)) * (0.3 + 0.7 * smoothstep(0.5, 0.75, sfbm(p * 0.05 + 2.0))) * mix(0.35, 1.0, aaJ);   // uzun çatlaklar
      float am = smoothstep(0.6, 0.7, sfbm(p * 0.1 + 40.0));
      if (am > 0.01) { vec2 aw = p * 1.1 + 0.9 * vec2(svn(p * 0.7), svn(p * 0.7 + 5.0)); float ac = scrack(aw + 5.0); c *= 1.0 - 0.32 * am * (1.0 - smoothstep(0.0, 0.05, ac)) * aaB; }      // timsah sırtı çatlaklar
      c *= 1.0 - 0.35 * smoothstep(0.6, 0.82, sfbm(p * 0.33 + 70.0));                           // yağ / is lekesi
      float wet = smoothstep(0.6, 0.63, sfbm(p * 0.065 + 17.0) + 0.08 * svn(p * 0.7));           // ıslak birikinti: koyu + parlak (ateş / ay ışığı yansır)
      c *= 1.0 - 0.45 * wet;
      gRough = mix(0.8, 0.38, wet);
      gEmis = nightRefl(n, vWP) * wet * 0.8;
    } else c *= 0.8;
  } else if (kind == 2.0) {                                    // ── KALDIRIM ──
    if (up > 0.5) {
      vec2 q = p / 1.6; vec2 f = fract(q), id = floor(q);
      float ln = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 1.6;
      c *= 0.88 + 0.24 * sh21(id + 3.0);
      c *= 0.9 + 0.2 * sfbm(p * 0.7);
      c *= 1.0 - 0.45 * (1.0 - smoothstep(0.015, 0.045, ln)) * mix(0.3, 1.0, aaJ);
      if (sh21(id + 7.0) > 0.78) { float ck = scrack(p * 1.2 + 3.0); c *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.05, ck)) * aaB; }
      c = mix(c, c * 0.55, step(0.992, sh21(floor(p * 7.0) + 2.0)) * near);                         // sakız / kir noktaları
      c *= 1.0 - 0.3 * smoothstep(0.62, 0.85, sfbm(p * 0.25 + 31.0));
      gRough = 0.82;
    } else { c *= 0.82 + 0.16 * sfbm(wq * 3.0); }
  } else if (kind == 3.0 || kind == 11.0) {                    // ── GÖKDELEN CEPHESİ: tuğla / beton panel ──
    if (side > 0.5) {
      float fl = mod(vWP.y - 4.4, 3.1);                                                            // kat içi konum (pencere sırası 0…1,9)
      float upper = step(3.95, vWP.y);
      if (kind == 3.0) {
        vec2 bp = vec2(u / 0.42, vWP.y / 0.14); float row = floor(bp.y); bp.x += 0.5 * mod(row, 2.0);
        vec2 bf = fract(bp), bi = floor(bp);
        float ln = min(min(bf.x, 1.0 - bf.x) * 0.42, min(bf.y, 1.0 - bf.y) * 0.14);
        float mort = 1.0 - smoothstep(0.007, 0.018, ln);
        vec3 brick = c * (0.8 + 0.4 * sh21(bi + seed * 7.0)) * (0.9 + 0.2 * svn(bp * 2.5));
        vec3 mc = vec3(0.3, 0.28, 0.26);
        c = mix(mix(brick, mc, mort * 0.85), mix(c, mc, 0.16), 1.0 - aaB);
        vec3 stone = diffuseColor.rgb * vec3(1.35, 1.45, 1.55) * (0.9 + 0.2 * sfbm(wq * 2.0));       // taş silme (tuğladan biraz açık, gri)
        c = mix(c, stone, upper * step(2.98, fl) * 0.85);                                          // pencere altı silmesi (ince)
        c *= 1.0 - 0.12 * upper * step(1.9, fl) * (1.0 - step(2.05, fl));                          // lento gölgesi
      } else {
        c *= 0.9 + 0.2 * sfbm(wq * 0.35 + seed);
        c = mix(c, c * 0.88, upper * step(1.9, fl));                                               // ara panel (kat arası) tonu
        c *= 1.0 - 0.4 * upper * (1.0 - smoothstep(0.0, 0.03, abs(fl - 2.78))) * aaJ;           // panel derzi
        float rs = svn(vec2(u * 2.6, vWP.y * 0.12) + seed * 3.0);                                  // yağmur akıntısı
        c *= 1.0 - 0.22 * smoothstep(0.5, 0.85, rs) * smoothstep(0.0, 1.2, mod(vWP.y - 4.25, 3.1)) * aaP;
        c = mix(c, c * vec3(1.08, 1.06, 1.02), smoothstep(0.7, 0.75, sfbm(wq * 0.6 + 12.0)) * 0.6);   // dökülmüş beton (açık agrega)
      }
      vec3 base = vec3(0.16, 0.155, 0.15) * (0.85 + 0.3 * sfbm(wq * 1.5));                         // zemin kat: koyu taş kaide (dükkân cephesi)
      c = mix(c, base, (1.0 - step(3.5, vWP.y)) * 0.8);
      c = mix(c, vec3(0.3, 0.29, 0.27) * (0.9 + 0.2 * sfbm(wq * 3.0)), step(3.5, vWP.y) * (1.0 - step(3.95, vWP.y)));   // zemin kat saçak silmesi
      float st = sfbm(vec2(u * 0.8, vWP.y * 0.05) + seed * 1.7);                                  // is akıntıları (yangından)
      c *= 1.0 - 0.38 * smoothstep(0.55, 0.85, st);
      c *= 1.0 - 0.45 * smoothstep(0.62, 0.86, sfbm(wq * 0.09 + seed * 3.1 + 50.0));              // büyük yanık lekeleri
      float cm = smoothstep(0.62, 0.75, sfbm(wq * 0.2 + 5.0)) * near;
      if (cm > 0.01) { float ck = scrack(wq * 0.45 + 0.5 * vec2(svn(wq * 0.5), svn(wq * 0.5 + 3.0)) + 40.0); c *= 1.0 - 0.3 * (1.0 - smoothstep(0.004, 0.018, ck)) * cm; }
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 1.0, hg));                                            // taban kirlenmesi
    } else if (up > 0.5) {                                     // çatı: katran + çakıl
      c = mix(c, vec3(0.12, 0.12, 0.125), 0.55) * (0.82 + 0.36 * sfbm(p * 0.35 + seed));
      c *= 1.0 + (sh21(floor(p * 14.0)) - 0.5) * 0.25 * aaP;
      gRough = 0.95;
    } else c *= 0.75;
  } else if (kind == 4.0) {                                    // ── DÜZ BETON (bariyer, kaide, ev duvarı, silüet) ──
    c *= 0.88 + 0.24 * sfbm(wq * 0.5 + p * 0.3 + seed);
    c *= 1.0 + (svn(wq * 7.0 + p * 7.0) - 0.5) * 0.08 * aaP;
    c *= 1.0 - 0.3 * smoothstep(0.6, 0.85, sfbm(vec2(u * 0.9, vWP.y * 0.12) + seed * 1.3));    // akıntı / is lekesi
    if (side > 0.5) c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.9, hg));
    gRough = 0.9;
  } else if (kind == 5.0) {                                    // ── CAM ──
    c *= 0.75 + 0.5 * svn(wq * vec2(0.6, 0.25) + seed * 5.0);
    gRough = 0.12;
    gEmis = nightRefl(n, vWP) * (0.5 + 0.5 * svn(wq * 0.3 + seed));
    if (side > 0.5) {
      if (seed < 2.0) gEmis += vec3(0.55, 0.3, 0.1) * (0.12 + 0.1 * svn(wq * 1.7 + seed)) * (0.7 + 0.3 * step(0.5, fract(vWP.y * 7.0)));          // loş iç ışık (perde / jaluzi)
      else if (seed < 3.0) gEmis += vec3(0.12, 0.22, 0.5) * (0.12 + 0.2 * svn(vec2(uTime * 2.3, seed + p.x)));                                    // TV titremesi
      else if (seed > 13.5) { float ck = scrack(wq * 2.2 + seed); c += 0.06 * (1.0 - smoothstep(0.0, 0.04, ck)) * aaB; gRough = 0.3; }   // kırık cam
    }
  } else if (kind == 6.0) {                                    // ── BOYALI METAL (yanık araç, tabela, konteyner) ──
    c *= 0.9 + 0.16 * sfbm(wq * 1.3 + p * 0.2);
    float lum = dot(diffuseColor.rgb, vec3(0.333));
    float burnt = smoothstep(0.38, 0.66, sfbm(p * 0.45 + vWP.y * 0.35 + seed * 2.3));
    float rust = smoothstep(0.64, 0.8, sfbm(wq * 1.1 + p * 0.5 + 61.0));
    c = mix(c, vec3(0.3, 0.12, 0.05) * min(1.0, lum * 3.0 + 0.15) * (0.7 + 0.5 * svn(p * 6.0 + vWP.y * 4.0)), rust * 0.7);
    c = mix(c, vec3(0.045, 0.04, 0.038) * (0.8 + 0.4 * svn(wq * 4.0)), burnt * 0.78);
    if (side > 0.5) c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.5, hg));
    gRough = mix(0.42, 0.92, max(burnt, rust));
    gMetal = 0.2 * (1.0 - max(burnt, rust));
  } else if (kind == 7.0) {                                    // ── MOLOZ / ÇIPLAK BETON ──
    c *= 0.72 + 0.56 * sfbm(p * 1.6 + vWP.y * 1.3 + seed);
    c *= 1.0 + (sh21(floor(vWP.xz * 9.0 + vWP.y * 9.0)) - 0.5) * 0.2 * aaP;
    if (up > 0.5) c = mix(c, vec3(0.34, 0.32, 0.29), 0.25 * sfbm(p * 0.8));                     // üstte toz
    gRough = 0.96;
  } else if (kind == 8.0) {                                    // ── DEMİR ──
    c *= 0.85 + 0.3 * sfbm(wq * 2.0 + p);
    c = mix(c, c * vec3(1.5, 0.9, 0.6), smoothstep(0.62, 0.8, sfbm(wq * 2.5 + 9.0)) * 0.6);
    gRough = 0.55; gMetal = 0.3;
  } else if (kind == 9.0) {                                    // ── YOL BOYASI: aşınmış ──
    float wear = smoothstep(0.45, 0.8, sfbm(p * 1.4 + 5.0) + 0.2 * svn(p * 11.0));
    c = mix(c * 0.85, vec3(0.05, 0.055, 0.06), wear * 0.75);
    gRough = 0.6;
  } else if (kind == 10.0) {                                   // ── AHŞAP ──
    float pv = side > 0.5 ? vWP.y : vWP.x;
    float pl = floor(pv / 0.2), edge = abs(fract(pv / 0.2) - 0.5);
    c *= 0.86 + 0.26 * sh21(vec2(pl, seed));
    c *= 0.92 + 0.14 * mix(0.5, svn(vec2((side > 0.5 ? u : vWP.z) * 2.2, pv * 38.0)), aaP);
    c *= 1.0 - 0.34 * smoothstep(0.44, 0.5, edge) * aaP;
    c *= 1.0 - 0.3 * smoothstep(0.6, 0.85, sfbm(p * 0.8 + vWP.y + seed));                       // is / yanık
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmis;')
      .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\nradiance = vec3(0.0);');          // ortam haritasının yansıması (gündüz odası) atılır, dağınık ışığı kalır: gece camda / ıslak asfaltta beyaz leke yapıyordu
  };
  material.customProgramCacheKey = () => 'city-surface-v4';
  return material;
}
