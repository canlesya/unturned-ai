// Ölüm ekranında doğma noktasını klavyeyle seçmeyi sınar (Q/E ve ← →) + ekran görüntüsü.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=3v3&debug=1&nolock=1&type=conquest`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 60000 });
const info = () => page.evaluate(() => { const g = window.__game; for (let i = 0; i < 6; i++) g.step(1 / 30); return { choice: g.spawnChoice, ok: g.spawnOptions().filter((o) => o.ok).map((o) => o.id), on: [...document.querySelectorAll('#spawnrow .cc.on')].map((c) => c.dataset.k), hint: document.getElementById('spkeys').textContent }; });
await page.evaluate(() => {
  const g = window.__game; g.brains.forEach((b) => (b.update = () => {})); g.simulate = false;
  // iki hedefi oyuncu takımına ver, oyuncuyu öldür
  const t = g.playerSoldier.team; g.mode.objectives.slice(0, 2).forEach((o) => { o.owner = t; o.p = t === 0 ? -1 : 1; });
  g.playerSoldier.hp = 0; g.playerSoldier.alive = false; g.playerSoldier.respawnT = 99;
});
console.log('başlangıç', JSON.stringify(await info()));
const out = [];
for (const k of ['KeyE', 'KeyE', 'KeyE', 'KeyQ', 'ArrowRight', 'ArrowLeft']) { await page.keyboard.press(k); out.push([k, JSON.stringify(await info())]); }
out.forEach((o) => console.log(o[0].padEnd(11), o[1]));
await page.keyboard.press('KeyE'); await info();
await page.screenshot({ path: process.env.SHOT || 'spawnkey.png' });
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
