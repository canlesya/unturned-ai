// Çöl Geçidi harita hata taraması (12.171; önce / sonra aynı ölçüt):  node scripts/cgqa.mjs [depo kökü = bu depo] [çıktı.json]
// Haritayı görsel geometrisiyle kurar (tarayıcıdaki gibi zfix açık) ve ölçer:
//  1 iç içe       — farklı nesnelerin çarpışma kutuları üç eksende de > 2 cm iç içe (aynı nesnenin kendi kutuları ayrıca)
//  2 z-fighting   — aynı yöne bakan, ≤ 5 mm aralıklı, örtüşen (> 1 cm²) iki üçgen; rengi / sınıfı farklıysa titrer
//  3 görünmez çarpışma — çarpışma kutusu yüzeyinde (açıkta kalan) nokta; 6 cm içeride görsel yüzey yok (oyuncu boşluğa çarpar)
//  4 görsel ama çarpışmasız — oyuncunun erişebileceği bantta (zemin + 0…2,2 m) görsel yüzey noktası; 15 cm çevresinde katı yok (içinden geçilir)
//  5 havada / gömülü — nesne (kimlik) altı / yanı hiçbir katıya ya da zemine değmiyor; eşya tabanı ayak izi zemininin > 0,25 m altında
//  6 piksel / esneme — zemin ağında dik (30°–87°) gerilmiş üçgen alanı; yol ızgarası sınırında ≤ 1 m'lik testere dişi basamağı
//  7 sızıntı      — T doğuşundan yürünebilen hücrelerin oynanış alanı dışına çıkanı
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(process.argv[2] || '.');
const OUT = process.argv[3] || null;
const imp = (p) => import(path.join(ROOT, p));
const { MapBuilder } = await imp('src/maps/builder.js');
MapBuilder.zfix = true;
const { buildColGecidi } = await imp('src/maps/colgecidi.js');
const { NavGrid } = await imp('src/game/nav.js');
const t0 = performance.now();
const m = buildColGecidi();
const buildMs = performance.now() - t0;
const T = m.terrain, C = m.colliders;
const R = {};

// ── üçgenler (oid, renk, sınıf) ──
const tris = [];   // [ax,ay,az,bx,by,bz,cx,cy,cz, nx,ny,nz, oidIndex, colorKey]
const oids = [], oidIx = new Map();
const oidOf = (s) => { let i = oidIx.get(s); if (i === undefined) { i = oids.length; oids.push(s); oidIx.set(s, i); } return i; };
let triCount = 0, meshCount = 0, groundMesh = null;
m.group.updateMatrixWorld(true);
m.group.traverse((o) => {
  if (!o.isMesh) return;
  meshCount++;
  const g = o.geometry, P = g.attributes.position, col = g.attributes.color, kd = g.attributes.aKind, mw = o.matrixWorld.elements;
  const ranges = o.userData.ranges || [{ oid: o.userData.ground ? 'zemin' : o.name || 'ağ:' + meshCount, start: 0, count: P.count }];
  const isGround = !o.userData.ranges;                                                // eski haritada arazi ayrı ağ (oid yok)
  if (isGround) groundMesh = o;
  const W = (i) => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [mw[0] * x + mw[4] * y + mw[8] * z + mw[12], mw[1] * x + mw[5] * y + mw[9] * z + mw[13], mw[2] * x + mw[6] * y + mw[10] * z + mw[14]]; };
  const idx = g.index ? g.index.array : null;
  for (const r of ranges) {
    const oi = oidOf(isGround ? 'arazi' : r.oid);
    const n = idx ? idx.length : r.count;
    for (let q = (idx ? 0 : r.start); q < (idx ? n : r.start + r.count); q += 3) {
      const i0 = idx ? idx[q] : q, i1 = idx ? idx[q + 1] : q + 1, i2 = idx ? idx[q + 2] : q + 2;
      const a = W(i0), b = W(i1), c = W(i2);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz);
      if (L < 1e-9) continue;
      nx /= L; ny /= L; nz /= L;
      const ck = (col ? [col.getX(i0), col.getY(i0), col.getZ(i0)].map((v) => Math.round(v * 255)).join(',') : 'mat:' + (o.material?.color?.getHexString?.() || '?')) + '|' + (kd ? (kd.getX(i0) & 15) : (o.material?.uuid || ''));
      tris.push([...a, ...b, ...c, nx, ny, nz, oi, ck, L / 2]);
      triCount++;
    }
    if (idx) break;
  }
});
R.agaclar = { ag: meshCount, ucgen: triCount, carpisma: C.length, kurulumMs: Math.round(buildMs) };

