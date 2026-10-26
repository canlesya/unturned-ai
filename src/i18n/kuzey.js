// Kuzey Vadisi (12.172) harita metinleri (tr + en). maps/index.js içe aktarır.
import { addStrings } from './index.js';

addStrings('tr', {
  'map.kuzey.name': 'Kuzey Vadisi', 'map.kuzey.tag': 'Dev · 1,6 km · 7 bayrak · 32v32',
  'map.kuzey.desc': 'Dağlarla çevrili, nehrin ikiye böldüğü büyük vadi: güneyde Mavi, kuzeyde Kırmızı üs (helikopter pistleri, araç parkı). Yedi bayrak: Radar Tepesi, dar sokaklı Köy, ortada Taş Köprü, Fabrika, doğu kanyonundaki Baraj, Çiftlik ve ormandaki Kereste Kampı. Nehir yalnız köprülerden, baraj tepesinden ve iki sığ geçitten aşılır. Araçlar için geniş yollar ve açık tarlalar (araç mekaniği ileride).',
});
addStrings('en', {
  'map.kuzey.name': 'North Valley', 'map.kuzey.tag': 'Huge · 1.6 km · 7 flags · 32v32',
  'map.kuzey.desc': 'A huge mountain valley split by a river: Blue base to the south, Red to the north (helipads, vehicle depots). Seven flags: Radar Hill, the narrow-laned Village, the Stone Bridge in the middle, the Factory, the Dam in the eastern canyon, the Farm and the Logging Camp in the forest. The river is crossed only at the bridges, the dam crest and two shallow fords. Wide roads and open fields for vehicles (vehicle mechanics coming later).',
});
