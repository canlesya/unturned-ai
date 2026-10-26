// Başsız maçta üst kata / merdivene çıkan botlar (hata ayıklama):  node scripts/kasabaup.mjs [tür=conquest] [sn=200]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
const [type = 'conquest', secs = '200'] = process.argv.slice(2);
const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 10, type, time: +secs } });
const up = new Map(); let n = 0, total = 0;
for (let st = 0; st < +secs * 30 && !g.ended; st++) {
  g.step(1 / 30);
  if (st % 30) continue;
  for (const s of g.soldiers) {
    if (!s.alive) { up.delete(s); continue; }
    if (s.pos.y > 1.2) { const q = up.get(s) || { p: [] }; q.p.push(`${s.pos.x.toFixed(1)},${s.pos.y.toFixed(1)},${s.pos.z.toFixed(1)}${s.brain?.target ? 'T' : ''}`); up.set(s, q); total++; }
    else if (up.has(s)) { const q = up.get(s); if (n++ < 14) console.log(s.name, 'yukarıda', q.p.length, 'sn:', q.p.slice(0, 4).join(' '), '…', q.p.slice(-2).join(' ')); up.delete(s); }
  }
}
for (const [s, q] of up) console.log(s.name, 'SONDA yukarıda', q.p.length, 'sn:', q.p.slice(0, 3).join(' '), '…', q.p.slice(-2).join(' '));
console.log('toplam yukarıda bot·sn', total);
