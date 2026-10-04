import { MapBuilder, makeRng } from './builder.js';
import * as K from './kit.js';
import * as M from './kitMil.js';
import { COL } from './kit.js';

// Harita 3 — ASKERİ ÜS (v2)
// 160 × 120 m. Mavi batıda, Kırmızı doğuda kendi KAPALI kampında doğar (3,2 m beton duvar, 5 kapı, kapı önünde siper duvarı).
// Katmanlar: dış halka (kamp avluları, köşe depoları, duvar dibi koridorlar) → orta halka (kışla/revir/yemekhane, benzin istasyonu,
// hangar-2, tüneller, bunkerler, kontrol/gözetleme kuleleri) → iç çekirdek (3 katlı Komuta Binası).
// 180° döndürme simetrisi (x,z)→(−x,−z): kuzeybatı ↔ güneydoğu, kuzeydoğu ↔ güneybatı yapı yerleşimi eşdeğer ama içerikler farklı.
// Hedefler: Hangar (K, çekirdek), Komuta Binası (merkez, çekirdek), Radar (G, çekirdek), Kışla (B), Akaryakıt (D).

export const US_BOUNDS = { minX: -80, maxX: 80, minZ: -60, maxZ: 60 };

const { CONC, CONC_D, STEEL } = M;
const rot = (b, fn) => b.with(0, 0, 0, Math.PI, fn);
const PI = Math.PI;

// ───────────────────────── Zemin, yollar ─────────────────────────
function ground(b, rng) {
  b.box(0, -1.0, 0, 900, 1.0, 900, '#667049', { collide: false });
  b.box(0, 0, 0, 164, 0.04, 124, '#6c7173', { collide: false });
  const slab = ['#686d70', '#72777a', '#63696b'];
  for (let i = 0; i < 80; i++) b.box(-78 + rng() * 156, 0.04, -58 + rng() * 116, 5 + rng() * 9, 0.012, 5 + rng() * 9, slab[i % 3], { collide: false });
  for (const s of [-1, 1]) b.box(s * 68, 0.045, 0, 24, 0.02, 48, '#7a745f', { collide: false });                // kamp çakılı
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) b.box(s * (58.5 + rng() * 19), 0.056, -22 + rng() * 44, 2 + rng() * 3, 0.01, 1.5 + rng() * 3, '#6a6451', { collide: false });
  const A = '#41444a';
  b.box(0, 0.05, 0, 152, 0.02, 10, A, { collide: false });                              // doğu-batı ana cadde
  b.box(0, 0.05, 0, 8, 0.02, 114, A, { collide: false });                               // kuzey-güney cadde
  b.box(0, 0.055, 0, 30, 0.02, 24, '#585c61', { collide: false });                      // komuta meydanı
  for (let x = -76; x <= 76; x += 4) if (Math.abs(x) > 17) b.box(x, 0.07, 0, 2, 0.015, 0.2, COL.yellow, { collide: false });
  for (let z = -58; z <= 58; z += 4) if (Math.abs(z) > 14) b.box(0, 0.07, z, 0.2, 0.015, 2, COL.yellow, { collide: false });
  // yol kenarı pist ışıkları (gece parlar)
  for (let x = -50; x <= 50; x += 6) if (Math.abs(x) > 16) for (const sz of [-5.3, 5.3]) b.box(x, 0.0, sz, 0.5, 0.14, 0.5, Math.abs(x) % 12 < 6 ? '#7dd0ff' : '#ffd98a', { collide: false, o: { glow: true } });
  for (let z = -52; z <= 52; z += 6) if (Math.abs(z) > 14) for (const sx of [-4.3, 4.3]) b.box(sx, 0.0, z, 0.5, 0.14, 0.5, Math.abs(z) % 12 < 6 ? '#7dd0ff' : '#ffd98a', { collide: false, o: { glow: true } });
  // aprona / servis şeritleri
  b.box(0, 0.052, -33, 36, 0.02, 6, '#5d6165', { collide: false });
  b.box(0, 0.052, 33, 36, 0.02, 6, '#5d6165', { collide: false });
  b.box(-36, 0.052, -36, 32, 0.02, 6, '#5d6165', { collide: false });
  b.box(36, 0.052, 36, 32, 0.02, 6, '#5d6165', { collide: false });
  b.box(0, 0.051, -47, 8, 0.02, 24, '#51555a', { collide: false });
}

// ───────────────────────── Çevre duvarı ─────────────────────────
function perimeter(b, rng) {
  const WH = 3.4;
  b.box(0, 0, -60.6, 163.4, WH, 1.2, CONC);
  b.box(0, 0, 60.6, 163.4, WH, 1.2, CONC);
  b.box(-80.6, 0, 0, 1.2, WH, 122, CONC);
  b.box(80.6, 0, 0, 1.2, WH, 122, CONC);
  for (const [px, pz, w, d] of [[0, -60.6, 164, 1.5], [0, 60.6, 164, 1.5], [-80.6, 0, 1.5, 122], [80.6, 0, 1.5, 122]]) b.box(px, WH, pz, w, 0.2, d, CONC_D, { collide: false });
  for (let x = -76; x <= 76; x += 8) { b.box(x, 0, -59.7, 0.7, WH + 0.25, 0.5, CONC_D, { collide: false }); b.box(x, 0, 59.7, 0.7, WH + 0.25, 0.5, CONC_D, { collide: false }); }
  for (let z = -52; z <= 52; z += 8) { b.box(-79.7, 0, z, 0.5, WH + 0.25, 0.7, CONC_D, { collide: false }); b.box(79.7, 0, z, 0.5, WH + 0.25, 0.7, CONC_D, { collide: false }); }
  // duvar projektörleri
  for (let x = -68; x <= 68; x += 17) { M.floodLight(b, x, 3.4, -59.55, -PI / 2); M.floodLight(b, x, 3.4, 59.55, PI / 2); }
  for (const z of [-40, -12, 12, 40]) { M.floodLight(b, -79.55, 3.4, z, 0); M.floodLight(b, 79.55, 3.4, z, PI); }
  // köşe kuleleri (içine girilir, merdivenle çıkılır)
  M.guardTower(b, rng, { x: -75.5, z: -55.5, ry: 0, wall: '#7d8a74', glass: false });
  M.guardTower(b, rng, { x: 75.5, z: -55.5, ry: 0, wall: '#7d8a74' });
  M.guardTower(b, rng, { x: -75.5, z: 55.5, ry: PI, wall: '#7d8a74' });
  M.guardTower(b, rng, { x: 75.5, z: 55.5, ry: PI, wall: '#7d8a74' });
}

