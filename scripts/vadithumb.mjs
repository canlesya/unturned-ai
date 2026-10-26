// Vadi küçük resmi (menü kartı, 12.169): açılı kuşbakışı (mavi çiftlikten köprüye ve değirmene) → public/img/vadi.jpg (960 × 540)
//   node scripts/vadithumb.mjs [URL=http://127.0.0.1:5231] [OUT=public/img/vadi.jpg]
import { chromium } from 'playwright';
const URL0 = process.env.URL || 'http://127.0.0.1:5231', OUT = process.env.OUT || 'public/img/vadi.jpg';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`${URL0}/?autostart=3v3&map=vadi&type=tdm&debug=1&nolock=1&tod=day`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g), orig = P.render;
  g.brains.length = 0; g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  for (const s of g.soldiers) { s.pos.set(150, -40, 150); s.vel.set(0, 0, 0); }
  P.render = function () { const c = this.camera; c.position.set(-70, 46, 46); c.lookAt(2, 0, -6); c.fov = 50; c.updateProjectionMatrix(); if (this.scene.fog) this.scene.fog.far = 900; orig.call(this); };
});
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
await browser.close();
console.log('kaydedildi', OUT);
