import { MapBuilder } from '../../builder.js';
import { T_FLOOR } from './layout.js';
import { CK } from '../common/cgSurface.js';
import { NC, shade } from '../common/cgKit.js';

// Çöl Geçidi v2 yapı parçaları (12.171): ahşap kapılar (Mid / B / Long), Short köprüsü, tünel çatıları, Lower Tunnels ağzı, B penceresi, korkuluk /
// parapet duvarları. Hepsi eksen hizalı kutu; görünen = çarpışma (süs parçaları katı yüze yapışık ≤ 0,12 m). Kapı kanatları açılı (12.181: görsel döndürülmüş
// levha, çarpışma levhanın içinde kalan kutu zinciri) ya da 0° / 90° (B Doors). Tek döndürülmüş kanat AABB'si görünmez çarpışma yapıyordu.
const STONE = '#cdb487', STONE_D = '#b39a6c', WOOD = '#8a6f4f', WOOD_D = '#62513a', IRON = '#3b3530', TIMBER = '#6e5a3c';
const k = (kind, o = {}) => ({ ...o, kind }), n = (kind, o = {}) => ({ collide: false, ...o, kind });

// (x, z)'den ekseni boyunca serbest zemin aralığı (hücre kenarlarında)
export function freeSpan(L, axis, x, z) {
  const C = L.C;
  if (axis === 'x') { const j = L.cj(z); let i0 = L.ci(x), i1 = i0; while (L.type[L.at(i0 - 1, j)] === T_FLOOR) i0--; while (L.type[L.at(i1 + 1, j)] === T_FLOOR) i1++; return [L.x0 + i0 * C, L.x0 + (i1 + 1) * C]; }
  const i = L.ci(x); let j0 = L.cj(z), j1 = j0; while (L.type[L.at(i, j0 - 1)] === T_FLOOR) j0--; while (L.type[L.at(i, j1 + 1)] === T_FLOOR) j1++; return [L.z0 + j0 * C, L.z0 + (j1 + 1) * C];
}

