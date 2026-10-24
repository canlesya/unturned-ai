// Davet linki (12.133): /?online=KOD (ad yok) → takma ad ekranı → odaya katılım. İki oyuncu (masaüstü + Pixel 7), botsuz, harita / saat / hava / mod
// odadaki gibi mi; maç bitince aynı ayarlarla kendiliğinden yeni maç (sunucu BF_RESTART_MS kısa, odanın time'ı kısa olmalı).
//   node scripts/invitelink.mjs <istemci url> <ws url> <oda kodu>   (WAIT=1 → maç sonu yeniden başlamayı da bekle)   → /tmp/wb-inv/*.png
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const [base = 'http://127.0.0.1:5180', ws = 'ws://127.0.0.1:8836', code = 'OFC1'] = process.argv.slice(2), OUT = '/tmp/wb-inv';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
let fails = 0; const check = (ok, m) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${m}`); if (!ok) fails++; };
const pages = [];
for (const [dev, nick] of [['desk', 'Kanka1'], ['mob', 'Kanka2']]) {
  const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1280, height: 720 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
  const page = await ctx.newPage(), errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?online=${code}&server=${encodeURIComponent(ws)}&debug=1&nolock=1`);
  await page.waitForSelector('#nkName', { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/${dev}-nick.png` });
  check(await page.locator('#nkName').isVisible(), `${dev}: takma ad ekranı açıldı`);
  await page.fill('#nkName', nick); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier, null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => { const g = window.__game, c = g.opts.online.cfg; return { map: c.map, tod: c.tod, weather: c.weather, type: c.type, bots: c.bots, name: g.playerSoldier.name, url: location.search, n: g.soldiers.length }; });
  console.log(dev, JSON.stringify(r));
  check(r.map === 'colgecidi' && r.tod === 'day' && r.weather === 'clear' && r.type === 'dm' && r.bots === false, `${dev}: oda Çöl Geçidi / gündüz / açık / ölüm maçı / botsuz`);
  check(r.name === nick, `${dev}: oyundaki ad ${r.name}`);
  check(/name=/.test(r.url), `${dev}: adres çubuğunda ad (yenileyince tekrar sorulmaz)`);
  await page.screenshot({ path: `${OUT}/${dev}-oyunda.png` });
  pages.push({ dev, page, errs });
}
await pages[0].page.waitForTimeout(1500);
const n = await pages[0].page.evaluate(() => window.__game.soldiers.filter((s) => s.alive && !s.vacant && !/^Boş$/.test(s.name)).map((s) => s.name));
check(n.length === 2, `odada canlı ${n.length} asker (${n.join(', ')}; diğer yerler boş, bot yok)`);
if (process.env.WAIT === '1') {
  const { page } = pages[0];
  const t0 = await page.evaluate(() => window.__game.matchId ?? window.__game.startedAt ?? 0);
  console.log('maç sonu bekleniyor…');
  await page.waitForFunction(() => window.__game?.ended || window.__game?.mode?.ended, null, { timeout: 120000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/desk-bitti.png` });
  const g0 = await page.evaluateHandle(() => window.__game);
  await page.waitForFunction((g) => window.__game && window.__game !== g && window.__game.running, g0, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const r2 = await page.evaluate(() => { const c = window.__game.opts.online.cfg; return { map: c.map, tod: c.tod, weather: c.weather, type: c.type, n: window.__game.soldiers.length }; });
  console.log('yeni maç', JSON.stringify(r2), t0);
  check(r2.map === 'colgecidi' && r2.tod === 'day' && r2.weather === 'clear' && r2.type === 'dm', 'maç bitince aynı ayarlarla yeni maç başladı');
  await page.screenshot({ path: `${OUT}/desk-yenimac.png` });
}
for (const p of pages) check(!p.errs.length, `${p.dev}: sayfa hatası yok ${p.errs.slice(0, 2).join(' | ')}`);
await browser.close();
console.log(fails ? `sonuç: HATA (${fails})` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
