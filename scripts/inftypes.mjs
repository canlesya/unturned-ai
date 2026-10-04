// Tüm zombi türlerini yan yana gösterir (dev haritası): <çıktı>.png. Hayalet görünmez (3 m'den uzakta) olduğundan ayrıca yakın çekim alır.
import { chromium } from 'playwright';
const out = process.argv[2] || 'screenshots/inf-turler';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=6v6&type=inf&map=dev&debug=1&nolock=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
const adv = (n = 6) => page.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) g.step(1 / 30); }, n);
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier; g.brains.forEach((b) => (b.update = () => {}));
  const e = p.eye(); const T = e.constructor;
  let ok = false;
  for (let k = 0; k < 32 && !ok; k++) { p.yaw = (k / 32) * Math.PI * 2; ok = g.losClear(e, new T(e.x - Math.sin(p.yaw) * 9, e.y, e.z - Math.cos(p.yaw) * 9)) && g.losClear(e, new T(e.x - Math.sin(p.yaw + 0.5) * 9, e.y, e.z - Math.cos(p.yaw + 0.5) * 9)) && g.losClear(e, new T(e.x - Math.sin(p.yaw - 0.5) * 9, e.y, e.z - Math.cos(p.yaw - 0.5) * 9)); }
  const types = ['walker', 'runner', 'brute', 'ghost', 'blinker'], r = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
  const pool = g.soldiers.filter((s) => s !== p);
  types.forEach((t, i) => {
    const z = pool[i]; if (z.def.zombie) { z.ztype = t; z.setClass('zombie'); } else g.makeZombie(z, false, t);
    z.spawn({ x: p.pos.x - Math.sin(p.yaw) * 6 + r.x * (i - 2) * 1.9, z: p.pos.z - Math.cos(p.yaw) * 6 + r.z * (i - 2) * 1.9, ry: p.yaw + Math.PI }, 0); z.protT = 0; z.vel.set(0, 0, 0); g.world.settle(z); z.brain && (z.brain.update = () => {});
  });
  pool.slice(5).forEach((s) => { s.pos.y = -80; });
  g.ghost = pool[3];
});
await adv(8);
await page.screenshot({ path: `${out}.png` });
// hayalet görünmezliği: uzaktan görünmez, 3 m içinde görünür
const vis = await page.evaluate(() => { const g = window.__game, z = g.ghost; z.abT = 0; z.useAbility(); for (let i = 0; i < 4; i++) g.step(1 / 30); const far = z.model.root.visible; const p = g.playerSoldier; z.pos.set(p.pos.x - Math.sin(p.yaw) * 2, p.pos.y, p.pos.z - Math.cos(p.yaw) * 2); for (let i = 0; i < 4; i++) g.step(1 / 30); return { cloaked: z.cloaked, uzakta: far, yakinda: z.model.root.visible }; });
console.log('hayalet:', JSON.stringify(vis));
await page.screenshot({ path: `${out}-hayalet-yakin.png` });
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
