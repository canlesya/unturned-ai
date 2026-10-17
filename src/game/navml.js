import * as THREE from 'three';
import { NavGrid, Heap } from './nav.js';
import { DEEP_WATER } from '../maps/terrain.js';

// Çok katlı yürüme ızgarası (Boya Kulesi): aynı hücrede üst üste birden çok yürünebilir zemin (zemin + kale tabliyesi, kule alt katı + balkon + tepe).
// NavGrid tek kat tutar (hücre başına en yüksek 'plat'); burada hücre başına en çok K kat: düğüm = hücre × K + kat. Yol bulma katlar arasında yalnız
// |Δzemin| ≤ maxStep komşulara geçer (basamak / rampa). Eski API korunur (isFree, nearestFree, blocked, floor = hücrenin en üst serbest katı) — diğer
// haritalar bu sınıfı kullanmaz (map.navLayers). Ek: findPath(…, sy, gy) başlangıç / hedef katını y'ye göre seçer; safeAt(x, y, z) botun önü boşluk mu.
const CELL = 0.5, INFL = 0.35, K = 3, HEAD = 1.6, STEP = 0.5;

export class NavGridML extends NavGrid {
  constructor(colliders, bounds, terrain = null) {
    super(colliders, bounds, terrain, true);
    const W = this.w, H = this.h, N = W * H;
    this.K = K;
    this.lf = new Float32Array(N * K).fill(NaN);              // kat zemini (y)
    this.lb = new Uint8Array(N * K).fill(1);                  // kat kapalı mı
    const cellRange = (lo, hi, min, n) => [Math.max(0, Math.ceil((lo - min) / CELL - 0.5)), Math.min(n - 1, Math.floor((hi - min) / CELL - 0.5))];
    const lists = Array.from({ length: N }, () => []);
    const deep = terrain ? (terrain.navMin ?? terrain.deepWater ?? DEEP_WATER) : -1e9;          // navMin: bunun altı yürünmez sayılır (Boya Kulesi kuyusu; fizikte su yok)
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const wx = this.minX + (x + 0.5) * CELL, wz = this.minZ + (z + 0.5) * CELL, i = z * W + x;
      const g = terrain ? terrain.heightAt(wx, wz) : 0;
      if (g >= deep + 0.05 && !(terrain && terrain.slopeAt(wx, wz, 0.6) > 0.95)) lists[i].push(g);
    }
    const plats = colliders.filter((c) => c.tag === 'plat');
    const pax = Array.from({ length: N }, () => []);                // hücredeki zeminin basamak ekseni: 1 = x boyunca dar (basamak x yönünde çıkar), 2 = z, 0 = düz
    for (const c of plats) {
      const dx = c.max[0] - c.min[0], dz = c.max[2] - c.min[2], ax = Math.min(dx, dz) <= 0.6 && Math.max(dx, dz) >= 1.0 ? (dx < dz ? 1 : 2) : 0;
      let [x0, x1] = cellRange(c.min[0] - 0.01, c.max[0] + 0.01, this.minX, W);           // bitişik basamaklar arasında hücre merkezi kenara denk gelirse boşluk kalmasın
      let [z0, z1] = cellRange(c.min[2] - 0.01, c.max[2] + 0.01, this.minZ, H);
      if (x0 > x1) x0 = x1 = Math.max(0, Math.min(W - 1, Math.floor(((c.min[0] + c.max[0]) / 2 - this.minX) / CELL)));
      if (z0 > z1) z0 = z1 = Math.max(0, Math.min(H - 1, Math.floor(((c.min[2] + c.max[2]) / 2 - this.minZ) / CELL)));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { lists[z * W + x].push(c.max[1]); pax[z * W + x].push([c.max[1], ax]); }
    }
    this.sax = new Uint8Array(N * K);
    for (let i = 0; i < N; i++) {                              // sırala, birbirine 0,2 m'den yakın zeminleri birleştir, üstünde baş boşluğu olmayanı at
      const a = lists[i].sort((p, q) => p - q), o = [];
      for (const f of a) { if (o.length && f - o[o.length - 1] < 0.2) o[o.length - 1] = f; else o.push(f); }
      const keep = o.filter((f, k) => k === o.length - 1 || o[k + 1] - f > HEAD + 0.25).slice(-K);
      keep.forEach((f, k) => { this.lf[i * K + k] = f; this.lb[i * K + k] = 0; const q = pax[i].find((e) => Math.abs(e[0] - f) < 0.01); this.sax[i * K + k] = q ? q[1] : 0; });
    }
    for (const c of colliders) {                               // engeller kat yüksekliğine göre (plat kutusunun kendi gövdesi de alttaki katı kapatır)
      if (c.tag === 'deck') continue;
      const pl = c.tag === 'plat', inf = pl ? 0.02 : -INFL;
      const [x0, x1] = cellRange(c.min[0] + inf, c.max[0] - inf, this.minX, W);
      const [z0, z1] = cellRange(c.min[2] + inf, c.max[2] - inf, this.minZ, H);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const i = z * W + x;
        for (let k = 0; k < K; k++) {
          const n = i * K + k, f = this.lf[n];
          if (Number.isNaN(f) || this.lb[n]) continue;
          if (pl && Math.abs(c.max[1] - f) < 0.21) continue;     // bu katın kendi zemini
          if (c.min[1] - f > HEAD || c.max[1] - f < 0.45) continue;
          this.lb[n] = 1;
        }
      }
    }
    for (let x = 0; x < W; x++) for (const z of [0, H - 1]) for (let k = 0; k < K; k++) this.lb[(z * W + x) * K + k] = 1;
    for (let z = 0; z < H; z++) for (const x of [0, W - 1]) for (let k = 0; k < K; k++) this.lb[(z * W + x) * K + k] = 1;
    for (let i = 0; i < N; i++) {                              // eski API: hücre = en üst serbest kat
      let top = -1;
      for (let k = 0; k < K; k++) if (!this.lb[i * K + k]) top = k;
      this.blocked[i] = top < 0 ? 1 : 0;
      this.floor[i] = top < 0 ? (Number.isNaN(this.lf[i * K]) ? -99 : this.lf[i * K]) : this.lf[i * K + top];
    }
    this.gN = new Float32Array(N * K); this.fromN = new Int32Array(N * K); this.markN = new Uint32Array(N * K); this.closedN = new Uint32Array(N * K);
  }

  // hücrede y'ye en yakın serbest kat (tol içinde; tol yoksa sınırsız) → düğüm ya da −1
  nodeAt(i, y, tol = 1e9) {
    let best = -1, bd = tol;
    for (let k = 0; k < K; k++) { const n = i * K + k; if (this.lb[n]) continue; const d = Math.abs(this.lf[n] - y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  // (x, z)'ye en yakın hücrede, y'ye en yakın serbest kat. y verilmezse en alt kat
  nearestNode(x, z, y, maxR = 12) {
    const W = this.w, cx = Math.floor((x - this.minX) / CELL), cz = Math.floor((z - this.minZ) / CELL);
    const yy = Number.isFinite(y) ? y : -1e9;
    let best = -1, bs = 1e9;
    for (let r = 0; r <= maxR / CELL; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const X = cx + dx, Z = cz + dz;
        if (X < 0 || Z < 0 || X >= W || Z >= this.h) continue;
        const n = this.nodeAt(Z * W + X, yy);
        if (n < 0) continue;
        const sc = r * CELL + Math.abs(this.lf[n] - yy) * 1.5;      // kat farkı mesafeden pahalı: önce aynı kattaki yakın nokta
        if (sc < bs) { bs = sc; best = n; }
      }
      if (best >= 0 && bs <= (r + 1) * CELL) break;
    }
    return best;
  }
  // bot önündeki nokta yürünebilir mi (aynı kat ya da ≤ 1 m iniş / basamak): boşluğa, kuyuya, kat kenarından aşağı adım atmasın
  safeAt(x, y, z) {
    const cx = Math.floor((x - this.minX) / CELL), cz = Math.floor((z - this.minZ) / CELL);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return false;
    const i = cz * this.w + cx;
    for (let k = 0; k < K; k++) { const n = i * K + k; if (!this.lb[n] && this.lf[n] > y - 1.0 && this.lf[n] < y + 0.75) return true; }
    for (let k = 0; k < K; k++) { const n = i * K + k; if (this.lb[n] && !Number.isNaN(this.lf[n]) && this.lf[n] > y - 1.0 && this.lf[n] < y + 0.75) return true; }   // engel hücresi (duvar dibi): yürüme fiziği zaten durdurur
    return false;
  }
  // komşu hücre j'de, n düğümünden geçilebilen kat. Kat değişimi (> 0,2 m) yalnız basamağın çıkış ekseninde: yandan basamağa girilmez
  // (oyuncu kutusu 0,64 m > basamak 0,5 m: yandan girince bir sonraki basamağa da değip takılır), çaprazdan da girilmez
  _step(n, j, ms) {
    const f = this.lf[n], W = this.w, i = (n / K) | 0, ddx = (j % W) - (i % W), ddz = ((j / W) | 0) - ((i / W) | 0);
    let best = -1, bd = ms + 1e-6;
    for (let k = 0; k < K; k++) {
      const m = j * K + k; if (this.lb[m]) continue;
      const d = Math.abs(this.lf[m] - f);
      if (d > bd) continue;
      if (d > 0.2) { if (ddx && ddz) continue; const ax = this.sax[m] || this.sax[n]; if ((ax === 1 && ddz) || (ax === 2 && ddx)) continue; }
      bd = d; best = m;
    }
    return best;
  }

  reachable(sx, sz, sy) {
    const N = this.w * this.h, seenN = new Uint8Array(N * K), seen = new Uint8Array(N), q = new Int32Array(N * K);
    const s0 = this.nearestNode(sx, sz, sy);
    if (s0 < 0) return seen;
    let qh = 0, qt = 0; q[qt++] = s0; seenN[s0] = 1;
    while (qh < qt) {
      const n = q[qh++], i = (n / K) | 0, x = i % this.w, z = (i / this.w) | 0;
      seen[i] = 1;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
        const m = this._step(n, nz * this.w + nx, STEP);
        if (m < 0 || seenN[m]) continue;
        seenN[m] = 1; q[qt++] = m;
      }
    }
    this.lastSeenN = seenN;
    return seen;
  }

  losN(n0, n1, ms) {
    const W = this.w, i0 = (n0 / K) | 0, i1 = (n1 / K) | 0;
    let x0 = i0 % W, z0 = (i0 / W) | 0;
    const x1 = i1 % W, z1 = (i1 / W) | 0, dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0), sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    let err = dx - dz, cur = n0;
    for (;;) {
      if (x0 === x1 && z0 === z1) return cur === n1 || Math.abs(this.lf[cur] - this.lf[n1]) < 0.05;
      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x0 += sx; }
      if (e2 < dx) { err += dx; z0 += sz; }
      const m = this._step(cur, z0 * W + x0, ms);
      if (m < 0) return false;
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {      // dar tabliyede (köprü) kenara 1 hücreden yakın geçme: yan hücre boşsa düz çizgi kısaltması yok
        const X = x0 + ax, Z = z0 + az;
        if (X < 0 || Z < 0 || X >= W || Z >= this.h) return false;
        if (this._step(m, Z * W + X, ms) < 0 && !this._wallish(Z * W + X, this.lf[m])) return false;
      }
      cur = m;
    }
  }
  // kapalı kat (duvar / engel) mı, yoksa boşluk mu: duvar dibinden geçmek güvenli, boşluk kenarından değil
  _wallish(i, f) { for (let k = 0; k < K; k++) { const m = i * K + k; if (!Number.isNaN(this.lf[m]) && Math.abs(this.lf[m] - f) < 0.75) return true; } return false; }

  findPath(sx, sz, gx, gz, maxStep = 0.7, sy, gy) {
    maxStep = Math.min(maxStep, STEP);                                  // fizik basamağı (World STEP 0,5): yandan 0,6'lık basamağa çıkılamaz
    const s = this.nearestNode(sx, sz, sy), g = this.nearestNode(gx, gz, Number.isFinite(gy) ? gy : sy);
    if (s < 0 || g < 0) return null;
    const W = this.w, P = (n) => { const i = (n / K) | 0; return new THREE.Vector3(this.cx(i), this.lf[n], this.cz(i)); };
    if (s === g) return [P(g)];
    this.stamp++;
    const st = this.stamp, open = new Heap();
    this.gN[s] = 0; this.markN[s] = st; this.fromN[s] = -1;
    const gi = (g / K) | 0, gxc = gi % W, gzc = (gi / W) | 0, gf = this.lf[g];
    const hf = (n) => { const i = (n / K) | 0, dx = Math.abs((i % W) - gxc), dz = Math.abs(((i / W) | 0) - gzc); return 1.25 * ((dx + dz) + (1.4142 - 2) * Math.min(dx, dz)) + Math.abs(this.lf[n] - gf) * 1.2; };
    open.push(s, hf(s));
    let found = false, exp = 0;
    const lim = W * this.h * K;
    while (open.size && exp++ < lim) {
      const cur = open.pop();
      if (cur === g) { found = true; break; }
      if (this.closedN[cur] === st) continue;
      this.closedN[cur] = st;
      const ci = (cur / K) | 0, cx = ci % W, cz = (ci / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const m = this._step(cur, nz * W + nx, maxStep);
        if (m < 0) continue;
        if (dx && dz && (this._step(cur, cz * W + nx, maxStep) < 0 || this._step(cur, nz * W + cx, maxStep) < 0)) continue;
        let edge = 0;                                                     // boşluk kenarı cezası: köprüde ortadan yürü
        for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = nx + ax, Z = nz + az; if (X >= 0 && Z >= 0 && X < W && Z < this.h && this._step(m, Z * W + X, maxStep) < 0 && !this._wallish(Z * W + X, this.lf[m])) edge = 0.8; }
        const ng = this.gN[cur] + (dx && dz ? 1.4142 : 1) + edge;
        if (this.markN[m] !== st || ng < this.gN[m]) { this.markN[m] = st; this.gN[m] = ng; this.fromN[m] = cur; open.push(m, ng + hf(m)); }
      }
    }
    if (!found) return null;
    const nodes = [];
    for (let n = g; n !== -1; n = this.fromN[n]) nodes.push(n);
    nodes.reverse();
    const out = [];
    let a = 0;
    while (a < nodes.length - 1) {
      let b = Math.min(nodes.length - 1, a + 24);
      while (b > a + 1 && !this.losN(nodes[a], nodes[b], maxStep)) b--;
      out.push(P(nodes[b]));
      a = b;
    }
    return out;
  }
}