// ── Büyük ahşap kapı: koridoru kesen duvar (kalınlık 1 m), taş dikmeler, lento + üstü duvar, iki kanat (biri kapalı, biri 90° açık) ──
//   g = { name, axis: duvarın uzandığı eksen 'x' | 'z', at: duvar düzlemi (z ya da x, hücre kenarı), c: açıklık ortası, W: açıklık, open: 'L' | 'R' | 'both', swing: ±1 }
export function gate(b, L, T, g) {
  const H = 5.6, P = 0.6, LT = 4.0, TH = 1.0, PD = 1.0, ax = g.axis === 'x';
  const [a0, a1] = freeSpan(L, ax ? 'x' : 'z', ax ? g.c : g.at + 0.25, ax ? g.at + 0.25 : g.c);
  const gy = Math.min(T.heightAt(ax ? g.c : g.at + 0.25, ax ? g.at + 0.25 : g.c), T.heightAt(ax ? g.c - g.W / 2 : g.at + 0.25, ax ? g.at + 0.25 : g.c - g.W / 2));
  const hw = g.W / 2, w0 = g.at, w1 = g.at + TH, mid = (w0 + w1) / 2;
  // dünya kutusu: u (duvar ekseni) [u0,u1], v (dik eksen) [v0,v1], y [y0,y1]
  const B = (u0, u1, v0, v1, y0, y1, col, opt) => (ax ? b.box((u0 + u1) / 2, y0, (v0 + v1) / 2, u1 - u0, y1 - y0, v1 - v0, col, opt) : b.box((v0 + v1) / 2, y0, (u0 + u1) / 2, v1 - v0, y1 - y0, u1 - u0, col, opt));
  const y0 = gy - 0.5, top = gy + H, leaves = [];
  b.obj('kapı:' + g.name, () => {
    const pl = g.c - hw - P, pr = g.c + hw + P;
    if (pl - a0 > 0.01) B(a0, pl, w0, w1, y0, top, '#cfa766', k(CK.PLASTER, { tag: 'wall' }));                 // yan duvarlar (koridor kenarına kadar)
    if (a1 - pr > 0.01) B(pr, a1, w0, w1, y0, top, '#cfa766', k(CK.PLASTER, { tag: 'wall' }));
    // dikme duvardan iki yana 0,2 taşar — o yanda zemin varsa (bina yüzüne girmez)
    const fl = (u, v) => (ax ? L.isFloor(u, v) : L.isFloor(v, u));
    const posts = [[pl, g.c - hw], [g.c + hw, pr]].map(([u0, u1]) => [u0, u1, fl(u0 + 0.05, w0 - 0.1) && fl(u1 - 0.05, w0 - 0.1) ? mid - PD / 2 : w0, fl(u0 + 0.05, w1 + 0.1) && fl(u1 - 0.05, w1 + 0.1) ? mid + PD / 2 : w1]);
    const pv0 = Math.max(...posts.map((p) => p[2])), pv1 = Math.min(...posts.map((p) => p[3]));
    for (const [u0, u1, v0, v1] of posts) {
      B(u0, u1, v0, v1, y0, g.roofed ? top : top + 0.3, STONE, k(CK.STONE, { tag: 'wall' }));
      if (!g.roofed) B(u0, u1, v0, v1, top + 0.3, top + 0.55, '#e2c995', k(CK.COPING, { tag: 'wall' }));   // dikme başlığı
    }
    B(g.c - hw, g.c + hw, Math.max(w0 - 0.1, pv0), Math.min(w1 + 0.1, pv1), gy + LT, gy + LT + 0.55, STONE_D, k(CK.STONE, { tag: 'wall' }));     // lento (taş kiriş)
    B(g.c - hw, g.c + hw, w0, w1, gy + LT + 0.55, top, '#cfa766', k(CK.PLASTER, { tag: 'wall' }));                 // lento üstü duvar
    if (!g.roofed) for (const [u0, u1] of [[a0, pl], [pr, a1]]) if (u1 - u0 > 0.3) B(u0, u1, w0, w1, top, top + 0.2, '#e2c995', k(CK.COPING, { tag: 'wall' }));   // duvar başlığı
    // kanatlar ('wood': mermi geçer). Kapalı kanat: açıklık düzleminin ortasında, menteşe dikmede. Açık kanat (90°): dikmenin iç yüzü boyunca, swing yönünde.
    const LH = LT - 0.05, lt = 0.14, Lw = hw - 0.04;
    const leaf = (side, open) => {
      const hu = side < 0 ? g.c - hw : g.c + hw;                                     // menteşe
      if (!open) {
        const u0 = side < 0 ? hu : hu - Lw, u1 = side < 0 ? hu + Lw : hu;
        B(u0, u1, mid - lt / 2, mid + lt / 2, gy + 0.03, gy + LH, WOOD, k(CK.WOOD, { tag: 'wood' }));
        for (let q = 1; q < 6; q++) { const uu = u0 + (u1 - u0) * q / 6; for (const sv of [-1, 1]) B(uu - 0.02, uu + 0.02, mid + sv * lt / 2, mid + sv * (lt / 2 + 0.02), gy + 0.1, gy + LH - 0.08, WOOD_D, n(CK.WOOD)); }
        for (const yy of [0.5, LH / 2, LH - 0.55]) for (const sv of [-1, 1]) B(u0 + 0.05, u1 - 0.05, mid + sv * lt / 2, mid + sv * (lt / 2 + 0.04), gy + yy, gy + yy + 0.16, WOOD_D, n(CK.WOOD));
        return;
      }
      const uu0 = side < 0 ? hu : hu - lt, uu1 = side < 0 ? hu + lt : hu, sw = g.swing;
      const v0 = sw > 0 ? pv1 : pv0 - Lw, v1 = sw > 0 ? pv1 + Lw : pv0;
      B(uu0, uu1, v0, v1, gy + 0.03, gy + LH, WOOD, k(CK.WOOD, { tag: 'wood' }));
      const fu = side < 0 ? uu1 : uu0, fs = side < 0 ? 1 : -1;                         // koridora bakan yüz
      for (const yy of [0.5, LH / 2, LH - 0.55]) B(Math.min(fu, fu + fs * 0.04), Math.max(fu, fu + fs * 0.04), v0 + 0.05, v1 - 0.05, gy + yy, gy + yy + 0.16, WOOD_D, n(CK.WOOD));
      for (let q = 1; q < 6; q++) { const vv = v0 + (v1 - v0) * q / 6; B(Math.min(fu, fu + fs * 0.02), Math.max(fu, fu + fs * 0.02), vv - 0.02, vv + 0.02, gy + 0.1, gy + LH - 0.08, WOOD_D, n(CK.WOOD)); }
      for (const yy of [0.6, LH - 0.7]) B(Math.min(fu, fu + fs * 0.05), Math.max(fu, fu + fs * 0.05), (sw > 0 ? v0 : v1 - 0.5), (sw > 0 ? v0 + 0.5 : v1), gy + yy, gy + yy + 0.1, IRON, n(CK.METAL));
    };
    // 12.181 açılı kanat (eski haritadaki gibi aralık açık): görsel = döndürülmüş levha; çarpışma = levhanın İÇİNDE kalan eksen hizalı kutu zinciri
    // (merdiven basamağı; dışarı taşan görünmez çarpışma yok, ardışık kutular ana eksende birbirine değer, dik eksende örtüşür → ışın / oyuncu aradan sızmaz)
    const angled = (side, deg) => {
      const a = (deg * Math.PI) / 180, h = lt / 2, ca = Math.cos(a), sa = Math.sin(a), sw = g.swing;
      const hu = g.c + side * (hw - h * sa - 0.005), hv = mid;                         // menteşe: levha köşesi dikme yüzüne değer, girmez
      const du = -side * ca, dv = sw * sa;                                            // menteşeden uca (u, v)
      const W2 = (u, v) => (ax ? [u, v] : [v, u]);
      // görsel levha + süs (yerel x: menteşe → uç, yerel z: kalınlık)
      const [cx, cz] = W2(hu + du * Lw / 2, hv + dv * Lw / 2), [dxw, dzw] = W2(du, dv), ry = Math.atan2(-dzw, dxw);
      leaves.push({ hinge: W2(hu, hv), dir: [dxw, dzw], len: Lw, half: h, y0: gy + 0.03, y1: gy + LH, deg });      // test / araçlar için (scripts/cgdoors.mjs)
      b.with(cx, gy, cz, ry, () => {
        b.box(0, 0.03, 0, Lw, LH - 0.03, lt, WOOD, { collide: false, kind: CK.WOOD });
        for (let q = 1; q < 6; q++) b.box(-Lw / 2 + (Lw * q) / 6, 0.1, 0, 0.04, LH - 0.18, lt + 0.04, WOOD_D, n(CK.WOOD));                   // tahta araları (iki yüz)
        for (const yy of [0.5, LH / 2, LH - 0.55]) b.box(0.03, yy, 0, Lw - 0.16, 0.16, lt + 0.06, WOOD_D, n(CK.WOOD));                       // kuşaklar
        for (const yy of [0.6, LH - 0.7]) b.box(-Lw / 2 + 0.38, yy, 0, 0.5, 0.1, lt + 0.08, IRON, n(CK.METAL));                             // menteşe demiri
      });
      // çarpışma: ana eksen (|du| ≥ |dv| ise u) boyunca adım s; kutunun dik eksen yarı boyu hm. Köşe şartı: |minor|·s/2 + |major|·hm ≤ h, süreklilik: 2hm ≥ s·|minor|/|major|
      const majU = Math.abs(du) >= Math.abs(dv), M = majU ? Math.abs(du) : Math.abs(dv), m = majU ? Math.abs(dv) : Math.abs(du);
      const st = Math.min(0.5, m > 1e-3 ? (0.85 * h) / m : 0.5), hm = (h - (m * st) / 2) / M;
      const e0 = h * m / M + 0.005;                                                    // uçlarda payı (kutu köşesi levha ucundan taşmasın)
      const P = (t) => [hu + du * t, hv + dv * t];                                     // levha ekseni (t: menteşeden uzaklık)
      const sMaj = majU ? Math.sign(du) : Math.sign(dv), len = Lw * M - 2 * e0, nB = Math.max(1, Math.ceil(len / st)), step = len / nB;
      for (let q = 0; q < nB; q++) {
        const k0 = e0 + q * step, k1 = k0 + step, tm = ((k0 + k1) / 2) / M, [pu, pv] = P(tm);
        const a0 = (majU ? hu : hv) + sMaj * k0, a1 = (majU ? hu : hv) + sMaj * k1, lo = Math.min(a0, a1), hi = Math.max(a0, a1);
        const mc = majU ? pv : pu;
        const [bu0, bu1, bv0, bv1] = majU ? [lo, hi, mc - hm, mc + hm] : [mc - hm, mc + hm, lo, hi];
        const [x0, z0] = W2(bu0, bv0), [x1, z1] = W2(bu1, bv1);
        b.collide((x0 + x1) / 2, gy + 0.03, (z0 + z1) / 2, Math.abs(x1 - x0), LH - 0.03, Math.abs(z1 - z0), 'wood');
      }
    };
    if (g.aL != null) { angled(-1, g.aL); angled(1, g.aR); }
    else { leaf(-1, g.open === 'L' || g.open === 'both'); leaf(1, g.open === 'R' || g.open === 'both'); }
  });
  return { a0, a1, w0, w1, gy, top, leaves };
}

