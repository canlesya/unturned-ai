import * as THREE from 'three';

// Çöl Geçidi sanatı: duvar cepheleri (sıva, kaide, korniş, kiriş uçları, pencere, kapı, tente), zemin boyası (gölge / desen), dış siluet.
// Hepsi görsel (çarpışmasız) ve köşe renkli kutulardır: MapBuilder tek mesh'te birleştirir.
export const rngOf = (seed) => { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };

// duvar ızgarası: dikdörtgenlerden 0,5 m'lik katı maskesi + uzaklık alanı (zemin gölgesi, genişlik sorguları için)
export function makeSolidField(D) {
  const C = D.cell, nx = D.nx, nz = D.nz, x0 = D.x0, z0 = D.z0;
  const solid = new Uint8Array(nx * nz);
  for (const [a, b, c, d] of [...D.rects, ...(D.divs || [])]) {
    const i0 = Math.max(0, Math.round((a - x0) / C)), i1 = Math.min(nx, Math.round((c - x0) / C)), j0 = Math.max(0, Math.round((b - z0) / C)), j1 = Math.min(nz, Math.round((d - z0) / C));
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) solid[j * nx + i] = 1;
  }
  const dist = new Float32Array(nx * nz);
  for (let k = 0; k < dist.length; k++) dist[k] = solid[k] ? 0 : 99;
  const A = 1, B = 1.4142;                                                    // iki geçişli yaklaşık (chamfer) uzaklık dönüşümü, hücre cinsinden
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = dist[k];
    if (i > 0) v = Math.min(v, dist[k - 1] + A);
    if (j > 0) { v = Math.min(v, dist[k - nx] + A); if (i > 0) v = Math.min(v, dist[k - nx - 1] + B); if (i < nx - 1) v = Math.min(v, dist[k - nx + 1] + B); }
    dist[k] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = dist[k];
    if (i < nx - 1) v = Math.min(v, dist[k + 1] + A);
    if (j < nz - 1) { v = Math.min(v, dist[k + nx] + A); if (i < nx - 1) v = Math.min(v, dist[k + nx + 1] + B); if (i > 0) v = Math.min(v, dist[k + nx - 1] + B); }
    dist[k] = v;
  }
  const at = (x, z) => { const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C); return i < 0 || j < 0 || i >= nx || j >= nz ? 0 : dist[j * nx + i] * C; };
  const isSolid = (x, z) => { const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C); return i < 0 || j < 0 || i >= nx || j >= nz ? true : solid[j * nx + i] === 1; };
  // (x,z)'den (dx,dz) yönünde ilk duvara kadar serbest uzunluk (m)
  const clearance = (x, z, dx, dz, max = 20) => { for (let t = 0.5; t <= max; t += 0.5) if (isSolid(x + dx * t, z + dz * t)) return t; return max; };
  return { dist: at, isSolid, clearance };
}

// ── renk paleti: sıva tonları (kum, krem, hardal, kiremit) ──
const PLASTER = ['#d9b878', '#cfa766', '#e3c88f', '#c99a62', '#d8c08a', '#bd8f5a', '#e6d3a4', '#c4a070'];
const DARK = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const DOOR = ['#2d6fa8', '#7a4a2a', '#2f7a6e', '#9a3b2b', '#2d6fa8'];
const AWN = [['#b5402e', '#ecdcb6'], ['#2d6fa8', '#ecdcb6'], ['#c58a2a', '#ecdcb6'], ['#2f7a6e', '#ecdcb6']];
const THETA = [Math.PI / 2, -Math.PI / 2, 0, Math.PI];                         // yüz yönü → dış normal (+x, -x, +z, -z) için ry

// sıva rengi: 9 m'lik bloklara göre (yüz süsü ile duvar gövdesi aynı tonu paylaşır)
export const plasterAt = (x, z) => PLASTER[(Math.abs(Math.floor(x / 9) * 73856093 ^ Math.floor(z / 9) * 19349663) >>> 0) % PLASTER.length];
export const wallTop = (x, z) => DARK(plasterAt(x, z), 0.8);

// ── binalar: çokgen duvarlar + düz çatı (tek tip kum taşı). Çarpışma ayrı (colgecidi.js: D.rects). Halka kenarı p→q için dış normal (dz, −dx).
const WALLC = ['#d4b273', '#cda968', '#d9bb80', '#c9a46a'];
export function polyColorAt(polys, x, z) {                                      // (x, z) noktasını içeren bina parçasının duvar rengi
  for (let k = 0; k < polys.length; k++) {
    const f = polys[k][2][0]; let inside = false;
    for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) if ((f[i + 1] > z) !== (f[j + 1] > z) && x < ((f[j] - f[i]) * (z - f[i + 1])) / (f[j + 1] - f[i + 1]) + f[i]) inside = !inside;
    if (inside) return [WALLC[(polys[k][3] ?? k) % WALLC.length], polys[k][0]];
  }
  return [WALLC[0], null];
}
export function buildPolys(b, polys) {
  const I = new THREE.Matrix4();
  for (let k = 0; k < polys.length; k++) b.obj('bina:' + (polys[k][3] ?? k), () => {
    const [top, base, rings] = polys[k];
    const R = rings.map((f) => { const a = []; for (let i = 0; i < f.length; i += 2) a.push([f[i], f[i + 1]]); return a; });
    const col = WALLC[(polys[k][3] ?? k) % WALLC.length], roof = DARK(col, 0.82);
    const pos = [], nor = [];
    const tri = (a, n) => { for (const v of a) pos.push(v[0], v[1], v[2]); for (let i = 0; i < 3; i++) nor.push(n[0], n[1], n[2]); };
    for (const ring of R) for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], ex = q[0] - p[0], ez = q[1] - p[1], L = Math.hypot(ex, ez);
      if (L < 1e-6) continue;
      const n = [ez / L, 0, -ex / L], A = [p[0], base, p[1]], B = [q[0], base, q[1]], C = [q[0], top, q[1]], Dd = [p[0], top, p[1]];
      tri([A, C, B], n); tri([A, Dd, C], n);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    b.addGeo(wg, col, I);
    // çatı: en büyük halka dış, diğerleri delik
    const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
    let oi = 0; for (let i = 1; i < R.length; i++) if (Math.abs(area(R[i])) > Math.abs(area(R[oi]))) oi = i;
    const outer = R[oi].map(([x, z]) => new THREE.Vector2(x, z)), holes = R.filter((_, i) => i !== oi).map((r) => r.map(([x, z]) => new THREE.Vector2(x, z)));
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(outer, holes); } catch { tris = []; }
    const all = [...outer, ...holes.flat()], rp = [], rn = [];
    for (const [a, c, d] of tris) {
      const A = all[a], C = all[c], E = all[d];
      const cy = (C.y - A.y) * (E.x - A.x) - (C.x - A.x) * (E.y - A.y);
      const T = cy >= 0 ? [A, C, E] : [A, E, C];
      for (const v of T) { rp.push(v.x, top, v.y); rn.push(0, 1, 0); }
    }
    if (rp.length) {
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('normal', new THREE.Float32BufferAttribute(rn, 3));
      b.addGeo(rg, roof, I);
    }
  });
}

