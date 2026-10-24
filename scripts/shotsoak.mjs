// Karışık eylem + dalgalı ağ dayanıklılık testi (12.138): sunucuda "takılı kalan" bir atış engeli var mı?
// node scripts/shotsoak.mjs [ws=ws://127.0.0.1:8787] [sınıf=assault|medic] [saniye=90] [tek yön taban ms=40] [dalga ms=40]   (sunucu BF_DEBUG=1)
// 9 sn'lik döngü: 6 sn KARGAŞA (koşu, zıplama, nişan, rastgele silah değiştirme 0-3, seri / tek atış, şarjör, bıçak, el bombası /
// ilk yardım, yatma / çömelme; arada 0,2–1,4 sn yukarı bağlantı takılması) + 3 sn ÖLÇÜM (A noktaya ışınlanır, tüfekle 12 m'de koşan B'ye ateş).
// Her ölçümde: isabet oranı + sunucudaki atıcı durumu (dbg ask: cur, mag, reserve, cd, reloadT, switchT, useT, swing, prot, kuyruk).
// HATA: canlı A'nın ölçümde hiç atışı işlenmiyorsa ya da isabet < %50 ise (kalıcı engel).
import WebSocket from 'ws';
const URL = process.argv[2] || 'ws://127.0.0.1:8787', CLS = process.argv[3] || 'assault', SECS = +(process.argv[4] || 90);
const LAT = +(process.argv[5] ?? 40), JIT = +(process.argv[6] ?? 40);
const HZ = 60, DT = 1 / HZ, SPOT = { ax: -25.38, z: 61.94, bx: -13.38 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = performance.now(), now = () => performance.now(), el = () => (now() - T0) / 1000;
const rnd = (a, b) => a + Math.random() * (b - a);

function link(ws, lag) {
  const L = { up: 0, down: 0, stallUntil: 0, onmsg: null };
  const d = () => (lag ? LAT + Math.random() * JIT + (Math.random() < 0.01 ? rnd(80, 250) : 0) : 0);     // ara sıra tek paket gecikmesi
  L.send = (o) => { const s = JSON.stringify(o), at = Math.max(now() + d(), L.up + 0.01, L.stallUntil); L.up = at; setTimeout(() => ws.readyState === 1 && ws.send(s), at - now()); };
  ws.on('message', (raw) => { const m = JSON.parse(raw), at = Math.max(now() + d(), L.down + 0.01); L.down = at; setTimeout(() => L.onmsg && L.onmsg(m), at - now()); });
  return L;
}
const open = () => new Promise((res, rej) => { const ws = new WebSocket(URL); ws.on('open', () => res(ws)); ws.on('error', rej); });
const wsA = await open(), wsB = await open();
const A = link(wsA, true), B = link(wsB, false);
const st = { snaps: [], off: null, me: null, id: -1, bid: -1, bme: null };
let room = null, dbg = null;
const win = { sh: 0, hm: 0 };
A.onmsg = (m) => {
  if (m.t === 'welcome') { st.id = m.id; room = m.room; }
  if (m.t === 'snap') {
    const cand = now() - (m.k / HZ) * 1000;
    st.off = st.off === null ? cand : cand < st.off ? cand : st.off + (cand - st.off) * 0.02;
    st.snaps.push({ k: m.k, s: m.s }); if (st.snaps.length > 30) st.snaps.shift();
    st.me = m.me;
  }
  if (m.t === 'ev') for (const e of m.l) { if (e.e === 'sh' && e.by === st.id && e.m) win.sh++; if (e.e === 'hm' && e.by === st.id) win.hm++; }
  if (m.t === 'dbg') dbg = m;
};
B.onmsg = (m) => { if (m.t === 'welcome') st.bid = m.id; if (m.t === 'snap') st.bme = m.me; };
A.send({ t: 'create', name: 'Atici', cls: CLS, cfg: { type: 'dm', map: 'colgecidi', perTeam: 4, bots: false } });
while (!room) await wait(20);
B.send({ t: 'join', room, name: 'Hedef' });
while (st.bid < 0 || !st.me || !st.bme) await wait(20);
const place = () => { A.send({ t: 'dbg', tp: [SPOT.ax, SPOT.z] }); B.send({ t: 'dbg', tp: [SPOT.bx, SPOT.z], hp: 1e6 }); };
place(); await wait(600);

let qB = 0, dirB = 1;
const ivB = setInterval(() => {
  const z = st.bme?.now?.z ?? SPOT.z;
  if (z < SPOT.z - 3.5) dirB = -1; else if (z > SPOT.z + 3.5) dirB = 1;
  B.send({ t: 'in', q: ++qB, f: 0, r: dirB, l: 0, s: 0, j: 0, a: 0, w: 0, yw: Math.PI / 2, pt: 0, vt: 0 });
}, 1000 / HZ);
const ivHp = setInterval(() => B.send({ t: 'dbg', hp: 1e6 }), 400);

const interpB = (rt) => {
  const S = st.snaps; if (!S.length) return null;
  let a = S[0], b = S[0];
  for (let i = 0; i < S.length; i++) { if (S[i].k <= rt) { a = S[i]; b = S[Math.min(i + 1, S.length - 1)]; } else break; }
  const t = b.k > a.k ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
  const pa = a.s.find((p) => p.i === st.bid), pb = b.s.find((p) => p.i === st.bid) || pa;
  return pa && { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, z: pa.z + (pb.z - pa.z) * t };
};
// kargaşa durumu
const C = { w: 0, f: 0, r: 0, s: 0, j: 0, a: 0, fh: 0, yw: 0, pt: 0, until: 0 };
let probe = false, probeAt = 0, probeFix = 0, fixK = -1, qA = 0, acc = 0, last = now(), relT = 0, nextStall = 3;
const stepA = () => {
  const me = st.me?.now; if (!me || st.off === null) return;
  const rt = ((now() - st.off) / 1000) * HZ - 6, T = el();
  const e = { c: 0, p: 0, u: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0 };
  let inp;
  if (probe) {
    const tb = interpB(rt); if (!tb) return;
    const dx = tb.x - me.x, dy = tb.y + 1.05 - (me.y + 1.62), dz = tb.z - me.z;
    const ph = T % 0.9, held = ph < 0.6, mag = st.me.am?.[0]?.[0] ?? 30;
    if (mag === 0 && T - relT > 1) { relT = T; e.rl = 1; }
    if (held && ph < DT * 1.5) e.fp = 1;
    if (T < probeFix) { const k = Math.floor((T - probeAt) / 0.25); if (k !== fixK) { fixK = k; if (dbg?.sv?.st !== 's') e.u = 1; if (dbg?.sv?.fm && dbg.sv.fm !== 'auto') e.fm = 1; A.send({ t: 'dbg', ask: 1 }); } }   // ölçüm başı: ayağa kalk, tam otomatiğe dön
    inp = { f: 0, r: 0, s: 0, j: 0, a: 1, w: 0, yw: Math.atan2(-dx, -dz), pt: Math.atan2(dy, Math.hypot(dx, dz)), fh: held ? 1 : 0 };
  } else {
    if (T > C.until) {                                                       // yeni rastgele eylem (0,2–0,9 sn)
      C.until = T + rnd(0.2, 0.9);
      C.f = Math.random() < 0.6 ? 1 : Math.random() < 0.5 ? -1 : 0; C.r = Math.round(rnd(-1.4, 1.4)); C.s = Math.random() < 0.4 ? 1 : 0;
      C.a = Math.random() < 0.4 ? 1 : 0; C.fh = Math.random() < 0.5 ? 1 : 0; C.yw = rnd(-Math.PI, Math.PI); C.pt = rnd(-0.3, 0.2);
      if (Math.random() < 0.45) { C.w = [0, 0, 1, 2, 3][Math.floor(Math.random() * 5)]; }
      if (Math.random() < 0.3) e.rl = 1;
      if (Math.random() < 0.15) e.c = 1; else if (Math.random() < 0.08) e.p = 1; else if (Math.random() < 0.1) e.u = 1;
      if (Math.random() < 0.3) e.fp = 1;
      if (Math.random() < 0.06) e.fm = 1;
      if (CLS === 'medic' && Math.random() < 0.2) A.send({ t: 'dbg', hp: 40 });     // ilk yardım kullanılabilsin
    }
    C.j = Math.random() < 0.02 ? 1 : 0;
    inp = { f: C.f, r: C.r, s: C.s, j: C.j, a: C.a, w: C.w, yw: C.yw, pt: C.pt, fh: C.fh };
  }
  A.send({ t: 'in', q: ++qA, l: 0, ...inp, yw: +inp.yw.toFixed(4), pt: +inp.pt.toFixed(4), ...e, vt: +rt.toFixed(2) });
};
const ivA = setInterval(() => {
  const t = now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
  acc = Math.min(acc + dt, 0.1);
  while (acc >= DT) { acc -= DT; stepA(); }
  if (!probe && el() > nextStall) { const ms = rnd(200, 1400); A.stallUntil = now() + ms; nextStall = el() + rnd(2, 6); }
}, 4);

let bad = 0, probes = 0, stuck = [];
for (let cyc = 0; cyc * 9 + 9 <= SECS; cyc++) {
  probe = false; await wait(6000);
  // ölçüm: kargaşa biter, (takılma yok) A noktaya döner
  probe = true; C.w = 0; probeAt = el(); probeFix = probeAt + 0.9; dbg = null;
  place(); A.send({ t: 'dbg', hp: 100 }); await wait(1000);
  win.sh = 0; win.hm = 0;
  await wait(2000);
  A.send({ t: 'dbg', ask: 1 }); await wait(200);
  const d = dbg || {}, alive = d.sv?.alive !== false, rate = win.sh ? win.hm / win.sh : 0;
  probes++;
  const fail = alive && (win.sh === 0 || rate < 0.5);
  if (fail) { bad++; stuck.push(d); }
  console.log(`${fail ? 'HATA ' : 'ok   '} t=${el().toFixed(0).padStart(3)} sn  atış ${String(win.sh).padStart(2)}  isabet ${String(win.hm).padStart(2)}  oran ${(rate * 100).toFixed(0).padStart(3)}%  kuyruk ${d.q} atlanan ${d.drop}  görüş farkı ${d.lagT}  ${JSON.stringify(d.sv)}`);
}
clearInterval(ivA); clearInterval(ivB); clearInterval(ivHp);
console.log(`\n${probes} ölçüm, ${bad} kalıcı engel şüphesi`);
console.log(bad ? 'sonuç: HATA' : 'sonuç: OK');
wsA.close(); wsB.close();
process.exit(bad ? 1 : 0);
