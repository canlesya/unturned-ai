// Enfekte insan botlarının davranışı (headless): doğma noktasından ayrılıyorlar mı, zombiye bıçak çekiyorlar mı? node scripts/infbotcheck.mjs [harita=kasaba] [toplam=24]
import { Game } from '../src/game/game.js';
const map = process.argv[2] || 'kasaba', total = +(process.argv[3] || 24);
const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: process.env.DIFF || 'normal', match: { perTeam: total, type: 'inf', time: 300 } });
const humans = g.soldiers.filter((s) => s.team === 'blue'), sp = g.map.spawns.blue[0];
const start = new Map(humans.map((s) => [s.id, { x: s.pos.x, z: s.pos.z }]));
let high = 0, knife = 0, samples = 0, maxFar = new Map(humans.map((s) => [s.id, 0])), path = new Map(humans.map((s) => [s.id, 0])), last = new Map(humans.map((s) => [s.id, { x: s.pos.x, z: s.pos.z }]));
for (let i = 0; i < +(process.env.SECS || 40) * 30 && !g.ended; i++) {
  g.step(1 / 30);
  for (const s of humans) {
    if (!s.alive || s.def.zombie) continue;
    samples++; if (s.cur === 3) knife++; if (s.pos.y > 0.8) high++;
    const st = start.get(s.id); maxFar.set(s.id, Math.max(maxFar.get(s.id), Math.hypot(s.pos.x - st.x, s.pos.z - st.z)));
    const l = last.get(s.id); path.set(s.id, path.get(s.id) + Math.hypot(s.pos.x - l.x, s.pos.z - l.z)); l.x = s.pos.x; l.z = s.pos.z;
  }
}
const far = [...maxFar.values()], moved = [...path.values()];
console.log(`harita ${map} · ${total} kişi · ${process.env.SECS || 40} sn · başlangıçtan en uzak ort ${(far.reduce((a, b) => a + b, 0) / far.length).toFixed(0)} m (en az ${Math.min(...far).toFixed(0)}) · yürünen yol ort ${(moved.reduce((a, b) => a + b, 0) / moved.length).toFixed(0)} m · bıçak tutulan kare oranı ${(knife / Math.max(1, samples) * 100).toFixed(1)}% · yüksek noktada (y>0.8) geçirilen kare oranı ${(high / Math.max(1, samples) * 100).toFixed(1)}%`);
