import { KK } from './surface.js';
import { Q, footY, worldRect, roundCollide, shade, lw, ctxAdd, addLoot, addDoor } from '../common/kuzeyKit.js';

// Kuzey Vadisi sanayi parçaları (12.172): çelik çerçeveli hal (oluklu sac, büyük kapılar, üst pencere bandı, içinde kolon + asma kat iskelesi),
// silo (yuvarlak, konik tepe, merdiven), tuğla baca, yakıt tankı, idare binası. Taban beton plak; ayak izinde arazi farkı beton kaide ile kapanır.
const CONC = '#8f8c85', STEEL = '#55606a';

function slab(b, Tr, x, z, w, d, ry, color = CONC) {
  const [x0, x1, z0, z1] = worldRect(x, z, w, d, ry), fy = footY(Tr, x0, x1, z0, z1), y0 = fy.max + 0.15;
  return { y0, fy, rect: [x0, x1, z0, z1], put: () => b.box(0, fy.min - 0.5 - y0, 0, w, y0 - fy.min + 0.5, d, color, { kind: KK.CONC }) };
}

// ── Fabrika hali ── (yerel: uzun eksen x, kapılar ±z yüzlerinde)
export function hall(b, Tr, o) {
  const { x, z, w = 40, d = 22, h = 9, ry = 0, wall = '#8f9aa1', trim = '#c2c8cc', roof = '#6a737a', doors = [[-0.25, 1], [0.25, -1]] } = o;
  const S = slab(b, Tr, x, z, w + 1, d + 1, ry);
  b.obj(o.id || `hal:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, S.y0, z, ry, () => {
    S.put();
    const t = 0.3, band = { b: h - 2.2, top: h - 0.9 };
    const strip = (len) => { const n = Math.floor(len / 4); return Array.from({ length: n }, (_, i) => ({ at: -len / 2 + (i + 0.5) * len / n, w: len / n - 1.2, ...band, glass: true })); };
    const ops = { s: strip(w), n: strip(w), e: strip(d), w: strip(d) };
    for (const [f, side] of doors) (side > 0 ? ops.s : ops.n).push({ at: f * w, w: 5.2, b: 0, top: 5.4 });
    for (const k of ['s', 'n']) ops[k] = ops[k].filter((q, i, a) => q.glass ? !a.some((r) => !r.glass && Math.abs(r.at - q.at) < r.w / 2 + q.w / 2 + 0.3) : true);   // duvar açıklıkları yatayda çakışmamalı
    ops.e.push({ at: d * 0.2, w: 1.2, b: 0, top: 2.3 });
    b.withKind(KK.CORR, () => b.shell(-w / 2 + t / 2, w / 2 - t / 2, -d / 2 + t / 2, d / 2 - t / 2, 0, h, t, wall, ops, { trim, kind: KK.CORR }));
    // taban bandı (beton), köşe kolonları, kapı çerçeveleri
    // 12.182 taban bandı (3 cm, dış yüzde) kapı açıklıklarında kesilir; dış kolonlar katı ve kapı önüne gelmez
    const doorAt = (side) => doors.filter(([, sd]) => sd === side).map(([f]) => [f * w - 2.75, f * w + 2.75]);
    for (const side of [1, -1]) { let cur = -w / 2 - 0.03; for (const [g0, g1] of [...doorAt(side), [w / 2 + 0.03, w / 2 + 0.03]].sort((a, q) => a[0] - q[0])) { if (g0 - cur > 0.05) b.box((cur + g0) / 2, 0, side * (d / 2 + 0.015), g0 - cur, 1.1, 0.03, shade(CONC, 0.95), { collide: false, kind: KK.CONC }); cur = g1; } }
    for (const sx of [1, -1]) { const e0 = sx > 0 ? [[d * 0.2 - 0.6, d * 0.2 + 0.6]] : []; let cur = -d / 2; for (const [g0, g1] of [...e0, [d / 2, d / 2]]) { if (g0 - cur > 0.05) b.box(sx * (w / 2 + 0.015), 0, (cur + g0) / 2, 0.03, 1.1, g0 - cur, shade(CONC, 0.95), { collide: false, kind: KK.CONC }); cur = g1; } }
    for (let i = 0; i <= Math.round(w / 6); i++) { const cx = -w / 2 + i * w / Math.round(w / 6); for (const sz of [-1, 1]) { if (doorAt(sz).some(([g0, g1]) => cx > g0 - 0.3 && cx < g1 + 0.3)) continue; b.box(cx, 0, sz * (d / 2 + 0.08), 0.36, h, 0.16, STEEL, { kind: KK.METAL }); } }
    for (const [f, side] of doors) { for (const sd of [-1, 1]) b.box(f * w + sd * 2.75, 0, side * (d / 2 + 0.1), 0.3, 5.7, 0.2, '#c9a227', { collide: false, kind: KK.METAL }); b.box(f * w, 5.4, side * (d / 2 + 0.1), 5.8, 0.3, 0.2, '#c9a227', { collide: false, kind: KK.METAL }); }
    // iç kolonlar + asma kat iskelesi (bir uçta, merdivenli)
    for (let i = 1; i < Math.round(w / 8); i++) { const cx = -w / 2 + i * w / Math.round(w / 8); for (const sz of [-1, 1]) b.box(cx, 0, sz * (d / 2 - 3), 0.4, h - 0.4, 0.4, STEEL, { kind: KK.METAL }); }
    const mz = -d / 2 + 0.3, md = 3.2, my = 4.2, mx0 = -w / 2 + 0.3, mlen = w * 0.45;
    b.box(mx0 + mlen / 2, my - 0.18, mz + md / 2, mlen, 0.18, md, '#5d6770', { kind: KK.METAL, tag: 'plat' });
    b.box(mx0 + mlen / 2, my, mz + md + 0.02, mlen, 1.0, 0.06, '#c9a227', { collide: false, kind: KK.METAL });
    b.collide(mx0 + mlen / 2, my, mz + md + 0.02, mlen, 1.0, 0.08);
    b.stairs(mx0 + mlen + 15 * 0.28, mz + 0.7, 0, '-x', 1.2, 15, my / 15, 0.28, '#5d6770');
    // çatı: alçak eğimli (sırt x boyunca), katı üçgen + sac düzlem + çatı feneri
    const rh = d * 0.12, a = Math.atan2(rh, d / 2), L = (d / 2 + 0.5) / Math.cos(a);
    b.withKind(KK.CORR, () => b.prism(0, h, 0, d, rh, w, wall, { ry: Q }));
    for (const sg of [1, -1]) b.box(0, h + (d / 2 - 0.5) * Math.tan(a) / 2 + Math.cos(a) * 0.07 - 0.07, sg * ((d / 2 + 0.5) / 2 + Math.sin(a) * 0.07), w + 0.6, 0.14, L, roof, { collide: false, rx: sg * a, kind: KK.SHEET });
    b.box(0, h + rh - 0.1, 0, w * 0.7, 1.0, 2.2, shade(roof, 0.9), { collide: false, kind: KK.SHEET });
    b.box(0, h + rh - 0.05, 1.12, w * 0.7, 0.75, 0.05, '#2a3238', { collide: false, kind: KK.WIN });
    // kapı üstü projektörler (gece yanar: parlak malzeme + zemin ışık havuzu)
    for (const [f, side] of doors) { b.box(f * w, 6.1, side * (d / 2 + 0.2), 0.12, 0.12, 0.4, '#3d4247', { collide: false, kind: KK.METAL }); b.box(f * w, 5.85, side * (d / 2 + 0.36), 0.7, 0.25, 0.32, '#ffe8b0', { collide: false, o: { glow: true, emissive: '#ffdca0', emissiveIntensity: 1 } }); }   // kollu projektör (duvara bağlı)
  }));
  addLoot(b, x, z, ry, S.y0, [[-w / 2 + 1.2, -d / 2 + 1.2, 'raf'], [w / 2 - 1.2, -d / 2 + 1.2, 'raf'], [w / 2 - 1.2, d / 2 - 1.2, 'zemin'], [-w / 4, d / 2 - 1.2, 'sandık'], [0, 0, 'zemin'], [w / 4, -d / 2 + 1.2, 'tezgâh'], [-w / 2 + w * 0.2, -d / 2 + 1.8, 'zemin', 4.2]]);
  for (const [f, side] of doors) { addDoor(b, x, z, ry, S.y0, f * w, side * d / 2, 0, side); const [px, pz] = lw(x, z, ry, f * w, side * (d / 2 + 7)); ctxAdd(b, 'lamps', [+px.toFixed(1), 0, +pz.toFixed(1), 9]); }
  return { y0: S.y0, rect: S.rect };
}

// ── Silo (yuvarlak, konik tepe) ──
export function silo(b, Tr, o) {
  const { x, z, r = 3.2, h = 16, color = '#b8b9b2' } = o;
  const fy = footY(Tr, x - r, x + r, z - r, z + r), y0 = fy.max + 0.1;
  b.obj(o.id || `silo:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, 0, () => {
    b.cyl(0, fy.min - 0.5 - y0, 0, r + 0.4, r + 0.4, y0 - fy.min + 0.5, CONC, { seg: 14, collide: false, kind: KK.CONC });
    roundCollide(b, 0, fy.min - 0.5 - y0, 0, r + 0.4, y0 - fy.min + 0.5);
    b.cyl(0, 0, 0, r, r, h, color, { seg: 16, collide: false, kind: KK.CORR });
    roundCollide(b, 0, 0, 0, r, h);
    for (let k = 1; k < 5; k++) b.cyl(0, k * h / 5, 0, r + 0.05, r + 0.05, 0.18, shade(color, 0.8), { seg: 16, collide: false, kind: KK.METAL });
    b.cyl(0, h, 0, 0.5, r + 0.1, r * 0.55, shade(color, 0.92), { seg: 16, collide: false, kind: KK.SHEET });
    roundCollide(b, 0, h, 0, r * 0.6, r * 0.3);
    for (let k = 0; k * 0.4 + 0.3 < h - 0.1; k++) b.box(0, k * 0.4 + 0.3, r + 0.18, 0.5, 0.04, 0.04, '#3d4247', { collide: false, kind: KK.METAL });   // merdiven basamakları
    for (const sd of [-1, 1]) b.box(sd * 0.27, 0, r + 0.18, 0.05, h, 0.05, '#3d4247', { collide: false, kind: KK.METAL });               // 12.182 korkuluk tabana iner
    for (let yy = 1.5; yy < h; yy += 3) b.box(0, yy, r + 0.05, 0.6, 0.06, 0.24, '#3d4247', { collide: false, kind: KK.METAL });           // silindire bağlantı lamaları
  }));
}

