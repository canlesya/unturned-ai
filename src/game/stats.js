// Silah ve sınıf verileri. Mesafe: metre, süre: saniye, açı: radyan.
// sight: ADS sırasında nişan noktası (silah yerelinde: x, y, z) · dist: gözden nişangaha mesafe.
// slot: primary|secondary|gadget|melee · stats: arayüz için 0-100 değerleri · reload: boş şarjörle tam süre
// (şarjörde mermi varsa "taktik reload" TAC_RELOAD çarpanıyla hızlanır) · shell: pompalı/çift namlu mermi başı süre
// reloadStyle: mag | shell | bolt · equip: silahı çekme süresi · tracer: iz mermisi rengi

export const TAC_RELOAD = 0.65;

export const WSTATS = {
  // ───────── Tüfekler ─────────
  ak47: {
    name: 'AK-47', kind: 'gun', slot: 'primary', desc: 'Yüksek hasarlı klasik tüfek, tepmesi güçlü.', stats: { dmg: 70, range: 68, rate: 58, control: 42, mobility: 66 },
    auto: true, dmg: 34, rpm: 600, mag: 30, reserve: 120, reload: 1.8, equip: 0.3,
    hip: 0.0085, ads: 0.0012, kickV: 0.017, kickH: 0.006, range: [35, 110], minMul: 0.6, zoom: 1.25, move: 0.95,
    sight: [0, 0.117, -0.1], dist: 0.28, dot: true, sound: 'rifle',
  },
  m4a1: {
    name: 'M4A1', kind: 'gun', slot: 'primary', desc: 'Dengeli, kontrolü kolay tüfek.', stats: { dmg: 58, range: 72, rate: 72, control: 70, mobility: 70 },
    auto: true, dmg: 28, rpm: 750, mag: 30, reserve: 150, reload: 1.6, equip: 0.3,
    hip: 0.007, ads: 0.0008, kickV: 0.012, kickH: 0.0045, range: [40, 120], minMul: 0.62, zoom: 1.5, move: 1.0,
    sight: [0, 0.1165, -0.14], dist: 0.28, dot: true, sound: 'rifle',
  },
  scarh: {
    name: 'SCAR-H', kind: 'gun', slot: 'primary', desc: 'Ağır 7.62 tüfek: az mermi, çok hasar.', stats: { dmg: 82, range: 78, rate: 50, control: 38, mobility: 58 },
    auto: true, dmg: 40, rpm: 520, mag: 20, reserve: 100, reload: 1.9, equip: 0.32,
    hip: 0.009, ads: 0.001, kickV: 0.02, kickH: 0.007, range: [40, 130], minMul: 0.65, zoom: 1.4, move: 0.94,
    sight: [0, 0.135, -0.1], dist: 0.28, dot: true, sound: 'battle',
  },
  aug: {
    name: 'AUG', kind: 'gun', slot: 'primary', desc: 'Bullpup tüfek: kompakt, çok stabil.', stats: { dmg: 60, range: 74, rate: 68, control: 78, mobility: 68 },
    auto: true, dmg: 29, rpm: 700, mag: 30, reserve: 150, reload: 1.8, equip: 0.3,
    hip: 0.0075, ads: 0.0007, kickV: 0.0105, kickH: 0.004, range: [40, 120], minMul: 0.62, zoom: 1.5, move: 1.0,
    sight: [0, 0.125, -0.1], dist: 0.28, dot: true, sound: 'carbine',
  },
  g36: {
    name: 'G36', kind: 'gun', slot: 'primary', desc: 'Hafif ve isabetli, taşıma saplı tüfek.', stats: { dmg: 60, range: 72, rate: 70, control: 72, mobility: 68 },
    auto: true, dmg: 30, rpm: 750, mag: 30, reserve: 150, reload: 1.7, equip: 0.3,
    hip: 0.0075, ads: 0.0008, kickV: 0.0115, kickH: 0.0045, range: [40, 120], minMul: 0.62, zoom: 1.5, move: 1.0,
    sight: [0, 0.135, -0.1], dist: 0.28, dot: true, sound: 'carbine',
  },
  ak74u: {
    name: 'AK-74U', kind: 'gun', slot: 'primary', desc: 'Kısa karabina: hızlı, çevik, kısa menzil.', stats: { dmg: 48, range: 48, rate: 72, control: 52, mobility: 82 },
    auto: true, dmg: 25, rpm: 700, mag: 30, reserve: 150, reload: 1.6, equip: 0.28,
    hip: 0.0085, ads: 0.0014, kickV: 0.014, kickH: 0.007, range: [25, 80], minMul: 0.5, zoom: 1.25, move: 1.04,
    sight: [0, 0.11, -0.1], dist: 0.28, dot: true, sound: 'carbine',
  },
  // ───────── SMG ─────────
  mp5: {
    name: 'MP5', kind: 'gun', slot: 'primary', desc: 'Dengeli SMG, yakın-orta mesafede çok etkili.', stats: { dmg: 44, range: 42, rate: 82, control: 66, mobility: 82 },
    auto: true, dmg: 22, rpm: 820, mag: 30, reserve: 150, reload: 1.5, equip: 0.28,
    hip: 0.0085, ads: 0.0014, kickV: 0.009, kickH: 0.0045, range: [20, 70], minMul: 0.5, zoom: 1.25, move: 1.05,
    sight: [0, 0.0845, -0.08], dist: 0.28, dot: true, sound: 'smg',
  },
  vector: {
    name: 'Vector', kind: 'gun', slot: 'primary', desc: 'Çok yüksek atış hızı; şarjör hızla erir.', stats: { dmg: 36, range: 34, rate: 100, control: 55, mobility: 84 },
    auto: true, dmg: 19, rpm: 1100, mag: 25, reserve: 125, reload: 1.4, equip: 0.28,
    hip: 0.009, ads: 0.0016, kickV: 0.007, kickH: 0.0045, range: [18, 60], minMul: 0.45, zoom: 1.25, move: 1.05,
    sight: [0, 0.09, -0.1], dist: 0.28, dot: true, sound: 'vector',
  },
  p90: {
    name: 'P90', kind: 'gun', slot: 'primary', desc: '50 mermilik şarjör, düşük tepme.', stats: { dmg: 40, range: 44, rate: 86, control: 80, mobility: 84 },
    auto: true, dmg: 20, rpm: 900, mag: 50, reserve: 150, reload: 1.8, equip: 0.28,
    hip: 0.0085, ads: 0.0013, kickV: 0.0075, kickH: 0.004, range: [22, 75], minMul: 0.5, zoom: 1.25, move: 1.05,
    sight: [0, 0.103, -0.08], dist: 0.28, dot: true, sound: 'p90',
  },
  mac10: {
    name: 'MAC-10', kind: 'gun', slot: 'secondary', desc: 'Makineli tabanca: devasa atış hızı, kısa menzil.', stats: { dmg: 34, range: 26, rate: 96, control: 30, mobility: 92 },
    auto: true, dmg: 18, rpm: 1000, mag: 32, reserve: 96, reload: 1.3, equip: 0.22,
    hip: 0.011, ads: 0.003, kickV: 0.012, kickH: 0.008, range: [14, 45], minMul: 0.4, zoom: 1.2, move: 1.1,
    sight: [0, 0.07, -0.02], dist: 0.28, dot: true, sound: 'mac10',
  },
  // ───────── Pompalılar ─────────
  shotgun: {
    name: 'Pompalı', kind: 'gun', slot: 'primary', desc: 'Klasik pompalı: yakın mesafede ölümcül.', stats: { dmg: 88, range: 18, rate: 14, control: 40, mobility: 66 },
    auto: false, dmg: 11, pellets: 9, rpm: 70, mag: 6, reserve: 30, reload: 2.7, reloadStyle: 'shell', shell: 0.45, equip: 0.32,
    hip: 0.05, ads: 0.032, kickV: 0.04, kickH: 0.01, range: [12, 32], minMul: 0.15, zoom: 1.15, move: 0.97,
    sight: [0, 0.0845, -0.03], dist: 0.28, dot: true, sound: 'shotgun',
  },
  aa12: {
    name: 'AA-12', kind: 'gun', slot: 'primary', desc: 'Tam otomatik pompalı: yakın mesafede yağmur.', stats: { dmg: 70, range: 18, rate: 55, control: 35, mobility: 55 },
    auto: true, dmg: 9, pellets: 8, rpm: 300, mag: 8, reserve: 40, reload: 2.2, equip: 0.35,
    hip: 0.055, ads: 0.036, kickV: 0.03, kickH: 0.012, range: [10, 28], minMul: 0.15, zoom: 1.15, move: 0.92,
    sight: [0, 0.095, -0.05], dist: 0.28, dot: true, sound: 'aa12',
  },
  dbl: {
    name: 'Çift Namlu', kind: 'gun', slot: 'primary', desc: 'İki namlu, tek ateş: devasa dağılım ve hasar.', stats: { dmg: 98, range: 20, rate: 28, control: 25, mobility: 62 },
    auto: false, dmg: 12, pellets: 12, rpm: 200, mag: 2, reserve: 24, reload: 1.1, reloadStyle: 'shell', shell: 0.5, equip: 0.3,
    hip: 0.06, ads: 0.04, kickV: 0.07, kickH: 0.015, range: [10, 28], minMul: 0.12, zoom: 1.15, move: 0.97,
    sight: [0, 0.08, -0.02], dist: 0.28, dot: true, sound: 'dbl',
  },
  // ───────── Tabancalar ─────────
  pistol: {
    name: 'Glock 17', kind: 'gun', slot: 'secondary', desc: 'Hafif, hızlı çekilen yedek silah.', stats: { dmg: 40, range: 32, rate: 62, control: 66, mobility: 95 },
    auto: false, dmg: 24, rpm: 420, mag: 15, reserve: 60, reload: 1.0, equip: 0.2,
    hip: 0.006, ads: 0.0016, kickV: 0.018, kickH: 0.004, range: [15, 55], minMul: 0.5, zoom: 1.2, move: 1.05,
    sight: [0, 0.0913, -0.02], dist: 0.28, dot: true, sound: 'pistol',
  },
  m1911: {
    name: 'M1911', kind: 'gun', slot: 'secondary', desc: '.45 klasik: daha sert vurur, şarjör küçük.', stats: { dmg: 50, range: 30, rate: 56, control: 60, mobility: 92 },
    auto: false, dmg: 32, rpm: 380, mag: 8, reserve: 48, reload: 1.0, equip: 0.2,
    hip: 0.006, ads: 0.0015, kickV: 0.022, kickH: 0.005, range: [14, 50], minMul: 0.5, zoom: 1.2, move: 1.05,
    sight: [0, 0.09, -0.02], dist: 0.28, dot: true, sound: 'pistol45',
  },
  deagle: {
    name: 'Desert Eagle', kind: 'gun', slot: 'secondary', desc: '.50 AE: tek-iki atışta öldürür, tepmesi sert.', stats: { dmg: 82, range: 52, rate: 38, control: 36, mobility: 88 },
    auto: false, dmg: 55, rpm: 200, mag: 7, reserve: 35, reload: 1.3, equip: 0.25,
    hip: 0.008, ads: 0.0012, kickV: 0.045, kickH: 0.008, range: [25, 80], minMul: 0.6, zoom: 1.2, move: 1.0,
    sight: [0, 0.098, -0.02], dist: 0.28, dot: true, sound: 'magnum',
  },
  revolver: {
    name: 'Revolver', kind: 'gun', slot: 'secondary', desc: '6 atış, ağır hasar; yavaş doldurulur.', stats: { dmg: 88, range: 55, rate: 30, control: 28, mobility: 88 },
    auto: false, dmg: 62, rpm: 130, mag: 6, reserve: 36, reload: 1.7, equip: 0.25,
    hip: 0.008, ads: 0.001, kickV: 0.06, kickH: 0.01, range: [25, 85], minMul: 0.65, zoom: 1.2, move: 1.0,
    sight: [0, 0.1, -0.02], dist: 0.28, dot: true, sound: 'revolver',
  },
  // ───────── Keskin nişancılar ─────────
  sniper: {
    name: 'M24 Keskin', kind: 'gun', slot: 'primary', desc: 'Sürgülü: gövdeye tek atış, 4x dürbün.', stats: { dmg: 100, range: 100, rate: 10, control: 60, mobility: 40 },
    auto: false, bolt: true, dmg: 105, rpm: 48, mag: 5, reserve: 25, reload: 2.2, reloadStyle: 'bolt', equip: 0.35,
    hip: 0.03, ads: 0.0002, kickV: 0.05, kickH: 0.006, range: [150, 300], minMul: 0.85, zoom: 4, move: 0.9,
    sight: [0, 0.14, 0.12], dist: 0.06, sound: 'sniper', scope: true, tracer: '#cfe8ff',
  },
  svd: {
    name: 'SVD', kind: 'gun', slot: 'primary', desc: 'Yarı otomatik DMR: hızlı takip atışı, 3x dürbün.', stats: { dmg: 66, range: 88, rate: 38, control: 52, mobility: 50 },
    auto: false, dmg: 62, rpm: 260, mag: 10, reserve: 40, reload: 2.2, equip: 0.35,
    hip: 0.02, ads: 0.0005, kickV: 0.03, kickH: 0.005, range: [70, 220], minMul: 0.75, zoom: 3, move: 0.93,
    sight: [0, 0.12, -0.06], dist: 0.05, sound: 'dmr', tracer: '#ffe9a0',
  },
  barrett: {
    name: 'Barrett .50', kind: 'gun', slot: 'primary', desc: 'Anti-materyel: tek atışta kıyma, çok ağır.', stats: { dmg: 100, range: 100, rate: 12, control: 30, mobility: 26 },
    auto: false, dmg: 135, rpm: 80, mag: 5, reserve: 15, reload: 2.7, equip: 0.4,
    hip: 0.04, ads: 0.0002, kickV: 0.085, kickH: 0.01, range: [180, 400], minMul: 0.9, zoom: 6, move: 0.8,
    sight: [0, 0.15, 0.1], dist: 0.06, sound: 'barrett', scope: true, tracer: '#ffd2a0',
  },
  // ───────── LMG ─────────
  lmg: {
    name: 'M249 LMG', kind: 'gun', slot: 'primary', desc: '100 mermi, bastırma ateşi.', stats: { dmg: 50, range: 62, rate: 72, control: 40, mobility: 36 },
    auto: true, dmg: 25, rpm: 720, mag: 100, reserve: 200, reload: 3.5, equip: 0.35,
    hip: 0.011, ads: 0.0028, kickV: 0.011, kickH: 0.008, range: [35, 100], minMul: 0.55, zoom: 1.3, move: 0.85,
    sight: [0, 0.138, -0.1], dist: 0.28, dot: true, sound: 'lmg', tracer: '#ff8a6a',
  },
  pkm: {
    name: 'PKM', kind: 'gun', slot: 'primary', desc: 'Ağır makineli: 7.62 mm, güçlü ama hantal.', stats: { dmg: 64, range: 70, rate: 62, control: 30, mobility: 30 },
    auto: true, dmg: 32, rpm: 650, mag: 100, reserve: 200, reload: 3.6, equip: 0.35,
    hip: 0.013, ads: 0.0032, kickV: 0.016, kickH: 0.01, range: [40, 120], minMul: 0.58, zoom: 1.3, move: 0.82,
    sight: [0, 0.14, -0.1], dist: 0.28, dot: true, sound: 'pkm', tracer: '#ff8a6a',
  },
  // ───────── Fırlatıcılar (gadget yuvası) ─────────
  rpg: {
    name: 'RPG-7', kind: 'launcher', slot: 'gadget', desc: 'Roketatar: araç ve bina için patlayıcı hasar.', stats: { dmg: 100, range: 80, rate: 8, control: 40, mobility: 40 },
    count: 2, auto: false, dmg: 160, radius: 6.5, speed: 38, rpm: 30, mag: 1, reserve: 2, reload: 2.8, equip: 0.35,
    hip: 0.02, ads: 0.005, kickV: 0.06, kickH: 0.01, zoom: 1.4, move: 0.85,
    sight: [-0.045, 0.14, -0.05], dist: 0.34, sound: 'rpg',
  },
  m79: {
    name: 'M79 Bomba Atar', kind: 'launcher', slot: 'gadget', desc: 'Yaylı yoldan 40 mm bomba, çarpınca patlar.', stats: { dmg: 70, range: 55, rate: 10, control: 60, mobility: 55 },
    count: 6, auto: false, impact: true, dmg: 120, radius: 5, speed: 30, rpm: 40, mag: 1, reserve: 5, reload: 1.5, reloadStyle: 'break', equip: 0.3,
    hip: 0.02, ads: 0.006, kickV: 0.04, kickH: 0.008, zoom: 1.2, move: 0.95,
    sight: [0, 0.09, 0.02], dist: 0.3, sound: 'm79',
  },
  // ───────── Gadgetlar ─────────
  grenade: {
    name: 'El Bombası', kind: 'throwable', gtype: 'frag', slot: 'gadget', desc: 'Patlayıcı bomba, 2.6 sn fitil.', stats: { dmg: 80, range: 40, rate: 30, control: 50, mobility: 100 },
    count: 2, dmg: 130, radius: 6, fuse: 2.6, speed: 15, rpm: 40, mag: 2, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw',
  },
  smoke: {
    name: 'Dumanlı Bomba', kind: 'throwable', gtype: 'smoke', slot: 'gadget', desc: '10 sn duman perdesi: görüşü tamamen keser.', stats: { dmg: 0, range: 40, rate: 30, control: 70, mobility: 100 },
    count: 2, radius: 5.2, fuse: 1.5, speed: 14, rpm: 40, mag: 2, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw', smokeLife: 10,
  },
  flash: {
    name: 'Flaşbang', kind: 'throwable', gtype: 'flash', slot: 'gadget', desc: 'Bakanları kör eder, botları şaşırtır.', stats: { dmg: 0, range: 40, rate: 30, control: 70, mobility: 100 },
    count: 2, radius: 24, fuse: 1.5, speed: 15, rpm: 40, mag: 2, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw',
  },
  claymore: {
    name: 'Claymore', kind: 'mine', slot: 'gadget', desc: 'Yere kurulur; önünden geçen düşmanı patlatır.', stats: { dmg: 90, range: 25, rate: 20, control: 60, mobility: 100 },
    count: 2, dmg: 150, radius: 5.5, trigger: 6.5, rpm: 40, mag: 2, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw', useTime: 0.7,
  },
  ammobox: {
    name: 'Cephane Kutusu', kind: 'ammobox', slot: 'gadget', desc: 'Yere koyulur; yakındaki dostların mermisini doldurur.', stats: { dmg: 0, range: 20, rate: 10, control: 70, mobility: 100 },
    count: 1, rpm: 40, mag: 1, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw', useTime: 0.8, life: 30, radius: 3.6,
  },
  medkit: {
    name: 'İlk Yardım', kind: 'medkit', slot: 'gadget', desc: 'Can yeniler (60).', stats: { dmg: 0, range: 0, rate: 20, control: 80, mobility: 100 },
    count: 3, heal: 60, rpm: 30, mag: 3, reserve: 0, move: 1.0, equip: 0.25, useTime: 1.4, sound: 'reload',
  },
  // ───────── Yakın dövüş ─────────
  knife: {
    name: 'Bıçak', kind: 'melee', slot: 'melee', desc: 'Hızlı kombo, arkadan tek vuruş.', stats: { dmg: 45, range: 40, rate: 90, control: 90, mobility: 100 },
    dmg: 45, reach: 2.1, rpm: 130, mag: 1, reserve: 0, move: 1.08, equip: 0.2, sound: 'knife',
    swings: ['rl', 'lr', 'stab'], swingT: 0.36, stabT: 0.44, stabMul: 1.3,
  },
  machete: {
    name: 'Satır', kind: 'melee', slot: 'melee', desc: 'Uzun menzil, ağır ve geniş savurma.', stats: { dmg: 70, range: 62, rate: 62, control: 70, mobility: 96 },
    dmg: 70, reach: 2.5, rpm: 100, mag: 1, reserve: 0, move: 1.05, equip: 0.26, sound: 'knife',
    swings: ['rl', 'lr', 'diag'], swingT: 0.46, stabT: 0.5, stabMul: 1.2,
  },
  tomahawk: {
    name: 'Tomahawk', kind: 'melee', slot: 'melee', desc: 'Tepeden inen ağır darbe, kısa menzil.', stats: { dmg: 90, range: 32, rate: 50, control: 60, mobility: 98 },
    dmg: 90, reach: 1.9, rpm: 80, mag: 1, reserve: 0, move: 1.06, equip: 0.24, sound: 'knife',
    swings: ['chop', 'rl', 'chop'], swingT: 0.5, stabT: 0.5, stabMul: 1.15,
  },
};

