import * as THREE from 'three';

// Zemin kat yürüme ızgarası + A* (botlar için). Hücre 0.5 m.
const CELL = 0.5;
const INFL = 0.4;

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
  constructor(colliders, bounds) {
    this.minX = bounds.minX - 1; this.minZ = bounds.minZ - 1;
    this.w = Math.ceil((bounds.maxX - bounds.minX + 2) / CELL);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ + 2) / CELL);
    this.blocked = new Uint8Array(this.w * this.h);
    for (const c of colliders) {
      if (c.min[1] > 1.6 || c.max[1] < 0.45) continue;
      const x0 = Math.floor((c.min[0] - INFL - this.minX) / CELL), x1 = Math.floor((c.max[0] + INFL - this.minX) / CELL);
      const z0 = Math.floor((c.min[2] - INFL - this.minZ) / CELL), z1 = Math.floor((c.max[2] + INFL - this.minZ) / CELL);
      for (let z = Math.max(0, z0); z <= Math.min(this.h - 1, z1); z++)
        for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.blocked[z * this.w + x] = 1;
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

  idx(x, z) { return Math.floor((z - this.minZ) / CELL) * this.w + Math.floor((x - this.minX) / CELL); }
  cx(i) { return this.minX + ((i % this.w) + 0.5) * CELL; }
  cz(i) { return this.minZ + (Math.floor(i / this.w) + 0.5) * CELL; }
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
    let x0 = i0 % this.w, z0 = Math.floor(i0 / this.w);
    const x1 = i1 % this.w, z1 = Math.floor(i1 / this.w);
    const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    for (;;) {
      if (this.blocked[z0 * this.w + x0]) return false;
      if (x0 === x1 && z0 === z1) return true;
      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x0 += sx; }
      if (e2 < dx) { err += dx; z0 += sz; }
    }
  }

  // Yol: [Vector3...] ya da null
  findPath(sx, sz, gx, gz) {
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
    while (open.size && expanded++ < 24000) {
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
