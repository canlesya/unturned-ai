// 3B yürüme grafiği (Node, tarayıcı gerekmez): çarpışma kutularından "ayakta durulabilir yüzeyler" çıkarır,
// adım yükseltmesi (0.5 m) kuralıyla BFS yapar ve bulunan yolu GERÇEK World.move fiziğiyle yürüterek doğrular.
//   import { Walk } from './nav3d.mjs'; const w = new Walk(colliders, bounds); w.reach(start) / w.walk(from, to)
import * as THREE from 'three';
import { World } from '../../src/game/collision.js';

const R = 0.32, STEP = 0.5, HEAD = 1.75;

export class Walk {
  constructor(colliders, bounds, { res = 0.25, region = null, terrain = null } = {}) {
    this.world = new World(colliders, bounds, terrain);
    this.colliders = colliders;
    this.bounds = bounds;
    this.res = res;
    const rg = region || bounds;
    this.x0 = rg.minX; this.z0 = rg.minZ;
    this.nx = Math.ceil((rg.maxX - rg.minX) / res); this.nz = Math.ceil((rg.maxZ - rg.minZ) / res);
    this.surf = new Array(this.nx * this.nz);     // her sütun: yükseklik dizisi
    this._tmp = [];
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) this.surf[j * this.nx + i] = this._column(i, j);
  }

  cx(i) { return this.x0 + (i + 0.5) * this.res; }
  cz(j) { return this.z0 + (j + 0.5) * this.res; }
  col(x, z) { return [Math.floor((x - this.x0) / this.res), Math.floor((z - this.z0) / this.res)]; }

  _column(i, j) {
    const x = this.cx(i), z = this.cz(j);
    const list = this.world.query(x - R, z - R, x + R, z + R, this._tmp);
    const over = list.filter((c) => x + R > c.min[0] && x - R < c.max[0] && z + R > c.min[2] && z - R < c.max[2]);
    const g = this.world.heightAt(x, z);
    const cand = new Set([g]);
    for (const c of over) cand.add(c.max[1]);
    const out = [];
    for (const y of [...cand].sort((a, b) => a - b)) {
      let ok = true;
      for (const c of over) if (c.min[1] < y + HEAD - 1e-3 && c.max[1] > y + 0.02) { ok = false; break; }
      if (ok && y >= g - 1e-3) out.push(y);
    }
    return out;
  }

  // start = {x,y,z}; hedefe giden BFS: {seen, parent} döner
  reach(start, { maxDrop = 2.2, stepUp = STEP } = {}) {
    const [si, sj] = this.col(start.x, start.z);
    const sl = this.surf[sj * this.nx + si] || [];
    let best = -1, bd = 1e9;
    sl.forEach((y, n) => { if (Math.abs(y - start.y) < bd) { bd = Math.abs(y - start.y); best = n; } });
    if (best < 0) return null;
    const key = (i, j, n) => (j * this.nx + i) * 8 + n;
    const seen = new Map();
    const q = [[si, sj, best]];
    seen.set(key(si, sj, best), null);
    for (let h = 0; h < q.length; h++) {
      const [i, j, n] = q[h];
      const y = this.surf[j * this.nx + i][n];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= this.nx || jj >= this.nz) continue;
        if (di && dj) {
          // çapraz: iki komşu da geçilebilir olmalı
          const a = this.surf[j * this.nx + ii], c = this.surf[jj * this.nx + i];
          if (!a.some((v) => Math.abs(v - y) <= stepUp) || !c.some((v) => Math.abs(v - y) <= stepUp)) continue;
        }
        const L = this.surf[jj * this.nx + ii];
        for (let m = 0; m < L.length; m++) {
          const dy = L[m] - y;
          if (dy > stepUp + 1e-3 || dy < -maxDrop) continue;
          const k = key(ii, jj, m);
          if (seen.has(k)) continue;
          seen.set(k, [i, j, n]);
          q.push([ii, jj, m]);
        }
      }
    }
    return { seen, key, start: [si, sj, best] };
  }

  // BFS sonucunda (x,z) çevresinde (radius m) y'ye (±tol) yakın erişilebilir yüzey var mı → yol (en yakın düğüm)
  pathTo(r, x, y, z, tol = 0.6, radius = 0.3) {
    const [i, j] = this.col(x, z);
    const rc = Math.ceil(radius / this.res);
    let best = null, bd = 1e9;
    for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
      const L = this.surf[(j + dj) * this.nx + (i + di)];
      if (!L || i + di < 0 || i + di >= this.nx) continue;
      const dd = Math.hypot(di, dj);
      if (dd > rc + 0.01) continue;
      for (let m = 0; m < L.length; m++) {
        if (Math.abs(L[m] - y) > tol) continue;
        if (!r.seen.has(r.key(i + di, j + dj, m))) continue;
        if (dd < bd) { bd = dd; best = [i + di, j + dj, m]; }
      }
    }
    if (!best) return null;
    const path = [];
    let cur = best;
    while (cur) {
      path.push(new THREE.Vector3(this.cx(cur[0]), this.surf[cur[1] * this.nx + cur[0]][cur[2]], this.cz(cur[1])));
      cur = r.seen.get(r.key(cur[0], cur[1], cur[2]));
    }
    return path.reverse();
  }

  // Yolu GERÇEK World.move ile yürü (zıplamasız). {ok, y, steps}
  walkPath(path, { speed = 3.0, dt = 1 / 30, maxSteps = 6000 } = {}) {
    const s = { pos: path[0].clone(), vel: new THREE.Vector3(), height: HEAD, onGround: true, onCollider: false };
    s.pos.y += 0.01;
    let wi = 1, stuck = 0, steps = 0, lastD = 1e9;
    while (wi < path.length && steps++ < maxSteps) {
      // ileri bak: bir sonraki noktaya hedefle (yakınlık 0.2)
      const t = path[Math.min(wi, path.length - 1)];
      const dx = t.x - s.pos.x, dz = t.z - s.pos.z, d = Math.hypot(dx, dz) || 1e-6;
      const near = path[wi];
      if (Math.hypot(near.x - s.pos.x, near.z - s.pos.z) < 0.16) wi++;
      s.vel.x = (dx / d) * speed; s.vel.z = (dz / d) * speed;
      this.world.move(s, dt);
      const dd = Math.hypot(path[path.length - 1].x - s.pos.x, path[path.length - 1].z - s.pos.z);
      if (Math.abs(dd - lastD) < 1e-4) stuck++; else stuck = 0;
      lastD = dd;
      if (stuck > 90) return { ok: false, y: s.pos.y, steps, at: [s.pos.x, s.pos.z], wi, of: path.length };
    }
    const end = path[path.length - 1];
    const ok = wi >= path.length - 1 && Math.hypot(end.x - s.pos.x, end.z - s.pos.z) < 0.9 && Math.abs(s.pos.y - end.y) < 0.8;
    return { ok, y: s.pos.y, steps, at: [s.pos.x, s.pos.z], wi, of: path.length };
  }
}
