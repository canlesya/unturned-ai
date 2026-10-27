// Denge ayarları (admin paneli: admin.warbyte.io). Varsayılanlar koddaki nesnelerdir (WSTATS, CLASS_DEFS, ...);
// geçersiz kılmalar düz yol haritasıdır: { 'w.ak47.dmg': 36, 'tune.walkSpeed': 6, 'cls.heavy.defaults.primary.red': 'pkm' }.
// Yalnızca FIELDS listesindeki yollar değişebilir (sunucu ve panel aynı listeyle doğrular).
// Sunucuda her oda kendi sürümünü taşır (maç başında alınır); oda adımından önce useBalance ile etkin sürüm değişir.
import { WSTATS, CLASS_DEFS, DIFFICULTY, ZOMBIE, BOSS, ZTYPES, BACKSTAB_DMG, BLEED_S } from './stats.js';

// Eskiden fonksiyonların içinde sabit duran sayılar
export const TUNE = {
  walkSpeed: 5.6, sprintMul: 1.5, crouchMul: 0.52, proneMul: 0.27, jumpSpeed: 5.4, gravity: 15,
  spawnProtect: 2, firstProtect: 1, respawn: 5, respawnGG: 3, respawnPB: 3, botRespawnMin: 3.5, botRespawnMax: 6,
  pbAmmoRespawn: 20, pbHealthRespawn: 20, pbHeal: 40,                // paintball toplanabilir kutular (game/pickups.js): yeniden belirme (sn), can kutusunun verdiği can
  medicHeal: 2.5, medicRadius: 6, resupply: 0.12, reviveHp: 0.55,
  // 12.164 penWalls (0 / 1, varsayılan KAPALI): delen silah (stats.js PEN) en çok 1 ince levhadan (en ince boyutu ≤ penThick m; çit, tahta, sac) geçer, arkasında hasar × penWallMul
  headMul: 2.1, legMul: 0.8, woodMul: 0.65, penWalls: 0, penThick: 0.12, penWallMul: 0.6, backstab: BACKSTAB_DMG, selfBlast: 0.55,
  captureRate: 0.073, bleed: BLEED_S,
  // 12.191 captureRate 0,085 → 0,073: ele geçirme sayacı artık kare hızından bağımsız (game.updateMode); sunucudaki (60 Hz) eski etkin hız 0,085 × 6/7 ≈ 0,073 korunur
  sightDay: 130, sightSunset: 105, sightNight: 62,
  plSpeed: 1.0, plCrowd: 0.25, plRadius: 3.5, plBackDelay: 20, plBackSpeed: 0.35, plBonus: 120, plOverGrace: 1.5, plSupply: 0.08, plAtkRespawn: 1.0, plDefRespawn: 0.75,   // Vagon modu: taban hız (m/sn), ek iten başına +%, itme yarıçapı, geri kayma bekleme / hız, kontrol noktası süre ödülü, uzatma payı, vagon yanı ikmal, doğma süresi çarpanı (12.150: botlar vagonu gerçekten oynayınca saldıran 1,0 / savunan 0,75 — savunan doğuşu raydan uzak)
  spaceGrav: 0.36, spaceJump: 0.86, spaceAir: 3.4,                  // 12.157 Uzay modu: yer çekimi çarpanı (Dünya'nın ~1/3'ü), zıplama hızı çarpanı (zirve ≈ 2 m, havada ≈ 1,7 sn), havada yön denetimi (normal 2,2)
};
Object.assign(TUNE, { frCapMul: 0.25, frLean: 0, frHqMul: 0.7, frBleed: 1, frRespawn: 1.0, frStartLock: 25, frShiftLock: 10 });      // Cephe Hattı (12.161): ele geçirme hızı çarpanı, yeni etkin noktanın eski sahibine yatıklığı (çubuk), karargâh ele geçirme çarpanı, nokta farkı başına kanama, doğma süresi çarpanı (iki taraf aynı)
// Oyun modu sınırları (oda kurulumu + menü)
export const LIMITS = { maxPerTeam: 32, dmMax: 10, dmKills: 40, infMin: 4, infMax: 24, pbMin: 2, pbMax: 12, pbKills: 30, plTime: 300, time: 900 };

