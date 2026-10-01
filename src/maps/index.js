import { buildKasaba } from './kasaba.js';
import { buildVadi } from './vadi.js';
import { buildUs } from './us.js';

// Harita kaydı. Her harita build() ile şunu döndürür:
// { id, name, group, colliders, bounds, spawns:{blue,red}, objectives:[{id,name,x,z,r,core?}], roads?, terrain?, water?, env? }
// objectives içinde core:true olanlar 3v3'te de kullanılır.
export const MAPS = {
  kasaba: {
    id: 'kasaba', name: 'Kasaba', tag: 'Orta boy · karışık mesafe', thumb: '/img/kasaba.jpg',
    desc: 'Mavi çiftlik ↔ Kırmızı depo. Ortada benzinlik, pazar, kilise ve evler: bina içi çatışma ve cadde savaşı.',
    build: () => buildKasaba(),
  },
};
MAPS.vadi = {
  id: 'vadi', name: 'Vadi', tag: 'Büyük · uzun mesafe', thumb: '/img/vadi.jpg',
  desc: 'Nehirli vadi: tek köprü ve iki sığ geçit, ormanlı sırtlar. Keskin nişancılar için yamaçlar, yakın çatışma için köprü ve ahır.',
  build: () => buildVadi(),
};
MAPS.us = {
  id: 'us', name: 'Askeri Üs', tag: 'Orta boy · yakın mesafe', thumb: '/img/us.jpg',
  desc: 'Duvarlarla çevrili üs: 3 katlı komuta binası, hangar, radar kulesi, bunkerler ve konteyner sokakları. Kapalı alan ve kapı savaşı.',
  build: () => buildUs(),
};
export const DEFAULT_MAP = 'kasaba';
