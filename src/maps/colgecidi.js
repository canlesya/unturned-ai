import * as THREE from 'three';
import { MapBuilder } from './builder.js';
import { Terrain, fbm } from './terrain.js';
import DATA from './colgecidiData.js';

// Çöl Geçidi: üç hatlı (uzun koridor / orta / tüneller), iki hedef alanlı (A, B) klasik çöl haritası.
// Yapı tools/dust2_extract.py ile radar şemasından çıkarılır (colgecidiData.js); bu dosya veriyi oyuna çevirir:
// yükseklik ızgarası → arazi, duvar dikdörtgenleri → kum taşı duvarlar, kutu bileşenleri → sandık / konteyner / araç.
// Yön: Batı (-x) = T tarafı (mavi), Doğu (+x) = CT tarafı (kırmızı); B sahası kuzeydoğu (-z), A sahası güneydoğu (+z).
export const CG_BOUNDS = { minX: -75, maxX: 75, minZ: -70, maxZ: 70 };

const PI = Math.PI;
const B64 = (s) => Uint8Array.from(typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64'), (c) => (typeof c === 'string' ? c.charCodeAt(0) : c));

export function buildColGecidi() {
  const D = DATA;
  const b = new MapBuilder();
  const hb = B64(D.h);
  const hAt = (i, j) => hb[Math.max(0, Math.min(D.hnz - 1, j)) * D.hnx + Math.max(0, Math.min(D.hnx - 1, i))] / D.hscale;
  const height = (x, z) => {                                         // 1 m'lik ızgaradan çift doğrusal örnekleme
    const fx = (x - D.hx0) / D.hcell, fz = (z - D.hz0) / D.hcell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return (hAt(i, j) * (1 - u) + hAt(i + 1, j) * u) * (1 - v) + (hAt(i, j + 1) * (1 - u) + hAt(i + 1, j + 1) * u) * v;
  };
  const terrain = new Terrain({ minX: CG_BOUNDS.minX, maxX: CG_BOUNDS.maxX, minZ: CG_BOUNDS.minZ, maxZ: CG_BOUNDS.maxZ, cell: 1, height });

  // ── duvarlar: açgözlü dikdörtgenler, üst kot yerel zemin + 6,5 m (0,5 m'ye yuvarlı) ──
  const WALLS = ['#cfae72', '#c29d62', '#d6b97f', '#bd9a60'];
  for (let i = 0; i < D.rects.length; i++) {
    const [x0, z0, x1, z1] = D.rects[i];
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    let lo = 1e9, hi = -1e9;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [cx, cz]]) { const g = terrain.heightAt(px, pz); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    for (const [px, pz] of [[x0 - 1.5, cz], [x1 + 1.5, cz], [cx, z0 - 1.5], [cx, z1 + 1.5]]) hi = Math.max(hi, terrain.heightAt(px, pz));
    const top = Math.ceil((hi + 6.5) * 2) / 2, y0 = lo - 0.5;
    b.box(cx, y0, cz, w, top - y0, d, WALLS[(Math.floor(cx / 6) + Math.floor(cz / 6) + 8) & 3], { tag: 'wall' });
  }

  // ── sandık / konteyner / araç gövdeleri ──
  const CRATE = ['#8a6a3f', '#7d5f38', '#957347'], CONT = ['#3f6f9a', '#58704a', '#a0522d', '#6b7a86'];
  for (let i = 0; i < D.boxes.length; i++) {
    const [cx, cz, w, d, ry, h] = D.boxes[i];
    let lo = 1e9;
    for (const [px, pz] of [[cx, cz], [cx - w / 2, cz], [cx + w / 2, cz], [cx, cz - d / 2], [cx, cz + d / 2]]) lo = Math.min(lo, terrain.heightAt(px, pz));
    const col = h >= 2.6 ? CONT[i % CONT.length] : CRATE[i % CRATE.length];
    b.box(cx, lo - 0.3, cz, w, h + 0.3, d, col, { ry, tag: 'prop' });
  }

  // ── arazi: kum, bölge tonları ──
  const sand = new THREE.Color('#d9c28f'), sand2 = new THREE.Color('#cdb27a'), dirt = new THREE.Color('#bda06a'), stone = new THREE.Color('#bfae8a');
  const terrainMesh = terrain.buildMesh((x, z, h, slope, c) => {
    const n = fbm(x * 0.09, z * 0.09, 5, 3);
    c.copy(sand).lerp(sand2, n);
    if (x < -44) c.lerp(dirt, 0.55);                                    // T tarafı: toprak
    if (slope > 0.2) c.lerp(stone, Math.min(1, (slope - 0.2) * 3));
  }, { smooth: true });

  // ── doğuş: T avlusu (mavi, batı) ve CT avlusu (kırmızı, doğu) ──
  const T_ZONE = D.zones.green.reduce((a, g) => (g[0] < 0 ? g : a), null);                       // x < 0 olan yeşil kutu
  const ct = D.zones.green.filter((g) => g[0] > 0);
  const CT_ZONE = [Math.min(...ct.map((g) => g[0])), Math.min(...ct.map((g) => g[1])), Math.max(...ct.map((g) => g[2])), Math.max(...ct.map((g) => g[3]))];
  const spawns = { blue: [], red: [] };
  const blocked = (x, z) => {
    const gy = terrain.heightAt(x, z);
    if (terrain.slopeAt(x, z, 0.5) > 0.3) return true;
    for (const c of b.colliders) {
      if (x + 0.9 < c.min[0] || x - 0.9 > c.max[0] || z + 0.9 < c.min[2] || z - 0.9 > c.max[2]) continue;
      if (c.max[1] > gy + 0.2 && c.min[1] < gy + 1.9) return true;
    }
    return false;
  };
  const pickSpawns = (zone0, team, ry, pad = 3) => {
    const zone = [zone0[0] - pad, zone0[1] - pad, zone0[2] + pad, zone0[3] + pad];
    const [x0, z0, x1, z1] = zone, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cands = [];
    for (let x = x0 + 1; x <= x1 - 1; x += 1) for (let z = z0 + 1; z <= z1 - 1; z += 1) if (!blocked(x, z)) cands.push([x, z]);
    cands.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cz) - Math.hypot(q[0] - cx, q[1] - cz));
    const picked = [];
    for (const p of cands) {
      if (picked.length >= 24) break;
      if (picked.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.0)) picked.push(p);
    }
    for (const [x, z] of picked) spawns[team].push({ x, z, ry, y: terrain.heightAt(x, z) });
  };
  pickSpawns(T_ZONE, 'blue', -PI / 2);
  pickSpawns(CT_ZONE, 'red', PI / 2);

  // ── hedefler: B (KD), A (GD), Orta; büyük maçlarda Uzun A ve Tüneller ──
  const site = (k) => { const o = D.zones.orange.filter((z) => z[2] - z[0] > 6).sort((p, q) => (k === 'A' ? q[1] - p[1] : p[1] - q[1]))[0]; return [(o[0] + o[2]) / 2, (o[1] + o[3]) / 2]; };
  const A = site('A'), B = site('B');
  const objectives = [
    { id: 'a', name: 'A Sahası (Pazar)', label: 'A', x: A[0], z: A[1], r: 9, core: true },
    { id: 'orta', name: 'Orta', label: 'O', x: 2, z: -6.4, r: 10, core: true },
    { id: 'b', name: 'B Sahası (Avlu)', label: 'B', x: B[0], z: B[1], r: 9, core: true },
    { id: 'uzun', name: 'Uzun Koridor', label: 'U', x: -14, z: 52, r: 9 },
    { id: 'tunel', name: 'Tüneller', label: 'T', x: 7, z: -56, r: 8 },
  ];

  const group = b.build();
  group.add(terrainMesh);

  return {
    id: 'colgecidi',
    name: 'Çöl Geçidi',
    group,
    colliders: b.colliders,
    bounds: CG_BOUNDS,
    terrain,
    spawns,
    baseZones: {
      blue: { minX: -72, maxX: -46, minZ: -42, maxZ: 8 },
      red: { minX: 30, maxX: 56, minZ: 0, maxZ: 30 },
    },
    objectives,
    roads: [],
    roadColor: '#b8a074',
    env: {
      sky: ['#5f9fdc', '#c3dcef', '#f6e9cf'], fog: ['#e6d9b8', 140, 360],
      sun: ['#ffe3b0', 2.7], hemi: ['#d6e6ff', '#9b8458', 1.15], cloud: '#fff6e8', clouds: 14,
      sunPos: [50, 80, 25],
    },
  };
}
