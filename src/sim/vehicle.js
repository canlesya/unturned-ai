// Araç fiziği (12.177; saf mantık: DOM / THREE / ses yok). Çevrimdışı oyun, sunucu (yetkili) ve sürücünün istemci tahmini AYNI fonksiyonu kullanır.
//
// Model "eğlenceli ve öngörülebilir" arcade araba: gövde yatay düzlemde yönlü kutu (OBB). Dört teker noktasının zemini (arazi + üstüne
// çıkılabilir kutu tepeleri: köprü tabliyesi, bordür, kütük) örneklenir → gövde yüksekliği = ortalama, eğim (pitch) = ön − arka, yatış (roll) =
// sağ − sol. Yatay hız ileri / yan bileşenlere ayrılır: motor + fren ileri bileşende, yan bileşen tutunmayla söner (el freninde az → kayma),
// direksiyon açısı hızla küçülür, dönüş hızı = v · tan(açı) / dingil mesafesi. Eğimde yer çekimi bileşeni (yokuş yavaşlatır), çok dik
// yamaçta (> ~35°) kayma; teker zemini bir adımda dikçe yükselirse (duvar gibi arazi) ileri gidiş kesilir. Tepeden hızla çıkınca uçar
// (yere yapışma payı hızla sınırlı), sert inişte hasar. Kutu çarpışması: OBB ↔ AABB ayırma ekseni testi (4 eksen), en küçük girişim
// yönünde itilir, o yöndeki hız silinir (az sekme), çarpma hızı hasara dönüşür. Derin suya girerse (gövde ortası suyun > 1,1 m altında)
// motor boğulur: araç 'battı' (yönetici yolcuları indirir, birkaç sn sonra siler).
//
// Yerel eksenler: f = ileri (yaw yönü: (−sin yaw, −cos yaw), askerlerle aynı), r = sağ ((cos yaw, −sin yaw)), u = yukarı.
// Durum (v): x, y, z (gövde tabanı / zemin ortası), yaw, pitch (burun yukarı +), roll (sağ yukarı +), vx, vy, vz, steer (rad), air (havada mı),
// thr (son gaz −1..1, ses / görsel), sunk, hit (bu adımın en büyük çarpma hızı), land (bu adımın iniş hızı).

import { submerged } from './swim.js';

