import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { UK } from './us-surface.js';

// Askeri Üs v3 yapı kiti (12.170) — bütün askerî asset'lerin ortak tabanı. KURALLAR (usqa.mjs ölçer):
//  · katı parça = eksen hizalı kutu, görseli = çarpışması (box varsayılanı); dönüş yalnız 90°'nin katı (b.with) → AABB birebir
//  · katı parçalar birbirine yalnız YÜZ YÜZE değer (iç içe yok); renk / malzeme değişimi üst üste kaplama değil, kutuyu bölerek (bant)
//  · süs (çarpışmasız) ya ince (≤ 6 cm) ve bir katının yüzüne yaslı, ya da gövde bandının (0,1–1,7 m) dışında; aynı yöne bakan iki yüz ≥ 3 cm ayrık
//  · pencere açıklığı ≤ 1,2 m (eğilerek bile geçilmez, mermi geçer); kapı 2,2 m
export const PAL = {
  conc: '#9b9e97', concD: '#7f837c', concL: '#b4b6ae', twall: '#a3a49a', plinth: '#8c8f88',
  wallA: '#8f9886', wallB: '#a09a85', wallC: '#c9ccc4', wallD: '#7f8a7c', band: '#5d6559', trim: '#d9d8cf', roof: '#4b4f53', ceil: '#d4d5cf', floor: '#8d918c', plaster: '#d2d1c7',
  steel: '#59606a', steelD: '#3b4046', steelL: '#8a929b', olive: '#5d6b47', oliveD: '#46523a', tan: '#a8956c', sand: '#b8a57a', rust: '#7a4a32',
  asph: '#43464b', paver: '#8a8c86', gravel: '#8a826c', grass: '#5f6d45', dirt: '#6c5d45', yellow: '#d9a91f', white: '#e8e6df', red: '#b8392c', blue: '#2b6fd6',
  canvas: '#77805f', canvasD: '#5e6649', wood: '#9b7a4e', woodD: '#5e4429', glass: '#2c3a44', rubber: '#26282b',
};
export const TEAM = { blue: { c: '#2b6fd6', glow: '#7fb4ff', tent: '#6f7d62', cmd: '#55688a' }, red: { c: '#d63a2b', glow: '#ff8a6b', tent: '#857b62', cmd: '#8a5648' } };
export const LAMP_WARM = '#ffe2a6', LAMP_COOL = '#e6f0ff', LAMP_RED = '#ff3b2b', LAMP_WIN = '#ffd98a';
const P2 = Math.PI / 2;

