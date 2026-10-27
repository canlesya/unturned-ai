// ───── 12.189 Bot sürücüler (jip / tank) ─────
// Botlar artık araç SÜRER: hedefi (mangal bayrağı) uzaksa yakındaki boş takım aracına yürür, sürücü koltuğuna biner, yakındaki takım arkadaşlarını
// birkaç sn bekler (yolcu / tank nişancısı), araç yol ızgarasında (VNav) rota bulup bayrağa gider; jip bayrağın ~40 m önünde durur, herkes iner;
// tank bayrağa girer, içinde kalıp ana topla savaşır. Araç girdisi oyuncunun girdisiyle AYNI yapı (Vehicles.drive → stepVehicle): çevrimdışı
// oyunda ve sunucuda (çevrim içi odalarda botlar sunucuda koşar) aynı fizik; istemciler aracı anlık görüntüden görür.
//
// VNav: araç ızgarası (3 m hücre, harita başına bir kez, modül önbelleği: sunucuda odalar paylaşır). 1 m'lik engel ızgarası (araç gövdesini
// durduran kutular: zeminden > 0,65 m, < 2,6 m'de başlayan; dik yamaç > ~32°, derin su) → uzaklık dönüşümü → her hücrenin en yakın engele
// (yamaç kenarı dahil: yol seti) açıklığı. Maliyet: asfalt / toprak yol 1, banket 1,4, arazi 2,4 + eğim; engele yakın hücre pahalı. A* (ağırlıklı) jip 1,6 m, tank
// 2,3 m açıklık ister (tank köy sokaklarına girmez). Rota 3 m'lik noktalar; sürüş ileri bakışlı izleme (pure pursuit).
import { mgAt, gunPose, toLocal2 } from '../sim/vehicle.js';
import { clamp, rand, angleDiff, yawFromDir } from './util.js';
import * as THREE from 'three';

export const VBOT = {
  trip: { jip: 200, tank: 150, heli: 300 },       // bu kadar uzak hedefe araçla gider
  tanks: (per) => (per >= 12 ? 2 : 1),            // takımda aynı anda en çok bot tankçı
  reach: 75,                                      // boş araca en çok bu kadar yürür
  humanNear: 22,                                  // aracın bu kadar yakınında insan takım arkadaşı varsa bot almaz (oyuncu binmeye gidiyor olabilir)
  park: { jip: 42, tank: 12 },                    // bayrak merkezine bu kadar kala durur
  speed: { jip: [17, 10], tank: [10, 7] },        // hedef hız: yolda / arazide (m/sn)
  clr: { jip: 1.6, tank: 2.3 },                   // rota açıklığı (m)
  wait: [1.2, 7],                                 // binince bekleme: en az / yolcu yürürken en çok (sn)
  stuck: { t: 1.6, rev: 1.4, max: 5, noProg: 35 },
  // tank topu (zorluk): ilk nişan hatası (rad, her atışta yeniden), hareketli hedefe öncü oranı, ek bekleme (dolumdan sonra), tepki (sn), menzil;
  // inf: piyadeye karşı hata çarpanı / ek bekleme / menzil
  gun: {
    easy: { err: 0.03, lead: 0.3, cd: 3.2, react: [1.6, 2.4], range: 150, inf: { err: 2.0, cd: 2.5, range: 110 } },
    normal: { err: 0.017, lead: 0.6, cd: 1.7, react: [1.0, 1.6], range: 190, inf: { err: 1.8, cd: 2.0, range: 130 } },
    hard: { err: 0.01, lead: 0.85, cd: 0.8, react: [0.6, 1.0], range: 220, inf: { err: 1.6, cd: 1.5, range: 150 } },
  },
};
const _o = { x: 0, y: 0, z: 0 }, _d = { x: 0, y: 0, z: 0 }, _e = new THREE.Vector3(), _t = new THREE.Vector3();
// ölçüm sayaçları (testler okur: g.vbStats)
const stat = (g) => (g.vbStats ||= { enter: 0, exit: {}, rev: 0, plans: 0, planMs: 0, planMax: 0, fail: 0, shots: 0, arrive: 0 });
const kindOf = (v) => (v.def.heli ? 'heli' : v.def.cannon ? 'tank' : 'jip');

// ───── VNav ─────
const VCACHE = new Map();
export function vnav(g) {
  if (g._vnav) return g._vnav;
  const key = g.map.id || g.map.name;
  let n = VCACHE.get(key);
  if (!n) { n = buildVNav(g); vComp(n, VBOT.clr.jip); vComp(n, VBOT.clr.tank); n.ms = performance.now() - n.t0; VCACHE.set(key, n); }      // bağlı bölgeler de kurulumda (ilk rotada ~0,2 sn takılmasın)
  return (g._vnav = n);
}

