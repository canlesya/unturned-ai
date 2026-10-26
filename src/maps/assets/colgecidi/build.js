import * as THREE from 'three';
import { MapBuilder } from '../../builder.js';
import { T_FLOOR, T_MASS } from './layout.js';
import { buildGround } from './ground.js';
import { buildMasses } from './masses.js';
import { decorateFacades } from './facade.js';
import { gate, bridge, roofOver, parapet, freeSpan } from './setpieces.js';
const freeSpanZ = (L, x, z) => freeSpan(L, 'z', x, z);
import { buildSurround, roofClutter, groundClutter, hangings } from './dressing.js';
import { PROPS } from './plan.js';
import { CK, makeCgMaterial } from '../common/cgSurface.js';
import { NC, cgCrate, cgBarrel, cgContainer, cgPalm, cgSiteSign, CRATE_COL, BARREL_COL, shade } from '../common/cgKit.js';

// Çöl Geçidi v2 kurulumu (12.171): zemin → bina kütleleri → yapı parçaları (kapılar, köprü, tünel çatıları, pencere, korkuluklar) → eşyalar → cephe süsü
// → çevre / çatı / zemin süsü. Sunucuda (MapBuilder.noVisual) yalnız çarpışma kurulur; çarpışma üreten her şey iki tarafta da AYNI (palmiye gövdesi dahil).
const PI = Math.PI;
const WALLC = ['#d4b273', '#cda968', '#d9bb80', '#c9a46a', '#dcc68f', '#c99d6e', '#d8c08f', '#bfa57e', '#d9c9a2', '#c78f5f', '#d1b58a', '#d6bd86'];
const hashId = (id) => (Math.imul((id + 7) | 0, 2654435761) >>> 0);
export const wallColorOf = (id) => (id === -2 ? '#c9ad7c' : id === 900 ? '#c8a670' : id === 901 ? '#cda968' : WALLC[hashId(id) % WALLC.length]);
const darker = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
export const GROUND_COL = { [CK.SAND]: '#dcc592', [CK.SLAB]: '#d3bd93', [CK.COBBLE]: '#c4b08c', [CK.DIRT]: '#bda57a', [CK.COPING]: '#cdb489' };

// zemin türü bölgeleri (sonraki kazanır)
export const GROUND_ZONES = [
  [CK.SLAB, -52, -63, -36, -45.5],           // B sahası
  [CK.SLAB, 36.5, -55, 49.5, -41.5],         // A sahası
  [CK.SLAB, -33, 50.5, -1.5, 66],            // T avlusu
  [CK.SLAB, 7, -52, 24, -34.5],              // CT avlusu
  [CK.COBBLE, 46.5, -52, 62, 3],             // Long kaldırımı
  [CK.DIRT, -65, -15, -36, -0.5],            // Upper Tunnels
  [CK.DIRT, -36, -18, -9, -9.5],             // Lower Tunnels
  [CK.DIRT, 23.5, 7.5, 32.5, 22.5],          // Long Doors odası
];
// büyük ahşap kapılar (eski yerlerinde; duvar düzlemi hücre kenarında, kalınlık 1 m)
export const GATES = [
  { name: 'Mid Doors', axis: 'x', at: -22, c: -7.75, W: 4.5, open: 'R', swing: 1 },
  { name: 'B Doors', axis: 'z', at: -37, c: -38.75, W: 4.5, open: 'R', swing: 1 },
  { name: 'Long Doors (iç)', axis: 'x', at: 7, c: 27.25, W: 4.5, open: 'both', swing: -1, roofed: true },
  { name: 'Long Doors', axis: 'x', at: 22, c: 27.5, W: 4.5, open: 'L', swing: -1, roofed: true },
];
// çatılı geçitler [kimlik, bölge, çatı alt kotu]
export const ROOFS = [
  ['çatı:alt-tünel', [-33, -18, -10.5, -10.5], 4.05, { dirX: true }],
  ['çatı:üst-tünel', [-64, -13.5, -36, -0.5], 7.9, { dirX: false }],
  ['çatı:b-tüneli', [-60, -27, -54, -13.5], 8.1, { dirX: false }],
  ['çatı:geçit', [-53, -0.5, -43.5, 13], 7.9, { dirX: true }],
  ['çatı:spiral', [-36, -10.5, -25.5, -1.5], 7.9, { dirX: true }],
];

