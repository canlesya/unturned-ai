import { Game } from '../src/game/game.js';
const g = new Game(null, { headless: true, map: 'newyork', tod: 'night', weather: 'clear', diff: 'normal', match: { perTeam: 24, type: 'inf', time: 300 } });
const n = g.nav; let hi = 0; for (let i = 0; i < n.floor.length; i++) if (n.floor[i] > 0.5) hi++;
console.log('yüksek hücre', hi, 'perches', g.map.perches.length);
const s = g.map.spawns.blue[3];
for (const p of g.map.perches) {
  const path = n.findPath(s.x, s.z, p.x, p.z);
  console.log(`perch (${p.x},${p.z}) y=${p.y}:`, path ? `yol ${path.length} nokta, son (${path[path.length-1].x.toFixed(1)},${path[path.length-1].z.toFixed(1)}) floor ${n.floorAt(path[path.length-1].x, path[path.length-1].z)}` : 'YOL YOK', 'hedef hücre floor', n.floorAt(p.x, p.z), 'serbest', n.isFree(p.x, p.z));
}
const hum = g.soldiers.filter((x) => x.team === 'blue' && x.alive);
for (let i = 0; i < 30 * 20; i++) g.step(1 / 30);
console.log(hum.slice(0, 6).map((h) => `${h.name} (${h.pos.x.toFixed(0)},${h.pos.z.toFixed(0)},y${h.pos.y.toFixed(1)}) goal ${h.brain?.goal ? h.brain.goal.x.toFixed(0) + ',' + h.brain.goal.z.toFixed(0) : '-'} perch ${h.brain?.perch ? h.brain.perch.x : '-'}`).join('\n'));
