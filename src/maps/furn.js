// Mobilya / iç mekân parçaları. Her parça yerel çerçevede çizilir: orijin = taban merkezi (zemin y=0),
// ön yüz = +Z, arka (duvara dayanan) yüz = −Z. `put()` ile dönüşüm uygulanır.
// Çarpışma: yalnızca siper olacak kütleler (yatak, kanepe, tezgâh, dolap...) b.collide ile tek kutu; ince dekor collide:false.

const NC = { collide: false };
const pick = (r, a) => a[Math.floor(r() * a.length)];

export const PAL = {
  woodD: '#5e3c1d', woodM: '#8b5a2b', woodL: '#b58a57', woodPale: '#c9a77a',
  white: '#e8e6df', cream: '#e6dcc3', gray: '#8a8d92', grayD: '#3a3d42', steel: '#9aa1a8',
  fabric: ['#8a4b3b', '#4b6a8a', '#6a7a4a', '#7a5a8a', '#a07a3a', '#5a6a70'],
  blanket: ['#6b7fa0', '#a05a5a', '#5f8a6a', '#8a6aa0', '#c9a25a', '#d0d0c8'],
  rug: ['#a04a3a', '#3a5a7a', '#6a7a4a', '#8a6a3a', '#7a4a6a', '#c0b090'],
  paint: ['#d8b050', '#6a9ac0', '#c06a5a', '#7aa070', '#a07ab0'],
  warm: '#ffd98a',
};

export const ITEMS = {};
function def(name, w, d, draw, extra = {}) { ITEMS[name] = { name, w, d, draw, ...extra }; }

// ───── yatak odası ─────
def('bed', 1.7, 2.1, (b, r) => {
  const bl = pick(r, PAL.blanket);
  b.box(0, 0, 0, 1.7, 0.28, 2.1, PAL.woodD, NC);
  b.box(0, 0.28, 0.05, 1.6, 0.26, 2.0, PAL.white, NC);
  b.box(0, 0.54, 0.4, 1.62, 0.07, 1.3, bl, NC);
  b.box(-0.4, 0.54, -0.8, 0.55, 0.12, 0.35, '#f2efe6', NC);
  b.box(0.4, 0.54, -0.8, 0.55, 0.12, 0.35, '#f2efe6', NC);
  b.box(0, 0, -1.0, 1.74, 1.0, 0.1, PAL.woodM, NC);
  b.collide(0, 0, 0, 1.7, 0.6, 2.1);
});
def('bedSingle', 1.0, 2.0, (b, r) => {
  b.box(0, 0, 0, 1.0, 0.26, 2.0, PAL.woodD, NC);
  b.box(0, 0.26, 0.02, 0.92, 0.24, 1.92, PAL.white, NC);
  b.box(0, 0.5, 0.35, 0.94, 0.06, 1.2, pick(r, PAL.blanket), NC);
  b.box(0, 0.5, -0.78, 0.5, 0.12, 0.32, '#f2efe6', NC);
  b.box(0, 0, -0.96, 1.04, 0.85, 0.08, PAL.woodM, NC);
  b.collide(0, 0, 0, 1.0, 0.55, 2.0);
});
def('wardrobe', 1.3, 0.6, (b, r) => {
  const c = pick(r, [PAL.woodD, PAL.woodM, '#6a5a48']);
  b.box(0, 0, 0, 1.3, 2.0, 0.6, c, NC);
  b.box(0, 0.05, 0.31, 0.02, 1.9, 0.02, '#2a1a0a', NC);
  b.box(-0.12, 1.0, 0.31, 0.05, 0.16, 0.03, PAL.steel, NC);
  b.box(0.12, 1.0, 0.31, 0.05, 0.16, 0.03, PAL.steel, NC);
  b.collide(0, 0, 0, 1.3, 2.0, 0.6);
});
def('dresser', 1.1, 0.5, (b, r) => {
  b.box(0, 0, 0, 1.1, 0.9, 0.5, pick(r, [PAL.woodM, PAL.woodD]), NC);
  for (let i = 0; i < 3; i++) b.box(0, 0.12 + i * 0.27, 0.26, 1.0, 0.2, 0.02, '#4a2c12', NC);
  b.box(0, 0.9, 0.0, 0.3, 0.14, 0.2, pick(r, PAL.paint), NC);
  b.collide(0, 0, 0, 1.1, 0.9, 0.5);
});
def('nightstand', 0.5, 0.45, (b, r) => {
  b.box(0, 0, 0, 0.5, 0.5, 0.45, PAL.woodM, NC);
  b.box(0, 0.5, 0, 0.06, 0.2, 0.06, PAL.grayD, NC);
  b.box(0, 0.68, 0, 0.26, 0.2, 0.26, PAL.warm, { collide: false, o: { glow: true } });
  b.collide(0, 0, 0, 0.5, 0.5, 0.45);
});
def('desk', 1.3, 0.65, (b, r) => {
  b.box(0, 0.72, 0, 1.3, 0.05, 0.65, PAL.woodL, NC);
  b.box(-0.6, 0, 0, 0.06, 0.72, 0.58, PAL.woodD, NC); b.box(0.6, 0, 0, 0.06, 0.72, 0.58, PAL.woodD, NC);
  b.box(0.2, 0.77, -0.1, 0.5, 0.32, 0.04, '#1c2430', NC);
  b.box(0.2, 0.77, -0.07, 0.46, 0.28, 0.01, '#6aa0c8', { collide: false, o: { glow: true } });
  b.box(0.2, 0.77, -0.1, 0.08, 0.12, 0.08, PAL.grayD, NC);
  b.box(-0.35, 0.77, 0.05, 0.3, 0.02, 0.22, '#e8e4d8', NC);
  b.collide(0, 0, 0, 1.3, 0.78, 0.65);
});
def('chair', 0.45, 0.45, (b, r) => {
  b.box(0, 0.42, 0.0, 0.42, 0.05, 0.42, PAL.woodL, NC);
  b.box(0, 0.47, -0.2, 0.42, 0.45, 0.04, PAL.woodL, NC);
  for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) b.box(sx, 0, sz, 0.04, 0.42, 0.04, PAL.woodD, NC);
});