export function buildCgMap(b, T, L, CALLOUTS) {
  const vis = !MapBuilder.noVisual;
  const stats = {};
  const covers = [];                                   // katı yapı parçası kutuları (zemin yüzü / istinat yüzü gizlenir; cephe süsü konmaz)
  const cover = (x0, z0, x1, z1, y0, y1) => covers.push([x0, z0, x1, z1, y0, y1]);
  // ── 1) bina kütleleri ──
  const masses = buildMasses(b, T, { colorOf: wallColorOf, roofOf: (id) => darker(wallColorOf(id), 0.84) });

  // ── 2) yapı parçaları ──
  const gates = GATES.map((g) => { const r = gate(b, L, T, g); if (g.axis === 'x') cover(r.a0, r.w0 - 0.2, r.a1, r.w1 + 0.2, r.gy - 0.5, r.top); else cover(r.w0 - 0.2, r.a0, r.w1 + 0.2, r.a1, r.gy - 0.5, r.top); return { ...g, ...r }; });
  const br = bridge(b, L, T);
  cover(23, -47.5, 23.5, -43.5, -0.5, 4.6);
  const roofs = [];
  for (const [id, R, y, o] of ROOFS) roofs.push(...roofOver(b, L, T, id, R, y, { ...o, skip: (x, z) => gates.some((g) => (g.axis === 'x' ? Math.abs(z - (g.w0 + g.w1) / 2) < 0.6 && x > g.a0 && x < g.a1 : Math.abs(x - (g.w0 + g.w1) / 2) < 0.6 && z > g.a0 && z < g.a1)) }).map((r) => [...r, y]));
  // spiral (7,9) ile Lower Tunnels (4,05) çatıları arasındaki düşey aralık: tek panel
  b.obj('çatı:birleşim', () => b.box(-28.75, 4.55, -10.75, 6.5, 7.9 - 4.55, 0.5, '#8a7551', { kind: CK.ROOF, tag: 'roof' }));
  // Long Doors odası: iki kapı arası çatılı (kapı lentosu üstünden)
  { const g1 = gates[2], g2 = gates[3], y = g1.top; roofs.push(...roofOver(b, L, T, 'çatı:long-odası', [g1.a0, g1.w0, g1.a1, g2.w1], y, { dirX: false }).map((r) => [...r, y])); }
  // Lower Tunnels'ın Mid tarafındaki ağzı: üstü kapalı (tünel çatısı kotundan bina tepesine, iki bina arasında lento)
  { const [z0, z1] = freeSpanZ(L, -10, -14.25); b.obj('tünel-ağzı', () => b.box(-10, 4.05, (z0 + z1) / 2, 1, 7.5 - 4.05, z1 - z0, wallColorOf(37), { kind: CK.PLASTER, tag: 'wall' })); }
  // korkuluk / parapet / bölme duvarları (üst tarafın kenar hücrelerinde; istinat yüzünü örter)
  const PARA = [
    ['korkuluk:a-avlu', [23, -48, 38, -47.5], 4.6 + 0.95],                // A platosu güney kenarı (kemer avlusuna bakar)
    ['korkuluk:a-default', [38, -47.5, 38.5, -42.5], 4.6 + 0.95],         // A Default batı kenarı
    ['korkuluk:a-default-güney', [38, -42.5, 47.5, -42], 4.6 + 0.95],    // A Default güney kenarı (Long'a bakar)
    ['korkuluk:a-rampa', [47, -54, 47.5, -42.5], 4.6 + 0.95],             // A Ramp batı yanı (A sahasından iniş yok)
    ['duvar:mid-cat', [-1.5, -20, -0.5, 9.5], 2.82],                      // Mid ↔ Cat tek düz duvar (kullanıcı: kenar:19)
    ['korkuluk:t-kenarı', [-11.5, 53, -4.5, 53.5], 6.6 + 0.8],            // T platosu kuzey kenarı (Mid'e bakar)
    ['korkuluk:pit-batı', [47.5, 2.5, 48, 28], 2.5],                       // Side Pit ↔ Pit
    ['korkuluk:pit-doğu', [58.5, 2.5, 59, 7.5], 2.5],
    ['korkuluk:pit-sahanlık', [58.5, 7.5, 59, 24], 3.38],
    ['korkuluk:b-plat-g', [-55.5, -58, -52, -57.5], 2.9 + 0.75],          // B Plat yokuşunun iki yanı
    ['korkuluk:b-plat-k', [-55.5, -51.5, -52, -51], 2.9 + 0.75],
  ];
  const paras = PARA.map(([id, R, top]) => { const p = parapet(b, T, id, R, top); cover(p.x0, p.z0, p.x1, p.z1, p.lo - 0.3, top); return p; });
  // B penceresi (B sahası ↔ Window cebi; plan hücresi 901, x −37…−36, z −57,5…−54,5): denizlik 1,8 m, açıklık 2,2 m
  { const gB = T.heightAt(-38, -56), sill = gB + 1.8, lint = sill + 2.2, top = 9.0, col = wallColorOf(901);
    b.obj('B-penceresi', () => {
      b.box(-36.5, gB - 0.6, -57.375, 1, top - gB + 0.6, 0.25, col, { kind: CK.PLASTER, tag: 'wall' });
      b.box(-36.5, gB - 0.6, -54.625, 1, top - gB + 0.6, 0.25, col, { kind: CK.PLASTER, tag: 'wall' });
      b.box(-36.5, gB - 0.6, -56, 1, sill - gB + 0.6, 2.5, col, { kind: CK.PLASTER, tag: 'wall' });
      b.box(-36.5, lint, -56, 1, top - lint, 2.5, col, { kind: CK.PLASTER, tag: 'wall' });
      if (vis) { for (const x of [-37.06, -35.94]) { b.box(x, sill - 0.05, -56, 0.12, 0.1, 2.6, '#e2c995', { ...NC, kind: CK.COPING }); b.box(x, lint, -56, 0.12, 0.18, 2.6, '#e2c995', { ...NC, kind: CK.COPING }); } }
    });
    cover(-37, -57.5, -36, -54.5, gB - 0.6, top);
  }

  // ── 3) eşyalar (radar kutuları → eksen hizalı) + özel yığınlar ──
  const propBoxes = [];
  // yer bulucu: ayak izi tamamen zeminde, hiçbir katıya girmiyor, altındaki zemin düz (≤ 0,12 m); değilse 2,5 m içinde en yakın uygun yer
  const okAt = (x, z, w, d, h) => {
    const g0 = floorMin(T, x, z, w, d); let g1 = -1e9;
    for (const fx of [-0.5, 0, 0.5]) for (const fz of [-0.5, 0, 0.5]) { const px = x + fx * (w - 0.02), pz = z + fz * (d - 0.02); if (!L.isFloor(px, pz)) return false; g1 = Math.max(g1, T.heightAt(px, pz)); }
    if (g1 - g0 > (w >= 1.8 && d >= 1.8 ? 0.45 : 0.12)) return false;                    // büyük kasa eğimde: taş kaide üstüne (aşağıda)
    for (const c of b.colliders) if (x - w / 2 < c.max[0] - 0.01 && x + w / 2 > c.min[0] + 0.01 && z - d / 2 < c.max[2] - 0.01 && z + d / 2 > c.min[2] + 0.01 && c.max[1] > g0 + 0.02 && c.min[1] < g0 + h) return false;
    for (const [a0, c0, a1, c1, y0, y1] of covers) if (x - w / 2 < a1 && x + w / 2 > a0 && z - d / 2 < c1 && z + d / 2 > c0 && y1 > g0 && y0 < g0 + h) return false;
    return true;
  };
  const place = (x, z, w, d, h) => {
    if (okAt(x, z, w, d, h)) return [x, z];
    for (let r = 0.25; r <= 2.5; r += 0.25) for (let a = 0; a < 16; a++) { const px = Math.round((x + Math.cos(a * Math.PI / 8) * r) * 4) / 4, pz = Math.round((z + Math.sin(a * Math.PI / 8) * r) * 4) / 4; if (okAt(px, pz, w, d, h)) return [px, pz]; }
    return null;
  };
  stats.propMoved = []; stats.propDropped = [];
  const putCrate = (id, x, z, w, d, h, seed, base) => {
    let y0 = base ?? floorMin(T, x, z, w, d);
    if (base === undefined) {                                                          // eğimli zeminde: ayak izi altına taş kaide (üstü en yüksek zeminde; görünen = çarpışma)
      let g1 = -1e9; for (const fx of [-0.5, 0, 0.5]) for (const fz of [-0.5, 0, 0.5]) g1 = Math.max(g1, T.heightAt(x + fx * (w - 0.02), z + fz * (d - 0.02)));
      if (g1 - y0 > 0.04) { const yb = y0 - 0.05; b.obj(id + ':kaide', () => { b.box(x, yb, z, w, g1 + 0.06 - yb, d, '#6e5a3e', { kind: CK.WOOD, tag: 'prop' }); if (vis) for (const s2 of [-1, 1]) b.box(x, g1 + 0.06 - 0.09, z + s2 * (d / 2 + 0.015), w - 0.1, 0.07, 0.03, '#4e3f2b', { ...NC, kind: CK.WOOD }); }); y0 = g1 + 0.06; }
    }
    const n = h > 1.45 ? Math.max(2, Math.round(h / 1.0)) : 1, hh = h / n;
    const cbase = CRATE_COL[seed % CRATE_COL.length];
    b.obj(id, () => { for (let q = 0; q < n; q++) cgCrate(b, { x, y: y0 + q * hh, z, w, h: hh, d, color: shade(cbase, 1 - 0.07 * (q % 2)), seed: seed + q }); });
    propBoxes.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2, y0, y0 + h]);
  };
  const SPECIAL = {
    2: () => {},
    31: () => { const pp = place(-31.625, -35.75, 2.75, 2.0, 3.5); if (pp) putCrate('kasa:31', pp[0], pp[1], 2.75, 2.0, 3.5, 31); },     // B Doors önü büyük blok (kullanıcı ×2,6 büyüttü; duvara yaslı, duvarın içine girmez)                                                                      // eski Upper Tunnels batı cebi (radar: kapalı, kasayla dolu) artık bina kütlesi
    7: () => putCrate('kasa:7', -48.25, 38.75, 2.5, 2.5, 2.0, 7, 6.6),                 // Titanic köşesi: iki duvara yaslı büyük sandık
    17: () => { putCrate('kasa:17', -2.25, -13, 1.5, 3.0, 1.1, 17, 0); putCrate('sandık:Xbox:1', -2.0, -13, 1.0, 1.0, 1.0, 4, 1.1); },   // Xbox: duvara yaslı uzun kasa + üstünde küçük kasa (2,1 m; duvar 2,82)
  };
  for (const [i, x0, z0, w, d, h, kind] of PROPS) {
    if (SPECIAL[i]) { SPECIAL[i](); continue; }
    const id = 'kasa:' + i, fw = kind === 'fıçı' ? 0.84 : w, fd = kind === 'fıçı' ? 0.84 : d;
    const pp = place(x0, z0, fw, fd, kind === 'fıçı' ? 1.05 : h);
    if (!pp) { stats.propDropped.push(id); continue; }
    const [x, z] = pp; if (x !== x0 || z !== z0) stats.propMoved.push(`${id} ${Math.hypot(x - x0, z - z0).toFixed(2)} m`);
    if (kind === 'fıçı') { const y0 = floorMin(T, x, z, 0.9, 0.9); b.obj(id, () => cgBarrel(b, { x, y: y0, z, r: 0.42, h: 1.05, color: BARREL_COL[i % BARREL_COL.length] })); propBoxes.push([x - 0.42, z - 0.42, x + 0.42, z + 0.42, y0, y0 + 1.05]); continue; }
    if (kind === 'konteyner') { const y0 = floorMin(T, x, z, w, d); b.obj(id, () => cgContainer(b, { x, y: y0, z, w, h, d, color: i === 1 ? '#2f6aa8' : ['#a0522d', '#4f7a5a', '#8a8f94', '#b3862b'][i % 4] })); propBoxes.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2, y0, y0 + h]); continue; }
    putCrate(id, x, z, w, d, h, i);
  }
  // B penceresinin iki yanı: B tarafında üç sandık (biri yerde, ikisi üst üste), cep tarafında tek sandık (denizliğe 0,9 m sıçrama)
  { const gB = T.heightAt(-38, -56); putCrate('sandık:B-penceresi:0', -39.6, -56, 1.2, 1.2, 0.95, 3, gB); putCrate('sandık:B-penceresi:1', -38.2, -56, 1.2, 1.2, 1.8, 5, gB);
    const gW = T.heightAt(-35.5, -56); putCrate('sandık:B-penceresi:2', -35.45, -56, 1.1, 1.2, 0.95, 6, gW); }
  // palmiyeler (eski yerleri; palmiye:6 kullanıcı taşıması, palmiye:7 silindi)
  const PALMS = [[1, 51, 1.25], [2, 24, 33], [3, -42, 60], [4, 6.5, 53], [5, -12, -45], [6, -38.75, 17.25], [8, -3, 12], [9, -45, -48], [10, -57, 60]];
  for (const [n, x, z] of PALMS) { const y = T.heightAt(x, z), s = 0.92 + ((n * 37) % 10) / 30; b.obj('palmiye:' + n, () => cgPalm(b, { x, y: y - 0.05, z, s, seed: n })); propBoxes.push([x - 0.24, z - 0.24, x + 0.24, z + 0.24, y, y + 5]); }

  // ── 4) zemin (görsel): çatı altı ve yapı parçalarının içi çizilmez ──
  const inCover = (x, z, y) => covers.some(([a, c, e, f, y0, y1]) => x > a + 1e-3 && x < e - 1e-3 && z > c + 1e-3 && z < f - 1e-3 && y > y0 - 1e-3 && y < y1 + 1e-3);
  const kindAt = (k) => {
    const i = k % L.nx, j = (k / L.nx) | 0, x = L.x0 + (i + 0.5) * L.C, z = L.z0 + (j + 0.5) * L.C;
    for (let s = 0; s < 4; s++) if (T.edge[k * 4 + s] === 3) return CK.COPING;
    let kind = CK.SAND;
    for (const [kd, x0, z0, x1, z1] of GROUND_ZONES) if (x > x0 && x < x1 && z > z0 && z < z1) kind = kd;
    return kind;
  };
  const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const cellXZ = (k) => [L.x0 + ((k % L.nx) + 0.5) * L.C, L.z0 + (((k / L.nx) | 0) + 0.5) * L.C];
  const skipCell = (k) => { const [x, z] = cellXZ(k); return inCover(x, z, T.cellH(k, x, z)); };
  const skipEdge = (k, s) => { const m = L.at((k % L.nx) + SIDES[s][0], ((k / L.nx) | 0) + SIDES[s][1]); const [x, z] = cellXZ(m); return inCover(x, z, T.cellH(m, x, z) - 0.05); };
  if (vis) stats.ground = buildGround(b, T, { kindAt, colorOf: (k) => GROUND_COL[k] || '#dcc592', wallColor: '#c3a676', skipCell, skipEdge });
  // AO dokusu (duvar dibi / çatı altı / kum)
  let ao = null;
  if (vis) ao = makeAO(T, L, roofs, br);
  b.surface = { ground: (x, z) => groundBelow(T, L, x, z), kindOf: () => CK.PLAIN, seeded: true, material: () => makeCgMaterial({ ao }) };

  // ── 5) cephe süsü, tabelalar, çevre ──
  const solidAt = (x, z, y0, y1) => {
    for (const c of b.colliders) if (x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2] && c.max[1] > y0 && c.min[1] < y1) return true;
    return false;
  };
  const roofed = (x, z) => roofs.some(([a, c, e, f]) => x > a && x < e && z > c && z < f) || (x > br.X0 && x < br.X1 && z > br.Z0 && z < br.Z1);
  const blocked = (wx, wz, nx, nz, dx, dz, hw, dep, y0, y1) => {
    for (let t = -hw; t <= hw + 1e-6; t += Math.max(0.25, hw / 3)) for (const dd of [0.12, dep * 0.5, dep]) {
      const px = wx + dx * t + nx * dd, pz = wz + dz * t + nz * dd;
      if (!L.isFloor(px, pz)) return true;
      if (T.heightAt(px, pz) > y0 + 0.05) return true;
      if (solidAt(px, pz, y0, y1)) return true;
    }
    return false;
  };
  if (vis) {
    stats.facade = decorateFacades(b, T, L, masses.faces, { blocked, roofed, wallColorOf });
    signs(b, T, L, masses.faces, blocked);
    roofClutter(b, L, masses.rims);
    groundClutter(b, T, L, (x, z) => solidAt(x, z, T.heightAt(x, z) - 0.2, T.heightAt(x, z) + 1.5) || roofed(x, z) || inCover(x, z, T.heightAt(x, z)));
    hangings(b, T, L, roofed);
    b.obj('dış-çevre', () => buildSurround(b));
  }

  // ── 6) doğuş: T avlusu (mavi, güney) ve CT avlusu + kemer avlusu (kırmızı, kuzey) ──
  const T_ZONE = [-32.46, 51.12, -2.29, 65.42], CT_ZONE = [7.58, -51.84, 24.17, -34.68];
  const spawns = { blue: [], red: [] };
  const sblocked = (x, z) => {
    const gy = T.heightAt(x, z);
    if (!L.isFloor(x, z) || T.slopeAt(x, z, 0.5) > 0.3) return true;
    for (const c of b.colliders) {
      if (x + 0.9 < c.min[0] || x - 0.9 > c.max[0] || z + 0.9 < c.min[2] || z - 0.9 > c.max[2]) continue;
      if (c.max[1] > gy + 0.2 && c.min[1] < gy + 1.9) return true;
    }
    return false;
  };
  const pickSpawns = (zone0, team, ry, pad = 3, anchor = null) => {
    const [x0, z0, x1, z1] = [zone0[0] - pad, zone0[1] - pad, zone0[2] + pad, zone0[3] + pad], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cands = [];
    const underBridge = (x, z) => x > br.X0 - 1 && x < br.X1 + 1 && z > br.Z0 - 1 && z < br.Z1 + 1;
    for (let x = x0 + 1; x <= x1 - 1; x += 1) for (let z = z0 + 1; z <= z1 - 1; z += 1) if (!sblocked(x, z) && !underBridge(x, z)) cands.push([x, z]);
    const [ax, az] = anchor || [cx, cz];
    cands.sort((p, q) => Math.hypot(p[0] - ax, p[1] - az) - Math.hypot(q[0] - ax, q[1] - az));
    const picked = [];
    for (const p of cands) { if (picked.length >= 24) break; if (picked.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.0)) picked.push(p); }
    for (const [x, z] of picked) spawns[team].push({ x, z, ry, y: T.heightAt(x, z) });
  };
  pickSpawns(T_ZONE, 'blue', 0, 3, [(T_ZONE[0] + T_ZONE[2]) / 2, T_ZONE[3] + 2]);
  pickSpawns(CT_ZONE, 'red', PI);
  { const all = spawns.red; spawns.red = all.slice(0, 12); pickSpawns([26.5, -46, 36.5, -36], 'red', PI, 0); spawns.red = spawns.red.slice(0, 24); for (const p of all.slice(12)) if (spawns.red.length < 24) spawns.red.push(p); }

  const objectives = [
    { id: 'uzun', name: 'Uzun A', label: 'U', x: 54, z: 15, r: 9, core: true },
    { id: 'orta', name: 'Orta', label: 'O', x: -6.4, z: 3.5, r: 10, core: true },
    { id: 'tunel', name: 'Alt Tüneller', label: 'T', x: -27, z: -16.5, r: 8, core: true },
  ];
  const env = {
    sky: ['#5c98d6', '#c6dcec', '#f3e3c4'], fog: ['#e4d3ae', 120, 340],
    sun: ['#ffe0aa', 2.75], hemi: ['#d2e2fb', '#a08452', 1.12], cloud: '#fff4e2', clouds: 12,
    sunPos: [50, 80, 25],
  };
  stats.props = propBoxes.length; stats.covers = covers.length; stats.roofs = roofs.length;
  return { spawns, objectives, env, stats, propBoxes, covers };
}

