import { MapBuilder, makeRng } from './builder.js';
import { UK, makeUsSurface, attachUsSurfaceLamps } from './assets/common/us-surface.js';
import { UsKit, PAL, mergeColliders } from './assets/common/us-kit.js';
import { perimeter, outside } from './assets/us/perimeter.js';
import { camp, CAMP_SPAWNS } from './assets/us/camp.js';
import { komuta, hangarComplex, radarComplex, midRing, fuelDepot, barracks, yardGarage, yardMaze, avenue } from './assets/us/zones.js';

// Harita 3 — ASKERİ ÜS v3 (12.170: sıfırdan, asset asset). 160 × 120 m (iç yüz x ±80, z ±60).
// Oynanış şablonu eski haritayla aynı: Mavi batı / Kırmızı doğu kapalı kampı (5,4 m duvar, 5 kapı, kapı önü T-duvar şikanı), orta halka (atölye hangarı, tünel,
// yemekhane / depo, sığınaklar, gözetleme kuleleri, akaryakıt, kışla), iç çekirdek (3 katlı Komuta Binası); köşe avluları (garaj + helipad / konteyner labirenti).
// 180° döndürme simetrisi (x, z) → (−x, −z): kuzeybatı ↔ güneydoğu, güneybatı ↔ kuzeydoğu aynı yerleşim, içerik farklı (Kışla ↔ Akaryakıt).
// Hedefler: Hangar (K, çekirdek), Komuta Binası (merkez, çekirdek), Radar (G, çekirdek), Kışla (B), Akaryakıt (D).
// Bütün parçalar src/maps/assets/common/us-*.js (paylaşılabilir asset'ler) ve src/maps/assets/us/*.js (bu haritanın bölgeleri) içinde; kurallar us-kit.js başında.

export const US_BOUNDS = { minX: -80, maxX: 80, minZ: -60, maxZ: 60 };
const PI = Math.PI;

// zemin bölümlemesi (sonraki öncelikli; örtüşmeyen kutulara çevrilir → yol / çizgi / saha kaplaması üst üste binmez)
function groundRects() {
  const R = [], A = (x0, x1, z0, z1, col, kind) => R.push({ x0, x1, z0, z1, col, kind });
  const both = (x0, x1, z0, z1, col, kind) => { A(x0, x1, z0, z1, col, kind); A(-x1, -x0, -z1, -z0, col, kind); };
  A(-330, 330, -330, 330, PAL.grass, UK.GRASS);
  A(-97, 97, -75, -68, PAL.asph, UK.ASPH); A(-97, 97, 68, 75, PAL.asph, UK.ASPH); A(-97, -90, -68, 68, PAL.asph, UK.ASPH); A(90, 97, -68, 68, PAL.asph, UK.ASPH);
  A(-81.2, 81.2, -61.2, 61.2, PAL.paver, UK.PAVER);
  both(-80, -55.6, -24, 24, PAL.gravel, UK.GRAVEL);
  both(-80, -56.4, -3, 3, PAL.asph, UK.ASPH);
  A(-56, 56, -5, 5, PAL.asph, UK.ASPH);
  A(-4, 4, -36, 39, PAL.asph, UK.ASPH);
  A(-18, 18, -36, -29.5, '#4a4d52', UK.ASPH);
  A(-15, 15, -12, 12, '#9a9c95', UK.PAVER);
  for (const [a, b] of [[-55.5, -15.5], [15.5, 55.5]]) A(a, b, -0.1, 0.1, PAL.yellow, UK.LINEX);
  for (const [a, b] of [[-35.5, -12.5], [12.5, 38.5]]) A(-0.1, 0.1, a, b, PAL.yellow, UK.LINEZ);
  A(-15, 15, -54, -36, '#8a8c86', UK.PAD);
  both(-52, -28, -59.97, -46, '#8a8c86', UK.PAD);
  both(-70, -53.2, -60, -52, '#8a8c86', UK.PAD);
  A(25, 43, -18, -6, '#9a9a92', UK.PAVER);
  A(23.25, 43.15, -31, -23, PAL.gravel, UK.GRAVEL);
  A(-46, -26, 16.9, 20.1, '#647347', UK.GRASS);
  A(-14.5, -10.5, 18.5, 25.5, '#647347', UK.GRASS);
  return R;
}

