import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import { Terrain, fbm, smoothstep, mixf, WATER_LEVEL } from './terrain.js';

// Harita 2 — VADİ
// Doğu-batı uzanan vadi; ortada kuzey-güney akan nehir, tek köprü ve iki sığ geçit.
// Batıda Mavi çiftlik, doğuda Kırmızı çiftlik. Kuzey ve güney sırtlarda ormanlar, kayalar ve gözetleme noktaları.
// Uzun mesafe + yamaç savaşı: keskin nişancılar için sırtlar, yakın çatışma için köprü ve geçitler.

export const VADI_BOUNDS = { minX: -80, maxX: 80, minZ: -54, maxZ: 54 };

const RIVER_W = 3.4;
const riverX = (z) => 2.6 * Math.sin(z * 0.045);

// Düzlük alanlar: [x, z, düz yarıçap, geçiş, hedef yükseklik(null = doğal yükseklik)]
const SITES = [
  { id: 'mavi', x: -62, z: 0, r: 30, fall: 12, y: 1.4 },
  { id: 'kirmizi', x: 62, z: 2, r: 30, fall: 12, y: 1.4 },
  { id: 'ambar', x: -32, z: 22, r: 14, fall: 8, y: null },
  { id: 'degirmen', x: 32, z: -22, r: 14, fall: 8, y: null },
  { id: 'tepe', x: -17, z: -40, r: 9, fall: 8, y: null },
  { id: 'kamp', x: 17, z: 40, r: 10, fall: 8, y: null },
];

function baseHeight(x, z) {
  let h = 0.9 + (fbm(x * 0.018, z * 0.018, 7, 3) - 0.5) * 4.2 + (fbm(x * 0.07, z * 0.07, 11, 2) - 0.5) * 1.1;
  // kuzey (z<0) ve güney (z>0) sırtlar
  const nr = smoothstep(-24, -58, z), sr = smoothstep(26, 60, z);
  h += nr * (11 + 7 * fbm(x * 0.022, z * 0.022, 3, 3)) + sr * (9 + 7 * fbm(x * 0.022 + 50, z * 0.022, 5, 3));
  // sınır dışı: dağlar
  const ox = Math.max(0, Math.abs(x) - 84), oz = Math.max(0, Math.abs(z) - 58);
  h += Math.min(70, (ox + oz) * 0.6 + (fbm(x * 0.03, z * 0.03, 9, 3) - 0.4) * Math.min(1, (ox + oz) / 30) * 14);
  return Math.max(h, 0.35);
}

const siteTarget = SITES.map((s) => (s.y == null ? Math.round(baseHeight(s.x, s.z) * 10) / 10 : s.y));

function plateau(h, x, z) {
  for (let i = 0; i < SITES.length; i++) {
    const s = SITES[i], d = Math.hypot(x - s.x, z - s.z);
    const w = 1 - smoothstep(s.r, s.r + s.fall, d);
    if (w > 0) h = mixf(h, siteTarget[i], w);
  }
  return h;
}

export function vadiHeight(x, z) {
  let h = plateau(baseHeight(x, z), x, z);
  const dx = x - riverX(z);
  // yol: doğu-batı toprak yol, nehir kanalının dışında düzleştirilir
  const roadW = (1 - smoothstep(3.6, 8, Math.abs(z))) * smoothstep(4.6, 8, Math.abs(dx)) * (1 - smoothstep(66, 80, Math.abs(x)));
  h = mixf(h, 0.2, roadW);
  // nehir kanyonu: sırtların içinden geçer; yatak vadi tabanında -2.8, sırtlara doğru yavaşça yükselir
  const wr = Math.exp(-(dx * dx) / (2 * RIVER_W * RIVER_W));
  const bed = -2.8 + 0.17 * Math.max(0, Math.abs(z) - 30);
  h = mixf(h, Math.min(h, bed), Math.min(1, wr * 1.15));
  // sığ geçitler (yürünebilir, üstünden su akar)
  for (const fz of [-26, 26]) {
    const w = (1 - smoothstep(3.5, 6.5, Math.abs(z - fz))) * (1 - smoothstep(7, 11, Math.abs(dx)));
    if (w > 0) h = mixf(h, Math.max(h, -0.14), w);
  }
  return h;
}

