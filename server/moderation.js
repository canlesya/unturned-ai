// Moderasyon (12.136): sohbet komutları (/kick /ban /unban /bans /oyuncular /yardim) + sunucu geneli ban deposu.
// Yetki: data/mods.json (hesap adları dizisi) HER komutta diskten okunur (canlıda yeniden başlatmadan düzenlenir); dosya yoksa ["admin"].
//   Yalnız geçerli hesap jetonuyla giren oyuncu moderatör olabilir (misafir asla: misafir kayıtlı adı alamaz, guestName sayı ekler).
// Ban deposu: data/bans.json (geçici dosya + rename). Dosya elle değişirse (mtime) bir sonraki kontrolde yeniden okunur; süresi dolan kayıt temizlenir.
//   Kayıt: { name, key (nameKey), acct (hesap mı), ip, by, reason, at, until (0 = kalıcı) }
//   Eşleşme: hesap banı → aynı hesap adı; misafir banı → aynı ad anahtarlı misafir; ikisinde de aynı IP (IP kısmı en çok IP_MS sürer: paylaşılan / değişen IP masumu kalıcı kilitlemesin).
//   Moderatörler IP eşleşmesinden muaf (aynı evden / yerelden giren moderatör kilitlenmesin).
// Kick: kayıt diske yazılmaz; bellekte KICK_MS boyunca aynı ad / IP odaya giremez (atılan anında geri dönmesin).
import fs from 'node:fs';
import path from 'node:path';
import { DATA } from './balanceStore.js';
import { nameKey, isReserved, validName } from './accounts.js';

const MODS = path.join(DATA, 'mods.json'), BANS = path.join(DATA, 'bans.json');
export const KICK_MS = 2 * 60000;
const IP_MS = 7 * 24 * 3600 * 1000;
const MAX_MS = 365 * 24 * 3600 * 1000;
const DEFAULT_MODS = ['admin'];

// ───── yetki ─────
export function modKeys() {
  try {
    const v = JSON.parse(fs.readFileSync(MODS, 'utf8'));
    if (Array.isArray(v)) return v.filter((s) => typeof s === 'string').map(nameKey);
    console.error('[mod] mods.json dizi değil, varsayılan kullanılıyor');
  } catch (e) { if (e.code !== 'ENOENT') console.error('[mod] mods.json okunamadı:', e.message); }
  return DEFAULT_MODS.map(nameKey);
}
// who: ws.who = { name, key, acct, ip } (index.js katılımda doldurur)
export const isMod = (who, keys = modKeys()) => !!(who && who.acct && keys.includes(who.key));

// ───── ban deposu ─────
let bans = [], mtime = -1;
const kicks = [];                                         // { key, acct, ip, until, reason } (yalnız bellek)
function load() {
  let st = null;
  try { st = fs.statSync(BANS); } catch { /* yok */ }
  const mt = st ? st.mtimeMs : 0;
  if (mt === mtime) return;
  mtime = mt;
  bans = [];
  if (!st) return;
  try { const v = JSON.parse(fs.readFileSync(BANS, 'utf8')); if (Array.isArray(v)) bans = v.filter((b) => b && typeof b.key === 'string'); } catch (e) { console.error('[mod] bans.json okunamadı:', e.message); }
}
function persist() {
  const tmp = BANS + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(bans, null, 1), { mode: 0o600 });          // IP içerir
  fs.renameSync(tmp, BANS);
  try { mtime = fs.statSync(BANS).mtimeMs; } catch { /* yok say */ }
}
function prune(now) {
  load();
  const n = bans.length;
  bans = bans.filter((b) => !b.until || b.until > now);
  if (bans.length !== n) persist();
  for (let i = kicks.length - 1; i >= 0; i--) if (kicks[i].until <= now) kicks.splice(i, 1);
}
export function listBans(now = Date.now()) { prune(now); return bans.map((b) => ({ ...b })); }

