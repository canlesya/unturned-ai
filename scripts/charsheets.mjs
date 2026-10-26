// 12.167 Karakter v2 + kıyafet kaplamaları görsel sayfaları: charlab.html → PNG.   URL=http://127.0.0.1:5180 OUT=/tmp/wb-karakter/taslak node scripts/charsheets.mjs [bodyA,bodyB,...]
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-karakter/taslak';
fs.mkdirSync(OUT, { recursive: true });
const ALL = 'bodyA,bodyB,slot&s=head,slot&s=top,slot&s=back,slot&s=legs,slot&s=feet,pal,glow,combos,compare,far&d=30,far&d=40';
const views = (process.argv[2] || ALL).split(',');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
for (const v of views) {
  await page.goto(`${URL0}/charlab.html?v=${v}`);
  await page.waitForFunction('window.__ready', null, { timeout: 60000 });
  await page.waitForTimeout(v.startsWith("crowd") ? 1500 : 900);
  const nm = v.replace(/[^a-z0-9.]+/gi, '_'); await page.screenshot({ path: `${OUT}/${nm}.png` });
  const st = await page.evaluate(() => window.__stats); if (Object.keys(st).length) console.log(v, JSON.stringify(st));
  console.log(`${OUT}/${nm}.png`);
}
console.log('hatalar:', errs);
await browser.close();
