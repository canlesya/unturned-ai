import { fillRoom, poolDisc, poolRect } from './kitMilInterior.js';

const SPILL = (b, x, z, w, d, op = 0.4) => poolRect(b, x, 0.09, z, w, d, '#ffdf9a', op);

// Askeri üs yapı üreticileri: çok katlı bina (iç bölmeler + merdiven + çatı erişimi), kule, tünel, garaj sırası, çadır.
// Hepsi MapBuilder (b) üzerine çizilir; iç mekân `rooms` ile doldurulur (kitMilInterior.js).

const CONC = '#8d9389', CONC_D = '#6f756d', STEEL = '#59606a';

const doorOf = (v, dw) => (typeof v === 'number' ? { at: v, w: dw } : { w: dw, ...v });

// Pencere dizisi: len boyunca c merkezli; kapı/bölme ağzı yakınındakileri atla
function winList(len, c, doors, abuts, st) {
  const { step, ww, b0, top } = st;
  const n = Math.max(1, Math.floor((len - 1.6) / step));
  const out = [];
  for (let i = 0; i < n; i++) {
    const at = c + (i - (n - 1) / 2) * step;
    if (doors.some((dr) => Math.abs(at - dr.at) < dr.w / 2 + ww / 2 + 0.5)) continue;
    if (abuts.some((a) => Math.abs(at - a) < ww / 2 + 0.45)) continue;
    out.push({ at, w: ww, b: b0, top });
  }
  return out;
}

