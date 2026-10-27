// 12.198 Maç içi silah payı (başsız, botlar rastgele donanım): silah başına seçilme (doğuş payı), öldürme payı, yaşam başına öldürme (KPL),
// kafa %, ortalama öldürme mesafesi; sınıf başına K/Ö. Birden çok harita × mod × tohum.
//   node scripts/wmatch.mjs [haritalar=colgecidi,kasaba,us,vadi] [mod=tdm,conquest] [NvN=8] [sn=300] [tohum=2]     JSON=dosya
let seed = 1;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const { Game } = await import('../src/game/game.js');
const { Soldier } = await import('../src/game/soldier.js');
const { WSTATS, CLASS_DEFS } = await import('../src/game/stats.js');
const [maps = 'colgecidi,kasaba,us,vadi', types = 'tdm,conquest', per = '8', secs = '300', seeds = '2'] = process.argv.slice(2);
const byName = {}; for (const [id, st] of Object.entries(WSTATS)) if (!byName[st.name]) byName[st.name] = id;
const W = {}, C = {};
const w = (id) => (W[id] ||= { lives: 0, kills: 0, heads: 0, dist: 0, deaths: 0 });
const c = (id) => (C[id] ||= { lives: 0, kills: 0, deaths: 0 });
const _spawn = Soldier.prototype.spawn;
Soldier.prototype.spawn = function (...a) { const r = _spawn.apply(this, a); if (!this.def.zombie && this.items?.[0]) { for (const it of this.items) if (it && WSTATS[it.id] && (WSTATS[it.id].kind === 'gun' || WSTATS[it.id].kind === 'melee' || WSTATS[it.id].kind === 'launcher' || WSTATS[it.id].gtype === 'frag' || WSTATS[it.id].kind === 'mine')) w(it.id).lives++; c(this.cls).lives++; this._wbPrim = this.items[0].id; } return r; };
let total = 0;
for (const map of maps.split(',')) for (const type of types.split(',')) for (let k = 0; k < +seeds; k++) {
  seed = 1000 + k * 77 + map.length * 13 + type.length;
  const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: +per, type, tickets: 9999 } });
  g.on?.('kill', () => {});
  const _ok = g.onKill.bind(g);
  g.onKill = (killer, victim, weapon, hs) => {
    if (killer && killer !== victim && victim && !victim.def?.zombie) {
      const id = byName[(weapon || '').replace(/ · arkadan$/, '')] || 'diğer';
      const r = w(id); r.kills++; if (hs) r.heads++; r.dist += Math.hypot(killer.pos.x - victim.pos.x, killer.pos.z - victim.pos.z);
      c(killer.cls).kills++; total++;
    }
    if (victim && victim._wbPrim) { w(victim._wbPrim).deaths++; c(victim.cls).deaths++; }
    return _ok(killer, victim, weapon, hs);
  };
  const steps = +secs * 30;
  for (let i = 0; i < steps && !g.ended; i++) g.step(1 / 30);
  process.stderr.write(`${map}/${type}/${k} `);
}
process.stderr.write('\n');
const lives = Object.entries(W).filter(([id]) => WSTATS[id]?.slot === 'primary').reduce((a, [, r]) => a + r.lives, 0);
console.log(`toplam öldürme ${total} · doğuş ${lives}`);
console.log('| silah | taşınma % (ana silah doğuşlarına göre) | öldürme % | KPL (öldürme / bu silahla yaşam) | taşıyanın ölüm / yaşam | kafa % | ort. mesafe m |');
console.log('|---|---|---|---|---|---|---|');
const rows = Object.entries(W).sort((a, b) => b[1].kills - a[1].kills);
for (const [id, r] of rows) {
  const st = WSTATS[id];
  console.log(`| ${st ? st.name : id} \`${id}\` | ${r.lives ? ((100 * r.lives) / lives).toFixed(1) : '-'} | ${((100 * r.kills) / Math.max(1, total)).toFixed(1)} | ${r.lives ? (r.kills / r.lives).toFixed(2) : '-'} | ${r.lives ? (r.deaths / r.lives).toFixed(2) : '-'} | ${r.kills ? Math.round((100 * r.heads) / r.kills) : 0} | ${r.kills ? (r.dist / r.kills).toFixed(0) : '-'} |`);
}
console.log('');
console.log('| sınıf | yaşam | öldürme | K/Ö |');
console.log('|---|---|---|---|');
for (const [id, r] of Object.entries(C)) console.log(`| ${CLASS_DEFS[id]?.label || id} | ${r.lives} | ${r.kills} | ${(r.kills / Math.max(1, r.deaths)).toFixed(2)} |`);
if (process.env.JSON) (await import('fs')).writeFileSync(process.env.JSON, JSON.stringify({ W, C, total }));
process.exit(0);
