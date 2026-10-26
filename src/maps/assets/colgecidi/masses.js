import * as THREE from 'three';
import { T_FLOOR, T_MASS, T_OUT } from './layout.js';
import { CK } from '../common/cgSurface.js';
import { MASSES, OUTSIDE } from './plan.js';

// Bina kütleleri (12.171): plan hücrelerinden. Çarpışma = plan dikdörtgenleri (tabandan tepeye); görsel = yalnız DIŞA bakan yüzler (aynı düzlemde
// kesintisiz koşular) + çatı + çatı korkuluğu. İç (bitişik kütleler arası) yüz yok → iç içe / üst üste binen duvar yüzü, ışık sızıntısı yok.
// Bir kütlenin yanındaki daha alçak kütlenin üstünde kalan kısım çizilir (kademeli çatı hattı). Korkuluk: açık kenardaki hücre şeridi (0,5 m), 0,45 m.
export const RIM_H = 0.45, OUT_TOP = 12.5;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const I4 = new THREE.Matrix4();

function geo(pos) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// colorOf(id) → duvar rengi; roofOf(id) → çatı rengi. Döner: { faces: [{id, s, a, b, y0, y1, street}] } (cephe süsü için sokak yüzleri)
export function buildMasses(b, T, { colorOf, roofOf, rimSkip = () => false }) {
  const L = T.L, C = L.C, nx = L.nx;
  const idOf = (k) => (k < 0 ? -2 : L.type[k] === T_MASS ? L.mass[k] : L.type[k] === T_OUT ? -2 : -1);       // −1 zemin, −2 dış
  const topOf = (k) => (k < 0 || L.type[k] === T_OUT ? OUT_TOP : L.type[k] === T_MASS ? L.top[k] : -1e9);
  const name = (id) => (id === -2 ? 'çevre' : id === 900 ? 'titanic-duvarı' : id === 901 ? 'B-penceresi' : 'bina:' + id);
  // ── çarpışma: plan dikdörtgenleri ──
  const baseOf = (x0, z0, x1, z1) => { let m = 1e9; for (let z = z0 + C / 2; z < z1; z += C) for (let x = x0 + C / 2; x < x1; x += C) m = Math.min(m, L.ground[L.cellOf(x, z)]); return m - 0.5; };
  for (const [id, top, x0, z0, x1, z1] of MASSES) { if (id === 901) continue; const y0 = baseOf(x0, z0, x1, z1); b.obj(name(id), () => b.collide((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, top - y0, z1 - z0, 'wall')); }
  for (const [x0, z0, x1, z1] of OUTSIDE) { const y0 = baseOf(x0, z0, x1, z1); b.obj('çevre', () => b.collide((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, OUT_TOP - y0, z1 - z0, 'wall')); }
  // ── yüzler: her hücre kenarı; komşu zeminse tabandan tepeye, komşu alçak kütleyse onun tepesinden ──
  const faces = [];
  const done = new Uint8Array(L.N * 4);
  for (let k = 0; k < L.N; k++) {
    if (L.type[k] === T_FLOOR) continue;
    const id = idOf(k); if (id === 901) continue;
    for (let s = 0; s < 4; s++) {
      if (done[k * 4 + s]) continue;
      const i = k % nx, j = (k / nx) | 0, m = L.at(i + SIDES[s][0], j + SIDES[s][1]);
      const top = topOf(k), nid = m < 0 ? -3 : idOf(m), ntop = m < 0 ? -1e9 : topOf(m), street = nid === -1, border = m < 0;
      if (!street && !border && ntop >= top - 1e-3) continue;
      const along = s < 2 ? [0, 1] : [1, 0];
      const key = (kk, mm) => idOf(kk) + '|' + topOf(kk) + '|' + (mm < 0 ? 'sınır' : idOf(mm) === -1 ? 'z' : topOf(mm));
      const nb = (ii, jj) => (ii < 0 || jj < 0 || ii >= nx || jj >= L.nz ? -1 : jj * nx + ii);         // ızgara dışı: −1 (harita sınırı)
      const k0 = key(k, m);
      let ci = i, cj = j;
      for (;;) { const pk = L.at(ci - along[0], cj - along[1]); if (pk < 0 || done[pk * 4 + s] || L.type[pk] === T_FLOOR) break; const pm = nb(ci - along[0] + SIDES[s][0], cj - along[1] + SIDES[s][1]); if (key(pk, pm) !== k0) break; ci -= along[0]; cj -= along[1]; }
      let y0 = 1e9, n = 0, ti = ci, tj = cj;
      const first = [ci, cj];
      for (;; ti += along[0], tj += along[1]) {
        const tk = L.at(ti, tj); if (tk < 0 || done[tk * 4 + s] || L.type[tk] === T_FLOOR) break;
        const tm = nb(ti + SIDES[s][0], tj + SIDES[s][1]); if (key(tk, tm) !== k0) break;
        done[tk * 4 + s] = 1; n++;
        if (street) { const [ea, eb] = T.edgePts(ti, tj, s); y0 = Math.min(y0, T.cellH(tm, ea[0] + SIDES[s][0] * 1e-4, ea[1] + SIDES[s][1] * 1e-4), T.cellH(tm, eb[0] + SIDES[s][0] * 1e-4, eb[1] + SIDES[s][1] * 1e-4)); }
        if (border) y0 = Math.min(y0, L.ground[tk] - 0.5);
      }
      const last = [ti - along[0], tj - along[1]];
      const a = T.edgePts(first[0], first[1], s)[0], bb = T.edgePts(last[0], last[1], s)[1];
      faces.push({ id, s, a, b: bb, y0: street || border ? y0 : ntop, g: street ? y0 : ntop, y1: top, street, border, n });
    }
  }
  // dörtgenler: kütle başına tek geometri (editör: bina:<no> seçilince yüzleri + çatısı birlikte)
  const per = new Map();
  const push = (id, arr) => { let p = per.get(id); if (!p) per.set(id, (p = { wall: [], roof: [] })); p.wall.push(...arr); };
  for (const f of faces) {
    const { a, b: bb, s } = f, y0 = f.street ? f.y0 - 0.3 : f.y0, y1 = f.y1;
    const A0 = [a[0], y0, a[1]], B0 = [bb[0], y0, bb[1]], A1 = [a[0], y1, a[1]], B1 = [bb[0], y1, bb[1]];
    // yüz dışa (komşuya) bakar: s=0 → +x, s=1 → −x, s=2 → +z, s=3 → −z
    push(f.id, s === 0 || s === 3 ? [...A0, ...A1, ...B1, ...A0, ...B1, ...B0] : [...A0, ...B1, ...A1, ...A0, ...B0, ...B1]);
  }
  // çatı (korkuluk hücreleri hariç) + korkuluk
  const rimCell = new Uint8Array(L.N);
  for (let k = 0; k < L.N; k++) {
    if (L.type[k] === T_FLOOR || idOf(k) === 901) continue;
    const i = k % nx, j = (k / nx) | 0, top = topOf(k);
    for (let s = 0; s < 4; s++) { const m = L.at(i + SIDES[s][0], j + SIDES[s][1]); if (m >= 0 && (L.type[m] === T_FLOOR || topOf(m) < top - 0.3) && !rimSkip(k)) rimCell[k] = 1; }
  }
  const groups = new Map();
  for (let k = 0; k < L.N; k++) { if (L.type[k] === T_FLOOR || idOf(k) === 901) continue; const key = idOf(k) + '|' + topOf(k) + '|' + rimCell[k]; let g = groups.get(key); if (!g) groups.set(key, (g = new Set())); g.add(k); }
  const rims = [];
  for (const [key, set] of groups) {
    const [id, top, rim] = key.split('|').map(Number);
    for (const k of [...set].sort((p, q) => p - q)) {
      if (!set.has(k)) continue;
      const i = k % nx, j = (k / nx) | 0;
      let i2 = i; while (set.has(j * nx + i2 + 1) && i2 + 1 < nx) i2++;
      let j2 = j; for (;;) { let ok = j2 + 1 < L.nz; for (let t = i; t <= i2 && ok; t++) if (!set.has((j2 + 1) * nx + t)) ok = false; if (!ok) break; j2++; }
      for (let jj = j; jj <= j2; jj++) for (let ii = i; ii <= i2; ii++) set.delete(jj * nx + ii);
      const x0 = L.x0 + i * C, x1 = L.x0 + (i2 + 1) * C, z0 = L.z0 + j * C, z1 = L.z0 + (j2 + 1) * C;
      if (rim) rims.push({ id, top, x0, z0, x1, z1 });
      else { let p = per.get(id); if (!p) per.set(id, (p = { wall: [], roof: [] })); p.roof.push(x0, top, z0, x0, top, z1, x1, top, z1, x0, top, z0, x1, top, z1, x1, top, z0); }
    }
  }
  for (const [id, p] of per) b.obj(name(id), () => {
    if (p.wall.length) b.addGeo(geo(p.wall), colorOf(id), I4).g.userData.kind = CK.PLASTER;
    if (p.roof.length) b.addGeo(geo(p.roof), roofOf(id), I4).g.userData.kind = CK.ROOF;
  });
  for (const r of rims) b.obj(name(r.id), () => b.box((r.x0 + r.x1) / 2, r.top, (r.z0 + r.z1) / 2, r.x1 - r.x0, RIM_H, r.z1 - r.z0, colorOf(r.id), { tag: 'wall', kind: CK.PLASTER }));
  return { faces, rims };
}
