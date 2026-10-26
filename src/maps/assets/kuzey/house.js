import { KK } from './surface.js';
import { Q, footY, worldRect, shade, roundCollide } from '../common/kuzeyKit.js';

// Kuzey Vadisi köy yapıları (12.172): ev (1–2 kat, içine girilir, merdivenli), ahır, kilise. Hepsi yerel çerçevede kurulur:
// (x, z) merkez, ry = 90°'nin katı; kapı yerel +z yüzünde. Taban = ayak izindeki en yüksek arazi + 0,2; altı taş kaide (eğimli zeminde boşluk yok).
// Duvar 0,3 m (görünen = çarpışma), pencere / kapı gerçek açıklık (cam yarı saydam, çarpışmasız), kat döşemesi + merdiven çarpışmalı, çatı üçgeni
// basamaklı kutularla katı, kiremit / sac çatı düzlemleri yalnız görsel (üçgenin üstünde 0,14 m).
export const STONE = '#7f786c', TIMBER = '#5b4130';
const FH = 3.0, T = 0.3;

function winRow(len, n, bo, top, wv = 1.15, skip = null) {
  const out = [], step = len / (n + 1);
  for (let i = 1; i <= n; i++) { const at = -len / 2 + step * i; if (skip && Math.abs(at - skip.at) < skip.w / 2 + wv / 2 + 0.35) continue; out.push({ at, w: wv, b: bo, top, glass: true }); }
  return out;
}

function gableRoof(b, w, d, H, color, kind, wall, ov = 0.45) {
  // sırt yerel x boyunca (w ≥ d varsayılır). Üçgen alın: duvar renginde, katı (basamaklı); düzlemler kiremit / sac.
  const s = d / 2, rh = s * 0.72, a = Math.atan2(rh, s), L = (s + ov) / Math.cos(a), th = 0.14;
  b.withKind(KK.PLASTER, () => b.prism(0, H, 0, d, rh, w, wall, { ry: Q }));
  for (const sg of [1, -1]) {
    const zc = sg * (s + ov) / 2, yc = H + (s - ov) * Math.tan(a) / 2;                 // eğim çizgisinin ortası (sırt → saçak)
    b.box(0, yc + Math.cos(a) * th / 2 - th / 2, zc + sg * Math.sin(a) * th / 2, w + 2 * ov * 0.8, th, L, color, { collide: false, rx: sg * a, kind });
  }
  b.box(0, H + rh - 0.06, 0, w + 2 * ov * 0.8, 0.14, 0.26, shade(color, 0.8), { collide: false, kind });                         // mahya
  return rh;
}

