// "Kuzey Vadisi" (12.172) — yerleşim VERİSİ (three.js yok; sunucu, araçlar, planlama betikleri ortak okur).
// Ölçek: 1 birim = 1 m. Oynanır alan 1600 × 1600 m (x −800..800, z −800..800). Mavi güneyde (+z), Kırmızı kuzeyde (−z).
// 12.182: ortadaki nehir KALKTI (kullanıcı: "ortadaki uzun göl olmasın") — vadi tabanı kesintisiz çayır / tarla; yalnız doğu kenarda
// barajın gölü kalır (barajın mansabı kuru dolusavak kanalı). Bayraklar 180° dönel simetriye yakın: F↔G, B↔D, A↔E, C orta (Kavşak).

export const KZ_BOUNDS = { minX: -800, maxX: 800, minZ: -800, maxZ: 800 };
export const KZ_CELL = 2;                                 // arazi / fizik ızgarası (m)
export const KZ_LAKE = 20;                                // baraj gölü yüzeyi (kıyısı dik kanyon; yüzülür, baraj merdiveninden çıkılır)
export const KZ_DEEP = -0.6;                              // bunun altındaki zemin (göl tabanı) bot yol bulmasında kapalı

// Vadi ekseni (doğudan batıya) + yarı genişlik (m): eski nehrin yatağı — artık SU YOK; arazide vadi tabanı / kanyon / uzak manzaradaki vadi
// bu eksenden ölçülür (12.182). Harita dışında da sürer (uzak manzarada vadi açılır).
export const VALLEY = [
  [700, -60, 15], [650, -48, 17], [580, -25, 18], [500, -28, 19], [420, -55, 19], [340, -78, 20], [260, -72, 20], [180, -45, 20],
  [100, -15, 20], [20, 6, 19], [-60, 22, 20], [-150, 42, 21], [-240, 40, 22], [-330, 14, 22], [-410, -18, 22], [-490, -36, 23],
  [-580, -30, 24], [-670, -8, 25], [-760, 12, 26], [-900, 30, 28], [-1200, 20, 34], [-1700, -60, 44], [-2600, -120, 60],
];
// Baraj gölü (barajın doğusu): eksen + yarı genişlik; dik kanyonun içinde genişleyerek dağlara uzanır
export const LAKE = [[705, -60, 34], [800, -70, 60], [950, -40, 120], [1200, -10, 220], [1600, -60, 330], [2200, -140, 420]];

