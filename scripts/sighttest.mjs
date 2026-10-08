// Bot görüşü: yaprak / çalı gibi mermi geçiren ama görüşü kesen örtüler.  node scripts/sighttest.mjs [harita=vadi]
import { chromium } from 'playwright';
const MAP = process.argv[2] || 'vadi';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:5180/?autostart=6v6&map=${MAP}&type=tdm&debug=1&nolock=1`); await p.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 }); await p.waitForTimeout(800);
const r = await p.evaluate(() => { const g = window.__game, W = g.world, V = g.camera.position.constructor; g.brains.length = 0; const a = new V(), c = new V();
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const B = g.map.bounds || { minX: -90, maxX: 90, minZ: -60, maxZ: 60 }; const out = { küre: g.map.sight?.length || 0, çift: 0, açık: 0, yaprakla: 0, mesafe: [0, 0, 0, 0] , yaprakMesafe: [0, 0, 0, 0] };
  const bin = (d) => (d < 20 ? 0 : d < 45 ? 1 : d < 80 ? 2 : 3);
  for (let i = 0; i < 30000 && out.çift < 6000; i++) {
    const x1 = B.minX + rnd() * (B.maxX - B.minX), z1 = B.minZ + rnd() * (B.maxZ - B.minZ), ang = rnd() * 6.28, d = 8 + rnd() * 100, x2 = x1 + Math.cos(ang) * d, z2 = z1 + Math.sin(ang) * d;
    if (x2 < B.minX || x2 > B.maxX || z2 < B.minZ || z2 > B.maxZ) continue;
    const y1 = W.heightAt(x1, z1), y2 = W.heightAt(x2, z2); if (y1 < -5 || y2 < -5) continue;
    a.set(x1, y1 + 1.6, z1); c.set(x2, y2 + 1.1, z2); out.çift++;
    if (!g.losClear(a, c)) continue; out.açık++; out.mesafe[bin(d)]++;
    if (g.sightMap && g.sightMap.blocked(a, c)) { out.yaprakla++; out.yaprakMesafe[bin(d)]++; }
  } return out; });
console.log(JSON.stringify(r)); const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
console.log(`açık görüş hattı ${r.açık}/${r.çift}; bunların ${r.yaprakla} tanesi (%${pct(r.yaprakla, r.açık)}) yapraktan geçiyor → botlar artık görmüyor. Mesafeye göre (<20, 20-45, 45-80, 80+ m): ${r.yaprakMesafe.map((v, i) => pct(v, r.mesafe[i]) + '%').join(' · ')}`);
console.log('sayfa hatası', errs.length, errs.slice(0, 2)); await b.close();
