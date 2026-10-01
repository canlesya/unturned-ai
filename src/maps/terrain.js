import * as THREE from 'three';

// Arazi yükseklik haritası: düzenli ızgara, bilinear örnekleme, düşük poligon (yüzey başına renk) mesh.
// Fizik / ışın / yol bulma bu sınıfın heightAt() fonksiyonunu kullanır.

const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mixf = (a, b, t) => a + (b - a) * t;

// ───────── Yardımcılar: şekil mesafeleri, patika (yol) kesiti ─────────
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// (px,pz) noktasının a→b doğru parçasına uzaklığı; t: 0..1 parça üzerindeki konum
export function segDist(px, pz, ax, az, bx, bz, out) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t, qz = az + dz * t;
  if (out) out.t = t;
  return Math.hypot(px - qx, pz - qz);
}
// Dikdörtgene (merkez + yarı boyutlar) dış uzaklık (içerideyse 0)
export function rectDist(px, pz, cx, cz, hx, hz) {
  const dx = Math.max(0, Math.abs(px - cx) - hx), dz = Math.max(0, Math.abs(pz - cz) - hz);
  return Math.hypot(dx, dz);
}
// Kapsül tümsek: a→b ekseni boyunca düz tepe (yarıçap r) + yumuşak yamaç (fall); 0..1 ağırlık
export function capW(px, pz, ax, az, bx, bz, r, fall) {
  return 1 - smoothstep(r, r + fall, segDist(px, pz, ax, az, bx, bz));
}
// Basamaklı (teraslı) yükseklik: step aralıklı düz sahanlıklar + dik yarlar
export function terrace(h, step, sharp = 0.6) {
  const u = h / step, f = u - Math.floor(u);
  const stairs = (Math.floor(u) + smoothstep(0.62, 0.98, f)) * step;
  return mixf(h, stairs, sharp);
}

// Patika / yol: kontrol noktalarından yumuşatılmış poligon çizgi. Zemine "bench" keser (düz yol yatağı, kenarlarda
// yumuşak geçiş); yatak yüksekliği boyuna yumuşatılır ve eğimi sınırlanır (tırmanılabilir rampa).
export class Trail {
  constructor(pts, { w = 4.4, fall = 3.0, grade = 0.40, smooth = 3, step = 1.6, name = '' } = {}) {
    this.name = name; this.w = w; this.fall = fall; this.grade = grade; this.smoothN = smooth;
    let p = pts.map((q) => [q[0], q[1]]);
    for (let it = 0; it < 2 && p.length > 2; it++) {       // Chaikin: köşeleri yuvarla
      const o = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      o.push(p[p.length - 1]); p = o;
    }
    const s = [p[0]];                                       // eşit aralıklı örnekle
    let carry = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let d = step - carry;
      while (d <= L) { const t = d / L; s.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d += step; }
      carry = L - (d - step);
    }
    s.push(p[p.length - 1]);
    this.p = s; this.step = step;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const q of s) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    const pad = w / 2 + fall + 1;
    this.box = [x0 - pad, x1 + pad, z0 - pad, z1 + pad];
    this.y = null;
  }
  // yatak yüksekliklerini mevcut arazi fonksiyonundan hesapla
  prepare(hf) {
    const n = this.p.length;
    let y = this.p.map((q) => hf(q[0], q[1]));
    const raw = y.slice();
    for (let pass = 0; pass < 2; pass++) {                  // boyuna ortalama (uçlar sabit kalır)
      const o = y.slice();
      for (let i = 1; i < n - 1; i++) {
        let a = 0, c = 0;
        for (let k = -this.smoothN; k <= this.smoothN; k++) { const j = i + k; if (j < 0 || j >= n) continue; a += y[j]; c++; }
        o[i] = a / c;
      }
      y = o;
    }
    const mg = this.grade * this.step;                      // eğim sınırı (ileri + geri geçiş)
    for (let i = 1; i < n; i++) y[i] = clamp(y[i], y[i - 1] - mg, y[i - 1] + mg);
    for (let i = n - 2; i >= 0; i--) y[i] = clamp(y[i], y[i + 1] - mg, y[i + 1] + mg);
    this.y = y; this.raw = raw;
    return this;
  }
  // (x,z) → {d: yatak ekseni uzaklığı, y: yatak yüksekliği} ya da null (uzakta)
  near(x, z, out) {
    const b = this.box;
    if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return null;
    const P = this.p, n = P.length;
    let bd = 1e9, by = 0;
    const tmp = this._t || (this._t = { t: 0 });
    for (let i = 0; i < n - 1; i++) {
      const d = segDist(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], tmp);
      if (d < bd) { bd = d; by = this.y[i] + (this.y[i + 1] - this.y[i]) * tmp.t; }
    }
    out.d = bd; out.y = by;
    return out;
  }
  // kenar yumuşatmalı ağırlık (0..1)
  weight(d) { return 1 - smoothstep(this.w / 2, this.w / 2 + this.fall, d); }
}

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