const ipLive = (b, now) => b.ip && now < Math.min(b.until || Infinity, (b.at || 0) + IP_MS);
// Girişte: banlı / yeni atılmış mı? Dönüş { k:'ban'|'kick', until, reason } ya da null
export function checkBan(who, now = Date.now(), mod = isMod(who)) {
  prune(now);
  const hit = (b) => (b.key === who.key && !!b.acct === !!who.acct) || (!mod && who.ip && b.ip === who.ip && (b.k === 'kick' ? true : ipLive(b, now)));
  const b = bans.find(hit);
  if (b) return { k: 'ban', until: b.until || 0, reason: b.reason || '' };
  const k = kicks.find((x) => hit({ ...x, k: 'kick' }));
  if (k) return { k: 'kick', until: k.until, reason: k.reason || '' };
  return null;
}
export function addBan(entry, now = Date.now()) {
  prune(now);
  bans = bans.filter((b) => !(b.key === entry.key && !!b.acct === !!entry.acct));     // aynı kişiye yeni ban eskisinin yerine geçer
  bans.push({ ...entry, at: now });
  persist();
}
export function addKick(entry, now = Date.now()) { kicks.push({ ...entry, until: now + KICK_MS }); }
// Ad (büyük / küçük harf duyarsız) ya da /bans listesindeki sıra no (1..). Dönüş: kaldırılan kayıtlar
export function removeBan(q, now = Date.now()) {
  prune(now);
  const s = String(q || '').trim();
  let gone;
  if (/^\d{1,2}$/.test(s)) { const i = +s - 1; gone = bans[i] ? bans.splice(i, 1) : []; }          // 1–99: ad olamaz (ad en az 3 karakter)
  else { const k = nameKey(s); gone = bans.filter((b) => b.key === k); bans = bans.filter((b) => b.key !== k); }
  if (gone.length) persist();
  const k = nameKey(s);
  for (let i = kicks.length - 1; i >= 0; i--) if (kicks[i].key === k || gone.some((g) => g.key === kicks[i].key)) kicks.splice(i, 1);
  return gone;
}

// ───── süre / metin ─────
const UNIT = { s: 1e3, sn: 1e3, m: 6e4, dk: 6e4, h: 36e5, sa: 36e5, d: 864e5, g: 864e5, w: 6048e5, hf: 6048e5 };
// '30m' → ms, 'kalıcı' → 0, tanınmazsa null
export function parseDur(s) {
  const t = String(s || '').toLocaleLowerCase('tr');
  if (/^(kal[ıi]c[ıi]|perm(anent)?|sonsuz|forever)$/.test(t)) return 0;
  const m = /^(\d{1,5})(sn|s|dk|m|sa|h|g|d|hf|w)$/.exec(t);
  if (!m) return null;
  return Math.min(MAX_MS, Math.max(1000, +m[1] * UNIT[m[2]]));
}
export function durText(ms) {
  if (!ms) return 'kalıcı';
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} sn`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return mm ? `${h} sa ${mm} dk` : `${h} sa`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d} gün ${hh} sa` : `${d} gün`;
}
// Sunucunun Türkçe düz metni (istemci ban nesnesinden kendi dilinde yazar; eski istemci bu metni görür)
export function banMsg(b, now = Date.now()) {
  const r = b.reason ? ` · Sebep: ${b.reason}` : '';
  if (b.k === 'kick') return `Odadan atıldın · ${durText(b.until - now)} sonra tekrar girebilirsin${r}`;
  return b.until ? `Bu sunucudan banlandın · kalan süre: ${durText(b.until - now)}${r}` : `Bu sunucudan kalıcı olarak banlandın${r}`;
}
// İstemciye giden ban nesnesi: kalan süre ms (saat farkı sorun olmasın), 0 = kalıcı
export const banWire = (b, now = Date.now()) => ({ k: b.k, ms: b.until ? Math.max(0, b.until - now) : 0, r: b.reason || '' });

// ───── komutlar ─────
const CMD = {
  kick: 'kick', at: 'kick', kik: 'kick',
  ban: 'ban', yasakla: 'ban',
  unban: 'unban', bankaldir: 'unban', bankaldır: 'unban', affet: 'unban',
  bans: 'bans', banlar: 'bans', banlist: 'bans',
  oyuncular: 'players', players: 'players', list: 'players', liste: 'players', who: 'players',
  yardim: 'help', yardım: 'help', help: 'help', komutlar: 'help', '?': 'help',
};
const HELP = [
  'Moderatör komutları:',
  '/oyuncular — odadakiler ve numaraları',
  '/kick <oyuncu> [sebep] — odadan at (2 dk geri giremez)',
  '/ban <oyuncu> [süre] [sebep] — süre: 30m, 2h, 1d, 1w, kalıcı (varsayılan kalıcı)',
  '/unban <ad | sıra no> — banı kaldır',
  '/bans — aktif banlar',
  'Oyuncu: ad ya da baş harfleri (tek eşleşme), #numara ya da "boşluklu ad"',
];
// Tırnaklı parçaları bir arada tutan bölücü: /kick "Ali 2" küfür → ['/kick', 'Ali 2', 'küfür']
function tokens(s) {
  const out = []; const re = /"([^"]*)"|(\S+)/g; let m;
  while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

