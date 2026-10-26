import { T_FLOOR, T_MASS } from './layout.js';
import { CK } from '../common/cgSurface.js';
import { NC, shade } from '../common/cgKit.js';

// Çöl Geçidi v2 süsü (12.171, yalnız görsel; sunucuda kurulmaz): uzak kasaba silueti, çatı eşyası (erişilemez yükseklikte), duvar dibi taş / kuru ot,
// dar sokak üstü kablo / çamaşır ipi (≥ 4,6 m). Oynanış alanında çarpışmasız katı süs yok.
const rng = (seed) => { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
const k = (kind, o = {}) => ({ collide: false, ...o, kind });

export function buildSurround(b) {
  const r = rng(20241005), SAND = ['#dcc08a', '#cfae72', '#e3cc9a', '#c7a46a', '#d7b97f'], pick = (a) => a[Math.floor(r() * a.length)];
  b.box(0, -9, 0, 3200, 6.4, 3200, '#d6be8a', k(CK.SAND));                     // sınır dışı kum düzlemi (tepesi −2,6: haritadaki en alçak zeminin altında)
  const N = 52;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2 + (r() - 0.5) * 0.06, rx = 84 + r() * 22, rz = 92 + r() * 22, x = Math.cos(th) * rx, z = Math.sin(th) * rz, q = r();
    const col = pick(SAND), dk = shade(col, 0.82), ry = Math.round((th + Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2);
    if (q < 0.55) {                                                              // kare ev: pencere sıraları, çatı korkuluğu, su deposu
      const w = 10 + r() * 14, d = 9 + r() * 10, h = 11 + r() * 13;
      b.with(x, 0, z, ry, () => {
        b.box(0, -2.6, 0, w, h + 2.6, d, col, k(CK.PLASTER));
        b.box(0, h, 0, w, 0.6, d, dk, k(CK.PLASTER));
        for (let f = 0; f < Math.floor(h / 4); f++) for (let c = -1; c <= 1; c++) { if (r() < 0.25) continue; b.box(c * w / 3.4, 2.6 + f * 4, d / 2 + 0.03, 1.2, 1.7, 0.06, '#232a31', k(CK.GLASS)); b.box(c * w / 3.4, 2.4 + f * 4, d / 2 + 0.08, 1.6, 0.14, 0.16, '#e6d6b0', k(CK.COPING)); }
        if (r() < 0.4) b.cyl((r() - 0.5) * w * 0.5, h + 0.6, (r() - 0.5) * d * 0.4, 1.0, 1.0, 1.6, '#9db4c4', { seg: 10, collide: false, kind: CK.METAL });
      });
    } else if (q < 0.72) {                                                       // minare
      const h = 26 + r() * 10;
      b.cyl(x, -2.6, z, 1.1, 1.5, h + 2.6, col, { seg: 12, collide: false, kind: CK.PLASTER });
      b.cyl(x, h * 0.72, z, 1.75, 1.75, 0.6, dk, { seg: 12, collide: false, kind: CK.PLASTER });
      b.cyl(x, h, z, 1.5, 1.2, 0.9, dk, { seg: 12, collide: false, kind: CK.PLASTER });
      b.ico(x, h + 1.4, z, 1.3, '#3f7a6e', { detail: 1, scale: [1, 1.8, 1] });
    } else if (q < 0.86) {                                                       // kubbeli yapı
      const w = 12 + r() * 6, h = 9 + r() * 5;
      b.box(x, -2.6, z, w, h + 2.6, w, col, k(CK.PLASTER)); b.box(x, h, z, w + 0.6, 0.6, w + 0.6, dk, k(CK.PLASTER));
      b.ico(x, h + 0.3, z, w * 0.42, '#e9e1cc', { detail: 2, scale: [1, 0.82, 1] });
    } else {                                                                     // hurma kümesi silueti
      for (let p = 0; p < 3; p++) { const px = x + (r() - 0.5) * 6, pz = z + (r() - 0.5) * 6, h = 7 + r() * 3; b.cyl(px, -2.6, pz, 0.25, 0.35, h + 2.6, '#7a5c3c', { seg: 6, collide: false, kind: CK.WOOD }); b.ico(px, h, pz, 2.2, '#5d8f42', { detail: 0, scale: [1.4, 0.45, 1.4] }); }
    }
  }
  for (let i = 0; i < 24; i++) { const th = r() * Math.PI * 2, rx = 125 + r() * 40, rz = 135 + r() * 36, rr = 24 + r() * 22; b.ico(Math.cos(th) * rx, -rr * 0.55, Math.sin(th) * rz, rr, pick(['#dcc08a', '#d2b57b', '#e5cd98']), { detail: 1, scale: [1.5, 0.5, 1.2], ry: r() * 3 }); }
}

// çatı eşyası: büyük çatıların iç kısmında (korkuluk şeridinden ≥ 1 m içeride) havalandırma, baca, klima, su deposu, çanak anten, merdiven kulübesi
export function roofClutter(b, L, rims) {
  const r = rng(7771);
  const tops = new Map();                                                      // kütle no → hücreler
  for (let kk = 0; kk < L.N; kk++) if (L.type[kk] === T_MASS) { let a = tops.get(L.mass[kk]); if (!a) tops.set(L.mass[kk], (a = [])); a.push(kk); }
  const SN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const inner = (kk) => { const i = kk % L.nx, j = (kk / L.nx) | 0; for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) { const m = L.at(i + di, j + dj); if (m < 0 || L.type[m] !== T_MASS || L.top[m] !== L.top[kk]) return false; } return true; };
  let n = 0;
  for (const [id, cells] of tops) {
    if (id >= 900) continue;
    const ok = cells.filter(inner);
    if (ok.length < 30) continue;
    const want = Math.min(4, Math.floor(ok.length / 60) + (r() < 0.5 ? 1 : 0));
    const used = [];
    for (let t = 0, got = 0; t < 40 && got < want; t++) {
      const kk = ok[Math.floor(r() * ok.length)], i = kk % L.nx, j = (kk / L.nx) | 0, x = L.x0 + (i + 0.5) * L.C, z = L.z0 + (j + 0.5) * L.C, top = L.top[kk];
      if (used.some(([ux, uz]) => Math.hypot(ux - x, uz - z) < 2.6)) continue;
      used.push([x, z]); got++;
      const kind = Math.floor(r() * 6), ry = Math.floor(r() * 4) * (Math.PI / 2);
      b.obj('çatı-süs:' + n++, () => b.with(x, top, z, ry, () => {
        if (kind === 0) { b.box(0, 0, 0, 1.0, 0.55, 0.8, '#a39a88', k(CK.METAL)); b.box(0, 0.55, 0, 1.1, 0.08, 0.9, '#8f8676', k(CK.METAL)); for (let q = 0; q < 4; q++) b.box(0, 0.12 + q * 0.1, 0.41, 0.8, 0.045, 0.02, '#4b463d', k(CK.METAL)); }
        else if (kind === 1) { b.box(0, 0, 0, 0.7, 1.5, 0.7, '#bda27a', k(CK.PLASTER)); b.box(0, 1.5, 0, 0.9, 0.14, 0.9, '#a58a64', k(CK.COPING)); b.box(0, 1.64, 0, 0.5, 0.05, 0.5, '#2a2622', k(CK.METAL)); }
        else if (kind === 2) { b.box(0, 0.15, 0, 0.95, 0.65, 0.5, '#c4c7c6', k(CK.METAL)); b.cyl(0, 0.47, 0.26, 0.24, 0.24, 0.02, '#3a3d3f', { seg: 12, collide: false, rx: Math.PI / 2, kind: CK.METAL }); for (const s of [-1, 1]) b.box(s * 0.4, 0, -0.1, 0.08, 0.15, 0.08, '#555', k(CK.METAL)); }
        else if (kind === 3) { b.box(0, 0, 0, 1.0, 0.25, 1.0, '#6e5a3c', k(CK.WOOD)); b.cyl(0, 0.25, 0, 0.42, 0.42, 0.85, '#3d6a8a', { seg: 12, collide: false, kind: CK.METAL }); b.cyl(0, 0.62, 0, 0.44, 0.44, 0.05, '#2a4a62', { seg: 12, collide: false, kind: CK.METAL }); }
        else if (kind === 4) { b.cyl(0, 0, 0, 0.05, 0.05, 1.2, '#8a8f94', { seg: 6, collide: false, kind: CK.METAL }); b.cyl(0.3, 1.45, 0, 0.85, 0.85, 0.08, '#e9e6dc', { seg: 14, collide: false, rz: 0.75, kind: CK.METAL }); }
        else { b.box(0, 0, 0, 1.8, 2.0, 1.7, '#cdb98f', k(CK.PLASTER)); b.box(0, 2.0, 0, 2.0, 0.14, 1.9, '#ad946a', k(CK.COPING)); b.box(0, 0, 0.86, 0.8, 1.6, 0.06, '#7a4a2a', k(CK.PAINT)); }
      }));
    }
  }
  return n;
}

