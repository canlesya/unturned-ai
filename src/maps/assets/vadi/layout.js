import { fbm, smoothstep, mixf, terrace, segDist, capW, rectDist, Trail, WATER_LEVEL } from '../../terrain.js';

// VADİ v3 (12.169) — arazi yerleşimi: yükseklik alanı, patikalar, nehir + kanyon, yapı düzlükleri (pad).
// Oynanış şablonu v2 ile AYNI: 180 × 120 m, doğu-batı vadi, ortada kuzey-güney nehir; Mavi batı / Kırmızı doğu çanak;
// 180° dönme simetrisi (x, z) → (−x, −z): yalnız mavi yarı tanımlanır, kırmızı yarı dönmüş kopyadır.
//
//        KUZEY (−z)
//   ┌──────────────────────────────────────────────┐
//   │ KB sırt  ledge ═══ asma köprü ═══ ledge KD sırt│
//   │   Tepe(−20,−40)    ║ kanyon ║      Değirmen    │
//   │ Mavi ─ şikan ─ Mezra ─ KÖPRÜ ─ Mezra ─ şikan ─ Kırmızı
//   │   Ambar(−24,25)    ║  geçit ║      Kamp(20,40) │
//   └──────────────────────────────────────────────┘
//
// Arazi ızgarası 2 m: yapı düzlükleri (pad) ızgaraya hizalı dikdörtgenler (köşeler çift koordinatta) → içindeki her üçgen TAM düz,
// yapı tabanı araziye düz bir çizgiyle oturur (havada / gömülü köşe yok). Düzlükler en son uygulanır (patika / nehir kazısı düzlüğü bozmaz).

export const BOUNDS = { minX: -90, maxX: 90, minZ: -60, maxZ: 60 };
export const TERRAIN_EXT = { minX: -156, maxX: 156, minZ: -126, maxZ: 126, cell: 2 };
export { WATER_LEVEL };
export const BED_Y = -1.25;            // nehir yatağı (en derin): su 1,2 m → içine düşen göz hizası su üstünde kalır
export const DECK_Y = 1.3;             // taş köprü tabliyesi (su üstü 1,35 m: kemer altı açık)
export const SADDLE_Y = 6.4;           // asma köprü tabliyesi (kuzey / güney kanyon)
export const BANK_Y = DECK_Y - 0.04;   // köprü başı düzlüğü (tabliye 4 cm üstte: eş düzlem yok)

// nehir ekseni (tek fonksiyon: (−z) → −x, dönme simetrisi); harita dışında kıvrılır (kanyonun ucu görünmesin)
export const riverX = (z) => 2.6 * Math.sin(z * 0.045) + Math.sign(z) * 0.011 * Math.max(0, Math.abs(z) - 56) ** 2;
export const rot = (p) => [-p[0], -p[1]];
const nS = (x, z, seed, oct, f) => 0.5 * (fbm(x * f, z * f, seed, oct) + fbm(-x * f, -z * f, seed, oct));   // dönme-simetrik gürültü

export const BOWL = { cx: -75, cz: 0, hx: 12, hz: 16.5, y: 2.2, fall: 9 };
export const BASE_ZONES = {
  blue: { minX: -88, maxX: -62, minZ: -17, maxZ: 17 },
  red: { minX: 62, maxX: 88, minZ: -17, maxZ: 17 },
};
export const OBJ = { kopru: [0, 0], tepe: [-20, -40], ambar: [-24, 25], degirmen: [24, -25], kamp: [20, 40] };

// tümsek / sırt kapsülleri: [ax, az, bx, bz, r, fall, yükseklik]
const SPURS = [
  [-57, -37, -57, -1, 2.5, 9, 5.6],       // A: kuzey sırttan inen burun (doğuş çanağını doğudan kapatır)
  [-37, 36, -37, 1, 2.5, 9, 5.6],         // B: güney sırttan inen burun (A ile şikan)
  [-92, -28.5, -66, -27.5, 2.0, 8.0, 6.5],  // çanak kuzey çeperi (ahırın arkasından 12 m: çeperden ahır çatısına atlanmaz)
  [-92, 28.5, -66, 27.5, 2.0, 8.0, 6.5],    // çanak güney çeperi
  [-26, -18, -19, -20, 2.5, 7, 2.2],      // Mezra kuzeyinde alçak tümsek
];

