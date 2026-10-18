// Maç sonu döngüsü testi (ws istemcileri):  PORT=8826 BF_DEBUG=1 BF_RESTART_MS=8000 BF_EMPTY_ROTATE_MS=6000 node server/index.js  →  WS=ws://127.0.0.1:8826 node scripts/matchcycle.mjs
// Resmi odada maç biter → 3 oylama seçeneği → 2 insan oy verir (botlar oy vermez) → kazanan harita sonraki maçta → istemciler aynı bağlantıda yeni 'welcome' alır (menüye düşmeden).
// Maç sonu ekranında gelen oyuncu bekler ve yeni maça otomatik katılır; oy gelmezse düzende sıradaki harita; oyuncu odası aynı ayarla devam; boş resmi oda kendiliğinden döner; her modun resmi odası var.
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8826';
const HTTP = URL.replace(/^ws/, 'http');
const open = () => new Promise((res, rej) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); ws.on('error', rej); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const v = f(); if (v) return v; await wait(50); } return null; };
const send = (ws, o) => ws.send(JSON.stringify(o));
const nth = (ws, t, n) => ws.msgs.filter((m) => m.t === t)[n];
const key = (o) => o && `${o.map}/${o.tod}/${o.weather}`;
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const rooms = async () => (await fetch(HTTP + '/rooms')).json();

// 1) her modun resmi odası
const R0 = await rooms(), off = R0.filter((r) => r.official);
const modes = ['conquest', 'tdm', 'dm', 'gg', 'inf', 'pb'];
check(modes.every((m) => off.some((r) => r.type === m)), 'her modda resmi oda: ' + off.map((r) => `${r.code}:${r.type}:${r.map}`).join(' '));
check(off.find((r) => r.type === 'inf')?.map === 'newyork' && off.find((r) => r.type === 'pb')?.map === 'boyakulesi', 'enfekte New York, paintball Boya Kulesi');

// 2) resmi takım çatışması odasına iki insan
const room = off.find((r) => r.type === 'tdm');
const a = await open(), b = await open();
send(a, { t: 'join', room: room.code, name: 'Ali' });
send(b, { t: 'join', room: room.code, name: 'Veli' });
const wa = await until(() => nth(a, 'welcome', 0), 6000), wb = await until(() => nth(b, 'welcome', 0), 6000);
check(wa && wb, `${room.code} odasına iki oyuncu girdi (${wa && wa.cfg.map})`);
const bots = wa ? wa.roster.filter((r) => !r.human).length : 0;
check(bots > 0, `odada bot var (${bots})`);

// 3) maç biter → oylama
send(a, { t: 'dbg', tk: [9999, 0] });
const ea = await until(() => nth(a, 'end', 0), 5000), eb = await until(() => nth(b, 'end', 0), 5000);
check(ea && eb, 'maç bitti: ' + (ea && ea.why));
const opts = ea?.vote?.opts || [];
check(opts.length === 3 && new Set(opts.map(key)).size === 3, 'üç farklı oylama seçeneği: ' + opts.map(key).join(' | '));
check(ea?.vote?.c?.every((n) => n === 0), 'başta oy yok (botlar oy vermez): ' + JSON.stringify(ea?.vote?.c));
check(ea?.ms > 0, 'geri sayım süresi ' + ea?.ms + ' ms');

// 4) maç sonu ekranında gelen oyuncu bekler
const c = await open();
send(c, { t: 'join', room: room.code, name: 'Can' });
const wc0 = await until(() => c.msgs.find((m) => m.t === 'wait' || m.t === 'err' || m.t === 'welcome'), 3000);
check(wc0 && wc0.t === 'wait', 'maç sonunda gelen oyuncu bekleme listesinde: ' + JSON.stringify(wc0));

// 5) oylar: Ali önce 0 sonra 2 (fikir değiştirir), Veli 2; botlar sayılmaz
send(a, { t: 'vote', i: 0 });
await until(() => nth(b, 'votes', 0), 2000);
send(a, { t: 'vote', i: 2 });
send(b, { t: 'vote', i: 2 });
send(c, { t: 'vote', i: 1 });                                    // bekleyen oyuncunun oyu sayılmaz (oyunda değil)
const vfin = await until(() => b.msgs.filter((m) => m.t === 'votes').find((m) => m.c[2] === 2), 3000);
check(vfin && vfin.c.reduce((x, y) => x + y, 0) === 2 && vfin.n === 2, 'oy sayıları yalnız insanlar: ' + JSON.stringify(vfin));
check(vfin && vfin.ms <= 3100, 'herkes oy verdi → geri sayım ≤3 sn: ' + (vfin && vfin.ms));

