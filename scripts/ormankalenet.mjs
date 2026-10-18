// Orman Kalesi çevrimiçi oda testi (tarayıcısız): node scripts/ormankalenet.mjs   WS=ws://127.0.0.1:8787
// pb odası map=ormankale ile kurulur, ikinci oyuncu katılır, oda listesinde görünür, sabit teçhizat; pb + başka harita → Boya Kulesi (varsayılan),
// pb + random → iki paintball haritasından biri, tdm + ormankale → reddedilip kasaba; snapshot'ta oyuncu harita içinde ve yürüyor.
import WebSocket from 'ws';
import { PB_LOADOUT } from '../src/game/match.js';
const URL = process.env.WS || 'ws://127.0.0.1:8787', HTTP = URL.replace(/^ws/, 'http');
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const create = async (cfg) => { const ws = await open(); ws.send(JSON.stringify({ t: 'create', name: 'Test', cfg })); await wait(1300); return [ws, ws.msgs.find((m) => m.t === 'welcome')]; };

const [a, wa] = await create({ type: 'pb', map: 'ormankale', perTeam: 8, time: 600 });
check(wa && wa.cfg.type === 'pb' && wa.cfg.map === 'ormankale', `pb odası Orman Kalesi'nde kuruldu (${wa && wa.room} · ${wa && wa.cfg.map})`);
await wait(600);
const snaps = () => a.msgs.filter((m) => m.t === 'snap');
const it = (snaps().map((m) => m.s.find((s) => s.i === wa.id)).find((s) => s && s.it) || {}).it;
check(it && it.join() === PB_LOADOUT().join(), `sabit teçhizat: ${it && it.join(' + ')}`);
const b = await open(); b.send(JSON.stringify({ t: 'join', room: wa.room, name: 'Fırça' })); await wait(600);
const wb = b.msgs.find((m) => m.t === 'welcome');
check(wb && wb.cfg.map === 'ormankale' && wb.id !== wa.id, 'ikinci oyuncu katıldı (aynı harita)');
const rooms = await (await fetch(HTTP + '/rooms')).json();
const r = (rooms.rooms || rooms).find?.((x) => x.code === wa.room);
check(r && r.type === 'pb' && r.map === 'ormankale', `oda listesinde: ${r && `${r.type} · ${r.map} · ${r.humans}/${r.cap}`}`);
// yürüme: kuzeye 1,5 sn ileri → konum değişir, alanın içinde
const p0 = snaps().pop().me.now; let q = 1e5;
const iv = setInterval(() => a.send(JSON.stringify({ t: 'in', q: ++q, f: 1, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0 })), 1000 / 60);
await wait(1500); clearInterval(iv); await wait(200);
const p1 = snaps().pop().me.now;
check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1 && Math.abs(p1.x) < 28 && Math.abs(p1.z) < 28, `sunucuda yürünür (${p0.x.toFixed(1)},${p0.z.toFixed(1)} → ${p1.x.toFixed(1)},${p1.z.toFixed(1)})`);
a.close(); b.close();
const [c, wc] = await create({ type: 'pb', map: 'kasaba' }); c.close();
check(wc && wc.cfg.map === 'boyakulesi', `pb + kasaba → varsayılan Boya Kulesi (${wc && wc.cfg.map})`);
const seen = new Set();
for (let i = 0; i < 6; i++) { const [d, wd] = await create({ type: 'pb', map: 'random' }); d.close(); seen.add(wd && wd.cfg.map); }
check([...seen].every((x) => x === 'boyakulesi' || x === 'ormankale'), `pb + rastgele → paintball haritası (${[...seen].join(', ')})`);
const [e, we] = await create({ type: 'tdm', map: 'ormankale' }); e.close();
check(we && we.cfg.map === 'kasaba', `tdm + ormankale → reddedilir (${we && we.cfg.map})`);
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
