// Maç kurucu (Özel Oyun / Oda Kur) ekran görüntüleri: screenshots/builder-*.png.  node scripts/menubuilder.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/`);
await page.evaluate(() => localStorage.setItem('warbyte.v2', JSON.stringify({ type: 'conquest', map: 'kasaba' })));
await page.reload();
await page.waitForSelector('.mn-nav', { timeout: 30000 }); await page.waitForTimeout(2000);
await page.click('.mn-nav[data-v=custom]'); await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/builder-1-mod.png' });
await page.click('.mdc[data-v=gg]'); await page.waitForTimeout(1200);               // mod seç → harita adımına kayar
await page.screenshot({ path: 'screenshots/builder-2-harita.png' });
await page.click('.mapc[data-v=us]'); await page.waitForTimeout(1200);               // harita seç → ayarlara kayar
await page.screenshot({ path: 'screenshots/builder-3-ayarlar.png' });
await page.click('.mdc[data-v=inf]'); await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector('#bs1').scrollIntoView());
await page.waitForTimeout(500); await page.screenshot({ path: 'screenshots/builder-4-enfekte.png' });
// oda kur
await page.click('.mn-nav[data-v=online]'); await page.waitForTimeout(800);
await page.evaluate(() => { const b = document.querySelector('[data-a=oview][data-v=ocreate]'); if (b) { b.removeAttribute('disabled'); b.click(); } });
await page.waitForTimeout(1500); await page.screenshot({ path: 'screenshots/builder-5-oda-kur.png' });
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
