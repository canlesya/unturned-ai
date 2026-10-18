// Maç sonu "sonraki maç" seçenekleri: sunucu (resmi oda oylaması) ve çevrimdışı maç aynı üreticiyi kullanır. DOM yok, saf işlev.
// Seçenek = { map, tod, weather, ri } (ri: resmi sunucu düzenindeki sıra, -1 = düzen dışı üretilmiş). İlk seçenek hep "oy gelmezse" seçilecek olandır.
import { mapsFor } from '../maps/index.js';

export const TODS = ['day', 'sunset', 'night'];
const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const randWeather = (rnd) => { const r = rnd(); return r < 0.7 ? 'clear' : r < 0.85 ? 'rain' : 'fog'; };       // çoğunlukla açık hava, ara sıra yağmur / sis

// type: maç modu · cur: şimdiki { map, tod, weather } · rotation: resmi sunucu düzeni (yoksa []) · first: düzende sıradaki indeks (yoksa null) · n: seçenek sayısı
export function nextOptions({ type, cur = {}, rotation = [], first = null, n = 3, rnd = Math.random }) {
  const maps = mapsFor(type).map((m) => m.id), tods = type === 'inf' ? ['night'] : TODS;       // Enfekte hep gece
  const list = [], k2 = (o) => o.map + '|' + o.tod, k3 = (o) => k2(o) + '|' + o.weather;
  const add = (o) => { if (list.length < n && !list.some((x) => k3(x) === k3(o))) list.push({ map: o.map, tod: o.tod, weather: o.weather || 'clear', ri: o.ri ?? -1 }); };
  if (first != null && rotation[first]) add({ ...rotation[first], ri: first });
  // aday havuzu: önce düzendeki haritalar (karışık), sonra moda uygun tüm harita × gün saati birleşimleri (karışık)
  const rot = shuffle(rotation.map((r, i) => ({ ...r, ri: i })).filter((r) => r.ri !== first && maps.includes(r.map)), rnd);
  const gen = shuffle(maps.flatMap((m) => tods.map((t) => ({ map: m, tod: t, weather: randWeather(rnd), ri: -1 }))), rnd);
  const pool = [...rot, ...gen];
  // geçişler: 1) farklı harita (şimdiki de dahil değil)  2) farklı harita + saat  3) farklı harita + saat + hava (tek haritalı modlar)
  const passes = [(o) => o.map !== cur.map && !list.some((x) => x.map === o.map), (o) => k2(o) !== k2(cur) && !list.some((x) => k2(x) === k2(o)), (o) => k3(o) !== k3(cur)];
  for (const ok of passes) for (const o of pool) if (list.length < n && ok(o)) add(o);
  if (type === 'inf' || maps.length === 1) for (const w of ['clear', 'rain', 'fog']) add({ map: maps[0], tod: tods[list.length % tods.length], weather: w, ri: -1 });
  if (!list.length) add({ map: cur.map || maps[0], tod: cur.tod || 'day', weather: cur.weather || 'clear', ri: -1 });
  return list;
}

// Oylama sonucu: en çok oy alan, eşitlikte rastgele; hiç oy yoksa ilk seçenek (resmi düzende sıradaki)
export function tallyVotes(counts, rnd = Math.random) {
  const max = Math.max(0, ...counts);
  if (!max) return 0;
  const top = counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
  return top[Math.floor(rnd() * top.length)];
}
