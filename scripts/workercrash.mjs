// 12.211 Oda iş parçacığı çökme / kilitlenme testi (tarayıcısız; sunucu BF_DEBUG=1 ile, > 64 asker → iş parçacığı):
//   WS=ws://127.0.0.1:9000 HTTP=http://127.0.0.1:9000 node scripts/workercrash.mjs [crash|hang]
// Kurulum: büyük oda (Kuzey 40v40, iş parçacığında, 2 oyuncu) + küçük oda (Kasaba 4v4, ana iş parçacığında, ölçen oyuncu). Büyük odada
// dbg { crash } (yakalanmayan hata) ya da { hang } (sonsuz döngü → bekçi BF_WORKER_HANG_MS) yollanır. Beklenen:
//  · büyük odadaki iki bağlantı da sistem mesajı + 4001 ile kapanır (sunucu süreci ayakta)
//  · küçük odanın snapshot akışı sürer (çökme sırasında en uzun aralık < 1 sn)
//  · /health yanıt verir, çöken oda listeden çıkar, workers boşalır; yeni büyük oda yeniden kurulabilir
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787', HTTP = process.env.HTTP || URL.replace(/^ws/, 'http');
const MODE = process.argv[2] || 'crash';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const health = async () => (await fetch(HTTP + '/health')).json();
function client(name) {
  const ws = new WebSocket(URL), C = { ws, name, snaps: 0, last: 0, gap: 0, room: null, closed: null, sys: [], open: new Promise((r) => ws.on('open', r)) };
  ws.on('message', (d) => {
    const m = JSON.parse(d), t = performance.now();
    if (m.t === 'welcome') C.room = m.room;
    if (m.t === 'snap') { C.snaps++; if (C.last && C.on) C.gap = Math.max(C.gap, t - C.last); C.last = t; }
    if (m.t === 'chat' && m.sys) C.sys.push(m.m);
    if (m.t === 'err') C.err = m.msg;
  });
  ws.on('close', (code) => { C.closed = code; });
  return C;
}
let fail = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'HATA ') + msg); if (!c) fail++; };
const h0 = await health();
const big = client('Aa'), small = client('Bb');
await big.open; await small.open;
big.ws.send(JSON.stringify({ t: 'create', name: 'Aa', cfg: { map: 'kuzey', type: 'conquest', perTeam: 40, time: 900 } }));
small.ws.send(JSON.stringify({ t: 'create', name: 'Bb', cfg: { map: 'kasaba', type: 'tdm', perTeam: 4, time: 900 } }));
for (let i = 0; i < 80 && !(big.room && small.room); i++) await wait(250);
const big2 = client('Cc'); await big2.open;
big2.ws.send(JSON.stringify({ t: 'join', room: big.room, name: 'Cc' }));
for (let i = 0; i < 40 && !big2.room; i++) await wait(250);
await wait(2000);
const h1 = await health();
const w = h1.workers?.find((x) => x.code === big.room);
ok(!!w && w.players === 2, `büyük oda ${big.room} iş parçacığında (${w?.soldiers} asker, ${w?.players} oyuncu), küçük oda ${small.room} ana iş parçacığında: ${!h1.workers?.some((x) => x.code === small.room)}`);
ok(big.snaps > 20 && big2.snaps > 20 && small.snaps > 20, `snapshot akıyor (büyük ${big.snaps}/${big2.snaps}, küçük ${small.snaps})`);
small.on = true; small.gap = 0;
const t0 = performance.now();
big.ws.send(JSON.stringify({ t: 'dbg', [MODE]: 1 }));
for (let i = 0; i < 120 && (big.closed == null || big2.closed == null); i++) await wait(250);
const dt = performance.now() - t0;
ok(big.closed === 4001 && big2.closed === 4001, `büyük odanın bağlantıları kapandı: ${big.closed} / ${big2.closed} (${(dt / 1000).toFixed(1)} sn) · sistem mesajı: ${JSON.stringify(big.sys.slice(-1))}`);
ok(!big.err, `oyundaki istemciye 'err' yollanmadı (bağlantı hatası yoluna düşmez): ${big.err || '-'}`);
await wait(1500);
const h2 = await health();
ok(h2.ok && !h2.workers?.some((x) => x.code === big.room), `/health ayakta, çöken oda listede yok (oda ${h0.rooms} → ${h1.rooms} → ${h2.rooms}, iş parçacığı ${h2.workers?.length})`);
ok(small.closed == null && small.gap < 1000, `küçük oda sürüyor (çökme sırasında en uzun snapshot aralığı ${small.gap.toFixed(0)} ms, bağlantı ${small.closed == null ? 'açık' : 'kapandı ' + small.closed})`);
const again = client('Dd'); await again.open;
again.ws.send(JSON.stringify({ t: 'create', name: 'Dd', cfg: { map: 'kuzey', type: 'conquest', perTeam: 40, time: 900 } }));
for (let i = 0; i < 80 && (!again.room || again.snaps < 10); i++) await wait(250);
const h3 = await health();
ok(!!again.room && again.snaps >= 10 && h3.workers?.some((x) => x.code === again.room), `yeni büyük oda kuruldu (${again.room}, ${again.snaps} snapshot, iş parçacığında)`);
for (const c of [small, again]) c.ws.close();
console.log(fail ? `SONUÇ: ${fail} HATA` : 'SONUÇ: OK');
process.exit(fail ? 1 : 0);
