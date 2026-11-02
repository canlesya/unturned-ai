import { MapBuilder } from '../../builder.js';
import { T_FLOOR } from '../colgecidi/layout.js';
import { buildGround } from '../colgecidi/ground.js';
import { buildMasses } from '../colgecidi/masses.js';
import { decorateFacades } from '../colgecidi/facade.js';
import { parapet } from '../colgecidi/setpieces.js';
import { buildSurround, roofClutter, groundClutter, hangings } from '../colgecidi/dressing.js';
import { wallColorOf, floorMin, groundBelow, makeAO } from '../colgecidi/build.js';
import { CK, makeCgMaterial } from '../common/cgSurface.js';
import { NC, shade, cgCrate, cgBarrel, cgPalm, cgAwning, cgLamp, CRATE_COL, BARREL_COL, CLOTH_COL } from '../common/cgKit.js';
import * as PLAN from './plan.js';
import { buildKonak, buildDam } from './houses.js';

// Kum Köyü kurulumu (12.224): Çöl Geçidi v2 hattı (plan → hücre ızgarası → zemin / istinat, bina kütleleri + cephe süsü, AO) + girilen evler (Konak, Damlı Ev)
// + köy parçaları (Han revakları, Sebil, Fırın, yıkık duvarlar, tezgâhlar, kamyon enkazı, kuyular, el arabaları). Sunucuda (noVisual) yalnız çarpışma kurulur;
// çarpışma üreten her şey iki tarafta da aynı. Güney (z > 0) yarısının eşyası yazılır, kuzey yarısı aynası (z → −z) — iki takım için birebir aynı harita.
const PI = Math.PI;
const k = (kind, o = {}) => ({ ...o, kind }), n = (kind, o = {}) => ({ collide: false, ...o, kind });
const GROUND_COL = { [CK.SAND]: '#dcc592', [CK.SLAB]: '#d3bd93', [CK.COBBLE]: '#c4b08c', [CK.DIRT]: '#bda57a', [CK.COPING]: '#cdb489' };
const STONE = '#c8b089', STONE_D = '#a8916b', MUD = '#c99d6e', TIMBER = '#6e5a3c', IRON = '#3b3530';
const mz = (r) => [r[0], -r[3], r[2], -r[1]];                  // dikdörtgen aynası [x0, z0, x1, z1]
const both = (r) => [r, mz(r)];

// zemin türü bölgeleri (güney yarısı; sonraki kazanır)
const GROUND_ZONES = [
  [CK.DIRT, -33, 0, -12, 37],                // batı hattı (Dar Sokak, Han Sokağı, Kemer)
  [CK.SAND, -31, 0, -19, 5],                 // Fırın Avlusu
  [CK.COBBLE, -12, 0, 12, 13],               // Meydan
  [CK.COBBLE, -8, 13, 8, 27],                // Han Önü
  [CK.SLAB, -5, 0, 5, 5],                    // Sebil seti
  [CK.SLAB, -13, 29, 13, 37],                // Han avlusu
  [CK.DIRT, 24, 5, 33, 11],                  // Avlu
  [CK.DIRT, 27, 0, 30, 5],                   // Arka Geçit
  [CK.SLAB, 16, 0, 27, 5],                   // Konak içi
  [CK.SLAB, 24, 11, 33, 19],                 // Damlı Ev içi
];

