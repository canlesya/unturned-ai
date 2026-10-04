// Menü küçük resmi: public/img/riverside.jpg (HUD'suz havadan görünüm, botlar oynarken)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=12v12&type=inf&map=riverside&debug=1&nolock=1&third=1&diff=hard`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier; p.protT = 999;
  for (let i = 0; i < 28 * 30; i++) g.step(1 / 30);
  p.pos.set(28, 26, 54); p.vel.set(0, 0, 0); p.yaw = 0.5; p.pitch = -0.4;
  for (let i = 0; i < 3; i++) g.step(1 / 30);
  p.pos.y = 26; p.vel.set(0, 0, 0);
  document.getElementById('hud').style.display = 'none'; g.player.vm.render = () => {};
});
await page.screenshot({ path: 'public/img/riverside.png' });
await browser.close();
