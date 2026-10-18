import * as THREE from 'three';
import { MapBuilder, makeRng } from './builder.js';
import { KIND } from './surface.js';
import { Terrain, smoothstep } from './terrain.js';

// Orman Kalesi — ikinci Paintball (herkes tek) haritası, 56×56 m çam ormanında senaryo sahası. Boya Kulesi'nin (dikey kule, kuyu) tersine YATAY ve dağınık:
//   Orta: iki katlı kütük KALE (11×11; 0 m kapalı alt kat 4 kapı, 3 m surlu güverte, ortada 5,6 m GÖZCÜ kulesi). Güverteye iki dış merdiven (K ve G, fırıldak).
//   Güneyde haritayı doğu-batı kesen sığ DERE (0,9 m, içinden yürünür; su diz altı) + üç tahta köprü + devrik kütük. Köşelerde: Kütük Kulübe (KB), Hurda Köşesi (KD: boyalı
//   lastik kuleleri, hurda araba, palet), Gözetleme Kulesi (GD, 3,6 m), Saman Tarlası (GB). Kuzeyde palet barikatları, batıda çam koruluğu, doğuda çit hattı, güneyde hakem kulübesi + kamp.
// Kurallar: görünen her katı parçanın çarpışması birebir eksen hizalı kutu; yuvarlak parçalarda (kütük, lastik, fıçı, balya, gövde) çarpışma görselin İÇİNDE (görünmez engel yok);
// yaprak / çalı çarpışmasız ama bot görüşünü keser (softCover). Koordinat: −z kuzey, +x doğu.

export const OK_BOUNDS = { minX: -27.9, maxX: 27.9, minZ: -27.9, maxZ: 27.9 };
const F = 27.85, DECK = 3.0, TUR = 5.64;                                          // çit hattı, kale güvertesi, gözcü kulesi tepesi
export const OK = { deck: DECK, turret: TUR, fence: F };

// ───────── dere: z = zc(x) çevresinde 0,9 m derin, düz taban yarı genişlik 1,3 m, yamaç 1,3 → 3,3 m (eğim ≤ 0,7: yürünür) ─────────
export const creekZ = (x) => 14.5 + 2.2 * Math.sin(0.15 * x + 0.8);
const CREEK_D = 0.9, WATER_Y = -0.5;
export const creekH = (x, z) => {
  const fade = 1 - smoothstep(36, 42, Math.abs(x));                           // arazi kenarında dere söner (kesik görünmesin)
  return -CREEK_D * fade * (1 - smoothstep(1.3, 3.3, Math.abs(z - creekZ(x))));
};

// renkler: doğal ahşap / kütük + parlak paintball boyaları
const LOG = '#8a5d3b', LOG_D = '#6a4529', PLANK = '#b98c5a', PLANK_L = '#cfa36c';
const PAINT = ['#ff4fa3', '#ffd23a', '#2fd2ff', '#8be03a', '#ff7a1a', '#b05cff', '#ff4040', '#12c2ad'];
const NC = { collide: false };
const SOFT = { flatShading: false, roughness: 0.6 };
const W = (b, x, y, z, w, h, d, color = PLANK, tag) => b.box(x, y, z, w, h, d, color, { kind: KIND.WOOD, ...(tag ? { tag } : {}) });
const rotXZ = (k, x, z) => { for (let i = 0; i < k; i++) [x, z] = [-z, x]; return [x, z]; };

// Yuvarlak dikey parça (kütük ucu, lastik kulesi, fıçı, rulo balya): görselin içinde kalan üç kutu (kare + iki dikdörtgen haç)
function roundCol(b, x, y, z, r, h) {
  const a = r * 0.707, w = r * 0.42, l = Math.sqrt(r * r - w * w) * 0.98;
  b.collide(x, y, z, a * 2, h, a * 2); b.collide(x, y, z, l * 2, h, w * 2); b.collide(x, y, z, w * 2, h, l * 2);
}
// Yatık kütük (alongX: x ekseni boyunca). Kesit dairesinin içinde üç kutu
function log(b, x, y, z, len, r, alongX = true, color = LOG) {
  const ax = alongX ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 };
  b.cyl(x, y + r, z, r, r, len, color, { collide: false, seg: 10, center: true, ...ax });
  for (const s of [-1, 1]) b.cyl(alongX ? x + s * (len / 2 + 0.006) : x, y + r, alongX ? z : z + s * (len / 2 + 0.006), r * 0.86, r * 0.86, 0.012, '#d9b483', { collide: false, seg: 10, center: true, ...ax });   // kesik uçlar
  const a = r * 0.707, w = r * 0.42, l = Math.sqrt(r * r - w * w) * 0.96, L = len - 0.04;
  const C = (hy, hz) => (alongX ? b.collide(x, y + r - hy, z, L, hy * 2, hz * 2) : b.collide(x, y + r - hy, z, hz * 2, hy * 2, L));
  C(a, a); C(w, l); C(l, w);
}

// ───────── ağaçlar: uzun gövdeli çam (taç 2,4 m'den başlar: altında yürünür, yaprağa girilmez) ve meşe ─────────
const PINES = ['#2f6a34', '#2a5c2f', '#367638', '#2b5a30'];
function pine(b, rng, x, z, s = 1, collide = true, y0 = 0) {
  const th = 3.4 * s;
  b.cyl(x, y0 - 0.2, z, 0.17 * s, 0.26 * s, th + 0.2, '#5a3b23', { seg: 8, collide: false });
  if (collide) roundCol(b, x, y0 - 0.2, z, 0.17 * s, th + 0.2);
  const col = PINES[Math.floor(rng() * PINES.length)];
  for (let i = 0; i < 4; i++) {
    const r = (1.75 - i * 0.36) * s, y = y0 + (2.4 + i * 1.0) * s;
    b.cyl(x, y, z, 0.03, r, 1.65 * s, i % 2 ? col : PINES[(PINES.indexOf(col) + 1) % PINES.length], { seg: 8, collide: false, ry: rng() * 3 });
    if (collide) b.softCover(x, y + 0.6 * s, z, r * 0.7);
  }
}
function oak(b, rng, x, z, s = 1) {                                          // yalnız düz zeminde (dere dışı)
  b.cyl(x, -0.2, z, 0.22 * s, 0.32 * s, 2.9 * s, '#5e4026', { seg: 8, collide: false });
  roundCol(b, x, -0.2, z, 0.22 * s, 2.9 * s);
  const c = ['#5f9a3a', '#6ba83f', '#548c33'][Math.floor(rng() * 3)];
  b.ico(x, 3.9 * s, z, 1.9 * s, c, { detail: 1, scale: [1, 0.8, 1], ry: rng() * 3 });
  b.ico(x + 1.0 * s, 3.4 * s, z + 0.4 * s, 1.2 * s, '#4f8a33', { detail: 0, ry: rng() * 3 });
  b.ico(x - 0.8 * s, 3.6 * s, z - 0.6 * s, 1.3 * s, c, { detail: 0, ry: rng() * 3 });
  b.softCover(x, 3.9 * s, z, 1.6 * s); b.softCover(x + 1.0 * s, 3.4 * s, z + 0.4 * s, 1.0 * s); b.softCover(x - 0.8 * s, 3.6 * s, z - 0.6 * s, 1.1 * s);
}
function bush(b, rng, x, z, s = 1) {
  b.softCover(x, 0.45 * s, z, 0.7 * s);
  b.ico(x, 0.4 * s, z, 0.75 * s, rng() > 0.5 ? '#4f8a36' : '#5f9a3c', { scale: [1.25, 0.8, 1.2], ry: rng() * 3, detail: 1 });
}

