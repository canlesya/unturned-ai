// Silah kaplaması uçtan uca (12.122, gerçek GPU): menüde çip seç → localStorage'a yazılır, yenileyince seçili kalır → oyunda birinci şahıs modeli o kaplamada →
// çevrimiçinde ikinci istemci birinci oyuncunun silahını 3. şahısta aynı kaplamada görür (anlık görüntü sk alanı) + sunucu bilinmeyen kaplamayı atar.
//   node scripts/skintest.mjs [taban url] [ws url]      (örn. http://127.0.0.1:5281 ws://127.0.0.1:8881)   OUT=klasör → görüntüler
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5281', WS = process.argv[3] || 'ws://127.0.0.1:8881', OUT = process.env.OUT || '/tmp/wb-skintest';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
let fail = 0; const errs = [];
const check = (ok, m) => { console.log((ok ? 'OK    ' : 'HATA  ') + m); if (!ok) fail++; };
const newPage = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message)); return { ctx, page }; };

// 1) menü: Saldırı → ana silah M4A1 → "Altın" çipi
{
  const { ctx, page } = await newPage();
  await page.goto(base + '/?touch=0'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('warbyte.lang', 'tr'); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); });
  await page.goto(base + '/?touch=0'); await page.waitForSelector('.mn-nav', { timeout: 60000 }); await page.waitForTimeout(800);
  await page.click('.mn-nav[data-v=loadout]'); await page.waitForTimeout(800);
  check(await page.locator('[data-a=skin]').count() === 5, 'menü: M4A1 kartının altında 5 kaplama çipi');
  await page.click('[data-a=skin][data-v=gold]'); await page.waitForTimeout(600);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.v2') || '{}').skins);
  check(st && st.m4a1 === 'gold', `menü: seçim kalıcı (localStorage skins = ${JSON.stringify(st)})`);
  await page.screenshot({ path: `${OUT}/menu-gold.png` });
  await page.reload(); await page.waitForSelector('.mn-nav', { timeout: 60000 }); await page.click('.mn-nav[data-v=loadout]'); await page.waitForTimeout(800);
  check(await page.locator('[data-a=skin][data-v=gold].on').count() === 1, 'menü: yenileyince "Altın" seçili');
  const prev = await page.evaluate(() => document.querySelector('[data-a=skin].on')?.textContent);
  check(prev === 'Altın', `menü: çip adı i18n (${prev})`);
  await page.click('.lg[data-v=en]').catch(() => {}); await page.waitForTimeout(400);
  const en = await page.evaluate(() => [...document.querySelectorAll('[data-a=skin]')].map((b) => b.textContent).join(','));
  check(en.includes('Gold') && !/[ğüşıöçİĞÜŞÖÇ]/.test(en), `menü: İngilizce (${en})`);
  // 2) çevrimdışı maç: birinci şahıs + 3. şahıs (kendi modeli) altın
  await page.goto(base + '/?autostart=2v2&map=colgecidi&type=tdm&debug=1&nolock=1&third=0');
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  const fp = await page.evaluate(() => { const g = window.__game, w = g.player.vm.model.children.find((c) => c.userData.id); return { id: w?.userData.id, skin: w?.userData.skin, s3: !!w?.userData.s3 }; });
  check(fp.id === 'm4a1' && fp.skin === 'gold' && fp.s3, `oyun: birinci şahıs M4A1 kaplaması ${JSON.stringify(fp)}`);
  await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/fp-gold.png` });
  const bot = await page.evaluate(() => { const g = window.__game; return g.soldiers.filter((s) => s !== g.playerSoldier && s.model?.weapon?.userData.s3).map((s) => s.model.weapon.userData.skin); });
  check(bot.every((k) => k === 'std'), `oyun: botların S3 silahları standart (${bot.join(',')})`);
  await ctx.close();
}
// 3) çevrimiçi: A (altın M4 + şehir camo Glock) oda kurar, B katılır → B, A'nın silahını altın görür; A Glock'a geçince B şehir camo görür
{
  const A = await newPage(), B = await newPage();
  await A.page.goto(base + '/?touch=0'); await A.page.evaluate(() => { localStorage.clear(); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); localStorage.setItem('warbyte.v2', JSON.stringify({ skins: { m4a1: 'gold', pistol: 'urban', mp5: 'gold', ak47: '<script>' } })); });
  await A.page.goto(`${base}/?online=new&server=${encodeURIComponent(WS)}&name=Kaplamaci&map=colgecidi&type=tdm&per=2&bots=0&debug=1&nolock=1&touch=0`);
  await A.page.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.playerSoldier.alive', null, { timeout: 120000 });
  const room = await A.page.evaluate(() => new URLSearchParams(location.search).get('online'));
  const aid = await A.page.evaluate(() => window.__game.playerSoldier.id);
  await B.page.goto(base + '/?touch=0'); await B.page.evaluate(() => { localStorage.clear(); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); });
  await B.page.goto(`${base}/?online=${room}&server=${encodeURIComponent(WS)}&name=Izleyici&debug=1&nolock=1&touch=0`);
  await B.page.waitForFunction('window.__game && window.__game.running && window.__game.online && window.__game.playerSoldier.alive', null, { timeout: 120000 });
  const seen = async () => B.page.evaluate((aid) => { const s = window.__game.soldiers[aid], w = s?.model?.weapon; return { id: w?.userData.id, skin: w?.userData.skin, skins: s?.skins, alive: s?.alive }; }, aid);
  let r = null; for (let i = 0; i < 40; i++) { r = await seen(); if (r.skin === 'gold') break; await B.page.waitForTimeout(250); }
  check(r.id === 'm4a1' && r.skin === 'gold', `çevrimiçi: B, A'nın M4A1'ini 3. şahısta altın görüyor ${JSON.stringify(r)}`);
  check(r.skins && !('ak47' in r.skins) && !('mp5' in r.skins), `çevrimiçi: sunucu geçersiz kaplamayı / S3 olmayan silahı attı ${JSON.stringify(r.skins)}`);
  await A.page.evaluate(() => window.__game.playerSoldier.switchTo(1));
  await A.page.evaluate(() => { const g = window.__game; g.online.edge?.('w'); });
  for (let i = 0; i < 40; i++) { r = await seen(); if (r.id === 'pistol') break; await B.page.waitForTimeout(250); }
  check(r.id === 'pistol' && r.skin === 'urban', `çevrimiçi: A Glock'a geçince B şehir camo Glock görüyor ${JSON.stringify(r)}`);
  // görüntü: B'nin kamerası A'ya bakar, 3. şahıs
  await B.page.evaluate((aid) => { const g = window.__game, a = g.soldiers[aid], me = g.playerSoldier; me.pos.set(a.pos.x + 2.2, a.pos.y, a.pos.z + 1.2); me.yaw = Math.atan2(-(a.pos.x - me.pos.x), -(a.pos.z - me.pos.z)); me.pitch = -0.12; }, aid);
  await B.page.waitForTimeout(700); await B.page.screenshot({ path: `${OUT}/third-online.png` });
  const fpA = await A.page.evaluate(() => { const w = window.__game.player.vm.model.children.find((c) => c.userData.id); return w?.userData.skin; });
  check(fpA === 'urban', `çevrimiçi: A'nın kendi birinci şahıs Glock'u şehir camo (${fpA})`);
  await A.ctx.close(); await B.ctx.close();
}
check(!errs.length, `sayfa hatası yok ${errs.slice(0, 3).join(' | ')}`);
await browser.close();
console.log(fail ? `\n${fail} HATA` : '\nTÜMÜ TAMAM');
process.exit(fail ? 1 : 0);
