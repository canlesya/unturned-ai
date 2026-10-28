import * as THREE from 'three';
import { clamp, rand, angleDiff, yawFromDir } from './util.js';
import { toWorld } from '../sim/vehicle.js';
import { arcYaw, arcPitch } from '../sim/emplacement.js';

// 12.213 botlar ve sabit silah yuvaları (ağır makineli / tanksavar) + gözetleme kulesi nişancı mevzisi. Küçük ve ayrı (bot.js'te üç kanca:
// board → empBoard, update (araçtaysa) → empRide, Game.perch → towerPerch).
// Kural: savunan bot (kendi takımının bayrağının 80 m'sinde) yakındaki (≤ 45 m; kule ≤ 60 m) boş yuvaya ara sıra geçer; takım başına en çok
// EMPB.share × bot sayısı (en az 2) bot yuvada / yolda. Düşman zırhlısı (tank) bir tanksavar yuvasının 240 m'sine girince yakındaki bot bu
// sınırı beklemeden tanksavara koşar. Yuvadaki bot: görüşteki düşmanı yayın içindeyse vurur (makineli: piyade + hafif araç; tanksavar: araçlar,
// önce tank, öncüllü nişan). Uzun süre hedef yoksa (makineli 40 sn, tanksavar 30 sn), yayın dışından yakına düşman gelirse ya da canı azsa iner.
export const EMPB = { share: 0.12, min: 2, scan: 1.5, chance: 0.3, reach: 45, reachTower: 60, defendR: 80, tankR: 240, idle: { hmg: 40, atgm: 30 }, cd: 20, sniperTower: 0.7 };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = { x: 0, y: 0, z: 0 };

const kindOk = (s) => s.cls !== 'sniper' && s.cls !== 'medic';
function teamBusy(g, team) {
  let n = 0, all = 0;
  for (const e of g.soldiers) { if (e.team !== team || e.vacant) continue; all++; if ((e.veh && e.veh.def.fixed) || (e.brain?.empGo && e.alive)) n++; }
  return { n, cap: Math.max(EMPB.min, Math.ceil(all * EMPB.share)) };
}
// yuvanın nişancı noktası (yaw = yuvanın yönü) + yaklaşma noktası (mevzi: arkası açık, 1,5 m geride; kule: platform ağzı)
function seatPt(V, v, out) { const sp = v.def.seat[0]; return toWorld({ ...v.st, yaw: v.st.base ?? v.st.yaw, pitch: 0, roll: 0 }, sp[0], sp[1], 0, out); }

