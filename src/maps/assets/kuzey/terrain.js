import * as THREE from 'three';
import { KZ_BOUNDS, KZ_CELL, KZ_DEEP, RIVER, LAKE, FORDS, ROADS, ROAD_W, PADS, BRIDGES, DAM, FIELDS, FOREST_ZONES } from './layout.js';

// Kuzey Vadisi arazisi (12.172): 2 m düzenli yükseklik ızgarası (801 × 801 köşe), sunucu + istemci aynı.
// - heightAt: hücrede köşegen a–d (i,j)–(i+1,j+1) ile iki düz üçgen; görsel L0 ağı aynı üçgenleri çizer → yakında görünen = çarpışma.
// - raycast: 16 m karo başına en yüksek kot (tmax) ile boş karoları atlar (uzun nişancı / bot görüş ışınları 1 km'de bile ucuz).
// - surf: köşe başına yüzey sınıfı (çimen / orman tabanı / tarla / toprak yol / asfalt / çakıl / kaya / kum / dere tabanı / kar / beton) → görsel + mini harita.
// Üretim sırası: taban (vadi + tepeler + kenar dağları + kanyon) → alanlar (PADS) → yollar (eğim sınırlı yatak, nehirde köprü / geçit) → nehir yatağı.
// Harita dışı (uzak manzara) aynı taban fonksiyonundan örneklenir (outerHeight): kenarda dikiş yok.

export const SURF = { GRASS: 0, FOREST: 1, WHEAT: 2, PLOW: 3, DIRT: 4, ASPHALT: 5, GRAVEL: 6, ROCK: 7, SAND: 8, BED: 9, SNOW: 10, CONC: 11, MEADOW: 12 };

// ── gürültü (deterministik, sunucu = istemci) ──
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, seed = 1, oct = 4) {
  let amp = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f, seed + i * 17) * amp; n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}
// sırt gürültüsü (keskin tepeler): 1 − |2n − 1|
function ridged(x, z, seed, oct = 4) {
  let amp = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(2 * vnoise(x * f, z * f, seed + i * 31) - 1); s += v * v * amp; n += amp; amp *= 0.5; f *= 2.1; }
  return s / n;
}
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Çoklu çizgiye uzaklık + eksen üzerindeki yarı genişlik (doğrusal ara değer). out: { d, w, i, t }
function polyDist(P, x, z, out) {
  let bd = 1e18, bw = 0, bi = 0, bt = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = a[0] + dx * t - x, qz = a[1] + dz * t - z, d = qx * qx + qz * qz;
    if (d < bd) { bd = d; bw = a[2] + (b[2] - a[2]) * t; bi = i; bt = t; }
  }
  out.d = Math.sqrt(bd); out.w = bw; out.i = bi; out.t = bt;
  return out;
}
const _r = { d: 0, w: 0, i: 0, t: 0 }, _l = { d: 0, w: 0, i: 0, t: 0 };

