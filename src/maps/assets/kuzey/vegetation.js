import { FLORA } from '../common/kuzeyFlora.js';
import { forestDensity, outerHeight, fbm } from './terrain.js';
import { FLAGS, FIELDS, PADS, HEDGES } from './layout.js';
import { makeRng } from '../../builder.js';

// Kuzey Vadisi bitki yerleşimi (12.172, deterministik → sunucu = istemci): 7 m titreşimli ızgara, orman yoğunluğu + tür seçimi (yükseklik / su / kenar).
// Süzgeç: yol, su, dik yamaç (> 0,85), yapı ayak izi (occ), bayrak çevresi, tarla, düzlenmiş alan merkezi. Harita içi ağaçlar: gövde çarpışma kutusu + tepe yaprak küresi (bot görüşü).
// Harita dışı (800–1060 m) kuşak: seyrek, çarpışmasız (kenar ormanlık görünsün).
// 12.182 doldurma: açık alanda gürültü lekeleri hâlinde çalılık (çalı + genç ladin + huş / meşe), yollar boyunca ve tarla kenarlarında çalı çitleri,
// iki katı kaya kümesi / devrik ağaç, mezra meyve bahçeleri. Çarpışan bitkiler (gövde / kaya / kütük) birbirine girmez (yakınlık ızgarası).
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function scatterVegetation(T, occ, rng, rngOuter, { outer = true, orchard = [], rocks = [], wires = [] } = {}) {
  const out = [], cellOcc = new Map(), OC = 16;
  // 12.184 tel koridoru: elektrik / telefon teli ağaç tepesinin içinden geçmesin (tel noktaları 1 m aralık, 8 m ızgara). Tepe yatay yarıçapı ≈ CR · boy,
  // yüksekliği tabandan 0,2–1,02 boy. Rastgele akış kaymasın diye ağaç her şey çekildikten SONRA elenir (diğer ağaçlar birebir aynı kalır).
  const WH = new Map(), WC = 8, CR = { pine: 0.22, spruce: 0.26, birch: 0.22, oak: 0.34 };
  for (const [a, b, sag] of wires) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.ceil(L));
    for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t - 4 * sag * L * t * (1 - t) * 0.5, k = Math.floor(x / WC) + ',' + Math.floor(z / WC); let q = WH.get(k); if (!q) WH.set(k, (q = [])); q.push([x, y, z]); }
  }
  const wireHit = (t) => {
    const cr = CR[t.k]; if (!cr || !WH.size) return false;
    const R = cr * t.s + 0.4, y0 = t.y + 0.2 * t.s, y1 = t.y + 1.02 * t.s;
    for (let i = Math.floor((t.x - R) / WC); i <= Math.floor((t.x + R) / WC); i++) for (let j = Math.floor((t.z - R) / WC); j <= Math.floor((t.z + R) / WC); j++) for (const p of WH.get(i + ',' + j) || []) if (p[1] > y0 && p[1] < y1 && Math.hypot(p[0] - t.x, p[2] - t.z) < R) return true;
    return false;
  };
  // çarpışan bitki yakınlık ızgarası: [x, z, r] (gövde / kaya / kütük parçası) — iki katı birbirine girmesin
  const solid = new Map(), SC = 4, sk = (i, j) => i + ',' + j;
  const solidFree = (x, z, r) => { const i0 = Math.floor((x - r - 4) / SC), i1 = Math.floor((x + r + 4) / SC), j0 = Math.floor((z - r - 4) / SC), j1 = Math.floor((z + r + 4) / SC);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const q of solid.get(sk(i, j)) || []) if (Math.hypot(q[0] - x, q[1] - z) < q[2] + r + 0.25) return false; return true; };
  const solidAdd = (x, z, r) => { const k = sk(Math.floor(x / SC), Math.floor(z / SC)); let a = solid.get(k); if (!a) solid.set(k, (a = [])); a.push([x, z, r]); };
  const solidR = (t) => (t.k === 'rock' ? t.s * Math.max(t.w, t.d) * 0.5 : FLORA[t.k].trunkH > 0 ? Math.max(0.12, FLORA[t.k].trunkR * t.s) * 1.42 : 0);
  for (const r of occ) for (let i = Math.floor((r[0] - 2) / OC); i <= Math.floor((r[1] + 2) / OC); i++) for (let j = Math.floor((r[2] - 2) / OC); j <= Math.floor((r[3] + 2) / OC); j++) { const k = i + ',' + j; let a = cellOcc.get(k); if (!a) cellOcc.set(k, (a = [])); a.push(r); }
  const blocked = (x, z, m) => { const a = cellOcc.get(Math.floor(x / OC) + ',' + Math.floor(z / OC)); if (a) for (const r of a) if (x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m) return true; return false; };
  const nearFlag = (x, z) => FLAGS.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 6);
  const inField = (x, z) => FIELDS.some((f) => Math.abs(x - f[0]) < f[2] / 2 + 2 && Math.abs(z - f[1]) < f[3] / 2 + 2);
  const inPad = (x, z) => PADS.some((p) => (p.r ? Math.hypot(x - p.x, z - p.z) < p.r : Math.abs(x - p.x) < p.w / 2 - 6 && Math.abs(z - p.z) < p.d / 2 - 6) && p.id !== 'G');
  const S = 7;
  // iki ayrı rastgele akış: harita içi (sunucu + istemci) ve dış kuşak (yalnız istemci) — dış kuşak atlanınca iç yerleşim değişmez
  const pass = (R, inner) => {
    const lim = inner ? 798 : 1060;
    for (let gz = -lim; gz < lim; gz += S) for (let gx = -lim; gx < lim; gx += S) {
      const ins = Math.abs(gx + S / 2) < 798 && Math.abs(gz + S / 2) < 798;
      if (inner !== ins) continue;
      const x = gx + R() * S, z = gz + R() * S, r1 = R(), r2 = R(), r3 = R();
      const inside = Math.abs(x) < 798 && Math.abs(z) < 798;
      if (!inner && (r3 > 0.45 || inside)) continue;                       // dış kuşak seyrek
      const dens = forestDensity(x, z);
      const y = inside ? T.heightAt(x, z) : outerHeight(x, z);
      let kind = null, thicket = 0;
      if (inside) thicket = sst(0.5, 0.7, fbm(x / 70 + 13, z / 70 - 9, 97, 3)) * (1 - sst(0.25, 0.5, dens));       // 12.182 çalılık lekeleri (ormanın dışında)
      if (r1 < dens) {
        if (y < 1.4) continue;
        kind = y > 70 || r2 < 0.38 ? 'spruce' : r2 < 0.86 ? 'pine' : r2 < 0.95 ? 'birch' : 'oak';
      } else if (r1 < dens + 0.11 + 0.5 * thicket && inside) kind = r2 < 0.6 ? 'bush' : r2 < 0.74 ? 'spruce' : r2 < 0.88 ? 'birch' : 'oak';     // açık alanda çalı / tek tük ağaç; çalılıkta sık
      else if (r1 > 0.992 && inside) kind = 'rock';
      if (!kind) continue;
      if (inside) {
        if (y < 1.3 || T.slopeAt(x, z, 1) > (kind === 'rock' ? 1.2 : 0.85)) continue;
        if (T.roadAt(x, z) || T.roadAt(x + 3, z) || T.roadAt(x - 3, z) || T.roadAt(x, z + 3) || T.roadAt(x, z - 3)) continue;
        if (blocked(x, z, kind === 'bush' ? 1.5 : 3) || nearFlag(x, z) || inField(x, z) || inPad(x, z)) continue;
      }
      const F = FLORA[kind], u = R();
      let sc = F.h[0] + (F.h[1] - F.h[0]) * u;
      if (inside && r1 >= dens && kind === 'spruce') sc = 5 + 5 * u;                       // çalılıkta genç ladin
      if (inside && r1 >= dens && kind === 'bush' && thicket > 0.3) sc = 1.6 + 1.3 * u;     // çalılıkta boylu çalı (ayaktakini de saklar)
      const t = { k: kind, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), s: +sc.toFixed(2), ry: +(R() * 6.283).toFixed(3), inside };
      if (kind === 'rock') { t.w = 0.9 + R() * 0.8; t.d = 0.8 + R() * 0.7; t.tilt = (R() - 0.5) * 0.3; }
      if (wireHit(t)) continue;
      if (inside) { const sr = solidR(t); if (sr > 0) { if (!solidFree(t.x, t.z, sr)) continue; solidAdd(t.x, t.z, sr); } }
      out.push(t);
    }
  };
  pass(rng, true);
  // 12.172 ek örtü (ayrı rastgele akış; sunucu = istemci): çalı çitleri, kaya kümeleri, devrik ağaçlar (eksen hizalı kütük)
  const X = makeRng(5150), okAt = (x, z, m = 1.5) => Math.abs(x) < 790 && Math.abs(z) < 790 && T.heightAt(x, z) > 1.3 && !T.roadAt(x, z) && !T.roadAt(x + 2, z) && !T.roadAt(x - 2, z) && !T.roadAt(x, z + 2) && !T.roadAt(x, z - 2) && !blocked(x, z, m) && !nearFlag(x, z);
  // 12.182 meyve bahçeleri (mezralar): sıra sıra meşe / huş, gövde çarpışmalı + tepe görüş küresi (ayrı rastgele akış: eski çit / kaya yerleşimi kaymaz)
  const O = makeRng(6262);
  for (const [x, z, k, s] of orchard) {
    if (!okAt(x, z, 1.2) || T.slopeAt(x, z, 1) > 0.6) continue;
    const t = { k, x: +x.toFixed(2), y: +T.heightAt(x, z).toFixed(2), z: +z.toFixed(2), s: +s.toFixed(2), ry: +(O() * 6.283).toFixed(3), inside: true };
    if (wireHit(t)) continue;
    const sr = solidR(t); if (!solidFree(t.x, t.z, sr)) continue; solidAdd(t.x, t.z, sr); out.push(t);
  }
  // 12.182 büyük kaya blokları (Taş Ocağı): çarpışmalı, birbirine girmez
  for (const [x, z, sc] of rocks) {
    if (!okAt(x, z, 2)) continue;
    const t = { k: 'rock', x: +x.toFixed(2), y: +T.heightAt(x, z).toFixed(2), z: +z.toFixed(2), s: +sc.toFixed(2), ry: +(O() * 6.28).toFixed(3), inside: true, w: +(1.0 + O() * 0.6).toFixed(2), d: +(0.9 + O() * 0.6).toFixed(2), tilt: +((O() - 0.5) * 0.2).toFixed(3) };
    const sr = solidR(t); if (!solidFree(t.x, t.z, sr)) continue; solidAdd(t.x, t.z, sr); out.push(t);
  }
  // 12.182 çalı çitleri: yolların iki yanında (banketten 6–9 m, 25–55 m'lik parçalar, aralarda boşluk) + tarla kenarları (2–3 kenar, kapı boşluklu)
  const hedges = HEDGES.slice(), H = makeRng(6161), farFrom = (x, z) => !PADS.some((p) => p.id !== 'C' && p.id !== 'W' && (p.r ? Math.hypot(x - p.x, z - p.z) < p.r + 10 : Math.abs(x - p.x) < p.w / 2 + 8 && Math.abs(z - p.z) < p.d / 2 + 8));
  for (const r of T.roads) {
    if (r.t === 'lane') continue;
    let acc = 30 + H() * 40;
    for (let i = 3; i < r.pts.length - 3; i++) {
      acc -= Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      if (acc > 0) continue;
      const len = 25 + H() * 30, side = H() < 0.5 ? -1 : 1, off = r.w / 2 + 6 + H() * 3; acc = len + 18 + H() * 50;
      const a = r.pts[i], j = Math.min(r.pts.length - 1, i + Math.round(len / 2)), bq = r.pts[j];
      const pts = [];
      for (let k = i; k <= j; k += 2) { const p0 = r.pts[Math.max(0, k - 2)], p1 = r.pts[Math.min(r.pts.length - 1, k + 2)], tl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1; pts.push([r.pts[k][0] - (p1[1] - p0[1]) / tl * off * side, r.pts[k][1] + (p1[0] - p0[0]) / tl * off * side]); }
      if (pts.length < 3 || !farFrom(a[0], a[1]) || !farFrom(bq[0], bq[1])) continue;
      for (let k = 0; k < pts.length - 1; k++) hedges.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]]);
    }
  }
  for (const [fx, fz, w, d] of FIELDS) {
    const x0 = fx - w / 2 - 2.5, x1 = fx + w / 2 + 2.5, z0 = fz - d / 2 - 2.5, z1 = fz + d / 2 + 2.5;
    const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
    for (let e = 0; e < 4; e++) {
      if (H() < 0.3) continue;
      const [ax, az, bx, bz] = edges[e], L = Math.hypot(bx - ax, bz - az), g0 = 0.3 + H() * 0.3, g1 = g0 + 9 / L;     // 9 m kapı boşluğu (araç / piyade)
      hedges.push([ax, az, ax + (bx - ax) * g0, az + (bz - az) * g0]);
      if (g1 < 1) hedges.push([ax + (bx - ax) * g1, az + (bz - az) * g1, bx, bz]);
    }
  }
  for (const [x0, z0, x1, z1] of hedges) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 1.45);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t + (X() - 0.5) * 0.8, z = z0 + (z1 - z0) * t + (X() - 0.5) * 0.8, s = 1.7 + X() * 1.1, ry = X() * 6.28, gap = X() < 0.05;
      if (gap || !okAt(x, z, 0.8)) continue;                                                     // ara sıra boşluk: içinden geçilir
      const h = { k: X() < 0.12 ? 'oak' : 'bush', x: +x.toFixed(2), y: +T.heightAt(x, z).toFixed(2), z: +z.toFixed(2), s: +(s).toFixed(2), ry: +ry.toFixed(3), inside: true, hedge: true };
      if (h.k === 'oak') { h.s = +(9 + X() * 5).toFixed(2); const sr = solidR(h); if (wireHit(h)) { h.k = 'bush'; h.s = +s.toFixed(2); } else if (!solidFree(h.x, h.z, sr)) { h.k = 'bush'; h.s = +s.toFixed(2); } else solidAdd(h.x, h.z, sr); }
      out.push(h);
    }
  }
  for (let c = 0; c < 170; c++) {                                                                  // kaya kümeleri (3–7 kaya, yamaç / çayır; 12.182: 70 → 170)
    const cx = (X() - 0.5) * 1480, cz = (X() - 0.5) * 1480, n = 3 + Math.floor(X() * 5);
    if (!okAt(cx, cz, 6) || inPad(cx, cz) || inField(cx, cz)) { X(); continue; }
    for (let k = 0; k < n; k++) {
      const x = cx + (X() - 0.5) * 9, z = cz + (X() - 0.5) * 9, s = 1.2 + X() * (k ? 2.2 : 3.6);
      const t = { k: 'rock', x: +x.toFixed(2), y: +T.heightAt(x, z).toFixed(2), z: +z.toFixed(2), s: +s.toFixed(2), ry: +(X() * 6.28).toFixed(3), inside: true, w: +(0.9 + X() * 0.8).toFixed(2), d: +(0.8 + X() * 0.7).toFixed(2), tilt: +((X() - 0.5) * 0.3).toFixed(3) };
      if (!okAt(x, z, 1.5)) continue;
      const sr = solidR(t); if (!solidFree(t.x, t.z, sr)) continue; solidAdd(t.x, t.z, sr);
      out.push(t);
    }
  }
  const logs = [];
  for (let c = 0; c < 900 && logs.length < 160; c++) {                                             // devrik ağaç: orman kenarı / içinde / çalılık (12.182: 70 → 160)
    const x = (X() - 0.5) * 1500, z = (X() - 0.5) * 1500, ax = X() < 0.5, len = 6 + X() * 6, r = 0.26 + X() * 0.16;
    if (forestDensity(x, z) < 0.25 && fbm(x / 70 + 13, z / 70 - 9, 97, 3) < 0.6) continue;
    if (!okAt(x, z, 2)) continue;
    const ex = ax ? len / 2 : 0.6, ez = ax ? 0.6 : len / 2;
    if (!okAt(x - ex, z - ez, 1) || !okAt(x + ex, z + ez, 1) || T.slopeAt(x, z, 2) > 0.35) continue;
    const segs = []; for (let k = 0; k <= Math.ceil(len / 1.5); k++) { const f = k / Math.ceil(len / 1.5) - 0.5; segs.push([x + (ax ? f * len : 0), z + (ax ? 0 : f * len)]); }
    if (!segs.every(([qx, qz]) => solidFree(qx, qz, r + 0.1))) continue;
    for (const [qx, qz] of segs) solidAdd(qx, qz, r + 0.1);
    let y = 1e9; for (const f of [-0.5, -0.25, 0, 0.25, 0.5]) for (const e of [-r, 0, r]) y = Math.min(y, T.heightAt(x + (ax ? f * len : e), z + (ax ? e : f * len)));   // 12.182 yan eğimde de oturur
    y -= r * 0.1;
    logs.push({ x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(2), ax, len: +len.toFixed(2), r: +r.toFixed(2), endG: +T.heightAt(x + (ax ? len / 2 : 0), z + (ax ? 0 : len / 2)).toFixed(2) });   // endG: kesit ucu toprak altındaysa çizilmez
  }
  out.logs = logs;
  if (outer) pass(rngOuter, false);
  return out;
}

