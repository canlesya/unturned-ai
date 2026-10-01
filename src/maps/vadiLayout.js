import { fbm, smoothstep, mixf, terrace, segDist, capW, rectDist, Trail } from './terrain.js';

// VADİ — arazi yerleşimi (yükseklik alanı, patikalar, düzlükler).
// Harita 180° dönme simetriktir: (x,z) → (−x,−z). Yalnızca "mavi yarı" (x<0) tanımlanır, kırmızı yarı dönmüş kopyasıdır.
//
//        KUZEY (−z)
//   ┌──────────────────────────────────────────────┐
//   │ KB sırt  ledge ═══════╗  ╔═══ KD sırt (ledge) │
//   │   Tepe(−20,−40)       ║  ║      Değirmen      │
//   │ Mavi ─ şikan ─ Mezra ─ KÖPRÜ ─ Mezra ─ şikan ─ Kırmızı
//   │   Ambar(−30,26)       ║  ║      Kamp(20,40)   │
//   └──────────────────────────────────────────────┘
//        GÜNEY (+z)

export const VADI_BOUNDS = { minX: -90, maxX: 90, minZ: -60, maxZ: 60 };
export const RIVER_W = 3.4;
export const riverX = (z) => 2.6 * Math.sin(z * 0.045);

export const rot = (p) => [-p[0], -p[1]];
const nS = (x, z, seed, oct, f) => 0.5 * (fbm(x * f, z * f, seed, oct) + fbm(-x * f, -z * f, seed, oct));   // dönme-simetrik gürültü

// ───────── Düzlükler (plato) — mavi yarı ─────────
export const BOWL = { cx: -75, cz: 0, hx: 12, hz: 16.5, y: 2.2, fall: 9 };       // mavi doğuş çanağı
export const BASE_ZONES = {
  blue: { minX: -88, maxX: -62, minZ: -17, maxZ: 17 },
  red: { minX: 62, maxX: 88, minZ: -17, maxZ: 17 },
};
// Hedef konumları (mavi yarıdaki ve onun dönmüşü)
export const OBJ = {
  kopru: [0, 0],
  tepe: [-20, -40],     // Gözetleme Tepesi (mavi kuzey sırt)
  ambar: [-24, 25],     // Ambar (mavi güney çiftlik avlusu)
  degirmen: [24, -25],  // Değirmen (kırmızı kuzey)
  kamp: [20, 40],       // Orman Kampı (kırmızı güney sırt)
};
// Tümsek/sırt (spur) kapsülleri: [ax,az,bx,bz, r(düz tepe), fall, yükseklik]
const SPURS = [
  [-57, -37, -57, -1, 2.5, 9, 5.6],       // A: kuzey sırttan inen burun (doğuş çanağını doğudan kapatır)
  [-37, 36, -37, 1, 2.5, 9, 5.6],       // B: güney sırttan inen burun (A ile şikan oluşturur)
  [-92, -23, -66, -22, 2.0, 8.0, 6.5],    // çanak kuzey çeperi
  [-92, 23, -66, 22, 2.0, 8.0, 6.5],      // çanak güney çeperi
  [-26, -18, -19, -20, 2.5, 7, 2.2],      // Mezra kuzeyinde alçak tümsek
];
export const SADDLE_Y = 6.4;       // asma köprü tabliye yüksekliği (kuzey/güney yarık)
// Tepe zirvesi (düz): [x,z,hx,hz,y,fall]
const SUMMITS = [
  [-20, -40, 10, 8, 8.6, 8],
];