// ───────── Yapı düzlükleri (mavi yarı; kırmızı = dönmüş). [ad, x0, z0, x1, z1, y | null (medyan)] — köşeler çift sayı (2 m ızgara) ─────────
// Bir düzlük birden çok yapıyı taşıyabilir (aynı kot). Düzlükler birbirine değmez (en az 2 m arayla).
export const PAD_DEFS = [
  ['canak-ahir', -90, -18, -76, -2, 2.2],     // ahır (x −88…−78, z −16…−4)
  ['canak-silo', -90, 0, -82, 14, 2.2],       // iki silo
  ['canak-ev', -82, 6, -70, 16, 2.2],         // çiftlik evi (x −80…−72, z 8…14)
  ['mezra-k', -26, -18, -10, -4, BANK_Y],     // köprübaşı kuzey: ev M1 (x −24…−16, z −14…−8), karakol (x −14…−10, z −14…−10), kuyu
  ['mezra-g', -26, 4, -8, 14, BANK_Y],        // köprübaşı güney: ev M2 (x −24…−16, z 6…12), gözetleme kulesi (x −12…−8, z 6…10)
  ['koprubasi', -14, -4, -8, 4, BANK_Y],      // taş köprünün batı başı (tabliye x −10…10)
  ['kmezra', -50, -24, -30, -12, 2.4],        // kuzey mezra: kulübe N1 (x −38…−32, z −20…−14), N2 (x −46…−40, z −22…−16; sırt yamacından uzak)
  ['gkulube', -52, 24, -40, 36, 3.0],          // güney çiftlik kulübesi (x −48…−42, z 26…32; güney / batı yamaca 4 m)
  ['ambar', -36, 14, -12, 38, BANK_Y],        // Ambar / Değirmen avlusu (duvar x −34…−14, z 16…36); mezra-g ile aynı kot (kenarları değer)
  ['tepe', -30, -48, -16, -32, 8.6],          // Gözetleme Tepesi / Orman Kampı zirvesi (asma köprü ayağından 4 m uzak: aradaki yamaç 0,56)
  ['kamp-gizli-1', -50, -46, -44, -40, null], // orman bankındaki gizli kamp (kuzey patikadan 3,4 m, ledge'den 2,8 m: patika kenarı şevlenmez)
  ['kamp-gizli-2', -72, 34, -66, 40, null],  // patikanın 4 m batısında (güney kulübesinden 14 m: aradaki yamaç yumuşak)
  ['yuva-k1', -48, -54, -44, -48, null],      // ledge üstü keskin nişancı yuvaları: patika yatağı + vadi tarafı düz platform (torbalar yamaçta gömülmesin)
  ['yuva-k2', -38, -54, -34, -48, null],
  ['yuva-g1', -58, 46, -54, 52, null],
  ['yuva-g2', -28, 46, -24, 52, null],
  ['yuva-g3', -40, 46, -36, 52, null],
  ['asma-b', -12, -48, -8, -44, SADDLE_Y - 0.04],   // kuzey asma köprünün batı ayağı (tabliye x −9…5); güney köprü ayakları dönmüşü
  ['asma-d', 4, -48, 10, -44, SADDLE_Y - 0.04],     // kuzey asma köprünün doğu ayağı
];
export const PADS = [];       // dünya koordinatlı: {id, side, x0, z0, x1, z1, y}