export function buildUs() {
  const b = new MapBuilder();
  const rng = makeRng(4243);
  const K = new UsKit(b, rng);
  b.surface = { ground: () => 0, kindOf: () => UK.PLAIN, seeded: true, kindBits: 6, material: () => makeUsSurface(K.lamps) };
  const rot = (fn) => b.with(0, 0, 0, PI, fn);

  K.ground(groundRects(), { x0: -330, x1: 330, z0: -330, z1: 330 });
  perimeter(K, [['n', -52, -28], ['s', 28, 52], ['n', -70, -53.2], ['s', 53.2, 70]]);
  camp(K, 'blue'); rot(() => camp(K, 'red'));
  avenue(K); rot(() => avenue(K));
  komuta(K);
  hangarComplex(K);
  radarComplex(K);
  midRing(K, 0); rot(() => midRing(K, 1));
  fuelDepot(K);
  barracks(K);
  yardGarage(K, 0); rot(() => yardGarage(K, 1));
  yardMaze(K, 0); rot(() => yardMaze(K, 1));
  const nCol = b.colliders.length;
  outside(K, rng);
  b.colliders.length = nCol;                 // duvar dışı dekorun çarpışması gereksiz (oynanış alanı dışında)

  const spawns = { blue: [], red: [] };
  for (const [x, z] of CAMP_SPAWNS) { spawns.blue.push({ x, z, ry: -PI / 2 }); spawns.red.push({ x: -x, z: -z, ry: PI / 2 }); }
  const objectives = [
    { id: 'hangar', name: 'Hangar', x: 0, z: -45, r: 11, core: true },
    { id: 'komuta', name: 'Komuta Binası', label: 'M', x: 0, z: 0, r: 12, core: true },
    { id: 'radar', name: 'Radar', x: 0, z: 45, r: 10, core: true },
    { id: 'kisla', name: 'Kışla', x: -34, z: 18, r: 11 },
    { id: 'akaryakit', name: 'Akaryakıt', label: 'Y', x: 34, z: -18, r: 11 },
  ];

  const group = b.build();
  const colliders = mergeColliders(b.colliders);                 // üst üste / yan yana birebir değen kutular tek kutu (görünüm aynı; çarpışma sorgusu ucuzlar)
  const surf = group.children.find((m) => m.material?.userData?.usLamps);
  if (surf) attachUsSurfaceLamps(surf);
  if (!MapBuilder.noVisual) K.finish(group);

  return {
    id: 'us',
    name: 'Askeri Üs',
    group,
    colliders,
    sight: b.sight,
    bounds: US_BOUNDS,
    spawns,
    baseZones: {                                     // kamp avlusu + kapı koridorları (şikan duvarlarının içi): düşman girerse ceza
      blue: { minX: -80, maxX: -50, minZ: -29.5, maxZ: 29.5 },
      red: { minX: 50, maxX: 80, minZ: -29.5, maxZ: 29.5 },
    },
    objectives,
    callouts: K.callouts,
    roads: [{ x0: -56, z0: -5, x1: 56, z1: 5 }, { x0: -4, z0: -36, x1: 4, z1: 39 }],
    roadColor: '#4a4d52',
    env: {
      sky: ['#6f7f8e', '#a3b0ba', '#cfd2cf'], fog: ['#b7bfc3', 130, 380],
      sun: ['#eef1f5', 1.9], hemi: ['#cfd8e3', '#6d705f', 1.15], cloud: '#d3d7da', clouds: 26,
      sunPos: [45, 80, 30],
    },
  };
}
