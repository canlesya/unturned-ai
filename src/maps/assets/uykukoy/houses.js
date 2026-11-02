import { MapBuilder } from '../../builder.js';
import { CK } from '../common/cgSurface.js';
import { NC, shade, cgCrate, CRATE_COL } from '../common/cgKit.js';

// Kum Köyü girilen evleri (12.224): Konak (iki katlı, orta çizgide tek bina, iki iç merdiven) ve Damlı Ev (tek katlı, dışarıdan merdivenle çıkılan
// yürünür dam; her yarıda bir). Duvarlar ayak izinin İÇİNDE (dış yüz plan sınırında), boşluklar gerçek delik (kapı 1,6 m, pencere denizliği 1 m:
// içinden ateş edilir / atlanır). Her katı parça eksen hizalı kutu, görünen = çarpışma; süs (söve, lento, kepenk, kiriş) çarpışmasız ve katı yüze yapışık
// ≤ 0,08 m. Kat döşemesi / dam / merdiven 'plat' etiketli (yol ızgarası: üst kat), alt kat CgNav alt katı (uykukoy.js makeNav).
export const WALL_T = 0.4, STOREY = 3.2, SLAB = 0.25;
const k = (kind, o = {}) => ({ ...o, kind }), n = (kind, o = {}) => ({ collide: false, ...o, kind });
const FRAME = '#dcc9a0', WOOD = '#7a5b3a', WOOD_D = '#5e4529', FLOOR_W = '#8d7050', SHUT = ['#4f6b55', '#3d5f7a', '#8a4a37', '#2f6f8a'];

// eksen hizalı dikdörtgen çıkarma: r − holes → dikdörtgen listesi
function subtract(r, holes) {
  let out = [r];
  for (const h of holes) {
    const next = [];
    for (const [x0, z0, x1, z1] of out) {
      const ix0 = Math.max(x0, h[0]), iz0 = Math.max(z0, h[1]), ix1 = Math.min(x1, h[2]), iz1 = Math.min(z1, h[3]);
      if (ix0 >= ix1 - 1e-6 || iz0 >= iz1 - 1e-6) { next.push([x0, z0, x1, z1]); continue; }
      if (z0 < iz0 - 1e-6) next.push([x0, z0, x1, iz0]);
      if (iz1 < z1 - 1e-6) next.push([x0, iz1, x1, z1]);
      if (x0 < ix0 - 1e-6) next.push([x0, iz0, ix0, iz1]);
      if (ix1 < x1 - 1e-6) next.push([ix1, iz0, x1, iz1]);
    }
    out = next;
  }
  return out;
}

// dış yüze söve / lento / denizlik (+ pencerede açık kepenk). side: 'n' (−z yüzü), 's' (+z), 'w' (−x), 'e' (+x); plane: dış yüz düzlemi
function trim(b, side, plane, at, w, y0, b0, top, seed, vis, shut = true) {
  if (!vis) return;
  const ax = side === 'n' || side === 's', sg = side === 's' || side === 'e' ? 1 : -1, d = 0.07, o = plane + sg * d / 2;
  const B = (u, uw, y, h, dd = d, oo = o, col = FRAME, kind = CK.COPING) => (ax ? b.box(u, y, oo, uw, h, dd, col, n(kind)) : b.box(oo, y, u, dd, h, uw, col, n(kind)));
  B(at, w + 0.36, y0 + top, 0.2);                                                           // lento
  for (const s of [-1, 1]) B(at + s * (w / 2 + 0.09), 0.18, y0 + b0, top - b0, d, o, shade(FRAME, 0.95), CK.STONE);   // söveler
  if (b0 > 0.2) {
    B(at, w + 0.3, y0 + b0 - 0.1, 0.1, 0.12, plane + sg * 0.06);                             // denizlik
    const sc = SHUT[seed % SHUT.length];
    if (shut && seed % 3 !== 2) for (const s of [-1, 1]) B(at + s * (w / 2 + 0.18 + w / 4), w / 2, y0 + b0 + 0.02, top - b0 - 0.04, 0.035, plane + sg * 0.095, sc, CK.PAINT);   // açık kepenk (sövenin dışında, duvara yaslı)
  }
}

