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
  },
};

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
export function groundAt(world, x, z, ref) {
  let h = world.heightAt(x, z);
  const list = world.query(x - 0.05, z - 0.05, x + 0.05, z + 0.05, _tmp);
  for (const c of list) {
    if (x <= c.min[0] || x >= c.max[0] || z <= c.min[2] || z >= c.max[2]) continue;
    const t = c.max[1];
    if (t > h && t <= ref + STEP_UP) h = t;
  }
  return h;
}

export function makeVehicle(type, x, y, z, yaw) {
  const d = VT[type];
  return { type, def: d, x, y, z, yaw, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, steer: 0, air: false, thr: 0, brk: 0, sunk: false, hit: 0, land: 0, wl: [0, 0, 0, 0] };
}

// Dört teker zemini (sıra: ön sol, ön sağ, arka sol, arka sağ) → w[0..3]
function wheels(v, world, out, ref) {
  const d = v.def, s = Math.sin(v.yaw), c = Math.cos(v.yaw), fx = -s, fz = -c, rx = c, rz = -s;
  const hf = d.wb / 2, ht = d.tr / 2;
  let k = 0;
  for (const f of [hf, -hf]) for (const r of [-ht, ht]) {
    out[k++] = groundAt(world, v.x + fx * f + rx * r, v.z + fz * f + rz * r, ref);
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
  const f = inp && !v.sunk ? Math.max(-1, Math.min(1, inp.f || 0)) : 0, rr = inp && !v.sunk ? Math.max(-1, Math.min(1, inp.r || 0)) : 0, hand = !inp || !!inp.b || v.sunk;
  v.thr = f; v.brk = hand ? 1 : 0;
  const s0 = Math.sin(v.yaw), c0 = Math.cos(v.yaw);
  let fx = -s0, fz = -c0, rx = c0, rz = -s0;
  let vF = v.vx * fx + v.vz * fz, vR = v.vx * rx + v.vz * rz;
  const w0 = wheels(v, T, _q, v.y + 0.05);
  const g0 = (w0[0] + w0[1] + w0[2] + w0[3]) / 4;
  const onG = !v.air;
  // direksiyon (havada da döner, etkisi yok)
  const want = rr * d.steerMax / (1 + Math.abs(vF) / 10);
  v.steer += Math.max(-d.steerRate * dt, Math.min(d.steerRate * dt, -want - v.steer));      // sağa (r > 0) dönüş = yaw azalır → steer negatif
  if (onG) {
    const pitch = v.pitch, sp = Math.sin(pitch);
    // eğim: yer çekiminin ileri bileşeni (yokuş yukarı yavaşlatır); yan bileşeni tutunma söndürür
    vF -= VEH_G * sp * dt;
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
    // dönüş
    v.yaw += (vF * Math.tan(v.steer) / d.wb) * dt;
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
  if (dep > 0.05) { const k = Math.exp(-dep * 1.3 * dt); v.vx *= k; v.vz *= k; if (dep > 1.1) v.sunk = true; }      // gövde ortası 1,1 m su altında = motor (hava girişi) boğulur
  // yatay hareket + dik arazi duvarı
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  {
    const w1 = wheels(v, T, _tmp4, v.y + 0.05), mv = Math.hypot(v.x - ox, v.z - oz);
    let wall = false;
    for (let i = 0; i < 4; i++) if (w1[i] - w0[i] > Math.max(STEP_UP, 1.5 * mv + 0.02) && w1[i] > v.y + 0.3) { wall = true; break; }
    if (wall) { v.x = ox; v.z = oz; const sp = Math.hypot(v.vx, v.vz); if (sp > v.hit) v.hit = sp; v.vx *= -0.15; v.vz *= -0.15; }
  }
  // kutu çarpışmaları (gövde: zemin + STEP_UP üstü ile tavan arası)
  for (let it = 0; it < 3; it++) {
    const list = T.query(v.x - 3, v.z - 3, v.x + 3, v.z + 3, _tmp2);
    let any = false;
    const lo = v.y + STEP_UP + 0.02, hi = v.y + d.top + 0.3;
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

// Duruyor mu (uyku): sürücüsüz, yerde, hızsız
export const vehicleAtRest = (v) => !v.air && Math.abs(v.vx) + Math.abs(v.vz) < 0.03 && Math.abs(v.vy) < 0.05;

// Ağ / uzlaştırma için tam durum (kesinlik: 3 hane)
const q3 = (x) => Math.round(x * 1000) / 1000;
export function packVehState(v) { return [q3(v.x), q3(v.y), q3(v.z), q3(v.yaw), q3(v.pitch), q3(v.roll), q3(v.vx), q3(v.vy), q3(v.vz), q3(v.steer), v.air ? 1 : 0]; }
export function applyVehState(v, a) { v.x = a[0]; v.y = a[1]; v.z = a[2]; v.yaw = a[3]; v.pitch = a[4]; v.roll = a[5]; v.vx = a[6]; v.vy = a[7]; v.vz = a[8]; v.steer = a[9]; v.air = !!a[10]; }

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
  const mn = [-d.hw, d.clear, -d.hl], mx = [d.hw, d.top, d.hl];
  let t0 = 0, t1 = maxT, ax = -1, sg = 0;
  for (let a = 0; a < 3; a++) {
    const iv = 1 / (ld[a] || 1e-9);
    let ta = (mn[a] - lo[a]) * iv, tb = (mx[a] - lo[a]) * iv, s = -1;
    if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
    if (ta > t0) { t0 = ta; ax = a; sg = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  if (out) { out.ax = ax; out.sg = sg; }
  return t0 > 0 ? t0 : -1;
}
