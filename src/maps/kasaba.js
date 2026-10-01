import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import { COL } from './kit.js';

// Harita 1 — KASABA
// Batıda Mavi Takım çiftliği, doğuda Kırmızı Takım deposu, ortada benzinlik / pazar / kilise / evler.
// Ana yol X ekseninde (z=0), çapraz sokak Z ekseninde (x=0). Boyut: 140 × 98 m oyun alanı.

export const KASABA_BOUNDS = { minX: -68, maxX: 68, minZ: -48, maxZ: 48 };

export function buildKasaba() {
  const b = new MapBuilder();
  const rng = makeRng(1337);

  // ───────── Zemin ─────────
  b.box(0, -1.0, 0, 900, 1.0, 900, COL.grass, { collide: false });
  const patchCols = ['#88a04f', '#738a3f', '#8d9a52', '#76903f'];
  for (let i = 0; i < 90; i++) {
    const px = -66 + rng() * 132, pz = -46 + rng() * 92;
    b.box(px, 0, pz, 4 + rng() * 9, 0.025, 4 + rng() * 9, patchCols[i % 4], { collide: false });
  }

  // ───────── Yollar ─────────
  const A = COL.asphalt, RT = 0.06;
  b.box(0, 0, 0, 148, RT, 10, A, { collide: false });                    // ana yol
  b.box(0, 0, -27.5, 8, RT, 45, A, { collide: false });                  // kuzey sokak
  b.box(0, 0, 27.5, 8, RT, 45, A, { collide: false });                   // güney sokak
  // kaldırımlar
  const SW = { collide: true }, curbTop = 0.16;
  for (const sz of [-6.25, 6.25]) {
    b.box(-39, 0, sz, 70, curbTop, 2.5, COL.curb, SW);
    b.box(39, 0, sz, 70, curbTop, 2.5, COL.curb, SW);
  }
  for (const sx of [-5.25, 5.25]) {
    b.box(sx, 0, -29, 2.5, curbTop, 40, COL.curb, SW);
    b.box(sx, 0, 29, 2.5, curbTop, 40, COL.curb, SW);
  }
  // çizgiler
  for (let x = -70; x <= 70; x += 4) if (Math.abs(x) > 6) b.box(x, 0.06, 0, 2, 0.02, 0.2, COL.yellow, { collide: false });
  for (let z = -48; z <= 48; z += 4) if (Math.abs(z) > 6) b.box(0, 0.06, z, 0.2, 0.02, 2, COL.yellow, { collide: false });
  for (const s of [-4.5, 4.5]) {
    b.box(-37, 0.06, s, 66, 0.02, 0.16, COL.white, { collide: false });
    b.box(37, 0.06, s, 66, 0.02, 0.16, COL.white, { collide: false });
  }
  for (const cx of [-8, 8]) for (let k = 0; k < 8; k++) b.box(cx, 0.06, -3.5 + k, 0.55, 0.02, 1.0, COL.white, { collide: false, ry: Math.PI / 2 });
  for (const cz of [-8, 8]) for (let k = 0; k < 6; k++) b.box(-2.5 + k, 0.06, cz, 0.55, 0.02, 1.0, COL.white, { collide: false });

  // ───────── BATI: Mavi Takım çiftliği ─────────
  b.box(-54, 0, 0, 28, 0.035, 34, COL.dirt, { collide: false });          // toprak avlu
  K.barn(b, rng, { x: -58, z: -28 });
  K.silo(b, -47, -34);
  K.house(b, rng, { x: -58, z: 28, w: 10, d: 8, wall: '#d6cfb4', roof: '#7a3b2e', door: 'n', floors: 1 });
  for (let i = 0; i < 5; i++) K.hayBale(b, -45 + (i % 3) * 1.3, -22 + Math.floor(i / 3) * 1.3);
  K.hayBale(b, -45 + 0.6, -22 + 1.3, 1.2);
  K.sandbags(b, -44, 9.5, 4.5, 0);
  K.sandbags(b, -44, -9.5, 4.5, 0);
  K.sandbags(b, -47.5, 12, 3, Math.PI / 2);
  K.crate(b, -64, -12, 1.1); K.crate(b, -64, -10.8, 1.1); K.crate(b, -64, -11.5, 0.9, 1.1);
  K.crate(b, -64, 12, 1.1); K.crate(b, -62.8, 12.2, 1.0);
  K.barrel(b, -61, 14.5, '#2c5aa0'); K.barrel(b, -60.2, 14.9, '#2c5aa0'); K.barrel(b, -61, -14, '#c0392b');
  K.truck(b, { x: -50, z: 15, ry: 0.0, color: '#2c5aa0', cargo: '#cdd2d8' });
  K.watchtower(b, { x: -63, z: -13, ry: 0, color: '#6e5232' });
  K.fence(b, -66, -17, -48, -17); K.fence(b, -66, 17, -48, 17);
  K.fence(b, -66, 20, -66, 44); K.fence(b, -66, -44, -66, -38);

  // ───────── DOĞU: Kırmızı Takım deposu ─────────
  b.box(54, 0, 0, 28, 0.04, 40, COL.asphaltLot, { collide: false });      // asfalt otopark
  for (let i = -4; i <= 4; i++) b.box(46, 0.04, i * 4.5, 0.12, 0.02, 3.4, COL.white, { collide: false });
  K.warehouse(b, rng, { x: 56, z: -28 });
  K.container(b, { x: 52, z: 22, color: '#c0392b' });
  K.container(b, { x: 59, z: 22, color: '#3b6a9a' });
  K.container(b, { x: 55.5, z: 22, y: 2.6, color: '#d9a921' });
  K.container(b, { x: 50, z: 30, ry: Math.PI / 2, color: '#4a7a4f' });
  K.container(b, { x: 61, z: 30, ry: Math.PI / 2, color: '#c0392b' });
  K.container(b, { x: 48, z: -10, ry: Math.PI / 2, color: '#3b6a9a' });
  K.truck(b, { x: 47, z: 12, ry: Math.PI, color: '#a8281f', cargo: '#b9bec4' });
  K.barrier(b, 44, 9.5, Math.PI / 2); K.barrier(b, 44, -9.5, Math.PI / 2);
  K.sandbags(b, 44, 5, 4.5, Math.PI / 2); K.sandbags(b, 44, -5, 4.5, Math.PI / 2);
  K.crate(b, 64, -12, 1.1); K.crate(b, 64, -10.8, 1.1); K.crate(b, 64, 12, 1.1); K.crate(b, 62.8, 12.2, 1.0);
  K.barrel(b, 62, 14.5, '#c0392b'); K.barrel(b, 62.8, 14.9, '#c0392b'); K.barrel(b, 62, -14, '#d9a921');
  K.watchtower(b, { x: 63, z: 20, ry: Math.PI, color: '#6e5232' });
  K.fence(b, 66, -17, 66, -2); K.fence(b, 66, 2, 66, 17);

  // ───────── KASABA MERKEZİ ─────────
  // KB: evler
  K.house(b, rng, { x: -26, z: -18, w: 10, d: 9, wall: '#d9c79a', roof: '#a8432f', door: 's', floors: 2 });
  K.house(b, rng, { x: -12, z: -17, w: 9, d: 8, wall: '#c9d6c0', roof: '#5b6470', door: 's' });
  K.house(b, rng, { x: -20, z: -33, w: 9, d: 8, wall: '#d8b8a0', roof: '#6b4a3a', door: 's', backDoor: true });
  K.fence(b, -33, -10, -20, -10); K.fence(b, -17, -10, -8, -10);
  K.fence(b, -33, -10, -33, -40);
  // GD: benzinlik
  K.gasStation(b, rng, { x: 20, z: -14 });
  K.house(b, rng, { x: 15, z: -29, w: 10, d: 7, wall: '#ece5cf', roof: '#c0392b', door: 's', flat: true, floorColor: '#b9b9b0' });
  K.house(b, rng, { x: 32, z: -30, w: 8, d: 8, wall: '#b9cbd9', roof: '#4a5360', door: 's' });
  K.dumpster(b, 22, -33); K.barrel(b, 25, -26, '#2c5aa0'); K.barrel(b, 25.9, -26.3, '#2c5aa0');
  K.car(b, { x: 33, z: -15, ry: 0, color: '#d9a921' });
  // GB: kilise
  K.church(b, rng, { x: -21, z: 28 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) K.tombstone(b, -37 + c * 2.0, 17 + r * 2.4, 0);
  K.fence(b, -39.5, 14.5, -28.5, 14.5); K.fence(b, -39.5, 14.5, -39.5, 25);
  K.fence(b, -39.5, 25, -28.5, 25);
  // GD: pazar (2 katlı)
  K.house(b, rng, { x: 21, z: 20, w: 16, d: 12, wall: '#c9a27a', roof: '#6a4a3a', door: 'n', floors: 2, flat: true, floorColor: '#b5ab98', furnishing: false });
  for (const sx of [-4, 0, 4]) K.crate(b, 21 + sx, 21.5, 1.0); // (içeride raf yerine kasalar)
  b.box(21, 3.0, 13.72, 12, 1.1, 0.2, '#c0392b', { collide: false });        // levha
  b.box(21, 3.35, 13.6, 8, 0.45, 0.1, '#e8e8e4', { collide: false });
  K.house(b, rng, { x: 38, z: 33, w: 8, d: 8, wall: '#d9c79a', roof: '#a8432f', door: 'w' });
  K.house(b, rng, { x: 6, z: 36, w: 8, d: 8, wall: '#c9d6c0', roof: '#6b4a3a', door: 'n' });
  K.car(b, { x: 22, z: 35, ry: Math.PI / 2, color: '#2c5aa0' });
  K.car(b, { x: 28, z: 35, ry: Math.PI / 2, color: '#e8e8e4', wreck: true });
  K.dumpster(b, 30, 28, Math.PI / 2);

  // Kavşak: siperler, araçlar
  K.bus(b, { x: 13, z: 2.6, ry: 0 });
  K.car(b, { x: -14, z: -2.5, ry: 0, color: '#b33a2a', wreck: true });
  K.car(b, { x: -8, z: 3, ry: Math.PI, color: '#4a7a4f' });
  K.sandbags(b, 2.4, -7.5, 3, Math.PI / 2); K.sandbags(b, -2.4, 7.5, 3, Math.PI / 2);
  K.barrier(b, 0, -10); K.barrier(b, 3, 11, Math.PI / 2);
  K.car(b, { x: 2, z: -25, ry: Math.PI / 2, color: '#e8e8e4', wreck: true });
  K.car(b, { x: -2, z: 33, ry: Math.PI / 2, color: '#c0392b' });
  for (const [lx, lz, r] of [[-7, -8, 0], [7, -8, Math.PI], [-7, 8, 0], [7, 8, Math.PI], [-25, -8, 0], [25, 8, Math.PI]]) K.lamp(b, lx, lz, r);
  K.bench(b, -10, 9, 0); K.bench(b, 10, -9, Math.PI);

  // ───────── Ağaçlar & doğa ─────────
  const taken = [
    [-26, -18, 8], [-12, -17, 7], [-20, -33, 7], [20, -14, 12], [15, -29, 8], [32, -30, 7], [-21, 28, 12], [-21, 18, 6], [21, 20, 12],
    [38, 33, 7], [6, 36, 7], [-58, -28, 12], [-58, 28, 9], [56, -28, 16], [55, 25, 12], [-47, -34, 4], [-34, 20, 7],
  ];
  const ok = (x, z) => {
    if (Math.abs(z) < 9 && Math.abs(x) < 70) return false;
    if (Math.abs(x) < 7.5) return false;
    if (x < -43 && Math.abs(z) < 19) return false;
    if (x > 43 && Math.abs(z) < 19) return false;
    return !taken.some(([tx, tz, r]) => Math.hypot(x - tx, z - tz) < r);
  };
  for (let i = 0; i < 70; i++) {
    const x = -64 + rng() * 128, z = -44 + rng() * 88;
    if (!ok(x, z)) continue;
    if (rng() > 0.45) K.oak(b, rng, x, z, 0.9 + rng() * 0.5);
    else K.pine(b, rng, x, z, 0.9 + rng() * 0.5);
  }
  for (let i = 0; i < 70; i++) {
    const x = -66 + rng() * 132, z = -46 + rng() * 92;
    if (ok(x, z)) K.bush(b, rng, x, z, 0.8 + rng() * 0.6);
  }
  for (let i = 0; i < 16; i++) {
    const x = -66 + rng() * 132, z = -46 + rng() * 92;
    if (ok(x, z)) K.rock(b, rng, x, z, 0.8 + rng());
  }

  // ───────── Çevre (oyun alanı dışı) ─────────
  const { minX, maxX, minZ, maxZ } = KASABA_BOUNDS;
  // sınır çiti
  K.fence(b, minX - 1, minZ - 1, maxX + 1, minZ - 1, 1.6, '#7a5a38');
  K.fence(b, minX - 1, maxZ + 1, maxX + 1, maxZ + 1, 1.6, '#7a5a38');
  K.fence(b, minX - 1, minZ - 1, minX - 1, maxZ + 1, 1.6, '#7a5a38');
  K.fence(b, maxX + 1, minZ - 1, maxX + 1, maxZ + 1, 1.6, '#7a5a38');
  // orman duvarı
  for (let ring = 0; ring < 5; ring++) {
    const off = 4 + ring * 6;
    const step = 3.4;
    for (let x = minX - off; x <= maxX + off; x += step) for (const zz of [minZ - off, maxZ + off]) {
      const jx = x + (rng() - 0.5) * 2, jz = zz + (rng() - 0.5) * 2;
      (rng() > 0.25 ? K.pine : K.oak)(b, rng, jx, jz, 1.1 + rng() * 0.9);
    }
    for (let z = minZ - off + step; z < maxZ + off; z += step) for (const xx of [minX - off, maxX + off]) {
      const jx = xx + (rng() - 0.5) * 2, jz = z + (rng() - 0.5) * 2;
      (rng() > 0.25 ? K.pine : K.oak)(b, rng, jx, jz, 1.1 + rng() * 0.9);
    }
  }
  // tepeler + dağlar
  const hillCols = ['#6f8a43', '#7a8f48', '#657a3d', '#8a7a52'];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.2;
    const rx = 135 + rng() * 40, rz = 105 + rng() * 40;
    b.ico(Math.cos(a) * rx, -3, Math.sin(a) * rz, 28 + rng() * 14, hillCols[i % 4], { detail: 1, scale: [1.6, 0.55, 1.3], collide: false });
  }
  const mtCols = ['#7b786f', '#6e6c66', '#847f74'];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rng() * 0.15;
    const rx = 300 + rng() * 50, rz = 270 + rng() * 50;
    const h = 38 + rng() * 42, base = 70 + rng() * 40;
    b.cyl(Math.cos(a) * rx, 0, Math.sin(a) * rz, 0.1, base, h, mtCols[i % 3], { seg: 7, ry: rng() * 3, collide: false });
    if (h > 62) b.cyl(Math.cos(a) * rx, h * 0.84, Math.sin(a) * rz, 0.1, base * 0.2, h * 0.16, '#e8ecef', { seg: 7, collide: false });
  }

  // ───────── Doğuş noktaları & hedefler ─────────
  const spawns = { blue: [], red: [] };
  for (let i = 0; i < 12; i++) {
    const row = i % 2, col = Math.floor(i / 2);
    spawns.blue.push({ x: -60 + row * 3.5, z: -9 + col * 3.6, ry: -Math.PI / 2 });   // doğuya (+X) bakar
    spawns.red.push({ x: 60 - row * 3.5, z: -9 + col * 3.6, ry: Math.PI / 2 });      // batıya (−X) bakar
  }
  const objectives = [
    { id: 'evler', core: true, name: 'Evler', x: -20, z: -18, r: 9 },
    { id: 'kilise', name: 'Kilise', x: -21, z: 24, r: 9 },
    { id: 'kavsak', core: true, name: 'Kavşak', x: 0, z: 0, r: 9 },
    { id: 'benzinlik', name: 'Benzinlik', x: 20, z: -13, r: 9 },
    { id: 'pazar', core: true, name: 'Pazar', x: 21, z: 20, r: 9 },
  ];

  return {
    id: 'kasaba',
    name: 'Kasaba',
    group: b.build(),
    colliders: b.colliders,
    bounds: KASABA_BOUNDS,
    roads: [{ x0: -75, z0: -5, x1: 75, z1: 5 }, { x0: -4, z0: -50, x1: 4, z1: 50 }],
    spawns,
    objectives,
  };
}
