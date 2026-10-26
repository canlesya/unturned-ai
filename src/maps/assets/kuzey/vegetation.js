import { FLORA } from '../common/kuzeyFlora.js';
import { forestDensity, outerHeight } from './terrain.js';
import { FLAGS, FIELDS, PADS } from './layout.js';

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
      } else if (r1 < dens + 0.035 && inside) kind = r2 < 0.55 ? 'bush' : r2 < 0.8 ? 'birch' : 'oak';          // açık alanda tek tük çalı / ağaç
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
  if (outer) pass(rngOuter, false);
  return out;
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