// ── cephe süsü (tek tip): her çokgen kenarı ~3 m'lik dilimlere bölünür; kaide, korniş, duvar tepesi şeridi her dilimde; kiriş uçları korniş altında,
//    pencere / kapı / tente yalnız geniş sokaklarda. Hepsi duvar yüzüne yapışık (yerel z ≥ 0), yükseklikler duvar tepesine göre.
// cephenin önü dolu mu: kenar orta noktası (wx, wz), normal (nx, nz), kenar yönü (dx, dz); yarım genişlik hw, derinlik dep, kot y0..y1.
// Çarpışma gövdeleri (başka bina, kapı, çatı, köprü, kat kenarı, sandık) ya da yükselen zemin varsa dolu.
let _cols = null;
function frontBlocked(b, terrain, wx, wz, nx, nz, dx, dz, hw, dep, y0, y1) {
  if (!_cols || _cols.src !== b.colliders.length) { _cols = b.colliders.filter((c) => c.max[1] - c.min[1] > 0.15); _cols.src = b.colliders.length; }
  for (let t = -hw; t <= hw + 1e-6; t += Math.max(0.3, hw / 3)) for (const d of [0.2, Math.max(0.2, dep * 0.5), Math.max(0.2, dep)]) {
    const px = wx + dx * t + nx * d, pz = wz + dz * t + nz * d;
    if (terrain.heightAt(px, pz) > y0 + 0.05) return true;
    for (const c of _cols) if (px > c.min[0] && px < c.max[0] && pz > c.min[2] && pz < c.max[2] && c.max[1] > y0 && c.min[1] < y1) return true;
  }
  return false;
}
export const OCC = [];                                                            // cephede dolu yerler (pencere / kapı / tente / pano): üst üste binmesin
const occFree = (x, z, r) => OCC.every((q) => Math.hypot(q[0] - x, q[1] - z) >= r + q[2]);
export function decorateEdges(b, edges, terrain, field, rng, noDecor = []) {
  const inNo = (x, z) => noDecor.some(([a, c, d, e]) => x >= a && x <= d && z >= c && z <= e);
  const NC = { collide: false }, LIGHT = '#e2c995', COPE = '#c9ad78', BEAM = '#7a5b3a';
  let nWin = 0, nDoor = 0;
  OCC.length = 0;
  edges.forEach(([x0, z0, x1, z1, top], ei) => {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), nx = dz / L, nz = -dx / L, th = Math.atan2(nx, nz);
    const n = Math.max(1, Math.round(L / 3)), seg = L / n;
    const wide = field.clearance((x0 + x1) / 2 + nx * 0.8, (z0 + z1) / 2 + nz * 0.8, nx, nz, 12);
    const hsh = Math.abs(Math.floor(x0 * 7 + z0 * 13)) % 97;
    for (let s = 0; s < n; s++) {
      const t0 = s / n, t1 = (s + 1) / n, tm = (t0 + t1) / 2;
      const wx = x0 + dx * tm, wz = z0 + dz * tm;
      let g = 1e9;
      for (const t of [t0 + 0.02, tm, t1 - 0.02]) g = Math.min(g, terrain.heightAt(x0 + dx * t + nx * 0.4, z0 + dz * t + nz * 0.4));
      const H = top - g;
      if (H < 1.5) continue;
      b.objStack.push(`cephe:${ei}:${s}`);
      const ux = dx / L, uz = dz / L, fb = (y0, y1, hw = seg / 2 - 0.1, dep = 0.9) => frontBlocked(b, terrain, wx, wz, nx, nz, ux, uz, hw, dep, g + y0, g + y1);
      if (fb(0.3, H - 0.2, seg / 2 - 0.05, 0.25)) { b.objStack.pop(); continue; }                     // dilimin önü bir şeyle dolu: hiç süs yok (iç içe görünür)
      const r = rng();
      b.with(wx, g, wz, th, () => {
        b.box(0, H - 0.45, 0.1, seg + 0.02, 0.3, 0.2, LIGHT, NC);                                        // korniş
        b.box(0, H - 0.02, -0.18, seg + 0.04, 0.14, 0.46, COPE, NC);                                     // duvar tepesi şeridi
        if (H > 4.6 && seg > 2.2 && r < 0.38 && !fb(H - 1.0, H - 0.5, 1.1, 0.6)) for (const k of [-1, 0, 1]) b.box(k * 0.9, H - 0.85, 0.25, 0.2, 0.2, 0.5, BEAM, NC);   // kiriş uçları
        if (wide < 3.2 || seg < 2.4 || inNo(wx, wz)) return;
        const cOff = (s + 0.5) * seg, edgeOk = (need) => cOff >= need && L - cOff >= need;                // süs duvar ucundan yeterince içeride (köşede kesilmesin)
        if (H > 5.4 && r > 0.2 && r < 0.6 && edgeOk(1.35) && !fb(2.4, 5.0, 0.95, 1.0)) {                               // pencere
          const wy = 3.0; OCC.push([wx, wz, 0.9]); b.objStack.push(`pencere:${ei}:${s}`);
          b.box(0, wy - 0.1, 0.04, 1.5, 2.1, 0.07, '#b69a68', NC);
          b.box(0, wy, 0.08, 1.1, 1.7, 0.06, rng() < 0.25 ? '#f0c46e' : '#232a31', NC);
          b.box(0, wy - 0.22, 0.18, 1.7, 0.14, 0.36, LIGHT, NC);
          b.objStack.pop(); nWin++;
        } else if (H > 3.6 && r >= 0.6 && r < 0.76 && edgeOk(1.55) && !fb(0.2, 2.7, 1.1, 1.0)) {                        // kapı
          const dc = DOOR[hsh % DOOR.length]; OCC.push([wx, wz, 1.1]); b.objStack.push(`süs-kapı:${ei}:${s}`);
          b.box(0, -0.35, 0.05, 2.0, 3.1, 0.08, '#9c7a4c', NC);
          b.box(0, -0.35, 0.1, 1.55, 2.75, 0.07, dc, NC);
          b.box(0, 2.4, 0.1, 2.3, 0.22, 0.18, LIGHT, NC);
          b.objStack.pop(); nDoor++;
        }
      });
      b.objStack.pop();
    }
  });
  return { nWin, nDoor };
}

