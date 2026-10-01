// geçici: birden çok görüntü tek tarayıcıda. Kullanım: node scripts/_us_shots.mjs OUTDIR W H name1=query1 name2=query2 ...
// (dosya değişiklikleri vite'ı yeniden yüklettiği için: ekran görüntüsü sırasında sayfa yenilendiyse yeniden dener)
import { chromium } from 'playwright';
const [outDir, w, h, ...pairs] = process.argv.slice(2);
const page_ = process.env.PAGE || 'map.html';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
for (const p of pairs) {
  const i = p.indexOf('=');
  const name = p.slice(0, i), q = p.slice(i + 1);
  for (let attempt = 0; attempt < 4; attempt++) {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    try {
      await page.goto(`http://127.0.0.1:5173/${page_}?${q}`);
      await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
      const t0 = await page.evaluate('performance.timeOrigin');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 180000 });
      const t1 = await page.evaluate('performance.timeOrigin');
      if (t0 !== t1) { console.log('sayfa yenilendi, tekrar', name); await page.close(); continue; }
      console.log('ok', name);
      await page.close();
      break;
    } catch (e) { console.log('hata', name, String(e.message).slice(0, 80)); await page.close().catch(() => {}); }
  }
}
await browser.close();
