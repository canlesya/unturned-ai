// 12.177 araç metinleri (tr + en)
import { addStrings } from './index.js';

addStrings('tr', {
  'veh.jip': 'JİP', 'veh.drive': 'sür', 'veh.ride': 'bin', 'veh.seat.0': 'Sürücü', 'veh.seat.1': 'Ön yolcu', 'veh.seat.2': 'Arka sol', 'veh.seat.3': 'Arka sağ',
  'veh.prompt': '<b>{k}</b> {n} — {s}', 'veh.empty': 'boş', 'veh.kmh': 'km/s',
  'veh.hint.drv': '<b>W A S D</b> sür · <b>Boşluk</b> fren · <b>Sol tık</b> korna · <b>{f}</b> far · <b>{v}</b> kamera · <b>1–4</b> koltuk · <b>{e}</b> in',
  'veh.hint.pas': '<b>Sol tık</b> ateş · <b>Tekerlek</b> silah · <b>1–4</b> koltuk · <b>{e}</b> in',
  'veh.burn': 'ARAÇ YANIYOR — İN!', 'veh.sunk': 'MOTOR SU ALDI', 'veh.t.camFirst': 'Araç kamerası: içeriden', 'veh.t.camThird': 'Araç kamerası: takip',
  'veh.t.lightsOn': 'Farlar açık', 'veh.t.lightsOff': 'Farlar kapalı', 'veh.kf': 'Jip',
  'agroup.4': 'Araç', 'tc.n.veh': 'Araca bin / in', 'tc.n.vcam': 'Araç kamerası', 'tc.n.seat': 'Koltuk değiştir',
});
addStrings('en', {
  'veh.jip': 'JEEP', 'veh.drive': 'drive', 'veh.ride': 'ride', 'veh.seat.0': 'Driver', 'veh.seat.1': 'Front passenger', 'veh.seat.2': 'Rear left', 'veh.seat.3': 'Rear right',
  'veh.prompt': '<b>{k}</b> {n} — {s}', 'veh.empty': 'empty', 'veh.kmh': 'km/h',
  'veh.hint.drv': '<b>W A S D</b> drive · <b>Space</b> brake · <b>Left click</b> horn · <b>{f}</b> lights · <b>{v}</b> camera · <b>1–4</b> seat · <b>{e}</b> exit',
  'veh.hint.pas': '<b>Left click</b> fire · <b>Wheel</b> weapon · <b>1–4</b> seat · <b>{e}</b> exit',
  'veh.burn': 'VEHICLE ON FIRE — GET OUT!', 'veh.sunk': 'ENGINE FLOODED', 'veh.t.camFirst': 'Vehicle camera: inside', 'veh.t.camThird': 'Vehicle camera: chase',
  'veh.t.lightsOn': 'Headlights on', 'veh.t.lightsOff': 'Headlights off', 'veh.kf': 'Jeep',
  'agroup.4': 'Vehicle', 'action.vehicle': 'Enter / exit vehicle', 'action.vehCam': 'Vehicle camera (inside / chase)',
  'tc.n.veh': 'Enter / exit vehicle', 'tc.n.vcam': 'Vehicle camera', 'tc.n.seat': 'Switch seat',
});