// patika / yol tanımları (mavi yarı)
const T = (name, pts, o = {}) => ({ name, pts, o: { name, ...o } });
const TRAIL_DEFS = [
  T('merkez', [[-66, 9], [-59, 11], [-52, 9], [-47, 3.5], [-44.5, -3], [-40, -8], [-33, -8.5], [-26, -3.5], [-19, -0.5], [-13, 0], [-9, 0]], { w: 6, fall: 3.5, grade: 0.25, smooth: 2, pin: [BOWL.y, BANK_Y] }),
  T('kuzey', [[-65, -14], [-62, -20], [-58, -26], [-52, -31], [-45, -34.5], [-37, -34], [-31, -36.5], [-26, -40]], { w: 4.2, grade: 0.34, pin: [BOWL.y, 8.6] }),
  T('kuzeyLedge', [[-52, -31], [-54, -38], [-57, -44], [-60, -49]], { w: 3.6, grade: 0.42 }),
  T('ledgeK', [[-61, -49.5], [-52, -50.5], [-42, -51], [-32, -51.5], [-22, -51], [-15, -50], [-11.5, -47], [-9.5, -46]], { w: 3.4, fall: 3.5, grade: 0.35, smooth: 9, pin: [null, SADDLE_Y - 0.04] }),
  T('tepeLedge', [[-23, -45.5], [-22.6, -48.5], [-21.8, -51.2]], { w: 3.6, grade: 0.6, pin: [8.6, null] }),
  T('tepeRampa', [[-28, -4], [-28, -11], [-27, -17], [-25.5, -22], [-25, -27], [-24.5, -33]], { w: 4.4, grade: 0.42, pin: [null, 8.6] }),
  T('kuzeyGecit', [[-28.5, -12], [-26, -19], [-19, -20.2], [-12, -22.3], [-6, -25.5], [-2.4, -26]], { w: 4.6, grade: 0.3 }),
  T('tepeDogu', [[-15.5, -21.4], [-14.5, -26.5], [-14, -31], [-15.5, -35], [-18.5, -36.5]], { w: 4.0, grade: 0.55, pin: [null, 8.6] }),
  T('guney', [[-66, 13], [-60, 16], [-52, 19], [-45, 20], [-39, 21], [-35, 22.3], [-31.5, 22.5]], { w: 4.8, grade: 0.3, smooth: 2, pin: [BOWL.y, BANK_Y] }),
  T('guneyGecit', [[-14, 27], [-8, 26], [-2.4, 26]], { w: 4.6, grade: 0.25, pin: [BANK_Y, null] }),
  T('mezraAmbar', [[-28, 3], [-28.5, 9], [-26, 14], [-24, 16]], { w: 4.4, grade: 0.3, pin: [BANK_Y, BANK_Y] }),
  T('ambarSirt', [[-25.5, 37], [-22.5, 39.5], [-19.5, 42.5], [-18, 46], [-20, 49.2]], { w: 3.6, grade: 0.62, pin: [BANK_Y, null] }),     // Ambar güney kapısından güney sırtına (ledge'e kendi kotunda kavuşur)
  T('ledgeG', [[-62, 48.5], [-52, 50], [-42, 50.5], [-33, 50], [-24, 49.5], [-16, 48.5], [-11.5, 47], [-9.5, 46]], { w: 3.4, fall: 3.5, grade: 0.35, smooth: 9, pin: [null, SADDLE_Y - 0.04] }),
  T('guneyPatika', [[-60, 15], [-63, 24], [-62, 33], [-61, 41], [-62, 48]], { w: 3.6, grade: 0.4 }),
];

