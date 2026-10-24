// Moderasyon testi (12.136): sohbet komutları /kick /ban /unban /bans /oyuncular, ban deposu, giriş reddi. Tarayıcısız (WS protokolü).
// Ayrı veri dizinli test sunucusu:
//   BF_DATA=/tmp/wb-ban-data ADMIN_PASSWORD=modtest-admin PORT=8846 ADMIN_PORT=8847 BF_ACC_RATE=100 node server/index.js
//   WS=ws://127.0.0.1:8846 DATA=/tmp/wb-ban-data ADMIN=http://127.0.0.1:8847 ADMIN_PW=modtest-admin node scripts/modtest.mjs
// Farklı oyuncu IP'leri x-real-ip başlığıyla taklit edilir (sunucu bu başlığa yalnız yerel bağlantıda güvenir).
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const WS = process.env.WS || 'ws://127.0.0.1:8846', HTTP = WS.replace(/^ws/, 'http');
const DATA = process.env.DATA || '/tmp/wb-ban-data';
const ADMIN = process.env.ADMIN || 'http://127.0.0.1:8847', ADMIN_PW = process.env.ADMIN_PW || '';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };

// bağlantı: msgs (gelen tüm mesajlar), closed (kapanış kodu)
function open(ip) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(WS, { headers: { 'x-real-ip': ip } });
    ws.msgs = []; ws.closed = null;
    ws.on('message', (d) => ws.msgs.push(JSON.parse(d)));
    ws.on('close', (c) => { ws.closed = c; });
    ws.on('open', () => res(ws)); ws.on('error', rej);
  });
}
const send = (ws, o) => ws.send(JSON.stringify(o));
async function until(f, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await wait(40); } return f(); }
// odaya gir: { ws, welcome } ya da { ws, err }
async function enter(ip, hello) {
  const ws = await open(ip);
  send(ws, hello);
  const r = await until(() => ws.msgs.find((m) => m.t === 'welcome' || m.t === 'err'), 6000);
  return { ws, welcome: r && r.t === 'welcome' ? r : null, err: r && r.t === 'err' ? r : null };
}
const sysOf = (ws) => ws.msgs.filter((m) => m.t === 'chat' && m.sys).map((m) => m.m);
const chatOf = (ws) => ws.msgs.filter((m) => m.t === 'chat' && !m.sys);
async function cmd(ws, text, expect) {
  const n = sysOf(ws).length;
  send(ws, { t: 'chat', m: text });
  await until(() => sysOf(ws).length > n && (!expect || sysOf(ws).slice(n).some((s) => s.includes(expect))), 3000);
  return sysOf(ws).slice(n);
}

// ── hazırlık: test moderatör hesabı (rastgele şifre, yalnız bu veri dizininde) + mods.json ──
const MOD = 'ModTest' + crypto.randomInt(100, 999);
const reg = await fetch(HTTP + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: MOD, pass: crypto.randomBytes(9).toString('base64url') }) }).then((r) => r.json());
check(!!reg.tok, `test moderatör hesabı açıldı (${MOD})`);
const MODS = path.join(DATA, 'mods.json'), BANS = path.join(DATA, 'bans.json');
fs.writeFileSync(MODS, JSON.stringify([MOD.toUpperCase()]));            // büyük / küçük harf duyarsız
try { fs.unlinkSync(BANS); } catch { /* yok */ }

const hello = (t, name, extra = {}) => ({ t, name, cls: 'assault', loadout: {}, ...extra });
const M = await enter('10.0.0.1', hello('create', 'x', { tok: reg.tok, cfg: { map: 'kasaba', type: 'tdm', perTeam: 4, bots: false, listed: false } }));
check(!!M.welcome, 'moderatör oda kurdu: ' + M.welcome?.room);
const ROOM = M.welcome.room;
const A = await enter('10.0.0.2', hello('join', 'Kotu', { room: ROOM }));
const B = await enter('10.0.0.3', hello('join', 'Iyi', { room: ROOM }));
const F = await enter('10.0.0.9', hello('join', MOD, { room: ROOM, tok: 'f'.repeat(64) }));        // moderatör adını taklit eden misafir (sahte jeton)
check(!!A.welcome && !!B.welcome && !!F.welcome, 'Kotu, Iyi ve taklitçi misafir katıldı');
const fName = F.welcome.roster.find((r) => r.id === F.welcome.id)?.name;
check(fName && fName.toLowerCase() !== MOD.toLowerCase(), `taklitçi misafirin adı değişti: ${fName}`);
await wait(300);

