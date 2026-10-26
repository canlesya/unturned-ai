// "Kuzey Vadisi" (12.172) — yerleşim VERİSİ (three.js yok; sunucu, araçlar, planlama betikleri ortak okur).
// Ölçek: 1 birim = 1 m. Oynanır alan 1600 × 1600 m (x −800..800, z −800..800). Mavi güneyde (+z), Kırmızı kuzeyde (−z).
// Nehir doğudaki baraj gölünden (Baraj, E) batıya akar ve vadiyi ikiye böler; geçitler: Taş Köprü (C, orta), Demir Köprü (batı),
// baraj tepesi (doğu) ve iki sığ geçit (araçlar / piyade; derin suya girilmez). Bayraklar 180° dönel simetriye yakın: F↔G, B↔D, A↔E, C orta.

export const KZ_BOUNDS = { minX: -800, maxX: 800, minZ: -800, maxZ: 800 };
export const KZ_CELL = 2;                                 // arazi / fizik ızgarası (m)
export const KZ_WATER = 0;                                // nehir yüzeyi
export const KZ_LAKE = 20;                                // baraj gölü yüzeyi (yalnız görsel; göl kıyısı dik kaya, oynanır alanda yürünmez)
export const KZ_DEEP = -0.6;                              // bunun altındaki zemine yürünmez (derin su)

// Nehir ekseni (doğudan batıya) + yarı genişlik (m). Harita dışında da sürer (uzak manzarada vadi açılır).
export const RIVER = [
  [700, -60, 15], [650, -48, 17], [580, -25, 18], [500, -28, 19], [420, -55, 19], [340, -78, 20], [260, -72, 20], [180, -45, 20],
  [100, -15, 20], [20, 6, 19], [-60, 22, 20], [-150, 42, 21], [-240, 40, 22], [-330, 14, 22], [-410, -18, 22], [-490, -36, 23],
  [-580, -30, 24], [-670, -8, 25], [-760, 12, 26], [-900, 30, 28], [-1200, 20, 34], [-1700, -60, 44], [-2600, -120, 60],
];
// Baraj gölü (barajın doğusu): eksen + yarı genişlik; dik kanyonun içinde genişleyerek dağlara uzanır
export const LAKE = [[705, -60, 34], [800, -70, 60], [950, -40, 120], [1200, -10, 220], [1600, -60, 330], [2200, -140, 420]];
// Sığ geçitler: nehir tabanı −0,35 m (yürünür / araç geçer), 16 m boyunca
export const FORDS = [{ x: 330, z: -76, r: 16 }, { x: -205, z: 41, r: 15 }];

