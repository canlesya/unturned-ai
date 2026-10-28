// 12.214 bot başına leş dağılımı (başsız, tarayıcısız): node scripts/botkills.mjs [harita=kuzey] [mod=conquest] [NvN=10] [sn=300] [tohum=1]
// Ortam: OUT=dosya.json (bot başına kayıt + özet), SEEDS=n (art arda tohum; botlar tohum başına ayrı kayıt), DIFF=normal, QUIET=1.
// Bot başına: leş / ölüm / hasar (askere, araca), atış (saçma tanesi) / isabet, hedefli süre (b.target), gerçek görüş süresi (0,5 sn örnek: bot görüşüyle
// görünen düşman), ateş ettiği süre, araçta süre (sürücü / nişancı / yolcu), mevzi (atSpot / perching hedefte), hedefte bekleme (hedefe varmış, düşman yok),
// takılma (yürümek isteyip 2 sn'de < 0,5 m), yerinde duruş (2 sn'de < 0,5 m, hedefsiz, yaya), suda, en yakın düşman uzaklığı, kademeli beyin (seyrek düşünme)
// süresi, yaşam başına ilk hedefe dek süre, hiç hedef görmeden ölen / biten yaşam, sınıf / silah / rol (zaman ağırlıklı), araca sıkılan piyade mermisi.
// Özet: en az leş alan %20 ile en çok alan %20 karşılaştırması, Gini, 0 leşli bot sayısı, dakikada leş.
let seed = 1;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
Math.random = rng;
const fs = await import('node:fs');
const { Game } = await import('../src/game/game.js');
const { Soldier } = await import('../src/game/soldier.js');
const { BotBrain } = await import('../src/game/bot.js');
const { TUNE } = await import('../src/game/balance.js');
const { mgAt } = await import('../src/sim/vehicle.js');
const BA = (await import('../src/game/bot.js')).BOT_AIM;
if (BA && process.env.AIMOLD) Object.assign(BA, { elev: 0.0004, sat: 1e9, scope: 0.6 });        // 12.214 öncesi nişan (karşılaştırma)

const [map = 'kuzey', type = 'conquest', per = '10', secs = '300', seed0 = '1'] = process.argv.slice(2);
const SEEDS = +(process.env.SEEDS || 1), DIFF = process.env.DIFF || 'normal';

const VK = {}, EP = [];
let LASTG = null;
let M = null;                                                       // aktif koşu: Map(soldier → kayıt)
const rec = (s) => M && s?.brain && !s.def?.zombie ? M.get(s) : null;
const _shoot = Soldier.prototype._shoot;
Soldier.prototype._shoot = function (st) {
  const r = rec(this);
  if (r) {
    const n = st.pellets || 1; r.shots += n; r.shotEv++; r._firedStep = 1;
    const w = this.item?.id || '?'; (r.wShots[w] = (r.wShots[w] || 0) + n);
    if (this.veh) r.shotsVeh += n;
    const tg = this.brain.target;
    if (tg?.veh && !this.veh) r.shotsAtVeh += n;                     // piyade silahıyla araçtaki hedefe
    if (tg) { const d = Math.hypot(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z); r.shotD += d; r.shotDn++; }
  }
  return _shoot.call(this, st);
};
const _take = Soldier.prototype.takeDamage;
Soldier.prototype.takeDamage = function (amount, attacker, zone, fromPos, weaponName) {
  if (M && this.alive && !(this.protT > 0) && attacker && attacker !== this && attacker.team !== this.team) {
    const r = rec(attacker);
    if (r) {
      const a = Math.min(amount * (this.dmgTakenMul || 1), this.hp);
      r.dmg += amount;
      if (attacker.stat?.kind === 'gun' && !attacker.veh) { r.hits++; const w = attacker.item?.id || '?'; r.wHits[w] = (r.wHits[w] || 0) + 1; }
      if (attacker.veh) r.hitsVeh++;
    }
    const v = rec(this); if (v) v.dmgTaken += amount;
  }
  return _take.call(this, amount, attacker, zone, fromPos, weaponName);
};