export const VT = {
  jip: {
    name: 'Jip', hp: 400, seats: 4,
    hl: 1.95, hw: 0.94, top: 1.2, clear: 0.34,              // OBB yarı boy / yarı en (m), gövde üstü (kapı) ve alt boşluk (zemin + bu = gövde altı)
    wb: 2.4, tr: 1.62, wheelR: 0.4,                          // dingil mesafesi, iz genişliği, teker yarıçapı (görsel)
    maxF: 23, maxR: 7, accel: 10, brake: 15, roll: 0.9, drag: 0.0016,   // m/sn (23 ≈ 83 km/s), m/sn²; drag · v² (havada / yolda)
    steerMax: 0.6, steerRate: 3.2, grip: 9, gripHand: 1.7,
    slide: 0.7, climbK: 2.0,                                 // kayma eşiği (eğim tan; 0,7 ≈ 35°), yokuşta güç düşüşü
    // koltuklar: [ileri, sağ, oturak yüksekliği] (yerel). 0 sürücü (sol ön), 1 ön yolcu, 2 arka sol, 3 arka sağ
    seat: [[0.12, -0.42, 0.78], [0.12, 0.42, 0.78], [-0.78, -0.42, 0.84], [-0.78, 0.42, 0.84]],
    blastMul: 1.6, bulletMul: 0.12, ramMin: 5.5,              // patlama hasarı çarpanı, mermi hasarı çarpanı, yayaya çarpma hasarının başladığı hız (m/sn)
    burnAt: 0.25, burnRate: 9, boom: [6, 110],                 // can oranı bu altındaysa yanar (sn başına can), patlama [yarıçap, hasar]
    respawn: 30, wreck: 8, idleRespawn: 120,                   // yeniden doğuş (sn), enkaz süresi, boş bırakılınca (doğuştan uzakta) yenilenme
    atMul: 1.6, mass: 1, wade: 1.1, ramMul: 16, stepUp: 0.55,  // tanksavar (RPG / tank topu) çarpanı, kütle (araç itişmesi), boğulma derinliği, çarpma hasarı / (m/sn), tırmanılan basamak
  },
  // 12.178 TANK: paletli (yerinde döner, kaymaz, yavaş), kule bakışla döner (dengeli: gövde dönse de nişan kalır), ana top (patlayıcı, mermi düşüşü,
  // yavaş dolum) sürücüde; kule üstü makineli 2. koltukta (nişancı). Zırh: piyade mermisi hasarsız, el bombası / genel patlama az, tanksavar (RPG, tank topu) tam.
  tank: {
    name: 'Tank', hp: 1000, seats: 2, tracked: true,
    hl: 3.3, hw: 1.7, top: 1.75, clear: 0.42,
    wb: 5.0, tr: 2.6, wheelR: 0.36,
    maxF: 11, maxR: 5, accel: 5.5, brake: 9, roll: 2.2, drag: 0.004, slopeG: 0.6,   // slopeG: paletin yokuşta tutunması (yer çekimi bileşeni × bu)
    steerMax: 1, steerRate: 3, turn: 0.85, grip: 16, gripHand: 16,   // turn: paletli dönüş hızı (rad/sn, yerinde; hızla %35 azalır)
    slide: 0.85, climbK: 1.4,
    // koltuklar: 0 sürücü (gövde içi, görünmez; ana topu da kullanır), 1 nişancı (kule kapağı, belden yukarısı dışarıda; makineli)
    seat: [[1.95, -0.62, 0.75], [-0.35, 0.42, 2.15]], hidden: [true, false],
    blastMul: 0.3, bulletMul: 0, atMul: 1.25, ramMin: 2.5, ramMul: 40, mass: 4, wade: 1.6, stepUp: 0.8,
    burnAt: 0.2, burnRate: 14, boom: [8, 140],
    respawn: 45, wreck: 10, idleRespawn: 150,
    // kule: dikey eksen gövde merkezinden ileri tf (m), kule üstü / yükseklik; ana top: pivot yüksekliği, namlu boyu, açı sınırları, dönüş hızları
    turret: { f: -0.35, y0: 1.75, y1: 2.55, hw: 1.3, hl: 1.55, pivot: 2.18, len: 4.3, gunMin: -0.12, gunMax: 0.32, yawRate: 0.95, pitchRate: 0.6 },
    cannon: { reload: 4.5, speed: 150, grav: 9, dmg: 300, radius: 5.5, name: 'Tank topu' },
    mg: { seats: [1], name: 'Tank makinelisi', dmg: 24, rpm: 600, range: [60, 170], minMul: 0.6, hip: 0.012, tracer: '#ffd37a', sound: 'pkm', vmg: true },
  },
  // 12.179 HELİKOPTER (nakliye; helipadlerde doğar): pilot + iki yan kapı nişancısı (makineli, kapının yönünde ±78° yay) + kabinde yolcu (kendi silahı).
  // Arcade uçuş (öğrenilebilir): rotor pilot binince ~3 sn'de döner, kaldırma rotorla; W / S ileri / geri, A / D yana kayma, burun FAREYLE (bakış yaw'ı;
  // sınırlı hızla döner), Boşluk yüksel, C / Ctrl alçal, girdi yokken havada asılı kalır. Yükseklik sınırı yok (savaş alanı sınırı geçerli). Pilotsuz
  // rotor söner → düşer. Gövde / kuyruk / rotor ucu çarpışması hasar; sert iniş hasar; can bitince havada patlar, enkaz düşer.
  'heli-n': {
    name: 'Helikopter', hp: 600, seats: 4, heli: true,
    hl: 2.5, hw: 1.25, top: 2.7, clear: 0.55,
    wb: 3.0, tr: 2.4, wheelR: 0,                                   // kızak noktaları (iniş zemini / eğim)
    maxF: 46, maxB: 14, maxS: 16, climb: 9, descend: 7, acc: 9, vacc: 12, yawRate: 1.5, spinUp: 3.2, rotorR: 6.6, rotorY: 3.25, tailF: -7.6,
    maxR: 14, accel: 9, brake: 9, roll: 1, drag: 0.0012, steerMax: 1, steerRate: 3, grip: 6, gripHand: 6, slide: 0.9, climbK: 1,
    // koltuklar: 0 pilot (kokpit sağ ön), 1 sol kapı nişancısı, 2 sağ kapı nişancısı, 3 kabin yolcusu (arkaya bakar)
    seat: [[1.55, 0.42, 0.95], [-0.25, -0.95, 0.95], [-0.25, 0.95, 0.95], [-1.15, 0, 0.95]],
    blastMul: 1.2, bulletMul: 0.15, atMul: 1.6, ramMin: 6, ramMul: 16, mass: 2, wade: 1.3, stepUp: 0.6,
    hitSafe: 4.5, hitMul: 26, landSafe: 5, landMul: 60,             // çarpma / iniş: bu hızın üstü hasar (÷ kütle 2: 10 m/sn sert iniş ≈ 150, 30 m'den düşüş ≈ 750 → patlar)
    burnAt: 0.25, burnRate: 12, boom: [9, 150],
    respawn: 50, wreck: 12, idleRespawn: 150,
    parts: [[-0.32, 0.32, 1.55, 2.35, 2.4, 7.9]],                    // ek çarpışma / vuruş kutuları (yerel: x0, x1, y0, y1, z0, z1; z = geri): kuyruk kirişi
    mg: { seats: [1, 2], arc: { 1: -1, 2: 1 }, arcW: 1.36, name: 'Kapı makinelisi', dmg: 22, rpm: 700, range: [60, 170], minMul: 0.6, hip: 0.014, tracer: '#ffd37a', sound: 'pkm', vmg: true },
  },
};
VT['heli-s'] = VT['heli-n'];                                       // saldırı helikopteri ayrı model gelene dek aynı nakliye helikopteri

