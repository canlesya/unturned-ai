// Liman tarayıcıdan çevrimiçi oda: ?online=new&map=liman → oyun açılıyor mu, harita liman mı, ekran görüntüsü.
//   node scripts/limanonline.mjs [url=http://127.0.0.1:5196] [ws=ws://127.0.0.1:8802]   → /tmp/wb-liman-shots/online.png
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5196', ws = process.argv[3] || 'ws://127.0.0.1:8802';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?online=new&map=liman&per=5&type=conquest&tod=sunset&server=${encodeURIComponent(ws)}&debug=1&nolock=1&name=Test`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.online', null, { timeout: 120000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => { const g = window.__game; return { map: g.map.id, soldiers: g.soldiers.length, me: g.playerSoldier && [g.playerSoldier.pos.x, g.playerSoldier.pos.z].map((v) => +v.toFixed(1)) }; });
await page.screenshot({ path: '/tmp/wb-liman-shots/online.png' });
console.log(JSON.stringify(r), 'hata:', errs.length, errs.slice(0, 3).join(' | '));
console.log(r.map === 'liman' && !errs.length ? 'sonuç: OK' : 'sonuç: HATA');
await browser.close();