// ── Köy evi ──
export function house(b, Tr, o) {
  const { x, z, w = 8, d = 6.5, floors = 2, ry = 0, wall = '#d6ccb8', roof = '#8a4a32', roofKind = KK.TILE, shutter = '#4b5a3a', seed = 1 } = o;
  const [x0, x1, z0, z1] = worldRect(x, z, w + 0.3, d + 0.3, ry);
  const fy = footY(Tr, x0, x1, z0, z1), y0 = fy.max + 0.2, H = floors * FH + 0.25;
  const id = o.id || `ev:${Math.round(x)}:${Math.round(z)}`;
  b.obj(id, () => b.with(x, y0, z, ry, () => {
    // kaide
    b.box(0, fy.min - 0.45 - y0, 0, w + 0.3, y0 - fy.min + 0.45, d + 0.3, STONE, { kind: KK.STONE });
    // kapı ve pencereler
    const door = { at: (seed % 3 - 1) * w * 0.18, w: 1.2, b: 0, top: 2.3 };
    const nW = Math.max(1, Math.round(w / 2.6)), nD = Math.max(1, Math.round(d / 2.8));
    // kat başına ayrı duvar bandı (aynı duvarda üst üste açıklık wall() ile tek çağrıda olmaz)
    const opsF = (k) => ({ s: [...(k ? [] : [door]), ...winRow(w, nW, 0.95, 2.2, 1.1, k ? null : door)], n: winRow(w, nW, 0.95, 2.2), e: winRow(d, nD, 0.95, 2.2), w: winRow(d, nD, 0.95, 2.2) });
    const ops = { s: [], n: [], e: [], w: [] };
    for (let k = 0; k < floors; k++) {
      const o2 = opsF(k);
      for (const q in o2) ops[q].push(...o2[q].map((op) => ({ ...op, b: op.b + k * FH, top: op.top + k * FH })));
      b.withKind(KK.PLASTER, () => b.shell(-w / 2 + T / 2, w / 2 - T / 2, -d / 2 + T / 2, d / 2 - T / 2, k * FH, k === floors - 1 ? H - k * FH : FH, T, wall, o2, { trim: '#e9e4d8', kind: KK.PLASTER }));
    }
    // köşe taşları + saçak bandı (görsel)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12), 0.32, H, 0.32, shade(wall, 0.9), { collide: false, kind: KK.STONE });
    b.box(0, H - 0.22, 0, w + 0.12, 0.22, d + 0.12, shade(wall, 0.82), { collide: false, kind: KK.PLASTER });
    // panjurlar (dış yüz)
    const sh = (axis, side, list) => { for (const op of list) { if (!op.glass) continue; const hh = op.top - op.b; for (const sd of [-1, 1]) {
      const at = op.at + sd * (op.w / 2 + 0.24);
      if (axis === 'x') b.box(at, op.b, side * (d / 2 + 0.03), 0.42, hh, 0.05, shutter, { collide: false, kind: KK.PLANK });
      else b.box(side * (w / 2 + 0.03), op.b, at, 0.05, hh, 0.42, shutter, { collide: false, kind: KK.PLANK });
    } } };
    sh('x', 1, ops.s); sh('x', -1, ops.n); sh('z', 1, ops.e); sh('z', -1, ops.w);
    // kapı önü basamakları (kaide arazinin 0,45 m'den fazla üstündeyse)
    const dwx = x + Math.cos(ry) * door.at + Math.sin(ry) * (d / 2 + 0.6), dwz = z - Math.sin(ry) * door.at + Math.cos(ry) * (d / 2 + 0.6);
    const hd = y0 - Tr.heightAt(dwx, dwz);
    if (hd > 0.45) { const n = Math.ceil(hd / 0.4); for (let k = 1; k < n; k++) b.box(door.at, -hd - 0.3, d / 2 + 0.15 + k * 0.36 - 0.18, 1.6, hd + 0.3 - k * hd / n, 0.36, STONE, { kind: KK.STONE }); }
    // kat döşemesi + merdiven (arka duvar boyunca, +x yönüne çıkar)
    const iw = w - 2 * T, id2 = d - 2 * T;
    if (floors > 1) {
      const steps = 12, rise = FH / steps, run = 0.27, sw = 1.0, sl = steps * run, xs = -iw / 2 + 0.2, zs = -id2 / 2 + sw / 2;
      b.stairs(xs, zs, 0, '+x', sw, steps, rise, run, '#6d5440');
      const hz0 = -id2 / 2, hz1 = hz0 + sw + 0.05, slabY = FH - 0.22;
      b.box(0, slabY, (hz1 + id2 / 2) / 2, iw, 0.22, id2 / 2 - hz1, '#7a5d44', { kind: KK.PLANK });                     // döşeme (ön)
      const xr0 = xs + sl + 0.05;
      if (iw / 2 - xr0 > 0.3) b.box((xr0 + iw / 2) / 2, slabY, (hz0 + hz1) / 2, iw / 2 - xr0, 0.22, hz1 - hz0, '#7a5d44', { kind: KK.PLANK });   // sahanlık
      if (xs + iw / 2 > 0.3) b.box((-iw / 2 + xs) / 2, slabY, (hz0 + hz1) / 2, xs + iw / 2, 0.22, hz1 - hz0, '#7a5d44', { kind: KK.PLANK });
      b.box(xs + sl / 2, FH - 0.22 + 0.22, hz1 + 0.04, sl - 0.2, 0.9, 0.06, '#5b4130', { collide: false, kind: KK.PLANK });          // merdiven boşluğu korkuluğu (görsel)
    }
    b.box(0, H - 0.2, 0, iw, 0.2, id2, '#8c7a64', { kind: KK.PLANK });                                                        // tavan (çatı arası kapalı)
    // çatı + baca
    const rh = gableRoof(b, w, d, H, roof, roofKind, wall);
    b.box(w * 0.26, H, -d * 0.12, 0.62, rh + 0.9, 0.62, shade(wall, 0.85), { collide: false, kind: KK.PLASTER });
    b.box(w * 0.26, H + rh + 0.9, -d * 0.12, 0.76, 0.12, 0.76, '#5e5a55', { collide: false, kind: KK.CONC });
  }));
  return { y0, rect: [x0, x1, z0, z1] };
}

