// Enfekte ayrıntılı denge ölçümü (headless, paralel, botlu): kazanma oranı + zombi / insan istatistikleri.
// node scripts/infstats.mjs [maç=20] [süre=600]   ortam: SIZES=8,12,16,24 MAPS=newyork SEED0=1
// Deneme ayarları (kalıcı değil): ZRESP ZLIVES GRACE BHP BG BOFF  ·  INFJ='{"ZOMBIE":{"respawn":4},"ZTYPES.walker":{"hp":220}}'
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

if (isMainThread) {
  const N = +(process.argv[2] || 20), TIME = +(process.argv[3] || 600);
  const maps = (process.env.MAPS || 'newyork').split(','), sizes = (process.env.SIZES || '8,12,16,24').split(',').map(Number);
  const seed0 = +(process.env.SEED0 || 1);
  const jobs = [];
  for (const map of maps) for (const size of sizes) for (let i = 0; i < N; i++) jobs.push({ map, size, time: TIME, seed: seed0 + i * 7919 + size * 131 });
  const results = [], workers = Math.max(1, Math.min(+(process.env.WORKERS || 0) || os.cpus().length - 2, jobs.length));
  let next = 0, done = 0; const t0 = Date.now();
  await new Promise((resolve) => {
    for (let w = 0; w < workers; w++) {
      const wk = new Worker(fileURLToPath(import.meta.url));
      const feed = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); else { wk.terminate(); if (++done === workers) resolve(); } };
      wk.on('message', (r) => { results.push(r); feed(); });
      wk.on('error', (e) => { console.error('HATA', e); process.exit(1); });
      feed();
    }
  });
  const avg = (r, f) => r.reduce((a, x) => a + f(x), 0) / Math.max(1, r.length);
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + '%';
  console.log(`\nEnfekte · ${N} maç/durum · süre ${TIME} sn · ${results.length} maç · ${Math.round((Date.now() - t0) / 1000)} sn${process.env.INFJ ? ' · ' + process.env.INFJ : ''}`);
  console.log('Harita | Kişi | İnsan kaz. | Ort. süre | İlk enf. | Zirve Z | Enf. | İyileşme | Z K/D | Pençe isabet | Ort. Z→İ m | İnsan yüksekte | Z yol hatası/dk | Mermi/insan/dk | Mermisiz% | Hata');
  const rows = [];
  for (const map of maps) for (const size of sizes) {
    const r = results.filter((x) => x.map === map && x.size === size && !x.err), n = r.length;
    const win = r.filter((x) => x.winner === 'blue').length;
    const sw = r.reduce((a, x) => a + x.swings, 0), hit = r.reduce((a, x) => a + x.clawHits, 0);
    const zk = r.reduce((a, x) => a + x.zKills, 0), zd = r.reduce((a, x) => a + x.zDeaths, 0);
    const row = { map, size, n, win, t: avg(r, (x) => x.t), tInf: avg(r, (x) => x.tFirstInf ?? x.t), peakZ: avg(r, (x) => x.peakZ), inf: avg(r, (x) => x.infections), cure: avg(r, (x) => x.cures), kd: zd ? zk / zd : 0, hit: sw ? hit / sw : 0, near: avg(r, (x) => x.nearAvg), high: avg(r, (x) => x.highFrac), pf: avg(r, (x) => x.pathFail / Math.max(1, x.t / 60)), shots: avg(r, (x) => x.shotsPerHumanMin), dry: avg(r, (x) => x.dryFrac), err: results.filter((x) => x.map === map && x.size === size && x.err).length, reasons: {} };
    for (const x of r) row.reasons[x.why] = (row.reasons[x.why] || 0) + 1;
    rows.push(row);
    console.log(`${map.padEnd(7)}| ${String(size).padEnd(4)} | ${(win + '/' + n + ' ' + pct(win, n)).padEnd(10)} | ${row.t.toFixed(0).padStart(5)} sn | ${row.tInf.toFixed(0).padStart(4)} sn | ${row.peakZ.toFixed(1).padStart(5)} | ${row.inf.toFixed(1).padStart(4)} | ${row.cure.toFixed(1).padStart(5)} | ${row.kd.toFixed(2).padStart(5)} | ${pct(hit, sw).padStart(5)} (${sw}) | ${row.near.toFixed(1).padStart(5)} | ${pct(row.high * 100, 100).padStart(5)} | ${row.pf.toFixed(1).padStart(5)} | ${row.shots.toFixed(0).padStart(4)} | ${pct(row.dry * 100, 100).padStart(4)} | ${row.err}`);
  }
  for (const row of rows) console.log(`  ${row.map} ${row.size}: bitiş nedeni ${JSON.stringify(row.reasons)}`);
  const all = results.filter((x) => !x.err);
  console.log(`TOPLAM insan kazandı ${all.filter((x) => x.winner === 'blue').length}/${all.length} (${pct(all.filter((x) => x.winner === 'blue').length, all.length)}) · ort. süre ${avg(all, (x) => x.t).toFixed(0)} sn`);
  const zt = {}; for (const x of all) for (const [k, v] of Object.entries(x.byType)) { const o = (zt[k] ||= { lives: 0, kills: 0, life: 0, dmg: 0 }); o.lives += v.lives; o.kills += v.kills; o.life += v.life; o.dmg += v.dmg; }
  console.log('Zombi türü | doğuş | öldürme/doğuş | ort. ömür sn | hasar/doğuş');
  for (const [k, o] of Object.entries(zt)) console.log(`  ${k.padEnd(8)} | ${String(o.lives).padEnd(5)} | ${(o.kills / o.lives).toFixed(2)} | ${(o.life / o.lives).toFixed(1)} | ${(o.dmg / o.lives).toFixed(0)}`);
  if (process.env.JSON) { const fs = await import('node:fs'); fs.writeFileSync(process.env.JSON, JSON.stringify({ rows, zt, env: process.env.INFJ || '' }, null, 1)); }
  const errs = results.filter((x) => x.err); if (errs.length) console.log('\nHATALAR:', errs.slice(0, 3).map((e) => e.err));
  process.exit(0);
} else {
  // tohumlu rastgelelik (tekrarlanabilir maçlar)
  let S = 1;
  const rnd = () => { S = (S * 1664525 + 1013904223) >>> 0; return S / 4294967296; };
  Math.random = rnd;
  const { Game } = await import('../src/game/game.js');
  const { Soldier } = await import('../src/game/soldier.js');
  const ST = await import('../src/game/stats.js');
  const { ZOMBIE, BOSS } = ST;
  if (process.env.ZRESP) ZOMBIE.respawn = +process.env.ZRESP; if (process.env.ZLIVES) ZOMBIE.lives = +process.env.ZLIVES; if (process.env.GRACE) ZOMBIE.grace = +process.env.GRACE;
  if (process.env.BHP) BOSS.hp = +process.env.BHP; if (process.env.BG) BOSS.growth = +process.env.BG; if (process.env.BOFF) BOSS.secondOffset = +process.env.BOFF;
  if (process.env.INFJ) {
    const J = JSON.parse(process.env.INFJ);
    for (const [path, vals] of Object.entries(J)) {
      const [root, ...rest] = path.split('.');
      let o = root === 'INF_BOT' || root === 'INF_Z' ? (await import('../src/game/bot.js'))[root] : root === 'TUNE' ? (await import('../src/game/balance.js')).TUNE : ST[root];
      for (const k of rest) o = o[k];
      Object.assign(o, vals);
    }
  }
  // sayaçlar: prototipe kanca
  let M = null;
  const oFire = Soldier.prototype.tryFire;
  Soldier.prototype.tryFire = function (...a) { const r = oFire.apply(this, a); if (r && M && !this.def.zombie && this.stat.kind === 'gun') M.shots++; return r; };
  const oDmg = Soldier.prototype.takeDamage;
  Soldier.prototype.takeDamage = function (amount, attacker, ...a) {
    const hp0 = this.hp, alive0 = this.alive;
    oDmg.call(this, amount, attacker, ...a);
    if (M && alive0 && attacker && attacker.def?.zombie && !this.def.zombie) { const k = attacker.boss ? 'boss' : attacker.ztype; (M.byType[k] ||= { lives: 0, kills: 0, life: 0, dmg: 0 }).dmg += hp0 - Math.max(0, this.hp); }
  };
  parentPort.on('message', (j) => {
    S = j.seed >>> 0 || 1;
    const r = { ...j, winner: null, why: '', t: 0, err: null, tFirstInf: null, peakZ: 0, infections: 0, cures: 0, zKills: 0, zDeaths: 0, swings: 0, clawHits: 0, nearAvg: 0, highFrac: 0, pathFail: 0, shotsPerHumanMin: 0, dryFrac: 0, byType: {} };
    M = { shots: 0, byType: r.byType };
    try {
      const g = new Game(null, { headless: true, map: j.map, tod: 'night', weather: 'clear', diff: 'hard', match: { perTeam: j.size, type: 'inf', time: j.time } });
      g.on('infect', () => { r.infections++; if (r.tFirstInf == null) r.tFirstInf = g.time; });
      g.on('cure', () => r.cures++);
      g.on('melee', (s) => { if (s.def.zombie) r.swings++; });
      const oMH = g.meleeHit.bind(g);
      g.meleeHit = (att, o, d, reach) => { const h = oMH(att, o, d, reach); if (att.def.zombie && h && h.victim) r.clawHits++; return h; };
      const oFP = g.nav.findPath.bind(g.nav);
      g.nav.findPath = (...a) => { const p = oFP(...a); if (a[4] === 1.15 && (!p || !p.length)) r.pathFail++; return p; };
      const oKill = g.onKill.bind(g);
      g.onKill = (killer, victim, w, hs) => {
        if (victim.def.zombie) { r.zDeaths++; const k = victim.boss ? 'boss' : victim.ztype, o = (r.byType[k] ||= { lives: 0, kills: 0, life: 0, dmg: 0 }); o.life += g.time - (victim._zBorn ?? g.time); }
        else if (killer && killer.def?.zombie) { r.zKills++; const k = killer.boss ? 'boss' : killer.ztype; (r.byType[k] ||= { lives: 0, kills: 0, life: 0, dmg: 0 }).kills++; }
        return oKill(killer, victim, w, hs);
      };
      const wasAlive = new Map();
      let nearS = 0, nearN = 0, highN = 0, humN = 0, dryN = 0, humSec = 0;
      const steps = j.time * 30 + 90;
      for (let i = 0; i < steps && !g.ended; i++) {
        g.step(1 / 30);
        for (const s of g.soldiers) {         // zombi doğuşu (tür + ömür)
          const a = s.alive && s.def.zombie;
          if (a && !wasAlive.get(s)) { s._zBorn = Math.max(g.time, ZOMBIE.grace); const k = s.boss ? 'boss' : s.ztype; (r.byType[k] ||= { lives: 0, kills: 0, life: 0, dmg: 0 }).lives++; }
          wasAlive.set(s, a);
        }
        if (i % 30 === 0 && g.graceLeft <= 0) {
          const hs = g.soldiers.filter((s) => s.alive && !s.def.zombie), zs = g.soldiers.filter((s) => s.alive && s.def.zombie);
          const c = g.infCounts(); r.peakZ = Math.max(r.peakZ, c.z);
          for (const z of zs) { let d = 1e9; for (const h of hs) d = Math.min(d, z.pos.distanceTo(h.pos)); if (d < 1e8) { nearS += Math.min(d, 120); nearN++; } }
          for (const h of hs) { humN++; humSec++; if (h.pos.y > 0.8) highN++; const p = h.items[0]; if (p && p.mag + p.reserve <= 0) dryN++; }
        }
      }
      r.winner = g.winner; r.why = (g.endReason || (g.ended ? '?' : 'süresiz')).replace(/[0-9]+/g, 'n'); r.t = Math.round(g.time);
      r.nearAvg = nearN ? nearS / nearN : 0; r.highFrac = humN ? highN / humN : 0; r.dryFrac = humN ? dryN / humN : 0;
      r.shotsPerHumanMin = humSec ? M.shots / (humSec / 60) : 0;
    } catch (e) { r.err = String(e.stack || e).split('\n').slice(0, 3).join(' | '); }
    parentPort.postMessage(r);
  });
}
