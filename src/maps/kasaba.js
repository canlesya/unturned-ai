import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { KK, makeKasabaMaterial, attachKasabaLights } from './kasabaSurface.js';
import { Ground, GL } from './assets/kasaba/ground.js';
import { KS, PAL, bstyle } from './assets/kasaba/style.js';
import { place, house, civic, garage, church, gasStation, barn, warehouse, hut } from './assets/kasaba/buildings.js';
import { waterTower, watchtower, kiosk, gazebo, stall, fountain, silo, well } from './assets/kasaba/structures.js';
import * as P from './assets/common/kasaba-props.js';
import * as V from './assets/common/kasaba-vehicles.js';
import * as N from './assets/common/kasaba-nature.js';
import { boxR, NC } from './assets/common/kasaba-shapes.js';

// Harita 1 — KASABA (v3, 12.168: modüler asset kitiyle sıfırdan)
// 168 × 116 m, oynanış yerleşimi v2 ile aynı: Mavi çiftlik avlusu (batı) / Kırmızı depo avlusu (doğu) taş duvarlı, üç çıkış (ana cadde kapısı
// kontrol noktası şikânıyla + kuzey / güney tarla kapıları). Yerleşim 180° dönel simetrik (batı yarı + dönmüş doğu yarı, farklı bina çeşitleri):
// KB 'Evler' ↔ GD 'Pazar', GB 'Kilise' ↔ KD 'Benzinlik', ortada çeşmeli kavşak. Nişancı yerleri: su kuleleri, çan kulesi, çatı çıkışlı düz çatılar, gözetleme kuleleri.
// Bütün yapılar src/maps/assets/ kitinden (bina modülü: duvar / pencere / kapı / kat / çatı; eşya; araç; bitki); zemin katmanları üst üste binmez,
// eşyalar bulunduğu zeminin kotuna oturur, ağaç / çalı hiçbir yapıya değmez. Kural: görsel = çarpışma, iç içe parça yok, eş düzlemli yüz yok.

export const KASABA_BOUNDS = { minX: -84, maxX: 84, minZ: -58, maxZ: 58 };
const BLUE_ZONE = { minX: -83, maxX: -62, minZ: -20, maxZ: 20 };
const RED_ZONE = { minX: 62, maxX: 83, minZ: -20, maxZ: 20 };

const VA = { yard: 'farm', nw1: 'school', nw2: 'houses', nw3: 'townhall', sw2: 'church', sw3: 'park', tint: 0 };
const VB = { yard: 'depot', nw1: 'police', nw2: 'market', nw3: 'bank', sw2: 'gas', sw3: 'parking', tint: 1 };
const C = { asph: '#55575b', asphLot: '#5c5e62', curb: '#b4b0a6', plaza: '#c4bba8', dirt: '#8a6e48', path: '#a08a64', lineY: '#dcad2a', lineW: '#ecece7', grass: '#7f9448' };
const CAR = ['#b33a2a', '#2c5aa0', '#e8e8e4', '#4a7a4f', '#d9a921', '#6a6d73', '#7a3a5a', '#3a6a7a'];

