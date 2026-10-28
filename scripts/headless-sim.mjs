// Başsız (headless) oyun testi — tarayıcı yok: node scripts/headless-sim.mjs [harita=kasaba] [NvN=10] [saniye=240]
// Game'i opts.headless ile kurar, botları saniyede 30 adımla oynatır, özet basar. Hata sayısı 0 olmalı.
import { Game } from '../src/game/game.js';
import { MAPS } from '../src/maps/index.js';
import { VT } from '../src/sim/vehicle.js';
const type = process.env.TYPE || MAPS[process.argv[2] || 'kasaba']?.only?.[0] || 'conquest';          // moda özel haritalar (Boya Kulesi: pb, New York: inf) kendi modlarıyla

const map = process.argv[2] || 'kasaba';
const per = +(process.argv[3] || 10);
const secs = +(process.argv[4] || 240);

const t0 = performance.now();
const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type } });
const tBuild = performance.now() - t0;

let errors = 0, flagEvents = 0;
game.on('flag', () => flagEvents++);
// 12.200 araç ölçümü (araçlı haritada): tank ölümü, tank başına leş, araçtan leş oranı, tankı ne öldürdü, tanka isabet eden tanksavar
const VS = game.vehicles ? { kills: 0, vehKills: 0, vwKills: 0, vwBy: {}, tankKills: 0, jeepKills: 0, heliKills: 0, tankLives: 0, tankDeaths: 0, booms: 0, tankBy: {}, tankHits: {}, atShots: 0, board: [] } : null;
if (VS) {
  const V = game.vehicles, ok0 = game.onKill.bind(game);
  const VW = new Set(); for (const d of Object.values(VT)) for (const n of [d.name, d.cannon?.name, d.mg?.name, d.nose?.name, d.rockets?.name, d.atgm?.name]) if (n) VW.add(n);      // 12.213 tanksavar füzesi      // araç silahı adları (türden bağımsız)
  for (const v of V.list) if (v.alive) { v._sT = 0; if (v.def.cannon) VS.tankLives++; }
  game.onKill = (killer, victim, w, hs) => {
    if (killer && killer !== victim && VW.has(w)) { VS.vwKills++; VS.vwBy[w] = (VS.vwBy[w] || 0) + 1; }
    if (killer && killer !== victim) { VS.kills++; const v = killer.veh; if (v) { VS.vehKills++; if (v.def.cannon) VS.tankKills++; else if (v.def.heli) VS.heliKills++; else VS.jeepKills++; } }
    return ok0(killer, victim, w, hs);
  };
  game.on('vehspawn', (v) => { if (v.def.cannon) VS.tankLives++; v._sT = game.time; });
  game.on('vehenter', ({ v, seat }) => { if (seat === 0 && v._sT != null && v.spawnN && !v._b) { v._b = 1; VS.board.push(game.time - v._sT); } });
  const d0 = V.destroy.bind(V);
  V.destroy = (v, killer, quiet, name) => { if (v.alive && !quiet) { VS.booms++; if (v.def.cannon) { VS.tankDeaths++; const k = name || (killer?.veh ? (killer.veh.def.cannon ? 'Tank topu' : killer.veh.def.name) : killer ? WN(killer) : 'yanma/çarpma'); VS.tankBy[k] = (VS.tankBy[k] || 0) + 1; } } v._b = 0; return d0(v, killer, quiet, name); };
  const WN = (s) => s.items?.[2]?.id && (s.items[2].id === 'rpg' || s.items[2].id === 'm79') ? s.items[2].id : 'diğer';
  const dm = V.damage.bind(V);
  V.damage = (v, a, by, kind, name) => { if (v.def.cannon && v.alive && by && by.team !== V.teamOf(v) && kind !== 'impact') { const k = `${name || kind}`; VS.tankHits[k] = (VS.tankHits[k] || 0) + 1; } return dm(v, a, by, kind, name); };
  const sr = game.spawnRocket.bind(game);
  game.spawnRocket = (o, ...a) => { if (!o.veh) VS.atShots++; return sr(o, ...a); };
}
const dt = 1 / 30;
const s0 = performance.now();
let steps = 0;
try {
  for (; steps < secs * 30 && !game.ended; steps++) {
    game.step(dt);
    if (VS && steps % 30 === 0) for (const v of game.vehicles.list) if (v.def.fixed && v.seats[0]) { VS.empUp = (VS.empUp || 0) + 1; (VS.empBy ||= {})[v.type] = (VS.empBy[v.type] || 0) + 1; }      // 12.213 yuva-sn (kullanılan)
    if (VS && steps % 30 === 0) for (const v of game.vehicles.list) if (v.def.cannon && v.alive) { VS.tankUp = (VS.tankUp || 0) + 1; if (v.seats[0]) VS.tankDrv = (VS.tankDrv || 0) + 1; }      // tank-sn: sahada / sürücülü
  }
} catch (e) { errors++; console.log('HATA:', e.stack); }
const ms = performance.now() - s0;