export class UsKit {
  constructor(b, rng) {
    this.b = b; this.rng = rng;
    this.lamps = []; this.signs = []; this.callouts = []; this.trees = []; this.wires = [];
  }
  // ── temel parçalar ──
  s(x, y, z, w, h, d, col, kind = UK.PLAIN, o = {}) { if (w > 1e-3 && h > 1e-3 && d > 1e-3) this.b.box(x, y, z, w, h, d, col, { kind, ...o }); }
  d(x, y, z, w, h, d, col, kind = UK.PLAIN, o = {}) { if (w > 1e-3 && h > 1e-3 && d > 1e-3) this.b.box(x, y, z, w, h, d, col, { kind, ...o, collide: false }); }
  sr(x0, x1, y0, y1, z0, z1, col, kind, o) { this.s((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col, kind, o); }       // aralıkla katı
  dr(x0, x1, y0, y1, z0, z1, col, kind, o) { this.d((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col, kind, o); }
  lit(x, y, z, w, h, d, col = LAMP_WARM) { this.b.box(x, y, z, w, h, d, col, { collide: false, o: { glow: true } }); }                 // ışıyan (gece / gün batımı)
  litS(x, y, z, w, h, d, col = LAMP_WARM) { this.b.box(x, y, z, w, h, d, col, { o: { glow: true } }); }                                 // ışıyan katı (ör. projektör başı)
  glass(x, y, z, w, h, d, col = '#9fc4d8', op = 0.28) { this.b.box(x, y, z, w, h, d, col, { collide: false, o: { transparent: true, opacity: op, roughness: 0.12 } }); }
  // ── dünya koordinatı (b.with içindeyken) ──
  wp(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.b.M); }
  wyaw() { const e = this.b.M.elements; return Math.atan2(e[8], e[0]); }            // yerel +X'in dünyadaki dönüşü (ry)
  lamp(x, y, z, r = 10, k = 1, c = '#ffd9a0') { const p = this.wp(x, y, z); this.lamps.push({ x: p.x, y: p.y, z: p.z, r, k, c }); }
  co(name, x, z, major = false) { const p = this.wp(x, 0, z); this.callouts.push({ name, x: +p.x.toFixed(1), z: +p.z.toFixed(1), ...(major ? { major: true } : {}) }); }
  // tabela: yerel konum + yerel yön (ry: 0 = +z'ye bakar); düz levha duvardan 3 cm önde, polygonOffset'li tek atlas ağı
  sign(t, w, h, x, y, z, ry = 0, fg = '#1e2329', bg = null) { const p = this.wp(x, y, z); this.signs.push({ t, w, h, p: [p.x, p.y, p.z], ry: ry + this.wyaw(), fg, bg }); }
  tree(x, z, s = 1) { this.trees.push([x, z, s, this.rng()]); }
  wire(pts) { const out = []; for (const q of pts) { const p = this.wp(q[0], q[1], q[2]); out.push(p.x, p.y, p.z); } this.wires.push(out); }       // tel (çizgi parçaları: ardışık çiftler)

  // ── boşluklu duvar: axis 'x' → a0..a1 x boyunca, z = c; 'z' → z boyunca, x = c. y0 tabanı, h boy, t kalınlık.
  // ops: [{ at, w, b = 0 (eşik), top, frame?: { col, kind, jw = 0.1, out = 0.04 }, glass?: renk, glow?: renk }]   bands: [{ y0, y1, col, kind, out = 0 }] (y0'a göre)
  // outDir (±1): bant çıkıntısı yalnız dış yüze (köşede iki bant iç içe girmesin); bant.ext: duvar ucundaki parça bu kadar uzar (köşe kapanır)
  wall(axis, a0, a1, c, y0, h, t, col, kind, ops = [], bands = [], outDir = 0) {
    const L = [...ops].sort((p, q) => p.at - q.at), iv = [];
    let cur = a0;
    for (const o of L) { const s = o.at - o.w / 2, e = o.at + o.w / 2; if (s > cur + 1e-4) iv.push([cur, s, null]); iv.push([s, e, o]); cur = e; }
    if (a1 > cur + 1e-4) iv.push([cur, a1, null]);
    const BS = [...bands].sort((p, q) => p.y0 - q.y0);
    const piece = (s, e, yb, yt) => {
      // bantlarla dikey böl
      const cuts = [yb, yt]; for (const B of BS) { if (B.y0 > yb && B.y0 < yt) cuts.push(B.y0); if (B.y1 > yb && B.y1 < yt) cuts.push(B.y1); }
      cuts.sort((p, q) => p - q);
      for (let i = 0; i < cuts.length - 1; i++) {
        const ya = cuts[i], yc = cuts[i + 1]; if (yc - ya < 1e-3) continue;
        const B = BS.find((q) => q.y0 <= ya + 1e-4 && q.y1 >= yc - 1e-4);
        const cc = B ? B.col : col, kk = B ? (B.kind ?? kind) : kind, ou = B?.out || 0, tt = outDir ? t + ou : t + 2 * ou, cOff = outDir * ou / 2;
        const ss = B && ou && B.ext && Math.abs(s - a0) < 1e-6 ? s - B.ext : s, ee = B && ou && B.ext && Math.abs(e - a1) < 1e-6 ? e + B.ext : e;
        if (axis === 'x') this.s((ss + ee) / 2, y0 + ya, c + cOff, ee - ss, yc - ya, tt, cc, kk); else this.s(c + cOff, y0 + ya, (ss + ee) / 2, tt, yc - ya, ee - ss, cc, kk);
      }
    };
    for (const [s, e, o] of iv) {
      if (!o) { piece(s, e, 0, h); continue; }
      const top = Math.min(o.top ?? h, h), bb = o.b || 0;
      if (bb > 0) piece(s, e, 0, bb);
      if (top < h) piece(s, e, top, h);
      const F = o.frame;
      let gs = s, ge = e, gb = bb, gt = top;
      if (F) {
        const jw = F.jw ?? 0.1, out = F.out ?? 0.04, tt = t + 2 * out, fc = F.col, fk = F.kind ?? UK.STEEL;
        const P = (p0, p1, q0, q1) => { if (axis === 'x') this.s((p0 + p1) / 2, y0 + q0, c, p1 - p0, q1 - q0, tt, fc, fk); else this.s(c, y0 + q0, (p0 + p1) / 2, tt, q1 - q0, p1 - p0, fc, fk); };
        P(s, s + jw, bb, top); P(e - jw, e, bb, top);
        if (top < h) P(s + jw, e - jw, top - jw, top);
        if (bb > 0) P(s + jw, e - jw, bb, bb + 0.06);
        gs = s + jw; ge = e - jw; gb = bb > 0 ? bb + 0.06 : bb; gt = top < h ? top - jw : top;
      }
      if (o.glass && gt - gb > 0.05) { const gw = ge - gs; if (axis === 'x') this.glass((gs + ge) / 2, y0 + gb, c, gw, gt - gb, 0.04, o.glass); else this.glass(c, y0 + gb, (gs + ge) / 2, 0.04, gt - gb, gw, o.glass); }
    }
  }

  // ── katı merdiven: (x, z) alt basamağın başlangıç kenarı ortası; dir yönünde yükselir. Her basamak y0'dan kendi üstüne (üst üste binmez) ──
  stair(x, z, y0, dir, width, steps, rise, run, col, kind = UK.CONC, { rail = true, nose = PAL.yellow } = {}) {
    const hz = dir === '+x' || dir === '-x', sg = dir === '+x' || dir === '+z' ? 1 : -1;
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * rise, m = (i + 0.5) * run;
      const cx = hz ? x + sg * m : x, cz = hz ? z : z + sg * m;
      // basamak burnu: basamağın ön 4 cm'si ayrı renk (aynı kutunun bölünmüşü: yüz çakışması yok)
      const nb = 0.05, nm = i * run + nb / 2, bm = i * run + nb + (run - nb) / 2;
      if (nose) {
        const nx = hz ? x + sg * nm : x, nz = hz ? z : z + sg * nm, bx = hz ? x + sg * bm : x, bz = hz ? z : z + sg * bm;
        this.s(nx, y0, nz, hz ? nb : width, top - 0.05, hz ? width : nb, col, kind);
        this.s(nx, y0 + top - 0.05, nz, hz ? nb : width, 0.05, hz ? width : nb, nose, UK.PAINT);
        this.s(bx, y0, bz, hz ? run - nb : width, top, hz ? width : run - nb, col, kind);
      } else this.s(cx, y0, cz, hz ? run : width, top, hz ? width : run, col, kind);
    }
    if (rail) {                                                                    // eğik tırabzan (ince, çarpışmasız; yan yüzden 2 cm dışarıda)
      const len = steps * run, hg = steps * rise, Lh = Math.hypot(len, hg), a = Math.atan2(hg, len);
      const mx = hz ? x + sg * len / 2 : x, mz = hz ? z : z + sg * len / 2;
      const rot = dir === '+z' ? { rx: -a } : dir === '-z' ? { rx: a } : dir === '+x' ? { rz: a } : { rz: -a };
      for (const sd of [-1, 1]) {
        const lx = hz ? 0 : sd * (width / 2 + 0.03), lz = hz ? sd * (width / 2 + 0.03) : 0;
        this.b.box(mx + lx, y0 + hg / 2 + 0.85, mz + lz, hz ? Lh : 0.04, 0.05, hz ? 0.04 : Lh, PAL.steelD, { collide: false, kind: UK.STEEL, ...rot });
      }
    }
    return { len: steps * run, top: y0 + steps * rise };
  }

