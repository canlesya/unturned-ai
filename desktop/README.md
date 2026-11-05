# WarByte masaüstü (Electron) — ilk deneme sürümü

Amaç: Steam'e gitmeden önce oyunu masaüstü uygulaması olarak çalıştırıp **tarayıcıyla aynı ölçülerle** karşılaştırmak. Tarayıcı kareyi
ekran yenileme hızına kilitler (`requestAnimationFrame` + VSync): 144 Hz ekranda 144, 60 Hz ekranda 60 FPS görürsün, makinenin gerçek
payını göremezsin. F3 paneli gerçek kare / CPU / GPU sürelerini gösterir. **12.232'den beri varsayılan VSync açık** (ekran hızı); FPS sınırı
F9 ile seçilir: Ekran hızı (VSync, önerilen) / 60 / 144 / 240 / Sınırsız (uyarılı). İlk sürümün varsayılanı "sınırsız"dı: menü donuyor,
yürürken görüntü titriyor, GPU %100 çalışıp fan dönüyordu.

Ayrıntılı gerekçe: `OYUN.md` 12.230, 12.232.

## Çalıştırma (geliştirme)

```bash
cd desktop
npm install                      # electron + @electron/packager yalnız bu klasöre (kök package.json'a eklenmez)
npm start                        # canlı site https://warbyte.io (hep güncel sürüm, aynı sunucular / odalar)
npm run start:local              # gömülü mod: ../dist (önce kökte npx vite build), oyun bağlantısı wss://ws.warbyte.io/ws
npm run start:vsync              # bu açılış için VSync açık (varsayılan zaten VSync)
npx electron . --local --query="autostart=5v5&map=colgecidi&type=tdm&nolock=1&perf=1"   # doğrudan botlu hızlı maç + panel
```

Seçenekler (komut satırı / ortam değişkeni):

