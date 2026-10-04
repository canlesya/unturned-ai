# WarByte — Çalışma Haritası (taslak, birlikte kararlaştırılacak)

Durum: denge güncellemesi yapıldı ve canlıda (bkz. OYUN.md 12.22). Aşağıdaki sıra **öneridir**; sıra, kapsam ve soruları birlikte netleştiriyoruz.

## Mevcut durum (bilerek not)
- Modlar: **Ele Geçirme (bayrak)**, **Takım Çatışması (TDM)**, **Ölüm Maçı (DM, herkes tek)** zaten var (`src/game/match.js`). TDM yeni bir mod değil; cilalanacak.
- Haritalar: Kasaba, Üs (askeri), Vadi, Geliştirici haritası.
- Altyapı: yetkili Node sunucu, odalar, botlar, araçlar, kayıtlı sınıf ayarları, tuş atama.

## Mod yol haritası

| Sıra | Mod | Ana iş | Tahmini boyut | Bağımlılık |
|---|---|---|---|---|
| 1 | **Takım Ölüm Maçı (TDM) cilası** | Menüde ve skor tablosunda doğru anlat, bot davranışı (hedefsiz roam), doğma güvenliği, 3 haritada test | S | yok |
| 2 | **Tepe Hakimiyeti (KOTH)** | Tek bayrak; bölgede kalan takım puan toplar; bayrak belirli aralıkla yer değiştirir. Conquest bayrak kodunu yeniden kullanır | S–M | harita başına "tepe noktaları" listesi |
| 3 | **Silah Oyunu (Gun Game)** | Her öldürmede sonraki silaha geç (≈15 basamak), bıçak öldürmesi rakibi geriletir, ilk son basamak kazanır; herkes tek (ffa) altyapısı | M | yok (DM altyapısı) |
| 4 | **Bayrak Kapma (CTF)** | Üslerde bayrak, taşıyıcı yavaşlar/silah sınırı, düşürme/geri alma, teslim = skor; botlar bayrak taşır/savunur | L | bot hedef mantığı, araç kuralı, HUD |
| 5 | **Enfekte (zombi)** | Rastgele 1 enfekte; enfektelerin bıçak/hız/yüksek can, insanlar silahlı; ölen insan enfekte olur. Enfekte botu ve ayrı sınıf | L | yeni sınıf, bot AI, round döngüsü |

Boyut: S ≈ yarım gün, M ≈ 1–2 gün, L ≈ 3+ gün (sunucu + istemci + bot + HUD + menü + test + belge dahil).

Her mod için ortak iş (bir kez yapılır, sonra hepsi kullanır):
1. Mod seçimi tek tabloda (`MATCH_TYPES`) — menü, oda oluşturma, sunucu doğrulaması (`server/room.js`) ve oda listesi aynı kayıttan okusun.
2. Mod kuralları `Game.updateMode` içinden ayrı küçük sınıflara (mod nesnesi) bölünsün: `onKill`, `onTick`, `winner`, `hud()`; ayrı dosyalarda.
3. Her mod için: bot davranışı, doğma kuralı, HUD satırı, bitiş ekranı, odalar listesinde etiket, `roomsim`/`combattest` benzeri test.

## Harita yol haritası (mod yol haritasına göre sıralı)

| Mod | En uygun harita | Not |
|---|---|---|
| TDM, KOTH | mevcut 3 harita | KOTH için her haritada 3–4 tepe noktası işaretle |
| Gun Game | **küçük CQB arenası (yeni)** | 1v1 – 6 kişi, kısa, dar; yeni harita yapmaya değer |
| CTF | mevcut Üs haritası + **havaalanı (sonra)** | iki net üs gerekir; Üs haritasında iki uç üs var |
| Enfekte | **Kasaba** (zaten ev/sokak var) | kapalı mekân ve geçitler uygun; büyük açık harita zayıf |

Önerilen yeni harita sırası: 1) küçük CQB arenası (depo), 2) liman, 3) havaalanı. Kar karakolu, çöl rafinerisi ve gece şehir daha sonra.

## Paralel iyileştirmeler (küçük, her adımda araya girer)
- Çevrimiçi maçlarda **izleyici/ölü kamerası** (Eleme ve Enfekte için de gerekli olacak).
- **Ses/müzik dosyaları**: lobi ve maç müziği altyapısı hazır, dosyalar bekliyor.
- **Gerçek maç denge ölçümü**: sunucu tarafında silah başına öldürme/ölüm sayacı (denge kararlarını veriyle vermek için).
- Bot zorluk ayarlarını 1v1 için ince ayar.

## Birlikte kararlaştıracağımız sorular
1. Sıra böyle mi kalsın, yoksa CTF'yi öne mi alalım (araçlar zaten var, en "WarByte" modu olabilir)?
2. Gun Game için silah basamakları: rastgele mi sabit sıra mı? Sınıf seçimi var mı?
3. Enfekte için insanlar tek can mı, enfekte olanlar yeniden doğar mı? Round süresi?
4. Her modun çevrimiçi **resmi odası** olsun mu (şu an resmi odalar `server/official.js` içinde)?
5. İlk yeni harita: CQB arenası mı liman mı?
6. Mod ve harita eklerken TDM'in "bilet" mantığı korunsun mu, yoksa tüm modlar skor tabanlı mı olsun?
