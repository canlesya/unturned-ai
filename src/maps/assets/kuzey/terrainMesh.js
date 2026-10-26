import * as THREE from 'three';
import { SURF, fbm, outerHeight } from './terrain.js';
import { makeTerrainMaterial } from './terrainMat.js';

// Kuzey Vadisi arazi ağı (12.172, yalnız istemci):
// - Oynanır alan 8 × 8 yığın (200 m). Her yığının 4 ayrıntı kademesi (adım 1 / 2 / 4 / 10 hücre = 2 / 4 / 8 / 20 m); kademe kameraya uzaklıkla seçilir.
//   L0 (yakın) fizik ızgarasının kendisi, aynı köşegen → ayağının altındaki / nişan aldığın zemin = çarpışma. Kademeler arası çatlak etek (skirt) ile kapanır.
// - Harita dışı (uzak manzara) 1600 m karolar: yakın halka 20 m, uzak halka 80 m; kendi "hava perspektifi" sisiyle (dağ silueti 5 km'ye kadar seçilir).
// Paylaşılan indeks tamponu (kademe başına bir), köşe başına renk + aW (kaya / çimen / yol / tarla ağırlığı) + AO.

export const CHUNK = 200;
const STRIDES = [1, 2, 4, 10];

// yüzey renk paleti (sRGB) + ayrıntı ağırlığı [kaya, çimen, yol, tarla]
const PAL = {
  [SURF.GRASS]: ['#6b7d3f', [0, 1, 0, 0]], [SURF.MEADOW]: ['#7d8a46', [0, 1, 0, 0]], [SURF.FOREST]: ['#4b5530', [0, 0.7, 0, 0]],
  [SURF.WHEAT]: ['#b09a55', [0, 0.2, 0, 1]], [SURF.PLOW]: ['#6e5a40', [0, 0, 0, 1]], [SURF.DIRT]: ['#83704f', [0, 0, 0.6, 0]],
  [SURF.ASPHALT]: ['#4a4b4d', [0, 0, 1, 0]], [SURF.GRAVEL]: ['#8a8477', [0, 0, 0.5, 0]], [SURF.ROCK]: ['#77736a', [1, 0, 0, 0]],
  [SURF.SAND]: ['#9a8b6c', [0, 0, 0.2, 0]], [SURF.BED]: ['#5e5848', [0.3, 0, 0, 0]], [SURF.SNOW]: ['#e8edf2', [0.2, 0, 0, 0]], [SURF.CONC]: ['#8f8d87', [0, 0, 0.8, 0]],
};
const PALC = {}; for (const k in PAL) PALC[k] = new THREE.Color(PAL[k][0]);

export class TerrainMesh {
  constructor(T, { quality = 'high' } = {}) {
    this.T = T; this.group = new THREE.Group(); this.group.name = 'kuzey-arazi';
    this.mat = makeTerrainMaterial(false);
    this.outerMat = makeTerrainMaterial(true);
    this.nc = Math.round((T.maxX - T.minX) / CHUNK);
    this.cpc = CHUNK / T.cell;                                     // yığın başına hücre (100)
    this.lodD = quality === 'low' ? [110, 260, 520] : [190, 430, 820];
    this.quality = quality;
    this._ao = this._bakeAO();
    this.idx = STRIDES.map((s) => this._index(this.cpc / s));
    this.chunks = [];
    for (let cj = 0; cj < this.nc; cj++) for (let ci = 0; ci < this.nc; ci++) {
      const x0 = T.minX + ci * CHUNK, z0 = T.minZ + cj * CHUNK;
      const ch = { ci, cj, x0, z0, lod: -1, meshes: [] };
      this.chunks.push(ch);
      for (let l = 1; l < STRIDES.length; l++) ch.meshes[l] = this._chunkMesh(ch, l);   // L0 ilk yaklaşmada kurulur (bellek)
    }
    this._outer();
    this.update(new THREE.Vector3(0, 50, 0), true);
  }