function buildVNav(g) {
  const t0 = performance.now();
  const A = g.map.playArea || g.map.bounds, T = g.map.terrain || g.world.terrain, cols = g.map.colliders || g.world.colliders;
  const R = 1, ox = A.minX, oz = A.minZ, nx = Math.ceil((A.maxX - A.minX) / R), nz = Math.ceil((A.maxZ - A.minZ) / R);
  const D = new Float32Array(nx * nz).fill(1e4);
  for (const c of cols) {
    if (c.nocar) continue;
    const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2, gnd = T ? T.heightAt(cx, cz) : 0;
    if (c.max[1] - gnd < 0.65 || c.min[1] - gnd > 2.6) continue;                // alçak (bordür, tabliye, kaide) ya da baş üstü
    const i0 = Math.max(0, Math.floor((c.min[0] - ox) / R)), i1 = Math.min(nx - 1, Math.floor((c.max[0] - ox) / R));
    const j0 = Math.max(0, Math.floor((c.min[2] - oz) / R)), j1 = Math.min(nz - 1, Math.floor((c.max[2] - oz) / R));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) D[j * nx + i] = 0;
  }
  // dik yamaç / derin su da engel (2 m alt ızgarada): yol setinin (R1 Mavi üs altı ~14 m) kenarı uçurum — açıklık yamaç kenarından da ölçülür
  if (T) for (let j = 0; j < nz; j += 2) for (let i = 0; i < nx; i += 2) {
    const x = ox + (i + 1) * R, z = oz + (j + 1) * R, hh = T.heightAt(x, z), wy = T.waterY ? T.waterY(x, z) : -Infinity;
    if (T.slopeAt(x, z, 1) > 0.5 || (wy > -1e9 && wy - hh > 0.5) || hh < (T.deepWater ?? -1e9)) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) { const q = (j + dj) * nx + i + di; if (j + dj < nz && i + di < nx) D[q] = 0; }
  }
  // uzaklık dönüşümü (3-4 pah, iki geçiş)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = D[k];
    if (i > 0) v = Math.min(v, D[k - 1] + 1);
    if (j > 0) { v = Math.min(v, D[k - nx] + 1); if (i > 0) v = Math.min(v, D[k - nx - 1] + 1.414); if (i < nx - 1) v = Math.min(v, D[k - nx + 1] + 1.414); }
    D[k] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = D[k];
    if (i < nx - 1) v = Math.min(v, D[k + 1] + 1);
    if (j < nz - 1) { v = Math.min(v, D[k + nx] + 1); if (i < nx - 1) v = Math.min(v, D[k + nx + 1] + 1.414); if (i > 0) v = Math.min(v, D[k + nx - 1] + 1.414); }
    D[k] = v;
  }
  const C = 3, w = Math.floor((A.maxX - A.minX - 12) / C), h = Math.floor((A.maxZ - A.minZ - 12) / C), x0 = A.minX + 6, z0 = A.minZ + 6;
  const clr = new Float32Array(w * h), cost = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * C, z = z0 + (j + 0.5) * C, k = j * w + i;
    const ri = Math.floor((x - ox) / R), rj = Math.floor((z - oz) / R);
    let c = 1e4;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = (rj + dj) * nx + ri + di; if (q >= 0 && q < D.length) c = Math.min(c, D[q] + Math.hypot(di, dj) * 0.5); }
    const hh = T ? T.heightAt(x, z) : 0, sl = T ? Math.max(T.slopeAt(x, z, 1.5), T.slopeAt(x + 1.2, z, 1.5), T.slopeAt(x, z + 1.2, 1.5)) : 0;
    const wy = T?.waterY ? T.waterY(x, z) : -Infinity;
    if (sl > 0.5 || (wy > -1e9 && wy - hh > 0.5) || hh < (T?.deepWater ?? -1e9)) c = 0;
    clr[k] = c;
    const rd = T?.roadAt ? T.roadAt(x, z) : 0;
    cost[k] = rd === 1 || rd === 2 ? 1 : rd === 3 ? 1.4 : 2.4 + sl * 5;
  }
  return { C, w, h, x0, z0, clr, cost, t0, ms: performance.now() - t0, g: new Float32Array(w * h), from: new Int32Array(w * h), mark: new Uint32Array(w * h), closed: new Uint32Array(w * h), stamp: 0 };
}

const vIdx = (N, x, z) => { const i = Math.floor((x - N.x0) / N.C), j = Math.floor((z - N.z0) / N.C); return i < 0 || j < 0 || i >= N.w || j >= N.h ? -1 : j * N.w + i; };
const vX = (N, k) => N.x0 + ((k % N.w) + 0.5) * N.C, vZ = (N, k) => N.z0 + (Math.floor(k / N.w) + 0.5) * N.C;
// bağlı bölgeler (açıklık sınıfı başına bir kez): rota başı / sonu ana bölgede olmalı (ağaç arası cepte kalan hücreden rota çıkmaz)
function vComp(N, need) {
  const K = (N.comps ||= {});
  if (K[need]) return K[need];
  const W = N.w, H = N.h, n = W * H, cm = new Int32Array(n).fill(-1), q = new Int32Array(n), size = [];
  let id = 0;
  for (let s0 = 0; s0 < n; s0++) {
    if (cm[s0] >= 0 || N.clr[s0] < need) continue;
    let h = 0, t = 0; q[t++] = s0; cm[s0] = id;
    while (h < t) {
      const c = q[h++], cx = c % W, cz = (c / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const ax = cx + dx, az = cz + dz; if ((!dx && !dz) || ax < 0 || az < 0 || ax >= W || az >= H) continue;
        const k = az * W + ax; if (cm[k] >= 0 || N.clr[k] < need) continue;
        if (dx && dz && (N.clr[cz * W + ax] < need || N.clr[az * W + cx] < need)) continue;
        cm[k] = id; q[t++] = k;
      }
    }
    size.push(t); id++;
  }
  let main = 0; for (let i = 1; i < size.length; i++) if (size[i] > size[main]) main = i;
  return (K[need] = { cm, main });
}
function vNear(N, x, z, need, maxR) {
  const C = vComp(N, need), ok = (k) => N.clr[k] >= need && C.cm[k] === C.main;
  const k0 = vIdx(N, x, z);
  if (k0 >= 0 && ok(k0)) return k0;
  const ci = Math.floor((x - N.x0) / N.C), cj = Math.floor((z - N.z0) / N.C);
  for (let r = 1; r <= maxR; r++) {
    let best = -1, bd = 1e9;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N.w || j >= N.h) continue;
      const k = j * N.w + i; if (!ok(k)) continue;
      const d = di * di + dj * dj; if (d < bd) { bd = d; best = k; }
    }
    if (best >= 0) return best;
  }
  return -1;
}

