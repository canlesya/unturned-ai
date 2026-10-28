// 12.206 ek araç doğuşu ARAYICI (başsız, bir kez çalıştırılır; çıktı src/maps/vehScale.js verisine elle aktarılır).   node scripts/vehscaleplan.mjs
// Kuzey Vadisi üslerinde (BHQ / RHQ düzlüğü) her takım için ek tank / jip / motor / helikopter (+ heliped) yeri arar. Ölçütler (vehground / mototest ile aynı +
// pay): ayak izinde (araç boyu + 1 m) zemin düz (yükseklik farkı < 0,45 m, helipedde < 0,7 m), yol yok, su yok, yapı / ağaç gövdesi kutusu yok (zeminden
// 0,3 m'den yüksek), yaprak / çalı küresi yok, piyade doğuşuna ≥ 3 m, diğer araç doğuşlarına tür aralığı (jip 8 m, tank 12 m, motor 2,6 m sıra; türler arası
// gövde + 3 m; helipede kara aracı 15 m, iki heliped arası 26 m), helipedin 13 m içinde zeminden 0,5 m'den yüksek kutu / yaprak yok (rotor 6,6 m).
// Öncelik: aynı türün mevcut sırasına yakın (sıra uzar), üs merkezine yakın. Çıktı: JSON (takım → tür → [x, z, ry]).
import { Game } from '../src/game/game.js';
import { VT, toLocal2 } from '../src/sim/vehicle.js';
import { motoSpawnsFor } from '../src/maps/motoSpawns.js';
import { PADS } from '../src/maps/assets/kuzey/layout.js';

