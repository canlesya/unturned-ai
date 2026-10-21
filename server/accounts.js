// Oyuncu hesapları: ad + şifre (e-posta yok). Depo data/accounts.json (geçici dosya + rename: yarım dosya kalmaz), sunucu açılışında belleğe okunur.
// Şifre: crypto.scrypt (kullanıcı başına 16 bayt tuz, 64 bayt özet), düz şifre hiç yazılmaz / loglanmaz. Oturum: 32 bayt rastgele jeton, dosyada yalnız sha256 özeti, 90 gün, cihaz başına bir (en çok 10).
// HTTP: /api/register · /api/login · /api/logout · /api/me · /api/profile (GET / PUT) — oyun sunucusunun kendi portunda (index.js handleApi), admin için ayrı yardımcılar.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA } from './balanceStore.js';
import { ACCT_NAME_RE as NAME_RE } from '../src/net/protocol.js';

const FILE = path.join(DATA, 'accounts.json');
export const SESSION_MS = 90 * 24 * 3600 * 1000;
const MAX_SESS = 10, BODY_MAX = 4096;
const RATE_N = +process.env.BF_ACC_RATE || 10, RATE_MS = 60000;               // giriş / kayıt: IP başına dakikada 10 deneme
const PROFILE_MAX = { xp: 1e8, matches: 1e6, wins: 1e6, kills: 1e8, deaths: 1e8 };

// Ad anahtarı: büyük / küçük harf ve noktalı / noktasız i farkı yok sayılır (ALİ = Ali = ALI = alı)
export const nameKey = (n) => String(n || '').toLocaleLowerCase('tr').replace(/ı/g, 'i');
export const validName = (n) => typeof n === 'string' && NAME_RE.test(n);

let db = null;                        // anahtar → hesap
const byTok = new Map();              // jeton özeti → anahtar
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function load() {
  if (db) return db;
  db = {};
  try { const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (raw && typeof raw === 'object') db = raw; } catch { /* ilk açılış */ }
  byTok.clear();
  for (const [k, a] of Object.entries(db)) for (const s of a.sess || []) byTok.set(s.h, k);
  return db;
}
function persist() { const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 }); fs.renameSync(tmp, FILE); }