// A*: [[x, z], …] (3 m aralıklı) ya da null. Yığın tipli dizide (ayırma yok), sezgisel ağırlık 1,8 (yol maliyeti 1 → rota yol ağına yapışık;
// ağırlıklı arama en kısa yerine "iyi" yolu verir, açılan hücre ~5 kat az: 1,5 km rota ~5–15 ms, sunucu adımını kesmez)
export const VR = { w: 1.8, max: 200000 };
let HK = new Int32Array(1 << 16), HF = new Float32Array(1 << 16);
export function vRoute(N, sx, sz, gx, gz, need) {
  let s = vNear(N, sx, sz, need, 6), t = vNear(N, gx, gz, need, 15);
  if (t < 0) t = vNear(N, gx, gz, need, 50);                                 // hedef araca kapalı (tepe, sokak): 150 m içindeki en yakın ulaşılır nokta (tank Radar Tepesi eteğinde durur)
  if (s < 0 || t < 0) return null;
  const W = N.w, H = N.h, st = ++N.stamp, G = N.g, F = N.from, M = N.mark, CL = N.closed, CLR = N.clr, COST = N.cost, wH = VR.w;
  const tx = t % W, tz = (t / W) | 0;
  let hn = 0;
  const push = (k, f) => {
    if (hn >= HK.length) { const k2 = new Int32Array(HK.length * 2), f2 = new Float32Array(HK.length * 2); k2.set(HK); f2.set(HF); HK = k2; HF = f2; }
    let i = hn++;
    while (i > 0) { const p = (i - 1) >> 1; if (HF[p] <= f) break; HK[i] = HK[p]; HF[i] = HF[p]; i = p; }
    HK[i] = k; HF[i] = f;
  };
  const pop = () => {
    const top = HK[0], lk = HK[--hn], lf = HF[hn];
    let i = 0;
    for (;;) { const l = 2 * i + 1; if (l >= hn) break; const r = l + 1, m = r < hn && HF[r] < HF[l] ? r : l; if (HF[m] >= lf) break; HK[i] = HK[m]; HF[i] = HF[m]; i = m; }
    HK[i] = lk; HF[i] = lf;
    return top;
  };
  const hf = (k) => { const dx = Math.abs((k % W) - tx), dz = Math.abs(((k / W) | 0) - tz); return wH * (dx + dz - 0.586 * (dx < dz ? dx : dz)); };
  G[s] = 0; M[s] = st; F[s] = -1; push(s, hf(s));
  let n = 0, found = false;
  while (hn && n++ < VR.max) {
    const cur = pop();
    if (cur === t) { found = true; break; }
    if (CL[cur] === st) continue;
    CL[cur] = st;
    const cx = cur % W, cz = (cur / W) | 0, g0 = G[cur];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const ax = cx + dx, az = cz + dz;
      if (ax < 0 || az < 0 || ax >= W || az >= H) continue;
      const k = az * W + ax, c = CLR[k];
      if (c < need || CL[k] === st) continue;
      if (dx && dz && (CLR[cz * W + ax] < need || CLR[az * W + cx] < need)) continue;
      const ng = g0 + (dx && dz ? 1.4142 : 1) * (COST[k] + (c < need + 1.5 ? 0.9 : 0));
      if (M[k] !== st || ng < G[k]) { M[k] = st; G[k] = ng; F[k] = cur; push(k, ng + hf(k)); }
    }
  }
  N.lastN = n;
  if (!found) return null;
  const out = [];
  for (let k = t; k !== -1; k = F[k]) out.push([vX(N, k), vZ(N, k)]);
  out.reverse();
  return out;
}

