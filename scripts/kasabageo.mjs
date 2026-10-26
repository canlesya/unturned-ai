// Başsız maçta askerin çarpışma kutusu içine girdiği ilk anları yakala (hata ayıklama):  node scripts/kasabageo.mjs [tür=conquest] [sn=120] [tekrar=3]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { Game } from '../src/game/game.js';
const [type = 'conquest', secs = '120', reps = '3'] = process.argv.slice(2);
let found = 0;
for (let r = 0; r < +reps; r++) {
  const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 10, type, time: +secs } });
  const hist = new Map();
  for (let st = 0; st < +secs * 30 && !g.ended; st++) {
    g.step(1 / 30);
    for (const a of g.soldiers) {
      if (!a.alive) continue;
      const p = a.pos, H = hist.get(a) || []; H.push([p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2), a.height.toFixed(2), a.onGround ? 1 : 0, (a.downed ? 'D' : '') + (a.prone ? 'P' : '') + (a.crouch ? 'C' : '')]); if (H.length > 6) H.shift(); hist.set(a, H);
      const list = g.world.query(p.x - 1, p.z - 1, p.x + 1, p.z + 1, []);
      const c = g.world._hits(list, p.x, p.y + 0.05, p.z, Math.max(0.3, a.height - 0.1));
      if (c && found < 6) { found++; console.log(`#${found} t=${g.time.toFixed(1)} ${a.name} kutu ${c.min.map((v) => v.toFixed(2))}→${c.max.map((v) => v.toFixed(2))} ${c.oid || ''}\n   son konumlar: ${H.map((q) => q.join(' ')).join(' | ')}`); }
    }
  }
}
console.log('bulunan', found);
