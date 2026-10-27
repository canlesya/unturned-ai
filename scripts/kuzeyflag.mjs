// Kuzey Vadisi: botların tek bir bayrağa (varsayılan E Baraj) varışı (12.184) — tarayıcısız:
//   node scripts/kuzeyflag.mjs [bayrak=E] [saniye=150]
// Rakipsiz maç; kırmızı botlar çevredeki başlangıç noktalarından o bayrağa gönderilir. Her bot: alana (yarıçap + bayrak kotu ±8 m) ilk giriş süresi, son konum.
import { Game } from '../src/game/game.js';
const FID = process.argv[2] || 'E', secs = +(process.argv[3] || 150);
const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 8, type: 'conquest' } });
const o = g.mode.objectives.find((q) => q.id === FID), oy = Number.isFinite(o.y) ? o.y : g.world.heightAt(o.x, o.z);
const inObj = (p) => Math.hypot(p.x - o.x, p.z - o.z) < o.r && Math.abs(p.y - oy) < 8;
const START = { E: [[640, 30], [690, 40], [655, -60], [640, -214], [600, 100], [560, -140], [700, -150], [620, -20]] }[FID]
  || Array.from({ length: 8 }, (_, i) => [o.x + Math.cos(i * 0.785) * 140, o.z + Math.sin(i * 0.785) * 140]);
for (const s of g.soldiers) if (s.team === 'blue') { s.alive = false; s.respawnT = 1e9; if (s.brain) s.brain = null; }
g.brains = g.brains.filter((b) => b.s.team === 'red');
const reds = g.soldiers.filter((s) => s.team === 'red' && s.brain);
g.squadGoal = (s) => (s.team === 'red' ? o : null);
for (const q of g.mode.objectives) q.owner = q === o ? 'blue' : 'red';
reds.forEach((s, i) => {
  const [x, z] = START[i % START.length]; const k = g.nav.nearestFree(x, z, 12);
  s.pos.set(g.nav.cx(k), 0, g.nav.cz(k)); g.world.settle(s); s.brain.reset(); s.brain.pickGoal?.();
  s.cls === 'sniper' && (s.brain.perching = false);
});
const first = new Map(); const dt = 1 / 30;
for (let i = 0; i < secs * 30 && !g.ended; i++) {
  g.step(dt);
  if (i % 15) continue;
  if (process.env.DBG && i % 60 === 0) { const s = reds[+process.env.DBG]; const b = s.brain; console.log((i * dt).toFixed(0), 'poz', s.pos.x.toFixed(1), s.pos.y.toFixed(1), s.pos.z.toFixed(1), 'hedef', b.goal ? b.goal.x.toFixed(0) + ',' + b.goal.z.toFixed(0) : '-', 'yol', b.path ? b.path.length : '-', b.perching ? 'perch' : '', b.target ? 'düşman' : ''); }
  for (const s of reds) { if (s.alive && !first.has(s) && inObj(s.pos)) first.set(s, i * dt); if (!s.alive) { s.alive = true; } }
}
let n = 0;
reds.forEach((s, i) => { const t = first.get(s); if (t !== undefined) n++; console.log(`bot ${i} başlangıç ${START[i % START.length]} → ${t !== undefined ? 'alanda ' + t.toFixed(0) + ' sn' : 'VARAMADI'} · son (${s.pos.x.toFixed(0)}, ${s.pos.y.toFixed(1)}, ${s.pos.z.toFixed(0)})`); });
console.log(`${FID} (${o.name}, kot ${oy.toFixed(1)}): ${n}/${reds.length} bot ${secs} sn'de alana vardı · sahibi ${o.owner} p ${o.p.toFixed(2)}`);
