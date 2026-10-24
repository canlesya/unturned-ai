// Vagon modu bot davranışı ölçümü (başsız, tarayıcı yok):  node scripts/plbots.mjs [maç=6] [NvN=6] [zorluk=normal] [harita=maden]
// Her maç sonuna kadar (ya da 1200 sn) oynatılır. Ölçülenler: vagon ilerlemesi zamana göre, vagon durum süreleri (it / çekişme / geri / durdurma / boş),
// saldıranların itme yarıçapında / 8 m içinde geçirdiği bot-saniye oranı, savunanların yarıçapta / vagonun önünde (ray üzerinde ileride) / 40 m'den uzak oranı,
// öldürmelerin vagona uzaklık dağılımı, sonuç + süre. Harita koordinatı sabitlenmez: her şey g.payload'dan (track.at / nearest, d, cps) okunur.
// JSON=1 → son satırda özet JSON.
import { Game } from '../src/game/game.js';
import { TUNE } from '../src/game/balance.js';
import { PL_BOT } from '../src/game/payloadBots.js';

const N = +(process.argv[2] || 6), per = +(process.argv[3] || 6), diff = process.argv[4] || 'normal', map = process.argv[5] || 'maden';
const MAX = +(process.env.MAX || 1200), dt = 1 / 30;
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('TUNE_') && k.slice(5) in TUNE) TUNE[k.slice(5)] = +v;      // deneme: TUNE_plAtkRespawn=1 …
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('PLB_') && k.slice(4) in PL_BOT) PL_BOT[k.slice(4)] = +v;    // deneme: PLB_atkEscort=0.5 …
const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + '%' : '-');
const all = [];
for (let mi = 0; mi < N; mi++) {
  const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff, match: { perTeam: per, type: 'payload' } });
  const P = g.payload;
  if (!P) { console.log('payload yok'); process.exit(1); }
  const R = TUNE.plRadius;
  const m = { st: { idle: 0, push: 0, contest: 0, back: 0, block: 0 }, aAlive: 0, aIn: 0, a8: 0, a15: 0, aSet: 0, aSetIn: 0, aSet8: 0, aFar: 0, dAlive: 0, dIn: 0, dAhead: 0, dFar: 0, dNear15: 0, kills: [0, 0, 0, 0], kA: 0, kD: 0, prog: [], cpT: [] };
  const origKill = g.onKill.bind(g);
  g.onKill = (k, v, w, hs) => { const d = P.distTo(v); m.kills[d < 5 ? 0 : d < 15 ? 1 : d < 30 ? 2 : 3]++; if (k && k.team !== v.team) { if (k.team === 'blue') m.kA++; else m.kD++; } return origKill(k, v, w, hs); };
  let t = 0, acc = 0, lastReached = 0;
  for (let i = 0; i < MAX * 30 && !g.ended; i++) {
    g.step(dt); t += dt; acc += dt;
    if (P.reached > lastReached) { lastReached = P.reached; m.cpT.push(Math.round(t)); }
    if (acc >= 0.5) {                                                    // yarım saniyede bir örnek
      acc -= 0.5;
      m.st[P.state] += 0.5;
      for (const s of g.soldiers) {
        if (!s.alive) { s._lt = 0; continue; }
        s._lt = (s._lt || 0) + 0.5;                                    // doğalı kaç sn (yerleşmiş = 10 sn+: doğuştan vagona yürüme hariç)
        const d = P.distTo(s);
        if (s.team === 'blue') { m.aAlive++; if (d <= R) m.aIn++; if (d <= 8) m.a8++; if (d <= 15) m.a15++; if (d > 40) m.aFar++; if (s._lt >= 10) { m.aSet++; if (d <= R) m.aSetIn++; if (d <= 8) m.aSet8++; } }
        else { m.dAlive++; if (d <= R) m.dIn++; if (d <= 15) m.dNear15++; if (d > 40) m.dFar++; const n = P.track.nearest(s.pos.x, s.pos.z); if (n.dist < 12 && n.d > P.d + 1 && n.d < P.d + 45) m.dAhead++; }
      }
      if (Math.abs(t % 30) < 0.26 || Math.abs(t % 30 - 30) < 0.26) m.prog.push(Math.round(P.progress * 100));
    }
  }
  m.t = Math.round(t); m.win = g.ended ? g.winner : '-'; m.pct = Math.round(P.progress * 100); m.cps = P.reached;
  m.kTot = m.kills.reduce((a, b) => a + b, 0);
  all.push(m);
  console.log(`maç ${mi + 1}: ${m.win === 'blue' ? 'SALDIRAN' : m.win === 'red' ? 'SAVUNAN' : 'bitmedi'} · ${m.t} sn · ilerleme %${m.pct} · kontrol ${m.cps} (${m.cpT.join(', ')} sn) · ilerleme/30sn ${m.prog.join(' ')}`);
  console.log(`   durum sn: it ${m.st.push} · çekişme ${m.st.contest} · geri ${m.st.back} · durdurma ${m.st.block} · boş ${m.st.idle}`);
  console.log(`   saldıran: yarıçapta ${pct(m.aIn, m.aAlive)} · 8 m içi ${pct(m.a8, m.aAlive)} · 15 m içi ${pct(m.a15, m.aAlive)} · 40 m+ ${pct(m.aFar, m.aAlive)} · (10 sn+ yaşayan: yarıçapta ${pct(m.aSetIn, m.aSet)} · 8 m ${pct(m.aSet8, m.aSet)})   savunan: yarıçapta ${pct(m.dIn, m.dAlive)} · 15 m içi ${pct(m.dNear15, m.dAlive)} · rayda önde ${pct(m.dAhead, m.dAlive)} · 40 m+ ${pct(m.dFar, m.dAlive)}`);
  console.log(`   öldürme ${m.kTot} (saldıran ${m.kA} / savunan ${m.kD}): vagona <5 m ${pct(m.kills[0], m.kTot)} · 5–15 ${pct(m.kills[1], m.kTot)} · 15–30 ${pct(m.kills[2], m.kTot)} · 30+ ${pct(m.kills[3], m.kTot)}`);
}
const S = (f) => all.reduce((a, m) => a + f(m), 0);
const st = S((m) => m.st.push + m.st.contest + m.st.back + m.st.block + m.st.idle);
const sum = {
  matches: N, per, diff, atkWins: all.filter((m) => m.win === 'blue').length, defWins: all.filter((m) => m.win === 'red').length, unfinished: all.filter((m) => m.win === '-').length,
  avgT: Math.round(S((m) => m.t) / N), avgPct: Math.round(S((m) => m.pct) / N), avgCps: +(S((m) => m.cps) / N).toFixed(1),
  push: pct(S((m) => m.st.push), st), contest: pct(S((m) => m.st.contest), st), back: pct(S((m) => m.st.back), st), block: pct(S((m) => m.st.block), st), idle: pct(S((m) => m.st.idle), st),
  aIn: pct(S((m) => m.aIn), S((m) => m.aAlive)), a8: pct(S((m) => m.a8), S((m) => m.aAlive)), a15: pct(S((m) => m.a15), S((m) => m.aAlive)), aSetIn: pct(S((m) => m.aSetIn), S((m) => m.aSet)), aSet8: pct(S((m) => m.aSet8), S((m) => m.aSet)), aFar: pct(S((m) => m.aFar), S((m) => m.aAlive)),
  dIn: pct(S((m) => m.dIn), S((m) => m.dAlive)), d15: pct(S((m) => m.dNear15), S((m) => m.dAlive)), dAhead: pct(S((m) => m.dAhead), S((m) => m.dAlive)), dFar: pct(S((m) => m.dFar), S((m) => m.dAlive)),
  kills: Math.round(S((m) => m.kTot) / N), kA: Math.round(S((m) => m.kA) / N), kD: Math.round(S((m) => m.kD) / N), k5: pct(S((m) => m.kills[0]), S((m) => m.kTot)), k15: pct(S((m) => m.kills[1]), S((m) => m.kTot)), k30: pct(S((m) => m.kills[2]), S((m) => m.kTot)), kFar: pct(S((m) => m.kills[3]), S((m) => m.kTot)),
};
console.log(`\nÖZET ${N} maç ${per}v${per} ${diff}: saldıran ${sum.atkWins} · savunan ${sum.defWins} · bitmeyen ${sum.unfinished} · ort. ${sum.avgT} sn · ilerleme %${sum.avgPct} · kontrol ${sum.avgCps}`);
console.log(`  vagon durumu: it ${sum.push} · çekişme ${sum.contest} · geri ${sum.back} · durdurma ${sum.block} · boş ${sum.idle}`);
console.log(`  saldıran: yarıçapta ${sum.aIn} · 8 m içi ${sum.a8} · 15 m içi ${sum.a15} · 40 m+ ${sum.aFar} · (10 sn+ yaşayan: yarıçapta ${sum.aSetIn} · 8 m ${sum.aSet8})   savunan: yarıçapta ${sum.dIn} · 15 m içi ${sum.d15} · rayda önde ${sum.dAhead} · 40 m+ ${sum.dFar}`);
console.log(`  öldürme/maç ${sum.kills} (saldıran ${sum.kA} / savunan ${sum.kD}): vagona <5 m ${sum.k5} · 5–15 ${sum.k15} · 15–30 ${sum.k30} · 30+ ${sum.kFar}`);
if (process.env.JSON) console.log(JSON.stringify(sum));
