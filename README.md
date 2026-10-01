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

## Çalıştırma

```bash
npm install
npm run dev           # http://127.0.0.1:5173/viewer.html
npm run shots -- screenshots/x.png "view=weapons&hud=0"   # headless ekran görüntüsü (playwright gerekir)
```