// ───────────────────────── Kamp (mavi yerel çerçeve: x<0) ─────────────────────────
// Kırmızı kamp aynı yerleşimin 180° döndürülmüş hâli. pal: renkler
function camp(b, rng, pal) {
  const WH = 5.4, T = 0.8;
  const wallBox = (x, z, w, d) => { b.box(x, 0, z, w, WH, d, CONC); b.box(x, WH, z, w + (w > d ? 0 : 0.3), 0.18, d + (w > d ? 0.3 : 0), CONC_D, { collide: false }); };
  // doğu duvarı (x=-56): kapılar z=0 (geniş), ±15
  const gates = [[-3, 3], [-16.6, -13.4], [13.4, 16.6]];
  const segs = [[-24, -16.6], [-13.4, -3], [3, 13.4], [16.6, 24]];
  for (const [a, c] of segs) wallBox(-56, (a + c) / 2, T, c - a);
  // kuzey/güney duvarı (z=±24): kapı x=-67 (3.2 m)
  for (const sz of [-1, 1]) for (const [a, c] of [[-80, -68.6], [-65.4, -56]]) wallBox((a + c) / 2, sz * 24, c - a, T);
  // kapı sütunları + üst kirişler (bayrak şeridi)
  const post = (x, z) => { b.box(x, 0, z, 1.0, 5.4, 1.0, STEEL); b.box(x, 5.4, z, 1.2, 0.15, 1.2, '#3f444b', { collide: false }); };
  for (const [a, c] of gates) { post(-56, a - 0.5); post(-56, c + 0.5); b.box(-56, 3.0, (a + c) / 2, 0.8, 1.8, c - a, CONC); b.box(-56, 3.5, (a + c) / 2, 0.86, 0.45, c - a + 0.2, pal.stripe, { collide: false }); b.box(-56, 3.1, (a + c) / 2, 0.86, 0.1, c - a + 0.2, '#e8e8e4', { collide: false }); }
  for (const sz of [-1, 1]) { post(-68.6 - 0.5, sz * 24); post(-65.4 + 0.5, sz * 24); b.box(-67, 3.0, sz * 24, 3.2, 1.8, 0.8, CONC); b.box(-67, 3.5, sz * 24, 3.4, 0.45, 0.86, pal.stripe, { collide: false }); b.box(-67, 3.1, sz * 24, 3.4, 0.1, 0.86, '#e8e8e4', { collide: false }); }
  // kapı lambaları
  for (const [a, c] of gates) for (const zz of [a - 0.5, c + 0.5]) b.box(-56 + 0.6, 2.8, zz, 0.2, 0.2, 0.4, '#ffe2a0', { collide: false, o: { glow: true } });
  for (const [a, c] of gates) { M.lightPool(b, -53.9, (a + c) / 2, 2.8, pal.glow, 0.09, 0.5); M.lightPool(b, -58.2, (a + c) / 2, 3.0, pal.glow, 0.09, 0.5); }
  for (const sz of [-1, 1]) { M.lightPool(b, -67, sz * 24 - sz * 2.6, 2.8, pal.glow, 0.09, 0.5); M.lightPool(b, -67, sz * 24 + sz * 2.6, 2.8, pal.glow, 0.09, 0.5); }
  // kapı önü siper duvarları (düşman görüşünü keser, kamp içinden/dışından)
  // tek sıra şikan perdesi (x=-52.8): kapıların önünde, aralarda 2 m'lik geçit (arkada kamp duvarı var → içeri görüş yok)
  M.blastWall(b, -52.8, 0, 15, PI / 2);                 // orta kapı
  M.blastWall(b, -52.8, -15.5, 12, PI / 2);             // KD kapısı
  M.blastWall(b, -52.8, 15.5, 12, PI / 2);              // GD kapısı
  M.blastWall(b, -67, -28.4, 13, 0);                    // kuzey kapı
  M.blastWall(b, -67, 28.4, 13, 0);                     // güney kapı
  // içeriden ikinci perde: orta kapının iç tarafında alçak Hesco (yalnız göğüs hizası, bakış tamamen kesilmez; saldırgan engeli)
  M.hesco(b, -59.5, -6.5, 3.2, PI / 2); M.hesco(b, -59.5, 6.5, 3.2, PI / 2);

  // çadır sırası (batı duvarı boyunca), kapılar +x'e açık
  const tcol = pal.tent;
  const tents = [[-19.5, 'medical'], [-13, 'barracks'], [-6.5, 'radio'], [0, 'ops'], [6.5, 'armory'], [13, 'barracks'], [19.5, 'generator']];
  for (const [tz, kind] of tents) M.tent(b, rng, { x: -77.2, z: tz, ry: PI / 2, w: 5.2, d: kind === 'ops' ? 5.2 : 4.6, color: kind === 'ops' ? pal.tentCmd : tcol, kind, big: kind === 'ops' });
  for (const tz of [-19.5, 0, 19.5]) b.box(-72.4, 3.1, tz, 0.12, 0.5, 2.2, pal.stripe, { collide: false });
  // revir tabelası (kızıl haç) + komut sancağı
  b.box(-74.7, 1.9, -19.5, 0.1, 0.9, 0.9, '#f2f2ee', { collide: false }); b.box(-74.62, 2.1, -19.5, 0.06, 0.5, 0.2, '#c0392b', { collide: false }); b.box(-74.62, 2.1, -19.5, 0.06, 0.2, 0.5, '#c0392b', { collide: false });
  M.flagPole(b, -64.5, 9, pal.flag);
  // avlu siperleri/dekor
  K.crate(b, -71, -11, 1.2); K.crate(b, -71, -9.8, 1.1, 0, 0.3); K.crate(b, -70.9, -10.4, 1.0, 1.2);
  K.crate(b, -71, 11, 1.2); K.crate(b, -69.7, 11.2, 1.0);
  K.barrel(b, -72.6, 22, '#556b2f'); K.barrel(b, -72.6, 21.1, '#556b2f'); K.barrel(b, -71.8, 21.6, '#c0392b');
  M.mgNest(b, -61.5, -10.5, PI / 2 * 0 + PI / 2); M.mgNest(b, -61.5, 10.5, PI / 2);
  K.sandbags(b, -66, -17.5, 4, 0); K.sandbags(b, -66, 17.5, 4, 0);
  M.hesco(b, -68, -4.6, 3.0, 0); M.hesco(b, -68, 4.6, 3.0, 0);
  M.jeep(b, { x: -61.5, z: -20.6, ry: 0, color: '#5e6b4a' }); M.camoNet(b, rng, { x: -61.5, z: -20.6, w: 7, d: 5, h: 3.2 });
  M.ambulance(b, { x: -63.5, z: 20.5, ry: PI }); M.camoNet(b, rng, { x: -63.0, z: 20.5, w: 8, d: 5, h: 3.4 });
  // masa + bank (avlu)
  b.box(-68.5, 0.72, -15.8, 2.2, 0.08, 0.9, COL.woodLight); b.collide(-68.5, 0, -15.8, 2.2, 0.8, 0.9);
  b.box(-68.5, 0.42, -14.9, 2.2, 0.08, 0.45, COL.woodDark, { collide: false }); b.box(-68.5, 0.42, -16.7, 2.2, 0.08, 0.45, COL.woodDark, { collide: false });
  // ışıklar
  for (const [lx, lz] of [[-65, -13], [-65, 13], [-73.5, -8.9], [-73.5, 8.9], [-60, -21], [-60, 21]]) M.lampPost(b, lx, lz, { ry: PI });
  for (const lz of [-3.25, 3.25, -16.25, 16.25]) M.fireBarrel(b, -72.7, lz);
  for (const [bx, bz] of [[-64, -2], [-64, 2], [-70, -2], [-70, 2]]) M.bollardLight(b, bx, bz);
  M.floodLight(b, -56.6, 3.2, -8.5, PI); M.floodLight(b, -56.6, 3.2, 8.5, PI);
}

