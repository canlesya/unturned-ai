# WarByte testleri (12.231)

Kısa yol: **değişiklikten sonra yalnız `node scripts/qa.mjs --changed` + kendi yeni testin.** Tam koşu (`--all`) gece / büyük canlıya alma öncesi.

```bash
node scripts/qa.mjs --smoke              # ≈ 25 sn: başsız duman (her harita × modu) + tarayıcı duman + çekirdek savaş / ağ / mod testleri
node scripts/qa.mjs --changed            # git diff (online ile ortak atadan + kaydedilmemiş) → scripts/qa-map.json eşlemesi
node scripts/qa.mjs --changed A..B       # belirli aralık (ör. birleştirme sonrası ana oturum)
node scripts/qa.mjs --changed --list     # koşmadan: ne seçildi, neden, tahmini süre
node scripts/qa.mjs --area bomba,ag      # alan grupları (qa-map "areas")
node scripts/qa.mjs --only uykutest      # tek test, port / sunucu ayarını qa yapar
node scripts/qa.mjs --all                # kayıtlı 121 regresyon testi (manual hariç)
#   --full: testlerin "fast" ayarını kapat (ör. bombatest'in tarayıcıda 3 bot rauntu) · --jobs 4 · --web-jobs 2 · --srv-jobs 3 · --shared · --keep · --vite P --port P
# qa dışında tek betik (pencere açmadan):  node --import ./scripts/lib/pw-quiet.mjs scripts/uykutest.mjs
#   ya da oturum boyu:  export NODE_OPTIONS="--import=$PWD/scripts/lib/pw-quiet.mjs"
```

### Pencere açılmaz (başsız + gerçek GPU)

`scripts/lib/pw-quiet.mjs` (qa tarayıcı testlerine kendisi ekler) her `chromium.launch` / `launchPersistentContext`'i **başsız** açar — ~104 betikte `headless: false` yazsa da pencere öne fırlamaz. `HEADFUL=1` → betiğin kendi ayarı. Ölçüm (M4 Pro): başsız kabuk bayraksız = **SwiftShader** (yazılım GPU, oyun düşük kaliteye iner); başsız kabuk + `--use-angle=metal` = **"ANGLE Metal Renderer: Apple M4 Pro", 60 fps** (pw-quiet bunu ekler; yeni başsız `channel:'chromium'` de Metal ama 31 fps). Ayrıca `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` ve dil **tr-TR** (başsız kabuk en-US açıyordu → oyun İngilizce, Türkçe metin denetimleri düşüyordu). Betik SwiftShader istiyorsa (`SOFT=1`) GPU bayrağı eklenmez.