// buğday tarlası: bot görüşünü kesen alçak küreler (2,2 × 1,9 m altıgen, merkez zemin + 0,2, r 1,15 → üstü 1,35 m): içinde çömelen / yüzüstü görünmez, ayakta baş-göğüs görünür
export function fieldCover(T, cs) {
  let n = 0;
  for (const [fx, fz, w, d, t] of FIELDS) {
    if (t !== 'wheat') continue;
    for (let zi = 0, z = fz - d / 2 + 1.1; z < fz + d / 2; z += 1.9, zi++) for (let x = fx - w / 2 + 1.1 + (zi & 1) * 1.1; x < fx + w / 2; x += 2.2) {   // altıgen dizilim: sıra arası boşluk kalmaz
      if (T.roadAt(x, z)) continue;
      cs.at(x, z).softCover(x, T.heightAt(x, z) + 0.2, z, 1.15); n++;
    }
  }
  return n;
}
// devrik ağaç kütükleri: görsel + çarpışma (eksen hizalı kutu, kütüğün içine çizilmiş)
export function fallenLogs(logs, cs) {
  for (const L of logs) {
    const b = cs.at(L.x, L.z), y = L.y + L.r * 0.8;
    b.obj(`devrik:${Math.round(L.x)}:${Math.round(L.z)}`, () => {
      b.cyl(L.x, y, L.z, L.r * 0.8, L.r, L.len, '#5a4636', { rx: L.ax ? 0 : Math.PI / 2, rz: L.ax ? Math.PI / 2 : 0, center: true, seg: 7, collide: false, kind: 10 });
      if (L.endG < y + L.r * 0.6) b.cyl(L.x + (L.ax ? L.len / 2 + 0.01 : 0), y, L.z + (L.ax ? 0 : L.len / 2 + 0.01), L.r * 0.9, L.r * 0.9, 0.02, '#b89466', { rx: L.ax ? 0 : Math.PI / 2, rz: L.ax ? Math.PI / 2 : 0, center: true, seg: 7, collide: false, kind: 14 });
      b.collide(L.x, y - L.r * 0.72, L.z, L.ax ? L.len - 0.2 : L.r * 1.4, L.r * 1.44, L.ax ? L.r * 1.4 : L.len - 0.2);
      b.collide(L.x, y - L.r * 0.95, L.z, L.ax ? L.len - 0.2 : L.r * 0.62, L.r * 1.9, L.ax ? L.r * 0.62 : L.len - 0.2);          // 12.182 artı kesit: kütüğün üstü / altı da katı
    });
  }
}

// çarpışma + bot görüşü (yalnız harita içi): gövde kutusu (yarı kenar = gövde yarıçapı), kaya: içe çizilmiş kutu
export function vegetationColliders(list, cs) {
  for (const t of list) {
    if (!t.inside) continue;
    const F = FLORA[t.k], b = cs.at(t.x, t.z);
    if (t.k === 'rock') { b.collide(t.x, t.y - t.s * 0.1, t.z, t.s * t.w * 0.68, t.s * 0.55, t.s * t.d * 0.68); continue; }
    if (F.trunkH > 0) { const r = Math.max(0.12, F.trunkR * t.s); b.collide(t.x, t.y - 0.3, t.z, 2 * r, F.trunkH * t.s + 0.3, 2 * r); }
    if (F.crown) b.softCover(t.x, t.y + F.crown[0] * t.s, t.z, F.crown[1] * t.s);
  }
}
