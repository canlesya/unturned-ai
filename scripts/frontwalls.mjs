// Cephe siper duvarı itme testi (12.161, başsız):  node scripts/frontwalls.mjs [OLD=1: düzeltme öncesi davranış (yalnız merkez denetimi)]
// Batı Cephesi arazisindeki her dik duvar kenarının (iki hücre arası kot farkı > 0,6 m) alçak yanından, duvara dik ve çapraz (0°, ±35°, ±70°) itilir:
// yürüme / koşu / çömelme / yüzüstü / zıplayarak koşu, kare adımı 1/60 · 1/30 · 1/15 (düşük FPS / tünel). Her adımda gövde silindiri (yarıçap R,
// diz 0,6 m üstü) ve kamera (göz ± yakın düzlem payı) araziyle kesişiyor mu ölçülür. Sızma = gövde duvara > 3 cm girdi ya da göz duvar içinde.
// Ayrıca: duvardan geri çekilince kurtuluyor mu (sıkışma), doğuş noktalarının ayak izi duvara değiyor mu. Çıktı: sızma sayısı (hedef 0) + en kötü örnekler.
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
import { R, H_STAND, H_CROUCH, H_PRONE } from '../src/game/collision.js';
import { FrontTerrain } from '../src/maps/cepheTerrain.js';
import { TUNE } from '../src/game/balance.js';
MapBuilder.noVisual = true;
if (process.env.OLD) delete FrontTerrain.prototype.pushOut;            // düzeltme öncesi: yalnız merkez noktası (wallAt + dik yamaç)
const g = new Game(null, { headless: true, map: 'cephe', diff: 'normal', match: { perTeam: 1, type: 'front', time: 1200 }, bots: false });
const W = g.world, T = g.map.terrain, C = T.cell;
const t0 = performance.now();

// dik duvar kenarları: iç hücre kenarları, iki yan yüzeyin kenar ortasındaki kot farkı > 0,6
const edges = [];
for (let j = 0; j < T.ch; j++) for (let i = 0; i < T.cw; i++) for (const [di, dj] of [[1, 0], [0, 1]]) {
  const i2 = i + di, j2 = j + dj;
  if (i2 >= T.cw || j2 >= T.ch || (!T.cut[j * T.cw + i] && !T.cut[j2 * T.cw + i2])) continue;
  for (const t of [0.12, 0.5, 0.88]) {
    const ex = T.minX + (di ? i + 1 : i + t) * C, ez = T.minZ + (dj ? j + 1 : j + t) * C;
    const ha = T.heightAt(ex - di * 0.05, ez - dj * 0.05), hb = T.heightAt(ex + di * 0.05, ez + dj * 0.05);
    if (Math.abs(ha - hb) < 0.6) continue;
    const lowSide = ha < hb ? -1 : 1;                                  // alçak yan: −1 (i / j tarafı) ya da +1
    edges.push({ ex, ez, nx: di * -lowSide, nz: dj * -lowSide, top: Math.max(ha, hb) });   // n: alçak yandan duvara doğru
  }
}

const MODES = [
  ['yürü', 1, H_STAND, 1 / 60, false], ['koş', TUNE.sprintMul, H_STAND, 1 / 60, false], ['koş@15fps', TUNE.sprintMul, H_STAND, 1 / 15, false],
  ['çömel', TUNE.crouchMul, H_CROUCH, 1 / 60, false], ['yüzüstü', TUNE.proneMul, H_PRONE, 1 / 60, false],
  ['zıpla+koş', TUNE.sprintMul, H_STAND, 1 / 60, true], ['zıpla+koş@30fps', TUNE.sprintMul, H_STAND, 1 / 30, true],
];
const ANG = [0, 35, -35, 70, -70].map((a) => a * Math.PI / 180);
const EYE = { [H_STAND]: 1.62, [H_CROUCH]: 1.15, [H_PRONE]: 0.42 };
const mkS = (h) => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), height: h, onGround: true, onCollider: false, fallTop: 0 });

// gövde duvara ne kadar girdi: 16 yönde merkezden R'ye kadar, dizden (ayak + 0,6) yüksek arazi ilk nerede başlıyor
function depth(p, h) {
  let d = 0;
  const yk = p.y + Math.min(0.6, h * 0.8);
  for (let a = 0; a < 16; a++) {
    const cx = Math.cos(a * Math.PI / 8), cz = Math.sin(a * Math.PI / 8);
    for (let r = 0; r <= R + 1e-6; r += 0.02) if (T.heightAt(p.x + cx * r, p.z + cz * r) > yk + 0.02) { d = Math.max(d, R - r); break; }
  }
  return d;
}
function eyeIn(p, h) {
  const y = p.y + EYE[h];
  for (const [dx, dz] of [[0, 0], [0.08, 0], [-0.08, 0], [0, 0.08], [0, -0.08]]) if (T.heightAt(p.x + dx, p.z + dz) > y) return true;
  return false;
}

