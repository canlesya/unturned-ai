import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as T from './kitTown.js';
import { COL } from './kit.js';

// Harita 1 — KASABA (v2)
// 168 × 116 m. Mavi çiftlik avlusu (batı) ve Kırmızı depo avlusu (doğu) yüksek taş duvarlarla çevrili: düşman doğuş noktasına görüş hattı yok.
// Her avlunun 3 çıkışı var: ana cadde kapısı (kontrol noktası şikânı ile görüş kesik) + kuzey/güney tarla kapıları.
// Yerleşim 180° dönel simetriktir (batı yarı + dönmüş doğu yarı, farklı bina çeşitleri): KB 'Evler' ↔ GD 'Pazar', GB 'Kilise' ↔ KD 'Benzinlik'.
// Çatı/kule keskin nişancı noktaları: su kuleleri, kilise çan kulesi, belediye/pazar/okul çatıları, gözetleme kuleleri.

export const KASABA_BOUNDS = { minX: -84, maxX: 84, minZ: -58, maxZ: 58 };
const BLUE_ZONE = { minX: -83, maxX: -62, minZ: -20, maxZ: 20 };
const RED_ZONE = { minX: 62, maxX: 83, minZ: -20, maxZ: 20 };

// Bina çeşitleri: V.A (batı yarı) / V.B (dönmüş doğu yarı)
const VA = { yard: 'farm', nwB1: 'school', nwB2: 'houses', nwB3: 'townhall', swB1: 'garage', swB2: 'church', swB3: 'park', tint: 0 };
const VB = { yard: 'depot', nwB1: 'police', nwB2: 'market', nwB3: 'bank', swB1: 'workshop', swB2: 'gas', swB3: 'parking', tint: 1 };

