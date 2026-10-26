// Kasaba asset kiti · SOKAK / AVLU EŞYALARI (paylaşılabilir). 12.168
// Her eşya kendi yerel çerçevesinde (b.with ile x, z, ry) kurulur; ry yalnız 90° katları (eksen hizalı çarpışma = görsel; dönük kutu
// AABB'si şişip görünmez çarpışma yapar). Parçalar birbirine yalnız değer; çarpışma kutuları görselin içinde.
// S: harita stili { k: { wood, metal, conc, stone, veg, paint, plain, corr, dirt, board, trim, roof, asph } }.
// Dönüş: { x0, x1, z0, z1, h } dünya ayak izi (yerleşim denetimi için; ağaç / çalı bunlara değmez).
import * as THREE from 'three';
import { boxR, extrude, post, roundCollide, shade, leaf, NC } from './kasaba-shapes.js';

const _v = new THREE.Vector3();
// yerel dikdörtgeni o anki çizim matrisiyle dünyaya çevir (90° katları)
export function footW(b, x0, x1, z0, z1, h) {
  let a = 1e9, c = -1e9, e = 1e9, g = -1e9;
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) { _v.set(x, 0, z).applyMatrix4(b.M); a = Math.min(a, _v.x); c = Math.max(c, _v.x); e = Math.min(e, _v.z); g = Math.max(g, _v.z); }
  return { x0: a, x1: c, z0: e, z1: g, h };
}
const at = (b, x, z, ry, fn) => { let r; b.with(x, 0, z, ry, () => { r = fn(); }); return r; };

// ── ahşap sandık: gövde (çarpışma) + iki çember şeridi (K/G tam, D/B arada) ──
export function crate(b, S, x, z, s = 1.0, y = 0, ry = 0, col = '#9a7448') {
  return at(b, x, z, ry, () => b.obj('sandık', () => {
    boxR(b, -s / 2, s / 2, y, y + s, -s / 2, s / 2, col, S.k.wood);
    const bc = shade(col, 0.72), e = 0.02;
    for (const yy of [y + 0.1, y + s - 0.22]) {
      boxR(b, -s / 2 - e, s / 2 + e, yy, yy + 0.12, -s / 2 - e, -s / 2, bc, S.k.wood, NC); boxR(b, -s / 2 - e, s / 2 + e, yy, yy + 0.12, s / 2, s / 2 + e, bc, S.k.wood, NC);
      boxR(b, -s / 2 - e, -s / 2, yy, yy + 0.12, -s / 2, s / 2, bc, S.k.wood, NC); boxR(b, s / 2, s / 2 + e, yy, yy + 0.12, -s / 2, s / 2, bc, S.k.wood, NC);
    }
    return footW(b, -s / 2 - e, s / 2 + e, -s / 2 - e, s / 2 + e, y + s);
  }));
}
// sandık yığını: [ [dx, dz, s, kat], ... ] (üst kattaki alttakinin üstüne oturur — çağıran hizalar)
export function crateStack(b, S, x, z, list, ry = 0) {
  let fp = null;
  b.with(x, 0, z, ry, () => { for (const [dx, dz, s, y] of list) { const f = crate(b, S, dx, dz, s, y); fp = fp ? { x0: Math.min(fp.x0, f.x0), x1: Math.max(fp.x1, f.x1), z0: Math.min(fp.z0, f.z0), z1: Math.max(fp.z1, f.z1), h: Math.max(fp.h, f.h) } : f; } });
  return fp;
}

// ── varil: üst üste oturan sekizgen dilimler (kenar / gövde / çember), çarpışma en dar dilimin içinde ──
export function barrel(b, S, x, z, col = '#a8402f', y = 0) {
  return b.obj('varil', () => {
    const dk = shade(col, 0.62), segs = [[0.27, 0.05, dk], [0.3, 0.22, col], [0.31, 0.05, dk], [0.3, 0.26, col], [0.31, 0.05, dk], [0.3, 0.22, col], [0.27, 0.05, dk]];
    let yy = y;
    for (const [r, h, c] of segs) { post(b, x, yy, z, r, h, c, S.k.metal, { collide: false }); yy += h; }
    roundCollide(b, x, y, z, 0.27, yy - y);
    return footW(b, x - 0.31, x + 0.31, z - 0.31, z + 0.31, yy);
  });
}

