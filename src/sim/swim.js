// Yüzme (12.180) — saf mantık (DOM / THREE yok). Çevrimdışı oyun, sunucu, istemci tahmini ve botlar AYNI kodu kullanır.
//
// Su kaynağı: arazinin isteğe bağlı `waterY(x, z)` işlevi → su yüzeyi kotu (m) ya da −Infinity (su yok). Bunu vermeyen harita eski kuralda kalır
// (derin suya yürünmez: terrain.deepWater). Yeni / yeniden yapılan harita (Vadi v2 vb.) yalnız `waterY` ekleyerek bu sistemi alır.
//
// Durum DURUMSUZDUR: her World.move adımında konumdan yeniden hesaplanır (s.wY, s.wDepth, s.swim, s.under) → sunucu ile istemci tahmini, uzlaştırmada
// yeniden oynatma ve uzak oyuncunun 3. şahıs pozu ek ağ alanı olmadan aynı sonucu verir. Tek durum nefes (s.air): HUD + boğulma; boğulma hasarını
// yalnız YETKİLİ taraf (çevrimdışı / sunucu) uygular (game.swimCheck), istemci yalnız göstergeyi / geri bildirimi tahmin eder.
//
// Araç arayüzü (araçlar için; bkz. OYUN.md 12.180): waterYAt(T, x, z) · submerged(T, x, y, z) (bir noktanın suya gömülme derinliği) · SWIM sabitleri.
// Araç derin suya girerse yolcunun inip yüzmesi için yalnız `s.vehicle = null` + konum vermek yeter; yüzme kuralı konumdan kendiliğinden başlar.
export const SWIM = {
  enter: 1.15,      // m: ayak suyun bu kadar altındaysa YÜZER (göğüs derinliği); daha sığda yürünür (yavaşlar)
  float: 1.40,      // m: yüzeyde dinlenme — ayak suyun 1,40 m altında → göz (1,62 m) suyun 0,22 m üstünde (baş dışarıda)
  speed: 2.3,       // m/sn: yüzeyde yüzme (yürüme 5,6)
  under: 2.0,       // m/sn: su altında yüzme
  backMul: 0.7,     // geri / yana yüzme çarpanı
  acc: 3.2,         // yatay ivme (1/sn): suda ağır, hantal
  vert: 2.0,        // m/sn: dalma (C / çömel basılı) ve çıkma (Space) isteği
  vacc: 6,          // dikey istek ivmesi (1/sn)
  buoy: 0.9,        // m/sn: kaldırma kuvveti — derindeyken yavaşça yüzeye çıkar
  buoyK: 2.2,       // dinlenme kotuna yaklaşma (1/sn)
  bacc: 1.5,        // kaldırma ivmesi (1/sn)
  entryDrag: 7,     // suya düşerken dikey hız sönümü (1/sn): köprüden atlayan dibe çakılmaz
  climb: 1.15,      // m: kıyı / kenar tutunma — suyun en çok bu kadar üstündeki kenara (arazi ya da kutu) tırmanılır
  wadeD: 0.45,      // m: bu derinlikten sonra yürüme yavaşlar (sığ su)
  wadeMul: 0.45,    // `enter` derinliğinde yürüme hız çarpanı (5,6 × 0,45 ≈ 2,5 → yüzme hızına yakın, geçişte sıçrama yok)
  breath: 18,       // sn: su altında nefes
  refill: 5,        // sn: boş nefesin yüzeyde dolma süresi
  drownDmg: 10,     // can: nefes bitince her drownT saniyede
  drownT: 1.0,
  eye: 1.62,        // göz yüksekliği (soldier.EYE_STAND; döngüsel içe aktarma olmasın diye kopya)
};

export const waterYAt = (T, x, z) => (T && T.waterY ? T.waterY(x, z) : -Infinity);
// bir noktanın su yüzeyinin ne kadar altında olduğu (m; ≤ 0 = suyun üstü / su yok) — araç, mermi, kamera
export const submerged = (T, x, y, z) => { const w = waterYAt(T, x, z); return w > -1e9 ? w - y : -1e9; };

// konumdan yüzme durumu (World.move her adımda çağırır; uzak oyuncunun pozu için de kullanılabilir)
export function swimState(s, T) {
  const p = s.pos, w = waterYAt(T, p.x, p.z);
  const d = w > -1e9 ? w - p.y : 0;
  s.wY = w; s.wDepth = d > 0 ? d : 0;
  s.swim = d > SWIM.enter && !s.fly;
  s.under = s.swim && w > p.y + (s.eyeY || SWIM.eye);
  return s.swim;
}

// sığ suda yürüme hız çarpanı (applyInput)
export function wadeMul(s) {
  const d = s.wDepth || 0;
  if (d <= SWIM.wadeD) return 1;
  const k = Math.min(1, (d - SWIM.wadeD) / (SWIM.enter - SWIM.wadeD));
  return 1 + (SWIM.wadeMul - 1) * k;
}

