// Harita üçgen dağılımı (çağrı yerine göre):  node scripts/kasabatris.mjs [harita=kasaba]
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
const by = new Map(), _a = MapBuilder.prototype.addGeo;
MapBuilder.prototype.addGeo = function (g, c, l, o) {
  const r = _a.call(this, g, c, l, o);
  const st = new Error().stack.split('\n').map((s) => s.trim()).filter((s) => /src[\/]maps[\/]/.test(s) && !/builder\.js/.test(s));
  const f = (st[0] || '?').match(/maps[\/](.*?\.js):(\d+)/), k = f ? f[1] + ':' + f[2] : '?';
  by.set(k, (by.get(k) || 0) + r.g.attributes.position.count / 3);
  return r;
};
MAPS[process.argv[2] || 'kasaba'].build();
let t = 0; for (const v of by.values()) t += v;
console.log('toplam üçgen', Math.round(t));
const file = new Map(); for (const [k, v] of by) { const f = k.replace(/:\d+$/, ''); file.set(f, (file.get(f) || 0) + v); }
for (const [k, v] of [...file].sort((a, b) => b[1] - a[1])) console.log(String(Math.round(v)).padStart(8), k);
console.log('--- satır');
for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP || 20))) console.log(String(Math.round(v)).padStart(8), k);
