// "Bir noktadan sonra hiç hasar veremiyorum, ölünce düzeliyor" testi (12.138). Tarayıcısız, gerçek sunucuya WS ile.
// node scripts/shotlag.mjs [ws=ws://127.0.0.1:8787] [stall ms=1200] [tek yön taban ms=15] [dalga ms=55]   (sunucu BF_DEBUG=1 ile açık olmalı)
// A (atıcı) gerçek istemci gibi davranır: 60 Hz sabit adım, sunucu adımını snapshot'tan kestirir (vt), B'yi 100 ms geriden interpolasyonla görür,
// ona nişan alıp seri atar (bas 0,6 sn / bırak 0,3 sn, arada tabanca + şarjör). B 12 m ötede sağa-sola koşar (yürüme hızı).
// Ağ: A'nın bağlantısında tek yön (varsayılan) 15–70 ms dalgalı gecikme + sıralı teslim (TCP gibi); 10. ve 16. sn'de yukarı yönde <stall> ms TAKILMA
// (yeniden iletim / Cloudflare / Wi-Fi), sonra biriken girdiler bir anda gelir. 26. sn'de A ölür ve yeniden doğar.
// Ölçülen: 2 sn'lik pencerelerde isabet oranı (sunucunun 'sh' / 'hm' olayları) + sunucudaki girdi kuyruğu (dbg ask).
import WebSocket from 'ws';
const URL = process.argv[2] || process.env.WS || 'ws://127.0.0.1:8787', STALL = +(process.argv[3] ?? 1200), LAT = +(process.argv[4] ?? 15), JIT = +(process.argv[5] ?? 55);
const HZ = 60, DT = 1 / HZ, SPOT = { ax: -25.38, z: 61.94, bx: -13.38 };      // Çöl Geçidi: açık, düz, 12 m görüşlü şerit (findspot)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = performance.now(), now = () => performance.now(), el = () => (now() - T0) / 1000;

// gecikmeli bağlantı: gönderim / alım sıralı, her mesaja dalgalı gecikme, takılma penceresinde bekler
function link(ws, lag) {
  const L = { up: 0, down: 0, stallUntil: 0, onmsg: null };
  const d = () => (lag ? LAT + Math.random() * JIT : 0);
  L.send = (o) => {
    const s = JSON.stringify(o);
    const at = Math.max(now() + d(), L.up + 0.01, L.stallUntil);
    L.up = at;
    setTimeout(() => ws.readyState === 1 && ws.send(s), at - now());
  };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw), at = Math.max(now() + d(), L.down + 0.01);
    L.down = at;
    setTimeout(() => L.onmsg && L.onmsg(m), at - now());
  });
  return L;
}
const open = () => new Promise((res, rej) => { const ws = new WebSocket(URL); ws.on('open', () => res(ws)); ws.on('error', rej); });

const wsA = await open(), wsB = await open();
const A = link(wsA, true), B = link(wsB, false);
const st = { A: { snaps: [], off: null, me: null, id: -1 }, B: { me: null, id: -1 } };
let room = null, dbgA = null;
const win = { sh: 0, hm: 0 };
A.onmsg = (m) => {
  const a = st.A;
  if (m.t === 'welcome') { a.id = m.id; room = m.room; }
  if (m.t === 'snap') {
    const cand = now() - (m.k / HZ) * 1000;
    a.off = a.off === null ? cand : cand < a.off ? cand : a.off + (cand - a.off) * 0.02;
    a.snaps.push({ k: m.k, s: m.s }); if (a.snaps.length > 30) a.snaps.shift();
    a.me = m.me;
  }
  if (m.t === 'ev') for (const e of m.l) { if (e.e === 'sh' && e.by === a.id && e.m) win.sh++; if (e.e === 'hm' && e.by === a.id) win.hm++; }
  if (m.t === 'dbg') dbgA = m;
};
B.onmsg = (m) => { if (m.t === 'welcome') st.B.id = m.id; if (m.t === 'snap') st.B.me = m.me; };

A.send({ t: 'create', name: 'Atici', cfg: { type: 'dm', map: 'colgecidi', perTeam: 4, bots: false } });
while (!room) await wait(20);
B.send({ t: 'join', room, name: 'Hedef' });
while (st.B.id < 0 || !st.A.me || !st.B.me) await wait(20);
const place = () => { A.send({ t: 'dbg', tp: [SPOT.ax, SPOT.z] }); B.send({ t: 'dbg', tp: [SPOT.bx, SPOT.z], hp: 1e6 }); };
place();
await wait(600);

// B: sağa-sola koşar (yaw = π/2 → sağ vektörü −z), 60 Hz; canı hep dolu
let qB = 0, dirB = 1;
const ivB = setInterval(() => {
  const z = st.B.me?.now?.z ?? SPOT.z;
  if (z < SPOT.z - 3.5) dirB = -1; else if (z > SPOT.z + 3.5) dirB = 1;
  B.send({ t: 'in', q: ++qB, f: 0, r: dirB, l: 0, s: 0, j: 0, a: 0, w: 0, yw: Math.PI / 2, pt: 0, vt: 0 });
}, 1000 / HZ);
const ivHp = setInterval(() => B.send({ t: 'dbg', hp: 1e6 }), 400);