// ───── binme (sürücü olarak) ─────
// Bot boştayken (hedefsiz) çağrılır: rezervasyonu varsa araca yürür (≤ 16 m doğrudan, uzaksa yol ızgarasıyla), kapıda sürücü koltuğuna biner.
// true = bot bu adımda araca gidiyor (yolcu mantığı atlanır).
export function vbBoard(b) {
  const s = b.s, g = b.game, V = g.vehicles;
  if (b.vRes) {
    const v = b.vRes;
    if (!v.alive || !v.st || v.burn || v.st.sunk || v.seats[0] || v.botRes !== b || g.time > v.botResT) { vbRelease(b); return false; }
    const dx = v.st.x - s.pos.x, dz = v.st.z - s.pos.z;
    const L = toLocal2(v.st, s.pos.x, s.pos.z), edge = Math.hypot(Math.max(0, Math.abs(L.f) - v.def.hl), Math.max(0, Math.abs(L.r) - v.def.hw));
    if (edge < 1.9 && Math.abs(s.pos.y - v.st.y) < 2.2) {
      if (V.enter(s, v, 0)) { stat(g).enter++; b.vd = { state: 'wait', t: 0, kind: kindOf(v), stuck: 0, prog: 1e9, progT: 0 }; b.rideGoal = null; b.rideTo = null; b.target = null; }
      v.botRes = null; b.vRes = null;
      return true;
    }
    const door = doorPt(v, 0);
    if (Math.hypot(dx, dz) < 16) { b.rideGoal = v; b.rideTo = door; }
    else { b.rideGoal = null; b.rideTo = null; if (!b.goal || Math.hypot(b.goal.x - door.x, b.goal.z - door.z) > 4) { b.setGoal(door.x, door.z, 30); b.via = null; b.perching = false; } }
    return true;
  }
  if ((b.vScanT = (b.vScanT ?? rand(0, 1)) - 0.3) > 0) return false;
  b.vScanT = 1;
  const dest = tripDest(b);
  if (!dest) return false;
  const trip = Math.hypot(dest.x - s.pos.x, dest.z - s.pos.z);
  let best = null, bd = 1e9;
  for (const v of V.list) {
    if (!v.alive || !v.st || v.burn || v.st.sunk || v.seats.some(Boolean) || v.team !== s.team || g.time < (v.botBad || 0)) continue;
    if (v.botRes && v.botRes !== b && v.botRes.s.alive && g.time < v.botResT) continue;
    const k = kindOf(v); if (trip < VBOT.trip[k]) continue;
    if (k === 'heli' && (v.st.air || !heliOk(g, s, b))) continue;                 // helikopter: yerdeyken, takımda pilot sınırı / zorluk
    if (k === 'tank' && busy(g, s.team, 'tank') >= VBOT.tanks(teamN(g, s.team))) continue;      // tank: takım büyüklüğüne göre en çok bot tankçı
    if (v.hp < v.def.hp * 0.45) continue;
    const d = Math.hypot(v.st.x - s.pos.x, v.st.z - s.pos.z);
    if (d > VBOT.reach || d > trip * 0.35) continue;
    if (g.soldiers.some((e) => e.alive && e.team === s.team && (e.human || e.isPlayer) && !e.veh && Math.hypot(e.pos.x - v.st.x, e.pos.z - v.st.z) < VBOT.humanNear)) continue;
    const sc = d - (k === 'tank' ? 15 : 0);
    if (sc < bd) { bd = sc; best = v; }
  }
  if (!best) return false;
  best.botRes = b; best.botResT = g.time + 25; b.vRes = best;
  recruit(b, best);
  return true;
}
// Mürettebat çağrısı: sürücü / pilot aracı ayırınca yakındaki boştaki takım arkadaşlarını (önce aynı mangal) koltuklara çağırır: helikopter 2 kapı
// nişancısı + kabin, tank nişancı, jip 3 yolcu. (Eskiden yolcular yalnız bekleyen araca kendileri geliyordu; üste herkes jip / tank alıp gittiği için
// helikopterin nişancısı hiç gelmiyordu.)
// 12.189 ölçüm: 10v10'da botların zamanının %52'si araçtaydı (2 tank + nişancı, 2 helikopter + 3 kişi bayrakta / gökte bekliyor) → piyade çatışması
// azdı. Kabin yolcusu çağrılmaz; tank nişancısı 12+ kişilik takımda; tank / helikopter sayısı takım büyüklüğüyle sınırlı (VBOT.tanks, HELI.pilots).
const CREW = { heli: [1, 2], tank: [1], jip: [1, 2, 3] };
const teamN = (g, team) => g.soldiers.filter((e) => e.team === team && !e.vacant).length;
const busy = (g, team, k) => { let n = 0; for (const o of g.brains) if (o.s.team === team && o.s.alive && (o.vd?.kind === k || (o.vRes && kindOf(o.vRes) === k))) n++; return n; };
function recruit(b, v) {
  const g = b.game, s = b.s, k = kindOf(v), R = k === 'heli' ? 80 : 45;
  const cand = [];
  for (const o of g.brains) {
    const q = o.s;
    if (o === b || !q.alive || q.team !== s.team || q.veh || o.vRes || o.vRide || o.target || o.vd || q.hp < 40) continue;
    const d = Math.hypot(q.pos.x - v.st.x, q.pos.z - v.st.z);
    if (d > R) continue;
    const dest = tripDest(o); if (!dest || Math.hypot(dest.x - q.pos.x, dest.z - q.pos.z) < 140) continue;
    cand.push([d - (q.squad === s.squad ? 40 : 0), o]);
  }
  cand.sort((a, c) => a[0] - c[0]);
  const seats = CREW[k].filter((i) => !v.seats[i] && (k !== 'tank' || teamN(g, s.team) >= 12));
  for (let i = 0; i < seats.length && i < cand.length; i++) { const o = cand[i][1]; o.vRide = { v, seat: seats[i], t: g.time + 22 }; o.rideGoal = null; o.rideTo = null; }
}
// çağrılan mürettebat: koltuğun kapısına yürü, bin (sürücü daha gelmediyse de: araç sürücüsünü bekler)
export function vbCrew(b) {
  const s = b.s, g = b.game, V = g.vehicles, R = b.vRide;
  if (!R) return false;
  const v = R.v;
  if (!v.alive || !v.st || v.burn || v.st.sunk || v.seats[R.seat] || g.time > R.t || (v.def.heli && v.st.air) || V.speed(v) > 1.5) { b.vRide = null; b.rideGoal = null; b.rideTo = null; return false; }
  const drv = v.seats[0];
  if (drv ? !drv.brain?.vd : !(v.botRes && v.botRes.s.alive)) { b.vRide = null; return false; }      // sürücüsü bot değil / ayıran bot öldü
  const L = toLocal2(v.st, s.pos.x, s.pos.z), edge = Math.hypot(Math.max(0, Math.abs(L.f) - v.def.hl), Math.max(0, Math.abs(L.r) - v.def.hw));
  if (edge < 1.9 && Math.abs(s.pos.y - v.st.y) < 2.2) {
    if (V.enter(s, v, R.seat)) { b.vstopT = 0; b.rodeMoved = false; b.target = null; }
    b.vRide = null; b.rideGoal = null; b.rideTo = null;
    return true;
  }
  const door = doorPt(v, R.seat);
  if (Math.hypot(door.x - s.pos.x, door.z - s.pos.z) < 16) { b.rideGoal = v; b.rideTo = door; }
  else { b.rideGoal = null; b.rideTo = null; if (!b.goal || Math.hypot(b.goal.x - door.x, b.goal.z - door.z) > 4) { b.setGoal(door.x, door.z, 25); b.via = null; b.perching = false; } }
  return true;
}
export function vbRelease(b) {
  if (b.vRes && b.vRes.botRes === b) b.vRes.botRes = null;
  b.vRes = null; b.rideGoal = null; b.rideTo = null;
}
// koltuğun kapı noktası (gövdenin yanında)
export function doorPt(v, seat) {
  const sp = v.def.seat[seat], side = Math.sign(sp[1]) || 1, st = v.st;
  const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw), r = side * (v.def.hw + 0.9);
  return { x: st.x + fx * sp[0] + rx * r, z: st.z + fz * sp[0] + rz * r };
}
// gidilecek yer: mangal bayrağı (yoksa botun hedefi)
function tripDest(b) {
  const g = b.game, o = g.squadGoal?.(b.s);
  if (o) return o;
  return b.goal || null;
}
// yolcu: bu bot sürücünün aracına binsin mi (sürücü bekliyor, aynı takım, yolcunun hedefi uzak)
export function vbRideOk(b, v) {
  const drv = v.seats[0], vd = drv?.brain?.vd;
  if (!vd || vd.state !== 'wait' || drv.team !== b.s.team) return false;
  const dest = tripDest(b);
  if (!dest) return false;
  return Math.hypot(dest.x - b.s.pos.x, dest.z - b.s.pos.z) > 140 || b.s.squad === drv.squad;
}

