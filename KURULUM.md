# WarByte — Kurulum ve Çalıştırma

WarByte tarayıcıda çalışan, Three.js ile yazılmış bir takım FPS oyunudur. Sunucu, veritabanı ya da indirilecek
görsel/ses dosyası yoktur: tüm modeller ve sesler kodla üretilir. Kurulum için **Node.js** yeterlidir.

> Oyunun nasıl yapıldığı ve geliştirme için bkz. [`OYUN.md`](OYUN.md).

---

## 1. Gereksinimler

| Gereksinim | Sürüm | Not |
|---|---|---|
| Node.js | **20.19+ veya 22.12+** | Vite 8 bunu ister. `node --version` ile kontrol et. |
| npm | Node ile gelir | |
| Git | herhangi | Sadece projeyi indirmek için |
| Tarayıcı | güncel Chrome / Edge / Firefox | WebGL 2 gerekir. En iyi sonuç Chrome / Edge ile. |

Node'u https://nodejs.org adresinden (LTS) kurabilirsin.

---

## 2. İndirme

```bash
git clone https://github.com/canlesya/unturned-ai.git
cd unturned-ai
git checkout claude/upbeat-lovelace-cwmwx4     # güncel geliştirme dalı
```

> Güncel kod şu an `claude/upbeat-lovelace-cwmwx4` dalındadır; `main` dalına birleştirilmediyse
> yukarıdaki `checkout` adımını atlama.

---

## 3. Geliştirme modunda çalıştırma (önerilen)

```bash
npm install        # ilk seferde bir kez
npm run dev
```

Terminalde şuna benzer bir adres yazar: `http://localhost:5173`. Tarayıcıda aç. Menüden **Hızlı Oyun** ya da
**Özel Oyun** ile başla.

- Kodu değiştirince sayfa kendiliğinden yenilenir (HMR).
- Durdurmak için terminalde `Ctrl + C`.
- Port doluysa Vite kendisi başka bir port seçer; terminaldeki adresi kullan.
- Aynı ağdaki başka bir cihazdan denemek için: `npm run dev -- --host` ve yazdığı ağ adresini aç.

Önizleme sayfaları (geliştirme için):

| Adres | Ne gösterir |
|---|---|
| `/` | Oyun (menü) |
| `/viewer.html?view=weapons` | Silah modelleri (`view=characters\|closeup\|weapons\|weapon\|items`) |
| `/map.html?map=vadi&shot=aerial` | Harita önizleme (`map=kasaba\|vadi\|us`) |

---

## 4. Yayına hazır sürüm (statik dosyalar)

```bash
npm run build
```

Çıktı `dist/` klasörüne yazılır. Bu klasörü herhangi bir statik barındırmaya (GitHub Pages, Netlify, Vercel,
kendi sunucun, Nginx...) olduğu gibi yükleyebilirsin; yapılandırma gerekmez (`vite.config.js` içinde `base: './'`).

Yerelde denemek için:

```bash
npm run preview          # build çıktısını http://localhost:4173 üzerinde sunar
```

> `dist/index.html` dosyasına çift tıklayıp `file://` ile açarsan **çalışmaz** (tarayıcılar modül dosyalarını
> `file://` üzerinden yüklemez). Ya `npm run preview` kullan ya da aşağıdaki tek dosya sürümünü.

### Tek dosya sürümü (çift tıkla çalışır)

```bash
npm run build
node scripts/build-single.mjs
```

`dist/single/index.html` oluşur (yaklaşık 1.3 MB). Tüm kod ve harita küçük resimleri içine gömülüdür; sunucusuz,
çift tıklayarak ya da e-postayla gönderip açarak oynanabilir.

---

## 5. Oyun kontrolleri

| Tuş | İşlev |
|---|---|
| `W A S D` | Hareket |
| `Shift` | Koş |
| `Boşluk` | Zıpla (çömelmiş/yatarken: kalk) |
| `Ctrl` / `C` | Çömel |
| `Z` | Yat |
| `Q` / `E` | Sola / sağa eğil (eğilerek ateş edilir) |
| Sol tık / Sağ tık | Ateş / Nişan al (basılı tut) |
| `R` | Şarjör değiştir |
| `1` `2` `3` `4` | Ana silah / yedek / gadget / bıçak |
| `G` / `V` | Gadget / bıçağa geç |
| Fare tekeri | Silah değiştir |
| `B` | Nişangâh değiştir (demir, red dot, holografik, ACOG) |
| `X` | Ateş modu: otomatik / yarı otomatik |
| `F` | Fener (gece ve gün batımında) |
| `Tab` | Skor tablosu |
| `Esc` | Duraklat / fareyi serbest bırak |