  // ── zemin bölümlemesi: dikdörtgenler (sonraki öncelikli) → örtüşmeyen kutular, hepsinin üstü y = 0 (kaplama üstüne kaplama yok → z-fighting yok) ──
  ground(rects, ext) {
    const xs = new Set([ext.x0, ext.x1]), zs = new Set([ext.z0, ext.z1]);
    for (const r of rects) { for (const v of [r.x0, r.x1]) if (v > ext.x0 && v < ext.x1) xs.add(+v.toFixed(3)); for (const v of [r.z0, r.z1]) if (v > ext.z0 && v < ext.z1) zs.add(+v.toFixed(3)); }
    const X = [...xs].sort((a, c) => a - c), Z = [...zs].sort((a, c) => a - c);
    const cellOf = (cx, cz) => { for (let i = rects.length - 1; i >= 0; i--) { const r = rects[i]; if (cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1) return i; } return -1; };
    let prev = null; const out = [];
    for (let j = 0; j < Z.length - 1; j++) {
      const row = []; let run = null;
      for (let i = 0; i < X.length - 1; i++) {
        const k = cellOf((X[i] + X[i + 1]) / 2, (Z[j] + Z[j + 1]) / 2);
        if (run && run.k === k) run.x1 = X[i + 1]; else { run = { k, x0: X[i], x1: X[i + 1], z0: Z[j], z1: Z[j + 1] }; row.push(run); }
      }
      // dikey birleştir: üstteki satırda aynı x aralığı + sınıf varsa uzat
      if (prev) for (const r of row) { const q = prev.find((p) => p.k === r.k && p.x0 === r.x0 && p.x1 === r.x1 && p.z1 === r.z0); if (q) { q.z1 = r.z1; r.merged = q; } }
      for (const r of row) if (!r.merged) out.push(r);
      prev = row.map((r) => r.merged || r);
    }
    for (const r of out) { if (r.k < 0) continue; const R = rects[r.k]; this.d((r.x0 + r.x1) / 2, -0.3, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.3, r.z1 - r.z0, R.col, R.kind); }
    return out.length;
  }

