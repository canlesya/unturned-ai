// Çöl Geçidi küçük resmi (menü kartı): açılı kuşbakışı → public/img/colgecidi.jpg
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1&tod=day');
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g), orig = P.render; g.brains.length = 0; g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  P.render = function () { const c = this.camera; c.position.set(-6, 118, 108); c.rotation.order = 'YXZ'; c.lookAt(4, 0, -4); c.fov = 46; c.updateProjectionMatrix(); this.scene.fog && (this.scene.fog.far = 900); orig.call(this); };
});
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/colgecidi-thumb.png' });
await browser.close();
