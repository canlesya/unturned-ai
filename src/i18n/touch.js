// Dokunmatik kontrol metinleri (src/game/touch.js): buton adları, nişangâh seçici, zombi gücü butonu, Dokunmatik ayarlar paneli, yan çevir uyarısı.
import { addStrings } from './index.js';

addStrings('tr', {
  'tc.rk': 'ROKET', 'tc.gun': 'TOP', 'tc.n.joy': 'Joystick', 'tc.n.fire': 'Ateş', 'tc.n.fire2': 'Sol ateş', 'tc.n.ads': 'Nişan', 'tc.n.rk': 'Silah değiştir (helikopter: top ↔ roket)', 'tc.n.jump': 'Zıpla', 'tc.n.crouch': 'Çömel', 'tc.n.reload': 'Şarjör',
  'tc.n.swap': 'Silah değiştir', 'tc.n.nade': 'Ekipman', 'tc.n.third': '3. şahıs', 'tc.n.optic': 'Nişangâh seç', 'tc.n.abil': 'Zombi gücü', 'tc.n.breath': 'Nefes tut', 'tc.n.pause': 'Duraklat', 'tc.n.score': 'Skor', 'tc.n.map': 'Harita',
  'tc.op.iron': 'DEMİR', 'tc.op.reddot': 'RED', 'tc.op.holo': 'HOLO', 'tc.op.ww_peep': 'DİYOPTR',
  'tc.opTitle': 'NİŞANGÂH', 'tc.opZoom': '{n}× yakınlaştırma', 'tc.opHint': 'Seçmek için dokun · kapatmak için boşluğa dokun',
  'tc.ready': 'HAZIR',
  'tc.runLock': 'KOŞU KİLİTLİ', 'tc.rot': 'Telefonu yan çevir', 'tc.rotSub': 'Oyun yatay ekranda oynanır',
  'tc.title': 'Dokunmatik ayarlar', 'tc.tLayout': 'Düzen', 'tc.tSens': 'Hassasiyet', 'tc.open': '▼ Aç', 'tc.hide': '▲ Gizle',
  'tc.dragHint': 'Butonları sürükleyerek taşı. Seçili:', 'tc.zHint': 'Zombi gücü butonu yalnız zombiyken görünür (zombiyken taşınır).',
  'tc.size': 'Seçili boyut', 'tc.opacity': 'Saydamlık', 'tc.joy': 'Joystick', 'tc.fixed': 'Sabit', 'tc.float': 'Hareketli',
  'tc.rFire': 'Sağ ateş butonu', 'tc.follow': 'Parmağı izler', 'tc.lFire': 'Sol ateş butonu', 'tc.on': 'Açık', 'tc.off': 'Kapalı',
  'tc.sens': 'Bakış hassasiyeti', 'tc.adsSens': 'Nişan hassasiyeti', 'tc.gyro': 'Jiroskop', 'tc.gyroAds': 'Nişandayken', 'tc.gyroOn': 'Hep açık',
  'tc.gyroSens': 'Jiroskop hassasiyeti', 'tc.gyroDir': 'Jiroskop yönü', 'tc.hN': 'Yatay normal', 'tc.hI': 'Yatay ters', 'tc.vN': 'Dikey normal', 'tc.vI': 'Dikey ters',
  'tc.gyroHint': 'Jiroskop: telefonu çevirerek ince nişan. Ters dönüyorsa yönü değiştir.',
  'tc.aim': 'Nişan yardımı', 'tc.aimStr': 'Yardım gücü', 'tc.retSz': 'Nişangâh boyutu',
  'tc.aimHint': 'Nişan yardımı: düşman üstünde bakış yavaşlar, hareket / ateş / nişan sırasında görünen düşmana hafifçe döner. Duvar arkasına çekmez.',
  'tc.reset': 'Varsayılana dön', 'tc.cancel': 'İptal', 'tc.save': 'Kaydet', 'tc.saved': 'Dokunmatik ayarlar kaydedildi', 'tc.gyroDenied': 'Jiroskop izni verilmedi',
});
addStrings('en', {
  'tc.rk': 'ROCKETS', 'tc.gun': 'GUN', 'tc.n.joy': 'Joystick', 'tc.n.fire': 'Fire', 'tc.n.fire2': 'Left fire', 'tc.n.ads': 'Aim', 'tc.n.rk': 'Switch weapon (helicopter: gun ↔ rockets)', 'tc.n.jump': 'Jump', 'tc.n.crouch': 'Crouch', 'tc.n.reload': 'Reload',
  'tc.n.swap': 'Swap weapon', 'tc.n.nade': 'Equipment', 'tc.n.third': '3rd person', 'tc.n.optic': 'Pick sight', 'tc.n.abil': 'Zombie ability', 'tc.n.breath': 'Hold breath', 'tc.n.pause': 'Pause', 'tc.n.score': 'Score', 'tc.n.map': 'Map',
  'tc.op.iron': 'IRON', 'tc.op.reddot': 'RED', 'tc.op.holo': 'HOLO', 'tc.op.ww_peep': 'PEEP',
  'tc.opTitle': 'SIGHT', 'tc.opZoom': '{n}× zoom', 'tc.opHint': 'Tap to pick · tap empty space to close',
  'tc.ready': 'READY',
  'tc.runLock': 'SPRINT LOCKED', 'tc.rot': 'Turn your phone sideways', 'tc.rotSub': 'The game is played in landscape',
  'tc.title': 'Touch settings', 'tc.tLayout': 'Layout', 'tc.tSens': 'Sensitivity', 'tc.open': '▼ Open', 'tc.hide': '▲ Hide',
  'tc.dragHint': 'Drag buttons to move them. Selected:', 'tc.zHint': 'The zombie ability button only shows while you are a zombie (move it then).',
  'tc.size': 'Selected size', 'tc.opacity': 'Opacity', 'tc.joy': 'Joystick', 'tc.fixed': 'Fixed', 'tc.float': 'Floating',
  'tc.rFire': 'Right fire button', 'tc.follow': 'Follows finger', 'tc.lFire': 'Left fire button', 'tc.on': 'On', 'tc.off': 'Off',
  'tc.sens': 'Look sensitivity', 'tc.adsSens': 'Aim sensitivity', 'tc.gyro': 'Gyroscope', 'tc.gyroAds': 'While aiming', 'tc.gyroOn': 'Always on',
  'tc.gyroSens': 'Gyro sensitivity', 'tc.gyroDir': 'Gyro direction', 'tc.hN': 'Horizontal normal', 'tc.hI': 'Horizontal inverted', 'tc.vN': 'Vertical normal', 'tc.vI': 'Vertical inverted',
  'tc.gyroHint': 'Gyroscope: fine aim by turning the phone. Flip the direction if it feels inverted.',
  'tc.aim': 'Aim assist', 'tc.aimStr': 'Assist strength', 'tc.retSz': 'Reticle size',
  'tc.aimHint': 'Aim assist: look slows down over enemies and gently turns toward visible enemies while moving / firing / aiming. Never pulls through walls.',
  'tc.reset': 'Reset to default', 'tc.cancel': 'Cancel', 'tc.save': 'Save', 'tc.saved': 'Touch settings saved', 'tc.gyroDenied': 'Gyroscope permission denied',
});
