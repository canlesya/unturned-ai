// 12.214 bot isabeti × mesafe (başsız): node scripts/botacc.mjs [harita=kuzey] [deneme=16] [silahlar=m4a1,scarh,lmg,svd,sniper,shotgun]
// Bot ↔ yana kayan hedef (ateş etmez, ölmez) çiftleri 20 / 40 / 70 / 110 / 150 m; her denemede 6 sn ateş, isabet % (saçmada tane başına).
// Atıcı yerinde tutulur (yürüme saçılması karışmasın). Ortam: ELEV=… (bot.js BOT_AIM.elev; 12.214 öncesi 0,0004), DIFF=normal.
let seed = 77;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const THREE = await import('three');
const { Game } = await import('../src/game/game.js');
const { DIFFICULTY } = await import('../src/game/stats.js');
const { Soldier } = await import('../src/game/soldier.js');
const B = await import('../src/game/bot.js');
const [map = 'kuzey', trials = '16', wl = 'm4a1,scarh,lmg,svd,sniper,shotgun'] = process.argv.slice(2);
if (process.env.ELEV != null && B.BOT_AIM) B.BOT_AIM.elev = +process.env.ELEV;
const DK = process.env.DIFF || 'normal';
const clsOf = (w) => (['sniper', 'svd', 'barrett'].includes(w) ? 'sniper' : ['lmg', 'pkm'].includes(w) ? 'heavy' : ['mp5', 'vector', 'p90'].includes(w) ? 'medic' : ['shotgun', 'aa12', 'dbl'].includes(w) ? 'engineer' : 'assault');
const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: DK, devMode: true, match: { perTeam: 1, type: map === 'kuzey' ? 'conquest' : 'tdm' } });
const bot = g.soldiers.find((s) => s.team === 'blue'), dummy = g.soldiers.find((s) => s.team === 'red');
dummy.brain = null; g.brains.length = 0; g.brains.push(bot.brain);
const brain = bot.brain;
let shots = 0, hits = 0;
const _shoot = Soldier.prototype._shoot;
Soldier.prototype._shoot = function (st) { if (this === bot) shots += st.pellets || 1; return _shoot.call(this, st); };
const _take = Soldier.prototype.takeDamage;
Soldier.prototype.takeDamage = function (a, att, ...r) { if (this === dummy && att === bot && this.alive) { hits++; this.hp = this.maxHp; return; } return _take.call(this, a, att, ...r); };
const nav = g.nav, bb = g.map.bounds, eye = new THREE.Vector3(), cen = new THREE.Vector3();
const place = (s, x, z, ry) => { s.spawn({ x, z, ry }, 0); g.world.settle(s); };
function findPairs(D, n) {
  const out = [];
  for (let k = 0; k < 60000 && out.length < n; k++) {
    const x = bb.minX + 4 + Math.random() * (bb.maxX - bb.minX - 8), z = bb.minZ + 4 + Math.random() * (bb.maxZ - bb.minZ - 8);
    if (!nav.isFree(x, z)) continue;
    const a = Math.random() * Math.PI * 2, x2 = x + Math.cos(a) * D, z2 = z + Math.sin(a) * D;
    if (!nav.isFree(x2, z2)) continue;
    place(bot, x, z, 0); place(dummy, x2, z2, 0);
    if (Math.abs(bot.pos.y - dummy.pos.y) > 5 || bot.swim || dummy.swim) continue;
    if (!g.botSees(bot.eye(eye), dummy.center(cen))) continue;
    out.push([x, z, x2, z2]);
  }
  return out;
}
const DS = [20, 40, 70, 110, 150], P = Object.fromEntries(DS.map((D) => [D, findPairs(D, +trials)]));
const rows = [];
for (const w of wl.split(',')) {
  const row = [w];
  for (const D of DS) {
    let S = 0, H = 0;
    for (let t = 0; t < P[D].length; t++) {
      seed = 500 + t * 17 + D;
      const [x, z, x2, z2] = P[D][t];
      if (bot.cls !== clsOf(w)) bot.setClass(clsOf(w));
      bot.choice = { primary: w, secondary: 'pistol', gadget: 'smoke', melee: 'knife' };
      const want = Math.atan2(-(x2 - x), -(z2 - z));
      place(bot, x, z, want); place(dummy, x2, z2, want + Math.PI);
      bot.items = bot.loadout(); bot.cur = 0;
      brain.d = DIFFICULTY[DK]; brain.dk = DK;
      brain.reset(); brain.role = 'rifle'; brain.target = dummy; brain.reactT = 0; brain.lostT = 0; brain.senseT = 99;
      shots = 0; hits = 0;
      const t0 = g.time; let sd = 1, flip = 0, stop = false;
      const px = -(z2 - z), pz = x2 - x, pl = Math.hypot(px, pz);
      while (g.time - t0 < 6) {
        flip -= 1 / 30;
        if (flip <= 0) { flip = 0.3 + Math.random() * 0.7; stop = Math.random() < 0.3; sd = Math.random() < 0.5 ? -1 : 1; }
        const off = ((dummy.pos.x - x2) * px + (dummy.pos.z - z2) * pz) / pl;
        if (Math.abs(off) > 2.5) sd = -Math.sign(off);
        const sp = stop ? 0 : 4.2;
        dummy.vel.x = (px / pl) * sd * sp; dummy.vel.z = (pz / pl) * sd * sp;
        bot.hp = bot.maxHp; bot.pos.x = x; bot.pos.z = z; bot.vel.x = 0; bot.vel.z = 0;
        if (bot.cur === 0 && bot.item.mag <= 1) bot.item.mag = bot.stat.mag || 30;
        brain.target = dummy; brain.senseT = 99;
        g.step(1 / 30);
      }
      S += shots; H += hits;
    }
    row.push(S ? `${((100 * H) / S).toFixed(1)}` : '-');
  }
  rows.push(row);
}
console.log(`harita ${map} · zorluk ${DK} · yükseltme ${B.BOT_AIM?.elev ?? 0.0004} · çift/mesafe ${DS.map((D) => P[D].length).join('/')}`);
console.log('| silah | ' + DS.map((d) => d + ' m').join(' | ') + ' |');
console.log('|---|' + DS.map(() => '---').join('|') + '|');
for (const r of rows) console.log('| ' + r.join(' | ') + ' |');
