// Kum Köyü (12.224) görüntüleri: kuşbakışı + açılı genel bakış + bakış noktaları (doğuşlar, Meydan, iki yan hat, Konak içi, dam), gündüz / gece.
//   BASE=http://127.0.0.1:5180 OUT=/tmp/wb-koy TODS=day,night [ONLY=ad1,ad2] node scripts/koyshots.mjs
// Harita Editörü bölümünde (botsuz, uçuş) açılır; kamera oyuncunun gözü, bakılan noktaya döner (yaw = atan2(−dx, −dz)).
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || '/tmp/wb-koy'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:5180';
const TODS = (process.env.TODS || 'day,night').split(',');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
// [ad, x, y (göz), z, bakılan x, bakılan z, pitch]
const VIEWS = [
  ['doğuş-güney', 3.6, 2.2, 29.8, -3, 37, -0.1], ['doğuş-güney-revak', -12.2, 2.2, 32.9, 4, 35.5, -0.05], ['doğuş-kuzey', 3.6, 2.2, -29.8, -3, -37, -0.1],
  ['han-arkası', -16.6, 1.7, 25.6, 10, 25.4, -0.03], ['han-önü', -6.2, 1.7, 25.8, -5.6, 6, -0.05], ['meydan', -9.0, 1.7, 12.6, 0, 0, -0.08], ['meydan-sebil', 9.6, 1.7, 9.6, -2, 0, -0.05], ['meydan-kuzeyden', 2.5, 1.7, -12.4, -4, 8, -0.06],
  ['dar-sokak', -28.5, 1.7, 29.5, -28.5, 10, -0.03], ['dar-sokak-kıvrım', -29.2, 1.7, 15.2, -20, 15.2, -0.04], ['fırın-avlusu', -20.2, 1.7, 1.0, -30, 4, -0.06], ['kemer', -13, 1.7, 10.75, -25, 10.75, -0.02],
  ['evler-sokağı', 20, 1.7, 29.5, 20, 10, -0.04], ['avlu', 24.4, 1.7, 8.6, 33, 6, 0.02], ['konak-dış', 12.6, 1.7, 4.2, 20, 0, 0.05],
  ['konak-zemin', 26.0, 1.7, 2.2, 16, 0, -0.05], ['konak-merdiven', 17.2, 1.7, 2.4, 25, 4.6, 0.12], ['konak-üst', 25.9, 4.9, -1.6, 16, 1, -0.12],
  ['dam-içi', 32.0, 1.7, 12.0, 24, 18, -0.04], ['dam', 31.8, 5.15, 12.0, 20, 20, -0.12], ['dam-merdiven', 24.8, 1.7, 6.0, 33, 11, 0.15],
];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
for (const tod of TODS) {
  const page = await browser.newPage({ viewport: { width: +process.env.W || 1100, height: +process.env.H || 620 } });
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await page.goto(`${BASE}/?editor=uykukoy&debug=1&nolock=1&tod=${tod}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 }); await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.__game; g.mapEditor?.toggle?.(false); g.hud.root.style.display = 'none'; g.player.s.fly = true; if (g.player.vm) g.player.vm.render = () => {}; });
  // kuşbakışı + açılı genel bakış (kamera elle)
  for (const [n, pos, look, fov] of [['kuşbakışı', [0, 118, 0.01], [0, 0, 0], 40], ['genel', [-34, 62, 70], [2, 0, 2], 46]]) {
    if (ONLY && !ONLY.includes(n)) continue;
    await page.evaluate(([pos, look, fov]) => {
      const g = window.__game, P2 = Object.getPrototypeOf(g);
      if (!P2._origRender) P2._origRender = P2.render;
      g.player.vm && (g.player.vm.render = () => {});
      g._koyCam = { pos, look, fov };
      P2.render = function () { const k = this._koyCam; if (k) { const c = this.camera; c.position.set(...k.pos); c.lookAt(...k.look); c.fov = k.fov; c.updateProjectionMatrix(); if (this.scene.fog) this.scene.fog.far = 900; } P2._origRender.call(this); };
    }, [pos, look, fov]);
    await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${tod}-${n}.png` });
  }
  await page.evaluate(() => { const g = window.__game; g._koyCam = null; const c = g.camera; c.fov = 75; c.updateProjectionMatrix(); });
  for (const [n, x, y, z, tx, tz, pitch] of VIEWS) {
    const yaw = Math.atan2(-(tx - x), -(tz - z));
    if (ONLY && !ONLY.includes(n)) continue;
    await page.evaluate(([x, y, z, yaw, pitch]) => { const g = window.__game, s = g.player.s; s.fly = true; s.pos.set(x, y - 1.62, z); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; }, [x, y, z, yaw, pitch]);
    await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${tod}-${n}.png` });
  }
  await page.close();
}
console.log('görüntü klasörü', OUT, '· hata', errs.length, errs.slice(0, 5));
await browser.close();