// genel ev gövdesi: dört duvar (kat kat), boşluklar { s|n|w|e: [{ at, w, b, top }] } her kat için
function shellStorey(b, H, y0, h, ops, col, seedBase, vis) {
  const { x0, z0, x1, z1 } = H, t = WALL_T, opt = k(CK.PLASTER, { tag: 'wall' });
  b.wall('x', x0, x1, z0 + t / 2, y0, h, t, col, ops.n || [], opt);
  b.wall('x', x0, x1, z1 - t / 2, y0, h, t, col, ops.s || [], opt);
  b.wall('z', z0 + t, z1 - t, x0 + t / 2, y0, h, t, col, ops.w || [], opt);
  b.wall('z', z0 + t, z1 - t, x1 - t / 2, y0, h, t, col, ops.e || [], opt);
  let s = seedBase;
  for (const [side, plane] of [['n', z0], ['s', z1], ['w', x0], ['e', x1]]) for (const o of ops[side] || []) trim(b, side, plane, o.at, o.w, y0, o.b, o.top, s++, vis, o.shut !== false);
}
const door = (at, w = 1.6) => ({ at, w, b: 0, top: 2.3 });
const win = (at, w = 1.1, b0 = 1.0, top = 2.1, shut = true) => ({ at, w, b: b0, top, shut });

// iç döşeme (üst kat): duvar içi, delikler hariç
function slab(b, H, y, holes, color, tag = 'plat') {
  const t = WALL_T;
  for (const [a, c, e, f] of subtract([H.x0 + t, H.z0 + t, H.x1 - t, H.z1 - t], holes)) b.box((a + e) / 2, y - SLAB, (c + f) / 2, e - a, SLAB, f - c, color, k(CK.WOOD, { tag }));
}
// tavan kirişleri (döşemenin altına yapışık, çarpışmasız; ≥ 2,7 m)
function beams(b, H, yBottom, holes, vis) {
  if (!vis) return;
  const t = WALL_T;
  for (let x = H.x0 + t + 0.9; x < H.x1 - t - 0.3; x += 1.4) {
    const segs = subtract([x - 0.09, H.z0 + t, x + 0.09, H.z1 - t], holes);
    for (const [a, c, e, f] of segs) b.box((a + e) / 2, yBottom - 0.16, (c + f) / 2, e - a, 0.16, f - c, WOOD_D, n(CK.WOOD));
  }
}
// düz dam / çatı: tam ayak izi döşeme + kenar korkuluğu (gap: korkuluksuz kenar parçaları [x0, x1] ya da [z0, z1])
function roof(b, H, y, { th = SLAB, para = 0.5, pt = 0.3, tag = 'roof', gaps = {}, color }) {
  const { x0, z0, x1, z1 } = H;
  b.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, th, z1 - z0, color, k(CK.ROOF, { tag }));
  const top = y + th, pc = shade(color, 1.08), po = k(CK.PLASTER, { tag: 'wall' });
  const run = (axis, a0, a1, c, gap) => {
    const parts = gap ? [[a0, gap[0]], [gap[1], a1]] : [[a0, a1]];
    for (const [p0, p1] of parts) if (p1 - p0 > 0.05) axis === 'x' ? b.box((p0 + p1) / 2, top, c, p1 - p0, para, pt, pc, po) : b.box(c, top, (p0 + p1) / 2, pt, para, p1 - p0, pc, po);
  };
  run('x', x0, x1, z0 + pt / 2, gaps.n); run('x', x0, x1, z1 - pt / 2, gaps.s);
  run('z', z0 + pt, z1 - pt, x0 + pt / 2, gaps.w); run('z', z0 + pt, z1 - pt, x1 - pt / 2, gaps.e);
  return top;
}
// merdiven yüzü (yalnız görsel, basamağa yapışık ≤ 2 cm): açık ton basamak kaplaması + koyu burun şeridi. b.stairs süsünün korkulukları basamak
// içinde çarpışmasız kaldığı için kullanılmaz (içinden geçilen görsel olmasın); duvar tarafı zaten duvar.
function stepFaces(b, x, zc, y0, steps, rise, run, width, color, vis) {
  if (!vis) return;
  const light = shade(color, 1.16), dark = shade(color, 0.62);
  for (let i = 0; i < steps; i++) {
    const top = y0 + (i + 1) * rise;
    b.box(x + i * run + run / 2, top, zc, run, 0.02, width, light, n(CK.STONE));
    b.box(x + i * run + 0.03, top - 0.004, zc, 0.05, 0.04, width + 0.02, dark, n(CK.STONE));
  }
}
const crate = (b, id, x, y, z, w, h, d, seed) => b.obj(id, () => cgCrate(b, { x, y, z, w, h, d, color: CRATE_COL[seed % CRATE_COL.length], seed }));
function table(b, id, x, z, y = 0, w = 1.6, d = 0.8, vis = true) {
  b.obj(id, () => {
    b.box(x, y + 0.72, z, w, 0.06, d, '#7a5b3a', k(CK.WOOD, { tag: 'prop' }));                        // tabla (çarpışmalı; altından geçilmez: bacaklar arası doldurulmaz ama 0,72 m altı eğilmeye yetmez)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * (w / 2 - 0.06), y, z + sz * (d / 2 - 0.06), 0.08, 0.72, 0.08, WOOD_D, k(CK.WOOD, { tag: 'prop' }));
    if (vis) b.box(x - w * 0.2, y + 0.78, z, 0.3, 0.12, 0.22, '#c9b38a', n(CK.CLOTH));
  });
}

