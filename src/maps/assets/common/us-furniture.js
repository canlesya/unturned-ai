import { UK } from './us-surface.js';
import { PAL, LAMP_COOL } from './us-kit.js';

// Askeri Üs v3 — iç mekân eşyası. Her eşya yerel çerçevede: arkası yerel −z (duvar), önü +z (oda); genişlik w yerel x boyunca, derinlik d.
// Katı parçalar birebir kutu (masa: tabla + yan ayaklar; ranza: dikmeler + platform + şilte), aralarında boşluk mermiye / göze açık. Süs: ekran, klavye, harita.
// ITEMS[ad] = { w, d, h, f(K) }  (h: en yüksek nokta; pencere önüne yalnız h ≤ 0,95 olanlar konur)
const S = (K, ...a) => K.s(...a), D = (K, ...a) => K.d(...a);
const metal = PAL.steelL, dark = '#3a3f45', woodT = '#8a6a44';
export const ITEMS = {
  desk: { w: 1.4, d: 1.25, h: 1.05, f: (K) => {
    S(K, -0.66, 0, -0.27, 0.06, 0.72, 0.62, metal, UK.STEEL); S(K, 0.66, 0, -0.27, 0.06, 0.72, 0.62, metal, UK.STEEL);
    S(K, 0, 0.72, -0.27, 1.4, 0.04, 0.66, woodT, UK.WOOD);
    D(K, 0.1, 0.76, -0.45, 0.5, 0.3, 0.04, '#1d2329', UK.GLASS); D(K, 0.1, 0.76, -0.41, 0.08, 0.04, 0.04, dark, UK.STEEL); D(K, 0.1, 0.76, -0.25, 0.42, 0.03, 0.14, dark, UK.STEEL);
    S(K, 0.1, 0, 0.32, 0.06, 0.44, 0.06, dark, UK.STEEL); S(K, 0.1, 0.44, 0.32, 0.46, 0.06, 0.46, '#2f3a33', UK.CANVAS); S(K, 0.1, 0.5, 0.52, 0.46, 0.5, 0.06, '#2f3a33', UK.CANVAS);
  } },
  lockers: { w: 1.5, d: 0.5, h: 1.9, f: (K) => { for (let i = 0; i < 3; i++) { S(K, -0.5 + i * 0.5, 0, 0, 0.5, 1.9, 0.5, ['#6b7a5e', '#62705a', '#6f7d63'][i], UK.STEEL); D(K, -0.5 + i * 0.5 + 0.14, 1.0, 0.265, 0.04, 0.14, 0.03, '#2a2d30', UK.STEEL); } } },
  bunk: { w: 2.0, d: 0.92, h: 1.85, f: (K) => {
    for (const sx of [-0.97, 0.97]) for (const sz of [-0.43, 0.43]) S(K, sx, 0, sz, 0.06, 1.85, 0.06, '#4f5a48', UK.STEEL);
    for (const y of [0.32, 1.32]) { S(K, 0, y, 0, 1.88, 0.1, 0.92, '#4f5a48', UK.STEEL); S(K, 0, y + 0.1, 0, 1.84, 0.12, 0.86, '#6b7a5e', UK.CANVAS); S(K, -0.72, y + 0.22, 0, 0.36, 0.08, 0.6, '#d8d6cc', UK.CANVAS); }
  } },
  shelf: { w: 1.2, d: 0.45, h: 2.0, f: (K) => {
    for (const sx of [-0.58, 0.58]) S(K, sx, 0, 0, 0.04, 2.0, 0.45, metal, UK.STEEL);
    for (const y of [0.08, 0.7, 1.32, 1.94]) S(K, 0, y, 0, 1.12, 0.04, 0.45, metal, UK.STEEL);
    const c = ['#8a6a2d', '#556b2f', '#6b6f78', '#a08860'];
    for (const [i, y] of [[0, 0.12], [1, 0.74], [2, 1.36]]) { S(K, -0.3, y, 0, 0.4, 0.34, 0.36, c[i], UK.WOOD); S(K, 0.22, y, 0, 0.44, 0.26, 0.34, c[i + 1], UK.STEEL); }
  } },
  cabinet: { w: 0.55, d: 0.62, h: 1.32, f: (K) => { S(K, 0, 0, 0, 0.55, 1.32, 0.62, '#7d8580', UK.STEEL); for (const y of [0.25, 0.65, 1.05]) D(K, 0, y, 0.325, 0.2, 0.04, 0.03, dark, UK.STEEL); } },
  console: { w: 1.6, d: 1.3, h: 1.6, f: (K) => {
    S(K, 0, 0, -0.2, 1.6, 0.76, 0.6, '#4b5258', UK.STEEL); S(K, 0, 0.76, -0.38, 1.6, 0.84, 0.24, '#3f454b', UK.STEEL);
    D(K, -0.4, 0.98, -0.245, 0.62, 0.42, 0.03, '#58e0a8', UK.PAINT, { o: { glow: true } }); D(K, 0.4, 0.98, -0.245, 0.62, 0.42, 0.03, '#7fd0ff', UK.PAINT, { o: { glow: true } });
    S(K, 0, 0, 0.42, 0.06, 0.44, 0.06, dark, UK.STEEL); S(K, 0, 0.44, 0.42, 0.46, 0.06, 0.46, '#2f3a33', UK.CANVAS); S(K, 0, 0.5, 0.62, 0.46, 0.45, 0.06, '#2f3a33', UK.CANVAS);
  } },
  rack: { w: 0.66, d: 0.95, h: 2.0, f: (K) => { S(K, 0, 0, 0, 0.66, 2.0, 0.95, '#2b2f34', UK.STEEL); for (let i = 0; i < 5; i++) D(K, -0.18 + (i % 2) * 0.2, 0.4 + i * 0.32, 0.49, 0.06, 0.03, 0.03, i % 2 ? '#58e0a8' : '#ffb347', UK.PAINT, { o: { glow: true } }); } },
  weapons: { w: 1.6, d: 0.5, h: 1.7, f: (K) => {
    S(K, 0, 0, -0.17, 1.6, 1.7, 0.16, '#5a4a32', UK.WOOD); S(K, 0, 0, 0.08, 1.6, 0.3, 0.34, '#5a4a32', UK.WOOD);
    for (let i = 0; i < 6; i++) D(K, -0.62 + i * 0.25, 0.3, -0.06, 0.06, 1.15, 0.06, '#26282b', UK.STEEL);
  } },
  ammo: { w: 1.25, d: 0.65, h: 0.98, f: (K) => { S(K, 0, 0, 0, 1.2, 0.46, 0.6, PAL.olive, UK.STEEL); S(K, 0, 0.46, 0, 1.2, 0.04, 0.6, PAL.oliveD, UK.STEEL); S(K, 0, 0.5, 0, 1.2, 0.44, 0.6, '#5f6b4a', UK.STEEL); S(K, 0, 0.94, 0, 1.2, 0.04, 0.6, PAL.oliveD, UK.STEEL); } },
  sofa: { w: 1.9, d: 0.9, h: 0.85, f: (K) => { const c = '#5b5f46'; S(K, 0, 0, 0, 1.6, 0.42, 0.9, c, UK.CANVAS); S(K, 0, 0.42, -0.33, 1.6, 0.43, 0.24, c, UK.CANVAS); for (const sx of [-0.875, 0.875]) S(K, sx, 0, 0, 0.15, 0.62, 0.9, c, UK.CANVAS); } },
  counter: { w: 1.8, d: 0.66, h: 0.94, f: (K) => { S(K, 0, 0, 0, 1.8, 0.88, 0.62, '#c9cbc4', UK.STEEL); S(K, 0, 0.88, 0, 1.8, 0.06, 0.66, '#8d9192', UK.STEEL); D(K, 0.4, 0.94, -0.05, 0.5, 0.03, 0.36, '#9aa3a8', UK.STEEL); } },
  fridge: { w: 0.8, d: 0.72, h: 1.9, f: (K) => { S(K, 0, 0, 0, 0.8, 1.9, 0.72, '#e0e2dc', UK.STEEL); D(K, 0.3, 0.9, 0.375, 0.04, 0.5, 0.03, dark, UK.STEEL); } },
  medbed: { w: 2.0, d: 0.95, h: 0.75, f: (K) => {
    for (const sx of [-0.95, 0.95]) S(K, sx, 0, 0, 0.08, 0.55, 0.9, metal, UK.STEEL);
    S(K, 0, 0.55, 0, 2.0, 0.08, 0.95, metal, UK.STEEL); S(K, 0, 0.63, 0, 1.96, 0.12, 0.9, '#e8eae4', UK.CANVAS); S(K, -0.75, 0.75, 0, 0.36, 0.08, 0.6, '#ffffff', UK.CANVAS);
  } },
  generator: { w: 2.4, d: 1.3, h: 1.5, f: (K) => {
    S(K, 0, 0, 0, 2.4, 0.18, 1.2, dark, UK.STEEL); S(K, -0.2, 0.18, 0, 1.8, 1.2, 1.1, '#4f6a46', UK.STEEL); S(K, 0.95, 0.18, 0, 0.5, 0.9, 1.0, '#3f4a3f', UK.STEEL);
    D(K, -0.2, 1.38, 0, 1.2, 0.04, 0.6, '#2a2d30', UK.STEEL); D(K, -0.8, 1.42, 0.2, 0.12, 0.12, 0.12, '#ffb347', UK.PAINT, { o: { glow: true } });
  } },
  table: { w: 1.8, d: 0.9, h: 0.78, f: (K) => { for (const sx of [-0.85, 0.85]) for (const sz of [-0.39, 0.39]) S(K, sx, 0, sz, 0.06, 0.74, 0.06, dark, UK.STEEL); S(K, 0, 0.74, 0, 1.8, 0.04, 0.9, woodT, UK.WOOD); D(K, -0.3, 0.78, 0.05, 0.4, 0.03, 0.3, '#e8e4d0', UK.PAINT); } },
  crates: { w: 1.5, d: 0.75, h: 1.4, f: (K) => { S(K, -0.36, 0, 0, 0.72, 0.62, 0.72, PAL.wood, UK.WOOD); S(K, 0.39, 0, 0, 0.7, 0.7, 0.7, '#8a7048', UK.WOOD); S(K, -0.36, 0.62, 0, 0.6, 0.52, 0.6, '#957650', UK.WOOD); } },
  bench: { w: 1.8, d: 0.42, h: 0.46, f: (K) => { for (const sx of [-0.82, 0.82]) S(K, sx, 0, 0, 0.06, 0.42, 0.36, dark, UK.STEEL); S(K, 0, 0.42, 0, 1.8, 0.04, 0.42, woodT, UK.WOOD); } },
};
// duvar süsü: harita / pano / ekran (duvar yüzünden 3 cm önde, 1,1–2,1 m)
export function wallBoard(K, x, z, ry, kind = 'map') {
  K.b.with(x, 0, z, ry, () => {
    if (kind === 'screen') { K.d(0, 1.3, 0.025, 1.6, 0.9, 0.05, '#14191e', UK.STEEL); K.d(0, 1.36, 0.06, 1.48, 0.78, 0.02, '#5fd0ff', UK.PAINT, { o: { glow: true } }); return; }
    K.d(0, 1.15, 0.02, 1.8, 1.0, 0.04, '#d8d4c4', UK.PAINT);
    K.d(-0.45, 1.3, 0.05, 0.6, 0.45, 0.02, kind === 'map' ? '#8aa070' : '#f2f2ee', UK.PAINT); K.d(0.35, 1.25, 0.05, 0.7, 0.6, 0.02, kind === 'map' ? '#6f90a8' : '#e6e0c8', UK.PAINT);
  });
}
// oda doldurma sıraları
export const ROOM_SEQ = {
  radio: ['console', 'cabinet', 'console', 'shelf'], ops: ['console', 'console', 'cabinet'], guard: ['lockers', 'bench', 'cabinet'], armory: ['weapons', 'ammo', 'weapons', 'shelf', 'ammo'],
  office: ['desk', 'cabinet', 'desk', 'shelf'], computers: ['rack', 'rack', 'desk', 'rack'], lounge: ['sofa', 'shelf', 'fridge'], war: ['console', 'console', 'cabinet'],
  barracks: ['bunk', 'lockers'], kitchen: ['counter', 'fridge', 'counter', 'shelf'], mess: ['counter', 'shelf'], store: ['shelf', 'crates', 'shelf', 'ammo'],
  medical: ['medbed', 'cabinet', 'medbed', 'shelf'], generator: ['cabinet', 'shelf'], hall: [], tower: ['cabinet'],
};
export const ROOM_CENTER = { war: 'table', mess: 'table', ops: 'table', lounge: 'table', generator: 'generator', guard: 'table' };
export const ROOM_BOARD = { ops: 'map', war: 'map', radio: 'screen', office: 'note', computers: 'screen', guard: 'note', medical: 'note', armory: 'note' };