// zemin rengi: kum + duvar dibi gölgesi (AO) + yükseklik tonu + saha deseni
export function floorColor(field, D) {
  const sand = new THREE.Color('#dcc592'), sand2 = new THREE.Color('#cfb27a'), dirt = new THREE.Color('#bf9f68'), cool = new THREE.Color('#b9ab8d'), tile1 = new THREE.Color('#d6c29a'), tile2 = new THREE.Color('#c8b185');
  const sites = (D.zones.orange || []).filter((z) => z[2] - z[0] > 6);
  const ledge = new THREE.Color('#c7a56c'), ledgeD = new THREE.Color('#a8885a');
  const tmp = new THREE.Color();
  return (x, z, h, slope, c, n) => {
    c.copy(sand).lerp(sand2, n);
    c.lerp(cool, Math.max(0, Math.min(1, (1.3 - h) / 1.8)) * 0.45);                                   // alçak (tünel / çukur): serin gri-kum
    c.lerp(dirt, Math.max(0, Math.min(1, (h - 2.2) / 1.6)) * 0.55);                                    // yüksek (T avlusu): kuru toprak
    if (x > 42 && x < 62 && z > -52 && z < 3 && Math.floor((x + z) / 1.5) % 2 === 0) c.lerp(tile2.clone().lerp(new THREE.Color('#a9bcc4'), 0.55), 0.55);          // Long: mavi-beyaz karo şeridi
    for (const [a, b, e, f] of sites) if (x > a - 2 && x < e + 2 && z > b - 2 && z < f + 2) {         // saha: karo deseni
      tmp.copy(((Math.floor(x / 1.5) + Math.floor(z / 1.5)) & 1) ? tile1 : tile2); c.lerp(tmp, 0.7);
    }
    const dw = field.dist(x, z);                                                                       // duvar dibi: koyulaşma
    if (dw < 2.6) c.multiplyScalar(0.74 + 0.26 * (dw / 2.6));
    if (slope > 0.22) c.multiplyScalar(0.92);
    if (slope > 1.5) { c.copy(ledge).lerp(ledgeD, Math.min(1, (slope - 1.5) * 0.4)); c.multiplyScalar(0.92 + 0.12 * n); }        // kat kenarı (istinat duvarı): taş sıva
  };
}