// ── palet ──
export function pallet(b, S, x, z, ry = 0) {
  return at(b, x, z, ry, () => b.obj('palet', () => {
    const c = '#a5865a';
    for (const xx of [-0.6, -0.06, 0.48]) boxR(b, xx, xx + 0.12, 0, 0.1, -0.5, 0.5, shade(c, 0.85), S.k.wood);
    boxR(b, -0.6, 0.6, 0.1, 0.14, -0.5, 0.5, c, S.k.wood);
    return footW(b, -0.6, 0.6, -0.5, 0.5, 0.14);
  }));
}

// ── kum torbası siperi: kaydırmalı sıralar, uçlar düz (yarım torba), tek birleşik çarpışma = görünen dikdörtgen ──
export function sandbags(b, S, x, z, len = 3.0, ry = 0, rows = 3) {
  return at(b, x, z, ry, () => b.obj('kumtorbası', () => {
    const bl = 0.6, h = 0.3, d = 0.55, cols = ['#a89468', '#b3a073', '#9d8a60', '#ab9a6e'];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bl / 2 : 0; let u = -len / 2;
      const cuts = [u]; if (off) cuts.push(u + off); for (let q = u + off + bl; q < len / 2 - 0.05; q += bl) cuts.push(q); cuts.push(len / 2);
      for (let i = 0; i < cuts.length - 1; i++) boxR(b, cuts[i], cuts[i + 1], r * h, (r + 1) * h, -d / 2, d / 2, cols[(k++) % 4], S.k.board ?? S.k.wood, NC);
    }
    b.collide(0, 0, 0, len, rows * h, d);
    return footW(b, -len / 2, len / 2, -d / 2, d / 2, rows * h);
  }));
}

// ── beton bariyer (New Jersey kesiti), çarpışma kesitin içinde üç kutu ──
export function barrier(b, S, x, z, ry = 0, len = 2.0, col = '#b9b9b3') {
  return at(b, x, z, ry, () => b.obj('bariyer', () => {
    // kesit: dik gövde + pahlı üst (alçak basamak yok: yanına düşen gövde basamağa sıkışmaz)
    extrude(b, 'x', -len / 2, len / 2, [[-0.25, 0], [0.25, 0], [0.25, 0.62], [0.13, 0.82], [-0.13, 0.82], [-0.25, 0.62]], col, S.k.conc);
    b.collide(0, 0, 0, len, 0.62, 0.5); b.collide(0, 0.62, 0, len, 0.18, 0.26 * 0.995);
    return footW(b, -len / 2, len / 2, -0.25, 0.25, 0.82);
  }));
}

// ── çöp konteyneri ──
export function dumpster(b, S, x, z, ry = 0, col = '#3f6b4a') {
  return at(b, x, z, ry, () => b.obj('konteyner', () => {
    boxR(b, -1.1, 1.1, 0.12, 1.3, -0.55, 0.55, col, S.k.metal);
    boxR(b, -1.16, 1.16, 1.3, 1.38, -0.6, 0.6, shade(col, 0.75), S.k.metal);
    for (const xx of [-0.95, 0.85]) for (const zz of [-0.45, 0.35]) boxR(b, xx, xx + 0.1, 0, 0.12, zz, zz + 0.1, '#1c1c1e', S.k.plain, NC);
    return footW(b, -1.16, 1.16, -0.6, 0.6, 1.38);
  }));
}

