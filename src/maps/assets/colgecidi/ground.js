import * as THREE from 'three';
import { T_FLOOR } from './layout.js';
import { BEVEL } from './terrain.js';
import { CK } from '../common/cgSurface.js';

// Zemin ağı (12.171): CgTerrain'in fonksiyonunun birebir çizimi. Düz / rampa hücreleri aynı özellikte (plan özelliği + yüzey türü) dikdörtgenlere
// birleşir; pahlı hücreler tam geometriyle (pah düzlemi + kalan düzlem, kırık çizgisi analitik); dikey istinat duvarları kenar koşuları hâlinde
// (kenar:<n> kimliği). Çizilen her yüzey = fizik yüzeyi; üst üste binen / iç içe yüzey yok.
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function geo(pos) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
const I4 = new THREE.Matrix4();

// kindAt(k) → CK türü; colorOf(kind) → renk; skipEdge(k, s) → true ise bu duvar kenarını başka parça (korkuluk / kemer) örter
export function buildGround(b, T, { kindAt, colorOf, wallColor, skipEdge = () => false, skipCell = () => false }) {
  const L = T.L, C = L.C, nx = L.nx;
  const S = new Map();                                 // anahtar → hücre listesi
  const bevelCells = [];
  for (let k = 0; k < L.N; k++) {
    if (L.type[k] !== T_FLOOR || skipCell(k)) continue;
    let bev = 0; for (let s = 0; s < 4; s++) if (T.edge[k * 4 + s] === 1) bev++;
    if (bev) { bevelCells.push(k); continue; }
    const key = L.spec[k] + '|' + kindAt(k);
    let a = S.get(key); if (!a) S.set(key, (a = new Set())); a.add(k);
  }
  let nq = 0;
  // ── düz / rampa yüzeyleri: aynı anahtarlı hücrelerden açgözlü dikdörtgen ──
  for (const [key, set] of S) {
    const kind = +key.split('|')[1], col = colorOf(kind), pos = [];
    const cells = [...set].sort((p, q) => p - q);
    for (const k of cells) {
      if (!set.has(k)) continue;
      const i = k % nx, j = (k / nx) | 0;
      let i2 = i; while (set.has(j * nx + i2 + 1) && (i2 + 1) < nx) i2++;
      let j2 = j; for (;;) { let ok = j2 + 1 < L.nz; for (let t = i; t <= i2 && ok; t++) if (!set.has((j2 + 1) * nx + t)) ok = false; if (!ok) break; j2++; }
      for (let jj = j; jj <= j2; jj++) for (let ii = i; ii <= i2; ii++) set.delete(jj * nx + ii);
      const x0 = L.x0 + i * C, x1 = L.x0 + (i2 + 1) * C, z0 = L.z0 + j * C, z1 = L.z0 + (j2 + 1) * C, sp = L.specs[L.spec[k]];
      const h = (x, z) => L.evalSpec(sp, x, z);
      pos.push(x0, h(x0, z0), z0, x0, h(x0, z1), z1, x1, h(x1, z1), z1, x0, h(x0, z0), z0, x1, h(x1, z1), z1, x1, h(x1, z0), z0);
      nq++;
    }
    b.obj('zemin', () => b.addGeo(geo(pos), col, I4)).g.userData.kind = kind;
  }
  // ── pahlı hücreler: tek pah → analitik (pah dörtgeni + kalan dörtgen); çok pah → 6×6 alt ızgara (köşede iki pahın kırığı) ──
  const pos = [];
  for (const k of bevelCells) {
    const i = k % nx, j = (k / nx) | 0, x0 = L.x0 + i * C, z0 = L.z0 + j * C, x1 = x0 + C, z1 = z0 + C;
    const sides = []; for (let s = 0; s < 4; s++) if (T.edge[k * 4 + s] === 1) sides.push(s);
    const H = (x, z) => T.cellH(k, x, z);
    if (sides.length === 1) {
      const s = sides[0];
      // kenar boyunca iki uç: a, b (kenar üstünde), iç doğrultu (kenardan hücre içine) n
      const [ea, eb] = T.edgePts(i, j, s), inn = s === 0 ? [-1, 0] : s === 1 ? [1, 0] : s === 2 ? [0, -1] : [0, 1];
      const inner = (e) => {                                               // pahın bittiği nokta: u − BEVEL·d = s(d)  (s doğrusal → iki adımda tam)
        const m = L.at(i + SIDES[s][0], j + SIDES[s][1]), u = L.surf(m, e[0], e[1]);
        let d = 0; for (let it = 0; it < 3; it++) { const sx = e[0] + inn[0] * d, sz = e[1] + inn[1] * d, sv = L.surf(k, sx, sz); const s0 = L.surf(k, e[0], e[1]), g = (sv - s0) / Math.max(d, 1e-6); d = Math.max(0, Math.min(C, (u - s0) / (BEVEL + (d > 1e-6 ? g : 0)))); }
        return [e[0] + inn[0] * d, e[1] + inn[1] * d];
      };
      const ia = inner(ea), ib = inner(eb), far = (e) => [e[0] + inn[0] * C, e[1] + inn[1] * C];
      const fa = far(ea), fb = far(eb);
      const V = (q) => [q[0], H(q[0] + inn[0] * 1e-5, q[1] + inn[1] * 1e-5), q[1]];
      const Ve = (q) => [q[0], L.surf(L.at(i + SIDES[s][0], j + SIDES[s][1]), q[0], q[1]), q[1]];     // kenarda pah tepesi = komşu kotu
      const quad = (A, B2, C2, D) => { const n = (P, Q, R) => ((Q[0] - P[0]) * (R[2] - P[2]) - (Q[2] - P[2]) * (R[0] - P[0])); const t = [A, B2, C2, A, C2, D]; if (n(A, B2, C2) > 0) { t[1] = C2; t[2] = B2; t[4] = D; t[5] = C2; } for (const v of t) pos.push(...v); };
      quad(Ve(ea), Ve(eb), V(ib), V(ia));
      quad(V(ia), V(ib), V(fb), V(fa));
    } else {
      const M = 6, step = C / M;
      for (let a = 0; a < M; a++) for (let c = 0; c < M; c++) {
        const xa = x0 + a * step, xb = xa + step, za = z0 + c * step, zb = za + step, e = 1e-5;
        const P = [[xa, H(Math.max(xa, x0 + e), Math.max(za, z0 + e)), za], [xa, H(Math.max(xa, x0 + e), Math.min(zb, z1 - e)), zb], [xb, H(Math.min(xb, x1 - e), Math.min(zb, z1 - e)), zb], [xb, H(Math.min(xb, x1 - e), Math.max(za, z0 + e)), za]];
        pos.push(...P[0], ...P[1], ...P[2], ...P[0], ...P[2], ...P[3]);
      }
    }
  }
  if (pos.length) b.obj('zemin:pah', () => b.addGeo(geo(pos), colorOf(CK.COPING), I4)).g.userData.kind = CK.COPING;
  // ── dikey istinat duvarları: alçak hücre k'nin s kenarı; aynı doğru üzerindeki ardışık kenarlar (iki yanın özelliği aynıysa) tek dörtgen ──
  const done = new Uint8Array(L.N * 4);
  let nk = 0;
  const runs = [];
  for (let k = 0; k < L.N; k++) for (let s = 0; s < 4; s++) {
    if (T.edge[k * 4 + s] !== 2 || done[k * 4 + s] || skipEdge(k, s)) continue;
    const i = k % nx, j = (k / nx) | 0, along = s < 2 ? [0, 1] : [1, 0];
    const m0 = L.at(i + SIDES[s][0], j + SIDES[s][1]), sk = L.spec[k], sm = L.spec[m0];
    // geriye doğru başa git
    let ci = i, cj = j;
    for (;;) { const pi = ci - along[0], pj = cj - along[1], pk = L.at(pi, pj); if (pk < 0 || T.edge[pk * 4 + s] !== 2 || done[pk * 4 + s] || skipEdge(pk, s) || L.spec[pk] !== sk || L.spec[L.at(pi + SIDES[s][0], pj + SIDES[s][1])] !== sm) break; ci = pi; cj = pj; }
    const cells = [];
    for (let ti = ci, tj = cj; ; ti += along[0], tj += along[1]) { const tk = L.at(ti, tj); if (tk < 0 || T.edge[tk * 4 + s] !== 2 || done[tk * 4 + s] || skipEdge(tk, s) || L.spec[tk] !== sk || L.spec[L.at(ti + SIDES[s][0], tj + SIDES[s][1])] !== sm) break; cells.push([ti, tj, tk]); done[tk * 4 + s] = 1; }
    if (!cells.length) continue;
    const [fi, fj, fk] = cells[0], [li, lj, lk] = cells[cells.length - 1];
    const a = T.edgePts(fi, fj, s)[0], bb = T.edgePts(li, lj, s)[1], mA = L.at(fi + SIDES[s][0], fj + SIDES[s][1]), mB = L.at(li + SIDES[s][0], lj + SIDES[s][1]);
    const ya0 = L.surf(fk, a[0], a[1]), yb0 = L.surf(lk, bb[0], bb[1]), ya1 = L.surf(mA, a[0], a[1]), yb1 = L.surf(mB, bb[0], bb[1]);
    runs.push({ s, a, b: bb, ya0, yb0, ya1, yb1, n: cells.length });
  }
  for (const r of runs) {
    const { a, b: bb, ya0, yb0 } = r, ya1 = Math.max(r.ya1, ya0), yb1 = Math.max(r.yb1, yb0);
    const A0 = [a[0], ya0, a[1]], B0 = [bb[0], yb0, bb[1]], A1 = [a[0], ya1, a[1]], B1 = [bb[0], yb1, bb[1]];
    // yüz normali alçak tarafa (k) bakar: s=0 (+x kenarı) → −x; s=1 → +x; s=2 → −z; s=3 → +z
    const flip = r.s === 1 || r.s === 2;
    const p = flip ? [...A0, ...A1, ...B1, ...A0, ...B1, ...B0] : [...A0, ...B1, ...A1, ...A0, ...B0, ...B1];
    b.obj('kenar:' + nk++, () => b.addGeo(geo(p), wallColor, I4)).g.userData.kind = CK.STONE;
  }
  return { quads: nq, bevels: bevelCells.length, walls: runs.length };
}