İlk yardım çantası seçiliyken yakındaki ölü bir dostun yanında sol tık: **canlandırma**.

Fare ekrana kilitlenemezse (gömülü sayfalar vb.) ok tuşlarıyla bakabilirsin; `Esc` duraklatır.

---

## 6. Sık karşılaşılan sorunlar

**`npm install` hata veriyor / `Unsupported engine` uyarısı**
Node sürümün eski. `node --version` 20.19 ya da 22.12'den küçükse Node'u güncelle.

**Ekran siyah / oyun açılmıyor**
Tarayıcıda WebGL kapalı olabilir. `chrome://gpu` sayfasında "WebGL" satırına bak; donanım hızlandırmayı aç.

**Oyun takılıyor (düşük FPS)**
- Menü → **Ayarlar** → Grafik'i *Düşük* yap ve **Gölgeler**'i kapat. En büyük kazanç gölgeden gelir.
- **Özel Oyun** → oyuncu sayısını azalt (20v20 ve üstü güçlü bilgisayar ister).
- Tarayıcının donanım hızlandırması açık olsun; ayrı ekran kartı varsa tarayıcıyı ona ata.

**Ses yok**
Tarayıcılar sesi ilk tıklamaya kadar kapalı tutar. Menüde bir yere tıkla, oyuna girince ses gelir.
Menü → Ayarlar → Ses kaydırıcısını da kontrol et.

**Fare kilitlenmiyor**
Oyuna girdikten sonra ekrana bir kez tıkla. Tarayıcı fare kilidini reddederse oyun otomatik olarak ok tuşu
moduna geçer.

**Seviye / ayarlar kayboldu veya sıfırlamak istiyorum**
Ayarlar ve ilerleme tarayıcının `localStorage` alanında (`warbyte.v2` (eski `blockfront.v2` kaydı otomatik okunur)) saklanır. Menü → Ayarlar →
*İlerlemeyi sıfırla* ile XP'yi sıfırlarsın; tamamen silmek için tarayıcıda site verilerini temizle.
Farklı tarayıcı / port / `file://` kullanımı ayrı kayıt tutar.

**Port 5173 kullanımda**
Vite başka port seçer; ya da `npm run dev -- --port 3000`.

---

## 7. İsteğe bağlı: test ve ekran görüntüsü araçları

Bunlar oyunu oynamak için gerekmez, geliştirme içindir (ayrıntı: [`OYUN.md`](OYUN.md) §10).

```bash
npm install -D playwright
npx playwright install chromium

npm run dev                                   # bir terminalde
node scripts/screenshot.mjs out.png "view=weapons"          # başka terminalde
```

Test sırasında sayfanın kendiliğinden yenilenmemesi için HMR'siz sunucu kullanılır:

```bash
npx vite --config vite.test.config.js --host 127.0.0.1 --port 5180
BASE=http://127.0.0.1:5180 node scripts/play.mjs "autostart=10v10&map=vadi&debug=1&nolock=1" out 2
```


---

## Çevrimiçi oynamak (arkadaşlarla)

```bash
npm install
npm run build          # istemciyi derle
npm start              # http://127.0.0.1:8787  (oyun + sunucu aynı portta)
```
Tarayıcıda **Çevrimiçi → Oda kur** ile oda kur; ekrandaki 4 harfli kodu (sol üstte, minimap altında) arkadaşlarına ver, onlar
**Çevrimiçi → Katıl** ile girer. Kodun üstüne tıklarsan oda bağlantısı kopyalanır. Aynı ağdaki arkadaşların
`http://SENIN_IP:8787` adresini açar. İnternet üzerinden oynamak için bir VPS gerekir: [`DEPLOY.md`](DEPLOY.md).
Geliştirirken: `npm run server` (8787) ve `npm run dev` (5173) birlikte çalıştırılır; menü sunucuyu otomatik bulur.
