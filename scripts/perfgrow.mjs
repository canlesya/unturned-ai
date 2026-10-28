// 12.211 Uzun maç başarımı (başsız): adım süresinin ZAMANLA nasıl değiştiğini ölçer (30 sn'lik pencereler) + bölüm bölüm maliyet + yığın / liste boyları.
//   node scripts/perfgrow.mjs [harita=kuzey] [NvN=128] [saniye=600] [tohum=1]
// Satır başına: pencerenin adım ort / p95 / en çok (ms), bölümler (ms / adım), canlı asker, sürülen araç, mermi / mermi kabuğu, yığın MB.
// Ortam: JSON=1 (son satırda özet JSON) · NET=1 (sunucu snapshot dizme maliyetini de ölç: 2 sahte insan istemci)
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';
import { LIMITS } from '../src/game/balance.js';
import { BotBrain } from '../src/game/bot.js';
import { NavGrid } from '../src/game/nav.js';


const map = process.argv[2] || 'kuzey', per = +(process.argv[3] || 128), secs = +(process.argv[4] || 600), sd = +(process.argv[5] || 1);
const type = process.env.TYPE || MAPS[map]?.only?.[0] || 'conquest';
LIMITS.maxPerTeam = Math.max(LIMITS.maxPerTeam, per);
let seed = sd * 7919 + 13;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const now = () => performance.now();
const prof = {};
const wrap = (obj, name, key = name) => {
  const f = obj?.[name]; if (typeof f !== 'function') return;
  const P = (prof[key] ||= { n: 0, ms: 0, d: 0 });
  obj[name] = function (...a) { if (P.d++) { try { return f.apply(this, a); } finally { P.d--; } } const t = now(); try { return f.apply(this, a); } finally { P.d--; P.n++; P.ms += now() - t; } };
};
wrap(BotBrain.prototype, 'tick', 'brain'); wrap(NavGrid.prototype, 'findPath', 'path');
for (const k of ['sense', 'board', 'rideTick', 'followGoal', 'pickGoal', 'huddle', 'senseNear', 'atAim']) wrap(BotBrain.prototype, k, 'b.' + k);
// beyin süresi bot durumuna göre (CAT=1): sürücü / yolcu / hedefli / uyarılmış / boşta (en yakın düşman ≤ 150 / ≤ 260 / öte)
const cat = {};
if (process.env.CAT) {
  const f = BotBrain.prototype.update;
  BotBrain.prototype.update = function (dt) {
    const s = this.s, g = this.game;
    const k = !s.alive ? 'ölü' : s.veh ? (s.seat === 0 && this.vd ? 'sürücü' : 'yolcu') : this.target ? 'hedefli' : g.time - this.alertT < 3 ? 'uyarılmış' : this.foeD > 260 ? 'boş>260' : this.foeD > 150 ? 'boş150-260' : 'boş<150';
    const t = performance.now(); const r = f.call(this, dt); const C = (cat[k] ||= { n: 0, ms: 0 }); C.n++; C.ms += performance.now() - t; return r;
  };
}
const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: Math.max(secs + 60, 900) } });
wrap(game, 'botSees', 'botSees'); wrap(game, 'losClear', 'losClear'); wrap(game, 'assignSquads', 'squads'); wrap(game, 'respawn', 'respawn');
wrap(game, 'updateMode', 'mode'); wrap(game, 'updateProjectiles', 'proj'); wrap(game, 'updateHumans', 'humans'); wrap(game, 'recordHist', 'hist');
wrap(game, 'shootRay', 'shootRay'); wrap(game, 'fire', 'fire');
if (game.vehicles) { wrap(game.vehicles, 'update', 'veh'); wrap(game.vehicles, 'gunAimFor', 'gunAimFor'); wrap(game.vehicles, 'rocketAimFor', 'rocketAim'); wrap(game.vehicles, 'raycast', 'vehRay'); wrap(game.vehicles, 'pushSoldier', 'pushSoldier'); wrap(game.vehicles, 'place', 'place'); }
wrap(game.world, 'move', 'move'); wrap(game.world, 'raycast', 'worldRay');
if (game.crowd) wrap(game.crowd, 'rebuild', 'crowd');
for (const s of game.soldiers) { wrap(s, 'update', 'soldier'); wrap(s, 'syncModel', 'sync'); }
const S = game.soldiers, dt = 1 / 60, W = 30 * 60;
let win = [], snapP = 0;
const rows = [];
const fmt = (v) => v.toFixed(2);
const snapProf = {};
for (const k of Object.keys(prof)) snapProf[k] = 0;
console.log(`${map} ${per}v${per} ${type}, ${game.brains.length} bot, araç ${game.vehicles?.list.length || 0}`);
for (let n = 0; n < secs * 60 && !game.ended; n++) {
  const t = now(); game.step(dt); win.push(now() - t);
  game.netEvents.length = 0;
  if ((n + 1) % W === 0) {
    const a = [...win].sort((x, y) => x - y), avg = win.reduce((x, y) => x + y, 0) / win.length;
    const sec = {}; for (const [k, v] of Object.entries(prof)) { sec[k] = (v.ms - (snapProf[k] || 0)) / win.length; snapProf[k] = v.ms; }
    const top = Object.entries(sec).filter(([, v]) => v > 0.05).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ');
    const V = game.vehicles, driven = V ? V.list.filter((v) => v.alive && v.seats[0]).length : 0, alive = V ? V.list.filter((v) => v.alive).length : 0;
    const mem = process.memoryUsage().heapUsed / 1048576;
    const r = { t: (n + 1) / 60, avg, p95: a[Math.floor(a.length * 0.95)], max: a[a.length - 1], alive: S.filter((s) => s.alive).length, inVeh: S.filter((s) => s.veh).length, vAlive: alive, driven, proj: game.projectiles?.length || 0, shells: V?.shells?.length || 0, heap: mem, sec,
      paths: game.brains.filter((b) => b.path).length, wait: game.brains.filter((b) => b.s.alive && !b.s.veh && b.goal && !b.path).length, tgt: game.brains.filter((b) => b.target).length };
    rows.push(r);
    console.log(`t=${String(r.t).padStart(4)} ort ${fmt(avg)} p95 ${fmt(r.p95)} en çok ${fmt(r.max)} ms | canlı ${r.alive} araçta ${r.inVeh} araç ${alive}/${driven} sürülen | hedefli ${r.tgt} yol ${r.paths} bekleyen ${r.wait} | mermi ${r.proj} kabuk ${r.shells} | yığın ${mem.toFixed(0)} MB\n    ${top}`);
    if (process.env.CAT) { console.log('    beyin: ' + Object.entries(cat).sort((a, b) => b[1].ms - a[1].ms).map(([k, v]) => `${k} ${(v.ms / win.length).toFixed(2)} ms (${(v.n / win.length).toFixed(0)}/adım, ${(v.ms * 1000 / Math.max(1, v.n)).toFixed(1)} µs)`).join(' · ')); for (const k in cat) delete cat[k]; }
    win = [];
  }
}
if (process.env.JSON) console.log(JSON.stringify(rows));
process.exit(0);
