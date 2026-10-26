// Kasaba asset kiti · İÇ MEKÂN EŞYASI + oda yerleştirici (paylaşılabilir). 12.168
// Her eşya yerel çerçevede: ayak izi x ∈ [−w/2, w/2], z ∈ [0, d] (z = 0 duvar tarafı, +z odaya doğru), taban y = 0 (döşeme üstü).
// Parçalar birbirine değer (bacak tablanın altında biter, sırtlık oturağın üstünde başlar); büyük gövdeler çarpışmalı, ince bacak / çıta çarpışmasız.
import { boxR, shade, NC } from './kasaba-shapes.js';

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

// Eşyayı duvara yaslı (z = 0 duvar) çiz: wallSide 'n' | 's' | 'e' | 'w' (odanın o duvarı), konum: duvar boyunca u (dünya), y döşeme
const RY = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };
export function placeItem(b, S, rng, kind, x, y, z, side) { const it = ITEMS[kind]; b.with(x, y, z, RY[side], () => b.obj('eşya:' + kind, () => it.draw(b, S, rng))); }

// ── oda yerleştirici ──
// room: { x0, x1, z0, z1, y, avoid: [[x0,x1,z0,z1]...] (kapı önü, merdiven), wins: { n:[[u0,u1]], ... } (pencere aralıkları, dünya koordinatı) }
// list: ['shelf', 'cabinet', ...] duvar eşyaları (sıra önemli) + { center: 'table', chairs: n } gibi serbest eşya.
export function furnishRoom(b, S, rng, room, list) {
  const placed = [...(room.avoid || [])];
  const ov = (a, c, m = 0.08) => a[0] < c[1] + m && a[1] > c[0] - m && a[2] < c[3] + m && a[3] > c[2] - m;
  const free = (r) => r[0] >= room.x0 - 1e-6 && r[1] <= room.x1 + 1e-6 && r[2] >= room.z0 - 1e-6 && r[3] <= room.z1 + 1e-6 && !placed.some((q) => ov(r, q));
  const rectOf = (side, u, w, d) => (side === 'n' ? [u - w / 2, u + w / 2, room.z0, room.z0 + d] : side === 's' ? [u - w / 2, u + w / 2, room.z1 - d, room.z1] : side === 'w' ? [room.x0, room.x0 + d, u - w / 2, u + w / 2] : [room.x1 - d, room.x1, u - w / 2, u + w / 2]);
  const sides = ['n', 'e', 's', 'w'];
  let n = 0;
  for (const e of list) {
    if (typeof e === 'object' && e.center) {
      const it = ITEMS[e.center], cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
      const r = [cx - it.w / 2, cx + it.w / 2, cz - it.d / 2, cz + it.d / 2];
      if (!free(r)) continue;
      placeItem(b, S, rng, e.center, cx, room.y, cz - it.d / 2, 'n'); placed.push(r); n++;
      if (e.chairs) for (const [dx, sd] of [[-0.45, 'n'], [0.45, 'n'], [-0.45, 's'], [0.45, 's']].slice(0, e.chairs)) {
        const ch = ITEMS.chair, zz = sd === 'n' ? r[2] - 0.47 : r[3] + 0.47;
        const rr = [cx + dx - 0.23, cx + dx + 0.23, Math.min(zz, sd === 'n' ? zz + 0.45 : zz - 0.45), Math.max(zz, sd === 'n' ? zz + 0.45 : zz - 0.45)];
        if (!free(rr)) continue;
        placeItem(b, S, rng, 'chair', cx + dx, room.y, zz, sd === 'n' ? 'n' : 's'); placed.push(rr);
      }
      continue;
    }
    const kind = typeof e === 'string' ? e : e.kind, it = ITEMS[kind];
    const pref = typeof e === 'object' && e.side ? [e.side] : sides.slice((n * 3 + Math.floor(rng() * 4)) % 4).concat(sides).slice(0, 4);
    let ok = false;
    for (const side of pref) {
      const ns = side === 'n' || side === 's', a0 = ns ? room.x0 : room.z0, a1 = ns ? room.x1 : room.z1;
      const wins = (room.wins && room.wins[side]) || [];
      const L = a1 - a0, steps = Math.floor((L - it.w) / 0.25);
      if (steps < 0) continue;
      const order = [...Array(steps + 1).keys()].sort(() => rng() - 0.5);
      for (const s of order) {
        const u = a0 + it.w / 2 + s * 0.25, r = rectOf(side, u, it.w, it.d);
        if (!free(r)) continue;
        if ((it.tall || it.wall) && wins.some(([w0, w1]) => u + it.w / 2 > w0 - 0.05 && u - it.w / 2 < w1 + 0.05)) continue;
        if ((it.tall || it.wall) && room.solid && !room.solid[side]) break;                       // duvara asılan / uzun eşya yalnız gerçek duvara
        const [px, pz] = side === 'n' ? [u, room.z0] : side === 's' ? [u, room.z1] : side === 'w' ? [room.x0, u] : [room.x1, u];
        placeItem(b, S, rng, kind, px, room.y, pz, side); placed.push(r); ok = true; n++;
        break;
      }
      if (ok) break;
    }
  }
  return n;
}
