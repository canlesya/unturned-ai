// Kasaba asset kiti · alt düzey şekiller (paylaşılabilir; haritadan bağımsız). 12.168
// Kural: her görsel parça DIŞBÜKEY bir katıdır ve komşusuna yalnız DEĞER (iç içe girmez); çarpışma kutusu görselin İÇİNDE kalır
// (görünmez çarpışma yok). Eğik / yuvarlak parçalarda çarpışma, görselin içine çizilmiş basamaklı / artı biçimli eksen hizalı kutulardır.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

const _I = new THREE.Matrix4();
export const NC = { collide: false };

// Kutu (taban-merkez kuralı MapBuilder.box ile aynı) — kind açıkça verilir
export const box = (b, x, y, z, w, h, d, color, kind, opt = {}) => b.box(x, y, z, w, h, d, color, { ...opt, kind });
// Köşe koordinatlarıyla kutu: [x0,x1] × [y0,y1] × [z0,z1]
export const boxR = (b, x0, x1, y0, y1, z0, z1, color, kind, opt = {}) => {
  if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
  b.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, { ...opt, kind });
};

// Dışbükey zarf (noktalar o anki yerel çerçevede). Çarpışma eklemez.
export function hull(b, pts, color, kind, o) {
  const g = new ConvexGeometry(pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))));
  return b.withKind(kind, () => b.addGeo(g, color, _I, o));
}

// Dışbükey 2B kesitin bir eksen boyunca uzatılması. axis 'x': kesit (z, y) düzleminde, x0→x1; axis 'z': kesit (x, y), z0→z1.
export function extrude(b, axis, a0, a1, prof, color, kind, o) {
  const pts = [];
  for (const [u, y] of prof) for (const a of [a0, a1]) pts.push(axis === 'x' ? [a, y, u] : [u, y, a]);
  return hull(b, pts, color, kind, o);
}

// Yuvarlak gövde (fıçı, direk, gövde) için çarpışma: dik çokgen prizmanın İÇİNE çizilen "artı" iki kutu (görünmez kenar yok).
// Sekizgen, kenarları eksenlere paralel (post(): seg 8, ry π/8): kenar ortası a = r·cos22,5°, yarım kenar q = r·sin22,5° → kutular [±a × ±q] ve [±q × ±a]
// sekizgenin tam içindedir (alanın %79'u; köşegen kenarların üçgenleri çarpışmasız, birkaç cm).
export function roundCollide(b, x, y, z, r, h) {
  const a = r * Math.cos(Math.PI / 8) * 0.995, q = r * Math.sin(Math.PI / 8) * 0.995;
  b.collide(x, y, z, 2 * a, h, 2 * q);
  b.collide(x, y, z, 2 * q, h, 2 * a);
}

// Dik sekizgen prizma (direk / fıçı / gövde) + içine çizilmiş çarpışma. rTop < r ise koni kesiti (çarpışma üst yarıçapla).
export function post(b, x, y, z, r, h, color, kind, { collide = true, rTop = r, o } = {}) {
  b.cyl(x, y, z, rTop, r, h, color, { seg: 8, collide: false, kind, ry: Math.PI / 8, o });
  if (collide && Math.min(r, rTop) >= 0.06) roundCollide(b, x, y, z, Math.min(r, rTop), h);
}

// Beşik çatı / alın üçgeni için iç (basamaklı) çarpışma: eğik yüzün ALTINDA kalan eksen hizalı kutular.
// along 'x': mahya x boyunca, kesit z'de [c0,c1]; along 'z': mahya z boyunca, kesit x'te [c0,c1]. yb: saçak (taban) kotu, rh: mahya yüksekliği.
export function gableCollide(b, along, a0, a1, c0, c1, yb, rh, n = 5) {
  const half = (c1 - c0) / 2, cm = (c0 + c1) / 2, sw = half / n;
  for (let k = 0; k < n; k++) {
    const hk = rh * (k / n);                                      // basamağın DIŞ (alçak) kenarındaki eğik yüz yüksekliği
    if (hk < 0.05) continue;
    for (const sg of [-1, 1]) {
      const u0 = cm + sg * (half - (k + 1) * sw), u1 = cm + sg * (half - k * sw), lo = Math.min(u0, u1), hi = Math.max(u0, u1);
      if (along === 'x') b.collide((a0 + a1) / 2, yb, (lo + hi) / 2, a1 - a0, hk, hi - lo);
      else b.collide((lo + hi) / 2, yb, (a0 + a1) / 2, hi - lo, hk, a1 - a0);
    }
  }
}

