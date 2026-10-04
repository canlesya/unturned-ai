// Z-fighting denetimi (dokuların iç içe girip gidip gelmesi):  node scripts/mapzfight.mjs [harita...]
// Aynı yöne bakan, farklı malzemeli, ≤1,2 cm arayla çakışan yüzleri bulur ve toplu çözümün (MapBuilder.resolveZFight) kaç yüzü ittiğini kaynak çiftiyle raporlar.
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
MapBuilder.zfix = true;
MapBuilder.zsite = () => (new Error().stack.split('\n').slice(3, 16).map((l) => l.trim()).filter((l) => /src[\/]maps[\/]/.test(l) && !/builder\.js/.test(l)).slice(0, 2).map((l) => l.replace(/^.*src[\/]maps[\/]/, '').replace(/\)$/, '').replace(/:\d+$/, '')).join(' < '));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAPS);
const _build = MapBuilder.prototype.build;
let all = [];
MapBuilder.prototype.build = function () { const g = _build.call(this); all.push(this); return g; };
for (const id of ids) {
  const t0 = Date.now();
  all = [];
  MAPS[id].build();
  const rep = all.flatMap((q) => q.zfightReport || []), by = new Map();
  const again = all.reduce((n, q) => n + q.resolveZFight().length, 0);       // ikinci geçiş: 0 olmalı (çözüm kalıcı)
  for (const r of rep) { const k = `${r.s1}  ↔  ${r.s2}`; by.set(k, (by.get(k) || 0) + 1); }
  console.log(`\n=== ${id}: ${all.reduce((n, q) => n + (q._zitems?.length || 0), 0)} kutu tarandı, ${rep.length} z-fight yüzü düzeltildi, ikinci geçişte kalan ${again} (${Date.now() - t0} ms)`);
  for (const [k, n] of [...by].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP || 20))) console.log(`  ${String(n).padStart(4)}×  ${k}`);
}
