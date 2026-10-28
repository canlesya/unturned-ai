// 12.211 İş parçacığındaki odada yeni oyun öğeleri istemciye ulaşıyor mu (tarayıcısız): Kuzey NvN (> 64 asker → iş parçacığı) odasında
// olay türlerini (atış, öldürme, patlama, C4 / mayın / ikmal 'dep' / 'depx' / 'ammo', tanksavar 'ts', araç …) ve snapshot alanlarını sayar.
//   WS=ws://127.0.0.1:9000 HTTP=http://127.0.0.1:9000 node scripts/workerevents.mjs [N=40] [saniye=150]
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787', HTTP = process.env.HTTP || URL.replace(/^ws/, 'http');
const N = +(process.argv[2] || 40), SECS = +(process.argv[3] || 150);
const ws = new WebSocket(URL), ev = {}, snapKeys = {}, vehKeys = new Set();
let room = null, snaps = 0, err = 0;
ws.on('message', (d) => {
  let m; try { m = JSON.parse(d); } catch { err++; return; }
  if (m.t === 'welcome') room = m.room;
  if (m.t === 'ev') for (const e of m.l) ev[e.e] = (ev[e.e] || 0) + 1;
  if (m.t === 'snap') { snaps++; for (const k of Object.keys(m)) snapKeys[k] = (snapKeys[k] || 0) + 1; }
});
await new Promise((r) => ws.on('open', r));
ws.send(JSON.stringify({ t: 'create', name: 'Gozcu', cfg: { map: 'kuzey', type: 'conquest', perTeam: N, time: 1800 } }));
await new Promise((r) => setTimeout(r, SECS * 1000));
const h = await (await fetch(HTTP + '/health')).json();
const w = h.workers?.find((x) => x.code === room);
console.log(`oda ${room}: ${w ? `iş parçacığında (${w.soldiers} asker)` : 'ana iş parçacığında'} · ${snaps} snapshot · ayrıştırma hatası ${err}`);
console.log('olaylar:', JSON.stringify(Object.fromEntries(Object.entries(ev).sort((a, b) => b[1] - a[1]))));
console.log('snapshot alanları:', JSON.stringify(snapKeys));
const want = ['sh', 'kill', 'boom', 'dep'];
const miss = want.filter((k) => !ev[k]);
console.log(miss.length ? `EKSİK olay: ${miss.join(', ')}` : 'SONUÇ: OK');
process.exit(0);
