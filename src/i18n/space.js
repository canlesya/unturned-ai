// Uzay modu (12.157) + Yörünge Üssü haritası + enerji silahları metinleri (tr + en). Kullanım: t('space.label')
import { addStrings } from './index.js';

addStrings('tr', {
  'space.label': 'Uzay',
  'space.desc': 'Ay yüzeyindeki araştırma üssünde takım çatışması: yer çekimi Dünya\'nın üçte biri (yüksek, uzun zıplama, düşme hasarı yok), enerji silahları (lazer, plazma, ray tüfeği, dağıtıcı) ve uzay kıyafetleri. Skor sınırına ilk ulaşan takım kazanır.',
  'space.tag': 'Takımlı · düşük yer çekimi',
  'space.todLbl': 'Uzay (harita)', 'space.todHint': '{m}: gün saati yok — hep aynı uzay ışığı (güneş + Dünya).', 'space.noWeather': 'Yok (uzay)', 'space.weatherHint': 'Uzayda hava yok: yağmur / sis seçilmez.',
  'mode.space.label': 'Uzay', 'mode.space.tag': 'Takımlı · düşük yer çekimi',
  'map.yorunge.name': 'Yörünge Üssü', 'map.yorunge.tag': 'Uzay · Ay yüzeyi · üç hat',
  'map.yorunge.desc': 'Ay yüzeyinde maden / araştırma üssü: ortada içine girilen cam kubbeli Merkez Modül (asma kat), hava kilidi koridorları, kuzeyde krater tarlası ve güneş panelleri, güneyde iniş pisti ve küçük mekik, anten kulesi. Düşük yer çekiminde yüksek platformlar ve köprüler; kaya sırtları doğal siper. Gökte Dünya.',
});

addStrings('en', {
  'space.label': 'Space',
  'space.desc': 'Team deathmatch at a research base on the Moon: one-third gravity (high, floaty jumps, no fall damage), energy weapons (laser, plasma, railgun, scatter gun) and space suits. First team to the score limit wins.',
  'space.tag': 'Teams · low gravity',
  'space.todLbl': 'Space (map)', 'space.todHint': '{m}: no time of day — always the same space light (sun + Earth).', 'space.noWeather': 'None (space)', 'space.weatherHint': 'No weather in space: rain / fog are not available.',
  'mode.space.label': 'Space', 'mode.space.tag': 'Teams · low gravity',
  'mode.space.desc': 'Team deathmatch at a research base on the Moon: one-third gravity (high, floaty jumps, no fall damage), energy weapons (laser, plasma, railgun, scatter gun) and space suits. First team to the score limit wins.',
  'map.yorunge.name': 'Orbital Base', 'map.yorunge.tag': 'Space · lunar surface · three lanes',
  'map.yorunge.desc': 'A mining / research base on the Moon: an enterable glass-domed Central Module (with a mezzanine) in the middle, airlock corridors, a crater field and solar panels to the north, a landing pad with a small shuttle and an antenna tower to the south. High platforms and bridges for low-gravity play; rock ridges for natural cover. Earth hangs in the sky.',
  'weapon.laser.name': 'Laser Rifle', 'weapon.laser.desc': 'Automatic laser: flat, controllable fire, medium damage.',
  'weapon.plasma.name': 'Plasma SMG', 'weapon.plasma.desc': 'Very high rate of fire, short range: plasma bolts melt targets up close.',
  'weapon.epistol.name': 'Energy Pistol', 'weapon.epistol.desc': 'Semi-auto sidearm: quick draw, fast cell swap.',
  'weapon.railgun.name': 'Railgun', 'weapon.railgun.desc': 'Magnetic rail: one-shot to the body, 4x scope; recharges after every shot.',
  'weapon.scatter.name': 'Scatter Gun', 'weapon.scatter.desc': 'Energy shotgun: wide spread up close, reloads with a cell magazine.',
});
