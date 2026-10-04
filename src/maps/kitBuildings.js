// Büyük yapılar: ambar (samanlık/merdiven), depo (asma kat), kilise (çan kulesi merdivenli), benzinlik (market), silo.
// Hepsi yerel çerçevede çizilir ve `ry` (90° katları) ile döndürülebilir. Köşeler b.shell ile tam kapalıdır (boşluk kalmaz).
import { COL, hayBale } from './kitBase.js';
import { put } from './furn.js';
import { house } from './house.js';

const NC = { collide: false };
const toWorld = (x, z, ry) => (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

// ───────── Ambar ─────────
// w×d iç boyut. doors: 'both' | 'front' (yalnız +z yüzü) | 'back'. loft: samanlık asma katı (+z ucu, merdivenle çıkılır, korkuluklu, pencereli).
export function barn(b, rng, { x, z, w = 12, d = 18, color = '#9c3a2c', roof = '#6c7078', ry = 0, doors = 'both', loft = true }) {
  const info = { targets: [], entry: null };
  const tw = toWorld(x, z, ry);
  b.with(x, 0, z, ry, () => {
    const H = 5.2, T = 0.3, yL = 3.0, LD = 4.6;
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    const hasLoft = loft && d >= 12 && w >= 8;
    b.box(0, 0, 0, w - 0.4, 0.06, d - 0.4, '#8a7048', NC);
    const big = { at: 0, w: 4.4, b: 0, top: 4.2 };
    const side = (zl, zh) => {
      const out = [];
      const n = Math.max(1, Math.floor((zh - zl - 1.5) / 3.6));
      for (let i = 0; i < n; i++) out.push({ at: zl + (i + 0.5) * (zh - zl) / n, w: 1.0, b: 1.2, top: 2.3, glass: true, glow: rng() < 0.3 });
      return out;
    };
    const sideOps = (lo) => {
      const ops = side(z0 + 0.6, hasLoft ? z1 - LD - 0.3 : z1 - 0.6);
      if (hasLoft) for (const f of [0.28, 0.72]) ops.push({ at: z1 - LD + f * LD, w: 1.1, b: yL + 0.85, top: yL + 2.0, glass: true, glow: lo && rng() < 0.4 });
      return ops;
    };
    b.shell(x0, x1, z0, z1, 0, H, T, color, {
      n: doors === 'front' ? [] : [big], s: doors === 'back' ? [] : [big], w: sideOps(true), e: sideOps(false),
    });
    // beyaz çerçeve + sürgülü kapı kanatları + X payanda
    const frames = [];
    if (doors !== 'front') frames.push(z0);
    if (doors !== 'back') frames.push(z1);
    for (const zz of frames) {
      const sg = zz === z0 ? -1 : 1;
      for (const sx of [-2.35, 2.35]) b.box(sx, 0, zz + sg * 0.17, 0.25, 4.3, 0.1, COL.white, NC);
      b.box(0, 4.2, zz + sg * 0.17, 4.9, 0.25, 0.1, COL.white, NC);
      for (const sx of [-1, 1]) {
        b.box(sx * 3.7, 0, zz + sg * 0.2, 2.6, 4.1, 0.1, '#7d2f23', NC);
        b.box(sx * 3.7, 0.05, zz + sg * 0.27, 0.12, 4.0, 0.04, COL.white, NC);
      }
    }
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(cx, 0, cz, 0.42, H, 0.42, COL.white, NC);
    b.box(0, H - 0.3, z0, w + T + 0.2, 0.3, T + 0.2, COL.white, NC); b.box(0, H - 0.3, z1, w + T + 0.2, 0.3, T + 0.2, COL.white, NC);
    b.box(x0, H - 0.3, 0, T + 0.2, 0.3, d - T - 0.2, COL.white, NC); b.box(x1, H - 0.3, 0, T + 0.2, 0.3, d - T - 0.2, COL.white, NC);
    b.box(0, H - 0.25, 0, w - 0.1, 0.25, d - 0.1, '#a58a68');
    b.prism(0, H - 0.1, 0, w + 1.4, 4.6, d + 1.2, roof, {});
    b.box(0, H + 4.45, 0, 0.5, 0.2, d + 0.6, '#4a4d52', NC);

    // ── samanlık asma katı ──
    if (hasLoft) {
      const n = 15, run = 0.28, rise = yL / n;
      const zEdge = z1 - LD, zBot = zEdge - n * run;
      b.box(0, yL - 0.25, (zEdge + z1) / 2, w - 0.5, 0.25, z1 - zEdge - 0.15, '#a58a68');
      for (const sx of [x0 + 1.0, x1 - 1.0]) b.box(sx, 0, zEdge + 0.3, 0.3, yL - 0.25, 0.3, '#5e3c1d');
      const rx0 = x0 + 0.2, rx1 = x1 - 1.7;
      b.box((rx0 + rx1) / 2, yL, zEdge + 0.05, rx1 - rx0, 1.0, 0.1, '#8b5a2b');
      b.box((rx0 + rx1) / 2, yL + 0.95, zEdge + 0.05, rx1 - rx0, 0.07, 0.14, '#5e3c1d', NC);
      b.stairs(x1 - 0.85, zBot, 0, '+z', 1.3, n, rise, run, '#b58a57');
      b.box(x1 - 1.55, 0, (zBot + zEdge) / 2, 0.08, yL * 0.5, zEdge - zBot, '#5e3c1d', NC);
      for (let i = 0; i < 4; i++) hayBale(b, x0 + 0.9 + (i % 2) * 1.3, z1 - 1.0 - Math.floor(i / 2) * 1.3, yL);
      b.box(x0 + 1.1, yL, zEdge + 1.2, 1.0, 1.0, 1.0, COL.woodLight);
      b.box(0.5, yL, z1 - 0.8, 1.0, 1.0, 1.0, COL.woodLight);
      b.box(0.5, yL + 1.0, z1 - 0.8, 0.9, 0.9, 0.9, COL.woodLight);
      b.box(0, yL + 2.1, z1 - 0.4, 0.06, 0.6, 0.06, '#ffd98a', { collide: false, o: { glow: true } });
      const [px, pz] = tw(0, z1 - 2.2);
      info.targets.push({ name: 'samanlik', x: px, y: yL, z: pz });
    }
    // ── zemin kat: samanlar, bölmeler, traktör (orta şerit x∈[-2.2,2.2] boş) ──
    const free = hasLoft ? z1 - LD - 0.5 : z1 - 1.0;
    for (let i = 0; i < 6; i++) hayBale(b, x0 + 0.9 + (i % 2) * 1.3, z0 + 1.0 + Math.floor(i / 2) * 1.35);
    b.box(x0 + 1.2, 0, z0 + 6.0, 1.0, 1.0, 1.0, COL.woodLight);
    b.box(x0 + 1.2, 1.0, z0 + 6.0, 0.9, 0.9, 0.9, COL.woodLight);
    // traktör
    if (free - z0 > 11) b.with(x1 - 1.7 - (w > 10 ? 0 : 0), 0, z0 + 3.4, 0, () => {
      b.box(0, 0.5, 0, 1.3, 0.8, 2.2, '#2f6a3a', NC);
      b.box(0, 1.3, 0.3, 1.1, 1.0, 0.9, '#2a2d30', NC);
      b.box(0, 2.2, 0.3, 1.2, 0.1, 1.0, '#2f6a3a', NC);
      for (const sx of [-0.8, 0.8]) { b.cyl(sx, 0.55, 0.7, 0.55, 0.55, 0.35, '#1c1c1e', { rz: Math.PI / 2, center: true, seg: 10, collide: false }); b.cyl(sx, 0.38, -0.8, 0.38, 0.38, 0.25, '#1c1c1e', { rz: Math.PI / 2, center: true, seg: 10, collide: false }); }
      b.collide(0, 0, 0, 1.9, 1.6, 2.4);
    });
    for (let i = 0; i < 2; i++) b.box(x0 + 0.6, 0, (z0 + free) / 2 + 1.0 + i * 1.9, 0.14, 1.5, 1.6, '#7a5a38');   // ahır bölmesi
    // sandık yığını + varil
    const sb = hasLoft ? z1 - LD - 15 * 0.28 - 1.6 : 0;
    b.box(x1 - 1.0, 0, sb, 1.0, 1.0, 1.0, COL.woodLight);
    b.box(x1 - 1.0, 1.0, sb + 0.1, 0.9, 0.9, 0.9, COL.woodLight);
    b.cyl(x1 - 1.0, 0, sb - 1.4, 0.4, 0.4, 1.0, '#4a6a8a', { seg: 8 });
    b.box(0, 3.9, z0 + 0.5, 0.06, 0.6, 0.06, '#ffd98a', { collide: false, o: { glow: true } });
    b.box(0, 3.6, 0, 0.5, 0.3, 0.5, '#2a2d30', NC);
    b.box(0, 3.35, 0, 0.3, 0.2, 0.3, '#ffd98a', { collide: false, o: { glow: true } });
  });
  const [ex, ez] = tw(0, doors === 'back' ? -d / 2 - 2 : d / 2 + 2);
  info.entry = { x: ex, z: ez };
  return info;
}

export function silo(b, x, z, r = 2.2, h = 11) {
  b.cyl(x, 0, z, r + 0.3, r + 0.3, 0.5, '#8a8d90', { seg: 10 });
  b.cyl(x, 0, z, r, r, h, '#b9bdc2', { seg: 10 });
  b.ico(x, h, z, r, '#9ea3a8', { scale: [1, 0.55, 1], detail: 1 });
  for (let i = 1; i < 5; i++) b.cyl(x, i * (h / 5), z, r + 0.05, r + 0.05, 0.18, '#8a8f95', { seg: 10, collide: false });
  b.box(x + r + 0.1, 0, z, 0.1, h - 1, 0.5, '#7a7f85', { collide: false });
  for (let i = 0; i < 12; i++) b.box(x + r + 0.22, 0.4 + i * 0.85, z, 0.04, 0.05, 0.5, '#5a5f65', NC);
}

// ───────── Depo ─────────
// w×d. mezzanine: arka (kuzey) uçta asma kat (merdivenle çıkılır, korkuluklu; mavi/kırmızı takımın tepeden bakış noktası).
export function warehouse(b, rng, { x, z, w = 22, d = 14, ry = 0, mezzanine = true, wall = '#8f949c' }) {
  const info = { targets: [], entry: null };
  const tw = toWorld(x, z, ry);
  b.with(x, 0, z, ry, () => {
    const H = 7, T = 0.35, yM = 3.4;
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    b.box(0, 0, 0, w - 0.4, 0.06, d - 0.4, '#6a6d73', NC);
    const roll = (at) => ({ at, w: 4.2, b: 0, top: 4.4 });
    const hi = (len, skips) => {
      const out = [];
      const n = Math.max(1, Math.floor((len - 2) / 4.6));
      for (let i = 0; i < n; i++) {
        const at = (i + 0.5) * len / n - len / 2;
        if (skips.some((s) => Math.abs(at - s) < 3.2)) continue;
        out.push({ at, w: 1.8, b: 4.6, top: 6.0, glass: true, glow: rng() < 0.5 });
      }
      return out;
    };
    b.shell(x0, x1, z0, z1, 0, H, T, wall, {
      s: [roll(-w * 0.27), roll(w * 0.27), ...hi(w, [-w * 0.27, w * 0.27])],
      n: [roll(0), ...hi(w, [0])],
      w: [{ at: 0, w: 1.5, b: 0, top: 2.3 }, ...hi(d, [0])],
      e: hi(d, []),
    });
    for (const zz of [z1 + 0.19, z0 - 0.19]) b.box(0, 5.2, zz, w, 0.55, 0.06, '#c0392b', NC);
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(cx, 0, cz, 0.5, H, 0.5, '#6e737b', NC);
    b.box(0, H - 0.25, 0, w - 0.1, 0.25, d - 0.1, '#6a6d73');
    b.prism(0, H - 0.1, 0, d + 1.0, 1.6, w + 1.0, '#7b8794', { ry: Math.PI / 2 });
    // sarı güvenlik şeridi (zemin)
    b.box(0, 0.06, 0.0, 0.2, 0.01, d - 2, COL.yellow, NC);
    // ── asma kat ──
    if (mezzanine && d >= 12 && w >= 14) {
      const n = 17, run = 0.28, rise = yM / n, MD = 5.0, MW = 9.0;
      const zEdge = z0 + MD, zBot = zEdge + n * run;
      const mx0 = x0 + 0.2, mx1 = x0 + MW;
      b.box((mx0 + mx1) / 2, yM - 0.25, (z0 + 0.2 + zEdge) / 2, mx1 - mx0, 0.25, zEdge - z0 - 0.2, '#7a7f85');
      for (const [px, pz] of [[mx1 - 0.3, z0 + 0.6], [mx1 - 0.3, zEdge - 0.3], [(mx0 + mx1) / 2, zEdge - 0.3]]) b.box(px, 0, pz, 0.35, yM - 0.25, 0.35, '#3b6a9a');
      // korkuluk: güney kenar (merdiven boşluğu hariç) + doğu kenar
      const stx0 = x0 + 0.3, stx1 = x0 + 1.6;
      b.box((stx1 + mx1) / 2, yM, zEdge, mx1 - stx1, 1.0, 0.1, '#d9a921');
      b.box(mx1, yM, (z0 + 0.2 + zEdge) / 2, 0.1, 1.0, zEdge - z0 - 0.2, '#d9a921');
      b.stairs((stx0 + stx1) / 2, zBot, 0, '-z', 1.3, n, rise, run, '#9aa1a8');
      b.box(stx1 + 0.04, 0, (zEdge + zBot) / 2, 0.08, yM * 0.55, zBot - zEdge, '#3a3d42', NC);
      // asma kat eşyaları
      put(b, rng, 'desk', mx0 + 3.0, yM, z0 + 0.7, 0, undefined);
      put(b, rng, 'chair', mx0 + 3.0, yM, z0 + 1.45, Math.PI);
      put(b, rng, 'filing', mx1 - 0.6, yM, z0 + 1.2, -Math.PI / 2);
      put(b, rng, 'boxStack', mx0 + 5.2, yM, z0 + 3.4, 0);
      b.box(mx0 + 6.6, yM, z0 + 3.6, 1.0, 0.9, 1.0, COL.woodLight);
      b.box((mx0 + mx1) / 2 + 1.0, yM + 2.2, z0 + 2.4, 0.4, 0.3, 0.4, '#ffd98a', { collide: false, o: { glow: true } });
      const [tx, tz] = tw((mx0 + mx1) / 2 + 1, z0 + 3.3);
      info.targets.push({ name: 'asma-kat', x: tx, y: yM, z: tz });
    }
    // ── zemin: raf sırası (kuzey duvar), paletler, forklift, sandıklar ──
    const rackZ = z0 + 0.6 + 0.5;
    for (let i = 0; i < 4; i++) {
      const rx = x1 - 2.0 - i * 2.9;
      if (Math.abs(rx) < 3.0) continue;
      put(b, rng, 'rack', rx, 0.06, rackZ, 0);
    }
    for (let i = 0; i < 3; i++) put(b, rng, 'rack', x1 - 0.6 - 0, 0.06, z0 + 3.6 + i * 3.0, -Math.PI / 2);
    // asma kat merdiveninin alt girişi (batı uç, güney) boş kalsın
    const lob = (px, pz, m = 1.2) => mezzanine && d >= 12 && w >= 14 && px < x0 + 3.6 + m && pz > z0 + 5.0 + 17 * 0.28 - 3.2 - m;
    if (!lob(-w * 0.15, d * 0.12, 1.5)) put(b, rng, 'forklift', -w * 0.15, 0.06, d * 0.12, Math.PI / 2);
    for (const [px, pz] of [[w * 0.18, d * 0.18], [w * 0.28, -d * 0.05], [-w * 0.32, d * 0.27], [w * 0.05, -d * 0.2]]) if (!lob(px, pz)) put(b, rng, 'pallet', px, 0.06, pz, rng() < 0.5 ? 0 : Math.PI / 2);
    for (let i = 0; i < 4; i++) { const cx = -w * 0.18 - rng() * 3, cz = z1 - 1.2 - rng() * 3.0; if (!lob(cx, cz)) b.box(cx, 0, cz, 1.1, 0.9 + rng() * 0.9, 1.1, COL.woodLight); }
    for (const lx of [-w * 0.25, w * 0.1]) b.box(lx, H - 1.4, 0, 0.4, 0.3, 0.4, '#ffd98a', { collide: false, o: { glow: true } });
    for (const lx of [-w * 0.25, w * 0.1]) b.box(lx, H - 1.1, 0, 0.04, 0.9, 0.04, '#2a2d30', NC);
  });
  const [ex, ez] = tw(-w * 0.27, d / 2 + 2);
  info.entry = { x: ex, z: ez };
  return info;
}

// ───────── Kilise ─────────
// Nef w×d (ön yüz −z, çan kulesi önde), pewler/sunak/mumluk, vitray pencereler (gece parlar).
// Çan kulesi: içi iki kollu merdiven (zeminden 3.5 m sahanlık → 7.0 m çan katı), çan katında 4 yöne açık kemerler (nişan noktası).
// Dönüş {entry, targets:[{name,x,y,z}]}.
export function church(b, rng, { x, z, w = 9, d = 16, ry = 0 }) {
  const info = { targets: [], entry: null };
  const tw = toWorld(x, z, ry);
  b.with(x, 0, z, ry, () => {
    const H = 5.4, T = 0.4, wall = '#e6dfcd', stone = '#d8d0bc';
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    const TI = 6.0, TH = 10.4, TWX = TI / 2 + T / 2;
    const zi1 = z0 - T / 2, zi0 = zi1 - TI, zn = zi0 - T / 2;      // kule iç: z∈[zi0,zi1]
    const yL = 3.5, yB = 7.0;
    for (const [px, pz, pw, pd] of [[0, z1 + 0.25, w + 0.5, 0.5], [x0 - 0.25, 0, 0.5, d], [x1 + 0.25, 0, 0.5, d]]) b.box(px, 0, pz, pw, 0.4, pd, COL.plinth, NC);
    b.box(0, 0, 0, w - 0.4, 0.06, d - 0.4, '#a58a68', NC);
    b.box(0, 0, (zn + zi1) / 2, TI, 0.06, TI, '#9a8a70', NC);
    // ── nef duvarları + vitray ──
    const glass = ['#e8887a', '#7aa8e8', '#8ad08a', '#e8c26a'];
    const tall = (len, skip = []) => {
      const out = [];
      const n = Math.floor((len - 3) / 3.0);
      for (let i = 0; i < n; i++) {
        const at = (i - (n - 1) / 2) * 3.0;
        if (skip.some((s) => Math.abs(at - s) < 1.9)) continue;
        out.push({ at, w: 1.1, b: 1.2, top: 4.3, glass: true, glow: rng() < 0.75, glassColor: glass[i % 4] });
      }
      return out;
    };
    b.shell(x0, x1, z0, z1, 0, H, T, wall, {
      n: [{ at: 0, w: 2.0, b: 0, top: 3.3 }],
      s: [{ at: 0, w: 1.6, b: 2.0, top: 4.4, glass: true, glow: true, glassColor: '#e8c26a' }],
      w: [{ at: z0 + 3.2, w: 1.3, b: 0, top: 2.4 }, ...tall(d, [z0 + 3.2])], e: tall(d),
    });
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(cx, 0, cz, 0.55, H, 0.55, stone, NC);
    b.box(0, H - 0.25, 0, w - 0.1, 0.25, d - 0.1, '#e0d8c4');
    // nef çatısı: kule duvarından (z0 + T/2) başlar, kulenin içine uzanmaz (çan katına/kule odasına girmesin)
    const rz0 = z0 + T / 2, rz1 = z1 + 0.5;
    b.prism(0, H - 0.1, (rz0 + rz1) / 2, w + 1.2, 3.6, rz1 - rz0, '#5b4a45', {});
    // ── çan kulesi ──
    // kule duvarları iki bantta: alt bant (kapı/pencere) + üst bant (çan katı kemeri; 7.9…9.9 açıklık, altında 0.9 m siper)
    const yA = yB + 0.9, hU = TH - yA;
    const archOp = (zc) => ({ at: zc, w: 1.7, b: 0, top: 2.0 });
    const tr = { trim: stone };
    b.wall('x', -TWX - T / 2, TWX + T / 2, zn, 0, yA, T, wall, [{ at: 0, w: 2.0, b: 0, top: 3.3 }], tr);
    b.wall('x', -TWX - T / 2, TWX + T / 2, zn, yA, hU, T, wall, [archOp(0)], tr);
    b.wall('x', -TWX - T / 2, TWX + T / 2, z0, H, yA - H, T, wall, [], tr);
    b.wall('x', -TWX - T / 2, TWX + T / 2, z0, yA, hU, T, wall, [archOp(0)], tr);
    const zc = (zn + z0) / 2;
    for (const sx of [-TWX, TWX]) {
      b.wall('z', zn + T / 2, z0 - T / 2, sx, 0, yA, T, wall, [{ at: zc, w: 0.9, b: 1.6, top: 3.0, glass: true, glow: true, glassColor: '#e8c26a' }], tr);
      b.wall('z', zn + T / 2, z0 - T / 2, sx, yA, hU, T, wall, [archOp(zc)], tr);
    }
    for (const [cx, cz] of [[-TWX, zn], [TWX, zn], [-TWX, z0], [TWX, z0]]) b.box(cx, 0, cz, 0.6, TH, 0.6, stone, NC);
    b.box(0, TH - 0.3, (zn + z0) / 2, 2 * TWX + 1.0, 0.3, TI + T + 1.0, stone, NC);
    // sahanlık (yL) + iki kol + çan katı (yB)
    const n = 16, rise = yL / n, run = 0.25, rise2 = (yB - yL) / n;
    b.box(0, yL - 0.25, zi0 + 0.6, TI, 0.25, 1.2, '#7a6a55');
    // A kolu: batı, zeminden yL'ye (güneyden kuzeye)
    const zbA = zi0 + 1.2 + n * run;
    b.stairs(-TI / 2 + 0.6, zbA, 0, '-z', 1.2, n, rise, run, '#8b6a45');
    // B kolu: doğu, yL'den yB'ye (kuzeyden güneye); altı açık
    b.stairs(TI / 2 - 0.6, zi0 + 1.2, yL, '+z', 1.2, n, rise2, run, '#8b6a45', { base: 0 });
    // çan katı döşemesi (boşluk: doğu şerit, B kolunun üstü)
    const hx0 = TI / 2 - 1.2, zh0 = zi0 + 1.2, zh1 = zbA - 0.0;
    b.box((-TI / 2 + hx0) / 2, yB - 0.25, (zi0 + zi1) / 2, hx0 + TI / 2, 0.25, TI, '#7a6a55');
    b.box((hx0 + TI / 2) / 2, yB - 0.25, zi0 + 0.6, TI / 2 - hx0, 0.25, 1.2, '#7a6a55');
    b.box((hx0 + TI / 2) / 2, yB - 0.25, (zh1 + zi1) / 2, TI / 2 - hx0, 0.25, zi1 - zh1, '#7a6a55');
    b.box(hx0 - 0.04, yB, (zh0 + zh1 - 0.8) / 2, 0.08, 1.0, zh1 - 0.8 - zh0, '#8b5a2b');   // boşluk korkuluğu
    // çan + fener
    b.cyl(0, yB + 1.7, (zi0 + zi1) / 2, 0.15, 0.55, 0.9, '#b08a3a', { seg: 8, collide: false });
    b.box(0, yB + 2.7, (zi0 + zi1) / 2, 0.12, 0.25, 0.12, '#4a3a2a', NC);
    b.box(-1.5, yB + 1.2, zi0 + 0.5, 0.3, 0.3, 0.3, '#ffd98a', { collide: false, o: { glow: true } });
    b.box(0, 2.9, zi1 - 1.0, 0.4, 0.14, 0.4, '#ffd98a', { collide: false, o: { glow: true } });
    // çatı: kare piramit + haç
    const tzc = (zn + z0) / 2;
    b.cyl(0, TH, tzc, 0.01, 4.4, 6.5, '#4a3b37', { seg: 4, ry: Math.PI / 4, collide: false });
    b.box(0, TH + 6.5, tzc, 0.15, 1.6, 0.15, '#c9b26a', NC);
    b.box(0, TH + 7.3, tzc, 0.8, 0.15, 0.15, '#c9b26a', NC);
    // giriş basamağı (görsel)
    b.box(0, 0, zn - 0.5, 3.0, 0.14, 1.0, stone, NC);
    // ── iç dizilim: pewler, sunak, mumluklar, lambalar ──
    const rows = [-3.2, -1.0, 1.2, 3.4];
    for (const rz of rows) for (const sx of [-2.5, 2.5]) put(b, rng, 'pew', sx, 0.06, rz, 0);
    put(b, rng, 'altar', 0, 0.06, z1 - 1.5, Math.PI);
    put(b, rng, 'candles', -2.4, 0.06, z1 - 0.9, 0); put(b, rng, 'candles', 2.4, 0.06, z1 - 0.9, 0);
    for (const lz of [-4.5, 0, 4.5]) { b.box(0, H - 0.9, lz, 0.04, 0.9, 0.04, '#2a2d30', NC); b.box(0, H - 1.2, lz, 0.6, 0.18, 0.6, '#ffd98a', { collide: false, o: { glow: true } }); }
    // nefin kenar mumları / çiçek
    for (const sz of [-3.6, 5.4]) put(b, rng, 'plant', -3.9, 0.06, sz, 0);
    const [ex, ez] = tw(0, zn - 2.2);
    info.entry = { x: ex, z: ez };
    const [bx, bz] = tw(-1.0, (zi0 + zi1) / 2);
    info.targets.push({ name: 'sahanlik', x: bx, y: yL, z: bz });
    const [cx, cz] = tw(-1.0, (zi0 + zi1) / 2 + 0.6);
    info.targets.push({ name: 'can-kati', x: cx, y: yB, z: cz });
    const [nx, nz] = tw(0, 0);
    info.targets.push({ name: 'nef', x: nx, y: 0.0, z: nz });
  });
  return info;
}

// ───────── Benzinlik ─────────
// Saçak + pompalar + fiyat tabelası. store: 'n'|'s'|'e'|'w' → saçağın o yanında market binası (içi raflı, çatıya çıkılır).
export function gasStation(b, rng, { x, z, store = false, storeRoof = true, ry = 0 }) {
  const info = { targets: [], entry: null };
  b.with(x, 0, z, ry, () => {
    b.box(0, 4.6, 0, 18, 0.5, 9, COL.white);
    for (const sz of [-4.55, 4.55]) b.box(0, 4.6, sz, 18.2, 0.5, 0.15, '#c0392b', NC);
    for (const sx of [-9.0, 9.0]) b.box(sx, 4.6, 0, 0.15, 0.5, 9.1, '#c0392b', NC);
    for (const px of [-7, 7]) for (const pz of [-3, 3]) b.box(px, 0, pz, 0.55, 4.6, 0.55, '#d8d8d2');
    for (const px of [-4.5, 4.5]) {
      b.box(px, 0, 0, 1.0, 0.18, 6, COL.curb, NC);
      for (const pz of [-1.6, 1.6]) {
        b.box(px, 0.18, pz, 0.8, 1.5, 0.55, '#c0392b');
        b.box(px, 1.3, pz, 0.82, 0.3, 0.57, '#e8e8e4', NC);
        b.box(px + 0.2, 1.1, pz + 0.3, 0.12, 0.3, 0.05, '#2a2d30', NC);
      }
      for (const lz of [-2, 2]) b.box(px, 4.5, lz, 0.9, 0.1, 0.4, '#fff2b0', { collide: false, o: { glow: true } });
    }
    // fiyat tabelası
    b.box(11, 0, -3.5, 0.3, 7, 0.3, '#6a6d73');
    b.box(11, 6.0, -3.5, 0.5, 2.2, 2.4, '#e8e8e4', NC);
    b.box(11, 6.7, -3.5, 0.55, 0.5, 2.0, '#c0392b', NC);
    b.box(11.28, 6.1, -3.5, 0.06, 0.5, 2.0, '#ffd98a', { collide: false, o: { glow: true } });
    // yerde araç lekeleri / hava pompası
    b.cyl(-9.8, 0, 3.8, 0.12, 0.14, 1.2, '#2a6ab0', { seg: 6 });
  });
  if (store) {
    // market, saçağın yerel `store` yönünde; dünya yönü ry ile döner. Kapı pompalara (saçağa) bakar.
    const dirL = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[store];
    const c = Math.cos(ry), s = Math.sin(ry);
    const dx = Math.round(dirL[0] * c + dirL[1] * s), dz = Math.round(-dirL[0] * s + dirL[1] * c);   // dünya yönü (eksen hizalı)
    const sw = 12, sd = 6.5;
    const alongX = dx !== 0;                      // market saçağın doğusunda/batısında
    const off = (store === 'n' || store === 's' ? 4.5 : 9.0) + 1.8 + sd / 2;
    const door = alongX ? (dx < 0 ? 'e' : 'w') : (dz < 0 ? 's' : 'n');
    const hx = x + dx * off, hz = z + dz * off;
    const h = house(b, rng, { x: hx, z: hz, w: alongX ? sd : sw, d: alongX ? sw : sd, floors: 1, flat: true, theme: 'shop', door, wall: '#e8e4d8', roof: '#c0392b', roofAccess: storeRoof, floorColor: '#b9b9b0' });
    info.store = h;
    info.targets.push(...h.targets);
  }
  return info;
}