// ── yetkisiz komut ──
let r = await cmd(A.ws, `/kick ${MOD} sebepsiz`, 'yetkin');
check(r.some((s) => s.includes('yetkin yok')), 'misafir /kick → yalnız ona "yetkin yok": ' + JSON.stringify(r));
r = await cmd(F.ws, '/ban Iyi', 'yetkin');
check(r.some((s) => s.includes('yetkin yok')), 'moderatör adını taklit eden misafir de yetkisiz');
check(!M.ws.closed && !B.ws.closed, 'kimse atılmadı');
check(!sysOf(M.ws).some((s) => s.includes('yetkin')) && !sysOf(B.ws).some((s) => s.includes('yetkin')), '"yetkin yok" yalnız yazana gitti');

// ── /oyuncular, /yardim ──
r = await cmd(M.ws, '/oyuncular', 'Odadaki');
const line = r.find((s) => s.includes('Odadaki')) || '';
check(line.includes('Kotu') && line.includes('Iyi') && line.includes(`#${A.welcome.id}`) && line.includes('(mod)'), '/oyuncular: ' + line);
r = await cmd(M.ws, '/yardım', '/ban');
check(r.some((s) => s.startsWith('/ban')) && r.some((s) => s.startsWith('/kick')), '/yardım komut listesi (' + r.length + ' satır)');
r = await cmd(M.ws, '/uçur Kotu', 'Bilinmeyen');
check(r.some((s) => s.includes('Bilinmeyen')), 'bilinmeyen komut uyarısı');

// ── kendini / moderatörü atamaz ──
r = await cmd(M.ws, `/kick ${MOD.toLowerCase()}`, 'Kendini');
check(r.some((s) => s.includes('Kendini atamazsın')), 'kendini atamaz');
r = await cmd(M.ws, '/kick Zzz', 'odada yok');
check(r.some((s) => s.includes('odada yok')), 'olmayan oyuncu: ' + r.join(' | '));

// ── /kick (önek ile) ──
const bSys0 = sysOf(B.ws).length;
r = await cmd(M.ws, '/kick kot küfür ediyor', 'atıldı');
await until(() => A.ws.closed, 3000);
const kk = A.ws.msgs.find((m) => m.t === 'kicked');
check(kk && kk.k === 'kick' && kk.r === 'küfür ediyor' && kk.ms > 100000, 'Kotu kicked mesajı aldı: ' + JSON.stringify(kk));
check(A.ws.closed === 4003, 'Kotu bağlantısı kapandı (kod ' + A.ws.closed + ')');
await until(() => sysOf(B.ws).length > bSys0);
const bNew = sysOf(B.ws).slice(bSys0);
check(bNew.some((s) => s === 'Kotu odadan atıldı · küfür ediyor') && !bNew.some((s) => s.includes('ayrıldı')), 'odaya "Kotu odadan atıldı · küfür ediyor" (ayrıldı yazmadı): ' + JSON.stringify(bNew));
check(r.some((s) => s.includes('atıldı')), 'moderatöre onay: ' + r.join(' | '));
let J = await enter('10.0.0.2', hello('join', 'Kotu', { room: ROOM }));
check(J.err && J.err.ban?.k === 'kick' && !J.welcome, 'atılan 2 dk geri giremez: ' + J.err?.msg);
await until(() => J.ws.closed); check(J.ws.closed === 4003, 'reddedilen bağlantı kapandı');
J = await enter('10.0.0.2', hello('join', 'BaskaAd', { room: ROOM }));
check(J.err && J.err.ban?.k === 'kick', 'aynı IP başka adla da giremez');
J = await enter('10.0.0.50', hello('join', 'Yabanci', { room: ROOM }));
check(!!J.welcome, 'başka IP + başka ad girebilir'); J.ws.close();
r = await cmd(M.ws, '/unban Kotu', 'Kotu');
J = await enter('10.0.0.2', hello('join', 'Kotu', { room: ROOM }));
check(!!J.welcome, '/unban atma engelini kaldırdı → Kotu yeniden girdi');
const A2 = J;

