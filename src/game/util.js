import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Konvansiyon: yaw=0 → −Z'ye bakar; yaw artışı sola döner (sağ-el kuralı, Y yukarı).
export function dirFromAngles(yaw, pitch, out = new THREE.Vector3()) {
  const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}
export const yawFromDir = (x, z) => Math.atan2(-x, -z);

// Nişan geçişi (görsel, 12.122): adsT doğrusal (oyun mantığı / sunucu aynı); model, FOV ve HUD bu eğriyi kullanır → girişte hızlı başlayıp yumuşak oturur (ease-out), çıkışta yavaş ayrılır (ease-in)
export const adsEase = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 2.2);
export const SCOPE_ON = 0.72;   // 12.153: dürbün örtüsünün açıldığı adsT (HUD kararması 0,3 → SCOPE_ON arasında tam siyaha çıkar; eski 0,9'da %70-85'te 3B göz merceği ekranı kaplıyordu)
export const ADS_HUD = 0.97;      // 12.127: HUD retikülü (#rdot / #holo / #idot) bu eğri değerinden sonra çıkar; 3B ışıyan halka / nokta (telefonda) aynı anda söner → retikülsüz kare yok
// 12.127: gerçek büyütme: dikey FOV = 2·atan(tan(taban/2) / z) (eski taban / z doğrusal bölmesi ×4'te %10+ sapıyordu, FOV ayarına bağlıydı)
export const zoomFov = (base, z) => (z > 1 ? (2 * Math.atan(Math.tan((base * Math.PI) / 360) / z) * 180) / Math.PI : base);