| Seçenek | Ne yapar |
|---|---|
| `--local` / `WARBYTE_LOCAL=1` | Uygulamanın içindeki `dist/`'i `warbyte://app/` adresinden açar (internet yalnız oyun sunucusu için) |
| `--url=…` / `WARBYTE_URL=…` | Başka adres (örn. `http://127.0.0.1:5180/` yerel vite) |
| `--query="…"` | Adrese sorgu ekler (`autostart=…`, `perf=1` …) |
| `--fps=vsync\|60\|144\|240\|uncapped` | Yalnız bu açılış için FPS ayarı (kayıtlı ayarı değiştirmez) |
| `--vsync` / `--uncapped` / `WARBYTE_VSYNC=1` | Kısa yol: `--fps=vsync` / `--fps=uncapped` |
| `--inactive` | Test: pencere odak çalmaz, Dock simgesi yok; örtülü pencere gizli sayılmaz (ölçüm yapılabilsin; `--occlusion` ile sayılır) |
| `--data=…` / `WARBYTE_DATA=…` | Test: ayrı kullanıcı verisi klasörü (gerçek ayarlara / localStorage'a dokunmaz) |

## Paketleme

```bash
cd desktop
npm run pack                     # = node build.mjs win mac  (önce kökte vite build yapar; SKIP_WEB=1 atlar)
```

Çıktılar `desktop/out/` (git'e girmez):
- `WarByte-win32-x64.zip` — **kurulumsuz**. Zip'i bir klasöre çıkar, `WarByte-win32-x64\WarByte.exe`'yi çalıştır. İmzasız olduğu için
  Windows SmartScreen "Windows bilgisayarınızı korudu" diyebilir: **Ek bilgi → Yine de çalıştır**.
- `WarByte-darwin-arm64.zip` / `WarByte-darwin-arm64/WarByte.app` — Apple Silicon (M1–M4). Apple imzası yok, geçici (ad-hoc) imzalı.
  Kendi makinede derleyince doğrudan açılır. İndirilen kopyada macOS "hasarlı / açılamıyor" der: Finder'da **sağ tık → Aç**, olmazsa
  `xattr -cr /Applications/WarByte.app`.

Windows paketi macOS'tan çıkar (wine gerekmez): `@electron/packager` exe simgesi / sürüm bilgisini `resedit` (saf JS) ile yazar.
Simge: `build/icon.png|ico|icns` (`python3 build/make-icon.py` ile üretildi).

## Chromium anahtarları ve nedenleri

| Anahtar | Neden |
|---|---|
| `disable-frame-rate-limit` | `requestAnimationFrame` ekran yenilemesini beklemez → FPS ekran hızını aşabilir (yalnız Sınırsız ya da ekran hızından yüksek sınırda) |
| `disable-gpu-vsync` | GPU sunumu dikey eşitlemeyi beklemez (aynı durumda; yırtılma, düzensiz kare temposu) |
| `ignore-gpu-blocklist` | Sürücüsü kara listede olan makinede de donanım WebGL (yazılım çiziciye düşmesin, bkz. 12.222) |
| `enable-gpu-rasterization` | Sayfa (HUD / menü) çizimi de GPU'da |
| `force_high_performance_gpu` | İki GPU'lu dizüstünde güçlü olan (NVIDIA / AMD) seçilsin |
| `disable-background-timer-throttling` | Gizli pencerede zamanlayıcı kısılmasın: çevrim içi maçta sim + ağ 10 Hz sürer (çizim durur) |

12.232'de kaldırılanlar: `disable-renderer-backgrounding`, `disable-backgrounding-occluded-windows` (yalnız `--inactive` test kipinde),
`backgroundThrottling: false` — arkadaki / simge durumundaki pencere de tam hız çiziyordu (menüde 2 saat açık kalınca GPU süreci %137 CPU).

Diğer: menü çubuğu yok (macOS'ta yalnız üst çubukta en küçük uygulama menüsü: Cmd+Q, kopyala / yapıştır), pencere adı hep "WarByte",
dış bağlantılar sistem tarayıcısında açılır, işaretçi kilidi oyunun kendi isteğiyle (`unadjustedMovement: true` = ham fare girdisi, oyun
zaten istiyordu) çalışır.

## FPS sınırı (12.232)

Ayar dosyası: Windows `%APPDATA%\WarByte\ayarlar.json`, macOS `~/Library/Application Support/WarByte/ayarlar.json` →
`{ "v": 2, "fps": "vsync", "hz": 120 }` (`hz`: son ölçülen ekran hızı). Eski `{ "uncapped": … }` dosyası ilk açılışta VSync'e taşınır.

| Seçenek | Nasıl çalışır |
|---|---|
| **Ekran hızı (VSync)** — varsayılan | Kare ekran yenilemesine kilitli: en düzgün akış, en az ısı |
| 60 / 144 / 240 | Ekran hızından düşükse VSync açık + oyun döngüsü sınırlar (120 Hz'de 60 = her ikinci kare, kare aralığı sd ≈ 1 ms). Yüksekse VSync kapanır, döngü zamanlayıcıyla sınırlar (144: sd 0,7 ms, 240: 239 FPS sd 0,9 ms) |
| Sınırsız (önerilmez, uyarı sorar) | VSync yok, sınır yok: GPU %100, düzensiz sunum. Pilde kendiliğinden ekran hızına sınırlanır |

Değiştirmek: **F9** (her yerde, menüde de) ya da F3 panelindeki **"FPS sınırı… (F9)"**. VSync anahtarı değişecekse onay sorup yeniden başlatır,
değişmeyecekse (ör. VSync ↔ 60) hemen uygulanır. Her seçimde: menü / duraklatma / maç sonu / odaksız pencere 30 FPS (menü odaksızken 10),
simge durumu / gizli pencere çizim yok.

Diğer tuşlar: **F11** tam ekran (macOS'ta Ctrl+Cmd+F de), **F3** performans paneli, **Shift+F3** raporu panoya kopyala,
**F5 / Ctrl+R** yenile, **F12 / Ctrl+Shift+I** geliştirici araçları.

## Performans paneli (F3) nasıl okunur

Tarayıcıda da çalışır: `?perf=1` ile açılır, F3 ile aç / kapat (tercih hatırlanır), `?perf=0` kapatır. Maç içindedir (menüde yok).

| Satır | Anlamı |
|---|---|
| `Masaüstü 0.1.0 · VSync kapalı (sınırsız)` / `Tarayıcı · VSync açık` | Nerede çalıştığı. Tarayıcıda FPS hep ekran hızına kilitli |
| `FPS` · `ort` | Son 1 sn'nin kare hızı · son 5 sn'nin ortalama kare süresi |
| `1% düşük` | Son 5 sn'nin en kötü %1 karesinin ortalaması (FPS ve ms). Takılma hissini en iyi bu gösterir |
| `en uzun` | Son 5 sn'nin en uzun karesi (takılma, ms) |
| `CPU (güncelle+çiz)` | Bizim döngünün işi: oyun güncellemesi + çizim komutlarını hazırlamak (ana iş parçacığı, ms) |
| `GPU` | GPU'nun bu kareyi çizme süresi (`EXT_disjoint_timer_query_webgl2`). Tarayıcı / sürücü vermiyorsa "—" |
| `çizim · üçgen · doku · program` | Kare başına draw call (gölge + sahne + silah + son işleme), üçgen, bellekteki doku ve gölgelendirici sayısı |
| `yığın` | JS belleği (yalnız Chromium tabanlı) |
| `piksel oranı (otomatik)` · `1440×810` | Çizim çözünürlüğü çarpanı (uyarlanabilir çözünürlük açıksa kendisi ayarlar) ve gerçek çizim tamponu |
| `GPU …` | WebGL'in kullandığı ekran kartı (yazılım çizici görünürse donanım hızlandırma kapalıdır) |
| `tempo …` · `ekran … Hz` | O anki kare hedefi (sınır yok / FPS sınırı / boşta 30; pil + sınırsız: ekran hızı) ve ekran yenileme hızı |

Yorum: **VSync açıkken** `FPS` ≈ ekran hızıysa makine yetişiyor demektir; payı görmek için `CPU` ve `GPU` ms'ye bak (ikisinden büyüğü
kare tavanını belirler: örn. GPU 2 ms → ~500 FPS'e kadar çizebilir). **VSync kapalıyken** `FPS` doğrudan tavanı gösterir.
"Raporu kopyala" (ya da Shift+F3) tüm sayıları JSON olarak panoya koyar: arkadaşın bunu bize yapıştırsın.
Betikler için: `window.__perf.stats` (canlı sayılar), `window.__perf.report()` (JSON özeti), `window.__perf.toggle()`.

Ölçüm betikleri: `scripts/perfdesk.mjs` (`browser` · `browser-uncapped` · `desk` · `desk-vsync` · `desk-live` · `desk-lock`),
`scripts/pacedesk.mjs` (12.232: `menu` / `match`, `FPS=…`, `MIN=1`, `OLD=1`; süreç CPU'su + kare aralığı sd / p99 / en uzun).