// ── Short köprüsü (CT Spawn'ın üstünden geçen tabliye; altında CT ↔ A avlusu geçidi) ──
export function bridge(b, L, T) {
  const X0 = 15, X1 = 23, Z0 = -51, Z1 = -34.5, TOP = 4.6, TH = 0.45, BOT = TOP - TH, wallc = '#cba872';
  b.obj('köprü:tabliye', () => {
    b.box((X0 + X1) / 2, BOT, (Z0 + Z1) / 2, X1 - X0, TH, Z1 - Z0, '#c2a46f', k(CK.COPING, { tag: 'plat' }));
    for (let z = -50.25; z < Z1 - 0.4; z += 1.25) b.box((X0 + X1) / 2, BOT - 0.22, z, X1 - X0 - 1.0, 0.22, 0.2, TIMBER, k(CK.WOOD, { tag: 'roof' }));     // tavan kirişleri (çarpışmalı)
    for (const x of [X0 + 0.25, X1 - 0.25]) b.box(x, BOT - 0.4, (Z0 + Z1) / 2, 0.5, 0.4, Z1 - Z0, '#9c8156', k(CK.WOOD, { tag: 'roof' }));                   // boyuna kiriş (kenarlarda)
  });
  b.obj('köprü:batı-duvar', () => { b.box(X0 + 0.25, TOP, (Z0 + Z1) / 2, 0.5, 3.4, Z1 - Z0, wallc, k(CK.PLASTER, { tag: 'wall' })); b.box(X0 + 0.25, TOP + 3.4, (Z0 + Z1) / 2, 0.5, 0.14, Z1 - Z0, '#d9c08c', k(CK.COPING, { tag: 'wall' })); });
  b.obj('köprü:doğu-korkuluk', () => { const z0 = -47.5; b.box(X1 - 0.25, TOP, (z0 + Z1) / 2, 0.5, 0.95, Z1 - z0, wallc, k(CK.PLASTER, { tag: 'wall' })); b.box(X1 - 0.25, TOP + 0.95, (z0 + Z1) / 2, 0.5, 0.1, Z1 - z0, '#d9c08c', k(CK.COPING, { tag: 'wall' })); });
  for (const [nm, x] of [['batı', X0 + 0.5], ['doğu', X1 - 0.5]]) b.obj('köprü:ayak-' + nm, () => { const gy = T.heightAt(x, -43); b.box(x, gy - 0.3, -43.125, 0.75, BOT - 0.4 - gy + 0.3, 0.75, STONE, k(CK.STONE, { tag: 'wall' })); b.box(x, gy, -43.125, 0.95, 0.25, 0.95, STONE_D, k(CK.COPING, { tag: 'prop' })); });
  // kemer duvarı: köprü altının kuzey yarısını avludan ayırır (x 23…23,5), tabliye kotuna kadar; güneyi geçit (ahşap çerçeve)
  b.obj('köprü:kemer-duvarı', () => b.box(23.25, -0.5, (-47.5 + -43.5) / 2, 0.5, TOP + 0.5, 4, wallc, k(CK.PLASTER, { tag: 'wall' })));
  b.obj('köprü:geçit-çerçevesi', () => {
    const gy = T.heightAt(23.25, -39);
    for (const z of [-43.25, -34.75]) b.box(23.25, gy, z, 0.5, BOT - 0.4 - gy, 0.5, TIMBER, k(CK.WOOD, { tag: 'wall' }));
    b.box(23.25, BOT - 0.4 - 0.45, -39, 0.5, 0.45, 8.0, TIMBER, k(CK.WOOD, { tag: 'roof' }));
  });
  return { X0, X1, Z0, Z1, TOP };
}

