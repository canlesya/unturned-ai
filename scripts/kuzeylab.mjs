// Kuzey Vadisi varlık sayfası görüntüsü (12.172):  URL=http://127.0.0.1:5391 OUT=/tmp/wb-buyuk/taslak node scripts/kuzeylab.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5391', OUT = process.env.OUT || '/tmp/wb-buyuk/taslak';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 2000, height: 1250 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${URL0}/kuzeylab.html`);
await page.waitForFunction('window.__ready', null, { timeout: 120000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/varlik-sayfasi.png` });
console.log(JSON.stringify({ errs }));
await browser.close();
