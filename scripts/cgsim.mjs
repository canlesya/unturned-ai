// Çöl Geçidi bot simülasyonu: kazanan dağılımı, ölüm sayısı, takılma (hareketsiz bot) sayacı.  node scripts/cgsim.mjs [tür=tdm|conquest] [kişi=5] [maç=6] [zor=normal|hard|easy]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
const [type = 'tdm', per = 5, N = 6, diff = 'normal'] = process.argv.slice(2).map((v, i) => (i === 0 || i === 3 ? v : +v));
const res = [];
for (let n = 0; n < N; n++) {
  const g = new Game(null, { headless: true, map: process.env.MAP || 'colgecidi', tod: 'day', weather: 'clear', diff, match: { perTeam: per, type, time: 300 } });
  const last = new Map(), still = new Map();
  let kills = { blue: 0, red: 0 };
  for (let i = 0; i < 300 * 30 && !g.ended; i++) {
    g.step(1 / 30);
    if (i % 30 === 0) for (const s of g.soldiers) {
      if (!s.alive || s.isPlayer) continue;
      const p = last.get(s.id);
      if (p && Math.hypot(s.pos.x - p[0], s.pos.z - p[1]) < 0.6) still.set(s.id, (still.get(s.id) || 0) + 1); else still.set(s.id, 0);
      last.set(s.id, [s.pos.x, s.pos.z]);
      if ((still.get(s.id) || 0) === 20) (g._stuck ||= []).push(`${s.name}@(${s.pos.x.toFixed(0)},${s.pos.z.toFixed(0)})`);
    }
  }
  for (const s of g.soldiers) if (s.team) kills[s.team] += s.kills || 0;
  res.push({ w: g.winner, t: Math.round(g.time), kb: kills.blue, kr: kills.red, tk: g.tickets ? `${Math.round(g.tickets.blue)}/${Math.round(g.tickets.red)}` : '', stuck: g._stuck || [] });
  g.dispose?.();
}
const wins = (t) => res.filter((r) => r.w === t).length;
console.log(`${type} ${per}v${per} ${diff}: mavi(T) ${wins('blue')} · kırmızı(CT) ${wins('red')} · berabere ${res.filter((r) => !r.w).length} | ort. süre ${Math.round(res.reduce((a, r) => a + r.t, 0) / N)} sn | ort. öldürme M${(res.reduce((a, r) => a + r.kb, 0) / N).toFixed(1)} K${(res.reduce((a, r) => a + r.kr, 0) / N).toFixed(1)}`);
console.log('takılan bot (20 sn hareketsiz):', res.flatMap((r) => r.stuck).slice(0, 12).join(' ') || 'yok', '· toplam', res.reduce((a, r) => a + r.stuck.length, 0));
process.exit(0);