// ───── salon ─────
def('couch', 2.1, 0.95, (b, r) => {
  const c = pick(r, PAL.fabric);
  b.box(0, 0, 0, 2.1, 0.42, 0.95, c, NC);
  b.box(0, 0.42, -0.34, 2.1, 0.45, 0.26, c, NC);
  b.box(-0.96, 0.42, 0.05, 0.18, 0.28, 0.8, c, NC); b.box(0.96, 0.42, 0.05, 0.18, 0.28, 0.8, c, NC);
  b.box(-0.45, 0.42, 0.08, 0.84, 0.1, 0.62, '#e2d6c0', NC);
  b.box(0.45, 0.42, 0.08, 0.84, 0.1, 0.62, '#e2d6c0', NC);
  b.collide(0, 0, 0, 2.1, 0.88, 0.95);
});
def('armchair', 0.95, 0.95, (b, r) => {
  const c = pick(r, PAL.fabric);
  b.box(0, 0, 0, 0.95, 0.42, 0.95, c, NC);
  b.box(0, 0.42, -0.34, 0.95, 0.45, 0.26, c, NC);
  b.box(-0.4, 0.42, 0.05, 0.14, 0.26, 0.8, c, NC); b.box(0.4, 0.42, 0.05, 0.14, 0.26, 0.8, c, NC);
  b.collide(0, 0, 0, 0.95, 0.85, 0.95);
});
def('coffeeTable', 1.1, 0.6, (b, r) => {
  b.box(0, 0.34, 0, 1.1, 0.05, 0.6, PAL.woodL, NC);
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.25, 0.25]) b.box(sx, 0, sz, 0.05, 0.34, 0.05, PAL.woodD, NC);
  b.box(0.1, 0.39, 0, 0.3, 0.04, 0.2, pick(r, PAL.paint), NC);
  b.collide(0, 0, 0, 1.1, 0.4, 0.6);
});
def('tv', 1.3, 0.45, (b, r) => {
  b.box(0, 0, 0, 1.3, 0.5, 0.45, PAL.woodD, NC);
  b.box(0, 0.52, 0, 1.0, 0.6, 0.06, '#15181c', NC);
  b.box(0, 0.56, 0.035, 0.9, 0.5, 0.01, '#2a3f55', { collide: false, o: { glow: true } });
  b.box(0, 0.5, 0, 0.3, 0.04, 0.2, PAL.grayD, NC);
  b.collide(0, 0, 0, 1.3, 0.5, 0.45);
});
def('bookshelf', 1.0, 0.35, (b, r) => {
  b.box(0, 0, 0, 1.0, 1.9, 0.35, PAL.woodM, NC);
  for (let i = 0; i < 4; i++) {
    const y = 0.15 + i * 0.45;
    b.box(0, y, 0.02, 0.9, 0.34, 0.3, '#2a1a0a', NC);
    for (let k = 0; k < 5; k++) b.box(-0.35 + k * 0.17, y, 0.04, 0.1 + r() * 0.05, 0.28 - r() * 0.06, 0.26, pick(r, ['#a04a3a', '#3a5a7a', '#c9a25a', '#6a7a4a', '#7a5a8a', '#d8d4c4']), NC);
  }
  b.collide(0, 0, 0, 1.0, 1.9, 0.35);
});
def('sideboard', 1.5, 0.45, (b, r) => {
  b.box(0, 0, 0, 1.5, 0.85, 0.45, pick(r, [PAL.woodM, '#6a5a48']), NC);
  b.box(-0.37, 0.1, 0.23, 0.7, 0.65, 0.02, '#4a2c12', NC); b.box(0.37, 0.1, 0.23, 0.7, 0.65, 0.02, '#4a2c12', NC);
  b.box(-0.45, 0.85, 0, 0.14, 0.34, 0.14, pick(r, PAL.paint), NC);
  b.box(0.4, 0.85, 0, 0.4, 0.02, 0.28, '#f2efe6', NC);
  b.collide(0, 0, 0, 1.5, 0.85, 0.45);
});
def('plant', 0.55, 0.55, (b, r) => {
  b.cyl(0, 0, 0, 0.2, 0.15, 0.4, '#b0603a', { seg: 7, collide: false });
  b.ico(0, 0.85, 0, 0.38, pick(r, ['#4f8a3a', '#3f7a42', '#5d9a3a']), { detail: 0, scale: [1, 1.2, 1] });
  b.collide(0, 0, 0, 0.42, 0.9, 0.42);
});
def('floorLamp', 0.4, 0.4, (b, r) => {
  b.cyl(0, 0, 0, 0.13, 0.15, 0.04, PAL.grayD, { seg: 6, collide: false });
  b.box(0, 0.04, 0, 0.04, 1.45, 0.04, PAL.grayD, NC);
  b.cyl(0, 1.45, 0, 0.14, 0.2, 0.3, PAL.warm, { seg: 6, collide: false, o: { glow: true } });
});
def('rug', 2.2, 1.5, (b, r) => {
  const c = pick(r, PAL.rug);
  b.box(0, 0, 0, 2.2, 0.025, 1.5, c, NC);
  b.box(0, 0.025, 0, 1.9, 0.005, 1.2, '#e8dcc0', NC);
  b.box(0, 0.03, 0, 1.6, 0.005, 0.9, c, NC);
}, { flat: true });
def('rugRound', 1.8, 1.8, (b, r) => {
  const c = pick(r, PAL.rug);
  b.cyl(0, 0, 0, 0.9, 0.9, 0.025, c, { seg: 12, collide: false });
  b.cyl(0, 0.025, 0, 0.6, 0.6, 0.006, '#e8dcc0', { seg: 12, collide: false });
}, { flat: true });
def('diningTable', 1.5, 0.9, (b, r) => {
  b.box(0, 0.72, 0, 1.5, 0.05, 0.9, PAL.woodL, NC);
  for (const sx of [-0.65, 0.65]) for (const sz of [-0.35, 0.35]) b.box(sx, 0, sz, 0.07, 0.72, 0.07, PAL.woodD, NC);
  b.box(0.0, 0.77, 0, 0.2, 0.18, 0.2, pick(r, PAL.paint), NC);
  b.collide(0, 0, 0, 1.5, 0.78, 0.9);
  // sandalyeler masanın dışında ek ayak izi gerektirmez; çevresine yerleştirilir
  for (const [cx, cz, ry] of [[-0.4, 0.68, Math.PI], [0.4, 0.68, Math.PI], [-0.4, -0.68, 0], [0.4, -0.68, 0]]) {
    b.with(cx, 0, cz, ry, () => ITEMS.chair.draw(b, r));
  }
}, { pad: 0.45 });

