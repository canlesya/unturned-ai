// Kasaba iç mekân eşya sayımı (tarayıcısız): oda türü başına oda / eşya / oda başı eşya. 12.176
//   node scripts/kasabafurn.mjs [--rooms]
// Sayım kuralı (eski Kasaba v2 sayımıyla aynı): her yerleştirilen eşya 1; tavan lambası sayılmaz; masa takımının sandalyeleri
// ("chair(set)") eski haritada masa çiziminin içinde olduğu için ayrı sayılmaz (ikinci sütunda dahil hâli).
import { MapBuilder } from '../src/maps/builder.js';
import { Game } from '../src/game/game.js';
MapBuilder.prototype.furnStats = [];
new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 2, type: 'tdm' } });
const R = MapBuilder.prototype.furnStats;
const by = {};
for (const r of R) {
  const v = (by[r.type] ||= { rooms: 0, items: 0, all: 0, area: 0, empty: 0, kinds: {} });
  const it = r.items.filter((n) => n !== 'chair(set)');
  v.rooms++; v.items += it.length; v.all += r.items.length; v.area += r.area; if (!it.length) v.empty++;
  for (const n of r.items) v.kinds[n] = (v.kinds[n] || 0) + 1;
}
let T = 0, TA = 0;
console.log(`oda ${R.length}`);
for (const [t, v] of Object.entries(by)) {
  T += v.items; TA += v.all;
  console.log(`${t.padEnd(10)} oda ${String(v.rooms).padStart(2)}  eşya ${String(v.items).padStart(3)} (sandalyeli ${v.all})  oda başı ${(v.items / v.rooms).toFixed(1)}  boş oda ${v.empty}  alan/oda ${(v.area / v.rooms).toFixed(1)} m²  ${JSON.stringify(v.kinds)}`);
}
console.log(`toplam eşya ${T} (sandalyeli ${TA}) · oda başı ${(T / R.length).toFixed(1)}`);
if (process.argv.includes('--rooms')) for (const r of R) console.log(r.type, r.k, r.area.toFixed(1), 'dünya x', r.world.slice(0, 2).map((v) => v.toFixed(1)).join('…'), 'z', r.world.slice(2).map((v) => v.toFixed(1)).join('…'), 'y', r.y.toFixed(2), r.items.join(','));
process.exit(0);