// ── Çatılı geçitler: bölgedeki serbest hücreleri kaplayan döşeme (alt yüz tahta kirişli). Döşeme hücre kenarında biter (bina yüzüne değer, girmez). ──
export function roofOver(b, L, T, id, [x0, z0, x1, z1], y, opt = {}) {
  const C = L.C, cells = new Set();
  for (let j = L.cj(z0 + 0.01); j <= L.cj(z1 - 0.01); j++) for (let i = L.ci(x0 + 0.01); i <= L.ci(x1 - 0.01); i++) { const kk = L.at(i, j); if (kk >= 0 && L.type[kk] === T_FLOOR && !(opt.skip && opt.skip(L.x0 + (i + 0.5) * C, L.z0 + (j + 0.5) * C))) cells.add(kk); }
  const rects = [];
  for (const kk of [...cells].sort((p, q) => p - q)) {
    if (!cells.has(kk)) continue;
    const i = kk % L.nx, j = (kk / L.nx) | 0;
    let i2 = i; while (cells.has(j * L.nx + i2 + 1)) i2++;
    let j2 = j; for (;;) { let ok = true; for (let t = i; t <= i2; t++) if (!cells.has((j2 + 1) * L.nx + t)) ok = false; if (!ok) break; j2++; }
    for (let jj = j; jj <= j2; jj++) for (let ii = i; ii <= i2; ii++) cells.delete(jj * L.nx + ii);
    rects.push([L.x0 + i * C, L.z0 + j * C, L.x0 + (i2 + 1) * C, L.z0 + (j2 + 1) * C]);
  }
  const th = opt.th || 0.5;
  b.obj(id, () => {
    for (const [a, c, e, f] of rects) b.box((a + e) / 2, y, (c + f) / 2, e - a, th, f - c, opt.color || '#8a7551', k(CK.ROOF, { tag: 'roof' }));
    // alt yüz: kirişler (çatıya yapışık 0,22 m; ≥ 3 m yukarıda — çarpışmasız süs) + asma fener
    const dirX = opt.dirX ?? true;
    let bi = 0;
    for (const [a, c, e, f] of rects) {
      const span = dirX ? [a, e] : [c, f];
      for (let t = Math.ceil((span[0] + 0.6) / 1.5) * 1.5; t < span[1] - 0.3; t += 1.5, bi++) {
        if (!MapBuilder.noVisual) { if (dirX) b.box(t, y - 0.22, (c + f) / 2, 0.22, 0.22, f - c, TIMBER, n(CK.WOOD)); else b.box((a + e) / 2, y - 0.22, t, e - a, 0.22, 0.22, TIMBER, n(CK.WOOD)); }
        if (bi % 2 === 0) for (const sd of [-1, 1]) {                                // her ikinci kirişin iki ucunda duvara yaslı dikme (çarpışmalı; yalnız ucu bina yüzüyse)
          const px = dirX ? t : (sd < 0 ? a + 0.12 : e - 0.12), pz = dirX ? (sd < 0 ? c + 0.12 : f - 0.12) : t;
          const ox = dirX ? px : (sd < 0 ? a - 0.25 : e + 0.25), oz = dirX ? (sd < 0 ? c - 0.25 : f + 0.25) : pz;
          if (L.isFloor(ox, oz)) continue;
          const g = Math.min(T.heightAt(px - 0.12, pz - 0.12), T.heightAt(px + 0.12, pz + 0.12), T.heightAt(px - 0.12, pz + 0.12), T.heightAt(px + 0.12, pz - 0.12));
          b.box(px, g - 0.1, pz, 0.24, y - 0.22 - g + 0.1, 0.24, '#5e4a30', k(CK.WOOD, { tag: 'wall' }));
        }
        if (!MapBuilder.noVisual && bi % 4 === 1 && (dirX ? f - c : e - a) > 1.4) {
          const lx = dirX ? t : (a + e) / 2, lz = dirX ? (c + f) / 2 : t;
          const drop = Math.max(0.45, Math.min(1.25, y - T.heightAt(lx, lz) - 3.0));            // fener altı zeminden ≥ 2,75 m (zıplayan oyuncunun başı 2,71)
          b.box(lx, y - drop + 0.3, lz, 0.02, drop - 0.52, 0.02, '#2a2c2e', n(CK.METAL));
          b.box(lx, y - drop, lz, 0.22, 0.3, 0.22, '#ffd98a', { collide: false, o: { glow: true } });
          b.box(lx, y - drop + 0.28, lz, 0.28, 0.04, 0.28, '#2a2c2e', n(CK.METAL)); b.box(lx, y - drop - 0.04, lz, 0.26, 0.04, 0.26, '#2a2c2e', n(CK.METAL));
        }
      }
    }
  });
  return rects;
}

