import { UK } from './us-surface.js';
import { PAL, LAMP_WARM, LAMP_COOL, LAMP_RED, cutRects } from './us-kit.js';
import { milBlock, roofAC, roofVent, FH, PL } from './us-building.js';
import { sandbags, beacon, crate } from './us-props.js';

// Askeri Üs v3 — orta boy yapılar: konteyner, gözetleme kulesi, kontrol kulesi, radar istasyonu, sığınak (bunker), tünel, yakıt tankı, boru rafı, helipad, garaj sırası,
// akaryakıt istasyonu, çadır. Hepsi yerel çerçevede; kural us-kit.js başındaki gibi.

// yuvarlak gövdenin çarpışması: z kuşakları (her kuşağın x yarı genişliği kuşak ortasındaki kiriş; üst üste binmez)
export function roundCols(K, cx, cz, r, y0, h, n = 5) {
  for (let i = 0; i < n; i++) { const a = -1 + (2 * i) / n, b = a + 2 / n, m = (a + b) / 2, hw = r * Math.sqrt(1 - m * m); K.b.collide(cx, y0, cz + m * r, hw * 2, h, (b - a) * r); }
}

// ISO konteyner (20 / 40 ft): oluklu gövde (tek katı kutu), kapı ucunda kilit çubukları + köşe dökümleri (süs, 3 cm)
export function container(K, x, z, ry = 0, { len = 6.06, y = 0, col = '#2d5a8a', door = true } = {}) {
  K.b.with(x, y, z, ry, () => {
    const W = 2.44, H = 2.59;
    K.s(0, 0, 0, len, H, W, col, UK.CONT);
    if (door) { for (const sz of [-0.85, -0.3, 0.3, 0.85]) K.d(len / 2 + 0.015, 0.15, sz, 0.03, H - 0.3, 0.05, '#3a3d40', UK.STEEL); K.d(len / 2 + 0.015, 0.1, 0, 0.03, H - 0.2, 0.04, '#2a2d30', UK.STEEL); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.d(sx * (len / 2 + 0.015), H - 0.18, sz * (W / 2 - 0.1), 0.03, 0.16, 0.18, '#5a5d60', UK.STEEL);
  });
}

// gözetleme kulesi: 2 katlı beton kule (milBlock), dar pencereler, iç merdiven; çatı ulaşılmaz (projektör + anten + ikaz lambası)
export function guardTower(K, x, z, ry = 0, { s = 6, door = 's', wall = PAL.wallD, label = null } = {}) {
  K.b.with(x, 0, z, ry, () => {
    const h = s / 2, ix0 = -h + 0.3, iz0 = -h + 0.3;
    milBlock(K, {
      x0: -h, x1: h, z0: -h, z1: h, floors: 2, wall, winGap: 2.2, parapet: 1.0, canopy: true,
      doors: { [door]: [door === 'n' || door === 's' ? h - 1.4 : 0] },
      noWin: { [door]: [[-h, h]] },
      stairs: [{ x: ix0 + 0.7, z: iz0 + 0.05, dir: '+z', w: 1.25, f: 0 }],
      rooms: [{ f: 1, kind: 'tower', x0: ix0, x1: h - 0.3, z0: iz0, z1: h - 0.3 }],
      labels: label ? [{ side: door, t: label, at: -0.6, w: 1.6, h: 0.42 }] : [],
      roof: (K2, H) => { K2.s(h - 1.0, H, -h + 1.0, 0.8, 0.8, 0.8, PAL.steelD, UK.STEEL); K2.litS(h - 1.0, H + 0.8, -h + 1.0, 0.5, 0.35, 0.5, '#fff6d6'); K2.lamp(h - 1.0, H + 0.5, -h + 1.0, 14, 1.0, '#fff1d8');
        K2.s(-h + 0.9, H, h - 0.9, 0.12, 4.0, 0.12, PAL.steel, UK.STEEL); beacon(K2, -h + 0.9, H + 4.0, h - 0.9); },
    });
  });
}

// kontrol kulesi: 3 kat (üst kat geniş pencere bandı), çatıda anten direği + ikaz lambası; çatı ulaşılmaz
export function controlTower(K, x, z, ry = 0) {
  K.b.with(x, 0, z, ry, () => {
    const h = 3.5;
    milBlock(K, {
      x0: -h, x1: h, z0: -h, z1: h, floors: 3, wall: '#b3b6ad', band: '#5d6559', winGap: 1.75, parapet: 1.1,
      doors: { s: [1.6] }, noWin: { s: [[-h, h]] }, noWinFloor: [0],
      stairs: [{ x: -2.45, z: -3.15, dir: '+z', w: 1.25, f: 0 }, { x: -1.05, z: 1.24, dir: '-z', w: 1.25, f: 1 }],
      rooms: [{ f: 0, kind: 'radio', x0: -3.2, x1: 3.2, z0: -3.2, z1: 3.2 }, { f: 2, kind: 'ops', x0: -3.2, x1: 3.2, z0: -3.2, z1: 3.2 }],
      labels: [{ side: 's', t: 'KULE', at: -1.4, w: 1.6, h: 0.46, f: 2, y: 2.55 }],
      roof: (K2, H) => { K2.s(1.6, H, -1.6, 0.25, 7.0, 0.25, PAL.steel, UK.STEEL); beacon(K2, 1.6, H + 7.0, -1.6); roofAC(K2, -1.4, H, 1.6, 0); for (const sx of [-1, 1]) K2.d(1.6 + sx * 0.6, H + 5.0, -1.6, 1.0, 0.06, 0.06, PAL.steelD, UK.STEEL); },
    });
  });
}

// radar istasyonu: 2 katlı blok, çatıya merdivenle çıkılır; çatıda radar kaidesi + döner anten (süs, 2 m üstü) + radom
export function radarStation(K, x, z, ry = 0) {
  K.b.with(x, 0, z, ry, () => {
    const h = 5.0;
    const r = milBlock(K, {
      x0: -h, x1: h, z0: -h, z1: h, floors: 2, wall: '#a3a99c', band: '#4f5a4c', winGap: 2.6, parapet: 1.0, roofAccess: true,
      doors: { n: [-2.4], s: [2.4], w: [-2.4] },
      parts: [{ axis: 'x', c: 0.6, a0: -4.7, a1: 1.2, doors: [{ at: -2.7, w: 1.2 }], floors: [0, 1] }, { axis: 'z', c: 1.275, a0: -4.7, a1: 4.7, doors: [{ at: -2.4, w: 1.2 }, { at: 2.8, w: 1.2 }], floors: [0, 1] }],
      stairs: [{ x: 2.15, z: -4.65, dir: '+z', w: 1.25, f: 0 }, { x: 3.75, z: 3.5, dir: '-z', w: 1.25, f: 1 }],
      rooms: [{ f: 0, kind: 'computers', x0: -4.7, x1: 1.2, z0: -4.7, z1: 0.525 }, { f: 0, kind: 'radio', x0: -4.7, x1: 1.2, z0: 0.675, z1: 4.7 }, { f: 1, kind: 'ops', x0: -4.7, x1: 1.2, z0: -4.7, z1: 0.525 }, { f: 1, kind: 'office', x0: -4.7, x1: 1.2, z0: 0.675, z1: 4.7 }],
      labels: [{ side: 'n', t: 'RADAR', at: 1.4, w: 2.2, h: 0.5 }, { side: 's', t: 'RADAR', at: -0.6, w: 2.2, h: 0.5 }],
      roof: (K2, H) => {
        K2.s(-1.6, H, 0, 2.4, 1.4, 2.4, '#7d847a', UK.CONC);                                    // kaide (siper)
        K2.s(-1.6, H + 1.4, 0, 0.6, 0.9, 0.6, PAL.steelD, UK.STEEL);
        K2.d(-1.6, H + 2.3, 0, 4.8, 1.3, 0.14, '#cfd3d0', UK.STEEL); K2.d(-1.6, H + 2.75, 0.2, 0.3, 0.4, 0.6, '#5a5f63', UK.STEEL);
        K2.b.cyl(-3.4, H, 3.1, 1.0, 1.0, 1.2, '#d9dcd6', { seg: 14, kind: UK.STEEL }); K2.b.ico(-3.4, H + 1.2, 3.1, 1.0, '#e4e6e0', { scale: [1, 0.7, 1], detail: 1 });
        roofAC(K2, 1.5, H, 3.4, 0); roofVent(K2, -3.6, H, -3.4);
        K2.s(-3.8, H, -1.0, 0.16, 5.0, 0.16, PAL.steel, UK.STEEL); beacon(K2, -3.8, H + 5.0, -1.0);
      },
    });
    return r;
  });
}

// sığınak: 0,6 m beton duvar, ön (+x) atış yarığı (0,35 m), yan yarıklar, arka kapı; üstünde toprak / kum torbası (ulaşılmaz: 2,8 m)
export function bunker(K, x, z, ry = 0, { w = 6, d = 4.4 } = {}) {
  K.b.with(x, 0, z, ry, () => {
    const t = 0.6, H = 2.4, hw = w / 2, hd = d / 2, slit = (at, ww) => ({ at, w: ww, b: 1.05, top: 1.4 });
    K.wall('z', -hd, hd, hw - t / 2, 0, H, t, PAL.conc, UK.CONC, [slit(0, 2.6)]);
    K.wall('z', -hd, hd, -hw + t / 2, 0, H, t, PAL.conc, UK.CONC, [{ at: 0.6, w: 1.3, b: 0, top: 2.1, frame: { col: '#3d4248', kind: UK.STEEL, jw: 0.08, out: 0.03 } }]);
    for (const sd of [-1, 1]) K.wall('x', -hw + t, hw - t, sd * (hd - t / 2), 0, H, t, PAL.conc, UK.CONC, [slit(0.9, 1.2)]);
    K.sr(-hw - 0.15, hw + 0.15, H, H + 0.4, -hd - 0.15, hd + 0.15, PAL.concD, UK.CONC);
    K.sr(-hw + 0.3, hw - 0.3, H + 0.4, H + 0.65, -hd + 0.3, hd - 0.3, PAL.dirt, UK.DIRT);
    sandbags(K, -hw - 1.6, 0.6, 2.4, Math.PI / 2, 1.2, 0.62);                                  // kapı önü perde
    K.lit(-hw + t + 0.3, H - 0.05, 0, 0.5, 0.05, 0.2, LAMP_WARM); K.lamp(-hw + t + 0.5, 1.8, 0, 4, 0.7);
    K.sign('B-' + Math.abs(Math.round(x * 3 + z)) % 90, 0.7, 0.3, -hw - 0.03, 2.25, -0.9, -Math.PI / 2, '#f0f0e8', '#3a3f34');
  });
}

// tünel (yer üstü beton kanal): x0..x1 boyunca, iç 3,6 × 3,0; duvar / tavan 0,5. o: { sideDoors:[{at, side:'n'|'s', w}], baffles:[{at, side}], roofStair:{ at, side, dir } }
export function tunnel(K, x0, x1, zc, o = {}) {
  const iw = 3.6, ih = 3.0, t = 0.5, zn = zc - iw / 2 - t, zs = zc + iw / 2;
  const dop = (side) => (o.sideDoors || []).filter((d) => d.side === side).map((d) => ({ at: d.at, w: d.w || 2.0, b: 0, top: 2.3, frame: { col: PAL.yellow, kind: UK.HATCH, jw: 0.12, out: 0.04 } }));
  K.wall('x', x0, x1, zn + t / 2, 0, ih, t, PAL.conc, UK.CONC, dop('n'), [{ y0: 0, y1: 0.4, col: PAL.concD, kind: UK.CONC }]);
  K.wall('x', x0, x1, zs + t / 2, 0, ih, t, PAL.conc, UK.CONC, dop('s'), [{ y0: 0, y1: 0.4, col: PAL.concD, kind: UK.CONC }]);
  // tavan: ağızlarda 0,3 m saçak (portal), üst yüz ROOF
  const st = o.roofStair;
  K.sr(x0, x1, ih, ih + t, zn, zs + t, PAL.concD, UK.CONC);
  // ağız çerçevesi (iki uçta sarı-siyah, iç kenarlarda): duvar uçlarının yüzünde değil, kanalın içinde 0,12 m
  for (const xe of [x0, x1]) { const sg = xe === x0 ? 1 : -1; K.sr(Math.min(xe, xe + sg * 0.25), Math.max(xe, xe + sg * 0.25), ih - 0.3, ih, zn + t, zs, PAL.yellow, UK.HATCH); }
  // perde duvarları (iç): bir yandan 2,1 m çıkıntı, 0,3 m kalın, tavana kadar
  for (const bf of o.baffles || []) { const za = bf.side === 'n' ? zn + t : zs - 2.1, zb = za + 2.1; K.sr(bf.at - 0.15, bf.at + 0.15, 0, ih - (0), za, zb, PAL.concL, UK.CONC); }
  // iç ışık şeridi + gece ışığı
  for (let x = x0 + 2; x < x1 - 1.5; x += 4) { if ((o.baffles || []).some((b) => Math.abs(b.at - x) < 0.6)) continue; K.lit(x, ih - 0.05, zc, 1.0, 0.05, 0.18, '#ffe7b0'); K.lamp(x, ih - 0.6, zc, 5.5, 0.8); }
  // çatı korkuluğu (0,9 m, merdiven başında açık) + çatı merdiveni (yan duvara yaslı)
  const RT = ih + t, rail = 0.95;
  let gap = null;
  if (st) {
    const steps = 14, rise = RT / steps, run = 0.3, len = steps * run, sw = 1.3, zz = st.side === 'n' ? zn - sw / 2 : zs + t + sw / 2;
    const xs = st.dir === '+x' ? st.at - len : st.at + len;
    K.stair(xs, zz, 0, st.dir, sw, steps, rise, run, '#8b8f88', UK.CONC);
    gap = [st.at - 1.4, st.at + 1.4];
  }
  for (const [zA, zB, side] of [[zn, zn + 0.15, 'n'], [zs + t - 0.15, zs + t, 's']]) {
    const segs = gap && st.side === side ? [[x0, gap[0]], [gap[1], x1]] : [[x0, x1]];
    for (const [a, b] of segs) if (b - a > 0.2) K.sr(a, b, RT, RT + rail, zA, zB, PAL.concL, UK.CONC);
  }
  return { zn, zs: zs + t, top: RT };
}

// dikey yakıt tankı: silindir + konik çatı (süs) + kuşak çarpışma + kaide + merdiven / şerit süsü
export function fuelTank(K, x, z, r = 2.8, h = 5.0, col = '#d3d6cf') {
  K.s(x, 0, z, 2 * r + 0.6, 0.2, 2 * r + 0.6, PAL.concD, UK.CONC);
  K.b.cyl(x, 0.2, z, r, r, h, col, { seg: 18, kind: UK.STEEL, collide: false });
  roundCols(K, x, z, r, 0.2, h, 7);
  K.b.cyl(x, 0.2 + h, z, r * 0.25, r, 0.7, '#b9bdb6', { seg: 18, kind: UK.STEEL, collide: false });
  K.b.cyl(x, 0.2 + h * 0.62, z, r + 0.015, r + 0.015, 0.45, PAL.red, { seg: 18, kind: UK.PAINT, collide: false });
  for (let y = 0.6; y < h; y += 0.4) K.d(x + r + 0.12, 0.2 + y, z, 0.05, 0.04, 0.42, PAL.steelD, UK.STEEL);
  for (const sz of [-0.23, 0.23]) K.d(x + r + 0.12, 0.2, z + sz, 0.05, h, 0.04, PAL.steelD, UK.STEEL);
}

// boru rafı: dikmeler (6 m), traversler, üstte 2–3 boru (silindir, 2,6 m üstü, çarpışmasız: ulaşılmaz)
export function pipeRack(K, x0, x1, z, { y = 2.7, cols = ['#c0392b', '#d9a91f'] } = {}) {
  const n = Math.max(1, Math.round((x1 - x0) / 6)), st = (x1 - x0) / n;
  for (let i = 0; i <= n; i++) { const x = x0 + i * st; K.s(x, 0, z, 0.22, y, 0.22, PAL.steel, UK.STEEL); K.d(x, y, z, 0.22, 0.14, 1.4, PAL.steel, UK.STEEL); }
  cols.forEach((c, i) => K.b.cyl((x0 + x1) / 2, y + 0.14 + 0.16, z - 0.35 + i * 0.7 / Math.max(1, cols.length - 1), 0.16, 0.16, x1 - x0, c, { rz: Math.PI / 2, center: true, seg: 10, collide: false, kind: UK.STEEL }));
}
// alçak boru hattı (gövde bandında: çarpışmalı kutu + silindir görsel), mesnetler
export function pipeLow(K, x0, x1, z, { col = '#c0392b', gaps = [] } = {}) {
  let cur = x0; const segs = [];
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) { segs.push([cur, a]); cur = b; }
  segs.push([cur, x1]);
  for (const [a, b] of segs) {
    if (b - a < 0.5) continue;
    K.b.cyl((a + b) / 2, 0.55, z, 0.2, 0.2, b - a, col, { rz: Math.PI / 2, center: true, seg: 10, collide: false, kind: UK.STEEL });
    K.b.collide((a + b) / 2, 0.35, z, b - a, 0.4, 0.4);
    for (let x = a + 0.4; x < b - 0.2; x += 3) K.s(x, 0, z, 0.25, 0.35, 0.5, PAL.concD, UK.CONC);
  }
}
// helipad: yükseltilmiş beton (0,12), H işareti pad'in kendi parçası (bölünmüş; kaplama yok), köşe ışıkları
export function helipad(K, x, z, s = 13) {
  const h = s / 2, H = [[-1.6, -1.0, -2.2, 2.2], [1.0, 1.6, -2.2, 2.2], [-1.0, 1.0, -0.3, 0.3]], ring = 0.35;
  const inner = [-h + 0.7 + ring, h - 0.7 - ring];
  const holes = [...H, [-h + 0.7, h - 0.7, -h + 0.7, -h + 0.7 + ring], [-h + 0.7, h - 0.7, h - 0.7 - ring, h - 0.7], [-h + 0.7, -h + 0.7 + ring, inner[0], inner[1]], [h - 0.7 - ring, h - 0.7, inner[0], inner[1]]];
  for (const r of cutRects([-h, h, -h, h], holes)) K.sr(x + r[0], x + r[1], 0, 0.12, z + r[2], z + r[3], '#8d8f88', UK.PAD);
  for (const r of holes) K.sr(x + r[0], x + r[1], 0, 0.12, z + r[2], z + r[3], r === holes[3] || r === holes[4] || r === holes[5] || r === holes[6] ? PAL.yellow : PAL.white, UK.PAINT);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { K.s(x + sx * (h - 0.3), 0.12, z + sz * (h - 0.3), 0.22, 0.12, 0.22, PAL.steelD, UK.STEEL); K.lit(x + sx * (h - 0.3), 0.24, z + sz * (h - 0.3), 0.16, 0.06, 0.16, '#7dd0ff'); K.lamp(x + sx * (h - 0.3), 0.6, z + sz * (h - 0.3), 3.5, 0.6, '#9fd8ff'); }
}
// garaj sırası: arka duvar z0 (yerel −z), bölmeler, düz çatı (4,2), önde açık (yarı açık kepenk süsü)
export function garageRow(K, x0, z0, bays = 3, bw = 5.6, d = 8, h = 4.2, wall = '#7e8783') {
  const t = 0.25, x1 = x0 + bays * bw, z1 = z0 + d;
  K.wall('x', x0, x1, z0 + t / 2, 0, h, t, wall, UK.CLAD, [], [{ y0: 0, y1: 0.8, col: PAL.concD, kind: UK.CONC }]);
  for (let i = 0; i <= bays; i++) {
    const x = x0 + i * bw, a = i === 0 ? x : i === bays ? x - t : x - t / 2;
    K.sr(a, a + t, 0, h, z0 + t, z1, wall, UK.CLAD);
  }
  K.sr(x0 - 0.2, x1 + 0.2, h, h + 0.3, z0, z1 + 0.6, PAL.roof, UK.ROOF);
  for (let i = 0; i < bays; i++) {
    const a = x0 + i * bw + (i === 0 ? t : t / 2), b = x0 + (i + 1) * bw - (i === bays - 1 ? t : t / 2), cx = (a + b) / 2;
    K.sr(a, b, h - 0.9, h, z1 - 0.12, z1, '#5f6870', UK.CLAD);                                  // kepenk (yukarıda, 0,9 m)
    K.d(cx, h - 0.95, z1 - 0.06, b - a, 0.05, 0.12, PAL.yellow, UK.HATCH);
    K.lit(cx, h - 0.06, (z0 + z1) / 2, 1.2, 0.06, 0.3, LAMP_COOL); K.lamp(cx, h - 1.0, (z0 + z1) / 2, 7, 0.8, '#eef4ff');
    K.sign(String(i + 1), 0.5, 0.26, cx, h + 0.15, z1 + 0.63, 0, '#f2f2ee', '#2d3a2e');
  }
  return { x1, z1, bw, t };
}
// çadır: kanvas duvar (2,0 m, 8 cm), önde (yerel +z) kapı, beşik çatı (mahya z boyunca); içinde portatif yataklar / masa
export function tent(K, x, z, ry, { w = 4.4, d = 5.0, col = PAL.canvas, ridge = null, kind = 'barracks', big = false } = {}) {
  K.b.with(x, 0, z, ry, () => {
    const t = 0.08, H = 2.3, hw = w / 2, hd = d / 2;                         // 2,3 m: yerden / alçak eşyadan saçağa tırmanılmaz (çatıdan çevre duvarına sızma yok)
    K.wall('x', -hw, hw, -hd + t / 2, 0, H, t, col, UK.CANVAS);
    K.wall('x', -hw, hw, hd - t / 2, 0, H, t, col, UK.CANVAS, [{ at: 0, w: 1.6, b: 0, top: 1.95 }]);
    for (const sx of [-1, 1]) K.wall('z', -hd + t, hd - t, sx * (hw - t / 2), 0, H, t, col, UK.CANVAS);
    K.b.withKind(UK.CANVAS, () => K.b.prism(0, H, 0, w + 0.3, big ? 1.5 : 1.3, d + 0.2, col));
    if (ridge) K.d(0, H + (big ? 1.5 : 1.3), 0, 0.12, 0.04, d + 0.2, ridge, UK.PAINT);
    K.lit(0, H - 0.05, 0, 0.3, 0.05, 0.3, LAMP_WARM); K.lamp(0, 1.6, 0, 4.5, 0.8);
    const ix0 = -hw + t + 0.05, ix1 = hw - t - 0.05;
    if (kind === 'barracks' || kind === 'medical') for (const sx of [-1, 1]) for (const zz of [-hd + t + 1.0, -hd + t + 3.0]) { const cx = sx < 0 ? ix0 + 0.4 : ix1 - 0.4; K.s(cx, 0, zz, 0.75, 0.42, 1.9, kind === 'medical' ? '#e6e6e0' : '#5f6a4c', UK.CANVAS); }
    else if (kind === 'ops' || kind === 'radio') { K.s(0, 0, -0.6, 1.8, 0.76, 0.9, '#6a5a40', UK.WOOD); K.d(0, 0.76, -0.6, 1.2, 0.03, 0.6, '#d8d4c4', UK.PAINT); K.s(ix0 + 0.35, 0, -1.6, 0.6, 1.4, 0.6, '#4b5258', UK.STEEL); K.d(ix0 + 0.665, 0.9, -1.6, 0.03, 0.3, 0.4, '#58e0a8', UK.PAINT, { o: { glow: true } }); }
    else if (kind === 'armory') { for (const zz of [-1.6, -0.2]) { K.s(ix0 + 0.3, 0, zz, 0.5, 0.46, 1.2, PAL.olive, UK.STEEL); K.s(ix1 - 0.3, 0, zz, 0.5, 0.46, 1.2, PAL.olive, UK.STEEL); } }
    else if (kind === 'generator') { K.s(0, 0, -0.8, 1.2, 1.0, 2.0, '#4f6a46', UK.STEEL); K.d(0, 1.0, -0.8, 0.6, 0.04, 0.6, '#2a2d30', UK.STEEL); }
  });
}
export { crate, FH, PL, LAMP_RED };