// ── nesneler: radar kutuları → sandık / fıçı / yığın / konteyner (çarpışma gövdesi ana kutu; süs çarpışmasız) ──
const CRATE = ['#9b7a4a', '#8a6a3f', '#a6834f'], CONT = ['#2f6a9a', '#a0522d', '#4f7a5a', '#8a8f94', '#b3862b'];
// döndürülmüş kasanın çarpışması: tek dev AABB yerine n×n alt kutunun AABB'leri (kasa şeklini izler)
export function obbCollide(b, cx, y, cz, w, h, d, ry, tag = 'prop') {
  const a = Math.abs(((ry % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2)), skew = Math.min(a, Math.PI / 2 - a);
  const n = skew < 0.05 ? 1 : Math.max(2, Math.min(5, Math.ceil(Math.max(w, d) / 0.6)));
  b.with(cx, y, cz, ry, () => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) b.collide(-w / 2 + (i + 0.5) * w / n, 0, -d / 2 + (j + 0.5) * d / n, w / n, h, d / n, tag); });
}
export function propBox(b, terrain, i, [cx, cz, w, d, ry, h, yoff = 0], colorOverride = null) {
  const NC = { collide: false };
  let lo = 1e9;
  for (const [px, pz] of [[cx, cz], [cx - w / 2, cz], [cx + w / 2, cz], [cx, cz - d / 2], [cx, cz + d / 2]]) lo = Math.min(lo, terrain.heightAt(px, pz));
  if (yoff) { let g = -1e9; for (const [px, pz] of [[cx, cz]]) g = Math.max(g, terrain.heightAt(px, pz)); lo = Math.max(lo, g) + yoff + 0.3; }
  const area = w * d;
  if (area < 1.5 && Math.max(w, d) < 1.3) {                                           // fıçı
    b.cyl(cx, lo - 0.05, cz, Math.min(w, d) / 2, Math.min(w, d) / 2, h + 0.05, i % 2 ? '#7d5a36' : '#9a3b2b', { seg: 10 });
    for (const f of [0.3, 0.68]) b.cyl(cx, lo + h * f, cz, Math.min(w, d) / 2 + 0.025, Math.min(w, d) / 2 + 0.025, 0.07, '#3a3a3a', { seg: 10, collide: false });          // bant: halka
    return;
  }
  const base = colorOverride || (h >= 2.5 ? CONT[i % CONT.length] : CRATE[i % CRATE.length]);
  b.box(cx, lo - 0.3, cz, w, h + 0.3, d, base, { ry, collide: false });
  obbCollide(b, cx, lo - 0.3, cz, w, h + 0.3, d, ry);
  b.with(cx, lo, cz, ry, () => {
    const dk = DARK(base, 0.72), lt = DARK(base, 1.18);
    if (h >= 2.5) {                                                                 // konteyner: oluk nervürleri + kapı ucu + üst kenar
      const long = w >= d, L = long ? w : d, W = long ? d : w;
      const rib = (t) => (long ? b.box(t, 0.1, W / 2 + 0.03, 0.12, h - 0.2, 0.06, dk, NC) : b.box(W / 2 + 0.03, 0.1, t, 0.06, h - 0.2, 0.12, dk, NC));
      for (let t = -L / 2 + 0.5; t < L / 2 - 0.3; t += 0.55) { rib(t); if (long) b.box(t, 0.1, -W / 2 - 0.03, 0.12, h - 0.2, 0.06, dk, NC); else b.box(-W / 2 - 0.03, 0.1, t, 0.06, h - 0.2, 0.12, dk, NC); }
      b.box(0, h, 0, w + 0.06, 0.1, d + 0.06, lt, NC);
      return;
    }
    // sandık / yığın: köşe direkleri + üst çıta + yan kuşak
    const px = w / 2 + 0.02, pz = d / 2 + 0.02;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * px, -0.02, sz * pz, 0.12, h + 0.04, 0.12, dk, NC);
    b.box(0, h - 0.02, 0, w + 0.1, 0.1, d + 0.1, lt, NC);
    b.box(0, h * 0.5 - 0.05, 0, w + 0.05, 0.1, d + 0.05, dk, NC);
    if (h > 1.6) b.box(0, h * 0.25, 0, w + 0.05, 0.08, d + 0.05, dk, NC);
  });
}

// ── hurma ağacı (gövde çarpışmalı, yapraklar süs) ──
export function palm(b, x, z, s = 1, y = 0, collide = true) {
  const h = 5.4 * s, top = y + h;
  b.cyl(x, y, z, 0.12 * s, 0.22 * s, h, '#7d5f3d', { seg: 6, collide });
  b.cyl(x, y + h * 0.35, z, 0.235 * s, 0.235 * s, 0.1, '#5e4529', { seg: 6, collide: false });
  b.cyl(x, y + h * 0.7, z, 0.18 * s, 0.18 * s, 0.1, '#5e4529', { seg: 6, collide: false });
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2 + (x * 3.1 + z * 1.7);
    b.with(x, top, z, ang, () => {
      b.box(1.15 * s, -0.05 * s, 0, 2.3 * s, 0.05, 0.42 * s, k % 2 ? '#4f7f3a' : '#5d8f42', { collide: false, rz: -0.38 });
      b.box(2.55 * s, -0.55 * s, 0, 1.2 * s, 0.04, 0.3 * s, '#456f33', { collide: false, rz: -0.9 });
    });
  }
  b.ico(x, top - 0.1, z, 0.28 * s, '#6a4a2a', { detail: 0 });
}

// açık meydanlarda hurma: zemin ile duvar arasında ≥ 5,5 m boşluk olan, birbirinden ≥ 14 m uzak noktalar
export function scatterPalms(b, terrain, field, avoid, rng, n = 10) {
  const cand = [];
  for (let x = -66; x <= 66; x += 3) for (let z = -72; z <= 72; z += 3) if (field.dist(x, z) >= 5.5) cand.push([x, z]);
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const picked = [];
  for (const [x, z] of cand) {
    if (picked.length >= n) break;
    if (avoid.some(([ax, az, r]) => Math.hypot(ax - x, az - z) < r)) continue;
    if (picked.some(([px, pz]) => Math.hypot(px - x, pz - z) < 14)) continue;
    picked.push([x, z]);
    b.obj('palmiye:' + picked.length, () => palm(b, x, z, 0.9 + rng() * 0.35, terrain.heightAt(x, z) - 0.05));
  }
  return picked;
}

