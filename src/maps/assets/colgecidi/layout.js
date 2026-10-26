// Çöl Geçidi v2 (12.171): plan.js → hücre ızgarası. Hücre türü (zemin / bina kütlesi / dış), zemin kotu fonksiyonu (düz ya da eksen hizalı doğrusal
// rampa: aynı rampanın hücreleri ve rampa ucundaki düz kat köşelerde birebir aynı kotu verir), kütle no + tepe, kütle altı taban kotu.
// Hem sunucu (çarpışma / yol bulma) hem istemci (ağ) aynı veriyi kullanır; rastgelelik yok.
import { GRID, FLOORS, MASSES, OUTSIDE } from './plan.js';

export const T_FLOOR = 0, T_MASS = 1, T_OUT = 2;
let _cache = null;

export function cgLayout() {
  if (_cache) return _cache;
  const { x0, z0, cell: C, nx, nz } = GRID, N = nx * nz;
  const type = new Uint8Array(N).fill(T_OUT), spec = new Int16Array(N).fill(-1), mass = new Int32Array(N).fill(-1), top = new Float32Array(N);
  const specs = [], skey = new Map();
  const cellRange = (a, b, o) => [Math.round((a - o) / C), Math.round((b - o) / C)];
  const each = (r, fn) => { const [i0, i1] = cellRange(r[0], r[2], x0), [j0, j1] = cellRange(r[1], r[3], z0); for (let j = Math.max(0, j0); j < Math.min(nz, j1); j++) for (let i = Math.max(0, i0); i < Math.min(nx, i1); i++) fn(j * nx + i, i, j); };
  for (const f of FLOORS) {
    const [, , , , t, a, b, c, d] = f, key = [t, a, b, c, d].join(',');
    let si = skey.get(key);
    if (si === undefined) { si = specs.length; skey.set(key, si); specs.push(t === 'f' ? { t, h: a } : { t, a, ha: b, b: c, hb: d }); }
    each(f, (k) => { type[k] = T_FLOOR; spec[k] = si; });
  }
  for (const [id, tp, ...r] of MASSES) each(r, (k) => { type[k] = T_MASS; mass[k] = id; top[k] = tp; });
  for (const r of OUTSIDE) each(r, (k) => { type[k] = T_OUT; spec[k] = -1; });
  const evalSpec = (s, x, z) => (s.t === 'f' ? s.h : s.t === 'x' ? s.ha + (s.hb - s.ha) * (x - s.a) / (s.b - s.a) : s.ha + (s.hb - s.ha) * (z - s.a) / (s.b - s.a));
  // zemin hücresi merkez kotu; kütle / dış hücrede: komşu zeminlerden yayılan EN DÜŞÜK kot (bina tabanı / duvar dibi bunun altına iner)
  const ground = new Float32Array(N).fill(NaN);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let k = 0; k < N; k++) if (type[k] === T_FLOOR) { const i = k % nx, j = (k / nx) | 0; ground[k] = evalSpec(specs[spec[k]], x0 + (i + 0.5) * C, z0 + (j + 0.5) * C); q[qt++] = k; }
  while (qh < qt) {
    const k = q[qh++], i = k % nx, j = (k / nx) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const m = jj * nx + ii; if (type[m] === T_FLOOR) continue;
      if (Number.isNaN(ground[m])) { ground[m] = ground[k]; q[qt++] = m; }
    }
  }
  for (let k = 0; k < N; k++) if (Number.isNaN(ground[k])) ground[k] = 0;
  const L = {
    x0, z0, C, nx, nz, N, type, spec, specs, mass, top, ground, evalSpec,
    ci: (x) => Math.floor((x - x0) / C), cj: (z) => Math.floor((z - z0) / C),
    at(i, j) { return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; },
    // hücre k'nin (x, z) noktasındaki yüzeyi (nokta hücre sınırına kıstırılır: komşu hücre yüzeyini dışa uzatmaz)
    surf(k, x, z) {
      if (k < 0) return -50;
      if (type[k] !== T_FLOOR) return ground[k];
      const i = k % nx, j = (k / nx) | 0, ax = x0 + i * C, az = z0 + j * C;
      return evalSpec(specs[spec[k]], Math.min(ax + C, Math.max(ax, x)), Math.min(az + C, Math.max(az, z)));
    },
    cellOf(x, z) { const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; },
    isFloor(x, z) { const k = this.cellOf(x, z); return k >= 0 && type[k] === T_FLOOR; },
  };
  return (_cache = L);
}
