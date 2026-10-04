// Silah Yarışı ekran görüntüleri: başlangıç, seviye atlama, skor tablosu, ölüm ekranı, bıçak seviyesi. Çıktı: <önek>-N.png
import { chromium } from 'playwright';
const pre = process.argv[2] || 'screenshots/gg';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=6v6&type=gg&debug=1&nolock=1&third=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
const adv = (n = 6) => page.evaluate((n) => { const g = window.__game; for (let i = 0; i < n; i++) g.step(1 / 30); }, n);
await page.evaluate(() => { const g = window.__game; g.brains.forEach((b) => (b.update = () => {})); g.soldiers.forEach((s) => { s.protT = 0; }); });
await adv(20);
await page.screenshot({ path: `${pre}-1-baslangic.png` });
const st = () => page.evaluate(() => { const g = window.__game, p = g.playerSoldier; return JSON.stringify({ level: p.ggLevel + 1, items: p.items.map((i) => i.id), hud: [document.getElementById('tkB').textContent, document.getElementById('tkR').textContent, document.getElementById('clsname').textContent] }); });
console.log('başta:', await st());
// bir rakibi öldür → seviye atla
await page.evaluate(() => { const g = window.__game, p = g.playerSoldier, v = g.soldiers.find((s) => s !== p); v.takeDamage(999, p, 'body', v.pos, 'M4A1'); });
await adv(12);
console.log('1 öldürme:', await st());
await page.screenshot({ path: `${pre}-2-seviye-atla.png` });
// birkaç seviye daha: sniper (11), sonra bıçak (15)
await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.setLevel(10); });
await adv(10); await page.screenshot({ path: `${pre}-3-keskin-nisanci.png` });
await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.setLevel(14); });
await adv(30); await page.screenshot({ path: `${pre}-4-bicak-seviyesi.png` });
console.log('son seviye:', await st());
// skor tablosu
await page.evaluate(() => { const g = window.__game; g.soldiers.forEach((s, i) => { s.ggLevel = [14, 3, 8, 5, 11, 1][i % 6]; }); g.hud.showScoreboard(true); });
await adv(4); await page.screenshot({ path: `${pre}-5-skor.png` });
await page.evaluate(() => { window.__game.hud.showScoreboard(false); });
// ölüm ekranı
await page.evaluate(() => { const g = window.__game, p = g.playerSoldier, k = g.soldiers.find((s) => s !== p); p.protT = 0; p.takeDamage(999, k, 'body', k.pos, 'AK-47'); });
await adv(10); await page.screenshot({ path: `${pre}-6-olum.png` });
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
