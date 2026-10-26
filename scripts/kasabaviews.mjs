// Kasaba bakış noktaları (kasabashots.mjs görüntüleri + kasabacam.mjs kamera denetimi ortak kullanır). 12.176
// bakış: [ad, kamera [x,y,z], hedef [x,y,z], fov]
export const VIEWS = [
  ['01-mavi-avlu', [-63, 1.7, 1], [-78, 1.5, -4], 70],
  ['02-sikan', [-60, 1.7, -1], [-44, 1.4, 1], 70],
  ['03-evler', [-36, 1.7, -3], [-36, 3, -18], 70],
  ['04-okul', [-50, 1.7, -6], [-58, 3, -17], 70],
  ['05-belediye', [-8, 1.7, -6], [-16, 3, -17], 70],
  ['06-kilise', [-24.5, 2.4, 3.2], [-36, 5.0, 16], 64],
  ['07-park', [-20, 4.5, 4.5], [-13, 0.5, 17], 66],             // 12.176: eski nokta (−22, 4,5, 5,5) parktaki ağaç tepesinin 1 m arkasındaydı
  ['08-kavsak', [-8, 4.5, -8], [0, 0.5, 0], 66],
  ['09-su-kulesi', [-17, 1.7, -35], [-24, 4, -45], 70],
  ['10-mezarlik', [-39, 1.7, 36], [-46, 1.5, 46], 70],              // 12.176: eşya kendi rastgele akışına geçince mezarlık ağaçları yeniden dağıldı; eski nokta bir ağaç tepesinin içinde kalıyordu
  ['11-kuzey-sokak', [-64, 1.7, -30], [-40, 1.5, -30], 70],
  ['12-kirmizi-avlu', [63, 1.7, -1], [78, 1.5, 4], 70],
  ['13-benzinlik', [24.5, 1.8, -7.2], [33, 2.5, -17], 70],
  ['14-pazar', [30, 1.7, 5], [37, 3, 17], 70],
  ['15-garaj', [-48.5, 1.8, 6.2], [-56, 2.5, 16], 70],
  ['16-ciftlik', [-66, 1.7, -2], [-76, 3, -12], 70],
  ['17-kirmizi-depo', [63.5, 1.8, 6.5], [72, 3, 13.5], 70],
  ['18-orta-cadde', [-2, 1.7, -30], [-2, 1.5, -6], 70],
  // 12.168: iç mekân / çatı / kule bakışları (eski haritada aynı noktalar: karşılaştırma için)
  ['19-ev-ici', [-42.2, 1.75, -14.2], [-36.5, 1.0, -20.5], 72],
  ['20-can-kulesi', [-36.0, 10.95, 9.2], [-40, 7.5, -8], 72],     // 12.176: kemerin ortasından (eskisi köşe ayağına bakıyordu)
  ['21-okul-cati', [-58.6, 7.95, -13.4], [-30, 3, 2], 70],        // 12.176: eski nokta yeni çatı çıkışı kulübesinin kuzey duvarına 0,6 m'deydi (kadrajı kulübe duvarı dolduruyordu)
  ['22-kilise-ici', [-36.0, 1.75, 15.0], [-36.0, 2.2, 24], 74],
  ['23-pazar-ici', [41.5, 1.75, 13.2], [30, 1.4, 20], 74],
  ['24-su-kulesi-ustu', [-24.0, 9.7, -42.2], [0, 3, -10], 66],
  // 12.176: oda türü başına iç mekân bakışları (yatak odası, mutfak, sınıf, belediye salonu, garaj, banka)
  ['25-ev-yatak', [-43.3, 4.75, -14.0], [-36.0, 3.6, -17.5], 74],
  ['26-ev-mutfak', [-35.4, 1.75, -19.8], [-43.0, 1.0, -20.0], 80],
  ['27-okul-sinif', [-50.5, 1.75, -13.5], [-58.0, 1.0, -20.0], 74],
  ['28-belediye-ici', [-7.5, 1.75, -13.5], [-18.0, 1.0, -21.0], 74],
  ['29-garaj-ici', [-50.5, 1.75, 13.0], [-58.0, 1.0, 20.0], 74],
  ['30-banka-ici', [19.5, 1.75, 14.0], [9.0, 1.0, 21.0], 74],
];
export const AIR = [['00-kusbakisi', [-70, 70, 80], [-10, 0, 0], 50], ['00-kusbakisi-kd', [70, 70, -80], [10, 0, 0], 50], ['00-tepeden', [0, 190, 0.01], [0, 0, 0], 44]];