// Patika / yol tanımları (mavi yarı). Her biri dönmüşüyle birlikte kazınır.
// pin: [y başı, y sonu] (null = arazi)
const T = (name, pts, o = {}) => ({ name, pts, o: { name, ...o } });
const TRAIL_DEFS = [
  // Ana yol: çanaktan şikan boyunca köprüye
  T('merkez', [[-66, 9], [-59, 11], [-52, 9], [-47, 3.5], [-44.5, -3], [-40, -8], [-33, -8.5], [-26, -5], [-19, -1.5], [-13, 0], [-9, 0]], { w: 6, fall: 3.5, grade: 0.25, smooth: 2, pin: [null, 0.3] }),
  // Kuzey patika: çanak → kuzey sırt → Tepe
  T('kuzey', [[-65, -14], [-62, -20], [-58, -26], [-52, -31], [-45, -34.5], [-37, -34], [-29, -37], [-22, -40]], { w: 4.2, grade: 0.34 }),
  T('kuzeyLedge', [[-52, -31], [-54, -38], [-57, -44], [-60, -49]], { w: 3.6, grade: 0.42 }),
  T('ledgeK', [[-61, -49.5], [-52, -50.5], [-42, -51], [-32, -51.5], [-22, -50.5], [-15, -49.5], [-10, -47.5], [-7.5, -46.5]], { w: 3.4, fall: 3.5, grade: 0.35, smooth: 9, pin: [null, SADDLE_Y] }),
  T('tepeLedge', [[-19.8, -41], [-19.2, -45], [-17.5, -49.2]], { w: 3.6, grade: 0.45 }),
  // Mezra → Tepe rampası (güney yaklaşım) + kuzey geçide inen yol
  T('tepeRampa', [[-26, -4], [-25.5, -11], [-25, -19], [-26, -27], [-24.5, -34], [-21.5, -38.5]], { w: 4.4, grade: 0.36 }),
  T('kuzeyGecit', [[-25.5, -12], [-24, -17], [-19, -19.5], [-12, -22.3], [-6, -25.5], [-2.4, -26]], { w: 4.6, grade: 0.3 }),
  T('tepeDogu', [[-9, -26], [-12.5, -32], [-17, -37], [-20.5, -40]], { w: 4.0, grade: 0.4 }),
  // Güney geçit: çanaktan B sırtı üzerinden Ambar'a
  T('guney', [[-66, 13], [-60, 16], [-52, 19], [-45, 20], [-39, 21], [-35, 22.3], [-31.5, 22.5]], { w: 4.8, grade: 0.3, smooth: 2 }),
  T('guneyGecit', [[-16.5, 26], [-8, 26], [-2.4, 26]], { w: 4.6, grade: 0.25 }),
  T('mezraAmbar', [[-24, 4], [-23.5, 11], [-24, 16]], { w: 4.4, grade: 0.3 }),
  // Güney sırt: Ambar'dan ledge'e kayalık yol + çanaktan güney patika
  T('ambarSirt', [[-25.5, 34], [-28, 39], [-35, 44], [-44, 48.5], [-49, 49]], { w: 3.6, grade: 0.42 }),
  T('ledgeG', [[-62, 48.5], [-52, 50], [-42, 50.5], [-33, 50], [-24, 49.5], [-16, 48.5], [-11, 47.5], [-7.5, 46.5]], { w: 3.4, fall: 3.5, grade: 0.35, smooth: 9, pin: [null, SADDLE_Y] }),
  T('guneyPatika', [[-60, 15], [-63, 24], [-62, 33], [-61, 41], [-62, 48]], { w: 3.6, grade: 0.4 }),
];

// ───────── Yükseklik alanı ─────────
function baseH(x, z) {
  const az = Math.abs(z), ax = Math.abs(x);
  const flat = 0.25 + 0.75 * smoothstep(14, 40, az);            // vadi tabanı yerleşim için daha düz, sırtlara doğru dalgalı
  let h = 0.95 + (nS(x, z, 7, 3, 0.016) - 0.5) * 2.8 * flat + (nS(x, z, 11, 2, 0.07) - 0.5) * 0.9 * flat;
  // sırtlar: vadi uçlarında daralır (çanak), ortada genişler
  const zs = 15 + 11 * (1 - smoothstep(26, 66, ax));
  const warp = (nS(x, z, 21, 2, 0.045) - 0.5) * 3.0;
  const r = smoothstep(zs, zs + 46, az);
  let R = r * (14 + 9 * nS(x, z, 3, 3, 0.022)) + warp * smoothstep(zs + 4, zs + 20, az);
  R = mixf(R, terrace(Math.max(0, R + warp * 0.6), 4.2, 1), 0.10 * smoothstep(zs + 6, zs + 18, az));
  h += R;
  return h;
}

function mountain(x, z) {
  const ox = Math.max(0, Math.abs(x) - 87), oz = Math.max(0, Math.abs(z) - 62);
  const d = ox + oz;
  return Math.min(80, d * 0.92 + (fbm(x * 0.03, z * 0.03, 9, 3) - 0.4) * Math.min(1, d / 30) * 14);
}

// alan çarpıtma: düz kapsül/dikdörtgen kenarlarını doğal dalgalandırır
const warpX = (x, z) => (nS(x + 31, z - 17, 41, 2, 0.055) - 0.5) * 9;
const warpZ = (x, z) => (nS(x - 13, z + 29, 43, 2, 0.055) - 0.5) * 9;

function spursAdd(x, z) {
  let a = 0;
  for (let i = 0; i < SPURS.length; i++) {
    const s = SPURS[i];
    const n = 0.88 + 0.24 * fbm(x * 0.05 + i * 5, z * 0.05, 31 + i, 2);
    for (const g of [1, -1]) {
      const px = g * x, pz = g * z;
      const wx = px + warpX(px, pz), wz = pz + warpZ(px, pz);
      a += s[6] * n * capW(wx, wz, s[0], s[1], s[2], s[3], s[4], s[5]);
    }
  }
  return a;
}

const pads = [];     // {x,z,hx,hz,y,fall} — düz bina yerleri (dünya koordinatı)
export function addPad(p) { pads.push({ fall: 3.2, y: null, ...p }); return pads[pads.length - 1]; }

