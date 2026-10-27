// 12.177 araç metinleri (tr + en)
import { addStrings } from './index.js';

addStrings('tr', {
  'veh.jip': 'JİP', 'veh.drive': 'sür', 'veh.ride': 'bin', 'veh.seat.0': 'Sürücü', 'veh.seat.1': 'Ön yolcu', 'veh.seat.2': 'Arka sol', 'veh.seat.3': 'Arka sağ',
  'veh.prompt': '<b>{k}</b> {n} — {s}', 'veh.empty': 'boş', 'veh.kmh': 'km/s',
  'veh.hint.drv': '<b>W A S D</b> sür · <b>Boşluk</b> fren · <b>Sol tık</b> korna · <b>{f}</b> far · <b>{v}</b> kamera · <b>1–4</b> koltuk · <b>{e}</b> in',
  'veh.hint.pas': '<b>Sol tık</b> ateş · <b>Tekerlek</b> silah · <b>1–4</b> koltuk · <b>{e}</b> in',
  'veh.burn': 'ARAÇ YANIYOR — İN!', 'veh.sunk': 'MOTOR SU ALDI', 'veh.t.camFirst': 'Araç kamerası: içeriden', 'veh.t.camThird': 'Araç kamerası: takip',
  'veh.t.lightsOn': 'Farlar açık', 'veh.t.lightsOff': 'Farlar kapalı', 'veh.kf': 'Jip',
  'veh.tank': 'TANK', 'veh.reload': 'ANA TOP DOLUYOR · {n} sn', 'veh.ready': 'ANA TOP HAZIR', 'veh.mg': 'MAKİNELİ', 'veh.armor': 'ZIRH',
  'veh.hint.tank': '<b>W A S D</b> sür · <b>Fare</b> kule · <b>Sol tık</b> ana top · <b>Sağ tık</b> yakınlaştır · <b>{v}</b> dürbün / takip · <b>{f}</b> far · <b>1–{n}</b> koltuk · <b>{e}</b> in',
  'veh.hint.gunner': '<b>Sol tık</b> makineli · <b>Fare</b> nişan · <b>1–{n}</b> koltuk · <b>{e}</b> in',
  'veh.heli-n': 'HELİKOPTER', 'veh.heli-s': 'HELİKOPTER', 'veh.heliBar': 'ROTOR %{r} · İRTİFA {h} m', 'veh.rotor': 'ROTOR HIZLANIYOR…',
  'veh.hint.heli': '<b>Boşluk</b> yüksel · <b>C / Ctrl</b> alçal · <b>W S</b> ileri / geri · <b>A D</b> yana · <b>Fare</b> burun · <b>{v}</b> kamera · <b>{f}</b> far · <b>1–{n}</b> koltuk · <b>{e}</b> in (havada atlarsan düşersin)',
  'tc.n.down': 'Alçal',
  'agroup.4': 'Araç', 'tc.n.veh': 'Araca bin / in', 'tc.n.vcam': 'Araç kamerası', 'tc.n.seat': 'Koltuk değiştir',
});
addStrings('en', {
  'veh.jip': 'JEEP', 'veh.drive': 'drive', 'veh.ride': 'ride', 'veh.seat.0': 'Driver', 'veh.seat.1': 'Front passenger', 'veh.seat.2': 'Rear left', 'veh.seat.3': 'Rear right',
  'veh.prompt': '<b>{k}</b> {n} — {s}', 'veh.empty': 'empty', 'veh.kmh': 'km/h',
  'veh.hint.drv': '<b>W A S D</b> drive · <b>Space</b> brake · <b>Left click</b> horn · <b>{f}</b> lights · <b>{v}</b> camera · <b>1–4</b> seat · <b>{e}</b> exit',
  'veh.hint.pas': '<b>Left click</b> fire · <b>Wheel</b> weapon · <b>1–4</b> seat · <b>{e}</b> exit',
  'veh.burn': 'VEHICLE ON FIRE — GET OUT!', 'veh.sunk': 'ENGINE FLOODED', 'veh.t.camFirst': 'Vehicle camera: inside', 'veh.t.camThird': 'Vehicle camera: chase',
  'veh.t.lightsOn': 'Headlights on', 'veh.t.lightsOff': 'Headlights off', 'veh.kf': 'Jeep',
  'veh.tank': 'TANK', 'veh.reload': 'MAIN GUN LOADING · {n} s', 'veh.ready': 'MAIN GUN READY', 'veh.mg': 'MACHINE GUN', 'veh.armor': 'ARMOR',
  'veh.hint.tank': '<b>W A S D</b> drive · <b>Mouse</b> turret · <b>Left click</b> main gun · <b>Right click</b> zoom · <b>{v}</b> sight / chase · <b>{f}</b> lights · <b>1–{n}</b> seat · <b>{e}</b> exit',
  'veh.hint.gunner': '<b>Left click</b> machine gun · <b>Mouse</b> aim · <b>1–{n}</b> seat · <b>{e}</b> exit',
  'veh.heli-n': 'HELICOPTER', 'veh.heli-s': 'HELICOPTER', 'veh.heliBar': 'ROTOR {r}% · ALT {h} m', 'veh.rotor': 'ROTOR SPINNING UP…',
  'veh.hint.heli': '<b>Space</b> climb · <b>C / Ctrl</b> descend · <b>W S</b> fwd / back · <b>A D</b> strafe · <b>Mouse</b> nose · <b>{v}</b> camera · <b>{f}</b> light · <b>1–{n}</b> seat · <b>{e}</b> exit (jumping out in the air = fall)',
  'agroup.4': 'Vehicle', 'action.vehicle': 'Enter / exit vehicle', 'action.vehCam': 'Vehicle camera (inside / chase)',
  'tc.n.veh': 'Enter / exit vehicle', 'tc.n.vcam': 'Vehicle camera', 'tc.n.seat': 'Switch seat',
});
