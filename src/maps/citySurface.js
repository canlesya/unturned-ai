import * as THREE from 'three';
import { GLSL_NOISE } from './surface.js';

// ───────── Şehir (New York, gece) yüzeyi, 2. sürüm ─────────
// Yöntem 12.91 ile aynı: tüm statik parçalar tek köşe-renkli ağda, ayrıntı dünya koordinatlı prosedürel gölgelendiricide (doku / çizim çağrısı yok).
// Yeni: kutu yüzü UV'si korunur (b.surface.uv) → gölgelendirici her yüzün gerçek boyutunu (m) türev çerçevesinden bulur; böylece cephe pencere ızgarası
// (tower() ile birebir: 2,7 m sütun, 3,1 m kat), pencere çerçevesi / kayıt / denizlik / lento / köşe taşı, dükkân cephesi (ayak, tabela bandı, kepenk),
// oda-içi eşleme (pencere arkasında derinliği olan oda: duvar, tavan lambası, eşya, perde / jaluzi / TV), patlak delikler (uniform listesi: düzensiz kenar,
// yanık oda, is izi), asfalt lastik izi / çukur / rögar, kaldırım bordürü, yanık araç, moloz, yangın merdiveni ızgarası, ufuk silüeti ışıkları çizilir.
// aKind = sınıf (alt 6 bit) + parça tohumu (üst 4 bit, ×64). Sınıf kutuda açıkça verilir (opt.kind / withKind), yoksa renkten çıkar.
export const CITY = {
  PLAIN: 0, ASPHALT: 1, WALK: 2, BRICK: 3, CONC: 4, GLASS: 5, PAINT: 6, RUBBLE: 7, IRON: 8, MARK: 9, WOOD: 10, FACADE: 11,
  WINLIT: 12, STORE: 13, BRICK_R: 14, FACADE_R: 15, TRIM: 16, PLINTH: 17, AWNING: 18, WRECK: 19, MANHOLE: 20, FIREESC: 21, SKY: 22, GRASS: 23,
};
export const cityTime = { value: 0 };                          // gölgelendirici zamanı (TV / floresan titremesi): newyork fx.update yazar
const MAXH = 48;
export const cityHoles = { value: Array.from({ length: MAXH }, () => new THREE.Vector4(0, -999, 0, 0)), n: { value: 0 } };   // patlak delikler: merkez (x, y, z) + ateş (w)
export function setCityHoles(list) { list.slice(0, MAXH).forEach(([x, y, z, f], i) => cityHoles.value[i].set(x, y, z, f)); cityHoles.n.value = Math.min(MAXH, list.length); }

const _c = new THREE.Color(), _h = { h: 0, s: 0, l: 0 };
export function cityKindOfColor(hex) {
  _c.set(hex).getHSL(_h, THREE.SRGBColorSpace);
  const { h, s, l } = _h;
  if (s < 0.16) return l < 0.2 ? CITY.IRON : CITY.CONC;                                     // nötr: koyu = demir / lastik, açık = beton
  if (h > 0.05 && h < 0.16 && s > 0.2 && l < 0.45) return CITY.WOOD;                        // koyu sıcak: sandık, palet, bank
  return CITY.PAINT;                                                                         // doygun: boyalı metal
}

