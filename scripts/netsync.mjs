// 12.187: üç istemcide aynı oyun mu? (tarayıcısız) Öldürme akışı (sıra + alanlar), skor tablosu (K / A / Ö / puan), ölüm → snapshot'ta ölü
// gecikmesi, yeniden doğuşta koruma bayrağı, koruma süresince hasar yok (sunucu), atış korumayı bitirir. Sunucu BF_DEBUG=1.
//   WS=ws://127.0.0.1:8969 node scripts/netsync.mjs [saniye=25]       (vekil üzerinden de: WS=ws://127.0.0.1:18971)
import WebSocket from 'ws';
const URL = process.env.WS || 'ws://127.0.0.1:8969', SECS = +(process.argv[2] || 25);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const open = () => new Promise((res, rej) => { const w = new WebSocket(URL); w.on('open', () => res(w)); w.on('error', rej); });
const C = [];
const mk = async (hello) => {
  const w = await open(), c = { w, kills: [], snaps: [], tab: {}, alive: {}, id: null, room: null, q: 0, rec: false, dbg: null };
  w.on('message', (d) => {
    const m = JSON.parse(d), t = performance.now();
    if (m.t === 'welcome') { c.id = m.id; c.room = m.room; }
    if (m.t === 'dbg') c.dbg = m;
    if (m.t === 'ev') for (const e of m.l) if (e.e === 'kill' && c.rec) c.kills.push({ t, k: e.k, v: e.v, w: e.w, hs: !!e.hs });
    if (m.t === 'snap') {
      for (const p of m.s) { if (p.kl !== undefined) c.tab[p.i] = [p.kl, p.as || 0, p.de, p.sc]; c.alive[p.i] = p.a; }
      if (c.rec) c.snaps.push({ t, k: m.k, a: m.s.map((p) => [p.i, p.a, p.f]) });
    }
  });
  w.send(JSON.stringify(hello)); C.push(c);
  const t0 = Date.now(); while (!c.room && Date.now() - t0 < 15000) await wait(30);
  return c;
};
const c0 = await mk({ t: 'create', name: 'Senk0', cfg: { type: 'tdm', perTeam: 5, map: 'kasaba', bots: true, listed: false, time: 3600 } });
const c1 = await mk({ t: 'join', room: c0.room, name: 'Senk1' });
const c2 = await mk({ t: 'join', room: c0.room, name: 'Senk2' });
console.log('oda', c0.room, 'id', C.map((c) => c.id).join(','));
const tm = setInterval(() => { for (const c of C) if (c.w.readyState === 1) c.w.send(JSON.stringify({ t: 'in', q: ++c.q, f: 0, r: 0, yw: 0, pt: 0, w: 0, vt: null })); }, 1000 / 60);
await wait(1500);
for (const c of C) c.rec = true;
const dbg = (c, o) => c.w.send(JSON.stringify({ t: 'dbg', ...o }));
// dbg ile öldürmeler (botlar da kendi aralarında çatışır)
const T0 = Date.now(); let n = 0;
while (Date.now() - T0 < SECS * 1000) {
  const c = C[n % 3], live = Object.entries(c0.alive).filter(([i, a]) => a && +i !== c.id).map(([i]) => +i);
  if (live.length) dbg(c, { dmg: [live[n * 7 % live.length], n % 4 === 0 ? 30 : 9999, n % 3 === 0 ? 1 : 0] });
  n++; await wait(700);
}
for (const c of C) c.rec = false;
await wait(2600);                                                           // yavaş alanların periyodik tam gönderimi (2 sn)
// 1) öldürme akışı aynı
const key = (c) => c.kills.map((k) => `${k.k}>${k.v}:${k.w}:${k.hs ? 1 : 0}`);
const k0 = key(c0), same = C.every((c) => JSON.stringify(key(c)) === JSON.stringify(k0));
check(k0.length > 10 && same, `öldürme akışı üç istemcide aynı sırada (${k0.length} öldürme; ${C.map((c) => c.kills.length).join(' / ')})`);
// 2) skor tablosu aynı + sunucuyla aynı
dbg(c0, { ask: 1 }); await wait(400);
const sv = c0.dbg?.kad || [];
const tabs = C.map((c) => sv.map((_, i) => c.tab[i] || [0, 0, 0, 0]));
const eq = tabs.every((t) => JSON.stringify(t) === JSON.stringify(sv));
check(eq, `skor tablosu (K / A / Ö / puan) sunucu = istemci 1 = 2 = 3 (${sv.filter((r) => r[0] || r[2]).length} dolu satır)`);
if (!eq) for (let i = 0; i < sv.length; i++) if (tabs.some((t) => JSON.stringify(t[i]) !== JSON.stringify(sv[i]))) console.log('   satır', i, 'sunucu', JSON.stringify(sv[i]), 'istemciler', tabs.map((t) => JSON.stringify(t[i])).join(' '));
// 3) ölüm → snapshot'ta ölü gecikmesi; doğuşta koruma bayrağı
const lat = [], prot = [];
for (const c of C) for (const k of c.kills) {
  const s = c.snaps.find((x) => x.t >= k.t - 1 && x.a.some(([i, a]) => i === k.v && !a));
  if (s) lat.push(s.t - k.t);
  const back = c.snaps.find((x) => x.t > k.t + 500 && x.a.some(([i, a]) => i === k.v && a));
  if (back) prot.push(!!(back.a.find(([i]) => i === k.v)[2] & 128));
}
lat.sort((a, b) => a - b);
check(lat.length && lat[Math.floor(lat.length * 0.95)] < 120, `öldürme olayı → snapshot'ta ölü: medyan ${lat[lat.length >> 1]?.toFixed(0)} ms · %95 ${lat[Math.floor(lat.length * 0.95)]?.toFixed(0)} ms`);
check(prot.length > 5 && prot.every(Boolean), `yeniden doğan askerin ilk canlı snapshot'ında koruma bayrağı (${prot.filter(Boolean).length}/${prot.length})`);
// 4) koruma: c1'i öldür, doğunca c0 hasar versin (dbg dmg korumayı sıfırlar → gerçek atış gerekir: koruma sunucuda dbg ask ile)
dbg(c1, { kill: 1 }); await wait(400);
let back = false; const t1 = Date.now(); while (Date.now() - t1 < 12000) { if (c0.alive[c1.id]) { back = true; break; } await wait(50); }
dbg(c1, { ask: 1 }); await wait(300);
check(back && c1.dbg?.sv?.prot > 0, `c1 yeniden doğdu, sunucuda koruma ${c1.dbg?.sv?.prot} sn`);
// koruma varken c1 ateş ederse koruma biter (sunucu)
c1.w.send(JSON.stringify({ t: 'in', q: ++c1.q, f: 0, r: 0, yw: 0, pt: 0, w: 0, fh: 1, fp: 1 }));
await wait(1200); c1.dbg = null; dbg(c1, { ask: 1 }); await wait(1200);
check(c1.dbg?.sv?.prot === 0, `ateş edince koruma bitti (${c1.dbg?.sv?.prot})`);
clearInterval(tm);
for (const c of C) c.w.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