// Yollar: tür hw (asfalt, 9 m) · rd (asfalt, 6,5 m) · dirt (toprak, 4,5 m). 12.182: köprü / sığ geçit yok — yollar vadi tabanında kesintisiz.
export const ROAD_W = { hw: 9, rd: 6.5, dirt: 4.5, lane: 3.0 };      // lane: köyün kaldırım taşı sokakları (tank / kamyon giremez)
export const ROADS = [
  { id: 'R1', t: 'hw', name: 'Vadi Yolu (güney)', pts: [[120, 640], [130, 560], [110, 460], [60, 330], [20, 200], [4, 110], [0, 60], [0, 9]] },
  { id: 'R1n', t: 'hw', name: 'Vadi Yolu (kuzey)', pts: [[0, 9], [0, -40], [30, -110], [110, -170], [190, -240], [250, -300]] },
  { id: 'R2', t: 'hw', name: 'Fabrika Yolu', pts: [[250, -300], [200, -400], [100, -500], [-40, -590], [-110, -640]] },
  { id: 'R3', t: 'rd', name: 'Çiftlik Yolu', pts: [[130, 560], [230, 520], [330, 470], [400, 420]] },
  { id: 'R4', t: 'rd', name: 'Köy Yolu', pts: [[110, 460], [0, 420], [-110, 360], [-190, 300], [-230, 250]] },
  { id: 'R5', t: 'rd', name: 'Kavşak Yolu', pts: [[-230, 250], [-180, 180], [-100, 110], [-30, 70], [0, 60]] },
  { id: 'R6', t: 'rd', name: 'Radar Yolu', pts: [[-230, 250], [-330, 240], [-430, 210], [-500, 190], [-600, 200], [-660, 150], [-640, 80], [-580, 60], [-540, 92], [-551, 100]] },
  { id: 'R7', t: 'rd', name: 'Değirmen Yolu', pts: [[-500, 190], [-480, 100], [-472, 40], [-470, 8], [-470, -31]] },
  { id: 'R7n', t: 'rd', name: 'Orman Yolu', pts: [[-470, -31], [-470, -70], [-462, -150], [-432, -260], [-402, -360], [-380, -450]] },
  { id: 'R8', t: 'rd', name: 'Kamp Yolu', pts: [[-380, -450], [-300, -540], [-200, -620], [-120, -660]] },
  { id: 'R9', t: 'rd', name: 'Baraj Yolu (güney)', pts: [[400, 420], [500, 330], [600, 220], [664, 110], [690, 34], [690, -60]] },
  { id: 'R10', t: 'rd', name: 'Baraj Yolu (kuzey)', pts: [[690, -60], [690, -150], [640, -214], [540, -270], [420, -300], [250, -300]] },
  { id: 'R11', t: 'dirt', name: 'Doğu Geçidi', pts: [[400, 420], [382, 300], [352, 150], [336, 20], [330, -76], [320, -160], [290, -240]] },
  { id: 'R12', t: 'dirt', name: 'Batı Geçidi', pts: [[-230, 250], [-216, 150], [-205, 41], [-228, -80], [-296, -220], [-350, -380], [-380, -450]] },
  { id: 'R13', t: 'rd', name: 'Kuzey Yolu', pts: [[-110, -640], [-80, -500], [-40, -330], [-12, -180], [0, -40]] },
  // köy sokakları (B)
  { id: 'K1', t: 'lane', name: 'Güney Sokağı', pts: [[-318, 252], [-300, 274], [-278, 292], [-250, 306], [-222, 307], [-196, 297], [-176, 286]] },
  { id: 'K2', t: 'lane', name: 'Çeşme Sokağı', pts: [[-231, 262], [-235, 284], [-238, 306]] },
  { id: 'K3', t: 'lane', name: 'Değirmen Sokağı', pts: [[-262, 241], [-282, 224], [-302, 206], [-326, 198]] },
  { id: 'K4', t: 'lane', name: 'Kilise Arkası', pts: [[-262, 222], [-250, 198], [-226, 186], [-204, 194]] },
  { id: 'K5', t: 'lane', name: 'Bahçeler', pts: [[-206, 262], [-186, 270], [-164, 284], [-150, 302]] },
  { id: 'K6', t: 'lane', name: 'Sırt Sokağı', pts: [[-326, 198], [-336, 226], [-330, 252], [-318, 252]] },
];
export const DAM = { x: 700, z: -60, crest: 24, len: 168, thick: 9, w: 7.5 };   // baraj gövdesi: x'te kalın, z boyunca uzun; tepesi yol (araç geçer)

// Düzleştirilen alanlar (rect: merkez + w × d; circ: r). y 'auto' = merkezdeki doğal kot. k: düzleştirme gücü (1 tam).
export const PADS = [
  { id: 'BHQ', x: 120, z: 700, w: 230, d: 150, fall: 45, k: 1, y: 34 },
  { id: 'RHQ', x: -120, z: -700, w: 230, d: 150, fall: 45, k: 1, y: 34 },
  { id: 'B', x: -230, z: 250, w: 240, d: 210, fall: 60, k: 0.86 },
  { id: 'D', x: 250, z: -300, w: 250, d: 180, fall: 50, k: 1 },
  { id: 'F', x: 400, z: 420, w: 150, d: 120, fall: 50, k: 0.92 },
  { id: 'G', x: -380, z: -450, w: 140, d: 110, fall: 40, k: 0.88 },
  { id: 'A', x: -560, z: 120, r: 46, fall: 30, k: 1 },
  { id: 'C', x: 0, z: 9, w: 150, d: 150, fall: 45, k: 0.82 },                       // 12.182 Kavşak mezrası (eski Taş Köprü köprü başları)
  { id: 'W', x: -470, z: -25, w: 70, d: 60, fall: 30, k: 0.7 },                     // Değirmen mezrası (eski Demir Köprü)
  { id: 'Es', x: 640, z: 30, w: 70, d: 50, fall: 24, k: 0.9 },
];

// Ele Geçirme bayrakları (dizi sırası = HUD sırası). core: az oyunculu maçta kullanılan 3 bayrak. r = ele geçirme yarıçapı.
export const FLAGS = [
  { id: 'A', name: 'Radar Tepesi', x: -560, z: 120, r: 22 },
  { id: 'B', name: 'Köy', x: -230, z: 250, r: 24, core: true },
  { id: 'C', name: 'Kavşak', x: 0, z: 9, r: 26, core: true },
  { id: 'D', name: 'Fabrika', x: 250, z: -300, r: 26, core: true },
  { id: 'E', name: 'Baraj', x: 700, z: -60, r: 24 },
  { id: 'F', name: 'Çiftlik', x: 400, z: 420, r: 24 },
  { id: 'G', name: 'Kereste Kampı', x: -380, z: -450, r: 24 },
];
export const HQ = { blue: { x: 120, z: 700, ry: Math.PI }, red: { x: -120, z: -700, ry: 0 } };   // ry: doğuşta bakış (Mavi kuzeye, Kırmızı güneye)

