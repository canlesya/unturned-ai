// Lobi / oda yönetimi testi:  BF_DEBUG=1 BF_RESTART_MS=3000 npm run server  →  node scripts/lobbytest.mjs
import WebSocket from 'ws';
const HOST = process.env.HOST || '127.0.0.1:8787';
const open = () => new Promise((res) => { const ws = new WebSocket('ws://' + HOST); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = f(); if (v) return v; await wait(60); } return null; };
const list = async () => (await fetch('http://' + HOST + '/rooms')).json();
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const send = (ws, o) => ws.send(JSON.stringify(o));
const last = (ws, t) => [...ws.msgs].reverse().find((m) => m.t === t);

// 1) resmi odalar
let rooms = await list();
const off = rooms.filter((r) => r.official);
check(off.length === 3 && rooms[0].official, `3 resmi oda listede ilk sırada: ${off.map((r) => r.code + ':' + r.map).join(' ')}`);
check(off.every((r) => r.bots && !r.locked), 'resmi odalar botlu ve şifresiz');

// 2) resmi odaya gir: 1 bot azalır
const o1 = off[0];
const a = await open(); send(a, { t: 'join', room: o1.code, name: 'Ali' });
const wa = await until(() => last(a, 'welcome'));
check(!!wa && wa.roster.filter((r) => r.human).length === 1 && wa.roster.filter((r) => !r.human && !r.vac).length === o1.perTeam * 2 - 1, `resmi odada 1 insan + ${o1.perTeam * 2 - 1} bot (toplam ${o1.perTeam * 2})`);
const b = await open(); send(b, { t: 'join', room: o1.code, name: 'Veli' });
const wb = await until(() => last(b, 'welcome'));
check(!!wb && wb.roster.filter((r) => r.human).length === 2 && wb.roster.filter((r) => !r.human && !r.vac).length === o1.perTeam * 2 - 2, 'ikinci oyuncu girince bot sayısı bir daha azaldı');
rooms = await list();
check(rooms.find((r) => r.code === o1.code).humans === 2, 'liste canlı oyuncu sayısını gösteriyor (2)');

// 3) takım değiştirme isteği
const myTeam = wa.roster[wa.id].team, other = myTeam === 'blue' ? 'red' : 'blue';
send(a, { t: 'team', team: myTeam }); const tSame = await until(() => last(a, 'team'));
check(tSame && !tSame.ok, 'aynı takıma geçiş reddedildi: ' + (tSame && tSame.msg));
a.msgs.length = 0; send(a, { t: 'team', team: other }); const tOk = await until(() => last(a, 'team'));
check(tOk && tOk.ok && tOk.team === other, `boş yer olan takıma geçiş onaylandı (${other})`);

// 4) şifreli, gizli ve botsuz oda
const c = await open();
send(c, { t: 'create', name: 'Can', cfg: { name: 'Gizli Test', pw: 'abc123', listed: false, bots: false, perTeam: 2, map: 'vadi', type: 'tdm' } });
const wc = await until(() => last(c, 'welcome'));
check(!!wc && wc.cfg.locked && !('pw' in wc.cfg) && wc.cfg.name === 'Gizli Test', 'şifreli oda kuruldu, şifre istemciye geri gönderilmedi');
check(wc.roster.filter((r) => !r.vac).length === 1 && wc.roster.filter((r) => r.vac).length === 3, 'botsuz oda: yalnızca 1 insan, 3 boş slot');
rooms = await list();
check(!rooms.some((r) => r.code === wc.room), 'gizli oda listede görünmüyor');
const d = await open(); send(d, { t: 'join', room: wc.room, name: 'Dan', pw: 'yanlis' });
const e1 = await until(() => last(d, 'err'));
check(e1 && e1.msg === 'Şifre yanlış', 'yanlış şifre reddedildi');
d.msgs.length = 0; send(d, { t: 'join', room: wc.room, name: 'Dan', pw: 'abc123' });
const wd = await until(() => last(d, 'welcome'));
check(!!wd, 'doğru şifreyle girildi');
const e = await open(); send(e, { t: 'join', room: wc.room, name: 'Eve', pw: 'abc123' });
const we = await until(() => last(e, 'welcome'));
const f = await open(); send(f, { t: 'join', room: wc.room, name: 'Fay', pw: 'abc123' });
const wf = await until(() => last(f, 'welcome'));
const g = await open(); send(g, { t: 'join', room: wc.room, name: 'Gus', pw: 'abc123' });
const eFull = await until(() => last(g, 'err'));
check(!!we && !!wf && eFull && eFull.msg === 'Oda dolu', `4 kişilik oda doldu, 5. oyuncu reddedildi: ${eFull && eFull.msg}`);
// takım dolu: iki oyuncu aynı takımda en çok perTeam(2)
const teams = { blue: 0, red: 0 }; for (const w of [wc, wd, we, wf]) teams[w.roster[w.id].team]++;
check(teams.blue === 2 && teams.red === 2, `takımlar dengeli: ${teams.blue}-${teams.red}`);
// çıkınca slot boşalır (bot gelmez)
c.close(); await wait(400);
const rosterAfter = last(d, 'roster');
check(rosterAfter && rosterAfter.roster.filter((r) => r.vac).length === 1, 'oyuncu çıkınca slot yeniden boş (bot gelmedi)');

// 5) resmi oda maç sonu → sıradaki harita
const before = (await list()).find((r) => r.code === o1.code);
send(a, { t: 'dbg', tk: [0, 50] });
const end = await until(() => last(a, 'end'), 8000);
check(!!end, 'resmi oda maçı bitti');
await until(() => last(a, 'restart'), 8000);
await wait(500);
const after = (await list()).find((r) => r.code === o1.code);
check(after.map !== before.map, `resmi oda haritası döndü: ${before.map} → ${after.map}`);
check(after.humans === 0, 'oyuncular çıkarıldı, oda taze maçta bekliyor');

for (const w of [a, b, d, e, f, g]) w.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
