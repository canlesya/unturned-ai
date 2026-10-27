// 12.187: sunucu yük ölçümü (tarayıcısız). Kuzey Vadisi Ele Geçirme 16v16 (büyük harita + araçlar), N ham istemci 60 Hz girdi yollar
// (yürür, döner, ara sıra ateş eder / zıplar; biri jip sürer). Süreç CPU / RSS (ps), adım hızı (snapshot k), snapshot aralığı titreşimi, boyut, bant.
//   PID=<sunucu pid> WS=ws://127.0.0.1:8969 N=8 SECS=90 MAP=kuzey PER=16 node scripts/netload.mjs
import WebSocket from 'ws';
import { execSync } from 'child_process';
const URL = process.env.WS || 'ws://127.0.0.1:8969', N = +(process.env.N || 8), SECS = +(process.env.SECS || 90), PID = process.env.PID, MAP = process.env.MAP || 'kuzey', PER = +(process.env.PER || 16), TYPE = process.env.TYPE || 'conquest';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cpuSec = () => { if (!PID) return null; try { const t = execSync(`ps -o time= -p ${PID}`).toString().trim(); const [m, sec] = t.split(':'); return +m * 60 + +sec; } catch { return null; } };
const ps = () => { if (!PID) return null; try { const [cpu, rss] = execSync(`ps -o %cpu=,rss= -p ${PID}`).toString().trim().split(/\s+/).map(Number); return { cpu, rss: Math.round(rss / 1024) }; } catch { return null; } };
const open = () => new Promise((res, rej) => { const w = new WebSocket(URL); w.on('open', () => res(w)); w.on('error', rej); });
const cl = [];
const mk = async (i, hello) => {
  const w = await open(); const c = { w, i, q: 0, id: null, bytes: 0, snaps: [], yaw: Math.random() * 6.28, f: 1, r: 0, alive: false };
  w.on('message', (d) => { c.bytes += d.length; const m = JSON.parse(d); if (m.t === 'welcome') { c.id = m.id; c.room = m.room; } if (m.t === 'snap') { c.alive = !!m.me.now.a; if (i === 0) c.snaps.push({ t: performance.now(), k: m.k, n: d.length }); } if (m.t === 'dbg') c.dbg = m; });
  w.send(JSON.stringify(hello)); cl.push(c); return c;
};
const host = await mk(0, { t: 'create', name: 'Yuk0', cfg: { type: TYPE, perTeam: PER, map: MAP, bots: true, listed: false, time: +(process.env.TIME || 3600) } });
const t0 = Date.now(); while (!host.room && Date.now() - t0 < 30000) await wait(50);
console.log('oda', host.room, MAP, TYPE, PER, 'kişi/takım');
for (let i = 1; i < N; i++) await mk(i, { t: 'join', room: host.room, name: 'Yuk' + i });
await wait(2000);
let tick = 0;
const timer = setInterval(() => {
  tick++;
  for (const c of cl) {
    if (c.w.readyState !== 1) continue;
    if (tick % 90 === c.i * 7 % 90) { c.yaw += (Math.random() - 0.5) * 2; c.f = Math.random() < 0.8 ? 1 : 0; c.r = Math.round((Math.random() - 0.5) * 2); }
    const fire = (tick + c.i * 13) % 120 < 25;
    c.w.send(JSON.stringify({ t: 'in', q: ++c.q, f: c.f, r: c.r, l: 0, s: c.f && !fire ? 1 : 0, j: tick % 240 === c.i ? 1 : 0, a: fire ? 1 : 0, yw: c.yaw + Math.sin(tick / 30) * 0.3, pt: -0.05, w: 0, fh: fire ? 1 : 0, fp: (tick + c.i * 13) % 120 === 0 ? 1 : 0, vt: null }));
  }
}, 1000 / 60);
// 1. istemci araca binmeyi dener (Kuzey'de jip: üs park yeri yakında olabilir; olmazsa yürür)
const samples = [];
const T0 = Date.now(), C0 = cpuSec();
while (Date.now() - T0 < SECS * 1000) {
  await wait(5000);
  const p = ps(); if (p) samples.push(p);
  const s = host.snaps, last = s.slice(-100), ks = last.map((x) => x.k);
  console.log(`${Math.round((Date.now() - T0) / 1000)} sn · CPU ${p?.cpu ?? '?'}% · RSS ${p?.rss ?? '?'} MB · son 100 snapshot ${ks.length ? ((ks.at(-1) - ks[0]) / ((last.at(-1).t - last[0].t) / 1000)).toFixed(1) : '?'} adım/sn · boyut ${last.length ? Math.round(last.reduce((a, x) => a + x.n, 0) / last.length) : '?'} B`);
}
clearInterval(timer);
const C1 = cpuSec(); if (C0 != null) console.log(`süreç CPU zamanı: ${(C1 - C0).toFixed(2)} sn / ${((Date.now() - T0) / 1000).toFixed(0)} sn = ${(100 * (C1 - C0) / ((Date.now() - T0) / 1000)).toFixed(1)}% çekirdek`);
const s = host.snaps, gaps = s.slice(1).map((x, i) => x.t - s[i].t).sort((a, b) => a - b), q = (p) => gaps[Math.floor(gaps.length * p)]?.toFixed(0);
const dur = (s.at(-1).t - s[0].t) / 1000, rate = (s.at(-1).k - s[0].k) / dur;
const bw = cl.map((c) => c.bytes / (SECS + 2) / 1024), wire = cl.map((c) => (c.w._socket?.bytesRead || 0) / (SECS + 2) / 1024);
console.log(`\nadım hızı ${rate.toFixed(2)} /sn (hedef 60) · snapshot aralığı p50 ${q(0.5)} / p99 ${q(0.99)} / en çok ${gaps.at(-1)?.toFixed(0)} ms · > 100 ms boşluk ${gaps.filter((g) => g > 100).length}`);
console.log(`bant (istemci başına, aşağı) açılmış ${(bw.reduce((a, b) => a + b, 0) / bw.length).toFixed(1)} KB/sn · hatta ${(wire.reduce((a, b) => a + b, 0) / wire.length).toFixed(1)} KB/sn (sıkıştırma: ${cl[0].w.extensions || 'yok'})`);
if (samples.length) { const c = samples.map((x) => x.cpu), r = samples.map((x) => x.rss); console.log(`CPU ort ${(c.reduce((a, b) => a + b, 0) / c.length).toFixed(1)}% (en çok ${Math.max(...c)}) · RSS ${r[0]} → ${r.at(-1)} MB (en çok ${Math.max(...r)})`); }
for (const c of cl) c.w.close();
await wait(300);
process.exit(0);
