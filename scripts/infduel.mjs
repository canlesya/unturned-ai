// Bot insan ↔ tek zombi düellosu (görüş açık, 35-55 m): zombi kaç denemede kazanıyor? node scripts/infduel.mjs [deneme=24] [hp] [hız] [hasar]
import { Game } from '../src/game/game.js';
import { ZOMBIE, WSTATS, CLASS_DEFS } from '../src/game/stats.js';
const [N = 24, hp, spd, dmg] = process.argv.slice(2).map(Number);
if (hp) ZOMBIE.hp = hp; if (spd) { ZOMBIE.speed = spd; CLASS_DEFS.zombie.speed = spd; } if (dmg) { ZOMBIE.dmg = dmg; WSTATS.claws.dmg = dmg; }
const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: 4, type: 'inf', time: 600 } });
// herkesi kapat, 1 insan + 1 zombi bırak
const hum = g.soldiers.find((s) => s.team === 'blue'), zom = g.soldiers.find((s) => s.def.zombie);
for (const s of g.soldiers) if (s !== hum && s !== zom) { s.alive = false; s.vacant = true; s.brain = null; }
g.brains = g.brains.filter((b) => b.s === hum || b.s === zom);
const pts = g.nav.spreadPoints(g.nav.reachable(g.map.spawns.blue[0].x, g.map.spawns.blue[0].z), { spacing: 6, max: 400 });
let zWin = 0, n = 0, tsum = 0;
const rng = () => pts[Math.floor(Math.random() * pts.length)];
for (let tries = 0; n < N && tries < 3000; tries++) {
  const a = rng(), b = rng(), d = Math.hypot(a.x - b.x, a.z - b.z);
  if (d < 35 || d > 55) continue;
  hum.spawn({ x: a.x, z: a.z, ry: 0 }, 0); zom.spawn({ x: b.x, z: b.z, ry: 0 }, 0); g.world.settle(hum); g.world.settle(zom);
  if (!g.losClear(hum.eye(new (hum.pos.constructor)()), zom.center(new (hum.pos.constructor)()))) continue;
  hum.protT = zom.protT = 0; hum.brain.reset(); zom.brain.reset();
  hum.items = hum.items; let t = 0;
  while (hum.alive && zom.alive && t < 25) { g.step(1 / 30); t += 1 / 30; }
  n++; if (!hum.alive) { zWin++; } tsum += t;
  g.ended = false;
}
console.log(`hp ${ZOMBIE.hp} hız ${ZOMBIE.speed} hasar ${ZOMBIE.dmg} | tek zombi insanı yendi ${zWin}/${n} · ort. süre ${(tsum / n).toFixed(1)} sn`);