// üçgen ızgarası (xz 1 m)
const G = new Map(), GC = 1;
tris.forEach((t, i) => {
  const x0 = Math.floor(Math.min(t[0], t[3], t[6]) / GC), x1 = Math.floor(Math.max(t[0], t[3], t[6]) / GC), z0 = Math.floor(Math.min(t[2], t[5], t[8]) / GC), z1 = Math.floor(Math.max(t[2], t[5], t[8]) / GC);
  if ((x1 - x0) * (z1 - z0) > 4000) return;                                         // dev zemin düzlemi (sınır dışı kum): ayrı
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x * 4096 + z; let a = G.get(k); if (!a) G.set(k, (a = [])); a.push(i); }
});
const near = (x0, z0, x1, z1) => { const s = new Set(); for (let x = Math.floor(x0 / GC); x <= Math.floor(x1 / GC); x++) for (let z = Math.floor(z0 / GC); z <= Math.floor(z1 / GC); z++) { const a = G.get(x * 4096 + z); if (a) for (const i of a) s.add(i); } return s; };
// ışın – üçgen (Möller–Trumbore), iki yüzlü
function rayTri(o, d, t) {
  const e1 = [t[3] - t[0], t[4] - t[1], t[5] - t[2]], e2 = [t[6] - t[0], t[7] - t[1], t[8] - t[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det, s = [o[0] - t[0], o[1] - t[1], o[2] - t[2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return -1;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return -1;
  return (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
}
const firstHit = (o, d, maxT) => { let best = Infinity; for (const i of near(Math.min(o[0], o[0] + d[0] * maxT) - 0.05, Math.min(o[2], o[2] + d[2] * maxT) - 0.05, Math.max(o[0], o[0] + d[0] * maxT) + 0.05, Math.max(o[2], o[2] + d[2] * maxT) + 0.05)) { const t = rayTri(o, d, tris[i]); if (t >= -1e-4 && t < best) best = t; } return best <= maxT ? best : Infinity; };
// çarpışma ızgarası
const CG = new Map(), CC = 2;
C.forEach((c, i) => { if (c.max[0] - c.min[0] > 200 || c.max[2] - c.min[2] > 200) return; for (let x = Math.floor(c.min[0] / CC); x <= Math.floor(c.max[0] / CC); x++) for (let z = Math.floor(c.min[2] / CC); z <= Math.floor(c.max[2] / CC); z++) { const k = x * 4096 + z; let a = CG.get(k); if (!a) CG.set(k, (a = [])); a.push(i); } });
const inSolid = (x, y, z, skip = -1, e = 0) => { const r = Math.max(0, -e); for (let gx = Math.floor((x - r) / CC); gx <= Math.floor((x + r) / CC); gx++) for (let gz = Math.floor((z - r) / CC); gz <= Math.floor((z + r) / CC); gz++) { const a = CG.get(gx * 4096 + gz); if (a) for (const i of a) { if (i === skip) continue; const c = C[i]; if (x > c.min[0] + e && x < c.max[0] - e && y > c.min[1] + e && y < c.max[1] - e && z > c.min[2] + e && z < c.max[2] - e) return c; } } return null; };
const gh = (x, z) => T.heightAt(x, z);

// ── 1) iç içe ──
{
  const S = C.map((c, i) => i).filter((i) => { const c = C[i]; return c.max[0] - c.min[0] < 120 && c.max[2] - c.min[2] < 120; }).sort((a, b) => C[a].min[0] - C[b].min[0]);
  let diff = 0, same = 0, vol = 0; const groups = new Map();
  for (let p = 0; p < S.length; p++) { const a = C[S[p]]; for (let q = p + 1; q < S.length; q++) { const b = C[S[q]]; if (b.min[0] > a.max[0] - 0.02) break;
    const ox = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]), oy = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]), oz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    if (ox <= 0.02 || oy <= 0.02 || oz <= 0.02) continue;
    if (a.oid === b.oid) { same++; continue; }
    diff++; vol += ox * oy * oz;
    const key = [String(a.oid).split(':')[0], String(b.oid).split(':')[0]].sort().join(' × ');
    const g = groups.get(key) || { n: 0, ex: `${a.oid} × ${b.oid} @ ${((Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2).toFixed(1)},${((Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2).toFixed(1)}` }; g.n++; groups.set(key, g); } }
  R.icice = { farkliNesne: diff, ayniNesne: same, hacimM3: +vol.toFixed(2), gruplar: [...groups].sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([k, g]) => `${g.n}× ${k}  (örn. ${g.ex})`) };
}

