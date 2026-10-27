import { KK } from './surface.js';
import { Q, lw, worldRect, pickOf, ctxAdd, wireClear } from '../common/kuzeyKit.js';
import { house, barn } from './house.js';
import { fence, stoneWall, logStack, crate, barrel, hayBale, streetLamp, jersey } from './props.js';
import { pole } from './infra.js';
import { watchtower, hesco } from './military.js';
import { sandbags, sandbagNest, ruin, chapel, busStop, roadSign, wayCross, well, haystack, balePile, hayCart, tent, burntCar, gasStation, substation, windmill, gravelPile } from '../common/kuzeyRural.js';
import { FLAGS, HQ, HELIPADS, PADS, FIELDS } from './layout.js';
import { forestDensity } from './terrain.js';
import { makeRng } from '../../builder.js';

// Kuzey Vadisi 12.182 doldurma: bayraklar arası mezralar, çiftlikler, Kavşak (C) merkezi, benzinlik, trafo, yol kenarı (telefon direği + tel,
// otobüs durağı, levha, yol haçı, yanmış araç), bayrak çevresi kum torbası mevzileri, yol kontrol noktaları, üs çadırları.
// Hepsi ChunkSet'te konumunun yığınına yazılır, ayak izi occ'a girer (ağaç / çakışma süzgeci); yerleşim deterministik (sunucu = istemci).
// ctx: { cs, T, rng, occ, put, free, at, wires, orchard }
const WALLS = ['#d8cfbd', '#cdbb98', '#e0d6c2', '#b9a886', '#c9c1b0', '#d2b48e', '#bfc2b4'], ROOFS = ['#8a4a32', '#7a3f2c', '#6e4434', '#93553a'];

// eksen hizalı küçük nesne: ayak izi boşsa koy (occ'a yaz)
function place(ctx, rect, fn, pad = 0.4) { if (!ctx.free(rect, pad)) { ctx.miss?.push(['yer', ...rect.map((v) => Math.round(v))]); return false; } ctx.occ.push(rect); fn(); return true; }
const wallRect = (x0, z0, x1, z1, t = 0.7) => [Math.min(x0, x1) - t / 2, Math.max(x0, x1) + t / 2, Math.min(z0, z1) - t / 2, Math.max(z0, z1) + t / 2];
function wallIf(ctx, x0, z0, x1, z1, kind = 'stone') {
  const r = wallRect(x0, z0, x1, z1, kind === 'stone' ? 0.7 : 0.3);
  return place(ctx, r, () => (kind === 'stone' ? stoneWall : fence)(ctx.at(x0, z0), ctx.T, x0, z0, x1, z1), 0.2);
}
// yerel çerçeveden (ry 90°'nin katı) dünyaya: duvar uçları eksen hizalı kalır
const L = (o, lx, lz) => lw(o.x, o.z, o.ry || 0, lx, lz);
// yön: yerel −z'nin dışarı (dx, dz) baktığı ry
const faceOut = (dx, dz) => { let best = 0, bd = -2; for (let k = 0; k < 4; k++) { const ry = k * Q, d = -Math.sin(ry) * dx - Math.cos(ry) * dz; if (d > bd) { bd = d; best = ry; } } return best; };
// bir yolun (x, z)'ye en yakın noktası + teğet
function roadNear(T, id, x, z) {
  const r = T.roads.find((q) => q.id === id); let bi = 0, bd = 1e18;
  r.pts.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; bi = i; } });
  const a = r.pts[Math.max(0, bi - 2)], b = r.pts[Math.min(r.pts.length - 1, bi + 2)], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x: r.pts[bi][0], z: r.pts[bi][1], tx: (b[0] - a[0]) / tl, tz: (b[1] - a[1]) / tl, w: r.w, r };
}

