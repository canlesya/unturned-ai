// Sunucu protokol testi (tarayıcısız): node scripts/nettest.mjs  (önce: npm run server)
import WebSocket from 'ws';
import { WALK_SPEED } from '../src/sim/input.js';
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
// hız hilesi: saniyede 240 girdi yollayan istemci normalden belirgin hızlı ilerlememeli
let yawBest = 0, bestD2 = 0;
for (let k = 0; k < 8; k++) {
  const before = a.msgs.filter((m) => m.t === 'snap').pop();
  const iv2 = setInterval(() => a.send(JSON.stringify({ t: 'in', q: ++q, f: 1, r: 0, l: 0, s: 0, j: 0, a: 0, yw: k * Math.PI / 4, pt: 0 })), 1000 / 60);
  await wait(400); clearInterval(iv2);
  const after = a.msgs.filter((m) => m.t === 'snap').pop();
  const d = Math.hypot(after.me.now.x - before.me.now.x, after.me.now.z - before.me.now.z);
  if (d > bestD2) { bestD2 = d; yawBest = k * Math.PI / 4; }
}
const posOf = () => { const m = a.msgs.filter((x) => x.t === 'snap').pop().me.now; return [m.x, m.z]; };
const walk = async (yw, hz, ms) => { const p0 = posOf(); const iv3 = setInterval(() => a.send(JSON.stringify({ t: 'in', q: ++q, f: 1, r: 0, l: 0, s: 0, j: 0, a: 0, yw, pt: 0 })), 1000 / hz); await wait(ms); clearInterval(iv3); await wait(150); const p1 = posOf(); return Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); };
await walk(yawBest + Math.PI, 60, 900); await wait(1500);       // geri dön + kuyruk boşalsın
const dNormal = await walk(yawBest, 60, 2000); await walk(yawBest + Math.PI, 60, 2000); await wait(1500);
const dFlood = await walk(yawBest, 240, 2000);
console.log(`      2 sn yürüyüş: normal (60/sn) ${dNormal.toFixed(2)} m · flood (240/sn) ${dFlood.toFixed(2)} m`);
// 2 sn'de 480 girdi yollandı; korumasız sunucu ~35 m yürütürdü. Sınır: 2 sn gerçek + 0,5 sn bir kerelik pay, 4,4 m/s * 1,1
const FLOOD_LIM = WALK_SPEED * 1.1 * 2.7;                           // yürüme hızı × silah çarpanı × 2,7 sn (flood'da sunucu gerçek zamanı aşan adım atmaz)
check(dFlood < FLOOD_LIM, `girdi flood saldırısıyla hızlanma yok (${dFlood.toFixed(1)} m < ${FLOOD_LIM.toFixed(1)} m)`);
await wait(1200);

await wait(300);
const aNow = a.msgs.filter((m) => m.t === 'snap').pop().me.now;
const sb = b.msgs.filter((m) => m.t === 'snap').pop();
const aInB = sb.s.find((s) => s.i === wa.id);
check(Math.abs(aInB.z - aNow.z) < 1.5 && Math.abs(aInB.x - aNow.x) < 1.5, 'B, A\'nın konumunu snapshot\'ta görüyor');
const ks = a.msgs.filter((m) => m.t === 'snap').map((m) => m.k);
const gaps = ks.slice(1).map((k, i) => k - ks[i]);
console.log(`      snapshot: ${ks.length} adet · aralık ${Math.min(...gaps)}–${Math.max(...gaps)} adım · son boyut ${JSON.stringify(snap1).length} bayt`);
check(gaps.every((g) => g === 3), 'snapshot her 3 adımda bir (20 Hz)');
a.close(); await wait(300);
const sb2 = b.msgs.filter((m) => m.t === 'roster').pop();
check(sb2.roster.find((r) => r.id === wa.id).human === false, 'A çıkınca slot bota döndü');
b.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
