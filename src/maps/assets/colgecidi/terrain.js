import * as THREE from 'three';
import { cgLayout, T_FLOOR } from './layout.js';

// Çöl Geçidi v2 zemini (12.171): plan hücreleri (0,5 m) düz kat ya da doğrusal rampa. Görünen ağ ile fizik AYNI fonksiyondan:
//  · komşu iki zemin hücresi arasında kot farkı ≤ 0,02 → sürekli;
//  · 0,02 < fark ≤ 0,55 (yalnız bu kenar boyunca) → alçak hücrede 1,1 eğimli PAH (yürünür basamak; gözle görülen eğik taş kenar, fizik aynı);
//  · aksi hâlde DİKEY DUVAR (istinat): ağda dikey dörtgen, fizikte pushOut (gövde yarıçapıyla katı; Cephe 12.161 yöntemi) → görünen duvar = çarpışma.
// Bina / dış hücrelerinin altında yüzey çizilmez (kütle kutusu örter); orada heightAt komşu zemin kotunu verir.
export const BEVEL = 1.1, WALL_D = 0.55;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];        // +x, −x, +z, −z

export class CgTerrain {
  constructor() {
    const L = (this.L = cgLayout());
    this.minX = L.x0; this.minZ = L.z0; this.maxX = L.x0 + L.nx * L.C; this.maxZ = L.z0 + L.nz * L.C; this.cell = L.C;
    this.deepWater = -1e9; this.navMin = -9;
    const N = L.N;
    // kenar sınıfı: hücre k'nin s yönündeki kenarı → 0 yok / sürekli, 1 pah (k alçak taraf), 2 duvar (k alçak taraf), 3 k yüksek taraf
    this.edge = new Uint8Array(N * 4);
    this.wallNear = new Uint8Array(N);                                 // hücrenin bir kenarında (alçak ya da yüksek tarafında) dikey duvar var
    this.top = -1e9;
    for (let k = 0; k < N; k++) {
      if (L.type[k] !== T_FLOOR) continue;
      const i = k % L.nx, j = (k / L.nx) | 0;
      for (let s = 0; s < 4; s++) {
        const m = L.at(i + SIDES[s][0], j + SIDES[s][1]);
        if (m < 0 || L.type[m] !== T_FLOOR) continue;
        const [a, b] = this.edgePts(i, j, s), da = L.surf(m, a[0], a[1]) - L.surf(k, a[0], a[1]), db = L.surf(m, b[0], b[1]) - L.surf(k, b[0], b[1]);
        const mx = Math.max(da, db), mn = Math.min(da, db);
        if (Math.abs(da) <= 0.02 && Math.abs(db) <= 0.02) continue;
        if (mn > 0.02 && mx <= WALL_D) this.edge[k * 4 + s] = 1;
        else if (mx > 0.02) this.edge[k * 4 + s] = 2;
        else this.edge[k * 4 + s] = 3;
        if (this.edge[k * 4 + s] >= 2 && Math.max(Math.abs(da), Math.abs(db)) > 0.1) this.wallNear[k] = 1;
      }
      this.top = Math.max(this.top, L.ground[k] + 0.6);
    }
    for (let k = 0; k < N; k++) if (L.type[k] === T_FLOOR) { const i = k % L.nx, j = (k / L.nx) | 0; for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.top = Math.max(this.top, L.surf(k, L.x0 + (i + x) * L.C, L.z0 + (j + z) * L.C)); }
  }
  // köprü tabliyesinin oturduğu plato kenarı: altındaki duvar tabliyeyle örtülü → yol bulmada kenar hücresi kapanmaz (Short köprüsü iki ucu)
  exempt(x, z) { return x > 15 && x < 23 && ((z > -51.5 && z < -51) || (z > -34.5 && z < -34)); }
  // hücre (i, j)'nin s kenarının iki ucu (dünya x, z)
  edgePts(i, j, s) {
    const L = this.L, x0 = L.x0 + i * L.C, z0 = L.z0 + j * L.C, x1 = x0 + L.C, z1 = z0 + L.C;
    return s === 0 ? [[x1, z0], [x1, z1]] : s === 1 ? [[x0, z0], [x0, z1]] : s === 2 ? [[x0, z1], [x1, z1]] : [[x0, z0], [x1, z0]];
  }
  // hücre içi yüzey (pah dahil): k hücresi, (x, z) hücre içinde
  cellH(k, x, z) {
    const L = this.L;
    let h = L.surf(k, x, z);
    if (L.type[k] !== T_FLOOR) return h;
    const i = k % L.nx, j = (k / L.nx) | 0, ax = L.x0 + i * L.C, az = L.z0 + j * L.C;
    for (let s = 0; s < 4; s++) {
      if (this.edge[k * 4 + s] !== 1) continue;
      const m = L.at(i + SIDES[s][0], j + SIDES[s][1]);
      const d = s === 0 ? ax + L.C - x : s === 1 ? x - ax : s === 2 ? az + L.C - z : z - az;
      const ex = s === 0 ? ax + L.C : s === 1 ? ax : x, ez = s === 2 ? az + L.C : s === 3 ? az : z;
      const u = L.surf(m, ex, ez) - BEVEL * d;
      if (u > h) h = u;
    }
    return h;
  }
  heightAt(x, z) {
    const L = this.L;
    const cx = Math.min(this.maxX - 1e-4, Math.max(this.minX, x)), cz = Math.min(this.maxZ - 1e-4, Math.max(this.minZ, z));
    return this.cellH(L.cellOf(cx, cz), cx, cz);
  }
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.12, dx = this.heightAt(x + e, z) - this.heightAt(x - e, z), dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-dx, 2 * e, -dz).normalize();
  }
  // yol bulma / doğuş için eğim. Dikey duvar kenarındaki hücreler (iki yanı) dik sayılır → botlar duvar dibine / kenar üstüne yol çizmez,
  // 0,55–0,75 m'lik (fizikte duvar, yol bulmada basamak sanılan) kenarlar da kapanır.
  slopeAt(x, z, e = 0.5) {
    const L = this.L, k = L.cellOf(x, z);
    if (this.exempt(x, z)) return 0;
    if (k >= 0 && this.wallNear[k]) return 2;
    const h0 = this.heightAt(x, z);
    const hs = (px, pz) => { const m = L.cellOf(px, pz); return m >= 0 && L.type[m] === T_FLOOR ? this.heightAt(px, pz) : h0; };     // bina hücresine taşan örnek eğim saymaz (duvar = kütle kutusu)
    const dx = (hs(x + e, z) - hs(x - e, z)) / (2 * e), dz = (hs(x, z + e) - hs(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }
  // istinat duvarı katı hacim (FrontTerrain.pushOut ile aynı sözleşme; World.move her eksen adımında ve inişte çağırır)
  pushOut(p, r, climb, axis = null, maxPush = 1) {
    const L = this.L, c = L.C, y = p.y + climb;
    const i0 = Math.floor((p.x - r - L.x0) / c), i1 = Math.floor((p.x + r - L.x0) / c);
    const j0 = Math.floor((p.z - r - L.z0) / c), j1 = Math.floor((p.z + r - L.z0) / c);
    let moved = false;
    for (let j = Math.max(0, j0); j <= Math.min(L.nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(L.nx - 1, i1); i++) {
      const k = j * L.nx + i;
      if (L.type[k] !== T_FLOOR) continue;                                       // bina / dış: kütle kutuları
      const x0 = L.x0 + i * c, x1 = x0 + c, z0 = L.z0 + j * c, z1 = z0 + c;
      if (p.x + r <= x0 + 1e-6 || p.x - r >= x1 - 1e-6 || p.z + r <= z0 + 1e-6 || p.z - r >= z1 - 1e-6) continue;
      const inX = p.x >= x0 && p.x < x1, inZ = p.z >= z0 && p.z < z1;
      if (inX && inZ) continue;
      const nx = Math.min(Math.max(p.x, x0 + 1e-4), x1 - 1e-4), nz = Math.min(Math.max(p.z, z0 + 1e-4), z1 - 1e-4);
      if (this.cellH(k, nx, nz) <= y) continue;
      const px = inX ? Infinity : p.x < x0 ? x0 - r - 1e-4 - p.x : x1 + r + 1e-4 - p.x;
      const pz = inZ ? Infinity : p.z < z0 ? z0 - r - 1e-4 - p.z : z1 + r + 1e-4 - p.z;
      let ax = axis;
      if (ax === 'x' && inX) continue;
      if (ax === 'z' && inZ) continue;
      if (!ax) ax = Math.abs(px) <= Math.abs(pz) ? 'x' : 'z';
      const d = ax === 'x' ? px : pz, dd = Math.max(-maxPush, Math.min(maxPush, d));
      if (ax === 'x') p.x += dd; else p.z += dd;
      moved = true;
    }
    return moved;
  }
  // Işın: hücre hücre (DDA). Hücreye girerken ışın yüzeyin altındaysa giriş noktasında dikey duvara çarpar; hücre içinde yüzey kesişimi örnekleme + ikiye bölme.
  raycast(o, d, maxT, out) {
    const L = this.L, C = L.C;
    if (o.y < this.heightAt(o.x, o.z) - 1e-3) return null;
    let i = Math.floor((o.x - L.x0) / C), j = Math.floor((o.z - L.z0) / C);
    const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(d.x) > 1e-9 ? C / Math.abs(d.x) : Infinity, tdz = Math.abs(d.z) > 1e-9 ? C / Math.abs(d.z) : Infinity;
    let tx = Math.abs(d.x) > 1e-9 ? ((L.x0 + (i + (sx > 0 ? 1 : 0)) * C) - o.x) / d.x : Infinity;
    let tz = Math.abs(d.z) > 1e-9 ? ((L.z0 + (j + (sz > 0 ? 1 : 0)) * C) - o.z) / d.z : Infinity;
    let t0 = 0, wallAxis = -1;
    const top = this.top + 0.05;
    for (let it = 0; it < 4000; it++) {
      const t1 = Math.min(tx, tz, maxT), k = i < 0 || j < 0 || i >= L.nx || j >= L.nz ? -1 : j * L.nx + i;
      if (k < 0) return null;
      const y0 = o.y + d.y * t0;
      if (y0 > top && d.y >= 0) return null;
      const H = (t) => this.cellH(k, Math.min(L.x0 + (i + 1) * C - 1e-5, Math.max(L.x0 + i * C, o.x + d.x * t)), Math.min(L.z0 + (j + 1) * C - 1e-5, Math.max(L.z0 + j * C, o.z + d.z * t)));
      if (t0 > 0 && y0 < H(t0 + 1e-6)) return this._hit(o, d, t0, wallAxis, sx, sz, out);
      // hücre içi: 4 örnek + ikiye bölme
      let a = t0, fa = y0 - H(t0 + 1e-6);
      for (let q = 1; q <= 4; q++) {
        const b = t0 + (t1 - t0) * q / 4, fb = o.y + d.y * b - H(b);
        if (fb < 0) {
          let lo = a, hi = b;
          for (let r = 0; r < 12; r++) { const mid = (lo + hi) / 2; if (o.y + d.y * mid - H(mid) < 0) hi = mid; else lo = mid; }
          return this._hit(o, d, hi, -1, sx, sz, out);
        }
        a = b; fa = fb;
      }
      if (t1 >= maxT) return null;
      if (tx < tz) { t0 = tx; tx += tdx; i += sx; wallAxis = 0; } else { t0 = tz; tz += tdz; j += sz; wallAxis = 2; }
    }
    return null;
  }
  _hit(o, d, t, wallAxis, sx, sz, out) {
    out.t = t;
    out.point = (out.point || new THREE.Vector3()).set(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
    if (wallAxis === 0) out.normal = (out.normal || new THREE.Vector3()).set(-sx, 0, 0);
    else if (wallAxis === 2) out.normal = (out.normal || new THREE.Vector3()).set(0, 0, -sz);
    else out.normal = this.normalAt(out.point.x, out.point.z, out.normal || new THREE.Vector3());
    return out;
  }
}
