// Oyun testi/ekran görüntüsü: node scripts/play.mjs "<query>" <çıktı-öneki> [bekleme-sn] [js-kodu]
import { chromium } from 'playwright';

const [query = 'autostart=3v3&debug=1&nolock=1', out = 'screenshots/tmp-play', wait = '3', code = ''] = process.argv.slice(2);
const base = process.env.BASE || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ deviceScaleFactor: +(process.env.DSF || 1), viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
const errs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.goto(`${base}/?${query}`);
if (query.includes('autostart')) {
  try { await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 60000 }); }
  catch (e) { console.log('OYUN BAŞLAMADI'); for (const x of [...new Set(errs)].slice(0, 15)) console.log(x); console.log('yükleme metni:', await page.evaluate(() => document.getElementById('loading').textContent)); await browser.close(); process.exit(1); }
}
await page.waitForTimeout(+wait * 1000);
if (code) {
  const r = await page.evaluate(code);
  if (r !== undefined) console.log('sonuç:', JSON.stringify(r));
}
await page.screenshot({ path: `${out}.png` });
console.log('hata sayısı:', errs.length);
for (const e of [...new Set(errs)].slice(0, 12)) console.log(e);
await browser.close();
