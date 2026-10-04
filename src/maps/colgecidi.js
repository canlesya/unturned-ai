import * as THREE from 'three';
import { MapBuilder } from './builder.js';
import { Terrain, fbm } from './terrain.js';
import DATA from './colgecidiData.js';
import { makeSolidField, floorColor, decorateFaces, rngOf, wallTop, propBox, scatterPalms, buildSurround, roofTunnels, hangings } from './colgecidiArt.js';

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
  const field = makeSolidField(D);
  for (let i = 0; i < D.rects.length; i++) {
    const [x0, z0, x1, z1] = D.rects[i];
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    let lo = 1e9, hi = -1e9;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [cx, cz]]) { const g = terrain.heightAt(px, pz); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    for (const [px, pz] of [[x0 - 1.5, cz], [x1 + 1.5, cz], [cx, z0 - 1.5], [cx, z1 + 1.5]]) hi = Math.max(hi, terrain.heightAt(px, pz));
    const top = Math.ceil((hi + 6.5) * 2) / 2, y0 = lo - 0.5;
    b.box(cx, y0, cz, w, top - y0, d, wallTop(cx, cz), { tag: 'wall' });
  }

  // ── sandık / konteyner / fıçı gövdeleri (radar kutuları); sunucuda yalnızca çarpışma gövdesi ──
  for (let i = 0; i < D.boxes.length; i++) {
    if (!MapBuilder.noVisual) { propBox(b, terrain, i, D.boxes[i]); continue; }
    const [cx, cz, w, d, ry, h] = D.boxes[i];
    let lo = 1e9;
    for (const [px, pz] of [[cx, cz], [cx - w / 2, cz], [cx + w / 2, cz], [cx, cz - d / 2], [cx, cz + d / 2]]) lo = Math.min(lo, terrain.heightAt(px, pz));
    if (w * d < 1.5 && Math.max(w, d) < 1.3) b.cyl(cx, lo - 0.05, cz, Math.min(w, d) / 2, Math.min(w, d) / 2, h + 0.05, '#000', { seg: 10 });
    else b.box(cx, lo - 0.3, cz, w, h + 0.3, d, '#000', { ry, tag: 'prop' });
  }

  // ── arazi: kum, bölge tonları ──
  const fc = floorColor(field, D);
  const terrainMesh = terrain.buildMesh((x, z, h, slope, c) => fc(x, z, h, slope, c, fbm(x * 0.09, z * 0.09, 5, 3)), { smooth: true });


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
  const pickSpawns = (zone0, team, ry, pad = 3, anchor = null) => {
    const zone = [zone0[0] - pad, zone0[1] - pad, zone0[2] + pad, zone0[3] + pad];
    const [x0, z0, x1, z1] = zone, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cands = [];
    for (let x = x0 + 1; x <= x1 - 1; x += 1) for (let z = z0 + 1; z <= z1 - 1; z += 1) if (!blocked(x, z)) cands.push([x, z]);
    const [ax, az] = anchor || [cx, cz];                          // doğuşlar bu noktaya yakın seçilir (T avlusunun arka ucu: ortaya yol uzunluğunu CT ile dengeler)
    cands.sort((p, q) => Math.hypot(p[0] - ax, p[1] - az) - Math.hypot(q[0] - ax, q[1] - az));
    const picked = [];
    for (const p of cands) {
      if (picked.length >= 24) break;
      if (picked.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.0)) picked.push(p);
    }
    for (const [x, z] of picked) spawns[team].push({ x, z, ry, y: terrain.heightAt(x, z) });
  };
  pickSpawns(T_ZONE, 'blue', -PI / 2, 3, [T_ZONE[0] - 2, (T_ZONE[1] + T_ZONE[3]) / 2]);
  pickSpawns(CT_ZONE, 'red', PI / 2);

  // ── hedefler: B (KD), A (GD), Orta; büyük maçlarda Uzun A ve Tüneller ──
  const site = (k) => { const o = D.zones.orange.filter((z) => z[2] - z[0] > 6).sort((p, q) => (k === 'A' ? q[1] - p[1] : p[1] - q[1]))[0]; return [(o[0] + o[2]) / 2, (o[1] + o[3]) / 2]; };
  const A = site('A'), B = site('B');
  const objectives = [
    // Bayraklar iki doğuştan adil mesafede: Uzun A batıya (−38 m), Alt Tüneller doğuya (+36 m) yakın, Orta eşit (0). A / B sahaları CT'ye çok yakın olduğundan bayrak değil.
    { id: 'uzun', name: 'Uzun A', label: 'U', x: -15, z: 54, r: 9, core: true },
    { id: 'orta', name: 'Orta', label: 'O', x: -3.5, z: -6.4, r: 10, core: true },
    { id: 'tunel', name: 'Alt Tüneller', label: 'T', x: 16.5, z: -27, r: 8, core: true },
  ];

  if (!MapBuilder.noVisual) {                                                       // süs yalnızca görsel (sunucuda kurulmaz)
    const rng = rngOf(20241005);
    decorateFaces(b, D, terrain, field, rng);
    const avoid = [...objectives.map((o) => [o.x, o.z, 9]), ...[...spawns.blue, ...spawns.red].map((p) => [p.x, p.z, 5])];
    scatterPalms(b, terrain, field, avoid, rng, 10);
    hangings(b, terrain, field, rng, 22);
    buildSurround(b, rng);
  }
  // çatılı tüneller (radar koordinatından: alt tüneller = orta ile B arası teal şerit, üst tüneller = T'den B'ye zeytin kanal)
  roofTunnels(b, terrain, field, [[10, 18, -33, -10.5, false], [0.5, 9.5, -64, -35, false], [9, 27, -60, -54, true]]);
  const group = b.build();
  group.add(terrainMesh);

  return {
    id: 'colgecidi',
    name: 'Çöl Geçidi',
    group,
    colliders: b.colliders,
    bounds: CG_BOUNDS,
    terrain,
    sideSwap: true,
    mini: { bg: '#4a3d2a', ground: [226, 204, 158], wall: '#5a4830', mid: '#8b7550', low: '#a88f62', roof: 'rgba(110,86,52,0.45)' },
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
