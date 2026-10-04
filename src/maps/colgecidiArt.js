import * as THREE from 'three';

// Çöl Geçidi sanatı: duvar cepheleri (sıva, kaide, korniş, kiriş uçları, pencere, kapı, tente), zemin boyası (gölge / desen), dış siluet.
// Hepsi görsel (çarpışmasız) ve köşe renkli kutulardır: MapBuilder tek mesh'te birleştirir.
export const rngOf = (seed) => { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };

// duvar ızgarası: dikdörtgenlerden 0,5 m'lik katı maskesi + uzaklık alanı (zemin gölgesi, genişlik sorguları için)
export function makeSolidField(D) {
  const C = D.cell, nx = D.nx, nz = D.nz, x0 = D.x0, z0 = D.z0;
  const solid = new Uint8Array(nx * nz);
  for (const [a, b, c, d] of D.rects) {
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

export function decorateFaces(b, D, terrain, field, rng) {
  const NC = { collide: false };
  let nWin = 0, nDoor = 0, nAwn = 0;
  for (const [d, p, a, e] of D.faces) {
    const len = e - a, th = THETA[d];
    const alongX = d >= 2;                                                        // koşu x ekseni boyunca mı (z yüzleri)
    const SEG = 3.0, n = Math.max(1, Math.round(len / SEG)), seg = len / n;
    const nrm = [d === 0 ? 1 : d === 1 ? -1 : 0, d === 2 ? 1 : d === 3 ? -1 : 0];  // dış normal (x, z)
    // koşu başına tek sıva rengi (8 m bloklara göre): komşu yüzler aynı rengi paylaşır
    const mx = alongX ? (a + e) / 2 : p, mz = alongX ? p : (a + e) / 2;
    const hsh = Math.abs(Math.floor(mx / 9) * 73856093 ^ Math.floor(mz / 9) * 19349663) >>> 0;
    const col = PLASTER[hsh % PLASTER.length];
    const dark = DARK(col, 0.78), light = DARK(col, 1.1);
    const wide = field.clearance(mx + nrm[0] * 0.6, mz + nrm[1] * 0.6, nrm[0], nrm[1], 12);              // karşı duvara serbest uzaklık: dar geçitlerde süs azalır
    for (let s = 0; s < n; s++) {
      const c = a + (s + 0.5) * seg;
      const wx = alongX ? c : p, wz = alongX ? p : c;
      const gx = wx + nrm[0] * 0.4, gz = wz + nrm[1] * 0.4;
      const g0 = Math.min(terrain.heightAt(alongX ? c - seg / 2 : gx, alongX ? gz : c - seg / 2), terrain.heightAt(alongX ? c + seg / 2 : gx, alongX ? gz : c + seg / 2), terrain.heightAt(gx, gz));
      const H = 6.0;
      b.with(wx, g0, wz, th, () => {
        // sıva katmanı + kaide + korniş
        b.box(0, -0.35, 0.02, seg + 0.02, H + 0.35, 0.04, col, NC);                                   // tüm yüz: tek ton
        b.box(0, -0.35, 0.07, seg + 0.02, 1.35, 0.1, dark, NC);                                       // kaide (kirli alt şerit)
        b.box(0, 1.0, 0.1, seg + 0.02, 0.1, 0.16, light, NC);                                         // kaide üst çıtası
        b.box(0, H - 0.1, 0.12, seg + 0.02, 0.32, 0.28, light, NC);                                   // korniş
        b.box(0, H + 0.2, 0.08, seg + 0.02, 0.2, 0.16, dark, NC);                                     // korniş üst dudağı
        const r = rng();
        // kiriş uçları (geleneksel çatı kirişleri) – bazı yüzlerde
        if (r < 0.4) for (let k = -1; k <= 1; k++) b.box(k * 1.0, H - 0.65, 0.3, 0.2, 0.2, 0.55, '#7a5b3a', NC);
        const roomy = wide >= 3.5;
        // pencere
        if (roomy && seg > 2.4 && r > 0.18 && r < 0.62) {
          const wy = 3.2 + (r < 0.4 ? 0 : 0.35);
          b.box(0, wy - 0.1, 0.12, 1.5, 2.1, 0.07, '#b69a68', NC);                                    // çerçeve
          if (rng() < 0.25) b.box(0, wy, 0.17, 1.1, 1.7, 0.06, '#f0c46e', { ...NC, o: { glow: true } });   // yanık pencere (gece / gün batımında parlar; gündüz perdeli pencere gibi görünür)
          else b.box(0, wy, 0.17, 1.1, 1.7, 0.06, '#232a31', NC);                                    // cam
          b.box(0, wy + 0.82, 0.2, 1.0, 0.05, 0.05, '#394450', NC);                                   // çıta
          b.box(0, wy - 0.22, 0.26, 1.7, 0.14, 0.42, light, NC);                                      // denizlik
          nWin++;
        } else if (roomy && seg > 2.6 && r >= 0.62 && r < 0.78) {                                    // kapı (mavi / kahve / yeşil), üstü kemerli
          const dc = DOOR[(hsh >> 3) % DOOR.length];
          b.box(0, -0.35, 0.1, 2.0, 3.1, 0.08, '#9c7a4c', NC);                                        // söve
          b.box(0, -0.35, 0.16, 1.55, 2.75, 0.07, dc, NC);                                            // kapı kanadı
          b.box(0, 1.1, 0.2, 0.06, 1.3, 0.04, DARK(dc, 0.7), NC);                                     // orta çıta
          b.box(0, 2.4, 0.12, 2.3, 0.22, 0.18, light, NC);                                            // lento
          nDoor++;
        } else if (wide >= 5 && seg > 2.8 && r >= 0.78 && r < 0.9) {                                  // tente
          const [c1, c2] = AWN[(hsh >> 5) % AWN.length];
          b.with(0, 3.1, 0.1, 0, () => {
            for (let k = -3; k <= 3; k++) b.box(k * (seg / 7), 0.0, 0.7, seg / 7 + 0.01, 0.07, 1.4, k % 2 ? c2 : c1, { ...NC, rx: 0.3 });
          });
          nAwn++;
        }
      });
    }
    // uzun yüzlerde dikme (pilaster)
    if (len >= 7) for (let t = a + 3.5; t < e - 2; t += 7) {
      const wx = alongX ? t : p, wz = alongX ? p : t;
      const g0 = terrain.heightAt(wx + nrm[0] * 0.4, wz + nrm[1] * 0.4);
      b.with(wx, g0, wz, th, () => b.box(0, -0.35, 0.16, 0.5, 6.35, 0.2, DARK(col, 0.92), NC));
    }
  }
  return { windows: nWin, doors: nDoor, awnings: nAwn };
}

// zemin rengi: kum + duvar dibi gölgesi (AO) + yükseklik tonu + saha deseni
export function floorColor(field, D) {
  const sand = new THREE.Color('#dcc592'), sand2 = new THREE.Color('#cfb27a'), dirt = new THREE.Color('#bf9f68'), cool = new THREE.Color('#b9ab8d'), tile1 = new THREE.Color('#d6c29a'), tile2 = new THREE.Color('#c8b185');
  const sites = (D.zones.orange || []).filter((z) => z[2] - z[0] > 6);
  const tmp = new THREE.Color();
  return (x, z, h, slope, c, n) => {
    c.copy(sand).lerp(sand2, n);
    c.lerp(cool, Math.max(0, Math.min(1, (1.3 - h) / 1.8)) * 0.45);                                   // alçak (tünel / çukur): serin gri-kum
    c.lerp(dirt, Math.max(0, Math.min(1, (h - 2.2) / 1.6)) * 0.55);                                    // yüksek (T avlusu): kuru toprak
    for (const [a, b, e, f] of sites) if (x > a - 2 && x < e + 2 && z > b - 2 && z < f + 2) {         // saha: karo deseni
      tmp.copy(((Math.floor(x / 1.5) + Math.floor(z / 1.5)) & 1) ? tile1 : tile2); c.lerp(tmp, 0.7);
    }
    const dw = field.dist(x, z);                                                                       // duvar dibi: koyulaşma
    if (dw < 2.6) c.multiplyScalar(0.74 + 0.26 * (dw / 2.6));
    if (slope > 0.22) c.multiplyScalar(0.92);
  };
}

// ── nesneler: radar kutuları → sandık / fıçı / yığın / konteyner (çarpışma gövdesi ana kutu; süs çarpışmasız) ──
const CRATE = ['#9b7a4a', '#8a6a3f', '#a6834f'], CONT = ['#2f6a9a', '#a0522d', '#4f7a5a', '#8a8f94', '#b3862b'];
export function propBox(b, terrain, i, [cx, cz, w, d, ry, h]) {
  const NC = { collide: false };
  let lo = 1e9;
  for (const [px, pz] of [[cx, cz], [cx - w / 2, cz], [cx + w / 2, cz], [cx, cz - d / 2], [cx, cz + d / 2]]) lo = Math.min(lo, terrain.heightAt(px, pz));
  const area = w * d;
  if (area < 1.5 && Math.max(w, d) < 1.3) {                                           // fıçı
    b.cyl(cx, lo - 0.05, cz, Math.min(w, d) / 2, Math.min(w, d) / 2, h + 0.05, i % 2 ? '#7d5a36' : '#9a3b2b', { seg: 10 });
    b.with(cx, lo, cz, 0, () => { b.box(0, h * 0.35, 0, Math.min(w, d) + 0.06, 0.07, Math.min(w, d) + 0.06, '#3a3a3a', NC); b.box(0, h * 0.7, 0, Math.min(w, d) + 0.06, 0.07, Math.min(w, d) + 0.06, '#3a3a3a', NC); });
    return;
  }
  const base = h >= 2.5 ? CONT[i % CONT.length] : CRATE[i % CRATE.length];
  b.box(cx, lo - 0.3, cz, w, h + 0.3, d, base, { ry, tag: 'prop' });
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
  for (let x = -70; x <= 70; x += 3) for (let z = -64; z <= 64; z += 3) if (field.dist(x, z) >= 5.5) cand.push([x, z]);
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const picked = [];
  for (const [x, z] of cand) {
    if (picked.length >= n) break;
    if (avoid.some(([ax, az, r]) => Math.hypot(ax - x, az - z) < r)) continue;
    if (picked.some(([px, pz]) => Math.hypot(px - x, pz - z) < 14)) continue;
    picked.push([x, z]);
    palm(b, x, z, 0.9 + rng() * 0.35, terrain.heightAt(x, z) - 0.05);
  }
  return picked;
}

// ── çevre silüeti: uzak evler, minareler, kubbeler, kum tepeleri (çarpışmasız; yalnızca duvar üstünden görünür) ──
export function buildSurround(b, rng) {
  const NC = { collide: false };
  const SAND = ['#dcc08a', '#cfae72', '#e3cc9a', '#c7a46a', '#d7b97f'];
  const pick = (a) => a[Math.floor(rng() * a.length)];
  b.box(0, -6, 0, 900, 6.2, 900, '#d8c08c', NC);                                      // sınır dışı: sonsuz kum zemin (arazi ağının dışı boş görünmesin)
  const N = 46;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.08, rx = 104 + rng() * 18, rz = 94 + rng() * 16;
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
    const th = rng() * Math.PI * 2, rx = 132 + rng() * 40, rz = 120 + rng() * 36, rr = 22 + rng() * 22;
    b.ico(Math.cos(th) * rx, -rr * 0.55, Math.sin(th) * rz, rr, pick(['#dcc08a', '#d2b57b', '#e5cd98']), { detail: 1, scale: [1.5, 0.5, 1.2], ry: rng() * 3 });
  }
}

// ── çatılı tüneller: bölge dikdörtgenleri içindeki serbest 2 m'lik hücrelere tavan + kemer kirişleri (tavan çarpışmalı, nav'ı etkilemez) ──
export function roofTunnels(b, terrain, field, regions) {
  let n = 0;
  for (const [x0, x1, z0, z1, dirX] of regions) {
    for (let x = x0; x < x1; x += 2) for (let z = z0; z < z1; z += 2) {
      const cx = x + 1, cz = z + 1;
      if (field.isSolid(cx, cz) || field.isSolid(x + 0.1, z + 0.1) || field.isSolid(x + 1.9, z + 1.9) || field.isSolid(x + 0.1, z + 1.9) || field.isSolid(x + 1.9, z + 0.1)) continue;
      let hi = -1e9;
      for (const [px, pz] of [[x, z], [x + 2, z], [x, z + 2], [x + 2, z + 2], [cx, cz]]) hi = Math.max(hi, terrain.heightAt(px, pz));
      b.box(cx, hi + 3.5, cz, 2.0, 0.45, 2.0, '#8a7551', { tag: 'roof' });
      n++;
    }
    // kemer kirişleri: tünel yönüne dik, 4 m'de bir
    for (let t = dirX ? x0 : z0; t < (dirX ? x1 : z1); t += 4) {
      const hi = terrain.heightAt(dirX ? t : (x0 + x1) / 2, dirX ? (z0 + z1) / 2 : t);
      if (dirX) b.box(t + 0.2, hi + 3.1, (z0 + z1) / 2, 0.4, 0.4, z1 - z0, '#6e5a3c', { collide: false });
      else b.box((x0 + x1) / 2, hi + 3.1, t + 0.2, x1 - x0, 0.4, 0.4, '#6e5a3c', { collide: false });
    }
  }
  return n;
}

// ── sokak süsü: sokak üstü ip + renkli flamalar (dar-uzun geçitlerde) ──
export function hangings(b, terrain, field, rng, max = 22) {
  const NC = { collide: false }, FL = ['#b5402e', '#2d6fa8', '#d9a52b', '#2f7a6e', '#e8dcc0', '#8e3a6a'];
  const placed = [];
  const cand = [];
  for (let x = -68; x <= 68; x += 3) for (let z = -62; z <= 62; z += 3) cand.push([x, z]);
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
      for (let k = 0; k < 3; k++) b.box(((k - 1) * len) / 3, -0.18 * (k === 1 ? 1 : 0.4), 0, len / 3 + 0.02, 0.04, 0.04, '#5b4630', { ...NC, rz: k === 0 ? -0.1 : k === 2 ? 0.1 : 0 });
      const n = Math.floor(len / 0.7);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n - 0.5, sag = -0.2 * (1 - (2 * t) * (2 * t)) - 0.04; b.box(t * len, sag - 0.4, 0, 0.3, 0.42, 0.03, FL[(k + Math.floor(rng() * 3)) % FL.length], NC); }
    });
  }
  return placed.length;
}