// Helikopter pistleri / iniş alanları (veri; araçlar ileride). r = işaret yarıçapı.
export const HELIPADS = [
  { id: 'BH1', team: 'blue', x: 60, z: 735, r: 10 }, { id: 'BH2', team: 'blue', x: 180, z: 735, r: 10 },
  { id: 'RH1', team: 'red', x: -60, z: -735, r: 10 }, { id: 'RH2', team: 'red', x: -180, z: -735, r: 10 },
  { id: 'AH', team: null, x: -598, z: 132, r: 9 },       // Radar Tepesi: tarafsız iniş alanı
  { id: 'DH', team: null, x: 346, z: -334, r: 9 },       // Fabrika: 2. halin doğusu (zemin; 12.182 halin üstünden alındı)
];
// Araç doğuş noktaları (VERİ; araç mekaniği bu işin kapsamında değil). team: 'blue' | 'red' | 'flag:X' (bayrağın sahibine).
// tür: tank · zpt (zırhlı personel taşıyıcı) · jip · kamyon · heli-n (nakliye) · heli-s (saldırı)
export const VEHICLES = [
  { id: 'B-T1', type: 'tank', team: 'blue', x: 70, z: 668, ry: Math.PI }, { id: 'B-T2', type: 'tank', team: 'blue', x: 86, z: 668, ry: Math.PI },
  { id: 'B-Z1', type: 'zpt', team: 'blue', x: 102, z: 668, ry: Math.PI },
  { id: 'B-J1', type: 'jip', team: 'blue', x: 150, z: 664, ry: Math.PI }, { id: 'B-J2', type: 'jip', team: 'blue', x: 158, z: 664, ry: Math.PI }, { id: 'B-J3', type: 'jip', team: 'blue', x: 166, z: 664, ry: Math.PI },
  { id: 'B-H1', type: 'heli-n', team: 'blue', x: 60, z: 735, ry: Math.PI, pad: 'BH1' }, { id: 'B-H2', type: 'heli-s', team: 'blue', x: 180, z: 735, ry: Math.PI, pad: 'BH2' },
  { id: 'R-T1', type: 'tank', team: 'red', x: -70, z: -668, ry: 0 }, { id: 'R-T2', type: 'tank', team: 'red', x: -86, z: -668, ry: 0 },
  { id: 'R-Z1', type: 'zpt', team: 'red', x: -102, z: -668, ry: 0 },
  { id: 'R-J1', type: 'jip', team: 'red', x: -150, z: -664, ry: 0 }, { id: 'R-J2', type: 'jip', team: 'red', x: -158, z: -664, ry: 0 }, { id: 'R-J3', type: 'jip', team: 'red', x: -166, z: -664, ry: 0 },
  { id: 'R-H1', type: 'heli-n', team: 'red', x: -60, z: -735, ry: 0, pad: 'RH1' }, { id: 'R-H2', type: 'heli-s', team: 'red', x: -180, z: -735, ry: 0, pad: 'RH2' },
  { id: 'A-J', type: 'jip', team: 'flag:A', x: -584, z: 156, ry: 0.6 },
  { id: 'B-J', type: 'jip', team: 'flag:B', x: -196, z: 290, ry: 2.4 },
  { id: 'D-J', type: 'jip', team: 'flag:D', x: 282, z: -262, ry: -2.4 }, { id: 'D-K', type: 'kamyon', team: 'flag:D', x: 330, z: -270, ry: -1.6 },
  { id: 'E-J', type: 'jip', team: 'flag:E', x: 650, z: 40, ry: 0 },
  { id: 'F-J', type: 'jip', team: 'flag:F', x: 430, z: 455, ry: 2.2 }, { id: 'F-Z', type: 'zpt', team: 'flag:F', x: 370, z: 455, ry: 2.6 },
  { id: 'G-J', type: 'jip', team: 'flag:G', x: -356, z: -428, ry: -0.6 },
  // 12.200 kullanıcı: "araç sayısı yeterli değil, direkt botlar alıp kaçıyor; mapin içinde de araç az" → üste +2 jip (takım başına 5), bayrak başına
  // 2. jip (C Kavşak'ta 2; A Radar Tepesi tek), yol kenarında tarafsız jipler (team yok: ilk binen alır; boş kalınca doğuşunda yenilenir). Yerler
  // aranarak seçildi: eğim < 0,22, yapı / ağaç gövdesi 1,6 m'den, ağaç tepesi / çalı 1 m'den uzak, piyade doğuşundan 7 m, araç ızgarasında açık
  // (jip ≥ 2,2 m), yol kenarında banket (yolun ortası değil); vehground.mjs her doğuşu ölçer.
  { id: 'B-J4', type: 'jip', team: 'blue', x: 182, z: 664, ry: Math.PI }, { id: 'B-J5', type: 'jip', team: 'blue', x: 190, z: 664, ry: Math.PI },
  { id: 'R-J4', type: 'jip', team: 'red', x: -174, z: -664, ry: 0 }, { id: 'R-J5', type: 'jip', team: 'red', x: -182, z: -664, ry: 0 },
  { id: 'B-J2', type: 'jip', team: 'flag:B', x: -186.3, z: 219.7, ry: 2.49 },
  { id: 'C-J1', type: 'jip', team: 'flag:C', x: 24.6, z: 42.6, ry: -3.12 }, { id: 'C-J2', type: 'jip', team: 'flag:C', x: -24, z: -25, ry: 3.07 },
  { id: 'D-J2', type: 'jip', team: 'flag:D', x: 221.5, z: -262, ry: 2.36 },
  { id: 'E-J2', type: 'jip', team: 'flag:E', x: 671.2, z: -162.4, ry: -2.65 },
  { id: 'F-J2', type: 'jip', team: 'flag:F', x: 361.3, z: 400.4, ry: 0 },
  { id: 'G-J2', type: 'jip', team: 'flag:G', x: -405.5, z: -480, ry: 0 },
  { id: 'N-J1', type: 'jip', team: null, x: 53.5, z: 330, ry: -2.81 },          // Benzinlik (Vadi Yolu)
  { id: 'N-J2', type: 'jip', team: null, x: -35.5, z: -330, ry: 0.21 },         // Kuzey Yolu (Benzinlik'in aynası)
  { id: 'N-J3', type: 'jip', team: null, x: 324.6, z: -73.4, ry: -3.05 },       // Doğu Geçidi
  { id: 'N-J4', type: 'jip', team: null, x: -203.6, z: 45.3, ry: -3.11 },       // Batı Geçidi
  { id: 'N-J5', type: 'jip', team: null, x: -453.6, z: -16.3, ry: Math.PI },    // Değirmen
];

