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

**Aşama 2 – Harita 1: Kasaba (onay bekliyor):**

- `src/maps/builder.js` – harita üreticisi: parçaları materyal başına birleştirir (az draw call) ve her katı parça için AABB çarpışma kutusu üretir
- `src/maps/kit.js` – ev, ambar, depo, kilise, benzinlik, araçlar, siperler, gözetleme kulesi, ağaçlar
- `src/maps/kasaba.js` – harita yerleşimi; `{ group, colliders, bounds, spawns, objectives }` döner
- `src/maps/environment.js` – gökyüzü, güneş/gölge, sis, bulutlar
- `map.html` – harita önizleme (`?shot=aerial|top|street|blue|red|farm|depot|gas|upstairs|churchin|interior|tower`)
- `screenshots/harita-kasaba/` – ekran görüntüleri

## Çalıştırma

```bash
npm install
npm run dev           # http://127.0.0.1:5173/viewer.html  (modeller)  ·  /map.html  (harita)
npm run shots -- screenshots/x.png "view=weapons&hud=0"   # headless ekran görüntüsü (playwright gerekir)
```