// ctx: { rooms (Map), room, client {ws,name,id}, now }. Dönüş: yalnız gönderene gidecek satırlar
export function runCommand(text, ctx) {
  const { room, client: me, rooms } = ctx, now = ctx.now || Date.now();
  const say = [];
  const keys = modKeys();
  if (!isMod(me.ws.who, keys)) return ['Bu komutu kullanma yetkin yok'];
  const tk = tokens(text.slice(1));
  const cmd = CMD[(tk.shift() || '').toLocaleLowerCase('tr')];
  if (!cmd) return ['Bilinmeyen komut · /yardim yaz'];
  const log = (s) => console.log(`[mod] ${me.ws.who.name} (${room.code}): ${s}`);

  if (cmd === 'help') return HELP;
  if (cmd === 'players') {
    const l = [...room.clients.values()].map((c) => `#${c.id} ${c.name}${c.ws.who?.acct ? (isMod(c.ws.who, keys) ? ' (mod)' : ' (hesap)') : ' (misafir)'}`);
    return [`Odadaki oyuncular (${l.length}): ` + l.join(' · ')];
  }
  if (cmd === 'bans') {
    const l = listBans(now);
    if (!l.length && !kicks.length) return ['Aktif ban yok'];
    const out = l.map((b, i) => `${i + 1}) ${b.name} · ${b.acct ? 'hesap' : 'misafir'} · ${b.until ? durText(b.until - now) + ' kaldı' : 'kalıcı'}${b.reason ? ' · ' + b.reason : ''} · ${b.by}`);
    if (kicks.length) out.push(`Yeni atılanlar (giriş engeli): ${kicks.map((k) => `${k.name} ${durText(k.until - now)}`).join(' · ')}`);
    return [`Aktif banlar (${l.length}):`, ...out];
  }
  if (cmd === 'unban') {
    if (!tk.length) return ['Kullanım: /unban <ad | sıra no>  (sıra no: /bans)'];
    const gone = removeBan(tk.join(' '), now);
    if (!gone.length) return [`"${tk.join(' ')}" için ban bulunamadı (atma engeli varsa kaldırıldı)`];
    log(`/unban ${gone.map((b) => b.name).join(', ')}`);
    return [`Ban kaldırıldı: ${gone.map((b) => b.name).join(', ')}`];
  }

  // kick / ban: hedef
  if (!tk.length) return [cmd === 'kick' ? 'Kullanım: /kick <oyuncu> [sebep]' : 'Kullanım: /ban <oyuncu> [süre] [sebep]'];
  const q = tk.shift();
  let dur = 0;
  if (cmd === 'ban' && tk.length && parseDur(tk[0]) !== null) dur = parseDur(tk.shift());
  const reason = tk.join(' ').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const found = findTarget(room, q);
  if (found.err) {
    // odada yok: ban için adla (oyuncu çıkmış olabilir) — diğer odalarda tam ad, yoksa çevrimdışı ad
    if (cmd !== 'ban' || found.many) return [found.err];
    const other = findExact(rooms, q);
    if (other) return doBan(other, dur, reason);
    if (!validName(q) && nameKey(q).length < 3) return [found.err];
    const acct = isReserved(q), key = nameKey(q);
    if (acct && keys.includes(key)) return ['Moderatör banlanamaz'];
    const entry = { name: q, key, acct, ip: '', by: me.ws.who.name, reason, until: dur ? now + dur : 0 };
    addBan(entry, now);
    enforce(rooms, entry, now);
    log(`/ban ${q} (çevrimdışı) ${durText(dur)} ${reason}`);
    return [`${q} banlandı (çevrimdışı, ${acct ? 'hesap' : 'misafir adı'}) · ${durText(dur)}${reason ? ' · ' + reason : ''}`];
  }
  const t = found.c;
  if (t.ws === me.ws || (t.ws.who && me.ws.who && t.ws.who.acct && t.ws.who.key === me.ws.who.key)) return [cmd === 'kick' ? 'Kendini atamazsın' : 'Kendini banlayamazsın'];
  if (isMod(t.ws.who, keys)) return [cmd === 'kick' ? 'Moderatör atılamaz' : 'Moderatör banlanamaz'];
  if (cmd === 'kick') {
    const w = t.ws.who || { name: t.name, key: nameKey(t.name), acct: false, ip: '' };
    addKick({ name: w.name, key: w.key, acct: w.acct, ip: w.ip, reason }, now);
    disconnect(room, t, { k: 'kick', until: now + KICK_MS, reason }, now);
    room.sys(`${t.name} odadan atıldı${reason ? ' · ' + reason : ''}`);
    log(`/kick ${t.name} ${reason}`);
    return [`${t.name} atıldı (2 dk giriş engeli)`];
  }
  return doBan({ room, c: t }, dur, reason);

  function doBan({ room: r, c }, d, why) {
    if (c.ws === me.ws) return ['Kendini banlayamazsın'];
    if (isMod(c.ws.who, keys)) return ['Moderatör banlanamaz'];
    const w = c.ws.who || { name: c.name, key: nameKey(c.name), acct: false, ip: '' };
    const entry = { name: w.name, key: w.key, acct: !!w.acct, ip: w.ip || '', by: me.ws.who.name, reason: why, until: d ? now + d : 0 };
    addBan(entry, now);
    const n = enforce(rooms, entry, now);
    const label = d ? durText(d) : 'kalıcı';
    log(`/ban ${w.name} ${label} ${why} (${n} bağlantı kesildi)`);
    return [`${w.name} banlandı · ${label}${why ? ' · ' + why : ''}`];
  }
}