// Takım Çatışması (tdm) alt alanı: Köy (dar sokaklar, araçsız). Doğuşlar köyün iki ucunda.
export const TDM_AREA = { bounds: { minX: -370, maxX: -90, minZ: 130, maxZ: 370 }, blue: { x: -128, z: 300 }, red: { x: -340, z: 196 } };

// Bölge adları (mini harita / P tuşu). 4. değer: HUD'da adın görüneceği yarıçap (m; 12.184 — varsayılan 14 m 1,6 km'lik haritada neredeyse hiç görünmüyordu)
export const CALLOUTS = [
  ['Mavi Üs', 120, 700, 125], ['Kırmızı Üs', -120, -700, 125], ['Radar Tepesi', -560, 120, 70], ['Köy', -230, 250, 120], ['Kavşak', 0, 9, 75], ['Fabrika', 250, -300, 120],
  ['Baraj', 700, -60, 70], ['Çiftlik', 400, 420, 80], ['Kereste Kampı', -380, -450, 75], ['Değirmen', -470, -31, 55], ['Doğu Geçidi', 330, -76, 50], ['Batı Geçidi', -205, 41, 50],
  ['Santral', 640, 30, 40], ['Benzinlik', 40, 330, 40], ['Taş Ocağı', -668, -376, 50], ['Elektrik Hattı', 480, -150, 45],
];