// ───────────────────────── Komuta Binası ─────────────────────────
function komuta(b, rng) {
  const hall = (f) => ({ f, kind: 'hallway', x0: -9.65, x1: -5.0, z0: -6.65, z1: 6.65 });
  const corr = (f) => ({ f, kind: 'hallway', x0: -5.0, x1: -1.8, z0: -6.65, z1: 6.65 });
  const E = (f, kind, qx, qz) => ({ f, kind, x0: qx === 0 ? -1.8 : 4, x1: qx === 0 ? 4 : 9.65, z0: qz === 0 ? -6.65 : 0, z1: qz === 0 ? 0 : 6.65 });
  const R = M.milBuilding(b, rng, {
    x: 0, z: 0, w: 20, d: 14, floors: 3, fh: 3.2, wall: '#8a9189', roof: '#4c5156', floorColor: '#6f746d', dw: 2.0,
    doors: { n: [-3.4], s: [-3.4, 6.8], e: [-3.4, 3.4], w: [3.4] },
    stairs: [
      { x: -8.4, z: -5.4, dir: '+z', w: 1.5 },
      { x: -6.3, z: 1.3, dir: '-z', w: 1.5 },
      { x: -8.4, z: -5.4, dir: '+z', w: 1.5 },
    ],
    parts: [
      { axis: 'z', c: -5.0, a0: -6.65, a1: 6.65, doors: [{ at: 3.4, w: 1.8 }] },
      { axis: 'z', c: -1.8, a0: -6.65, a1: 6.65, doors: [{ at: -3.4, w: 1.8 }, { at: 3.4, w: 1.8 }] },
      { axis: 'x', c: 0, a0: -1.8, a1: 9.65, doors: [{ at: 1.1, w: 1.8 }, { at: 6.8, w: 1.8 }], floors: [0, 1] },
      { axis: 'z', c: 4, a0: -6.65, a1: -0.1, doors: [{ at: -3.4, w: 1.8 }], floors: [0, 1] },
      { axis: 'z', c: 4, a0: 0.1, a1: 6.65, doors: [{ at: 3.4, w: 1.8 }], floors: [0, 1] },
    ],
    rooms: [
      hall(0), hall(1), hall(2), corr(0), corr(1), corr(2),
      E(0, 'radio', 0, 0), E(0, 'ops', 1, 0), E(0, 'guard', 0, 1), E(0, 'armory', 1, 1),
      E(1, 'office', 0, 0), E(1, 'computers', 1, 0), E(1, 'lounge', 0, 1), E(1, 'ops', 1, 1),
      { f: 2, kind: 'war', x0: -1.8, x1: 9.65, z0: -6.65, z1: 6.65 },
    ],
    winStyle: { 2: 'wide' },
  });
  const H = R.H;
  // çatı: anten, klima, kasa siperleri, sancak
  b.box(2, H, -2, 0.3, 4.6, 0.3, '#2a2d30', { collide: false }); b.box(2, H + 4.6, -2, 3.0, 0.1, 0.1, '#2a2d30', { collide: false });
  b.box(2, H + 5.0, -2, 0.2, 0.2, 0.2, '#ff2b2b', { collide: false, o: { glow: true } });
  b.box(6.5, H, 3.5, 2.6, 1.0, 1.6, STEEL); b.box(6.5, H + 1.0, 3.5, 2.7, 0.12, 1.7, '#8a929b', { collide: false });
  b.box(5.5, H, -4.5, 1.6, 1.0, 1.6, '#7b8660'); b.box(-2.5, H, 4.4, 1.6, 0.9, 1.0, '#7b8660');
  b.box(8.6, H, 0.4, 0.2, 0.2, 0.2, '#fff6d6', { collide: false });
  M.floodLight(b, 9.6, H + 0.1, 5.8, PI / 2 * 3); M.floodLight(b, -4, H + 0.1, -5.7, PI / 2);
  // çevre: kum torbası perdeleri, bariyerler, lamba
  for (const [x, z, ry] of [[-12.5, 10, 0], [12.5, 10, 0], [-12.5, -10, 0], [12.5, -10, 0]]) M.blastWall(b, x, z, 4.5, ry, 1.6, 0.6);
  K.sandbags(b, -3.5, 11, 4, 0); K.sandbags(b, 8, 11, 4, 0); K.sandbags(b, -3.5, -11, 4, 0); K.sandbags(b, 8, -11, 4, 0);
  K.sandbags(b, 11.6, 4.5, 3.4, PI / 2); K.sandbags(b, -12.6, -4, 3.4, PI / 2);
  M.mgNest(b, 13.5, -8, -PI / 2); M.mgNest(b, -13.5, 8, PI / 2);
  for (const [x, z] of [[-9, 8.5], [10, -8.5], [-14.5, 0], [14.5, 0]]) M.lampPost(b, x, z, { ry: x < 0 ? 0 : PI });
  M.flagPole(b, 12.3, 7.2, '#c8c8c0'); M.flagPole(b, -12.3, -7.2, '#c8c8c0');
}

