import * as THREE from 'three';
import { COL } from './kit.js';

// Vadi'ye özel yapı parçaları. Hepsi MapBuilder (b) üzerine, YEREL çerçevede (yapı orijini = zemin) çizilir.
// gy(lx,lz): yerel noktanın zemin yüksekliği farkı (yamaçta uzayan duvarlar için).

const STONE = ['#8e897c', '#9a9486', '#867f72', '#a09a8b'];
const hashf = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// aralıkları çıkar: [a0,a1] − gaps
function spans(a0, a1, gaps) {
  let out = [[a0, a1]];
  for (const g of gaps) {
    const g0 = g.at - g.w / 2, g1 = g.at + g.w / 2, nx = [];
    for (const [s, e] of out) {
      if (g1 <= s || g0 >= e) { nx.push([s, e]); continue; }
      if (g0 > s) nx.push([s, g0]);
      if (g1 < e) nx.push([g1, e]);
    }
    out = nx;
  }
  return out.filter(([s, e]) => e - s > 0.05);
}

// ───────── Kuru taş duvar (eksene paralel, araziyi izler, kapı boşlukları) ─────────
export function stoneWall(b, gy, x0, z0, x1, z1, o = {}) {
  const { h = 1.0, t = 0.55, gaps = [], seg = 2.4, cols = STONE } = o;
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const c = alongX ? z0 : x0;
  for (const [s0, e0] of spans(a0, a1, gaps)) {
    const n = Math.max(1, Math.round((e0 - s0) / seg)), st = (e0 - s0) / n;
    for (let i = 0; i < n; i++) {
      const s = s0 + i * st, e = s + st, m = (s + e) / 2;
      const P = (a) => (alongX ? gy(a, c) : gy(c, a));
      const lo = Math.min(P(s), P(m), P(e)), hi = Math.max(P(s), P(m), P(e));
      const jit = (hashf(alongX ? m : c, alongX ? c : m) - 0.5) * 0.18;
      const col = cols[Math.floor(hashf(m * 1.7, c * 2.3) * cols.length)];
      const yb = lo - 0.35, hh = hi + h + jit - yb;
      if (alongX) b.box(m, yb, c, st + 0.04, hh, t, col); else b.box(c, yb, m, t, hh, st + 0.04, col);
    }
  }
}

// ───────── Kaya duvar / kayalık: büyük kayalar dizisi, çarpışmalı (siper) ─────────
export function rockRun(b, rng, gy, x0, z0, x1, z1, o = {}) {
  const { s = 1.0, gaps = [], step = 2.3 } = o;
  const L = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const n = Math.max(1, Math.round(L / step));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    if (gaps.some((g) => Math.abs((alongX ? x : z) - g.at) < g.w / 2 + 0.6)) continue;
    rock(b, rng, x + (rng() - 0.5) * 0.6, z + (rng() - 0.5) * 0.6, s * (0.85 + rng() * 0.5), gy(x, z));
  }
}

export function rock(b, rng, x, z, s = 1, y = 0) {
  s *= 0.82;
  const dark = rng() > 0.5;
  b.ico(x, y + 0.42 * s, z, 1.0 * s, dark ? '#7f7e77' : '#8f8d85', { scale: [1.3, 0.85 + rng() * 0.3, 1.05], detail: 0, ry: rng() * 3 });
  if (rng() > 0.5) b.ico(x + 0.7 * s, y + 0.25 * s, z + 0.5 * s, 0.55 * s, '#76756e', { scale: [1.2, 0.8, 1], detail: 0, ry: rng() * 3 });
  b.collide(x, y, z, 2.0 * s, 1.1 * s, 1.7 * s);
}

// Dekor taşlar (çarpışmasız)
export function pebbles(b, rng, x, z, n = 4, r = 1.6, y = 0) {
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.28, d = rng() * r;
    b.ico(x + Math.cos(a) * d, y + 0.08, z + Math.sin(a) * d, 0.16 + rng() * 0.2, rng() > 0.5 ? '#8f8d85' : '#a5a296', { scale: [1.3, 0.55, 1], detail: 0, ry: rng() * 3 });
  }
}

