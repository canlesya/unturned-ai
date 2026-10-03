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
- Her 5 sn'de bayrağı fazla olan takım, rakibin biletini farkı kadar eritir. Her ölüm de 1 bilet.
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