// ───────────────────────── Hangar kompleksi (kuzey) ─────────────────────────
function hangarComplex(b, rng) {
  M.hangar(b, rng, { x: 0, z: -45, w: 30, d: 18, openW: 14, color: '#7d857f', label: '#2d5a8a' });
  M.helicopter(b, { x: -6, z: -42, ry: PI / 2 });
  M.plane(b, { x: 6.5, z: -43, ry: 0 });
  K.barrel(b, 12.8, -38, '#c0392b'); K.barrel(b, 12.0, -38, '#c0392b'); K.barrel(b, 12.4, -38.8, '#556b2f');
  K.crate(b, -13, -38, 1.1); K.crate(b, -13, -39.2, 1.0); K.crate(b, -11.8, -38.2, 0.9);
  b.box(-12.8, 0, -47, 0.9, 1.0, 1.9, '#d9a921'); b.box(13.2, 0, -48, 1.4, 1.0, 1.0, '#c0392b');    // forklift/koli
  // dış: yakıt tankeri + siperler, kapı önü blok duvarları (yaklaşım yollarını şekillendirir)
  M.tanker(b, { x: -24, z: -29.5, ry: 0 });
  M.blastWall(b, -10, -31, 5, 0, 1.6, 0.6); M.blastWall(b, 10, -31, 5, 0, 1.6, 0.6);
  K.sandbags(b, 0, -29, 5, 0);
  M.blastWall(b, -19, -52, 5, PI / 2);          // arka kapı gölgeliği
  K.container(b, { x: 0, z: -57, ry: 0, color: '#2d5a8a' }); K.container(b, { x: 0, z: -57, y: 2.6, ry: 0, color: '#8a6a2d' });
  for (const [x, z] of [[-17, -36], [17, -36], [-5, -34], [5, -34]]) M.lampPost(b, x, z, { ry: x < 0 ? 0 : PI });
  for (const [x, z] of [[-17, -57], [17, -57]]) M.lampPost(b, x, z, { ry: -PI / 2 });
}

// ───────────────────────── Radar kompleksi (güney) ─────────────────────────
function radarComplex(b, rng) {
  M.radarTower(b, rng, { x: 0, z: 44 });
  // jeneratör odası
  M.milBuilding(b, rng, {
    x: 15, z: 45, w: 9, d: 7, floors: 1, fh: 3.2, wall: '#7d8a7a', roof: '#4c5156', floorColor: '#5f6468', roofAccess: false, parapet: 0, dw: 1.8,
    doors: { n: [0], w: [0], s: [-2] },
    rooms: [{ f: 0, kind: 'generator', x0: -4.5 + 0.35, x1: 4.5 - 0.35, z0: -3.5 + 0.35, z1: 3.5 - 0.35 }],
  });
  b.box(15, 3.2, 45, 9.4, 0.3, 7.4, STEEL, { collide: false });
  M.pipeRack(b, 5.6, 40, 11, 40, { y: 2.7 }); M.pipeRack(b, 19.5, 41, 30, 41, { y: 2.7 });
  
  M.hesco(b, -8, 36, 4, 0); M.hesco(b, 8, 36, 4, 0); K.sandbags(b, 0, 35.5, 4, 0);
  M.blastWall(b, -11, 44, 6, PI / 2); M.blastWall(b, 17, 36, 5, PI / 2, 1.6, 0.6);
  K.container(b, { x: -10, z: 54, ry: 0, color: '#556b2f' }); K.container(b, { x: 10, z: 55, ry: 0, color: '#2d5a8a' });
  K.crate(b, 7, 52, 1.2); K.crate(b, 8.3, 52.2, 1.0); K.barrel(b, 6, 53, '#556b2f'); K.barrel(b, 6.9, 53.3, '#c0392b');
  M.fenceRow(b, 3, 58.2, 25, 58.2, { h: 2.4 });
  M.pool(b, -22, 56.5, 8, 3.4);   // yangın havuzu
  for (const [x, z] of [[-6, 36], [6, 36], [-9, 53], [10, 49]]) M.lampPost(b, x, z, { ry: x < 0 ? 0 : PI });
  M.fireBarrel(b, 4.8, 50.5);
}