// Doku hissi (ek poligon ve draw call olmadan): dünya uzayında bloklu "piksel" gürültü + büyük ölçekli benekler.
// Üçgen başına düz renge yakın kalır ama yakın planda çimen/toprak dokusu izlenimi verir.
function applyDetail(material, { block = 0.55, amp = 0.11, patch = 0.07 } = {}) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uDet = { value: new THREE.Vector3(block, amp, patch) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP;
uniform vec3 uDet;
float dh21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float dvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(dh21(i), dh21(i+vec2(1.,0.)), f.x), mix(dh21(i+vec2(0.,1.)), dh21(i+vec2(1.,1.)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float bl = dh21(floor(vWP.xz / uDet.x));
  float pt = dvn(vWP.xz * 0.23) * 0.65 + dvn(vWP.xz * 0.9 + 7.3) * 0.35;
  float k = (bl - 0.5) * uDet.y + (pt - 0.5) * uDet.z * 2.0;
  diffuseColor.rgb *= 1.0 + k;
  diffuseColor.rgb += vec3(0.012, 0.018, -0.01) * (pt - 0.5);
}`);
  };
  material.customProgramCacheKey = () => 'terrain-detail';
}

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
  buildMesh(colorFn, opts = {}) {
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
    if (opts.smooth) {
      // düğüm başına renk (kenarlar yumuşak geçer), üçgen başına hafif parlaklık oynaması → "facet" görünümü korunur
      const nc = new Float32Array(nx * nz * 3), jit = opts.jitter ?? 0.04;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = minX + i * cell, z = minZ + j * cell, h = this.h[j * nx + i];
        colorFn(x, z, h, this.slopeAt(x, z, cell * 0.5), c);
        const k = (j * nx + i) * 3; nc[k] = c.r; nc[k + 1] = c.g; nc[k + 2] = c.b;
      }
      const T3 = (i0, j0, i1, j1, i2, j2) => {
        const v = [[i0, j0], [i1, j1], [i2, j2]];
        const f = 1 + jit * (hash(i0 * 3 + i1 + i2 * 7, j0 * 5 + j1 + j2 * 11, 5) - 0.5) * 2;
        for (const [ii, jj] of v) { const k = (jj * nx + ii) * 3; pos.push(minX + ii * cell, this.h[jj * nx + ii], minZ + jj * cell); col.push(nc[k] * f, nc[k + 1] * f, nc[k + 2] * f); }
      };
      for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
        if ((i + j) & 1) { T3(i, j, i, j + 1, i + 1, j); T3(i + 1, j, i, j + 1, i + 1, j + 1); }
        else { T3(i, j, i, j + 1, i + 1, j + 1); T3(i, j, i + 1, j + 1, i + 1, j); }
      }
    } else
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = V(i, j), b = V(i + 1, j), d = V(i, j + 1), e = V(i + 1, j + 1);
      if ((i + j) & 1) { tri(a, d, b); tri(b, d, e); } else { tri(a, d, e); tri(a, e, b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    if (opts.detail) applyDetail(material, opts.detail);
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  }
}
