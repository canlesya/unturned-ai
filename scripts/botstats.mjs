// Bot davranışı ölçümü (başsız, tarayıcısız): node scripts/botstats.mjs [harita=colgecidi] [mod=conquest] [zorluk=normal] [NvN=8] [sn=240] [tohum=1]
// Ortam: BLUE=hard RED=easy (takım başına zorluk; karışık maç), JSON=1 (tek satır JSON çıktı), SEEDS=3 (art arda tohum, ortalama).
// Ölçülenler: rol / silah dağılımı, ortalama yaşam, öldürme mesafesi, isabet / kafa oranı, tepki süresi (hedef seçimi → ilk atış / ilk isabet),
// görünürlük (canlı botun bir düşmanın görüşünde olduğu zaman %; hedefsizken açıkta %), habersiz yenen hasar %, duvara sürtünme (yürümek isteyip
// ilerleyemediği kare %), takılma (2 sn'de < 0,5 m, yürümek isterken), yerinde dönme, zıplama, hedefte (bayrak alanı) geçen zaman %, rota tekrarı
// (aynı botun ardışık iki yaşamında gezdiği 8 m hücrelerin Jaccard benzerliği), bot beyni süresi (ms / adım).
let seed = 1;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
Math.random = rng;
const { Game } = await import('../src/game/game.js');
const { Soldier } = await import('../src/game/soldier.js');
const { BotBrain } = await import('../src/game/bot.js');
const { DIFFICULTY } = await import('../src/game/stats.js');
const { TUNE } = await import('../src/game/balance.js');

const [map = 'colgecidi', type = 'conquest', diff = 'normal', per = '8', secs = '240', seed0 = '1'] = process.argv.slice(2);
const SEEDS = +(process.env.SEEDS || 1);

// ── kancalar (bir kez) ──
let M = null;                                                     // aktif ölçüm kaydı
const _shoot = Soldier.prototype._shoot;
Soldier.prototype._shoot = function (st) {
  if (M && this.brain && !this.def.zombie) {
    const b = this.brain, m = M;
    m.shots += st.pellets || 1; m.shotEvents++;
    const tg = b.target;
    if (tg && b._rt0 != null && b._rtTg === tg) { m.react.push(m.g.time - b._rt0); b._rt0 = null; }
    if (tg) { const d = Math.hypot(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z); m.shotDist.push(d); }
  }
  return _shoot.call(this, st);
};
const _take = Soldier.prototype.takeDamage;
Soldier.prototype.takeDamage = function (amount, attacker, zone, fromPos, weaponName) {
  if (M && this.alive && !(this.protT > 0) && attacker && attacker !== this && attacker.team !== this.team) {
    const m = M;
    if (attacker.brain && !attacker.def.zombie && attacker.stat?.kind === 'gun') {
      m.hits++; if (zone === 'head') m.heads++;
      const b = attacker.brain;
      if (b._ht0 != null && b._htTg === this) { m.firstHit.push(m.g.time - b._ht0); b._ht0 = null; }
    }
    if (this.brain && !this.def.zombie) { m.dmgTaken += amount; if (this.brain.target !== attacker) m.dmgUnaware += amount; }
    const t = m.byTeam[attacker.team]; if (t) t.dmg += amount;
  }
  return _take.call(this, amount, attacker, zone, fromPos, weaponName);
};
const _upd = BotBrain.prototype.update;
BotBrain.prototype.update = function (dt) {
  if (!M) return _upd.call(this, dt);
  const t0 = performance.now(); _upd.call(this, dt); M.brainMs += performance.now() - t0;
};

const cls = (s) => s.cls, prim = (s) => s.items?.[0]?.id;
const hist = (arr, edges) => { const h = new Array(edges.length + 1).fill(0); for (const v of arr) { let i = 0; while (i < edges.length && v >= edges[i]) i++; h[i]++; } return h.map((n) => Math.round((100 * n) / Math.max(1, arr.length))); };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };

function run(sd) {
  seed = sd * 7919 + 13;
  const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff, match: { perTeam: +per, type } });
  for (const b of g.brains) { const k = b.s.team === 'blue' ? process.env.BLUE : b.s.team === 'red' ? process.env.RED : null; if (k && DIFFICULTY[k]) { b.d = DIFFICULTY[k]; b.diffKey = k; b.s.dmgMul = b.d.dmgMul; } }
  const m = M = {
    g, shots: 0, shotEvents: 0, hits: 0, heads: 0, react: [], firstHit: [], shotDist: [], killDist: [], killDistSn: [], lives: [], dmgTaken: 0, dmgUnaware: 0,
    expo: 0, expoIdle: 0, samples: 0, moveF: 0, blockF: 0, stuck: 0, spin: 0, jumps: 0, objT: 0, aliveT: 0, brainMs: 0, roles: {}, cls: {}, wpn: {}, rep: [],
    byTeam: { blue: { k: 0, d: 0, dmg: 0 }, red: { k: 0, d: 0, dmg: 0 } }, flags: 0, byRole: {},
  };
  g.on('flag', () => m.flags++);
  const bornT = new Map(), cells = new Map(), prevCells = new Map();
  const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const onSpawn = (s) => {
    if (!s.brain || s.def.zombie) return;
    bornT.set(s, g.time); tally(m.cls, cls(s)); tally(m.wpn, prim(s));
    const old = cells.get(s);
    if (old && old.size > 4) { const p = prevCells.get(s); if (p) { let inter = 0; for (const c of old) if (p.has(c)) inter++; m.rep.push(inter / (old.size + p.size - inter)); } prevCells.set(s, old); }
    cells.set(s, new Set());
  };
  g.on('spawn', onSpawn);
  for (const s of g.soldiers) if (s.alive) onSpawn(s);
  const onKill = g.onKill.bind(g);
  g.onKill = (killer, victim, w, hs) => {
    if (killer && killer !== victim && killer.team !== victim.team) {
      const d = Math.hypot(killer.pos.x - victim.pos.x, killer.pos.z - victim.pos.z);
      if (killer.brain && !killer.def.zombie) { const r = killer.brain.role || '-'; (m.byRole[r] ||= { k: 0, d: 0, dist: [] }).k++; m.byRole[r].dist.push(d); }
      if (victim.brain && !victim.def.zombie) { const r = victim.brain.role || '-'; (m.byRole[r] ||= { k: 0, d: 0, dist: [] }).d++; }
      if (killer.brain && !killer.def.zombie) { m.killDist.push(d); if (/Keskin|SVD|Barrett|M24/i.test(w || '') || ['sniper', 'svd', 'barrett'].includes(killer.items?.[0]?.id) && killer.cur === 0) m.killDistSn.push(d); }
      if (m.byTeam[killer.team]) m.byTeam[killer.team].k++;
      if (m.byTeam[victim.team]) m.byTeam[victim.team].d++;
    }
    if (victim.brain && bornT.has(victim)) { m.lives.push(g.time - bornT.get(victim)); bornT.delete(victim); }
    return onKill(killer, victim, w, hs);
  };
  const dt = 1 / 30, N = +secs * 30;
  const last = new Map(), win = new Map();
  const tA = { x: 0, y: 0, z: 0 };
  const t0 = performance.now();
  let steps = 0;
  for (; steps < N && !g.ended; steps++) {
    for (const b of g.brains) {
      const s = b.s; if (!s.alive || s.def.zombie) continue;
      last.set(s, { x: s.pos.x, z: s.pos.z, vx: s.vel.x, vz: s.vel.z, g: s.onGround, tg: b.target });
    }
    g.step(dt);
    for (const b of g.brains) {
      const s = b.s; if (!s.alive || s.def.zombie) continue;
      if (b.target && b.target !== b._lastTg) { b._rt0 = g.time; b._rtTg = b.target; b._ht0 = g.time; b._htTg = b.target; }
      b._lastTg = b.target;
      const L = last.get(s); if (!L) continue;
      m.aliveT += dt;
      const want = Math.hypot(L.vx, L.vz), got = Math.hypot(s.pos.x - L.x, s.pos.z - L.z) / dt;
      if (want > 1.5) { m.moveF++; if (got < want * 0.35) m.blockF++; }
      if (L.g && !s.onGround && s.vel.y > 2) m.jumps++;
      cells.get(s)?.add(Math.floor(s.pos.x / 8) + ',' + Math.floor(s.pos.z / 8));
      if (g.mode.objectives?.length && !g.payload) for (const o of g.mode.objectives) if (Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < o.r) { m.objT += dt; break; }
      let w = win.get(s); if (!w) win.set(s, (w = { t: 0, x: s.pos.x, z: s.pos.z, yaw: s.yaw, rot: 0, mv: 0, n: 0, tg: 0 }));
      w.t += dt; w.n++; if (want > 1.5) w.mv++; if (b.target) w.tg++;
      let dy = s.yaw - (w.py ?? s.yaw); while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; w.rot += Math.abs(dy); w.py = s.yaw;
      if (w.t >= 2) {
        const disp = Math.hypot(s.pos.x - w.x, s.pos.z - w.z);
        if (disp < 0.5 && w.mv > w.n * 0.5 && !w.tg) m.stuck++;
        if (disp < 1 && w.rot > Math.PI * 1.5 && !w.tg) m.spin++;
        win.set(s, { t: 0, x: s.pos.x, z: s.pos.z, rot: 0, mv: 0, n: 0, tg: 0, py: s.yaw });
      }
    }
    if (steps % 15 === 0) {                                        // görünürlük örneği (0,5 sn)
      for (const b of g.brains) {
        const s = b.s; if (!s.alive || s.def.zombie) continue;
        tally(m.roles, b.role || '-');
        m.samples++;
        const c = s.center(new (s.pos.constructor)());
        let seen = false;
        for (const e of g.soldiers) {
          if (!e.alive || e.team === s.team || e.def.zombie) continue;
          if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) > TUNE.sightDay) continue;
          if (g.botSees(e.eye(new (s.pos.constructor)()), c)) { seen = true; break; }
        }
        if (seen) { m.expo++; if (!b.target) m.expoIdle++; }
      }
    }
  }
  const simMs = performance.now() - t0;
  M = null;
  return {
    steps, simMs, ...m, g: undefined, kills: g.soldiers.reduce((a, s) => a + s.kills, 0), ended: g.ended ? `${g.winner}/${g.endReason}` : '-',
  };
}

