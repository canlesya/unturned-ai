import { buildKasaba } from './kasaba.js';
import { buildVadi } from './vadi.js';
import { buildUs } from './us.js';
import { buildDev } from './dev.js';
import { buildNewYork } from './newyork.js';

// Harita kaydı. Her harita build() ile şunu döndürür:
// { id, name, group, colliders, bounds, spawns:{blue,red}, objectives:[{id,name,x,z,r,core?}], roads?, terrain?, water?, env? }
// objectives içinde core:true olanlar 3v3'te de kullanılır.
export const MAPS = {
  kasaba: {
    id: 'kasaba', name: 'Kasaba', tag: 'Büyük · karışık mesafe', thumb: '/img/kasaba.jpg',
    desc: 'Taş duvarlı iki spawn avlusu, ortada çeşmeli meydan. Su kulesi ve kilise çan kulesi nişancı yuvaları; 2-3 katlı dolu evler, bahçe duvarları ve ara sokaklarla bina içi çatışma.',
    build: () => buildKasaba(),
  },
};
MAPS.vadi = {
  id: 'vadi', name: 'Vadi', tag: 'Büyük · uzun mesafe', thumb: '/img/vadi.jpg',
  desc: 'Nehirli vadi: tek köprü ve iki sığ geçit, ormanlı sırtlar. Keskin nişancılar için yamaçlar, yakın çatışma için köprü ve ahır.',
  build: () => buildVadi(),
};
MAPS.us = {
  id: 'us', name: 'Askeri Üs', tag: 'Büyük · katmanlı yakın mesafe', thumb: '/img/us.jpg',
  desc: 'Duvarlı askeri üs: 3 katlı komuta binası, iki hangar, radar kulesi, tüneller, bunkerler ve konteyner labirenti. Beş kapılı kamplar, her hedefe birden fazla rota.',
  build: () => buildUs(),
};
MAPS.dev = {
  id: 'dev', name: 'Geliştirici Atölyesi', tag: 'Test · tüm modeller', thumb: '/img/dev.jpg', dev: true,
  desc: 'Tüm araçlar, silahlar ve gadgetlar, binalar, duvar-merdiven-siper ve askeri yapılar etiketli sergi şeritlerinde. Rastgele harita seçimine girmez.',
  build: () => buildDev(),
};
MAPS.newyork = {
  id: 'newyork', name: 'New York', tag: 'Enfekte · gece · patlamış cadde', thumb: '/img/newyork.jpg', only: ['inf'], forceTod: 'night',
  desc: 'Enfekte moduna özel gece haritası: patlamış New York caddesi. Yıkık gökdelenler, yanan araçlar, devrik otobüsler, düşmüş helikopter, kraterler. İnsanlar meydan anıtına, kamyon kasalarına, metro girişlerine, çökmüş kat döşemesine, otoparka ve inşaat iskelesine çıkıp yüksekten savunur; zombiler koşup sıçrayarak peşlerinden gelir.',
  build: () => buildNewYork(),
};
export const DEFAULT_MAP = 'kasaba';
// Bu moda uygun haritalar (only: yalnızca o modlarda listelenir; dev hiçbirinde)
export const mapsFor = (type) => (type === 'inf' ? [MAPS.newyork] : Object.values(MAPS).filter((m) => !m.dev && (!m.only || m.only.includes(type))));      // Enfekte yalnızca New York'ta
