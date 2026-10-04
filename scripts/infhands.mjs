// Zombi elleri birinci şahıs: dururken ve koşarken (W + Shift) ekran görüntüsü. Çıktı: <önek>-dur.png / <önek>-kos.png
import { chromium } from 'playwright';
const pre = process.argv[2] || 'screenshots/zhands';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=6v6&type=inf&debug=1&nolock=1&tod=night`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
const adv = (n = 6) => page.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) g.step(1 / 30); }, n);
await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; g.brains.forEach((b) => (b.update = () => {})); g.makeZombie(p, false, 'walker'); p.spawn({ x: p.pos.x, z: p.pos.z, ry: p.yaw }, 0); g.world.settle(p); p.protT = 0; g.soldiers.filter((s) => s !== p).forEach((s) => { s.pos.y = -90; }); });
await adv(40);
await page.screenshot({ path: `${pre}-dur.png` });
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
const shots = [];
for (let i = 0; i < 3; i++) { await adv(i === 0 ? 40 : 7); await page.screenshot({ path: `${pre}-kos${i}.png` }); }
console.log('koşuyor:', await page.evaluate(() => { const p = window.__game.playerSoldier; return JSON.stringify({ sprinting: p.sprinting, vx: +p.vel.x.toFixed(1), vz: +p.vel.z.toFixed(1), sprintT: +window.__game.player.vm.sprintT.toFixed(2) }); }));
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
