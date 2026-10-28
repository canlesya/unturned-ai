// 12.203 Ölçek ölçümü (başsız): node scripts/scalesim.mjs [harita=kuzey] [NvN=64] [saniye=180] [tohum=1]
// Ölçer: adım süresi (ort / p95 / p99 / en çok, µs), bölüm bölüm maliyet (bot beyni, asker güncelleme + hareket, araçlar, mermiler, mangal görevi,
// doğuş, mod), yol bulma sayısı / süresi / bekleyen bot, bot görüşü (botSees) çağrısı, öldürme konumları (ısı haritası / entropi), doğuş QA'sı
// (aynı anda doğanların iç içe geçmesi < 0,7 m, doğuş öldürmesi ≤ 6 sn ≤ 25 m, doğuş noktası nav dışı / bina içi), snapshot boyutu (sunucu biçimi:
// hepsi + ilgi alanı ile istemci başına).
// Ortam: OUT=dosya.json (özet + öldürme konumları) · PROF=0 (bölüm ölçümü kapalı) · TYPE=conquest
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';
import { LIMITS } from '../src/game/balance.js';
import { BotBrain } from '../src/game/bot.js';
import { NavGrid } from '../src/game/nav.js';
import { packSoldier } from '../src/net/protocol.js';
let interestPick = null;
try { ({ interestPick } = await import('../src/net/interest.js')); } catch { /* önce sürümü: ilgi alanı yok */ }
import fs from 'node:fs';
import zlib from 'node:zlib';

const map = process.argv[2] || 'kuzey';
const per = +(process.argv[3] || 64);
const secs = +(process.argv[4] || 180);
const sd = +(process.argv[5] || 1);
const type = process.env.TYPE || MAPS[map]?.only?.[0] || 'conquest';
const PROF = process.env.PROF !== '0';
LIMITS.maxPerTeam = Math.max(LIMITS.maxPerTeam, per);                       // önce sürümünde sınır 32: ölçüm için açılır

let seed = sd * 7919 + 13;
for (let k = 0; k < 3; k++) { seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b) >>> 0; seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35) >>> 0; seed = (seed ^ (seed >>> 16)) >>> 0; }
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const now = () => performance.now();
const prof = {};
const wrap = (obj, name, key = name) => {
  const f = obj[name]; if (typeof f !== 'function') return;
  const P = (prof[key] ||= { n: 0, ms: 0 });
  obj[name] = function (...a) { const t = now(); try { return f.apply(this, a); } finally { P.n++; P.ms += now() - t; } };
};
if (PROF) { wrap(BotBrain.prototype, 'update', 'brain'); wrap(NavGrid.prototype, 'findPath', 'path'); }

const t0 = now();
const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: Math.max(secs + 60, 900) } });
const tBuild = now() - t0;
if (PROF) {
  wrap(game, 'botSees', 'botSees');
  wrap(game, 'assignSquads', 'squads');
  wrap(game, 'respawn', 'respawn');
  wrap(game, 'updateMode', 'mode');
  wrap(game, 'updateProjectiles', 'proj');
  if (game.vehicles) wrap(game.vehicles, 'update', 'veh');
  wrap(game.world, 'move', 'move');
  for (const s of game.soldiers) wrap(s, 'update', 'soldier');
}
const S = game.soldiers;
const kills = [];
const ok0 = game.onKill.bind(game);
game.onKill = (killer, victim, w, hs) => {
  if (killer && killer !== victim) kills.push([+victim.pos.x.toFixed(1), +victim.pos.z.toFixed(1), victim.team, +game.time.toFixed(1), killer.veh ? 1 : 0, +(game.time - (victim._spawnAt ?? -99)).toFixed(1), victim._spawnD != null && Math.hypot(victim.pos.x - victim._spX, victim.pos.z - victim._spZ) < 25 ? 1 : 0]);
  return ok0(killer, victim, w, hs);
};
// doğuş QA: her doğuşta konum, aynı 0,5 sn'de doğan diğerleriyle ve canlı askerlerle mesafe, nav / bina içi
const spawnQA = { n: 0, overlap: 0, blocked: 0, indoor: 0, forward: 0, minD: [], seen: 0 };
const rs0 = game.respawn.bind(game);
game.respawn = (s, first) => {
  const r = rs0(s, first);
  s._spawnAt = game.time; s._spX = s.pos.x; s._spZ = s.pos.z; s._spawnD = 1;
  spawnQA.n++;
  let md = 1e9;
  for (const e of S) if (e !== s && e.alive && !e.veh) md = Math.min(md, Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z));
  if (md < 0.7) spawnQA.overlap++;
  spawnQA.minD.push(md);
  if (!game.nav.isFree(s.pos.x, s.pos.z)) spawnQA.blocked++;
  // bina içi / üstü kapalı: başın 1,6–14 m üstünde 0,3 m içinde kutu (çatı / kat / sundurma); araç hariç. (Kot farkı ölçüt değil: Baraj bayrağı tabliyede, 24 m)
  { const W = game.world, L = W.query(s.pos.x - 0.6, s.pos.z - 0.6, s.pos.x + 0.6, s.pos.z + 0.6, []);
    if (L.some((c) => c.tag !== 'veh' && s.pos.x > c.min[0] - 0.3 && s.pos.x < c.max[0] + 0.3 && s.pos.z > c.min[2] - 0.3 && s.pos.z < c.max[2] + 0.3 && c.min[1] > s.pos.y + 1.6 && c.min[1] < s.pos.y + 14)) { spawnQA.indoor++; spawnQA.indoorAt = (spawnQA.indoorAt || []).concat([[+s.pos.x.toFixed(1), +s.pos.z.toFixed(1)]]).slice(-6); } }
  return r;
};