// 6) yeni maç: aynı bağlantıda yeni welcome, kazanan harita
const t0 = Date.now();
const wa2 = await until(() => nth(a, 'welcome', 1), 8000), wb2 = await until(() => nth(b, 'welcome', 1), 2000), wc2 = await until(() => nth(c, 'welcome', 0), 2000);
check(wa2 && wb2, `yeni maç ${Date.now() - t0} ms sonra, aynı bağlantı (ws açık: ${a.readyState === 1 && b.readyState === 1})`);
check(key(wa2?.cfg) === key(opts[2]), 'kazanan harita uygulandı: ' + key(wa2?.cfg) + ' = ' + key(opts[2]));
check(wc2 && key(wc2.cfg) === key(opts[2]), 'bekleyen oyuncu yeni maça otomatik katıldı');
check(!a.msgs.some((m) => m.t === 'err') && !b.msgs.some((m) => m.t === 'err'), 'hata mesajı yok');
const sn = await until(() => a.msgs.slice(a.msgs.indexOf(wa2)).find((m) => m.t === 'snap'), 3000);
check(sn && sn.tk[0] === 0 && sn.tk[1] === 0, 'yeni maç taze skorla akıyor: ' + (sn && sn.tk));
const ros = await until(() => a.msgs.slice(a.msgs.indexOf(wa2)).filter((m) => m.t === 'roster').find((m) => m.roster.filter((r) => r.human).length === 3), 3000);
check(wa2 && wa2.roster[wa2.id].name === 'Ali' && ros, 'ad korundu, yeni maçta 3 insan: ' + (ros && ros.roster.filter((r) => r.human).map((r) => r.name)));

// 7) oy yoksa düzende sıradaki (ilk seçenek)
send(a, { t: 'dbg', tk: [9999, 0] });
const e2 = await until(() => nth(a, 'end', 1), 5000);
const o2 = e2?.vote?.opts || [];
check(o2.length === 3, 'ikinci maç bitti, seçenekler: ' + o2.map(key).join(' | '));
const wa3 = await until(() => nth(a, 'welcome', 2), 15000);
check(wa3 && key(wa3.cfg) === key(o2[0]), 'oy yok → ilk seçenek (düzende sıradaki): ' + key(wa3?.cfg));
a.close(); b.close(); c.close();

// 8) oyuncu odası: oylama yok, aynı ayarla yeni maç
const p = await open();
send(p, { t: 'create', name: 'Oda', cfg: { map: 'depo', perTeam: 2, type: 'tdm', time: 0, tod: 'sunset' } });
const wp = await until(() => nth(p, 'welcome', 0), 5000);
send(p, { t: 'dbg', tk: [9999, 0] });
const ep = await until(() => nth(p, 'end', 0), 5000);
check(ep && !ep.vote && key(ep.next) === 'depo/sunset/clear', 'oyuncu odası: oylama yok, sonraki = ' + key(ep?.next));
const wp2 = await until(() => nth(p, 'welcome', 1), 15000);
check(wp2 && wp2.room === wp.room && key(wp2.cfg) === 'depo/sunset/clear', 'oyuncu odası yeni maça aynı bağlantıda geçti');
p.close();

// 9) boş resmi oda kendiliğinden döner (sunucu BF_EMPTY_ROTATE_MS ile)
const before = new Map((await rooms()).filter((r) => r.official).map((r) => [r.code, key(r)]));
await wait(+process.env.ROT_WAIT || 14000);
const after = (await rooms()).filter((r) => r.official && !r.humans);
const changed = after.filter((r) => before.get(r.code) !== key(r));
check(changed.length > 0, `boş resmi odalar döndü: ${changed.map((r) => `${r.code} ${before.get(r.code)} → ${key(r)}`).join(', ') || 'yok (sunucu BF_EMPTY_ROTATE_MS ile mi açık?)'}`);

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
