// Askeri üs bina içi dekoru: ranza, dolap, harita masası, telsiz, bilgisayar, silah rafı, sedye, tezgâh vb.
// Her parça yerel çerçevede çizilir: orijin = parçanın DUVARA DAYANAN kenarının ortası (zemin seviyesi), ön yüz +Z.
// Çarpışma: parça başına tek AABB (kapı/merdiven güzergâhları `ctx.rects` ile korunur, parçalar üst üste binmez).

export const IC = {
  lock: '#5f6b78', lockL: '#7b8795', wood: '#a07a4c', woodD: '#5e4429', steel: '#59606a', steelL: '#8a929b',
  olive: '#59623f', oliveL: '#7b8660', canvas: '#8a8f6a', white: '#e4e4de', red: '#c0392b', screen: '#7fe0ff',
  dark: '#22262b', paper: '#d8d3bf', mapC: '#b9c79a', blue: '#3a5f8f', sheet: '#c9d2d8', yellow: '#d9a921', green: '#4f7a45',
};
const GL = { glow: true };

// Gece ışık havuzu malzemesi: siyah gövde + toplamalı karışım → gündüz görünmez, gece (emissive açılınca) parlar
export const poolMat = (emissive = '#ffc66b', opacity = 0.5) => ({ glow: true, emissive, transparent: true, opacity, blending: 2, depthWrite: false, roughness: 1, fog: false });
// Kademeli (merkezi parlak) ışık havuzu: 3 iç içe disk (toplamalı karışım) → alçak poligon "gradyan"
export function poolDisc(b, x, y, z, r, color = '#ffc66b', opacity = 0.4, seg = 14) {
  for (let i = 0; i < 3; i++) b.cyl(x, y + i * 0.003, z, r * [1, 0.68, 0.38][i], r * [1, 0.68, 0.38][i], 0.01, '#000000', { seg, collide: false, o: poolMat(color, opacity * 0.5) });
}
export function poolRect(b, x, y, z, w, d, color = '#ffdf9a', opacity = 0.4) {
  b.box(x, y, z, w, 0.01, d, '#000000', { collide: false, o: poolMat(color, opacity * 0.55) });
  b.box(x, y + 0.003, z, w * 0.62, 0.01, d * 0.62, '#000000', { collide: false, o: poolMat(color, opacity * 0.55) });
}

