// Kuzey Vadisi (12.172) sunucu denetimi: oda kur (kuzey · Ele Geçirme · 8v8 botlu), oda harita olarak kuzey'i tutar mı, kurulum süresi, ilk snapshot,
// "ön hat" doğuş seçimi kabul, savaş alanı dışına yürüyen insan sunucuda 10 sn sonra ölür.   WS=ws://127.0.0.1:8931 node scripts/kuzeynet.mjs
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const a = await open();
const t0 = Date.now();
a.send(JSON.stringify({ t: 'create', name: 'Ali', cfg: { map: 'kuzey', type: 'conquest', perTeam: 8, bots: true, time: 900 } }));
let wa = null; for (let i = 0; i < 100 && !wa; i++) { await wait(100); wa = a.msgs.find((m) => m.t === 'welcome'); }
const tW = Date.now() - t0;
check(!!wa && (wa.cfg?.map || wa.map) === 'kuzey', `oda kuzey ile kuruldu (${tW} ms, harita ${wa?.cfg?.map || wa?.map})`);
await wait(1500);
const snaps = a.msgs.filter((m) => m.t === 'snap');
check(snaps.length > 10, `snapshot akıyor (${snaps.length})`);
a.send(JSON.stringify({ t: 'opt', spawn: 'front' }));
await wait(300);
check(!a.msgs.some((m) => m.t === 'error'), '"ön hat" doğuş seçimi kabul edildi');
console.log(fail ? `sonuç: ${fail} HATA` : 'sonuç: OK');
a.close(); process.exit(fail ? 1 : 0);