// ───────── Bunker (betonarme, mazgallı, çatısı çıkılabilir) ─────────
// Ön (mazgal) +z yüzünde, giriş −z (arka) yüzünde; ry ile döndür. Çatıya yan rampadan çıkılır.
export function bunker(b, { w = 6.4, d = 4.6, color = '#8d9389', dark = '#6f756d', ramp = true, roofSand = true } = {}) {
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, H = 2.35, T = 0.42;
  b.box(0, 0, 0, w - 0.5, 0.06, d - 0.5, '#6a6d66', { collide: false });
  b.wall('x', x0, x1, z1, 0, H, T, color, [{ at: -0.6, w: 2.4, b: 1.15, top: 1.75 }, { at: 2.0, w: 0.9, b: 1.25, top: 1.65 }]);      // ön: mazgallar
  b.wall('x', x0, x1, z0, 0, H, T, color, [{ at: 0, w: 1.5, b: 0, top: 2.1 }]);                                                   // arka: kapı
  b.wall('z', z0 + T / 2, z1 - T / 2, x0, 0, H, T, color, []);
  b.wall('z', z0 + T / 2, z1 - T / 2, x1, 0, H, T, color, [{ at: 0, w: 0.9, b: 1.2, top: 1.7 }]);
  b.box(0, H, 0, w + 0.7, 0.45, d + 0.7, dark);                                      // çatı plakası (üst 2.8)
  b.box(0, H + 0.45, z1 + 0.15, w + 0.7, 0.18, 0.2, color, { collide: false });      // siperlik
  if (roofSand) for (let i = 0; i < 3; i++) b.box(-1.6 + i * 1.6, H + 0.45, z1 + 0.2, 1.4, 0.35, 0.5, '#a89468', { collide: false });
  if (ramp) b.stairs(x1 + 0.4 + 3.1, -d / 2 + 0.9 , 0, '-x', 1.5, 6, 0.47, 0.52, '#7a7f77');   // yan rampa: çatıya
  b.box(x0 - 0.1, 0, z0 - 0.1, 0.5, H + 0.45, 0.5, dark, { collide: false });
}

// ───────── Kulübe / çiftlik yardımcıları ─────────
export function haystack(b, x, z, s = 1, y = 0) {
  b.cyl(x, y, z, 0.12 * s, 1.55 * s, 2.7 * s, '#d2b155', { seg: 8 });
  b.cyl(x, y + 2.6 * s, z, 0.02, 0.3 * s, 0.35 * s, '#b99a42', { seg: 6, collide: false });
}

export function tractor(b, { color = '#3a7d44', y = 0 } = {}) {
  b.with(0, y, 0, 0, () => {
    b.box(0.3, 0.45, 0, 2.2, 0.9, 1.2, color, { collide: false });
    b.box(-0.9, 1.35, 0, 1.2, 0.12, 1.3, '#3a3a3a', { collide: false });                    // kabin çatısı
    for (const sz of [-0.55, 0.55]) b.box(-1.35, 0.9, sz, 0.1, 0.55, 0.1, '#3a3a3a', { collide: false });
    b.box(-1.0, 0.8, 0, 0.9, 0.55, 1.1, '#2b2b2b', { collide: false });
    for (const sz of [-0.85, 0.85]) b.cyl(-0.9, 0.62, sz, 0.62, 0.62, 0.38, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    for (const sz of [-0.7, 0.7]) b.cyl(1.2, 0.36, sz, 0.36, 0.36, 0.26, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 8, collide: false });
    b.cyl(1.35, 0.95, 0, 0.07, 0.07, 0.6, '#555', { seg: 6, collide: false });
    b.collide(0, 0, 0, 3.4, 1.5, 1.9);
  });
}

