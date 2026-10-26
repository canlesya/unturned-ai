// Kasaba asset kiti · İÇ MEKÂN EŞYASI + oda yerleştirici (paylaşılabilir). 12.168
// Her eşya yerel çerçevede: ayak izi x ∈ [−w/2, w/2], z ∈ [0, d] (z = 0 duvar tarafı, +z odaya doğru), taban y = 0 (döşeme üstü).
// Parçalar birbirine değer (bacak tablanın altında biter, sırtlık oturağın üstünde başlar); büyük gövdeler çarpışmalı, ince bacak / çıta çarpışmasız.
import { boxR, shade, leaf, NC } from './kasaba-shapes.js';
import * as PR from './kasaba-props.js';

const W = (S) => S.k.wood, P = (S) => S.k.plain;
// eşya tanımları: { w, d, h, tall?, draw(b, S, rng) }
export const ITEMS = {
  shelf: { w: 1.6, d: 0.36, h: 1.9, tall: true, draw(b, S, rng) {
    const c = '#6a4a30'; boxR(b, -0.8, 0.8, 0, 1.9, 0, 0.32, c, W(S));
    const bc = ['#8a2a20', '#2c4a7a', '#3a6a3a', '#b08a3a', '#5a3a5a'];
    for (const y of [0.15, 0.6, 1.05, 1.5]) { let x = -0.74; while (x < 0.66) { const bw = 0.06 + rng() * 0.08; boxR(b, x, Math.min(0.74, x + bw), y, y + 0.26 + rng() * 0.08, 0.32, 0.36, bc[Math.floor(rng() * 5)], P(S), NC); x += bw + 0.01; } }
  } },
  cabinet: { w: 1.04, d: 0.5, h: 0.9, draw(b, S) { boxR(b, -0.5, 0.5, 0, 0.86, 0, 0.46, '#8a6a48', W(S)); boxR(b, -0.52, 0.52, 0.86, 0.9, 0, 0.5, '#6a4a30', W(S), NC); for (const x of [-0.25, 0.25]) boxR(b, x - 0.05, x + 0.05, 0.6, 0.64, 0.46, 0.48, '#c8c0a8', P(S), NC); } },
  wardrobe: { w: 1.26, d: 0.6, h: 2.0, tall: true, draw(b, S) { boxR(b, -0.6, 0.6, 0, 1.94, 0, 0.58, '#7a5a3a', W(S)); boxR(b, -0.63, 0.63, 1.94, 2.0, 0, 0.6, '#5a3d24', W(S), NC); boxR(b, -0.02, 0.02, 0.2, 1.8, 0.58, 0.6, '#3a2a1a', P(S), NC); } },
  desk: { w: 1.4, d: 0.7, h: 0.76, draw(b, S) {
    boxR(b, -0.7, 0.7, 0.72, 0.76, 0, 0.7, '#8a6440', W(S));
    boxR(b, 0.2, 0.68, 0, 0.72, 0.02, 0.66, '#7a5636', W(S));
    for (const [x, z] of [[-0.66, 0.04], [-0.66, 0.6]]) boxR(b, x, x + 0.06, 0, 0.72, z, z + 0.06, '#5a3d24', W(S), NC);
    boxR(b, -0.25, 0.15, 0.76, 1.06, 0.08, 0.14, '#2a2b2e', P(S), NC); boxR(b, -0.1, 0.0, 0.76, 0.86, 0.14, 0.24, '#2a2b2e', P(S), NC);
  } },
  bed: { w: 1.0, d: 2.0, h: 0.55, draw(b, S, rng) {
    boxR(b, -0.5, 0.5, 0, 0.9, 0, 0.06, '#6a4a30', W(S));
    boxR(b, -0.5, 0.5, 0, 0.32, 0.06, 2.0, '#7a5a3a', W(S));
    boxR(b, -0.47, 0.47, 0.32, 0.5, 0.06, 1.97, '#e8e4da', P(S), NC);
    boxR(b, -0.35, 0.35, 0.5, 0.6, 0.12, 0.5, '#f2efe8', P(S), NC);
    boxR(b, -0.47, 0.47, 0.5, 0.53, 0.8, 1.97, ['#8a3a3a', '#3a5a8a', '#5a7a4a'][Math.floor(rng() * 3)], P(S), NC);
  } },
  sofa: { w: 2.0, d: 0.85, h: 0.85, draw(b, S, rng) {
    const c = ['#6a3a3a', '#3a4a6a', '#5a5a3a'][Math.floor(rng() * 3)];
    boxR(b, -1.0, 1.0, 0, 0.42, 0, 0.85, c, P(S));
    boxR(b, -1.0, 1.0, 0.42, 0.85, 0, 0.22, shade(c, 0.85), P(S));
    for (const x of [-1.0, 0.82]) boxR(b, x, x + 0.18, 0.42, 0.62, 0.22, 0.85, shade(c, 0.9), P(S), NC);
  } },
  counter: { w: 2.44, d: 0.6, h: 0.95, draw(b, S) { boxR(b, -1.2, 1.2, 0, 0.9, 0, 0.56, '#c8c0a8', P(S)); boxR(b, -1.22, 1.22, 0.9, 0.95, 0, 0.6, '#5a5e64', S.k.stone ?? P(S), NC); for (let i = 0; i < 3; i++) boxR(b, -1.1 + i * 0.8, -0.5 + i * 0.8, 0.1, 0.8, 0.56, 0.585, '#b0a890', P(S), NC); } },
  stove: { w: 0.6, d: 0.6, h: 0.92, draw(b, S) { boxR(b, -0.3, 0.3, 0, 0.88, 0, 0.6, '#e8e8e4', P(S)); boxR(b, -0.3, 0.3, 0.88, 0.92, 0, 0.6, '#2a2b2e', P(S), NC); boxR(b, -0.22, 0.22, 0.2, 0.6, 0.6, 0.62, '#2a2b2e', P(S), NC); } },
  fridge: { w: 0.7, d: 0.7, h: 1.8, tall: true, draw(b, S) { boxR(b, -0.35, 0.35, 0, 1.8, 0, 0.68, '#e8e8e4', P(S)); boxR(b, 0.22, 0.26, 0.9, 1.5, 0.68, 0.72, '#9aa1a8', P(S), NC); } },
  locker: { w: 1.2, d: 0.5, h: 1.9, tall: true, draw(b, S) { boxR(b, -0.6, 0.6, 0, 1.9, 0, 0.48, '#6a7a88', S.k.metal ?? P(S)); for (const x of [-0.2, 0.2]) boxR(b, x - 0.02, x + 0.02, 0.05, 1.85, 0.48, 0.5, '#4a5560', P(S), NC); } },
  pew: { w: 2.6, d: 0.6, h: 0.95, draw(b, S) { boxR(b, -1.3, 1.3, 0, 0.44, 0.1, 0.6, '#6a4a30', W(S)); boxR(b, -1.3, 1.3, 0, 0.95, 0, 0.1, '#5a3d24', W(S)); } },
  schooldesk: { w: 1.2, d: 0.6, h: 0.75, draw(b, S) { boxR(b, -0.6, 0.6, 0.7, 0.75, 0, 0.6, '#b09068', W(S)); boxR(b, -0.6, 0.6, 0, 0.7, 0, 0.06, '#5a5e64', S.k.metal ?? P(S)); for (const x of [-0.6, 0.54]) boxR(b, x, x + 0.06, 0, 0.7, 0.06, 0.6, '#5a5e64', S.k.metal ?? P(S), NC); } },
  workbench: { w: 2.0, d: 0.7, h: 0.92, draw(b, S) { boxR(b, -1.0, 1.0, 0.85, 0.92, 0, 0.7, '#8a6440', W(S)); boxR(b, -1.0, 1.0, 0, 0.85, 0, 0.12, '#5a5e64', S.k.metal ?? P(S)); boxR(b, -0.95, -0.35, 0, 0.6, 0.12, 0.66, '#b8352a', S.k.metal ?? P(S)); boxR(b, -0.6, 0.4, 0.92, 1.4, 0, 0.05, '#4a4d52', P(S), NC); } },
  rack: { w: 2.6, d: 1.0, h: 2.4, tall: true, draw(b, S, rng) {
    const c = '#3a6aa0', o = '#d9862a';
    for (const x of [-1.3, 1.2]) for (const z of [0, 0.9]) boxR(b, x, x + 0.1, 0, 2.4, z, z + 0.1, c, S.k.metal ?? P(S));
    for (const y of [0.1, 1.2, 2.3]) { boxR(b, -1.2, 1.2, y, y + 0.1, 0, 0.1, o, S.k.metal ?? P(S)); boxR(b, -1.2, 1.2, y, y + 0.1, 0.9, 1.0, o, S.k.metal ?? P(S)); boxR(b, -1.2, 1.2, y, y + 0.04, 0.1, 0.9, '#8a6a45', W(S), NC); }
    for (const y of [0.14, 1.24]) { let x = -1.15; while (x < 0.8) { const s = 0.6 + rng() * 0.35; if (x + s > 1.15) break; boxR(b, x, x + s, y, y + Math.min(0.9, s), 0.15, 0.15 + Math.min(0.75, s), ['#9a7448', '#a5865a', '#8a6440'][Math.floor(rng() * 3)], W(S)); x += s + 0.08; } }
  } },
  table: { w: 1.6, d: 0.9, h: 0.77, free: true, draw(b, S) {
    boxR(b, -0.8, 0.8, 0.72, 0.77, 0, 0.9, '#8a6440', W(S));
    for (const [x, z] of [[-0.74, 0.06], [0.68, 0.06], [-0.74, 0.78], [0.68, 0.78]]) boxR(b, x, x + 0.06, 0, 0.72, z, z + 0.06, '#5a3d24', W(S), NC);
  } },
  chair: { w: 0.45, d: 0.45, h: 0.95, free: true, draw(b, S) {
    boxR(b, -0.22, 0.22, 0.42, 0.46, 0, 0.44, '#7a5636', W(S));
    for (const [x, z] of [[-0.22, 0], [0.18, 0], [-0.22, 0.4], [0.18, 0.4]]) boxR(b, x, x + 0.04, 0, 0.42, z, z + 0.04, '#5a3d24', W(S), NC);
    boxR(b, -0.22, 0.22, 0.46, 0.95, 0, 0.04, '#7a5636', W(S), NC);
  } },
  rug: { w: 2.0, d: 1.4, h: 0.01, free: true, draw(b, S, rng) { const c = ['#8a3a2a', '#3a4a6a', '#6a5a2a'][Math.floor(rng() * 3)]; boxR(b, -1.0, 1.0, 0, 0.025, 0, 1.4, c, P(S), NC); boxR(b, -0.8, 0.8, 0.025, 0.045, 0.2, 1.2, shade(c, 1.25), P(S), NC); } },
  board: { w: 2.4, d: 0.1, h: 2.1, wall: true, draw(b, S) { boxR(b, -1.2, 1.2, 1.0, 2.1, 0, 0.04, '#2a4a3a', P(S), NC); boxR(b, -1.2, 1.2, 0.92, 1.0, 0, 0.1, '#6a4a30', W(S), NC); } },
  safe: { w: 0.8, d: 0.7, h: 1.2, draw(b, S) { boxR(b, -0.4, 0.4, 0, 1.2, 0, 0.66, '#4a4d52', S.k.metal ?? P(S)); post(b, S, 0.0, 0.7, 0.66); } },
  altar: { w: 2.0, d: 0.9, h: 1.0, draw(b, S) { boxR(b, -1.0, 1.0, 0, 0.15, 0, 0.9, '#b9b5aa', S.k.stone ?? P(S)); boxR(b, -0.8, 0.8, 0.15, 0.95, 0.1, 0.8, '#d8d0bc', S.k.stone ?? P(S)); boxR(b, -0.9, 0.9, 0.95, 1.02, 0.05, 0.85, '#e8e0cc', S.k.stone ?? P(S), NC); } },
  barrels: { w: 1.4, d: 0.7, h: 0.92, draw(b, S) { for (const x of [-0.35, 0.35]) { b.cyl(x, 0, 0.35, 0.3, 0.3, 0.92, '#2c5aa0', { seg: 8, ry: Math.PI / 8, collide: false, kind: S.k.metal }); b.collide(x, 0, 0.35, 0.5, 0.92, 0.22); b.collide(x, 0, 0.35, 0.22, 0.92, 0.5); } } },
};
function post(b, S, x, y, z) { boxR(b, x - 0.05, x + 0.05, y - 0.05, y + 0.05, z, z + 0.04, '#9aa1a8', S.k.metal ?? P(S), NC); }