// ───── mutfak ─────
def('kitchenRun', 3.0, 0.62, (b, r) => {
  // dizilim (soldan): buzdolabı, tezgâh, ocak, evye, tezgâh
  const len = 3.0;
  const c = pick(r, ['#d8d0bc', '#c8d0c4', '#bfa98a']);
  b.box(-1.125, 0, 0, 0.75, 1.85, 0.7, '#e8eaec', NC);       // buzdolabı
  b.box(-1.125, 1.0, 0.36, 0.7, 0.02, 0.02, PAL.grayD, NC);
  b.box(-0.85, 0.5, 0.37, 0.04, 0.5, 0.04, PAL.steel, NC); b.box(-0.85, 1.2, 0.37, 0.04, 0.4, 0.04, PAL.steel, NC);
  b.box(0.375, 0, 0, 2.25, 0.88, 0.62, c, NC);               // alt dolaplar
  b.box(0.375, 0.88, 0, 2.28, 0.05, 0.66, '#4a4d52', NC);    // tezgâh üstü
  // ocak
  b.box(0.2, 0.93, 0.0, 0.62, 0.02, 0.5, '#15181c', NC);
  for (const [sx, sz] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.12], [0.14, 0.12]]) b.cyl(0.2 + sx, 0.95, sz, 0.08, 0.08, 0.015, '#4a4d52', { seg: 8, collide: false });
  b.box(0.2, 0.3, 0.32, 0.55, 0.45, 0.02, '#2a2d30', NC);   // fırın kapağı
  // evye
  b.box(1.0, 0.93, 0, 0.6, 0.02, 0.4, PAL.steel, NC);
  b.box(1.0, 0.93, -0.22, 0.04, 0.22, 0.04, PAL.steel, NC);
  // üst dolaplar
  b.box(0.375, 1.55, -0.14, 2.25, 0.65, 0.34, c, NC);
  b.box(0.2, 1.3, -0.1, 0.62, 0.22, 0.4, PAL.grayD, NC);   // aspiratör
  b.collide(-1.125, 0, 0, 0.75, 1.85, 0.7);
  b.collide(0.375, 0, 0, 2.25, 0.93, 0.62);
}, { pad: 0.2 });
def('counterShort', 1.2, 0.62, (b, r) => {
  const c = pick(r, ['#d8d0bc', '#c8d0c4', '#bfa98a']);
  b.box(0, 0, 0, 1.2, 0.88, 0.62, c, NC);
  b.box(0, 0.88, 0, 1.24, 0.05, 0.66, '#4a4d52', NC);
  b.box(0, 1.55, -0.14, 1.2, 0.65, 0.34, c, NC);
  b.collide(0, 0, 0, 1.2, 0.93, 0.62);
});
def('island', 1.8, 0.8, (b, r) => {
  b.box(0, 0, 0, 1.8, 0.9, 0.8, pick(r, ['#a08a6a', '#8a5a3a']), NC);
  b.box(0, 0.9, 0, 1.86, 0.05, 0.86, '#d8d4c8', NC);
  b.box(-0.5, 0.95, 0, 0.3, 0.12, 0.3, pick(r, PAL.paint), NC);
  b.collide(0, 0, 0, 1.8, 0.95, 0.8);
});
def('fridge', 0.75, 0.7, (b, r) => {
  b.box(0, 0, 0, 0.75, 1.85, 0.7, '#e8eaec', NC);
  b.box(0, 1.0, 0.36, 0.7, 0.02, 0.02, PAL.grayD, NC);
  b.box(0.27, 0.5, 0.37, 0.04, 0.5, 0.04, PAL.steel, NC); b.box(0.27, 1.2, 0.37, 0.04, 0.4, 0.04, PAL.steel, NC);
  b.collide(0, 0, 0, 0.75, 1.85, 0.7);
});