// ── /ban 1m (#no ile) + başka odadaki aynı IP de düşer ──
const O = await enter('10.0.0.60', hello('create', 'Diger', { cfg: { map: 'kasaba', type: 'tdm', perTeam: 4, bots: false, listed: false } }));
const ROOM2 = O.welcome.room;
const A3 = await enter('10.0.0.2', hello('join', 'Kotu2', { room: ROOM2 }));
check(!!A3.welcome, 'Kotu aynı IP ile ikinci odada da (Kotu2)');
const bSys1 = sysOf(B.ws).length;
r = await cmd(M.ws, `/ban #${A2.welcome.id} 1m spam yapıyor`, 'banlandı');
check(r.some((s) => s.includes('banlandı') && s.includes('1 dk')), 'moderatöre onay: ' + r.join(' | '));
await until(() => A2.ws.closed && A3.ws.closed, 3000);
const kb = A2.ws.msgs.find((m) => m.t === 'kicked');
check(kb && kb.k === 'ban' && kb.r === 'spam yapıyor' && kb.ms > 50000 && kb.ms <= 60000, 'Kotu ban mesajı aldı: ' + JSON.stringify(kb));
check(A2.ws.closed === 4004 && A3.ws.closed === 4004, `iki odadaki bağlantı da kesildi (${A2.ws.closed}, ${A3.ws.closed})`);
check(sysOf(O.ws).some((s) => s.includes('Kotu2 banlandı')), 'ikinci odaya "Kotu2 banlandı"');
await until(() => sysOf(B.ws).length > bSys1);
check(sysOf(B.ws).slice(bSys1).some((s) => s === 'Kotu banlandı · spam yapıyor'), 'odaya "Kotu banlandı · spam yapıyor"');
const file = JSON.parse(fs.readFileSync(BANS, 'utf8'));
const e = file.find((x) => x.key === 'kotu');
check(e && e.acct === false && e.ip === '10.0.0.2' && e.by === MOD && e.reason === 'spam yapıyor' && e.until - e.at === 60000, 'bans.json kaydı: ' + JSON.stringify(e));
J = await enter('10.0.0.2', hello('join', 'Kotu', { room: ROOM }));
check(J.err?.ban?.k === 'ban' && J.err.ban.ms > 0 && /banlandın/.test(J.err.msg), 'aynı odaya giremez: ' + J.err?.msg);
J = await enter('10.0.0.2', hello('join', 'Kotu', { room: ROOM2 }));
check(J.err?.ban?.k === 'ban', 'başka odaya giremez');
J = await enter('10.0.0.2', hello('create', 'Yepyeni', { cfg: { map: 'kasaba', type: 'tdm', perTeam: 2, bots: false, listed: false } }));
check(J.err?.ban?.k === 'ban', 'aynı IP başka adla oda da kuramaz');
J = await enter('10.0.0.77', hello('join', 'KOTU', { room: ROOM }));
check(J.err?.ban?.k === 'ban', 'başka IP ama aynı misafir adı (büyük harf) giremez');
J = await enter('10.0.0.78', hello('join', 'Masum', { room: ROOM }));
check(!!J.welcome, 'başka IP + başka ad girebilir'); J.ws.close();
J = await enter('10.0.0.2', hello('create', 'x', { tok: reg.tok, cfg: { map: 'kasaba', type: 'tdm', perTeam: 2, bots: false, listed: false } }));
check(!!J.welcome, 'moderatör banlı IP\'den girse de engellenmez (IP muafiyeti)'); J.ws.close();

