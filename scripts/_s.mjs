import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:5180/?autostart=6v6&map=${process.argv[2] || 'kasaba'}&debug=1&nolock=1&third=1&tod=${process.argv[3] || 'day'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await page.evaluate(() => { const g = window.__game; g.brains.forEach((b) => (b.update = () => {})); for (let i = 0; i < 40; i++) g.step(1 / 30); });
await page.screenshot({ path: 'screenshots/perf-' + (process.argv[2] || 'kasaba') + '.png' });
await browser.close();