// ───── sürüş (bot sürücü koltuğundayken her adım; Bot.update → buradan) ─────
export function vbDrive(b, dt) {
  const s = b.s, g = b.game, V = g.vehicles, v = s.veh, st = v.st, vd = b.vd, d = v.def;
  const inp = (vd.inp ||= { f: 0, r: 0, b: false, u: false, d: false, yw: st.yaw, pt: 0 });
  vd.t += dt; vd.odo = (vd.odo || 0) + V.speed(v) * dt;
  if (!v.alive || v.burn || st.sunk || (vd.kind === 'jip' && v.hp < d.hp * 0.33)) { vbExit(b, 'hasar'); return; }       // yanıyor / batıyor (jip: yanmadan önce) → in
  inp.f = 0; inp.r = 0; inp.b = false;
  if (d.cannon) tankGun(b, dt, inp); else { inp.yw = st.yaw; inp.pt = 0; }
  if (vd.kind === 'heli') { heliDrive(b, dt, inp); return; }
  const sp = V.speed(v);
  if (vd.state === 'wait') {
    inp.b = true;
    const coming = g.brains.some((o) => (o.rideGoal === v || o.vRide?.v === v) && o.s.alive);
    if (vd.t > VBOT.wait[1] || (vd.t > VBOT.wait[0] && (!coming || !v.seats.some((o, i) => i > 0 && !o)))) { vd.state = 'plan'; }
  }
  if (vd.state === 'plan' || vd.state === 'drive' || vd.state === 'hold') {
    const o = tripDest(b);
    if (!o) { vbExit(b, 'hedefsiz'); return; }
    if (vd.state !== 'plan' && vd.dest !== o) vd.state = 'plan';                // mangal hedefi değişti: yeni rota
    else if (vd.state === 'hold' && vd.kind === 'tank' && vd.t - (vd.holdT || 0) > (vd.holdFor ||= rand(22, 38))) { vd.state = 'plan'; vd.reloc = true; vd.holdFor = 0; }   // tank bayrakta yer değiştirir
    if (vd.state === 'plan') {
      if (g._vplanT === g.time) { inp.b = sp < 2; } else {
        g._vplanT = g.time;
        const N = vnav(g), park = VBOT.park[vd.kind];
        let tx = o.x, tz = o.z;
        if (vd.reloc) { const a = Math.random() * Math.PI * 2, r = rand(4, o.r * 0.7); tx += Math.cos(a) * r; tz += Math.sin(a) * r; vd.reloc = false; }
        const t0 = performance.now(), route = vRoute(N, st.x, st.z, tx, tz, VBOT.clr[vd.kind]), S = stat(g), ms = performance.now() - t0;
        S.plans++; S.planMs += ms; S.planMax = Math.max(S.planMax, ms);
        if (!route) { S.fail++; (S.failAt ||= []).push([Math.round(st.x), Math.round(st.z), Math.round(tx), Math.round(tz), vd.kind]); if (S.failAt.length > 6) S.failAt.shift(); v.botBad = g.time + 40; vbExit(b, 'rota yok'); return; }
        // durma noktası: bayrak merkezine 'park' m kala (rota sonu kırpılır; jip bayrağın içine dalmaz)
        let cut = route.length;
        for (let i = 0; i < route.length; i++) if (Math.hypot(route[i][0] - o.x, route[i][1] - o.z) < park) { cut = i + 1; break; }
        vd.route = route.slice(0, Math.max(2, cut)); vd.ri = 0; vd.dest = o; vd.state = 'drive'; vd.prog = 1e9; vd.progT = 0; vd.stuckT = 0; vd.revT = 0;
        const e = vd.route[vd.route.length - 1]; vd.end = { x: e[0], z: e[1] };
      }
    }
  }
  if (vd.state === 'drive') follow(b, dt, inp, sp);
  else if (vd.state === 'hold') { inp.b = true; if (vd.kind === 'jip' && sp < 0.6) { vd.parkT = (vd.parkT || 0) + dt; if (vd.parkT > 0.8) { stat(g).arrive++; vbExit(b, 'vardı'); return; } } }
  if (d.cannon && vd.fire) { if (V.fireCannon(v, s)) stat(g).shots++; vd.fire = false; }
  v.horn = !!vd.horn && !d.cannon; vd.horn = false;
  V.drive(v, inp, dt);
}

export function vbExit(b, why = '?') {
  const s = b.s, V = b.game.vehicles, S = stat(b.game);
  S.exit[why] = (S.exit[why] || 0) + 1;
  const vd = b.vd; if (vd && s.veh) { (S.trips ||= []).push({ k: vd.kind, why, t: +vd.t.toFixed(1), d: Math.round(vd.odo || 0), rev: vd.stuck, dest: vd.dest?.id, left: vd.end ? Math.round(Math.hypot(vd.end.x - s.veh.st.x, vd.end.z - s.veh.st.z)) : -1 }); if (S.trips.length > 200) S.trips.shift(); }
  if (s.veh) V.exit(s);
  b.vd = null; b.goalT = 0; b.path = null; b.target = null;
}

// rota izleme: ileri bakış noktası, viraja / sona göre hız, takım arkadaşı / araç önünde yavaşla / kaç, takılınca geri vites, ilerleme yoksa bırak
function follow(b, dt, inp, sp) {
  const s = b.s, g = b.game, v = s.veh, st = v.st, vd = b.vd, d = v.def, R = vd.route, tank = vd.kind === 'tank';
  const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
  const vF = st.vx * fx + st.vz * fz;
  while (vd.ri < R.length - 1 && Math.hypot(R[vd.ri][0] - st.x, R[vd.ri][1] - st.z) < 6) vd.ri++;
  // geçilmiş noktalar: bir sonraki daha yakınsa ilerle (rota başı aracın arkasında kalmasın)
  while (vd.ri < R.length - 1 && Math.hypot(R[vd.ri + 1][0] - st.x, R[vd.ri + 1][1] - st.z) < Math.hypot(R[vd.ri][0] - st.x, R[vd.ri][1] - st.z)) vd.ri++;
  const look = (tank ? 6 : 7) + Math.abs(vF) * (tank ? 0.6 : 0.85);
  let li = vd.ri;
  while (li < R.length - 1 && Math.hypot(R[li][0] - st.x, R[li][1] - st.z) < look) li++;
  let lx = R[li][0], lz = R[li][1];
  const dEnd = Math.hypot(vd.end.x - st.x, vd.end.z - st.z);
  if (dEnd < (tank ? 4 : 6) || (li === R.length - 1 && dEnd < 9 && Math.abs(vF) < 1.5)) { if (tank) stat(g).arrive++; vd.state = 'hold'; vd.holdT = vd.t; vd.parkT = 0; inp.b = true; return; }
  // yol / arazi hızı + viraj (önümüzdeki ~25 m'nin yön değişimi)
  const N = vnav(g), k = vIdx(N, st.x, st.z), onRoad = k >= 0 && N.cost[k] < 1.5;
  let vt = VBOT.speed[vd.kind][onRoad ? 0 : 1] * (k >= 0 ? clamp((N.clr[k] - 0.8) / 3.5, 0.45, 1) : 1);      // dar yerde (set, kapı, ağaç arası) yavaş
  const j2 = Math.min(R.length - 1, li + 8);
  if (j2 > li) {
    const a1 = yawFromDir(lx - st.x, lz - st.z), a2 = yawFromDir(R[j2][0] - lx, R[j2][1] - lz);
    vt *= clamp(1 - Math.abs(angleDiff(a1, a2)) / 1.7, 0.35, 1);
  }
  vt = Math.min(vt, Math.sqrt(2 * (tank ? 4 : 7) * Math.max(0, dEnd - 3)) + 1.5);
  // önündeki takım arkadaşı (yaya) / araç: yavaşla, korna, yana kaç
  let avoid = 0;
  for (const e of g.soldiers) {
    if (!e.alive || e.veh || e === s) continue;
    const L = toLocal2(st, e.pos.x, e.pos.z);
    if (L.f < d.hl - 0.5 || L.f > d.hl + 4 + Math.abs(vF) * 1.1 || Math.abs(L.r) > d.hw + 1.4) continue;
    if (e.team !== s.team) continue;                                          // düşman: ezilebilir
    vt = Math.min(vt, Math.max(0, (L.f - d.hl - 2) * 0.6)); vd.horn = true;
    avoid += (L.r > 0 ? -1 : 1) * 0.5;
  }
  for (const o of g.vehicles.list) {
    if (o === v || !o.st || (!o.alive && !o.wreck)) continue;
    const L = toLocal2(st, o.st.x, o.st.z);
    if (L.f < 0 || L.f > 16 + Math.abs(vF) || Math.abs(L.r) > d.hw + o.def.hw + 1.2) continue;
    avoid += (L.r > 0 ? -1 : 1) * clamp(1.4 - L.f / 14, 0.3, 1);
    if (L.f < d.hl + o.def.hl + 3) vt = Math.min(vt, 3);
  }
  // direksiyon: ileri bakış noktasının açısı (sağ = r > 0 = yaw azalır)
  let e = angleDiff(st.yaw, yawFromDir(lx - st.x, lz - st.z));
  let r = clamp(-e * (tank ? 2.6 : 2.2) + avoid, -1, 1);
  if (Math.abs(e) > 0.9) vt = Math.min(vt, tank ? 0 : 5);                   // sert dönüş: tank yerinde döner, jip yavaşlar
  // takılma: gaz verip ilerlemiyorsa geri vites (ters direksiyon), sonra yeniden rota
  if (vd.revT > 0) {
    vd.revT -= dt; inp.f = -1; inp.r = -vd.revR;
    if (vd.revT <= 0 && vd.stuck >= 2) vd.state = 'plan';
    progress(b, dt);
    return;
  }
  let f = clamp((vt - vF) / 3, -1, 1);
  if (vt < 0.5 && Math.abs(vF) < 0.6) { f = 0; inp.b = true; }
  if (f > 0.3 && Math.abs(vF) < 0.8 && vt > 2) vd.stuckT += dt; else vd.stuckT = Math.max(0, vd.stuckT - dt * 2);
  if (vd.stuckT > VBOT.stuck.t) { vd.stuckT = 0; vd.stuck++; stat(g).rev++; vd.revT = VBOT.stuck.rev; vd.revR = r === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(r); }
  inp.f = f; inp.r = r;
  if (!progress(b, dt)) return;
}
// ilerleme denetimi: hedef uzaklığı 35 sn'de 20 m azalmadıysa ya da 5 takılmadan sonra: in, yürü
function progress(b, dt) {
  const vd = b.vd, st = b.s.veh.st, dEnd = Math.hypot(vd.end.x - st.x, vd.end.z - st.z);
  vd.progT += dt;
  if (dEnd < vd.prog - 20) { vd.prog = dEnd; vd.progT = 0; }
  if (vd.progT > VBOT.stuck.noProg || vd.stuck >= VBOT.stuck.max) { vbExit(b, vd.stuck >= VBOT.stuck.max ? 'takıldı' : 'ilerlemedi'); return false; }
  return true;
}