// Eski boya lekesi (süs): yüzeyden 1,2 cm önde daire + damlalar + akıntı. n: yüzey normali ('x+', 'x-', 'z+', 'z-', 'y')
function splat(b, rng, x, y, z, n, r, color) {
  const rot = n === 'y' ? [-Math.PI / 2, 0, 0] : n === 'x+' ? [0, Math.PI / 2, 0] : n === 'x-' ? [0, -Math.PI / 2, 0] : n === 'z-' ? [0, Math.PI, 0] : [0, 0, 0];
  const o = 0.012, [ox, oy, oz] = n === 'x+' ? [o, 0, 0] : n === 'x-' ? [-o, 0, 0] : n === 'z+' ? [0, 0, o] : n === 'z-' ? [0, 0, -o] : [0, o, 0];
  const L = (dx, dy, dz) => b._local(x + ox + dx, y + oy + dy, z + oz + dz, rot[0], rot[1], rot[2]);
  b.addGeo(new THREE.CircleGeometry(r, 9), color, L(0, 0, 0));
  for (let i = 0; i < 4; i++) {
    const a = rng() * Math.PI * 2, d = r * (1.05 + rng() * 0.45), rr = r * (0.14 + rng() * 0.14), u = Math.cos(a) * d, v = Math.sin(a) * d;
    const [dx, dy, dz] = n === 'y' ? [u, 0, v] : n[0] === 'x' ? [0, v, u] : [u, v, 0];
    b.addGeo(new THREE.CircleGeometry(rr, 6), color, L(dx, dy, dz));
  }
  if (n !== 'y') {
    const len = r * (0.7 + rng() * 0.6), u = (rng() - 0.5) * r * 0.6, [dx, dz] = n[0] === 'x' ? [0, u] : [u, 0];
    b.addGeo(new THREE.PlaneGeometry(r * 0.22, len), color, L(dx, -r * 0.6 - len / 2, dz));
  }
}
// Bir yüzeye n leke: aday (u, y) açıklıklardan (holes: [u0, u1, y0, y1]) ve kenarlardan uzak seçilir; put(u, y, r, renk)
function splats(rng, n, u0, u1, y0, y1, holes, put, c0 = 0) {
  const done = [];                                                           // lekeler üst üste binmez (aynı düzlemde titreşmesin)
  for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
    const r = 0.15 + rng() * 0.15, u = u0 + r * 2 + rng() * (u1 - u0 - r * 4), y = y0 + r * 2.4 + rng() * Math.max(0, y1 - y0 - r * 4.2);
    if (holes.some((h) => u > h[0] - r * 1.8 && u < h[1] + r * 1.8 && y > h[2] - r * 2.8 && y < h[3] + r * 1.8)) continue;
    if (done.some(([du, dy, dr]) => Math.abs(du - u) < (dr + r) * 1.8 && Math.abs(dy - y) < (dr + r) * 2.6)) continue;
    done.push([u, y, r]); put(u, y, r, PAINT[(c0 + i * 3) % PAINT.length]); i++;
  }
}

