import { FLORA } from '../common/kuzeyFlora.js';
import { forestDensity, outerHeight } from './terrain.js';
import { FLAGS, FIELDS, PADS, HEDGES } from './layout.js';
import { makeRng } from '../../builder.js';

// Kuzey Vadisi bitki yerleşimi (12.172, deterministik → sunucu = istemci): 7 m titreşimli ızgara, orman yoğunluğu + tür seçimi (yükseklik / su / kenar).
// Süzgeç: yol, su, dik yamaç (> 0,85), yapı ayak izi (occ), bayrak çevresi, tarla, düzlenmiş alan merkezi. Harita içi ağaçlar: gövde çarpışma kutusu + tepe yaprak küresi (bot görüşü).
// Harita dışı (800–1060 m) kuşak: seyrek, çarpışmasız (kenar ormanlık görünsün).
export function scatterVegetation(T, occ, rng, rngOuter, { outer = true } = {}) {
  const out = [], cellOcc = new Map(), OC = 16;
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
      let kind = null;
      if (r1 < dens) {
        if (y < 1.4) continue;
        kind = y > 70 || r2 < 0.38 ? 'spruce' : r2 < 0.86 ? 'pine' : r2 < 0.95 ? 'birch' : 'oak';
      } else if (r1 < dens + 0.075 && inside) kind = r2 < 0.72 ? 'bush' : r2 < 0.86 ? 'birch' : 'oak';          // açık alanda çalı / tek tük ağaç (12.172: iki katı)
      else if (r1 > 0.994 && inside) kind = 'rock';
      if (!kind) continue;
      if (inside) {
        if (y < 1.3 || T.slopeAt(x, z, 1) > (kind === 'rock' ? 1.2 : 0.85)) continue;
        if (T.roadAt(x, z) || T.roadAt(x + 3, z) || T.roadAt(x - 3, z) || T.roadAt(x, z + 3) || T.roadAt(x, z - 3)) continue;
        if (blocked(x, z, kind === 'bush' ? 1.5 : 3) || nearFlag(x, z) || inField(x, z) || inPad(x, z)) continue;
      }
      const F = FLORA[kind], sc = F.h[0] + (F.h[1] - F.h[0]) * R();
      const t = { k: kind, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), s: +sc.toFixed(2), ry: +(R() * 6.283).toFixed(3), inside };
      if (kind === 'rock') { t.w = 0.9 + R() * 0.8; t.d = 0.8 + R() * 0.7; t.tilt = (R() - 0.5) * 0.3; }
      out.push(t);
    }
  };
  pass(rng, true);
  // 12.172 ek örtü (ayrı rastgele akış; sunucu = istemci): çalı çitleri, kaya kümeleri, devrik ağaçlar (eksen hizalı kütük)
  const X = makeRng(5150), okAt = (x, z, m = 1.5) => Math.abs(x) < 790 && Math.abs(z) < 790 && T.heightAt(x, z) > 1.3 && !T.roadAt(x, z) && !T.roadAt(x + 2, z) && !T.roadAt(x - 2, z) && !T.roadAt(x, z + 2) && !T.roadAt(x, z - 2) && !blocked(x, z, m) && !nearFlag(x, z);
  for (const [x0, z0, x1, z1] of HEDGES) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 1.45);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t + (X() - 0.5) * 0.8, z = z0 + (z1 - z0) * t + (X() - 0.5) * 0.8, s = 1.7 + X() * 1.1, ry = X() * 6.28, gap = X() < 0.05;
      if (gap || !okAt(x, z, 0.8)) continue;                                                     // ara sıra boşluk: içinden geçilir
      out.push({ k: X() < 0.12 ? 'oak' : 'bush', x: +x.toFixed(2), y: +T.heightAt(x, z).toFixed(2), z: +z.toFixed(2), s: +(s).toFixed(2), ry: +ry.toFixed(3), inside: true, hedge: true });
      if (out[out.length - 1].k === 'oak') out[out.length - 1].s = +(9 + X() * 5).toFixed(2);
    }
  }
  for (let c = 0; c < 70; c++) {                                                                   // kaya kümeleri (3–7 kaya, yamaç / çayır)
    const cx = (X() - 0.5) * 1480, cz = (X() - 0.5) * 1480, n = 3 + Math.floor(X() * 5);
    if (!okAt(cx, cz, 6) || inPad(cx, cz) || inField(cx, cz)) { X(); continue; }
    for (let k = 0; k < n; k++) {
      const x = cx + (X() - 0.5) * 9, z = cz + (X() - 0.5) * 9, s = 1.2 + X() * (k ? 2.2 : 3.6);
      if (!okAt(x, z, 1.5)) continue;
      out.push({ k: 'rock', x: +x.toFixed(2), y: +T.heightAt(x, z).toFixed(2), z: +z.toFixed(2), s: +s.toFixed(2), ry: +(X() * 6.28).toFixed(3), inside: true, w: +(0.9 + X() * 0.8).toFixed(2), d: +(0.8 + X() * 0.7).toFixed(2), tilt: +((X() - 0.5) * 0.3).toFixed(3) });
    }
  }
  const logs = [];
  for (let c = 0; c < 400 && logs.length < 70; c++) {                                              // devrik ağaç: orman kenarı / içinde
    const x = (X() - 0.5) * 1500, z = (X() - 0.5) * 1500, ax = X() < 0.5, len = 6 + X() * 6, r = 0.26 + X() * 0.16;
    if (forestDensity(x, z) < 0.25 || !okAt(x, z, 2)) continue;
    const ex = ax ? len / 2 : 0.6, ez = ax ? 0.6 : len / 2;
    if (!okAt(x - ex, z - ez, 1) || !okAt(x + ex, z + ez, 1) || T.slopeAt(x, z, 2) > 0.35) continue;
    const y = Math.min(T.heightAt(x - ex, z - ez), T.heightAt(x + ex, z + ez), T.heightAt(x, z));
    logs.push({ x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(2), ax, len: +len.toFixed(2), r: +r.toFixed(2) });
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
      b.cyl(L.x + (L.ax ? L.len / 2 + 0.01 : 0), y, L.z + (L.ax ? 0 : L.len / 2 + 0.01), L.r * 0.9, L.r * 0.9, 0.02, '#b89466', { rx: L.ax ? 0 : Math.PI / 2, rz: L.ax ? Math.PI / 2 : 0, center: true, seg: 7, collide: false, kind: 14 });
      b.collide(L.x, y - L.r * 0.72, L.z, L.ax ? L.len - 0.2 : L.r * 1.4, L.r * 1.44, L.ax ? L.r * 1.4 : L.len - 0.2);
      for (const k of [-0.3, 0.15, 0.38]) b.ico(L.x + (L.ax ? k * L.len : 0), y + L.r * 0.9, L.z + (L.ax ? 0 : k * L.len), 0.28 + L.r * 0.4, '#5d4a38', { scale: [1.4, 0.5, 0.8], ry: k * 9 });   // kırık dal
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
