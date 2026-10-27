// 12.187: başka odalar kurulurken dolu odadaki oyuncunun snapshot boşluğu (olay döngüsü kilidi). A bir odada oynar (60 Hz girdi);
// sırayla Batı Cephesi / Kuzey / Kasaba / Vadi / Askeri Üs / New York / Orman Kalesi odaları kurulur (her biri ayrı bağlantı, sonra kapanır).
//   WS=ws://127.0.0.1:8969 node scripts/netstall.mjs        (sunucuyu BF_WARM=0 ile açıp karşılaştır)
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8969';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = () => new Promise((res, rej) => { const w = new WebSocket(URL); w.on('open', () => res(w)); w.on('error', rej); });
const A = await open(); let last = 0, room = null; const gaps = [];
A.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') room = m.room; if (m.t === 'snap') { const t = performance.now(); if (last) gaps.push({ t, g: t - last }); last = t; } });
A.send(JSON.stringify({ t: 'create', name: 'Oyuncu', cfg: { type: 'dm', perTeam: 6, map: 'depo', bots: true, listed: false } }));
let q = 0; const tm = setInterval(() => A.send(JSON.stringify({ t: 'in', q: ++q, f: 1, yw: q / 200, pt: 0, w: 0 })), 1000 / 60);
await wait(3000);
const plan = [['front', 'cephe'], ['conquest', 'kuzey'], ['conquest', 'kasaba'], ['conquest', 'vadi'], ['conquest', 'us'], ['inf', 'newyork'], ['pb', 'ormankale'], ['space', 'yorunge']];
const res = [];
for (const [type, map] of plan) {
  const B = await open(); const t0 = performance.now(); let tw = null;
  B.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome' && tw === null) tw = performance.now(); });
  B.send(JSON.stringify({ t: 'create', name: 'Kurucu', cfg: { type, map, perTeam: 6, bots: true, listed: false } }));
  await wait(2500);
  const g = gaps.filter((x) => x.t > t0).map((x) => x.g), mx = Math.max(...g);
  res.push({ map, ms: Math.round(mx), kur: tw ? Math.round(tw - t0) : null });
  console.log(`${map.padEnd(10)} kurulurken A'nın en büyük snapshot boşluğu ${Math.round(mx)} ms (oda kurulumu ${tw ? Math.round(tw - t0) : '?'} ms)`);
  B.close(); await wait(500);
}
clearInterval(tm); A.close();
const worst = Math.max(...res.map((r) => r.ms));
console.log(`en kötü: ${worst} ms · oda ${room}`);
process.exit(0);
