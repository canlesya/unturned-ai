// Ortak veri adları (harita / mod / sınıf / silah / zorluk / nişangâh / gün saati / hava / tuş eylemi) tr + en; menü, HUD, maç sonu hepsi buradan okur.
// Yardımcılar: mapName(id) · mapTag · mapDesc · modeLabel(type) · modeDesc · modeTag · className(id) · classDesc · weaponName(id) · weaponDesc · diffLabel · opticLabel · todLabel · weatherLabel · actionLabel · groupLabel · keyName(code)
// Türkçe metin sözlükte yoksa kaynağındaki veriden gelir (MATCH_TYPES / CLASS_DEFS / WSTATS …): tek doğruluk kaynağı bozulmaz; harita metinleri maps/index.js'i (ağır kurucular) çekmemek için burada.
import { addStrings, t } from './index.js';
import { WSTATS, CLASS_DEFS, DIFFICULTY, OPTICS, ZTYPES } from '../game/stats.js';
import { MATCH_TYPES, TODS_LIST } from '../game/match.js';
import { WEATHERS } from '../game/weather.js';
import { LIMITS } from '../game/balance.js';
import { ACTIONS, GROUPS, codeLabel } from '../core/keybinds.js';

addStrings('tr', {
  'map.kasaba.name': 'Kasaba', 'map.kasaba.tag': 'Büyük · karışık mesafe',
  'map.kasaba.desc': 'Taş duvarlı iki spawn avlusu, ortada çeşmeli meydan. Su kulesi ve kilise çan kulesi nişancı yuvaları; 2-3 katlı dolu evler, bahçe duvarları ve ara sokaklarla bina içi çatışma.',
  'map.vadi.name': 'Vadi', 'map.vadi.tag': 'Büyük · uzun mesafe',
  'map.vadi.desc': 'Nehirli vadi: tek köprü ve iki sığ geçit, ormanlı sırtlar. Keskin nişancılar için yamaçlar, yakın çatışma için köprü ve ahır.',
  'map.us.name': 'Askeri Üs', 'map.us.tag': 'Büyük · katmanlı yakın mesafe',
  'map.us.desc': 'Duvarlı askeri üs: 3 katlı komuta binası, iki hangar, radar kulesi, tüneller, bunkerler ve konteyner labirenti. Beş kapılı kamplar, her hedefe birden fazla rota.',
  'map.dev.name': 'Geliştirici Atölyesi', 'map.dev.tag': 'Test · tüm modeller',
  'map.dev.desc': 'Tüm araçlar, silahlar ve gadgetlar, binalar, duvar-merdiven-siper ve askeri yapılar etiketli sergi şeritlerinde. Rastgele harita seçimine girmez.',
  'map.newyork.name': 'New York', 'map.newyork.tag': 'Enfekte · gece · patlamış cadde',
  'map.newyork.desc': 'Enfekte moduna özel gece haritası: patlamış New York caddesi. Yıkık gökdelenler, yanan araçlar, devrik otobüsler, düşmüş helikopter, kraterler. İnsanlar meydan anıtına, kamyon kasalarına, metro girişlerine, çökmüş kat döşemesine, otoparka ve inşaat iskelesine çıkıp yüksekten savunur; zombiler koşup sıçrayarak peşlerinden gelir.',
  'map.colgecidi.name': 'Çöl Geçidi', 'map.colgecidi.tag': 'Büyük · üç hat · iki saha',
  'map.colgecidi.desc': 'Klasik çöl haritası: uzun koridor, orta ve tüneller olmak üzere üç hat; A (pazar) ve B (avlu) sahaları. Kapalı yapı, her hatta farklı çatışma mesafesi.',
  'map.depo.name': 'Depo', 'map.depo.tag': 'Küçük · hızlı · 4v4–5v5',
  'map.depo.desc': 'Kompakt sanayi deposu: ortada içine girilen depo (B: raflar, iki merdivenli asma kat), batıda konteyner sahası (A), doğuda kamyonlu yükleme alanı (C). Kısa-orta mesafe, hızlı çatışma; telefonda rahat oynanacak şekilde sade ve okunaklı.',
  'map.liman.name': 'Liman', 'map.liman.tag': 'Küçük · hızlı · mobil dostu',
  'map.liman.desc': 'Kompakt konteyner sahası: üç hat, ortada tünelli ve çatısına çıkılan konteyner kulesi, rıhtımda dev gemi vinci, batıda portal vinç. 4v4–5v5 için hızlı, okunaklı çatışma; telefonda akıcı.',
  'map.boyakulesi.name': 'Boya Kulesi', 'map.boyakulesi.tag': 'Paintball · üç kat · kuyu',
  'map.boyakulesi.desc': 'Paintball moduna özel renkli arena: zeminde şişme siperler, köşelerde dört renkli kale (9 m), ortada 18 m kule. Kalelerden kuleye korkuluksuz köprüler kuyunun üstünden geçer; kuyuya düşen elenir. Zıplama minderleri zeminden kaleye fırlatır, kule tepesi en güçlü nokta.',
  'map.ormankale.name': 'Orman Kalesi', 'map.ormankale.tag': 'Paintball · orman · dere',
  'map.ormankale.desc': 'Çam ormanında senaryo sahası: ortada surlu, iki katlı kütük kale ve 5,6 m gözcü kulesi. Güneyden sığ bir dere geçer (üç tahta köprü, devrik kütük); köşelerde kütük kulübe, boyalı lastik kuleli hurda köşesi, gözetleme kulesi ve saman tarlası. Yayvan, ağaçlarla bölünmüş kısa-orta mesafe.',
  'map.maden.name': 'Maden Ocağı', 'map.maden.tag': 'Vagon · saldırı / savunma · ray', 'mode.payload.tag': 'Takımlı · saldırı / savunma',
  'map.maden.desc': 'Vagon moduna özel kayalık maden vadisi: patlayıcı yüklü vagon Yükleme Avlusu\'ndan Kırma Tesisi, A · Makas, köy caddesi, B · Kantar ve Lavvar üzerinden C · Maden Ağzı\'na raylarla gider. Savunan hep sıradaki noktanın ilerisinde doğar; kaya sırtları kestirmeleri kapatır, çatışma ray boyunca döner.',
  'mode.conquest.tag': 'Takımlı · bayrak', 'mode.tdm.tag': 'Takımlı · skor', 'mode.dm.tag': 'Herkes tek', 'mode.gg.tag': 'Herkes tek · 15 silah', 'mode.inf.tag': 'Zombi · Zor botlar', 'mode.pb.tag': 'Herkes tek · boya silahı',
  'stat.dmg': 'Hasar', 'stat.range': 'Menzil', 'stat.rate': 'Atış hızı', 'stat.control': 'Kontrol', 'stat.mobility': 'Hareket',
  'key.Space': 'Boşluk', 'data.random': 'Rastgele',
});

