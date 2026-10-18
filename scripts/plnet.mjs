// Vagon modu çevrimiçi protokol testi (tarayıcısız, iki ws istemcisi). Sunucu BF_DEBUG=1 ile çalışmalı (tp / pld test komutları).
//   WS=ws://127.0.0.1:8830 node scripts/plnet.mjs
import WebSocket from 'ws';
import { makeTrack } from '../src/game/track.js';
import { MADEN_TRACK } from '../src/maps/maden.js';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = () => new Promise((res, rej) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); ws.on('error', rej); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const tr = makeTrack(MADEN_TRACK, 2.5);
const snap = (ws) => ws.msgs.filter((m) => m.t === 'snap').pop();
const st = (pl) => ({ d: pl[0], push: pl[1] & 7, block: (pl[1] >> 3) & 7, state: ['idle', 'push', 'contest', 'back', 'block'][(pl[1] >> 6) & 7], over: !!(pl[1] & 512) });
const side = (d, lat) => { const q = tr.at(d); return [q.x - q.dz * lat, q.z + q.dx * lat]; };

const a = await open(), b = await open();
a.send(JSON.stringify({ t: 'create', name: 'Ali', team: 'blue', cfg: { map: 'kasaba', type: 'payload', perTeam: 3, bots: false, name: 'Vagon testi' } }));
await wait(1500);
const wa = a.msgs.find((m) => m.t === 'welcome');
check(!!wa && wa.cfg.type === 'payload' && wa.cfg.map === 'maden', `A oda kurdu: ${wa?.room} · mod ${wa?.cfg.type} · harita ${wa?.cfg.map} (Vagon yalnız Maden Ocağı'nda)`);
b.send(JSON.stringify({ t: 'join', room: wa.room, name: 'Veli', team: 'red' }));
await wait(600);
const wb = b.msgs.find((m) => m.t === 'welcome');
const me = (w) => w.roster.find((r) => r.id === w.id);
check(!!wb && me(wa).team === 'blue' && me(wb).team === 'red', `B katıldı: A ${me(wa).team} (saldıran), B ${me(wb)?.team} (savunan)`);
const rooms = await (await fetch(URL.replace(/^ws/, 'http') + '/rooms')).json().catch(() => null);
const ri = (rooms?.rooms || rooms || []).find?.((r) => r.code === wa.room);
check(!ri || ri.type === 'payload', `oda listesinde mod: ${ri ? ri.type + ' · ' + ri.map : '(liste okunamadı)'}`);
let s0 = snap(a);
check(!!s0?.pl && Math.abs(s0.pl[0] - 12) < 0.01, `snapshot vagon alanı: ${JSON.stringify(s0?.pl)} (başlangıç d=12)`);
const dbg = (ws, m) => ws.send(JSON.stringify({ t: 'dbg', ...m }));
// 1) A vagonun yanında → ilerler
dbg(b, { tp: [-44, -30] });
dbg(a, { tp: side(12, 1.6) });
await wait(2600);
let s1 = st(snap(a).pl);
check(s1.d > 13.5 && s1.state === 'push' && s1.push === 1, `A yanında: vagon ilerledi d ${s1.d} · durum ${s1.state} · iten ${s1.push}`);
check(Math.abs(st(snap(b).pl).d - s1.d) < 0.3, `iki istemci aynı vagon konumunu alıyor (A ${s1.d}, B ${st(snap(b).pl).d})`);
// 2) B de yanında → çekişme, durur
const dNow = s1.d;
dbg(a, { tp: side(dNow + 0.4, 1.6) }); dbg(b, { tp: side(dNow + 1.5, -1.8) });
await wait(800);
const c0 = st(snap(a).pl).d; await wait(1500); const c1 = st(snap(a).pl);
check(c1.state === 'contest' && Math.abs(c1.d - c0) < 0.05 && c1.block === 1, `B de yanında: ÇEKİŞME, vagon durdu (d ${c0} → ${c1.d}, durum ${c1.state})`);
// 3) kontrol noktası: olay + süre ödülü
dbg(b, { tp: [-44, -30] });
const cp1 = tr.corners[1], tl0 = snap(a).tl;
dbg(a, { pld: cp1 - 1.2, tp: side(cp1 - 1.2, 1.6) });
await wait(2200);
const evs = a.msgs.filter((m) => m.t === 'ev').flatMap((m) => m.l);
const plc = evs.find((e) => e.e === 'plc');
const s3 = snap(a);
check(!!plc && plc.i === 1 && st(s3.pl).d > cp1, `A · Makas geçildi: olay ${JSON.stringify(plc)} · d ${st(s3.pl).d.toFixed(1)}`);
check(s3.tl > tl0 + 100, `süre ödülü: ${tl0} → ${s3.tl} sn`);
check(b.msgs.filter((m) => m.t === 'ev').flatMap((m) => m.l).some((e) => e.e === 'plc'), 'B de kontrol noktası olayını aldı');
// 4) bitiş: vagon maden ağzına
dbg(a, { pld: tr.len - 1.0, tp: side(tr.len - 1.0, 1.6) });
await wait(2500);
const end = a.msgs.find((m) => m.t === 'end'), endB = b.msgs.find((m) => m.t === 'end');
check(!!end && end.winner === 'blue' && !!endB, `maç bitti: ${end?.winner} · ${end?.why}`);
a.close(); b.close();

// 5) botlu oda: botlar vagonu kendileri itiyor mu (gerçek zaman 25 sn)
const c = await open();
c.send(JSON.stringify({ t: 'create', name: 'Can', team: 'red', cfg: { type: 'payload', perTeam: 4, bots: true, name: 'Vagon botlu' } }));
await wait(1500);
const wc = c.msgs.find((m) => m.t === 'welcome');
dbg(c, { tp: [44, 10] });
const ivs = setInterval(() => dbg(c, { hp: 100 }), 1000);
let maxD = 0, states = new Set();
for (let k = 0; k < 25; k++) { await wait(1000); const p = snap(c)?.pl; if (p) { maxD = Math.max(maxD, p[0]); states.add(st(p).state); } }
clearInterval(ivs);
check(!!wc && maxD > 14, `botlu odada saldıran botlar vagonu itiyor: en çok d ${maxD.toFixed(1)} · görülen durumlar ${[...states].join(', ')}`);
c.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