// ── 12.176: yaşanmış iç mekân için ek eşyalar (aynı kurallar: parçalar yalnız değer; ≥ 0,2 m kalın gövde çarpışmalı; ince süs çarpışmasız) ──
const M = (S) => S.k.metal ?? P(S);
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const FAB = ['#6a3a3a', '#3a4a6a', '#5a5a3a', '#7a6a4a', '#4a5a5a'];
Object.assign(ITEMS, {
  bed2: { w: 1.6, d: 2.05, h: 1.0, draw(b, S, rng) {                       // çift kişilik yatak
    boxR(b, -0.8, 0.8, 0, 1.0, 0, 0.06, '#6a4a30', W(S));
    boxR(b, -0.8, 0.8, 0, 0.32, 0.06, 2.05, '#7a5a3a', W(S));
    boxR(b, -0.77, 0.77, 0.32, 0.5, 0.06, 2.02, '#e8e4da', P(S), NC);
    for (const x of [-0.4, 0.4]) boxR(b, x - 0.3, x + 0.3, 0.5, 0.6, 0.12, 0.5, '#f2efe8', P(S), NC);
    boxR(b, -0.77, 0.77, 0.5, 0.53, 0.8, 2.02, pick(rng, ['#8a3a3a', '#3a5a8a', '#5a7a4a', '#8a6a3a']), P(S), NC);
  } },
  nightstand: { w: 0.5, d: 0.42, h: 0.93, draw(b, S) {                     // komodin + abajur (gece parlar)
    boxR(b, -0.25, 0.25, 0, 0.55, 0, 0.42, '#7a5636', W(S));
    boxR(b, -0.06, 0.06, 0.36, 0.4, 0.42, 0.44, '#c8c0a8', P(S), NC);
    boxR(b, -0.07, 0.07, 0.55, 0.59, 0.14, 0.28, '#3a3d42', M(S), NC);
    boxR(b, -0.02, 0.02, 0.59, 0.75, 0.19, 0.23, '#3a3d42', M(S), NC);
    boxR(b, -0.11, 0.11, 0.75, 0.93, 0.1, 0.32, '#ffe2a0', P(S), { collide: false, o: { glow: true } });   // tavan lambasıyla aynı parlak renk → aynı ağ (ek çizim çağrısı yok)
  } },
  dresser: { w: 1.24, d: 0.5, h: 1.66, tall: true, draw(b, S) {              // şifonyer + duvar aynası
    boxR(b, -0.6, 0.6, 0, 0.82, 0, 0.46, '#8a6440', W(S));
    boxR(b, -0.62, 0.62, 0.82, 0.86, 0, 0.5, '#6a4a30', W(S), NC);
    for (const y of [0.18, 0.44, 0.7]) for (const x of [-0.3, 0.3]) boxR(b, x - 0.08, x + 0.08, y - 0.02, y + 0.02, 0.46, 0.48, '#c8c0a8', P(S), NC);
    const fr = '#5a3d24';
    boxR(b, -0.4, 0.4, 1.0, 1.06, 0, 0.05, fr, W(S), NC); boxR(b, -0.4, 0.4, 1.6, 1.66, 0, 0.05, fr, W(S), NC);
    boxR(b, -0.4, -0.34, 1.06, 1.6, 0, 0.05, fr, W(S), NC); boxR(b, 0.34, 0.4, 1.06, 1.6, 0, 0.05, fr, W(S), NC);
    boxR(b, -0.34, 0.34, 1.06, 1.6, 0, 0.02, '#b8c8d0', P(S), NC);
  } },
  chest: { w: 0.9, d: 0.45, h: 0.5, draw(b, S) {                            // sandık (yatak ucunda)
    boxR(b, -0.45, 0.45, 0, 0.42, 0, 0.45, '#7a5a3a', W(S)); boxR(b, -0.45, 0.45, 0.42, 0.5, 0, 0.45, '#6a4a30', W(S));
    for (const x of [-0.3, 0.3]) boxR(b, x - 0.03, x + 0.03, 0, 0.5, 0.45, 0.47, '#3a3d42', M(S), NC);
  } },
  plant: { w: 0.6, d: 0.6, h: 1.2, corner: true, draw(b, S, rng) {           // saksı bitkisi (yapraklar çarpışmasız küme)
    boxR(b, -0.17, 0.17, 0, 0.36, 0.13, 0.47, pick(rng, ['#a0522d', '#8a7a6a', '#c8c0b0', '#5a6a7a']), P(S));
    boxR(b, -0.14, 0.14, 0.36, 0.38, 0.16, 0.44, '#4a3a2a', P(S), NC);
    const v = S.k.veg ?? P(S);
    leaf(b, v, 0, 0.38, 0.3, 0.25, pick(rng, ['#4a7a3a', '#3f6a33', '#5a8a44']), { sy: 1.5, ry: rng() * 3 });
    leaf(b, v, 0, 0.78, 0.3, 0.17, '#5a8a44', { sy: 1.4, ry: rng() * 3 });
  } },
  floorLamp: { w: 0.44, d: 0.44, h: 1.66, tall: true, corner: true, draw(b, S) {   // ayaklı lamba (gece parlar)
    boxR(b, -0.16, 0.16, 0, 0.04, 0.06, 0.38, '#3a3d42', M(S), NC);
    boxR(b, -0.02, 0.02, 0.04, 1.34, 0.2, 0.24, '#3a3d42', M(S), NC);
    boxR(b, -0.12, 0.12, 1.34, 1.36, 0.1, 0.34, '#ffe2a0', P(S), { collide: false, o: { glow: true } });
    boxR(b, -0.19, 0.19, 1.36, 1.66, 0.03, 0.41, '#e8dcc0', P(S));
  } },
  painting: { w: 0.9, d: 0.06, h: 2.0, art: true, draw(b, S, rng) {          // duvar tablosu (çerçeve + manzara)
    const fr = pick(rng, ['#5a3d24', '#8a6a2a', '#2a2b2e']);
    boxR(b, -0.45, 0.45, 1.4, 1.45, 0, 0.06, fr, W(S), NC); boxR(b, -0.45, 0.45, 1.95, 2.0, 0, 0.06, fr, W(S), NC);
    boxR(b, -0.45, -0.4, 1.45, 1.95, 0, 0.06, fr, W(S), NC); boxR(b, 0.4, 0.45, 1.45, 1.95, 0, 0.06, fr, W(S), NC);
    boxR(b, -0.4, 0.4, 1.45, 1.95, 0, 0.03, pick(rng, ['#9ab8d0', '#d8b888', '#b8c8d8']), P(S), NC);
    boxR(b, -0.4, 0.4, 1.45, 1.6 + rng() * 0.1, 0.03, 0.056, pick(rng, ['#5a7a4a', '#7a8a4a', '#6a5a3a']), P(S), NC);
    boxR(b, 0.14, 0.26, 1.78, 1.88, 0.03, 0.056, pick(rng, ['#e8c060', '#f0e0c0', '#c8603a']), P(S), NC);
  } },
  map: { w: 1.2, d: 0.06, h: 2.0, art: true, draw(b, S, rng) {               // duvar haritası / ilan panosu
    const fr = '#5a3d24';
    boxR(b, -0.6, 0.6, 1.3, 1.35, 0, 0.06, fr, W(S), NC); boxR(b, -0.6, 0.6, 1.95, 2.0, 0, 0.06, fr, W(S), NC);
    boxR(b, -0.6, -0.55, 1.35, 1.95, 0, 0.06, fr, W(S), NC); boxR(b, 0.55, 0.6, 1.35, 1.95, 0, 0.06, fr, W(S), NC);
    boxR(b, -0.55, 0.55, 1.35, 1.95, 0, 0.03, '#e8e0c8', P(S), NC);
    boxR(b, -0.45, -0.05, 1.45, 1.7, 0.03, 0.056, '#8ab07a', P(S), NC); boxR(b, 0.05, 0.45, 1.6, 1.85, 0.03, 0.056, pick(rng, ['#7a9ac0', '#c8a070']), P(S), NC);
  } },
  filing: { w: 0.5, d: 0.62, h: 1.32, tall: true, draw(b, S) {              // dosya dolabı
    boxR(b, -0.25, 0.25, 0, 1.32, 0, 0.6, '#8a9098', M(S));
    for (let i = 0; i < 4; i++) { const y = 0.2 + i * 0.32; boxR(b, -0.08, 0.08, y, y + 0.04, 0.6, 0.62, '#3a3d42', M(S), NC); }
  } },
  tv: { w: 1.6, d: 0.45, h: 1.27, tall: true, draw(b, S) {                  // TV ünitesi + ekran
    boxR(b, -0.8, 0.8, 0, 0.5, 0, 0.45, '#5a3d24', W(S));
    for (const x of [-0.4, 0.4]) boxR(b, x - 0.1, x + 0.1, 0.22, 0.26, 0.45, 0.47, '#c8c0a8', P(S), NC);
    boxR(b, -0.16, 0.16, 0.5, 0.53, 0.12, 0.32, '#2a2b2e', P(S), NC);
    boxR(b, -0.03, 0.03, 0.53, 0.62, 0.2, 0.24, '#2a2b2e', P(S), NC);
    boxR(b, -0.55, 0.55, 0.62, 1.27, 0.17, 0.24, '#141518', P(S), NC);
  } },
  armchair: { w: 0.9, d: 0.85, h: 0.85, draw(b, S, rng) {
    const c = pick(rng, FAB);
    boxR(b, -0.45, 0.45, 0, 0.42, 0, 0.85, c, P(S)); boxR(b, -0.45, 0.45, 0.42, 0.85, 0, 0.22, shade(c, 0.85), P(S));
    for (const x of [-0.45, 0.29]) boxR(b, x, x + 0.16, 0.42, 0.62, 0.22, 0.85, shade(c, 0.9), P(S), NC);
  } },
  coffeeTable: { w: 1.0, d: 0.55, h: 0.49, draw(b, S, rng) {                // sehpa (halının iç bordürü üstünde durur)
    boxR(b, -0.5, 0.5, 0.4, 0.45, 0, 0.55, '#7a5636', W(S));
    for (const [x, z] of [[-0.46, 0.04], [0.41, 0.04], [-0.46, 0.46], [0.41, 0.46]]) boxR(b, x, x + 0.05, 0, 0.4, z, z + 0.05, '#5a3d24', W(S), NC);
    boxR(b, -0.3, -0.06, 0.45, 0.49, 0.15, 0.33, pick(rng, ['#8a2a20', '#2c4a7a', '#b08a3a']), P(S), NC);
  } },
  table2: { w: 0.9, d: 0.75, h: 0.77, free: true, draw(b, S) {              // küçük mutfak masası
    boxR(b, -0.45, 0.45, 0.72, 0.77, 0, 0.75, '#9a7448', W(S));
    for (const [x, z] of [[-0.41, 0.04], [0.35, 0.04], [-0.41, 0.65], [0.35, 0.65]]) boxR(b, x, x + 0.06, 0, 0.72, z, z + 0.06, '#5a3d24', W(S), NC);
  } },
  kitchenRun: { w: 2.44, d: 0.6, h: 2.2, tall: true, draw(b, S) {           // tezgâh + evye + üst dolaplar
    ITEMS.counter.draw(b, S);
    boxR(b, -0.5, -0.05, 0.95, 0.97, 0.12, 0.46, '#9aa1a8', M(S), NC);
    boxR(b, -1.2, 1.2, 1.5, 2.2, 0, 0.35, '#d8d0bc', P(S));
    for (const x of [-0.9, -0.3, 0.3, 0.9]) boxR(b, x - 0.02, x + 0.02, 1.56, 1.72, 0.35, 0.37, '#8a8e92', M(S), NC);
  } },
  gondola: { w: 1.8, d: 0.8, h: 1.6, draw(b, S, rng) {                       // market rafı (çift yüzlü; raf tahtaları çarpışmalı)
    boxR(b, -0.9, 0.9, 0, 0.12, 0, 0.8, '#5a5e64', M(S));
    boxR(b, -0.9, 0.9, 0.12, 1.6, 0.37, 0.43, '#9aa1a8', M(S));
    const G = ['#c0392b', '#2c5aa0', '#e8c060', '#3a7a3a', '#e8e4da', '#d9862a'];
    for (const [za, zb] of [[0.04, 0.37], [0.43, 0.76]]) {
      for (const y of [0.55, 1.05]) boxR(b, -0.88, 0.88, y, y + 0.03, za, zb, '#c8ccd0', M(S));
      for (const y of [0.12, 0.58, 1.08]) { let x = -0.85; while (x < 0.7) { const gw = 0.12 + rng() * 0.06; if (x + gw > 0.85) break; boxR(b, x, x + gw, y, y + 0.16 + rng() * 0.14, za + 0.08, za + 0.26, pick(rng, G), P(S), NC); x += gw + 0.02; } }
    }
  } },
  crates: { w: 1.34, d: 0.72, h: 1.2, draw(b, S) {                           // sandık yığını
    PR.crate(b, S, -0.33, 0.36, 0.6, 0); PR.crate(b, S, 0.33, 0.36, 0.6, 0, 0, '#a5865a'); PR.crate(b, S, 0, 0.36, 0.56, 0.6, 0, '#8a6440');
  } },
  tires: { w: 0.8, d: 0.8, h: 0.78, draw(b, S) { PR.tires(b, S, 0, 0.4, 3); } },
  classdesk: { w: 0.7, d: 1.06, h: 0.92, draw(b, S) {                        // okul sırası + sandalye (z = 0 tahtaya bakan uç)
    const mt = '#5a5e64';
    boxR(b, -0.35, 0.35, 0.7, 0.74, 0, 0.5, '#b09068', W(S));
    for (const x of [-0.35, 0.31]) boxR(b, x, x + 0.04, 0, 0.7, 0.04, 0.46, mt, M(S), NC);
    boxR(b, -0.31, 0.31, 0.3, 0.7, 0.04, 0.08, mt, M(S), NC);
    boxR(b, -0.21, 0.21, 0.42, 0.46, 0.62, 1.05, '#7a5636', W(S));
    for (const [x, z] of [[-0.21, 0.62], [0.17, 0.62], [-0.21, 1.01], [0.17, 1.01]]) boxR(b, x, x + 0.04, 0, 0.42, z, z + 0.04, mt, M(S), NC);
    boxR(b, -0.21, 0.21, 0.46, 0.92, 1.01, 1.05, '#7a5636', W(S), NC);
  } },
});
ITEMS.board.tall = true;