// Taban kot (yollar / alanlar hariç): her yerde tanımlı (harita dışı da)
export function baseHeight(x, z) {
  polyDist(RIVER, x, z, _r);
  const dR = _r.d, ax = Math.abs(x), az = Math.abs(z);
  // vadi tabanı: nehirden uzaklaştıkça yavaş yükselir
  let h = 2.4 + 0.016 * Math.max(0, dR - 40) + 0.00002 * Math.max(0, dR - 40) ** 2;
  // yuvarlak tepeler (nehre yakın sönük)
  const away = sst(50, 260, dR);
  h += (fbm(x / 430 + 3.1, z / 430 - 7.7, 11, 4) - 0.46) * 62 * away;
  h += (fbm(x / 140, z / 140, 23, 3) - 0.5) * 11 * sst(30, 140, dR);
  h += (fbm(x / 38, z / 38, 37, 2) - 0.5) * 1.6 * sst(25, 60, dR);
  // 12.172 arazi kıvrımları: 40–70 m'lik 2–4 m'lik tümsek / çukurlar + sırt çizgileri → açık çayırda uzun görüş hatları kırılır (çömelen saklanır)
  h += ((fbm(x / 52 + 11, z / 52 - 5, 41, 3) - 0.5) * 5.2 + (ridged(x / 130 - 3, z / 130 + 8, 43, 2) - 0.35) * 3.2) * sst(35, 140, dR);
  // yumuşak taban: tepe gürültüsü vadi tabanının altına inip nehirden kopuk çukur göl / kuru havuz yapmasın (nehir yatağı sonra ayrıca oyulur)
  { const lo = 2.0 + 0.004 * Math.max(0, dR - 40), k = 1.4; if (h - lo < 12) h = lo + Math.log1p(Math.exp(k * (h - lo))) / k; }
  // Radar Tepesi: geniş tümsek (tepe düzlüğü PADS'ta)
  const ra = Math.hypot(x + 560, z - 120);
  h += 46 * Math.exp(-(ra * ra) / (175 * 175)) + 10 * Math.exp(-(ra * ra) / (70 * 70));
  // kenar dağları: oynanır alanın kenarında başlar, dışarıda yüzlerce metreye çıkar (nehir vadisi batıda / göl doğuda açık kalır)
  const edge = Math.max(ax - 600, az - 600, 0);
  if (edge > 0) {
    const open = sst(90, 520, dR) * (x > 640 ? sst(70, 260, polyDist(LAKE, x, z, _l).d) : 1);
    const r = ridged(x / 900 + 1.7, z / 900 - 2.3, 51, 5), big = fbm(x / 2600, z / 2600, 61, 3);
    h += open * (edge * 0.13 + 1000 * sst(0, 2800, edge) ** 1.4 * (0.4 + 0.95 * r) * (0.55 + big));
  }
  // doğu kanyonu (baraj): x > 610'da nehrin iki yanı dik kaya duvarı
  if (x > 600) {
    const g = sst(600, 690, x), w = x > 704 ? polyDist(LAKE, x, z, _l).w : 26;
    h += g * (23 + 9 * fbm(x / 60, z / 60, 71, 2)) * sst(w * 0.95, w + 20, x > 704 ? _l.d : dR);
  }
  return h;
}

// nehir / göl yatağı profili (bankalar yerel kota karışır); yoksa null
function riverBed(x, z, h, d = -1, w = 0) {
  if (x > 704) {
    polyDist(LAKE, x, z, _l);
    if (_l.d > _l.w + 30) return h;
    return Math.min(h, mix(-7, h, sst(_l.w * 0.6, _l.w + 30, _l.d)));         // göl: derin (görünen yüzey KZ_LAKE, kıyısı kanyon duvarı)
  }
  if (d < 0) { polyDist(RIVER, x, z, _r); d = _r.d; w = _r.w; }
  if (d > w + 16) return h;
  let bed = -3.1;
  for (const f of FORDS) { const fd = Math.hypot(x - f.x, z - f.z); if (fd < f.r + 18) bed = mix(-0.34, bed, sst(f.r, f.r + 18, fd)); }
  return Math.min(h, mix(bed, h, sst(w * 0.52, w + 16, d)));
}

