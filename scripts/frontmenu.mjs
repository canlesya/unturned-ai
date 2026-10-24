// Cephe modu menüde: Özel Oyun mod kartı, harita kendiliğinden Batı Cephesi, Oyna → maç Cephe modunda açılır.  node scripts/frontmenu.mjs [url=http://127.0.0.1:5180] [görsel klasörü]
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', OUT = process.argv[3] || '/tmp/wb-cephe/menu';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(base + '/?debug=1&nolock=1&nologin=1');
await page.waitForTimeout(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('[data-a]')].find((e) => /Özel Oyun/i.test(e.textContent)); b?.click(); });
await page.waitForTimeout(800);
const card = await page.$('[data-a="type"][data-v="front"]');
let ok = !!card;
if (card) { await card.click(); await page.waitForTimeout(900); }
const st = await page.evaluate(() => ({ card: document.querySelector('[data-a="type"][data-v="front"]')?.textContent.slice(0, 60), mapOn: document.querySelector('.mapc.on b')?.textContent, hint: [...document.querySelectorAll('.sc')].map((e) => e.textContent).find((t) => /Sektörler/.test(t))?.slice(0, 90) }));
await page.screenshot({ path: `${OUT}/menu-ozel-oyun-cephe.png` });
ok = ok && st.mapOn === 'Batı Cephesi' && !!st.hint;
if (ok) {                                                                       // Oyna → Cephe maçı
  await page.evaluate(() => { const b = [...document.querySelectorAll('button.play')].find((e) => /Oyna|Başlat/i.test(e.textContent)) || document.querySelector('button.play'); b?.click(); });
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 }).catch(() => {});
  const m = await page.evaluate(() => ({ type: window.__game?.mode.type, map: window.__game?.mapDef.id, front: !!window.__game?.front }));
  st.match = m; ok = m.type === 'front' && m.map === 'cephe' && m.front;
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/mac-hud.png` });
}
console.log(JSON.stringify(st), 'hata', errs.length, errs.slice(0, 2).join(' | '));
console.log(ok && !errs.length ? 'sonuç: OK' : 'sonuç: HATA');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