export function buildKoyMap(b, T, L) {
  const vis = !MapBuilder.noVisual;
  const stats = {}, propBoxes = [];
  const add = (x0, z0, x1, z1, y0, y1) => propBoxes.push([x0, z0, x1, z1, y0, y1]);
  // ── 1) bina kütleleri (köy duvarı dahil) ──
  const masses = buildMasses(b, T, { colorOf: wallColorOf, roofOf: (id) => shade(wallColorOf(id), 0.84), plan: PLAN, outTop: PLAN.OUT_TOP,
    nameOf: (id) => (id === -2 ? 'köy-duvarı' : 'bina:' + id) });

  // ── 2) girilen evler ──
  const konakCol = '#d8c08f', damCol = ['#cfae7a', '#d4b984'];
  buildKonak(b, PLAN.KONAK, konakCol);
  const damS = buildDam(b, PLAN.DAM, damCol[0], 1, 'güney'), damN = buildDam(b, { ...PLAN.DAM, z0: -PLAN.DAM.z1, z1: -PLAN.DAM.z0 }, damCol[1], -1, 'kuzey');

  // ── 3) Han revakları (doğuş; çatı altı, Han'ın arka duvarı boyunca) ──
  const ARC = { x0: -13, x1: 13, z0: 33.5, z1: 37, y: 3.8, th: 0.3 }, PILL = [-12.75, -8.5, -4.25, 0, 4.25, 8.5, 12.75];     // uç dikmeler yan duvara yaslı (arada bot sıkışan dar yarık yok)
  for (const sg of [1, -1]) {
    const tag = sg > 0 ? 'güney' : 'kuzey', zf = sg * ARC.z0, zb = sg * ARC.z1, zc = (zf + zb) / 2, g = 0.45;
    b.obj('revak:' + tag, () => {
      b.box(0, ARC.y, zc, ARC.x1 - ARC.x0, ARC.th, ARC.z1 - ARC.z0, '#8a7551', k(CK.ROOF, { tag: 'roof' }));
      for (const x of PILL) b.box(x, g - 0.3, zf + sg * 0.5, 0.5, ARC.y - g + 0.3, 0.5, STONE, k(CK.STONE, { tag: 'wall' }));
      if (vis) {
        b.box(0, ARC.y - 0.28, zf + sg * 0.5, ARC.x1 - ARC.x0, 0.28, 0.42, TIMBER, n(CK.WOOD));                  // ön kiriş (dikmelerin üstü, çatıya yapışık)
        for (let x = -12; x <= 12.01; x += 1.5) b.box(x, ARC.y - 0.18, zc + sg * 0.25, 0.16, 0.18, ARC.z1 - ARC.z0 - 0.5, TIMBER, n(CK.WOOD));   // çatı kirişleri
        b.box(0, ARC.y + ARC.th, zf + sg * 0.06, ARC.x1 - ARC.x0, 0.12, 0.12, '#e2c995', n(CK.COPING));         // saçak taşı
        for (const x of [-10, -2, 6]) { b.box(x, ARC.y - 0.42, zc, 0.02, 0.42, 0.02, '#2a2c2e', n(CK.METAL)); b.box(x, ARC.y - 0.7, zc, 0.22, 0.28, 0.22, '#ffd98a', { collide: false, o: { glow: true } }); }
      }
    });
  }

  // ── 4) köy parçaları ──
  const crate = (id, x, z, w, d, h, seed, y0 = null) => {
    const y = y0 ?? floorMin(T, x, z, w, d), nn = h > 1.45 ? Math.max(2, Math.round(h / 0.95)) : 1, hh = h / nn, base = CRATE_COL[seed % CRATE_COL.length];
    b.obj(id, () => { for (let q = 0; q < nn; q++) cgCrate(b, { x, y: y + q * hh, z, w, h: hh, d, color: shade(base, 1 - 0.07 * (q % 2)), seed: seed + q }); });
    add(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y, y + h);
  };
  const barrel = (id, x, z, seed) => { const y = floorMin(T, x, z, 0.9, 0.9); b.obj(id, () => cgBarrel(b, { x, y, z, r: 0.42, h: 1.05, color: BARREL_COL[seed % BARREL_COL.length] })); add(x - 0.42, z - 0.42, x + 0.42, z + 0.42, y, y + 1.05); };
  // yıkık duvar: eksen hizalı kırık parçalar [a0, a1, tepe] (taş + kenar taşı), kalınlık t; axis 'x' → x boyunca, z = c
  const ruin = (id, axis, parts, c, t = 0.6) => b.obj(id, () => {
    for (const [a0, a1, top] of parts) {
      const g = Math.min(T.heightAt(axis === 'x' ? a0 + 0.05 : c, axis === 'x' ? c : a0 + 0.05), T.heightAt(axis === 'x' ? a1 - 0.05 : c, axis === 'x' ? c : a1 - 0.05)) - 0.3;
      if (axis === 'x') b.box((a0 + a1) / 2, g, c, a1 - a0, top - g, t, STONE, k(CK.STONE, { tag: 'wall' })); else b.box(c, g, (a0 + a1) / 2, t, top - g, a1 - a0, STONE, k(CK.STONE, { tag: 'wall' }));
      if (vis) { if (axis === 'x') b.box((a0 + a1) / 2, top, c, a1 - a0 - 0.04, 0.06, t - 0.04, '#d6c096', n(CK.COPING)); else b.box(c, top, (a0 + a1) / 2, t - 0.04, 0.06, a1 - a0 - 0.04, '#d6c096', n(CK.COPING)); }
      if (axis === 'x') add(a0, c - t / 2, a1, c + t / 2, g, top); else add(c - t / 2, a0, c + t / 2, a1, g, top);
    }
  });
  // kare kuyu: taş bilezik (bel hizası) + iki ahşap dikme + makara kirişi (≥ 2,3 m, çarpışmasız) + kova
  const well = (id, x, z, s = 1.6) => { const g = floorMin(T, x, z, s, s); b.obj(id, () => {
    b.box(x, g - 0.2, z, s, 1.15, s, STONE, k(CK.STONE, { tag: 'prop' }));
    if (vis) {
      b.box(x, g + 0.95, z, s - 0.4, 0.01, s - 0.4, '#1d242b', n(CK.PLAIN));                                   // kuyu ağzı (karanlık)
      for (const q of [-1, 1]) { b.box(x, g + 0.95, z + q * (s / 2 - 0.1), s + 0.06, 0.08, 0.26, '#d6c096', n(CK.COPING)); b.box(x + q * (s / 2 - 0.1), g + 0.95, z, 0.26, 0.08, s - 0.46, '#d6c096', n(CK.COPING)); }
    }
    for (const sx of [-1, 1]) b.box(x + sx * (s / 2 - 0.1), g + 0.95, z, 0.14, 1.45, 0.14, TIMBER, k(CK.WOOD, { tag: 'prop' }));
    if (vis) { b.box(x, g + 2.4, z, s, 0.12, 0.12, TIMBER, n(CK.WOOD)); b.cyl(x, g + 2.3, z, 0.12, 0.12, s - 0.4, '#4e3f2b', { seg: 8, collide: false, rz: PI / 2, center: true, kind: CK.WOOD }); }
    b.box(x + s / 2 - 0.25, g + 1.03, z + s / 2 - 0.25, 0.28, 0.28, 0.28, '#6b5a40', k(CK.WOOD, { tag: 'prop' }));        // kova (bileziğin üstünde)
  }); add(x - s / 2, z - s / 2, x + s / 2, z + s / 2, g, g + 0.95); };
  // el arabası (at arabası kasası): gövde (çarpışma, 0,95 m) + yan tekerler (gövdeye yapışık, ≤ 0,1 m) + oklar (yerde, yassı)
  const cart = (id, x, z, alongX, seed, flip = false) => { const L2 = 2.3, W2 = 1.3, g = floorMin(T, x, z, alongX ? L2 : W2, alongX ? W2 : L2); b.obj(id, () => b.with(x, g, z, (alongX ? 0 : PI / 2) + (flip ? PI : 0), () => {
    b.box(0, 0, 0, L2, 0.95, W2, shade('#8a6a45', 0.9 + (seed % 3) * 0.06), k(CK.WOOD, { tag: 'prop' }));
    if (vis) {
      for (const s of [-1, 1]) { b.cyl(0.1, 0.45, s * (W2 / 2 + 0.04), 0.45, 0.45, 0.08, '#4e3f2b', { seg: 12, collide: false, rx: PI / 2, center: true, kind: CK.WOOD }); b.cyl(0.1, 0.45, s * (W2 / 2 + 0.085), 0.1, 0.1, 0.02, IRON, { seg: 8, collide: false, rx: PI / 2, center: true, kind: CK.METAL }); }
      for (let q = -2; q <= 2; q++) b.box(q * 0.45, 0.95, W2 / 2 + 0.01, 0.06, 0.02, 0.02, shade('#8a6a45', 0.6), n(CK.WOOD));
      b.box(0, 0.95, 0, L2 - 0.1, 0.02, W2 - 0.1, shade('#8a6a45', 0.7), n(CK.WOOD));
    }
    for (const s of [-1, 1]) b.box(L2 / 2 + 0.7, 0, s * 0.35, 1.4, 0.06, 0.07, TIMBER, k(CK.WOOD, { tag: 'prop' }));     // oklar (yerde; çarpışmalı, adımlanır)
  })); add(x - (alongX ? L2 : W2) / 2, z - (alongX ? W2 : L2) / 2, x + (alongX ? L2 : W2) / 2, z + (alongX ? W2 : L2) / 2, g, g + 0.95); };
  // pazar tezgâhı: duvara yaslı tezgâh (bel hizası, çarpışma) + iki dikme + duvara asılı tente (≥ 2,4 m). face: tezgâhın baktığı yön (+1/−1, eksen x)
  const stall = (id, x0, x1, z0, z1, face, seed) => { const g = floorMin(T, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0); b.obj(id, () => {
    b.box((x0 + x1) / 2, g, (z0 + z1) / 2, x1 - x0, 1.0, z1 - z0, shade('#8a6a45', 0.95), k(CK.WOOD, { tag: 'prop' }));
    const px = face > 0 ? x1 - 0.06 : x0 + 0.06;
    for (const z of [z0 + 0.06, z1 - 0.06]) b.box(px, g + 1.0, z, 0.1, 1.5, 0.1, TIMBER, k(CK.WOOD, { tag: 'prop' }));
    if (vis) {
      const wallX = face > 0 ? x0 : x1;
      b.with(wallX, g, (z0 + z1) / 2, face > 0 ? PI / 2 : -PI / 2, () => cgAwning(b, { w: z1 - z0, depth: x1 - x0, y: 2.5, drop: 0.25, cols: CLOTH_COL[seed % CLOTH_COL.length] }));
    }
    for (let q = 0; q < 4; q++) b.box((x0 + x1) / 2, g + 1.0, z0 + 0.4 + q * (z1 - z0 - 0.8) / 3, 0.5, 0.18, 0.4, ['#c2412c', '#d9a52b', '#6b8a3a', '#c9b38a'][(q + seed) % 4], k(CK.CLOTH, { tag: 'prop' }));   // mal çuvalları (çarpışmalı: sunucu = istemci)
  }); add(x0, z0, x1, z1, g, g + 1.0); };

  // Sebil (Meydan ortası, set üstü): taş gövde (2,8 m tam siper), dört yüzde kör kemer + musluk + yalak (bel siperi), kubbe (≥ 3 m, çarpışmasız)
  { const g = 0.45, top = g + 2.5;
    b.obj('sebil', () => {
      b.box(0, g - 0.3, 0, 4, top - g + 0.3, 4, '#d9c39a', k(CK.STONE, { tag: 'wall' }));
      for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ax = sz === 0, px = sx * 2, pz = sz * 2;
        // yalak: yüze yaslı taş tekne (0,6 m)
        if (ax) b.box(px + sx * 0.3, g, 0, 0.6, 0.6, 2.2, STONE_D, k(CK.STONE, { tag: 'prop' })); else b.box(0, g, pz + sz * 0.3, 2.2, 0.6, 0.6, STONE_D, k(CK.STONE, { tag: 'prop' }));
        if (ax) add(Math.min(px, px + sx * 0.6), -1.1, Math.max(px, px + sx * 0.6), 1.1, g, g + 0.6); else add(-1.1, Math.min(pz, pz + sz * 0.6), 1.1, Math.max(pz, pz + sz * 0.6), g, g + 0.6);
        if (vis) {
          if (ax) { b.box(px + sx * 0.03, g + 0.75, 0, 0.06, 1.5, 1.6, '#3f6f7a', n(CK.PAINT)); b.box(px + sx * 0.05, g + 2.1, 0, 0.06, 0.2, 1.9, '#e6d6b0', n(CK.COPING)); b.box(px + sx * 0.08, g + 0.95, 0, 0.12, 0.08, 0.08, '#b08a3a', n(CK.METAL)); b.box(px + sx * 0.3, g + 0.6, 0, 0.5, 0.02, 2.0, '#4a7f8c', n(CK.PLAIN)); }
          else { b.box(0, g + 0.75, pz + sz * 0.03, 1.6, 1.5, 0.06, '#3f6f7a', n(CK.PAINT)); b.box(0, g + 2.1, pz + sz * 0.05, 1.9, 0.2, 0.06, '#e6d6b0', n(CK.COPING)); b.box(0, g + 0.95, pz + sz * 0.08, 0.08, 0.08, 0.12, '#b08a3a', n(CK.METAL)); b.box(0, g + 0.6, pz + sz * 0.3, 2.0, 0.02, 0.5, '#4a7f8c', n(CK.PLAIN)); }
        }
      }
      if (vis) {
        b.box(0, top, 0, 4.24, 0.22, 4.24, '#e2c995', n(CK.COPING));
        b.cyl(0, top + 0.22, 0, 1.55, 1.7, 0.4, '#d6c096', { seg: 16, collide: false, kind: CK.PLASTER });
        b.ico(0, top + 0.6, 0, 1.55, '#e9e1cc', { detail: 2, scale: [1, 0.78, 1] });
        b.cyl(0, top + 1.75, 0, 0.05, 0.05, 0.6, '#b08a3a', { seg: 6, collide: false, kind: CK.METAL });
        b.ico(0, top + 2.4, 0, 0.13, '#b08a3a', { detail: 1 });
      }
    });
    add(-2, -2, 2, 2, g - 0.3, top);
  }
  // Fırın (Fırın Avlusu ortası, orta çizgide): kerpiç gövde + kubbe (çarpışmasız, ≥ 2,2 m) + baca; Dar Sokak ↔ Dar Sokak düz görüşünü keser
  { const g = 0, top = 2.2, x0 = -25.5, x1 = -22.5, z0 = -1.25, z1 = 1.25;
    b.obj('fırın', () => {
      b.box((x0 + x1) / 2, g - 0.3, 0, x1 - x0, top + 0.3, z1 - z0, MUD, k(CK.PLASTER, { tag: 'wall' }));
      if (vis) {
        b.ico((x0 + x1) / 2, top, 0, 1.15, shade(MUD, 1.05), { detail: 1, scale: [1.1, 0.6, 0.95] });
        for (const s of [-1, 1]) { b.box((x0 + x1) / 2, 0.55, s * (z1 + 0.03), 0.9, 0.75, 0.06, '#1d1a16', n(CK.PAINT)); b.box((x0 + x1) / 2, 1.3, s * (z1 + 0.05), 1.2, 0.12, 0.1, '#a07a50', n(CK.COPING)); }
        b.box(x0 + 0.5, top, 0.6, 0.45, 1.1, 0.45, shade(MUD, 0.85), n(CK.PLASTER)); b.box(x0 + 0.5, top + 1.1, 0.6, 0.55, 0.08, 0.55, '#3a332c', n(CK.METAL));
      }
      b.box(x1 + 0.3, 0, 0, 0.6, 0.5, 1.6, '#7a5b3a', k(CK.WOOD, { tag: 'prop' }));                                          // odun yığını (fırına yaslı, bel altı)
      if (vis) for (let q = 0; q < 4; q++) b.cyl(x1 + 0.61, 0.08 + (q % 2) * 0.17, -0.6 + q * 0.4, 0.07, 0.07, 0.02, '#a07a50', { seg: 6, collide: false, rz: PI / 2, center: true, kind: CK.WOOD });
    });
    add(x0, z0, x1, z1, g - 0.3, top); add(x1, -0.8, x1 + 0.6, 0.8, 0, 0.5);
  }
  // yıkık duvarlar (Meydan: Han Önü yollarından Meydan'ı boydan boya gören çizgileri keser; tam siper + kırık uç bel siperi)
  for (const [r, tag] of [[1, 'güney'], [-1, 'kuzey']]) {
    ruin('yıkık-duvar:batı:' + tag, 'x', [[-9.6, -8.5, 1.15], [-8.5, -6.0, 2.3], [-6.0, -3.6, 2.0]], r * 9.7);     // kırık (bel) ucu dışta: ada yanı yolundan bakan göz hizası kapalı
    ruin('yıkık-duvar:doğu:' + tag, 'x', [[3.6, 6.0, 2.0], [6.0, 8.5, 2.3], [8.5, 9.6, 1.15]], r * 9.7);
  }
  // bel hizası taş setler (parapet: taban komşu zeminin 0,3 altı)
  const LOW = [
    ['set:meydan-batı', [-10.5, 5.5, -7, 6]], ['set:meydan-doğu', [7.5, 8.5, 10.5, 9]],
    ['set:han-önü', [-7.5, 24, -5, 24.5]], ['set:han-önü-d', [5, 24, 7.5, 24.5]],
    ['set:evler', [19.5, 22, 22.5, 22.5]], ['set:dar', [-25, 10.5, -24.5, 12.5]],
  ];
  for (const [id, R] of LOW) for (const [q, s] of both(R).map((r, i) => [r, i])) parapet(b, T, id + (s ? ':k' : ':g'), q, 1.1, STONE);
  for (const [id, R] of LOW) for (const r of both(R)) add(r[0], r[1], r[2], r[3], -0.3, 1.1);
  // kamyon enkazı (Meydan, orta çizgide, x boyunca; z aynasıyla kendisi simetrik): şasi + kabin + kasa yanları, teker yerinde taş takoz
  { const x0 = 5.6, x1 = 11.6, w = 2.3, cab = 1.7, burnt = '#4a3b30', rust = '#7a4a2e';
    b.obj('kamyon', () => {
      b.box((x0 + x1) / 2, 0.35, 0, x1 - x0, 0.8, w, rust, k(CK.METAL, { tag: 'prop' }));                                 // şasi / taban (0,35–1,15)
      for (const x of [x0 + 1.0, x1 - 1.0]) for (const s of [-1, 1]) b.box(x, 0, s * (w / 2 - 0.35), 0.5, 0.35, 0.5, '#5e5850', k(CK.STONE, { tag: 'prop' }));   // takozlar (teker yok)
      b.box(x1 - cab / 2, 1.15, 0, cab, 1.05, w, burnt, k(CK.METAL, { tag: 'prop' }));                                        // kabin (1,15–2,2)
      for (const s of [-1, 1]) b.box((x0 + x1 - cab) / 2, 1.15, s * (w / 2 - 0.06), x1 - x0 - cab - 0.1, 0.8, 0.12, rust, k(CK.METAL, { tag: 'prop' }));   // kasa yanları
      b.box(x0 + 0.06, 1.15, 0, 0.12, 0.8, w - 0.24, rust, k(CK.METAL, { tag: 'prop' }));                                     // kasa arka kapağı
      if (vis) {
        b.box(x1 - cab / 2 - 0.15, 1.55, 0, 0.9, 0.5, w + 0.02, '#1b1a19', n(CK.METAL));                                    // yanık cam boşluğu
        b.box(x1 + 0.04, 0.5, 0, 0.08, 0.45, w - 0.3, '#2a2522', n(CK.METAL));                                                  // ızgara
        for (const s of [-1, 1]) b.box(x1 - cab - 0.02, 0.5, s * (w / 2 + 0.03), 1.2, 0.5, 0.06, '#3b302a', n(CK.METAL));      // çamurluk (yan yüze yapışık)
        b.box((x0 + x1 - cab) / 2, 1.15, 0, x1 - x0 - cab - 0.4, 0.02, w - 0.4, '#3a2a20', n(CK.METAL));                        // kasa tabanı kurumu
      }
    });
    add(x0, -w / 2, x1, w / 2, 0, 2.2);
  }
  // tezgâhlar (Meydan kenarları; duvara yaslı)
  for (const [r, tag] of [[1, 'g'], [-1, 'k']]) {
    const S1 = r > 0 ? [2.8, 6.4] : [-6.4, -2.8], S2 = r > 0 ? [5.2, 6.8] : [-6.8, -5.2];
    stall('tezgâh:batı:' + tag, -12, -11, S1[0], S1[1], 1, 0);
    stall('tezgâh:doğu:' + tag, 11, 12, S2[0], S2[1], -1, 2);
  }
  // sandık / fıçı / araba / kuyu / hurma (güney yarısı; ayna kuzey)
  const CRATES = [
    // Han avlusu: yan kapılardan avluyu boydan boya gören çizgiyi keser (1,6 m: revak çatısına sıçranmaz)
    [-10.75, 30.8, 1.2, 2.0, 1.6, 2], [10.75, 32.2, 1.2, 2.0, 1.6, 4], [0, 31.6, 1.0, 1.0, 1.6, 5], [-12.3, 36.3, 1.0, 1.0, 1.0, 1], [12.3, 36.3, 1.0, 1.0, 1.0, 6],
    // Han Sokağı / Dar Sokak
    [-21, 32.4, 1.2, 1.0, 1.0, 3], [-29.4, 19.2, 1.0, 1.0, 1.0, 5], [-27.4, 16.4, 1.0, 1.0, 1.9, 0], [-22.6, 13.0, 0.9, 0.9, 0.9, 7],
    // Fırın Avlusu
    [-30.2, 4.2, 1.2, 1.2, 1.0, 1], [-19.8, 1.9, 1.0, 1.0, 1.9, 2],
    // Meydan
    [-3.2, 8.2, 1.2, 1.2, 1.0, 3], [3.6, 11.9, 1.0, 1.0, 1.0, 4], [-11.2, 12.4, 1.2, 1.2, 1.9, 5], [8.0, 6.4, 1.6, 1.4, 1.9, 1], [0, 9.8, 1.6, 1.0, 1.9, 6], [11.3, 12.2, 1.0, 1.0, 1.0, 6], [-7.4, 1.2, 1.1, 1.1, 1.0, 0],
    // Han Önü
    [-7.3, 14.0, 1.0, 1.0, 1.0, 1], [7.3, 14.3, 1.2, 1.0, 1.9, 2], [-4.8, 26.3, 1.0, 1.0, 1.0, 3],
    // Evler Sokağı / Doğu Han sokağı / Avlu
    [22.3, 27.6, 1.2, 1.2, 1.0, 4], [17.6, 16.6, 1.0, 1.0, 1.9, 5], [23.3, 6.2, 1.0, 1.0, 1.0, 6], [20.5, 7.4, 1.2, 1.4, 1.9, 3], [21.8, 32.3, 1.2, 1.0, 1.0, 7], [32.2, 6.0, 1.2, 1.4, 1.0, 0], [16.4, 30.6, 1.0, 1.0, 1.0, 1],
  ];
  const BARRELS = [[-16.4, 30.6, 0], [-29.3, 28.8, 1], [-24.4, 7.4, 2], [-29.4, 32.4, 3], [17.6, 13.4, 4], [23.4, 9.0, 5], [29.4, 4.3, 0], [-30.4, 2.6, 1], [11.4, 9.4, 2], [-0.2, 13.8, 3]];
  CRATES.forEach(([x, z, w, d, h, s], i) => { crate('kasa:' + i + ':g', x, z, w, d, h, s); crate('kasa:' + i + ':k', x, -z, w, d, h, s + 1); });
  BARRELS.forEach(([x, z, s], i) => { barrel('kasa:fıçı:' + i + ':g', x, z, s); barrel('kasa:fıçı:' + i + ':k', x, -z, s + 2); });
  crate('kasa:konak-önü', 13.2, 0, 1.2, 1.2, 1.0, 3);                                   // Konak Önü ortası (orta çizgide tek)
  well('kuyu:fırın', -28.5, 0); well('kuyu:avlu:g', 29.2, 7.0, 1.4); well('kuyu:avlu:k', 29.2, -7.0, 1.4);
  cart('araba:fırın:g', -20.6, 3.6, true, 0, true); cart('araba:fırın:k', -20.6, -3.6, true, 1, true);
  cart('araba:evler:g', 17.75, 25.6, false, 2); cart('araba:evler:k', 17.75, -25.6, false, 0, true);
  cart('araba:han-sokağı:g', -25.0, 32.35, true, 1); cart('araba:han-sokağı:k', -25.0, -32.35, true, 2);
  // Kemer: Dar Sokak ↔ Meydan geçidinin üstünde iki binayı bağlayan taş kemer (3,4 m üstü; erişilmez)
  for (const r of [1, -1]) b.obj('kemer:' + (r > 0 ? 'g' : 'k'), () => {
    b.box(-16.5, 3.4, r * 10.75, 1.0, 1.4, 2.5, '#d1b58a', k(CK.PLASTER, { tag: 'wall' }));
    if (vis) for (let q = 0; q < 7; q++) { const t = (q + 0.5) / 7, a = t * PI, az = r * 10.75 - Math.cos(a) * 1.15, ay = 3.25 + Math.sin(a) * 0.3; b.box(-16.5, ay, az, 1.04, 0.16, 0.38, shade('#d1b58a', 0.9), n(CK.STONE)); }
  });
  // Doğu Geçidi kemeri (2,8 m altı: yürüyen / zıplayan oyuncu geçer; damdan Meydan'a ve Fırın Avlusu'na uzanan 60 m'lik çapraz görüşü keser)
  for (const r of [1, -1]) b.obj('kemer:doğu:' + (r > 0 ? 'g' : 'k'), () => {
    b.box(15.5, 2.8, r * 8.25, 1.0, 1.8, 2.5, '#d1b58a', k(CK.PLASTER, { tag: 'wall' }));
    if (vis) for (let q = 0; q < 7; q++) { const t = (q + 0.5) / 7, a = t * PI, az = r * 8.25 - Math.cos(a) * 1.15, ay = 2.62 + Math.sin(a) * 0.25; b.box(15.5, ay, az, 1.04, 0.18, 0.38, shade('#d1b58a', 0.9), n(CK.STONE)); }
  });
  // hurmalar (gövde çarpışmalı; tacı bot görüşünü keser)
  const PALMS = [[1, -26.5, 4.3], [2, 25.0, 6.0], [3, -11.2, 7.4], [4, 6.8, 26.0]];
  for (const [nn, x, z] of PALMS) for (const [zz, s] of [[z, 0], [-z, 1]]) { if (Math.abs(z) < 1 && s) continue; const y = T.heightAt(x, zz), sc = 0.9 + ((nn * 37) % 10) / 40; b.obj('palmiye:' + nn + (s ? ':k' : ':g'), () => cgPalm(b, { x, y: y - 0.05, z: zz, s: sc, seed: nn + s * 5 })); add(x - 0.24, zz - 0.24, x + 0.24, zz + 0.24, y, y + 5); }

  // ── 5) zemin (görsel) + AO ──
  const roofs = [[PLAN.KONAK.x0, PLAN.KONAK.z0, PLAN.KONAK.x1, PLAN.KONAK.z1], ...both([PLAN.DAM.x0, PLAN.DAM.z0, PLAN.DAM.x1, PLAN.DAM.z1]), ...both([ARC.x0, ARC.z0, ARC.x1, ARC.z1])];
  const ZONES = GROUND_ZONES.flatMap(([kd, ...r]) => (r[1] === 0 && r[3] > 0 ? [[kd, r[0], -r[3], r[2], r[3]]] : [[kd, ...r], [kd, ...mz(r)]]));
  const kindAt = (kk) => {
    const i = kk % L.nx, j = (kk / L.nx) | 0, x = L.x0 + (i + 0.5) * L.C, z = L.z0 + (j + 0.5) * L.C;
    for (let s = 0; s < 4; s++) if (T.edge[kk * 4 + s] === 3) return CK.COPING;
    let kind = CK.SAND;
    for (const [kd, x0, z0, x1, z1] of ZONES) if (x > x0 && x < x1 && z > z0 && z < z1) kind = kd;
    return kind;
  };
  if (vis) stats.ground = buildGround(b, T, { kindAt, colorOf: (kd) => GROUND_COL[kd] || '#dcc592', wallColor: '#c3a676' });
  const ao = vis ? makeAO(T, L, roofs, { X0: 0, X1: 0, Z0: 0, Z1: 0 }) : null;
  b.surface = { ground: (x, z) => groundBelow(T, L, x, z), kindOf: () => CK.PLAIN, seeded: true, material: () => makeCgMaterial({ ao }) };

  // ── 6) cephe süsü, çatı / zemin süsü, ipler, uzak çevre ──
  const solidAt = (x, z, y0, y1) => { for (const c of b.colliders) if (x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2] && c.max[1] > y0 && c.min[1] < y1) return true; return false; };
  const roofed = (x, z) => roofs.some(([a, c, e, f]) => x > a && x < e && z > c && z < f);
  const blocked = (wx, wz, nx, nz, dx, dz, hw, dep, y0, y1) => {
    for (let t = -hw; t <= hw + 1e-6; t += Math.max(0.25, hw / 3)) for (const dd of [0.12, dep * 0.5, dep]) {
      const px = wx + dx * t + nx * dd, pz = wz + dz * t + nz * dd;
      if (!L.isFloor(px, pz) || T.heightAt(px, pz) > y0 + 0.05 || solidAt(px, pz, y0, y1)) return true;
    }
    return false;
  };
  if (vis) {
    stats.facade = decorateFacades(b, T, L, masses.faces, { blocked, roofed, wallColorOf });
    stats.roofClutter = roofClutter(b, L, masses.rims);
    stats.clutter = groundClutter(b, T, L, (x, z) => solidAt(x, z, T.heightAt(x, z) - 0.2, T.heightAt(x, z) + 1.5) || roofed(x, z));
    stats.hangings = hangings(b, T, L, roofed, [PLAN.PLAY.minX, PLAN.PLAY.minZ, PLAN.PLAY.maxX - PLAN.PLAY.minX, PLAN.PLAY.maxZ - PLAN.PLAY.minZ], 12);
    b.obj('dış-çevre', () => buildSurround(b, { rx: 58, rz: 62, drx: 18, drz: 18, dx: 100, dz: 106, n: 44, seed: 20261102 }));
  }

  // ── 7) doğuş: Han revakı altı (ilk 6: tur başı, çatı altında) + Han avlusu (10); kırmızı = ayna ──
  const SP = [[-10, 35.6], [-6, 35.6], [-2, 35.6], [2, 35.6], [6, 35.6], [10, 35.6], [-8.5, 31.0], [-5, 32.2], [5, 32.2], [8.5, 31.0], [-2.6, 30.0], [2.6, 30.0], [-6.4, 30.0], [6.4, 30.0], [-2.6, 33.0], [2.6, 33.0]];
  const spawns = { blue: SP.map(([x, z]) => ({ x, z, ry: 0, y: T.heightAt(x, z) })), red: SP.map(([x, z]) => ({ x, z: -z, ry: PI, y: T.heightAt(x, -z) })) };
  stats.props = propBoxes.length;
  return { spawns, stats, propBoxes, roofs, dams: [damS, damN] };
}
