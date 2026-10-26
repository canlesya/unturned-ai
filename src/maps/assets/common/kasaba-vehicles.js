// Kasaba asset kiti · ARAÇLAR (paylaşılabilir). 12.168
// Eksen hizalı (+X ileri; ry yalnız 0 / ±π/2 / π), parçalar iç içe girmez: gövde orta şasi (tekerlekler arasında) + yan etekler (teker
// yuvalarının dışında) + çamurluk (teker üstünde) + kabin (eğik camlı dışbükey kesit) + tavan + tampon. Tekerlek yuvada, gövdeye değer.
// Çarpışma: şasi / etek / çamurluk / tavan kutuları birebir, kabin için camın içinde kalan dikdörtgen. Hepsi 'veh' etiketli.
import { boxR, extrude, shade, NC } from './kasaba-shapes.js';
import { footW } from './kasaba-props.js';

const V = { tag: 'veh' };
// tekerlek: x eksenine dik (z boyunca kalınlık) sekizgen; jant kapağı dış yüzde
function wheel(b, S, x, z0, z1, r, out) {
  const zc = (z0 + z1) / 2, w = z1 - z0;
  b.cyl(x, r, zc, r, r, w, '#1c1c1e', { seg: 8, rx: Math.PI / 2, center: true, collide: false, kind: S.k.plain });
  b.collide(x, r - 0.7 * r, zc, 1.4 * r, 1.4 * r, w * 0.98, 'veh');                 // sekizgen tekerin içindeki kare
  const hz = out > 0 ? z1 : z0;
  b.cyl(x, r, hz + out * 0.01, r * 0.5, r * 0.5, 0.02, '#aab0b8', { seg: 8, rx: Math.PI / 2, center: true, collide: false, kind: S.k.metal });
}

// gövde ailesi: L (boy), W (en), axles [x...], r (teker), y0 (şasi altı), yb (gövde üstü), cab: kabin profili [[x,y]...] (dışbükey), roof: [x0,x1]
function body(b, S, o) {
  const { L, W, axles, r, y0, yb, col, wreck } = o;
  const tw = 0.22, zi = W / 2 - tw, arch = r + 0.04;
  const dark = shade(col, 0.55);
  // orta şasi (tekerler arası)
  boxR(b, -L / 2, L / 2, y0, yb, -zi, zi, col, S.k.plain, V);
  for (const sg of [-1, 1]) {
    const za = sg < 0 ? -W / 2 : zi, zb = sg < 0 ? -zi : W / 2;
    let cur = -L / 2;
    for (const ax of [...axles].sort((p, q) => p - q)) {
      if (ax - arch > cur + 1e-3) boxR(b, cur, ax - arch, y0, yb, za, zb, col, S.k.plain, V);
      boxR(b, ax - arch, ax + arch, 2 * r + 0.04, yb, za, zb, col, S.k.plain, V);            // çamurluk
      cur = ax + arch;
    }
    if (L / 2 > cur + 1e-3) boxR(b, cur, L / 2, y0, yb, za, zb, col, S.k.plain, V);
    if (!wreck) for (const ax of axles) wheel(b, S, ax, za, zb, r, sg);
  }
  // tamponlar (gövde ön / arka yüzüne yapışık)
  boxR(b, L / 2, L / 2 + 0.08, y0 + 0.05, y0 + 0.25, -W / 2 + 0.05, W / 2 - 0.05, '#2a2b2e', S.k.plain, NC);
  boxR(b, -L / 2 - 0.08, -L / 2, y0 + 0.05, y0 + 0.25, -W / 2 + 0.05, W / 2 - 0.05, '#2a2b2e', S.k.plain, NC);
  // farlar / stoplar
  for (const sg of [-1, 1]) {
    boxR(b, L / 2, L / 2 + 0.02, yb - 0.25, yb - 0.1, sg < 0 ? -W / 2 + 0.12 : W / 2 - 0.42, sg < 0 ? -W / 2 + 0.42 : W / 2 - 0.12, wreck ? '#4a4a48' : '#f2efe0', S.k.plain, NC);
    boxR(b, -L / 2 - 0.02, -L / 2, yb - 0.25, yb - 0.1, sg < 0 ? -W / 2 + 0.12 : W / 2 - 0.36, sg < 0 ? -W / 2 + 0.36 : W / 2 - 0.12, wreck ? '#3a2a28' : '#b02a20', S.k.plain, NC);
  }
  return dark;
}

