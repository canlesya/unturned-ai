// Zorluk farkı: "insan oyuncu" benzetimine karşı tek bot düellosu (başsız). node scripts/botduel.mjs [harita=colgecidi] [deneme=24] [silah=m4a1]
// İnsan benzetimi: ateş etmez; yana kayar (A/D, 0,3–1,0 sn'de bir yön değiştirir, %30 durur, ara sıra çömelir), başlangıç noktasından ±2,5 m.
// Bot görüş konisinde (±40°) başlar; ölçülen: fark etme, ilk atış, ilk isabet, öldürme süresi (12 sn sınırı), isabet %, kafa %.
// Mesafe kümeleri 15 / 35 / 70 m; noktalar nav + botSees ile rastgele seçilir (tohumlu, her zorlukta aynı noktalar).
let seed = 99;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const THREE = await import('three');
const { Game } = await import('../src/game/game.js');
const { DIFFICULTY } = await import('../src/game/stats.js');
const { Soldier } = await import('../src/game/soldier.js');
const [map = 'colgecidi', trials = '24', weapon = 'm4a1'] = process.argv.slice(2);
const cls = ['sniper', 'svd', 'barrett'].includes(weapon) ? 'sniper' : ['lmg', 'pkm'].includes(weapon) ? 'heavy' : ['mp5', 'vector', 'p90'].includes(weapon) ? 'medic' : 'assault';
const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', devMode: true, match: { perTeam: 1, type: 'tdm' } });
const bot = g.soldiers.find((s) => s.team === 'blue'), dummy = g.soldiers.find((s) => s.team === 'red');
g.brains.splice(g.brains.indexOf(dummy.brain), 1); dummy.brain = null;
const brain = bot.brain;
let shots = 0, hits = 0, heads = 0, firstShot = null, firstHit = null;
const _shoot = Soldier.prototype._shoot;
Soldier.prototype._shoot = function (st) { if (this === bot) { shots += st.pellets || 1; if (firstShot == null) firstShot = g.time; } return _shoot.call(this, st); };
const _take = Soldier.prototype.takeDamage;
Soldier.prototype.takeDamage = function (a, att, zone, ...r) { if (this === dummy && att === bot && this.protT <= 0 && this.alive) { hits++; if (zone === 'head') heads++; if (firstHit == null) firstHit = g.time; } return _take.call(this, a, att, zone, ...r); };

// nokta çiftleri
const nav = g.nav, b = g.map.bounds, eye = new THREE.Vector3(), cen = new THREE.Vector3();
const place = (s, x, z, ry) => { s.spawn({ x, z, ry }, 0); g.world.settle(s); };
function findPairs(D, n) {
  const out = [];
  for (let k = 0; k < 40000 && out.length < n; k++) {
    const x = b.minX + 4 + Math.random() * (b.maxX - b.minX - 8), z = b.minZ + 4 + Math.random() * (b.maxZ - b.minZ - 8);
    if (!nav.isFree(x, z)) continue;
    const a = Math.random() * Math.PI * 2, d = D * (0.85 + Math.random() * 0.3), x2 = x + Math.cos(a) * d, z2 = z + Math.sin(a) * d;
    if (!nav.isFree(x2, z2)) continue;
    let ok = true; for (let q = 0; q < 8 && ok; q++) ok = nav.isFree(x2 + Math.cos(q * 0.785) * 2.5, z2 + Math.sin(q * 0.785) * 2.5);
    if (!ok) continue;
    place(bot, x, z, 0); place(dummy, x2, z2, 0);
    if (Math.abs(bot.pos.y - dummy.pos.y) > 6) continue;
    if (!g.botSees(bot.eye(eye), dummy.center(cen))) continue;
    out.push([x, z, x2, z2]);
  }
  return out;
}
const pairs = { 15: findPairs(15, +trials), 35: findPairs(35, +trials), 70: findPairs(70, +trials) };
const res = {};
for (const dk of Object.keys(DIFFICULTY)) {
  for (const D of [15, 35, 70]) {
    const P = pairs[D]; const r = { n: 0, kills: 0, ttk: [], det: [], fs: [], fh: [], shots: 0, hits: 0, heads: 0 };
    for (let t = 0; t < P.length; t++) {
      seed = 1000 + t * 31 + D;
      const [x, z, x2, z2] = P[t];
      bot.choice = { primary: weapon, secondary: 'pistol', gadget: 'smoke', melee: 'knife' }; bot.setClass?.(cls); bot.choice = { primary: weapon, secondary: 'pistol', gadget: 'smoke', melee: 'knife' };
      brain.d = DIFFICULTY[dk]; brain.diffKey = dk; bot.dmgMul = brain.d.dmgMul;
      const want = Math.atan2(-(x2 - x), -(z2 - z));
      place(bot, x, z, want + (Math.random() - 0.5) * 1.4); place(dummy, x2, z2, want + Math.PI);
      brain.reset(); bot.hp = bot.maxHp;
      shots = 0; hits = 0; heads = 0; firstShot = null; firstHit = null;
      const t0 = g.time; let det = null, sd = 1, flip = 0, stop = false;
      const px = -(z2 - z), pz = x2 - x, pl = Math.hypot(px, pz);
      while (g.time - t0 < 12 && dummy.alive) {
        flip -= 1 / 30;
        if (flip <= 0) { flip = 0.3 + Math.random() * 0.7; stop = Math.random() < 0.3; sd = Math.random() < 0.5 ? -1 : 1; dummy.crouching = Math.random() < 0.15; }
        const off = ((dummy.pos.x - x2) * px + (dummy.pos.z - z2) * pz) / pl;
        if (Math.abs(off) > 2.5) sd = -Math.sign(off);
        const sp = stop ? 0 : 4.2;
        dummy.vel.x = (px / pl) * sd * sp; dummy.vel.z = (pz / pl) * sd * sp;
        bot.hp = bot.maxHp;
        g.step(1 / 30);
        if (det == null && brain.target === dummy) det = g.time - t0;
      }
      r.n++; r.shots += shots; r.hits += hits; r.heads += heads;
      if (det != null) r.det.push(det); if (firstShot != null) r.fs.push(firstShot - t0); if (firstHit != null) r.fh.push(firstHit - t0);
      if (!dummy.alive) { r.kills++; r.ttk.push(g.time - t0); }
      if (!dummy.alive) { dummy.alive = true; }
    }
    res[`${dk}@${D}`] = r;
  }
}
const med = (a) => { if (!a.length) return NaN; const q = [...a].sort((x, y) => x - y); return q[q.length >> 1]; };
console.log(`harita ${map} · silah ${weapon} · deneme / mesafe: 15 m ${pairs[15].length}, 35 m ${pairs[35].length}, 70 m ${pairs[70].length}`);
console.log('| zorluk @ m | öldürdü % | öldürme sn (medyan) | fark etme sn | ilk atış sn | ilk isabet sn | isabet % | kafa % |');
console.log('|---|---|---|---|---|---|---|---|');
for (const [k, r] of Object.entries(res)) console.log(`| ${k} | ${Math.round((100 * r.kills) / Math.max(1, r.n))} | ${med(r.ttk).toFixed(2)} | ${med(r.det).toFixed(2)} | ${med(r.fs).toFixed(2)} | ${med(r.fh).toFixed(2)} | ${((100 * r.hits) / Math.max(1, r.shots)).toFixed(1)} | ${((100 * r.heads) / Math.max(1, r.hits)).toFixed(0)} |`);
if (process.env.JSON) console.log(JSON.stringify(res, (k, v) => (Array.isArray(v) ? +med(v).toFixed(2) : v)));
