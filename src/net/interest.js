// 12.203 İlgi alanı (interest management): kalabalık odada (toplam asker > IM_ALL) her istemciye uzak askerler daha seyrek yollanır.
// Yakın (≤ IM_NEAR m) her snapshot'ta (20 Hz), orta (≤ IM_MID m) 2'de bir (10 Hz), uzak 4'te bir (5 Hz). Faz askerin kimliğiyle kaydırılır:
// uzak askerler aynı snapshot'a yığılmaz (her snapshot'ta uzakların ~çeyreği). Ölüm / doğuş (a değişimi) hemen yollanır (server/room.js).
// İstemci (src/net/client.js) asker başına örnek tamponu tutar: seyrek gelen asker iki örneği arasında interpolasyonla, en çok aralık kadar ileri tahminle
// yerleşir (donma / sıçrama yok). Küçük odada (≤ 64 asker) herkes her snapshot'ta: paket eskisiyle aynı.
export const IM_ALL = 64, IM_NEAR = 160, IM_MID = 420;

// a: istemcinin bakış noktası (yaşıyorsa kendi askeri, ölüyse onu öldüren / ölüm yeri), s: aday asker, sn: snapshot sırası
export function interestTier(ax, az, s) {
  const dx = s.pos.x - ax, dz = s.pos.z - az, d2 = dx * dx + dz * dz;
  return d2 <= IM_NEAR * IM_NEAR ? 1 : d2 <= IM_MID * IM_MID ? 2 : 4;
}
// aim: nişan alan istemcinin bakış yönü { x, z } (birim) → bakış konisindeki (±14°) uzak asker de tam hızda (keskin nişancı dürbünü: geri sarılan
// vuruş kutusu ile ekrandaki asker aynı yerde)
export function interestWants(ax, az, s, sn, aim = null) {
  const k = interestTier(ax, az, s);
  if (k === 1 || (sn + s.id) % k === 0) return true;
  if (!aim) return false;
  const dx = s.pos.x - ax, dz = s.pos.z - az;
  return (dx * aim.x + dz * aim.z) > 0.97 * Math.hypot(dx, dz);
}
export const aimOf = (s) => (s.alive && s.ads ? { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) } : null);
// Ölçüm / test için: bu snapshot'ta `me`ye yollanacak askerlerin sırası (sunucunun kullandığı kural)
export function interestPick(soldiers, me, sn, focus = me?.pos) {
  if (soldiers.length <= IM_ALL || !focus) return soldiers.map((_, i) => i);
  const out = [];
  for (let i = 0; i < soldiers.length; i++) { const s = soldiers[i]; if (s === me || interestWants(focus.x, focus.z, s, sn)) out.push(i); }
  return out;
}