export const BACKSTAB_DMG = 999;

// Sınıflar: hp, hız çarpanı ve ekipman. primary/gadget = eski alanlar (varsayılanlarla aynı)
export const CLASS_DEFS = {
  assault: {
    label: 'Saldırı', hp: 100, speed: 1.0, primary: { blue: 'm4a1', red: 'ak47' }, gadget: ['grenade', 2], desc: 'Dengeli tüfek + 2 el bombası',
    primaryOptions: ['m4a1', 'ak47', 'scarh', 'aug', 'g36', 'ak74u'],
    secondaryOptions: ['pistol', 'm1911', 'deagle', 'revolver', 'mac10'],
    gadgetOptions: ['grenade', 'smoke', 'flash', 'claymore'],
    meleeOptions: ['knife', 'machete', 'tomahawk'],
    defaults: { primary: { blue: 'm4a1', red: 'ak47' }, secondary: 'pistol', gadget: 'grenade', melee: 'knife' },
  },
  medic: {
    label: 'Sıhhiye', hp: 100, speed: 1.05, primary: { blue: 'mp5', red: 'mp5' }, gadget: ['medkit', 3], desc: 'SMG, can paketi, yakındaki dostları iyileştirir',
    primaryOptions: ['mp5', 'vector', 'p90', 'ak74u', 'g36'],
    secondaryOptions: ['pistol', 'm1911', 'deagle', 'revolver', 'mac10'],
    gadgetOptions: ['medkit', 'smoke', 'flash', 'grenade'],
    meleeOptions: ['knife', 'machete', 'tomahawk'],
    defaults: { primary: { blue: 'mp5', red: 'mp5' }, secondary: 'pistol', gadget: 'medkit', melee: 'knife' },
  },
  sniper: {
    label: 'Keskin Nişancı', hp: 90, speed: 0.97, primary: { blue: 'sniper', red: 'sniper' }, gadget: ['grenade', 1], desc: 'Tek atış, uzun menzil dürbünü',
    primaryOptions: ['sniper', 'svd', 'barrett'],
    secondaryOptions: ['pistol', 'm1911', 'deagle', 'revolver', 'mac10'],
    gadgetOptions: ['grenade', 'smoke', 'claymore', 'medkit'],
    meleeOptions: ['knife', 'machete', 'tomahawk'],
    defaults: { primary: { blue: 'sniper', red: 'sniper' }, secondary: 'pistol', gadget: 'grenade', melee: 'knife' },
  },
  heavy: {
    label: 'Ağır Destek', hp: 150, speed: 0.9, primary: { blue: 'lmg', red: 'lmg' }, gadget: ['grenade', 1], desc: '100 mermilik LMG, fazla can',
    primaryOptions: ['lmg', 'pkm', 'scarh'],
    secondaryOptions: ['pistol', 'm1911', 'deagle', 'revolver', 'mac10'],
    gadgetOptions: ['grenade', 'ammobox', 'smoke', 'claymore', 'flash'],
    meleeOptions: ['knife', 'machete', 'tomahawk'],
    defaults: { primary: { blue: 'lmg', red: 'pkm' }, secondary: 'pistol', gadget: 'grenade', melee: 'knife' },
  },
  engineer: {
    label: 'Mühendis', hp: 100, speed: 1.0, primary: { blue: 'shotgun', red: 'shotgun' }, gadget: ['rpg', 2], desc: 'Pompalı + roketatar',
    primaryOptions: ['shotgun', 'aa12', 'dbl', 'ak74u'],
    secondaryOptions: ['pistol', 'm1911', 'deagle', 'revolver', 'mac10'],
    gadgetOptions: ['rpg', 'm79', 'claymore', 'ammobox'],
    meleeOptions: ['knife', 'machete', 'tomahawk'],
    defaults: { primary: { blue: 'shotgun', red: 'shotgun' }, secondary: 'pistol', gadget: 'rpg', melee: 'knife' },
  },
};

