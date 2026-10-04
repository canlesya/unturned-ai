// Silah Yarışı çevrimiçi testi (önce: BF_DEBUG=1 npm run server): oda türü, ağdan seviye/eşyalar, bot öldürmeleriyle seviye artışı.
import WebSocket from 'ws';
const open = () => new Promise((res) => { const ws = new WebSocket(process.env.WS || 'ws://127.0.0.1:8787'); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const a = await open();
a.send(JSON.stringify({ t: 'create', name: 'Ali', cls: 'heavy', cfg: { map: 'kasaba', type: 'gg', perTeam: 6, time: 600, diff: 'hard' } }));
await wait(1500);
const w = a.msgs.find((m) => m.t === 'welcome');
check(!!w && w.cfg.type === 'gg' && w.cfg.perTeam === 6, 'oda Silah Yarışı olarak kuruldu');
const me = w.roster.find((r) => r.id === w.id);
check(me.cls === 'assault', `sınıf seçimi yok sayıldı (heavy → ${me.cls})`);
let s = a.msgs.filter((m) => m.t === 'snap').pop();
check(s.me.now.it.length === 2 && s.me.now.it[0] === 'm4a1' && s.me.now.gl === 0, `ilk silah ${s.me.now.it} seviye ${s.me.now.gl}`);
// botlar birbirini öldürsün: 90 sn sonra bazı seviyeler artmış olmalı
await wait(60000);
s = a.msgs.filter((m) => m.t === 'snap').pop();
const lv = s.s.map((p) => p.gl);
console.log('      seviyeler:', lv.join(','));
check(Math.max(...lv) >= 2, 'botlar seviye atladı (snapshot gl)');
const evs = a.msgs.filter((m) => m.t === 'ev').flatMap((m) => m.l).filter((e) => e.e === 'lvl');
check(evs.length >= 2, `lvl olayları yayınlandı (${evs.length})`);
const other = s.s.find((p) => p.gl >= 2);
check(other && other.it[0] !== 'm4a1' || other.it.length === 1, `başkasının silahı ağdan geliyor: ${other && other.it}`);
console.log('hata:', fail);
a.close(); process.exit(fail ? 1 : 0);
