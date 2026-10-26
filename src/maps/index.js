import { buildKasaba } from './kasaba.js';
import { buildVadi } from './vadi.js';
import { buildUs } from './us.js';
import { buildDev } from './dev.js';
import { buildNewYork } from './newyork.js';
import { buildColGecidi } from './colgecidi.js';
import { buildDepo } from './depo.js';
import { buildLiman } from './liman.js';
import { buildBoyaKulesi } from './boyakulesi.js';
import { buildOrmanKale } from './ormankale.js';
import { buildMaden } from './maden.js';
import { buildCephe } from './cephe.js';
import { buildYorunge } from './yorunge.js';
import { buildKuzey } from './kuzey.js';
import '../i18n/kuzey.js';

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
MAPS.colgecidi = {
  id: 'colgecidi', name: 'Çöl Geçidi', tag: 'Büyük · üç hat · iki saha', thumb: '/img/colgecidi.jpg',
  desc: 'Klasik çöl haritası: uzun koridor, orta ve tüneller olmak üzere üç hat; A (pazar) ve B (avlu) sahaları. Kapalı yapı, her hatta farklı çatışma mesafesi.',
  build: () => buildColGecidi(),
};
MAPS.depo = {
  id: 'depo', name: 'Depo', tag: 'Küçük · hızlı · 4v4–5v5', thumb: '/img/depo.jpg', mobile: true,
  desc: 'Kompakt sanayi deposu: ortada içine girilen depo (B: raflar, iki merdivenli asma kat), batıda konteyner sahası (A), doğuda kamyonlu yükleme alanı (C). Kısa-orta mesafe, hızlı çatışma; telefonda rahat oynanacak şekilde sade ve okunaklı.',
  build: () => buildDepo(),
};
MAPS.liman = { id: 'liman', name: 'Liman', tag: 'Küçük · hızlı · mobil dostu', thumb: '/img/liman.jpg', mobile: true, desc: 'Kompakt konteyner sahası: üç hat, ortada tünelli ve çatısına çıkılan konteyner kulesi, rıhtımda dev gemi vinci, batıda portal vinç. 4v4–5v5 için hızlı, okunaklı çatışma; telefonda akıcı.', build: () => buildLiman() };
MAPS.boyakulesi = {
  id: 'boyakulesi', name: 'Boya Kulesi', tag: 'Paintball · üç kat · kuyu', thumb: '/img/boyakulesi.jpg', only: ['pb'],
  desc: 'Paintball moduna özel renkli arena: zeminde şişme siperler, köşelerde dört renkli kale (9 m), ortada 18 m kule. Kalelerden kuleye korkuluksuz köprüler kuyunun üstünden geçer; kuyuya düşen elenir. Zıplama minderleri zeminden kaleye fırlatır, kule tepesi en güçlü nokta.',
  build: () => buildBoyaKulesi(),
};
MAPS.ormankale = {
  id: 'ormankale', name: 'Orman Kalesi', tag: 'Paintball · orman · dere', thumb: '/img/ormankale.jpg', only: ['pb'], mobile: true,
  desc: 'Çam ormanında senaryo sahası: ortada surlu, iki katlı kütük kale ve 5,6 m gözcü kulesi. Güneyden sığ bir dere geçer (üç tahta köprü, devrik kütük); köşelerde kütük kulübe, boyalı lastik kuleli hurda köşesi, gözetleme kulesi ve saman tarlası. Yayvan, ağaçlarla bölünmüş kısa-orta mesafe.',
  build: () => buildOrmanKale(),
};
MAPS.maden = {
  id: 'maden', name: 'Maden Ocağı', tag: 'Vagon · saldırı / savunma · ray', thumb: '/img/maden.jpg', only: ['payload'], mobile: true,
  desc: 'Vagon moduna özel kayalık maden vadisi: patlayıcı yüklü vagon yükleme avlusundan Kırma Tesisi, A · Makas, köy caddesi, B · Kantar ve Lavvar üzerinden C · Maden Ağzı\'na raylarla gider. Her kontrol noktasında iki takımın doğuşu ileri kayar: savunan hep sıradaki noktanın ilerisinde doğar, çatışma ray boyunca döner. Kaya sırtları kestirmeleri kapatır; her bölümde bir ana hat, iki kanat ve savunana ahşap iskele (yüksek zemin) var.',
  build: () => buildMaden(),
};
MAPS.cephe = {
  id: 'cephe', name: 'Batı Cephesi', tag: 'Cephe · siperler · harap köy', thumb: '/img/cephe.jpg', only: ['front'],
  desc: 'Büyük 1940\'lar cephe hattı: iki ordunun zikzak siper ağları, beton sığınaklar ve makineli tüfek yuvaları, dikenli tel ve top mermisi kraterleriyle dolu ölüm bölgesi. Ortada harap köy, ardında çiftlik ve orman kenarı, en kuzeyde savunanın ana hattı.',
  build: () => buildCephe(),
};
MAPS.yorunge = {      // 12.157 Uzay modu
  id: 'yorunge', name: 'Yörünge Üssü', tag: 'Uzay · Ay yüzeyi · üç hat', thumb: '/img/yorunge.jpg', only: ['space'], forceTod: 'day', noWeather: true,
  desc: 'Ay yüzeyinde maden / araştırma üssü: ortada içine girilen cam kubbeli Merkez Modül (asma kat), hava kilidi koridorları, kuzeyde krater tarlası, güneş panelleri ve çatısına çıkılan anten istasyonu, güneyde iniş pisti ve küçük mekik. Düşük yer çekiminde yüksek platformlar ve köprüler; kaya sırtları doğal siper. Gökte Dünya.',
  build: () => buildYorunge(),
};
MAPS.kuzey = {      // 12.172 büyük harita (araçlar ileride): yalnız Ele Geçirme + Takım Çatışması
  id: 'kuzey', name: 'Kuzey Vadisi', tag: 'Dev · 1,6 km · 7 bayrak · 32v32', thumb: '/img/kuzey.jpg', only: ['conquest', 'tdm'],
  desc: 'Dağlarla çevrili, nehrin ikiye böldüğü büyük vadi: güneyde Mavi, kuzeyde Kırmızı üs. Yedi bayrak: Radar Tepesi, Köy, Taş Köprü, Fabrika, Baraj, Çiftlik, Kereste Kampı. Nehir yalnız köprülerden, baraj tepesinden ve iki sığ geçitten aşılır.',
  build: () => buildKuzey(),
};
export const DEFAULT_MAP = 'kasaba';
// Bu moda uygun haritalar (only: yalnızca o modlarda listelenir; dev hiçbirinde)
export const mapsFor = (type) => (type === 'space' ? [MAPS.yorunge] : type === 'inf' ? [MAPS.newyork] : type === 'pb' ? [MAPS.boyakulesi, MAPS.ormankale] : type === 'payload' ? [MAPS.maden] : type === 'front' ? [MAPS.cephe] : Object.values(MAPS).filter((m) => !m.dev && (!m.only || m.only.includes(type))));      // Enfekte yalnızca New York'ta, Paintball yalnızca paintball haritalarında (Boya Kulesi, Orman Kalesi)
