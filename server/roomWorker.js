// 12.211 Oda iş parçacığı: büyük bir oda (Room + başsız Game) kendi worker_threads iş parçacığında koşar; ana iş parçacığı yalnız
// WebSocket'i (ping / pong, sel sınırı, JSON ayrıştırma, moderatör komutları) tutar. Ağır simin adımı diğer odaları ve bağlantı
// kalp atışını bekletmez. Bağlantılar burada sahte ws nesneleridir: send / close ana iş parçacığına sıralı işlem listesi olarak gider
// (mikro görevde toplu, döngü başına tek postMessage). Protokol: server/roomHost.js.
import { parentPort, workerData } from 'node:worker_threads';
import { MapBuilder } from '../src/maps/builder.js';
import { loadBalance } from './balanceStore.js';
import { Room, roomMessage, enterRoom } from './room.js';
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';
MapBuilder.noVisual = true;
loadBalance();

const ops = [];
let flushQ = false;
const flush = () => { flushQ = false; if (ops.length) parentPort.postMessage({ t: 'ops', l: ops.splice(0) }); };
const op = (o) => { ops.push(o); if (!flushQ) { flushQ = true; queueMicrotask(flush); } };

let room = null;
const fakes = new Map();                     // bağlantı no (cid) → sahte ws
class FakeWs {
  constructor(cid) { this.cid = cid; this.readyState = 1; this._ctx = null; }
  get ctx() { return this._ctx; }
  set ctx(v) {                               // Room ws.ctx'i değiştirdikçe ana iş parçacığı da bilir (oda içi asker no / bekleme / ayrılma)
    this._ctx = v;
    if (this.readyState !== 1) return;
    const id = v ? v.id : null;
    op(['c', this.cid, id, id >= 0 ? room?.clients.get(id)?.name || '' : '']);
  }
  send(str) { if (this.readyState === 1) op(['s', this.cid, str]); }
  close(code, reason) { if (this.readyState !== 1) return; this.readyState = 3; fakes.delete(this.cid); op(['x', this.cid, code, reason]); }
  terminate() { this.close(1006, ''); }
}

function state() {
  if (!room) return;
  const g = room.game;
  op(['st', {
    info: room.info(), cfg: room.cfg, balVer: room.balVer || 0, soldiers: g.soldiers.length, ended: !!g.ended, tl: g.timeLeft === Infinity ? -1 : Math.round(g.timeLeft),
    emptySince: room.emptySince, perf: room.clients.size ? room.perfStats() : null,
    players: [...room.clients.values()].map((c) => { const s = g.soldiers[c.id]; return { id: c.id, name: c.name, team: s.team, cls: s.cls, kills: s.kills || 0, assists: s.assists || 0, deaths: s.deaths || 0 }; }),
  }]);
}

// Yedek iş parçacığı (workerData.spare): modüller yüklü + her harita bir kez kurulmuş (ilk kurulum / JIT pahalı: Kuzey soğukken 3–5 sn) bekler;
// oda kurulunca 'init' ile hemen odaya dönüşür (server/roomHost.js takeSpare).
function warm() {
  const t0 = performance.now(), only = { newyork: 'inf', boyakulesi: 'pb', ormankale: 'pb', maden: 'payload', cephe: 'front', yorunge: 'space' };
  for (const [id, mp] of Object.entries(MAPS)) {
    if (mp.dev) continue;
    try { const g = new Game(null, { headless: true, map: id, tod: 'day', weather: 'clear', diff: 'normal', bots: true, match: { perTeam: 4, type: only[id] || 'conquest', time: 600 } }); g.step(1 / 60); g.dispose(); } catch (e) { console.error('[ısınma]', id, e.message); }
  }
  return Math.round(performance.now() - t0);
}
let code = null;
function init(d) {
  code = d.code; loadBalance();
  room = new Room(d.code, d.cfg, d.opts);
  room.thread = true;                        // [başarım] satırında "(iş parçacığı)"
  state();
  setInterval(state, 500);
  setInterval(() => { if (room?.official) { room.activate(); if (room.idleTick(Date.now())) state(); } }, 1000);      // boş resmi oda dönüşü (iş parçacığında: ana döngüyü tutmaz)
}

parentPort.on('message', (m) => {
  if (m.t === 'init') { if (!room) init(m); return; }
  if (!room) return;
  try {
    switch (m.t) {
      case 'm': {
        const ws = fakes.get(m.cid);
        if (process.env.BF_DEBUG && m.m.t === 'dbg' && (m.m.crash || m.m.hang)) {          // test (scripts/workercrash.mjs): çökme / kilitlenme taklidi
          console.log(`[oda iş parçacığı ${code}] test: ${m.m.crash ? 'çökme' : 'kilitlenme'}`);
          setTimeout(() => { if (m.m.crash) throw new Error('test: oda iş parçacığı çökmesi'); for (;;); }, 10);
          break;
        }
        if (ws && ws.ctx) roomMessage(room, ws, m.m);
        break;
      }
      case 'enter': {
        const ws = new FakeWs(m.cid); fakes.set(m.cid, ws);
        if (!enterRoom(room, ws, m.p)) { fakes.delete(m.cid); ws.readyState = 3; op(['d', m.cid]); }
        state();
        break;
      }
      case 'leave': {                        // bağlantı kapandı / moderatör attı
        const ws = fakes.get(m.cid); if (!ws) break;
        fakes.delete(m.cid);
        room.activate(); room.leave(ws.ctx ? ws.ctx.id : -1, ws, !!m.quiet);
        ws.readyState = 3;
        state();
        break;
      }
      case 'bc': room.broadcast(m.msg); break;
      case 'sys': room.sys(m.text); break;
      case 'official': room.activate(); room.setOfficial(m.o); state(); break;
      case 'bal': loadBalance(); break;
      case 'shutdown': room.activate(); if (m.msg) room.shutdown(m.msg); else room.dispose(); room = null; flush(); parentPort.postMessage({ t: 'bye' }); break;
    }
  } catch (e) { console.error(`[oda iş parçacığı ${code}]`, e); }
});

if (workerData.spare) { const ms = warm(); parentPort.postMessage({ t: 'ready', ms }); }
else init(workerData);
