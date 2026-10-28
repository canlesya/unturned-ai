// 12.199 yüzüstü bakış kuralı (Battlefield / PUBG): yatarken gövde yönü (s.pBody) bakışa anında dönmez. Bakış gövdeye göre ±PRONE_LOOK
// içinde serbest; sınır aşılınca gövde en çok PRONE_TURN hızıyla (sürünerek) döner, bakış sınırda kalır (birinci şahısta kamera gövdeyle ilerler).
// Saf mantık (DOM / THREE yok): çevrimdışı Player, istemci tahmini, sunucu (humanTick) ve botlar (Game.step) aynı fonksiyonu kullanır.
//
// Alanlar: s.pBody — gövde yönü (rad, sarılmamış: yaw ile aynı tur, ayakta = yaw) · s.pPend — yerel oyuncunun sınırı aşan bakış isteği
// (fare ileri itildi ama gövde henüz dönmedi: gövde sonraki adımlarda o yöne döner, kamera onunla gelir; en çok 180°)
export const PRONE_LOOK = (50 * Math.PI) / 180;          // bakış gövdeye göre en çok ±50° (12.199b: 70° fazla geldi)
export const PRONE_TURN = Math.PI / 2;                   // gövde dönüşü en çok 90°/sn
export const PRONE_PEND = Math.PI - PRONE_LOOK;           // bekleyen istek: gövdeye göre toplam en çok 180°
export const PRONE_PITCH = [-0.35, 0.6];                 // yatarken bakış: aşağı ~20°, yukarı ~34° (yere gömülmez / sırt üstü bakmaz)
const SV_TOL = 0.004;                                    // sunucu: yuvarlama payı (yw / pb 4 hane)

export const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pitchLim = (s) => { const k = clamp(s.proneT ?? 1, 0, 1); return [-1.5 + (PRONE_PITCH[0] + 1.5) * k, 1.5 + (PRONE_PITCH[1] - 1.5) * k]; };   // yatarken sınır yatma geçişiyle yumuşak daralır

export const proneActive = (s) => !!(s.prone && s.alive && !s.veh && !s.swim);
// vuruş kutusu / sırttan bıçak / yatış pozunun yönü: yüzüstünde gövde (pBody), değilse bakış. Geri sarma gölgesi (prone alanı yok) → yaw = kayıttaki gövde yönü
export const bodyYawOf = (e) => (e.prone && Number.isFinite(e.pBody) ? e.pBody : e.yaw);

// Yalnız sıkıştırma (gövde dönmez): fare / dokunmatik bakış olayında çağrılır → kamera adımlar arasında da sınırı aşmaz. pend: taşan kısım
// s.pPend'e eklenir (geri çekilen fare önce bekleyen isteği tüketir). prevYaw: olaydan önceki yaw (verilirse fark sarılmadan alınır →
// tek olayda 180°'den büyük hızlı savurma da doğru yönde birikir)
export function proneClamp(s, pend = true, prevYaw) {
  if (!proneActive(s) || !Number.isFinite(s.pBody)) return;
  const d = Number.isFinite(prevYaw) ? angDiff(prevYaw, s.pBody) + (s.yaw - prevYaw) : angDiff(s.yaw, s.pBody);
  const w = d + (pend ? s.pPend || 0 : 0), c = clamp(w, -PRONE_LOOK, PRONE_LOOK);
  s.yaw += c - d;
  s.pPend = pend ? clamp(w - c, -PRONE_PEND, PRONE_PEND) : 0;
  const [lo, hi] = pitchLim(s);
  s.pitch = clamp(s.pitch, lo, hi);
}

// Adım başına bir kez (girdi / bakış uygulandıktan, yatma tuşu işlendikten sonra, applyInput'tan önce).
//   o.pend: yerel oyuncu (bekleyen istek birikir) · o.pb: sunucu — istemcinin önerdiği gövde yönü (adım başına en çok 2×PRONE_TURN·dt kabul)
export function proneLook(s, dt, o = {}) {
  if (!proneActive(s)) { s.pBody = s.yaw; s.pPend = 0; return; }
  if (!Number.isFinite(s.pBody)) s.pBody = s.yaw;
  const step = PRONE_TURN * dt;
  if (Number.isFinite(o.pb)) {
    s.pBody += clamp(angDiff(o.pb, s.pBody), -2 * step - SV_TOL, 2 * step + SV_TOL);     // kaçan girdiden sonra yetişebilsin; hızlı dönme hilesi 2× ile sınırlı
    const d = angDiff(s.yaw, s.pBody), c = clamp(d, -PRONE_LOOK - SV_TOL, PRONE_LOOK + SV_TOL);
    s.yaw += c - d; s.pPend = 0;                                                           // d, yeni gövdeye göre ölçüldü
  } else {
    const d = angDiff(s.yaw, s.pBody);
    let w = d + (o.pend ? s.pPend || 0 : 0), t = 0;                                        // w: istenen bakış (gövdeye göre)
    if (Math.abs(w) > PRONE_LOOK) { t = clamp(w - Math.sign(w) * PRONE_LOOK, -step, step); s.pBody += t; w -= t; }
    const c = clamp(w, -PRONE_LOOK, PRONE_LOOK);
    s.yaw += t + c - d;                                                                    // yeni yaw = yeni gövde + c (sarılmadan: tur sayısı korunur)
    s.pPend = o.pend ? clamp(w - c, -PRONE_PEND, PRONE_PEND) : 0;
  }
  const [lo, hi] = pitchLim(s);
  s.pitch = clamp(s.pitch, lo, hi);
}
