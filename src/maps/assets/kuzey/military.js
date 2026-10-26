import { KK } from './surface.js';
import { Q, footY, worldRect, roundCollide, shade } from '../common/kuzeyKit.js';

// Kuzey Vadisi askerî parçalar (12.172): helikopter pisti (beton plak + H + kenar lambaları), hangar (açık önlü, sac çatı), koğuş, HESCO istihkâm hattı,
// gözetleme kulesi (merdivenli, platformu katı), radar kulesi (beton gövde, kubbe, anten), araç park çizgileri. Takım rengi yalnız küçük işaretlerde.
const CONC = '#8f8c85', HESCO = '#a8996f', OLIVE = '#59613f';

export function helipad(b, T, o) {
  const { x, z, r = 10, team = null } = o, fy = footY(T, x - r, x + r, z - r, z + r), y0 = fy.max + 0.12;
  const tc = team === 'blue' ? '#3f7fd0' : team === 'red' ? '#cf4436' : '#d9b23a';
  b.obj('heliped:' + (o.id || `${Math.round(x)}:${Math.round(z)}`), () => b.with(x, y0, z, 0, () => {
    b.box(0, fy.min - 0.4 - y0, 0, 2 * r, y0 - fy.min + 0.4, 2 * r, '#7d7b75', { kind: KK.CONC });
    b.cyl(0, 0, 0, r * 0.82, r * 0.82, 0.012, '#e9e6dc', { seg: 28, collide: false });
    b.cyl(0, 0.012, 0, r * 0.74, r * 0.74, 0.012, '#6f6d67', { seg: 28, collide: false });
    const W = '#ecebe4';
    b.box(-r * 0.26, 0.024, 0, r * 0.12, 0.01, r * 0.8, W, { collide: false }); b.box(r * 0.26, 0.024, 0, r * 0.12, 0.01, r * 0.8, W, { collide: false });
    b.box(0, 0.024, 0, r * 0.4, 0.01, r * 0.12, W, { collide: false });
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.cyl(Math.cos(a) * (r - 0.4), 0, Math.sin(a) * (r - 0.4), 0.09, 0.11, 0.16, tc, { seg: 6, collide: false, o: { glow: true, emissive: tc, emissiveIntensity: 0.8 } }); }
  }));
}

