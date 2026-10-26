import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBuilder, makeRng } from './builder.js';
import { Terrain, fbm, smoothstep } from './terrain.js';
import { VK, PAL, vadiKindOf, makeVadiMaterial, makeVadiGroundMaterial, makeInstMaterial } from './assets/vadi/surface.js';
import * as L from './assets/vadi/layout.js';
import * as P from './assets/vadi/props.js';
import * as BLD from './assets/vadi/buildings.js';
import * as ST from './assets/vadi/structures.js';
import * as N from './assets/vadi/nature.js';
import { riverMesh } from './assets/vadi/water.js';
import { stoneArchBridge, plankBridge } from './assets/common/vadi-bridge.js';

export const VADI_BOUNDS = L.BOUNDS;
export const vadiHeight = L.vadiHeight;

// Harita 2 — VADİ v3 (12.169): v2 oynanış şablonu (aynı plan, hedefler, doğuşlar, şeritler, modlar) SIFIRDAN modüler asset'lerle yeniden kuruldu.
// Doğu-batı vadi, ortada kuzey-güney nehir; Mavi (batı) / Kırmızı (doğu) çiftlik çanakları sırtlarla görüşten gizli; çanaktan üç yol:
// kuzey patika (orman / sırt, keskin nişancı), merkez şikan yolu (taş köprü, ağır çatışma), güney geçit (Ambar, sığ geçit).
// 180° dönme simetrisi: her yerleşim mavi yarı koordinatında yazılır, kırmızı yarı dönmüş kopyadır (Ambar ↔ Değirmen, Tepe ↔ Orman Kampı farklı içerik).
//
// Yapı: assets/vadi/{layout, surface, kit, props, buildings, structures, nature, water}.js + assets/common/vadi-bridge.js
//  · arazi: 2 m ızgara, yapı düzlükleri ızgaraya hizalı ve tam düz (yapı tabanı düz çizgiyle oturur), patikalar kazılı yatak, nehir + kanyon
//  · yapılar bölge başına bir MapBuilder (6 + dış): her bölge TEK birleşik ağ (görüş konisi dışı çizilmez), tek paylaşılan gölgelendirici
//  · ağaç / çalı / çimen örnekli (InstancedMesh, bölge başına), kayalar dışbükey gövde (birleşik ağda)

const PI = Math.PI;