const R = [];
for (let k = 0; k < SEEDS; k++) R.push(run(+seed0 + k));
const cat = (f) => R.flatMap(f), sum = (f) => R.reduce((a, r) => a + f(r), 0);
const merge = (f) => { const o = {}; for (const r of R) for (const [k, v] of Object.entries(f(r))) o[k] = (o[k] || 0) + v; return o; };
const pct = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0) || 1; return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((100 * v) / t)}%`).join(' '); };
const out = {
  map, type, diff: process.env.BLUE || process.env.RED ? `B:${process.env.BLUE || diff} R:${process.env.RED || diff}` : diff, per: +per, secs: +secs, seeds: SEEDS,
  kills: sum((r) => r.kills), lifeAvg: +avg(cat((r) => r.lives)).toFixed(1),
  acc: +((100 * sum((r) => r.hits)) / Math.max(1, sum((r) => r.shots))).toFixed(1), head: +((100 * sum((r) => r.heads)) / Math.max(1, sum((r) => r.hits))).toFixed(1),
  reactMed: +med(cat((r) => r.react)).toFixed(2), firstHitMed: +med(cat((r) => r.firstHit)).toFixed(2),
  killDistMed: +med(cat((r) => r.killDist)).toFixed(0), killDistHist: hist(cat((r) => r.killDist), [10, 25, 50, 90]), snKills: cat((r) => r.killDistSn).length, snKillDistMed: +med(cat((r) => r.killDistSn)).toFixed(0),
  expo: +((100 * sum((r) => r.expo)) / Math.max(1, sum((r) => r.samples))).toFixed(1), expoIdle: +((100 * sum((r) => r.expoIdle)) / Math.max(1, sum((r) => r.samples))).toFixed(1),
  unaware: +((100 * sum((r) => r.dmgUnaware)) / Math.max(1, sum((r) => r.dmgTaken))).toFixed(1),
  block: +((100 * sum((r) => r.blockF)) / Math.max(1, sum((r) => r.moveF))).toFixed(1), stuckPerMin: +((60 * sum((r) => r.stuck)) / Math.max(1, sum((r) => r.aliveT))).toFixed(2),
  spinPerMin: +((60 * sum((r) => r.spin)) / Math.max(1, sum((r) => r.aliveT))).toFixed(2), jumpsPerMin: +((60 * sum((r) => r.jumps)) / Math.max(1, sum((r) => r.aliveT))).toFixed(2),
  objPct: +((100 * sum((r) => r.objT)) / Math.max(1, sum((r) => r.aliveT))).toFixed(1), flags: sum((r) => r.flags),
  routeRep: +avg(cat((r) => r.rep)).toFixed(2), brainMsStep: +(sum((r) => r.brainMs) / Math.max(1, sum((r) => r.steps))).toFixed(3), stepMs: +(sum((r) => r.simMs) / Math.max(1, sum((r) => r.steps))).toFixed(2),
  kd: Object.fromEntries(['blue', 'red'].map((t) => [t, `${sum((r) => r.byTeam[t].k)}/${sum((r) => r.byTeam[t].d)}`])),
  byRole: Object.fromEntries([...new Set(R.flatMap((r) => Object.keys(r.byRole)))].map((k) => { const a = R.map((r) => r.byRole[k]).filter(Boolean); const k2 = a.reduce((x, y) => x + y.k, 0), d2 = a.reduce((x, y) => x + y.d, 0); return [k, `${k2}/${d2} ${(k2 / Math.max(1, d2)).toFixed(2)} ${med(a.flatMap((y) => y.dist)).toFixed(0)}m`]; })),
  roles: pct(merge((r) => r.roles)), cls: pct(merge((r) => r.cls)), wpn: pct(merge((r) => r.wpn)),
};
if (process.env.JSON) console.log(JSON.stringify(out));
else for (const [k, v] of Object.entries(out)) console.log(k.padEnd(14), typeof v === 'object' ? JSON.stringify(v) : v);
