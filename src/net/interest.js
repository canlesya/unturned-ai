// 12.203 İlgi alanı (interest management): kalabalık odada (toplam asker > IM_ALL) her istemciye uzak askerler daha seyrek yollanır.
// Düşman yakında (≤ IM_NEAR m) ya da herhangi bir asker çok yakında (≤ IM_MATE m) her snapshot'ta (20 Hz); orta (≤ IM_MID m) ve uzaktaki takım arkadaşı
// 2'de bir (10 Hz: gösterim gecikmesi ≥ 100 ms = 6 adım, iki örnek hep arada → görünür fark yok; takım arkadaşına isabet / geri sarma yok), uzak 4'te bir
// (5 Hz). Faz askerin kimliğiyle kaydırılır:
// uzak askerler aynı snapshot'a yığılmaz (her snapshot'ta uzakların ~çeyreği). Ölüm / doğuş (a değişimi) hemen yollanır (server/room.js).
// İstemci (src/net/client.js) asker başına örnek tamponu tutar: seyrek gelen asker iki örneği arasında interpolasyonla, en çok aralık kadar ileri tahminle
// yerleşir (donma / sıçrama yok). Küçük odada (≤ 64 asker) herkes her snapshot'ta: paket eskisiyle aynı.
// 12.211 IM_NEAR 160 → 125 m (bot görüşü 175 m; 125–420 m düşman 10 Hz, nişan konisindeki 20 Hz kalır), bant ~%20 az
export const IM_ALL = 64, IM_NEAR = 125, IM_MID = 420, IM_MATE = 50;

// a: istemcinin bakış noktası (yaşıyorsa kendi askeri, ölüyse onu öldüren / ölüm yeri), s: aday asker, sn: snapshot sırası
// team: istemcinin takımı (verilmezse herkes düşman sayılır)
// 12.211 katmanlar (128v128'de snapshot başına ~115 → ~70 asker): ≤ 50 m herkes ve ≤ 125 m düşman 20 Hz · ≤ 260 m düşman / ≤ 150 m takım
// arkadaşı 10 Hz · ötesi 5 Hz. Araçtaki asker yakında değilse 5 Hz (konumu araçtan: istemci koltuğa oturtur; yalnız bakış yönü seyrek).
export const IM_FOE2 = 260, IM_MATE2 = 150;
export function interestTier(ax, az, s, team = null) {
  const dx = s.pos.x - ax, dz = s.pos.z - az, d2 = dx * dx + dz * dz;
  if (d2 <= IM_MATE * IM_MATE) return 1;
  if (s.team !== team) { if (d2 <= IM_NEAR * IM_NEAR) return 1; return !s.veh && d2 <= IM_FOE2 * IM_FOE2 ? 2 : 4; }
  return !s.veh && d2 <= IM_MATE2 * IM_MATE2 ? 2 : 4;
}
// 12.211 20 Hz katmanı mı (yakın düşman / çok yakın herkes)
export function interestNear(ax, az, s, team = null) { return interestTier(ax, az, s, team) === 1; }
// aim: nişan alan istemcinin bakış yönü { x, z } (birim) → bakış konisindeki (±14°) uzak asker de tam hızda (keskin nişancı dürbünü: geri sarılan
// vuruş kutusu ile ekrandaki asker aynı yerde)
export function interestWants(ax, az, s, sn, aim = null, team = null) {
  const k = interestTier(ax, az, s, team);
  if (k === 1 || (sn + s.id) % k === 0) return true;
  if (!aim || s.team === team) return false;
  const dx = s.pos.x - ax, dz = s.pos.z - az;
  return (dx * aim.x + dz * aim.z) > 0.97 * Math.hypot(dx, dz);
}
export const aimOf = (s) => (s.alive && s.ads ? { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) } : null);
// Ölçüm / test için: bu snapshot'ta `me`ye yollanacak askerlerin sırası (sunucunun kullandığı kural)
export function interestPick(soldiers, me, sn, focus = me?.pos) {
  if (soldiers.length <= IM_ALL || !focus) return soldiers.map((_, i) => i);
  const out = [];
  for (let i = 0; i < soldiers.length; i++) { const s = soldiers[i]; if (s === me || interestWants(focus.x, focus.z, s, sn, null, me?.team)) out.push(i); }
  return out;
}