// ── genel çiftlik: ev + ahır + kulübe + avlu duvarı / çit + ot yığını + balya + araba + kütük + kuyu + meyve bahçesi ──
export function farmstead(ctx, o) {
  const { T, rng, at, put } = ctx, ry = o.ry || 0, R = (lx, lz) => L(o, lx, lz);
  const [hx, hz] = R(0, 0);
  const H = put(house, { furnish: true, x: hx, z: hz, w: 9, d: 7, floors: o.floors ?? 2, ry, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), seed: Math.floor(rng() * 9), id: o.id ? o.id + ':ev' : undefined, pad: 1.2 }, 9.3, 7.3);
  if (!H) return false;
  { const [x, z] = R(16, -3); put(barn, { x, z, w: 14, d: 9, h: 5.4, ry, id: o.id ? o.id + ':ahır' : undefined, pad: 1.0 }, 14.3, 9.3); }
  { const [x, z] = R(-9.5, -5); put(barn, { x, z, w: 4.4, d: 3.4, h: 2.6, ry, wall: '#7d5a3d', roof: '#5d6459', pad: 0.5 }, 4.7, 3.7); }
  // avlu: önde taş duvar (6 m araç geçidi), solda çit
  { const [a0, a1] = [R(-12, 11), R(3, 11)], [b0, b1] = [R(9, 11), R(24, 11)]; wallIf(ctx, a0[0], a0[1], a1[0], a1[1]); wallIf(ctx, b0[0], b0[1], b1[0], b1[1]); }
  { const [a0, a1] = [R(-13, -10), R(-13, 7)]; wallIf(ctx, a0[0], a0[1], a1[0], a1[1], 'fence'); }
  for (const [lx, lz] of [[25, 6.5], [29.5, 3]]) { const [x, z] = R(lx, lz); place(ctx, [x - 1.7, x + 1.7, z - 1.7, z + 1.7], () => haystack(at(x, z), T, x, z)); }
  { const [x, z] = R(8, 6.5); const r = worldRect(x, z, 3.6, 0.9, ry); place(ctx, r, () => balePile(at(x, z), T, x, z, ry)); }
  { const [x, z] = R(-5, 7.5); const r = worldRect(x, z, 3.6, 1.8, ry + Q); place(ctx, r, () => hayCart(at(x, z), T, x, z, ry + Q)); }
  { const [x, z] = R(-10, 2.5); const ax = (Math.round(ry / Q) & 1) ? 'x' : 'z'; place(ctx, [x - 1.6, x + 1.6, z - 1.6, z + 1.6], () => logStack(at(x, z), T, x, z, ax, 2.6, 2, 0.16)); }
  { const [x, z] = R(4, 6); place(ctx, [x - 1.1, x + 1.1, z - 1.1, z + 1.1], () => well(at(x, z), T, x, z)); }
  if (rng() < 0.6) { const [ax, az] = R(-3.5, 4.8), [bx, bz] = R(3.5, 4.8); ctxAdd(at(0, 0), 'laundry', [ax, T.heightAt(ax, az) + 0.1, az, bx, T.heightAt(bx, bz) + 0.1, bz]); }
  // meyve bahçesi (ağaç; çarpışma + görüş vegetation.js'de)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const [x, z] = R(-20 - j * 6.5, -9 + i * 6.5); ctx.orchard.push([x + (rng() - 0.5), z + (rng() - 0.5), rng() < 0.7 ? 'oak' : 'birch', 6 + rng() * 3]); }
  return true;
}

