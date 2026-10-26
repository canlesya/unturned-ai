// Kuzey Vadisi menüde (12.172): Özel Oyun → Ele Geçirme, harita kartı görünür, seçilip Oyna → maç kuzey'de açılır.  node scripts/kuzeymenu.mjs [url] [klasör]
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5391', OUT = process.argv[3] || '/tmp/wb-buyuk/taslak';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(base + '/?debug=1&nolock=1&nologin=1');
await page.waitForTimeout(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('[data-a]')].find((e) => /Özel Oyun/i.test(e.textContent)); b?.click(); });
await page.waitForTimeout(800);
const st = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.mapc')], k = cards.find((c) => /Kuzey Vadisi/.test(c.textContent));
  k?.click(); k?.scrollIntoView({ block: 'center' });
  return { maps: cards.map((c) => c.querySelector('b')?.textContent), found: !!k };
});
await page.waitForTimeout(900);
st.on = await page.evaluate(() => document.querySelector('.mapc.on b')?.textContent);
await page.screenshot({ path: `${OUT}/menu-harita-karti.png` });
let ok = st.found && st.on === 'Kuzey Vadisi';
if (ok) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button.play')].find((e) => /Oyna|Başlat/i.test(e.textContent)) || document.querySelector('button.play'); b?.click(); });
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 }).catch(() => {});
  st.match = await page.evaluate(() => ({ type: window.__game?.mode.type, map: window.__game?.mapDef.id, flags: window.__game?.mode.objectives.length }));
  ok = st.match.map === 'kuzey';
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/menu-mac-hud.png` });
}
console.log(JSON.stringify(st), 'hata', errs.length, errs.slice(0, 2).join(' | '));
console.log(ok && !errs.length ? 'sonuç: OK' : 'sonuç: HATA');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