// Yükleme: ana silah / yedek / gadget / yakın dövüş. choice geçersiz ya da sınıfa uygun değilse varsayılan;
// choice.random=true ise (botlar) seçeneklerden rastgele.
export function makeLoadout(cls, team, choice = {}, rng = Math.random) {
  const def = CLASS_DEFS[cls], d = def.defaults;
  const pickOpt = (opts, want, dflt) => (choice.random ? opts[Math.floor(rng() * opts.length)] : opts.includes(want) ? want : dflt);
  const primary = pickOpt(def.primaryOptions, choice.primary, d.primary[team] || d.primary.blue);
  const secondary = pickOpt(def.secondaryOptions, choice.secondary, d.secondary);
  const gadget = pickOpt(def.gadgetOptions, choice.gadget, d.gadget);
  const melee = pickOpt(def.meleeOptions, choice.melee, d.melee);
  const gun = (id) => ({ id, mag: WSTATS[id].mag, reserve: WSTATS[id].reserve });
  const gs = WSTATS[gadget], n = gs.count || 1;
  const gi = gs.kind === 'launcher' ? { id: gadget, mag: 1, reserve: n - 1 } : { id: gadget, mag: n, reserve: 0 };
  return [gun(primary), gun(secondary), gi, { id: melee, mag: 1, reserve: 0 }];
}

