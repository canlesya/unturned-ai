// 12.206 çok araçta sunucu adım süresi (başsız, sunucunun yolu: Game.step 1/60, botlu Kuzey Ele Geçirme).   node scripts/vehperf.mjs [10,32,64,128] [sn=90]
// Ölçü: adım başına ortalama / p95 / en çok ms, bunun araç yöneticisi (Vehicles.update) + bot sürücü / pilot (vbDrive) payı, araç sayısı, sürülen araç.
// Oda sınırı (LIMITS.maxPerTeam) 64 / 128 denemesi için yalnız burada yükseltilir.
import { Game } from '../src/game/game.js';
import { LIMITS } from '../src/game/balance.js';
const PERS = (process.argv[2] || '10,32,64').split(',').map(Number), SECS = +(process.argv[3] || 90);
LIMITS.maxPerTeam = Math.max(LIMITS.maxPerTeam, ...PERS);
const now = () => performance.now();
for (const per of PERS) {
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type: 'conquest', time: 3600 } }), V = g.vehicles;
  let vt = 0; const vu = V.update.bind(V); V.update = (dt) => { const t = now(); vu(dt); vt += now() - t; };
  const W = 60 * 10; for (let i = 0; i < W; i++) g.step(1 / 60);                // ısınma (10 sn)
  vt = 0;
  const T = [];
  let drv = 0, samples = 0;
  for (let i = 0; i < SECS * 60; i++) {
    const t = now(); g.step(1 / 60); T.push(now() - t);
    if (i % 60 === 0) { drv += V.list.filter((v) => v.alive && v.seats[0]).length; samples++; }
  }
  T.sort((a, b) => a - b);
  const avg = T.reduce((a, b) => a + b, 0) / T.length;
  console.log(JSON.stringify({ per, vehicles: V.list.length, alive: V.list.filter((v) => v.alive).length, drivenAvg: +(drv / samples).toFixed(1), stepMs: +avg.toFixed(2), p95: +T[Math.floor(T.length * 0.95)].toFixed(2), max: +T[T.length - 1].toFixed(1), vehMs: +(vt / T.length).toFixed(3), soldiers: g.soldiers.length }));
  g.dispose?.();
}
