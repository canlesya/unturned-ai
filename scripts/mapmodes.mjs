// Tüm haritalar × izin verilen modlar kuruluyor / oynanıyor mu? (başsız; 12.185)  node scripts/mapmodes.mjs [harita...]   SEC=90 (maç başına sn)
// Her birleşimde: kurulum hatası, öldürme > 0, yeraltına / harita dışına düşen asker, NaN konum, katı içinde doğuş (gövde ortası bir çarpışma kutusunun içinde).
// Kuzey Vadisi yalnız adıyla verilirse koşar (ayrı denetimi: kuzeytest).
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
import { MAPS_FOR } from '../server/room.js';
const TYPES = ['conquest', 'tdm', 'dm', 'gg', 'inf', 'pb', 'payload', 'space', 'front'];
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const SEC = +(process.env.SEC || 90);
const per = { conquest: 8, tdm: 6, dm: 8, gg: 6, inf: 8, pb: 5, payload: 6, space: 6, front: 8 };
let fail = 0;
for (const type of TYPES) for (const map of MAPS_FOR(type)) {
  if (only.length && !only.includes(map)) continue;
  if (map === 'kuzey' && !only.includes('kuzey')) continue;
  try {
    const t0 = performance.now();
    const g = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per[type], type, time: SEC + 60 } });
    const b = g.map.bounds, w = g.world;
    let under = 0, out = 0, nan = 0, inSolid = 0; const bad = [];
    const solidAt = (p) => { const y = p.y + 0.9; const list = w.query(p.x - 0.1, p.z - 0.1, p.x + 0.1, p.z + 0.1); return list.find((c) => !c.noBlock && !c.soft && p.x > c.min[0] + 0.05 && p.x < c.max[0] - 0.05 && p.z > c.min[2] + 0.05 && p.z < c.max[2] - 0.05 && y > c.min[1] + 0.05 && y < c.max[1] - 0.05); };
    const seen = new Set();
    for (let i = 0; i < 30 * SEC && !g.ended; i++) {
      g.step(1 / 30);
      if (i % 15) continue;
      for (const s of g.soldiers) {
        if (!s.alive) { seen.delete(s); continue; }
        const p = s.pos;
        if (!Number.isFinite(p.x + p.y + p.z)) { nan++; continue; }
        const gy = w.terrain ? w.terrain.heightAt(p.x, p.z) : 0;
        if (p.y < gy - 1.5 && !s.swim && !s.inWater) { under++; if (bad.length < 4) bad.push(`yeraltı ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} (zemin ${gy.toFixed(1)})`); }
        if (b && (p.x < b.minX - 2 || p.x > b.maxX + 2 || p.z < b.minZ - 2 || p.z > b.maxZ + 2)) { out++; if (bad.length < 4) bad.push(`dışarı ${p.x.toFixed(1)},${p.z.toFixed(1)}`); }
        if (!seen.has(s)) { seen.add(s); const c = solidAt(p); if (c) { inSolid++; if (bad.length < 4) bad.push(`katıda doğdu ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`); } }
      }
    }
    const kills = g.soldiers.reduce((a, s) => a + (s.kills || 0), 0);
    const ok = kills > 0 && !under && !out && !nan && !inSolid;
    if (!ok) fail++;
    console.log(`${ok ? 'OK  ' : 'HATA'}  ${map.padEnd(10)} ${type.padEnd(9)} ${per[type]}v${per[type]} · ${(performance.now() - t0).toFixed(0)} ms · öldürme ${kills} · yeraltı ${under} · dışarı ${out} · NaN ${nan} · katıda doğuş ${inSolid} ${bad.join(' | ')}`);
  } catch (e) { fail++; console.log('HATA ', map, type, e.stack.split('\n').slice(0, 4).join(' | ')); }
}
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
