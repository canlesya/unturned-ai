// Mod dengesi ölçümü (başsız, tohumlu; 12.197): node scripts/modebal.mjs <mod> <harita> [NvN|toplam] [tohum sayısı=6] [ilk tohum=1]
// Ortam: TIME=sn (maç süresi; varsayılan modunki), DIFF=normal, CAP=sn (sim üst sınırı; varsayılan süre+120), JSON=1 (her maç bir satır), TUNE_x=değer / LIM_x=değer (deneme)
// Her maçta: kazanan + gerekçe + süre, takım öldürme, son skor / bilet, liderlik değişimi / en büyük fark / geri dönüş, doğuş öldürmesi (doğduktan ≤ 3 sn), kendi doğuşu
// yakınında (≤ 15 m) ölüm, koruma altında yenen hasar engellendi mi; herkes-tek: lider / ikinci / ortanca öldürme; silah yarışı: bıçak düşürmesi, son seviye süresi;
// vagon: ilerleme, kontrol noktası zamanı; cephe: kayma sayısı, son etkin nokta. Özet satırı: kazanma yüzdeleri + ortalamalar.
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
let seed = 1;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
Math.random = rng;
const { Game } = await import('../src/game/game.js');
const { TUNE, LIMITS } = await import('../src/game/balance.js');
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('TUNE_')) TUNE[k.slice(5)] = +v;
  if (k.startsWith('LIM_')) LIMITS[k.slice(4)] = +v;
}
const [type = 'tdm', map = 'kasaba', perA, nA = '6', s0A = '1'] = process.argv.slice(2);
const PER0 = { conquest: 8, tdm: 6, dm: 8, gg: 8, pb: 8, payload: 6, space: 6, front: 12 };
const per = +(perA || PER0[type] || 6), N = +nA, S0 = +s0A;
const diff = process.env.DIFF || 'normal';
const KPOS = process.env.KPOS ? [] : null;                      // KPOS=dosya: öldüren / ölen konumları JSON
import { writeFileSync } from 'node:fs';