// ── bank: iki taş ayak + oturak + sırtlık (ayak arkasında direkler) ──
export function bench(b, S, x, z, ry = 0) {
  return at(b, x, z, ry, () => b.obj('bank', () => {
    const wc = '#8a6440', sc = '#9a968c';
    for (const xx of [-0.75, 0.6]) boxR(b, xx, xx + 0.15, 0, 0.4, -0.2, 0.2, sc, S.k.stone);
    for (let i = 0; i < 3; i++) boxR(b, -0.9, 0.9, 0.4, 0.45, -0.2 + i * 0.14, -0.2 + i * 0.14 + 0.12, wc, S.k.wood, i === 1 ? {} : NC);
    for (const xx of [-0.75, 0.6]) boxR(b, xx, xx + 0.15, 0.45, 0.9, 0.12, 0.2, sc, S.k.stone, NC);
    for (const yy of [0.58, 0.74]) boxR(b, -0.9, 0.9, yy, yy + 0.1, 0.2, 0.24, wc, S.k.wood, NC);
    return footW(b, -0.9, 0.9, -0.2, 0.24, 0.9);
  }));
}

// ── çöp kutusu ──
export function trashCan(b, S, x, z, col = '#4a5a4a') {
  return b.obj('çöp', () => { post(b, x, 0, z, 0.24, 0.8, col, S.k.metal); post(b, x, 0.8, z, 0.27, 0.06, shade(col, 0.7), S.k.metal, { collide: false }); return footW(b, x - 0.27, x + 0.27, z - 0.27, z + 0.27, 0.86); });
}

// ── saksı (taş kasa + toprak + çalı) ──
export function planter(b, S, x, z, w = 1.6, d = 0.8, col = '#9a968c') {
  return b.obj('saksı', () => {
    boxR(b, x - w / 2, x + w / 2, 0, 0.5, z - d / 2, z + d / 2, col, S.k.stone);
    boxR(b, x - w / 2 + 0.08, x + w / 2 - 0.08, 0.5, 0.52, z - d / 2 + 0.08, z + d / 2 - 0.08, '#4a3a2a', S.k.dirt, NC);
    const n = Math.max(1, Math.round(w / 0.8));
    for (let i = 0; i < n; i++) { const r = Math.min(0.36, d / 2 - 0.1); const cx = x - w / 2 + (i + 0.5) * w / n; b.obj('çalı', () => leaf(b, S.k.veg, cx, 0.52, z, r, i % 2 ? '#4f7a33' : '#5d8a3a', { sy: 0.8 })); }
    return footW(b, x - w / 2, x + w / 2, z - d / 2, z + d / 2, 1.1);
  });
}

// ── lamba direği: kaide + sekizgen direk + kol + parlayan başlık. Dönüş başlığın dünya konumunu da verir ──
export function lampPost(b, S, x, z, ry = 0, { h = 5.6, arm = 1.1, glow = '#ffe2a0' } = {}) {
  return at(b, x, z, ry, () => b.obj('lamba', () => {
    const pc = '#3d4045';
    boxR(b, -0.16, 0.16, 0, 0.35, -0.16, 0.16, pc, S.k.metal);
    post(b, 0, 0.35, 0, 0.08, h - 0.35, pc, S.k.metal, { rTop: 0.06 });
    const ap = 0.06 * Math.cos(Math.PI / 8);
    boxR(b, ap, ap + arm, h - 0.22, h - 0.12, -0.04, 0.04, pc, S.k.metal, NC);
    boxR(b, ap + arm - 0.42, ap + arm, h - 0.38, h - 0.22, -0.13, 0.13, '#2e3135', S.k.metal, NC);
    boxR(b, ap + arm - 0.38, ap + arm - 0.04, h - 0.42, h - 0.38, -0.1, 0.1, glow, S.k.plain, { collide: false, o: { glow: true } });
    boxR(b, -0.06, 0.06, h, h + 0.08, -0.06, 0.06, pc, S.k.metal, NC);
    _v.set(ap + arm - 0.2, h - 0.6, 0).applyMatrix4(b.M);
    return { ...footW(b, -0.16, 0.16, -0.16, 0.16, h), head: [_v.x, _v.y, _v.z] };
  }));
}

