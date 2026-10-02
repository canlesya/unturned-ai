// Maç sonu + oda sıfırlama testi:  BF_RESTART_MS=3000 node server/index.js  →  node scripts/endtest.mjs
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const v = f(); if (v) return v; await wait(100); } return null; };
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };

const a = await open();
a.send(JSON.stringify({ t: 'create', name: 'Ali', cfg: { map: 'kasaba', perTeam: 4, type: 'tdm', tickets: 20, time: 0, diff: 'hard' } }));
const w = await until(() => a.msgs.find((m) => m.t === 'welcome'), 4000);
check(!!w, 'oda kuruldu ' + (w && w.room));
a.send(JSON.stringify({ t: 'dbg', tk: [0, 5] }));      // BF_DEBUG: mavi biletleri bitir
const end = await until(() => a.msgs.find((m) => m.t === 'end'), 120000);
check(!!end, `maç bitti: ${end && end.winner} kazandı (${end && end.why})`);
const b = await open();
b.send(JSON.stringify({ t: 'join', room: w.room, name: 'Veli' }));
const err = await until(() => b.msgs.find((m) => m.t === 'err'), 2000);
check(!!err, 'bitmiş maça katılma reddedildi: ' + (err && err.msg));
const rs = await until(() => a.msgs.find((m) => m.t === 'restart'), 20000);
check(!!rs, 'sunucu restart mesajı yolladı');
const c = await open();
c.send(JSON.stringify({ t: 'join', room: w.room, name: 'Ali' }));
const w2 = await until(() => c.msgs.find((m) => m.t === 'welcome'), 4000);
check(!!w2, 'sıfırlanan odaya yeniden katılındı');
const s = await until(() => c.msgs.filter((m) => m.t === 'snap').pop(), 3000);
check(s && s.tk[0] === 20 && s.tk[1] === 20, 'yeni maç taze biletlerle başladı: ' + (s && s.tk));
a.close(); b.close(); c.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
