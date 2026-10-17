// Resmi sunucu listesi: data/official.json (admin panelinden yönetilir). Dosya yoksa server/official.js varsayılanları.
// Sunucu: { code, name, desc, enabled, type, perTeam, time, diff, tickets (0 = otomatik), bots, third, shuffle (harita rastgele), rotation:[{ map, tod, weather }] }
// Liste sırası = oyundaki sunucu listesinin sırası (panelde sürükle-bırak).
import fs from 'node:fs';
import path from 'node:path';
import { DATA } from './balanceStore.js';
import { OFFICIAL } from './official.js';
import { sanitizeCfg } from './room.js';

const FILE = path.join(DATA, 'official.json');
export const OFFICIAL_MAX = 12;
export const MAPS_FOR = (type) => (type === 'inf' ? ['newyork'] : ['kasaba', 'vadi', 'us', 'colgecidi', 'depo', 'liman']);

const clean = (s, n) => String(s ?? '').replace(/[<>&"'`\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, n);

// Tek sunucuyu doğrula; kişi sayısı / süre / bilet sınırları oyuncu odalarıyla aynı (sanitizeCfg)
export function sanitizeOfficial(o, code) {
  const rot = (Array.isArray(o.rotation) ? o.rotation : []).slice(0, 8);
  const base = sanitizeCfg({ type: o.type, perTeam: +o.perTeam, time: +o.time, diff: o.diff, tickets: +o.tickets || 0, bots: o.bots !== false, third: o.third === true, map: rot[0]?.map });
  const maps = MAPS_FOR(base.type);
  const rotation = rot.map((r) => {
    const c = sanitizeCfg({ type: base.type, map: maps.includes(r && r.map) ? r.map : maps[0], tod: r && r.tod, weather: r && r.weather });
    return { map: c.map, tod: base.type === 'inf' ? 'night' : c.tod, weather: c.weather };
  });
  if (!rotation.length) rotation.push({ map: maps[0], tod: base.type === 'inf' ? 'night' : 'day', weather: 'clear' });
  return {
    code, name: clean(o.name, 32) || 'Resmi Sunucu', desc: clean(o.desc, 60), enabled: o.enabled !== false,
    type: base.type, perTeam: base.perTeam, time: base.time, diff: base.diff, tickets: base.tickets, bots: base.bots, third: base.third, shuffle: o.shuffle === true, rotation,
  };
}

let list = null;
export function officialList() {
  if (list) return list;
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* ilk açılış */ }
  const src = Array.isArray(raw) ? raw : OFFICIAL.map((o) => ({ ...o, enabled: true, tickets: 0, bots: true, third: false }));
  list = src.filter((o) => o && /^OFC\d{1,3}$/.test(o.code)).slice(0, OFFICIAL_MAX).map((o) => sanitizeOfficial(o, o.code));
  return list;
}
function persist() { const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(list, null, 1)); fs.renameSync(tmp, FILE); }

// Ekle / güncelle (code yoksa yeni). taken: oyuncu odalarının kodları (çakışma olmasın)
export function upsertOfficial(o, taken = new Set()) {
  const L = officialList();
  let code = typeof o.code === 'string' && L.some((x) => x.code === o.code) ? o.code : null;
  if (!code) {
    if (L.length >= OFFICIAL_MAX) throw Object.assign(new Error(`En çok ${OFFICIAL_MAX} resmi sunucu olabilir`), { code: 400 });
    for (let n = 1; ; n++) { const c = 'OFC' + n; if (!L.some((x) => x.code === c) && !taken.has(c)) { code = c; break; } }
  }
  const s = sanitizeOfficial(o, code), i = L.findIndex((x) => x.code === code);
  if (i >= 0) L[i] = s; else L.push(s);
  persist();
  return s;
}
export function removeOfficial(code) {
  const L = officialList(), i = L.findIndex((x) => x.code === code);
  if (i < 0) throw Object.assign(new Error('Sunucu bulunamadı'), { code: 404 });
  L.splice(i, 1);
  persist();
}
// Yeni sıra: bilinmeyen kodlar atılır, listede unutulanlar sona eklenir
export function reorderOfficial(codes) {
  const L = officialList(), want = Array.isArray(codes) ? codes.map(String) : [];
  const next = [...want.map((c) => L.find((o) => o.code === c)).filter(Boolean), ...L.filter((o) => !want.includes(o.code))];
  list = [...new Set(next)];
  persist();
}
export function setOfficialEnabled(code, on) {
  const o = officialList().find((x) => x.code === code);
  if (!o) throw Object.assign(new Error('Sunucu bulunamadı'), { code: 404 });
  o.enabled = !!on;
  persist();
  return o;
}