// ── /bans + /unban <sıra no> ──
r = await cmd(M.ws, '/bans', 'Aktif');
check(r.some((s) => s.startsWith('1) Kotu') && s.includes('misafir') && s.includes('spam yapıyor')) && !r.some((s) => s.includes('10.0.0.2')), '/bans listesi (IP göstermez): ' + r.join(' | '));
r = await cmd(M.ws, '/unban 1', 'kaldırıldı');
check(r.some((s) => s.includes('Ban kaldırıldı: Kotu')), '/unban 1: ' + r.join(' | '));
check(!JSON.parse(fs.readFileSync(BANS, 'utf8')).some((x) => x.key === 'kotu'), 'bans.json\'dan silindi');
J = await enter('10.0.0.2', hello('join', 'Kotu', { room: ROOM }));
check(!!J.welcome, 'unban sonrası tekrar girebildi');

// ── süreli ban dolar ──
r = await cmd(M.ws, '/ban Kotu 3s', 'banlandı');
await until(() => J.ws.closed);
let J2 = await enter('10.0.0.2', hello('join', 'Kotu', { room: ROOM }));
check(J2.err?.ban?.k === 'ban', '3 sn ban: hemen giremez');
await wait(3300);
J2 = await enter('10.0.0.2', hello('join', 'Kotu', { room: ROOM }));
check(!!J2.welcome, '3 sn sonra ban doldu, girdi');
check(!JSON.parse(fs.readFileSync(BANS, 'utf8')).some((x) => x.key === 'kotu'), 'süresi dolan kayıt temizlendi');

// ── kalıcı (varsayılan) + çevrimdışı ad banı ──
r = await cmd(M.ws, '/ban Yokki reklam', 'banlandı');
check(r.some((s) => s.includes('Yokki banlandı') && s.includes('çevrimdışı') && s.includes('kalıcı')), 'çevrimdışı ad banı: ' + r.join(' | '));
J = await enter('10.0.0.90', hello('join', 'yokki', { room: ROOM }));
check(J.err?.ban?.k === 'ban' && J.err.ban.ms === 0 && /kalıcı/.test(J.err.msg), 'kalıcı ban: ' + J.err?.msg);
r = await cmd(M.ws, '/ban Kotu 2h "tırnak dışı"', 'banlandı');
check(r.some((s) => s.includes('2 sa')), '/ban 2h: ' + r.join(' | '));
await until(() => J2.ws.closed);
r = await cmd(M.ws, '/unban kotu', 'kaldırıldı'); r = await cmd(M.ws, '/unban YOKKI', 'kaldırıldı');
check(r.some((s) => s.includes('Yokki')), 'büyük harfle /unban');

// ── hesaplı oyuncu banı: hesap adıyla (başka IP'den de giremez), aynı adlı misafir (Hesapli2) etkilenmez ──
const HN = 'Hesap' + crypto.randomInt(100, 999);
const reg2 = await fetch(HTTP + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: HN, pass: crypto.randomBytes(9).toString('base64url') }) }).then((x) => x.json());
const H = await enter('10.0.1.1', hello('join', 'x', { room: ROOM, tok: reg2.tok }));
check(!!H.welcome, `hesaplı oyuncu ${HN} girdi`);
r = await cmd(M.ws, `/ban ${HN.toLowerCase()} 1d hile`, 'banlandı');
await until(() => H.ws.closed);
check(H.ws.closed === 4004, 'hesaplı oyuncu banlandı ve düştü');
check(JSON.parse(fs.readFileSync(BANS, 'utf8')).some((x) => x.name === HN && x.acct === true && x.ip === '10.0.1.1'), 'bans.json: hesap banı (acct:true)');
J = await enter('10.0.1.2', hello('join', 'x', { room: ROOM, tok: reg2.tok }));
check(J.err?.ban?.k === 'ban' && J.err.ban.ms > 86000000, 'hesap başka IP\'den de giremez: ' + J.err?.msg);
J = await enter('10.0.1.3', hello('join', HN, { room: ROOM }));
check(!!J.welcome, 'aynı adlı misafir (sayı eklenir) başka IP\'den girebilir'); J.ws.close();
await cmd(M.ws, `/unban ${HN}`, 'kaldırıldı');