// ── 2) z-fighting ──
{
  const buckets = new Map();
  tris.forEach((t, i) => {
    const d = t[9] * t[0] + t[10] * t[1] + t[11] * t[2];
    const key = Math.round(t[9] * 200) + ',' + Math.round(t[10] * 200) + ',' + Math.round(t[11] * 200) + ',' + Math.round(d * 100);
    let a = buckets.get(key); if (!a) buckets.set(key, (a = [])); a.push(i);
  });
  // komşu d kovaları da (5 mm eşiği kova sınırını aşabilir)
  const proj = (t) => { const ax = Math.abs(t[9]), ay = Math.abs(t[10]), az = Math.abs(t[11]); const drop = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2; const u = drop === 0 ? 1 : 0, v = drop === 2 ? 1 : 2; return [[t[u], t[v]], [t[3 + u], t[3 + v]], [t[6 + u], t[6 + v]]]; };
  const area2 = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const clip = (subj, clipP) => { let out = subj; const ccw = area2(clipP) > 0; for (let i = 0; i < clipP.length && out.length; i++) { const A = clipP[i], B = clipP[(i + 1) % clipP.length], inp = out; out = []; const side = (p) => { const c = (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]); return ccw ? c >= -1e-9 : c <= 1e-9; }; for (let j = 0; j < inp.length; j++) { const P = inp[j], Q = inp[(j + 1) % inp.length], pi = side(P), qi = side(Q); if (pi) out.push(P); if (pi !== qi) { const dx = Q[0] - P[0], dy = Q[1] - P[1], ex = B[0] - A[0], ey = B[1] - A[1], den = dx * ey - dy * ex; if (Math.abs(den) > 1e-12) { const s = ((A[0] - P[0]) * ey - (A[1] - P[1]) * ex) / den; out.push([P[0] + dx * s, P[1] + dy * s]); } } } } return out; };
  let pairs = 0, sameCol = 0, areaD = 0; const where = new Map();
  const bx = (t, k) => [Math.min(t[k], t[k + 3], t[k + 6]), Math.max(t[k], t[k + 3], t[k + 6])];
  for (const key of buckets.keys()) {
    const [a1, a2, a3, dd] = key.split(',').map(Number);
    const own = buckets.get(key), nxt = buckets.get([a1, a2, a3, dd + 1].join(',')) || [];
    if (own.length + nxt.length < 2) continue;
    // düzlem içi 2 m ızgara: yalnız aynı hücredeki çiftler; çift, kesişim kutusunun alt köşesinin hücresinde sayılır
    const pa = Math.abs(a1) >= Math.abs(a2) && Math.abs(a1) >= Math.abs(a3) ? 0 : Math.abs(a2) >= Math.abs(a3) ? 1 : 2, U = pa === 0 ? 1 : 0, V = pa === 2 ? 1 : 2;
    const cell = new Map(), CS = 2;
    const all = [...own.map((i) => [i, 0]), ...nxt.map((i) => [i, 1])];
    for (const [i, src] of all) { const t = tris[i], [u0, u1] = bx(t, U), [v0, v1] = bx(t, V); for (let x = Math.floor(u0 / CS); x <= Math.floor(u1 / CS); x++) for (let y = Math.floor(v0 / CS); y <= Math.floor(v1 / CS); y++) { const ck = x * 100003 + y; let a = cell.get(ck); if (!a) cell.set(ck, (a = [])); a.push([i, src]); } }
    for (const [ck, list] of cell) {
      if (list.length < 2) continue;
      for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
        if (list[p][1] && list[q][1]) continue;                                       // iki üçgen de komşu kovada: o kovanın işi
        const A = tris[list[p][0]], B = tris[list[q][0]];
        const dA = A[9] * A[0] + A[10] * A[1] + A[11] * A[2], dB = A[9] * B[0] + A[10] * B[1] + A[11] * B[2];
        if (Math.abs(dA - dB) > 0.005 || A[9] * B[9] + A[10] * B[10] + A[11] * B[11] < 0.999) continue;
        let sep = false; for (const k of [0, 1, 2]) { const [a0, a9] = bx(A, k), [b0, b9] = bx(B, k); if (a9 < b0 + 0.005 || b9 < a0 + 0.005) sep = true; }
        if (sep) continue;
        const iu = Math.max(bx(A, U)[0], bx(B, U)[0]), iv = Math.max(bx(A, V)[0], bx(B, V)[0]);
        if (Math.floor(iu / CS) * 100003 + Math.floor(iv / CS) !== ck) continue;      // çift tek kez
        const inter = clip(proj(A), proj(B)), ar = Math.abs(area2(inter));
        if (ar < 1e-4) continue;
        if (A[13] === B[13]) { sameCol++; if (process.env.QA_V) console.error('aynıRenk', oids[A[12]], oids[B[12]], A[0].toFixed(2), A[1].toFixed(2), A[2].toFixed(2)); continue; }
        pairs++; areaD += ar;
        const k = [oids[A[12]], oids[B[12]]].map((s) => String(s).split(':')[0]).sort().join(' × ');
        const w = where.get(k) || { n: 0, ex: `${oids[A[12]]} × ${oids[B[12]]} @ ${A[0].toFixed(1)},${A[1].toFixed(1)},${A[2].toFixed(1)}` }; w.n++; where.set(k, w);
      }
    }
  }
  R.zfight = { titreyenCift: pairs, alanM2: +areaD.toFixed(2), ayniRenkCakisan: sameCol, gruplar: [...where].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([k, w]) => `${w.n}× ${k} (örn. ${w.ex})`) };
}

