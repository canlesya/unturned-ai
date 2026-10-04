// Oda listesi simülasyonu: 20 farklı oda kurar (farklı harita/mod/boyut/şifre/bot), bazılarına oyuncu sokar, listeyi yazdırır ve bağlantıları açık tutar.
//   PORT=8788 node server/index.js   →   HOST=127.0.0.1:8788 node scripts/roomsim.mjs [süre_sn=120]
import WebSocket from 'ws';
const HOST = process.env.HOST || '127.0.0.1:8788';
const open = () => new Promise((res, rej) => { const ws = new WebSocket('ws://' + HOST); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); ws.on('error', rej); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = f(); if (v) return v; await wait(40); } return null; };
const send = (ws, o) => ws.send(JSON.stringify(o));
const last = (ws, t) => [...ws.msgs].reverse().find((m) => m.t === t);
const ROOMS = [
  ['Gece Baskını', 'kasaba', 'conquest', 8, true, '', 'night', 'clear', 'hard'],
  ['Başlangıç Odası', 'kasaba', 'tdm', 4, true, '', 'day', 'clear', 'easy'],
  ['Vadi Savaşı', 'vadi', 'conquest', 10, true, '', 'day', 'fog', 'normal'],
  ['Üs Çatışması', 'us', 'conquest', 12, true, '', 'sunset', 'clear', 'normal'],
  ['Herkes Tek (DM)', 'kasaba', 'dm', 6, true, '', 'day', 'clear', 'normal'],
  ['Arkadaşlar Özel', 'vadi', 'tdm', 5, true, 'abc123', 'day', 'clear', 'normal'],
  ['Sadece Oyuncular', 'us', 'tdm', 6, false, '', 'day', 'rain', 'normal'],
  ['Keskin Nişancı Vadisi', 'vadi', 'tdm', 8, true, '', 'sunset', 'fog', 'hard'],
  ['Sabah Kahvesi ☕', 'kasaba', 'conquest', 6, true, '', 'day', 'clear', 'easy'],
  ['3. Şahıs Deneme', 'kasaba', 'tdm', 4, true, '', 'day', 'clear', 'normal', true],
  ['TURNUVA 1', 'us', 'conquest', 16, true, 'turnuva', 'day', 'clear', 'hard'],
  ['Ölüm Maçı Büyük', 'vadi', 'dm', 10, true, '', 'night', 'clear', 'hard'],
  ['Yağmurlu Kasaba', 'kasaba', 'conquest', 8, true, '', 'day', 'rain', 'normal'],
  ['Yeni Başlayanlar', 'kasaba', 'tdm', 3, true, '', 'day', 'clear', 'easy'],
  ['Askeri Gece', 'us', 'tdm', 10, true, '', 'night', 'fog', 'normal'],
  ['Uzun İsimli Oda Testi Deneme Amaçlı', 'vadi', 'conquest', 6, true, '', 'day', 'clear', 'normal'],
  ['Hızlı Maç', 'kasaba', 'tdm', 5, true, '', 'sunset', 'clear', 'normal'],
  ['Gizli Antrenman', 'us', 'conquest', 4, false, 'gizli', 'day', 'clear', 'easy'],
  ['Takım Deathmatch', 'us', 'tdm', 8, true, '', 'day', 'clear', 'hard'],
  ['Son Oda 20', 'vadi', 'conquest', 7, true, '', 'day', 'clear', 'normal'],
];
const conns = [];
for (let i = 0; i < ROOMS.length; i++) {
  const [name, map, type, perTeam, listed, pw, tod, weather, diff, third] = ROOMS[i];
  const ws = await open(); conns.push(ws);
  send(ws, { t: 'create', name: 'Kurucu' + (i + 1), cls: ['assault', 'medic', 'sniper', 'heavy', 'engineer'][i % 5], cfg: { name, listed, pw: pw || undefined, bots: i % 7 !== 3, perTeam, map, type, tod, weather, diff, third: !!third } });
  const w = await until(() => last(ws, 'welcome'));
  if (!w) { console.log('oda kurulamadı:', name, JSON.stringify(ws.msgs.slice(-2))); continue; }
  ROOMS[i].code = w.room;
}
// bazı odalara oyuncular katıl (farklı doluluklar)
const joins = [[0, 3], [1, 1], [2, 6], [3, 8], [4, 5], [6, 2], [7, 4], [10, 9], [11, 7], [14, 3], [16, 2], [18, 5]];
let n = 0;
for (const [ri, cnt] of joins) for (let k = 0; k < cnt; k++) {
  const ws = await open(); conns.push(ws);
  send(ws, { t: 'join', room: ROOMS[ri].code, name: 'Oyuncu' + (++n), pw: ROOMS[ri][5] || undefined });
  await until(() => last(ws, 'welcome') || last(ws, 'err'), 2500);
}
await wait(800);
const list = await (await fetch('http://' + HOST + '/rooms')).json();
console.log(`/rooms: ${list.length} oda (${list.filter((r) => r.official).length} resmi + ${list.filter((r) => !r.official).length} kullanıcı) · toplam oyuncu ${list.reduce((a, r) => a + r.humans, 0)}`);
console.table(list.map((r) => ({ kod: r.code, ad: r.name.slice(0, 22), harita: r.map, mod: r.type, 'oyuncu/kap': `${r.humans}/${r.cap}`, bot: r.bots ? 'var' : 'yok', şifre: r.locked ? '🔒' : '', resmi: r.official ? '★' : '' })));
console.log('bağlantılar açık tutuluyor… (Ctrl+C ile bitir)');
await wait(+(process.argv[2] || 120) * 1000);
for (const c of conns) c.close();
process.exit(0);
