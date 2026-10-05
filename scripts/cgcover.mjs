// Görsel ↔ çarpışma uyumu: görünen her duvar (kat kenarı görsel parçaları + bina çokgen kenarları) için örnek noktalarda çarpışma kutusu var mı?  node scripts/cgcover.mjs [x0 z0 x1 z1]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import D from '../src/maps/colgecidiData.js';
const [rx0, rz0, rx1, rz1] = process.argv.length > 5 ? process.argv.slice(2, 6).map(Number) : [-99, -99, 99, 99];
const m = buildColGecidi(); const cs = m.colliders.filter((c) => c.tag !== 'roof');
const hit = (x, y, z) => cs.some((c) => x >= c.min[0] - 0.02 && x <= c.max[0] + 0.02 && z >= c.min[2] - 0.02 && z <= c.max[2] + 0.02 && y >= c.min[1] - 0.02 && y <= c.max[1] + 0.02);
let bad = 0, tot = 0; const out = [];
for (const [x0, z0, x1, z1, lo, hi] of D.cliffv) {
  const L = Math.hypot(x1 - x0, z1 - z0); let miss = 0, n = 0;
  for (let t = 0.1; t < 0.95; t += 0.1) { const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (x < rx0 || x > rx1 || z < rz0 || z > rz1) continue; n++; if (!hit(x, lo + (hi - lo) * 0.5, z)) miss++; }
  if (n) { tot++; if (miss) { bad++; out.push(`(${x0.toFixed(1)},${z0.toFixed(1)})→(${x1.toFixed(1)},${z1.toFixed(1)}) y${lo.toFixed(1)}–${hi.toFixed(1)} boşluk ${miss}/${n}`); } }
}
console.log(`kat kenarı görsel parça ${tot}, çarpışması eksik ${bad}`); console.log(out.slice(0, 30).join('\n'));
