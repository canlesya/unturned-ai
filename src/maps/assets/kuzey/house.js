import { KK } from './surface.js';
import { Q, footY, worldRect, shade, roundCollide, lw, ctxAdd, addLoot, addDoor } from '../common/kuzeyKit.js';
import { furnishRoom } from '../common/kasaba-furniture.js';
import { makeRng } from '../../builder.js';
// 12.182 Kasaba eşya kiti Kuzey malzemesinde (yüzey sınıfları KK): yeni mezra / çiftlik evlerinde (o.furnish) oda başı eşya tarifi
const FS = { k: { wood: KK.PLANK, plain: KK.PLAIN, metal: KK.METAL, paint: KK.PLASTER, stone: KK.STONE, conc: KK.CONC, corr: KK.CORR, dirt: KK.PLAIN, veg: KK.LEAF, board: KK.PLANK } };
const FURN = {
  alt: [['kitchenRun', 'stove', 'cabinet', 'shelf', { set: 'table2', chairs: 2 }, { corner: 'plant' }, { art: 1 }], ['shelf', 'cabinet', 'stove', { set: 'table', chairs: 4 }, 'cabinet', { corner: 'floorLamp' }, { corner: 'plant' }, { art: 2 }]],
  ust: [['bed2', 'wardrobe', 'dresser', { free: 'rug' }, { corner: 'plant' }, { art: 1 }], ['bed', 'bed', 'wardrobe', 'desk', { corner: 'floorLamp' }, { art: 1 }]],
};

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
  const sill = o.furnish ? 1.28 : 0.95;                                                            // 12.182 döşenmiş evde pencere eşiği yüksek (eşya pervaza değmez)
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
    const opsF = (k) => ({ s: [...(k ? [] : [door]), ...winRow(w, nW, sill, 2.2, 1.1, k ? null : door)], n: winRow(w, nW, sill, 2.2), e: winRow(d, nD, sill, 2.2), w: winRow(d, nD, sill, 2.2) });
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
    if (o.furnish) {
      // 12.182 döşenmiş ev (Kasaba eşya yerleştiricisi): kapı önü + merdiven / boşluk şeridi yürünür kalır, eşyalar birbirine / duvara girmez
      let sd = 7; for (const ch of id) sd = (Math.imul(sd, 31) + ch.charCodeAt(0)) >>> 0;
      const R = makeRng(sd), wins = (k) => ({ s: [], n: winRow(w, nW, sill, 2.2).map((q) => [q.at - q.w / 2 - 0.2, q.at + q.w / 2 + 0.2]), e: winRow(d, nD, sill, 2.2).map((q) => [q.at - q.w / 2 - 0.2, q.at + q.w / 2 + 0.2]), w: winRow(d, nD, sill, 2.2).map((q) => [q.at - q.w / 2 - 0.2, q.at + q.w / 2 + 0.2]) });
      const solid = { n: true, s: true, e: true, w: true }, x0 = -iw / 2, x1 = iw / 2, z0 = -id2 / 2, z1 = id2 / 2;
      const sw0 = winRow(w, nW, sill, 2.2, 1.1, door).map((q) => [q.at - q.w / 2 - 0.2, q.at + q.w / 2 + 0.2]);
      const stair = floors > 1 ? [x0, x0 + 0.2 + 12 * 0.27 + 0.6, z0, z0 + 1.0 + 1.1] : null;
      furnishRoom(b, FS, R, { x0, x1, z0, z1, y: 0, k: 0, type: 'ev', avoid: [[door.at - 0.9, door.at + 0.9, z1 - 1.4, z1], ...(stair ? [stair] : [])], wins: { ...wins(0), s: [...sw0, [door.at - 0.7, door.at + 0.7]] }, solid }, FURN.alt[sd & 1]);
      if (floors > 1) furnishRoom(b, FS, R, { x0, x1, z0, z1, y: FH, k: 1, type: 'ev', avoid: [[x0, x1, z0, z0 + 1.05 + 0.9]], wins: { ...wins(1), s: winRow(w, nW, sill, 2.2).map((q) => [q.at - q.w / 2 - 0.2, q.at + q.w / 2 + 0.2]) }, solid }, FURN.ust[(sd >>> 3) & 1]);
    } else {
      // iç eşya (BR / ganimet için): masa (üst tabla + ayaklar ayrı çarpışma; altı boş) + dolap (dolu kutu, duvara yaslı)
      const tx = iw * 0.12, tz = id2 * 0.16;
      b.box(tx, 0.72, tz, 1.3, 0.06, 0.8, '#7a5a3c', { kind: KK.PLANK });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(tx + sx * 0.58, 0, tz + sz * 0.33, 0.07, 0.72, 0.07, '#5b4130', { kind: KK.PLANK });
      b.box(iw / 2 - 0.23, 0, 0.6, 0.42, 1.85, 1.1, '#6d5440', { kind: KK.PLANK });
      if (floors > 1) b.box(-iw / 2 + 0.75, FH, id2 / 2 - 0.5, 1.4, 0.5, 0.9, '#8a7a64', { kind: KK.PLANK });                         // üst kat: sandık / yatak
    }
  }));
  // bağlam: ganimet noktaları, kapı (nav), gece pencere ışıkları (evlerin ~%60'ı), baca dumanı
  const iw = w - 2 * T, id2 = d - 2 * T;
  const door0 = (seed % 3 - 1) * w * 0.18;
  if (o.furnish) {                                                                                 // döşenmiş evde ganimet: kapı önü + merdiven sahanlığı (eşyasız şeritler)
    addLoot(b, x, z, ry, y0, [[door0, id2 / 2 - 0.7, 'zemin'], [-iw / 2 + 0.2 + 12 * 0.27 + 0.35, -id2 / 2 + 1.5, 'zemin']]);
    if (floors > 1) addLoot(b, x, z, ry, y0 + FH, [[iw / 2 - 0.6, -id2 / 2 + 0.55, 'zemin']]);
  } else {
    addLoot(b, x, z, ry, y0, [[iw * 0.12, id2 * 0.16, 'masa', 0.78], [iw / 2 - 0.85, 0.6, 'raf'], [-iw / 2 + 0.6, id2 / 2 - 0.6, 'zemin'], [iw / 2 - 0.6, -id2 / 2 + 0.6, 'zemin']]);
    if (floors > 1) addLoot(b, x, z, ry, y0 + FH, [[-iw / 2 + 0.75, id2 / 2 - 0.5, 'sandık', 0.5], [iw / 2 - 0.7, id2 / 2 - 0.7, 'zemin']]);
  }
  const door = (seed % 3 - 1) * w * 0.18;
  addDoor(b, x, z, ry, y0, door, d / 2, 0, 1);
  const H2 = floors * FH + 0.25;
  if ((Math.round(x * 7 + z * 3) & 7) < 5) {
    for (let k = 0; k < floors; k++) for (const side of ['s', 'n', 'e', 'w']) {
      const len = side === 's' || side === 'n' ? w : d, n = Math.max(1, Math.round(len / (side === 's' || side === 'n' ? 2.6 : 2.8)));
      for (const op of winRow(len, n, sill, 2.2, 1.1, side === 's' && !k ? { at: door, w: 1.2 } : null)) {
        if (Math.abs(Math.round(op.at * 13 + k * 5 + x)) % 3 === 0) continue;                                         // her pencere yanmaz
        const [lx, lz, nx, nz] = side === 's' ? [op.at, d / 2 + 0.02, 0, 1] : side === 'n' ? [op.at, -d / 2 - 0.02, 0, -1] : side === 'e' ? [w / 2 + 0.02, op.at, 1, 0] : [-w / 2 - 0.02, op.at, -1, 0];
        const [wx, wz] = lw(x, z, ry, lx, lz), [qx, qz] = lw(0, 0, ry, nx, nz);
        ctxAdd(b, 'lights', [+wx.toFixed(2), +(y0 + k * FH + 1.575).toFixed(2), +wz.toFixed(2), +qx.toFixed(3), +qz.toFixed(3), op.w, 1.25]);
      }
    }
  }
  const [cx, cz] = lw(x, z, ry, w * 0.26, -d * 0.12);
  ctxAdd(b, 'chimneys', [+cx.toFixed(2), +(y0 + H2 + (d / 2) * 0.72 + 1.05).toFixed(2), +cz.toFixed(2)]);
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
    if (w >= 8) b.box(w / 2 - 0.6, 0, 0, 0.6, 1.0, 1.8, '#8b6a42', { collide: true, kind: KK.PLANK, ry: 0 });                   // yemlik (12.182: içeride, yan duvara yaslı; dışarıda havada kalıyordu)
    b.box(0, h - 0.2, 0, w - 0.6, 0.2, d - 0.6, '#6d5440', { kind: KK.PLANK });
    gableRoof(b, w, d, h, roof, KK.SHEET, wall, 0.6);
    for (const [hx, hz] of (w >= 8 ? [[-w / 2 + 1.4, -d / 2 + 1.4], [-w / 2 + 2.8, -d / 2 + 1.4], [-w / 2 + 1.4, -d / 2 + 2.8]] : [[-w / 2 + 1.0, -d / 2 + 1.1]])) { b.cyl(hx, 0.6, hz, 0.6, 0.6, 1.2, '#cdb066', { rx: Q, center: true, seg: 10, collide: false }); b.collide(hx, 0, hz, 1.0, 1.15, 1.15); }   // küçük kulübede tek balya (ganimet noktaları boş kalır)
  }));
  addLoot(b, x, z, ry, y0, w >= 8 ? [[w / 2 - 1.2, -d / 2 + 1.2, 'zemin'], [0, -d / 2 + 1.0, 'sandık'], [w / 2 - 1.2, d / 2 - 1.4, 'zemin']] : [[w / 2 - 0.8, -d / 2 + 0.8, 'zemin'], [0.3, -d / 2 + 0.8, 'sandık']]);
  addDoor(b, x, z, ry, y0, 0, d / 2, 0, 1);
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
  addLoot(b, x, z, ry, y0, [[0, -d / 2 + 1.4, 'tezgâh'], [w / 2 - 1.0, 0, 'zemin'], [-w / 2 + 1.0, -d / 4, 'zemin']]);
  addDoor(b, x, z, ry, y0, 0, d / 2, 0, 1);
  return { y0, rect: [x0, x1, z0, z1] };
}