LIMITS.frTickets = 50;                                                  // Cephe: takım başına bilet, oyuncu başına (12v12 → 600; 12.161: iki takım da, bot maçlarında ≈ 12 dk)
const ROOTS = { tune: TUNE, mode: LIMITS, w: WSTATS, cls: CLASS_DEFS, diff: DIFFICULTY, zombie: ZOMBIE, boss: BOSS, zt: ZTYPES };

// ───────── Alan listesi (panelde gösterim + doğrulama) ─────────
// f(yol, etiket, min, max, adım, birim, ölçek?) — ölçek: panelde değer × ölçek gösterilir (0,017 → 17)
const f = (path, label, min, max, step = 1, unit = '', scale = 1) => ({ path, label, min, max, step, unit, scale });
const sel = (path, label, options) => ({ path, label, options });

const GUN_KINDS = { rifle: 'Tüfek', smg: 'SMG', shotgun: 'Pompalı', pistol: 'Tabanca', sniper: 'Keskin nişancı', lmg: 'Makineli', launcher: 'Roketatar', melee: 'Yakın dövüş', paint: 'Paintball' };
export const WEAPON_GROUPS = {
  rifle: ['ak47', 'm4a1', 'scarh', 'aug', 'g36', 'ak74u'],
  smg: ['mp5', 'vector', 'p90', 'mac10'],
  shotgun: ['shotgun', 'aa12', 'dbl'],
  pistol: ['pistol', 'm1911', 'deagle', 'revolver'],
  sniper: ['sniper', 'svd', 'barrett'],
  lmg: ['lmg', 'pkm'],
  launcher: ['rpg', 'm79'],
  melee: ['knife', 'machete', 'tomahawk'],
  paint: ['pbrifle', 'pbpistol'],
};
WEAPON_GROUPS.space = ['laser', 'plasma', 'epistol', 'railgun', 'scatter', 'elmg']; GUN_KINDS.space = 'Uzay (enerji)';     // 12.157: yalnız Uzay modunda kuşanılır
export const GROUP_LABELS = GUN_KINDS;
export const ITEM_IDS = ['medkit', 'grenade', 'smoke', 'flash', 'claymore', 'ammobox'];