// ───────── yükseklik alanı ─────────
function baseH(x, z) {
  const az = Math.abs(z), ax = Math.abs(x);
  const flat = 0.25 + 0.75 * smoothstep(14, 40, az);
  let h = 0.95 + (nS(x, z, 7, 3, 0.016) - 0.5) * 2.8 * flat + (nS(x, z, 11, 2, 0.07) - 0.5) * 0.9 * flat;
  const zs = 15 + 11 * (1 - smoothstep(26, 66, ax));
  const warp = (nS(x, z, 21, 2, 0.045) - 0.5) * 3.0;
  const r = smoothstep(zs, zs + 46, az);
  let R = r * (14 + 9 * nS(x, z, 3, 3, 0.022)) + warp * smoothstep(zs + 4, zs + 20, az);
  R = mixf(R, terrace(Math.max(0, R + warp * 0.6), 4.2, 1), 0.1 * smoothstep(zs + 6, zs + 18, az));
  return h + R;
}
// sınır dışı dağlar: oyun alanının dışında yükselir, ~35 m'de sırt yapar, kenara doğru alçalır (arazinin kesik ucu vadiden görünmez)
function mountain(x, z) {
  const ox = Math.max(0, Math.abs(x) - 87), oz = Math.max(0, Math.abs(z) - 62);
  const d = Math.hypot(ox, oz) * 0.5 + (ox + oz) * 0.5;
  const peak = 34 + 24 * nS(x, z, 9, 3, 0.02);
  const rise = peak * smoothstep(0, 80, d);                           // ~80 m'de tepe: ormanlı yamaç (eğim ≤ ~1), dik kaya duvarı değil
  return rise + (fbm(x * 0.05, z * 0.05, 19, 3) - 0.45) * Math.min(1, d / 25) * 8;
}
const warpX = (x, z) => (nS(x + 31, z - 17, 41, 2, 0.055) - 0.5) * 9;
const warpZ = (x, z) => (nS(x - 13, z + 29, 43, 2, 0.055) - 0.5) * 9;
function spursAdd(x, z) {
  let a = 0;
  for (let i = 0; i < SPURS.length; i++) {
    const s = SPURS[i];
    const n = 0.88 + 0.24 * fbm(x * 0.05 + i * 5, z * 0.05, 31 + i, 2);
    for (const g of [1, -1]) {
      const px = g * x, pz = g * z;
      a += s[6] * n * capW(px + warpX(px, pz), pz + warpZ(px, pz), s[0], s[1], s[2], s[3], s[4], s[5]);
    }
  }
  return a;
}
export function preH(x, z) {
  let h = baseH(x, z) + spursAdd(x, z);
  for (const sgn of [1, -1]) {
    const w = 1 - smoothstep(0, BOWL.fall, rectDist(x + 0.5 * warpX(x, z), z + 0.5 * warpZ(x, z), sgn * BOWL.cx, sgn * BOWL.cz, BOWL.hx, BOWL.hz));
    h = mixf(h, BOWL.y, w);
    const w2 = 1 - smoothstep(0, 8, rectDist(x, z, sgn * -20, sgn * -40, 10, 8));     // zirve
    h = mixf(h, 8.6, w2);
  }
  return h + mountain(x, z);
}
// kuzey / güney sırtta asma köprü geçidi: sırt kanyonun iki yakasında köprü kotuna iner
function saddleH(x, z, h) {
  for (const fz of [-46.5, 46.5]) {
    const d = Math.hypot((x - riverX(fz)) * 0.8, z - fz);
    const w = 1 - smoothstep(7, 18, d);
    if (w > 0) h = mixf(h, Math.min(h, SADDLE_Y - 0.6 + 0.22 * Math.abs(x - riverX(fz))), w);
  }
  return h;
}
// nehir yatağı + kıyı + kanyon: vadide yumuşak kumlu kıyı, sırtlarda dik kaya duvarlı kanyon; iki sığ geçit (z = ±26)
export function riverProfile(d, z) {
  const k = smoothstep(33, 43, Math.abs(z));                        // kanyon payı
  const vall = BED_Y + 1.6 * smoothstep(2.0, 6.4, d) + Math.max(0, d - 6.4) * 1.6;     // kıyının üstü yükselmeye devam eder (nehir yanında düz taşkın şeridi yok: patikalar kesilmez)
  const cany = BED_Y + Math.max(0, d - 2.4) * 1.75 + Math.max(0, d - 6.5) * 2.2;
  let P = mixf(vall, cany, k);                                       // kanyon duvarı yukarı doğru sınırsız (dağ içinden geçer; tavan / dik basamak yok)
  for (const fz of [-26, 26]) {
    const w = (1 - smoothstep(3.0, 5.5, Math.abs(z - fz))) * (1 - smoothstep(6.5, 9, d));
    if (w > 0) P = mixf(P, Math.max(P, -0.16), w);
  }
  return P;
}
function riverH(x, z, h) {
  const d = Math.abs(x - riverX(z));
  if (d > 24) return h;                                              // kanyon profili 24 m'de her dağdan yüksek: kesinti yok
  const w = 1 - smoothstep(9, 15, d) * (1 - smoothstep(33, 43, Math.abs(z)));
  return mixf(h, Math.min(h, riverProfile(d, z)), w);
}

