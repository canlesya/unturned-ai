// Enfekte dengesi: çok sayıda headless maç, ortalama süre / kazanan. node scripts/infbalance.mjs [toplam=12] [maç=8] [hp] [hız] [hasar] [alfaHp]
import { Game } from '../src/game/game.js';
import { ZOMBIE } from '../src/game/stats.js';
const [total = 12, N = 8, hp, spd, dmg, ahp] = process.argv.slice(2).map(Number);
import { WSTATS, CLASS_DEFS } from '../src/game/stats.js';
if (process.env.ZR) ZOMBIE.respawn = +process.env.ZR;
if (hp) ZOMBIE.hp = hp; if (spd) { ZOMBIE.speed = spd; CLASS_DEFS.zombie.speed = spd; } if (dmg) { ZOMBIE.dmg = dmg; WSTATS.claws.dmg = dmg; } if (ahp) ZOMBIE.alphaHp = ahp;
const res = [];
for (let n = 0; n < N; n++) {
  const g = new Game(null, { headless: true, map: process.env.MAP || 'kasaba', tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: total, type: 'inf', time: 300 } });
  for (let i = 0; i < 300 * 30 && !g.ended; i++) g.step(1 / 30);
  const c = g.infCounts();
  res.push({ w: g.winner, t: Math.round(g.time), h: c.h });
}
const humansWin = res.filter((r) => r.w === 'blue').length;
console.log(`hp ${ZOMBIE.hp} hız ${ZOMBIE.speed} hasar ${ZOMBIE.dmg} alfa ${ZOMBIE.alphaHp} | insan kazandı ${humansWin}/${N} · ortalama süre ${Math.round(res.reduce((a, r) => a + r.t, 0) / N)} sn · kalan insan ort ${(res.reduce((a, r) => a + r.h, 0) / N).toFixed(1)}`);