// ───────────────────────── Kuzeybatı orta halka (v=0) / Güneydoğu (v=1, 180° döndürülmüş) ─────────────────────────
function midNW(b, rng, v) {
  // ikinci hangar / atölye (v=1: depo hangarı)
  M.hangar(b, rng, { x: -40, z: -51, w: 24, d: 14, openW: 12, color: v ? '#8a8f86' : '#808a84', H: 7, mezzLen: 11.4, label: v ? '#8a6a2d' : '#556b2f' });
  if (!v) {
    M.apc(b, { x: -43, z: -50, ry: 0.0 }); M.jeep(b, { x: -34, z: -48, ry: PI / 2 });
    K.barrel(b, -26.4, -53.2, '#c0392b'); K.barrel(b, -25.6, -53.8, '#556b2f');
  } else {
    for (const [x, z] of [[-48, -54], [-46.6, -54.1], [-47.3, -54]]) K.crate(b, x, z, 1.2);
    K.container(b, { x: -37, z: -52, ry: PI / 2, color: '#8a6a2d' });
    K.crate(b, -33, -47, 1.2); K.crate(b, -31.8, -47.2, 1.0);
  }
  // tünel: batı ucu (-52,-36) → doğu ucu (-20,-36)
  M.tunnel(b, rng, { x: -36, z: -36, len: 32, iw: 3.6, ih: 3.0, color: v ? '#808880' : '#7f867d', sideDoors: [{ at: -8, side: 's', w: 2 }, { at: 4, side: 'n', w: 2 }], baffles: [{ at: -12, side: 'n' }, { at: 8, side: 's' }], roofStair: { at: -13, side: 'n', dir: '+x' } });
  // yemekhane (v=1: silah deposu)
  M.milBuilding(b, rng, {
    x: -36, z: -14, w: 14, d: 9, floors: 1, fh: 3.2, wall: v ? '#868c82' : '#8f9486', roof: '#4c5156', floorColor: '#6d7168', roofAccess: false, parapet: 0, dw: 2.0,
    doors: { n: [0], s: [-3, 3], w: [1.5], e: [1.5] },
    parts: v ? [] : [{ axis: 'x', c: -1.0, a0: -6.65, a1: 6.65, doors: [{ at: 3.0, w: 1.8 }, { at: -4.5, w: 1.8 }] }],
    rooms: v
      ? [{ f: 0, kind: 'store', x0: -6.65, x1: 6.65, z0: -4.15, z1: 4.15 }]
      : [{ f: 0, kind: 'kitchen', x0: -6.65, x1: 6.65, z0: -4.15, z1: -1.0 }, { f: 0, kind: 'mess', x0: -6.65, x1: 6.65, z0: -1.0, z1: 4.15 }],
  });
  b.box(-36, 3.2, -14, 14.4, 0.35, 9.4, '#4c5156', { collide: false });
  b.box(-36, 3.55, -14, 14.4, 0.2, 0.2, v ? '#8a6a2d' : '#c0392b', { collide: false });
  // bunkerler + siper
  M.bunker(b, { x: -29, z: -26, ry: PI / 2 });
  M.bunker(b, { x: -49, z: -24, ry: -PI / 2 });
  K.sandbags(b, -35.5, -27.5, 4, 0); K.sandbags(b, -43, -29, 4, 0);
  M.blastWall(b, -14, -29, 5, PI / 2); M.blastWall(b, -54, -30, 5, PI / 2);
  M.hesco(b, -42.5, -21, 4, 0); M.hesco(b, -24, -16.5, 3.6, 0);
  K.crate(b, -31, -21.8, 1.2); K.crate(b, -32.3, -21.9, 1.0); K.barrel(b, -30, -21.2, '#556b2f');
  // gözetleme kulesi (yüksek zemin)
  M.guardTower(b, rng, { x: -19, z: -23, ry: -PI / 2, wall: '#7d8a74' });
  // dekor: tank hurdası, yangın varili, lambalar
  M.tank(b, { x: -23, z: -47, ry: 0, wreck: true });
  for (const [x, z] of [[-17, -36], [-54, -36], [-36, -42], [-36, -30], [-46, -17], [-26, -17]]) M.lampPost(b, x, z, { ry: x < -36 ? 0 : PI });
  for (const [x, z] of [[-33, -42.5], [-41, -42.5]]) M.fireBarrel(b, x, z);
  M.camoNet(b, rng, { x: -46, z: -42, w: 9, d: 3, h: 3.0 });
}

// ───────────────────────── Kuzeydoğu: Akaryakıt + kontrol bölgesi ─────────────────────────
function midNE(b, rng) {
  K.gasStation(b, rng, { x: 34, z: -12 });
  // pompa dairesi
  M.milBuilding(b, rng, {
    x: 47, z: -12, w: 8, d: 6, floors: 1, fh: 3.2, wall: '#9a9f95', roof: '#4c5156', floorColor: '#65696a', roofAccess: false, parapet: 0, dw: 1.8,
    doors: { w: [0], s: [2] }, rooms: [{ f: 0, kind: 'office', x0: -3.65, x1: 3.65, z0: -2.65, z1: 2.65 }],
  });
  b.box(47, 3.2, -12, 8.4, 0.3, 6.4, '#c0392b', { collide: false });
  // tank çiftliği + havuz + borular
  for (const tx of [27, 33, 39]) M.fuelTank(b, { x: tx, z: -27, r: 2.8, h: 5 });
  M.pool(b, 47, -29, 6, 5, '#4a7a96');
  M.pipeRack(b, 24.5, -22, 40, -22, { y: 2.7, color: '#d9a921' }); M.pipeLow(b, 30, -24.6, 30, -22, {});
  M.pipeLow(b, 24, -17.6, 44, -17.6, { color: '#c0392b', gaps: [[29, 31.5], [37, 39.5]] });
  M.tanker(b, { x: 46, z: -22.5, ry: PI }); M.tanker(b, { x: 46, z: -18.8, ry: PI, color: '#b9b4a8', cab: '#7a3a2f' });
  K.barrel(b, 24.4, -12, '#c0392b'); K.barrel(b, 24.4, -13.1, '#c0392b'); K.barrel(b, 25.6, -12.5, '#d9a921');
  K.sandbags(b, 24, -6.5, 3.6, PI / 2);
  // jeneratör odası
  M.milBuilding(b, rng, {
    x: 18, z: -21.5, w: 9, d: 7, floors: 1, fh: 3.2, wall: '#7d8a7a', roof: '#4c5156', floorColor: '#5f6468', roofAccess: false, parapet: 0, dw: 1.8,
    doors: { e: [0], w: [0], s: [-1.5] }, rooms: [{ f: 0, kind: 'generator', x0: -4.5 + 0.35, x1: 4.5 - 0.35, z0: -3.5 + 0.35, z1: 3.5 - 0.35 }],
  });
  b.box(18, 3.2, -21.5, 9.4, 0.3, 7.4, STEEL, { collide: false });
  // helipad + kontrol kulesi + kamuflaj
  M.helipad(b, { x: 33, z: -47, r: 6.5 }); M.helicopter(b, { x: 33, z: -47, ry: PI / 2, color: '#3f4a5e' });
  M.controlTower(b, rng, { x: 22, z: -50, door: 's' });
  M.camoNet(b, rng, { x: 45, z: -51, w: 9, d: 8, h: 3.4 });
  K.truck(b, { x: 45, z: -51, ry: PI / 2, color: '#5e6b4a' });
  M.blastWall(b, 27, -39.5, 5, 0); M.blastWall(b, 18, -34, 5, PI / 2);
  K.container(b, { x: 54, z: -55, ry: 0, color: '#2d5a8a' }); K.container(b, { x: 40, z: -57, ry: 0, color: '#8a3a2d' });
  M.tank(b, { x: 22.5, z: -41.5, ry: PI, wreck: true });
  // hendek: helipad ile benzin istasyonu arası
  M.trench(b, 23, -33, 39, -33, 2.6);
  M.mgNest(b, 26, -36.5, PI); M.mgNest(b, 35, -37.2, PI);
  // kule (yüksek zemin)
  M.guardTower(b, rng, { x: 45, z: -38, ry: -PI / 2, wall: '#7d8a74' });
  for (const [x, z] of [[28, -4.5], [45, -5], [30, -37.5], [40, -45], [29, -44], [22, -15]]) M.lampPost(b, x, z, { ry: x < 36 ? 0 : PI });
}

