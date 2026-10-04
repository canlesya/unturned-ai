// Çöl Geçidi tur: haritaya yayılmış noktalardan çekilmiş kareler → screenshots/cg-tour-N.png ve montaj cg-tour.png.  node scripts/cgtour.mjs [adet=20]
import { chromium } from 'playwright';
const N = +process.argv[2] || 20;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1&tod=${process.env.TOD || 'day'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.brains.length = 0; g.hud.root.style.display = 'none'; });
const pts = await page.evaluate((N) => {
  const g = window.__game, base = g.map.spawns.blue[0], seen = g.nav.reachable(base.x, base.z);
  return g.nav.spreadPoints(seen, { spacing: 18, max: N, clear: 1.2 }).map((p) => [p.x, p.z]);
}, N);
for (let i = 0; i < pts.length; i++) {
  await page.evaluate(([x, z]) => {
    const g = window.__game, s = g.playerSoldier, o = new g.camera.position.constructor(), d = new g.camera.position.constructor();
    s.pos.set(x, g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); g.world.settle(s); s.protT = 99; s.hp = 999;
    let best = -1, by = 0;
    for (let k = 0; k < 24; k++) { const yaw = (k / 24) * Math.PI * 2; o.set(x, s.pos.y + 1.6, z); d.set(-Math.sin(yaw), 0, -Math.cos(yaw)); const h = g.world.raycast(o, d, 60, {}); const t = h ? h.t : 60; if (t > best) { best = t; by = yaw; } }
    s.yaw = by; s.pitch = -0.03;
  }, pts[i]);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `screenshots/cg-tour-${i}.png` });
}
console.log('çekilen', pts.length, 'hata', errs.length, errs.slice(0, 3), JSON.stringify(pts.map((p) => p.map((v) => Math.round(v)))));
await browser.close();