**HEADFUL-only** (qa-map `headful`; `HEADFUL=1` yoksa qa atlar, varsa pencere `--window-position=-3000,-3000` ile ekran dışında): `esctest-lock` (gerçek fare kilidi; başsız sürüm `esctest` `HEADED=0` ile 2. bölümü koşar), `framestat` (gerçek ekran kare zamanlaması). Kayıtsız: `keylocktest` (fare kilidi taklidi; başsız çalışabilir, denenmedi), sinema kaydı (`cinerec`, `cinewar` — gerçek zamanlı ekran kaydı), Firefox / WebKit karşılaştırmaları (`ffperf`, `ffprobe`, `ffshots`, `swapperf`: pw-quiet yalnız Chromium'u yamalar). Başsız doğrulanan: combattest, nettest, cgmodes (zaten tarayıcısız), bombatest, bombathrow, uykutest, smokeweb + vehspawncam, captest, matchflow, leantest, mototest, editortest / editorsection / editorload / editorrevert, vehaim, swimtest, spacetest, sighttest, sprintads, touchedit, esctest (`HEADED=0`), kasabaonline, deponet, cgnet, limanonline. Başsızda da pencereliyle aynı nedenle düşen (eski, `known`): igstest, invitelink, chatui, grenadeweb, menuflow.

- **Portlar**: çalışma klasörünün (worktree) yolundan türetilir (vite 5300–5699, sunucu 9100–9499) → alt ajanlar çakışmaz. Açıksa kullanılır, değilse qa başlatır (`BF_DEBUG=1`, `BF_DATA=/tmp/wb-qa/data-<port>`) ve bitince kapatır. `node_modules` yoksa ana depodakine bağ kurar.
- **Paralel**: başsız testler `--jobs` (vars. CPU/2, en çok 6), tarayıcı testleri `--web-jobs` (vars. 2) aynı anda. **Her sunucu testi kendi taze sunucusunu** alır (`BF_DEBUG=1 BF_WARM=0 BF_SPARE=0`, ~1 sn'de hazır; aynı anda en çok `--srv-jobs` 3): ortak sunucuda paralel koşunca zamanlamaya duyarlı nettest / netdmg / shotlag düşüyordu. `--shared` eski davranış (tek sunucu).
- **Çıktı**: her testin kaydı `/tmp/wb-qa/<port>/<test>.log`; sonda süre tablosu ve tek satır `QA: OK · 18/18 test · 34 sn …` / `QA: HATA … (düşen: …)`. **Bilinen** eski düşüşler (`known`) koşuyu düşürmez, ayrıca yazılır; `retry` ara sıra düşeni yeniden dener; çıkış kodu 0 olsa da satır başında `HATA` basan test düşmüş sayılır.
- **Yeni test yazınca** `scripts/qa-map.json`'a ekle: `"tests"` içine `{ tier, sec, needs, fast?, known?, retry?, headful? }`, `"map"` içine `[glob, [test]]`.

## Katmanlar

| katman | ne zaman | içerik | süre (Mac, ölçülen) |
|---|---|---|---|
| **smoke** | her değişiklik, her birleştirme | `smoke` (15 harita × modu + uyku / bomba, başsız 20 sn maç) · `smokeweb` (tarayıcı: Çöl Geçidi TDM ateş + Kum Köyü Bomba + çevrim içi Depo) · combattest · cgmodes · nettest · mapmodes · fire / gadget / grenade / melee / dm / gg / inf / pb / pl / third / penetrate / protfire | **25 sn** (18 test, seri 77–111 sn) |
| **changed** | alt ajan işi bitince, ana oturum birleştirince | smoke çekirdeği (smoke, smokeweb, combattest, cgmodes) + değişen dosyaların eşlendiği alan testleri (`fast` ayarıyla) | bomba birleştirmesi 042f6c2 (18 dosya → 25 test): **173 sn**, seri 458 sn |
| **area** | elle, `--area` | qa-map `areas` | — |
| **full** | gece / büyük canlıya alma | `--all` (+ `--full`) | ≈ 75 dk seri, ≈ 35 dk paralel (tahmin, `sec` toplamından; accountui 11 dk, autoreload 10 dk dahil) |
| **manual** | ölçüm, görüntü | kayıtsız ~340 betik + `framestat` | — |

## Envanter (2026-11-05, `online` 042f6c2)

`scripts/` içinde **457 betik** (`.mjs` 444 + `probes/` 11 + `.sh` / `.cjs` 2) ve ~40 Python görüntü / tablo betiği. 247'si tarayıcı (Playwright, çoğu `headless:false` + Metal), 37'si yalnız WebSocket (sunucu), 173'ü yalnız Node (başsız `Game`). Geçti / kaldı denetimi olan (`check` / `HATA`) **~195**; kalan ~262 ekran görüntüsü / ölçüm / tek seferlik sonda. 441'i Ekim'de eklendi (günde en çok: 27 Eki 101, 28 Eki 73, 24 Eki 67, 18 Eki 60, 4 Eki 59) — her iş kendi testini yazıp bıraktı. `qa-map.json`'da **121 kayıtlı** regresyon testi var.

### Ölçülen süreler (yerel vite + `BF_DEBUG=1` sunucu, aynı anda başka ajanlar da çalışırken)

| test | tür | süre | not |
|---|---|---|---|
| bombatest | tarayıcı | **290 sn** | 3 gerçek zamanlı bot rauntu ≈ 173 sn (%60); `PARTS` botsuz **117 sn** (qa `fast`) |
| netdmg | sunucu | **188 sn** | 8 silah × 2 mesafe × 6 atış × 1,7 sn sabit bekleme; qa `fast` (2 silah) ≈ 45 sn |
| uykutest | tarayıcı | **138 sn** | 88 denetim |
| ggnet | sunucu | 62 sn | 61,5 sn'si sabit bekleme |
| vehspawncam | tarayıcı | **183 sn** | çevrimdışı + çevrim içi × 4 araç; qa `fast` (jip, tank) |
| netsync | sunucu | 38 sn | |
| netfuzz | sunucu | 13 sn | |
| vehspawnsink | başsız | 48 sn | Kuzey bütün araç doğuşları |
| bombathrow | tarayıcı | 47 sn | 38 denetim |
| nettest | sunucu | 22 sn | ~13 sn sabit bekleme |
| interesttest | sunucu | 20 sn | 128v128 oda |
| infnet | sunucu | 19 sn | |
| vehground | başsız | 12 sn | |
| passthru (probe) | başsız | 10 sn | 4 HATA (eski sonda) |
| mapmodes | başsız | 8 sn | bütün haritalar × modlar |
| ffanet / limannet / chattest | sunucu | 5–7 sn | |
| kuzeytest / capflags / spawnapi / vadibots / kasabatest / pltest / dmtest / ffaspawn | başsız | 3–5 sn | |
| combattest, cgmodes ve diğer ~30 başsız test | başsız | **0,1–2,5 sn** | |
| smoke (başsız, 19 durum) | başsız | 6 sn | |
| smokeweb (3 sekme paralel) | tarayıcı | 3 sn | sayfa → oyun koşuyor: **1,4–1,5 sn** (sıcak vite) |

Kod okumasından (sabit `waitForTimeout` / `wait()` toplamı) en yavaşlar: kztdmshot 185 sn, vehicletest 108 sn (+ 4 tarayıcı, 6 sayfa), ggnet 62, botvehtest 45, squadmap 38, interacttest 33, vehabandshot 33, bombathrow 31, uykutest 30 (+ koşullu beklemeler), infnetcure 27, vehswapseat 27, vehaimnet 27.

### Bilinen eski düşüşler (`known`; düzeltilene dek koşuyu düşürmez)

| test | neden |
|---|---|
| bindtest | 12.193'te G = hızlı el bombası oldu, test hâlâ G = ekipman bekliyor |
| cglinks | Xbox ↔ Short oranı 2,56 (CLAUDE.md'deki bilinen şüpheli) |
| depotest / limantest | bot takılma eşiği aşılıyor |
| kuzeytest | 6 doğuş noktası "boş / yürünür / alan içi" denetiminden düşüyor |
| officialmigrate | OFC12 (uyku) eklenince beklenen mod listesi eskidi |
| igstest | "gölgeler kapandı" + "tercihlere kaydedildi" (pencereli ve başsız aynı) |
| invitelink | OFC1'i "Çöl Geçidi / ölüm maçı / botsuz" bekliyor; resmi varsayılanlar değişti |
| chatui | B, A'nın mesajını 20 sn'de görmüyor (betik 10-04'ten) |
| grenadeweb | G bırakınca bomba uçuyor ama kalan sayı 3 (2 bekleniyor) |
| menuflow | menü özeti değişti ("Ele Geçirme · Kasaba" bekliyor) |
| adminrooms | `data/admin-password.txt` bekliyor (kayıtsız) |

Ara sıra düşen (`retry`): thirdtest (sırayla 8'de 3), grenadetest (8'de 1), gadgettest (12 kopya aynı anda: 12'de 3), netfuzz (yük altında 800 ms bekleme).
| probes/mapcheck, probes/passthru | eski sondalar (44 / 4 HATA), kayıtsız |

### Kayıtsız betikler (alan başına; ¹ = tarayıcısız)

Bunlar geçti / kaldı regresyonu değil, çoğu bir işin görüntü / ölçüm betiği. Gerekince elle: `node scripts/<ad>.mjs` (port: `URL=… WS=…` ya da `BASE=…`; bazıları argüman alır — betiğin ilk yorum satırına bak).

**Bomba** (3; kayıtlı 2): bombasim¹

**Uyku / Kum Köyü** (6; kayıtlı 2): koymatch, koyshots, koythumb, uydbg¹

**Araç / motor / yuva** (38; kayıtlı 16): botvehshot, heliroket, motoshots, netveh, tankaimview, tankmc¹, towershots, towerspots¹, vehaband¹, vehabandshot, vehatshot, vehaudit¹, vehdrive, vehdrive-hl¹, vehdriveshot, vehgroundshot, vehhudshots, vehlodshot, vehperf¹, vehscaleplan¹, vehscaleshot, vehspawnview

**Sinema** (10; kayıtlı 0): cine2at¹, cine2test¹, cinedbg¹, cinelib, cinelive, cinemusic, cineprobe¹, cinerec¹, cinescenes¹, cinesync¹

**Başarım (perf)** (30; kayıtlı 3 — 12.232 `pacetest`: kare temposu, başsız ~24 sn; 12.234 `menuperf`: menü beklemeleri + arka plan temposu, başsız ~57 sn, `scripts/lib/pacesim.mjs` 60 / 120 / 144 / 240 Hz benzetimi): hitchprobe (takılma avı: `UNCAP=1` / `GLT=1` / `DETAIL=1`), pacedesk¹ (masaüstü süreç CPU'su + kare aralığı; `FPS=` / `MIN=1` / `OLD=1`), cgperf, ffperf, ffperf-ctx¹, ffperf-hist¹, ffprobe, ffshots, kuzeyperf, lodshots, newgamecost¹, perfgrow¹, raycmp¹, renderinfo, roomperf¹, s3perf, scalebench¹, scalemenu, scaleperf, scalesim¹, serverprof¹, snapsize¹, softgl, swapcheck, swapperf, swapsuite¹, swapwork¹, usperf, vadiperf

**Ağ / sunucu / hesap** (74; kayıtlı 37): abilityfxnet, accounttest¹, adminrooms¹, adminvote, farshotnet, flashnet, infnet2, infnetcure, infnetshot, interestview, liveprobe¹, meleenet, modebal¹, modebalnet, modebalshots, modtest¹, modui, netanim, netbullet, netcam, netlag, netload¹, netproxy¹, netsmooth, netstall¹, netthird, pbballnet, penetratenet, plonline, pubgopticnet, railnet, reloadnet, roomiso¹, roomsim¹, shotsoak¹, workerevents¹, ww2opticnet

**Silah / nişan / el** (56; kayıtlı 11): acogscene, acogshots, adsalign, adsaudit¹, adsshots, adsview¹, adszoom, ammoheal, armclip¹, bleedshot, breathshots, crosshair, depthzoom, dmgshot, farlos, farshot, fphands, fphands2, gripfit¹, handlab4shots, meleefp, meleetouch, meleezf, opticaudit, opticzoom, penetrateshots, pistolfeel, protshot, pubgmenu, pubgmobile, pubgoptics, reload3p¹, reloadfp¹, reloadseat¹, reloadstrip, s3fix, s3shots, s3smgshots, sniperhip¹, snipershots, weapondraws¹, weaponlabshots, ww2opticmenu, ww2optics, zoomtrace

**Harita** (145; kayıtlı 20): capshots, capworld, cg_plan, cgaudit, cgbefore, cgclimb¹, cgdist, cgdoors, cghud, cgjump, cgkills¹, cgleak¹, cglos¹, cgmesh, cgnear¹, cgpath¹, cgplan_dump¹, cgplan_plot, cgplot_dump¹, cgqa¹, cgshot, cgshots, cgsight¹, cgsim¹, cgsink¹, cgsky¹, cgsky2¹, cgsweep, cgthumb, cgtour, cgview, cgwalk, deposhots, fallbots¹, fallmaps¹, frontbots¹, frontbotshot, frontcam, frontfp, fronthud, frontmenu, frontmobile, frontplan¹, frontstages¹, frontwalls¹, frontwallshot, kasababots¹, kasabacam¹, kasabafurn¹, kasabageo¹, kasabapick¹, kasabaplan¹, kasabaqa¹, kasabashots, kasabatris¹, kasabaup¹, kasabaviews¹, kuzeybuild¹, kuzeycam, kuzeydens¹, kuzeyfight¹, kuzeyflag¹, kuzeyhouse¹, kuzeyhud, kuzeylab, kuzeymenu, kuzeyplan¹, kuzeyprobe, kuzeyqa¹, kuzeyqa2¹, kuzeytempo¹, kztdmdiag¹, kztdmshot, limanprobe¹, limanshots, mapaudit¹, mapaudit-us¹, mapfloat¹, mapgeo¹, mapobj¹, mapoverlap¹, mapqa¹, mapshot, mapveh¹, mapvis¹, mapzfight¹, newyorkbots, newyorkshots, newyorkthumb, ny2shots, nyshots, ormankaleshots, pbmapshots, plmap¹, probes/bmflow¹, probes/climb¹, probes/flood¹, probes/losdiagram¹, probes/mapcheck¹, probes/mapclimb¹, probes/nav3d¹, probes/passthru¹, probes/reach¹, probes/sim¹, probes/walls¹, spacecam, spacefight, spacefp, spaceplan¹, spacesheets, spacesuits, sunsetshot, swimshot, usplay, usqa¹, usshots, usviews, vadileak¹, vadiplan¹, vadirocks¹, vadiscan¹, vadishots, vadismoke¹, vadistuck¹, vadithumb

**Mod (inf / pb / pl / gg / dm / ffa / manga)** (44; kayıtlı 9): abilityfx, botduel¹, defshots, defsim¹, ffaleader, ffashots, ggshots, infbalance¹, infbotcheck¹, infduel¹, infhands, infmatrix¹, infshots, infstart¹, infstats¹, inftypes, pb2shots, pbball, pbscreen, pbshots, play, playerat, plbots¹, plbotshots, plcam, plfights¹, plmenu, plquick¹, plshots, streaktest, streakwav, tdmtest, ttktable¹, wduel¹, wmatch¹

**Menü / HUD / girdi / görünüm** (39; kayıtlı 9): aimassist, assisttest, botacc¹, botdeterm¹, botkhist, botkills¹, botkshot, botstats¹, botstats-table¹, bottrace¹, charsheets, devfly, devmenu, gfxshots, hudshots, keylocktest, keytest, menubuilder, menuhitch, menushot, menushots, mobileability, mobileoptics, screenshot, sfxdrafts, sfxtest, skintest, spawnkeytest, wearshots, weartest

**Diğer** (14; kayıtlı 9): build-single¹, cephelab, nestdump¹, rpgbefore, tickettest

## Neden yavaştı (12.231 ölçümü)

- **Testin kendisi değil, ajan döngüsü**: 28 Eki – 5 Kas arası 71 alt ajan, ortalama **69 dk / 164 araç çağrısı**. Ön planda test komutu **%29**, model (düşünme + kod / test yazma) **%54**, diğer kabuk (grep, curl, `node -e` sondaları) %14, kurulum (vite / sunucu / npm) %1, build %0, görüntü inceleme %1. Ajanların yazdığı kodun **%55'i test betiği** (2,19 M karakter test, 1,76 M kaynak) + 2,05 M karakter geçici sonda.
- **Ana oturum** birleştirmeden sonra testleri yeniden koştu: 1–5 Kas arası 8 iş için 41 dk ön plan test (uykutest tek başına 23,5 dk) — kullanıcı bu sırada bekliyor.
- **Gerçek zamanlı oyun**: tarayıcıda bot maçı / raunt bekleyen bölümler (bombatest botlar 173 sn). Aynı davranış başsız `headless-sim` ile **1 sn**'de 600 sn oyun (9 raunt) oynuyor.
- **Sabit beklemeler**: `wait(700)` + `wait(500)` + `wait(500)` her atışta (netdmg 188 sn), ggnet 61 sn uyku.
- **Sayfa yükü değil**: sıcak vite'ta Çöl Geçidi sayfası → oyun koşuyor 1,5 sn; başsız harita kurulumu 0,0–2,0 sn (Kuzey 2 sn).
- **Ortak yardımcı yok**: her tarayıcı testi kendi `launch / offPage / check / until / HELP`'ini 30–60 satırla yeniden yazıyor; port ortam değişkenleri tutarsız (`URL` / `BASE` / `SERVER` / `SRV` / `WSURL` / argüman; 121 betikte 5180, 51'inde 8787 sabit).
- **Ajanlar sunucu bırakıyor**: Mac'te 18 güne varan 27 artık vite / sunucu süreci vardı (port çakışması; qa kendi açtığını kapatır).
- **Pencereli tarayıcı**: ~104 betik `headless:false` (gerçek GPU için) → her koşuda pencere öne fırlıyor, iki test üst üste açılınca alttaki kısılıyor. Başsız kabuk + Metal aynı GPU'yu pencere açmadan veriyor (`scripts/lib/pw-quiet.mjs`).
- **Depoya çöp**: editortest / igstest / chatui / cgnet / esctest / touchedit ekran görüntülerini `screenshots/` altına yazıyor — izlenen PNG'leri bile değiştiriyor (her koşudan sonra `git status` kirleniyor; ajan bunları yanlışlıkla commit edebilir).
- **qa'da bulunan tuzaklar**: ortak sunucuda paralel sunucu testleri; her taze sunucunun 15 haritayı kurması (5–21 sn) ve 12 resmi oda; yük altında 300 sn bekleyen çevrim içi bölümler — hepsi qa'da çözüldü (test başına sunucu, `BF_WARM=0`, örtülü pencere kısıtlaması kapalı).