// ───────────────────────── Güneybatı: Kışla kompleksi ─────────────────────────
function midSW(b, rng) {
  const dorm = (x, z, doors) => M.milBuilding(b, rng, {
    x, z, w: 20, d: 8, floors: 1, fh: 3.2, wall: '#7c8478', roof: '#4c5156', floorColor: '#7a7468', roofAccess: false, parapet: 0, dw: 2.0,
    doors, parts: [{ axis: 'z', c: 0, a0: -3.65, a1: 3.65, doors: [{ at: 0, w: 1.8 }] }],
    rooms: [{ f: 0, kind: 'barracks', x0: -9.65, x1: 0, z0: -3.65, z1: 3.65 }, { f: 0, kind: 'barracks', x0: 0, x1: 9.65, z0: -3.65, z1: 3.65 }],
  });
  dorm(-36, 12, { n: [-5.5, 5.5], s: [-5.5, 5.5], w: [0], e: [0] });
  dorm(-36, 25, { n: [-5.5, 5.5], s: [-5.5, 5.5], w: [0], e: [0] });
  for (const z of [12, 25]) { b.box(-36, 3.2, z, 20.4, 0.35, 8.4, '#4c5156', { collide: false }); b.box(-36, 3.55, z, 20.4, 0.2, 0.2, '#2b6fd6', { collide: false }); }
  // revir
  M.milBuilding(b, rng, {
    x: -19, z: 22, w: 9, d: 7, floors: 1, fh: 3.2, wall: '#d2d6d0', roof: '#4c5156', floorColor: '#c9ccc6', roofAccess: false, parapet: 0, dw: 1.8,
    doors: { s: [-1.5], n: [1.5], e: [0] }, rooms: [{ f: 0, kind: 'medical', x0: -4.15, x1: 4.15, z0: -3.15, z1: 3.15 }],
  });
  b.box(-19, 3.2, 22, 9.4, 0.3, 7.4, '#c0392b', { collide: false });
  M.ambulance(b, { x: -19, z: 29, ry: PI / 2 * 0 });
  // silah deposu (güney-orta)
  M.milBuilding(b, rng, {
    x: -40, z: 47, w: 18, d: 11, floors: 1, fh: 3.4, wall: '#868c82', roof: '#4c5156', floorColor: '#65696a', roofAccess: false, parapet: 0, dw: 2.0,
    doors: { n: [-5, 5], s: [0], e: [0], w: [0] }, rooms: [{ f: 0, kind: 'armory', x0: -8.65, x1: 8.65, z0: -5.15, z1: 5.15 }],
  });
  b.box(-40, 3.4, 47, 18.4, 0.35, 11.4, '#4c5156', { collide: false }); b.box(-40, 3.75, 47, 18.4, 0.2, 0.2, '#c0392b', { collide: false });
  // yan siperler
  K.sandbags(b, -24.5, 12, 3.4, PI / 2); K.sandbags(b, -47.5, 18.5, 3.2, PI / 2); M.hesco(b, -36, 18.5, 5, 0);
  K.barrel(b, -48.5, 12, '#556b2f'); K.barrel(b, -48.5, 13, '#556b2f'); K.crate(b, -23, 17, 1.2); K.crate(b, -23, 18.3, 1.0);
  M.bunker(b, { x: -24, z: 36, ry: -PI / 2 }); M.bunker(b, { x: -50, z: 36, ry: PI / 2 });
  K.sandbags(b, -31, 32, 4, 0); M.blastWall(b, -54, 31, 5, PI / 2); M.blastWall(b, -18, 33, 5, PI / 2);
  M.guardTower(b, rng, { x: -21, z: 49, ry: -PI / 2, wall: '#7d8a74' });
  M.apc(b, { x: -31, z: 56.5, ry: PI, wreck: true }); M.tank(b, { x: -50, z: 55, ry: 0.0, wreck: true });
  M.mgNest(b, -52, 44, PI / 2); M.mgNest(b, -27, 41, -PI / 2);
  for (const [x, z] of [[-46, 3.5], [-26, 3.5], [-47, 30], [-26, 29], [-33, 40], [-47, 41], [-27, 54]]) M.lampPost(b, x, z, { ry: x < -36 ? 0 : PI });
  M.fireBarrel(b, -22.5, 14);
}

// ───────────────────────── Köşe avluları ─────────────────────────
// Kuzeybatı avlusu: garaj sırası + helikopter pisti + araç parkı (v=1 → güneydoğu, döndürülmüş)
function yardGarage(b, rng, v) {
  const col = v ? '#8a3a2d' : '#2d5a8a';
  M.garageRow(b, rng, {
    x: -63, z: -55, bays: 3, bw: 5.6, d: 8, h: 4.2, wall: '#7d857f',
    vehicles: [(bb, cx, cz) => M.jeep(bb, { x: cx, z: cz, ry: -PI / 2 }), (bb, cx, cz) => M.apc(bb, { x: cx, z: cz, ry: -PI / 2 }), (bb, cx, cz) => M.ambulance(bb, { x: cx, z: cz, ry: -PI / 2 })],
  });
  M.helipad(b, { x: -67, z: -38, r: 6 }); M.helicopter(b, { x: -67, z: -38, ry: -0.0 + PI / 2, color: v ? '#6a3f35' : '#3f4a5e' });
  K.truck(b, { x: -77, z: -44, ry: PI / 2, color: col }); M.camoNet(b, rng, { x: -77, z: -44, w: 5.5, d: 10, h: 3.2 });
  K.container(b, { x: -77.2, z: -33.5, ry: PI / 2, color: '#556b2f' });
  M.blastWall(b, -58, -45, 6, PI / 2);
  K.crate(b, -57, -50, 1.1); K.barrel(b, -73.5, -57.3, '#c0392b'); K.barrel(b, -74.5, -57.3, '#556b2f');
  M.mgNest(b, -58.5, -32.5, PI / 2); M.fireBarrel(b, -70, -49.5);
  for (const [x, z] of [[-72, -31], [-59, -31], [-58, -49], [-72, -48]]) M.lampPost(b, x, z, { ry: x < -65 ? 0 : PI });
}