// ── Kavşak (C): eski Taş Köprü yerinde dört yol ağzı; bayrak alanında alçak siper, çevrede han, şapel, evler, yıkık evler ──
function kavsak(ctx) {
  const { T, rng, at, put } = ctx;
  // bayrak alanı (r 26): yolun iki yanında yıkık evler, kum torbası mevzileri, yanmış araçlar, alçak taş duvarlar, kuyu, balya
  put(ruin, { x: -17, z: 3, w: 8.5, d: 6.5, ry: Q, seed: 4, id: 'C:yıkık:1' }, 8.8, 6.8);
  put(ruin, { x: 18, z: 17, w: 7, d: 6, ry: 3 * Q, seed: 7, id: 'C:yıkık:2' }, 7.3, 6.3);
  for (const [x, z, ry] of [[-11, -13, 0], [12, -12, 0], [-10, 31, 2 * Q], [11, 34, 2 * Q]]) place(ctx, worldRect(x, z, 4.2, 2.8, ry), () => sandbagNest(at(x, z), T, x, z, ry));
  for (const [x, z, ry] of [[8.4, 1, Q], [-8.4, 22, 3 * Q], [-8.2, -31, Q]]) place(ctx, worldRect(x, z, 4.3, 1.8, ry), () => burntCar(at(x, z), T, x, z, ry, rng() < 0.5 ? '#3b3633' : '#4a3a2e'));
  wallIf(ctx, -25, -12, -15.5, -12); wallIf(ctx, 14, -24, 24, -24); wallIf(ctx, -27, 15, -27, 27); wallIf(ctx, 22, 2, 22, 10);
  place(ctx, [-11, -7, -5, -1], () => well(at(-9, -3), T, -9, -3));
  place(ctx, worldRect(13, 6, 3.6, 0.9, 0), () => balePile(at(13, 6), T, 13, 6, 0));
  for (const [x, z] of [[-12.5, 12], [-13.7, 12], [14, 27.5]]) place(ctx, [x - 0.6, x + 0.6, z - 0.6, z + 0.6], () => crate(at(x, z), T, x, z, 1.1), 0.02);
  // çevre: han (2 kat, büyük), şapel, evler, ahırlar, yıkık evler
  put(house, { furnish: true, x: -31, z: 36, w: 12, d: 9, floors: 2, ry: Q, wall: '#e0d6c2', roof: '#7a3f2c', seed: 1, id: 'C:han' }, 12.3, 9.3);
  put(chapel, { x: 30, z: -24, ry: 3 * Q, id: 'C:şapel' }, 5.6, 7.6);
  put(house, { furnish: true, x: -31, z: -22, w: 9, d: 7, floors: 2, ry: Q, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), seed: 2 }, 9.3, 7.3);
  put(house, { furnish: true, x: 32, z: 40, w: 8.5, d: 7, floors: 1, ry: 3 * Q, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), seed: 5 }, 8.8, 7.3);
  put(barn, { x: -46, z: 6, w: 12, d: 8, h: 5, ry: Q, id: 'C:ahır:1' }, 12.3, 8.3);
  put(barn, { x: 46, z: 12, w: 10, d: 7, h: 4.6, ry: 3 * Q, wall: '#8a6a48', id: 'C:ahır:2' }, 10.3, 7.3);
  put(ruin, { x: -38, z: -45, w: 7.5, d: 6, ry: 0, seed: 3 }, 7.8, 6.3);
  put(ruin, { x: 41, z: -48, w: 8, d: 6.5, ry: 2 * Q, seed: 8 }, 8.3, 6.8);
  put(house, { furnish: true, x: -50, z: 42, w: 8, d: 6.5, floors: 1, ry: 0, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), seed: 6 }, 8.3, 6.8);
  put(house, { furnish: true, x: 50, z: -12, w: 8.5, d: 7, floors: 2, ry: 3 * Q, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), seed: 3 }, 8.8, 7.3);
  // han avlusu: taş duvar + çit; durak, yol haçı, levhalar, lambalar
  wallIf(ctx, -44, 27, -38, 27); wallIf(ctx, -44, 27, -44, 46, 'fence');
  place(ctx, worldRect(8.3, 47, 3.6, 2.0, 3 * Q), () => busStop(at(8.3, 47), T, 8.3, 47, 3 * Q));
  place(ctx, [-9.5, -6.5, 50.5, 53.5], () => wayCross(at(-8, 52), T, -8, 52));
  for (const [x, z, ry] of [[6.6, -36, 0], [-6.6, 43, 2 * Q]]) place(ctx, [x - 0.3, x + 0.3, z - 0.3, z + 0.3], () => roadSign(at(x, z), T, x, z, ry), 0.1);
  for (const [x, z] of [[-7, -46], [7, 62], [-7, 20], [7, -10]]) { place(ctx, [x - 0.3, x + 0.3, z - 0.3, z + 0.3], () => streetLamp(at(x, z), T, x, z, x > 0 ? 2 * Q : 0), 0.1); }
  for (const [x, z] of [[54, -2], [-56, -8], [-58, 22]]) place(ctx, [x - 1.7, x + 1.7, z - 1.7, z + 1.7], () => haystack(at(x, z), T, x, z));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) ctx.orchard.push([56 + j * 6.5 + (rng() - 0.5), 26 + i * 6.5 + (rng() - 0.5), rng() < 0.75 ? 'oak' : 'birch', 6 + rng() * 3]);
}

