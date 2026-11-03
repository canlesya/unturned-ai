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
const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: per, type, rounds: +process.env.ROUNDS || undefined } });      // 12.223 ROUNDS=10: Uyku Modu uzun maç
const UYR = [];                                                                                                     // 12.223 Uyku Modu raunt kayıtları
game.on('uyround', (r) => UYR.push(r));
const BMR = [];                                                                                                     // 12.226 Bomba raunt kayıtları
game.on('bmround', (r) => BMR.push(r));
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
const DEF = { n: 0, k: 0, empty: 0 };
const dt = 1 / 30;
const s0 = performance.now();
let steps = 0;
try {
  for (; steps < secs * 30 && !game.ended; steps++) {
    game.step(dt);
    if (VS && steps % 30 === 0) for (const v of game.vehicles.list) if (v.def.fixed && v.seats[0]) { VS.empUp = (VS.empUp || 0) + 1; (VS.empBy ||= {})[v.type] = (VS.empBy[v.type] || 0) + 1; }      // 12.213 yuva-sn (kullanılan)
    if (steps % 30 === 0 && game.mode.objectives.length) {      // 12.208 ele geçirilmiş bayrakta savunan (kendi takımından r + 30 m içinde canlı yaya) ortalaması
      for (const o of game.mode.objectives) if (o.owner) { let n = 0; for (const s of game.soldiers) if (s.alive && !s.veh && s.team === o.owner && Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r + 30) n++; DEF.n += n; DEF.k++; if (!n) DEF.empty++; }
    }
    if (VS && steps % 30 === 0) for (const v of game.vehicles.list) if (!v.def.fixed && v.alive) { VS.vUp = (VS.vUp || 0) + 1; if (v.seats[0]) VS.vDrv = (VS.vDrv || 0) + 1; if (v.seats.some((o) => o && o.brain)) VS.vBot = (VS.vBot || 0) + 1; }      // 12.219 araç-sn (sahada / sürücülü)
    if (steps % 30 === 0) { let n = 0, m = 0; for (const s of game.soldiers) if (s.alive && !s.vacant) { n++; if (s.veh && !s.veh.def.fixed) m++; } DEF.inV = (DEF.inV || 0) + m; DEF.alive = (DEF.alive || 0) + n; }      // 12.219 araçtaki asker payı
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
const KT = S.reduce((a, s) => a + s.kills, 0), simS = steps * dt;
console.log(`öldürme toplamı ${KT} · geçersiz/yeraltı: ${bad.length}`);
console.log(`tempo: ${(KT / (simS / 60)).toFixed(1)} öldürme/dk · maç süresi ${simS.toFixed(0)} sn${game.ended ? '' : ' (bitmedi)'} · askerin araçta olduğu pay %${(100 * (DEF.inV || 0) / Math.max(1, DEF.alive || 0)).toFixed(1)}` + (VS ? ` · araç: ${game.vehicles.list.filter((v) => !v.def.fixed).length} araç + ${game.vehicles.list.filter((v) => v.def.fixed).length} yuva, kullanım (sürücülü araç-sn / sahadaki) %${(100 * (VS.vDrv || 0) / Math.max(1, VS.vUp || 0)).toFixed(1)}` : '') + (game.bigStats?.tdmPhase ? ` · TDM evre ${game.bigStats.tdmPhase}, av ${game.bigStats.tdmHunt || 0}, manga doğuşu ${game.bigStats.tdmMateSpawn || 0}` : ''));
if (VS) {
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  console.log(`araçlar: tank doğuşu ${VS.tankLives} · tank ölümü ${VS.tankDeaths} · tank leşi ${VS.tankKills} (tank ömrü başına ${(VS.tankKills / Math.max(1, VS.tankLives)).toFixed(1)}) · jip ${VS.jeepKills} · helikopter ${VS.heliKills} · araçtan leş %${Math.round(100 * VS.vehKills / Math.max(1, VS.kills))} (araç silahıyla %${Math.round(100 * VS.vwKills / Math.max(1, VS.kills))} ${JSON.stringify(VS.vwBy)}) · patlayan araç ${VS.booms} · tank-sn sahada ${VS.tankUp || 0} / sürücülü ${VS.tankDrv || 0}`);
  if (game.vehicles.list.some((v) => v.def.fixed)) console.log(`sabit yuvalar: ${game.vehicles.list.filter((v) => v.def.fixed).length} · kullanılan yuva-sn ${VS.empUp || 0} ${JSON.stringify(VS.empBy || {})} · patlayan yuva ${game.vehicles.list.filter((v) => v.def.fixed && (v.spawnN || 0) > 1).length}`);      // 12.213
  console.log(`tankı öldüren: ${JSON.stringify(VS.tankBy)} · tanka düşman isabeti: ${JSON.stringify(VS.tankHits)} · piyade RPG atışı ${VS.atShots} · ilk binişe dek (doğuştan, medyan) ${med(VS.board).toFixed?.(1)} sn`);
  if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify({ ...VS, flags: flagEvents, total: S.reduce((a, s) => a + s.kills, 0) }));
}
if (DEF.k) console.log(`savunma: ele geçirilmiş bayrakta ort. ${(DEF.n / DEF.k).toFixed(2)} kendi askeri (r + 30 m) · boş bayrak oranı %${Math.round(100 * DEF.empty / DEF.k)}` + (game.vbStats ? ` · heli saldırı turu ${game.vbStats.strikes || 0} · heli kaçış ${game.vbStats.evade || 0} · tank mevzi ${game.vbStats.tankPost || 0} / eşlik ${game.vbStats.tankEsc || 0}` : '') + (VS ? ` · tanka isabet: ${JSON.stringify(VS.tankHits)}` : ''));
if (game.uyku) {                                                                                                     // 12.223 Uyku Modu özeti
  const U = game.uyku, st = U.stats;
  console.log(`uyku: ${UYR.length} raunt · ${UYR.map((r) => `R${r.n} ${r.w}/${r.why} ${r.t.toFixed(0)}sn (${r.b.up}-${r.r.up})`).join(' · ')}`);
  console.log(`uyku: uyuma ${st.downs} · kaldırma ${st.revives} · elenme ${st.outs} (bitirme ${st.fins}, kanama ${st.bleeds}) · taraf değişti: ${U.swapped ? 'evet' : 'hayır'} · en uzun raunt ${Math.max(0, ...UYR.map((r) => r.t)).toFixed(0)} sn`);
}
if (game.bomba) {                                                                                                    // 12.226 Bomba özeti: kurma / imha / patlama oranı, raunt süresi, taraf başına galibiyet
  const B = game.bomba, st = B.stats, n = BMR.length || 1, pct = (k) => Math.round((100 * k) / n);
  const att = BMR.filter((r) => r.side === 'att').length, def = BMR.filter((r) => r.side === 'def').length, why = {};
  for (const r of BMR) why[r.why] = (why[r.why] || 0) + 1;
  const durs = BMR.map((r) => r.dur).sort((a, b) => a - b);
  console.log(`bomba: ${BMR.length} raunt · ${BMR.map((r) => `R${r.n} ${r.side}/${r.why}${r.planted ? '@' + B.siteName(r.site) : ''} ${r.dur.toFixed(0)}sn`).join(' · ')}`);
  console.log(`bomba: kurma %${pct(BMR.filter((r) => r.planted).length)} (${st.plants}; A ${st.siteN[0] || 0} / B ${st.siteN[1] || 0}) · imha %${pct(st.defuses)} · patlama %${pct(st.booms)} · düşme ${st.drops} / alma ${st.pickups} · nedenler ${JSON.stringify(why)}`);
  console.log(`bomba: galibiyet saldıran %${pct(att)} / savunan %${pct(def)} · raunt süresi ort ${(durs.reduce((a, b) => a + b, 0) / n).toFixed(0)} sn, medyan ${(durs[Math.floor(durs.length / 2)] || 0).toFixed(0)} sn, en uzun ${(durs[durs.length - 1] || 0).toFixed(0)} sn · skor ${game.tickets.blue}-${game.tickets.red} · taraf değişti: ${B.swapped ? 'evet' : 'hayır'}`);
  if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify({ rounds: BMR, stats: st, score: [game.tickets.blue, game.tickets.red] }));
}
const ok = errors === 0 && bad.length === 0 && (type !== 'conquest' || flagEvents > 0);
console.log(ok ? 'sonuç: OK' : 'sonuç: HATA');
process.exit(ok ? 0 : 1);