// ── maç sonu bekleme listesindeki (hold) oyuncu banlanınca düşer (BF_DEBUG=1 ve BF_RESTART_MS uzun sunucu gerekir) ──
if (process.env.HOLD) {
  const E = await enter('10.0.2.9', hello('create', 'Bitiren', { cfg: { map: 'kasaba', type: 'conquest', perTeam: 2, bots: false, listed: false } }));
  send(E.ws, { t: 'dbg', tk: [0, 50] });
  await until(() => E.ws.msgs.some((m) => m.t === 'end'), 5000);
  const W = await open('10.0.2.1'); send(W, hello('join', 'Bekleyen', { room: E.welcome.room }));
  await until(() => W.msgs.some((m) => m.t === 'wait'));
  check(W.msgs.some((m) => m.t === 'wait'), 'Bekleyen maç sonu ekranındaki odada bekliyor (hold)');
  r = await cmd(M.ws, '/ban Bekleyen 10m', 'banlandı');
  await until(() => W.closed);
  const we = W.msgs.find((m) => m.t === 'err');
  check(we?.ban?.k === 'ban' && W.closed === 4004, 'bekleme listesindeki oyuncu ban hatasıyla düştü: ' + we?.msg);
  check(JSON.parse(fs.readFileSync(BANS, 'utf8')).some((x) => x.key === 'bekleyen' && x.ip === '10.0.2.1'), 'bekleyenin IP\'si de kaydedildi');
  await cmd(M.ws, '/unban Bekleyen', 'kaldırıldı');
  E.ws.close();
}

// ── mods.json canlı okunur ──
fs.writeFileSync(MODS, '[]');
r = await cmd(M.ws, '/oyuncular', 'yetkin');
check(r.some((s) => s.includes('yetkin yok')), 'mods.json boşaltılınca moderatör yetkisi hemen gitti');
fs.unlinkSync(MODS);
r = await cmd(M.ws, '/oyuncular', 'yetkin');
check(r.some((s) => s.includes('yetkin yok')), 'mods.json yokken varsayılan yalnız "admin"');
fs.writeFileSync(MODS, JSON.stringify([MOD]));
r = await cmd(M.ws, '/oyuncular', 'Odadaki');
check(r.some((s) => s.includes('Odadaki')), 'mods.json geri yazılınca yetki döndü');

// ── komutlar sohbete sızmadı ──
const leaked = [B, O, F].flatMap((p) => chatOf(p.ws)).filter((m) => m.m.startsWith('/'));
check(!leaked.length, 'hiçbir / komutu sohbete yayınlanmadı ' + JSON.stringify(leaked));
check(!sysOf(B.ws).some((s) => s.includes('Odadaki') || s.includes('Aktif ban')), 'komut yanıtları yalnız moderatöre');
send(B.ws, { t: 'chat', m: 'normal mesaj' });
await until(() => chatOf(M.ws).some((m) => m.m === 'normal mesaj'));
check(chatOf(M.ws).some((m) => m.m === 'normal mesaj'), 'normal sohbet çalışıyor');

// ── admin paneli API'si ──
if (ADMIN_PW) {
  await cmd(M.ws, '/ban Iyi 1d test', 'banlandı');
  const lg = await fetch(ADMIN + '/api/login', { method: 'POST', headers: { 'x-wb': '1', 'content-type': 'application/json' }, body: JSON.stringify({ pw: ADMIN_PW }) });
  const cookie = (lg.headers.get('set-cookie') || '').split(';')[0];
  const list = await fetch(ADMIN + '/api/bans', { headers: { cookie } }).then((x) => x.json());
  check(Array.isArray(list) && list.some((b) => b.name === 'Iyi' && b.ip === '10.0.0.3'), 'admin /api/bans listesi');
  const rm = await fetch(ADMIN + '/api/bans/remove', { method: 'POST', headers: { cookie, 'x-wb': '1', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'iyi' }) }).then((x) => x.json());
  check(rm.ok && !JSON.parse(fs.readFileSync(BANS, 'utf8')).some((x) => x.key === 'iyi'), 'admin panelinden ban kaldırıldı');
}

for (const p of [M, O, F, B]) try { p.ws.close(); } catch { /* yok */ }
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