function weaponFields(id) {
  const s = WSTATS[id], p = `w.${id}.`, out = [];
  if (!s) return out;
  if (s.kind === 'melee') {
    out.push(f(p + 'dmg', 'Hasar', 1, 300), f(p + 'reach', 'Erişim', 1, 4, 0.1, 'm'), f(p + 'rpm', 'Vuruş/dk', 20, 300), f(p + 'move', 'Hareket hızı', 0.5, 1.5, 0.01, '×'));
    if (s.heavy) out.push(f(p + 'heavyMul', 'Ağır vuruş (sağ tık) hasar çarpanı', 1, 3, 0.05, '×'), f(p + 'heavyT', 'Ağır vuruş süresi', 0.3, 1.5, 0.02, 'sn'));      // 12.194
    return out;
  }
  if (s.kind === 'launcher') {
    out.push(f(p + 'dmg', 'Hasar', 1, 400), f(p + 'radius', 'Patlama yarıçapı', 1, 15, 0.5, 'm'), f(p + 'speed', 'Mermi hızı', 5, 80, 1, 'm/sn'),
      f(p + 'count', 'Adet', 1, 12), f(p + 'reload', 'Doldurma', 0.3, 6, 0.1, 'sn'), f(p + 'move', 'Hareket hızı', 0.5, 1.5, 0.01, '×'));
    return out;
  }
  out.push(f(p + 'dmg', 'Hasar', 1, 300));
  if (s.ball) out.push(f(p + 'speed', 'Top hızı', 10, 150, 1, 'm/sn'), f(p + 'grav', 'Top düşüşü (yerçekimi)', 0, 30, 0.5, 'm/sn²'), f(p + 'head', 'Kafa çarpanı', 1, 4, 0.05, '×'), f(p + 'legs', 'Bacak çarpanı', 0.1, 1.5, 0.05, '×'),
    f(p + 'bloom', 'Seri atışta açılma (top başına)', 0, 20, 0.1, '', 1000), f(p + 'bloomMax', 'Açılma tavanı', 0, 80, 0.5, '', 1000), f(p + 'bloomRec', 'Açılma toparlanması', 0, 300, 1, '/sn', 1000));   // boya topu: menzil düşüşü yok
  if (s.pellets) out.push(f(p + 'pellets', 'Saçma sayısı', 1, 20));
  out.push(f(p + 'rpm', 'Atış/dk', 20, 1500, 10), f(p + 'mag', 'Şarjör', 1, 200), f(p + 'reserve', 'Yedek mermi', 0, 600));
  out.push(s.shell ? f(p + 'shell', 'Mermi başı doldurma', 0.1, 2, 0.05, 'sn') : f(p + 'reload', 'Doldurma', 0.3, 6, 0.1, 'sn'));
  out.push(
    f(p + 'kickV', 'Dikey sekme', 0, 100, 0.5, '', 1000), f(p + 'kickH', 'Yatay sekme', 0, 50, 0.5, '', 1000),
    f(p + 'hip', 'Belden saçılım', 0, 60, 0.5, '', 1000), f(p + 'ads', 'Nişanlı saçılım', 0, 20, 0.1, '', 1000),
    ...(s.ball ? [] : [f(p + 'range.0', 'Tam hasar menzili', 1, 300, 1, 'm'), f(p + 'range.1', 'En düşük hasar menzili', 2, 500, 1, 'm'), f(p + 'minMul', 'Uzakta hasar', 0.1, 1, 0.01, '×')]),
    f(p + 'move', 'Hareket hızı', 0.5, 1.5, 0.01, '×'),
  );
  if (s.pen) for (let k = 1; k < s.pen.length; k++) out.push(f(p + 'pen.' + k, `Delip geçme: ${k + 1}. hedef hasarı`, 0, 1, 0.05, '×'));     // 12.164 (0 = bu hedefe geçmez)
  return out;
}

function itemFields(id) {
  const p = `w.${id}.`;
  switch (id) {
    case 'medkit': return [f(p + 'heal', 'Verdiği can', 1, 200), f(p + 'count', 'Adet', 1, 10), f(p + 'useTime', 'Kullanma süresi', 0.2, 5, 0.1, 'sn')];
    case 'grenade': return [f(p + 'dmg', 'Hasar', 1, 400), f(p + 'radius', 'Patlama yarıçapı', 1, 15, 0.5, 'm'), f(p + 'lethal', 'Öldürücü yarıçap', 0, 8, 0.1, 'm'), f(p + 'fuse', 'Fitil', 0.5, 8, 0.1, 'sn'), f(p + 'speed', 'Atış hızı', 8, 30, 0.5, 'm/sn'), f(p + 'count', 'Adet', 1, 6)];
    case 'smoke': return [f(p + 'radius', 'Duman yarıçapı', 1, 12, 0.2, 'm'), f(p + 'smokeLife', 'Duman süresi', 2, 60, 1, 'sn'), f(p + 'count', 'Adet', 1, 6)];
    case 'flash': return [f(p + 'radius', 'Etki yarıçapı', 4, 50, 1, 'm'), f(p + 'count', 'Adet', 1, 6)];
    case 'claymore': return [f(p + 'dmg', 'Hasar', 1, 400), f(p + 'radius', 'Patlama yarıçapı', 1, 12, 0.5, 'm'), f(p + 'trigger', 'Tetik mesafesi', 1, 12, 0.5, 'm'), f(p + 'count', 'Adet', 1, 6)];
    case 'ammobox': return [f(p + 'radius', 'Etki yarıçapı', 1, 10, 0.2, 'm'), f(p + 'life', 'Ömür', 5, 120, 5, 'sn'), f(p + 'count', 'Adet', 1, 4)];
  }
  return [];
}

