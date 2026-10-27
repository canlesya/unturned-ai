// 12.187: sunucuda yeni maç kurma süresi (olay döngüsünü bu kadar tutar: o sırada diğer odaların snapshot'ı gecikir). node scripts/newgamecost.mjs [harita…]
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
MapBuilder.noVisual = true;
const maps = process.argv.slice(2).length ? process.argv.slice(2) : ['kasaba', 'vadi', 'us', 'colgecidi', 'depo', 'liman', 'kuzey', 'newyork', 'boyakulesi', 'cephe', 'maden'];
const type = { newyork: 'inf', boyakulesi: 'pb', cephe: 'front', maden: 'payload' };
for (const map of maps) {
  const ts = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', bots: true, match: { perTeam: map === 'kuzey' ? 16 : 10, type: type[map] || 'conquest', time: 600 } });
    const t1 = performance.now();
    g.step(1 / 60);
    const t2 = performance.now();
    for (let k = 0; k < 60; k++) g.step(1 / 60);
    const t3 = performance.now();
    g.dispose();
    ts.push([t1 - t0, t2 - t1, (t3 - t2) / 60]);
  }
  const f = (j) => ts.map((x) => x[j].toFixed(1)).join(' / ');
  console.log(`${map.padEnd(11)} kurulum ${f(0)} ms · ilk adım ${f(1)} ms · adım ort ${f(2)} ms`);
}