// ───────── Çok katlı askeri bina ─────────
// o: x,z,w,d (dış ölçü), floors, fh, wall, roof, trim, floorColor,
//    doors:{n:[ofs|{at,w}],s,e,w} (zemin kat), parts:[{axis:'x'|'z', c, a0, a1, doors:[{at,w}], floors?:[...]}] (merkeze göre),
//    stairs:[{x,z,dir,w}] (uçuş başına: 0→1, 1→2 ...; merkeze göre alt uç), roofAccess (varsayılan true),
//    rooms:[{f,kind,x0,z0,x1,z1}] (merkeze göre net iç alan), winStyle:{[kat]:'wide'}, parapet (çatı korkuluğu), lit (pencere ışık olasılığı)
export function milBuilding(b, rng, o) {
  const {
    x, z, w, d, floors = 1, fh = 3.2, wall = '#8a9189', roof = '#585d62', trim = '#d7d6cc', floorColor = '#7a7e78',
    slabColor = '#a9aba3', parapet = 1.1, lit = 0.65, dw = 2.0, partColor = '#b4b5ac',
  } = o;
  const roofAccess = o.roofAccess !== false;
  const T = 0.35;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const H = floors * fh;
  const doors = { n: [], s: [], e: [], w: [] };
  for (const k of ['n', 's', 'e', 'w']) doors[k] = (o.doors?.[k] || []).map((v) => doorOf(v, dw));
  const parts = o.parts || [];
  const stairs = o.stairs || [];
  const nFl = roofAccess ? floors : floors - 1;

  // zemin kaplaması + temel bandı
  b.box(x, 0, z, w - 0.3, 0.06, d - 0.3, floorColor, { collide: false });
  for (const [px, pz, pw, pd] of [[x, z0 - 0.12, w + 0.3, 0.26], [x, z1 + 0.12, w + 0.3, 0.26], [x0 - 0.12, z, 0.26, d], [x1 + 0.12, z, 0.26, d]]) b.box(px, 0, pz, pw, 0.4, pd, '#74786f', { collide: false });

  // merdiven uçuşları + döşeme delikleri
  const holes = [];
  const keepsAll = [];
  for (let f = 0; f < nFl; f++) {
    const s = stairs[f % Math.max(1, stairs.length)];
    if (!s) break;
    const n = Math.round(fh / (s.rise || 0.2)), rise = fh / n, run = s.run || 0.3, wd = s.w || 1.5, L = n * run;
    const ax = x + s.x, az = z + s.z;
    b.stairs(ax, az, f * fh, s.dir, wd, n, rise, run, '#8b8f88');
    let hole, keep;
    const e = 0.03;
    if (s.dir === '+z') { hole = { x0: ax - wd / 2 - e, x1: ax + wd / 2 + e, z0: az, z1: az + L }; keep = { x0: hole.x0 - 1.4, x1: hole.x1 + 1.4, z0: az - 1.3, z1: az + L + 1.3 }; }
    else if (s.dir === '-z') { hole = { x0: ax - wd / 2 - e, x1: ax + wd / 2 + e, z0: az - L, z1: az }; keep = { x0: hole.x0 - 1.4, x1: hole.x1 + 1.4, z0: az - L - 1.3, z1: az + 1.3 }; }
    else if (s.dir === '+x') { hole = { x0: ax, x1: ax + L, z0: az - wd / 2 - e, z1: az + wd / 2 + e }; keep = { x0: ax - 1.3, x1: ax + L + 1.3, z0: hole.z0 - 1.4, z1: hole.z1 + 1.4 }; }
    else { hole = { x0: ax - L, x1: ax, z0: az - wd / 2 - e, z1: az + wd / 2 + e }; keep = { x0: ax - L - 1.3, x1: ax + 1.3, z0: hole.z0 - 1.4, z1: hole.z1 + 1.4 }; }
    holes[f + 1] = hole;           // f+1 seviyesi döşemesindeki delik
    keepsAll.push(keep);
  }

  const slabBox = (ax0, ax1, az0, az1, y, color) => {
    if (ax1 - ax0 < 0.02 || az1 - az0 < 0.02) return;
    b.box((ax0 + ax1) / 2, y, (az0 + az1) / 2, ax1 - ax0, 0.25, az1 - az0, color);
  };
  for (let L = 1; L <= floors; L++) {
    if (L === floors && !roofAccess) { /* düz çatı */ }
    const y = L * fh - 0.25, hole = holes[L], color = L === floors ? roof : slabColor;
    const X0 = x0 + T * 0.5, X1 = x1 - T * 0.5, Z0 = z0 + T * 0.5, Z1 = z1 - T * 0.5;
    if (!hole) slabBox(X0, X1, Z0, Z1, y, color);
    else {
      slabBox(X0, hole.x0, Z0, Z1, y, color); slabBox(hole.x1, X1, Z0, Z1, y, color);
      slabBox(hole.x0, hole.x1, Z0, hole.z0, y, color); slabBox(hole.x0, hole.x1, hole.z1, Z1, y, color);
    }
  }

  // bölmelerin dış duvara değdiği yerler (pencere atlama)
  const abutsOf = (side, f) => {
    const out = [];
    for (const p of parts) {
      if (p.floors && !p.floors.includes(f)) continue;
      if (p.axis === 'z' && side === 'n' && p.a0 <= -d / 2 + 0.6) out.push(x + p.c);
      if (p.axis === 'z' && side === 's' && p.a1 >= d / 2 - 0.6) out.push(x + p.c);
      if (p.axis === 'x' && side === 'w' && p.a0 <= -w / 2 + 0.6) out.push(z + p.c);
      if (p.axis === 'x' && side === 'e' && p.a1 >= w / 2 - 0.6) out.push(z + p.c);
    }
    return out;
  };

  // dış duvarlar
  const winN = (f, side, len, c, drs) => {
    const wide = o.winStyle?.[f] === 'wide';
    const st = wide ? { step: 2.9, ww: 2.2, b0: 0.8, top: Math.min(fh - 0.3, 2.9) } : { step: 3.0, ww: 1.3, b0: 0.95, top: Math.min(fh - 0.85, 2.25) };
    const ops = winList(len, c, drs, abutsOf(side, f), st);
    return { ops, st };
  };
  const paneAt = (axis, cc, at, y0, st) => {
    const litNow = rng() < lit;
    const col = litNow ? '#2c3d49' : '#22333f';
    const op = litNow ? { glow: true, emissive: '#ffdf9a', roughness: 0.25 } : { transparent: true, opacity: 0.5, roughness: 0.2 };
    const ph = st.top - st.b0;
    if (litNow && y0 === 0) {   // pencereden dışarı sızan ışık (yalnız zemin kat)
      if (axis === 'x') SPILL(b, at, cc + (cc < z ? -1 : 1) * 1.1, st.ww + 0.5, 1.8);
      else SPILL(b, cc + (cc < x ? -1 : 1) * 1.1, at, 1.8, st.ww + 0.5);
    }
    if (axis === 'x') {
      b.box(at, y0 + st.b0, cc, st.ww, ph, 0.07, col, { collide: false, o: op });
      b.box(at, y0 + st.b0 - 0.07, cc, st.ww + 0.3, 0.08, T + 0.16, trim, { collide: false });
    } else {
      b.box(cc, y0 + st.b0, at, 0.07, ph, st.ww, col, { collide: false, o: op });
      b.box(cc, y0 + st.b0 - 0.07, at, T + 0.16, 0.08, st.ww + 0.3, trim, { collide: false });
    }
  };
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh;
    for (const side of ['n', 's', 'e', 'w']) {
      const horiz = side === 'n' || side === 's';
      const len = horiz ? w : d, c = horiz ? x : z;
      const drs = f === 0 ? doors[side].map((dr) => ({ at: c + dr.at, w: dr.w })) : [];
      const { ops, st } = winN(f, side, len, c, drs);
      const openings = [...drs.map((dr) => ({ at: dr.at, w: dr.w, b: 0, top: 2.4 })), ...ops];
      if (horiz) b.wall('x', x0, x1, side === 'n' ? z0 + T / 2 : z1 - T / 2, y0, fh, T, wall, openings);
      else b.wall('z', z0 + T, z1 - T, side === 'w' ? x0 + T / 2 : x1 - T / 2, y0, fh, T, wall, openings);
      for (const op of ops) paneAt(horiz ? 'x' : 'z', horiz ? (side === 'n' ? z0 + T / 2 : z1 - T / 2) : (side === 'w' ? x0 + T / 2 : x1 - T / 2), op.at, y0, st);
    }
  }
  // kapı sundurmaları (zemin)
  for (const side of ['n', 's', 'e', 'w']) {
    for (const dr of doors[side]) {
      const horiz = side === 'n' || side === 's';
      const sgn = side === 'n' || side === 'w' ? -1 : 1;
      const px = horiz ? x + dr.at : (side === 'w' ? x0 : x1) + sgn * 0.5, pz = horiz ? (side === 'n' ? z0 : z1) + sgn * 0.5 : z + dr.at;
      b.box(px, 2.55, pz, horiz ? dr.w + 0.8 : 1.2, 0.14, horiz ? 1.2 : dr.w + 0.8, roof, { collide: false });
      b.box(px, 2.4, pz, horiz ? 0.5 : 0.16, 0.12, horiz ? 0.16 : 0.5, '#fff1c0', { collide: false, o: { glow: true } });       // kapı üstü lamba
      poolDisc(b, px + (horiz ? 0 : sgn * 0.9), 0.09, pz + (horiz ? sgn * 0.9 : 0), 1.8, '#ffe2a0', 0.45, 12);
      b.box(px, 0, pz, horiz ? dr.w + 1.2 : 1.6, 0.1, horiz ? 1.6 : dr.w + 1.2, '#9a9c94', { collide: false });
    }
  }
  // köşe sütunları, kat bantları
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(px, 0, pz, 0.45, H, 0.45, trim, { collide: false });
  for (let f = 1; f <= floors; f++) {
    const yb = f * fh - 0.45;
    b.box(x, yb, z0 - 0.04, w + 0.12, 0.3, 0.16, trim, { collide: false }); b.box(x, yb, z1 + 0.04, w + 0.12, 0.3, 0.16, trim, { collide: false });
    b.box(x0 - 0.04, yb, z, 0.16, 0.3, d + 0.12, trim, { collide: false }); b.box(x1 + 0.04, yb, z, 0.16, 0.3, d + 0.12, trim, { collide: false });
  }
  // çatı korkuluğu (siper)
  if (parapet > 0) {
    const t = 0.3;
    b.box(x, H, z0 + t / 2, w, parapet, t, wall); b.box(x, H, z1 - t / 2, w, parapet, t, wall);
    b.box(x0 + t / 2, H, z, t, parapet, d - 2 * t, wall); b.box(x1 - t / 2, H, z, t, parapet, d - 2 * t, wall);
    b.box(x, H + parapet, z0 + t / 2, w + 0.1, 0.1, t + 0.1, trim, { collide: false }); b.box(x, H + parapet, z1 - t / 2, w + 0.1, 0.1, t + 0.1, trim, { collide: false });
    b.box(x0 + t / 2, H + parapet, z, t + 0.1, 0.1, d - 2 * t, trim, { collide: false }); b.box(x1 - t / 2, H + parapet, z, t + 0.1, 0.1, d - 2 * t, trim, { collide: false });
  }

  // iç bölmeler
  const keeps = (f) => {
    const out = keepsAll.map((k) => ({ ...k }));
    if (f === 0) {
      for (const side of ['n', 's', 'e', 'w']) for (const dr of doors[side]) {
        if (side === 'n') out.push({ x0: x + dr.at - dr.w / 2 - 0.4, x1: x + dr.at + dr.w / 2 + 0.4, z0: z0, z1: z0 + 2.4 });
        if (side === 's') out.push({ x0: x + dr.at - dr.w / 2 - 0.4, x1: x + dr.at + dr.w / 2 + 0.4, z0: z1 - 2.4, z1: z1 });
        if (side === 'w') out.push({ x0: x0, x1: x0 + 2.4, z0: z + dr.at - dr.w / 2 - 0.4, z1: z + dr.at + dr.w / 2 + 0.4 });
        if (side === 'e') out.push({ x0: x1 - 2.4, x1: x1, z0: z + dr.at - dr.w / 2 - 0.4, z1: z + dr.at + dr.w / 2 + 0.4 });
      }
    }
    for (const p of parts) {
      if (p.floors && !p.floors.includes(f)) continue;
      for (const dr of p.doors || []) {
        if (p.axis === 'x') out.push({ x0: x + dr.at - dr.w / 2 - 0.4, x1: x + dr.at + dr.w / 2 + 0.4, z0: z + p.c - 1.4, z1: z + p.c + 1.4 });
        else out.push({ x0: x + p.c - 1.4, x1: x + p.c + 1.4, z0: z + dr.at - dr.w / 2 - 0.4, z1: z + dr.at + dr.w / 2 + 0.4 });
      }
    }
    return out;
  };
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh;
    for (const p of parts) {
      if (p.floors && !p.floors.includes(f)) continue;
      const ops = (p.doors || []).map((dr) => ({ at: (p.axis === 'x' ? x : z) + dr.at, w: dr.w, b: 0, top: 2.3 }));
      if (p.axis === 'x') b.wall('x', x + p.a0, x + p.a1, z + p.c, y0, fh - 0.25, 0.2, partColor, ops);
      else b.wall('z', z + p.a0, z + p.a1, x + p.c, y0, fh - 0.25, 0.2, partColor, ops);
    }
  }
  // oda içi dekor + tavan lambaları
  for (const r of o.rooms || []) {
    const R = { x0: x + r.x0 + 0.12, x1: x + r.x1 - 0.12, z0: z + r.z0 + 0.12, z1: z + r.z1 - 0.12 };
    const yy = r.f * fh;
    if (r.kind) fillRoom(b, rng, r.kind, R, yy, keeps(r.f));
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    const nL = (R.x1 - R.x0) > 8 ? 2 : 1;
    for (let i = 0; i < nL; i++) {
      const lx = nL === 1 ? cx : R.x0 + (R.x1 - R.x0) * (i === 0 ? 0.3 : 0.7);
      b.box(lx, yy + fh - 0.34, cz, 0.9, 0.09, 0.32, '#fff3c4', { collide: false, o: { glow: true } });
      const pr = Math.min(2.0, Math.min(R.x1 - R.x0, R.z1 - R.z0) / 2 - 0.1);                    // zemine ışık havuzu
      if (pr > 0.8) poolDisc(b, lx, yy + 0.05, cz, pr, '#ffe9b0', 0.4, 12);
    }
  }
  // zemin kat dışı kat zemin rengi
  // (merdiven boşluğunu / çatı çıkışını kapatmasın diye boşluk çevresinde parçalara bölünür)
  for (let f = 1; f <= floors; f++) {
    const X0 = x - (w - 0.8) / 2, X1 = x + (w - 0.8) / 2, Z0 = z - (d - 0.8) / 2, Z1 = z + (d - 0.8) / 2, h = holes[f];
    const piece = (ax0, ax1, az0, az1) => { if (ax1 - ax0 > 0.02 && az1 - az0 > 0.02) b.box((ax0 + ax1) / 2, f * fh, (az0 + az1) / 2, ax1 - ax0, 0.02, az1 - az0, floorColor, { collide: false }); };
    if (!h) piece(X0, X1, Z0, Z1);
    else { piece(X0, h.x0, Z0, Z1); piece(h.x1, X1, Z0, Z1); piece(h.x0, h.x1, Z0, h.z0); piece(h.x0, h.x1, h.z1, Z1); }
  }

  return { x0, x1, z0, z1, H, floors, fh };
}

