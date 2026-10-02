// Sunucu protokol testi (tarayıcısız): node scripts/nettest.mjs  (önce: npm run server)
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = (name) => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };

const a = await open(), b = await open();
a.send(JSON.stringify({ t: 'create', name: 'Ali', cfg: { map: 'kasaba', perTeam: 3 } }));
await wait(1500);
const wa = a.msgs.find((m) => m.t === 'welcome');
check(!!wa, 'A oda kurdu: ' + (wa && wa.room));
b.send(JSON.stringify({ t: 'join', room: wa.room, name: 'Veli' }));
await wait(300);
const wb = b.msgs.find((m) => m.t === 'welcome');
check(!!wb && wb.id !== wa.id, `B katıldı (id ${wb && wb.id} ≠ ${wa.id})`);
check(a.msgs.some((m) => m.t === 'roster'), 'A, B girince roster güncellemesi aldı');

// A, açık bir yöne (yaw=π) ileri yürür (60 Hz, 2 sn)
await wait(500);
const snap0 = a.msgs.filter((m) => m.t === 'snap').pop();
let q = 0, best = 0, bestSnap = snap0;
for (let k = 0; k < 8; k++) {            // spawn'ın önü kapalı olabilir: 8 yönü dene
  const before = a.msgs.filter((m) => m.t === 'snap').pop();
  const iv = setInterval(() => a.send(JSON.stringify({ t: 'in', q: ++q, f: 1, r: 0, l: 0, s: 0, j: 0, a: 0, yw: k * Math.PI / 4, pt: 0 })), 1000 / 60);
  await wait(500); clearInterval(iv);
  const after = a.msgs.filter((m) => m.t === 'snap').pop();
  const d = Math.hypot(after.me.now.x - before.me.now.x, after.me.now.z - before.me.now.z);
  if (d > best) { best = d; bestSnap = after; }
}
const snap1 = a.msgs.filter((m) => m.t === 'snap').pop();
console.log(`      A en iyi yönde 0.5 sn'de ${best.toFixed(2)} m yürüdü (ack ${snap1.me.ack}/${q})`);
check(snap1.me.ack > q - 10, 'sunucu girdileri işledi (ack yakın)');
check(best > 1.5, 'A sunucuda ilerledi');
const sb = b.msgs.filter((m) => m.t === 'snap').pop();
const aInB = sb.s.find((s) => s.i === wa.id);
check(Math.abs(aInB.z - snap1.me.now.z) < 1.5 && Math.abs(aInB.x - snap1.me.now.x) < 1.5, 'B, A\'nın konumunu snapshot\'ta görüyor');
const ks = a.msgs.filter((m) => m.t === 'snap').map((m) => m.k);
const gaps = ks.slice(1).map((k, i) => k - ks[i]);
console.log(`      snapshot: ${ks.length} adet · aralık ${Math.min(...gaps)}–${Math.max(...gaps)} adım · son boyut ${JSON.stringify(snap1).length} bayt`);
check(gaps.every((g) => g === 3), 'snapshot her 3 adımda bir (20 Hz)');
a.close(); await wait(300);
const sb2 = b.msgs.filter((m) => m.t === 'roster').pop();
check(sb2.roster.find((r) => r.id === wa.id).human === false, 'A çıkınca slot bota döndü');
b.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
