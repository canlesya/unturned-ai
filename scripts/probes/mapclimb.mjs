// Haritadaki tüm yüksek/iç hedefler (üst kat odaları, çatılar, kuleler, asma katlar) mavi VE kırmızı doğuşundan
// 3B yüzey grafiğinde bulunur ve GERÇEK World.move fiziğiyle yürünür. Kullanım: node scripts/probes/mapclimb.mjs [harita=kasaba]
import { MAPS } from '../../src/maps/index.js';
import { Walk } from './nav3d.mjs';

const id = process.argv[2] || 'kasaba';
const map = MAPS[id].build();
const targets = map.climb || [];
if (!targets.length) { console.log('haritada climb listesi yok'); process.exit(0); }
const t0 = Date.now();
const w = new Walk(map.colliders, map.bounds, { terrain: map.terrain || null });
console.log(`yüzey grafiği ${((Date.now() - t0) / 1000).toFixed(1)} s, hedef ${targets.length}`);
let bad = 0, n = 0;
for (const team of ['blue', 'red']) {
  const sp = map.spawns[team][0];
  const r = w.reach({ x: sp.x, y: w.world.heightAt(sp.x, sp.z), z: sp.z }, { maxDrop: 0.6 });
  for (const t of targets) {
    n++;
    const path = r ? w.pathTo(r, t.x, t.y, t.z, 0.12, 2.5) : null;
    if (!path) { bad++; console.log(`HATA ${team} → ${t.name} (y=${t.y.toFixed(1)}): yol yok`); continue; }
    const wk = w.walkPath(path, { maxSteps: 12000 });
    if (!wk.ok) { bad++; console.log(`HATA ${team} → ${t.name} (y=${t.y.toFixed(1)}): fizikle yürünemedi (y=${wk.y.toFixed(2)} at ${wk.at.map((v) => v.toFixed(1))})`); }
  }
}
console.log(bad ? `\n${bad}/${n} hedef ULAŞILAMADI` : `\n${n}/${n} hedefe (iki takımdan) fizikle yürüyerek çıkıldı`);
process.exit(bad ? 1 : 0);
