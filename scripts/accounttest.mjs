// Hesap sistemi testi (tarayıcısız): API + WS + admin + jeton süresi.
//   PORT=8851 ADMIN_PORT=8852 BF_DATA=/tmp/wb-acc-data BF_DEBUG=1 node server/index.js  →  API=http://127.0.0.1:8851 ADMIN=http://127.0.0.1:8852 DATA=/tmp/wb-acc-data node scripts/accounttest.mjs
// Kontroller: kayıt / giriş / yanlış şifre / büyük-küçük harf duyarsız aynı ad / hız sınırı (IP başına dakikada 10) / gövde sınırı / çıkış / profil büyüğü-birleştirme ve sınırlama /
// jeton süresi (modül, sahte saat) / admin listele + şifre sıfırla + sil / WS: hesaplı katılımda hesap adı, misafir kayıtlı adı alamaz (ek), sahte jeton = misafir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import WebSocket from 'ws';

const API = process.env.API || 'http://127.0.0.1:8851';
const ADMIN = process.env.ADMIN || 'http://127.0.0.1:8852';
const DATA = process.env.DATA || '/tmp/wb-acc-data';
const WS = process.env.WS || API.replace(/^http/, 'ws');
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rid = () => crypto.randomBytes(3).toString('hex');
const ipB = crypto.randomInt(1, 250); let ipN = 0; const newIp = () => `10.${ipB}.${(ipN >> 8) & 255}.${++ipN & 255}`;      // her bölüm kendi "IP"si (sunucu yalnız yerelden gelen X-Real-IP'ye güvenir)
async function call(method, p, body, { tok, ip = 'ip-default', raw } = {}) {
  const h = { 'x-real-ip': ip };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (tok) h.authorization = 'Bearer ' + tok;
  const r = await fetch(API + p, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  let j = {}; try { j = await r.json(); } catch { /* boş */ }
  return { s: r.status, j };
}

// ── 1) API ──
const ip1 = newIp();
const N = 'Test' + rid().slice(0, 5);              // ör. Test3fa2c
const reg = await call('POST', '/api/register', { name: N, pass: 'gizli1' }, { ip: ip1 });
check(reg.s === 200 && /^[a-f0-9]{64}$/.test(reg.j.tok) && reg.j.name === N, `kayıt: ${N} → 200 + 64 haneli jeton`);
const me = await call('GET', '/api/me', undefined, { tok: reg.j.tok });
check(me.s === 200 && me.j.name === N, '/api/me jetonla hesabı döndürür');
const dup1 = await call('POST', '/api/register', { name: N.toUpperCase(), pass: 'baska12' }, { ip: ip1 });
const dup2 = await call('POST', '/api/register', { name: N.toLowerCase(), pass: 'baska12' }, { ip: ip1 });
check(dup1.s === 409 && dup2.s === 409 && dup1.j.key === 'taken', `aynı ad büyük/küçük harf farkıyla alınamaz (${dup1.s}, ${dup2.s}, key=${dup1.j.key})`);
const ti = 'Işık' + rid().slice(0, 3);
const rI = await call('POST', '/api/register', { name: ti, pass: '1234' }, { ip: ip1 });
const rI2 = await call('POST', '/api/register', { name: ti.replace('I', 'i').replace('ı', 'i'), pass: '1234' }, { ip: ip1 });
check(rI.s === 200 && rI2.s === 409, `Türkçe harfli ad kaydolur, noktalı/noktasız i farkı aynı ad sayılır (${ti}: ${rI.s}, ${rI2.s})`);
const lg = await call('POST', '/api/login', { name: N.toLowerCase(), pass: 'gizli1' }, { ip: newIp() });
check(lg.s === 200 && lg.j.name === N && lg.j.tok !== reg.j.tok, 'giriş: küçük harfle ad + doğru şifre → yeni jeton, asıl ad');
const ipW = newIp();
const bad = await call('POST', '/api/login', { name: N, pass: 'yanlis' }, { ip: ipW });
const nobody = await call('POST', '/api/login', { name: 'Yok' + rid(), pass: 'yanlis' }, { ip: ipW });
check(bad.s === 403 && nobody.s === 403 && bad.j.key === 'wrong' && bad.j.error === nobody.j.error, 'yanlış şifre ve olmayan ad aynı yanıt (403 wrong, ad sızmaz)');
const ipV = newIp();
const v = await Promise.all([['ab', '1234'], ['a b c', '1234'], ['Uzunadduzunaddddd', '1234'], ['Gecerli' + rid().slice(0, 3), '123'], ['<x>', '1234']].map(([n, pw]) => call('POST', '/api/register', { name: n, pass: pw }, { ip: ipV })));
check(v.every((r) => r.s === 400), `geçersiz ad / kısa şifre reddedilir (${v.map((r) => r.s + ':' + r.j.key).join(' ')})`);
const big = await call('POST', '/api/register', undefined, { ip: newIp(), raw: JSON.stringify({ name: 'x'.repeat(5000), pass: '1234' }) });
check(big.s === 400, `gövde 4 KB sınırı (${big.s})`);
const junk = await call('POST', '/api/login', undefined, { ip: newIp(), raw: '{bozuk' });
check(junk.s === 400, `bozuk JSON → 400 (${junk.s})`);
const forged = await call('GET', '/api/me', undefined, { tok: crypto.randomBytes(32).toString('hex') });
check(forged.s === 401, `sahte jeton → 401 (${forged.s})`);

// hız sınırı: aynı IP'den dakikada 10 deneme; 11. → 429 (Türkçe metin + key), başka IP etkilenmez
const ipR = newIp(); const codes = [];
for (let i = 0; i < 12; i++) codes.push((await call('POST', '/api/login', { name: N, pass: 'yanlis' + i }, { ip: ipR })).s);
const rl = await call('POST', '/api/login', { name: N, pass: 'gizli1' }, { ip: ipR });
const other = await call('POST', '/api/login', { name: N, pass: 'gizli1' }, { ip: newIp() });
check(codes.slice(0, 10).every((c) => c === 403) && codes[10] === 429 && rl.s === 429 && rl.j.key === 'rate' && /deneme/.test(rl.j.error), `hız sınırı: 10 deneme sonra 429 (doğru şifre de) — ${codes.join(',')}`);
check(other.s === 200, 'başka IP sınırdan etkilenmez');

// profil: alan alan büyüğü, sayılar tamsayı + sınırlı, azalmaz
const T = lg.j.tok;
const p1 = await call('PUT', '/api/profile', { xp: 500.7, stats: { matches: 3, wins: 2, kills: 10, deaths: 4 } }, { tok: T });
const p2 = await call('PUT', '/api/profile', { xp: 100, stats: { matches: 1, wins: 5, kills: -50, deaths: 'x' } }, { tok: T });
const p3 = await call('PUT', '/api/profile', { xp: 1e15, stats: { matches: 4 } }, { tok: reg.j.tok });
const pg = await call('GET', '/api/profile', undefined, { tok: reg.j.tok });
check(p1.s === 200 && p1.j.xp === 500 && p1.j.stats.kills === 10, `profil yazılır (xp 500, kill 10): ${JSON.stringify(p1.j)}`);
check(p2.j.xp === 500 && p2.j.stats.matches === 3 && p2.j.stats.wins === 5 && p2.j.stats.kills === 10 && p2.j.stats.deaths === 4, `küçük / geçersiz değer profili düşürmez, büyüğü kalır: ${JSON.stringify(p2.j)}`);
check(p3.j.xp === 1e8 && pg.j.stats.matches === 4 && pg.j.xp === 1e8, `aşırı değer sınırlanır (xp ≤ 1e8), diğer cihazın jetonu aynı profili görür: ${JSON.stringify(pg.j)}`);
const pNo = await call('PUT', '/api/profile', { xp: 9 }, {});
check(pNo.s === 401, 'jetonsuz profil yazılamaz (401)');
// kayıtta misafir profili taşınır
const NG = 'Gst' + rid().slice(0, 5);
const rg = await call('POST', '/api/register', { name: NG, pass: '1234', profile: { xp: 777, stats: { matches: 9, wins: 4, kills: 30, deaths: 12 } } }, { ip: newIp() });
check(rg.s === 200 && rg.j.profile.xp === 777 && rg.j.profile.stats.matches === 9, 'kayıtta misafir ilerlemesi hesaba geçer');

// çıkış: yalnız o cihazın jetonu düşer
const lo = await call('POST', '/api/logout', {}, { tok: T });
const meT = await call('GET', '/api/me', undefined, { tok: T });
const meR = await call('GET', '/api/me', undefined, { tok: reg.j.tok });
check(lo.s === 200 && meT.s === 401 && meR.s === 200, `çıkış: o jeton geçersiz (${meT.s}), diğer cihaz açık (${meR.s})`);

// dosyada düz şifre / düz jeton yok
const file = fs.readFileSync(path.join(DATA, 'accounts.json'), 'utf8');
check(!file.includes('gizli1') && !file.includes(reg.j.tok) && /"salt"/.test(file), 'accounts.json: düz şifre ve düz jeton yok (yalnız tuz + özet)');
const mode = fs.statSync(path.join(DATA, 'accounts.json')).mode & 0o777;
check(mode === 0o600, `accounts.json izinleri 600 (${mode.toString(8)})`);

// ── 2) WS: odadaki ad ──
const open = () => new Promise((res, rej) => { const ws = new WebSocket(WS); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); ws.on('error', rej); });
const welcome = async (ws) => { for (let i = 0; i < 40; i++) { const w = ws.msgs.find((m) => m.t === 'welcome' || m.t === 'err'); if (w) return w; await wait(100); } return null; };
const myName = (w) => w && w.t === 'welcome' && w.roster.find((r) => r.id === w.id)?.name;
const a = await open();
a.send(JSON.stringify({ t: 'create', name: 'Sahtekar', tok: reg.j.tok, cfg: { map: 'kasaba', type: 'tdm', perTeam: 4, bots: false } }));
const wa = await welcome(a);
check(myName(wa) === N, `hesaplı oda kurma: istemci "Sahtekar" yolladı, odadaki ad hesabın adı ${myName(wa)}`);
const b = await open();
b.send(JSON.stringify({ t: 'join', room: wa.room, name: NG }));
const wb = await welcome(b);
check(myName(wb) && myName(wb) !== NG && myName(wb).startsWith(NG.slice(0, 14)) && /\d$/.test(myName(wb)), `misafir kayıtlı adı alamaz: ${NG} → ${myName(wb)}`);
const c = await open();
c.send(JSON.stringify({ t: 'join', room: wa.room, name: N.toLowerCase(), tok: crypto.randomBytes(32).toString('hex') }));
const wc = await welcome(c);
check(myName(wc) && myName(wc).toLowerCase() !== N.toLowerCase(), `sahte jeton reddedilir → misafir sayılır, ad ekli: ${myName(wc)}`);
const d = await open();
const free = 'Serbest' + rid().slice(0, 3);
d.send(JSON.stringify({ t: 'join', room: wa.room, name: free, tok: 'zzz' }));
const wd = await welcome(d);
check(myName(wd) === free, `bozuk jeton + serbest ad → misafir adı aynen (${myName(wd)})`);
const e2 = await open();
e2.send(JSON.stringify({ t: 'join', room: wa.room, name: 'X', tok: lg.j.tok }));       // çıkış yapılmış jeton
const we = await welcome(e2);
check(myName(we) === 'X', `çıkış yapılmış jeton artık hesap adı vermez (${myName(we)})`);
for (const w of [a, b, c, d, e2]) w.close();

