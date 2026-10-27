import { KK } from '../kuzey/surface.js';
import { Q, footY, worldRect, roundCollide, roundCollideN, shade, lw, ctxAdd, addLoot, addDoor } from './kuzeyKit.js';

// Kuzey Vadisi kırsal / cephe kiti (12.182; paylaşılabilir, harita önekli dosya). Kural (kuzeyKit ile aynı):
// - Her parça yerel çerçevede kurulur; ry yalnız 90°'nin katı → çarpışma kutuları eksen hizalı, görünen = çarpışma (görünmez çarpışma yok).
// - Zemine oturan her yapının altı ayak izindeki en alçak arazinin 0,3–0,45 m altına inen kaide / temel ile kapanır (havada köşe yok);
//   üst kot = ayak izindeki en yüksek arazi + pay (gömülü yok).
// - İnce süs (≤ 8 cm) ya da erişilemez yükseklikteki parça çarpışmasız olabilir; gövde bandındaki (0,1–1,7 m) kalın görsel parça katıdır.
// Parçalar: kum torbası hattı / mevzisi, yıkık taş ev, şapel, otobüs durağı, yol levhası, yol haçı, kuyu, kuru ot yığını, balya yığını,
// ot arabası, askerî çadır, yanmış otomobil, terk edilmiş benzinlik, trafo merkezi, yel değirmeni, dolusavak eşiği.
const STONE = '#7f786c', CONC = '#8f8c85', SAND = '#a3936b', CANVAS = '#6b6e4a', WOOD = '#6d5440';
const hash = (a, b = 0) => { let h = Math.imul(Math.round(a * 13) ^ Math.imul(Math.round(b * 7), 668265263), 374761393); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
// kaide: yerel (0, 0, 0) üstü y0; alt kenar ayak izindeki en alçak arazinin 'sink' m altında
const plinth = (b, fy, y0, w, d, color = STONE, kind = KK.STONE, sink = 0.45, cx = 0, cz = 0) => b.box(cx, fy.min - sink - y0, cz, w, y0 - fy.min + sink, d, color, { kind });

// ── Kum torbası hattı (eksen hizalı x0,z0 → x1,z1). 1,2 m dilimler araziyi izler; her dilim tek çarpışma kutusu, sıralar görsel (dikiş: tek sıralar 3 cm içerde) ──
export function sandbags(b, T, x0, z0, x1, z1, { h = 1.05, t = 0.62, id = null } = {}) {
  const ax = Math.abs(x1 - x0) >= Math.abs(z1 - z0), len = ax ? Math.abs(x1 - x0) : Math.abs(z1 - z0), n = Math.max(1, Math.round(len / 1.2)), s = len / n;
  const sg = ax ? Math.sign(x1 - x0) || 1 : Math.sign(z1 - z0) || 1;
  b.obj(id || `kumtorba:${Math.round(x0)}:${Math.round(z0)}`, () => {
    for (let i = 0; i < n; i++) {
      const c = (i + 0.5) * s * sg, x = ax ? x0 + c : x0, z = ax ? z0 : z0 + c;
      const ys = []; for (const k of [-0.5, 0, 0.5]) for (const e of [-t / 2, 0, t / 2]) ys.push(T.heightAt(ax ? x + k * s : x + e, ax ? z + e : z + k * s));     // eksen + iki yan (yan eğimde köşe havada kalmaz)
      const lo = Math.min(...ys), hi = Math.max(...ys);
      const base = lo - 0.25, top = hi + h, W = ax ? s : t, D = ax ? t : s;
      b.collide(x, base, z, W, top - base, D);
      const rows = Math.max(2, Math.round(h / 0.26)), rh = (top - hi) / rows;
      b.box(x, base, z, W, hi - base + rh, D, (i & 1) ? SAND : shade(SAND, 0.94), { collide: false, kind: KK.PLASTER });
      for (let r = 1; r < rows; r++) {
        const inset = r & 1 ? 0.06 : 0, col = ((r + i) & 1) ? shade(SAND, 0.9) : SAND;
        b.box(x, hi + r * rh, z, ax ? W : W - inset, rh, ax ? D - inset : D, col, { collide: false, kind: KK.PLASTER });
      }
    }
  });
}
// U biçimli mevzi (yerel: ön duvar −z boyunca, yan duvarlar arkaya; arka açık). Duvarlar yalnız yüz yüze değer.
export function sandbagNest(b, T, x, z, ry = 0, { w = 4.2, d = 2.8, h = 1.05, t = 0.62 } = {}) {
  const id = `mevzi:${Math.round(x)}:${Math.round(z)}`, P = (lx, lz) => lw(x, z, ry, lx, lz);
  const [a0, a1] = [P(-w / 2, -d / 2 + t / 2), P(w / 2, -d / 2 + t / 2)];
  sandbags(b, T, a0[0], a0[1], a1[0], a1[1], { h, t, id });
  for (const sd of [-1, 1]) { const [p0, p1] = [P(sd * (w / 2 - t / 2), -d / 2 + t), P(sd * (w / 2 - t / 2), d / 2)]; sandbags(b, T, p0[0], p0[1], p1[0], p1[1], { h, t, id }); }
  return worldRect(x, z, w, d, ry);
}

// ── Yıkık taş ev (çatısız, kırık duvarlar; kapı +z) ──
export function ruin(b, T, o) {
  const { x, z, w = 8, d = 6.5, ry = 0, wall = '#8d877b', seed = 1 } = o;
  const [x0, x1, z0, z1] = worldRect(x, z, w + 0.3, d + 0.3, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.max + 0.15, t = 0.45;
  const id = o.id || `yıkık:${Math.round(x)}:${Math.round(z)}`;
  const door = ((seed % 3) - 1) * w * 0.2, DW = 1.4;
  b.obj(id, () => b.with(x, y0, z, ry, () => {
    plinth(b, fy, y0, w + 0.3, d + 0.3);
    // duvar dilimleri: [a0, a1] aralığı ~1 m dilim, kırık tepe (0,7–3,1 m), bazı dilimler pencere boşluğu (0,9 m'de kesik)
    const run = (axis, a0, a1, c, gaps, salt) => {
      const segs = []; let cur = a0;
      for (const [g0, g1] of gaps) { if (g0 > cur) segs.push([cur, g0]); cur = Math.max(cur, g1); }
      if (a1 > cur) segs.push([cur, a1]);
      for (const [s0, s1] of segs) {
        const n = Math.max(1, Math.round((s1 - s0) / 1.05));
        for (let i = 0; i < n; i++) {
          const u0 = s0 + (s1 - s0) * i / n, u1 = s0 + (s1 - s0) * (i + 1) / n, r = hash(seed * 31 + salt + i, u0);
          const hh = r < 0.18 ? 0.9 : 0.75 + 2.4 * hash(seed + salt * 7 + i, u1), col = shade(wall, 0.9 + 0.16 * hash(u0, salt));
          if (axis === 'x') b.box((u0 + u1) / 2, 0, c, u1 - u0, hh, t, col, { kind: KK.STONE }); else b.box(c, 0, (u0 + u1) / 2, t, hh, u1 - u0, col, { kind: KK.STONE });
          if (hh > 1.6 && hash(u0, seed + salt) < 0.5) {                       // kırık tepe: dilimin yarısı 0,3–0,6 m daha yüksek
            const um = (u0 + u1) / 2, ex = 0.3 + 0.3 * hash(u1, salt), k = hash(i, salt) < 0.5;
            const [q0, q1] = k ? [u0, um] : [um, u1];
            if (axis === 'x') b.box((q0 + q1) / 2, hh, c, q1 - q0, ex, t, col, { kind: KK.STONE }); else b.box(c, hh, (q0 + q1) / 2, t, ex, q1 - q0, col, { kind: KK.STONE });
          }
        }
      }
    };
    run('x', -w / 2, w / 2, d / 2 - t / 2, [[door - DW / 2, door + DW / 2]], 1);
    run('x', -w / 2, w / 2, -d / 2 + t / 2, [], 2);
    run('z', -d / 2 + t, d / 2 - t, -w / 2 + t / 2, [], 3);
    run('z', -d / 2 + t, d / 2 - t, w / 2 - t / 2, hash(seed, 9) < 0.5 ? [[-0.7, 0.7]] : [], 4);   // bazen yan duvarda da yıkık geçit
    // moloz yığınları (köşelerde, kapı önünü kapatmaz) + devrik kiriş
    const iw = w - 2 * t, id2 = d - 2 * t;
    for (const [sx, sz, k] of [[-1, -1, 0], [1, -1, 1], [-1, 1, 2]]) {
      if (hash(seed, k) < 0.25) continue;
      const rw = 1.0 + 0.7 * hash(k, seed), rd = 0.9 + 0.6 * hash(seed, k + 4), rh = 0.35 + 0.35 * hash(k + 2, seed);
      const cx = sx * (iw / 2 - rw / 2), cz = sz * (id2 / 2 - rd / 2);
      if (sz > 0 && Math.abs(cx - door) < DW / 2 + rw / 2 + 0.6) continue;
      b.box(cx, 0, cz, rw, rh, rd, shade(wall, 0.82), { kind: KK.STONE });
      b.box(cx + (rw * 0.15) * sx, rh, cz, rw * 0.5, rh * 0.5, rd * 0.55, shade(wall, 0.76), { kind: KK.STONE });
    }
    if (hash(seed, 7) < 0.6) b.box(0, 0, -id2 / 2 + 0.6, Math.min(iw - 0.4, 4.4), 0.26, 0.26, '#4e3d2e', { kind: KK.BARK });
    const hd = y0 - T.heightAt(...lw(x, z, ry, door, d / 2 + 0.6));
    if (hd > 0.45) { const n = Math.ceil(hd / 0.4); for (let k = 1; k < n; k++) b.box(door, -hd - 0.3, d / 2 + 0.15 + k * 0.36 - 0.18, 1.6, hd + 0.3 - k * hd / n, 0.36, STONE, { kind: KK.STONE }); }
  }));
  addDoor(b, x, z, ry, y0, door, d / 2, 0, 1);
  addLoot(b, x, z, ry, y0, [[0, 0, 'zemin']]);
  return { y0, rect: [x0, x1, z0, z1] };
}

// ── Yol kenarı şapeli (taş, beşik çatı, alın çan yuvası; içine girilir) ──
export function chapel(b, T, o) {
  const { x, z, ry = 0, w = 5, d = 7, h = 4.2 } = o, t = 0.4, ST = '#9a9286', RO = '#7a3f2c';
  const [x0, x1, z0, z1] = worldRect(x, z, w + 0.6, d + 0.6, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.max + 0.2;
  b.obj(o.id || `şapel:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    plinth(b, fy, y0, w + 0.6, d + 0.6);
    const win = [{ at: -d * 0.18, w: 0.6, b: 1.5, top: 2.8, glass: true }, { at: d * 0.2, w: 0.6, b: 1.5, top: 2.8, glass: true }];
    b.withKind(KK.STONE, () => b.shell(-w / 2 + t / 2, w / 2 - t / 2, -d / 2 + t / 2, d / 2 - t / 2, 0, h, t, ST, { s: [{ at: 0, w: 1.3, b: 0, top: 2.5 }], e: win, w: win }, { trim: '#d8d0c2', kind: KK.STONE }));
    b.box(0, h - 0.2, 0, w - 2 * t, 0.2, d - 2 * t, '#5b4b3c', { kind: KK.PLANK });
    const s = w / 2, rh = s * 0.9, a = Math.atan2(rh, s), L = (s + 0.35) / Math.cos(a);
    b.withKind(KK.STONE, () => b.prism(0, h, 0, w, rh, d, ST));
    for (const sg of [1, -1]) b.box(sg * ((s + 0.35) / 2 + Math.sin(a) * 0.08), h + (s - 0.35) * Math.tan(a) / 2 + Math.cos(a) * 0.08 - 0.08, 0, L, 0.16, d + 0.5, RO, { collide: false, rz: -sg * a, kind: KK.TILE });
    // alın çan yuvası (ön alın üstünde; erişilemez yükseklik) + haç
    b.box(0, h + rh - 0.3, d / 2 - 0.35, 1.0, 1.5, 0.5, ST, { kind: KK.STONE });
    b.box(0, h + rh + 1.2, d / 2 - 0.35, 1.2, 0.15, 0.7, shade(ST, 0.9), { kind: KK.STONE });
    b.cyl(0, h + rh + 0.4, d / 2 - 0.35, 0.18, 0.26, 0.42, '#8a6a2e', { seg: 8, collide: false, kind: KK.METAL });
    b.box(0, h + rh + 1.35, d / 2 - 0.35, 0.08, 0.9, 0.08, '#3a3632', { collide: false });
    b.box(0, h + rh + 1.9, d / 2 - 0.35, 0.5, 0.08, 0.08, '#3a3632', { collide: false });
    // iç: sunak + iki sıra
    b.box(0, 0, -d / 2 + t + 0.45, 1.6, 0.95, 0.9, '#b8ae9c', { kind: KK.STONE });
    for (const sx of [-1, 1]) for (const zz of [0.2, 1.5]) { b.box(sx * 1.05, 0.42, zz, 1.4, 0.06, 0.42, '#6d5440', { kind: KK.PLANK }); for (const ex of [-0.6, 0.6]) b.box(sx * 1.05 + ex, 0, zz, 0.08, 0.42, 0.36, '#5b4130', { kind: KK.PLANK }); }
  }));
  addDoor(b, x, z, ry, y0, 0, d / 2, 0, 1);
  addLoot(b, x, z, ry, y0, [[0, -d / 2 + 1.2, 'tezgâh', 0.95], [w / 2 - 0.8, d / 2 - 0.9, 'zemin']]);
  return { y0, rect: [x0, x1, z0, z1] };
}

// ── Otobüs durağı (beton taban, arka / yan pano, çatı, bank, levha direği; açık yüz +z) ──
export function busStop(b, T, x, z, ry = 0) {
  const [x0, x1, z0, z1] = worldRect(x, z, 3.6, 2.0, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.max + 0.12, M = '#596470';
  b.obj(`durak:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    plinth(b, fy, y0, 3.6, 2.0, CONC, KK.CONC, 0.3);
    b.box(0, 0, -0.85, 3.4, 2.3, 0.1, '#8b98a3', { kind: KK.METAL });
    for (const sx of [-1, 1]) b.box(sx * 1.65, 0, -0.25, 0.1, 2.3, 1.1, '#8b98a3', { kind: KK.METAL });
    b.box(0, 2.3, -0.3, 3.6, 0.12, 1.9, M, { kind: KK.METAL });
    b.box(0, 0.42, -0.55, 2.6, 0.06, 0.42, '#7a5d44', { kind: KK.PLANK });
    for (const sx of [-1.1, 1.1]) b.box(sx, 0, -0.55, 0.07, 0.42, 0.36, M, { kind: KK.METAL });
    b.box(0, 1.25, -0.79, 1.4, 0.9, 0.02, '#c9c2a8', { collide: false });                   // tarife panosu
    b.box(1.6, 0, 0.8, 0.09, 2.7, 0.09, M, { kind: KK.METAL });
    b.box(1.6, 2.2, 0.865, 0.55, 0.55, 0.04, '#e0c22e', { collide: false });
  }));
  return [x0, x1, z0, z1];
}
// ── Yol levhası (direk + levha; levha 1,8 m üstünde) ──
export function roadSign(b, T, x, z, ry = 0, color = '#2c5aa0') {
  const y0 = T.heightAt(x, z) - 0.25;
  b.obj(`levha:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    b.box(0, 0, 0, 0.09, 2.75, 0.09, '#8a8f94', { kind: KK.METAL });
    b.box(0, 2.05, 0.07, 1.1, 0.6, 0.04, color, { collide: false });
    b.box(0, 2.08, 0.095, 0.95, 0.06, 0.01, '#f2f2ee', { collide: false });
  }));
}
// ── Yol haçı / taş niş (kaide + taş direk + demir haç) ──
export function wayCross(b, T, x, z, ry = 0) {
  const fy = footY(T, x - 0.45, x + 0.45, z - 0.45, z + 0.45), y0 = fy.max + 0.1;
  b.obj(`haç:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    plinth(b, fy, y0, 0.9, 0.9, STONE, KK.STONE, 0.3);
    b.box(0, 0, 0, 0.6, 0.35, 0.6, shade(STONE, 1.08), { kind: KK.STONE });
    b.box(0, 0.35, 0, 0.32, 1.55, 0.32, '#a29a8c', { kind: KK.STONE });
    b.box(0, 1.9, 0, 0.07, 0.9, 0.07, '#2f2c2a', { collide: false, kind: KK.METAL });
    b.box(0, 2.42, 0, 0.55, 0.07, 0.07, '#2f2c2a', { collide: false, kind: KK.METAL });
  }));
}
// ── Kuyu (sekizgen taş bilezik, iki direk + küçük çatı) ──
export function well(b, T, x, z) {
  const fy = footY(T, x - 1, x + 1, z - 1, z + 1), y0 = fy.max + 0.05;
  b.obj(`kuyu:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, 0, () => {
    b.cyl(0, fy.min - 0.35 - y0, 0, 0.95, 1.0, 0.35 + y0 - fy.min + 0.8, '#8a8274', { seg: 8, ry: Math.PI / 8, collide: false, kind: KK.STONE });
    roundCollide(b, 0, fy.min - 0.35 - y0, 0, 0.92, 0.35 + y0 - fy.min + 0.8);
    b.cyl(0, 0.8, 0, 0.7, 0.7, 0.02, '#1d2224', { seg: 8, ry: Math.PI / 8, collide: false });
    for (const sx of [-1, 1]) b.box(sx * 0.82, 0.8, 0, 0.12, 1.5, 0.12, '#5b4130', { kind: KK.PLANK });
    b.box(0, 2.18, 0, 1.76, 0.1, 0.1, '#4e3826', { collide: false, kind: KK.PLANK });
    b.withKind(KK.TILE, () => b.prism(0, 2.3, 0, 2.0, 0.6, 1.3, '#6e4434', { collide: false }));
  }));
}
// ── Kuru ot yığını (silindir + koni; çarpışma içe çizilmiş 2 kademe) ──
export function haystack(b, T, x, z, r = 1.6) {
  const y0 = Math.min(T.heightAt(x - r * 0.7, z), T.heightAt(x + r * 0.7, z), T.heightAt(x, z - r * 0.7), T.heightAt(x, z + r * 0.7)) - 0.1;
  b.obj(`otyığını:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, 0, () => {
    b.cyl(0, 0, 0, r, r * 0.92, 1.5, '#c2a05a', { seg: 10, collide: false, kind: KK.PLANK });
    b.cyl(0, 1.5, 0, 0.15, r, 1.7, '#b8964f', { seg: 10, collide: false, kind: KK.PLANK });
    const ri = Math.cos(Math.PI / 10) * 0.98;                                                  // 10 kenarlı gövdenin iç yarıçapı
    roundCollideN(b, 0, 0, 0, r * 0.92 * ri, 1.5);
    for (const [y0c, y1c] of [[1.5, 1.85], [1.85, 2.3], [2.3, 2.8]]) roundCollideN(b, 0, y0c, 0, (r - (r - 0.15) * (y1c - 1.5) / 1.7) * ri, y1c - y0c, 6);
    b.box(0, 3.15, 0, 0.06, 0.5, 0.06, '#5b4636', { collide: false });
  }));
}
// ── Mıcır / taş yığını (taş ocağı; koni, çarpışma içe çizilmiş kademeler) ──
export function gravelPile(b, T, x, z, r = 3, color = '#8f8b82') {
  const y0 = Math.min(T.heightAt(x - r * 0.8, z), T.heightAt(x + r * 0.8, z), T.heightAt(x, z - r * 0.8), T.heightAt(x, z + r * 0.8)) - 0.15, h = r * 0.85;
  b.obj(`mıcır:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, 0, () => {
    b.cyl(0, 0, 0, r * 0.12, r, h, color, { seg: 10, collide: false, kind: KK.STONE });
    const ri = Math.cos(Math.PI / 10) * 0.97;
    const n = Math.ceil(h / 0.27);                                                                  // kademe ≤ 27 cm: koni yüzü ile çarpışma arası < 0,3 m
    for (let k = 0; k < n; k++) { const ya = h * k / n, yb = h * (k + 1) / n; roundCollideN(b, 0, ya, 0, (r - (r - r * 0.12) * yb / h) * ri, yb - ya, 6); }
  }));
  return [x - r, x + r, z - r, z + r];
}

// ── Balya yığını (dikdörtgen balyalar, piramit; her balya kendi kutusu, yalnız yüz yüze) ──
export function balePile(b, T, x, z, ry = 0, n = 3) {
  const [x0, x1, z0, z1] = worldRect(x, z, n * 1.2, 0.9, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.min - 0.06;
  b.obj(`balya:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    const lift = fy.max - fy.min;
    for (let row = 0; row < n; row++) for (let k = 0; k < n - row; k++) {
      const bx = (k - (n - row - 1) / 2) * 1.2, by = row * 0.5 + (row ? lift : 0), bh = row ? 0.5 : 0.5 + lift;
      b.box(bx, by, 0, 1.2, bh, 0.85, (k + row) & 1 ? '#d2b465' : '#c8aa5c', { kind: KK.PLANK });
      b.box(bx, by + bh - 0.32, 0, 1.21, 0.03, 0.86, '#7c6a3a', { collide: false });
    }
  }));
  return [x0, x1, z0, z1];
}
// ── Ot arabası (ahşap kasa, iki tekerlek, ok) — yerel +x ok yönü ──
export function hayCart(b, T, x, z, ry = 0) {
  const [x0, x1, z0, z1] = worldRect(x, z, 3.6, 1.8, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.min - 0.05;
  b.obj(`araba:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    const lift = fy.max - fy.min;
    b.box(-0.2, 0.6 + lift, 0, 2.8, 0.12, 1.5, '#7a5b3e', { kind: KK.PLANK });
    for (const sz of [-1, 1]) b.box(-0.2, 0.72 + lift, sz * 0.72, 2.8, 0.45, 0.06, '#6d5236', { kind: KK.PLANK });
    b.box(-1.57, 0.72 + lift, 0, 0.06, 0.45, 1.38, '#6d5236', { kind: KK.PLANK });
    b.box(-0.2, 0.72 + lift, 0, 2.6, 0.38, 1.3, '#c8aa5c', { kind: KK.PLANK });                    // yük (saman)
    for (const sz of [-1, 1]) {
      b.cyl(-0.2, 0.6, sz * 0.86, 0.58, 0.58, 0.1, '#4e3826', { rx: Q, center: true, seg: 10, collide: false, kind: KK.PLANK });
      b.box(-0.2, 0, sz * 0.86, 0.8, 0.6 + lift, 0.1, '#4e3826', { collide: true, kind: KK.PLANK });   // tekerlek altı (çarpışma tekerleğin içinde)
    }
    b.box(1.75, 0.55 + lift, 0, 1.1, 0.08, 0.6, '#5b4130', { kind: KK.PLANK });
    b.box(2.25, 0, 0, 0.12, 0.6 + lift, 0.12, '#5b4130', { kind: KK.PLANK });
  }));
  return [x0, x1, z0, z1];
}

// ── Askerî çadır (2 m duvar, kanvas çatı katı; kapı +z; içinde 2 portatif yatak + sandık) ──
export function tent(b, T, o) {
  const { x, z, ry = 0, w = 4.4, d = 6.2, color = CANVAS } = o;
  const [x0, x1, z0, z1] = worldRect(x, z, w + 0.4, d + 0.4, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.max + 0.1, H = 2.0, t = 0.08;
  b.obj(o.id || `çadır:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    plinth(b, fy, y0, w + 0.4, d + 0.4, '#77705e', KK.PLANK, 0.3);
    b.withKind(KK.PLASTER, () => b.shell(-w / 2 + t / 2, w / 2 - t / 2, -d / 2 + t / 2, d / 2 - t / 2, 0, H, t, color, { s: [{ at: 0, w: 1.3, b: 0, top: H }] }, { kind: KK.PLASTER }));
    b.withKind(KK.PLASTER, () => b.prism(0, H, 0, w + 0.1, 1.1, d + 0.1, shade(color, 1.06)));
    b.box(0, 0, d / 2 + 0.02, 1.5, 0.08, 0.06, shade(color, 0.8), { collide: false });         // kapı eşiği bandı
    for (const sx of [-1, 1]) { b.box(sx * (w / 2 - 0.55), 0, -0.4, 0.8, 0.42, 2.0, '#4f5440', { kind: KK.PLANK }); }
    b.box(0, 0, -d / 2 + 0.5, 1.0, 0.6, 0.6, '#5d5a3c', { kind: KK.PLANK });
  }));
  addDoor(b, x, z, ry, y0, 0, d / 2, 0, 1);
  addLoot(b, x, z, ry, y0, [[0, -d / 2 + 0.5, 'sandık', 0.6], [w / 2 - 0.55, -0.4, 'zemin', 0.42]]);
  return { y0, rect: [x0, x1, z0, z1] };
}