export function hangar(b, T, o) {
  const { x, z, w = 26, d = 20, h = 9, ry = 0, wall = '#6f7765' } = o;
  const [x0, x1, z0, z1] = worldRect(x, z, w + 1, d + 1, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.max + 0.15;
  b.obj(o.id || `hangar:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    b.box(0, fy.min - 0.5 - y0, 0, w + 1, y0 - fy.min + 0.5, d + 1, CONC, { kind: KK.CONC });
    b.withKind(KK.CORR, () => b.shell(-w / 2 + 0.15, w / 2 - 0.15, -d / 2 + 0.15, d / 2 - 0.15, 0, h, 0.3, wall, { s: [{ at: 0, w: w - 3, b: 0, top: h - 1.6 }], n: [{ at: w * 0.35, w: 1.2, b: 0, top: 2.3 }], e: [{ at: 0, w: 1.2, b: 0, top: 2.3 }] }, { kind: KK.CORR }));
    const rh = 2.4, a = Math.atan2(rh, w / 2), L = (w / 2 + 0.6) / Math.cos(a);
    b.withKind(KK.CORR, () => b.prism(0, h, 0, w, rh, d, wall));
    for (const sg of [1, -1]) b.box(sg * ((w / 2 + 0.6) / 2 + Math.sin(a) * 0.07), h + (w / 2 - 0.6) * Math.tan(a) / 2 + Math.cos(a) * 0.07 - 0.07, 0, L, 0.14, d + 0.8, '#5d6459', { collide: false, rz: -sg * a, kind: KK.SHEET });
    b.box(0, h - 1.6, d / 2 + 0.15, w - 2.6, 0.3, 0.3, '#3b3f36', { collide: false, kind: KK.METAL });
  }));
}

export function barracks(b, T, o) {
  const { x, z, w = 20, d = 7, ry = 0, wall = '#7c8466' } = o;
  const [x0, x1, z0, z1] = worldRect(x, z, w + 0.6, d + 0.6, ry), fy = footY(T, x0, x1, z0, z1), y0 = fy.max + 0.3;
  b.obj(o.id || `koğuş:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, ry, () => {
    b.box(0, fy.min - 0.5 - y0, 0, w + 0.6, y0 - fy.min + 0.5, d + 0.6, CONC, { kind: KK.CONC });
    const nw = Math.round(w / 3.4), win = Array.from({ length: nw }, (_, i) => ({ at: -w / 2 + (i + 0.5) * w / nw, w: 1.1, b: 1.0, top: 2.1, glass: true }));
    b.withKind(KK.PLANK, () => b.shell(-w / 2 + 0.15, w / 2 - 0.15, -d / 2 + 0.15, d / 2 - 0.15, 0, 3.1, 0.3, wall, { s: win.map((q, i) => (i === Math.floor(win.length / 2) ? { at: q.at, w: 1.2, b: 0, top: 2.3 } : q)), n: win }, { kind: KK.PLANK }));
    b.box(0, 2.9, 0, w - 0.6, 0.2, d - 0.6, '#6b5a46', { kind: KK.PLANK });
    const rh = 1.4, a = Math.atan2(rh, d / 2), L = (d / 2 + 0.4) / Math.cos(a);
    b.withKind(KK.PLANK, () => b.prism(0, 3.1, 0, d, rh, w, wall, { ry: Q }));
    for (const sg of [1, -1]) b.box(0, 3.1 + (d / 2 - 0.4) * Math.tan(a) / 2 + Math.cos(a) * 0.06 - 0.06, sg * ((d / 2 + 0.4) / 2 + Math.sin(a) * 0.06), w + 0.6, 0.12, L, '#4f5649', { collide: false, rx: sg * a, kind: KK.SHEET });
  }));
}

// HESCO hattı (eksen hizalı): 1,1 m küp sepetler, 2,2 m yükseklik (iki sıra) ya da 1,1 m
export function hesco(b, T, x0, z0, x1, z1, rows = 2) {
  const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = ax ? Math.abs(x1 - x0) : Math.abs(z1 - z0), n = Math.max(1, Math.round(len / 1.1));
  b.obj(`hesco:${Math.round(x0)}:${Math.round(z0)}`, () => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = ax ? x0 + (x1 - x0) * t : x0, z = ax ? z0 : z0 + (z1 - z0) * t, y = T.heightAt(x, z) - 0.15;
      b.box(x, y - 0.3, z, ax ? len / n : 1.1, 0.3 + 1.1 * rows, ax ? 1.1 : len / n, i % 2 ? HESCO : shade(HESCO, 0.94), { kind: KK.PLANK });
      b.box(x, y + 1.1 * rows, z, ax ? len / n - 0.02 : 1.12, 0.05, ax ? 1.12 : len / n - 0.02, '#6c6a5e', { collide: false, kind: KK.METAL });
    }
  });
}

