# WarByte masaüstü (Electron) — ilk deneme sürümü

Amaç: Steam'e gitmeden önce oyunu masaüstü uygulaması olarak çalıştırıp **tarayıcıyla aynı ölçülerle** karşılaştırmak. Tarayıcı kareyi
ekran yenileme hızına kilitler (`requestAnimationFrame` + VSync): 144 Hz ekranda 144, 60 Hz ekranda 60 FPS görürsün, makinenin gerçek
payını göremezsin. Bu uygulama Chromium'u VSync'siz ve kare sınırı olmadan açar, F3 paneli gerçek kare / CPU / GPU sürelerini gösterir.

Ayrıntılı gerekçe: `OYUN.md` 12.230.

## Çalıştırma (geliştirme)

```bash
cd desktop
npm install                      # electron + @electron/packager yalnız bu klasöre (kök package.json'a eklenmez)
npm start                        # canlı site https://warbyte.io (hep güncel sürüm, aynı sunucular / odalar)
npm run start:local              # gömülü mod: ../dist (önce kökte npx vite build), oyun bağlantısı wss://ws.warbyte.io/ws
npm run start:vsync              # bu açılış için VSync açık (karşılaştırma)
npx electron . --local --query="autostart=5v5&map=colgecidi&type=tdm&nolock=1&perf=1"   # doğrudan botlu hızlı maç + panel
```

Seçenekler (komut satırı / ortam değişkeni):

| Seçenek | Ne yapar |
|---|---|
| `--local` / `WARBYTE_LOCAL=1` | Uygulamanın içindeki `dist/`'i `warbyte://app/` adresinden açar (internet yalnız oyun sunucusu için) |
| `--url=…` / `WARBYTE_URL=…` | Başka adres (örn. `http://127.0.0.1:5180/` yerel vite) |
| `--query="…"` | Adrese sorgu ekler (`autostart=…`, `perf=1` …) |
| `--vsync` / `--uncapped` / `WARBYTE_VSYNC=1` | Yalnız bu açılış için VSync açık / kapalı (kayıtlı ayarı değiştirmez) |

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
| `disable-frame-rate-limit` | `requestAnimationFrame` ekran yenilemesini beklemez → FPS ekran hızını aşabilir (yalnız VSync kapalıyken) |
| `disable-gpu-vsync` | GPU sunumu dikey eşitlemeyi beklemez (yalnız VSync kapalıyken; görüntüde yırtılma olabilir, ölçüm için) |
| `ignore-gpu-blocklist` | Sürücüsü kara listede olan makinede de donanım WebGL (yazılım çiziciye düşmesin, bkz. 12.222) |
| `enable-gpu-rasterization` | Sayfa (HUD / menü) çizimi de GPU'da |
| `force_high_performance_gpu` | İki GPU'lu dizüstünde güçlü olan (NVIDIA / AMD) seçilsin |
| `disable-renderer-backgrounding`, `disable-background-timer-throttling`, `disable-backgrounding-occluded-windows`, `backgroundThrottling: false` | Pencere arkada / örtülüyken oyun yavaşlatılmasın |

Diğer: menü çubuğu yok (macOS'ta yalnız üst çubukta en küçük uygulama menüsü: Cmd+Q, kopyala / yapıştır), pencere adı hep "WarByte",
dış bağlantılar sistem tarayıcısında açılır, işaretçi kilidi oyunun kendi isteğiyle (`unadjustedMovement: true` = ham fare girdisi, oyun
zaten istiyordu) çalışır.

## VSync aç / kapat

Ayar dosyası: Windows `%APPDATA%\WarByte\ayarlar.json`, macOS `~/Library/Application Support/WarByte/ayarlar.json` → `{ "uncapped": true }`
(varsayılan: sınırsız). Değiştirmenin yolları (hepsi onay sorup uygulamayı yeniden başlatır, çünkü anahtarlar Chromium açılırken uygulanır):
- **F9**
- F3 panelindeki **"VSync aç / kapat (yeniden başlat)"** düğmesi (fare kilitliyken Esc ile kilidi bırak, sonra tıkla)
- Tek açılışlık: `--vsync` / `--uncapped`

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

Yorum: **VSync açıkken** `FPS` ≈ ekran hızıysa makine yetişiyor demektir; payı görmek için `CPU` ve `GPU` ms'ye bak (ikisinden büyüğü
kare tavanını belirler: örn. GPU 2 ms → ~500 FPS'e kadar çizebilir). **VSync kapalıyken** `FPS` doğrudan tavanı gösterir.
"Raporu kopyala" (ya da Shift+F3) tüm sayıları JSON olarak panoya koyar: arkadaşın bunu bize yapıştırsın.
Betikler için: `window.__perf.stats` (canlı sayılar), `window.__perf.report()` (JSON özeti), `window.__perf.toggle()`.

Ölçüm betiği: `scripts/perfdesk.mjs` (`browser` · `browser-uncapped` · `desk` · `desk-vsync` · `desk-live` · `desk-lock`).
