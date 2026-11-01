// 12.223 Uyku Modu başsız akış dökümü: node scripts/uydbg.mjs [harita=colgecidi] [raunt=3] — kim kimi nerede uyuttu, raunt sonuçları, 2 sn'de bir kadro
import { Game } from '../src/game/game.js';
const map = process.argv[2] || 'colgecidi', R = +(process.argv[3] || 3);
const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: 5, type: 'uyku', rounds: +process.env.ROUNDS || 5 } });
const sp = g.map.spawns;
console.log('doğuş mavi', sp.blue.slice(0, 2).map((p) => [p.x | 0, p.z | 0]), 'kırmızı', sp.red.slice(0, 2).map((p) => [p.x | 0, p.z | 0]));
g.on('uydown', ({ s, k }) => console.log(`${g.time.toFixed(1)} UYUDU ${s.name}(${s.team}) @${s.pos.x.toFixed(0)},${s.pos.z.toFixed(0)} ← ${k?.name}(${k?.team}) d=${k ? Math.hypot(k.pos.x - s.pos.x, k.pos.z - s.pos.z).toFixed(0) : '-'}`));
g.on('uyround', (r) => console.log(`${g.time.toFixed(1)} RAUNT ${r.n} ${r.w} ${r.why} ${r.t.toFixed(0)} sn`));
const v0 = g.uyku.revive.bind(g.uyku); g.uyku.revive = (v, r) => { console.log(`${g.time.toFixed(1)} KALDIRDI ${r.name} → ${v.name}`); v0(v, r); };
const o0 = g.uyku.out.bind(g.uyku); g.uyku.out = (s, by, why) => { console.log(`${g.time.toFixed(1)} ELENDİ ${s.name} (${why}${by ? ' ← ' + by.name : ''})`); o0(s, by, why); };
for (let i = 0; i < 30 * 900 && g.uyku.round <= R && !g.ended; i++) {
  g.step(1 / 30);
  if (process.env.ROSTER && i % 60 === 0) console.log(g.time.toFixed(0), g.uyku.phase, g.soldiers.map((s) => `${s.team[0]}${s.alive ? (s.downed ? 'z' : '') : 'x'}:${s.pos.x.toFixed(0)},${s.pos.z.toFixed(0)}`).join(' '));
}
console.log('bitti:', g.ended ? `${g.winner} (${g.endReason})` : 'hayır', JSON.stringify(g.uyku.stats));