// ───────── Parçalar ─────────
export const ITEMS = {
  locker: { w: 0.55, d: 0.5, draw(b) {
    b.box(0, 0, 0.25, 0.55, 1.9, 0.5, IC.lock);
    b.box(0, 0.12, 0.505, 0.5, 1.66, 0.02, IC.lockL, { collide: false });
    for (let i = 0; i < 3; i++) b.box(0, 1.5 + i * 0.1, 0.52, 0.3, 0.035, 0.02, IC.dark, { collide: false });
  } },
  bunk: { w: 2.0, d: 0.95, draw(b) {
    for (const sx of [-0.95, 0.95]) for (const sz of [0.06, 0.89]) b.box(sx, 0, sz, 0.07, 1.8, 0.07, IC.steel, { collide: false });
    for (const [y, c] of [[0.38, IC.blue], [1.12, IC.oliveL]]) {
      b.box(0, y, 0.475, 1.95, 0.12, 0.88, '#d6d1c0', { collide: false });
      b.box(0.1, y + 0.12, 0.475, 1.7, 0.07, 0.86, c, { collide: false });
      b.box(-0.8, y + 0.12, 0.475, 0.4, 0.1, 0.55, IC.white, { collide: false });
    }
    b.collide(0, 0, 0.475, 2.0, 1.8, 0.95);
  } },
  cot: { w: 0.85, d: 1.9, draw(b) {
    b.box(0, 0.25, 0.95, 0.8, 0.1, 1.9, IC.canvas);
    b.box(0, 0, 0.1, 0.8, 0.25, 0.06, IC.steel, { collide: false }); b.box(0, 0, 1.8, 0.8, 0.25, 0.06, IC.steel, { collide: false });
    b.box(0, 0.35, 0.35, 0.5, 0.1, 0.4, IC.white, { collide: false });
  } },
  desk: { w: 1.5, d: 0.75, draw(b) {
    b.box(0, 0.72, 0.375, 1.5, 0.06, 0.75, IC.wood, { collide: false });
    b.box(-0.65, 0, 0.375, 0.08, 0.72, 0.65, IC.woodD, { collide: false }); b.box(0.65, 0, 0.375, 0.08, 0.72, 0.65, IC.woodD, { collide: false });
    b.collide(0, 0, 0.375, 1.5, 0.8, 0.75);
    b.box(0.35, 0.78, 0.3, 0.5, 0.34, 0.04, IC.dark, { collide: false }); b.box(0.35, 0.8, 0.325, 0.44, 0.28, 0.02, IC.screen, { collide: false, o: GL });
    b.box(-0.3, 0.78, 0.4, 0.4, 0.02, 0.3, IC.paper, { collide: false });
    b.box(0.0, 0, 1.15, 0.45, 0.45, 0.45, IC.dark, { collide: false }); b.box(0.0, 0.45, 1.3, 0.45, 0.5, 0.06, IC.dark, { collide: false });
  } },
  pcDesk: { w: 2.6, d: 0.8, draw(b) {
    b.box(0, 0.74, 0.4, 2.6, 0.06, 0.8, IC.steelL, { collide: false });
    b.box(-1.2, 0, 0.4, 0.08, 0.74, 0.7, IC.steel, { collide: false }); b.box(1.2, 0, 0.4, 0.08, 0.74, 0.7, IC.steel, { collide: false });
    b.collide(0, 0, 0.4, 2.6, 0.85, 0.8);
    for (const sx of [-0.85, 0, 0.85]) {
      b.box(sx, 0.8, 0.28, 0.6, 0.4, 0.04, IC.dark, { collide: false });
      b.box(sx, 0.82, 0.305, 0.54, 0.34, 0.02, sx === 0 ? '#6fd3ff' : '#8affc0', { collide: false, o: GL });
      b.box(sx, 0.78, 0.55, 0.45, 0.02, 0.15, IC.dark, { collide: false });
    }
    for (const sx of [-0.85, 0.85]) b.box(sx, 0, 1.1, 0.45, 0.45, 0.45, IC.dark, { collide: false });
  } },
  radioDesk: { w: 1.9, d: 0.8, draw(b) {
    b.box(0, 0.74, 0.4, 1.9, 0.06, 0.8, IC.woodD, { collide: false });
    b.box(-0.85, 0, 0.4, 0.08, 0.74, 0.7, IC.woodD, { collide: false }); b.box(0.85, 0, 0.4, 0.08, 0.74, 0.7, IC.woodD, { collide: false });
    b.collide(0, 0, 0.4, 1.9, 0.8, 0.8);
    b.box(-0.45, 0.8, 0.3, 0.7, 0.35, 0.4, IC.olive, { collide: false }); b.box(0.45, 0.8, 0.3, 0.6, 0.28, 0.4, IC.oliveL, { collide: false });
    for (const [sx, c] of [[-0.6, '#ff5a43'], [-0.45, '#7dffa0'], [0.35, '#7dffa0'], [0.5, '#ffd98a']]) b.box(sx, 1.0, 0.505, 0.07, 0.07, 0.02, c, { collide: false, o: GL });
    b.box(0.8, 0.8, 0.15, 0.03, 0.9, 0.03, IC.dark, { collide: false });
    b.box(0, 0, 1.15, 0.45, 0.45, 0.45, IC.dark, { collide: false });
  } },
  rack: { w: 2.0, d: 0.45, draw(b) {
    b.box(0, 0, 0.225, 2.0, 1.55, 0.45, IC.steel);
    b.box(0, 0.5, 0.455, 1.9, 0.9, 0.02, IC.dark, { collide: false });
    for (let i = 0; i < 5; i++) { b.box(-0.8 + i * 0.4, 0.55, 0.47, 0.07, 0.85, 0.05, i % 2 ? '#2a2d30' : '#3a3a34', { collide: false }); b.box(-0.8 + i * 0.4, 1.15, 0.47, 0.05, 0.28, 0.06, IC.wood, { collide: false }); }
  } },
  shelf: { w: 1.2, d: 0.5, draw(b) {
    b.box(0, 0, 0.25, 1.2, 2.0, 0.5, IC.steel);
    for (let i = 0; i < 4; i++) {
      b.box(0, 0.12 + i * 0.5, 0.52, 1.1, 0.04, 0.05, IC.steelL, { collide: false });
      for (let k = 0; k < 3; k++) b.box(-0.38 + k * 0.38, 0.16 + i * 0.5, 0.5, 0.3, 0.26, 0.1, [IC.wood, IC.olive, IC.red, IC.yellow, IC.blue][(i + k) % 5], { collide: false });
    }
  } },
  cabinet: { w: 1.0, d: 0.5, draw(b) {
    b.box(0, 0, 0.25, 1.0, 1.9, 0.5, IC.woodD);
    b.box(-0.24, 0.1, 0.505, 0.45, 1.7, 0.02, IC.wood, { collide: false }); b.box(0.24, 0.1, 0.505, 0.45, 1.7, 0.02, IC.wood, { collide: false });
  } },
  medCab: { w: 1.0, d: 0.45, draw(b) {
    b.box(0, 0, 0.225, 1.0, 1.85, 0.45, IC.white);
    b.box(0, 1.2, 0.46, 0.34, 0.1, 0.02, IC.red, { collide: false }); b.box(0, 1.08, 0.46, 0.1, 0.34, 0.02, IC.red, { collide: false });
    b.box(0, 0.12, 0.46, 0.9, 0.9, 0.02, '#c8cdd2', { collide: false });
  } },
  stretcher: { w: 0.85, d: 2.0, draw(b) {
    b.box(0, 0.45, 1.0, 0.8, 0.14, 1.9, IC.sheet);
    b.box(0, 0.59, 0.4, 0.5, 0.1, 0.4, IC.white, { collide: false });
    b.box(0, 0.59, 1.5, 0.78, 0.05, 0.9, IC.blue, { collide: false });
    for (const sx of [-0.35, 0.35]) for (const sz of [0.2, 1.8]) b.box(sx, 0, sz, 0.06, 0.45, 0.06, IC.steel, { collide: false });
    b.collide(0, 0, 1.0, 0.85, 0.65, 2.0);
  } },
  workbench: { w: 2.4, d: 0.8, draw(b) {
    b.box(0, 0.9, 0.4, 2.4, 0.08, 0.8, IC.wood, { collide: false });
    b.box(0, 0.12, 0.4, 2.3, 0.12, 0.7, IC.steel, { collide: false });
    for (const sx of [-1.1, 1.1]) b.box(sx, 0, 0.4, 0.1, 0.9, 0.7, IC.steel, { collide: false });
    b.collide(0, 0, 0.4, 2.4, 1.0, 0.8);
    b.box(-0.8, 0.98, 0.3, 0.3, 0.2, 0.2, IC.dark, { collide: false });
    b.box(0.2, 0.98, 0.4, 0.5, 0.12, 0.25, IC.red, { collide: false });
    b.box(0, 1.3, 0.04, 2.3, 1.0, 0.05, '#8a7a5a', { collide: false });
    for (let i = 0; i < 6; i++) b.box(-0.95 + i * 0.38, 1.5 + (i % 2) * 0.3, 0.09, 0.1, 0.4, 0.04, [IC.steelL, IC.red, IC.yellow][i % 3], { collide: false });
  } },
  generator: { w: 2.6, d: 1.1, draw(b) {
    b.box(0, 0, 0.55, 2.6, 1.5, 1.1, IC.olive);
    b.box(0, 1.5, 0.55, 2.7, 0.1, 1.2, IC.steel, { collide: false });
    b.box(0.9, 1.6, 0.3, 0.2, 0.9, 0.2, IC.dark, { collide: false });
    b.box(-0.5, 0.7, 1.11, 1.0, 0.5, 0.03, IC.dark, { collide: false });
    for (const [sx, c] of [[-0.8, '#7dffa0'], [-0.6, '#ffd98a'], [-0.4, '#ff5a43']]) b.box(sx, 1.1, 1.11, 0.09, 0.09, 0.03, c, { collide: false, o: GL });
    b.box(0.9, 0.25, 1.11, 0.5, 0.3, 0.03, IC.yellow, { collide: false });
  } },
  panel: { w: 1.1, d: 0.4, draw(b) {
    b.box(0, 0, 0.2, 1.1, 2.0, 0.4, IC.steelL);
    b.box(0, 0.4, 0.41, 0.9, 0.9, 0.02, IC.dark, { collide: false });
    for (let i = 0; i < 6; i++) b.box(-0.34 + (i % 3) * 0.34, 0.6 + Math.floor(i / 3) * 0.4, 0.43, 0.1, 0.1, 0.02, ['#7dffa0', '#ffd98a', '#ff5a43'][i % 3], { collide: false, o: GL });
  } },
  crates: { w: 1.2, d: 1.2, draw(b, rng) {
    b.box(0, 0, 0.6, 1.2, 0.9, 1.2, IC.wood);
    b.box(0.05, 0.9, 0.55, 1.0, 0.8, 1.0, rng && rng() > 0.5 ? IC.olive : IC.wood);
    b.box(0, 0.45, 1.205, 1.0, 0.1, 0.02, IC.woodD, { collide: false });
  } },
  ammo: { w: 1.0, d: 0.6, draw(b) {
    b.box(0, 0, 0.3, 1.0, 0.5, 0.6, IC.olive); b.box(0, 0.5, 0.3, 0.95, 0.5, 0.55, IC.oliveL);
    b.box(0, 0.2, 0.605, 0.5, 0.1, 0.02, IC.yellow, { collide: false });
  } },
  drums: { w: 1.2, d: 1.0, draw(b) {
    for (const [x, z, c] of [[-0.3, 0.3, '#556b2f'], [0.3, 0.3, IC.red], [0, 0.78, '#d9a921']]) b.cyl(x, 0, z, 0.3, 0.3, 0.95, c, { seg: 8, collide: false });
    b.collide(0, 0, 0.55, 1.2, 0.95, 1.0);
  } },
  tires: { w: 1.0, d: 1.0, draw(b) {
    for (let i = 0; i < 4; i++) b.cyl(0, i * 0.28, 0.5, 0.48, 0.48, 0.26, '#26282b', { seg: 10, collide: false });
    b.collide(0, 0, 0.5, 1.0, 1.1, 1.0);
  } },
  couch: { w: 2.0, d: 0.9, draw(b) {
    b.box(0, 0, 0.45, 2.0, 0.45, 0.9, '#7a4b3b'); b.box(0, 0.45, 0.12, 2.0, 0.5, 0.2, '#6a3a2c', { collide: false });
    for (const sx of [-1.0, 1.0]) b.box(sx, 0.45, 0.45, 0.14, 0.25, 0.8, '#6a3a2c', { collide: false });
  } },
  counter: { w: 2.0, d: 0.7, draw(b) {
    b.box(0, 0, 0.35, 2.0, 0.92, 0.7, IC.steelL);
    b.box(0, 0.92, 0.35, 2.05, 0.05, 0.75, IC.white, { collide: false });
    b.cyl(-0.45, 0.97, 0.35, 0.22, 0.22, 0.2, IC.dark, { seg: 8, collide: false });
    b.cyl(0.35, 0.97, 0.3, 0.15, 0.15, 0.16, IC.steel, { seg: 8, collide: false });
  } },
  stove: { w: 1.6, d: 0.75, draw(b) {
    b.box(0, 0, 0.375, 1.6, 0.95, 0.75, IC.dark);
    for (const sx of [-0.45, 0.45]) { b.cyl(sx, 0.95, 0.35, 0.22, 0.22, 0.04, '#666', { seg: 8, collide: false }); b.cyl(sx, 0.99, 0.35, 0.18, 0.18, 0.02, '#ff6a3d', { seg: 8, collide: false, o: GL }); }
    b.box(0, 1.2, 0.04, 1.5, 0.6, 0.05, IC.steel, { collide: false });
  } },
  dining: { w: 2.6, d: 1.8, draw(b) {
    b.box(0, 0, 0.9, 2.6, 0.78, 0.9, IC.wood);
    for (const sz of [0.28, 1.52]) b.box(0, 0, sz, 2.5, 0.42, 0.3, IC.woodD);
  } },
  board: { w: 2.4, d: 0.12, draw(b) {
    b.box(0, 1.05, 0.05, 2.4, 1.3, 0.06, '#e8e6df', { collide: false });
    b.box(0, 1.1, 0.09, 2.3, 1.2, 0.02, IC.mapC, { collide: false });
    for (let i = 0; i < 5; i++) b.box(-0.9 + i * 0.45, 1.3 + (i * 7 % 4) * 0.15, 0.11, 0.1, 0.1, 0.02, [IC.red, IC.blue, IC.yellow][i % 3], { collide: false });
  } },
  screens: { w: 2.6, d: 0.12, draw(b) {
    b.box(0, 1.2, 0.05, 2.6, 1.0, 0.08, IC.dark, { collide: false });
    for (let i = 0; i < 3; i++) b.box(-0.85 + i * 0.85, 1.28, 0.1, 0.78, 0.84, 0.02, ['#6fd3ff', '#8affc0', '#ffd98a'][i], { collide: false, o: GL });
  } },
  cross: { w: 1.2, d: 0.1, draw(b) {
    b.box(0, 1.4, 0.04, 0.9, 0.9, 0.04, IC.white, { collide: false });
    b.box(0, 1.55, 0.07, 0.6, 0.18, 0.02, IC.red, { collide: false }); b.box(0, 1.19, 0.07, 0.18, 0.6, 0.02, IC.red, { collide: false });
  } },
  mapTable: { w: 3.0, d: 1.6, draw(b) {
    for (const sx of [-1.3, 1.3]) for (const sz of [0.15, 1.45]) b.box(sx, 0, sz, 0.12, 0.9, 0.12, IC.woodD, { collide: false });
    b.box(0, 0.88, 0.8, 3.0, 0.08, 1.6, IC.wood, { collide: false });
    b.box(0, 0.96, 0.8, 2.8, 0.02, 1.4, IC.mapC, { collide: false });
    b.box(0.2, 0.97, 0.7, 0.9, 0.02, 0.5, '#a9c4de', { collide: false });
    for (const [x, z, c] of [[-0.8, 0.5, IC.blue], [0.6, 1.0, IC.red], [1.0, 0.4, IC.red], [-0.3, 1.2, IC.blue]]) b.box(x, 0.98, z, 0.12, 0.14, 0.12, c, { collide: false });
    b.collide(0, 0, 0.8, 3.0, 1.0, 1.6);
    b.box(0, 1.5, 0.8, 1.4, 0.04, 0.4, IC.dark, { collide: false });
  } },
  table: { w: 1.8, d: 0.9, draw(b) {
    b.box(0, 0.72, 0.45, 1.8, 0.06, 0.9, IC.wood, { collide: false });
    for (const sx of [-0.8, 0.8]) for (const sz of [0.1, 0.8]) b.box(sx, 0, sz, 0.08, 0.72, 0.08, IC.woodD, { collide: false });
    b.collide(0, 0, 0.45, 1.8, 0.8, 0.9);
    b.box(-0.4, 0.78, 0.4, 0.25, 0.1, 0.2, IC.olive, { collide: false });
  } },
  pillar: { w: 0.7, d: 0.7, draw(b) { b.box(0, 0, 0.35, 0.7, 3.0, 0.7, '#8d9389'); b.box(0, 0, 0.35, 0.8, 0.2, 0.8, '#6f756d', { collide: false }); } },
  bin: { w: 0.5, d: 0.5, draw(b) { b.cyl(0, 0, 0.25, 0.22, 0.2, 0.7, '#3f4a3f', { seg: 8 }); } },
  plant: { w: 0.55, d: 0.55, draw(b) {
    b.cyl(0, 0, 0.275, 0.2, 0.16, 0.4, '#8a5a3a', { seg: 8 });
    b.ico(0, 0.8, 0.275, 0.4, '#4f7a3a', { scale: [1, 1.3, 1], detail: 0, collide: false });
    b.collide(0, 0, 0.275, 0.45, 1.2, 0.45);
  } },
  cooler: { w: 0.45, d: 0.45, draw(b) {
    b.box(0, 0, 0.225, 0.4, 1.0, 0.4, '#d8dde0'); b.cyl(0, 1.0, 0.225, 0.14, 0.14, 0.4, '#8fc8e8', { seg: 8, collide: false, o: { transparent: true, opacity: 0.7 } });
    b.box(0, 0.7, 0.43, 0.1, 0.05, 0.04, '#3a6ac0', { collide: false });
  } },
  files: { w: 0.9, d: 0.6, draw(b) {
    b.box(0, 0, 0.3, 0.9, 0.5, 0.6, '#9a8a64');
    for (let i = 0; i < 3; i++) b.box(-0.3 + i * 0.3, 0.5, 0.3, 0.26, 0.28, 0.5, ['#c9c4aa', '#b8b290', '#d4cfb6'][i], { collide: false });
    b.box(0, 0.78, 0.3, 0.8, 0.04, 0.5, '#e4e0cf', { collide: false });
  } },
  extinguisher: { w: 0.3, d: 0.15, draw(b) {
    b.cyl(0, 0.9, 0.08, 0.09, 0.09, 0.5, '#c0392b', { seg: 8, collide: false }); b.box(0, 1.4, 0.08, 0.08, 0.1, 0.08, '#2a2d30', { collide: false });
  } },
  trunk: { w: 1.1, d: 0.6, draw(b) {   // ayak sandığı
    b.box(0, 0, 0.3, 1.1, 0.42, 0.6, IC.olive); b.box(0, 0.42, 0.3, 1.14, 0.06, 0.64, IC.steel, { collide: false });
  } },
};

