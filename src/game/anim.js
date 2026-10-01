// Ortak animasyon eğrileri (birinci şahıs ViewModel + üçüncü şahıs karakter aynı eğrileri kullanır).
// Tamamen saf fonksiyonlar: zamanı 0..1 ilerleme (k) olarak alır.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOut = (t) => 1 - (1 - clamp01(t)) ** 3;
export const easeIn = (t) => clamp01(t) ** 2;
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const seg = (k, a, b) => clamp01((k - a) / (b - a));

// ───────────── Yeniden doldurma ─────────────
// style: mag | bolt | shell · k: 0..1 · empty: şarjör boş muydu (kol şarjı çekilir)
// Dönüş:
//  tilt     silahın yana/öne yatması (0..1)
//  magOut   şarjörün dışarı çıkma miktarı (0 = yerinde, 1 = tamamen dışarıda)
//  magVis   şarjör görünür mü
//  slap     şarjör vuruş darbesi (kısa titreşim)
//  charge   kol şarjı çekme (0..1..0)
//  bolt     sürgü açıklığı (0..1)
//  w        sol elin ağırlıkları { fg: ön kabza, mag: şarjör, pouch: kemer/yelek, charge: kol }
export function reloadAnim(style, k, empty = true, ph = 0) {
  const r = { tilt: 0, magOut: 0, magVis: true, slap: 0, charge: 0, bolt: 0, w: { fg: 1, mag: 0, pouch: 0, charge: 0 }, lift: 0 };
  if (style === 'shell') {
    // mermi başına döngü: elin kemerden alıp yuvaya sokması
    const tilt = smooth(seg(k, 0, 0.08)) * (1 - smooth(seg(k, 0.94, 1)));
    r.tilt = tilt * 0.9;
    const c = ph;                                   // 0..1 mermi döngüsü
    const toPort = smooth(seg(c, 0.0, 0.5));
    const back = smooth(seg(c, 0.6, 1.0));
    const atPort = toPort * (1 - back);
    r.w = { fg: 1 - tilt, mag: atPort * tilt, pouch: (1 - atPort) * tilt, charge: 0 };
    r.slap = Math.max(0, 1 - Math.abs(c - 0.55) * 14) * tilt;
    return r;
  }
  const t = smooth(seg(k, 0, 0.1)) * (1 - smooth(seg(k, 0.8, 1)));
  r.tilt = t;
  r.lift = t;
  const toMag = smooth(seg(k, 0, 0.1));
  const toPouch = smooth(seg(k, 0.26, 0.38));
  const fromPouch = smooth(seg(k, 0.38, 0.5));
  const toFg = smooth(seg(k, empty ? 0.84 : 0.62, empty ? 0.98 : 0.8));
  const toCharge = empty ? smooth(seg(k, 0.6, 0.68)) * (1 - smooth(seg(k, 0.76, 0.84))) : 0;
  let mag = toMag * (1 - toPouch * (1 - fromPouch)) * (1 - toFg) * (1 - toCharge);
  let pouch = toPouch * (1 - fromPouch) * (1 - toFg);
  const fg = Math.max(0, 1 - mag - pouch - toCharge);
  r.w = { fg, mag, pouch, charge: toCharge };
  // şarjör: 0.10–0.26 çıkar, 0.26–0.40 yok, 0.40 geri görünür, 0.50–0.60 takılır
  if (k < 0.1) { r.magOut = 0; r.magVis = true; }
  else if (k < 0.26) { r.magOut = easeIn(seg(k, 0.1, 0.26)); r.magVis = true; }
  else if (k < 0.4) { r.magOut = 1; r.magVis = false; }
  else if (k < 0.5) { r.magOut = 1; r.magVis = true; }
  else { r.magOut = 1 - easeOut(seg(k, 0.5, 0.6)); r.magVis = true; }
  r.slap = Math.max(0, 1 - Math.abs(k - 0.6) * 18);
  if (empty) r.charge = Math.sin(Math.PI * seg(k, 0.62, 0.82));
  if (style === 'bolt') r.bolt = Math.sin(Math.PI * seg(k, 0.62, 0.86)) ** 0.6;
  return r;
}

// ───────────── Yakın dövüş ─────────────
// Silah ucu/ağırlık merkezi için ofsetler (x,y,z metre; rx,ry,rz radyan; body: gövde burulması)
// ry > 0: uç sola döner · rx > 0: uç yukarı kalkar · rz: yan yatış (eğik kesik)
const P = (x, y, z, rx, ry, rz, body = 0) => ({ x, y, z, rx, ry, rz, body });
const SWINGS = {
  rl: { W: P(0.2, 0.04, 0.12, 0.3, -0.95, -0.75, -0.5), S: P(-0.26, -0.05, -0.1, -0.15, 1.0, 0.6, 0.6) },
  lr: { W: P(-0.2, 0.04, 0.12, 0.3, 0.95, 0.75, 0.5), S: P(0.26, -0.05, -0.1, -0.15, -1.0, -0.6, -0.6) },
  stab: { W: P(0.04, -0.03, 0.2, 0.15, -0.2, 0.2, -0.2), S: P(-0.03, 0.0, -0.4, -0.1, 0.0, 0.0, 0.25) },
  chop: { W: P(0.05, 0.2, 0.1, 1.15, -0.1, 0, -0.2), S: P(-0.04, -0.14, -0.24, -0.85, 0.1, 0.1, 0.3) },
  diag: { W: P(0.24, 0.18, 0.1, 0.8, -0.75, -0.95, -0.55), S: P(-0.24, -0.18, -0.16, -0.55, 0.85, 0.85, 0.55) },
};
export const SWING_HIT_K = 0.44;
const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, rx: a.rx + (b.rx - a.rx) * t, ry: a.ry + (b.ry - a.ry) * t, rz: a.rz + (b.rz - a.rz) * t, body: a.body + (b.body - a.body) * t });
const ZERO = P(0, 0, 0, 0, 0, 0, 0);

export function meleePose(kind, k) {
  const sw = SWINGS[kind] || SWINGS.rl;
  if (k < 0.24) return lerpP(ZERO, sw.W, easeOut(k / 0.24));
  if (k < 0.5) { const u = seg(k, 0.24, 0.5); return lerpP(sw.W, sw.S, easeIn(u) * 0.55 + u * 0.45); }
  if (k < 0.58) return sw.S;
  return lerpP(sw.S, ZERO, easeOut(seg(k, 0.58, 1)));
}