// ── Değirmen (eski Demir Köprü; R7 yolu Radar Tepesi'nin doğu eteğinde) ──
function degirmen(ctx) {
  const { T, rng, at, put } = ctx, X = -470;
  put(windmill, { x: X - 22, z: -48, id: 'W:değirmen' }, 7, 7);
  put(house, { furnish: true, x: X - 20, z: -18, w: 9, d: 7, floors: 2, ry: Q, wall: '#e0d6c2', roof: '#6e4434', seed: 2, id: 'W:ev:1' }, 9.3, 7.3);
  put(house, { furnish: true, x: X + 19, z: -8, w: 8, d: 6.5, floors: 1, ry: 3 * Q, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), seed: 4, id: 'W:ev:2' }, 8.3, 6.8);
  put(barn, { x: X + 21, z: -40, w: 12, d: 8, h: 5, ry: 3 * Q, id: 'W:ahır' }, 12.3, 8.3);
  put(ruin, { x: X - 18, z: 12, w: 7, d: 6, ry: Q, seed: 5, id: 'W:yıkık' }, 7.3, 6.3);
  for (const [x, z, ry] of [[X + 9, -62, 0], [X - 9, 4, 2 * Q], [X + 10, 18, 2 * Q]]) place(ctx, worldRect(x, z, 4.2, 2.8, ry), () => sandbagNest(at(x, z), T, x, z, ry));
  { const p = roadNear(T, 'R7', X, -26), x = p.x + 6.6; place(ctx, worldRect(x, -26, 3.6, 2.0, 3 * Q), () => busStop(at(x, -26), T, x, -26, 3 * Q)); }
  { const p = roadNear(T, 'R7', X, 34), x = p.x - 7.8; place(ctx, worldRect(x, 34, 4.3, 1.8, Q), () => burntCar(at(x, 34), T, x, 34, Q)); }
  wallIf(ctx, X - 34, -30, X - 26, -30); wallIf(ctx, X - 34, -30, X - 34, -8, 'fence'); wallIf(ctx, X + 13, -26, X + 30, -26);
  for (const [x, z] of [[X + 32, -6], [X + 35, -14]]) place(ctx, [x - 1.7, x + 1.7, z - 1.7, z + 1.7], () => haystack(at(x, z), T, x, z));
  place(ctx, [X - 31, X - 29, -21, -19], () => well(at(X - 30, -20), T, X - 30, -20));
  { const x = X - 31, z = -42; place(ctx, worldRect(x, z, 3.6, 1.8, 0), () => hayCart(at(x, z), T, x, z, 0)); }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) ctx.orchard.push([X + 26 + j * 6.5 + (rng() - 0.5), 8 + i * 6.5 + (rng() - 0.5), 'oak', 6 + rng() * 3]);
}

