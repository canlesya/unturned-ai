import { COL } from './kit.js';

// Askeri üs parçaları: hangar, bunker, yakıt tankı, radar, helikopter, helipad.

const CONC = '#8d9389', CONC_D = '#6f756d', STEEL = '#59606a', OLIVE = '#59623f';

// ───────── Hangar (+Z yüzü açık) ─────────
export function hangar(b, rng, { x, z, w = 26, d = 16, openW = 14, color = '#7d857f' }) {
  const H = 8, T = 0.5;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  b.box(x, 0, z, w - 0.5, 0.05, d - 0.5, '#5f6468', { collide: false });
  const sideDoor = { at: z, w: 1.7, b: 0, top: 2.5 };
  b.wall('x', x0, x1, z0, 0, H, T, color, [{ at: x - 6, w: 2.4, b: 5.6, top: 6.6 }, { at: x + 6, w: 2.4, b: 5.6, top: 6.6 }]);
  b.wall('x', x0, x1, z1, 0, H, T, color, [{ at: x, w: openW, b: 0, top: 6.4 }]);
  b.wall('z', z0 + T / 2, z1 - T / 2, x0, 0, H, T, color, [sideDoor]);
  b.wall('z', z0 + T / 2, z1 - T / 2, x1, 0, H, T, color, [sideDoor]);
  // çatı: düz plaka + kemer görünümü
  b.box(x, H - 0.3, z, w, 0.3, d, CONC_D);
  b.prism(x, H, z, d + 1, 1.8, w + 1, '#6c737b', { ry: Math.PI / 2 });
  // kapı üstü şerit + ray
  b.box(x, 6.4, z1 + 0.28, openW + 1, 0.5, 0.08, '#d9a921', { collide: false });
  b.box(x - openW / 2 - 0.5, 0, z1 + 0.4, 1.0, H, 0.5, STEEL, { collide: false });
  b.box(x + openW / 2 + 0.5, 0, z1 + 0.4, 1.0, H, 0.5, STEEL, { collide: false });
  // iç direkler
  for (const px of [x - 8, x + 8]) for (const pz of [z - 4.5]) b.box(px, 0, pz, 0.6, H - 0.3, 0.6, STEEL);
}

// ───────── Helikopter (dekor + gövde çarpışması) ─────────
export function helicopter(b, { x, z, ry = 0, color = '#4a5a3a' }) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0.5, 0, 4.4, 1.9, 1.9, color);                                   // gövde
    b.box(0.2, 1.1, 0, 3.0, 1.0, 1.7, '#9fc3d6', { collide: false, o: { transparent: true, opacity: 0.55 } });
    b.box(-3.6, 1.0, 0, 3.4, 0.45, 0.4, color, { collide: false });          // kuyruk
    b.box(-5.2, 1.0, 0, 0.3, 1.5, 0.15, color, { collide: false });
    b.box(0, 2.4, 0, 0.5, 0.4, 0.5, STEEL, { collide: false });              // rotor göbeği
    b.box(0, 2.78, 0, 9.2, 0.07, 0.35, '#2a2d30', { collide: false });
    b.box(0, 2.78, 0, 0.35, 0.07, 9.2, '#2a2d30', { collide: false });
    for (const sz of [-0.85, 0.85]) b.box(0, 0, sz, 3.4, 0.1, 0.12, STEEL, { collide: false });
  });
}

// ───────── Helipad ─────────
export function helipad(b, { x, z, r = 7 }) {
  b.cyl(x, 0, z, r, r, 0.07, '#4e5358', { seg: 24, collide: false });
  b.cyl(x, 0.07, z, r - 0.7, r - 0.7, 0.02, '#d9a921', { seg: 24, collide: false });
  b.cyl(x, 0.09, z, r - 1.1, r - 1.1, 0.02, '#4e5358', { seg: 24, collide: false });
  b.box(x - 1.4, 0.1, z, 0.5, 0.02, 3.6, '#e8e8e4', { collide: false });
  b.box(x + 1.4, 0.1, z, 0.5, 0.02, 3.6, '#e8e8e4', { collide: false });
  b.box(x, 0.1, z, 2.9, 0.02, 0.5, '#e8e8e4', { collide: false });
}