// ── çevre silüeti: uzak evler, minareler, kubbeler, kum tepeleri (çarpışmasız; yalnızca duvar üstünden görünür) ──
export function buildSurround(b, rng) {
  const NC = { collide: false };
  const SAND = ['#dcc08a', '#cfae72', '#e3cc9a', '#c7a46a', '#d7b97f'];
  const pick = (a) => a[Math.floor(rng() * a.length)];
  b.box(0, -8, 0, 900, 5.5, 900, '#d8c08c', NC);                                      // sınır dışı: sonsuz kum zemin; tepesi −2,5 m = haritadaki en alçak zeminin (Pit −1,2) ALTINDA (önceden +0,2'deydi: Pit tabanını örtüyordu)
  const N = 46;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.08, rx = 92 + rng() * 18, rz = 102 + rng() * 18;
    const x = Math.cos(th) * rx, z = Math.sin(th) * rz, r = rng();
    const col = pick(SAND), dk = DARK(col, 0.82);
    if (r < 0.5) {                                                                   // kare bina: pencere sıraları
      const w = 10 + rng() * 14, d = 9 + rng() * 10, h = 11 + rng() * 15;
      b.with(x, 0, z, th + Math.PI / 2, () => {
        b.box(0, -1, 0, w, h + 1, d, col, NC); b.box(0, h, 0, w + 0.6, 0.6, d + 0.6, dk, NC);
        for (let f = 0; f < Math.floor(h / 4.2); f++) for (let k = -1; k <= 1; k++) b.box(k * (w / 3.4), 3 + f * 4.2, d / 2 + 0.03, 1.2, 1.8, 0.06, '#2a3038', NC);
      });
    } else if (r < 0.68) {                                                           // minare
      const h = 26 + rng() * 10;
      b.cyl(x, -1, z, 1.1, 1.5, h + 1, col, { seg: 10, collide: false });
      b.cyl(x, h * 0.72, z, 1.7, 1.7, 0.6, dk, { seg: 10, collide: false });
      b.cyl(x, h, z, 1.5, 1.2, 0.9, dk, { seg: 10, collide: false });
      b.ico(x, h + 1.4, z, 1.3, '#3f7a6e', { detail: 1, scale: [1, 1.8, 1] });
    } else if (r < 0.82) {                                                           // kubbeli yapı
      const w = 12 + rng() * 6, h = 9 + rng() * 5;
      b.box(x, -1, z, w, h + 1, w, col, NC); b.box(x, h, z, w + 0.7, 0.6, w + 0.7, dk, NC);
      b.ico(x, h + 0.2, z, w * 0.42, '#e9e1cc', { detail: 1, scale: [1, 0.85, 1] });
    } else {                                                                         // su deposu
      const h = 14 + rng() * 6;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * 2, -1, z + sz * 2, 0.5, h + 1, 0.5, '#6f5a42', NC);
      b.cyl(x, h, z, 3.4, 3.4, 4.2, '#9db4c4', { seg: 10, collide: false });
    }
  }
  for (let i = 0; i < 26; i++) {                                                    // kum tepeleri
    const th = rng() * Math.PI * 2, rx = 120 + rng() * 40, rz = 130 + rng() * 36, rr = 22 + rng() * 22;
    b.ico(Math.cos(th) * rx, -rr * 0.55, Math.sin(th) * rz, rr, pick(['#dcc08a', '#d2b57b', '#e5cd98']), { detail: 1, scale: [1.5, 0.5, 1.2], ry: rng() * 3 });
  }
}

// ── çatılı tüneller: bölge dikdörtgenleri içindeki serbest 2 m'lik hücrelere tavan + kemer kirişleri (tavan çarpışmalı, nav'ı etkilemez) ──
export function roofTunnels(b, terrain, field, regions) {
  // Düz tavan: bölge içinde yalnızca SERBEST hücreler (+ komşu duvara 1 hücre taşan bindirme) kaplanır → tavan iki duvar arasında kalır, dışarı taşmaz.
  // Tavan kotu: bölgedeki en yüksek zeminden 3,3 m. Satır koşuları aynı koşu dikey birleştirilir (az kutu).
  const C = 0.5;
  let n = 0;
  for (const [x0, x1, z0, z1, dirX] of regions) b.obj('çatı:' + regions.findIndex((r) => r[0] === x0 && r[2] === z0), () => {
    let maxH = -1e9;
    const nx = Math.round((x1 - x0) / C), nz = Math.round((z1 - z0) / C), free = [];
    for (let j = 0; j < nz; j++) { free.push([]); for (let i = 0; i < nx; i++) { const x = x0 + (i + 0.5) * C, z = z0 + (j + 0.5) * C, f = !field.isSolid(x, z); free[j].push(f); if (f) maxH = Math.max(maxH, terrain.heightAt(x, z)); } }
    const by = maxH + 3.3;
    const cover = free.map((row, j) => row.map((f, i) => f || (i > 0 && row[i - 1]) || (i < nx - 1 && row[i + 1]) || (j > 0 && free[j - 1][i]) || (j < nz - 1 && free[j + 1][i])));   // 1 hücre bindirme
    const used = cover.map((r) => r.map(() => false));
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (!cover[j][i] || used[j][i]) continue;
      let i2 = i; while (i2 + 1 < nx && cover[j][i2 + 1] && !used[j][i2 + 1]) i2++;
      let j2 = j; while (j2 + 1 < nz && (() => { for (let k = i; k <= i2; k++) if (!cover[j2 + 1][k] || used[j2 + 1][k]) return false; return true; })()) j2++;
      for (let jj = j; jj <= j2; jj++) for (let ii = i; ii <= i2; ii++) used[jj][ii] = true;
      b.box(x0 + (i + i2 + 1) * C / 2, by, z0 + (j + j2 + 1) * C / 2, (i2 - i + 1) * C, 0.5, (j2 - j + 1) * C, '#8a7551', { tag: 'roof' }); n++;
    }
    for (let t = (dirX ? x0 : z0) + 1.5; t < (dirX ? x1 : z1) - 1; t += 3) {                                  // tavan kirişleri (yalnız serbest hücre koşularında)
      for (let u = 0; u < (dirX ? nz : nx); u++) {
        const i = dirX ? Math.floor((t - x0) / C) : u, j = dirX ? u : Math.floor((t - z0) / C);
        if (!free[j]?.[i]) continue;
        const cx = x0 + (i + 0.5) * C, cz = z0 + (j + 0.5) * C;
        b.box(cx, by - 0.25, cz, dirX ? 0.3 : C + 0.02, 0.25, dirX ? C + 0.02 : 0.3, '#6e5a3c', { collide: false });
      }
    }
  });
  return n;
}

