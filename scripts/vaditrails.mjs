// Vadi patika denetimi (12.169): her patikanın ekseni boyunca gerçek arazi eğimi + yol ızgarasında kapalı nokta (düzlük şevi / sırt patikayı yarıyor mu)
//   node scripts/vaditrails.mjs
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
import { NavGrid } from '../src/game/nav.js';
MapBuilder.noVisual = true;
const m = MAPS.vadi.build(), T = m.terrain, nav = new NavGrid(m.colliders, m.bounds, T, false);
const L = await import('../src/maps/assets/vadi/layout.js');
let bad = 0;
for (const t of L.TRAILS) {
  if (t.side < 0) continue;
  let mx = 0, at = null, blocked = [];
  for (let i = 1; i < t.p.length; i++) {
    const [x, z] = t.p[i], [px, pz] = t.p[i - 1];
    if (Math.abs(x) > 90 || Math.abs(z) > 60) continue;
    const s = Math.abs(T.heightAt(x, z) - T.heightAt(px, pz)) / Math.hypot(x - px, z - pz);
    if (s > mx) { mx = s; at = [x, z]; }
    if (!nav.isFree(x, z) && !m.colliders.some((c) => x > c.min[0] - 0.4 && x < c.max[0] + 0.4 && z > c.min[2] - 0.4 && z < c.max[2] + 0.4)) blocked.push(x.toFixed(0) + ',' + z.toFixed(0));
  }
  const flag = mx > 0.9 || blocked.length;              // 0,9: yürünür (yol ızgarası 0,95, fizik 1,2 üstünü kapatır)
  if (flag) bad++;
  console.log(`${flag ? 'HATA' : 'OK  '} ${t.name.padEnd(12)} en dik ${mx.toFixed(2)} @${at ? at.map((q) => q.toFixed(0)).join(',') : '-'}  ızgarada kapalı: ${blocked.length ? blocked.slice(0, 6).join(' ') : 0}`);
}
console.log(bad ? `${bad} patikada sorun` : 'tüm patikalar yürünür');
