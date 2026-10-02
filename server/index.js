// BlockFront çok oyunculu sunucu: node server/index.js   (PORT ortam değişkeniyle değişir, varsayılan 8787)
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { DEFAULT_PORT, makeRoomCode, cleanName } from '../src/net/protocol.js';

const PORT = +process.env.PORT || DEFAULT_PORT;
const MAX_ROOMS = +process.env.MAX_ROOMS || 20;
const rooms = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((a, r) => a + r.humanCount, 0) }));
    return;
  }
  res.writeHead(404); res.end('BlockFront sunucusu');
});
const wss = new WebSocketServer({ server, maxPayload: 4096 });

function err(ws, msg) { ws.send(JSON.stringify({ t: 'err', msg })); }

wss.on('connection', (ws) => {
  ws.ctx = null;                 // { room, id }
  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'in') { if (ws.ctx) ws.ctx.room.input(ws.ctx.id, m); return; }
    if (m.t === 'opt') { if (ws.ctx) ws.ctx.room.opt(ws.ctx.id, m); return; }
    if (m.t === 'dbg' && process.env.BF_DEBUG && ws.ctx) { ws.ctx.room.debug(ws.ctx.id, m); return; }   // yalnızca test için
    if (ws.ctx) return err(ws, 'Zaten bir odadasın');
    if (m.t === 'create') {
      if (rooms.size >= MAX_ROOMS) return err(ws, 'Sunucu dolu, sonra tekrar dene');
      let code; do code = makeRoomCode(); while (rooms.has(code));
      const room = new Room(code, m.cfg, () => rooms.delete(code));
      rooms.set(code, room);
      enter(ws, room, m);
    } else if (m.t === 'join') {
      const room = rooms.get(String(m.room || '').toUpperCase());
      if (!room) return err(ws, 'Oda bulunamadı');
      const why = room.canJoin();
      if (why) return err(ws, why);
      enter(ws, room, m);
    }
  });
  ws.on('close', () => { if (ws.ctx) ws.ctx.room.leave(ws.ctx.id); });
  ws.on('error', () => {});
});

function enter(ws, room, m) {
  const c = room.join(ws, cleanName(m.name), m.team, m.cls, m.loadout);
  if (!c) return err(ws, 'Oda dolu');
  ws.ctx = { room, id: c.id };
  console.log(`[${room.code}] ${c.name} katıldı (${room.humanCount} oyuncu)`);
}

// boş odaları temizle
setInterval(() => {
  for (const [code, r] of rooms) {
    if (!r.humanCount && r.emptySince && Date.now() - r.emptySince > 60000) { r.dispose(); rooms.delete(code); console.log(`[${code}] kapatıldı (boş)`); }
  }
}, 10000);

server.listen(PORT, () => console.log(`BlockFront sunucusu :${PORT} üzerinde dinliyor`));