// ── 3) admin: listele, şifre sıfırla, sil ──
let adminPw = process.env.ADMIN_PASSWORD;
try { adminPw ||= fs.readFileSync(path.join(DATA, 'admin-password.txt'), 'utf8').trim(); } catch { /* yok */ }
const al = await fetch(ADMIN + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-wb': '1' }, body: JSON.stringify({ pw: adminPw }) });
const cookie = (al.headers.get('set-cookie') || '').split(';')[0];
check(al.ok && /^wb_admin=/.test(cookie), 'admin girişi');
const adm = async (method, p, body) => { const r = await fetch(ADMIN + p, { method, headers: { cookie, 'x-wb': '1', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const noAuth = await fetch(ADMIN + '/api/accounts');
check(noAuth.status === 401, 'admin hesap listesi girişsiz açılmaz (401)');
const L = await adm('GET', '/api/accounts');
const row = Array.isArray(L.j) && L.j.find((x) => x.name === N);
check(row && row.matches === 4 && row.created > 0 && row.seen > 0 && !('hash' in row) && !('salt' in row), `admin listesi: ad / kayıt / son görülme / maç, özet yok (${JSON.stringify(row)})`);
const rs = await adm('POST', '/api/accounts/reset', { name: N.toLowerCase() });
check(rs.s === 200 && typeof rs.j.pw === 'string' && rs.j.pw.length >= 8, 'admin şifre sıfırlama yeni rastgele şifre döndürür');
const oldPw = await call('POST', '/api/login', { name: N, pass: 'gizli1' }, { ip: newIp() });
const newPw = await call('POST', '/api/login', { name: N, pass: rs.j.pw }, { ip: newIp() });
const oldTok = await call('GET', '/api/me', undefined, { tok: reg.j.tok });
check(oldPw.s === 403 && newPw.s === 200 && oldTok.s === 401, `sıfırlamadan sonra eski şifre (${oldPw.s}) ve eski oturumlar (${oldTok.s}) geçersiz, yeni şifre çalışır (${newPw.s})`);
check(!fs.readFileSync(path.join(DATA, 'accounts.json'), 'utf8').includes(rs.j.pw), 'yeni şifre dosyaya düz yazılmadı');
const del = await adm('POST', '/api/accounts/delete', { name: N });
const afterDel = await call('POST', '/api/login', { name: N, pass: rs.j.pw }, { ip: newIp() });
const reReg = await call('POST', '/api/register', { name: N, pass: 'yeni12' }, { ip: newIp() });
check(del.s === 200 && afterDel.s === 403 && reReg.s === 200, `admin silme: giriş yok (${afterDel.s}), ad yeniden alınabilir (${reReg.s})`);
const del404 = await adm('POST', '/api/accounts/delete', { name: 'Yok' + rid() });
check(del404.s === 404, 'olmayan hesap silinemez (404)');
// test hesaplarını temizle (başka testler "Test…" adlarına takılmasın)
for (const n of [N, ti, NG]) await adm('POST', '/api/accounts/delete', { name: n });

// ── 4) jeton süresi (modül, sahte saat; ayrı geçici veri dizini) ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-acc-mod-'));
process.env.BF_DATA = tmp;
const A = await import('../server/accounts.js');
const t0 = 1_000_000_000_000;
const r0 = await A.register('Zaman', '1234', t0);
const r1 = await A.login('zaman', '1234', t0 + 1000);
check(!!A.byToken(r0.tok, t0 + A.SESSION_MS - 5000), 'jeton 90 gün dolmadan geçerli');
check(A.byToken(r0.tok, t0 + A.SESSION_MS + 1) === null, '90 gün sonra jeton geçersiz');
check(A.byToken(r0.tok, t0 + 1) === null, 'süresi geçen jeton silinir (sonra da geçersiz)');
check(!!A.byToken(r1.tok, t0 + A.SESSION_MS), 'ikinci cihazın jetonu kendi süresinde geçerli');
let last = null; for (let i = 0; i < 12; i++) last = await A.login('Zaman', '1234', t0 + 2000 + i);
const raw = JSON.parse(fs.readFileSync(path.join(tmp, 'accounts.json'), 'utf8'));
check(raw.zaman.sess.length === 10 && !!A.byToken(last.tok, t0 + 3000), `en çok 10 cihaz oturumu (${raw.zaman.sess.length}), en yenisi geçerli`);
check(A.guestName('ZAMAN') === 'ZAMAN2' && A.guestName('Boşta') === 'Boşta', 'misafir adı: kayıtlıysa sayı eklenir, değilse aynen');
fs.rmSync(tmp, { recursive: true, force: true });

console.log(fail ? `\n${fail} HATA` : '\nHepsi geçti');
process.exit(fail ? 1 : 0);
