// Sohbet protokol testi (tarayıcısız): herkese / takıma, temizleme, hız sınırı, sistem mesajları. node scripts/chattest.mjs (önce: npm run server)
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const chats = (ws) => ws.msgs.filter((m) => m.t === 'chat');

const a = await open(), b = await open(), c = await open();
a.send(JSON.stringify({ t: 'create', name: 'Ali', team: 'blue', cfg: { map: 'kasaba', perTeam: 3, type: 'tdm' } }));
await wait(1200);
const code = a.msgs.find((m) => m.t === 'welcome').room;
b.send(JSON.stringify({ t: 'join', room: code, name: 'Veli', team: 'blue' }));
c.send(JSON.stringify({ t: 'join', room: code, name: 'Can', team: 'red' }));
await wait(1200);
check(chats(a).some((m) => m.sys && /Veli.*katıldı/.test(m.m)), 'katılma sistem mesajı geldi');

a.send(JSON.stringify({ t: 'chat', m: 'selam herkese' }));
await wait(300);
check([a, b, c].every((w) => chats(w).some((m) => m.m === 'selam herkese' && m.name === 'Ali' && !m.tc)), 'herkese mesaj: 3 kişi de aldı (gönderen dahil)');

a.send(JSON.stringify({ t: 'chat', m: 'sadece mavi', tm: true }));
await wait(300);
check(chats(a).some((m) => m.m === 'sadece mavi' && m.tc) && chats(b).some((m) => m.m === 'sadece mavi' && m.tc), 'takım mesajı: mavi takım aldı');
check(!chats(c).some((m) => m.m === 'sadece mavi'), 'takım mesajını rakip takım almadı');

b.send(JSON.stringify({ t: 'chat', m: '  <img src=x onerror=1>​\u0007  fazla   boşluk  ' + 'x'.repeat(300) }));
await wait(300);
const got = chats(c).find((m) => m.name === 'Veli');
check(got && got.m.length <= 120 && !/[\u0007​]/.test(got.m) && !/  /.test(got.m), 'mesaj temizlendi: uzunluk ' + (got && got.m.length) + ', kontrol karakteri yok, boşluklar tek');
b.send(JSON.stringify({ t: 'chat', m: '   ' })); b.send(JSON.stringify({ t: 'chat', m: 42 })); b.send(JSON.stringify({ t: 'chat' }));
await wait(300);
check(chats(c).filter((m) => m.name === 'Veli').length === 1, 'boş / geçersiz mesaj yayılmadı');

for (let i = 0; i < 8; i++) c.send(JSON.stringify({ t: 'chat', m: 'spam ' + i }));
await wait(900);
const spam = chats(a).filter((m) => m.name === 'Can').length;
check(spam === 4, 'hız sınırı: 8 mesajdan ' + spam + ' tanesi geçti (4 bekleniyor)');
check(chats(c).some((m) => m.sys && /hızlı/.test(m.m)), 'spam yapana uyarı gitti');

b.close();
await wait(500);
check(chats(a).some((m) => m.sys && /Veli.*ayrıldı/.test(m.m)), 'ayrılma sistem mesajı geldi');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK');
a.close(); c.close(); process.exit(fail ? 1 : 0);
