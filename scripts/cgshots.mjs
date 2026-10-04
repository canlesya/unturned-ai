// Çöl Geçidi ekran görüntüleri: kuşbakışı + bölge bölge yer seviyesi.  node scripts/cgshots.mjs [overview|zones|all]  (vite 5180)
import { chromium } from 'playwright';
const what = process.argv[2] || 'all';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=3v3&map=colgecidi&debug=1&nolock=1&tod=${process.env.TOD || 'day'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.brains.length = 0; g.hud.root.style.display = 'none'; g.player.vm.render = () => {}; });   // botlar susar, HUD gizlenir
if (what !== 'zones') {
  await page.evaluate(() => {
    const g = window.__game, P = Object.getPrototypeOf(g), orig = P.render;
    window.__origRender = orig; P.render = function () { const c = this.camera; c.position.set(0, 215, 0.01); c.rotation.order = 'YXZ'; c.rotation.set(-Math.PI / 2, 0, 0); c.fov = 38; c.updateProjectionMatrix(); this.scene.fog && (this.scene.fog.far = 900); orig.call(this); };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/cg-overview.png' });
  await page.evaluate(() => { Object.getPrototypeOf(window.__game).render = window.__origRender; });
}
if (what !== 'overview') {
  const spots = JSON.parse(process.env.SPOTS || '[]');
  const def = [
    ['tspawn', -58, -17, 0, 'orta'], ['orta', -2, -6, 40, 'ct'], ['uzun', -12, 54, 90, 'ct'], ['asite', 42, 38, -60, 'ct'], ['bsite', 50, -38, 120, 'ct'], ['ctspawn', 43, 13, 180, 'orta'], ['tuneller', 6, -56, 90, 'ct'],
  ];
  for (const [name, x, z, , look] of (spots.length ? spots : def)) {
    await page.evaluate(([x0, z0, bias]) => {
      const g = window.__game, s = g.playerSoldier, o = new g.camera.position.constructor(), d = new g.camera.position.constructor();
      const i = g.nav.nearestFree(x0, z0, 12), x = g.nav.cx(i), z = g.nav.cz(i);
      s.pos.set(x, g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); g.world.settle(s); s.protT = 99; s.hp = 999;
      let best = -1, by = 0;                                                     // en uzun görüşlü yöne bak (duvara değil)
      for (let k = 0; k < 24; k++) {
        const yaw = (k / 24) * Math.PI * 2; o.set(x, s.pos.y + 1.6, z); d.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        const h = g.world.raycast(o, d, 60, {}); const t = h ? h.t : 60;
        if (t > best) { best = t; by = yaw; }
      }
      s.yaw = by; s.pitch = -0.04;
    }, [x, z, look]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `screenshots/cg-${name}.png` });
  }
}
console.log('hata', errs.length, errs.slice(0, 5));
await browser.close();
