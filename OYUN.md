# WarByte — Oyun ve Geliştirici Rehberi

Bu dosya, oyunun **ne olduğunu, nasıl çalıştığını ve nereyi değiştirirsen ne olacağını** anlatır. Bir şeyi
geliştirmeden önce ilgili bölüme bak. Kurulum için bkz. [`KURULUM.md`](KURULUM.md).

İçindekiler
1. [Oyun nedir](#1-oyun-nedir)
2. [Teknoloji ve temel ilkeler](#2-teknoloji-ve-temel-ilkeler)
3. [Klasör haritası](#3-klasör-haritası)
4. [Çalışma akışı (menüden maça)](#4-çalışma-akışı-menüden-maça)
5. [Koordinatlar ve birimler](#5-koordinatlar-ve-birimler)
6. [Sistemler](#6-sistemler)
7. [Nasıl yapılır? (tarifler)](#7-nasıl-yapılır-tarifler)
8. [Veri sözleşmeleri](#8-veri-sözleşmeleri)
9. [URL parametreleri (test/hata ayıklama)](#9-url-parametreleri)
10. [Test ve araçlar](#10-test-ve-araçlar)
11. [Bilinen eksikler ve fikirler](#11-bilinen-eksikler-ve-fikirler)
12. [Çevrimiçi mod](#12-çevrimiçi-mod)

---

## 1. Oyun nedir

Unturned görünümlü (kutu karakterler, düz renkli, düşük poligon) + BattleBit Remastered tarzı takım savaşı.
**Mavi** ve **Kırmızı** takım. Offline modda rakipler ve takım arkadaşları **botlardır**. **Çevrimiçi modda** (§12) arkadaşlarınla
özel odada oynarsın; boş yerleri botlar doldurur.

| Özellik | Durum |
|---|---|
| Maç boyutu | Takım başına **1–32** oyuncu (sen + botlar) |
| Modlar | **Ele Geçirme** (bayraklar + bilet), **Takım Çatışması** (bayraksız, her ölüm 1 bilet) ve **Ölüm Maçı** (herkes tek, ilk 40 öldürme, en çok 10 kişi, rastgele doğma) |
| Haritalar | **Kasaba** (şehir), **Vadi** (nehirli vadi, arazi), **Askeri Üs** (duvarlı üs) |
| Günün saati | Gündüz, gün batımı, gece (+ rastgele) |
| Hava | Açık, yağmur (şimşek), sis |
| Sınıflar | Saldırı, Sıhhiye, Keskin Nişancı, Ağır Destek, Mühendis |
| Silahlar | 32 öğe: tüfek, SMG, pompalı, tabanca, keskin nişancı, LMG, fırlatıcı, gadget, bıçak |
| Hareket | Koş, zıpla, çömel, yat, yana eğil, ADS |
| Gadget | El bombası, dumanlı bomba, flaşbang, claymore, cephane kutusu, ilk yardım, RPG, M79 |
| Botlar | Mangal (4'lü) stratejisi, kanat manevrası, gözetleme noktası, canlandırma, zorluk: Kolay/Normal/Zor |
| İlerleme | Seviye / XP / istatistik (tarayıcı `localStorage`) |

Oyun kuralları (Ele Geçirme):
- Bayrağın yarıçapında çoğunluk olan takım ilerlemeyi çeker; ilerleme ±1'e varınca sahip olur.
- Her 8 sn (`BLEED_S`)'de bayrağı fazla olan takım, rakibin biletini farkı kadar eritir. Her ölüm de 1 bilet.
- Bilet 0'a ya da süre bitince maç sonlanır (süre bitince bileti çok olan kazanır). Süre "∞" olabilir.
- Ele geçirdiğin bayrakta yeniden doğabilirsin (düşman yakında değilse). Düşman üssüne girenler uyarı alır,
  ~6 sn sonra can kaybeder.
- Ölen dost, **ilk yardım çantasıyla** 14 sn içinde canlandırılabilir (patlayıcıyla ölenler hariç).

---

## 2. Teknoloji ve temel ilkeler

- **Three.js** (`three`) + **Vite**. Başka bağımlılık yok. Derleme: `npm run build`.
- **Her şey prosedürel**: model, harita, ses (WebAudio sentezi), ikon. Görsel/ses dosyası yok. Tek istisna
  `public/img/*.jpg` menü harita küçük resimleridir.
- Üslup: `flatShading: true` malzemeler, düz renkler (`src/core/palette.js`). Yeni bir şey eklerken bu görünüme uy.
- **Performans ilkesi:** haritadaki statik parçalar renk/malzeme başına **tek geometride birleştirilir**
  (`MapBuilder`, `mergeStatic`). Yani yüzlerce kutu yine de birkaç draw call olur. Her parçayı ayrı `Mesh`
  yapma.
- Oyun mantığı **sabit olmayan dt** ile çalışır (`Game.step(dt)`); test araçları `step(1/30)` ile elle ilerletir.
- Dil: kod yorumları ve oyun içi metinler **Türkçe**.

---

## 3. Klasör haritası

```
index.html            Oyun sayfası (menü + oyun aynı sayfada)
viewer.html           Model önizleme (silah/karakter/eşya)      → src/viewer/viewer.js
map.html              Harita önizleme                            → src/viewer/mapViewer.js
vite.config.js        Normal Vite ayarı (base './')
vite.test.config.js   HMR'siz test sunucusu ayarı
public/img/           Menü harita küçük resimleri (kasaba/vadi/us.jpg)
scripts/              Test/ekran görüntüsü/derleme araçları (bkz. §10)
screenshots/          Tasarım ve test ekran görüntüleri (tarihçe)

src/main.js           Giriş: menüyü açar, Game'i başlatır, URL parametrelerini okur
src/menu.js           Ana menü (ekranlar, ayarlar, loadout seçimi, localStorage)
src/menuScene.js      Menü arka planı: dönen harita kamerası, karakter vitrini, silah ikonları
src/menuStyle.js      Menü CSS'i (JS içinde, tek dosya derleme için)

src/core/             geo.js (kutu/silindir yardımcıları, mat, mergeStatic), palette.js (renkler, takımlar)

src/models/           Karakter, silah, eşya modelleri (hepsi kodla)
  character.js          Karakter + IK kollar + yürüme/koşma/yatma/eğilme pozları
  weapons.js            İlk 10 silah, optik (nişangâh) sistemi, createWeapon()
  weapons_more.js       Sonradan eklenen 22 silah/gadget/bıçak
  weapon_util.js        Silah yardımcıları (finish, şarjör grubu, ray ticks)
  items.js              Yerdeki eşyalar (ilk yardım çantası vb.)

src/game/             Oyun mantığı
  game.js               Orkestratör: harita/ortam kurulumu, savaşçılar, mermi/patlama, mod, doğma, maç sonu
  soldier.js            Oyuncu+bot ortak mantığı: hareket durumu, ateş, reload, bıçak, hasar, ölüm, model eşitleme
  player.js             Klavye/fare girişi, kamera, birinci şahıs silah modeli (ViewModel), ADS
  bot.js                Bot yapay zekâsı (BotBrain)
  nav.js                Yürüme ızgarası + A* yol bulma
  collision.js          AABB fizik (World): hareket, adım çıkma, zıplama, ışın testi, arazi
  stats.js              TÜM denge verisi: WSTATS, CLASS_DEFS, DIFFICULTY, OPTICS, makeLoadout
  match.js              Maç türleri/ayarları (perTeam, bilet, süre), hazır ayarlar
  gadgets.js            Duman, flaşbang, claymore, cephane kutusu mantığı
  anim.js               Reload / bıçak animasyon eğrileri (viewmodel + 3. şahıs ortak)
  hud.js                Oyun içi arayüz (HUD, minimap, pusula, ölüm/doğma, skor, maç sonu)
  audio.js              WebAudio ile sentezlenmiş sesler (konumsal)
  effects.js            Parçacıklar, iz mermisi, kan, kıvılcım, patlama, izler
  weather.js            Yağmur, şimşek, sis
  util.js               clamp, lerp, rand, pick...

src/maps/             Haritalar
  index.js              Harita kaydı (MAPS)  ← yeni harita buraya eklenir
  builder.js            MapBuilder: kutu/silindir/duvar/merdiven + otomatik çarpışma kutuları
  environment.js        Gökyüzü, güneş, sis, bulut, gün batımı/gece, parlayan malzemeler (glow)
  terrain.js            Yükseklik haritalı arazi (Vadi)
  kasaba.js  vadi.js  us.js        Harita yerleşimleri
  vadiLayout.js                    Vadi yükseklik alanı/patikaları/hedef konumları
  kit.js (+kitBase/kitBuildings)   Şehir yapı kiti: ev, ambar, depo, kilise, benzinlik, araç, siper, ağaç...
  house.js  furn.js                Ev iç mekânı + mobilya
  kitTown.js                       Kasaba dekorları (su kulesi, çeşme, kiosk...)
  kitVadi.js                       Vadi yapıları (kule, bunker, asma köprü, kamp ateşi...)
  kitMil.js (+kitMilBuild/Interior) Askeri üs yapıları (hangar, radar, tünel, komuta binası içleri...)

src/viewer/           Önizleme sayfaları (viewer.js, mapViewer.js)
```

---

## 4. Çalışma akışı (menüden maça)

```
index.html → src/main.js
   │  ?autostart yok → showMenu(start)        (menu.js; MenuScene canlı arka plan)
   │  ?autostart var → doğrudan start({...})  (test için)
   ▼
start(opts) → new Game(document.body, opts)    (game.js)
   │
   ├─ MAPS[opts.map].build()                   → { group, colliders, bounds, spawns, objectives, ... }
   ├─ setupEnvironment(scene, ..., tod)        → gökyüzü/güneş/sis/glow  (environment.js)
   ├─ new World(colliders, bounds, terrain)    → fizik (collision.js)
   ├─ new NavGrid(colliders, bounds, terrain)  → bot yol ızgarası (nav.js)
   ├─ makeMatch(opts.match)                    → mod/boyut/bilet/süre   (match.js)
   ├─ Soldier × (2 × perTeam), BotBrain × bot  → ilki oyuncu (Player), kalanı bot
   ├─ Weather, Effects, Sfx, Hud, Player
   └─ requestAnimationFrame(loop) → step(dt) + render()
```

Her kare `Game.step(dt)`:
1. her `Soldier.update` + `World.move`
2. `Player.update` (giriş, kamera), `BotBrain.update` (yapay zekâ)
3. mermi/roket/el bombası (`updateProjectiles`), gadget'lar, hava
4. `updateMode` (bayrak ilerlemesi, bilet erimesi, sıhhiye aurası, ikmal, maç sonu kontrolü)
5. `updateBaseZones`, mangal görev yenilemesi (18 sn'de bir)
6. ölenlerin yeniden doğması, `Soldier.syncModel` (3D modeli duruma uydurur), `Hud.update`

Maç bitince `opts.onMatchEnd` → `menu.js recordMatch()` XP/istatistik kaydeder; "Ana Menü" `Game.exit()` ile
oyunu temizleyip menüyü yeniden açar.

---

## 5. Koordinatlar ve birimler

- **İleri = −Z, yukarı = +Y, sağ = +X.** `yaw = 0` → −Z'ye bakar. Yön vektörü:
  `(-sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch))`.
- Mavi takım batıda (x < 0), +X'e bakarak (`ry = -π/2`) doğar; Kırmızı doğuda (`ry = +π/2`).
- Birimler: **metre**, **saniye**, **radyan**. Oyuncu boyu 1.78 m (çömelme 1.3, yatma 0.55).
- `MapBuilder.box(x, yAlt, z, w, h, d, renk, opt)` → **y tabanı** verir (alt kenar). Silah/karakter
  `core/geo.js box()` ise **merkez** bazlıdır. Karıştırma.
- Çarpışma kutuları eksen hizalıdır (AABB). Döndürülmüş kutular yalnızca **90°'nin katlarında** doğru
  çalışır; başka açıda dönen şey `collide:false` (süs) olmalı.
- Fizik: yerçekimi 15, zıplama 5.4 (~0.97 m), adım çıkma **0.5 m** (basamak yüksekliği ≤0.3 m yap),
  oyuncu yarıçapı ~0.35 m.
- Yol ızgarası hücresi 0.5 m; engeller 0.35 m şişirilir → bir geçit **en az ~1.3 m** olmalı ki bot geçsin.

---

## 6. Sistemler

### 6.1 Savaşçı (`soldier.js`)
Oyuncu ve botlar aynı `Soldier` sınıfıdır; fark, oyuncuda `Player`, botta `BotBrain` onu sürmesidir.
- `items[0..3]` = ana silah, yedek, gadget, yakın dövüş (tuş 1–4). Biçim: `{ id, mag, reserve }`.
- Ateş: `tryFire()`; yayılma (`spreadNow`): kalça/ADS + hareket + çömelme + bloom; kalıcı geri tepme.
- Reload: `startReload()`; süre `WSTATS[id].reload`; şarjörde mermi varsa `TAC_RELOAD` (0.65) ile hızlanır.
  Pompalı/çift namlu mermi mermi (`reloadStyle: 'shell'`), ateşle iptal edilebilir.
- Bıçak: kombo (`swings`), vuruş animasyonun %44'ünde (`SWING_HIT_K`), arkadan vuruş tek atış.
- Duruş: ayakta / çömel / yat, yana eğilme (Q/E), `eye()` eğilmeyi içerir.
- Hasar: `takeDamage` → `die`. Kafa ×2.1, bacak ×0.8, menzil düşüşü `range:[tam, min]` ve `minMul`.

**Duruş / animasyon (`Soldier.syncModel`):** yerinde dururken `stanceK=1` hazır duruş (ön ayak önde, dizler bükük, ayaklar açık, pelvis `idleLow` kadar alçak, gövde hafif öne eğik,
nefes/ağırlık salınımı); hareket, çömelme, yatma ve havada kendiliğinden kalkar. Ayaklar `legs.*.foot` grubudur ve bacak açısından bağımsız yere paralel tutulur.
Bacaklar (`root`) bakış yönüne gecikmeli döner (`bodyYaw`: yerinde ~1 sn, koşarken hızlı), gövde/silah anında bakış yönündedir. Hitbox ve ağ mantığı bundan etkilenmez.

### 6.2 Fizik ve arazi (`collision.js`)
`World`: ızgara-hash'li AABB'ler, eksen eksen hareket + adım çıkma. Arazi varsa (`terrain`): zemin yüksekliği
`heightAt`, dik yamaç ve derin su engeli, ışın testi araziyle de yapılır. `settle(s)` doğan savaşçıyı zemine/
alçak engele oturtur. `world.clear(a, b)` iki nokta arası görüş hattıdır (duman `Game.losClear` ile ayrıca
kontrol edilir).

### 6.3 Yol bulma (`nav.js`)
0.5 m hücreli ızgara + A*. Zemin kattaki engeller kutulardan, araziden (dik yamak, derin su) çıkarılır.
`tag:'deck'` olan kutu (köprü tabliyesi) araziden bağımsız yürünebilir sayılır, `tag:'rail'` engeldir.
**Botlar yalnızca zemin kat/arazi üstünde yürür**; üst kat, çatı, kule oyuncuya özeldir.

### 6.4 Bot yapay zekâsı (`bot.js`)
- **Mangal:** takım başına 4'lü gruplar; `Game.assignSquads()` her mangala bir hedef (bayrak) verir (18 sn'de
  bir yenilenir; ihtiyaç, mesafe, mevcut yük hesaba katılır).
- `pickGoal()`: rol bazlı — keskin nişancı `Game.perch()` ile hedefi gören yüksek/uzak nokta tutar, sıhhiye
  önce yakındaki cesede (canlandırmaya), yoksa dosta gider; bazen **kanat manevrası** (ara nokta `via`).
- `sense()`: görüş (mesafe, bakış yönü, çömelmiş uzaktakini az görme, gece/hava/duman ile azalır).
- Savaş: tepki süresi, nişan hatası, seri atış, strafe; yakında silah işe yaramazsa bıçak; gadget kullanımı.
- Zorluk `DIFFICULTY` (stats.js): tepki süresi, hata, dönme hızı, seri uzunluğu, hasar çarpanı.

### 6.5 Maç (`match.js`, `game.js`)
`makeMatch({perTeam, type, tickets, time, allFlags})`. 8+ oyuncuda tüm bayraklar, daha azında yalnızca
`core:true` bayraklar kullanılır. Hazır ayarlar: `PRESETS` (`3v3`, `10v10`).
Doğma: `Game.pickSpawn` (üs noktaları ya da sahip olunan bayrağın çevresi), `baseZones` ihlali cezası.

### 6.6 Günün saati ve hava
`environment.js`: `TOD_PRESETS` (gün batımı/gece) gökyüzü, sis, güneş, hemisfer ışığı, yıldız ve ay verir.
`mat(renk, { glow: true })` ile üretilen malzeme (lamba/pencere) gece/gün batımında `emissiveIntensity`
alır → **ışık kaynağı olacak şeylere `o:{glow:true}` ver**. `weather.js`: yağmur (çizgi parçacıkları + şimşek +
ses), sis (yakın sis). Botlar geceleri/sisli havada daha az görür (`Game.night`, `visMul`). `F` ile fener.

### 6.7 Arayüz
- `menu.js`: ekran durumu `screen` (`home|custom|loadout|settings|controls`), tek `render()` + olay delegasyonu
  (`data-a`/`data-v` öznitelikleri). Yeni seçenek = `render` içine buton + `act()` içine `case`.
- `hud.js`: tek `Hud` sınıfı, DOM + CSS (kendi `CSS` sabiti). Minimap canvas'a çizilir (arazi gölgelemesi dahil).
- Silah ikonları `MenuScene.weaponIcon()` ile gerçek modelden render edilip önbelleğe alınır.

### 6.8 Kayıt (`localStorage`, anahtar `warbyte.v2` (eski `blockfront.v2` kaydı otomatik okunur))
`map, tod, weather, type, perTeam, tickets, time, team, cls, diff, optic, loadouts{sınıf→seçimler}, name, sens,
fov, volume, shadows, quality, xp, stats{matches,wins,kills,deaths}`. Seviye: `floor(sqrt(xp/120)) + 1`.

---

## 7. Nasıl yapılır? (tarifler)

### 7.1 Yeni silah eklemek
1. **Model:** `src/models/weapons_more.js` içine bir fonksiyon yaz (origin = kabza, namlu **−Z**). `finish(g, {
   name, hold, gripR, gripL, muzzle, length })` ile bitir; şarjörü `g.userData.mag`, sürgüyü `bolt` olarak
   işaretlersen reload animasyonu bunları kullanır. Dosya sonundaki `MORE` nesnesine ekle.
2. **Nişangâh noktası:** `MOUNT_MORE` içine `{ z, y, front, rearZ, ... }` ekle (red dot/holo/ACOG buraya takılır).
3. **İstatistik:** `src/game/stats.js` → `WSTATS.<id>` (alanlar için §8.2). Tüfeklerde `sight`/`dist` ADS hizasıdır.
4. **Optik izni:** gerekiyorsa `OPTIC_ALLOWED` tablosuna ekle.
5. **Sınıfa ver:** `CLASS_DEFS.<sınıf>.primaryOptions` (veya secondary/gadget/melee Options) listesine id'yi ekle.
6. **Ses:** `audio.js` `shot()` içinde `sound` anahtarı yoksa en yakın aileyi kullan; yeni ses istersen ekle.
7. **Doğrula:** `viewer.html?view=weapons` (siluet, namlu yönü) ve oyunda ADS'de nişan hizası.

### 7.2 Yeni sınıf eklemek
`CLASS_DEFS`'e `{ label, hp, speed, primary, gadget, desc, primaryOptions, secondaryOptions, gadgetOptions,
meleeOptions, defaults }` ekle. Karakter görünümü için `src/models/character.js` içindeki `CLASSES` tablosuna
teçhizat (kask/yelek/çanta) ekle. `Game` içindeki bot sınıf dizisi `order`'a da ekle.

### 7.3 Yeni harita eklemek
1. `src/maps/benim.js` oluştur: `export function buildBenim()` → §8.1'deki nesneyi döndürür. Zemini, yolları,
   yapıları `MapBuilder` ve yapı kitleriyle kur; `makeRng(seed)` ile deterministik rastgelelik kullan.
2. `src/maps/index.js` → `MAPS.benim = { id, name, tag, thumb, desc, build }`.
3. **Küçük resim:** `src/viewer/mapViewer.js` `PRESETS.benim` ekle (aerial vb.), sonra
   `PAGE=map.html node scripts/screenshot.mjs public/img/benim.jpg "map=benim&shot=aerial&clean=1" 960 540`.
4. **Zorunlu kurallar (oynanabilirlik):**
   - Mavi/kırmızı spawn **birbirini ve cadde eksenini görmemeli**; her spawn bölgesinin ≥3 çıkışı olmalı.
   - Her hedefe **iki spawn'dan da yürünebilmeli**; kapalı oda/ada kalmamalı; geçitler ≥1.3 m.
   - Ev içi çok boş kalmasın; basamak ≤0.3 m; kule/çatıya fizikle çıkılabilmeli.
   - Işık veren şeylere `glow`.
5. Doğrulama: `scripts/probes/mapcheck.mjs`, `reach.js`, `flood.js`, `sim.js` (§10).

### 7.4 Yeni bina / dekor parçası
- Şehir: `kit.js` / `kitTown.js`; Vadi: `kitVadi.js`; Üs: `kitMil*.js`. İmzalar `(b, ...)` — ilk argüman
  `MapBuilder`. İç mekân için `house.js` (`K.house`), mobilya `furn.js`.
- İnce süs parçalarına `{ collide: false }` ver (kutu sayısını ve takılmayı azaltır). Siper olacaklara çarpışma bırak.
- Duvarlarda köşe çentiği/boşluk kalmasın: `b.shell(...)` ya da köşe sütunu; `scripts/probes/walls.mjs` ile tara.

### 7.5 Yeni hedef (bayrak) / oyun modu
- Hedef: harita nesnesindeki `objectives` listesine `{ id, name, x, z, r, core?, label? }` ekle. `core:true`
  küçük maçlarda da kullanılır. `label` HUD/minimap harfidir (çakışmayı önler).
- Mod: `match.js` `MATCH_TYPES`'e ekle; mantık `game.js` `updateMode` / `checkEnd` / hedef kurulumu
  (`this.mode.objectives`) ve `menu.js` mod seçiminde. TDM örnek: hedef listesi boş.

### 7.6 Denge ayarı
Her sayı `stats.js`'tedir: hasar `dmg`, atış hızı `rpm`, şarjör `mag`, yedek `reserve`, yükleme `reload`, yayılma
`hip/ads`, tepme `kickV/kickH`, menzil `range:[tam, min]`+`minMul`, hız çarpanı `move`. Menüdeki çubuklar
`stats:{...}` (0–100) alanından gelir — yeni değer girince onu da güncelle.

### 7.7 Yeni günün saati / hava
`environment.js` `TOD_PRESETS`'e ekle ve `TODS` / `match.js TODS_LIST` / `menu.js` seçimine ekle.
Hava için `weather.js` `WEATHERS` + `Weather` içine dal ekle; `menu.js`'de zincir butonu.

### 7.8 Menüye yeni ayar eklemek
`DEFAULTS` (menu.js) → alan ekle; ilgili ekranın HTML'ine buton; `act()`'e `case`; `launch()` içinde `payload`'a
koy; `Game`'de `opts.<alan>` olarak oku.

---

## 8. Veri sözleşmeleri

### 8.1 Harita nesnesi (`build()` dönüşü)
```js
{
  id, name,
  group,                  // THREE.Group (görsel)
  colliders,              // [{ min:[x,y,z], max:[x,y,z], tag? }]  tag: 'deck' | 'rail'
  bounds,                 // { minX, maxX, minZ, maxZ }  oyun alanı
  spawns,                 // { blue:[{x,z,ry,y?}], red:[...] }  takım başına ≥16-24 nokta
  objectives,             // [{ id, name, x, z, r, core?, label? }]
  baseZones,              // { blue:{minX,maxX,minZ,maxZ}, red:{...} } düşman girerse ceza + ikmal bölgesi
  roads?, roadColor?,     // minimap yolları
  terrain?,               // Terrain nesnesi (yükseklikli haritalar)
  env?,                   // { sky, fog, sun, hemi, cloud, clouds, sunPos }  gündüz ortamı
}
```
`env.sunPos` gündüz güneş konumu; gün batımı/gece değerlerini `environment.js` kendisi verir.

### 8.2 `WSTATS[id]` alanları (`stats.js`)
| Alan | Anlam |
|---|---|
| `name, desc, slot` | Ad, Türkçe açıklama, `primary\|secondary\|gadget\|melee` |
| `kind` | `gun`, `launcher`, `throwable`, `mine`, `medkit`, `melee`... davranış türü |
| `stats` | Menü çubukları `{dmg,range,rate,control,mobility}` (0–100) |
| `dmg, rpm, auto, pellets` | Hasar, dakikadaki atış, otomatik mi, saçma sayısı |
| `mag, reserve, reload, reloadStyle, shell, equip` | Şarjör, yedek, yükleme süresi/biçimi, silah çekme süresi |
| `hip, ads, kickV, kickH` | Yayılma ve geri tepme |
| `range:[tam,min], minMul` | Hasar düşüş menzili ve en düşük çarpan |
| `zoom, move` | ADS yakınlaştırma, hareket hızı çarpanı |
| `sight:[x,y,z], dist, dot, scope` | ADS nişan noktası (silah yerelinde), nişangâh mesafesi |
| `sound, tracer` | Ses ailesi, iz mermisi rengi |
| gadget/bıçak | `radius, fuse, speed, count, trigger, swings, swingT, reach...` |

### 8.3 `CLASS_DEFS[cls]`
`label, hp, speed, desc`, `primaryOptions/secondaryOptions/gadgetOptions/meleeOptions` (id listeleri),
`defaults:{ primary:{blue,red}, secondary, gadget, melee }`. `makeLoadout(cls, team, choice, rng)` →
`[ana, yedek, gadget, bıçak]` item dizisi; `choice.random=true` botlar içindir.

### 8.4 `Game` seçenekleri (`new Game(container, opts)`)
`map, tod, weather, team, cls, diff, optic, playerName, loadout{primary,secondary,gadget,melee},
match{perTeam,type,tickets,time}, settings{sens,fov,volume,shadows,pixelRatio}`, geri çağrılar `onExit,
onRestart, onMatchEnd`, bayraklar `debug, nolock, autoplay`.

### 8.5 Oyun olayları
`game.on(ad, fn)` / `game.emit`: `hitmark, spawn, reload, reloaded, fire, firemode, switch, throw, melee,
meleehit, dry, bolt`. HUD ve ses bunlara bağlanır.

---

## 9. URL parametreleri

Menüyü atlayıp doğrudan maç başlatır (test için): `/?autostart=10v10&map=vadi&debug=1&nolock=1`

| Parametre | Değer |
|---|---|
| `autostart` | `NvN` (örn. `3v3`, `16v16`) — takım başına N |
| `map` | `kasaba` `vadi` `us` |
| `tod` | `day` `sunset` `night` |
| `weather` | `clear` `rain` `fog` |
| `type` | `conquest` `tdm` |
| `team` / `cls` / `diff` | `blue\|red` / sınıf id / `easy\|normal\|hard` |
| `primary` `secondary` `gadget` `melee` | silah id'leri |
| `optic` | `iron` `reddot` `holo` `acog` |
| `tickets` `time` | bilet, süre (sn; `0` = sınırsız) |
| `debug=1` | `window.__game` açığa çıkar |
| `nolock=1` | Fare kilidi istemeden başla (headless test) |
| `autoplay=1` | Oyuncuyu da bot sürsün |
| `shadows=0`, `pr=1` | Gölgesiz, piksel oranı |

Önizleme: `map.html?map=us&shot=aerial|top|...&tod=night&markers=1&clean=1`,
`viewer.html?view=characters|closeup|weapons|weapon|items`.

---

## 10. Test ve araçlar

Tarayıcı araçları **playwright** ister (`npm i -D playwright && npx playwright install chromium`). Headless
ortamda yazılım render olduğundan (≈1 FPS) oyun mantığı `__game.step(1/30)` ile elle ilerletilerek test edilir.

| Araç | Ne yapar |
|---|---|
| `scripts/play.mjs "<query>" <çıktı> [bekleme] [js]` | Oyunu başlatır, `window.__game` üzerinde `js` çalıştırır, ekran görüntüsü alır. `BASE`, `W`, `H`, `DSF` env'leri. |
| `scripts/screenshot.mjs out.png "<query>"` | Statik sayfa görüntüsü (`PAGE=map.html` ile harita önizleme) |
| `scripts/menushot.mjs <önek> [ekranlar]` | Menü ekranlarının görüntüsü |
| `scripts/keytest.mjs` | Gerçek klavye olaylarıyla duruş/eğilme/nişangâh testi |
| `scripts/build-single.mjs` | `dist/` → tek dosya HTML (görselleri gömer) |
| `scripts/probes/reach.js` | Her spawn'dan her hedefe A* ulaşılabilirliği (hepsi sayı olmalı, `null` olmamalı) |
| `scripts/probes/flood.js` | Ulaşılamayan ada / kapalı alan taraması |
| `scripts/probes/sim.js` | 240 sn simülasyon: adım süresi, yeraltına düşen, hedef sahipleri |
| `scripts/probes/mapcheck.mjs [harita]` | Node'da: ulaşılabilirlik, ada, spawn geçerliliği, spawn görüş hattı |
| `scripts/probes/climb.mjs`, `mapclimb.mjs` | Fizikle ev/kule/çatıya tırmanma doğrulaması |
| `scripts/probes/walls.mjs [filtre]` | Bina duvar çatlağı taraması |
| `scripts/probes/nav3d.mjs`, `losdiagram.mjs` | Yardımcı: 3B yüzey grafiği, görüş diyagramı |

Tipik kontrol listesi (yeni harita/silah sonrası):
```bash
npx vite --config vite.test.config.js --host 127.0.0.1 --port 5180     # HMR'siz sunucu
export BASE=http://127.0.0.1:5180
node scripts/play.mjs "autostart=10v10&map=vadi&debug=1&nolock=1" t 1 "$(cat scripts/probes/reach.js)"
node scripts/play.mjs "autostart=10v10&map=vadi&debug=1&nolock=1&autoplay=1" t 1 "$(cat scripts/probes/sim.js)"
node scripts/keytest.mjs
```
`sonuç:` satırını oku; `hata sayısı: 0` olmalı. Geçici `t.png` dosyalarını sil. Dev sunucuyu (`vite`) test
sırasında kod değiştirirsen sayfa yenilenip testi bozabilir — o yüzden `vite.test.config.js` kullan.

---

## 11. Bilinen eksikler ve fikirler

**Bilinen eksikler**
- Çevrimiçi mod beta: odalar bellekte (sunucu yeniden başlarsa kapanır), hesap yok, JSON protokol (§12.6).
- Botlar yalnızca zemin kat/arazide yürür; üst kat, çatı ve kuleler sadece oyuncuya özel.
- Vadi'de Gözetleme Tepesi'ne bot az gider; botlar köprüde yığılma eğilimindedir.
- Askeri Üs'te uzak kulelerden spawn'lara az bir görüş payı kalmıştır.
- Revolver, M79 ve çift namlu için şarjör çıkarma animasyonu yoktur.
- Bot bıçak dövüşü seyrektir.
- Dumanın ilk kullanımında yazılım render'da shader derleme gecikmesi olur (gerçek GPU'da beklenmez).
- Harita küçük resimleri (`public/img/*.jpg`) haritayı değiştirince elle yenilenmeli (§7.3).

**Fikirler (öncelik sırasıyla)**
1. Araçlar (jip/ATV) 2. Çevrimiçi: ikili protokol, ilgi alanı filtresi, oda listesi, sohbet, hesap/ilerleme sunucuda
3. Botların üst katlara çıkması (3B yüzey grafiği: `scripts/probes/nav3d.mjs` temel olabilir)
4. Yıkılabilir duvar / C4 5. Silah özelleştirme (susturucu, kabza, şarjör türleri)
6. Maç içi ilerleme (sınıf seviyeleri, silah kilitleri, görevler) 7. Yeni modlar (bayrak kapmaca, hedef yok etme)
8. Yeni haritalar (çöl, kar) ve karakter özelleştirme


---

## 12. Çevrimiçi mod

Özel oda + 4 harfli oda kodu. Sunucu **otoriterdir**: hareket, ateş, isabet, hasar, gadget, bayrak ve bilet sunucuda hesaplanır;
istemci girdi gönderir ve sonucu çizer. Boş slotları botlar doldurur (oyuncu girince bir botun yerine geçer, çıkınca bot geri gelir).
Sunucu kurulumu: [`DEPLOY.md`](DEPLOY.md).

### 12.1 Mimari

```
Tarayıcı (istemci)                              Node sunucusu (server/)
 Player ─ girdi ─► NetClient.pushInput ──ws──►  Room.input ─► kuyruk (Game.humans)
   │ aynı Game kodu, tahmin                        │  60 Hz sabit adım: Game.step → updateHumans
   │                                               │  (headless Game: renderer/HUD/ses yok, nullSink)
 NetClient.onSnap ◄── snapshot 20 Hz + olaylar ◄── Room.snapshot / netEvents
   ├ reconcile: yerel oyuncu (ack + yeniden oynatma)
   └ interpolate: diğerleri (100 ms geriden)
```

| Dosya | Görev |
|---|---|
| `src/sim/input.js` | `applyInput(soldier, input, dt)`: girdi→hareket, **tek kaynak** (offline Player, sunucu, istemci tahmini aynı fonksiyon) |
| `src/sim/nullSink.js` | Sunucuda `sfx/effects/hud/weather` yerine geçen boş nesne |
| `src/net/protocol.js` | Sabitler (60 Hz sim, 20 Hz snapshot), mesaj biçimleri, `packSoldier`, oda kodu, sunucu adresi |
| `src/net/client.js` | `NetClient`: bağlantı, girdi gönderme, tahmin uzlaştırma, interpolasyon, ping |
| `server/index.js` | HTTP (derlenmiş istemci + `/health`) ve WebSocket; oda kur/katıl |
| `server/room.js` | `Room`: headless `Game`, istemciler, snapshot, olay yayını, maç sonu sıfırlama |
| `src/game/game.js` | `opts.headless`, `claimSlot/releaseSlot`, `humanTick/updateHumans`, `rewind` (lag comp), `onNetEvents` (istemci) |
| `src/menu.js` | Çevrimiçi ekranı (oda kur / katıl / sunucu durumu); `src/main.js` `beginOnline` |

### 12.2 Girdi güdümlü simülasyon (önemli)
Canlı bir insan oyuncunun simülasyonu **zamana değil girdiye bağlıdır**: sunucu, istemcinin gönderdiği her girdi için tam olarak
bir adım uygular (`Soldier.update` + `World.move`, sonra girdi → hız; istemci `Game.stepOnline` ile birebir aynı sıra).
Girdi gelmezse oyuncu o adımda ilerlemez. Bu sayede:
- istemci tahmini ile sunucu **aynı sayıda adım** atar → ağ dalgalansa da sapma ~mm (testte 0 düzeltme);
- hız hilesi yok: girdi başına 1 hak harcanan **zaman kovası** (her gerçek adımda +1, en çok 30 = 0,5 sn) → toplam simüle süre gerçek süreyi aşamaz;
  ağ takılması sonrası yığılan girdiler kovadaki zamanla eritilir (adım başına en çok 2).
- İstemci 0,5 sn'den uzun susarsa oyuncu nötr girdiyle durdurulur. Ölüler genel döngüde güncellenir.

### 12.3 Tahmin ve uzlaştırma (yerel oyuncu)
Her girdi `seq` taşır; istemci `hist`'te sakladığı konumla, sunucunun `ack` anındaki konumunu (`me.st`) karşılaştırır.
Fark >5 cm ise sunucu durumuna dönüp onaylanmamış girdileri yeniden oynatır. Doğma (`rs` sayacı) ve ölümde sunucu durumu esas alınır.
Cephane (`me.am`) yalnızca uçuşta ateş/şarjör yokken sunucuya eşitlenir.

### 12.4 Savaş ve lag compensation
İstemci ateşi yerelde de çalıştırır (geri tepme, animasyon, mermi sayacı) ama **hasar vermez**. Girdiyle birlikte, rakipleri hangi sunucu
adımında gördüğünü (`vt`) yollar. Sunucu `Game.rewind` ile hedefleri o ana (en çok 37 adım, yaklaşık 0,6 sn) geri sarar, ışını atar, sonra geri yükler.
Sonuç olaylarla yayılır: `sh` (atış izi/efekt), `hm` (isabet işareti), `dmg` (hasar yönü), `kill`, `rld`/`swg` (diğer oyuncuların animasyonu),
`gr/rk/sl` (el bombası/roket/M79 fırlatma), `boom` (patlama/duman/flaş), `dep/depx` (mayın, cephane kutusu), `ammo`.
İstemci mermi benzeri nesneleri görsel olarak hareket ettirir ama patlamayı sunucudan bekler.

### 12.5 Test araçları
| Komut | Ne yapar |
|---|---|
| `npm run server` | Sunucuyu başlat (`PORT`, `MAX_ROOMS`, `BF_RESTART_MS`; test için `BF_DEBUG=1`) |
| `node scripts/headless-sim.mjs [harita] [NvN] [sn]` | Tarayıcısız maç simülasyonu |
| `node scripts/nettest.mjs` | Protokol: oda, katılma, girdi, snapshot hızı, **girdi flood (hız hilesi)** |
| `node scripts/combattest.mjs` | Ateş, hasar, öldürme, **lag compensation**, doğma (ağsız) |
| `node scripts/gadgettest.mjs` | Her gadget'ın ağ olayları |
| `node scripts/thirdtest.mjs` | 3. şahıs: nişan hizası, duvar/köşe arkası vurulamaz, sahte/aşırı kamera ofseti, roket |
| `node scripts/dmtest.mjs` | Ölüm Maçı: herkes tek, 10 kişi sınırı, dağınık doğma, 40 öldürmede bitiş |
| `node scripts/adsaudit.mjs` | Tüm silah × nişangâh: ADS'de nişan çizgisini kapatan parça var mı |
| `node scripts/lobbytest.mjs` | Lobi: resmi odalar, şifre, gizli/botsuz oda, takım isteği, harita dönüşü |
| `BF_RESTART_MS=3000 BF_DEBUG=1 npm run server` sonra `node scripts/endtest.mjs` | Maç sonu + oda sıfırlama |

`BF_DEBUG=1` ışınlanma/eşya/bilet komutlarını açar (`{t:'dbg',...}`); **üretimde kullanma**.
Tarayıcıda iki sekme: `/?online=new&name=Ali&per=3` sonra `/?online=KOD&name=Veli`. Otomatik tarayıcı testlerinde dikkat: sekme
**görünürse** oyunun kendi `requestAnimationFrame` döngüsü de çalışır; oyun döngüsünü elle de sürersen çift adım = çift girdi olur
(gerçek kullanımda sorun yok, yalnızca test düzeneği hatası).

### 12.6 Lobi, resmi sunucular, takım seçimi
- **Oda listesi:** menü, sunucunun `GET /rooms` uç noktasını 2,5 sn'de bir sorar. Liste resmi odaları, sonra herkese açık oyuncu odalarını verir
  (ad, harita, mod, doluluk, botlu mu, kilitli mi). Şifre asla listede ya da `welcome` mesajında yoktur. Gizli odalar yalnızca kodla girilir.
- **Oda kurma:** `Çevrimiçi → Oda kur` formu (Özel Oyun'dan bağımsız, `p.olCfg`): ad, şifre, görünürlük, harita, saat, hava, mod, takım başına oyuncu,
  **bot açık/kapalı** + zorluk, bilet, süre. Sunucu `sanitizeCfg` ile doğrular.
- **Botlar:** açıkken boş slotlar botludur; oyuncu girince bir bot azalır (`claimSlot`), çıkınca bot geri gelir. Kapalıyken boş slotlar `vacant` olur
  (doğmaz, skor tablosunda yok); oyuncu girince slot aktifleşir, çıkınca yeniden boşalır.
- **Resmi sunucular** (`server/official.js`): açılışta kurulur, kapanmaz, her biri bir harita/saat/hava listesini sırayla döner (maç bitince bir sonrakine).
  Boşken simülasyon durur (CPU harcamaz) ve taze maça hazırlanır; ilk oyuncu girince bot oyunu başlar. Yeni resmi oda eklemek için listeye bir giriş eklemek yeter.
- **Şifre:** düz metin, bellekte; yanlış şifre ≥6 kez denenirse bağlantı kesilir. Sayfa yenilenince (maç sonu, takım değişimi) şifre `sessionStorage`'dan tekrar gönderilir.
- **M tuşu:** takım menüsü (takım doluluk/bot sayısı). Seçince sunucu `team` mesajıyla boş yer olup olmadığını doğrular; onaylanırsa sayfa `?team=` ile yeniden bağlanır
  (eski slot bota döner, yeni takımda bir bot yerine geçilir).
- Test: `node scripts/lobbytest.mjs` (resmi odalar, bot sayısı, şifre, gizli oda, botsuz oda, doluluk, takım isteği, harita dönüşü).

### 12.7 Ölüm Maçı (herkes tek), T tekerleği, kill
- **Ölüm Maçı (`type: 'dm'`):** her savaşçıya benzersiz takım kimliği (`f0`..`f31`, `palette.js` her biri için ayrı renk üretir). Böylece tüm
  "düşman mı?" kontrolleri (`e.team !== s.team`) değişmeden herkesi düşman sayar. `Game.ffa` bayrağı: bayrak/bilet/üs cezası yok, doğma
  `pickSpawn` içinde tüm harita noktalarından rastgele + canlı düşmandan uzak, bitiş `checkEnd`'de 40 öldürme ya da süre (en çok öldüren),
  HUD'da SEN / LİDER sayacı ve tek skor tablosu. `perTeam` bu modda **toplam oyuncu** (2–10, `DM_MAX`). Odada takım menüsü (M) kapalıdır.
  Test: `node scripts/dmtest.mjs`.
- **T tekerleği:** `T` basılı → silahın uygun nişangâhları dairesel menüde; fare = imleç (bakış kilitli), sol tık = seç, `T` bırakılınca kapanır.
  `Player.openWheel/wheelMove/wheelPick`; seçim `Soldier.setOptic` + çevrimiçinde `{t:'opt', optic}`. Silah özelleştirmeleri (kabza, namlu...) için aynı yapı kullanılacak.
- **Kill:** duraklatma panelinde (Esc) "Kill (yeniden doğ)" → offline `die()`, çevrimiçi `{t:'kill'}` (3 sn'de bir; ölüm sayılır, puan kimseye yazılmaz).
- **Nişan denetimi:** `node scripts/adsaudit.mjs` — her silah × nişangâh için ADS pozunda ekran merkezinden ışın atar; cam dışında bir parça (ön arpacık,
  gövde, el) kırmızı noktayı kapatıyorsa uyarır. Arpacıklar `frontSight()` alt grubudur (demir nişanda görünür, optikte gizlenir); optik tabanı gövde
  üstüne otomatik oturur (`mountY`), koridordaki küçük ön parçalar çıkarılır (`clearSightLine`).

### 12.8 3. şahıs kamera (H)
- **Oda ayarı:** `third` (Özel Oyun'da `p.third`, çevrimiçi oda formunda "3. şahıs kamera: Açık/Kapalı"; varsayılan odalarda kapalı, resmi odalar kapalı).
  Sunucu `cfg.third === true` demedikçe `Game.thirdAllowed` yanlıştır: `H` "Bu odada 3. şahıs kamera kapalı" der ve atış ofseti yok sayılır.
- **Kamera:** `Player.thirdCamera` — gözün 2,5 m arkasında, 0,72 m sağda/solda, 0,2 m yukarıda; `Q`/`E` omuzu değiştirir (`sideT` ile akıcı;
  `Q`/`E` aynı zamanda 1. şahıstaki gibi **yatar**). Sol omuzda (`Q`) karakter aynalı duruşa geçer: gövde sola döner, sağ ayak öne gelir, silah yine sağ elde (`Soldier.stanceLeft/stanceT`; ağda `F_LEFT` bayrağı ve `sd` girdisi ile diğer oyunculara da böyle görünür). Duvara girmesin diye göz→kamera ışını atılır (`World.raycast`), yere gömülmez. Kamera çok yaklaşırsa (<0,65–0,85 m)
  gövde gizlenip 1. şahıs silahı gösterilir (`bodyVisible`, histerezis). Dürbünle (scope) nişan alınca otomatik 1. şahsa döner.
- **Gövde:** `Game.showSelf` doğruyken kendi karakter modeli görünür ve animasyonlanır (silah modeli senkron), 1. şahıs silahı/optik örtüleri gizlenir, artı hep görünür.
- **Nişan hizası + güvenlik (iki aşamalı atış):** kamera omuzda olduğu için nişan noktasını **kamera ışını** belirler (`Soldier.shotOff` = kameranın gözden ofseti; ışın neye çarparsa —
  duvar ya da düşman— orası hedef P). Mermi ise **her zaman oyuncunun gözünden P'ye** gider (`Game.shootRay(..., camO)`): artı neyi gösteriyorsa mermi oraya gider (yakın mesafede ~25°'den fazla
  sapma gerekiyorsa gözden düz atışa düşer), ama arada duvar/engel varsa mermi ona çarpar. Kamerayla köşeden bakıp duvarın arkasındaki hedefi vurmak mümkün değildir. Roket de aynı.
  Çevrimiçinde kamera ofseti girdiyle (`co`) gider; sunucu yalnızca oda izin veriyorsa, ofset ≤ 4,5 m ve göz→kamera arasında duvar yoksa kabul eder (aksi halde gözden düz atış).
- **Artı işareti:** 3. şahısta da ekranın ortasında sabit kalır.
  Test: `node scripts/thirdtest.mjs` (nişan hizası, duvar/köşe arkası sızıntı, çok yakın mesafe, sahte/aşırı ofset, roket). Gerçek oyun hattıyla (Player kamerası + tryFire) tarayıcıda yapılan 1960 denemelik
  uçtan uca denetimde: sömürü koşulunda 0 sızıntı, açık görüşte %99,5 isabet.

### 12.9 Sınırlar ve sonraki adımlar
- Protokol JSON: oyuncu başına yaklaşık 100–200 KB/s. Kalabalık odalar için ikili paketleme + ilgi alanı (yalnızca yakındakiler) planlanmalı.
- Yeni katılan, o an havada olan el bombası/duman bulutunu görmez (kurulu mayın/kutuları görür).
- Hesap yok (takma ad); XP/seviye tarayıcıda kalır. Odalar bellekte.
- Hile önlemi: hareket/ateş/hasar sunucuda; hız hilesi kova ile engelli. Eksik: görüş hattı verisi (tüm konumlar istemciye gider, "wallhack" mümkün), girdi imzası.

### 12.10 Araç / silah / karakter ayrıntıları
- **Araçlar** `src/maps/vehicles.js`: otomobil, otobüs, kamyon, tanker, ZPT, tank, ambulans, cip — eğik camlar, tampon/ızgara, far/stop, ayna, kapı çizgileri, jantlı tekerlekler. Çarpışma tek kutu (`b.vcollide`).
- **Otomatik yerleşim:** Kasaba ve Üs'te `b.autoPlace = true`; araçlar ertelenir, `b.flushVehicles()` çakışan aracı en yakın boş yere (≤3,2 m) kaydırır, yer yoksa koymaz. Denetim: `node scripts/vehaudit.mjs` (araç↔araç ve araç↔bina/engel, 0 çakışma beklenir).
- **Silahlar:** AK-47, M4A1, MP5, Glock, Pompalı, M24, M249, RPG-7 ek ayrıntılarla (atım penceresi, seçici, perçin, tırtıl, askı halkası, şarjör kaburgası). Ayrıntılar nişan hattının üstüne eklenmez (`adsaudit` hâlâ 0).
- **Karakter:** parmaklar/başparmak, dirsek koruyucu, omuz yaması, omuz başları, plaka cebi + MOLLE, telsiz, kemer cepleri, uyluk cebi, taban/bağcık/manşetli botlar, saldırı sınıfında kulaklık-mikrofon + gece görüş tutucu.

### 12.11 Geliştirici Atölyesi haritası (`dev`)
Menüde Özel Oyun/Çevrimiçi harita kartlarında "Geliştirici Atölyesi" (rastgele seçime girmez). URL: `?autostart=3v3&map=dev`. `src/maps/dev.js`: z −46 araçlar (11), z −27/−19 tüm silah ve gadgetlar kaide üstünde (2× büyük, etiketli), z +5 binalar (ev, ofis, garaj, dükkân, ambar, depo, kilise, benzinlik, silo), z +27 duvar açıklıkları / merdivenler / siperler / konteyner / hendek, z +39 küçük yapılar ve ağaçlar, z +52 askeri yapılar (hangar, radar, kule, bunker, helikopter, uçak). Etiketler yalnızca tarayıcıda çizilir.
Araba camları kenarlara oturan eğik cam + A/C sütunu; çamurluk kemeri tekerlek halkası (`wheel(..., { wall })`).
Atölye kısayolları (yalnızca çevrimdışı): **L** serbest uçuş (çarpışmasız; WASD yönüne bakışa göre, Boşluk yukarı, C/Ctrl aşağı, Shift hızlı), **J/K** elindeki yuvadaki silahı önceki/sonraki ile değiştirir (1-4 ile yuva seç; tam mermi). Doğuş noktaları binaların dışında (x ±88).

**Silah inceleme (Y):** birinci şahıs silah modeli ~3,4 sn'de ortaya alınıp yandan, ters ve üstten gösterilir (`ViewModel.inspect`); ateş, nişan, yükleme, sprint, silah değişimi ve savurma iptal eder. Yalnızca görsel; çevrimiçide de çalışır.

### 12.12 Silah yüzey cilası ve ayrıntılar
- `src/models/weaponFinish.js`: silah malzemelerine shader ile ince yüzey katmanı (doku dosyası yok): metalde namlu yönünde çizik + mikro benek + aşınmış açık yamalar (hafif metalik), ahşapta lif damarı, boyalı yüzeylerde (zeytin/kum) boya kırıkları. Yalnızca silah malzemeleri klonlanır; harita ve karakter etkilenmez.
- Ortak ayrıntı yardımcıları `weapon_util.js`: `magRibs, studs, vents, gripTexture, sling`. 32 silahın hepsinde atım penceresi, seçici, perçin, havalandırma, şarjör kaburga/taban, askı halkası, kabza dokusu. Ayrıntılar nişan hattının üstüne eklenmez.
- `node scripts/weaponaudit.mjs`: parçaların ana gövdeye bağlı olduğunu (havada kalan parça yok) denetler; 32/32 OK.

Nişan görüş alanı: `ADS_K` (göz-nişangâh mesafesi ×1,3), kırmızı nokta ×0,68 / holo ×0,72 küçük ve ince çerçeveli, demir arka nişangâh daha ince, nişan alırken silah kamerası FOV 54→68 (`ADS_FOV`). `node scripts/adsview.mjs`: ekran merkezi çevresinde (3°/6°/10°) silah-nişangâhın kapattığı oranı ölçer.

### 12.13 Yakın dövüş ve RPG-7
- Bıçak (mat siyah taktik, zeytin oluklu sap, kırmızı kordon), Satır (geniş eğri çelik bıçak, ahşap sap, pirinç perçin) ve Tomahawk (ahşap saplı balta) birbirinden belirgin ayrılır; hepsinde sap z=0 merkezli.
- Birinci şahıs: sapı saran yumruk (`fist`: parmaklar üstte, avuç altta, başparmak yanda), yassı tarafı kameraya dönük duruş (`MELEE_IDLE`). Üçüncü şahıs: bıçak göğüs hizasında önde, ucu yukarı-ileri (`MOUNTS.melee`).
- RPG-7 nişangâhı: tüpün solunda arka halka + önde turuncu uçlu arpacık; halkanın ortasında turuncu ucu görünce nişan hizalıdır.

Araç çarpışması (`MapBuilder.vparts`): her araç gövde profiline uyan birkaç kutudan oluşur (ör. otomobil: kaput/bagaj 0,85 m, kabin 1,58 m, ön-arka cam eğimi 1,2 m). Kaput ve bagaj üstünden atış geçer, kabin ve gövde engeller; dönük araçta kutular şişmez. Otomobil yan camı ön/arka cam eğimini izleyen dilimlerden oluşur (boşluk kalmaz).
Otomobil (ve hurdası) camsızdır (kırık cam mantığı): ince sütunlar, tavan, torpido ve koltuklar görünür; pencere boşluklarından kurşun geçer (çarpışma: kemer hattı 0,92 m + ince sütunlar + tavan). Cip üstü açıktır: alçak gövde, yan paneller, koltuk sırtı ve ince ön cam çerçevesi (cam boşluğu geçirir).

### 12.14 Yapı cilası ve denetimi
- **Çatılar katı:** `MapBuilder.prism` artık basamaklı çarpışma kutuları üretir (yarım genişlik başına 4 dilim, tag `roof`). Kilise kulesinin çan katı kemerinden zıplayıp nef çatısının içine girme sorunu buradan çıkıyordu. Baca, anten direği, kule direkleri ve hangar payandaları da çarpışmalı.
- **Merdiven (`MapBuilder.stairs`)** artık süslü: açık tonlu basamak yüzü + koyu burun şeridi, yan kirişler, korkuluk direkleri ve eğik el tutamağı (hepsi çarpışmasız). `opt.base`: havada başlayan merdivenin altı o yüksekliğe kadar dolar (kilise B kolu); `opt.posts`: altına yere inen destek direkleri (su kulesi B kolu).
- **Ev çatısı:** mahya, saçak alın tahtası, kiremit sıraları, alın havalandırması, baca başlığı (`house.js`, rastgelelik kullanmaz → mevcut düzen/mobilya dizisi değişmez).
- Denetimler: `node scripts/mapaudit.mjs [harita]` (çarpışmasız yüksek döşeme, çatı prizması, iç içe yapı), `node scripts/probes/passthru.mjs [harita] [çözünürlük]` (JUMP=1 ile zıplayarak: ulaşılabilen noktada gövdenin çarpışmasız katı hacmin içine girip girmediği).

### 12.15 Toplu harita kalite denetimi (`node scripts/mapqa.mjs [harita] [--full]`)
- **Z-fighting (dokuların gidip gelmesi) otomatik çözülür:** `MapBuilder.resolveZFight` (tarayıcıda her harita kurulurken, ~+0,1 sn). Eksen hizalı her kutu/prizma kaydedilir; farklı malzemeli iki kutunun AYNI YÖNE bakan yüzleri ≤1,2 cm arayla çakışıyorsa küçük yüzlü olan 1,3 cm öne itilir (alt-üst zincirleri için en çok 5 geçiş). Çarpışma kutuları değişmez. `scripts/mapzfight.mjs`: kaynak (dosya:satır) çiftleriyle kaç yüz düzeltildi + ikinci geçişte 0 kalmalı.
- **Boşluk üstü kaplama:** `scripts/mapfloat.mjs` halı/kat zemini/membran gibi ince yatay çarpışmasız kutuların merdiven ya da çatı çıkışı deliğini örtüp örtmediğine bakar (askeri binalarda kat zemin rengi ve evlerde halı/membran artık deliği dışarıda bırakır).
- **İç içe yapı:** `scripts/mapaudit.mjs` (özet), `scripts/mapoverlap.mjs [harita] [min]` (katı örtüşmeler kaynak çiftine göre gruplu: alışılmadık, az sayıdaki çiftler hatadır).
- **İçinden geçilen hacim:** `scripts/probes/passthru.mjs` (yavaş; `--full` ile).
- Kilise nef çatısı artık kule duvarında biter (kule içine girmez).

**Koşarken / zıplarken ateş:** serbest ama isabetsiz. `Soldier.spreadNow`: koşarken (Shift, `firedSprinting` ya da hız > 5,8 m/s) +0,085 rad (≈4,9°: 20 m'de ~1,7 m, 50 m'de ~4,3 m), havadayken +0,075 rad (koşarak zıplayınca ikisi toplanır ≈ 9°); nişan alırken (ADS) etkisi azalır. Sunucuda da aynı kod çalışır. Test: `node scripts/spreadtest.mjs`.

### 12.16 Harita yerleşim düzeltmeleri
- **Düzenleme denetimleri:** `scripts/mapobj.mjs [harita] [yatay] [dikey]` (her çarpışma kutusu, onu üreten DÜZEN çağrısına — `vadi.js:satır:sütun` gibi — bağlanır; farklı çağrılardan gelen kutuların iç içe girmesi rapor edilir), `scripts/mapvis.mjs` (çarpışmasız süs ve ağaç tepeleri dahil), `scripts/mapveh.mjs` (araç ↔ yapı/prop). `mapqa.mjs` hepsini çalıştırır. Sonuç: Vadi 0, Üs 0 gerçek iç içe yapı (kalanlar bilinçli birleşimler: duvar-direk, kaya tüneli).
- **Vadi:** orman kampı sandıkları/odun yığını, tepe kaya-sandık, kum torbaları (kuyu ve ahır duvarına gömülüyordu), devrik kütük, ahır duvarına gömülen kaya yer değiştirdi.
- **Askeri Üs:** hangarın içine gömülü duran varillerle konteyner (dış duvara gömülüydü) ve tünele giren blast duvarı taşındı.
- **Araç çarpışması hatası:** ZPT/tank taret kutuları 4 m yükseklikte çıkıyordu (yanlış boy: 2,5 m). Düzeltildi: ZPT tareti 0,7 m, tank taret 1,0 m.

Z-fighting düzeltmesi notu: bir yüz toplamda en çok 2,7 cm itilir; çimen yaması/asfalt/toprak gibi ince (≤4,5 cm) zemin kaplamaları birbirini itmez (yolun üstüne çim çıkmasın).

### 12.17 Sunucu kapasitesi (24 oda simülasyonu)
`node scripts/roomsim.mjs` (sunucu `PORT=8788 node server/index.js`) 20 kullanıcı odası kurar (farklı harita/mod/boyut/şifre/gizli/botlu-botsuz), 12 odaya oyuncu sokar ve `/rooms` listesini yazar. `scripts/serverprof.mjs` ağsız CPU ölçümü/profili verir (`node --cpu-prof`).
Sunucu optimizasyonu: harita odalar arasında paylaşılır (`Game._mapCache`, DM spawn değişimi için yüzeysel kopya), sunucuda görsel geometri kurulmaz (`MapBuilder.noVisual`), başsız modda 3B karakter modeli/animasyon yoktur (hafif taslak). 24 oda + ~75 oyuncuda: bellek 2,0 GB → 0,43 GB, CPU tek çekirdeğin %77'si → %30. Boşta (4 resmi oda): 414 → 175 MB.

### 12.18 Tuş atama, sol el, ses kanalları ve müzik
- **Tuş atama:** Kontroller ekranında her eylem için 2 tuş (`src/core/keybinds.js`: `ACTIONS` listesi, `Binds`). Tuşa tıkla → yeni tuşa bas; Geri tuşu temizler, Esc vazgeçer; başka eylemdeki aynı tuş oradan alınır; Esc/F5/F11/F12/Meta atanamaz; sağ/sol Ctrl-Shift-Alt aynı sayılır. Yalnızca varsayılandan farklılar `warbyte.v2` → `keys` içinde saklanır. Oyunda `Player` ve `Game` tuşları `game.binds` üzerinden okur (fare tuşları ve Esc sabit). Test: `node scripts/bindtest.mjs`.
- **Sol el:** Kontroller → "Silahı tutan el" ya da oyunda `U` (atanabilir). Birinci şahıs silah modeli aynalanır (x ekseni negatif ölçek; nişan hizası korunur); tercih kaydedilir. Diğer oyuncular/3. şahıs görünümü etkilenmez.
- **Ses kanalları:** Ayarlar → Ana ses × (Efekt, Müzik, Ortam). `Sfx`: `sfxBus` (silah/patlama…) ve `ambBus` (yağmur/rüzgâr). **Yağmur sesi** düğmesi yağmur gürültüsünü ve gök gürültüsünü kapatır (sis rüzgârı Ortam kanalında kalır).
- **Müzik:** `src/game/music.js` — `public/audio/music/lobby.mp3` (menü) ve `match1..3.mp3` (maç) dosyaları varsa çalar, yoksa sessiz. Yeni ad için `TRACKS`'e ekle, `music.play('ad')` çağır. Henüz dosya yok.

### 12.19 Ateş modları ve aç-kapa nişan
- **Ateş modu (X):** otomatik silahlarda **Tek atış** (her tık 1 mermi) → **Seri** (tek tık ya da basılı tutma 3-5 mermi; başlayan seri tetik bırakılsa da biter, yenisi için yeniden tık gerekir) → **Otomatik** (basılı tutunca sürekli) → başa. Seri uzunluğu: 700 dk/dk altı 3, 900 altı 4, üstü 5 mermi (`Soldier.burstSize`, silaha `burst:` yazılarak değiştirilebilir). Tabanca, pompalı, keskin nişancı vb. hep tek atar. Mantık `Soldier.triggerUpdate`: Player ve sunucu (`humanTick`) aynı kodu kullanır. Test: `node scripts/firetest.mjs`.
- **Nişan alma (sağ tık):** Kontroller → "Basılı tut" ya da "Bir kez bas (aç-kapa)" (`prefs.adsToggle`). Aç-kapa modunda koşmak ve silah değiştirmek nişanı kapatır.

### 12.20 Doğma noktasını klavyeyle seçme
- Ölüm ekranında (bayrak/conquest) doğma noktası artık **Sol/Sağ eğil tuşlarıyla (varsayılan Q / E) ya da ← →** değiştirilir; kullanılabilir (`ok`) seçenekler arasında döner (`Game.cycleSpawn`). Sınıf seçimi aynen 1–5. Başlıkta tuş ipucu görünür; tuşlar Kontroller'den değiştirilince ipucu da değişir. Çevrimiçide `requestSpawn` → `opt` mesajı aynı yoldan gider.
- Test: `node scripts/spawnkeytest.mjs` (ekran görüntüsü `spawnkey.png`, çıktıyı silin).

### 12.21 Bayrak kanaması göstergesi
- Bayrak modunda biletler **kendiliğinden azalır** (hata değil): her 8 sn (`BLEED_S`, stats.js)'de daha çok bayrağı olan takım, bayrak farkı kadar **rakibin biletini** eksiltir (`Game.updateMode`); ölüm de 1 bilet götürür. Bayrak sayısı eşitse kimse kaybetmez.
- HUD: kanayan takımın adının yanında `▼n` (8 sn'de n bilet) görünür; kanama başlayınca/bitince bildirim çıkar.
- Test: `scripts/tickettest.mjs` (1v1, 50 bilet, hareketsiz oyuncu: bot 3 bayrağı alınca ~100 sn'de biter), `scripts/bleedshot.mjs`.

### 12.22 Denge güncellemesi
- Keskin Nişancı canı 90 → **100**; Ağır Destek 150 → **125** (hız 0.9 ve LMG ile dengeli); Desert Eagle hasarı 55 → **48** (artık 3 atış; yedek silah tüfekle yarışmasın); bayrak kanaması 5 → **8 sn** (`BLEED_S`).
- Güncel TTK (100 can, gövde): AK/SCAR 3 atış 0.20–0.23 sn, M4/AUG/G36 4 atış 0.24–0.26 sn, SMG'ler 5–6 atış ~0.27–0.30 sn. Yeni mod/silah eklerken bu aralığı koru.

### 12.23 Skor tabanlı Takım Çatışması (TDM)
- TDM artık bilet eritmez: **düşman öldürmek takıma +1 skor** verir (`Game.onKill`, `mode.scoreBased`). Skor sınırına (`mode.tickets`, otomatik `perTeam*10`, 30–150) ilk ulaşan kazanır; süre dolarsa yüksek skor. Takım arkadaşını/kendini öldürmek skor vermez.
- HUD: skorlar 0'dan yukarı sayar, zamanlayıcının altında "İLK n". Menüde TDM seçilince "Bilet" yerine "Skor sınırı" seçenekleri (30–200). Çevrimiçi aynı `tk` alanını kullanır.
- Yol haritası ve sıradaki adımlar: [YOL_HARITASI.md](YOL_HARITASI.md). Test: `scripts/tdmtest.mjs`.

### 12.24 Enfekte (zombi) modu
- **Kurallar:** toplam oyuncunun ~1/8'i (en az 1) maç başında **ilk zombi (alfa)** olur, kalanı insan (mavi). Zombi, bir insanı öldürünce o insan 5 sn sonra **zombi olarak** doğar (her insan ölümü enfekte eder). Ölen zombi insana döner (bkz. 12.26). **Son insan enfekte olursa zombiler**, süre dolarsa **insanlar** kazanır. Skor = insan/zombi sayısı (HUD: İNSAN n · ZOMBİ n). Takım seçimi (M) ve sınıf/doğma seçimi (ölüm ekranı) bu modda yoktur.
- **Zombi:** `CLASS_DEFS.zombie` (menüde görünmez, `enumerable:false`), tek eşya **Pençe** (`claws`, melee), solgun yeşil model (`TEAMS.zomb`, `zombieGear`), parlayan göz, açık kaburga. Tüm denge değerleri `stats.js` → **`ZOMBIE`** (hp 100, alfa 200, hız 1.0, hasar 25, yeniden doğma 8 sn, oran 1/8) — tek yerden ayarlanır.
- **Mantık (`game.js`):** `seedInfection`, `makeZombie`, `infect` (respawn içinde), `infCounts`, `pickZombieSpawn` (insanlara yakın ama ≥38 m uzak havuz noktası), `checkEnd`/`updateMode` enfekte dalları. Bot: `BotBrain.updateZombie` (en yakın insanı kovalar, pençeler) ve insan botlar `huddle()` ile birbirine yakın durur.
- **Ağ:** `cfg.type='inf'`, `perTeam` = toplam oyuncu (4–24, çift); `inf` olayı (takım+sınıf+model değişir), `packSoldier.mh` (maxHp), roster `team` eşitlemesi. Botsuz odada ikinci oyuncu ilk zombi olur.
- **Test:** `scripts/inftest.mjs` (headless maç), `infbalance.mjs` / `infduel.mjs` (denge), `infnet.mjs` + `infnetshot.mjs` (sunucu + gerçek istemci), `infshots.mjs` (ekran görüntüleri). Botlara karşı insanlar çoğunlukla kaybeder; gerçek oyuncuyla değerler `ZOMBIE` ile ayarlanır.

### 12.25 Zombi buff'ı: türler ve özel güçler
- Genel: ilk zombi oranı **1/4** (12 kişide 3), yeniden doğma **6 sn**, alfa canı **×2**, zombi pençesi artık **arkadan tek vuruş (backstab) yapmaz**, hızlar insanlardan yüksek.
- **5 tür** (`stats.js` → `ZTYPES`; ölüm ekranında 1–5 ile seçilir, botlar her doğuşta rastgele): **Yürüyen** (can 190, hız 1.12, hasar 32 · *Öfke*: 4 sn hız ×1.25 ve hasar ×1.4) · **Koşucu** (140 · 1.32 · 28 · *Atılış*: 2.5 sn hız ×1.7) · **Dev** (460 · 1.0 · 46, biraz büyük · *Zırh*: 5 sn hasarın %70'i yok) · **Hayalet** (150 · 1.18 · 32 · *Görünmezlik*: 6 sn; saldırınca/vurulunca biter, 3 m içinde seçilir, botlar 6 m'den uzağı fark etmez) · **Işınlanan** (170 · 1.15 · 32 · *Işınlanma*: baktığı yönde 14 m, engel varsa önünde durur).
- **Kullanım:** `F` (Kontroller'den değiştirilebilir, eylem `ability`) ya da **sağ tık**; HUD'da alt ortada güç göstergesi (hazır/bekleme/etkin). Sunucu yetkilidir: istemci `ab` kenar olayı yollar, bekleme/etkin süre snapshot `me.ab` ile döner; hayalet bayrağı `F_CLOAK`, tür `zt`.
- Test: `scripts/infabil.mjs` (güçler), `infduel.mjs` (tür başına düello), `infnet.mjs` (sunucu), `inftypes.mjs` (görünüm).

### 12.26 Enfekte: BOSS zombiler ve can hakları (12.24'teki "alfa" ve ilk zombi oranının yerini alır)
- **Başlangıç:** yalnızca **BOSS zombiler** zombi başlar: 16 kişiden azsa **1**, 16 ve üstüyse **2** (`ZOMBIE.bossCount/bossSplit`). Geri kalan herkes insan.
- **Boss:** `BOSS` (stats.js): can = 1000 + 90 × oyuncu sayısı (12 kişide ~2080), hız 1.2 × kalıcı öfke 1.25, pençe 46 × kalıcı öfke 1.4 (~64), hasarın %30'unu yok sayar, **3 can hakkı**, 9 sn ile doğar. Tek gücü **Gölge Sıçrayışı** (F / sağ tık): 15 m ışınlanma + 2 sn görünmezlik, 7 sn bekleme. Boynuzlu, dikenli, kırmızı gözlü model, üstte herkesin gördüğü boss can çubuğu + ♥ hakları.
- **Can hakları:** insan 1 ölümle **normal zombi** olur (boss'un öldürdüğü de normal zombi) · normal zombi **1 ölümle** (`ZOMBIE.lives`, önceden 2) **insana döner** · boss **3 ölümle** insana döner. Dönen kişi eski sınıfıyla (ya da ölüm ekranında seçtiğiyle) mavi üste doğar; yine öldürülürse yeniden enfekte olur.
- **Kazanma:** insan kalmazsa zombiler · süre dolarsa ya da **tüm zombiler/bosslar iyileşirse** insanlar. Ölü ama can hakkı biten zombi insan sayılır (`willCure`).
- **Hız:** tüm zombi türleri +%10 (Yürüyen 1.24, Koşucu 1.45, Dev 1.1, Hayalet 1.3, Işınlanan 1.27).
- **Ağ:** snapshot `bs` (boss), `zl` (can hakkı); `inf` olayı `bs/zt/zl`, yeni `cure` olayı; ölüm ekranı satırı duruma göre zombi türü / insan sınıfı / boss.
- **Test:** `scripts/inflives.mjs` (kurallar), `infnetcure.mjs` (gerçek istemci, çevrimiçi insan→zombi→insan), `inftypes.mjs` (görünüm), `infbalance.mjs` (BHP/BPP/BSPD/BDMG ile deneme). Not: insan botlar bossları zor yener; denge gerçek oyuncuyla ayarlanmalı.

### 12.27 Zombi boyutu, vuruş kutusu, zıplama ve pençeler
- **Boyut:** zombiler daha heybetli: Yürüyen ×1.1, Koşucu ×1.04, Dev ×1.28, Hayalet/Işınlanan ×1.12, **Boss 1.6 × 1.4 × 1.6** (≈2.5 m boy). Değerler `ZTYPES[].scale` / `BOSS.scale`.
- **Vuruş kutusu = görünen model:** `Soldier.hbH/hbW` (setClass'ta model ölçeğinden), `Game.hitSoldier` ve `meleeHit` bunu kullanır; boss kafası/kolları artık vurulur. Hareket çarpışması (kapılar) değişmedi; gözü ölçeğin %60'ı kadar yüksek.
- **Zıplama:** `Soldier.jumpMul` (Yürüyen/Hayalet/Işınlanan 1.18, Koşucu 1.28, Dev 1.1, Boss 1.35) → insanın 1.2–1.8 katı yükseklik; `input.js` ortak (tahmin tutarlı). Zombi botlar koşarken ara sıra sıçrar.
- **Pençe:** demir kaplı pençe eldiveni (perçinli el sırtı plakası, yumruk çubuğu, 4 kalın kemik pençe + kanlı uçlar + başparmak mahmuzu), iki elde.
- Test: `scripts/infhit.mjs` (vuruş kutusu + zıplama).

### 12.28 New York — Enfekte'ye özel gece haritası + çok katmanlı navigasyon
- **Harita:** `src/maps/newyork.js` (168 × 124 m, gece zorunlu `forceTod`, yalnızca Enfekte'de listelenir: `MAPS.newyork.only`; sunucu `sanitizeCfg` da yalnızca `inf` türünde kabul eder). Patlamış Manhattan caddesi: Broadway (D-B) + 5. cadde meydanda kesişir; iki yanda 16 yıkık gökdelen (kırık/çatlak tepeler, patlak delikler + içeride yangın, dolu pencereler, neon tabelalar, tenteler, yangın merdivenleri), arkada servis yolları, çökmüş bina arsası, otopark, inşaat iskelesi, girilebilir dükkânlar; uzakta şehir ufku silueti. Doldurma: ~40 hurda/yanık taksi-araç, devrik otobüsler, tank/zırhlı/ambulans/cip enkazı, düşmüş helikopter, 5 krater, bariyer-kum torbası-kasa-varil yığınları, hidrant, lamba direkleri (ışık havuzları), yanan variller, trafik lambaları, haber bayileri, otobüs durakları, büyük panolar, "NO SAFE PLACE" / "THEY ARE EVERYWHERE" yazıları.
- **Yüksek savunma noktaları (`map.perches`, 9 adet):** meydan anıtı 1.4 m (dört yandan basamak) · iki kamyon kasası 3.0 m (basamakla yükleme rampası) · iki metro girişi çatısı 2.4 m · çökmüş kat döşemesi 4.0 m (moloz rampası) · otopark katı 3.2 m (rampa) · inşaat iskelesi 5.0 m (uzun merdiven, vinç) · market arkası çatısı 3.0 m. Platformlar `plat` etiketli **katı bloklardır**; 1.0–1.3 m'ye zombi sıçrar, 2.4 m ve üstüne yalnızca merdivenden.
- **Navigasyon:** `NavGrid(..., layered)` — `plat` etiketli kutular hücre başına zemin yüksekliği (`floor`) verir (hücreden dar basamaklar da en az 1 hücre sayılır); yol bulma yalnızca |Δzemin| ≤ `maxStep` komşulara geçer (insan 0.7, zombi 1.15 = sıçrayarak). `nav.floorAt()`. Diğer haritalar etkilenmez. **Kural:** basamak yüksekliği ≤ 0.3, derinlik ≥ 0.35; merdivenin son basamağı platform kenarına tam oturmalı.
- **Bot davranışı:** insan botlar `huddle()` ile en uygun perch'i seçer (yükseklik, doluluk `cap`, zombi baskısı), merdivenden çıkar, yukarıda geri çekilmez ve yüksekten ateş eder; zombi botlar yüksekteki hedefe rampa/basamaktan çıkar, önündeki ≥0.5 m basamakta ve hedef platformdaysa sıçrayarak vurur. Zombi doğma havuzu yalnızca zemin kattan.
- Test: `scripts/newyorkshots.mjs`, `newyorkbots.mjs`, `newyorkthumb.mjs`, `infbotcheck.mjs`, `infmatrix.mjs` (`MAPS=newyork`).

### 12.29 Enfekte açılış: hazırlık süresi, görünmez doğma, New York ikinci geçiş
- **Hazırlık süresi (`ZOMBIE.grace` = 14 sn):** maçın ilk 14 saniyesinde zombiler/bosslar hareket edemez, saldırmaz, güç kullanamaz, hasar almaz (`Game.graceLeft`; `timeLeft` snapshot'tan geldiği için istemci de aynı hesaplar). Ekranda "Zombiler n sn sonra serbest kalacak — yüksek bir yere çık!". Süresiz maçta yok.
- **Görünmez doğma:** zombi doğma noktası seçerken insanların görüşünde (≤75 m, LOS) olanlar elenir (30 aday); bosslar haritanın arka arsalarından başlar. Test: `scripts/infstart.mjs` (ilk 14 sn insan atışı 0, görüşte doğma %0).
- **New York:** Broadway ve doğu-batı kenarları kesintisiz bina duvarıyla kapandı (harita sonu görünmez), Broadway'e görüş kıran moloz/otobüs engelleri, doğma karakolu (hesco, kum torbası, ışıklar), park, kilise, benzinlik; inşaat iskelesi ve otopark yeniden konumlandı.

### 12.30 Enfekte yalnızca New York + Zor botlar; boss can ölçeği
- **Kısıt:** Enfekte modunda harita yalnızca **New York** (`mapsFor('inf')`; menüde diğer haritalar gizli, Enfekte seçilince harita otomatik New York olur; sunucu `sanitizeCfg` `inf` için haritayı New York, botları Zor yapar) ve bot zorluğu yalnızca **Zor** (menüde seçenek yok, `Game` `inf`'te `diff='hard'`). Diğer modlar etkilenmez.
- **Boss sayısı eşiği:** `ZOMBIE.bossSplit = 16` → 16 kişiden azsa 1, 16 ve üstüyse 2 boss. (20'ye çıkarmak 16–19 kişide insanları %90–100 kazandırdı, 16 ise 2 boss'la dengeli.)
- **Boss canı:** `BOSS.hp × BOSS.growth^(eşdeğer oyuncu − 10)` (şu an 1400 × 1.18^…; 2 boss'ta eşdeğer oyuncu = oyuncu − 7). 10 kişide ≈1400, 14'te ≈2700, 24'te ≈4000 (boss başına). Önceki doğrusal formül oyuncu arttıkça insanları çok kolaylaştırıyor, eşikte ani sıçrama yapıyordu. 30'ar maç: Zor/New York'ta insanların kazanma oranı 10–24 kişide %33–63 (düz). Test: `BSPLIT=… BHP=… BG=… BOFF=… DIFFS=hard MAPS=newyork SIZES=… node scripts/infmatrix.mjs 30 300`.

### 12.31 Silah Yarışı (Gun Game)
- **Kural:** herkes tek (Ölüm Maçı altyapısı: `mode.ffa`), 2–10 oyuncu. 15 seviye: `GG_LADDER` (stats.js) = M4A1, AK-47, MP5, pompalı, SCAR-H, Vector, SVD, AUG, AA-12, P90, keskin nişancı, Deagle, Revolver, tabanca, **bıçak**. Her öldürme (`Game.onKill`) öldüreni bir sonraki seviyeye çıkarır (`Soldier.setLevel`: silah anında değişir, dolu cephane); **bıçakla öldürülen bir seviye geriler**; son seviyede (bıçak) **bıçakla ilk öldüren kazanır**; süre dolarsa en yüksek seviye. Eşya listesi 2 yuvalı `[seviye silahı, bıçak]` (son seviyede yalnızca bıçak). Sınıf/doğma seçimi yoktur (herkes Saldırı sınıfı), doğuş 3 sn.
- **HUD:** üst çubuk SEN / LİDER = seviye, sol altta "Seviye n/15", seviye atlayınca "SEVİYE n/15 · silah" bildirimi, skor tablosunda Seviye ve Silah sütunları, ölüm ekranında "sıradaki silah".
- **Ağ:** snapshot `gl` (seviye), `lvl` olayı; sunucu sınıfı `assault`'a sabitler. **Bot:** 2 yuvalı eşya listesi korumaları, bıçak seviyesinde bıçağa yaklaşma.
- Test: `scripts/ggtest.mjs` (kural/merdiven/bot maçı), `ggnet.mjs` (sunucu), `ggshots.mjs` (ekran görüntüleri).

### 12.32 Performans / çevrimiçi akıcılık
- **Çizim çağrısı (draw call) %74 azaldı:** her savaşçı ~72 ayrı mesh'ti (renk başına bir malzeme) → köşe renkli tek malzemede birleştirilince ~22 (`geo.mergeVC`; uzak savaşçıların silahı da `createWeapon(id, optic, lod=true)` ile sadeleşti, birinci şahıs silahı eskisi gibi). Harita da renk başına ~400 kova yerine düz malzemeli tüm kutuları köşe rengiyle **tek mesh'te** birleştiriyor (`MapBuilder.build`, yarım duyarlık köşe rengi; parlayan/saydam/özel malzemeler ayrı kalır). 10v10 Kasaba: 2010 → ~505 çizim çağrısı, toplam mesh 1855 → 539 (gölge geçişinde de aynı oranda). Ölçüm: `scripts/renderinfo.mjs`.
- **Anlık görüntü %42 küçüldü:** yavaş alanlar (`it`, skor, `mh`, `gl`, `zt`, `bs`, `zl`, `rv`) yalnızca değişince, 2 sn'de bir ve yeni katılımda/ayrılmada gönderilir (`protocol.slowSig`, `Room.snapshot`); istemci `it` yoksa onları değiştirmez. 10v10: 100 → 58 KB/sn aşağı yönde. Ölçüm: `scripts/snapsize.mjs`.
- **Akıcılık:** (1) Görüntü her karede yeniden hesaplanır: diğer oyuncular `interpolate(şimdi)` + `syncModel` kare başına, yerel kamera son iki sim adımı arasında ara değerlenir (`Game.lerpCamera`) → 60 Hz sabit sim, farklı yenileme hızı/kare dalgalanmasında adım sayısı 0/1/2 oynasa da takılma yok. (2) Tahmin düzeltmeleri (≈0.1 m) artık kamerada ~0.1 sn'de yumuşatılır (`NetClient.viewOff`), 0.8 m üstü (ışınlanma vb.) anında. (3) **Otomatik çözünürlük** (`Game.perfTick`, Ayarlar → "Otomatik çözünürlük", varsayılan açık): ortalama kare süresi > 25 ms ise piksel oranı kademeli düşer (en az 0.6), < 13.5 ms ise seçilen kaliteye geri çıkar. Çevrimiçi rozet FPS'i de gösterir.
- Ağ testi aracı: `scripts/netproxy.mjs` (gecikme/titreşim ekleyen vekil) + `scripts/netlag.mjs` (düzeltme sayısı, kamera sıçraması, adım süresi). Sunucu CPU: 24 oda ≈ tek çekirdeğin %18'i (`serverprof.mjs`), VPS boşta (yük 0.09).

### 12.33 Maç kurucu yeniden tasarımı (Özel Oyun + Oda Kur)
- Tek ortak `builderHTML(cfg, online)` (menu.js): **1 Mod → 2 Harita → 3 Ayarlar** sırası (Oda kurarken önce "Oda": ad, şifre, görünürlük). Mod büyük kartlarla seçilir (simge, etiket, açıklama); harita listesi seçilen moda göre süzülür (Enfekte → yalnızca New York); ayarlar kartlar halinde (oyuncu sayısı, süre, mod sınırı, botlar/zorluk, takım, hava, gün saati, kamera). Harita "gece zorunlu" ise (`MAPS[..].forceTod`) gün saati yerine not gösterilir.
- Sağda **canlı özet paneli** (harita görseli, mod, oyuncu, süre, sınır, botlar, gün saati, hava, kamera) ve her zaman görünür **Oyna / Odayı oluştur** düğmesi; en üstte yapışkan adım çubuğu (kaydırınca bulunduğun bölüm vurgulanır, tıklayınca o bölüme kayar). Mod seçince harita adımına, harita seçince ayarlara otomatik kayar. Dar ekranda (<1180 px) özet gizlenir, alta yapışkan Oyna çubuğu çıkar.
- Eylem adları değişmedi (yerel: `type/map/size/...`, oda: `olset`). Test: `scripts/menuflow.mjs` (akış + doğru maçın başlaması), `scripts/menubuilder.mjs` (ekran görüntüleri).

### 12.34 Oyun içi sohbet (çevrimiçi) + 3. şahıs/Ctrl+W düzeltmeleri
- **Sohbet** (`src/game/chat.js`, sunucu `Room.chat`): `Enter` herkese, `Shift+Enter` takıma; yazarken `Tab` kanal değiştirir, `Enter` gönderir, `Esc` iptal eder. Tuş "Kontroller" menüsünden değiştirilebilir (`chat`). Yalnızca çevrimiçi odalarda; ölüm maçı / silah yarışında takım kanalı yok (hep herkese).
- Yazarken oyun tuşları çalışmaz (olaylar kutudan çıkmaz), bakış donar, ateş/nişan bırakılır. Mesajlar kutu kapalıyken 9 sn sonra solar, açıkken tüm geçmiş (60 mesaj) görünür.
- **Sunucu güvenliği:** metin string olmalı; kontrol + biçim karakterleri (`\p{Cc}\p{Cf}`: sıfır genişlik, yön değiştirme) atılır, boşluklar teke iner, 120 karaktere kesilir; oyuncu başına 6 sn'de en çok 4 mesaj (aşınca yalnızca gönderene uyarı); istemci `textContent` ile yazar, HTML çalışmaz. Katılma/ayrılma sistem mesajı olarak yayılır. Test: `scripts/chattest.mjs` (protokol), `scripts/chatui.mjs` (iki tarayıcı).
- **3. şahıs akıcılığı:** yerel karakter modeli de kamerayla aynı alpha ile enterpole edilir (`game.js` loop); 144 Hz'de karakter–kamera sapması 2,14 cm → 0,01 cm. Ölçüm scriptleri `netthird/netcam/netanim`.
- **Ctrl+W koruması:** fare kilitlenince tam ekran + Keyboard Lock, maç sürerken `beforeunload` onayı; Ayarlar → "Tam ekran + Ctrl+W koruması" ile kapatılır. Test: `scripts/keylocktest.mjs`.

### 12.35 Doğma koruması görünür + ateşle biter ("mermiler içinden geçiyor" şikâyeti)
- Resmi odalarda botlar sürekli doğar; doğan savaşçı 3 sn vurulamazdı ve **görsel ipucu yoktu**, üstelik bu sürede ateş edebiliyordu (5 dk'lık botlu maçta canlı süresinin ~%7'si korumada, koruma altında 180–740 mermi atılıyordu). Oyuncu için bu "mermi rakibin içinden geçiyor" gibi görünür.
- Düzeltme: koruma 3 → **2 sn**; **ateş eden savaşçının koruması hemen biter**; korumalı savaşçının çevresinde **mavi, atan yarı saydam kalkan** görünür (ağdan `F_PROT` bayrağı, `Soldier._shield`). Test: `scripts/protshot.mjs`. İsabet tanısı için `scripts/netbullet.mjs` (gerçek istemci + gecikme, sunucu isabeti/ istemci tahmini).
- Sunucu adım süresi 16v16'da ort. 0,44 ms (bütçe 16,7 ms): sunucu yükü sorun değil; geri sarma (lag comp) mantığı tutarlı.

### 12.36 Çöl Geçidi (yeni harita)
- **Kaynak:** yapı, klasik bir çöl haritasının radar şemasından **otomatik çıkarılır**: `tools/dust2_extract.py` (girdi `tools_ref/dust2_radar_ref.png`, depoda YOK / `.gitignore`) → `src/maps/colgecidiData.js` (duvar dikdörtgenleri, kutu/araç bileşenleri, 1 m yükseklik ızgarası, doğuş ve saha bölgeleri, cephe yüzü koşuları). Oyuna çeviren: `src/maps/colgecidi.js`; sanat: `src/maps/colgecidiArt.js`. Radar 90° döner (T = Batı −x, CT = Doğu +x; B sahası KD, A sahası GD), ölçek 1,3×: oynanabilir alan ≈ 142×132 m, sınırlar ±75×±70.
- **Çıkarım adımları:** kenar/duvar çizgileri → katı hücre (0,5 m) → açgözlü dikdörtgenler; kısa çizgiler (basamak/tarama deseni) duvar sayılmaz; ince açık çizgiler zemin izi (çarpışmasız, kullanılmıyor); radar çizgilerinin kapattığı geçitler için **bağlantı onarımı** (en ucuz yoldan kapı açar) + `OVERRIDE_CARVE` ile elle geçit (CT avlusu).
- **Sanat:** her duvar yüzü için sıva rengi (8 palet), kaide, korniş, kiriş uçları, pencere (yanık olanlar gece parlar), mavi/kahve/yeşil kapı, tente, dikme; kutular → sandık (köşe direkli) / fıçı / konteyner (nervürlü); çatılı tüneller (alt + üst), 10 hurma, sokak üstü flama iplikleri, çevre silüeti (evler, minareler, kubbeler, su depoları, kum tepeleri) + sonsuz kum zemin; zemin: duvar dibi gölgesi, yükseklik tonu, saha karoları; minimap kum/koyu duvar renkleri (`map.mini`).
- **Adillik (tarafsız):** harita asimetrik (CT'nin A'sı 24 m, T'ninki 143 m). Çözümler: `sideSwap` → her maç mavi/kırmızı doğuş tarafları yer değiştirir (sunucu seçer, istemciler `cfg.swap` ile uygular; ilk maç rastgele, sonrakiler sırayla); Ele Geçirme bayrakları iki doğuştan adil mesafede (Uzun A, Orta, Alt Tüneller; A ve B sahaları bayrak değil); botlar takım çatışmasında `map.roamPoints` hat noktalarına da gider; bot hedefi duvar içindeyse en yakın serbest noktaya alınır (`BotBrain.setGoal`).
- **Ölçümler:** Kasaba'dan hafif (401k üçgen, ~510 çizim çağrısı). Görüş hattı: medyan 35 m, %99 ≤ 80 m (en uzun 116 m: T avlusundan orta). Bot simülasyonu: Ele Geçirme dengeli (3/3, 4/2); TDM'de T tarafı ≈ %75 kazanır (botlar için yapısal avantaj; insanlarda farklı olabilir, taraflar sırayla değiştiği için maç başına değil seri başına adil).
- **Test/araçlar:** `cgaudit` (erişim, kopuk cepler, yol uzunluğu; `VIZ=1` nav görüntüsü), `cgdist` (iki doğuştan mesafe farkı), `cgsim` (bot maçları, taraf bazlı), `cgkills`, `cgmodes` (tüm modlar), `cgnet` (çevrimiçi taraf tutarlılığı), `cgsight`, `cgshots`/`cgtour`/`cghud`/`cgthumb` (görüntüler). Resmî oda: **#5 Çöl Geçidi TDM 8v8** (gündüz / gün batımı).

### 12.37 Çöl Geçidi v2 (yön + bağlantı düzeltmeleri)
- Kullanıcı geri bildirimi: "Dust 2'ye benzemiyor, çıkmaz sokaklar, çok karışık". Teşhis (`scripts/cglinks.mjs`): radardaki yumuşak GÖLGE bantları (rampa / basamak kenarı gradyanı) ve basamak çizgileri duvar sayılmıştı → A sahası rampaya, Outside Tunnels T avlusuna, spiral merdiven alt/üst tünellere kapalı kalmıştı (komşu bölge çiftlerinde yol / kuş uçuşu oranı 8–19×).
- Düzeltmeler (`tools/dust2_extract.py`): kalın koyu bantlar (≥ 11 px) duvar maskesinden çıkar; iç çizgiler yalnızca ince ise bölme duvarı (3 m); ince açık gri çizgiler (sahanlık kenarı) duvar DEĞİL; adlandırılmış komşu bölge çiftleri (`REQUIRED`) arasında yol yoksa en ucuz yoldan açılır (`route`); spiral ve CT avlusu elle (`OVERRIDE_CARVE`).
- **Yön standart** (radar gibi): T güney, CT kuzey, A doğu, B batı. Bölge adları (`CALLOUTS`, 41 yer: Long, Mid, Xbox, Pit, Window …) HUD'da minimap altında ("ÇÖL GEÇİDİ · Long Corner") ve büyükleri minimap üstünde görünür.
- Yeni görsel: bina yükseklikleri 5,5–9 m (bölgelere göre), bölme duvarları 3 m, kapı çerçeveleri (Long/Mid/B Doors, tünel girişi), Long ve B'de araba, mavi konteyner, A / B saha tabelaları, duvar reklamları, uydu çanakları, elektrik telleri, Long'da mavi-beyaz karo.
- `scripts/cglinks.mjs`: 41 komşu çift kontrolü (hepsi OK).

### 12.38 Geliştirici modu (uçuş)
- **Açma:** Özel Oyun → Ayarlar → "Geliştirici modu: Açık", ya da adresle `?autostart=6v6&map=colgecidi&dev=1`. Yalnızca çevrim dışı; herhangi bir haritada çalışır (eskiden yalnızca "Atölye" haritasında).
- **Davranış:** oyun uçuşla başlar, ölümsüz, maç bitmez, ekranda turuncu rozet. **L** uçuş aç/kapa · **W/A/S/D** + **Boşluk** yüksel / **Ctrl** alçal · **Shift** ×3 hız · **fare tekerleği** uçuş hızı (3–120 m/sn) · **N** botları dondur/aç · **O** ölümsüzlük · **P** konum (x, y, z) + en yakın bölge adı (konsola da yazar) · **J/K** silah değiştir.
- Test: `scripts/devfly.mjs` (uçuş, hız, N, P, L), `scripts/devmenu.mjs` (menüden açma).

### 12.39 Çöl Geçidi v3: gerçek katlı yapı (yükseklikler)
- **Tespit:** CS2 genel bakış görseli zemini yüksekliğe göre boyuyor; 5 düz renk = 5 kat (ölçülen): Mid Doors / CT Mid / Lower Tunnels **0 m** · Mid **0,9** · Long / Short / Outside Long / Outside Tunnels **1,9** · B Site **3,2** · A Site / Upper Tunnels / B Plat **4,6** · T Spawn **6,6**; aralarındaki gradyanlar rampa / merdiven. Önceki sürüm bu farkı 0–3,4 m'ye sıkıştırıp yumuşatıyordu (harita neredeyse düz kalıyordu).
- **Çıkarım:** parlaklıktan bağımsız ton oranı q = (r−b)/(r+g+b) (radarın duvar dibi gölgesi sahte tümsek yapmasın), duvar / kutu kenarı pikselleri dışarıda, 0,5 m ızgara, yumuşatma yok → kat sınırları keskin. Kat kenarları (komşu fark > 0,6 m) **taş istinat duvarı + üst şerit** olarak çizilir (`cliffs`, çarpışmalı). CT avlusu (taralı = üst kat altı) tek kotta düz.
- **Merdivenler:** radarda gradyanı görünmeyen (çatı altında kalan) merdivenler elle rampa (`OVERRIDE_RAMPS`: Upper→Outside Tunnels, Upper→B, CT→Short Stairs); diğer kopukluklar oyunun yol bulucusuna göre: `WRITE=1 node scripts/cglinks.mjs` kopuk çiftleri `tools/ramp_pairs.json`'a yazar, çıkarım yalnızca onlara rampa açar (CT Spawn→Elevator). 46 komşu çift kontrolü OK.
- Ölçüm: 529k üçgen (arazi 0,5 m), Kasaba'dan hafif. Görüntüler: `scripts/cgview.mjs` (bölge adıyla konum + bakış yönü).

### 12.40 Çöl Geçidi: Short köprüsü + CT Spawn + A sahası düzeltmesi
- Radardaki **taralı alan = CT Spawn'ın üstünden geçen Short köprüsü** (wiki: "CT'ler catwalk'un altındaki çatılı bölümde doğar"). Önceki sürüm bunu düz zemin yapmıştı → Short'tan A'ya bağlantı yoktu, yanlış bir CT→Short rampası vardı.
- Şimdi: Short merdiveni (1,9 → 4,6 m) → Short şeridi → **köprü tabliyesi** (`D.bridge`, 'plat' kutusu, iki yanda korkuluk, altta iki ayak) → A platosu (Ninja). Altında CT avlusu (zemin kotu), CT'ler köprünün altından doğu (Elevator) ve batıya (CT Mid) çıkar. Harita `layered` (yol bulma hücre başına zemin kotu tutar). Köprü ağızlarındaki radar çizgileri `OVERRIDE_CARVE`, köprü altına doğuş konmaz, `CT Spawn` bölge adı yeşil kutuya alındı.
- **A sahası:** bomba alanı çerçevesinin turuncu kenar pikselleri 6,6 m (T Spawn kotu) okunuyordu → A'da yükseltilmiş sahte halka. Turuncu / yeşil çerçeve haleleri yükseklik hesabından çıkarıldı. A platosu kenarlarına ~0,9 m alçak parapet (fotoğraftaki A Default / A Plat duvarı).
- Bilinen: yol bulma tek katlı olduğundan botlar köprünün ÜSTÜNÜ kullanır, ALTINDAN (CT → Elevator) geçemez, dolanır (127 m). Oyuncular her iki yoldan geçebilir.

### 12.41 Çöl Geçidi: CT kemeri + A önü düz duvarlar
- Kullanıcı (geliştirici modunda P ile): X 26.3 Z −38.6'daki duvar olmamalı; A'dan bakınca CT Spawn görünmeli; Short ile A arasında yıkık / basamaklı yer olmamalı.
- Köprünün doğu yüzü artık **ahşap kemerli geçit** (direkler, üst kiriş, kemer, kemer üstü duvar, köprü altında tavan kirişleri). Duvar `OVERRIDE_CARVE` ile açıldı; A önündeki kemer avlusu, A platosu ve A Default platformu dikdörtgen kotlarla (`OVERRIDE_LEVELS`, yeni `xramp`) yeniden yapıldı → kenarlar düz istinat duvarı. Avlu doğuda Long / A Ramp kotuna yükselir (A'ya oradan çıkılır).
- CT doğuşlarının yarısı kemer avlusunda (botlar köprü altını yol bulmada göremediği için A'ya buradan çıkarlar). Yanlışlıkla eklenen avlu→A rampaları kaldırıldı (`ramp_pairs.json` boş).

### 12.42 Çöl Geçidi: Short batı duvarı, sahte sütun / duvar temizliği, A kuzeyi açıldı
- Kullanıcı: köprünün batı korkuluğu (X 15 Z −41.3) yukarı büyüsün, Short'tan CT görünmesin; Short → A yolu A ile aynı kotta olsun, bir yerde duvar hatası var; X 29 Z −42.4'teki iki sütun kalksın.
- Köprü batı yüzü tabliyeden 11,5 m'ye kadar dolu duvar (altı açık: CT ↔ kemer geçidi; CT tarafında ahşap lento). Doğu korkuluğu yalnız avlunun üstünde (z > −47), kuzeyde A yoluna geçiş açık.
- Radar hataları `OVERRIDE_CARVE` ile temizlendi: avludaki iki sahte sütun; Short merdiven rampasının ortasındaki duvar parçası; Short tepesindeki kasanın 12 m duvar olması (artık `EXTRA_BOXES` kasası); **A platosu kuzeyi (Ninja)**: fıçı / kasa gölgeleri bina kütlesine karışıp 6 m'lik şeridi gömmüştü (yoldaki 14 m'lik ince duvar dahil) → z −59,4'e kadar açık, düz 4,6 m, fıçı kümeleri `EXTRA_BOXES`'ta. Köprü altı tamamı CT kotunda (1 m'lik basamak kalktı).
- Yeni araçlar: `scripts/cgwalk.mjs` (fizikle W yürüyüşü, takılma + y izi), `scripts/cgplot_dump.mjs` (bölge üstten görünüm verisi); `cgview` 7. alan mutlak y.
- Short merdiveni → Short → köprü → A kuzeyi → A sahası ve CT → kemer → avlu → Ramp → A yürüyüşleri takılmasız, hep 4,6 m (A kotu).

### 12.43 Çöl Geçidi: A korkuluğu, A kutusu, CT köprü altı, ahşap kapılar (mermi geçer), kapalı tünel tavanı
- A yolu ile avlu arasındaki korkuluk boşluğu (X 23–29, Z −47) kapandı (kemer üstüne kadar).
- A sahası kutuları en çok 1,2 m: ayaktayken arkasından Short görünür, çömelince siper.
- Köprü altının kuzey yarısı (ayaklara hizalı, Z −42,65'e kadar) dolu duvar; CT ↔ kemer geçidi yalnız ayakların güneyinde.
- **Ahşap çift kanatlı kapılar** (Long / Mid / B Doors, `woodDoor`): bir kanat kapalı, biri duvara yaslı açık; çarpışma sunucuda da var. Etiket `'wood'` → `World.raycast(..., skipTag)` ile mermi geçer, kapıdan geçen mermi %35 zayıflar (kıvılcım + iz). Botların görüşü (`clear`) kapıdan geçmez. Kapı yeri en az 2,8 m geçitte aranır.
- Tünel tavanı: 0,5 m hücreli, altı zeminden 3,5 m, üstü bölge boyunca düz → boşluksuz kapalı tavan (eski 2 m karolar + kirişler basamaklı / delikliydi).

### 12.44 Çöl Geçidi: Mid catwalk, T Spawn yokuşu, Pit alçak duvarı, havada süs, A ve B düz kotlar
- **Mid catwalk** (X −1,3…3,6, Z −8,5…7,5): 2,6 m düz şerit, batı kenarı taş istinat duvarı boyunca; güneyde Top Mid'den, kuzeyde Short'a rampa; Xbox'ın güneyinde Mid → catwalk çıkışı (Xbox ↔ Short).
- **T Spawn doğusu**: gölgeden çıkmış iki bina şeridi kaldırıldı; avludan (6,6 m) doğuya 1,9 m'ye düz yokuş.
- **Pit ↔ Side Pit**: kalın bina duvarı yerine Side Pit tarafında 0,7 m alçak taş duvar (`colgecidi.js`).
- **Havada süs**: `decorateFaces` her yüzde arkadaki duvar kutusunun tepesini okur; korniş / kiriş ucu / pencere / dikme duvar tepesini aşmaz, duvar yoksa süs yok.
- **A**: A ↔ A Ramp kenarı düz kot + tek eğim (iç içe kırık duvar parçaları gitti). **B**: B Plat 4,6, saha 3,4 düz; Plat → saha geniş iniş, sahadan güneye rampa; turuncu saha çizgisinden doğan sahte duvarlar kesildi.

### 12.45 Çöl Geçidi: CT kuzey cebi kapandı, köprü altı yeniden açık
- Kullanıcı düzeltmesi: kapatılması istenen yer köprü altı değil, köprünün batısındaki CT kuzey cebi (kapılı bina önü, X 6,5–15, Z −51,6…−42,65). Burası bina kütlesi oldu; güney yüzü köprü ayağına hizalı (kaide, korniş, iki pencere). Köprü altı ve kemer eskisi gibi tam açık.

### 12.46 Çöl Geçidi: gerçek kapılar (Mid / B / Long), duvar üstüne duvar yok, Pit tek duvar, B tek kotlu avlu
- Kullanıcı: "kapı" dediği radardaki sütunlar (açık kanat çizgileri duvara dönmüştü). Yerlerine `gateDoor`: koridoru kesen alçak duvar (5,6 m) + taş dikmeler + lento + lento üstü duvar + iki ahşap kanat (menteşeden 22–28° ve 66–70° açık, ortada ~1,6 m geçit). Kanat çarpışması döndürülmüş kutunun AABB'si, etiket `'wood'` (mermi geçer). Konumlar `colgecidi.js` `GATES` (Mid z −21,4 · B x −36,5 · Long z 7,6); radar kanat çizgileri `OVERRIDE_CARVE` ile kesildi.
- Duvar üstüne duvar: A platosu parapeti artık istinat duvarının kendisi (tek kutu, ~0,95 m yukarı uzar, tek kenar şeridi). Pit ↔ Side Pit kenarları atlanır; yerine baştan sona (z 7,2–25,3) tek alçak taş duvar.
- B: saha + kapı önü + doğu çıkıntısı + arka duvar önü tek kot (1,9 m); B Plat / Back Plat 2,9 m, sahaya 5 m'lik iniş. Eski 3,4 / 4,6 m katlar ve rampalar kaldırıldı.

### 12.47 Çöl Geçidi: yapı üretimi baştan (tek tip, düzgün kenarlı binalar)
- Kullanıcı: iç içe duvarlar, sonradan eklenmiş yamalar, havada tahtalar, basamaklı duvarlar istemiyor; "gerekirse baştan yap, tek yapı tipinde".
- **Binalar** (`dust2_extract.py` "BİNA KÜTLELERİ"): katı maske temizlenir (1 hücrelik çentik / çıkıntı / köşegen temas), 16 m'lik bloklara bölünür; her parçanın kenar çizgisi izlenip sadeleştirilir (0,45 m tolerans; blok sınırı köşeleri sabit). Çıktı: `polys` (görsel çokgen, tek tepe kotu = çevre zemin + 6 m, bloğa göre ±0–1 m), `rects` (aynı çokgenin 0,25 m'lik çarpışma dikdörtgenleri), `fedges` (dışı yürünebilir sokağa bakan kenarlar). JS: `buildPolys` (duvar + çatı, tek parça), `decorateEdges` (kaide, korniş, duvar tepesi, kiriş uçları, pencere / kapı / tente — hepsi kenara yapışık, yükseklik duvar tepesine göre). Eski 0,5 m dikdörtgen duvarlar, 12 m'lik blok yükseklikleri, yüz başına sıva katmanları kaldırıldı.
- **Kat kenarları**: birim parçalar zincirlenip (x, z, üst kot) uzayında sadeleşir (`cliffv`, 0,4 m) → tek düz / çapraz istinat duvarı, rampa kenarında eğik tepe; düz gölge normalleri. Çarpışma ızgara parçalarıyla (`cliffs`, görünmez). Yürünemeyecek dik eğimler (> 0,9) en yakın kata oturtulur (testere dişi zemin yok). Zemin ağı köşeleri yükseklik ızgarasıyla hizalandı (kayık ağ her kenarı 1 m'lik eğime yayıyordu).
- **Tüneller**: Upper Tunnels / Outside Tunnels düz kot, aradaki merdiven radardaki açıklıkta tek rampa; spiral iki rampa + sahanlık; tavan bölge başına tek düz kot.
- **Long Doors** kapısı T tarafına (Outside Long → Long koridoru, z 22,4) taşındı; Outside Tunnels'taki kapısız çerçeve kaldırıldı.

### 12.48 Çöl Geçidi: kullanıcı turu düzeltmeleri (B Plat, pencere, Pit, Titanic, kapılar, kasalar, süs çakışması)
- **B Plat / Back Plat** tek kot (2,9), güney kenarı temiz; dar sırt / hendek temizliği (1–2 hücrelik radar çizgisi kotları komşu kata oturur); `OVERRIDE_LEVELS` ızgara dışına taşan dikdörtgen kırpılır (negatif indis dilimi boşaltıyordu).
- **Bina içi kot eşitleme**: binanın içindeki yükseklik noktaları en yakın sokak kotunu alır → bina diplerinde sahte kat kenarı / alçak duvar yok. Cephe kaidesi artık çıkıntısız renk bandı.
- **B penceresi** (B sahası ↔ Window, x −36, z −47,5): `'hard'` oyma (radarda siyah olsa da açar), pencere altı / üstü bina renginde (`polyColorAt`), ahşap kasa; B tarafında 3 sandık, Window tarafında kum yığını (`SAND_PILES`).
- **Kapılar**: kaide şeridi kapı açıklığından geçmiyor; kanat çarpışması kanat şeklinde (`obbCollide`); Long Doors iki kapı (z 7,6 iç, kanatlar Long'a açılır · z 22,4 T tarafı) + aradaki oda çatılı ve düz; B Doors altı düz.
- **CT**: kuzey cebi `OVERRIDE_FILL` ile bina hattında (tek tip); köprü güney ağzındaki kolon kaldırıldı; köprü altının kuzey ucu kemer direğine hizalı duvar.
- **Pit** taban −1,2 m (veri `hoff` −2, `hscale` 25 → −2…8,2 m; `terrain.deepWater` kapalı), Long Corner'dan dik iniş; doğu sahanlığı 2,9 m (Long'dan 1 m). **Titanic** kenarındaki sahte bina kaldırıldı → T'den Outside Tunnels'a atlanır. **T Spawn rampası** kuzey kenarı düz bina duvarı.
- **Tüneller**: Outside Tunnels merdiveninin üstü çatılı, Upper Tunnels kalın bloğu ince kolon, B Tunnels çıkışı duvardan duvara tek rampa.
- **Xbox**: Mid → catwalk 3 sandıkla sıçranarak (rampa kaldırıldı; botlar Short'a dolaşarak gider).
- **Kasalar**: döndürülmüş kasa çarpışması n×n alt kutu (eski tek AABB kasadan çok büyüktü); iç içe kasalar yığılır / atılır; binaya giren kasalar dışarı itilir (16) ya da atılır (5).
- **Süs çakışması**: cephe süsü en son kurulur; önü dolu (başka bina, kapı, çatı, köprü, kat kenarı, sandık, yükselen zemin) dilime kaide / pencere / kapı / tente / pano / tabela konmaz (`frontBlocked`), süsler birbirine binmez (`OCC`).

### 12.49 Çöl Geçidi: sistematik tarama + kök neden düzeltmeleri (kat kenarı, süs, kasa, Pit, köprü)
- **Yöntem**: `scripts/cgsweep.mjs` (yürünebilir noktalardan 4 yöne kare, SPACING m aralık) → `scripts/cgsheets.py` / `cgregions.py` (etiketli kontak sayfaları, bölge gruplu) → alt ajanlar bölge bölge inceler. İki tam tur (138 + 93 nokta) yapıldı; ikinci turda ağır hata sayısı 0.
- **Kat kenarları** (`dust2_extract.py`): zincirleme + `CL` 0,3; her duvar parçasının tepesi DÜZ (parçadaki en yüksek üst kot); çarpışma = görsel; 0,9 m altı basamaklar yalnız ≥ 3 m ve eksene hizalıysa duvar olur (çapraz / kısa şeritler zemine yatmış levha gibi görünüyordu). Alçak basamak duvarı kum rengi, üst şeritsiz. Zemin rengi: yalnız eğim > 1,5'te taş tonu.
- **Pit**: özel kutu yerine standart istinat duvarı + 0,7 m korkuluk (`extra()`); çarpışma/görsel aynı yükseklik.
- **Süs** (`decorateEdges`): kaide şeridi (çıkıntı) kaldırıldı; hangings (ip/flama) ve tenteler kaldırıldı; pencere/kapı/pano duvar ucundan ≥ 1,35–2,7 m içeride; çatılı tüneller, Long odası ve kapı çevresi `NODECOR` (süs yok); varil bandı halka.
- **Binalar**: bileşen başına tek tepe kotu (karo sınırında dikiş yok), bileşen başına tek renk.
- **Kasalar**: bina/kat kenarı/kasa-kasa çakışması çözülür (1 m'lik pay 0,2 m); `obbCollide`.
- **Köprü** yeniden yazıldı (tek yapı: batı duvarı, 1,7 m doğu korkuluğu, orta ayaklar, kuzey ucu dolu, doğu yüzünde dikdörtgen ahşap çerçeve).
- **B doğu duvarı** tek temiz duvar (`OVERRIDE_CARVE 'hard'` + `OVERRIDE_FILL`), çerçevesiz düz pencere açıklığı; Window tarafında kum yığını.
- Bilinen: Xbox ↔ Short botlar için dolambaçlı (catwalk'a 3 sandıkla çıkış yalnız oyuncu); CT Spawn ↔ Elevator botlar için uzun.

### 12.50 Çöl Geçidi: köprü / kemer ince ayarı
- Kullanıcı fotoğraf+not yöntemi: kemerin kuzey yarısı CT'deki kolona kadar dolu duvar (`COL_N` = −43,35, kolonun kuzey yüzü; ön yüz ahşap çerçeveyle aynı hizada, üst üste binmez); kemerin güney direği ile güney bina arasındaki yarık kapatıldı; köprünün batı duvarı yarıya indi (tabliyeden 6,9 → 3,4 m: göz hizası 1,6 m, Short'tan gelen üstünden görünür).

### 12.51 Çöl Geçidi: köprü altı boş, kemer cephe duvarı, doğu korkuluk alçak
- Köprü altı yeniden tamamen boş (kolon arası + kuzeyi dolgu kaldırıldı). Kemerin kuzey yarısı yalnız ince cephe duvarı (x 22,83–23,28, ahşap çerçeveyle aynı hizada, z −52,2 … −43,35 = CT'deki kolonun kuzey yüzü), tabliye altına kadar.
- Köprünün doğu korkuluğu 1,7 → 0,95 m (A platosu parapetiyle aynı yükseklik). Batı duvarı tabliyeden 3,4 m.

### 12.52 Çöl Geçidi: T çıkışı açıldı
- T rampasının kuzey ucundaki ince bina şeridi (`OVERRIDE_FILL` [−10, 52, 5, 52.7]) kaldırıldı: Suicide sokağının girişini kapatıyordu. Artık T Spawn'dan Top Mid / Mid / Mid Doors'a görüş hattı açık (x −8…−6, 83 m; `scripts/cglos.mjs` ile ölçülür).

### 12.53 Çöl Geçidi: T Spawn platosu ve rampası
- T platosu (x −31…−5, z 52,5…66,6) tek düz kot 6,6 m (çıkıntı / kırık parça yok). Rampa 16 m'ye uzatıldı (x −5…11; 4,7 m düşüş, ~16°; eskiden 12 m / 21°). Kuzey kenarındaki duvar rampa alçaldıkça basamak basamak iner: genel kural — kat kenarı zinciri üst kot aralığı 0,6 m'yi aşınca bölünür (tüm haritada).
- Mid'e bakan kenar (x −11,5…−4,5, z ≈ 52,4) platodan 0,8 m yüksek korkuluk: çömelince arkasından nişan alınır, ayakta üstünden görünür; T → Mid Doors görüş hattı hâlâ açık.

### 12.54 Çöl Geçidi: T rampasının güney nişleri rampaya katıldı
- Rampanın güneyindeki (z 66,6–71,2) yan nişler ve onları ayıran taş basamaklı kenar (saklanma yeri) kaldırıldı: `OVERRIDE_CARVE` [−2,8, 66,2, 13,1, 71,2] + rampa seviyesi z 71,2'ye (bina duvarı) kadar uzatıldı. Kum aynı eğimle bina duvarına kadar iner; yalnız kuzey kenar (Mid'e bakan taraf) basamaklı alçalan duvar ve korkuluk.

### 12.55 Çöl Geçidi: çevre duvarı (harita dışına çıkış kapandı)
- Radar kapsamının dışı (arazi ±70 × ±76 sınırına kadar uzanır) açıktı: güney kenar boyunca ve doğuda 1500+ erişilebilir hücre. Dört kenara tek parça 16 m çevre duvarı eklendi (güney kenar T Spawn'ın güney binası hizasında, 1 m içeriden). `scripts/cgleak.mjs` yürünebilir alanın kapsam dışına taşmasını denetler (sonuç: 0).

### 12.56 Çöl Geçidi: Outside Tunnels merdiveni
- Outside Tunnels → Upper Tunnels merdiveni (x −62…−34, z 12…18,5) koridorun tam genişliğinde tek rampa; yan platformlar / uçurum kenarları / taş basamaklar kalktı. Giriş ortasındaki 1×1 m, 11 m yüksekliğinde dikme ve arkasındaki uzun bölme duvarı (x −49,95…−48,1, z −2…10,3) `OVERRIDE_CARVE` ile silindi.

### 12.57 Çöl Geçidi: kat kenarı poligonu sadeleşti (Titanic)
- Kat kenarı zincirleri artık 0,5 m toleransla sadeleşir ve 1,2 m'den kısa kenarlar komşusuna katılır (görsel duvar 92 → 68 parça; 1,3 m altı parça 35 → 8). Diyagonal kenarlardaki basamaklı köşeler ve ince "sütun" gibi duran kısa parçalar gitti. Çarpışma birim parçalardan gelmeye devam eder (görünmez).

### 12.58 Çöl Geçidi: Titanic kolonu ve duvara gömülü kasa
- Titanic yanındaki serbest duran 1,5×5,5 m, 11,7 m yüksekliğindeki kolon (x −52,8…−51,3, z 37…42,6) `OVERRIDE_CARVE` ile silindi. Yamaca gömülü büyük kasa (−46,05, 38,55) `REMOVE_BOXES` ile kaldırıldı (elle kasa silme listesi).

### 12.59 Çöl Geçidi: Upper Tunnels çatısı kuzeye uzatıldı
- Upper Tunnels çatı bölgesi kuzeye z −9,5'ten −13,6'ya uzatıldı (aynı çatı, ayrı yama yok): yürünebilir alan bu kadar kuzeye uzanıyordu ve tepesi açıktı. `scripts/cgsky.mjs x0 z0 x1 z1` yürünebilir hücrelerin tepesinin açık olup olmadığını ölçer (bölge: 0 açık).

### 12.60 Çöl Geçidi: spiral çatısı, çatı birleşim paneli
- Spiral merdiven (Upper → Lower Tunnels, x −37…−26, z −10,5…−1) çatısızdı (tepesi gökyüzüne açık, çatıya çıkılabiliyordu): aynı düz çatı (7,9 m, Upper ile aynı kot) bölgesi eklendi. Spiral çatısı (7,9) ile Lower Tunnels çatısı (4,3) birleşiminde ince dikey çatı paneli (z −10,45, x −32…−24,5, y 4,5…8,0). `scripts/cgsky2.mjs`: 8 yön × 3 eğimle yürünebilir hücrelerden gökyüzü sızıntısı ölçer (tünel bölgeleri: 0). Bilinen açık uçlar: Outside Tunnels merdiveni üstü (z 13) ve B tüneli çıkışı (z −27) — bilerek.

### 12.61 Çöl Geçidi: Lower Tunnels ağzı (Mid tarafı) üstü kapalı
- Lower Tunnels'ın Mid'e açılan ağzı (x −11…−9,3, z −15,95…−12,35) üstü açıktı: iki bina arasında gökyüzü görünüyordu. Güneydeki yüksek bina (7,5 m) ağzın üstünden kuzeydeki binaya uzatıldı (alt 4,05 m = çatı altı; geçit açık). Aynı duvar rengi (`polyColorAt`), çatı tonu, korniş ve tepe şeridi; çarpışma sunucuda da.

### 12.62 Çöl Geçidi: spiral rampası duvardan duvara
- Spiral rampa (Upper → Lower Tunnels, z −12,5…−1,5) x −31,5…−27,5 ile bitiyor, doğu duvarı −26'da başlıyordu: arada ~1,3 m'lik alçak şerit + taş kenar (insan girebilen boşluk). Rampa / sahanlık x −25,9'a kadar genişletildi → kenar duvarı ve boşluk yok.

### 12.63 Çöl Geçidi: Xbox / Short koridoru girişi
- Xbox yanındaki kum rampası ve kesik duvar parçaları (0,7 / 2,0 m) kaldırıldı: Mid kotu (0) x −1,78'e, koridor kotu (1,9) x −1,28'den doğuya; arada **tek düz istinat duvarı** (x −1,53, tepe 2,6 m catwalk duvarıyla aynı: `SMOOTH_TOP` bölgesinde zincir tek parça, tepe kotu eşit). Duvar önünde 1,5 m'lik kısa parça bina kütlesine katıldı (sütun gibi duruyordu).
- Radardaki rastgele Xbox kasası kaldırıldı (`REMOVE_BOXES`). Yerine CS2'deki gibi duvar dibinde düzgün yığın (`crates()`): iki taban kasa duvara bitişik (x −2,35; z −13,95 / −12,75), üstte bir kasa ikisine yaslanır (z −13,35), önde bir basamak kasa (x −3,55). Tepe 1,8 m, koridor 1,9 m. Catwalk girişi (z −10,7) aynı düzende. Sıçrama yüksekliği ≈ 0,93 m (JUMP_SPEED 5,4, GRAV 15): her adım ≤ 0,9 m.
- `scripts/cgjump.mjs`: W + Boşluk ile sıçrayarak hedefe ulaşma testi (negatif kontrol: kasasız satırda duvarı aşamaz).

### 12.64 Çöl Geçidi: zemin fiziği çizilen ağla aynı üçgenlemeye geçti; Xbox kasaları; Pit cebi
- **Kök hata** ("Pit'te kuma girebiliyorum"): `Terrain.heightAt` çift doğrusal (bilinear) enterpolasyon kullanıyordu, çizilen ağ ise hücre başına iki DÜZ üçgendi. Keskin kat kenarı köşe hücrelerinde ikisi arasında **1,25 m'ye varan fark** (>0,15 m: 4500+ örnek) → oyuncunun ayağı görünen kuma gömülüyor / havada kalıyordu. `colgecidi.js: terrain.tri = true` → `heightAt` üçgen enterpolasyonu (ağla aynı köşegen kuralı); diğer haritalar etkilenmez. Tüm testler / yürüyüşler / sıçramalar yeniden geçti.
- **Pit güneydoğu cebi** (x 58,5–62,5, z 23–27,3): Pit tabanının dışına taşan kum tümseği `OVERRIDE_FILL` ile bina kütlesine katıldı (Pit doğu duvarı z 27'ye kadar düz).
- **Xbox kasa yığını** 4 → 2 kasa (üst üste: taban + yarım kaydırılmış üst); sıçrayarak Short'a çıkış cgjump ile doğrulandı.

### 12.65 Çöl Geçidi: kasa boyutları, P konum etiketine uçuş durumu
- Xbox ve catwalk girişlerinde yığın = 2 kasa: alttaki büyük (1,5 m), üstteki küçük (1,0 m, duvara yakın tarafa kaydırılmış). `crates(list, g)` artık `[x, z, kat, boyut]` alır. Sıçrama (cgjump) 3 farklı z için doğrulandı.
- Pit'te "kuma girebiliyorum" şikâyeti: çizilen arazi ağı ile oyun fiziği arasındaki fark gerçek ağ üzerinde ölçüldü (`scripts/cgmesh.mjs`, Pit: 0,00001 m) ve yürünebilir noktalarda engel içinde durma yok (`cgsink`). Geliştirici modunda varsayılan UÇUŞ açıktır (çarpışma yok): P etiketi artık "UÇUŞ AÇIK (çarpışma yok)" / "yürüyorsun" yazar. `scripts/cgcover.mjs`: görünen kat kenarı duvarlarının çarpışması var mı denetler.

### 12.66 Çöl Geçidi: sınır dışı kum düzlemi Pit tabanını örtüyordu
- Kullanıcı: Pit'te zemin doğru ama üstü kum dokusuyla kaplı, içine giriliyor. Sebep: `buildSurround` sınır dışı sonsuz kum kutusunun tepesi y = +0,2 idi; Pit tabanı −1,2 (ve kuzey rampanın alt kısmı) bu düzlemin ALTINDA kalıyordu → düz kum yüzeyi tabanı örtüyor, oyuncu "kumun içinde" görünüyordu. Düzlem tepesi −2,5'e indirildi (en alçak zemin −1,2). Yalnız görsel; fizik değişmedi.
- Canlı kontrol: warbyte.site / www / IP aynı paketi sunuyor (cf-cache-status DYNAMIC, no-cache); canlı siteden çekilen kareler yerel ile aynı.

### 12.67 Oyun içi Ayarlar ve Kontroller (Esc menüsü)
- Duraklatma menüsüne **Ayarlar** ve **Kontroller** düğmeleri (`src/game/ingameSettings.js`). Ana menüdeki iki ekranın tamamı: hassasiyet, görüş açısı, ana / efekt / müzik / ortam sesi, yağmur sesi, grafik kalitesi, gölgeler, otomatik çözünürlük, tam ekran + Ctrl+W koruması; silahı tutan el, nişan alma (basılı tut / aç-kapa), tüm tuş atamaları (2 yuva, Geri tuşu temizler, Esc vazgeçer, çakışan tuş öbür eylemden alınır), varsayılana dön.
- Değişiklikler maç sırasında anında uygulanır (renderer piksel oranı, gölge haritası + malzeme yenileme, ses yolları, müzik, `game.binds` yerinde güncellenir — oyuncu aynı nesneyi okur) ve `opts.onPref` → `patchPrefs` ile tercihlere kaydedilir (ana menüde de görünür). Panel açıkken oyun kısayolları çalışmaz; Esc paneli kapatır, duraklatma menüsünde kalır; Devam'a basınca kapanır.
- Test: `scripts/igstest.mjs` (13 kontrol: panel, FOV / hassasiyet / ses / gölge / kalite uygulanıyor, kayıt, kamera FOV, tuş atama + kayıt, sol el, varsayılana dön, Esc).

### 12.68 Çöl Geçidi: B penceresi arka köşeye taşındı
- B sahası doğu duvarındaki çerçevesiz açıklık (pencere) B kapısı yakınından (z −49…−46,2) duvarın arka köşesine (z −57,4…−54,6) taşındı; arkası Window sokağına bağlanan dar cep. B tarafındaki 3 kasa ve Window tarafındaki kum yığını da taşındı; iki yönde sıçrayarak geçiş cgjump ile doğrulandı. Catwalk girişindeki iki kasa da kaldırıldı (12.67 sonrası).

### 12.69 Çöl Geçidi: Window cebi kenar basamağı
- B sahasının düz kotu (1,9) duvarın arkasındaki Window cebine taşıyordu → cep sokaktan (1,3) yüksek, aralarında x −34 boyunca 0,6–0,9 m'lik kenar basamağı (kullanıcı: "tam önümde çıkıntı"). B kotu duvarda (x −36) bitirildi, cep 1,3'e sabitlendi (radar orayı 6,4 m çatı sanıyordu). Kum yığını duvar dibine kadar uzatıldı (yığınla duvar arasındaki basamak da gitti). Bölgede kat kenarı kalmadı; pencereden iki yönde geçiş cgjump ile doğrulandı.

### 12.70 Harita editörü (geliştirici modu, I)
- Kullanıcının kendisi seçip düzenleyebilmesi / bana nesneyi kesin kimlikle gösterebilmesi için. Geliştirici modunda (çevrimdışı) **I**: editör aç/kapa. Nişangâhla bakılan nesne mavi kutuyla, seçili nesne turuncu kutuyla vurgulanır.
- Kısayollar: sol tık seç · Delete sil · Backspace geri al · ok tuşları taşı (bakış yönüne göre) · PgUp/PgDn yukarı/aşağı · Shift 1 m adım (yoksa 0,25) · +/− büyüt/küçült · ]/[ yükseklik · Home kimliği kopyala · End tüm düzenlemeleri kopyala. Esc ile duraklatınca paneldeki düğmeler tıklanır (Sil, Geri al, Kimliği kopyala, Düzenlemeleri kopyala, Tümünü sıfırla).
- **Kimlikler** (`MapBuilder.obj(id, fn)` / `objStack`): Çöl Geçidi'nde anlamlı (bina:<bileşen>, kenar:<i>, kasa:<i>, sandık:Xbox:0, kapı:Mid Doors, köprü:tabliye, çatı:<i>, pencere:<kenar>:<dilim>, pano:<i>, tabela:A, palmiye:<i>, çevre:güney …); diğer haritalarda her parça otomatik kimlik (parça:<n>). Birleşik ağlarda `mesh.userData.ranges` = [{oid, start, count}] → üçgen → nesne; düzenleme köşeleri yerinde değiştirir, çarpışma kutuları da güncellenir (`World.reindex()`). Bot yol ızgarası canlı güncellenmez.
- **Kalıcılık**: düzenlemeler tarayıcıda (`localStorage warbyte.harita-duzenleme.<harita>`) saklanır; geliştirici modunda harita kurulurken `MapBuilder.pendingEdits` ile uygulanır. "Düzenlemeleri kopyala" çıktısı (`HARİTA DÜZENLEMESİ colgecidi …` + JSON) bana gönderilir → `src/maps/colgecidiEdits.js`'e işlenir → sunucu + istemci herkes için kurulumun sonunda `b.applyEdits(EDITS)`. Biçim: `{id, at:[x,y,z] taban-merkezi, del?, d?:[dx,dy,dz], s?:[sx,sy,sz]}`; `at` 1,5 m'den fazla tutmazsa (veri değişti) atlanır → `map.editSkipped`, panelde uyarı.
- Test: `scripts/editortest.mjs` (12 kontrol: aç, seç, taşı + çarpışma, büyüt, sil + çarpışma, geri al, kopyala, kimlik, yeniden yüklemede kalıcı, sıfırla). Tüm haritalar kuruluyor, kimliksiz çarpışma 0.

### 12.71 Harita editörü: bina kimlikleri parça başına
- Bina kimliği bağlı bina kütlesi başınaydı (`bina:<bileşen>`): kütleler birbirine değdiği için `bina:1` 132×142 m'lik dev tek nesneydi, ince bir köşe ayrı seçilemiyordu. Artık çokgen başına (`bina:<çokgen>`, 16 m'lik bölümdeki tek kütle; en büyük 16 m). Veri: `rects` 8. alan = çokgen sırası. Renk hâlâ bileşene göre.
- İlk kalıcı düzenleme (`colgecidiEdits.js`): Window cebi yanındaki 0,5×1 m'lik ince bina köşesi `bina:11` silindi (kullanıcı).
- Panel: imleç değişince güncellenir; kopyalanan metin kutuda kalır (pano izni yoksa elle kopyalanır).

### 12.72 Harita editörü: kayıtlı düzenlemeyle panel boş açılıyordu
- Kayıtta yalnız değişen alanlar tutuluyor (`d` ya da `s` olmayabilir); yeniden yüklemede eksik alan okununca `render()` çöküyor, panel boş kutu kalıyordu (yalnız taşıma ya da yalnız boyut kaydında; testim ikisini birlikte yaptığı için yakalamadı). Yüklemede eksikler tamamlanıyor; panel çizimi hata verirse panelde hata mesajı + "Tümünü sıfırla". `scripts/editorload.mjs` üç kayıt türüyle denetler (eski kodda HATA verir).

### 12.73 Harita editörü: kayıtlı düzenlemeleri tek tek geri alma
- "Geri al" yalnız o oturumdaki işlemleri bilir; önceki oturumdan kalan (tarayıcıda kayıtlı) düzenlemeler panelde liste olarak görünür, her birinin yanında ↶ (kayıttan çıkarır) ve "Haritayı yeniden yükle" düğmesi (`game.restart()`). "Tümünü sıfırla" kaydı silip haritayı hemen yeniden yükler. Oturumda geri alınacak yoksa ne yapılacağını söyleyen uyarı. Test: `scripts/editorrevert.mjs` (havaya kaldırılmış palmiye kayıtla havada → ↶ → yeniden yükle → yerinde; sıfırla).

### 12.74 Harita Editörü ayrı bölüm; düzenlemeler kaydedilmez; gün batımı bulutları
- Editör artık maçın içinde değil: ana menüde **Harita Editörü** sekmesi (harita kartları, "Editörü aç", "n düzenlemeyi sil"). Açınca harita botsuz (`opts.editor`: diğer askerler `vacant`), uçuş açık, panel hazır açık; `I` paneli gizler. Doğrudan bağlantı: `/?editor=colgecidi`.
- Maçlarda (geliştirici modu dahil) yerel düzenleme hiç uygulanmaz, `I` editör açmaz: harita hep orijinal + `colgecidiEdits.js`.
- Düzenlemeler yalnız bellekte (`mapEditor.js` `MEM`): editörden çıkıp girince ve "Haritayı yeniden yükle"de durur, F5'te gider. Eski sürümün `localStorage 'warbyte.harita-duzenleme.*'` kayıtları ilk açılışta silinir.
- Gün batımı bulutları koyu kahverengi kaya gibi görünüyordu: bulut malzemesine kendi ışığı (`emissive`, `cloudGlow` gün batımı 0,62 / gece 0,25) + daha açık renk.
- Testler: `scripts/editorsection.mjs` (menü → editör, botsuz, maçta orijinal, F5'te gider, eski kayıt silinir); editortest / editorload / editorrevert yeni modele uyarlandı.

### 12.75 B penceresi yan boşlukları
- `B-penceresi:alt/üst` x −37…−36 idi: komşu duvarlar (bina:1, bina:10) B yüzünde x −36,78'de; güneyde 22 cm taşan köşe, kuzeyde bina:10 −54,36'da başladığı için 24 cm boydan boya yarık vardı. Parçalar x −36,78…−36,03'e hizalandı; kuzeye bina:10'a 3 cm giren tam boy `B-penceresi:kuzey-söve` eklendi. Yarıktan geçilemiyor (cgjump), pencereden iki yönde geçiliyor.

### 12.76 Kullanıcının 39 editör düzenlemesi kalıcı
- `src/maps/colgecidiEdits.js`'e işlendi (Xbox sandıkları, Mid/Cat, Titanic/T çevresi kenar duvarları, Pit kenarları, kasalar, palmiye:6 taşındı, palmiye:7 silindi). Tümü uygulanıyor (`editSkipped` boş); cgleak 0, cgmodes OK, cglinks önceki gibi (Xbox↔Short 64→59 m).
- Not: kenar:19 gömülünce altında kalan kenar:17 (x −2, z −2,1, Mid/Cat) kumdan ince şerit olarak görünüyor — kullanıcıya soruldu.

### 12.77 Çöl Geçidi doku ve detay geçişi
- `src/maps/surface.js` (yeni): harita tek köşe-renkli ağda birleşik olduğundan dokular **dünya koordinatlı prosedürel gölgelendirici** ile eklenir (UV yok, çizim çağrısı artmaz). Köşe başına `aKind` (sıva / ahşap / boyalı-metal / taş; renkten sRGB HSL ile çıkarılır; sandık/palmiye kimliğiyle ezilir) ve `aGnd` (altındaki zemin kotu). Sıva: büyük ton lekeleri, nem akıntısı, taban kaidesi + kir, dökülmüş sıva altından tuğla yamaları, kireç badana, is lekesi, çatlak. Ahşap: tahta çizgisi + damar. Boyalı: pas, oluklu sac. Zemin: kum dalgası, çakıl, saha/avlu taş levha, Long kaldırım taşı (`aAux`). Çizgiler piksel boyuna (`fwidth`) göre solar: uzakta moire/titreme yok. Yalnız Çöl Geçidi (`b.surface`); diğer haritalar eskisi gibi.
- Bina tonu 4 → 12; sandık (çapraz destek, metal köşe, stencil, 8 renk), fıçı halkaları, konteyner kapı kilitleri; pencere kepenk / parmaklık / tente / haç; kapı eşik + kol; yağmur borusu + gece yanan duvar lambası; çatı eşyaları (havalandırma, baca, klima, anten, su fıçısı, kulübe); zemin süsü (taş, ot, kırık tuğla, kum savruntusu); tünel direkleri + fenerleri; 5 çeşit pano; uzak çevre binalarında kepenk / balkon / kat bandı / kulübe.
- Hata düzeltmeleri: ortak kenarlı komşu çokgenlerin iç yüzleri çizilmiyor (ince dikey dikiş / ışık sızıntısı); palmiye sandığa denk gelirse en yakın boşluğa kaydırılıyor (>1,3 m ise yerinde); sınır dışı kum düzlemi 900 → 4200 m (ufuk çizgisi).
- Test/araçlar: `scripts/cgshot.mjs` (+ `doku-views.json`) sabit bakışlardan görüntü, `scripts/cgmontage.py` önce/sonra tablosu.
- Bilinen: Car (B) çağrısında araç yok (`nearBox` 6 m² eşiği 4,2 m²'lik kutuyu eliyor) — oynanış değişikliği olacağı için dokunulmadı.

### 12.78 Düzenleme biçimine `clip` (yalnız çarpışmayı kırpma)
- `{ id, at, d?, s?, clip?: [x0,x1,y0,y1,z0,z1] }` (null = sınırsız): düzenleme uygulandıktan sonra nesnenin ÇARPIŞMA kutuları bu kutuya kırpılır (görsel değişmez). `kenar:6` büyütülünce çarpışma kutusu görünen duvardan 9 m uzundu (görünen duvar z 55,6'da bitiyor, kutu 64,4'e kadar) → kumun üstünde 1,2 m'lik görünmez engel; `clip: z ≤ 55,6` ile kırpıldı. Editör panelinin dışa aktarımı `clip`'i yazmaz; bir duvarı yeniden dışa aktarırsan clip'i elle koru.
- `kenar:6` / `kenar:14` / `kasa:7`: duvarlar Titanic plato kumunun 1,2 m üstüne çıkarıldı (kum duvarı örtmesin).

### 12.79 Düzenlemeye `trim` (üst şerit ölçeklenmesin)
- `{ …, trim: true }`: çarpışma gövdesinin DIŞINA taşan görsel köşeler (korniş, üst şerit, kenar taşması) ölçeklenmez, yalnız kaydırılır; çarpışmanın tepesi görsel tepeye kadar uzatılır. `kenar:6` / `kenar:14` 7,3× / 1,9× büyütülünce 0,12 m'lik üst şerit 0,9 m olmuş ve çarpışmasız kalmıştı (içine girilebiliyordu). Artık şerit 0,12 m, görsel tepe = çarpışma tepesi (7,96 m).

### 12.80 Yürüme hızı 4,4 → 5,6 m/sn
- `src/sim/input.js` `WALK_SPEED`: 4,4 → 5,6 (yürüme ≈5,5, koşu ≈8,2, çömelme ≈2,9 m/sn ölçüldü). Oyuncu, sunucu, istemci tahmini ve botlar (`bot.js` iki yerde sabit 4,4 yazılıydı) aynı sabiti kullanır; ayak sesi temposu (`player.js`) ve koşu isabetsizliği eşiği (`soldier.js` `SPRINT_SPEED` = WALK_SPEED × 1,32) buna bağlandı, yoksa yürürken "koşu cezası" uygulanırdı. Daha da hızlandırmak ya da yavaşlatmak için yalnız bu sabit değişir.

### 12.81 Botlar yaprak / çalı arkasından görmez (mermi geçer)
- Ağaç tepeleri ve çalılar çarpışmasız olduğundan `world.clear` botların görüş ışınına engel olmuyordu (Vadi'de dağdaki botlar çam aralarından tarıyordu). Varlıklara (görünüm / çarpışma / mermi) DOKUNULMADI: `kit.js` çam / meşe / çalı yalnız `b.softCover(x, y, z, r)` ile küre kaydeder (`map.sight`). `game/sight.js` `SightMap`: görüş hattının kürelerin içinden geçen toplam uzunluğu 1,1 m'yi aşarsa `game.botSees(a, b)` false döner (kenardan sıyıran hat görünür; bot kendi çalısının içindeyse dışarıyı görür). Botların hedef seçimi ve `los` kararı (`bot.js` 2 yer) bunu kullanır; mermi / oyuncu / gadget hâlâ yalnız `losClear`.
- Ölçüm (`scripts/sighttest.mjs`, Vadi): açık görüş hatlarının %24'ü (80 m+ %43) yapraktan geçiyor → artık görülmüyor.

### 12.82 Admin paneli (admin.warbyte.site) + denge ayarları tek yerde
- Kullanıcı hız, hasar, can, sekme, varsayılan silah, mod sınırı gibi sabitleri koda dokunmadan değiştirmek istedi (tasarım B: koyu/turuncu "oyun konsolu" + oyunun kendi 3D modelleriyle önizleme).
- `src/game/balance.js`: fonksiyon içinde duran sayılar `TUNE` (yürüme / koşu / zıplama / yerçekimi, doğma koruması, yeniden doğma, kafa ×2,1 / bacak ×0,8, tahta ×0,65, sırttan bıçak, sıhhiye aurası, mermi yenileme, bayrak hızı, bilet kanaması, bot görüş mesafesi) ve `LIMITS`'e (mod oyuncu sınırları, DM öldürme hedefi, varsayılan süre) taşındı; `WSTATS` / `CLASS_DEFS` / `DIFFICULTY` / `ZOMBIE` / `BOSS` / `ZTYPES` yerinde değiştirilir. Geçersiz kılma = düz yol haritası (`{'w.ak47.dmg': 36}`); yalnız `balanceSections()` listesindeki ~450 yol, aralık ve seçenek doğrulamasıyla (`sanitizeBalance`) kabul edilir. `WALK_SPEED` / `JUMP_SPEED` dışa aktarımı yalnız varsayılan (testler); oyun `TUNE`'u okur.
- Sunucu: `data/balance.json` (+ `balance-history.json`, 60 sürüm) git dışı, deploy'da silinmez (`server/balanceStore.js`). Tüm odalar aynı süreçte ortak nesneleri paylaştığı için her oda maç başında sürümü kopyalar (`room.bal`) ve her adım / mesaj öncesi `room.activate()` → `useBalance` (aynı nesneyse işlem yok). Kullanıcı kararı: değişiklik **yeni maç / turda** geçerli, süren maç eski ayarla biter; boş odaya ilk giren de taze maç (güncel ayar) alır. İstemci `welcome.bal` ile aynı sürümü uygular (tahmin / HUD kaymasın); çevrimdışı maç `/balance`'tan son ayarı çeker.
- `server/admin.js`: yalnız 127.0.0.1:8788 (nginx `admin.warbyte.site` → buraya). Tek admin şifresi (scrypt, `data/admin.json`; ilk açılışta rastgele → `data/admin-password.txt`, panelden değişince silinir), HttpOnly + SameSite=Strict çerez, POST'ta `x-wb` başlığı (CSRF), 15 dk'da 8 yanlış denemede kilit. Uçlar: denge oku / kaydet, geçmiş + geri al, odalar (oyuncu at, oyuncu odası kapat; resmi oda kapanmaz, kullanıcı "yeniden başlat" istemedi), duyuru (sohbete sistem mesajı), şifre değiştir.
- Panel `admin/` ayrı derlenir (`vite.admin.config.js` → `dist-admin/`), oyun sitesinde (`dist/`) yer almaz. Geliştirme: `npm run admin` (:5181, /api → :8788).

### 12.83 Resmi sunucular panelden yönetilir (aç / kapat / ekle / sil / düzenle)
- Kullanıcı resmi sunucuların haritasını, modunu vb. tamamen seçmek ve açıp kapatmak istedi. `server/official.js` artık yalnız ilk açılış varsayılanı; liste `data/official.json`'da (`server/officialStore.js`, en çok 12, kodlar `OFC<n>`; oyuncu odası kodları OFC* almaz).
- Sunucu: ad, açıklama, açık/kapalı, mod, kişi sayısı (moda göre sınır: `LIMITS`), süre, bilet/skor sınırı (0 = otomatik), bot zorluğu, botlar, 3. şahıs, harita sırası (1–8 × harita / gün saati / hava). Doğrulama `sanitizeCfg` ile oyuncu odalarıyla aynı; Enfekte = New York, gece, zor bot.
- `index.js` `syncOfficial()`: açık olan kurulur, kapatılan/silinen `room.shutdown()` ile kapanır (oyuncuya mesaj, bağlantı 4001 → ana menü), değişen `room.setOfficial()`: oda boşsa hemen yeni maç, doluysa sonraki maçta (denge ayarlarıyla aynı kural). Denge paneli "Modlar"daki eski resmi oda alanları (`ofc.*`) kaldırıldı.
- Panel: "Sunucular" sayfası (harita resimli kartlar, açma/kapama anahtarı, düzenleme penceresi).

### 12.84 Resmi sunucu sırası (sürükle-bırak) + rastgele harita
- Ana menüde resmi sunucular karışık diziliyordu: `/rooms` resmi odaları oyuncu sayısına göre sıralıyor, eşitlikte `rooms` haritasına ekleniş sırası kalıyordu (düzenlenen oda sona kayıyordu). Artık resmi odalar `data/official.json` liste sırasında, oyuncu odaları kalabalık önce. Panelde kartlar sürüklenip bırakılır → `POST /api/official/order`.
- Sunucuya `shuffle` (Harita düzeni: Sırayla / Rastgele). Rastgelede her yeni maçta listeden rastgele harita, bir önceki harita üst üste gelmez (`room.js` `_rotIdx`, yalnız `rot` değişince yeniden seçilir). Menü başlığı "harita sırayla döner" → "her maçta harita döner".

### 12.85 Mobil (dokunmatik) kontroller + küçük ekran arayüzü
- Telefondan girince hareket edilemiyordu (yalnız klavye / fare). `src/game/touch.js` `TouchControls`: sol yarıda parmağın değdiği yerde beliren joystick (8 yön; sunucu `f` / `r`'yi zaten −1, 0, 1 alıyor, ağ protokolü değişmedi; sonuna kadar ileri = koşu), sağ yarıda kaydırarak bakış (ayarlardaki hassasiyet ve dürbün yakınlaştırması uygulanır), butonlar: ateş (sürüklerken nişan da alır), sol başparmak için ikinci ateş, nişan, zıpla, çömel, şarjör, silah değiştir (ana → yedek → yakın dövüş), ekipman, skor, duraklat. Ölü / duraklatılmış / maç bitmişken gizli (ölüm ekranı kartlarına dokunulabilsin); görünürlük oyun döngüsünden bağımsız rAF'ta. Dikey ekranda "telefonu yan çevir". İlk dokunuşta tam ekran + yatay kilit (Android; iPhone Safari desteklemiyor).
- Algılama: `navigator.maxTouchPoints > 0 && (pointer: coarse)`; `?touch=1` / `?touch=0` zorlar. Dokunmatikte fare kilidi yok (`noPointerLock`). Varsayılan grafik telefonda 1× çözünürlük + gölgesiz (kayıtlı tercih geçerli).
- Arayüz: `body.mob` ile HUD öğeleri CSS `zoom` ile küçülür, mermi sağ üste taşınır (sağ alt butonlara). `@media (max-height:520px)`: ölüm ekranı (sınıf kartları 3'lü ızgara), skor tablosu (760 px sabit genişlik kaldırıldı) ve ana menü (küçük logo, solda dar dikey menü, sağda kayan içerik) yatay telefona sığar. Masaüstü değişmedi.
- Ölçüm (740×360, sanal dokunuş): joystick ile 5,2 m/sn yürüme, kaydırma ile bakış, ateş butonuyla 0,6 sn'de 8 mermi.

### 12.86 Dokunmatik kontroller PUBG / CoD Mobile tarzı: özelleştirilebilir düzen, analog joystick, koşu kilidi, jiroskop
- Kullanıcı telefonda denedi: kontroller çalışıyor ama sol ateş butonu yürüme alanının üstüne biniyordu, 3. şahıs butonu yoktu, butonların yeri / boyutu ayarlanamıyordu; "PUBG gibi akıcı" istedi. Araştırma (PUBG Mobile, CoD Mobile): özelleştirilebilir düzen, sabit / hareketli joystick, sabit / hareketli sağ ateş, isteğe bağlı sol ateş, jiroskop, ayrı nişan hassasiyeti.
- `touch.js` yeniden yazıldı: düzen oranlarla (x, y ekranın oranı; boyut ekran yüksekliğinin oranı), `localStorage['warbyte.touch']`'ta cihaza özel. Duraklat menüsünde "Dokunmatik ayarlar": butonları sürükle (seçili turuncu), seçili boyut, saydamlık, joystick Sabit / Hareketli, sağ ateş Sabit / Parmağı izler, sol ateş Açık / Kapalı; Hassasiyet sekmesi: bakış, nişan, jiroskop (Kapalı / Nişandayken / Hep açık, hassasiyet, yön ters çevirme; iOS izni ayarda açarken istenir). Panel gizlenebilir (küçük hali joystick ile sağ butonların arasındaki boşlukta), buton sürüklenirken panel saydamlaşır.
- Joystick ANALOG: `f` / `r` −1..1 (ölü bölge %12); `applyInput` hız × min(1, |f,r|) (klavye çaprazı yine normalize, masaüstü hissi aynı); sunucu `f` / `r`'yi artık tam sayıya yuvarlamıyor (2 basamak). Kenara kadar ileri = koşu; daha yukarı sürükleyip kilit işaretinde bırakmak = koşu kilidi (joysticke dokununca biter).
- Yeni: 3. şahıs butonu (oda izin veriyorsa), HUD'daki silah adına dokunarak o silaha geçme, öldürme bildirimi mobilde mini haritanın altına (zıpla butonuna biniyordu).
- Ölçüm (780×360, sanal dokunuş): yarım itiş 2,8 m/sn, tam itiş 5,0, kenar 8,4 (koşu), kilitli koşu 8,4; hareketli joystick dokunulan noktada beliriyor; düzen kaydı yenilemeden sonra korunuyor. Jiroskop emülatörde denenemedi (gerçek cihaz gerekli).

### 12.87 Dokunmatik ayar paneline dokunulamıyordu (düzeltme)
- Telefonda "Dokunmatik ayarlar" açılınca panel düğmelerine (Kaydet, sekmeler, kaydırıcılar) dokunulamıyor, yalnız arkadaki butonlar sürüklenebiliyordu. İki neden: (1) panel `#tc` katmanının içindeydi ve CSS'te sonradan kalan `z-index:2`, panelin z-index'ini ezip onu düzenleme katmanının (40) ALTINA itiyordu — dokunuşlar panele hiç ulaşmıyordu; (2) `#tc` her `touchstart`'ta `preventDefault` yapıyordu (tıklama üretilmez) ve `touch-action:none` alt öğelere geçiyordu. Panel `#tcEd` adlı ayrı katmana taşındı (z 41, kendi touch-action), düzenleme modunda dokunma olaylarında `preventDefault` yapılmıyor.
- Fareyle yapılan testler bu hatayı yakalamaz. `scripts/touchedit.mjs [url]`: Playwright'ta dokunmatik telefon (Pixel 7 yatay) ile gerçek tap + CDP dokunmatik sürükleme; BAŞLA, duraklat, panel aç, buton sürükle (panel dışı + panel küçültülünce üstteki), sekme, jiroskop, joystick modu, kaydırıcı, Kaydet. Eski sürümde "Hassasiyet sekmesi" adımında düşüyordu, düzeltmeyle hepsi OK.

### 12.88 Jiroskop eksenleri düzeltildi
- Gerçek telefonda (yatay): aşağı eğince sola, yukarı eğince sağa dönüyor, sağa çevirince yukarı bakıyordu → eksenler yer değiştirmiş ve işaretler ters. Artık `yaw = −gamma`, `pitch = −beta` (× yön işareti `sg`, ekran açısı 270'te −1; ayardaki "ters" seçenekleri yine çarpan). `scripts/touchedit.mjs` sanal `devicemotion` ile iki hareketi doğrular (eski kodda sola dönüş üreten sinyal → aşağı bakış; yukarı bakış üreten → sağa bakış).

### 12.89 Jiroskop: dönüş hızı yerine cihaz yönelimi
- 12.88'den sonra yukarı / aşağı doğru ama sağa / sola hiç dönmüyordu: ham dönüş hızının (devicemotion.rotationRate) hangi eksende ölçüldüğü tutuşa (dik / yatık) ve platforma göre değişiyor; tek eksene bağlamak bir tutuşta çalışıp diğerinde çalışmıyor. Artık `deviceorientation` (dünya Z-yukarı, ZXY Euler): yönelim → ekran açısıyla düzeltilmiş kamera (three.js DeviceOrientationControls yöntemi) → bakış yönünden yaw / pitch; her olayda öncekinden fark uygulanır (±180° sarması, ani sıçrama yok sayılır, tam dik bakışta yaw atlanır). Telefonu kamera / pencere gibi tutarsın: sola çevir → sola, ekran göğe dönecek şekilde yatır → aşağı. iOS'ta DeviceOrientation ve DeviceMotion izni ayrı istenir.
- `scripts/touchedit.mjs`: dik (gamma −85) ve yatık (gamma −45) iki duruşta 10° pusula dönüşü = 10° yaw (eğim 0), 10° eğme = yalnız pitch.

### 12.91 New York (Enfekte) gece görünümü: şehir yüzeyi, ateş ışığı, duman
- Enfekte modunun tek haritası New York gece düz renkli kutular gibiydi (doku yok, ışık tek düze, yangınlar yalnız parlayan küp).
- Şehir yüzey gölgelendiricisi (`surface.js` `makeCityMaterial`; Çöl Geçidi yöntemi: dünya koordinatlı, UV yok, çizim çağrısı artmaz): asfalt (agrega, yama, uzun / timsah sırtı çatlak, yağ lekesi, ıslak birikinti + sahte gece yansıması), kaldırım levhası, tuğla örgü + taş silme, beton cephe paneli + yağmur akıntısı, is / yanık lekeleri, cam (ufukta kızıl yansıma, bazı pencerelerde loş iç ışık / TV titremesi), yanık-paslı araç boyası, moloz, demir, aşınmış yol boyası. Gündüz ortam haritasının aynasal yansıması atıldı (gece camda beyaz leke yapıyordu). Sınıf etiketi `MapBuilder.withKind()` / `opt.kind` yalnız görsel, çarpışmaya dokunmaz.
- Gece ışığı (`nyfx.js`): 5 gölgesiz titreyen ateş ışığı (dokunmatikte 2); hale, yerde ateş ışığı, kıvılcım ve duman sütunları iki örneklenmiş ağda (hareket gölgelendiricide); ateş / pencere ışığına titreme + jaluzi; her 3. sokak lambası kırık. `env.night`: ufuk kızıl, sis koyu-dumanlı, ay soğuk. Eski yarı saydam "duman kutusu" kaldırıldı.
- Değişmeyen: çarpışma (1840 kutu), nav, doğuş, perch ve görüş özetleri birebir aynı (`scripts/nyshots.mjs`); rastgele sayı sırası korundu; diğer haritalar piksel olarak aynı. Yük: çizim çağrısı / üçgen aynı; M4 GPU'da kare süresi ≈ +1 ms (1080p'de fark yok), swiftshader'da piksel maliyeti ≈ 1,6× (gerçek düşük seviye telefonda denenmeli). Testler: `inftest`, `infstart`, `inftypes`, `headless-sim newyork` geçti.

### 12.90 Mobil geçiş: keskin görüntü, yatay FOV, nişan yardımı, dürbün ve küçük ekran
- Kalite: dokunmatikte ayrı tercih `qualityM` (varsayılan 2 → çözünürlük min(DPR, 2)); önceden DPR-3 telefonda 1× çiziyordu (bulanık). Otomatik çözünürlük telefonda 60 Hz'e göre: 36 FPS altı düşür, 57 üstü yükselt, taban 0,75×, düşüşten sonra ~7 sn yükseltme yok (eski 13,5 ms eşiği 60 Hz ekranda hiç tutmadığından düşen çözünürlük geri gelmiyordu). Gölge açılırsa 1024 harita.
- Görüş açısı: dokunmatikte ayar YATAY FOV (`fovM`, varsayılan 85°, 70–110). 2,2:1 telefonda dikey 75° = yatay 118° idi; 25 m'deki düşman 17 px → 29-34 px. Dürbünsüz nişangâhlarda büyütme ×1,6 (demir 1,24×, red dot / holo 1,48×). Masaüstü (dikey `fov`) değişmedi.
- Nişan yardımı (yalnız dokunmatik; Dokunmatik ayarlar → Hassasiyet: aç / kapa + güç): sürtünme (düşman üstünde bakış en çok %45 yavaş), yumuşak mıknatıs (hareket / ateş / nişan / parmakla bakış sırasında; koni 4° + gövde açısı, nişanda daralır, 25 m'den sonra zayıflar, 90 m'de biter; en çok ≈52°/sn, ani kilit yok), nişana girişte 0,18 sn hafif çekiş. Görüş `game.botSees` (duvar + duman + yaprak): duvar arkasına çekmez. Çevrimiçinde de çalışır (yaw / pitch istemciden gidiyor).
- Nişan: dürbün halkası ekran yüksekliğinin %94'ü, dışı siyah (bulanık backdrop-filter kaldırıldı, telefonda pahalıydı); dürbünde butonlar soluk; dürbünsüz nişanda silah modeli %50 saydam (nişangâh gövdesi merkezin %36-50'sini kapatıp hedefi örtüyordu); red dot parıltısı küçük.
- Arayüz: menü (`html.touch`), oyun içi ayarlar ve dokunmatik panel dokunma hedefleri ≥ 40 px; telefonda tuş atama yerine "Dokunmatik ayarlar"; skor tablosu açıkken butonlar gizli; öldürme akışı, sohbet, oda rozeti ve durum mesajı butonlarla çakışmıyor; menüde ekran değişince kaydırma en üstten.
- Test: `scripts/mobilepass.mjs` (iPhone 14 Pro Max / 13, Pixel 7, 667x375, masaüstü): tüm ekranların görüntüsü (/tmp/wb-mob-shots), dokunma hedefi, taşma, dürbün kaplaması, FOV, çözünürlük, nişan yardımı (görünür / duvar arkası / kapalı / masaüstü) denetimleri; `ONLY=online` (sunucu BF_DEBUG=1, WS=...) çevrimiçi odada nişan yardımı + sohbet / rozet çakışması. `touchedit.mjs` jiroskop adımı izin isteğini bekler (~350 ms, zaman uyumsuz).

### 12.95 Yeni harita: Depo (küçük, mobil dostu; ele geçirme / TDM / DM / GG)
- İstek: telefonda rahat oynanacak kompakt harita (onaylı taslak "B · Depo"). `src/maps/depo.js` (60 × 68 m, 4v4–5v5): ortada içine girilen depo (B; 7 kapı, z = ±5'te raf sıraları, ortada 4,4 m açık şerit, doğu duvarında iki merdivenli 3 m asma kat — altı dolu blok, `layered` yol bulma), batıda konteyner sahası (A), doğuda kamyon / forklift / paletli yükleme alanı (C), köşelerde jeneratör / çöp konteyneri. Mavi güney, kırmızı kuzey; harita z = 0'a ayna simetrik (her bayrak iki doğuşa eşit, 37–44 m), doğu–batı farklı karakterli. Doğuş avluları 3 açıklıklı konteyner hattının arkasında, her açıklığın arkasında perde konteyner (düşman doğuşundan görüş 0); `baseZones` hattın arkası.
- Görünüm: `src/maps/depoSurface.js` haritaya özel dünya koordinatlı gölgelendirici (beton levha, epoksi zemin, oluklu sac + kaide + şirket bandı, oluklu konteyner + pas akıntısı, ahşap, blok duvar, çelik, koli, çatı sacı…), UV / doku yok. Renkler açık-orta ton (koyu asker silueti öne çıkar), A / C kapı üstü pano harfi, zeminde B, "DEPO 3" tabelası, ışıklıklar, makaslardan sarkan lambalar. Bileşik eşyada (konteyner, forklift, kamyon, raf, palet) görsel parçalar çarpışmasız, çarpışma = dış zarf; görünmez engel yok.
- Yük: harita 8 ağ / 19,5 bin üçgen (Çöl Geçidi 268 bin). M4 Pro'da masaüstü ve Pixel 7 emülasyonunda (2×) kare 16,7 ms (60 Hz kilidi).
- Menüde harita kartına "Mobil dostu" rozeti (`MAPS[id].mobile`). Sunucu / admin harita listelerine `depo` eklendi.
- Test: `scripts/depotest.mjs` (çarpışma, doğuş zemin / geometri / görüş, hedef ulaşımı, asma kat, sızıntı, 5v5 ele geçirme + TDM + DM + GG + 4v4 bot maçları; görüş dağılımı 0-10 / 10-20 / 20-35 / 35-50 / 50+ m = %16 / 38 / 35 / 10 / 0, öldürme mesafesi medyanı 9–14 m), `scripts/deposhots.mjs` (kuşbakışı + 10 bakış; masaüstü, Pixel 7 ve iPhone 14 yatay; çizim çağrısı / kare süresi; `THUMB=1` küçük resim, `GPU=1` gerçek GPU), `scripts/deponet.mjs` (çevrimiçi oda + ikinci istemci).

### 12.96 Liman: kompakt, mobil dostu konteyner sahası
- Yeni harita **Liman** (`src/maps/liman.js`, yüzey `limanSurface.js`; onaylı taslak "A · Liman"): 60×66 m, 4v4–5v5. Kırmızı kuzey, Mavi güney; kapalı avlularda doğulur (2 katlı konteyner duvarı, 4 kapı, kapı önünde şikan + kulübe; avludan avluya görüş yok).
- Üç hat: **A · Portal Vinç** (batı, lastik tekerlekli vinç altı, kancada asılı konteyner), **B · Kule** (orta: ortadan geçilen ucu açık tünel konteyneri, iki yandan merdivenle çıkılan 2,6 m çatı, `plat`; botlar da çıkar), **C · Rıhtım** (doğu, gemi vinci; suya bakan 0,95 m beton korkuluk, sınır korkuluğun ortası — suya düşülmez; yanaşmış yük gemisi manzara). Oynanış yerleşimi 180° simetrik (`half()` bir kez düz, bir kez döndürülmüş), süs farklı. Hatları 2 katlı (5,2 m, çıkılmaz) konteyner duvarları ayırır.
- Görüş kompakt: ortanca 6,7 m, %90'ı 22 m, en uzun 51 m. Görünen her parçanın çarpışması birebir. Görsel: oluklu, paslı, solmuş boyalı konteynerler; asfalt, rıhtım betonu, yol işaretleri gölgelendiricide (UV yok); gece sahte ışık (en çok 12 nokta, gerçek ışık yok); su ayrı malzeme. ~86 bin üçgen (Çöl Geçidi 394 bin).
- Motor düzeltmesi (`game.js`, 2 satır): katmanlı haritalarda ileri doğuş (`_free`) ve ölüm maçı doğuşu yükseltilmiş platform hücresine düşmez (yoksa y = 0'da kulenin içinde doğuluyordu).
- Liste birleştirme: Depo ve Liman aynı satırlara eklenmişti (sunucu / admin / harita kaydı), ikisi de korundu.
- Testler: `scripts/limantest.mjs` (kurulum, doğuş, bayrak erişimi, sızıntı, sıçrama erişimi, görüş istatistiği, 5 benzetim: ele geçirme 5v5 / 4v4 gece-yağmur, TDM 5v5 / 16v16, DM 8), `limanshots.mjs`, `limannet.mjs`, `limanonline.mjs`.

### 12.99 Herkes-tek skor kutusu: lider gerçekten lider
- Ölüm Maçı / Silah Yarışı (ve aynı HUD'u kullanacak boya modu) üst kutuda "SEN 9 · LİDER 7" görünüyordu: lider hesaplanırken oyuncu dışarıda tutuluyordu (`hud.js` `s !== p`). Artık tek sıralama var (`match.js` `ffaRanking`: gg'de seviye → öldürme → puan; `ffaMetric`: gg'de seviye, değilse öldürme). Kutu, skor tablosu, maç sonu sıralaması ve süre bitiminde kazanan bunu kullanır. Kutu: öndeysen sol `SEN · LİDER +fark` (altın), sağ `2. · ad`; eşitsen ikisi `BERABERE`; gerideysen sol `SEN · sıran.`, sağ `LİDER · ad` (altın). Süre dolunca metin kazananı adıyla yazar ("Süre doldu · Onur 9 öldürmeyle kazandı"; eşitlikte "(eşitlikte puanı yüksek)"); gg maç sonu sıralaması seviye gösterir.
- Çevrimiçi: rakip öldürme / seviye alanları yalnız değişince geldiği ve `interpolate` düşük FPS'te o snapshot'ı atlayabildiği için `client.onSnap` bunları hemen uygular (eskiden rakip öldürmeleri 0'da kalabiliyordu). Test: `scripts/ffaleader.mjs` (çevrimdışı dm / gg × masaüstü / Pixel 7 + çevrimiçi dm; sunucuda `BF_DEBUG` `kl` komutu — çevrimiçi kısım BF_DEBUG'sız sunucuda doğal olarak düşer).

### 12.100 Herkes-tek doğuş: küçük haritalarda takım avlusuna düşme düzeltildi (Depo / Liman / Çöl Geçidi)
- Sorun: ölüm maçı / silah yarışı (ve ileride paintball) doğuş havuzu `nav.spreadPoints(spacing 14)` ile kuruluyor, 20 noktanın altında kalırsa iki takımın doğuş noktalarına dönüyordu. 60 m'lik Depo / Liman'da (ve katmanlı + arazili Çöl Geçidi'nde, platform testi araziyi saymadığından) hep böyle oluyordu: herkes iki kapalı avluda, üst üste doğuyordu.
- `game.ffaPool()`: `map.ffaSpawns` varsa o; yoksa ulaşılabilir alandan, hedef 24–40 nokta tutana kadar aralık 14 → 6 m daralır. Her nokta: zemin kotunda (katmanlıda platform testi araziye göre), gövde hiçbir kutuya girmiyor, 2,5 m çevresi ≥ %55 açık, 8 yönden ≥ 3'ünde 4 m açık. 12 noktanın altında kalırsa takım noktaları (güvenlik).
- `pickSpawn` (ffa): puan = en yakın canlı rakibe uzaklık (30 m'de doyar) − son 8 doğuşa yakınlık cezası (15 sn, 10 m) + rastgelelik; en iyi 12 aday `botSees` ile denetlenir (55 m içinden görülen −45), ilk "≥ 14 m uzak + görünmeyen" seçilir. `openYaw`: en açık yöne bakarak doğulur. Takım modu doğuşları değişmedi.
- Sonuç (10 bot, dm 180 sn): takım avlusu noktası %100 → %0; rakip ≥ 12 m: Depo %87 → %99, Liman %83 → %100, Çöl Geçidi %60 → %100; 30 m içinden görülen doğuş %62 / %50 / %44 → %0. Testler: `scripts/ffaspawn.mjs`, `scripts/ffanet.mjs`, `scripts/ffashots.mjs`.
- Birleştirme kazası: ajan dalı kendi `node_modules` kısayolunu commit'lemişti, birleşince ana klasördeki gerçek `node_modules`'un yerine geçti (testler `three` bulamadı). Kısayol repodan çıkarıldı, `.gitignore` `node_modules/` → `node_modules` (sondaki / yalnız klasörü kapsıyordu).

### 12.92 Paintball silahları: marker + tabanca, gerçek balistik boya topu, boya lekeleri
- Yalnız paintball modu için (sınıf seçeneklerinde / silah yarışında yok; geliştiricide J/K ile her maçta denenir). `pbrifle` Paintball Tüfeği: tam otomatik 10 top/sn (rpm 610: 600'de bekleme kayan nokta payıyla 7 adım sürüp 8,6/sn oluyordu), 12 hasar (gövdeye 9 isabet), kafa ×1,5, 50 + 150 hazne, 2,6 sn doldurma, 70 m/sn, düşüş 7 m/sn². `pbpistol` Paintball Tabancası: yarı otomatik, 25 hasar (4 isabet), 12 + 48, 60 m/sn, düşüş 10. Menzil düşüşü yok; değerler WSTATS'ta, denge panelinde "Paintball" grubu (top hızı, düşüş, kafa / bacak çarpanı).
- Modeller (`src/models/paintball.js`): marker = üstte basık hazne (boya rengi), dipçik yerine mavi CO2 tüpü, uzun delikli namlu, dikey ön kabza; red dot haznenin arkasındaki köprü kaidesinde; doldururken kapak açılır. Tabanca = üstte boya renkli tüp şarjör (öne kayar), kabzada CO2 kapağı. Hazne / tüp savaşçının kişisel rengine boyanır (`tintPaint`). Namlu alevi yok, ses kuru "pop".
- Toplar (`src/game/paint.js`): gerçek top, gözden çıkar, görüntüde 0,1 sn namludan yola kayar; her sim adımında yerçekimli doğru parçası dünya + vuruş kutusu ile denenir. Karar çevrimdışında oyunda, çevrimiçinde sunucuda; insanın topu, ateş anında görülen an + topun yaşı kadar geri sarılmış hedeflere çarpar (lag compensation). Saçılım (savaşçı no, girdi no) ile tohumlu → istemcinin anında gösterdiği top sunucununkiyle aynı yöne gider. Ağ: `pb` (top doğdu), `pbh` (isabet). Botlar düşüşü telafi eder.
- Lekeler: duvar / zemin lekesi atıcının renginde (12 renk), yüzeye oturur, son 400 tanesi tek çizim çağrısında; vurulan oyuncunun uzvuna leke (kişi başı 12, doğunca silinir); isabette renkli sıçrama. Ek yük 4 çizim çağrısı; atış başına bellek ayırma yok (1024'lük havuz).
- Test: `scripts/pbtest.mjs` (`--expose-gc`), `scripts/pbnet.mjs` (iki istemci + gecikme; GERÇEK GPU ile çalıştır — `GPU=1`; yazılımsal GL'de 21/0 FPS ile atış / tahmin adımları zamanlamadan düşer), `scripts/pbshots.mjs`. Sunucuda BF_DEBUG ile `{t:'dbg', pb:1}` herkese paintball silahı verir.

### 12.93 Boya Kulesi haritası + Paintball modu (pb)
- Onaylı tasarım (Unturned paintball haritasından esinli, yükseklik hissi): 52×52 m, üç kat. Zemin (0 m): şişme siperler (fıçı / dorito / yılan / küp), biçilmiş çim, kule çevresinde r 11 m, 28 m derin KUYU. Orta kat (9 m): köşelerde direkler üstünde 4 renkli kale (turuncu KB, mor KD, turkuaz GD, mavi GB; 1,7 m dış duvar, kulübe, kale rengi siperler, bayrak); kanattan kuleye korkuluksuz 1,6 m köprü kuyunun üstünden geçer. Kule 8×8, 18 m, daralan: 9 m giriş katı (4 köprü kapısı), iç merdiven → 13,5 m balkon (+ mor kanada basamaklı yol), üst katta iç merdiven → 18 m TEPE. İskele yolu yalnız kuzey (turuncu↔mor) ve doğu (mor↔turkuaz). Turuncu ve turkuaz kale önünde zıplama minderi.
- Onaydan sapma: köprüler çapraz değil "fırıldak" düzeninde (kanattan kuleye düz) — çarpışma yalnız eksen hizalı kutu, çapraz köprü birebir çarpışma alamazdı. Şişme siperlerin çarpışması görselin içinde (görünmez engel yok).
- Kuyu: `PitTerrain`, `map.voidY` −5 altına düşen elenir; son 5 sn içinde vuran varsa öldürme ona ("Kuyuya düşürdü"), yoksa "Kuyuya düştü"; ~3 sn'de doğar. Başka yerde düşme hasarı yok. Minder: `pad` çarpışması fırlatır (tepe ≈ 10,5 m), uçuşta havada yön değişimi az (`launchT`).
- Botlar: `NavGridML` (src/game/navml.js) hücre başına 3 kat; hedef kat seçer, çatışırken yol takibine devam eder, kuyu / boşluk kenarında adım atmaz. Diğer haritalarda bot davranışı değişmedi.
- Mod 'pb': herkes tek, sabit teçhizat (`PB_LOADOUT`: pbrifle + pbpistol + bıçak; gadget yok), sınıf seçimi yok, ilk LIMITS.pbKills (30) eleme, oyuncu LIMITS.pbMin–pbMax (2–12), doğma TUNE.respawnPB (3 sn); hepsi admin panelinde. Boya Kulesi yalnız pb'de, pb yalnız Boya Kulesi'nde (menü, sanitizeCfg, MAPS_FOR, admin). Skor tablosunda oyuncunun boya rengi (`game.paintColor = paintColorOf`).
- Birleştirme: herkes-tek doğuş düzeltmesi (12.100) haritanın kendi `ffaSpawns` noktalarını platform testine sokup y'yi atıyordu (kale güvertesi doğuşları bozulurdu) → harita noktaları olduğu gibi (y dahil) kullanılır, `pickSpawn` y'yi taşır. `pbmap.mjs` kule iç merdiveni testi askeri duvara 2 cm gömülü başlatıyordu (x −3,4; duvar −3,70, yarıçap 0,32) → silah hızına göre bir sürümde içeri, birinde kuyuya itiliyordu; başlangıç x −3,3. Test dosyası çakışması: harita ajanının `pbnet.mjs`'i `pbmapnet.mjs` oldu.
- Testler: `scripts/pbmap.mjs`, `scripts/pbmapnet.mjs` (WS=, sunucu BF_DEBUG), `scripts/pbmapshots.mjs`. Yük: harita 17 ağ / 35 bin üçgen; M4 Pro'da kare ≈ 3,4–4,5 ms.

### 12.97 Birinci şahıs eller: organik düşük poligon el, gerçekçi bıçak tutuşu, yeni zombi pençeleri
- Sorun: bıçak tutuşu kutu yumruk + kutu kol (sap bileğe paralel, ağız bileğe dönük); zombi elleri kalın blok parmaklı yeşil kutular, üstünde kaba kırmızı şeritler. Kullanıcı birinci şahıs ellerde "kutu" kuralının dışına çıkılmasını istedi (referans: CS:GO bıçak tutuşu + low-poly zombi eli).
- `src/models/fpHands.js`: kodla üretilen yüzeyli el (BufferGeometry, düz gölge, köşe rengi, yüz başına ton farkı). Her parmak 3 konik boğum + eklem şişkinliği, başparmak, pahlı avuç, eldivende boğum koruması / el sırtı paneli / bileklik + cırt bant / kıvrık kol ağzı, takım renginde kol. El başına TEK ağ; ikinci poz morph hedefi (parmak açma). Pozlar: fist, trigger, cup, open, ball, relax, claw, claw2.
- Yakın dövüş (bıçak / satır / tomahawk): sapı saran yumruk, ağız boğum yönünde (öne), CS tarzı bekleme (`MELEE_IDLE`), model ×1,22, sol alt köşede gevşek sol el; kol her karede bilekten sabit "dirsek" noktasına döner (savurmada ekranı kesmez); nefes sallanması + yürürken yalpa.
- Zombi: iki el kalkık "pençelemeye hazır", kemikli kanca parmaklar, sivri koyu tırnaklar, ince koyu çizikler, dişli yırtık kumaş; ten rengi türden (ZTYPES / ZBOSS skin); savururken parmaklar açılır (morph).
- Silahlar: tetik parmaklı kabza eli, ön kabzayı saran sol el; yüklemede açılıp şarjörü kavrar. Paintball hazne boyama (12.92) ile birleşti (`refreshWeapon` ikisini de yapar). Oyun etkisi yok (`scripts/meleehit.mjs`: önden 45/70/90, saplama 58,5, arkadan 999, vuruş anı 1 kare içinde). Viewmodel çizim çağrısı: bıçak 16 → 8, M4 18 → 16. Test: `scripts/fphands.mjs`.

### 12.98 Menü: mod / harita / gün saati değişiminde takılma
- Sorun: Özel Oyun'da mod değiştirince ekran anlık donuyordu. Ölçüm (CDP CPU profili + longtask): menü arka planı her `setWorld`'de haritayı tıklama içinde baştan kuruyordu (Enfekte → New York, dönüş → Kasaba; gün saati değişimi de yeniden kuruyordu): 250–830 ms donma, tık→boya 872 ms'ye kadar. Süre: z-fighting çözümü (`_zpass`), araç yerleştirme, eşzamanlı gölgelendirici derleme (Pixel 7'de 1,4 s).
- Çözüm: `menuScene.setWorld` işi boyanmış kareden sonra ayrı karelere böler (kurulum → ortam → `compileAsync` → aynı karede değiştirme), eski arka plan döner, yeni seçim eski işi iptal eder. Harita önbelleği (masaüstü 4, telefon 3); gün saati değişimi / aynı haritaya dönüş yeniden kurmaz; modun zorladığı haritalar (varsayılan + `only`'li: New York, Boya Kulesi) menü boştayken önceden kurulur. `builder.js` `_zpass` / `flushVehicles` sıcak döngüleri dizi üretmeden; çıktı birebir aynı; Kasaba kurulumu 722 → 390 ms, Üs 464 → 252 ms (oyun yüklemesi de hızlandı).
- Sonuç (`scripts/menuhitch.mjs`): mod / saat / hava / boyut / Oda Kur seçimlerinde uzun görev 0 ms, tık→boya ≤ 88 ms; haritanın oturumdaki ilk açılışında tek seferlik ~270 ms ertelenmiş kurulum. Birleşik sürümde depotest / limantest / pbmap / cgmodes / headless-sim geçti.

### 12.101 Paintball v2: hasar, halka nişangâh, top saçılımı, ekrana boya, toplanabilir kutular, paintball kıyafeti
- Hasar: pbrifle 12 → 18 (gövdeye 6 isabet), pbpistol 25 → 34 (3 isabet), kafa ×1,5; WSTATS + denge paneli (yeni: açılma bloom / bloomMax / bloomRec, "Paintball kutuları" grubu).
- Nişan (yalnız pb silahları): 1,15× yakınlaştırma; HUD halka nişangâh (halka + nokta, boya rengi; halka = o anki sapma), topun hız / yerçekiminden 20/30/40 m düşüş çizgileri; nişanda marker sağ-alta iner (hazne görüşü kapatmaz). Her topta doğal sapma + seri atışta açılma, bırakınca ~0,6 sn'de toparlanır; nişan / çömelme / durma küçültür; tohumlu (istemci = sunucu). 25 m: kısa seri %77–100, sürekli %30–60.
- Ekrana boya (`src/game/screenPaint.js`, tek tuval, boşken gizli): atıcı yönünde atıcı renginde leke, akıntı, ~2,6 sn söner, en çok 6; kafa → ortada büyük yarı saydam leke; elenince ekran boyanır + "BOYANDIN!" sonra ölüm ekranı; yakın geçen top → kenarda damlacık + vızıltı.
- Kutular (`src/game/pickups.js`): Boya Kulesi'nde 6 boya topu + 4 can (+TUNE.pbHeal 40); yeniden belirme TUNE.pbAmmoRespawn / pbHealthRespawn (20 sn); dönme + iniş-çıkış + hale, beklerken gizli. Sunucu yetkili alma (1,2 m; doluyken alınmaz, aynı adımda en yakın alır), 'pk' olayı + welcome.pk; canı / cephanesi azalan bot kutuya gider. Başka haritalar `map.pickupSpots` ile tanımlar. 4 çizim çağrısı.
- Kıyafet (pb): `createCharacter({ outfit:'paintball', paint, num })` — kişisel boya renginde dolgulu forma, kontrast paneller, göğüs / sırt numarası, tam yüz maske, dizlikli pantolon, dolgulu eldiven, top kabı; vuruş kutuları ve lekeler aynı; birinci şahısta yalnız kol / eldiven rengi.
- Önceki ajan yarıda durdurulmuştu (iş 50680d2'de WIP olarak saklanıp yeni ajanla bitirildi). i18n: `src/i18n/pb.js`. Testler: pbtest (genişletildi; gecikme telafisi eşiği 8/12 — hedef koşarken engele takılınca önü sapar, eski sürümde de 9–12 aralığıydı), pbpicknet, pb2shots, pbnet (GPU=1), pbmap, pbmapnet.

### 12.102 Yeni paintball haritası: Orman Kalesi (pb artık iki haritada)
- Boya Kulesi'nin tersine yatay, ağaçlarla bölünmüş çam ormanı sahası (`src/maps/ormankale.js`, 56×56 m, 2–12 kişi): ortada iki katlı kütük kale (alt kat kapalı, 4 kapı; 3 m surlu güverte, dış merdivenler; 5,64 m gözcü kulesi), güneyde içinden yürünen sığ dere + üç tahta köprü + devrik kütük, köşelerde Kütük Kulübe / Hurda Köşesi / Gözetleme Kulesi / Saman Tarlası, palet barikatı, çam koruluğu, çit hattı, hakem kulübesi.
- Çarpışma birebir eksen hizalı; yuvarlak parçalarda görselin içinde; yaprak çarpışmasız, bot görüşünü keser. `ffaSpawns` 22, `navLayers`, `pickupSpots` 10. Kale sur ağzı 1,7 m (botlar takılıyordu).
- pb iki haritada: `server/room.js` `PB_MAPS`, `officialStore.MAPS_FOR('pb')`, admin ve menü listeleri. Yük: 16 ağ / ~61 bin üçgen. Testler: `scripts/ormankaletest.mjs`, `ormankalenet.mjs`, `ormankaleshots.mjs`.

### 12.103 Maç sonu: menüye düşmeden sonraki maç, resmi odalarda harita + gün saati oylaması, her moddan resmi oda
- Sorun: maç bitince çevrimiçi istemci sayfayı yeniliyordu; URL'deki sunucu parametresi kayboluyor, girişte "Maç bitti" hatası menüye atıyordu. Şimdi sunucu yeni maçı kurup aynı bağlantıda yeni `welcome` yollar, istemci sayfa yenilemeden oyunu yeniden kurar (`src/main.js`, `src/net/client.js`). Maç sonu ekranında gelen oyuncu bekler, yeni maça kendiliğinden katılır.
- Resmi oda: sonuç ekranında 3 seçenek (harita + gün saati + hava), yalnız insanlar oy verir (botlar vermez); çoğunluk kazanır, eşitlikte rastgele, oy yoksa düzende sıradaki; herkes oy verince 3 sn. Oyuncu odası oylamasız, aynı ayarla düzende devam eder. Çevrimdışı: 3 seçenek + 15 sn geri sayım, Hemen başla / Menüye dön (`src/game/endFlow.js`, `nextMatch.js`, `src/i18n/match.js`).
- Boş resmi oda `idleMin` (varsayılan 10 dk) dakikada bir yeni haritaya geçer; `voteSec` (15 sn) ve `idleMin` admin paneli → Sunucular'da.
- Varsayılan resmi liste her moddan bir oda (OFC1–OFC8; gg, inf, pb eklendi; pb düzeni Boya Kulesi + Orman Kalesi). Mevcut `data/official.json`'a eksik modlar bir kez eklenir (`officialStore.migrateModes`, admin düzenlemeleri korunur, silinen mod geri gelmez). `MAPS_FOR` artık tek yerde (`server/room.js`).
- Telefonda maç sonu düğmeleri ≥ 40 px (mobilepass).
- Testler: `scripts/matchcycle.mjs` (WS, BF_RESTART_MS / BF_EMPTY_ROTATE_MS), `matchflow.mjs` (tarayıcı, Pixel 7 dahil), `officialmigrate.mjs`, `adminvote.mjs`; endtest / lobbytest yeni akışa göre.

### 12.104 Ana menü yenilendi + dil desteği (Türkçe / English)
- Tasarım (`src/menuStyle.js` baştan, `src/menu.js`, `src/main.js`): turuncu / koyu kimlik ve Bahnschrift / Rajdhani korundu. Sol menüde çizgi ikonlar (seçili: turuncu şerit + dolu ikon), her ekranın başında büyük başlık + kısa açıklama (Çevrimiçi'de sunucu durumu). Ana Menü: sol altta seçili harita büyük başlıkla, Hızlı Oyun + Rastgele maç / Özel oyun / Çevrimiçi; sağ üstte yenilikler + teçhizat kartı. Üst çubukta TR / EN. Ekran geçişinde kısa giriş animasyonu, klavye odağı görünür. Kontroller iki sütun, Ayarlar'da açma-kapama düğmeleri. Yükleme ekranı harita + mod + seçili dilde ipucu.
- Telefon: logo altyazısı gizli, menü ikon + ad, alt Oyna çubuğu küçük, oda kartlarında küçük resim / RESMİ etiketi gizli (adlar kesilmez); tüm dokunma hedefleri ≥ 40 px.
- Dil: `src/i18n/menu.js` (menu.*), `src/i18n/data.js` (harita / mod / sınıf / silah / zorluk / nişangâh / gün saati / hava / tuş adları; yardımcılar mapName, modeLabel, className, weaponName …; sözlükte yoksa kaynak veriden). Seçim `warbyte.lang`'da kalır, `html lang` güncellenir; varsayılan: tarayıcı Türkçeyse tr, değilse en. İngilizcede harita adları da çevrildi (Township, Valley, Military Base, Desert Pass, Warehouse, Harbor, Paint Tower, Forest Fort, Quarry Mine). Sunucunun Türkçe hata metinleri ve "Resmi Sunucu #N" istemcide çevrilir.
- Test: `scripts/menushots.mjs` (tr + en, masaüstü / Pixel 7 / iPhone 14; İngilizcede Türkçe harf yok, taşma yok, dokunma ≥ 40 px, menüden hızlı maç + çevrimiçi oda).

### 12.105 Oyun içi ekranlar yenilendi + İngilizce (ölüm ekranı, HUD, duraklat, ayarlar, skor tablosu, sohbet)
- Ölüm / doğuş ekranı: üstte öldüren kartı (ad takım renginde, sınıf · takım, silah, mesafe, KAFA ATIŞI rozeti, öldürenin kalan canı) + turuncu geri sayım halkası; altta 5 sütun sınıf kartı (ana silah · gadget ×adet) ve doğma noktası listesi. Kendi ölümünde gri kart + sebep; enfekte / silah yarışı notları ayrı şeritte. Bilgi `hud.killFeed`'de yakalanır (çevrimdışı + çevrimiçi aynı).
- HUD: takım şeritli skor çubuğu, pusulada derece etiketleri, bayrakta halka ilerleme, mini harita başlığı "HARİTA · bölge", 4 bölmeli can çubuğu, öldürme akışında silah rozeti + kafa simgesi, düşman üssü uyarısı ok biçiminde. Duraklat dikey liste (telefonda 2 sütun) + "mod · harita"; skor tablosu başlığı (mod, harita, süre), sıra numarası. Oyun içi ayarlarda en üstte Dil / Language.
- Dil: `src/i18n/game.js` (hud. death. pause. set. sb. chat. end. + silah / zombi / nişangâh / yer adı yardımcıları; yer adları İngilizcede kelime kelime). Dil canlı değişir (onLang). "Paintball" Türkçe büyük harfte "PAİNTBALL" olmasın diye lang="en".
- Test: `scripts/hudshots.mjs` (6 mod × tr/en × masaüstü/Pixel 7). ffaleader tarayıcı yereli tr-TR.

### 12.106 Vuruş / öldürme hissi, katmanlı sesler, ortak AudioContext, lobi müziği
- Öldürme hissi (`src/game/killfx.js`, katman `#kfx`): hasara göre büyüyen isabet işareti (gövde beyaz, kafa altın, öldürmede kırmızı iri X); ortada kurukafa + ELENDİ / KAFADAN / BIÇAKLA + kurban adı + silah + puan; 4,5 sn içinde ÇİFT / ÜÇLÜ / DÖRTLÜ / KATLİAM, ölmeden seri 3 / 5 / 7 / 10; kenar parlaması + hafif sarsıntı; akışta kendi öldürmelerin altın, seni öldüren kırmızı. Telefonda küçük, nişangâhın altında. Metinler `src/i18n/fx.js`.
- Sesler (`audio.js`): silah ailesi profilleri (çatlama + gövde + gümbürtü + kuyruk), uzaklıkla boğuklaşma + ses hızı gecikmesi, ortak yankı (iç mekânda artar), sınırlayıcı (üst üste patlamada kırpma yok); metal tıklı yükleme, yeni adım / çarpma / patlama. Paintball sesleri (kutu, vızıltı, yüze şaplak) yeni ses yoluna taşındı.
- `src/game/actx.js` tek AudioContext (maç başına açılıp kapanmayan bağlam sızıntısı bitti), ilk dokunuşta açılır; menü düğmelerinde tık sesi.
- Lobi müziği (`music.js`): `lobby.mp3` yoksa prosedürel (84 BPM, Am9 – Fmaj7 – C – G6), Ana × Müzik sesine uyar, gizli sekmede susar, maçta durur.
- Test: `scripts/sfxtest.mjs`.

### 12.107 Yeni mod: Vagon (payload) + Maden Ocağı haritası
- Mavi saldırır, patlayıcı yüklü vagonu raylar boyunca A · Makas → B · Kantar → C · Maden Ağzı'na iter; Kırmızı durdurur. Vagon yalnız 3,5 m içinde saldıran varken ve savunan yokken ilerler (1 kişi 1 m/sn, ek kişi +%25, en çok 3); ikisi de varsa ÇEKİŞME. Saldıran 20 sn uzak kalırsa 0,35 m/sn geri kayar (geçilen noktanın gerisine düşmez). 5 dk + kontrol noktası başına 120 sn, iki takımın doğuşu ileri kayar; süre biterken saldıran vagondaysa UZATMA; ağza ulaşınca kapı patlar (bitiş ekranı 2,2 sn sonra). Tüm sayılar admin → Oyun modları → Vagon (`TUNE.pl*`, `LIMITS.plTime`).
- Kod: `src/game/payload.js` (kural, hareketli AABB vagon: mermiyi keser, önüne gireni iter; ağ paketi `pl`), `track.js` (Bezier köşeli ray), `payloadHud.js` (ray ilerleme çubuğu, durum satırı, dünyada / pusulada / mini haritada vagon), `src/i18n/payload.js`. Botlar: saldıranlar vagonu iter / yol açar, savunanlar önüne geçer / sıradaki noktada siper tutar.
- Harita `src/maps/maden.js` + `madenSurface.js` (96×72 m): 128 m ray; Kırma Tesisi ve Lavvar'ın içinden, Kantar sundurmasının altından geçer; taş ocağı basamakları, yükleme rampası, köy evleri, su kulesi, Ambar, Demirci, Kantin, Kömür Bunkeri. Üç doğuş aşaması, her aşamada doğuşlar birbirini görmez. 25 ağ / 27 bin üçgen.
- i18n: Node'da her zaman tr (Node ≥ 21'de `navigator.language` olduğu için sunucu metinleri İngilizce çıkıyordu).
- Testler: `scripts/pltest.mjs`, `plnet.mjs`, `plonline.mjs`, `plshots.mjs`, `plmenu.mjs`.

### 12.108 Kasaba: yerleşim temizliği + dünya koordinatlı yüzey
- Denetim `node scripts/mapgeo.mjs <harita> [--list]` (görsel + çarpışma OBB): kesişen 96 → 0, havada 51 → 0, gömük 2 → 0, çarpışmasız engel 16 → 0, kapı önü 3 → 0, yol üstü yapı 20 → 2 (şikân konteynerleri, bilinçli).
- Avlu köşesinde tek sütun, sancak sütun başında; ev-1 ve benzinlik marketi yan sokaktan, kilise kaldırımdan çekildi; belediye revakı tek saçak; ağaç / çalı / kaya yapıya ve araca değmez; lambalar yola bakar. Ortak kit: bank sırtlığı, çit köşe direği, depo yan kapısı, çan askısı, silo basamağı, araç aynası / direksiyonu, açık kapı kanadı 90° ve çarpışmalı.
- Yüzey `src/maps/kasabaSurface.js` (UV yok, çizim çağrısı artmaz); gece kameraya en yakın 12 lambadan sahte ışık. 430 bin → 379 bin üçgen. Testler: `scripts/kasabatest.mjs`, `kasabashots.mjs`.

### 12.109 Vadi: havada / iç içe / görünmez çarpışma temizliği, düz bina tabanları, yüzey ve su
- Denetim `scripts/mapaudit-vadi.mjs`: havada grup 31 → 4 (kalan: ortak araba modelinde 9 cm cam kasası), yamaçta altı boş taban 826 → 0, iç içe çarpışma 15 → 0, iç içe görsel 24 → 0, görünmez çarpışma 77 → 34 (ortak mobilya / araç), z-fight 12 → 0.
- Bina tabanı düz (patika / nehir bazı evlerde araziyi zeminden 1,4–2 m yukarı kaldırıyordu); `terrain.tri` fizik = çizilen yüzey. Çakışan yerleşimler ayrıldı (karakol-ev, kulübeler, saman-ev, çit-silo, tepe kulesi 1,6 m güneye), eşyalar yamaçta zemine oturur, bunkere beton kaide, çadıra platform; çalılar bot görüşüne eklendi; köprü ayakları ve su çarkı katı.
- Yüzey `src/maps/vadiSurface.js` + arazi ayrıntısı + su (derinliğe göre renk, akan dalga, kıyı köpüğü). Testler: `mapaudit-vadi`, `vadishots`.

### 12.110 Askeri Üs: yerleşim temizliği + yüzey
- Denetim `scripts/mapaudit-us.mjs` (13 denetim): 717 → 0 (iç içe 215, havada 280, içinden geçilen katı 183, kapı önü 15 …).
- Çevre duvarı köşe birleşimi, projektörler dikme tepesinde; kamp kapı dikmeleri duvara gömülmüyor; hangar uçağı sütunlar arasında, asma kat merdiveni arka kapıyı kapatmıyor; radar kulesi üst kat kapısı kaldırıldı; boru rafları duvardan duvara, kamuflaj ağı tek parça; bina eşyası duvara yaslı; araçlarda havada parça / görünmez çarpışma düzeltildi (vehicles.js, Kasaba düzeltmeleriyle birleştirildi).
- Yüzey `src/maps/usSurface.js` (16 sınıf; iç mekânlar artık karanlık değil), gece en yakın 12 lamba. Testler: `usshots`, `usperf`, `usleak`, `MAP=us cgmodes`.

### 12.111 New York 2. doku geçişi + ürkütücü zombiler
- `citySurface.js`: kutu yüz UV'si korunur, cephe pencere ızgarası `tower()` ile birebir; taş denizlik / lento / köşe taşı / kat silmesi, pencereden yükselen is, dükkân ayağı, grafiti, kornis; pencerede derin oda eşlemesi (perde, TV, yangın / kırık cam, tahta, mum); kepenk, kırık vitrin, eğimli tente, düzensiz yanık delikler; asfaltta lastik izi, çukur, buharlı rögar. Gece (`nyfx.js`): havada ateş küpleri yerine alev dilleri, lamba ışık konisi, bozuk neonlar.
- Zombi (`src/models/zombieBody.js`): türe özgü gövde (kambur, uzun kol, kara pençe, yırtık giysi, açıkta kaburga, parlayan çökük göz); Koşucu sıska, Dev kemik plakalı, Hayalet yarı saydam kefen, Işınlanan mor kristal, Boss boynuz + sırt dikeni + parlayan göğüs yarığı; sendeleme / topallama / süzülme. Vuruş kutuları değişmedi; çarpışma / nav / doğuş özetleri birebir. Çizim çağrısı 131 → 119. Test: `scripts/ny2shots.mjs`.

### 12.112 Görsel kalite: silah cilası, gök, kalite kademeleri, son işleme
- Silah cilası (`weaponFinish.js`, doku yok): parkerize çelik, eloksal, krom, pirinç, polimer, kauçuk, vernikli ahşap, cerakote, kaplamalı cam / mercek; parça kenarında çıplak metal aşınması; birinci şahıs çizim çağrısı 409 → 354.
- Gök kubbesi (ufuk = sis rengi) + güneş halesi; ortam yansıması haritanın göğünden; gün saatine göre pozlama / renk.
- Kalite: gölge 1024 / 2048 / 4096, Orta+ yumuşak PCF, gölge kutusu bakış yönüne kaydırılır; telefonda 1024. Birinci şahıs silah ışığı haritanın güneşi / göğüyle.
- Son işleme (`post.js`, yalnız Yüksek + "Son işleme"; telefonda varsayılan kapalı): MSAA, parıltı, renk tonu, vinyet; menü ve oyun içi ayarlarda düğme. Test: `scripts/gfxshots.mjs`, `weapondraws.mjs`.

### 12.113 Zombi gücü hissi: yerel oyuncuya güce özel ekran / ses geri bildirimi
- Önceden güç kullanınca yalnız alttaki çubuk doluyordu. Yeni katman `src/game/abilityfx.js` (#abfx, HUD'un altında; DOM / CSS + tuval CSS filtresi, son işleme yok), yalnız yerel zombi oyuncuda; durum yerel askerin abT / abActive değerinden okunur → çevrimiçi istemcide de çalışır (bekleme süresi sıçraması = etkinleşme).
- Öfke: kalp atışı ritminde kızıl kenar + atış sesi, sarsıntı, FOV vuruşu, kızıl parlayan pençeler, hızlı adım. Atılış: kenarda hız çizgileri, FOV +13°, rüzgâr, adım temposu ×1,35. Zırh: çelik mavisi kenar + çatlak zırh, isabette sekme parlaması + metal çınlaması (kırmızı hasar göstergesi soluk). Görünmezlik: soluk / hayalet ekran, yarı saydam eller, ışıltı; bozulunca "GÖRÜNDÜN" parlaması. Işınlanma: parlama + çizgi geçişi + FOV sıkışıp bırakma. Gölge Sıçrayışı (boss): mor dumanlı koyu kenar + derin gümbürtü.
- Ortada güç adı + alt yazı canlanır, bitince "… BİTTİ"; HUD'da iri geri sayım, güç renginde çubuk; güç HAZIR olunca gösterge parlar + kısa ses (HUD artık className yerine classList kullanır, parlama silinmez). Kendi gücünde 1. şahısta dünya kıvılcımları çizilmez. Telefonda küçük yazı, bulanıklık yok. Metinler `src/i18n/zab.js`. Önceki yarım iş (6d34d72) taşındı.
- Testler: `scripts/abilityfx.mjs` (GPU, 6 güç × masaüstü / Pixel 7), `scripts/abilityfxnet.mjs` (çevrimiçi 'ab' kenarı).

### 12.114 Birinci şahıs elleri v2: robot değil insan eli
- Sorun (kullanıcı): eller robot gibi, kabza tutuşları hatalı, bıçakta kol kırık gibi. Eller ayrı düz bloklardı, bıçakta kol sağ alta / yumruk sol üste bakıyordu, boştaki sol el iskelet pençe, tüfekte sol el kundağın 3–5 cm altında havada, tabancada tek el.
- El modeli `src/models/fpHumanHand.js`: yumuşak gölgeli tek ağ; parmaklar uca doğru incelen kesintisiz tüpler (eklemde hafif şişlik, yuvarlak uç), kalın avuç, başparmak kası, tek yumuşak boğum hattı, bilekten kola tek tüp; mat koyu zeytin eldiven. Zombi pençesi bilerek köşeli / kemikli kaldı.
- Bıçak bekleme (`player.js` MELEE_IDLE): kol sağdan gelir, bıçak öne-yukarı-sola; bilek bükümü ~15°, sap avuçta çapraz (KNIFE_TILT 0,5, `knife` pozu boğum eğimi `sl`), boştaki sol el kaldırıldı, yakın dövüş ölçeği 1,22 → 1,1.
- Tüfek sol eli (`foreFit`): ön kundak ışınla ölçülür, avuç alt yüze değer, parmaklar sarar, başparmak öne uzanır (`fg` pozu); dikey tutamakta (M4, SCAR, AUG, Vector, AA-12) kabza gibi sarar. Tabancalarda sol destek eli (iki el; yüklemede şarjöre gider). Paintball kol / eldiven rengi aynı.
- Yük: el başına ~1800 üçgen (eski ~500), çizim çağrısı aynı (tabancada +1). Testler: `scripts/fphands2.mjs` (GPU, masaüstü + Pixel 7), `fporbit.mjs`, `handlab.mjs`. Önceki yarım iş (4b55f55) taşındı.

### 12.115 Mobil: nişangâh seçici + keskin çözünürlük, dokunmatik zombi gücü butonu, dokunmatik metinler İngilizce
- Önceki mobil iş (f99d846, gece işi başında birleştirilmeden kalmıştı) yeni arayüz / i18n / kalite kademeleriyle birleştirildi.
- **Nişangâh seç** (dokunmatik): birden çok nişangâhlı silahta sağ üstte buton (taşınır / boyutlanır), büyük kartlı seçici (masaüstündeki T tekerleğinin karşılığı); tek nişangâhlı silahta gizli. Çevrimiçinde sunucuya `opt` gider (Player.pickOptic ortak yol). **Nişangâh boyutu** (Dokunmatik ayarlar → Hassasiyet, %60–180); telefon nişangâhları büyük + koyu kenarlı, dürbün çizgileri ≈ 2 kat kalın.
- **Keskin otomatik çözünürlük** (telefon): 0,25× adım, taban DPR ≥ 2'de 1,25× (eski 0,75× kalıcı bulanıklık yapıyordu), tabanda bile < 24 FPS sürerse 1×; post.js çizim tamponu boyutunu her kare okur. Dokunmatikte dürbünsüz nişan yakınlaştırması ×2; telefon FOV varsayılanı 85 → 80 (bir kez taşınır).
- **Zombi gücü butonu**: kullanıcı "mobilde zombi yeteneğini kullanamıyorum" dedi. Zombiyken ekipman yerinde yıldırım butonu: HAZIR yeşil parlar, etkinken turuncu + saniye, beklemede gri halka + saniye; masaüstündeki F / sağ tıkla aynı yol (Player.zAbility, çevrimiçinde 'ab'). Zombiyken nişan / nişangâh / şarjör / silah değiştir / ekipman gizli; insanken güç butonu yok.
- Dokunmatik metinler İngilizce de (`src/i18n/touch.js`); Dokunmatik ayarlar paneli telefonda 14 px taşıyordu (Kaydet satırı kesik): düzeltildi. BF_DEBUG: dbg `{ zb:'tür' }` zombi ol, `{ ask }` nişangâh + güç durumu.
- Testler: `scripts/mobileoptics.mjs`, `scripts/mobileability.mjs` (gerçek dokunuş; çevrimiçi adım GPU=1), hudshots dokunmatik denetimleri.

### 12.116 Paintball: hayattayken ekranın ortası boyanmaz
- Kullanıcı: "bazen ekranın ortası boya oluyor, görüş açım kapanıyor; yalnız öldüğümde ortası boya olsun". Sebep: kafa isabeti lekesi ortaya konuyordu (r 0,34), önden gelen büyük gövde lekeleri de ortaya taşabiliyordu.
- `screenPaint.js`: kafa isabeti artık atıcı tarafındaki üst köşede (r 0,24, yarı saydam); her canlı leke `_clear` ile nişan alanının dışına itilir (merkezden en az r·0,9 + 0,17 ekran yüksekliği, en-boy oranıyla). Elenme boyaması ("BOYANDIN!") değişmedi.
- Ölçüm (`scripts/pbscreen.mjs`, 6 yön × kafa / gövde, 36 isabet): ortadaki nişan alanında boya masaüstü %98 → %0,3, Pixel 7 %94 → %0; önden 8 kafa isabeti %99,9 → %0; elenince orta %100.

### 12.117 Paintball top düşüşü azaldı + dokunmatik nişan yardımı v2
- Kullanıcı: "paintball topu aşağı gidiyor, olması gereken ama çok fazla" → tüfek hız 70 → 78 m/sn, yerçekimi 7 → 4; tabanca 60 → 66, 10 → 6. Düşüş: tüfek 30 m'de 0,64 → 0,30 m, 40 m'de 1,14 → 0,53 m; tabanca 30 m'de 1,25 → 0,62 m. Halka nişangâhın düşüş çizgileri ve bot öne alması stats'tan otomatik.
- Kullanıcı: "mobilde nişan alırken hâlâ zorlanıyorum". Eski yardım koşan hedefi takip etmiyordu (nişangâh geride kalıyordu) ve paintball'da göğse çektiği için top düşüp ıskalıyordu. `touch.js assist` v2: koni ≈ 6,3° + gövde açısı (eski 4°), çekiş kalça 2,4 → 5, nişan 3,2 → 7, nişana giriş 9 → 12 (0,22 sn), tavan 52 → 75°/sn, koni kenarında da çeker; bakış yavaşlatma en çok %45 → %55. Yeni takip: aynı hedefin bu karedeki açısal kayması ~%85 oranında nişangâha eklenir (en çok 2,5 rad/sn). Topçu silahta çekiş noktası uçuş süresi × hedef hızı kadar öne, düşüş kadar yukarı; hedef seçimi gövde ya da bu noktadan hangisine yakınsa. Güç kaydırıcısı (Dokunmatik ayarlar) aynen çalışır.
- Ölçüm `scripts/aimassist.mjs` (Pixel 7, botlar donuk, 5,6 m/sn yana gidip gelen hedef, GPU=1): M4 20 m nişanda ortalama hata 19,4° → 0,20°, hedef üstünde %0 → %100; paintball 22 m sürekli ateş 31 toptan isabet 1 → 4 (kalan: bilinçli seri atış açılması + ani yön değişimi).

### 12.118 Hesap: misafir ya da ad + şifreyle hızlı kayıt
- Kullanıcı: "oyuna giren misafir olarak (ad seçip) ya da hızlıca kayıt olup (ad + şifre) girsin, karmaşık olmasın". İlk açılışta (oturum yoksa) menünün üstünde giriş kartı: Misafir sekmesi = ad + "Misafir olarak oyna"; Hesap sekmesi = ad + şifre, "Giriş yap" / "Kayıt ol". E-posta, onay, captcha yok. Oturum `warbyte.acct`'te kalır, sonraki açılışta kart çıkmaz. `?autostart=` / `?editor=` / `?online=` kartı atlar; eski test betikleri için `?nologin=1`.
- Menü: oyuncu kartında hesaplıda ad sabit + HESAP rozeti + Çıkış, misafirde ad düzenlenir + MİSAFİR rozeti + Hesap (ad korunarak kayıt). Telefonda hesap satırı sol menünün en üstünde.
- Sunucu `server/accounts.js` → `data/accounts.json` (atomik yazım, izin 600): ad 3–16 karakter (harf / rakam / _ / Türkçe harf), büyük-küçük ve noktalı-noktasız i aynı ad; şifre en az 4, scrypt + kullanıcı tuzu, sabit zamanlı karşılaştırma; jeton 32 bayt (dosyada yalnız sha256), 90 gün, en çok 10 cihaz. Uçlar oyun sunucusunun portunda: /api/register · login · logout · me · profile. Gövde 4 KB; giriş + kayıt IP başına dakikada 10 (BF_ACC_RATE). Metinler `src/i18n/account.js`.
- Odadaki ad: WS katılımı jetonu taşır, sunucu hesabın adını kullanır; jetonsuz / sahte jeton = misafir; misafir kayıtlı adı alırsa sonuna sayı (Ali → Ali2).
- Profil (XP + maç / zafer / öldürme / ölüm) hesaplıda sunucuda da: alan alan büyüğü tutulur, maç sonunda yazılır; misafirken kazanılan seviye kayıtta hesaba geçer.
- Admin "Hesaplar": liste, sil, şifre sıfırla (yeni şifre bir kez gösterilir, oturumlar kapanır). nginx değişmedi.
- Testler: `scripts/accounttest.mjs` (API=… ADMIN=… DATA=…; varsayılan hız sınırlı sunucu), `scripts/accountui.mjs` (BF_ACC_RATE=100 sunucu; masaüstü / Pixel 7 / iPhone 14, tr + en).

### 12.119 Birinci şahıs elleri v4: koyu taktik eldiven, düz bilek (CS tarzı)
- Kullanıcı: gerçekçi el taslakları (WebXR / MakeHuman, 12.114 sonrası araştırma) ve v2 eller "normal el gibi değil, kollar çok ince"; istenen: çıplak el yok, eldiven, tombul, çok görünmesin. v3'te tombul çizgi film eldiveni (beyaz / koyu, siyah ana hat) yapıldı; sonra kullanıcı koyu rengi seçti ve asıl sorunun bilek olduğunu söyledi ("bıçakta bilek kırık gibi"; referans CS:GO M9 bekleme, AK / AWP bel).
- `src/models/fpGlove.js`: yastıklı avuç, kalın kapsül parmaklar, boğum yastıkları + el sırtı bandı, uzun bilek ağzı, kalın kol; aynı ağda ters sarımlı siyah ana hat kabuğu (çizim çağrısı artmaz); 3 basamaklı toon ışık. Varyant `?glove=dark` (varsayılan) / `white` / `human` (eski el), `localStorage['warbyte.glove']`.
- Bilek kuralı (`player.js` armFor): ön kol yönü el ekseninden çözülür, istenen yöne en çok 13–17° döner (bıçakta ≤ 8°) → elin sırtı ön kolun devamı. Bıçak: ön kol sağ alttan düz, boğumlar yukarı-dışa, bıçak başparmak tarafından öne-yukarı-sola; boştaki sol el sol altta gevşek açık. Tüfek: kundak eli ön kolla aynı çizgide alttan kavrar, tetik eli kabzada (kolu ekran dışında); tabanca belde iki el kabzada. Tetik / tabanca kolları ayrı parça (dirsek silahla dönmez, nişanda iner). Bel duruşu (0,13 / −0,2 / −0,41): silah daha iri.
- Bilinen: nişanda kalın kollar ekranın altında yer kaplar; bombada kol yatay. Yük: çizim çağrısı aynı ya da daha az, el üçgeni ~11k. Test: `scripts/gloveshots.mjs` (karşılaştırma /tmp/wb-glove-shots/v4/compare-ref.png).
- mobilepass ölüm ekranı denetimi ara sıra düşüyordu: test doğuş korumasını `prot` ile kapatıyordu, alan `protT` (test düzeltildi).

### 12.120 Birinci şahıs kare eller (V3) oyunda + 6 Unturned tarzı silah
- Kullanıcı: "eller çok kötü: bıçak ucu kırık, eller / kollar şişko, mermi değiştirirken kol çıkıyor, parmaklar silahın içinden geçiyor… gerçekçi olsun demiyorum, Unturned'da parmak bile yok, oyunla bütün güzel görünsün". Teşhis: eski sistemde iskelet / soket / IK yoktu; el sabit pozlu tek ağ, silaha elle girilmiş ofsetlerle yapışık, kol ya ele gömülü ya her karede sabit dirseğe döndürülen ayrı tüp; bıçak ucu modelde küt kutu + duruş matrisi dik değildi; tetik eli ekseni kabzaya ters (AK'de ~34°); iskelet ×1,22 büyütmeli. Parmaklı el denemeleri (handlab3 soket + IK + temas çözücü, WRAD ARMS CC0 varlığı) yapıldı; kullanıcı BattleBit / Unturned referanslarıyla parmaksız kare eli seçti (handlab4 V3).
- `src/models/boxArm.js`: parmaksız pahlı kutu el (parmak yüzünde 3 koyu oluk, açık üst yüz, bıçak / tabanca / bombada başparmak kutusu) + ekran dışı dirseğe giden prizma ön kol + koyu manşet; el silah soketine rijit, IK yok. Kol başına tek ağ / tek çizim çağrısı (~42–48 üçgen). fitSockets: kundak altı ışınla ölçülür (eski modellerde de oturur), dikey tutamakta kabza gibi, ilk yardım / cephane kutusu / claymore iki yandan, el ham parçalara > 3 mm batarsa 1 mm adımla kaçar.
- `src/game/fpAnims.js`: bel duruşları (tüfek ×1,5, diğer ×1,25 → nişanda 0,92), koşu, yükleme / fişek / sürgü / pompa / savurma / pim / fırlatma / inceleme (anim.js eğrileri; üçüncü şahıs ve sunucu zamanlaması değişmedi).
- ViewModel (`player.js`) yeniden yazıldı: organik eldiven, bilek kuralı, bıçak bekleme matrisi, ayrı kollar kalktı; şarjör düşer + solar; kurma kolu / pompa / sürgü / tabanca sürgüsü / fişek alt grupları; atıştan sonra sürgü (önceden ölü koddu) ve pompa; bomba kuşanınca pim, atıştan sonra sağ el görünür kalır. Zombi pençesi eski yol aynen; paintball kolu boya renginde; sol el modu, mobil nişan solması, abilityfx uyumlu.
- `weapons.js`: AK-47, M4A1, Pompalı, Glock, M24, Bıçak Unturned tarzı (iri blok, 2–3 düz renk, cilasız, kırmızı namlu ucu, bıçak ucu sivri); red dot = halka nişangâh; holo / ACOG / demir için MOUNT yeni ölçüler (nokta nişangâhta, weaponaudit 35/35).
- Yük: AK sahnesi 14 → 9 çizim çağrısı, ~11 900 → 352 üçgen (el ~11 300 → 84).
- Testler: `fphands2` (kare el: 33 silah / eşya, batma ≤ 3 mm; `node scripts/fphands2.mjs <çıktı> <url>`), `boxfit`, `boxhands` + `boxhandsheet.py`; gloveshots / fporbit / handlab v1 kaldırıldı. Laboratuvarlar: `handlab3.html` (parmaklı el, soket + IK), `handlab4.html` (elsiz / kare el / silah taslakları).
- Bilinen: keskin nişancı sürgüsünde sağ el belde görünmez; bıçak savurma kurulmasında bıçak ~0,1 sn sağ üst köşeye çıkar; telefonda nişanda kutu eller de yarı saydam. Kalan silahlar ikinci turda Unturned tarzına çevrilecek; `fpGlove.js` / `fpHumanHand.js` yalnız zombi yolu için yükleniyor (temizlenebilir).

### 12.121 İlk kutu ellere ve eski silahlara dönüş
- Kullanıcı kare el V3'ü (12.120) ve Unturned tarzı 6 silahı beğenmedi: "en ilk kutu el sürümü + son silah revizyonu geri". `src/models/weapons.js` `bdecbe0` haline döndü (birebir); Unturned taslakları yalnız `src/lab4/weaponsUnturned.js` laboratuvarında.
- Birinci şahıs ViewModel'i `bdecbe0` temelinde: paintball forması (kol = boya rengi, eldiven koyu), telefonda nişan soluklaşması (`setFade`), `adsLow`, sol el aynası, inceleme, nefes, silah ışığı (`_vmLights`), zombi pençesi (12.97 / 12.113) aynen. El kurulumu, bel duruşu (0,2 / −0,21 / −0,66), bıçak duruşu ve yüklemede sol el hareketi `73b388f`'den: eldiven renkli 0,10×0,10×0,12 kutu el + gömlek renkli 0,5 m kol kutusu, bıçakta sapı saran kutu yumruk, sol el ön kundakta.
- Tek bilinçli fark: bombada el 3,5 cm aşağı / 1 cm geri (`GRENADE_UP`), bomba kutunun içine gömülmez.
- Kaldırılanlar: `boxArm.js`, `fpAnims.js`, `HOLD_OFF`, boştaki sol el, yakın dövüş ölçeği; `boxfit`, `boxhands`, `boxhandsheet.py`. `fphands2.mjs` `bdecbe0` sürümüne döndü. Karşılaştırma (73b388f | şimdi): `/tmp/wb-restore/sheet.png`.
- El denemelerinin geçmişi (sırayla): 73b388f kutu el → 12.97 organik eldiven → 12.114 insan eli → v3 tombul beyaz eldiven (canlıya çıkmadı) → 12.119 koyu eldiven + düz bilek → 12.120 kare el V3 + Unturned silahlar → 12.121 tekrar 73b388f kutu el. Laboratuvarlar: `handlab3.html` (parmaklı el, soket + IK, WRAD ARMS dalı `wrad-arms-lab`), `handlab4.html` (elsiz / kare el / Unturned silah).

### 12.122 S3 BattleBit silahları oyunda + kaplamalar + nişan (ADS) iyileştirmesi
- Kullanıcı silah laboratuvarındaki (`weaponlab.html`: S1 Sade / S2 Orta / S3 BattleBit) S3 tarzını onayladı ve nişan almanın ayrıca iyileştirilmesini istedi. Araştırma: BattleBit seviyesi düşük poligon silah tarayıcıda kasmaz; darboğaz çizim çağrısı ve doku dolumu.
- AK-47, M4A1, Glock 17, M24 ve yeni Pompalı S3 kitiyle tek ağ + cam (`src/models/s3kit.js`, `s3weapons.js`). `finish()` sözleşmesi korundu (namlu / kabza ±1 cm, mermi / hasar aynı, sunucu modelsiz). 3. şahısta S3 LOD ≤ 600 üçgen; kutu eller (12.121) yeni kabza noktalarında.
- Nişangâhlar: red dot (Aimpoint tarzı), tabancada RMR, holo (EOTech tarzı), ACOG (TA31 tarzı) tüm silahlarda S3 yapımı; eksende ışıyan nokta / halka / şevron; göz mesafesi nişangâh türü başına sabit (`ADS_DIST`).
- Kaplamalar (`src/models/skins.js`): Standart, Çöl, Orman camo, Şehir camo, Altın; tek gölgelendirici programı, kaplama = uniform renkler, kamuflaj prosedürel (doku yok). Menü → Sınıf & Silah: kartların altında çipler + canlı 3B önizleme; kayıt yalnız tarayıcıda (`warbyte.v2.skins`). Çevrimiçi: join / create / opt mesajında `skins`, sunucu `cleanSkins`; yavaş anlık görüntü alanı `sk` (hepsi standartsa gönderilmez). Botlar standart; paintball ve pençe etkilenmez. Metinler `src/i18n/skins.js`.
- Nişan: `adsEase` (girişte ease-out, çıkışta ease-in); nişanda silah kamerası yakın düzlemi nişangâhın önünde (`ADS_NEAR`) → dipçik / gövde arkası / tetik eli alt ekranı kaplamaz; nefes, sallanma, fare gecikmesi, azaltılmış tepme nişan noktası çevresinde döner; HUD retikülü tam oturunca çıkar; holo halkası 3B ile aynı boy; ACOG şevron ucu merkezde (önce 9,5 px yukarıda); dürbüne giriş / çıkışta kararma + vinyet. Arpacık düzeltmeleri: mac10 (22 px), revolver (4 px), g36 (3 px); demir gez deliği simetrik.
- Ölçüm `scripts/adsalign.mjs` (masaüstü + Pixel 7 + iPhone 13): 177 ölçümün hepsi ≤ 2 px (en kötü 0,6 px); SWAY=1 118/118.
- Yük: birinci şahıs M4+holo 18 → 7 çizim çağrısı; 20 asker sahnesinde silah çağrısı 117 → 47, silah üçgeni 17 888 → 9 984.
- Testler: `adsalign`, `skintest` (menü → kalıcılık → birinci şahıs → ikinci istemci 3. şahısta görür), `s3shots` + `s3sheet.py`, `s3perf`.
- Bilinen: menü ikonları S3'te koyu; dürbün / ACOG geçişinde mercek opak koyu disk; telefonda holo HUD halkası 3B halkadan büyük; kaplama hesap profiline yazılmıyor. Kalan silahlar S3'e ikinci turda.

### 12.123 S3 ikinci tur: tüm silahlar + eşyalar, 12.122 açıkları kapandı
- Kullanıcı: "tamamını yap, eksiklikleri kapat". Üç paralel iş (çakışmasın diye ayrı dosyalar, yalnız kayıt satırları ortak):
- **Tüfek / DMR / pompalı / M79** (`src/models/s3rifles.js`): SCAR-H, AUG, G36, AK-74U, SVD (PSO-1), Barrett M82 (10× dürbün), AA-12, Çift Namlu, M79. Tek ağ + şarjör grubu, 1,7–3,4 bin üçgen, ≤ 3 çizim çağrısı (önce 6–12); LOD ≤ 600 üçgen.
- **SMG / LMG / tabanca / RPG** (`src/models/s3smg.js`): MP5, Vector, P90, MAC-10, M249, PKM, M1911, Desert Eagle, Revolver, RPG-7. Çizim çağrısı 8–14 → 2–3; LMG'de kutu + kemer, RPG'de roket alt grubu. Menü önizleme ölçeği boya göre (kısa silahlar ≤ ×2,2).
- **Eşyalar** (`src/models/s3items.js`): bıçak, satır, tomahawk, el bombası, duman, flaş, claymore, cephane kutusu, ilk yardım; tek ağ, 1. şahıs ≤ 400, LOD ≤ 144 üçgen; yakın dövüşte 5 kaplama, eşyalar Standart; kurulan cephane kutusu / claymore da S3.
- Tüm S3 silahlarda `finish()` sözleşmesi aynı (namlu / kabza / boy / magAxis), mermi / hasar / sunucu değişmedi, kutu eller aynı kabzalarda; 5 kaplama hepsinde (`SKIN_WEAPONS`).
- **12.122 açıkları:** menü ikonları koyuydu (S3 ikonunda doğrusal → sRGB çevrimi eksikti); dürbün / ACOG merceği opak koyu disk yerine loş saydam cam + tüp içi tünel (`Kit.build` otomatik, `splitLens`); telefonda HUD retikülü çıkınca 3B halka / nokta söner (tek halka); kaplamalar hesap profilinde (`/api/profile` `skins`, girişte sunucu kazanır, misafir yerel); nişanda destek kolu sol-aşağı döner ve tam nişanda gizlenir (alt-ortadaki mavi sütun kalktı).
- Ölçüm: adsalign tüm silahlar masaüstü 59/59 ≤ 2 px (ajan koşuları masaüstü + Pixel 7: tüfek 42/42, SMG 48/48, düzeltme 54/54). weaponaudit, skintest, accounttest, combattest, meleehit, nettest geçti. Testler değişikliğe göre seçildi (kullanıcı: "testler çok yavaş").
- Bilinen: altın kaplamada LMG fişekleri koyu; 3. şahısta revolver çerçeve penceresi yok; weaponaudit tek ağlı S3 silahlarda havada parçayı yakalayamaz (ajanlar birleştirme öncesi parça bağlantısını ayrıca denetledi).

### 12.124 Nişan (ADS) BattleBit duruşu + yaylı geçiş + kol iç içe geçmesi
- Kullanıcı (3 BattleBit görüntüsüyle): "nişan alınca silah düz çizgi gibi kalıyor, silah arkası karakterin koluna giriyor, nişan sistemi çok kaba". Sebep: kamera tam namlu eksenine bakıyordu; yakın düzlem kesmesi (`ADS_NEAR`) ve gizlenen kol silahı ince bir şeride çeviriyordu; kol kutuları dipçik / kabza ucu / şarjöre 12–55 mm giriyordu.
- Nişan duruşu (`player.js` `ADS_POSE`): tam nişanda silah ışıyan retikülün (demirde arpacığın) çevresinde sınıf başına yatar, dipçiği sağ-aşağı kayar (tüfek 2,6 / 5,5 / 3°, SMG 3 / 6,2 / 3,4°, LMG 2,4 / 5 / 2,4°, tabanca 2 / 3 / 2,6°, dürbün 0,8 / 1,6 / 1,4°). Holo'da sapma yarıda (arka çerçeve halkayı kesmesin), demir nişanda yalnız yatırma. Yakın düzlem kesmesi yalnız dürbün / ACOG'da.
- Geçiş: kritik sönümlü yaylar (konum ω 30 / ζ 0,85, %90 0,175 sn, aşma < 1 mm; dönüş ω 24 / ζ 0,9), hafif kavis + kısa yatış, FOV / HUD retikülü / dürbün örtüsü aynı yayda (`vm.adsV`). Nişanda tepme yayla döner, fare gecikmesi 40 ms. Oyun adsT'si ve isabet aynı (yalnız görsel; çok yavaş gelirse `ADS_SPR.p`).
- Kollar (`ARM`): tetik kolu kabza arkasından dipçiğin dışından sağ-aşağı, destek kolu şarjörün dışından sol-aşağı (P90 ayrı). Nişanda kollar gizlenmiyor (destek kolu sol alttan görünür). `scripts/armclip.mjs`: 41 kombinasyonda kol ↔ silah 0 mm (önce 12–55 mm).
- Ölçüm: adsalign masaüstü + Pixel 7 59 + 59 ≤ 2 px (en kötü 1,2 px). Görüntüler `scripts/adsshots.mjs`.
- Bilinen: demir nişanda silah yalnız yatar (AK'da toz kapağı alt ekranı kaplar, tabanca hâlâ dar); dürbünde tam nişanda HUD örtüsü devralır.

### 12.125 Nişan 12.123'e geri alındı (kol düzeltmesi kaldı)
- Kullanıcı: "en son nişan olayı çok kötü, geri alalım; sadece kollar silaha girmesin nişan aldığımızda". 12.124'ün yatık / sapmalı nişan duruşu, yaylı geçiş, kavis ve yaylı tepme kaldırıldı; nişan, HUD ve yakın düzlem kesmesi `d4bdc8a`'daki gibi (`hud.js`, `s3weapons.js` birebir).
- Korunan: 12.124 kol yönleri (`ARM`): tetik kolu dipçiğin dışından sağ-aşağı, destek kolu şarjörün dışından sol-aşağı (P90 ayrı); belde ve geçişte kol silaha girmiyor (`armclip` 41/41, 0 mm). Tam nişanda 12.123'teki gibi destek kolu 0,85'ten sonra, tüfekte tetik eli gizli (açık bırakılınca alt ekranda mavi levha gibi duruyordu). adsalign 59/59 ≤ 2 px.

### 12.126 Nişan: yakın düzlem kesmesi kalktı + BattleBit tarzı ince nişangâhlar
- Kullanıcı (BattleBit M4 holo görüntüsüyle): "AK47'de nişan alınca dipçik / kabza kayboluyor, nişangâhlar BattleBit gibi ince ve sade olsun". `ADS_NEAR` (25–33 cm) kalktı, yakın düzlem hep 1 cm: silah gövdesi kesilmeden alt-ortada bütün kütle; destek kolu tam nişanda sol-altta görünür (armclip 61/61 0 mm), tüfekte tetik eli gizli; AK47 / PKM demir nişanda göz 0,36 m'de (toz kapağı alt ekranı kaplamasın).
- Holo tek ince tel çerçeve (2,5 mm, 58×50 mm) + alçak taban; red dot ince tüp + 2,6 mm halkalar; RMR 2 mm pencere; ACOG 39 → 33 mm; cam opaklığı 0,16 → 0,045; arpacık 4 → 3 mm, gez yaprakları inceldi; retikül ve HUD aynı. adsalign masaüstü + telefon 59/59 ≤ 2 px.
- Açık: SCAR-H / PKM'de gövde üstü geniş olduğu için alt ekranda geniş yamuk; referansta nişangâh ekranda ~2 kat büyük (bizde ADS_FOV 68).

### 12.127 Büyük nişangâh (BattleBit) + nişan büyütmesi modelle eşzamanlı + birinci şahıs el oturuşu
- Kullanıcı: "kabzalarda ve silah yakınlaştırmalarında hâlâ sorun var" → iki salt-okuma taraması (kabza: 33 eşya, yakınlaştırma: 166 ölçüm), ardından onaylanan taslak ("10 numara yap"): nişanda silah kamerası `ADS_FOV` 68 → 40 (holo çerçevesi 86 → 160 px, ekranın ~%18'i; red dot 54 → 102 px), HUD `#holo` 9,2vh, `#rdot` 1,22vh; ACOG tam ekran dürbün yerine silah üstünde mercek (`ADS_DIST.acog` 0,2 m, overlay `'lens'`; SVD de).
- Zoom: dünya FOV'u ikinci bir üstel gecikmeyle (`cam.fov += … dt*18`) silahın ~100 ms gerisindeydi; artık doğrudan modelle aynı eğriden (`zoomCur()`), gerçek büyütme `zoomFov = 2·atan(tan(t/2)/z)` (×1,3 / 3 / 4 / 6 her FOV ayarında doğru). Fare / ok tuşu / dokunmatik hassasiyeti o anki büyütmeyle sürekli. HUD retikülü `ADS_HUD` 0,97'de; dürbün örtüsü `p.scopeOn` (çıkışta dünya ×2'nin altına inene dek açık; ×4,6 dünyanın önünde 3B dürbün gövdesi artık yok). Telefon holo 78 px → 9,2vh (3B çerçeveyle aynı, nişangâh boyutu ayarıyla); 3B ışıma HUD ile aynı karede söner.
- Eller (`FP_GRIP`, yalnız birinci şahıs; gripR / gripL, 3. şahıs IK, namlu aynı): tetik eldiveni kabza açısında (tüfek 16°, tabanca 12°) ve 85 mm boyunda → gövdeye gömülme 22–42 → 1–3 mm; destek eli kundağa değiyor (M4 / Barrett 31–36 mm havadaydı → +5 mm); P90 / M249 / MP5 gömülmesi giderildi; tabancada el kabza ortasında (Glock 27 → 9 mm); AUG kabzada; düz dipçikte bileğin yüzeyinde; cephane kutusu / ilk yardım yandan tutuluyor (%90–100 kutunun içindeydi).
- Ölçüm: `scripts/gripfit.mjs` 30/30 (önce 5/30), `scripts/adszoom.mjs` 9/9 masaüstü + telefon (önce 0/9; model ↔ dünya farkı 0,34–0,55 → 0), armclip 0, adsalign 59/59 + 59/59 ≤ 2 px.

### 12.128 ACOG 3× resim-içinde-resim (BattleBit) + nişangâhlarda pembe hale giderildi
- Kullanıcı: "ACOG 3× çok kötü, düzelt; diğer nişangâhlarda kırmızının arkasında oynayan pembelik var, kaldır". Pembe hale: 3B ışıyan retikül (×3 ışıma) Neutral ton eşlemede pembeleşiyor, masaüstünde tam nişanda HUD noktasıyla birlikte açık kalıp yürürken / tepmede kayıyordu (Orta kalitede de; bloom değil). Artık masaüstünde de tam `ADS_HUD` karesinde söner, geçişte görünür.
- ACOG / SVD PSO-1: göz merceğinde resim-içinde-resim — namlu ekseninde ikinci kamera mercek boyunda hedefe çizer (≤ 512² masaüstü 4× MSAA, ≤ 256² telefon, gölge haritası yeniden çizilmez, yalnız adsT > 0,3); büyütme `zoomCur` (tam nişanda 3×). Şevron + ince çizgiler gölgelendiricide. Mercek dışı dünya ×1,15 (`camZoom`), hassasiyet 3×. `ADS_DIST.acog` 0,125: mercek ekran yüksekliğinin ~%34'ü, kalın göz çanı halkası, altta silah gövdesi. Telefonda Düşük kalite ya da < 40 FPS'te eski tam ekran HUD dürbünü (`lensHud`).
- Ölçüm: adsalign masaüstü + telefon 59/59 ≤ 2 px (şevron 0,4–0,5 px), adszoom 9/9 + 9/9. Masaüstü Yüksek 1600×900: PiP 320²'de 1,7 ms GPU; kare red dot nişanında 4,6–5,0 ms, ACOG'da ~6,3 ms.

### 12.129 ACOG: MP5 / M249 PiP merceği + ince göz çanı; paintball nişanında silah görünür
- Kullanıcı: "ACOG 3× MP5, SVD, M249, AK47'de (neredeyse hepsinde) dürbün gözüküyor; paintball'da nişan alınca silah kayboluyor". Ölçüm (scripts/acogshots.mjs, 1600×900 + Pixel 7, tam nişan + %70): MP5 / M249'da s3smg.js opt() / done() lens'i taşımıyordu → PiP hiç açılmıyor, camdan dürbün tüpünün içi ve dipte küçük pencere görünüyordu. Diğerlerinde göz çanı halkası PiP diskinin önüne taşıyordu (ACOG 6,7 mm, PSO 16 mm) → mercek içinde gri tüp çeperi bandı (ACOG ~9 px, SVD ~20 px) + kalın siyah kenar (~54 px).
- Düzeltme: lens alanı s3smg'de de taşınıyor; ACOG / PSO halkasının ön yüzü diskle aynı düzlemde, ince (dış 21,5 → 19,2 mm / 20,5 → 19 mm; splitLens cap bayrağıyla kapağı silmez); PSO tamburları kısaldı (20 → 12, 18 → 11 mm); PiP kenar vinyeti hafif (0,62 → 0,4). 8 ACOG silahında mercek merkezde (0,0 px), çap %34 (SVD %33,4), mercek içi örtü yalnız artı / şevron (%1,4–2,2), merceğin dışındaki silah %10–14 → %7–10.
- Paintball: 12.127'deki nişan silah kamerası 40° + adsLow marker'ı ekranın altından çıkarıyordu (tüfek tam nişanda ekranda %1,1). ADS_FOV_PB 68 (12.127 öncesi): marker sağ-altta görünür, telefonda soluklaşmaz; halka nişangâh aynen.
- Ölçüm: adsalign acog|pb masaüstü 8/8 (0,5 px) + Pixel 7 8/8 (0,4 px), adszoom 9/9, vite build.

### 12.130 Paintball nişanında silah ekranda kalır; red dot noktası küçük
- Kullanıcı: "paintball silahında nişan alırken hâlâ silah kamera açısından çok kayboluyor; red dot nişangâhında kırmızı nokta çok kalın, küçük şık bir şey olsun". Ölçüm (acogshots, 1600×900): pbrifle belde ekranın %7,2'si, tam nişanda %2,9 (adsLow modeli kameraya 30 cm'ye çekip aşağı itiyordu → yalnız hazne görünüyordu).
- adsLow yeni değerler: pbrifle [0,12, −0,062, −0,163], pbpistol [0,11, −0,104, −0,172] → nişanda model belden biraz yakın (~50 cm), sağ-altta; hazne üstü ekran ortasının altında, halka nişangâh açık. Tam nişanda pbrifle %5,0 (masaüstü) / %4,0 (Pixel 7), pbpistol %3,5 / %2,9.
- Red dot: HUD #rdot 1,22 vh + geniş parıltı → 0,62 vh (masaüstü ≈ 5,6 px) + ince parıltı; telefonda max(5 px, 0,5 vh) × --rs, 1 px koyu çerçeve. 3D ışıyan nokta 2,4 → 1,3 mm (RMR 2,2 → 1,2 mm), geçişte HUD noktasıyla aynı boy.
- Ölçüm: adsalign reddot|pb masaüstü + Pixel 7 34/34 (≤ 0,8 px), weaponaudit, vite build. scripts/acogshots.mjs RD=1: red dot tam nişan görüntüsü.

### 12.131 Yakın dövüş tutuşu silaha göre (Unturned)
- Kullanıcı (Unturned bıçak / balta görselleri): "bıçak tutuşları çok kötü, her bıçak türüne göre resimlerdeki gibi iyileştir". Eskiden bıçak / satır / tomahawk tek duruşla (MELEE_IDLE) meşale gibi dik ve uzakta tutuluyordu.
- player.js MELEE_IDLE artık silah başına: bıçak = kutu yumruk sağ-altta yakın, ağız ileri-sola yatık (yan yüzü görünür); satır = yukarı-sola eğik kılıç, yumruk sağ-altta; tomahawk = sap sağ-alttan çapraz yukarı, baş üstte, ağız ileri. Dik tutulanlarda (satır / tomahawk) koşu duruşu ayrı (spr), geriye yüze devrilmez.
- anim.js chop (tomahawk): kaldırma kameraya yaklaşmaz, az kalkar (kol ekranı kaplıyordu); iniş ortaya kadar iner. 3. şahısta da aynı savurma, vuruş zamanlaması değişmedi.
- Ölçüm: fphands2 (bekleme / savurma / koşu kareleri, masaüstü + Pixel 7; tomahawk / satır / koşu kareleri eklendi), meleehit hepsi geçti, vite build.

### 12.132 Bıçak ağzında titreyen pikseller + havada başparmak
- Kullanıcı: "bıçağın keskin kısmında pikseller gidip geliyor, iç içe girmiş gibi; başparmak havada kalmış, düzelt ya da yok say". Sebep: s3items parlak ağız şeridi (ve kan oluğu, sırt tırtılı, satır sırtı, tomahawk ağzı / deliği) gövdenin üstüne 0,3–0,7 mm kalın bindirilmişti → yan yüzler neredeyse aynı düzlemde, derinlik çakışması (z-fighting).
- Bıçak: gövde + ağız yan yana iki parça (aynı kalınlık, bitişik kenar), oluk / tırtıl kaldırıldı. Satır: sırt / gövde / ağız yan yana üç parça. Tomahawk: baş + ağız yan yana, hafifletme deliği gerçek delik. 3. şahıs (lod) tek parça.
- Yumruk (fist): başparmak kutusu kaldırıldı, sade kutu yumruk (Unturned).
- Ölçüm: fphands2 bıçak / satır / tomahawk yakın kareleri, weaponaudit, vite build.

### 12.133 Davet linki: takma ad sor → doğrudan odaya
- Kullanıcı: "arkadaşlarıma atacağım link: çevrim içi, Çöl Geçidi, gündüz, botlar kapalı, hava açık, 10 kişilik ölüm maçı, maç bitince tekrar başlasın, sonsuza kadar giden oda; linke tıklayan nickini yazıp katılsın".
- Oda: canlı sunucuda resmi oda (data/official.json): type dm, perTeam 10, time 600, bots false, rotation tek [colgecidi / day / clear], vote false (oylama yok, aynı ayarla yeni maç), idleMin 0. Resmi oda hiç kapanmaz.
- İstemci (main.js askNick): /?online=KOD adresinde ad yoksa (hesaplı oyuncu hariç) yükleme ekranında takma ad kutusu + Katıl; ad tercihlere yazılır, katılınca adres çubuğuna &name= eklenir (yenileyince tekrar sormaz).
- HUD: herkes tek modlarda (ffa) sınıf satırında çevrilmemiş "hud.team.f0" yerine yalnız sınıf adı.
- Ölçüm: scripts/invitelink.mjs (masaüstü + Pixel 7, iki oyuncu, botsuz, ayarlar, WAIT=1 maç sonu yeni maç) OK.

### 12.134 Resmi oda ayarı sunucu yeniden başlamadan (SIGHUP) + OFC9'a bot
- Kullanıcı: "en son açtığımız odaya botları da aç, oyunda şu an biz varız, oyun bozulmasın". Panel şifreyle açıldığı için ayar dosyadan verildi; sunucu yeniden başlarsa içeridekiler düşer.
- server: `process.on('SIGHUP')` → officialStore.reloadOfficial() (data/official.json yeniden okunur) + syncOfficial(): değişen oda boşsa hemen, oyuncu varsa sonraki maçta uygulanır, kimse düşmez. Kullanım: `systemctl kill -s HUP warbyte`.
- OFC9: bots true, açıklama "bot destekli". Bu sürüm canlıya oyuncu sayısı 0 olunca (/health) kurulan tek seferlik bekçiyle alındı (update.sh), oynayanlar atılmadı.
- Ölçüm: yerel sunucu, 2 oyuncu bağlıyken dosya değişti + SIGHUP → bağlantı kopmadı, maç sonu yeni maç bots: true.

### 12.135 Birinci şahıs bıçak / satır / tomahawk savurmaları yeniden (Unturned)
- Kullanıcı: "bıçak animasyonları ve tutuşları hâlâ çok problemli" (Unturned: kutu yumruk sağ-altta, bıçak ileri-sola yatık, uzun saplılar sağ-alttan çapraz yukarı; sade, okunaklı, BattleBit hissi).
- Ölçüm (scripts/meleefp.mjs, her savurma k = 0 … 0,85, 1600×900 + Pixel 7): savurmalar 3. şahısla ortak meleePose ofsetleri × 1,6–1,9 olarak bekleme Euler açılarına ekleniyordu → yanlış eksende dönme. Kurmada silah ekrandan çıkıyordu (bıçak rl / lr, satır rl / lr / diag, tomahawk rl: uç NDC 1,4–3,0); bıçak lr kurmasında kol kameraya giriyordu (22 cm, ekranın sol-altını kaplıyordu); lr vuruşlarında keskin kenar hareketin tersine / yana bakıyordu (bıçak 115–139°, satır 91–109°); saplamada yumruk kameraya 6 cm yaklaşıp kayboluyor, vuruşta bıçak 1,2 m ileride çok küçük kalıyordu; kol sapın uzantısı olduğu için bazı pozlarda yan yatıp ekranı kesiyordu; inceleme sırasında yumruk kameraya geliyordu.
- player.js SWING_FP: silah başına (bıçak rl / lr / stab, satır rl / lr / diag, tomahawk chop / rl) üç anahtar poz, kamera uzayında yumruk konumu + ağız ucu yönü (f) + keskin kenar yönü (e): W kurma (k 0,22, ekranda), H vuruş anı (k = SWING_HIT_K, ağız ekran ortasından, kenar hareket yönünde), S savurma sonu (0,54–0,62 tutulur). Bekleme → W → H → S → bekleme dördey (slerp) geçiş; vuruşta hafif öne yay. Sol el modunda dördey aynalanır. Zombi pençesi ve 3. şahıs eski ortak eğriyle aynen; oyun zamanlaması değişmedi.
- Yumruk %15 büyük ve içi dolu (içinden sap görünmüyor), kol kutusu 11 → 9,2 cm ve her karede yumruktan sabit bir "dirsek" noktasına (ekranın sağ-altı) döner: kol hep sağ-alttan gelir, kameraya girmez. Bıçağın sarkan kordonu kaldırıldı (kolun yanından çıkıyordu). İncelemede yakın dövüş silahı kameraya yaklaşmaz.
- Ölçüm: meleefp masaüstü + Pixel 7 (bütün savurma karelerinde uç / yumruk ekranda, en çok NDC 0,92; vuruşta kenar ↔ hareket ≤ 25° masaüstü / ≤ 33° telefon, eskiden 4–139°; kol kameraya ≥ 37 cm, eskiden 22 cm), meleehit hepsi geçti, fphands2 (bıçak / satır / tomahawk / pençe / m4 / bomba), vite build. Önce / sonra: /tmp/wb-melee/oncesonra-*.png.

### 12.136 Sohbetten moderatör komutları: kick + ban
- Kullanıcı: "banlama özelliği yapmalıyız, chatten komutla oyuncu kicklememe imkân ver".
- Yetki: `data/mods.json` (hesap adları dizisi, büyük / küçük harf duyarsız) HER komutta diskten okunur → canlıda yeniden başlatmadan düzenlenir; dosya yoksa `["admin"]`. Yalnız geçerli hesap jetonuyla giren oyuncu moderatör olur (misafir kayıtlı adı alamaz: guestName sayı ekler). Yetkisiz kişi `/` ile başlayan herhangi bir şey yazarsa yalnız ona "Bu komutu kullanma yetkin yok"; `/` mesajları hiçbir zaman sohbete yayınlanmaz (index.js, room.chat'e gitmez). Hız sınırı 10 sn'de 8 komut.
- Komutlar (server/moderation.js): `/oyuncular` (odadakiler + #no; takma: /players /list /who), `/kick <oyuncu> [sebep]` (/at), `/ban <oyuncu> [süre] [sebep]` (/yasakla; süre 30s · 10m / 10dk · 2h / 2sa · 1d / 1g · 1w · kalıcı, varsayılan kalıcı, en çok 365 gün), `/unban <ad | sıra no>` (/bankaldir /affet), `/bans` (/banlar), `/yardim` (/yardım /help). Hedef: ad, tek eşleşen baş harfler, `#no` ya da "boşluklu ad". Kendini / moderatörü atamaz. Odada olmayan ad: başka odadaysa (bekleme listesi dahil) o, yoksa çevrimdışı ad banı.
- Kick: hedefe `{t:'kicked'}` (neden + kalan engel), odaya "X odadan atıldı · sebep" ("ayrıldı" yazılmaz: room.leave quiet), bağlantı 4003 ile kapanır. **2 dk giriş engeli** (yalnız bellekte; aynı ad ya da IP) — yoksa atılan anında geri girer. /unban engeli de kaldırır.
- Ban: `data/bans.json` (geçici dosya + rename, 0600; elle değişirse mtime ile yeniden okunur): `{ name, key, acct, ip, by, reason, at, until (0 = kalıcı) }`, süresi dolan temizlenir. Sunucu geneli: create / join (maç sonu hold yolu dahil) girişte kontrol → `{t:'err', msg, ban:{k, ms, r}}` + kapanış 4004. Hesaplı oyuncu hesap adıyla, misafir ad anahtarıyla; ikisi de IP ile (IP kısmı en çok 7 gün: paylaşılan / değişen IP masumu kalıcı kilitlemesin). Moderatörler IP eşleşmesinden muaf. Ban anında aynı hesap / IP her odada (bekleme listesi dahil) düşer.
- İstemci: NetClient 'kicked' mesajını saklar, kapanışta game.onNetClosed(kicked) → "ODADAN ATILDIN" / "BANLANDIN" ekranı (neden + süre, yalnız Ana Menü). Girişte ban: yükleme ekranında "Bağlanılamadı:" öneki olmadan, menüde (koddan katılma) hata kutusu görünür yere kaydırılır. tr + en (i18n/game.js `ban.*`, banText). Admin panelinin odadan atması da aynı ekranı gösterir.
- Admin paneli: Hesaplar sayfasının altında **Banlar** tablosu (ad, tür, IP, kalan, sebep, banlayan) + "Banı kaldır" (`GET /api/bans`, `POST /api/bans/remove`).
- Ölçüm: scripts/modtest.mjs (WS, IP'ler x-real-ip ile taklit; HOLD=1 maç sonu bekleme listesi) 62/62 OK; scripts/modui.mjs (tarayıcı: yetkisiz komut, atılma / ban ekranı, yükleme + menü hatası tr / en) OK → screenshots/mod-*.png; nettest OK; npm run build OK.

### 12.137 "Ping sorunu": ağ ölçümü, uyarlanır interpolasyon tamponu, boş oda dönüşü sırayla
- Kullanıcı canlıda (OFC9, 4-5 insan + bot, Çöl Geçidi ölüm maçı) "ping sorunu var" dedi. Canlı salt-okunur ölçüldü (OFC9'a girilmedi; listelenmeyen şifreli geçici odayla, Mac'ten ve sunucunun kendi loopback'inden aynı anda).
- **Ölçüm (Mac → canlı, 60-90 sn):** WS ping RTT doğrudan (`wss://ws.warbyte.io/ws`) p50 30 / p90 65-88 / p99 155 ms; Cloudflare (`wss://warbyte.io/ws`) p50 152 / p99 290 ms. Oyuncuların hepsi doğrudan yolda (nginx günlüğü: bugün 42 doğrudan, 1 Cloudflare = bizim ölçüm; `ss -ti` oyuncu RTT 29-43 ms, biri 132 ms ve %0,3 yeniden gönderim). Sıkıştırma kapalı (perMessageDeflate yok), TCP_NODELAY açık (ws + nginx varsayılanı).
- Sunucu sağlıklı: tick tam 60,00 Hz, adım ort. 0,3 ms, snapshot 20 Hz, boyu ~1,75 KB (2 sn'de bir tam 2,8 KB), oyuncu başına ~37 KB/sn (~300 kbit/sn) + ~8 olay mesajı/sn. Loopback girdi→onay p50 14 ms.
- **Kök neden 1 (istemci):** ağın titremesi. Snapshot'ların %8'i en hızlı gelişe göre > 50 ms, %2,5'i > 100 ms geç (Wi-Fi / TCP takılması: ~saniyede bir 100-180 ms boşluk + ardından yığın). İstemcinin sabit 100 ms interpolasyon tamponu bunu karşılamıyordu: tampon boşalınca rakipler son konumda donup sonra sıçrıyordu. Canlı kaydın tekrar oynatımında saniyede ~1 donma (karelerin %4,6'sı).
- **Kök neden 2 (sunucu):** 8 boş resmi oda (OFC1-8) aynı saniyede harita döndürüyordu (idleMin 10). Her yeni maç kurulumu olay döngüsünü ~40-60 ms tutuyor → 10 dakikada bir dolu odadaki herkese 170 / 230 / 120 ms'lik art arda snapshot boşluğu (canlıda 20:21:35'te loopback'ten ölçüldü, günlük zamanlarıyla birebir).
- **Düzeltme (src/net/client.js):** gösterim gecikmesi uyarlanır: geç kalma tepesi (hızlı yükselir, 4 sn yarı ömürle söner; tek örnek ≤ 250 ms) + 1 snapshot aralığı; en az 100 ms (temiz bağlantıda eskisiyle aynı), en çok 250 ms (lag compensation HN=40 içinde). Değişim yumuşak (oynatma en çok %10 yavaş / %3 hızlı, sıçrama yok). Tampon yine boşalırsa ≤ 100 ms son hızla ileri tahmin (yerdeyken dikey yok). Saat ofsetinin yükselme örneği ≤ 100 ms (tek geç paket ofseti itip geri düşürmesin). `stats.jit / delay / extrap / hold` eklendi. Atışta giden `vt` gösterilen an olduğu için lag compensation doğru kalır.
- **Düzeltme (server/index.js, room.js):** boş oda dönüşü saniyede en çok bir oda (`idleTick` döndüyse true → döngü durur); zamanlar kendiliğinden ayrışır.
- **Önce / sonra:** canlı kayıt tekrar oynatımı: donma %4,61 → %0,94 (1,03 → 0,28 olay/sn), ileri tahminle görünür bekleme %0,13; ortalama gösterim gecikmesi 100 → 128 ms. Tarayıcıda (scripts/netsmooth.mjs, 10 kişilik dm, vekil titreşimi + saniyede bir ≤180 ms takılma): tek yön 15-35 ms → rakip donma %4,06 → %0,02, sıçrama 1,18 → 0,23/sn; tek yön 25-75 ms → donma %3,63 → %0,02, sıçrama 1,13 → 0,63/sn. Temiz yerel bağlantıda gecikme 100 ms'de kalıyor, donma yok. Yerel hızlı dönüşte (BF_EMPTY_ROTATE_MS=8000) odalar tek tek döndü. nettest OK, vite build OK.
- Test araçları: `scripts/netproxy.mjs` takılma parametreleri (saniyede takılma, takılma ms; her yön ayrı, sıra korunur) + her bağlantıya ayrı sıra; `scripts/netsmooth.mjs` (rakip donma / sıçrama, tampon istatistiği; çizim kapalı, RENDER=1 ile açık).
- Yapılmayan (onay / ayrı iş): TCP'nin yeniden gönderim takılması (head-of-line) WebSocket'te çözülemez (WebTransport / UDP gerekir). Snapshot ~1,75 KB = paket başına 2 TCP segmenti; tek segmente inmek için protokol değişikliği gerekir (eski istemcilerle uyum). Rozetteki ping 2 sn'de bir ölçülen WS RTT'nin yumuşatılmışıdır ve tarayıcının ana iş parçacığı gecikmesini de içerir (düşük FPS'te olduğundan yüksek görünür).

### 12.145 Koşarken nişan: koşu anında biter, bırakınca koşuya dönülür
- İstek: "hızlı koşarken nişangâh tuşuna basılırsa koşmayı bırakıp nişangâh açmalı".
- Eski durum (ölçüldü, scripts/sprintads.mjs): **basılı tutma nişanında** mantık zaten doğruydu (applyInput: `s.ads` → koşu yok) ama birinci şahısta koşu pozu tam nişanda %27 kalıyordu (silah yana dönük, nokta kayık). **Aç-kapa nişanda** (Ayarlar) koşarken sağ tık hiç işlemiyordu: `adsToggle && s.sprinting → s.ads = false` kuralı, önceki karenin koşu bayrağıyla nişanı hemen geri kapatıyordu (çevrim içinde de, dokunmatikte aç-kapa ayarı açıkken de).
- Yeni kurallar (BF / CoD gibi, tek yerde: Player.update + ortak applyInput):
  - Nişan isteği koşuyu **o karede** keser (hız ilk karede düşer; adsT 2. karede başlar, tam nişan ~8. kare = normal geçiş süresi). Nişan tutulduğu sürece Shift basılı olsa da koşulmaz (nişan öncelikli).
  - Nişan bırakılınca (basılı modda tuş bırakma, aç-kapa modda tekrar tık) Shift hâlâ basılıysa **koşuya dönülür**.
  - Aç-kapa nişanda ileri giderken Shift'e **yeniden basmak** (basılı tutmak değil) nişanı kapatıp koşturur; dururken Shift nişanı kapatmaz. Silah değişimi nişanı kapatır (eskisi gibi).
  - Dokunmatik: nişan düğmesi (hep aç-kapa) joystick kenar koşusunu da otomatik koşu kilidini de keser; kilit açık kalır, nişanla ileri yürünür, nişan kapanınca koşuya dönülür. Joystick hareketi nişanı kapatmaz (kazara kenara itme).
  - Birinci şahıs koşu pozu nişanla bastırılır (`sprK × (1 − ads)`): tam nişanda koşu pozu 0.
- Sunucu–istemci: koşu kararı zaten ortak `src/sim/input.js` (`!s.ads`). Sunucu `humanTick` artık `s.ads = inp.a`'yı `s.update`'ten **önce** yazar (istemcide fare olayı karenin güncellemesinden önce gelir); eski sırada sunucunun adsT'si bir adım geride kalıyor, nişandan koşuya dönüşte ~5 cm fark → her geçişte 1 tahmin düzeltmesi oluyordu. İstemci geçmişi her girdinin `ads` / `adsT`'sini saklar, düzeltmenin yeniden oynatması onları kullanır ve sonra yerel nişanı geri koyar (eski: sunucunun ack anındaki nişan bayrağı yerel `s.ads`'ın üstüne yazılıyor, basılı tutulan nişan düzeltmede düşebiliyordu).
- Ölçüm: scripts/sprintads.mjs (çevrimdışı g.step kare kare + gerçek keydown / mousedown; dokunmatik Pixel 7; çevrim içi BF_DEBUG sunucu, nişansız koşu denetim turu ile) 29/29 OK: koşu 8,4 → nişan 3,36 m/sn, bırakınca 8,4; çevrim içi koşu ↔ nişan geçişlerinde düzeltme 4 → 0. nettest OK, vite build OK.

### 12.139 Nişangâh taraması: tüm silah × nişangâh BattleBit sadeliğinde
- Kullanıcı: "bazı nişangâhlar çok problemli, tümüne bak, kötü görünenleri düzelt" (BattleBit: ince, sade). Tarama `scripts/opticaudit.mjs` (gerçek GPU, dünya görünür; bel / %50 / %70 / tam nişan, masaüstü 1600×900 + Pixel 7; 62 birleşim × 4 = 248 kare her cihazda, `SKIN=gold` kaplama denetimi) + `scripts/opticsheet.py` (tarama / merkez yakın / önce-sonra montajları).
- **Pembe ışıma (tümü):** 3B ışıyan retikül (red dot noktası, holo halkası, dürbün artısı, tritium) ×3 ışımayla Neutral ton eşlemede geçişte pembe / soluk görünüyordu. `skins.js`: ışıyan parça ışıklandırılmaz, ışıma doğrusal ×0,86 (ACOG PiP şevronuyla aynı kırmızı). Dürbün (M24 / Barrett) artısı 0,6 → 0,4 mm.
- **Holo (tümü, masaüstü + telefon):** HUD #holo 3 px halka + 4 dış işaret + kalın parıltı (telefonda + iki koyu kontur) tam nişanda 3B ince halkanın yerine kaba bir retikül olarak zıplıyordu. Artık halka 2 px (telefon 1,5 px + tek ince kontur) + 4 px nokta, işaret yok; halka orta çizgisi 9,47vh = 3B halka (ölçüm: r 42,5 px). 3B halka 1 → 0,7 mm, nokta 1,8 → 1,3 mm.
- **Red dot (tümü):** ince dikmenin tepesi tüpün 1,7 mm içine giriyordu → halkanın dibinde tümsek. Dikme tüpün dış yüzünde biter.
- **Pencerede silah parçası:** AK-47 / AK-74U / PKM'de ön kule kulakları + arpacık (AK'da gez yaprağı da) red dot / holo penceresinde üç dikme; MP5'te arpacık halka koruması pencerenin dibinde ikinci halka; SCAR-H / AUG yatık arpacık, M4 / SCAR / AUG / G36 / AA-12 yatık gez optiğin altında üst üste bloklar; Glock'ta gez + arpacık, M1911 / Deagle'da arpacık (Deagle'da namlu rayı) RMR penceresinde. Optik takılıyken bu parçalar çizilmez (demir nişanda aynen).
- **Kaba montaj:** AK-47 / AK-74U (60 mm), PKM (64 mm), SVD (50 mm) köprü plakası + yan kelepçe merceğin / pencerenin altında geniş raf gibiydi → toz kapağını 0,5–2 mm boşlukla saran tek parça eyer (`coverMount` / `akMount`, üstü optik tabanı kadar). ACOG tabanı 34 × 12 → 26 × 8 mm + tüpe değen ince yükseltici; fiber kanalı / kapaklar alçak (%70'te halkanın üstünden tümsek). SVD PSO-1: üst tambur tepesi cy+27,5 → 21 mm, yan tambur ve pil kapağı küçük / yanda (bilinen "üst tambur %70'te seçiliyor" giderildi).
- Önce / sonra: `/tmp/wb-optics/oncesonra-1-ak-pkm-svd-desk.png`, `-2-arpacik-desk.png`, `-3-holo-acog-desk.png`, `-4-telefon.png` (sütun: önce %100 | sonra %100 | önce %70 | sonra %70 | merkez 2×). Tam tarama: `/tmp/wb-optics/crop-{before,after}-{desk,mob}-*.png`.
- Ölçüm: adsalign masaüstü + Pixel 7 59 + 59 ≤ 2 px (holo 0,0 / 0,3 px), adszoom 9/9 + 9/9, weaponaudit 36/36, vite build. Kaplamalar (altın): nişangâhlar koyu kalır, renk sorunu yok.
- Bilinen / dokunulmayan: dürbünlü (M24 / Barrett) geçişte %70'te göz merceği ekranı kaplar (kararma örtüsü devralır); ACOG'da %70'te dipçik / kurma kolu sağ altta yakın görünür (geçiş anı); altın kaplamada LMG fişekleri koyu ve 3. şahısta revolver penceresi (12.123) bu işin dışında.

### 12.138 "Ölene kadar hasar veremiyorum": sunucuda kalıcı girdi birikmesi + cephane uzlaştırması
- Kullanıcı (canlı OFC9, Çöl Geçidi ölüm maçı, botlu, ping 29–137 ms dalgalı): "bazen oyun buga giriyor, ne kadar mermi sıkarsam sıkayım ölmeyene kadar tekrar hasar veremiyorum".
- Kök neden (game.js updateHumans): girdi bütçesi (hız hilesi kovası) en çok 30 hak (0,5 sn) biriktirir. Yukarı bağlantı > 0,5 sn takılınca (yeniden iletim / dalgalı hat; sunucu döngüsü > 0,25 sn takılınca da) o sürenin girdileri bir anda gelir; 30'dan fazlası kuyrukta kalır ve istemci tam 60/sn yolladığı için kuyruk HİÇ erimez. Yalnız ölünce / doğunca (`respawn`: queue = 0) silinir → "doğunca düzeliyor".
- Etkisi: her atış ~0,5 sn geç işlenir; görüş farkı (tick − vt) = 6 (interpolasyon) + RTT + 30 ≈ 40–48 adım, geri sarma penceresi HN − 3 = 37 adım → kırpılır, hedef istemcinin gördüğünden 0,1–0,2 sn sonraki yerine sarılır → koşan düşmanı (bot) ıskalar. Kendi hareketi tahminle akıcı göründüğü için oyuncu gecikmeyi fark etmez, yalnız "vuramıyorum" der. Düşük pingde (fark ≈ 40) çoğu isabet sürer, yüksek pingde neredeyse hiç.
- Düzeltme 1 (sunucu, `Game.drainBacklog`): 0,5 sn'lik pencerede kuyruğun en az uzunluğu (kalıcı fazlalık) 2'yi aşıyorsa fazlası atlanır. Yalnız "sessiz" girdi (tuş kenarı c/p/u/fp/rl/fm/o/ab yok, silah değişimi yok) atlanır; duran oyuncununki her adım, hareket edeninki 3 adımda bir (atlanan adımın yürüyüşü kaybolur → istemci ≤ 0,14 m'lik yumuşatılan düzeltme alır). Atlamak simüle edilen süreyi kısaltır, uzatmaz: hız hilesine kapı açmaz (nettest flood testi geçiyor), geri sarma penceresi (HN) değişmedi.
- Düzeltme 2 (kendini toparlama, client.js `fixAmmo`): sunucu her snapshot'ta ack anındaki cephaneyi (`me.aa`) yollar; istemci her girdinin adım sonundaki cephanesini kaydeder (`markAmmo`, player.js). Uçuşta ateş varken fark varsa şimdiki değere fark eklenir (sonraki tahminler korunur); ateş yokken eskisi gibi doğrudan sunucunun şu anki değerine eşitlenir. Eskiden cephane yalnız "uçuşta ateş yokken" eşitlendiği için tetiği bırakmayan oyuncuda istemci sunucuda olmayan mermiyle boşa ateş etmeyi sürdürebiliyordu.
- Düzeltme 3 (client.js `fixItems`): yerel oyuncunun eşya listesi yaşarken sunucudakinden farklıysa (Silah Yarışı seviye atlama, debug) sunucununkine geçer; eskiden yalnız doğuşta eşitleniyordu.
- Teşhis: `dbg ask` artık kuyruk uzunluğu, bütçe, atlanan girdi, görüş farkı ve atıcı durumunu (cur, ateş modu, duruş, şarjör, yedek, cd, reloadT, switchT, useT, swing, prot) döker; `dbg am:[yuva, şarjör, yedek]` sunucu cephanesini değiştirir.
- Ölçüm: scripts/shotlag.mjs (gerçek sunucu, 12 m'de koşan hedef, tek yön 50–80 ms + iki kez 1,2 sn takılma, 26. sn'de ölüm): ÖNCE takılmadan önce %100 → sonra (ölmeden) %16, kuyruk sürekli 30–32 girdi (517 ms), görüş farkı 43 adım, doğunca %100; SONRA %100 / %100, kuyruk ≤ 2. scripts/shotsoak.mjs (90 sn: koşu, zıplama, nişan, silah 0–3, seri / tek atış, şarjör, bıçak, el bombası / ilk yardım, yatma / çömelme + rastgele 0,2–1,4 sn takılma, 3 sn'lik ölçümler): ÖNCE 10 ölçümün 9'u başarısız (kuyruk 31–34), SONRA assault ve medic 10/10. scripts/ammoheal.mjs (tarayıcı, 45–75 ms vekil): ÖNCE istemci tetik basılıyken sunucuda mermi yokken 1,5 sn'de 11 boş atış, eşya değişmedi; SONRA 0 atış, cephane 0/0 eşit, eşya geçti, olağan seride sayaç geri zıplamıyor. combattest, nettest, pbpicknet, ggnet, ffanet, vite build OK.

### 12.142 Paintball topu görünür: namludan çıkar, ekranda okunaklı boy, renk + kenar + iz
- Kullanıcı (arkadaşlarıyla canlı test): "paintball'da mermiler gitmiyormuş gibi görünüyor".
- Ölçüm (`scripts/pbball.mjs` çevrimdışı, `scripts/pbballnet.mjs` çevrim içi + `netproxy` 25-75 ms tek yön; atıştan sonra 0/50/100/200/400 ms kareleri): top ağda geç / hiç gelmiyor DEĞİL (B'ye 'pb' A'nın atışından ~100-145 ms sonra, sayılar tutuyor). Sorun çizimdeydi:
  - Top ekranda sabit ~0,0048 rad çapla çiziliyordu (`r = max(0.014, uzaklık × 0.0024)`): 6 m'den ötesi masaüstü 720p'de 2,3 px, 540p'de 1,7 px, Pixel 7'de 2,5 CSS px. Kendi topum 50 ms'de (4 m) 3 px, sonra 2 px → "gitmiyor". Başkasının topu yandan da, bana gelirken de 2 px.
  - Ton eşlemesi (Neutral) + sis rengi soldururdu; aynı renkli zeminde / atanın kendi boya renkli formasında kenar yoktu; iz yoktu.
  - Birinci şahısta görüntü başlangıcı `muzzleWorld` (göz + sabit ofset) silah modelinin namlu ucuna denk gelmiyordu: silah ayrı kamerayla (FOV 54) çizilir → tüfekte 49 px, tabancada (nişanda) 73-91 px yanda doğup 0,1 sn'de nişangâha kayıyordu.
- Düzeltme (yalnız `src/game/paint.js` görüntüsü; topun gerçek yolu, hızı, isabet / hasar, sunucu doğrulaması, tohumlu saçılım DEĞİŞMEDİ):
  - Ekranda en küçük çap: ekran yüksekliğinin %0,85'i, en az 5 px (dokunmatikte 6): 720p 6 px, 1080p 9 px, telefon 6 CSS px; yakında gerçek boy (en az 1,1 cm yarıçap).
  - Top `toneMapped:false, fog:false` (palet rengi aynen), üstüne topla aynı örnek matrislerini paylaşan koyu ters yüzlü kabuk (1,35×, %60) → yeşil top yeşil çimde, turuncu top turuncu formada seçilir.
  - İz: 35 ms'lik (tüfekte ~2,7 m) sönen koni, topun boya renginde, namlunun gerisine uzamaz (yaş kadar), kayma payıyla birlikte görünen yolu izler.
  - Birinci şahıs namlu ucu `_fpMuzzle`: silah modelindeki namlu ucunun (10 cm önü) silah kamerasındaki ekran noktası → dünya kamerasında aynı ekran noktası, aynı uzaklık. Top silahın ucundan çıkar (tüfek 9 px, tabanca 19 px; Pixel 7 5 / 9 px), 0,1 sn'de gerçek göz hattına düz çizgiyle kavuşur (önceki kayma aynen).
  - Ek çizim: 2 çağrı (kabuk + iz), havuz aynı (ayırma yok).
- Test: `pbball` önce 10 HATA → sonra OK (masaüstü + Pixel 7: kendi tüfek / tabanca, yandan geçen, bana gelen); `pbballnet` (RTT ~100-140 ms, B masaüstü + Pixel 7) önce 4 HATA → sonra OK (A kendi topunu 5 px, B A'nın topunu 150-300 ms karelerinde görüyor); `pbnet` doğrudan 14/14, gecikmeli 13/12 tahmin ↔ sunucu isabeti, duvar lekeleri 23/24 aynı yerde; `pbscreen`, `pbtest` OK; vite build OK. Montaj: `/tmp/wb-pball/montaj-cevrimdisi-{desktop,pixel7}.png`, `montaj-cevrimici-{desktop,pixel7}.png`.

### 12.144 El bombası yeniden: güvenilir yay, yörünge önizlemesi, pişirme, tahminli çevrim içi, akıllı botlar
- Kullanıcı: "bomba atma mekaniği bence işlevsiz şu an, ona da el at". Önce ölçüldü (eski sürüm, düz zemin, ayakta): bakış 0° → 11,5 m ilk değme / 14,4 m patlama; 15° → 17,9 / 21,3; 30° → 22,1 / 25,7; 45° → 22,5 / 24,3 m (tam güçte en çok ~25 m). Fünye 2,6 sn, pişirme yok, nereye düşeceği belli değil. Öldürme yarıçapı ≤ 2,9 m (3 m'de 94 hasar), yaralama ≤ 6 m. Fizik kare süresine bağlıydı (yerde her karede ×0,315 sürtünme). Attıktan sonra bomba elde görünmeye devam ediyordu, kalan bombada silaha dönülmüyordu. Çevrim içinde atan kendi bombasını sunucu olayıyla görüyordu (144 ms RTT'de 174 ms gecikme). Botlar düşmanı görünce açı tahminiyle atıyordu (bakış 0,18 + mesafe × 0,004): Kasaba 4 × 3 dk'da 36 bomba, 6 öldürme, patlamada düşman ≤ 4 m yalnız 7/36.
- `src/game/grenade.js` (yeni): ortak, SABİT ADIMLI (1/60 sn) bomba fiziği (`nadeStep`: yerçekimi 14, çarpmada normal geri sekme 0,3 + teğet ×0,35, yumuşak düşüşte yere oturur, yuvarlanma 12 m/sn² yavaşlama → durur), `throwState` (göz + bakış × hız + 2,5 m/sn yukarı itiş + koşu hızının yarısı; alttan atış 9 m/sn), `simulateNade` (atıştan patlamaya yol), `aimNade` (bot nişanı aynı fizikle), `NadeView` (önizleme). Sunucu, çevrimdışı oyun ve istemci tahmini aynı yolu çizer.
- Tetik (soldier `_nadeTrigger`, sunucudaki insan da aynı): bas → pim çekilir (pim sesi), basılı tutarken noktalı yay (0,45 m aralık) + patlama yerinde halka + el bombasında soluk öldürme halkası + ilk değmede nokta, nişangâhın sağ altında kalan fünye; bırak → atılır. Bırakırken sağ tık basılıysa alttan yuvarlama (0° → ~6 m). El bombası pişirilir (fünye pim çekilince başlar; duman / flaş bırakınca başlar); elde dolarsa patlar ve atanı öldürür; pişirirken ölen oyuncunun bombası kalan fünyeyle düşer; silah değiştirmek pimi geri takar (bomba harcanmaz). Esc ile kilit giderse pişirilen bomba bırakılır. Attıktan 0,42 sn sonra önceki silaha dönülür (BattleBit gibi), atılan bomba elde görünmez; el pişirirken geri-yukarı kurulur, atışta ileri savrulur.
- Patlama: hasar = 130 × (1 − (d / 7,5)²); duvar arkası: patlamadan gövde merkezine YA DA başa açık hat yoksa hasar yok. Öldürme akışında el bombası simgesi; isabet işareti / ses mevcut takeDamage yolundan. Cephane kutusu bombayı 6 sn'de bir tamamlar (sınıf adedine kadar).
- Çevrim içi: kendi bombam tahminle hemen havada (`spawnGrenade` pred + girdi sırası q); sunucunun `gr` olayı (yeni alanlar: f kalan fünye, q, ih elde patlama) gelince eşlenir ve sunucu başlangıcından aynı adım sayısı yeniden koşulur; onaylanmayan tahmin 1,6 sn + RTT sonra silinir. Patlama yalnız sunucu `boom` olayıyla (çift patlama yok). Önizleme, çevrim içinde bırakma adımının fünyesini (SIM_DT) hesaba katar.
- Botlar (bot davranışı, bomba / harita değil): `tryNade` — hedef 8–32 m ve gerekçe (hedefin 5 m yakınında başka düşman, hedef duruyor ya da %50 şans) + `aimNade` ile engele çarpıp geri dönmeyecek / yanına düşmeyecek açı (yoksa atmaz), zorluk hatası kadar sapma (err × 40 m). Görüşten çıkan düşman duruyorduysa 4 sn içinde son yerine döner ve atar. Bekleme: bot başına 16–28 sn, takım başına 3 sn.
- Denge (eski → yeni): fünye 2,6 → 3,0 sn (+ pişirme) · hız 15 m/sn + 3,2 itiş → 19 + 2,5 · yarıçap 6 → 7,5 m (hasar 130 aynı; ayakta hedefte öldürme ≈ 2,8 → ≈ 3,4 m yatay, yaralama 6 → 7,5 m) · duman fünyesi 1,5 → 2,2 sn, hız 14 → 19 · flaş fünyesi 1,5 → 1,6 sn, hız 15 → 19. Admin paneline el bombası "Atış hızı" alanı eklendi (canlı sunucuda panel geçersiz kılması varsa o geçerli olur).
- Ölçüm (yeni): 0° → 12,9 / 15,3 m; 15° → 22,6 / 25,9; 30° → 30,0 / 34,0; 45° → 31,7 / 34,6 m; yuvarlanma 0,7–4 m, 1,2 sn'de durur; bırakmadan patlamaya 2,98 sn; önizleme = gerçek patlama (24 rastgele atış: koşarak / alttan / pişirilmiş / sekmeli, en çok 0,7 cm; tarayıcıda 0 cm; 144 ms RTT'de sunucu patlaması = önizleme). Çevrim içi 144 ms RTT: atan bombasını 12 ms'de (eski 174), gören 162 ms'de görür, iki ekranda tek patlama. Botlar (Kasaba, herkes bombalı, 3 dk): 11 bomba, 10 öldürme, 8/11 patlamada düşman ≤ 4 m; Çöl Geçidi: nişan → patlama ≤ 3 m 8/8.
- Testler: `scripts/grenadetest.mjs [harita]` (ağsız ölçüm + kontroller), `scripts/grenadeweb.mjs <url> [ws]` (A çevrimdışı önizleme / patlama / alttan / pişirme, C dokunmatik Pixel 7, B iki istemci; OLD=1 eski sürüm önce görüntüleri). combattest, gadgettest, nettest, headless-sim, vite build. Önce / sonra: /tmp/wb-nade/oncesonra.png.

### 12.150 Vagon modu botları: rol planı (eskort / öncü / yan · durdurucu / siper / yan) + doğma dengesi
- Kullanıcı: "Vagon modu amaçsız, haritada direkt fight dönüyor, botların da vagonla alakası yok." Ölçüm (`node scripts/plbots.mjs 20 6`, 6v6 normal, 20 maç) önce: vagon zamanın %58'inde **boş** (kimse itmiyor, kimse durdurmuyor), çekişme %1, durdurma %5; 10 sn'den uzun yaşayan saldıranların yalnız %11'i itme yarıçapında; savunanların %2'si yarıçapta, %12'si vagondan 40 m+ uzakta; öldürmelerin %65'i vagondan 15 m+ uzakta. Neden: eski hedef (payload.botGoal) doğruydu ama botlar çatışınca son görülen düşmanın / sesin peşine düşüyor, çatışmada vagondan kopuyordu; ambar kapı pervazında takılan eskort 2 dk yerinde sayıyordu.
- Yeni `src/game/payloadBots.js` (yalnız Vagon; diğer modlar bu dosyaya girmez). Takım planı 1,5 sn'de bir rol dağıtır (vagona yakın olan öne; rol değiştirme direnci 12 m):
  - Saldıran: **eskort** (~%62; vagon 8 / 20 sn ilerlemezse %78 / %88, çekişmede en az %72) — itme yarıçapında, düşmanların ortalamasına göre vagonun ARKASINDA (vagon mermiyi keser); vagonda savunan varsa vagonun YANINA açılır. **Öncü** (1 bot) vagonun 4–10 m önünde. **Yan** kalan: ileride savunanın tuttuğu siper noktalarına. **Nişancı** ileriyi gören yüksek nokta.
  - Savunan: **durdurucu** (sakin %30 · saldıran 14 m'de %40 · vagon itilirken %65 · kontrol noktasına 15 m kala +%15; yalnız vagona 22 m içindekiler — yeni doğan tek tek koşup ölmesin) vagonun önünde, saldırana göre vagonun ardında. **Siper**: vagonla sıradaki kontrol noktası arasında (vagon + 5…26 m, en çok nokta + 12 m) siper noktası; vagon ilerledikçe geri çekilir, siperde çömelir. **Yan** (5+ kişide 1): vagonun yanından / arkasından eskortu vurur. **Nişancı**.
  - Siper havuzu (bir kez): ray boyunca 2,5 m'de bir, iki yana 2,5–11 m; yürünebilir, raya geri bakan (vagonun geleceği yolu 5 / 11 / 18 m geriden gören), duvar dibi / rampa üstü öne.
  - Çatışmada: eskort / durdurucu yarıçap dışındaysa ateş ederek vagona yürür, içindeyse yalnız yana kayar (yarıçaptan çıkmaz); siper / öncü hedefinden 3,5 m'den fazla açılmaz. Bu roller sese / son görülen konuma koşmaz. Hedef seçimi: vagonun yarıçapındaki (iten / durduran) düşmana 15 m (eskort / durdurucuya 25 m) mesafe indirimi. Takılma: rastgele 3–7 m kaçış sapması (2,5 sn), sonra rol hedefi.
- Harita bağımsız: koordinat yok; her şey `g.payload`'dan — `track.at / nearest / len`, `d`, `start`, `end`, `cps`, `reached`, `state`, `p`, `distTo`, `TUNE.plRadius`. Harita / ray değişince siper havuzu yeni raydan kurulur. `payload.botGoal` kaldırıldı. bot.js'te yalnız `g.payload` korumalı kancalar (pickGoal, sense, hear, lostT, çatışma hareketi, takılma, hedefe varış).
- Denge: botlar vagonu gerçekten oynayınca saldıran her maçı kazanıyordu (12/12; savunan doğuşu raydan ~66 m, saldıranınki ~12 m). `TUNE.plAtkRespawn` 0,75 → **1,0**, `plDefRespawn` 1,15 → **0,75** (admin → Oyun modları → Vagon'dan değişir).
- Sonra (aynı ölçüm, 6v6 normal 20 + 30 maç): saldıran 11 / savunan 9 ve 18 / 12; vagon: it %25 · çekişme %16 · durdurma %41 · geri %15 · boş %3; 10 sn+ yaşayan saldıranların %63'ü yarıçapta, %82'si 8 m içinde; savunanların %31'i yarıçapta, %57'si rayda vagonun önünde, %3'ü 40 m+; öldürmelerin %41'i vagona 5 m, %87'si 15 m içinde. 8v8 7/3, 5v5 kolay 4/4, 6v6 zor 4/4, 3v3 7/1 (küçük savunma zayıf).
- Diğer modlar: tohumlu `scripts/botdeterm.mjs` parmak izi (kasaba conquest / tdm, us conquest, colgecidi tdm) eski ve yeni kodla birebir aynı → davranış değişmedi. headless-sim conquest / tdm OK, pltest OK.
- Testler: `scripts/plbots.mjs [maç] [NvN] [zorluk]` (ölçüm; `TUNE_x=` / `PLB_x=` ile deneme), `scripts/plbotshots.mjs` (tarayıcı kuşbakışı, botların üstünde rol harfi → /tmp/wb-pbots/), `scripts/botdeterm.mjs`.

### 12.148 Seri "başarı" sesi (ölmeden art arda öldürme)
- Kullanıcı: "oyuncu üst üste kill alınca kill sayısına göre başarı sesi gibi bir ses ekleyelim".
- Kural (tek sistem, killfx.js): **seri** = ölmeden art arda öldürme (ölünce / kendi ölümünde / düşünce sıfır). Seri ≥ 2'de her öldürmede seri sesi çalar; kademe = seri (2, 3, 4, 5, 6+), **10 / 15 / 20 …** özel kademe. **Çoklu öldürme** (mevcut 4,5 sn penceresi: ÇİFT / ÜÇLÜ / DÖRTLÜ / KATLİAM) ayrı bir ses değil: yalnız çağrıyı belirler ve seri sesinin arpejini sıkıştırır (daha hızlı). Takım arkadaşı öldürmek seriyi / çoklu öldürmeyi artırmaz (sıfırlamaz da). Bütün modlarda aynı (dm, tdm, conquest, gg, pb, inf: zombi ↔ insan karşı takım).
- Ses (yeni `src/game/streakSfx.js`; audio.js'e dokunulmadı, yalnız `sfx.ctx` / `sfx.sfxBus` / `sfx.verbIn` kullanılır → Ana ses + Efekt sesleri düzeyine bağlı): tamamen prosedürel (osilatör + gürültü). Öldürme onay sesinden 0,2 sn sonra başlar; seri sesi açıkken onay sesi sabit (n=1), yükselen kısım yalnız seri sesinde → iki yükselen ses üst üste binmez. Aynı karede gelen öldürmeler (el bombası) üst üste değil 0,3 sn arayla sıraya girer, sıra 0,9 sn'yi aşarsa atlanır. Konumsuz, yalnız öldüren oyuncunun kendisine çalar (çevrim içinde sunucunun `kill` olayında killer === ben; tahminle sayılmaz, çift sayım yok).
- Üç taslak stil, **varsayılan A**; değiştirmek tek sabit: `streakSfx.js` → `STREAK_STYLE = 'A' | 'B' | 'C'`. A sade arpej (üçgen dalga majör arpej + oktav parıltısı, 5+ çan, 6+ akor, 10'da iki oktav koşu + çift çan); B arcade (filtreli kare dalga, hızlı arpej + "jeton" sıçraması, 5+ yankı tekrarı, 10'da güç-yükselme taraması); C tok / askerî (filtre zarflı testere "boru" ile borazan notaları + trampet tıkı, 5+ timpani, 10'da trampet rulosu + fanfar). Dinleme: `node scripts/streakwav.mjs <vite-url>` → /tmp/wb-streak/<A|B|C>-<2|3|4|5|10>.wav, <stil>-seri.wav (1 → 6 + 10) + index.html.
- Bildirim: seri dönüm noktaları (3 SERİ, 5 DURDURULAMAZ, 7 YIKIM, 10 EFSANE, 15 / 20 …) ve çoklu öldürme çağrısı eskisi gibi; araya küçük, sade "SERİ ×n" satırı (seri 2, 4, 6, 8, 9 …; `.sk.sm`) — öldürme kartının üstünde, telefonda küçülür. tr + en (`fx.spree`).
- Ayar: Ayarlar → Ses → **Seri sesleri** açık / kapalı (ana menü + oyun içi panel, tercihe `streakSound`). Kapalıyken eski davranış (çoklu öldürmede onay notaları yükselir).
- Sunucu: BF_DEBUG test komutu `{ t:'dbg', dmg:[kurban, hasar, kafa] }` (bu oyuncu vurmuş gibi).
- Ölçüm: scripts/streaktest.mjs (çevrimdışı masaüstü + Pixel 7; modlar dm / tdm / conquest / gg / pb / inf; çevrim içi iki istemci) hepsi OK — seri sayacı, ses çağrısı, takım arkadaşı, ayar kapalı, ölünce sıfır, düğüm sızıntısı yok, aynı anda 3 öldürme sıraya girer, çevrim içinde yalnız öldürende ve tek sayım. Görüntüler /tmp/wb-streak/shots/ (masaustu- / pixel7-seri2, seri5, cift, seri10, ayarlar, online-A-seri3). streakwav: 19 WAV, tepe < 1. vite build OK.

### 12.149 Maden Ocağı v2: harita vagonun etrafında döner (Vagon modu)
- Kullanıcı: "Vagon modu amaçsız, haritada direkt fight dönüyor, botların da vagonla alakası yok. Hem harita geliştirilmeli hem oradaki botlar." Bu bölüm HARİTA tarafı (bot kararları 12.150).
- Ölçüm (önce): 96 × 72 m açık dikdörtgen, evler ada gibi dağınık; her noktadan her noktaya yol. 1. aşamada Kırmızı kuzeybatı avlusunda doğuyordu: iki takımın eşit vardığı "cephe hattı" raya ortanca 34,5 m (%74'ü > 20 m), vagona koşarken ilk temas batı kolonunda vagona 28 m; Mavi'nin doğuş noktalarından Kırmızı avlusunun önüne 65 görüş çifti (doğuşta öldürme), 94 m'lik kuzey bandı / batı kolonu görüş hatları (> 35 m: 4084 çift), erişilebilir alanın %31'i raydan > 15 m (avlular hariç). Bot maçlarında (20 × 5v5, aynı bot kodu) öldürmelerin vagona ortanca uzaklığı 18,3 m, yalnız %21'i ≤ 10 m, %11'i > 30 m.
- Tasarım (Overwatch / TF2 yük haritaları): ray omurga; savunan her aşamada sıradaki noktanın hemen ilerisinde doğar ve vagona rayın geldiği yönden yaklaşır, saldıran vagonun arkasında; ray dışı kestirmeler kaya kütleleriyle kapanır, her bölümde ana hat + iki kanat kalır; savunana yüksek zemin; noktalar ve yön belirgin.
- Doğuşlar (plStages): 1. Mavi Yükleme Avlusu / Kırmızı **Demirci** (A'nın 14 m kuzeyi; batısı sağır, güney kapısı iskeleye kaydı — Mavi avlu kapısından çapraz görüş vardı); 2. Mavi Ambar / Kırmızı Doğu Avlu; 3. Mavi Kuzey Avlu / Kırmızı yeni **Vinç Avlusu** (C'nin 10 m doğusu, x 38…48 z −36…−19, batıda iki + güneyde bir kapı, kapı arkası perde duvarlar 1,9 m geçitli). Kuzeybatı Avlu kalktı.
- Kaya kütleleri (bench, mevcut kayalıkla aynı basamaklı yapı, çıkılmaz ≥ 4 m): **Kuzeybatı Sırtı** (eski kuzeybatı avlu + kaya burnu; x −48…−12,3 z −36…−20) + demirci arkası çıkıntı (kuzey duvarına yaslı; demircinin kuzey penceresi kalktı); **Bunker Kayası** (Kömür Bunkeri ile Ambar arası; Mavi'nin avlu kapısından Demirci önüne 37 m'lik kestirme + çapraz görüş kapandı, batı cebi artık Ambar'ın batı kapısından A'ya açılan kanat); **Kuzey Ocak** (Kuzey Avlu ile maden ağzı arası; kuzey bandındaki 94 m'lik hat ve doğuştan doğuşa kestirme kalktı, Lavvar'ın kuzeyinde 2,7 m'lik ara yol kanadı kaldı). Kuzey Avlu'nun batı / doğu kapıları kapandı (arkası kaya).
- Savunana yüksek zemin (1,4 m, 'plat' + merdiven, yükleme rampasıyla aynı yapı): **Makas İskelesi** (A'nın kuzeyi, x −22…−17,2; A'ya gelen x = −18 rayını boydan görür, önünde 0,9 m kalas siper, batıdan merdiven) · **Cevher İskelesi** (C meydanının batısı, Kuzey Ocak kayasına ve ağız payandasına yaslı; ray köşesini ve Lavvar çıkışını görür, üstünde sandıklar, güneyden kayaya yaslı merdiven).
- Siper / görüş: köy caddesinde terk edilmiş cevher vagonu + kereste, B yaklaşımında vagon (x 10,8) + kereste (açıklık %70–88'di), **Barut Deposu** (taş, köy caddesinin doğu ucu; 84 m'lik doğu-batı hattını keser), Depo'nun batı / doğu kapıları kaydırıldı (içinden geçen düz hat), Lavvar–Depo ara yolunda sandık istifi, güney bandında yüksek kereste, C yaklaşımında kereste. Makas Kulübesi kapısı 1,5 m (botlar kapıda takılıyordu).
- Yön / nokta: **A kapısı** (rayın üstünde ahşap portal, iki yüzlü "A" tabelası, iki sinyal lambası), kantar kirişinde iki "B" levhası + sinyal lambaları, kontrol noktalarında sarı-siyah boyalı travers bandı, raylar arasında 6 m'de bir sarı ok (tek InstancedMesh). Lambalar parlak birleşik ağda (ek çizim çağrısı yok).
- Ray yolu DEĞİŞMEDİ (MADEN_TRACK aynı; payload.js'e dokunulmadı). Bot ipuçları (yalnız veri): `map.payload.hints` = `PL_HINTS` (maden.js) — aşama başına savunanın tutma noktaları `hold: [{x, z, y, kind: 'high'|'cover', look:[dx, dz]}]` ve saldıranın kanat rotaları `flank: [[[x, z], …], …]`; pltest her noktanın yürünebilir, zemin kotunun doğru ve ilgili doğuştan ulaşılabilir olduğunu denetler.
- Ölçüm (sonra): cephe hattı (hedefe giden rotalarda) raya ortanca 1. aşama 14,2 → 3,8 m (≤ 8 m %0 → %73), 2.–3. aşama 1,8 m; ilk temas 1. aşamada vagona 28 → 12 m (aktif raya 3 m); avlu önüne görüş 65 / 1 / 12 → 0 / 1 / 0; > 35 m görüş hatları 4084 → 1383 çift, en uzun 94 → 79 m; ölü alan %31 → %26. Bot maçları (20 × 5v5): öldürmenin vagona ortanca uzaklığı 18,3 → 10,1 m, ≤ 10 m %21 → %49, > 30 m %11 → %1, aktif ray bölümüne ≤ 8 m %26 → %52; Mavi kazanma 17/20 → 17/20 (denge değişmedi; 3. aşama son savunması güçlü, 1. aşama hızlı düşüyor — bot ajanının işiyle birlikte yeniden bakılmalı). Bilinen: 3. aşamada güney bandı (Taş Ocağı / Güney Yol) iki doğuşa eşit uzak boş alan; hedefe giden yolda değil.
- Telefon: harita 25 ağ / 27,3 bin üçgen → 32 ağ / 30,2 bin üçgen; aynı bakışlarda çizim çağrısı +0…+8 (≈ %1), sahne üçgeni ≈ +%7; kare süresi aynı (16,7 ms, Pixel 7 profili).
- Testler: `scripts/plmap.mjs` (yeni: aşama başına yol / süre, cephe hattı, ilk temas, siper, görüş hatları, ölü alan; `MADEN=…` ile eski harita) + `plmap_plot.py` (kuşbakışı tablo), `plfights.mjs` (yeni: bot maçlarında öldürme yerleri, takılma), `plcam.mjs` (yeni: serbest kamera önce / sonra kareleri), `pltest.mjs` (bot ipucu denetimi eklendi) 51/51 OK, `headless-sim.mjs maden 6` OK, `plshots.mjs` masaüstü + Pixel 7 hata 0, vite build OK. Küçük resim (public/img/maden.jpg) yenilendi.

### 12.140 Her silahta otomatik şarjör değiştirme + bıçak 3 / ekipman 4
- Kullanıcı: "RPG gibi şeyler otomatik reload yapmıyor; her durumda her silah mermisi bitince oto reload yapsın, ve bıçak tuşu 3 olsun".
- Sebep (reload): yerel oyuncuda otomatik reload hiç yoktu; yalnız boş şarjörle tetiğe basınca `tryFire` başlatıyordu. `tryFire` önce `cd` (atış arası) bakıyor: RPG (rpm 30 → 2 sn), M79, sürgülü / pompalı gibi yavaş silahlarda son atıştan sonraki tık `cd` içinde yutuluyordu; tek atışlıkta basılı tutmak da işe yaramıyordu (tampon 0,15 sn). Sunucuda ise insanlar için `tryFire` sonunda `!isPlayer` koşuluyla yalnız 'gun' türü ateşten hemen sonra reload başlatıyordu (launcher bu satıra hiç ulaşmıyordu, `_rocket` önce dönüyordu) → istemci tahmini ile sunucu FARKLI kural uyguluyordu (istemci reload'ı geç / hiç başlatmıyor, sunucu başlatıyordu; cephane sonradan snapshot'la sıçrıyordu).
- Düzeltme: `Soldier.autoReload()` her `update()` adımında (reload işlendikten sonra): eldeki gun / launcher şarjörü 0, yedek > 0, reload / çekiş (switchT) / savurma / kullanım yoksa `startReload()`. Tek kural, tek yer: çevrimdışı oyuncu + botlar (`step`), çevrimiçi yerel oyuncu (`stepOnline` → `s.update`) ve sunucu (`humanTick` → `s.update`) aynı adım sırasında (güncelle → girdi / ateş) aynı şeyi yapar: son mermi N. adımda atılır, reload N+1. adımın başında iki tarafta da başlar. `tryFire` içindeki `!isPlayer` satırı kaldırıldı. Çevrimiçi istemcide uzaktaki savaşçılar için çalışmaz (cephaneleri tahmin edilmez). Yedek yoksa davranış aynı (boş tetik sesi + uyarı). Bot `useGadget` (RPG'yi elde tutmadan atma) etkilenmez: kontrol yalnız eldeki silaha bakar.
- Bıçak 3: tuş eylemlerinin kimliği aynı (`slot3` = ekipman, `slot4` = bıçak; kayıtlı tercihler bozulmasın), yalnız varsayılanlar değişti: bıçak 3 / V, ekipman 4 / G; Kontroller listesinde bıçak önce. `Binds.slotOf` artık tuş KONUMUNU (SLOT_KEYS: 1 ana, 2 yedek, 3 bıçak, 4 ekipman) döndürür, `slotOrder(n)` konumu items indeksine çevirir (standart [0,1,3,2]; paintball / silah oyunu doğal sıra). Sunucu / ağ yuva indeksi (`s.cur`, items dizisi, `w` alanı) DEĞİŞMEDİ. HUD şeridi, fare tekerleği (ana → yedek → bıçak → ekipman) ve dokunmatik şerit dokunuşu (data-i) bu sırayı kullanır; şerit numarası o konuma atanmış ilk tuştur. Ölüm ekranındaki 1-4 sınıf seçimi konuma göre (değişmedi).
- Eski kayıtlı tercihler: `toJSON` yalnız varsayılandan farklı eylemleri kaydeder → tuşlarına dokunmamış oyuncunun kaydında slot3 / slot4 yoktur, yeni varsayılanı alır. Özel ataması olanınki korunur; yeni varsayılan onun özel tuşuyla çakışırsa (ör. gadget'ı 3'e kendi atamış) o tuş varsayılan tarafından düşürülür (bıçak yalnız V kalır).
- Ölçüm: scripts/autoreload.mjs (sim: 26 silah × tık / basılı / nişan / koşu / zıplama sunucuda, yedeksiz, boş silaha geçiş, bot useGadget; off: çevrimdışı oyuncu + 3 / 4 / V / G + HUD + tekerlek; net: çevrimiçi istemci ↔ sunucu reload ve cephane eşitliği; mob: Pixel 7 şerit + dokunmatik ateş; menu: Kontroller yeni + eski özel), bindtest, combattest, nettest, vite build.

### 12.143 Düşme hasarı (yükseklikle, tutarlı; sunucu = istemci)
- Kullanıcı: "oyuna tutarlı fall damage ekle, düşme mesafesine göre damage alsın".
- Ölçü: düşüş yüksekliği = havadaki en yüksek nokta (zıplama dahil) − iniş noktası (`World.move` inişte `s.landH`; kare süresinden bağımsız, 20/30/60 Hz aynı sonuç). Işınlanma / sunucu düzeltmesi zirveyi bozarsa iniş hızı sınırlar (h ≤ v²/2g + 0,6 m). Tek tablo: `src/sim/fall.js` (`FALL`, `fallDamage`, `fallApplies`); çevrimdışı oyun, sunucu ve istemci tahmini aynı kodu kullanır.
- Eğri: ≤ 6,5 m hasarsız; sonra 6·x + 0,978·x² (x = h − 6,5): 7 m 3 · 8 m 11 · 9 m 21 · 10 m 33 · 11 m 47 · 12 m 63 · 13 m 80 · 14 m 100 · 15 m 122 (100 canlı sınıf 14 m'de, Ağır Destek ~15,2 m'de ölür).
- Eşik neden 6,5 m: `scripts/fallmaps.mjs` doğuştan yürüyerek ulaşılan yüzeylerden kenar inişlerini ölçtü. Çöl Geçidi'nin olağan inişleri Suicide (T Spawn → Mid) yürüyerek 5,6 m / koşup zıplayarak 6,3 m, Short / Boost 5,0–5,6 m, Pit 5,8 m; Depo ≤ 3 m, Liman ≤ 2,6 m, Maden ≤ 2,2 m, New York (insanların çıktığı iskele / kamyon / metro) ≤ 5 m, Orman Kalesi ≤ 4,5 m, Vadi ≤ 6,5 m. 4 m eşik Çöl Geçidi'nin ana yollarında her inişte can götürürdü. Hasar Askeri Üs çatı / kulelerinde (Komuta Binası çatısı 10,7 m → 42 / zıplayarak 55; kontrol kulesi 11 m), Kasaba su kulesi / kiliselerinde (8 m → 11–20) başlar.
- Kurallar: hasarı yalnız YETKİLİ taraf uygular (`game.fallCheck`: çevrimdışı oyun / sunucu). Saldıran yok (botun onDamaged'ı tetiklenmez, isabet işareti yok); doğuş koruması (protT) ve geliştirici ölümsüzlüğü (O) korur. Ölürse "Düştü": kendi kendine, puan kimseye (İntihar / Kuyu ile aynı akış), öldürme akışında aşağı ok ikonu + "Düşerek öldü" / "Fell to death".
- Hasarsız: derin su (Vadi nehri), zıplama minderi uçuşu, geliştirici uçuşundan (L) sonraki ilk iniş, ışınlanma / doğuş (hız sıfır). Paintball: yok (kaleden 9 m atlamak oyunun parçası, kuyu zaten eler). Enfekte: zombiler almaz (çatıdan sıçrayan avcılar), insanlar alır.
- Çevrim içi: istemci inişi aynı tabloyla tahmin eder (`game.fallPredict`, uzlaştırmada yeniden oynatılan inişte `fallReplay`), sarsıntı + hasar sesi + yönsüz kırmızı kenar hemen gelir, can göstergesi sunucu o girdiyi onaylayana dek (ack ≥ q) tahminle düşülür, sonra sunucunun canı geçerli: çift düşme yok. Sunucu yalnız insan oyuncuya `{e:'fall'}` olayı yollar (tahmin edilmediyse geri bildirim oradan). Havada uzlaştırmada zirve sunucu durumundan (y + v²/2g) kestirilir. Test için `dbg { tpy:[x,y,z] }` (havada bırak).
- Botlar: katlı yol bulma zaten ≤ 0,7 m basamakla iniyor; `scripts/fallbots.mjs` 10 haritada 240 sn: düşme hasarı 0, düşerek ölüm 0 (en yüksek bot inişi 2,4 m) → bot davranışına dokunulmadı.
- Test: `scripts/falldmg.mjs` (0 mod kuralları tarayıcısız · 1 çevrimdışı 1–18 m tablo = ölçüm, 14,5 m ölüm + akış · 2 gerçek kenarlar: Çöl Geçidi / Kasaba / Askeri Üs yürüyerek + koşup zıplayarak · 3 çevrim içi 5/8/11/13 m sunucu canı = tablo, tek olay, gösterilen can çift düşmüyor, 15 m ölüm). Ekran: `screenshots/falldmg-*.png`.

### 12.147 Esc → menü, Esc → oyuna dön
- İstek: Esc menüyü açıyor, tekrar Esc oyuna döndürsün. Eski: menüde Esc hiçbir şey yapmıyordu (yalnız "Devam" / tık).
- Tarayıcı kısıtı: pencere modunda kilitliyken Esc'yi tarayıcı yutar (fare kilidini kendisi bırakır, olay sayfaya gelmez). Kilit düştükten sonra menüdeki Esc gelir ama HTML'e göre kullanıcı jesti sayılmaz; Chrome kullanıcının bıraktığı kilidi jestsiz geri vermez, ayrıca ~1,3 sn soğuma uygular. Oyunun kendisinin bıraktığı kilit (`exitPointerLock`) jestsiz geri alınabilir.
- Tam ekran + Keyboard Lock (Chrome / Edge): `lockKeys` listesine `Escape` eklendi → kısa Esc sayfaya gelir, oyun kilidi kendisi bırakıp menüyü açar (`_unlockBy = 'game'`); menüde kilit yalnız Esc için sürer (`lockKeys('esc')`, yoksa Esc tam ekrandan çıkarırdı); menüde Esc → kilit hemen geri, oyun sürer. Esc'yi basılı tutmak tarayıcının tam ekrandan çıkışıdır.
- Pencere modu / Firefox / Safari: kilitliyken Esc → (tarayıcı) menü; menüde Esc → menü kapanır, sessiz kilit denemesi (`requestLock(true)`: hata sayılmaz, "kilitlenemedi" uyarısı yok; soğumadaysa bitince kendiliğinden yeniden dener). Alınamazsa ortada küçük **"Devam etmek için tıkla · Esc menü"** katmanı (`#presume`): tek tık → kilit, oyun sürer (menü yeniden açılmaz); katmanda Esc → menüye geri.
- Ayarlar / Kontroller alt sayfasında Esc önce ana Esc menüsüne döner, tuş atama dinlemede yalnız atamayı iptal eder (mevcut `ingameSettings` davranışı korundu). Sohbet açıkken Esc yalnız sohbeti kapatır; pencere modunda sohbet Esc'si kilidi de düşürürse menü yerine "tıkla devam" katmanı çıkar. Takım menüsü, maç sonu / atılma ekranı, ilk "Hazır mısın?" ekranı, dokunmatik / kilitsiz yedek mod Esc'den etkilenmez. `?nolock=1` (test / editör): Esc menüyü açar / kapatır.
- Kod: `game.js` `onEsc`, `requestLock(quiet)`, `_unlockBy`, `lockKeys('esc')`; `hud.js` `showResume`, `pausedShown / resumeShown / endShown`; i18n `pause.clickResume`, `pause.escMenu`.
- Test: `scripts/esctest.mjs` — 1. bölüm gerçek fare kilidi (headless:false; Playwright'ın Esc'si kilitliyken sayfaya gelir = Keyboard Lock durumu; kullanıcı Esc'si `exitPointerLock` ile taklit, red durumu `requestPointerLock` saplamasıyla), 2. bölüm nolock / giriş ekranı / çevrimiçi sohbet (headless). Tam koşu: 1. bölüm 18/19 (1 kilit reddi WrongDocumentError = test penceresi odak kaybı), 2. bölüm 15/15. Ekran: `screenshots/esc-*.png`.

### 12.146 Uzak mesafe atış: mermi ışını sınırı, uzaktaki isabet efekti, tohumlu sapma
- Kullanıcı (canlı test): "çok uzaktaki düşmana ateş ederken mermiler gitmiyor gibi". Ölçüm: scripts/farshot.mjs (çevrimdışı, botlar donuk, hedef 25…200 m, nişanda / belde, tek / seri; AIR=1 engelsiz şerit), scripts/farshotnet.mjs (çevrim içi: tarayıcı atıcı + ham ws hedef, netproxy 50–150 ms; istemcinin gördüğü kan ↔ sunucunun onayladığı isabet), scripts/farlos.mjs (görünen geometri ↔ çarpışma uyuşmazlığı).
- Bulgular: (1) Tüfek / DMR / keskin nişancıda nişanda isabet 200 m'ye kadar %100, çevrim içi de sunucu her isabeti onaylıyor (ret yok, ilgi alanı / AOI yok, geri sarma tutuyor). (2) **Işın sınırı**: `shootRay` erimi `range[1] × 2,2` idi → Glock 121 m, M1911 110, MAC-10 99, Vector 132, MP5 154, pompalı 70, AA-12 / çift namlu 62 m'den ötede ışın hiçbir şeye değmiyordu: hasar 0, duvarda toz / iz yok, iz duvarın içinden 120 m'ye uzanıyordu (Çöl Geçidi'nde en uzun açık hat ≈ 135 m, Vadi ≈ 200 m). (3) **Görsel**: kan / toz / kıvılcım 0,03–0,1 m; 50 m'den ötede < 1 piksel → uzaktaki isabet ve ıskalama ekranda hiç görünmüyordu. (4) **Sapma zarı**: mermide istemci ve sunucu ayrı Math.random atıyordu; yakında fark etmez, uzakta (sapma ≥ gövde) 100 m belden seride 10 tıkın 7–8'inde istemcinin gösterdiği kan ≠ sunucunun isabeti. (5) Görünmez engel: 160 m'lik rastgele ışınların %1'inden azında, kenarda < 1 m fark; uzak atışa özgü değil.
- Düzeltme: `SHOT_REACH = 300` (game.js) → ışın her silahta en az 300 m (Vadi köşegeni ≈ 216 m); hasar düşüşü (range / minMul) aynı, yani 121 m ötesinde tabanca minMul hasarı verir (Glock 12, pompalı 150 m'de atış başı ≈ 7). Effects._far: isabet parçacıkları 18 m'den ötede kamera uzaklığıyla büyür (en çok 8×; ekrandaki boyut 18 m'dekiyle aynı). Soldier._shoot: insan atışında sapma paintball gibi girdi sıra numarasıyla tohumlu (`paint.rngFor`; bot / çevrimdışı yine Math.random) → 100 m seride uyuşmazlık 7–8 → 3 tık / 10 (kalan: tetik zamanlaması).
- Not: "ölene kadar hasar yok" (sunucu girdi kuyruğu birikip atış geri sarma penceresini aşıyordu) ayrı düzeltildi; çevrim içinde uzakta "gitmiyor" hissinin bir kısmı da oydu olabilir.
- Testler: combattest OK, nettest OK, vite build OK.

### 12.153 Keskin nişancı kullanımı: temiz dürbün geçişi, ince retikül, sürgüde dürbünde kalma, bel / dürbün isabeti
Kapsam: dürbünlü tüfekler (`scope: true`: M24 Keskin `sniper`, Barrett .50). SVD (ACOG, `lens`) değişmedi.
- Ölçüm (önce): bel → dürbün geçişinde %60-85 arasında 3B göz merceği ekranı kaplıyor (kararma 0,55'te başlayıp 0,9'da tamamlanıyordu), %100'de tam siyah kare; kalın (3,4 vh) kasnak + kalın direkli retikül; atışta iz mermisi sağ-alttan dürbünün içine çapraz beyaz çizgi + namlu alevi; tepme %55 kalıcı → her atıştan sonra görüş ~45 px (4×, 900 px) yukarıda kalıyor, hedef retikülden çıkıyor; sürgü dürbünde hiç hissedilmiyor (model gizli); belde ilk atış ×0,2 indirimiyle M24 no-scope 15 m'de gövdeye %100 isabet; dürbün 0,17 sn'de tam (quickscope ödülsüz-cezasız). Dürbünde sallanma / nefes tutma yok (ölçüm 0 px).
- Geçiş: dürbün örtüsü adsT 0,9 → `SCOPE_ON` 0,72'de açılır (util.js); kararma 0,3 → 0,72 arasında tam siyaha çıkar (göz merceği büyümeden), örtü açılınca ~0,12 sn'de açılır ve halka %94'ten oturur. FOV / büyütme eğrisi değişmedi (yalnız eşik + adsTime).
- Dürbün süresi silaha özgü `adsTime`: M24 0,167 → 0,25 sn, Barrett 0,167 → 0,32 sn (sunucu da aynı Soldier kodunu koşar).
- Retikül (BattleBit sadeliği): ince tam çizgi (merkezde küçük boşluk), kenarda inceltilmiş direkler (2,6 → 1,5), her 10 birimde mil noktaları + ara çentikler, küçük kırmızı merkez; kasnak 3,4 → 0,9 vh, dışı daha koyu bulanık. Telefonda merkez ölçeği yalnız kırmızı noktaya uygulanır.
- Sürgü: dürbünde kalınır; sürgü sesiyle aynı anda (0,3–0,85 sn) dürbün halkası sağ-alta kayar / hafif yatar, görüş az yatar (ViewModel.boltK → HUD); bekleme süresi bitince halka ortadadır. Dürbünde iz mermisi gözün 5 m önünden retikül altından çıkar, kendi namlu alevi görüşü kapatmaz.
- Tepme (yalnız `scope` silahlar): kalıcı pay 0,55 → 0,10, geri dönen 0,45 → 0,90 → zirve aynı (~70 px), 0,3 sn'de hedefe döner (kalıcı ~8 px).
- İsabet: `scope` silahlarda nişan payı = smoothstep((adsT − 0,6) / 0,4); belde ve erken quickscope'ta ilk atış indirimi yok. Dürbünde 100 / 200 m ilk atış merkezden ≤ 0,4 / 0,8 cm (değişmedi); M24 no-scope 15 m gövde isabeti %100 → %24, Barrett %13; %50 nişanda sapma = bel.
- Denge (hasar değişmedi): M24 kafa her mesafe, gövde ≤ 197 m (Ağır Destek 125 can: yok), bacak yok · Barrett kafa / gövde her mesafe, bacak ≤ 342 m. Botlar aynı statları kullanır (yalnız dürbün süresi 0,25 / 0,32 sn oldu).
- Testler: `scripts/snipertest.mjs` (ağsız: sapma, eşikler, dürbün süresi), `scripts/snipershots.mjs` (kare dizisi: bel → %30/60/85/100, atış + sürgü, çıkış; önce / sonra /tmp/wb-sniper/oncesonra.png). adsalign (sniper / barrett ≤ 1,8 px), adszoom, combattest, nettest, vite build.
- Kalan: dürbünde sallanma + nefes tutma, Ayarlar'da ayrı "dürbün hassasiyeti" (şimdilik hassasiyet / büyütme^0,8), düşmana dürbün parlaması, telefonda sonrası kareleri — yapılmadı.

### 12.154 Nişan yakınlaştırması zaman içinde: silah / nişangâh değişiminde sıçrama, ölüm kamerasında takılı büyütme
Kullanıcı: "bazı nişangâhlarda acayip zoomlama gibi bir bug var". Önceki ölçümler (adszoom, adsalign) yalnız durağan kareye / düz giriş-çıkışa bakıyordu; `scripts/zoomtrace.mjs` her karede dünya kamerası FOV'u, silah kamerası FOV'u, PiP (ACOG merceği) FOV'u, adsT, dürbün örtüsü / HUD retikülü ve nişangâhın ekran boyunu kaydeder (her silah × izinli nişangâh giriş-çıkış + hızlı tekrar basma; seçili silahlarda ateş / şarjör / koşu / zıplama / silah değiştirme / nişangâh değiştirme / ölüm / yeniden doğuş; Ayarlar FOV 70 / 90 / 100–110; masaüstü + Pixel 7).
- **Hata 1 — nişandayken silah değiştirme**: `switchTo` adsT'yi sıfırlamıyordu; adsT ≈ 1 iken yeni silahın büyütmesi / örtüsü o karede devreye giriyordu. Tabanca demir nişanda (×1,15) sağ tık basılıyken keskin nişancıya geçince dünya tek karede **×1,15 → ×3,98**, dürbün örtüsü + kararma açılıp ~0,15 sn'de kapanıyordu (ters yönde ×4 → ×1,15 tek kare). Her FOV ayarında.
- **Hata 2 — nişandayken nişangâh değiştirme** (B): `cycleOptic` aynı sorun; tam nişanda büyütme tek karede değişiyordu (demir ×1,15 ↔ red dot ×1,3, telefonda ×1,3 ↔ ×1,6).
- **Hata 3 — nişandayken ölüm**: ölüyken `Soldier.update` erken dönüyor, adsT donuyordu → ölüm kamerası dürbünlü tüfekte **×4**, ACOG'da ×1,15, holoda ×1,3 büyütmede kalıyor (örtüsüz), yeniden doğuşta tek karede ×1'e iniyordu (silah kamerası 40° → 54° de).
- Düzeltme: `switchTo` / `setLevel` / `cycleOptic` adsT = 0 (yeni silah / nişangâh belden başlar; sunucu da aynı Soldier kodunu koşar, tahmin uyumlu); ölüyken adsT nişan çıkış hızıyla (9/sn) söner. Dünya kamerasında tek karelik sıçrama olmasın diye `Player.update` silah|nişangâh anahtarı değişince eski silahın tam büyütmesini ve adsT'sini alıp **kendi çıkış eğrisiyle** (aynı adsEase, Soldier ile aynı hız: 12.153 `adsTime` ya da 6 / 9) söndürür; kamera = max(yeni nişan büyütmesi, sönen kuyruk). Normal giriş / çıkış yolu değişmedi (tek eğri, 12.127).
- Ölçülen ama hata çıkmayan: düz giriş / çıkış ve hızlı tekrar basmada tüm 65 silah:nişangâh monoton, dünya ↔ silah kamerası ilerlemesi senkron (≤ 0,05); ateş / şarjör / koşu / zıplamada takılma yok; ACOG PiP açılış / kapanış ve telefon lensHud yedeği nişandayken değişmiyor; paintball giriş-çıkış ve normal silaha geçiş temiz; FOV 110'da (telefon yatay) aşırı / ters zoom yok. Dürbünün çıkış sonunda son iki karede ×2,2 → ×1,6 → ×1 inişi eğrinin tasarımı (ease-in çıkış); dürbün tasarımına dokunulmadı.
- Önce / sonra: `/tmp/wb-zoom/once/` (grafik + kare şeridi) ve `/tmp/wb-zoom/`. Sonuç: masaüstü FOV 70 / 100 olay senaryoları 70/70, tüm giriş-çıkış / tekrar basma FOV 100 130/130, telefon FOV 110 17/17; adsalign 118 ölçüm 0 hata, adszoom 9/9.
- Test: `node scripts/zoomtrace.mjs [url]` (`DEV=desk|mob`, `FOV=70,90,110`, `ONLY=senaryo:silah:nişangâh`, `PLOT=1`, `PLOTALL=`, `STRIP=` kare şeridi).

### 12.151 Firefox: gölgelendirici ön ısıtma, son işleme siyah ekranı, kare adımı titremesi, uyarlamalı çözünürlüğün geri gelmemesi
- Kullanıcı: "Firefox tabanlı tarayıcılarda görüntü kalitesi ve donma sorunları var". Playwright Firefox 157 (pencereli, gerçek GPU) ↔ Chromium 156 (ANGLE Metal), M4 Pro, 1600×900 @2×, "Orta" (pr 1,5). Not: ölçümler 11 ajanın aynı anda Playwright koştuğu yüklü makinede alındı (gürültülü).
- Arka uç: Firefox WebGL2 ayrı GPU sürecinde, renderer "Apple M1, or similar" (maskeli), **KHR_parallel_shader_compile YOK** (Chromium'da var), MSAA 4, anizotropi 16, highp. Normal ayarda sahne görüntüsü iki tarayıcıda aynı (ort. piksel farkı 1,6–4,7 / 255; renk / keskinlik aynı) → /tmp/wb-ff/before/yanyana-*.png. Menüde Firefox arka plan bulanıklığını (backdrop-filter, .mn-auth) daha zayıf çiziyor (yalnız kozmetik, dokunulmadı).
- **Donma nedeni = ilk kullanımda program derleme**: ACOG ilk nişan 9 program (render hedefi varyantları: PiP sahneyi hedefe çizer → doğrusal çıktı / ton eşlemesiz) Firefox **508 ms** (Chromium 67 ms); ilk nişan (silah yarı saydam → "opaque" anahtarı) 70 + sonraki kare 195 ms; tabanca / el bombası / bıçak ilk çekiliş 15–45 ms. JS dışı bekleme de var (GPU süreci bağlamayı bir sonraki karede bitiriyor). GC / ses / ağ kaynaklı uzun kare görülmedi.
- **Düzeltme 1 — ön ısıtma** (`src/game/warmup.js`, Game kurucusunun sonunda, yükleme ekranı açıkken): ana sahne + 64² HalfFloat MSAA hedef varyantı (PiP ve "Yüksek" son işleme aynı programları kullanır), birinci şahısta donanımdaki her eşya + ana silahın izinli her nişangâhı (namlu alevi, ACOG merceği görünür) opak ve setFade(0,5) saydam hâliyle; her biri derlenir ve küçük hedefe bir kez çizilir (sürücünün ilk çizimde tamamladığı iş). Mevcut silah / nişangâh geri yüklenir. Bedel: yüklemede Firefox ~1,1 sn, Chromium ~0,4 sn (27 program).
- **Düzeltme 2 — parmak izi direnci (LibreWolf / Mullvad / Tor, `privacy.resistFingerprinting`)**: MAX_RENDERBUFFER_SIZE / MAX_TEXTURE_SIZE 2048, MAX_VIEWPORT_DIMS 4096, zamanlayıcı 16,7 ms, rAF 60 Hz. "Yüksek"te son işleme hedefi 3200×1800 > 2048 → çerçeve tamponu eksik → **ekran tamamen siyah**. Post.begin() artık sınırı aşınca false döner, sahne doğrudan ekrana çizilir. Tuval pixelRatio'su `fitRatio` ile MAX_VIEWPORT_DIMS'e sığdırılır (kurulum, uyarlamalı, Esc → Ayarlar).
- **Düzeltme 3 — kare adımı yumuşatma** (`Game.frameDt`): Firefox rAF zaman damgası ~1 ms (RFP'de 16,7 ms) kuantalı; 60 Hz'de 16,7 / 33,3 / 0 dizisi kamerayı bir kare çift, bir kare hiç ilerletiyordu. Adım ortalama kare süresine yakın, gerçek zamanla fark her karede %15 kapatılır; > 100 ms takılmada eski davranış.
- **Düzeltme 4 — uyarlamalı çözünürlük**: masaüstünde geri yükseltme yalnız < 13,5 ms (> 74 FPS) idi → 60 Hz ekranda bir kez düşen çözünürlük HİÇ geri gelmiyordu (Firefox'un yavaş makinelerde < 40 FPS'e düşmesiyle kalıcı bulanıklık). Artık ekran yenileme süresi tahmin edilir (p.vs); kare buna dayanmışsa yükselir; düşüşten sonra 10–48 sn bekler (salınım olmasın).
- Ölçüm (`scripts/ffperf.mjs` 60 sn senaryo + harita değişimi; önce → sonra): Firefox maç %1 düşük 30,7 → 42,2 FPS, > 50 ms 6 → 2, > 100 ms 2 → 0, en kötü kare 510 → 72 ms (ilk kare); harita 2: > 100 ms 1 → 0. Chromium %1 düşük 71,6 → 93,2, > 100 ms 1 → 0. RFP + "Yüksek": siyah ekran → normal görüntü. Araçlar: `scripts/ffprobe.mjs` (arka uç / sınırlar, RFP=1), `ffshots.mjs` + `ffcompare.py` (yan yana), `ffperf-ctx.mjs` / `ffperf-hist.mjs` (uzun kare çevresi / dağılım). macOS'ta bu ortamda Firefox gerçek profile yazamıyor → betikler geçici ev dizini verir (`CFFIXED_USER_HOME=/tmp/wb-ff/home`). `npx vite build` OK.
- Kalan: Windows Firefox (ANGLE D3D11, derleme daha pahalı) ölçülemedi; sınıf değişip yeni silahla doğunca o silahın programları yine ilk kullanımda derlenir (ön ısıtma yalnız başlangıç donanımı); Firefox'ta 120 Hz'de ~%4 kare 10–20 ms (vsync kaçırma) titremesi sürüyor.

### 12.141 Tabanca hissi (tepme, sürgü, kovan, alev) + yeni atış sesleri (taslak A / B / C)
- Kullanıcı (arkadaşlarla canlı test): "tabanca hissiyatlarını iyileştir, atış sesleri de beğenilmedi".
- **Tabanca (Glock 17, M1911, Desert Eagle, Revolver, paintball tabancası)**, yalnız birinci şahıs görüntüsü; hasar / menzil / atış hızı / nişan tırmanması (s.recoilP) DEĞİŞMEDİ. MAC-10 (makineli) eski tepmede.
  - Eski tepme 20–36 ms'de sönüyordu (tek karelik titreme). Yeni: yay-sönüm tepmesi (player.js `PISTOL_FEEL`: geri, yukarı, namlu kalkışı kabza çevresinde, rastgele yan yatış), ≈ 30 ms'de tepe, ≈ 130 ms'de tok oturur; seri atışta üst üste biner. Nişanda kalkış nişan noktası çevresinde (retikül ortada kalır).
  - Görüş tepmesi (yalnız görsel, mermi yönü aynı): Glock 0,37°, Deagle 0,9°, Revolver 1,1°; hızlı toparlanır.
  - Sürgü ayrı grup (s3kit `k.grp = 'slide'`; nişan / RMR sürgüyle kayar, 3. şahısta ana ağda): atışta 14 ms geri, 70 ms'de önde. Son mermide geride kilitli; boş doldurmada şarjör takılınca (%64) öne fırlar + küçük sarsıntı. Revolver: silindir her atışta 60° döner.
  - Kovan (kamera uzayında, sağa-yukarı fırlar, döner), yıldız biçimli alev (tüm silahlar; eski düz sarı kutu yerine; nişanda küçük), namlu ışığı (el / silah bir an aydınlanır). Birinci şahısta göz önündeki dünya alevi (düz sarı kutu) kaldırıldı.
  - Çekme: sağ-alttan yan yatık gelir, hafif aşıp oturur. Doldurma: tabancada kol şarjı yok (sol kol ekranı kaplıyordu), sürgü bırakma.
  - Ölçüm: `scripts/pistolfeel.mjs` (t = 0 / 30 / 60 / 100 / 160 ms, bel + nişan, son mermi, çekme, doldurma) + `scripts/pistolmontage.py` önce / sonra.
- **Atış sesleri** (`src/game/gunsynth.js`): prosedürel, dosya / telif yok. Her sınıfın sesi bir kez örnek örnek hesaplanır (yakın 2 çeşit + uzak 1 + kendi silahının mekanik sesi), maçta yalnız çalınır (atış başına 1–3 kaynak; eskisi 5–7 düğüm). Katmanlar: çatlama (+ ses üstü mermide N-dalgası), gövde, havlama (silahın rengi), gümbürtü (doyumlu, tok), kuyruk, yansıma, tıslama (gaz / roket). Uzak (25 → 90 m geçiş): çatlama yok, boğuk, uzun kuyruk. İç mekân yankısı eskisi gibi (verbOut). Kendi silahında sürgü / kurma kolu sesi + yere düşen kovan (eskiden kendi atışın konumlu çağrıldığı için mekanik ses hiç çalmıyordu).
  - Taslaklar: **A** = eski (audio.js GUN) · **B** = tok / arcade (gümbürtü + doyum yüksek, kısa kuyruk, belirgin mekanik) · **C** = açık hava / gerçekçi (parlak çatlama, uzun kuyruk, çift yansıma). Varsayılan **B** (`SHOT_DRAFT`), oyunda `?sfx=A|C` ile denenir. AK-47 'rifle' sesi eskiden tabloda yoktu (varsayılana düşüyordu), artık kendi profili var. Susturucu profili tabloda (henüz silah yok).
  - Düzey: ilk 300 ms ortalama düzeyi A −35,9 dB, B −35,0, C −35,1 dB (eşit); uzak (80 m) düzeyleri eskiye yakın; seri atışta tepe B 0,37 / C 0,52 (kırpma yok). Ayarlardaki efekt düzeyi aynı zincirden (sfxBus) geçer.
  - Dinleme: `scripts/sfxdrafts.mjs` → /tmp/wb-sounds/<sınıf>-<A|B|C>[-seri|-80m].wav + index.html (karşılaştırma) + olcum.json.


### 12.152 Botlar: roller (nişancı / pusucu / taarruzcu / destek), insani nişan, zorluk davranışı, köşeye sürtünme
- Ölçüm araçları: `node scripts/botstats.mjs [harita] [mod] [zorluk] [NvN] [sn] [tohum]` (rol / silah dağılımı, yaşam, öldürme mesafesi, isabet / kafa, tepki, görünür kalma, habersiz yenen hasar, sürtünme, takılma, rota tekrarı, beyin ms / adım; `BLUE=hard RED=easy` karışık zorluk, `SEEDS`, `JSON=1`), `botstats-table.mjs` (önce → sonra tablo), `botduel.mjs` (ateş etmeyen, A/D yapan "insan" hedefe karşı tek bot: 15 / 35 / 70 m öldürme süresi), `bottrace.mjs` (rol izi).
- Önceki durum (colgecidi 8v8 normal): nişancılar tüfekçiyle aynı yerde (nişancı öldürme mesafesi medyan 16–20 m), rol yok, uzakta bot sapması mesafeyle iki kez büyüyordu (70 m'de M24 bile %2–4 isabet), takılma 1,2–1,6 / dk / bot, yürürken sürtünme %8–10 (kapı pervazı: 0,9 m ara nokta yarıçapı köşeyi kesiyordu), zorluklar yalnız sayıda farklıydı.
- Yeni `src/game/botTactics.js` (bot.js yalnız kanca çağırır; Vagon ve Enfekte'de rol / mevzi yok — payloadBots / huddle aynen):
  - Harita taktik verisi otomatik: düşmanın doğuştan bayrak / rakip doğuşa A* yolları = trafik. Nişancı mevzisi: kendi yarısında, trafiğin 28–115 m'sini gören, 26 m içindeki trafiğe görünmeyen, 1 m çevresinde kat kenarı / uçurum olmayan nokta (bakış yönü = görünen trafiğin ağırlıklı yönü, çömelince görüyorsa çömelir). Pusu: trafik noktasının 4–14 m yanında, duvar dibinde, o noktayı gören ama düşmanın 12 m geriden göremediği (köşe arkası) nokta. Sabit koordinat yok; harita+mod+doğuş başına bir kez, modül önbelleği, üreteçle adım başına ≤ 4 ms (sunucu tik'i takılmaz).
  - Roller doğuşta: nişancı (nişancı tüfeği; kolayda %50), pusucu (takımın %8 / 15 / 20'si; ölüm maçında yarısı), taarruzcu (%30 / 25 / 25; pompalı / SMG öncelikli, %70 yan dolanır, yakına girer), destek (sıhhiye / cephaneli ağır), tüfekçi (kalan). Silah Yarışı / Paintball / katlı ızgaralı haritalarda yalnız tüfekçi / taarruzcu.
  - Nişancı: mevziye gider, tarar, dürbünde sabitlenmeden (zorluk: 1,5–2,3 / 1,0–1,6 / 0,8–1,25 sn) basmaz; 2 atıştan sonra %0 / 30 / 55 yer değiştirir; 15 m içine düşman girince geri çekilir (12 m altı tabanca). Pusucu: çömelir, rotaya bakar, bakmayan düşmanı 13 m (pompalı / SMG) / 22 m'ye kadar yaklaştırır, tepkisi %30 hızlı; 28–48 sn kimse gelmezse başka pusuya geçer. Mevzidekiler sese / son görülen yere koşmaz, yalnız bakar.
  - İnsani nişan (Enfekte dışı): hedef değişince yönlü ilk hata (err × flick) sönümlenir, kalıcı el titremesi, hareketli hedefi gecikmeli izleme (0,17 / 0,11 / 0,075 sn: A/D yapanı ıskalar); eski mesafe kare cezası kalktı. Zor tepki alt sınırı 0,26 sn (0,2 idi).
  - Zorluk davranışı: duyma menzili ×0,55 / 0,85 / 1, sese gitme %12 / 30 / 55, ölen arkadaşın düştüğü yere (katile değil, kaba yöne) bakma %0 / 45 / 85, can 25 / 38 altında geri çekilerek ateş (kolay yok), el bombası beklemesi ×1,7 / 1 / 0,8, aynı hedefe ateş eden arkadaşla açıyı açma %0 / 35 / 70.
- Yol takibi: ara nokta 0,9 m'de geçilmiş sayılır ancak bir sonraki nokta ızgarada görünüyorsa (değilse 0,35 m'ye kadar yürür) → colgecidi sürtünme %4,6 → %1, takılma 0,59 → 0,06 / dk / bot.
- Ölçüm (colgecidi 8v8 240 sn, önce → sonra): isabet kolay / normal / zor %12 / 15 / 21 → %15 / 17,5 / 38; nişancı öldürme mesafesi (normal) 20 → 28 m (mevzide 50–90 m hedef tutuyor); pusucu K/Ö normal 2,3, zor 1,1; zor↔kolay karışık maç K/Ö 7,1 → 5,6 (zor hâlâ açık ara, artık daha az ezici); beyin 0,33 → 0,17 ms / adım (16 bot). Düello (insan benzetimi, M4, öldürme sn 15 / 35 m): kolay 4,4 / 9,3 → 3,4 / 6,4 · normal 2,4 / 5,6 → 1,4 / 3,1 · zor 0,9 / 3,2 → 0,83 / 2,1.
- Kalan: pusucunun K/Ö'sü düşük (yolda ölüyor; mevziye varmadan çatışma), nişancı mevziye giderken uzak hedef görünce yolda durabiliyor, kolay botun 15 m isabeti hâlâ yüksek (öldürme süresi farkı yeterli ama isabet farkı ince ayar ister), Paintball / katlı ızgarada (Boya Kulesi, Orman Kalesi) mevzi verisi yok, siper arkasına geçme (şarjör / can) yapılmadı.

### 12.155 ACOG 3×: şevron yerine sade kırmızı nokta
- Kullanıcı: "3× nişangâhı (ACOG) kötü görünüyor, ona sade bir nokta yap". Eski retikül: kırmızı şevron + ince siyah artı + üç kırmızı düşüş çizgisi (PiP gölgelendiricisi, telefon yedeği HUD #scope .chev SVG'si, geçişte 3B ışıyan şevron).
- Artık üç yolda da red dot dilinde tek nokta (keskin çekirdek + çok hafif parıltı), mercek merkezinde = mermi noktası; merceğin kendisi (PiP, göz çanı halkası, vinyet) aynen:
  - **PiP gölgelendiricisi** (player.js PIP_FS): nokta çapı `uDot` ekran pikseli → 3× büyütmeyle büyümez. Tam nişanda HUD #rdot boyu (masaüstü 0,62 vh ≈ 5,6 px @900; telefon max(5 px, 0,5 vh) × nişangâh boyutu ayarı --rs, Pixel 7'de ≈ 13 cihaz pikseli). Geçişte (adsT 0,3 → 1) 3B noktanın o anki ekran boyundan bu boya kayar; parıltı nokta boyuyla ölçeklenir; nokta `uOn` ile soluklaşmaz (3B noktadan PiP'e geçiş anında sönüp yanmıyor).
  - **3B ışıyan nokta** (s3weapons acog / s3rifles PSO-1): `ACOG_DOT` 0,65 mm kare, göz merceğinin önünde eksende (eski iki çubuklu şevron); `lens[4]` ile PiP'e boyunu bildirir.
  - **Telefon yedeği** (Düşük kalite / < 40 FPS, `lensHud`): HUD #scope'ta SVG şevron yerine `.adot` = #rdot ile aynı CSS (telefonda 1 px koyu kenar dahil). stats.js `acog.reticle` 'chevron' → 'dot'.
- Ölçüm: adsalign artık ACOG'da nokta ağırlık merkezini ölçer (+ telefonda `HUDy`: yedek HUD noktası) → masaüstü + Pixel 7 16/16, en çok 0,1 px. Geçiş %29 (3B) → %31 (PiP): aynı yer, ~2 px → ~2 px. acogshots: `TS=` (adsT listesi), `LENSHUD=1` (telefon yedeği), kararma açılsın diye HUD 20 kare güncellenir.
- Önce / sonra: `/tmp/wb-acogdot/oncesonra.png` (M4 / AK47 / MP5 / SVD, masaüstü 1600×900 + Pixel 7, %100 | %70 | merkez 2× + telefon yedeği). vite build.

### 12.156 Atış sesleri A'ya dönüş, keskin nişancı nefes tutma (dürbün sallanması), belden keskin nişancı isabetsizliği + artısız bel
Kullanıcı: "atış sesleri eskisi kalsın, A yap; keskin nişancıya NEFES desteği ekle; sniper'ler zoom açmadan direkt sıktığın yere gidiyor mermi — belden isabetsizlik yapılacaksa nişan almadan ekrandaki mermi nişangâhını kaldıralım".
- **Atış sesleri**: `SHOT_DRAFT = 'A'` (gunsynth.js) → eski katmanlı sentez (audio.js GUN tablosu), tampon önhesaplaması A'da zaten kapalı (ek yük yok); B / C `?sfx=B|C` ile denenebilir. 12.141 hata düzeltmesi A'ya da taşındı: kendi atışın konumlu çağrıldığı için mekanik tık (`P.m`) hiç çalmıyordu → `!pos || v.d < 2,5`. AK-47 ('rifle') A'da eskisi gibi varsayılan profil (A'nın sesi birebir eski kalsın diye; B / C'deki kendi profili yalnız oralarda).
- **Nefes / dürbün sallanması** (`src/game/breath.js`, yalnız `overlay: 'scope'`: M24 + Barrett; yalnız yerel insan oyuncu, botlar ve sunucu dokunmaz): yavaş Lissajous (yatay 1,6 rad/sn + sürüklenme, dikey 2× frekans → 8 çizer), temel genlik 4,5 / 3,2 mrad (Barrett ×1,25, çömelik ×0,7, yüzüstü ×0,45, yürürken ×1,9'a kadar), dürbün otururken (adsT 0,55 → 1) açılır. Sallanma **bakışa (yaw / pitch) sanal fare hareketi olarak eklenir**: kamera, retikül ve mermi aynı yere bakar; çevrim içinde yaw / pitch zaten her girdiyle sunucuya gidiyor (humanTick `s.yaw = inp.yw`) → tohum / ek protokol gerekmedi, sunucu sallanmayı bilmeden aynı yöne atar. Çıkınca / ölünce ofset sıfıra söner (bakış kaymaz).
  - **Nefes tut**: yeni tuş eylemi `holdBreath` "Nefes tut (dürbünde, basılı tut)", varsayılan Shift (koşu ile ortak; dürbünde koşu zaten yok, aç-kapa nişanda dürbündeyken Shift artık nişanı kapatmıyor). 0,25 sn'de sallanma %5'e iner, en çok 4,5 sn; süre bitince zorla bırakılır (tuş bırakılana dek tutulamaz) + 3 sn nefes nefese (genlik ×2,2'ye kadar, daha hızlı + dikey nefes titremesi), erken bırakmada kullanılan nefesle orantılı 0,4–2,2 sn; dolum 4 sn (nefes nefeseyken yarı hız), en az %20 nefesle başlanır. Ses: hafif nefes alma / verme, bitince üç kesik soluk (sfx gürültüsü, abartısız; kalp sesi yok).
  - Gösterge: dürbün katmanında alt-orta ince çubuk (`#breath`, #scope'tan sonra eklenir; dolu ve tutulmuyorken soluk, azalınca / nefes nefeseyken turuncu).
  - **Dokunmatik**: dürbündeyken ateş düğmesinin üstünde küçük nefes düğmesi (rüzgâr simgesi, basılı tut; düzen düzenleyicide taşınır, dürbünde soluklaşmaz). Otomatik nefes seçilmedi (zamanlama oyuncuda kalsın). Not: dokunmatik nişan yardımı dürbünde hâlâ hedefe çeker → telefonda sallanma kısmen bastırılır.
  - Ölçüm (masaüstü 1600×900, M24 4×, 1 px = 0,43 mrad, 3 sn, fare yok): önce 0 px · tutmadan 13 × 9 px (≈ ±27 cm @100 m) · tutarken 2 × 1 px · nefes nefese 31 × 28 px · toparlanınca 15 × 10 px. Telefon (Pixel 7) 14 × 8 / 1,5 × 0,5 / 34 × 27 px.
  - Çevrim içi uyum (farshotnet, Vadi, hedef kafa kenarına, `SWAY=1` sallanma nişanda kalır): M24 / Barrett 60 + 100 m 144 atış, istemcinin gördüğü isabet ≠ sunucu onayı 3 tık (kafa kenarında, 12.146'daki tetik zamanlaması kalıntısı); sallanmasız kontrol 0/72.
- **Belden keskin nişancı** (yalnız insan; botlar 12.153 eğrisinde: hip 0,03 / 0,04, eşik 0,6): ölçüm (scripts/sniperhip.mjs, gerçek _shoot + gerçek vuruş kutusu, göğse nişan, 4000 atış; çevrimdışı ≈ çevrim içi tohumlu):

  | | 10 m önce | 10 m sonra | 20 m önce | 20 m sonra | adsT 0,8 atış 20 m önce → sonra |
  |---|---|---|---|---|---|
  | M24 (koni 30 → 90 mrad) | %100 (gövde 100) | %34 (kafa 6 gövde 16 bacak 12) | %57 | %10 | %100 → %10 |
  | Barrett (40 → 110 mrad) | %86 | %27 | %42 | %7 | %100 → %7 |

  12.153'teki "%24" r = 22 cm daire varsayımıydı; gerçek gövde kutusu 58 × 144 cm olduğu için M24 belden 10 m'de her mermi gövdedeydi (sapma p90 28 cm). Yeni: `st.noscope` koni (M24 0,09, Barrett 0,11 rad) ve isabet yalnız dürbün TAM oturunca açılır (`SCOPE_ACC` 0,85 → 1 yumuşak; altı belden sayılır). Dürbünde isabet değişmedi (100 / 200 m ≤ 0,4 / 0,8 cm).
  - **Artı yok**: elde dürbünlü silah varken (scope) HUD artısı (#cross) gizli — belden, 3. şahısta da; isabet / öldürme işareti çalışır. Diğer silahlar aynı. Telefonda da gizli; dokunmatik nişan yardımı belden keskin nişancıda kapalı (adsT < 0,5), dürbünde açık.
- Testler: snipertest (16 OK, yeni: adsT 0,84 belden sayılır), sniperhip (önce / sonra /tmp/wb-breath/{once,sonra}/hip.txt), snipershots (nefes evreleri + çubuk; /tmp/wb-breath/{once,sonra}/desk, sonra/mob), breathshots (Pixel 7: nefes düğmesi + çubuk, artısız bel), adsalign sniper / barrett 0 hata (≤ 1,8 px), bindtest OK (+2), nettest OK, farshotnet (yukarıda), A sesi oyunda (taslak A, tampon yolu çağrılmıyor, kendi mekanik tık çalıyor, sayfa hatası 0), vite build OK. Önce / sonra: /tmp/wb-breath/oncesonra.png.

### 12.157 Yeni mod: Uzay (düşük yer çekimi, enerji silahları, uzay kıyafeti) + Yörünge Üssü haritası
- Kullanıcı: "uzay modu — uzay gibi bir yerde olalım, yer çekimi uzaydaki gibi, silahlar da öyle, karakterlerin kostümleri de; güzel bir harita". Taslak (aşama 1) onaylandı; geri bildirim: takım rengi 30–40 m'de okunsun, ray tüfeği anlık atış (şarj atıştan sonra), kubbe içinden gök görünsün, Dünya dokusu çizgisiz, iç mekânda renkli vurgu ışıkları, dışta renk / ayrıntı, Ağır Destek'e enerji makineli.
- **Mod** `type: 'space'` (🚀, tr + en `src/i18n/space.js`): kurallar takım çatışması (`makeMatch` tdm'yi kurar + `space: true`; skor sınırı / süre aynı), botlu, çevrimdışı + çevrim içi; yalnız Yörünge Üssü (`MAPS_FOR` / `sanitizeCfg` / `mapsFor` / admin listeleri; `official.js` varsayılanı eklenmedi, admin panelinden resmi oda açılabilir). Hava yok (her zaman açık), gün saati yok (`forceTod: 'day'`, menüde "Uzay (harita)" notu).
- **Yer çekimi** (`World.grav`, Game kurar; sunucu, çevrimdışı ve istemci tahmini aynı `World.move`): `TUNE.spaceGrav` 0,36 (Dünya'nın ~1/3'ü), zıplama hızı `TUNE.spaceJump` ×0,86, havada yön denetimi `TUNE.spaceAir` 3,4 (normal 2,2) — admin → Oyun modları → Uzay. Zıplama 0,93 m / 0,72 sn → **1,96 m / 1,72 sn**. Düşme hasarı bu modda yok (`fallApplies`: `mode.space`). El bombası (`grenade.js` `nadeStep`: g ve yuvarlanma × `world.grav`; önizleme / bot nişanı / sunucu aynı) ve parçacıklar (`effects.gravMul` = √grav) yavaş düşer.
- **Silahlar** (`src/models/s3space.js`, S3 kiti; tek ağ + şarjör / sürgü grupları, aynı `finish()` sözleşmesi): Lazer Tüfeği (27 × 760/dk, ≈ M4), Plazma SMG (20 × 1000/dk, kısa menzil), Enerji Tabancası (yan silah, 26 × 420/dk, tabanca hissi `PISTOL_FEEL.epistol`, kovansız), Ray Tüfeği (110, 4× dürbün; atış ANLIK, ardından 1,3 sn şarj sesi + raylar sönükten parlağa dolar; 12.156 nefes / belden isabetsizlik `noscope` 0,09 / artısız bel kuralları `overlay 'scope'` ile otomatik geçerli), Dağıtıcı (8 × 12 saçma), **Enerji Makineli** (24 × 720/dk, 90'lık hücre; soğutma kanatları seride kızarıp beyaz-sarı kora döner). Kırık beyaz kabuk + koyu iskelet; ışıyan enerji parçaları yeni desen 3 (`skins.js` `uEn` rengi + `uEnK` gücü; adsalign eflatun ölçümünde sönük, nişan retikülü 'glow' yuvasında ayrı). Renkli iz (tracer) ve birinci şahıs alevi silahın enerji renginde (`src/game/space.js`).
- **Donanım** (`stats.js` sonundaki blok `SPACE_CLASS`, `spaceLoadout`; `Soldier.loadout()`): Saldırı lazer / plazma, Sıhhiye plazma / lazer, Keskin Nişancı ray tüfeği, Ağır Destek enerji makineli / lazer / dağıtıcı, Mühendis dağıtıcı / plazma; yan silah enerji tabancası; gadget / yakın dövüş normal sınıftaki gibi. Menüde seçilen silah türü uzay karşılığına çevrilir (pompalı → dağıtıcı, dürbünlü → ray, SMG → plazma, LMG → makineli, diğer → lazer). Başka modlarda görünmez (spacetest denetler). Botlar: `SNIPER_W` / `SNIPERS` ray, `CLOSE_W` plazma + dağıtıcı, `LMGS` makineli.
- **Ses** (`src/game/spaceSfx.js`, taslak A dili, `audio.js` `shot()` başında tek kanca): kısa "zap" (perdesi düşen ton) + süzgeçli gövde + gümbürtü; ray tüfeğinde çatlama + uzun kuyruk, dağıtıcıda çıtırtı, plazmada kabarcıklı ikinci ton; ray şarjı yükselen vızıltı + "hazır" tıkı. Kask içi: efekt yolunda 5,6 kHz hafif alçak geçiren (müzik / arayüz değil).
- **Uzay kıyafeti** (`character.js` `outfit: 'space'`, `spaceLook`): kırık beyaz kıyafet; takım rengi geniş omuzlar, sırt ünitesi (yaşam destek) + ışık şeridi, göğüs panelleri, uyluk bandı, kubbeyi izleyen üç parça kask şeridi; alçak poligon kask + takım renginde parlayan vizör, iki oksijen tankı, kalın diz / dirsek halkaları, ay botları; sınıfa göre küçük farklar (sıhhiye haçı, nişancı anteni, mühendis lambası + turuncu şerit, ağır zırh plakası). Asker başına ek malzeme 2 (ışıma + vizör). Birinci şahıs: beyaz kol, takım renginde eldiven, koyu bilek halkası. Okunurluk (`scripts/spacesuits.mjs`, FOV 72): 30 / 40 m'de asker kutusunun %15–19'u kendi takım renginde, karşı renk ≤ %0,2.
- **Harita "Yörünge Üssü"** (`src/maps/yorunge.js` + `yorungeSurface.js`, 120 × 80 m, 6v6–8v8, x = 0'a göre ayna): Ay'da bir krater çanağı (çevre kaya duvarı 6,5–13 m). Doğuş kapalı hangarlarda; kapı girişleri perde + kanca duvarlı (dışarıdan, çapraz bile doğuş noktası görünmez). Üç hat: ORTA kapalı (hangar → hava kilidi koridoru → Lab → koridor → cam kubbeli Merkez Modül: reaktör çekirdeği, iki asma kat), KUZEY açık (güneş tarlası, kraterler, kaya sırtı, çatısına çıkılan Anten İstasyonu 4 m), GÜNEY (iniş pisti + mekik, kanatlardan gövde üstüne çıkılır; ay aracı, krater). Her yarıda kuzey / güney iskeleler 3,5 m'de koridor çatısıyla köprü olur. Modül duvarları 6,2 m: en yüksek çıkılır yüzey (4 m) + zıplama (1,96 m) = 5,96 m < en alçak çatı / duvar 6,19 m → çatılara çıkılmaz; cam kubbeler ulaşılmaz. Görünen her katı parça birebir eksen hizalı çarpışma; kayalarda taban = çarpışma, üst %≤16 içe çekik.
  - Görsel: prosedürel yüzey (regolit + krater çukurları, Ay kayası, panel derzli gövde, iç zemin, güneş paneli, pist, ızgara, uyarı şeridi; doku dosyası yok), uzay göğü kameraya kilitli (1600 yıldız, 3B değer gürültülü Dünya + atmosfer halesi ≈ 46° yükseklikte — kubbelerin içinden de görünür, güneş parlaması), kubbe camı tek ağ + kaburgalar tek ağ, tabelalar tek doku atlası / tek ağ, iç mekânda takım renkli hangar ışıkları, reaktör halesi, sahte ışık havuzları (tek örnekli eklemeli ağ; gerçek ışık yok), dışta renk bantları, uyarı lambaları, kablolar, kargo konteyneri şablon yazıları, pist halkası. Harita 30 ağ / 36 bin üçgen. Küçük resim `public/img/yorunge.jpg`.
  - Botlar zemin katında yol bulur (tek katlı NavGrid; 12.152 rol mevzileri yalnız bu ızgarada çıkıyor — üst katlar insan oyuncunun dikey avantajı).
- Ölçüm: tarayıcısız 8v8 180 sn 113 öldürme, takılma 0,02 / dk / bot, yeraltı 0, roller tüfekçi 7 · destek 3 · nişancı 2 · pusucu 2 · taarruzcu 2. Çevrim içi (iki istemci, yerel sunucu): 4 zıplamada tahmin düzeltmesi 0, kendi zirve 1,96 m, öbür istemcinin gördüğü 1,96 m; 15 m düşüş can 100; lazer isabeti sunucu onaylı. Masaüstü çatışmada 420–440 çizim çağrısı / ≈ 96 bin üçgen; Pixel 7 440–510 / ≈ 100 bin (Maden 380–465 ile benzer; ilk taslakta kıyafet malzemeleri yüzünden ~690'dı → ışıklar tek malzemede).
- Testler: yeni `scripts/spacetest.mjs` (0 tarayıcısız: mod / eşleme, zıplama, düşme, el bombası, donanım, nav + yollar, doğuş görüşü + dışarıdan doğuş görünürlüğü, zıplama sızıntısı, bot maçı · 1 menü kartı + Oyna + çevrimdışı · 2 çevrim içi), `spacecam` (serbest kamera + çağrı / üçgen), `spacefp` (birinci şahıs, ısınma / şarj), `spacesheets` + `spacelab.html` (silah / kıyafet / yüzey sayfaları), `spaceplan.mjs/.py` (kuşbakışı şema), `spacesuits` (okunurluk), `spacefight` (çatışma anı + kare süresi), `spacegrid.py`. adsalign 6 silah × nişangâh masaüstü + Pixel 7 36/36 ≤ 2 px, weaponaudit 6/6, combattest, nettest, smokeall, headless-sim, vite build OK. Görseller: /tmp/wb-uzay/taslak (aşama 1), /tmp/wb-uzay/son.
- Bilinen: `gripfit` / `armclip` Node'da 12.141'den beri çalışmıyor (`flashTex` → `document`), kabza oturuşu görsel denetlendi; botlar iskele / asma kat / anten çatısına çıkmaz; ray tüfeği 3. şahısta şarj ışıması göstermez (yalnız birinci şahıs) → 12.160'da çözüldü.

### 12.158 Yeni mod: Cephe (sektör ilerlemeli taarruz, 1940'lar) + Batı Cephesi haritası
- Kullanıcı: büyük, 1940'lar havasında bir cephe modu — siperler, sığınaklar, tel örgü, köy / kilise kulesi, dönemin silahları, iki kurmaca ordu (gerçek arma / sembol YOK). Aşama 1 taslağı onaylandı; aşama 2 geri bildirimi: harita 300 m kalsın ama ilk yürüyüş ~50 m; siper 4 m / 2 m genişlik iyi; siperden yalnız ateş basamağı ve rampayla çıkılsın; Kırmızı'ya MG42 tarzı ayrı makineli (Mavi BAR tarzı); kum torbası tuğla değil kumaş torba gibi; bilet ~120 + 48 / sektör ile başla, bot maçlarıyla %40–60'a dengele; ateş basamağında korkuluk ekranı kapatmasın, temiz dürbün görünümü (12.153 / 12.156), nişanda sürgü topuzu ve klips doldururken sol kol ekranı kaplamasın, birinci şahısta çıplak el değil üniforma renginde koyu eldiven.
- **Mod** `type: 'front'` (🪖, tr + en `src/i18n/front.js`): Mavi saldırır, Kırmızı savunur. 4 sektör × 2 nokta (A B · C D · E F · G H); yalnız etkin sektörün noktaları ele geçirilir (`front.capturable`), ikisi de Mavi'ye geçince sektör düşer → doğuşlar ileri kayar, Mavi'ye bilet ödülü (`TUNE.frBonus` 0,45 × başlangıç bileti), geri sektörler kilitlenir. Bilet yalnız saldıranda azalır (ölüm / dirilmeden dönüş); kanama yok. Savunan kazanır: Mavi'nin bileti biter ya da süre dolar; saldıran kazanır: son sektör düşer. Ele geçirme hızı ×1,3 (`frCapMul`), yeniden doğma Mavi ×1,0 / Kırmızı ×1,45. Çevrimdışı + çevrim içi (snapshot `"fr":[sektör]` + nokta sahipleri; olay `frs`; debug `frs` / `frt`), admin resmi oda (`MAPS_FOR` / `sanitizeCfg`, admin → Oyun modları → Cephe), kalabalık 8v8–16v16. Arayüz `frontHud.js`: sektör şeridi, bilet / sektör kutuları, kilitli / düşmüş noktalar soluk, dünya işaretleri, rol bandı; uzak top patlaması ışığı + duman (`frontFx.js`, telefonda 4 duman).
- **Bilet**: `LIMITS.frTickets` = oyuncu başına 21 → 12v12 **250**, sektör ödülü 112. Önerilen 120 + 48 ile başlandı; botlar 12v12'de 240 bilette bile %10 kazanıyordu → 250 / %45. Ölçüm (normal, `frontbots.mjs`): 12v12 7/14 (%50), 16v16 2/4 (%50), 8v8 2/4 (%50); ortalama düşen sektör 2,3–3,0, maç 11–20 dk. Sonuç iki tepeli: ya 1. sektör tutulur ya Mavi sona kadar yürür.
- **Harita "Batı Cephesi"** (`src/maps/cephe.js` + `cepheTerrain.js` + `cepheSurface.js`, 160 × 300 m, x −80..80 / z −150..150, sis 60–250 m): kuzeyde Mavi hatları (ateş siperi z +88, destek +104), ölüm bölgesi (huniler, tel örgü, kazıklar, kütükler), Kırmızı 1. hat (+50 / +34 / +20), harap köy + kilise ve çıkılan çan kulesi, çiftlik / ambar (asma kat), çukur yol (−40), orman + kulübe, batarya çukurları, güneyde ana hat (−104 / −122 / −138), beton tabya (G). İlk yürüyüş Mavi siperinden A / B'ye ~50 m.
  - **Arazi** `FrontTerrain`: 2 m ızgara yükseklik alanı; siper hücreleri düz taban (−1,6) ya da rampa; dik duvarlar arazinin kendisi → görünen = çarpışma (görünmez duvar yok, `wallAt` duvara tırmanmayı engeller). Siper 4 m (ateş) / 2 m (destek / bağlantı), zikzak dirsekleri, sığınaklar (siper içinde kapı önünde kum torbası perdesi). Siperden çıkış yalnız ateş basamağı (0,5 m kalas basamak, korkuluk torbaları üstü 0,24 m → basamakta ayakta göz 0,52 m: 28 cm görüş; çömelince saklı) ve rampalarla. Dönük kutular AABB büyütüp görünmez çarpışma yaptığı için her yapı eksen hizalı.
  - **Doku** (prosedürel, doku dosyası / UV yok, doğrusal renk uzayında): ham toprak, kumaş kum torbası (süper elips torbalar, dikiş / büzgü), kalas, moloz taş, dökük sıva (çatlak çizgisi kaldırıldı: yama gibi duruyordu), beton (kalıp izi), çamur (ayak izi), ördek tahtası, tarla, kiremit, is. Harita 8 ağ / 68,6 bin üçgen; küçük resim `public/img/cephe.jpg`. Tel örgü tek LineSegments.
  - **Doğuşlar**: aşama başına Mavi siper / alan noktaları, Kırmızı yalnız sığınak içi (dışarıdan görünmez); asma kat altı noktalar elendi; iki takımın doğuşları birbirini görmez (fronttest).
- **Silahlar** (`src/models/ww2weapons.js`, S3 kiti; `stats.js` 1940'lar bloğu, yalnız bu modda `FRONT_KIT`): Sürgülü Tüfek (74, 5'li şerit klips), Dürbünlü Tüfek (104, 4×; 12.156 nefes / `noscope` 0,09 / artısız bel geçerli), Yarı Otomatik Tüfek (Mavi, 46 × 330/dk, 8'li en-bloc, son mermide klips "ping" sesiyle fırlar), Kundaklı HMK (Mavi, 26 × 680) / Katlanır HMK (Kırmızı, 23 × 540), Hafif Makineli BAR tarzı (Mavi, 38 × 520, 20'lik), **Ağır Makineli MG42 tarzı** (Kırmızı, 28 × 1150, 50'lik bant kutusu, ayrı ses / görünüm), Tabanca, Saplı El Bombası (fitil 3,5 sn). Nişan yalnız gez-arpacık (dürbünlü hariç). Doldurma biçimi `clip` (`anim.js`): klipsi yukarıdan bas + sürgü; sol el ağırlıkları azaltıldı (sol kol ekranı kaplamaz). Sürgülü tüfekte nişanda sürgü topuzu görüşü kapatmaz. Botların rastgele seçimi yalnız kendi takımının silahı (`FRONT_TEAM`).
- **Ses** (`audio.js` sonundaki blok, taslak A dili): her silaha `GUN` girdisi (sürgülü tüfekte tok çatlama + uzun kuyruk, ardından sürgü; MG42 tarzında çok kısa, sert, yırtıcı seri), `clipReload`, `clipPing`, `distantBoom` (uzak top). B / C taslakları `gunsynth.js` SYN'de.
- **Üniformalar** (`src/models/ww2gear.js`, `character.js` `outfit: 'ww2'`): Mavi yeşil-haki ceket + yuvarlak çelik miğfer, kanvas tozluk, haki kemer / fişeklik, sırtta çanta + kürek; Kırmızı gri ceket + etekli çelik miğfer, uzun siyah çizme, siyah deri kemer + Y askı, gaz maskesi kutusu + ekmek torbası; takımı sol koldaki renkli bant ayırır; arma / rütbe / sembol yok. Birinci şahıs: üniforma kolu + koyu eldiven (Mavi `#3a2e24`, Kırmızı `#262220`), dirsek pedi / el koruması çizilmez.
- **Botlar** (`src/game/frontBots.js`; `bot.js`'te yalnız `g.front` korumalı kancalar — başka modlarda davranış birebir aynı, `botdeterm` vagon parmak izi online ile eşit; `botTactics` bu modda kapalı): savunan mevzi (oran kolay %50 / normal %65 / zor %70, tehdit altında ×0,85) ya da koruma; mevzi türü sınıfa göre (ateş basamağı, makineli yuvası, nişancı, pusu, siper). Mevzide çömel / doğrul ile göz atma. Saldıran hücum / kanat (%20) / nişancı (ulaşılabilirse yüksek nokta); siperden siper kapağına koşar, ateş ederken hedefe ilerler. Yalnız başı görünen düşmana kafadan nişan (yalnız bu mod). El bombası botlarda (`isFrag`: saplı bomba da sayılır). Mini haritada siperler çizilir. `NavGrid.comps` (bağlı bileşen) ile ulaşılamaz hedefte yol arama hemen biter (35 ms → 0).
- **Performans**: masaüstü siper görünümü 170–390 çağrı / 110–150 bin üçgen; Pixel 7 profilinde 16,6 ms / kare, çatışmada 560–660 çağrı (çoğu 24 asker modeli + gölgesi).
- Testler: yeni `scripts/fronttest.mjs` (46 denetim: aşama başına ulaşılabilirlik, doğuş çarpışması / görüşü, siper içi fizik yürüyüşü, havada duran kutu, ateş basamağı göz yüksekliği, donanım, çevrim içi iki istemci + debug sektör ileri), `frontbots` (başsız maç + ısı haritası / takılma yerleri), `frontcam`, `frontfp`, `frontplan.mjs/.py`, `frontbotshot`, `frontmobile`, `frontmenu`, `frontquick`, `cephelab.html` + `cephelab.mjs` + `cephesheets.py`. adsalign 1940'lar 16/16 ≤ 0,5 px (masaüstü + Pixel 7), weaponaudit 9/9, combattest, nettest, vite build OK. Görseller /tmp/wb-cephe/son.
- Bilinen: menüdeki cephanelik modern silahları gösterir (Cephe maçta kendi donanımını verir); 8v8'de ana hat (4, −108) önünde saldıranlar ara sıra takılıyor (%0,4); conquest / tdm `botdeterm` aynı sürümde de oynak (vagon belirlenimli).

### 12.159 Fener çevrimiçi: diğer oyuncular feneri görür (ışık havuzu + hüzme + göz kamaştırma)
- **Sorun**: F feneri yalnız kendi kameraya bağlı SpotLight'tı (`game.torch`); durum ağa gitmiyordu, başkaları feneri görmüyordu.
- **Ağ** (en az değişiklik): girdiye `tl: 1` (yalnız fener açıkken; yoksa alan hiç yollanmaz) → sunucu `room.input` `tl` → `humanTick` `s.flashOn` (zombide hep kapalı; sessiz adımın sahte girdisinde alan yok → değişmez). Snapshot'ta mevcut bayrak alanına yeni bit `F_TORCH = 256` (`packFlags`: `flashOn && alive && !zombie` → ölü / zombi oyuncuda sunucu hep 0 yollar). İstemci `applyFlags` → `s.flashNet`. Eski istemci `tl` yollamaz → kapalı sayılır; eski istemci 256 bitini yok sayar. Yan etki (doğru): sunucudaki botlar artık feneri açık insanı gece gündüz menzilinde görür (çevrimdışında zaten böyleydi, `bot.js` `e.flashOn`).
- **Görüntü** (`src/game/remoteTorch.js`, yalnız gece / gün batımı haritasında kurulur): (a) sabit havuz 4 SpotLight (gölgesiz), 12.151 ön ısıtmasından ÖNCE sahneye eklenir, kapalıyken intensity 0 → ışık sayısı hiç değişmez, malzeme yeniden derlenmez; her karede kameraya en yakın (önündekiler öncelikli, ≤ 60 m) 4 fener gerçek ışık alır. (b) En çok 12 fener için ucuz görsel: namlu ucunda additive parıltı sprite'ı (uzakta da birkaç piksel) + yarı saydam hacimsel hüzme konisi (ShaderMaterial, additive, depthWrite kapalı, sis yok, kenarlar ve uç yumuşak; boyu 8 Hz ışınla duvara / zemine kadar). (c) Göz kamaştırma: fener kameraya ≤ ~28° bakıyor ve arada duvar yoksa uçtaki parıltı büyür (en çok %80 opak, 55 m'de söner). Yön = bakış (yaw + pitch), çıkış = silah namlusu (`muzzleWorld`). Görsel slotlar ilk karede görünür bırakılır ki ön ısıtma programlarını derlesin; sonra gizlenir. Yerel oyuncunun kendi feneri değişmedi.
- **Botlar**: gecede (tod 'night') hedefi olmayan bot 2,5 sn sonra fenerini açar (arama / dolaşma), hedef görünce söndürür. Feneri açık bot gece uzaktan görünür olur (aynı kural).
- Testler: `scripts/flashnet.mjs` (iki tarayıcı, gece Kasaba, botsuz): A açınca B'de bayrak + hüzme + 1 gerçek ışık, A B'ye bakınca parıltı 0,65, A kapatınca / ölünce söner, programlar 50 → 50 sabit, FPS 30,1 → 30,1 (kabaca); nettest OK, vite build OK. Görüntüler: /tmp/wb-flash-shots/ (1 önce, 2 açık, 3 göz kamaştırma, 4 kapattı; z-* yakın plan).

### 12.160 Ray Tüfeği şarj ışıması 3. şahısta (diğer oyuncular da görür)
- Kullanıcı: atış sonrası şarj ışıması (1,3 sn; raylar sönükten parlağa, vızıltı + "hazır") yalnız sahibinin birinci şahıs ekranındaydı (12.157 "Bilinen") → başkaları da 3. şahısta görsün.
- **Ağ değişikliği YOK**: uzak oyuncunun atışı zaten `'sh'` olayıyla geliyor (`game.js` `onNetEvents`, `ev.m` = ilk saçma). Orada `st.charge` silahta `by.railT = 0`; çevrimdışı botlar / 3. şahısta kendin için `soldier.js` `_fire` aynı alanı sıfırlar. Sunucu / protokol / eski istemci etkilenmez.
- **Görüntü** (`space.js` `spaceTp`, `syncModel` her kare, yalnız `mode.space`): `railT` ilerler, `uEnK` = c² (c = railT / (60 / rpm) = 1,3 sn) + atış parlaması (0,5, 0,11 sn) + dolunca 0,3 sn "hazır" parıltısı (+0,9) → sonra 1 (tam parlak; hiç ateş etmemiş ray tüfeği değişmez). Eğri birinci şahıstakiyle aynı biçimde ama 0'dan başlar (0,15'te 3. şahıs boyutunda ton eşleme farkı siliyordu; sönük hâl seçilmiyordu).
- **Performans**: 3. şahıs silahı (silah, kaplama) başına paylaşılan LOD malzemesindedir; ilk atışta yalnız o askerin ray tüfeği ağlarına kendi kopyası takılır (`skinMaterial('railgun', kaplama, false)`, asker başına bir kez; silah yeniden kurulunca yeniden takılır). Aynı `customProgramCacheKey` + parametreler → three.js mevcut programı kullanır (derleme yok, 12.151 ön ısıtmasıyla uyumlu); sonra yalnız uniform. Çizim çağrısı değişmez (silah zaten ayrı ağ). Başka askerlerin paylaşılan malzemesi etkilenmez.
- **Ses** (`spaceSfx.js` `railReady`): başkasının ray tüfeği dolunca, dinleyici ≤ 15 m ise çok kısık konumlu "hazır" tıkı (kazanç 0,28, ref 6 m). Yerel oyuncunun birinci şahıs şarjı (vızıltı + tık, `spaceFire` / `spaceVm`) aynen.
- Test: yeni `scripts/railnet.mjs` (iki tarayıcı, yerel debug sunucu, Uzay / Yörünge Üssü, aynı takım 3,5 m): A ateş → B'de uEnK 0,43 (0 sn, atış parlaması) · 0,09 (0,4 sn) · 0,49 (0,9 sn) · 1,56 (1,4 sn hazır parıltısı) → 1; A'nın vm.charge 0,05 (birinci şahıs aynen); paylaşılan malzeme 1; programlar 54 → 54; "hazır" tıkı 1 kez; sayfa hatası 0. spacetest (tarayıcısız) OK, nettest OK, vite build OK. Görüntüler: /tmp/wb-railnet/ (`dizi.png` önce / 0 / 0,4 / 0,9 / 1,4 sn, `dizi-yakin.png` ray yakın planı, `z*.png` kareler, `0-once-tam.png` / `4-1.4s-tam.png` tam ekran).

### 12.161 Cephe modu yeniden: "Cephe Hattı" (çekişmeli, iki taraf kendi ucunda) + savaş atmosferi + siper duvarı çarpışma hatası
- Kullanıcı (canlıda oynayınca): Kırmızılar haritanın ortasında doğuyor, arkalarındaki yerler otomatik onların — harita işlevsiz; bir uçtan öbürü görünüyor, daha savaş atmosferi olsun; siper duvarları buglu, içine giriliyor.
- **Mod kuralı** (`src/game/front.js`; Battlefield 1 Frontlines benzeri): sabit saldıran / savunan YOK. Harita boyunca 7 noktalık zincir (`map.front.chain`): **Mavi KG (−2,106) — A Tank Enkazı (18,71) — B Batı Tabyası (−35,40) — C Köy Meydanı (16,−6, ORTA) — D Çukur Yol (−12,−40) — E Ambar (30,−64) — Kırmızı KG (−12,−111)**; zikzak dizilim, ORTA'dan iki karargâha yürüyüş 175 / 168 m. Aynı anda yalnız bir nokta etkin (`front.a`): zincirde onun Mavi tarafındakiler Mavi'nin, Kırmızı tarafındakiler Kırmızı'nın (kilitli). Başta yalnız C etkin ve kimsenin. Etkin noktayı iki takım da alır (conquest çubuğu, `capturable` / `capMul` kancası): Mavi alırsa (+1) etkin nokta Kırmızı ucuna bir kayar, Kırmızı alırsa Mavi ucuna; yeni etkin nokta çubuğu ortada başlar (`TUNE.frLean` 0; >0 eski sahibine yatık). Kilit: başta ORTA 25 sn (`frStartLock`: ilk varan kapmasın, iki ordu çarpışsın), her kaymadan sonra 10 sn (`frShiftLock`); HUD'da 🔒. Karargâh ele geçirme ×0,7 (`frHqMul`). Ele geçirme `frCapMul` 0,25 (0 → 1: 3 kişi farkla ≈ 16 sn, tek kişi ≈ 47 sn).
- **Kazanma**: düşmanın karargâhını alan; ya da düşmanın bileti biter; ya da süre bitince daha çok noktası olan (eşitse bilet). Bilet iki tarafa simetrik (`LIMITS.frTickets` 50/oyuncu → 12v12 **600**; her ölüm −1, canlandırma +1), az noktalı taraf fark kadar kanar (`TUNE.bleed` 8 sn'de bir × `frBleed` 1). Doğma süresi iki taraf aynı (`frRespawn`). Eski `frBonus` / `frAtkRespawn` / `frDefRespawn` kaldırıldı (admin: Oyun modları → Cephe yeni alanlar; balanceStore bilinmeyen yolları atar).
- **Doğuş kayması** (`cephe.js` §12, `STAGE_DEF`): doğuş = etkin noktanın sırasına göre (7 aşama), iki takım da hep kendi yarısında, etkin noktaya 30–75 m geride (siper tabanı / örtülü sığınak; açık tarla ancak arkada): bölge havuzu (Mavi sığınak / destek / ateş siperi, Kırmızı 1. hat siperleri, k1 sığınakları, köy, çukur yol, kuzey tarla, çiftlik, orman, ana hat, k3 / k4 sığınakları) + uzaklık süzgeci. Süzgeçler: etkin noktadan (merkez ± 6 m, göz) görünen doğuş elenir; iki takımın doğuşları birbirini görmez (gören noktalar elenir); üs bölgesi (düşmana 6 sn'den sonra hasar) etkin noktaya değerse yok. A* yürüme yolu (orta) Mavi / Kırmızı: 0 MK 43 / 77 · 1 A 52 / 55 · 2 B 67 / 72 · 3 C 50 / 47 · 4 D 66 / 60 · 5 E 63 / 64 · 6 KK 68 / 30 (karargâhı savunan yakın). `trenchPts` artık hücre ortalarını alır (tek sınır verilince noktalar hücre kenarına = duvar dibine düşüyordu); çukur yol rampası süzgeci haritanın bütün rampalarını değil yalnız yolun rampalarını eler.
- **Arayüz** (`frontHud.js`): sektör şeridi yerine CEPHE HATTI göstergesi (7 düğüm çizgi üstünde, sahibin renginde; etkin düğüm büyük, çubuk Mavi saat yönünde / Kırmızı tersine dolar; kendi karargâhın kesik çerçeveli), altında yön oku + ad + uzaklık + kilit + görev (SALDIR: çubuk düşmana yatık · SAVUN: size yatık · AL: ortada), dünyada etkin nokta işareti, ekran dışındaysa merkez çevresindeki elipste kenar oku (arkadaysa altta), skor kutuları iki takımın bileti (kanıyorsa ▼n), doğunca görev yazısı. Cephe kayınca bildirim ("{nokta} alındı! Cephe ilerliyor → sıradaki: …" / "… düştü · cephe geri çekiliyor"), bayrak bildirimleri bu modda susar.
- **Çevrim içi**: snapshot `"fr":[etkin sıra, cephe değişim sayısı, bitti, kilit sn]` + nokta sahipleri `o`; ilk snapshot bildirimsiz kurar (sonradan katılan), sonrakiler adım adım kaydırır. Debug `{ dbg, frs: sıra }` (BF_DEBUG) etkin noktayı oraya kaydırır (iki yön).
- **Botlar** (`frontBots.js`): takımın duruşu etkin noktaya göre (`front.stance`: çubuk kendine yatık 'def', düşmana 'atk', ortada 'even'). def: %45 (kolay %40 / zor %50, tehditte ×0,8) mevzi (`map.front.holds`: veri + yüzü düşmana bakan ateş basamakları + çit / taş duvar arkaları; etkin noktaya ≤ 34 m, düşman tarafına ≤ 8 m taşmaz, yönlü mevzi (ateş basamağı / makineli / kule) yalnız yüzü düşmana bakıyorsa) + guard (noktada, çubuğu iter). atk: hücum (kapak atlamalı) / kanat %20 (noktanın 22–28 m yanından ulaşılabilir ara nokta) / keskin nişancı yüksek yer. even: %20 mevzi, kalan hücum. Etkin noktadaki düşman hedefte öne. Doğuşta iki taraf da aynı donanım dili: taarruz sınıfının varsayılanı iki takımda yarı otomatik tüfek (simetrik mod; sürgülü seçenek), Mavi BAR / Kırmızı MG42, HMK'lar takım kimliğinde.
- **Bot donması düzeltildi** (`bot.js` `followGoal`, yalnız `g.front`): hedef kapalı hücredeyse (ev duvarı içi) ve en yakın boş hücre botun kendi hücresiyse tek noktalı yol hemen düşüyor, bot her adım yeniden yol isteyip adım başına 1'lik yol bütçesini yiyordu → sıradaki botlar aç kalıp maçın ortasında herkes donuyordu (18 maçta 1, 25 dk süre, öldürme 1/6'ya). Artık ulaşılamaz sayılıp yeni hedef seçilir; 24 maçta 0.
- **Denge** (`frontbots.mjs`, başsız, 12v12 normal, 1500 sn): çok hassas tek kaldıraç ORTA'daki Kırmızı doğuş penceresi (34–56 m → %25 Mavi, 36–58 → %50, 38–62 → %75); seçilen 36–58. Son ölçüm (bot donması düzeltmesinden sonra) 12v12 **19/32 Mavi (%59)**, düzeltmeden önceki 12 maç 6/6; 8v8 5/8, 16v16 2/4. Maç 12,1–14,1 dk ortalama (10,2–14,8), hepsi biletle (karargâh düşmedi), cephe değişimi maç başına ort. 4 (0–10; yol örn. 3→4→3→2→1→2, 3→4→5→4→3), takılma %0,2–0,3, botların siper duvarına girmesi 0 / 110 bin örnek. (Önceki ara denemeler: sabit saldıran / yatık çubuk ile 3↔2 sürekli el değiştirme; kilit olmadan ilk C yarışı maçı belirliyordu: aynı pencerede %100 / %0.)
- **Atmosfer** (`cephe.js` env + `frontFx.js`, oynanışı etkilemez): soğuk bulutlu gök (`#565c64` → ufuk = sis rengi), alçak soğuk güneş (`[-90,40,70]`, 0,95), sis **24 m'de başlar, 118 m'de tamamen kapanır** (önce 60–250: haritanın bir ucundan öbürü görünüyordu); ton ayarı soluk / soğuk (`grade` sat 0,8, vinyet 0,28). Botlar da sise uyar: `map.visMul` 0,85 (gündüz 130 → 110 m; weather.js / headless). Kuleden bakış hâlâ ~100 m (kör değil). `FrontFx`: yanan enkaz / duman sütunu kaynakları `map.front.fires` (iki tank enkazı, devrik kamyon, köydeki ev, çiftlik evi, arka hatlar) + harita dışı 7 sütun; tek örnekli yüz-kameraya kart katmanı (duman normal, alev toplamsal, kendi sis karışımı; katman başına 1 çizim), havada kül / toz (yuvarlak doku, kameranın çevresinde 36 × 14 m kutu, masaüstü 280 / telefon 110 tane, 1 çizim), ufukta top ateşi parlaması 2–6,5 sn'de bir (ara sıra çift) + ses hızı gecikmeli uzak gümbürtü, 14–32 sn'de bir kameradan 55–120 m, etkin noktadan ≥ 35 m, her askerden ≥ 25 m uzakta düşen top mermisi (parlama + toprak / duman fışkırması + konumlu `explosion`, hasarsız).
- **Görüş kırıcılar** (`cephe.js` §11b): çalı çitleri (bocage: 0,42 m toprak set çarpışmalı = görünen, üstüne basılır / yol bulma geçer; üstünde birbirine giren üç çalı çarpışmasız, `softCover` ile bot görüşünü keser, mermi geçer) — köy kuzeyi z −31, çiftlik / ana hat önü z −85, Mavi karargâhı arkası z 126 / 140; 8 yıkık taş duvar (`ruinWall`, her parça kendi kutusu), kanatlarda 5 ağaç sırası. Yerleşim süzgeci: siper kesiğine / kutulara / nokta merkezine değmez, altındaki arazi 0,3 m'den çok değişmez (havada / gömük parça yok). Harita 68,6 → 73,5 bin üçgen.
- **Siper duvarı hatası — kök neden** (`collision.js` + `cepheTerrain.js`): arazi duvarı (iki hücre arası kot farkı) yalnız gövde MERKEZİNDE denetleniyordu (`wallAt` + dik yamaç testi, bir nokta). Merkez duvar düzlemine kadar ilerliyor, gövdenin yarısı (R 0,32 m) ve kamera (yakın düzlem 0,05) duvarın içinde kalıyordu: arka yüz kırpıldığı için duvar kayboluyor, tarla / toprağın içi görünüyordu. Ölçüm (`frontwalls.mjs` OLD=1): 115 730 itme denemesinin **85 700'ünde gövde duvara girdi (0,30 m'ye kadar), 20 970'inde kamera duvarın içindeydi**; 268 doğuştan 13'ü duvar dibinde. **Düzeltme**: `FrontTerrain.pushOut(p, R, 0,55, eksen)` — kare ayak izi (yarı genişlik R) komşu hücreye taşıyor ve o hücrenin yüzeyi (merkeze en yakın noktada) ayak + 0,55'ten yüksekse hücre duvardır, ayak izi eksen boyunca hücre kenarına itilir (World.move her eksen adımında; düşüş / iniş sonrası iki eksende en kısa itme, sıkışma yok). Hücre kenarları eksen hizalı ve duvar ağı tam bu kenarlarda → görünen duvar = çarpışma. Basamak / rampa / tarla eğimi etkilenmez (0,55 eşiği), ateş basamağından zıplayıp çıkma aynı. **Sonra: 0 sızma, 0 kamera duvarda, 0 sıkışma** (yürü / koş / koş 15 fps / çömel / yüzüstü / zıpla + koş 60 ve 30 fps × 0°, ±35°, ±70°), doğuşların ayak izi duvara 0 / 464, botlar 0.
- Testler: `fronttest.mjs` yeniden (99 denetim: 7 aşamada doğuş tek bölge / ulaşılabilirlik / mevzi kotu / kutu içi / iki takım birbirini görmez / etkin noktadan görünen ≤ %20 / üs bölgesi / yürüme yolu dengesi; siper içi yürüme 171 parça, ateş basamağı, rampa, arka duvar, sınır sızıntısı 0; kural: başta yalnız ORTA ve kimsenin, kilitli nokta alınmaz, iki yönde kayma + doğuş kayması, kanama, iki karargâh kazancı, iki bilet, süre, donanım; çevrim içi iki istemci + debug ileri / geri), yeni `frontwalls.mjs` (duvar itme ızgarası), `frontstages.mjs` (aşama istatistiği), `fronthud.mjs` (arayüz kareleri + atmosfer açık / kapalı), `frontwallshot.mjs` (duvar önce / sonra karesi), `frontbots.mjs` yeni ölçütler (kazanma biçimi, cephe yolu, duvara giren, `W_silah__alan=` denemesi), `frontmobile.mjs` eski atmosfer karşılaştırması, `frontcam.mjs` `a-*` bakışları ve `SECTOR` = etkin sıra; eski kurala bağlı `frontquick.mjs` silindi. combattest, nettest, vite build OK. Tarayıcıda çevrim içi iki istemci aynı etkin noktayı / kilidi / bileti gördü, hata yok.
- Performans: masaüstü atmosfer kartları + kül ≈ +6–8 çizim, +1 bin üçgen; Pixel 7 profilinde (Mac GPU, 60 Hz kilitli) 16,6–16,7 ms / kare, 95. yüzdelik 17,7–18,4 ms (eski sis + atmosfer kapalı aynı bakışta 17,5), ölüm bölgesinde 854 çağrı (çoğu 24 asker + gölge, öncekiyle aynı).
- Görseller /tmp/wb-cephe2: `once/` ve `sonra/` aynı bakışlar (g-atis-basamagi siperden ileri, g-kule kuleden, k-tepeden kuşbakışı, g-olum-bolgesi, g-cukur-yol, y-koy, y-k1 …), `sonra-plan.png` (yeni cephe hattı planı: zincir, doğuşlar, mevzi havuzu, çitler), `sonra/a-*` (çalı çiti, yanan tank, köy dumanı, taş duvar, kuzey tarla), `sonra/hud-*` (doğuş, nokta, alırken, arkası dönük kenar oku, cephe kayması), `sonra/pixel7-*`, `sonra/cevrimici-B.png`, `once|sonra/duvar-dik.png` (duvar hatası), `frontwalls-once.txt`, `frontbots-*.txt`.
- Bilinen: kilise doğusundaki iskele merdiveni çevresinde (−16, −16) botlar ara sıra takılıyor (önceden de; toplam takılma %0,2); denge iki tepeli (C'yi ilk tutan taraf biletle öne geçer), kilit ve pencereyle %50–60'a çekildi; karargâh düşmesi bot maçlarında görülmedi (cephe çoğunlukla B–E arasında).

### 12.162 Nişan yakınlaştırması sınıf FPS'ler gibi: ACOG tam ekran ×2, resim-içinde-resim kaldırıldı
Kullanıcı (Uzay, ACOG, duvara yakın nişan): "zoom yapıyor ama normal FPS oyunlarındaki gibi bir zoom değil". Ölçüm `scripts/opticzoom.mjs` (gerçek GPU; bel / %50 / tam nişan; dünya FOV'u ve tam ekran büyütme, eski PiP'te mercek içi büyütme, mercek ekran çapı, halka kalınlığı, silahın ekran oranı; `SCENE=1` Yörünge Üssü'nde duvara 1,6 m + 30 m hedef; `Q=acog=B`).
- **Önce**: demir ×1,15, red dot / holo ×1,3 (telefonda ×1,3 / ×1,6), dürbün ×4 / ×6 zaten tam ekrandı. ACOG / SVD PSO-1 tek istisnaydı: dünya yalnız ×1,15 (`LENS_OUT`), ×3 yalnız mercekteki ikinci kamerada (PiP); `ADS_DIST.acog` 0,125 → mercek ekran yüksekliğinin %34'ü + %2,2'lik (20 px @900) kalın siyah halka. Duvara yakın / düz yüzeyde mercek içi ile dışı aynı görünüyor, ekranda ortada iri siyah daire kalıyordu. Hassasiyet ×3^0,8 ile ölçeklenirken görüntü ×1,15'ti (fare "ağır").
- **Yeni**: tüm optiklerde nişanda dünya kamerası TAM EKRAN yakınlaşır (aynı adsT eğrisi, 12.127 / 12.154 senkronu ve sıçrama korumaları aynen). ACOG / PSO-1 = **×2** (taslak A), göz 19 cm geride → mercek çapı ekranın **%22**'si, halka 1,1 mm (**%0,7**, 6 px), çevresinde dünya görünür. Mercek saydam cam: göz merceğindeki disk silah ağından önce yalnız derinliğe yazılır (renderOrder −1, colorWrite kapalı) → arkasındaki tüp / mercek çizilmez, dünya (zaten ×2) görünür; geçişte adsT 0,3 → 0,5 koyu camdan saydama açılır. Retikül red dot ile aynı: 3B ışıyan nokta (`ACOG_DOT` = 0,0049 × göz mesafesi, tam nişanda ≈ 0,62 vh), `ADS_HUD`'da HUD `#rdot` (telefonda nişangâh boyutu ayarıyla). Yan kapak / göz çanı / PSO göz kapağı inceldi (ince halkanın yanından taşmasın).
- **Taslaklar** (tek sabit: `stats.js` `ACOG_DRAFTS` / `ACOG_DRAFT`; oyunda `?acog=B`): **A** ×2, mercek %22 (varsayılan) · **B** ×2,5, mercek %27 (göz 15,5 cm). Görseller: `/tmp/wb-adszoom2/acog-sahne-{desk,mob}.png` (duvara yakın + uzak hedef, önce | A | B), `acog-AB-{desk,mob}.png`.
- Kaldırılanlar: PiP (renderPip, ikinci sahne çizimi + 512² MSAA hedef, gölgelendirici noktası), `LENS_OUT`, `camZoom`, telefon düşük FPS yedeği `lensHud` (tam ekran HUD dürbünü, `#scope .adot`) — gereksiz. Kazanç: ACOG nişanında kare başına ikinci dünya çizimi yok (12.128'de 1600×900'de ~1,7 ms GPU), Firefox'ta ACOG'un ilk nişanında derlenen PiP program varyantları yok (12.151: 508 ms'nin kaynağı). Ad "ACOG 3x" → "ACOG" (görüntü ×2).
- Değişmeyen: silah kamerası nişanda 54° → 40° (paintball 68°), demir / red dot / holo / dürbün büyütmeleri, keskin nişancı dürbün örtüsü + kararma (12.153), nefes tutma (12.156), artısız bel, hassasiyet = ayar / büyütme^0,8 (ACOG artık /2^0,8 = ×0,57; eski ×0,42).
- Ölçüm (önce → sonra, tam nişan, masaüstü = Pixel 7): ACOG dünya ×1,15 → ×2,00, mercek içi ×3 → ×2 (= dışı), mercek çapı %34 → %22,4 (SVD %33,4 → %22), halka %2,2 → %0,7, silah ekranın %7,7 → %7,6'sı (masaüstü) / %5,7 → %5,6 (telefon). Önce / sonra montaj: `/tmp/wb-adszoom2/oncesonra-{desk,mob}-{1,2}.png` (15 silah:nişangâh, bel / %50 / tam).
- Testler: adsalign masaüstü + Pixel 7 168/168 ≤ 2 px (ACOG: 3B nokta + mercek penceresi + HUD noktası 0,0–0,1 px; ölçüm yolu red dot gibi), adszoom 11/11 + 11/11 (yeni: tam nişanda dünya = nişangâh büyütmesi, ACOG / SVD / lazer ×2, HUD noktası ≥ 0,95'te), zoomtrace masaüstü FOV 70 / 100 466/466 + Pixel 7 FOV 110 233/233 (sıçrama yok), headless-sim OK, vite build OK.

### 12.163 Nişanda yakın nesne orantısız büyümesi (3. şahıs kamera yaklaşması) + ACOG ×1,5 (taslak C)
Kullanıcı (12.162 canlıdayken): "3x zoomu açtığımda yakını ekstra zoomluyor". Netleştirme: ikisi birden — (a) yakın duvar / düşman uzaktakine göre orantısız büyüyor, (b) toplam büyütme fazla, yakın dövüşte kullanılmıyor, CoD gibi ~×1,5 olsun.
- **Ölçüm** (`scripts/depthzoom.mjs`, yeni): dünya kamerasının önüne 1,5 / 5 / 15 / 40 m'de eş açısal boy kare işaretler; nişan basılı 40 kare gerçek oyun döngüsünde her karede kamera konumu (bel kamerası eksenlerinde mm), dönüşü, FOV'u ve her işaretin ekran boyu (analitik) + adsT 0 / 0,5 / 1'de ekran görüntüsünden renk alanı (piksel). FOV 70 / 90 / 110, masaüstü 1600×900 + Pixel 7, 1. ve 3. şahıs.
- **1. şahıs: hata yok** — kamera 0,0 mm kaymıyor, dönüş 0°, büyütme her derinlikte aynı (fark %0,00; piksel ≤ %0,5), son işlemede ölçek yok, FOV ayarı perspektifi bozmuyor (saf FOV daralması tüm derinliklerde eşit büyütür).
- **Kök neden — 3. şahıs (omuz üstü) kamera nişanda ileri kayıyordu**: `thirdCamera` `adsK = 1 − adsT·0,45` → kamera 2,5 m'den 1,375 m'ye (1125 mm ileri) gelip omuzdan %30 içeri kayıyordu; 12.162'den beri ACOG ×2 FOV büyütmesiyle üst üste binince oyuncudan 1,5 m'deki duvar **×2,79**, 5 m ×2,35, 15 m ×2,14, 40 m'deki hedef ×2,05 (fark **%36**; red dot ×1,81 ↔ ×1,34, demir ×1,60 ↔ ×1,18; her FOV, masaüstü = telefon). ACOG dürbün gibi 1. şahsa geçmediği için (yalnız 'scope' geçer) en çok onda görünüyordu.
- **Düzeltme**: nişanda 3. şahıs kamera yerinde kalır (yaklaşma ve omuz kayması kaldırıldı), yalnız FOV daralır → tüm derinliklerde eşit (%0,00, kamera kayması 0 mm). Duvar çarpışmasıyla yaklaşma, dürbünde 1. şahsa geçiş aynen.
- **ACOG taslak C ×1,5 (varsayılan)**: `stats.js` `ACOG_DRAFTS` = A ×2 (göz 19 cm) · B ×2,5 (15,5 cm) · **C ×1,5, göz 23,5 cm** → mercek ekranın **%18**'i (A'da %22; çevrede daha çok dünya), halka %0,6–0,8; `?acog=A|B|C`. Dokunmatikte ACOG kendi değeriyle **×1,85** (`touchZoom`; eski genel kural 1 + (z − 1)·2 ×1,5'i ×2'ye çıkarıp red dot ×1,6'ya yaklaştırırdı); red dot / holo masaüstü ×1,3 / telefon ×1,6 aynen. SVD PSO-1 ve uzay / cephe ACOG'lu silahlar (laser, elmg) aynı sabitten. Hassasiyet = ayar / büyütme^0,8 (ACOG ×0,72; A'da ×0,57). Menü adı "ACOG"; nişangâh tekerleğinde gösterilen büyütme dokunmatikte gerçek değer.
- Silah kamerası nişanda 54° → 40° (silah ×1,40) ile dünya ×1,5 artık hemen hemen orantılı (×2'de silah dünyadan geride kalıyordu).
- Ölçüm (önce → sonra): depthzoom 1. şahıs masaüstü 15/15 + telefon 15/15 (önce de %0,00), 3. şahıs masaüstü 0/12 → 12/12, telefon 0/12 → 12/12 (%35,6 → %0,00, 1125 → 0 mm). Kullanıcı sahnesi (Çöl Geçidi, sağda 1,3 m duvar, düşman 3 m + 30 m, `scripts/acogscene.mjs`): 1. şahıs 3 m düşman 265 → 530 px (A) / 398 px (C), 30 m 27 → 54 / 40 px (oran sabit 9,84); 3. şahıs önce oran 5,84 → 7,08 (yakın düşman ×2,51, uzak ×2,07), sonra 5,84 → 5,85. Görseller: `/tmp/wb-acog3/acog-sahne-{desk,mob,3sahis}.png` (bel → nişan 0 / 25 / 50 / 75 / 100 %, önce | sonra), ölçüm dökümleri `/tmp/wb-acog3/{once,sonra}-{desk,mob}-{1,3}.txt|json`.
- Testler: adsalign masaüstü + Pixel 7 84/84 + 84/84 ≤ 2 px (ACOG 0,0–0,1 px), adszoom 11/11 + 11/11 (yeni denetim: ACOG masaüstü ×1,5, telefon ×1,85), zoomtrace masaüstü FOV 70 / 90 / 110 699/699 + Pixel 7 FOV 110 233/233 (sıçrama yok), opticzoom (mercek %18,1, SVD %17,8), headless-sim OK, vite build OK.
- Test: `node scripts/depthzoom.mjs [url]` (`DEV=desk|mob`, `THIRD=1`, `FOV=70,90,110`, `ONLY=`, `Q=acog=A`, `PX=0`, `POST=1`, `V=1` kare kare); `node scripts/acogscene.mjs <klasör> [url]` (`Q=acog=A`, `TAG=`, `THIRD=1`, `DEV=mob`).