const CLASS_IDS = ['assault', 'medic', 'sniper', 'heavy', 'engineer'];
function classFields(c) {
  const d = CLASS_DEFS[c], p = `cls.${c}.`;
  return [
    f(p + 'hp', 'Can', 10, 500), f(p + 'speed', 'Hız çarpanı', 0.5, 1.6, 0.01, '×'),
    sel(p + 'defaults.primary.blue', 'Ana silah (mavi)', d.primaryOptions), sel(p + 'defaults.primary.red', 'Ana silah (kırmızı)', d.primaryOptions),
    sel(p + 'defaults.secondary', 'Yedek silah', d.secondaryOptions), sel(p + 'defaults.gadget', 'Ekipman', d.gadgetOptions), sel(p + 'defaults.melee', 'Yakın dövüş', d.meleeOptions),
  ];
}

// Paneldeki bölümler: her bölüm → öğeler (önizleme modeliyle) → alanlar
export function balanceSections() {
  const weapons = [];
  for (const [g, ids] of Object.entries(WEAPON_GROUPS)) for (const id of ids) if (WSTATS[id]) weapons.push({ id, name: WSTATS[id].name, group: g, preview: { kind: 'weapon', id }, fields: weaponFields(id) });
  return [
    { id: 'player', label: 'Oyuncu', icon: 'run', items: [
      { id: 'move', name: 'Hareket', preview: { kind: 'char', cls: 'assault' }, fields: [
        f('tune.walkSpeed', 'Yürüme hızı', 2, 12, 0.1, 'm/sn'), f('tune.sprintMul', 'Koşu çarpanı', 1, 2.5, 0.05, '×'), f('tune.crouchMul', 'Çömelme çarpanı', 0.2, 1, 0.01, '×'),
        f('tune.proneMul', 'Yüzüstü çarpanı', 0.1, 1, 0.01, '×'), f('tune.jumpSpeed', 'Zıplama gücü', 2, 12, 0.1), f('tune.gravity', 'Yerçekimi', 5, 40, 0.5)] },
      { id: 'life', name: 'Doğma ve can', preview: { kind: 'char', cls: 'medic' }, fields: [
        f('tune.spawnProtect', 'Doğma koruması', 0, 10, 0.5, 'sn'), f('tune.firstProtect', 'İlk doğma koruması', 0, 10, 0.5, 'sn'),
        f('tune.respawn', 'Yeniden doğma (oyuncu)', 0, 30, 0.5, 'sn'), f('tune.respawnGG', 'Yeniden doğma (silah yarışı)', 0, 30, 0.5, 'sn'), f('tune.respawnPB', 'Yeniden doğma (paintball)', 0, 30, 0.5, 'sn'),
        f('tune.botRespawnMin', 'Bot yeniden doğma (en az)', 0, 30, 0.5, 'sn'), f('tune.botRespawnMax', 'Bot yeniden doğma (en çok)', 0, 30, 0.5, 'sn'),
        f('tune.medicHeal', 'Sıhhiye aurası (0,5 sn başına)', 0, 20, 0.5, 'can'), f('tune.medicRadius', 'Sıhhiye aurası yarıçapı', 0, 20, 0.5, 'm'),
        f('tune.reviveHp', 'Diriltince can', 0.1, 1, 0.05, '×'), f('tune.resupply', 'Üste mermi yenileme (2 sn)', 0, 1, 0.01, '×')] },
    ] },
    { id: 'weapons', label: 'Silahlar', icon: 'crosshair', items: weapons },
    { id: 'items', label: 'Ekipman', icon: 'first-aid-kit', items: ITEM_IDS.map((id) => ({ id, name: WSTATS[id].name, preview: { kind: 'item', id }, fields: itemFields(id) })) },
    { id: 'damage', label: 'Hasar kuralları', icon: 'target', items: [
      { id: 'zones', name: 'Vuruş bölgeleri', preview: { kind: 'char', cls: 'heavy' }, fields: [
        f('tune.headMul', 'Kafa çarpanı', 1, 5, 0.05, '×'), f('tune.legMul', 'Bacak çarpanı', 0.1, 1.5, 0.05, '×'), f('tune.woodMul', 'Tahtadan geçen hasar', 0, 1, 0.05, '×'),
        f('tune.penWalls', 'Delen silah ince duvardan geçer (0 kapalı, 1 açık)', 0, 1, 1), f('tune.penThick', 'İnce duvar en çok kalınlığı', 0.05, 0.5, 0.01, 'm'), f('tune.penWallMul', 'İnce duvardan geçen hasar', 0, 1, 0.05, '×'),
        f('tune.backstab', 'Arkadan bıçak hasarı', 1, 999), f('tune.selfBlast', 'Kendi patlamandan hasar', 0, 1, 0.05, '×')] },
    ] },
    { id: 'classes', label: 'Sınıflar', icon: 'users', items: CLASS_IDS.map((c) => ({ id: c, name: CLASS_DEFS[c].label, preview: { kind: 'char', cls: c }, fields: classFields(c) })) },
    { id: 'modes', label: 'Oyun modları', icon: 'flag', items: [
      { id: 'limits', name: 'Mod sınırları', preview: { kind: 'icon', icon: 'flag' }, fields: [
        f('mode.maxPerTeam', 'Takım başına en çok oyuncu', 1, 32), f('mode.dmMax', 'Ölüm maçı / silah yarışı en çok', 2, 16),
        f('mode.dmKills', 'Ölüm maçı öldürme hedefi', 5, 200), f('mode.infMin', 'Enfekte en az oyuncu', 2, 24, 2), f('mode.infMax', 'Enfekte en çok oyuncu', 4, 32, 2),
        f('mode.pbKills', 'Paintball eleme hedefi', 5, 200), f('mode.pbMin', 'Paintball en az oyuncu', 2, 12), f('mode.pbMax', 'Paintball en çok oyuncu', 2, 16),
        f('mode.time', 'Varsayılan maç süresi', 60, 3600, 30, 'sn'), f('tune.captureRate', 'Bayrak ele geçirme hızı', 0.01, 0.5, 0.001), f('tune.bleed', 'Bilet kanaması aralığı', 1, 60, 1, 'sn')] },
      { id: 'pbpickups', name: 'Paintball kutuları', preview: { kind: 'icon', icon: 'first-aid-kit' }, fields: [
        f('tune.pbAmmoRespawn', 'Boya topu kutusu yeniden belirme', 3, 120, 1, 'sn'), f('tune.pbHealthRespawn', 'Can kutusu yeniden belirme', 3, 120, 1, 'sn'), f('tune.pbHeal', 'Can kutusunun verdiği can', 5, 100, 5, 'can')] },
      { id: 'payload', name: 'Vagon', preview: { kind: 'icon', icon: 'flag' }, fields: [
        f('mode.plTime', 'Saldırı ilk süresi', 60, 1800, 30, 'sn'), f('tune.plBonus', 'Kontrol noktası süre ödülü', 0, 600, 10, 'sn'),
        f('tune.plSpeed', 'Vagon taban hızı (1 kişi)', 0.2, 4, 0.05, 'm/sn'), f('tune.plCrowd', 'Ek iten başına hız', 0, 1, 0.05, '×'), f('tune.plRadius', 'İtme yarıçapı', 1.5, 8, 0.1, 'm'),
        f('tune.plBackDelay', 'Geri kayma bekleme', 0, 60, 1, 'sn'), f('tune.plBackSpeed', 'Geri kayma hızı', 0, 3, 0.05, 'm/sn'), f('tune.plOverGrace', 'Uzatma payı', 0, 10, 0.5, 'sn'), f('tune.plSupply', 'Vagon yanı ikmal (2 sn)', 0, 1, 0.01, '×'), f('tune.plAtkRespawn', 'Saldıran doğma süresi çarpanı', 0.2, 3, 0.05, '×'), f('tune.plDefRespawn', 'Savunan doğma süresi çarpanı', 0.2, 3, 0.05, '×')] },
      { id: 'space', name: 'Uzay', preview: { kind: 'icon', icon: 'planet' }, fields: [      // 12.157
        f('tune.spaceGrav', 'Yer çekimi çarpanı', 0.1, 1, 0.01, '×'), f('tune.spaceJump', 'Zıplama hızı çarpanı', 0.5, 1.5, 0.01, '×'), f('tune.spaceAir', 'Havada yön denetimi', 0.5, 10, 0.1)] },
      { id: 'front', name: 'Cephe', preview: { kind: 'icon', icon: 'flag' }, fields: [
        f('mode.frTickets', 'Takım bileti (oyuncu başına)', 2, 40), f('tune.frCapMul', 'Ele geçirme hızı çarpanı', 0.1, 4, 0.05, '×'), f('tune.frLean', 'Yeni etkin noktada eski sahibin payı', 0, 0.9, 0.05),
        f('tune.frHqMul', 'Karargâh ele geçirme çarpanı', 0.1, 2, 0.05, '×'), f('tune.frBleed', 'Nokta farkı başına kanama', 0, 5, 0.25), f('tune.frRespawn', 'Doğma süresi çarpanı', 0.2, 3, 0.05, '×'),
        f('tune.frStartLock', 'Başta ORTA kilidi', 0, 120, 1, 'sn'), f('tune.frShiftLock', 'Cephe kayınca kilit', 0, 60, 1, 'sn')] },
    ] },
    { id: 'bots', label: 'Botlar', icon: 'robot', items: [
      ...Object.keys(DIFFICULTY).map((k) => ({ id: k, name: DIFFICULTY[k].label + ' bot', preview: { kind: 'char', cls: 'assault', team: 'red' }, fields: [
        f(`diff.${k}.react.0`, 'Tepki süresi (en az)', 0, 3, 0.05, 'sn'), f(`diff.${k}.react.1`, 'Tepki süresi (en çok)', 0, 3, 0.05, 'sn'),
        f(`diff.${k}.err`, 'Nişan hatası', 0, 200, 1, '', 1000), f(`diff.${k}.turn`, 'Dönüş hızı', 0.5, 20, 0.1), f(`diff.${k}.dmgMul`, 'Hasar çarpanı', 0.1, 3, 0.05, '×')] })),
      { id: 'sight', name: 'Görüş mesafesi', preview: { kind: 'icon', icon: 'eye' }, fields: [
        f('tune.sightDay', 'Gündüz', 10, 400, 5, 'm'), f('tune.sightSunset', 'Gün batımı', 10, 400, 5, 'm'), f('tune.sightNight', 'Gece', 10, 400, 5, 'm')] },
    ] },
    { id: 'infection', label: 'Enfeksiyon', icon: 'skull', items: [
      { id: 'boss', name: 'Boss zombi', preview: { kind: 'zombie', zt: 'boss' }, fields: [
        f('boss.hp', 'Can', 100, 10000, 50), f('boss.dmg', 'Hasar', 1, 300), f('boss.speed', 'Hız çarpanı', 0.5, 2.5, 0.01, '×'),
        f('boss.armor', 'Aldığı hasar', 0.1, 1, 0.05, '×'), f('boss.lives', 'Can hakkı', 1, 10), f('boss.respawn', 'Yeniden doğma', 1, 30, 0.5, 'sn')] },
      ...Object.keys(ZTYPES).map((k) => ({ id: k, name: ZTYPES[k].label, preview: { kind: 'zombie', zt: k }, fields: [
        f(`zt.${k}.hp`, 'Can', 10, 2000, 5), f(`zt.${k}.speed`, 'Hız çarpanı', 0.5, 2.5, 0.01, '×'), f(`zt.${k}.dmg`, 'Hasar', 1, 300)] })),
      { id: 'rules', name: 'Kurallar', preview: { kind: 'icon', icon: 'skull' }, fields: [
        f('zombie.respawn', 'Zombi yeniden doğma', 1, 30, 0.5, 'sn'), f('zombie.grace', 'Başlangıç bekleme', 0, 60, 1, 'sn'), f('zombie.lives', 'Zombi can hakkı', 1, 10),
        f('zombie.horde', 'Sürü dayanıklılığı (insan/zombi oranı başına can)', 0, 1, 0.01, '×'), f('zombie.hordeMax', 'Sürü can çarpanı üst sınırı', 1, 4, 0.05, '×'), f('zombie.spawnMin', 'Zombi doğuşu insandan en az', 10, 80, 1, 'm')] },
    ] },
  ];
}