// ── binek araç (sedan / hatchback) ──
export function car(b, S, x, z, ry = 0, col = '#2c5aa0', { wreck = false, hatch = false } = {}) {
  let fp;
  b.with(x, 0, z, ry, () => b.obj(wreck ? 'araç:enkaz' : 'araç', () => {
    const L = hatch ? 3.9 : 4.4, W = 1.8, r = 0.33, y0 = wreck ? 0.1 : 0.28, yb = wreck ? 0.82 : 0.95;
    const c = wreck ? shade(col, 0.55) : col;
    body(b, S, { L, W, axles: hatch ? [-1.25, 1.2] : [-1.35, 1.35], r: wreck ? 0.25 : r, y0, yb, col: c, wreck });
    if (wreck) for (const ax of hatch ? [-1.25, 1.2] : [-1.35, 1.35]) for (const sg of [-1, 1]) boxR(b, ax - 0.18, ax + 0.18, 0, y0, sg * 0.55 - 0.12, sg * 0.55 + 0.12, '#2a2a2a', S.k.plain);   // jant / taş üstünde
    // kabin (koyu cam) + tavan
    const fx = hatch ? 0.75 : 0.95, bx = hatch ? -1.7 : -1.2, ch = wreck ? 0.38 : 0.5;
    const prof = hatch ? [[bx, yb], [fx + 0.4, yb], [fx, yb + ch], [bx + 0.05, yb + ch]] : [[bx - 0.2, yb], [fx + 0.4, yb], [fx, yb + ch], [bx + 0.15, yb + ch]];
    extrude(b, 'z', -W / 2 + 0.1, W / 2 - 0.1, prof, wreck ? '#1a1a1a' : '#2a3440', S.k.plain);
    const rx0 = prof[3][0] + 0.02, rx1 = fx - 0.02;
    b.collide((rx0 + rx1) / 2, yb, 0, rx1 - rx0, ch, W - 0.2, 'veh');
    boxR(b, rx0 + 0.05, rx1 - 0.05, yb + ch, yb + ch + 0.07, -W / 2 + 0.14, W / 2 - 0.14, c, S.k.plain, V);
    if (!wreck && !hatch) boxR(b, -L / 2 + 0.2, -L / 2 + 0.6, yb, yb + 0.08, -W / 2 + 0.2, W / 2 - 0.2, shade(c, 0.8), S.k.plain, NC);     // bagaj kapağı çizgisi
    fp = footW(b, -L / 2 - 0.08, L / 2 + 0.08, -W / 2 - 0.02, W / 2 + 0.02, yb + ch + 0.07);
  }));
  return fp;
}