// atış hatası: piyadeye karşı büyük (tank topu bir askeri her atışta öldürmesin: tank zırhlıya karşı silah), araca karşı zorluk kadar
const gunErr = (G, tg) => { const e = G.err * (tg.s ? G.inf.err : 1); return [rand(-1, 1) * e, rand(-1, 1) * e * 0.2]; };      // dikey hata düz zeminde menzili çok kaydırır (yatık yay): küçük
// ───── tank topu: görünen düşmana (araç önce) kule + namlu, mermi düşüşü / öncü, zorluk hatası + tepki + ek bekleme ─────
function tankGun(b, dt, inp) {
  const s = b.s, g = b.game, v = s.veh, st = v.st, vd = b.vd, G = VBOT.gun[b.dk] || VBOT.gun.normal, c = v.def.cannon;
  const eye = _e.set(st.x, st.y + 2.7, st.z);
  if ((vd.scanT = (vd.scanT ?? 0) - dt) <= 0) {
    vd.scanT = 0.35;
    let best = null, bs = 1e9;
    for (const e of g.soldiers) {
      if (!e.alive || e.team === s.team || e.protT > 0.5 || e.veh) continue;
      const dd = Math.hypot(e.pos.x - st.x, e.pos.z - st.z);
      if (dd > G.inf.range || dd < 12) continue;
      if (!g.botSees(eye, e.center(_t))) continue;
      const sc = dd - (vd.tg?.s === e ? 25 : 0);
      if (sc < bs) { bs = sc; best = { s: e }; }
    }
    for (const o of g.vehicles.list) {
      if (!o.alive || !o.st || o === v) continue;
      const tm = g.vehicles.teamOf(o); if (!tm || tm === s.team || !o.seats.some(Boolean)) continue;
      const dd = Math.hypot(o.st.x - st.x, o.st.z - st.z);
      if (dd > G.range + 30 || dd < 10) continue;
      if (!g.botSees(eye, _t.set(o.st.x, o.st.y + o.def.top * 0.6, o.st.z))) continue;
      const sc = dd - (o.def.cannon ? 140 : 90) - (vd.tg?.v === o ? 25 : 0);
      if (sc < bs) { bs = sc; best = { v: o }; }
    }
    if (best && (best.s !== vd.tg?.s || best.v !== vd.tg?.v)) { vd.tg = best; vd.react = rand(G.react[0], G.react[1]); vd.err = gunErr(G, best); }
    else if (!best) vd.tg = null;
  }
  if (vd.tg && (vd.tg.s ? !vd.tg.s.alive || vd.tg.s.veh : !vd.tg.v.alive)) vd.tg = null;
  const tg = vd.tg;
  if (!tg) { inp.yw = yawFromDir(-Math.sin(st.yaw), -Math.cos(st.yaw)); inp.pt = 0.02; return; }
  const p = tg.s ? tg.s.center(_t) : _t.set(tg.v.st.x, tg.v.st.y + tg.v.def.top * 0.55, tg.v.st.z);
  const tv = tg.s ? tg.s.vel : { x: tg.v.st.vx, z: tg.v.st.vz };
  gunPose(st, _o, _d);
  let dx = p.x - _o.x, dz = p.z - _o.z;
  const D0 = Math.hypot(dx, dz), tof = D0 / c.speed;
  dx += tv.x * tof * G.lead; dz += tv.z * tof * G.lead;
  const D = Math.hypot(dx, dz), dy = (tg.s ? tg.s.pos.y - 0.25 : p.y) - _o.y;          // asker: ayağının dibindeki zemine (yandan ıskalayan mermi yokuş aşağı uçup uzağa düşmesin, yanında patlasın)
  const drop = Math.atan((c.grav * D) / (2 * c.speed * c.speed));
  inp.yw = yawFromDir(dx, dz) + vd.err[0];
  inp.pt = Math.atan2(dy, D) + drop + vd.err[1];
  vd.react -= dt;
  // ateş: dolum + ek bekleme bitti, kule hedefte, açı top sınırında
  const yerr = Math.abs(angleDiff(st.tyaw, inp.yw)), perr = Math.abs(st.gp + st.pitch * Math.cos(st.tyaw - st.yaw) - inp.pt);
  if (vd.react <= 0 && v.rl <= 0 && g.time >= (vd.cdT || 0) && yerr < 0.008 + 0.6 / (D + 10) && perr < 0.006) {
    // dost ateşi: namlu hattında 6 m'ye yakın takım arkadaşı varsa atma
    for (const e of g.soldiers) {
      if (!e.alive || e.team !== s.team || e === s) continue;
      const ex = e.pos.x - _o.x, ez = e.pos.z - _o.z, t = (ex * dx + ez * dz) / (D * D);
      if (t > 0 && t < 1.05 && Math.hypot(ex - dx * t, ez - dz * t) < 6) return;
    }
    vd.fire = true; vd.cdT = g.time + c.reload + G.cd + (tg.s ? G.inf.cd : 0);
    vd.err = gunErr(G, tg);
  }
}