addStrings('en', {
  'map.kasaba.name': 'Township', 'map.kasaba.tag': 'Large · mixed range',
  'map.kasaba.desc': 'Two stone-walled spawn yards and a fountain square in the middle. The water tower and church bell tower are sniper nests; full 2-3 storey houses, garden walls and back alleys make for indoor fights.',
  'map.vadi.name': 'Valley', 'map.vadi.tag': 'Large · long range',
  'map.vadi.desc': 'A river valley: one bridge and two shallow fords between wooded ridges. Slopes for snipers, the bridge and barn for close quarters.',
  'map.us.name': 'Military Base', 'map.us.tag': 'Large · layered close range',
  'map.us.desc': 'Walled military base: a 3-storey command building, two hangars, a radar tower, tunnels, bunkers and a container maze. Five-gate camps and several routes to every objective.',
  'map.dev.name': 'Developer Workshop', 'map.dev.tag': 'Test · all models',
  'map.dev.desc': 'Every vehicle, weapon and gadget, buildings, walls, stairs, cover and military structures on labelled showcase strips. Never picked as a random map.',
  'map.newyork.name': 'New York', 'map.newyork.tag': 'Infected · night · ruined avenue',
  'map.newyork.desc': 'Night map made for Infected: a blasted New York avenue. Ruined skyscrapers, burning cars, overturned buses, a downed helicopter and craters. Humans hold the high ground on the square monument, truck beds, subway entrances, a collapsed floor, the car park and scaffolding; zombies sprint and leap after them.',
  'map.colgecidi.name': 'Desert Pass', 'map.colgecidi.tag': 'Large · three lanes · two sites',
  'map.colgecidi.desc': 'A classic desert map: three lanes (long corridor, mid and tunnels) leading to sites A (market) and B (courtyard). Enclosed layout with a different fighting range on every lane.',
  'map.depo.name': 'Warehouse', 'map.depo.tag': 'Small · fast · 4v4–5v5',
  'map.depo.desc': 'Compact industrial depot: an enterable warehouse in the middle (B: shelves, a mezzanine with two stairs), a container yard to the west (A) and a truck loading bay to the east (C). Short to mid range, fast fights; clean and readable for comfortable phone play.',
  'map.liman.name': 'Harbor', 'map.liman.tag': 'Small · fast · mobile friendly',
  'map.liman.desc': 'Compact container yard: three lanes, a container tower in the middle with a tunnel and a climbable roof, a huge ship crane on the quay and a gantry crane to the west. Fast, readable fights for 4v4–5v5; smooth on phones.',
  'map.boyakulesi.name': 'Paint Tower', 'map.boyakulesi.tag': 'Paintball · three levels · pit',
  'map.boyakulesi.desc': 'A colourful arena made for Paintball: inflatable cover on the ground, four coloured forts in the corners (9 m) and an 18 m tower in the middle. Railless bridges cross the pit from the forts to the tower; fall in and you are out. Jump pads launch you from the ground to the forts, and the tower top is the strongest spot.',
  'map.ormankale.name': 'Forest Fort', 'map.ormankale.tag': 'Paintball · forest · creek',
  'map.ormankale.desc': 'A woodsball field in a pine forest: a walled, two-storey log fort with a 5.6 m watchtower in the middle. A shallow creek runs along the south (three wooden bridges and a fallen log); log cabin, scrap corner with a painted tyre tower, lookout tower and hay field in the corners. Wide, tree-broken short-to-mid range.',
  'map.maden.name': 'Quarry Mine', 'map.maden.tag': 'Payload · attack / defend · rails', 'mode.payload.tag': 'Teams · attack / defend',
  'map.maden.desc': 'A rocky mining valley made for Payload: the explosive cart rolls on rails from the loading yard through the crusher, A · Junction, the village street, B · Weighbridge and the wash plant to C · Mine Entrance. Defenders always spawn just past the next checkpoint and rock ridges close the shortcuts, so the fight follows the rails.',

  'mode.conquest.label': 'Conquest', 'mode.conquest.tag': 'Teams · flags', 'mode.conquest.desc': 'Capture the flags and drain the enemy tickets.',
  'mode.tdm.label': 'Team Deathmatch', 'mode.tdm.tag': 'Teams · score', 'mode.tdm.desc': 'No flags, just frags. Every kill adds to the team score; first team to the score limit wins.',
  'mode.inf.label': 'Infected', 'mode.inf.tag': 'Zombies · hard bots', 'mode.inf.desc': '1–2 giant BOSS zombies start. A human turns into a zombie after 1 death, a zombie turns back after 1 death (boss: 3). Zombies win if the last human falls; humans win when time runs out or every zombie is cured.',
  'mode.gg.label': 'Gun Game', 'mode.gg.tag': 'Free for all · 15 guns', 'mode.gg.desc': 'Free for all. Every kill gives you the next weapon; the 15th is the knife. Get knifed and you drop a level; the first knife kill wins (up to 10 players).',
  'mode.dm.label': 'Deathmatch', 'mode.dm.tag': 'Free for all', 'mode.dm.desc': 'Free for all. Random spawns, first to {dm} kills wins (up to 10 players).',
  'mode.pb.label': 'Paintball', 'mode.pb.tag': 'Free for all · paint guns', 'mode.pb.desc': 'Free for all, everyone in their own paint colour. Fixed paint guns, three levels on Paint Tower: ground cover, forts and the tower top. Fall into the pit and you are out; first to {pb} eliminations wins.',

  'class.assault.label': 'Assault', 'class.assault.desc': 'Balanced rifle + 2 frag grenades',
  'class.medic.label': 'Medic', 'class.medic.desc': 'SMG, medkits, heals nearby teammates',
  'class.sniper.label': 'Sniper', 'class.sniper.desc': 'One shot, long-range scope',
  'class.heavy.label': 'Heavy Support', 'class.heavy.desc': '100-round LMG, extra health',
  'class.engineer.label': 'Engineer', 'class.engineer.desc': 'Shotgun + rocket launcher',
  'class.zombie.label': 'Zombie', 'class.zombie.desc': 'Clawed infected',

  'weapon.ak47.desc': 'Classic high-damage rifle with strong recoil.', 'weapon.m4a1.desc': 'Balanced, easy-to-control rifle.', 'weapon.scarh.desc': 'Heavy 7.62 rifle: fewer rounds, more damage.',
  'weapon.aug.desc': 'Bullpup rifle: compact and very stable.', 'weapon.g36.desc': 'Light, accurate rifle with a carry handle.', 'weapon.ak74u.desc': 'Short carbine: fast, agile, short range.',
  'weapon.mp5.desc': 'Balanced SMG, deadly at close to mid range.', 'weapon.vector.desc': 'Extremely high fire rate; the mag melts fast.', 'weapon.p90.desc': '50-round magazine, low recoil.',
  'weapon.mac10.desc': 'Machine pistol: huge fire rate, short range.',
  'weapon.shotgun.name': 'Pump Shotgun', 'weapon.shotgun.desc': 'Classic pump-action: lethal up close.', 'weapon.aa12.desc': 'Full-auto shotgun: a downpour at close range.',
  'weapon.dbl.name': 'Double Barrel', 'weapon.dbl.desc': 'Two barrels, one blast: massive spread and damage.',
  'weapon.pistol.desc': 'Light, fast-drawing sidearm.', 'weapon.m1911.desc': 'Classic .45: hits harder, smaller magazine.', 'weapon.deagle.desc': '.50 AE: kills in 3 shots, harsh recoil.', 'weapon.revolver.desc': '6 shots, heavy damage; slow to reload.',
  'weapon.sniper.name': 'M24 Sniper', 'weapon.sniper.desc': 'Bolt action: one shot to the body, 4x scope.', 'weapon.svd.desc': 'Semi-auto DMR: quick follow-up shots, 3x scope.', 'weapon.barrett.desc': 'Anti-materiel: one-shot mincer, very heavy.',
  'weapon.lmg.desc': '100 rounds of suppressive fire.', 'weapon.pkm.desc': 'Heavy machine gun: 7.62 mm, powerful but unwieldy.',
  'weapon.rpg.desc': 'Rocket launcher: explosive damage against vehicles and buildings.', 'weapon.m79.name': 'M79 Grenade Launcher', 'weapon.m79.desc': 'Lobs a 40 mm grenade that explodes on impact.',
  'weapon.grenade.name': 'Frag Grenade', 'weapon.grenade.desc': 'Frag grenade, 5 s fuse (PUBG). Hold: trajectory · R: pull pin (cook) · right click: overhand / underhand · G: quick throw.', 'weapon.smoke.name': 'Smoke Grenade', 'weapon.smoke.desc': '30 s dense smoke screen (long, like PUBG): blocks vision completely.',
  'weapon.flash.name': 'Flashbang', 'weapon.flash.desc': 'Stun grenade (PUBG): 2.5 s fuse or 0.7 s after first impact. Blinds anyone looking for up to 5.5 s, deafens nearby. Cook with R.', 'weapon.claymore.desc': 'Placed on the ground; blows up enemies walking past.',
  'weapon.ammobox.name': 'Ammo Box', 'weapon.ammobox.desc': 'Drop it to refill nearby teammates’ ammo.', 'weapon.medkit.name': 'First Aid Kit', 'weapon.medkit.desc': 'Restores health (60).',
  'weapon.knife.name': 'Knife', 'weapon.knife.desc': 'Fast combo, one-hit kill from behind.', 'weapon.machete.name': 'Machete', 'weapon.machete.desc': 'Long reach, heavy and wide swing.',
  'weapon.claws.name': 'Claws', 'weapon.claws.desc': 'Zombie claws: quick, bloody strikes.', 'weapon.tomahawk.desc': 'Heavy overhead strike, short reach.',
  'weapon.pbrifle.name': 'Paintball Rifle', 'weapon.pbrifle.desc': 'Full-auto marker: 10 paint balls per second, arcing shots.', 'weapon.pbpistol.name': 'Paintball Pistol', 'weapon.pbpistol.desc': 'Semi-auto: 4 hits take you out, balls drop faster.',

  'diff.easy': 'Easy', 'diff.normal': 'Normal', 'diff.hard': 'Hard',
  'optic.iron': 'Iron Sights', 'optic.reddot': 'Red Dot', 'optic.holo': 'Holographic', 'optic.acog': '4x ACOG', 'optic.x2': '2x Sight', 'optic.x3': '3x Sight', 'optic.x6': '6x Scope', 'optic.x8': '8x Scope', 'optic.scope': '4x Scope', 'optic.scope6': '6x Scope', 'optic.ww_peep': 'Peep Sight', 'optic.ww_scout': '1.5x Scout Scope', 'optic.ww_sc25': '2.5x Scope', 'optic.ww_sc4': '4x Scope',
  'tod.day': 'Day', 'tod.sunset': 'Sunset', 'tod.night': 'Night', 'weather.clear': 'Clear', 'weather.rain': 'Rain', 'weather.fog': 'Fog',
  'stat.dmg': 'Damage', 'stat.range': 'Range', 'stat.rate': 'Fire rate', 'stat.control': 'Control', 'stat.mobility': 'Mobility',
  'zombie.walker.label': 'Walker', 'zombie.walker.desc': 'Balanced. Rage: briefly fast and deadly.', 'zombie.runner.label': 'Runner', 'zombie.runner.desc': 'Very fast, fragile. Burst: incredible speed for a moment.',
  'zombie.brute.label': 'Brute', 'zombie.brute.desc': 'Very tough, hits hard. Armor: greatly reduces damage.', 'zombie.ghost.label': 'Ghost', 'zombie.ghost.desc': 'Invisibility: nobody sees you until you attack.',
  'zombie.blinker.label': 'Blinker', 'zombie.blinker.desc': 'Blink: teleports 14 m in the direction you look.',

  'agroup.0': 'Movement', 'agroup.1': 'Stance', 'agroup.2': 'Weapon', 'agroup.3': 'Camera & interface', 'agroup.4': 'Vehicle', 'action.vehicle': 'Enter / exit vehicle', 'action.vehCam': 'Vehicle camera (inside / chase)',
  'action.forward': 'Forward', 'action.back': 'Back', 'action.left': 'Left', 'action.right': 'Right', 'action.sprint': 'Sprint', 'action.jump': 'Jump / stand up',
  'action.crouch': 'Crouch', 'action.prone': 'Prone', 'action.leanLeft': 'Lean left', 'action.leanRight': 'Lean right',
  'action.reload': 'Reload', 'action.slot1': 'Primary weapon', 'action.slot2': 'Secondary weapon', 'action.slot3': 'Gadget', 'action.slot4': 'Knife',
  'action.fireMode': 'Fire mode (single → burst → auto)', 'action.ability': 'Zombie ability (Infected) · right click works too', 'action.optic': 'Switch sight (quick)',
  'action.wheel': 'Sight wheel (hold)', 'action.holdBreath': 'Hold breath (scoped, hold)', 'action.inspect': 'Inspect weapon', 'action.leftHand': 'Left ↔ right hand (weapon hand)',
  'action.third': '3rd person camera', 'action.flashlight': 'Flashlight', 'action.team': 'Team select (online)', 'action.chat': 'Chat (online) · Shift for team', 'action.scoreboard': 'Scoreboard (hold)',
  'key.Space': 'Space', 'data.random': 'Random',
});

