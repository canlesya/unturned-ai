import { MapBuilder } from './builder.js';
import { makeLayout } from './assets/colgecidi/layout.js';
import { CgTerrain } from './assets/colgecidi/terrain.js';
import { CgNav } from './assets/colgecidi/nav.js';
import * as PLAN from './assets/uykukoy/plan.js';
import { buildKoyMap } from './assets/uykukoy/build.js';

// Kum Köyü (12.224): terk edilmiş çöl köyü, küçük rekabetçi harita (5v5 Uyku Modu için; Takım Çatışması / Ele Geçirme / Ölüm Maçı'nda da oynanır).
// Oynanış alanı 66 × 74 m, köy duvarı (6,5 m) ve ≥ 6 m'lik ev kütleleriyle kapalı (görünmez duvar yok). z → −z aynası: Mavi güneyde (+z), Kırmızı kuzeyde
// (−z) Han avlusunda doğar. Üç hat: Dar Sokak (batı), Meydan (orta), Evler (doğu: Damlı Ev + iki katlı Konak). Kurulum: assets/uykukoy/ (plan.js → build.js);
// Çöl Geçidi v2 hattını (zemin / kütle / cephe / AO / yol ızgarası) ve çöl kitini (assets/common/cg*.js) kullanır.
export const KOY_BOUNDS = { minX: -35, maxX: 35, minZ: -39, maxZ: 39 };

// bölge adları (güney yarısı yazılır; Güney / Kuzey ayna). Orta çizgidekiler tek.
const C_S = [
  ['Han', 0, 33, 1], ['Han Arkası', 0, 25.5], ['Batı Han Geçidi', -16.5, 27], ['Doğu Han Geçidi', 16.5, 27], ['Han Önü', -6, 19, 1], ['Han Sokağı', -22, 31.5, 1], ['Dar Sokak', -28.5, 22, 1], ['Kıvrım', -26, 15.5],
  ['Kemer', -17, 10.75, 1], ['Doğu Geçidi', 14.5, 8.25], ['Evler Sokağı', 20, 22, 1], ['Avlu', 28.5, 8, 1], ['Damlı Ev', 28.5, 15, 1], ['Doğu Han Sokağı', 19, 31.5],
];
const C_MID = [['Fırın Avlusu', -25, 3.5, 1], ['Batı Geçidi', -15.5, 0], ['Meydan', -6, 4, 1], ['Sebil', 0, 3], ['Kamyon', 8.6, 2], ['Konak Önü', 14, 0], ['Konak', 21.5, 0, 1], ['Arka Geçit', 28.5, 0]];
export const CALLOUTS = [
  ...C_S.flatMap(([name, x, z, major]) => [{ name: 'Güney ' + name, x, z, major: !!major }, { name: 'Kuzey ' + name, x, z: -z, major: !!major }]),
  ...C_MID.map(([name, x, z, major]) => ({ name, x, z, major: !!major })),
];

