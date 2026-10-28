// 12.211 Yönetici paneli oda listesi: iş parçacığındaki odalar doğru görünüyor mu (oyuncu sayısı, asker, başarım, "worker").
//   ADMIN=http://127.0.0.1:9001 BF_DATA=/tmp/wb-srv2-data node scripts/adminrooms.mjs   (yerel test sunucusu; şifre BF_DATA/admin-password.txt)
import fs from 'node:fs';
const A = process.env.ADMIN || 'http://127.0.0.1:8788', DATA = process.env.BF_DATA || 'data';
const pw = fs.readFileSync(`${DATA}/admin-password.txt`, 'utf8').trim().split(/\s+/).pop();
const lr = await fetch(A + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-wb': '1' }, body: JSON.stringify({ pw }) });
const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
if (!lr.ok) { console.log('HATA giriş', lr.status); process.exit(1); }
const rooms = await (await fetch(A + '/api/rooms', { headers: { cookie } })).json();
let fail = 0;
for (const r of rooms.filter((x) => x.humans || x.worker)) {
  console.log(`${r.code} ${r.worker ? '[iş parçacığı]' : '[ana]'} ${r.map} ${r.type} · ${r.humans}/${r.cap} oyuncu · ${r.soldiers} asker · oyuncular ${JSON.stringify(r.players.map((p) => `${p.name}(${p.team})`))} · başarım ${r.perf ? `sim ${r.perf.simAvg} µs p95 ${r.perf.simP95}, yük ${r.perf.load}` : '-'}`);
  if (r.worker && (r.players.length !== r.humans || (r.humans && !r.perf) || !r.soldiers)) { console.log('  HATA: iş parçacığı odasının özeti eksik'); fail++; }
}
console.log(fail ? 'SONUÇ: HATA' : 'SONUÇ: OK');
process.exit(fail ? 1 : 0);
