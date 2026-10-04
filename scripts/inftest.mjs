// Enfekte modu (headless): botlar oynar; enfeksiyon, sayım, bitiş, harita ve bot-sayısı denemeleri. node scripts/inftest.mjs [harita=kasaba] [toplam=12] [saniye=300] [zaman=300]
import { Game } from '../src/game/game.js';
const map = process.argv[2] || 'kasaba', total = +(process.argv[3] || 12), secs = +(process.argv[4] || 300), time = +(process.argv[5] || 300);
const game = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: total, type: 'inf', time } });
const c0 = game.infCounts();
console.log(`harita ${map} · toplam ${game.soldiers.length} · başlangıç insan ${c0.h} zombi ${c0.z} · alfa canı ${game.soldiers.filter((s) => s.alpha).map((s) => s.maxHp)}`);
let err = 0, infections = 0, firstInf = -1;
game.on('infect', () => { infections++; if (firstInf < 0) firstInf = game.time; });
const dt = 1 / 30, log = [];
try {
  for (let i = 0; i < secs * 30 && !game.ended; i++) {
    game.step(dt);
    if (i % (30 * 30) === 0) { const c = game.infCounts(); log.push(`${Math.round(game.time)}s insan ${c.h} zombi ${c.z}`); }
  }
} catch (e) { err++; console.log('HATA', e.stack); }
const c = game.infCounts();
console.log(log.join(' | '));
console.log(`bitti: ${game.ended ? game.winner + ' — ' + game.endReason : 'hayır'} · son insan ${c.h} zombi ${c.z} · enfeksiyon ${infections} (ilki ${firstInf.toFixed(0)} sn) · zombi öldürme ${game.soldiers.filter((s) => s.cls !== 'zombie').reduce((a, s) => a + s.kills, 0)}`);
const bad = game.soldiers.filter((s) => !Number.isFinite(s.pos.x + s.pos.y + s.pos.z) || s.pos.y < -5);
const inv = game.soldiers.filter((s) => (s.team === 'red') !== !!s.def.zombie);
console.log(`hata ${err} · geçersiz ${bad.length} · takım/sınıf tutarsız ${inv.length}`);
process.exit(err || bad.length || inv.length ? 1 : 0);