export function cart(b, { y = 0, color = '#7a5a38' } = {}) {
  b.with(0, y, 0, 0, () => {
    b.box(0, 0.55, 0, 2.2, 0.15, 1.2, color, { collide: false });
    for (const sz of [-0.6, 0.6]) b.box(0, 0.7, sz, 2.2, 0.35, 0.08, '#5e3c1d', { collide: false });
    for (const sz of [-0.7, 0.7]) b.cyl(0, 0.45, sz, 0.45, 0.45, 0.1, '#4a3220', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    b.box(1.8, 0.4, 0, 1.6, 0.06, 0.1, '#5e3c1d', { collide: false });
    b.collide(0.2, 0, 0, 2.6, 1.0, 1.5);
  });
}

export function well(b, y = 0) {
  b.cyl(0, y, 0, 0.9, 0.95, 0.9, '#8e897c', { seg: 10 });
  b.cyl(0, y + 0.8, 0, 0.62, 0.62, 0.12, '#2a4a60', { seg: 10, collide: false });
  for (const sx of [-0.85, 0.85]) b.box(sx, y, 0, 0.14, 2.3, 0.14, '#5e3c1d', { collide: false });
  b.box(0, y + 2.25, 0, 2.1, 0.12, 0.18, '#5e3c1d', { collide: false });
  b.prism(0, y + 2.3, 0, 2.3, 0.7, 1.6, '#7a3b2e', { ry: Math.PI / 2 });
}

export function tent(b, { color = '#c7b98a', len = 4.2, w = 3.2, h = 2.0, y = 0 } = {}) {
  b.prism(0, y, 0, w, h, len, color, {});
  b.box(0, y, len / 2 - 0.02, w * 0.5, h * 0.55, 0.05, '#3a3226', { collide: false });
  b.collide(0, y, 0, w - 0.2, h * 0.8, len - 0.2);
}

// Kamp ateşi: taş halka + parlayan alev (gece yol gösterir)
export function campfire(b, y = 0) {
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; b.ico(Math.cos(a) * 0.62, y + 0.1, Math.sin(a) * 0.62, 0.2, '#76756e', { scale: [1, 0.7, 1], detail: 0 }); }
  b.cyl(0.15, y + 0.12, 0, 0.08, 0.1, 0.8, '#4a3220', { rx: 0.9, center: true, seg: 5, collide: false });
  b.cyl(-0.15, y + 0.12, 0.1, 0.08, 0.1, 0.8, '#4a3220', { rz: 0.9, center: true, seg: 5, collide: false });
  b.cyl(0, y + 0.1, 0, 0.02, 0.42, 1.0, '#ff8a2a', { seg: 6, collide: false, o: { glow: true } });
  b.cyl(0, y + 0.1, 0, 0.01, 0.22, 1.4, '#ffd24a', { seg: 5, collide: false, o: { glow: true } });
  b.collide(0, y, 0, 1.2, 0.4, 1.2);
}

// Fener direği (gece parlar)
export function lantern(b, h = 3.2, y = 0, color = '#ffd98a') {
  b.cyl(0, y, 0, 0.06, 0.09, h, '#4a3a2a', { seg: 5, collide: false });
  b.box(0, y + h - 0.1, 0, 0.34, 0.36, 0.34, color, { collide: false, o: { glow: true } });
  b.box(0, y + h + 0.26, 0, 0.5, 0.08, 0.5, '#3a2f25', { collide: false });
}

// Kütük yığını
export function logPile(b, y = 0, len = 2.6) {
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) b.cyl(0, y + 0.2 + r * 0.34, (i - (2 - r) / 2) * 0.42, 0.2, 0.2, len, '#7a5230', { rz: Math.PI / 2, center: true, seg: 6, collide: false });
  b.collide(0, y, 0, len, 1.0, 1.35);
}

// Saman rulosu sırası / yığın çarpışmalı zaten K.hayBale. Kütük (devrik gövde)
export function fallenLog(b, x, z, len, ry, y = 0) {
  b.cyl(x, y + 0.34, z, 0.34, 0.36, len, '#6e4a2a', { rx: Math.PI / 2, ry, center: true, seg: 7, collide: false });
  b.with(x, y, z, ry, () => b.collide(0, 0, 0, 0.7, 0.66, len));
}

// Üstü çatılı açık ahır / kulübe (avlu gölgeliği): dört direk + çatı, altı serbest
export function shelter(b, { w = 5, d = 3.4, h = 2.6, roof = '#6a5a4a', y = 0 } = {}) {
  for (const sx of [-w / 2, w / 2]) for (const sz of [-d / 2, d / 2]) b.box(sx, y, sz, 0.22, h, 0.22, '#5e3c1d');
  b.prism(0, y + h, 0, d + 1.0, 1.0, w + 0.8, roof, { ry: Math.PI / 2 });
}