// ───────── KALE (merkez). Kanonik kenar = kuzey (z = −5,5 dış yüz), k × 90° döndürülür; köşeler fırıldak (her kenar −5,5 → 5,2) ─────────
const KH = 5.5, KT = 0.3;
function castleSide(b, k, rng) {
  const stair = k % 2 === 0, z = -KH + KT / 2;
  const ops = [{ at: -3.0, w: 1.6, b: 0, top: 2.2 }];                          // kapı
  if (!stair) ops.push({ at: 0.4, w: 1.4, b: 1.0, top: 1.8 }, { at: 3.6, w: 1.0, b: 1.0, top: 1.8 });   // merdivensiz kenarda iki mazgal pencere
  b.wall('x', -KH, KH - KT, z, 0, DECK - 0.3, KT, LOG, ops, { kind: KIND.WOOD });
  // sur (güverte kenarı, 1,1 m) + mazgal dişleri; merdivenli kenarda x 3,5…5,2 boşluk (merdiven sahanlığından güverteye)
  const p1 = stair ? 3.5 : KH - KT;
  W(b, (-KH + p1) / 2, DECK, z, p1 + KH, 1.1, KT, LOG_D);
  for (let x = -4.75; x < p1 - 0.4; x += 1.5) W(b, x, DECK + 1.1, z, 0.6, 0.45, KT, LOG_D);
  // dış yüzde renkli bayrak (kenar başına bir boya rengi) — duvar yüzüne yapışık, çarpışmasız
  const C = ['#ff7a1a', '#b05cff', '#12c2ad', '#ff4fa3'][k];
  b.box(-1.65, 0.9, -KH - 0.015, 0.9, 1.6, 0.03, C, NC);
  b.box(-1.65, 2.36, -KH - 0.02, 1.0, 0.12, 0.04, '#f4f1ea', NC);
  const holes = [[-3.8, -2.2, 0, 2.2], [-2.15, -1.15, 0.9, 2.48], ...(stair ? [[-1.1, 6, 0, 3]] : [[-0.3, 1.1, 1.0, 1.8], [3.1, 4.1, 1.0, 1.8]])];
  splats(rng, 3, -KH, KH - KT, 0.1, 2.6, holes, (u, y, r, c) => splat(b, rng, u, y, -KH, 'z-', r, c), k * 2);
  if (stair) {                                                               // dış merdiven: duvara yaslı, +x yönünde 0 → 3 m (9 basamak × 0,3 m + 2 m sahanlık)
    const zc = -KH - 0.75;
    for (let i = 0; i < 9; i++) {
      const top = (i + 1) * 0.3, cx = -1.0 + i * 0.5 + 0.25;
      W(b, cx, 0, zc, 0.5, top - 0.05, 1.5, LOG, 'plat');
      b.box(cx, top - 0.05, zc, 0.5, 0.05, 1.5, C, { tag: 'plat' });           // basamak yüzü boyalı (merdiven uzaktan okunur)
    }
    W(b, 4.5, 0, zc, 2.0, DECK - 0.05, 1.5, LOG, 'plat');
    b.box(4.5, DECK - 0.05, zc, 2.0, 0.05, 1.5, C, { tag: 'plat' });
  }
}
function castle(b, rng) {
  b.obj('kale:güverte', () => W(b, 0, DECK - 0.3, 0, 2 * KH, 0.3, 2 * KH, PLANK, 'plat'));
  for (let k = 0; k < 4; k++) b.with(0, 0, 0, -k * Math.PI / 2, () => b.obj('kale:kenar-' + k, () => castleSide(b, k, rng)));
  b.obj('kale:iç', () => {
    W(b, 0, 0, 0, 1.0, DECK - 0.3, 1.0, LOG_D);                                // orta direk (gözcü kulesini taşır)
    for (let k = 0; k < 4; k++) { const [x, z] = rotXZ(k, 2.25, -4.65); W(b, x, 0, z, 1.1, 1.1, 1.1, PLANK_L); W(b, x, 1.1, z, 0.7, 0.7, 0.7, PLANK); }   // duvar dibi sandıkları (pencereler arası)
    for (const x of [-2.2, 2.2]) W(b, x, 0, 0, 0.5, 0.9, 1.6, PLANK);         // alçak sıra (çömelince siper)
  });
  // gözcü kulesi (güvertenin ortasında dolu kütük blok, tepe 5,64 m), doğusunda dolu merdiven −z yönünde (7 basamak × 0,33 m + sahanlık)
  b.obj('kale:gözcü', () => {
    W(b, 0, DECK, 0, 3.6, TUR - DECK - 0.04, 3.6, LOG, 'plat');
    b.box(0, TUR - 0.04, 0, 3.6, 0.04, 3.6, '#ffd23a', { tag: 'plat' });
    const S = 1.8, T = 0.25, H = 1.0, Y = TUR;
    W(b, 0, Y, -S + T / 2, 2 * S, H, T, LOG_D);                                 // kuzey
    W(b, 0, Y, S - T / 2, 2 * S, H, T, LOG_D);                                  // güney
    W(b, -S + T / 2, Y, 0, T, H, 2 * S - 2 * T, LOG_D);                         // batı
    W(b, S - T / 2, Y, 0.775, T, H, 1.55, LOG_D);                               // doğu (z 0…1,55; kuzeyi merdiven ağzı)
    for (let i = 0; i < 7; i++) {
      const top = DECK + (i + 1) * 0.33, cz = 3.5 - i * 0.5 - 0.25;
      W(b, 2.55, DECK, cz, 1.5, top - DECK - 0.05, 0.5, LOG, 'plat');
      b.box(2.55, top - 0.05, cz, 1.5, 0.05, 0.5, '#ffd23a', { tag: 'plat' });
    }
    W(b, 2.55, DECK, -0.9, 1.5, TUR - DECK - 0.05, 1.8, LOG, 'plat');            // sahanlık z −1,8…0
    b.box(2.55, TUR - 0.05, -0.9, 1.5, 0.05, 1.8, '#ffd23a', { tag: 'plat' });
    for (const k of [0, 2, 3]) b.with(0, 0, 0, -k * Math.PI / 2, () => {      // doğu dışındaki (merdiven) yüzlerde boyalı hedef tahtası (paintball hedefi; yüzden 1-3 cm önde, çarpışmasız)
      [[0.62, '#f4f1ea'], [0.46, PAINT[k * 2]], [0.28, '#f4f1ea'], [0.12, PAINT[k * 2]]].forEach(([r, c], j) => b.addGeo(new THREE.CircleGeometry(r, 20), c, b._local(0, DECK + 1.3, -1.8 - 0.01 - j * 0.005, 0, Math.PI, 0)));
    });
    b.box(-1.675, Y + H, -1.675, 0.12, 3.2, 0.12, '#e8e8e8');                   // bayrak direği (kuzeybatı köşe, kuzey sur üstünde)
    b.box(-1.675 + 0.86, Y + H + 2.3, -1.675, 1.6, 0.9, 0.04, '#ff4fa3', NC);
  });
  b.obj('kale:fener', () => {                                                // güverte köşelerinde fener direkleri (merdiven ağzı olmayan iki köşe)
    for (const k of [0, 2]) {
      const [x, z] = rotXZ(k, -4.95, -4.95);
      W(b, x, DECK, z, 0.2, 2.2, 0.2, LOG_D);
      b.box(x, DECK + 2.2, z, 0.34, 0.34, 0.34, '#ffd98a', { o: { glow: true } });
    }
  });
}

// ───────── Kütük Kulübe (KB) ─────────
function cabin(b, rng) {
  const x0 = -22.5, x1 = -15.5, z0 = -22.5, z1 = -17.5, H = 2.4, t = 0.3;
  b.wall('x', x0, x1, z0 + t / 2, 0, H, t, LOG, [{ at: -19.0, w: 1.2, b: 1.0, top: 1.7 }], { kind: KIND.WOOD });            // kuzey
  b.wall('x', x0, x1, z1 - t / 2, 0, H, t, LOG, [{ at: -17.2, w: 1.4, b: 0, top: 2.1 }, { at: -20.6, w: 1.2, b: 1.0, top: 1.7 }], { kind: KIND.WOOD });   // güney: kapı + pencere
  b.wall('z', z0 + t, z1 - t, x0 + t / 2, 0, H, t, LOG, [{ at: -20.0, w: 1.1, b: 1.0, top: 1.7 }], { kind: KIND.WOOD });   // batı
  b.wall('z', z0 + t, z1 - t, x1 - t / 2, 0, H, t, LOG, [{ at: -20.0, w: 1.3, b: 0, top: 2.1 }], { kind: KIND.WOOD });     // doğu kapı
  // basamaklı kütük çatı (sırt x boyunca): 4 kat, her kat bir öncekinin üstünde, çarpışma birebir
  for (let j = 0; j < 4; j++) W(b, (x0 + x1) / 2, H + j * 0.28, (z0 + z1) / 2, x1 - x0 + 0.6, 0.28, 5.6 - j * 1.3, j % 2 ? '#7a4f30' : '#94603a');
  b.box(-17.0, H + 0.56, -21.75, 0.5, 1.3, 0.5, '#7d7a72', { kind: KIND.STONE });     // baca: 2. çatı katının üstünde, 3. katın kuzey yüzüne yaslı
  W(b, -19.6, 0, -20.4, 1.6, 0.8, 0.9, PLANK_L);                                  // iç: masa + sandık
  W(b, -21.6, 0, -18.4, 0.9, 0.9, 0.9, PLANK);
  splats(rng, 3, x0, x1, 0.1, 2.3, [[-17.9, -16.5, 0, 2.1], [-21.2, -20.0, 1.0, 1.7], [-20.2, -18.0, 1.95, 2.33]], (u, y, r, c) => splat(b, rng, u, y, z1, 'z+', r, c), 1);
  splats(rng, 2, z0, z1, 0.1, 2.3, [[-20.65, -19.35, 0, 2.1]], (u, y, r, c) => splat(b, rng, x1, y, u, 'x+', r, c), 4);
  b.box(-19.1, 1.95, z1 + 0.015, 2.2, 0.38, 0.03, '#f4f1ea', NC);                   // tabela zemini (yazı ayrı doku)
}

