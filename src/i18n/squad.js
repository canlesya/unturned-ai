// 12.202 Manga / büyük harita (M) / işaret (ping) / doğuş seçici metinleri (squadHud.js, pings.js, bigMap.js, hud.js doğuş listesi, Kontroller)
import { addStrings } from './index.js';

addStrings('tr', {
  'sq.title': 'MANGA {n}', 'sq.dead': 'ÖLÜ', 'sq.inVeh': 'ARAÇTA',
  'sq.mateOk': 'Yanında doğ', 'sq.canSpawn': 'doğulabilir',
  'sq.st.0': 'Uygun', 'sq.st.1': 'Çatışmada', 'sq.st.2': 'Yakında düşman', 'sq.st.3': 'Ölü', 'sq.st.4': 'Araçta', 'sq.st.5': 'Havada / suda',
  'sq.pingEnemy': 'DÜŞMAN', 'sq.t.far': 'İşaret için çok uzak', 'sq.t.cantSpawn': 'Bu noktada şu an doğulamaz',
  'sq.teamBtn': 'Takım ({k})', 'sq.mapHint': 'Tıkla: işaret koy · {k} / Esc: kapat', 'sq.mapHintTouch': 'Dokun: işaret koy · ✕ kapat',
  'sq.deployTitle': 'DOĞUŞ NOKTASI', 'sq.deployHint': 'Bayrağa, üsse ya da manga arkadaşına tıkla · Boşluk: Doğ', 'sq.deployHintTouch': 'Bayrağa, üsse ya da arkadaşına dokun',
  'sq.deploy': 'DOĞ', 'sq.ready': 'HAZIR', 'sq.deploying': 'DOĞULUYOR…', 'sq.autoIn': '{n} sn sonra kendiliğinden', 'sq.spawnHere': 'BURADA DOĞ',
  'sq.ourBase': 'ÜSSÜMÜZ', 'sq.enemyBase': 'DÜŞMAN ÜSSÜ',
  'sq.lg.me': 'Sen', 'sq.lg.squad': 'Manga', 'sq.lg.team': 'Takım', 'sq.lg.enemy': 'Görülen düşman', 'sq.lg.ping': 'İşaret', 'sq.lg.heat': 'Çatışma (son {n} sn)',
  'set.act.map': 'Büyük harita (tıkla: işaret)', 'action.map': 'Büyük harita (tıkla: işaret)',
  'set.act.ping': 'İşaret koy / düşmanı işaretle (orta tık da)', 'action.ping': 'İşaret koy / düşmanı işaretle (orta tık da)',
  'set.act.team': 'Takım seçimi (çevrimiçi)', 'action.team': 'Takım seçimi (çevrimiçi)',
});
addStrings('en', {
  'sq.title': 'SQUAD {n}', 'sq.dead': 'DEAD', 'sq.inVeh': 'IN VEHICLE',
  'sq.mateOk': 'Spawn on mate', 'sq.canSpawn': 'available',
  'sq.st.0': 'Available', 'sq.st.1': 'In combat', 'sq.st.2': 'Enemy nearby', 'sq.st.3': 'Dead', 'sq.st.4': 'In vehicle', 'sq.st.5': 'Airborne / swimming',
  'sq.pingEnemy': 'ENEMY', 'sq.t.far': 'Too far to mark', 'sq.t.cantSpawn': 'Can’t spawn there right now',
  'sq.teamBtn': 'Team ({k})', 'sq.mapHint': 'Click: place marker · {k} / Esc: close', 'sq.mapHintTouch': 'Tap: place marker · ✕ close',
  'sq.deployTitle': 'DEPLOY POINT', 'sq.deployHint': 'Click a flag, base or squad mate · Space: Deploy', 'sq.deployHintTouch': 'Tap a flag, base or squad mate',
  'sq.deploy': 'DEPLOY', 'sq.ready': 'READY', 'sq.deploying': 'DEPLOYING…', 'sq.autoIn': 'auto in {n} s', 'sq.spawnHere': 'DEPLOY HERE',
  'sq.ourBase': 'OUR BASE', 'sq.enemyBase': 'ENEMY BASE',
  'sq.lg.me': 'You', 'sq.lg.squad': 'Squad', 'sq.lg.team': 'Team', 'sq.lg.enemy': 'Spotted enemy', 'sq.lg.ping': 'Marker', 'sq.lg.heat': 'Combat (last {n} s)',
  'set.act.map': 'Big map (click: marker)', 'action.map': 'Big map (click: marker)',
  'set.act.ping': 'Place marker / spot enemy (middle click too)', 'action.ping': 'Place marker / spot enemy (middle click too)',
});
