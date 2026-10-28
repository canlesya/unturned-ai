// 12.209 Hareketli araç zemin ölçümü (başsız, fizik = sunucu = çevrimdışı): Kuzey'de botlar oynar, sürücülü + hareketli jip / motor her 3 adımda ölçülür.
//   node scripts/vehdrive-hl.mjs [saniye=240] [takım başına=32]
//   Ölçü (teker temas noktası, gövde altı ızgarası): fizik zemini (groundAt: arazi + basılan kutu tepesi) − teker altı (> 0,12 m gömülü),
//   arazi − gövde altı (u = clear; > 0,08 m gövde arazinin içinde). Çıktı: tür başına örnek / kötü / en kötü; en kötü 12 örneğin konumu.
//   JSON=dosya → ölçümler. Çıkış kodu = kötü örnek varsa 1.
import { Game } from '../src/game/game.js';
import { toWorld, groundAt } from '../src/sim/vehicle.js';
import fs from 'node:fs';

const secs = +(process.argv[2] || 240), per = +(process.argv[3] || 32);
const _p = { x: 0, y: 0, z: 0 };
export function wheelSink(W, st) {
  const d = st.def; let wheel = -9, hull = -9;
  for (const f of [d.wb / 2, -d.wb / 2]) for (const r of [-d.tr / 2, d.tr / 2]) {
    toWorld(st, f, r, 0, _p);
    wheel = Math.max(wheel, groundAt(W, _p.x, _p.z, _p.y + 0.05, d.stepUp ?? 0.55) - _p.y);
  }
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 4; j++) {
    toWorld(st, -d.hl + (i / 10) * 2 * d.hl, -d.hw + (j / 4) * 2 * d.hw, d.clear, _p);
    hull = Math.max(hull, W.heightAt(_p.x, _p.z) - _p.y);
  }
  return { wheel, hull };
}

const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'conquest' } });
const W = g.world, by = {}, all = [];
for (let i = 0; i < 30 * secs && !g.ended; i++) {
  g.step(1 / 30);
  if (i % 3) continue;
  for (const v of g.vehicles.list) {
    const st = v.st;
    if (!v.alive || !st || v.def.heli || v.def.tracked || !v.seats[0]) continue;
    const sp = Math.hypot(st.vx, st.vz); if (sp < 2) continue;
    const m = wheelSink(W, st), b = (by[v.type] ||= { n: 0, bad: 0, wheel: 0, hull: 0 });
    b.n++; if (m.wheel > 0.12 || m.hull > 0.08) b.bad++;
    b.wheel = Math.max(b.wheel, m.wheel); b.hull = Math.max(b.hull, m.hull);
    all.push({ t: v.type, x: +st.x.toFixed(1), y: +st.y.toFixed(2), z: +st.z.toFixed(1), sp: +sp.toFixed(1), air: st.air, pitch: +st.pitch.toFixed(2), w: +m.wheel.toFixed(2), h: +m.hull.toFixed(2) });
  }
}
all.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
let bad = 0;
for (const [t, b] of Object.entries(by)) { bad += b.bad; console.log(`${t}: ${b.n} örnek · kötü ${b.bad} (%${(100 * b.bad / b.n).toFixed(2)}) · en çok teker gömülmesi ${b.wheel.toFixed(2)} m · gövde altı ${b.hull.toFixed(2)} m`); }
console.log('en kötü:', all.slice(0, 12).map((a) => JSON.stringify(a)).join('\n  '));
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ by, worst: all.slice(0, 50) }, null, 1));
process.exit(bad ? 1 : 0);
