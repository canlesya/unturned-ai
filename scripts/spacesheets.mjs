// Uzay modu (12.157) görsel sayfaları: spacelab.html → PNG.   GPU=1 URL=http://127.0.0.1:5180 OUT=/tmp/wb-uzay/x node scripts/spacesheets.mjs [weapons,chars,tex]
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-uzay/sheets';
fs.mkdirSync(OUT, { recursive: true });
const views = (process.argv[2] || 'weapons,chars,tex').split(',');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
for (const v of views) {
  await page.goto(`${URL0}/spacelab.html?v=${v}`);
  await page.waitForFunction('window.__ready', null, { timeout: 60000 });
  await page.waitForTimeout(900);
  const nm = v.replace(/[^a-z0-9.]+/gi, "_"); await page.screenshot({ path: `${OUT}/${nm}.png` });
  console.log(`${OUT}/${nm}.png`);
}
console.log('hatalar:', errs);
await browser.close();