// ── sokak süsü: sokak üstü ip + renkli flamalar (dar-uzun geçitlerde) ──
export function hangings(b, terrain, field, rng, max = 22) {
  const NC = { collide: false }, FL = ['#b5402e', '#2d6fa8', '#d9a52b', '#2f7a6e', '#e8dcc0', '#8e3a6a'];
  const placed = [];
  const cand = [];
  for (let x = -64; x <= 64; x += 3) for (let z = -70; z <= 70; z += 3) cand.push([x, z]);
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  for (const [x, z] of cand) {
    if (placed.length >= max) break;
    if (field.isSolid(x, z) || field.dist(x, z) < 1.2) continue;
    const mx = field.clearance(x, z, -1, 0, 14), px = field.clearance(x, z, 1, 0, 14), mz = field.clearance(x, z, 0, -1, 14), pz = field.clearance(x, z, 0, 1, 14);
    const acrossX = mx + px, acrossZ = mz + pz;
    let alongZ = acrossX >= 4 && acrossX <= 10 && mz + pz >= 14;          // z boyunca uzanan sokak: ip x yönünde gerilir
    let alongX = !alongZ && acrossZ >= 4 && acrossZ <= 10 && mx + px >= 14;
    if (!alongZ && !alongX) continue;
    if (placed.some(([qx, qz]) => Math.hypot(qx - x, qz - z) < 15)) continue;
    placed.push([x, z]);
    const len = alongZ ? acrossX - 0.3 : acrossZ - 0.3, cx = alongZ ? x + (px - mx) / 2 : x, cz = alongZ ? z : z + (pz - mz) / 2;
    const g = terrain.heightAt(cx, cz), y = g + 5.0 + rng() * 0.6;
    b.with(cx, y, cz, alongZ ? Math.PI / 2 : 0, () => {
      const wire = rng() < 0.5;                                                                          // yarısı elektrik teli (koyu, bayraksız), yarısı flama ipi
      for (let k = 0; k < 3; k++) b.box(((k - 1) * len) / 3, -0.18 * (k === 1 ? 1 : 0.4), 0, len / 3 + 0.02, 0.04, 0.04, wire ? '#26292d' : '#5b4630', { ...NC, rz: k === 0 ? -0.1 : k === 2 ? 0.1 : 0 });
      if (wire) { for (let k = 0; k < 3; k++) b.box(((k - 1) * len) / 3, -0.18 * (k === 1 ? 1 : 0.4), 0.35, len / 3 + 0.02, 0.04, 0.04, '#26292d', { ...NC, rz: k === 0 ? -0.1 : k === 2 ? 0.1 : 0 }); return; }
      const n = Math.floor(len / 0.7);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n - 0.5, sag = -0.2 * (1 - (2 * t) * (2 * t)) - 0.04; b.box(t * len, sag - 0.4, 0, 0.3, 0.42, 0.03, FL[(k + Math.floor(rng() * 3)) % FL.length], NC); }
    });
  }
  return placed.length;
}

// ── kapı çerçeveleri: bir bölge adının yanındaki en dar geçidi bulur (Long Doors, Mid Doors, B Doors…), iki dikme + lento + açık mavi kapı kanatları ──
export function findDoor(field, x0, z0, r = 8, minW = 2.0) {
  let best = null;
  for (let x = x0 - r; x <= x0 + r; x += 0.5) for (let z = z0 - r; z <= z0 + r; z += 0.5) {
    if (field.isSolid(x, z)) continue;
    const ex = field.clearance(x, z, 1, 0, 14) + field.clearance(x, z, -1, 0, 14), ez = field.clearance(x, z, 0, 1, 14) + field.clearance(x, z, 0, -1, 14);
    const narrow = Math.min(ex, ez), open = Math.max(ex, ez);
    if (narrow < minW || narrow > 6.0 || open < 9) continue;
    const sc = narrow + Math.hypot(x - x0, z - z0) * 0.12;
    if (!best || sc < best.sc) best = { sc, x, z, alongX: ex < ez, narrow };
  }
  if (!best) return null;
  const { x, z, alongX } = best;
  const cx = alongX ? x + (field.clearance(x, z, 1, 0, 14) - field.clearance(x, z, -1, 0, 14)) / 2 : x;
  const cz = alongX ? z : z + (field.clearance(x, z, 0, 1, 14) - field.clearance(x, z, 0, -1, 14)) / 2;
  return { x: cx, z: cz, alongX, w: best.narrow };
}

export function doorFrame(b, terrain, d) {
  const NC = { collide: false }, g = Math.max(terrain.heightAt(d.x, d.z), terrain.heightAt(d.x + (d.alongX ? d.w / 2 : 0), d.z + (d.alongX ? 0 : d.w / 2)), terrain.heightAt(d.x - (d.alongX ? d.w / 2 : 0), d.z - (d.alongX ? 0 : d.w / 2)));
  const w = d.w, hw = w / 2, blue = '#2d6fa8', blueD = '#23598a', sand = '#c9a96e', sandD = '#a98c58', sandL = '#e2c98f';
  b.with(d.x, g, d.z, d.alongX ? 0 : Math.PI / 2, () => {            // yerel x: geçidin dar ekseni; yerel z: geçiş yönü
    for (const s of [-1, 1]) {
      b.box(s * (hw + 0.1), -0.4, 0, 0.9, 4.6, 1.5, sand, NC);                                // dikme
      b.box(s * (hw + 0.1), 4.2, 0, 1.15, 0.3, 1.75, sandL, NC);                              // dikme başlığı
      b.box(s * (hw - 0.45), 0, 0.2, 0.14, 3.3, w * 0.5, blue, NC);                           // açık kapı kanadı (duvara yatık)
      b.box(s * (hw - 0.52), 1.5, 0.2, 0.05, 0.14, w * 0.5, blueD, NC);                        // kanat kuşağı
    }
    b.box(0, 3.55, 0, w + 1.6, 0.8, 1.5, sand, NC);                                           // lento
    b.box(0, 4.35, 0, w + 1.9, 0.25, 1.8, sandL, NC);                                         // lento üst çıtası
    b.box(0, 3.4, 0, w + 0.6, 0.16, 1.6, sandD, NC);                                          // lento alt şeridi
  });
}