// Güneybatı avlusu: konteyner labirenti (v=1 → kuzeydoğu, döndürülmüş)
function yardMaze(b, rng, v) {
  const C = ['#2d5a8a', '#8a6a2d', '#556b2f', '#8a3a2d', '#6b6f78', '#3b6a9a'];
  let ci = v ? 3 : 0;
  const c = (x, z, ry = 0, y = 0, len = 6.1) => K.container(b, { x, z, ry, y, len, color: C[ci++ % C.length] });
  // satırlar (z = 32.5 / 39.5 / 46.5), aralarda ≥1.9 m geçit
  c(-75.5, 32.5); c(-66.5, 32.5); c(-58.5, 32.5);
  c(-72, 39.5); c(-62.5, 39.5);
  c(-76, 46.5); c(-67.5, 46.5); c(-58.5, 46.5);
  c(-72, 39.5, 0, 2.6); c(-66.5, 32.5, 0, 2.6); c(-67.5, 46.5, 0, 2.6);
  // çapraz kısa bloklar (şikan)
  c(-78.4, 37.0, PI / 2, 0, 4.6); c(-56.6, 37.4, PI / 2, 0, 3.0);
  K.crate(b, -64.5, 36, 1.2); K.crate(b, -65.8, 36.1, 1.0); K.crate(b, -74, 43.2, 1.2); K.barrel(b, -60.5, 43, '#c0392b'); K.barrel(b, -61.4, 43.3, '#556b2f');
  K.crate(b, -69.5, 50.5, 1.2); K.crate(b, -70.7, 50.6, 1.0, 0, 0.0);
  // konteyner üstü nişancı yuvası: merdivenle çıkılır
  b.stairs(-51.5, 46.5, 0, '-x', 1.4, 13, 0.2, 0.3, '#8b8f88');            // doğu ucundan tepeye (y=2.6)
  b.with(-58.5, 2.6, 46.5, 0, () => { K.sandbags(b, 0.4, -0.9, 3.4, 0); K.sandbags(b, -2.5, 0, 2.0, PI / 2); K.crate(b, 1.8, 0.4, 0.8); });
  M.lampPost(b, -70, 36, { ry: 0 }); M.lampPost(b, -63, 43, { ry: PI }); M.lampPost(b, -74, 30, { ry: 0 }); M.lampPost(b, -60, 51, { ry: PI });
  M.fireBarrel(b, -78, 42); M.fireBarrel(b, -57, 41);
  M.pipeRack(b, -79, 51, -57, 51, { y: 2.8, color: '#d9a921', spacing: 7 });
}

// ───────────────────────── Ana cadde siperleri (batı yarısı; doğu yarısı 180° döndürülmüş) ─────────────────────────
// Caddeyi uzun bir atış koridoru olmaktan çıkarır: şikanlı bariyerler, hurda araçlar, kum torbası kümeleri (≥3 m geçit kalır).
function avenueCover(b, rng) {
  K.barrier(b, -47, -2.4, PI / 2); K.barrier(b, -44, 2.6, PI / 2);
  K.car(b, { x: -38.5, z: -3.3, ry: 0, wreck: true });
  K.sandbags(b, -33, 3.4, 4, 0);
  K.barrier(b, -28, -2.6, PI / 2); K.crate(b, -27.9, 1.6, 1.1); K.crate(b, -27.9, 2.8, 0.9);
  K.barrier(b, -22, 2.4, PI / 2); K.sandbags(b, -21, -3.6, 3.6, 0);
  K.car(b, { x: -17, z: 3.4, ry: PI, wreck: true });
  M.fireBarrel(b, -41, 0.2); M.fireBarrel(b, -24.5, -0.3);
}

