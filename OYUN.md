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