// ───── banyo ─────
def('bathtub', 1.7, 0.78, (b, r) => {
  b.box(0, 0, 0, 1.7, 0.56, 0.78, '#f0f0ec', NC);
  b.box(0, 0.5, 0, 1.5, 0.08, 0.58, '#9ec8e0', NC);
  b.box(-0.78, 0.6, 0, 0.06, 0.2, 0.06, PAL.steel, NC);
  b.collide(0, 0, 0, 1.7, 0.56, 0.78);
});
def('toilet', 0.42, 0.7, (b, r) => {
  b.box(0, 0, -0.05, 0.38, 0.4, 0.5, '#f0f0ec', NC);
  b.box(0, 0.4, -0.2, 0.38, 0.45, 0.2, '#f0f0ec', NC);
  b.box(0, 0.4, 0.0, 0.36, 0.04, 0.4, '#e0e0da', NC);
  b.collide(0, 0, -0.1, 0.4, 0.8, 0.5);
});
def('basin', 0.65, 0.5, (b, r) => {
  b.box(0, 0, 0, 0.65, 0.85, 0.5, pick(r, ['#d8d0bc', '#c8d0c4']), NC);
  b.box(0, 0.85, 0, 0.62, 0.06, 0.46, '#f0f0ec', NC);
  b.box(0, 0.91, -0.18, 0.04, 0.2, 0.04, PAL.steel, NC);
  b.box(0, 1.25, -0.24, 0.55, 0.65, 0.02, '#b8d4e0', NC);      // ayna
  b.collide(0, 0, 0, 0.65, 0.9, 0.5);
});
def('washer', 0.62, 0.62, (b, r) => {
  b.box(0, 0, 0, 0.62, 0.88, 0.62, '#eceef0', NC);
  b.cyl(0, 0.45, 0.31, 0.2, 0.2, 0.03, '#3a4650', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
  b.collide(0, 0, 0, 0.62, 0.88, 0.62);
});

// ───── depolama / ortak ─────
def('boxStack', 0.9, 0.7, (b, r) => {
  const c = ['#b38b5a', '#a8804f', '#c09a68'];
  b.box(-0.2, 0, 0, 0.55, 0.45, 0.5, pick(r, c), NC);
  b.box(0.25, 0, 0.05, 0.5, 0.38, 0.5, pick(r, c), NC);
  b.box(0.0, 0.45, 0, 0.5, 0.4, 0.45, pick(r, c), NC);
  b.collide(0, 0, 0, 0.9, 0.85, 0.7);
});
def('chest', 0.9, 0.5, (b, r) => {
  b.box(0, 0, 0, 0.9, 0.5, 0.5, PAL.woodD, NC);
  b.box(0, 0.5, 0, 0.9, 0.12, 0.5, PAL.woodM, NC);
  b.box(0, 0.25, 0.26, 0.1, 0.12, 0.03, '#d9a921', NC);
  b.collide(0, 0, 0, 0.9, 0.62, 0.5);
});
def('shelfLow', 1.4, 0.4, (b, r) => {
  b.box(0, 0, 0, 1.4, 1.2, 0.4, PAL.woodL, NC);
  for (let i = 0; i < 3; i++) b.box(0, 0.1 + i * 0.4, 0.03, 1.3, 0.28, 0.36, '#3a2a18', NC);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) b.box(-0.45 + k * 0.45, 0.1 + i * 0.4, 0.06, 0.28, 0.2 + r() * 0.06, 0.28, pick(r, ['#b38b5a', '#a04a3a', '#d8d4c4', '#5a6a7a']), NC);
  b.collide(0, 0, 0, 1.4, 1.2, 0.4);
});
def('stool', 0.4, 0.4, (b, r) => {
  b.cyl(0, 0.4, 0, 0.19, 0.19, 0.05, PAL.woodL, { seg: 8, collide: false });
  b.cyl(0, 0, 0, 0.04, 0.04, 0.4, PAL.woodD, { seg: 5, collide: false });
});
def('piano', 1.5, 0.65, (b, r) => {
  b.box(0, 0, 0, 1.5, 1.2, 0.65, '#2a1a12', NC);
  b.box(0, 0.75, 0.4, 1.3, 0.05, 0.3, '#2a1a12', NC);
  b.box(0, 0.8, 0.45, 1.2, 0.03, 0.2, '#f0eee6', NC);
  b.collide(0, 0, 0, 1.5, 1.2, 0.7);
});
def('classDesk', 1.2, 0.6, (b, r) => {
  b.box(0, 0.72, 0, 1.2, 0.04, 0.6, PAL.woodL, NC);
  b.box(-0.54, 0, 0, 0.05, 0.72, 0.5, PAL.steel, NC); b.box(0.54, 0, 0, 0.05, 0.72, 0.5, PAL.steel, NC);
  b.box(0, 0.42, 0.55, 0.45, 0.04, 0.4, PAL.woodM, NC);
  b.box(0, 0, 0.7, 0.04, 0.42, 0.04, PAL.steel, NC);
  b.collide(0, 0, 0, 1.2, 0.76, 0.6);
});
def('blackboard', 2.6, 0.12, (b, r) => {
  b.box(0, 1.0, 0, 2.6, 1.1, 0.08, '#2c4a3a', NC);
  b.box(0, 0.98, 0.0, 2.7, 0.06, 0.1, PAL.woodD, NC);
}, { wall: true });

