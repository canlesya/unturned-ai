import * as THREE from 'three';
import { NavGrid, Heap } from '../../../game/nav.js';

// Çöl Geçidi yol ızgarası (12.171): NavGrid (katlı, hücre başına tek zemin) + yalnız Short köprüsünün altında İKİNCİ kat.
// Köprü hücrelerinde üst kat = tabliye (Short ↔ A), alt kat = CT Spawn zemini (CT ↔ kemer avlusu / Elevator geçidi). Eski API (floor / blocked / isFree /
// los / nearestFree …) tek katlı haliyle aynı → bot davranışı (katlı haritalara özel dallar: nearestNode / safeAt) DEĞİŞMEZ; yalnız findPath ve reachable
// iki katı bilir. findPath(…, sy, gy): başlangıç / hedef köprü hücresindeyse kata y'ye göre karar verir (y yoksa alt kat).
const CELL = 0.5, INFL = 0.35;

export class CgNav extends NavGrid {
  constructor(colliders, bounds, terrain, under) {
    super(colliders, bounds, terrain, true);
    const W = this.w, H = this.h, N = W * H;
    this.N = N;
    this.uIx = new Int32Array(N).fill(-1);
    const cells = [], lowF = [], lowB = [];
    const [x0, z0, x1, z1] = under;
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const wx = this.minX + (x + 0.5) * CELL, wz = this.minZ + (z + 0.5) * CELL, i = z * W + x;
      if (wx < x0 || wx > x1 || wz < z0 || wz > z1) continue;
      const g = terrain.heightAt(wx, wz);
      if (this.floor[i] - g < 1.6) continue;                                   // tabliye yok / alçak
      this.uIx[i] = cells.length; cells.push(i); lowF.push(g); lowB.push(terrain.slopeAt(wx, wz, 0.6) > 0.95 ? 1 : 0);
    }
    this.uCell = Int32Array.from(cells); this.uFloor = Float32Array.from(lowF); this.uBlk = Uint8Array.from(lowB);
    const cellRange = (lo, hi, min, n) => [Math.max(0, Math.ceil((lo - min) / CELL - 0.5)), Math.min(n - 1, Math.floor((hi - min) / CELL - 0.5))];
    for (const c of colliders) {                                               // alt katın engelleri (ayak, kemer duvarı, çerçeve dikmesi …)
      if (c.tag === 'deck' || c.tag === 'plat') continue;
      if (c.max[0] < x0 - 1 || c.min[0] > x1 + 1 || c.max[2] < z0 - 1 || c.min[2] > z1 + 1) continue;
      const [a0, a1] = cellRange(c.min[0] - INFL, c.max[0] + INFL, this.minX, W), [b0, b1] = cellRange(c.min[2] - INFL, c.max[2] + INFL, this.minZ, H);
      for (let z = b0; z <= b1; z++) for (let x = a0; x <= a1; x++) { const u = this.uIx[z * W + x]; if (u < 0) continue; const f = this.uFloor[u]; if (c.min[1] - f > 1.6 || c.max[1] - f < 0.45) continue; this.uBlk[u] = 1; }
    }
    // 12.181 açılı kapı kanatları (çapraz kutu zinciri): kanadın 0,75 m yakınındaki hücrelerde yol KISALTILMAZ (doğru çizgi kanadın ucunu / sırtını
    // kesip botu kanada dayatıyordu: Mid Doors'ta takılma). Yol yine aynı hücrelerden geçer; yalnız ara noktalar tek tek izlenir (kanat çevresinden dolaşır).
    const DM = 0.75; this.doorMask = new Uint8Array(N);
    for (const c of colliders) {
      if (c.tag !== 'wood' || !String(c.oid).startsWith('kapı:')) continue;
      const [a0, a1] = cellRange(c.min[0] - DM, c.max[0] + DM, this.minX, W), [b0, b1] = cellRange(c.min[2] - DM, c.max[2] + DM, this.minZ, H);
      for (let z = b0; z <= b1; z++) for (let x = a0; x <= a1; x++) this.doorMask[z * W + x] = 1;
    }
    const M = N + cells.length;
    this.gA = new Float32Array(M); this.fromA = new Int32Array(M); this.markA = new Uint32Array(M); this.closedA = new Uint32Array(M); this.stampA = 0;
  }
  // düğüm: < N üst (taban) kat, ≥ N alt kat
  fOf(n) { return n < this.N ? this.floor[n] : this.uFloor[n - this.N]; }
  cellOfNode(n) { return n < this.N ? n : this.uCell[n - this.N]; }
  // hücre i'de, f katından ms içinde geçilebilen düğüm (yoksa −1); ikisi de uygunsa f'e yakın olan
  nodeIn(i, f, ms) {
    let best = -1, bd = ms + 1e-6;
    if (!this.blocked[i]) { const d = Math.abs(this.floor[i] - f); if (d <= bd) { bd = d; best = i; } }
    const u = this.uIx[i];
    if (u >= 0 && !this.uBlk[u]) { const d = Math.abs(this.uFloor[u] - f); if (d <= bd) { bd = d; best = this.N + u; } }
    return best;
  }
  pick(x, z, y) {                                                              // (x, z, y) → düğüm (köprü hücresinde y'ye göre kat)
    let i = this.idx(x, z);
    const u = i >= 0 && i < this.N ? this.uIx[i] : -1;
    if (u >= 0 && !this.uBlk[u]) { if (!Number.isFinite(y) || this.blocked[i] || Math.abs(y - this.uFloor[u]) < Math.abs(y - this.floor[i])) return this.N + u; return i; }
    if (u >= 0 && this.uBlk[u] && !this.blocked[i] && Number.isFinite(y) && Math.abs(y - this.floor[i]) < 1.2) return i;
    const n = this.nearestFree(x, z);
    if (n >= 0 && Number.isFinite(y)) { const uu = this.uIx[n]; if (uu >= 0 && !this.uBlk[uu] && Math.abs(y - this.uFloor[uu]) < Math.abs(y - this.floor[n])) return this.N + uu; }
    if (n < 0) { for (let r = 1; r <= 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const j = i + dz * this.w + dx; const uu = j >= 0 && j < this.N ? this.uIx[j] : -1; if (uu >= 0 && !this.uBlk[uu]) return this.N + uu; } }
    return n;
  }
  // iki katlı bağlı bileşenler (adım sınırı başına bir kez)
  compsA(ms) {
    const C = (this._compsA ||= new Map()); let cm = C.get(ms); if (cm) return cm;
    const M = this.N + this.uCell.length, W = this.w, q = new Int32Array(M); cm = new Int32Array(M).fill(-1); let id = 0;
    for (let s0 = 0; s0 < M; s0++) {
      if (cm[s0] >= 0 || (s0 < this.N ? this.blocked[s0] : this.uBlk[s0 - this.N])) continue;
      let qh = 0, qt = 0; q[qt++] = s0; cm[s0] = id;
      while (qh < qt) {
        const n = q[qh++], c = this.cellOfNode(n), cx = c % W, cz = (c / W) | 0, f = this.fOf(n);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue; const m = this.nodeIn(nz * W + nx, f, ms); if (m < 0 || cm[m] >= 0) continue; cm[m] = id; q[qt++] = m; }
      }
      id++;
    }
    C.set(ms, cm); return cm;
  }
  reachable(sx, sz) {
    const seen = new Uint8Array(this.N), s = this.pick(sx, sz);
    if (s < 0) return seen;
    const cm = this.compsA(0.7), id = cm[s], M = this.N + this.uCell.length;
    for (let n = 0; n < M; n++) if (cm[n] === id) seen[this.cellOfNode(n)] = 1;
    return seen;
  }
  // kapı kanadı yakınından geçen doğru (Bresenham, uçlar dahil)
  doorLine(c0, c1) {
    const W = this.w, x1 = c1 % W, z1 = (c1 / W) | 0;
    let x0 = c0 % W, z0 = (c0 / W) | 0; const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0), sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    for (;;) {
      if (this.doorMask[z0 * W + x0]) return true;
      if (x0 === x1 && z0 === z1) return false;
      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x0 += sx; }
      if (e2 < dx) { err += dx; z0 += sz; }
    }
  }
  los(i0, i1) { return !this.doorLine(i0, i1) && super.los(i0, i1); }        // bot ara nokta atlaması (bot.js followGoal) da kanat yakınında kısaltmaz
  losA(n0, n1, ms) {
    const W = this.w, c0 = this.cellOfNode(n0), c1 = this.cellOfNode(n1);
    if (this.doorLine(c0, c1)) return false;
    let x0 = c0 % W, z0 = (c0 / W) | 0; const x1 = c1 % W, z1 = (c1 / W) | 0, dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0), sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    let err = dx - dz, cur = n0;
    for (;;) {
      if (x0 === x1 && z0 === z1) return cur === n1 || Math.abs(this.fOf(cur) - this.fOf(n1)) < 0.05;
      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x0 += sx; }
      if (e2 < dx) { err += dx; z0 += sz; }
      const m = this.nodeIn(z0 * W + x0, this.fOf(cur), ms);
      if (m < 0) return false;
      cur = m;
    }
  }
  findPath(sx, sz, gx, gz, maxStep = 0.7, sy, gy) {
    const s = this.pick(sx, sz, sy), g = this.pick(gx, gz, Number.isFinite(gy) ? gy : undefined);
    if (s < 0 || g < 0) return null;
    const P = (n) => { const c = this.cellOfNode(n); return new THREE.Vector3(this.cx(c), this.fOf(n), this.cz(c)); };
    if (s === g) return [P(g)];
    const cm = this.compsA(maxStep);
    if (cm[s] !== cm[g]) return null;
    this._ms = maxStep;
    const W = this.w, st = ++this.stampA, open = new Heap();
    const gc = this.cellOfNode(g), gxc = gc % W, gzc = (gc / W) | 0;
    const hf = (n) => { const c = this.cellOfNode(n), dx = Math.abs((c % W) - gxc), dz = Math.abs(((c / W) | 0) - gzc); return 1.25 * ((dx + dz) + (1.4142 - 2) * Math.min(dx, dz)); };
    this.gA[s] = 0; this.markA[s] = st; this.fromA[s] = -1; open.push(s, hf(s));
    let found = false, exp = 0; const lim = this.gA.length;
    while (open.size && exp++ < lim) {
      const cur = open.pop();
      if (cur === g) { found = true; break; }
      if (this.closedA[cur] === st) continue;
      this.closedA[cur] = st;
      const c = this.cellOfNode(cur), cx = c % W, cz = (c / W) | 0, f = this.fOf(cur);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const m = this.nodeIn(nz * W + nx, f, maxStep);
        if (m < 0) continue;
        if (dx && dz && (this.nodeIn(cz * W + nx, f, maxStep) < 0 || this.nodeIn(nz * W + cx, f, maxStep) < 0)) continue;
        const ng = this.gA[cur] + (dx && dz ? 1.4142 : 1);
        if (this.markA[m] !== st || ng < this.gA[m]) { this.markA[m] = st; this.gA[m] = ng; this.fromA[m] = cur; open.push(m, ng + hf(m)); }
      }
    }
    if (!found) return null;
    const nodes = []; for (let n = g; n !== -1; n = this.fromA[n]) nodes.push(n); nodes.reverse();
    const out = []; let a = 0;
    while (a < nodes.length - 1) { let b = nodes.length - 1; while (b > a + 1 && !this.losA(nodes[a], nodes[b], maxStep)) b--; out.push(P(nodes[b])); a = b; }
    return out;
  }
}
