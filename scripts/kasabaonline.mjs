// Kasaba çevrim içi duman testi: iki tarayıcı istemcisi aynı odada (yerel sunucu), harita yüklenir, hata yok, sunucu ve istemci çarpışma sayısı aynı.
//   node scripts/kasabaonline.mjs   [URL=http://127.0.0.1:5263] [WS=ws://127.0.0.1:8893] [OUT=/tmp/wb-kasaba/sonra]
import { chromium } from 'playwright';
const URL0 = process.env.URL || 'http://127.0.0.1:5263', WS = process.env.WS || 'ws://127.0.0.1:8893', OUT = process.env.OUT || '/tmp/wb-kasaba/sonra';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK    ' : 'HATA  ') + m); if (!c) fail++; };
const mk = async (q) => {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await page.goto(`${URL0}/?${q}`); return { page, errs };
};
const A = await mk(`online=new&type=tdm&per=3&map=kasaba&debug=1&nolock=1&server=${WS}&name=Ali`);
await A.page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await A.page.waitForTimeout(1500);
const room = await A.page.evaluate(() => new URLSearchParams(location.search).get('online'));
const B = await mk(`online=${room}&debug=1&nolock=1&server=${WS}&name=Veli`);
await B.page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await A.page.waitForTimeout(3000);
const ia = await A.page.evaluate(() => ({ map: window.__game.map.id, cols: window.__game.map.colliders.length, n: window.__game.soldiers.length }));
const ib = await B.page.evaluate(() => ({ map: window.__game.map.id, cols: window.__game.map.colliders.length, n: window.__game.soldiers.length }));
ok(ia.map === 'kasaba' && ib.map === 'kasaba', `iki istemci de Kasaba'da (oda ${room})`);
ok(ia.cols === ib.cols && ia.cols > 1000, `çarpışma kutusu sayısı aynı: ${ia.cols} / ${ib.cols}`);
// A ileri yürüsün (W), konum değişsin ve B onu görsün
const p0 = await A.page.evaluate(() => ({ ...window.__game.playerSoldier.pos }));
await A.page.keyboard.down('KeyW'); await A.page.waitForTimeout(1500); await A.page.keyboard.up('KeyW');
await A.page.waitForTimeout(600);
const p1 = await A.page.evaluate(() => ({ ...window.__game.playerSoldier.pos }));
ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 2, `A yürüdü: ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
await A.page.screenshot({ path: `${OUT}/cevrimici-A.png` }); await B.page.screenshot({ path: `${OUT}/cevrimici-B.png` });
ok(A.errs.length === 0 && B.errs.length === 0, `konsol hatası yok (A ${A.errs.length}, B ${B.errs.length}) ${[...A.errs, ...B.errs].slice(0, 2).join(' | ')}`);
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
