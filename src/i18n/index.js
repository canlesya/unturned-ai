// Dil desteği (şimdilik tr + en). Kullanım: import { t } from '../i18n/index.js'; t('hud.kill', { name })  → seçili dildeki metin.
// Sözlükler alana göre ayrı dosyalarda, kendilerini addStrings ile kaydeder (src/i18n/menu.js, src/i18n/game.js, src/i18n/data.js …): ajanlar / ekipler çakışmasın.
// Anahtar bulunamazsa önce Türkçe, o da yoksa anahtarın kendisi döner (eksik çeviri oyunu bozmaz). Sunucuda (Node) localStorage / navigator yok: tr.
const DICTS = { tr: {}, en: {} };
export const LANGS = [['tr', 'Türkçe'], ['en', 'English']];
const KEY = 'warbyte.lang';
function detect() {
  try { const s = globalThis.localStorage?.getItem(KEY); if (s && DICTS[s]) return s; } catch { /* yok say */ }
  if (!globalThis.document) return 'tr';                                  // Node ≥ 21'de de navigator.language var ('en-US'): sunucu metinleri (maç sonu gerekçesi) Türkçe kalsın
  const n = globalThis.navigator?.language || 'tr';
  return n.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}
let cur = detect();
const subs = new Set();
export const lang = () => cur;
export function setLang(l) {
  if (!DICTS[l] || l === cur) return;
  cur = l;
  try { globalThis.localStorage?.setItem(KEY, l); } catch { /* yok say */ }
  if (globalThis.document) document.documentElement.lang = l;
  for (const f of subs) f(l);
}
// Dil değişince yeniden çizilecek arayüzler: const off = onLang(() => render());
export const onLang = (f) => { subs.add(f); return () => subs.delete(f); };
export function t(key, vars) {
  let s = DICTS[cur][key] ?? DICTS.tr[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}
export function addStrings(l, obj) { Object.assign((DICTS[l] ||= {}), obj); }
if (globalThis.document) document.documentElement.lang = cur;