export function buildKasaba() {
  const b = new MapBuilder();
  const rng = makeRng(1337);
  const climb = [];     // tırmanma probu için hedefler ({name,x,y,z,entry})
  const reg = (info, name) => {
    if (!info) return;
    for (const t of info.targets || []) climb.push({ name: `${name}:${t.name || t.room}`, x: t.x, y: t.y, z: t.z, entry: info.entry });
  };

  // ───────── Zemin ─────────
  b.box(0, -1.0, 0, 900, 1.0, 900, COL.grass, { collide: false });
  const patchCols = ['#88a04f', '#738a3f', '#8d9a52', '#76903f'];
  for (let i = 0; i < 120; i++) b.box(-82 + rng() * 164, 0, -56 + rng() * 112, 4 + rng() * 9, 0.025, 4 + rng() * 9, patchCols[i % 4], { collide: false });

  const roads = [];
  const car = (x, z, ry, color, wreck = false) => K.car(b, { x, z, ry, color, wreck });
  const palette = ['#b33a2a', '#2c5aa0', '#e8e8e4', '#4a7a4f', '#d9a921', '#6a6d73'];
  half(VA, false);
  b.with(0, 0, 0, Math.PI, () => half(VB, true));
  center();
  surround();

  // ───────── Doğuş noktaları ─────────
  const spawns = {
    blue: pickSpawns(BLUE_ZONE, -Math.PI / 2, 20, 1),
    red: pickSpawns(RED_ZONE, Math.PI / 2, 20, -1),
  };
  const objectives = [
    { id: 'evler', core: true, name: 'Evler', x: -35, z: -17, r: 9 },
    { id: 'kilise', name: 'Kilise', x: -36, z: 14, r: 9 },
    { id: 'kavsak', core: true, name: 'Kavşak', x: 0, z: 0, r: 9 },
    { id: 'benzinlik', name: 'Benzinlik', x: 36, z: -14, r: 9 },
    { id: 'pazar', core: true, name: 'Pazar', x: 35, z: 17, r: 9 },
  ];

  return {
    id: 'kasaba',
    name: 'Kasaba',
    group: b.build(),
    colliders: b.colliders,
    bounds: KASABA_BOUNDS,
    baseZones: { blue: { ...BLUE_ZONE }, red: { ...RED_ZONE } },
    roads,
    spawns,
    objectives,
    climb,
  };

  // ═════════ yardımcılar ═════════
  function road(x0, z0, x1, z1, color = COL.asphalt, mini = true) {
    b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.06, z1 - z0, color, { collide: false });
    if (mini && color === COL.asphalt) roads.push({ x0, z0, x1, z1 });
  }
  function walk(x0, z0, x1, z1) { b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.16, z1 - z0, COL.curb); }
  function dashX(x0, x1, z, step = 4) { for (let x = x0; x <= x1; x += step) b.box(x, 0.06, z, 2, 0.02, 0.2, COL.yellow, { collide: false }); }
  function dashZ(z0, z1, x, step = 4) { for (let z = z0; z <= z1; z += step) b.box(x, 0.06, z, 0.2, 0.02, 2, COL.yellow, { collide: false }); }
  // ═════════ yarım harita (x<0 çerçevesi) ═════════
  function half(V, east) {
    const taken = [];       // ağaç/çalı yasak dikdörtgenler
    const occ = (x0, z0, x1, z1, m = 1.5) => taken.push([x0 - m, z0 - m, x1 + m, z1 + m]);
    const free = (x, z) => !taken.some(([a, c, d, e]) => x > a && x < d && z > c && z < e);

    // ── yollar ──
    road(-62, -5, 0, 5);                         // ana cadde
    road(-4, -58, 0, 58);                        // orta cadde
    road(-77, -34, -4, -26); road(-77, 26, -4, 34);        // kuzey / güney sokak
    road(-49, -26, -45, -5); road(-26, -26, -22, -5);      // yan sokaklar (kuzey)
    road(-49, 5, -45, 26); road(-26, 5, -22, 26);          // yan sokaklar (güney)
    road(-74, -34, -70, -20.5, COL.dirt, false); road(-74, 20.5, -70, 34, COL.dirt, false);   // avlu çıkış yolları
    b.box(-72.5, 0, 0, 21, 0.035, 41, COL.dirt, { collide: false });                          // avlu zemini
    occ(-62, -5, 0, 5, 0.5); occ(-4, -58, 0, 58, 0.5); occ(-77, -34, -4, -26, 0.5); occ(-77, 26, -4, 34, 0.5);
    occ(-49, -26, -45, 26, 0.5); occ(-26, -26, -22, 26, 0.5); occ(-84, -21, -61, 21, 0);
    // kaldırımlar + çizgiler
    walk(-61, 5, -6, 7); walk(-61, -7, -6, -5);
    for (const [za, zb] of [[-58, -34], [-26, -7], [7, 26], [34, 58]]) walk(-6, za, -4, zb);
    dashX(-60, -4, 0); dashZ(-56, -6, -2); dashZ(6, 56, -2);
    for (const s of [-4.5, 4.5]) b.box(-33, 0.06, s, 58, 0.02, 0.16, COL.white, { collide: false });
    for (let k = 0; k < 8; k++) { b.box(-8, 0.06, -3.5 + k, 0.55, 0.02, 1.0, COL.white, { collide: false, ry: Math.PI / 2 }); }
    for (const sz of [-30, 30]) dashX(-76, -6, sz);

    yard(V);
    chicane();
    nwQuarter(V, occ);
    swQuarter(V, occ);
    streetProps(V);
    fields(V, occ, free);
  }

  // ───────── avlu (spawn): taş duvarlar, 3 çıkış ─────────
  function yard(V) {
    const depot = V.yard === 'depot';
    const wc = depot ? '#8a8d90' : '#a39a82', cap = depot ? '#6a6d72' : '#847b64';
    const W = { h: 2.9, t: 0.5, color: wc, cap };
    T.wallStone(b, rng, -83.75, -20.5, -83.75, 20.5, W);
    T.wallStone(b, rng, -84, -20.25, -61.5, -20.25, { ...W, gaps: [{ at: -72, w: 4 }] });
    T.wallStone(b, rng, -84, 20.25, -61.5, 20.25, { ...W, gaps: [{ at: -72, w: 4 }] });
    T.wallStone(b, rng, -61.75, -20.5, -61.75, 20.5, { ...W, gaps: [{ at: 0, w: 6 }] });
    // kapı sancakları (takım rengi)
    const flag = depot ? '#d63a2b' : '#2b6fd6';
    for (const [fx, fz] of [[-61.75, -3.6], [-61.75, 3.6]]) { b.box(fx, 2.9, fz, 0.2, 2.2, 0.2, '#4a4d52', { collide: false }); b.box(fx - 0.7, 4.3, fz, 1.2, 0.8, 0.06, flag, { collide: false }); }
    for (const gx of [-74, -70]) for (const gz of [-20.25, 20.25]) b.box(gx, 2.9, gz, 0.3, 1.0, 0.3, flag, { collide: false });
    if (!depot) {
      reg(K.barn(b, rng, { x: -75, z: -12.3, w: 10, d: 14, ry: Math.PI / 2, doors: 'front' }), 'ciftlik-ambar');
      reg(K.house(b, rng, { x: -75, z: 12.5, w: 10, d: 8, floors: 2, door: 'n', wall: '#d6cfb4', roof: '#7a3b2e' }), 'ciftlik-ev');
      K.silo(b, -79.5, 0.5, 2.0, 10);
      for (let i = 0; i < 5; i++) K.hayBale(b, -76 + (i % 3) * 1.3, 4 + Math.floor(i / 3) * 1.3);
      K.hayBale(b, -75.4, 4.65, 1.2);
      K.truck(b, { x: -67, z: 14.5, ry: Math.PI / 2, color: '#2c5aa0', cargo: '#cdd2d8' });
      K.sandbags(b, -66.5, -10.5, 4.5, Math.PI / 2);
      K.sandbags(b, -66.5, 8.5, 3.6, Math.PI / 2);
      for (const [cx, cz, s, y] of [[-64, -15, 1.1, 0], [-64, -13.8, 1.1, 0], [-64, -14.4, 0.9, 1.1]]) K.crate(b, cx, cz, s, y);
      b.cyl(-70, 0, -4, 0.9, 1.0, 0.9, '#8a867c', { seg: 8 });                          // kuyu
      K.barrel(b, -64, 17.5, '#2c5aa0'); K.barrel(b, -64.8, 18, '#2c5aa0'); K.barrel(b, -64.2, -17.8, '#c0392b');
      K.dumpster(b, -80.5, 17.5, 0);
      K.fence(b, -73, 2.5, -73, 8); K.fence(b, -73, 2.5, -68, 2.5);
      K.lamp(b, -64, -4, Math.PI); K.lamp(b, -64, 4, Math.PI); K.lamp(b, -69, 18.5, 0);
    } else {
      reg(K.warehouse(b, rng, { x: -75, z: -11, w: 14, d: 12, ry: Math.PI / 2 }), 'depo-ic');
      reg(K.house(b, rng, { x: -75, z: 14, w: 9, d: 6, floors: 1, door: 'n', flat: true, theme: 'office', wall: '#aeb2b8', roof: '#6a6d73' }), 'depo-ofis');
      K.container(b, { x: -79, z: 5.5, ry: 0, color: '#c0392b' }); K.container(b, { x: -79, z: 5.5, y: 2.6, ry: 0, color: '#d9a921' });
      K.container(b, { x: -71, z: 5.5, ry: 0, color: '#3b6a9a' });
      K.container(b, { x: -67.5, z: -13, ry: Math.PI / 2, color: '#4a7a4f' });
      K.truck(b, { x: -66.5, z: 15, ry: Math.PI / 2, color: '#a8281f', cargo: '#b9bec4' });
      K.sandbags(b, -66.5, -6.5, 4.0, Math.PI / 2); K.sandbags(b, -66.5, 7.5, 3.4, Math.PI / 2);
      for (const [cx, cz, s, y] of [[-64, 9.2, 1.1, 0], [-62.9, 9.4, 1.0, 0], [-64, 10.4, 0.9, 1.1]]) K.crate(b, cx, cz, s, y);
      K.barrel(b, -64, -17, '#c0392b'); K.barrel(b, -64.8, -17.5, '#d9a921'); K.barrel(b, -63.6, -16.3, '#c0392b');
      K.barrier(b, -69, -17.6, 0); K.barrier(b, -69, 17.6, 0);
      K.lamp(b, -64, -4, Math.PI); K.lamp(b, -64, 4, Math.PI); K.lamp(b, -69, -18.5, 0);
    }
  }

  // ───────── ana cadde kontrol noktası (görüşü keser, S-şikân) ─────────
  function chicane() {
    K.container(b, { x: -54, z: -2.0, ry: Math.PI / 2, color: '#3b6a9a' });
    K.container(b, { x: -46, z: 2.0, ry: Math.PI / 2, color: '#d9a921' });
    K.barrier(b, -58.5, 3.6, Math.PI / 2); K.barrier(b, -50, -3.8, 0); K.sandbags(b, -57, -3.4, 3.0, 0);
    T.wallStone(b, rng, -54, -9.4, -54, -5.1, { h: 2.4, t: 0.5, color: '#9a968c' }); T.wallStone(b, rng, -46, 5.1, -46, 9.4, { h: 2.4, t: 0.5, color: '#9a968c' });
    T.streetSign(b, -60, 5.6, Math.PI, '#c0392b');
    K.lamp(b, -57, 6.2, 0); K.lamp(b, -48, -6.2, Math.PI);
  }

  // ───────── kuzeybatı bölgesi (z<0) ─────────
  function nwQuarter(V, occ) {
    // B1: okul / karakol (x -61…-49)
    if (V.nwB1 === 'school') {
      reg(K.house(b, rng, { x: -55.5, z: -17, w: 11, d: 9, floors: 2, door: 's', theme: 'school', flat: true, roofAccess: true, wall: '#c9a27a', roof: '#8a4a3a' }), 'okul');
      T.hedge(b, -61, -9.6, -57.2, -9.6); T.hedge(b, -53.8, -9.6, -49, -9.6);
      K.bench(b, -52, -8.4, 0); T.trashCan(b, -58, -8.4);
    } else {
      reg(K.house(b, rng, { x: -55.5, z: -17, w: 10, d: 9, floors: 2, door: 's', theme: 'office', flat: true, roofAccess: true, wall: '#7a8a9a', roof: '#4a5360' }), 'karakol');
      K.sandbags(b, -58.5, -9.5, 3.0, 0); K.sandbags(b, -52.5, -9.2, 2.4, 0); K.barrier(b, -55.5, -8.2, 0);
      car(-60, -7.8, 0.15, '#e8e8e4'); b.box(-60, 1.55, -7.8, 0.6, 0.12, 1.2, '#2b6fd6', { collide: false, o: { glow: true } });
    }
    occ(-61, -23, -49, -12);
    // B2: evler / pazar (x -45…-26)
    if (V.nwB2 === 'houses') {
      reg(K.house(b, rng, { x: -41, z: -17.5, w: 10, d: 9, floors: 2, door: 's', wall: '#d9c79a', roof: '#a8432f' }), 'ev-1');
      reg(K.house(b, rng, { x: -30.5, z: -16.5, w: 8, d: 8, floors: 1, door: 's', wall: '#c9d6c0', roof: '#5b6470' }), 'ev-2');
      T.hedge(b, -45, -9.8, -42.4, -9.8); T.hedge(b, -39.6, -9.8, -31.8, -9.8); T.hedge(b, -29.2, -9.8, -26, -9.8);
      K.fence(b, -45, -25.4, -26, -25.4);
      car(-36.5, -10.6, Math.PI / 2, '#2c5aa0'); K.crate(b, -26.8, -24, 1.0); T.planter(b, -43.5, -10.9);
    } else {
      reg(K.house(b, rng, { x: -35.5, z: -17, w: 16, d: 11, floors: 2, door: 's', theme: 'shop', flat: true, roofAccess: true, wall: '#c9a27a', roof: '#6a4a3a' }), 'pazar-hali');
      b.box(-35.5, 3.0, -11.4, 12, 1.1, 0.2, '#c0392b', { collide: false });
      b.box(-35.5, 3.35, -11.3, 8, 0.45, 0.1, '#e8e8e4', { collide: false });
      T.stall(b, rng, { x: -42, z: -8.3, ry: 0, color: '#c0392b' }); T.stall(b, rng, { x: -29, z: -8.3, ry: 0, color: '#2c7a4a' }); T.stall(b, rng, { x: -45.2, z: -14, ry: Math.PI / 2, color: '#d9a921' });
      K.crate(b, -27.5, -24.3, 1.1); K.crate(b, -28.7, -24.3, 1.0); K.truck(b, { x: -38, z: -24.2, ry: 0, color: '#e8e8e4', cargo: '#c8ccd0' });
    }
    occ(-45, -26, -26, -9);
    // B3: belediye / banka (x -22…-6)
    if (V.nwB3 === 'townhall') {
      reg(K.house(b, rng, { x: -14, z: -17.5, w: 15, d: 10, floors: 2, door: 's', theme: 'office', flat: true, roofAccess: true, wall: '#e0d8c0', roof: '#8a8d92' }), 'belediye');
      for (const sx of [-3.2, 3.2]) b.box(-14 + sx, 0, -11.6, 0.55, 3.4, 0.55, '#f0eee6');
      b.box(-14, 3.4, -11.6, 7.5, 0.3, 0.9, '#d8d4c8', { collide: false });
      b.box(-14, 0, -8.6, 0.12, 5.0, 0.12, '#4a4d52', { collide: false }); b.box(-13.5, 4.3, -8.6, 1.0, 0.6, 0.04, '#d63a2b', { collide: false });
    } else {
      reg(K.house(b, rng, { x: -14, z: -17.5, w: 13, d: 9, floors: 2, door: 's', theme: 'office', flat: true, roofAccess: true, wall: '#b9cbd9', roof: '#4a5360' }), 'banka');
      K.sandbags(b, -19, -11.2, 2.6, 0); car(-9, -10.2, Math.PI / 2, '#6a6d73', true);
    }
    occ(-22, -23, -6, -12);
    // yan sokak engelleri
    K.dumpster(b, -47, -22, Math.PI / 2); car(-47, -14, Math.PI / 2 + 0.2, palette[2], true);
    car(-24, -9, Math.PI / 2, palette[3]); K.barrel(b, -24.8, -23, '#c0392b'); K.barrel(b, -23.9, -23.4, '#c0392b');
    K.lamp(b, -26.5, -8, 0); K.lamp(b, -45.5, -24, 0);
  }

  // ───────── güneybatı bölgesi (z>0) ─────────
  function swQuarter(V, occ) {
    // B1': garaj / atölye (x -61…-49)
    const gwall = V.tint ? '#a9b4a0' : '#b8b2a4';
    reg(K.house(b, rng, { x: -55, z: 16.5, w: 11, d: 9, floors: 1, door: 'n', theme: 'garage', flat: true, roofAccess: !!V.tint, wall: gwall, roof: '#5a5d62' }), 'garaj');
    car(-59.5, 9.4, 0.2, palette[V.tint ? 1 : 0], true); car(-51.5, 9.2, -0.1, palette[4]); K.crate(b, -61, 24, 1.1); K.crate(b, -59.8, 24.3, 1.0);
    K.barrel(b, -50, 24.5, '#4a6a8a'); K.barrel(b, -49.7, 23.5, '#4a6a8a'); b.cyl(-58, 0, 24.2, 0.45, 0.45, 0.36, '#1c1c1e', { seg: 10, collide: false });
    occ(-61, 9, -49, 26);
    // B2': kilise / benzinlik (x -45…-26)
    if (V.swB2 === 'church') {
      reg(K.church(b, rng, { x: -36, z: 19, w: 9, d: 14 }), 'kilise');
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) K.tombstone(b, -30.5 + c * 1.1 + (r % 2) * 0.1, 14 + r * 2.8, 0);
      K.fence(b, -31.8, 12.2, -26, 12.2); K.fence(b, -26.2, 12.2, -26.2, 16.5); K.fence(b, -26.2, 19.5, -26.2, 24.5); K.fence(b, -31.8, 24.5, -26, 24.5);
      T.hedge(b, -45, 26, -41.5, 26); K.oak(b, rng, -43, 19, 1.0); K.oak(b, rng, -42, 12.8, 0.9); K.bush(b, rng, -31.3, 26, 1);
      K.bench(b, -42, 23, Math.PI / 2);
    } else {
      reg(K.gasStation(b, rng, { x: -33, z: 17, ry: Math.PI / 2, store: 'n' }), 'benzinlik');
      K.dumpster(b, -27.5, 26.3, Math.PI / 2); K.barrel(b, -45, 12.6, '#2c5aa0'); K.barrel(b, -44.2, 12.9, '#2c5aa0'); car(-37, 7.4, Math.PI / 2 + 0.1, '#d9a921');
    }
    occ(-46, 8, -26, 26);
    // B3': park / otopark (x -22…-6)
    if (V.swB3 === 'park') {
      T.gazebo(b, { x: -14, z: 17 });
      T.hedge(b, -21, 10.5, -15, 10.5); T.hedge(b, -11, 10.5, -7, 10.5); T.hedge(b, -21, 24, -17, 24); T.hedge(b, -10, 23.8, -6.5, 23.8, { h: 1.3 });
      T.hedge(b, -21, 13.5, -21, 17.5); T.hedge(b, -7, 15, -7, 20);
      for (const [px, pz] of [[-19, 14], [-9, 14], [-18, 21], [-8, 21.5], [-14, 24.5], [-20, 8.6], [-11, 8.6]]) K.oak(b, rng, px, pz, 0.9 + rng() * 0.4);
      K.bench(b, -17, 13, 0); K.bench(b, -11, 21.3, Math.PI); K.bench(b, -19.5, 20, Math.PI / 2);
      T.kiosk(b, rng, { x: -8.5, z: 9.6, ry: 0, color: '#4a8a6a' });
      T.planter(b, -17.5, 9.2, 2, 0.8); T.trashCan(b, -12.5, 12.6);
      for (let i = 0; i < 5; i++) K.bush(b, rng, -21 + rng() * 14, 9 + rng() * 15, 0.9);
    } else {
      b.box(-14, 0, 17, 15.6, 0.04, 17.6, COL.asphaltLot, { collide: false });
      for (let i = 0; i < 4; i++) { b.box(-19.5 + i * 3.6, 0.04, 12.4, 0.12, 0.02, 3.4, COL.white, { collide: false }); b.box(-19.5 + i * 3.6, 0.04, 21.6, 0.12, 0.02, 3.4, COL.white, { collide: false }); }
      for (const [cx, cz, ry, ci, w] of [[-19, 12.5, Math.PI / 2, 0, 0], [-15.4, 12.6, Math.PI / 2, 1, 0], [-11.8, 12.4, Math.PI / 2, 2, 1], [-8.2, 12.6, Math.PI / 2, 3, 0], [-19, 21.5, Math.PI / 2, 4, 1], [-12, 21.4, Math.PI / 2, 5, 0], [-8.3, 21.6, Math.PI / 2, 1, 0]]) car(cx, cz, ry, palette[ci], !!w);
      K.bus(b, { x: -14, z: 17, ry: 0, color: '#2c7a4a' });
      T.kiosk(b, rng, { x: -7.8, z: 17.5, ry: -Math.PI / 2, color: '#9a6a3a' }); K.lamp(b, -20, 17, 0); K.lamp(b, -8, 12, 0);
      T.busStop(b, { x: -21, z: 7.5, ry: 0 });
    }
    occ(-22, 8, -6, 26);
    K.dumpster(b, -47, 24, Math.PI / 2); car(-47, 14, Math.PI / 2 - 0.2, palette[0], true); car(-24, 20, Math.PI / 2, palette[V.tint ? 5 : 1]);
    K.lamp(b, -26.5, 8, 0); K.lamp(b, -45.5, 24, 0);
  }

  // ───────── cadde engelleri (görüş kes, her ~8-12 m siper) ─────────
  function streetProps(V) {
    // ana cadde (z -5…5): şerit değişimli araçlar
    car(-39, 3.0, 0.12, palette[V.tint ? 2 : 3], true); K.barrier(b, -33.5, -2.2, 0.1); car(-27, 1.8, Math.PI + 0.1, palette[0]);
    K.sandbags(b, -20, -3.2, 3.2, 0.2); car(-15, 3.2, -0.1, palette[5], true); K.barrier(b, -9.5, 1.8, Math.PI / 2);
    K.bus(b, { x: -23, z: -3.4, ry: 0.05, color: V.tint ? '#3b6a9a' : '#d9a921' });
    // orta cadde (x -4…4): kuzey bölümü
    car(-1.8, -12, Math.PI / 2 + 0.12, palette[1]); K.barrier(b, 1.5, -18, Math.PI / 2); car(-1.5, -24, Math.PI / 2 - 0.2, palette[4], true);
    K.sandbags(b, 1.8, -31, 3, Math.PI / 2); car(-1.5, -39, Math.PI / 2, palette[2], true); K.barrier(b, 1.5, -47, Math.PI / 2); car(-1.5, -54, Math.PI / 2 + 0.2, palette[3]);
    // orta cadde (güney bölümü; dönüşte kuzeyi tamamlar)
    car(1.8, 12, Math.PI / 2 - 0.1, palette[5], true); K.barrier(b, -1.5, 18.5, Math.PI / 2); car(1.5, 25.5, Math.PI / 2 + 0.2, palette[0]);
    K.sandbags(b, -1.8, 40, 3, Math.PI / 2); car(1.5, 47, Math.PI / 2, palette[1], true); K.barrier(b, -1.5, 53, Math.PI / 2);
    // kuzey sokak (z -34…-26)
    for (const [x, z, ry, ci, w] of [[-72, -29.4, 0.1, 0, 1], [-63, -31.4, Math.PI, 2, 0], [-55, -28.6, 0.05, 4, 1], [-47.5, -31, 0, 1, 0], [-38, -29, 0.12, 5, 1], [-29.5, -31.2, Math.PI - 0.1, 3, 0], [-20, -28.8, 0, 2, 1], [-11.5, -31.5, 0.1, 0, 0]]) car(x, z, ry, palette[ci], !!w);
    K.barrier(b, -59, -29.5, 0); K.sandbags(b, -42.5, -28.2, 3.2, 0); K.barrier(b, -33.5, -31.4, 0); K.sandbags(b, -16.2, -29.7, 3, 0); K.barrier(b, -7.5, -28.5, 0);
    // güney sokak (z 26…34)
    for (const [x, z, ry, ci, w] of [[-72, 31, 0, 3, 1], [-64, 28.6, 0.1, 1, 0], [-56, 31.4, Math.PI, 5, 1], [-47, 29, 0, 2, 0], [-38.5, 31.5, 0.05, 0, 1], [-30, 28.8, 0.1, 4, 0], [-21, 31.2, Math.PI, 1, 1], [-12, 28.8, 0, 5, 0]]) car(x, z, ry, palette[ci], !!w);
    K.barrier(b, -60, 31, 0); K.sandbags(b, -43, 29.4, 3.2, 0); K.barrier(b, -34, 31.4, 0); K.sandbags(b, -16.5, 31.2, 3, 0); K.barrier(b, -7.5, 29, 0);
    // sokak kenarı (kaldırım/çim şeridi) siperleri: kenar boyunca uzun açık hat bırakma
    for (let x = -70; x < -8; x += 11) { T.hedge(b, x, -35.2, x + 4.5, -35.2, { h: 1.2, t: 0.7 }); T.hedge(b, x + 5.5, 35.2, x + 10, 35.2, { h: 1.2, t: 0.7 }); }
    // lamba direkleri (cadde boyunca, geceyi aydınlatır)
    for (let x = -58; x < -8; x += 14) { K.lamp(b, x, -7.4, Math.PI * 0 + 0); K.lamp(b, x + 7, 7.4, Math.PI); }
    for (let x = -68; x < -8; x += 14) { K.lamp(b, x, -35, 0); K.lamp(b, x + 7, 35, Math.PI); }
    for (let z = -50; z < -10; z += 14) { K.lamp(b, -6.4, z, Math.PI); }
    for (let z = 14; z < 54; z += 14) { K.lamp(b, -6.4, z + 4, Math.PI); }
  }

  // ───────── tarlalar, ağaçlar, su kulesi, gözetleme kulesi ─────────
  function fields(V, occ, free) {
    // KB tarla + kuzey şeridi
    T.crops(b, rng, -82, -56, -66, -42, { along: 'x' }); T.crops(b, rng, -62, -56, -50, -40, { along: 'z' });
    occ(-82, -56, -66, -42, 0.5); occ(-62, -56, -50, -40, 0.5);
    for (let i = 0; i < 6; i++) K.hayBale(b, -70 + (i % 3) * 1.4, -38 + Math.floor(i / 3) * 1.4);
    K.hayBale(b, -69.3, -37.3, 1.2);
    T.wallStone(b, rng, -83.5, -36, -78, -36, { h: 2.0, ruin: true }); T.wallStone(b, rng, -64.4, -52, -64.4, -44, { h: 2.0, ruin: true });
    T.wallStone(b, rng, -48, -37.5, -40, -37.5, { h: 1.8, ruin: true, t: 0.4 });
    reg(K.house(b, rng, { x: -46, z: -47, w: 7, d: 6, floors: 1, door: 's', wall: V.tint ? '#b9a98a' : '#c9b48a', roof: '#6b4a3a' }), 'tarla-kulube'); occ(-49.5, -50, -42.5, -44);
    reg(T.waterTower(b, { x: -24, z: -45, ry: 0 }), 'su-kulesi'); occ(-30, -52, -16, -38);
    K.truck(b, { x: -34, z: -40.5, ry: 0.15, color: V.tint ? '#2c5aa0' : '#4a7a4f', cargo: '#cdd2d8' });
    K.crate(b, -37, -37.8, 1.1); K.crate(b, -35.8, -37.8, 1.0); K.barrel(b, -13.5, -38, '#c0392b'); K.barrel(b, -12.6, -37.6, '#c0392b');
    // meyve bahçesi
    for (let gx = -14; gx <= -6; gx += 4.2) for (let gz = -56; gz <= -40; gz += 4.4) K.oak(b, rng, gx + (rng() - 0.5), gz + (rng() - 0.5), 0.9);
    K.fence(b, -16, -57, -16, -38); K.fence(b, -16, -38, -6, -38);
    // GB tarla + güney şeridi
    reg(K.watchtower(b, { x: -17, z: 46, ry: Math.PI }), 'gozetleme');
    occ(-23, 40, -11, 50);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) K.tombstone(b, -50 + c * 1.5, 43 + r * 2.2, 0);
    K.fence(b, -52, 41, -40, 41); K.fence(b, -52, 41, -52, 45); K.fence(b, -52, 48, -52, 52); K.fence(b, -52, 52, -40, 52); K.fence(b, -40, 41, -40, 45); K.fence(b, -40, 48, -40, 52);
    occ(-53, 40, -39, 53, 0.5);
    reg(K.house(b, rng, { x: -33, z: 46, w: 6.5, d: 5.5, floors: 1, door: 'n', wall: '#8b7a5a', roof: '#4d5b3a' }), 'mezarlik-kulube'); occ(-36.5, 43, -29.5, 49);
    T.crops(b, rng, -82, 42, -66, 56, { along: 'z', color: '#a8b040' }); occ(-82, 42, -66, 56, 0.5);
    for (let i = 0; i < 5; i++) K.hayBale(b, -62 + (i % 3) * 1.4, 44 + Math.floor(i / 3) * 1.4);
    occ(-64, 42, -58, 48);
    T.wallStone(b, rng, -83.5, 38, -76, 38, { h: 2.0, ruin: true }); T.wallStone(b, rng, -62, 52, -56, 52, { h: 1.8, ruin: true });
    K.truck(b, { x: -8, z: 43, ry: Math.PI / 2 + 0.2, color: '#a8281f', cargo: '#b9bec4' });
    // ağaçlar / çalılar / kayalar
    const zones = [[-83, -57, -62, -22], [-83, 22, -62, 57], [-62, -57, 0, -35], [-62, 36, 0, 57]];
    for (const [a, c, d, e] of zones) {
      const n = Math.floor((d - a) * (e - c) / 60);
      for (let i = 0; i < n; i++) {
        const x = a + rng() * (d - a), z = c + rng() * (e - c);
        if (!free(x, z)) continue;
        if (rng() > 0.45) K.oak(b, rng, x, z, 0.9 + rng() * 0.5); else K.pine(b, rng, x, z, 0.9 + rng() * 0.5);
      }
      for (let i = 0; i < n; i++) { const x = a + rng() * (d - a), z = c + rng() * (e - c); if (free(x, z)) K.bush(b, rng, x, z, 0.8 + rng() * 0.6); }
      for (let i = 0; i < n / 4; i++) { const x = a + rng() * (d - a), z = c + rng() * (e - c); if (free(x, z)) K.rock(b, rng, x, z, 0.8 + rng()); }
    }
    // yan sokak kenarı çalıları
    for (let i = 0; i < 24; i++) { const x = -60 + rng() * 54, z = (rng() < 0.5 ? -1 : 1) * (24.5 + rng() * 0.8); if (free(x, z) || true) K.bush(b, rng, x, z, 0.7 + rng() * 0.4); }
  }

  // ───────── merkez meydan (x<0 ve x>0 simetrik) ─────────
  function center() {
    T.fountain(b, { x: 0, z: 0, r: 3.0 });
    b.cyl(0, 0.06, 0, 5.5, 5.5, 0.02, '#4a4d52', { seg: 20, collide: false });
    for (const [px, pz] of [[-6.2, -6.2], [6.2, -6.2], [-6.2, 6.2], [6.2, 6.2]]) { T.planter(b, px, pz, 1.8, 0.9); }
    for (const [bx, bz, br] of [[-5.2, 0, Math.PI / 2], [5.2, 0, -Math.PI / 2], [0, -5.4, 0], [0, 5.4, Math.PI]]) K.bench(b, bx, bz, br);
    T.billboard(b, { x: 0, z: -52, ry: 0, color: '#2c5aa0' }); T.billboard(b, { x: 0, z: 52, ry: Math.PI, color: '#a8281f' });
  }

  // ───────── sınır çiti + orman (çarpışmasız) + dağlar ─────────
  function surround() {
    const { minX, maxX, minZ, maxZ } = KASABA_BOUNDS;
    const f = (x0, z0, x1, z1) => K.fence(b, x0, z0, x1, z1, 1.6, '#7a5a38');
    f(minX - 1, minZ - 1, maxX + 1, minZ - 1); f(minX - 1, maxZ + 1, maxX + 1, maxZ + 1); f(minX - 1, minZ - 1, minX - 1, maxZ + 1); f(maxX + 1, minZ - 1, maxX + 1, maxZ + 1);
    for (let ring = 0; ring < 5; ring++) {
      const off = 4 + ring * 6, step = 3.4;
      for (let x = minX - off; x <= maxX + off; x += step) for (const zz of [minZ - off, maxZ + off]) (rng() > 0.25 ? K.pine : K.oak)(b, rng, x + (rng() - 0.5) * 2, zz + (rng() - 0.5) * 2, 1.1 + rng() * 0.9, 0, false);
      for (let z = minZ - off + step; z < maxZ + off; z += step) for (const xx of [minX - off, maxX + off]) (rng() > 0.25 ? K.pine : K.oak)(b, rng, xx + (rng() - 0.5) * 2, z + (rng() - 0.5) * 2, 1.1 + rng() * 0.9, 0, false);
    }
    const hillCols = ['#6f8a43', '#7a8f48', '#657a3d', '#8a7a52'];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng() * 0.2;
      b.ico(Math.cos(a) * (150 + rng() * 40), -3, Math.sin(a) * (115 + rng() * 40), 28 + rng() * 14, hillCols[i % 4], { detail: 1, scale: [1.6, 0.55, 1.3], collide: false });
    }
    const mtCols = ['#7b786f', '#6e6c66', '#847f74'];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rng() * 0.15;
      const rx = 300 + rng() * 50, rz = 270 + rng() * 50, h = 38 + rng() * 42, base = 70 + rng() * 40;
      b.cyl(Math.cos(a) * rx, 0, Math.sin(a) * rz, 0.1, base, h, mtCols[i % 3], { seg: 7, ry: rng() * 3, collide: false });
      if (h > 62) b.cyl(Math.cos(a) * rx, h * 0.84, Math.sin(a) * rz, 0.1, base * 0.2, h * 0.16, '#e8ecef', { seg: 7, collide: false });
    }
  }

  // ───────── doğuş noktası seçimi: avluda çarpışmasız, dağınık, göz hizası açık ─────────
  function pickSpawns(zone, ry, n, side) {
    const cands = [];
    const x0 = side > 0 ? zone.minX + 2 : zone.maxX - 8, x1 = side > 0 ? zone.maxX - 11 : zone.maxX - 2;
    // blue: avlu doğusu (x -70…-63); red: avlu batısı (x 63…70). Genişletilmiş: tüm avlu x -81…-63 benzeri
    const lo = side > 0 ? -82 : 63, hi = side > 0 ? -63 : 82;
    for (let x = lo; x <= hi; x += 1.5) for (let z = zone.minZ + 1.5; z <= zone.maxZ - 1.5; z += 1.5) {
      let ok = true;
      for (const c of b.colliders) {
        if (c.max[1] < 0.3 || c.min[1] > 1.8) continue;
        if (x > c.min[0] - 0.8 && x < c.max[0] + 0.8 && z > c.min[2] - 0.8 && z < c.max[2] + 0.8) { ok = false; break; }
      }
      if (ok) cands.push({ x, z });
    }
    // doğu/batı bölgesi yakını (kapıya yakın kısım) önde; ayrıca dağılımı ızgara adımıyla seyrelt
    cands.sort((p, q) => (side > 0 ? q.x - p.x : p.x - q.x) + (rng() - 0.5) * 6);
    const out = [];
    for (const c of cands) {
      if (out.length >= n) break;
      if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 2.6)) continue;
      out.push({ x: c.x, z: c.z, ry: ry + (rng() - 0.5) * 0.4 });
    }
    return out;
  }
}
