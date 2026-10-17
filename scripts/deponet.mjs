// Depo çevrimiçi: tarayıcıda oda kur (map=depo, ele geçirme 5v5), ikinci istemci WS ile katılır; harita, bayraklar, snapshot, yürüme denetimi.
//   WS=ws://127.0.0.1:8800 URL=http://127.0.0.1:5195 node scripts/deponet.mjs
import { chromium } from 'playwright';
import WebSocket from 'ws';
const WS = process.env.WS || 'ws://127.0.0.1:8787', URL0 = process.env.URL || 'http://127.0.0.1:5195', OUT = process.env.OUT || '/tmp/wb-depo-shots';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?online=new&name=Test&map=depo&type=conquest&per=5&server=${encodeURIComponent(WS)}&debug=1&nolock=1`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.online', null, { timeout: 120000 });
await wait(2500);
const st = await page.evaluate(() => { const g = window.__game; return { map: g.map.id, room: g.online.room || g.opts?.online?.room || null, flags: g.mode.objectives.map((o) => o.label), n: g.soldiers.length, cfg: g.opts?.online?.cfg?.map }; });
check(st.map === 'depo', `çevrimiçi odada harita: ${st.map} · bayraklar ${st.flags.join(',')} · savaşçı ${st.n}`);
const room = await page.evaluate(() => { const g = window.__game; return g.online?.roomCode || g.online?.room || document.body.innerText.match(/\b[A-Z0-9]{4,6}\b/)?.[0]; });
// odalar listesinde görünüyor mu (HTTP /rooms)
const http = WS.replace(/^ws/, 'http');
const rooms = await (await fetch(http + '/rooms')).json().catch(() => null);
const mine = rooms && (rooms.rooms || rooms).find?.((r) => r.map === 'depo' && !r.official);
check(!!mine, `/rooms listesinde depo odası: ${mine ? mine.code || mine.id : 'yok'}`);
// ikinci istemci katılır, yürür
const code = mine ? mine.code || mine.id : room;
const b = new WebSocket(WS); b.msgs = []; b.on('message', (d) => b.msgs.push(JSON.parse(d)));
await new Promise((r) => b.on('open', r));
b.send(JSON.stringify({ t: 'join', room: code, name: 'Veli' }));
await wait(800);
const wb = b.msgs.find((m) => m.t === 'welcome');
check(!!wb && wb.cfg?.map === 'depo', `ikinci istemci katıldı (harita ${wb?.cfg?.map})`);
let q = 0, best = 0;
for (let k = 0; k < 8 && best < 1.5; k++) {
  const s0 = b.msgs.filter((m) => m.t === 'snap').pop();
  const iv = setInterval(() => b.send(JSON.stringify({ t: 'in', q: ++q, f: 1, r: 0, l: 0, s: 0, j: 0, a: 0, yw: k * Math.PI / 4, pt: 0 })), 1000 / 60);
  await wait(600); clearInterval(iv);
  const s1 = b.msgs.filter((m) => m.t === 'snap').pop();
  if (s0?.me?.now && s1?.me?.now) best = Math.max(best, Math.hypot(s1.me.now.x - s0.me.now.x, s1.me.now.z - s0.me.now.z));
}
check(best > 1.5, `ikinci istemci sunucuda yürüdü (${best.toFixed(2)} m)`);
await wait(4000);
const pos = await page.evaluate(() => window.__game.soldiers.filter((s) => s.alive).map((s) => [s.pos.x, s.pos.z]));
check(pos.length > 4 && pos.every(([x, z]) => Math.abs(x) <= 30.01 && Math.abs(z) <= 34.01), `sunucu botları harita içinde (${pos.length} canlı)`);
await page.screenshot({ path: `${OUT}/online-depo.png` });
check(errs.length === 0, `sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
b.close(); await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK');
process.exit(fail ? 1 : 0);