// ── büyük ahşap kapı (Dust 2 Mid / B / Long Doors): koridoru kesen alçak duvar + taş çerçeve + lento + iki kanat.
//    Kanatlar menteşeden aralık açık (biri az, biri çok) → ortada ~1,6 m geçit. Kanatlar 'wood': çarpışır, mermi geçer.
//    g = { x, z, axis: 'x' | 'z' (duvarın uzandığı eksen), a0, a1 (duvar ucu, dünya), c (kapı ortası, dünya), W (açıklık), swing: ±1 (dünya yönü), aL, aR (derece) }
export function gateDoor(b, terrain, g) {
  const NC = { collide: false }, H = 5.6, P = 0.65, LT = 4.0, T = 0.9;
  const stone = '#cdb487', stoneD = '#b39a6c', plaster = '#cfa766', wood = '#8a7455', woodD = '#65533a', iron = '#3b3530';
  const ax = g.axis === 'x';
  const cx = ax ? g.c : g.x, cz = ax ? g.z : g.c;
  const gy = Math.min(terrain.heightAt(cx, cz), terrain.heightAt(ax ? cx - g.W / 2 : cx, ax ? cz : cz - g.W / 2), terrain.heightAt(ax ? cx + g.W / 2 : cx, ax ? cz : cz + g.W / 2));
  const u0 = (ax ? g.a0 : g.a0) - g.c, u1 = g.a1 - g.c, hw = g.W / 2, sw = ax ? g.swing : -g.swing;
  b.with(cx, gy, cz, ax ? 0 : -Math.PI / 2, () => {            // yerel x: duvar boyunca (kapı ortası 0), yerel z: duvara dik (sw tarafına açılır)
    // yan duvarlar (koridor kenarına kadar)
    const l0 = u0, l1 = -hw - P, r0 = hw + P, r1 = u1;
    if (l1 - l0 > 0.05) b.box((l0 + l1) / 2, -0.5, 0, l1 - l0, H + 0.5, T, plaster, { tag: 'wall' });
    if (r1 - r0 > 0.05) b.box((r0 + r1) / 2, -0.5, 0, r1 - r0, H + 0.5, T, plaster, { tag: 'wall' });
    // dikmeler + lento + lento üstü duvar
    for (const s of [-1, 1]) b.box(s * (hw + P / 2), -0.5, 0, P, H + 0.5, T + 0.3, stone, { tag: 'wall' });
    b.box(0, LT, 0, g.W + 2 * P, 0.6, T + 0.3, stone, { tag: 'wall' });
    b.box(0, LT + 0.6, 0, g.W, H - LT - 0.6, T, plaster, { tag: 'wall' });
    // görsel: kaide, üst kenar, kemer altı, dikme başlıkları
    for (const zz of [-1, 1]) for (const [k0, k1] of [[u0, -hw - P], [hw + P, u1]]) if (k1 - k0 > 0.05) b.box((k0 + k1) / 2, -0.4, zz * (T / 2 + 0.03), k1 - k0 + 0.02, 1.0, 0.06, stoneD, NC);   // kaide (kapı açıklığında yok)
    b.box((u0 + u1) / 2, H, 0, (u1 - u0) + 0.1, 0.18, T + 0.25, '#e2c995', NC);
    for (let k = 0; k < 5; k++) { const t = (k + 0.5) / 5, uu = -hw + t * g.W, yy = LT - 0.05 - Math.sin(t * Math.PI) * 0.0 + (1 - Math.sin(t * Math.PI)) * -0.25; b.box(uu, yy, 0, g.W / 5 + 0.02, 0.3, T + 0.32, stoneD, { ...NC, rz: 0 }); }
    for (const s of [-1, 1]) b.box(s * (hw + P / 2), H - 0.2, 0, P + 0.2, 0.35, T + 0.5, '#e2c995', NC);
    // kanatlar
    const leaf = (side, deg) => {
      const a = (deg * Math.PI) / 180, L = hw - 0.04, hu = side * (hw - 0.02);
      const du = -side * Math.cos(a), dv = sw * Math.sin(a), mu = hu + du * L / 2, mv = dv * L / 2, ry = Math.atan2(-dv, du);
      const LH = LT - 0.05;
      b.box(mu, 0.02, mv, L, LH, 0.14, wood, { collide: false, ry });
      obbCollide(b, mu, 0.02, mv, L, LH, 0.14, ry, 'wood');                                    // kanat şeklinde çarpışma (döndürülmüş tek AABB geçidi kapatıyordu)
      b.with(mu, 0, mv, ry, () => {
        for (let k = 1; k < 6; k++) b.box(-L / 2 + (L * k) / 6, 0.05, 0, 0.04, LH - 0.1, 0.17, woodD, NC);   // tahta araları
        for (const y of [0.45, LH / 2, LH - 0.55]) b.box(0, y, 0, L - 0.1, 0.16, 0.2, woodD, NC);         // kuşaklar
        for (const y of [0.6, LH - 0.7]) b.box(-side * (L / 2 - 0.35), y, 0, 0.5, 0.1, 0.22, iron, NC);   // menteşe
      });
    };
    leaf(-1, g.aL ?? 25); leaf(1, g.aR ?? 70);
  });
}

