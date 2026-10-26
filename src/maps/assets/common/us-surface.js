import * as THREE from 'three';

// Askeri Üs v3 yüzeyi (12.170): tüm düz parçalar tek köşe-renkli ağda, doku dosyası / UV yok — dünya koordinatlı prosedürel gölgelendirici.
// aKind alt 6 bit = sınıf (64), üst bitler = parça tohumu (MapBuilder surface.seeded). Eski üs gölgelendiricisinden farkı:
//  · "piksel" yok: kare hücreli karma beneği (floor(p * 22) gibi) hiç kullanılmaz; bütün desenler yumuşak değer gürültüsü + piksel boyuna göre sönen (fwidth) çizgiler
//  · yol çizgileri / tarama / boya ayrı kaplama kutusu değil, zemin bölümlemesinin kendi sınıfı (üst üste binen yüzey → z-fighting yok)
//  · gece / gün batımı: kameraya en yakın 12 lamba sahte ışık verir (gölgesiz; seçim ağın onBeforeRender'ında, kamera 2 m kaydıkça)
export const UK = {
  PLAIN: 0, ASPH: 1, CONC: 2, CONT: 3, STEEL: 4, WOOD: 5, PAINT: 6, CLAD: 7, BAG: 8, HESCO: 9, CAMO: 10, CANVAS: 11, GRASS: 12, FLOOR: 13, BLOCK: 14, ROOF: 15,
  GRAVEL: 16, PAVER: 17, LINEX: 18, LINEZ: 19, HATCH: 20, GLASS: 21, GRATE: 22, RUBBER: 23, PLASTER: 24, CEIL: 25, DIRT: 26, CURB: 27, PAD: 28,
};
export const usU = { night: { value: 0 } };
const MAXL = 12;

const NOISE = `
float uh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float un(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(uh(i), uh(i+vec2(1.,0.)), f.x), mix(uh(i+vec2(0.,1.)), uh(i+vec2(1.,1.)), f.x), f.y); }
float uf(vec2 p){ return un(p) * 0.55 + un(p * 2.03 + 3.1) * 0.30 + un(p * 4.1 + 7.7) * 0.15; }
// ızgara çizgisi (hücre içinde kenara uzaklık < w): 1 = çizgi
float gridLn(vec2 q, vec2 cell, float w){ vec2 f = fract(q / cell); vec2 d = min(f, 1.0 - f) * cell; return 1.0 - smoothstep(w * 0.5, w, min(d.x, d.y)); }
float lineLn(float q, float cell, float w){ float f = fract(q / cell); float d = min(f, 1.0 - f) * cell; return 1.0 - smoothstep(w * 0.5, w, d); }
`;

