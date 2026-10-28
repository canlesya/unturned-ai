// ───── 12.204 Arazi motosikleti: oyun tarafı bağlantıları ─────
// Fizik sim/moto.js (sunucu = çevrimdışı = tahmin), model models/moto.js. Bu dosya mevcut araç dosyalarına küçük kancalarla bağlanır:
//   · motoAfterStep  (game/vehicles.js afterStep, YETKİLİ taraf): sert kazada biniciler savrulur + hasar, bot sürücü durumu temizlenir.
//   · MOTO_FX / motoFrame (game/vehicleView.js): efekt noktaları + daha tiz tek silindir motor sesi; dönüşte yana yatma (görsel: v²·eğrilik / g),
//     tekerlerin dönüşü, çatal + gidon direksiyonu, devrilince yan yatış (hafifte kalkar, sertte yerde yatıp doğrulur).
//   · motoRiderPose (game/soldier.js _seatPose): motora ata biner gibi (bacaklar iki yanda, ayak basamakta), sürücü öne eğik, eller gidonda.
//   · motoBotOk (game/vehicleBots.js vbBoard): botlar takımın bütün motorlarını kapmaz (insan oyuncu varsa yarısı, yoksa dörtte üçü);
//     motorun yakınında (30 m) yürüyen insan takım arkadaşı varsa bot almaz (bekler).
//   · MOTO_ICON: HUD paneli / binme ipucu / öldürme akışı simgesi.
import { clamp } from './util.js';

export const MOTO_BOT = { trip: 110, tripSmall: 70, park: 22, speed: [24, 15], clr: 1.0, humanNear: 30, share: 0.5, shareNoHuman: 0.75 };

// efekt noktaları (yerel f, r, u): far, egzoz [f, r, u, yukarı mı], toz (arka teker), hasar dumanı (motor bloğu), motor sesi [taban Hz, devir aralığı]
export const MOTO_FX = { lights: [[0.62, 0, 0.92]], exh: [[-0.92, 0.19, 0.9, 0]], dust: [[-0.72, 0]], hood: [0.05, 0, 0.62], eng: [68, 150], vol: 0.3, inVol: 0.2 };

export const MOTO_ICON = '<svg class="hsi vs" viewBox="0 0 16 16"><circle cx="3.6" cy="11" r="2.4" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12.4" cy="11" r="2.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.6 11 6.4 7h4.2l1.8 4M8.6 7 7.6 4.6h2.2M10.6 7l1.2-2.4h1.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.6 6.4h4l-.6 1.4H6.2z" fill="currentColor"/></svg>';

// ── yetkili taraf: kaza ──
export function motoAfterStep(V, v) {
  const st = v.st, d = v.def;
  if (!(st.crash > 0)) return;
  const g = V.g, occ = V.occupants(v);
  for (const s of occ) {
    const b = s.brain;
    V.exit(s);
    // savrulma: motorun hızının bir kısmı ileri + yukarı (düşme hasarı yok: hasar kaza hızından)
    s.vel.set(st.vx * 0.7, 3 + Math.min(3, st.crash * 0.12), st.vz * 0.7); s.onGround = false; s.fallSafe = true;
    const dmg = Math.max(0, st.crash - d.ejectSafe) * d.ejectK;
    if (dmg > 0 && s.alive) s.takeDamage(dmg, v.lastHit && g.time - v.lastHitT < 6 ? v.lastHit : null, 'body', { x: st.x, y: st.y + 0.5, z: st.z }, d.name);
    if (b?.vd) { b.vd = null; b.goalT = 0; b.path = null; b.target = null; const S = g.vbStats; if (S) S.exit['kaza'] = (S.exit['kaza'] || 0) + 1; }
  }
  g.emit('motocrash', { v, n: occ.length });
}