export function watchtower(b, T, o) {
  const { x, z, h = 7.5 } = o, y0 = T.heightAt(x, z) - 0.2, P = 3.2;
  b.obj(o.id || `kule:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, 0, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (P / 2 - 0.15), 0, sz * (P / 2 - 0.15), 0.25, h + 2.4, 0.25, '#6a5039', { kind: KK.PLANK });
    b.box(0, h - 0.2, 0, P, 0.2, P, '#6a5039', { kind: KK.PLANK, tag: 'plat' });
    for (const [ax, az, w, d] of [[0, P / 2 - 0.05, P, 0.1], [0, -P / 2 + 0.05, P, 0.1], [P / 2 - 0.05, 0, 0.1, P - 0.2]]) b.box(ax, h, az, w, 1.0, d, '#7a5d43', { kind: KK.PLANK });
    b.box(-P / 2 + 0.05, h, 0.7, 0.1, 1.0, P - 1.6, '#7a5d43', { kind: KK.PLANK });
    b.box(0, h + 2.4, 0, P + 0.6, 0.15, P + 0.6, '#4f5649', { kind: KK.SHEET });
    // merdiven (batı yüzü, dik; açıklıktan platforma)
    const steps = Math.ceil(h / 0.3);
    b.stairs(-P / 2 - 0.3 - steps * 0.26, -0.8 + 0.0, 0, '+x', 0.8, steps, h / steps, 0.26, '#5b4636', { deco: false });
  }));
}

export function radarTower(b, T, o) {
  const { x, z } = o, fy = footY(T, x - 5, x + 5, z - 5, z + 5), y0 = fy.max + 0.1, H = 14;
  b.obj('radar', () => b.with(x, y0, z, 0, () => {
    b.box(0, fy.min - 0.5 - y0, 0, 10, y0 - fy.min + 0.5, 10, CONC, { kind: KK.CONC });
    b.withKind(KK.CONC, () => b.shell(-2.85, 2.85, -2.85, 2.85, 0, H, 0.3, '#a4a39c', { s: [{ at: 0, w: 1.2, b: 0, top: 2.3 }], e: [{ at: 0, w: 0.8, b: 6, top: 7.2, glass: true }], w: [{ at: 0, w: 0.8, b: 9, top: 10.2, glass: true }] }, { kind: KK.CONC }));
    // çatı plağı (iç merdivenin çıkış ağzı açık: x −2,55..−0,3, z 0,1..1,15)
    for (const [a0, a1, c0, c1] of [[-3.6, 3.6, -3.6, 0.1], [-3.6, 3.6, 1.15, 3.6], [-0.3, 3.6, 0.1, 1.15], [-3.6, -2.55, 0.1, 1.15]]) b.box((a0 + a1) / 2, H, (c0 + c1) / 2, a1 - a0, 0.4, c1 - c0, '#8a8981', { kind: KK.CONC });
    for (const [ax, az, w, d] of [[0, 3.5, 7.2, 0.2], [0, -3.5, 7.2, 0.2], [3.5, 0, 0.2, 7.2], [-3.5, 0, 0.2, 7.2]]) b.box(ax, H + 0.4, az, w, 1.0, d, '#8a8981', { kind: KK.CONC });
    const rx = 1.2, rz = -1.2;
    b.cyl(rx, H + 0.4, rz, 1.8, 1.8, 1.4, '#d8d8d2', { seg: 16, collide: false, kind: KK.METAL });
    roundCollide(b, rx, H + 0.4, rz, 1.8, 1.4);
    b.ico(rx, H + 3.3, rz, 2.3, '#eeeeea', { detail: 2 });
    roundCollide(b, rx, H + 1.8, rz, 2.05, 3.7);
    b.cyl(-2.6, H + 1.4, -2.6, 0.08, 0.1, 9, '#5b5f62', { seg: 5, collide: false, kind: KK.METAL });
    b.cyl(-2.6, H + 10.4, -2.6, 0.2, 0.2, 0.3, '#c0392b', { seg: 6, collide: false, o: { glow: true, emissive: '#ff3b2a', emissiveIntensity: 1.2 } });
    // iç merdiven: zemin → 7 m sahanlık (doğu) → çatı ağzı (iki kol, ayrı şeritler)
    b.stairs(-2.4, -1.8, 0, '+x', 0.9, 14, 0.5, 0.3, '#77726a', { deco: false });
    b.box(2.175, 6.8, -0.65, 0.75, 0.2, 3.6, '#77726a', { kind: KK.CONC });
    b.stairs(1.8, 0.6, 7.0, '-x', 0.9, 14, 0.5, 0.3, '#77726a', { deco: false, base: 7.0 });
  }));
}

// araç park yeri işaretleri (zemin çizgileri, görsel)
export function parking(b, T, x, z, n, gap = 8, ry = 0, color = '#d8d2bf') {
  for (let i = 0; i <= n; i++) { const px = x + Math.cos(ry) * (i - n / 2) * gap, pz = z - Math.sin(ry) * (i - n / 2) * gap; b.box(px, T.heightAt(px, pz) + 0.02, pz, 0.14, 0.01, 6, color, { collide: false, ry }); }
}
