// Enfekte açılış testi (headless): ilk saniyelerde zombiler donuk mu, insanlar ateş ediyor mu, zombiler insanların görüşünde mi doğuyor? node scripts/infstart.mjs [harita] [toplam] [tekrar]
import { Game } from '../src/game/game.js';
import * as THREE from 'three';
const map = process.argv[2] || 'newyork', total = +(process.argv[3] || 24), N = +(process.argv[4] || 5);
let early = 0, moved = 0, seenSpawns = 0, spawns = 0, firstDist = [];
for (let r = 0; r < N; r++) {
  const g = new Game(null, { headless: true, map, tod: 'night', weather: 'clear', diff: 'hard', match: { perTeam: total, type: 'inf', time: 900 } });
  let humanShots = 0;
  g.on('fire', (s) => { if (s.team === 'blue' && g.time < 14) humanShots++; });
  const zs0 = g.soldiers.filter((s) => s.def.zombie).map((s) => ({ s, x: s.pos.x, z: s.pos.z }));
  const hum = g.soldiers.filter((s) => s.team === 'blue');
  firstDist.push(Math.min(...zs0.flatMap((z) => hum.map((h) => Math.hypot(h.pos.x - z.x, h.pos.z - z.z)))));
  const e = new THREE.Vector3(), t = new THREE.Vector3();
  g.on('spawn', (s) => { if (s.def.zombie && g.time > 15) { spawns++; if (g.soldiers.some((h) => h.alive && h.team === 'blue' && Math.hypot(h.pos.x - s.pos.x, h.pos.z - s.pos.z) < 75 && g.losClear(h.eye(e), t.set(s.pos.x, s.pos.y + 1.2, s.pos.z)))) seenSpawns++; } });
  for (let i = 0; i < 14 * 30; i++) g.step(1 / 30);
  early += humanShots; moved += Math.max(...zs0.map((z) => Math.hypot(z.s.pos.x - z.x, z.s.pos.z - z.z)));
  for (let i = 0; i < 60 * 30 && !g.ended; i++) g.step(1 / 30);
}
console.log(`${map} ${total} kişi · ${N} maç: ilk 14 sn insan atışı toplam ${early} · zombi en çok ${(moved / N).toFixed(1)} m oynadı (donuk=0) · boss–insan en yakın başlangıç mesafesi ort ${(firstDist.reduce((a, b) => a + b, 0) / N).toFixed(0)} m · 15 sn sonra doğan zombilerin görüşte doğma oranı ${spawns ? (seenSpawns / spawns * 100).toFixed(0) : '-'}% (${seenSpawns}/${spawns})`);