  // ── kurulum sonrası: tabela atlası, ağaçlar (örnekli), teller ──
  finish(group) {
    if (typeof document === 'undefined') return;
    const signs = this.signs;
    if (signs.length) {
      const cells = new Map(); for (const sn of signs) { const key = sn.t + '|' + sn.fg + '|' + (sn.bg || ''); if (!cells.has(key)) cells.set(key, cells.size); sn.cell = cells.get(key); }
      const rows = Math.max(1, Math.ceil(cells.size / 4));
      const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 128 * rows; const cx = cv.getContext('2d');
      for (const [key, i] of cells) {
        const [t, fg, bg] = key.split('|'), x0 = (i % 4) * 512, y0 = Math.floor(i / 4) * 128;
        if (bg) { cx.fillStyle = bg; cx.fillRect(x0 + 3, y0 + 3, 506, 122); }
        let fs = 92; cx.font = `bold ${fs}px Arial, sans-serif`; const w = cx.measureText(t).width; if (w > 480) { fs = Math.floor(fs * 480 / w); cx.font = `bold ${fs}px Arial, sans-serif`; }
        cx.fillStyle = fg; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, x0 + 256, y0 + 68);
      }
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const geos = [];
      for (const sn of signs) {
        const pg = new THREE.PlaneGeometry(sn.w, sn.h), uv = pg.attributes.uv, i = sn.cell, u0 = (i % 4) / 4, v1 = 1 - Math.floor(i / 4) / rows, v0 = v1 - 1 / rows;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / 4, v0 + uv.getY(k) * (v1 - v0));
        pg.rotateY(sn.ry); pg.translate(...sn.p); geos.push(pg);
      }
      const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.renderOrder = 2; m.name = 'us-tabelalar'; group.add(m);
    }
    if (this.trees.length) {                                                          // çam: gövde + 3 katlı koni, iki örnekli ağ (2 çizim)
      const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6); trunk.translate(0, 0.8, 0);
      const crown = mergeGeometries([[1.9, 2.6, 1.3], [1.5, 2.2, 2.6], [1.0, 2.0, 3.8]].map(([r, h, y]) => { const g = new THREE.ConeGeometry(r, h, 7); g.translate(0, y + h / 2, 0); return g.toNonIndexed(); }));
      const mt = new THREE.MeshStandardMaterial({ color: '#5a4630', roughness: 0.95, flatShading: true }), mc = new THREE.MeshStandardMaterial({ color: '#3f5a34', roughness: 0.95, flatShading: true });
      const it = new THREE.InstancedMesh(trunk, mt, this.trees.length), ic = new THREE.InstancedMesh(crown, mc, this.trees.length);
      const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cc = new THREE.Color();
      this.trees.forEach(([x, z, s, r], i) => { M4.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(e.set(0, r * 6.28, 0)), new THREE.Vector3(s, s * (0.9 + r * 0.3), s)); it.setMatrixAt(i, M4); ic.setMatrixAt(i, M4); ic.setColorAt(i, cc.setHSL(0.27 + r * 0.05, 0.3, 0.26 + r * 0.08)); });
      ic.castShadow = true; it.castShadow = true; it.name = 'us-agac-govde'; ic.name = 'us-agac-tac';
      group.add(it, ic);
    }
    if (this.wires.length) {
      const pos = []; for (const w of this.wires) pos.push(...w);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const ln = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#4a4d50' })); ln.name = 'us-tel'; group.add(ln);
    }
  }
}

