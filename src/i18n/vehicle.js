// 12.177 araç metinleri (tr + en)
import { addStrings } from './index.js';

addStrings('tr', {
  'veh.jip': 'JİP', 'veh.drive': 'sür', 'veh.ride': 'bin', 'veh.seat.0': 'Sürücü', 'veh.seat.1': 'Makineli', 'veh.seat.2': 'Arka sol', 'veh.seat.3': 'Arka sağ',
  'veh.prompt': '<b>{k}</b> {n} — {s}', 'veh.evict': 'botu indir', 'veh.yieldWait': 'bot duruyor…', 'veh.empty': 'boş', 'veh.kmh': 'km/s',
  'veh.hint.drv': '<b>W A S D</b> sür · <b>Boşluk</b> fren · <b>Sol tık</b> korna · <b>{f}</b> far · <b>{v}</b> kamera · <b>1–4</b> koltuk (<b>2</b> makineli) · <b>{e}</b> in',
  'veh.hint.pas': '<b>Sol tık</b> ateş · <b>Tekerlek</b> silah · <b>1–4</b> koltuk · <b>{e}</b> in',
  'veh.burn': 'ARAÇ YANIYOR — İN!', 'veh.sunk': 'MOTOR SU ALDI', 'veh.t.camFirst': 'Araç kamerası: içeriden', 'veh.t.camThird': 'Araç kamerası: takip',
  'veh.t.lightsOn': 'Farlar açık', 'veh.t.lightsOff': 'Farlar kapalı', 'veh.kf': 'Jip', 'veh.kf.tank': 'Tank', 'veh.kf.heli': 'Helikopter', 'veh.kf.tankgun': 'Tank topu', 'veh.kf.rocket': 'Roket', 'veh.kf.tankmg': 'Tank makinelisi', 'veh.kf.doormg': 'Kapı makinelisi', 'veh.kf.jeepmg': 'Jip makinelisi', 'veh.kf.nose': 'Burun topu',
  'veh.god': 'ÖLÜMSÜZ', 'veh.tank': 'TANK', 'veh.reload': 'ANA TOP DOLUYOR · {n} sn', 'veh.ready': 'ANA TOP HAZIR', 'veh.mg': 'MAKİNELİ', 'veh.armor': 'ZIRH', 'veh.hot': 'AŞIRI ISINDI', 'veh.arc': 'YAY DIŞI', 'veh.nose': 'BURUN TOPU', 'veh.rk': 'ROKET {n}', 'veh.rkLoad': 'ROKET DOLUYOR {n} sn', 'veh.rkN': 'ROKET {n} / {m}', 'veh.rkLoadS': 'DOLUM {n} sn',
  'veh.hint.tank': '<b>W A S D</b> sür · <b>Fare</b> kule (top −10°…+20°) · <b>Sol tık</b> ana top · <b>Sağ tık</b> yakınlaştır · <b>{v}</b> dürbün / takip · <b>{f}</b> far · <b>1–{n}</b> koltuk · <b>{e}</b> in',
  'veh.hint.gunner': '<b>Sol tık</b> makineli · <b>Fare</b> nişan · <b>Sağ tık</b> yakınlaştır · <b>1–{n}</b> koltuk · <b>{e}</b> in',
  'veh.heli-n': 'HELİKOPTER', 'veh.heli-s': 'HELİKOPTER', 'veh.heliBar': 'ROTOR %{r} · İRTİFA {h} m', 'veh.rotor': 'ROTOR HIZLANIYOR…',
  'veh.hint.heli': '<b>Sol tık</b> seçili silah · <b>{q} / Tekerlek</b> burun topu ↔ roket · <b>{r}</b> roket doldur · <b>Sağ tık</b> yakınlaştır · <b>Fare</b> burun + nişan (W yokken yerinde asılı) · <b>Boşluk</b> yüksel · <b>C / Ctrl</b> alçal · <b>W S</b> ileri / geri (W + burun aşağı = hızlı) · <b>A D</b> yana · <b>{v}</b> kamera · <b>{f}</b> far · <b>1–{n}</b> koltuk · <b>{e}</b> in (havada atlarsan düşersin)',
  'tc.n.down': 'Alçal',
  // 12.204 arazi motosikleti
  'veh.moto': 'MOTOR', 'veh.kf.moto': 'Motor', 'veh.seat.moto1': 'Arka yolcu', 'veh.stall': 'MOTOR SUDA STOP ETTİ', 'veh.fall': 'DEVRİLDİ',
  'veh.hint.moto': '<b>W A S D</b> sür · <b>Boşluk</b> fren · <b>Sol tık</b> korna · <b>{f}</b> far · <b>{v}</b> kamera · <b>2</b> arka koltuk · <b>{e}</b> in',
  'veh.hint.motoPas': '<b>Sol tık</b> ateş · <b>Tekerlek</b> silah · <b>1</b> sürücü · <b>{e}</b> in',
  // 12.213 sabit silah yuvaları
  'veh.hmg': 'AĞIR MAKİNELİ', 'veh.atgm': 'TANKSAVAR', 'veh.use': 'başına geç', 'veh.kf.hmg': 'Ağır makineli', 'veh.kf.atgm': 'Tanksavar füzesi', 'veh.kf.atpost': 'Tanksavar', 'veh.atLoad': 'FÜZE DOLUYOR · {n} sn', 'veh.atReady': 'FÜZE HAZIR',
  'veh.hint.hmg': '<b>Sol tık</b> ateş · <b>Fare</b> nişan (±70°, −15°…+25°) · <b>Sağ tık</b> yakınlaştır · ısınınca bırak · <b>{e}</b> kalk',
  'veh.hint.atgm': '<b>Sol tık</b> füze (artının noktasına gider) · <b>Fare</b> nişan (±60°) · <b>Sağ tık</b> dürbün · dolum 5 sn · <b>{e}</b> kalk',
  // 12.216 sabit yuva / ikmal kutusu ipuçları (yakınken; kullanılamıyorsa nedeni)
  'veh.busy': 'dolu', 'veh.busyFoe': 'dolu (düşman)', 'veh.rebuild': 'yeniden kuruluyor · {n} sn', 'veh.rebuildN': 'yeniden kuruluyor',
  'sup.name': 'İKMAL', 'sup.take': 'RPG al (3 roket{o})', 'sup.instead': ' · {o} yerine', 'sup.refill': 'mermi / roket al', 'sup.full': 'cephane dolu', 'sup.enemy': 'düşmanın — önce bayrağı al',
  'sup.t.take': 'RPG alındı: 3 roket · {k} tuşuyla çek', 'sup.t.refill': 'İkmal: mermi / roket dolduruldu', 'sup.t.full': 'Cephanen zaten dolu', 'sup.t.enemy': 'Düşmanın ikmal kutusu — önce bayrağı al', 'sup.t.auto': 'İkmal: cephane / tanksavar dolduruldu',
  'map.sup': 'İkmal (RPG)',
  'map.emp.hmg': 'Ağır makineli', 'map.emp.atgm': 'Tanksavar',
  'agroup.4': 'Araç', 'tc.n.veh': 'Araca bin / in', 'tc.n.vcam': 'Araç kamerası', 'tc.n.seat': 'Koltuk değiştir',
});
addStrings('en', {
  'veh.jip': 'JEEP', 'veh.drive': 'drive', 'veh.ride': 'ride', 'veh.seat.0': 'Driver', 'veh.seat.1': 'Gunner', 'veh.seat.2': 'Rear left', 'veh.seat.3': 'Rear right',
  'veh.prompt': '<b>{k}</b> {n} — {s}', 'veh.evict': 'kick bot', 'veh.yieldWait': 'bot stopping…', 'veh.empty': 'empty', 'veh.kmh': 'km/h',
  'veh.hint.drv': '<b>W A S D</b> drive · <b>Space</b> brake · <b>Left click</b> horn · <b>{f}</b> lights · <b>{v}</b> camera · <b>1–4</b> seat (<b>2</b> gunner) · <b>{e}</b> exit',
  'veh.hint.pas': '<b>Left click</b> fire · <b>Wheel</b> weapon · <b>1–4</b> seat · <b>{e}</b> exit',
  'veh.burn': 'VEHICLE ON FIRE — GET OUT!', 'veh.sunk': 'ENGINE FLOODED', 'veh.t.camFirst': 'Vehicle camera: inside', 'veh.t.camThird': 'Vehicle camera: chase',
  'veh.t.lightsOn': 'Headlights on', 'veh.t.lightsOff': 'Headlights off', 'veh.kf': 'Jeep', 'veh.kf.tank': 'Tank', 'veh.kf.heli': 'Helicopter', 'veh.kf.tankgun': 'Tank cannon', 'veh.kf.rocket': 'Rockets', 'veh.kf.tankmg': 'Tank MG', 'veh.kf.doormg': 'Door gun', 'veh.kf.jeepmg': 'Jeep MG', 'veh.kf.nose': 'Nose gun',
  'veh.god': 'INVULNERABLE', 'veh.tank': 'TANK', 'veh.reload': 'MAIN GUN LOADING · {n} s', 'veh.ready': 'MAIN GUN READY', 'veh.mg': 'MACHINE GUN', 'veh.armor': 'ARMOR', 'veh.hot': 'OVERHEATED', 'veh.arc': 'OUT OF ARC', 'veh.nose': 'NOSE GUN', 'veh.rk': 'ROCKETS {n}', 'veh.rkLoad': 'ROCKETS RELOADING {n} s', 'veh.rkN': 'ROCKETS {n} / {m}', 'veh.rkLoadS': 'RELOAD {n} s',
  'veh.hint.tank': '<b>W A S D</b> drive · <b>Mouse</b> turret (gun −10°…+20°) · <b>Left click</b> main gun · <b>Right click</b> zoom · <b>{v}</b> sight / chase · <b>{f}</b> lights · <b>1–{n}</b> seat · <b>{e}</b> exit',
  'veh.hint.gunner': '<b>Left click</b> machine gun · <b>Mouse</b> aim · <b>Right click</b> zoom · <b>1–{n}</b> seat · <b>{e}</b> exit',
  'veh.heli-n': 'HELICOPTER', 'veh.heli-s': 'HELICOPTER', 'veh.heliBar': 'ROTOR {r}% · ALT {h} m', 'veh.rotor': 'ROTOR SPINNING UP…',
  'veh.hint.heli': '<b>Left click</b> selected weapon · <b>{q} / Wheel</b> nose gun ↔ rockets · <b>{r}</b> reload rockets · <b>Right click</b> zoom · <b>Mouse</b> nose + aim (hovers without W) · <b>Space</b> climb · <b>C / Ctrl</b> descend · <b>W S</b> fwd / back (W + nose down = fast) · <b>A D</b> strafe · <b>{v}</b> camera · <b>{f}</b> light · <b>1–{n}</b> seat · <b>{e}</b> exit (jumping out in the air = fall)',
  // 12.213 stationary weapons
  'veh.hmg': 'HEAVY MG', 'veh.atgm': 'ANTI-TANK', 'veh.use': 'man it', 'veh.kf.hmg': 'Heavy MG', 'veh.kf.atgm': 'AT missile', 'veh.kf.atpost': 'AT launcher', 'veh.atLoad': 'MISSILE LOADING · {n} s', 'veh.atReady': 'MISSILE READY',
  'veh.hint.hmg': '<b>Left click</b> fire · <b>Mouse</b> aim (±70°, −15°…+25°) · <b>Right click</b> zoom · ease off when hot · <b>{e}</b> leave',
  'veh.hint.atgm': '<b>Left click</b> missile (flies to the crosshair) · <b>Mouse</b> aim (±60°) · <b>Right click</b> sight · 5 s reload · <b>{e}</b> leave',
  // 12.216 emplacement / supply crate prompts
  'veh.busy': 'occupied', 'veh.busyFoe': 'occupied (enemy)', 'veh.rebuild': 'rebuilding · {n} s', 'veh.rebuildN': 'rebuilding',
  'sup.name': 'SUPPLY', 'sup.take': 'take RPG (3 rockets{o})', 'sup.instead': ' · replaces {o}', 'sup.refill': 'take ammo / rockets', 'sup.full': 'ammo full', 'sup.enemy': 'enemy crate — take the flag first',
  'sup.t.take': 'RPG taken: 3 rockets · press {k} to equip', 'sup.t.refill': 'Supply: ammo / rockets refilled', 'sup.t.full': 'Your ammo is already full', 'sup.t.enemy': 'Enemy supply crate — take the flag first', 'sup.t.auto': 'Supply: ammo / AT refilled',
  'map.sup': 'Supply (RPG)',
  'map.emp.hmg': 'Heavy MG', 'map.emp.atgm': 'Anti-tank',
  'agroup.4': 'Vehicle', 'action.vehicle': 'Enter / exit vehicle', 'action.vehCam': 'Vehicle camera (inside / chase)', 'action.vehAlt': 'Helicopter weapon: nose gun ↔ rockets · mouse wheel too',
  'set.grp.4': 'Vehicle', 'set.act.vehicle': 'Enter / exit vehicle', 'set.act.vehCam': 'Vehicle camera (inside / chase)', 'set.act.vehAlt': 'Helicopter weapon: nose gun ↔ rockets · mouse wheel too',      // oyun içi Kontroller (Esc → Ayarlar)
  'tc.n.veh': 'Enter / exit vehicle', 'tc.n.vcam': 'Vehicle camera', 'tc.n.seat': 'Switch seat',
  // 12.204 dirt bike
  'veh.moto': 'DIRT BIKE', 'veh.kf.moto': 'Dirt bike', 'veh.seat.moto1': 'Pillion', 'veh.stall': 'ENGINE STALLED IN WATER', 'veh.fall': 'TIPPED OVER',
  'veh.hint.moto': '<b>W A S D</b> ride · <b>Space</b> brake · <b>Left click</b> horn · <b>{f}</b> light · <b>{v}</b> camera · <b>2</b> rear seat · <b>{e}</b> exit',
  'veh.hint.motoPas': '<b>Left click</b> fire · <b>Wheel</b> weapon · <b>1</b> rider · <b>{e}</b> exit',
});
