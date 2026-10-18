// Vagon modu hızlı benzetim (geliştirme): node scripts/plquick.mjs [takım başına=5] [zorluk=normal] [tekrar=1]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
const per = +(process.argv[2] || 5), diff = process.argv[3] || 'normal', reps = +(process.argv[4] || 1);
for (let r = 0; r < reps; r++) {
  const g = new Game(null, { headless: true, map: 'maden', tod: 'day', weather: 'clear', diff, match: { perTeam: per, type: 'payload' } });
  const pl = g.payload, st = {}, dg = { n: 0, ad: 0, dd: 0, comb: 0, push: 0, alive: 0 };
  if (!r) console.log('ray', pl.track.len.toFixed(1), 'm · kontrol', pl.cps.map((v) => v.toFixed(1)).join(' / '), '· süre', g.timeLeft);
  const t0 = performance.now();
  let i = 0;
  for (; i < 30 * 1200 && !g.ended; i++) { g.step(1 / 30); st[pl.state] = (st[pl.state] || 0) + 1;
    if (process.env.DIAG && i % 15 === 0) { for (const s of g.soldiers) { if (!s.alive) continue; dg.alive++; const d = pl.distTo(s); if (s.team === 'blue') { dg.ad += d; dg.n++; if (s.brain?.target) dg.comb++; if (s.brain?.plPush) dg.push++; } else dg.dd += d; } } if (reps === 1 && i % (30 * 30) === 0) console.log(String(Math.round(g.time)).padStart(4), 'sn · d', pl.d.toFixed(1).padStart(5), pl.state.padEnd(7), 'kalan', Math.round(g.timeLeft), '· öldürme', g.soldiers.reduce((a, s) => a + s.kills, 0)); }
  if (process.env.DIAG) console.log('saldıran ort. vagon uzaklığı', (dg.ad / dg.n).toFixed(1), 'm · savunan', (dg.dd / (dg.alive - dg.n)).toFixed(1), 'm · saldıran çatışmada %', Math.round(dg.comb / dg.n * 100), '· itme görevli %', Math.round(dg.push / dg.n * 100), '· canlı oranı %', Math.round(dg.alive / (Math.floor(i / 15) + 1) / g.soldiers.length * 100));
  const tot = Object.values(st).reduce((a, b) => a + b, 0);
  console.log(`#${r} ${g.winner} · ${g.endReason} · ${g.time.toFixed(0)} sn · d ${pl.d.toFixed(1)} · nokta ${pl.reached} · öldürme ${g.soldiers.reduce((a, s) => a + s.kills, 0)} · durum ${Object.entries(st).map(([k, v]) => k + ' %' + Math.round(v / tot * 100)).join(' ')} · ${((performance.now() - t0) / i).toFixed(2)} ms/adım`);
}