// Odada hedef: #no, tam ad, tek eşleşen önek (büyük / küçük harf, ı / i duyarsız)
function findTarget(room, q) {
  const list = [...room.clients.values()];
  const no = /^#(\d+)$/.exec(q);
  if (no) { const c = room.clients.get(+no[1]); return c ? { c } : { err: `#${no[1]} numaralı oyuncu yok · /oyuncular` }; }
  const k = nameKey(q);
  const exact = list.filter((c) => nameKey(c.name) === k || (c.ws.who && c.ws.who.key === k));
  if (exact.length === 1) return { c: exact[0] };
  const pre = list.filter((c) => nameKey(c.name).startsWith(k));
  if (pre.length === 1) return { c: pre[0] };
  if (pre.length > 1) return { many: true, err: `Birden çok eşleşme: ${pre.map((c) => `#${c.id} ${c.name}`).join(' · ')}` };
  return { err: `"${q}" odada yok · /oyuncular` };
}
function findExact(rooms, q) {
  const k = nameKey(q);
  for (const r of rooms.values()) {
    for (const c of r.clients.values()) if (nameKey(c.name) === k || (c.ws.who && c.ws.who.key === k)) return { room: r, c };
    for (const p of r.pending) if (p.ws.who && p.ws.who.key === k) return { room: r, c: { ws: p.ws, name: p.ws.who.name, id: -1 } };     // maç sonu bekleme listesinde
  }
  return null;
}

// Banlanan kişinin tüm bağlantıları (her odada, oyunda ya da maç sonu bekleme listesinde) kesilir. Dönüş: kesilen bağlantı sayısı
export function enforce(rooms, entry, now = Date.now()) {
  let n = 0;
  const b = { k: 'ban', until: entry.until, reason: entry.reason };
  const hit = (w) => w && !isMod(w) && ((w.key === entry.key && !!w.acct === !!entry.acct) || (entry.ip && w.ip === entry.ip));
  for (const r of rooms.values()) {
    for (const c of [...r.clients.values()]) if (hit(c.ws.who)) { r.activate?.(); disconnect(r, c, b, now); r.sys(`${c.name} banlandı${entry.reason ? ' · ' + entry.reason : ''}`); n++; }
    for (const p of [...r.pending]) if (hit(p.ws.who)) { r.leave(-1, p.ws); refuse(p.ws, b, now); n++; }
  }
  return n;
}

// Oyundaki oyuncuyu çıkar: önce sebep ('kicked'), sonra odadan sessizce düş (ayrıldı mesajı yerine atıldı / banlandı yazılır), bağlantı kapanır
export function disconnect(room, c, b, now = Date.now()) {
  const ws = c.ws;
  ws.dead = true;
  try { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'kicked', ...banWire(b, now), m: banMsg(b, now) })); } catch { /* yok say */ }
  room.leave(c.id, ws, true);
  ws.ctx = null;
  closeSoon(ws, b.k === 'ban' ? 4004 : 4003, b.k === 'ban' ? 'banned' : 'kicked');
}
// Girişte ret (ya da bekleme listesindeyken ban): 'err' + ban nesnesi, bağlantı kapanır
export function refuse(ws, b, now = Date.now()) {
  ws.dead = true; ws.ctx = null;
  try { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'err', msg: banMsg(b, now), ban: banWire(b, now) })); } catch { /* yok say */ }
  closeSoon(ws, b.k === 'ban' ? 4004 : 4003, b.k === 'ban' ? 'banned' : 'kicked');
}
function closeSoon(ws, code, why) {
  try { ws.close(code, why); } catch { /* yok say */ }
  setTimeout(() => { try { ws.terminate(); } catch { /* yok say */ } }, 2000).unref?.();        // kapanışa cevap vermeyen istemci
}
