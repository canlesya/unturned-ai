import * as THREE from 'three';
import { MapBuilder } from './builder.js';
import { Terrain, fbm } from './terrain.js';
import DATA from './colgecidiData.js';
import { car } from './kit.js';
import { makeSolidField, floorColor, decorateFaces, rngOf, wallTop, propBox, scatterPalms, buildSurround, roofTunnels, hangings, findDoor, doorFrame, dishes, ads, siteSign } from './colgecidiArt.js';

// Çöl Geçidi: üç hatlı (uzun koridor / orta / tüneller), iki hedef alanlı (A, B) klasik çöl haritası.
// Yapı tools/dust2_extract.py ile radar şemasından çıkarılır (colgecidiData.js); bu dosya veriyi oyuna çevirir:
// yükseklik ızgarası → arazi, duvar dikdörtgenleri → kum taşı duvarlar, kutu bileşenleri → sandık / konteyner / araç.
// Yön (standart, radar gibi): T güney (+z), CT kuzey (−z), A sahası doğu (+x), B sahası batı (−x). Takım renkleri her maç yer değiştirir (sideSwap).
export const CG_BOUNDS = { minX: -70, maxX: 70, minZ: -76, maxZ: 76 };

const PI = Math.PI;
const B64 = (s) => Uint8Array.from(typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64'), (c) => (typeof c === 'string' ? c.charCodeAt(0) : c));

// Bölge adları (standart oyun yer isimleri): callout görselindeki etiket merkezleri (px) → dünya. u=(x−277)/0.87, v=(y−94.5)/0.87 → X=(u−460)·0.143, Z=(v−495.5)·0.143
const CALL_PX = [
  ['T Spawn', 570, 882, 1], ['Titanic', 447, 800], ['Outside Tunnels', 387, 660, 1], ['Suicide', 633, 748], ['Outside Long', 806, 728, 1], ['Top Mid', 702, 637, 1], ['Palm', 684, 593], ['Green', 590, 628],
  ['Long Doors', 842, 617], ['Side Pit', 931, 620], ['Pit', 997, 620], ['Blue', 875, 495], ['Long Corner', 977, 480], ['Long', 997, 390, 1], ['Car (Long)', 1056, 312], ['Ramp', 995, 230], ['Barrels', 1003, 155], ['Goose', 945, 118],
  ['A Site', 933, 226, 1], ['Ninja', 807, 174], ['Boost', 871, 256], ['Elevator', 892, 293], ['CT Spawn', 747, 255, 1], ['Short Stairs', 797, 330], ['Stairs', 792, 380], ['Short', 753, 436, 1], ['Xbox', 660, 438], ['Cat', 680, 523], ['Mid', 640, 515, 1],
  ['Mid Doors', 640, 398], ['Lower Tunnels', 554, 438], ['Upper Tunnels', 350, 480, 1], ['CT Mid', 590, 267, 1], ['B Doors', 447, 284], ['Window', 505, 192], ['B Site', 402, 204, 1], ['B Plat', 343, 182], ['Back Plat', 318, 118], ['Box', 344, 251], ['Fence', 285, 293], ['Car (B)', 415, 355],
];
const px2w = (x, y) => [((x - 277) / 0.87 - 460) * 0.143, ((y - 94.5) / 0.87 - 495.5) * 0.143];
export const CALLOUTS = CALL_PX.map(([name, x, y, major]) => { const [wx, wz] = px2w(x, y); return { name, x: +wx.toFixed(1), z: +wz.toFixed(1), major: !!major }; });

export function buildColGecidi() {
  const D = DATA;
  const b = new MapBuilder();
  const hb = B64(D.h);
  const hAt = (i, j) => hb[Math.max(0, Math.min(D.hnz - 1, j)) * D.hnx + Math.max(0, Math.min(D.hnx - 1, i))] / D.hscale;
  const height = (x, z) => {                                         // yükseklik ızgarasından çift doğrusal örnekleme
    const fx = (x - D.hx0) / D.hcell, fz = (z - D.hz0) / D.hcell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return (hAt(i, j) * (1 - u) + hAt(i + 1, j) * u) * (1 - v) + (hAt(i, j + 1) * (1 - u) + hAt(i + 1, j + 1) * u) * v;
  };
  const terrain = new Terrain({ minX: CG_BOUNDS.minX, maxX: CG_BOUNDS.maxX, minZ: CG_BOUNDS.minZ, maxZ: CG_BOUNDS.maxZ, cell: 0.5, height });                      // 0,5 m: kat kenarları keskin kalsın

  // ── duvarlar: açgözlü dikdörtgenler. Bina kütleleri yerel zemin + 5,5–9 m (12 m'lik bloklara göre değişir), bölme duvarları + 3 m ──
  const field = makeSolidField(D);
  const bh = (x, z) => 5.5 + ((Math.abs(Math.floor(x / 12) * 83492791 ^ Math.floor(z / 12) * 29647) >>> 0) % 8) * 0.5;
  for (let i = 0; i < D.rects.length + D.divs.length; i++) {
    const div = i >= D.rects.length, [x0, z0, x1, z1] = div ? D.divs[i - D.rects.length] : D.rects[i];
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    let lo = 1e9, hi = -1e9;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [cx, cz]]) { const g = terrain.heightAt(px, pz); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    for (const [px, pz] of [[x0 - 1.5, cz], [x1 + 1.5, cz], [cx, z0 - 1.5], [cx, z1 + 1.5]]) hi = Math.max(hi, terrain.heightAt(px, pz));
    const top = div ? Math.ceil((lo + 3.0) * 2) / 2 : Math.ceil((hi + bh(Math.round(cx / 12) * 12, Math.round(cz / 12) * 12)) * 2) / 2, y0 = lo - 0.5;
    b.box(cx, y0, cz, w, top - y0, d, wallTop(cx, cz), { tag: 'wall' });
  }

  // ── sandık / konteyner / fıçı gövdeleri (radar kutuları); sunucuda yalnızca çarpışma gövdesi ──
  // ── kat kenarları: radar yüksekliğindeki keskin geçişler (sahanlık, çukur, platform kenarı) → taş istinat duvarı + üst kenar şeridi ──
  for (const [dir, p, a0, a1, lo, hi] of D.cliffs || []) {
    const L = a1 - a0, c = (a0 + a1) / 2, x = dir === 0 ? p : c, z = dir === 0 ? c : p, w = dir === 0 ? 0.55 : L + 0.02, d = dir === 0 ? L + 0.02 : 0.55;
    b.box(x, lo - 0.35, z, w, hi - lo + 0.39, d, '#b8996a', { tag: 'ledge' });
    if (!MapBuilder.noVisual) b.box(x, hi - 0.02, z, dir === 0 ? 0.7 : L + 0.04, 0.14, dir === 0 ? L + 0.04 : 0.7, '#d9c08c', { collide: false });
    // A platosunun kenarı (A Default / A Plat): üstte ~0,9 m korkuluk duvarı (fotoğraflardaki alçak parapet)
    if (hi >= 4.0 && hi - lo >= 1.5 && x > 28 && x < 62 && z > -62 && z < -38) {
      b.box(x, hi, z, dir === 0 ? 0.4 : L + 0.02, 0.95, dir === 0 ? L + 0.02 : 0.4, '#cfb27c', { tag: 'rail' });
      if (!MapBuilder.noVisual) b.box(x, hi + 0.95, z, dir === 0 ? 0.55 : L + 0.06, 0.1, dir === 0 ? L + 0.06 : 0.55, '#e6cf9c', { collide: false });
    }
  }

  // ── Short köprüsü: CT Spawn'ın üstünden A platosuna geçen tabliye (yürünür 'plat'), iki yanda korkuluk, altta iki ayak ──
  const BR = D.bridge;
  if (BR) {
    const [bx0, bz0, bx1, bz1, top] = BR, bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2, bw = bx1 - bx0, bd = bz1 - bz0;
    b.box(bcx, top - 0.45, bcz, bw, 0.45, bd + 2.4, '#c2a46f', { tag: 'plat' });                       // uçlarda 1,2 m bindirme: kat kenarı (uçurum) bandını örter
    // Batı yüzü: tabliyeden yukarı dolu bina duvarı (Short'tan CT Spawn görünmez); altı açık kalır (CT ↔ kemer geçidi)
    const WT = 11.5, rz0 = -47.1, rz1 = bz1 + 0.3;                                                     // doğu korkuluğu yalnız avlunun üstünde: kuzeyde A yoluna (z < −47) geçiş açık
    b.box(bx0 + 0.25, top - 0.45, bcz, 0.5, WT - top + 0.45, bd + 0.6, wallTop(bx0, bcz), { tag: 'wall' });
    b.box(bx1 - 0.15, top, (rz0 + rz1) / 2, 0.3, 1.05, rz1 - rz0, '#cdb07a', { tag: 'rail' });
    if (!MapBuilder.noVisual) {
      b.box(bcx, top - 0.6, bcz, bw + 0.3, 0.16, bd + 0.6, '#9c8156', { collide: false });                 // tabliye alt kirişi
      b.box(bx1 - 0.15, top + 1.05, (rz0 + rz1) / 2, 0.42, 0.1, rz1 - rz0, '#e2c995', { collide: false });
      b.box(bx0 + 0.1, top - 0.75, bcz, 0.4, 0.35, bd + 0.6, '#7a5b3a', { collide: false });             // batı duvarının altında ahşap lento (CT tarafından)
      b.box(bx0 + 0.55, WT - 0.3, bcz, 0.2, 0.3, bd + 0.6, '#e2c995', { collide: false });               // duvar tepesi şeridi
    }
    for (const sx of [bx0 + 0.35, bx1 - 0.35]) { const gy = terrain.heightAt(sx, bcz); b.box(sx, gy - 0.3, bcz, 0.7, top - 0.45 - gy + 0.3, 0.7, '#b8996a', { tag: 'wall' }); }
    // Doğu yüzü: A önü avluya açılan ahşap kemerli geçit (A'dan CT Spawn görünür). Kemer üstü duvar köprü korkuluğuna kadar.
    if (!MapBuilder.noVisual) {
      const ax = bx1 + 0.25, az0 = -46.3, az1 = -34.9, span = az1 - az0, amid = (az0 + az1) / 2, wood = '#7a5b3a', woodD = '#5e4529';
      const gy = Math.min(terrain.heightAt(ax + 0.6, az0), terrain.heightAt(ax + 0.6, az1));
      for (const zz of [az0 + 0.2, az1 - 0.2]) b.box(ax, gy - 0.2, zz, 0.45, top - gy - 0.2, 0.45, wood, { collide: false });        // direkler
      b.box(ax, top - 0.75, amid, 0.5, 0.35, span, wood, { collide: false });                                                           // üst kiriş
      for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, zz = az0 + t * span, y = top - 1.25 + Math.sin(t * Math.PI) * 0.55; b.box(ax + 0.05, y, zz, 0.42, 0.28, span / 7 + 0.05, woodD, { collide: false, rx: Math.cos(t * Math.PI) * 0.35 }); }   // kemer
      b.box(ax - 0.05, top - 0.45, amid, 0.35, 1.6, span + 0.6, '#cdb07a', { collide: false });                                         // kemer üstü duvar (korkuluğa kadar)
      for (let zz = bz0 + 0.5; zz < bz1; zz += 1.1) b.box(bcx, top - 0.62, zz, bw - 0.4, 0.12, 0.16, woodD, { collide: false });        // köprü altı tavan kirişleri
    }
  }

  // Arabalar (Long ve B) ve Long'daki mavi konteyner: radar kutusu yerine model / özel renk
  const nearBox = (name, minArea) => { const c = CALLOUTS.find((q) => q.name === name); let best = -1, bd = 7; D.boxes.forEach((q, i) => { const d = Math.hypot(q[0] - c.x, q[1] - c.z); if (q[2] * q[3] >= minArea && d < bd) { bd = d; best = i; } }); return best; };
  const CARS = [[nearBox('Car (Long)', 6), '#5fa6a0'], [nearBox('Car (B)', 6), '#e9e6dc']].filter((q) => q[0] >= 0), BLUE = nearBox('Blue', 8);
  for (const [bi, col] of CARS) { const [cx, cz, , , ry] = D.boxes[bi]; b.with(0, terrain.heightAt(cx, cz), 0, 0, () => car(b, { x: cx, z: cz, ry, color: col })); }
  const isCar = new Set(CARS.map((q) => q[0]));
  for (let i = 0; i < D.boxes.length; i++) {
    if (isCar.has(i)) continue;
    if (!MapBuilder.noVisual) { propBox(b, terrain, i, D.boxes[i], i === BLUE ? '#2f6aa8' : null); continue; }
    const [cx, cz, w, d, ry, h] = D.boxes[i];
    let lo = 1e9;
    for (const [px, pz] of [[cx, cz], [cx - w / 2, cz], [cx + w / 2, cz], [cx, cz - d / 2], [cx, cz + d / 2]]) lo = Math.min(lo, terrain.heightAt(px, pz));
    if (w * d < 1.5 && Math.max(w, d) < 1.3) b.cyl(cx, lo - 0.05, cz, Math.min(w, d) / 2, Math.min(w, d) / 2, h + 0.05, '#000', { seg: 10 });
    else b.box(cx, lo - 0.3, cz, w, h + 0.3, d, '#000', { ry, tag: 'prop' });
  }

  // ── arazi: kum, bölge tonları ──
  const fc = floorColor(field, D);
  const terrainMesh = terrain.buildMesh((x, z, h, slope, c) => fc(x, z, h, slope, c, fbm(x * 0.09, z * 0.09, 5, 3)), { smooth: true });


  // ── doğuş: T avlusu (mavi, güney) ve CT avlusu (kırmızı, kuzey) ──
  const T_ZONE = D.zones.green.reduce((a, g) => (g[1] > 0 ? g : a), null);                        // z > 0 olan yeşil kutu
  const ct = D.zones.green.filter((g) => g[1] < 0);
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
    const underBridge = (x, z) => D.bridge && x > D.bridge[0] - 1 && x < D.bridge[2] + 1 && z > D.bridge[1] - 1 && z < D.bridge[3] + 1;     // köprü altına doğuş yok (yol bulma köprü katını görür)
    for (let x = x0 + 1; x <= x1 - 1; x += 1) for (let z = z0 + 1; z <= z1 - 1; z += 1) if (!blocked(x, z) && !underBridge(x, z)) cands.push([x, z]);
    const [ax, az] = anchor || [cx, cz];                          // doğuşlar bu noktaya yakın seçilir (T avlusunun arka ucu: ortaya yol uzunluğunu CT ile dengeler)
    cands.sort((p, q) => Math.hypot(p[0] - ax, p[1] - az) - Math.hypot(q[0] - ax, q[1] - az));
    const picked = [];
    for (const p of cands) {
      if (picked.length >= 24) break;
      if (picked.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.0)) picked.push(p);
    }
    for (const [x, z] of picked) spawns[team].push({ x, z, ry, y: terrain.heightAt(x, z) });
  };
  pickSpawns(T_ZONE, 'blue', 0, 3, [(T_ZONE[0] + T_ZONE[2]) / 2, T_ZONE[3] + 2]);               // T kuzeye (orta / uzun) bakar; avlunun arka ucundan seçilir
  pickSpawns(CT_ZONE, 'red', PI);                                                                // CT güneye bakar
  // CT avlusu iki parça: yeşil kutu + köprünün doğusundaki kemer avlusu (A'ya Elevator'dan çıkış). Doğuşların yarısı avluya.
  if (D.bridge) { const all = spawns.red; spawns.red = all.slice(0, 12); pickSpawns([26.5, -46, 36.5, -36], 'red', PI, 0); spawns.red = spawns.red.slice(0, 24); for (const p of all.slice(12)) if (spawns.red.length < 24) spawns.red.push(p); }

  // ── hedefler: B (KD), A (GD), Orta; büyük maçlarda Uzun A ve Tüneller ──
  const site = (k) => { const o = D.zones.orange.filter((z) => z[2] - z[0] > 6).sort((p, q) => (k === 'A' ? q[1] - p[1] : p[1] - q[1]))[0]; return [(o[0] + o[2]) / 2, (o[1] + o[3]) / 2]; };
  const A = site('A'), B = site('B');
  const objectives = [
    // Bayraklar iki doğuştan adil mesafede: Uzun A batıya (−38 m), Alt Tüneller doğuya (+36 m) yakın, Orta eşit (0). A / B sahaları CT'ye çok yakın olduğundan bayrak değil.
    { id: 'uzun', name: 'Uzun A', label: 'U', x: 54, z: 15, r: 9, core: true },
    { id: 'orta', name: 'Orta', label: 'O', x: -6.4, z: 3.5, r: 10, core: true },
    { id: 'tunel', name: 'Alt Tüneller', label: 'T', x: -27, z: -16.5, r: 8, core: true },
  ];

  if (!MapBuilder.noVisual) {                                                       // süs yalnızca görsel (sunucuda kurulmaz)
    const rng = rngOf(20241005);
    decorateFaces(b, D, terrain, field, rng);
    const avoid = [...objectives.map((o) => [o.x, o.z, 9]), ...[...spawns.blue, ...spawns.red].map((p) => [p.x, p.z, 5])];
    scatterPalms(b, terrain, field, avoid, rng, 10);
    hangings(b, terrain, field, rng, 26);
    dishes(b, terrain, D.rects, rng, 30);
    ads(b, terrain, D.faces, field, rng, 14);
    siteSign(b, terrain, D.faces, CALLOUTS.find((q) => q.name === 'A Site'), 'A'); siteSign(b, terrain, D.faces, CALLOUTS.find((q) => q.name === 'B Site'), 'B');
    for (const nm of ['Long Doors', 'Mid Doors', 'B Doors', 'Outside Tunnels']) { const c = CALLOUTS.find((q) => q.name === nm), dr = c && findDoor(field, c.x, c.z, nm === 'Outside Tunnels' ? 14 : 8); if (dr) doorFrame(b, terrain, dr); }
    buildSurround(b, rng);
  }
  // çatılı tüneller (radar koordinatından: alt tüneller = orta ile B arası teal şerit, üst tüneller = T'den B'ye zeytin kanal)
  roofTunnels(b, terrain, field, [[-33, -10.5, -18, -10, true], [-64, -35, -9.5, -0.5, true], [-60, -54, -27, -9, false]]);
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
    layered: true,                                                  // Short köprüsü üst üste iki kat: yol bulma hücre başına zemin kotu tutar
    callouts: CALLOUTS,
    // takım çatışmasında botlar için hat noktaları (iki doğuşa dengeli dağılım): Orta, Uzun, Tüneller, Kısa, A rampası, B kapısı, CT orta, dış T alanları
    roamPoints: [[-6.4, 3.5], [-6, -20], [14, -28], [54, 15], [53, -3.6], [41, -28], [-55.8, -6.5], [-27, -16.5], [-30, -40], [-8, -38], [50, 30], [-30, 40]],
    mini: { bg: '#4a3d2a', ground: [226, 204, 158], wall: '#5a4830', mid: '#8b7550', low: '#a88f62', roof: 'rgba(110,86,52,0.45)' },
    spawns,
    baseZones: {
      blue: { minX: -42, maxX: 12, minZ: 42, maxZ: 76 },
      red: { minX: 0, maxX: 32, minZ: -58, maxZ: -28 },
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