// ── Yanmış / terk edilmiş otomobil (yerel +x ön; görünen = çarpışma; camsız kabin: kurşun pencereden geçer) ──
export function burntCar(b, T, x, z, ry = 0, color = '#3b3633') {
  const [x0, x1, z0, z1] = worldRect(x, z, 4.3, 1.8, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.min - 0.04;
  const lift = fy.max - fy.min, c = color, dk = shade(color, 0.7), rust = '#5a3a26';
  b.obj(`enkaz:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    b.box(0, 0, 0, 4.1, 0.22 + lift, 1.62, '#232120', { kind: KK.RUST });                       // jantların üstüne çökmüş şasi
    b.box(0, 0.22 + lift, 0, 4.2, 0.43, 1.72, c, { kind: KK.RUST });                             // gövde alt
    b.box(1.45, 0.65 + lift, 0, 1.3, 0.2, 1.68, dk, { kind: KK.RUST });                         // kaput
    b.box(-1.7, 0.65 + lift, 0, 0.8, 0.24, 1.68, dk, { kind: KK.RUST });                        // bagaj
    for (const sz of [-1, 1]) b.box(-0.2, 0.65 + lift, sz * 0.8, 1.9, 0.32, 0.08, c, { kind: KK.RUST });   // kapı üstleri
    for (const [px, pz] of [[0.7, 0.78], [0.7, -0.78], [-1.15, 0.78], [-1.15, -0.78]]) b.box(px, 0.97 + lift, pz, 0.08, 0.42, 0.08, dk, { kind: KK.RUST });   // dikmeler
    b.box(-0.22, 1.39 + lift, 0, 1.95, 0.07, 1.64, rust, { kind: KK.RUST });                    // çökük tavan
    b.box(-0.2, 0.65 + lift, 0, 1.0, 0.3, 1.2, '#1d1b1a', { kind: KK.RUST });                   // yanmış koltuklar
    for (const wx of [-1.25, 1.25]) for (const wz of [-0.86, 0.86]) { const [gx, gz] = lw(x, z, ry, wx, wz); if (T.heightAt(gx, gz) < y0 + 0.55) b.cyl(wx, 0.3, wz, 0.3, 0.3, 0.06, '#5d5650', { rx: Q, center: true, seg: 10, collide: false, kind: KK.METAL }); }   // jant (toprağa gömülen çizilmez)
  }));
  return [x0, x1, z0, z1];
}

// ── Terk edilmiş benzinlik (yerel: kanopi +z önde, büfe arkada solda; plak eğimde beton kaide) ──
export function gasStation(b, T, o) {
  const { x, z, ry = 0 } = o, W = 26, D = 18;
  const [x0, x1, z0, z1] = worldRect(x, z, W, D, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.max + 0.12;
  b.obj(o.id || 'benzinlik', () => b.with(x, y0, z, ry, () => {
    plinth(b, fy, y0, W, D, '#8d8a83', KK.CONC, 0.4);
    // büfe (9 × 6,5, düz çatı + korkuluk), vitrinler kırık (açıklık), kapı
    const bx = -7.5, bz = -5.5, bw = 9, bd = 6.5, bh = 3.4, t = 0.3;
    b.with(bx, 0, bz, 0, () => {
      b.withKind(KK.PLASTER, () => b.shell(-bw / 2 + t / 2, bw / 2 - t / 2, -bd / 2 + t / 2, bd / 2 - t / 2, 0, bh, t, '#d9d3c4', { s: [{ at: -2.4, w: 2.6, b: 0.9, top: 2.4 }, { at: 0.6, w: 1.2, b: 0, top: 2.3 }, { at: 2.9, w: 1.8, b: 0.9, top: 2.4 }], e: [{ at: 0.5, w: 1.0, b: 0, top: 2.2 }] }, { trim: '#b33a2a', kind: KK.PLASTER }));
      b.box(0, bh, 0, bw + 0.4, 0.3, bd + 0.4, '#bdb6a6', { kind: KK.CONC });
      for (const [ax, az, ww, dd] of [[0, bd / 2 + 0.05, bw + 0.4, 0.1], [0, -bd / 2 - 0.05, bw + 0.4, 0.1], [bw / 2 + 0.05, 0, 0.1, bd + 0.2], [-bw / 2 - 0.05, 0, 0.1, bd + 0.2]]) b.box(ax, bh + 0.3, az, ww, 0.5, dd, '#b33a2a', { kind: KK.PLASTER });
      b.box(-2.0, 0, -0.6, 2.6, 1.0, 0.6, '#8a6a48', { kind: KK.PLANK });                      // tezgâh
      for (const sx of [-1, 1]) b.box(sx * (bw / 2 - t - 0.25), 0, -bd / 2 + t + 1.4, 0.45, 1.8, 2.2, '#6b6f73', { kind: KK.METAL });   // raflar (yan duvar)
      b.box(1.6, 0, -bd / 2 + t + 0.35, 1.6, 1.9, 0.65, '#cfd6d8', { kind: KK.METAL });       // buzdolabı
      b.box(-0.8, 0, 1.4, 1.2, 0.3, 0.8, '#5d4a38', { kind: KK.PLANK });                       // devrik raf
    });
    // kanopi: 4 kolon + 0,5 m tavan plağı (kırmızı band), iki pompa adası
    const cx = 4.5, cz = 2.5, CW = 13, CD = 8.5, CH = 4.8;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(cx + sx * (CW / 2 - 1.2), 0, cz + sz * (CD / 2 - 1.0), 0.45, CH, 0.45, '#b8b3a8', { kind: KK.CONC });
    b.box(cx, CH, cz, CW, 0.55, CD, '#e8e4da', { kind: KK.CONC });
    for (const sz of [-1, 1]) b.box(cx, CH + 0.12, cz + sz * (CD / 2 + 0.015), CW, 0.3, 0.03, '#b33a2a', { collide: false });
    for (const sx of [-1, 1]) b.box(cx + sx * (CW / 2 + 0.015), CH + 0.12, cz, 0.03, 0.3, CD, '#b33a2a', { collide: false });
    for (const ix of [-2.6, 2.6]) {
      b.box(cx + ix, 0, cz, 1.2, 0.2, 4.4, '#a9a59c', { kind: KK.CONC });
      for (const pz of [-1.1, 1.1]) { b.box(cx + ix, 0.2, cz + pz, 0.6, 1.55, 0.45, pz < 0 ? '#c43d2e' : '#d9d6cc', { kind: KK.METAL }); b.box(cx + ix, 1.25, cz + pz + 0.235, 0.4, 0.3, 0.02, '#20262a', { collide: false }); }
    }
    // tabela direği (köşe) + varil, lastik
    b.box(W / 2 - 1.2, 0, D / 2 - 1.2, 0.4, 5.2, 0.4, '#8d8a83', { kind: KK.CONC });
    b.box(W / 2 - 1.2, 5.2, D / 2 - 1.2, 2.4, 1.4, 0.4, '#e8e4da', { kind: KK.PLASTER });
    b.box(W / 2 - 1.2, 5.5, D / 2 - 1.2 + 0.215, 1.9, 0.8, 0.03, '#b33a2a', { collide: false });
    for (const [px, pz] of [[-2.6, -1.4], [-2.0, -1.9]]) { b.cyl(px, 0, pz, 0.32, 0.32, 0.92, '#3f6a8a', { seg: 10, collide: false, kind: KK.METAL }); roundCollide(b, px, 0, pz, 0.32, 0.92); }
    for (let i = 0; i < 3; i++) { b.cyl(-1.0, i * 0.26, -2.0, 0.36, 0.36, 0.26, '#1c1c1e', { seg: 10, collide: false }); }
    roundCollide(b, -1.0, 0, -2.0, 0.36, 0.78);
  }));
  { const [dx, dz] = lw(x, z, ry, -7.5 + 0.6, -5.5 + 3.25); addDoor(b, dx, dz, ry, y0, 0, 0, 0, 1); }
  addLoot(b, x, z, ry, y0, [[-9.5, -6.1, 'tezgâh', 1.0], [-10.8, -7.0, 'raf'], [-5.9, -7.0, 'zemin']]);
  return { y0, rect: [x0, x1, z0, z1], canopy: lw(x, z, ry, 4.5, 2.5) };
}

// ── Trafo merkezi (çit, kapı açıklığı, 2 trafo, kumanda kulübesi) ──
export function substation(b, T, o) {
  const { x, z, ry = 0, w = 22, d = 15 } = o;
  const [x0, x1, z0, z1] = worldRect(x, z, w, d, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.max + 0.1;
  b.obj(o.id || 'trafo', () => b.with(x, y0, z, ry, () => {
    plinth(b, fy, y0, w, d, '#8b877d', KK.CONC, 0.4);
    // tel örgü çit: direk + saydam örgü (çarpışmalı ince panel, direkler arasında); +z yüzünde 4 m kapı açıklığı
    const posts = new Map();
    const panel = (ax, a0, a1, c) => { const n = Math.max(1, Math.round((a1 - a0) / 2.5)); for (let i = 0; i < n; i++) { const u0 = a0 + (a1 - a0) * i / n, u1 = a0 + (a1 - a0) * (i + 1) / n, m = (u0 + u1) / 2, L = u1 - u0 - 0.09;
      if (ax === 'x') b.box(m, 0, c, L, 2.2, 0.04, '#9aa0a3', { o: { transparent: true, opacity: 0.38 } }); else b.box(c, 0, m, 0.04, 2.2, L, '#9aa0a3', { o: { transparent: true, opacity: 0.38 } });
      for (const u of [u0, u1]) { const p = ax === 'x' ? [u, c] : [c, u]; posts.set(p.map((v) => v.toFixed(2)).join(','), p); } } };
    const hx = w / 2 - 0.3, hz = d / 2 - 0.3;
    panel('x', -hx, hx, -hz); panel('x', -hx, -2, hz); panel('x', 2, hx, hz); panel('z', -hz, hz, -hx); panel('z', -hz, hz, hx);
    for (const [px, pz] of posts.values()) b.box(px, 0, pz, 0.09, 2.4, 0.09, '#6f777c', { kind: KK.METAL });
    // trafolar: gövde + soğutma kanatları (ince) + izolatörler (2,4 m üstü)
    for (const tx of [-5, 3]) {
      b.box(tx, 0, -2, 2.6, 0.3, 2.2, CONC, { kind: KK.CONC });
      b.box(tx, 0.3, -2, 2.2, 2.0, 1.6, '#6c7a6f', { kind: KK.METAL });
      for (const sz of [-1, 1]) for (let k = 0; k < 5; k++) b.box(tx - 0.8 + k * 0.4, 0.5, -2 + sz * 0.84, 0.06, 1.5, 0.08, '#5e6b61', { collide: false, kind: KK.METAL });
      for (const k of [-0.6, 0, 0.6]) b.cyl(tx + k, 2.3, -2, 0.07, 0.11, 0.7, '#a8572e', { seg: 6, collide: false });
    }
    // kumanda kulübesi
    b.with(-w / 2 + 3.4, 0, d / 2 - 3.2, 0, () => {
      b.withKind(KK.BRICK, () => b.shell(-2.15, 2.15, -1.6, 1.6, 0, 2.9, 0.3, '#9a5a44', { e: [{ at: 0, w: 1.0, b: 0, top: 2.2 }], s: [{ at: 0.6, w: 0.9, b: 1.0, top: 1.9, glass: true }] }, { kind: KK.BRICK }));
      b.box(0, 2.9, 0, 4.9, 0.2, 3.7, '#5d6459', { kind: KK.SHEET });
      b.box(-1.2, 0, -0.9, 1.2, 1.6, 0.6, '#c7c9c4', { kind: KK.METAL });
    });
  }));
  { const [dx, dz] = lw(x, z, ry, -w / 2 + 3.4 + 2.3, d / 2 - 3.2); addDoor(b, dx, dz, ry, y0, 0, 0, 1, 0); }
  return { y0, rect: [x0, x1, z0, z1] };
}

// ── Yel değirmeni (taş kule, kapı +z, ahşap külah, 4 kanat — kanatlar 3 m'nin üstünde, görsel) ──
export function windmill(b, T, o) {
  const { x, z, ry = 0, r = 3.0, h = 10 } = o;
  const fy = footY(T, x - r, x + r, z - r, z + r), y0 = fy.max + 0.15, ST = '#b9b0a0';
  b.obj(o.id || 'yeldeğirmeni', () => b.with(x, y0, z, ry, () => {
    b.cyl(0, fy.min - 0.4 - y0, 0, r + 0.25, r + 0.3, y0 - fy.min + 0.4, STONE, { seg: 12, collide: false, kind: KK.STONE });
    roundCollideN(b, 0, fy.min - 0.4 - y0, 0, (r + 0.25) * Math.cos(Math.PI / 12) * 0.98, y0 - fy.min + 0.4);
    // alt silindir (3 m, düz) + konik gövde; 12 kenarlı, bir yüz +z'ye bakar (kapı yüzü düz). Çarpışma: kademeli, her kademe o aralığın üst yarıçapıyla (içeride)
    const ri = Math.cos(Math.PI / 12), D0 = 3, rt = r * 0.78;
    b.cyl(0, 0, 0, r, r, D0, ST, { seg: 12, ry: Math.PI / 12, collide: false, kind: KK.PLASTER });
    roundCollideN(b, 0, 0, 0, r * ri * 0.98, D0);
    b.cyl(0, D0, 0, rt, r, h - D0, ST, { seg: 12, ry: Math.PI / 12, collide: false, kind: KK.PLASTER });
    for (let k = 0; k < 6; k++) { const ya = D0 + (h - D0) * k / 6, rr = r + (rt - r) * (k + 1) / 6; roundCollideN(b, 0, ya, 0, rr * ri * 0.98, (h - D0) / 6); }
    b.cyl(0, h, 0, 0.25, r * 0.86, 2.4, '#5b4636', { seg: 12, collide: false, kind: KK.PLANK });
    roundCollide(b, 0, h, 0, r * 0.5, 1.2);
    b.box(0, 0, r * ri + 0.01, 1.1, 2.2, 0.03, '#4e3826', { collide: false, kind: KK.PLANK });   // kapalı kapı (duvar yüzünde)
    b.box(0, 2.2, r * ri + 0.01, 1.3, 0.14, 0.03, '#3e2c1e', { collide: false, kind: KK.PLANK });
    const hy = h + 0.9, hz = r * 0.9 + 0.45;
    b.cyl(0, hy, hz - 0.2, 0.32, 0.32, 0.8, '#4e3826', { rx: Q, center: true, seg: 8, collide: false });
    for (let k = 0; k < 4; k++) { const a = k * Q + 0.35; b.box(Math.cos(a) * 3.3, hy + Math.sin(a) * 3.3 - 0.1, hz, 0.22, 0.22, 0.12, '#4e3826', { collide: false });
      b.box(Math.cos(a) * 3.6, hy + Math.sin(a) * 3.6, hz + 0.05, 6.6, 0.16, 0.08, '#5b4636', { collide: false, rz: a });
      b.box(Math.cos(a) * 4.0 + Math.cos(a + Q) * 0.55, hy + Math.sin(a) * 4.0 + Math.sin(a + Q) * 0.55, hz + 0.08, 5.0, 1.0, 0.03, '#d8d0bd', { collide: false, rz: a }); }
  }));
  return [x - r - 0.3, x + r + 0.3, z - r - 0.3, z + r + 0.3];
}

// ── Dolusavak eşiği (baraj mansabı, kuru kanalın başında beton eşik + iki yan duvar; kanal arazide) ──
export function spillwaySill(b, T, x, z, w = 14) {
  const fy = footY(T, x - 2, x + 2, z - w / 2 - 1, z + w / 2 + 1), y0 = fy.max + 0.05;
  b.obj('dolusavak', () => b.with(x, y0, z, 0, () => {
    b.box(0, fy.min - 0.5 - y0, 0, 3.2, y0 - fy.min + 0.5 + 0.25, w, '#9a978e', { kind: KK.CONC });
    for (const sz of [-1, 1]) b.box(0, fy.min - 0.5 - y0, sz * (w / 2 + 0.35), 3.2, y0 - fy.min + 0.5 + 1.2, 0.7, '#a29f96', { kind: KK.CONC });
  }));
  return [x - 1.6, x + 1.6, z - w / 2 - 0.7, z + w / 2 + 0.7];
}