// koltuğun makinelisi (yoksa null): tank nişancısı, helikopter kapı nişancıları
export const mgAt = (def, seat) => (def?.mg && def.mg.seats.includes(seat) ? def.mg : null);

const STEP_UP = 0.55;           // teker zemini: bu kadar yukarıdaki kutu tepesine çıkılır (bordür, kütük, tabliye ağzı)
export const VEH_G = 15;         // yer çekimi (askerlerle aynı TUNE.gravity varsayılanı; araç his ayarı ayrı tutulur)
const _tmp = [], _q = [];

// ── yerel → dünya (Ry(yaw) · Rx(pitch) · Rz(roll)); yerel x = sağ, y = yukarı, z = −ileri ──
export function toWorld(v, f, r, u, out) {
  const x0 = r, y0 = u, z0 = -f;
  const cr = Math.cos(v.roll || 0), sr = Math.sin(v.roll || 0), cp = Math.cos(v.pitch || 0), sp = Math.sin(v.pitch || 0), cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
  const x1 = x0 * cr - y0 * sr, y1 = x0 * sr + y0 * cr, z1 = z0;
  const y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp, x2 = x1;
  out.x = v.x + x2 * cy + z2 * sy; out.y = v.y + y2; out.z = v.z - x2 * sy + z2 * cy;
  return out;
}
// dünya noktası → yerel yatay (f, r) — yalnız yaw (OBB testleri yatay düzlemde)
export function toLocal2(v, x, z) {
  const dx = x - v.x, dz = z - v.z, s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  return { f: -dx * s - dz * c, r: dx * c - dz * s };
}

// Teker zemini: arazi ile ref'in STEP_UP üstüne kadar olan kutu tepelerinin en yükseği
export function groundAt(world, x, z, ref, up = STEP_UP) {
  let h = world.heightAt(x, z);
  const list = world.query(x - 0.05, z - 0.05, x + 0.05, z + 0.05, _tmp);
  for (const c of list) {
    if (x <= c.min[0] || x >= c.max[0] || z <= c.min[2] || z >= c.max[2]) continue;
    const t = c.max[1];
    if (t > h && t <= ref + up) h = t;
  }
  return h;
}

export function makeVehicle(type, x, y, z, yaw) {
  const d = VT[type];
  return { type, def: d, x, y, z, yaw, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, steer: 0, air: false, thr: 0, brk: 0, sunk: false, hit: 0, land: 0, wl: [0, 0, 0, 0], tyaw: yaw, gp: 0, rpm: 0 };
}

// Dört teker zemini (sıra: ön sol, ön sağ, arka sol, arka sağ) → w[0..3]
function wheels(v, world, out, ref) {
  const d = v.def, s = Math.sin(v.yaw), c = Math.cos(v.yaw), fx = -s, fz = -c, rx = c, rz = -s;
  const hf = d.wb / 2, ht = d.tr / 2;
  let k = 0;
  for (const f of [hf, -hf]) for (const r of [-ht, ht]) {
    out[k++] = groundAt(world, v.x + fx * f + rx * r, v.z + fz * f + rz * r, ref, d.stepUp ?? STEP_UP);
  }
  return out;
}

// OBB (araç) ↔ AABB (kutu) yatay ayırma ekseni testi. Çakışıyorsa { nx, nz, d } (aracı kutudan çıkaran yön + girişim), yoksa null
export function obbBox(v, c, pad = 0) {
  const d = v.def, s = Math.sin(v.yaw), co = Math.cos(v.yaw);
  const ux = -s, uz = -co, wx = co, wz = -s, hl = d.hl + pad, hw = d.hw + pad;
  const ex = (c.max[0] - c.min[0]) / 2, ez = (c.max[2] - c.min[2]) / 2, bx = (c.min[0] + c.max[0]) / 2, bz = (c.min[2] + c.max[2]) / 2;
  const dx = bx - v.x, dz = bz - v.z;
  let best = 1e9, nx = 0, nz = 0, o;
  o = hl * Math.abs(ux) + hw * Math.abs(wx) + ex - Math.abs(dx); if (o <= 0) return null; if (o < best) { best = o; nx = dx > 0 ? -1 : 1; nz = 0; }
  o = hl * Math.abs(uz) + hw * Math.abs(wz) + ez - Math.abs(dz); if (o <= 0) return null; if (o < best) { best = o; nx = 0; nz = dz > 0 ? -1 : 1; }
  const du = dx * ux + dz * uz, dw = dx * wx + dz * wz;
  o = hl + ex * Math.abs(ux) + ez * Math.abs(uz) - Math.abs(du); if (o <= 0) return null; if (o < best) { best = o; const g = du > 0 ? -1 : 1; nx = ux * g; nz = uz * g; }
  o = hw + ex * Math.abs(wx) + ez * Math.abs(wz) - Math.abs(dw); if (o <= 0) return null; if (o < best) { best = o; const g = dw > 0 ? -1 : 1; nx = wx * g; nz = wz * g; }
  return { nx, nz, d: best };
}

