// Canlı sunucu gecikme / snap aralığı ölçümü (tek bağlantı): ROOM=OFC1 node scripts/liveprobe.mjs
import WebSocket from 'ws';
const URL = process.env.WS || 'wss://ws.warbyte.io', ROOM = process.env.ROOM || 'OFC1', DUR = +(process.env.DUR || 20000);
const ws = new WebSocket(URL);
const t0 = performance.now(); let last = 0, gaps = [], sizes = [], q = 0, welcome = null, types = {};
ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room: ROOM, name: 'probe' })); });
ws.on('message', (d) => {
  const now = performance.now(), m = JSON.parse(d); types[m.t] = (types[m.t] || 0) + 1;
  if (m.t === 'welcome') welcome = now - t0;
  if (m.t === 'snap') { if (last) gaps.push(now - last); last = now; sizes.push(d.length); }
});
const iv = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'in', q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0 })), 1000 / 60);
setTimeout(() => {
  clearInterval(iv); ws.close();
  gaps.sort((a, b) => a - b); const p = (x) => gaps[Math.floor(gaps.length * x)]?.toFixed(1);
  const avgSz = sizes.reduce((a, b) => a + b, 0) / (sizes.length || 1);
  console.log({ welcomeMs: welcome?.toFixed(0), snaps: gaps.length + 1, perSec: ((gaps.length + 1) / (DUR / 1000)).toFixed(1), gapAvg: (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1), p50: p(0.5), p95: p(0.95), p99: p(0.99), max: gaps.at(-1)?.toFixed(1), over100: gaps.filter((g) => g > 100).length, over250: gaps.filter((g) => g > 250).length, avgSnapKB: (avgSz / 1024).toFixed(1), kbps: (avgSz * sizes.length / 1024 / (DUR / 1000)).toFixed(0), types });
  process.exit(0);
}, DUR);