// ───────── Kule (gözetleme / kontrol) ─────────
// Kare gövdeli, iç merdivenli, çatı korkuluklu. Kapı güneyde. stairs: iki uçuş: batı duvarında yukarı, doğu duvarında yukarı.
export function guardTower(b, rng, { x, z, ry = 0, w = 7, d = 7, floors = 2, fh = 3.3, wall = '#8a9189', roof = '#585d62', glass = false }) {
  const hw = w / 2 - 0.35, hd = d / 2 - 0.35;
  const sw = 1.3;
  // uçuş 0: batı duvarı boyunca kuzeyden güneye yükselir; uçuş 1: doğu duvarı boyunca güneyden kuzeye. Kapı güneyde (yerel +z), ry ile döner.
  const stairs = [
    { x: -hw + sw / 2 + 0.05, z: -hd + 1.0, dir: '+z', w: sw, rise: 0.22, run: 0.26 },
    { x: hw - sw / 2 - 0.05, z: hd - 1.0, dir: '-z', w: sw, rise: 0.22, run: 0.26 },
  ];
  let R;
  b.with(x, 0, z, ry, () => {
    R = milBuilding(b, rng, {
      x: 0, z: 0, w, d, floors, fh, wall, roof, doors: { s: [0] }, stairs, roofAccess: true,
      winStyle: glass ? { [floors - 1]: 'wide' } : {},
      rooms: [{ f: 0, kind: 'guard', x0: -w / 2 + 0.35, x1: w / 2 - 0.35, z0: -d / 2 + 0.35, z1: d / 2 - 0.35 }],
      dw: 1.8, parapet: 1.1,
    });
    // çatıda projektör + sandık siperi
    b.box(-w / 2 + 0.9, R.H, -d / 2 + 0.9, 0.12, 2.2, 0.12, '#2a2d30', { collide: false });
    b.box(-w / 2 + 0.9, R.H + 2.1, -d / 2 + 0.9, 0.5, 0.35, 0.7, '#2a2d30', { collide: false });
    b.box(-w / 2 + 1.2, R.H + 2.15, -d / 2 + 0.9, 0.05, 0.25, 0.6, '#fff6d6', { collide: false, o: { glow: true } });
    b.box(-0.2, R.H, -d / 2 + 0.7, 1.4, 0.8, 0.8, '#7b8660');
  });
  return R;
}