const S = game.soldiers;
const bad = S.filter((s) => !Number.isFinite(s.pos.x + s.pos.y + s.pos.z) || s.pos.y < -5);
console.log(`harita: ${game.map.name} · ${per}v${per} · kurulum ${tBuild.toFixed(0)} ms`);
console.log(`simülasyon: ${(steps * dt).toFixed(0)} sn · adım ${(ms / steps).toFixed(2)} ms · biten: ${game.ended ? game.winner + ' (' + game.endReason + ')' : 'hayır'}`);
console.log(`biletler: mavi ${Math.round(game.tickets.blue)} / kırmızı ${Math.round(game.tickets.red)} · hayatta ${S.filter((s) => s.alive).length}/${S.length} · bayrak değişimi ${flagEvents}`);
console.log('hedefler: ' + game.mode.objectives.map((o) => `${o.name}:${o.owner || '-'}`).join(', '));
console.log(`öldürme toplamı ${S.reduce((a, s) => a + s.kills, 0)} · geçersiz/yeraltı: ${bad.length}`);
if (VS) {
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  console.log(`araçlar: tank doğuşu ${VS.tankLives} · tank ölümü ${VS.tankDeaths} · tank leşi ${VS.tankKills} (tank ömrü başına ${(VS.tankKills / Math.max(1, VS.tankLives)).toFixed(1)}) · jip ${VS.jeepKills} · helikopter ${VS.heliKills} · araçtan leş %${Math.round(100 * VS.vehKills / Math.max(1, VS.kills))} (araç silahıyla %${Math.round(100 * VS.vwKills / Math.max(1, VS.kills))} ${JSON.stringify(VS.vwBy)}) · patlayan araç ${VS.booms} · tank-sn sahada ${VS.tankUp || 0} / sürücülü ${VS.tankDrv || 0}`);
  if (game.vehicles.list.some((v) => v.def.fixed)) console.log(`sabit yuvalar: ${game.vehicles.list.filter((v) => v.def.fixed).length} · kullanılan yuva-sn ${VS.empUp || 0} ${JSON.stringify(VS.empBy || {})} · patlayan yuva ${game.vehicles.list.filter((v) => v.def.fixed && (v.spawnN || 0) > 1).length}`);      // 12.213
  console.log(`tankı öldüren: ${JSON.stringify(VS.tankBy)} · tanka düşman isabeti: ${JSON.stringify(VS.tankHits)} · piyade RPG atışı ${VS.atShots} · ilk binişe dek (doğuştan, medyan) ${med(VS.board).toFixed?.(1)} sn`);
  if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify({ ...VS, flags: flagEvents, total: S.reduce((a, s) => a + s.kills, 0) }));
}
const ok = errors === 0 && bad.length === 0 && (type !== 'conquest' || flagEvents > 0);
console.log(ok ? 'sonuç: OK' : 'sonuç: HATA');
process.exit(ok ? 0 : 1);