export const TRAILS = [];
const _scr = {};
// iki geçiş: önce bütün patikaların şev bölgeleri (yatak dışı, ağırlık < 1), sonra yatakları (ağırlık 1) → bir patikanın şevi başka patikanın
// yatağını yükseltip / alçaltıp kesmez (kavşakta sonraki yatak kazanır)
const _bed = [];
function trailsH(x, z, h, upto, o = _scr) {
  let nb = 0;
  for (let i = 0; i < upto; i++) {
    const t = TRAILS[i];
    if (!t.y) continue;
    const q = t.near(x, z, o);
    if (!q) continue;
    if (q.d <= t.w / 2) { _bed[nb++] = q.y; continue; }
    const w = t.weight(q.d);
    if (w > 0) h = mixf(h, q.y, w);
  }
  for (let i = 0; i < nb; i++) h = _bed[i];
  return h;
}
// düzlükler: içi tam düz (ağırlık 1), dışında 3 m'de araziye döner; çakışırsa ağırlığı büyük olan
const PAD_FALL = 4.5;                 // düzlük şevi: yamaçta kazı / dolgu kenarı yumuşak (dik şevde botlar kayıp kalıyordu)
// düzlük şevi (dikdörtgenin dışı) patika yatağının üstüne binmez: şev ağırlığı patika ağırlığıyla azalır → düzlüğün yanından geçen / ona tırmanan
// patika kesilmez (yatağı kendi kotunda kalır, aradaki fark düzlük ile patika arasında şev olur). Dikdörtgenin içi hep düzlük kotunda.
const _pt = {};
function trailW(x, z) { let w = 0; for (const t of TRAILS) { const q = t.y && t.near(x, z, _pt); if (q) w = Math.max(w, t.weight(q.d)); } return w; }
function padsH(x, z, h) {
  let bw = 0, by = 0, out = false;
  for (const p of PADS) {
    const d = Math.hypot(Math.max(0, p.x0 - x, x - p.x1), Math.max(0, p.z0 - z, z - p.z1));
    if (d >= PAD_FALL) continue;
    const w = 1 - smoothstep(0, PAD_FALL, d);
    if (w > bw) { bw = w; by = p.y; out = d > 0; }
  }
  if (bw > 0 && out) bw *= 1 - trailW(x, z);
  return bw > 0 ? mixf(h, by, bw) : h;
}
// düzlük denetimi: kotu farklı iki düzlük aynı arazi düğümünü paylaşmasın (araları ≥ 2 m); paylaşırsa önce gelen kazanır, öbürünün kenarı çöker
export function padConflicts() {
  const out = [];
  for (let i = 0; i < PADS.length; i++) for (let j = i + 1; j < PADS.length; j++) {
    const a = PADS[i], b = PADS[j];
    if (Math.abs(a.y - b.y) < 0.01) continue;
    const gx = Math.max(a.x0 - b.x1, b.x0 - a.x1), gz = Math.max(a.z0 - b.z1, b.z0 - a.z1);
    if (gx < 2 && gz < 2) out.push(a.id + ' × ' + b.id + ' (ara ' + Math.max(gx, gz) + ' m)');
  }
  return out;
}
export const padAt = (x, z, m = 0) => PADS.find((p) => x >= p.x0 - m && x <= p.x1 + m && z >= p.z0 - m && z <= p.z1 + m) || null;