const RY = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };
export function placeItem(b, S, rng, kind, x, y, z, side) { const it = ITEMS[kind]; b.with(x, y, z, RY[side], () => b.obj('eşya:' + kind, () => it.draw(b, S, rng))); }

const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const IN = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] };                 // duvardan odaya birim vektör
const SIDES = ['n', 'e', 's', 'w'];
// side yönlü eşyanın (z = 0 ucu (px, pz) noktasında) ayak izi
const rectAt = (side, px, pz, w, d) => (side === 'n' ? [px - w / 2, px + w / 2, pz, pz + d] : side === 's' ? [px - w / 2, px + w / 2, pz - d, pz] : side === 'w' ? [px, px + d, pz - w / 2, pz + w / 2] : [px - d, px, pz - w / 2, pz + w / 2]);

// ── oda yerleştirici ──
// room: { x0, x1, z0, z1, y, type, k, avoid: [[x0,x1,z0,z1]...] (kapı önü, merdiven: yürünür kalır ve birbirine bağlı kalmalı),
//         wins: { n:[[u0,u1]], ... } (pencere / kapı aralıkları), solid: { n: true, ... } (gerçek duvar olan yüzler) }
// list öğeleri:
//   'kind' | { kind, side?, opp? }  duvara yaslı (opp: o eşyanın karşı duvarını dene)
//   { corner: 'kind' }              duvara yaslı, köşeye yakın
//   { center: 'table', chairs } | { set: 'table' | 'table2' }   serbest masa + sandalyeler (oda ortasına yakın)
//   { free: 'kind', n }             serbest eşya (halı, sandık yığını, market rafı)
//   { grid: 'classdesk', n }        tahtaya bakan sıra dizisi
//   { art: n, kind? }               duvar tablosu / harita (pencere, kapı, uzun eşya üstüne gelmez)
// Yerleşim kuralı: eşyalar birbirine / kaçınma alanına 8 cm'den yaklaşmaz (takımlar: komodin, sandalye, sehpa kendi eşyasına 2–4 cm);
// her çarpışmalı eşyadan sonra oda ızgarasında (0,15 m, gövde payı 0,7 m) bütün kapı / merdiven önleri birbirine bağlı ve
// serbest alanın ≥ %80'i aynı bölgede kalmalı (botların yolu, 1,4 m'den dar geçit yok) — yoksa o konum reddedilir.
export function furnishRoom(b, S, rng, room, list) {
  const { x0, x1, z0, z1 } = room;
  const placed = (room.avoid || []).map((r) => ({ r, port: true }));
  const items = [];
  const along = (side) => (side === 'n' || side === 's' ? [x0, x1] : [z0, z1]);
  const wallPt = (side, u) => (side === 'n' ? [u, z0] : side === 's' ? [u, z1] : side === 'w' ? [x0, u] : [x1, u]);
  const inward = (side, p, dd) => [p[0] + IN[side][0] * dd, p[1] + IN[side][1] * dd];
  const shift = (side, p, du) => (side === 'n' || side === 's' ? [p[0] + du, p[1]] : [p[0], p[1] + du]);
  // duvar şeridi doluluğu (resim / uzun eşya): pencere + kapı aralıkları, duvara yakın kaçınma alanları
  const wallOcc = { n: [], s: [], e: [], w: [] };
  for (const sd of SIDES) for (const w of (room.wins && room.wins[sd]) || []) wallOcc[sd].push(w);
  for (const { r } of placed) {
    if (r[2] < z0 + 0.35) wallOcc.n.push([r[0], r[1]]); if (r[3] > z1 - 0.35) wallOcc.s.push([r[0], r[1]]);
    if (r[0] < x0 + 0.35) wallOcc.w.push([r[2], r[3]]); if (r[1] > x1 - 0.35) wallOcc.e.push([r[2], r[3]]);
  }
  const ov = (a, c, m) => a[0] < c[1] + m && a[1] > c[0] - m && a[2] < c[3] + m && a[3] > c[2] - m;
  const inside = (r) => r[0] >= x0 - 1e-6 && r[1] <= x1 + 1e-6 && r[2] >= z0 - 1e-6 && r[3] <= z1 + 1e-6;
  const freeR = (r, m = 0.08, ign = []) => inside(r) && !placed.some((q) => !ign.includes(q) && ov(r, q.r, m));

  // ── erişilebilirlik ızgarası ──
  const CS = 0.15, INF = 0.7, NX = Math.max(1, Math.round((x1 - x0) / CS)), NZ = Math.max(1, Math.round((z1 - z0) / CS));
  const cx = (i) => x0 + (i + 0.5) * CS, cz = (j) => z0 + (j + 0.5) * CS;
  const raster = (g, r, inf) => {
    const i0 = Math.max(0, Math.ceil((r[0] - inf - x0) / CS - 0.5)), i1 = Math.min(NX - 1, Math.floor((r[1] + inf - x0) / CS - 0.5));
    const j0 = Math.max(0, Math.ceil((r[2] - inf - z0) / CS - 0.5)), j1 = Math.min(NZ - 1, Math.floor((r[3] + inf - z0) / CS - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * NX + i] = 1;
  };
  const baseGrid = () => {
    const g = new Uint8Array(NX * NZ);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const px = cx(i), pz = cz(j); if (px < x0 + INF || px > x1 - INF || pz < z0 + INF || pz > z1 - INF) g[j * NX + i] = 1; }
    return g;
  };
  const nearFree = (g, px, pz) => {
    const ci = Math.min(NX - 1, Math.max(0, Math.floor((px - x0) / CS))), cj = Math.min(NZ - 1, Math.max(0, Math.floor((pz - z0) / CS)));
    for (let rr = 0; rr <= 5; rr++) for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== rr) continue;
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
      if (!g[j * NX + i]) return j * NX + i;
    }
    return -1;
  };
  const portPts = placed.map(({ r }) => { const a = [Math.max(r[0], x0), Math.min(r[1], x1), Math.max(r[2], z0), Math.min(r[3], z1)]; return a[1] > a[0] && a[3] > a[2] ? [(a[0] + a[1]) / 2, (a[2] + a[3]) / 2] : null; }).filter(Boolean);
  const g0 = baseGrid(), ports = portPts.filter(([px, pz]) => nearFree(g0, px, pz) >= 0);
  const small = (x1 - x0) < 2.4 || (z1 - z0) < 2.4;
  const reach = (extra) => {
    if (small) return true;
    const g = baseGrid();
    for (const q of placed) if (q.solid) raster(g, q.r, INF);
    for (const r of extra) raster(g, r, INF);
    let nfree = 0; for (let i = 0; i < g.length; i++) if (!g[i]) nfree++;
    if (!nfree) return false;
    const pc = ports.map(([px, pz]) => nearFree(g, px, pz));
    if (pc.some((c) => c < 0)) return false;
    let start = pc.length ? pc[0] : g.indexOf(0);
    const seen = new Uint8Array(g.length), st = [start]; seen[start] = 1; let n = 0;
    while (st.length) {
      const c = st.pop(); n++;
      const i = c % NX, j = (c - i) / NX;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, e = j + dj; if (a < 0 || e < 0 || a >= NX || e >= NZ) continue; const q = e * NX + a; if (!g[q] && !seen[q]) { seen[q] = 1; st.push(q); } }
    }
    return pc.every((c) => seen[c]) && n >= 0.8 * nfree;
  };

  // ── tek eşya: side yönlü, z = 0 ucu (px, pz) ──
  const put = (kind, side, px, pz, { y = 0, m = 0.08, ign = [], check = true, tag } = {}) => {
    const it = ITEMS[kind], r = rectAt(side, px, pz, it.w, it.d);
    if (!freeR(r, m, ign)) return null;
    const solid = !it.flat && kind !== 'rug';
    if (check && solid && !reach([r])) return null;
    placeItem(b, S, rng, kind, px, room.y + y, pz, side);
    const q = { r, solid, kind, side, px, pz }; placed.push(q); items.push(tag || kind);
    if (it.tall && wallLine(side, r)) wallOcc[side].push(side === 'n' || side === 's' ? [r[0], r[1]] : [r[2], r[3]]);
    return q;
  };
  const wallLine = (side, r) => (side === 'n' ? r[2] < z0 + 0.05 : side === 's' ? r[3] > z1 - 0.05 : side === 'w' ? r[0] < x0 + 0.05 : r[1] > x1 - 0.05);

  // ── takım eşyaları (yatağın iki yanına komodin + ucuna sandık, kanepenin önüne halı + sehpa, masanın önüne sandalye) ──
  const hooks = {
    bed(q) { const it = ITEMS[q.kind]; for (const sg of [-1, 1]) put('nightstand', q.side, ...shift(q.side, [q.px, q.pz], sg * (it.w / 2 + 0.25 + 0.04)), { m: 0.03, ign: [q] }); put('chest', q.side, ...inward(q.side, [q.px, q.pz], it.d + 0.05), { m: 0.03, ign: [q] }); },
    sofa(q) {
      const it = ITEMS.sofa, rug = put('rug', q.side, ...inward(q.side, [q.px, q.pz], it.d + 0.12), { m: 0.04, ign: [q] });
      if (rug) put('coffeeTable', q.side, ...inward(q.side, [q.px, q.pz], it.d + 0.12 + 0.425), { y: 0.045, m: 0.02, ign: [q, rug] });
      else put('coffeeTable', q.side, ...inward(q.side, [q.px, q.pz], it.d + 0.35), { m: 0.04, ign: [q] });
    },
    desk(q) { put('chair', OPP[q.side], ...inward(q.side, [q.px, q.pz], ITEMS.desk.d + 0.47), { m: 0.02, ign: [q] }); },
  };
  hooks.bed2 = hooks.bed;
  const done = {};                                                            // tür → son konan (opp için)

  const onWall = (kind, sides, corner = false) => {
    const it = ITEMS[kind];
    for (const side of sides) {
      if (it.tall && room.solid && !room.solid[side]) continue;               // uzun eşya yalnız gerçek duvara
      const [a0, a1] = along(side), steps = Math.floor((a1 - a0 - it.w) / 0.25 + 1e-6);
      if (steps < 0) continue;
      const order = [...Array(steps + 1).keys()].map((s) => [s, corner ? Math.min(s, steps - s) + rng() * 0.5 : rng()]).sort((p, q) => p[1] - q[1]).map((p) => p[0]);
      let tries = 0;
      for (const s of order) {
        const u = a0 + it.w / 2 + s * 0.25;
        if (it.tall && ((room.wins && room.wins[side]) || []).some(([w0, w1]) => u + it.w / 2 > w0 - 0.05 && u - it.w / 2 < w1 + 0.05)) continue;
        const p = wallPt(side, u);
        if (!freeR(rectAt(side, p[0], p[1], it.w, it.d))) continue;
        if (++tries > 10) break;
        const q = put(kind, side, p[0], p[1]);
        if (q) return q;
      }
    }
    return null;
  };
  // serbest eşya / masa takımı: 0,25 m ızgarasında oda ortasına yakın adaylar, iki yön
  const anchors = (w, d) => {
    const out = [];
    for (const o of ['n', 'w']) {
      const ex = o === 'n' ? w : d, ez = o === 'n' ? d : w;
      for (let px = x0 + ex / 2; px <= x1 - ex / 2 + 1e-6; px += 0.25) for (let pz = z0 + ez / 2; pz <= z1 - ez / 2 + 1e-6; pz += 0.25) {
        const dc = Math.hypot(px - (x0 + x1) / 2, pz - (z0 + z1) / 2);
        out.push({ o, cxp: px, czp: pz, key: dc + rng() * 0.6 });
      }
    }
    return out.sort((p, q) => p.key - q.key);
  };
  const tableSet = (kind, nCh = 4) => {
    const it = ITEMS[kind], per = it.w >= 1.4 ? [-0.4, 0.4] : [0], ch = 0.47;
    let tries = 0;
    for (const a of anchors(it.w, it.d + 2 * ch)) {
      // masa ayak izi + sandalye şeritleri
      const T = a.o === 'n' ? [a.cxp - it.w / 2, a.cxp + it.w / 2, a.czp - it.d / 2, a.czp + it.d / 2] : [a.cxp - it.d / 2, a.cxp + it.d / 2, a.czp - it.w / 2, a.czp + it.w / 2];
      const B = a.o === 'n' ? [T[0], T[1], T[2] - ch, T[3] + ch] : [T[0] - ch, T[1] + ch, T[2], T[3]];
      if (!freeR(B)) continue;
      const chairs = [];
      for (const [k2, dx] of per.flatMap((dx) => [[0, dx], [1, dx]])) {
        if (chairs.length >= nCh) break;
        if (a.o === 'n') chairs.push(k2 === 0 ? ['n', a.cxp + dx, T[2] - ch] : ['s', a.cxp + dx, T[3] + ch]);
        else chairs.push(k2 === 0 ? ['w', T[0] - ch, a.czp + dx] : ['e', T[1] + ch, a.czp + dx]);
      }
      const CR = chairs.map(([sd, px, pz]) => rectAt(sd, px, pz, ITEMS.chair.w, ITEMS.chair.d));
      if (++tries > 30) return null;
      if (!reach([T, ...CR])) continue;
      const tq = put(kind, a.o, a.o === 'n' ? a.cxp : T[0], a.o === 'n' ? T[2] : a.czp, { check: false });
      if (!tq) continue;
      for (const [sd, px, pz] of chairs) put('chair', sd, px, pz, { m: 0.0, ign: [tq], check: false, tag: 'chair(set)' });
      return tq;
    }
    return null;
  };
  const freeItem = (kind, n = 1) => {
    const it = ITEMS[kind];
    for (let c = 0; c < n; c++) {
      let tries = 0, ok = false;
      for (const a of anchors(it.w, it.d)) {
        const p = a.o === 'n' ? [a.cxp, a.czp - it.d / 2] : [a.cxp - it.d / 2, a.czp];
        if (!freeR(rectAt(a.o, p[0], p[1], it.w, it.d), kind === 'gondola' || kind === 'crates' || kind === 'tires' ? 1.0 : 0.08)) continue;
        if (++tries > 20) break;
        const q = put(kind, a.o, p[0], p[1]);
        if (q) { ok = true; if (hooks[kind]) hooks[kind](q); break; }
      }
      if (!ok) break;
    }
  };
  // tahtaya bakan sıra dizisi (sütun 1,3 m, sıra 1,6 m; tahtadan 1,7 m)
  const gridDesks = (kind, n, face) => {
    const it = ITEMS[kind], [a0, a1] = along(face), L = a1 - a0, nc = Math.max(1, Math.floor((L - 1.2) / 1.3)), depth = face === 'n' || face === 's' ? z1 - z0 : x1 - x0;
    let c = 0;
    for (let row = 0; 1.7 + row * 1.6 + it.d < depth - 0.6 && c < n; row++) for (let col = 0; col < nc && c < n; col++) {
      const u = (a0 + a1) / 2 + (col - (nc - 1) / 2) * 1.3;
      const p = inward(face, wallPt(face, u), 1.7 + row * 1.6);
      if (put(kind, face, p[0], p[1])) c++;
    }
  };
  const art = (count, kind = 'painting') => {
    const it = ITEMS[kind]; let c = 0;
    const sides = SIDES.slice(Math.floor(rng() * 4)).concat(SIDES).slice(0, 4);
    for (const side of sides) {
      if (c >= count) break;
      if (room.solid && !room.solid[side]) continue;
      const [a0, a1] = along(side);
      for (const t of [0.5, 0.3, 0.7, 0.18, 0.82]) {
        const u = Math.round((a0 + (a1 - a0) * t) * 4) / 4;
        if (u - it.w / 2 < a0 + 0.3 || u + it.w / 2 > a1 - 0.3) continue;
        if (wallOcc[side].some(([p, q]) => u + it.w / 2 > p - 0.15 && u - it.w / 2 < q + 0.15)) continue;
        const p = wallPt(side, u), strip = rectAt(side, p[0], p[1], it.w, 0.12);
        if (placed.some((q) => q.kind && ITEMS[q.kind].h >= 1.25 && ov(strip, q.r, 0.05))) continue;   // köşedeki uzun eşyanın yan duvarı
        placeItem(b, S, rng, kind, p[0], room.y, p[1], side);
        wallOcc[side].push([u - it.w / 2, u + it.w / 2]); items.push(kind); c++;
        break;
      }
    }
  };

  let n = 0;
  for (const e of list) {
    const n0 = items.length;
    if (typeof e === 'object' && (e.center || e.set)) tableSet(e.center || e.set, e.chairs ?? 4);
    else if (typeof e === 'object' && e.free) freeItem(e.free, e.n || 1);
    else if (typeof e === 'object' && e.grid) gridDesks(e.grid, e.n || 6, (done.board && done.board.side) || 'n');
    else if (typeof e === 'object' && e.art) art(e.art, e.kind);
    else {
      const kind = typeof e === 'string' ? e : e.kind || e.corner;
      const rot = SIDES.slice((n * 3 + Math.floor(rng() * 4)) % 4).concat(SIDES).slice(0, 4);
      let sides = typeof e === 'object' && e.side ? [e.side] : rot;
      if (typeof e === 'object' && e.opp && done[e.opp]) sides = [OPP[done[e.opp].side], ...rot.filter((s) => s !== OPP[done[e.opp].side])];
      const q = onWall(kind, sides, typeof e === 'object' && !!e.corner || !!ITEMS[kind].corner);
      if (q) { done[kind] = q; if (hooks[kind]) hooks[kind](q); }
    }
    if (items.length > n0) n++;
  }
  if (b.furnStats) {                                                        // sayım / bakış noktası seçimi (scripts/kasabafurn.mjs)
    const W = [[x0, z0], [x1, z1]].map(([x, z]) => { const e = b.M.elements; return [e[0] * x + e[8] * z + e[12], e[2] * x + e[10] * z + e[14]]; });
    b.furnStats.push({ type: room.type || '?', k: room.k, area: (x1 - x0) * (z1 - z0), items, world: [Math.min(W[0][0], W[1][0]), Math.max(W[0][0], W[1][0]), Math.min(W[0][1], W[1][1]), Math.max(W[0][1], W[1][1])], y: room.y });
  }
  return items.length;
}

