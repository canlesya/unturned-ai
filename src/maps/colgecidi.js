import * as THREE from 'three';
import { MapBuilder } from './builder.js';
import { Terrain, fbm } from './terrain.js';
import DATA from './colgecidiData.js';
import { car } from './kit.js';
import { makeSolidField, floorColor, decorateEdges, buildPolys, polyColorAt, rngOf, wallTop, propBox, obbCollide, scatterPalms, buildSurround, roofTunnels, findDoor, doorFrame, gateDoor, dishes, ads, siteSign } from './colgecidiArt.js';

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
  const hAt = (i, j) => hb[Math.max(0, Math.min(D.hnz - 1, j)) * D.hnx + Math.max(0, Math.min(D.hnx - 1, i))] / D.hscale + (D.hoff || 0);
  const height = (x, z) => {                                         // yükseklik ızgarasından çift doğrusal örnekleme
    const fx = (x - D.hx0) / D.hcell, fz = (z - D.hz0) / D.hcell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return (hAt(i, j) * (1 - u) + hAt(i + 1, j) * u) * (1 - v) + (hAt(i, j + 1) * (1 - u) + hAt(i + 1, j + 1) * u) * v;
  };
  // zemin ağı köşeleri yükseklik verisinin köşeleriyle çakışır (kayık olursa her keskin kat kenarı 1 m'lik eğime yayılıp istinat duvarının önüne taşar)
  const al = (v, o) => o - Math.ceil((o - v) / D.hcell) * D.hcell;
  const terrain = new Terrain({ minX: al(CG_BOUNDS.minX, D.hx0), maxX: CG_BOUNDS.maxX, minZ: al(CG_BOUNDS.minZ, D.hz0), maxZ: CG_BOUNDS.maxZ, cell: D.hcell, height });
  terrain.deepWater = -1e9;                                                         // su yok: Pit sıfırın altında yürünür

  // ── binalar: tek tip kum taşı kütleler. Görsel = sadeleştirilmiş çokgen (düz / çapraz kenar, tek tepe kotu); çarpışma = aynı çokgenin 0,25 m'lik
  //    raster dikdörtgenleri (görünmez). Süsler yalnızca çokgen kenarlarına (decorateEdges). Bkz. tools/dust2_extract.py "BİNA KÜTLELERİ".
  const field = makeSolidField(D);
  // ── çevre duvarı: radar kapsamının dışı (arazi sınırlara kadar uzanır) tek parça yüksek duvarla kapalı. Güney kenar 1 m içeriden başlar (T Spawn'ın
  //    güney binası bu çizgide). Harita dışına çıkış olmasın: scripts/cgleak.mjs denetler.
  { const X0 = D.x0, X1 = D.x0 + D.nx * D.cell, Z0 = D.z0, Z1 = D.z0 + D.nz * D.cell, H = 16, col = wallTop(0, 0), E = 8;
    const wall = (x0, z0, x1, z1) => { b.collide((x0 + x1) / 2, -2, (z0 + z1) / 2, x1 - x0, H, z1 - z0, 'wall'); if (!MapBuilder.noVisual) b.box((x0 + x1) / 2, -2, (z0 + z1) / 2, x1 - x0, H, z1 - z0, col, { collide: false }); };
    wall(X0 - E, Z1 - 1.0, X1 + E, Z1 + E);       // güney
    wall(X0 - E, Z0 - E, X1 + E, Z0);             // kuzey
    wall(X1, Z0 - E, X1 + E, Z1 + E);             // doğu
    wall(X0 - E, Z0 - E, X0, Z1 + E);             // batı
  }
  for (const [x0, z0, x1, z1, top, base] of D.rects) b.collide((x0 + x1) / 2, base, (z0 + z1) / 2, x1 - x0, top - base, z1 - z0, 'wall');
  if (!MapBuilder.noVisual) buildPolys(b, D.polys);

  // ── sandık / konteyner / fıçı gövdeleri (radar kutuları); sunucuda yalnızca çarpışma gövdesi ──
  // ── kat kenarları (istinat duvarı): tools/dust2_extract.py zincirleyip sadeleştirir → düz / çapraz tek duvar parçaları, TEPESİ DÜZ.
  //    Çarpışma (cliffs) görselle (cliffv) aynı tepe kotunu kullanır. A platosu kenarında duvarın kendisi ~0,95 m yukarı uzar (parapet; üstüne ayrı duvar
  //    konmaz). Pit ↔ Side Pit çizgisi atlanır (aşağıda baştan sona tek alçak duvar).
  // Pit'in batı kenarı (Side Pit ↔ Pit, x ≈ 48): standart istinat duvarı + 0,7 m korkuluk (Side Pit tarafında bel hizası duvar).
  const isPit = (x, z) => x > 46.6 && x < 48.8 && z > 6.8 && z < 26.0;
  const isPara = (x, z, lo, hi, alongX) => hi >= 4.0 && hi - lo >= 1.5 && (x > 28 || (alongX && x > 22.9)) && x < 62 && z > -62 && z < -38;
  const isTRim = (x, z, alongX) => alongX && x > -11.5 && x < -4.5 && z > 51.5 && z < 53.8;           // T platosunun kuzey kenarı (Mid'e bakan): çömelince arkasından nişan alınır
  const extra = (x, z, lo, hi, alongX) => (isPara(x, z, lo, hi, alongX) ? 0.95 : !alongX && isPit(x, z) ? 0.7 : isTRim(x, z, alongX) ? 0.8 : 0.04);
  for (const [dir, p, a0, a1, lo, hi] of D.cliffs || []) {
    const L = a1 - a0, c = (a0 + a1) / 2, x = dir === 0 ? p : c, z = dir === 0 ? c : p, ex = extra(x, z, lo, hi, dir !== 0);
    b.collide(x, lo - 0.35, z, dir === 0 ? 0.55 : L + 0.02, hi + ex - lo + 0.35, dir === 0 ? L + 0.02 : 0.55, ex > 0.5 ? 'rail' : 'ledge');
  }
  if (!MapBuilder.noVisual) for (const [x0, z0, x1, z1, lo, hi] of D.cliffv || []) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, alongX = Math.abs(dx) >= Math.abs(dz);
    const top = hi + extra(mx, mz, lo, hi, alongX), ry = Math.atan2(-dz, dx), low = hi - lo < 0.9;
    b.box(mx, lo - 0.35, mz, L + 0.3, top - lo + 0.35, 0.58, low ? '#d9c38f' : '#b8996a', { ry, collide: false });          // gövde: tek parça, düz tepe (alçak basamak = kum rengi)
    if (!low) b.box(mx, top - 0.02, mz, L + 0.34, 0.14, 0.78, '#d9c08c', { ry, collide: false });                       // üst şerit yalnız yüksek duvarda
  }

  // sandık yığını: [x, z, kat] (kat başına 0,9 m, 1,2 m'lik küp), g taban kotu
  function crates(list, g) {
    for (const [cx, cz, lvl] of list) {
      const y = g + lvl * 0.9;
      b.box(cx, y - (lvl ? 0 : 0.3), cz, 1.2, 0.9 + (lvl ? 0 : 0.3), 1.2, lvl ? '#a6834f' : '#9b7a4a', { tag: 'prop' });
      if (!MapBuilder.noVisual) { b.box(cx, y + 0.86, cz, 1.26, 0.08, 1.26, '#bf9a62', { collide: false }); b.box(cx, y + 0.4, cz, 1.24, 0.08, 1.24, '#6e5535', { collide: false }); }
    }
  }
  // ── B penceresi (B sahası ↔ Window): çerçevesiz düz duvar açıklığı (fotoğraftaki gibi). Duvar x −37…−36 (OVERRIDE_FILL), açıklık z −49…−46,2;
  //    alt kenar B zemininden 1,8 m, açıklık 2,2 m yüksek. B tarafında 3 sandık (biri yerde, ikisi üst üste) basamak, Window tarafında kum yığını.
  { const wx0 = -37.0, wx1 = -36.0, z0 = -49.0, z1 = -46.2, gB = terrain.heightAt(-38, -47.5), sill = gB + 1.8, lint = sill + 2.2;
    const [col, ptop] = polyColorAt(D.polys, -36.5, -52), top = ptop ?? gB + 7.5;
    b.box((wx0 + wx1) / 2, gB - 0.6, (z0 + z1) / 2, wx1 - wx0, sill - gB + 0.6, z1 - z0, col, { tag: 'wall' });
    b.box((wx0 + wx1) / 2, lint, (z0 + z1) / 2, wx1 - wx0, top - lint, z1 - z0, col, { tag: 'wall' });
    crates([[-39.4, -47.6, 0], [-37.95, -47.6, 0], [-37.95, -47.6, 1]], gB);
  }
  // Xbox: Mid'den catwalk'a 3 sandıkla sıçranarak çıkılır (biri yerde, ikisi üst üste; üstü catwalk kotunda)
  crates([[-4.0, -10.7, 0], [-2.35, -10.7, 0], [-2.35, -10.7, 1]], terrain.heightAt(-3, -10.7));

  // ── Short köprüsü: tek yapı. Tabliye (yürünür 'plat') x 15…23, z −51…−35, üstü 4,6 m. Batı: tabliyeden 11,5 m'ye dolu duvar (Short'tan CT
  //    görünmez). Doğu: 1,7 m'lik tek parça korkuluk duvarı (üstüne çıkılamaz), kuzeyde A yoluna geçiş açık. Altı: ortada iki taş ayak, kuzey ucu dolu,
  //    güneyi CT ↔ A avlusu geçidi (doğu yüzünde dikdörtgen ahşap çerçeve: iki direk + kiriş).
  const BR = D.bridge;
  if (BR) {
    const [bx0, bz0, bx1, bz1, top] = BR, bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2, bw = bx1 - bx0, bd = bz1 - bz0;
    const wallc = wallTop(bx0, bcz), wood = '#7a5b3a', woodD = '#5e4529', NC = { collide: false };
    const WT = top + 3.4, rz0 = -47.1, rz1 = bz1 + 0.3, rh = 0.95, COL_N = -43.35;     // batı duvarı tabliyeden 3,4 m (Short'tan gelen üstünden görünür); COL_N: CT'deki kolonun kuzey yüzü
    b.box(bcx, top - 0.45, bcz, bw, 0.45, bd + 2.4, '#c2a46f', { tag: 'plat' });                          // tabliye (uçlarda 1,2 m bindirme: kat kenarı bandını örter)
    b.box(bx0 + 0.25, top - 0.45, bcz, 0.5, WT - top + 0.45, bd + 0.6, wallc, { tag: 'wall' });             // batı duvarı
    b.box(bx1 - 0.25, top - 0.45, (rz0 + rz1) / 2, 0.5, rh + 0.45, rz1 - rz0, wallc, { tag: 'wall' });      // doğu korkuluk duvarı (A platosu parapetiyle aynı yükseklik)
    for (const sx of [bx0 + 0.35, bx1 - 0.35]) { const gy = terrain.heightAt(sx, bcz); b.box(sx, gy - 0.3, bcz, 0.7, top - 0.45 - gy + 0.3, 0.7, '#b8996a', { tag: 'wall' }); }   // orta ayaklar
    // Kemerin kuzey yarısı: yalnız ince cephe duvarı (ahşap çerçeveyle aynı hizada, x 22,83–23,28); arkası (köprü altı) boş kalır.
    { const fz0 = bz0 - 1.2, fx0 = bx1 - 0.17, fx1 = bx1 + 0.28; b.box((fx0 + fx1) / 2, -0.5, (fz0 + COL_N) / 2, fx1 - fx0, top - 0.45 + 0.5, COL_N - fz0, wallc, { tag: 'wall' }); }
    { const sx0 = bx1 - 0.1, sx1 = bx1 + 0.28, sz0 = -34.95, sz1 = -33.9; b.box((sx0 + sx1) / 2, -0.5, (sz0 + sz1) / 2, sx1 - sx0, WT + 0.5, sz1 - sz0, wallc, { tag: 'wall' }); }   // kemerin güney direği ile güney bina arası yarık kapalı
    if (!MapBuilder.noVisual) {
      b.box(bx0 + 0.25, WT - 0.07, bcz, 0.78, 0.14, bd + 0.74, '#d9c08c', NC);                           // üst şeritler (duvarla tek gövde gibi)
      b.box(bx1 - 0.25, top + rh - 0.07, (rz0 + rz1) / 2, 0.78, 0.14, rz1 - rz0 + 0.14, '#d9c08c', NC);
      b.box(bcx, top - 0.6, bcz, bw + 0.3, 0.16, bd + 0.6, '#9c8156', NC);                                 // tabliye alt kirişi
      for (let zz = COL_N + 0.5; zz < bz1; zz += 1.1) b.box(bcx, top - 0.62, zz, bw - 0.4, 0.12, 0.16, woodD, NC);   // tavan kirişleri (yalnız açık kısım)
      const ax = bx1 + 0.05, az0 = COL_N, az1 = -34.9, gy = Math.min(terrain.heightAt(ax + 0.6, az0), terrain.heightAt(ax + 0.6, az1));
      for (const zz of [az0 + 0.22, az1 - 0.22]) b.box(ax, gy - 0.2, zz, 0.45, top - 0.45 - gy + 0.2, 0.45, wood, NC);   // direkler
      b.box(ax, top - 1.0, (az0 + az1) / 2, 0.5, 0.4, az1 - az0, wood, NC);                              // üst kiriş
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
    const [cx, cz, w, d, ry, h, yoff = 0] = D.boxes[i];
    let lo = 1e9;
    for (const [px, pz] of [[cx, cz], [cx - w / 2, cz], [cx + w / 2, cz], [cx, cz - d / 2], [cx, cz + d / 2]]) lo = Math.min(lo, terrain.heightAt(px, pz));
    if (yoff) lo = Math.max(lo, terrain.heightAt(cx, cz)) + yoff + 0.3;
    if (w * d < 1.5 && Math.max(w, d) < 1.3) b.cyl(cx, lo - 0.05, cz, Math.min(w, d) / 2, Math.min(w, d) / 2, h + 0.05, '#000', { seg: 10 });
    else obbCollide(b, cx, lo - 0.3, cz, w, h + 0.3, d, ry);
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

  // büyük ahşap kapılar (radardaki kanat çizgilerinin yerinde; koridoru kesen alçak duvar + taş çerçeve + aralık kanatlar). Çarpışma sunucuda da.
  const GATES = [
    { name: 'Mid Doors', axis: 'x', z: -21.4, a0: -12.4, a1: -3.3, c: -7.8, W: 4.4, swing: 1, aL: 22, aR: 68 },
    { name: 'B Doors', axis: 'z', x: -36.5, a0: -42.0, a1: -35.3, c: -38.6, W: 4.6, swing: 1, aL: 28, aR: 66 },
    { name: 'Long Doors (iç)', axis: 'x', z: 7.6, a0: 24.2, a1: 31.9, c: 27.0, W: 4.4, swing: -1, aL: 24, aR: 70 },      // kanatlar Long'a açılır (oda içindeki sandıklara değil)
    { name: 'Long Doors', axis: 'x', z: 22.4, a0: 22.4, a1: 31.9, c: 27.4, W: 4.6, swing: -1, aL: 24, aR: 68 },      // Outside Long → Long koridoru girişi (T tarafı)
  ];
  for (const g of GATES) gateDoor(b, terrain, g);
  // çatılı tüneller (radar koordinatından: alt tüneller = orta ile B arası teal şerit, üst tüneller = T'den B'ye zeytin kanal)
  const TUNNELS = [[-33, -10.5, -18, -10, true], [-64, -35, -13.6, -0.5, true], [-60, -54, -27, -9, false], [-53, -43.5, -0.5, 13.0, false], [-37, -26, -10.5, -1.0, true]];
  roofTunnels(b, terrain, field, TUNNELS);
  // Lower Tunnels'ın Mid tarafındaki ağzı: güneydeki yüksek bina (7,5 m) ağzın üstünden kuzeydeki binaya uzar (üst kapalı; geçit çatı hizasından 4,05 m'ye kadar açık).
  //   Aynı duvar rengi / çatı rengi / korniş (decorateEdges ile aynı dil): sonradan eklenmiş yama gibi durmaz.
  { const lx0 = -11.0, lx1 = -9.3, lz0 = -15.95, lz1 = -12.35, [lcol, ltop] = polyColorAt(D.polys, -10.5, -10), top = ltop ?? 7.5, y0 = 4.05;
    b.collide((lx0 + lx1) / 2, y0, (lz0 + lz1) / 2, lx1 - lx0, top - y0, lz1 - lz0, 'wall');
    if (!MapBuilder.noVisual) {
      b.box((lx0 + lx1) / 2, y0, (lz0 + lz1) / 2, lx1 - lx0, top - y0, lz1 - lz0, lcol, { collide: false });
      b.box((lx0 + lx1) / 2, top - 0.01, (lz0 + lz1) / 2, lx1 - lx0, 0.02, lz1 - lz0, wallTop(0, 0), { collide: false });                    // üst yüz (bina çatı tonu)
      b.box(lx1 + 0.08, top - 0.45, (lz0 + lz1) / 2, 0.2, 0.3, lz1 - lz0 + 0.04, '#e2c995', { collide: false });                              // korniş
      b.box(lx1 - 0.2, top - 0.02, (lz0 + lz1) / 2, 0.66, 0.14, lz1 - lz0 + 0.04, '#c9ad78', { collide: false });                             // duvar tepesi şeridi
    } }
  // spiral çatısı (7,9 m) ile Lower Tunnels çatısı (4,3 m) birleşim yerindeki dikey aralık: ince duvar panelini çatılar arasına (4,5 → 8,0 m) koy
  { const gy = terrain.heightAt(-28, -10.5); b.box(-28.25, 4.5, -10.45, 7.5, 3.55, 0.35, '#8a7551', { tag: 'roof' }); void gy; }
  // süs konmayan alanlar: çatılı tüneller + Long Doors odası + kapıların çevresi (pano / pencere / tente kapıya ya da tavana binmesin)
  const NODECOR = [...TUNNELS.map(([x0, x1, z0, z1]) => [x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5]), [22, 5, 34, 24.5],
    ...GATES.map((g) => (g.axis === 'x' ? [g.c - 3.8, g.z - 2.8, g.c + 3.8, g.z + 2.8] : [g.x - 2.8, g.c - 3.8, g.x + 2.8, g.c + 3.8]))];
  // Long Doors: iki kapı arasındaki oda çatılı (kapı lentosu üstünden)
  { const gy = terrain.heightAt(28, 15); b.box(28, gy + 5.6, 15, 9.6, 0.5, 15.6, '#8a7551', { tag: 'roof' });
    if (!MapBuilder.noVisual) for (let z = 9; z < 22; z += 2.2) b.box(28, gy + 5.3, z, 9.6, 0.3, 0.3, '#6e5a3c', { collide: false }); }
  // süs en sonda: kapı / çatı / köprü / kat kenarı gibi tüm gövdeler kurulduktan sonra, önü dolu cepheye pencere / kapı / pano konmaz
  if (!MapBuilder.noVisual) {                                                       // süs yalnızca görsel (sunucuda kurulmaz)
    const rng = rngOf(20241005);
    decorateEdges(b, D.fedges, terrain, field, rng, NODECOR);
    const avoid = [...objectives.map((o) => [o.x, o.z, 9]), ...[...spawns.blue, ...spawns.red].map((p) => [p.x, p.z, 5])];
    scatterPalms(b, terrain, field, avoid, rng, 10);
    dishes(b, terrain, D.rects, rng, 30);
    ads(b, terrain, D.fedges, field, rng, 14, NODECOR);
    siteSign(b, terrain, D.fedges, CALLOUTS.find((q) => q.name === 'A Site'), 'A', NODECOR); siteSign(b, terrain, D.fedges, CALLOUTS.find((q) => q.name === 'B Site'), 'B', NODECOR);
    buildSurround(b, rng);
  }
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