// ── tahta çit: direkler + aralarında üç yatay tahta (her tahta kendi çarpışması) ──
// pts: [[x,z], ...] köşeler (eksen hizalı doğrular), gaps: [[s, e], ...] doğru boyunca açıklıklar (yalnız tek doğruda)
export function fence(b, S, pts, { h = 1.1, col = '#8a6a45', step = 2.0 } = {}) {
  return b.obj('çit', () => {
    const fps = [], pw = 0.12;
    const postAt = new Set();
    const P = (x, z) => { const k = x.toFixed(2) + ',' + z.toFixed(2); if (postAt.has(k)) return; postAt.add(k); boxR(b, x - pw / 2, x + pw / 2, 0, h + 0.1, z - pw / 2, z + pw / 2, shade(col, 0.8), S.k.wood); };
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], alongX = Math.abs(bz - az) < 1e-6, L = alongX ? bx - ax : bz - az, sg = Math.sign(L), n = Math.max(1, Math.round(Math.abs(L) / step));
      for (let j = 0; j <= n; j++) P(alongX ? ax + L * j / n : ax, alongX ? az : az + L * j / n);
      for (let j = 0; j < n; j++) {
        const s = (alongX ? ax : az) + L * j / n + sg * pw / 2, e = (alongX ? ax : az) + L * (j + 1) / n - sg * pw / 2, lo = Math.min(s, e), hi = Math.max(s, e);
        for (const yy of [0.25, 0.6, h - 0.15]) {
          if (alongX) boxR(b, lo, hi, yy, yy + 0.12, az - 0.025, az + 0.025, col, S.k.wood);
          else boxR(b, ax - 0.025, ax + 0.025, yy, yy + 0.12, lo, hi, col, S.k.wood);
        }
      }
      fps.push(alongX ? footW(b, Math.min(ax, bx) - pw, Math.max(ax, bx) + pw, az - pw, az + pw, h + 0.1) : footW(b, ax - pw, ax + pw, Math.min(az, bz) - pw, Math.max(az, bz) + pw, h + 0.1));
    }
    return fps;
  });
}

// ── çit (bitki): gövde kutusu + üstte bir tık dar taç; ikisi de çarpışmalı (görünen = çarpışma). Bot görüşünü keser. ──
export function hedge(b, S, x0, z0, x1, z1, { h = 1.4, t = 0.8, col = '#3f6a33' } = {}) {
  return b.obj('çit-bitki', () => {
    const alongX = Math.abs(z1 - z0) < 1e-6, lo = Math.min(alongX ? x0 : z0, alongX ? x1 : z1), hi = Math.max(alongX ? x0 : z0, alongX ? x1 : z1), c = alongX ? z0 : x0;
    const R = (a0, a1, y0, y1, w, cc) => (alongX ? boxR(b, a0, a1, y0, y1, c - w / 2, c + w / 2, cc, S.k.veg) : boxR(b, c - w / 2, c + w / 2, y0, y1, a0, a1, cc, S.k.veg));
    R(lo, hi, 0, h - 0.2, t, col);
    R(lo + 0.08, hi - 0.08, h - 0.2, h, t - 0.16, shade(col, 1.12));
    return alongX ? footW(b, lo, hi, c - t / 2, c + t / 2, h) : footW(b, c - t / 2, c + t / 2, lo, hi, h);
  });
}