// ── 3) görünmez çarpışma: kutu yüzeyi örnekleri ──
{
  let pts = 0, bad = 0, badBand = 0, round = 0; const per = new Map();
  const ST = 0.25;
  C.forEach((c, ci) => {
    if (c.max[0] - c.min[0] > 120 || c.max[2] - c.min[2] > 120) return;
    for (let ax = 0; ax < 3; ax++) for (const sd of [-1, 1]) {
      const u = (ax + 1) % 3, v = (ax + 2) % 3, plane = sd > 0 ? c.max[ax] : c.min[ax];
      for (let a = c.min[u] + ST / 2; a < c.max[u]; a += ST) for (let bb = c.min[v] + ST / 2; bb < c.max[v]; bb += ST) {
        const p = [0, 0, 0]; p[ax] = plane; p[u] = a; p[v] = bb;
        const o = [p[0], p[1], p[2]]; o[ax] += sd * 0.04;
        if (inSolid(o[0], o[1], o[2], ci) || o[1] < gh(o[0], o[2]) - 0.02) continue;          // iç / gömülü yüz
        if (o[1] > 30) continue;
        pts++;
        const d = [0, 0, 0]; d[ax] = -sd; o[ax] = plane + sd * 0.25;
        const t = firstHit(o, d, 0.25 + 0.06);
        if (t === Infinity && /^(palmiye|kasa)/.test(String(c.oid)) && c.max[0] - c.min[0] < 1.0 && c.max[2] - c.min[2] < 1.0 && Math.abs((c.max[0] - c.min[0]) - (c.max[2] - c.min[2])) < 0.02) { round++; continue; }
        if (t === Infinity && process.env.QA_V && Math.random() < 0.05) console.error('görünmez', c.oid, p.map((v) => v.toFixed(2)).join(','));
        if (t === Infinity) { bad++; const g = gh(p[0], p[2]); const band = p[1] < g + 2.4; if (band) badBand++; const k = String(c.oid).split(':')[0]; per.set(k, (per.get(k) || 0) + 1); }
      }
    }
  });
  R.gorunmezCarpisma = { ornek: pts, yuvarlakKosePayiM2: +(round * ST * ST).toFixed(2), gorselsiz: bad, alanM2: +(bad * ST * ST).toFixed(2), erisilebilirBantta: badBand, erisilebilirAlanM2: +(badBand * ST * ST).toFixed(2), nesneTuru: [...per].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k}: ${(n * ST * ST).toFixed(1)} m²`) };
}

// ── 4) görsel ama çarpışmasız (erişilebilir bant) ──
{
  const SKIP = /^(zemin-süs|çatı-süs|dış-çevre|ip:|çanak|arazi|zemin|kenar|parça)/;
  let area = 0, aBad = 0; const per = new Map(); let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const t of tris) {
    const oid = String(oids[t[12]]);
    if (SKIP.test(oid)) continue;
    const ar = t[14]; if (ar < 1e-5) continue;
    const ns = Math.min(40, Math.max(1, Math.round(ar / 0.02)));
    for (let s = 0; s < ns; s++) {
      let r1 = rnd(), r2 = rnd(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      const x = t[0] + (t[3] - t[0]) * r1 + (t[6] - t[0]) * r2, y = t[1] + (t[4] - t[1]) * r1 + (t[7] - t[1]) * r2, z = t[2] + (t[5] - t[2]) * r1 + (t[8] - t[2]) * r2;
      const g = gh(x, z);
      if (y < g + 0.02 || y > g + 2.2) continue;
      const w = ar / ns; area += w;
      const ix = x - t[9] * 0.12, iy = y - t[10] * 0.12, iz = z - t[11] * 0.12;
      if (inSolid(x, y, z, -1, -0.15) || iy < gh(ix, iz) + 0.01) continue;                // katı kutunun 15 cm çevresinde (süs payı: oyuncu yarıçapı 0,32 m) ya da zeminin içinde
      // yüzün arkasında 12 cm içinde başka bir görsel yüz (ince levha: kapı kanadı / tente) — katı sayılmaz; yalnız kutu içinden geçilen hacim önemli
      aBad += w; const k = oid.split(':')[0]; per.set(k, (per.get(k) || 0) + w); if (process.env.QA_V) console.error('çarpışmasız', oid, x.toFixed(2), y.toFixed(2), z.toFixed(2), 'zemin+', (y - g).toFixed(2));
    }
  }
  R.gorselCarpismasiz = { bantAlanM2: +area.toFixed(1), carpismasizM2: +aBad.toFixed(2), nesneTuru: [...per].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}: ${v.toFixed(2)} m²`) };
}

