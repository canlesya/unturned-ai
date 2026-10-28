// 12.208 savunma / taktik ölçümü (başsız): node scripts/defsim.mjs [harita=kuzey] [NvN=10] [saniye=300] [tohum=1]
// Önce / sonra aynı betikle (eski ağaca kopyalanıp) koşulur. Ölçer:
//  · ele geçirilmiş bayrakta savunan (bayrak sahibinin r + 30 m içinde canlı yaya askeri) ortalaması + boş bayrak oranı
//  · bayrak değişimi, heli saldırı turu (vbStats.strikes), tankı öldüren (RPG / C4 / mayın / LAW / tank topu …)
//  · kalabalık: 1 sn'de bir canlı yaya askerlerin 50 m hücre sayımı → en kalabalık hücrenin zirvesi + ortalaması
//  · çatışma dağılımı (scalesim ile aynı bölge kuralı): en kanlı 3 bölgenin payı, ≥ %5 öldürmeli bölge sayısı, 50 m entropi, doğuş öldürmesi
// OUT=dosya.json
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';
import { LIMITS } from '../src/game/balance.js';
import fs from 'node:fs';

const map = process.argv[2] || 'kuzey', per = +(process.argv[3] || 10), secs = +(process.argv[4] || 300), sd = +(process.argv[5] || 1);
const type = process.env.TYPE || MAPS[map]?.only?.[0] || 'conquest';
LIMITS.maxPerTeam = Math.max(LIMITS.maxPerTeam, per);
let seed = sd * 7919 + 13;
for (let k = 0; k < 3; k++) { seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b) >>> 0; seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35) >>> 0; seed = (seed ^ (seed >>> 16)) >>> 0; }
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: Math.max(secs + 60, 900) } });
const S = game.soldiers, objs = game.mode.objectives;
let flags = 0; game.on('flag', () => flags++);
const kills = [];
const ok0 = game.onKill.bind(game);
game.onKill = (killer, victim, w, hs) => {
  if (killer && killer !== victim) kills.push([victim.pos.x, victim.pos.z, game.time, game.time - (victim._spawnAt ?? -99) <= 6 && Math.hypot(victim.pos.x - victim._spX, victim.pos.z - victim._spZ) < 25 ? 1 : 0, killer.veh?.def?.cannon && !victim.veh ? 1 : 0]);
  return ok0(killer, victim, w, hs);
};
const rs0 = game.respawn.bind(game);
game.respawn = (s, first) => { const r = rs0(s, first); s._spawnAt = game.time; s._spX = s.pos.x; s._spZ = s.pos.z; return r; };
const tankBy = {}, V = game.vehicles;
let tankMin = 0;
if (V) {
  const d0 = V.destroy.bind(V);
  V.destroy = (v, killer, quiet, name) => { if (v.alive && !quiet && v.def.cannon) { const k = name || (killer?.veh ? (killer.veh.def.cannon ? 'Tank topu' : killer.veh.def.name) : 'diğer'); tankBy[k] = (tankBy[k] || 0) + 1; } return d0(v, killer, quiet, name); };
}
const DEF = { n: 0, k: 0, empty: 0 }, dens = { peak: 0, sum: 0, k: 0 };
const dt = 1 / 30;
let n = 0, errors = 0;
const t0 = performance.now();
try {
  for (; n < secs * 30 && !game.ended; n++) {
    game.step(dt);
    if (n % 30 !== 0) continue;
    for (const o of objs) if (o.owner) { let c = 0; for (const s of S) if (s.alive && !s.veh && s.team === o.owner && Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r + 30) c++; DEF.n += c; DEF.k++; if (!c) DEF.empty++; }
    const C = new Map(); let mx = 0;
    for (const s of S) if (s.alive && !s.veh) { const key = Math.floor(s.pos.x / 50) * 100000 + Math.floor(s.pos.z / 50); const c = (C.get(key) || 0) + 1; C.set(key, c); if (c > mx) mx = c; }
    if (n > 30 * 60) { dens.peak = Math.max(dens.peak, mx); dens.sum += mx; dens.k++; }      // ilk dakika (üsten çıkış) hariç
    if (V) for (const v of V.list) if (v.def.cannon && v.alive && v.seats[0]) tankMin += 1 / 60;
  }
} catch (e) { errors++; console.log('HATA:', e.stack); }
const calls = game.map.callouts || [];
const regionOf = (x, z) => {
  let best = null, bd = 1e9;
  if (calls.length) { for (const c of calls) { const d = Math.hypot(c.x - x, c.z - z) / Math.max(30, c.r || 60); if (d < bd) { bd = d; best = c.name; } } return bd <= 1.6 ? best : `arazi ${Math.floor(x / 200)},${Math.floor(z / 200)}`; }
  for (const o of objs) { const d = Math.hypot(o.x - x, o.z - z); if (d < o.r + 40 && d < bd) { bd = d; best = 'bayrak ' + o.id; } }
  return best || `arazi ${Math.floor(x / 200)},${Math.floor(z / 200)}`;
};
const regs = new Map(), cells = new Map();
for (const k of kills) { const r = regionOf(k[0], k[1]); regs.set(r, (regs.get(r) || 0) + 1); const c = Math.floor(k[0] / 50) + ',' + Math.floor(k[1] / 50); cells.set(c, (cells.get(c) || 0) + 1); }
const ent = (m) => { let H = 0, N = 0; for (const v of m.values()) N += v; for (const v of m.values()) { const p = v / N; H -= p * Math.log2(p); } return H; };
const RL = [...regs.entries()].sort((a, b) => b[1] - a[1]), nk = kills.length;
const vb = game.vbStats || {}, bs = game.bigStats || {};
const res = {
  map, per, secs: Math.round(n * dt), seed: sd, wallS: Math.round((performance.now() - t0) / 1000), errors,
  defAvg: +(DEF.n / Math.max(1, DEF.k)).toFixed(2), emptyPct: Math.round(100 * DEF.empty / Math.max(1, DEF.k)), flags,
  strikes: vb.strikes || 0, evade: vb.evade || 0, tankPost: vb.tankPost || 0, tankEsc: vb.tankEsc || 0, respond: bs.respond || 0, redirect: bs.redirect || 0,
  tankBy, tankCannonInfKills: kills.filter((k) => k[4]).length, tankMin: +tankMin.toFixed(1),
  densPeak: dens.peak, densAvg: +(dens.sum / Math.max(1, dens.k)).toFixed(1),
  kills: nk, top3Pct: Math.round(100 * RL.slice(0, 3).reduce((a, r) => a + r[1], 0) / Math.max(1, nk)), regions5: RL.filter((r) => r[1] / Math.max(1, nk) >= 0.05).length, regions: regs.size,
  entropy50: +ent(cells).toFixed(2), spawnKillPct: +(100 * kills.filter((k) => k[3]).length / Math.max(1, nk)).toFixed(1), topRegions: RL.slice(0, 5),
};
console.log(JSON.stringify(res));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(res));
process.exit(errors ? 1 : 0);