// ── taş duvar (alçak / yüksek): gövde + harpuşta taşları; isteğe bağlı aralıklı sütunlar (gövde parçaları sütun yüzünde biter) ──
// axis: 'x' | 'z'; a0..a1 boyunca, c'de. gaps: [[s,e]] açıklık. cols: sütun aralığı (0: yok). ruin: üst kotu parça parça düşük.
export function stoneWall(b, S, axis, a0, a1, c, { h = 1.0, t = 0.5, col = '#a39a82', cap = '#847b64', gaps = [], cols = 0, endCols = false, gapCols = false, ruin = false, rng = null, tone = null } = {}) {
  return b.obj('taşduvar', () => {
    const R = (u0, u1, y0, y1, w0, w1, cc, kind, o) => (axis === 'x' ? boxR(b, u0, u1, y0, y1, c + w0, c + w1, cc, kind, o) : boxR(b, c + w0, c + w1, y0, y1, u0, u1, cc, kind, o));
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1), cw = t + 0.2, ch = h + 0.25;
    // sütun konumları
    const colsAt = [];
    if (cols > 0) { const n = Math.max(1, Math.round((hi - lo) / cols)); for (let i = 0; i <= n; i++) colsAt.push(lo + (hi - lo) * i / n); }
    else if (endCols) colsAt.push(lo, hi);
    for (const [s, e] of gaps) if (cols > 0 || endCols || gapCols) colsAt.push(s - cw / 2, e + cw / 2);
    const colR = colsAt.filter((u) => !gaps.some(([s, e]) => u > s && u < e)).map((u) => (endCols && Math.abs(u - lo) < 1e-6 ? [lo, lo + cw] : endCols && Math.abs(u - hi) < 1e-6 ? [hi - cw, hi] : [Math.max(lo, u - cw / 2), Math.min(hi, u + cw / 2)]));   // uç sütunu tam genişlik: dik duvarın kalınlığını örter
    const holes = [...gaps, ...colR];
    const segs = [];
    { const g = holes.map(([s, e]) => [s, e]).sort((p, q) => p[0] - q[0]); let cur = lo; for (const [s, e] of g) { if (s > cur + 1e-4) segs.push([cur, s]); cur = Math.max(cur, e); } if (hi > cur + 1e-4) segs.push([cur, hi]); }
    const fps = [];
    for (const [s, e] of segs) {
      // yıkık: parça boyunca 2–3 basamak
      const pieces = ruin && rng ? (() => { const n = 1 + Math.floor((e - s) / 1.6), out = []; for (let i = 0; i < n; i++) out.push([s + (e - s) * i / n, s + (e - s) * (i + 1) / n, h * (0.45 + rng() * 0.55)]); return out; })() : [[s, e, h]];
      for (const [p0, p1, ph] of pieces) {
        R(p0, p1, 0, ph, -t / 2, t / 2, tone ? tone() : col, S.k.stone);
        if (!ruin) R(p0, p1, ph, ph + 0.1, -t / 2 - 0.04, t / 2 + 0.04, cap, S.k.stone);
      }
      fps.push([s, e, h + 0.1]);
    }
    for (const [s, e] of colR) { R(s, e, 0, ch, -cw / 2, cw / 2, col, S.k.stone); R(s - 0.04, e + 0.04, ch, ch + 0.1, -cw / 2 - 0.04, cw / 2 + 0.04, cap, S.k.stone); fps.push([s - 0.04, e + 0.04, ch + 0.1]); }
    return fps.map(([s, e, hh]) => (axis === 'x' ? footW(b, s, e, c - cw / 2 - 0.04, c + cw / 2 + 0.04, hh) : footW(b, c - cw / 2 - 0.04, c + cw / 2 + 0.04, s, e, hh)));
  });
}

// ── babalık (bollard) ──
export function bollard(b, S, x, z, col = '#3d4045') { return b.obj('babalık', () => { post(b, x, 0, z, 0.1, 0.85, col, S.k.metal); post(b, x, 0.85, z, 0.11, 0.06, '#d9a921', S.k.paint ?? S.k.plain, { collide: false }); return footW(b, x - 0.11, x + 0.11, z - 0.11, z + 0.11, 0.91); }); }

