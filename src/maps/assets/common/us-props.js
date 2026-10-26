import { UK } from './us-surface.js';
import { PAL, LAMP_WARM, LAMP_RED } from './us-kit.js';

// Askeri Üs v3 — küçük asset'ler: bariyer, T-duvar, hesco, kum torbası, MG yuvası, sandık, varil, lamba direği, projektör, bayrak direği, tel çit, kamuflaj ağı.
// Hepsi yerel çerçevede (b.with ile 90° döndürülür); uzunluk yerel +X boyunca. Katı = kutu = çarpışma; parçalar yüz yüze, iç içe değil.

// beton New Jersey bariyeri: 3 kademeli kesit (0,6 / 0,4 / 0,22 m), 0,9 m; segmentler 5 cm aralıklı
export function jersey(K, x, z, n = 1, ry = 0, col = PAL.concL) {
  K.b.with(x, 0, z, ry, () => {
    const L = 3.0, gap = 0.05, tot = n * L + (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const cx = -tot / 2 + L / 2 + i * (L + gap);
      K.s(cx, 0, 0, L, 0.28, 0.6, col, UK.CONC); K.s(cx, 0.28, 0, L, 0.34, 0.4, col, UK.CONC); K.s(cx, 0.62, 0, L, 0.28, 0.22, col, UK.CONC);
      for (const sd of [-1, 1]) K.d(cx, 0.68, sd * 0.14, L * 0.5, 0.1, 0.06, PAL.yellow, UK.HATCH);        // yansıtıcı tarama (üst kademenin yüzünden 3 cm dışarı)
    }
  });
}
// T-duvar (patlama perdesi): ters T kesit; segment 1,2 m (4 cm derz), taban 1,0 × 0,5, gövde 0,32 × (h − 0,5). Üstte kaldırma halkası (süs, ulaşılmaz)
export function tWall(K, x, z, n, ry = 0, h = 3.7, col = PAL.twall, stripe = null) {
  K.b.with(x, 0, z, ry, () => {
    const L = 1.2, gap = 0, tot = n * L;                                          // segmentler bitişik (araları görüş yarığı olmasın)
    for (let i = 0; i < n; i++) {
      const cx = -tot / 2 + L / 2 + i * (L + gap);
      K.s(cx, 0, 0, L, 0.5, 1.0, col, UK.CONC);
      if (stripe) { K.s(cx, 0.5, 0, L, h - 1.1, 0.32, col, UK.CONC); K.s(cx, h - 0.6, 0, L, 0.35, 0.32, stripe, UK.PAINT); K.s(cx, h - 0.25, 0, L, 0.25, 0.32, col, UK.CONC); }
      else K.s(cx, 0.5, 0, L, h - 0.5, 0.32, col, UK.CONC);
      K.d(cx, h, 0, 0.3, 0.06, 0.06, PAL.steelD, UK.STEEL);
    }
  });
  return 1.2 * n;
}
// hesco bastiyonu: 1 × 1 m sepetler, üstte toprak (aynı kutunun bölünmüşü)
export function hesco(K, x, z, n = 3, ry = 0, h = 1.4, col = PAL.sand) {
  K.b.with(x, 0, z, ry, () => {
    const tot = n * 1.0;
    for (let i = 0; i < n; i++) { const cx = -tot / 2 + 0.5 + i; K.s(cx, 0, 0, 1.0, h - 0.07, 1.0, col, UK.HESCO); K.s(cx, h - 0.07, 0, 1.0, 0.07, 1.0, PAL.dirt, UK.DIRT); }
  });
}
// kum torbası duvarı: alt gövde + bir sıra içe çekik üst sıra (silüet), uzunluk len
export function sandbags(K, x, z, len = 3, ry = 0, h = 1.1, t = 0.62, col = PAL.tan) {
  K.b.with(x, 0, z, ry, () => { K.s(0, 0, 0, len, h - 0.27, t, col, UK.BAG); K.s(0, h - 0.27, 0, len - 0.24, 0.27, t - 0.12, col, UK.BAG); });
}
// MG yuvası: üç yanı kum torbası (U, açık arka −X), ortada sehpalı makineli (süs, gövde bandının üstünde) + cephane sandığı
export function mgNest(K, x, z, ry = 0) {
  K.b.with(x, 0, z, ry, () => {
    sandbags(K, 1.2, 0, 3.2, Math.PI / 2, 1.05, 0.62);
    sandbags(K, -0.35, -1.29, 2.48, 0, 1.05, 0.62); sandbags(K, -0.35, 1.29, 2.48, 0, 1.05, 0.62);
    K.s(0.55, 0, 0, 0.36, 0.5, 0.36, PAL.steelD, UK.STEEL);                    // sehpa kaidesi
    K.s(0.55, 0.5, 0, 0.18, 0.55, 0.18, PAL.steelD, UK.STEEL);
    K.s(0.55, 1.05, 0, 0.7, 0.14, 0.12, '#2a2d30', UK.STEEL); K.d(1.2, 1.1, 0, 0.6, 0.05, 0.05, '#2a2d30', UK.STEEL);     // gövde (katı, sehpa üstünde) + namlu (torbanın üstünden)
    K.s(-0.55, 0, 0.55, 0.5, 0.3, 0.3, PAL.olive, UK.STEEL);
  });
}
// ahşap sandık (s kenar), y tabanı
export function crate(K, x, z, s = 1.1, y = 0, col = PAL.wood) {
  K.s(x, y, z, s, s * 0.86, s, col, UK.WOOD);
  K.s(x, y + s * 0.86, z, s, s * 0.06, s, '#7a5c38', UK.WOOD);                                       // kapak (ayrı kutu)
}
// cephane / kargo sandığı (yeşil boyalı, alçak)
export function ammoBox(K, x, z, ry = 0, y = 0) { K.b.with(x, y, z, ry, () => { K.s(0, 0, 0, 1.2, 0.5, 0.6, PAL.olive, UK.STEEL); K.s(0, 0.5, 0, 1.2, 0.06, 0.6, PAL.oliveD, UK.STEEL); }); }
// varil (8 kenarlı silindir; çarpışma AABB = görsel AABB), çember bantları süs
export function barrel(K, x, z, col = PAL.olive, y = 0) {
  K.b.cyl(x, y, z, 0.29, 0.29, 0.88, col, { seg: 10, kind: UK.STEEL });
  K.b.cyl(x, y + 0.88, z, 0.27, 0.27, 0.02, '#3a3d40', { seg: 10, kind: UK.STEEL, collide: false });
}
export function barrels(K, x, z, pat = [[0, 0], [0.62, 0], [0.31, 0.62]], cols = [PAL.olive, PAL.red, PAL.olive]) { pat.forEach(([dx, dz], i) => barrel(K, x + dx, z + dz, cols[i % cols.length])); }
// ateş varili (gece parlar)
export function fireBarrel(K, x, z) {
  K.b.cyl(x, 0, z, 0.3, 0.3, 0.86, PAL.rust, { seg: 10, kind: UK.STEEL });
  K.b.cyl(x, 0.86, z, 0.22, 0.22, 0.05, '#ff8a3d', { seg: 10, collide: false, o: { glow: true } });
  K.lamp(x, 1.3, z, 4.5, 0.9, '#ffa45c');
}
// lamba direği: kaide + direk (katı), kol + başlık (süs, 5,8 m), gece ışığı. ry: kolun yönü (yerel +X)
export function lampPost(K, x, z, ry = 0, h = 6.0, double = false) {
  K.b.with(x, 0, z, ry, () => {
    K.s(0, 0, 0, 0.44, 0.3, 0.44, PAL.concD, UK.CONC);
    K.s(0, 0.3, 0, 0.16, h - 0.3, 0.16, PAL.steel, UK.STEEL);
    for (const sd of double ? [-1, 1] : [1]) {
      K.d(sd * 0.7, h - 0.12, 0, 1.24, 0.08, 0.08, PAL.steel, UK.STEEL);
      K.d(sd * 1.25, h - 0.26, 0, 0.62, 0.14, 0.3, '#3d4146', UK.STEEL);
      K.lit(sd * 1.25, h - 0.3, 0, 0.5, 0.04, 0.22, LAMP_WARM);
      K.lamp(sd * 1.3, h - 0.6, 0, 13, 1.05);
    }
  });
}
// duvar projektörü: duvar yüzüne (yerel −X tarafı duvar) yaslı kol + baş; y = bağlantı yüksekliği
export function floodLight(K, x, y, z, ry = 0) {
  K.b.with(x, y, z, ry, () => {
    K.d(0.2, -0.06, 0, 0.4, 0.12, 0.12, PAL.steelD, UK.STEEL);
    K.d(0.48, -0.2, 0, 0.18, 0.4, 0.5, '#33373b', UK.STEEL);
    K.lit(0.585, -0.16, 0, 0.03, 0.32, 0.42, '#fff6d6');
    K.lamp(1.6, -1.4, 0, 12, 1.0, '#fff1d8');
  });
}
export function bollardLight(K, x, z) { K.s(x, 0, z, 0.2, 0.7, 0.2, PAL.steelD, UK.STEEL); K.lit(x, 0.7, z, 0.22, 0.06, 0.22, '#ffd98a'); K.lamp(x, 0.6, z, 3.2, 0.5); }
// bayrak direği: kaide + direk + bayrak (süs, 6 m üstünde)
export function flagPole(K, x, z, col) {
  K.s(x, 0, z, 0.9, 0.25, 0.9, PAL.concL, UK.CONC);
  K.b.cyl(x, 0.25, z, 0.07, 0.09, 8.2, PAL.steelL, { seg: 8, kind: UK.STEEL });
  K.d(x + 1.0, 6.8, z, 1.85, 1.2, 0.03, col, UK.PAINT);
  K.d(x, 8.45, z, 0.18, 0.12, 0.18, '#d9b13a', UK.STEEL);
}
// tel çit: direkler (3 m), üst boru, saydam tel örgü (çarpışma = tel düzlemi, 6 cm), üstte jiletli tel (çizgi). gaps: [a, b] yerel x aralıkları
export function chainFence(K, x0, z0, x1, z1, { h = 2.4, gaps = [], razor = true } = {}) {
  const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), a0 = ax ? Math.min(x0, x1) : Math.min(z0, z1), a1 = ax ? Math.max(x0, x1) : Math.max(z0, z1), c = ax ? z0 : x0;
  const segs = []; let cur = a0;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > cur) segs.push([cur, g0]); cur = g1; }
  if (cur < a1) segs.push([cur, a1]);
  const B = (p, q, y, w, hh, t, col, kind, solid) => { const cx = (p + q) / 2; (solid ? K.s : K.d).call(K, ax ? cx : c, y, ax ? c : cx, ax ? q - p : t, hh, ax ? t : q - p, col, kind); };
  for (const [s, e] of segs) {
    const n = Math.max(1, Math.round((e - s) / 3)), st = (e - s) / n;
    for (let i = 0; i <= n; i++) { const a = s + i * st, p = Math.max(s, a - 0.05), q = Math.min(e, a + 0.05); B(p, q, 0, 0, h, 0.1, PAL.steelL, UK.STEEL, true); }
    for (let i = 0; i < n; i++) {
      const p = s + i * st + 0.05, q = s + (i + 1) * st - 0.05;
      const cx = (p + q) / 2;
      K.b.box(ax ? cx : c, 0.05, ax ? c : cx, ax ? q - p : 0.04, h - 0.15, ax ? 0.04 : q - p, '#9aa3a8', { o: { transparent: true, opacity: 0.32, roughness: 0.6, metalness: 0.4 } });   // tel örgü (katı: içinden geçilmez, mermi de durur değil: ince)
      B(p, q, h - 0.1, 0, 0.06, 0.06, PAL.steelL, UK.STEEL, false);
    }
    if (razor) {                                                                     // jiletli tel: direk tepesinde 3 tel çizgisi (süs, 2,4 m üstünde)
      for (const dy of [0.12, 0.26, 0.4]) { const p0 = [ax ? s : c, h + dy, ax ? c : s], p1 = [ax ? e : c, h + dy, ax ? c : e]; K.wire([p0, p1]); }
      const m = Math.round((e - s) / 0.45);
      for (let i = 0; i < m; i++) { const a = s + (i + 0.5) * (e - s) / m, o = (i % 2 ? 1 : -1) * 0.1; K.wire([[ax ? a : c + o, h + 0.12, ax ? c + o : a], [ax ? a : c - o, h + 0.4, ax ? c - o : a]]); }
    }
  }
}
// kamuflaj ağı: 4 direk (katı) + yatay ağ (süs, h üstünde, 5 cm) + iki yanda sarkan etek (gövde bandının üstünde)
export function camoNet(K, x, z, w, d, h = 3.2) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.s(x + sx * (w / 2 - 0.1), 0, z + sz * (d / 2 - 0.1), 0.1, h, 0.1, PAL.woodD, UK.WOOD);
  K.d(x, h, z, w, 0.05, d, '#566343', UK.CAMO);
  for (const sz of [-1, 1]) K.d(x, h - 0.55, z + sz * (d / 2 + 0.03), w, 0.55, 0.03, '#566343', UK.CAMO);
}
// tabela panosu (iki direkli), yerel +z'ye bakar
export function signBoard(K, x, z, ry, w, h, text, fg = '#ffffff', bg = '#2d4a2f', y = 1.0) {
  K.b.with(x, 0, z, ry, () => {
    for (const sx of [-1, 1]) K.s(sx * (w / 2 - 0.1), 0, 0, 0.1, y + h, 0.1, PAL.steel, UK.STEEL);
    K.s(0, y, 0.08, w, h, 0.06, bg, UK.STEEL);
    K.sign(text, w - 0.1, h - 0.08, 0, y + h / 2, 0.14, 0, fg, bg);
  });
}
// ikaz lambası (kırmızı, yanıp sönmez; çatı köşesi / direk tepesi)
export function beacon(K, x, y, z) { K.d(x, y, z, 0.16, 0.08, 0.16, PAL.steelD, UK.STEEL); K.lit(x, y + 0.08, z, 0.14, 0.14, 0.14, LAMP_RED); }
