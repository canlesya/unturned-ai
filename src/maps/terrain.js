import * as THREE from 'three';

// Arazi yükseklik haritası: düzenli ızgara, bilinear örnekleme, düşük poligon (yüzey başına renk) mesh.
// Fizik / ışın / yol bulma bu sınıfın heightAt() fonksiyonunu kullanır.

const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mixf = (a, b, t) => a + (b - a) * t;

function hash(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return mixf(mixf(a, b, u), mixf(c, d, u), v);
}
// 0..1 aralığında fraktal gürültü
export function fbm(x, z, seed = 1, oct = 4) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += vnoise(x * f, z * f, seed + i * 17) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

export const WATER_LEVEL = -0.05;       // su yüzeyi
export const DEEP_WATER = -0.22;        // bunun altındaki zemin yürünemez (derin su)

export class Terrain {
  constructor({ minX, maxX, minZ, maxZ, cell = 2.5, height }) {
    this.minX = minX; this.minZ = minZ; this.cell = cell;
    this.nx = Math.ceil((maxX - minX) / cell) + 1;
    this.nz = Math.ceil((maxZ - minZ) / cell) + 1;
    this.maxX = minX + (this.nx - 1) * cell;
    this.maxZ = minZ + (this.nz - 1) * cell;
    this.h = new Float32Array(this.nx * this.nz);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) this.h[j * this.nx + i] = height(minX + i * cell, minZ + j * cell);
  }

  heightAt(x, z) {
    let fx = (x - this.minX) / this.cell, fz = (z - this.minZ) / this.cell;
    fx = Math.max(0, Math.min(this.nx - 1.001, fx)); fz = Math.max(0, Math.min(this.nz - 1.001, fz));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, n = this.nx, h = this.h;
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = this.cell * 0.5;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-dx, 2 * e, -dz).normalize();
  }

  slopeAt(x, z, e = 0.5) {
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }

  // Işın - arazi kesişimi: adım adım ilerle, işaret değişince ikili aramayla incele
  raycast(o, d, maxT, out) {
    const step = 1.5;
    let t0 = 0, f0 = o.y - this.heightAt(o.x, o.z);
    if (f0 < 0) return null;
    for (let t = step; t <= maxT + step; t += step) {
      const tt = Math.min(t, maxT);
      const x = o.x + d.x * tt, z = o.z + d.z * tt;
      if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ) return null;
      const f = o.y + d.y * tt - this.heightAt(x, z);
      if (f < 0) {
        let lo = t0, hi = tt;
        for (let k = 0; k < 7; k++) {
          const mid = (lo + hi) / 2;
          const fm = o.y + d.y * mid - this.heightAt(o.x + d.x * mid, o.z + d.z * mid);
          if (fm < 0) hi = mid; else lo = mid;
        }
        out.t = hi;
        out.point = (out.point || new THREE.Vector3()).set(o.x + d.x * hi, o.y + d.y * hi, o.z + d.z * hi);
        out.normal = this.normalAt(out.point.x, out.point.z, out.normal || new THREE.Vector3());
        return out;
      }
      t0 = tt;
      if (tt >= maxT) break;
    }
    return null;
  }

  // Düşük poligon mesh: üçgen başına renk (colorFn(x, z, h, slope) → THREE.Color)
  buildMesh(colorFn) {
    const { nx, nz, cell, minX, minZ } = this;
    const pos = [], col = [];
    const c = new THREE.Color();
    const V = (i, j) => [minX + i * cell, this.h[j * nx + i], minZ + j * cell];
    const tri = (a, b, d) => {
      const cx = (a[0] + b[0] + d[0]) / 3, cz = (a[2] + b[2] + d[2]) / 3, ch = (a[1] + b[1] + d[1]) / 3;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx_ = uy * vz - uz * vy, ny_ = uz * vx - ux * vz, nz_ = ux * vy - uy * vx;
      const len = Math.hypot(nx_, ny_, nz_) || 1;
      const slope = Math.hypot(nx_, nz_) / Math.max(1e-6, Math.abs(ny_));
      colorFn(cx, cz, ch, slope, c);
      for (const p of [a, b, d]) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); }
    };
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = V(i, j), b = V(i + 1, j), d = V(i, j + 1), e = V(i + 1, j + 1);
      if ((i + j) & 1) { tri(a, d, b); tri(b, d, e); } else { tri(a, d, e); tri(a, e, b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
    m.receiveShadow = true;
    return m;
  }
}