// ── yangın musluğu ──
export function hydrant(b, S, x, z) { return b.obj('musluk', () => { post(b, x, 0, z, 0.14, 0.1, '#8a1f17', S.k.metal); post(b, x, 0.1, z, 0.11, 0.55, '#c0392b', S.k.metal); post(b, x, 0.65, z, 0.12, 0.08, '#8a1f17', S.k.metal, { collide: false }); post(b, x, 0.73, z, 0.06, 0.08, '#8a1f17', S.k.metal, { collide: false }); return footW(b, x - 0.14, x + 0.14, z - 0.14, z + 0.14, 0.81); }); }

// ── sokak tabelası (direk + levha) ──
export function signPost(b, S, x, z, ry = 0, col = '#2c5aa0') {
  return at(b, x, z, ry, () => b.obj('tabela', () => {
    post(b, 0, 0, 0, 0.05, 2.6, '#5a5e64', S.k.metal, { collide: false });
    const ap = 0.05 * Math.cos(Math.PI / 8);
    boxR(b, -0.45, 0.45, 2.2, 2.6, ap, ap + 0.03, col, S.k.paint ?? S.k.plain, NC);
    boxR(b, -0.38, 0.38, 2.27, 2.53, ap + 0.03, ap + 0.055, '#e8e8e4', S.k.plain, NC);
    return footW(b, -0.45, 0.45, -0.05, 0.11, 2.6);
  }));
}

// ── ilan panosu: iki direk + pano + çerçeve ──
export function billboard(b, S, x, z, ry = 0, col = '#2c5aa0') {
  return at(b, x, z, ry, () => b.obj('pano', () => {
    for (const xx of [-1.8, 1.8]) boxR(b, xx - 0.12, xx + 0.12, 0, 5.0, -0.12, 0.12, '#4a4d52', S.k.metal);
    boxR(b, -2.4, 2.4, 2.4, 4.8, 0.12, 0.22, '#3a3d42', S.k.metal);
    boxR(b, -2.25, 2.25, 2.55, 4.65, 0.22, 0.24, col, S.k.paint ?? S.k.plain, NC);
    boxR(b, -1.6, 0.4, 3.0, 4.2, 0.24, 0.27, '#e8e4d8', S.k.plain, NC);
    boxR(b, 0.7, 1.9, 2.9, 4.3, 0.24, 0.27, '#d9a921', S.k.plain, NC);
    return footW(b, -2.4, 2.4, -0.12, 0.27, 5.0);
  }));
}

// ── otobüs durağı: arka pano + iki yan pano + çatı + bank ──
export function busStop(b, S, x, z, ry = 0) {
  return at(b, x, z, ry, () => b.obj('durak', () => {
    const fc = '#3d4045', pc = '#6a8aa0';
    boxR(b, -1.8, 1.8, 0, 2.4, -0.6, -0.5, pc, S.k.plain);
    for (const xx of [-1.8, 1.7]) boxR(b, xx, xx + 0.1, 0, 2.4, -0.5, 0.5, pc, S.k.plain);
    boxR(b, -1.9, 1.9, 2.4, 2.55, -0.7, 0.7, fc, S.k.metal);
    boxR(b, -1.2, 1.2, 0.42, 0.48, -0.5, -0.12, '#8a6440', S.k.wood);
    for (const xx of [-1.0, 0.9]) boxR(b, xx, xx + 0.1, 0, 0.42, -0.4, -0.22, fc, S.k.metal, NC);
    boxR(b, -1.5, -0.3, 1.0, 2.0, -0.5, -0.475, '#d9a921', S.k.plain, NC);
    return footW(b, -1.9, 1.9, -0.7, 0.7, 2.55);
  }));
}