export function allFields() { return balanceSections().flatMap((s) => s.items.flatMap((i) => i.fields)); }

// ───────── Yol okuma / yazma ─────────
function getPath(path) {
  const parts = path.split('.');
  let o = ROOTS[parts[0]];
  for (let i = 1; i < parts.length && o != null; i++) o = o[parts[i]];
  return o;
}
function setPath(path, v) {
  const parts = path.split('.');
  let o = ROOTS[parts[0]];
  for (let i = 1; i < parts.length - 1 && o != null; i++) o = o[parts[i]];
  if (o != null) o[parts[parts.length - 1]] = v;
}

let DEFAULTS = null;            // { yol: varsayılan değer } — ilk çağrıda koddaki değerlerden alınır
export function defaults() {
  if (!DEFAULTS) { DEFAULTS = {}; for (const fd of allFields()) DEFAULTS[fd.path] = getPath(fd.path); }
  return DEFAULTS;
}

// Geçersiz kılmayı doğrula: bilinmeyen yol / aralık dışı / listede olmayan seçim atılır. Çıktı: temiz harita
export function sanitizeBalance(ov) {
  const out = {};
  if (!ov || typeof ov !== 'object') return out;
  const byPath = new Map(allFields().map((fd) => [fd.path, fd]));
  for (const [k, v] of Object.entries(ov)) {
    const fd = byPath.get(k);
    if (!fd) continue;
    if (fd.options) { if (fd.options.includes(v)) out[k] = v; continue; }
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[k] = Math.max(fd.min / fd.scale, Math.min(fd.max / fd.scale, v));
  }
  return out;
}

// Etkin sürüm: aynı nesne yeniden verilirse hiçbir şey yapılmaz (sunucuda her oda adımında çağrılır)
let active = null;
export function useBalance(ov) {
  if (ov === active) return;
  const d = defaults();
  for (const k in d) {
    const v = ov && k in ov ? ov[k] : d[k];
    if (getPath(k) !== v) setPath(k, v);
  }
  active = ov;
}

// İstemci: sunucudaki son ayarlar (çevrimdışı maçlar için). Oda katılımında welcome.bal kullanılır.
export let latestBalance = null;
export async function fetchBalance(base) {
  try {
    const c = new AbortController(), tm = setTimeout(() => c.abort(), 2000);
    const r = await fetch(base + '/balance', { signal: c.signal, cache: 'no-store' });
    clearTimeout(tm);
    if (r.ok) latestBalance = sanitizeBalance(await r.json());
  } catch (e) { /* sunucu yok: koddaki varsayılanlar */ }
  return latestBalance;
}
