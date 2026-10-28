// 12.209 doğan / üsse dönen araç zemine oturuyor mu (başsız): Kuzey'in tüm kara aracı doğuşlarında trySpawn sonrası (ve 3 sn uyku sonrası)
// teker temas noktası ile fizik zemini (groundAt) farkı + gövde altı 5 × 3 ızgara ile arazi farkı. > 0,12 m teker / > 0,08 m gövde = gömülü.
//   node scripts/vehspawnsink.mjs   · çıkış kodu: gömülü doğuş varsa 1
import { Game } from '../src/game/game.js';
import { toWorld, groundAt } from '../src/sim/vehicle.js';

const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 32, type: 'conquest' } });
const W = g.world, _p = { x: 0, y: 0, z: 0 };
function sink(st) {
  const d = st.def; let wheel = -9, hull = -9;
  for (const f of [d.wb / 2, -d.wb / 2]) for (const r of d.moto ? [0] : [-d.tr / 2, d.tr / 2]) { toWorld(st, f, r, 0, _p); wheel = Math.max(wheel, groundAt(W, _p.x, _p.z, _p.y + 0.05, d.stepUp ?? 0.55) - _p.y); }
  for (let i = 0; i <= 4; i++) for (const j of d.moto ? [0] : [-1, 0, 1]) { toWorld(st, -d.hl + (i / 4) * 2 * d.hl, j * d.hw, d.clear, _p); hull = Math.max(hull, W.heightAt(_p.x, _p.z) - _p.y); }
  return { wheel, hull };
}
const V = g.vehicles, rows = [];
for (let k = 0; k < 2; k++) {
  for (const v of V.list) { if (v.def.heli) continue; v.alive = false; v.st = null; V.trySpawn(v, true); }
  if (k) for (let i = 0; i < 180; i++) g.step(1 / 60);
  for (const v of V.list) { if (v.def.heli || !v.st) continue; const s = sink(v.st); rows.push({ k, t: v.type, id: v.id ?? v.idx, w: +s.wheel.toFixed(2), h: +s.hull.toFixed(2) }); }
}
const bad = rows.filter((r) => r.w > 0.12 || r.h > 0.08);
console.log(`doğuş ${rows.length / 2} araç · gömülü: doğuşta ${bad.filter((r) => !r.k).length}, 3 sn sonra ${bad.filter((r) => r.k).length} · en kötü teker ${Math.max(...rows.map((r) => r.w)).toFixed(2)} m · gövde ${Math.max(...rows.map((r) => r.h)).toFixed(2)} m`);
for (const r of bad.slice(0, 12)) console.log('  ', JSON.stringify(r));
process.exit(bad.length ? 1 : 0);