// ── minibüs / kamyonet (van) ──
export function van(b, S, x, z, ry = 0, col = '#e8e8e4', { wreck = false } = {}) {
  let fp;
  b.with(x, 0, z, ry, () => b.obj('araç:van', () => {
    const L = 5.2, W = 1.95, r = 0.36, y0 = 0.3, yb = 1.0, c = wreck ? shade(col, 0.55) : col;
    body(b, S, { L, W, axles: [-1.75, 1.6], r, y0, yb, col: c, wreck });
    if (wreck) for (const ax of [-1.75, 1.6]) for (const sg of [-1, 1]) boxR(b, ax - 0.18, ax + 0.18, 0, y0, sg * 0.6 - 0.12, sg * 0.6 + 0.12, '#2a2a2a', S.k.plain);
    // yük gövdesi (kutu) + ön cam eğimi (dışbükey)
    boxR(b, -L / 2, 1.2, yb, 2.3, -W / 2 + 0.03, W / 2 - 0.03, c, S.k.plain, V);
    extrude(b, 'z', -W / 2 + 0.1, W / 2 - 0.1, [[1.2, yb], [L / 2 - 0.15, yb], [1.85, 2.2], [1.2, 2.2]], '#2a3440', S.k.plain);
    b.collide(1.52, yb, 0, 0.64, 1.1, W - 0.2, 'veh');
    boxR(b, 1.2, 1.9, 2.2, 2.3, -W / 2 + 0.1, W / 2 - 0.1, c, S.k.plain, V);
    boxR(b, -1.6, 0.6, 1.4, 1.9, W / 2 - 0.03, W / 2 - 0.01, '#c0392b', S.k.paint ?? S.k.plain, NC);
    fp = footW(b, -L / 2 - 0.08, L / 2 + 0.08, -W / 2, W / 2, 2.3);
  }));
  return fp;
}

// ── otobüs ──
export function bus(b, S, x, z, ry = 0, col = '#d9a921', { wreck = false } = {}) {
  let fp;
  b.with(x, 0, z, ry, () => b.obj('araç:otobüs', () => {
    const L = 10.0, W = 2.5, r = 0.48, y0 = 0.35, yb = 1.1, c = wreck ? shade(col, 0.6) : col;
    body(b, S, { L, W, axles: [-3.2, 3.0], r, y0, yb, col: c, wreck });
    if (wreck) for (const ax of [-3.2, 3.0]) for (const sg of [-1, 1]) boxR(b, ax - 0.2, ax + 0.2, 0, y0, sg * 0.8 - 0.14, sg * 0.8 + 0.14, '#2a2a2a', S.k.plain);
    // yan pencere bandı: gövde (alt) + pencere şeridi (koyu) + tavan bandı; dikmeler pencere şeridinin dışına yapışık
    boxR(b, -L / 2, L / 2, yb, yb + 0.2, -W / 2, W / 2, c, S.k.plain, V);
    boxR(b, -L / 2 + 0.05, L / 2 - 0.05, yb + 0.2, yb + 1.15, -W / 2 + 0.04, W / 2 - 0.04, '#232b33', S.k.plain, V);
    boxR(b, -L / 2, L / 2, yb + 1.15, yb + 1.55, -W / 2, W / 2, c, S.k.plain, V);
    for (let i = 0; i <= 6; i++) for (const sg of [-1, 1]) { const xx = -L / 2 + 0.05 + i * (L - 0.1 - 0.12) / 6; boxR(b, xx, xx + 0.12, yb + 0.2, yb + 1.15, sg < 0 ? -W / 2 : W / 2 - 0.04, sg < 0 ? -W / 2 + 0.04 : W / 2, shade(c, 0.85), S.k.plain, NC); }
    boxR(b, -L / 2 + 0.6, L / 2 - 0.6, yb + 0.25, yb + 0.35, -W / 2 - 0.02, -W / 2, '#e8e8e4', S.k.plain, NC);
    fp = footW(b, -L / 2 - 0.08, L / 2 + 0.08, -W / 2 - 0.02, W / 2, yb + 1.55);
  }));
  return fp;
}