// Girdi → yüzme hareketi (applyInput s.swim iken bunu çağırır). input: { f, r, jump (Space: yukarı), dive (C basılı: aşağı) }
export function swimInput(s, input, dt) {
  const { f, r } = input;
  s.sprinting = false; s.crouching = false; s.prone = false; s.leanDir = 0;
  const pitch = s.pitch || 0;
  const followPitch = f !== 0 && (s.under || pitch < -0.6);                       // su altında bakış yönünde yüzülür; yüzeyde yalnız dik aşağı bakıp ileri giderken dalınır
  let spd = (s.under ? SWIM.under : SWIM.speed) * (s.spd || 1);
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  const fk = f < 0 ? SWIM.backMul : 1, rk = SWIM.backMul;
  let wx = fx * f * fk + rx * r * rk, wz = fz * f * fk + rz * r * rk;
  const wl = Math.hypot(wx, wz);
  const hk = followPitch ? Math.cos(pitch) : 1;
  if (wl > 0) { const m = Math.min(1, wl); wx = (wx / wl) * spd * m * hk; wz = (wz / wl) * spd * m * hk; }
  const a = 1 - Math.exp(-SWIM.acc * dt);
  s.vel.x += (wx - s.vel.x) * a;
  s.vel.z += (wz - s.vel.z) * a;
  // dikey istek: Space yukarı, C aşağı, su altında bakış yönü. Yüzeyde yukarı isteği ayağı `enter` derinliğinin üstüne çıkarmaz (sudan fırlayıp düşme / titreme yok)
  let vy = 0, want = false;
  if (input.dive) { vy -= SWIM.vert; want = true; }
  if (input.jump) { vy += SWIM.vert; want = true; }
  if (followPitch) { vy += Math.sin(pitch) * spd * Math.max(0, f); want = true; }
  if (want) {
    if (Number.isFinite(s.wY)) vy = Math.min(vy, (s.wY - SWIM.enter - 0.05 - s.pos.y) * 4);
    vy = Math.max(-SWIM.vert * 1.2, Math.min(SWIM.vert, vy));
    s.vel.y += (vy - s.vel.y) * (1 - Math.exp(-SWIM.vacc * dt));
  }
}

// Fizik (World.move, yerçekiminin yerine): kaldırma kuvveti + suya giriş sönümü + yatay hız sınırı (botlar hızı doğrudan yazar)
export function swimPhysics(s, dt) {
  const v = s.vel, rest = s.wY - SWIM.float;
  if (v.y < -SWIM.vert) v.y *= Math.exp(-SWIM.entryDrag * dt);                    // düşerek giriş: hızla söner
  const tgt = Math.max(-SWIM.vert, Math.min(SWIM.buoy, (rest - s.pos.y) * SWIM.buoyK));
  v.y += (tgt - v.y) * (1 - Math.exp(-SWIM.bacc * dt));
  const cap = SWIM.speed * 1.08 * (s.spd || 1), hl = Math.hypot(v.x, v.z);
  if (hl > cap) { const k = Math.min(cap * 1.6 / hl, Math.max(cap / hl, Math.exp(-5 * dt))); v.x *= k; v.z *= k; }      // yumuşak sönüm, en çok 1,6 × (hızı her adım yazan kod da suda koşamaz)
}

// Kenar tutunma: yüzer ve başı yüzeyde/yakınında iken ayaktan en çok bu kadar yüksek kenara çıkılabilir (m)
export function climbReach(s) {
  if (!s.swim || !Number.isFinite(s.wY) || s.pos.y < s.wY - SWIM.float - 0.45) return 0;
  return s.wY + SWIM.climb - s.pos.y;
}

// Nefes (sn) + boğulma: adım başına çağrılır. Dönen: bu adımda uygulanacak boğulma hasarı (0 = yok). s.air, s.drownT günceller.
export function breathTick(s, dt) {
  if (s.air === undefined) s.air = SWIM.breath;
  if (s.under) {
    s.air = Math.max(0, s.air - dt);
    if (s.air > 0) { s.drownAcc = 0; return 0; }
    s.drownAcc = (s.drownAcc || 0) + dt;
    if (s.drownAcc >= SWIM.drownT) { s.drownAcc -= SWIM.drownT; return SWIM.drownDmg; }
    return 0;
  }
  s.drownAcc = 0;
  s.air = Math.min(SWIM.breath, s.air + dt * SWIM.breath / SWIM.refill);
  return 0;
}

// Yüzerken silah: yüzeyde (baş dışarıda) yalnız tabanca (yan silah, belden; nişan yok), su altında hiçbiri. Bomba / yakın dövüş / ilk yardım / alet yok.
export const swimCanFire = (s, st) => !s.swim || (!s.under && st.kind === 'gun' && st.slot === 'secondary');