const GLSL_CITY = `
vec2 gFS = vec2(1.0); vec3 gTu = vec3(1.0, 0.0, 0.0), gTv = vec3(0.0, 1.0, 0.0);
void faceFrame() {                                             // yüz boyutu (m) + yüz eksenleri: UV türevleri ile konum türevlerinden (kotanjant çerçeve)
  vec3 dpx = dFdx(vWP), dpy = dFdy(vWP); vec2 dux = dFdx(vFUv), duy = dFdy(vFUv);
  float det = dux.x * duy.y - duy.x * dux.y;
  if (abs(det) < 1e-14) return;
  vec3 Tu = (dpx * duy.y - dpy * dux.y) / det, Tv = (dpy * dux.x - dpx * duy.x) / det;
  gFS = vec2(length(Tu), length(Tv)); gTu = Tu / max(gFS.x, 1e-5); gTv = Tv / max(gFS.y, 1e-5);
}
float edgeDist() { vec2 e = min(vFUv, 1.0 - vFUv) * gFS; return min(e.x, e.y); }    // yüz kenarına uzaklık (m)
vec3 nightRefl(vec3 n, vec3 wp) {                              // sahte yansıma: ufukta yangın kızıllığı, tepede koyu lacivert
  vec3 r = reflect(normalize(wp - cameraPosition), n);
  float hz = exp(-abs(r.y - 0.08) * 7.0);
  return vec3(0.03, 0.013, 0.006) * hz + vec3(0.004, 0.006, 0.014) * smoothstep(0.0, 0.6, r.y);
}
float fresnel(vec3 n, vec3 wp) { float f = 1.0 - abs(dot(normalize(cameraPosition - wp), n)); return 0.25 + 0.75 * f * f * f; }
vec3 brickWall(vec2 wq, vec3 base, float sd, float aaB) {      // tuğla örgü (yarım kaydırmalı), derz uzakta ortalamaya karışır
  vec2 bp = vec2(wq.x / 0.42, wq.y / 0.14); float row = floor(bp.y); bp.x += 0.5 * mod(row, 2.0);
  vec2 bf = fract(bp), bi = floor(bp);
  float ln = min(min(bf.x, 1.0 - bf.x) * 0.42, min(bf.y, 1.0 - bf.y) * 0.14);
  float mort = 1.0 - smoothstep(0.007, 0.018, ln);
  vec3 brick = base * (0.78 + 0.44 * sh21(bi + sd * 7.0)) * (0.9 + 0.2 * svn(bp * 2.5));
  brick = mix(brick, brick * vec3(0.7, 0.68, 0.72), step(0.93, sh21(bi + 31.0)));         // yanık / koyu tuğlalar
  vec3 mc = vec3(0.3, 0.28, 0.26);
  return mix(mix(brick, mc, mort * 0.85), mix(base, mc, 0.16), 1.0 - aaB);
}
// oda-içi eşleme: p = cam düzleminde giriş (x merkezli, y oda tabanından, z = 0), d = oda içine ışın (d.z > 0), s = oda boyutu → (vuruş noktası, yüzey)
// yüzey: 0 arka duvar, 1 tavan, 2 taban, 3 yan duvar
vec4 roomHit(vec3 p, vec3 d, vec3 s) {
  vec3 ad = max(abs(d), vec3(1e-3));
  p.x = clamp(p.x, -s.x * 0.5 + 0.01, s.x * 0.5 - 0.01); p.y = clamp(p.y, 0.01, s.y - 0.01);
  float tx = (d.x > 0.0 ? s.x * 0.5 - p.x : p.x + s.x * 0.5) / ad.x;
  float ty = (d.y > 0.0 ? s.y - p.y : p.y) / ad.y;
  float tz = (s.z - p.z) / ad.z;
  float t = min(tx, min(ty, tz));
  float id = t == tz ? 0.0 : t == ty ? (d.y > 0.0 ? 1.0 : 2.0) : 3.0;
  return vec4(p + d * t, id);
}
// oda rengi: lit 0 karanlık … 1 aydınlık; tint ışık rengi; sd tohum (0…1); burnt 1 = yanmış oda (kömür siyahı, alevle aydınlanır)
vec3 roomColor(vec3 p, vec3 d, float sd, vec3 tint, float lit, float burnt) {
  vec3 s = vec3(2.7, 3.0, 2.4 + 2.0 * fract(sd * 7.31));
  vec4 r = roomHit(p, d, s);
  vec3 h = r.xyz; float id = r.w;
  vec3 wall = mix(vec3(0.62, 0.55, 0.44), vec3(0.45, 0.52, 0.56), fract(sd * 3.7));       // duvar boyası (krem / soğuk gri)
  vec3 col;
  if (id == 0.0) {
    col = wall * (0.86 + 0.14 * step(0.5, fract(h.x * 5.0 + sd * 9.0)) * step(0.5, fract(sd * 5.3)));   // duvar kâğıdı çizgisi
    float fx = (fract(sd * 11.7) - 0.5) * 1.3, fw = 0.45 + 0.5 * fract(sd * 17.3), fh = 0.8 + 1.2 * fract(sd * 23.1);
    if (abs(h.x - fx) < fw * 0.5 && h.y < fh) col = vec3(0.2, 0.13, 0.08) * (0.7 + 0.3 * step(0.5, fract(h.y * 3.0)));   // dolap / raf
    vec2 pf = vec2(h.x + fx * 0.8, h.y - 1.75);
    if (max(abs(pf.x) - 0.32, abs(pf.y) - 0.22) < 0.0 && fract(sd * 29.0) > 0.4) col = mix(vec3(0.15, 0.1, 0.06), vec3(0.5, 0.4, 0.3) * fract(sd * 41.0), step(max(abs(pf.x) - 0.28, abs(pf.y) - 0.18), 0.0));   // çerçeveli resim
    if (fract(sd * 53.0) > 0.9) {                                                                 // odada bir siluet (insan mı, zombi mi?)
      vec2 q = vec2(h.x + fx * 0.5, h.y);
      float bodyM = step(abs(q.x), 0.2 - 0.04 * q.y) * step(q.y, 1.42), headM = step(length(q - vec2(0.03, 1.6)), 0.13);
      col *= 1.0 - 0.9 * max(bodyM, headM);
    }
  } else if (id == 1.0) col = wall * 1.08;
  else if (id == 2.0) col = vec3(0.32, 0.22, 0.14) * (0.8 + 0.2 * step(0.5, fract(h.x * 4.0 + 0.5 * step(0.5, fract(h.z * 0.8)))));   // ahşap döşeme
  else col = wall * 0.85;
  vec3 lp = vec3(0.0, s.y - 0.15, s.z * 0.55);                                                    // tavan lambası
  vec3 dl = h - lp;
  float L = 1.0 / (1.0 + 0.45 * dot(dl, dl));
  float lamp = id == 1.0 ? exp(-dot(h.xz - lp.xz, h.xz - lp.xz) * 14.0) * 3.0 : 0.0;
  float dark = 0.05 + 0.05 * (1.0 - smoothstep(0.0, 2.5, h.z));                                   // ay ışığı: yalnız cama yakın
  float e0 = min(h.x + s.x * 0.5, s.x * 0.5 - h.x), e1 = min(h.y, s.y - h.y), e2 = s.z - h.z;    // oda köşelerinde ortam kapanması (üzerinde durulan yüzey hariç)
  float ao = smoothstep(0.0, 0.45, id == 0.0 ? min(e0, e1) : id == 3.0 ? min(e1, e2) : min(e0, e2)) * 0.45 + 0.55;
  vec3 lt = mix(tint, vec3(1.0, 0.93, 0.82), 0.35);
  col *= mix(vec3(dark), lt * (0.22 + 1.25 * L) * ao + lt * lamp, lit);
  if (burnt > 0.0) {                                                                              // yanık oda: kömür siyahı; ateş tabanda, titrek, alçak dalgalı
    vec3 ch = vec3(0.022, 0.018, 0.016) * (0.6 + 0.8 * svn(h.xy * 3.0 + h.zz * 2.0)) * ao;
    float fire = clamp(burnt - 0.4, 0.0, 1.0) / 0.6;
    float fl = 0.55 + 0.45 * svn(vec2(uTime * 3.0, sd * 10.0));
    float tongue = svn(vec2(h.x * 2.0 + h.z, h.y * 1.5 - uTime * 2.2) + sd * 9.0);
    float glow = exp(-h.y * 1.4) * (0.5 + 0.8 * tongue) * fl;
    ch += vec3(1.0, 0.32, 0.06) * fire * glow * 0.55 + vec3(0.25, 0.07, 0.02) * fire * fl * exp(-h.z * 0.5) * 0.25;
    col = mix(col, ch, min(1.0, burnt * 1.5));
  }
  return col;
}
// pencere (cam yüzü): lx yatay (merkezli), ly alttan (m), W/Hh boyut, dl oda içine ışın (yerel), sd tohum, lit, tint → renk; emis = ışıyan kısım
vec3 windowPane(float lx, float ly, float W, float Hh, vec3 dl, float sd, float lit, vec3 tint, vec3 n, out vec3 emis, inout float rough) {
  emis = vec3(0.0);
  vec3 frameC = fract(sd * 3.3) < 0.45 ? vec3(0.5, 0.48, 0.43) : fract(sd * 3.3) < 0.7 ? vec3(0.06, 0.11, 0.08) : fract(sd * 3.3) < 0.9 ? vec3(0.04, 0.04, 0.045) : vec3(0.22, 0.12, 0.06);
  frameC *= 0.75 + 0.35 * svn(vec2(lx, ly) * 6.0 + sd * 20.0);
  float fw = 0.065, ax = W * 0.5 - abs(lx), rail = abs(ly - Hh * 0.52);
  float frameM = 1.0 - step(fw, ax) * step(fw, ly) * step(ly, Hh - fw) * step(0.035, rail);
  if (W > 1.15 && ly > Hh * 0.52 && fract(sd * 7.9) < 0.5) frameM = max(frameM, 1.0 - step(0.02, abs(lx)));          // üst kanatta orta kayıt
  float v = floor(fract(sd * 19.0) * 16.0);                                                       // görünüm türü
  vec3 room = roomColor(vec3(lx, ly + 0.9, 0.0), dl, sd, tint, lit, 0.0);
  vec3 c;
  if (lit > 0.5) {
    if (v < 4.0) {                                                                                // yarı açık perde (arkadan ışık geçer)
      float o = W * (0.12 + 0.2 * fract(sd * 5.1));
      float cur = step(o, abs(lx));
      vec3 cloth = tint * (0.35 + 0.15 * sin(lx * 46.0 + sd * 9.0)) * mix(vec3(1.0), vec3(1.0, 0.7, 0.6), step(0.5, fract(sd * 2.3)));
      room = mix(room, cloth, cur);
    } else if (v < 7.0) {                                                                         // jaluzi: ışık aralıklardan
      float sl = fract(ly / 0.055), drop = step(0.5, fract(sd * 4.1)) * step(Hh * (0.35 + 0.3 * fract(sd * 6.7)), ly);
      room = mix(room, tint * 0.42 * (0.8 + 0.2 * sl), step(0.32, sl) * (1.0 - drop));
    } else if (v < 9.0) {                                                                         // TV: mavi titrek ışık
      float tv = 0.45 + 0.55 * svn(vec2(uTime * 2.6, sd * 30.0)) * (0.7 + 0.3 * step(0.5, fract(uTime * 0.7 + sd)));
      room *= vec3(0.35, 0.55, 1.1) * tv;
    } else if (v > 14.5) {                                                                        // içeride yangın: turuncu titreme
      room *= vec3(1.4, 0.55, 0.2) * (0.6 + 0.5 * svn(vec2(uTime * 5.0, sd * 13.0)));
    }
    emis = room * (1.0 - frameM) * 1.35;
    c = mix(room * 0.08, frameC * (0.55 + 0.6 * smoothstep(0.0, 0.06, min(ax, ly))), frameM);
    emis += tint * frameM * 0.06;
  } else {
    float br = v > 10.5 && v < 12.5 ? 1.0 : 0.0, board = v > 12.5 && v < 13.5 ? 1.0 : 0.0;
    if (v > 13.5 && v < 14.5) { room = roomColor(vec3(lx, ly + 0.9, 0.0), dl, sd, vec3(1.0, 0.55, 0.22), 0.28 + 0.06 * svn(vec2(uTime * 4.0, sd)), 0.0); emis = room * 0.9; }   // mum / fener ışığı
    if (v > 7.5 && v < 10.5) room = mix(room, vec3(0.06, 0.05, 0.05) * (0.7 + 0.3 * sin(lx * 40.0)), step(W * 0.2, abs(lx)));   // kapalı perde
    float refl = 1.0;
    if (br > 0.5) {                                                                                // kırık cam: çatlak + yarısı yok
      float ck = scrack(vec2(lx, ly) * 4.0 + sd * 13.0);
      float hole = step(0.55, svn(vec2(lx, ly) * 2.2 + sd * 7.0));
      refl = 1.0 - hole;
      room += vec3(0.12, 0.13, 0.14) * (1.0 - smoothstep(0.0, 0.035, ck)) * refl;
    }
    c = room;
    emis += nightRefl(n, vWP) * refl * 1.4 * fresnel(n, vWP) * (0.6 + 0.6 * svn(vec2(lx * 0.8, ly * 2.0) + sd * 9.0));
    if (board > 0.5) {                                                                             // tahtayla kapatılmış
      float pl = fract(ly / 0.24), pi = floor(ly / 0.24);
      vec3 wood = vec3(0.24, 0.17, 0.1) * (0.75 + 0.4 * sh21(vec2(pi, sd))) * (0.9 + 0.15 * svn(vec2(lx * 3.0, ly * 30.0)));
      wood *= 1.0 - 0.5 * smoothstep(0.42, 0.5, abs(pl - 0.5));
      c = wood; emis = vec3(0.0); rough = 0.92;
    }
    c = mix(c, frameC * (0.55 + 0.6 * smoothstep(0.0, 0.06, min(ax, ly))), frameM);
    if (frameM > 0.5) emis = vec3(0.0);
  }
  return c;
}
// grafiti: q = yüzeyde konum (m), sd tohum. Hücre başına (3 × 1,6 m) en çok bir imza: gürültünün eş-yükselti çizgisi = el yazısı gibi kıvrımlı çizgi,
// kısa yatay şerit zarfında; seyrek hücrelerde dolgulu "throw-up" (balon harf, koyu kontur). Dönüş: x = boya, y = kontur
vec2 tagMask(vec2 q, float sd, float dens) {
  vec2 cell = floor(q / vec2(3.0, 1.6)); float h = sh21(cell + sd * 3.7);
  if (h > dens) return vec2(0.0);
  vec2 lc = q - (cell + vec2(0.5, 0.5)) * vec2(3.0, 1.6) - (sh22(cell + 9.0) - 0.5) * vec2(1.2, 0.5);
  vec2 env = lc / vec2(0.75 + 0.6 * fract(h * 7.0), 0.3 + 0.12 * fract(h * 13.0));
  float e = 1.0 - smoothstep(0.75, 1.0, length(env));
  if (e <= 0.0) return vec2(0.0);
  vec2 g = lc * vec2(3.2, 5.5) + h * 40.0;
  float nn = svn(g) * 0.7 + svn(g * 2.3 + 5.0) * 0.3;
  if (fract(h * 31.0) < 0.3) {                                                                    // dolgulu balon harf + kontur
    float fill = smoothstep(0.46, 0.5, nn) * e;
    float rim = smoothstep(0.4, 0.44, nn) * (1.0 - fill) * e;
    return vec2(fill, rim);
  }
  float w = 0.035 + 0.02 * fract(h * 17.0);
  return vec2((1.0 - smoothstep(w, w + 0.025, abs(nn - 0.5))) * e, 0.0);                         // çizgi imza
}
vec3 tagColor(float h) { return h < 0.3 ? vec3(0.62, 0.1, 0.1) : h < 0.5 ? vec3(0.15, 0.35, 0.6) : h < 0.65 ? vec3(0.75, 0.62, 0.15) : h < 0.8 ? vec3(0.75, 0.75, 0.72) : vec3(0.05, 0.05, 0.05); }
`;

