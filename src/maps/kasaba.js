import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as T from './kitTown.js';
import { COL } from './kit.js';
import { KK, makeKasabaMaterial, attachKasabaLights } from './kasabaSurface.js';

// ── yüzey sınıfları (renk → gölgelendirici sınıfı; renk bu tabloda yoksa DÜZ). Yol çizgileri araç renklerinden ayrı tonda (aynı sarı/beyaz arabaya boya aşınması gelmesin) ──
const LINE_Y = '#dcad2a', LINE_W = '#ecece7';
const KIND = new Map(Object.entries({
  [KK.VEG]: ['#7f9448', '#88a04f', '#738a3f', '#8d9a52', '#76903f', '#6f8a43', '#7a8f48', '#657a3d', '#8a7a52', '#2f5a2c', '#2a4f28', '#34632f', '#27472a', '#5f8f3a', '#6b9a3f', '#547f33',
    '#4f7a33', '#5d8a3a', '#3f6a33', '#4a7a3a', '#6a9a3a', '#7aa840', '#5f8f35', '#a8b040', '#4f8a3a', '#3f7a42', '#5d9a3a'],
  [KK.DIRT]: [COL.dirt, '#8a6a40', '#8a7048'],
  [KK.ASPH]: [COL.asphalt, COL.asphaltLot, '#5a5c60'],
  [KK.PAVER]: [COL.curb],
  [KK.PLASTER]: ['#d6cfb4', '#7a8a9a', '#d9c79a', '#c9d6c0', '#e0d8c0', '#b9cbd9', '#aeb2b8', '#a9b4a0', '#b8b2a4', '#b9a98a', '#c9b48a', '#e8e4d8', '#e6dfcd'],
  [KK.BRICK]: ['#c9a27a'],
  [KK.STONE]: ['#a39a82', '#847b64', '#9a968c', '#8a867c', '#a8a49a', COL.plinth, '#9a9a94', '#d8d0bc'],
  [KK.ROOF]: ['#7a3b2e', '#8a4a3a', '#4a5360', '#a8432f', '#5b6470', '#6a4a3a', '#8a8d92', '#5a5d62', '#6b4a3a', '#4d5b3a', '#5b4a45', '#4a3b37', '#6c7078', '#7b8794', '#6b6e74'],
  [KK.WOOD]: [COL.woodLight, COL.wood, COL.woodDark, '#7a5a38', '#8b6a45', '#8a6a45', '#6a5a45', '#a8804f', '#98703f', '#6a4a2a', '#8a5a38'],
  [KK.BOARD]: ['#9c3a2c', '#7d2f23', '#8b7a5a', '#5a3d24', '#5e4026'],
  [KK.CONC]: [COL.concrete, '#b9b9b3', '#8a8d90', '#6a6d72'],
  [KK.FLOOR]: ['#9c7a52', '#a58a62', '#8a6a48', '#b09068', '#d8dcd8', '#c8d4d8', '#d8d4c4', '#8a8d8a', '#9a9486', '#7a8590', '#b9b5aa', '#a58a68', '#9a8a70', '#b9b9b0'],
  [KK.INWALL]: ['#e8dfc8', '#dfe4d4', '#e4d6c2', '#d8dce4', '#eadcc8', '#d6e0dc'],
  [KK.PAINT]: [LINE_Y, LINE_W],
  [KK.CORR]: ['#8f949c', '#b9bdc2'],
}).flatMap(([k, cs]) => cs.map((c) => [new THREE.Color(c).getHexString(), +k])));
const kindOf = (c) => KIND.get(new THREE.Color(c).getHexString()) ?? KK.PLAIN;

// Harita 1 — KASABA (v2)
// 168 × 116 m. Mavi çiftlik avlusu (batı) ve Kırmızı depo avlusu (doğu) yüksek taş duvarlarla çevrili: düşman doğuş noktasına görüş hattı yok.
// Her avlunun 3 çıkışı var: ana cadde kapısı (kontrol noktası şikânı ile görüş kesik) + kuzey/güney tarla kapıları.
// Yerleşim 180° dönel simetriktir (batı yarı + dönmüş doğu yarı, farklı bina çeşitleri): KB 'Evler' ↔ GD 'Pazar', GB 'Kilise' ↔ KD 'Benzinlik'.
// Çatı/kule keskin nişancı noktaları: su kuleleri, kilise çan kulesi, belediye/pazar/okul çatıları, gözetleme kuleleri.

export const KASABA_BOUNDS = { minX: -84, maxX: 84, minZ: -58, maxZ: 58 };
const BLUE_ZONE = { minX: -83, maxX: -62, minZ: -20, maxZ: 20 };
const RED_ZONE = { minX: 62, maxX: 83, minZ: -20, maxZ: 20 };

// Bina çeşitleri: V.A (batı yarı) / V.B (dönmüş doğu yarı)
const VA = { yard: 'farm', nwB1: 'school', nwB2: 'houses', nwB3: 'townhall', swB1: 'garage', swB2: 'church', swB3: 'park', tint: 0 };
const VB = { yard: 'depot', nwB1: 'police', nwB2: 'market', nwB3: 'bank', swB1: 'workshop', swB2: 'gas', swB3: 'parking', tint: 1 };