export class KuzeyTerrain {
  constructor({ visual = true } = {}) {
    const B = KZ_BOUNDS, c = KZ_CELL;
    this.minX = B.minX; this.minZ = B.minZ; this.cell = c;
    this.nx = Math.round((B.maxX - B.minX) / c) + 1; this.nz = Math.round((B.maxZ - B.minZ) / c) + 1;
    this.maxX = B.minX + (this.nx - 1) * c; this.maxZ = B.minZ + (this.nz - 1) * c;
    this.deepWater = KZ_DEEP;
    const N = this.nx * this.nz, h = (this.h = new Float32Array(N));
    this.surf = new Uint8Array(N);
    this.road = new Uint8Array(N);                    // 0 yok · 1 asfalt · 2 toprak · 3 banket (çakıl) — ağaç süzgeci + mini harita (sunucu = istemci)
    if (visual) { this.redge = new Int8Array(N).fill(127); this.rtype = new Uint8Array(N); }   // görsel: yol kenarına işaretli uzaklık (1/32 m, ±4 m) + tür (1 asfalt · 2 toprak · 3 ana yol)
    const t0 = Date.now();
    // 1) taban
    const rd = new Float32Array(N), rw = new Float32Array(N);                // nehir uzaklığı / yarı genişliği (taban geçişinde bir kez)
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) { const k = j * this.nx + i; h[k] = baseHeight(B.minX + i * c, B.minZ + j * c); rd[k] = _r.d; rw[k] = _r.w; }
    this.tBase = Date.now() - t0;
    // 2) düzleştirilen alanlar
    this.pads = PADS.map((p) => ({ ...p, y: p.y ?? +this.sampleBase(p.x, p.z).toFixed(2) }));
    this.tPad0 = Date.now() - t0;
    for (const p of this.pads) this._pad(p);
    // 3) yollar
    this.roads = ROADS.map((r) => this._road(r));
    // 4) nehir yatağı
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) { const k = j * this.nx + i; if (rd[k] < rw[k] + 16 || B.minX + i * c > 704) h[k] = riverBed(B.minX + i * c, B.minZ + j * c, h[k], rd[k], rw[k]); }
    this._h0 = null; this._rdist = null;
    this.tRoad = Date.now() - t0;
    // 5) yüzey sınıfı (yalnız görsel / mini harita: sunucuda kurulmaz)
    if (visual) this._surface();
    // 6) ışın hızlandırma: 16 m karo başına en yüksek kot
    this._tiles();
    this.tBuild = Date.now() - t0;
  }
  sampleBase(x, z) { return this.vh(Math.round((x - this.minX) / this.cell), Math.round((z - this.minZ) / this.cell)); }
  vh(i, j) { return this.h[Math.max(0, Math.min(this.nz - 1, j)) * this.nx + Math.max(0, Math.min(this.nx - 1, i))]; }

  _pad(p) {
    const c = this.cell, rx = p.r ? p.r : p.w / 2, rz = p.r ? p.r : p.d / 2, F = p.fall;
    const i0 = Math.max(0, Math.floor((p.x - rx - F - this.minX) / c)), i1 = Math.min(this.nx - 1, Math.ceil((p.x + rx + F - this.minX) / c));
    const j0 = Math.max(0, Math.floor((p.z - rz - F - this.minZ) / c)), j1 = Math.min(this.nz - 1, Math.ceil((p.z + rz + F - this.minZ) / c));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = this.minX + i * c, z = this.minZ + j * c;
      const od = p.r ? Math.max(0, Math.hypot(x - p.x, z - p.z) - p.r) : Math.hypot(Math.max(0, Math.abs(x - p.x) - rx), Math.max(0, Math.abs(z - p.z) - rz));
      const w = (1 - sst(0, F, od)) * p.k, k = j * this.nx + i;
      if (w > 0) this.h[k] = mix(this.h[k], p.y, w);
    }
  }

  // Yol: Chaikin yumuşatma → 2 m örnek → yatak kotu (ortalama + eğim sınırı; köprü ucunda tabliye kotu, geçitte nehir tabanı) → ızgaraya bas
  _road(r) {
    const W = ROAD_W[r.t], hw = W / 2, fall = r.t === 'hw' ? 11 : r.t === 'rd' ? 8.5 : r.t === 'lane' ? 3 : 5.5, grade = r.t === 'dirt' || r.t === 'lane' ? 0.18 : 0.12;     // geniş şev: yol yamacı uçurum gibi yarmasın
    let p = r.pts.map((q) => [q[0], q[1]]);
    for (let it = 0; it < 3 && p.length > 2; it++) {
      const o = [p[0]];
      for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
      o.push(p[p.length - 1]); p = o;
    }
    const s = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 2));
      for (let k = 1; k <= n; k++) s.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    // nehre yakınlık: köprü / geçit
    const inRiver = s.map(([x, z]) => { polyDist(RIVER, x, z, _r); return _r.d < _r.w + 16; });
    const bridgeY = (x, z) => { for (const b of BRIDGES) if (Math.hypot(x - b.x, z - b.z) < 90) return b.deck; if (Math.hypot(x - DAM.x, z - DAM.z) < 110) return DAM.crest; return null; };
    let y = s.map(([x, z], i) => {
      if (inRiver[i]) { const by = bridgeY(x, z); return by ?? (r.ford ? -0.34 : this.heightAt(x, z)); }
      const by = bridgeY(x, z);
      if (by != null && (Math.hypot(x - DAM.x, z - DAM.z) < 92)) return by;       // baraj ucu: tepe kotunda
      return this.heightAt(x, z);
    });
    // köprü ucu düzlüğü: nehir bölgesinin 9 m dışına kadar tabliye kotunda (rampa bundan sonra; tabliye – yol arasında basamak kalmaz)
    const nearBr = s.map(([x, z]) => { polyDist(RIVER, x, z, _r); const bb = BRIDGES.find((b) => Math.hypot(x - b.x, z - b.z) < 90); return bb && _r.d < _r.w + 25 ? bb.deck : null; });
    for (let i = 0; i < y.length; i++) if (nearBr[i] != null) y[i] = nearBr[i];
    const fixed = s.map(([x, z], i) => inRiver[i] || nearBr[i] != null || Math.hypot(x - DAM.x, z - DAM.z) < 92);
    for (let pass = 0; pass < 3; pass++) {
      const o = y.slice();
      for (let i = 1; i < y.length - 1; i++) { if (fixed[i]) continue; let a = 0, n = 0; for (let k = -9; k <= 9; k++) { const j = i + k; if (j < 0 || j >= y.length) continue; a += y[j]; n++; } o[i] = a / n; }
      y = o;
    }
    const mg = grade * 2;
    for (let it = 0; it < 2; it++) {
      for (let i = 1; i < y.length; i++) if (!fixed[i]) y[i] = Math.max(y[i - 1] - mg, Math.min(y[i - 1] + mg, y[i]));
      for (let i = y.length - 2; i >= 0; i--) if (!fixed[i]) y[i] = Math.max(y[i + 1] - mg, Math.min(y[i + 1] + mg, y[i]));
    }
    // bas: hücre başına en yakın yol ekseni
    const c = this.cell, R = hw + fall, dist = (this._rdist ||= new Float32Array(this.nx * this.nz).fill(1e9));
    const out = { id: r.id, t: r.t, w: W, pts: s.map((q, i) => [+q[0].toFixed(2), +q[1].toFixed(2), +y[i].toFixed(2)]) };
    for (let i = 0; i < s.length - 1; i++) {
      const cut = (inRiver[i] || inRiver[i + 1]) && !r.ford;                       // köprü açıklığı: nehir kalır; yalnız tabliyeden yüksek doğal kıyı tabliye kotuna yarılır
      if (cut && bridgeY(s[i][0], s[i][1]) == null) continue;
      const a = s[i], b = s[i + 1];
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R - this.minX) / c)), i1 = Math.min(this.nx - 1, Math.ceil((Math.max(a[0], b[0]) + R - this.minX) / c));
      const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - R - this.minZ) / c)), j1 = Math.min(this.nz - 1, Math.ceil((Math.max(a[1], b[1]) + R - this.minZ) / c));
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
      for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
        const x = this.minX + ii * c, z = this.minZ + jj * c;
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z), k = jj * this.nx + ii;
        if (d > R || d >= dist[k]) continue;
        dist[k] = d;
        const by = y[i] + (y[i + 1] - y[i]) * t;
        if (!this._h0) this._h0 = this.h.slice();                                     // yol öncesi kot (yan yamaç karışımı için)
        const w = 1 - sst(hw + 0.6, R, d);
        if (cut) { this.h[k] = this._h0[k] > by ? mix(this._h0[k], by, w) : this._h0[k]; continue; }
        this.h[k] = mix(this._h0[k], by, w);
        this.road[k] = d <= hw ? (r.t === 'dirt' || r.t === 'lane' ? 2 : 1) : d <= hw + 1.1 && r.t !== 'lane' ? 3 : this.road[k];
        if (this.redge) { this.redge[k] = Math.max(-127, Math.min(127, Math.round((d - hw) * 32))); this.rtype[k] = r.t === 'dirt' ? 2 : r.t === 'hw' ? 3 : r.t === 'lane' ? 4 : 1; }
      }
    }
    return out;
  }

  _surface() {
    const { nx, nz, cell: c, h, surf, road } = this;
    const inField = (x, z) => { for (const f of FIELDS) if (Math.abs(x - f[0]) < f[2] / 2 && Math.abs(z - f[1]) < f[3] / 2) return f[4]; return null; };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = this.minX + i * c, z = this.minZ + j * c, y = h[k];
      const sl = Math.hypot(this.vh(i + 1, j) - this.vh(i - 1, j), this.vh(i, j + 1) - this.vh(i, j - 1)) / (2 * c);
      let s = SURF.GRASS;
      if (y < -0.25) s = SURF.BED;
      else if (y < 0.9) s = SURF.SAND;
      else if (road[k] === 1) s = SURF.ASPHALT;
      else if (road[k] === 2) s = SURF.DIRT;
      else if (road[k] === 3) s = SURF.GRAVEL;
      else if (sl > 0.62) s = SURF.ROCK;
      else {
        const f = inField(x, z);
        if (f) s = f === 'wheat' ? SURF.WHEAT : f === 'plow' ? SURF.PLOW : SURF.MEADOW;
        else if (forestDensity(x, z) > 0.35) s = SURF.FOREST;
        else if (fbm(x / 90, z / 90, 81, 2) > 0.6) s = SURF.MEADOW;
      }
      surf[k] = s;
    }
  }
  _tiles() {
    const T = (this.tileN = 8), tw = (this.tw = Math.ceil((this.nx - 1) / T)), th = (this.th = Math.ceil((this.nz - 1) / T));
    const m = (this.tmax = new Float32Array(tw * th).fill(-1e9));
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const v = this.h[j * this.nx + i];
      for (const tj of [Math.floor(j / T), Math.floor((j - 1) / T)]) for (const ti of [Math.floor(i / T), Math.floor((i - 1) / T)]) {
        if (ti < 0 || tj < 0 || ti >= tw || tj >= th) continue;
        const q = tj * tw + ti; if (v > m[q]) m[q] = v;
      }
    }
    this.top = this.h.reduce((a, v) => Math.max(a, v), -1e9);
  }

  heightAt(x, z) {
    let fx = (x - this.minX) / this.cell, fz = (z - this.minZ) / this.cell;
    fx = fx < 0 ? 0 : fx > this.nx - 1.0001 ? this.nx - 1.0001 : fx; fz = fz < 0 ? 0 : fz > this.nz - 1.0001 ? this.nz - 1.0001 : fz;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, nx = this.nx, H = this.h, k = j * nx + i;
    const a = H[k], b = H[k + 1], cc = H[k + nx], d = H[k + nx + 1];
    return u >= v ? a + (b - a) * u + (d - b) * v : a + (d - cc) * u + (cc - a) * v;       // köşegen a–d (görsel ağla aynı)
  }
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.5, dx = this.heightAt(x + e, z) - this.heightAt(x - e, z), dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-dx, 2 * e, -dz).normalize();
  }
  slopeAt(x, z, e = 0.5) {
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e), dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }
  // derin su: havadan (zıplayarak) girilmez; World.move her yatay adımda sorar (yerde yürüyerek giriş zaten engelli)
  // köprü / baraj tabliyesinin üstü serbest (decks: [x0, x1, z0, z1], kurulumda yazılır)
  wallAt(x, z, y) {
    const h = this.heightAt(x, z);
    if (!(h < this.deepWater && y > h + 0.001)) return false;
    for (const d of this.decks || []) if (x > d[0] && x < d[1] && z > d[2] && z < d[3]) return false;
    return true;
  }
  surfAt(x, z) { return this.surf[Math.max(0, Math.min(this.nz - 1, Math.round((z - this.minZ) / this.cell))) * this.nx + Math.max(0, Math.min(this.nx - 1, Math.round((x - this.minX) / this.cell)))]; }
  roadAt(x, z) { return this.road[Math.max(0, Math.min(this.nz - 1, Math.round((z - this.minZ) / this.cell))) * this.nx + Math.max(0, Math.min(this.nx - 1, Math.round((x - this.minX) / this.cell)))]; }

  // Işın - arazi. Karo atlama: ışının karo içindeki en alçak kotu karonun en yükseğinden yüksekse karo bütünüyle geçilir; değilse 0,5 m adım + ikili arama.
  raycast(o, d, maxT, out) {
    let f0 = o.y - this.heightAt(o.x, o.z);
    if (f0 < 0) return null;
    const TS = this.tileN * this.cell, step = 0.5;
    let t = 0, tPrev = 0;
    while (t < maxT) {
      const x = o.x + d.x * t, z = o.z + d.z * t, y = o.y + d.y * t;
      if (y > this.top + 0.05 && d.y >= 0) return null;
      if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ) return null;
      // bu karonun sınırına kadar olan uzaklık
      const ti = Math.min(this.tw - 1, Math.floor((x - this.minX) / TS)), tj = Math.min(this.th - 1, Math.floor((z - this.minZ) / TS));
      const tx0 = this.minX + ti * TS, tz0 = this.minZ + tj * TS;
      const ex = d.x > 1e-9 ? (tx0 + TS - x) / d.x : d.x < -1e-9 ? (tx0 - x) / d.x : 1e9;
      const ez = d.z > 1e-9 ? (tz0 + TS - z) / d.z : d.z < -1e-9 ? (tz0 - z) / d.z : 1e9;
      const tExit = Math.min(maxT, t + Math.max(1e-3, Math.min(ex, ez)) + 1e-3);
      const yLow = Math.min(y, o.y + d.y * tExit);
      if (yLow > this.tmax[tj * this.tw + ti] + 0.02) { tPrev = t; t = tExit; continue; }
      // karo içinde ince adım
      let tt = t;
      while (tt < tExit) {
        const tn = Math.min(tExit, tt + step);
        const f = o.y + d.y * tn - this.heightAt(o.x + d.x * tn, o.z + d.z * tn);
        if (f < 0) {
          let lo = tt, hi = tn;
          for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; if (o.y + d.y * mid - this.heightAt(o.x + d.x * mid, o.z + d.z * mid) < 0) hi = mid; else lo = mid; }
          out.t = hi;
          out.point = (out.point || new THREE.Vector3()).set(o.x + d.x * hi, o.y + d.y * hi, o.z + d.z * hi);
          out.normal = this.normalAt(out.point.x, out.point.z, out.normal || new THREE.Vector3());
          return out;
        }
        tt = tn;
      }
      tPrev = t; t = tExit;
    }
    return null;
  }
}

// orman yoğunluğu (0..1): bölgeler + gürültü, yol / alan / tarla / nehir kenarında yok
export function forestDensity(x, z) {
  let d = 0;
  const wob = 0.62 + 0.62 * fbm(x / 95 + 7, z / 95 - 3, 93, 3);                                 // kenar dalgalı (daire gibi durmasın)
  for (const f of FOREST_ZONES) { const r = Math.hypot(x - f.x, z - f.z) / wob; if (r < f.r) d = Math.max(d, f.dens * (1 - sst(f.r * 0.45, f.r, r))); }
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax > 640 || az > 640) d = Math.max(d, 0.75 * sst(640, 760, Math.max(ax, az)));          // kenar dağları ormanlık
  d *= 0.55 + 0.9 * fbm(x / 120, z / 120, 91, 3);
  return Math.min(1, d);
}

// Harita dışı kot (uzak manzara ağı): taban + nehir / göl yatağı
export function outerHeight(x, z) { return riverBed(x, z, baseHeight(x, z)); }