function preH(x, z) {            // pad/patika öncesi
  let h = baseH(x, z);
  h += spursAdd(x, z);
  for (const sgn of [1, -1]) {
    const w = 1 - smoothstep(0, BOWL.fall, rectDist(x + 0.5 * warpX(x, z), z + 0.5 * warpZ(x, z), sgn * BOWL.cx, sgn * BOWL.cz, BOWL.hx, BOWL.hz));
    h = mixf(h, BOWL.y, w);
    for (const s of SUMMITS) {
      const w2 = 1 - smoothstep(0, s[5], rectDist(x, z, sgn * s[0], sgn * s[1], s[2], s[3]));
      h = mixf(h, s[4], w2);
    }
  }
  h += mountain(x, z);
  return h;
}

function padsH(x, z, h) {
  for (const p of pads) {
    const w = 1 - smoothstep(0, p.fall, rectDist(x, z, p.x, p.z, p.hx, p.hz));
    if (w > 0) h = mixf(h, p.y, w);
  }
  return h;
}

export const TRAILS = [];
let _ready = false;
const _scr = {};
function trailsH(x, z, h, upto, o = _scr) {
  for (let i = 0; i < upto; i++) {
    const t = TRAILS[i];
    if (!t.y) continue;
    const q = t.near(x, z, o);
    if (!q) continue;
    const w = t.weight(q.d);
    if (w > 0) h = mixf(h, q.y, w);
  }
  return h;
}

function riverH(x, z, h) {
  const dx = x - riverX(z);
  // kanyon sırtlara doğru daralır (asma köprü yarığında iki yaka aynı seviyede kalır)
  const sg = RIVER_W * (1 - 0.5 * smoothstep(36, 48, Math.abs(z)));
  const wr = Math.exp(-(dx * dx) / (2 * sg * sg));
  const bed = -2.8 + 0.17 * Math.max(0, Math.abs(z) - 30);
  h = mixf(h, Math.min(h, bed), Math.min(1, wr * 1.15));
  for (const fz of [-26, 26]) {
    const w = (1 - smoothstep(3.5, 6.5, Math.abs(z - fz))) * (1 - smoothstep(7, 11, Math.abs(dx)));
    if (w > 0) h = mixf(h, Math.max(h, -0.14), w);
  }
  return h;
}

// Kuzey/güney yarık: nehir sırttan akar; asma köprü geçidinde sırt alçalır
function saddleH(x, z, h) {
  for (const fz of [-47, 47]) {
    const d = Math.hypot((x - riverX(fz)) * 0.8, (z - fz) * 1.0);
    const w = 1 - smoothstep(6, 17, d);
    if (w > 0) h = mixf(h, Math.min(h, 5.2 + 0.25 * Math.abs(x - riverX(fz))), w);
  }
  return h;
}

// Yapılar (pad) kayıt edildikten sonra çağrılır: patikaların yatak yüksekliklerini hesaplar
export const layoutReady = () => _ready;
export const PADS = pads;
export function finalizeLayout() {
  if (_ready) return;
  _ready = true;
  pads.sort((a, b) => a.hx * a.hz - b.hx * b.hz);      // küçükler önce, büyük yapı düzlükleri en son (üstüne yazar)
  for (const p of pads) {
    if (p.y == null) {         // medyan: yamaç/tümsek uçlarındaki örnekler yüksekliği çarpıtmasın
      const v = [preH(p.x, p.z)];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) v.push(preH(p.x + sx * p.hx * 0.8, p.z + sz * p.hz * 0.8));
      v.sort((a, b) => a - b);
      p.y = Math.round(v[2] * 20) / 20;
    }
  }
  for (const d of TRAIL_DEFS) {
    for (const sgn of [1, -1]) {
      const pts = d.pts.map((p) => [p[0] * sgn, p[1] * sgn]);
      TRAILS.push(Object.assign(new Trail(pts, d.o), { pin: d.o.pin || null, side: sgn }));
    }
  }
  for (let k = 0; k < TRAILS.length; k++) {
    const t = TRAILS[k];
    const hf = (x, z) => trailsH(x, z, padsH(x, z, saddleH(x, z, preH(x, z))), k);
    t.prepare(hf);
    if (t.pin) {
      const n = t.y.length;
      if (t.pin[0] != null) for (let i = 0; i < Math.min(n, 10); i++) t.y[i] = mixf(t.pin[0], t.y[i], smoothstep(0, 9, i));
      if (t.pin[1] != null) for (let i = 0; i < Math.min(n, 10); i++) { const j = n - 1 - i; t.y[j] = mixf(t.pin[1], t.y[j], smoothstep(0, 9, i)); }
    }
  }
}

export function vadiHeight(x, z) {
  finalizeLayout();
  let h = preH(x, z);
  h = saddleH(x, z, h);
  h = padsH(x, z, h);
  h = trailsH(x, z, h, TRAILS.length, (vadiHeight._o ||= {}));
  h = riverH(x, z, h);
  return Math.max(h, -3.2);
}
export { segDist };