// ── Ahır (ahşap, büyük kapı, sac çatı, saman) ──
export function barn(b, Tr, o) {
  const { x, z, w = 14, d = 9, h = 5.2, ry = 0, wall = '#7a4f34', roof = '#646c72' } = o;
  const [x0, x1, z0, z1] = worldRect(x, z, w + 0.3, d + 0.3, ry);
  const fy = footY(Tr, x0, x1, z0, z1), y0 = fy.max + 0.15;
  b.obj(o.id || `ahır:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    b.box(0, fy.min - 0.4 - y0, 0, w + 0.3, y0 - fy.min + 0.4, d + 0.3, STONE, { kind: KK.STONE });
    const ops = { s: [{ at: 0, w: 3.8, b: 0, top: 4.0 }], n: [{ at: w * 0.3, w: 1.2, b: 0, top: 2.3 }], e: [{ at: 0, w: 0.9, b: 2.6, top: 3.4, glass: true }], w: [{ at: 0, w: 0.9, b: 2.6, top: 3.4, glass: true }] };
    b.withKind(KK.PLANK, () => b.shell(-w / 2 + 0.15, w / 2 - 0.15, -d / 2 + 0.15, d / 2 - 0.15, 0, h, 0.3, wall, ops, { trim: '#5b4130', kind: KK.PLANK }));
    for (const sx of [-1, 1]) b.box(sx * 2.1, 0, d / 2 + 0.05, 0.22, 4.2, 0.12, '#e6dfd0', { collide: false, kind: KK.PLANK });     // kapı pervazı
    b.box(0, 4.0, d / 2 + 0.05, 4.4, 0.22, 0.12, '#e6dfd0', { collide: false, kind: KK.PLANK });
    b.box(-w / 2 + 2.2, 0, d / 2 + 1.1, 1.8, 1.0, 0.6, '#8b6a42', { collide: true, kind: KK.PLANK, ry: 0 });                      // yemlik
    b.box(0, h - 0.2, 0, w - 0.6, 0.2, d - 0.6, '#6d5440', { kind: KK.PLANK });
    gableRoof(b, w, d, h, roof, KK.SHEET, wall, 0.6);
    for (const [hx, hz] of [[-w / 2 + 1.4, -d / 2 + 1.4], [-w / 2 + 2.8, -d / 2 + 1.4], [-w / 2 + 1.4, -d / 2 + 2.8]]) { b.cyl(hx, 0.6, hz, 0.6, 0.6, 1.2, '#cdb066', { rx: Q, center: true, seg: 10, collide: false }); b.collide(hx, 0, hz, 1.0, 1.15, 1.15); }
  }));
  return { y0, rect: [x0, x1, z0, z1] };
}

// ── Kilise (taş, çan kulesi) ──
export function church(b, Tr, o) {
  const { x, z, ry = 0, w = 10, d = 20, h = 8.5 } = o;
  const [x0, x1, z0, z1] = worldRect(x, z, w + 6, d + 4, ry);
  const fy = footY(Tr, x0, x1, z0, z1), y0 = fy.max + 0.25, ST = '#8b857a', RO = '#6f4632';
  b.obj(o.id || 'kilise', () => b.with(x, y0, z, ry, () => {
    b.box(0, fy.min - 0.5 - y0, 1, w + 6.3, y0 - fy.min + 0.5, d + 4.3, STONE, { kind: KK.STONE });
    // nef (uzun eksen yerel z) — kapı +z, sivri pencereler
    const win = (n) => Array.from({ length: n }, (_, i) => ({ at: -d / 2 + (i + 1) * d / (n + 1), w: 1.0, b: 2.4, top: 5.6, glass: true }));
    b.withKind(KK.STONE, () => b.shell(-w / 2 + 0.3, w / 2 - 0.3, -d / 2 + 0.3, d / 2 - 0.3, 0, h, 0.6, ST, { s: [{ at: 0, w: 1.9, b: 0, top: 3.4 }], e: win(4), w: win(4) }, { trim: '#cfc8bb', kind: KK.STONE }));
    b.box(0, h - 0.25, 0, w - 1.2, 0.25, d - 1.2, '#5b4b3c', { kind: KK.PLANK });
    // çatı (sırt z boyunca): alın üçgeni taş, düzlem kiremit
    const s = w / 2, rh = s * 0.95, a = Math.atan2(rh, s), L = (s + 0.4) / Math.cos(a);
    b.withKind(KK.STONE, () => b.prism(0, h, 0, w, rh, d, ST));
    for (const sg of [1, -1]) b.box(sg * ((s + 0.4) / 2 + Math.sin(a) * 0.08), h + (s - 0.4) * Math.tan(a) / 2 + Math.cos(a) * 0.08 - 0.08, 0, L, 0.16, d + 0.6, RO, { collide: false, rz: -sg * a, kind: KK.TILE });
    // apsis (arka, basamaklı yarım sekizgen)
    b.box(0, 0, -d / 2 - 1.6, w * 0.6, h * 0.7, 3.2, ST, { kind: KK.STONE });
    b.box(0, 0, -d / 2 - 3.6, w * 0.34, h * 0.7, 1.0, ST, { kind: KK.STONE });
    b.box(0, h * 0.7, -d / 2 - 2.1, w * 0.64, 0.3, 4.4, RO, { collide: false, kind: KK.TILE });
    // çan kulesi (ön sol köşe), sivri külah
    const tx = -w / 2 - 2.2, tz = d / 2 - 2.2, th = 19;
    b.box(tx, 0, tz, 4.6, th, 4.6, shade(ST, 0.96), { kind: KK.STONE });
    for (const [ax, az] of [[0, 2.32], [0, -2.32], [2.32, 0], [-2.32, 0]]) b.box(tx + ax, th - 3.6, tz + az, ax ? 0.04 : 1.1, 2.2, az ? 0.04 : 1.1, '#1c1b1a', { collide: false });   // çan pencereleri
    b.box(tx, th, tz, 5.2, 0.35, 5.2, '#cfc8bb', { kind: KK.STONE });
    b.cyl(tx, th + 0.35, tz, 0.05, 3.3, 8.5, RO, { seg: 4, ry: Math.PI / 4, collide: false, kind: KK.TILE });
    roundCollide(b, tx, th + 0.35, tz, 2.2, 3.0);
    b.cyl(tx, th + 8.85, tz, 0.06, 0.06, 1.6, '#3a3632', { collide: false, seg: 4 });
    b.box(tx, th + 9.75, tz, 0.9, 0.08, 0.08, '#3a3632', { collide: false });
  }));
  return { y0, rect: [x0, x1, z0, z1] };
}