// ── KONAK: iki katlı, orta çizgide (z −5…5). Zemin kat: güney / kuzey sokak kapısı, batıda iki kapı (Konak Önü), doğuda kapı (Arka Geçit); bölme duvarı
// z = 0 (batı yarısı) güney kapısından kuzey kapısına düz görüşü keser. Merdivenler güney / kuzey duvar boyunca doğuya çıkar; üst kat tek oda, dört yön pencere.
export function buildKonak(b, H, col) {
  const vis = !MapBuilder.noVisual, t = WALL_T, y1 = STOREY, top = 6.0;
  const stairX0 = 19.5, steps = 11, run = 0.5, rise = STOREY / steps, sw = 1.3;
  const holes = [[stairX0, H.z1 - t - sw, stairX0 + steps * run, H.z1 - t], [stairX0, H.z0 + t, stairX0 + steps * run, H.z0 + t + sw]];
  b.obj('konak', () => {
    shellStorey(b, H, 0, y1, {
      s: [door(18.3)], n: [door(18.3)],
      w: [door(2.3), door(-2.3)],
      e: [door(0), win(2.4, 1.0), win(-2.4, 1.0)],
    }, col, 1, vis);
    shellStorey(b, H, y1, top - y1, {
      s: [win(18.3, 1.1, 0.95, 2.05), win(22.6, 1.1, 0.95, 2.05)], n: [win(18.3, 1.1, 0.95, 2.05), win(22.6, 1.1, 0.95, 2.05)],
      w: [win(2.6, 1.1, 0.95, 2.05), win(-2.6, 1.1, 0.95, 2.05)],                    // ortada pencere yok: Batı Geçidi'ne 50 m'lik düz görüş
      e: [win(0, 1.1, 0.95, 2.05), win(3.2, 1.0, 0.95, 2.05), win(-3.2, 1.0, 0.95, 2.05)],
    }, col, 7, vis);
    slab(b, H, y1, holes, FLOOR_W);
    beams(b, H, y1 - SLAB, holes, vis);
    // bölme duvarı (zemin kat, batı yarısı; tavana kadar)
    b.box((H.x0 + t + 21) / 2, 0, 0, 21 - (H.x0 + t), y1 - SLAB, 0.4, shade(col, 0.97), k(CK.PLASTER, { tag: 'wall' }));
    // merdivenler (zemin → üst kat), merdiven boşluğu korkuluğu (üst katta)
    for (const sz of [1, -1]) {
      const zc = sz > 0 ? H.z1 - t - sw / 2 : H.z0 + t + sw / 2, edge = sz > 0 ? H.z1 - t - sw : H.z0 + t + sw;
      b.stairs(stairX0, zc, 0, '+x', sw, steps, rise, run, '#b59a72', { tag: 'plat', deco: false });
      stepFaces(b, stairX0, zc, 0, steps, rise, run, sw, '#b59a72', vis);
      b.box((stairX0 + stairX0 + steps * run) / 2, y1, edge - sz * 0.05, steps * run, 1.0, 0.1, WOOD, k(CK.WOOD, { tag: 'wall' }));
      b.box(stairX0 - 0.05, y1, zc, 0.1, 1.0, sw, WOOD, k(CK.WOOD, { tag: 'wall' }));
      // merdiven başı sahanlığının altı dolu (kerpiç): zemin katta merdiven ucuyla duvar arasında bot / oyuncu sıkışan çıkmaz cep kalmasın
      const lx0 = stairX0 + steps * run, lx1 = H.x1 - t;
      b.box((lx0 + lx1) / 2, 0, zc, lx1 - lx0, y1 - SLAB, sw, shade(col, 0.95), k(CK.PLASTER, { tag: 'wall' }));
    }
    roof(b, H, top, { color: shade(col, 0.84) });
  });
  // eşya: zemin kat masa + sandıklar (yarı siper), üst kat pencere önü sandıklar
  table(b, 'konak:masa:g', 23.2, 1.6, 0, 1.6, 0.8, vis); table(b, 'konak:masa:k', 23.2, -1.6, 0, 1.6, 0.8, vis);
  crate(b, 'konak:sandık:0', 17.3, 0, 0.9, 1.0, 1.0, 1.0, 3); crate(b, 'konak:sandık:1', 17.3, 0, -0.9, 1.0, 1.0, 1.0, 5);
  crate(b, 'konak:sandık:2', 25.6, y1, 1.6, 1.2, 0.95, 0.9, 2); crate(b, 'konak:sandık:3', 25.6, y1, -1.6, 1.2, 0.95, 0.9, 6);
  crate(b, 'konak:sandık:4', 17.4, y1, 1.2, 1.0, 1.0, 1.2, 1); crate(b, 'konak:sandık:5', 17.4, y1, -1.2, 1.0, 1.0, 1.2, 4);
  if (vis) for (const sz of [1, -1]) b.obj('konak:fener:' + sz, () => { const lz = sz * 2.2; b.box(18.5, y1 - SLAB - 0.25, lz, 0.02, 0.25, 0.02, '#2a2c2e', n(CK.METAL)); b.box(18.5, y1 - SLAB - 0.5, lz, 0.22, 0.25, 0.22, '#ffd98a', { collide: false, o: { glow: true } }); });
  return { top, floor: y1 };
}