// Bir adım. inp: { f: gaz (−1..1), r: direksiyon (−1..1), b: fren / el freni } ya da null (sürücüsüz: el freni çekili, motor kapalı)
export function stepVehicle(v, inp, dt, world) {
  const d = v.def, T = world;
  v.hit = 0; v.land = 0;
  if (!(dt > 1e-5)) return;                                       // çevrimdışı kare adımı 0 olabilir (bölme yok)
  if (d.heli) return stepHeli(v, inp, dt, world);
  const f = inp && !v.sunk ? Math.max(-1, Math.min(1, inp.f || 0)) : 0, rr = inp && !v.sunk ? Math.max(-1, Math.min(1, inp.r || 0)) : 0, hand = !inp || !!inp.b || v.sunk;
  v.thr = f; v.brk = hand ? 1 : 0;
  const s0 = Math.sin(v.yaw), c0 = Math.cos(v.yaw);
  let fx = -s0, fz = -c0, rx = c0, rz = -s0;
  let vF = v.vx * fx + v.vz * fz, vR = v.vx * rx + v.vz * rz;
  const w0 = wheels(v, T, _q, v.y + 0.05);
  const g0 = (w0[0] + w0[1] + w0[2] + w0[3]) / 4;
  const onG = !v.air;
  // direksiyon (havada da döner, etkisi yok). Paletli: steer = dönüş isteği (−1..1, yumuşatılmış)
  const want = d.tracked ? rr : rr * d.steerMax / (1 + Math.abs(vF) / 10);
  v.steer += Math.max(-d.steerRate * dt, Math.min(d.steerRate * dt, -want - v.steer));      // sağa (r > 0) dönüş = yaw azalır → steer negatif
  // kule + top (yalnız taretli araç): bakış yönüne sınırlı hızla döner (dünya ekseninde dengeli). Sürücüsüzken olduğu yerde kalır
  if (d.turret && inp && Number.isFinite(inp.yw)) {
    const tu = d.turret, dy = ((inp.yw - v.tyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    v.tyaw += Math.max(-tu.yawRate * dt, Math.min(tu.yawRate * dt, dy));
    if (v.tyaw > Math.PI) v.tyaw -= Math.PI * 2; else if (v.tyaw < -Math.PI) v.tyaw += Math.PI * 2;
    const wp = Math.max(tu.gunMin, Math.min(tu.gunMax, (inp.pt || 0) - v.pitch * Math.cos(v.tyaw - v.yaw)));      // gövde eğimi top açısından düşülür (sınırlar gövdeye göre)
    v.gp += Math.max(-tu.pitchRate * dt, Math.min(tu.pitchRate * dt, wp - v.gp));
  }
  if (onG) {
    const pitch = v.pitch, sp = Math.sin(pitch);
    // eğim: yer çekiminin ileri bileşeni (yokuş yukarı yavaşlatır); yan bileşeni tutunma söndürür
    vF -= VEH_G * sp * (d.slopeG ?? 1) * dt;
    vR -= VEH_G * Math.sin(v.roll) * dt * 0.6;
    // motor / geri vites / fren
    const up = Math.max(0, Math.tan(pitch) * Math.sign(vF || f || 1));          // yokuş yukarı gidiş: güç düşer (dik yokuşa çıkamaz)
    const pw = Math.max(0, 1 - Math.max(0, up - 0.5) * d.climbK);
    if (f > 0.05) {
      if (vF < -0.4) vF = Math.min(0, vF + d.brake * f * dt);
      else vF += d.accel * f * pw * Math.max(0, 1 - vF / d.maxF) * dt;
    } else if (f < -0.05) {
      if (vF > 0.4) vF = Math.max(0, vF + d.brake * f * dt);
      else vF += d.accel * 0.7 * f * pw * Math.max(0, 1 + vF / d.maxR) * dt;
    } else {
      const k = d.roll * dt; vF = Math.abs(vF) <= k ? 0 : vF - Math.sign(vF) * k;        // yuvarlanma direnci (boşta)
    }
    if (hand) { const k = (inp ? d.brake : d.brake * 0.6) * dt; vF = Math.abs(vF) <= k ? 0 : vF - Math.sign(vF) * k; }
    vF -= d.drag * vF * Math.abs(vF) * dt;
    // yan tutunma (el freninde az: kayma); çok dik yamaçta tutunma düşer
    const gx = ((w0[0] + w0[1]) - (w0[2] + w0[3])) / (2 * d.wb), gr = ((w0[1] + w0[3]) - (w0[0] + w0[2])) / (2 * d.tr), slope = Math.hypot(gx, gr);
    const grip = (hand && Math.abs(vF) > 3 ? d.gripHand : d.grip) * (slope > d.slide ? 0.35 : 1);
    vR *= Math.exp(-grip * dt);
    // dönüş: tekerli = v · tan(açı) / dingil · paletli = yerinde döner (hızla biraz azalır)
    if (d.tracked) v.yaw += v.steer * d.turn * (1 - 0.35 * Math.min(1, Math.abs(vF) / d.maxF)) * dt;
    else v.yaw += (vF * Math.tan(v.steer) / d.wb) * dt;
    // çok dik yamaç: aşağı kayma (eğim yönünün tersine)
    if (slope > d.slide) {
      const a = VEH_G * (slope - d.slide) * 1.4 * dt / slope;
      const dgx = fx * gx + rx * gr, dgz = fz * gx + rz * gr;      // dünya eğim vektörü (yukarı yönü)
      v.vx = fx * vF + rx * vR - dgx * a; v.vz = fz * vF + rz * vR - dgz * a;
    } else { v.vx = fx * vF + rx * vR; v.vz = fz * vF + rz * vR; }
  } else {
    v.vy -= VEH_G * dt;
    const sp = Math.hypot(v.vx, v.vz), k = 1 - d.drag * sp * dt;
    v.vx *= k; v.vz *= k;
  }
  // su: sürüklenme (derinlikle), derin suda boğulma
  const dep = submerged(T.terrain, v.x, v.y, v.z);                                 // 12.180 su yüzeyi (sim/swim.js); suyu olmayan haritada −1e9
  if (dep > 0.05) { const k = Math.exp(-dep * 1.3 * dt); v.vx *= k; v.vz *= k; if (dep > (d.wade ?? 1.1)) v.sunk = true; }      // gövde ortası 1,1 m su altında = motor (hava girişi) boğulur
  // yatay hareket + dik arazi duvarı
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  {
    const w1 = wheels(v, T, _tmp4, v.y + 0.05), mv = Math.hypot(v.x - ox, v.z - oz);
    let wall = false;
    for (let i = 0; i < 4; i++) if (w1[i] - w0[i] > Math.max(d.stepUp ?? STEP_UP, 1.5 * mv + 0.02) && w1[i] > v.y + 0.3) { wall = true; break; }
    if (wall) { v.x = ox; v.z = oz; const sp = Math.hypot(v.vx, v.vz); if (sp > v.hit) v.hit = sp; v.vx *= -0.15; v.vz *= -0.15; }
  }
  // kutu çarpışmaları (gövde: zemin + STEP_UP üstü ile tavan arası)
  for (let it = 0; it < 3; it++) {
    const list = T.query(v.x - 3, v.z - 3, v.x + 3, v.z + 3, _tmp2);
    let any = false;
    const lo = v.y + (d.stepUp ?? STEP_UP) + 0.02, hi = v.y + d.top + 0.3;
    for (const c of list) {
      if (c.max[1] <= lo || c.min[1] >= hi || c.nocar) continue;
      const m = obbBox(v, c);
      if (!m) continue;
      any = true;
      v.x += m.nx * (m.d + 0.002); v.z += m.nz * (m.d + 0.002);
      const vn = v.vx * m.nx + v.vz * m.nz;
      if (vn < 0) { v.vx -= m.nx * vn * 1.2; v.vz -= m.nz * vn * 1.2; v.vx *= 0.92; v.vz *= 0.92; if (-vn > v.hit) v.hit = -vn; }
    }
    if (!any) break;
  }
  const b = T.bounds;
  if (b) { v.x = Math.max(b.minX + 2, Math.min(b.maxX - 2, v.x)); v.z = Math.max(b.minZ + 2, Math.min(b.maxZ - 2, v.z)); }
  // dikey: zemin izleme / uçuş / iniş
  const w = wheels(v, T, _q, v.y + 0.05), g = (w[0] + w[1] + w[2] + w[3]) / 4;
  const sp = Math.hypot(v.vx, v.vz);
  if (!v.air) {
    const stick = 0.04 + sp * dt * 0.3;
    if (v.y - g > stick) v.air = true;                                                  // tepeden / rampadan çıkış: o anki dikey hızla uçar
    else { v.vy = Math.max(-10, Math.min(8, v.vy + ((g - v.y) / dt - v.vy) * 0.35)); v.y = g; }     // zeminin dikey hızı (yumuşatılmış: bordür sıçratmaz, rampa fırlatır)
  }
  if (v.air) {
    v.y += v.vy * dt;
    if (v.y <= g) { v.land = Math.max(0, -v.vy); v.y = g; v.vy = 0; v.air = false; }
  }
  // eğim / yatış: tekerlerden (havada yavaşça düzleşir)
  const tp = Math.atan2((w[0] + w[1]) / 2 - (w[2] + w[3]) / 2, d.wb), tr = Math.atan2((w[1] + w[3]) / 2 - (w[0] + w[2]) / 2, d.tr);
  const kk = v.air ? 1 - Math.exp(-1.5 * dt) : 1 - Math.exp(-14 * dt);
  v.pitch += ((v.air ? v.pitch * 0.98 : tp) - v.pitch) * kk;
  v.roll += ((v.air ? v.roll * 0.98 : tr) - v.roll) * kk;
  for (let i = 0; i < 4; i++) v.wl[i] = w[i];
  if (v.yaw > Math.PI) v.yaw -= Math.PI * 2; else if (v.yaw < -Math.PI) v.yaw += Math.PI * 2;
}
const _tmp2 = [], _tmp4 = [0, 0, 0, 0];

// ── 12.179 helikopter adımı ──
// inp: { f, r, u (yüksel), d (alçal), yw (burun hedefi = pilotun bakışı) } ya da null (pilot yok: rotor söner).
const _hp = { x: 0, y: 0, z: 0 };
function heliGround(v, T, d) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw), fx = -s, fz = -c, rx = c, rz = -s, hf = d.wb / 2, ht = d.tr / 2, w = v.wl;
  let k = 0, g = -1e9;
  for (const f of [hf, -hf]) for (const r of [-ht, ht]) { const h = groundAt(T, v.x + fx * f + rx * r, v.z + fz * f + rz * r, v.y + 0.25, 0.35); w[k++] = h; if (h > g) g = h; }
  return g;
}
function stepHeli(v, inp, dt, T) {
  const d = v.def, pilot = !!inp && !v.sunk;
  v.rpm = Math.max(0, Math.min(1, v.rpm + (pilot ? 1 : -0.7) * dt / d.spinUp));
  const lift = Math.max(0, Math.min(1, (v.rpm - 0.6) / 0.3));
  const f = pilot ? Math.max(-1, Math.min(1, inp.f || 0)) : 0, rr = pilot ? Math.max(-1, Math.min(1, inp.r || 0)) : 0, up = pilot ? (inp.u ? 1 : 0) - (inp.d ? 1 : 0) : 0;
  v.thr = Math.max(Math.abs(f), Math.abs(up)) * (up < 0 ? -1 : 1); v.brk = 0;
  const g0 = heliGround(v, T, d), onG = !v.air;
  // burun: pilotun bakışına (havada tam, yerde yavaş)
  if (pilot && lift > 0.3 && Number.isFinite(inp.yw)) { const dy = ((inp.yw - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, rate = d.yawRate * (onG ? 0.35 : 1) * lift; v.yaw += Math.max(-rate * dt, Math.min(rate * dt, dy)); v.steer = Math.max(-1, Math.min(1, dy * 2)); }
  else v.steer *= 0.9;
  const s0 = Math.sin(v.yaw), c0 = Math.cos(v.yaw), fx = -s0, fz = -c0, rx = c0, rz = -s0;
  let vF = v.vx * fx + v.vz * fz, vR = v.vx * rx + v.vz * rz;
  if (lift > 0 && !(onG && up <= 0)) {
    const tF = f > 0 ? f * d.maxF : f * d.maxB, tR = rr * d.maxS, a = d.acc * lift * dt;
    vF += Math.max(-a, Math.min(a, tF - vF)); vR += Math.max(-a * 1.3, Math.min(a * 1.3, tR - vR));
    const alt = v.y - g0, tY = up > 0 ? d.climb : up < 0 ? -Math.min(d.descend, 1.4 + alt * 0.7) : 0, va = d.vacc * dt;      // yere yaklaşınca alçalış kendiliğinden yavaşlar (yumuşak iniş ≤ 1,4 m/sn)
    v.vy += Math.max(-va, Math.min(va, tY - v.vy)) * lift - VEH_G * (1 - lift) * dt;
    v.air = true;
  } else if (onG) { vF *= Math.exp(-6 * dt); vR *= Math.exp(-6 * dt); v.vy = Math.min(0, v.vy); }
  else v.vy -= VEH_G * (1 - lift * 0.95) * dt;                     // rotor yavaş / pilot yok: düşer
  v.vx = fx * vF + rx * vR; v.vz = fz * vF + rz * vR;
  const sp = Math.hypot(v.vx, v.vz), dg = d.drag * sp * dt; v.vx *= 1 - dg; v.vz *= 1 - dg;
  if (v.vy < -40) v.vy = -40;
  // su: kızaklar suya değerse sürüklenme; gövde batarsa motor boğulur
  const dep = submerged(T.terrain, v.x, v.y, v.z);
  if (dep > 0.05) { const k = Math.exp(-dep * 2 * dt); v.vx *= k; v.vz *= k; if (dep > d.wade) v.sunk = true; }
  const ox = v.x, oy = v.y, oz = v.z;
  v.x += v.vx * dt; v.y += v.vy * dt; v.z += v.vz * dt;
  // gövde ↔ kutular (tüm yükseklik): itilir, çarpma hızı
  for (let it = 0; it < 3; it++) {
    const list = T.query(v.x - 3, v.z - 3, v.x + 3, v.z + 3, _tmp2);
    let any = false;
    const lo = v.y + d.clear + 0.05, hi = v.y + d.top;
    for (const c of list) {
      if (c.max[1] <= lo || c.min[1] >= hi || c.nocar) continue;
      const m = obbBox(v, c); if (!m) continue;
      any = true; v.x += m.nx * (m.d + 0.002); v.z += m.nz * (m.d + 0.002);
      const vn = v.vx * m.nx + v.vz * m.nz;
      if (vn < 0) { v.vx -= m.nx * vn * 1.3; v.vz -= m.nz * vn * 1.3; if (-vn > v.hit) v.hit = -vn; }
    }
    if (!any) break;
  }
  // rotor ucu + kuyruk ucu: kutuya ya da araziye değerse geri sekme + çarpma (rotor çarpması gövdeden sert)
  if (v.air) {
    const pts = [[0, d.rotorR, d.rotorY], [0, -d.rotorR, d.rotorY], [d.rotorR * 0.8, 0, d.rotorY], [-d.rotorR * 0.9, 0, d.rotorY], [d.tailF, 0, 2.1]];
    for (const [pf, pr, pu] of pts) {
      toWorld(v, pf, pr, pu, _hp);
      let hit = _hp.y < T.heightAt(_hp.x, _hp.z), hc = null;
      if (!hit) { const l = T.query(_hp.x - 0.1, _hp.z - 0.1, _hp.x + 0.1, _hp.z + 0.1, _tmp); for (const c of l) if (_hp.x > c.min[0] && _hp.x < c.max[0] && _hp.z > c.min[2] && _hp.z < c.max[2] && _hp.y > c.min[1] && _hp.y < c.max[1] && !c.nocar) { hit = true; hc = c; break; } }
      if (!hit) continue;
      const dx = _hp.x - v.x, dz = _hp.z - v.z, L = Math.hypot(dx, dz) || 1, vn = (v.vx * dx + v.vz * dz) / L;
      const imp = Math.max(Math.hypot(v.vx, v.vz, v.vy) * 0.6, 3);
      const tx = _hp.x + ox - v.x, tz = _hp.z + oz - v.z;
      v.x = ox; v.z = oz;
      v.vx -= (dx / L) * Math.max(0, vn) * 1.6; v.vz -= (dz / L) * Math.max(0, vn) * 1.6; v.vx *= 0.5; v.vz *= 0.5;
      if (!hc) { v.y = Math.max(oy, v.y); v.vy = Math.max(v.vy, 1); }       // arazi: yukarı sekme
      else if (tx > hc.min[0] && tx < hc.max[0] && tz > hc.min[2] && tz < hc.max[2]) {
        // 12.183 kutu (ağaç gövdesi, direk, duvar): uç geri alınan konumda da içerideyse yatayda en kısa yönden dışarı itilir; dikeyde TUTULMAZ.
        // Eskiden y tutulup vy ≥ 1 veriliyordu → pilotsuz düşen helikopter rotor ucuyla ağaç gövdesinin tepesine "asılı" kalıyor, havada sn'de ~50 can eriyordu
        const ex0 = tx - hc.min[0], ex1 = hc.max[0] - tx, ez0 = tz - hc.min[2], ez1 = hc.max[2] - tz, m = Math.min(ex0, ex1, ez0, ez1), k = m + 0.03;
        if (m === ex0) v.x -= k; else if (m === ex1) v.x += k; else if (m === ez0) v.z -= k; else v.z += k;
      }
      if (imp + 2 > v.hit) v.hit = imp + 2;
      break;
    }
  }
  const b = T.bounds;
  if (b) { v.x = Math.max(b.minX + 2, Math.min(b.maxX - 2, v.x)); v.z = Math.max(b.minZ + 2, Math.min(b.maxZ - 2, v.z)); }
  // zemin: kızaklar (arazi / çatı / heliped)
  const g = heliGround(v, T, d);
  if (v.y <= g) {
    const vin = -v.vy;
    if (v.air) { v.land = Math.max(0, vin) + Math.max(0, Math.hypot(v.vx, v.vz) - 9) * 0.5; }
    v.y = g; if (v.vy < 0) v.vy = 0;
    if (up <= 0 || lift < 0.9) { v.air = false; }
  } else if (!v.air && v.y > g + 0.3) v.air = true;
  if (!v.air) { v.y = g; v.vy = Math.max(0, v.vy); }
  // eğim / yatış: yerde kızaklardan, havada ivme / girdiden (burun ileri gidişte aşağı, yana kaymada yatar)
  const w = v.wl;
  const tp = !v.air ? Math.atan2((w[0] + w[1]) / 2 - (w[2] + w[3]) / 2, d.wb) : -f * 0.2 * lift - (vF / d.maxF) * 0.08;
  const tr = !v.air ? Math.atan2((w[1] + w[3]) / 2 - (w[0] + w[2]) / 2, d.tr) : -rr * 0.22 * lift - v.steer * 0.12;
  const kk = 1 - Math.exp(-4 * dt);
  v.pitch += (tp - v.pitch) * kk; v.roll += (tr - v.roll) * kk;
  if (v.yaw > Math.PI) v.yaw -= Math.PI * 2; else if (v.yaw < -Math.PI) v.yaw += Math.PI * 2;
}

// Duruyor mu (uyku): sürücüsüz, yerde, hızsız
export const vehicleAtRest = (v) => !v.air && Math.abs(v.vx) + Math.abs(v.vz) < 0.03 && Math.abs(v.vy) < 0.05 && !(v.rpm > 0);      // helikopter rotoru da durmalı

// Ağ / uzlaştırma için tam durum (kesinlik: 3 hane)
const q3 = (x) => Math.round(x * 1000) / 1000;
export function packVehState(v) { const a = [q3(v.x), q3(v.y), q3(v.z), q3(v.yaw), q3(v.pitch), q3(v.roll), q3(v.vx), q3(v.vy), q3(v.vz), q3(v.steer), v.air ? 1 : 0]; if (v.def.turret) a.push(q3(v.tyaw), q3(v.gp)); else if (v.def.heli) a.push(q3(v.rpm)); return a; }
export function applyVehState(v, a) { v.x = a[0]; v.y = a[1]; v.z = a[2]; v.yaw = a[3]; v.pitch = a[4]; v.roll = a[5]; v.vx = a[6]; v.vy = a[7]; v.vz = a[8]; v.steer = a[9]; v.air = !!a[10]; if (a.length > 12) { v.tyaw = a[11]; v.gp = a[12]; } else if (a.length > 11) v.rpm = a[11]; }

// 12.178 namlu ucu ve yönü (dünya): kule ekseni gövdede (tf ileri), kule yaw dünyada, top açısı kule eğimine eklenir
export function gunPose(v, outP, outD) {
  const tu = v.def.turret, c = toWorld(v, tu.f, 0, tu.pivot, { x: 0, y: 0, z: 0 });
  const ps = v.pitch * Math.cos(v.tyaw - v.yaw), pt = v.gp + ps, cp = Math.cos(pt);
  outD.x = -Math.sin(v.tyaw) * cp; outD.y = Math.sin(pt); outD.z = -Math.cos(v.tyaw) * cp;
  outP.x = c.x + outD.x * tu.len; outP.y = c.y + outD.y * tu.len; outP.z = c.z + outD.z * tu.len;
  return outP;
}

// Işın ↔ araç gövdesi (yönlü kutu: yaw + pitch + roll). Dönen t (yoksa −1) ve yerel normal ekseni
export function rayVehicle(v, o, dir, maxT, out) {
  const d = v.def;
  // ışını gövde yereline çevir (ters dönüş: Rz(−roll) · Rx(−pitch) · Ry(−yaw))
  const inv = (x, y, z, res) => {
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy, y1 = y;
    const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    const y2 = y1 * cp + z1 * sp, z2 = -y1 * sp + z1 * cp;
    const cr = Math.cos(v.roll), sr = Math.sin(v.roll);
    res[0] = x1 * cr + y2 * sr; res[1] = -x1 * sr + y2 * cr; res[2] = z2;
    return res;
  };
  const lo = inv(o.x - v.x, o.y - v.y, o.z - v.z, [0, 0, 0]), ld = inv(dir.x, dir.y, dir.z, [0, 0, 0]);
  const box = (mn, mx) => {
    let t0 = 0, t1 = maxT, ax = -1, sg = 0;
    for (let a = 0; a < 3; a++) {
      const iv = 1 / (ld[a] || 1e-9);
      let ta = (mn[a] - lo[a]) * iv, tb = (mx[a] - lo[a]) * iv, s = -1;
      if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
      if (ta > t0) { t0 = ta; ax = a; sg = s; }
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
    return t0 > 0 ? [t0, ax, sg] : null;
  };
  let h = box([-d.hw, d.clear, -d.hl], [d.hw, d.top, d.hl]);
  const tu = d.turret;
  if (tu) {                                                         // 12.179: kule kutusu kuleyle döner (ışın kule ekseninde kule açısı kadar geri döndürülür)
    const z = -tu.f, ry = (v.tyaw ?? v.yaw) - v.yaw, c = Math.cos(ry), s = Math.sin(ry);
    const sv = [lo[0], lo[1], lo[2]], sd = [ld[0], ld[1], ld[2]];
    const px = lo[0], pz = lo[2] - z; lo[0] = px * c - pz * s; lo[2] = px * s + pz * c + z;
    const dx = ld[0], dz = ld[2]; ld[0] = dx * c - dz * s; ld[2] = dx * s + dz * c;
    const k = box([-tu.hw, tu.y0, z - tu.hl], [tu.hw, tu.y1, z + tu.hl]); if (k && (!h || k[0] < h[0])) h = k;
    lo[0] = sv[0]; lo[2] = sv[2]; ld[0] = sd[0]; ld[2] = sd[2];
  }
  for (const P of d.parts || []) { const k = box([P[0], P[2], P[4]], [P[1], P[3], P[5]]); if (k && (!h || k[0] < h[0])) h = k; }      // ek parçalar (helikopter kuyruğu)
  if (!h) return -1;
  if (out) { out.ax = h[1]; out.sg = h[2]; }
  return h[0];
}
