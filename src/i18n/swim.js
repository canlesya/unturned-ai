// 12.180 yüzme / su metinleri (tr + en)
import { addStrings } from './index.js';

addStrings('tr', {
  'hud.swim.air': 'NEFES', 'hud.swim.drown': 'BOĞULUYORSUN!', 'hud.kf.drown': 'Boğuldu',
  'hud.swim.hint': 'Yüzüyorsun · Space: yukarı · C (basılı): dal · yalnız tabanca, nişan yok',
  'hud.swim.hintTouch': 'Yüzüyorsun · zıpla: yukarı · çömel (basılı): dal · yalnız tabanca',
});
addStrings('en', {
  'hud.swim.air': 'AIR', 'hud.swim.drown': 'DROWNING!', 'hud.kf.drown': 'Drowned',
  'hud.swim.hint': 'Swimming · Space: up · hold C: dive · sidearm only, no aiming',
  'hud.swim.hintTouch': 'Swimming · jump: up · hold crouch: dive · sidearm only',
});
