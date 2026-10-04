import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as M from './kitMil.js';
import * as T from './kitTown.js';

// "Riverside" — Enfekte moduna özel gece haritası: harap hastane mahallesi.
// Tasarım: insan botlar/oyuncular YÜKSEK SAVUNMA NOKTALARINA (perches) çıkar — hastane terası, depo çatısı, konteyner kulesi, otogar,
// iskele kulesi — zombiler koşup sıçrayarak peşlerinden gelir. Platformlar 'plat' etiketli düz üstlü katı bloklardır (altı boş değil),
// çıkış basamakla/rampayla; 1.0–1.3 m'lik alçak olanlara zombi sıçrayarak çıkar, 2.6 m ve üstüne yalnızca merdivenden (boğaz noktası).
// Zemin katmanlı navigasyon (layered:true) ile botlar merdiven/rampa kullanır.

export const RIVERSIDE_BOUNDS = { minX: -72, maxX: 72, minZ: -62, maxZ: 62 };
const ASPH = '#26282c', ASPH2 = '#202226', WALK = '#4b4d51', DIRT = '#1f2620', CONC = '#6f7378', CONC_D = '#55595e';
const NC = { collide: false };

// Düz üstlü yürünebilir katı blok (navigasyon bunun üstünü zemin sayar)
const plat = (b, x0, z0, x1, z1, y0, h, color, o = {}) => b.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, color, { tag: 'plat', ...o });

