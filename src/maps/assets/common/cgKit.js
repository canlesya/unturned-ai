import * as THREE from 'three';
import { CK } from './cgSurface.js';

// Çöl kasabası asset kiti (12.171, Çöl Geçidi v2; başka çöl / Orta Doğu haritaları da kullanabilir). Kural: her KATI parça eksen hizalı kutu ve
// çarpışması görselle birebir (b.box); süs parçaları (çarpışmasız) yalnız bir katı yüze yapışık ve ondan ≤ 0,12 m taşar (ya da oyuncunun erişemeyeceği
// yükseklikte: ≥ 2,5 m). Döndürülmüş katı kutu YOK (AABB büyümesi görünmez çarpışma yapıyordu). Yuvarlak parçalar (varil, palmiye gövdesi) silindir.
// Yerel çerçeve: b.with(x, y, z, ry) — ry yalnız 0 / ±π/2 / π (yüz yönü), böylece kutular dünya ekseninde kalır.
export const NC = { collide: false };
const nk = (kind, o = {}) => ({ collide: false, ...o, kind });
const sk = (kind, tag = 'prop', o = {}) => ({ ...o, kind, tag });
export const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
export const mixc = (a, b2, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b2), t).getHexString();

// ── SANDIK: tahta gövde (çarpışma), köşe dikmeleri + üst / orta kuşak (gövdeden 0,03 taşar), çapraz destek (yüze yapışık), bazılarında şablon yazı ──
export const CRATE_COL = ['#9b7a4a', '#8a6a3f', '#a6834f', '#94744a', '#6b7350', '#8a4f3a', '#a88a5c', '#5f6f7e'];
export function cgCrate(b, { x, y, z, w, h, d, color = CRATE_COL[0], seed = 0 }) {
  b.box(x, y, z, w, h, d, color, sk(CK.WOOD));
  if (h < 0.4) return;
  const dk = shade(color, 0.62), e = 0.03, t = 0.1;
  b.with(x, y, z, 0, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (w / 2 - t / 2 + e / 2), 0, sz * (d / 2 - t / 2 + e / 2), t + e, h + 0.015, t + e, dk, nk(CK.WOOD));       // köşe dikmeleri (gövdeye gömülü 0,07, dışa 0,03; tepe 1,5 cm yukarıda: üst yüzler çakışmaz)
    for (const yy of [h - 0.09, h * 0.5 - 0.045]) { b.box(0, yy, d / 2 + e / 2, w - 2 * t, 0.09, e, dk, nk(CK.WOOD)); b.box(0, yy, -d / 2 - e / 2, w - 2 * t, 0.09, e, dk, nk(CK.WOOD)); b.box(w / 2 + e / 2, yy, 0, e, 0.09, d - 2 * t, dk, nk(CK.WOOD)); b.box(-w / 2 - e / 2, yy, 0, e, 0.09, d - 2 * t, dk, nk(CK.WOOD)); }
    if (seed % 3 === 0 && w >= 0.9) {                                                  // şablon: açık plaka + iki çizgi (ön yüz)
      b.box(-w * 0.12, h * 0.62, d / 2 + 0.012, Math.min(0.62, w * 0.42), 0.22, 0.02, '#d9d6c8', nk(CK.PAINT));
      b.box(-w * 0.12, h * 0.66, d / 2 + 0.024, Math.min(0.5, w * 0.34), 0.04, 0.012, '#30343a', nk(CK.PAINT));
      b.box(-w * 0.12, h * 0.6, d / 2 + 0.024, Math.min(0.36, w * 0.25), 0.04, 0.012, '#30343a', nk(CK.PAINT));
    }
  });
}
// ── VARİL: 16 dilimli silindir (çarpışma: kare taban AABB), iki bant + kapak halkası + tapa ──
export const BARREL_COL = ['#9a3b2b', '#7d5a36', '#3d6a8a', '#5a6b3c', '#8a8f94', '#b07a2a'];
export function cgBarrel(b, { x, y, z, r = 0.42, h = 1.05, color = BARREL_COL[0] }) {
  b.cyl(x, y, z, r, r, h, color, { seg: 16, kind: CK.METAL, tag: 'prop' });
  const dk = shade(color, 0.68);
  for (const f of [0.22, 0.75]) b.cyl(x, y + h * f, z, r + 0.015, r + 0.015, 0.05, dk, { seg: 16, collide: false, kind: CK.METAL });
  b.cyl(x, y + h - 0.012, z, r * 0.92, r * 0.92, 0.024, shade(color, 0.85), { seg: 16, collide: false, kind: CK.METAL });
  b.cyl(x + r * 0.45, y + h, z, 0.06, 0.06, 0.03, '#2a2c2e', { seg: 8, collide: false, kind: CK.METAL });
}
// ── KONTEYNER: oluklu sac gövde (çarpışma), oluk nervürleri (0,04), köşe dökümleri, uçta kapı + kilit çubukları ──
export function cgContainer(b, { x, y, z, w, h, d, color = '#2f6a9a' }) {
  b.box(x, y, z, w, h, d, color, sk(CK.METAL));
  const long = w >= d, L = long ? w : d, W = long ? d : w, dk = shade(color, 0.72), cp = '#2c2f31', e = 0.04;
  b.with(x, y, z, long ? 0 : Math.PI / 2, () => {
    for (let t = -L / 2 + 0.55; t < L / 2 - 0.4; t += 0.6) for (const s of [-1, 1]) b.box(t, 0.12, s * (W / 2 + e / 2), 0.14, h - 0.24, e, dk, nk(CK.METAL));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (L / 2 - 0.08 + e / 2), 0, sz * (W / 2 - 0.08 + e / 2), 0.16 + e, h, 0.16 + e, cp, nk(CK.METAL));
    for (const sx of [-1, 1]) {
      b.box(sx * (L / 2 + e / 2), 0.14, 0, e, h - 0.28, 0.03, '#1c1e20', nk(CK.METAL));
      for (const k of [-0.34, -0.16, 0.16, 0.34]) b.box(sx * (L / 2 + e), 0.16, k * W, e * 0.8, h - 0.32, 0.05, '#56595c', nk(CK.METAL));
    }
    b.box(0, h, 0, L - 0.32, 0.025, W - 0.32, shade(color, 1.12), nk(CK.METAL));                     // tavan sacı (gövde tepesinin 2,5 cm üstünde)
  });
}
// ── HURMA: gövde (çarpışmalı silindir, halka boğumları), yaprak tacı (çarpışmasız, ≥ 4,4 m), hurma salkımı ──
export function cgPalm(b, { x, y, z, s = 1, seed = 0 }) {
  const h = 5.6 * s, top = y + h;
  b.cyl(x, y, z, 0.15 * s, 0.24 * s, h, '#7a5c3c', { seg: 8, kind: CK.WOOD, tag: 'prop' });
  for (let k = 1; k < 9; k++) b.cyl(x, y + h * k / 9, z, 0.25 * s - 0.011 * k * s, 0.25 * s - 0.011 * k * s, 0.06, '#5e4529', { seg: 8, collide: false, kind: CK.WOOD });
  const rnd = (k) => { const v = Math.sin((seed * 31 + k * 7.13) * 12.9898) * 43758.5453; return v - Math.floor(v); };
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2 + rnd(k) * 0.4, droop = 0.3 + rnd(k + 20) * 0.3, L = (2.4 + rnd(k + 40) * 0.6) * s;
    b.with(x, top, z, ang, () => {
      b.box(L * 0.45, -0.05, 0, L * 0.9, 0.05, 0.46 * s, k % 2 ? '#4f7f3a' : '#5d8f42', nk(CK.LEAF, { rz: -droop }));
      b.box(L * 0.95, -L * 0.42 * Math.sin(droop + 0.5), 0, L * 0.5, 0.04, 0.3 * s, '#466f33', nk(CK.LEAF, { rz: -(droop + 0.7) }));
    });
  }
  b.ico(x, top - 0.12, z, 0.3 * s, '#6a4a2a', { detail: 0 });
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + seed; b.ico(x + Math.cos(a) * 0.28 * s, top - 0.55, z + Math.sin(a) * 0.28 * s, 0.16 * s, '#8a5a24', { detail: 0, scale: [1, 1.4, 1] }); }
  b.softCover(x, top - 0.2, z, 2.4 * s);                                              // botların görüşünü keser (12.141 yaprak görüşü)
}
// ── TENTE (çizgili kumaş saçak): duvara (yerel z = 0 yüzü) asılı, dışa doğru eğimli; iki demir kol. Çarpışmasız, alt kenar ≥ 2,9 m ──
export function cgAwning(b, { w = 2.4, depth = 1.0, y = 3.0, cols = ['#b5402e', '#ecdcb6'], drop = 0.32 }) {
  const n = Math.max(3, Math.round(w / 0.3)), sw = w / n, ang = Math.atan2(drop, depth), L = Math.hypot(depth, drop);
  for (let k = 0; k < n; k++) b.box(-w / 2 + (k + 0.5) * sw, y + drop / 2, depth / 2, sw + 0.002, 0.03, L, cols[k % 2], nk(CK.CLOTH, { rx: ang }));
  for (let k = 0; k < n; k++) b.box(-w / 2 + (k + 0.5) * sw, y - 0.2, depth + 0.005, sw + 0.002, 0.22, 0.02, cols[k % 2], nk(CK.CLOTH));          // saçak püskülü
  for (const s of [-1, 1]) { b.box(s * (w / 2 - 0.05), y + drop - 0.02, 0.03, 0.05, 0.05, 0.06, '#2a2c2e', NC); b.box(s * (w / 2 - 0.05), y - 0.02, depth / 2, 0.035, 0.035, depth, '#2a2c2e', nk(CK.METAL, { rx: 0 })); }
  b.box(0, y + drop, 0.04, w + 0.1, 0.08, 0.08, '#3a3530', nk(CK.WOOD));
}
// ── PENCERE (cephe modülü, yerel z = 0 duvar yüzü, +z dışarı): kesme taş söve + koyu cam + çıta haç + denizlik + lento; isteğe bağlı kepenk / parmaklık / tente ──
const SHUT = ['#4f6b55', '#3d5f7a', '#8a4a37', '#7a5b3a', '#2f6f8a', '#6b4f7a'];
export function cgWindow(b, { y, w = 1.1, h = 1.5, style = 0, seed = 0, frame = '#d9c9a0' }) {
  b.box(0, y - 0.12, 0.03, w + 0.32, h + 0.3, 0.06, frame, nk(CK.STONE));
  b.box(0, y, 0.065, w, h, 0.012, '#1d242b', nk(CK.GLASS));
  b.box(0, y - 0.2, 0.09, w + 0.5, 0.12, 0.18, frame, nk(CK.COPING));
  b.box(0, y + h + 0.06, 0.08, w + 0.44, 0.16, 0.16, frame, nk(CK.COPING));
  b.box(0, y, 0.075, 0.05, h, 0.02, '#6b5a40', nk(CK.WOOD)); b.box(0, y + h * 0.55, 0.075, w, 0.05, 0.02, '#6b5a40', nk(CK.WOOD));
  const sc = SHUT[seed % SHUT.length];
  if (style === 1) for (const sx of [-1, 1]) {                                          // açık kepenk
    b.box(sx * (w / 2 + 0.28), y - 0.04, 0.085, 0.52, h + 0.04, 0.04, sc, nk(CK.PAINT));
    for (let k = 0; k < 5; k++) b.box(sx * (w / 2 + 0.28), y + 0.1 + k * h / 5.2, 0.11, 0.46, 0.035, 0.012, shade(sc, 0.7), nk(CK.PAINT));
  } else if (style === 2) { for (let k = -2; k <= 2; k++) b.box(k * w / 5, y, 0.1, 0.03, h, 0.03, '#2a2c2e', nk(CK.METAL)); b.box(0, y + h * 0.33, 0.1, w, 0.03, 0.03, '#2a2c2e', nk(CK.METAL)); }
  else if (style === 3) b.box(0, y + 0.02, 0.08, w - 0.04, h * 0.62, 0.02, mixc(sc, '#e8dcc0', 0.5), nk(CK.CLOTH));   // içeride perde
}
// ── KAPI (cephe modülü): kesme taş söve + lento + ahşap / boyalı kanat + eşik (çarpışmalı, 0,12 m) + kol ──
export const DOOR_COL = ['#2d6fa8', '#7a4a2a', '#2f7a6e', '#9a3b2b', '#6b5a3a', '#3d5f7a'];
export const CLOTH_COL = [['#b5402e', '#e8dcc0'], ['#2d6fa8', '#e8dcc0'], ['#c79a2e', '#3a2e24'], ['#2f7a6e', '#e8dcc0'], ['#8e3a6a', '#e0c890']];
export function cgDoor(b, { w = 1.3, h = 2.4, color = DOOR_COL[0], frame = '#d9c9a0', arch = false, cloth = null }) {
  b.box(0, 0, 0.04, w + 0.4, h + 0.22, 0.08, frame, nk(CK.STONE));
  if (cloth) {                                                                       // kumaş perdeli kapı: koyu kapı boşluğu + çizgili perde (dikey kıvrımlar), üstte ahşap çubuk
    b.box(0, 0.06, 0.085, w, h - 0.06, 0.012, '#1f1a16', nk(CK.PAINT));
    const n = 7, sw = (w - 0.08) / n;
    for (let k = 0; k < n; k++) b.box(-w / 2 + 0.04 + (k + 0.5) * sw, 0.3 + (k % 3) * 0.04, 0.1 + (k % 2) * 0.012, sw + 0.004, h - 0.42 - (k % 3) * 0.04, 0.012, cloth[k % 2], nk(CK.CLOTH));
    b.box(0, h - 0.12, 0.11, w + 0.1, 0.05, 0.05, '#5e4529', nk(CK.WOOD));
  } else {
    b.box(0, 0.06, 0.09, w, h - 0.06, 0.03, color, nk(CK.PAINT));
    for (let k = 1; k < 4; k++) b.box(-w / 2 + k * w / 4, 0.1, 0.106, 0.02, h - 0.2, 0.01, shade(color, 0.72), nk(CK.PAINT));
    b.box(0, h * 0.45, 0.106, w - 0.12, 0.05, 0.01, shade(color, 0.72), nk(CK.PAINT));
    b.box(w * 0.36, 1.0, 0.125, 0.05, 0.16, 0.04, '#c9b36a', nk(CK.METAL));
  }
  b.box(0, h + 0.1, 0.08, w + 0.6, 0.2, 0.16, frame, nk(CK.COPING));
  if (arch) for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, a = t * Math.PI, ax = -Math.cos(a) * (w / 2 + 0.05), ay = h + 0.3 + Math.sin(a) * w * 0.32; b.box(ax, ay, 0.05, w / 6.2, 0.16, 0.1, shade(frame, 0.92), nk(CK.STONE, { rz: Math.PI / 2 - a })); }
  b.box(0, 0, 0.07, w + 0.3, 0.05, 0.14, '#b8a47e', nk(CK.COPING));                                       // eşik taşı: alçak (5 cm) ve duvara yapışık — çarpışmasız (sunucu = istemci)
}
// ── Duvar lambası, yağmur borusu, klima, kablo, tabela ──
export function cgLamp(b, { y = 2.8 }) {
  b.box(0, y + 0.16, 0.06, 0.08, 0.08, 0.12, '#2a2c2e', nk(CK.METAL));
  b.box(0, y - 0.1, 0.16, 0.16, 0.26, 0.16, '#ffd98a', { collide: false, o: { glow: true } });
  b.box(0, y + 0.16, 0.16, 0.24, 0.04, 0.24, '#2a2c2e', nk(CK.METAL)); b.box(0, y - 0.13, 0.16, 0.2, 0.03, 0.2, '#2a2c2e', nk(CK.METAL));
}
export function cgPipe(b, { h, y0 = 0 }) {
  b.box(0, y0, 0.06, 0.1, h - 0.3, 0.1, '#6b6f72', nk(CK.METAL));
  b.box(0, y0 + h - 0.3, 0.07, 0.18, 0.16, 0.14, '#5a5e61', nk(CK.METAL));
  for (const yy of [0.9, 2.2, h * 0.6, h - 0.8]) if (yy < h - 0.5) b.box(0, y0 + yy, 0.065, 0.16, 0.05, 0.13, '#3b3e41', nk(CK.METAL));
  b.box(0, y0, 0.065, 0.16, 0.12, 0.13, '#4b4e51', nk(CK.METAL));
}
export function cgAC(b, { y }) {
  b.box(0, y, 0.2, 0.9, 0.6, 0.4, '#c4c7c6', nk(CK.METAL));
  b.cyl(0.12, y + 0.3, 0.405, 0.22, 0.22, 0.02, '#3a3d3f', { seg: 12, collide: false, rx: Math.PI / 2, kind: CK.METAL });
  for (const s of [-1, 1]) b.box(s * 0.36, y - 0.08, 0.14, 0.05, 0.08, 0.28, '#555a5e', nk(CK.METAL));
}
// büyük saha harfi (A / B): yeşil levha (duvara yapışık)
export function cgSiteSign(b, { y, letter }) {
  b.box(0, y, 0.04, 3.4, 3.4, 0.08, '#2f7a6e', nk(CK.PAINT)); b.box(0, y + 0.2, 0.09, 3.0, 3.0, 0.02, '#efe6cc', nk(CK.PAINT));
  const K = '#2b3036', o = (rz) => nk(CK.PAINT, { rz });
  if (letter === 'A') { b.box(-0.5, y + 0.6, 0.11, 0.36, 2.25, 0.02, K, o(-0.28)); b.box(0.5, y + 0.6, 0.11, 0.36, 2.25, 0.02, K, o(0.28)); b.box(0, y + 1.25, 0.115, 1.0, 0.3, 0.02, K, o(0)); }
  else {                                                                              // B: dikey gövde + iki çanak (alttaki geniş)
    b.box(-0.6, y + 0.6, 0.11, 0.38, 2.3, 0.02, K, o(0));
    b.box(-0.05, y + 0.6, 0.11, 1.1, 0.34, 0.02, K, o(0)); b.box(-0.12, y + 1.62, 0.11, 0.96, 0.3, 0.02, K, o(0)); b.box(-0.12, y + 2.56, 0.11, 0.96, 0.34, 0.02, K, o(0));
    b.box(0.62, y + 0.82, 0.115, 0.36, 0.86, 0.02, K, o(0)); b.box(0.5, y + 1.86, 0.115, 0.36, 0.76, 0.02, K, o(0));
  }
}