// ── çatı üstü uydu çanakları (gökyüzüne karşı siluet) ──
export function dishes(b, terrain, rects, rng, n = 34) {
  const NC = { collide: false };
  const cand = rects.filter(([x0, z0, x1, z1]) => x1 - x0 >= 3 && z1 - z0 >= 3);
  let placed = 0;
  for (let t = 0; t < n * 6 && placed < n && cand.length; t++) {
    const [x0, z0, x1, z1, top] = cand[Math.floor(rng() * cand.length)];
    const cx = x0 + 1.0 + rng() * (x1 - x0 - 2.0), cz = z0 + 1.0 + rng() * (z1 - z0 - 2.0);
    b.objStack.push('çanak:' + placed);
    b.with(cx, top, cz, rng() * Math.PI * 2, () => {
      b.cyl(0, 0, 0, 0.05, 0.05, 1.2, '#8a8f94', { seg: 5, collide: false });
      b.cyl(0.35, 1.5, 0, 0.9, 0.9, 0.1, '#e9e6dc', { seg: 12, collide: false, rz: 0.75 });
      b.box(0.55, 1.45, 0, 0.7, 0.05, 0.05, '#555a5f', NC);
    });
    b.objStack.pop();
    placed++;
  }
}

// ── duvar reklamı (mavi çerçeveli beyaz pano + kırmızı ok) ──
export function ads(b, terrain, edges, field, rng, n = 14, noDecor = []) {
  const inNo = (x, z) => noDecor.some(([a, c, d, e]) => x >= a && x <= d && z >= c && z <= e);
  const NC = { collide: false };
  const cand = edges.filter(([x0, z0, x1, z1]) => Math.hypot(x1 - x0, z1 - z0) >= 6.0);
  let placed = 0;
  for (let t = 0; t < n * 12 && placed < n && cand.length; t++) {
    const [x0, z0, x1, z1, top] = cand[Math.floor(rng() * cand.length)];
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), nx = dz / L, nz = -dx / L, tt = (2.7 + rng() * (L - 5.4)) / L;
    const wx = x0 + dx * tt, wz = z0 + dz * tt;
    if (field.clearance(wx + nx * 0.6, wz + nz * 0.6, nx, nz, 12) < 4) continue;
    const g = terrain.heightAt(wx + nx * 0.4, wz + nz * 0.4);
    if (top - g < 5.2 || inNo(wx, wz) || !occFree(wx, wz, 2.2) || frontBlocked(b, terrain, wx, wz, nx, nz, dx / L, dz / L, 2.2, 0.8, g + 1.5, g + 4.7)) continue;
    OCC.push([wx, wz, 2.2]);
    const col = ['#e9e2d2', '#cfe3ee', '#efe0b8'][Math.floor(rng() * 3)], acc = ['#2d6fa8', '#b5402e', '#2f7a6e'][Math.floor(rng() * 3)];
    b.objStack.push('pano:' + placed);
    b.with(wx, g, wz, Math.atan2(nx, nz), () => {
      b.box(0, 1.6, 0.04, 4.2, 3.0, 0.05, acc, NC);
      b.box(0, 1.75, 0.08, 3.8, 2.7, 0.04, col, NC);
      for (let k = 0; k < 4; k++) b.box(-0.2 + (k % 2) * 0.1, 3.2 - k * 0.42, 0.12, 2.6 - (k === 3 ? 1.1 : 0), 0.18, 0.03, '#3a3f45', NC);
      b.box(0.6, 1.95, 0.12, 1.5, 0.1, 0.03, '#b5402e', NC); b.box(1.2, 1.95, 0.12, 0.3, 0.3, 0.03, '#b5402e', { ...NC, rz: 0.8 });
    });
    b.objStack.pop();
    placed++;
  }
}

// ── saha tabelası: duvara büyük harf (A / B) ──
export function siteSign(b, terrain, edges, call, letter, noDecor = []) {
  const inNo = (x, z) => noDecor.some(([a, c, d, e]) => x >= a && x <= d && z >= c && z <= e);
  const NC = { collide: false };
  let best = null, bs = -1e9;
  for (const [x0, z0, x1, z1, top] of edges) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    if (L < 5.5) continue;
    const nx = dz / L, nz = -dx / L, wx = (x0 + x1) / 2, wz = (z0 + z1) / 2, ex = call.x - wx, ez = call.z - wz, dist = Math.hypot(ex, ez);
    if (dist > 16 || (ex * nx + ez * nz) / (dist + 1e-6) < 0.7) continue;
    const g = terrain.heightAt(wx + nx * 0.4, wz + nz * 0.4);
    if (top - g < 5.5 || inNo(wx, wz) || !occFree(wx, wz, 2.1) || frontBlocked(b, terrain, wx, wz, nx, nz, dx / L, dz / L, 2.1, 0.8, g + 1.3, g + 5.5)) continue;
    const sc = -dist + L * 0.3; if (sc > bs) { bs = sc; best = { wx, wz, nx, nz, g }; }
  }
  if (!best) return false;
  OCC.push([best.wx, best.wz, 2.1]);
  b.objStack.push('tabela:' + letter);
  b.with(best.wx, best.g, best.wz, Math.atan2(best.nx, best.nz), () => {
    b.box(0, 1.4, 0.04, 4.0, 4.0, 0.1, '#2f7a6e', NC); b.box(0, 1.6, 0.1, 3.6, 3.6, 0.08, '#efe6cc', NC);
    const K = '#2b3036';
    if (letter === 'A') { b.box(-0.55, 2.1, 0.17, 0.4, 2.6, 0.06, K, { ...NC, rz: -0.28 }); b.box(0.55, 2.1, 0.17, 0.4, 2.6, 0.06, K, { ...NC, rz: 0.28 }); b.box(0, 2.0, 0.17, 1.1, 0.35, 0.06, K, NC); }
    else { b.box(-0.7, 2.1, 0.17, 0.4, 2.7, 0.06, K, NC); for (const y of [0, 1.15, 2.3]) b.box(0.05, 2.1 + y, 0.17, 1.4, 0.4, 0.06, K, NC); for (const y of [0.6, 1.75]) b.box(0.6, 2.25 + y - 0.15, 0.17, 0.4, 1.0, 0.06, K, NC); }
  });
  b.objStack.pop();
  return true;
}