// zemin süsü: duvar dibinde yassı taş / kırık tuğla / kuru ot (≤ 0,06 m yassı ya da ince ot; oyuncu içinden geçer, çim gibi)
export function groundClutter(b, T, L, busy) {
  const r = rng(5521), ROCK = ['#a89a84', '#9a8c78', '#b3a58c', '#8f8470'], GRASS = ['#8d9a55', '#a8a460', '#7d8a4a'];
  let n = 0;
  for (let kk = 0; kk < L.N && n < 240; kk++) {
    if (L.type[kk] !== T_FLOOR) continue;
    const i = kk % L.nx, j = (kk / L.nx) | 0;
    let wall = false; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const m = L.at(i + di, j + dj); if (m >= 0 && L.type[m] !== T_FLOOR) wall = true; }
    if (!wall || r() > 0.09) continue;
    const x = L.x0 + (i + 0.2 + r() * 0.6) * L.C, z = L.z0 + (j + 0.2 + r() * 0.6) * L.C;
    if (busy(x, z) || T.slopeAt(x, z, 0.3) > 0.2) continue;
    const y = T.heightAt(x, z), q = r();
    b.objStack.push('zemin-süs:' + n++);
    if (q < 0.45) for (let p = 0; p < 3; p++) b.box(x + (p - 1) * 0.16 + (r() - 0.5) * 0.06, y, z + (r() - 0.5) * 0.3, 0.1 + r() * 0.04, 0.035 + p * 0.006, 0.08 + r() * 0.06, p % 2 ? '#a65a3c' : ROCK[Math.floor(r() * 4)], k(CK.STONE, { ry: r() * 3 }));
    else for (let p = 0; p < 5; p++) { const a = r() * 6.28; b.box(x + Math.cos(a) * 0.07, y, z + Math.sin(a) * 0.07, 0.02, 0.22 + r() * 0.2, 0.02, GRASS[p % 3], k(CK.LEAF, { rx: (r() - 0.5) * 0.6, rz: (r() - 0.5) * 0.6 })); }
    b.objStack.pop();
  }
  return n;
}

