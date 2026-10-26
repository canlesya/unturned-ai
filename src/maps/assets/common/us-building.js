import { UK } from './us-surface.js';
import { PAL, LAMP_WARM, LAMP_COOL, cutRects } from './us-kit.js';
import { fillRoom, wallBoard, ROOM_BOARD } from './us-furniture.js';

// Askeri Üs v3 — prefabrik bina modülü (milBlock): kaide + kat kat dış duvar (pencere / kapı çerçeveli, kat bandı) + döşemeler (merdiven deliği kesik) + çatı + korkuluk duvarı.
// Ölçüler: kat 3,25 m (13 × 0,25 basamak), duvar 0,3, kaide 0,15 (iç zemin = kaide üstü). Pencere: eşik 1,0, açıklık 1,15 (çerçeve içi 0,99 m → geçilmez), kapı 1,7 × 2,3.
// Yerel çerçevede kurulur (dış ayak izi x0..x1, z0..z1); döndürmek için b.with. Kapılar yalnız zemin katta; merdivenler katlar arası (switchback için konumlar sırayla).
export const FH = 3.25, WT = 0.3, PL = 0.15, RISE = 0.25, RUN = 0.28, STEPS = 13;
const DOOR_W = 1.7, DOOR_TOP = 2.3, WIN_W = 1.3, WIN_B = 1.0, WIN_TOP = 2.15;

