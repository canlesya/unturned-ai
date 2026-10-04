// Gecikme/titreşim ekleyen WebSocket vekili (ağ testi): node scripts/netproxy.mjs [dinlenen=8790] [hedef=8787] [tekYön ms=35] [titreşim ms=15] [kayıp %=0]
import { WebSocketServer, WebSocket } from 'ws';
const [LISTEN = 8790, TARGET = 8787, BASE = 35, JIT = 15, LOSS = 0] = process.argv.slice(2).map(Number);
const wss = new WebSocketServer({ port: LISTEN });
const delay = () => BASE + Math.random() * JIT;
wss.on('connection', (c) => {
  const up = new WebSocket(`ws://127.0.0.1:${TARGET}`), q = [];
  const pipe = (from, to, tag) => from.on('message', (d, isBin) => {
    if (tag === 'up' && LOSS && Math.random() * 100 < LOSS) return;
    // sıra korunsun (TCP gibi): her mesaj bir öncekinden sonra teslim edilir
    const t = Math.max(delay() + performance.now(), (pipe.last?.[tag] || 0) + 0.01);
    (pipe.last ||= {})[tag] = t;
    setTimeout(() => { if (to.readyState === 1) to.send(d, { binary: isBin }); }, t - performance.now());
  });
  up.on('open', () => { pipe(c, up, 'up'); pipe(up, c, 'down'); });
  c.on('close', () => up.close()); up.on('close', () => c.close());
});
console.log(`vekil :${LISTEN} → :${TARGET} · tek yön ${BASE}-${BASE + JIT} ms`);