// ── kamyon (kabin + kasa) ──
export function truck(b, S, x, z, ry = 0, col = '#2c5aa0', cargo = '#cdd2d8', { wreck = false, open = false } = {}) {
  let fp;
  b.with(x, 0, z, ry, () => b.obj('araç:kamyon', () => {
    const L = 8.2, W = 2.4, r = 0.5, y0 = 0.4, yb = 1.15, c = wreck ? shade(col, 0.55) : col;
    body(b, S, { L, W, axles: [-2.6, -1.4, 2.7], r, y0, yb, col: '#34363a', wreck });
    if (wreck) for (const ax of [-2.6, 2.7]) for (const sg of [-1, 1]) boxR(b, ax - 0.2, ax + 0.2, 0, y0, sg * 0.75 - 0.14, sg * 0.75 + 0.14, '#2a2a2a', S.k.plain);
    // kabin (önde) + ön cam
    boxR(b, 2.0, L / 2, yb, 2.0, -W / 2, W / 2, c, S.k.plain, V);
    extrude(b, 'z', -W / 2 + 0.1, W / 2 - 0.1, [[2.0, 2.0], [L / 2, 2.0], [L / 2 - 0.25, 2.75], [2.0, 2.75]], '#2a3440', S.k.plain);
    b.collide(2.0 + (L / 2 - 0.25 - 2.0) / 2, 2.0, 0, L / 2 - 0.25 - 2.0, 0.75, W - 0.2, 'veh');
    boxR(b, 2.0, L / 2 - 0.25, 2.75, 2.88, -W / 2 + 0.05, W / 2 - 0.05, c, S.k.plain, V);
    // kasa
    if (open) {
      boxR(b, -L / 2, 1.85, yb, yb + 0.1, -W / 2, W / 2, shade(cargo, 0.7), S.k.wood, V);
      for (const sg of [-1, 1]) boxR(b, -L / 2, 1.85, yb + 0.1, yb + 0.9, sg < 0 ? -W / 2 : W / 2 - 0.08, sg < 0 ? -W / 2 + 0.08 : W / 2, cargo, S.k.wood, V);
      boxR(b, -L / 2, -L / 2 + 0.08, yb + 0.1, yb + 0.9, -W / 2 + 0.08, W / 2 - 0.08, cargo, S.k.wood, V);
      boxR(b, 1.77, 1.85, yb + 0.1, yb + 0.9, -W / 2 + 0.08, W / 2 - 0.08, cargo, S.k.wood, V);
    } else boxR(b, -L / 2, 1.85, yb, 3.3, -W / 2, W / 2, cargo, S.k.corr ?? S.k.plain, V);
    fp = footW(b, -L / 2 - 0.08, L / 2 + 0.08, -W / 2, W / 2, open ? 2.9 : 3.3);
  }));
  return fp;
}

// ── traktör (çiftlik) ──
export function tractor(b, S, x, z, ry = 0, col = '#b8352a') {
  let fp;
  b.with(x, 0, z, ry, () => b.obj('araç:traktör', () => {
    // arka büyük teker (kaput yanlarında) — gövde dar: z ±0.45, teker z ±[0.5, 0.85]
    boxR(b, -1.3, 1.5, 0.55, 1.25, -0.5, 0.5, col, S.k.plain, V);
    boxR(b, -1.3, -0.3, 1.25, 2.35, -0.45, 0.45, '#2a3440', S.k.plain, V);
    boxR(b, -1.35, -0.25, 2.35, 2.45, -0.75, 0.75, col, S.k.plain, V);
    for (const sg of [-1, 1]) {
      b.cyl(-0.8, 0.75, sg * 0.67, 0.75, 0.75, 0.34, '#1c1c1e', { seg: 8, rx: Math.PI / 2, center: true, collide: false, kind: S.k.plain });
      b.cyl(1.0, 0.42, sg * 0.62, 0.42, 0.42, 0.24, '#1c1c1e', { seg: 8, rx: Math.PI / 2, center: true, collide: false, kind: S.k.plain });
    }
    for (const sg of [-1, 1]) { b.collide(-0.8, 0.75 - 0.53, sg * 0.67, 1.06, 1.06, 0.33, 'veh'); b.collide(1.0, 0.42 - 0.29, sg * 0.62, 0.58, 0.58, 0.23, 'veh'); }
    boxR(b, 1.5, 1.6, 0.6, 1.1, -0.35, 0.35, '#3a3a3a', S.k.metal, NC);
    boxR(b, 0.9, 1.0, 1.25, 2.0, -0.05, 0.05, '#3a3a3a', S.k.metal, NC);
    fp = footW(b, -1.55, 1.6, -0.85, 0.85, 2.45);
  }));
  return fp;
}