const gini = (a) => { const x = [...a].sort((p, q) => p - q), n = x.length, S = x.reduce((p, q) => p + q, 0); if (!S) return 0; let c = 0; for (let i = 0; i < n; i++) c += (2 * (i + 1) - n - 1) * x[i]; return c / (n * S); };
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

function run(sd) {
  seed = sd * 7919 + 13;
  const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: DIFF, match: { perTeam: +per, type } });
  M = new Map();
  for (const b of g.brains) {
    const s = b.s;
    M.set(s, {
      id: s.id, name: s.name, team: s.team, squad: s.squad, seed: sd, kills: 0, deaths: 0, dmg: 0, dmgTaken: 0, dmgVeh: 0, dmgVehBullet: 0, shots: 0, shotEv: 0, shotsVeh: 0, shotsAtVeh: 0,
      hits: 0, hitsVeh: 0, shotD: 0, shotDn: 0, wShots: {}, wHits: {}, kByW: {}, kVeh: 0, aliveT: 0, tgT: 0, seeT: 0, seeN: 0, sampN: 0, fireT: 0, drvT: 0, gunT: 0, rideT: 0,
      spotT: 0, waitT: 0, stuckT: 0, idleT: 0, swimT: 0, lazyT: 0, walk: 0, foeD: 0, foeN: 0, cls: {}, wpn: {}, role: {}, lives: 0, livesNoTg: 0, firstTg: [], objT: 0, ownObjT: 0, killD: [], deathsSpawn: 0,
      walkGoalT: 0, rideIdleT: 0, _firedStep: 0, vk: {}, _ep: null,
    });
  }
  const born = new Map();
  const onSpawn = (s) => { const r = rec(s); if (!r) return; r.lives++; born.set(s, { t: g.time, tg: null }); };
  g.on('spawn', onSpawn);
  for (const s of g.soldiers) if (s.alive) onSpawn(s);
  const ok0 = g.onKill.bind(g);
  g.onKill = (killer, victim, w, hs) => {
    if (killer && killer !== victim && killer.team !== victim.team) {
      const r = rec(killer);
      if (r) { r.kills++; r.kByW[w || '?'] = (r.kByW[w || '?'] || 0) + 1; if (killer.veh) r.kVeh++; r.killD.push(Math.hypot(killer.pos.x - victim.pos.x, killer.pos.z - victim.pos.z)); }
    }
    const rv = rec(victim);
    if (rv) { rv.deaths++; const b = born.get(victim); if (b) { if (b.tg == null) rv.livesNoTg++; if (g.time - b.t < 6) rv.deathsSpawn++; born.delete(victim); } }
    return ok0(killer, victim, w, hs);
  };
  if (g.vehicles) {
    const V = g.vehicles, dm = V.damage.bind(V);
    V.damage = (v, a, by, kind, name) => { const r = rec(by); if (r && v.alive && V.teamOf(v) !== by.team) { r.dmgVeh += a; if (kind === 'bullet' && !by.veh) r.dmgVehBullet += a; } return dm(v, a, by, kind, name); };
  }
  const dt = 1 / 30, N = +secs * 30;
  const win = new Map(), last = new Map();
  const vA = new (g.soldiers[0].pos.constructor)(), vB = new (g.soldiers[0].pos.constructor)();
  const vis = TUNE.sightDay * (g.map.big ? 1.35 : 1);
  let steps = 0;
  const t0 = performance.now();
  for (; steps < N && !g.ended; steps++) {
    for (const b of g.brains) { const s = b.s; if (s.alive) last.set(s, { x: s.pos.x, z: s.pos.z, vx: s.vel.x, vz: s.vel.z }); }
    g.step(dt);
    const sample = steps % 15 === 0;
    for (const b of g.brains) {
      const s = b.s, r = M.get(s); if (!r) continue;
      const fired = r._firedStep; r._firedStep = 0;
      if (!s.alive) { win.delete(s); continue; }
      r.aliveT += dt;
      r.cls[s.cls] = (r.cls[s.cls] || 0) + dt;
      const pw = s.items?.[0]?.id; if (pw) r.wpn[pw] = (r.wpn[pw] || 0) + dt;
      const ro = b.role || '-'; r.role[ro] = (r.role[ro] || 0) + dt;
      if (b.target) { r.tgT += dt; const bo = born.get(s); if (bo && bo.tg == null) { bo.tg = g.time - bo.t; r.firstTg.push(bo.tg); } }
      if (fired) r.fireT += dt;
      if (s.swim || b.swimming) r.swimT += dt;
      if (g.map.big && !s.veh && !b.target && b.foeD > 260 && g.time - b.alertT > 3) r.lazyT += dt;
      if (s.veh) {
        const role = s.seat === 0 ? 'drv' : mgAt(s.veh.def, s.seat) ? 'gun' : 'ride';
        if (role === 'drv') r.drvT += dt; else if (role === 'gun') r.gunT += dt; else r.rideT += dt;
        const vk = (s.veh.def.heli ? 'heli' : s.veh.def.cannon ? 'tank' : s.veh.def.moto ? 'moto' : 'jip') + ':' + role + (role === 'drv' && b.vd ? ':' + b.vd.state : '');
        r.vk[vk] = (r.vk[vk] || 0) + dt; VK[vk] = (VK[vk] || 0) + dt;
        if (!r._ep || r._ep.v !== s.veh || r._ep.seat !== s.seat) { if (r._ep) EP.push(r._ep); r._ep = { v: s.veh, seat: s.seat, k: vk.split(':').slice(0, 2).join(':'), t: 0, tg: 0, sh: 0 }; }
        r._ep.t += dt; if (b.target) r._ep.tg += dt; if (fired) r._ep.sh++;
        if (!b.target && s.seat !== 0) r.rideIdleT += dt;
      } else {
        if (r._ep) { EP.push(r._ep); r._ep = null; }
        const L = last.get(s);
        if (L) r.walk += Math.hypot(s.pos.x - L.x, s.pos.z - L.z);
        if (b.atSpot || (b.perching && b.goal && Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z) < 2.5)) r.spotT += dt;
        else if (!b.target && b.goal && Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z) < 2.2) r.waitT += dt;
        else if (!b.target) r.walkGoalT += dt;
        const objs = g.mode.objectives;
        if (objs?.length && !g.payload) for (const o of objs) if (Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < o.r) { r.objT += dt; if (o.owner === s.team) r.ownObjT += dt; break; }
        let w = win.get(s); if (!w) win.set(s, (w = { t: 0, x: s.pos.x, z: s.pos.z, mv: 0, n: 0, tg: 0 }));
        w.t += dt; w.n++; if (L && Math.hypot(L.vx, L.vz) > 1.5) w.mv++; if (b.target) w.tg++;
        if (w.t >= 2) {
          const disp = Math.hypot(s.pos.x - w.x, s.pos.z - w.z);
          if (disp < 0.5 && !w.tg) { r.idleT += w.t; if (w.mv > w.n * 0.5) r.stuckT += w.t; }
          win.set(s, { t: 0, x: s.pos.x, z: s.pos.z, mv: 0, n: 0, tg: 0 });
        }
      }
      if (sample) {
        r.sampN++;
        let nd = 1e9, seen = false;
        const eye = s.eye(vA);
        for (const e of g.soldiers) {
          if (!e.alive || e.team === s.team) continue;
          const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z); if (d < nd) nd = d;
          if (!seen && d < vis && g.botSees(eye, e.center(vB))) seen = true;
        }
        if (nd < 1e9) { r.foeD += nd; r.foeN++; }
        if (seen) r.seeN++;
      }
    }
  }
  const simS = steps * dt, ms = performance.now() - t0;
  LASTG = g;
  const recs = [...M.values()].map((r) => { delete r._firedStep; if (r._ep) EP.push(r._ep); delete r._ep; r.simS = simS; return r; });
  M = null;
  return { simS, ms, recs, kills: g.soldiers.reduce((a, s) => a + s.kills, 0), ended: g.ended ? `${g.winner}/${g.endReason}` : '-' };
}