const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));   // eşzamansız: oyun döngüsünü kilitlemez
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
async function hashPw(pw) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: (await scrypt(pw, salt)).toString('hex') }; }
async function checkPw(a, pw) {
  const h = await scrypt(String(pw), a ? a.salt : DUMMY_SALT);                 // hesap yoksa da aynı iş yapılır (zamanlamadan ad sızmasın)
  if (!a) return false;
  const want = Buffer.from(a.hash, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}
const err = (code, key, msg) => Object.assign(new Error(msg), { code, key });

// Yeni oturum: düz jeton yalnız istemciye döner
function newSession(a, now) {
  const tok = crypto.randomBytes(32).toString('hex'), h = sha(tok);
  a.sess = (a.sess || []).filter((s) => s.exp > now);
  while (a.sess.length >= MAX_SESS) byTok.delete(a.sess.shift().h);             // en eski cihaz düşer
  a.sess.push({ h, exp: now + SESSION_MS });
  byTok.set(h, a.key);
  a.seen = now;
  return tok;
}
const pub = (a) => ({ name: a.name, created: a.created, profile: a.profile });

export async function register(name, pw, now = Date.now(), profile = null) {
  load();
  if (!validName(name)) throw err(400, 'name', 'Ad 3–16 karakter olmalı (harf, rakam, _)');
  if (typeof pw !== 'string' || pw.length < 4 || pw.length > 128) throw err(400, 'pass', 'Şifre en az 4 karakter olmalı');
  const key = nameKey(name);
  if (db[key]) throw err(409, 'taken', 'Bu ad alınmış');
  const h = await hashPw(pw);
  if (db[key]) throw err(409, 'taken', 'Bu ad alınmış');                     // scrypt beklerken aynı ad kaydolduysa
  const a = db[key] = { key, name, ...h, created: now, seen: now, profile: mergeProfile(null, profile), sess: [] };
  const tok = newSession(a, now);
  persist();
  return { tok, ...pub(a) };
}
export async function login(name, pw, now = Date.now()) {
  load();
  const a = typeof name === 'string' ? db[nameKey(name)] : null;
  if (!(await checkPw(a, pw)) || !db[a.key]) throw err(403, 'wrong', 'Ad ya da şifre yanlış');
  const tok = newSession(a, now);
  persist();
  return { tok, ...pub(a) };
}
// Jeton → hesap (süresi geçmişse null ve oturum silinir). Eşzamanlı: WS katılımında da kullanılır
export function byToken(tok, now = Date.now()) {
  load();
  if (typeof tok !== 'string' || !/^[a-f0-9]{64}$/.test(tok)) return null;
  const h = sha(tok), k = byTok.get(h), a = k && db[k];
  if (!a) return null;
  const s = a.sess.find((x) => x.h === h);
  if (!s || s.exp <= now) { a.sess = a.sess.filter((x) => x.h !== h); byTok.delete(h); persist(); return null; }
  if (now - (a.seen || 0) > 10 * 60000) { a.seen = now; persist(); }           // son görülme: 10 dk'da bir yazılır
  return a;
}
export function logout(tok) {
  const a = byToken(tok);
  if (!a) return false;
  const h = sha(tok);
  a.sess = a.sess.filter((x) => x.h !== h); byTok.delete(h); persist();
  return true;
}
// Kayıtlı ad mı (misafir bu adı alamaz)
export const isReserved = (name) => !!load()[nameKey(name)];
// Misafir adı kayıtlı bir hesabınkiyle çakışıyorsa sonuna sayı eklenir: Ali → Ali2 (16 karakteri aşmaz)
export function guestName(name) {
  load();
  if (!db[nameKey(name)]) return name;
  for (let n = 2; n < 1000; n++) { const s = String(n), c = name.slice(0, 16 - s.length) + s; if (!db[nameKey(c)]) return c; }
  return 'Misafir' + crypto.randomInt(1000, 9999);
}

// Profil: sayılar tamsayı + sınırlı; birleştirmede her alanın büyüğü kalır (yanlışlıkla azalmaz)
function cleanProfile(p) {
  const s = (p && typeof p === 'object' ? p.stats : null) || {}, o = {};
  for (const k of Object.keys(PROFILE_MAX)) { const v = k === 'xp' ? p?.xp : s[k]; o[k] = Math.max(0, Math.min(PROFILE_MAX[k], Math.floor(+v || 0))); }
  return o;
}
function mergeProfile(cur, p) {
  const a = cur || cleanProfile(null), b = cleanProfile(p), o = {};
  for (const k of Object.keys(PROFILE_MAX)) o[k] = Math.max(a[k] || 0, b[k]);
  return o;
}
export const profileOut = (pr) => ({ xp: pr.xp, stats: { matches: pr.matches, wins: pr.wins, kills: pr.kills, deaths: pr.deaths } });
export function saveProfile(a, p) { a.profile = mergeProfile(a.profile, p); persist(); return a.profile; }

// ───── admin ─────
export const listAccounts = () => Object.values(load()).map((a) => ({ name: a.name, created: a.created, seen: a.seen, matches: a.profile?.matches || 0, xp: a.profile?.xp || 0, devices: (a.sess || []).filter((s) => s.exp > Date.now()).length })).sort((x, y) => (y.seen || 0) - (x.seen || 0));
export function deleteAccount(name) {
  const k = nameKey(name), a = load()[k];
  if (!a) throw err(404, 'none', 'Hesap bulunamadı');
  for (const s of a.sess || []) byTok.delete(s.h);
  delete db[k]; persist();
}
// Yeni rastgele şifre (bir kez gösterilir), tüm cihazların oturumu kapanır
export async function resetPassword(name) {
  const a = load()[nameKey(name)];
  if (!a) throw err(404, 'none', 'Hesap bulunamadı');
  const pw = crypto.randomBytes(6).toString('base64url');
  Object.assign(a, await hashPw(pw));
  for (const s of a.sess || []) byTok.delete(s.h);
  a.sess = []; persist();
  return pw;
}

// ───── HTTP (oyun sunucusu portu) ─────
const hits = new Map();               // ip → [zamanlar]
setInterval(() => { const now = Date.now(); for (const [ip, l] of hits) if (!l.some((t) => now - t < RATE_MS)) hits.delete(ip); }, RATE_MS).unref();
function limited(ip) {
  const now = Date.now(), l = (hits.get(ip) || []).filter((t) => now - t < RATE_MS);
  l.push(now); hits.set(ip, l);
  return l.length > RATE_N;
}
// İstemci IP'si: başlıklar yalnız yerel vekilden (nginx) gelirse güvenilir; Cloudflare arkasında gerçek IP CF-Connecting-IP'de (nginx'in X-Real-IP'si Cloudflare sunucusu olur)
const ipOf = (req) => { const r = req.socket.remoteAddress || ''; const local = r === '127.0.0.1' || r === '::1' || r === '::ffff:127.0.0.1'; return String((local && (req.headers['cf-connecting-ip'] || req.headers['x-real-ip'])) || r); };
const bearer = (req) => (/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '') || [])[1];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-max-age': '600' };   // çerez yok, jeton başlıkta: geliştirmede Vite (:5180) → :8787
function send(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve) => {
    let n = 0, done = false; const chunks = [];
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    req.on('data', (c) => { n += c.length; if (n > BODY_MAX) fin(null); else if (!done) chunks.push(c); });      // fazlası okunup atılır (yanıt yazılabilsin), bağlantı yanıttan sonra kapanır
    req.on('end', () => { try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); fin(v && typeof v === 'object' ? v : null); } catch { fin(null); } });
    req.on('error', () => fin(null));
  });
}

