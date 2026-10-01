// Silah ve sınıf verileri. Mesafe: metre, süre: saniye, açı: radyan.
// sight: ADS sırasında nişan noktası (silah yerelinde: x, y, z) · dist: gözden nişangaha mesafe.

export const WSTATS = {
  ak47: {
    name: 'AK-47', kind: 'gun', auto: true, dmg: 34, rpm: 600, mag: 30, reserve: 120, reload: 2.5,
    hip: 0.0085, ads: 0.0012, kickV: 0.017, kickH: 0.006, range: [35, 110], minMul: 0.6, zoom: 1.25, move: 0.95,
    sight: [0, 0.117, -0.1], dist: 0.28, dot: true, sound: 'rifle',
  },
  m4a1: {
    name: 'M4A1', kind: 'gun', auto: true, dmg: 28, rpm: 750, mag: 30, reserve: 150, reload: 2.2,
    hip: 0.007, ads: 0.0008, kickV: 0.012, kickH: 0.0045, range: [40, 120], minMul: 0.62, zoom: 1.5, move: 1.0,
    sight: [0, 0.1165, -0.14], dist: 0.28, dot: true, sound: 'rifle',
  },
  mp5: {
    name: 'MP5', kind: 'gun', auto: true, dmg: 22, rpm: 820, mag: 30, reserve: 150, reload: 2.0,
    hip: 0.0085, ads: 0.0014, kickV: 0.009, kickH: 0.0045, range: [20, 70], minMul: 0.5, zoom: 1.25, move: 1.05,
    sight: [0, 0.0845, -0.08], dist: 0.28, dot: true, sound: 'smg',
  },
  pistol: {
    name: 'Glock 17', kind: 'gun', auto: false, dmg: 24, rpm: 420, mag: 15, reserve: 60, reload: 1.5,
    hip: 0.006, ads: 0.0016, kickV: 0.018, kickH: 0.004, range: [15, 55], minMul: 0.5, zoom: 1.2, move: 1.05,
    sight: [0, 0.0913, -0.02], dist: 0.28, dot: true, sound: 'pistol',
  },
  shotgun: {
    name: 'Pompalı', kind: 'gun', auto: false, dmg: 11, pellets: 9, rpm: 70, mag: 6, reserve: 30, reload: 3.0,
    hip: 0.05, ads: 0.032, kickV: 0.04, kickH: 0.01, range: [12, 32], minMul: 0.15, zoom: 1.15, move: 0.97,
    sight: [0, 0.0845, -0.03], dist: 0.28, dot: true, sound: 'shotgun',
  },
  sniper: {
    name: 'M24 Keskin', kind: 'gun', auto: false, bolt: true, dmg: 105, rpm: 48, mag: 5, reserve: 25, reload: 3.4,
    hip: 0.03, ads: 0.0002, kickV: 0.05, kickH: 0.006, range: [150, 300], minMul: 0.85, zoom: 4, move: 0.9,
    sight: [0, 0.14, 0.12], dist: 0.06, sound: 'sniper', scope: true,
  },
  lmg: {
    name: 'M249 LMG', kind: 'gun', auto: true, dmg: 25, rpm: 720, mag: 100, reserve: 200, reload: 5.2,
    hip: 0.011, ads: 0.0028, kickV: 0.011, kickH: 0.008, range: [35, 100], minMul: 0.55, zoom: 1.3, move: 0.85,
    sight: [0, 0.138, -0.1], dist: 0.28, dot: true, sound: 'lmg',
  },
  rpg: {
    name: 'RPG-7', kind: 'launcher', auto: false, dmg: 160, radius: 6.5, speed: 38, rpm: 30, mag: 1, reserve: 2, reload: 3.4,
    hip: 0.02, ads: 0.005, kickV: 0.06, kickH: 0.01, zoom: 1.4, move: 0.85,
    sight: [-0.045, 0.14, -0.05], dist: 0.34, sound: 'rpg',
  },
  grenade: { name: 'El Bombası', kind: 'throwable', dmg: 130, radius: 6, fuse: 2.6, speed: 15, rpm: 40, mag: 2, reserve: 0, move: 1.0, sound: 'throw' },
  medkit: { name: 'İlk Yardım', kind: 'medkit', heal: 60, rpm: 30, mag: 3, reserve: 0, move: 1.0, useTime: 1.4, sound: 'reload' },
  knife: { name: 'Bıçak', kind: 'melee', dmg: 60, reach: 2.1, rpm: 90, mag: 1, reserve: 0, move: 1.08, sound: 'knife' },
};

// Sınıflar: hp, hız çarpanı ve ekipman (primary takıma göre değişebilir)
export const CLASS_DEFS = {
  assault: { label: 'Saldırı', hp: 100, speed: 1.0, primary: { blue: 'm4a1', red: 'ak47' }, gadget: ['grenade', 2], desc: 'Dengeli tüfek + 2 el bombası' },
  medic: { label: 'Sıhhiye', hp: 100, speed: 1.05, primary: { blue: 'mp5', red: 'mp5' }, gadget: ['medkit', 3], desc: 'SMG, can paketi, yakındaki dostları iyileştirir' },
  sniper: { label: 'Keskin Nişancı', hp: 90, speed: 0.97, primary: { blue: 'sniper', red: 'sniper' }, gadget: ['grenade', 1], desc: 'Tek atış, 4x dürbün' },
  heavy: { label: 'Ağır Destek', hp: 150, speed: 0.9, primary: { blue: 'lmg', red: 'lmg' }, gadget: ['grenade', 1], desc: '100 mermilik LMG, fazla can' },
  engineer: { label: 'Mühendis', hp: 100, speed: 1.0, primary: { blue: 'shotgun', red: 'shotgun' }, gadget: ['rpg', 2], desc: 'Pompalı + roketatar' },
};

export const MODES = {
  '3v3': { label: '3v3 · Hızlı Maç', perTeam: 3, tickets: 60, objectives: ['evler', 'kavsak', 'pazar'], time: 600 },
  '10v10': { label: '10v10 · Büyük Savaş', perTeam: 10, tickets: 200, objectives: ['evler', 'kilise', 'kavsak', 'benzinlik', 'pazar'], time: 900 },
};

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
};
export const OPTIC_ORDER = ['iron', 'reddot', 'holo', 'acog'];
export const OPTIC_ALLOWED = {
  ak47: ['iron', 'reddot', 'holo', 'acog'],
  m4a1: ['iron', 'reddot', 'holo', 'acog'],
  mp5: ['iron', 'reddot', 'holo', 'acog'],
  lmg: ['iron', 'reddot', 'holo', 'acog'],
  shotgun: ['iron', 'reddot', 'holo'],
  pistol: ['iron', 'reddot'],
  sniper: ['scope'],
  rpg: ['iron'],
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