const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 10, type: 'conquest' } });
const W = g.world, T = g.map.terrain, SG = g.map.sight || [], SP = Object.values(g.map.spawns).flat();
const NEED = { tank: +(process.env.NT || 5), jip: +(process.env.NJ || 11), moto: +(process.env.NM || 10), heli: +(process.env.NH || 4) };
const DEF = { tank: VT.tank, jip: VT.jip, moto: VT.moto, heli: VT['heli-n'] };
const SPACE = { tank: 13, jip: 8, moto: 2.6, heli: 26 };
const taken = [...g.map.vehicles, ...motoSpawnsFor(g.map)].filter((d) => DEF[kind(d.type)]).map((d) => ({ x: d.x, z: d.z, ry: d.ry, k: kind(d.type) }));
function kind(t) { return t === 'tank' ? 'tank' : t === 'jip' ? 'jip' : t === 'moto' ? 'moto' : t?.startsWith('heli') ? 'heli' : null; }
const corners = (x, z, ry, hl, hw) => { const yaw = ry + Math.PI, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), out = []; for (const f of [-hl, 0, hl]) for (const r of [-hw, 0, hw]) out.push([x + fx * f + rx * r, z + fz * f + rz * r]); return out; };
const stOf = (x, z, ry) => ({ x, z, yaw: ry + Math.PI });
function clear(k, x, z, ry) {
  const d = DEF[k];
  if (k === 'heli') {
    const R = 9;
    let lo = 1e9, hi = -1e9;
    for (let a = 0; a < 16; a++) for (const rr of [0, R * 0.5, R]) { const px = x + Math.cos(a / 16 * 6.283) * rr, pz = z + Math.sin(a / 16 * 6.283) * rr; const h = T.heightAt(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h); if (T.roadAt(px, pz) || h < 2) return 'yol/su'; }
    if (hi - lo > 0.7) return 'eğim';
    for (const c of W.query(x - 16, z - 16, x + 16, z + 16, [])) { const cx = Math.max(c.min[0], Math.min(x, c.max[0])), cz = Math.max(c.min[2], Math.min(z, c.max[2])), dd = Math.hypot(cx - x, cz - z); if (dd < 13 && c.max[1] > hi + 0.5) return 'kutu'; }
    for (const q of SG) if (Math.hypot(q[0] - x, q[2] - z) < 13 + q[3] && q[1] + q[3] > hi + 0.5) return 'yaprak';
    for (const p of SP) if (Math.hypot(p.x - x, p.z - z) < R + 4) return 'piyade';
    for (const o of taken) { const dd = Math.hypot(o.x - x, o.z - z); if (dd < (o.k === 'heli' ? SPACE.heli : 15)) return 'araç'; }
    return '';
  }
  const hl = d.hl + 1, hw = d.hw + 1;
  let lo = 1e9, hi = -1e9;
  for (const [px, pz] of corners(x, z, ry, hl, hw)) { const h = T.heightAt(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h); if (T.roadAt(px, pz) || h < 2) return 'yol/su'; }
  if (hi - lo > 0.45) return 'eğim';
  const st = stOf(x, z, ry);
  for (const c of W.query(x - 8, z - 8, x + 8, z + 8, [])) { if (c.max[1] <= lo + 0.3) continue; const cx = Math.max(c.min[0], Math.min(x, c.max[0])), cz = Math.max(c.min[2], Math.min(z, c.max[2])), L = toLocal2(st, cx, cz); if (Math.abs(L.f) < hl + 0.5 && Math.abs(L.r) < hw + 0.5) return 'kutu'; }
  for (const q of SG) { if (q[1] + q[3] < lo + 0.2) continue; const L = toLocal2(st, q[0], q[2]); if (Math.hypot(Math.max(0, Math.abs(L.f) - hl), Math.max(0, Math.abs(L.r) - hw)) < q[3] + 0.3) return 'yaprak'; }
  for (const p of SP) { const L = toLocal2(st, p.x, p.z); if (Math.abs(L.f) < d.hl + 3 && Math.abs(L.r) < d.hw + 3) return 'piyade'; }
  for (const o of taken) { const dd = Math.hypot(o.x - x, o.z - z); if (o.k === 'heli' ? dd < 15 : o.k === k ? dd < SPACE[k] : dd < d.hl + DEF[o.k].hl + 3) return 'araç'; }
  return '';
}
const out = {};
for (const team of ['blue', 'red']) {
  const P = PADS.find((p) => p.id === (team === 'blue' ? 'BHQ' : 'RHQ')), H = { x: P.x, z: P.z }, s = team === 'blue' ? 1 : -1;
  out[team] = {};
  for (const k of ['heli', 'tank', 'jip', 'moto']) {
    const base = taken.filter((o) => o.k === k && Math.abs(o.x - H.x) < P.w / 2 + 5 && Math.abs(o.z - H.z) < P.d / 2 + 5);
    const ry = base[0]?.ry ?? (team === 'blue' ? Math.PI : 0), res = [];
    // sıra kafesi: mevcut sıranın aralığıyla (jip 8 × 8 m, tank 16 × 13 m, motor 4 × 2,6 m sütun, heliped 30 × 30 m) → ek araçlar sıraya dizilir (dağınık değil)
    const LAT = { jip: [8, 8], tank: [16, 13], moto: [4, 2.6], heli: [30, 30] }[k], o0 = base[0] || { x: H.x, z: H.z };
    const cand = [];
    for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) { const x = o0.x + i * LAT[0], z = o0.z + j * LAT[1]; if (Math.abs(x - P.x) < P.w / 2 - 8 && Math.abs(z - P.z) < P.d / 2 - 8) cand.push([x, z]); }
    while (res.length < NEED[k]) {
      let best = null, bs = 1e18;
      for (const [x, z] of cand) {
        const same = taken.filter((o) => o.k === k && Math.abs(o.x - H.x) < P.w / 2 + 5 && Math.abs(o.z - H.z) < P.d / 2 + 5);
        const dn = same.length ? Math.min(...same.map((o) => Math.hypot(o.x - x, o.z - z))) : 0;
        // sıra doldurma: önce mevcut sıra uzar (jip / tank: aynı z, motor: aynı x sütunu), sonra bir sonraki sıra; helipedler üssün arkasında (cepheden uzak)
        const cx = base.length ? base.reduce((a, o) => a + o.x, 0) / base.length : H.x, cz = base.length ? base.reduce((a, o) => a + o.z, 0) / base.length : H.z;
        const sc = k === 'heli' ? dn * 3 + Math.hypot(x - H.x, z - H.z) * 0.4 + s * (H.z - z) * 0.5 : k === 'moto' ? Math.abs(x - o0.x) * 2.5 + Math.abs(z - cz) : Math.abs(z - o0.z) * 2.5 + Math.abs(x - cx);
        if (sc >= bs) continue;
        if (clear(k, x, z, ry)) continue;
        bs = sc; best = { x, z };
      }
      if (!best) { console.error(`${team} ${k}: yer kalmadı (${res.length}/${NEED[k]})`); break; }
      res.push([+best.x.toFixed(1), +best.z.toFixed(1), +ry.toFixed(4)]);
      taken.push({ x: best.x, z: best.z, ry, k });
    }
    out[team][k] = res;
  }
}
console.log(JSON.stringify(out));
