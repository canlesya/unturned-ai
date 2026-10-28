// Admin paneli (admin.warbyte.io): yalnızca 127.0.0.1'de dinler, nginx alt alan adından yönlendirir.
// Giriş: tek admin şifresi (data/admin.json'da scrypt özeti). İlk açılışta rastgele şifre üretilir → data/admin-password.txt
// API: /api/login · /api/balance · /api/history · /api/revert · /api/rooms · /api/rooms/close · /api/rooms/kick · /api/announce · /api/password · /api/accounts (+ /delete, /reset) · /api/bans (+ /remove)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DATA, currentBalance, balanceMeta, balanceHistory, saveBalance } from './balanceStore.js';
import { defaults, LIMITS } from '../src/game/balance.js';
import { listAccounts, deleteAccount, resetPassword } from './accounts.js';
import { listBans, removeBan } from './moderation.js';
import { officialList, upsertOfficial, removeOfficial, setOfficialEnabled, reorderOfficial, OFFICIAL_MAX } from './officialStore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist-admin');
const AUTH = path.join(DATA, 'admin.json'), PWTXT = path.join(DATA, 'admin-password.txt');
const SESSION_MS = 7 * 24 * 3600 * 1000;

const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
function setPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(AUTH, JSON.stringify({ salt, hash: hashPw(pw, salt) }), { mode: 0o600 });
}
function checkPassword(pw) {
  try {
    const a = JSON.parse(fs.readFileSync(AUTH, 'utf8'));
    const h = Buffer.from(hashPw(String(pw), a.salt), 'hex'), want = Buffer.from(a.hash, 'hex');
    return h.length === want.length && crypto.timingSafeEqual(h, want);
  } catch { return false; }
}
if (!fs.existsSync(AUTH)) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  setPassword(pw);
  if (!process.env.ADMIN_PASSWORD) fs.writeFileSync(PWTXT, pw + '\n', { mode: 0o600 });
  console.log(`[admin] ilk şifre üretildi: ${PWTXT}`);
}

const sessions = new Map();            // jeton → bitiş zamanı
const fails = new Map();               // ip → [zamanlar]
const ipOf = (req) => String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
const cookieTok = (req) => (/(?:^|;\s*)wb_admin=([a-f0-9]{64})/.exec(req.headers.cookie || '') || [])[1];
function authed(req) {
  const t = cookieTok(req), e = t && sessions.get(t);
  if (!e) return false;
  if (e < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function tooMany(ip) {
  const now = Date.now(), l = (fails.get(ip) || []).filter((t) => now - t < 15 * 60000);
  fails.set(ip, l);
  return l.length >= 8;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function serveStatic(req, res) {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.join(DIST, path.normalize(rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file)) file = path.join(DIST, 'index.html');                  // tek sayfa
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404); res.end('Admin paneli derlenmemiş (npm run build)'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' });
    res.end(data);
  });
}

const herr = (code, msg) => Object.assign(new Error(msg), { code });
function send(res, code, obj, headers = {}) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 256 * 1024) { req.destroy(); resolve(null); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { resolve(null); } });
  });
}

