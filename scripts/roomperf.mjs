// 12.203 Sunucu oda başarımı (tarayıcısız): yerel sunucuda Kuzey Vadisi NvN oda kurar, süre boyunca snapshot aralığını ölçer (sunucu adımı bütçeyi
// aşarsa aralık 50 ms'nin üstüne çıkar; oda kurulumu sunucuyu kilitlerse en uzun aralık büyür). Sunucu günlüğünde 30 sn'de bir [başarım] satırı.
//   WS=ws://127.0.0.1:8968 node scripts/roomperf.mjs [N=128] [saniye=70]
import WebSocket from 'ws';
const ws = new WebSocket(process.env.WS || 'ws://127.0.0.1:8787');
let n = 0, last = 0;
const gaps = [];
ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'snap') { n++; const t = performance.now(); if (last) gaps.push(t - last); last = t; } });
ws.on('open', () => ws.send(JSON.stringify({ t: 'create', name: 'Perf', cfg: { map: 'kuzey', type: 'conquest', perTeam: +(process.argv[2] || 128), time: 900 } })));
await new Promise((r) => setTimeout(r, +(process.argv[3] || 70) * 1000));
gaps.sort((a, b) => a - b);
console.log('snapshot', n, '· aralık p50', gaps[gaps.length >> 1]?.toFixed(1), 'ms · p95', gaps[Math.floor(gaps.length * 0.95)]?.toFixed(1), '· en uzun', gaps[gaps.length - 1]?.toFixed(1));
ws.close(); process.exit(0);
