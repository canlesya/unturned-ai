// İstemci hesap katmanı: oturum (localStorage 'warbyte.acct'), hesap API çağrıları, profil eşitleme. Arayüz (giriş kartı) menu.js'te.
// Oturum: { kind:'guest' } ya da { kind:'acct', name, tok }. Jeton yalnız Authorization başlığında / WS hello'da gider (URL'ye hiç yazılmaz).
import { healthUrl, defaultServerUrl, ACCT_NAME_RE } from './net/protocol.js';
import { t } from './i18n/index.js';
import './i18n/account.js';

const KEY = 'warbyte.acct';
export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && (s.kind === 'guest' || (s.kind === 'acct' && typeof s.name === 'string' && /^[a-f0-9]{64}$/.test(s.tok || '')))) return s;
  } catch { /* bozuk kayıt: oturum yok */ }
  return null;
}
export function setSession(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* özel pencere: yalnız bu sayfa açıkken */ } }
export function clearSession() { try { localStorage.removeItem(KEY); } catch { /* yok say */ } }
export const acctTok = () => { const s = getSession(); return s && s.kind === 'acct' ? s.tok : undefined; };
export const validAcctName = (n) => ACCT_NAME_RE.test(n);

// API kökü: oyun sunucusunun HTTP adresi (canlıda https://warbyte.io aynı köken, geliştirmede http://127.0.0.1:8787)
export const apiBase = (server) => healthUrl((server || '').trim() || defaultServerUrl()).replace(/\/health$/, '');
export async function api(base, method, path, body, tok) {
  const h = {};
  if (body) h['content-type'] = 'application/json';
  if (tok) h.authorization = 'Bearer ' + tok;
  let r;
  try { r = await fetch(base + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', keepalive: method === 'PUT' }); } catch { throw Object.assign(new Error(t('acct.err.net')), { key: 'net', status: 0 }); }
  let j = {};
  try { j = await r.json(); } catch { /* boş yanıt */ }
  if (!r.ok) throw Object.assign(new Error(acctErr(j.key, j.error)), { key: j.key, status: r.status });
  return j;
}
// Sunucunun Türkçe hata metni seçili dile anahtarla çevrilir
export const acctErr = (key, fallback) => (key && t('acct.err.' + key) !== 'acct.err.' + key ? t('acct.err.' + key) : fallback || t('acct.err.server'));

// Profil (seviye / istatistik): yerel ile sunucudakinin alan alan büyüğü; sunucu da aynı kuralla birleştirir (hiç azalmaz)
const STAT_KEYS = ['matches', 'wins', 'kills', 'deaths', 'assists'];      // assists: 12.165 (eski profilde yok → 0)
export const profileOf = (p) => ({ xp: p.xp || 0, stats: Object.fromEntries(STAT_KEYS.map((k) => [k, (p.stats && p.stats[k]) || 0])) });
export function maxProfile(a, b) {
  return { xp: Math.max(a.xp || 0, b.xp || 0), stats: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(a.stats?.[k] || 0, b.stats?.[k] || 0)])) };
}
export const sameProfile = (a, b) => a.xp === b.xp && STAT_KEYS.every((k) => a.stats[k] === b.stats[k]);