// A: istemci gibi sabit adım (kare süresi 0,05 sn ile, birikim 0,1 sn ile sınırlı)
let qA = 0, acc = 0, last = now(), relT = 0;
const interpB = (rt) => {
  const S = st.A.snaps; if (!S.length) return null;
  let a = S[0], b = S[0];
  for (let i = 0; i < S.length; i++) { if (S[i].k <= rt) { a = S[i]; b = S[Math.min(i + 1, S.length - 1)]; } else break; }
  const t = b.k > a.k ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
  const pa = a.s.find((p) => p.i === st.B.id), pb = b.s.find((p) => p.i === st.B.id) || pa;
  return pa && { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, z: pa.z + (pb.z - pa.z) * t };
};
const stepA = () => {
  const a = st.A, me = a.me?.now; if (!me || a.off === null) return;
  const rt = ((now() - a.off) / 1000) * HZ - 6;
  const tb = interpB(rt); if (!tb) return;
  const ex = me.x, ey = me.y + 1.62, ez = me.z, dx = tb.x - ex, dy = tb.y + 1.05 - ey, dz = tb.z - ez;
  const yw = Math.atan2(-dx, -dz), pt = Math.atan2(dy, Math.hypot(dx, dz));
  const T = el(), ph = T % 0.9, held = ph < 0.6;                                    // bas 0,6 sn, bırak 0,3 sn
  const pistol = T % 7 > 6.2;                                                        // 7 sn'de bir kısa tabanca
  const mag = a.me.am?.[0]?.[0] ?? 30, rl = !pistol && mag === 0 && T - relT > 1 ? (relT = T, 1) : 0;
  A.send({ t: 'in', q: ++qA, f: 0, r: 0, l: 0, s: 0, j: 0, a: 1, w: pistol ? 1 : 0, yw: +yw.toFixed(4), pt: +pt.toFixed(4), c: 0, p: 0, u: 0,
    fh: held ? 1 : 0, fp: held && ph < DT * 1.5 ? 1 : 0, rl, fm: 0, o: 0, ab: 0, vt: +rt.toFixed(2) });
};
const ivA = setInterval(() => {
  const t = now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
  acc = Math.min(acc + dt, 0.1);
  while (acc >= DT) { acc -= DT; stepA(); }
}, 4);

// zaman çizelgesi
const rows = [];
const STALLS = [10, 16];                                                            // iki kez takılma (dalgalı hatta art arda gelir)
let stalled = 0, killed = false;
const RUN = 36;
for (let w = 2; w <= RUN; w += 2) {
  await wait(2000 - ((now() - T0) % 2000) + 5);
  if (stalled < STALLS.length && el() >= STALLS[stalled]) { stalled++; A.stallUntil = now() + STALL; console.log(`   ${el().toFixed(1)} sn: A'nın yukarı bağlantısı ${STALL} ms takıldı`); }
  if (!killed && el() >= 26) { killed = true; A.send({ t: 'dbg', kill: 1 }); console.log(`   ${el().toFixed(1)} sn: A öldü (yeniden doğacak)`); setTimeout(place, 5600); }
  A.send({ t: 'dbg', ask: 1 }); await wait(250);
  const d = dbgA || {};
  const r = { t: Math.round(el()), sh: win.sh, hm: win.hm, rate: win.sh ? win.hm / win.sh : 0, q: d.q, bu: d.bu, lagT: d.lagT, sv: d.sv };
  rows.push(r); win.sh = 0; win.hm = 0;
  console.log(`t=${String(r.t).padStart(2)} sn  atış ${String(r.sh).padStart(3)}  isabet ${String(r.hm).padStart(3)}  oran ${(r.rate * 100).toFixed(0).padStart(3)}%   sunucu kuyruğu ${String(r.q).padStart(2)} girdi (${((r.q || 0) / HZ * 1000).toFixed(0)} ms)  bütçe ${r.bu}  atlanan ${d.drop ?? '-'}  ${d.lagT != null ? 'görüş farkı ' + d.lagT + ' adım' : ''}  ${JSON.stringify(r.sv)}`);
}
clearInterval(ivA); clearInterval(ivB); clearInterval(ivHp);
const avg = (a) => { const sh = a.reduce((s, r) => s + r.sh, 0), hm = a.reduce((s, r) => s + r.hm, 0); return sh ? hm / sh : 0; };
const before = avg(rows.filter((r) => r.t > 3 && r.t <= 10)), after = avg(rows.filter((r) => r.t > 20 && r.t <= 26)), reborn = avg(rows.filter((r) => r.t > 34));
const qMax = Math.max(...rows.filter((r) => r.t > 20 && r.t <= 26).map((r) => r.q || 0));
console.log(`\nisabet oranı: takılmadan önce ${(before * 100).toFixed(0)}% · takılmadan sonra (ölmeden) ${(after * 100).toFixed(0)}% · yeniden doğunca ${(reborn * 100).toFixed(0)}% · takılma sonrası kuyruk en çok ${qMax} girdi`);
const ok = before > 0.5 && after > before * 0.7 && qMax <= 6;
console.log(ok ? 'sonuç: OK (takılma kalıcı gecikme / isabetsizlik bırakmadı)' : 'sonuç: HATA (takılmadan sonra girdi kuyruğu birikti, isabet ölene kadar düştü)');
wsA.close(); wsB.close();
process.exit(ok ? 0 : 1);