// ───────────────────────── Dış çevre ─────────────────────────
function outside(b, rng) {
  // dış yol + güvenlik çiti + gözetleme ışıkları
  b.box(0, 0.01, -72, 200, 0.03, 7, '#4a4d52', { collide: false }); b.box(0, 0.01, 72, 200, 0.03, 7, '#4a4d52', { collide: false });
  b.box(-93, 0.01, 0, 7, 0.03, 150, '#4a4d52', { collide: false }); b.box(93, 0.01, 0, 7, 0.03, 150, '#4a4d52', { collide: false });
  for (let x = -96; x <= 96; x += 6) { b.box(x, 0.04, -72, 2.2, 0.01, 0.22, COL.white, { collide: false }); b.box(x, 0.04, 72, 2.2, 0.01, 0.22, COL.white, { collide: false }); }
  for (let z = -66; z <= 66; z += 6) { b.box(-93, 0.04, z, 0.22, 0.01, 2.2, COL.white, { collide: false }); b.box(93, 0.04, z, 0.22, 0.01, 2.2, COL.white, { collide: false }); }
  for (let x = -100; x <= 100; x += 5) for (const z of [-64.5, 64.5]) b.box(x, 0, z, 0.1, 2.2, 0.1, '#4a4d52', { collide: false });
  for (let z = -62; z <= 62; z += 5) for (const x of [-86, 86]) b.box(x, 0, z, 0.1, 2.2, 0.1, '#4a4d52', { collide: false });
  b.box(0, 0.1, -64.5, 200, 2.0, 0.03, '#6a6f74', { collide: false, o: { transparent: true, opacity: 0.3 } });
  b.box(0, 0.1, 64.5, 200, 2.0, 0.03, '#6a6f74', { collide: false, o: { transparent: true, opacity: 0.3 } });
  b.box(-86, 0.1, 0, 0.03, 2.0, 130, '#6a6f74', { collide: false, o: { transparent: true, opacity: 0.3 } });
  b.box(86, 0.1, 0, 0.03, 2.0, 130, '#6a6f74', { collide: false, o: { transparent: true, opacity: 0.3 } });
  for (let x = -60; x <= 60; x += 40) { M.lampPost(b, x, -68.5, { ry: -PI / 2 }); M.lampPost(b, x, 68.5, { ry: PI / 2 }); }
  for (const z of [-40, 0, 40]) { M.lampPost(b, -89.5, z, { ry: 0 }); M.lampPost(b, 89.5, z, { ry: PI }); }
  // dış kapı: batı/doğu ucunda nöbetçi kulübesi (dekor)
  for (const s of [-1, 1]) { b.box(s * 90, 0, -8, 3, 2.6, 3, '#7d8a7a', { collide: false }); b.box(s * 90, 2.6, -8, 3.4, 0.2, 3.4, '#4c5156', { collide: false }); b.box(s * 90, 1.4, -6.45, 2.2, 0.8, 0.06, '#2c3d49', { collide: false, o: { glow: true, emissive: '#ffdf9a' } }); }
  // dağlar
  const peak = ['#53624f', '#485544', '#5d6a57', '#4d5c4c'];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * PI * 2 + rng() * 0.2, R = 170 + rng() * 80;
    const sc = 32 + rng() * 30;
    b.ico(Math.cos(a) * R * 1.3, -6, Math.sin(a) * R * 0.95, sc, peak[i % 4], { scale: [1.5, 0.75 + rng() * 0.45, 1.1], detail: 1, ry: rng() * 3 });
  }
  // ağaç sıraları: dış yol çevresi + yoğun orman
  for (let x = -100; x <= 100; x += 7.5) for (const z of [-79, 79]) K.pine(b, rng, x + (rng() - 0.5) * 3, z + (rng() - 0.5) * 3, 1.0 + rng() * 0.7);
  for (let z = -72; z <= 72; z += 7.5) for (const x of [-101, 101]) K.pine(b, rng, x + (rng() - 0.5) * 3, z + (rng() - 0.5) * 3, 1.0 + rng() * 0.7);
  for (let i = 0; i < 260; i++) {
    const a = rng() * PI * 2, R = 90 + rng() * 85;
    const x = Math.cos(a) * R * 1.12, z = Math.sin(a) * R * 0.88;
    if (Math.abs(x) < 98 && Math.abs(z) < 75) continue;
    K.pine(b, rng, x, z, 0.9 + rng() * 1.0);
  }
}

// ───────────────────────── Ana derleme ─────────────────────────
export function buildUs() {
  const b = new MapBuilder();
  b.autoPlace = true;
  const rng = makeRng(4242);

  ground(b, rng);
  perimeter(b, rng);

  // kamplar
  camp(b, rng, { stripe: '#2b6fd6', tent: '#6f7d62', tentCmd: '#55688a', flag: '#2b6fd6', glow: '#7fb4ff' });
  rot(b, () => camp(b, rng, { stripe: '#d63a2b', tent: '#857b62', tentCmd: '#8a5648', flag: '#d63a2b', glow: '#ff8a6b' }));

  avenueCover(b, rng);
  rot(b, () => avenueCover(b, rng));
  komuta(b, rng);
  hangarComplex(b, rng);
  radarComplex(b, rng);
  midNW(b, rng, 0);
  rot(b, () => midNW(b, rng, 1));
  midNE(b, rng);
  midSW(b, rng);
  yardGarage(b, rng, 0);
  rot(b, () => yardGarage(b, rng, 1));
  yardMaze(b, rng, 0);
  rot(b, () => yardMaze(b, rng, 1));
  b.flushVehicles();
  const nCol = b.colliders.length;
  outside(b, rng);
  b.colliders.length = nCol;            // duvar dışı dekorun çarpışması gereksiz

  // ───── doğuş noktaları (kamp avlusu) ─────
  const spawns = { blue: [], red: [] };
  // mavi avlu noktaları (ilki merkez/ikmal noktası); kırmızı 180° döndürülmüş
  const SP = [[-65.5, 0], [-72.5, -19], [-72.5, 19], [-60.5, -14], [-60.5, 14], [-70.5, 9], [-72.5, -7], [-63.5, -7], [-63.5, 7], [-68.5, -13], [-72.5, 1], [-67.5, 15],
    [-66.5, -19], [-60.5, -2], [-60.5, 3], [-72.5, 14], [-70.5, -3], [-65.5, 11], [-62.5, 18], [-68.5, 3], [-67.5, -8], [-64.5, -11], [-72.5, -14], [-61.5, -18]];
  for (const [x, z] of SP) {
    spawns.blue.push({ x, z, ry: -PI / 2 });
    spawns.red.push({ x: -x, z: -z, ry: PI / 2 });
  }

  const objectives = [
    { id: 'hangar', name: 'Hangar', x: 0, z: -45, r: 11, core: true },
    { id: 'komuta', name: 'Komuta Binası', label: 'M', x: 0, z: 0, r: 12, core: true },
    { id: 'radar', name: 'Radar', x: 0, z: 45, r: 10, core: true },
    { id: 'kisla', name: 'Kışla', x: -34, z: 18, r: 11 },
    { id: 'akaryakit', name: 'Akaryakıt', label: 'Y', x: 34, z: -18, r: 11 },
  ];

  return {
    id: 'us',
    name: 'Askeri Üs',
    group: b.build(),
    colliders: b.colliders,
    bounds: US_BOUNDS,
    spawns,
    // kamp avlusu + kapı koridorları (şikan duvarlarının içi): düşman girerse ceza
    baseZones: {
      blue: { minX: -80, maxX: -50, minZ: -29.5, maxZ: 29.5 },
      red: { minX: 50, maxX: 80, minZ: -29.5, maxZ: 29.5 },
    },
    objectives,
    roads: [{ x0: -56, z0: -5, x1: 56, z1: 5 }, { x0: -4, z0: -56, x1: 4, z1: 56 }],
    roadColor: '#4a4d52',
    env: {
      sky: ['#6f7f8e', '#a3b0ba', '#cfd2cf'], fog: ['#b7bfc3', 130, 380],
      sun: ['#eef1f5', 1.9], hemi: ['#cfd8e3', '#6d705f', 1.15], cloud: '#d3d7da', clouds: 26,
      sunPos: [45, 80, 30],
    },
  };
}