// anahtar varsa seçili dildeki metin, yoksa kaynaktaki (Türkçe) veri
const tx = (key, fb, vars) => { const s = t(key, vars); return s === key ? (fb ?? key) : s; };
export const mapName = (id) => (id === 'random' ? t('data.random') : tx(`map.${id}.name`, id));
export const mapTag = (id) => tx(`map.${id}.tag`, '');
export const mapDesc = (id) => tx(`map.${id}.desc`, '');
export const modeLabel = (type) => tx(`mode.${type}.label`, MATCH_TYPES[type]?.label || type);
export const modeDesc = (type) => tx(`mode.${type}.desc`, MATCH_TYPES[type]?.desc || '', { dm: LIMITS.dmKills, pb: LIMITS.pbKills });
export const modeTag = (type) => tx(`mode.${type}.tag`, '');
export const className = (id) => tx(`class.${id}.label`, CLASS_DEFS[id]?.label || id);
export const classDesc = (id) => tx(`class.${id}.desc`, CLASS_DEFS[id]?.desc || '');
export const weaponName = (id) => tx(`weapon.${id}.name`, WSTATS[id]?.name || id);
export const weaponDesc = (id) => tx(`weapon.${id}.desc`, WSTATS[id]?.desc || '');
export const diffLabel = (k) => tx(`diff.${k}`, DIFFICULTY[k]?.label || k);
export const opticLabel = (k) => tx(`optic.${k}`, OPTICS[k]?.label || k);
export const todLabel = (k) => tx(`tod.${k}`, (TODS_LIST.find((x) => x[0] === k) || [0, k])[1]);
export const weatherLabel = (k) => tx(`weather.${k}`, (WEATHERS.find((x) => x[0] === k) || [0, k])[1]);
export const statLabel = (k) => tx(`stat.${k}`, k);
export const zombieLabel = (k) => tx(`zombie.${k}.label`, ZTYPES[k]?.label || k);
export const zombieDesc = (k) => tx(`zombie.${k}.desc`, ZTYPES[k]?.desc || '');
export const actionLabel = (id) => tx(`action.${id}`, ACTIONS.find((a) => a.id === id)?.label || id);
export const groupLabel = (i) => tx(`agroup.${i}`, GROUPS[i] || '');
export const keyName = (code) => tx(`key.${code}`, codeLabel(code));     // tuş adı (Boşluk / Space); diğerleri codeLabel