function run(sd) {
  seed = sd * 7919 + 13; for (let k = 0; k < 3; k++) { seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b) >>> 0; seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35) >>> 0; seed = (seed ^ (seed >>> 16)) >>> 0; }   // karıştır: ardışık tohumların LCG akışları birbirine bağlı olmasın
  const match = { perTeam: per, type };
  if (process.env.TIME) match.time = +process.env.TIME;
  const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff, match });
  if (process.env.SWAP && !g.ffa) {                                   // SWAP=1: iki takımın doğuşu / üs bölgesi yer değiştirir (taraf mı, takım kodu mu?)
    const m = g.map; [m.spawns.blue, m.spawns.red] = [m.spawns.red, m.spawns.blue];
    if (m.baseZones) [m.baseZones.blue, m.baseZones.red] = [m.baseZones.red, m.baseZones.blue];
    for (const s of g.soldiers) if (s.alive) g.respawn(s, true);
  }
  if (process.env.FLAGS) { const F = JSON.parse(process.env.FLAGS); for (const o of g.mode.objectives) if (F[o.id]) { o.x = F[o.id][0]; o.z = F[o.id][1]; if (F[o.id][2]) o.r = F[o.id][2]; o._cells = undefined; } }   // FLAGS='{"id":[x,z,r?]}' bayrak konumu denemesi
  if (process.env.REV) g.brains.reverse();                            // REV=1: bot beyinlerinin işlem sırası ters (sıra yanlılığı denemesi)
  const cap = +(process.env.CAP || ((g.timeLeft === Infinity ? 1500 : g.timeLeft) + 400));
  const born = new Map(), home = {};
  for (const t of ['blue', 'red']) home[t] = (g.map.spawns[t] || []).slice();
  const R = { seed: sd, map, type, per, kills: { blue: 0, red: 0 }, deaths: 0, spawnD3: 0, spawnKill: 0, nearSpawnD: 0, tk: 0, leadCh: 0, maxLead: { blue: 0, red: 0 }, protHits: 0, ggKnifeDemote: 0, ggLast: null, ggLvlT: [], cpT: [], shifts: [], lives: [] };
  const bornP = new Map();
  g.on('spawn', (s) => { born.set(s, g.time); bornP.set(s, { x: s.pos.x, z: s.pos.z }); });
  for (const s of g.soldiers) if (s.alive) { born.set(s, g.time); bornP.set(s, { x: s.pos.x, z: s.pos.z }); }
  const onKill = g.onKill.bind(g);
  g.onKill = (killer, victim, w, hs) => {
    R.deaths++;
    const bt = born.get(victim);
    if (bt != null) { const life = g.time - bt; R.lives.push(life); if (life <= 3 && killer && killer !== victim) R.spawnD3++; const bp = bornP.get(victim); if (life <= 6 && killer && killer !== victim && bp && Math.hypot(victim.pos.x - bp.x, victim.pos.z - bp.z) < 12) R.spawnKill++; }
    if (killer && killer !== victim) {
      if (KPOS) KPOS.push([+killer.pos.x.toFixed(1), +killer.pos.z.toFixed(1), +victim.pos.x.toFixed(1), +victim.pos.z.toFixed(1), killer.team, victim.team, +g.time.toFixed(0)]);
      if (!g.ffa && killer.team === victim.team) R.tk++;
      if (!g.ffa && killer.team !== victim.team) R.kills[killer.team]++;
      if (!g.ffa && !g.mode.infection) {
        const hs0 = (g.map.spawns[victim.team] || []).concat(home[victim.team]);
        if (hs0.some((p) => Math.hypot(p.x - victim.pos.x, p.z - victim.pos.z) < 15) && bt != null && g.time - bt > 3) R.nearSpawnD++;
      }
      if (g.mode.gungame && killer.stat?.kind === 'melee' && victim.ggLevel > 0) R.ggKnifeDemote++;
    }
    return onKill(killer, victim, w, hs);
  };
  const _take = Object.getPrototypeOf(g.soldiers[0]).takeDamage;
  let lastLead = 0;
  const dt = 1 / 30;
  let steps = 0, ggReached = null, prevReached = 0, prevA = g.front ? g.front.a : 0;
  for (; steps < cap * 30 && !g.ended; steps++) {
    g.step(dt);
    if (steps % 15) continue;
    if (!g.ffa && !g.mode.infection) {
      let diffv;
      if (g.payload) diffv = 0;
      else if (g.mode.scoreBased) diffv = g.tickets.blue - g.tickets.red;
      else diffv = g.tickets.blue - g.tickets.red;
      const lead = Math.sign(diffv);
      if (lead && lastLead && lead !== lastLead) R.leadCh++;
      if (lead) lastLead = lead;
      if (diffv > R.maxLead.blue) R.maxLead.blue = diffv;
      if (-diffv > R.maxLead.red) R.maxLead.red = -diffv;
    }
    if (g.mode.gungame) {
      const top = Math.max(...g.soldiers.map((s) => s.ggLevel));
      while (R.ggLvlT.length < top) R.ggLvlT.push(+g.time.toFixed(0));
      if (top >= 14 && ggReached == null) ggReached = g.time;
    }
    if (g.payload && g.payload.reached > prevReached) { prevReached = g.payload.reached; R.cpT.push(+g.time.toFixed(0)); }
    if (g.front && g.front.a !== prevA) { R.shifts.push(g.front.a - prevA > 0 ? '+' : '-'); prevA = g.front.a; }
  }
  R.ended = g.ended; R.winner = g.winner || '-'; R.reason = g.endReason || 'bitmedi'; R.dur = +g.time.toFixed(0); R.steps = steps;
  R.tickets = { blue: Math.round(g.tickets.blue), red: Math.round(g.tickets.red) };
  if (g.ffa) {
    const ks = g.soldiers.filter((s) => !s.vacant).map((s) => (g.mode.gungame ? s.ggLevel : s.kills)).sort((a, b) => b - a);
    const kk = g.soldiers.filter((s) => !s.vacant).map((s) => s.kills).sort((a, b) => b - a);
    R.ffa = { top: ks[0], second: ks[1], med: ks[ks.length >> 1], last: ks[ks.length - 1], kTop: kk[0], kSum: kk.reduce((a, b) => a + b, 0) };
    if (g.mode.gungame) R.ggLast = ggReached != null ? +ggReached.toFixed(0) : null;
    const spread = g.soldiers.filter((s) => !s.vacant).map((s) => s.deaths);
    R.ffa.deathMax = Math.max(...spread);
  }
  if (g.payload) R.pl = { prog: Math.round(g.payload.progress * 100), reached: g.payload.reached, over: g.payload.over };
  if (g.front) R.fr = { a: g.front.a, n: g.front.n };
  R.lifeMed = R.lives.length ? +[...R.lives].sort((a, b) => a - b)[R.lives.length >> 1].toFixed(1) : null;
  delete R.lives;
  return R;
}

