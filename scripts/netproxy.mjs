// Gecikme/titreşim ekleyen WebSocket vekili (ağ testi):
//   node scripts/netproxy.mjs [dinlenen=8790] [hedef=8787] [tekYön ms=35] [titreşim ms=15] [kayıp %=0] [takılma/sn=0] [takılma ms=150]
// takılma: TCP'deki yeniden gönderim / Wi-Fi tıkanması gibi, o yöndeki tüm mesajlar bir süre bekletilip art arda teslim edilir
// (canlıda ölçülen desen: ~saniyede bir 100-180 ms boşluk + ardından yığın). Her yön kendi takılmasını yaşar.
import { WebSocketServer, WebSocket } from 'ws';
const [LISTEN = 8790, TARGET = 8787, BASE = 35, JIT = 15, LOSS = 0, SPIKE_RATE = 0, SPIKE_MS = 150] = process.argv.slice(2).map(Number);
const wss = new WebSocketServer({ port: LISTEN });
const delay = () => BASE + Math.random() * JIT;
wss.on('connection', (c) => {
  const up = new WebSocket(`ws://127.0.0.1:${TARGET}`);
  const last = {}, stall = { up: 0, down: 0 };
  const spikes = SPIKE_RATE > 0 && setInterval(() => {
    for (const k of ['up', 'down']) if (Math.random() < SPIKE_RATE * 0.05) stall[k] = Math.max(stall[k], performance.now() + SPIKE_MS * (0.5 + Math.random() * 0.5));
  }, 50);
  const pipe = (from, to, tag) => from.on('message', (d, isBin) => {
    if (tag === 'up' && LOSS && Math.random() * 100 < LOSS) return;
    // sıra korunsun (TCP gibi): her mesaj bir öncekinden sonra teslim edilir
    const now = performance.now();
    const t = Math.max(Math.max(now, stall[tag]) + delay(), (last[tag] || 0) + 0.01);
    last[tag] = t;
    setTimeout(() => { if (to.readyState === 1) to.send(d, { binary: isBin }); }, t - now);
  });
  // bağlantı açılmadan gelen ilk mesajlar (oda kur / katıl) kaybolmasın: hedef açılınca sırayla iletilir
  const early = []; c.on('message', (d, isBin) => { if (up.readyState !== 1) early.push([d, isBin]); });
  up.on('open', () => { for (const [d, isBin] of early.splice(0)) up.send(d, { binary: isBin }); pipe(c, up, 'up'); pipe(up, c, 'down'); });
  up.on('error', () => c.close());
  c.on('close', () => { clearInterval(spikes); up.close(); }); up.on('close', () => c.close());
});
console.log(`vekil :${LISTEN} → :${TARGET} · tek yön ${BASE}-${BASE + JIT} ms${SPIKE_RATE ? ` · takılma ${SPIKE_RATE}/sn × ≤${SPIKE_MS} ms` : ''}`);