// ───────── lastik kulesi: n lastik üst üste (boyalı / siyah), içi toprak dolu ─────────
const TYRE_R = 0.46, TYRE_H = 0.27;
const _tor = new THREE.TorusGeometry(TYRE_R - 0.13, 0.13, 6, 12); _tor.rotateX(Math.PI / 2); _tor.scale(1, TYRE_H / 0.26, 1);
function tyres(b, x, z, n, color) {
  for (let i = 0; i < n; i++) b.addGeo(_tor.clone(), i % 2 ? '#26272b' : color, b._local(x, TYRE_H / 2 + i * TYRE_H, z), SOFT);
  b.cyl(x, n * TYRE_H - 0.08, z, TYRE_R - 0.2, TYRE_R - 0.2, 0.02, '#6a5238', { collide: false, seg: 10 });     // içi toprak
  roundCol(b, x, 0, z, TYRE_R - 0.02, n * TYRE_H - 0.02);
}
// palet yığını (n palet × 0,15 m): tek kutu (çarpışma birebir) + palet aralarındaki koyu şeritler (5 mm önde, çarpışmasız)
function pallets(b, x, z, n, alongX = true, color = PLANK_L) {
  const w = alongX ? 1.2 : 1.0, d = alongX ? 1.0 : 1.2;
  W(b, x, 0, z, w, n * 0.15, d, color);
  for (let i = 1; i <= n; i++) b.box(x, i * 0.15 - 0.06, z, w + 0.01, 0.035, d + 0.01, '#5b3f26', NC);
}
function drum(b, x, z, color) {
  b.cyl(x, 0, z, 0.3, 0.3, 0.9, color, { collide: false, seg: 12 });
  for (const y of [0.3, 0.6]) b.cyl(x, y, z, 0.307, 0.307, 0.04, '#2a2c33', { collide: false, seg: 12 });
  roundCol(b, x, 0, z, 0.29, 0.9);
}
function haySq(b, x, y, z, alongX = true) {                                   // dikdörtgen saman balyası 1,4 × 0,7 × 0,8
  const w = alongX ? 1.4 : 0.8, d = alongX ? 0.8 : 1.4;
  b.box(x, y, z, w, 0.7, d, '#e2c25a');
  for (const s of [-0.35, 0.35]) b.box(alongX ? x + s : x, y - 0.005, alongX ? z : z + s, alongX ? 0.04 : w + 0.012, 0.712, alongX ? d + 0.012 : 0.04, '#b48a3a', NC);   // ip
}
function hayRound(b, x, z) {
  b.cyl(x, 0, z, 0.78, 0.8, 1.25, '#dcb94f', { collide: false, seg: 16 });
  b.cyl(x, 1.25, z, 0.62, 0.62, 0.012, '#c9a440', { collide: false, seg: 16 });
  roundCol(b, x, 0, z, 0.76, 1.25);
}
// Hurda araba (kutulardan): gövde 0,3 m'de (altından top geçer), tekerlekler yuvarlak (çarpışma içinde), kabin üstte
function wreck(b, x, z, color) {
  b.with(x, 0, z, 0, () => b.obj('hurda:araba', () => {
    b.box(0, 0.3, 0, 4.0, 0.75, 1.8, color, { kind: KIND.PAINT });
    b.box(0.2, 1.05, 0, 2.1, 0.7, 1.62, color, { kind: KIND.PAINT });
    for (const s of [-1, 1]) b.box(0.2, 1.15, s * 0.815, 1.8, 0.45, 0.012, '#1d2430', NC);         // camlar (kırık, koyu)
    b.box(1.255, 1.15, 0, 0.012, 0.45, 1.4, '#1d2430', NC);
    for (const [wx, wz] of [[-1.3, -0.82], [1.3, -0.82], [-1.3, 0.82], [1.3, 0.82]]) {
      b.cyl(wx, 0.33, wz, 0.33, 0.33, 0.24, '#202226', { collide: false, seg: 12, center: true, rx: Math.PI / 2 });
      b.collide(wx, 0.12, wz, 0.42, 0.42, 0.22);
    }
    b.box(-2.01, 0.55, 0, 0.02, 0.2, 1.2, '#9aa0a6', NC);
  }));
}

// ───────── zemin rengi ─────────
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const PATHS = [[-3, -7, -3, -24], [-3, -7, -18, -17], [7, -3, 24, -14], [7, 3, 22, 4], [3, 7, 3, 25], [3, 22, 17, 24], [-7, 3, -24, 3], [-7, 3, -17, 9], [-17, 16, -18, 23], [13, 19, 13, 9]];