// ── Geçit mezraları (eski sığ geçitler; toprak yol R12 / R11 iki yanı) ──
function gecit(ctx, id, roadId, cx, cz, side) {
  const { T, rng, at, put } = ctx, p = roadNear(T, roadId, cx, cz), X = p.x, Z = p.z;
  const S = side;
  put(house, { furnish: true, x: X - S * 15, z: Z - 9, w: 9, d: 7, floors: 2, ry: S > 0 ? Q : 3 * Q, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), seed: 3, id: id + ':ev:1' }, 9.3, 7.3);
  put(house, { furnish: true, x: X + S * 15, z: Z + 10, w: 8, d: 6.5, floors: 1, ry: S > 0 ? 3 * Q : Q, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), seed: 6, id: id + ':ev:2' }, 8.3, 6.8);
  put(barn, { x: X - S * 19, z: Z + 22, w: 12, d: 8, h: 5, ry: S > 0 ? Q : 3 * Q, id: id + ':ahır' }, 12.3, 8.3);
  put(ruin, { x: X + S * 14, z: Z - 20, w: 7.5, d: 6, ry: S > 0 ? 3 * Q : Q, seed: 9, id: id + ':yıkık' }, 7.8, 6.3);
  for (const [dx, dz, ry] of [[-9, -30, 0], [9, 30, 2 * Q]]) { const x = X + dx, z = Z + dz; place(ctx, worldRect(x, z, 4.2, 2.8, ry), () => sandbagNest(at(x, z), T, x, z, ry)); }
  { const x = X + S * 6.5, z = Z - 2; place(ctx, [x - 0.8, x + 0.8, z - 0.8, z + 0.8], () => wayCross(at(x, z), T, x, z)); }
  { const x = X - S * 6.8, z = Z + 4; place(ctx, worldRect(x, z, 4.3, 1.8, Q), () => burntCar(at(x, z), T, x, z, Q, '#4a3a2e')); }
  wallIf(ctx, X - S * 26, Z - 2, X - S * 26, Z + 12); wallIf(ctx, X + S * 22, Z + 2, X + S * 22, Z + 18, 'fence');
  for (const [dx, dz] of [[-S * 30, 8], [S * 27, -6]]) { const x = X + dx, z = Z + dz; place(ctx, [x - 1.7, x + 1.7, z - 1.7, z + 1.7], () => haystack(at(x, z), T, x, z)); }
  { const x = X + S * 24, z = Z - 6; place(ctx, worldRect(x, z, 3.6, 0.9, Q), () => balePile(at(x, z), T, x, z, Q)); }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.orchard.push([X - S * (32 + j * 6.5) + (rng() - 0.5), Z - 18 + i * 6.5 + (rng() - 0.5), 'oak', 6 + rng() * 3]);
}

// ── bayrak çevresi mevziler: bayrağın 14–40 m çevresinde, ön yüzü dışarı (gelinen yöne) bakan U mevzi ──
function flagDefenses(ctx) {
  const { T, at } = ctx, R = ctx.rng;
  for (const f of FLAGS) {
    if (f.id === 'C') continue;                                   // Kavşak elle yerleşti
    let n = 0;
    for (let k = 0; k < 24 && n < 4; k++) {
      const a = R() * 6.283, rr = f.r * 0.55 + R() * (f.r + 14), x = f.x + Math.cos(a) * rr, z = f.z + Math.sin(a) * rr, ry = faceOut(Math.cos(a), Math.sin(a));
      const fy0 = T.heightAt(x - 2, z - 2), fy1 = T.heightAt(x + 2, z + 2); if (Math.abs(fy1 - fy0) > 1.2) continue;
      if (place(ctx, worldRect(x, z, 4.2, 2.8, ry), () => sandbagNest(at(x, z), T, x, z, ry), 1.0)) n++;
    }
  }
}
// ── yol kontrol noktası: yolun iki yanında kum torbası hattı + banketin dışında beton bariyer (yol açık) ──
function checkpoint(ctx, roadId, x, z) {
  const { T, at } = ctx, p = roadNear(T, roadId, x, z), alongX = Math.abs(p.tx) > Math.abs(p.tz), slant = Math.min(Math.abs(p.tx), Math.abs(p.tz));
  for (const sd of [-1, 1]) for (let k = 0; k < 6; k++) {                     // yol eğikse hat dışarı kayar (yol hücresine değmez)
    const off = p.w / 2 + 2.4 + slant * 4 + k * 0.8;
    if (alongX) { const zz = p.z + sd * off; if (wallRectPlace(ctx, p.x - 3, zz, p.x + 3, zz)) { const jx = p.x + 9, jz = zz; place(ctx, [jx - 4.7, jx + 4.7, jz - 0.4, jz + 0.4], () => jersey(at(jx, jz), T, jx, jz, 'x', 3), 0.1); break; } }
    else { const xx = p.x + sd * off; if (wallRectPlace(ctx, xx, p.z - 3, xx, p.z + 3)) { const jx = xx, jz = p.z + 9; place(ctx, [jx - 0.4, jx + 0.4, jz - 4.7, jz + 4.7], () => jersey(at(jx, jz), T, jx, jz, 'z', 3), 0.1); break; } }
  }
  const sx = alongX ? p.x - 7 : p.x + (p.w / 2 + 3 + slant * 4), sz = alongX ? p.z + (p.w / 2 + 3 + slant * 4) : p.z - 7;
  place(ctx, [sx - 0.3, sx + 0.3, sz - 0.3, sz + 0.3], () => roadSign(at(sx, sz), T, sx, sz, alongX ? 0 : Q, '#b33a2a'), 0.2);
}
function wallRectPlace(ctx, x0, z0, x1, z1) { return place(ctx, wallRect(x0, z0, x1, z1, 0.8), () => sandbags(ctx.at(x0, z0), ctx.T, x0, z0, x1, z1), 0.1); }