function textPlane(text, w, h, { fg = '#e8e6df', bg = null, font = 'bold 120px sans-serif', drip = false, border = null } = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  if (border) { g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(10, 10, c.width - 20, c.height - 20); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = text.split('\n'), lh = c.height / (lines.length + 0.4);
  lines.forEach((ln, i) => g.fillText(ln, c.width / 2, lh * (i + 0.7), c.width - 30));
  if (drip) { g.fillStyle = fg; for (let i = 0; i < 26; i++) { const x = 40 + Math.random() * (c.width - 80), y = lh * (0.9 + Math.random() * lines.length * 0.8); g.fillRect(x, y, 6 + Math.random() * 6, 20 + Math.random() * 90); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
}

export function buildRiverside() {
  const b = new MapBuilder();
  b.autoPlace = false;
  const rng = makeRng(23);
  const roads = [];
  const road = (x0, z0, x1, z1, color = ASPH) => { b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.04, z1 - z0, color, NC); roads.push({ x0, z0, x1, z1 }); };

  // ───── zemin ─────
  b.box(0, -1.0, 0, 900, 1.0, 900, DIRT, NC);
  b.box(0, 0, 0, 148, 0.02, 128, '#262d24', NC);
  road(-72, -5, 72, 5); road(-4, -62, 4, 62); road(-72, -34, 72, -28, ASPH2); road(-72, 28, 72, 34, ASPH2);
  for (let x = -70; x < 70; x += 8) b.box(x, 0.045, 0, 3.6, 0.01, 0.25, '#b9a24a', NC);          // cadde şerit çizgisi
  for (let z = -60; z < 60; z += 8) b.box(0, 0.045, z, 0.25, 0.01, 3.6, '#b9a24a', NC);
  for (const sgn of [-1, 1]) { b.box(0, 0.0, sgn * 6.2, 144, 0.1, 2.4, WALK, NC); b.box(sgn * 6.2, 0.0, 0, 2.4, 0.1, 124, WALK, NC); }     // kaldırımlar
  // su birikintileri (ıslak yol): koyu, parlak, çarpışmasız
  for (let i = 0; i < 26; i++) {
    const x = (rng() - 0.5) * 130, z = (rng() - 0.5) * 112, onRoad = Math.abs(z) < 5 || Math.abs(x) < 4;
    if (!onRoad && rng() < 0.6) continue;
    b.box(x, 0.05, z, 1.5 + rng() * 3.5, 0.01, 1 + rng() * 2.5, '#0e1a22', { collide: false, o: { roughness: 0.05, metalness: 0.65 } });
  }
  // çatlak / moloz parçaları (çarpışmasız)
  for (let i = 0; i < 70; i++) {
    const x = (rng() - 0.5) * 140, z = (rng() - 0.5) * 120;
    b.box(x, 0, z, 0.3 + rng() * 0.8, 0.1 + rng() * 0.25, 0.3 + rng() * 0.8, rng() < 0.5 ? CONC_D : '#3a3a38', { collide: false, ry: rng() * 3 });
  }

  const perches = [];
  const perch = (x, z, y, r, cap = 4) => perches.push({ x, z, y, r, cap });

  // ───── 1. Hastane + ön teras (1.5 m) ─────
  K.house(b, rng, { x: -44, z: -30, w: 30, d: 16, floors: 3, door: 's', theme: 'office', flat: true, roofAccess: true, wall: '#a9afb3', roof: '#4a5056', glow: 0.55 });
  plat(b, -55.6, -20, -34, -12, 0, 1.5, CONC);                                                         // teras
  b.stairs(-58, -16, 0, '+x', 4, 6, 0.25, 0.4, '#8a8e92', { deco: false, tag: 'plat' });
  b.stairs(-31.6, -16, 0, '-x', 4, 6, 0.25, 0.4, '#8a8e92', { deco: false, tag: 'plat' });
  b.box(-45, 1.5, -12.2, 21.6, 0.9, 0.18, '#59616a', NC);                                              // teras ön korkuluk (görsel)
  perch(-45, -16, 1.5, 7, 6);
  M.ambulance(b, { x: -22, z: -9.5, ry: Math.PI / 2, wreck: true });

  // ───── 2. Depo (çatı 3.4 m, tek merdiven) ─────
  plat(b, 30, -38, 52, -22, 0, 3.4, '#6f757a');
  b.stairs(58, -30, 0, '-x', 4, 17, 0.2, 0.35, '#8a8e92', { deco: false, tag: 'plat' });
  for (let i = 0; i < 6; i++) b.box(31 + i * 3.6, 1.2, -21.95, 1.8, 1.1, 0.05, '#0a0c10', NC);        // pencere şeritleri (kararmış)
  b.box(41, 3.4, -22.1, 22, 0.9, 0.2, '#585d62', NC); b.box(41, 3.4, -37.9, 22, 0.9, 0.2, '#585d62', NC);   // çatı korkuluğu (görsel)
  perch(41, -30, 3.4, 9, 6);

  // ───── 3. Konteyner kulesi (1.3 m + 2.6 m) ─────
  plat(b, -40, 16, -28, 28, 0, 1.3, '#8a4a2c');
  plat(b, -28, 16, -18, 28, 0, 2.6, '#3b6a9a');
  b.stairs(-44, 22, 0, '+x', 3, 5, 0.26, 0.8, '#8a8e92', { deco: false, tag: 'plat' });                // yer → alçak konteyner
  b.stairs(-31.6, 22, 1.3, '+x', 3, 5, 0.26, 0.72, '#8a8e92', { deco: false, base: 1.3, tag: 'plat' });  // alçaktan → yüksek
  for (let i = 0; i < 12; i++) { b.box(-39.5 + i, 0.15, 15.97, 0.12, 1.1, 0.06, '#6e3a22', NC); }      // oluk kabartması
  for (let i = 0; i < 12; i++) b.box(-27.5 + i * 0.8, 0.15, 15.97, 0.12, 2.3, 0.06, '#2e5478', NC);
  perch(-34, 22, 1.3, 5, 3); perch(-23, 22, 2.6, 4.5, 4);

  // ───── 4. Otogar platformu (1.1 m, zombi sıçrayarak çıkar) ─────
  plat(b, 16, 16, 40, 26, 0, 1.1, '#7a7d80');
  b.stairs(12, 21, 0, '+x', 4, 8, 0.1375, 0.5, '#8a8e92', { deco: false, tag: 'plat' });
  b.box(28, 1.1, 16.2, 22, 0.1, 0.1, '#c9a227', NC);
  K.bus(b, { x: 30, z: 21, ry: 0, y: 1.1, wreck: true });
  perch(26, 21, 1.1, 8, 5);

  // ───── 5. Meydan sahnesi (1.0 m) ─────
  plat(b, 8, -18, 20, -10, 0, 1.0, '#6b6f73');
  b.stairs(6, -14, 0, '+x', 3, 5, 0.2, 0.4, '#8a8e92', { deco: false, tag: 'plat' });
  perch(14, -14, 1.0, 5, 3);

  // ───── 6. İskele kulesi (3.8 m, uzun merdiven) ─────
  plat(b, -70, 40, -62, 48, 0, 3.8, '#5d5448');
  b.stairs(-66, 33, 0, '+z', 3.6, 19, 0.2, 0.38, '#8a8e92', { deco: false, tag: 'plat' });
  for (const [x, z] of [[-70, 40], [-62, 40], [-70, 48], [-62, 48]]) b.box(x, 3.8, z, 0.25, 1.1, 0.25, '#3a3d40', NC);
  perch(-66, 44, 3.8, 3.5, 3);

  // ───── girilebilir harap binalar ─────
  K.house(b, rng, { x: -12, z: -31, w: 10, d: 9, floors: 2, door: 's', wall: '#8d8f86', roof: '#4e4a46', flat: true, theme: 'shop', glow: 0.3 });
  K.house(b, rng, { x: 2, z: -31, w: 9, d: 9, floors: 1, door: 's', wall: '#9a8f82', roof: '#4a4440', flat: true, theme: 'garage', glow: 0.2 });
  K.house(b, rng, { x: -10, z: 31, w: 10, d: 9, floors: 2, door: 'n', wall: '#868a8c', roof: '#4a4e52', flat: true, theme: 'shop', glow: 0.3 });
  K.house(b, rng, { x: 5, z: 31, w: 9, d: 9, floors: 1, door: 'n', wall: '#92877a', roof: '#4a4440', flat: true, theme: 'garage', glow: 0.2 });
  K.house(b, rng, { x: 58, z: 6, w: 10, d: 9, floors: 2, door: 'w', wall: '#8d8f86', roof: '#4a4e52', flat: true, theme: 'house', glow: 0.3 });
  K.house(b, rng, { x: -60, z: 10, w: 10, d: 9, floors: 2, door: 'e', wall: '#9a8f82', roof: '#4e4a46', flat: true, theme: 'house', glow: 0.3 });

  // ───── siper / parkur: hurda araçlar, bariyerler, kasa yığınları, yıkık duvarlar ─────
  const wreck = (x, z, ry, color) => K.car(b, { x, z, ry, color, wreck: true });
  wreck(-20, 2.2, 0.15, '#4a4a4c'); wreck(18, -2.4, -0.2, '#5a3a30'); wreck(-36, -3, Math.PI / 2 + 0.2, '#3a4048'); wreck(34, 3, 0.1, '#4a4538');
  wreck(1.5, -22, Math.PI / 2, '#3d3d40'); wreck(-1.5, 18, Math.PI / 2 - 0.1, '#51402f'); wreck(46, 31, 0.05, '#40443f'); wreck(-50, 31, -0.1, '#3a3f45');
  for (const [x, z, ry] of [[-14, 3, 0.1], [12, -3, 0], [-30, 3.5, 0.2], [26, -3.5, 0], [1.5, -12, Math.PI / 2], [-1.5, 10, Math.PI / 2], [52, 4, 0], [-52, -4, 0]]) K.barrier(b, x, z, ry);
  for (const [x, z] of [[-8, 8], [9, 8], [-9, -9], [20, 9], [-24, -3]]) { K.crate(b, x, z, 1.1); K.crate(b, x + 1.15, z + 0.2, 1.0); K.crate(b, x + 0.5, z + 0.1, 0.9, 1.1); }
  for (const [x, z, ry] of [[-18, 12, 0], [22, 12, 0], [-56, -2, 0], [60, -4, 0], [-3, 44, Math.PI / 2], [3, -46, Math.PI / 2]]) K.sandbags(b, x, z, 4, ry);
  K.dumpster(b, -6.5, -12); K.dumpster(b, 7, 12.5, 0.3); K.dumpster(b, 36, -12.5); K.dumpster(b, -50, 12);
  T.wallStone(b, rng, -72, 50, -52, 50, { ruin: true, h: 2.2 }); T.wallStone(b, rng, 20, 50, 40, 50, { ruin: true, h: 2.2 }); T.wallStone(b, rng, 24, -52, 48, -52, { ruin: true, h: 2.4 });
  T.wallStone(b, rng, -30, -52, -8, -52, { ruin: true, h: 2.4 }); T.wallStone(b, rng, 50, 18, 50, 46, { ruin: true, h: 2.0 });
  const ivy = (x, y, z, ry = 0) => { for (let i = 0; i < 7; i++) b.box(x + (rng() - 0.5) * 2.2, y + rng() * 3.5, z, 0.5 + rng() * 0.7, 0.5 + rng() * 0.9, 0.12, rng() < 0.5 ? '#2c4a24' : '#3b5f2c', { collide: false, ry }); };
  for (const x of [-56, -48, -40, -33]) ivy(x, 0.3, -21.9);
  ivy(30.1, 0.5, -26, 0); ivy(-70, 1, 50.1);

  // ───── ışık: lamba direkleri + yanan variller ─────
  for (const [x, z] of [[-28, -7.5], [-8, 7.5], [10, -7.5], [30, 7.5], [50, -7.5], [-48, 7.5], [-7.5, -26], [7.5, 26], [-7.5, 44]]) M.lampPost(b, x, z, { h: 5.6, pool: 4.2 });
  for (const [x, z] of [[-3, 3.2], [3.5, -4], [-26, 4], [24, 4.4], [40, -12], [-34, 12], [14, 12.5], [-58, 20]]) M.fireBarrel(b, x, z);

  // ───── doğuş ─────
  const spawns = { blue: [], red: [] };
  for (let i = 0; i < 24; i++) spawns.blue.push({ x: -14 + (i % 8) * 4, z: 9 + Math.floor(i / 8) * 3.2, ry: Math.PI });                 // ana cadde güneyi, perch'lere yakın
  for (let i = 0; i < 24; i++) { const side = i % 2 ? 1 : -1; spawns.red.push({ x: side * (66 + (i % 3)), z: -26 + Math.floor(i / 2) * 4.4, ry: side > 0 ? Math.PI / 2 : -Math.PI / 2 }); }
  const objectives = [{ id: 'merkez', name: 'Merkez', core: true, x: 0, z: 0, r: 8 }];

  const group = b.build();
  if (typeof document !== 'undefined') {                                // tabelalar / yazılar (yalnızca tarayıcı)
    const s1 = textPlane('RIVERSIDE\nGENERAL HOSPITAL', 14, 3.2, { fg: '#e4e0d4', bg: '#2a2f33', border: '#8a8e92', font: 'bold 150px sans-serif' }); s1.position.set(-44, 10.5, -21.8); group.add(s1);
    const s2 = textPlane('NO\nSAFE\nPLACE', 5, 5, { fg: '#b3201a', font: 'bold 260px sans-serif', drip: true }); s2.position.set(29.85, 2.6, -30); s2.rotation.y = -Math.PI / 2; group.add(s2);
    const s3 = textPlane('ACİL', 4, 1.3, { fg: '#ff4a3a', bg: '#22181a', border: '#ff4a3a', font: 'bold 150px sans-serif' }); s3.position.set(-44, 4.0, -21.8); group.add(s3);
    const s4 = textPlane('OTOGAR', 5, 1.2, { fg: '#e8d44a', bg: '#1d2124', border: '#e8d44a', font: 'bold 140px sans-serif' }); s4.position.set(28, 3.6, 16.1); s4.rotation.y = Math.PI; group.add(s4);
  }
  return {
    id: 'riverside',
    name: 'Riverside',
    group,
    colliders: b.colliders,
    bounds: RIVERSIDE_BOUNDS,
    baseZones: null,
    roads,
    spawns,
    objectives,
    perches,
    layered: true,
    forceTod: 'night',
  };
}
