// Vagon rayı (Vagon modu): eksen hizalı köşe noktaları + köşelerde R yarıçaplı yumuşak dönüş (ikinci derece Bezier). Harita (ray çizimi) ve mod (vagon konumu) aynı yolu kullanır.
// makeTrack(pts, R) → { len, parts:[{a:[x,z], b:[x,z]}], corners:[d], at(d) → {x, z, yaw, dx, dz} }   yaw: 0 = −z'ye bakar (oyun kuralı)
export function makeTrack(pts, R = 2.5) {
  const parts = [], corners = [];
  const n = pts.length, norm = (x, z) => { const L = Math.hypot(x, z) || 1; return [x / L, z / L]; };
  let len = 0;
  const add = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) return; parts.push({ a, b, d0: len, L }); len += L; };
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], b = pts[i + 1], [dx, dz] = norm(b[0] - a[0], b[1] - a[1]);
    const s = i > 0 ? [a[0] + dx * R, a[1] + dz * R] : a, e = i + 1 < n - 1 ? [b[0] - dx * R, b[1] - dz * R] : b;
    add(s, e);
    if (i + 1 < n - 1) {                                                         // köşe: S → (kontrol: köşe) → E, 10 parça
      const c = pts[i + 2], [ex, ez] = norm(c[0] - b[0], c[1] - b[1]), E = [b[0] + ex * R, b[1] + ez * R];
      let prev = e;
      for (let k = 1; k <= 10; k++) {
        const t = k / 10, u = 1 - t, q = [u * u * e[0] + 2 * u * t * b[0] + t * t * E[0], u * u * e[1] + 2 * u * t * b[1] + t * t * E[1]];
        add(prev, q); prev = q;
        if (k === 5) corners.push(len);                                          // kontrol noktası = köşe yayının ortası
      }
    }
  }
  const at = (d, out = {}) => {
    d = Math.max(0, Math.min(len, d));
    let lo = 0, hi = parts.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (parts[m].d0 <= d) lo = m; else hi = m - 1; }
    const p = parts[lo], t = Math.min(1, (d - p.d0) / p.L), dx = (p.b[0] - p.a[0]) / p.L, dz = (p.b[1] - p.a[1]) / p.L;
    out.x = p.a[0] + (p.b[0] - p.a[0]) * t; out.z = p.a[1] + (p.b[1] - p.a[1]) * t; out.dx = dx; out.dz = dz; out.yaw = Math.atan2(-dx, -dz);
    return out;
  };
  // (x, z) noktasının raya en yakın uzaklığı ve o noktanın yol mesafesi (botlar / testler)
  const nearest = (x, z) => {
    let best = 1e9, bd = 0;
    for (const p of parts) {
      const vx = p.b[0] - p.a[0], vz = p.b[1] - p.a[1], t = Math.max(0, Math.min(1, ((x - p.a[0]) * vx + (z - p.a[1]) * vz) / (p.L * p.L)));
      const qx = p.a[0] + vx * t, qz = p.a[1] + vz * t, dd = Math.hypot(x - qx, z - qz);
      if (dd < best) { best = dd; bd = p.d0 + p.L * t; }
    }
    return { dist: best, d: bd };
  };
  return { len, parts, corners, at, nearest, pts };
}