// ───── 12.189 bot pilot (helikopter): basit arcade otopilot ─────
// Durumlar: wait (helipadde rotor döner, kapı nişancılarını bekler) → climb (dikey kalkış, güvenli irtifa) → cruise (mangal bayrağının yörünge
// noktasına; yol üstünde ileriye bakan arazi + kutu tepesi örneklemesiyle irtifa, düşman üssünün çevresinden dolanır) → orbit (bayrağın çevresinde
// 78 m yarıçapta, 36 m irtifada daire (makineli saçılması: daha uzaktan isabet yok); iç kapıdaki nişancı bayrağa bakar) → (hasar %55 altı / süre / nişancı kalmadı) rtb (kendi helipadine) → land
// (pad üstünde konum tutarak alçalış) → pilot iner. Yanıyorsa: alçal + in (atlamaz). Rotor / gövde çarpmasında geri çekilip tırmanır (12.183
// asılı kalma döngüsüne girmesin). Girdi oyuncunun pilot girdisiyle aynı: { f, r, u, d, yw }.
export const HELI = {
  pilots: (per) => (per >= 16 ? 2 : 1),          // takımda aynı anda en çok bot pilot
  wait: [3.6, 9], climbAgl: 32, cruiseAgl: 40, orbitAgl: 36, orbitR: 78, maxF: 0.62, orbitF: 0.36,
  orbitT: [55, 85], rtbHp: 0.55, baseAvoid: 150, landR: 26,
  diff: { easy: 0.6, normal: 1, hard: 1 },        // pilot olma olasılığı (zorluk)
};
function heliOk(g, s, b) {
  if (Math.random() > (HELI.diff[b.dk] ?? 1)) return false;
  let n = 0;
  for (const o of g.brains) if (o.vd?.kind === 'heli' && o.s.team === s.team && o.s.alive) n++;
  const per = g.soldiers.filter((e) => e.team === s.team).length;
  return n < HELI.pilots(per);
}
const _hq = [];
// yolun ileri kısmında (yatay yön dx, dz; L m) zemin + kutu tepesi en yükseği
function aheadTop(g, x, z, dx, dz, L) {
  const W = g.world, T = g.map.terrain || W.terrain, n = Math.max(1, Math.ceil(L / 25));
  let top = -1e9;
  for (let i = 0; i <= n; i++) {
    const px = x + dx * L * i / n, pz = z + dz * L * i / n;
    top = Math.max(top, T ? T.heightAt(px, pz) : 0);
    for (const c of W.query(px - 9, pz - 9, px + 9, pz + 9, _hq)) if (!c.nocar && c.max[1] > top) top = c.max[1];
  }
  return top;
}
function inZone(z, x, zz, pad) { return z && x > z.minX - pad && x < z.maxX + pad && zz > z.minZ - pad && zz < z.maxZ + pad; }
// düşman üssünü kesen düz hat → üssün genişletilmiş köşesinden ara nokta
function avoidBase(g, team, x0, z0, x1, z1) {
  const Z = g.map.baseZones?.[team === 'blue' ? 'red' : 'blue'], P = HELI.baseAvoid;
  if (!Z) return null;
  let hit = false;
  for (let i = 1; i <= 20 && !hit; i++) { const t = i / 20; if (inZone(Z, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, P - 20)) hit = true; }
  if (!hit) return null;
  const cs = [[Z.minX - P, Z.minZ - P], [Z.maxX + P, Z.minZ - P], [Z.minX - P, Z.maxZ + P], [Z.maxX + P, Z.maxZ + P]];
  let best = null, bd = 1e18;
  for (const [cx, cz] of cs) { const d = Math.hypot(cx - x0, cz - z0) + Math.hypot(x1 - cx, z1 - cz); if (d < bd) { bd = d; best = { x: cx, z: cz }; } }
  return best;
}

