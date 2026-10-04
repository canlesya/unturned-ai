// Bot insan ↔ tek zombi düellosu (görüş açık, 35-55 m), zombi türü başına: zombi kaç denemede kazanıyor? node scripts/infduel.mjs [deneme=16]
import { Game } from '../src/game/game.js';
import { ZT_ORDER, ZTYPES } from '../src/game/stats.js';
const N = +(process.argv[2] || 16);
const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: 4, type: 'inf', time: 600 } });
const hum = g.soldiers.find((s) => s.team === 'blue'), zom = g.soldiers.find((s) => s.def.zombie);
for (const s of g.soldiers) if (s !== hum && s !== zom) { s.alive = false; s.vacant = true; s.brain = null; }
g.brains = g.brains.filter((b) => b.s === hum || b.s === zom);
const pts = g.nav.spreadPoints(g.nav.reachable(g.map.spawns.blue[0].x, g.map.spawns.blue[0].z), { spacing: 6, max: 400 });
const V3 = hum.pos.constructor, rng = () => pts[Math.floor(Math.random() * pts.length)];
for (const type of ZT_ORDER) {
  zom.ztype = type; zom.boss = false; zom.setClass('zombie');
  let zWin = 0, n = 0, tsum = 0;
  for (let tries = 0; n < N && tries < 4000; tries++) {
    const a = rng(), b = rng(), d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < 35 || d > 55) continue;
    hum.infectNext = false; hum.spawn({ x: a.x, z: a.z, ry: 0 }, 0); zom.spawn({ x: b.x, z: b.z, ry: 0 }, 0); g.world.settle(hum); g.world.settle(zom);
    if (!g.losClear(hum.eye(new V3()), zom.center(new V3()))) continue;
    hum.protT = zom.protT = 0; zom.abT = 0; hum.brain.reset(); zom.brain.reset();
    let t = 0;
    while (hum.alive && zom.alive && t < 25) { g.step(1 / 30); t += 1 / 30; }
    n++; if (!hum.alive) zWin++; tsum += t; g.ended = false; hum.infectNext = false;
  }
  console.log(`${ZTYPES[type].label.padEnd(10)} can ${String(zom.maxHp).padEnd(4)} → zombi insanı yendi ${zWin}/${n} · ort. ${(tsum / n).toFixed(1)} sn`);
}
