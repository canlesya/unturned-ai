// Silah ve sınıf verileri. Mesafe: metre, süre: saniye, açı: radyan.
// sight: ADS sırasında nişan noktası (silah yerelinde: x, y, z) · dist: gözden nişangaha mesafe.
// slot: primary|secondary|gadget|melee · stats: arayüz için 0-100 değerleri · reload: boş şarjörle tam süre
// (şarjörde mermi varsa "taktik reload" TAC_RELOAD çarpanıyla hızlanır) · shell: pompalı/çift namlu mermi başı süre
// reloadStyle: mag | shell | bolt · equip: silahı çekme süresi · tracer: iz mermisi rengi · adsTime: nişana geçiş süresi (sn; yoksa dürbün 1/6, diğerleri 1/9)

export const TAC_RELOAD = 0.65;

// Enfekte modu (zombi) denge değerleri — tek yerden ayarlanır
export const ZOMBIE = {
  respawn: 6,         // sn: zombi öldüğünde yeniden doğma süresi
  grace: 14,          // sn: maç başında zombiler donuk (insanlar yüksek bir yere çıkar)
  lives: 1,           // normal zombi: bu kadar kez ölünce insana döner
  bossCount: [1, 2],  // 16 kişiden azsa 1, 16 ve üstüyse 2 boss
  bossSplit: 16,
  horde: 0, hordeMax: 1,   // 12.196 sürü dayanıklılığı (game.hordeMul)
  spawnMin: 38,            // m: zombi en yakın insandan en az bu kadar uzakta doğar (görüşte doğmaz)
};
// Boss zombi: dev canlı, çok hızlı, kalıcı öfkeli (hız ×1.25 ve hasar ×1.4 pasif), hasarın %30'unu yok sayar; tek gücü Gölge Sıçrayışı (ışınlanma + kısa görünmezlik).
// Boss'un öldürdüğü insan NORMAL zombi olur. Boss 3 kez ölünce insana döner.
export const BOSS = {
  hp: 900, growth: 1.18, secondOffset: 7,   // can = hp × growth^(eşdeğer oyuncu − 10); 2 boss'ta eşdeğer = oyuncu − secondOffset
  speed: 1.2, dmg: 34, lives: 3, armor: 0.7, respawn: 9, scale: [1.6, 1.4, 1.6], jump: 1.35,       // scale = model (ve vuruş kutusu) ölçeği x/y/z · jump = zıplama çarpanı
  rageSpd: 1.25, rageDmg: 1.4,
};
export const ZBOSS = { label: 'BOSS', desc: 'Dev can, çok hızlı, öfkeli.', hp: 0, get speed() { return BOSS.speed; }, get dmg() { return BOSS.dmg; }, scale: 1.0, eye: '#ff2a1a', skin: '#8a5e55',
  ability: { id: 'shadow', label: 'Gölge Sıçrayışı', cd: 7, dur: 2, range: 15 } };
// 12.196: normal zombi canı ×1,6 ve pençesi güçlendi (Yürüyen 2 vuruşta öldürür), boss zayıfladı (can 1400→900, pençe 46→34) — boss tek başına maçı taşıyor, normal zombi yem gibiydi.
// Zombi türleri: can / hız çarpanı (insan 1.0) / pençe hasarı / model ölçeği / göz rengi / özel güç (tuş: F ya da sağ tık)
// Güçler: rage = hız+hasar artışı · burst = kısa süre çok hızlı koşu · shield = az hasar alma · cloak = görünmezlik (saldırınca/hasar alınca biter) · blink = ileri ışınlanma
export const ZTYPES = {
  walker:  { label: 'Yürüyen',   desc: 'Dengeli. Öfke: kısa süre hızlı ve ölümcül.',            hp: 300, speed: 1.24, dmg: 50, scale: 1.1, jump: 1.18,  eye: '#d6ff6a', skin: '#86a273', ability: { id: 'rage',   label: 'Öfke',          cd: 14, dur: 4 }, w: 30 },
  runner:  { label: 'Koşucu',    desc: 'Çok hızlı, kırılgan. Atılış: kısa süre inanılmaz hız.', hp: 220, speed: 1.45, dmg: 40, scale: 1.04, jump: 1.28, eye: '#ffd24a', skin: '#a3ad72', ability: { id: 'burst',  label: 'Atılış',        cd: 10, dur: 2.5 }, w: 25 },
  brute:   { label: 'Dev',       desc: 'Çok dayanıklı, ağır vurur. Zırh: hasarı büyük ölçüde azaltır.', hp: 700, speed: 1.1, dmg: 60, scale: 1.28, jump: 1.1, eye: '#ff5a3c', skin: '#7a8a68', ability: { id: 'shield', label: 'Zırh',          cd: 16, dur: 5 }, w: 15 },
  ghost:   { label: 'Hayalet',   desc: 'Görünmezlik: saldırana kadar kimse seni görmez.',        hp: 240, speed: 1.3, dmg: 42, scale: 1.12, jump: 1.18,  eye: '#7ad7ff', skin: '#93bcc6', ability: { id: 'cloak',  label: 'Görünmezlik',   cd: 16, dur: 6 }, w: 15 },
  blinker: { label: 'Işınlanan', desc: 'Işınlanma: baktığın yönde 14 m öteye sıçrar.',          hp: 270, speed: 1.27, dmg: 40, scale: 1.12, jump: 1.18,  eye: '#d58aff', skin: '#9c88b8', ability: { id: 'blink',  label: 'Işınlanma',     cd: 8,  dur: 0, range: 14 }, w: 15 },
};
export const ZT_ORDER = Object.keys(ZTYPES);
export function randomZType(rng = Math.random) {
  let r = rng() * ZT_ORDER.reduce((a, k) => a + ZTYPES[k].w, 0);
  for (const k of ZT_ORDER) { r -= ZTYPES[k].w; if (r <= 0) return k; }
  return 'walker';
}