// pano: binmeye yürüyorsa true (bot.board akışı durur)
export function empBoard(b) {
  const s = b.s, g = b.game, V = g.vehicles;
  if (!V || s.veh || b.vRes || b.vRide || b.vd || s.def.zombie || g.online) return false;
  const go = b.empGo;
  if (go) {
    const v = go.v;
    if (!v.alive || v.seats[0] || g.time > go.t || s.hp < 30) { b.empGo = null; b.rideGoal = null; b.rideTo = null; b.goalT = 0; b.empCD = g.time + 6; return false; }
    const P = seatPt(V, v, _p), dh = Math.hypot(P.x - s.pos.x, P.z - s.pos.z), dy = Math.abs(P.y - s.pos.y);
    if (dh < 1.1 && dy < 1.4) { b.empGo = null; b.rideGoal = null; b.rideTo = null; V.enter(s, v, 0); b.empT = 0; b.target = null; return true; }
    if (dh < 3.2 && dy < 1.4) { b.rideGoal = v; b.rideTo = { x: P.x, z: P.z }; return true; }            // yakında: doğrudan nişancı yerine (bot.update rideGoal dalı)
    b.rideGoal = null; b.rideTo = null;
    if (!b.goal || Math.hypot(b.goal.x - go.ax, b.goal.z - go.az) > 1 || g.time - (go.gT || 0) > 8) { b.setGoal(go.ax, go.az, 30, go.ay); go.gT = g.time; b.perching = false; b.via = null; }
    return false;
  }
  if ((b.empScan = (b.empScan ?? rand(0, EMPB.scan)) - 0.3) > 0) return false;
  b.empScan = EMPB.scan;
  if (!kindOk(s) || s.hp < 60 || g.time < (b.empCD || 0)) return false;
  const B = teamBusy(g, s.team);
  let best = null, bs = -1e9;
  for (const v of V.list) {
    if (!v.def.fixed || !v.alive || v.seats[0] || !v.st) continue;
    if (v.empRes && v.empRes.alive && v.empRes.brain?.empGo?.v === v) continue;
    const d = Math.hypot(v.st.x - s.pos.x, v.st.z - s.pos.z), tw = !!v.spawn.tower;
    if (d > (tw ? EMPB.reachTower : EMPB.reach)) continue;
    let tank = false;
    if (v.def.atgm) for (const o of V.list) if (o.alive && o.st && o.def.armor && V.teamOf(o) && V.teamOf(o) !== s.team && Math.hypot(o.st.x - v.st.x, o.st.z - v.st.z) < EMPB.tankR) { tank = true; break; }
    const own = g.mode.objectives.some((o) => o.owner === s.team && Math.hypot(o.x - v.st.x, o.z - v.st.z) < EMPB.defendR);
    if (!tank && (!own || B.n >= B.cap || Math.random() > EMPB.chance)) continue;
    if (tank && B.n >= B.cap + 2) continue;
    if (v.def.atgm && !tank) continue;                                             // tanksavar yalnız zırhlı gelince (yoksa boşuna beklemez)
    const sc = -d + (tank ? 100 : 0) + (tw ? 8 : 0);
    if (sc > bs) { bs = sc; best = v; }
  }
  if (!best) return false;
  const v = best, tw = v.spawn.tower ? g.map.towers?.find((t) => t.id === v.spawn.tower) : null;
  let ax, az, ay;
  if (tw) { const e = tw.pts[tw.pts.length - 1]; ax = e.x; az = e.z; ay = e.y; }
  else { const P = seatPt(V, v, _p), by = v.st.base ?? v.st.yaw; ax = P.x + Math.sin(by) * 1.6; az = P.z + Math.cos(by) * 1.6; ay = undefined; }      // arkası (ileri −sin/−cos → geri +)
  b.empGo = { v, t: g.time + 40, ax, az, ay };
  v.empRes = s;
  b.setGoal(ax, az, 30, ay); b.empGo.gT = g.time; b.perching = false; b.via = null;
  return false;
}

