import * as THREE from 'three';
import { MapBuilder } from './builder.js';
import EDITS from './colgecidiEdits.js';
import { cgLayout } from './assets/colgecidi/layout.js';
import { CgTerrain } from './assets/colgecidi/terrain.js';
import { buildCgMap } from './assets/colgecidi/build.js';
import { CgNav } from './assets/colgecidi/nav.js';

// Çöl Geçidi v2 (12.171): sıfırdan, modül modül. Yerleşim (koridorlar, bölge adları, doğuş / hedef / bot noktaları) eski haritayla AYNI; kaynak artık sabit
// plan (assets/colgecidi/plan.js, ızgaraya hizalı) — radar çıkarımı (colgecidiData.js) kalktı. Kurulum: assets/colgecidi/build.js; ortak çöl kasabası
// parçaları assets/common/cg*.js. Yön (radar gibi): T güney (+z), CT kuzey (−z), A sahası doğu (+x), B sahası batı (−x). Takım renkleri her maç yer değiştirir.
export const CG_BOUNDS = { minX: -66, maxX: 66, minZ: -71, maxZ: 71 };

// Bölge adları (standart oyun yer isimleri; geliştirici P tuşu, mini harita): eski haritayla aynı noktalar
const CALL_PX = [
  ['T Spawn', 570, 882, 1], ['Titanic', 447, 800], ['Outside Tunnels', 387, 660, 1], ['Suicide', 633, 748], ['Outside Long', 806, 728, 1], ['Top Mid', 702, 637, 1], ['Palm', 684, 593], ['Green', 590, 628],
  ['Long Doors', 842, 617], ['Side Pit', 931, 620], ['Pit', 997, 620], ['Blue', 875, 495], ['Long Corner', 977, 480], ['Long', 997, 390, 1], ['Car (Long)', 1056, 312], ['Ramp', 995, 230], ['Barrels', 1003, 155], ['Goose', 945, 118],
  ['A Site', 933, 226, 1], ['Ninja', 807, 174], ['Boost', 871, 256], ['Elevator', 892, 293], ['CT Spawn', 747, 255, 1], ['Short Stairs', 797, 330], ['Stairs', 792, 380], ['Short', 753, 436, 1], ['Xbox', 660, 438], ['Cat', 680, 523], ['Mid', 640, 515, 1],
  ['Mid Doors', 640, 398], ['Lower Tunnels', 554, 438], ['Upper Tunnels', 350, 480, 1], ['CT Mid', 590, 267, 1], ['B Doors', 447, 284], ['Window', 505, 192], ['B Site', 402, 204, 1], ['B Plat', 343, 182], ['Back Plat', 318, 118], ['Box', 344, 251], ['Fence', 285, 293], ['Car (B)', 415, 355],
];
const px2w = (x, y) => [((x - 277) / 0.87 - 460) * 0.143, ((y - 94.5) / 0.87 - 495.5) * 0.143];
export const CALLOUTS = CALL_PX.map(([name, x, y, major]) => { const [wx, wz] = px2w(x, y); return { name, x: +wx.toFixed(1), z: +wz.toFixed(1), major: !!major }; });

export function buildColGecidi() {
  const b = new MapBuilder();
  const L = cgLayout(), terrain = new CgTerrain();
  const out = buildCgMap(b, terrain, L, CALLOUTS);
  b.applyEdits(EDITS);                                                // kalıcı harita düzenlemeleri (editörden: colgecidiEdits.js)
  const group = b.build();
  if (out.groundMesh) group.add(out.groundMesh);
  return {
    id: 'colgecidi',
    name: 'Çöl Geçidi',
    editSkipped: b.editSkipped || [],
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: CG_BOUNDS,
    terrain,
    sideSwap: true,
    layered: true,                                                  // Short köprüsü / kemerler üst üste iki kat: yol bulma hücre başına zemin kotu tutar
    // yol ızgarası: tek katlı NavGrid + Short köprüsünün altında ikinci kat (CT ↔ kemer avlusu geçidi). Bot davranışı tek katlı haritalardaki gibi.
    makeNav() { return new CgNav(this.colliders, this.bounds, this.terrain, [15, -51, 23, -34.5]); },
    callouts: CALLOUTS,
    roamPoints: [[-6.4, 3.5], [-6, -20], [14, -28], [54, 15], [53, -3.6], [41, -28], [-55.8, -6.5], [-27, -16.5], [-30, -40], [-8, -38], [50, 30], [-30, 40]],
    mini: { bg: '#4a3d2a', ground: [226, 204, 158], wall: '#5a4830', mid: '#8b7550', low: '#a88f62', roof: 'rgba(110,86,52,0.45)', pit: [150, 126, 88] },
    spawns: out.spawns,
    baseZones: {
      blue: { minX: -42, maxX: 12, minZ: 42, maxZ: 76 },
      red: { minX: 0, maxX: 32, minZ: -58, maxZ: -28 },
    },
    objectives: out.objectives,
    roads: [],
    roadColor: '#b8a074',
    env: out.env,
    stats: out.stats,
  };
}
