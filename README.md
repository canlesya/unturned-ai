# unturned-ai

Three.js ile Unturned / BattleBit Remastered tarzı takım tabanlı FPS (3v3, 10v10 odalar, botlar, 3 harita).

## Durum

**Aşama 1 – Tasarım (onay bekliyor):** karakterler, silahlar ve eşyalar. Hepsi kodla (prosedürel) üretilen,
düz renkli / flat-shaded, düşük poligonlu modeller.

- `src/models/character.js` – 2 takım (Mavi/Kırmızı) × 5 sınıf (Saldırı, Sıhhiye, Keskin Nişancı, Ağır Destek, Mühendis), iki kemikli IK ile silaha kilitlenen kollar
- `src/models/weapons.js` – AK-47, M4A1, MP5, Glock 17, Pompalı, M24 Keskin, M249 LMG, RPG-7, Bıçak, El Bombası
- `src/models/items.js` – İlk yardım, mühimmat kutusu, zırh plakası, sargı, enerji içeceği, tamir kiti
- `viewer.html` – model önizleme sayfası (`?view=characters|closeup|weapons|weapon|items`)
- `screenshots/` – tasarım ekran görüntüleri

**Aşama 3 – Harita 2 ve 3 (onay bekliyor):**
- `src/maps/terrain.js` – yükseklik haritalı arazi (fizik, mermi, yol bulma, minimap gölgelemesi)
- `src/maps/vadi.js` – **Vadi**: nehirli kanyon, tek taş köprü + iki sığ geçit, ormanlı sırtlar, Ambar / Değirmen / Gözetleme Tepesi / Orman Kampı / Köprü
- `src/maps/us.js` + `src/maps/kitMil.js` – **Askeri Üs**: duvarlı üs, 3 katlı komuta binası, hangar, radar kulesi, kışla, akaryakıt deposu, bunkerler
- `src/maps/index.js` – harita kaydı; menüde harita seçici, `?autostart=10v10&map=vadi|us|kasaba`
- `map.html?map=vadi&shot=aerial|top|bridge|…` – harita önizleme; `screenshots/harita-vadi/`, `screenshots/harita-us/`, `screenshots/oyun-haritalar/`

**Aşama 2 – Harita 1: Kasaba (onay bekliyor):**

- `src/maps/builder.js` – harita üreticisi: parçaları materyal başına birleştirir (az draw call) ve her katı parça için AABB çarpışma kutusu üretir
- `src/maps/kit.js` – ev, ambar, depo, kilise, benzinlik, araçlar, siperler, gözetleme kulesi, ağaçlar
- `src/maps/kasaba.js` – harita yerleşimi; `{ group, colliders, bounds, spawns, objectives }` döner
- `src/maps/environment.js` – gökyüzü, güneş/gölge, sis, bulutlar
- `map.html` – harita önizleme (`?shot=aerial|top|street|blue|red|farm|depot|gas|upstairs|churchin|interior|tower`)
- `screenshots/harita-kasaba/` – ekran görüntüleri

**Aşama 3 – Oynanabilir çekirdek (onay bekliyor):** menü, FPS hareketi, 8 silah + gadget, botlar, hedef ele geçirme modu.

- `index.html` + `src/main.js` + `src/menu.js` – ana menü (mod, takım, sınıf, zorluk, ayarlar)
- `src/game/game.js` – orkestratör: mermi/patlama fiziği, hedef ele geçirme, bilet, doğma, maç sonu
- `src/game/player.js` – klavye/fare girişi, kamera, birinci şahıs silah modeli (ADS, geri tepme, şarjör animasyonu)
- `src/game/soldier.js` – oyuncu ve botların ortak mantığı (ateş, reload, hasar, ölüm, animasyon)
- `src/game/bot.js` + `nav.js` – bot yapay zekâsı (görüş, hedef, nişan, yol takibi) ve A* yol bulma
- `src/game/collision.js` – AABB fizik (adım çıkma, zıplama), ışın testi
- `src/game/hud.js`, `audio.js`, `effects.js` – arayüz, sentezlenmiş sesler, izler/patlama/kan
- `scripts/play.mjs` – oyunu headless tarayıcıda test eder (`autoplay=1`, `nolock=1`, `debug=1`)
- `scripts/build-single.mjs` – `npm run build` sonrası tek dosyalık HTML üretir

**Kontroller:** W A S D hareket · Shift koş · Boşluk zıpla/kalk · Ctrl veya C çömel · Z yat · Q/E yana eğil · sağ tık nişan · R şarjör · 1-4 silah · B nişangâh değiştir (demir / red dot / holografik / ACOG 3x) · Tab skor tablosu.

## Çalıştırma

```bash
npm install
npm run dev           # http://127.0.0.1:5173/viewer.html  (modeller)  ·  /map.html  (harita)
npm run build && node scripts/build-single.mjs   # dist/single/index.html (tek dosya)
npm run shots -- screenshots/x.png "view=weapons&hud=0"   # headless ekran görüntüsü (playwright gerekir)
```
