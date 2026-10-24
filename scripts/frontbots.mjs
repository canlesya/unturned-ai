// Cephe modu bot maçları (başsız, tam maç):  node scripts/frontbots.mjs [maç=10] [NvN=12] [zorluk=normal] [süre sn=1200]
// Çıktı: kazanan dağılımı, düşen sektör sayısı, maç süresi, bilet, öldürme (takım), savunanın mevzide / ayakta oranı, saldıranın noktaya yakınlığı,
// takılma (5 sn'de 0,5 m'den az ilerleyen hedefli bot), ölümlerin hedefe uzaklığı. TUNE_x= / LIM_x= ortam değişkeniyle deneme (ör. TUNE_frBonus=0.6).
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
import { TUNE, LIMITS } from '../src/game/balance.js';
MapBuilder.noVisual = true;
for (const [k, v] of Object.entries(process.env)) { if (k.startsWith('TUNE_')) TUNE[k.slice(5)] = +v; if (k.startsWith('LIM_')) LIMITS[k.slice(4)] = +v; }
const N = +(process.argv[2] || 10), PT = +(process.argv[3] || 12), DIFF = process.argv[4] || 'normal', TL = +(process.argv[5] || 1200);
const res = [], STK = new Map(), HEAT = new Map(), SEC = +(process.env.SEC ?? -1);
const t0 = performance.now();
for (let m = 0; m < N; m++) {
  const g = new Game(null, { headless: true, map: 'cephe', diff: DIFF, match: { perTeam: PT, type: 'front', time: TL } });
  const st = { post: 0, postUp: 0, def: 0, atkNear: 0, atk: 0, stuck: 0, botT: 0, kills: { blue: 0, red: 0 }, deathD: [], secT: [] };
  const last = new Map();
  g.on?.('kill', () => {});
  const origKill = g.onKill.bind(g);
  g.onKill = (k, v, w, hs) => {
    if (k && k !== v) st.kills[k.team]++;
    const act = g.front.active();
    if (v.team === 'blue' && act.length) st.deathD.push(Math.min(...act.map((o) => Math.hypot(o.x - v.pos.x, o.z - v.pos.z))));
    return origKill(k, v, w, hs);
  };
  let steps = 0, sec = 0;
  while (!g.ended && steps < (TL + 30) * 60) {
    g.step(1 / 60); steps++;
    if (g.front.sector !== sec) { sec = g.front.sector; st.secT.push(Math.round(g.time)); }
    if (steps % 60 === 0) {
      const act = g.front.active();
      for (const b of g.brains) {
        const s = b.s; if (!s.alive) continue;
        if (s.team === 'red') { st.def++; if (b.frAt && Math.hypot(b.frAt.x - s.pos.x, b.frAt.z - s.pos.z) < 1.5) { st.post++; if (!s.crouching) st.postUp++; } }
        else { st.atk++; if (act.some((o) => Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < o.r + 6)) st.atkNear++; if (g.front.sector === SEC) { const k = `${Math.round(s.pos.x / 10) * 10},${Math.round(s.pos.z / 10) * 10}`; HEAT.set(k, (HEAT.get(k) || 0) + 1); } }
        if (steps % 300 === 0 && b.goal) {
          const L = last.get(s);
          if (L && Math.hypot(L.x - s.pos.x, L.z - s.pos.z) < 0.5 && Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z) > 3 && !b.frAt && !b.target) { st.stuck++; const k = `${Math.round(s.pos.x / 4) * 4},${Math.round(s.pos.z / 4) * 4} ${s.team[0]} ${b.frRole}`; STK.set(k, (STK.get(k) || 0) + 1); }
          st.botT++;
          last.set(s, { x: s.pos.x, z: s.pos.z });
        }
      }
    }
  }
  const dd = st.deathD.sort((a, b) => a - b);
  res.push({ w: g.winner || '-', sec: g.front.sector, t: Math.round(g.time), tk: g.tickets.blue, k: st.kills, secT: st.secT, post: st.post / Math.max(1, st.def), up: st.postUp / Math.max(1, st.post), near: st.atkNear / Math.max(1, st.atk), stuck: st.stuck / Math.max(1, st.botT), dMed: dd[dd.length >> 1] || 0 });
  const r = res[res.length - 1];
  console.log(`maç ${m + 1}: ${r.w === 'blue' ? 'MAVİ' : r.w === 'red' ? 'KIRMIZI' : r.w} · sektör ${r.sec}/4 (${r.secT.join(', ')} sn) · ${r.t} sn · bilet ${r.tk} · öldürme M ${r.k.blue} K ${r.k.red} · mevzide %${(r.post * 100).toFixed(0)} (ayakta %${(r.up * 100).toFixed(0)}) · saldıran noktada %${(r.near * 100).toFixed(0)} · takılma %${(r.stuck * 100).toFixed(1)} · Mavi ölüm → nokta ${r.dMed.toFixed(0)} m`);
}
const bw = res.filter((r) => r.w === 'blue').length, avgSec = res.reduce((a, r) => a + r.sec, 0) / N;
const dist = [0, 1, 2, 3, 4].map((k) => res.filter((r) => r.sec === k).length);
console.log(`\nÖZET ${N} maç ${PT}v${PT} ${DIFF}: Mavi ${bw} / Kırmızı ${N - bw} (%${(bw / N * 100).toFixed(0)}) · ortalama sektör ${avgSec.toFixed(2)} · sektör dağılımı [0..4] ${dist.join(' ')} · ortalama süre ${(res.reduce((a, r) => a + r.t, 0) / N / 60).toFixed(1)} dk · gerçek ${(performance.now() - t0) / 1000 | 0} sn`);
console.log('takılma yerleri:', [...STK].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}×${v}`).join(' | '));
if (SEC >= 0) console.log(`sektör ${SEC + 1} saldıran yoğunluğu:`, [...HEAT].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}×${v}`).join(' | '));