// ayak izi altındaki en düşük zemin (eşya tabanı: eğimde gömülür, havada kalmaz)
export function floorMin(T, x, z, w, d) {
  let m = 1e9;
  for (const fx of [-0.5, 0, 0.5]) for (const fz of [-0.5, 0, 0.5]) m = Math.min(m, T.heightAt(x + fx * (w - 0.02), z + fz * (d - 0.02)));
  return m;
}
// köşe altındaki zemin (gölgelendirici aGnd): kütle / duvar kenarında komşu en alçak zemin hücresi
function groundBelow(T, L, x, z) {
  const i = Math.round((x - L.x0) / L.C), j = Math.round((z - L.z0) / L.C);
  let m = 1e9;
  for (const [a, c] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) { const k = L.at(a, c); if (k >= 0 && L.type[k] === T_FLOOR) m = Math.min(m, T.cellH(k, Math.min(L.x0 + (a + 1) * L.C, Math.max(L.x0 + a * L.C, x)), Math.min(L.z0 + (c + 1) * L.C, Math.max(L.z0 + c * L.C, z)))); }
  return m < 1e8 ? m : T.heightAt(x, z);
}

// AO dokusu: R duvar dibi (zemin hücresinin dikey yüze / kütleye uzaklığı), G çatı altı, B kum birikintisi
function makeAO(T, L, roofs, br) {
  const W = L.nx, H = L.nz, data = new Uint8Array(W * H * 4), dist = new Float32Array(W * H).fill(99);
  const q = [];
  for (let k = 0; k < L.N; k++) {
    if (L.type[k] !== T_FLOOR) { dist[k] = 0; q.push(k); continue; }
    for (let s = 0; s < 4; s++) if (T.edge[k * 4 + s] === 2) { dist[k] = Math.min(dist[k], 0.5); }
  }
  for (let k = 0; k < L.N; k++) if (dist[k] === 0.5) q.push(k);
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % W, j = (k / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const m = L.at(i + di, j + dj); if (m < 0) continue; const nd = dist[k] + 1; if (nd < dist[m]) { dist[m] = nd; q.push(m); } }
  }
  const hs = (i, j) => { const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let k = 0; k < L.N; k++) {
    const i = k % W, j = (k / W) | 0, x = L.x0 + (i + 0.5) * L.C, z = L.z0 + (j + 0.5) * L.C, d = dist[k];
    const r = L.type[k] !== T_FLOOR ? 255 : Math.max(0, 1 - (d - 0.5) / 3.2) ** 1.6 * 255;
    const g = (roofs.some(([a, c, e, f]) => x > a && x < e && z > c && z < f) || (x > br.X0 && x < br.X1 && z > br.Z0 && z < br.Z1)) ? 230 : 0;
    const bsand = L.type[k] === T_FLOOR ? Math.max(0, 1 - d / 4) * (0.4 + 0.6 * hs(Math.floor(i / 5), Math.floor(j / 5))) * 255 : 0;
    data[k * 4] = r; data[k * 4 + 1] = g; data[k * 4 + 2] = bsand; data[k * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return { tex, x0: L.x0, z0: L.z0, w: W * L.C, d: H * L.C };
}

// A / B saha tabelaları: saha merkezine bakan en uygun sokak yüzü
function signs(b, T, L, faces, blocked) {
  const SN = [[1, 0], [-1, 0], [0, 1], [0, -1]], RY = [PI / 2, -PI / 2, 0, PI];
  for (const [letter, cx, cz] of [['A', 42, -49.2], ['B', -45.2, -52.9]]) {
    let best = null, bs = -1e9;
    faces.forEach((f) => {
      if (!f.street) return;
      const [nx, nz] = SN[f.s], len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
      if (len < 4.5) return;
      const mx = (f.a[0] + f.b[0]) / 2, mz = (f.a[1] + f.b[1]) / 2, ex = cx - mx, ez = cz - mz, dist = Math.hypot(ex, ez);
      if (dist > 18 || (ex * nx + ez * nz) / (dist + 1e-6) < 0.6) return;
      const g = T.heightAt(mx + nx * 0.3, mz + nz * 0.3);
      if (f.y1 - g < 5.6) return;
      const dx = (f.b[0] - f.a[0]) / len, dz = (f.b[1] - f.a[1]) / len;
      if (blocked(mx, mz, nx, nz, dx, dz, 1.9, 0.6, g + 1.3, g + 5)) return;
      const sc = -dist + len * 0.3; if (sc > bs) { bs = sc; best = { mx, mz, g, s: f.s }; }
    });
    if (best) b.obj('tabela:' + letter, () => b.with(best.mx, best.g, best.mz, RY[best.s], () => cgSiteSign(b, { y: 1.5, letter })));
  }
}
