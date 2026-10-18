// Oyun verisinin görünen adları (harita / mod / sınıf): anahtar yoksa mevcut Türkçe ad döner. Menü ajanı bu dosyayı genişletebilir (aynı üç işlev, aynı anahtarlar).
import { t, addStrings } from './index.js';
import { MATCH_TYPES } from '../game/match.js';
import { CLASS_DEFS } from '../game/stats.js';
const tf = (k, fb) => { const s = t(k); return s === k ? fb : s; };   // anahtar hiçbir dilde yoksa yedek
export const mapName = (id) => tf(`map.${id}.name`, id);
export const modeLabel = (type) => tf(`mode.${type}.label`, MATCH_TYPES[type]?.label || type);
export const className = (id) => tf(`class.${id}.label`, CLASS_DEFS[id]?.label || id);
addStrings('tr', {
  'map.kasaba.name': 'Kasaba', 'map.vadi.name': 'Vadi', 'map.us.name': 'Askeri Üs', 'map.dev.name': 'Geliştirici Atölyesi', 'map.newyork.name': 'New York',
  'map.colgecidi.name': 'Çöl Geçidi', 'map.depo.name': 'Depo', 'map.liman.name': 'Liman', 'map.boyakulesi.name': 'Boya Kulesi',
});
addStrings('en', {
  'map.kasaba.name': 'Town', 'map.vadi.name': 'Valley', 'map.us.name': 'Military Base', 'map.dev.name': 'Dev Workshop', 'map.newyork.name': 'New York',
  'map.colgecidi.name': 'Desert Pass', 'map.depo.name': 'Depot', 'map.liman.name': 'Harbor', 'map.boyakulesi.name': 'Paint Tower',
  'mode.conquest.label': 'Conquest', 'mode.tdm.label': 'Team Deathmatch', 'mode.inf.label': 'Infection', 'mode.gg.label': 'Gun Game', 'mode.dm.label': 'Deathmatch', 'mode.pb.label': 'Paintball',
  'class.assault.label': 'Assault', 'class.medic.label': 'Medic', 'class.sniper.label': 'Sniper', 'class.heavy.label': 'Heavy Support', 'class.engineer.label': 'Engineer', 'class.zombie.label': 'Zombie',
});