export function milBlock(K, o) {
  const { x0, x1, z0, z1 } = o, F = o.floors || 1, t = WT, par = o.parapet ?? 0.95;
  const wall = o.wall || PAL.wallA, base = o.base || PAL.band, band = o.band || PAL.band, trim = o.trim || PAL.trim, frame = { col: o.frameCol || '#3d4248', kind: UK.STEEL, jw: 0.1, out: 0.04 };
  const H = PL + F * FH, ix0 = x0 + t, ix1 = x1 - t, iz0 = z0 + t, iz1 = z1 - t;
  const stairs = (o.stairs || []).map((s) => ({ ...s, w: s.w || 1.3 }));
  const doors = o.doors || {}, parts = o.parts || [];
  const out = { H, wins: {} };
  // ── kaide: dış halka (beton, duvarların altı + 12 cm taşma) + iç zemin (vinil)
  const lip = 0.12;
  K.sr(x0 - lip, x1 + lip, 0, PL, z0 - lip, z0 + t, PAL.plinth, UK.CONC); K.sr(x0 - lip, x1 + lip, 0, PL, z1 - t, z1 + lip, PAL.plinth, UK.CONC);
  K.sr(x0 - lip, x0 + t, 0, PL, z0 + t, z1 - t, PAL.plinth, UK.CONC); K.sr(x1 - t, x1 + lip, 0, PL, z0 + t, z1 - t, PAL.plinth, UK.CONC);
  K.sr(ix0, ix1, 0, PL, iz0, iz1, o.floorCol || PAL.floor, UK.FLOOR);
  // ── pencere yerleşimi (kat başına, kenar başına)
  const dlist = (side) => (doors[side] || []).map((d) => (typeof d === 'number' ? { at: d, w: DOOR_W } : { w: DOOR_W, ...d }));
  const partHits = (side) => parts.filter((p) => (side === 'n' || side === 's' ? p.axis === 'z' && ((side === 'n' && p.a0 <= iz0 + 0.01) || (side === 's' && p.a1 >= iz1 - 0.01)) : p.axis === 'x' && ((side === 'w' && p.a0 <= ix0 + 0.01) || (side === 'e' && p.a1 >= ix1 - 0.01)))).map((p) => p.c);
  const winsFor = (side, f) => {
    const [a0, a1] = side === 'n' || side === 's' ? [x0, x1] : [z0, z1];
    const gap = o.winGap || 3.0, res = [];
    const bad = [...dlist(side).filter(() => f === 0).map((d) => [d.at - d.w / 2 - 0.7, d.at + d.w / 2 + 0.7]), ...partHits(side).map((c) => [c - 0.95, c + 0.95]), ...((o.noWin || {})[side] || [])];
    if (o.noWinFloor && o.noWinFloor.includes(f)) return res;
    const L = a1 - a0 - 2.4, n = Math.max(0, Math.floor(L / gap) + 1), st = n > 1 ? L / (n - 1) : 0;
    for (let i = 0; i < n; i++) { const at = n > 1 ? a0 + 1.2 + i * st : (a0 + a1) / 2; if (!bad.some(([p, q]) => at + WIN_W / 2 > p && at - WIN_W / 2 < q)) res.push(at); }
    return res;
  };
  // ── dış duvarlar (kat kat) + korkuluk duvarı
  for (let f = 0; f <= F; f++) {
    const y0 = PL + f * FH, h = f < F ? FH : par, top = f === F;
    for (const side of ['n', 's', 'w', 'e']) {
      const ops = [];
      if (!top) {
        if (f === 0) for (const d of dlist(side)) ops.push({ at: d.at, w: d.w, b: 0, top: DOOR_TOP, frame });
        const W = winsFor(side, f); (out.wins[f] ||= {})[side] = W.map((a) => [a - WIN_W / 2, a + WIN_W / 2]);
        for (const at of W) ops.push({ at, w: WIN_W, b: WIN_B, top: WIN_TOP, frame: { ...frame, col: trim, kind: UK.PAINT }, glass: '#9fc4d8' });
      }
      const ns = side === 'n' || side === 's';
      const bands = top ? [{ y0: par - 0.14, y1: par, col: trim, kind: UK.CONC, out: 0.05, ext: ns ? 0.05 : 0 }] : f === 0 ? [{ y0: 0, y1: 0.5, col: base, kind: UK.CONC }] : [{ y0: 0, y1: 0.3, col: band, kind: UK.CONC, out: 0.03, ext: ns ? 0.03 : 0 }];
      if (side === 'n') K.wall('x', x0, x1, z0 + t / 2, y0, h, t, wall, UK.BLOCK, ops, bands, -1);
      if (side === 's') K.wall('x', x0, x1, z1 - t / 2, y0, h, t, wall, UK.BLOCK, ops, bands, 1);
      if (side === 'w') K.wall('z', z0 + t, z1 - t, x0 + t / 2, y0, h, t, wall, UK.BLOCK, ops, bands, -1);
      if (side === 'e') K.wall('z', z0 + t, z1 - t, x1 - t / 2, y0, h, t, wall, UK.BLOCK, ops, bands, 1);
    }
  }
  // ── merdiven delikleri + döşemeler (f = 1..F; F = çatı)
  const snap = (r) => [r[0] - ix0 < 0.15 ? ix0 : r[0], ix1 - r[1] < 0.15 ? ix1 : r[1], r[2] - iz0 < 0.15 ? iz0 : r[2], iz1 - r[3] < 0.15 ? iz1 : r[3]];      // duvara 15 cm'den yakın delik kenarı duvara yapışır (ince döşeme şeridi kalmasın)
  const holeOf = (s) => { const len = STEPS * RUN, hw = s.w / 2 + 0.05;
    if (s.dir === '+z') return snap([s.x - hw, s.x + hw, s.z, s.z + len]); if (s.dir === '-z') return snap([s.x - hw, s.x + hw, s.z - len, s.z]);
    if (s.dir === '+x') return snap([s.x, s.x + len, s.z - hw, s.z + hw]); return snap([s.x - len, s.x, s.z - hw, s.z + hw]); };
  for (let f = 1; f <= F; f++) {
    const yT = PL + f * FH, holes = stairs.filter((s) => s.f === f - 1 && (f < F || o.roofAccess)).map(holeOf);
    for (const r of cutRects([ix0, ix1, iz0, iz1], holes)) {
      K.sr(r[0], r[1], yT - 0.3, yT - 0.24, r[2], r[3], o.ceilCol || PAL.ceil, UK.CEIL);
      K.sr(r[0], r[1], yT - 0.24, yT, r[2], r[3], f < F ? (o.floorCol || PAL.floor) : (o.roofCol || PAL.roof), f < F ? UK.FLOOR : UK.ROOF);
    }
    // delik korkulukları (geliş ucu açık): katı alçak duvar 1,0 m × 6 cm, deliğin dışında
    for (const s of stairs.filter((q) => q.f === f - 1 && (f < F || o.roofAccess))) {
      const hr = holeOf(s), RH = f < F ? 1.0 : 1.05, rc = f < F ? PAL.steelL : PAL.steel, rt = 0.06;
      const edgeX0 = hr[0] - rt > ix0 + 0.02, edgeX1 = hr[1] + rt < ix1 - 0.02, edgeZ0 = hr[2] - rt > iz0 + 0.02, edgeZ1 = hr[3] + rt < iz1 - 0.02;
      const zs = s.dir === '+z' || s.dir === '-z';
      const skip = s.dir === '+z' ? 'z1' : s.dir === '-z' ? 'z0' : s.dir === '+x' ? 'x1' : 'x0';
      const zA = edgeZ0 ? hr[2] - rt : hr[2], zB = edgeZ1 ? hr[3] + rt : hr[3], xA = edgeX0 ? hr[0] - rt : hr[0], xB = edgeX1 ? hr[1] + rt : hr[1];
      if (edgeX0 && skip !== 'x0') K.sr(hr[0] - rt, hr[0], yT, yT + RH, zs ? hr[2] : zA, zs ? hr[3] : zB, rc, UK.STEEL);
      if (edgeX1 && skip !== 'x1') K.sr(hr[1], hr[1] + rt, yT, yT + RH, zs ? hr[2] : zA, zs ? hr[3] : zB, rc, UK.STEEL);
      if (edgeZ0 && skip !== 'z0') K.sr(zs ? xA : hr[0], zs ? xB : hr[1], yT, yT + RH, hr[2] - rt, hr[2], rc, UK.STEEL);
      if (edgeZ1 && skip !== 'z1') K.sr(zs ? xA : hr[0], zs ? xB : hr[1], yT, yT + RH, hr[3], hr[3] + rt, rc, UK.STEEL);
    }
  }
  // ── merdivenler
  for (const s of stairs) if (s.f < F - 1 || o.roofAccess) K.stair(s.x, s.z, PL + s.f * FH, s.dir, s.w, STEPS, RISE, RUN, o.stairCol || '#8b8f88', UK.CONC);
  // ── iç bölmeler (0,15 m sıva; kat başına; kapı çerçeveli)
  for (const p of parts) for (let f = 0; f < F; f++) {
    if (p.floors && !p.floors.includes(f)) continue;
    const y0 = PL + f * FH, ops = (p.doors || []).map((d) => ({ at: d.at, w: d.w || 1.2, b: 0, top: 2.2, frame: { col: trim, kind: UK.PAINT, jw: 0.08, out: 0.03 } }));
    K.wall(p.axis, p.a0, p.a1, p.c, y0, FH - 0.3, 0.15, o.inner || PAL.plaster, UK.PLASTER, ops);
  }
  // ── dış kapı sundurması + kapı lambası
  const canopy = (side, at) => {
    const w = DOOR_W + 0.7, yb = PL + 2.62, dd = 0.9;
    if (side === 'n') { K.s(at, yb, z0 - dd / 2, w, 0.14, dd, PAL.concD, UK.CONC); K.lit(at, yb - 0.05, z0 - 0.35, 0.36, 0.05, 0.16); K.lamp(at, yb - 0.4, z0 - 1.0, 7, 0.9); }
    if (side === 's') { K.s(at, yb, z1 + dd / 2, w, 0.14, dd, PAL.concD, UK.CONC); K.lit(at, yb - 0.05, z1 + 0.35, 0.36, 0.05, 0.16); K.lamp(at, yb - 0.4, z1 + 1.0, 7, 0.9); }
    if (side === 'w') { K.s(x0 - dd / 2, yb, at, dd, 0.14, w, PAL.concD, UK.CONC); K.lit(x0 - 0.35, yb - 0.05, at, 0.16, 0.05, 0.36); K.lamp(x0 - 1.0, yb - 0.4, at, 7, 0.9); }
    if (side === 'e') { K.s(x1 + dd / 2, yb, at, dd, 0.14, w, PAL.concD, UK.CONC); K.lit(x1 + 0.35, yb - 0.05, at, 0.16, 0.05, 0.36); K.lamp(x1 + 1.0, yb - 0.4, at, 7, 0.9); }
  };
  if (o.canopy !== false) for (const side of ['n', 's', 'w', 'e']) for (const d of dlist(side)) canopy(side, d.at);
  // ── tavan lambaları (her kat, 3,5 m aralık) — gece iç ışık
  for (let f = 0; f < F; f++) {
    const yc = PL + (f + 1) * FH - 0.3;
    for (let x = ix0 + 2.0; x < ix1 - 1.0; x += 3.6) for (let z = iz0 + 1.8; z < iz1 - 1.0; z += 3.6) {
      if (stairs.some((s) => { const h = holeOf(s); return (s.f === f || s.f === f - 1) && x > h[0] - 0.8 && x < h[1] + 0.8 && z > h[2] - 0.8 && z < h[3] + 0.8; })) continue;
      if (parts.some((p) => (!p.floors || p.floors.includes(f)) && (p.axis === 'x' ? Math.abs(z - p.c) < 0.6 && x > p.a0 && x < p.a1 : Math.abs(x - p.c) < 0.6 && z > p.a0 && z < p.a1))) continue;
      K.lit(x, yc - 0.04, z, 1.2, 0.04, 0.3, LAMP_COOL); K.lamp(x, yc - 0.5, z, 6.5, 0.8, '#eaf2ff');
    }
  }
  // ── odalar: eşya + duvar panosu
  const keepFor = (f) => {
    const keep = [];
    for (const side of ['n', 's', 'w', 'e']) if (f === 0) for (const d of dlist(side)) {
      const a = d.at - d.w / 2 - 0.35, b = d.at + d.w / 2 + 0.35;
      if (side === 'n') keep.push([a, b, iz0, iz0 + 1.4]); if (side === 's') keep.push([a, b, iz1 - 1.4, iz1]);
      if (side === 'w') keep.push([ix0, ix0 + 1.4, a, b]); if (side === 'e') keep.push([ix1 - 1.4, ix1, a, b]);
    }
    for (const p of parts) if (!p.floors || p.floors.includes(f)) for (const d of p.doors || []) {
      const w = d.w || 1.2, a = d.at - w / 2 - 0.3, b = d.at + w / 2 + 0.3;
      if (p.axis === 'x') keep.push([a, b, p.c - 1.3, p.c + 1.3]); else keep.push([p.c - 1.3, p.c + 1.3, a, b]);
    }
    for (const s of stairs) if (s.f === f || s.f === f - 1) { const h = holeOf(s); keep.push([h[0] - 0.7, h[1] + 0.7, h[2] - 0.7, h[3] + 0.7]); }
    return keep;
  };
  for (const r of o.rooms || []) {
    const y = r.f === 0 ? PL : PL + r.f * FH, W = out.wins[r.f] || {};
    const win = { n: Math.abs(r.z0 - iz0) < 0.05 ? W.n : [], s: Math.abs(r.z1 - iz1) < 0.05 ? W.s : [], w: Math.abs(r.x0 - ix0) < 0.05 ? W.w : [], e: Math.abs(r.x1 - ix1) < 0.05 ? W.e : [] };
    const placed = fillRoom(K, r.kind, [r.x0, r.x1, r.z0, r.z1], y, keepFor(r.f), win);
    const bk = ROOM_BOARD[r.kind];
    if (bk) {                                                                      // pano: odanın boş bir duvarına (eşya / pencere / kapı önü değil)
      const cands = [['n', (r.x0 + r.x1) / 2, r.z0, 0], ['s', (r.x0 + r.x1) / 2, r.z1, Math.PI], ['w', r.x0, (r.z0 + r.z1) / 2, Math.PI / 2], ['e', r.x1, (r.z0 + r.z1) / 2, -Math.PI / 2]];
      for (const [sd, x, z, ry] of cands) {
        const span = sd === 'n' || sd === 's' ? [x - 1.0, x + 1.0] : [z - 1.0, z + 1.0];
        const fr = sd === 'n' ? [span[0], span[1], z, z + 0.6] : sd === 's' ? [span[0], span[1], z - 0.6, z] : sd === 'w' ? [x, x + 0.6, span[0], span[1]] : [x - 0.6, x, span[0], span[1]];
        const clash = placed.some((p) => fr[0] < p[1] && fr[1] > p[0] && fr[2] < p[3] && fr[3] > p[2]) || keepFor(r.f).some((p) => fr[0] < p[1] && fr[1] > p[0] && fr[2] < p[3] && fr[3] > p[2]) || (win[sd] || []).some(([p, q]) => span[0] < q && span[1] > p);
        if (!clash && (sd === 'n' || sd === 's' ? r.x1 - r.x0 > 2.4 : r.z1 - r.z0 > 2.4)) { wallBoard(K, x, z, ry, bk); break; }
      }
    }
  }
  // ── çatı: drenaj + ekipman (geri çağırma)
  if (o.roof) o.roof(K, H, { x0: ix0, x1: ix1, z0: iz0, z1: iz1 });
  // ── tabela (cephe, kapı üstü bandında)
  for (const lb of o.labels || []) {
    const yy = PL + (lb.f ?? 0) * FH + (lb.y ?? 2.95), w = lb.w || 2.6, hh = lb.h || 0.5;
    if (lb.side === 'n') K.sign(lb.t, w, hh, lb.at, yy, z0 - 0.03, Math.PI, lb.fg || '#f2f2ee', lb.bg || '#2d3a2e');
    if (lb.side === 's') K.sign(lb.t, w, hh, lb.at, yy, z1 + 0.03, 0, lb.fg || '#f2f2ee', lb.bg || '#2d3a2e');
    if (lb.side === 'w') K.sign(lb.t, w, hh, x0 - 0.03, yy, lb.at, -Math.PI / 2, lb.fg || '#f2f2ee', lb.bg || '#2d3a2e');
    if (lb.side === 'e') K.sign(lb.t, w, hh, x1 + 0.03, yy, lb.at, Math.PI / 2, lb.fg || '#f2f2ee', lb.bg || '#2d3a2e');
  }
  return out;
}

// çatı ekipmanı: klima ünitesi (katı) + havalandırma bacası
export function roofAC(K, x, y, z, ry = 0) { K.b.with(x, y, z, ry, () => { K.s(0, 0, 0, 1.6, 0.12, 1.0, PAL.steelD, UK.STEEL); K.s(0, 0.12, 0, 1.5, 0.9, 0.95, '#a7adb0', UK.STEEL); K.d(0.35, 1.02, 0, 0.6, 0.03, 0.6, '#2a2d30', UK.STEEL); }); }
export function roofVent(K, x, y, z) { K.s(x, y, z, 0.5, 0.7, 0.5, '#8a9095', UK.STEEL); K.s(x, y + 0.7, z, 0.7, 0.08, 0.7, '#6a7075', UK.STEEL); }
