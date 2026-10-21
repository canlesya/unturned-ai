// Vagon modu menüde: Özel Oyun mod kartı, harita kendiliğinden Maden Ocağı, Oyna → maç Vagon modunda açılır.  node scripts/plmenu.mjs [url=http://127.0.0.1:5220]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5220';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(base + '/?debug=1&nolock=1&nologin=1');
await page.waitForTimeout(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('[data-a]')].find((e) => /Özel Oyun/i.test(e.textContent)); b?.click(); });
await page.waitForTimeout(800);
const card = await page.$('[data-a="type"][data-v="payload"]');
let ok = !!card;
if (card) { await card.click(); await page.waitForTimeout(900); }
const st = await page.evaluate(() => ({ mapOn: document.querySelector('.mapc.on b')?.textContent, hint: [...document.querySelectorAll('.sc')].map((e) => e.textContent).find((t) => /Kontrol noktaları/.test(t))?.slice(0, 80) }));
await page.screenshot({ path: '/tmp/wb-new-shots/menu-ozel-oyun-vagon.png' });
ok = ok && st.mapOn === 'Maden Ocağı' && !!st.hint;
console.log(JSON.stringify(st), 'hata', errs.length, errs.slice(0, 2).join(' | '));
console.log(ok && !errs.length ? 'sonuç: OK' : 'sonuç: HATA');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