// ───────── Garaj sırası (önü açık bölmeler, +Z ön) ─────────
export function garageRow(b, rng, { x, z, ry = 0, bays = 4, bw = 5.6, d = 8, h = 4.2, wall = '#7d857f', roof = '#5a6068', vehicles = [] }) {
  const L = bays * bw;
  b.with(x, 0, z, ry, () => {
    b.box(0, 0, 0.0, L, 0.05, d, '#5f6468', { collide: false });
    b.box(0, 0, -d / 2 + 0.2, L, h, 0.4, wall);                                   // arka duvar
    for (let i = 0; i <= bays; i++) {
      const px = -L / 2 + i * bw;
      b.box(px, 0, 0, 0.4, h, d, i === 0 || i === bays ? wall : '#6e766f');       // ayırıcı/yan duvar
    }
    b.box(0, h - 0.3, 0, L + 0.6, 0.3, d + 0.8, roof);                             // çatı
    b.box(0, h, d / 2 + 0.3, L + 0.7, 0.18, 0.15, '#d9a921', { collide: false });
    b.box(0, h - 0.55, d / 2 + 0.38, L + 0.5, 0.25, 0.08, '#454a50', { collide: false });
    for (let i = 0; i < bays; i++) {
      const cx = -L / 2 + (i + 0.5) * bw;
      // yarı açık rulo kapı (üstte)
      b.box(cx, h - 1.3, d / 2 + 0.2, bw - 0.9, 0.9, 0.12, '#9aa0a8', { collide: false });
      // tavan lambası
      b.box(cx, h - 0.38, 0, 1.4, 0.08, 0.35, '#fff3c4', { collide: false, o: { glow: true } });
      poolDisc(b, cx, 0.09, 0.4, 2.4, '#ffe9b0', 0.4, 12);
      // arka duvarda alet panosu + raf
      b.box(cx - 1.4, 0, -d / 2 + 0.7, 1.2, 1.0, 0.5, '#4a5058');
      b.box(cx + 1.6, 0, -d / 2 + 0.55, 0.9, 0.9, 0.5, '#d9a921');
      b.box(cx, 1.4, -d / 2 + 0.42, 2.0, 1.0, 0.05, '#8a7a5a', { collide: false });
      // zemin şeridi
      b.box(cx, 0.05, 0.4, bw - 1.2, 0.02, d - 1.6, '#43474c', { collide: false });
      const v = vehicles[i];
      if (v) v(b, cx, 0.4);
    }
  });
}

