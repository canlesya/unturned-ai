// Paintball çevrimiçi oda testi (tarayıcısız): node scripts/pbnet.mjs   WS=ws://127.0.0.1:8787 (sunucu BF_DEBUG=1 ile: ışınlama komutu)
// pb odası kurulur (harita her zaman Boya Kulesi), kişi sınırı LIMITS'ten, sabit teçhizat, ikinci oyuncu katılır, kuyuya yürüyen elenip ~3 sn'de doğar, oda listesinde görünür.
import WebSocket from 'ws';
import { PB_LOADOUT } from '../src/game/match.js';
import { LIMITS } from '../src/game/balance.js';
const URL = process.env.WS || 'ws://127.0.0.1:8787', HTTP = URL.replace(/^ws/, 'http');
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const last = (ws) => ws.msgs.filter((m) => m.t === 'snap').pop();

const a = await open(), b = await open();
a.send(JSON.stringify({ t: 'create', name: 'Boyacı', cfg: { type: 'pb', map: 'kasaba', perTeam: 40, time: 600 } }));
await wait(1500);
const wa = a.msgs.find((m) => m.t === 'welcome');
check(!!wa, 'pb odası kuruldu: ' + (wa && wa.room));
check(wa.cfg.type === 'pb' && wa.cfg.map === 'boyakulesi', `harita zorla Boya Kulesi (${wa.cfg.map}), mod ${wa.cfg.type}`);
check(wa.cfg.perTeam === LIMITS.pbMax && wa.roster.length === LIMITS.pbMax, `kişi sınırı ${wa.cfg.perTeam} = LIMITS.pbMax (roster ${wa.roster.length})`);
check(new Set(wa.roster.map((r) => r.team)).size === wa.roster.length, 'herkes tek (her savaşçının kendi takımı)');
await wait(600);
const me = wa.roster.find((r) => r.id === wa.id);
const sn = last(a), mine = sn && sn.s.find((s) => s.i === wa.id);
const items = (mine && mine.it) || (a.msgs.filter((m) => m.t === 'snap').map((m) => m.s.find((s) => s.i === wa.id)).find((s) => s && s.it) || {}).it;
check(items && items.join() === PB_LOADOUT().join(), `sabit teçhizat: ${items && items.join(' + ')}`);
void me;
b.send(JSON.stringify({ t: 'join', room: wa.room, name: 'Fırça' }));
await wait(500);
const wb = b.msgs.find((m) => m.t === 'welcome');
check(!!wb && wb.id !== wa.id && wb.cfg.type === 'pb', `ikinci oyuncu katıldı (id ${wb && wb.id})`);
const rooms = await (await fetch(HTTP + '/rooms')).json();
const r = (rooms.rooms || rooms).find?.((x) => x.code === wa.room);
check(r && r.type === 'pb' && r.map === 'boyakulesi' && r.cap === LIMITS.pbMax, `oda listesinde: ${r && `${r.type} · ${r.map} · ${r.humans}/${r.cap}`}`);
// kuyu: kenara ışınla, kuyuya doğru yürü (yaw π = +z)
a.send(JSON.stringify({ t: 'dbg', bots: false }));
await wait(5300);                                                        // son 5 sn içinde vuran kalmasın (yoksa öldürme ona yazılır: "düşürdü")
a.send(JSON.stringify({ t: 'dbg', tp: [0, -12.2] }));
await wait(300);
const d0 = last(a).me.now.de, rs0 = last(a).me.rs;
let q = 1e5, tDie = -1; const t0 = Date.now(), m0 = a.msgs.length;
const iv = setInterval(() => a.send(JSON.stringify({ t: 'in', q: ++q, f: 1, r: 0, l: 0, s: 0, j: 0, a: 0, yw: Math.PI, pt: 0 })), 1000 / 60);
for (let k = 0; k < 60 && tDie < 0; k++) { await wait(50); const s = last(a); if (s && !s.me.now.a) tDie = (Date.now() - t0) / 1000; }
clearInterval(iv);
const yMin = Math.min(...a.msgs.filter((m) => m.t === 'snap').slice(-60).map((m) => m.me.now.y));
check(tDie > 0 && tDie < 3, `kuyuya yürüyen ${tDie.toFixed(2)} sn'de elendi (en düşük y ${yMin.toFixed(1)})`);
const ev = a.msgs.slice(m0).filter((m) => m.t === 'ev').flatMap((m) => m.l).find((e) => e.e === 'kill' && e.v === wa.id);
check(ev && /Kuyu/.test(ev.w) && ev.k === wa.id, `öldürme olayı: "${ev && ev.w}" (kendi düştü)`);
await wait(1200);
check(last(a).me.now.de === d0 + 1, 'ölüm sayısı +1');
let tBack = -1;
for (let k = 0; k < 80 && tBack < 0; k++) { await wait(100); const s = last(a); if (s.me.rs !== rs0 && s.me.now.a) tBack = (Date.now() - t0) / 1000 - tDie; }
const sp = last(a).me.now;
check(tBack > 2 && tBack < 4.5 && sp.y >= -0.01, `~3 sn sonra doğdu (${tBack.toFixed(1)} sn, y ${sp.y})`);
a.close(); b.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