// ── 5) havada / gömülü ──
{
  const box = new Map();
  for (const t of tris) { const oid = String(oids[t[12]]); let b = box.get(oid); if (!b) box.set(oid, (b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9])); for (let k = 0; k < 9; k += 3) { b[0] = Math.min(b[0], t[k]); b[1] = Math.min(b[1], t[k + 1]); b[2] = Math.min(b[2], t[k + 2]); b[3] = Math.max(b[3], t[k]); b[4] = Math.max(b[4], t[k + 1]); b[5] = Math.max(b[5], t[k + 2]); } }
  const touchC = (b, oid) => { const e = 0.03; for (const c of C) if (c.oid !== oid && b[0] - e < c.max[0] && b[3] + e > c.min[0] && b[1] - e < c.max[1] && b[4] + e > c.min[1] && b[2] - e < c.max[2] && b[5] + e > c.min[2]) return true; return false; };
  let floating = [], buried = [];
  for (const [oid, b] of box) {
    if (/^(arazi|zemin|kenar|bina|çevre|dış-çevre|parça|çatı-süs|ip:|çanak|cephe|pencere|süs-kapı|pano|tabela|zemin-süs)/.test(oid)) continue;
    if (b[3] - b[0] > 60 || b[5] - b[2] > 60) continue;
    let g = -1e9; for (const fx of [0.1, 0.5, 0.9]) for (const fz of [0.1, 0.5, 0.9]) g = Math.max(g, gh(b[0] + (b[3] - b[0]) * fx, b[2] + (b[5] - b[2]) * fz));
    let gmin = 1e9; for (const fx of [0.1, 0.5, 0.9]) for (const fz of [0.1, 0.5, 0.9]) gmin = Math.min(gmin, gh(b[0] + (b[3] - b[0]) * fx, b[2] + (b[5] - b[2]) * fz));
    const onGround = b[1] <= g + 0.04, hasC = C.some((c) => c.oid === oid);
    if (!onGround && !touchC(b, hasC ? oid : null)) floating.push(`${oid} @ ${((b[0] + b[3]) / 2).toFixed(1)},${b[1].toFixed(2)},${((b[2] + b[5]) / 2).toFixed(1)} (zemin ${g.toFixed(2)})`);
    if (/^(kasa|sandık|fıçı|varil|araç)/.test(oid) && !/:kaide$/.test(oid) && b[1] < g - 0.25 && b[4] > gmin) buried.push(`${oid} @ ${((b[0] + b[3]) / 2).toFixed(1)},${((b[2] + b[5]) / 2).toFixed(1)}: taban ${b[1].toFixed(2)} / zemin ${g.toFixed(2)}`);
  }
  R.havadaGomulu = { havada: floating.length, gomulu: buried.length, havadaOrnek: floating.slice(0, 12), gomuluOrnek: buried.slice(0, 12) };
}