export function buildOrmanKale() {
  const b = new MapBuilder();
  const terrain = new Terrain({ minX: -44, maxX: 44, minZ: -44, maxZ: 44, cell: 1, height: creekH });
  terrain.tri = true; terrain.deepWater = -1e9; terrain.navMin = -5;            // su sığ (yürünür), yol bulmada dere tabanı açık
  b.surface = { ground: (x, z) => terrain.heightAt(x, z), kindOf: () => 0, seeded: false };
  const rng = makeRng(4242);

  // ───── çevre çiti: ağ (çarpışma = ağ düzlemi, dere yatağına kadar iner) + kütük direkler + üst kiriş ─────
  const NET = { o: { transparent: true, opacity: 0.16, roughness: 0.9, depthWrite: false } }, FH = 6;
  for (let s = 0; s < 4; s++) b.obj('çit:' + s, () => {
    const [ax, az] = rotXZ(s, 0, -F), alongX = s % 2 === 0;
    b.box(ax, -1.0, az, alongX ? 2 * F : 0.1, FH + 1.0, alongX ? 0.1 : 2 * F, '#203026', NET);
    for (let t = -24; t <= 24; t += 4) { const [px, pz] = rotXZ(s, t, -F - 0.16); b.box(px, -1.0, pz, 0.22, FH + 1.2, 0.22, LOG_D, { kind: KIND.WOOD }); }
    const [rx, rz] = rotXZ(s, 0, -F - 0.16);
    b.box(rx, FH + 0.2, rz, alongX ? 2 * F + 0.3 : 0.12, 0.12, alongX ? 0.12 : 2 * F + 0.3, LOG_D);      // üst kiriş (direk tepelerinde)
  });

  // ───── kale ─────
  castle(b, rng);

  // ───── Kütük Kulübe (KB) + çevresi ─────
  b.obj('kulübe', () => cabin(b, rng));
  b.obj('kulübe:odun', () => { log(b, -24.6, 0, -15.6, 2.6, 0.28, false); log(b, -24.0, 0, -15.6, 2.6, 0.28, false); log(b, -24.3, 0.5, -15.6, 2.6, 0.28, false); });
  b.obj('kulübe:sandık', () => { W(b, -13.6, 0, -21.4, 1.1, 1.1, 1.1, PLANK_L); W(b, -13.6, 1.1, -21.4, 0.7, 0.6, 0.7, PLANK); });

  // ───── Palet Barikatı (kuzey orta) ─────
  b.obj('palet:duvar', () => {
    b.wall('x', -4.2, 4.2, -18.0, 0, 1.9, 0.3, PLANK_L, [{ at: -2.0, w: 0.9, b: 1.05, top: 1.45 }, { at: 2.0, w: 0.9, b: 1.05, top: 1.45 }], { kind: KIND.WOOD });
    for (const x of [-4.05, -1.4, 1.4, 4.05]) b.box(x, 0, -17.84, 0.12, 1.9, 0.02, '#6a4a2c', NC);     // dik palet ayakları (yüzde)
    splats(rng, 4, -4.2, 4.2, 0, 1.9, [[-2.45, -1.55, 1.05, 1.45], [1.55, 2.45, 1.05, 1.45], ...[-4.05, -1.4, 1.4, 4.05].map((x) => [x - 0.06, x + 0.06, 0, 1.9])], (u, y, r, c) => splat(b, rng, u, y, -17.83, 'z+', r, c), 3);
  });
  b.obj('palet:yığınlar', () => {
    pallets(b, -6.4, -13.6, 8); pallets(b, 6.2, -13.0, 8, false, PLANK); pallets(b, -1.2, -12.2, 6, true, '#2fd2ff');
    pallets(b, -6.0, -22.6, 7, false); pallets(b, 4.4, -22.8, 8, true, '#ff7a1a'); pallets(b, 0.4, -24.8, 6);
    pallets(b, -9.6, -18.4, 8, false, PLANK); pallets(b, 9.4, -17.6, 7, true, '#8be03a');
  });
  b.obj('palet:makara', () => {                                               // kablo makarası (dikey; çarpışma = iki kasnak + gövde, arası boş)
    b.cyl(1.6, 0, -15.0, 0.95, 0.95, 0.1, PLANK, { collide: false, seg: 16 }); b.cyl(1.6, 0.9, -15.0, 0.95, 0.95, 0.1, PLANK, { collide: false, seg: 16 });
    b.cyl(1.6, 0.1, -15.0, 0.45, 0.45, 0.8, '#d8c79a', { collide: false, seg: 12 });
    roundCol(b, 1.6, 0, -15.0, 0.93, 0.1); roundCol(b, 1.6, 0.1, -15.0, 0.44, 0.8); roundCol(b, 1.6, 0.9, -15.0, 0.93, 0.1);
  });

  // ───── Hurda Köşesi (KD) ─────
  b.obj('hurda:lastik', () => {
    for (let i = 0; i < 5; i++) tyres(b, 13.6 + i * 0.94, -18.6, i % 2 ? 3 : 4, PAINT[i % PAINT.length]);
    for (let i = 0; i < 4; i++) tyres(b, 24.2, -13.2 - i * 0.94, 3, PAINT[(i + 3) % PAINT.length]);
    tyres(b, 18.4, -13.0, 4, '#ff4fa3'); tyres(b, 19.34, -13.0, 2, '#ffd23a');
    tyres(b, 14.6, -25.2, 3, '#2fd2ff'); tyres(b, 15.54, -25.2, 3, '#8be03a'); tyres(b, 25.0, -21.8, 4, '#ff7a1a');
    tyres(b, 11.6, -8.8, 3, '#b05cff'); tyres(b, 12.54, -8.8, 2, '#ff4040');
  });
  wreck(b, 19.6, -22.4, '#b8542a');
  b.obj('hurda:varil', () => { drum(b, 22.6, -18.8, '#2f7bff'); drum(b, 23.3, -18.3, '#ff4040'); drum(b, 16.4, -15.6, '#ffd23a'); });
  b.obj('hurda:palet', () => { pallets(b, 21.6, -15.4, 8, false); pallets(b, 14.2, -21.8, 6, true, PLANK); });

  // ───── Çam Koruluğu (batı orta): kütük yığınları, kontrplak siper, balyalar ─────
  b.obj('koru:kütük', () => {
    log(b, -14.0, 0, -6.3, 3.4, 0.3, true); log(b, -14.0, 0, -5.7, 3.4, 0.3, true); log(b, -14.0, 0.52, -6.0, 3.4, 0.3, true);   // piramit yığın (kütükler birbirine değer)
    log(b, -21.0, 0, 6.6, 4.0, 0.34, false);
    log(b, -12.6, 0, 6.4, 3.0, 0.3, true);
  });
  b.obj('koru:siper', () => {
    W(b, -19.6, 0, -2.4, 3.2, 1.6, 0.25, '#9b6b3e');
    W(b, -21.325, 0, -1.3125, 0.25, 1.6, 2.425, '#9b6b3e');
    b.box(-19.6, 0.7, -2.535, 3.0, 0.5, 0.02, '#ffd23a', NC);
    splat(b, rng, -19.0, 1.42, -2.525, 'z-', 0.17, '#ff4fa3'); splat(b, rng, -20.4, 0.36, -2.525, 'z-', 0.14, '#2fd2ff');
  });
  b.obj('koru:balya', () => { haySq(b, -24.6, 0, -1.0, false); haySq(b, -24.6, 0.7, -1.0, false); haySq(b, -15.8, 0, 1.8, true); });

  // ───── Çit Hattı (doğu orta): zikzak tahta perdeler (1,42 m) ─────
  b.obj('çithattı', () => {
    const fen = (x, z, len, alongX) => { W(b, x, 0, z, alongX ? len : 0.12, 1.34, alongX ? 0.12 : len, '#c49766'); W(b, x, 1.34, z, alongX ? len : 0.18, 0.08, alongX ? 0.18 : len, LOG_D); };   // perde + üstte kapak kirişi
    fen(13.6, -3.2, 4.0, true); fen(15.66, -1.0, 4.4, false);
    fen(19.2, 2.4, 4.4, true); fen(21.46, 4.6, 4.4, false);
    fen(14.4, 6.8, 3.6, true); fen(24.0, -3.8, 3.4, true);
    for (const [x, z] of [[19.0, 2.46], [13.2, -3.14]]) splat(b, rng, x, 0.7, z, 'z+', 0.2, PAINT[Math.floor(rng() * 8)]);
  });
  b.obj('çithattı:sandık', () => { W(b, 18.6, 0, -4.4, 1.2, 1.2, 1.2, PLANK_L); W(b, 25.2, 0, 1.6, 1.0, 1.0, 1.0, PLANK); });

  // ───── Gözetleme Kulesi (GD, dere güneyi): 3,6 × 3,6 platform 3,6 m, batıdan açık merdiven (−z yönünde çıkar), çatılı ─────
  b.obj('gözetleme', () => {
    const X0 = 17.0, X1 = 20.6, Z0 = 19.5, Z1 = 23.1, Y = 3.6;
    for (const [px, pz] of [[X0 + 0.15, Z0 + 0.15], [X1 - 0.15, Z0 + 0.15], [X0 + 0.15, Z1 - 0.15], [X1 - 0.15, Z1 - 0.15]]) W(b, px, 0, pz, 0.3, Y - 0.3, 0.3, LOG_D);
    W(b, (X0 + X1) / 2, Y - 0.3, (Z0 + Z1) / 2, X1 - X0, 0.3, Z1 - Z0, PLANK, 'plat');
    const T = 0.2, RH = 1.05;
    W(b, (X0 + X1) / 2, Y, Z0 + T / 2, X1 - X0, RH, T, '#9b6b3e');                  // kuzey korkuluk (haritaya bakar)
    W(b, X1 - T / 2, Y, (Z0 + Z1) / 2 + T / 2, T, RH, Z1 - Z0 - T, '#9b6b3e');       // doğu
    W(b, (X0 + X1 - T) / 2, Y, Z1 - T / 2, X1 - X0 - T, RH, T, '#9b6b3e');           // güney
    W(b, X0 + T / 2, Y, (Z0 + T + 20.2) / 2, T, RH, 20.2 - Z0 - T, '#9b6b3e');       // batı: kuzey parça; sahanlık ağzı z 20,2…21,9
    W(b, X0 + T / 2, Y, (21.9 + Z1 - T) / 2, T, RH, Z1 - T - 21.9, '#9b6b3e');       // batı: güney parça (merdiven boyunca)
    b.box((X0 + X1) / 2, Y + 0.45, Z0 - 0.01, 2.6, 0.3, 0.02, '#ff4fa3', NC);
    for (const [px, pz] of [[X0 + 0.1, Z0 + 0.1], [X1 - 0.1, Z0 + 0.1], [X0 + 0.1, Z1 - 0.1], [X1 - 0.1, Z1 - 0.1]]) b.box(px, Y + RH, pz, 0.12, 1.25, 0.12, LOG_D);   // çatı direkleri (korkuluk üstünde)
    for (let j = 0; j < 3; j++) W(b, (X0 + X1) / 2, Y + RH + 1.25 + j * 0.22, (Z0 + Z1) / 2, 4.2 - j * 1.2, 0.22, 4.2 - j * 1.2, j % 2 ? '#c44a2a' : '#e05a32');
    // açık merdiven: x 15,4…17,0; 10 basamak (0,327 m) × 0,5 m, z 26,9 → 21,9; 11. rıht sahanlık z 20,2…21,9
    const R = Y / 11;
    for (let i = 0; i < 10; i++) {
      const top = (i + 1) * R, cz = 26.9 - i * 0.5 - 0.25, th = Math.min(0.3, top);
      W(b, 16.2, top - th, cz, 1.6, th, 0.5, PLANK, 'plat');
    }
    W(b, 16.2, Y - 0.3, 21.05, 1.6, 0.3, 1.7, PLANK, 'plat');
    for (const i of [5, 9]) for (const px of [15.48, 16.92]) W(b, px, 0, 26.9 - i * 0.5 - 0.25, 0.14, (i + 1) * R - 0.3, 0.14, LOG_D);   // basamak altı direkler (tablaya değer)
    W(b, 15.48, 0, 20.6, 0.14, Y - 0.3, 0.14, LOG_D); W(b, 16.92, 0, 20.4, 0.14, Y - 0.3, 0.14, LOG_D);   // sahanlık direkleri
  });

  // ───── Saman Tarlası (GB) ─────
  b.obj('saman', () => {
    haySq(b, -22.0, 0, 19.6, true); haySq(b, -20.6, 0, 19.6, true); haySq(b, -21.3, 0.7, 19.6, true);
    haySq(b, -16.0, 0, 22.6, false); haySq(b, -16.0, 0.7, 22.6, false);
    haySq(b, -24.8, 0, 24.4, true); haySq(b, -13.0, 0, 18.6, true);
    hayRound(b, -19.2, 23.8); hayRound(b, -23.8, 21.6); hayRound(b, -12.6, 25.0); hayRound(b, -19.0, 18.2);
    b.box(-21.3, 1.4, 19.6, 0.12, 0.012, 0.8, '#ff4040', NC);
  });

  // ───── güney orta: Hakem Kulübesi + kamp ateşi ─────
  b.obj('hakem', () => {
    const x0 = -9.8, x1 = -6.2, z0 = 21.0, z1 = 23.6, H = 2.3, t = 0.2;
    b.wall('x', x0, x1, z0 + t / 2, 0, H, t, '#e8e2d2', [{ at: -8.0, w: 1.4, b: 0.9, top: 1.7 }], { kind: KIND.WOOD });
    b.wall('x', x0, x1, z1 - t / 2, 0, H, t, '#e8e2d2', [], { kind: KIND.WOOD });
    b.wall('z', z0 + t, z1 - t, x0 + t / 2, 0, H, t, '#e8e2d2', [{ at: 22.3, w: 1.0, b: 0, top: 2.0 }], { kind: KIND.WOOD });
    b.wall('z', z0 + t, z1 - t, x1 - t / 2, 0, H, t, '#e8e2d2', [{ at: 22.3, w: 1.0, b: 0, top: 2.0 }], { kind: KIND.WOOD });
    b.box((x0 + x1) / 2, H, (z0 + z1) / 2, x1 - x0 + 0.4, 0.18, z1 - z0 + 0.4, '#2a3a52');
    b.box((x0 + x1) / 2, H - 0.5, z0 - 0.01, 2.6, 0.32, 0.02, '#ffd23a', NC);
    W(b, -8.0, 0, 23.0, 1.6, 0.85, 0.5, PLANK_L);
  });
  b.obj('kamp', () => {
    for (const [x, z, ax] of [[6.6, 21.4, true], [6.6, 25.0, true], [4.85, 23.2, false], [8.35, 23.2, false]]) log(b, x, 0, z, 2.2, 0.22, ax, '#7a5232');
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; b.ico(6.6 + Math.cos(a) * 0.45, 0.1, 23.2 + Math.sin(a) * 0.45, 0.16, '#8c8a84'); }
    b.cyl(6.6, 0, 23.2, 0.3, 0.3, 0.02, '#2a2420', NC);
  });

  // ───── dere: köprüler, devrik kütük, taşlar ─────
  const bridge = (id, x, rail) => b.obj('köprü:' + id, () => {
    const zc = creekZ(x), L = 7.6, za = zc - L / 2, zb = zc + L / 2;
    W(b, x, -0.1, zc, 1.6, 0.25, L, PLANK, 'plat');
    for (const s of [-0.62, 0.62]) W(b, x + s, -0.38, zc, 0.18, 0.28, L - 1.2, LOG_D);            // alt kirişler (tablanın altında)
    for (const pz of [zc - 1.6, zc + 1.6]) for (const s of [-0.62, 0.62]) W(b, x + s, -1.0, pz, 0.18, 0.62, 0.18, LOG_D);   // sudaki ayaklar (kirişe değer)
    if (rail) {
      for (let z = za + 0.6; z <= zb - 0.5; z += 1.6) b.box(x + 0.74, 0.15, z, 0.1, 0.85, 0.1, LOG_D, { kind: KIND.WOOD });
      b.box(x + 0.74, 1.0, zc, 0.12, 0.08, L - 1.0, '#ffd23a');
    }
    for (let z = za + 0.25; z < zb; z += 0.5) b.box(x, 0.148, z, 1.62, 0.006, 0.03, '#6a4a2c', NC);     // tahta aralıkları
  });
  bridge('batı', -17, false); bridge('orta', 3.0, true); bridge('doğu', 13, true);
  b.obj('dere:kütük', () => log(b, -6.0, 0, creekZ(-6), 8.2, 0.32, false, '#6f4a2c'));     // devrik kütük: iki kıyıya yaslı, derenin üstünden geçer (denge kütüğü)
  b.obj('dere:kaya', () => {
    for (const [x, dz, s] of [[-24.4, 0.6, 1.0], [-10.5, -0.7, 0.9], [8.2, 0.5, 1.1], [22.5, -0.6, 0.9], [-2.0, 4.4, 0.7]]) {    // dere tabanında (düz) ya da düz zeminde
      const z = creekZ(x) + dz, y = creekH(x, z);
      b.ico(x, y + 0.32 * s, z, 0.8 * s, rng() > 0.5 ? '#8f8d86' : '#7b7a74', { scale: [1.3, 0.8, 1.05], detail: 0 });
      b.collide(x, y, z, 0.9 * s, 0.5 * s, 0.75 * s);
    }
  });

  // ───── ağaçlar + çalılar (oynanış alanı): elle dağıtılmış, yapılardan uzak ─────
  b.obj('ağaçlar', () => {
    const P = [[-25.4, -10.6, 1.05], [-17.6, -9.6, 1.1], [-22.6, -5.2, 0.95], [-12.4, -2.0, 1.0], [-16.8, 3.8, 1.1], [-24.0, 3.2, 1.0], [-11.0, -15.6, 1.0], [-25.6, -14.0, 0.9],
      [-7.4, 10.4, 0.95], [9.4, 9.6, 1.0], [-1.2, -9.4, 0.9], [11.2, -12.2, 1.0], [10.8, 3.2, 1.05], [16.6, 10.0, 1.0], [24.8, 8.4, 1.1], [22.6, -6.6, 1.0],
      [-14.0, -25.6, 1.0], [7.6, -26.0, 0.95], [-4.0, 25.6, 1.0], [11.0, 23.4, 1.05], [23.4, 26.2, 0.95], [-25.0, 18.6, 1.0], [-11.2, 26.4, 0.95], [-12.4, -10.6, 0.9]];
    for (const [x, z, s] of P) pine(b, rng, x, z, s, true, terrain.heightAt(x, z));
    for (const [x, z, s] of [[-10.4, 7.4, 1.0], [9.8, -6.6, 1.0], [-21.6, 8.0, 1.05], [22.0, 17.2, 1.0]]) oak(b, rng, x, z, s);
    for (const [x, z, s] of [[-18.6, -4.4, 1.0], [-9.8, -6.8, 0.9], [8.2, -9.4, 1.0], [12.6, 5.0, 0.9], [-13.0, 8.4, 1.0], [20.2, -10.0, 0.9], [-3.4, -14.8, 0.8], [26.2, 4.2, 0.9], [-26.0, 10.6, 1.0], [2.6, 23.6, 0.8]]) bush(b, rng, x, z, s);
  });

  // ───── arena dışı (çarpışmasız): sık orman, seyirci tribünü, giriş kemeri, uzak tepeler ─────
  b.obj('dış', () => {
    for (let i = 0; i < 150; i++) {
      const a = rng() * Math.PI * 2, r = 31 + Math.pow(rng(), 0.7) * 32, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z > 28 && z < 37 && Math.abs(x) < 13) continue;                        // tribün
      if (Math.abs(z - creekZ(x)) < 3.6 && Math.abs(x) < 42) continue;                // dere yatağı
      if (rng() < 0.78) pine(b, rng, x, z, 1.1 + rng() * 0.6, false);
      else { const s = 1.1 + rng() * 0.4; b.cyl(x, -0.2, z, 0.22 * s, 0.32 * s, 2.9 * s, '#5e4026', { seg: 6, collide: false }); b.ico(x, 3.9 * s, z, 2.0 * s, '#5a9338', { detail: 0, ry: rng() * 3 }); }
    }
    for (let i = 0; i < 5; i++) {                                             // tribün (güney, çitin dışında)
      b.box(0, 0, 29.6 + i * 0.8, 20, 0.4 + i * 0.4, 0.8, '#c9ced6', NC);
      for (let k = -9.5; k <= 9.5; k += 1.0) b.box(k, 0.4 + i * 0.4, 29.45 + i * 0.8, 0.7, 0.16, 0.4, PAINT[(Math.round(k + 9.5) + i) % PAINT.length], NC);
    }
    b.box(0, 0, 34.0, 20.6, 4.0, 0.3, '#3a4250', NC);
    for (const s of [-1, 1]) b.box(s * 12.0, 0, 29.4, 0.4, 5.2, 0.4, LOG_D, NC);
    b.box(0, 5.2, 29.4, 24.4, 0.5, 0.4, LOG_D, NC);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = 160 + (i % 3) * 30; b.ico(Math.cos(a) * r, -26, Math.sin(a) * r, 42 + (i % 4) * 10, i % 2 ? '#6c9468' : '#77a073', { scale: [1.8, 0.6, 1.2], ry: i }); }
  });
  for (let s = 0; s < 4; s++) { const [x, z] = rotXZ(s, 0, -44 - 150); b.box(x, -0.3, z, s % 2 ? 300 : 600, 0.3, s % 2 ? 600 : 300, '#5b8a43', NC); }   // arazi karesinin (±44) dışı düz çayır

  // ───── doğuşlar, dolaşma noktaları, bölge adları, toplama noktaları ─────
  const spawns = [];
  const sp = (x, z) => spawns.push({ x, z, y: terrain.heightAt(x, z), ry: Math.atan2(x, z) });
  for (const [x, z] of [[-25.4, -25.4], [-11.6, -25.6], [9.6, -25.0], [25.2, -25.6], [25.4, -8.6], [25.4, 6.4], [25.4, 25.4], [9.0, 25.6], [-1.2, 25.6], [-14.4, 26.0],
    [-26.0, 26.2], [-25.4, 7.0], [-25.6, -7.6], [-12.6, -12.4], [12.4, -9.6], [12.6, 1.0], [-14.0, 0.6], [-1.4, 9.6], [7.4, 9.0], [0.6, -20.4], [-8.4, 18.4], [-20.0, -13.2]]) sp(x, z);
  const roam = [[0.4, 0.2, TUR], [-0.6, -0.8, TUR], [0.2, 0.6, TUR], [-3.8, -3.8, DECK], [3.8, 3.8, DECK], [-3.8, 4.0, DECK], [4.2, -3.8, DECK], [0, -4.2, DECK], [0, 4.2, DECK], [-4.2, 0, DECK], [4.2, 0.4, DECK],      // [x, z, kat]: kale ağırlıklı
    [18.4, 22.4, 3.6], [-2.0, -2.0, 0], [2.4, 2.4, 0],
    [-19.0, -19.4, 0], [-19.4, -15.6, 0], [0, -15.6, 0], [0, -20.6, 0], [18.8, -16.2, 0], [21.2, -20.0, 0], [18.8, 21.3, 3.6], [16.2, 18.4, 0],
    [-19.6, 21.0, 0], [-15.6, 25.0, 0], [-8.0, 19.8, 0], [6.6, 20.0, 0], [-17.0, 12.3, 0.15], [3.0, 16.6, 0.15], [13.0, 15.3, 0.15], [-19.0, -0.4, 0], [-15.6, -7.6, 0], [19.0, 0.4, 0], [17.4, -1.4, 0], [-4.0, 13.8, -0.9], [9.0, 12.6, 0]];
  const callouts = [
    { name: 'Kale', x: 0, z: 0, r: 7, major: true }, { name: 'Gözcü', x: 0, z: 0, r: 2 },
    { name: 'Kulübe', x: -19, z: -20, r: 5.5, major: true }, { name: 'Hurda', x: 19, z: -19, r: 7, major: true },
    { name: 'Gözetleme', x: 18.6, z: 22.4, r: 5, major: true }, { name: 'Saman', x: -19, z: 21.6, r: 6.5, major: true },
    { name: 'Paletler', x: 0, z: -18, r: 6.5, major: true }, { name: 'Koru', x: -19, z: -1, r: 7, major: true }, { name: 'Çit Hattı', x: 18.4, z: 1.2, r: 6.5, major: true },
    { name: 'Dere', x: -6, z: 14.3, r: 4.5, major: true }, { name: 'Hakem Kulübesi', x: -8, z: 22.3, r: 3.2 }, { name: 'Kamp', x: 6.6, z: 23.2, r: 3 },
    { name: 'Batı Köprüsü', x: -17, z: 12.3, r: 3 }, { name: 'Orta Köprü', x: 3, z: 16.6, r: 3 }, { name: 'Doğu Köprüsü', x: 13, z: 15.3, r: 3 },
  ];
  const pickupSpots = [                                                        // toplama sistemi (cephane / can) için önerilen yerler: zeminde / güvertede, siper yanında, merkezden dengeli
    { x: -2.2, y: 0, z: -2.4, kind: 'ammo' }, { x: 2.4, y: DECK, z: -4.4, kind: 'health' },
    { x: -19.0, y: 0, z: -19.0, kind: 'health' }, { x: 18.0, y: 0, z: -15.4, kind: 'ammo' },
    { x: 18.8, y: 3.6, z: 21.8, kind: 'ammo' }, { x: -18.4, y: 0, z: 20.8, kind: 'health' },
    { x: 0.0, y: 0, z: -15.6, kind: 'ammo' }, { x: -17.6, y: 0, z: -0.4, kind: 'health' }, { x: 18.0, y: 0, z: 0.6, kind: 'ammo' }, { x: -8.0, y: 0, z: 19.8, kind: 'ammo' },
  ];
  for (const p of pickupSpots) { let bd = 1e9; for (const c of callouts) { const d = Math.hypot(c.x - p.x, c.z - p.z) - c.r; if (d < bd) { bd = d; p.name = c.name; } } }   // kutu adı: en yakın bölge (pickups.js)

  const group = b.build();
  if (typeof document !== 'undefined' && !MapBuilder.noVisual) {
    const gnd = new THREE.Color('#5d9a45'), gnd2 = new THREE.Color('#4f8a3c'), moss = new THREE.Color('#6aa64a'), dirt = new THREE.Color('#9a7a52'), mud = new THREE.Color('#6e5a40'), bed = new THREE.Color('#8b8676'), needle = new THREE.Color('#8a7a48'), tmp = new THREE.Color();
    const mesh = terrain.buildMesh((x, z, h, slope, c) => {
      const n1 = vnoise(x * 0.18, z * 0.18), n2 = vnoise(x * 0.6 + 9, z * 0.6);
      c.copy(gnd).lerp(gnd2, n1);
      if (n2 > 0.66) c.lerp(moss, (n2 - 0.66) * 2.4);
      if (n1 > 0.62) c.lerp(needle, (n1 - 0.62) * 1.4);                         // iğne yaprak yamaları
      let pd = 1e9; for (const p of PATHS) pd = Math.min(pd, segD(x, z, p[0], p[1], p[2], p[3]));
      const pw = 1 - smoothstep(0.7, 1.6, pd + (n2 - 0.5) * 0.8);
      if (pw > 0) c.lerp(dirt, pw * 0.75);
      if (Math.abs(x) < 7.2 && Math.abs(z) < 7.6) c.lerp(dirt, 0.55 * (1 - smoothstep(5.6, 7.2, Math.max(Math.abs(x), Math.abs(z)))));   // kale çevresi çiğnenmiş toprak
      if (h < -0.05) { tmp.copy(mud).lerp(bed, smoothstep(-0.4, -0.85, h)); c.lerp(tmp, Math.min(1, -h * 4)); }
      if (Math.max(Math.abs(x), Math.abs(z)) > 28.4) c.lerp(gnd2, 0.5);
    }, { smooth: true, jitter: 0.05 });
    group.add(mesh);
    // dere suyu: dere ekseni boyunca şerit (y −0,5), kenarları yamacın altında kalır
    const pos = [], idx = [];
    for (let x = -44, i = 0; x <= 44; x += 1, i++) {
      const zc = creekZ(x);
      pos.push(x, WATER_Y, zc - 2.7, x, WATER_Y, zc + 2.7);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setIndex(idx); wg.computeVertexNormals();
    const water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: '#4f9fb2', transparent: true, opacity: 0.74, roughness: 0.42, metalness: 0, depthWrite: false }));
    water.receiveShadow = true; group.add(water);
    // tabelalar
    const sign = (text, w, h, o = {}) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
      const g = c.getContext('2d');
      if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, c.width, c.height); }
      g.font = o.font || 'bold 150px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (o.stroke) { g.lineWidth = 18; g.strokeStyle = o.stroke; g.strokeText(text, c.width / 2, c.height / 2 + 6, c.width * 0.92); }
      g.fillStyle = o.fg || '#ffffff'; g.fillText(text, c.width / 2, c.height / 2 + 6, c.width * 0.92);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, transparent: !o.bg }));
    };
    const s1 = sign('ORMAN KALESİ', 9.0, 1.2, { fg: '#ffd23a', stroke: '#2a1a0c' }); s1.position.set(0, 5.95, 29.18); s1.rotation.y = Math.PI; group.add(s1);
    const s2 = sign('KULÜBE', 2.2, 0.38, { bg: '#f4f1ea', fg: '#5a3a1e', font: 'bold 130px Arial Black, Arial, sans-serif' }); s2.position.set(-19.1, 2.14, -17.5 + 0.034); group.add(s2);
    const s3 = sign('HAKEM', 2.6, 0.32, { bg: '#ffd23a', fg: '#1d2230', font: 'bold 200px Arial Black, Arial, sans-serif' }); s3.position.set(-8.0, 1.96, 21.0 - 0.024); s3.rotation.y = Math.PI; group.add(s3);
  }
  return {
    id: 'ormankale',
    name: 'Orman Kalesi',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: OK_BOUNDS,
    terrain,
    baseZones: null,
    spawns: { blue: spawns, red: spawns },
    ffaSpawns: spawns,
    pickupSpots,
    objectives: [],
    roamPoints: roam,
    callouts,
    layered: true,
    navLayers: true,                                                         // çok katlı yol bulma (NavGridML): kale alt kat + güverte + gözcü, gözetleme kulesi
    roads: [],
    mini: { bg: '#3f7a36', ground: [86, 146, 68], wall: '#f4e2c4', mid: '#c49766', low: '#ffd23a', roof: '#7a4f30', pit: [70, 150, 176] },
    env: { sky: ['#4a92d8', '#9cc8ea', '#e2f0f4'], fog: ['#cfe2d8', 70, 300], sun: ['#fff1d6', 2.7], hemi: ['#d6ecff', '#5d7a44', 1.3], sunPos: [38, 80, 30], clouds: 12 },
  };
}
