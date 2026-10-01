// geçici: birden çok görüntü tek tarayıcıda. Kullanım: node scripts/_us_shots.mjs OUTDIR W H name1=query1 name2=query2 ...
import { chromium } from 'playwright';
const [outDir, w, h, ...pairs] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
for (const p of pairs) {
  const i = p.indexOf('=');
  const name = p.slice(0, i), q = p.slice(i + 1);
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:5173/map.html?${q}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 180000 });
  console.log('ok', name);
  await page.close();
}
await browser.close();