// rooms: index.js'teki oda haritası (canlı)
export function startAdmin({ rooms, syncOfficial = () => {}, port = +process.env.ADMIN_PORT || 8788 }) {
  const roomList = () => [...rooms.values()].map((r) => ({
    ...r.info(), balVer: r.balVer || 0, soldiers: r.game?.soldiers.length || 0, perf: r.clients.size ? r.perfStats?.() || null : null,      // 12.203 oda başarımı (sim / ağ µs, istemci başına KB/sn)
    players: r.adminPlayers ? r.adminPlayers() : [...r.clients.values()].map((c) => { const s = r.game.soldiers[c.id]; return { id: c.id, name: c.name, team: s.team, cls: s.cls, kills: s.kills || 0, assists: s.assists || 0, deaths: s.deaths || 0 }; }),
  }));

  const officialState = () => ({
    max: OFFICIAL_MAX, limits: { ...LIMITS },
    list: officialList().map((o) => {
      const r = rooms.get(o.code);
      return { ...o, live: r && r.official ? { humans: r.humanCount, cap: r.cap, map: r.cfg.map, tod: r.cfg.tod, weather: r.cfg.weather, ended: r.game.ended, tl: r.game.timeLeft === Infinity ? -1 : Math.round(r.game.timeLeft) } : null };
    }),
  });

  const api = {
    'GET /api/me': () => ({ ok: true }),
    'POST /api/logout': (b, req) => { sessions.delete(cookieTok(req)); return { ok: true }; },
    'GET /api/balance': () => ({ overrides: currentBalance(), defaults: defaults(), meta: balanceMeta() }),
    'POST /api/balance': (b) => {
      if (!b.overrides || typeof b.overrides !== 'object') throw herr(400, 'Geçersiz veri');
      const r = saveBalance(b.overrides, b.note, defaults());
      console.log(`[admin] denge sürümü ${r.version}: ${r.changes.length} değişiklik`);
      return { ok: true, ...r, overrides: currentBalance(), meta: balanceMeta() };
    },
    'GET /api/history': () => balanceHistory().map(({ overrides, ...h }) => h),
    'POST /api/revert': (b) => {
      const h = balanceHistory().find((x) => x.version === b.version);
      if (!h && b.version !== 0) throw herr(404, 'Sürüm bulunamadı');
      const r = saveBalance(h ? h.overrides : {}, h ? `Sürüm ${h.version}'e dönüldü` : 'Varsayılanlara dönüldü', defaults());
      return { ok: true, ...r, overrides: currentBalance(), meta: balanceMeta() };
    },
    'GET /api/rooms': () => roomList(),
    'POST /api/rooms/close': (b) => {
      const r = rooms.get(String(b.code || ''));
      if (!r) throw herr(404, 'Oda yok');
      if (r.official) throw herr(400, 'Resmi odalar kapatılamaz');
      r.shutdown('Oda yönetici tarafından kapatıldı'); rooms.delete(r.code);
      console.log(`[admin] ${r.code} kapatıldı`);
      return { ok: true };
    },
    'POST /api/rooms/kick': (b) => {
      const r = rooms.get(String(b.code || '')), c = r && r.clients.get(b.id);
      if (!c) throw herr(404, 'Oyuncu yok');
      r.activate();
      try { c.ws.send(JSON.stringify({ t: 'chat', sys: 1, m: 'Yönetici tarafından odadan çıkarıldın' })); c.ws.send(JSON.stringify({ t: 'kicked', k: 'kick', ms: 0, r: '', adm: 1, m: 'Yönetici tarafından odadan çıkarıldın' })); c.ws.close(4002, 'kicked'); } catch { /* yok say */ }
      return { ok: true };
    },
    // Resmi sunucular: liste + canlı durum; kaydet / sil / aç-kapat sonrası odalar hemen eşitlenir
    'GET /api/official': () => officialState(),
    'POST /api/official/save': (b) => {
      if (!b.server || typeof b.server !== 'object') throw herr(400, 'Geçersiz veri');
      const s = upsertOfficial(b.server, new Set([...rooms.keys()].filter((c) => !rooms.get(c).official)));
      syncOfficial();
      console.log(`[admin] resmi sunucu kaydedildi: ${s.code} ${s.name}`);
      return { ok: true, code: s.code, ...officialState() };
    },
    'POST /api/official/delete': (b) => { removeOfficial(String(b.code || '')); syncOfficial(); return { ok: true, ...officialState() }; },
    'POST /api/official/order': (b) => { reorderOfficial(b.codes); return { ok: true, ...officialState() }; },
    'POST /api/official/toggle': (b) => { setOfficialEnabled(String(b.code || ''), !!b.enabled); syncOfficial(); return { ok: true, ...officialState() }; },
    'POST /api/announce': (b) => {
      const txt = String(b.text || '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      if (!txt) throw herr(400, 'Mesaj boş');
      let n = 0;
      for (const r of rooms.values()) if (!b.code || r.code === b.code) { r.broadcast({ t: 'chat', sys: 1, m: '📢 ' + txt }); n += r.humanCount; }
      return { ok: true, players: n };
    },
    // Oyuncu hesapları: liste, sil, şifre sıfırla (yeni şifre yalnız bu yanıtta bir kez görünür; dosyada yalnız özeti)
    'GET /api/accounts': () => listAccounts(),
    'POST /api/accounts/delete': (b) => { deleteAccount(String(b.name || '')); console.log(`[admin] hesap silindi: ${String(b.name).slice(0, 16)}`); return { ok: true }; },
    'POST /api/accounts/reset': async (b) => { const pw = await resetPassword(String(b.name || '')); console.log(`[admin] hesap şifresi sıfırlandı: ${String(b.name).slice(0, 16)}`); return { ok: true, pw }; },
    // Banlar (oyun içi /ban komutuyla eklenir, data/bans.json): liste + kaldır
    'GET /api/bans': () => listBans(),
    'POST /api/bans/remove': (b) => { const g = removeBan(String(b.name || '')); if (!g.length) throw herr(404, 'Ban bulunamadı'); console.log(`[admin] ban kaldırıldı: ${g.map((x) => x.name).join(', ')}`); return { ok: true }; },
    'POST /api/password': (b) => {
      if (!checkPassword(b.old)) throw herr(403, 'Mevcut şifre yanlış');
      if (typeof b.pw !== 'string' || b.pw.length < 8) throw herr(400, 'Yeni şifre en az 8 karakter olmalı');
      setPassword(b.pw);
      try { fs.unlinkSync(PWTXT); } catch { /* yok */ }
      sessions.clear();
      return { ok: true };
    },
  };

  const server = http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (!url.startsWith('/api/')) return serveStatic(req, res);
    if (req.method === 'POST' && req.headers['x-wb'] !== '1') return send(res, 403, { error: 'Geçersiz istek' });     // CSRF: başka siteden form gönderilemez
    const body = req.method === 'POST' ? await readBody(req) : {};
    if (body === null) return send(res, 400, { error: 'Geçersiz veri' });
    if (url === '/api/login' && req.method === 'POST') {
      const ip = ipOf(req);
      if (tooMany(ip)) return send(res, 429, { error: 'Çok fazla deneme, 15 dakika sonra tekrar dene' });
      if (!checkPassword(body.pw)) { fails.get(ip).push(Date.now()); return send(res, 403, { error: 'Şifre yanlış' }); }
      const tok = crypto.randomBytes(32).toString('hex');
      sessions.set(tok, Date.now() + SESSION_MS);
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      return send(res, 200, { ok: true }, { 'set-cookie': `wb_admin=${tok}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure}` });
    }
    if (!authed(req)) return send(res, 401, { error: 'Giriş gerekli' });
    const h = api[`${req.method} ${url}`];
    if (!h) return send(res, 404, { error: 'Yok' });
    try { send(res, 200, await h(body, req)); } catch (e) {
      if (e.code >= 400 && e.code < 500) return send(res, e.code, { error: e.message });
      console.error('[admin]', e); send(res, 500, { error: 'Sunucu hatası' });
    }
  });
  server.listen(port, '127.0.0.1', () => console.log(`[admin] panel 127.0.0.1:${port}`));
  return server;
}