export const DIFFICULTY = {
  easy: { label: 'Kolay', react: [0.7, 1.2], err: 0.075, turn: 3.6, burst: [2, 5], dmgMul: 0.8 },
  normal: { label: 'Normal', react: [0.4, 0.75], err: 0.04, turn: 5.2, burst: [3, 8], dmgMul: 1.0 },
  hard: { label: 'Zor', react: [0.2, 0.4], err: 0.02, turn: 7.5, burst: [4, 10], dmgMul: 1.0 },
};

export const BOT_NAMES = ['Kaan', 'Efe', 'Deniz', 'Mert', 'Ada', 'Ege', 'Can', 'Selin', 'Arda', 'Yağız', 'Barış', 'Ceren', 'Emre', 'Zeynep', 'Onur',
  'Tuna', 'Berk', 'Defne', 'Kerem', 'Ilgaz', 'Sarp', 'Duru', 'Alp', 'Ozan', 'Mina', 'Rüzgar', 'Çınar', 'Toprak', 'Bora', 'Aylin'];

// Nişangâhlar: zoom çarpanı, ADS arayüz örtüsü (none | dot | holo | scope)
export const OPTICS = {
  iron: { label: 'Demir Nişan', zoom: 1.15, overlay: 'none' },
  reddot: { label: 'Red Dot', zoom: 1.3, overlay: 'dot' },
  holo: { label: 'Holografik', zoom: 1.3, overlay: 'holo' },
  acog: { label: 'ACOG 3x', zoom: 3, overlay: 'scope', reticle: 'chevron' },
  scope: { label: '4x Dürbün', zoom: 4, overlay: 'scope', reticle: 'mil' },
  scope6: { label: '6x Dürbün', zoom: 6, overlay: 'scope', reticle: 'mil' },
};
export const OPTIC_ORDER = ['iron', 'reddot', 'holo', 'acog'];
export const OPTIC_ALLOWED = {
  ak47: ['iron', 'reddot', 'holo', 'acog'],
  m4a1: ['iron', 'reddot', 'holo', 'acog'],
  scarh: ['iron', 'reddot', 'holo', 'acog'],
  aug: ['iron', 'reddot', 'holo', 'acog'],
  g36: ['iron', 'reddot', 'holo', 'acog'],
  ak74u: ['iron', 'reddot', 'holo'],
  mp5: ['iron', 'reddot', 'holo', 'acog'],
  vector: ['iron', 'reddot', 'holo'],
  p90: ['iron', 'reddot', 'holo'],
  mac10: ['iron', 'reddot'],
  lmg: ['iron', 'reddot', 'holo', 'acog'],
  pkm: ['iron', 'reddot', 'holo'],
  shotgun: ['iron', 'reddot', 'holo'],
  aa12: ['iron', 'reddot', 'holo'],
  dbl: ['iron'],
  pistol: ['iron', 'reddot'],
  m1911: ['iron', 'reddot'],
  deagle: ['iron', 'reddot'],
  revolver: ['iron'],
  sniper: ['scope'],
  svd: ['acog'],
  barrett: ['scope6'],
  rpg: ['iron'],
  m79: ['iron'],
};
// Tercih edilen nişangâh o silahta yoksa en yakın uygun olana düşer
export function resolveOptic(id, pref = 'reddot') {
  const allowed = OPTIC_ALLOWED[id];
  if (!allowed) return null;
  if (allowed.includes(pref)) return pref;
  if (allowed.length === 1) return allowed[0];
  const i = OPTIC_ORDER.indexOf(pref);
  for (let d = 1; d < OPTIC_ORDER.length; d++) {
    for (const j of [i - d, i + d]) { const o = OPTIC_ORDER[j]; if (o && allowed.includes(o)) return o; }
  }
  return allowed[0];
}