// duvar dekorları (çarpışmasız, yüksekte)
def('painting', 0.9, 0.06, (b, r) => {
  b.box(0, 1.35, 0, 0.9, 0.62, 0.05, PAL.woodD, NC);
  b.box(0, 1.4, 0.03, 0.78, 0.52, 0.01, pick(r, ['#8aa8c8', '#c0a070', '#9ab088', '#c07a6a']), NC);
  b.box(-0.1, 1.5, 0.04, 0.3, 0.2, 0.01, pick(r, ['#e8dca0', '#d8d4c4', '#4a6a8a']), NC);
}, { wall: true });
def('wallClock', 0.4, 0.06, (b) => {
  b.cyl(0, 2.0, 0, 0.18, 0.18, 0.05, '#f0eee6', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
}, { wall: true });
def('ceilLamp', 0.4, 0.4, (b, r, y = 2.9) => {
  b.box(0, y - 0.18, 0, 0.03, 0.18, 0.03, PAL.grayD, NC);
  b.box(0, y - 0.3, 0, 0.42, 0.14, 0.42, PAL.warm, { collide: false, o: { glow: true } });
}, { ceil: true });

// ───── ticari / sanayi ─────
def('shopShelf', 1.6, 0.5, (b, r) => {
  b.box(0, 0, 0, 1.6, 1.7, 0.5, '#7a8590', NC);
  for (let i = 0; i < 4; i++) {
    const y = 0.12 + i * 0.4;
    b.box(0, y, 0, 1.52, 0.04, 0.46, '#c9cfd4', NC);
    for (let k = 0; k < 6; k++) b.box(-0.65 + k * 0.26, y + 0.04, 0, 0.18, 0.2 + r() * 0.1, 0.34, pick(r, ['#c0392b', '#d9a921', '#3b6a9a', '#4a7a4f', '#e8e8e4', '#a05a2a']), NC);
  }
  b.collide(0, 0, 0, 1.6, 1.7, 0.5);
});
def('shopCounter', 2.2, 0.8, (b, r) => {
  b.box(0, 0, 0, 2.2, 1.0, 0.8, PAL.woodM, NC);
  b.box(0, 1.0, 0, 2.28, 0.06, 0.88, '#d8d4c8', NC);
  b.box(0.6, 1.06, 0, 0.4, 0.22, 0.3, PAL.grayD, NC);       // kasa
  b.box(0.6, 1.2, 0.05, 0.3, 0.1, 0.01, '#6aa0c8', { collide: false, o: { glow: true } });
  b.box(-0.6, 1.06, 0.05, 0.3, 0.12, 0.3, '#c0392b', NC);
  b.collide(0, 0, 0, 2.2, 1.06, 0.8);
});
def('cooler', 1.2, 0.7, (b, r) => {
  b.box(0, 0, 0, 1.2, 1.9, 0.7, '#cfd6dc', NC);
  b.box(0, 0.25, 0.36, 1.05, 1.5, 0.02, '#b8e0f0', { collide: false, o: { glow: true } });
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) b.box(-0.4 + k * 0.27, 0.35 + i * 0.36, 0.37, 0.18, 0.24, 0.01, pick(r, ['#c0392b', '#3b6a9a', '#d9a921', '#4a7a4f']), NC);
  b.collide(0, 0, 0, 1.2, 1.9, 0.7);
});
def('rack', 2.6, 1.0, (b, r) => {
  // depo çelik raf: dikmeler + 3 kat + kolilar
  for (const sx of [-1.25, 0, 1.25]) for (const sz of [-0.45, 0.45]) b.box(sx, 0, sz, 0.08, 2.9, 0.08, '#2f5f8f', NC);
  for (let i = 0; i < 3; i++) {
    const y = 0.15 + i * 0.95;
    b.box(0, y, 0, 2.6, 0.08, 1.0, '#d98a21', NC);
    for (let k = 0; k < 4; k++) if (r() > 0.2) b.box(-0.95 + k * 0.65, y + 0.08, (r() - 0.5) * 0.2, 0.5 + r() * 0.1, 0.45 + r() * 0.3, 0.6, pick(r, ['#b38b5a', '#a8804f', '#c09a68', '#8a6a3a']), NC);
  }
  b.collide(0, 0, 0, 2.6, 2.9, 1.0);
});
def('pallet', 1.2, 1.0, (b, r) => {
  b.box(0, 0, 0, 1.2, 0.14, 1.0, '#a8804f', NC);
  const n = 1 + Math.floor(r() * 3);
  b.box(0, 0.14, 0, 1.1, 0.45 * n, 0.9, pick(r, ['#b38b5a', '#c8c4b8', '#8a6a3a']), NC);
  b.collide(0, 0, 0, 1.2, 0.14 + 0.45 * n, 1.0);
});
def('forklift', 1.2, 2.4, (b, r) => {
  const c = pick(r, ['#d9a921', '#c0392b']);
  b.box(0, 0.25, -0.35, 1.1, 0.7, 1.4, c, NC);
  b.box(0, 0.95, -0.55, 1.0, 0.1, 0.9, PAL.grayD, NC);
  for (const sx of [-0.45, 0.45]) b.box(sx, 0.95, -0.55, 0.06, 1.0, 0.06, PAL.grayD, NC);
  b.box(0, 0.35, 0.95, 0.22, 0.06, 1.0, PAL.steel, NC); b.box(-0.35, 0.35, 0.95, 0.12, 0.06, 1.0, PAL.steel, NC); b.box(0.35, 0.35, 0.95, 0.12, 0.06, 1.0, PAL.steel, NC);
  b.box(0, 0.25, 0.4, 0.9, 1.5, 0.06, PAL.grayD, NC);
  for (const sx of [-0.6, 0.6]) for (const sz of [-0.8, 0.3]) b.cyl(sx, 0.28, sz, 0.28, 0.28, 0.2, '#1c1c1e', { rx: 0, rz: Math.PI / 2, center: true, seg: 8, collide: false });
  b.collide(0, 0, -0.1, 1.2, 1.3, 1.9);
  b.collide(0, 0, 0.95, 0.9, 0.5, 1.0);
});
def('workbench', 1.8, 0.7, (b, r) => {
  b.box(0, 0.86, 0, 1.8, 0.08, 0.7, PAL.woodL, NC);
  for (const sx of [-0.85, 0.85]) b.box(sx, 0, 0, 0.08, 0.86, 0.6, PAL.grayD, NC);
  b.box(0, 0.94, -0.1, 0.5, 0.16, 0.3, '#c0392b', NC);
  b.box(0.5, 0.94, 0.05, 0.3, 0.1, 0.2, PAL.steel, NC);
  b.box(0, 1.3, -0.33, 1.7, 0.7, 0.04, '#b8a07a', NC);      // pano
  b.collide(0, 0, 0, 1.8, 0.94, 0.7);
});
def('toolChest', 0.8, 0.5, (b, r) => {
  b.box(0, 0, 0, 0.8, 1.1, 0.5, '#c0392b', NC);
  for (let i = 0; i < 4; i++) b.box(0, 0.12 + i * 0.25, 0.26, 0.7, 0.04, 0.02, PAL.grayD, NC);
  b.collide(0, 0, 0, 0.8, 1.1, 0.5);
});
def('tireStack', 0.8, 0.8, (b, r) => {
  for (let i = 0; i < 3; i++) b.cyl(0, i * 0.24, 0, 0.36, 0.36, 0.22, '#1c1c1e', { seg: 10, collide: false });
  b.collide(0, 0, 0, 0.74, 0.7, 0.74);
});
def('pew', 2.6, 0.75, (b, r) => {
  b.box(0, 0, 0, 2.6, 0.45, 0.7, PAL.woodD, NC);
  b.box(0, 0.45, -0.3, 2.6, 0.5, 0.08, PAL.woodD, NC);
  b.box(-1.25, 0.45, -0.1, 0.1, 0.55, 0.5, PAL.woodM, NC); b.box(1.25, 0.45, -0.1, 0.1, 0.55, 0.5, PAL.woodM, NC);
  b.collide(0, 0, 0, 2.6, 0.95, 0.7);
});
def('altar', 3.2, 1.0, (b, r) => {
  b.box(0, 0, 0, 3.8, 0.25, 1.9, '#7a6a55', NC);
  b.box(0, 0.25, 0.0, 3.0, 0.95, 0.9, PAL.woodL, NC);
  b.box(0, 1.2, 0.0, 3.2, 0.08, 1.0, '#e8e4d8', NC);
  for (const sx of [-1.2, 1.2]) {
    b.box(sx, 1.28, 0, 0.08, 0.5, 0.08, '#c9b26a', NC);
    b.box(sx, 1.78, 0, 0.14, 0.18, 0.14, PAL.warm, { collide: false, o: { glow: true } });
  }
  b.box(0, 1.28, 0, 0.1, 0.9, 0.1, '#c9b26a', NC); b.box(0, 1.9, 0, 0.5, 0.1, 0.1, '#c9b26a', NC);
  b.collide(0, 0, 0, 3.0, 1.2, 0.9);
});
def('pulpit', 0.8, 0.8, (b, r) => {
  b.box(0, 0, 0, 0.8, 1.1, 0.8, PAL.woodD, NC);
  b.box(0, 1.1, 0, 0.9, 0.08, 0.5, PAL.woodM, NC);
  b.collide(0, 0, 0, 0.8, 1.2, 0.8);
});
def('candles', 0.4, 0.4, (b, r) => {
  b.box(0, 0, 0, 0.06, 1.3, 0.06, '#c9b26a', NC);
  b.box(-0.18, 1.3, 0, 0.36, 0.04, 0.04, '#c9b26a', NC);
  for (const sx of [-0.18, 0, 0.18]) b.box(sx, 1.34, 0, 0.07, 0.2, 0.07, PAL.warm, { collide: false, o: { glow: true } });
});


