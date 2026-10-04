// Çöl Geçidi tüm modlarda kuruluyor mu / çöküyor mu? (başsız, kısa)  node scripts/cgmodes.mjs
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
const cases = [['tdm', 3], ['tdm', 16], ['conquest', 3], ['conquest', 16], ['dm', 8], ['gg', 6]];
let fail = 0;
for (const [type, per] of cases) {
  try {
    const g = new Game(null, { headless: true, swapSides: type === 'tdm', map: 'colgecidi', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: 120 } });
    const t0 = performance.now();
    for (let i = 0; i < 30 * 60 && !g.ended; i++) g.step(1 / 30);
    const alive = g.soldiers.filter((s) => s.alive).length;
    const kills = g.soldiers.reduce((a, s) => a + (s.kills || 0), 0);
    console.log(`OK    ${type} ${per} → ${(performance.now() - t0).toFixed(0)} ms · canlı ${alive}/${g.soldiers.length} · öldürme ${kills} · doğuş ${g.map.spawns.blue.length}/${g.map.spawns.red.length}`);
    if (kills < 1) { console.log('HATA  hiç öldürme yok'); fail++; }
  } catch (e) { console.log('HATA ', type, per, e.stack.split('\n').slice(0, 3).join(' | ')); fail++; }
}
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK');
process.exit(fail ? 1 : 0);