// Eksen hizalı dikdörtgeni, içindeki dikdörtgen boşluklar dışında kalan dikdörtgenlere böler (üst üste binmeyen, birleşik şeritler).
// R = [a0, a1, b0, b1]; holes = [[a0,a1,b0,b1], ...]. Dönüş: [[a0,a1,b0,b1], ...]
export function subtractRects(R, holes) {
  const [A0, A1, B0, B1] = R;
  const hs = holes.map(([a0, a1, b0, b1]) => [Math.max(a0, A0), Math.min(a1, A1), Math.max(b0, B0), Math.min(b1, B1)]).filter(([a0, a1, b0, b1]) => a1 - a0 > 1e-4 && b1 - b0 > 1e-4);
  const cuts = new Set([A0, A1]); for (const h of hs) { cuts.add(h[0]); cuts.add(h[1]); }
  const xs = [...cuts].sort((p, q) => p - q);
  const strips = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a0 = xs[i], a1 = xs[i + 1]; if (a1 - a0 < 1e-4) continue;
    const am = (a0 + a1) / 2;
    const iv = hs.filter((h) => h[0] < am && h[1] > am).map((h) => [h[2], h[3]]).sort((p, q) => p[0] - q[0]);
    const free = []; let cur = B0;
    for (const [s, e] of iv) { if (s > cur + 1e-4) free.push([cur, s]); cur = Math.max(cur, e); }
    if (B1 > cur + 1e-4) free.push([cur, B1]);
    strips.push({ a0, a1, free });
  }
  // aynı serbest aralıklara sahip komşu şeritleri birleştir
  const out = [];
  let prev = null;
  for (const s of strips) {
    const key = s.free.map((f) => f[0].toFixed(4) + ':' + f[1].toFixed(4)).join('|');
    if (prev && prev.key === key && Math.abs(prev.a1 - s.a0) < 1e-6) { prev.a1 = s.a1; continue; }
    prev = { a0: s.a0, a1: s.a1, free: s.free, key }; out.push(prev);
  }
  const res = [];
  for (const s of out) for (const [b0, b1] of s.free) res.push([s.a0, s.a1, b0, b1]);
  return res;
}

// Aralığı (a0..a1) verilen boşluklar dışında kalan parçalara böler: [[s,e],...]
export function splitRange(a0, a1, gaps) {
  const g = gaps.map(([s, e]) => [Math.max(a0, s), Math.min(a1, e)]).filter(([s, e]) => e - s > 1e-4).sort((p, q) => p[0] - q[0]);
  const out = []; let cur = a0;
  for (const [s, e] of g) { if (s > cur + 1e-4) out.push([cur, s]); cur = Math.max(cur, e); }
  if (a1 > cur + 1e-4) out.push([cur, a1]);
  return out;
}

// Yaprak / çalı kümesi (ikosahedron, çarpışmasız). y: tabanın kotu (küme bu kota oturur). detail 0 → en alt köşe 0,8507·r·sy.
export const ICO_BOT = [0.8507, 1.0];
export function leaf(b, kind, x, y, z, r, color, { sy = 1, sx = 1, sz = sx, detail = 0, ry = 0 } = {}) {
  const cy = y + r * sy * ICO_BOT[detail];
  b.withKind(kind, () => b.ico(x, cy, z, r, color, { detail, scale: [sx, sy, sz], ry }));
  return cy;
}

// Renk tonlama (#rrggbb, k çarpan)
export const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