  // basit ortam örtmesi: köşe, 6 / 18 m çevresinin ortalamasından ne kadar alçaksa o kadar koyu (vadi dibi / kuytu), sırtlar hafif açık
  _bakeAO() {
    const T = this.T, { nx, nz, h } = T, ao = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let s1 = 0, s2 = 0;
      for (const [di, dj] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) s1 += T.vh(i + di, j + dj);
      for (const [di, dj] of [[9, 0], [-9, 0], [0, 9], [0, -9], [6, 6], [-6, 6], [6, -6], [-6, -6]]) s2 += T.vh(i + di, j + dj);
      const y = h[j * nx + i], c = (s1 / 4 - y) * 0.6 + (s2 / 8 - y) * 0.25;
      ao[j * nx + i] = Math.max(0.62, Math.min(1.08, 1 - c * 0.06));
    }
    return ao;
  }

  _index(n) {
    const v = (i, j) => j * (n + 1) + i, idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1); idx.push(a, d, b, a, c, d); }
    // etek: 4 kenar × n parça; etek köşeleri ızgara köşelerinden sonra (kenar sırası: üst j=0, alt j=n, sol i=0, sağ i=n)
    const base = (n + 1) * (n + 1);
    const edges = [[(k) => v(k, 0), 0, true], [(k) => v(k, n), 1, false], [(k) => v(0, k), 2, false], [(k) => v(n, k), 3, true]];
    for (const [ev, e, flip] of edges) for (let k = 0; k < n; k++) {
      const a = ev(k), b = ev(k + 1), sa = base + e * (n + 1) + k, sb = sa + 1;
      if (flip) idx.push(a, b, sb, a, sb, sa); else idx.push(a, sb, b, a, sa, sb);
    }
    return idx;
  }

  _chunkMesh(ch, l) {
    const T = this.T, s = STRIDES[l], n = this.cpc / s, N = (n + 1) * (n + 1), NS = N + 4 * (n + 1);
    const pos = new Float32Array(NS * 3), nor = new Float32Array(NS * 3), col = new Float32Array(NS * 3), w = new Uint8Array(NS * 4), rd = new Int8Array(NS * 2);
    const exactRoad = l <= 1 && T.redge;                          // L0 / L1: yol kenarı gölgelendiricide uzaklıktan (keskin, merdivensiz); uzak kademede köşe rengi
    const i0 = ch.ci * this.cpc, j0 = ch.cj * this.cpc, c = new THREE.Color();
    const put = (q, i, j, drop) => {
      const gi = i0 + i * s, gj = j0 + j * s, k = gj * T.nx + gi;
      pos[q * 3] = T.minX + gi * T.cell; pos[q * 3 + 1] = T.h[k] - drop; pos[q * 3 + 2] = T.minZ + gj * T.cell;
      const dx = T.vh(gi + 1, gj) - T.vh(gi - 1, gj), dz = T.vh(gi, gj + 1) - T.vh(gi, gj - 1), L = Math.hypot(dx, 2 * T.cell, dz);
      nor[q * 3] = -dx / L; nor[q * 3 + 1] = 2 * T.cell / L; nor[q * 3 + 2] = -dz / L;
      this._color(T.surf[k], pos[q * 3], pos[q * 3 + 2], T.h[k], nor[q * 3 + 1], c, w, q, exactRoad, k);
      if (exactRoad) { rd[q * 2] = T.redge[k]; rd[q * 2 + 1] = T.rtype[k] * 40; }
      c.multiplyScalar(this._ao[k]);
      col[q * 3] = c.r; col[q * 3 + 1] = c.g; col[q * 3 + 2] = c.b;
    };
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) put(j * (n + 1) + i, i, j, 0);
    const sk = l === 0 ? 1.5 : 3 + s * 1.5;
    for (let k = 0; k <= n; k++) { put(N + k, k, 0, sk); put(N + (n + 1) + k, k, n, sk); put(N + 2 * (n + 1) + k, 0, k, sk); put(N + 3 * (n + 1) + k, n, k, sk); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aW', new THREE.BufferAttribute(w, 4, true));
    g.setAttribute('aRoad', new THREE.BufferAttribute(rd, 2, true));
    g.setIndex(this.idx[l]);
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, this.mat);
    m.receiveShadow = true; m.castShadow = false; m.visible = false; m.userData.terrain = true; m.userData.lod = l;
    this.group.add(m);
    return m;
  }

  // köşe rengi (doğrusal) + ayrıntı ağırlığı. Kıyı kumu / dere tabanı / kaya kesintisiz (kot / eğimden), yol: yakında gölgelendirici (exact), uzakta köşe rengi.
  _color(sf, x, z, y, ny, c, w, q, exact = false, k = -1) {
    const T = this.T;
    let base = sf;
    if (sf === SURF.ASPHALT || sf === SURF.DIRT || sf === SURF.GRAVEL || sf === SURF.SAND || sf === SURF.BED) base = SURF.GRASS;      // alttaki zemin (yol / kıyı aşağıda karışır)
    const P = PAL[base] || PAL[SURF.GRASS];
    c.copy(PALC[base] || PALC[SURF.GRASS]);
    const n1 = fbm(x / 70, z / 70, 101, 2), n2 = fbm(x / 23, z / 23, 107, 2);
    if (base === SURF.GRASS || base === SURF.MEADOW || base === SURF.FOREST) {
      c.offsetHSL((n1 - 0.5) * 0.05, (n2 - 0.5) * 0.12, (n1 - 0.5) * 0.08 + (n2 - 0.5) * 0.04);
      if (y > 60) c.lerp(PALC[SURF.ROCK], Math.min(0.5, (y - 60) / 200));
    } else c.offsetHSL(0, 0, (n2 - 0.5) * 0.06);
    const rk = ny < 0.86 ? Math.min(1, (0.86 - ny) * 3.2) : 0;
    if (rk) c.lerp(PALC[SURF.ROCK], rk);
    const sand = Math.max(0, Math.min(1, (1.5 - y) / 1.1)), bed = Math.max(0, Math.min(1, (0.1 - y) / 0.7));
    if (sand) c.lerp(PALC[SURF.SAND], sand * 0.9);
    if (bed) c.lerp(PALC[SURF.BED], bed);
    if (y < 1.6 && y > -0.3) c.multiplyScalar(0.84 + 0.16 * Math.min(1, (y + 0.3) / 1.9));    // ıslak kıyı
    let ww = [P[1][0], P[1][1] * (1 - sand), 0, P[1][3]];
    if (!exact && k >= 0 && T.redge && T.rtype[k]) {                                          // uzak kademe: yol köşe renginde
      const e = T.redge[k] / 32, m = 1 - Math.max(0, Math.min(1, (e + 0.6) / 1.2)), t = T.rtype[k];
      c.lerp(t === 2 ? PALC[SURF.DIRT] : PALC[SURF.ASPHALT], m); ww = [ww[0] * (1 - m), ww[1] * (1 - m), m * 0.6, ww[3] * (1 - m)];
    }
    w[q * 4] = Math.round(255 * Math.max(ww[0], rk)); w[q * 4 + 1] = Math.round(255 * ww[1] * (1 - rk)); w[q * 4 + 2] = Math.round(255 * ww[2]); w[q * 4 + 3] = Math.round(255 * ww[3]);
  }

  // harita dışı: 1600 m karolar (merkez yok), yakın halka 20 m / uzak 80 m, kendi sisi; karo başına ağ (kamera dışı kalanlar çizilmez)
  _outer() {
    const T = this.T, S = 1600, R = 3, c = new THREE.Color(), cR = new THREE.Color('#6e675d'), cS = new THREE.Color('#eef2f6'), cF = new THREE.Color('#2f3d24'), cG = new THREE.Color('#5f7238'), cA = new THREE.Color('#7f8448');
    this.outer = [];
    for (let tj = -R; tj <= R; tj++) for (let ti = -R; ti <= R; ti++) {
      if (!ti && !tj) continue;
      const near = Math.max(Math.abs(ti), Math.abs(tj)) === 1, st = near ? (this.quality === 'low' ? 40 : 20) : (this.quality === 'low' ? 160 : 80), n = S / st, x0 = ti * S - S / 2, z0 = tj * S - S / 2;
      const N = (n + 1) * (n + 1), NS = N + 4 * (n + 1), pos = new Float32Array(NS * 3), col = new Float32Array(NS * 3), w = new Uint8Array(NS * 4), hh = new Float32Array((n + 3) * (n + 3));
      const H = (i, j) => hh[(j + 1) * (n + 3) + (i + 1)];
      for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
        const x = x0 + i * st, z = z0 + j * st;
        hh[(j + 1) * (n + 3) + (i + 1)] = Math.abs(x) <= 800 && Math.abs(z) <= 800 ? T.heightAt(x, z) : outerHeight(x, z);
      }
      const nor = new Float32Array(NS * 3);
      const put = (q, i, j, drop) => {
        const x = x0 + i * st, z = z0 + j * st, y = H(i, j);
        pos[q * 3] = x; pos[q * 3 + 1] = y - drop; pos[q * 3 + 2] = z;
        const dx = H(i + 1, j) - H(i - 1, j), dz = H(i, j + 1) - H(i, j - 1), L = Math.hypot(dx, 2 * st, dz), ny = 2 * st / L;
        nor[q * 3] = -dx / L; nor[q * 3 + 1] = ny; nor[q * 3 + 2] = -dz / L;
        // 12.172 dağ katmanları: orman (ağaç sınırı ~650 m, gürültülü) → alpin çayır → kaya (dik / yüksek; çizgili dere yatakları) → kar (yalnız yatık yüzeyde)
        const n1 = fbm(x / 400, z / 400, 131, 3), fo = fbm(x / 260, z / 260, 137, 3), st2 = fbm(x / 90 + z / 300, z / 90, 141, 3);
        const tl = 620 + (n1 - 0.5) * 300, forestK = Math.min(1, Math.max(0, (fo - 0.3) * 2.6)) * (1 - Math.min(1, Math.max(0, (y - tl) / 90)));
        c.copy(cG).lerp(cA, Math.min(1, Math.max(0, (y - tl + 60) / 260)));
        c.lerp(cF, forestK);
        const rockK = Math.min(1, Math.max(0, (0.86 - ny) * 3.2 + (y - 1000) / 420));
        c.lerp(cR, rockK); if (rockK > 0.2) c.multiplyScalar(0.72 + 0.4 * st2);
        const snowLine = 1150 + (n1 - 0.5) * 420;
        if (y > snowLine) c.lerp(cS, Math.min(1, (y - snowLine) / 120) * Math.min(1, Math.max(0, (ny - 0.6) * 3.2)) * (0.6 + 0.6 * st2));
        if (y < 0.5) c.set('#4e4a3c');
        c.offsetHSL(0, 0, (n1 - 0.5) * 0.06);
        col[q * 3] = c.r; col[q * 3 + 1] = c.g; col[q * 3 + 2] = c.b;
        const rk = Math.min(1, Math.max(0, (0.9 - ny) * 3));
        w[q * 4] = Math.round(255 * rk); w[q * 4 + 1] = Math.round(255 * (1 - rk) * 0.6);
      };
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) put(j * (n + 1) + i, i, j, 0);
      for (let k = 0; k <= n; k++) { put(N + k, k, 0, st * 0.6); put(N + (n + 1) + k, k, n, st * 0.6); put(N + 2 * (n + 1) + k, 0, k, st * 0.6); put(N + 3 * (n + 1) + k, n, k, st * 0.6); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aW', new THREE.BufferAttribute(w, 4, true));
      g.setIndex(this._index(n));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.outerMat); m.receiveShadow = false; m.userData.terrain = true; m.userData.outer = true;
      this.group.add(m); this.outer.push(m);
    }
  }

  // kamera konumuna göre yığın kademeleri (her karede ucuz: 64 yığın)
  update(cam, force = false) {
    const D = this.lodD;
    for (const ch of this.chunks) {
      const dx = Math.max(ch.x0 - cam.x, 0, cam.x - ch.x0 - CHUNK), dz = Math.max(ch.z0 - cam.z, 0, cam.z - ch.z0 - CHUNK), d = Math.hypot(dx, dz, Math.max(0, cam.y - 120) * 0.5);
      const cur = ch.lod;
      let l = d < D[0] ? 0 : d < D[1] ? 1 : d < D[2] ? 2 : 3;
      if (!force && cur >= 0 && l !== cur) {                     // 12 m gecikme payı (sınırda gidip gelme olmasın)
        const lo = cur === 0 ? D[0] : D[cur - 1] ?? 0, hi = D[cur] ?? 1e9;
        if (d > lo - 12 && d < hi + 12 && Math.abs(l - cur) === 1) l = cur;
      }
      if (l === cur && !force) continue;
      if (!ch.meshes[l]) ch.meshes[l] = this._chunkMesh(ch, l);
      for (let k = 0; k < ch.meshes.length; k++) if (ch.meshes[k]) ch.meshes[k].visible = k === l;
      ch.lod = l;
    }
  }
}