// Yollar: tür hw (asfalt, 9 m) · rd (asfalt, 6,5 m) · dirt (toprak, 4,5 m). Nehri geçen yerlerde köprü (bridge) ya da geçit (ford) varlığı kesintisiz bağlar.
export const ROAD_W = { hw: 9, rd: 6.5, dirt: 4.5 };
export const ROADS = [
  { id: 'R1', t: 'hw', name: 'Vadi Yolu (güney)', pts: [[120, 640], [130, 560], [110, 460], [60, 330], [20, 200], [4, 110], [0, 60], [0, 30]] },
  { id: 'R1n', t: 'hw', name: 'Vadi Yolu (kuzey)', pts: [[0, -12], [0, -40], [30, -110], [110, -170], [190, -240], [250, -300]] },
  { id: 'R2', t: 'hw', name: 'Fabrika Yolu', pts: [[250, -300], [200, -400], [100, -500], [-40, -590], [-110, -640]] },
  { id: 'R3', t: 'rd', name: 'Çiftlik Yolu', pts: [[130, 560], [230, 520], [330, 470], [400, 420]] },
  { id: 'R4', t: 'rd', name: 'Köy Yolu', pts: [[110, 460], [0, 420], [-110, 360], [-190, 300], [-230, 250]] },
  { id: 'R5', t: 'rd', name: 'Köprü Yolu', pts: [[-230, 250], [-180, 180], [-100, 110], [-30, 70], [0, 60]] },
  { id: 'R6', t: 'rd', name: 'Radar Yolu', pts: [[-230, 250], [-330, 240], [-430, 210], [-500, 190], [-600, 200], [-660, 150], [-640, 80], [-580, 60], [-540, 92], [-560, 120]] },
  { id: 'R7', t: 'rd', name: 'Demir Köprü Yolu', pts: [[-500, 190], [-480, 100], [-472, 40], [-470, 8]] },
  { id: 'R7n', t: 'rd', name: 'Orman Yolu', pts: [[-470, -70], [-462, -150], [-432, -260], [-402, -360], [-380, -450]] },
  { id: 'R8', t: 'rd', name: 'Kamp Yolu', pts: [[-380, -450], [-300, -540], [-200, -620], [-120, -660]] },
  { id: 'R9', t: 'rd', name: 'Baraj Yolu (güney)', pts: [[400, 420], [500, 330], [600, 220], [664, 110], [690, 34], [690, 14]] },
  { id: 'R10', t: 'rd', name: 'Baraj Yolu (kuzey)', pts: [[690, -134], [690, -150], [640, -214], [540, -270], [420, -300], [250, -300]] },
  { id: 'R11', t: 'dirt', name: 'Doğu Geçidi', ford: true, pts: [[400, 420], [382, 300], [352, 150], [336, 20], [330, -76], [320, -160], [290, -240]] },
  { id: 'R12', t: 'dirt', name: 'Batı Geçidi', ford: true, pts: [[-230, 250], [-216, 150], [-205, 41], [-228, -80], [-296, -220], [-350, -380], [-380, -450]] },
  { id: 'R13', t: 'rd', name: 'Kuzey Yolu', pts: [[-110, -640], [-80, -500], [-40, -330], [-12, -180], [0, -40]] },
];
// Köprüler: yol ekseni boyunca (a → b), tabliye kotu. Uzunluk kurulumda araziden bulunur (tabliyenin altında arazi kalan kısım).
export const BRIDGES = [
  { id: 'C', kind: 'stone', name: 'Taş Köprü', x: 0, z: 9, ax: 'z', deck: 6.2, w: 11 },
  { id: 'W', kind: 'truss', name: 'Demir Köprü', x: -470, z: -31, ax: 'z', deck: 7.0, w: 8.5 },
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
  { id: 'Cs', x: 0, z: 74, w: 90, d: 34, fall: 26, k: 0.9 },
  { id: 'Cn', x: 0, z: -58, w: 90, d: 34, fall: 26, k: 0.9 },
  { id: 'Es', x: 640, z: 30, w: 70, d: 50, fall: 24, k: 0.9 },
];

// Ele Geçirme bayrakları (dizi sırası = HUD sırası). core: az oyunculu maçta kullanılan 3 bayrak. r = ele geçirme yarıçapı.
export const FLAGS = [
  { id: 'A', name: 'Radar Tepesi', x: -560, z: 120, r: 22 },
  { id: 'B', name: 'Köy', x: -230, z: 250, r: 24, core: true },
  { id: 'C', name: 'Taş Köprü', x: 0, z: 9, r: 26, core: true },
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
  { id: 'DH', team: null, x: 318, z: -340, r: 9 },       // Fabrika çatısı yanı (zemin)
];
// Araç doğuş noktaları (VERİ; araç mekaniği bu işin kapsamında değil). team: 'blue' | 'red' | 'flag:X' (bayrağın sahibine).
// tür: tank · zpt (zırhlı personel taşıyıcı) · jip · kamyon · heli-n (nakliye) · heli-s (saldırı) · bot (nehir)
export const VEHICLES = [
  { id: 'B-T1', type: 'tank', team: 'blue', x: 70, z: 668, ry: Math.PI }, { id: 'B-T2', type: 'tank', team: 'blue', x: 86, z: 668, ry: Math.PI },
  { id: 'B-Z1', type: 'zpt', team: 'blue', x: 102, z: 668, ry: Math.PI },
  { id: 'B-J1', type: 'jip', team: 'blue', x: 150, z: 664, ry: Math.PI }, { id: 'B-J2', type: 'jip', team: 'blue', x: 158, z: 664, ry: Math.PI }, { id: 'B-J3', type: 'jip', team: 'blue', x: 166, z: 664, ry: Math.PI },
  { id: 'B-H1', type: 'heli-n', team: 'blue', x: 60, z: 735, ry: Math.PI, pad: 'BH1' }, { id: 'B-H2', type: 'heli-s', team: 'blue', x: 180, z: 735, ry: Math.PI, pad: 'BH2' },
  { id: 'R-T1', type: 'tank', team: 'red', x: -70, z: -668, ry: 0 }, { id: 'R-T2', type: 'tank', team: 'red', x: -86, z: -668, ry: 0 },
  { id: 'R-Z1', type: 'zpt', team: 'red', x: -102, z: -668, ry: 0 },
  { id: 'R-J1', type: 'jip', team: 'red', x: -150, z: -664, ry: 0 }, { id: 'R-J2', type: 'jip', team: 'red', x: -158, z: -664, ry: 0 }, { id: 'R-J3', type: 'jip', team: 'red', x: -166, z: -664, ry: 0 },
  { id: 'R-H1', type: 'heli-n', team: 'red', x: -60, z: -735, ry: 0, pad: 'RH1' }, { id: 'R-H2', type: 'heli-s', team: 'red', x: -180, z: -735, ry: 0, pad: 'RH2' },
  { id: 'A-J', type: 'jip', team: 'flag:A', x: -585, z: 150, ry: 0.6 },
  { id: 'B-J', type: 'jip', team: 'flag:B', x: -200, z: 300, ry: 2.4 },
  { id: 'D-J', type: 'jip', team: 'flag:D', x: 300, z: -250, ry: -2.4 }, { id: 'D-K', type: 'kamyon', team: 'flag:D', x: 330, z: -270, ry: -1.6 },
  { id: 'E-J', type: 'jip', team: 'flag:E', x: 650, z: 40, ry: 0 },
  { id: 'F-J', type: 'jip', team: 'flag:F', x: 430, z: 455, ry: 2.2 }, { id: 'F-Z', type: 'zpt', team: 'flag:F', x: 370, z: 455, ry: 2.6 },
  { id: 'G-J', type: 'jip', team: 'flag:G', x: -350, z: -420, ry: -0.6 },
  { id: 'C-B1', type: 'bot', team: null, x: -40, z: 24, ry: -1.4 }, { id: 'C-B2', type: 'bot', team: null, x: 40, z: -8, ry: 1.6 },
];

