import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as M from './kitMil.js';
import { COL } from './kit.js';

// Harita 3 — ASKERİ ÜS
// Düz, çevresi duvarlı üs: batıda Mavi, doğuda Kırmızı kampı. Ortada 3 katlı komuta binası,
// kuzeyde hangar, güneyde radar kulesi; iki yanda kışla ve akaryakıt deposu. Bunkerler ve konteynerler siper verir.
// Boyut: 128 × 96 m oyun alanı.

export const US_BOUNDS = { minX: -64, maxX: 64, minZ: -48, maxZ: 48 };

export function buildUs() {
  const b = new MapBuilder();
  const rng = makeRng(4242);
  const { CONC, CONC_D, STEEL } = M;

  // ───────── Zemin ─────────
  b.box(0, -1.0, 0, 900, 1.0, 900, '#667049', { collide: false });
  b.box(0, 0, 0, 132, 0.04, 100, '#6c7173', { collide: false });                   // beton saha
  const slab = ['#686d70', '#72777a', '#63696b'];
  for (let i = 0; i < 70; i++) b.box(-62 + rng() * 124, 0.04, -46 + rng() * 92, 5 + rng() * 9, 0.012, 5 + rng() * 9, slab[i % 3], { collide: false });
  const A = '#41444a';
  b.box(0, 0.045, 0, 128, 0.02, 9, A, { collide: false });                            // doğu-batı caddesi
  b.box(0, 0.045, -25, 8, 0.02, 40, A, { collide: false });
  b.box(0, 0.045, 25, 8, 0.02, 40, A, { collide: false });
  for (let x = -62; x <= 62; x += 4) if (Math.abs(x) > 12) b.box(x, 0.07, 0, 2, 0.015, 0.2, COL.yellow, { collide: false });
  for (let z = -46; z <= 46; z += 4) if (Math.abs(z) > 12) b.box(0, 0.07, z, 0.2, 0.015, 2, COL.yellow, { collide: false });
  b.box(0, 0.045, 0, 28, 0.02, 24, '#585c61', { collide: false });                    // komuta meydanı

  // ───────── Çevre duvarı + köşe kuleleri ─────────
  const WH = 3.4;
  b.box(0, 0, -48.6, 131, WH, 1.2, CONC);
  b.box(0, 0, 48.6, 131, WH, 1.2, CONC);
  b.box(-64.6, 0, 0, 1.2, WH, 98, CONC);
  b.box(64.6, 0, 0, 1.2, WH, 98, CONC);
  for (const [px, pz, w, d] of [[0, -48.6, 131.4, 1.5], [0, 48.6, 131.4, 1.5], [-64.6, 0, 1.5, 98.4], [64.6, 0, 1.5, 98.4]]) b.box(px, WH, pz, w, 0.2, d, CONC_D, { collide: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.watchtower(b, { x: sx * 59.5, z: sz * 43.5, ry: sx > 0 ? Math.PI : 0, color: '#5e6b4a' });

  // ───────── Kamp iç duvarları (üç kapı: orta geniş, iki yan dar) ─────────
  for (const s of [-1, 1]) {
    const wx = s * 44;
    for (const [za, zb] of [[-48, -34], [-26, -12], [12, 26], [34, 48]]) {
      b.box(wx, 0, (za + zb) / 2, 0.8, 2.6, zb - za, CONC);
      b.box(wx, 2.6, (za + zb) / 2, 1.1, 0.18, zb - za, CONC_D, { collide: false });
    }
    // kapı kenar kuleleri
    for (const z of [-34, -26, -12, 12, 26, 34]) b.box(wx, 0, z, 1.3, 3.2, 1.3, STEEL);
    // kapı üstü sancak şeridi
    b.box(wx, 3.2, 0, 0.5, 0.15, 24, s < 0 ? '#2b6fd6' : '#d63a2b', { collide: false });
  }

  // ───────── Mavi ve Kırmızı kamp ─────────
  for (const s of [-1, 1]) {
    const T = s < 0 ? { wall: '#7c8a8f', roof: '#3a5f8f' } : { wall: '#8d867a', roof: '#8f3a30' };
    for (const sz of [-1, 1]) {
      K.house(b, rng, { x: s * 54, z: sz * 38, w: 12, d: 8, wall: T.wall, roof: T.roof, door: sz < 0 ? 's' : 'n', floors: 1, flat: true, floorColor: '#7c7468' });
    }
    // kamp avlusu
    K.truck(b, { x: s * 60, z: -22, ry: Math.PI / 2, color: s < 0 ? '#3f5f8f' : '#8f4a3a' });
    K.truck(b, { x: s * 60, z: 22, ry: Math.PI / 2, color: s < 0 ? '#3f5f8f' : '#8f4a3a' });
    K.car(b, { x: s * 50, z: -20, ry: 0.3, color: '#5e6b4a' });
    K.car(b, { x: s * 50, z: 20, ry: -0.2, color: '#5e6b4a' });
    K.container(b, { x: s * 61, z: -30, ry: Math.PI / 2, color: s < 0 ? '#2d5a8a' : '#8a3a2d' });
    K.container(b, { x: s * 61, z: 30, ry: Math.PI / 2, color: s < 0 ? '#2d5a8a' : '#8a3a2d' });
    K.sandbags(b, s * 46.5, -9, 4.2, Math.PI / 2);
    K.sandbags(b, s * 46.5, 9, 4.2, Math.PI / 2);
    K.sandbags(b, s * 46.5, -30, 3.6, Math.PI / 2);
    K.sandbags(b, s * 46.5, 30, 3.6, Math.PI / 2);
    for (let i = 0; i < 4; i++) K.crate(b, s * (62.2 - (i % 2) * 1.2), -14 + i * 0.1 + Math.floor(i / 2) * 1.2, 1.1);
    K.barrel(b, s * 62, 14, '#556b2f'); K.barrel(b, s * 62, 15, '#556b2f'); K.barrel(b, s * 61, 14.5, '#c0392b');
    K.lamp(b, s * 56, -12); K.lamp(b, s * 56, 12);
  }

  // ───────── Komuta binası (3 kat) ─────────
  K.house(b, rng, { x: 0, z: 0, w: 16, d: 12, wall: '#8a9189', roof: '#4c5156', door: 's', backDoor: true, floors: 3, flat: true, floorColor: '#7a7e78' });
  b.box(0, 9.3 + 0.35, 0, 0.3, 4.2, 0.3, '#2a2d30', { collide: false });               // anten direği
  b.box(0, 13.2, 0, 3.2, 0.12, 0.12, '#2a2d30', { collide: false });
  for (const [x, z, ry] of [[-11, 10, 0], [11, 10, 0], [-11, -10, 0], [11, -10, 0]]) K.barrier(b, x, z, ry);
  K.sandbags(b, -5, 11, 4, 0); K.sandbags(b, 5, 11, 4, 0);
  K.sandbags(b, -5, -11, 4, 0); K.sandbags(b, 5, -11, 4, 0);
  K.lamp(b, -9, 7); K.lamp(b, 9, -7);

  // ───────── Hangar (kuzey) + helikopter + helipad ─────────
  M.hangar(b, rng, { x: 0, z: -33 });
  M.helicopter(b, { x: -5, z: -33, ry: Math.PI / 2 + 0.2 });
  K.container(b, { x: 7, z: -29.5, ry: 0 });
  K.container(b, { x: 7, z: -29.5, y: 2.6, ry: 0, color: '#8a6a2d' });
  K.crate(b, 9, -36, 1.2); K.crate(b, 10.3, -36.2, 1.0); K.crate(b, 9.5, -36, 0.9, 1.2);
  K.barrel(b, -11, -29, '#c0392b'); K.barrel(b, -11.8, -29.4, '#c0392b');
  M.helipad(b, { x: 25, z: -36, r: 6.5 });
  M.helicopter(b, { x: 25, z: -36, ry: -0.6, color: '#3f4a5e' });
  K.sandbags(b, 17, -26, 4, 0);
  K.barrier(b, -16, -22); K.barrier(b, 16, -22, 0);

  // ───────── Radar kulesi (güney) ─────────
  M.radarTower(b, { x: 0, z: 34 });
  K.container(b, { x: -12, z: 30, ry: Math.PI / 2, color: '#556b2f' });
  K.container(b, { x: -12, z: 37, ry: Math.PI / 2, color: '#8a6a2d' });
  K.container(b, { x: 14, z: 27, ry: 0, color: '#2d5a8a' });
  K.sandbags(b, 8, 26, 4, 0); K.sandbags(b, -8, 26, 4, 0);
  K.barrier(b, 12, 41); K.barrier(b, -14, 22);
  b.box(-22, 0, 36, 8, 3.0, 5, '#7d8a7a');                                              // jeneratör kulübesi
  b.box(-22, 3.0, 36, 8.4, 0.25, 5.4, STEEL, { collide: false });

  // ───────── Kışla (batı) ─────────
  K.house(b, rng, { x: -33, z: 5, w: 14, d: 7, wall: '#7c8478', roof: '#4c5156', door: 's', floors: 1, flat: true, floorColor: '#7a7468' });
  K.house(b, rng, { x: -33, z: 19, w: 14, d: 7, wall: '#7c8478', roof: '#4c5156', door: 'n', floors: 1, flat: true, floorColor: '#7a7468' });
  K.sandbags(b, -24.5, 12, 3.4, Math.PI / 2);
  K.crate(b, -38, 12, 1.1); K.crate(b, -36.9, 12.2, 1.0); K.barrel(b, -40, 11, '#556b2f'); K.barrel(b, -40, 13, '#556b2f');
  K.car(b, { x: -29, z: 12.4, ry: Math.PI / 2, color: '#5e6b4a' });
  K.lamp(b, -26, 12);

  // ───────── Akaryakıt deposu (doğu) ─────────
  K.gasStation(b, rng, { x: 33, z: -4 });
  for (const tx of [27, 33, 39]) M.fuelTank(b, { x: tx, z: -21, r: 2.8, h: 5 });
  b.box(33, 0.3, -17.6, 12.5, 0.25, 0.3, '#c0392b', { collide: false });               // boru hattı
  K.truck(b, { x: 40, z: -12, ry: Math.PI / 2, color: '#a8a8a0', cargo: '#d6d9d4' });
  K.barrel(b, 24.5, -12, '#c0392b'); K.barrel(b, 24.5, -13.1, '#c0392b'); K.barrel(b, 25.6, -12.5, '#d9a921');
  K.sandbags(b, 24.5, -8, 3.6, Math.PI / 2);
  K.lamp(b, 26, -9);

  // ───────── Bunkerler ─────────
  M.bunker(b, { x: -19, z: -15, ry: -Math.PI / 2 });
  M.bunker(b, { x: -17, z: 17, ry: -Math.PI / 2 });
  M.bunker(b, { x: 19, z: 15, ry: Math.PI / 2 });
  M.bunker(b, { x: 17, z: -17, ry: Math.PI / 2 });

  // ───────── Konteyner siperleri / nişancı yuvaları ─────────
  const cont = [
    [-22, -4, 0, '#8a6a2d'], [22, 4, 0, '#2d5a8a'], [-28, -29, 0, '#556b2f'], [28, 29, 0, '#8a3a2d'],
    [-34, -38, Math.PI / 2, '#2d5a8a'], [34, 38, Math.PI / 2, '#8a6a2d'],
  ];
  for (const [x, z, ry, c] of cont) K.container(b, { x, z, ry, color: c });
  K.container(b, { x: -22, z: -4, y: 2.6, ry: 0, color: '#556b2f' });
  K.container(b, { x: 22, z: 4, y: 2.6, ry: 0, color: '#8a3a2d' });
  for (const [x, z, ry] of [[-14, -4.5, 0], [14, 4.5, 0], [-28, 4, 0], [28, -4, 0], [-8, 20, 0], [8, -20, 0], [-40, -20, Math.PI / 2], [40, 20, Math.PI / 2]]) K.barrier(b, x, z, ry);
  for (const [x, z] of [[-26, 28], [26, -28], [-14, 11], [14, -11]]) { K.crate(b, x, z, 1.2); K.crate(b, x + 1.3, z + 0.1, 1.0); K.barrel(b, x - 1.2, z, '#556b2f'); }
  for (const [x, z] of [[-9, 14], [9, -14], [-20, -28], [20, 28]]) K.lamp(b, x, z);

  // ───────── Dış manzara (çevre dağlar) ─────────
  const peak = ['#53624f', '#485544', '#5d6a57', '#4d5c4c'];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rng() * 0.2, R = 135 + rng() * 55;
    const sc = 28 + rng() * 26;
    b.ico(Math.cos(a) * R * 1.25, -6, Math.sin(a) * R * 0.95, sc, peak[i % 4], { scale: [1.5, 0.75 + rng() * 0.35, 1.1], detail: 1, ry: rng() * 3 });
  }
  for (let i = 0; i < 140; i++) {
    const a = rng() * Math.PI * 2, R = 78 + rng() * 55;
    const x = Math.cos(a) * R * 1.12, z = Math.sin(a) * R * 0.88;
    if (Math.abs(x) < 70 && Math.abs(z) < 54) continue;
    K.pine(b, rng, x, z, 0.9 + rng() * 0.9);
  }

  // ───────── Doğuş noktaları & hedefler ─────────
  const spawns = { blue: [], red: [] };
  for (let i = 0; i < 12; i++) {
    const row = i % 2, col = Math.floor(i / 2);
    spawns.blue.push({ x: -58 + row * 3.5, z: -9 + col * 3.6, ry: -Math.PI / 2 });
    spawns.red.push({ x: 58 - row * 3.5, z: -7 + col * 3.6, ry: Math.PI / 2 });
  }
  const objectives = [
    { id: 'hangar', name: 'Hangar', x: 0, z: -33, r: 10, core: true },
    { id: 'komuta', name: 'Komuta Binası', label: 'M', x: 0, z: 0, r: 11, core: true },
    { id: 'radar', name: 'Radar', x: 0, z: 34, r: 9, core: true },
    { id: 'kisla', name: 'Kışla', x: -30, z: 12, r: 9 },
    { id: 'akaryakit', name: 'Akaryakıt', label: 'Y', x: 33, z: -12, r: 9 },
  ];

  return {
    id: 'us',
    name: 'Askeri Üs',
    group: b.build(),
    colliders: b.colliders,
    bounds: US_BOUNDS,
    spawns,
    objectives,
    roads: [{ x0: -64, z0: -4.5, x1: 64, z1: 4.5 }, { x0: -4, z0: -48, x1: 4, z1: 48 }],
    roadColor: '#4a4d52',
    env: {
      sky: ['#6f7f8e', '#a3b0ba', '#cfd2cf'], fog: ['#b7bfc3', 110, 330],
      sun: ['#eef1f5', 1.9], hemi: ['#cfd8e3', '#6d705f', 1.15], cloud: '#d3d7da', clouds: 26,
      sunPos: [45, 80, 30],
    },
  };
}