// ── oda türü tarifleri (12.176: eski Kasaba v2'nin oda başı eşya sayısından ve m² başı yoğunluğundan az olmasın) ──
// a: oda alanı (m²); büyük salonlarda (okul / ofis / pazar hali) serbest eşya sayısı alanla artar.
const rep = (n, x) => Array.from({ length: Math.max(0, n) }, () => x);
const per = (a, m) => Math.max(1, Math.round(a / m));
export const ROOMS = {
  salon: () => ['sofa', { kind: 'tv', opp: 'sofa' }, 'shelf', 'cabinet', 'armchair', { set: 'table' }, { corner: 'plant' }, { corner: 'floorLamp' }, { corner: 'plant' }, { art: 3 }],
  mutfak: () => ['kitchenRun', 'stove', 'fridge', 'cabinet', 'shelf', 'cabinet', { set: 'table2', chairs: 2 }, { corner: 'plant' }, { art: 2 }],
  yatak: () => ['bed2', 'wardrobe', 'dresser', 'desk', { free: 'rug' }, { corner: 'plant' }, { corner: 'floorLamp' }, { art: 2 }],
  cocuk: () => ['bed', 'wardrobe', 'desk', 'shelf', { corner: 'plant' }, { art: 2 }],
  calisma: () => [{ corner: 'plant' }, { corner: 'floorLamp' }, 'shelf', 'desk', 'filing', 'shelf', 'armchair', 'chest', 'cabinet', 'nightstand', { free: 'rug' }, { corner: 'plant' }, { corner: 'plant' }, { art: 3 }],
  sinif: (a) => ['board', 'desk', { grid: 'classdesk', n: Math.round(a / 5) }, 'shelf', 'cabinet', 'filing', 'shelf', ...rep(per(a, 40), { corner: 'plant' }), { art: per(a, 40), kind: 'map' }],
  ofis: (a) => ['desk', 'desk', 'filing', 'filing', 'shelf', 'cabinet', { free: 'desk', n: per(a, 11) - 1 }, ...(a > 50 ? [{ set: 'table' }, 'filing', 'shelf'] : []), ...rep(per(a, 30), { corner: 'plant' }), { corner: 'floorLamp' }, { art: per(a, 25), kind: 'map' }],
  karakol: (a) => ['locker', 'desk', 'desk', 'locker', 'filing', 'cabinet', 'locker', 'filing', { set: 'table' }, { free: 'desk', n: per(a, 30) }, { corner: 'plant' }, { art: per(a, 30), kind: 'map' }],
  lobi: (a) => ['counter', 'sofa', 'armchair', 'filing', 'shelf', 'shelf', 'cabinet', 'sofa', 'filing', { set: 'table' }, { free: 'desk', n: per(a, 40) }, ...rep(per(a, 30), { corner: 'plant' }), { corner: 'floorLamp' }, { art: per(a, 30) }],
  banka: (a) => ['counter', 'safe', 'desk', 'desk', 'safe', 'filing', 'cabinet', 'sofa', 'filing', { free: 'desk', n: per(a, 40) }, { set: 'table' }, ...rep(per(a, 35), { corner: 'plant' }), { art: per(a, 35) }],
  dukkan: (a) => ['counter', 'fridge', 'fridge', 'fridge', ...rep(per(a, 25), 'shelf'), { free: 'gondola', n: per(a, 13) }, { free: 'crates', n: per(a, 50) }, { corner: 'plant' }, { art: per(a, 60), kind: 'map' }],
  koridor: (a) => ['sofa', 'filing', 'shelf', 'cabinet', 'armchair', 'filing', { set: 'table' }, ...rep(per(a, 35), { corner: 'plant' }), { art: per(a, 35) }],
  garaj: () => ['workbench', 'workbench', 'rack', 'locker', 'barrels', 'tires', 'tires', 'cabinet', 'workbench', 'barrels', 'crates', 'crates', 'shelf', 'crates', 'tires', 'filing'],   // geçit salonu: orta boş (botlar kapıdan kapıya geçer)
  depo: () => ['rack', 'rack', 'workbench', 'tires', 'barrels', 'locker', 'barrels', 'cabinet', 'crates', 'crates', 'crates', 'crates', 'tires', 'rack', 'crates', 'crates', 'shelf', 'barrels'],
  depoAsma: (a) => ['rack', 'cabinet', 'barrels', 'locker', { free: 'crates', n: per(a, 10) }],
  kulube: () => ['bed', 'cabinet', 'shelf', 'stove', { set: 'table', chairs: 2 }, { corner: 'plant' }, { art: 1 }],
  market: (a) => ['counter', 'shelf', 'fridge', 'fridge', 'shelf', 'shelf', 'fridge', 'crates', 'cabinet', { free: 'gondola', n: per(a, 20) }, { corner: 'plant' }, { corner: 'plant' }, { art: 2, kind: 'map' }],
};
