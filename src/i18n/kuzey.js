// Kuzey Vadisi (12.172) harita metinleri (tr + en). maps/index.js içe aktarır.
import { addStrings } from './index.js';

addStrings('tr', {
  'hud.oob.title': 'SAVAŞ ALANINA DÖN!', 'hud.oob.back': 'DÖNMEZSEN {n} sn İÇİNDE ÖLECEKSİN', 'hud.kf.oob': 'Savaş alanını terk etti',
  'map.kuzey.name': 'Kuzey Vadisi', 'map.kuzey.tag': 'Dev · 1,6 km · 7 bayrak · 32v32',
  'map.kuzey.desc': '1,6 km\'lik DEV harita (Vadi\'den ayrı): dağlarla çevrili, nehrin ikiye böldüğü büyük vadi: güneyde Mavi, kuzeyde Kırmızı üs (helikopter pistleri, araç parkı). Yedi bayrak: Radar Tepesi, dar sokaklı Köy, ortada Taş Köprü, Fabrika, doğu kanyonundaki Baraj, Çiftlik ve ormandaki Kereste Kampı. Ele geçirilen bayraktan ya da ön hattan doğulur; orman, çalı çiti ve buğday tarlasında saklanılır. Nehir yalnız köprülerden, baraj tepesinden ve iki sığ geçitten aşılır. Gün ışığı maç boyunca değişir (gündüz: sabah → öğle, gün batımı: ikindi → alacakaranlık). Üslerde ve ele geçirilen bayraklarda 4 kişilik JİPLER (E bin / in): sürücü + 3 yolcu ateş eder; köprüden, sığ geçitten geçer, derin suda batar.',
});
addStrings('en', {
  'hud.oob.title': 'RETURN TO THE BATTLEFIELD!', 'hud.oob.back': 'YOU WILL DIE IN {n} SEC', 'hud.kf.oob': 'Left the battlefield',
  'map.kuzey.name': 'North Valley', 'map.kuzey.tag': 'Huge · 1.6 km · 7 flags · 32v32',
  'map.kuzey.desc': 'A 1.6 km HUGE map (not the small Valley): a mountain valley split by a river: Blue base to the south, Red to the north (helipads, vehicle depots). Seven flags: Radar Hill, the narrow-laned Village, the Stone Bridge in the middle, the Factory, the Dam in the eastern canyon, the Farm and the Logging Camp in the forest. The river is crossed only at the bridges, the dam crest and two shallow fords. 4-seat JEEPS at the bases and captured flags (E enter / exit): driver + 3 passengers who can shoot; they cross bridges and fords, sink in deep water.',
});
