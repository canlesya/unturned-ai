// Enfekte çevrimiçi testi: oda kur (type=inf), insan oyuncu zombi tarafından öldürülünce roster/olay/anlık görüntü doğru mu? (önce: BF_DEBUG=1 npm run server)
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const a = await open();
a.send(JSON.stringify({ t: 'create', name: 'Ali', cfg: { map: 'kasaba', type: 'inf', perTeam: 8, time: 300 } }));
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
const bosses = snap.s.filter((p) => p.bs === 1);
check(bosses.length === 1 && bosses[0].mh > 1000 && bosses[0].zl === 3, `snapshot boss taşıyor: ${bosses.length} boss, can ${bosses[0] && bosses[0].mh}, hak ${bosses[0] && bosses[0].zl}`);
if (me.cls !== 'zombie') {
  a.send(JSON.stringify({ t: 'opt', zt: 'ghost' }));                 // sonraki doğuş için zombi türü: hayalet
  // kendimi öldür (debug): zombi olarak doğmalı
  a.send(JSON.stringify({ t: 'dbg', kill: 1 })); await wait(200); a.send(JSON.stringify({ t: 'dbg', kill: 1 }));
  await wait(7500);
  const ev = a.msgs.filter((m) => m.t === 'ev').flatMap((m) => m.l).filter((e) => e.e === 'inf');
  check(ev.some((e) => e.v === w.id), 'inf olayı yayınlandı (benim kimliğim)');
  const s2 = a.msgs.filter((m) => m.t === 'snap').pop();
  check(s2.me.now.a === 1 && s2.me.now.it.length === 1 && s2.me.now.it[0] === 'claws', 'yeniden doğdum: tek eşya pençe');
  check(s2.me.now.zt === 4 && s2.me.now.mh === 150, `seçtiğim tür geldi: hayalet (zt ${s2.me.now.zt}, can ${s2.me.now.mh})`);
  await wait(7500);                                                     // hazırlık süresi (14 sn) bitsin
  a.send(JSON.stringify({ t: 'in', q: 1, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, ab: 1 }));
  await wait(2000);
  const s3 = a.msgs.filter((m) => m.t === 'snap').pop(), evs = a.msgs.filter((m) => m.t === 'ev').flatMap((m) => m.l).filter((e) => e.e === 'ab' && e.by === w.id);
  check(s3.me.ab && s3.me.ab[0] > 5 && s3.me.ab[1] > 0, `özel güç sunucuda çalıştı (bekleme ${s3.me.ab && s3.me.ab[0]}, etkin ${s3.me.ab && s3.me.ab[1]})`);
  check(evs.length === 1 && evs[0].k === 'cloak', 'ab olayı yayınlandı: ' + (evs[0] && evs[0].k));
  check(!!(s3.me.now.f & 64), 'görünmezlik bayrağı anlık görüntüde');
  console.log(`      ben şimdi: can ${s2.me.now.hp}/${s2.me.now.mh}, sayaç ${s2.tk}`);
}
// bitiş: tüm insanlar enfekte olursa maç biter (hızlı test için sayaç)
console.log('hata:', fail);
a.close();
process.exit(fail ? 1 : 0);