const dt = 1 / 60;                                                            // sunucu adımı (SIM_HZ 60)
const steps = [], snapAll = [], snapIm = [], snapAllZ = [], snapImZ = [];
let errors = 0, n = 0, pathWait = 0, pathWaitN = 0;
const deflate = (str) => zlib.deflateRawSync(Buffer.from(str), { level: 1 }).length;
const s0 = now();
try {
  for (; n < secs * 60 && !game.ended; n++) {
    const t = now();
    game.step(dt);
    steps.push((now() - t) * 1000);
    if (n % 60 === 30) {                                                      // yol bekleyen bot (hedefi var, yolu yok)
      for (const b of game.brains) if (b.s.alive && !b.s.veh && b.goal && !b.path) pathWait++;
      pathWaitN++;
    }
    if (n % 300 === 150) {                                                    // snapshot boyutu: hepsi (eski) + ilgi alanı (game.snapPlan varsa, ilk insan yerine 1. Mavi asker)
      const all = JSON.stringify(S.map((s) => packSoldier(s, false)));
      snapAll.push(all.length); snapAllZ.push(deflate(all));
      if (interestPick) {                                                     // sunucunun kuralı (src/net/interest.js), 1. Mavi askerin gözünden; 4 ardışık snapshot ortalaması
        const me = S[0], ids = interestPick(S, me, (n / 3) | 0);
        const part = JSON.stringify(ids.map((i) => packSoldier(S[i], false)));
        snapIm.push(part.length); snapImZ.push(deflate(part));
      }
    }
  }
} catch (e) { errors++; console.log('HATA:', e.stack); }
const wall = now() - s0;
const sorted = [...steps].sort((a, b) => a - b), q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
// çatışma dağılımı: 50 m ızgara + harita bölgeleri (callout: en yakın, r içinde; yoksa en yakın bayrak)
const G = 50, cells = new Map();
for (const k of kills) { const key = Math.floor(k[0] / G) + ',' + Math.floor(k[1] / G); cells.set(key, (cells.get(key) || 0) + 1); }
const ent = (m) => { let H = 0, N = 0; for (const v of m.values()) N += v; for (const v of m.values()) { const p = v / N; H -= p * Math.log2(p); } return H; };
const regs = new Map();
const objs = game.mode.objectives, calls = game.map.callouts || [];
// bölge: harita adlandırmalarından (callout; bayrak bölgeleri dahil: Kavşak = C) uzaklık / yarıçap oranı en küçük olan; hiçbirinin 1,6 katı içinde değilse
// açık arazi ('arazi x,z', 200 m ızgara). Adlandırma yoksa en yakın bayrak (r + 40 m içinde).
const regionOf = (x, z) => {
  let best = null, bd = 1e9;
  if (calls.length) {
    for (const c of calls) { const d = Math.hypot(c.x - x, c.z - z) / Math.max(30, c.r || 60); if (d < bd) { bd = d; best = c.name; } }
    return bd <= 1.6 ? best : `arazi ${Math.floor(x / 200)},${Math.floor(z / 200)}`;
  }
  for (const o of objs) { const d = Math.hypot(o.x - x, o.z - z); if (d < o.r + 40 && d < bd) { bd = d; best = 'bayrak ' + o.id; } }
  return best || `arazi ${Math.floor(x / 200)},${Math.floor(z / 200)}`;
};
for (const k of kills) { const r = regionOf(k[0], k[1]); regs.set(r, (regs.get(r) || 0) + 1); }
const regList = [...regs.entries()].sort((a, b) => b[1] - a[1]);
const nk = kills.length;
const top = regList.slice(0, 3).reduce((a, r) => a + r[1], 0) / Math.max(1, nk);
const regions5 = regList.filter((r) => r[1] / Math.max(1, nk) >= 0.05).length;
// zaman pencereleri (60 sn): o dakikanın en çok öldürme olan bölgesi (çatışma yeri değişiyor mu)
const winTop = [];
for (let w = 0; w * 60 < secs; w++) {
  const m = new Map();
  for (const k of kills) if (k[3] >= w * 60 && k[3] < (w + 1) * 60) { const r = regionOf(k[0], k[1]); m.set(r, (m.get(r) || 0) + 1); }
  const b = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  winTop.push(b ? b[0] : '-');
}
const spawnKill = kills.filter((k) => k[5] <= 6 && k[6]).length;
const res = {
  map: game.map.name, per, secs: +(n * dt).toFixed(0), seed: sd, build: Math.round(tBuild), bots: game.brains.length,
  stepUs: { avg: Math.round(avg(steps)), p50: Math.round(q(0.5)), p95: Math.round(q(0.95)), p99: Math.round(q(0.99)), max: Math.round(sorted[sorted.length - 1] || 0) },
  realtime: +((n * dt * 1000) / wall).toFixed(2),
  prof: Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, { n: v.n, usPerStep: Math.round((v.ms * 1000) / Math.max(1, n)), usEach: +((v.ms * 1000) / Math.max(1, v.n)).toFixed(1) }])),
  pathWaitAvg: +(pathWait / Math.max(1, pathWaitN)).toFixed(1),
  kills: nk, kpm: +(nk / (n * dt / 60)).toFixed(1), vehKillPct: +(kills.filter((k) => k[4]).length / Math.max(1, nk) * 100).toFixed(0),
  dist: { cells50: cells.size, entropy50: +ent(cells).toFixed(2), regions: regs.size, regionEntropy: +ent(regs).toFixed(2), regions5, top3Pct: +(top * 100).toFixed(0), topRegions: regList.slice(0, 8), winTop },
  spawn: { n: spawnQA.n, overlap: spawnQA.overlap, blocked: spawnQA.blocked, indoor: spawnQA.indoor, indoorAt: spawnQA.indoorAt, minDMed: +([...spawnQA.minD].sort((a, b) => a - b)[spawnQA.minD.length >> 1] || 0).toFixed(1), spawnKill, spawnKillPct: +(spawnKill / Math.max(1, nk) * 100).toFixed(1) },
  snap: { allB: Math.round(avg(snapAll)), allZ: Math.round(avg(snapAllZ)), imB: Math.round(avg(snapIm)), imZ: Math.round(avg(snapImZ)), allKBs: +(avg(snapAllZ) * 20 / 1024).toFixed(1), imKBs: snapImZ.length ? +(avg(snapImZ) * 20 / 1024).toFixed(1) : null },
  tickets: { blue: Math.round(game.tickets.blue), red: Math.round(game.tickets.red) },
  owners: objs.map((o) => `${o.id}:${o.owner ? o.owner[0] : '-'}`).join(' '),
  bad: S.filter((s) => !Number.isFinite(s.pos.x + s.pos.y + s.pos.z) || s.pos.y < -5).length, errors,
};
console.log(JSON.stringify(res));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ ...res, killPos: kills, objs: objs.map((o) => ({ id: o.id, name: o.name, x: o.x, z: o.z, r: o.r })), bounds: game.map.playArea || game.map.bounds }));
process.exit(errors || res.bad ? 1 : 0);
