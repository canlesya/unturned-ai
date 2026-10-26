import { UK } from './us-surface.js';
import { PAL, LAMP_COOL } from './us-kit.js';

// Askeri Üs v3 — hangar: oluklu sac duvar (alt 1 m beton bant), çelik portal çerçeveler (iç yüze yaslı kolon + tavan kirişi), beşik çatı (çatı ulaşılmaz),
// önde (yerel +z) geniş açıklık + açık konumda sürgülü kapı kanatları (duvarın dış yüzünde, iki rayda), yan / arka personel kapıları, üst pencere bandı,
// arka duvar boyunca asma kat (3,25 m ızgara güverte, kolonlar, korkuluk, merdiven). Zemin = harita zemin bölümlemesi (hangar betonu).
// o: { x0, x1, z0, z1, h = 8, openW = 14, openH = 6.4, doors: { w:[z…], e:[z…], n:[x…] }, mezz: { d = 3.2, x0, x1, stairX }, col, label, num }
export function hangar(K, o) {
  const out = {};
  const { x0, x1, z0, z1 } = o, H = o.h || 8, T = 0.25, cx = (x0 + x1) / 2, W = x1 - x0, oW = o.openW || 14, oH = o.openH || 6.4;
  const col = o.col || '#7e8783', base = [{ y0: 0, y1: 1.0, col: PAL.concD, kind: UK.CONC }, { y0: H - 0.4, y1: H, col: o.trim || '#5a6166', kind: UK.STEEL, out: 0.03 }];
  const frame = { col: '#3d4248', kind: UK.STEEL, jw: 0.1, out: 0.04 }, pd = (at) => ({ at, w: 1.7, b: 0, top: 2.3, frame });
  const clere = (a0, a1) => { const r = []; for (let a = a0 + 3; a < a1 - 2.5; a += 4) r.push({ at: a, w: 2.4, b: H - 2.0, top: H - 1.0, glass: '#a9c8d8', frame: { col: '#3d4248', kind: UK.STEEL, jw: 0.08, out: 0.03 } }); return r; };
  const dz = o.doors || {};
  // ön duvar (z1): açıklık + üst kiriş bandı; arka (z0); yanlar (x0 / x1) köşeler arasında
  const baseNS = base.map((q) => (q.out ? { ...q, ext: q.out } : q));
  K.wall('x', x0, x1, z1 - T / 2, 0, H, T, col, UK.CLAD, [{ at: cx, w: oW, b: 0, top: oH }], baseNS, 1);
  K.wall('x', x0, x1, z0 + T / 2, 0, H, T, col, UK.CLAD, [...(dz.n || []).map(pd)], baseNS, -1);
  const sideOps = (list, a0, a1) => { const ops = (list || []).map(pd); for (const c of clere(a0, a1)) if (!ops.some((p) => Math.abs(p.at - c.at) < 2.2)) ops.push(c); return ops; };
  K.wall('z', z0 + T, z1 - T, x0 + T / 2, 0, H, T, col, UK.CLAD, sideOps(dz.w, z0 + T, z1 - T), base, -1);
  K.wall('z', z0 + T, z1 - T, x1 - T / 2, 0, H, T, col, UK.CLAD, sideOps(dz.e, z0 + T, z1 - T), base, 1);
  // açıklık çerçevesi: iki çelik kolon (açıklık kenarında, duvarın içinde değil: açıklığa doğru) + kiriş altı sarı-siyah bant
  for (const sx of [-1, 1]) K.sr(cx + sx * oW / 2 - (sx > 0 ? 0.35 : 0), cx + sx * oW / 2 + (sx < 0 ? 0.35 : 0), 0, oH, z1 - T - 0.05, z1 + 0.05, '#3d4248', UK.STEEL);
  K.sr(cx - oW / 2 + 0.35, cx + oW / 2 - 0.35, oH - 0.35, oH, z1 - T - 0.05, z1 + 0.05, PAL.yellow, UK.HATCH);
  // sürgülü kanatlar (açık): her yanda 2 kanat, iki ray (dış yüzden 0,06 / 0,32), kanat 0,2 kalın; üst ray kirişi
  const leafW = Math.min(4.2, (W - oW) / 2 - 0.4);
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
    const zz = z1 + 0.06 + i * 0.26, a = cx + sx * (oW / 2 + 0.3 + i * 0.6), b = a + sx * leafW;
    K.sr(Math.min(a, b), Math.max(a, b), 0.05, oH + 0.2, zz, zz + 0.2, i ? '#6d777a' : '#77807f', UK.CLAD);
    K.d((a + b) / 2, 1.0, zz + 0.215, leafW - 0.6, 0.12, 0.03, PAL.yellow, UK.PAINT);
  }
  K.d(cx, oH + 0.2, z1 + 0.29, W - 0.6, 0.2, 0.58, '#3d4248', UK.STEEL);
  // çatı: beşik (mahya z boyunca), saçak 0,3 m; alın üçgeni ön / arka yüzde
  K.b.withKind(UK.CLAD, () => K.b.prism(cx, H, (z0 + z1) / 2, W + 0.6, o.rise || 2.4, z1 - z0 + 0.5, o.roofCol || '#6a7176'));
  // portal çerçeveler: 6 m'de bir iki yan kolon (iç yüze yaslı) + tavan kirişi (süs, kolon tepesinde)
  const n = Math.max(2, Math.round((z1 - z0) / 6)), st = (z1 - z0 - 2 * T) / n;
  for (let i = 1; i < n; i++) {
    const z = z0 + T + i * st;
    for (const sx of [-1, 1]) if (!((sx < 0 ? dz.w : dz.e) || []).some((d) => Math.abs(d - z) < 1.4)) K.sr(sx < 0 ? x0 + T : x1 - T - 0.3, sx < 0 ? x0 + T + 0.3 : x1 - T, 0, H, z - 0.2, z + 0.2, '#454b51', UK.STEEL);
    K.dr(x0 + T + 0.3, x1 - T - 0.3, H - 0.5, H, z - 0.15, z + 0.15, '#454b51', UK.STEEL);
    for (let x = x0 + 4; x < x1 - 3; x += 7) { K.lit(x, H - 0.55, z, 0.8, 0.05, 0.8, LAMP_COOL); K.lamp(x, H - 1.5, z, 14, 1.0, '#eef4ff'); }
  }
  // asma kat (arka duvar boyunca)
  const M = o.mezz;
  if (M) {
    const md = M.d || 3.2, mz0 = z0 + T, mz1 = mz0 + md, mx0 = M.x0 ?? x0 + T, mx1 = M.x1 ?? x1 - T, DK = 3.25;
    K.sr(mx0, mx1, DK - 0.2, DK, mz0, mz1, '#4a5056', UK.GRATE);
    const cn = Math.max(2, Math.round((mx1 - mx0) / 4));
    for (let i = 0; i <= cn; i++) { const x = mx0 + 0.15 + i * ((mx1 - mx0 - 0.3) / cn); K.sr(x - 0.12, x + 0.12, 0, DK - 0.2, mz1 - 0.26, mz1 - 0.02, '#3d4248', UK.STEEL); }
    const sx = M.stairX ?? mx1 - 1.2, sw = 1.2, len = 13 * 0.28;
    // korkuluk: ön kenar (merdiven başında açık) + yan uçlar (duvara değmiyorsa)
    for (const [a, b] of [[mx0, sx - sw / 2], [sx + sw / 2, mx1]]) if (b - a > 0.1) { K.sr(a, b, DK, DK + 0.94, mz1 - 0.06, mz1, PAL.steelL, UK.STEEL); K.sr(a, b, DK + 0.94, DK + 1.0, mz1 - 0.06, mz1, PAL.yellow, UK.PAINT); }
    if (mx0 > x0 + T + 0.05) K.sr(mx0, mx0 + 0.06, DK, DK + 1.0, mz0, mz1 - 0.06, PAL.steelL, UK.STEEL);
    if (mx1 < x1 - T - 0.05) K.sr(mx1 - 0.06, mx1, DK, DK + 1.0, mz0, mz1 - 0.06, PAL.steelL, UK.STEEL);
    K.stair(sx, mz1 + len, 0, '-z', sw, 13, 0.25, 0.28, '#5a6168', UK.STEEL);
    out.mezz = { mx0, mx1, mz0, mz1, sx, sw, stairZ1: mz1 + len };
  }
  // ön / iç tabelalar
  if (o.label) { K.sign(o.label, 6.5, 1.3, cx, oH + 0.6, z1 + 0.6, 0, '#f2f2ee', '#2d3a2e'); }
  if (o.num) { K.sign(o.num, 2.2, 2.2, x0 + 2.6, H - 3.4, z1 + 0.03, 0, '#e8e6df', null); K.sign(o.num, 2.2, 2.2, x1 - 2.6, H - 3.4, z1 + 0.03, 0, '#e8e6df', null); }
  return out;
}
