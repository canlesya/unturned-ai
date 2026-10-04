// New York: botlar 35 sn oynar, sonra yukarıdan görünüm (botlar platformlarda mı?) — screenshots/newyork-botlar.png
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=12v12&type=inf&map=newyork&debug=1&nolock=1&third=1&diff=hard`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
const r = await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier; p.protT = 999;
  for (let i = 0; i < 35 * 30; i++) g.step(1 / 30);
  const hs = g.soldiers.filter((s) => s.team === 'blue' && s !== p && s.alive);
  p.pos.set(-4, 46, 60); p.vel.set(0, 0, 0); p.yaw = 0.0; p.pitch = -0.55;
  for (let i = 0; i < 4; i++) g.step(1 / 30);
  p.pos.y = 46;
  return { insan: g.infCounts(), yuksekte: hs.filter((s) => s.pos.y > 0.8).length, toplam: hs.length };
});
console.log(JSON.stringify(r));
await page.screenshot({ path: 'screenshots/newyork-botlar.png' });
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