// Orman ve tarla alanları (kurulum + plan ortak): forest = yoğun iğne yapraklı (+ huş), fields = tarla dikdörtgenleri [x, z, w, d, tür]
export const FOREST_ZONES = [
  { x: -380, z: -450, r: 260, dens: 1.0 }, { x: -620, z: -300, r: 220, dens: 0.9 }, { x: -160, z: -330, r: 170, dens: 0.7 },
  { x: 540, z: -470, r: 230, dens: 0.85 }, { x: 640, z: 300, r: 160, dens: 0.6 }, { x: -620, z: 520, r: 240, dens: 0.8 },
  { x: 160, z: 160, r: 110, dens: 0.45 }, { x: -380, z: 60, r: 120, dens: 0.5 }, { x: 420, z: 120, r: 120, dens: 0.55 },
  // 12.172 koruluklar: açık çayırda uzun görüş hatlarını kıran küçük ağaç kümeleri
  { x: -60, z: 470, r: 70, dens: 0.75 }, { x: 250, z: 250, r: 65, dens: 0.7 }, { x: -450, z: 360, r: 80, dens: 0.75 }, { x: 80, z: -380, r: 70, dens: 0.75 },
  { x: -230, z: -160, r: 75, dens: 0.75 }, { x: 420, z: -60, r: 50, dens: 0.6 }, { x: 560, z: 140, r: 60, dens: 0.7 }, { x: -120, z: 120, r: 45, dens: 0.6 },
  { x: 310, z: -470, r: 70, dens: 0.75 }, { x: -560, z: -90, r: 60, dens: 0.7 }, { x: 120, z: 560, r: 55, dens: 0.6 }, { x: -300, z: 520, r: 60, dens: 0.7 },
  // 12.182 doldurma: eski nehir boyu ve bayraklar arası açık çayırlara yeni koruluklar
  { x: 60, z: -62, r: 50, dens: 0.7 }, { x: -64, z: -92, r: 48, dens: 0.7 }, { x: 232, z: -58, r: 55, dens: 0.72 }, { x: -300, z: -262, r: 68, dens: 0.75 }, { x: 382, z: -222, r: 52, dens: 0.7 },
  { x: 140, z: 42, r: 42, dens: 0.65 }, { x: -142, z: 38, r: 46, dens: 0.7 }, { x: -420, z: 182, r: 50, dens: 0.7 }, { x: 182, z: 300, r: 46, dens: 0.7 }, { x: -64, z: 396, r: 42, dens: 0.65 },
  { x: -252, z: 422, r: 58, dens: 0.75 }, { x: 482, z: 562, r: 52, dens: 0.7 }, { x: -420, z: 562, r: 58, dens: 0.75 }, { x: 600, z: -122, r: 48, dens: 0.7 }, { x: -662, z: 62, r: 58, dens: 0.75 },
  { x: 62, z: -642, r: 50, dens: 0.7 }, { x: -302, z: -622, r: 58, dens: 0.75 }, { x: 402, z: -562, r: 58, dens: 0.75 }, { x: 560, z: 42, r: 42, dens: 0.65 }, { x: -520, z: 40, r: 40, dens: 0.6 },
];
// çalı çitleri (bocage): tarla kenarları / yol boyları; çarpışmasız, mermi geçer, bot görüşünü keser. [x0, z0, x1, z1]
export const HEDGES = [
  [270, 325, 390, 325], [270, 395, 390, 395], [425, 320, 515, 320], [425, 400, 515, 400], [395, 480, 525, 480], [395, 540, 525, 540], [245, 505, 355, 505],
  [-165, 195, -75, 195], [-165, 265, -75, 265], [-415, 310, -305, 310], [-415, 370, -305, 370], [-380, 125, -300, 125],
  [155, -200, 245, -200], [155, -140, 245, -140], [60, -295, 140, -295], [-105, -270, -15, -270], [-105, -210, -15, -210],
  [60, 250, 60, 410], [-60, 140, -60, 300], [500, 200, 500, 300], [-520, 240, -420, 240], [180, -60, 180, 40], [-140, -60, -140, -150], [320, 120, 320, 240],
];
export const FIELDS = [
  [330, 360, 120, 70, 'wheat'], [470, 360, 90, 80, 'plow'], [460, 510, 130, 60, 'wheat'], [300, 540, 110, 70, 'grass'], [520, 440, 50, 70, 'plow'],
  [-120, 230, 90, 70, 'wheat'], [-90, 310, 70, 60, 'plow'], [-360, 340, 110, 60, 'wheat'], [-340, 150, 80, 50, 'plow'],
  [200, -170, 90, 60, 'plow'], [100, -260, 80, 70, 'wheat'], [-60, -240, 90, 60, 'wheat'],
  [0, 285, 90, 130, 'grass'],                                                                // 12.182 Benzinlik batısı mera (araç / tank açık alanı)
];