let trials = 0, leaks = 0, eyeLeaks = 0, stuck = 0, climbed = 0, worst = 0;
const bad = new Map();
for (const e of edges) {
  for (const [mn, mul, h, dt, jump] of MODES) for (const a of ANG) {
    const s = mkS(h);
    s.pos.set(e.ex - e.nx * 1.1, 0, e.ez - e.nz * 1.1);
    s.pos.y = T.heightAt(s.pos.x, s.pos.z);
    if (W.canStand && !W.canStand(s, h)) continue;                                // başlangıç bir kutunun içindeyse bu deneme yok
    W.settle(s); s.onGround = true;
    if (s.pos.y > e.top - 0.6) continue;                                            // başlangıç zaten duvar tepesine yakın (basamak / sandık üstü): duvar sayılmaz
    if (depth(s.pos, h) > 0.03) continue;                                            // başlangıç geçersiz (dar köşe)
    trials++;
    const sp = TUNE.walkSpeed * mul, ca = Math.cos(a), sa = Math.sin(a);
    const vx = (e.nx * ca - e.nz * sa) * sp, vz = (e.nz * ca + e.nx * sa) * sp;
    let dmax = 0, eyeBad = false;
    const steps = Math.round(1.2 / dt);
    for (let k = 0; k < steps; k++) {
      s.vel.x = vx; s.vel.z = vz;
      if (jump && s.onGround) s.vel.y = TUNE.jumpSpeed;
      W.move(s, dt);
      dmax = Math.max(dmax, depth(s.pos, h));
      if (eyeIn(s.pos, h)) eyeBad = true;
    }
    if (s.pos.y > e.top - 0.3) climbed++;                                           // rampadan / basamaktan çıkan (yan kayarken): bilgi
    // sıkışma: 8 yönün hiçbirinde 0,4 sn yürüyüşle 0,3 m ilerleyemiyorsa (köşede duvara dayanmak sıkışma değil)
    let free = false;
    for (let q = 0; q < 8 && !free; q++) {
      const t = mkS(h); t.pos.copy(s.pos); t.onGround = s.onGround; t.onCollider = s.onCollider;
      for (let k = 0; k < 24; k++) { t.vel.x = Math.cos(q * Math.PI / 4) * TUNE.walkSpeed; t.vel.z = Math.sin(q * Math.PI / 4) * TUNE.walkSpeed; W.move(t, 1 / 60); }
      if (Math.hypot(t.pos.x - s.pos.x, t.pos.z - s.pos.z) > 0.3) free = true;
    }
    if (!free) { stuck++; if (process.env.V) console.log('sıkışma', mn, s.pos.x.toFixed(2), s.pos.y.toFixed(2), s.pos.z.toFixed(2)); }
    if (dmax > 0.03 || eyeBad) {
      if (dmax > 0.03) leaks++;
      if (eyeBad) eyeLeaks++;
      worst = Math.max(worst, dmax);
      const k = `${mn} ${(a * 180 / Math.PI).toFixed(0)}°`;
      const L = bad.get(k) || { n: 0, ex: [] }; L.n++; if (L.ex.length < 3) L.ex.push(`(${e.ex.toFixed(1)},${e.ez.toFixed(1)}) ${dmax.toFixed(2)} m${eyeBad ? ' göz' : ''}`); bad.set(k, L);
    }
  }
}
// doğuş noktaları: ayak izi duvara değmez (her aşama / her takım)
let spBad = 0, spN = 0;
const stages = g.map.front.stages || [];
for (const S of stages) for (const k of ['blue', 'red']) for (const p of S[k] || []) {
  spN++;
  const s = mkS(H_STAND); s.pos.set(p.x, T.heightAt(p.x, p.z), p.z);
  if (depth(s.pos, H_STAND) > 0.0) { spBad++; if (process.env.V) console.log('doğuş duvarda', k, p.x, p.z); }
}
console.log(`${process.env.OLD ? 'ÖNCE (yalnız merkez)' : 'SONRA (gövde yarıçapı)'}: ${edges.length} duvar kenarı örneği, ${trials} itme denemesi (${MODES.length} kip × ${ANG.length} açı)`);
console.log(`  gövde duvara giren: ${leaks} (en derin ${worst.toFixed(2)} m) · kamera duvar içinde: ${eyeLeaks} · sıkışan (8 yönde de ilerleyemeyen): ${stuck} · zıplayıp duvardan çıkan: ${climbed}`);
console.log(`  doğuş noktası duvara değen: ${spBad}/${spN}`);
for (const [k, L] of [...bad].sort((a, b) => b[1].n - a[1].n).slice(0, 10)) console.log(`   ${k}: ${L.n} · ${L.ex.join(' | ')}`);
console.log(`süre ${((performance.now() - t0) / 1000).toFixed(1)} sn`);
process.exitCode = leaks || eyeLeaks || stuck || spBad ? 1 : 0;
