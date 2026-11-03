// 12.226 Bomba: akış ölçümü (yol uzunluğu, yürüme 5,6 m/sn): saldıran / savunan doğuşundan bölgelere, bölgeden bölgeye (savunan dönüşü)
//   node scripts/probes/bmflow.mjs <harita>
import { Game } from '../../src/game/game.js';
const g = new Game(null, { headless: true, map: process.argv[2], tod: 'day', weather: 'clear', diff: 'normal', swapSides: false, match: { perTeam: 5, type: 'bomba' } });
const B = g.bomba, nav = g.nav, sp = g.map.spawns, V = 5.6;
const plen = (a, b) => { const p = nav.findPath(a.x, a.z, b.x, b.z, 0.7, a.y ?? 0, b.y); if (!p) return NaN; let L = 0, px = a.x, pz = a.z; for (const q of p) { L += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; } return L; };
const f = (L) => `${L.toFixed(0)} m (${(L / V).toFixed(1)} sn)`;
console.log(`${g.map.name}: saldıran ${B.att}, savunan ${B.def}`);
for (const s of B.sites) console.log(`  ${s.name}: saldıran doğuşu → ${f(plen(sp[B.att][0], s))} · savunan doğuşu → ${f(plen(sp[B.def][0], s))}`);
if (B.sites.length > 1) console.log(`  dönüş A ↔ B: ${f(plen(B.sites[0], B.sites[1]))}`);
process.exit(0);
