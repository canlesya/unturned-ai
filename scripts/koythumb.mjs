// Kum Köyü küçük resmi (menü kartı, 12.224): açılı kuşbakışı → public/img/uykukoy.jpg (960×540).  BASE=http://127.0.0.1:5180 node scripts/koythumb.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto((process.env.BASE || 'http://127.0.0.1:5180') + '/?editor=uykukoy&debug=1&nolock=1&tod=day');
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g), orig = P.render; g.mapEditor?.toggle?.(false); g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  P.render = function () { const c = this.camera; c.position.set(-30, 58, 62); c.rotation.order = 'YXZ'; c.lookAt(3, 0, 4); c.fov = 46; c.updateProjectionMatrix(); this.scene.fog && (this.scene.fog.far = 900); orig.call(this); };
});
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/uykukoy-thumb.png' });
await browser.close();
execFileSync('python3', ['-c', "from PIL import Image; Image.open('screenshots/uykukoy-thumb.png').convert('RGB').save('public/img/uykukoy.jpg', quality=84, optimize=True)"]);
console.log('public/img/uykukoy.jpg');
