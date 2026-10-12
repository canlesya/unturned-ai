// Denge ayarlarının kalıcı deposu: data/balance.json (+ sürüm geçmişi). data/ git dışında: deploy'da silinmez.
// currentBalance() aynı nesneyi döndürür (kimlik değişmedikçe odalar useBalance'ta yeniden uygulama yapmaz).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeBalance } from '../src/game/balance.js';

export const DATA = process.env.BF_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = path.join(DATA, 'balance.json'), HIST = path.join(DATA, 'balance-history.json');
const HIST_MAX = 60;

fs.mkdirSync(DATA, { recursive: true });
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
function writeJSON(f, v) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(v, null, 1)); fs.renameSync(tmp, f); }     // yarım dosya kalmasın

let cur = null, meta = { version: 0, savedAt: 0, note: '' };
let history = readJSON(HIST, []);

// Sunucu açılışında (resmi odalar kaydedildikten sonra) çağrılır: bilinmeyen / aralık dışı alanlar atılır
export function loadBalance() {
  const f = readJSON(FILE, null);
  cur = Object.freeze(sanitizeBalance(f && f.overrides));
  if (f) meta = { version: f.version || 0, savedAt: f.savedAt || 0, note: f.note || '' };
  return cur;
}
export const currentBalance = () => cur || loadBalance();
export const balanceMeta = () => meta;
export const balanceHistory = () => history;

// Yeni sürüm: değişiklik listesi geçmişe yazılır. Dönüş: { version, changes }
export function saveBalance(overrides, note = '', defaults = {}) {
  const next = sanitizeBalance(overrides), prev = currentBalance();
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]), changes = [];
  for (const k of keys) {
    const a = k in prev ? prev[k] : defaults[k], b = k in next ? next[k] : defaults[k];
    if (a !== b) changes.push({ path: k, from: a, to: b });
  }
  if (!changes.length) return { version: meta.version, changes };
  meta = { version: meta.version + 1, savedAt: Date.now(), note: String(note || '').slice(0, 200) };
  cur = Object.freeze(next);
  writeJSON(FILE, { ...meta, overrides: next });
  history.unshift({ ...meta, overrides: next, changes });
  history = history.slice(0, HIST_MAX);
  writeJSON(HIST, history);
  return { version: meta.version, changes };
}
