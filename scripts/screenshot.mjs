// Kullanım: node scripts/screenshot.mjs <çıktı.png> "<query>" [genişlik] [yükseklik]
import { chromium } from 'playwright';

const [out, query = 'view=characters', w = '1600', h = '900'] = process.argv.slice(2);
const base = process.env.BASE || 'http://127.0.0.1:5173';

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => (['error', 'warning'].includes(m.type()) || m.text().startsWith('harita')) && console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${base}/${process.env.PAGE || 'viewer.html'}?${query}`);
await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await page.waitForTimeout(400);
await page.screenshot({ path: out });
await browser.close();
console.log('kaydedildi:', out);
