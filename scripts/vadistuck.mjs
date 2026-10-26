// Vadi takılma ayrıntısı (12.169): başsız maçta takılan botun konumu, hedefi, yolu ve çevresindeki çarpışma kutuları.
//   node scripts/vadistuck.mjs [mod=dm] [sn=180] [N=6]
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
MapBuilder.noVisual = true;
const type = process.argv[2] || 'dm', SEC = +(process.argv[3] || 180), NS = +(process.argv[4] || 6);
const g = new Game(null, { headless: true, map: 'vadi', diff: 'normal', match: { perTeam: type === 'dm' ? 12 : 8, type } });
const T = g.map.terrain, C = g.map.colliders, last = new Map(), f = (a) => a.map((q) => (+q).toFixed(2)).join(',');
let shown = 0;
for (let steps = 0; steps < SEC * 30 && shown < NS; steps++) {
  g.step(1 / 30);
  if (steps % 150 !== 0) continue;
  for (const b of g.brains) {
    const s = b.s; if (!s.alive) continue;
    const L = last.get(s);
    const near = process.env.AT ? process.env.AT.split(";").some((q) => { const [ax, az] = q.split(",").map(Number); return Math.hypot(ax - s.pos.x, az - s.pos.z) < 5; }) : true;
    if (near && L && b.goal && !b.target && Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z) > 3 && Math.hypot(L.x - s.pos.x, L.z - s.pos.z) < 0.5 && shown < NS) {
      shown++;
      console.log(`\n${s.name} @${f([s.pos.x, s.pos.y, s.pos.z])} zemin ${T.heightAt(s.pos.x, s.pos.z).toFixed(2)} hedef ${f([b.goal.x, b.goal.z])} yol ${b.path ? b.path.length + ' nokta, ilk ' + f([b.path[0]?.x ?? 0, b.path[0]?.z ?? 0]) : 'yok'} nav serbest ${g.nav.isFree(s.pos.x, s.pos.z)}`);
      for (const c of C) if (s.pos.x + 1.2 > c.min[0] && s.pos.x - 1.2 < c.max[0] && s.pos.z + 1.2 > c.min[2] && s.pos.z - 1.2 < c.max[2] && s.pos.y + 2 > c.min[1] && s.pos.y - 0.6 < c.max[1]) console.log('   yakın', c.oid, c.tag || '', f(c.min), '…', f(c.max));
    }
    last.set(s, { x: s.pos.x, z: s.pos.z });
  }
}
