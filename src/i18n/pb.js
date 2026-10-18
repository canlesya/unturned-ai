// Paintball v2 metinleri (ekran boyası, kutular, halka nişangâh). Kullanan dosya bu modülü içe aktarır (kendini addStrings ile kaydeder).
import { addStrings } from './index.js';

addStrings('tr', {
  'pb.painted': 'BOYANDIN!',
  'pb.ring': 'Halka nişangâh',
  'pb.pkHeal': '+{n} CAN',
  'pb.pkAmmo': '+BOYA TOPU · yedek dolu',
});
addStrings('en', {
  'pb.painted': 'PAINTED!',
  'pb.ring': 'Ring sight',
  'pb.pkHeal': '+{n} HP',
  'pb.pkAmmo': '+PAINTBALLS · reserve full',
});
