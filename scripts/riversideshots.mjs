// Riverside haritası ekran görüntüleri (gece): sokak, hastane+teras, depo çatısı, konteyner kulesi, botlar yüksek noktalarda. Çıktı: <önek>-N.png
import { chromium } from 'playwright';
const pre = process.argv[2] || 'screenshots/riverside';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=12v12&type=inf&map=riverside&debug=1&nolock=1&third=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
const adv = (n = 6) => page.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) g.step(1 / 30); }, n);
const view = async (name, x, z, yaw, pitch = 0, y = null) => {
  await page.evaluate(([x, z, yaw, pitch, y]) => { const g = window.__game, p = g.playerSoldier; p.pos.set(x, y ?? 0, z); g.world.settle(p); if (y !== null) p.pos.y = y; p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; }, [x, z, yaw, pitch, y]);
  await adv(6); await page.screenshot({ path: `${pre}-${name}.png` });
};
await page.evaluate(() => { const g = window.__game; g.simOff = true; g.playerSoldier.protT = 99; });
await view('1-cadde', -10, 3, -Math.PI / 2 + 0.0, 0.05);                  // doğuya doğru ana cadde
await view('2-hastane', -45, 2, 0, 0.18);                                    // kuzeye: hastane + teras
await view('3-depo', 52, 3, 0.35, 0.12);                                    // kuzeye: depo + merdiven
await view('4-konteyner', -30, 8, Math.PI, 0.12);                           // güneye: konteyner kulesi
await view('5-teras-ustu', -45, -16, Math.PI, 0.02, 1.5);                   // teras üstünden cadde
// botlar çalışsın: 40 sn sonra yüksek noktalarda mı?
await page.evaluate(() => { const g = window.__game; g.soldiers.forEach((s) => { s.protT = 0; }); g.playerSoldier.protT = 99; });
console.log('botlar yüksekte:', await page.evaluate(() => { const g = window.__game; return g.soldiers.filter((s) => s.team === 'blue' && s !== g.playerSoldier && s.alive && s.pos.y > 0.8).length; }));
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