// true: istek bu modülce yanıtlandı (url /api/ ile başlıyorsa)
export async function handleApi(req, res) {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/')) return false;
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return true; }
  try {
    const route = `${req.method} ${url}`;
    const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : {};
    if (body === null) { res.setHeader('connection', 'close'); return send(res, 400, { error: 'Geçersiz veri', key: 'bad' }), true; }
    if (route === 'POST /api/register' || route === 'POST /api/login') {
      if (limited(ipOf(req))) return send(res, 429, { error: 'Çok fazla deneme, bir dakika sonra tekrar dene', key: 'rate' }), true;
      const r = route === 'POST /api/register' ? await register(body.name, body.pass, Date.now(), body.profile) : await login(body.name, body.pass);
      console.log(`[hesap] ${route === 'POST /api/register' ? 'kayıt' : 'giriş'}: ${r.name}`);
      return send(res, 200, { ok: true, tok: r.tok, name: r.name, profile: profileOut(r.profile) }), true;
    }
    const tok = bearer(req), a = tok && byToken(tok);
    if (route === 'POST /api/logout') { if (tok) logout(tok); return send(res, 200, { ok: true }), true; }
    if (!a) return send(res, 401, { error: 'Oturum geçersiz', key: 'session' }), true;
    if (route === 'GET /api/me') return send(res, 200, { name: a.name, created: a.created, profile: profileOut(a.profile) }), true;
    if (route === 'GET /api/profile') return send(res, 200, profileOut(a.profile)), true;
    if (route === 'PUT /api/profile') return send(res, 200, profileOut(saveProfile(a, body))), true;
    return send(res, 404, { error: 'Yok', key: 'bad' }), true;
  } catch (e) {
    if (e.code >= 400 && e.code < 500) return send(res, e.code, { error: e.message, key: e.key }), true;
    console.error('[hesap]', e.message); send(res, 500, { error: 'Sunucu hatası', key: 'server' });
    return true;
  }
}