// ── DAMLI EV: tek katlı, yürünür dam (korkuluk 0,9 m). sgn = +1 güney yarısı (avlu kuzeyde, z0 tarafı), −1 kuzey yarısı (avlu güneyde, z1 tarafı).
// Dama dış merdiven: avlu tarafında duvar boyunca doğuya çıkar, uçta sahanlık (köy duvarına yaslı); korkuluk o kenarda açık.
export function buildDam(b, H, col, sgn, tag) {
  const vis = !MapBuilder.noVisual, t = WALL_T, y1 = STOREY;
  const yard = sgn > 0 ? 'n' : 's', far = sgn > 0 ? 's' : 'n';
  const steps = 12, run = 0.45, rise = (y1 + SLAB) / steps, sw = 1.3, sx0 = 26.9, sx1 = sx0 + steps * run;
  const zWall = sgn > 0 ? H.z0 : H.z1, zc = zWall - sgn * sw / 2;
  b.obj('dam:' + tag, () => {
    shellStorey(b, H, 0, y1, {
      [yard]: [door(25.9)], [far]: [],
      w: [win(sgn * 12.6), win(sgn * 14.9, 1.1, 1.0, 2.1, false), door(sgn * 17.0)],
      e: [],
    }, col, sgn > 0 ? 20 : 30, vis);
    beams(b, H, y1, [], vis);
    const roofTop = roof(b, H, y1, { para: 0.9, tag: 'plat', gaps: { [yard]: [30.6, H.x1] }, color: shade(col, 0.86) });
    // dış merdiven + sahanlık
    b.stairs(sx0, zc, 0, '+x', sw, steps, rise, run, shade(col, 0.92), { tag: 'plat', deco: false });
    stepFaces(b, sx0, zc, 0, steps, rise, run, sw, shade(col, 0.92), vis);
    b.box((sx1 + H.x1) / 2, 0, zc, H.x1 - sx1, roofTop, sw, shade(col, 0.92), k(CK.PLASTER, { tag: 'plat' }));
    if (vis) b.box((sx1 + H.x1) / 2, roofTop, zc, H.x1 - sx1, 0.02, sw, shade(col, 1.12), n(CK.COPING));
    return roofTop;
  });
  crate(b, `dam:${tag}:sandık:0`, 31.2, 0, sgn * 17.4, 1.1, 1.0, 1.0, 2);
  crate(b, `dam:${tag}:sandık:1`, 31.6, 0, sgn * 15.9, 1.0, 1.9, 1.0, 7);
  table(b, `dam:${tag}:masa`, 28.0, sgn * 14.2, 0, 1.4, 0.8, vis);
  crate(b, `dam:${tag}:dam-sandık`, 26.0, y1 + SLAB, sgn * 16.8, 1.0, 0.9, 1.0, 4);
  return { roof: y1 + SLAB, stair: [sx0, zWall - sgn * sw, sx1, zWall] };
}
