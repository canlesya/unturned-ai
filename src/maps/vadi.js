import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as V from './kitVadi.js';
import { Terrain, fbm, smoothstep, WATER_LEVEL } from './terrain.js';
import { VADI_BOUNDS, riverX, vadiHeight, TRAILS, PADS, addPad, finalizeLayout, layoutReady, BOWL, BASE_ZONES, OBJ, SADDLE_Y } from './vadiLayout.js';

export { VADI_BOUNDS, vadiHeight };

// Harita 2 — VADİ (v2)
// Doğu-batı vadi, ortada kuzey-güney nehir kanyonu. Mavi (batı) ve Kırmızı (doğu) çanaklar sırtlarla görüş hattından gizlenmiştir;
// çanaktan üç yol çıkar: kuzey patika (orman/sırt, keskin nişancı), merkez şikan yolu (köprü, ağır çatışma),
// güney geçit (Ambar/ahır kanadı, sığ geçit). Harita 180° dönme simetriktir (yerleşimler iki yarıda da var).

const PI = Math.PI;

export function buildVadi() {
  const b = new MapBuilder();
  const dec = new MapBuilder();            // dekor katmanı (çimen/çiçek/taş): çarpışmasız, gölge düşürmez
  const rng = makeRng(2024);
  const rngD = makeRng(77);
  let T = null;                            // Terrain (pass 2'de hazır)

  // ───────── Yerleşim planı: S(x,z,ry,[padHx,padHz],fn,{sides}) — mavi yarı koordinatları, dönmüş kopya otomatik ─────────
  // fn({side, gy}) yerel çerçevede (orijin = zemin) çizer; side +1 = mavi yarı, −1 = kırmızı yarı.
  const plan = (S) => {
    const TEAM = (sd) => (sd > 0 ? { main: '#2c5aa0', wall: '#35577f', roofA: '#5b6f8a' } : { main: '#b0332a', wall: '#9a3a2e', roofA: '#8a4b3f' });
    // bina + taş temel (yamaçta zemin düştüğünde bina havada kalmasın)
    const house = (o) => { b.box(o.x, -2.4, o.z, o.w + 0.5, 2.4, o.d + 0.5, '#86817a', { collide: false }); K.house(b, rng, o); };
    const barn = (o) => { b.box(o.x, -2.4, o.z, (o.w || 12) + 0.5, 2.4, (o.d || 18) + 0.5, '#86817a', { collide: false }); K.barn(b, rng, o); };
    const cover = (x, z, kind = 'rock', s = 1.2) => S(x, z, 0, [0, 0], () => (kind === 'rock' ? V.rock(b, rng, 0, 0, s) : V.fallenLog(b, 0, 0, 3.4, s)));

    // ═════════ DOĞUŞ ÇANAĞI (çiftlik): ahır, silolar, çiftlik evi, traktör, saman ═════════
    S(-80, -8, 0, [8, 8.5], (g) => barn({ x: 0, z: 0, w: 10, d: 12, color: TEAM(g.side).wall, roof: '#5f646c' }));
    S(-84.5, 4, 0, [3.2, 3.2], () => K.silo(b, 0, 0));
    S(-85.8, 10, 0, [2.6, 2.6], () => K.silo(b, 0, 0, 1.7, 8));
    S(-77.5, 11.5, 0, [6.5, 5.8], (g) => house({ x: 0, z: 0, w: 9, d: 7, wall: g.side > 0 ? '#d6cfb4' : '#d9c79a', roof: TEAM(g.side).roofA, door: 'n', floors: 1 }));
    S(-70, -9.5, PI / 2, [0, 0], (g) => V.tractor(b, { color: g.side > 0 ? '#3a6aa8' : '#a8402f' }));
    S(-71.5, 13, 0, [0, 0], () => V.haystack(b, 0, 0, 1));
    S(-68, 14, 0, [0, 0], () => V.haystack(b, 0, 0, 0.8));
    S(-86, -3, 0, [0, 0], () => { for (let i = 0; i < 6; i++) K.hayBale(b, (i % 3) * 1.3 - 1.3, Math.floor(i / 3) * 1.3); });
    S(-73, -13.5, 0, [0, 0], (g) => { K.crate(b, 0, 0, 1.1); K.crate(b, 1.2, 0.2, 1.0); K.crate(b, 0.5, 0.2, 0.9, 1.1); K.barrel(b, 2.4, 0, TEAM(g.side).main); K.barrel(b, 3.1, 0.3, TEAM(g.side).main); });
    S(-63.5, -4.5, PI / 2, [0, 0], () => K.sandbags(b, 0, 0, 4, 0));
    S(-63.5, 3.5, PI / 2, [0, 0], () => K.sandbags(b, 0, 0, 3.4, 0));
    S(-66, -11, 0, [0, 0], () => V.lantern(b, 3.4));
    S(-66, 6.5, 0, [0, 0], () => V.lantern(b, 3.4));
    S(-83, 0, 0, [0, 0], () => V.lantern(b, 3.4));
    S(-75, 0, 0, [0, 0], (g) => {       // takım bayrağı
      b.cyl(0, 0, 0, 0.07, 0.1, 5.2, '#d8d8d2', { seg: 6 });
      b.box(0.62, 3.9, 0, 1.2, 0.8, 0.05, TEAM(g.side).main, { collide: false });
    });
    S(-87, 14, 0, [0, 0], () => K.fence(b, 0, -3, 0, 3));

    // ═════════ KÖPRÜBAŞI MEZRASI ═════════
    S(-17.5, -11, 0, [5.5, 4.8], () => house({ x: 0, z: 0, w: 8, d: 6.5, wall: '#d6cfb4', roof: '#7a3b2e', door: 's', floors: 1 }));
    S(-17.5, 11, 0, [5.5, 4.8], () => house({ x: 0, z: 0, w: 8, d: 6.5, wall: '#c9c1a4', roof: '#5d6a4a', door: 'n', floors: 1 }));
    S(-10.4, -8.6, 0, [4.0, 3.6], () => house({ x: 0, z: 0, w: 5.4, d: 4.6, wall: '#9a948a', roof: '#6a6560', door: 's', floors: 1, flat: true }));   // taş karakol
    S(-10.6, 13.8, 0, [3.6, 6.8], () => b.with(0, 0, -3.6, 0, () => V.tower(b, {})));   // köprübaşı kulesi (merdiven +z yönünde)
    S(-17.5, -3.6, 0, [3, 1.6], () => K.car(b, { x: 0, z: 0, ry: 0, color: '#b33a2a', wreck: true }));
    S(-16, 4.6, 0, [2, 2], () => K.car(b, { x: 0, z: 0, ry: PI, color: '#4a7a4f' }));
    S(-12.6, -5.2, PI / 2, [0, 0], () => K.sandbags(b, 0, 0, 3.4, 0));
    S(-12.6, 5.2, PI / 2, [0, 0], () => K.sandbags(b, 0, 0, 3.4, 0));
    S(-14.5, 0.3, 0, [0, 0], () => K.barrier(b, 0, 0, 0.2));
    S(-27.5, 2, 0, [0, 0], () => K.crate(b, 0, 0, 1.1));
    S(-28, 6, 0, [0, 0], () => { K.barrel(b, 0, 0, '#2c5aa0'); K.barrel(b, 0.8, 0.4, '#d9a921'); });
    S(-12.5, -17.5, 0, [0, 0], () => V.well(b));
    cover(-8.6, -14.5, 'rock', 1.0);
    S(-10.5, -1.6, 0, [0, 0], () => V.lantern(b, 3.2));

    // ═════════ KUZEY MEZRA (kulübeler, avlu duvarları, yıkık yapı, kamyon) ═════════
    S(-33, -17, 0, [4.6, 4.2], () => house({ x: 0, z: 0, w: 6, d: 5, wall: '#8b5a2b', roof: '#4d5b3a', door: 'e', floors: 1 }));
    S(-39, -22, 0, [4.6, 4.2], () => house({ x: 0, z: 0, w: 6, d: 5, wall: '#7d5126', roof: '#3f4a30', door: 's', floors: 1 }));
    S(-30, -23.5, 0, [0, 0], () => V.haystack(b, 0, 0, 1));
    S(-31.5, -11.5, 0, [0, 0], (g) => V.stoneWall(b, g.gy, -3, 0, 3, 0, { h: 0.9 }));
    S(-8, 41, 0, [4.6, 3.6], (g) => V.ruin(b, rng, g.gy, { w: 6.4, d: 4.4 }));

    // güney/kuzey çiftlik kulübesi (çanak çıkışı ile Ambar arasında, ara kademe yerleşim)
    S(-47, 26.5, 0, [4.6, 4.2], () => house({ x: 0, z: 0, w: 6, d: 5, wall: '#a6845a', roof: '#6b3f33', door: 'n', floors: 1 }));
    S(-52, 28.6, 0, [0, 0], () => V.haystack(b, 0, 0, 0.9));
    S(-41.6, 28, 0, [0, 0], () => K.fence(b, 0, -2.4, 0, 2.4));

    // ═════════ AMBAR (mavi) / DEĞİRMEN (kırmızı) — aynı avlu duvarı, farklı yapı ═════════
    S(-24, 25.5, 0, [10.9, 11], (g) => {
      const x0 = -10, x1 = 10, z0 = -10, z1 = 11;
      V.stoneWall(b, g.gy, x0, z0, x1, z0, { gaps: [{ at: 0, w: 5 }] });          // kuzey duvar + kapı
      V.stoneWall(b, g.gy, x0, z1, x1, z1, { gaps: [{ at: -1.5, w: 5 }] });       // güney duvar + kapı
      V.stoneWall(b, g.gy, x0, z0, x0, z1, { gaps: [{ at: -2.5, w: 4.6 }] });     // batı duvar + kapı (güney geçit)
      V.stoneWall(b, g.gy, x1, z0, x1, z1, { gaps: [{ at: 1, w: 5 }] });          // doğu duvar + kapı (geçide)
      if (g.side > 0) {
        barn({ x: 0, z: 0.5, w: 10, d: 14, color: '#7a5a38', roof: '#6a5a4a' });
        for (let i = 0; i < 5; i++) K.hayBale(b, -8 + (i % 3) * 1.3, 8.2 + Math.floor(i / 3) * 1.3);
        b.with(-7.2, 0, -6.5, 0, () => V.tractor(b, { color: '#b7392d' }));
        V.haystack(b, 7.4, -7, 1); V.haystack(b, 7.6, 9, 0.85);
        K.crate(b, 7.6, 6.2, 1.1); K.crate(b, 8.1, 7.4, 1.0);
        b.with(-7.4, 0, 3.5, 0, () => V.cart(b, {}));
      } else {
        house({ x: 4.6, z: -3.6, w: 7, d: 6.5, wall: '#c2bba9', roof: '#6b4a3a', door: 's', floors: 2, floorColor: '#a58a68' });   // değirmen (hedef merkezi avluda açık kalır)
        b.cyl(0.75, 3.0, -3.6, 2.4, 2.4, 0.7, '#6e4a2a', { rz: PI / 2, center: true, seg: 12, collide: false });                    // su çarkı (dekor)
        b.cyl(0.75, 3.0, -3.6, 0.4, 0.4, 1.0, '#4a3220', { rz: PI / 2, center: true, seg: 8, collide: false });
        for (let i = 0; i < 4; i++) b.box(-8 + i * 1.1, 0, -6, 0.9, 0.55 + (i % 2) * 0.2, 0.7, '#cfc4a1');                          // çuvallar
        b.cyl(-6, 0, 7, 1.3, 1.3, 0.45, '#9a948a', { seg: 10 }); b.cyl(-2.5, 0, 8.5, 1.3, 1.3, 0.45, '#8a8479', { seg: 10 });          // değirmen taşları
        V.haystack(b, 7.4, -7.4, 1); V.haystack(b, 7.6, 9, 0.85);
        K.crate(b, 7.6, 6.2, 1.1); K.crate(b, 8.1, 7.4, 1.0); K.barrel(b, -8.5, 9, '#2c5aa0');
        b.with(-7.4, 0, 3.5, 0, () => V.cart(b, { color: '#6a4a2a' }));
      }
      b.with(-3.5, 0, 6, 0, () => V.lantern(b, 3.4));
    }, { y: 1.45 });

    // ═════════ GÖZETLEME TEPESİ (kuzey sırt zirvesi) / ORMAN KAMPI (güney sırt) ═════════
    // Zirveye 4 yol girer: batı (kuzey patika), güney (rampa), doğu (nehir geçidi), kuzey (ledge). Merkez ve koridorlar açık kalır.
    S(-20, -40, 0, [11.5, 9], (g) => {
      if (g.side > 0) {
        g.at(-1.4, 8.8, () => V.rock(b, rng, 0, 0, 1.0)); g.at(8.6, 1.4, () => K.crate(b, 0, 0, 1.1)); g.at(8.6, 2.6, () => K.crate(b, 0, 0, 1.0));
        b.with(6, 0, -3.8, PI / 2, () => V.bunker(b, { w: 6, d: 4.4, ramp: false }));    // mazgal doğuya (vadiye) bakar, giriş batıdan
        g.at(-5.5, -3.8, () => K.crate(b, 0, 0, 1.1)); g.at(-4.4, -3.6, () => K.crate(b, 0, 0, 1.0)); g.at(-6.6, -4.6, () => K.barrel(b, 0, 0, '#4d5b3a'));
        g.at(-9.2, 6.4, () => V.rock(b, rng, 0, 0, 1.3)); g.at(9.4, 6.6, () => V.rock(b, rng, 0, 0, 1.2)); g.at(2.5, 7.6, () => V.rock(b, rng, 0, 0, 1.4));
        b.with(-3.2, 0, 1.2, 0, () => V.lantern(b, 3.4));
      } else {
        // Orman Kampı: çadırlar, ateş, kütük ev, bunker (ağaçlı sırt; gece ateşler yol gösterir)
        b.with(-6.2, 0, -5.8, 0, () => V.tent(b, { color: '#c7b98a' }));
        b.with(-8.6, 0, -2.2, PI / 2, () => V.tent(b, { color: '#b9b184', w: 3.0, len: 3.6 }));
        b.with(-3.4, 0, -4.6, 0, () => V.campfire(b));
        b.with(-8.8, 0, -7.4, 0, () => V.tent(b, { color: '#a7b38a', w: 3.0, len: 3.8 }));
        b.with(6, 0, -3.8, PI / 2, () => V.bunker(b, { w: 6, d: 4.4, ramp: false }));    // mazgal doğuya (vadiye) bakar, giriş batıdan
        b.with(1.4, 0, -0.6, PI / 2, () => V.logPile(b, 0, 2.6));
        b.with(-5.4, 0, 1.4, 0, () => V.fallenLog(b, 0, 0, 3.0, 1.57));
        b.with(-1.2, 0, -7.6, 0, () => V.fallenLog(b, 0, 0, 3.0, 0.2));
        g.at(0.0, -5.0, () => K.crate(b, 0, 0, 1.1)); g.at(1.2, -5.1, () => K.crate(b, 0, 0, 1.0));
        g.at(2.5, 7.8, () => V.rock(b, rng, 0, 0, 1.5)); g.at(-9.4, 6.8, () => V.rock(b, rng, 0, 0, 1.3));
        b.with(-3.0, 0, -2.2, 0, () => V.lantern(b, 3.0));
      }
    });
    // Tepe kulesi (batıya merdivenli): kuzeybatı köşe
    S(-26.5, -46.2, -PI / 2, [3.6, 6.8], (g) => { if (g.side > 0) b.with(0, 0, -3.6, 0, () => V.tower(b, {})); }, { sides: [1] });

    // gizli kamplar (orman bankı): ateş + çadır, gece uzaktan seçilir
    for (const [x, z] of [[-47, -38.5], [-58, 38]]) {
      S(x, z, 0, [5, 4.5], (g) => {
        V.campfire(b);
        b.with(3.4, 0, -1.8, 0, () => V.tent(b, { color: g.side > 0 ? '#9fb0c8' : '#c9a58f', len: 3.8 }));
        V.rock(b, rng, -2.6, 1.4, 1.0); K.crate(b, -2.2, -1.8, 1.0);
        b.with(0.4, 0, 2.6, 0, () => V.fallenLog(b, 0, 0, 2.6, 1.57));
      });
    }

    // ═════════ NEHİR GEÇİTLERİ: taş basamaklar, devrik kütük, siper kayaları, kum torbaları ═════════
    S(-3, -26, 0, [6, 6], () => {
      for (const [x, z] of [[-2, -2.5], [1.5, -1.5], [-0.5, 1.2], [2.6, 2.2], [-3, 2.8]]) b.ico(x, -0.12, z, 0.5, '#8a8a84', { scale: [1.3, 0.6, 1], detail: 0, ry: x });
    }, { noPad: true });
    cover(-7.2, -31, 'rock', 1.3);
    cover(-9.5, -18.5, 'rock', 1.0);
    S(-15.6, -19.8, 0, [0, 0], () => K.sandbags(b, 0, 0, 3.4, 0));
    S(-7.5, -28.6, 0, [0, 0], () => K.sandbags(b, 0, 0, 3.0, 0));
    S(-11.5, -29.6, 0, [0, 0], () => V.fallenLog(b, 0, 0, 4, 0.5));
    cover(-14, -26, 'rock', 1.2);
    S(-10.9, 21.4, 0, [0, 0], () => K.sandbags(b, 0, 0, 3.4, 0));    // güney geçit (dönmüşü kuzeydeki doğu yakası)
    cover(-8, 31.6, 'rock', 1.3);
    S(-11, 31.5, 0, [0, 0], () => V.fallenLog(b, 0, 0, 3.6, 0.3));

    // ═════════ SIRT LEDGE'LERİ: keskin nişancı mevzileri + kaya tünelleri ═════════
    for (const [x, z] of [[-44, -51.2], [-27, -51], [-19, -50.2]]) {
      S(x, z, 0, [0, 0], () => {
        K.sandbags(b, 0, 1.7, 3.4, 0); b.with(2.8, 0, 0.9, 0, () => V.rock(b, rng, 0, 0, 0.9)); K.crate(b, -2.4, 1.0, 1.0);
        b.with(-2.4, 0, -1.2, 0, () => V.lantern(b, 3.0));
      });
    }
    for (const [x, z] of [[-56, 49.2], [-23, 49.3], [-15, 48.2]]) {
      S(x, z, PI, [0, 0], () => {
        K.sandbags(b, 0, 1.7, 3.4, 0); b.with(2.8, 0, 0.9, 0, () => V.rock(b, rng, 0, 0, 0.9)); K.crate(b, -2.4, 1.0, 1.0);
        b.with(-2.4, 0, -1.2, 0, () => V.lantern(b, 3.0));
      });
    }
    S(-52, -50.6, 0, [7, 4.2], (g) => V.rockTunnel(b, rng, g.gy, { len: 9 }));
    S(-33, 50.1, 0, [7, 4.2], (g) => V.rockTunnel(b, rng, g.gy, { len: 9 }));

    // ═════════ ŞİKAN / yamaç patikaları: siper kayaları, kütükler ═════════
    cover(-47, -6.5, 'rock', 1.4);
    cover(-53.5, 6.5, 'rock', 1.2);
    cover(-43, 4, 'log', 0.9);
    cover(-39, -12.5, 'rock', 1.3);
    cover(-31, -2, 'rock', 1.1);
    cover(-31, 11, 'rock', 1.5);
    cover(-41, 13, 'rock', 1.0);
    cover(-58, -29.5, 'rock', 1.3);
    cover(-49, -30.5, 'rock', 1.2);
    cover(-42.5, -37.5, 'log', -0.4);
    cover(-65.5, 31, 'log', 1.2);
    cover(-60.6, 42.4, 'rock', 1.3);
    cover(-50, 22.5, 'rock', 1.3);
    cover(-16.4, 25.2, 'rock', 1.2);
    cover(-6.5, 19, 'rock', 1.3);
  };

  // pass 1: yalnızca düzlükler (pad) kaydet
  if (!layoutReady()) {
    plan((x, z, ry, pad, fn, o = {}) => {
      if (o.noPad || (pad[0] <= 0.5 && pad[1] <= 0.5)) return;
      const sw = Math.abs(Math.round(ry / (PI / 2))) % 2 === 1;
      for (const side of o.sides || [1, -1]) addPad({ x: side * x, z: side * z, hx: sw ? pad[1] : pad[0], hz: sw ? pad[0] : pad[1], fall: o.fall || 3.2, y: o.y ?? null });
    });
  }
  finalizeLayout();
  const H = vadiHeight;

  // ───────── Arazi ─────────
  const terrain = new Terrain({ minX: -184, maxX: 184, minZ: -160, maxZ: 160, cell: 2, height: H });
  T = terrain;

  const _o = {};
  let _tw = 4;
  const trailD = (x, z) => {   // yol yatağına kenar uzaklığı (negatif = yolun içinde); _tw: o yolun genişliği
    let best = 99;
    for (const t of TRAILS) { const q = t.near(x, z, _o); if (q && q.d - t.w / 2 < best) { best = q.d - t.w / 2; _tw = t.w; } }
    return best;
  };
  const padD = (x, z, m = 0) => {   // yapı düzlüklerinin içinde mi (m: ek pay)
    for (const p of PADS) if (Math.abs(x - p.x) < p.hx + m && Math.abs(z - p.z) < p.hz + m) return true;
    return false;
  };

  const grassA = new THREE.Color('#8aab50'), grassB = new THREE.Color('#6f9040'), grassC = new THREE.Color('#93ab58'), dry = new THREE.Color('#aaa65f');
  const forest = new THREE.Color('#587a36'), forestD = new THREE.Color('#47662d'), needle = new THREE.Color('#6e6a3e');
  const dirt = new THREE.Color('#b69364'), dirtWet = new THREE.Color('#8a6f48'), yard = new THREE.Color('#a58f5e');
  const rockA = new THREE.Color('#8b877d'), rockB = new THREE.Color('#77746b'), rockC = new THREE.Color('#9b9486'), snow = new THREE.Color('#d9dbd8');
  const sand = new THREE.Color('#c8b98a'), wet = new THREE.Color('#7d6c4a'), field = new THREE.Color('#cdb45c'), path = new THREE.Color('#a39060');
  const tmp = new THREE.Color();
  const terrainMesh = terrain.buildMesh((x, z, h, slope, c) => {
    const n1 = fbm(x * 0.05, z * 0.05, 4, 3), n2 = fbm(x * 0.17 + 9, z * 0.17, 12, 2), n3 = fbm(x * 0.012, z * 0.012, 5, 2);
    const az = Math.abs(z), dx = x - riverX(z);
    c.copy(grassA).lerp(grassB, n1);
    if (n2 > 0.62) c.lerp(grassC, (n2 - 0.62) * 2.2);
    if (n3 > 0.58) c.lerp(dry, Math.min(0.7, (n3 - 0.58) * 3.0));
    if (az > 7 && az < 30 && Math.abs(x) < 70 && n1 > 0.6 && h < 3 && Math.abs(dx) > 9) c.lerp(field, 0.55);     // tarla yamaları
    const out = smoothstep(84, 98, Math.abs(x)) + smoothstep(58, 70, az);     // sınır dışı dağlar: ormanlı yamaç
    const fo = Math.min(1, Math.max(smoothstep(24, 46, az), out));
    c.lerp(forest, fo * 0.75);
    if (fo > 0.2 && n2 > 0.5) c.lerp(forestD, 0.35 * fo);
    if (fo > 0.4 && n2 < 0.28) c.lerp(needle, 0.5);
    const rk = 0.55 + 0.3 * Math.min(1, out);
    if (slope > rk) { tmp.copy(n2 > 0.5 ? rockA : rockB); if (n1 > 0.62) tmp.lerp(rockC, 0.5); c.lerp(tmp, Math.min(1, (slope - rk) * 2.4)); }
    if (h > 24) c.lerp(rockA, smoothstep(24, 34, h));
    if (h > 52) c.lerp(snow, smoothstep(52, 66, h));
    for (const sg of [1, -1]) {   // çanak: çiftlik avlusu toprağı
      const bd = Math.max(0, Math.abs(x - sg * BOWL.cx) - BOWL.hx, Math.abs(z - sg * BOWL.cz) - BOWL.hz);
      if (bd < 6) c.lerp(yard, 0.55 * (1 - bd / 6));
    }
    if (padD(x, z, 0.5)) c.lerp(yard, 0.3);
    const td = trailD(x, z);                                         // patikalar
    if (td < 0.9) {
      const road = _tw >= 4.3;
      const k = 1 - smoothstep(road ? -1.2 : -1.0, (road ? 0.7 : 0.1) + (n2 - 0.5) * 1.0, td);
      tmp.copy(road ? dirt : path).lerp(yard, n2 * 0.4);
      if (td > -0.6) tmp.lerp(dirtWet, 0.35);
      c.lerp(tmp, Math.min(1, k * (road ? 1.0 : 0.85)));
    }
    if (h < WATER_LEVEL + 0.18) c.copy(sand).lerp(rockA, 0.1 + n2 * 0.25);                                               // kum kıyı
    else if (h < WATER_LEVEL + 0.55 && slope < 0.6) c.lerp(wet, 0.55 * (1 - (h - WATER_LEVEL - 0.18) / 0.37));            // ıslak toprak
    const fr = (((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1;
    c.multiplyScalar(0.93 + 0.14 * fr);
  }, { smooth: true, jitter: 0.04, detail: { block: 0.5, amp: 0.09, patch: 0.08 } });

  // ───────── Nehir (su şeridi) ─────────
  const wpos = [], widx = [];
  for (let z = -170, i = 0; z <= 170; z += 5, i++) {
    const cx = riverX(z);
    wpos.push(cx - 12, WATER_LEVEL, z, cx + 12, WATER_LEVEL, z);
    if (i > 0) { const a = (i - 1) * 2; widx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wg.setIndex(widx);
  wg.computeVertexNormals();
  const water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: '#4a9fc6', transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }));

  // ───────── Köprü (z=0) ─────────
  const bx = riverX(0);
  b.box(bx, -0.3, 0, 19, 0.65, 6.6, '#9a8f7e', { tag: 'deck' });                                   // taş tabliye (üst 0.35)
  b.box(bx, 0.34, 0, 19.2, 0.04, 5.6, '#8b6a45', { collide: false });                              // tahta kaplama
  for (const sz of [-3.1, 3.1]) {
    b.box(bx, 0.35, sz, 19, 1.0, 0.4, '#8f8575', { tag: 'rail' });                                 // korkuluk duvarı
    for (let i = -4; i <= 4; i++) b.box(bx + i * 2.2, 1.35, sz, 0.5, 0.25, 0.5, '#6f685c', { collide: false });
  }
  for (const px of [-5.5, 0, 5.5]) b.box(bx + px, -3.4, 0, 1.6, 3.2, 6.4, '#8a8070', { collide: false });  // ayaklar
  b.with(bx, 0.35, 0, 0, () => {
    V.deckCar(b, { x: -3, z: 1.2, ry: 0, color: '#b33a2a', wreck: true });       // köprü üstü araçlar: çarpışma 'rail' → bot yol bulma da görür
    V.deckCar(b, { x: 4.5, z: -1.4, ry: PI, color: '#4a7a4f' });
  });
  for (const px of [-8.4, 8.4]) b.with(bx + px, 0.35, 0, 0, () => V.lantern(b, 3.4));

  // ───────── Asma köprüler (kuzey/güney yarık) ─────────
  for (const sg of [1, -1]) {
    const z = -46.5 * sg;
    V.plankBridge(b, { x0: -7.5, z0: z, x1: 7.5, z1: z, y: SADDLE_Y, w: 2.2 });
    for (const px of [-8.2, 8.2]) b.with(px, SADDLE_Y - 0.0, z + 1.6 * sg, 0, () => V.lantern(b, 2.6));
  }

  const grid = new Map();
  const near = (x, z, r) => {
    const gx = Math.floor(x / 4), gz = Math.floor(z / 4);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = grid.get((gx + i) + ',' + (gz + j));
      if (a) for (const p of a) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < r * r) return true;
    }
    return false;
  };
  const reg = (x, z) => { const k = Math.floor(x / 4) + ',' + Math.floor(z / 4); (grid.get(k) || grid.set(k, []).get(k)).push([x, z]); };
  // ───────── pass 2: yapıları yerleştir ─────────
  plan((x, z, ry, pad, fn, o = {}) => {
    for (const side of o.sides || [1, -1]) {
      const wx = side * x, wz = side * z, wry = side > 0 ? ry : ry + PI;
      const y0 = terrain.heightAt(wx, wz), n0 = b.colliders.length;
      b.with(wx, y0, wz, wry, () => {
        const M = b.M;
        const gy = (lx, lz) => { const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(M); return terrain.heightAt(v.x, v.z) - y0; };
        fn({ side, gy, at: (lx, lz, f) => b.with(lx, gy(lx, lz), lz, 0, f) });     // at: nesneyi kendi zemin yüksekliğine oturt
      });
      // zemine dayanan alçak çarpışmaları (sandık, kaya, duvar parçası) eğimde altı boş kalıyorsa yere kadar uzat:
      // havada asılı kutu, altından geçen oyuncuyu araziye gömüp sıkıştırmasın
      for (let i = n0; i < b.colliders.length; i++) {
        const c = b.colliders[i];
        if (c.tag || c.max[1] - c.min[1] >= 2.4 || c.min[1] - y0 > 0.35) continue;
        const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2;
        const lo = Math.min(terrain.heightAt(cx, cz), terrain.heightAt(c.min[0], c.min[2]), terrain.heightAt(c.max[0], c.min[2]), terrain.heightAt(c.min[0], c.max[2]), terrain.heightAt(c.max[0], c.max[2]));
        if (c.min[1] > lo + 0.12) c.min[1] = lo - 0.1;
      }
      if (pad[0] < 3.2 && pad[1] < 3.2) reg(wx, wz);      // küçük nesneler (kaya, fener, sandık): ağaç aralığı bırak
    }
  });

  // ───────── Yol boyunca fener direkleri (gece yol gösterir) ─────────
  for (const t of TRAILS) {
    const gap = { merkez: 15, guney: 17, kuzey: 21, kuzeyGecit: 20, guneyGecit: 20, tepeRampa: 22, mezraAmbar: 22 }[t.name];
    if (!gap) continue;
    let acc = gap * 0.5, alt = 1;
    for (let i = 1; i < t.p.length - 1; i++) {
      acc += t.step;
      if (acc < gap) continue;
      acc = 0; alt = -alt;
      const [px, pz] = t.p[i], [qx, qz] = t.p[i + 1], dl = Math.hypot(qx - px, qz - pz) || 1;
      const x = px + (-(qz - pz) / dl) * (t.w / 2 + 0.7) * alt, z = pz + ((qx - px) / dl) * (t.w / 2 + 0.7) * alt;
      if (Math.abs(x) > 86 || Math.abs(z) > 58 || padD(x, z, 0.5) || Math.abs(x - riverX(z)) < 9) continue;
      if (b.colliders.some((c) => x > c.min[0] - 0.6 && x < c.max[0] + 0.6 && z > c.min[2] - 0.6 && z < c.max[2] + 0.6)) continue;
      b.with(x, terrain.heightAt(x, z), z, 0, () => V.lantern(b, 3.1));
    }
  }
  // ───────── Ağaçlar / çalılar / kayalar ─────────
  const okTree = (x, z, trailM = 1.9) => {
    const h = terrain.heightAt(x, z);
    if (h < 0.3 || h > 42) return false;
    if (terrain.slopeAt(x, z, 1) > 0.95) return false;
    if (Math.abs(x - riverX(z)) < 7.5 && Math.abs(z) < 36) return false;
    if (Math.abs(x) < 88 && Math.abs(z) < 61) {
      if (padD(x, z, 2.2)) return false;
      if (trailD(x, z) < trailM) return false;
      for (const sg of [1, -1]) if (Math.abs(x - sg * BOWL.cx) < BOWL.hx + 2 && Math.abs(z - sg * BOWL.cz) < BOWL.hz + 2) return false;
      for (const fz of [-26, 26]) if (Math.hypot(x - riverX(fz), z - fz) < 14) return false;
    }
    return true;
  };
  let nTrees = 0;
  for (let i = 0; i < 40000 && nTrees < 1150; i++) {
    const x = -125 + rng() * 250, z = -105 + rng() * 210;
    const az = Math.abs(z), ax = Math.abs(x);
    // yoğunluk: sırtlarda sık, vadi tabanında seyrek (köprü ekseni açık)
    let dens = 0.05 + 0.92 * smoothstep(20, 40, az);
    if (az < 20 && ax < 85) dens *= 0.35 + 0.65 * smoothstep(8, 20, az);
    if (ax > 88 || az > 62) dens *= 0.55;
    if (rng() > dens) continue;
    if (!okTree(x, z)) continue;
    if (near(x, z, 2.7)) continue;
    const h = terrain.heightAt(x, z);
    const s = 0.9 + rng() * 0.8;
    if (rng() > (az > 26 ? 0.14 : 0.55)) K.pine(b, rng, x, z, s, h); else K.oak(b, rng, x, z, s * 0.95, h);
    reg(x, z); nTrees++;
  }
  // çalılar (siper, çarpışmasız)
  for (let i = 0; i < 260; i++) {
    const x = -90 + rng() * 180, z = -62 + rng() * 124;
    if (!okTree(x, z, 1.3) || near(x, z, 1.2)) continue;
    const h = terrain.heightAt(x, z), sc = 0.7 + rng() * 0.5;
    b.ico(x, h + 0.35, z, sc, rng() > 0.5 ? '#4f7a33' : '#5d8a3a', { scale: [1.2, 0.8, 1.2] });
    if (rng() > 0.6) b.ico(x + 0.8, h + 0.25, z + 0.5, sc * 0.7, '#5d8a3a', { scale: [1.2, 0.8, 1.2] });
  }
  // serpiştirilmiş kayalar (çarpışmalı, uzun görüş hatlarını böler)
  let nR = 0;
  for (let i = 0; i < 400 && nR < 70; i++) {
    const x = -88 + rng() * 176, z = -60 + rng() * 120;
    if (!okTree(x, z, 2.4) || near(x, z, 2.6) || Math.abs(z) < 8 && Math.abs(x) < 30) continue;
    V.rock(b, rng, x, z, 0.9 + rng() * 1.3, terrain.heightAt(x, z));
    reg(x, z); nR++;
  }

  // ───────── Dekor: çimen tutamı, çiçek, çakıl, kamış (draw call artırmadan: renk başına birleşik) ─────────
  {
    const tpl = (g) => { const t = g.index ? g.toNonIndexed() : g.clone(); t.deleteAttribute('uv'); return t; };
    const TUFT = [[0.07, 0.26], [0.09, 0.34], [0.11, 0.42], [0.08, 0.52]].map(([r, h]) => tpl(V.tuftGeo(r, h)));
    const FLOWER = tpl(new THREE.ConeGeometry(0.1, 0.26, 4, 1, true).translate(0, 0.38, 0)), STEM = tpl(new THREE.ConeGeometry(0.03, 0.4, 3, 1, true).translate(0, 0.2, 0));
    const REED = tpl(new THREE.ConeGeometry(0.06, 1.2, 3, 1, true).translate(0, 0.6, 0)), PEB = tpl(new THREE.IcosahedronGeometry(0.2, 0));
    const add = (g, col, x, y, z, rx, ry, rz, sc) => dec.addGeo(g.clone(), col, dec._local(x, y, z, rx, ry, rz, sc), undefined);
    const grassCols = ['#7ea23e', '#97b94c', '#628a35', '#a9b852'];
    let n = 0;
    for (let i = 0; i < 7000 && n < 1700; i++) {
      const x = -92 + rngD() * 184, z = -62 + rngD() * 124;
      const h = terrain.heightAt(x, z);
      if (h < 0.15 || terrain.slopeAt(x, z, 0.8) > 0.5) continue;
      if (padD(x, z, 0.3) || trailD(x, z) < 0.3) continue;
      if (Math.abs(x) > 62 && Math.abs(z) < 17) continue;   // çanak avlusu çıplak
      const k = 3 + Math.floor(rngD() * 3);
      const col = grassCols[Math.floor(rngD() * grassCols.length)];
      for (let j = 0; j < k; j++) {
        const px = x + (rngD() - 0.5) * 0.7, pz = z + (rngD() - 0.5) * 0.7;
        add(TUFT[Math.floor(rngD() * 4)], col, px, terrain.heightAt(px, pz) - 0.03, pz, (rngD() - 0.5) * 0.3, rngD() * 3, (rngD() - 0.5) * 0.3);
      }
      n++;
    }
    const flowerCols = ['#f2e46a', '#ee6f9c', '#f6f2ea', '#a98be8', '#ff9b4a'];
    for (let i = 0; i < 90; i++) {
      const cx = -85 + rngD() * 170, cz = -40 + rngD() * 80;
      const h = terrain.heightAt(cx, cz);
      if (h < 0.3 || terrain.slopeAt(cx, cz, 1) > 0.35 || padD(cx, cz, 1) || trailD(cx, cz) < 0.8) continue;
      if (Math.abs(cx) > 62 && Math.abs(cz) < 17) continue;
      const col = flowerCols[Math.floor(rngD() * flowerCols.length)];
      for (let j = 0; j < 10; j++) {
        const a = rngD() * 6.28, d = Math.sqrt(rngD()) * 2.2;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (trailD(x, z) < 0.3) continue;
        const y = terrain.heightAt(x, z);
        add(FLOWER, col, x, y, z, 0, rngD() * 3, 0); add(STEM, '#4f7a33', x, y, z, 0, 0, 0);
      }
    }
    // kıyı çakılı ve kamışlar
    const one = new THREE.Vector3(1.3, 0.55, 1);
    for (let i = 0; i < 700; i++) {
      const z = -60 + rngD() * 120, side = rngD() > 0.5 ? 1 : -1;
      const x = riverX(z) + side * (4.2 + rngD() * 5);
      const h = terrain.heightAt(x, z);
      if (h < -0.2 || h > 0.9 || Math.abs(z) < 4.6 && Math.abs(x) < 12) continue;
      if (rngD() > 0.55) add(PEB, rngD() > 0.5 ? '#8f8d85' : '#a5a296', x, h + 0.04, z, 0, rngD() * 3, 0, one);
      else for (let j = 0; j < 3; j++) add(REED, '#6f9a3c', x + (rngD() - 0.5) * 0.4, h - 0.05, z + (rngD() - 0.5) * 0.4, (rngD() - 0.5) * 0.2, 0, (rngD() - 0.5) * 0.2, new THREE.Vector3(1, 0.8 + rngD() * 0.4, 1));
    }
  }

  // ───────── Doğuş noktaları ─────────
  const spawns = { blue: [], red: [] };
  const bz = BASE_ZONES.blue;
  const cands = [];
  for (let x = bz.minX + 6; x <= bz.maxX - 1; x += 1.0) for (let z = bz.minZ + 1.5; z <= bz.maxZ - 1.5; z += 1.0) cands.push([x, z]);
  const blocked = (x, z, side) => {
    const wx = side * x, wz = side * z, gyy = terrain.heightAt(wx, wz);
    if (terrain.slopeAt(wx, wz, 0.5) > 0.25) return true;
    for (const c of b.colliders) {
      if (wx + 1.0 < c.min[0] || wx - 1.0 > c.max[0] || wz + 1.0 < c.min[2] || wz - 1.0 > c.max[2]) continue;
      if (c.max[1] > gyy + 0.2 && c.min[1] < gyy + 1.9) return true;
    }
    return false;
  };
  for (const side of [1, -1]) {
    const free = cands.filter(([x, z]) => !blocked(x, z, side));
    const picked = [];
    // en uzak nokta örneklemesi: doğuş çekirdeği (merkez ~ (-69,0)) çevresinde dağılmış 20 nokta
    const core = [-69, 0];
    free.sort((p, q) => Math.hypot(p[0] - core[0], p[1] - core[1] * 1) - Math.hypot(q[0] - core[0], q[1] - core[1]));
    for (const p of free) {
      if (picked.length >= 20) break;
      if (picked.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.6)) picked.push(p);
    }
    for (const [x, z] of picked) {
      const wx = side * x, wz = side * z;
      spawns[side > 0 ? 'blue' : 'red'].push({ x: wx, z: wz, ry: side > 0 ? -PI / 2 : PI / 2, y: terrain.heightAt(wx, wz) });
    }
  }
  const objectives = [
    { id: 'ambar', name: 'Ambar', x: OBJ.ambar[0], z: OBJ.ambar[1], r: 10 },
    { id: 'tepe', name: 'Gözetleme Tepesi', x: OBJ.tepe[0], z: OBJ.tepe[1], r: 9, core: true },
    { id: 'kopru', name: 'Köprü', x: bx, z: 0, r: 11, core: true },
    { id: 'kamp', name: 'Orman Kampı', x: OBJ.kamp[0], z: OBJ.kamp[1], r: 10, core: true },
    { id: 'degirmen', name: 'Değirmen', x: OBJ.degirmen[0], z: OBJ.degirmen[1], r: 10 },
  ];

  const group = b.build();
  const decGroup = dec.build();
  decGroup.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  group.add(decGroup);
  group.add(terrainMesh);
  group.add(water);

  // minimap yolları: patika örnekleri küçük dikdörtgenler olarak
  const roads = [];
  for (const t of TRAILS) {
    if (t.w < 4.3) continue;
    for (let i = 0; i < t.p.length; i += 2) {
      const [x, z] = t.p[i];
      if (Math.abs(x) > 90 || Math.abs(z) > 60) continue;
      roads.push({ x0: x - 1.4, z0: z - 1.4, x1: x + 1.4, z1: z + 1.4 });
    }
  }

  return {
    id: 'vadi',
    name: 'Vadi',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: VADI_BOUNDS,
    terrain,
    spawns,
    baseZones: BASE_ZONES,
    objectives,
    roads,
    roadColor: '#b69364',
    env: {
      sky: ['#5f9fdc', '#c3dcef', '#f6e9cf'], fog: ['#e8e4d2', 170, 430],
      sun: ['#ffe0ae', 2.8], hemi: ['#cfe3ff', '#8f7d52', 1.1], cloud: '#fff6e8', clouds: 22,
      sunPos: [75, 70, 30],
    },
  };
}
