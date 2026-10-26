// Bir noktanın çevresindeki görsel parçaları listele (hata ayıklama):  node scripts/kasabapick.mjs x y z [r=0.3] [oid-öneki]
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const [x, y, z, r = 0.3, pre = ''] = process.argv.slice(2).map((v, i) => (i < 4 ? +v : v));
const out = [], _a = MapBuilder.prototype.addGeo;
MapBuilder.prototype.addGeo = function (g, c, l, o) {
  const res = _a.call(this, g, c, l, o); const gg = res.g; gg.computeBoundingBox(); const bb = gg.boundingBox;
  if (bb.min.x - r <= x && bb.max.x + r >= x && bb.min.y - r <= y && bb.max.y + r >= y && bb.min.z - r <= z && bb.max.z + r >= z && (gg.userData.oid || '').startsWith(pre)) {
    const st = new Error().stack.split('\n').map((s) => s.trim()).filter((s) => /src[\/]maps[\/]/.test(s) && !/builder\.js|kasaba-shapes/.test(s)).slice(0, 3).map((s) => s.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '')).join(' < ');
    out.push(`${gg.userData.oid} ${c} [${bb.min.x.toFixed(2)},${bb.max.x.toFixed(2)}]×[${bb.min.y.toFixed(2)},${bb.max.y.toFixed(2)}]×[${bb.min.z.toFixed(2)},${bb.max.z.toFixed(2)}]  ${st}`);
  }
  return res;
};
MAPS.kasaba.build();
for (const s of out) console.log(s);