// ── yol kenarı: telefon direkleri + tel (ana yollar, tek yan), yanmış araçlar, levhalar ──
function roadside(ctx) {
  const { T, at, rng, wires } = ctx;
  const avoid = [[-230, 250, 135], [250, -300, 120], [120, 700, 130], [-120, -700, 130], [700, -60, 110], [0, 9, 70], [-470, -31, 50], [400, 420, 70], [-380, -450, 70], [-560, 120, 60]];
  const ok = (x, z) => !avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r);
  for (const r of T.roads) {
    if (!['R1', 'R1n', 'R2', 'R3', 'R4', 'R9', 'R10', 'R13', 'R7n', 'R8'].includes(r.id)) continue;
    const side = r.id.length % 2 ? 1 : -1, off = r.w / 2 + 3.4;
    let acc = 0, prev = null, prevI = -9;
    for (let i = 2; i < r.pts.length - 2; i++) {
      const a = r.pts[i - 2], b = r.pts[i + 2], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / tl * side, nz = (b[0] - a[0]) / tl * side;
      acc += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      if (acc < 46) continue;
      const x = r.pts[i][0] + nx * off, z = r.pts[i][1] + nz * off;
      if (!ok(x, z) || T.roadAt(x, z) || !ctx.free([x - 0.5, x + 0.5, z - 0.5, z + 0.5], 0.3)) { prev = null; continue; }
      if (prev && i - prevI < 40) { const y0 = T.heightAt(x, z) - 0.3; if (!(wireClear(ctx.cs, prev[0], [x - 0.8, y0 + 7.9, z], 0.02) && wireClear(ctx.cs, prev[1], [x + 0.8, y0 + 7.9, z], 0.02))) continue; }   // 12.184 tel yapıdan geçerdi: sonraki örnek
      acc = 0; ctx.occ.push([x - 0.4, x + 0.4, z - 0.4, z + 0.4]);
      const top = pole(at(x, z), T, x, z);
      if (prev && i - prevI < 40) for (let k = 0; k < 2; k++) wires.push([prev[k], top[k], 0.02]);
      prev = top; prevI = i;
    }
    // yanmış / terk edilmiş araç: ~180 m'de bir, karşı banketin dışında, yola koşut (en yakın eksen)
    let acc2 = 60 + rng() * 80;
    for (let i = 2; i < r.pts.length - 2; i++) {
      acc2 -= Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      if (acc2 > 0) continue;
      acc2 = 150 + rng() * 120;
      const a = r.pts[i - 2], b = r.pts[i + 2], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / tl, tz = (b[1] - a[1]) / tl;
      const sd = -side, nx = -tz * sd, nz = tx * sd, ry = Math.abs(tx) > Math.abs(tz) ? 0 : Q, o = r.w / 2 + 3.6;
      const x = r.pts[i][0] + nx * o, z = r.pts[i][1] + nz * o;
      if (!ok(x, z)) continue;
      const rect = worldRect(x, z, 4.3, 1.8, ry);
      if (T.roadAt(rect[0], rect[2]) || T.roadAt(rect[1], rect[3]) || T.roadAt(rect[0], rect[3]) || T.roadAt(rect[1], rect[2])) continue;
      place(ctx, rect, () => burntCar(at(x, z), T, x, z, ry + (rng() < 0.5 ? 2 * Q : 0), pickOf(rng, ['#3b3633', '#4a3a2e', '#5b4a3a', '#2f3a40'])), 0.6);
    }
  }
}

