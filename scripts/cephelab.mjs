// Cephe laboratuvarı sayfa görselleri: GPU=1 URL=http://127.0.0.1:5180 OUT=/tmp/wb-cephe/taslak node scripts/cephelab.mjs [görünüm:dosya[:sorgu],…]
// Varsayılan: silahlar (weapons), iki ordu (chars), sınıflar (chars&set=cls), yüzeyler (tex). W / H ile boyut.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-cephe/taslak';
fs.mkdirSync(OUT, { recursive: true });
const jobs = (process.argv[2] || 'weapons:silahlar-yandan,chars:ordular,chars:siniflar:set=cls,tex:dokular').split(',').map((s) => s.split(':'));
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) }, deviceScaleFactor: 1, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
for (const [view, file, q] of jobs) {
  await page.goto(`${URL0}/cephelab.html?view=${view}${q ? '&' + q : ''}`);
  await page.waitForFunction('window.__ready', null, { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${file}.png` });
  console.log('ok', file);
}
if (errs.length) console.log('HATA', errs);
await browser.close();