export const WSTATS = {
  // ───────── Tüfekler ─────────
  ak47: {
    name: 'AK-47', kind: 'gun', slot: 'primary', desc: 'Yüksek hasarlı klasik tüfek, tepmesi güçlü.', stats: { dmg: 66, range: 70, rate: 62, control: 42, mobility: 66 },
    auto: true, dmg: 32, rpm: 650, mag: 30, reserve: 120, reload: 1.8, equip: 0.3,
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
    name: 'SCAR-H', kind: 'gun', slot: 'primary', desc: 'Ağır 7.62 tüfek: az mermi, çok hasar.', stats: { dmg: 76, range: 74, rate: 46, control: 38, mobility: 58 },
    auto: true, dmg: 36, rpm: 480, mag: 20, reserve: 100, reload: 1.9, equip: 0.32,
    hip: 0.009, ads: 0.001, kickV: 0.02, kickH: 0.007, range: [35, 120], minMul: 0.65, zoom: 1.4, move: 0.94,
    sight: [0, 0.135, -0.1], dist: 0.28, dot: true, sound: 'battle',
  },
  aug: {
    name: 'AUG', kind: 'gun', slot: 'primary', desc: 'Bullpup tüfek: kompakt, çok stabil.', stats: { dmg: 60, range: 74, rate: 68, control: 78, mobility: 68 },
    auto: true, dmg: 29, rpm: 700, mag: 30, reserve: 150, reload: 1.8, equip: 0.3,
    hip: 0.0075, ads: 0.0007, kickV: 0.0105, kickH: 0.004, range: [40, 120], minMul: 0.62, zoom: 1.5, move: 1.0,
    sight: [0, 0.125, -0.1], dist: 0.28, dot: true, sound: 'carbine',
  },
  g36: {
    name: 'G36', kind: 'gun', slot: 'primary', desc: 'Hafif ve isabetli, taşıma saplı tüfek.', stats: { dmg: 60, range: 78, rate: 64, control: 72, mobility: 68 },
    auto: true, dmg: 30, rpm: 680, mag: 30, reserve: 150, reload: 1.7, equip: 0.3,
    hip: 0.0075, ads: 0.0008, kickV: 0.0115, kickH: 0.0045, range: [45, 130], minMul: 0.62, zoom: 1.5, move: 1.0,
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
    name: 'MP5', kind: 'gun', slot: 'primary', desc: 'Dengeli SMG, yakın-orta mesafede çok etkili.', stats: { dmg: 50, range: 42, rate: 82, control: 66, mobility: 82 },
    auto: true, dmg: 25, rpm: 820, mag: 30, reserve: 150, reload: 1.5, equip: 0.28,
    hip: 0.0085, ads: 0.0014, kickV: 0.009, kickH: 0.0045, range: [20, 70], minMul: 0.5, zoom: 1.25, move: 1.05,
    sight: [0, 0.0845, -0.08], dist: 0.28, dot: true, sound: 'smg',
  },
  vector: {
    name: 'Vector', kind: 'gun', slot: 'primary', desc: 'Çok yüksek atış hızı; şarjör hızla erir.', stats: { dmg: 40, range: 34, rate: 100, control: 55, mobility: 84 },
    auto: true, dmg: 21, rpm: 1100, mag: 25, reserve: 125, reload: 1.4, equip: 0.28,
    hip: 0.009, ads: 0.0016, kickV: 0.007, kickH: 0.0045, range: [18, 60], minMul: 0.45, zoom: 1.25, move: 1.05,
    sight: [0, 0.09, -0.1], dist: 0.28, dot: true, sound: 'vector',
  },
  p90: {
    name: 'P90', kind: 'gun', slot: 'primary', desc: '50 mermilik şarjör, düşük tepme.', stats: { dmg: 40, range: 44, rate: 90, control: 80, mobility: 84 },
    auto: true, dmg: 20, rpm: 960, mag: 50, reserve: 150, reload: 1.8, equip: 0.28,
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
    name: 'Pompalı', kind: 'gun', slot: 'primary', desc: 'Klasik pompalı: yakın mesafede ölümcül.', stats: { dmg: 94, range: 18, rate: 14, control: 40, mobility: 66 },
    auto: false, dmg: 13, pellets: 9, rpm: 70, mag: 6, reserve: 30, reload: 2.7, reloadStyle: 'shell', shell: 0.45, equip: 0.32,
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
    name: 'Glock 17', kind: 'gun', slot: 'secondary', desc: 'Hafif, hızlı çekilen yedek silah.', stats: { dmg: 42, range: 32, rate: 62, control: 66, mobility: 95 },
    auto: false, dmg: 25, rpm: 420, mag: 15, reserve: 60, reload: 1.0, equip: 0.2,
    hip: 0.006, ads: 0.0016, kickV: 0.018, kickH: 0.004, range: [15, 55], minMul: 0.5, zoom: 1.2, move: 1.05,
    sight: [0, 0.0913, -0.02], dist: 0.28, dot: true, sound: 'pistol',
  },
  m1911: {
    name: 'M1911', kind: 'gun', slot: 'secondary', desc: '.45 klasik: daha sert vurur, şarjör küçük.', stats: { dmg: 56, range: 30, rate: 46, control: 60, mobility: 92 },
    auto: false, dmg: 34, rpm: 300, mag: 8, reserve: 48, reload: 1.0, equip: 0.2,
    hip: 0.006, ads: 0.0015, kickV: 0.022, kickH: 0.005, range: [14, 50], minMul: 0.5, zoom: 1.2, move: 1.05,
    sight: [0, 0.09, -0.02], dist: 0.28, dot: true, sound: 'pistol45',
  },
  deagle: {
    name: 'Desert Eagle', kind: 'gun', slot: 'secondary', desc: '.50 AE: 3 atışta öldürür, tepmesi sert.', stats: { dmg: 74, range: 52, rate: 38, control: 36, mobility: 88 },
    auto: false, dmg: 48, rpm: 200, mag: 7, reserve: 35, reload: 1.3, equip: 0.25,
    hip: 0.008, ads: 0.0012, kickV: 0.045, kickH: 0.008, range: [25, 80], minMul: 0.6, zoom: 1.2, move: 1.0,
    sight: [0, 0.098, -0.02], dist: 0.28, dot: true, sound: 'magnum',
  },
  revolver: {
    name: 'Revolver', kind: 'gun', slot: 'secondary', desc: '6 atış, ağır hasar; yavaş doldurulur.', stats: { dmg: 88, range: 48, rate: 26, control: 28, mobility: 88 },
    auto: false, dmg: 62, rpm: 110, mag: 6, reserve: 36, reload: 1.7, equip: 0.25,
    hip: 0.008, ads: 0.001, kickV: 0.06, kickH: 0.01, range: [20, 70], minMul: 0.65, zoom: 1.2, move: 1.0,
    sight: [0, 0.1, -0.02], dist: 0.28, dot: true, sound: 'revolver',
  },
  // ───────── Keskin nişancılar ─────────
  sniper: {
    name: 'M24 Keskin', kind: 'gun', slot: 'primary', desc: 'Sürgülü: gövdeye tek atış, 4x dürbün.', stats: { dmg: 100, range: 100, rate: 10, control: 60, mobility: 40 },
    auto: false, bolt: true, dmg: 105, rpm: 48, mag: 5, reserve: 25, reload: 2.2, reloadStyle: 'bolt', equip: 0.35,
    hip: 0.03, noscope: 0.09, ads: 0.0002, kickV: 0.05, kickH: 0.006, range: [150, 300], minMul: 0.85, zoom: 4, move: 0.9,
    sight: [0, 0.14, 0.12], dist: 0.06, sound: 'sniper', scope: true, tracer: '#cfe8ff', adsTime: 0.25,
  },
  svd: {
    name: 'SVD', kind: 'gun', slot: 'primary', desc: 'Yarı otomatik DMR: hızlı takip atışı, 3x dürbün.', stats: { dmg: 66, range: 88, rate: 32, control: 52, mobility: 50 },
    auto: false, dmg: 62, rpm: 220, mag: 10, reserve: 40, reload: 2.2, equip: 0.35,
    hip: 0.03, ads: 0.0005, kickV: 0.03, kickH: 0.005, range: [70, 220], minMul: 0.75, zoom: 3, move: 0.93,
    sight: [0, 0.12, -0.06], dist: 0.05, sound: 'dmr', tracer: '#ffe9a0', adsTime: 0.16,
  },
  barrett: {
    name: 'Barrett .50', kind: 'gun', slot: 'primary', desc: 'Anti-materyel: tek atışta kıyma, çok ağır.', stats: { dmg: 100, range: 100, rate: 9, control: 30, mobility: 26 },
    auto: false, dmg: 135, rpm: 60, mag: 5, reserve: 15, reload: 2.7, equip: 0.4,
    hip: 0.04, noscope: 0.11, ads: 0.0002, kickV: 0.085, kickH: 0.01, range: [180, 400], minMul: 0.9, zoom: 6, move: 0.8,
    sight: [0, 0.15, 0.1], dist: 0.06, sound: 'barrett', scope: true, tracer: '#ffd2a0', adsTime: 0.32,
  },
  // ───────── LMG ─────────
  lmg: {
    name: 'M249 LMG', kind: 'gun', slot: 'primary', desc: '100 mermi, bastırma ateşi.', stats: { dmg: 50, range: 62, rate: 72, control: 40, mobility: 36 },
    auto: true, dmg: 25, rpm: 720, mag: 100, reserve: 200, reload: 3.5, equip: 0.35,
    hip: 0.011, ads: 0.0028, kickV: 0.011, kickH: 0.008, range: [35, 100], minMul: 0.55, zoom: 1.3, move: 0.85,
    sight: [0, 0.138, -0.1], dist: 0.28, dot: true, sound: 'lmg', tracer: '#ff8a6a', adsTime: 0.2,
  },
  pkm: {
    name: 'PKM', kind: 'gun', slot: 'primary', desc: 'Ağır makineli: 7.62 mm, güçlü ama hantal.', stats: { dmg: 64, range: 70, rate: 62, control: 30, mobility: 30 },
    auto: true, dmg: 32, rpm: 650, mag: 100, reserve: 200, reload: 3.6, equip: 0.35,
    hip: 0.013, ads: 0.0032, kickV: 0.016, kickH: 0.01, range: [40, 120], minMul: 0.58, zoom: 1.3, move: 0.82,
    sight: [0, 0.14, -0.1], dist: 0.28, dot: true, sound: 'pkm', tracer: '#ff8a6a', adsTime: 0.22,
  },
  // ───────── Fırlatıcılar (gadget yuvası) ─────────
  rpg: {
    name: 'RPG-7', kind: 'launcher', slot: 'gadget', desc: 'Roketatar: araç ve bina için patlayıcı hasar.', stats: { dmg: 100, range: 80, rate: 8, control: 40, mobility: 40 },
    count: 2, auto: false, dmg: 160, radius: 7.5, speed: 38, rpm: 30, mag: 1, reserve: 2, reload: 2.8, equip: 0.35, armorMul: 1.3,      // 12.200 armorMul: zırhlı araca (tank) çarpan (OYUN.md 12.200) · 12.207 yarıçap 6,5 → 7,5 (askere öldürme ≤ 4,6 m)
    hip: 0.02, ads: 0.005, kickV: 0.06, kickH: 0.01, zoom: 1.4, move: 0.85,
    sight: [-0.045, 0.14, -0.05], dist: 0.38, sound: 'rpg',
  },
  m79: {
    name: 'M79 Bomba Atar', kind: 'launcher', slot: 'gadget', desc: 'Yaylı yoldan 40 mm bomba, çarpınca patlar.', stats: { dmg: 70, range: 55, rate: 10, control: 60, mobility: 55 },
    count: 6, auto: false, impact: true, dmg: 120, radius: 6, speed: 30, rpm: 40, mag: 1, reserve: 5, reload: 1.5, reloadStyle: 'break', equip: 0.3,
    hip: 0.02, ads: 0.006, kickV: 0.04, kickH: 0.008, zoom: 1.2, move: 0.95,
    sight: [0, 0.09, 0.02], dist: 0.3, sound: 'm79',
  },
  // ───────── Gadgetlar ─────────
  grenade: {
    name: 'El Bombası', kind: 'throwable', gtype: 'frag', slot: 'gadget', desc: 'Parça tesirli bomba, 5 sn fünye (PUBG). Basılı tut: yörünge · R: pimi çek (pişir) · sağ tık: üstten / alttan · G: hızlı at.', stats: { dmg: 80, range: 40, rate: 30, control: 50, mobility: 100 },
    count: 2, dmg: 150, lethal: 5, edge: 95, radius: 10, vehDmg: 60, vehR: 5, fuse: 5.0, cook: true, speed: 19, rpm: 40, mag: 2, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw',
  },
  smoke: {
    name: 'Dumanlı Bomba', kind: 'throwable', gtype: 'smoke', slot: 'gadget', desc: '30 sn yoğun duman perdesi (PUBG gibi uzun): görüşü tamamen keser.', stats: { dmg: 0, range: 40, rate: 30, control: 70, mobility: 100 },
    count: 2, radius: 6, fuse: 2.0, speed: 19, rpm: 40, mag: 2, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw', smokeLife: 30,
  },
  flash: {
    name: 'Flaşbang', kind: 'throwable', gtype: 'flash', slot: 'gadget', desc: 'Sersemletici (PUBG): 2,5 sn fünye ya da ilk değmeden 0,7 sn sonra. Bakanı 5,5 sn kör eder, yakındakini sağırlaştırır. R ile pişirilir.', stats: { dmg: 0, range: 40, rate: 30, control: 70, mobility: 100 },
    count: 2, radius: 20, near: 6.5, fuse: 2.5, impactFuse: 0.7, cook: true, speed: 19, rpm: 40, mag: 2, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw',
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
    swings: ['rl', 'lr'], swingT: 0.36, heavy: 'stab', heavyT: 0.62, heavyMul: 1.45,      // 12.194 CS2: sol tık sağ→sol / sol→sağ çapraz kesik (45), sağ tık ağır saplama (65 = CS2 ikincil), ikisi de arkadan tek vuruş
  },
  machete: {
    name: 'Satır', kind: 'melee', slot: 'melee', desc: 'Uzun menzil, ağır ve geniş savurma.', stats: { dmg: 62, range: 56, rate: 62, control: 70, mobility: 96 },
    dmg: 62, reach: 2.3, rpm: 100, mag: 1, reserve: 0, move: 1.05, equip: 0.26, sound: 'knife',
    swings: ['rl', 'lr'], swingT: 0.46, heavy: 'diag', heavyT: 0.78, heavyMul: 1.2,      // 12.194: sağ tık ağır çapraz iniş (74; 12.198 dengesiyle hasar 62)
  },
  claws: {
    name: 'Pençe', kind: 'melee', slot: 'melee', desc: 'Zombi pençesi: hızlı, kanlı darbeler.', stats: { dmg: 40, range: 40, rate: 85, control: 90, mobility: 100 },
    dmg: 32, reach: 2.3, rpm: 150, mag: 1, reserve: 0, move: 1.0, equip: 0.1, sound: 'knife',
    swings: ['rl', 'lr', 'stab'], swingT: 0.34, stabT: 0.4, stabMul: 1.25,
  },
  tomahawk: {
    name: 'Tomahawk', kind: 'melee', slot: 'melee', desc: 'Tepeden inen ağır darbe, kısa menzil.', stats: { dmg: 90, range: 32, rate: 50, control: 60, mobility: 98 },
    dmg: 90, reach: 1.9, rpm: 80, mag: 1, reserve: 0, move: 1.06, equip: 0.24, sound: 'knife',
    swings: ['rl', 'lr'], swingT: 0.5, heavy: 'chop', heavyT: 0.84, heavyMul: 1.05,      // 12.194: sol tık yatay kesikler, sağ tık tepeden ağır iniş (94,5; önden tek vuruş değil)
  },
  // ───────── Paintball (yalnız paintball modu: sınıf seçeneklerinde / silah yarışında yok) ─────────
  // ball: görünür boya topu (game/paint.js): speed m/sn, grav m/sn² (yaylı yol), life sn · head / legs: bölge çarpanı (TUNE.headMul yerine) · menzil düşüşü yok
  // rpm 610: 60 Hz adımda 6 adımda bir = tam 10 atış/sn (600'de bekleme 0,1 sn kayan nokta payıyla 7 adım sürüp 8,6/sn oluyordu)
  // Top sapması (Soldier.spreadNow, yalnız ball): hip / ads = doğal sapma (ilk top da hafif sapar) · bloom = top başına açılma, bloomMax tavan,
  // bloomRec = bırakınca toparlanma (rad/sn; 0,12 sn ateş edilmeyince başlar) → kısa seri ödüllenir. Nişan / çömelme / durma açılmayı küçültür.
  // zoom 1.15: hafif yakınlaştırma (dürbün hissi yok); adsLow: nişanda model sağ-altta, belden biraz yakın kalır (12.130: kameraya yapışıp ekrandan çıkmasın; hazne üstü ortanın altında), nişangâh HUD'da halka
  pbrifle: {
    name: 'Paintball Tüfeği', kind: 'gun', slot: 'primary', desc: 'Tam otomatik marker: saniyede 10 boya topu, yaylı yol.', stats: { dmg: 42, range: 46, rate: 84, control: 70, mobility: 80 },
    auto: true, ball: true, dmg: 18, head: 1.5, legs: 1, speed: 78, grav: 4, life: 3, rpm: 610, mag: 50, reserve: 150, reload: 2.6, equip: 0.3,
    hip: 0.016, ads: 0.005, bloom: 0.0035, bloomMax: 0.04, bloomRec: 0.08, kickV: 0.0045, kickH: 0.0025, range: [60, 90], minMul: 1, zoom: 1.15, move: 1.0,
    sight: [0, 0.204, 0.062], dist: 0.28, dot: true, sound: 'marker', adsLow: [0.12, -0.062, -0.163],
  },
  pbpistol: {
    name: 'Paintball Tabancası', kind: 'gun', slot: 'secondary', desc: 'Yarı otomatik: 3 isabette oyundan çıkarır, top daha çabuk düşer.', stats: { dmg: 70, range: 34, rate: 44, control: 70, mobility: 95 },
    auto: false, ball: true, dmg: 34, head: 1.5, legs: 1, speed: 66, grav: 6, life: 3, rpm: 300, mag: 12, reserve: 48, reload: 1.5, equip: 0.2,
    hip: 0.012, ads: 0.0045, bloom: 0.006, bloomMax: 0.03, bloomRec: 0.07, kickV: 0.012, kickH: 0.003, range: [45, 70], minMul: 1, zoom: 1.15, move: 1.05,
    sight: [0, 0.104, 0.03], dist: 0.28, dot: true, sound: 'pbpistol', adsLow: [0.11, -0.104, -0.172],
  },
};

