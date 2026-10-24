import * as THREE from 'three';

// Batı Cephesi arazisi (12.158): düzenli ızgara (hücre 2 m) + KESİK hücreler (siper / sığınak tabanı, rampa).
// - Tarla hücresi: köşe yüksekliklerinden iki düz üçgen (çizilen ağla aynı köşegen) → yürüme / mermi / yol bulma görünen yüzeyi okur.
// - Kesik hücre: düz taban (fl) ya da rampa (taban → komşu tarla kenarı). Hücreler arası kenarda iki yanın yüksekliği farklıysa DİKEY duvar
//   (ağda dikey dörtgen, fizikte wallAt: içeriden kenara tırmanılmaz). Böylece siperin çarpışması görselle birebir: duvar = arazi kenarı, görünmez kutu yok.
// - aKind (yüzey gölgelendiricisi, cepheSurface.js): tarla / çamur / ördek tahtası / kum torbası / kalas / beton / ham toprak; hücre başına duvar kaplaması (rv).
export const TK = { FIELD: 1, MUD: 2, DUCKX: 3, DUCKZ: 4, SANDBAG: 5, PLANK: 6, CONC: 9, EARTH: 15 };

export class FrontTerrain {
  constructor({ minX, maxX, minZ, maxZ, cell = 2, base }) {
    this.minX = minX; this.minZ = minZ; this.cell = cell;
    this.nx = Math.round((maxX - minX) / cell) + 1; this.nz = Math.round((maxZ - minZ) / cell) + 1;
    this.maxX = minX + (this.nx - 1) * cell; this.maxZ = minZ + (this.nz - 1) * cell;
    this.cw = this.nx - 1; this.ch = this.nz - 1;
    this.h = new Float32Array(this.nx * this.nz);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) this.h[j * this.nx + i] = base(minX + i * cell, minZ + j * cell);
    const N = this.cw * this.ch;
    this.cut = new Uint8Array(N);            // 0 tarla · 1 düz taban · 2 rampa
    this.fl = new Float32Array(N);           // taban kotu
    this.rd = new Uint8Array(N);             // rampa yönü: 0 +x · 1 −x · 2 +z · 3 −z (o yöne yükselir)
    this.rv = new Uint8Array(N);             // duvar kaplaması (TK): bu kesik hücrenin duvarları
    this.fk = new Uint8Array(N);             // taban yüzeyi (TK)
    this.deepWater = -1e9; this.navMin = -9;  // su yok: siper tabanı sıfırın altında yürünür
  }
  ci(x, z) { return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)]; }
  vh(i, j) { return this.h[Math.max(0, Math.min(this.nz - 1, j)) * this.nx + Math.max(0, Math.min(this.nx - 1, i))]; }
  isCut(i, j) { return i >= 0 && j >= 0 && i < this.cw && j < this.ch && this.cut[j * this.cw + i] > 0; }
  // dünya dikdörtgenini (hücre sınırlarına yuvarlanır) kes
  carve(x0, z0, x1, z1, fl, rv = TK.EARTH, fk = TK.MUD) {
    const [i0, j0] = this.ci(Math.min(x0, x1) + 0.01, Math.min(z0, z1) + 0.01), [i1, j1] = this.ci(Math.max(x0, x1) - 0.01, Math.max(z0, z1) - 0.01);
    for (let j = Math.max(0, j0); j <= Math.min(this.ch - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(this.cw - 1, i1); i++) {
      const c = j * this.cw + i;
      if (this.cut[c] === 2) continue;                                   // rampa korunur
      if (this.cut[c] === 1 && this.fl[c] <= fl) continue;               // daha derin taban korunur
      this.cut[c] = 1; this.fl[c] = fl; this.rv[c] = rv; this.fk[c] = fk;
    }
  }
  ramp(x, z, dir, fl, rv = TK.EARTH) { const [i, j] = this.ci(x, z), c = j * this.cw + i; this.cut[c] = 2; this.fl[c] = fl; this.rd[c] = dir; this.rv[c] = rv; this.fk[c] = TK.MUD; }

  // hücre (i, j) içindeki yüzeyin (u, v) yerel noktadaki kotu
  _cellH(i, j, u, v) {
    const c = j * this.cw + i, k = this.cut[c];
    if (k === 1) return this.fl[c];
    if (k === 2) {
      const d = this.rd[c], f = this.fl[c];
      const t = d === 0 ? u : d === 1 ? 1 - u : d === 2 ? v : 1 - v;
      const e = d === 0 ? this.vh(i + 1, j) * (1 - v) + this.vh(i + 1, j + 1) * v : d === 1 ? this.vh(i, j) * (1 - v) + this.vh(i, j + 1) * v
        : d === 2 ? this.vh(i, j + 1) * (1 - u) + this.vh(i + 1, j + 1) * u : this.vh(i, j) * (1 - u) + this.vh(i + 1, j) * u;
      return f + (e - f) * t;
    }
    const a = this.vh(i, j), b = this.vh(i + 1, j), cc = this.vh(i, j + 1), d = this.vh(i + 1, j + 1);
    if ((i + j) & 1) return u + v <= 1 ? a + (b - a) * u + (cc - a) * v : d + (cc - d) * (1 - u) + (b - d) * (1 - v);      // köşegen b–c
    return u >= v ? a + (b - a) * u + (d - b) * v : a + (d - cc) * u + (cc - a) * v;                                        // köşegen a–d
  }
  heightAt(x, z) {
    let fx = (x - this.minX) / this.cell, fz = (z - this.minZ) / this.cell;
    fx = Math.max(0, Math.min(this.cw - 0.0001, fx)); fz = Math.max(0, Math.min(this.ch - 0.0001, fz));
    const i = Math.floor(fx), j = Math.floor(fz);
    return this._cellH(i, j, fx - i, fz - j);
  }
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.25, dx = this.heightAt(x + e, z) - this.heightAt(x - e, z), dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-dx, 2 * e, -dz).normalize();
  }
  slopeAt(x, z, e = 0.5) {
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e), dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }
  // siper duvarı: içeriden (yerde ya da zıplarken) kenara tırmanılmaz — yalnız rampadan çıkılır (World.move kancası)
  wallAt(x, z, y) { return this.heightAt(x, z) > y + 0.55; }

  // Işın - arazi: 0,35 m adım + ikili arama (siper kenarı / sırt kaçmasın). Işın en yüksek köşenin üstündeyse erken biter.
  raycast(o, d, maxT, out) {
    const step = 0.35, top = this._top ??= this.h.reduce((m, v) => Math.max(m, v), -1e9);
    let t0 = 0, f0 = o.y - this.heightAt(o.x, o.z);
    if (f0 < 0) return null;
    for (let t = step; t <= maxT + step; t += step) {
      const tt = Math.min(t, maxT), y = o.y + d.y * tt;
      if (y > top + 0.01 && d.y >= 0) return null;                    // yukarı giden ve en yüksek noktanın üstündeki ışın bir daha inmez
      const x = o.x + d.x * tt, z = o.z + d.z * tt;
      if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ) return null;
      const f = y - this.heightAt(x, z);
      if (f < 0) {
        let lo = t0, hi = tt;
        for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; if (o.y + d.y * mid - this.heightAt(o.x + d.x * mid, o.z + d.z * mid) < 0) hi = mid; else lo = mid; }
        out.t = hi;
        out.point = (out.point || new THREE.Vector3()).set(o.x + d.x * hi, o.y + d.y * hi, o.z + d.z * hi);
        // dikey siper duvarına çarpan ışın: normal yatay (iz / kıvılcım duvara dik)
        const p = out.point, hb = this.heightAt(p.x - d.x * 0.08, p.z - d.z * 0.08);
        if (p.y < hb - 0.04 || Math.abs(this.heightAt(p.x, p.z) - hb) > 0.3) out.normal = (out.normal || new THREE.Vector3()).set(-d.x, 0, -d.z).normalize();
        else out.normal = this.normalAt(p.x, p.z, out.normal || new THREE.Vector3());
        return out;
      }
      t0 = tt;
      if (tt >= maxT) break;
    }
    return null;
  }

  // Ağ: tarla üçgenleri + kesik hücre tabanları + hücreler arası dikey duvarlar. colorFn(x, z, h, kind, out) köşe rengi; kind → aKind.
  buildMesh(colorFn, kindFn) {
    const { cw, ch, cell, minX, minZ } = this, pos = [], col = [], kd = [], c = new THREE.Color();
    const push = (x, y, z, k) => { pos.push(x, y, z); colorFn(x, z, y, k, c); col.push(c.r, c.g, c.b); kd.push(k); };
    const tri = (A, B, C, k) => { push(...A, k); push(...B, k); push(...C, k); };
    const X = (i) => minX + i * cell, Z = (j) => minZ + j * cell;
    // hücre (i,j) yüzeyinin köşe kotu: kesik hücrede taban / rampa, tarlada köşe
    const cornerH = (i, j, ci, cj) => this._cellH(i, j, ci - i, cj - j);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const cc = j * cw + i, k = this.cut[cc];
      const P = (a, b) => [X(a), cornerH(i, j, a, b), Z(b)];
      if (k === 0) {
        const kk = kindFn ? kindFn(X(i) + cell / 2, Z(j) + cell / 2) : TK.FIELD;
        const a = P(i, j), b = P(i + 1, j), d = P(i, j + 1), e = P(i + 1, j + 1);
        if ((i + j) & 1) { tri(a, d, b, kk); tri(b, d, e, kk); } else { tri(a, d, e, kk); tri(a, e, b, kk); }
      } else {
        const fk = k === 2 ? TK.MUD : this.fk[cc];
        const a = P(i, j), b = P(i + 1, j), d = P(i, j + 1), e = P(i + 1, j + 1);
        tri(a, d, e, fk); tri(a, e, b, fk);
      }
    }
    // duvarlar: her iç kenarda iki yanın kotu farklıysa dikey dörtgen (alçak yana bakar); kaplama = kesik hücrenin rv'si
    const wall = (x0, z0, x1, z1, lo0, hi0, lo1, hi1, k, nx, nz) => {
      if (hi0 - lo0 < 0.004 && hi1 - lo1 < 0.004) return;
      const A = [x0, lo0, z0], B = [x1, lo1, z1], C = [x1, hi1, z1], D = [x0, hi0, z0];
      // sarım: (B−A)×(C−A) ∝ (−uz, 0, ux) → normal (nx, nz) yönüne baksın
      const ux = x1 - x0, uz = z1 - z0;
      if (-uz * nx + ux * nz > 0) { tri(A, B, C, k); tri(A, C, D, k); } else { tri(A, C, B, k); tri(A, D, C, k); }
    };
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      // sağ kenar (i+1 çizgisi) ve alt kenar (j+1 çizgisi)
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        const i2 = i + di, j2 = j + dj;
        if (i2 >= cw || j2 >= ch) continue;
        const ka = this.cut[j * cw + i], kb = this.cut[j2 * cw + i2];
        if (!ka && !kb) continue;
        // kenarın iki ucu
        const [ex0, ez0, ex1, ez1] = di ? [i + 1, j, i + 1, j + 1] : [i, j + 1, i + 1, j + 1];
        const ha0 = cornerH(i, j, ex0, ez0), ha1 = cornerH(i, j, ex1, ez1), hb0 = cornerH(i2, j2, ex0, ez0), hb1 = cornerH(i2, j2, ex1, ez1);
        const lowA = ha0 + ha1 < hb0 + hb1;                                    // duvar alçak yana bakar
        const rvk = ka && (!kb || lowA) ? this.rv[j * cw + i] : this.rv[j2 * cw + i2];
        const nX = di ? (lowA ? -1 : 1) : 0, nZ = dj ? (lowA ? -1 : 1) : 0;
        wall(X(ex0), Z(ez0), X(ex1), Z(ez1), Math.min(ha0, hb0), Math.max(ha0, hb0), Math.min(ha1, hb1), Math.max(ha1, hb1), rvk || TK.EARTH, nX, nZ);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(new Uint8Array(kd), 1));
    g.computeVertexNormals();
    return g;
  }
}