// ───────── Tünel (kapalı geçit; yerel +X boyunca) ─────────
// len: uzunluk, iw: iç genişlik, ih: iç yükseklik. sideDoors: [{at, side:'n'|'s'}], baffles: [{at, side}] zikzak engelleri.
export function tunnel(b, rng, { x, z, ry = 0, len = 30, iw = 3.6, ih = 3.0, color = '#7f867d', sideDoors = [], baffles = [], roofStair = null, glowColor = '#ffe2a0' }) {
  const WT = 0.5;
  b.with(x, 0, z, ry, () => {
    const ho = iw / 2 + WT / 2;
    b.box(0, 0, 0, len, 0.05, iw + 0.2, '#4e5256', { collide: false });
    for (const sd of ['n', 's']) {
      const zc = sd === 'n' ? -ho : ho;
      const ops = sideDoors.filter((s) => s.side === sd).map((s) => ({ at: s.at, w: s.w || 2.0, b: 0, top: 2.5 }));
      b.wall('x', -len / 2, len / 2, zc, 0, ih + 0.5, WT, color, ops);
    }
    b.box(0, ih, 0, len + 0.6, 0.55, iw + 2 * WT + 0.6, '#686e66');             // çatı döşemesi
    // giriş portalları (iki uç): kalın başlık + kanat duvarları
    for (const sx of [-1, 1]) {
      b.box(sx * (len / 2 + 0.15), ih - 0.5, 0, 0.5, 0.5, iw + 2 * WT + 0.8, '#5b615a');
      b.box(sx * (len / 2 + 0.2), 0.0, -(iw / 2 + WT + 0.4), 0.5, ih + 0.5, 0.5, '#5b615a');
      b.box(sx * (len / 2 + 0.2), 0.0, (iw / 2 + WT + 0.4), 0.5, ih + 0.5, 0.5, '#5b615a');
      b.box(sx * (len / 2 + 0.34), 2.0, 0, 0.1, 0.5, 1.2, '#d9a921', { collide: false });
    }
    // iç: lambalar, borular, kablo, zikzak
    const nL = Math.floor(len / 4.5);
    for (let i = 0; i < nL; i++) {
      const lx = -len / 2 + (i + 0.5) * (len / nL);
      b.box(lx, ih - 0.14, 0, 0.9, 0.1, 0.4, glowColor, { collide: false, o: { glow: true } });
      poolDisc(b, lx, 0.06, 0, 1.7, glowColor, 0.4, 10);
      b.box(lx, ih - 0.05, iw / 2 - 0.1, 0.1, 0.05, 0.1, '#222', { collide: false });
    }
    b.box(0, 2.45, -iw / 2 + 0.12, len - 0.4, 0.22, 0.22, '#7a6a52', { collide: false });
    b.box(0, 2.15, -iw / 2 + 0.1, len - 0.4, 0.14, 0.14, '#c0392b', { collide: false });
    b.box(0, 2.6, iw / 2 - 0.12, len - 0.4, 0.3, 0.12, '#46505a', { collide: false });
    b.box(0, 0.0, -iw / 2 + 0.03, len - 0.6, 0.35, 0.06, '#d9a921', { collide: false });
    b.box(0, 0.0, iw / 2 - 0.03, len - 0.6, 0.35, 0.06, '#d9a921', { collide: false });
    for (let i = 0; i < Math.floor(len / 6); i++) {
      const lx = -len / 2 + 3 + i * 6;
      b.box(lx, 0, iw / 2 - 0.2, 0.6, 1.0, 0.35, '#59623f', { collide: false });
    }
    for (const bf of baffles) {
      const zc = bf.side === 'n' ? -iw / 2 + (iw - 1.7) / 2 : iw / 2 - (iw - 1.7) / 2;
      b.box(bf.at, 0, zc, 0.6, ih, iw - 1.7, '#7d867c');
      b.box(bf.at, 2.0, zc, 0.62, 0.12, iw - 1.7, '#d9a921', { collide: false });
    }
    if (roofStair) {
      const sd = roofStair.side === 'n' ? -1 : 1;
      const top = ih + 0.55, n = Math.round(top / 0.2), L = n * 0.3;
      b.stairs(roofStair.at, sd * (iw / 2 + WT + 0.9), 0, '+x', 1.3, n, top / n, 0.3, '#8b8f88');
      // çatı siperi (merdiven girişinde 1.4 m boşluk)
      const gx0 = roofStair.at + L - 1.6, gx1 = roofStair.at + L - 0.1;
      const pz = sd * (iw / 2 + WT - 0.2), pzo = -pz;
      const seg = (a, c, zz) => { if (c - a > 0.1) b.box((a + c) / 2, top, zz, c - a, 0.9, 0.3, '#7d867c'); };
      seg(-len / 2 - 0.3, gx0, pz); seg(gx1, len / 2 + 0.3, pz); seg(-len / 2 - 0.3, len / 2 + 0.3, pzo);
    }
  });
}