// Takım Çatışması (tdm) alt alanı: Köy (dar sokaklar, araçsız). Doğuşlar köyün iki ucunda.
export const TDM_AREA = { bounds: { minX: -370, maxX: -90, minZ: 130, maxZ: 370 }, blue: { x: -128, z: 300 }, red: { x: -340, z: 196 } };

// Bölge adları (mini harita / P tuşu)
export const CALLOUTS = [
  ['Mavi Üs', 120, 700], ['Kırmızı Üs', -120, -700], ['Radar Tepesi', -560, 120], ['Köy', -230, 250], ['Taş Köprü', 0, 9], ['Fabrika', 250, -300],
  ['Baraj', 700, -60], ['Çiftlik', 400, 420], ['Kereste Kampı', -380, -450], ['Demir Köprü', -470, -31], ['Doğu Geçidi', 330, -76], ['Batı Geçidi', -205, 41],
  ['Santral', 640, 30], ['Benzinlik', 40, 330], ['Taş Ocağı', -680, -380], ['Elektrik Hattı', 480, -160],
];

// Orman ve tarla alanları (kurulum + plan ortak): forest = yoğun iğne yapraklı (+ huş), fields = tarla dikdörtgenleri [x, z, w, d, tür]
export const FOREST_ZONES = [
  { x: -380, z: -450, r: 260, dens: 1.0 }, { x: -620, z: -300, r: 220, dens: 0.9 }, { x: -160, z: -330, r: 170, dens: 0.7 },
  { x: 540, z: -470, r: 230, dens: 0.85 }, { x: 640, z: 300, r: 160, dens: 0.6 }, { x: -620, z: 520, r: 240, dens: 0.8 },
  { x: 160, z: 160, r: 110, dens: 0.45 }, { x: -380, z: 60, r: 120, dens: 0.5 }, { x: 420, z: 120, r: 120, dens: 0.55 },
];
export const FIELDS = [
  [330, 360, 120, 70, 'wheat'], [470, 360, 90, 80, 'plow'], [460, 510, 130, 60, 'wheat'], [300, 540, 110, 70, 'grass'], [520, 440, 50, 70, 'plow'],
  [-120, 230, 90, 70, 'wheat'], [-90, 310, 70, 60, 'plow'], [-360, 340, 110, 60, 'wheat'], [-340, 150, 80, 50, 'plow'],
  [200, -170, 90, 60, 'plow'], [100, -260, 80, 70, 'wheat'], [-60, -240, 90, 60, 'wheat'],
];