const FRAG = `
{
  vec3 n = normalize(vWN);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);      // bir pikselin dünya boyu
  float aaF = 1.0 - smoothstep(0.006, 0.02, pxw);       // ince ayrıntı (≤ 2 cm) yakında
  float aaM = 1.0 - smoothstep(0.015, 0.05, pxw);       // orta (derz, oluk)
  float aaL = 1.0 - smoothstep(0.05, 0.16, pxw);        // geniş (panel, levha)
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 64.0), seed = floor(kr / 64.0);
  float up = step(0.72, n.y), dn = step(n.y, -0.72), side = step(abs(n.y), 0.3);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  float hg = vWP.y;
  vec2 p = vWP.xz, wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  float grime = 1.0 - (1.0 - smoothstep(0.0, 0.55, hg)) * side;       // duvar dibi kiri (zemin hizası)
  if (kind == 0.0) {                                                  // DÜZ
    c *= 0.95 + 0.08 * uf(wq * 0.7 + p * 0.5 + seed);
    c *= mix(1.0, 0.86, 1.0 - grime);
  } else if (kind == 1.0) {                                           // ASFALT: geniş ton, ince agrega (yumuşak), yama, çatlak, yağ
    c *= 0.86 + 0.24 * uf(p * 0.06 + 3.0);
    c *= 1.0 + (un(p * 9.0) - 0.5) * 0.12 * aaM + (un(p * 31.0) - 0.5) * 0.08 * aaF;
    vec2 pg = p / vec2(6.4, 4.2); vec2 pf = abs(fract(pg) - 0.5);
    c = mix(c, c * 0.84, step(0.88, uh(floor(pg) + 9.0)) * (1.0 - smoothstep(0.38, 0.44, max(pf.x, pf.y))));
    float cr = abs(un(p * 0.8 + 11.0) - 0.5);
    c *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.02, cr)) * smoothstep(0.5, 0.78, un(p * 0.11 + 2.0)) * aaM;
    c *= 1.0 - 0.24 * smoothstep(0.66, 0.9, uf(p * 0.25 + 70.0));
    gRough = 0.93;
  } else if (kind == 2.0) {                                           // BETON (dökme): kalıp panosu, bağ deliği, akıntı lekesi; üstte derz
    c *= 0.9 + 0.18 * uf(wq * 0.4 + p * 0.3 + seed);
    c *= 1.0 + (un(wq * 8.0 + p * 8.0) - 0.5) * 0.07 * aaM;
    if (side > 0.5) {
      c *= 1.0 - 0.1 * gridLn(vec2(u + 0.6, vWP.y), vec2(2.4, 1.2), 0.03) * aaM;
      vec2 tq = fract(vec2(u + 0.6, vWP.y + 0.3) / vec2(0.6, 0.6)) - 0.5;
      c *= 1.0 - 0.14 * (1.0 - smoothstep(0.018, 0.03, length(tq * 0.6))) * aaF;
      c *= 1.0 - 0.16 * smoothstep(0.58, 0.86, un(vec2(u * 1.3 + seed, vWP.y * 0.08)));
      c *= mix(1.0, 0.78, 1.0 - grime);
    } else if (up > 0.5) { c *= 1.0 - 0.18 * gridLn(p, vec2(3.0), 0.05) * aaL; c *= 1.0 - 0.12 * smoothstep(0.62, 0.86, uf(p * 0.3 + 30.0)); }
    gRough = 0.92;
  } else if (kind == 3.0) {                                           // KONTEYNER: oluklu sac, kiriş, solma, pas akıntısı
    float hc = mod(vWP.y + 0.0005, 2.59);
    vec3 base = c;
    c *= 0.93 + 0.09 * uf(wq * 0.6 + seed * 1.7);
    c = mix(c, mix(c, vec3(dot(c, vec3(0.333))), 0.4) * 1.15 + 0.02, smoothstep(0.4, 0.85, uf(wq * 0.16 + p * 0.05 + seed * 3.3)) * 0.45);
    if (side > 0.5) {
      float t = fract(u / 0.28);
      float rib = smoothstep(0.06, 0.16, t) - smoothstep(0.56, 0.66, t);
      c *= mix(1.0, mix(0.82, 1.05, rib), aaM);
      float rail = 1.0 - step(0.12, hc) * step(hc, 2.47);
      c = mix(c, base * 0.6, rail * 0.85);
      float drip = un(vec2(u * 3.6 + seed * 7.0, vWP.y * 0.3)) * (0.55 + 0.5 * smoothstep(1.3, 2.5, hc));
      float rust = max(smoothstep(0.72, 0.93, drip) * 0.7, rail * smoothstep(0.55, 0.85, un(wq * 2.4 + seed)) * 0.7);
      c = mix(c, vec3(0.3, 0.16, 0.08), rust * 0.5);
      c *= mix(1.0, 0.82, 1.0 - grime);
      gRough = mix(0.62, 0.9, rust);
    } else if (up > 0.5) { c *= 0.9 + 0.1 * smoothstep(0.2, 0.5, fract(dot(p, vec2(0.7071)) / 0.5)) * aaM; c = mix(c * 0.85, vec3(0.28, 0.15, 0.08), smoothstep(0.62, 0.86, uf(p * 1.2 + seed * 2.0)) * 0.4); gRough = 0.88; }
    else c *= 0.55;
    gMetal = 0.12;
  } else if (kind == 4.0) {                                           // BOYALI ÇELİK: boya aşınması (kenarsız yumuşak leke), pas izi
    c *= 0.91 + 0.12 * uf(wq * 1.0 + p * 0.4 + seed);
    float chip = smoothstep(0.74, 0.86, uf(wq * 3.0 + p * 1.8 + seed * 3.0));
    c = mix(c, vec3(0.22, 0.21, 0.2), chip * 0.5);
    float rs = smoothstep(0.76, 0.93, un(vec2(u * 2.6, vWP.y * 0.25) + seed * 4.0)) * side;
    c = mix(c, vec3(0.32, 0.17, 0.08), rs * 0.25);
    c *= mix(1.0, 0.85, 1.0 - grime);
    gRough = mix(0.5, 0.82, max(chip, rs)); gMetal = 0.3;
  } else if (kind == 5.0) {                                           // AHŞAP: tahta sırası (14 cm), damar
    float pv = side > 0.5 ? vWP.y : (abs(n.x) > 0.5 ? vWP.z : vWP.x);
    float pl = floor(pv / 0.14), edge = abs(fract(pv / 0.14) - 0.5);
    c *= 0.88 + 0.22 * uh(vec2(pl, seed));
    c *= 0.93 + 0.12 * mix(0.5, un(vec2((side > 0.5 ? u : (abs(n.x) > 0.5 ? vWP.x : vWP.z)) * 2.0, pv * 30.0)), aaM);
    c *= 1.0 - 0.35 * smoothstep(0.43, 0.5, edge) * aaM;
    gRough = 0.95;
  } else if (kind == 6.0) {                                           // BOYA (işaret, şerit): aşınmış
    c = mix(c, c * 0.62 + vec3(0.05), smoothstep(0.5, 0.85, uf(p * 1.1 + wq * 0.9 + 5.0)) * 0.6);
    gRough = 0.7;
  } else if (kind == 7.0) {                                           // OLUKLU SAC (hangar / garaj): dik oluk, levha birleşimi, pas; çatıda trapez
    if (side > 0.5) {
      float t = fract(u / 0.24);
      c *= mix(1.0, 0.86 + 0.16 * smoothstep(0.1, 0.4, t) * (1.0 - smoothstep(0.6, 0.9, t)), aaM);
      c *= 0.93 + 0.1 * uf(wq * 0.3 + seed);
      c *= 1.0 - 0.07 * lineLn(vWP.y, 2.4, 0.04) * aaL;
      c = mix(c, vec3(0.33, 0.18, 0.09), smoothstep(0.74, 0.9, uf(wq * 1.1 + 40.0)) * 0.35);
      c *= mix(1.0, 0.78, 1.0 - grime);
    } else if (n.y > 0.3) {
      float t = fract(dot(p, abs(n.x) > abs(n.z) ? vec2(0.0, 1.0) : vec2(1.0, 0.0)) / 0.5);
      c *= 0.9 * mix(1.0, 0.86 + 0.18 * smoothstep(0.15, 0.4, t) * (1.0 - smoothstep(0.6, 0.85, t)), aaM);
      c *= 0.88 + 0.2 * uf(p * 0.12 + seed);
    } else c *= 0.8;
    gRough = 0.68; gMetal = 0.22;
  } else if (kind == 8.0) {                                           // KUM TORBASI: sıra başına şişkin torba (0,62 m, şaşırtmalı + hafif kayma), torba başına ton, kumaş kırışığı
    float row = floor(vWP.y / 0.26), fy = fract(vWP.y / 0.26);
    float ax = (side > 0.5 ? u : p.x + p.y * 0.3) / 0.62 + 0.5 * mod(row, 2.0) + 0.18 * (uh(vec2(row, seed + 3.0)) - 0.5);
    float bi = floor(ax), fx = fract(ax);
    float bag = pow(max(sin(3.14159 * fy), 0.0), 0.45) * pow(max(sin(3.14159 * fx), 0.0), 0.22);
    float tone = 0.86 + 0.22 * uh(vec2(bi, row) + seed);
    if (side > 0.5) c *= mix(1.0, (0.5 + 0.55 * bag) * tone, aaL);
    else c *= (0.84 + 0.18 * un(p * 3.0 + seed)) * mix(1.0, 0.8 + 0.25 * pow(max(sin(3.14159 * fract(p.x / 0.62 + p.y * 0.2)), 0.0), 0.3), aaL);
    c *= 1.0 + 0.07 * (un(vec2(ax * 7.0, fy * 3.0 + row)) - 0.5) * aaM;
    c *= mix(1.0, 0.8, 1.0 - grime);
    gRough = 0.97;
  } else if (kind == 9.0) {                                           // HESCO: tel kafes + jeotekstil; üstte toprak
    if (up > 0.5) { c = mix(c, vec3(0.33, 0.28, 0.2), 0.6); c *= 0.82 + 0.3 * uf(p * 2.5 + seed); }
    else {
      c *= 0.9 + 0.14 * uf(wq * 0.8 + seed);
      c *= 1.0 - 0.22 * gridLn(wq, vec2(0.076), 0.012) * aaF;
      c *= 1.0 - 0.2 * lineLn(u, 1.0, 0.05) * aaM;
      c *= mix(1.0, 0.8, 1.0 - grime);
    }
    gRough = 0.96;
  } else if (kind == 10.0) {                                          // KAMUFLAJ AĞI: üç tonlu leke
    float b1 = uf(p * 0.5 + seed * 3.0), b2 = uf(p * 1.2 + 17.0);
    c = mix(c, c * 0.62, smoothstep(0.47, 0.55, b1));
    c = mix(c, c * 1.3 + vec3(0.02, 0.03, 0.0), smoothstep(0.6, 0.67, b2) * 0.8);
    gRough = 1.0;
  } else if (kind == 11.0) {                                          // ÇADIR BEZİ: dikiş, solma, etek kiri
    float sc = abs(n.y) > 0.3 ? p.x + p.y : u;
    c *= 0.93 + 0.1 * uf((abs(n.y) > 0.5 ? p : wq) * 0.7 + seed);
    c *= 1.0 - 0.12 * lineLn(sc, 1.25, 0.03) * aaM;
    c *= 1.0 + 0.06 * n.y;
    c *= mix(1.0, 0.8, 1.0 - grime);
    gRough = 0.98;
  } else if (kind == 12.0) {                                          // ÇİMEN (sınır dışı arazi)
    c *= 0.82 + 0.28 * uf(p * 0.08);
    c *= 0.92 + 0.14 * un(p * 2.2) * aaL + 0.06 * (un(p * 9.0) - 0.5) * aaM;
    c = mix(c, c * vec3(1.12, 1.02, 0.78), smoothstep(0.58, 0.8, un(p * 0.05 + 8.0)) * 0.5);
    gRough = 1.0;
  } else if (kind == 13.0) {                                          // İÇ ZEMİN: vinil karo 0,6 m
    if (up > 0.5) {
      c *= 1.0 - 0.14 * gridLn(p, vec2(0.6), 0.012) * aaM;
      c *= 0.96 + 0.06 * uh(floor(p / 0.6) + seed);
      c *= 1.0 - 0.1 * smoothstep(0.6, 0.9, uf(p * 0.6 + seed));
      gRough = 0.55;
    }
  } else if (kind == 14.0) {                                          // BOYALI BRİKET (bina dış duvarı): örgü derzi, su lekesi
    if (side > 0.5) {
      float by = vWP.y / 0.2, row = floor(by), bx = u / 0.4 + 0.5 * mod(row, 2.0);
      vec2 d = vec2(min(fract(bx), 1.0 - fract(bx)) * 0.4, min(fract(by), 1.0 - fract(by)) * 0.2);
      c *= 1.0 - 0.12 * (1.0 - smoothstep(0.004, 0.012, min(d.x, d.y))) * aaM;
      c *= 1.0 - 0.12 * smoothstep(0.6, 0.86, uf(wq * 0.2 + seed * 2.0));
      c *= mix(1.0, 0.82, 1.0 - grime);
    }
    gRough = 0.9;
  } else if (kind == 15.0) {                                          // ÇATI ÜSTÜ: bitümlü membran (rulo bindirmesi) / yan: beton
    if (up > 0.5) {
      c *= 0.88 + 0.2 * uf(p * 0.45 + seed);
      c *= 1.0 + 0.1 * lineLn(p.x, 1.0, 0.03) * aaM;
      c = mix(c, c * 0.8, smoothstep(0.62, 0.86, uf(p * 0.18 + 20.0)) * 0.5);
      gRough = 0.95;
    } else if (dn > 0.5) { c = mix(c, vec3(0.74, 0.75, 0.72), 0.75); c *= 1.0 - 0.12 * gridLn(p, vec2(0.6), 0.02) * aaM; gRough = 0.9; }
    else c *= 0.92 + 0.08 * uf(wq * 0.6);
  } else if (kind == 16.0) {                                          // ÇAKIL (kamp avlusu)
    c *= 0.86 + 0.24 * uf(p * 0.16 + seed);
    c *= 0.9 + 0.2 * mix(0.5, un(p * 14.0), aaM) + 0.08 * (un(p * 40.0) - 0.5) * aaF;
    c = mix(c, c * 0.78, smoothstep(0.6, 0.85, uf(p * 0.4 + 9.0)) * 0.5);
    gRough = 1.0;
  } else if (kind == 17.0) {                                          // BETON SAHA (apron): 4 m derz, levha tonu, yağ lekesi
    c *= 1.0 - 0.22 * gridLn(p, vec2(4.0), 0.05) * aaL;
    c *= 0.94 + 0.1 * un(floor(p / 4.0) * 1.37 + 2.0);
    c *= 0.92 + 0.14 * uf(p * 0.3 + 4.0) + 0.05 * (un(p * 12.0) - 0.5) * aaM;
    c *= 1.0 - 0.16 * smoothstep(0.64, 0.88, uf(p * 0.22 + 30.0));
    gRough = 0.9;
  } else if (kind == 18.0 || kind == 19.0) {                          // YOL ÇİZGİSİ: kesikli (3 m çizgi / 3 m boşluk), boşluk = asfalt
    float a = kind == 18.0 ? p.x : p.y;
    float on = step(0.5, fract(a / 6.0));
    vec3 asph = vec3(0.24, 0.25, 0.27) * (0.9 + 0.2 * uf(p * 0.06 + 3.0));
    c = mix(asph, c * (0.85 + 0.15 * un(p * 3.0)), on);
    c = mix(c, asph, smoothstep(0.5, 0.85, uf(p * 1.2 + 5.0)) * 0.4 * on);
    gRough = 0.8;
  } else if (kind == 20.0) {                                          // TARAMA: sarı-siyah 45° şerit
    float s = step(0.5, fract((p.x + p.y + (side > 0.5 ? u + vWP.y : 0.0)) / 0.6));
    c = mix(c, vec3(0.06, 0.06, 0.07), s);
    c = mix(c, c * 0.7, smoothstep(0.55, 0.85, uf(p * 1.4 + wq + 5.0)) * 0.5);
    gRough = 0.75;
  } else if (kind == 21.0) {                                          // CAM (opak, koyu yansımalı): ufuk yansıması
    c = mix(c, vec3(0.52, 0.6, 0.66), 0.25 * smoothstep(-0.2, 0.6, n.y + 0.3 * un(wq * 0.4)));
    gRough = 0.12; gMetal = 0.6;
  } else if (kind == 22.0) {                                          // IZGARA (yürüme yolu / basamak)
    vec2 q = (up > 0.5 ? p : wq) / 0.1; vec2 f = fract(q);
    float hole = step(0.2, f.x) * step(f.x, 0.8) * step(0.2, f.y) * step(f.y, 0.8);
    c *= mix(1.0, 0.5, hole * aaF);
    gRough = 0.5; gMetal = 0.5;
  } else if (kind == 23.0) {                                          // LASTİK
    c *= 0.9 + 0.12 * un(wq * 3.0 + p * 3.0);
    gRough = 0.95;
  } else if (kind == 24.0) {                                          // İÇ SIVA: açık, süpürgelik (alt 12 cm koyu)
    if (side > 0.5) {
      c *= 0.95 + 0.06 * uf(wq * 0.5 + seed);
      float fl = mod(vWP.y - 0.15 + 32.5, 3.25);                     // kat zemini 0,15 + k · 3,25 (bina kaidesi + kat yüksekliği)
      c *= 1.0 - 0.42 * (1.0 - step(0.12, fl));
    }
    gRough = 0.85;
  } else if (kind == 25.0) {                                          // TAVAN KAROSU (alt yüz) / üstte beton
    if (dn > 0.5) { c *= 1.0 - 0.14 * gridLn(p, vec2(0.6), 0.02) * aaM; c *= 0.97 + 0.04 * uh(floor(p / 0.6)); gRough = 0.9; }
    else c *= 0.9 + 0.1 * uf(p * 0.5 + wq * 0.5);
  } else if (kind == 26.0) {                                          // TOPRAK (hesco üstü, set)
    c *= 0.84 + 0.26 * uf(p * 0.3 + wq * 0.3 + seed);
    c *= 0.92 + 0.12 * un(p * 6.0 + wq * 6.0) * aaM;
    gRough = 1.0;
  } else if (kind == 27.0) {                                          // BORDÜR: sarı-siyah 1 m / beton
    float s = step(0.5, fract((side > 0.5 ? u : p.x + p.y) / 2.0));
    c = mix(c, c * 0.3, s * (1.0 - up * 0.0));
    c *= 0.9 + 0.12 * uf(wq * 2.0 + p);
    gRough = 0.85;
  } else if (kind == 28.0) {                                          // HELİPAD / PİST BETONU: 2 m derz, is lekesi
    c *= 1.0 - 0.2 * gridLn(p, vec2(2.0), 0.04) * aaL;
    c *= 0.92 + 0.14 * uf(p * 0.25 + seed);
    gRough = 0.88;
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`;