// ───────── Bunker (ön yüz −Z, kapı arkada) ─────────
export function bunker(b, { x, z, ry = 0, w = 6, d = 4 }) {
  b.with(x, 0, z, ry, () => {
    const H = 2.5, T = 0.6;
    b.wall('x', -w / 2, w / 2, -d / 2, 0, H, T, CONC, [{ at: 0, w: 3.0, b: 1.2, top: 1.7 }]);
    b.wall('x', -w / 2, w / 2, d / 2, 0, H, T, CONC, [{ at: 1.2, w: 1.6, b: 0, top: 2.2 }]);
    b.box(-w / 2 + T / 2, 0, 0, T, H, d - 2 * T, CONC_D);
    b.box(w / 2 - T / 2, 0, 0, T, H, d - 2 * T, CONC_D);
    b.box(0, H, 0, w + 0.6, 0.45, d + 0.6, CONC);                              // çatı
    b.ico(0, H + 0.45, 0, 3.4, '#5c6a3e', { scale: [1.0, 0.22, 0.75], detail: 1 });  // toprak örtü
    b.box(0, 0, 0, w - 2 * T, 0.05, d - 2 * T, '#55595c', { collide: false });
  });
}

// ───────── Yakıt tankı ─────────
export function fuelTank(b, { x, z, r = 3, h = 5, color = '#cfd2cc' }) {
  b.cyl(x, 0, z, r, r, h, color, { seg: 14 });
  b.cyl(x, h, z, r * 0.72, r, 0.6, color, { seg: 14, collide: false });
  b.cyl(x, h + 0.6, z, 0.35, 0.35, 0.4, STEEL, { seg: 8, collide: false });
  b.cyl(x, h * 0.55, z, r + 0.05, r + 0.05, 0.35, '#c0392b', { seg: 14, collide: false });
  b.box(x + r + 0.05, 0, z, 0.1, h, 0.5, STEEL, { collide: false });          // merdiven
  b.box(x, 0, z, r * 2 + 1.2, 0.08, r * 2 + 1.2, '#55595c', { collide: false });
}

// ───────── Radar kulesi (tabanda platform + merdiven, güney kenarda) ─────────
export function radarTower(b, { x, z }) {
  const PH = 3.6;
  b.cyl(x, 0, z, 2.6, 2.9, 11, '#9aa09a', { seg: 12 });
  b.cyl(x, 11, z, 3.3, 3.3, 0.5, STEEL, { seg: 12, collide: false });
  b.box(x, 11.5, z, 0.4, 1.2, 0.4, STEEL, { collide: false });
  // anten tabağı
  b.ico(x, 13.2, z, 3.4, '#d9dcd8', { scale: [1, 0.2, 1], detail: 1, o: undefined });
  b.box(x - 0.15, 12.1, z, 0.3, 1.8, 0.3, STEEL, { collide: false });
  b.box(x + 1.4, 13.5, z, 0.2, 2.2, 0.2, '#c0392b', { collide: false });
  // taban platformu
  b.box(x, PH - 0.3, z, 9, 0.3, 9, CONC);
  for (const [dx, dz, pw, pd] of [[0, -4.35, 9, 0.3], [-4.35, 0, 0.3, 9], [4.35, 0, 0.3, 9], [2.45, 4.35, 4.1, 0.3], [-3.9, 4.35, 0.9, 0.3]]) b.box(x + dx, PH, z + dz, pw, 1.0, pd, CONC_D);
  b.stairs(x - 2.5, z + 4.5 + PH / 0.3 * 0.32, 0, '-z', 1.6, 12, PH / 12, 0.32, '#8b8f88');
  // gövde kabini
  b.box(x + 4.2, 0, z - 1.0, 3, 2.8, 4.4, '#7d8a7a');
  b.box(x + 4.2, 2.8, z - 1.0, 3.2, 0.25, 4.6, STEEL, { collide: false });
}

export { CONC, CONC_D, STEEL, OLIVE };
