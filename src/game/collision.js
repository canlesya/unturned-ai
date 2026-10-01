import * as THREE from 'three';

// AABB tabanlı dünya: oyuncu/bot hareketi (adım çıkma, zıplama), ışın testi.
export const R = 0.32;           // karakter yarıçapı
export const H_STAND = 1.78;
export const H_CROUCH = 1.3;
const STEP = 0.5;
const GRAV = 15;

export class World {
  constructor(colliders, bounds) {
    this.colliders = colliders;
    this.bounds = bounds;
    this.cell = 8;
    this.grid = new Map();
    this.stamp = 0;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      c._i = i; c._s = 0;
      const x0 = Math.floor(c.min[0] / this.cell), x1 = Math.floor(c.max[0] / this.cell);
      const z0 = Math.floor(c.min[2] / this.cell), z1 = Math.floor(c.max[2] / this.cell);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = x + ',' + z;
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, (a = []));
        a.push(c);
      }
    }
  }

  query(minx, minz, maxx, maxz, out = []) {
    out.length = 0;
    this.stamp++;
    const x0 = Math.floor(minx / this.cell), x1 = Math.floor(maxx / this.cell);
    const z0 = Math.floor(minz / this.cell), z1 = Math.floor(maxz / this.cell);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const a = this.grid.get(x + ',' + z);
      if (!a) continue;
      for (const c of a) if (c._s !== this.stamp) { c._s = this.stamp; out.push(c); }
    }
    return out;
  }

  _hits(list, x, y, z, h) {
    for (const c of list) {
      if (x + R > c.min[0] && x - R < c.max[0] && z + R > c.min[2] && z - R < c.max[2] && y + h > c.min[1] + 1e-4 && y < c.max[1] - 1e-4) return c;
    }
    return null;
  }

  // Hareket: s.vel (x,z yatay istenen hız, y dikey) → s.pos güncellenir; s.onGround, s.height kullanılır.
  move(s, dt) {
    const p = s.pos, v = s.vel, h = s.height;
    const list = this.query(p.x - 2, p.z - 2, p.x + 2, p.z + 2, (this._tmp ||= []));
    v.y -= GRAV * dt;
    if (v.y < -40) v.y = -40;

    for (const axis of ['x', 'z']) {
      const d = v[axis] * dt;
      if (d === 0) continue;
      p[axis] += d;
      let guard = 0;
      let c;
      while ((c = this._hits(list, p.x, p.y, p.z, h)) && guard++ < 6) {
        const top = c.max[1];
        if (top - p.y <= STEP && v.y <= 0.5 && !this._hits(list, p.x, top + 0.002, p.z, h)) {
          p.y = top + 0.002;
          continue;
        }
        p[axis] = d > 0 ? c.min[axis === 'x' ? 0 : 2] - R - 1e-3 : c.max[axis === 'x' ? 0 : 2] + R + 1e-3;
        v[axis] = 0;
      }
    }

    const prevY = p.y;
    p.y += v.y * dt;
    s.onGround = false;
    if (p.y <= 0) { p.y = 0; if (v.y < 0) v.y = 0; s.onGround = true; }
    const c = this._hits(list, p.x, p.y, p.z, h);
    if (c) {
      if (v.y <= 0 && prevY >= c.max[1] - 0.05) { p.y = c.max[1]; v.y = 0; s.onGround = true; }
      else if (v.y > 0) { p.y = c.min[1] - h - 1e-3; v.y = 0; }
      else { p.y = prevY; v.y = 0; }
    }

    const b = this.bounds;
    p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
    p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z));
  }

  canStand(s) {
    const list = this.query(s.pos.x - 1, s.pos.z - 1, s.pos.x + 1, s.pos.z + 1, (this._tmp2 ||= []));
    return !this._hits(list, s.pos.x, s.pos.y, s.pos.z, H_STAND);
  }

  // Işın: en yakın çarpışma kutusu ya da zemin. d normalize olmalı.
  raycast(o, d, maxT = 300, out = {}) {
    let best = maxT, bn = null, bc = null;
    const inv = [1 / (d.x || 1e-9), 1 / (d.y || 1e-9), 1 / (d.z || 1e-9)];
    const ex = o.x + d.x * maxT, ez = o.z + d.z * maxT;
    const list = this.query(Math.min(o.x, ex) - 0.1, Math.min(o.z, ez) - 0.1, Math.max(o.x, ex) + 0.1, Math.max(o.z, ez) + 0.1, (this._tmp3 ||= []));
    for (const c of list) {
      let t0 = 0, t1 = best, axisHit = -1, sgn = 0;
      const oo = [o.x, o.y, o.z];
      for (let a = 0; a < 3; a++) {
        let ta = (c.min[a] - oo[a]) * inv[a], tb = (c.max[a] - oo[a]) * inv[a], s = -1;
        if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
        if (ta > t0) { t0 = ta; axisHit = a; sgn = s; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < best && t1 > 0) { best = t0; bc = c; bn = axisHit >= 0 ? [axisHit, sgn] : null; }
    }
    if (d.y < -1e-6) {
      const tg = -o.y / d.y;
      if (tg > 0 && tg < best) { best = tg; bc = null; bn = [1, 1]; }
    }
    if (best >= maxT) return null;
    out.t = best;
    out.collider = bc;
    out.normal = out.normal || new THREE.Vector3();
    out.normal.set(0, 0, 0);
    if (bn) out.normal.setComponent(bn[0], bn[1]);
    out.point = (out.point || new THREE.Vector3()).copy(o).addScaledVector(d, best);
    return out;
  }

  // a→b arasında engel var mı
  clear(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    const d = (this._dir ||= new THREE.Vector3()).set(dx / len, dy / len, dz / len);
    return !this.raycast(a, d, len - 0.05, (this._lo ||= {}));
  }
}
