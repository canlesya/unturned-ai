// Kuzey Vadisi: botlar bina içine girebiliyor mu (12.184) — tarayıcısız. Her kapı için bir bot kapının 14 m önünden içerideki bir noktaya gönderilir;
// 45 sn içinde döşeme kotunda (kapı y ± 0,6 m) ve kapının en az 2 m içinde olursa "girdi".  node scripts/kuzeyhouse.mjs [kapı sayısı=60]
import { Game } from '../src/game/game.js';
const N = +(process.argv[2] || 60);
const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 2, type: 'conquest' } });
const doors = g.map.navDoors, nav = g.nav;
const bot = g.soldiers.find((s) => s.brain && s.team === 'red');
for (const s of g.soldiers) if (s !== bot) { s.alive = false; s.respawnT = 1e9; s.brain = null; }
g.brains = g.brains.filter((b) => b.s === bot);
g.timeLeft = 1e9;
const step = process.env.DOOR ? 1 : Math.max(1, Math.floor(doors.length / N));
let ok = 0, tried = 0; const fails = [];
for (let di = 0; di < doors.length && tried < N; di += step) {
  const d = doors[di], [ix, iz] = d.pts[0], [ox, oz] = d.pts[4], L = Math.hypot(ix - ox, iz - oz), nx = (ix - ox) / L, nz = (iz - oz) / L;
  // içerideki hedef: kapıdan 2,4 m içeri (kapalıysa 1,6 / 3,4 m ve yanları)
  let goal = null;
  for (const t of [2.4, 3.4, 1.8, 4.4]) for (const sd of [0, -1.6, 1.6]) { const x = ix + nx * t - nz * sd, z = iz + nz * t + nx * sd; if (!goal && nav.isFree(x, z)) goal = [x, z]; }
  if (!goal) goal = [ix + nx * 2.4, iz + nz * 2.4];
  const sx = ox - nx * 14, sz = oz - nz * 14, k = nav.nearestFree(sx, sz, 8);
  if (k < 0) continue;
  if (process.env.DOOR && `${ix.toFixed(0)},${iz.toFixed(0)}` !== process.env.DOOR) continue;
  tried++;
  bot.alive = true; bot.hp = 1e6; bot.pos.set(nav.cx(k), 0, nav.cz(k)); bot.vel.set(0, 0, 0); g.world.settle(bot); bot.brain.reset();
  const b = bot.brain; b.pickGoal = () => {}; b.setGoal(goal[0], goal[1], 60); b.target = null;
  let inside = false;
  for (let i = 0; i < 45 * 30; i++) {
    g.step(1 / 30); bot.hp = 1e6; b.target = null;
    if (i % 10) continue;
    if (process.env.DOOR && i % 60 === 0) console.log((i / 30).toFixed(0), bot.pos.x.toFixed(1), bot.pos.y.toFixed(2), bot.pos.z.toFixed(1), 'hedef', goal.map((v) => v.toFixed(1)).join(','), 'kapı y', d.y.toFixed(2), 'yol', b.path?.length, b.goal ? b.goal.x.toFixed(1) + ',' + b.goal.z.toFixed(1) : '-');
    const dIn = (bot.pos.x - ix) * nx + (bot.pos.z - iz) * nz;
    if (dIn > 0.8 && Math.abs(bot.pos.y - d.y) < 0.6) { inside = true; break; }
  }
  if (inside) ok++; else fails.push(`${ix.toFixed(0)},${iz.toFixed(0)}` + (process.env.V ? `[${bot.alive ? "" : "ölü "}${Math.hypot(bot.pos.x - goal[0], bot.pos.z - goal[1]).toFixed(1)}m y${(bot.pos.y - d.y).toFixed(1)} yol${b.path?.length ?? "-"}]` : ""));
}
console.log(`bina içine giriş: ${ok}/${tried} kapı`);
console.log('giremedi:', fails.join(' '));