const colFloor = (L, x, z0, z1) => { for (let z = z0 + 0.25; z < z1; z += L.C) if (!L.isFloor(x, z)) return false; return true; };
const rowFloor = (L, z, x0, x1) => { for (let x = x0 + 0.25; x < x1; x += L.C) if (!L.isFloor(x, z)) return false; return true; };
// ── Duvar / korkuluk / parapet: [x0, z0, x1, z1] üstü 'top' (mutlak); taban komşu en alçak zeminin 0,3 altı. Üstte kenar taşı. ──
export function parapet(b, T, id, R, top, color = '#c9ab78') {
  const L = T.L;                                                                     // dikdörtgeni yalnız zemin hücrelerine kırp (bina kütlesine girmesin)
  let [x0, z0, x1, z1] = R;
  while (x0 < x1 && !colFloor(L, x0 + 0.25, z0, z1)) x0 += L.C; while (x1 > x0 && !colFloor(L, x1 - 0.25, z0, z1)) x1 -= L.C;
  while (z0 < z1 && !rowFloor(L, z0 + 0.25, x0, x1)) z0 += L.C; while (z1 > z0 && !rowFloor(L, z1 - 0.25, x0, x1)) z1 -= L.C;
  let lo = 1e9;
  for (let x = x0 - 0.25; x <= x1 + 0.25; x += 0.25) for (let z = z0 - 0.25; z <= z1 + 0.25; z += 0.25) lo = Math.min(lo, T.heightAt(x, z));
  b.obj(id, () => {
    b.box((x0 + x1) / 2, lo - 0.3, (z0 + z1) / 2, x1 - x0, top - 0.08 - lo + 0.3, z1 - z0, color, k(CK.STONE, { tag: 'wall' }));
    b.box((x0 + x1) / 2, top - 0.08, (z0 + z1) / 2, x1 - x0, 0.08, z1 - z0, '#dcc596', k(CK.COPING, { tag: 'wall' }));
  });
  return { x0, z0, x1, z1, top, lo, R: [x0, z0, x1, z1] };
}
