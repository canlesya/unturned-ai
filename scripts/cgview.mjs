// Belirli konum + bakış yönünden kareler (fotoğraflarla karşılaştırma). node scripts/cgview.mjs   VIEWS='[["ad",x|"Bölge adı",z,yawDerece,pitch,ekYükseklik, mutlakY?]]'  (yaw 0 = kuzey, 90 = batı, 180 = güney, -90 = doğu)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1&tod=${process.env.TOD || 'day'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.hud.root.style.display = 'none'; g.player.vm.render = () => {}; });
const V = JSON.parse(process.env.VIEWS || '[]');
for (const [name, x0, z0, yawDeg, pitch = 0, up = 0, absY = null] of V) {
  await page.evaluate(([x0, z0, yawDeg, pitch, up, absY]) => { const g = window.__game, s = g.playerSoldier; let x = x0, z = z0; if (typeof x0 === 'string') { const c = g.map.callouts.find((q) => q.name === x0); x = c.x; z = c.z; } const i = g.nav.nearestFree(x, z, 12); if (i >= 0 && !up && absY == null) { x = g.nav.cx(i); z = g.nav.cz(i); } s.fly = true; s.pos.set(x, absY != null ? absY : g.world.heightAt(x, z) + up, z); s.vel.set(0, 0, 0); s.yaw = (yawDeg * Math.PI) / 180; s.pitch = pitch; }, [x0, z0, yawDeg, pitch, up, absY]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/cgv-${name}.png` });
}
console.log('hata', errs.length, errs.slice(0, 2));
await browser.close();