// lamps: [{ x, y, z, r, c:'#hex', k }] — tümü; her karede kameraya en yakın MAXL tanesi yüklenir
export function makeUsSurface(lamps = []) {
  const L = [], LC = [];
  for (let i = 0; i < MAXL; i++) { L.push(new THREE.Vector4(0, -999, 0, 0.001)); LC.push(new THREE.Color(0, 0, 0)); }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 });
  material.userData.glow = true;                                   // environment.applyGlow emissiveIntensity'yi günün saatine göre yazar → uNight
  material.userData.usLamps = { all: lamps.map((l) => ({ ...l, col: new THREE.Color(l.c || '#ffd9a0').multiplyScalar(l.k ?? 1) })), L, LC, cx: 1e9, cz: 1e9 };
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = usU.night; sh.uniforms.uL = { value: L }; sh.uniforms.uLC = { value: LC };
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
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uNight > 0.001) {
  vec3 nn = normalize(vWN), acc = vec3(0.0);
  for (int i = 0; i < ${MAXL}; i++) {
    vec3 d = uL[i].xyz - vWP; float r = length(d);
    float a = 1.0 - clamp(r / uL[i].w, 0.0, 1.0); a *= a * (1.6 - 0.6 * a);
    acc += uLC[i] * a * (0.12 + 0.88 * max(dot(nn, d / max(r, 1e-3)), 0.0));
  }
  totalEmissiveRadiance += diffuseColor.rgb * acc * uNight;
}`);
  };
  material.customProgramCacheKey = () => 'us-surface-v3b';
  return material;
}

// Ağa bağla: kamera 2 m'den fazla kaydıysa en yakın MAXL lamba yüklenir; en uzak üçte biri uzaklıkla söner (seçim değişince patlama yok).
export function attachUsSurfaceLamps(mesh) {
  const S = mesh.material.userData.usLamps; if (!S) return;
  mesh.onBeforeRender = (r, s, camera) => {
    if (!camera.isPerspectiveCamera) return;
    usU.night.value = Math.min(1, (mesh.material.emissiveIntensity || 0) / 1.5);
    if (usU.night.value <= 0.001) return;
    const cp = camera.position;
    if (Math.hypot(cp.x - S.cx, cp.z - S.cz) < 2) return;
    S.cx = cp.x; S.cz = cp.z;
    const near = S.all.map((l) => ({ l, d: Math.hypot(l.x - cp.x, l.y - cp.y, l.z - cp.z) - l.r * 0.5 })).sort((a, b) => a.d - b.d).slice(0, MAXL + 1);
    const far = near.length > MAXL ? Math.max(near[MAXL].d, 1) : 1e9;
    for (let i = 0; i < MAXL; i++) {
      const q = near[i];
      if (!q) { S.L[i].set(0, -999, 0, 0.001); S.LC[i].setRGB(0, 0, 0); continue; }
      const f = 1 - THREE.MathUtils.smoothstep(q.d, far * 0.72, far);
      S.L[i].set(q.l.x, q.l.y, q.l.z, q.l.r); S.LC[i].copy(q.l.col).multiplyScalar(f);
    }
  };
}
