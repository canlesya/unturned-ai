import * as THREE from 'three';
import { DEEP_WATER } from '../maps/terrain.js';

// Zemin kat yürüme ızgarası + A* (botlar için). Hücre 0.5 m.
const CELL = 0.5;
const INFL = 0.35;

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n, f) {
    const a = this.a; a.push([n, f]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][1] <= a[i][1]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top[0];
  }
}

export class NavGrid {
  // layered: harita 'plat' etiketli yürünebilir platform/basamak/rampa içerir → hücre başına zemin yüksekliği (floor) tutulur;
  // yol bulma yalnızca |Δzemin| ≤ maxStep olan komşulara geçer (insan 0.7 = basamak, zombi 1.15 = sıçrayarak çıkabilir)
  constructor(colliders, bounds, terrain = null, layered = false) {
    this.minX = bounds.minX - 1; this.minZ = bounds.minZ - 1;
    this.w = Math.ceil((bounds.maxX - bounds.minX + 2) / CELL);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ + 2) / CELL);
    this.blocked = new Uint8Array(this.w * this.h);
    if (terrain) {
      for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
        const wx = this.minX + (x + 0.5) * CELL, wz = this.minZ + (z + 0.5) * CELL;
        if (terrain.heightAt(wx, wz) < DEEP_WATER + 0.05 || terrain.slopeAt(wx, wz, 0.6) > 0.95) this.blocked[z * this.w + x] = 1;
      }
    }
    // köprü tabliyesi vb.: araziden bağımsız yürünebilir
    const cellRange = (lo, hi, min, n) => [Math.max(0, Math.ceil((lo - min) / CELL - 0.5)), Math.min(n - 1, Math.floor((hi - min) / CELL - 0.5))];
    for (const c of colliders) {
      if (c.tag !== 'deck') continue;
      const [x0, x1] = cellRange(c.min[0] + INFL, c.max[0] - INFL, this.minX, this.w);
      const [z0, z1] = cellRange(c.min[2] + INFL, c.max[2] - INFL, this.minZ, this.h);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.w + x] = 0;
    }
    if (layered) {
      this.floor = new Float32Array(this.w * this.h);
      if (terrain) for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) this.floor[z * this.w + x] = terrain.heightAt(this.minX + (x + 0.5) * CELL, this.minZ + (z + 0.5) * CELL);
      for (const c of colliders) {
        if (c.tag !== 'plat') continue;
        let [x0, x1] = cellRange(c.min[0] + 0.02, c.max[0] - 0.02, this.minX, this.w);
        let [z0, z1] = cellRange(c.min[2] + 0.02, c.max[2] - 0.02, this.minZ, this.h);
        if (x0 > x1) x0 = x1 = Math.max(0, Math.min(this.w - 1, Math.floor(((c.min[0] + c.max[0]) / 2 - this.minX) / CELL)));        // hücreden dar basamak (run < 0.5): en az 1 hücre
        if (z0 > z1) z0 = z1 = Math.max(0, Math.min(this.h - 1, Math.floor(((c.min[2] + c.max[2]) / 2 - this.minZ) / CELL)));
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const i = z * this.w + x; if (c.max[1] > this.floor[i]) this.floor[i] = c.max[1]; this.blocked[i] = 0; }
      }
      for (const c of colliders) {                                         // zemin yüksekliğine göre engeller (platform üstündeki duvar/korkuluk da engel)
        if (c.tag === 'deck' || c.tag === 'plat') continue;
        const [x0, x1] = cellRange(c.min[0] - INFL, c.max[0] + INFL, this.minX, this.w);
        const [z0, z1] = cellRange(c.min[2] - INFL, c.max[2] + INFL, this.minZ, this.h);
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
          const i = z * this.w + x, f = this.floor[i];
          if (c.min[1] - f > 1.6 || c.max[1] - f < 0.45) continue;
          this.blocked[i] = 1;
        }
      }
    } else for (const c of colliders) {
      if (c.tag === 'deck') continue;
      const gy = c.tag === 'rail' ? c.min[1] : terrain ? terrain.heightAt((c.min[0] + c.max[0]) / 2, (c.min[2] + c.max[2]) / 2) : 0;
      if (c.min[1] - gy > 1.6 || c.max[1] - gy < 0.45) continue;
      const [x0, x1] = cellRange(c.min[0] - INFL, c.max[0] + INFL, this.minX, this.w);
      const [z0, z1] = cellRange(c.min[2] - INFL, c.max[2] + INFL, this.minZ, this.h);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.w + x] = 1;
    }
    // dış kenar
    for (let x = 0; x < this.w; x++) { this.blocked[x] = 1; this.blocked[(this.h - 1) * this.w + x] = 1; }
    for (let z = 0; z < this.h; z++) { this.blocked[z * this.w] = 1; this.blocked[z * this.w + this.w - 1] = 1; }
    this.g = new Float32Array(this.w * this.h);
    this.from = new Int32Array(this.w * this.h);
    this.mark = new Uint32Array(this.w * this.h);
    this.closedMark = new Uint32Array(this.w * this.h);
    this.stamp = 0;
  }

  floorAt(x, z) { return this.floor ? this.floor[this.idx(x, z)] : 0; }
  idx(x, z) { return Math.floor((z - this.minZ) / CELL) * this.w + Math.floor((x - this.minX) / CELL); }
  cx(i) { return this.minX + ((i % this.w) + 0.5) * CELL; }
  cz(i) { return this.minZ + (Math.floor(i / this.w) + 0.5) * CELL; }
  // (sx,sz)'den yürünerek ulaşılabilen hücreler (kapalı oda/ada dışarıda kalır)
  reachable(sx, sz) {
    const seen = new Uint8Array(this.w * this.h), q = new Int32Array(this.w * this.h);
    const s0 = this.nearestFree(sx, sz);
    if (s0 < 0) return seen;
    let qh = 0, qt = 0; q[qt++] = s0; seen[s0] = 1;
    while (qh < qt) {
      const i = q[qh++], x = i % this.w, z = (i / this.w) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
        const j = nz * this.w + nx;
        if (seen[j] || this.blocked[j]) continue;
        if (this.floor && Math.abs(this.floor[j] - this.floor[i]) > 0.7) continue;
        seen[j] = 1; q[qt++] = j;
      }
    }
    return seen;
  }

  // Haritanın her yerinden, birbirinden en az `spacing` m uzak, etrafı ~`clear` m açık rastgele noktalar (ölüm maçı doğmaları)
  spreadPoints(seen, { spacing = 12, clear = 1.0, max = 140, tries = 40000 } = {}) {
    const cells = [];
    for (let i = 0; i < seen.length; i += 3) if (seen[i]) cells.push(i);       // her 3. hücre yeterli (1,5 m ızgara)
    for (let i = cells.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const out = [], sp2 = spacing * spacing;
    for (let k = 0; k < cells.length && k < tries && out.length < max; k++) {
      const i = cells[k], x = this.cx(i), z = this.cz(i);
      let ok = true;
      for (let a = 0; a < 8 && ok; a++) if (!this.isFree(x + Math.cos(a * 0.785) * clear, z + Math.sin(a * 0.785) * clear)) ok = false;   // dar boşluk/duvar dibi olmasın
      if (!ok) continue;
      for (const p of out) if ((p.x - x) ** 2 + (p.z - z) ** 2 < sp2) { ok = false; break; }
      if (ok) out.push({ x, z });
    }
    return out;
  }

  isFree(x, z) {
    const cx = Math.floor((x - this.minX) / CELL), cz = Math.floor((z - this.minZ) / CELL);
    return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h && !this.blocked[cz * this.w + cx];
  }

  nearestFree(x, z, maxR = 12) {
    if (this.isFree(x, z)) return this.idx(x, z);
    const cx = Math.floor((x - this.minX) / CELL), cz = Math.floor((z - this.minZ) / CELL);
    for (let r = 1; r <= maxR / CELL; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const X = cx + dx, Z = cz + dz;
        if (X < 0 || Z < 0 || X >= this.w || Z >= this.h) continue;
        if (!this.blocked[Z * this.w + X]) return Z * this.w + X;
      }
    }
    return -1;
  }

  // Izgara üzerinde düz görüş (Bresenham)
  los(i0, i1) {
    if (this._ms === undefined) this._ms = 0.7;
    let x0 = i0 % this.w, z0 = Math.floor(i0 / this.w);
    const x1 = i1 % this.w, z1 = Math.floor(i1 / this.w);
    const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    let prev = i0;
    for (;;) {
      const ci = z0 * this.w + x0;
      if (this.blocked[ci]) return false;
      if (this.floor && Math.abs(this.floor[ci] - this.floor[prev]) > this._ms) return false;       // basamak/rampa kenarını kesme
      prev = ci;
      if (x0 === x1 && z0 === z1) return true;
      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x0 += sx; }
      if (e2 < dx) { err += dx; z0 += sz; }
    }
  }

  // Yol: [Vector3...] ya da null
  findPath(sx, sz, gx, gz, maxStep = 0.7) {
    this._ms = maxStep;
    const s = this.nearestFree(sx, sz), g = this.nearestFree(gx, gz);
    if (s < 0 || g < 0) return null;
    if (s === g) return [new THREE.Vector3(this.cx(g), 0, this.cz(g))];
    this.stamp++;
    const W = this.w, st = this.stamp;
    const open = new Heap();
    this.g[s] = 0; this.mark[s] = st; this.from[s] = -1;
    const gxc = g % W, gzc = Math.floor(g / W);
    const hf = (i) => {
      const dx = Math.abs((i % W) - gxc), dz = Math.abs(Math.floor(i / W) - gzc);
      return 1.25 * ((dx + dz) + (1.4142 - 2) * Math.min(dx, dz));
    };
    open.push(s, hf(s));
    let expanded = 0, found = false;
    while (open.size && expanded++ < this.w * this.h) {
      const cur = open.pop();
      if (cur === g) { found = true; break; }
      if (this.closedMark[cur] === st) continue;
      this.closedMark[cur] = st;
      const cx = cur % W, cz = Math.floor(cur / W);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const ni = nz * W + nx;
        if (this.blocked[ni]) continue;
        if (this.floor && Math.abs(this.floor[ni] - this.floor[cur]) > maxStep) continue;
        if (dx && dz && (this.blocked[cz * W + nx] || this.blocked[nz * W + cx])) continue;
        const ng = this.g[cur] + (dx && dz ? 1.4142 : 1);
        if (this.mark[ni] !== st || ng < this.g[ni]) {
          this.mark[ni] = st; this.g[ni] = ng; this.from[ni] = cur;
          open.push(ni, ng + hf(ni));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = g; i !== -1; i = this.from[i]) cells.push(i);
    cells.reverse();
    // yol sadeleştirme
    const out = [];
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !this.los(cells[a], cells[b])) b--;
      out.push(new THREE.Vector3(this.cx(cells[b]), 0, this.cz(cells[b])));
      a = b;
    }
    return out;
  }
}
