// Çevrimiçi herkes-tek doğuş: WS ile depo / liman dm odası kurulur, ikinci oyuncu katılır; iki oyuncunun doğuşu aynı yerde değil, takım avlusunda değil.
//   WS=ws://127.0.0.1:8806 node scripts/ffanet.mjs
import WebSocket from 'ws';
import { Game } from '../src/game/game.js';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => ws.msgs.push(JSON.parse(d))); ws.on('open', () => res(ws)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const meOf = (ws) => ws.msgs.filter((m) => m.t === 'snap' && m.me?.now).pop()?.me.now;
for (const map of ['depo', 'liman']) {
  const ref = new Game(null, { headless: true, map, match: { perTeam: 4, type: 'tdm' } });
  const team = [...ref.map.spawns.blue, ...ref.map.spawns.red];
  const inYard = (p) => team.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.3);
  const a = await open(), b = await open();
  a.send(JSON.stringify({ t: 'create', name: 'Ali', cfg: { map, type: 'dm', perTeam: 8 } }));
  await wait(1500);
  const wa = a.msgs.find((m) => m.t === 'welcome');
  check(!!wa && wa.cfg?.type === 'dm' && wa.cfg?.map === map, `${map}: A dm odası kurdu (${wa?.room})`);
  b.send(JSON.stringify({ t: 'join', room: wa.room, name: 'Veli' }));
  await wait(1500);
  const pa = meOf(a), pb = meOf(b), d = pa && pb ? Math.hypot(pa.x - pb.x, pa.z - pb.z) : 0;
  console.log(`      A (${pa?.x.toFixed(1)}, ${pa?.z.toFixed(1)})  B (${pb?.x.toFixed(1)}, ${pb?.z.toFixed(1)})  arası ${d.toFixed(1)} m`);
  check(pa && pb && d >= 8, `${map}: A ile B aynı yerde doğmadı (${d.toFixed(1)} m)`);
  check(pa && pb && !inYard(pa) && !inYard(pb), `${map}: doğuşlar takım avlusu noktası değil (dm havuzu)`);
  a.close(); b.close(); await wait(300);
}
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