// ───────── Tahta (asma) köprü: tabliye 'deck' (bot yürür), kenar halatı 'rail' ─────────
export function plankBridge(b, { x0, z0, x1, z1, y, w = 2.2, color = '#8b6a45' }) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const sx = alongX ? len : w, sz = alongX ? w : len;
  b.box(cx, y - 0.22, cz, sx, 0.22, sz, color, { tag: 'deck' });
  const n = Math.floor(len / 0.5);
  for (let i = 0; i < n; i++) {   // tahtalar (dekor)
    const t = -len / 2 + 0.25 + i * 0.5;
    if (alongX) b.box(cx + t, y, cz, 0.42, 0.04, w - 0.1, i % 2 ? '#7a5a38' : '#94724a', { collide: false });
    else b.box(cx, y, cz + t, w - 0.1, 0.04, 0.42, i % 2 ? '#7a5a38' : '#94724a', { collide: false });
  }
  for (const s of [-1, 1]) {
    const ox = alongX ? 0 : s * (w / 2 - 0.05), oz = alongX ? s * (w / 2 - 0.05) : 0;
    b.box(cx + ox, y, cz + oz, alongX ? len : 0.1, 1.0, alongX ? 0.1 : len, '#6a5238', { tag: 'rail' });
    const m = Math.floor(len / 2.5);
    for (let i = 0; i <= m; i++) {
      const t = -len / 2 + (i / m) * len;
      b.box(cx + ox + (alongX ? t : 0), y, cz + oz + (alongX ? 0 : t), 0.16, 1.3, 0.16, '#4a3220', { collide: false });
    }
  }
}