export function buildKasaba() {
  const b = new MapBuilder();
  const rng = makeRng(1337);
  const lamps = [];
  b.surface = { ground: () => 0, kindOf: () => KK.PLAIN, seeded: true, material: () => makeKasabaMaterial(lamps) };
  const G = new Ground();
  const infos = {}, climb = [], callouts = [], occ = [];
  const _v = new THREE.Vector3();
  const W = (x, z) => { _v.set(x, 0, z).applyMatrix4(b.M); return [_v.x, _v.z]; };
  const co = (name, x, z, major = false) => { const [wx, wz] = W(x, z); callouts.push({ name, x: +wx.toFixed(2), z: +wz.toFixed(2), ...(major ? { major: true } : {}) }); };   // bölge adı (dünya)
  const addOcc = (fp) => { if (!fp) return fp; for (const f of [].concat(fp)) if (f && Number.isFinite(f.x0)) occ.push(f); return fp; };
  const reg = (name, info) => {
    if (!info) return info;
    infos[name] = info;
    for (const t of info.targets || []) climb.push({ name: `${name}:${t.name}`, x: t.x, y: t.y, z: t.z, entry: info.entry ? { x: info.entry.x, z: info.entry.z } : null });
    if (info.box) occ.push({ ...info.box, h: info.box.ridge || info.box.H || 6 });
    return info;
  };
  // eşyayı bulunduğu zeminin kotuna koy: fn(gy) (yerel çerçevede); ayak izi tek kotta değilse yerleştirmez
  const WARN = typeof process !== 'undefined' && process.env && process.env.KASABA_WARN;
  const onG = (x, z, hw, hd, fn) => {
    const [a, c] = W(x - hw, z - hd), [e, g] = W(x + hw, z + hd);
    const r = [Math.min(a, e), Math.max(a, e), Math.min(c, g), Math.max(c, g)];
    const gy = G.topOf(...r);
    if (gy === null) { if (WARN) console.warn('kasaba: iki kota / çizgiye oturan eşya atlandı', x.toFixed(1), z.toFixed(1), '→', r.map((v) => v.toFixed(1)).join(',')); return null; }
    if (WARN) for (const f of occ) if (!f.tree && f.x0 < r[1] - 0.02 && f.x1 > r[0] + 0.02 && f.z0 < r[3] - 0.02 && f.z1 > r[2] + 0.02) { console.warn('kasaba: eşya başka yapıya değiyor', x.toFixed(1), z.toFixed(1), '↔', [f.x0, f.x1, f.z0, f.z1].map((v) => v.toFixed(1)).join(',')); break; }
    let fp; b.with(0, gy, 0, 0, () => { fp = fn(); }); return addOcc(fp);
  };
  // bina: ayak izi (+ 0,1 m süs payı) tek zemin kotundaysa o kota oturur (avluda toprak 0,02)
  const placeB = (cx, cz, ry, w, d, fn) => {
    const sw = Math.abs(Math.sin(ry)) > 0.5, hw = (sw ? d : w) / 2 + 0.1, hd = (sw ? w : d) / 2 + 0.1;
    const [a, c] = W(cx - hw, cz - hd), [e, g] = W(cx + hw, cz + hd);
    const gy = G.topOf(Math.min(a, e), Math.max(a, e), Math.min(c, g), Math.max(c, g));
    if (gy === null && WARN) console.warn('kasaba: bina iki zemin kotunda', cx, cz);
    return place(b, cx, cz, ry, fn, gy ?? 0);
  };
  const lampAt = (x, z, ry) => onG(x, z, 0.2, 0.2, () => { const r = P.lampPost(b, KS_S, x, z, ry); lamps.push([...r.head, 12.5]); return r; });
  const KS_S = { k: KS };

  // ───────── zemin: çim levhası + iki yarının zemin katmanları ─────────
  b.obj('zemin:çim', () => b.box(0, -1.0, 0, 900, 1.0, 900, C.grass, { kind: KK.VEG }));
  center(true);
  halfGround(VA);
  b.with(0, 0, 0, Math.PI, () => halfGround(VB));
  G.resolve();
  G.draw(b);                                                                // çizgiler eşyalardan sonra (drawMarks)

  // ───────── yapılar ─────────
  center(false);
  half(VA, false);
  b.with(0, 0, 0, Math.PI, () => half(VB, true));
  surround();
  G.drawMarks(b, occ);
  vegetation(VA);                                                           // bitki en son: iki yarının bütün yapıları / eşyaları belli
  b.with(0, 0, 0, Math.PI, () => vegetation(VB));
  forest();

  // ───────── doğuş, hedefler ─────────
  const spawns = { blue: pickSpawns(-1), red: pickSpawns(1) };
  const objectives = [
    { id: 'evler', core: true, name: 'Evler', x: -35.5, z: -12, r: 9 },
    { id: 'kilise', name: 'Kilise', x: -36, z: 19, r: 9 },
    { id: 'kavsak', core: true, name: 'Kavşak', x: 0, z: 0, r: 9 },
    { id: 'benzinlik', name: 'Benzinlik', x: 33, z: -17, r: 9 },
    { id: 'pazar', core: true, name: 'Pazar', x: 35.5, z: 12, r: 9 },
  ];

  const group = b.build();
  for (const m of group.children) if (m.material && m.material.userData && m.material.userData.lamps) attachKasabaLights(m);
  return {
    id: 'kasaba', name: 'Kasaba', group, colliders: b.colliders, sight: b.sight, bounds: KASABA_BOUNDS,
    baseZones: { blue: { ...BLUE_ZONE }, red: { ...RED_ZONE } },
    roads: G.roads, spawns, objectives, climb, infos, callouts,
  };

  // ═════════ yarım harita: ZEMİN (x < 0 çerçevesi) ═════════
  function halfGround(V) {
    const A = (x0, x1, z0, z1, mini = true) => G.add(b, 'asph', x0, x1, z0, z1, C.asph, KK.ASPH, { mini });
    const K = (x0, x1, z0, z1) => G.add(b, 'curb', x0, x1, z0, z1, C.curb, KK.PAVER);
    const D = (x0, x1, z0, z1, layer = 'dirt') => G.add(b, layer, x0, x1, z0, z1, layer === 'path' ? C.path : C.dirt, KK.DIRT);
    // yollar (asfalt): ana cadde, orta cadde (yarım), kuzey / güney sokak, yan sokaklar
    A(-61.5, -4, -5, 5); A(-4, 0, -58, 58);
    A(-77, -4, -34, -26); A(-77, -4, 26, 34);
    A(-49, -45, -26, -5); A(-26, -22, -26, -5); A(-49, -45, 5, 26); A(-26, -22, 5, 26);
    // kaldırımlar
    K(-61, -6, 5, 7); K(-61, -6, -7, -5);
    for (const [za, zb] of [[-58, -34], [-26, -7], [7, 26], [34, 58]]) K(-6, -4, za, zb);
    // avlu (toprak) + kapı geçidi + tarla çıkışları; tarla patikaları
    D(-83.5, -62, -20, 20); D(-62, -61.5, -3, 3);
    D(-74, -70, -34, -20.5); D(-74, -70, 20.5, 34); D(-74, -70, -20.5, -20, 'dirt'); D(-74, -70, 20, 20.5, 'dirt');
    if (V.sw3 === 'parking') { A(-21.5, -9.5, 9.0, 25.5, false); for (let i = 0; i < 4; i++) for (const zz of [9.5, 21.5]) G.mark(b, -21.0 + i * 3.6, -20.88 + i * 3.6, zz, zz + 3.5, C.lineW, KK.PAINT); }
    if (V.sw3 === 'park') { G.hole(b, -16.7, -11.3, 14.3, 19.7); D(-21, -7, 16.5, 17.5, 'path'); D(-14.5, -13.5, 8, 16.5, 'path'); D(-14.5, -13.5, 17.5, 26, 'path'); }
    if (V.sw2 === 'gas') { G.hole(b, -37.6, -28.4, 13.4, 24.6); A(-38.3, -26.5, 8.5, 25.5, false); }
    // kontrol noktası duvarları kaldırımı keser; avlu duvarı sütunları zemine (toprak / asfalt) girmez
    G.hole(b, -54.25, -53.75, -9.6, -5.0); G.hole(b, -44.65, -44.15, 5.0, 9.6);
    for (const zc of [-20.25, 20.25]) for (const [a, c] of [[-84, -83.3], [-62.2, -61.5], [-74.7, -74], [-70, -69.3]]) G.hole(b, a, c, zc - 0.35, zc + 0.35);
    for (const [a, c] of [[-3.7, -3.0], [3.0, 3.7]]) G.hole(b, -62.1, -61.4, a, c);
    // bina ön yolları (kapıdan kaldırıma) — bina listesiyle aynı yerler
    // yol çizgileri: orta şerit kesikleri (kavşak / yan sokak ağızlarında kesilir), yaya geçitleri
    for (let x = -60; x <= -14; x += 4) if (!(x > -50.5 && x < -43.5) && !(x > -27.5 && x < -20.5)) G.mark(b, x, x + 2, -0.1, 0.1, C.lineY, KK.PAINT);
    for (let z = -50; z <= -10; z += 4) if (!(z > -35.5 && z < -24.5)) G.mark(b, -2.1, -1.9, z, z + 2, C.lineY, KK.PAINT);
    for (let z = 8; z <= 48; z += 4) if (!(z > 24.5 && z < 35.5)) G.mark(b, -2.1, -1.9, z, z + 2, C.lineY, KK.PAINT);
    for (let x = -74; x <= -9; x += 4) if (!(x > -50.5 && x < -43.5) && !(x > -27.5 && x < -20.5)) { G.mark(b, x, x + 2, -30.1, -29.9, C.lineY, KK.PAINT); G.mark(b, x, x + 2, 29.9, 30.1, C.lineY, KK.PAINT); }
    for (let k = 0; k < 8; k++) G.mark(b, -9.0, -7.0, -4.3 + k * 1.1, -3.7 + k * 1.1, C.lineW, KK.PAINT);      // kavşak öncesi yaya geçidi
    for (const s of [-4.6, 4.4]) for (const [a, c] of [[-60, -49.5], [-44.5, -26.5], [-21.5, -9.5]]) G.mark(b, a, c, s, s + 0.2, C.lineW, KK.PAINT);   // kenar çizgisi (yan sokak ağızlarında kesik)
  }

  // ═════════ merkez (kavşak) ═════════
  function center(groundPass) {
    if (groundPass) { G.add(b, 'plaza', -3.5, 3.5, -3.5, 3.5, C.plaza, KK.PAVER); return; }
    addOcc(fountain(b));
    co('Kavşak', 0, 0, true);
    for (const [x, z] of [[-5.0, -6.0], [5.0, 6.0]]) addOcc(onG(x, z, 0.2, 0.2, () => P.trashCan(b, KS_S, x, z)));
    addOcc(onG(0, -53, 2.5, 0.3, () => P.billboard(b, KS_S, 0, -53, 0, '#2c5aa0')));
    addOcc(onG(0, 53, 2.5, 0.3, () => P.billboard(b, KS_S, 0, 53, Math.PI, '#a8281f')));
  }

  // ═════════ yarım harita: YAPILAR ═════════
  function half(V, east) {
    yard(V);
    chicane();
    streetProps(V);
    nw(V);
    sw(V);
    lamps1(V);
    fields(V);
  }

  // ───────── avlu (doğuş): taş duvarlar, 3 çıkış ─────────
  function yard(V) {
    const depot = V.yard === 'depot';
    const wc = depot ? '#8a8d90' : '#a39a82', cap = depot ? '#6a6d72' : '#847b64';
    const Wo = { h: 2.9, t: 0.5, col: wc, cap, endCols: true };
    // kuzey / güney duvarı x [−84, −61.5] (köşe sütunları dahil), batı / doğu duvarları aralarında
    addOcc(P.stoneWall(b, KS_S, 'x', -84, -61.5, -20.25, { ...Wo, gaps: [[-74, -70]] }));
    addOcc(P.stoneWall(b, KS_S, 'x', -84, -61.5, 20.25, { ...Wo, gaps: [[-74, -70]] }));
    addOcc(P.stoneWall(b, KS_S, 'z', -19.9, 19.9, -83.75, { ...Wo, endCols: false }));                 // uçları köşe sütunlarının yüzünde
    addOcc(P.stoneWall(b, KS_S, 'z', -19.9, 19.9, -61.75, { ...Wo, endCols: false, gapCols: true, gaps: [[-3, 3]] }));
    co(depot ? 'Kırmızı Depo' : 'Mavi Çiftlik', -73, 0, true);
    // kapı sancakları: kapı sütunlarının tepesinde direk + bayrak
    const flag = depot ? '#d63a2b' : '#2b6fd6', PT = 2.9 + 0.25 + 0.1;
    for (const fz of [-3.35, 3.35]) b.obj('sancak', () => { boxR(b, -61.83, -61.67, PT, PT + 2.0, fz - 0.08, fz + 0.08, '#4a4d52', KK.PLAIN); boxR(b, -63.0, -61.83, PT + 1.1, PT + 1.9, fz - 0.03, fz + 0.03, flag, KK.PAINT); });
    if (!depot) {
      reg('ciftlik-ambar', placeB(-75, -12.5, Math.PI / 2, 10, 14, () => barn(b, rng, 'ciftlik-ambar', { style: bstyle(rng, { wall: '#8a3a2c', roof: '#7d848c' }) })));
      reg('ciftlik-ev', placeB(-75, 12.5, Math.PI, 10, 8, () => house(b, rng, 'ciftlik-ev', { w: 10, d: 8, floors: 2, doorU: 4.25, style: bstyle(rng, { wall: PAL.cream, roof: PAL.tile[0], shutter: PAL.shutter[0] }) })));
      for (const zf of [-17.65, -7.35]) addOcc(onG(-82.8, zf, 0.7, 0.1, () => P.fence(b, KS_S, [[-83.38, zf], [-82.2, zf]], { h: 1.2, step: 1.2 })));   // ambar ile avlu duvarı arası dar geçit (çıkmaz) kapalı
      addOcc(onG(-80.0, 1.0, 2.2, 2.2, () => silo(b, -80.0, 1.0, 2.0, 10)));
      addOcc(onG(-70, -3.5, 1.0, 1.0, () => well(b, -70, -3.5)));
      for (const [x, z, y] of [[-76.6, 4.6, 0.02], [-75.4, 4.6, 0.02], [-76.0, 4.6, 0.62], [-76.6, 5.5, 0.02]]) addOcc(P.hayBale(b, KS_S, x, z, y, 0));
      addOcc(onG(-66.5, 14.5, 1.3, 4.2, () => V_.truck(b, KS_S, -66.5, 14.5, Math.PI / 2, '#2c5aa0', '#cdd2d8', { open: true })));
      addOcc(onG(-66.5, -10.5, 0.3, 2.2, () => P.sandbags(b, KS_S, -66.5, -10.5, 4.2, Math.PI / 2)));
      addOcc(onG(-66.5, 8.0, 0.3, 1.9, () => P.sandbags(b, KS_S, -66.5, 8.0, 3.6, Math.PI / 2)));
      addOcc(onG(-64.0, -14.5, 0.6, 1.2, () => P.crateStack(b, KS_S, -64.0, -14.5, [[0, -0.58, 1.1, 0], [0, 0.58, 1.1, 0], [0, 0, 0.9, 1.1]])));
      for (const [x, z, c] of [[-64, 17.5, '#2c5aa0'], [-64.7, 18.1, '#2c5aa0'], [-64.2, -17.8, '#c0392b']]) addOcc(onG(x, z, 0.32, 0.32, () => P.barrel(b, KS_S, x, z, c)));
      addOcc(onG(-81.6, 18.3, 1.2, 0.6, () => P.dumpster(b, KS_S, -81.6, 18.3, 0)));
      addOcc(onG(-70.5, 5.25, 2.6, 2.8, () => P.fence(b, KS_S, [[-73, 8], [-73, 2.5], [-68, 2.5]])));
      addOcc(onG(-70.5, -1.0, 1.6, 0.85, () => V_.tractor(b, KS_S, -70.5, -1.0, 0)));
      co('Ambar', -75, -12.5); co('Çiftlik Evi', -75, 12.5);
    } else {
      reg('depo-ic', placeB(-75, -11, Math.PI / 2, 14, 12, () => warehouse(b, rng, 'depo-ic', { w: 14, d: 12, style: bstyle(rng, {}) })));
      reg('depo-ofis', placeB(-75.5, 14, Math.PI, 9, 6, () => civic(b, rng, 'depo-ofis', { w: 9, d: 6, floors: 1, theme: 'office', access: false, style: bstyle(rng, { wall: PAL.grey, roof: PAL.zinc }) })));
      addOcc(onG(-79, 5.0, 3.1, 1.25, () => [P.container(b, KS_S, -79, 5.0, 0, '#c0392b'), P.container(b, KS_S, -79, 5.0, 0, '#d9a921', 2.63)]));
      addOcc(onG(-70.5, 5.0, 3.1, 1.25, () => P.container(b, KS_S, -70.5, 5.0, 0, '#3b6a9a')));
      addOcc(onG(-64.6, -12.6, 1.25, 3.1, () => P.container(b, KS_S, -64.6, -12.6, Math.PI / 2, '#4a7a4f')));
      addOcc(onG(-66.5, 15.0, 1.3, 4.2, () => V_.truck(b, KS_S, -66.5, 15.0, Math.PI / 2, '#a8281f', '#b9bec4')));
      addOcc(onG(-66.5, -6.5, 0.3, 2.1, () => P.sandbags(b, KS_S, -66.5, -6.5, 4.0, Math.PI / 2)));
      addOcc(onG(-66.5, 7.5, 0.3, 1.8, () => P.sandbags(b, KS_S, -66.5, 7.5, 3.4, Math.PI / 2)));
      addOcc(onG(-71.5, -2.0, 1.2, 0.6, () => P.crateStack(b, KS_S, -71.5, -2.0, [[-0.58, 0, 1.1, 0], [0.58, 0, 1.1, 0], [0, 0, 0.9, 1.1]])));
      for (const [x, z, c] of [[-64, -17, '#c0392b'], [-64.7, -17.5, '#d9a921'], [-63.6, -16.3, '#c0392b']]) addOcc(onG(x, z, 0.32, 0.32, () => P.barrel(b, KS_S, x, z, c)));
      addOcc(onG(-67.0, -17.6, 1.0, 0.3, () => P.barrier(b, KS_S, -67.0, -17.6, 0)));
      addOcc(onG(-69.0, 17.6, 1.0, 0.3, () => P.barrier(b, KS_S, -69.0, 17.6, 0)));
      for (const [x, z] of [[-77.5, -1.5], [-76.2, -1.5]]) addOcc(onG(x, z, 0.6, 0.5, () => P.pallet(b, KS_S, x, z)));
      co('Depo', -75, -11); co('Ofis', -75.5, 14);
    }
  }

  // ───────── ana cadde kontrol noktası (S-şikân, görüşü keser) ─────────
  function chicane() {
    addOcc(onG(-54, -1.85, 1.25, 3.1, () => P.container(b, KS_S, -54, -1.85, Math.PI / 2, '#3b6a9a')));
    addOcc(onG(-46, 1.85, 1.25, 3.1, () => P.container(b, KS_S, -46, 1.85, Math.PI / 2, '#d9a921')));
    addOcc(onG(-58.5, 3.2, 0.3, 1.0, () => P.barrier(b, KS_S, -58.5, 3.2, Math.PI / 2)));
    addOcc(onG(-50, -3.8, 1.0, 0.3, () => P.barrier(b, KS_S, -50, -3.8, 0)));
    addOcc(onG(-57, -3.4, 1.5, 0.3, () => P.sandbags(b, KS_S, -57, -3.4, 3.0, 0)));
    // kaldırımı kesen taş duvarlar (kaldırım bu aralıkta yok: duvar çimde başlar, caddeye kadar)
    addOcc(P.stoneWall(b, KS_S, 'z', -9.6, -5.0, -54, { h: 2.4, t: 0.5, col: '#9a968c', cap: '#7a776f' }));      // kaldırımı keser (zeminde boşluk: halfGround)
    addOcc(P.stoneWall(b, KS_S, 'z', 5.0, 9.6, -44.4, { h: 2.4, t: 0.5, col: '#9a968c', cap: '#7a776f' }));
    addOcc(onG(-60.2, 6.0, 0.5, 0.2, () => P.signPost(b, KS_S, -60.2, 6.0, Math.PI, '#c0392b')));
    co('Kontrol Noktası', -50, 0);
  }

  // ───────── cadde siperleri ─────────
  function streetProps(V) {
    const car = (x, z, ry, ci, wreck = false, hatch = false) => onG(x, z, ry % Math.PI ? 1.0 : 2.3, ry % Math.PI ? 2.3 : 1.0, () => V2.car(b, KS_S, x, z, ry, CAR[ci % CAR.length], { wreck, hatch }));
    const V2 = V_;
    // ana cadde (z −5…5)
    car(-39, 2.8, 0, V.tint ? 2 : 3, true); addOcc(onG(-33.5, -2.4, 1.0, 0.3, () => P.barrier(b, KS_S, -33.5, -2.4, 0)));
    car(-27, 2.2, Math.PI, 0); addOcc(onG(-14.0, -2.4, 1.6, 0.3, () => P.sandbags(b, KS_S, -14.0, -2.4, 3.0, 0)));
    car(-14.5, 3.0, 0, 5, true, true); addOcc(onG(-10, 1.8, 0.3, 1.0, () => P.barrier(b, KS_S, -10, 1.8, Math.PI / 2)));
    addOcc(onG(-24, -2.6, 5.1, 1.3, () => V_.bus(b, KS_S, -24, -2.6, 0, V.tint ? '#3b6a9a' : '#d9a921', { wreck: true })));
    // orta cadde (x −4…0): kuzey bölüm
    car(-1.9, -12, Math.PI / 2, 1); addOcc(onG(-1.5, -18, 0.3, 1.0, () => P.barrier(b, KS_S, -1.5, -18, Math.PI / 2)));
    car(-2.0, -24, Math.PI / 2, 4, true); addOcc(onG(-1.8, -31, 0.3, 1.6, () => P.sandbags(b, KS_S, -1.8, -31, 3.0, Math.PI / 2)));
    car(-2.0, -40, Math.PI / 2, 2, true, true); addOcc(onG(-1.5, -47, 0.3, 1.0, () => P.barrier(b, KS_S, -1.5, -47, Math.PI / 2)));
    // kuzey sokak (z −34…−26)
    for (const [x, z, ry, ci, w, hb] of [[-70, -29.0, 0, 0, 1, 0], [-61, -31.5, Math.PI, 2, 0, 1], [-53, -28.6, 0, 4, 1, 0], [-36, -29.0, 0, 5, 1, 1], [-29.5, -31.4, Math.PI, 3, 0, 0], [-12, -31.5, 0, 0, 0, 1]]) car(x, z, ry, ci, !!w, !!hb);
    addOcc(onG(-57, -29.6, 1.0, 0.3, () => P.barrier(b, KS_S, -57, -29.6, 0))); addOcc(onG(-42.5, -28.4, 1.6, 0.3, () => P.sandbags(b, KS_S, -42.5, -28.4, 3.2, 0)));
    addOcc(onG(-19, -29.8, 1.5, 0.3, () => P.sandbags(b, KS_S, -19, -29.8, 3.0, 0))); addOcc(onG(-7.5, -28.6, 1.0, 0.3, () => P.barrier(b, KS_S, -7.5, -28.6, 0)));
    // güney sokak (z 26…34)
    for (const [x, z, ry, ci, w, hb] of [[-71, 31, 0, 3, 1, 0], [-62, 28.6, 0, 1, 0, 1], [-54, 31.4, Math.PI, 5, 1, 0], [-38.5, 31.5, 0, 0, 1, 1], [-30, 28.8, 0, 4, 0, 0], [-13, 28.8, 0, 6, 1, 0]]) car(x, z, ry, ci, !!w, !!hb);
    addOcc(onG(-58, 31, 1.0, 0.3, () => P.barrier(b, KS_S, -58, 31, 0))); addOcc(onG(-43, 29.4, 1.6, 0.3, () => P.sandbags(b, KS_S, -43, 29.4, 3.2, 0)));
    addOcc(onG(-21, 31.2, 1.5, 0.3, () => P.sandbags(b, KS_S, -21, 31.2, 3.0, 0))); addOcc(onG(-7.5, 29, 1.0, 0.3, () => P.barrier(b, KS_S, -7.5, 29, 0)));
    // kaldırım kenarı park araçları (cadde kenarındaki uzun görüş şeritlerini keser)
    for (const [x, z, ry, ci, w] of [[-38, -3.9, 0, 3, 0], [-16.5, -3.9, 0, 5, 1], [-33, 3.9, Math.PI, 2, 0], [-55.0, 3.9, Math.PI, 4, 1]]) car(x, z, ry, ci, !!w);
    // sokak kenarı çitleri (çimde): kuzey sokak kuzeyi / güney sokak güneyi
    for (let x = -70; x < -8; x += 11) { addOcc(P.hedge(b, KS_S, x, -35.0, x + 4.5, -35.0, { h: 1.9, t: 0.8 })); addOcc(P.hedge(b, KS_S, x + 5.5, 35.0, Math.min(x + 10, -6.3), 35.0, { h: 1.9, t: 0.8 })); }
  }

  // ───────── kuzeybatı bölgesi (z < 0) ─────────
  function nw(V) {
    // B1: okul / karakol
    if (V.nw1 === 'school') {
      reg('okul', place(b, -55, -17, 0, () => civic(b, rng, 'okul', { w: 11, d: 9, floors: 2, theme: 'school', style: bstyle(rng, { wall: PAL.brick, brick: true, roof: PAL.slate, trim: PAL.stoneTrim }) })));
      addOcc(P.hedge(b, KS_S, -60.5, -9.6, -56.75, -9.6, { h: 1.1, t: 0.6 })); addOcc(P.hedge(b, KS_S, -53.25, -9.6, -49.5, -9.6, { h: 1.1, t: 0.6 }));
      addOcc(onG(-51.5, -8.2, 0.95, 0.3, () => P.bench(b, KS_S, -51.5, -8.2, Math.PI)));
      co('Okul', -55, -17);
    } else {
      reg('karakol', place(b, -55.5, -17, 0, () => civic(b, rng, 'karakol', { w: 10, d: 9, floors: 2, theme: 'police', style: bstyle(rng, { wall: '#9aa8b6', roof: PAL.slate, trim: '#e8e8e4' }), signs: [{ f: 's', u0: 6.4, u1: 9.4, y0: 2.55, y1: 2.95, color: '#2b4f8a', text: '#e8e8e4' }] })));
      addOcc(onG(-58.6, -9.6, 1.6, 0.3, () => P.sandbags(b, KS_S, -58.6, -9.6, 3.0, 0)));
      addOcc(onG(-52.2, -9.6, 1.3, 0.3, () => P.sandbags(b, KS_S, -52.2, -9.6, 2.4, 0)));
      co('Karakol', -55.5, -17);
    }
    // avlu duvarı ile B1 binası arasındaki 1 m'lik çıkmaz geçit iki ucundan çitle kapalı (botlar sıkışmasın)
    for (const zf of [-21.2, -12.8]) addOcc(P.hedge(b, KS_S, -61.42, zf, -60.62, zf, { h: 1.4, t: 0.6 }));      // geçidin içinde, bina ön / arka yüzüyle aynı hizada (çıkıntı yok)
    // B2: evler / pazar hali
    if (V.nw2 === 'houses') {
      reg('ev-1', place(b, -39.5, -17.5, 0, () => house(b, rng, 'ev-1', { w: 10, d: 9, floors: 2, doorU: 1.75, balcony: true, party: 'e', style: bstyle(rng, { wall: PAL.sand, roof: PAL.tile[2], shutter: PAL.shutter[1] }) })));
      reg('ev-2', place(b, -30.5, -16.5, 0, () => house(b, rng, 'ev-2', { w: 8, d: 8, floors: 3, doorU: 1.25, party: 'w', style: bstyle(rng, { wall: PAL.sage, roof: PAL.slate, shutter: PAL.shutter[2] }) })));
      addOcc(P.hedge(b, KS_S, -44.5, -9.8, -43.6, -9.8, { h: 1.1, t: 0.6 })); addOcc(P.hedge(b, KS_S, -40.9, -9.8, -34.1, -9.8, { h: 1.1, t: 0.6 })); addOcc(P.hedge(b, KS_S, -31.4, -9.8, -26.5, -9.8, { h: 1.1, t: 0.6 }));
      addOcc(P.fence(b, KS_S, [[-44.5, -25.0], [-26.5, -25.0]]));
      addOcc(onG(-37.5, -11.15, 2.3, 1.0, () => V_.car(b, KS_S, -37.5, -11.15, 0, '#2c5aa0', {})));
      addOcc(onG(-27.5, -23.5, 0.55, 0.55, () => P.crate(b, KS_S, -27.5, -23.5, 1.0)));
      addOcc(onG(-43.2, -11.2, 0.8, 0.4, () => P.planter(b, KS_S, -43.2, -11.2, 1.6, 0.8)));
      co('Evler', -35.5, -12, true);
    } else {
      reg('pazar-hali', place(b, -35.5, -17, 0, () => civic(b, rng, 'pazar-hali', { w: 16, d: 11, floors: 2, theme: 'market', shopFront: true, style: bstyle(rng, { wall: PAL.ochre, roof: PAL.tile[1], trim: PAL.trim, awning: '#2c7a4a' }), signs: [{ f: 's', u0: 2.0, u1: 14.0, y0: 6.65, y1: 7.0, color: '#2c7a4a', text: '#f2efe8' }] })));
      for (const [x, c] of [[-41.0, '#c0392b'], [-35.5, '#2c7a4a'], [-30.0, '#d9a921']]) addOcc(onG(x, -9.0, 1.4, 0.8, () => stall(b, rng, x, -9.0, 0, c)));
      addOcc(onG(-37.5, -24.3, 4.2, 1.25, () => V_.truck(b, KS_S, -37.5, -24.3, 0, '#e8e8e4', '#c8ccd0')));
      addOcc(onG(-28.0, -24.3, 1.2, 0.6, () => P.crateStack(b, KS_S, -28.0, -24.3, [[-0.58, 0, 1.1, 0], [0.58, 0, 1.0, 0]])));
      co('Pazar', -35.5, -12, true);
    }
    // B3: belediye / banka
    if (V.nw3 === 'townhall') {
      reg('belediye', place(b, -14, -17.5, 0, () => civic(b, rng, 'belediye', { w: 15, d: 10, floors: 2, theme: 'townhall', canopy: false, style: bstyle(rng, { wall: PAL.white, roof: PAL.zinc, trim: PAL.stoneTrim }), signs: [{ f: 's', u0: 5.5, u1: 9.5, y0: 6.5, y1: 6.95, color: '#8a6a3a', text: '#f2efe8' }] })));
      // revak: basamak (kaldırım kotu) + 4 sütun + saçak; cepheden 0,1 m önde (pervazlara değmez)
      b.obj('belediye:revak', () => {
        boxR(b, -19.0, -9.0, 0, 0.15, -12.4, -10.2, '#d8d4c8', KK.STONE);
        for (const sx of [-17.8, -15.2, -12.8, -10.2]) P0post(sx, 0.15, -10.6, 0.22, 3.45);
        boxR(b, -19.0, -9.0, 3.6, 3.9, -12.4, -10.2, '#e8e4d8', KK.CONC);
      });
      addOcc(P.footW(b, -19.0, -9.0, -12.4, -10.2, 3.9));
      b.obj('bayrak', () => { boxR(b, -7.6, -7.48, 0, 6.0, -10.0, -9.88, '#4a4d52', KK.PLAIN); boxR(b, -7.48, -6.3, 5.0, 5.75, -9.97, -9.91, '#d63a2b', KK.PAINT, NC); });
      co('Belediye', -14, -17.5);
    } else {
      reg('banka', place(b, -14, -17.5, 0, () => civic(b, rng, 'banka', { w: 13, d: 9, floors: 3, theme: 'bank', style: bstyle(rng, { wall: PAL.sky, roof: PAL.slate, trim: PAL.trim }), signs: [{ f: 's', u0: 3.5, u1: 9.5, y0: 9.4, y1: 9.95, color: '#1f3a5a', text: '#e8d8a0' }] })));
      addOcc(onG(-19, -11.2, 1.4, 0.3, () => P.sandbags(b, KS_S, -19, -11.2, 2.6, 0)));
      addOcc(onG(-9, -10.4, 2.3, 1.0, () => V_.car(b, KS_S, -9, -10.4, 0, '#6a6d73', { wreck: true })));
      co('Banka', -14, -17.5);
    }
    // yan sokak engelleri
    addOcc(onG(-47, -22, 0.6, 1.2, () => P.dumpster(b, KS_S, -47, -22, Math.PI / 2)));
    addOcc(onG(-47.0, -14, 1.0, 2.3, () => V_.car(b, KS_S, -47.0, -14, Math.PI / 2, CAR[2], { wreck: true })));
    addOcc(onG(-24, -9.5, 1.0, 2.3, () => V_.car(b, KS_S, -24, -9.5, Math.PI / 2, CAR[3], {})));
    for (const [x, z] of [[-24.8, -23], [-23.9, -23.4]]) addOcc(onG(x, z, 0.32, 0.32, () => P.barrel(b, KS_S, x, z, '#c0392b')));
  }

  // ───────── güneybatı bölgesi (z > 0) ─────────
  function sw(V) {
    // B1: garaj (kapılar caddeye bakar)
    reg('garaj', place(b, -55, 16.5, Math.PI, () => garage(b, rng, 'garaj', { w: 11, d: 9, access: false, style: bstyle(rng, { wall: V.tint ? '#a9b4a0' : '#b8b2a4', roof: PAL.zinc }) })));
    for (const zf of [12.3, 20.7]) addOcc(P.hedge(b, KS_S, -61.42, zf, -60.62, zf, { h: 1.4, t: 0.6 }));
    addOcc(onG(-59.0, 9.6, 2.3, 1.0, () => V_.car(b, KS_S, -59.0, 9.6, 0, CAR[V.tint ? 1 : 0], { wreck: true })));
    addOcc(onG(-52.0, 9.6, 2.7, 1.0, () => V_.van(b, KS_S, -52.0, 9.6, 0, CAR[4], {})));
    addOcc(onG(-60.5, 23.8, 1.2, 0.6, () => P.crateStack(b, KS_S, -60.5, 23.8, [[-0.58, 0, 1.1, 0], [0.58, 0, 1.0, 0]])));
    for (const [x, z] of [[-50.2, 24.2], [-50.0, 23.3]]) addOcc(onG(x, z, 0.32, 0.32, () => P.barrel(b, KS_S, x, z, '#4a6a8a')));
    addOcc(onG(-57.5, 24.0, 0.4, 0.4, () => P.tires(b, KS_S, -57.5, 24.0, 3)));
    co('Garaj', -55, 16.5);
    // B2: kilise / benzinlik
    if (V.sw2 === 'church') {
      const ci = reg('kilise', place(b, -36, 13.5, 0, () => church(b, rng, 'kilise', { style: bstyle(rng, { wall: '#ddd3bc', roof: PAL.tile[3], trim: PAL.stoneTrim }), towerStyle: bstyle(rng, { wall: PAL.stone, roof: PAL.slate, trim: PAL.stoneTrim, stoneBase: false }) })));
      void ci;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) addOcc(P.tombstone(b, KS_S, -30.5 + c * 1.5, 15.2 + r * 3.0, 0, rng));
      addOcc(P.fence(b, KS_S, [[-26.6, 13.0], [-26.6, 16.5]])); addOcc(P.fence(b, KS_S, [[-26.6, 19.5], [-26.6, 24.5]]));
      addOcc(P.hedge(b, KS_S, -44.5, 25.4, -42.0, 25.4, { h: 1.2, t: 0.6 }));
      addOcc(onG(-43.0, 20.0, 0.25, 0.95, () => P.bench(b, KS_S, -43.0, 20.0, Math.PI / 2)));
      co('Kilise', -36, 19, true); co('Çan Kulesi', -36, 11); co('Mezarlık', -28.5, 18);
    } else {
      reg('benzinlik', place(b, -33, 19, Math.PI / 2, () => gasStation(b, rng, 'benzinlik', { style: bstyle(rng, { wall: '#e8e4d8', roof: PAL.zinc, trim: '#c0392b' }) })));
      for (const lz of [16.0, 22.0]) { const [wx, wz] = W(-33, lz); lamps.push([wx, 4.1, wz, 10, '#fff1d0', 2.0]); }
      addOcc(onG(-27.6, 24.0, 0.6, 1.2, () => P.dumpster(b, KS_S, -27.6, 24.0, Math.PI / 2)));
      for (const [x, z] of [[-43.0, 10.2], [-42.2, 10.5]]) addOcc(onG(x, z, 0.32, 0.32, () => P.barrel(b, KS_S, x, z, '#2c5aa0')));
      addOcc(onG(-33.0, 10.6, 2.3, 1.0, () => V_.car(b, KS_S, -33.0, 10.6, 0, '#d9a921', {})));
      co('Benzinlik', -33, 19, true); co('Market', -41.5, 20.5);
    }
    // B3: park / otopark
    if (V.sw3 === 'park') {
      addOcc(place(b, -14, 17, 0, () => ({ fp: gazebo(b, 'park') })).fp);
      addOcc(P.hedge(b, KS_S, -21.5, 10.0, -15.0, 10.0, { h: 1.2, t: 0.6 })); addOcc(P.hedge(b, KS_S, -21.5, 24.5, -15.0, 24.5, { h: 1.2, t: 0.6 }));
      addOcc(P.hedge(b, KS_S, -21.5, 18.5, -21.5, 23.5, { h: 1.2, t: 0.6 })); addOcc(P.hedge(b, KS_S, -7.0, 18.5, -7.0, 23.0, { h: 1.2, t: 0.6 }));
      reg('bufe', place(b, -9.0, 11.0, Math.PI, () => kiosk(b, rng, 'bufe', '#4a8a6a')));
      for (const [x, z, ry] of [[-18.0, 13.2, 0], [-10.5, 21.6, Math.PI], [-19.6, 21.0, Math.PI / 2]]) addOcc(onG(x, z, 1.0, 1.0, () => P.bench(b, KS_S, x, z, ry)));
      addOcc(onG(-17.5, 9.2, 0.8, 0.4, () => P.planter(b, KS_S, -17.5, 9.2, 1.6, 0.8)));
      addOcc(onG(-12.5, 12.8, 0.3, 0.3, () => P.trashCan(b, KS_S, -12.5, 12.8)));
      co('Park', -14, 17, true);
    } else {
      for (const [x, z, ry, ci, w] of [[-19.2, 11.4, Math.PI / 2, 0, 0], [-15.6, 11.4, Math.PI / 2, 1, 0], [-12.0, 11.4, Math.PI / 2, 2, 1], [-19.2, 23.2, Math.PI / 2, 4, 1], [-12.0, 23.2, Math.PI / 2, 5, 0]]) addOcc(onG(x, z, 1.0, 2.3, () => V_.car(b, KS_S, x, z, ry, CAR[ci], { wreck: !!w })));
      addOcc(onG(-15.5, 17.0, 5.1, 1.3, () => V_.bus(b, KS_S, -15.5, 17.0, 0, '#2c7a4a', {})));
      reg('bufe', place(b, -7.8, 17.2, -Math.PI / 2, () => kiosk(b, rng, 'bufe', '#9a6a3a')));
      co('Otopark', -14, 17, true);
    }
    addOcc(onG(-47, 23.5, 0.6, 1.2, () => P.dumpster(b, KS_S, -47, 23.5, Math.PI / 2)));
    addOcc(onG(-47.0, 14.0, 1.0, 2.3, () => V_.car(b, KS_S, -47.0, 14.0, Math.PI / 2, CAR[0], { wreck: true })));
  }

  // ───────── tarlalar, kuleler ─────────
  function fields(V) {
    addOcc(N.crops(b, KS_S, rng, -82, -56, -66, -42, { along: 'x' })); addOcc(N.crops(b, KS_S, rng, -62, -56, -50, -40, { along: 'z' }));
    for (const [x, z, y] of [[-70, -38, 0], [-68.6, -38, 0], [-67.2, -38, 0], [-69.3, -38, 0.6], [-70, -36.9, 0], [-68.6, -36.9, 0]]) addOcc(P.hayBale(b, KS_S, x, z, y, 0));
    addOcc(P.stoneWall(b, KS_S, 'x', -83.5, -78, -36.5, { h: 2.0, t: 0.5, ruin: true, rng }));
    addOcc(P.stoneWall(b, KS_S, 'z', -52, -44, -64.4, { h: 2.0, t: 0.5, ruin: true, rng }));
    addOcc(P.stoneWall(b, KS_S, 'x', -48, -40, -37.8, { h: 1.8, t: 0.4, ruin: true, rng }));
    reg('tarla-kulube', place(b, -46, -47, 0, () => hut(b, rng, 'tarla-kulube', { w: 7, d: 6, style: bstyle(rng, { wall: V.tint ? '#b9a98a' : '#c9b48a', roof: PAL.tile[0] }) })));
    reg('su-kulesi', place(b, -24, -45, 0, () => waterTower(b, 'kb')));
    addOcc(P.footW(b, -28.7, -20.7, -49.5, -40.5, 14));
    addOcc(onG(-34, -40.5, 4.2, 1.3, () => V_.truck(b, KS_S, -34, -40.5, 0, V.tint ? '#2c5aa0' : '#4a7a4f', '#cdd2d8')));
    addOcc(onG(-38.4, -38.0, 1.2, 0.6, () => P.crateStack(b, KS_S, -38.4, -38.0, [[-0.58, 0, 1.1, 0], [0.58, 0, 1.0, 0]])));
    for (const [x, z] of [[-13.4, -37.4], [-12.5, -37.2]]) addOcc(onG(x, z, 0.32, 0.32, () => P.barrel(b, KS_S, x, z, '#c0392b')));
    // meyve bahçesi (çitli; ağaçlar vegetation())
    addOcc(P.fence(b, KS_S, [[-16, -57], [-16, -38], [-6.5, -38]]));
    co('Su Kulesi', -24, -45, true); co('Tarla Kulübesi', -46, -47); co('Meyve Bahçesi', -11, -48);
    // güney: gözetleme kulesi, mezarlık, kulübe, tarla
    reg('gozetleme', place(b, -17, 46, Math.PI, () => watchtower(b, 'gb')));
    addOcc(P.footW(b, -20.6, -13.4, 40.9, 51.1, 9.7));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) addOcc(P.tombstone(b, KS_S, -50 + c * 1.6, 43.0 + r * 2.4, 0, rng));
    addOcc(P.fence(b, KS_S, [[-52, 45], [-52, 41], [-40, 41], [-40, 45]])); addOcc(P.fence(b, KS_S, [[-52, 48], [-52, 52], [-40, 52], [-40, 48]]));
    reg('mezarlik-kulube', place(b, -33, 46, Math.PI, () => hut(b, rng, 'mezarlik-kulube', { w: 6.5, d: 5.5, style: bstyle(rng, { wall: '#8b7a5a', roof: PAL.tile[3] }) })));
    addOcc(N.crops(b, KS_S, rng, -82, 42, -66, 56, { along: 'z', col: '#a8b040' }));
    for (const [x, z, y] of [[-62, 44, 0], [-60.6, 44, 0], [-61.3, 44, 0.6], [-62, 45.1, 0]]) addOcc(P.hayBale(b, KS_S, x, z, y, 0));
    addOcc(P.stoneWall(b, KS_S, 'x', -83.5, -76, 38.5, { h: 2.0, t: 0.5, ruin: true, rng }));
    addOcc(P.stoneWall(b, KS_S, 'x', -62, -56, 52, { h: 1.8, t: 0.4, ruin: true, rng }));
    addOcc(onG(-8, 43, 1.3, 4.2, () => V_.truck(b, KS_S, -8, 43, Math.PI / 2, '#a8281f', '#b9bec4', { wreck: true })));
    co('Gözetleme Kulesi', -17, 46, true); co('Mezarlık', -46, 46.5); co('Kulübe', -33, 46);
  }

  // ───────── bitki (yalnız boş çim; yapıya / eşyaya / başka ağaca değmez) ─────────
  function vegetation(V) {
    for (let gx = -13.5; gx <= -7.5; gx += 3.5) for (let gz = -55; gz <= -41; gz += 4.0) tree('oak', gx, gz, 0.85, 0.6);
    if (V.sw3 === 'park') for (const [px, pz] of [[-19, 14], [-9, 14.5], [-18.5, 21.5], [-9.5, 23.5], [-20, 8.9], [-11.5, 8.6]]) tree('oak', px, pz, 0.85 + rng() * 0.3, 1.6);
    if (V.sw2 === 'church') { tree('oak', -43.6, 18.0, 1.0, 1.2); tree('oak', -43.3, 12.0, 0.9, 1.2); }
    const zones = [[-83, -57, -63, -37], [-83, 37, -63, 57], [-62, -57, -1, -36], [-62, 36, -1, 57], [-61, -25.5, -50, -24], [-44, 6.5, -27, 8]];
    for (const [a, c, d, e] of zones) {
      const n = Math.floor((d - a) * (e - c) / 55);
      for (let i = 0; i < n; i++) { const x = a + rng() * (d - a), z = c + rng() * (e - c); tree(rng() > 0.45 ? 'oak' : 'pine', x, z, 0.85 + rng() * 0.45, 0); }
      for (let i = 0; i < n; i++) { const x = a + rng() * (d - a), z = c + rng() * (e - c); bush(x, z, 0.7 + rng() * 0.6); }
      for (let i = 0; i < n / 5; i++) { const x = a + rng() * (d - a), z = c + rng() * (e - c); rockAt(x, z, 0.8 + rng() * 0.8); }
    }
    for (let i = 0; i < 24; i++) { const x = -60 + rng() * 54, z = (rng() < 0.5 ? -1 : 1) * (24.6 + rng() * 0.6); bush(x, z, 0.6 + rng() * 0.3); }
  }

  // ───────── lambalar ─────────
  function lamps1(V) {
    for (let x = -55.6; x < -8; x += 14) lampAt(x, -6.6, -Math.PI / 2);          // ana cadde kuzey kaldırımı (kol yola bakar)
    for (const x of [-51, -40.2, -18.2, -12.4]) lampAt(x, 6.6, Math.PI / 2);
    for (const x of [-62.25, -51.25, -40.25, -29.25, -18.25]) lampAt(x, -35.0, -Math.PI / 2);   // sokak kenarı çitlerinin aralarında
    for (const x of [-67.75, -56.75, -45.75, -34.75, -23.75, -12.75]) lampAt(x, 35.0, Math.PI / 2);
    for (const z of [-50, -38, -22, -12, 12, 22, 40, 52]) lampAt(-4.8, z, 0);
    lampAt(-64, -4.5, Math.PI); lampAt(-64, 4.5, Math.PI);
    for (const [x, z] of [[-31.0, -6.6], [-58.0, 6.6]]) addOcc(onG(x, z, 0.15, 0.15, () => P.hydrant(b, KS_S, x, z)));       // yangın musluğu (kaldırım)
    for (const z of [-7.6, 7.6]) for (const x of [-5.4, -4.6]) addOcc(onG(x, z, 0.12, 0.12, () => P.bollard(b, KS_S, x, z)));   // kavşak köşesi babaları
  }

  // ───────── çevre: sınır çiti, orman, tepeler, dağlar ─────────
  function surround() {
    const { minX, maxX, minZ, maxZ } = KASABA_BOUNDS;
    addOcc(P.fence(b, KS_S, [[minX - 1, minZ - 1], [maxX + 1, minZ - 1], [maxX + 1, maxZ + 1], [minX - 1, maxZ + 1], [minX - 1, minZ - 1]], { h: 1.6, col: '#7a5a38', step: 3.0 }));
  }
  function forest() {
    const { minX, maxX, minZ, maxZ } = KASABA_BOUNDS;
    const forest = [];
    const ftree = (x, z, s, pine) => {
      const r = (pine ? 1.6 : 2.2) * s;
      const out = Math.max(minX - 1 - x, x - maxX - 1, minZ - 1 - z, z - maxZ - 1);
      if (out < r + 0.6) return;                                              // tepe sınır çitine değmez
      for (const [a, c, q] of forest) if (Math.hypot(a - x, c - z) < Math.max(q, r) + 0.4) return;
      forest.push([x, z, r]);
      (pine ? N.pine : N.oak)(b, KS_S, rng, x, z, s, { collide: false });
    };
    for (let ring = 0; ring < 4; ring++) {
      const off = 4.5 + ring * 6.5, step = 4.2;
      for (let x = minX - off; x <= maxX + off; x += step) for (const zz of [minZ - off, maxZ + off]) ftree(x + (rng() - 0.5) * 2, zz + (rng() - 0.5) * 2, 1.1 + rng() * 0.9, rng() > 0.3);
      for (let z = minZ - off + step; z < maxZ + off; z += step) for (const xx of [minX - off, maxX + off]) ftree(xx + (rng() - 0.5) * 2, z + (rng() - 0.5) * 2, 1.1 + rng() * 0.9, rng() > 0.3);
    }
    const hillCols = ['#6f8a43', '#7a8f48', '#657a3d', '#8a7a52'];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng() * 0.2;
      b.withKind(KK.VEG, () => b.ico(Math.cos(a) * (205 + rng() * 40), -3, Math.sin(a) * (165 + rng() * 30), 28 + rng() * 14, hillCols[i % 4], { detail: 1, scale: [1.6, 0.55, 1.3] }));
    }
    const mtCols = ['#7b786f', '#6e6c66', '#847f74'];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rng() * 0.15, rx = 300 + rng() * 50, rz = 270 + rng() * 50, h = 38 + rng() * 42, base = 70 + rng() * 40;
      b.cyl(Math.cos(a) * rx, 0, Math.sin(a) * rz, 0.1, base, h, mtCols[i % 3], { seg: 7, ry: rng() * 3, collide: false, kind: KK.STONE });
      if (h > 62) b.cyl(Math.cos(a) * rx, h * 0.84, Math.sin(a) * rz, 0.1, base * 0.2 * 0.16 / 0.16, h * 0.16, '#e8ecef', { seg: 7, collide: false, kind: KK.PLAIN });
    }
  }

  // ═════════ bitki yerleşimi: tepe (yarıçap r, alt kotu low) yüksek yapılara, gövde her yapıya / yola değmez ═════════
  function freeAt(x, z, rTrunk, rCanopy, low) {
    const [wx, wz] = W(x, z);
    if (wx < KASABA_BOUNDS.minX + 0.5 || wx > KASABA_BOUNDS.maxX - 0.5 || wz < KASABA_BOUNDS.minZ + 0.5 || wz > KASABA_BOUNDS.maxZ - 0.5) return null;
    if (G.top(wx, wz) !== 0 || G.topOf(wx - rTrunk, wx + rTrunk, wz - rTrunk, wz + rTrunk) !== 0) return null;   // çim dışı (yol, kaldırım, toprak)
    for (const f of occ) {
      const dx = Math.max(f.x0 - wx, 0, wx - f.x1), dz = Math.max(f.z0 - wz, 0, wz - f.z1), d = Math.hypot(dx, dz);
      if (d < rTrunk + (f.h > 0.3 ? 1.0 : 0.35)) return null;                     // çarpışmalı yapıyla gövde arasında ≥ 1 m geçit (bot dar yarığa sıkışmaz)
      if (f.h > low - 0.2 && d < rCanopy + 0.25) return null;
    }
    return [wx, wz];
  }
  function tree(kind, x, z, s, search) {
    const R = kind === 'oak' ? 2.2 * s : 1.6 * s, low = kind === 'oak' ? 1.9 * s : 1.3 * s;
    for (let d = 0; d <= search + 1e-6; d += 0.4) for (let k = 0; k < (d ? 12 : 1); k++) {
      const px = x + d * Math.cos(k * Math.PI / 6), pz = z + d * Math.sin(k * Math.PI / 6);
      const w = freeAt(px, pz, 0.4 * s, R, low); if (!w) continue;
      (kind === 'oak' ? N.oak : N.pine)(b, KS_S, rng, px, pz, s);
      occ.push({ x0: w[0] - R, x1: w[0] + R, z0: w[1] - R, z1: w[1] + R, h: 0.0, tree: true, cx: w[0], cz: w[1], r: R });
      return true;
    }
    return false;
  }
  function bush(x, z, s) {
    const r = 0.84 * s, w = freeAt(x, z, r, r, 0); if (!w) return;
    N.bush(b, KS_S, rng, x, z, s); occ.push({ x0: w[0] - r, x1: w[0] + r, z0: w[1] - r, z1: w[1] + r, h: 1.2 });
  }
  function rockAt(x, z, s) {
    const ww = 1.4 * s, dd = 1.1 * s, w = freeAt(x, z, Math.max(ww, dd) * 0.75, Math.max(ww, dd) * 0.75, 0); if (!w) return;
    N.rock(b, KS_S, rng, x, z, ww, dd, 0.8 * s, rng() > 0.5 ? '#8a8a84' : '#76766f'); occ.push({ x0: w[0] - ww / 2, x1: w[0] + ww / 2, z0: w[1] - dd / 2, z1: w[1] + dd / 2, h: 0.8 * s });
  }
  function P0post(x, y, z, r, h) { boxR(b, x - r, x + r, y, y + h, z - r, z + r, '#f0eee6', KK.CONC); }

  // ═════════ doğuş noktaları: avluda çarpışmasız, dağınık ═════════
  function pickSpawns(side) {
    const zone = side < 0 ? BLUE_ZONE : RED_ZONE, cands = [];
    for (let x = zone.minX + 1; x <= zone.maxX - 1; x += 1.5) for (let z = zone.minZ + 1.5; z <= zone.maxZ - 1.5; z += 1.5) {
      let ok = true;
      for (const c of b.colliders) {
        if (c.max[1] < 0.3 || c.min[1] > 1.8) continue;
        if (x > c.min[0] - 0.9 && x < c.max[0] + 0.9 && z > c.min[2] - 0.9 && z < c.max[2] + 0.9) { ok = false; break; }
      }
      if (ok) cands.push({ x, z });
    }
    cands.sort((p, q) => (side < 0 ? q.x - p.x : p.x - q.x) + (rng() - 0.5) * 6);
    const out = [];
    for (const c of cands) {
      if (out.length >= 20) break;
      if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 2.6)) continue;
      out.push({ x: c.x, z: c.z, ry: (side < 0 ? -Math.PI / 2 : Math.PI / 2) + (rng() - 0.5) * 0.4 });
    }
    return out;
  }
}
const V_ = V;