// ── üs çadırları (arka sırada; doğuş / araç / heliped alanı dışında) ──
function baseCamps(ctx) {
  const { T, at } = ctx;
  for (const team of ['blue', 'red']) {
    const s = team === 'blue' ? 1 : -1, H = HQ[team];
    for (const dx of [-100, -91, -82, 84, 93, 102]) {
      const x = H.x + s * dx, z = H.z + s * 52, ry = team === 'blue' ? 2 * Q : 0;
      if (HELIPADS.some((h) => Math.abs(h.x - x) < h.r + 6 && Math.abs(h.z - z) < h.r + 6)) continue;
      ctx.put(tent, { x, z, ry, id: `çadır:${team}:${dx}`, pad: 0.8 }, 4.8, 6.6);
    }
    for (const dx of [-70, 70]) { const x = H.x + s * dx, z = H.z + s * 58, ry = team === 'blue' ? 2 * Q : 0; place(ctx, worldRect(x, z, 4.2, 2.8, ry), () => sandbagNest(at(x, z), T, x, z, ry)); }
  }
}

// ── açık çayırlara dağınık sert örtü: tarla barakası, yıkık ev, ot yığını, balya, taş duvar parçası, ot arabası, terk araç (bayrak / üs / tarla / orman dışı) ──
function scatterCover(ctx) {
  const { T, at, put } = ctx, R = makeRng(4242);
  const nearPad = (x, z) => PADS.some((p) => (p.r ? Math.hypot(x - p.x, z - p.z) < p.r + 20 : Math.abs(x - p.x) < p.w / 2 + 20 && Math.abs(z - p.z) < p.d / 2 + 20));
  let n = 0;
  for (let k = 0; k < 1400 && n < 90; k++) {
    const x = (R() - 0.5) * 1440, z = (R() - 0.5) * 1420, t = R(), ry = Math.floor(R() * 4) * Q;
    if (forestDensity(x, z) > 0.3 || nearPad(x, z) || FLAGS.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 25)) continue;
    if (FIELDS.some((f) => Math.abs(x - f[0]) < f[2] / 2 + 6 && Math.abs(z - f[1]) < f[3] / 2 + 6) || T.slopeAt(x, z, 3) > 0.22) continue;
    let ok = false;
    if (t < 0.22) ok = !!put(barn, { x, z, w: 4.4, d: 3.4, h: 2.6, ry, wall: R() < 0.5 ? '#7d5a3d' : '#6e4f36', roof: '#5d6459', pad: 1.0 }, 4.7, 3.7);
    else if (t < 0.36) ok = !!put(ruin, { x, z, w: 6 + R() * 2, d: 5 + R() * 1.5, ry, seed: Math.floor(R() * 50) }, 8.4, 6.9);
    else if (t < 0.52) { ok = place(ctx, [x - 1.7, x + 1.7, z - 1.7, z + 1.7], () => haystack(at(x, z), T, x, z), 1.0); if (ok) { const x2 = x + 4.2, z2 = z + 1.5; place(ctx, [x2 - 1.7, x2 + 1.7, z2 - 1.7, z2 + 1.7], () => haystack(at(x2, z2), T, x2, z2), 0.4); } }
    else if (t < 0.7) ok = place(ctx, worldRect(x, z, 3.6, 0.9, ry), () => balePile(at(x, z), T, x, z, ry), 1.0);
    else if (t < 0.84) { const L = 8 + R() * 8, ax = R() < 0.5; ok = wallIf(ctx, x - (ax ? L / 2 : 0), z - (ax ? 0 : L / 2), x + (ax ? L / 2 : 0), z + (ax ? 0 : L / 2)); }
    else if (t < 0.93) ok = place(ctx, worldRect(x, z, 3.6, 1.8, ry), () => hayCart(at(x, z), T, x, z, ry), 1.0);
    else ok = place(ctx, worldRect(x, z, 4.3, 1.8, ry), () => burntCar(at(x, z), T, x, z, ry, '#4a3a2e'), 1.0);
    if (ok) n++;
  }
  return n;
}
// ── Taş Ocağı (batı orman kenarı): mıcır yığınları, ocak barakası, terk kamyonet; büyük kaya blokları vegetation.js'de (ctx.rocks) ──
function quarry(ctx) {
  const { T, at, put } = ctx, R = makeRng(777), X = -662, Z = -372;
  put(barn, { x: X + 14, z: Z - 10, w: 10, d: 7, h: 4.6, ry: Q, wall: '#6e6a60', roof: '#5d6459', id: 'ocak:baraka', pad: 1.0 }, 10.3, 7.3);
  for (const [dx, dz, r] of [[-6, 4, 3.6], [2, 12, 2.8], [-12, -6, 3.0], [8, -4, 2.2]]) { const x = X + dx, z = Z + dz; place(ctx, [x - r, x + r, z - r, z + r], () => gravelPile(at(x, z), T, x, z, r), 0.6); }
  { const x = X + 4, z = Z + 2; place(ctx, worldRect(x, z, 4.3, 1.8, 0), () => burntCar(at(x, z), T, x, z, 0, '#6b5f45'), 0.6); }
  for (let i = 0; i < 14; i++) { const a = R() * 6.28, rr = 18 + R() * 16; ctx.rocks.push([X + Math.cos(a) * rr, Z + Math.sin(a) * rr, 3 + R() * 4.5]); }
}