export function buildVadi() {
  const b = new MapBuilder();
  const rng = makeRng(2024);
  const H = vadiHeight;
  const G = (x, z, fn) => b.with(0, H(x, z), 0, 0, fn);

  // ───────── Arazi ─────────
  const terrain = new Terrain({ minX: -190, maxX: 190, minZ: -164, maxZ: 164, cell: 3, height: H });
  const tmp = new THREE.Color();
  const grassA = new THREE.Color('#8aa84e'), grassB = new THREE.Color('#6f9040'), dirt = new THREE.Color('#b69364'), forest = new THREE.Color('#587a36');
  const rock = new THREE.Color('#8b877d'), snow = new THREE.Color('#d9dbd8'), yard = new THREE.Color('#a58f5e'), sand = new THREE.Color('#b9a97c'), field = new THREE.Color('#c9b25a');
  const terrainMesh = terrain.buildMesh((x, z, h, slope, c) => {
    const n = fbm(x * 0.05, z * 0.05, 4, 2);
    c.copy(grassA).lerp(grassB, n);
    const az = Math.abs(z), dx = x - riverX(z);
    if (h < WATER_LEVEL + 0.25) c.copy(sand).lerp(rock, 0.2 + n * 0.2);
    else if (az < 3.8 && Math.abs(x) < 74 && Math.abs(dx) > 5) c.copy(dirt).lerp(yard, n * 0.4);
    for (const s of SITES) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < s.r) c.lerp(s.id === 'mavi' || s.id === 'kirmizi' ? yard : dirt, 0.55 * (1 - d / s.r) + 0.1);
    }
    // tarlalar (doğu-batı yamaçlarında altın sarısı yamalar)
    if (az > 8 && az < 30 && n > 0.62 && h < 3) c.lerp(field, 0.6);
    c.lerp(forest, smoothstep(26, 48, az) * 0.75);
    if (slope > 0.5) c.lerp(rock, Math.min(1, (slope - 0.5) * 2.4));
    if (h > 24) c.lerp(rock, smoothstep(24, 34, h));
    if (h > 44) c.lerp(snow, smoothstep(44, 58, h));
    const fr = (((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1;
    c.multiplyScalar(0.93 + 0.14 * fr);
  });

  // ───────── Nehir (su şeridi) ─────────
  const wpos = [], widx = [];
  for (let z = -170, i = 0; z <= 170; z += 5, i++) {
    const cx = riverX(z);
    wpos.push(cx - 12, WATER_LEVEL, z, cx + 12, WATER_LEVEL, z);
    if (i > 0) { const a = (i - 1) * 2; widx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wg.setIndex(widx);
  wg.computeVertexNormals();
  const water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: '#4a9fc6', transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }));

  // ───────── Köprü (z=0) ─────────
  const bx = riverX(0);
  b.box(bx, -0.3, 0, 19, 0.65, 6.6, '#9a8f7e', { tag: 'deck' });                                   // taş tabliye (üst 0.35)
  b.box(bx, 0.34, 0, 19.2, 0.04, 5.6, '#8b6a45', { collide: false });             // tahta kaplama
  for (const sz of [-3.1, 3.1]) {
    b.box(bx, 0.35, sz, 19, 1.0, 0.4, '#8f8575', { tag: 'rail' });                                   // korkuluk duvarı
    for (let i = -4; i <= 4; i++) b.box(bx + i * 2.2, 1.35, sz, 0.5, 0.25, 0.5, '#6f685c', { collide: false });
  }
  for (const px of [-5.5, 0, 5.5]) b.box(bx + px, -3.4, 0, 1.6, 3.2, 6.4, '#8a8070', { collide: false });  // ayaklar
  // kapıyı kapatma: korkuluklar yalnız yan taraflarda, uçlar açık

  // ───────── Ortak yardımcılar ─────────
  const boulder = (x, z, s = 1) => {
    const y = H(x, z);
    b.ico(x, y + 0.35 * s, z, 0.95 * s, rng() > 0.5 ? '#8a8a84' : '#76766f', { scale: [1.35, 0.85, 1.05], detail: 0, ry: rng() * 3 });
    b.collide(x, y, z, 1.9 * s, 1.0 * s, 1.5 * s);
  };
  const log = (x, z, len = 4, ry = 0) => {
    const y = H(x, z);
    b.cyl(x, y + 0.32, z, 0.32, 0.32, len, '#6e4a2a', { rx: Math.PI / 2, ry, center: true, seg: 7, collide: false });
    b.with(x, y, z, ry, () => b.collide(0, 0, 0, 0.7, 0.62, len));
  };
  const stoneWall = (x0, z0, x1, z1, h = 0.95) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.4));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const ry = Math.atan2(-(x1 - x0), -(z1 - z0)) + Math.PI / 2;
      b.with(x, H(x, z) - 0.15, z, ry, () => b.box(0, 0, 0, 1.45, h + 0.15, 0.55, i % 2 ? '#8e897c' : '#9a9486'));
    }
  };

  // ───────── MAVİ ÇİFTLİK (batı, plato) ─────────
  G(-62, 0, () => {
    K.barn(b, rng, { x: -72, z: -14, color: '#8f3b2e', roof: '#5f646c' });
    K.silo(b, -58, -22);
    K.house(b, rng, { x: -62, z: 20, w: 10, d: 8, wall: '#d6cfb4', roof: '#7a3b2e', door: 'n', floors: 1 });
    for (let i = 0; i < 6; i++) K.hayBale(b, -50 + (i % 3) * 1.3, -17 + Math.floor(i / 3) * 1.3);
    K.sandbags(b, -46, 11, 4.5, 0); K.sandbags(b, -46, -11, 4.5, 0); K.sandbags(b, -49.5, 13.5, 3, Math.PI / 2);
    K.crate(b, -69, 8, 1.1); K.crate(b, -69, 9.2, 1.1); K.crate(b, -69, 8.6, 0.9, 1.1);
    K.barrel(b, -66, 10, '#2c5aa0'); K.barrel(b, -65.2, 10.4, '#2c5aa0'); K.barrel(b, -45, -6, '#c0392b');
    K.truck(b, { x: -52, z: 22, ry: 0, color: '#2c5aa0', cargo: '#cdd2d8' });
    K.watchtower(b, { x: -45, z: -22, ry: 0, color: '#6e5232' });
    K.fence(b, -78, 26, -46, 26); K.fence(b, -78, -28, -46, -28);
  });

  // ───────── KIRMIZI ÇİFTLİK (doğu, plato) ─────────
  G(62, 2, () => {
    K.barn(b, rng, { x: 72, z: 18, color: '#4f6b4a', roof: '#5a4f48' });
    K.silo(b, 58, 26); K.silo(b, 62.5, 26.5, 2, 9);
    K.house(b, rng, { x: 62, z: -18, w: 10, d: 8, wall: '#d9c79a', roof: '#a8432f', door: 's', floors: 1 });
    for (let i = 0; i < 6; i++) K.hayBale(b, 48 + (i % 3) * 1.3, 18 + Math.floor(i / 3) * 1.3);
    K.sandbags(b, 46, 7, 4.5, 0); K.sandbags(b, 46, 17, 4.5, 0); K.sandbags(b, 49.5, 5, 3, Math.PI / 2);
    K.crate(b, 69, -8, 1.1); K.crate(b, 69, -9.2, 1.1); K.crate(b, 69, -8.6, 0.9, 1.1);
    K.barrel(b, 66, -10, '#c0392b'); K.barrel(b, 65.2, -10.4, '#c0392b'); K.barrel(b, 45, 14, '#d9a921');
    K.truck(b, { x: 52, z: -22, ry: Math.PI, color: '#a8281f', cargo: '#b9bec4' });
    K.watchtower(b, { x: 45, z: 26, ry: Math.PI, color: '#6e5232' });
    K.fence(b, 46, -28, 78, -28); K.fence(b, 46, 30, 78, 30);
  });

  // ───────── Objektif 1: KÖPRÜ ─────────
  b.with(bx, 0.35, 0, 0, () => {
    K.car(b, { x: -4, z: 1.0, ry: 0.0, color: '#b33a2a', wreck: true });
    K.car(b, { x: 4.5, z: -1.2, ry: Math.PI, color: '#4a7a4f' });
  });
  for (const [sx, sz, ry] of [[-12, -3, Math.PI / 2], [-12, 3, Math.PI / 2], [12, -3, Math.PI / 2], [12, 3, Math.PI / 2]]) G(bx + sx, sz, () => K.sandbags(b, bx + sx, sz, 3, ry));
  G(bx - 16, 0, () => K.barrier(b, bx - 16, -1.2, 0.3)); G(bx + 16, 0, () => K.barrier(b, bx + 16, 1.2, -0.3));

  // ───────── Objektif 2: AMBAR (batı-güney) ─────────
  G(-32, 22, () => {
    K.barn(b, rng, { x: -32, z: 22, w: 10, d: 14, color: '#7a5a38', roof: '#6a5a4a' });
    for (let i = 0; i < 5; i++) K.hayBale(b, -42 + (i % 3) * 1.3, 14 + Math.floor(i / 3) * 1.3);
    K.crate(b, -24, 14, 1.1); K.crate(b, -22.8, 14.2, 1.0);
    K.fence(b, -45, 30, -26, 30);
  });
  stoneWall(-44, 12, -44, 34); stoneWall(-44, 34, -22, 34);

  // ───────── Objektif 3: DEĞİRMEN (doğu-kuzey) ─────────
  G(32, -22, () => {
    K.house(b, rng, { x: 32, z: -22, w: 9, d: 8, wall: '#c2bba9', roof: '#6b4a3a', door: 's', floors: 2, floorColor: '#a58a68' });
    // su çarkı (dekor) + değirmen taşları + çuvallar
    b.cyl(36.9, 3.2, -22, 2.4, 2.4, 0.7, '#6e4a2a', { rz: Math.PI / 2, center: true, seg: 12, collide: false });
    b.cyl(36.9, 3.2, -22, 0.4, 0.4, 1.0, '#4a3220', { rz: Math.PI / 2, center: true, seg: 8, collide: false });
    for (let i = 0; i < 4; i++) b.box(25 + i * 1.1, 0, -15.5, 0.9, 0.55 + (i % 2) * 0.2, 0.7, '#cfc4a1');
    b.cyl(27, 0, -29, 1.3, 1.3, 0.45, '#9a948a', { seg: 10 });
    b.cyl(30.5, 0, -29.5, 1.3, 1.3, 0.45, '#8a8479', { seg: 10 });
    K.crate(b, 40, -16, 1.1); K.crate(b, 41.2, -15.8, 1.0); K.barrel(b, 25, -28, '#2c5aa0');
  });
  stoneWall(18, -34, 18, -12); stoneWall(18, -12, 46, -12);

  // ───────── Objektif 4: GÖZETLEME TEPESİ (kuzey sırt) ─────────
  G(-17, -40, () => {
    K.watchtower(b, { x: -17, z: -40, ry: 0, color: '#6e5232' });
    K.sandbags(b, -21.5, -36, 4, 0); K.sandbags(b, -12.5, -36, 4, 0); K.sandbags(b, -23, -41, 3, Math.PI / 2);
    K.crate(b, -13, -44, 1.1); K.barrel(b, -20, -44, '#4d5b3a');
  });
  for (const [x, z, s] of [[-25, -37, 1.6], [-8, -35, 1.3], [-21, -48, 2.2], [-6, -44, 1.5], [-31, -42, 1.8]]) boulder(x, z, s);
  log(-19, -33, 5, 0.5); log(-11, -47, 4, -0.4);

  // ───────── Objektif 5: ORMAN KAMPI (güney sırt) ─────────
  G(17, 40, () => {
    K.house(b, rng, { x: 12, z: 41, w: 6.5, d: 5.5, wall: '#8b5a2b', roof: '#4d5b3a', door: 'n', floors: 1, furnishing: false });
    K.house(b, rng, { x: 23, z: 44, w: 6.5, d: 5.5, wall: '#7d5126', roof: '#3f4a30', door: 'w', floors: 1, furnishing: false });
    // çadırlar
    for (const [tx, tz] of [[17, 34], [21, 36]]) {
      b.prism(tx, 0, tz, 3.4, 2.0, 4, '#c7b98a', {});
      b.collide(tx, 0, tz, 3.2, 1.8, 3.8);
    }
    // kamp ateşi
    b.cyl(18, 0, 41, 0.45, 0.55, 0.25, '#555', { seg: 8 });
    b.cyl(18, 0.25, 41, 0.02, 0.28, 0.6, '#ff8a2a', { seg: 5, collide: false, o: { emissive: '#ff7a1a', emissiveIntensity: 1.3 } });
    K.crate(b, 15, 46, 1.1); K.crate(b, 16.2, 46.2, 1.0);
  });
  for (const [x, z, s] of [[7, 36, 1.7], [29, 38, 1.5], [27, 48, 2.0]]) boulder(x, z, s);
  log(18, 38, 3.2, 1.57); log(19.5, 44, 3.2, 1.2);

  // ───────── Taş duvarlar ve rastgele kaya/kütük ─────────
  stoneWall(-44, -34, -26, -34); stoneWall(-26, -34, -26, -20);
  stoneWall(26, 34, 46, 34); stoneWall(46, 34, 46, 22);

  // ───────── Ağaçlar ─────────
  const taken = [
    ...SITES.map((s) => [s.x, s.z, s.r + 2]),
    [0, 0, 14], [bx, 26, 12], [bx, -26, 12],
  ];
  const okTree = (x, z) => {
    const h = H(x, z);
    if (h < 0.25) return false;
    if (Math.abs(z) < 5.5 && Math.abs(x) < 78) return false;
    if (terrain.slopeAt(x, z, 1) > 0.8) return false;
    return !taken.some(([tx, tz, r]) => Math.hypot(x - tx, z - tz) < r);
  };
  let nTrees = 0;
  for (let i = 0; i < 4200 && nTrees < 1100; i++) {
    const x = -125 + rng() * 250, z = -105 + rng() * 210;
    if (!okTree(x, z)) continue;
    const az = Math.abs(z);
    const dens = Math.max(0.05, smoothstep(18, 46, az)) * (az > 90 ? 0.6 : 1) * (Math.abs(x) > 85 ? 0.7 : 1);
    if (rng() > dens * 0.9 + 0.06) continue;
    const h = H(x, z);
    if (h > 40) continue;
    const s = 0.9 + rng() * 0.8;
    if (rng() > (az > 30 ? 0.18 : 0.5)) K.pine(b, rng, x, z, s, h); else K.oak(b, rng, x, z, s * 0.95, h);
    nTrees++;
  }
  // çalılar & kayalar
  for (let i = 0; i < 160; i++) {
    const x = -80 + rng() * 160, z = -56 + rng() * 112;
    if (!okTree(x, z)) continue;
    b.ico(x, H(x, z) + 0.35, z, 0.75 + rng() * 0.5, rng() > 0.5 ? '#4f7a33' : '#5d8a3a', { scale: [1.2, 0.8, 1.2] });
  }
  for (let i = 0; i < 40; i++) {
    const x = -80 + rng() * 160, z = -56 + rng() * 112;
    if (okTree(x, z) && Math.abs(z) > 14) boulder(x, z, 0.9 + rng() * 1.6);
  }

  // ───────── Doğuş noktaları & hedefler ─────────
  const spawns = { blue: [], red: [] };
  for (let i = 0; i < 12; i++) {
    const row = i % 2, col = Math.floor(i / 2);
    spawns.blue.push({ x: -58 + row * 3.5, z: -9 + col * 3.6, ry: -Math.PI / 2 });
    spawns.red.push({ x: 58 - row * 3.5, z: -7 + col * 3.6, ry: Math.PI / 2 });
  }
  const objectives = [
    { id: 'ambar', name: 'Ambar', x: -32, z: 22, r: 10 },
    { id: 'tepe', name: 'Gözetleme Tepesi', x: -17, z: -40, r: 9, core: true },
    { id: 'kopru', name: 'Köprü', x: bx, z: 0, r: 11, core: true },
    { id: 'kamp', name: 'Orman Kampı', x: 17, z: 40, r: 10, core: true },
    { id: 'degirmen', name: 'Değirmen', x: 32, z: -22, r: 10 },
  ];

  const group = b.build();
  group.add(terrainMesh);
  group.add(water);

  return {
    id: 'vadi',
    name: 'Vadi',
    group,
    colliders: b.colliders,
    bounds: VADI_BOUNDS,
    terrain,
    spawns,
    objectives,
    roads: [{ x0: -76, z0: -3.5, x1: 76, z1: 3.5 }],
    roadColor: '#b69364',
    env: {
      sky: ['#5f9fdc', '#c3dcef', '#f6e9cf'], fog: ['#e8e4d2', 170, 430],
      sun: ['#ffe0ae', 2.8], hemi: ['#cfe3ff', '#8f7d52', 1.1], cloud: '#fff6e8', clouds: 22,
      sunPos: [75, 70, 30],
    },
  };
}
