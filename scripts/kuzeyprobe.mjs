// Kuzey Vadisi (12.172) hızlı yoklama: sayfada JS ifadesi çalıştırır (hata ayıklama).  node scripts/kuzeyprobe.mjs "<ifade>"
import { chromium } from 'playwright';
const URL0 = process.env.URL || 'http://127.0.0.1:5391';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); });
await page.goto(`${URL0}/?autostart=8v8&map=kuzey&type=conquest&debug=1&nolock=1&tod=${process.env.TOD || 'day'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(process.argv[2] || '1');
console.log(JSON.stringify(r, null, 1));
console.log('errs', JSON.stringify(errs.slice(0, 12), null, 1));
await browser.close();
