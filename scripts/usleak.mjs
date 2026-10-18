// Askeri Üs sızıntı denetimi: mavi doğuştan yürünebilen hücrelerden çevre duvarının (iç yüz x = ±80, z = ±60) dışına düşen var mı + erişilebilir hücre sayısı.  node scripts/usleak.mjs
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { MAPS } from '../src/maps/index.js';
import { NavGrid } from '../src/game/nav.js';
const m = MAPS.us.build(); const nav = new NavGrid(m.colliders, m.bounds, m.terrain, !!m.layered);
let fail = 0;
for (const team of ['blue', 'red']) {
  const s = m.spawns[team][0], seen = nav.reachable(s.x, s.z);
  let n = 0, out = 0;
  for (let i = 0; i < seen.length; i++) { if (!seen[i]) continue; n++; const x = nav.cx(i), z = nav.cz(i); if (Math.abs(x) > 80.01 || Math.abs(z) > 60.01) out++; }
  console.log(`${out ? 'HATA' : 'OK  '}  ${team}: erişilebilir hücre ${n}, duvar dışı ${out}`);
  if (out) fail++;
}
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK');
process.exit(fail ? 1 : 0);