export const BACKSTAB_DMG = 999;

// Sınıflar: hp, hız çarpanı ve ekipman. primary/gadget = eski alanlar (varsayılanlarla aynı)
// Bayrak kanaması aralığı (sn): bayrak farkı kadar rakip bileti bu sürede bir eksilir
export const BLEED_S = 8;

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
    label: 'Keskin Nişancı', hp: 100, speed: 0.97, primary: { blue: 'sniper', red: 'sniper' }, gadget: ['grenade', 1], desc: 'Tek atış, uzun menzil dürbünü',
    primaryOptions: ['sniper', 'svd', 'barrett'],
    secondaryOptions: ['pistol', 'm1911', 'deagle', 'revolver', 'mac10'],
    gadgetOptions: ['grenade', 'smoke', 'claymore', 'medkit'],
    meleeOptions: ['knife', 'machete', 'tomahawk'],
    defaults: { primary: { blue: 'sniper', red: 'sniper' }, secondary: 'pistol', gadget: 'grenade', melee: 'knife' },
  },
  heavy: {
    label: 'Ağır Destek', hp: 125, speed: 0.9, primary: { blue: 'lmg', red: 'lmg' }, gadget: ['grenade', 1], desc: '100 mermilik LMG, fazla can',
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
// 12.214 bot (choice.random) ana silah ağırlıkları: sınıf → { silah: ağırlık } (yazılmayan 1). Mühendis botu: AK-74U yarı yarıya, pompalılar (3 tür) diğer
// yarı — ölçüm: bütün pompalılar eşit olasılıkta iken mühendis botları Kasaba'da 2,4 / Çöl Geçidi TDM'de 4,9 leş (taarruz 9,3 / 7,9), tane başına isabet %2–4
export const BOT_PRIMARY_W = { engineer: { ak74u: 3 } };
export function makeLoadout(cls, team, choice = {}, rng = Math.random) {
  const def = CLASS_DEFS[cls], d = def.defaults;
  if (def.zombie) return [{ id: 'claws', mag: 1, reserve: 0 }];
  const pickOpt = (opts, want, dflt) => (choice.random ? opts[Math.floor(rng() * opts.length)] : opts.includes(want) ? want : dflt);
  const W = choice.random && BOT_PRIMARY_W[cls];
  const pickW = (opts) => { let t = 0; for (const o of opts) t += W[o] ?? 1; let r = rng() * t; for (const o of opts) { r -= W[o] ?? 1; if (r < 0) return o; } return opts[opts.length - 1]; };
  const primary = W ? pickW(def.primaryOptions) : pickOpt(def.primaryOptions, choice.primary, d.primary[team] || d.primary.blue);
  const secondary = pickOpt(def.secondaryOptions, choice.secondary, d.secondary);
  const gadget = pickOpt(def.gadgetOptions, choice.gadget, d.gadget);
  const melee = pickOpt(def.meleeOptions, choice.melee, d.melee);
  const gun = (id) => ({ id, mag: WSTATS[id].mag, reserve: WSTATS[id].reserve });
  const gs = WSTATS[gadget], n = gs.count || 1;
  const gi = gs.kind === 'launcher' ? { id: gadget, mag: 1, reserve: n - 1 } : { id: gadget, mag: n, reserve: 0 };
  return [gun(primary), gun(secondary), gi, { id: melee, mag: 1, reserve: 0 }];
}

// Zombi sınıfı: menüde/sınıf seçiminde görünmez (numaralandırılamaz), yalnızca enfekte olunca atanır. Tek silah: pençe.
Object.defineProperty(CLASS_DEFS, 'zombie', {
  enumerable: false,
  value: { label: 'Zombi', hp: 300, speed: 1.24, zombie: true, primary: { blue: 'claws', red: 'claws' }, gadget: ['claws', 0], desc: 'Pençeli enfekte',
    primaryOptions: ['claws'], secondaryOptions: [], gadgetOptions: [], meleeOptions: ['claws'], defaults: { primary: { blue: 'claws', red: 'claws' }, secondary: 'claws', gadget: 'claws', melee: 'claws' } },
});

// Silah Yarışı (Gun Game): her öldürmede bir sonraki silah; son seviye bıçak, o seviyede bir öldürme maçı kazandırır.
// Bıçakla öldürülen oyuncu bir seviye geriler. Eşyalar: [seviye silahı, bıçak] (4 yuvalı yükleme yok).
export const GG_LADDER = ['m4a1', 'ak47', 'mp5', 'shotgun', 'scarh', 'vector', 'svd', 'aug', 'aa12', 'p90', 'sniper', 'deagle', 'revolver', 'pistol', 'knife'];
export function ggItems(level) {
  const id = GG_LADDER[Math.max(0, Math.min(GG_LADDER.length - 1, level))], st = WSTATS[id];
  return st.kind === 'melee' ? [{ id, mag: 1, reserve: 0 }] : [{ id, mag: st.mag, reserve: st.reserve }, { id: 'knife', mag: 1, reserve: 0 }];      // son seviye: yalnızca bıçak
}

export const DIFFICULTY = {
  easy: { label: 'Kolay', react: [0.7, 1.2], err: 0.075, turn: 3.6, burst: [2, 5], dmgMul: 0.8 },
  normal: { label: 'Normal', react: [0.4, 0.75], err: 0.04, turn: 5.2, burst: [3, 8], dmgMul: 1.0 },
  hard: { label: 'Zor', react: [0.26, 0.45], err: 0.02, turn: 7.5, burst: [4, 10], dmgMul: 1.0 },
};

export const BOT_NAMES = ['Kaan', 'Efe', 'Deniz', 'Mert', 'Ada', 'Ege', 'Can', 'Selin', 'Arda', 'Yağız', 'Barış', 'Ceren', 'Emre', 'Zeynep', 'Onur',
  'Tuna', 'Berk', 'Defne', 'Kerem', 'Ilgaz', 'Sarp', 'Mehmet', 'Alp', 'Ozan', 'Mina', 'Rüzgar', 'Çınar', 'Toprak', 'Bora', 'Aylin'];

// 12.190 Nişangâhlar PUBG örneğiyle: 1× red dot / holo hafif yakınlaşır (×1,2), büyüten nişangâhlar gerçek büyütmede (2× / 3× / 4× ACOG / 6× / 8×). Büyütme hep TAM EKRAN
// dünya FOV'u (12.162 / 12.163: yakın / uzak eşit büyür, 3. şahıs kamera yaklaşmaz). overlay: none | dot | holo | lens (2× / 3× / 4×: saydam 3B mercek, göz yakın → mercek ekranın
// %46 / %54 / %62'si; dışı HUD'da bulanık + koyu, gövde halkası; retikül HUD'da ince SVG, merceği izler) | scope (6× / 8× / keskin nişancı dürbünleri: 12.153 kararma + dürbün örtüsü).
// reticle: x2 (nokta + kenardan dört ince direk) | x3 (ince artı + kırmızı nokta + düşüş çentikleri) | chev (ACOG şevronu + BDC merdiveni) | mil | post / post3 (12.174) · zoomMin: değişken
// büyütme (nişandayken fare tekerleği; PUBG 6× = 3–6×, 8× = 4–8×) · adsTime: nişana geçiş (sn; büyüdükçe yavaş, PUBG gibi). Eski ACOG ×1,5 taslakları (12.163 ACOG_DRAFTS) kalktı.
export const OPTICS = {
  iron: { label: 'Demir Nişan', zoom: 1.15, overlay: 'none' },
  reddot: { label: 'Red Dot', zoom: 1.2, overlay: 'dot' },
  holo: { label: 'Holografik', zoom: 1.2, overlay: 'holo' },
  acog: { label: '4× ACOG', zoom: 4, overlay: 'lens', reticle: 'chev', adsTime: 0.17 },      // 12.190: PUBG 4× ACOG (12.163'te ×1,5 + nokta). SVD'de PSO-1 (4×, aynı retikül)
  scope: { label: '4× Dürbün', zoom: 4, overlay: 'scope', reticle: 'mil' },
  scope6: { label: '6× Dürbün', zoom: 6, overlay: 'scope', reticle: 'mil' },
};
// Büyütme sırası (tercih edilen nişangâh silahta yoksa en yakın büyütmeli olana düşer)
export const OPTIC_ORDER = ['iron', 'reddot', 'holo', 'x2', 'x3', 'acog', 'scope', 'scope6', 'x6', 'x8'];
export const BOT_OPTICS = ['iron', 'reddot', 'holo', 'x2', 'acog'];      // botların rastgele nişangâhı (yalnız 3. şahıs görüntüsü; bot nişanı büyütme kullanmaz)
// 12.190 izinler (PUBG mantığı, sade): taarruz tüfekleri / M249 6×'e kadar, kısa tüfek / HMK / PKM 4× ACOG'a kadar, P90 / pompalı 2×'e kadar, tabanca yalnız red dot (RMR),
// keskin nişancı 4× (kendi) / 6× / 8×, Barrett 6× (kendi) / 8×, SVD 4× PSO-1 / 6× / 8×. Liste sırası = B ile dönüş sırası (büyütmeye göre).
const AR = ['iron', 'reddot', 'holo', 'x2', 'x3', 'acog', 'x6'], SMG = ['iron', 'reddot', 'holo', 'x2', 'x3', 'acog'], CQB = ['iron', 'reddot', 'holo', 'x2'];
export const OPTIC_ALLOWED = {
  ak47: AR, m4a1: AR, scarh: AR, aug: AR, g36: AR,
  ak74u: SMG, mp5: SMG, vector: SMG, p90: CQB,
  mac10: ['iron', 'reddot'],
  lmg: AR, pkm: SMG,
  shotgun: CQB, aa12: CQB,
  dbl: ['iron'],
  pistol: ['iron', 'reddot'],
  m1911: ['iron', 'reddot'],
  deagle: ['iron', 'reddot'],
  revolver: ['iron'],
  sniper: ['scope', 'x6', 'x8'],
  svd: ['acog', 'x6', 'x8'],
  barrett: ['scope6', 'x8'],
  rpg: ['iron'],
  m79: ['iron'],
  pbrifle: ['reddot'],
  pbpistol: ['iron', 'reddot'],
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

// Silah kaplamaları (12.122): yalnız S3 modelli silahlarda; kimlikler sunucu / istemci ortak (modeller src/models/skins.js). Paintball / pençe yok.
export const SKIN_IDS = ['std', 'desert', 'wood', 'urban', 'gold'];
export const SKIN_WEAPONS = ['ak47', 'm4a1', 'pistol', 'sniper', 'shotgun'];
SKIN_WEAPONS.push('knife', 'machete', 'tomahawk');      // s3items: yakın dövüş kaplamaları (atılan / kurulan eşyalar yalnız Standart)
// s3smg: ikinci tur S3 silahları (src/models/s3smg.js)
SKIN_WEAPONS.push('mp5', 'vector', 'p90', 'mac10', 'lmg', 'pkm', 'm1911', 'deagle', 'revolver', 'rpg');
SKIN_WEAPONS.push('scarh', 'aug', 'g36', 'ak74u', 'svd', 'barrett', 'aa12', 'dbl', 'm79');   // s3rifles
// Ağdan / profilden gelen kaplama seçimini temizle: bilinen silah → bilinen kaplama (std yazılmaz); geçersiz → null
export function cleanSkins(o) {
  if (!o || typeof o !== 'object') return null;
  const r = {};
  for (const w of SKIN_WEAPONS) if (typeof o[w] === 'string' && o[w] !== 'std' && SKIN_IDS.includes(o[w])) r[w] = o[w];
  return Object.keys(r).length ? r : null;
}

// ───────── 12.157 Uzay modu: enerji silahları + sınıf donanımı (yalnız Uzay modunda; sınıf seçeneklerinde / silah yarışında / diğer modlarda yok) ─────────
// Hepsi anlık isabet (hitscan) + renkli enerji izi (tracer); denge mevcut silahlarla benzer TTK (lazer ≈ M4, plazma ≈ Vector, tabanca ≈ Glock, ray tüfeği ≈ M24, dağıtıcı ≈ pompalı).
// Modeller src/models/s3space.js (S3 kiti, parlayan enerji parçaları), sesler src/game/spaceSfx.js (sound 'sp*').
Object.assign(WSTATS, {
  laser: {
    name: 'Lazer Tüfeği', kind: 'gun', slot: 'primary', desc: 'Otomatik lazer: düz, kontrollü atış, orta hasar.', stats: { dmg: 56, range: 74, rate: 74, control: 74, mobility: 70 },
    auto: true, dmg: 27, rpm: 760, mag: 32, reserve: 160, reload: 1.7, equip: 0.3,
    hip: 0.007, ads: 0.0008, kickV: 0.0105, kickH: 0.004, range: [45, 125], minMul: 0.64, zoom: 1.4, move: 1.0,
    sight: [0, 0.12, -0.1], dist: 0.28, dot: true, sound: 'splaser', tracer: '#45e6ff', space: true,
  },
  plasma: {
    name: 'Plazma SMG', kind: 'gun', slot: 'primary', desc: 'Çok yüksek atış hızı, kısa menzil: plazma topları yakında eritir.', stats: { dmg: 40, range: 32, rate: 98, control: 58, mobility: 86 },
    auto: true, dmg: 20, rpm: 1000, mag: 36, reserve: 180, reload: 1.5, equip: 0.27,
    hip: 0.0085, ads: 0.0017, kickV: 0.0075, kickH: 0.0048, range: [16, 55], minMul: 0.45, zoom: 1.25, move: 1.06,
    sight: [0, 0.1, -0.08], dist: 0.28, dot: true, sound: 'spplasma', tracer: '#c77bff', space: true,
  },
  epistol: {
    name: 'Enerji Tabancası', kind: 'gun', slot: 'secondary', desc: 'Yarı otomatik yan silah: hızlı çekilir, hücresi çabuk dolar.', stats: { dmg: 44, range: 36, rate: 62, control: 70, mobility: 95 },
    auto: false, dmg: 26, rpm: 420, mag: 14, reserve: 70, reload: 1.05, equip: 0.2,
    hip: 0.006, ads: 0.0015, kickV: 0.017, kickH: 0.004, range: [16, 58], minMul: 0.5, zoom: 1.2, move: 1.05,
    sight: [0, 0.09, -0.02], dist: 0.28, dot: true, sound: 'spistol', tracer: '#7dffb4', space: true,
  },
  railgun: {
    name: 'Ray Tüfeği', kind: 'gun', slot: 'primary', desc: 'Manyetik ray: gövdeye tek atış, 4x dürbün; her atıştan sonra yeniden şarj olur.', stats: { dmg: 100, range: 100, rate: 10, control: 62, mobility: 42 },
    auto: false, dmg: 110, rpm: 46, mag: 4, reserve: 20, reload: 2.3, equip: 0.35,
    hip: 0.03, ads: 0.0002, kickV: 0.05, kickH: 0.006, range: [150, 300], minMul: 0.85, zoom: 4, move: 0.9,
    sight: [0, 0.14, 0.12], dist: 0.06, sound: 'sprail', scope: true, noscope: 0.09, tracer: '#9fe2ff', adsTime: 0.25, space: true, charge: true,      // 12.156 kuralları: nefes / belden isabetsizlik / artısız bel (overlay 'scope')
  },
  scatter: {
    name: 'Dağıtıcı', kind: 'gun', slot: 'primary', desc: 'Enerji pompalısı: yakında geniş yelpaze, hücre şarjörüyle dolar.', stats: { dmg: 92, range: 18, rate: 18, control: 42, mobility: 68 },
    auto: false, dmg: 15, pellets: 8, rpm: 85, mag: 6, reserve: 30, reload: 2.2, equip: 0.32,
    hip: 0.048, ads: 0.031, kickV: 0.038, kickH: 0.01, range: [12, 30], minMul: 0.15, zoom: 1.15, move: 0.97,
    sight: [0, 0.09, -0.03], dist: 0.28, dot: true, sound: 'spscatter', tracer: '#ffb347', space: true,
  },
  elmg: {
    name: 'Enerji Makineli', kind: 'gun', slot: 'primary', desc: '90 atımlık güç hücresi, bastırma ateşi; uzun seride namlu kanatları kızarır.', stats: { dmg: 52, range: 66, rate: 74, control: 44, mobility: 38 },
    auto: true, dmg: 25, rpm: 720, mag: 90, reserve: 270, reload: 3.4, equip: 0.4,
    hip: 0.011, ads: 0.0014, kickV: 0.0105, kickH: 0.0055, range: [40, 110], minMul: 0.6, zoom: 1.35, move: 0.9,
    sight: [0, 0.128, -0.1], dist: 0.28, dot: true, sound: 'spelmg', tracer: '#ff6a3a', space: true, heat: true, adsTime: 0.2,
  },
});
Object.assign(OPTIC_ALLOWED, { laser: ['iron', 'reddot', 'holo', 'x2', 'acog'], plasma: ['iron', 'reddot', 'holo', 'x2'], epistol: ['iron', 'reddot'], railgun: ['scope'], scatter: ['iron', 'reddot', 'holo'], elmg: ['iron', 'reddot', 'holo', 'x2', 'acog'] });      // 12.190: 2× eklendi, ACOG artık 4×
export const SPACE_WEAPONS = ['laser', 'plasma', 'epistol', 'railgun', 'scatter', 'elmg'];
// Sınıf başına Uzay donanımı (gadget / yakın dövüş normal sınıftaki gibi)
export const SPACE_CLASS = {
  assault: { primary: ['laser', 'plasma'], secondary: ['epistol'], def: 'laser' },
  medic: { primary: ['plasma', 'laser'], secondary: ['epistol'], def: 'plasma' },
  sniper: { primary: ['railgun'], secondary: ['epistol'], def: 'railgun' },
  heavy: { primary: ['elmg', 'laser', 'scatter'], secondary: ['epistol'], def: 'elmg' },
  engineer: { primary: ['scatter', 'plasma'], secondary: ['epistol'], def: 'scatter' },
};
// Normal silah tercihini Uzay karşılığına çevir (menüde seçilen tür korunur): pompalı → dağıtıcı, dürbünlü → ray tüfeği, SMG → plazma, diğer → lazer
const spaceOf = (id) => (!WSTATS[id] ? null : WSTATS[id].space ? id : WSTATS[id].pellets ? 'scatter' : WSTATS[id].scope || id === 'svd' ? 'railgun' : id === 'lmg' || id === 'pkm' ? 'elmg' : ['mp5', 'vector', 'p90', 'mac10', 'ak74u'].includes(id) ? 'plasma' : 'laser');
export function spaceLoadout(cls, team, choice = {}, rng = Math.random) {
  const items = makeLoadout(cls, team, choice, rng);
  const S = SPACE_CLASS[cls];
  if (!S) return items;
  const gun = (id) => ({ id, mag: WSTATS[id].mag, reserve: WSTATS[id].reserve });
  const want = spaceOf(choice.primary);
  const p = choice.random ? S.primary[Math.floor(rng() * S.primary.length)] : S.primary.includes(want) ? want : S.def;
  items[0] = gun(p); items[1] = gun(S.secondary[0]);
  return items;
}
// ───────── 1940'lar silahları (Cephe modu, 12.158; yalnız bu modun sınıf donanımında — FRONT_KIT) ─────────
// Modeller src/models/ww2weapons.js. clip = şerit / en-bloc klips doldurma (anim.js), ping = son mermide klips fırlar (yarı otomatik).
Object.assign(WSTATS, {
  ww_bolt: {
    name: 'Sürgülü Tüfek', kind: 'gun', slot: 'primary', desc: 'Beş mermilik sürgülü piyade tüfeği: gövdeye iki, kafaya tek atış.', stats: { dmg: 92, range: 92, rate: 16, control: 58, mobility: 62 },
    auto: false, bolt: true, dmg: 74, rpm: 52, mag: 5, reserve: 45, reload: 2.5, reloadStyle: 'clip', equip: 0.32,
    hip: 0.026, ads: 0.0004, kickV: 0.04, kickH: 0.006, range: [110, 240], minMul: 0.82, zoom: 1.35, move: 0.96,
    sight: [0, 0.071, -0.277], dist: 0.56, sound: 'ww_bolt', tracer: '#e8dcc0', era: 'ww2',
  },
  ww_sniper: {
    name: 'Dürbünlü Tüfek', kind: 'gun', slot: 'primary', desc: 'Uzun eski tip dürbünlü sürgülü tüfek (4×).', stats: { dmg: 100, range: 100, rate: 12, control: 60, mobility: 50 },
    auto: false, bolt: true, dmg: 104, rpm: 46, mag: 5, reserve: 30, reload: 2.8, reloadStyle: 'clip', equip: 0.35,
    hip: 0.032, noscope: 0.09, ads: 0.0002, kickV: 0.05, kickH: 0.006, range: [150, 300], minMul: 0.85, zoom: 4, move: 0.92,
    sight: [0, 0.104, 0.115], dist: 0.042, sound: 'ww_bolt', scope: true, tracer: '#e8dcc0', adsTime: 0.26, era: 'ww2',
  },
  ww_semi: {
    name: 'Yarı Otomatik Tüfek', kind: 'gun', slot: 'primary', desc: 'Sekiz mermilik klipsle beslenir; son mermide klips "ping" diye fırlar.', stats: { dmg: 66, range: 78, rate: 44, control: 62, mobility: 64 },
    auto: false, dmg: 46, rpm: 330, mag: 8, reserve: 64, reload: 2.1, reloadStyle: 'clip', ping: true, equip: 0.32,
    hip: 0.016, ads: 0.0008, kickV: 0.024, kickH: 0.006, range: [60, 150], minMul: 0.72, zoom: 1.3, move: 0.97,
    sight: [0, 0.082, 0.062], dist: 0.286, sound: 'ww_semi', era: 'ww2',
  },
  ww_smgb: {
    name: 'Kundaklı HMK', kind: 'gun', slot: 'primary', desc: 'Ahşap kundaklı hafif makineli: ağır mermi, yakın mesafede sert.', stats: { dmg: 52, range: 36, rate: 76, control: 52, mobility: 80 },
    auto: true, dmg: 26, rpm: 680, mag: 30, reserve: 150, reload: 2.0, equip: 0.3,
    hip: 0.0095, ads: 0.0018, kickV: 0.012, kickH: 0.0065, range: [16, 55], minMul: 0.45, zoom: 1.2, move: 1.03,
    sight: [0, 0.084, 0.042], dist: 0.286, sound: 'ww_smgb', era: 'ww2',
  },
  ww_smgr: {
    name: 'Katlanır HMK', kind: 'gun', slot: 'primary', desc: 'Katlanır dipçikli hafif makineli: yavaş atış, kontrolü kolay.', stats: { dmg: 48, range: 40, rate: 68, control: 74, mobility: 84 },
    auto: true, dmg: 25, rpm: 600, mag: 32, reserve: 160, reload: 1.9, equip: 0.28,
    hip: 0.009, ads: 0.0015, kickV: 0.008, kickH: 0.004, range: [18, 62], minMul: 0.45, zoom: 1.2, move: 1.05,
    sight: [0, 0.083, 0.006], dist: 0.32, sound: 'ww_smgr', era: 'ww2',
  },
  ww_lmg: {
    name: 'Hafif Makineli Tüfek', kind: 'gun', slot: 'primary', desc: 'Çatallı ağır destek tüfeği: 20\'lik şarjör, güçlü mermi.', stats: { dmg: 74, range: 76, rate: 58, control: 40, mobility: 38 },
    auto: true, dmg: 38, rpm: 520, mag: 20, reserve: 140, reload: 2.4, equip: 0.4,
    hip: 0.012, ads: 0.0013, kickV: 0.017, kickH: 0.0075, range: [55, 140], minMul: 0.65, zoom: 1.3, move: 0.88,
    sight: [0, 0.098, 0.05], dist: 0.286, sound: 'ww_lmg', tracer: '#ff9a6a', era: 'ww2', adsTime: 0.2,
  },
  ww_mg: {
    name: 'Ağır Makineli', kind: 'gun', slot: 'primary', desc: 'Şeritli ağır makineli: çok yüksek atış hızı, 50\'lik tambur, sert tepme.', stats: { dmg: 54, range: 70, rate: 96, control: 28, mobility: 30 },
    auto: true, dmg: 24, rpm: 1150, mag: 50, reserve: 150, reload: 3.2, equip: 0.45,
    hip: 0.016, ads: 0.0022, kickV: 0.013, kickH: 0.009, range: [45, 130], minMul: 0.6, zoom: 1.3, move: 0.84,
    sight: [0, 0.094, -0.18], dist: 0.42, sound: 'ww_mg', tracer: '#ff8a5a', era: 'ww2', adsTime: 0.22,
  },
  ww_pistol: {
    name: 'Tabanca', kind: 'gun', slot: 'secondary', desc: 'Yedi mermilik subay tabancası.', stats: { dmg: 48, range: 30, rate: 54, control: 62, mobility: 94 },
    auto: false, dmg: 30, rpm: 360, mag: 7, reserve: 42, reload: 1.3, equip: 0.22,
    hip: 0.007, ads: 0.0018, kickV: 0.02, kickH: 0.005, range: [14, 48], minMul: 0.5, zoom: 1.2, move: 1.05,
    sight: [0, 0.084, 0.042], dist: 0.286, sound: 'ww_pistol', era: 'ww2',
  },
  ww_nade: {
    name: 'Saplı El Bombası', kind: 'throwable', gtype: 'frag', slot: 'gadget', desc: 'Uzun saplı el bombası: daha uzağa atılır, 5 sn fünye (R: pişir).', stats: { dmg: 80, range: 48, rate: 30, control: 50, mobility: 100 },
    count: 2, dmg: 150, lethal: 5, edge: 95, radius: 10, vehDmg: 60, vehR: 5, fuse: 5.0, cook: true, speed: 21, rpm: 40, mag: 2, reserve: 0, move: 1.0, equip: 0.3, sound: 'throw', era: 'ww2',
  },
});
// 12.174 Dönem nişangâhları (yalnız 1940'lar silahlarında; modern red dot / holo / ACOG yok). Liste sırası = B ile dönüş sırası, ilk öğe = varsayılan.
// ww_peep: diyoptr (halka delik) arka gez — gez çentiği yerine delik / ince "hayalet halka", aynı ×1,15, nişana %12 hızlı (adsK) · ww_scout: öne monteli 1,5× uzun göz
// mesafeli öncü dürbün (ACOG gibi tam ekran ×1,5 + saydam mercek, siyah dikey direk + ince yatay çizgi; örtü / kararma yok) · ww_sc25 / ww_sc4: dönem keskin nişancı
// dürbünleri (dürbün örtüsü 'scope' → 12.153 kararma, 12.156 nefes tutma, belden artı gizleme / belden isabetsizlik otomatik; üç direkli retikül 'post3')
Object.assign(OPTICS, {
  ww_peep: { label: 'Diyoptr Gez', zoom: 1.15, overlay: 'none', adsK: 1.12, era: 'ww2' },
  ww_scout: { label: '1,5× Öncü Dürbün', zoom: 1.5, touchZoom: 1.85, overlay: 'lens', reticle: 'post', era: 'ww2' },
  ww_sc25: { label: '2,5× Dürbün', zoom: 2.5, overlay: 'scope', reticle: 'post3', adsTime: 0.22, era: 'ww2' },
  ww_sc4: { label: '4× Dürbün', zoom: 4, overlay: 'scope', reticle: 'post3', adsTime: 0.26, era: 'ww2' },
});
// Makineli tüfeklere (BAR / MG42 tarzı) dürbün verilmedi: 1,5× bile hantal (bipodsuz seri atışta görüş kayar; dönemde de standart değildi) → demir / diyoptr
Object.assign(OPTIC_ALLOWED, {
  ww_bolt: ['iron', 'ww_peep', 'ww_scout', 'ww_sc25', 'ww_sc4'], ww_semi: ['iron', 'ww_peep', 'ww_scout', 'ww_sc25'], ww_sniper: ['ww_sc4', 'ww_sc25'],
  ww_smgb: ['iron', 'ww_peep'], ww_smgr: ['iron', 'ww_peep'], ww_lmg: ['iron', 'ww_peep'], ww_mg: ['iron', 'ww_peep'], ww_pistol: ['iron'],
});
// 12.190 yeni modern nişangâhlar (ağ kodu OPTIC_IDS = OPTICS sırası: yeni kimlikler SONA eklenir → eski istemci bilmediğini yok sayar)
Object.assign(OPTICS, {
  x2: { label: '2× Nişangâh', zoom: 2, overlay: 'lens', reticle: 'x2', adsTime: 0.13 },
  x3: { label: '3× Nişangâh', zoom: 3, overlay: 'lens', reticle: 'x3', adsTime: 0.15 },
  x6: { label: '6× Dürbün', zoom: 6, zoomMin: 3, overlay: 'scope', reticle: 'mil', adsTime: 0.22 },
  x8: { label: '8× Dürbün', zoom: 8, zoomMin: 4, overlay: 'scope', reticle: 'mil', adsTime: 0.27 },
});
// Ağdan / profilden gelen silah başına nişangâh tercihlerini temizle (silah → nişangâh; yalnız o silaha izinli nişangâh). 12.174'te yalnız 1940'lar silahlarıydı;
// 12.190: modern silahlar da silah başına (PUBG gibi her silahın kendi nişangâhı; genel `optic` tercihi yalnız seçilmemiş silahların varsayılanı). Kayıt anahtarı
// eski adıyla `frontOptics` (menü / profil), ağ alanı `fo` — eski kayıtlar aynen okunur.
export function cleanEraOptics(o) {
  if (!o || typeof o !== 'object') return {};
  const r = {};
  for (const [w, v] of Object.entries(o)) if (WSTATS[w] && typeof v === 'string' && OPTICS[v] && (OPTIC_ALLOWED[w] || []).includes(v)) r[w] = v;
  return r;
}
// Ağ kodu (12.174): nişangâh kimliği ↔ tek karakter (OPTICS sırası; yeni nişangâhlar hep sona eklenir → eski istemci bilmediğini yok sayar)
export const OPTIC_IDS = Object.keys(OPTICS);
// Cephe modunun sınıf donanımı (CLASS_DEFS'in yerine; mod dışında görünmez). d = takım varsayılanı (Mavi Garand / Thompson tarzı, Kırmızı sürgülü / MP40 tarzı)
export const FRONT_KIT = {
  assault: { primary: ['ww_semi', 'ww_bolt'], d: { blue: 'ww_semi', red: 'ww_semi' }, secondary: ['ww_pistol'], gadget: ['ww_nade', 'smoke'], melee: ['knife'] },
  medic: { primary: ['ww_smgb', 'ww_smgr'], d: { blue: 'ww_smgb', red: 'ww_smgr' }, secondary: ['ww_pistol'], gadget: ['medkit', 'smoke'], melee: ['knife'] },
  sniper: { primary: ['ww_sniper', 'ww_bolt'], d: { blue: 'ww_sniper', red: 'ww_sniper' }, secondary: ['ww_pistol'], gadget: ['ww_nade', 'smoke'], melee: ['knife'] },
  heavy: { primary: ['ww_lmg', 'ww_mg'], d: { blue: 'ww_lmg', red: 'ww_mg' }, secondary: ['ww_pistol'], gadget: ['ww_nade', 'ammobox'], melee: ['knife'] },
  engineer: { primary: ['ww_smgb', 'ww_smgr', 'ww_bolt'], d: { blue: 'ww_smgb', red: 'ww_smgr' }, secondary: ['ww_pistol'], gadget: ['ww_nade', 'ammobox'], melee: ['knife'] },
};
export const FRONT_TEAM = { ww_smgb: 'blue', ww_lmg: 'blue', ww_smgr: 'red', ww_mg: 'red' };
export function frontLoadout(cls, team, choice = {}, rng = Math.random) {
  const K = FRONT_KIT[cls] || FRONT_KIT.assault;
  if (!choice.random && choice.front && typeof choice.front === 'object') choice = choice.front;      // 12.174: Cephe donanımı ayrı tercih (menü → Cephanelik → Cephe); modern seçim bozulmaz
  const mine = (id) => !FRONT_TEAM[id] || FRONT_TEAM[id] === team;                       // botların rastgele seçimi takım kimliğini bozmasın (Kırmızı MG42 / katlanır HMK …)
  const opt = (list, want, dflt) => { if (!choice.random) return list.includes(want) ? want : dflt; const L = list.filter(mine); return L[Math.floor(rng() * L.length)] || dflt; };
  const primary = opt(K.primary, choice.primary, K.d[team] || K.d.blue), secondary = opt(K.secondary, choice.secondary, K.secondary[0]);
  const gadget = opt(K.gadget, choice.gadget, K.gadget[0]), melee = opt(K.melee, choice.melee, K.melee[0]);
  const gun = (id) => ({ id, mag: WSTATS[id].mag, reserve: WSTATS[id].reserve });
  const gs = WSTATS[gadget], n = gs.count || 1;
  return [gun(primary), gun(secondary), { id: gadget, mag: n, reserve: 0 }, { id: melee, mag: 1, reserve: 0 }];
}
// moda göre donanım (Cephe: FRONT_KIT, diğerleri CLASS_DEFS)
export const modeLoadout = (mode, cls, team, choice, rng) => (mode && mode.front && !CLASS_DEFS[cls]?.zombie ? frontLoadout(cls, team, choice, rng) : makeLoadout(cls, team, choice, rng));

// ───────── 12.164 Delip geçme (mermi askerin içinden geçer) ─────────
// pen[k] = (k+1). hedefe verilen hasar çarpanı (ilk hedef hep 1); dizinin boyu = bir merminin en çok vurabileceği asker sayısı.
// Her hedefte bölge (kafa / gövde / bacak) ve mesafe düşüşü ayrı hesaplanır; takım arkadaşı mermiyi kesmez, hasar almaz, hak harcamaz.
// Listede olmayan silahlar (tüfek, SMG, tabanca, pompalı, makineli, paintball) delmez: mermi ilk askerde durur.
export const PEN = {
  sniper: [1, 0.65, 0.4],          // M24: 105 → 68 → 42 (gövde)
  barrett: [1, 0.75, 0.5],         // Barrett .50 (anti-materyel, en güçlü): 135 → 101 → 68
  railgun: [1, 0.7, 0.45],         // Uzay Ray Tüfeği: 110 → 77 → 50
  ww_sniper: [1, 0.65, 0.4],       // Cephe Dürbünlü Tüfek: 104 → 68 → 42
  svd: [1, 0.5],                   // DMR: yalnız 1 kez deler, yarı hasar (62 → 31)
  ww_bolt: [1, 0.5],               // Cephe Sürgülü Tüfek (tam boy tüfek mermisi, DMR gibi): 74 → 37
};
for (const [id, p] of Object.entries(PEN)) if (WSTATS[id]) WSTATS[id].pen = p.slice();