// dar sokak üstü (iki bina arası 3–9 m) kablo / çamaşır ipi: ≥ 4,6 m (zıplayan oyuncunun başı 2,7 m), iki uç da bina yüzünde
export function hangings(b, T, L, roofed) {
  const r = rng(9091), FL = ['#b5402e', '#2d6fa8', '#d9a52b', '#2f7a6e', '#e8dcc0', '#8e3a6a'];
  let n = 0; const placed = [];
  for (let t = 0; t < 900 && n < 18; t++) {
    const x = -62 + r() * 124, z = -66 + r() * 132;
    if (!L.isFloor(x, z) || roofed(x, z) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 14)) continue;
    for (const ax of [0, 1]) {
      let a = 0, c = 0; while (L.isFloor(ax ? x : x - a - 0.25, ax ? z - a - 0.25 : z) && a < 10) a += 0.25; while (L.isFloor(ax ? x : x + c + 0.25, ax ? z + c + 0.25 : z) && c < 10) c += 0.25;
      const w = a + c; if (w < 3 || w > 9) continue;
      const p0 = ax ? [x, z - a] : [x - a, z], p1 = ax ? [x, z + c] : [x + c, z];
      const y = Math.max(T.heightAt(...p0) , T.heightAt(...p1), T.heightAt(x, z)) + 4.8 + r() * 0.5;
      const k0 = L.cellOf(ax ? x : p0[0] - 0.25, ax ? p0[1] - 0.25 : z), k1 = L.cellOf(ax ? x : p1[0] + 0.25, ax ? p1[1] + 0.25 : z);
      if (k0 < 0 || k1 < 0 || L.type[k0] !== T_MASS || L.type[k1] !== T_MASS || L.top[k0] < y + 0.5 || L.top[k1] < y + 0.5) continue;
      placed.push([x, z]); const mid = ax ? [x, (p0[1] + p1[1]) / 2] : [(p0[0] + p1[0]) / 2, z], wire = r() < 0.4;
      b.obj('ip:' + n++, () => b.with(mid[0], y, mid[1], ax ? Math.PI / 2 : 0, () => {
        for (let q = 0; q < 3; q++) b.box(((q - 1) * w) / 3, -0.16 * (q === 1 ? 1 : 0.4), 0, w / 3 + 0.02, 0.035, 0.035, wire ? '#26292d' : '#5b4630', k(CK.METAL, { rz: q === 0 ? -0.1 : q === 2 ? 0.1 : 0 }));
        if (wire) return;
        const m = Math.floor(w / 0.75);
        for (let q = 0; q < m; q++) { const tt = (q + 0.5) / m - 0.5, sag = -0.18 * (1 - (2 * tt) * (2 * tt)) - 0.03; b.box(tt * w, sag - 0.42, 0, 0.32 + r() * 0.2, 0.42 + r() * 0.2, 0.025, FL[(q + Math.floor(r() * 3)) % FL.length], k(CK.CLOTH)); }
      }));
      break;
    }
  }
  return n;
}