// ── Tuğla baca ──
export function chimney(b, Tr, o) {
  const { x, z, h = 38, r = 1.7 } = o, y0 = Tr.heightAt(x, z) - 0.3;
  b.obj(o.id || `baca:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, 0, () => {
    b.box(0, -0.6, 0, 2 * r + 1.6, 3.2, 2 * r + 1.6, CONC, { kind: KK.CONC });
    b.cyl(0, 2.6, 0, r * 0.62, r, h, '#8b4b37', { seg: 12, collide: false, kind: KK.BRICK });
    roundCollide(b, 0, 2.6, 0, r * 0.62, h);
    for (const k of [0.33, 0.66, 0.97]) b.cyl(0, 2.6 + h * k, 0, r * (1 - 0.38 * k) + 0.12, r * (1 - 0.38 * k) + 0.12, 0.6, '#5c3426', { seg: 12, collide: false, kind: KK.BRICK });
  }));
}

// ── Yakıt / su tankı (yatık değil, dik silindir; merdivenli) ──
export function tank(b, Tr, o) {
  const { x, z, r = 5, h = 7, color = '#cfd2cf' } = o;
  const fy = footY(Tr, x - r, x + r, z - r, z + r), y0 = fy.max + 0.2;
  b.obj(o.id || `tank:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, 0, () => {
    b.box(0, fy.min - 0.5 - y0, 0, 2 * r + 1.2, y0 - fy.min + 0.5, 2 * r + 1.2, CONC, { kind: KK.CONC });
    b.cyl(0, 0, 0, r, r, h, color, { seg: 20, collide: false, kind: KK.METAL });
    roundCollide(b, 0, 0, 0, r, h);
    b.cyl(0, h, 0, r * 0.15, r, 0.9, shade(color, 0.9), { seg: 20, collide: false, kind: KK.METAL });
    b.cyl(0, h * 0.5, 0, r + 0.04, r + 0.04, 0.9, '#b3392c', { seg: 20, collide: false, kind: KK.METAL });
  }));
}

