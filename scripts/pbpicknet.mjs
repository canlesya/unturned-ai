// Paintball kutuları çevrimiçi testi (tarayıcısız, sunucu BF_DEBUG=1):   WS=ws://127.0.0.1:8787 node scripts/pbpicknet.mjs
// İki oyuncu aynı anda aynı can kutusuna ışınlanır → sunucu yalnız birine verir, 'pk' olayı İKİ istemciye de gider (aynı alan), canı yalnız alanınki artar;
// sonradan katılan üçüncü istemcinin welcome.pk'sinde kutu bekliyor görünür; doluyken alınmaz; ~20 sn sonra 'pk' a:1 ile yeniden belirir.
import WebSocket from 'ws';
import { TUNE } from '../src/game/balance.js';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const evs = (ws, f) => ws.msgs.filter((m) => m.t === 'ev').flatMap((m) => m.l).filter(f);
const meHp = (ws) => { const s = ws.msgs.filter((m) => m.t === 'snap').pop(); return s && s.me && s.me.now ? s.me.now.hp : null; };
const send = (ws, o) => ws.send(JSON.stringify(o));

const a = await open(), b = await open();
send(a, { t: 'create', name: 'Boyacı', cfg: { type: 'pb', map: 'boyakulesi', perTeam: 6, time: 600 } });
await wait(1200);
const wa = a.msgs.find((m) => m.t === 'welcome');
check(!!wa && wa.cfg.map === 'boyakulesi' && Array.isArray(wa.pk), `oda kuruldu (${wa && wa.room}), welcome.pk = ${JSON.stringify(wa && wa.pk)}`);
send(b, { t: 'join', room: wa.room, name: 'Fırça' });
await wait(600);
const wb = b.msgs.find((m) => m.t === 'welcome');
check(!!wb, `ikinci oyuncu katıldı (id ${wb && wb.id})`);
send(a, { t: 'dbg', bots: false });
await wait(4000);                                                          // doğma korumaları / ilk snapshot
// Doğu Kuyu Kenarı (13, −3) zemin can kutusu, indeks 8; önce doluyken alınmaz
const I = 8, X = 13, Z = -3;
send(a, { t: 'dbg', hp: 100 }); send(a, { t: 'dbg', tp: [X, Z] });
await wait(700);
check(!evs(a, (e) => e.e === 'pk' && e.i === I).length, 'canı doluyken can kutusu alınmadı');
send(a, { t: 'dbg', tp: [X + 6, Z] }); await wait(300);
a.msgs.length = 0; b.msgs.length = 0;
send(a, { t: 'dbg', hp: 50 }); send(b, { t: 'dbg', hp: 50 });
await wait(300);
send(a, { t: 'dbg', tp: [X, Z] }); send(b, { t: 'dbg', tp: [X, Z] });   // aynı anda aynı kutu
await wait(900);
const ea = evs(a, (e) => e.e === 'pk' && e.i === I && !e.a), eb = evs(b, (e) => e.e === 'pk' && e.i === I && !e.a);
check(ea.length === 1 && eb.length === 1 && ea[0].v === eb[0].v, `'pk' olayı iki istemciye de geldi, alan aynı (${ea[0] && ea[0].v}), t ${ea[0] && ea[0].t}`);
const ha = meHp(a), hb = meHp(b), winA = ea[0] && ea[0].v === wa.id;
console.log(`      can: A ${ha} · B ${hb}`);
check((ha === 50 + TUNE.pbHeal && hb === 50 && winA) || (hb === 50 + TUNE.pbHeal && ha === 50 && !winA), 'yalnız biri aldı (+' + TUNE.pbHeal + ' can), diğerinin canı değişmedi');
const c = await open(); send(c, { t: 'join', room: wa.room, name: 'Rulo' }); await wait(600);
const wc = c.msgs.find((m) => m.t === 'welcome');
const pend = wc && wc.pk.find((p) => p[0] === I);
check(!!pend && pend[1] > TUNE.pbHealthRespawn - 3, `sonradan katılanın welcome.pk'sinde kutu bekliyor (${JSON.stringify(pend)})`);
send(a, { t: 'dbg', tp: [X + 6, Z] }); send(b, { t: 'dbg', tp: [X - 6, Z + 4] });
const t0 = Date.now(); let back = -1;
while (Date.now() - t0 < (TUNE.pbHealthRespawn + 4) * 1000 && back < 0) { await wait(250); if (evs(b, (e) => e.e === 'pk' && e.i === I && e.a).length && evs(c, (e) => e.e === 'pk' && e.i === I && e.a).length) back = (Date.now() - t0) / 1000; }
check(back > 0, `kutu yeniden belirdi ('pk' a:1 tüm istemcilere, ışınlamadan ${back.toFixed(1)} sn sonra)`);
for (const w of [a, b, c]) w.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