// ── saman balyası ──
export function hayBale(b, S, x, z, y = 0, ry = 0) { return at(b, x, z, ry, () => b.obj('saman', () => { boxR(b, -0.6, 0.6, y, y + 0.6, -0.4, 0.4, '#d6b85a', S.k.board ?? S.k.wood); for (const xx of [-0.3, 0.24]) for (const sz of [-1, 1]) boxR(b, xx, xx + 0.06, y, y + 0.6, sz < 0 ? -0.425 : 0.4, sz < 0 ? -0.4 : 0.425, '#8a6a30', S.k.plain, NC); return footW(b, -0.6, 0.6, -0.425, 0.425, y + 0.6); })); }

// ── mezar taşı ──
export function tombstone(b, S, x, z, ry = 0, rng = Math.random) {
  return at(b, x, z, ry, () => b.obj('mezar', () => {
    const c = rng() > 0.5 ? '#9a968c' : '#a8a49a', h = 0.7 + rng() * 0.35;
    boxR(b, -0.4, 0.4, 0, 0.12, -0.25, 0.25, shade(c, 0.85), S.k.stone);
    boxR(b, -0.3, 0.3, 0.12, h, -0.08, 0.08, c, S.k.stone);
    boxR(b, -0.2, 0.2, h, h + 0.1, -0.08, 0.08, c, S.k.stone, NC);
    boxR(b, -0.4, 0.4, 0.12, 0.14, -0.25, -0.08, '#4a6a3a', S.k.veg, NC);
    return footW(b, -0.4, 0.4, -0.25, 0.25, h + 0.1);
  }));
}

// ── oluklu konteyner (6,1 × 2,44 × 2,6), kapı ucu çubukları ──
export function container(b, S, x, z, ry = 0, col = '#3b6a9a', y = 0) {
  return at(b, x, z, ry, () => b.obj('konteyner-kargo', () => {
    const L = 6.1, W = 2.44, H = 2.6;
    boxR(b, -L / 2, L / 2, y, y + H, -W / 2, W / 2, col, S.k.corr);
    const dk = shade(col, 0.6);
    for (const zz of [-0.62, 0.55]) boxR(b, L / 2, L / 2 + 0.04, y + 0.15, y + H - 0.15, zz, zz + 0.07, dk, S.k.metal, NC);
    for (const xx of [-L / 2, L / 2 - 0.12]) for (const zz of [-W / 2, W / 2 - 0.12]) boxR(b, xx, xx + 0.12, y + H, y + H + 0.03, zz, zz + 0.12, dk, S.k.metal, NC);
    return footW(b, -L / 2, L / 2 + 0.04, -W / 2, W / 2, y + H + 0.03);
  }));
}

// ── lastik yığını ──
export function tires(b, S, x, z, n = 3) { return b.obj('lastik', () => { for (let i = 0; i < n; i++) post(b, x, i * 0.26, z, 0.36, 0.26, i % 2 ? '#1c1c1e' : '#242426', S.k.plain, { collide: false }); roundCollide(b, x, 0, z, 0.36, n * 0.26); return footW(b, x - 0.36, x + 0.36, z - 0.36, z + 0.36, n * 0.26); }); }

// ── odun / kalas yığını ──
export function lumber(b, S, x, z, ry = 0, len = 3.0) {
  return at(b, x, z, ry, () => b.obj('kalas', () => {
    const c = '#a5865a';
    for (const xx of [-len / 2 + 0.3, len / 2 - 0.4]) boxR(b, xx, xx + 0.1, 0, 0.12, -0.6, 0.6, shade(c, 0.7), S.k.wood);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r === 2 ? 1 : 0); i++) boxR(b, -len / 2, len / 2, 0.12 + r * 0.16, 0.28 + r * 0.16, -0.6 + i * 0.3 + (r === 2 ? 0.15 : 0), -0.6 + i * 0.3 + 0.28 + (r === 2 ? 0.15 : 0), shade(c, 0.9 + ((r + i) % 3) * 0.06), S.k.wood, NC);
    b.collide(0, 0.12, 0, len, 0.32, 1.18);
    return footW(b, -len / 2, len / 2, -0.6, 0.6, 0.6);
  }));
}
