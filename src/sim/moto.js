// 12.204 ARAZİ MOTOSİKLETİ (saf mantık: DOM / THREE / ses yok). Çevrimdışı oyun, sunucu (yetkili) ve sürücünün istemci tahmini AYNI adımı kullanır.
//
// Hızlı ulaşım aracı: 2 koltuk (0 sürücü: silahsız, 1 arka yolcu: kendi piyade silahı). Jipten hızlı (31 m/sn ≈ 112 km/s; jip 23) ve çevik
// (dönüş açısı hızla daha çok küçülür: yüksek hızda kararlı, düşükte keskin), ama zayıf: 150 can, mermiye açık (bulletMul 0,55), binici
// açıkta (gövde kutusu alçak: biniciler vurulur). Fizik jipin teker modeli (stepCar; 4 teker noktası, iz genişliği 0,24 m = iki teker hattı)
// + motosiklete özgü kurallar:
//   · Rampadan çıkış: havalanırken dikey hız × launch (zıplak; tepe / rampa sırtından uçar), havada eğim yavaş düzleşir.
//   · Devrilme: (1) hafif (yan yamaç > tipSlope yavaşken, 7,5–12,5 m/sn çarpma, yan yatık iniş) → motor tipT sn yana yatar, kendini toparlar,
//     binici koltukta kalır (sürülemez); (2) sert kaza (≥ crashHit çarpma, ≥ crashLand iniş ya da burun / kuyruk üstüne iniş) → binici(ler) savrulur
//     (yetkili taraf: game/motorbike.js motoAfterStep), motor fallT sn yerde yatar, sonra kendiliğinden doğrulur (boş).
//   · Su: tekerler stall m'den derin suya girince motor stop eder (gaz yok, sert sürüklenme: suda durur); gövde wade m'den derindeyse batar.
// Durum alanları (makeVehicle'a ek): fall (devrik kalan sn), fallK (0 yok · 1 hafif · 2 sert; işaret = yattığı yan: −1 sol, +1 sağ),
// crash (bu adımın kaza hızı, yetkili taraf binicileri atar), stall (su).

export const MOTO = {
  name: 'Motor', hp: 150, seats: 2, moto: true,
  hl: 1.0, hw: 0.36, top: 1.0, clear: 0.24,                // gövde kutusu (çatal ucu – arka çamurluk, gidon / sele yüksekliği): binicinin beli üstü açıkta
  wb: 1.42, tr: 0.24, wheelR: 0.34,
  maxF: 31, maxR: 3.5, accel: 12.5, brake: 17, roll: 0.8, drag: 0.0012,
  steerMax: 0.9, steerV: 3.5, steerRate: 4, grip: 11, gripHand: 2.4,      // dönüş: 10 m/sn'de ~1,7 rad/sn (jip 1,3), 25 m/sn'de ~1,9 (yan ivme ~4,7 g: arcade)
  slide: 0.62, climbK: 1.5,
  // koltuklar [ileri, sağ, sele yüksekliği]: 0 sürücü (silahsız; sol tık korna), 1 arka yolcu (kendi silahı)
  seat: [[0.04, 0, 0.86], [-0.6, 0, 0.93]], horn: true, seatKey: [null, 'veh.seat.moto1'],
  blastMul: 1.7, bulletMul: 0.55, hmgMul: 0.9, atMul: 1.8, ramMin: 7, ramMul: 6,
  burnAt: 0.25, burnRate: 10, boom: [3.5, 60],
  respawn: 15, wreck: 5, idleRespawn: 60,                    // patlayınca ~20 sn'de (enkaz 5 + 15) yeniden doğar; boş bırakılınca 60 sn
  mass: 0.35, wade: 0.95, stall: 0.5, stepUp: 0.42,
  hitSafe: 7, hitMul: 2, landSafe: 11, landMul: 4,           // çarpma / iniş hasarı (÷ kütle 0,35): 15 m/sn duvar ≈ 46, 23 m/sn ≈ 94 (yanmaz), 28+ m/sn yanar
  tipHit: 7.5, crashHit: 12.5, crashLand: 13, crashTilt: 0.75, tipSlope: 0.6, tipT: 1.1, fallT: 2.4, launch: 1.2,
  ejectK: 4.5, ejectSafe: 8,                                  // savrulan biniciye hasar: (kaza hızı − ejectSafe) × ejectK (22 m/sn ≈ 63, 31 m/sn ≈ 100: ölür)
};

// Bir adım: core = sim/vehicle.js stepCar (jip teker modeli). Girdi: { f, r, b } ya da null (sürücüsüz)
export function stepMoto(v, inp, dt, T, core, depth) {
  const d = v.def;
  v.crash = 0;
  const dep = depth(T.terrain, v.x, v.y, v.z);                           // tekerin bastığı yerde su derinliği
  v.stall = dep > d.stall;
  let ip = inp;
  if (v.fall > 0) { v.fall = Math.max(0, v.fall - dt); if (v.fall <= 0) v.fallK = 0; ip = null; }      // devrik: sürülemez (el freni; yerde kayar)
  else if (v.stall && inp) ip = { f: 0, r: inp.r, b: true };                                       // suda motor stop: durur
  const air0 = v.air, sp0 = Math.hypot(v.vx, v.vz);
  core(v, ip, dt, T);
  if (v.stall) { const k = Math.exp(-3.5 * dt); v.vx *= k; v.vz *= k; }
  if (!air0 && v.air && v.vy > 0) v.vy *= d.launch;                       // rampadan / tepeden çıkış: zıplak
  if (v.fall > 0) return;
  // devrilme
  const side = (v.steer > 0.02 ? -1 : v.steer < -0.02 ? 1 : v.roll >= 0 ? 1 : -1);
  const tiltL = air0 && !v.air ? Math.max(Math.abs(v.pitch), Math.abs(v.roll)) : 0;      // inişte burun / yan yatıklık
  const hard = v.hit >= d.crashHit || v.land >= d.crashLand || (v.land > 4 && tiltL > d.crashTilt && sp0 > 6);
  const soft = !hard && (v.hit >= d.tipHit || (v.land > 3 && tiltL > d.crashTilt * 0.7) || (!v.air && Math.abs(v.roll) > d.tipSlope && sp0 < 4));
  if (hard) { v.fall = d.fallT; v.fallK = 2 * side; v.crash = Math.max(v.hit, v.land, sp0); }
  else if (soft) { v.fall = d.tipT; v.fallK = side; }
}