// ── 6) piksel / esneme ──
{
  let steepA = 0, steepN = 0;
  for (const t of tris) { const oid = String(oids[t[12]]); if (!/^(arazi|zemin)($|:)/.test(oid)) continue; if (/\|15$/.test(t[13])) continue;                   // taş pah (kenar taşı sınıfı): kum gerilmesi değil
    const ny = Math.abs(t[10]); if (ny < 0.866 && ny > 0.05) { steepA += t[14]; steepN++; } }
  const nav = new NavGrid(C, m.bounds, T, !!m.layered);
  let runs = 0, shortRuns = 0;
  const B = (x, z) => x < 0 || z < 0 || x >= nav.w || z >= nav.h || nav.blocked[z * nav.w + x];
  for (const dir of [0, 1]) {
    const NA = dir ? nav.w : nav.h, NB = dir ? nav.h : nav.w;
    for (let a = 0; a < NA; a++) { let len = 0, prev = 0;
      for (let bb = 0; bb <= NB; bb++) {
        const s = bb < NB ? (dir ? (B(a, bb) ? 1 : 0) - (B(a + 1, bb) ? 1 : 0) : (B(bb, a) ? 1 : 0) - (B(bb, a + 1) ? 1 : 0)) : 0;
        if (s !== prev) { if (prev) { runs++; if (len <= 2) shortRuns++; } prev = s; len = 0; }
        if (s) len++;
      } }
  }
  R.pikselEsneme = { gerilmisZeminUcgeni: steepN, gerilmisAlanM2: +steepA.toFixed(1), yolSinirKosusu: runs, testereDisi: shortRuns };
  // ── 7) sızıntı ──
  const b0 = m.spawns.blue[0], seen = nav.reachable(b0.x, b0.z);
  const bx = m.playArea || m.bounds; let out = 0, reach = 0;
  for (let i = 0; i < seen.length; i++) { if (!seen[i]) continue; reach++; const x = nav.cx(i), z = nav.cz(i); if (x < bx.minX + 0.5 || x > bx.maxX - 0.5 || z < bx.minZ + 0.5 || z > bx.maxZ - 0.5) out++; }
  R.sizinti = { erisilebilirHucre: reach, sinirDisi: out };
}
console.log(JSON.stringify(R, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
