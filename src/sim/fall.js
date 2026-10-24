// Düşme hasarı (saf mantık; DOM / THREE yok). Çevrimdışı oyun, sunucu ve istemci tahmini AYNI tabloyu kullanır (12.143).
//
// Ölçü: DÜŞÜŞ YÜKSEKLİĞİ = havadaki en yüksek nokta (zirve; zıplama dahil) − iniş noktası. World.move (collision.js) inişte s.landH'ye yazar;
// ışınlanma / sunucu düzeltmesi zirveyi bozarsa iniş hızı sınırlar (h ≤ v² / 2g + 0,6 m). Hasarı yalnız YETKİLİ taraf uygular (game.fallCheck).
// Eğri: safe m'ye kadar hasar yok; sonra hafif artan  hasar = lin·x + quad·x²  (x = h − safe); lethal m'de tam 100 can.
// Ölçülen haritalarda (scripts/fallmaps.mjs + falldmg.mjs) olağan inişler: Çöl Geçidi Suicide (T Spawn → Mid) yürüyerek 5,6 m, koşup zıplayarak 6,3 m;
// Short / Boost / Pit 5–5,8 m → eşik 6,5 m (bunlar hasarsız kalsın). Hasar Askeri Üs çatı / kulelerinde (10,7–11 m), Kasaba kulelerinde (8 m) başlar.
//   h (m):   6,5   7   8   9  10  11  12  13  14  15
//   hasar:     0   3  11  21  33  47  63  80 100 122   (100 canlı sınıf 14 m'de, 125 canlı Ağır Destek ~15,2 m'de ölür)
export const FALL = {
  safe: 6.5,        // m: bunun altı (dahil) hasarsız
  lethal: 14.0,     // m: 100 can
  lin: 6.0,         // can / m (eşiğin hemen üstü yumuşak)
};
FALL.quad = (100 - FALL.lin * (FALL.lethal - FALL.safe)) / (FALL.lethal - FALL.safe) ** 2;      // lethal'de tam 100 olacak kare katsayı (≈ 0,978)

// Yükseklik (m) → hasar (tam sayı can)
export function fallDamage(h) {
  const x = h - FALL.safe;
  if (!(x > 0)) return 0;
  return Math.round(FALL.lin * x + FALL.quad * x * x);
}

// İniş hızı (m/sn, pozitif aşağı) → eşdeğer düşüş yüksekliği
export const fallHeight = (v, g) => (v > 0 && g > 0 ? (v * v) / (2 * g) : 0);

// Bu savaşçı düşme hasarı alır mı (mod kuralı). Paintball: kaleden (9 m) atlamak oyunun parçası, kuyu zaten eler → yok.
// Enfekte: zombiler (çatıdan sıçrayan avcılar) almaz, insanlar alır.
// Uzay (12.157): düşük yer çekiminde düşme hasarı yok.
export const fallApplies = (s, mode) => !mode?.paintball && !mode?.space && !s.def?.zombie;