export function buildUykuKoy() {
  const b = new MapBuilder();
  // exempt: haritada dikey istinat duvarı yok, kot farkları yalnız 0,45 m'lik pah basamağı (Han avlusu, Sebil seti) → yol bulmada eğim sayılmaz
  // (Çöl Geçidi kuralı basamağın üst hücresini duvar dibi sayıp kapatıyordu: botlar avludan çıkamıyordu). Basamak farkını NavGrid zaten ≤ 0,7 ile sınırlar.
  const L = makeLayout(PLAN), terrain = new CgTerrain(L, () => true);
  const out = buildKoyMap(b, terrain, L);
  const group = b.build();
  const K = PLAN.KONAK, D = PLAN.DAM, S = PLAN.SPAWN_ZONE;
  return {
    id: 'uykukoy',
    name: 'Kum Köyü',
    editSkipped: b.editSkipped || [],
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: KOY_BOUNDS,
    playArea: null,
    terrain,
    layered: true,                                                    // ev üst katı / dam / merdiven: hücre başına zemin kotu
    // yol ızgarası: üst kat (döşeme / dam) + ev içlerinde alt kat (zemin kat). Merdiven basamağı alt katta gövdeye giriyorsa alt düğüm kapalı.
    // towerAt / towers: bot.js setGoal üst kat hedefini (y ile) korur ve varışı kotla sayar (Kuzey Vadisi gözetleme kulesi arayüzü) → botlar Konak üst katına / dama gider
    makeNav() {
      const nav = new CgNav(this.colliders, this.bounds, this.terrain, [[K.x0, K.z0, K.x1, K.z1], [D.x0, D.z0, D.x1, D.z1], [D.x0, -D.z1, D.x1, -D.z0]], { platLow: true });
      nav.towers = [];
      nav.towerAt = (x, z, y) => { const i = nav.idx(x, z); return i >= 0 && i < nav.N && nav.uIx[i] >= 0 && !nav.blocked[i] && Math.abs(nav.floor[i] - y) < 1; };
      return nav;
    },
    callouts: CALLOUTS,
    // dolaşma noktaları ([x, z, y?]: y'li olan üst kat / dam); ilk 8'i (botTactics) üç hattın orta çizgisi + iki yan
    roamPoints: [[-25, 2.5], [0, 7], [21.5, 2.5], [-25, -2.5], [0, -7], [21.5, -2.5], [28.5, 8], [28.5, -8], [-28.5, 20], [-23.5, 9], [-16, 10.75], [20, 14], [-28.5, -20], [-23.5, -9], [-16, -10.75], [20, -14], [14, 0], [28.5, 0], [-6, 16], [6, -16],
      [22, 1.6, 3.2], [22, -1.6, 3.2], [27.5, 15.5, 3.45], [27.5, -15.5, 3.45], [25.6, 2.2], [25.6, -2.2], [28.5, 14.5], [28.5, -14.5]],
    mini: { bg: '#4a3d2a', ground: [226, 204, 158], wall: '#5a4830', mid: '#8b7550', low: '#a88f62', roof: 'rgba(110,86,52,0.45)', pit: [150, 126, 88] },
    spawns: out.spawns,
    baseZones: {
      blue: { minX: S.x0, maxX: S.x1, minZ: S.z0, maxZ: S.z1 },
      red: { minX: S.x0, maxX: S.x1, minZ: -S.z1, maxZ: -S.z0 },
    },
    // Ele Geçirme: üç bayrak orta çizgide (iki doğuşa eşit uzak): Fırın Avlusu, Meydan, Konak
    objectives: [
      { id: 'firin', name: 'Fırın Avlusu', label: 'A', x: -25, z: 0, r: 6.5, core: true },
      { id: 'meydan', name: 'Meydan', label: 'B', x: 0, z: 0, r: 9, core: true },
      { id: 'konak', name: 'Konak', label: 'C', x: 21.5, z: 0, r: 6, core: true },
    ],
    // 12.226 Bomba modu: iki bölge de kuzey yarıda (savunan kuzey Han'dan doğar, saldıran güneyden ilerler; devre arasında doğuşlar yer değiştirir).
    // A: Fırın Avlusu'nun kuzey yarısı (batı hattı) · B: Kuzey Avlu (Konak ile Kuzey Damlı Ev arası, doğu hattı)
    bombSites: [
      { name: 'A', box: [-30, -5.5, -21.5, 1], x: -25.5, z: -2.5 },
      { name: 'B', box: [23.5, -11, 32.5, -5.5], x: 28, z: -8.25 },
    ],
    roads: [],
    roadColor: '#b8a074',
    env: {
      sky: ['#5f97d2', '#c9dcea', '#f2e0bd'], fog: ['#e2cfa8', 90, 280],
      sun: ['#ffdca2', 2.7], hemi: ['#d0e0f8', '#a08452', 1.12], cloud: '#fff4e2', clouds: 10,
      sunPos: [46, 78, 30],
    },
    stats: out.stats,
  };
}
