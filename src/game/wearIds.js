// 12.167 Kıyafet kaplamaları: kimlikler + kodlama (istemci / sunucu ortak; THREE yok). Modeller src/models/wear.js, adlar src/i18n/wear.js.
// Kıyafet kodu: 5 yuva × [parça, palet] = 10 rakam (baş, üst, sırt, pantolon, ayakkabı). '' = sınıf varsayılanı.
// Tercih (menü / hesap / ağ): { c: { sınıf: kod }, all: kod } — all doluysa "bu kombini tüm sınıflarda kullan".
export const WEAR_SLOTS = ['head', 'top', 'back', 'legs', 'feet'];
export const WEAR_ITEMS = {
  head: ['helmet', 'beanie', 'hood', 'gasmask', 'cap', 'heavyhelm', 'neonhelm'],
  top: ['carrier', 'kevlar', 'rig', 'jacket', 'neonvest'],
  back: ['none', 'pack', 'cape', 'shortcape', 'radio', 'lightcape'],
  legs: ['tactical', 'cargo', 'slim', 'neonlegs'],
  feet: ['boots', 'highboots', 'sneakers', 'glowsole'],
};
export const WEAR_PALS = ['std', 'desert', 'wood', 'urban', 'snow', 'gold', 'night'];
export const GLOW_ITEMS = ['neonhelm', 'neonvest', 'lightcape', 'neonlegs', 'glowsole'];
const P = (p, feet = 'std') => ({ head: p, top: p, back: p, legs: p, feet });
// Sınıf varsayılanları (oyun içi varsayılan kombin)
export const CLASS_WEAR = {
  assault: { head: 'helmet', top: 'carrier', back: 'pack', legs: 'tactical', feet: 'boots', pal: P('std') },
  medic: { head: 'helmet', top: 'rig', back: 'pack', legs: 'cargo', feet: 'sneakers', pal: P('std') },
  sniper: { head: 'hood', top: 'rig', back: 'cape', legs: 'cargo', feet: 'highboots', pal: P('wood') },
  heavy: { head: 'heavyhelm', top: 'kevlar', back: 'radio', legs: 'tactical', feet: 'highboots', pal: P('std') },
  engineer: { head: 'cap', top: 'jacket', back: 'radio', legs: 'cargo', feet: 'boots', pal: P('std') },
};
export const WEAR_CLASSES = Object.keys(CLASS_WEAR);
const clone = (w) => ({ ...w, pal: { ...w.pal } });
export const classWear = (cls) => clone(CLASS_WEAR[cls] || CLASS_WEAR.assault);

export function wearEncode(w) {
  return WEAR_SLOTS.map((s) => `${Math.max(0, WEAR_ITEMS[s].indexOf(w[s]))}${Math.max(0, WEAR_PALS.indexOf(w.pal?.[s] || 'std'))}`).join('');
}
export function cleanWearCode(c) {
  if (typeof c !== 'string' || !/^\d{10}$/.test(c)) return '';
  return WEAR_SLOTS.every((s, i) => +c[i * 2] < WEAR_ITEMS[s].length && +c[i * 2 + 1] < WEAR_PALS.length) ? c : '';
}
// kod → kombin (geçersiz / boş → sınıf varsayılanı)
export function wearDecode(code, cls = 'assault') {
  const c = cleanWearCode(code);
  if (!c) return classWear(cls);
  const w = { pal: {} };
  WEAR_SLOTS.forEach((s, i) => { w[s] = WEAR_ITEMS[s][+c[i * 2]]; w.pal[s] = WEAR_PALS[+c[i * 2 + 1]]; });
  return w;
}
// Ağdan / profilden gelen tercih: bilinen sınıf → geçerli kod; sınıf varsayılanına eşit kod yazılmaz; boşsa null
export function cleanWear(o) {
  if (!o || typeof o !== 'object') return null;
  const r = {}, c = {};
  if (o.c && typeof o.c === 'object') for (const k of WEAR_CLASSES) { const v = cleanWearCode(o.c[k]); if (v && v !== wearEncode(CLASS_WEAR[k])) c[k] = v; }
  if (Object.keys(c).length) r.c = c;
  const a = cleanWearCode(o.all); if (a) r.all = a;
  return Object.keys(r).length ? r : null;
}
// savaşçının şu anki sınıfı için kod ('' = varsayılan)
export const wearCodeOf = (pref, cls) => (pref && (pref.all || pref.c?.[cls])) || '';

// Botlar: sınıf varsayılanından küçük, belirlenimli (kimliğe bağlı) çeşitlilik; ışıklı parça yok, palet takım tonlarında kalır (nişancı Orman)
const ALT = {
  assault: { head: ['beanie', 'cap'], legs: ['cargo'], feet: ['highboots', 'sneakers'], back: ['none', 'radio'] },
  medic: { head: ['cap', 'beanie'], legs: ['tactical', 'slim'], feet: ['boots'], back: ['pack'] },
  sniper: { head: ['cap', 'beanie'], legs: ['tactical'], feet: ['boots'], back: ['shortcape'] },
  heavy: { head: ['helmet', 'gasmask'], legs: ['cargo'], feet: ['boots'], back: ['pack'] },
  engineer: { head: ['helmet', 'beanie'], legs: ['tactical'], feet: ['highboots', 'sneakers'], back: ['pack'] },
};
export function botWear(cls, id = 0) {
  const w = classWear(cls), a = ALT[cls] || ALT.assault;
  let h = (Math.imul((id | 0) + 1, 2654435761) >>> 0) ^ 0x5bd1e995;
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  for (const s of ['head', 'legs', 'feet', 'back']) if (rnd() < 0.3) w[s] = a[s][Math.floor(rnd() * a[s].length)];
  return w;
}