export function buildVadi() {
  L.finalizeLayout();
  { const pc = L.padConflicts(); if (pc.length) console.warn('Vadi: düzlük çakışması', pc); }
  const H = L.vadiHeight;
  const VIS = !MapBuilder.noVisual;
  let SHARED = null;
  const sharedMat = () => (SHARED ||= makeVadiMaterial());
  // ───────── bölge yapıcıları ─────────
  const CH = [];
  const mkB = () => { const b = new MapBuilder(); b.surface = { ground: () => 0, kindOf: vadiKindOf, seeded: true, material: sharedMat }; CH.push(b); return b; };
  // oyun alanı tek yapıcı (tek birleşik ağ + birkaç özel malzeme kovası: telefonda çizim çağrısı az), sınır dışı dekor ayrı (görüş konisi dışında çizilmez)
  const grid6 = [mkB()], outer = mkB();
  const chunk = (x, z) => (Math.abs(x) > 92 || Math.abs(z) > 62 ? outer : grid6[0]);
  const rng = makeRng(2024), rngV = makeRng(77);
  const SAILS = [];

  // ───────── arazi ─────────
  const E = L.TERRAIN_EXT;
  const terrain = new Terrain({ minX: E.minX, maxX: E.maxX, minZ: E.minZ, maxZ: E.maxZ, cell: E.cell, height: H });
  terrain.tri = true;                                 // fizik / yol bulma çizilen üçgenlerle aynı yüzeyi okur
  const T = terrain, TH = (x, z) => T.heightAt(x, z);

  // ───────── yerleşim yardımcıları ─────────
  // site(id, cx, cz, fn): mavi yarı merkezinde (cx, cz) yerel çerçeve (orijin = düzlük / zemin kotu); kırmızı yarıda 180° dönmüş kopya.
  // fn(b, g): g = { side, y0, gy(lx, lz) (yerel noktanın zemini − y0), at(lx, lz, f) (alt nesneyi kendi zeminine oturt), sub(id, f) }
  const _v = new THREE.Vector3();
  const site = (id, cx, cz, fn, { sides = [1, -1], y = null } = {}) => {
    for (const side of sides) {
      const wx = side * cx, wz = side * cz, ry = side > 0 ? 0 : PI;
      const pad = L.padAt(wx, wz);
      const y0 = y ?? (pad ? pad.y : TH(wx, wz));
      const b = chunk(wx, wz);
      const oid = id + (side > 0 ? ':m' : ':k');
      b.obj(oid, () => b.with(wx, y0, wz, ry, () => {
        const M = b.M.clone();
        const gy = (lx, lz) => { _v.set(lx, 0, lz).applyMatrix4(M); return TH(_v.x, _v.z) - y0; };
        let ns = 0;
        const sub = (sid, f) => b.obj(oid + '/' + (sid ?? ns++), f);
        const at = (lx, lz, f, sid) => sub(sid, () => b.with(lx, gy(lx, lz), lz, 0, f));
        fn(b, { side, y0, gy, sub, at, M });
      }));
    }
  };
  const team = (side) => (side > 0 ? { main: PAL.blue, barn: PAL.barnBlue, roof: PAL.roofSlate } : { main: PAL.red, barn: PAL.barnRed, roof: PAL.roofTile });
  // zemin en alçağı (ayak izi köşeleri + merkez)
  const gmin = (gy, x, z, hx, hz) => Math.min(gy(x, z), gy(x - hx, z - hz), gy(x + hx, z - hz), gy(x - hx, z + hz), gy(x + hx, z + hz));
  // düz yer: (x, z) çevresinde (± r) ayak izi (hx × hz) altında arazi aralığı en küçük nokta (uzaklık hafif cezalı); patika yatağı / düzlük / su dışı.
  // Yamaçta yer siperi (kaya, kütük, kum torbası) yarı gömülü / havada durmasın (eski haritada "en düz yere" yerleşim de buydu).
  const _ot = {};
  const onTrail = (x, z, m) => L.TRAILS.some((t) => { const q = t.near(x, z, _ot); return q && q.d < t.w / 2 + m; });
  const flatSpot = (x, z, hx, hz, r = 1.5, { trailM = 0.3, keepTrail = false } = {}) => {
    let best = null;
    for (let dx = -r; dx <= r + 1e-6; dx += 0.25) for (let dz = -r; dz <= r + 1e-6; dz += 0.25) {
      const px = x + dx, pz = z + dz;
      if (!keepTrail && onTrail(px, pz, trailM + Math.max(hx, hz))) continue;
      if (L.padAt(px, pz, Math.max(hx, hz) + 0.5) || TH(px, pz) < 0.2) continue;
      let lo = 1e9, hi = -1e9;
      for (const [a, c] of [[0, 0], [-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz], [0, -hz], [0, hz], [-hx, 0], [hx, 0]]) { const h = TH(px + a, pz + c); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      const sc = hi - lo + 0.04 * Math.hypot(dx, dz);
      if (!best || sc < best[0]) best = [sc, px, pz];
    }
    return best ? [best[1], best[2]] : [x, z];
  };

  // ═════════ DOĞUŞ ÇANAĞI (çiftlik): ahır, iki silo, çiftlik evi, traktör, saman, takım bayrağı ═════════
  site('ahir', -83, -10, (b, g) => BLD.barn(b, {
    w: 10, d: 12, ridge: 'z', color: team(g.side).barn,
    furnish: (bb, I) => {
      P.baleStack(bb, -2.6, -3.6, 3, 2); P.baleStack(bb, 2.4, 3.8, 2, 2);
      bb.with(2.6, 0, -2.6, PI / 2, () => P.cart(bb, { hay: true }));
      P.crate(bb, -3.6, 4.2, 1.0); P.crate(bb, -3.4, 2.9, 0.9);
    },
  }));
  site('silo-1', -86, 3.5, (b) => ST.silo(b, { r: 2.2, h: 9 }));
  site('silo-2', -86, 9.6, (b) => ST.silo(b, { r: 1.7, h: 7.4 }));
  site('ciftlik-evi', -76, 11, (b, g) => BLD.house(b, {
    w: 8, d: 6, ridge: 'x', roof: team(g.side).roof, roofKind: VK.ROOF, wall: g.side > 0 ? PAL.plaster : PAL.plasterB,
    ops: { n: [BLD.DOOR(0.6), BLD.WIN(-2.2, { glow: true }), BLD.WIN(2.6)], s: [BLD.WIN(-2), BLD.WIN(2, { glow: true })], e: [BLD.WIN(0)], w: [BLD.WIN(0)] },
    furnish: (bb, I) => {
      P.table(bb, -1.4, 0.6, 1.6, 0.8); P.bench(bb, -1.4, 1.45, 1.4); P.cabinet(bb, -3.15, -1.6, 1.0, 0.5, 1.8, PI / 2);
      P.bed(bb, 2.6, 1.6, PI); P.stove(bb, 3.2, -1.95, I.ceil);
    },
  }));
  site('traktor', -70, -10, (b, g) => g.at(0, 0, () => b.with(0, 0, 0, PI / 2, () => P.tractor(b, { color: g.side > 0 ? '#3a6aa8' : '#a8402f' }))));
  site('saman-1', -69.2, 13.6, (b) => P.baleStack(b, 0, 0, 3, 2));
  site('saman-2', -66.8, 15.2, (b) => P.baleStack(b, 0, 0, 2, 1));
  site('sandik-canak', -73, -13.8, (b, g) => { P.crate(b, 0, 0, 1.1); P.crate(b, 1.15, 0.1, 1.0); P.crate(b, 0.05, 0, 0.9, 1.1); P.barrel(b, 2.5, 0, team(g.side).main); P.barrel(b, 3.2, 0.35, team(g.side).main); });
  site('kumtorba-canak-1', -63.5, -4.5, (b, g) => P.sandbagsOn(b, g.gy, 0, 0, 3.7, 'z'));
  site('kumtorba-canak-2', -63.5, 3.8, (b, g) => P.sandbagsOn(b, g.gy, 0, 0, 3.7, 'z'));
  for (const [x, z, k] of [[-66, -11, 'a'], [-66, 6.5, 'b'], [-79.5, 0.2, 'c']]) site('fener-canak-' + k, x, z, (b) => P.lantern(b, 3.4));
  site('bayrak', -75, 0, (b, g) => P.flagPole(b, team(g.side).main));
  site('cit-canak', -80, 16.2, (b, g) => P.fence(b, g.gy, -7, 0, 3, 0));

  // ═════════ KÖPRÜBAŞI MEZRASI (iki yaka): iki ev, taş karakol, gözetleme kulesi, kuyu, kamyonet, at arabası, kum torbası ═════════
  site('ev-m1', -20, -11, (b) => BLD.house(b, {
    w: 8, d: 6, ridge: 'x', roof: PAL.roofTile, wall: PAL.plaster,
    ops: { s: [BLD.DOOR(-1.2), BLD.WIN(1.6), BLD.WIN(-3.1, { w: 0.8 })], n: [BLD.WIN(-2), BLD.WIN(2, { glow: true })], e: [BLD.WIN(0)], w: [BLD.WIN(0)] },
    furnish: (bb, I) => { P.table(bb, 1.6, -0.7, 1.6, 0.8); P.bench(bb, 1.6, -1.55, 1.4); P.cabinet(bb, -3.15, 0.2, 1.0, 0.5, 1.8, PI / 2); P.bed(bb, -2.4, -1.7, 0); P.stove(bb, 3.25, 1.9, I.ceil); },
  }));
  site('karakol', -12, -12, (b) => BLD.outpost(b, {
    w: 4, d: 4, ops: { s: [BLD.DOOR(0)], e: [BLD.WIN(0, { w: 1.4, b: 1.2, top: 1.7 })], n: [BLD.WIN(0, { w: 1.4, b: 1.2, top: 1.7 })], w: [BLD.WIN(0, { w: 1.4, b: 1.2, top: 1.7 })] },
    furnish: (bb) => { P.crate(bb, -1.05, -1.05, 0.9); P.crate(bb, 1.1, -1.1, 0.8); },
  }));
  site('kuyu', -12, -16.0, (b) => ST.well(b));
  site('ev-m2', -20, 9, (b) => BLD.house(b, {
    w: 8, d: 6, ridge: 'x', roof: PAL.roofMoss, wall: PAL.plasterC,
    ops: { n: [BLD.DOOR(1.2), BLD.WIN(-1.6), BLD.WIN(3.1, { w: 0.8 })], s: [BLD.WIN(-2, { glow: true }), BLD.WIN(2)], e: [BLD.WIN(0)], w: [BLD.WIN(0)] },
    furnish: (bb, I) => { P.table(bb, -1.6, 0.7, 1.6, 0.8); P.bench(bb, -1.6, 1.55, 1.4); P.bed(bb, 2.4, 1.7, PI); P.cabinet(bb, 3.15, -0.3, 1.0, 0.5, 1.8, -PI / 2); },
  }));
  site('kule-kopru', -10, 8, (b) => ST.watchtower(b, { H: 3.6, steps: 12, run: 0.32, stairX: 1.0 }));
  site('kamyonet', -17.6, -3.5, (b) => P.pickup(b, { wreck: true }));
  site('araba-kopru', -15.0, 4.85, (b) => P.cart(b, {}));
  site('kumtorba-kopru-1', -12.8, -3.7, (b) => P.sandbags(b, 0, 0, 2.6, 0));
  site('kumtorba-kopru-2', -12.4, 3.7, (b) => P.sandbags(b, 0, 0, 2.2, 0));
  site('fener-kopru', -12.6, -6.4, (b) => P.lantern(b, 3.2));

  // ═════════ KUZEY MEZRA (iki kulübe, avlu duvarı, saman) / GÜNEY ÇİFTLİK KULÜBESİ ═════════
  const cottage = (wallC, roofC, ops, furnish) => (b) => BLD.house(b, { w: 6, d: 6, ridge: 'z', wall: wallC, wallKind: wallC === PAL.wood ? VK.WOOD : VK.PLASTER, roof: roofC, ops, furnish, pitch: 36 });
  site('kulube-n1', -35, -17, cottage(PAL.wood, PAL.roofMoss, { e: [BLD.DOOR(0)], n: [BLD.WIN(0)], s: [BLD.WIN(0)], w: [BLD.WIN(-1)] },
    (bb) => { P.table(bb, -0.9, 0.9, 1.4, 0.8, PI / 2); P.bed(bb, -1.5, -1.7, 0); P.crate(bb, 2.1, 2.1, 0.8); }));
  site('kulube-n2', -43, -19, cottage(PAL.woodD, PAL.roofTileB, { s: [BLD.DOOR(0.6)], n: [BLD.WIN(0)], e: [BLD.WIN(0)], w: [BLD.WIN(0)] },
    (bb) => { P.cabinet(bb, -2.1, -1.6, 1.0, 0.5, 1.8, PI / 2); P.bed(bb, 1.5, -1.7, 0); P.table(bb, 1.0, 0.6, 1.4, 0.8); }));
  site('saman-mezra', -44.5, -13.5, (b) => P.baleStack(b, 0, 0, 3, 2));
  site('kulube-g', -45, 29, cottage(PAL.plasterB, PAL.roofTile, { n: [BLD.DOOR(-0.6)], s: [BLD.WIN(0)], e: [BLD.WIN(0)], w: [BLD.WIN(0)] },
    (bb, I) => { P.table(bb, 0.9, 0.6, 1.4, 0.8, PI / 2); P.bed(bb, -1.5, 1.7, PI); P.stove(bb, 2.05, -2.05, I.ceil); }));
  site('saman-gkulube', -48.6, 25.0, (b) => P.baleStack(b, 0, 0, 2, 1));
  site('cit-gkulube', -41.0, 25, (b, g) => P.fence(b, g.gy, 0, 0, 0, 8));

  // ═════════ AMBAR (mavi) / DEĞİRMEN (kırmızı): aynı taş avlu duvarı (dört kapı), içerik farklı ═════════
  site('avlu', -24, 26, (b, g) => {
    const W = (x0, z0, x1, z1, gaps) => P.stoneWall(b, () => 0, x0, z0, x1, z1, { gaps, h: 1.15 });
    // kuzey / güney duvarı dış köşeleri kapsar (x −10,3…10,3), batı / doğu aralarında (z −9,7…9,7); 'at' = parça başından kapı başına
    g.sub('duvar-k', () => W(-10.3, -10, 10.3, -10, [{ at: 7.8, w: 5 }]));          // kuzey kapı (x −24)
    g.sub('duvar-g', () => W(-10.3, 10, 10.3, 10, [{ at: 6.3, w: 5 }]));            // güney kapı (x −25,5)
    g.sub('duvar-b', () => W(-10, -9.7, -10, 9.7, [{ at: 4.9, w: 4.6 }]));          // batı kapı (z 23,5)
    g.sub('duvar-d', () => W(10, -9.7, 10, 9.7, [{ at: 8.2, w: 5 }]));              // doğu kapı (z 27)
  });
  site('ambar', -24, 26, (b, g) => {
    // içerik (mavi = Ambar, kırmızı = Değirmen) yerel avlu çerçevesinde; avlu iç yüzü ±9,7
    if (g.side > 0) {
      g.sub('ahir', () => b.with(-1, 0, 0, 0, () => BLD.barn(b, {
        w: 10, d: 12, ridge: 'z', color: PAL.barnRed,
        furnish: (bb) => { P.baleStack(bb, -2.4, 3.2, 3, 2); P.baleStack(bb, 2.6, -3.4, 2, 2); bb.with(-2.6, 0, -3.2, PI / 2, () => P.cart(bb, { hay: true })); P.crate(bb, 3.4, 3.6, 1.0); },
      })));
      g.sub('traktor', () => b.with(-7.8, 0, -7.6, 0, () => P.tractor(b, { color: '#b7392d' })));
      g.sub('saman-a', () => P.baleStack(b, 6.8, -7.0, 2, 2));
      g.sub('saman-b', () => P.baleStack(b, 7.0, 7.4, 2, 1));
      g.sub('sandik', () => { P.crate(b, 7.6, 3.8, 1.1); P.crate(b, 7.7, 2.6, 1.0); P.barrel(b, 8.6, 5.3, '#5f6a48'); });
      g.sub('araba', () => b.with(-7.6, 0, 5.4, PI / 2, () => P.cart(b, {})));
      g.sub('fener', () => b.with(4.8, 0, 8.6, 0, () => P.lantern(b, 3.2)));
    } else {
      g.sub('degirmen', () => b.with(5, 0, -3, 0, () => { const wm = BLD.windmill(b, { face: 'e' }); SAILS.push({ M: b.M.clone(), local: wm }); }));      // kanatlar batıya (nehre) bakar
      g.sub('cuval', () => { P.sack(b, -6.4, 0, -6.6, PI / 2); P.sack(b, -6.4, 0.32, -6.6, PI / 2); P.sack(b, -5.6, 0, -6.6, PI / 2); P.sack(b, -7.2, 0, -6.6, PI / 2); });
      g.sub('degirmen-tasi-a', () => { b.cyl(-6, 0, 6.6, 1.25, 1.25, 0.42, '#9a948a', { seg: 8, ry: PI / 8, collide: false, kind: VK.STONE }); b.collide(-6, 0, 6.6, 1.25 * 0.9239 * 1.4142, 0.42, 1.25 * 0.9239 * 1.4142); });
      g.sub('degirmen-tasi-b', () => { b.cyl(-2.8, 0, 7.6, 1.1, 1.1, 0.4, '#8a8479', { seg: 8, ry: PI / 8, collide: false, kind: VK.STONE }); b.collide(-2.8, 0, 7.6, 1.1 * 0.9239 * 1.4142, 0.4, 1.1 * 0.9239 * 1.4142); });
      g.sub('saman', () => P.baleStack(b, -7.0, -1.2, 2, 2));
      g.sub('sandik', () => { P.crate(b, 7.9, 7.6, 1.1); P.crate(b, 6.7, 7.8, 1.0); P.barrel(b, 8.4, 6.2, '#2c5aa0'); });
      g.sub('araba', () => b.with(-1.4, 0, -7.4, 0, () => P.cart(b, { color: '#6a4a2a', hay: true })));
      g.sub('fener', () => b.with(-3.6, 0, 3.4, 0, () => P.lantern(b, 3.2)));
    }
  });

  // ═════════ GÖZETLEME TEPESİ (mavi kuzey zirvesi) / ORMAN KAMPI (kırmızı güney zirvesi) ═════════
  // zirve düzlüğü x −30…−14, z −48…−32 (merkez −22, −40); dört yol girer: batı (kuzey patika), güney (rampa), doğu (nehir geçidi), kuzey (ledge)
  site('tepe', -22, -40, (b, g) => {
    g.sub('bunker', () => b.with(4, 0, -3, 0, () => BLD.bunker(b, { w: 4, d: 6, face: 'e' })));
    if (g.side > 0) {
      g.sub('kule', () => b.with(-6, 0, -6, 0, () => ST.watchtower(b, { H: 3.6, steps: 11, run: 0.32, stairX: -1.0 })));
      g.sub('sandik-a', () => { P.crate(b, 1.0, 1.6, 1.1); P.crate(b, 1.1, 2.8, 1.0); });
      g.sub('sandik-b', () => { P.crate(b, -2.6, 4.6, 1.0); P.barrel(b, -1.4, 4.8, '#4d5b3a'); });
      g.sub('yuva', () => b.with(5.4, 0, 4.6, -PI / 2, () => P.sandbags(b, 0, 0, 3.4, 0)));
      g.sub('fener', () => b.with(-1.6, 0, -1.0, 0, () => P.lantern(b, 3.4)));
    } else {
      // Orman Kampı: çadırlar (birbirine / ateşe değmez), kamp ateşi, kütük yığını, devrik kütükler, sandıklar
      g.sub('cadir-a', () => b.with(-5.2, 0, -5.0, 0, () => ST.tent(b, { color: PAL.canvas })));
      g.sub('cadir-b', () => b.with(-1.6, 0, -5.0, 0, () => ST.tent(b, { color: PAL.canvasG })));
      g.sub('cadir-c', () => b.with(-6.0, 0, 1.6, PI / 2, () => ST.tent(b, { color: '#b9b184', w: 2.4, d: 3.0 })));
      g.sub('ates', () => b.with(-1.8, 0, 0.4, 0, () => P.campfire(b)));
      g.sub('kutuk-yigini', () => P.logPile(b, 2.0, 4.4, 2.6));
      g.sub('kutuk-a', () => P.log(b, -1.6, 0.25, 2.6, 2.8, 'x', 0.25));
      g.sub('kutuk-b', () => P.log(b, 0.9, 0.25, -0.4, 2.4, 'z', 0.25));
      g.sub('sandik', () => { P.crate(b, -3.8, 4.6, 1.1); P.crate(b, -5.0, 4.7, 1.0); });
      g.sub('fener', () => b.with(0.4, 0, -2.8, 0, () => P.lantern(b, 3.0)));
    }
  });

  // gizli kamplar (orman bankı): ateş + çadır + sandık + kütük; gece uzaktan seçilir
  for (const [k, x, z] of [['gizli-kamp-1', -47, -43], ['gizli-kamp-2', -69, 37]]) site(k, x, z, (b, g) => {
    g.sub('ates', () => b.with(-1.4, 0, 0.6, 0, () => P.campfire(b)));
    g.sub('cadir', () => b.with(1.3, 0, -0.2, 0, () => ST.tent(b, { color: g.side > 0 ? PAL.canvasB : '#c9a58f', w: 2.4, d: 3.0 })));
    g.sub('sandik', () => P.crate(b, -1.7, -1.9, 0.9));
    g.sub('kutuk', () => P.log(b, -0.4, 0.25, 2.25, 2.2, 'x', 0.25));
  });
  site('yikik-ev', -9, 41, (b, g) => BLD.ruin(b, rng, { w: 4, d: 4, gy: g.gy }));      // düzlüksüz: yamaçta her duvar parçası kendi zeminine iner (temel duvarı)

  // ═════════ KÖPRÜLER ═════════
  const BK = { stone: VK.STONE, wood: VK.WOOD, plank: VK.PLANK, rope: VK.CANVAS };
  grid6[0].obj('köprü', () => b1Bridge(grid6[0]));
  function b1Bridge(b) {
    // tek açık kemer derin suyun üstünde (yatak düz: altında sıkışma yok); iki yanı dolu kıyı ayağı + kör kemer kabartması (kıyıda tabliye altına sıkışılacak kama yok)
    stoneArchBridge(b, { L: 20, W: 6.6, top: L.DECK_Y, kind: BK, piers: [], abut: 1.6, spring: 0.0, bed: L.BED_Y - 0.3, blind: [[-5.6, -2.0], [2.0, 5.6]] });
    // tabliye üstü siper: at arabası + sandıklar + kum torbası. Çarpışmaları 'rail': yol bulma engeli tabliye kotundan ölçer (araziden değil)
    const n0 = b.colliders.length;
    b.with(-3.4, L.DECK_Y, 1.2, 0, () => P.cart(b, { color: '#6a4a2a' }));
    P.crate(b, 4.2, -1.4, 1.1, L.DECK_Y); P.crate(b, 5.3, -1.6, 1.0, L.DECK_Y);
    b.with(1.0, L.DECK_Y, -1.9, 0, () => P.sandbags(b, 0, 0, 2.4, 0, 2));
    for (const [px, pz] of [[-9.3, -2.6], [9.3, 2.6]]) b.with(px, L.DECK_Y, pz, 0, () => P.lantern(b, 3.2));
    for (let i = n0; i < b.colliders.length; i++) if (!b.colliders[i].tag) b.colliders[i].tag = 'rail';
  }
  for (const sg of [1, -1]) {
    const z = -46 * sg, x0 = sg > 0 ? -9.6 : -5.4, x1 = sg > 0 ? 5.4 : 9.6;
    const b = chunk(0, z);
    b.obj('asma:' + (sg > 0 ? 'k' : 'g'), () => {
      // uç ayakları: kanyon duvarı tabliyeye 2,3 m'den yakınken altı kuru taş ayakla dolu (tabliye ile yamaç arasında sıkışılacak kama yok);
      // boylama kirişler iki ayak arasında (ayağın üstüne binmez)
      const db = L.SADDLE_Y - 0.25, span = [];
      for (const [edge, dir] of [[sg > 0 ? -8 : -4, 1], [sg > 0 ? 4 : 8, -1]]) {
        let xe = edge, lo = TH(edge, z);
        for (let k = 0; k < 40; k++) { const xn = xe + dir * 0.25; let m = 1e9; for (const dz of [-1.1, 0, 1.1]) m = Math.min(m, TH(xn, z + dz)); if (m < L.SADDLE_Y - 2.3) break; xe = xn; lo = Math.min(lo, m); }
        span.push(xe);
        if (Math.abs(xe - edge) < 0.05) continue;
        const a = Math.min(edge, xe), c = Math.max(edge, xe);
        b.withKind(VK.STONE, () => b.box((a + c) / 2, lo - 0.4, z, c - a, db - (lo - 0.4), 2.2, PAL.stone, { tag: 'deck' }));
        // tabliyenin iki yanında kuru taş omuz duvarı (yan perdeyle aynı yükseklik): yamaçtan perde altına sokulup sıkışılmaz, köprü ağzından kanyona düşülmez;
        // düzlüğün kenarından başlar (yol ızgarasında engel, etiketsiz)
        for (const sz of [-1, 1]) b.withKind(VK.STONE, () => b.box((Math.min(a, edge - dir * 0.6) + Math.max(c, edge - dir * 0.6)) / 2, lo - 0.4, z + sz * 1.6, Math.max(c, edge - dir * 0.6) - Math.min(a, edge - dir * 0.6), L.SADDLE_Y + 0.6 - (lo - 0.4), 0.6, PAL.stoneD));      // z ±1,3…1,9: direk / perdeye değmez
      }
      plankBridge(b, { x0, x1, z, top: L.SADDLE_Y, w: 2.2, kind: BK, span: [Math.min(...span), Math.max(...span)] });
      for (const px of [x0 - 1.0, x1 + 1.0]) b.with(px, L.SADDLE_Y - 0.04, z + 1.7 * sg, 0, () => P.lantern(b, 2.6));
    });
  }

  // kanyon kenarı korkuluğu: asma köprü ayaklarının iki yanında kanyon kıyısı boyunca alçak kuru taş duvar (0,7 m; dolu → altına sokulup sıkışılmaz,
  // köprü ağzında kenardan kanyona düşülmez, botlar dahil). Duvar kıyının hemen üstünde (dışında yürünecek şerit kalmaz).
  for (const sg of [1, -1]) for (const [xr, za, zb] of [[-9.2, -48.4, -55.0], [-9.2, -43.6, -37.0], [3.2, -48.4, -55.0], [3.2, -43.6, -37.0]]) {
    const b = chunk(sg * xr, sg * za);
    b.obj('kanyon-duvar:' + (sg > 0 ? 'k' : 'g') + ':' + xr + ':' + za, () => P.stoneWall(b, TH, sg * xr, Math.min(sg * za, sg * zb), sg * xr, Math.max(sg * za, sg * zb), { h: 0.75, t: 0.5 }));
  }

  // ═════════ NEHİR GEÇİTLERİ: basamak taşları, siper kayaları, kum torbası, kütük ═════════
  site('gecit-taslari', -2.4, -26, (b, g) => {
    for (const [x, z, s] of [[-3.2, -1.6, 0.6], [-1.6, -0.3, 0.55], [0.0, 1.0, 0.6], [1.6, -0.6, 0.5], [3.0, 0.8, 0.55], [-0.4, -2.4, 0.5], [2.2, 2.4, 0.5]]) {
      const gg = gmin(g.gy, x, z, s * 0.65, s * 0.5);
      if (gg < -1.0) continue;
      P.steppingStone(b, x, gg - 0.04, z, s);
      b.collide(x, gg - 0.04, z, s * 1.3, 0.24, s);
    }
  });
  // yer siperi boş yer denetimi: ayak izi (x ± hx, z ± hz) + 0,3 m payla mevcut hiçbir çarpışma kutusuna (yapı, kaya, kütük, iki yarı) değmez
  const clearAt = (x, z, hx, hz) => !CH.some((b) => b.colliders.some((c) => x + hx + 0.3 > c.min[0] && x - hx - 0.3 < c.max[0] && z + hz + 0.3 > c.min[2] && z - hz - 0.3 < c.max[2]))
    && !CH.some((b) => b.colliders.some((c) => -x + hx + 0.3 > c.min[0] && -x - hx - 0.3 < c.max[0] && -z + hz + 0.3 > c.min[2] && -z - hz - 0.3 < c.max[2]));
  const rangeAt = (x, z, hx, hz) => { let lo = 1e9, hi = -1e9; for (const [a, c] of [[0, 0], [-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) { const h = TH(x + a, z + c); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
  const bagSite = (k, x0, z0, len) => {
    const [x, z] = flatSpot(x0, z0, len / 2, 0.3, 2.5, { keepTrail: true });
    if (rangeAt(x, z, len / 2, 0.25) > 0.3 || !clearAt(x, z, len / 2, 0.25)) return;           // eğimde / başka siperin üstünde: konmaz
    site(k, x, z, (b, g) => P.sandbagsOn(b, g.gy, 0, 0, len, 'x'));
  };
  bagSite('gecit-kumtorba-1', -15.6, -17.9, 3.0);
  bagSite('gecit-kumtorba-2', -7.6, -29.0, 2.6);
  site('gecit-kumtorba-3', -12.6, 23, (b) => P.sandbags(b, 0, 0, 3.0, PI / 2));      // Ambar düzlüğünün doğu ucunda (geçide bakar)

  // ═════════ SIRT LEDGE'LERİ: keskin nişancı yuvaları + kaya geçitleri ═════════
  for (const [k, d] of [['yuva-k1', 1], ['yuva-k2', 1], ['yuva-g1', -1], ['yuva-g2', -1], ['yuva-g3', -1]]) {
    const pd = L.PADS.find((p) => p.name === k && p.side > 0), x = (pd.x0 + pd.x1) / 2, z = (pd.z0 + pd.z1) / 2 + d * 0.4;      // düzlüğün ortası, vadi tarafına kayık
    // yuva: kum torbaları ledge'in vadi tarafında (d: +1 kuzey sırt → vadi +z), sandık + fener arkada; her parça kendi zemininde
    site(k, x, z, (b, g) => {
      g.sub('torba', () => P.sandbagsOn(b, g.gy, 0, d * 1.0, 3.4, 'x', 3));
      g.sub('sandik', () => P.crate(b, -2.3, -d * 0.5, 1.0, gmin(g.gy, -2.3, -d * 0.5, 0.5, 0.5)));
      g.sub('fener', () => b.with(2.3, gmin(g.gy, 2.3, -d * 0.4, 0.07, 0.07), -d * 0.4, 0, () => P.lantern(b, 2.6)));
    });
  }
  site('kaya-gecidi-k', -52, -50.6, (b, g) => ST.rockArch(b, g.gy, { len: 6, w: 3.6, h: 2.9 }));
  site('kaya-gecidi-g', -33, 50.0, (b, g) => ST.rockArch(b, g.gy, { len: 6, w: 3.6, h: 2.9 }));

  // ═════════ ŞİKAN / yamaç siperleri: kayalar, kütükler ═════════
  const coverRock = (k, x0, z0, s, v) => {
    const sx = 2.0 * s, sz = 1.6 * s, [x, z] = flatSpot(x0, z0, sx * 0.4, sz * 0.4, 5);
    let lo = 1e9, hi = -1e9; for (const [a, c] of [[0, 0], [-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { const h = TH(x + a * sx, z + c * sz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (hi - lo > 0.5 * 1.25 * s || !clearAt(x, z, sx / 2, sz / 2)) return;       // çevrede düz / boş yer yok (dik yamaç, başka siper): kaya yarı gömülü / iç içe kalırdı → konmaz
    site(k, x, z, (b, g) => N.rock(b, v, 0, 0, sx, 1.25 * s, sz, 0, { seat: gmin(g.gy, 0, 0, sx * 0.35, sz * 0.35) }));
  };
  // devrik kütük: eğimi az olan eksen boyunca (eş yükselti çizgisine yakın), boy eğime göre kısalır; ekseni en alçak ucun 0,05 m altında (yarı oturur)
  const coverLog = (k, x0, z0, len0) => {
    const ax = flatSpot(x0, z0, len0 * 0.5, 0.3, 5), az = flatSpot(x0, z0, 0.3, len0 * 0.5, 5);
    const rng2 = (p, hx, hz) => { let lo = 1e9, hi = -1e9; for (const [a, c] of [[0, 0], [-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) { const h = TH(p[0] + a, p[1] + c); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
    const useX = rng2(ax, len0 * 0.5, 0.3) <= rng2(az, 0.3, len0 * 0.5), [x, z] = useX ? ax : az;
    if (Math.min(rng2(ax, 1.0, 0.3), rng2(az, 0.3, 1.0)) > 0.35) return;           // 2 m'lik kütüğe bile düz yer yok (dik yamaç): konmaz
    if (!clearAt(useX ? ax[0] : az[0], useX ? ax[1] : az[1], useX ? len0 / 2 : 0.35, useX ? 0.35 : len0 / 2)) return;
    site(k, x, z, (b, g) => {
    const span = (axn, L) => { const a = axn === 'x' ? [g.gy(-L / 2, 0), g.gy(L / 2, 0)] : [g.gy(0, -L / 2), g.gy(0, L / 2)]; return Math.abs(a[0] - a[1]); };
    const axis = useX ? 'x' : 'z';
    let len = len0; while (len > 2.0 && span(axis, len) > 0.3) len -= 0.2;
    const gg = gmin(g.gy, 0, 0, axis === 'x' ? len / 2 : 0.2, axis === 'x' ? 0.2 : len / 2);
    P.log(b, 0, gg + 0.25, 0, len, axis, 0.3);
  }); };
  coverRock('siper-1', -47, -6.5, 1.4, 0); coverRock('siper-2', -54.5, 4.0, 1.2, 1); coverRock('siper-3', -43, 4, 1.0, 1);
  coverRock('siper-4', -39, -12.5, 1.3, 2); coverRock('siper-5', -31, -2.4, 1.0, 3); coverRock('siper-6', -32, 11.5, 1.3, 4);
  coverRock('siper-7', -41, 13, 1.0, 5); coverRock('siper-8', -59.5, -30.5, 1.3, 0); coverRock('siper-9', -48.5, -28.6, 1.2, 1);
  coverLog('siper-10', -40.6, -37.6, 3.2); coverLog('siper-11', -65.5, 31, 3.4); coverRock('siper-12', -57.5, 43.5, 1.3, 2);
  coverRock('siper-13', -55, 23.5, 1.2, 3); coverRock('siper-14', -8.0, -14.6, 1.0, 4); coverRock('siper-15', -9.6, -32.4, 1.3, 5);
  coverRock('siper-16', -9.8, -18.8, 1.0, 0); coverRock('siper-17', -14.2, -26.2, 1.2, 1); coverRock('siper-18', -15.5, -30, 1.1, 2);
  coverRock('siper-19', -8.2, 31.8, 1.3, 2); coverLog('siper-20', -11.4, 31.6, 3.2); coverRock('siper-21', -6.6, 19.2, 1.2, 3);

  // ───────── yol boyunca fener direkleri (gece yol gösterir) ─────────
  const _o = {};
  const trailD = (x, z) => { let best = 99; for (const t of L.TRAILS) { const q = t.near(x, z, _o); if (q && q.d - t.w / 2 < best) best = q.d - t.w / 2; } return best; };
  const allCols = () => CH.flatMap((b) => b.colliders);
  const colliders0 = allCols;
  const hitCol = (cols, x, z, r) => cols.some((c) => x + r > c.min[0] && x - r < c.max[0] && z + r > c.min[2] && z - r < c.max[2]);
  {
    const cols = allCols();
    for (const t of L.TRAILS) {
      const gap = { merkez: 15, guney: 17, kuzey: 21, kuzeyGecit: 20, guneyGecit: 20, tepeRampa: 22, mezraAmbar: 22 }[t.name];
      if (!gap) continue;
      let acc = gap * 0.5, alt = 1;
      for (let i = 1; i < t.p.length - 1; i++) {
        acc += t.step; if (acc < gap) continue;
        acc = 0; alt = -alt;
        const [px, pz] = t.p[i], [qx, qz] = t.p[i + 1], dl = Math.hypot(qx - px, qz - pz) || 1;
        const x = px + (-(qz - pz) / dl) * (t.w / 2 + 0.7) * alt, z = pz + ((qx - px) / dl) * (t.w / 2 + 0.7) * alt;
        if (Math.abs(x) > 86 || Math.abs(z) > 58 || L.padAt(x, z, 0.6) || Math.abs(x - L.riverX(z)) < 9 || hitCol(cols, x, z, 0.8) || trailD(x, z) < 0.3) continue;
        const b = chunk(x, z);
        b.obj('fener:' + t.name + (t.side > 0 ? 'm' : 'k') + ':' + i, () => b.with(x, TH(x, z), z, 0, () => P.lantern(b, 3.1)));
      }
    }
  }

  // ═════════ DOĞA: ağaçlar (örnekli), çalılar, serpiştirilmiş kayalar, çimen / çiçek / kamış / çakıl ═════════
  // çarpışma ızgarası (yapılar kuruldu): ağaç / kaya yapıya, patikaya, köprüye, suya girmez
  const occ = new Map(), OC = 3;
  const occAdd = (x0, z0, x1, z1) => { for (let i = Math.floor(x0 / OC); i <= Math.floor(x1 / OC); i++) for (let j = Math.floor(z0 / OC); j <= Math.floor(z1 / OC); j++) { const k = i + ',' + j; (occ.get(k) || occ.set(k, []).get(k)).push([x0, z0, x1, z1]); } };
  for (const c of allCols()) if (c.max[0] - c.min[0] < 40 && c.max[2] - c.min[2] < 40) occAdd(c.min[0], c.min[2], c.max[0], c.max[2]);
  const occHit = (x, z, r) => { for (let i = Math.floor((x - r) / OC); i <= Math.floor((x + r) / OC); i++) for (let j = Math.floor((z - r) / OC); j <= Math.floor((z + r) / OC); j++) for (const q of occ.get(i + ',' + j) || []) if (x + r > q[0] && x - r < q[2] && z + r > q[1] && z - r < q[3]) return true; return false; };
  const inBowl = (x, z, m = 0) => [1, -1].some((sg) => Math.abs(x - sg * L.BOWL.cx) < L.BOWL.hx + m && Math.abs(z - sg * L.BOWL.cz) < L.BOWL.hz + m);
  const nearBridge = (x, z) => (Math.abs(x) < 14 && Math.abs(z) < 6) || [-46, 46].some((bz) => Math.abs(x - L.riverX(bz)) < 14 && Math.abs(z - bz) < 4.5);
  const okGround = (x, z, { trailM = 1.9, padM = 2.2, slope = 0.95 } = {}) => {
    const h = TH(x, z);
    if (h < 0.35 || h > 46) return false;
    if (T.slopeAt(x, z, 1) > slope) return false;
    if (Math.abs(x - L.riverX(z)) < (Math.abs(z) < 34 ? 8.5 : 5.5)) return false;
    if (Math.abs(x) < 92 && Math.abs(z) < 62) {
      if (L.padAt(x, z, padM)) return false;
      if (trailD(x, z) < trailM) return false;
      if (inBowl(x, z, 2)) return false;
      if ([-26, 26].some((fz) => Math.hypot(x - L.riverX(fz), z - fz) < 13)) return false;
      if (nearBridge(x, z)) return false;
    }
    return true;
  };
  const inst = new N.Instancer(120, { pineFar: 400, oakFar: 400, birchFar: 400, tuft: 400, flower: 400, reed: 400, pebble: 400, bush: 400 });     // tür başına 1–4 ağ
  const sight = [];
  const solids = [];                                   // denetim: örnekli gövdeler (sekizgen kesik koni) → tarayıcısız taramada katı sayılır
  const trunkY = (x, z, r) => { let lo = TH(x, z); for (let k = 0; k < 8; k++) lo = Math.min(lo, TH(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r)); return lo - 0.04; };
  const leafCols = { pine: ['#2f5a2c', '#34632f', '#2a4f28', '#3b6a34'], oak: ['#4f7a33', '#5d8a3a', '#557f36', '#6b9a3f'], birch: ['#7aa04a', '#8aaa52', '#6f9a44'] };
  const placeTree = (kind, x, z, s, far) => {
    const r0 = N.TRUNK[kind][0] * s, y = trunkY(x, z, r0), ry = rngV() * PI * 2;
    const lc = leafCols[kind][Math.floor(rngV() * leafCols[kind].length)];
    if (far) { inst.add(kind + 'Far', x, y, z, ry, s, lc); return; }
    inst.add(kind, x, y, z, ry, s, lc);
    const b = chunk(x, z);
    b.obj('ağaç:' + nTrees, () => N.trunkCollide(b, x, y, z, s, kind));
    const [rb, rt, th] = N.TRUNK[kind];
    solids.push({ oid: 'ağaç:' + nTrees, trunk: [x, y, z, rb * s, rt * s, th * s] });
    for (const q of N.TREE[kind].sight) {
      const c = Math.cos(ry), sn = Math.sin(ry);
      sight.push([+(x + (q[0] * c + q[2] * sn) * s).toFixed(2), +(y + q[1] * s).toFixed(2), +(z + (-q[0] * sn + q[2] * c) * s).toFixed(2), +(q[3] * s).toFixed(2)]);
    }
    occAdd(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
  };
  let nTrees = 0, nIn = 0, nOut = 0;
  const tgrid = new Map();
  const tnear = (x, z, r) => { const gx = Math.floor(x / 4), gz = Math.floor(z / 4); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of tgrid.get((gx + i) + ',' + (gz + j)) || []) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < r * r) return true; return false; };
  const treg = (x, z) => { const k = Math.floor(x / 4) + ',' + Math.floor(z / 4); (tgrid.get(k) || tgrid.set(k, []).get(k)).push([x, z]); };
  // önce kayalar (ağaçlar kayaya girmesin), sonra ağaçlar
  // serpiştirilmiş kayalar (çarpışmalı; uzun görüş hatlarını böler) + dış dekor kayaları (çarpışmasız)
  let nRock = 0;
  for (let i = 0; i < 2400 && nRock < 150; i++) {
    const x = -150 + rng() * 300, z = -120 + rng() * 240;
    const inside = Math.abs(x) < 89 && Math.abs(z) < 59, solid = Math.abs(x) < 95 && Math.abs(z) < 65;     // sınıra yakın dekor kaya da çarpışmalı (görseli alana taşabilir)
    if (inside && nRock >= 80) continue;
    const s = (0.9 + rng() * 1.4) * (inside ? 1 : 1.8), sx = s * (1.6 + rng() * 0.6), sz = s * (1.2 + rng() * 0.6), sy = s * (0.8 + rng() * 0.5);
    if (!okGround(x, z, { trailM: 1.6 + Math.max(sx, sz) * 0.5, padM: 1.5 + Math.max(sx, sz) * 0.5, slope: inside ? 0.6 : 1.3 })) continue;
    if (inside) { let lo = 1e9, hi = -1e9; for (const [a, c] of [[0, 0], [-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { const h = TH(x + a * sx, z + c * sz); lo = Math.min(lo, h); hi = Math.max(hi, h); } if (hi - lo > 0.4 * sy) continue; }      // yamaçta kaya yarı gömülü kalmasın
    if (tnear(x, z, Math.max(sx, sz) * 0.75 + 0.6) || (inside && (occHit(x, z, Math.max(sx, sz) * 0.55 + 0.4) || (Math.abs(z) < 8 && Math.abs(x) < 30)))) continue;
    const b = chunk(x, z), q90 = Math.floor(rng() * 4), v = Math.floor(rng() * 6);
    const hx = (q90 % 2 ? sz : sx) * 0.5, hz = (q90 % 2 ? sx : sz) * 0.5;
    const seat = Math.min(TH(x, z), TH(x - hx * 0.7, z - hz * 0.7), TH(x + hx * 0.7, z - hz * 0.7), TH(x - hx * 0.7, z + hz * 0.7), TH(x + hx * 0.7, z + hz * 0.7));
    b.obj('kaya:' + nRock, () => N.rock(b, v, x, z, sx, sy, sz, q90, { seat, collide: solid }));
    occAdd(x - hx, z - hz, x + hx, z + hz);
    treg(x, z); nRock++;
  }
  for (let i = 0; i < 60000 && nTrees < 1700; i++) {
    const x = -150 + rng() * 300, z = -120 + rng() * 240;
    const az = Math.abs(z), ax = Math.abs(x), inside = ax < 91 && az < 61;
    if (inside ? nIn >= 760 : nOut >= 900) continue;
    if (inside && (ax > 88.8 || az > 58.8)) continue;                         // sınırın 1,2 m yakınında gövde yok (sınır kıskacı gövdeye itmesin)
    let dens = 0.05 + 0.92 * smoothstep(20, 40, az);
    if (az < 20 && ax < 85) dens *= 0.35 + 0.65 * smoothstep(8, 20, az);
    if (!inside) dens = 0.42 * (1 - smoothstep(110, 150, Math.max(ax * 0.9, az * 1.2)));
    if (rng() > dens) continue;
    if (!okGround(x, z)) continue;
    if (tnear(x, z, inside ? 2.7 : 3.4)) continue;
    if (occHit(x, z, inside ? 1.4 : 1.2)) continue;
    const s = 0.85 + rng() * 0.75;
    const r = rng(), kind = az > 26 || !inside ? (r < 0.78 ? 'pine' : r < 0.9 ? 'birch' : 'oak') : (r < 0.4 ? 'oak' : r < 0.62 ? 'birch' : 'pine');
    placeTree(kind, x, z, s, !inside);
    treg(x, z); nTrees++; if (inside) nIn++; else nOut++;
  }
  // çalılar (yumuşak örtü: bot görüşünü keser, mermi / oyuncu geçer)
  let nBush = 0;
  for (let i = 0; i < 1200 && nBush < 300; i++) {
    const x = -90 + rng() * 180, z = -60 + rng() * 120;
    if (!okGround(x, z, { trailM: 1.2, padM: 1.0 }) || tnear(x, z, 1.4) || occHit(x, z, 0.9)) continue;
    const s = 0.75 + rng() * 0.55, y = TH(x, z) - 0.05;
    inst.add('bush', x, y, z, rng() * 6.28, s, rng() > 0.5 ? '#4f7a33' : '#5d8a3a');
    sight.push([+x.toFixed(2), +(y + 0.42 * s).toFixed(2), +z.toFixed(2), +(0.66 * s).toFixed(2)]);
    treg(x, z); nBush++;
  }
  // çimen tutamı, çiçek, kıyı kamışı / çakılı (çarpışmasız, gölgesiz)
  if (VIS) {
    const grassCols = ['#7ea23e', '#97b94c', '#628a35', '#a9b852'];
    let n = 0;
    for (let i = 0; i < 9000 && n < 1500; i++) {
      const x = -92 + rngV() * 184, z = -62 + rngV() * 124, h = TH(x, z);
      if (h < 0.25 || T.slopeAt(x, z, 0.8) > 0.55 || L.padAt(x, z, 0.4) || trailD(x, z) < 0.25 || inBowl(x, z, -1) || occHit(x, z, 0.4)) continue;
      const k = 2 + Math.floor(rngV() * 2), col = grassCols[Math.floor(rngV() * grassCols.length)];
      for (let j = 0; j < k; j++) { const px = x + (rngV() - 0.5) * 0.8, pz = z + (rngV() - 0.5) * 0.8; inst.add('tuft', px, TH(px, pz) - 0.03, pz, rngV() * 6.28, 0.8 + rngV() * 0.5, col); }
      n++;
    }
    const flowerCols = ['#f2e46a', '#ee6f9c', '#f6f2ea', '#a98be8', '#ff9b4a'];
    for (let i = 0; i < 110; i++) {
      const cx = -85 + rngV() * 170, cz = -40 + rngV() * 80;
      if (TH(cx, cz) < 0.4 || T.slopeAt(cx, cz, 1) > 0.35 || L.padAt(cx, cz, 1) || trailD(cx, cz) < 0.8 || inBowl(cx, cz, -1)) continue;
      const col = flowerCols[Math.floor(rngV() * flowerCols.length)];
      for (let j = 0; j < 9; j++) { const a = rngV() * 6.28, d = Math.sqrt(rngV()) * 2.2, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (trailD(x, z) < 0.3 || occHit(x, z, 0.2)) continue; inst.add('flower', x, TH(x, z) - 0.02, z, rngV() * 6.28, 0.9 + rngV() * 0.3, col); }
    }
    for (let i = 0; i < 900; i++) {
      const z = -62 + rngV() * 124, sd = rngV() > 0.5 ? 1 : -1, x = L.riverX(z) + sd * (3.4 + rngV() * 4.2), h = TH(x, z);
      if (h < -0.35 || h > 0.7 || nearBridge(x, z) || occHit(x, z, 0.3)) continue;
      if (rngV() > 0.5) inst.add('pebble', x, h - 0.02, z, rngV() * 6.28, 0.8 + rngV() * 0.8, rngV() > 0.5 ? '#8f8d85' : '#a5a296');
      else inst.add('reed', x, h - 0.08, z, rngV() * 6.28, 0.8 + rngV() * 0.4, '#6f9a3c');
    }
  }

  // ═════════ DOĞUŞ NOKTALARI ═════════
  const cols = allCols();
  const spawns = { blue: [], red: [] };
  const bz = L.BASE_ZONES.blue, cands = [];
  for (let x = bz.minX + 6; x <= bz.maxX - 1; x += 1.0) for (let z = bz.minZ + 1.5; z <= bz.maxZ - 1.5; z += 1.0) cands.push([x, z]);
  const blocked = (x, z, side) => {
    const wx = side * x, wz = side * z, g = TH(wx, wz);
    if (T.slopeAt(wx, wz, 0.5) > 0.25) return true;
    for (const c of cols) { if (wx + 1.0 < c.min[0] || wx - 1.0 > c.max[0] || wz + 1.0 < c.min[2] || wz - 1.0 > c.max[2]) continue; if (c.max[1] > g + 0.2 && c.min[1] < g + 1.9) return true; }
    return false;
  };
  for (const side of [1, -1]) {
    const free = cands.filter(([x, z]) => !blocked(x, z, side));
    const core = [-69, 0], picked = [];
    free.sort((p, q) => Math.hypot(p[0] - core[0], p[1] - core[1]) - Math.hypot(q[0] - core[0], q[1] - core[1]));
    for (const p of free) { if (picked.length >= 20) break; if (picked.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.6)) picked.push(p); }
    for (const [x, z] of picked) spawns[side > 0 ? 'blue' : 'red'].push({ x: side * x, z: side * z, ry: side > 0 ? -PI / 2 : PI / 2, y: TH(side * x, side * z) });
  }
  const objectives = [
    { id: 'ambar', name: 'Ambar', x: L.OBJ.ambar[0], z: L.OBJ.ambar[1], r: 10 },
    { id: 'tepe', name: 'Gözetleme Tepesi', x: L.OBJ.tepe[0], z: L.OBJ.tepe[1], r: 9, core: true },
    { id: 'kopru', name: 'Köprü', x: 0, z: 0, r: 11, core: true },
    { id: 'kamp', name: 'Orman Kampı', x: L.OBJ.kamp[0], z: L.OBJ.kamp[1], r: 10, core: true },
    { id: 'degirmen', name: 'Değirmen', x: L.OBJ.degirmen[0], z: L.OBJ.degirmen[1], r: 10 },
  ];
  // bölge adları (P tuşu, minimap) — iki yarı
  const callouts = [];
  const co = (name, x, z, major = false) => callouts.push({ name, x, z, ...(major ? { major: true } : {}) });
  co('Mavi Çiftlik', -76, 0, true); co('Kırmızı Çiftlik', 76, 0, true); co('Köprü', 0, 0, true);
  co('Ambar', -24, 26, true); co('Değirmen', 24, -26, true); co('Gözetleme Tepesi', -22, -40, true); co('Orman Kampı', 22, 40, true);
  co('Batı Köprübaşı', -17, 0); co('Doğu Köprübaşı', 17, 0); co('Kuzey Geçit', -2, -26); co('Güney Geçit', 2, 26);
  co('Kuzey Köprüsü', -2, -46); co('Güney Köprüsü', 2, 46); co('Kuzey Mezra', -39, -20); co('Güney Mezra', 39, 20);
  co('Batı Şikan', -48, 0); co('Doğu Şikan', 48, 0); co('Kuzey Sırtı', -40, -51); co('Güney Sırtı', 40, 51); co('Kuzey Sırtı', 30, -50); co('Güney Sırtı', -30, 50);
  co('Gizli Kamp', -47, -43); co('Gizli Kamp', 47, 43); co('Gizli Kamp', -69, 37); co('Gizli Kamp', 69, -37);
  co('Yıkık Ev', -9, 41); co('Yıkık Ev', 9, -41); co('Kulübe', -45, 29); co('Kulübe', 45, -29);
  const roamPoints = [[0, 0], [-2.4, -26], [2.4, 26], [-17, 0], [17, 0], [-40, -51], [40, 51], [-46, 0], [46, 0], [-39, -20], [39, 20], [-2, -46], [2, 46]];
  // herkes-tek (ölüm maçı / silah yarışı) doğuşları: oyunun varsayılan havuzu yol ızgarasının 'deck' hücrelerini de alıyordu → asma köprünün ALTINDA
  // (kanyon tabanında) doğulup orada kalınıyordu. Harita kendi havuzunu verir: kuru, düz, açık zemin; köprü / tabliye altı değil; 12 m aralık; aynası da.
  const ffaSpawns = [];
  {
    const decks = colliders0().filter((c) => c.tag === 'deck');
    const under = (x, z) => decks.some((c) => x > c.min[0] - 1.5 && x < c.max[0] + 1.5 && z > c.min[2] - 1.5 && z < c.max[2] + 1.5 && c.max[1] > TH(x, z) + 0.5);
    const flatOk = (x, z) => { let lo = 1e9, hi = -1e9; for (const [a, c] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) { const h = TH(x + a, z + c); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo < 0.45; };
    const openDirs = (x, z) => { let n = 0; for (let a = 0; a < 8; a++) { let ok = true; for (let r = 1; r <= 4 && ok; r += 1) { const px = x + Math.cos(a * 0.785) * r, pz = z + Math.sin(a * 0.785) * r; if (occHit(px, pz, 0.35) || T.slopeAt(px, pz, 0.6) > 0.9 || TH(px, pz) < 0.3) ok = false; } if (ok) n++; } return n; };
    const cand = [];
    for (let x = -86; x <= 0; x += 2.5) for (let z = -56; z <= 56; z += 2.5) {
      if (TH(x, z) < 0.4 || !flatOk(x, z) || occHit(x, z, 1.2) || under(x, z) || openDirs(x, z) < 3) continue;
      cand.push([x, z]);
    }
    // en uzak nokta seçimi (deterministik): mavi yarıda 20 nokta, kırmızı yarıda aynası
    const pick = [[-40, 0]];
    while (pick.length < 21) {
      let best = null, bd = -1;
      for (const p of cand) { let d = 1e9; for (const q of pick) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1])); if (d > bd) { bd = d; best = p; } }
      if (!best || bd < 9) break;
      pick.push(best);
    }
    for (const [x, z] of pick.slice(1)) for (const sg of [1, -1]) ffaSpawns.push({ x: sg * x, z: sg * z, y: TH(sg * x, sg * z), ry: Math.atan2(sg * x, sg * z) });
  }

  // ═════════ GÖRSEL ═════════
  const groups = CH.map((b) => b.build());
  const colliders = CH.flatMap((b) => b.colliders);
  for (const b of CH) sight.push(...b.sight);
  const group = new THREE.Group();
  for (const g of groups) if (g.children.length) group.add(...g.children);
  let fx = null;
  if (VIS) {
    // arazi (köşe rengi + gölgelendirici ağırlıkları)
    const grassA = new THREE.Color('#86a84c'), grassB = new THREE.Color('#6c8d3f'), grassC = new THREE.Color('#93ab58'), dry = new THREE.Color('#aaa462');
    const forest = new THREE.Color('#567834'), forestD = new THREE.Color('#46652c'), needle = new THREE.Color('#6b6a3e');
    const dirt = new THREE.Color('#ad8c60'), dirtWet = new THREE.Color('#8a6f48'), yard = new THREE.Color('#a08b5e');
    const rockA = new THREE.Color('#8a867c'), rockB = new THREE.Color('#78756c'), rockC = new THREE.Color('#9b9486'), snow = new THREE.Color('#dfe1de');
    const sand = new THREE.Color('#c3b48a'), wet = new THREE.Color('#7d6c4a'), field = new THREE.Color('#c9b25e');
    const tmp = new THREE.Color();
    const tm = terrain.buildMesh((x, z, h, slope, c) => {
      const n1 = fbm(x * 0.05, z * 0.05, 4, 3), n2 = fbm(x * 0.17 + 9, z * 0.17, 12, 2), n3 = fbm(x * 0.012, z * 0.012, 5, 2);
      const az = Math.abs(z), dx = Math.abs(x - L.riverX(z));
      c.copy(grassA).lerp(grassB, n1);
      if (n2 > 0.62) c.lerp(grassC, (n2 - 0.62) * 2.2);
      if (n3 > 0.58) c.lerp(dry, Math.min(0.7, (n3 - 0.58) * 3.0));
      const out = smoothstep(86, 100, Math.abs(x)) + smoothstep(58, 72, az);
      const fo = Math.min(1, Math.max(smoothstep(26, 46, az), out));
      c.lerp(forest, fo * 0.72);
      if (fo > 0.2 && n2 > 0.5) c.lerp(forestD, 0.33 * fo);
      if (fo > 0.4 && n2 < 0.28) c.lerp(needle, 0.45);
      const rk = 0.95 + 0.25 * Math.min(1, out);                 // kaya rengi yalnız gerçek yarda (düzlük şevi / yol kesiği çimen-toprak kalır)
      if (slope > rk) { tmp.copy(n2 > 0.5 ? rockA : rockB); if (n1 > 0.62) tmp.lerp(rockC, 0.5); c.lerp(tmp, Math.min(1, (slope - rk) * 2.2)); }
      if (h > 30) c.lerp(rockA, smoothstep(30, 44, h) * 0.7);
      if (h > 48) c.lerp(snow, smoothstep(48, 64, h) * 0.85);
      // avlu / düzlük toprağı: kenardan 3 m'de sönen yumuşak ton (dikdörtgen yama kenarı görünmez)
      let yw = 0;
      for (const p of L.PADS) { const dd = Math.max(p.x0 - x, x - p.x1, p.z0 - z, z - p.z1); if (dd < 3) yw = Math.max(yw, 1 - smoothstep(-2.5, 3, dd)); }
      for (const sg of [1, -1]) { const dd = Math.max(Math.abs(x - sg * L.BOWL.cx) - L.BOWL.hx, Math.abs(z - sg * L.BOWL.cz) - L.BOWL.hz); if (dd < 6) yw = Math.max(yw, 1.2 * (1 - smoothstep(-6, 6, dd))); }
      if (yw > 0) c.lerp(yard, Math.min(0.42, yw * 0.3 * (0.75 + 0.5 * n2)));
      const td = trailD(x, z);
      if (td < 0.9) {
        const road = td < 0 ? 1 : 0, k = 1 - smoothstep(-1.0, 0.4 + (n2 - 0.5), td);
        tmp.copy(dirt).lerp(yard, n2 * 0.4); if (td > -0.6) tmp.lerp(dirtWet, 0.3);
        c.lerp(tmp, Math.min(1, k * 0.95 + road * 0));
      }
      if (h < L.WATER_LEVEL + 0.2 && dx < 12) c.copy(sand).lerp(rockA, 0.1 + n2 * 0.25);
      else if (h < L.WATER_LEVEL + 0.6 && slope < 0.6 && dx < 12) c.lerp(wet, 0.5 * (1 - (h - L.WATER_LEVEL - 0.2) / 0.4));
      const fr = (((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1;
      c.multiplyScalar(0.94 + 0.12 * fr);
    }, {
      smooth: true, jitter: 0.015,
      aux: (x, z, h) => [1 - smoothstep(-0.7, 0.7, trailD(x, z)), h > 1.2 ? 0 : 1 - smoothstep(L.WATER_LEVEL + 0.08, L.WATER_LEVEL + 0.7, h), smoothstep(0.95, 1.4, terrain.slopeAt(x, z, 1)), 0],
    });
    // aAux 3 → 4 bileşen (tarla ağırlığı, şimdilik 0)
    const a3 = tm.geometry.attributes.aAux.array, a4 = new Float32Array(a3.length / 3 * 4);
    for (let i = 0, j = 0; i < a3.length; i += 3, j += 4) { a4[j] = a3[i]; a4[j + 1] = a3[i + 1]; a4[j + 2] = a3[i + 2]; a4[j + 3] = 0; }
    tm.geometry.setAttribute('aAux', new THREE.BufferAttribute(a4, 4));
    tm.material = makeVadiGroundMaterial();
    group.add(tm);
    group.add(riverMesh(terrain, L.riverX, L.WATER_LEVEL));
    for (const m of inst.build(N.instDefs())) group.add(m);
    group.add(farRing());
    // değirmen kanatları (ayrı küçük ağ, yavaşça döner)
    const sails = [];
    for (const s of SAILS) {
      const geo = mergeGeometries(BLD.sailGeometry(THREE), false);
      const mesh = new THREE.Mesh(geo, makeInstMaterial(VK.WOOD));
      mesh.material.color.set('#d8cbb0');
      const piv = new THREE.Object3D();
      const hub = new THREE.Vector3(...s.local.hub).applyMatrix4(s.M);
      piv.position.copy(hub);
      // dönme ekseni: windmill yüzü yerel 'e' → yerel x; dünyada M'nin x ekseni
      const ax = new THREE.Vector3(1, 0, 0).transformDirection(s.M);
      piv.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ax);
      mesh.position.set(0, 0, 0.42);
      mesh.castShadow = true;
      piv.add(mesh); group.add(piv); sails.push(mesh);
    }
    fx = { update: (t) => { for (const m of sails) m.rotation.z = t * 0.35; } };
  }
  // denetim verisi (scripts/vadiscan.mjs): nehir ekseni, patikalar, örnekli gövdeler
  const audit = { riverX: L.riverX, trails: L.TRAILS, waterLevel: L.WATER_LEVEL, solids, pads: L.PADS, allMain: true };

  // minimap yolları
  const roads = [];
  for (const t of L.TRAILS) {
    if (t.w < 4.3) continue;
    for (let i = 0; i < t.p.length; i += 2) { const [x, z] = t.p[i]; if (Math.abs(x) > 90 || Math.abs(z) > 60) continue; roads.push({ x0: x - 1.4, z0: z - 1.4, x1: x + 1.4, z1: z + 1.4 }); }
  }
  return {
    id: 'vadi', name: 'Vadi', group, colliders, sight, bounds: L.BOUNDS, terrain, spawns, baseZones: L.BASE_ZONES, objectives, callouts, roamPoints, ffaSpawns,
    roads, roadColor: '#ad8c60', fx, audit,
    editSkipped: CH.flatMap((b) => b.editSkipped || []),
    env: {
      sky: ['#5f9fdc', '#c3dcef', '#f2e6cc'], fog: ['#e3e2d4', 170, 430],
      sun: ['#ffe0ae', 2.8], hemi: ['#cfe3ff', '#8f7d52', 1.1], cloud: '#fff6e8', clouds: 22,
      sunPos: [75, 70, 30],
    },
  };
}
// uzak dağ halkası (yalnız görsel): r 230…330 m, sis rengine karışan alçak poligon silüet, harita kenarındaki arazi kesiğini ve gökyüzü boşluğunu kapatır
function farRing() {
  const N = 72, R0 = 225, R1 = 330, pos = [], col = [];
  const c0 = new THREE.Color('#6f7f66'), c1 = new THREE.Color('#9aa39a'), cs = new THREE.Color('#e4e6e2');
  const hAt = (a) => 55 + 45 * fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 33, 3) + 30 * Math.max(0, Math.sin(a * 3.0 + 1.1)) ** 3;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const p = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const h0 = hAt(a0), h1 = hAt(a1), ym = -10;
    const A = p(a0, R0, ym), B = p(a1, R0, ym), C = p(a1, R1, h1), D = p(a0, R1, h0), Cm = p(a1, (R0 + R1) / 2, h1 * 0.55), Dm = p(a0, (R0 + R1) / 2, h0 * 0.55);
    const quad = (q1, q2, q3, q4, ca, cb) => { pos.push(...q1, ...q2, ...q3, ...q1, ...q3, ...q4); for (const cc of [ca, ca, cb, ca, cb, cb]) col.push(cc.r, cc.g, cc.b); };
    quad(A, B, Cm, Dm, c0, c1);
    quad(Dm, Cm, C, D, c1, cs);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
  m.receiveShadow = false; m.castShadow = false;
  return m;
}