// ───────── Çadır (ön yüz +Z yönünde açık) ─────────
export function tent(b, rng, { x, z, ry = 0, w = 5, d = 4, color = '#7b8260', kind = null, big = false }) {
  b.with(x, 0, z, ry, () => {
    const wh = 1.7, ph = big ? 2.0 : 1.5;
    b.box(0, 0, 0, w - 0.2, 0.05, d - 0.2, '#6a6a55', { collide: false });
    b.box(-w / 2 + 0.05, 0, 0, 0.1, wh, d, color);                                     // yan duvarlar
    b.box(w / 2 - 0.05, 0, 0, 0.1, wh, d, color);
    b.box(0, 0, -d / 2 + 0.05, w, wh, 0.1, color);                                      // arka
    b.prism(0, wh, 0, w + 0.3, ph, d + 0.4, color, { ry: 0 });
    b.prism(0, wh, 0, w + 0.32, ph + 0.02, 0.1, '#5e6648', {});
    b.box(0, wh + ph, 0, 0.1, 0.12, d + 0.5, '#4d553a', { collide: false });
    for (const sx of [-1, 1]) b.box(sx * (w / 2 + 0.2), 0, d / 2 + 0.1, 0.08, wh, 0.08, '#5a4a30', { collide: false });
    if (kind) fillRoom(b, rng, kind, { x0: -w / 2 + 0.25, x1: w / 2 - 0.25, z0: -d / 2 + 0.25, z1: d / 2 - 0.1 }, 0, [{ x0: -0.85, x1: 0.85, z0: d / 2 - 1.3, z1: d / 2 + 1 }]);
    b.box(0, wh + ph - 0.45, 0, 0.5, 0.08, 0.3, '#fff3c4', { collide: false, o: { glow: true } });
    b.box(w / 2 + 0.2, 1.9, d / 2 + 0.1, 0.2, 0.28, 0.2, '#ffd98a', { collide: false, o: { glow: true } });                  // giriş feneri
    poolDisc(b, 0, 0.09, d / 2 + 1.0, 2.3, '#ffd27a', 0.45, 12);
  });
}