// ───────── Yerleştirme ─────────
const hit = (a, r, m = 0.04) => a.x0 < r.x1 + m && a.x1 > r.x0 - m && a.z0 < r.z1 + m && a.z1 > r.z0 - m;

function footprint(px, pz, ry, w, d) {
  const s = Math.round(Math.sin(ry)), c = Math.round(Math.cos(ry));
  const xa = px + (-w / 2) * c + 0 * s, za = pz - (-w / 2) * s + 0 * c;
  const xb = px + (w / 2) * c + d * s, zb = pz - (w / 2) * s + d * c;
  return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb) };
}

export function placeItem(b, ctx, name, px, pz, ry, rng) {
  const it = ITEMS[name];
  const fp = footprint(px, pz, ry, it.w, it.d);
  if (ctx.bounds) {
    const B = ctx.bounds;
    if (fp.x0 < B.x0 - 0.05 || fp.x1 > B.x1 + 0.05 || fp.z0 < B.z0 - 0.05 || fp.z1 > B.z1 + 0.05) return false;
  }
  for (const r of ctx.rects) if (hit(fp, r)) return false;
  ctx.rects.push(fp);
  b.with(px, ctx.y, pz, ry, () => it.draw(b, rng));
  return true;
}

// Duvar boyunca sıralı yerleştirme. side: 'n'|'s'|'w'|'e'. seq: parça adları; cycle: sığdığı kadar döngüyle.
export function wallRun(b, ctx, room, side, seq, rng, { start = 0.1, gap = 0.08, cycle = false } = {}) {
  const horizontal = side === 'n' || side === 's';
  const len = horizontal ? room.x1 - room.x0 : room.z1 - room.z0;
  let pos = start, i = 0, guard = 0;
  while (guard++ < 200) {
    if (!cycle && i >= seq.length) break;
    const nm = seq[i % seq.length];
    const it = ITEMS[nm];
    if (pos + it.w > len - 0.1) break;
    const c = pos + it.w / 2;
    let px, pz, ry;
    if (side === 'n') { px = room.x0 + c; pz = room.z0; ry = 0; }
    else if (side === 's') { px = room.x0 + c; pz = room.z1; ry = Math.PI; }
    else if (side === 'w') { px = room.x0; pz = room.z0 + c; ry = Math.PI / 2; }
    else { px = room.x1; pz = room.z0 + c; ry = -Math.PI / 2; }
    if (placeItem(b, ctx, nm, px, pz, ry, rng)) { pos += it.w + gap; i++; } else pos += 0.3;
  }
}