const out = [];
for (let k = 0; k < N; k++) {
  const r = run(S0 + k); out.push(r);
  if (process.env.JSON) console.log(JSON.stringify(r));
  else console.log(`#${r.seed} ${r.winner.padEnd(4)} ${String(r.dur).padStart(4)}s ${r.reason.slice(0, 48).padEnd(48)} K ${r.kills.blue}/${r.kills.red} T ${r.tickets.blue}/${r.tickets.red} lead± ${r.leadCh} maxL ${r.maxLead.blue}/${r.maxLead.red} spawnD3 ${r.spawnD3}/${r.deaths} sk ${r.spawnKill} nearSp ${r.nearSpawnD}` +
    (r.ffa ? ` ffa top ${r.ffa.top} 2nd ${r.ffa.second} med ${r.ffa.med} last ${r.ffa.last} kSum ${r.ffa.kSum}` : '') + (r.ggLast != null ? ` ggLast@${r.ggLast} knifeDem ${r.ggKnifeDemote}` : r.type === 'gg' ? ` knifeDem ${r.ggKnifeDemote} lvlT ${r.ggLvlT.slice(-3)}` : '') +
    (r.pl ? ` pl ${r.pl.prog}% cp ${r.pl.reached} @${r.cpT.join(',')} over ${r.pl.over}` : '') + (r.fr ? ` fr a=${r.fr.a}/${r.fr.n} ${r.shifts.join('')}` : '') + ` life ${r.lifeMed}`);
}
if (KPOS) writeFileSync(process.env.KPOS, JSON.stringify(KPOS));
const W = (t) => out.filter((r) => r.winner === t).length;
const avg = (f) => out.reduce((a, r) => a + f(r), 0) / out.length;
console.log(`ÖZET ${type} ${map} ${per} · ${N} maç · mavi ${W('blue')} kırmızı ${W('red')} diğer ${N - W('blue') - W('red')} · süre ort ${avg((r) => r.dur).toFixed(0)} sn · bitmeyen ${out.filter((r) => !r.ended).length} · doğuş≤3sn %${(100 * avg((r) => r.spawnD3) / Math.max(1, avg((r) => r.deaths))).toFixed(1)} · doğuş öldürmesi (≤6 sn, ≤12 m) %${(100 * avg((r) => r.spawnKill) / Math.max(1, avg((r) => r.deaths))).toFixed(1)} · doğuş yakını %${(100 * avg((r) => r.nearSpawnD) / Math.max(1, avg((r) => r.deaths))).toFixed(1)} · öldürme ort ${avg((r) => r.deaths).toFixed(0)} · lider değişimi ort ${avg((r) => r.leadCh).toFixed(1)}`);