export function placeFill(ctx) {
  const put0 = ctx.put;
  ctx.put = (fn, o, w, d) => { const r = put0(fn, o, w, d); if (!r) ctx.miss?.push([o.id || fn.name, Math.round(o.x), Math.round(o.z)]); return r; };
  const { T, at, put } = ctx;
  kavsak(ctx);
  degirmen(ctx);
  gecit(ctx, 'BG', 'R12', -205, 41, 1);
  gecit(ctx, 'DG', 'R11', 330, -76, -1);
  // Benzinlik (R1, Köy ile Çiftlik arası): ön yüz (+z yerel) yola, banketin 2 m dışında
  { const p = roadNear(T, 'R1', 40, 330); for (let off = 16.5; off < 34; off += 1.5) { const x = p.x - off, z = p.z; if (ctx.free(worldRect(x, z, 26, 18, Q), 1.0)) { put(gasStation, { x, z, ry: Q, id: 'benzinlik', pad: 1.0 }, 26, 18); break; } } }
  put(substation, { x: 476, z: -138, ry: 0, id: 'trafo' }, 22, 15);
  for (const [x, z, ry, id] of [[150, -60, 0, 'çiftlik:KD'], [-110, -100, Q, 'çiftlik:KB'], [262, 118, 2 * Q, 'çiftlik:DG'], [-300, 102, 3 * Q, 'çiftlik:BA'], [536, 236, Q, 'çiftlik:GD'], [-160, 482, 0, 'çiftlik:GB'], [182, -528, 2 * Q, 'çiftlik:KK'], [-540, 334, 3 * Q, 'çiftlik:BB'], [-80, 230, Q, 'çiftlik:KÇ'], [470, 70, 3 * Q, 'çiftlik:SD']]) farmstead(ctx, { x, z, ry, id });
  // avcı kulübeleri (orman kenarı) + avcı kuleleri
  for (const [x, z, ry] of [[478, -402, 0], [492, -396, 3 * Q], [-640, -240, Q], [-610, 520, 2 * Q]]) put(barn, { x, z, w: 6, d: 4.5, h: 2.8, ry, wall: '#6e4f36', roof: '#4f5649', pad: 0.6 }, 6.3, 4.8);
  for (const [x, z] of [[505, -420], [-650, -260], [-592, 505], [300, 200], [-300, -120], [120, -420]]) place(ctx, [x - 5.8, x + 1.8, z - 1.8, z + 1.8], () => watchtower(at(x, z), T, { x, z, h: 4.2 }), 0.5);
  quarry(ctx);
  flagDefenses(ctx);
  checkpoint(ctx, 'R1', 14, 150); checkpoint(ctx, 'R1n', 70, -140); checkpoint(ctx, 'R7', -478, 110); checkpoint(ctx, 'R9', 650, 150); checkpoint(ctx, 'R13', -36, -320); checkpoint(ctx, 'R3', 250, 510);
  baseCamps(ctx);
  roadside(ctx);
  scatterCover(ctx);
}
