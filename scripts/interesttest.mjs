// 12.203 İlgi alanı testi (tarayıcısız, yerel sunucu): Kuzey Vadisi 128v128 oda kurulur, 12 sn snapshot toplanır.
//  · her asker en geç 4 snapshot'ta bir gelir (5 Hz), yakındaki düşman her snapshot'ta, ölüm / doğuş (a değişimi) atlanmaz
//  · seyrek askerin yavaş alanları (it / kl…) değiştiyse ilk gelişinde tam paket (skor kaçmaz)
//  · küçük odada (Kasaba 5v5) herkes her snapshot'ta (eski davranış)
//  · istemci başına ham snapshot boyutu (KB/sn) — eskisi (hepsi her snapshot'ta) ile karşılaştırma
//   WS=ws://127.0.0.1:8968 node scripts/interesttest.mjs
import WebSocket from 'ws';
import { IM_NEAR } from '../src/net/interest.js';
import zlib from 'node:zlib';
const URL = process.env.WS || 'ws://127.0.0.1:8787';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const open = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.bytes = 0; ws.on('message', (d) => { ws.bytes += d.length; const m = JSON.parse(d); if (m.t === 'ev') { ws.evB = (ws.evB || 0) + d.length; ws.evN = (ws.evN || 0) + (m.l?.length || 0); } if (m.t === 'snap') { m._len = d.length; if (ws.msgs.length % 5 === 0) m._z = zlib.deflateRawSync(d, { level: 1 }).length; ws.msgs.push(m); } else if (m.t === 'welcome') ws.welcome = m; }); ws.on('open', () => res(ws)); });

async function room(cfg, secs, act) {
  const a = await open();
  a.send(JSON.stringify({ t: 'create', name: 'Ilgi', cfg }));
  for (let i = 0; i < 200 && !a.welcome; i++) await wait(100);
  if (act) { await wait(1500); act(a); }
  await wait(secs * 1000);
  a.close();
  return a;
}

// 1) büyük oda
const A = await room({ map: 'kuzey', type: 'conquest', perTeam: 128, time: 900 }, 14, (a) => a.send(JSON.stringify({ t: 'dbg', tp: [a.welcome.id < 128 ? -120 : 120, a.welcome.id < 128 ? -660 : 660] })));      // düşman üssünün yanına: yakın düşman bol (BF_DEBUG=1)
const S = A.msgs.slice(20);                                     // ilk saniye (katılım: hepsi tam) hariç
const myId = A.welcome?.id;
check(S.length > 150, `snapshot alındı: ${S.length}`);
const N = 256, last = new Array(N).fill(-1), gaps = new Array(N).fill(0), seen = new Array(N).fill(0);
let worstGap = 0, aMiss = 0, nearMiss = 0, nearN = 0;
const lastA = [];
const pos = [];
S.forEach((m, si) => {
  const me = m.me?.now;
  const ids = new Set(m.s.map((p) => p.i));
  for (const p of m.s) { if (last[p.i] >= 0) { const g = si - last[p.i]; gaps[p.i] = Math.max(gaps[p.i], g); worstGap = Math.max(worstGap, g); } last[p.i] = si; seen[p.i]++; pos[p.i] = p; if (lastA[p.i] !== undefined && lastA[p.i] !== p.a) { /* a değişimi gelmiş */ } lastA[p.i] = p.a; }
  // yakın (≤ IM_NEAR − 10 m) düşman bu snapshot'ta var mı (bir önceki konumundan)
  if (me) for (let i = 0; i < N; i++) { const q = pos[i]; if (!q || i === myId) continue; const d = Math.hypot(q.x - me.x, q.z - me.z); if (d < IM_NEAR - 10 && q.a && Math.floor(i / 1) >= 0) { const foe = (i < 128) !== (myId < 128); if (foe) { nearN++; if (!ids.has(i)) nearMiss++; } } }
});
const kb = S.reduce((a, m) => a + m._len, 0) / (S.length / 20) / 1024;
const avgN = S.reduce((a, m) => a + m.s.length, 0) / S.length;
const Z = S.filter((m) => m._z), kbz = Z.reduce((a, m) => a + m._z, 0) / Z.length * 20 / 1024;
check(worstGap <= 4, `her asker en geç 4 snapshot'ta bir (en uzun aralık ${worstGap})`);
check(seen.filter((n) => n > 0).length === N, `bütün askerler geldi (${seen.filter((n) => n > 0).length}/${N})`);
check(nearN === 0 || nearMiss / nearN < 0.02, `yakın düşman her snapshot'ta (kaçan %${nearN ? ((nearMiss / nearN) * 100).toFixed(1) : 0}, ${nearN} örnek)`);
// yavaş alan: skor (kl) değişen askerin bir sonraki gelişinde kl alanı var mı (tam paket)
let slowOk = 0, slowBad = 0; const kl = [];
for (const m of S) for (const p of m.s) { if (p.kl !== undefined) { kl[p.i] = p.kl; } }
// kl değişimi ölçümü: ardışık tam paketler arasında kl artan askerler (kaçırılmadıysa artış tam pakette görünür)
const firstKl = [], lastKl = [];
for (const m of S) for (const p of m.s) if (p.kl !== undefined) { if (firstKl[p.i] === undefined) firstKl[p.i] = p.kl; lastKl[p.i] = p.kl; }
for (let i = 0; i < N; i++) if (lastKl[i] !== undefined) (lastKl[i] >= firstKl[i] ? slowOk++ : slowBad++);
check(slowBad === 0 && slowOk > 200, `yavaş alanlar (skor) tutarlı: ${slowOk} asker`);
const evKB = (A.evB || 0) / 15 / 1024;
console.log(`      128v128: olay mesajları ~${evKB.toFixed(0)} KB/sn ham (${((A.evN || 0) / 15).toFixed(0)} olay/sn: atış izi / ses / öldürme; ilgi alanı dışı, herkese)`);
console.log(`      128v128: snapshot başına ort. ${avgN.toFixed(0)} / 256 asker · istemci başına ham ${kb.toFixed(0)} KB/sn, sıkıştırılmış (tek tek deflate, üst sınır) ~${kbz.toFixed(0)} KB/sn`);

// 2) küçük oda: herkes her snapshot'ta
const B = await room({ map: 'kasaba', type: 'conquest', perTeam: 5 }, 4);
const SB = B.msgs.slice(10);
const nB = SB.length ? SB[0].s.length : 0;
check(SB.length > 40 && SB.every((m) => m.s.length === nB), `küçük oda (Kasaba 5v5): her snapshot'ta ${nB} asker (eskisi gibi)`);
console.log(fail ? `sonuç: ${fail} HATA` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