export function buildKasaba() {
  const b = new MapBuilder();
  const rng = makeRng(1337);
  const lamps = [];                                                            // gece sahte ışığı: lamba başları (dünya) [x, y, z, yarıçap, renk?, şiddet?]
  b.surface = { ground: () => 0, kindOf, seeded: true, material: () => makeKasabaMaterial(lamps) };
  const climb = [];     // tırmanma probu için hedefler ({name,x,y,z,entry})
  const infos = {};
  const _v = new THREE.Vector3();
  // bina bilgisi (hedefler) dönüş uygulandığı için o anki çizim matrisiyle DÜNYA koordinatına çevrilir
  const toW = (x, y, z) => { _v.set(x, y, z).applyMatrix4(b.M); return [_v.x, _v.y, _v.z]; };
  const reg = (info, name) => {
    if (!info) return;
    infos[name] = info;
    const e = info.entry ? toW(info.entry.x, 0, info.entry.z) : null;
    for (const t of info.targets || []) { const [wx, wy, wz] = toW(t.x, t.y, t.z); climb.push({ name: `${name}:${t.name || t.room}`, x: wx, y: wy, z: wz, entry: e ? { x: e[0], z: e[2] } : null }); }
  };

  // ── bitki / kaya yerleşimi: tepe yarıçapı yapıya, araca (ertelenmiş dahil) ve başka bitkiye değmeyen yer (iç içe ağaç / çatıya giren dal yok) ──
  const veg = [];                                                            // dünya [x, z, yarıçap]
  const VR = { car: 2.5, bus: 5.3, truck: 4.7 };
  const roomFor = (lx, lz, r, rLow) => {                                     // veg[3] = sert (yapı diski): yarıçaplar toplanır                                     // r: 1,4 m üstü engellere (tepe), rLow: alçak engellere (gövde / çalı)
    const [x, , z] = toW(lx, 0, lz);
    for (const [a, c, q, hard] of veg) if (Math.hypot(a - x, c - z) < (hard ? q + r : Math.max(q, r) + 0.3)) return false;
    for (const v of b.pendingVeh) { const p = _v.set(v.o.x || 0, 0, v.o.z || 0).applyMatrix4(v.M); if (Math.hypot(p.x - x, p.z - z) < (VR[v.kind] || 3) + r) return false; }
    for (; gridN < b.colliders.length; gridN++) {                             // yeni eklenen çarpışma kutularını 4 m ızgaraya işle (her çağrıda tüm listeyi taramaz)
      const c = b.colliders[gridN];
      if (c.max[1] < 0.25 || c.max[0] - c.min[0] > 60 || c.max[2] - c.min[2] > 60) continue;
      for (let i = Math.floor(c.min[0] / 4); i <= Math.floor(c.max[0] / 4); i++) for (let k = Math.floor(c.min[2] / 4); k <= Math.floor(c.max[2] / 4); k++) { const key = i * 1000 + k; (grid.get(key) || grid.set(key, []).get(key)).push(c); }
    }
    const R = Math.max(r, rLow);
    for (let i = Math.floor((x - R) / 4); i <= Math.floor((x + R) / 4); i++) for (let k = Math.floor((z - R) / 4); k <= Math.floor((z + R) / 4); k++) for (const c of grid.get(i * 1000 + k) || []) {
      const rr = c.max[1] > 1.4 ? r : rLow, dx = Math.max(c.min[0] - x, 0, x - c.max[0]), dz = Math.max(c.min[2] - z, 0, z - c.max[2]);
      if (dx * dx + dz * dz < rr * rr) return false;
    }
    return true;
  };
  const grid = new Map(); let gridN = 0;
  const SPEC = { oak: [2.2, 0.9], pine: [1.6, 0.8] };
  // tree: (x,z) doluysa en çok `search` m çevresinde boş yer aranır; bulunamazsa ağaç konmaz
  const tree = (kind, x, z, s, search = 0) => {
    const [R, L] = SPEC[kind];
    for (let d = 0; d <= search + 1e-6; d += 0.4) for (let k = 0; k < (d ? 12 : 1); k++) {
      const px = x + d * Math.cos(k * Math.PI / 6), pz = z + d * Math.sin(k * Math.PI / 6);
      if (!roomFor(px, pz, R * s, L * s)) continue;
      (kind === 'oak' ? K.oak : K.pine)(b, rng, px, pz, s); const [wx, , wz] = toW(px, 0, pz); veg.push([wx, wz, R * s]); return true;
    }
    return false;
  };
  const shrub = (x, z, s) => { if (!roomFor(x, z, 0.85 * s, 0.85 * s)) return; K.bush(b, rng, x, z, s); const [wx, , wz] = toW(x, 0, z); veg.push([wx, wz, 0.85 * s]); };
  const stone = (x, z, s) => { if (!roomFor(x, z, 1.1 * s, 1.1 * s)) return; K.rock(b, rng, x, z, s); const [wx, , wz] = toW(x, 0, z); veg.push([wx, wz, 1.1 * s]); };

  // lamba direği + sahte ışık kaydı (baş: direğin 1,2 m önünde, 5,9 m)
  const lamp = (x, z, ry = 0) => { K.lamp(b, x, z, ry); const [wx, wy, wz] = toW(x + 1.2 * Math.cos(ry), 5.6, z - 1.2 * Math.sin(ry)); lamps.push([wx, wy, wz, 12.5]); };
  const cont = (o) => b.withKind(KK.CORR, () => K.container(b, o));             // konteyner: oluklu sac

  // ───────── Zemin ─────────
  b.box(0, -1.0, 0, 900, 1.0, 900, COL.grass, { collide: false });
  const patchCols = ['#88a04f', '#738a3f', '#8d9a52', '#76903f'];
  for (let i = 0; i < 120; i++) b.box(-82 + rng() * 164, 0, -56 + rng() * 112, 4 + rng() * 9, 0.025, 4 + rng() * 9, patchCols[i % 4], { collide: false });

  b.autoPlace = true;
  const roads = [];
  let rotated = false;
  const car = (x, z, ry, color, wreck = false) => K.car(b, { x, z, ry, color, wreck });
  const palette = ['#b33a2a', '#2c5aa0', '#e8e8e4', '#4a7a4f', '#d9a921', '#6a6d73'];
  center();
  half(VA, false);
  rotated = true;
  b.with(0, 0, 0, Math.PI, () => half(VB, true));
  rotated = false;
  surround();
  b.flushVehicles();

  // ───────── Doğuş noktaları ─────────
  const spawns = {
    blue: pickSpawns(BLUE_ZONE, -Math.PI / 2, 20, 1),
    red: pickSpawns(RED_ZONE, Math.PI / 2, 20, -1),
  };
  const objectives = [
    { id: 'evler', core: true, name: 'Evler', x: -35.5, z: -12, r: 9 },       // iki ev + ön bahçe: bina içi / cadde / çatı
    { id: 'kilise', name: 'Kilise', x: -36, z: 19, r: 9 },                    // nef (orta koridor) + çan kulesi + mezarlık
    { id: 'kavsak', core: true, name: 'Kavşak', x: 0, z: 0, r: 9 },           // çeşmeli meydan
    { id: 'benzinlik', name: 'Benzinlik', x: 33, z: -17, r: 9 },              // saçak altı + market (çatısı açık)
    { id: 'pazar', core: true, name: 'Pazar', x: 35.5, z: 12, r: 9 },         // pazar hali + tezgâhlar
  ];

  const group = b.build();
  for (const m of group.children) if (m.material && m.material.userData && m.material.userData.lamps) attachKasabaLights(m);   // gece: kameraya yakın lambalar
  return {
    id: 'kasaba',
    name: 'Kasaba',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: KASABA_BOUNDS,
    baseZones: { blue: { ...BLUE_ZONE }, red: { ...RED_ZONE } },
    roads,
    spawns,
    objectives,
    climb,
    infos,     // geliştirme/probe: bina üreteç bilgileri
  };

  // ═════════ yardımcılar ═════════
  function road(x0, z0, x1, z1, color = COL.asphalt, mini = true) {
    b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.06, z1 - z0, color, { collide: false });
    if (mini && color === COL.asphalt) roads.push(rotated ? { x0: -x1, z0: -z1, x1: -x0, z1: -z0 } : { x0, z0, x1, z1 });   // minimap: dönmüş yarıda dünya koordinatı
  }
  function walk(x0, z0, x1, z1) { b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.16, z1 - z0, COL.curb); }
  function dashX(x0, x1, z, step = 4) { for (let x = x0; x <= x1; x += step) b.box(x, 0.06, z, 2, 0.02, 0.2, LINE_Y, { collide: false }); }
  function dashZ(z0, z1, x, step = 4) { for (let z = z0; z <= z1; z += step) b.box(x, 0.06, z, 0.2, 0.02, 2, LINE_Y, { collide: false }); }
  // ═════════ yarım harita (x<0 çerçevesi) ═════════
  function half(V, east) {
    const taken = [];       // ağaç/çalı yasak dikdörtgenler
    const occ = (x0, z0, x1, z1, m = 1.5) => taken.push([x0 - m, z0 - m, x1 + m, z1 + m]);
    const free = (x, z) => !taken.some(([a, c, d, e]) => x > a && x < d && z > c && z < e);

    // ── yollar ──
    road(-61.5, -5, 0, 5);                       // ana cadde (avlu duvarının yüzünden başlar; duvar asfaltın üstünde durmaz)
    road(-4, -58, 0, 58);                        // orta cadde
    road(-77, -34, -4, -26); road(-77, 26, -4, 34);        // kuzey / güney sokak
    road(-49, -26, -45, -5); road(-26, -26, -22, -5);      // yan sokaklar (kuzey)
    road(-49, 5, -45, 26); road(-26, 5, -22, 26);          // yan sokaklar (güney)
    road(-74, -34, -70, -20.5, COL.dirt, false); road(-74, 20.5, -70, 34, COL.dirt, false);   // avlu çıkış yolları
    b.box(-72.5, 0, 0, 21, 0.035, 41, COL.dirt, { collide: false });                          // avlu zemini
    occ(-62, -5, 0, 5, 0.5); occ(-4, -58, 0, 58, 0.5); occ(-77, -34, -4, -26, 0.5); occ(-77, 26, -4, 34, 0.5);
    occ(-49, -26, -45, 26, 0.5); occ(-26, -26, -22, 26, 0.5); occ(-84, -21, -61, 21, 0);
    // kaldırımlar + çizgiler
    walk(-61, 5, -6, 7); walk(-61, -7, -6, -5);
    for (const [za, zb] of [[-58, -34], [-26, -7], [7, 26], [34, 58]]) walk(-6, za, -4, zb);
    dashX(-60, -4, 0); dashZ(-56, -6, -2); dashZ(6, 56, -2);
    for (const s of [-4.5, 4.5]) b.box(-33, 0.06, s, 58, 0.02, 0.16, LINE_W, { collide: false });
    for (let k = 0; k < 8; k++) { b.box(-8, 0.06, -3.5 + k, 0.55, 0.02, 1.0, LINE_W, { collide: false, ry: Math.PI / 2 }); }
    for (const sz of [-30, 30]) dashX(-76, -6, sz);

    yard(V);
    chicane();
    streetProps(V);                                  // lamba / araç / siper önce: bina çevresi ağaçları bunları görüp yer seçer
    nwQuarter(V, occ);
    swQuarter(V, occ);
    fields(V, occ, free);
  }

  // ───────── avlu (spawn): taş duvarlar, 3 çıkış ─────────
  function yard(V) {
    const depot = V.yard === 'depot';
    const wc = depot ? '#8a8d90' : '#a39a82', cap = depot ? '#6a6d72' : '#847b64';
    const W = { h: 2.9, t: 0.5, color: wc, cap };
    // kuzey/güney duvarı köşe sütunlarını taşır; batı/doğu duvarı sütun yüzlerinde (z ±19,85) biter: köşede tek sütun, duvar duvara girmez
    T.wallStone(b, rng, -83.75, -19.85, -83.75, 19.85, { ...W, ends: [false, false] });
    T.wallStone(b, rng, -83.75, -20.25, -61.75, -20.25, { ...W, gaps: [{ at: -72, w: 4 }] });
    T.wallStone(b, rng, -83.75, 20.25, -61.75, 20.25, { ...W, gaps: [{ at: -72, w: 4 }] });
    T.wallStone(b, rng, -61.75, -19.85, -61.75, 19.85, { ...W, gaps: [{ at: 0, w: 6 }], ends: [false, false] });
    // kapı sancakları (takım rengi): direk kapı sütununun tepesine oturur, bayrak avlu içine doğru
    const flag = depot ? '#d63a2b' : '#2b6fd6', PT = W.h + 0.35;          // sütun tepesi
    for (const fz of [-3, 3]) { b.box(-61.75, PT, fz, 0.16, 2.0, 0.16, '#4a4d52', { collide: false }); b.box(-62.43, PT + 1.1, fz, 1.2, 0.8, 0.06, flag, { collide: false }); }
    for (const gx of [-74, -70]) for (const gz of [-20.25, 20.25]) b.box(gx, PT, gz, 0.5, 0.12, 0.5, flag, { collide: false });   // tarla kapısı sütun başlığı (takım rengi)
    if (!depot) {
      reg(K.barn(b, rng, { x: -75, z: -12.3, w: 10, d: 14, ry: Math.PI / 2, doors: 'front' }), 'ciftlik-ambar');
      reg(K.house(b, rng, { x: -75, z: 12.5, w: 10, d: 8, floors: 2, door: 'n', wall: '#d6cfb4', roof: '#7a3b2e' }), 'ciftlik-ev');
      K.silo(b, -79.5, 0.5, 2.0, 10);
      for (let i = 0; i < 5; i++) K.hayBale(b, -76.7 + (i % 3) * 1.3, 4 + Math.floor(i / 3) * 1.3);      // çitin (x −73) 0,4 m batısında
      K.hayBale(b, -76.05, 4.65, 1.2);
      K.truck(b, { x: -67, z: 14.5, ry: Math.PI / 2, color: '#2c5aa0', cargo: '#cdd2d8' });
      K.sandbags(b, -66.5, -10.5, 4.5, Math.PI / 2);
      K.sandbags(b, -66.5, 8.5, 3.6, Math.PI / 2);
      for (const [cx, cz, s, y] of [[-64, -15, 1.1, 0], [-64, -13.8, 1.1, 0], [-64, -14.4, 0.9, 1.1]]) K.crate(b, cx, cz, s, y);
      b.cyl(-70, 0, -4, 0.9, 1.0, 0.9, '#8a867c', { seg: 8 });                          // kuyu
      K.barrel(b, -64, 17.5, '#2c5aa0'); K.barrel(b, -64.8, 18, '#2c5aa0'); K.barrel(b, -64.2, -17.8, '#c0392b');
      K.dumpster(b, -80.5, 17.5, 0);
      T.fence(b, [[-73, 8], [-73, 2.5], [-68, 2.5]]);
      lamp(-64, -4, Math.PI); lamp(-64, 4, Math.PI); lamp(-69, 18.5, 0);
    } else {
      reg(K.warehouse(b, rng, { x: -75, z: -11, w: 14, d: 12, ry: Math.PI / 2 }), 'depo-ic');
      reg(K.house(b, rng, { x: -75, z: 14, w: 9, d: 6, floors: 1, door: 'n', flat: true, theme: 'office', wall: '#aeb2b8', roof: '#6b6e74' }), 'depo-ofis');
      cont({ x: -79, z: 5.5, ry: 0, color: '#c0392b' }); cont({ x: -79, z: 5.5, y: 2.6, ry: 0, color: '#d9a921' });
      cont({ x: -71, z: 5.5, ry: 0, color: '#3b6a9a' });
      cont({ x: -64.6, z: -12.6, ry: Math.PI / 2, color: '#4a7a4f' });   // depo kapısının (x −69) 3 m önünde
      K.truck(b, { x: -66.5, z: 15, ry: Math.PI / 2, color: '#a8281f', cargo: '#b9bec4' });
      K.sandbags(b, -66.5, -6.5, 4.0, Math.PI / 2); K.sandbags(b, -66.5, 7.5, 3.4, Math.PI / 2);
      for (const [cx, cz, s, y] of [[-72, -2.3, 1.1, 0], [-70.85, -2.1, 1.0, 0], [-72, -2.35, 0.9, 1.1]]) K.crate(b, cx, cz, s, y);   // depo duvarının (z −3,75) dışında; üstteki alttakine oturur
      K.barrel(b, -64, -17, '#c0392b'); K.barrel(b, -64.8, -17.5, '#d9a921'); K.barrel(b, -63.6, -16.3, '#c0392b');
      K.barrier(b, -66.9, -17.6, 0); K.barrier(b, -69, 17.6, 0);
      lamp(-64, -4, Math.PI); lamp(-64, 4, Math.PI); lamp(-69, -18.5, 0);
    }
  }

  // ───────── ana cadde kontrol noktası (görüşü keser, S-şikân) ─────────
  function chicane() {
    cont({ x: -54, z: -2.0, ry: Math.PI / 2, color: '#3b6a9a' });
    cont({ x: -46, z: 2.0, ry: Math.PI / 2, color: '#d9a921' });
    K.barrier(b, -58.5, 3.6, Math.PI / 2); K.barrier(b, -50, -3.8, 0); K.sandbags(b, -57, -3.4, 3.0, 0);
    T.wallStone(b, rng, -54, -9.4, -54, -5.6, { h: 2.4, t: 0.5, color: '#9a968c' }); T.wallStone(b, rng, -44.4, 5.6, -44.4, 9.4, { h: 2.4, t: 0.5, color: '#9a968c' });   // uç sütunu konteynerin 0,15 m önünde biter
    T.streetSign(b, -60, 5.6, Math.PI, '#c0392b');
    lamp(-57, 6.2, 0); lamp(-48, -6.2, Math.PI);
  }

  // ───────── kuzeybatı bölgesi (z<0) ─────────
  function nwQuarter(V, occ) {
    // B1: okul / karakol (x -61…-49)
    if (V.nwB1 === 'school') {
      reg(K.house(b, rng, { x: -55.0, z: -17, w: 11, d: 9, floors: 2, door: 's', theme: 'school', flat: true, roofAccess: true, wall: '#c9a27a', roof: '#8a4a3a' }), 'okul');
      T.hedge(b, -61, -9.6, -57.2, -9.6); T.hedge(b, -53.4, -9.6, -49, -9.6);      // şikân duvarı sütununa (x −53,6) değmez
      T.bench(b, -52, -8.4, 0); T.trashCan(b, -58, -8.4);
    } else {
      reg(K.house(b, rng, { x: -55.5, z: -17, w: 10, d: 9, floors: 2, door: 's', theme: 'office', flat: true, roofAccess: true, wall: '#7a8a9a', roof: '#4a5360' }), 'karakol');
      K.sandbags(b, -58.5, -9.5, 3.0, 0); K.sandbags(b, -51.9, -9.0, 2.4, 0); K.barrier(b, -55.9, -8.2, 0);
      car(-59.1, -7.9, 0.15, '#e8e8e4'); b.box(-59.1, 1.57, -7.9, 0.6, 0.12, 1.2, '#2b6fd6', { collide: false, o: { glow: true }, ry: 0.15 });   // avlu duvarı / kum torbası / lambaya değmez
    }
    occ(-61, -23, -49, -12);
    // B2: evler / pazar (x -45…-26)
    if (V.nwB2 === 'houses') {
      reg(K.house(b, rng, { x: -40.0, z: -17.5, w: 9.4, d: 9, floors: 2, door: 's', wall: '#d9c79a', roof: '#a8432f' }), 'ev-1');   // yan sokağın (x −45) doğusunda, ev-2 ile kaide arası 0,2 m
      reg(K.house(b, rng, { x: -30.5, z: -16.5, w: 8, d: 8, floors: 3, door: 's', wall: '#c9d6c0', roof: '#5b6470' }), 'ev-2');
      T.hedge(b, -45, -9.8, -42.4, -9.8); T.hedge(b, -39.6, -9.8, -31.8, -9.8); T.hedge(b, -29.2, -9.8, -26, -9.8);
      T.fence(b, [[-45, -25.4], [-26, -25.4]]);
      car(-36.5, -10.6, Math.PI / 2, '#2c5aa0'); K.crate(b, -26.8, -24, 1.0); T.planter(b, -43.5, -10.9);
    } else {
      reg(K.house(b, rng, { x: -35.5, z: -17, w: 16, d: 11, floors: 2, door: 's', theme: 'shop', flat: true, roofAccess: true, wall: '#c9a27a', roof: '#6a4a3a' }), 'pazar-hali');
      T.stall(b, rng, { x: -42, z: -8.3, ry: 0, color: '#c0392b' }); T.stall(b, rng, { x: -29, z: -8.3, ry: 0, color: '#2c7a4a' }); T.stall(b, rng, { x: -45.2, z: -14, ry: Math.PI / 2, color: '#d9a921' });
      K.crate(b, -27.5, -24.3, 1.1); K.crate(b, -28.7, -24.3, 1.0); K.truck(b, { x: -38, z: -24.2, ry: 0, color: '#e8e8e4', cargo: '#c8ccd0' });
    }
    occ(-45, -26, -26, -9);
    // B3: belediye / banka (x -22…-6)
    if (V.nwB3 === 'townhall') {
      reg(K.house(b, rng, { x: -14, z: -17.5, w: 15, d: 10, floors: 2, door: 's', theme: 'office', flat: true, roofAccess: true, porch: false, awning: false, wall: '#e0d8c0', roof: '#8a8d92' }), 'belediye');
      // revak: cephe (z −12,35) önünde basamak + 4 sütun + duvara dayanan saçak; kapı sundurması yok (iki saçak üst üste binmesin)
      b.box(-14, 0, -11.22, 8.4, 0.14, 1.96, '#d8d4c8', { collide: false });                       // basamak: kaide yüzünden (z −12,2) başlar
      for (const sx of [-3.6, -1.3, 1.3, 3.6]) b.box(-14 + sx, 0.14, -10.6, 0.5, 3.26, 0.5, '#f0eee6');
      b.box(-14, 3.4, -11.3, 8.4, 0.32, 2.1, '#d8d4c8', { collide: false });
      b.box(-14, 0, -8.6, 0.12, 5.0, 0.12, '#4a4d52', { collide: false }); b.box(-13.44, 4.3, -8.6, 1.0, 0.6, 0.04, '#d63a2b', { collide: false });
    } else {
      reg(K.house(b, rng, { x: -14, z: -17.5, w: 13, d: 9, floors: 3, door: 's', theme: 'office', flat: true, roofAccess: true, wall: '#b9cbd9', roof: '#4a5360' }), 'banka');
      K.sandbags(b, -19, -11.2, 2.6, 0); car(-9, -10.2, Math.PI / 2, '#6a6d73', true);
    }
    occ(-22, -23, -6, -12);
    // yan sokak engelleri
    K.dumpster(b, -47, -22, Math.PI / 2); car(-47.0, -14, Math.PI / 2 + 0.1, palette[2], true);
    car(-24, -9, Math.PI / 2, palette[3]); K.barrel(b, -24.8, -23, '#c0392b'); K.barrel(b, -23.9, -23.4, '#c0392b');
    lamp(-26.5, -8, 0); lamp(-45.4, -23.2, 0);       // yan sokak: çit ucu ile ev köşesi arasında geçit 2 m
  }

  // ───────── güneybatı bölgesi (z>0) ─────────
  function swQuarter(V, occ) {
    // B1': garaj / atölye (x -61…-49)
    const gwall = V.tint ? '#a9b4a0' : '#b8b2a4';
    reg(K.house(b, rng, { x: -55, z: 16.5, w: 11, d: 9, floors: 1, door: 'n', theme: 'garage', flat: true, roofAccess: !!V.tint, wall: gwall, roof: '#5a5d62' }), 'garaj');
    car(-59.5, 9.4, 0.2, palette[V.tint ? 1 : 0], true); car(-51.5, 9.2, -0.1, palette[4]); K.crate(b, -61, 24, 1.1); K.crate(b, -59.8, 24.3, 1.0);
    K.barrel(b, -50, 24.5, '#4a6a8a'); K.barrel(b, -49.7, 23.5, '#4a6a8a'); b.cyl(-58, 0, 24.2, 0.45, 0.45, 0.36, '#1c1c1e', { seg: 10 });   // lastik yığını (çarpışmalı: çalı içine konmaz)
    occ(-61, 9, -49, 26);
    // B2': kilise / benzinlik (x -45…-26)
    if (V.swB2 === 'church') {
      // nef 11,6 m: kule girişi kaldırımın (z 7) arkasında, nef + kaide güney sokağın (z 26) önünde biter (kule kaldırıma oturmaz)
      reg(K.church(b, rng, { x: -36, z: 19.6, w: 9, d: 11.6 }), 'kilise');
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) K.tombstone(b, -30.55 + c * 1.85, 14.6 + r * 3.2, 0);   // kilise kaidesi (x −31) ile çit (x −26,2) arasında
      T.fence(b, [[-26.2, 12.2], [-26.2, 16.4]]); T.fence(b, [[-26.2, 19.4], [-26.2, 24.5]]);
      T.hedge(b, -45, 25.4, -41.5, 25.4); tree('oak', -43.6, 19.5, 1.0); tree('oak', -43.3, 12.0, 0.9); shrub(-28.6, 24.6, 1);
      T.bench(b, -42, 23, Math.PI / 2);
    } else {
      reg(K.gasStation(b, rng, { x: -31.5, z: 17, ry: Math.PI / 2, store: 'n' }), 'benzinlik');            // market (batı) yan sokağa (x −45) taşmaz
      for (const lz of [12.5, 21.5]) { const [wx, wy, wz] = toW(-31.5, 4.3, lz); lamps.push([wx, wy, wz, 10, '#fff1d0', 2.0]); }   // saçak lambaları (gece)
      K.dumpster(b, -26.6, 24.4, Math.PI / 2); K.barrel(b, -42.9, 9.6, '#2c5aa0'); K.barrel(b, -42.1, 9.9, '#2c5aa0'); car(-37, 7.4, Math.PI / 2 + 0.1, '#d9a921');
    }
    occ(-46, 8, -26, 26);
    // B3': park / otopark (x -22…-6)
    if (V.swB3 === 'park') {
      T.gazebo(b, { x: -14, z: 17 }); { const [gx, , gz] = toW(-14, 0, 17); veg.push([gx, gz, 3.1, true]); }      // çardak çatısı (r 3,1): ağaç tepesi / çalı değmez
      T.hedge(b, -21, 10.5, -15, 10.5); T.hedge(b, -21, 24, -17, 24); T.hedge(b, -10, 23.8, -6.5, 23.8, { h: 1.3 });   // doğu ön çit yerine büfe (çit büfenin içinden geçmesin)
      T.hedge(b, -21, 13.5, -21, 17.5); T.hedge(b, -7, 15, -7, 20);
      T.kiosk(b, rng, { x: -8.5, z: 9.6, ry: 0, color: '#4a8a6a' });
      T.bench(b, -17, 13, 0); T.bench(b, -11, 21.3, Math.PI); T.bench(b, -19.5, 20, Math.PI / 2);
      T.planter(b, -17.5, 9.2, 2, 0.8); T.trashCan(b, -12.5, 12.6);
      for (const [px, pz] of [[-19, 14], [-9, 14], [-18, 21], [-8, 21.5], [-14, 24.5], [-20, 8.6], [-12.4, 8.6]]) tree('oak', px, pz, 0.9 + rng() * 0.4, 1.8);   // çardak / büfe / çite değmeyen en yakın yer
      for (let i = 0; i < 5; i++) shrub(-21 + rng() * 14, 9 + rng() * 15, 0.9);
    } else {
      b.box(-14, 0, 17, 15.6, 0.04, 17.6, COL.asphaltLot, { collide: false });
      for (let i = 0; i < 4; i++) { b.box(-19.5 + i * 3.6, 0.04, 12.4, 0.12, 0.02, 3.4, LINE_W, { collide: false }); b.box(-19.5 + i * 3.6, 0.04, 21.6, 0.12, 0.02, 3.4, LINE_W, { collide: false }); }
      for (const [cx, cz, ry, ci, w] of [[-19, 12.5, Math.PI / 2, 0, 0], [-15.4, 12.6, Math.PI / 2, 1, 0], [-11.8, 12.4, Math.PI / 2, 2, 1], [-8.2, 12.6, Math.PI / 2, 3, 0], [-19, 21.5, Math.PI / 2, 4, 1], [-12, 21.4, Math.PI / 2, 5, 0], [-8.3, 21.8, Math.PI / 2, 1, 0]]) car(cx, cz, ry, palette[ci], !!w);
      K.bus(b, { x: -15.2, z: 17, ry: 0, color: '#2c7a4a' });                    // ön tampon büfe tezgâhına (x −9,9) girmez
      T.kiosk(b, rng, { x: -7.8, z: 17.5, ry: -Math.PI / 2, color: '#9a6a3a' }); lamp(-20.6, 17, 0); lamp(-6.6, 12, Math.PI);   // lamba park yerinin değil kaldırım kenarının üstünde
      T.busStop(b, { x: -21, z: 7.5, ry: 0 });
    }
    occ(-22, 8, -6, 26);
    K.dumpster(b, -47, 24, Math.PI / 2); car(-46.6, 14, Math.PI / 2 - 0.1, palette[0], true);   // garaj duvarıyla arasında 1,9 m geçit (botlar sıkışmaz) car(-24, 20, Math.PI / 2, palette[V.tint ? 5 : 1]);
    lamp(-26.5, 8, 0); lamp(-45.3, 21.2, 0);
  }

  // ───────── cadde engelleri (görüş kes, her ~8-12 m siper) ─────────
  function streetProps(V) {
    // ana cadde (z -5…5): şerit değişimli araçlar
    car(-39, 3.0, 0.12, palette[V.tint ? 2 : 3], true); K.barrier(b, -33.5, -2.2, 0.1); car(-27, 1.8, Math.PI + 0.1, palette[0]);
    K.sandbags(b, -20, -3.2, 3.2, 0.2); car(-15, 3.2, -0.1, palette[5], true); K.barrier(b, -9.5, 1.8, Math.PI / 2);
    K.bus(b, { x: -23, z: -3.4, ry: 0.05, color: V.tint ? '#3b6a9a' : '#d9a921' });
    // orta cadde (x -4…4): kuzey bölümü (güney, 180° döndürülen yarıdan gelir)
    car(-1.8, -12, Math.PI / 2 + 0.12, palette[1]); K.barrier(b, 1.5, -18, Math.PI / 2); car(-1.5, -24, Math.PI / 2 - 0.2, palette[4], true);
    K.sandbags(b, 1.8, -31, 3, Math.PI / 2); car(-1.5, -39, Math.PI / 2, palette[2], true); K.barrier(b, 1.5, -47, Math.PI / 2); car(-1.5, -55.4, Math.PI / 2 + 0.2, palette[3]);   // pano direklerinden (z −52) uzak
    // kuzey sokak (z -34…-26)
    for (const [x, z, ry, ci, w] of [[-72, -29.4, 0.1, 0, 1], [-63, -31.4, Math.PI, 2, 0], [-55, -28.6, 0.05, 4, 1], [-47.5, -31, 0, 1, 0], [-38, -29, 0.12, 5, 1], [-29.5, -31.2, Math.PI - 0.1, 3, 0], [-20, -28.8, 0, 2, 1], [-11.5, -31.5, 0.1, 0, 0]]) car(x, z, ry, palette[ci], !!w);
    K.barrier(b, -59, -29.5, 0); K.sandbags(b, -42.5, -28.2, 3.2, 0); K.barrier(b, -33.5, -31.4, 0); K.sandbags(b, -16.2, -29.7, 3, 0); K.barrier(b, -7.5, -28.5, 0);
    // güney sokak (z 26…34)
    for (const [x, z, ry, ci, w] of [[-72, 31, 0, 3, 1], [-64, 28.6, 0.1, 1, 0], [-56, 31.4, Math.PI, 5, 1], [-47, 29, 0, 2, 0], [-38.5, 31.5, 0.05, 0, 1], [-30, 28.8, 0.1, 4, 0], [-21, 31.2, Math.PI, 1, 1], [-12, 28.8, 0, 5, 0]]) car(x, z, ry, palette[ci], !!w);
    K.barrier(b, -60, 31, 0); K.sandbags(b, -43, 29.4, 3.2, 0); K.barrier(b, -34, 31.4, 0); K.sandbags(b, -16.5, 31.2, 3, 0); K.barrier(b, -7.5, 29, 0);
    // kaldırıma park etmiş araçlar (cadde kenarındaki uzun görüş şeritlerini keser)
    for (const [x, z, ry, ci, w] of [[-5.1, -14, Math.PI / 2, 1, 0], [-5.1, -41, Math.PI / 2, 4, 1], [-5.1, 15, Math.PI / 2, 2, 1], [-5.1, 42, Math.PI / 2, 0, 0], [-38, -6.2, 0, 3, 0], [-16.5, -6.2, 0.02, 5, 1], [-29, 6.2, Math.PI, 2, 0], [-11, 6.2, Math.PI, 0, 1], [-55.4, 6.2, Math.PI, 4, 1]]) car(x, z, ry, palette[ci], !!w);
    // sokak kenarı (kaldırım/çim şeridi) siperleri: kenar boyunca uzun açık hat bırakma
    for (let x = -70; x < -8; x += 11) { T.hedge(b, x, -34.5, x + 4.5, -34.5, { h: 1.9, t: 0.8 }); T.hedge(b, x + 5.5, 34.5, x + 10, 34.5, { h: 1.9, t: 0.8 }); }   // asfaltın (|z| 34) dışında, çimde
    // lamba direkleri (cadde boyunca, geceyi aydınlatır)
    // kol yola bakar (eskiden cadde boyunca / binaya dönüktü: orta caddede kol belediye ve bankanın duvarına giriyordu)
    for (let x = -55.6; x < -8; x += 14) lamp(x, -7.4, -Math.PI / 2);
    for (const x of [-51, -40.2, -18.2, -12.4]) lamp(x, 7.4, Math.PI / 2);       // güney kaldırımı: yan sokak ağzına (x −26…−22), kilise basamağına (x −37,5…) ve büfenin (x −10,3…) dibine düşmez
    for (let x = -68; x < -8; x += 14) { lamp(x, -35.6, -Math.PI / 2); lamp(x + 7, 35.6, Math.PI / 2); }
    for (let z = -50; z < -10; z += 14) { lamp(-4.6, z, 0); }                   // kaldırımın yol kenarında: çit / bina ile arasında 1,8 m geçit
    for (let z = 14; z < 54; z += 14) { lamp(-4.6, z + 4, 0); }
  }

  // ───────── tarlalar, ağaçlar, su kulesi, gözetleme kulesi ─────────
  function fields(V, occ, free) {
    // KB tarla + kuzey şeridi
    T.crops(b, rng, -82, -56, -66, -42, { along: 'x' }); T.crops(b, rng, -62, -56, -50, -40, { along: 'z' });
    occ(-82, -56, -66, -42, 0.5); occ(-62, -56, -50, -40, 0.5);
    for (let i = 0; i < 6; i++) K.hayBale(b, -70 + (i % 3) * 1.4, -38 + Math.floor(i / 3) * 1.4);
    K.hayBale(b, -69.3, -37.3, 1.2);
    T.wallStone(b, rng, -83.5, -36, -78, -36, { h: 2.0, ruin: true }); T.wallStone(b, rng, -64.4, -52, -64.4, -44, { h: 2.0, ruin: true });
    T.wallStone(b, rng, -48, -37.5, -40, -37.5, { h: 1.8, ruin: true, t: 0.4 });
    reg(K.house(b, rng, { x: -46, z: -47, w: 7, d: 6, floors: 1, door: 's', wall: V.tint ? '#b9a98a' : '#c9b48a', roof: '#6b4a3a' }), 'tarla-kulube'); occ(-49.5, -50, -42.5, -42.4);   // sundurma dahil
    reg(T.waterTower(b, { x: -24, z: -45, ry: 0 }), 'su-kulesi'); occ(-30, -52, -16, -38);
    K.truck(b, { x: -34, z: -40.5, ry: 0.15, color: V.tint ? '#2c5aa0' : '#4a7a4f', cargo: '#cdd2d8' });
    K.crate(b, -37, -37.8, 1.1); K.crate(b, -35.8, -37.8, 1.0); K.barrel(b, -13.4, -36.6, '#c0392b'); K.barrel(b, -12.5, -36.3, '#c0392b');   // varil bahçe çitinin (z −38) dışında
    // meyve bahçesi
    for (let gx = -14; gx <= -6; gx += 4.2) for (let gz = -56; gz <= -40; gz += 4.4) tree('oak', gx + (rng() - 0.5), gz + (rng() - 0.5), 0.9, 1.2);
    T.fence(b, [[-16, -57], [-16, -38], [-6, -38]]);
    // GB tarla + güney şeridi
    reg(K.watchtower(b, { x: -17, z: 46, ry: Math.PI }), 'gozetleme');
    occ(-23, 40, -11, 50);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) K.tombstone(b, -50 + c * 1.5, 43 + r * 2.2, 0);
    T.fence(b, [[-52, 45], [-52, 41], [-40, 41], [-40, 45]]); T.fence(b, [[-52, 48], [-52, 52], [-40, 52], [-40, 48]]);   // köşe direkleri ortak, batı/doğu kapı açıklığı
    occ(-53, 40, -39, 53, 0.5);
    reg(K.house(b, rng, { x: -33, z: 46, w: 6.5, d: 5.5, floors: 1, door: 'n', wall: '#8b7a5a', roof: '#4d5b3a' }), 'mezarlik-kulube'); occ(-36.5, 41.6, -29.5, 49);
    T.crops(b, rng, -82, 42, -66, 56, { along: 'z', color: '#a8b040' }); occ(-82, 42, -66, 56, 0.5);
    for (let i = 0; i < 5; i++) K.hayBale(b, -62 + (i % 3) * 1.4, 44 + Math.floor(i / 3) * 1.4);
    occ(-64, 42, -58, 48);
    T.wallStone(b, rng, -83.5, 38, -76, 38, { h: 2.0, ruin: true }); T.wallStone(b, rng, -62, 52, -56, 52, { h: 1.8, ruin: true });
    K.truck(b, { x: -8, z: 43, ry: Math.PI / 2 + 0.2, color: '#a8281f', cargo: '#b9bec4' });
    // ağaçlar / çalılar / kayalar
    const zones = [[-83, -57, -62, -22], [-83, 22, -62, 57], [-62, -57, 0, -35], [-62, 36, 0, 57]];
    for (const [a, c, d, e] of zones) {
      const n = Math.floor((d - a) * (e - c) / 60);
      for (let i = 0; i < n * 1.7; i++) {                                    // boş yer denetimi bazı denemeleri eler: deneme sayısı 1,7 kat (sık orman korunur)
        const x = a + rng() * (d - a), z = c + rng() * (e - c);
        if (!free(x, z)) continue;
        const oak = rng() > 0.45, s = 0.9 + rng() * 0.5;
        tree(oak ? 'oak' : 'pine', x, z, s);
      }
      for (let i = 0; i < n; i++) { const x = a + rng() * (d - a), z = c + rng() * (e - c), s = 0.8 + rng() * 0.6; if (free(x, z)) shrub(x, z, s); }
      for (let i = 0; i < n / 4; i++) { const x = a + rng() * (d - a), z = c + rng() * (e - c), s = 0.8 + rng(); if (free(x, z)) stone(x, z, s); }
    }
    // yan sokak kenarı çalıları (yalnız boş yere: eskiden varil / çöp konteyneri / binaların içine de konuyordu)
    for (let i = 0; i < 24; i++) { const x = -60 + rng() * 54, z = (rng() < 0.5 ? -1 : 1) * (24.5 + rng() * 0.8), s = 0.7 + rng() * 0.4; shrub(x, z, s); }
  }

  // ───────── merkez meydan (x<0 ve x>0 simetrik) ─────────
  function center() {
    T.fountain(b, { x: 0, z: 0, r: 3.0 });
    b.cyl(0, 0.06, 0, 5.5, 5.5, 0.02, '#4a4d52', { seg: 20, collide: false });
    for (const [px, pz] of [[-6.2, -6.2], [6.2, -6.2], [-6.2, 6.2], [6.2, 6.2]]) { T.planter(b, px, pz, 1.8, 0.9); }
    for (const [bx, bz, br] of [[-5.2, 0, Math.PI / 2], [5.2, 0, -Math.PI / 2], [0, -5.4, 0], [0, 5.4, Math.PI]]) T.bench(b, bx, bz, br);
    T.billboard(b, { x: 0, z: -52, ry: 0, color: '#2c5aa0' }); T.billboard(b, { x: 0, z: 52, ry: Math.PI, color: '#a8281f' });
  }

  // ───────── sınır çiti + orman (çarpışmasız) + dağlar ─────────
  function surround() {
    const { minX, maxX, minZ, maxZ } = KASABA_BOUNDS;
    T.fence(b, [[minX - 1, minZ - 1], [maxX + 1, minZ - 1], [maxX + 1, maxZ + 1], [minX - 1, maxZ + 1]], { h: 1.6, color: '#7a5a38', closed: true });
    // çevre ormanı: gövde başka ağacın tepesine girmez (≥ büyük tepe + 0,3 m), tepe sınır çitine / avlu duvarına değmez
    const forest = [];
    const ftree = (x, z, s, pine) => {
      const r = (pine ? 1.6 : 2.2) * s, out = Math.max(minX - x, x - maxX, minZ - z, z - maxZ);
      if (out < (Math.abs(z) < 23 ? r + 1.4 : 1.3)) return;                  // avlu duvarı (|z| < 21) yanında tepe duvara değmez; başka yerde tepe çitin üstüne sarkabilir (gövde çitten uzak)
      for (const [a, c, q] of forest) if (Math.hypot(a - x, c - z) < Math.max(q, r) + 0.3) return;
      forest.push([x, z, r]); (pine ? K.pine : K.oak)(b, rng, x, z, s, 0, false);
    };
    for (let ring = 0; ring < 5; ring++) {
      const off = 4 + ring * 6, step = 3.4;
      for (let x = minX - off; x <= maxX + off; x += step) for (const zz of [minZ - off, maxZ + off]) { const pine = rng() > 0.25, px = x + (rng() - 0.5) * 2, pz = zz + (rng() - 0.5) * 2; ftree(px, pz, 1.1 + rng() * 0.9, pine); }
      for (let z = minZ - off + step; z < maxZ + off; z += step) for (const xx of [minX - off, maxX + off]) { const pine = rng() > 0.25, px = xx + (rng() - 0.5) * 2, pz = z + (rng() - 0.5) * 2; ftree(px, pz, 1.1 + rng() * 0.9, pine); }
    }
    const hillCols = ['#6f8a43', '#7a8f48', '#657a3d', '#8a7a52'];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng() * 0.2;
      b.ico(Math.cos(a) * (150 + rng() * 40), -3, Math.sin(a) * (115 + rng() * 40), 28 + rng() * 14, hillCols[i % 4], { detail: 1, scale: [1.6, 0.55, 1.3], collide: false });
    }
    const mtCols = ['#7b786f', '#6e6c66', '#847f74'];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rng() * 0.15;
      const rx = 300 + rng() * 50, rz = 270 + rng() * 50, h = 38 + rng() * 42, base = 70 + rng() * 40;
      b.cyl(Math.cos(a) * rx, 0, Math.sin(a) * rz, 0.1, base, h, mtCols[i % 3], { seg: 7, ry: rng() * 3, collide: false });
      if (h > 62) b.cyl(Math.cos(a) * rx, h * 0.84, Math.sin(a) * rz, 0.1, base * 0.2, h * 0.16, '#e8ecef', { seg: 7, collide: false });
    }
  }

  // ───────── doğuş noktası seçimi: avluda çarpışmasız, dağınık, göz hizası açık ─────────
  function pickSpawns(zone, ry, n, side) {
    const cands = [];
    const x0 = side > 0 ? zone.minX + 2 : zone.maxX - 8, x1 = side > 0 ? zone.maxX - 11 : zone.maxX - 2;
    // blue: avlu doğusu (x -70…-63); red: avlu batısı (x 63…70). Genişletilmiş: tüm avlu x -81…-63 benzeri
    const lo = side > 0 ? -82 : 63, hi = side > 0 ? -63 : 82;
    for (let x = lo; x <= hi; x += 1.5) for (let z = zone.minZ + 1.5; z <= zone.maxZ - 1.5; z += 1.5) {
      let ok = true;
      for (const c of b.colliders) {
        if (c.max[1] < 0.3 || c.min[1] > 1.8) continue;
        if (x > c.min[0] - 0.8 && x < c.max[0] + 0.8 && z > c.min[2] - 0.8 && z < c.max[2] + 0.8) { ok = false; break; }
      }
      if (ok) cands.push({ x, z });
    }
    // doğu/batı bölgesi yakını (kapıya yakın kısım) önde; ayrıca dağılımı ızgara adımıyla seyrelt
    cands.sort((p, q) => (side > 0 ? q.x - p.x : p.x - q.x) + (rng() - 0.5) * 6);
    const out = [];
    for (const c of cands) {
      if (out.length >= n) break;
      if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 2.6)) continue;
      out.push({ x: c.x, z: c.z, ry: ry + (rng() - 0.5) * 0.4 });
    }
    return out;
  }
}