const FRAG = `#include <color_fragment>
{
  vec3 n = normalize(vWN);
  float dist = length(cameraPosition - vWP);
  float near = 1.0 - smoothstep(16.0, 60.0, dist);
  float pxw = max((fwidth(vWP.x) + fwidth(vWP.y) + fwidth(vWP.z)) * 0.5, 1e-4);
  float aaB = 1.0 - smoothstep(0.01, 0.03, pxw), aaP = 1.0 - smoothstep(0.02, 0.06, pxw), aaJ = 1.0 - smoothstep(0.03, 0.09, pxw);
  float kr = floor(vKind + 0.5);
  float kind = mod(kr, 64.0), seed = floor(kr / 64.0);
  float up = step(0.72, n.y), side = step(abs(n.y), 0.3), down = step(n.y, -0.72);
  vec2 wt = vec2(-n.z, n.x);
  float u = dot(vWP.xz, wt);
  float hg = vWP.y - vGnd;
  vec2 p = vWP.xz;
  vec2 wq = vec2(u, vWP.y);
  vec3 c = diffuseColor.rgb;
  vec3 V = normalize(vWP - cameraPosition);
  bool holeK = (kind == 3.0 || kind == 11.0 || kind == 5.0 || kind == 12.0 || kind == 13.0) && side > 0.5 && vWP.y > 3.0;
  vec3 hm = vec3(0.0); vec4 hc = vec4(0.0);
  if (holeK) {                                                 // ── patlak delikler (uniform listesi): düzensiz kenar, yanık kenar, üstte is ──
    for (int i = 0; i < ${MAXH}; i++) {
      if (i >= uHoleN) break;
      vec4 H = uHoles[i]; vec3 d = vWP - H.xyz;
      if (abs(dot(d, n)) > 0.3 || dot(d, d) > 49.0) continue;
      vec2 q = vec2(dot(d.xz, wt), d.y);
      float rr = length(q * vec2(0.95, 1.0));
      float ed = 1.6 + 0.5 * (svn(q * 1.7 + H.x * 3.1) - 0.5) + 0.22 * (svn(q * 5.0 + H.z) - 0.5);
      float m = 1.0 - smoothstep(ed - 0.015, ed + 0.015, rr);
      float rim = (1.0 - smoothstep(ed, ed + 0.35 + 0.35 * svn(q * 3.3 + H.y), rr)) * (1.0 - m);
      float soot = (1.0 - smoothstep(0.2, 1.0, abs(q.x) / (1.5 + max(q.y, 0.0) * 0.45))) * smoothstep(0.3, 1.6, q.y) * (1.0 - smoothstep(2.0, 7.5, q.y)) * (0.55 + 0.45 * sfbm(q * 0.7 + H.x));
      if (m > hm.x) hc = vec4(q, H.w, float(i));
      hm = max(hm, vec3(m, rim, soot));
    }
  }
  if (kind == 1.0) {                                           // ── ASFALT ──
    if (up > 0.5) {
      c *= 1.2 * (0.8 + 0.4 * sfbm(p * 0.09 + 3.0));
      c *= mix(vec3(1.03, 1.0, 0.97), vec3(0.96, 0.99, 1.04), svn(p * 0.04 + 1.0));
      float agg = (sh21(floor(p * 24.0)) - 0.5) * 0.3 * aaP + (svn(p * 9.0) - 0.5) * 0.16;
      // lastik izleri: şerit ortalarında iki koyu, cilalı bant (agrega az, hafif parlak)
      float lo = 9.0, al = 0.0;                                                                   // lo: şerit ortasına uzaklık
      if (abs(p.y) < 9.0) { float z = abs(p.y); lo = z - (z < 3.0 ? 1.5 : 6.0); al = p.x; }
      else if (abs(p.x) < 7.0) { float x = abs(p.x); lo = x - (x < 3.5 ? 1.75 : 5.25); al = p.y; }
      else if (abs(abs(p.x) - 42.0) < 6.0) { float x = abs(abs(p.x) - 42.0); lo = x - (x < 3.0 ? 1.5 : 4.5); al = p.y; }
      else if (abs(abs(p.y) - 39.0) < 4.0) { lo = abs(abs(p.y) - 39.0) - 2.0; al = p.x; }
      float wob = 0.08 * (svn(vec2(al * 0.4, 1.0)) - 0.5);
      float tk = (1.0 - smoothstep(0.18, 0.42, abs(abs(lo + wob) - 0.8))) * (0.5 + 0.5 * smoothstep(0.25, 0.65, svn(vec2(al * 0.05, lo + 4.0))));   // tekerlek izi: cilalı, açık
      float oil = (1.0 - smoothstep(0.12, 0.4, abs(lo + wob))) * smoothstep(0.35, 0.7, svn(vec2(al * 0.3, 7.0)) * 0.7 + svn(p * 2.0) * 0.3);   // şerit ortası yağ damlası izi
      c *= 1.0 + agg * (1.0 - 0.75 * tk);
      c *= 1.0 + 0.16 * tk - 0.32 * oil;
      vec2 pg = p / vec2(3.8, 2.4); vec2 pf = abs(fract(pg) - 0.5);
      float pm = step(0.88, sh21(floor(pg) + 9.0)) * (1.0 - smoothstep(0.4, 0.43, max(pf.x, pf.y)));
      c = mix(c, c * 0.7, pm);                                                                     // onarım yamaları
      c = mix(c, c * 0.62, (1.0 - smoothstep(0.0, 0.05 + 0.04 * svn(p * 3.0), abs(max(pf.x, pf.y) - 0.42))) * step(0.88, sh21(floor(pg) + 9.0)) * 0.6 * aaJ);   // yama kenarı katran dolgu
      float cr = scrack(p * 0.26 + 11.0);
      c *= 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.035, cr)) * (0.3 + 0.7 * smoothstep(0.5, 0.75, sfbm(p * 0.05 + 2.0))) * mix(0.35, 1.0, aaJ);
      float am = smoothstep(0.6, 0.7, sfbm(p * 0.1 + 40.0));
      if (am > 0.01) { vec2 aw = p * 1.1 + 0.9 * vec2(svn(p * 0.7), svn(p * 0.7 + 5.0)); float ac = scrack(aw + 5.0); c *= 1.0 - 0.32 * am * (1.0 - smoothstep(0.0, 0.05, ac)) * aaB; }
      c *= 1.0 - 0.3 * smoothstep(0.6, 0.82, sfbm(p * 0.33 + 70.0));                            // yağ / is lekesi
      // çukurlar: düzensiz kenarlı, dibinde su; kenarında kırık agrega
      vec2 pc = floor(p / 5.0); float ph = sh21(pc + 77.0);
      float wetP = 0.0;
      if (ph > 0.86) {
        vec2 cc = (pc + 0.25 + 0.5 * sh22(pc + 3.0)) * 5.0; float rad = 0.35 + 0.55 * fract(ph * 13.0);
        float dd = length((p - cc) * vec2(1.0, 0.8 + 0.4 * fract(ph * 7.0))) + 0.14 * (svn(p * 4.0) - 0.5);
        float inP = 1.0 - smoothstep(rad - 0.03, rad, dd), rimP = (1.0 - smoothstep(rad, rad + 0.22, dd)) * (1.0 - inP);
        c = mix(c, c * 0.35, inP); c = mix(c, c * 1.35 + 0.012, rimP * (0.5 + 0.5 * sh21(floor(p * 30.0))) * aaP);
        wetP = inP * step(0.4, fract(ph * 31.0));
      }
      float wet = max(smoothstep(0.6, 0.63, sfbm(p * 0.065 + 17.0) + 0.08 * svn(p * 0.7)), wetP);   // ıslak birikinti
      c *= 1.0 - 0.45 * wet;
      gRough = mix(mix(0.82, 0.62, tk), 0.3, wet);
      gEmis = nightRefl(n, vWP) * (wet * 1.0 + tk * 0.25);
    } else c *= 0.8;
  } else if (kind == 2.0) {                                    // ── KALDIRIM + BORDÜR ──
    faceFrame();
    float e = edgeDist();
    if (up > 0.5) {
      vec2 q = p / 1.6; vec2 f = fract(q), id = floor(q);
      float ln = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 1.6;
      c *= 0.86 + 0.28 * sh21(id + 3.0);
      c *= 0.9 + 0.2 * sfbm(p * 0.7);
      c *= 1.0 - 0.45 * (1.0 - smoothstep(0.015, 0.045, ln)) * mix(0.3, 1.0, aaJ);
      if (sh21(id + 7.0) > 0.74) { float ck = scrack(p * 1.2 + 3.0); c *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.05, ck)) * aaB; }
      if (sh21(id + 19.0) > 0.93) c = mix(c, c * vec3(0.8, 0.82, 0.85), 0.6);                    // değiştirilmiş levha (farklı ton)
      c = mix(c, c * 0.55, step(0.992, sh21(floor(p * 7.0) + 2.0)) * near);                         // sakız / kir noktaları
      c *= 1.0 - 0.3 * smoothstep(0.62, 0.85, sfbm(p * 0.25 + 31.0));
      float curb = 1.0 - smoothstep(0.26, 0.29, e);                                                  // bordür taşı şeridi (granit, açık)
      vec3 gran = vec3(0.42, 0.42, 0.41) * (0.85 + 0.25 * sh21(floor(p * 1.1) + 5.0)) * (0.9 + 0.2 * svn(p * 12.0));
      c = mix(c, gran, curb);
      c *= 1.0 - 0.3 * curb * (1.0 - smoothstep(0.0, 0.03, abs(e - 0.27))) * aaJ;
      float wetS = smoothstep(0.66, 0.7, sfbm(p * 0.09 + 23.0));
      c *= 1.0 - 0.3 * wetS;
      gRough = mix(0.84, 0.45, wetS);
      gEmis = nightRefl(n, vWP) * wetS * 0.5;
    } else {                                                                                          // bordür yan yüzü: granit, aşınmış üst kenar, kirli alt
      c = vec3(0.4, 0.4, 0.39) * (0.85 + 0.25 * sh21(floor(wq * vec2(0.9, 1.0)) + 5.0)) * (0.88 + 0.2 * sfbm(wq * 3.0));
      c *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.08, hg));
      c *= 1.0 + 0.25 * (1.0 - smoothstep(0.0, 0.025, vFUv.y < 0.5 ? 9.0 : (1.0 - vFUv.y) * gFS.y));
    }
  } else if (kind == 3.0 || kind == 11.0 || kind == 14.0 || kind == 15.0) {   // ── GÖKDELEN CEPHESİ (tuğla / beton panel; 14-15 = kırık tepe sütunu) ──
    float brick = (kind == 3.0 || kind == 14.0) ? 1.0 : 0.0, ruin = kind >= 14.0 ? 1.0 : 0.0;
    if (side > 0.5) {
      faceFrame();
      float W = gFS.x, FH = gFS.y;
      float lx = (vFUv.x - 0.5) * W;
      vec3 base = diffuseColor.rgb;
      if (brick > 0.5) c = brickWall(wq, base, seed, aaB);
      else {
        c *= 0.9 + 0.2 * sfbm(wq * 0.35 + seed);
        float pj = abs(fract((vWP.y - 1.3) / 3.1) - 0.5) * 3.1;                                       // kat arası panel derzi
        c *= 1.0 - 0.38 * (1.0 - smoothstep(0.0, 0.025, abs(pj - 1.55 + 0.02))) * aaJ;
        float rs = svn(vec2(u * 2.6, vWP.y * 0.12) + seed * 3.0);
        c *= 1.0 - 0.2 * smoothstep(0.5, 0.85, rs) * aaP;                                            // yağmur akıntısı
        c = mix(c, c * vec3(1.08, 1.06, 1.02), smoothstep(0.7, 0.75, sfbm(wq * 0.6 + 12.0)) * 0.6);
      }
      vec3 stone = mix(vec3(0.6, 0.57, 0.52), base * 1.6, 0.25 * (1.0 - brick)) * (0.85 + 0.25 * sfbm(wq * 2.5 + 3.0));   // taş silme / denizlik rengi
      float cols = max(2.0, floor((W - 1.4) / 2.7));
      float ci = clamp(floor(lx / 2.7 + cols * 0.5), 0.0, cols - 1.0);
      float dx = lx - (ci - (cols - 1.0) * 0.5) * 2.7;
      float wsd = sh21(vec2(ci + seed * 3.0, floor((vWP.y - 1.3) / 3.1) + seed));
      if (ruin > 0.5) {                                                                              // kırık tepe: kat döşemesi bantları, açıkta donatı, kömürleşme
        float sl = abs(fract((vWP.y - 3.9) / 3.1) - 0.5) * 3.1;
        c = mix(c, vec3(0.32, 0.31, 0.3) * (0.8 + 0.3 * sfbm(wq * 3.0)), 1.0 - smoothstep(0.16, 0.2, sl));
        c *= 0.7 + 0.3 * sfbm(wq * 0.8 + 11.0);
        c = mix(c, vec3(0.28, 0.12, 0.05), step(0.97, sh21(floor(wq * vec2(5.0, 1.0)))) * (1.0 - smoothstep(0.0, 0.03, abs(fract(wq.x * 5.0) - 0.5) * 0.2)) * 0.8 * near);
        c *= 1.0 - 0.55 * smoothstep(FH - 2.5, FH, vFUv.y * FH);                                     // üste doğru yanık
      } else if (vWP.y > 4.2) {                                                                        // üst katlar: pencere çevresi
        float k = floor((vWP.y - 4.4 + 0.9) / 3.1), y0 = 4.4 + 3.1 * k, dy = vWP.y - y0;
        float row = step(0.0, k) * step(y0, FH - 1.6 - 0.001);
        float inW = step(abs(dx), 0.65) * step(0.0, dy) * step(dy, 1.9) * row;
        float sill = step(abs(dx), 0.8) * step(-0.13, dy) * step(dy, 0.0) * row;
        float sillSh = step(abs(dx), 0.8) * (1.0 - smoothstep(-0.5, -0.13, dy)) * step(-0.5, dy) * step(dy, -0.13) * row;
        float lint = step(abs(dx), 0.82) * step(1.9, dy) * step(dy, 2.14) * row;
        float key = brick * step(abs(dx), 0.11) * step(1.9, dy) * step(dy, 2.26) * row;
        float surr = (1.0 - brick) * step(abs(dx), 0.76) * step(-0.08, dy) * step(dy, 2.0) * row * (1.0 - inW);
        float course = brick * step(0.5, fract(seed * 0.37 + 0.2)) * step(2.6, dy) * step(dy, 2.76) * row;   // kat silmesi (bazı binalar)
        float quoin = brick * step(W * 0.5 - 0.62 + 0.24 * step(0.5, fract(vWP.y / 0.56)), abs(lx));   // köşe taşları (uzun / kısa sıra)
        c = mix(c, stone, max(max(sill, lint), max(key, max(course, quoin))));
        c *= 1.0 - 0.35 * (1.0 - smoothstep(-0.5, -0.13, dy)) * sillSh;                           // denizlik gölgesi
        c *= 1.0 - 0.25 * step(2.14, dy) * (1.0 - smoothstep(2.14, 2.3, dy)) * step(abs(dx), 0.82) * row;   // lento altı gölge
        c = mix(c, c * 0.7 + stone * 0.15, surr);                                                    // beton cephe: pencere çerçeve bandı
        c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.04, min(abs(abs(dx) - 0.8), abs(dy + 0.13)))) * max(sill, lint) * aaJ;
        if (inW > 0.5) {                                                                             // camı patlamış pencere: yanık oda
          vec3 dl = vec3(dot(V, gTu), dot(V, gTv), -dot(V, n));
          c = roomColor(vec3(dx, dy + 0.9, 0.0), dl, wsd, vec3(1.0), 0.0, 0.4 + 0.6 * step(0.93, wsd));
          float fr = 1.0 - step(0.05, 0.65 - abs(dx)) * step(0.05, dy) * step(dy, 1.85);
          c = mix(c, vec3(0.03, 0.025, 0.02), fr * 0.8);
        }
        float plume = step(wsd, 0.16) * row * (1.0 - smoothstep(0.55, 1.0 + 0.25 * (dy - 1.9), abs(dx))) * smoothstep(1.7, 2.2, dy) * (1.0 - smoothstep(3.0, 5.6, dy)) * (0.5 + 0.5 * sfbm(vec2(dx, dy) * 1.3 + wsd * 30.0));
        c *= 1.0 - 0.75 * plume;                                                                     // pencereden çıkan is
      } else {                                                                                        // zemin kat: dükkân cephesi
        float vit = step(abs(dx), 1.0) * step(0.9, vWP.y) * step(vWP.y, 3.2);
        float fasc = step(3.2, vWP.y) * step(vWP.y, 4.2);
        float corn = step(4.2, vWP.y);
        vec3 pier = mix(vec3(0.07, 0.07, 0.075), vec3(0.16, 0.12, 0.08), step(0.6, fract(seed * 0.23))) * (0.8 + 0.4 * sfbm(wq * 1.5));
        pier = mix(pier, c, step(0.75, fract(seed * 0.41)));                                        // bazı binalarda ayak = cephe malzemesi
        c = mix(c, pier, (1.0 - fasc) * (1.0 - corn));
        float fs = sh21(vec2(ci + 0.5, seed + 1.5));
        vec3 board = fs < 0.25 ? vec3(0.22, 0.05, 0.04) : fs < 0.5 ? vec3(0.04, 0.12, 0.07) : fs < 0.75 ? vec3(0.04, 0.06, 0.14) : vec3(0.05, 0.05, 0.05);
        board *= 0.75 + 0.35 * sfbm(wq * 2.0 + fs * 9.0);
        float bIn = step(abs(dx), 1.25) * step(3.32, vWP.y) * step(vWP.y, 4.08);
        vec2 gq = vec2((dx + 1.0) / 0.26, (vWP.y - 3.5) / 0.4);                                     // boyalı tabela yazısı: 3×5 bit maskeli sözde harfler
        float gid = floor(gq.x), on = step(0.0, gq.x) * step(gq.x, 7.7) * step(0.0, gq.y) * step(gq.y, 1.0) * step(0.3, fs);
        vec2 gc = floor(fract(gq) * vec2(4.0, 5.0)); gc.x = min(gc.x, 2.0);
        float bit = step(0.42, sh21(vec2(gid + fs * 31.0, gc.x * 5.0 + gc.y))) * step(fract(gq.x) * 4.0, 3.0);
        vec3 ink = mix(vec3(0.75, 0.68, 0.5), vec3(0.85, 0.2, 0.12), step(0.7, fs)) * (0.6 + 0.4 * sfbm(wq * 3.0));
        board = mix(board, ink, bit * on * aaB * 0.85);
        c = mix(c, mix(stone * 0.5, board, bIn), fasc);                                              // tabela bandı + çıta
        c = mix(c, stone, corn);
        c *= 1.0 - 0.3 * corn * (1.0 - smoothstep(4.2, 4.27, vWP.y));
        if (vit > 0.5) {                                                                             // vitrin boşluğu (kutusu yoksa): karanlık dükkân içi
          vec3 dl = vec3(dot(V, gTu), dot(V, gTv), -dot(V, n));
          c = roomColor(vec3(dx * 1.3, vWP.y - 0.4, 0.0), dl, fs, vec3(1.0), 0.0, 0.5);
        }
        vec2 tg = tagMask(wq - vec2(0.0, 0.8), seed, 0.42) * (1.0 - vit) * step(vWP.y, 3.1) * step(0.75, vWP.y) * aaP;
        c = mix(c, tagColor(sh21(floor((wq - vec2(0.0, 0.8)) / vec2(3.0, 1.6)) + seed)) * (0.7 + 0.3 * svn(wq * 9.0)), tg.x * 0.8);     // grafiti (solmuş)
        c = mix(c, vec3(0.03), tg.y * 0.75);
      }
      float st = sfbm(vec2(u * 0.8, vWP.y * 0.05) + seed * 1.7);                                  // is akıntıları (yangından)
      c *= 1.0 - 0.32 * smoothstep(0.55, 0.85, st);
      c *= 1.0 - 0.4 * smoothstep(0.62, 0.86, sfbm(wq * 0.09 + seed * 3.1 + 50.0));              // büyük yanık lekeleri
      float cm = smoothstep(0.62, 0.75, sfbm(wq * 0.2 + 5.0)) * near;
      if (cm > 0.01) { float ck = scrack(wq * 0.45 + 0.5 * vec2(svn(wq * 0.5), svn(wq * 0.5 + 3.0)) + 40.0); c *= 1.0 - 0.3 * (1.0 - smoothstep(0.004, 0.018, ck)) * cm; }
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 1.0, hg));
      c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.35, edgeDist())) * (1.0 - ruin);                    // dış köşe kirlenmesi
    } else if (up > 0.5) {                                     // çatı: katran + çakıl, kenarda parapet izi
      c = mix(c, vec3(0.12, 0.12, 0.125), 0.55) * (0.82 + 0.36 * sfbm(p * 0.35 + seed));
      c *= 1.0 + (sh21(floor(p * 14.0)) - 0.5) * 0.25 * aaP;
      if (ruin > 0.5) c = mix(c, vec3(0.2, 0.195, 0.19) * (0.7 + 0.5 * sfbm(p * 2.0)), 0.45);
      gRough = 0.95;
    } else c *= 0.75;
  } else if (kind == 4.0) {                                    // ── DÜZ BETON (bariyer, kaide, ev duvarı) ──
    faceFrame();
    c *= 0.88 + 0.24 * sfbm(wq * 0.5 + p * 0.3 + seed);
    c *= 1.0 + (svn(wq * 7.0 + p * 7.0) - 0.5) * 0.08 * aaP;
    c *= 1.0 - 0.3 * smoothstep(0.6, 0.85, sfbm(vec2(u * 0.9, vWP.y * 0.12) + seed * 1.3));
    if (side > 0.5) c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.9, hg));
    float e = edgeDist();
    c *= 1.0 + 0.18 * (1.0 - smoothstep(0.0, 0.03, e)) * aaJ * step(0.5, svn(wq * 3.0 + p * 2.0));   // kenar kırıkları (açık)
    c *= 1.0 - 0.15 * (1.0 - smoothstep(0.03, 0.15, e));
    gRough = 0.9;
  } else if (kind == 5.0 || kind == 12.0) {                    // ── PENCERE CAMI (karanlık 5 / ışıklı 12): çerçeve, kanat, oda-içi, perde / jaluzi / TV, kırık, tahta ──
    faceFrame();
    float W = gFS.x, Hh = gFS.y;
    float lit = kind == 12.0 ? 1.0 : 0.0;
    vec3 tint = lit > 0.5 ? diffuseColor.rgb : vec3(1.0, 0.75, 0.45);
    if (side > 0.5 && Hh > 1.2 && W > 0.5) {
      float lx = (vFUv.x - 0.5) * W, ly = vFUv.y * Hh;
      vec3 dl = vec3(dot(V, gTu), dot(V, gTv), -dot(V, n));
      vec2 wc = vWP.xz - gTu.xz * lx;                                                                 // pencere merkezi (tohum: yuvarlanmış konum + parça tohumu)
      float sd = fract(seed * 0.0625 + 0.9 * sh21(vec2(floor((vWP.y - ly) * 2.0 + 0.37), floor(dot(wc, vec2(1.7, 2.3)) * 0.5 + 0.37))));
      vec3 em; float rgh = 0.12;
      c = windowPane(lx, ly, W, Hh, dl, sd, lit, tint, n, em, rgh);
      gEmis = em; gRough = rgh;
      if (hm.x > 0.5) { c = roomColor(vec3(hc.x * 0.5, hc.y + 1.6, 0.0), dl, hc.w * 0.137 + 0.21, vec3(1.0), 0.0, 0.4 + 0.6 * hc.z); gEmis = c * hc.z * 1.2; c *= 0.25; gRough = 0.95; }
      else if (hm.y > 0.0) { c *= 1.0 - 0.85 * hm.y; gEmis *= 1.0 - hm.y; }
      c *= 1.0 - 0.7 * hm.z; gEmis *= 1.0 - 0.8 * hm.z;
    } else if (side > 0.5) {                                                                           // küçük cam (araç / kabin) ya da pencere kalınlığı (pervaz)
      if (Hh > 1.2 || W < 0.2) { c = vec3(0.12, 0.11, 0.1) * (lit > 0.5 ? 1.5 : 0.7); gRough = 0.8; }
      else { c *= 0.75 + 0.5 * svn(wq * vec2(0.6, 0.25) + seed * 5.0); gRough = 0.12; gEmis = nightRefl(n, vWP) * fresnel(n, vWP) * 1.2 + (lit > 0.5 ? diffuseColor.rgb * 0.8 : vec3(0.0)); }
    } else { c = vec3(0.08); gRough = 0.8; if (lit > 0.5) gEmis = diffuseColor.rgb * 0.15; }
  } else if (kind == 13.0) {                                   // ── DÜKKÂN VİTRİNİ: kepenk (oluklu sac + grafiti) / kırık vitrin + dükkân içi / floresan / kontrplak ──
    faceFrame();
    float W = gFS.x, Hh = gFS.y;
    if (side > 0.5 && Hh > 1.5) {
      float lx = (vFUv.x - 0.5) * W, ly = vFUv.y * Hh;
      float sd = sh21(vec2(floor(dot(vWP.xz - gTu.xz * lx, vec2(0.71, 1.37)) + 0.37), seed));
      vec3 dl = vec3(dot(V, gTu), dot(V, gTv), -dot(V, n));
      float v = floor(sd * 10.0);
      float shut = v < 4.0 ? 1.0 : v < 5.0 ? 0.62 : 0.0;                                             // kepenk kapalı / yarı açık
      float shutM = step(Hh * (1.0 - shut), ly) * step(0.001, shut);
      vec3 inside = roomColor(vec3(lx * 1.3, ly + 0.1, 0.0), dl, sd, vec3(0.75, 0.95, 1.0), 0.0, 0.0);
      float fl = 0.0;
      if (v > 6.5 && v < 8.5) { fl = step(0.25, svn(vec2(uTime * 9.0, sd * 50.0))) * (0.6 + 0.4 * step(0.08, fract(uTime * 0.37 + sd))); inside = roomColor(vec3(lx * 1.3, ly + 0.1, 0.0), dl, sd, vec3(0.32, 0.42, 0.46), 0.75 * fl + 0.08, 0.0); }   // titrek floresan (soğuk, loş)
      float frame = 1.0 - step(0.07, W * 0.5 - abs(lx)) * step(0.07, ly) * step(ly, Hh - 0.07);
      vec3 frC = vec3(0.35, 0.36, 0.38) * (0.7 + 0.4 * svn(vec2(lx, ly) * 5.0));                  // alüminyum doğrama
      float ck = scrack(vec2(lx, ly) * 3.0 + sd * 21.0);
      float holeG = step(0.5, svn(vec2(lx, ly) * 1.7 + sd * 5.0));
      vec3 glassC = inside + vec3(0.1, 0.11, 0.12) * (1.0 - smoothstep(0.0, 0.03, ck)) * (1.0 - holeG) * aaB;
      vec3 em = nightRefl(n, vWP) * (1.0 - holeG) * 1.3 * fresnel(n, vWP) + (v > 6.5 && v < 8.5 ? inside * vec3(0.5, 0.62, 0.6) : vec3(0.0));
      c = mix(glassC, frC, frame);
      if (frame > 0.5) em = vec3(0.0);
      if (v > 8.5) {                                                                                // kontrplakla kapatılmış + sprey yazı
        vec3 ply = vec3(0.36, 0.27, 0.16) * (0.8 + 0.3 * sfbm(vec2(lx * 0.8, ly * 2.0) + sd * 9.0)) * (0.92 + 0.12 * svn(vec2(lx * 2.0, ly * 25.0)));
        ply *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.02, abs(fract((lx + W) / 1.22) - 0.5) * 1.22 - 0.59)) * aaJ;
        vec2 tg = tagMask(vec2(lx + 1.5, ly), sd * 31.0, 0.9);
        c = mix(ply, tagColor(fract(sd * 7.7)), tg.x * 0.85); c = mix(c, vec3(0.03), tg.y * 0.8); em = vec3(0.0); gRough = 0.9;
      }
      if (shutM > 0.5) {                                                                            // kepenk: yatay oluklar, alt çıta, kilit, pas, grafiti
        float rib = fract(ly / 0.085);
        vec3 sc = mix(vec3(0.32, 0.33, 0.34), vec3(0.18, 0.26, 0.24), step(0.6, fract(sd * 7.0))) * (0.85 + 0.25 * sfbm(vec2(lx, ly) * 1.2 + sd * 4.0));
        sc *= 0.78 + 0.32 * smoothstep(0.0, 0.5, rib) * (1.0 - smoothstep(0.6, 1.0, rib));
        float rs = sfbm(vec2(lx * 6.0, ly * 0.6) + 31.0 + sd * 7.0) * (0.55 + 0.45 * smoothstep(0.0, 1.2, Hh - ly));
        sc = mix(sc, vec3(0.2, 0.1, 0.05) * (0.7 + 0.5 * svn(vec2(lx, ly) * 7.0)), smoothstep(0.6, 0.78, rs) * 0.6);   // pas akıntısı (çizgisel)
        float bot = Hh * (1.0 - shut);
        sc = mix(sc, vec3(0.12), step(ly, bot + 0.09) * step(bot, ly));
        vec2 tg = tagMask(vec2(lx + 1.5, ly - 0.3), sd * 13.0 + 2.0, 0.75) * aaP;
        sc = mix(sc, tagColor(fract(sd * 9.1)) * (0.8 + 0.2 * svn(vec2(lx, ly) * 8.0)), tg.x * 0.85);
        sc = mix(sc, vec3(0.03), tg.y * 0.8);
        c = sc; em = vec3(0.0); gRough = 0.55; gMetal = 0.35;
      }
      gEmis = em; if (gRough < 0.0) gRough = 0.15;
      if (hm.x > 0.5) { c = vec3(0.02); gEmis = vec3(0.0); }
    } else { c = vec3(0.2, 0.21, 0.22) * (0.8 + 0.3 * svn(wq * 4.0)); gRough = 0.6; }
  } else if (kind == 6.0) {                                    // ── BOYALI METAL (tabela, kamyon kasası, metro çatısı, vinç) ──
    faceFrame();
    c *= 0.9 + 0.16 * sfbm(wq * 1.3 + p * 0.2);
    if (side > 0.5 && gFS.y > 1.4 && gFS.x > 2.0) { float rb = fract(vFUv.x * gFS.x / 0.28); c *= 0.8 + 0.28 * smoothstep(0.0, 0.25, rb) * (1.0 - smoothstep(0.55, 0.8, rb)) * aaB + 0.1 * (1.0 - aaB); }   // büyük yüz: oluklu sac (kamyon kasası / konteyner)
    float lum = dot(diffuseColor.rgb, vec3(0.333));
    float burnt = smoothstep(0.42, 0.7, sfbm(p * 0.45 + vWP.y * 0.35 + seed * 2.3));
    float rust = smoothstep(0.62, 0.8, sfbm(wq * 1.1 + p * 0.5 + 61.0));
    c = mix(c, vec3(0.3, 0.12, 0.05) * min(1.0, lum * 3.0 + 0.15) * (0.7 + 0.5 * svn(p * 6.0 + vWP.y * 4.0)), rust * 0.7);
    c = mix(c, vec3(0.045, 0.04, 0.038) * (0.8 + 0.4 * svn(wq * 4.0)), burnt * 0.7);
    float e = edgeDist();
    c *= 1.0 + 0.3 * (1.0 - smoothstep(0.0, 0.025, e)) * aaJ * (1.0 - burnt);                         // aşınmış kenar (boya kalkmış, açık)
    c *= 1.0 - 0.18 * (1.0 - smoothstep(0.02, 0.12, e));
    if (side > 0.5) c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.5, hg));
    gRough = mix(0.42, 0.92, max(burnt, rust));
    gMetal = 0.2 * (1.0 - max(burnt, rust));
  } else if (kind == 7.0) {                                    // ── MOLOZ: kırık beton (agrega + donatı), tuğla parçaları, kum torbası ──
    faceFrame();
    vec3 b0 = diffuseColor.rgb;
    float mx = max(b0.r, max(b0.g, b0.b)), mn = min(b0.r, min(b0.g, b0.b)), sat = (mx - mn) / max(mx, 1e-3);
    vec2 fq = side > 0.5 ? wq : p;
    float e = edgeDist();
    if (sat > 0.3 && mx > 0.2) {                                                                     // kum torbası / hesco: dokuma kumaş, dikiş
      c *= 0.86 + 0.2 * sfbm(fq * 2.0 + seed);
      c *= 1.0 - 0.08 * step(0.5, fract(fq.x * 30.0)) * aaB;
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.07, e));
      gRough = 0.97;
    } else if (b0.r > b0.b * 1.18) {                                                                 // yıkıntı parçası: yer yer harçlı tuğla yüzü + kırık beton + toz
      vec2 bp = fq / vec2(0.23, 0.08); bp.x += 0.5 * mod(floor(bp.y), 2.0);
      vec2 bf = fract(bp), bi = floor(bp);
      float ln = min(min(bf.x, 1.0 - bf.x) * 0.23, min(bf.y, 1.0 - bf.y) * 0.08);
      vec3 bc = b0 * vec3(1.05, 0.85, 0.75) * (0.65 + 0.55 * sh21(bi + seed));
      vec3 brickC = mix(bc, vec3(0.2, 0.19, 0.17), (1.0 - smoothstep(0.005, 0.014, ln)) * 0.8 * aaB + 0.3 * (1.0 - aaB));
      vec3 concC = vec3(0.24, 0.23, 0.22) * (0.7 + 0.5 * sfbm(fq * 1.6 + seed)) * (1.0 + (svn(fq * 14.0) - 0.5) * 0.3 * aaP);
      float bm = smoothstep(0.45, 0.6, sfbm(fq * 0.7 + seed * 2.0)) * side;
      c = mix(concC, brickC, bm);
      c = mix(c, vec3(0.27, 0.26, 0.24) * (0.8 + 0.3 * svn(fq * 3.0)), smoothstep(0.6, 0.8, sfbm(fq * 1.2 + seed * 3.0)) * 0.7);   // toz / harç kümeleri
      c = mix(c, c * 1.3 + 0.02, (1.0 - smoothstep(0.0, 0.05, e)) * step(0.45, svn(fq * 5.0)) * aaJ);
      gRough = 0.96;
    } else {                                                                                         // beton parça: agrega, açık kırık kenar, donatı
      c *= 0.72 + 0.56 * sfbm(fq * 1.6 + vWP.y * 1.3 + seed);
      c *= 1.0 + (svn(fq * 14.0) * 0.6 + svn(fq * 31.0) * 0.4 - 0.5) * 0.32 * aaP;
      c = mix(c, c * 1.35 + 0.03, (1.0 - smoothstep(0.0, 0.05, e)) * step(0.45, svn(fq * 5.0)) * aaJ);
      c = mix(c, vec3(0.14, 0.06, 0.03), step(0.996, sh21(floor(fq * vec2(14.0, 3.0)) + seed)) * near * 0.6 * side);   // paslı donatı ucu
      gRough = 0.96;
    }
    if (up > 0.5) c = mix(c, vec3(0.3, 0.29, 0.27), 0.28 * sfbm(p * 0.8));                     // üstte toz
    c *= 1.0 - 0.22 * (1.0 - smoothstep(0.02, 0.2, e)) * side;                                     // kenar ortam kapanması
  } else if (kind == 8.0) {                                    // ── DEMİR ──
    c *= 0.85 + 0.3 * sfbm(wq * 2.0 + p);
    c = mix(c, c * vec3(1.5, 0.9, 0.6), smoothstep(0.62, 0.8, sfbm(wq * 2.5 + 9.0)) * 0.6);
    gRough = 0.55; gMetal = 0.3;
  } else if (kind == 9.0) {                                    // ── YOL BOYASI: aşınmış ──
    float wear = smoothstep(0.45, 0.8, sfbm(p * 1.4 + 5.0) + 0.2 * svn(p * 11.0));
    c = mix(c * 0.85, vec3(0.05, 0.055, 0.06), wear * 0.75);
    gRough = 0.6;
  } else if (kind == 10.0) {                                   // ── AHŞAP ──
    faceFrame();
    float pv = side > 0.5 ? vWP.y : vWP.x;
    float pl = floor(pv / 0.2), edge = abs(fract(pv / 0.2) - 0.5);
    c *= 0.86 + 0.26 * sh21(vec2(pl, seed));
    c *= 0.92 + 0.14 * mix(0.5, svn(vec2((side > 0.5 ? u : vWP.z) * 2.2, pv * 38.0)), aaP);
    c *= 1.0 - 0.34 * smoothstep(0.44, 0.5, edge) * aaP;
    c *= 1.0 - 0.3 * smoothstep(0.6, 0.85, sfbm(p * 0.8 + vWP.y + seed));
    c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.05, edgeDist()));
  } else if (kind == 16.0) {                                   // ── SAÇAK (kornis): diş sırası, oluk gölgesi, alın, ışık alan üst dudak ──
    faceFrame();
    if (side > 0.5) {
      float v = vFUv.y;
      c *= 0.85 + 0.25 * sfbm(wq * 1.5 + seed);
      float dent = step(v, 0.3) * step(0.5, fract(u / 0.22));
      c *= mix(1.0, 0.55, step(v, 0.3) * (1.0 - dent));                                           // diş araları
      c *= 1.0 - 0.45 * step(0.3, v) * step(v, 0.4);                                              // oluk gölgesi
      c *= 1.0 + 0.22 * step(0.85, v);
      c *= 1.0 - 0.5 * smoothstep(0.55, 0.85, sfbm(vec2(u * 0.6, vWP.y) + seed * 7.0));             // is
    } else if (down > 0.5) c *= 0.35;
    else { c *= 0.7 + 0.3 * sfbm(p * 1.3); }
  } else if (kind == 17.0) {                                   // ── KAİDE (granit blok): derz, cilalı, sıçrama kiri, grafiti ──
    faceFrame();
    if (side > 0.5) {
      float j = abs(fract(u / 1.25) - 0.5) * 1.25;
      c = vec3(0.17, 0.17, 0.18) * (0.8 + 0.35 * sh21(vec2(floor(u / 1.25), seed))) * (0.9 + 0.2 * svn(wq * 9.0));
      c *= 1.0 - 0.5 * (1.0 - smoothstep(0.004, 0.012, abs(j - 0.62))) * aaJ;
      c *= 1.0 + 0.3 * step(0.62, vFUv.y) * step(vFUv.y, 0.7);
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.35, hg));
      vec2 tg = tagMask(wq * 1.6 + vec2(0.0, 0.5), seed + 3.0, 0.3) * aaP;
      c = mix(c, tagColor(sh21(floor((wq * 1.6 + vec2(0.0, 0.5)) / vec2(3.0, 1.6)) + seed + 3.0)) * 0.9, tg.x * 0.8);
      gRough = 0.5; gEmis = nightRefl(n, vWP) * 0.3;
    } else c *= 0.6 + 0.3 * sfbm(p * 2.0);
  } else if (kind == 18.0) {                                   // ── TENTE: solmuş çizgili kumaş, yırtık, is ──
    faceFrame();
    float st = step(0.5, fract((gFS.x > gFS.y ? vFUv.x * gFS.x : vFUv.y * gFS.y) / 0.32));      // çizgiler uzun eksen boyunca (yokuş aşağı)
    c = mix(c, c * 0.35 + vec3(0.12, 0.11, 0.1), st * step(0.4, fract(seed * 0.29 + 0.1)));
    c *= 0.8 + 0.35 * sfbm(vec2(vFUv.x * gFS.x, vFUv.y * gFS.y) * 1.5 + seed);
    c *= 1.0 - 0.6 * smoothstep(0.55, 0.85, sfbm(vec2(vFUv.x * gFS.x * 0.7, vFUv.y * 2.0) + seed * 5.0));   // is / yanık
    c *= 1.0 - 0.06 * sin(vFUv.y * gFS.y * 40.0) * aaB;
    if (down > 0.5) c *= 0.5;
    gRough = 0.95;
  } else if (kind == 19.0) {                                   // ── YANIK ARAÇ: kömürleşmiş boya, kül, pas, kalan boya kenarları, panel derzi ──
    faceFrame();
    float lum = dot(diffuseColor.rgb, vec3(0.333));
    float burnR = 0.35 + 0.65 * smoothstep(0.1, 0.5, sfbm(p * 0.16 + 13.0));                                     // araç ölçeğinde yanma derecesi (tüm araç aynı)
    float loc = sfbm(wq * 1.2 + p * 0.7 + vWP.y * 0.6) - 0.5;
    float heat = smoothstep(0.35, 1.25, hg + 0.6 * loc + 0.5 * up);                                 // ısı yükselir: tavan / kaput / üst kenar yanık, alt kapı panelinde boya kalır
    float charM = clamp(burnR * (heat * 1.25 + 0.15), 0.0, 1.0);
    float ash = charM * smoothstep(0.5, 0.72, sfbm(wq * 2.3 + p * 1.7 + 7.0)) * (0.35 + 0.65 * up);
    vec3 paint = c * (0.85 + 0.2 * sfbm(wq * 3.0));
    float streak = sfbm(vec2(u * 3.0, vWP.y * 0.4) + seed);                                        // dikey is akıntısı (pencere / kapı üstünden)
    paint *= 1.0 - burnR * (0.35 * smoothstep(0.2, 0.9, hg) + 0.35 * smoothstep(0.5, 0.8, streak) * side);
    float rv = sfbm(wq * 0.9 + p * 0.6 + 17.0);
    vec3 burntMetal = mix(vec3(0.085, 0.045, 0.028), vec3(0.03, 0.028, 0.027), smoothstep(0.2, 0.6, rv)) * (0.8 + 0.4 * svn(wq * 12.0 + p * 6.0));   // koyu pas ↔ kömür (yumuşak geçiş)
    burntMetal = mix(burntMetal, vec3(0.2, 0.09, 0.04), smoothstep(0.62, 0.8, sfbm(wq * 2.2 + p * 1.4 + 3.0)) * 0.6);                           // yer yer taze pas
    c = mix(paint, burntMetal, charM * step(0.06, lum));
    c = mix(c, vec3(0.26, 0.255, 0.25) * (0.7 + 0.5 * svn(wq * 11.0)), ash * 0.75);
    float rust = charM;
    float e = edgeDist();
    c *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.018, e)) * aaJ;                                     // panel derzi / kenar
    if (side > 0.5) c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.45, hg));
    gRough = mix(0.45, 0.95, max(charM, rust));
    gMetal = 0.25 * (1.0 - max(charM, rust)) * step(0.12, lum);
  } else if (kind == 20.0) {                                   // ── RÖGAR KAPAĞI: dökme demir desen, kenar halkası, yazı halkası ──
    if (up > 0.5) {
      vec2 q = vFUv - 0.5; float r = length(q) * 2.0;
      float ring = step(0.86, r), txt = step(0.56, r) * step(r, 0.72);
      vec2 g = mat2(0.707, 0.707, -0.707, 0.707) * q * 22.0;
      float grid = step(0.75, max(abs(fract(g.x) - 0.5), abs(fract(g.y) - 0.5)) * 2.0);
      c = vec3(0.05, 0.05, 0.052) * (0.8 + 0.4 * svn(q * 20.0));
      c *= 1.0 + 1.6 * grid * (1.0 - ring) * (1.0 - txt) * aaB;
      c *= 1.0 + 0.7 * txt * step(0.5, fract(atan(q.y, q.x) * 6.0)) * step(0.6, fract(r * 14.0)) * aaB;
      c *= 1.0 + 0.6 * ring;
      c = mix(c, vec3(0.12, 0.06, 0.03), smoothstep(0.68, 0.85, sfbm(q * 14.0 + seed)) * 0.4);
      gRough = 0.5; gMetal = 0.4; gEmis = nightRefl(n, vWP) * 0.25;
    } else c *= 0.6;
  } else if (kind == 21.0) {                                   // ── YANGIN MERDİVENİ: ızgara sahanlık, siyah boya, pas akıntısı ──
    faceFrame();
    c = vec3(0.05, 0.05, 0.055) * (0.8 + 0.3 * sfbm(wq * 3.0 + p));
    if (up > 0.5 || down > 0.5) { float gr = step(0.55, fract(vFUv.x * gFS.x / 0.05)); c *= mix(1.0, 0.35, gr * aaB) * (up > 0.5 ? 1.15 : 0.6); }      // sahanlık ızgarası
    c = mix(c, vec3(0.3, 0.12, 0.05) * (0.6 + 0.5 * svn(wq * 9.0)), smoothstep(0.6, 0.8, sfbm(wq * 2.0 + p * 1.5 + 4.0)) * 0.7);
    gRough = 0.6; gMetal = 0.35;
  } else if (kind == 22.0) {                                   // ── UFUK SİLÜETİ: kat kat ışıklı pencere ızgarası, karartma blokları, tepe ikaz lambası ──
    faceFrame();
    if (side > 0.5) {
      vec2 g = vec2(u / 1.7, vWP.y / 3.2); vec2 gi = floor(g), gf = fract(g);
      float win = step(0.18, gf.x) * step(gf.x, 0.82) * step(0.22, gf.y) * step(gf.y, 0.78);
      float hsh = sh21(gi + seed * 13.0);
      float black = smoothstep(0.42, 0.55, sfbm(gi * vec2(0.13, 0.2) + seed * 5.0));             // elektriği kesik bölgeler
      float lit = step(0.8, hsh) * (1.0 - black);
      vec3 lc = fract(hsh * 37.0) < 0.6 ? vec3(1.0, 0.68, 0.3) : fract(hsh * 37.0) < 0.85 ? vec3(0.7, 0.85, 1.0) : vec3(1.0, 0.35, 0.1);
      c = c * (0.7 + 0.3 * svn(gi * 0.3)) + vec3(0.012, 0.014, 0.02) * win;
      gEmis = lc * lit * win * (0.25 + 0.45 * fract(hsh * 91.0));
      float top = step(1.0 - 0.25 / max(gFS.y, 1.0), vFUv.y) * step(abs(vFUv.x - 0.5) * gFS.x, 0.3);
      gEmis += vec3(1.0, 0.05, 0.02) * top * 3.0 * step(0.5, fract(uTime * 0.5 + seed * 0.13));    // uçak ikaz lambası
      gRough = 0.9;
    } else c *= 0.6;
  }
  else if (kind == 23.0) {                                     // ── PARK ZEMİNİ: kuru çim tutamları, çamurlu toprak, dökülmüş yaprak, taş bordür ──
    faceFrame();
    if (up > 0.5) {
      float g = sfbm(p * 0.35 + 3.0), tuft = svn(p * 9.0) * 0.6 + svn(p * 23.0) * 0.4;
      vec3 dirt = vec3(0.13, 0.11, 0.08) * (0.8 + 0.4 * sfbm(p * 1.3));
      vec3 grass = mix(vec3(0.17, 0.16, 0.09), vec3(0.11, 0.13, 0.07), svn(p * 0.6)) * (0.75 + 0.5 * tuft);
      c = mix(dirt, grass, smoothstep(0.4, 0.6, g + 0.25 * (tuft - 0.5)));
      c = mix(c, vec3(0.2, 0.1, 0.04) * (0.7 + 0.6 * sh21(floor(p * 12.0))), step(0.9, sh21(floor(p * 6.0) + 3.0)) * near * 0.7);   // dökülmüş yaprak
      float mud = smoothstep(0.66, 0.7, sfbm(p * 0.18 + 41.0));
      c = mix(c, vec3(0.05, 0.045, 0.04), mud * 0.8);
      float e = edgeDist(), curb = 1.0 - smoothstep(0.24, 0.27, e);
      c = mix(c, vec3(0.36, 0.35, 0.33) * (0.85 + 0.25 * sh21(floor(p * 1.2) + 2.0)), curb);
      gRough = mix(0.97, 0.35, mud * (1.0 - curb)); gEmis = nightRefl(n, vWP) * mud * 0.7 * (1.0 - curb);
    } else c = vec3(0.34, 0.33, 0.31);
  }
  if (holeK && kind != 5.0 && kind != 12.0 && kind != 13.0) {  // delik: cephede yanık oda + kenar + is
    if (hm.x > 0.5) {
      vec3 dl = vec3(dot(V, vec3(wt.x, 0.0, wt.y)), V.y, -dot(V, n));
      c = roomColor(vec3(hc.x * 0.5, hc.y + 1.6, 0.0), dl, hc.w * 0.137 + 0.21, vec3(1.0), 0.0, 0.4 + 0.6 * hc.z);
      gEmis = c * hc.z * 1.2; c *= 0.25; gRough = 0.95;
    } else {
      vec3 rimC = mix(vec3(0.05, 0.045, 0.04), vec3(0.32, 0.3, 0.28) * (0.7 + 0.5 * sh21(floor(wq * 9.0))), step(0.6, svn(wq * 4.0)));   // kırık kenar: açık beton parçaları + kömür
      c = mix(c, rimC, hm.y * 0.9);
      c *= 1.0 - 0.8 * hm.z;
    }
  }
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}`;

export function makeCityMaterial() {
  // ortam haritasının aynasal yansıması kullanılmaz (aşağıda radiance = 0): yerine gölgelendiricide sahte gece göğü yansıması (nightRefl)
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = cityTime;
    sh.uniforms.uHoles = cityHoles;
    sh.uniforms.uHoleN = cityHoles.n;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nattribute float aGnd;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vKind;\nvarying float vGnd;\nvarying vec2 vFUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvKind = aKind;\nvGnd = aGnd;\nvFUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
varying vec3 vWN;
varying float vKind;
varying float vGnd;
varying vec2 vFUv;
uniform float uTime;
uniform vec4 uHoles[${MAXH}];
uniform int uHoleN;
float gRough = -1.0;
float gMetal = -1.0;
vec3 gEmis = vec3(0.0);
${GLSL_NOISE}
${GLSL_CITY}`)
      .replace('#include <color_fragment>', FRAG)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gRough >= 0.0) roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gMetal >= 0.0) metalnessFactor = gMetal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmis;')
      .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\nradiance = vec3(0.0);');          // ortam haritasının yansıması atılır, dağınık ışığı kalır
  };
  material.customProgramCacheKey = () => 'city-surface-v5';
  return material;
}