const recs = [], runs = [];
for (let k = 0; k < SEEDS; k++) { const r = run(+seed0 + k); runs.push({ seed: +seed0 + k, simS: r.simS, ms: Math.round(r.ms), kills: r.kills, ended: r.ended }); recs.push(...r.recs); }

// ── özet ──
const avg = (a, f) => (a.length ? a.reduce((p, r) => p + f(r), 0) / a.length : NaN);
const pctT = (r, k) => (100 * r[k]) / Math.max(1e-6, r.aliveT);
for (const r of recs) {
  r.mainCls = top(r.cls); r.mainW = top(r.wpn); r.mainRole = top(r.role);
  r.acc = r.shots ? (100 * r.hits) / r.shots : 0;
  r.seePct = r.sampN ? (100 * r.seeN) / r.sampN : 0; r.foeDavg = r.foeN ? r.foeD / r.foeN : NaN;
  r.kpm = (60 * r.kills) / Math.max(1, r.simS);
  r.ftMed = r.firstTg.length ? [...r.firstTg].sort((a, b) => a - b)[r.firstTg.length >> 1] : NaN;
  delete r.firstTg;
}
const sorted = [...recs].sort((a, b) => a.kills - b.kills || a.dmg - b.dmg), n = sorted.length, q = Math.max(1, Math.round(n * 0.2));
const lo = sorted.slice(0, q), hi = sorted.slice(n - q);
const cols = [
  ['kills', (r) => r.kills], ['deaths', (r) => r.deaths], ['dmg', (r) => r.dmg], ['shots', (r) => r.shots], ['acc%', (r) => r.acc], ['hedef%', (r) => pctT(r, 'tgT')], ['görüş%', (r) => r.seePct],
  ['ateş%', (r) => pctT(r, 'fireT')], ['sürücü%', (r) => pctT(r, 'drvT')], ['nişancı%', (r) => pctT(r, 'gunT')], ['yolcu%', (r) => pctT(r, 'rideT')], ['araçta boş%', (r) => pctT(r, 'rideIdleT')],
  ['mevzi%', (r) => pctT(r, 'spotT')], ['hedefte bekl%', (r) => pctT(r, 'waitT')], ['yürüyüş%', (r) => pctT(r, 'walkGoalT')], ['takılma%', (r) => pctT(r, 'stuckT')], ['duruş%', (r) => pctT(r, 'idleT')],
  ['su%', (r) => pctT(r, 'swimT')], ['seyrek beyin%', (r) => pctT(r, 'lazyT')], ['bayrakta%', (r) => pctT(r, 'objT')], ['yürüdü m/dk', (r) => (60 * r.walk) / Math.max(1, r.aliveT)],
  ['düşman m', (r) => r.foeDavg], ['ilk hedef sn', (r) => r.ftMed], ['hedefsiz ölüm', (r) => r.livesNoTg], ['araca mermi', (r) => r.shotsAtVeh], ['araç hasarı', (r) => r.dmgVeh], ['araçtan leş', (r) => r.kVeh],
];
const tally = (a, f) => { const o = {}; for (const r of a) { const k = f(r); o[k] = (o[k] || 0) + 1; } return Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' · '); };
const K = recs.map((r) => r.kills), totalK = K.reduce((a, b) => a + b, 0), simT = runs.reduce((a, r) => a + r.simS, 0);
const sum = {
  map, type, per: +per, secs: +secs, seeds: SEEDS, diff: DIFF, bots: n, runs,
  killsPerMin: +((60 * totalK) / Math.max(1, simT)).toFixed(2), killsPerBotMin: +((60 * totalK) / Math.max(1, simT) / (n / SEEDS)).toFixed(3),
  gini: +gini(K).toFixed(3), zero: K.filter((k) => k === 0).length, lo20: +avg(lo, (r) => r.kills).toFixed(2), hi20: +avg(hi, (r) => r.kills).toFixed(2), mean: +(totalK / n).toFixed(2),
  loVsHi: Object.fromEntries(cols.map(([k, f]) => [k, [+avg(lo, f).toFixed(1), +avg(hi, f).toFixed(1), +avg(recs, f).toFixed(1)]])),
  loCls: tally(lo, (r) => r.mainCls), hiCls: tally(hi, (r) => r.mainCls), loW: tally(lo, (r) => r.mainW), hiW: tally(hi, (r) => r.mainW), loRole: tally(lo, (r) => r.mainRole), hiRole: tally(hi, (r) => r.mainRole),
};
// sınıf / silah başına (zaman ağırlıklı değil, ana sınıf): bot sayısı, leş ort., isabet
const by = (f) => { const o = {}; for (const r of recs) { const k = f(r); const a = (o[k] ||= { n: 0, k: 0, d: 0, sh: 0, h: 0, t: 0, veh: 0 }); a.n++; a.k += r.kills; a.d += r.deaths; a.sh += r.shots; a.h += r.hits; a.t += r.aliveT; a.veh += r.drvT + r.gunT + r.rideT; } return Object.fromEntries(Object.entries(o).sort((x, y) => y[1].n - x[1].n).map(([k, a]) => [k, `n${a.n} leş ${(a.k / a.n).toFixed(1)} ölüm ${(a.d / a.n).toFixed(1)} isabet %${((100 * a.h) / Math.max(1, a.sh)).toFixed(1)} araçta %${((100 * a.veh) / Math.max(1, a.t)).toFixed(0)}`])); };
sum.byCls = by((r) => r.mainCls); sum.byW = by((r) => r.mainW); sum.byRole = by((r) => r.mainRole);
// silah başına (atış anındaki silah) isabet
const ws = {}, wh = {}; for (const r of recs) { for (const [w, v] of Object.entries(r.wShots)) ws[w] = (ws[w] || 0) + v; for (const [w, v] of Object.entries(r.wHits)) wh[w] = (wh[w] || 0) + v; }
sum.wAcc = Object.fromEntries(Object.entries(ws).sort((a, b) => b[1] - a[1]).map(([w, v]) => [w, `${v} atış %${((100 * (wh[w] || 0)) / v).toFixed(1)}`]));
// araç: tür:koltuk(:sürücü durumu) bot-sn · binme bölümleri (tür:koltuk → adet, ort. sn, hedefli %, atış yapan bölüm %)
sum.vk = Object.fromEntries(Object.entries(VK).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)]));
{ const o = {}; for (const e of EP) { const a = (o[e.k] ||= { n: 0, t: 0, tg: 0, shot: 0, long: 0 }); a.n++; a.t += e.t; a.tg += e.tg; if (e.sh) a.shot++; if (e.t > 60) a.long++; }
  sum.ep = Object.fromEntries(Object.entries(o).map(([k, a]) => [k, `n${a.n} ort ${(a.t / a.n).toFixed(1)} sn · hedefli %${((100 * a.tg) / Math.max(1e-6, a.t)).toFixed(0)} · ateşli bölüm %${((100 * a.shot) / a.n).toFixed(0)} · >60 sn ${a.long}`])); }
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ sum, recs }));
if (!process.env.QUIET) {
  console.log(`${map} ${type} ${per}v${per} ${secs} sn × ${SEEDS} · bot ${n} · leş/dk ${sum.killsPerMin} (bot başına ${sum.killsPerBotMin}) · Gini ${sum.gini} · 0 leş ${sum.zero} · alt %20 ort ${sum.lo20} · üst %20 ort ${sum.hi20} · ort ${sum.mean}`);
  console.log('ölçüt'.padEnd(16), 'alt%20'.padStart(8), 'üst%20'.padStart(8), 'hepsi'.padStart(8));
  for (const [k, v] of Object.entries(sum.loVsHi)) console.log(k.padEnd(16), ...v.map((x) => String(x).padStart(8)));
  for (const k of ['loCls', 'hiCls', 'loW', 'hiW', 'loRole', 'hiRole']) console.log(k.padEnd(8), sum[k]);
  for (const k of ['byCls', 'byRole', 'byW', 'wAcc', 'vk', 'ep']) { console.log(k); for (const [a, b] of Object.entries(sum[k])) console.log('   ', a.padEnd(12), b); }
  if (process.env.VBS) console.log('vbStats', JSON.stringify(LASTG?.vbStats?.exit), JSON.stringify(LASTG?.vbStats?.trips?.slice(-30)));
  console.log('koşular', JSON.stringify(runs));
}
