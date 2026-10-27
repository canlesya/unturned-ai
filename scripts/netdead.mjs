// 12.187: kopuk bağlantı bekçisi. Ping çerçevesine yanıt vermeyen (ağdan düşmüş gibi) istemci ~3 ping sonra kesilir, yuvası bota döner;
// yanıt veren ama hiç mesaj yollamayan (arka plandaki sekme) kalır.   Sunucu: BF_PING_MS=1500 ile aç →  WS=ws://… node scripts/netdead.mjs
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8969', PING = +(process.env.PING_MS || 1500);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const open = (o) => new Promise((res, rej) => { const w = new WebSocket(URL, o); w.msgs = []; w.on('message', (d) => w.msgs.push(JSON.parse(d))); w.on('open', () => res(w)); w.on('error', rej); });
const A = await open(); A.send(JSON.stringify({ t: 'create', name: 'Bekci', cfg: { type: 'tdm', perTeam: 3, map: 'depo', bots: true, listed: false } }));
await wait(1500); const room = A.msgs.find((m) => m.t === 'welcome').room;
const Dead = await open({ autoPong: false }); let deadClosed = 0; Dead.on('close', () => { deadClosed = performance.now(); });
const Idle = await open(); let idleClosed = false; Idle.on('close', () => { idleClosed = true; });
Dead.send(JSON.stringify({ t: 'join', room, name: 'Kopuk' })); Idle.send(JSON.stringify({ t: 'join', room, name: 'Uykuda' }));
await wait(800);
const t0 = performance.now();
let q = 0; const tm = setInterval(() => A.send(JSON.stringify({ t: 'in', q: ++q, yw: 0, pt: 0, w: 0 })), 50);      // A canlı (mesaj yollar)
await wait(PING * 5.5);
clearInterval(tm);
check(deadClosed > 0, `yanıtsız bağlantı kesildi (${deadClosed ? ((deadClosed - t0) / 1000).toFixed(1) + ' sn' : 'kesilmedi'})`);
check(!idleClosed, 'ping yanıtlayan sessiz bağlantı açık kaldı');
check(A.readyState === 1, 'mesaj yollayan bağlantı açık');
const ro = [...A.msgs].reverse().find((m) => m.t === 'roster');
check(ro && !ro.roster.some((r) => r.name === 'Kopuk' && r.human), 'kopuk oyuncunun yuvası bota döndü');
A.close(); Idle.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