let _ready = false;
export function finalizeLayout() {
  if (_ready) return;
  _ready = true;
  for (const [id, x0, z0, x1, z1, y] of PAD_DEFS) {
    for (const side of [1, -1]) {
      const p = side > 0 ? { x0, z0, x1, z1 } : { x0: -x1, z0: -z1, x1: -x0, z1: -z0 };
      let py = y;
      if (py == null) {                                                  // medyan: yamaç uçlarındaki örnekler kotu çarpıtmasın
        const v = [];
        for (const fx of [0.15, 0.5, 0.85]) for (const fz of [0.15, 0.5, 0.85]) v.push(preH(p.x0 + (p.x1 - p.x0) * fx, p.z0 + (p.z1 - p.z0) * fz));
        v.sort((a, b) => a - b); py = Math.round(v[4] * 20) / 20;
      }
      PADS.push({ id: id + (side > 0 ? ':m' : ':k'), name: id, side, ...p, y: py });
    }
  }
  for (const d of TRAIL_DEFS) for (const sgn of [1, -1]) TRAILS.push(Object.assign(new Trail(d.pts.map((p) => [p[0] * sgn, p[1] * sgn]), d.o), { pin: d.o.pin || null, side: sgn }));
  for (let k = 0; k < TRAILS.length; k++) {
    const t = TRAILS[k];
    t.prepare((x, z) => riverH(x, z, trailsH(x, z, saddleH(x, z, preH(x, z)), k)));      // nehir kıyısı kazısı da hesaba katılır: geçide inen patika kıyıda kesilmez
    if (t.pin) {
      const n = t.y.length;
      // uç sabitleme: patika düzlüğe / çanağa kendi kotunda girer (düzlük şevi patikayı yarmasın). Ucun düzlük + şev (3 m) içindeki örnekleri tam
      // pin kotunda tutulur, sonraki 10 örnekte (~16 m) patikanın kendi profiline karışır; ardından eğim sınırı iki yönde yeniden uygulanır.
      const inPadZone = (i, y) => PADS.some((p) => Math.abs(p.y - y) < 0.05 && t.p[i][0] > p.x0 - 0.5 && t.p[i][0] < p.x1 + 0.5 && t.p[i][1] > p.z0 - 0.5 && t.p[i][1] < p.z1 + 0.5)
        || (Math.abs(y - BOWL.y) < 0.05 && [1, -1].some((sg) => Math.abs(t.p[i][0] - sg * BOWL.cx) < BOWL.hx && Math.abs(t.p[i][1] - sg * BOWL.cz) < BOWL.hz));
      const hold = (y, idx) => { let k = 0; for (const i of idx) { if (!inPadZone(i, y)) break; k++; } return k; };
      const BL = Math.min(10, Math.max(3, Math.round(n / 3)));          // karışım boyu: kısa patikada tüm profil pin kotuna çekilmesin
      if (t.pin[0] != null) { const idx = [...Array(n).keys()], k = hold(t.pin[0], idx); for (let q = 0; q < Math.min(n, k + BL); q++) t.y[q] = q < k ? t.pin[0] : mixf(t.pin[0], t.y[q], smoothstep(0, BL - 1, q - k)); }
      if (t.pin[1] != null) { const idx = [...Array(n).keys()].reverse(), k = hold(t.pin[1], idx); for (let q = 0; q < Math.min(n, k + BL); q++) { const j = n - 1 - q; t.y[j] = q < k ? t.pin[1] : mixf(t.pin[1], t.y[j], smoothstep(0, BL - 1, q - k)); } }
      const mg = t.grade * t.step;
      for (let i = 1; i < n; i++) t.y[i] = Math.max(t.y[i - 1] - mg, Math.min(t.y[i - 1] + mg, t.y[i]));
      for (let i = n - 2; i >= 0; i--) t.y[i] = Math.max(t.y[i + 1] - mg, Math.min(t.y[i + 1] + mg, t.y[i]));
    }
  }
  // ledge üstü yuva düzlükleri: kot = altındaki patika yatağının kotu (sırtın medyanı patikadan metrelerce yüksek çıkıyordu → patikada tümsek)
  const o = {};
  for (const p of PADS) {
    if (!p.name.startsWith('yuva-')) continue;
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    let best = null;
    for (const t of TRAILS) { const q = t.near(cx, cz, o); if (q && (!best || q.d < best[0])) best = [q.d, q.y]; }
    if (best) p.y = Math.round(best[1] * 20) / 20;
  }
}

export function vadiHeight(x, z) {
  finalizeLayout();
  let h = preH(x, z);
  h = saddleH(x, z, h);
  h = trailsH(x, z, h, TRAILS.length, (vadiHeight._o ||= {}));
  h = riverH(x, z, h);
  h = padsH(x, z, h);
  h = Math.max(h, BED_Y);
  if (Math.abs(h - WATER_LEVEL) < 0.05) h = WATER_LEVEL + (h < WATER_LEVEL ? -0.05 : 0.05);    // kıyı: arazi su düzlemiyle eş düzlem kalmasın
  return h;
}
export { segDist };
