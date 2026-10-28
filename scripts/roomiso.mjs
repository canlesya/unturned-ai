// 12.211 Oda izolasyonu ölçümü (tarayıcısız): aynı sunucuda büyük oda (Kuzey NvN, bir izleyici) + küçük oda (Kasaba 5v5, ölçen istemci).
// Küçük odanın snapshot aralığı (p50 / p95 / en uzun) ve uygulama düzeyi ping (t:'ping' → 'pong') gidiş-dönüş süresi; büyük odanınki de.
//   WS=ws://127.0.0.1:8988 node scripts/roomiso.mjs [N=128] [saniye=60] [büyük oda sayısı=1]
// (canlı sunucunun ~2,5× yavaş işlemcisini taklit etmek için 2 büyük oda: tek iş parçacığında adım bütçesi aşılır)
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787', N = +(process.argv[2] || 128), SECS = +(process.argv[3] || 60);
const open = () => new Promise((r) => { const w = new WebSocket(URL); w.on('open', () => r(w)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function meter(ws) {
  const M = { gaps: [], rtt: [], last: 0, n: 0, on: false, raw: 0, wire0: 0, ws };
  ws.on('message', (d) => {
    const m = JSON.parse(d), t = performance.now();
    if (M.on) M.raw += d.length;                       // açılmış (ham) bayt; hat üstü (deflate) baytı soketten: ws._socket.bytesRead
    if (m.t === 'snap' && M.on) { M.n++; if (M.last) M.gaps.push(t - M.last); M.last = t; }
    if (m.t === 'pong' && M.on) M.rtt.push(t - m.c);
    if (m.t === 'welcome') M.room = m.room;
  });
  setInterval(() => { if (M.on && ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping', c: performance.now() })); }, 250);
  return M;
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
const NB = +(process.argv[4] || 1), bigs = [];
for (let k = 0; k < NB; k++) {
  const big = await open(), M = meter(big);
  big.send(JSON.stringify({ t: 'create', name: 'Buyuk' + k, cfg: { map: 'kuzey', type: 'conquest', perTeam: N, time: 1800 } }));
  for (let i = 0; i < 120 && !M.room; i++) await wait(250);
  bigs.push(M);
}
const bm = bigs[0];
const small = await open(), sm = meter(small);
small.send(JSON.stringify({ t: 'create', name: 'Kucuk', cfg: { map: 'kasaba', type: 'conquest', perTeam: 5, time: 1800 } }));
for (let i = 0; i < 120 && !sm.room; i++) await wait(250);
await wait(3000);
for (const M of [...bigs, sm]) { M.on = true; M.wire0 = M.ws._socket.bytesRead; }
await wait(SECS * 1000);
for (const M of [...bigs, sm]) M.wire = M.ws._socket.bytesRead - M.wire0;
const f = (v) => (Number.isFinite(v) ? v.toFixed(1) : '-');
const line = (k, M) => `${k}: snapshot ${M.n} (${(M.n / SECS).toFixed(1)}/sn) · aralık p50 ${f(q(M.gaps, 0.5))} p95 ${f(q(M.gaps, 0.95))} en uzun ${f(Math.max(...M.gaps))} ms · ping p50 ${f(q(M.rtt, 0.5))} p95 ${f(q(M.rtt, 0.95))} en çok ${f(Math.max(...M.rtt))} ms · bant ${(M.wire / SECS / 1024).toFixed(1)} KB/sn hat (ham ${(M.raw / SECS / 1024).toFixed(1)} KB/sn)`;
for (const M of bigs) console.log(line(`büyük oda (${N}v${N} Kuzey, ${M.room})`, M));
console.log(line(`küçük oda (5v5 Kasaba, ${sm.room})`, sm));
process.exit(0);
