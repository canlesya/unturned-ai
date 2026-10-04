// Enfekte çevrimiçi testi: oda kur (type=inf), insan oyuncu zombi tarafından öldürülünce roster/olay/anlık görüntü doğru mu? (önce: BF_DEBUG=1 npm run server)
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const a = await open();
a.send(JSON.stringify({ t: 'create', name: 'Ali', cfg: { map: 'kasaba', type: 'inf', perTeam: 8, time: 120 } }));
await wait(1500);
const w = a.msgs.find((m) => m.t === 'welcome');
check(!!w, 'oda kuruldu: ' + (w && w.room) + ' tür ' + (w && w.cfg.type));
check(w.cfg.type === 'inf' && w.cfg.perTeam === 8, 'sunucu ayarı enfekte / toplam 8 olarak aldı');
const me = w.roster.find((r) => r.id === w.id);
const zs = w.roster.filter((r) => r.cls === 'zombie'), hs = w.roster.filter((r) => r.cls !== 'zombie');
console.log(`      roster: ${hs.length} insan, ${zs.length} zombi; ben: ${me.team}/${me.cls}`);
check(zs.length >= 1 && zs.every((r) => r.team === 'red') && hs.every((r) => r.team === 'blue'), 'zombiler red/zombie, insanlar blue');
const snap = a.msgs.filter((m) => m.t === 'snap').pop();
check(snap && snap.tk[0] + snap.tk[1] === 8, `snapshot sayaçları insan+zombi = 8 (${snap && snap.tk})`);
check(snap.s.some((p) => p.mh === 200) || snap.s.some((p) => p.mh === 100), 'snapshot maxHp (mh) taşıyor');
if (me.cls !== 'zombie') {
  // kendimi öldür (debug): zombi olarak doğmalı
  a.send(JSON.stringify({ t: 'dbg', kill: 1 })); await wait(200); a.send(JSON.stringify({ t: 'dbg', kill: 1 }));
  await wait(7500);
  const ev = a.msgs.filter((m) => m.t === 'ev').flatMap((m) => m.l).filter((e) => e.e === 'inf');
  check(ev.some((e) => e.v === w.id), 'inf olayı yayınlandı (benim kimliğim)');
  const s2 = a.msgs.filter((m) => m.t === 'snap').pop();
  check(s2.me.now.a === 1 && s2.me.now.it.length === 1 && s2.me.now.it[0] === 'claws', 'yeniden doğdum: tek eşya pençe');
  console.log(`      ben şimdi: can ${s2.me.now.hp}/${s2.me.now.mh}, sayaç ${s2.tk}`);
}
// bitiş: tüm insanlar enfekte olursa maç biter (hızlı test için sayaç)
console.log('hata:', fail);
a.close();
process.exit(fail ? 1 : 0);