// yuvadaki bot: hedef seç, silahı döndür (V.drive: sunucu / oyuncu ile aynı yay), ateş et; gerekince in
export function empRide(b, dt) {
  const s = b.s, g = b.game, V = g.vehicles, v = s.veh, d = v.def, st = v.st;
  b.senseT -= dt;
  if (b.senseT <= 0) { b.senseT = 0.25 + Math.random() * 0.1; b.sense(); }
  if (b.target && !b.target.alive) b.target = null;
  const eye = s.eye(_a), inArc = (x, z) => Math.abs(angleDiff(arcYaw(st, yawFromDir(x - eye.x, z - eye.z)), yawFromDir(x - eye.x, z - eye.z))) < 0.02;
  let P = null, tv = null, dist = 0;
  // araç hedefi: tanksavarda her araç (önce zırhlı), makinelide hafif araç (zırhsız) — görüşte ve yayda
  let bs = 1e9;
  for (const o of V.list) {
    if (!o.alive || !o.st || o === v || o.def.fixed) continue;
    const tm = V.teamOf(o); if (!tm || tm === s.team || !o.seats.some(Boolean)) continue;
    if (!d.atgm && o.def.armor) continue;
    const dd = Math.hypot(o.st.x - eye.x, o.st.z - eye.z); if (dd > (d.atgm ? 420 : 260) || dd < 8 || !inArc(o.st.x, o.st.z)) continue;
    if (!g.botSees(eye, _b.set(o.st.x, o.st.y + o.def.top * 0.6, o.st.z))) continue;
    const sc = dd - (o.def.armor ? 150 : 0) - (b.empTv === o ? 30 : 0);
    if (sc < bs) { bs = sc; tv = o; }
  }
  b.empTv = tv;
  if (tv) {
    dist = bs;
    const T = Math.hypot(tv.st.x - eye.x, tv.st.z - eye.z) / (d.atgm ? d.atgm.speed : 600);
    P = { x: tv.st.x + tv.st.vx * T, y: tv.st.y + tv.def.top * 0.55, z: tv.st.z + tv.st.vz * T };
  } else if (!d.atgm && b.target && inArc(b.target.pos.x, b.target.pos.z)) { const c = b.target.center(_b); P = { x: c.x, y: c.y, z: c.z }; }
  b.empT = P ? 0 : (b.empT || 0) + dt;
  // inme: hedefsiz uzun süre / yayın dışından yakına düşman / can az
  const close = b.target && !P && Math.hypot(b.target.pos.x - s.pos.x, b.target.pos.z - s.pos.z) < 28;
  b.empOut = close ? (b.empOut || 0) + dt : 0;
  if (b.empT > (EMPB.idle[d.emp] || 35) || b.empOut > 1.5 || s.hp < 35) { V.exit(s); b.empCD = g.time + EMPB.cd; b.goalT = 0; b.path = null; b.empT = 0; return; }
  let fire = false;
  if (P) {
    const dx = P.x - eye.x, dz = P.z - eye.z, dh = Math.hypot(dx, dz), wy = yawFromDir(dx, dz), wp = Math.atan2(P.y - eye.y, dh), turn = b.d.turn * 0.75;
    s.yaw = arcYaw(st, s.yaw + clamp(angleDiff(s.yaw, wy), -turn * dt, turn * dt));
    s.pitch = arcPitch(d, s.pitch + clamp(wp - s.pitch, -turn * dt, turn * dt));
    const ok = Math.abs(angleDiff(s.yaw, wy)) < 0.02 + 0.8 / (dh + 10) && Math.abs(wp - s.pitch) < 0.02 + 0.8 / (dh + 10);
    b.reactT -= dt;
    if (ok && b.reactT <= 0) {
      if (d.atgm) { if (v.rl <= 0) V.fireAtgm(v, s, P); }
      else if (b.burstPause > 0) b.burstPause -= dt;
      else { fire = true; if ((b.mgT = (b.mgT ?? rand(0.7, 1.4)) - dt) <= 0) { b.mgT = undefined; b.burstPause = rand(0.35, 0.8); } }
    }
    s.botExtraSpread = b.d.err * 0.35 * (0.4 + (dh || dist) / 220);
  } else {
    s.botExtraSpread = 0;
    const look = (st.base ?? st.yaw) + Math.sin(g.time * 0.35 + s.id) * (d.arc || 1) * 0.7;      // nöbet: yay içinde tarar
    s.yaw = arcYaw(st, s.yaw + clamp(angleDiff(s.yaw, look), -1.2 * dt, 1.2 * dt));
    s.pitch += (0 - s.pitch) * Math.min(1, dt * 2);
  }
  V.drive(v, { yw: s.yaw, pt: s.pitch }, dt);
  V.place(s);
  if (!d.atgm) V.mgFire(s, fire, dt);
}

// keskin nişancı: büyük haritada hedef bayrağın 90 m'sindeki gözetleme kulesinin platform köşesi (boş olan; %70), yoksa null (perchBig)
export function towerPerch(g, o, team) {
  const T = g.map.towers; if (!T?.length || Math.random() > EMPB.sniperTower) return null;
  let best = null, bd = 1e9;
  for (const t of T) {
    const d = Math.hypot(t.x - o.x, t.z - o.z); if (d > 90) continue;
    for (const p of t.perch) {
      if (g.soldiers.some((e) => e.alive && e.brain && e.brain.perching && e.brain.goal && Math.hypot(e.brain.goal.x - p.x, e.brain.goal.z - p.z) < 0.6)) continue;
      const sc = d + Math.random() * 20; if (sc < bd) { bd = sc; best = p; }
    }
  }
  return best ? { x: best.x, z: best.z, y: best.y } : null;
}