// dikdörtgenden delik çıkar → örtüşmeyen dikdörtgenler ([x0, x1, z0, z1])
export function cutRects(R, holes) {
  const xs = new Set([R[0], R[1]]), zs = new Set([R[2], R[3]]);
  for (const h of holes) { for (const v of [h[0], h[1]]) if (v > R[0] && v < R[1]) xs.add(v); for (const v of [h[2], h[3]]) if (v > R[2] && v < R[3]) zs.add(v); }
  const X = [...xs].sort((a, c) => a - c), Z = [...zs].sort((a, c) => a - c), out = [];
  for (let j = 0; j < Z.length - 1; j++) {
    let run = null;
    for (let i = 0; i < X.length - 1; i++) {
      const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2, inH = holes.some((h) => cx > h[0] && cx < h[1] && cz > h[2] && cz < h[3]);
      if (inH) { run = null; continue; }
      if (run) run[1] = X[i + 1]; else { run = [X[i], X[i + 1], Z[j], Z[j + 1]]; out.push(run); }
    }
  }
  // dikey birleştir
  const res = [];
  for (const r of out) { const q = res.find((p) => p[0] === r[0] && p[1] === r[1] && Math.abs(p[3] - r[2]) < 1e-9); if (q) q[3] = r[3]; else res.push([...r]); }
  return res;
}
export { P2 };

// Çarpışma kutusu birleştirme (görünüm değişmez): tam üst üste / yan yana değen ve değen yüzü birebir aynı olan iki kutu tek kutu olur
// (bantla bölünmüş duvar parçası, basamak burnu + gövdesi, iki katmanlı döşeme, bitişik T-duvar segmentleri). Birleşim = iki kutunun tam birleşimi → görsel = çarpışma korunur.
export function mergeColliders(list, eps = 1e-4) {
  let cur = list.filter((c) => c.max[0] - c.min[0] < 300);
  const big = list.filter((c) => !(c.max[0] - c.min[0] < 300));
  for (let pass = 0; pass < 6; pass++) {
    let merged = 0;
    for (const ax of [1, 0, 2]) {
      const o = [0, 1, 2].filter((a) => a !== ax), key = (c) => o.map((a) => c.min[a].toFixed(4) + ':' + c.max[a].toFixed(4)).join('|') + '|' + (c.tag || '');
      const groups = new Map();
      for (const c of cur) { const k = key(c); let g = groups.get(k); if (!g) groups.set(k, (g = [])); g.push(c); }
      const out = [];
      for (const g of groups.values()) {
        g.sort((a, b) => a.min[ax] - b.min[ax]);
        let run = null;
        for (const c of g) {
          if (run && Math.abs(c.min[ax] - run.max[ax]) < eps) { run.max[ax] = Math.max(run.max[ax], c.max[ax]); merged++; continue; }
          run = { min: [...c.min], max: [...c.max], tag: c.tag, oid: c.oid, _chain: c._chain }; out.push(run);
        }
      }
      cur = out;
    }
    if (!merged) break;
  }
  return [...cur, ...big];
}
