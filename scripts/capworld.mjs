// 12.191 Dünyadaki bayrak direği + zemin halkası: her ele geçirme haritasında her bayrağa 14–30 m'den bakış (gerçek GPU) + direk boyu / kayma / halka parçası.
//   node scripts/capworld.mjs [url=http://127.0.0.1:5199] [haritalar=kasaba,vadi,us,colgecidi,depo,liman,kuzey,cephe]   → /tmp/wb-qa9/dunya/<harita>-<bayrak>.png
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5199', maps = (process.argv[3] || 'kasaba,vadi,us,colgecidi,depo,liman,kuzey,cephe').split(','), OUT = '/tmp/wb-qa9/dunya';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const map of maps) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=8v8&map=${map}&type=${map === 'cephe' ? 'front' : 'conquest'}&debug=1&nolock=1&time=1800`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 300000 });
  await page.evaluate(() => { const g = window.__game; g.devGod = true; for (const b of g.brains) b.update = () => {}; for (const s of g.soldiers) if (s !== g.playerSoldier) { s.alive = false; s.respawnT = 1e9; } });
  const n = await page.evaluate(() => window.__game.mode.objectives.length);
  for (let i = 0; i < n; i++) {
    const r = await page.evaluate((i) => {
      const g = window.__game, o = g.mode.objectives[i], me = g.playerSoldier, it = g.objFx?.items[i], V = g.camera.position.constructor;
      o.owner = null; o.p = i % 2 ? -0.6 : 0.6; o.pd = o.p;
      const top = it?.top ?? g.objY(o) + 4;
      let best = null;
      for (let k = 0; k < 300 && !best; k++) {
        const a = k * 0.61, d = 14 + (k % 9) * 2, x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
        if (!g.nav.isFree(x, z)) continue;
        const y = g.world.groundAt(x, z); if (Math.abs(y - g.objY(o)) > 4) continue;
        if (g.world.clear(new V(x, y + 1.6, z), new V(o.x, (top + g.objY(o)) / 2 + 0.5, o.z))) best = { x, y, z };
      }
      if (best) { me.pos.set(best.x, best.y + 0.05, best.z); me.vel.set(0, 0, 0); g.world.settle(me); const dx = o.x - me.pos.x, dz = o.z - me.pos.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2((top + g.objY(o)) / 2 - (me.pos.y + 1.6), Math.hypot(dx, dz)); }
      return { id: o.label || o.id, name: o.name, pole: !!it?.cloth, H: it?.cloth ? +(top - it.piv.position.y).toFixed(1) : 0, shift: it?.piv ? +Math.hypot(it.piv.position.x - o.x, it.piv.position.z - o.z).toFixed(1) : null, ring: it?.ring ? it.ring.geometry.index.count / 6 : 0, view: !!best };
    }, i);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${map}-${r.id}.png` });
    console.log(`${map} ${r.id} ${r.name}: direk ${r.pole ? r.H + ' m' : 'YOK'} kayma ${r.shift} m · halka ${r.ring} parça · bakış ${r.view ? 'var' : 'yok'}`);
  }
  if (errs.length) console.log(`${map} sayfa hatası: ${errs.slice(0, 2).join(' | ')}`);
  await page.close();
}
await browser.close();
