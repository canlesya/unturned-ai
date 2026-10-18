import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as V from './kitVadi.js';
import { Terrain, fbm, smoothstep, WATER_LEVEL } from './terrain.js';
import { VK, vadiKindOf, makeVadiMaterial, makeVadiGroundMaterial, makeVadiWaterMaterial } from './vadiSurface.js';
import { VADI_BOUNDS, riverX, vadiHeight, TRAILS, PADS, addPad, finalizeLayout, layoutReady, BOWL, BASE_ZONES, OBJ, SADDLE_Y } from './vadiLayout.js';

export { VADI_BOUNDS, vadiHeight };

// Harita 2 — VADİ (v2)
// Doğu-batı vadi, ortada kuzey-güney nehir kanyonu. Mavi (batı) ve Kırmızı (doğu) çanaklar sırtlarla görüş hattından gizlenmiştir;
// çanaktan üç yol çıkar: kuzey patika (orman/sırt, keskin nişancı), merkez şikan yolu (köprü, ağır çatışma),
// güney geçit (Ambar/ahır kanadı, sığ geçit). Harita 180° dönme simetriktir (yerleşimler iki yarıda da var).

const PI = Math.PI;

export function buildVadi() {
  const b = new MapBuilder();
  b.surface = { ground: () => 0, kindOf: vadiKindOf, seeded: true, material: makeVadiMaterial };   // dünya koordinatlı yüzey gölgelendiricisi (taş / sıva / tahta / kiremit / kaya …)
  const dec = new MapBuilder();            // dekor katmanı (çimen/çiçek/taş): çarpışmasız, gölge düşürmez
  const rng = makeRng(2024);
  const rngD = makeRng(77);
  let T = null;                            // Terrain (pass 2'de hazır)

  // ───────── Yerleşim planı: S(x,z,ry,[padHx,padHz],fn,{sides}) — mavi yarı koordinatları, dönmüş kopya otomatik ─────────
  // fn({side, gy}) yerel çerçevede (orijin = zemin) çizer; side +1 = mavi yarı, −1 = kırmızı yarı.
  const plan = (S) => {
    const TEAM = (sd) => (sd > 0 ? { main: '#2c5aa0', wall: '#35577f', roofA: '#5b6f8a' } : { main: '#b0332a', wall: '#9a3a2e', roofA: '#8a4b3f' });
    // bina + taş temel: duvarın / kaidenin TAM altında (dışa taşmaz → arazi ile eş düzlem şerit yok), üstü zeminin 2 cm altında. Bina izi hard pad'le
    // düz olduğundan temel normalde görünmez; yalnız düzlüğün kenarında arazi düşerse duvar dibi boşluk yerine taşa iner.
    const house = (o) => { V.foundation(b, o.x, -2.42, o.z, o.w + 0.56, 2.4, o.d + 0.56, '#86817a', { collide: false, kind: VK.STONE }); K.house(b, rng, o); };
    const barn = (o) => {
      const w = o.w || 12, d = o.d || 18;
      V.foundation(b, o.x, -2.42, o.z, w + 0.3, 2.4, d + 0.3, '#86817a', { collide: false, kind: VK.STONE });
      K.barn(b, rng, o);
      b.withKind(VK.STEEL, () => {                                                    // ahır içi sarkan lambalar tavana asılı dursun (askı teli)
        b.box(o.x, 4.5, o.z - d / 2 + 0.5, 0.03, 0.45, 0.03, '#2a2d30', { collide: false });
        b.box(o.x, 3.9, o.z, 0.03, 1.05, 0.03, '#2a2d30', { collide: false });
      });
    };
    const cover = (x, z, kind = 'rock', s = 1.2) => S(x, z, 0, [0, 0], () => (kind === 'rock' ? V.rock(b, rng, 0, 0, s, gl(0, 0)) : V.fallenLog(b, 0, 0, 3.4, s, 0, gl)));
    // düz yer: istenen noktanın ±sr çevresinde (rot: iki yönde de) w × len ayak izinin altında zemini en düz konumu seç → f'yi orada çiz.
    // Yamaçta çadır platformu alçak kalır, kuyu / kütük yığını yarı gömülü durmaz. at = true: zemine oturtup alt köşeye göre indir.
    const flatAt = (g, lx, lz, ry, w, len, sr, f, { rot = true, at = false } = {}) => {
      let best = null;
      const st = Math.max(0.2, sr / 3);
      for (const r of rot ? [ry, ry + PI / 2] : [ry]) for (let dx = -sr; dx <= sr + 0.01; dx += st) for (let dz = -sr; dz <= sr + 0.01; dz += st) {
        const c = Math.cos(r), s = Math.sin(r);
        let lo = 1e9, hi = -1e9;
        for (const [px, pz] of [[-w / 2, -len / 2], [w / 2, -len / 2], [-w / 2, len / 2], [w / 2, len / 2], [0, 0], [0, -len / 2], [0, len / 2]]) { const y = g.gy(lx + dx + px * c + pz * s, lz + dz - px * s + pz * c); lo = Math.min(lo, y); hi = Math.max(hi, y); }
        const sc = hi - lo + 0.05 * Math.hypot(dx, dz) + (r !== ry ? 0.04 : 0);
        if (!best || sc < best[0]) best = [sc, lx + dx, lz + dz, r];
      }
      if (at) g.at(best[1], best[2], () => b.with(0, 0, 0, best[3], f));
      else g.sub(() => b.with(best[1], 0, best[2], best[3], f));
    };
    const tentAt = (g, lx, lz, ry, o = {}) => flatAt(g, lx, lz, ry, o.w || 3.2, o.len || 4.2, o.search ?? 0.8, () => V.tent(b, { ...o, gl }), { rot: o.rot ?? true });
    const HD = (hx, hz, ox = 0, oz = 0) => ({ hard: [hx, hz, ox, oz] });            // bina izi (+ sundurma tarafı payı): hard pad dikdörtgeni

    // ═════════ DOĞUŞ ÇANAĞI (çiftlik): ahır, silolar, çiftlik evi, traktör, saman ═════════
    S(-80, -8, 0, [8, 8.5], (g) => barn({ x: 0, z: 0, w: 10, d: 12, color: TEAM(g.side).wall, roof: '#5f646c' }), HD(5.6, 6.6));
    S(-84.5, 4, 0, [3.2, 3.2], () => V.silo(b, 0, 0), HD(2.8, 2.8));
    S(-85.8, 10, 0, [2.6, 2.6], () => V.silo(b, 0, 0, 1.7, 8), HD(2.3, 2.3));
    S(-77.5, 11.5, 0, [6.5, 5.8], (g) => house({ x: 0, z: 0, w: 9, d: 7, wall: g.side > 0 ? '#d6cfb4' : '#d9c79a', roof: TEAM(g.side).roofA, door: 'n', floors: 1 }), HD(5.0, 4.75, 0, -0.75));
    S(-70, -9.5, PI / 2, [0, 0], (g) => V.tractor(b, { color: g.side > 0 ? '#3a6aa8' : '#a8402f' }));
    S(-70.6, 13, 0, [0, 0], () => V.haystack(b, 0, 0, 1));                          // ev duvarına girmesin (0,9 m doğuya)
    S(-67.4, 14.6, 0, [0, 0], () => V.haystack(b, 0, 0, 0.8));
    S(-86.2, -0.6, 0, [0, 0], () => { for (let i = 0; i < 6; i++) K.hayBale(b, (i % 3) * 1.3 - 1.3, Math.floor(i / 3) * 1.3); });   // ahır duvarından ve silodan uzak
    S(-73, -13.5, 0, [0, 0], (g) => { K.crate(b, 0, 0, 1.1); K.crate(b, 1.2, 0.2, 1.0); K.crate(b, 0.5, 0.2, 0.9, 1.1); K.barrel(b, 2.4, 0, TEAM(g.side).main); K.barrel(b, 3.1, 0.3, TEAM(g.side).main); });
    S(-63.5, -4.5, PI / 2, [0, 0], () => V.sandbags(b, gl, 0, 0, 4, 0));
    S(-63.5, 3.5, PI / 2, [0, 0], () => V.sandbags(b, gl, 0, 0, 3.4, 0));
    S(-66, -11, 0, [0, 0], () => V.lantern(b, 3.4));
    S(-66, 6.5, 0, [0, 0], () => V.lantern(b, 3.4));
    S(-83, 0, 0, [0, 0], () => V.lantern(b, 3.4));
    S(-75, 0, 0, [0, 0], (g) => {       // takım bayrağı
      b.cyl(0, 0, 0, 0.07, 0.1, 5.2, '#d8d8d2', { seg: 6 });
      b.box(0.62, 3.9, 0, 1.2, 0.8, 0.05, TEAM(g.side).main, { collide: false });
    });
    S(-87, 14, 0, [0, 0], () => V.fence(b, gl, 0, -1.6, 0, 3));                    // silo kaidesine girmesin (güneyde başlar)

    // ═════════ KÖPRÜBAŞI MEZRASI ═════════
    S(-18.2, -11, 0, [5.5, 4.8], () => house({ x: 0, z: 0, w: 8, d: 6.5, wall: '#d6cfb4', roof: '#7a3b2e', door: 's', floors: 1 }), HD(4.5, 4.5, 0, 0.75));   // karakola girmesin (0,7 m batıya)
    S(-17.5, 10.2, 0, [5.5, 4.8], () => house({ x: 0, z: 0, w: 8, d: 6.5, wall: '#c9c1a4', roof: '#5d6a4a', door: 'n', floors: 1 }), HD(4.5, 4.5, 0, -0.75));   // avlu duvarından 1,9 m (0,8 m kuzeye)
    S(-10.4, -8.6, 0, [4.0, 3.6], () => house({ x: 0, z: 0, w: 5.4, d: 4.6, wall: '#9a948a', roof: '#6a6560', door: 's', floors: 1, flat: true }), HD(3.2, 3.55, 0, 0.75));   // taş karakol
    S(-10.6, 13.8, 0, [3.6, 6.8], () => b.with(0, 0, -3.6, 0, () => V.tower(b, {})), HD(2.6, 6.2));   // köprübaşı kulesi (merdiven +z yönünde)
    S(-17.5, -3.6, 0, [3, 1.6], () => K.car(b, { x: 0, z: 0, ry: 0, color: '#b33a2a', wreck: true }));
    S(-16, 4.6, 0, [2, 2], () => K.car(b, { x: 0, z: 0, ry: PI, color: '#4a7a4f' }));
    S(-12.6, -3.9, PI / 2, [0, 0], () => V.sandbags(b, gl, 0, 0, 3.4, 0));          // karakol duvarından ayrı (1,3 m kuzey; sundurma kaidesine de değmez)
    S(-12.6, 5.2, PI / 2, [0, 0], () => V.sandbags(b, gl, 0, 0, 3.4, 0));
    S(-14.5, 0.3, 0, [0, 0], () => K.barrier(b, 0, 0, 0.2));
    S(-27.5, 2, 0, [0, 0], () => K.crate(b, 0, 0, 1.1));
    S(-28, 6, 0, [0, 0], () => { K.barrel(b, 0, 0, '#2c5aa0'); K.barrel(b, 0.8, 0.4, '#d9a921'); });
    S(-13.4, -16.6, 0, [0, 0], (g) => flatAt(g, 0, 0, 0, 2.1, 2.1, 0.6, () => V.well(b), { at: true, rot: false }));   // yamaçta en düz yere (yarı gömülüydü)
    cover(-8.6, -14.5, 'rock', 1.0);
    S(-10.5, -1.6, 0, [0, 0], () => V.lantern(b, 3.2));

    // ═════════ KUZEY MEZRA (kulübeler, avlu duvarları, yıkık yapı, kamyon) ═════════
    S(-33, -17, 0, [4.6, 4.2], () => house({ x: 0, z: 0, w: 6, d: 5, wall: '#8b5a2b', roof: '#4d5b3a', door: 'e', floors: 1 }), HD(4.25, 3.0, 0.75, 0));
    S(-40.2, -23.2, 0, [4.6, 4.2], () => house({ x: 0, z: 0, w: 6, d: 5, wall: '#7d5126', roof: '#3f4a30', door: 's', floors: 1 }), HD(3.5, 3.75, 0, 0.75));   // komşu kulübe köşesine girmesin
    S(-30, -23.5, 0, [0, 0], (g) => flatAt(g, 0, 0, 0, 3.1, 3.1, 1.2, () => V.haystack(b, 0, 0, 1), { at: true, rot: false }));
    S(-31.5, -11.5, 0, [0, 0], (g) => V.stoneWall(b, g.gy, -3, 0, 3, 0, { h: 0.9 }));
    S(-8, 41, 0, [4.6, 3.6], (g) => V.ruin(b, rng, g.gy, { w: 6.4, d: 4.4 }));

    // güney/kuzey çiftlik kulübesi (çanak çıkışı ile Ambar arasında, ara kademe yerleşim)
    S(-47, 26.5, 0, [4.6, 4.2], () => house({ x: 0, z: 0, w: 6, d: 5, wall: '#a6845a', roof: '#6b3f33', door: 'n', floors: 1 }), HD(3.5, 3.75, 0, -0.75));
    S(-52, 28.6, 0, [0, 0], () => V.haystack(b, 0, 0, 0.9));
    S(-41.6, 28, 0, [0, 0], () => V.fence(b, gl, 0, -2.4, 0, 2.4));

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
        b.cyl(0.75, 3.0, -3.6, 2.4, 2.4, 0.7, '#6e4a2a', { rz: PI / 2, center: true, seg: 12, collide: false, kind: VK.WOOD });     // su çarkı
        b.cyl(0.75, 3.0, -3.6, 0.4, 0.4, 1.0, '#4a3220', { rz: PI / 2, center: true, seg: 8, collide: false, kind: VK.WOOD });
        b.collide(0.75, 0.6, -3.6, 0.7, 4.8, 3.3); b.collide(0.75, 1.45, -3.6, 0.7, 3.1, 4.8);        // çark çarpışması (artı biçimli iki kutu ≈ daire; eskiden içinden geçiliyordu)
        for (let i = 0; i < 4; i++) b.box(-8 + i * 1.1, 0, -6, 0.9, 0.55 + (i % 2) * 0.2, 0.7, '#cfc4a1');                          // çuvallar
        b.cyl(-6, 0, 7, 1.3, 1.3, 0.45, '#9a948a', { seg: 10 }); b.cyl(-2.5, 0, 8.5, 1.3, 1.3, 0.45, '#8a8479', { seg: 10 });          // değirmen taşları
        V.haystack(b, 7.4, -7.4, 1); V.haystack(b, 7.6, 9, 0.85);
        K.crate(b, 7.6, 6.2, 1.1); K.crate(b, 8.1, 7.4, 1.0); K.barrel(b, -8.5, 9, '#2c5aa0');
        b.with(-7.4, 0, 3.5, 0, () => V.cart(b, { color: '#6a4a2a' }));
      }
      b.with(-3.5, 0, 6, 0, () => V.lantern(b, 3.4));
    }, { y: 1.45, ...HD(10.3, 10.8, 0, 0.5) });                                                      // avlu zemini tam düz (patika ucu avluya girip ahır / değirmen tabanını gömüyordu)

    // ═════════ GÖZETLEME TEPESİ (kuzey sırt zirvesi) / ORMAN KAMPI (güney sırt) ═════════
    // Zirveye 4 yol girer: batı (kuzey patika), güney (rampa), doğu (nehir geçidi), kuzey (ledge). Merkez ve koridorlar açık kalır.
    S(-20, -40, 0, [11.5, 9], (g) => {
      if (g.side > 0) {
        g.at(-1.4, 8.8, () => V.rock(b, rng, 0, 0, 1.0)); g.at(8.6, 1.4, () => K.crate(b, 0, 0, 1.1)); g.at(8.6, 2.6, () => K.crate(b, 0, 0, 1.0));
        g.sub(() => b.with(6, 0, -3.8, PI / 2, () => V.bunker(b, { w: 6, d: 4.4, ramp: false, gl })));    // mazgal doğuya (vadiye) bakar, giriş batıdan; sırt kenarında beton kaide
        g.at(-4.5, -1.2, () => K.crate(b, 0, 0, 1.1)); g.at(-3.4, -1.0, () => K.crate(b, 0, 0, 1.0)); g.at(-5.6, -2.0, () => K.barrel(b, 0, 0, '#4d5b3a'));   // kule merdiveninden 1,4 m uzak
        g.at(-9.2, 6.4, () => V.rock(b, rng, 0, 0, 1.3)); g.at(9.4, 6.6, () => V.rock(b, rng, 0, 0, 1.2)); g.at(2.5, 7.6, () => V.rock(b, rng, 0, 0, 1.4));
        g.at(-3.2, 1.2, () => V.lantern(b, 3.4));
      } else {
        // Orman Kampı: çadırlar, ateş, kütük yığını, bunker (ağaçlı sırt; gece ateşler yol gösterir). Çadırlar birbirine / ateşe değmez; yamaçtaki tahta platformda.
        tentAt(g, -6.0, -6.2, 0, { color: '#c7b98a', search: 0.3, rot: false });
        tentAt(g, -9.4, -2.4, PI / 2, { color: '#b9b184', w: 3.0, len: 3.6, search: 0.3, rot: false });
        g.at(-3.4, -4.6, () => V.campfire(b));
        tentAt(g, -9.9, -6.6, 0, { color: '#a7b38a', w: 3.0, len: 3.8, search: 0.3, rot: false });
        g.sub(() => b.with(6, 0, -3.8, PI / 2, () => V.bunker(b, { w: 6, d: 4.4, ramp: false, gl })));
        flatAt(g, 1.4, -0.6, PI / 2, 2.6, 1.35, 1.0, () => V.logPile(b, 0, 2.6), { at: true });
        g.sub(() => V.fallenLog(b, -5.4, 1.4, 3.0, 1.57, 0, gl));
        g.sub(() => V.fallenLog(b, -1.2, -6.4, 3.0, 0.2, 0, gl));
        g.at(0.0, -5.0, () => K.crate(b, 0, 0, 1.1)); g.at(1.2, -5.1, () => K.crate(b, 0, 0, 1.0));
        g.at(2.5, 7.8, () => V.rock(b, rng, 0, 0, 1.5)); g.at(-9.4, 6.8, () => V.rock(b, rng, 0, 0, 1.3));
        g.at(-3.0, -2.2, () => V.lantern(b, 3.0));
      }
    });
    // Tepe kulesi (batıya merdivenli): kuzeybatı köşe
    S(-26.5, -44.6, -PI / 2, [3.6, 6.8], (g) => { if (g.side > 0) b.with(0, 0, -3.6, 0, () => V.tower(b, {})); }, { sides: [1], ...HD(6.15, 2.6, 0.05, 0) });   // 1,6 m güneye: kuzey ayakları sırt yamacına gömülüyordu

    // gizli kamplar (orman bankı): ateş + çadır, gece uzaktan seçilir; her parça kendi zemininde, yamaçtaki çadır platformda
    for (const [x, z] of [[-47, -38.5], [-58, 38]]) {
      S(x, z, 0, [5, 4.5], (g) => {
        g.at(0, 0, () => V.campfire(b));
        tentAt(g, 3.4, -1.8, 0, { color: g.side > 0 ? '#9fb0c8' : '#c9a58f', len: 3.8 });
        g.at(-2.6, 1.4, () => V.rock(b, rng, 0, 0, 1.0)); g.at(-2.2, -1.8, () => K.crate(b, 0, 0, 1.0));
        g.sub(() => V.fallenLog(b, 0.4, 2.6, 2.6, 1.57, 0, gl));
      });
    }

    // ═════════ NEHİR GEÇİTLERİ: taş basamaklar, devrik kütük, siper kayaları, kum torbaları ═════════
    S(-3, -26, 0, [6, 6], () => {
      for (const [x, z] of [[-2, -2.5], [1.5, -1.5], [-0.5, 1.2], [2.6, 2.2], [-3, 2.8]]) V.steppingStone(b, x, gl(x, z) - 0.12, z, 0.5, '#8a8a84', { scale: [1.3, 0.6, 1], detail: 0, ry: x });   // basamak taşları (sığ suda, kendi zemininde)
    }, { noPad: true });
    cover(-7.2, -31, 'rock', 1.3);
    cover(-9.5, -18.5, 'rock', 1.0);
    S(-15.6, -19.8, 0, [0, 0], () => V.sandbags(b, gl, 0, 0, 3.4, 0));
    S(-8.4, -28.6, 0, [0, 0], () => V.sandbags(b, gl, 0, 0, 3.0, 0));
    S(-11.5, -29.6, 0, [0, 0], () => V.fallenLog(b, 0, 0, 4, 0.5, 0, gl));
    cover(-14, -26, 'rock', 1.2);
    S(-10.9, 21.4, 0, [0, 0], () => V.sandbags(b, gl, 0, 0, 3.4, 0));    // güney geçit (dönmüşü kuzeydeki doğu yakası)
    cover(-8, 31.6, 'rock', 1.3);
    S(-11, 31.5, 0, [0, 0], () => V.fallenLog(b, 0, 0, 3.6, 0.3, 0, gl));

    // ═════════ SIRT LEDGE'LERİ: keskin nişancı mevzileri + kaya tünelleri (her parça kendi zemininde) ═════════
    const nest = (g) => {
      V.sandbags(b, gl, 0, 1.7, 3.4, 0); g.at(2.8, 0.9, () => V.rock(b, rng, 0, 0, 0.9)); g.at(-2.4, 1.0, () => K.crate(b, 0, 0, 1.0));
      g.at(-2.4, -1.2, () => V.lantern(b, 3.0));
    };
    for (const [x, z] of [[-44, -51.2], [-27, -51], [-18.2, -50.2]]) S(x, z, 0, [0, 0], nest);
    for (const [x, z] of [[-56, 49.2], [-23, 49.3], [-15, 48.2]]) S(x, z, PI, [0, 0], nest);
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
    cover(-40.6, -37.4, 'log', -0.4);                                                // gizli kamp çadırına girmesin
    cover(-65.5, 31, 'log', 1.2);
    cover(-60.6, 42.4, 'rock', 1.3);
    cover(-50, 22.5, 'rock', 1.3);
    cover(-16.3, 29.9, 'rock', 1.2);                                                 // avlu içi siper (kırmızıda değirmen duvarına giriyordu; doğu kapısının güneyi)
    cover(-6.5, 19, 'rock', 1.3);
  };

  // pass 1: yalnızca düzlükler (pad) kaydet
  if (!layoutReady()) {
    plan((x, z, ry, pad, fn, o = {}) => {
      if (o.noPad || (pad[0] <= 0.5 && pad[1] <= 0.5)) return;
      const sw = Math.abs(Math.round(ry / (PI / 2))) % 2 === 1;
      // o.hard = [hx, hz, ox, oz]: bina izi (S yerel ekseninde, ry 0 / π varsayılır) → dünya dikdörtgeni; kırmızı yarıda ofset döner
      for (const side of o.sides || [1, -1]) addPad({ x: side * x, z: side * z, hx: sw ? pad[1] : pad[0], hz: sw ? pad[0] : pad[1], fall: o.fall || 3.2, y: o.y ?? null,
        hard: o.hard ? { x: side * (x + (o.hard[2] || 0)), z: side * (z + (o.hard[3] || 0)), hx: o.hard[0], hz: o.hard[1] } : null });
    });
  }
  finalizeLayout();
  const H = vadiHeight;

  // ───────── Arazi ─────────
  const terrain = new Terrain({ minX: -184, maxX: 184, minZ: -160, maxZ: 160, cell: 2, height: H });
  terrain.tri = true;                      // fizik / yol bulma çizilen üçgenlerle aynı yüzeyi okur (ayak çimene gömülmez, eşyalar görünen zemine oturur)
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
  }, {
    smooth: true, jitter: 0.04,
    aux: (x, z, h) => [                                                             // gölgelendirici ağırlıkları: patika, ıslak kıyı, kaya
      1 - smoothstep(-0.7, 0.7, trailD(x, z)),
      h > 1.2 ? 0 : 1 - smoothstep(WATER_LEVEL + 0.08, WATER_LEVEL + 0.7, h),
      smoothstep(0.55, 0.95, terrain.slopeAt(x, z, 1)),
    ],
  });
  terrainMesh.material = makeVadiGroundMaterial();

  // ───────── Nehir (su şeridi): 1 × 2,5 m ızgara, köşede derinlik (renk / saydamlık / kıyı köpüğü); kuru kıyının üstündeki üçgenler atlanır ─────────
  const wpos = [], wdep = [], widx = [];
  const NW = 25;
  let wrow = 0;
  for (let z = -170; z <= 170; z += 2.5, wrow++) {
    const cx = riverX(z);
    for (let k = 0; k < NW; k++) { const x = cx - 12 + k; wpos.push(x, WATER_LEVEL, z); wdep.push(WATER_LEVEL - terrain.heightAt(x, z)); }
    if (wrow > 0) for (let k = 0; k < NW - 1; k++) {
      const a = (wrow - 1) * NW + k, q = [a, a + 1, a + NW, a + NW + 1];
      if (Math.max(...q.map((i) => wdep[i])) < -0.25) continue;
      widx.push(a, a + NW, a + 1, a + 1, a + NW, a + NW + 1);
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wg.setAttribute('aDepth', new THREE.Float32BufferAttribute(wdep, 1));
  wg.setIndex(widx);
  wg.computeVertexNormals();
  const WM = makeVadiWaterMaterial();
  const water = new THREE.Mesh(wg, WM.material);
  water.onBeforeRender = () => { WM.uT.value = performance.now() / 1000; };

  // ───────── Zemine oturtma yardımcıları ─────────
  // gl(lx, lz): o anki b.with çerçevesinde yerel noktanın zemin yüksekliği (iç içe yerleşimde de doğru)
  const _gv = new THREE.Vector3();
  const gl = (lx, lz) => { _gv.set(lx, 0, lz).applyMatrix4(b.M); return terrain.heightAt(_gv.x, _gv.z) - _gv.y; };
  // mark / settle: bir nesneyi çizdikten sonra yeni görsel parçaları + çarpışmaları + z-fight kayıtlarını birlikte aşağı kaydırır; kayma = alt katmandaki
  // köşelerin araziden en yüksekte kalanı (yamaçta alçak köşe değer, yüksek köşe gömülür; hiçbir köşe havada kalmaz). En çok 0,9 m.
  const mark = () => ({ g: new Map([...b.buckets.values()].map((q) => [q, q.geos.length])), c: b.colliders.length, z: (b._zitems || []).length });
  const settle = (m) => {
    const geos = [];
    for (const q of b.buckets.values()) for (let i = m.g.get(q) || 0; i < q.geos.length; i++) geos.push(q.geos[i]);
    if (!geos.length) return 0;
    let lo = 1e9;
    for (const g of geos) { const a = g.attributes.position.array; for (let i = 1; i < a.length; i += 3) lo = Math.min(lo, a[i]); }
    let drop = -1e9;
    for (const g of geos) { const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 3) if (a[i + 1] < lo + 0.06) drop = Math.max(drop, a[i + 1] - terrain.heightAt(a[i], a[i + 2])); }
    drop = Math.min(drop + 0.02, 0.9);
    if (drop <= 0.005) return 0;
    for (const g of geos) { const a = g.attributes.position.array; for (let i = 1; i < a.length; i += 3) a[i] -= drop; g.attributes.position.needsUpdate = true; }
    for (let i = m.c; i < b.colliders.length; i++) { b.colliders[i].min[1] -= drop; b.colliders[i].max[1] -= drop; }
    const zi = b._zitems || []; for (let i = m.z; i < zi.length; i++) { zi[i].mn[1] -= drop; zi[i].mx[1] -= drop; }
    return drop;
  };

  // ───────── Köprü (z=0) ─────────
  const bx = riverX(0);
  b.obj('köprü', () => {
  b.withKind(VK.STONE, () => {
    b.box(bx, -0.3, 0, 19, 0.65, 6.6, '#9a8f7e', { tag: 'deck' });                                 // taş tabliye (üst 0.35)
    for (const sz of [-3.1, 3.1]) {
      b.box(bx, 0.35, sz, 19, 1.0, 0.4, '#8f8575', { tag: 'rail' });                               // korkuluk duvarı
      for (let i = -4; i <= 4; i++) b.box(bx + i * 2.2, 1.35, sz, 0.5, 0.25, 0.5, '#6f685c', { collide: false });
    }
    // ayaklar: taş, çarpışmalı ('deck': yol bulma tabliyeyi kapatmaz); nehir yatağına gömülü, tabliyenin altına değer
    for (const px of [-5.5, 0, 5.5]) b.box(bx + px, Math.min(-3.4, terrain.heightAt(bx + px, 0) - 0.4), 0, 1.6, Math.max(3.2, -0.3 - terrain.heightAt(bx + px, 0) + 0.5), 6.4, '#8a8070', { tag: 'deck' });
  });
  b.box(bx, 0.34, 0, 19.2, 0.04, 5.6, '#8b6a45', { collide: false, kind: VK.PLANK });               // tahta kaplama
  b.with(bx, 0.35, 0, 0, () => {
    V.deckCar(b, { x: -3, z: 1.2, ry: 0, color: '#b33a2a', wreck: true });       // köprü üstü araçlar: çarpışma 'rail' → bot yol bulma da görür
    V.deckCar(b, { x: 4.5, z: -1.4, ry: PI, color: '#4a7a4f' });
  });
  for (const px of [-8.4, 8.4]) b.with(bx + px, 0.35, 0, 0, () => V.lantern(b, 3.4));
  });

  // ───────── Asma köprüler (kuzey/güney yarık) ─────────
  for (const sg of [1, -1]) {
    const z = -46.5 * sg;
    b.obj('asma:' + (sg > 0 ? 'k' : 'g'), () => {
    V.plankBridge(b, { x0: -7.5, z0: z, x1: 7.5, z1: z, y: SADDLE_Y, w: 2.2, ground: (x) => terrain.heightAt(x, z) });
    for (const px of [-8.2, 8.2]) b.with(px, terrain.heightAt(px, z + 1.6 * sg) - 0.02, z + 1.6 * sg, 0, () => V.lantern(b, 2.6));
    });
  }

  const grid = new Map();
  const near = (x, z, r) => {
    const gx = Math.floor(x / 4), gz = Math.floor(z / 4);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const a = grid.get((gx + i) + ',' + (gz + j));
      if (a) for (const p of a) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < (r + p[2]) ** 2) return true;
    }
    return false;
  };
  const reg = (x, z, r = 0) => { const k = Math.floor(x / 4) + ',' + Math.floor(z / 4); (grid.get(k) || grid.set(k, []).get(k)).push([x, z, r]); };
  // ───────── pass 2: yapıları yerleştir ─────────
  let nS = 0;
  plan((x, z, ry, pad, fn, o = {}) => {
    const k = nS++;
    for (const side of o.sides || [1, -1]) {
      const wx = side * x, wz = side * z, wry = side > 0 ? ry : ry + PI;
      const y0 = terrain.heightAt(wx, wz), n0 = b.colliders.length, m0 = mark();
      b.obj('yer:' + k + (side > 0 ? 'm' : 'k'), () => b.with(wx, y0, wz, wry, () => {
        const M = b.M;
        const gy = (lx, lz) => { const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(M); return terrain.heightAt(v.x, v.z) - y0; };
        // at: alt nesneyi kendi zeminine koy, sonra en çok boşta kalan alt köşesi zemine değene kadar indir (yamaçta havada kalmaz)
        // sub: alt nesneye kendi kimliği (yer:N/k) — editörde ayrı seçilir, denetimde grup içi çakışma da görünür
        let ns = 0;
        const sub = (f) => b.obj(b.curOid + '/' + ns++, f);
        fn({ side, gy, sub, at: (lx, lz, f) => sub(() => { const m = mark(); b.with(lx, gy(lx, lz), lz, 0, f); settle(m); }) });
      }));
      if (pad[0] <= 0.5 && pad[1] <= 0.5) settle(m0);                              // düzlüksüz tekil nesne (sandık, fener, saman, kuyu…): bütün olarak zemine oturt
      // zemine dayanan alçak çarpışmaları (sandık, kaya, duvar parçası) eğimde altı boş kalıyorsa yere kadar uzat:
      // havada asılı kutu, altından geçen oyuncuyu araziye gömüp sıkıştırmasın
      for (let i = n0; i < b.colliders.length; i++) {
        const c = b.colliders[i];
        if (c.tag || c.max[1] - c.min[1] >= 2.4 || c.min[1] - y0 > 0.35) continue;
        const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2;
        const lo = Math.min(terrain.heightAt(cx, cz), terrain.heightAt(c.min[0], c.min[2]), terrain.heightAt(c.max[0], c.min[2]), terrain.heightAt(c.min[0], c.max[2]), terrain.heightAt(c.max[0], c.max[2]));
        if (c.min[1] > lo + 0.12) c.min[1] = lo - 0.1;
      }
      if (pad[0] < 3.2 && pad[1] < 3.2) {                // küçük nesneler (kaya, fener, sandık, saman): ağaç aralığı bırak — nesnenin kendi yarıçapı kadar fazlası
        let r = 0; for (let i = n0; i < b.colliders.length; i++) { const c = b.colliders[i]; r = Math.max(r, Math.hypot(Math.max(Math.abs(c.min[0] - wx), Math.abs(c.max[0] - wx)), Math.max(Math.abs(c.min[2] - wz), Math.abs(c.max[2] - wz)))); }
        reg(wx, wz, Math.min(r, 4));
      }
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
      b.obj('fener:' + t.name + ':' + i, () => b.with(x, terrain.heightAt(x, z), z, 0, () => V.lantern(b, 3.1)));
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
      if (Math.abs(x - bx) < 13 && Math.abs(z) < 7) return false;                                 // taş köprü ve başları
      for (const sz of [-46.5, 46.5]) if (Math.abs(x) < 11.5 && Math.abs(z - sz) < 4.5) return false;   // asma köprüler (ağaç tabliyenin üstünde bitiyordu)
    }
    return true;
  };
  // gövde tabanı: gövde çemberindeki en alçak zemin (yamaçta gövdenin alt kenarı havada kalmasın; yaprak / bot görüşü küreleri gövdeyle birlikte iner)
  const trunkY = (x, z, r) => { let lo = terrain.heightAt(x, z); for (let k = 0; k < 8; k++) lo = Math.min(lo, terrain.heightAt(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r)); return lo - 0.04; };
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
    const s = 0.9 + rng() * 0.8;
    b.obj('ağaç:' + nTrees, () => { if (rng() > (az > 26 ? 0.14 : 0.55)) K.pine(b, rng, x, z, s, trunkY(x, z, 0.24 * s)); else K.oak(b, rng, x, z, s * 0.95, trunkY(x, z, 0.3 * s * 0.95)); });
    reg(x, z); nTrees++;
  }
  // çalılar (siper, çarpışmasız)
  for (let i = 0; i < 260; i++) {
    const x = -90 + rng() * 180, z = -62 + rng() * 124;
    if (!okTree(x, z, 1.3) || near(x, z, 1.2)) continue;
    const h = terrain.heightAt(x, z), sc = 0.7 + rng() * 0.5;
    b.obj('çalı:' + i, () => {
    b.ico(x, h + 0.35, z, sc, rng() > 0.5 ? '#4f7a33' : '#5d8a3a', { scale: [1.2, 0.8, 1.2] });
    b.softCover(x, h + 0.35, z, sc * 0.8);                                          // bot görüşü: çalı da yaprak sayılır (oyuncu arkasını göremiyordu, bot görüyordu)
    if (rng() > 0.6) { b.ico(x + 0.8, h + 0.25, z + 0.5, sc * 0.7, '#5d8a3a', { scale: [1.2, 0.8, 1.2] }); b.softCover(x + 0.8, h + 0.25, z + 0.5, sc * 0.56); }
    });
  }
  // serpiştirilmiş kayalar (çarpışmalı, uzun görüş hatlarını böler)
  let nR = 0;
  for (let i = 0; i < 400 && nR < 70; i++) {
    const x = -88 + rng() * 176, z = -60 + rng() * 120;
    const s = 0.9 + rng() * 1.3, rr = s * 1.07;                                   // kayanın yatay yarıçapı (ico 0,82·s × 1,3)
    if (!okTree(x, z, 2.4 + rr * 0.5) || near(x, z, rr + 0.9) || Math.abs(z) < 8 && Math.abs(x) < 30) continue;   // ağaç gövdesine / yapıya girmesin
    b.obj('kaya:' + nR, () => V.rock(b, rng, x, z, s, terrain.heightAt(x, z)));
    reg(x, z, rr); nR++;
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