// ───────── Kamuflaj ağı ─────────
export function camoNet(b, rng, { x, z, w = 8, d = 6, h = 3.6, ry = 0 }) {
  b.with(x, 0, z, ry, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * (w / 2 - 0.2), 0, sz * (d / 2 - 0.2), 0.08, 0.09, h, '#4a3a28', { seg: 5 });
    const cols = ['#4d5c3a', '#5b6a45', '#3f4d33', '#6b6f4a'];
    for (let i = 0; i < 14; i++) {
      const cw = 1.8 + rng() * 2.2, cd = 1.6 + rng() * 2.2;
      b.box((rng() - 0.5) * (w - cw), h + (rng() * 0.3 - 0.15), (rng() - 0.5) * (d - cd), cw, 0.06, cd, cols[i % 4], { collide: false });
    }
  });
}

// ───────── Kule/çatı gibi iç mekân dışı dekor: radar tabağı ─────────
export function radarDish(b, x, y, z, r = 2.4, ry = 0) {
  b.cyl(x, y, z, 0.28, 0.4, 1.2, '#59606a', { seg: 8, collide: false });
  b.cyl(x, y + 1.15, z, 0.18, 0.18, 0.5, '#2a2d30', { seg: 6, collide: false });
  b.with(x, y + 1.7, z, ry, () => {
    b.cyl(0.35, 0, 0, r, 0.3, 0.55, '#d9dcd8', { seg: 12, rz: Math.PI / 2 - 0.35, center: true, collide: false });
    b.box(1.4, -0.1, 0, 0.12, 0.12, 0.12, '#c0392b', { collide: false });
  });
}
