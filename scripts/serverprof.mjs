// Sunucu CPU profili (ağsız): N odayı bot+oyuncuyla T sn simüle eder.  node --cpu-prof scripts/serverprof.mjs [oda=24] [sn=8]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
const { Game } = await import('../src/game/game.js');
const N = +(process.argv[2] || 24), SEC = +(process.argv[3] || 8);
const maps = ['kasaba', 'vadi', 'us'];
const games = [];
for (let i = 0; i < N; i++) {
  const g = new Game(null, { headless: true, map: maps[i % 3], match: { perTeam: [4, 6, 8, 10][i % 4], type: i % 5 === 4 ? 'dm' : 'tdm', tickets: 500 } });
  for (let k = 0; k < (i % 4); k++) g.claimSlot(k % 2 ? 'red' : 'blue', 'P' + k);
  games.push(g);
}
const t0 = performance.now(); const DT = 1 / 60; let ticks = 0;
for (let t = 0; t < SEC * 60; t++) for (const g of games) { g.step(DT); ticks++; }
const ms = performance.now() - t0;
console.log(`${N} oda × ${SEC} sn = ${ticks} tick: ${ms.toFixed(0)} ms → gerçek zamanda ${(ms / SEC / 10).toFixed(0)}% tek çekirdek (60 Hz sim)`);