// Oda doldurucu: R = [x0, x1, z0, z1] (iç yüzler), y taban; keep = [[x0, x1, z0, z1, hmax?]] boş kalacak alanlar (kapı önü, merdiven, delik);
// win = { n:[[a,b]], s, e, w } pencere aralıkları (yüksek eşya konmaz). Eşyalar duvardan 5 cm, birbirinden 10 cm.
export function fillRoom(K, kind, R, y, keep = [], win = {}) {
  const seq = ROOM_SEQ[kind] || []; const placed = [];
  const hit = (r) => keep.some((k) => r[0] < k[1] && r[1] > k[0] && r[2] < k[3] && r[3] > k[2]) || placed.some((k) => r[0] < k[1] + 0.1 && r[1] > k[0] - 0.1 && r[2] < k[3] + 0.1 && r[3] > k[2] - 0.1);
  const inR = (r) => r[0] >= R[0] - 1e-6 && r[1] <= R[1] + 1e-6 && r[2] >= R[2] - 1e-6 && r[3] <= R[3] + 1e-6;
  const put = (name, cx, cz, ry) => { const I = ITEMS[name]; K.b.with(cx, y, cz, ry, () => I.f(K)); };
  let si = 0;
  if (seq.length) for (const side of ['n', 'e', 's', 'w']) {
    const along = side === 'n' || side === 's' ? [R[0], R[1]] : [R[2], R[3]];
    let a = along[0] + 0.15, tries = 0;
    while (a < along[1] - 0.3 && tries++ < 60) {
      const name = seq[si % seq.length], I = ITEMS[name], gap = 0.05;
      const w = I.w, dd = I.d;
      let r, cx, cz, ry;
      if (side === 'n') { r = [a, a + w, R[2] + gap, R[2] + gap + dd]; cx = a + w / 2; cz = R[2] + gap + dd / 2; ry = 0; }
      else if (side === 's') { r = [a, a + w, R[3] - gap - dd, R[3] - gap]; cx = a + w / 2; cz = R[3] - gap - dd / 2; ry = Math.PI; }
      else if (side === 'w') { r = [R[0] + gap, R[0] + gap + dd, a, a + w]; cx = R[0] + gap + dd / 2; cz = a + w / 2; ry = Math.PI / 2; }
      else { r = [R[1] - gap - dd, R[1] - gap, a, a + w]; cx = R[1] - gap - dd / 2; cz = a + w / 2; ry = -Math.PI / 2; }
      const wins = win[side] || [];
      const blockWin = I.h > 0.95 && wins.some(([p, q]) => a < q + 0.1 && a + w > p - 0.1);
      if (inR(r) && !hit(r) && !blockWin) {
        // yerel derinlik merkezi: eşya yerel z'si −d/2 … +d/2 → ön (+z) odaya; yön ayarı
        put(name, cx, cz, ry);
        placed.push(r); si++; a += w + 0.12;
      } else a += 0.3;
    }
  }
  const cn = ROOM_CENTER[kind];
  if (cn) {
    const I = ITEMS[cn], cx = (R[0] + R[1]) / 2, cz = (R[2] + R[3]) / 2, wide = R[1] - R[0] >= R[3] - R[2];
    const r = wide ? [cx - I.w / 2, cx + I.w / 2, cz - I.d / 2, cz + I.d / 2] : [cx - I.d / 2, cx + I.d / 2, cz - I.w / 2, cz + I.w / 2];
    const pad = [r[0] - 0.9, r[1] + 0.9, r[2] - 0.9, r[3] + 0.9];
    if (inR(pad) && !hit(pad)) { put(cn, cx, cz, wide ? 0 : Math.PI / 2); placed.push(r); }
  }
  return placed;
}
export { LAMP_COOL };