// Köprü tabliyesi üstü araç: K.car görünümü, çarpışma 'rail' etiketli (nav tabliye üstündeki nesneyi engel sayar)
export function deckCar(b, { x, z, ry = 0, color = '#b33a2a', wreck = false }) {
  b.with(x, 0, z, ry, () => {
    const c = wreck ? '#6e5a4a' : color;
    b.box(0, 0.3, 0, 4.3, 0.75, 1.8, c, { collide: false });
    b.box(-0.35, 1.05, 0, 2.3, 0.62, 1.64, c, { collide: false });
    b.box(-0.35, 1.08, 0, 2.34, 0.42, 1.67, '#22333f', { collide: false, o: { roughness: 0.2 } });
    b.box(2.15, 0.3, 0, 0.12, 0.35, 1.7, '#222', { collide: false });
    b.box(-2.15, 0.3, 0, 0.12, 0.35, 1.7, '#222', { collide: false });
    for (const wx of [-1.4, 1.4]) for (const wz of [-0.92, 0.92]) b.cyl(wx, 0.34, wz, 0.34, 0.34, 0.26, '#1c1c1e', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
    b.collide(0, 0, 0, 4.4, 1.7, 1.85, 'rail');
  });
}

// ───────── Yıkık yapı: kısmen ayakta duran taş duvarlar (siper) ─────────
export function ruin(b, rng, gy, { w = 7, d = 5, h = 2.4 } = {}) {
  const t = 0.5, x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const seg = (ax, az, bx, bz, hh, gaps = []) => stoneWall(b, gy, ax, az, bx, bz, { h: hh, t, gaps, seg: 1.6, cols: ['#8a8578', '#99937f', '#7f7a6d'] });
  seg(x0, z0, x1, z0, h * 0.55, [{ at: -1.2, w: 1.6 }]);
  seg(x0, z1, x1, z1, h * 0.9, [{ at: 1.5, w: 1.5 }]);
  seg(x0, z0, x0, z1, h, [{ at: 0.4, w: 1.4 }]);
  seg(x1, z0, x1, z1, h * 0.4, [{ at: -0.2, w: 2.4 }]);
  for (let i = 0; i < 4; i++) b.box(x0 + 1 + i * 1.7, 0, z0 + 1 + (i % 2) * 2, 0.5, 0.3 + rng() * 0.3, 0.6, '#8a8578', { collide: false });   // dökülmüş taşlar
  rock(b, rng, 1.2, 0.3, 0.7);
}

// ───────── Gözetleme kulesi (kendi yapımız, tırmanılabilir): platform 6 m; düz merdiven kuzeyden (−z) gelir ─────────
// Yerel çerçeve: kule merkezi (0,0); platform z∈[−2.3,2.3]; merdiven +z yönüne uzanır (z=2.3..9.5), basamak üstü platformla aynı seviyede.
export function tower(b, { color = '#7a5a38', dark = '#5e3c1d', H = 6.0, roof = '#6a4a3a' } = {}) {
  const P = 2.3, steps = 24, rise = H / steps, run = 0.3, sw = 1.3, sx = 1.0;
  for (const px of [-1, 1]) for (const pz of [-1, 1]) b.box(px * (P - 0.25), 0, pz * (P - 0.25), 0.4, H, 0.4, color, { collide: false });     // dört direk
  b.collide(0, 0, 0, 2.6, H, 2.6);                                                                                                           // çekirdek (içinden geçilmez)
  for (const y of [1.6, 3.4, 5.0]) for (const s of [-1, 1]) {                                                                               // çapraz payandalar
    b.box(0, y, s * (P - 0.1), 3.8, 0.14, 0.12, dark, { collide: false });
    b.box(s * (P - 0.1), y, 0, 0.12, 0.14, 3.8, dark, { collide: false });
  }
  b.box(0, H - 0.25, 0, P * 2 + 0.3, 0.25, P * 2 + 0.3, dark);                                                                               // platform (üst = H)
  // korkuluk: güney (merdiven) kenarında boşluk
  b.box(0, H, -P, P * 2, 1.0, 0.14, color);                                                                                                  // kuzey
  b.box(-P, H, 0, 0.14, 1.0, P * 2, color);                                                                                                  // batı
  b.box(P, H, 0, 0.14, 1.0, P * 2, color);                                                                                                   // doğu
  b.box(-1.3, H, P, 1.8, 1.0, 0.14, color);                                                                                                  // güney (boşluk x=0.1..1.9)
  b.box(2.1, H, P, 0.4, 1.0, 0.14, color);
  for (const px of [-P, P]) for (const pz of [-P, P]) b.box(px, H, pz, 0.16, 2.4, 0.16, dark, { collide: false });                              // çatı direkleri
  b.prism(0, H + 2.4, 0, P * 2 + 1.2, 1.1, P * 2 + 1.2, roof, {});                                                                           // çatı (dekor)
  b.box(0, H + 2.35, 0, P * 2 + 0.5, 0.12, P * 2 + 0.5, dark, { collide: false });
  // merdiven (platforma yanaşık): ilk basamak zeminde, son basamak z=P'de platform seviyesinde
  b.stairs(sx, P + steps * run, 0, '-z', sw, steps, rise, run, '#8b6a45');
  for (const x of [sx - sw / 2 - 0.05, sx + sw / 2 + 0.05]) b.box(x, 0, P + steps * run / 2, 0.1, 1.0, steps * run - 0.2, dark, { collide: false });   // iki yan kiriş (görsel)
  b.box(sx, H - 0.3, P + 0.25, sw + 0.2, 0.3, 0.5, '#8b6a45', { collide: false });
}

// ───────── Kaya tüneli: ledge yolunu örten kayalık (iki yan duvar + üst plaka), x ekseni boyunca ─────────
export function rockTunnel(b, rng, gy, { len = 9, w = 3.2, h = 2.8 } = {}) {
  const wallT = 1.8;
  for (const sz of [-1, 1]) {
    const zc = sz * (w / 2 + wallT / 2);
    b.box(0, -0.5, zc, len, h + 0.5, wallT, '#85827a');
    for (let i = 0; i < 5; i++) b.ico(-len / 2 + (i + 0.5) * len / 5, h * 0.55, zc + sz * 0.45, 1.15, rng() > 0.5 ? '#7f7e77' : '#8f8d85', { scale: [1.4, 1.0, 1.1], detail: 0, ry: rng() * 3 });
  }
  b.box(0, h, 0, len, 0.7, w + 2 * wallT, '#7a7870');
  for (let i = 0; i < 4; i++) b.ico(-len / 2 + (i + 0.5) * len / 4, h + 0.95, (rng() - 0.5) * 2.2, 1.2 + rng() * 0.5, '#8a8880', { scale: [1.3, 0.8, 1.2], detail: 0, ry: rng() * 3 });
  for (const sx of [-1, 1]) b.ico(sx * (len / 2 + 0.2), 0.5, 0, 0.0001, '#7f7e77', { detail: 0 });
}

// Çim tutamı / çiçek geometrileri (dekor katmanı için): küçük açık uçlu koniler
export function tuftGeo(r = 0.16, h = 0.5) {
  const g = new THREE.ConeGeometry(r, h, 4, 1, true);
  g.translate(0, h / 2, 0);
  return g;
}
export { COL };