// ── görünüm ──
// it: VehicleView öğesi, st: gösterilen durum (pose), fwd: ileri hız, yr: yaw hızı (rad/sn). Kökün eğim / yaw'ı çağıran tarafından kondu; yatış burada.
export function motoFrame(it, v, st, dt, fwd, yr, far) {
  const m = it.model, U = m.userData;
  // dönüşte yatma: tan(yatış) = v · ω / g (yatık değilken yavaşta 0); yumuşatılmış, ±0,7 rad
  const want = v.alive && !st.air ? clamp(Math.atan(fwd * yr / 9.8) * 0.9, -0.7, 0.7) : (it.lean || 0) * 0.96;
  it.lean = (it.lean || 0) + (want - (it.lean || 0)) * (1 - Math.exp(-7 * dt));
  // devrik: hafif (|fallK| = 1) 0,95 rad yatıp kalkar, sert (2) yere yatar (1,38 rad) → fall bitince doğrulur. Enkaz: yan yatık
  const fk = st.fallK || 0, side = Math.sign(fk);
  let tip = 0;
  if (!v.alive) tip = 1.38 * (it.tipSide || 1);
  else if (fk && st.fall > 0) {
    const T = Math.abs(fk) === 2 ? v.def.fallT : v.def.tipT, u = 1 - st.fall / T;           // 0 → 1
    const peak = Math.abs(fk) === 2 ? 1.38 : 0.95, up = Math.abs(fk) === 2 ? 0.25 : 0.45;  // son 'up' kısımda doğrulur
    tip = side * peak * (u < 0.18 ? u / 0.18 : u > 1 - up ? (1 - u) / up : 1);
    it.tipSide = side;
  }
  it.tip = (it.tip || 0) + (tip - (it.tip || 0)) * (1 - Math.exp(-14 * dt));
  m.rotation.z = (st.roll || 0) + it.lean + it.tip;
  m.position.y += Math.abs(Math.sin(it.tip)) * -0.02;
  // tekerler + direksiyon (çatal yatık eksende döner, gidon / far / ön teker birlikte)
  it.spin = ((it.spin || 0) + (v.alive ? fwd : 0) * dt / v.def.wheelR) % (Math.PI * 2);
  if (U.wr) U.wr.rotation.x = -it.spin;
  if (U.wf) U.wf.children[0].rotation.x = -it.spin;
  if (U.fork) U.fork.rotation.y = clamp(-(st.steer || 0) * 1.25, -0.7, 0.7) * (far < 120 ? 1 : 0);
}

// ── asker: motorda oturuş (yalnız görsel; Soldier._seatPose'tan sonra) ──
export function motoRiderPose(p, seat) {
  for (const lg of [p.legs.L, p.legs.R]) {
    const sx = lg === p.legs.R ? 1 : -1;
    lg.hip.rotation.x = seat === 0 ? 0.95 : 0.8; lg.knee.rotation.x = seat === 0 ? -1.55 : -1.5; lg.hip.rotation.z = sx * 0.3;
    if (lg.foot) lg.foot.rotation.x = 0.45;
    lg.hip.position.x = sx * 0.12;
  }
  if (seat === 0) p.torso.rotation.x -= 0.32;                                         // sürücü öne eğik (eller gidonda)
}

// ── botlar: motor kuralı ──
// busyN: takımda şu an motordaki / motora yürüyen bot sayısı. Takımda insan varsa motorların yarısı, yoksa dörtte üçü (en az 1) botlara.
export function motoBotOk(g, s, v, busyN) {
  let n = 0, human = false;
  for (const o of g.vehicles.list) if (o.def.moto && o.alive && o.team === s.team) n++;
  for (const e of g.soldiers) {
    if (e.team !== s.team || !(e.human || e.isPlayer)) continue;
    human = true;
    if (e.alive && !e.veh && Math.hypot(e.pos.x - v.st.x, e.pos.z - v.st.z) < MOTO_BOT.humanNear) return false;      // insan oyuncu motora yakın: bekle
  }
  const cap = Math.max(1, Math.floor(n * (human ? MOTO_BOT.share : MOTO_BOT.shareNoHuman)));
  return busyN < cap;
}
export const motoTrip = (g) => (g.map.big ? MOTO_BOT.trip : MOTO_BOT.tripSmall);