// ── İdare binası (2 kat, beton + bant pencere, düz çatı) ──
export function office(b, Tr, o) {
  const { x, z, w = 16, d = 10, ry = 0, wall = '#b7b3a7' } = o;
  const S = slab(b, Tr, x, z, w + 0.6, d + 0.6, ry);
  const H = 6.6;
  b.obj(o.id || `idare:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, S.y0, z, ry, () => {
    S.put();
    const row = (len, yb, yt, door) => { const n = Math.max(1, Math.round(len / 2.6)); return Array.from({ length: n }, (_, i) => ({ at: -len / 2 + (i + 0.5) * len / n, w: len / n - 0.8, b: yb, top: yt, glass: true })).filter((q) => !door || Math.abs(q.at - door.at) > door.w / 2 + q.w / 2 + 0.2 || q.b > door.top); };
    const door = { at: 0, w: 1.6, b: 0, top: 2.4 };
    const ops0 = { s: [door, ...row(w, 0.9, 2.3, door)], n: row(w, 0.9, 2.3), e: [], w: [] }, ops1 = { s: row(w, 0.9, 2.3), n: row(w, 0.9, 2.3), e: row(d, 0.9, 2.3), w: row(d, 0.9, 2.3) };
    b.withKind(KK.CONC, () => b.shell(-w / 2 + 0.15, w / 2 - 0.15, -d / 2 + 0.15, d / 2 - 0.15, 0, 3.3, 0.3, wall, ops0, { trim: '#d8d5cc', kind: KK.CONC }));
    b.withKind(KK.CONC, () => b.shell(-w / 2 + 0.15, w / 2 - 0.15, -d / 2 + 0.15, d / 2 - 0.15, 3.3, H - 3.3, 0.3, wall, ops1, { trim: '#d8d5cc', kind: KK.CONC }));
    b.box(0, 3.1, 0, w - 0.6, 0.2, d - 0.6, '#77726a', { kind: KK.CONC });
    b.box(0, H - 0.2, 0, w - 0.6, 0.2, d - 0.6, '#77726a', { kind: KK.CONC });
    b.box(0, H, 0, w + 0.2, 0.5, d + 0.2, shade(wall, 0.85), { kind: KK.CONC });                               // korkuluk duvarı / çatı kenarı
    b.box(0, 2.4, d / 2 + 0.9, 3.4, 0.18, 1.8, '#5b636a', { collide: false, kind: KK.METAL });                  // kapı saçağı
  }));
  addLoot(b, x, z, ry, S.y0, [[-w / 2 + 1.0, -d / 2 + 1.0, 'masa'], [w / 2 - 1.0, -d / 2 + 1.0, 'raf'], [w / 4, d / 2 - 1.2, 'zemin']]);
  addDoor(b, x, z, ry, S.y0, 0, d / 2, 0, 1);
  for (let i = 0; i < Math.round(w / 2.6); i++) { const at = -w / 2 + (i + 0.5) * w / Math.round(w / 2.6); if ((i * 7 + Math.round(x)) % 3 === 0) continue; for (const [sz, yy] of [[1, 1.6], [-1, 1.6], [1, 4.9], [-1, 4.9]]) { const [wx, wz] = lw(x, z, ry, at, sz * (d / 2 + 0.02)), [qx, qz] = lw(0, 0, ry, 0, sz); ctxAdd(b, 'lights', [+wx.toFixed(2), +(S.y0 + yy).toFixed(2), +wz.toFixed(2), +qx.toFixed(3), +qz.toFixed(3), 1.6, 1.3]); } }
  return { y0: S.y0, rect: S.rect };
}