// Serbest yerleştirme (oda içi). ry: 0, ±π/2, π
export const putAt = (b, ctx, name, x, z, ry, rng) => placeItem(b, ctx, name, x, z + 0, ry, rng);

// ───────── Oda türleri ─────────
// room: {x0,x1,z0,z1} (mutlak, iç net alan). ctx: {y, rects, bounds?}
export const ROOM_KINDS = {
  barracks(b, ctx, R, rng) {
    const W = R.x1 - R.x0, Dd = R.z1 - R.z0;
    const seq = ['locker', 'bunk', 'bunk', 'locker', 'bunk', 'bunk', 'locker', 'bunk', 'bunk'];
    wallRun(b, ctx, R, 'n', seq, rng, { cycle: true });
    if (Dd >= 5.2) wallRun(b, ctx, R, 's', seq, rng, { cycle: true });
    wallRun(b, ctx, R, 'w', ['locker', 'locker', 'trunk'], rng, { start: 1.2 });
    wallRun(b, ctx, R, 'e', ['locker', 'locker'], rng, { start: 1.2 });
    if (Dd >= 7 && W >= 7) { for (let i = 0; i < 2; i++) putAt(b, ctx, 'table', (R.x0 + R.x1) / 2 + (i - 0.5) * 3.2, (R.z0 + R.z1) / 2, 0, rng); }
  },
  ops(b, ctx, R, rng) {
    const W = R.x1 - R.x0, Dd = R.z1 - R.z0;
    wallRun(b, ctx, R, 'n', ['board', 'screens', 'board'], rng, { start: 0.3 });
    if (W >= 5.2 && Dd >= 4.5) putAt(b, ctx, 'mapTable', (R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2 - 0.5, 0, rng);
    wallRun(b, ctx, R, 's', ['radioDesk', 'cabinet', 'radioDesk', 'cabinet'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 'w', ['cabinet', 'panel'], rng, { start: 0.5 });
    wallRun(b, ctx, R, 'e', ['cabinet', 'panel', 'bin'], rng, { start: 0.5 });
  },
  radio(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['radioDesk', 'radioDesk', 'radioDesk', 'radioDesk'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 's', ['radioDesk', 'panel', 'radioDesk'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 'w', ['panel', 'cabinet', 'panel'], rng, { start: 0.6 });
    wallRun(b, ctx, R, 'e', ['panel', 'cabinet'], rng, { start: 0.6 });
    if (R.x1 - R.x0 >= 5 && R.z1 - R.z0 >= 5) putAt(b, ctx, 'table', (R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2, 0, rng);
  },
  computers(b, ctx, R, rng) {
    const W = R.x1 - R.x0, Dd = R.z1 - R.z0;
    wallRun(b, ctx, R, 'n', ['screens', 'pcDesk', 'pcDesk', 'pcDesk'], rng, { cycle: true });
    wallRun(b, ctx, R, 's', ['pcDesk', 'pcDesk', 'pcDesk', 'pcDesk'], rng, { cycle: true });
    if (Dd >= 6.5) for (let i = 0; i < 2; i++) putAt(b, ctx, 'pcDesk', (R.x0 + R.x1) / 2 + (i - 0.5) * 3.0, (R.z0 + R.z1) / 2 - 0.4, 0, rng);
    wallRun(b, ctx, R, 'w', ['cabinet', 'panel'], rng, { start: 0.8 });
    wallRun(b, ctx, R, 'e', ['cabinet', 'panel'], rng, { start: 0.8 });
  },
  armory(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['rack', 'rack', 'rack', 'rack'], rng, { start: 0.2, cycle: true });
    wallRun(b, ctx, R, 's', ['rack', 'shelf', 'rack', 'shelf'], rng, { start: 0.2, cycle: true });
    wallRun(b, ctx, R, 'w', ['shelf', 'ammo', 'ammo', 'shelf'], rng, { start: 0.6, cycle: true });
    wallRun(b, ctx, R, 'e', ['shelf', 'ammo', 'ammo', 'shelf'], rng, { start: 0.6, cycle: true });
    if (R.z1 - R.z0 >= 6.5 && R.x1 - R.x0 >= 6) for (let i = 0; i < 2; i++) putAt(b, ctx, 'crates', (R.x0 + R.x1) / 2 + (i - 0.5) * 2.4, (R.z0 + R.z1) / 2, 0, rng);
  },
  medical(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['cross', 'stretcher', 'stretcher', 'medCab', 'stretcher', 'stretcher'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 's', ['stretcher', 'stretcher', 'medCab', 'stretcher', 'stretcher'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 'w', ['medCab', 'bin'], rng, { start: 2.6 });
    wallRun(b, ctx, R, 'e', ['medCab', 'bin'], rng, { start: 2.6 });
  },
  mess(b, ctx, R) {
    const W = R.x1 - R.x0, Dd = R.z1 - R.z0;
    const cols = Math.max(1, Math.floor((W - 0.6) / 3.1)), rows = Math.max(1, Math.floor((Dd - 0.4) / 2.6));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cx = R.x0 + (W - cols * 3.1) / 2 + 1.55 + c * 3.1;
      const zb = R.z0 + (Dd - rows * 2.6) / 2 + 0.4 + r * 2.6;
      putAt(b, ctx, 'dining', cx, zb, 0, null);
    }
    wallRun(b, ctx, R, 's', ['shelf', 'cabinet', 'bin'], null, { start: 0.3 });
  },
  kitchen(b, ctx, R, rng) {
    const W = R.x1 - R.x0, Dd = R.z1 - R.z0;
    wallRun(b, ctx, R, 'n', ['counter', 'stove', 'counter', 'stove', 'counter', 'cabinet'], rng, { start: 0.2 });
    wallRun(b, ctx, R, 's', ['shelf', 'cabinet', 'counter', 'shelf', 'bin'], rng, { start: 0.2 });
    wallRun(b, ctx, R, 'w', ['shelf', 'shelf'], rng, { start: 0.8 });
    wallRun(b, ctx, R, 'e', ['shelf', 'shelf'], rng, { start: 0.8 });
    if (Dd >= 3.6) putAt(b, ctx, 'counter', (R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2 - 0.35, 0, rng);
  },
  war(b, ctx, R, rng) {
    const W = R.x1 - R.x0, Dd = R.z1 - R.z0;
    wallRun(b, ctx, R, 'n', ['board', 'screens', 'board', 'screens'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 's', ['radioDesk', 'radioDesk', 'cabinet', 'radioDesk'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 'e', ['pcDesk', 'pcDesk', 'pcDesk'], rng, { start: 1.0 });
    wallRun(b, ctx, R, 'w', ['cabinet', 'cabinet'], rng, { start: 1.0 });
    for (let i = 0; i < 2; i++) putAt(b, ctx, 'mapTable', (R.x0 + R.x1) / 2 + (i - 0.5) * 4.2 - 0.6, (R.z0 + R.z1) / 2 - 0.8, 0, rng);
    if (Dd >= 9) for (let i = 0; i < 2; i++) putAt(b, ctx, 'desk', (R.x0 + R.x1) / 2 + (i - 0.5) * 3.4 - 0.6, R.z1 - 3.2, Math.PI, rng);
  },
  office(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['cabinet', 'desk', 'desk', 'cabinet'], rng, { start: 0.3, cycle: true });
    wallRun(b, ctx, R, 's', ['desk', 'cabinet', 'desk'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 'w', ['cabinet', 'panel'], rng, { start: 0.8 });
    wallRun(b, ctx, R, 'e', ['cabinet', 'bin'], rng, { start: 0.8 });
  },
  generator(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['generator', 'generator', 'generator'], rng, { start: 0.3, gap: 0.5 });
    wallRun(b, ctx, R, 's', ['panel', 'drums', 'panel', 'drums'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 'w', ['workbench', 'drums'], rng, { start: 2.5 });
    wallRun(b, ctx, R, 'e', ['panel', 'panel'], rng, { start: 2.5 });
  },
  workshop(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['workbench', 'workbench', 'shelf', 'workbench'], rng, { start: 0.3, cycle: true });
    wallRun(b, ctx, R, 's', ['shelf', 'tires', 'drums', 'shelf'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 'w', ['workbench', 'tires'], rng, { start: 2.0 });
    wallRun(b, ctx, R, 'e', ['panel', 'drums'], rng, { start: 2.0 });
  },
  store(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['shelf', 'shelf', 'shelf', 'shelf'], rng, { start: 0.2, cycle: true, gap: 0.05 });
    wallRun(b, ctx, R, 's', ['shelf', 'crates', 'shelf', 'crates'], rng, { start: 0.2, cycle: true });
    wallRun(b, ctx, R, 'w', ['crates', 'ammo', 'crates'], rng, { start: 0.8, cycle: true });
    wallRun(b, ctx, R, 'e', ['crates', 'ammo', 'crates'], rng, { start: 0.8, cycle: true });
    if (R.z1 - R.z0 >= 7 && R.x1 - R.x0 >= 7) for (let i = 0; i < 2; i++) putAt(b, ctx, 'crates', (R.x0 + R.x1) / 2 + (i - 0.5) * 3.0, (R.z0 + R.z1) / 2, 0, rng);
  },
  lounge(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['couch', 'cabinet', 'couch'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 's', ['couch', 'bin', 'cabinet'], rng, { start: 0.3 });
    if (R.x1 - R.x0 >= 5 && R.z1 - R.z0 >= 5) putAt(b, ctx, 'table', (R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2, 0, rng);
  },
  guard(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'n', ['rack', 'desk', 'cabinet'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 's', ['locker', 'locker', 'cot', 'cot'], rng, { start: 0.3 });
    wallRun(b, ctx, R, 'w', ['locker', 'ammo'], rng, { start: 1.0 });
  },
  hallway(b, ctx, R, rng) {
    wallRun(b, ctx, R, 'w', ['locker', 'locker', 'board', 'cabinet', 'bin', 'locker', 'locker'], rng, { start: 0.5, gap: 0.5 });
    wallRun(b, ctx, R, 'e', ['board', 'bin', 'cabinet', 'board', 'cross', 'bin'], rng, { start: 0.5, gap: 0.6 });
  },
  empty() {},
};

// Odayı doldur: R net iç alan, y zemin seviyesi, extraKeep: korunacak dikdörtgenler (kapı/merdiven şeritleri)
export function fillRoom(b, rng, kind, R, y, keeps = []) {
  const fn = ROOM_KINDS[kind];
  if (!fn) return;
  const ctx = { y, rects: keeps.map((k) => ({ ...k })), bounds: R };
  fn(b, ctx, R, rng);
  // boşlukları küçük eşyalarla doldur (bitki, dosya kolisi, sebil, çöp kovası, ayak sandığı...): kapı/merdiven şeritleri korunur
  if (kind !== 'empty' && kind !== 'hallway') {
    const small = ['plant', 'files', 'bin', 'cooler', 'trunk', 'files', 'plant', 'extinguisher', 'bin'];
    for (const side of ['n', 'e', 's', 'w']) wallRun(b, ctx, R, side, small, rng, { start: 0.15, gap: 0.3, cycle: true });
  }
}