function heliDrive(b, dt, inp) {
  const s = b.s, g = b.game, V = g.vehicles, v = s.veh, st = v.st, vd = b.vd, d = v.def, T = g.map.terrain || g.world.terrain;
  inp.u = false; inp.d = false; inp.f = 0; inp.r = 0;
  const gnd = T.heightAt(st.x, st.z), agl = st.y - gnd, sp = V.speed(v);
  const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
  const hold = (x, z, k = 0.45, vmax = 9) => {                      // konum tut: hedef noktaya yerel hız isteği (pad üstü, yavaş yaklaşma)
    const L = toLocal2(st, x, z), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
    const vF = st.vx * fx + st.vz * fz, vR = st.vx * rx + st.vz * rz;
    const wF = clamp(L.f * k, -vmax, vmax), wR = clamp(L.r * k, -vmax, vmax);
    inp.f = clamp((wF + (wF - vF) * 0.6) / (wF >= 0 ? d.maxF : d.maxB), -1, 1); inp.r = clamp((wR + (wR - vR) * 0.6) / d.maxS, -1, 1);
    return Math.hypot(L.f, L.r);
  };
  const altTo = (want) => { if (st.y < want - 1.5) inp.u = true; else if (st.y > want + 3) inp.d = true; };
  inp.yw = Number.isFinite(inp.yw) ? inp.yw : st.yaw;
  // yanıyor / çok hasarlı: alçal, yere değince in (pilot atlamaz)
  if (v.burn || st.sunk || vd.state === 'emerg') {
    vd.state = 'emerg';
    if (!st.air && sp < 2) { vbExit(b, 'hasar'); return; }
    inp.d = agl > 1.5; inp.f = clamp(-((st.vx * fx + st.vz * fz)) / 20, -0.5, 0.5);
    V.drive(v, inp, dt); return;
  }
  // çarpma (rotor ucu / gövde): 1,5 sn geri çekil + tırman
  if (st.hit > 2 || st.land > 3) vd.bumpT = 1.5;
  if (vd.bumpT > 0) { vd.bumpT -= dt; inp.u = true; inp.f = -0.4; V.drive(v, inp, dt); return; }
  const home = v.spawn, o = tripDest(b);
  if (vd.state === 'wait') {
    const coming = g.brains.some((q) => (q.rideGoal === v || q.vRide?.v === v) && q.s.alive), full = !v.seats.some((q, i) => i > 0 && !q), gun = v.seats[1] || v.seats[2];
    if (st.rpm > 0.95 && gun && (vd.t > HELI.wait[1] || (vd.t > HELI.wait[0] && (!coming || full)))) { vd.state = 'climb'; vd.tOff = vd.t; }
    else if (vd.t > HELI.wait[1] * (coming ? 2 : 1) && !gun) { v.botBad = g.time + 30; vbExit(b, 'nişancısız'); return; }      // kapı nişancısı yoksa kalkmaz (helikopterin işi nişancıyı taşımak)
    V.drive(v, inp, dt); return;
  }
  if (vd.state === 'climb') {
    const top = aheadTop(g, st.x, st.z, 0, 0, 0);
    inp.u = true;
    if (st.y > Math.max(gnd + HELI.climbAgl, top + 15)) vd.state = 'cruise';
    if (vd.t - vd.tOff > 25) vd.state = 'cruise';
    V.drive(v, inp, dt); return;
  }
  // hasar / süre / nişancısız → üsse dön
  const gunners = v.seats.some((q, i) => i > 0 && q);
  if ((vd.state === 'cruise' || vd.state === 'orbit') && (v.hp < d.hp * HELI.rtbHp || (vd.state === 'orbit' && (vd.t - vd.orbitT0 > vd.orbitFor || !gunners)) || !o)) vd.state = 'rtb';
  let tx, tz, want, fmax = HELI.maxF;
  if (vd.state === 'cruise' || vd.state === 'orbit') {
    if (vd.dest !== o) { vd.dest = o; if (vd.state === 'orbit') vd.state = 'cruise'; vd.dir = Math.random() < 0.5 ? 1 : -1; }
    const a0 = Math.atan2(st.z - o.z, st.x - o.x), dc = Math.hypot(st.x - o.x, st.z - o.z), R0 = HELI.orbitR;
    if (vd.state === 'cruise') {
      // yörüngeye giriş: bayrağın bize bakan yanında yarıçap noktası
      tx = o.x + Math.cos(a0) * R0; tz = o.z + Math.sin(a0) * R0;
      const w = avoidBase(g, s.team, st.x, st.z, tx, tz); if (w) { tx = w.x; tz = w.z; }
      if (dc < R0 + 25) { vd.state = 'orbit'; vd.orbitT0 = vd.t; vd.orbitFor = rand(HELI.orbitT[0], HELI.orbitT[1]); }
    }
    if (vd.state === 'orbit') {
      let a1 = a0 + vd.dir * 0.42;
      const Z = g.map.baseZones?.[s.team === 'blue' ? 'red' : 'blue'];
      if (inZone(Z, o.x + Math.cos(a1) * R0, o.z + Math.sin(a1) * R0, 60)) { vd.dir = -vd.dir; a1 = a0 + vd.dir * 0.42; }      // düşman üssüne girmeden dön
      tx = o.x + Math.cos(a1) * R0; tz = o.z + Math.sin(a1) * R0; fmax = HELI.orbitF;
    }
  } else if (vd.state === 'rtb' || vd.state === 'land') {
    tx = home.x; tz = home.z;
    const w = vd.state === 'rtb' ? avoidBase(g, s.team, st.x, st.z, tx, tz) : null; if (w) { tx = w.x; tz = w.z; }
    if (vd.state === 'rtb' && Math.hypot(st.x - home.x, st.z - home.z) < HELI.landR) vd.state = 'land';
  }
  if (vd.state === 'land') {
    const e = hold(home.x, home.z);
    const top = aheadTop(g, st.x, st.z, 0, 0, 0);
    if (e < 4 && sp < 3) inp.d = true; else altTo(Math.max(gnd, top) + 14);
    if (!st.air && sp < 1.2) { vd.landT = (vd.landT || 0) + dt; if (vd.landT > 1) { stat(g).arrive++; v.botBad = g.time + 50; vbExit(b, 'indi'); return; } }      // bir uçuş sonra 50 sn yerde (sürekli 3 bot gökte kalmasın)
    if ((vd.landFor = (vd.landFor || 0) + dt) > 40 && !st.air) { vbExit(b, 'indi'); return; }
    V.drive(v, inp, dt); return;
  }
  // seyir / yörünge: burun hedefe, hız açıya göre, irtifa ileri bakışla
  const dx = tx - st.x, dz = tz - st.z, D = Math.hypot(dx, dz) || 1;
  inp.yw = yawFromDir(dx, dz);
  const ye = Math.abs(angleDiff(st.yaw, inp.yw));
  inp.f = ye > 0.7 ? 0.08 : fmax * clamp(D / 60, 0.3, 1) * (1 - ye * 0.6);
  const look = clamp(sp * 4, 60, 200), top = aheadTop(g, st.x, st.z, dx / D, dz / D, look);
  want = Math.max(top + 16, gnd + (vd.state === 'orbit' ? HELI.orbitAgl : HELI.cruiseAgl));
  if (st.y < top + 10) inp.f = Math.min(inp.f, 0.05);                 // önü yüksek: önce tırman
  altTo(want);
  if (agl < 12 && !inp.u) { inp.d = false; inp.u = true; }             // asla yere yaklaşma (iniş dışında)
  // ilerleme: 45 sn'de hedefe 30 m yaklaşmadıysa (yörünge hariç) üsse dön
  if (vd.state === 'cruise') { vd.progT = (vd.progT || 0) + dt; if (D < (vd.prog ?? 1e9) - 30) { vd.prog = D; vd.progT = 0; } if (vd.progT > 45) vd.state = 'rtb'; }
  V.drive(v, inp, dt);
}
