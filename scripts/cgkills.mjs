// Çöl Geçidi: ölümler nerede oluyor? (taraf avantajı teşhisi)  node scripts/cgkills.mjs [maç=4] [kişi=8]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
const N = +process.argv[2] || 4, per = +process.argv[3] || 8;
const grid = {}; const H = { T: [], CT: [] }; let spawnKills = { T: 0, CT: 0 };
for (let n = 0; n < N; n++) {
  const g = new Game(null, { headless: true, swapSides: false, map: 'colgecidi', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'tdm', time: 300 } });
  const side = (t) => (t === 'blue' ? 'T' : 'CT');
  const orig = g.onKill.bind(g);
  g.onKill = (killer, victim, ...a) => {
    if (killer && victim) {
      const own = g.map.spawns[victim.team][0], d = Math.hypot(victim.pos.x - own.x, victim.pos.z - own.z);
      H[side(victim.team)].push([victim.pos.x, victim.pos.z, Math.hypot(killer.pos.x - victim.pos.x, killer.pos.z - victim.pos.z), d]);
      if (d < 22) spawnKills[side(killer.team)]++;
    }
    return orig(killer, victim, ...a);
  };
  for (let i = 0; i < 300 * 30 && !g.ended; i++) g.step(1 / 30);
}
const avg = (a) => (a.reduce((s, v) => s + v, 0) / (a.length || 1)).toFixed(1);
for (const k of ['T', 'CT']) console.log(k, 'ölüm', H[k].length, '· ort. mesafe katil→kurban', avg(H[k].map((e) => e[2])), 'm · kendi doğuşuna ort. uzaklık', avg(H[k].map((e) => e[3])), 'm · doğuşa <22 m ölüm', H[k].filter((e) => e[3] < 22).length);
// ölüm yoğunluğu (10 m kutular, x: T→CT)
for (const k of ['T', 'CT']) {
  const b = {}; for (const e of H[k]) { const key = Math.floor(e[0] / 20) * 20 + ',' + Math.floor(e[1] / 20) * 20; b[key] = (b[key] || 0) + 1; }
  console.log(k, 'ölüm yoğunluğu', Object.entries(b).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([p, v]) => `(${p}):${v}`).join(' '));
}
process.exit(0);