def('bunk', 1.0, 2.0, (b, r) => {
  const bl = pick(r, PAL.blanket);
  for (const y of [0.0, 1.0]) {
    b.box(0, y + 0.3, 0, 0.96, 0.1, 1.96, '#5a6040', NC);
    b.box(0, y + 0.4, 0.05, 0.9, 0.12, 1.85, '#cfd2c4', NC);
    b.box(0, y + 0.52, 0.35, 0.92, 0.05, 1.2, bl, NC);
  }
  for (const sx of [-0.48, 0.48]) for (const sz of [-0.97, 0.97]) b.box(sx, 0, sz, 0.05, 1.9, 0.05, PAL.grayD, NC);
  b.collide(0, 0, 0, 1.0, 1.9, 2.0);
});
def('locker', 0.55, 0.5, (b, r) => {
  b.box(0, 0, 0, 0.55, 1.9, 0.5, pick(r, ['#5a6a70', '#6a7a60', '#7a7a78']), NC);
  b.box(0, 0.1, 0.26, 0.02, 1.7, 0.02, PAL.grayD, NC);
  b.box(0.15, 1.2, 0.27, 0.05, 0.12, 0.03, PAL.steel, NC);
  b.collide(0, 0, 0, 0.55, 1.9, 0.5);
});
def('filing', 0.5, 0.6, (b, r) => {
  b.box(0, 0, 0, 0.5, 1.3, 0.6, '#8a929a', NC);
  for (let i = 0; i < 3; i++) b.box(0, 0.1 + i * 0.4, 0.31, 0.42, 0.3, 0.02, '#6a7278', NC);
  b.collide(0, 0, 0, 0.5, 1.3, 0.6);
});
def('map', 1.2, 0.06, (b) => {
  b.box(0, 1.2, 0, 1.2, 0.8, 0.04, '#d8cfa8', NC);
  b.box(0.1, 1.3, 0.03, 0.5, 0.3, 0.01, '#6a8a5a', NC);
  b.box(-0.2, 1.5, 0.03, 0.3, 0.2, 0.01, '#6a8aa8', NC);
}, { wall: true });

// ───── API ─────
// `put`: ürünü (x,z) konumuna, ry (π/2 katları) dönüşüyle, y zemin yüksekliğinde çizer.
export function put(b, rng, name, x, y, z, ry = 0, ceilY) {
  const it = ITEMS[name];
  if (!it) throw new Error('mobilya yok: ' + name);
  b.with(x, y, z, ry, () => {
    it.draw(b, rng, ceilY);
  });
}
export function footprint(name, ry) {
  const it = ITEMS[name];
  const q = Math.abs(Math.round(ry / (Math.PI / 2))) % 2;
  return q ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
}

export const TALL = new Set(['wardrobe', 'bookshelf', 'fridge', 'kitchenRun', 'shopShelf', 'cooler', 'rack', 'forklift', 'locker', 'filing', 'bunk', 'altar', 'candles', 'piano', 'toolChest', 'washer']);
