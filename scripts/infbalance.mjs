// Enfekte dengesi: çok sayıda headless maç, kazanan / süre. node scripts/infbalance.mjs [toplam=12] [maç=8]   (denge değerleri: stats.js → ZOMBIE, ZTYPES)
import { Game } from '../src/game/game.js';
import { ZOMBIE, BOSS, ZBOSS } from '../src/game/stats.js';
// ortam değişkenleriyle deneme: BHP (boss can) BPP (oyuncu başı can) BSPD (boss hızı) BDMG (boss hasarı) BLIVES
if (process.env.BHP) BOSS.hp = +process.env.BHP; if (process.env.BPP) BOSS.hpPerPlayer = +process.env.BPP; if (process.env.BSPD) ZBOSS.speed = +process.env.BSPD; if (process.env.BDMG) ZBOSS.dmg = +process.env.BDMG; if (process.env.BLIVES) BOSS.lives = +process.env.BLIVES;
const [total = 12, N = 8] = process.argv.slice(2).map(Number);
const res = [], types = {};
for (let n = 0; n < N; n++) {
  let cures = 0;
  const g = new Game(null, { headless: true, map: process.env.MAP || 'kasaba', tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: total, type: 'inf', time: 300 } });
  g.on('cure', () => cures++);
  for (let i = 0; i < 300 * 30 && !g.ended; i++) g.step(1 / 30);
  const c = g.infCounts();
  res.push({ w: g.winner, t: Math.round(g.time), h: c.h, cure: cures });
  for (const s of g.soldiers) if (s.def.zombie) types[s.ztype] = (types[s.ztype] || 0) + 1;
}
const humansWin = res.filter((r) => r.w === 'blue').length;
console.log(`oran 1/${ZOMBIE.ratio} yeniden doğma ${ZOMBIE.respawn} sn | insan kazandı ${humansWin}/${N} · ortalama süre ${Math.round(res.reduce((a, r) => a + r.t, 0) / N)} sn · kalan insan ort ${(res.reduce((a, r) => a + r.h, 0) / N).toFixed(1)} · iyileşen ort ${(res.reduce((a, r) => a + r.cure, 0) / N).toFixed(1)} · boss can ${BOSS.hp}+${BOSS.hpPerPlayer}/oyuncu hız ${ZBOSS.speed} hasar ${ZBOSS.dmg}`);
