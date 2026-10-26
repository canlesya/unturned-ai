// 12.174 Cephe dönem nişangâhı seçimi (çevrimdışı): Cephanelik → Cephe (1940'lar) bölümü (silah + nişangâh çipleri, kayıt frontLoadouts / frontOptics; modern kayıt bozulmaz),
// Özel Oyun → Cephe ile maç: menüde seçilen silah + nişangâhla doğuş, B ile dönem nişangâhları arasında dönüş (modern yok, kalıcı kayıt), ölüm ekranında Silah / Nişangâh satırı.
//   node scripts/ww2opticmenu.mjs [url] [görsel klasörü]
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', OUT = process.argv[3] || '/tmp/wb-ww2optic/menu';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' })).newPage();
const errs = [], res = {}, fail = [];
page.on('pageerror', (e) => errs.push(e.message));
const click = (sel) => page.evaluate((s) => { const e = document.querySelector(s); e?.click(); return !!e; }, sel);
const prefs = () => page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.v2') || '{}'));
await page.goto(base + '/?debug=1&nolock=1&nologin=1');
await page.waitForTimeout(2500);
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('warbyte.v2') || '{}'); p.cls = 'assault'; p.optic = 'holo'; p.loadouts = { assault: { primary: 'm4a1' } }; p.frontLoadouts = {}; p.frontOptics = {}; localStorage.setItem('warbyte.v2', JSON.stringify(p)); });
await page.reload(); await page.waitForTimeout(2500);
// Cephanelik → Cephe
await click('[data-a="go"][data-v="loadout"]'); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/1-cephanelik-modern.png` });
if (!(await click('[data-a="loera"][data-v="front"]'))) fail.push('Cephe sekmesi yok');
await page.waitForTimeout(700);
await click('[data-a="fpick"][data-v="ww_bolt"]'); await page.waitForTimeout(500);
res.chips = await page.evaluate(() => [...document.querySelectorAll('[data-a="fopt"]')].map((b) => b.dataset.v));
if (JSON.stringify(res.chips) !== JSON.stringify(['iron', 'ww_peep', 'ww_scout', 'ww_sc25', 'ww_sc4'])) fail.push('sürgülü tüfek nişangâh çipleri ' + res.chips);
await click('[data-a="fopt"][data-v="ww_scout"]'); await page.waitForTimeout(1500);
await page.evaluate(() => { const sc = document.querySelector('.mn-stage .scroll'); if (sc) sc.scrollTop = 1e5; }); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/2-cephanelik-cephe-surgulu-oncu.png` });
await click('[data-a="cls"][data-v="sniper"]'); await page.waitForTimeout(500);
res.sniperChips = await page.evaluate(() => [...document.querySelectorAll('[data-a="fopt"]')].map((b) => b.dataset.v));
await click('[data-a="cls"][data-v="heavy"]'); await page.waitForTimeout(500);
await page.evaluate(() => { const sc = document.querySelector('.mn-stage .scroll'); if (sc) sc.scrollTop = 1e5; }); await page.waitForTimeout(300);
res.heavyChips = await page.evaluate(() => [...document.querySelectorAll('[data-a="fopt"]')].map((b) => b.dataset.v));
await page.screenshot({ path: `${OUT}/3-cephanelik-cephe-agir.png` });
if (res.heavyChips.some((o) => !['iron', 'ww_peep'].includes(o))) fail.push('makinelide dürbün var');
await click('[data-a="cls"][data-v="assault"]'); await page.waitForTimeout(400);
const P = await prefs();
res.saved = { fl: P.frontLoadouts, fo: P.frontOptics, modern: P.loadouts, optic: P.optic };
if (P.frontLoadouts?.assault?.primary !== 'ww_bolt' || P.frontOptics?.ww_bolt !== 'ww_scout') fail.push('Cephe kaydı yok');
if (P.loadouts?.assault?.primary !== 'm4a1' || P.optic !== 'holo') fail.push('modern kayıt bozuldu');
// Özel Oyun → Cephe → Oyna
await click('[data-a="go"][data-v="custom"]'); await page.waitForTimeout(700);
await click('[data-a="type"][data-v="front"]'); await page.waitForTimeout(700);
await page.evaluate(() => { const b = document.querySelector('button.play'); b?.click(); });
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 180000 });
await page.waitForTimeout(1500);
const g0 = await page.evaluate(() => { const g = window.__game, s = g.playerSoldier; g.brains.length = 0; g.devGod = true; return { mode: g.mode.type, item: s.item.id, optic: s.opticId, model: g.player.vm.model?.children[0]?.userData.optic }; });
res.spawn = g0;
if (g0.item !== 'ww_bolt' || g0.optic !== 'ww_scout' || g0.model !== 'ww_scout') fail.push('doğuş silah / nişangâh ' + JSON.stringify(g0));
// B ile dönüş
res.cycle = [];
for (let i = 0; i < 5; i++) { await page.keyboard.press('KeyB'); await page.waitForTimeout(250); res.cycle.push(await page.evaluate(() => window.__game.playerSoldier.opticId)); }
if (JSON.stringify(res.cycle) !== JSON.stringify(['ww_sc25', 'ww_sc4', 'iron', 'ww_peep', 'ww_scout'])) fail.push('B dönüşü ' + res.cycle);
await page.keyboard.press('KeyB'); await page.waitForTimeout(300);          // → 2,5×
await page.evaluate(() => { window.__game.playerSoldier.ads = true; });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/4-oyun-B-25x-nisan.png` });
await page.evaluate(() => { window.__game.playerSoldier.ads = false; });
res.savedAfterB = (await prefs()).frontOptics;
if (res.savedAfterB?.ww_bolt !== 'ww_sc25') fail.push('B seçimi kaydedilmedi');
// tabanca: tek nişangâh (B etkisiz)
await page.keyboard.press('Digit2'); await page.waitForTimeout(500);
await page.keyboard.press('KeyB'); await page.waitForTimeout(250);
res.pistol = await page.evaluate(() => window.__game.playerSoldier.opticId);
if (res.pistol !== 'iron') fail.push('tabancada nişangâh ' + res.pistol);
// ölüm ekranı: Silah / Nişangâh satırı
await page.evaluate(() => { const g = window.__game, s = g.playerSoldier; g.devGod = false; s.protT = 0; s.die(s, 'test', false); });
await page.waitForTimeout(1200);
res.death = await page.evaluate(() => ({ on: document.getElementById('frkit')?.classList.contains('on'), w: [...document.querySelectorAll('#frkit [data-fa="w"]')].map((e) => e.dataset.v), o: [...document.querySelectorAll('#frkit [data-fa="o"]')].map((e) => e.dataset.v), cur: document.querySelector('#frkit [data-fa="o"].on')?.dataset.v }));
await page.evaluate(() => { document.querySelector('#frkit [data-fa="o"][data-v="ww_peep"]')?.click(); });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/5-olum-ekrani-donanim.png` });
res.deathPick = await page.evaluate(() => ({ cur: document.querySelector('#frkit [data-fa="o"].on')?.dataset.v, pref: window.__game.opts.frontOptics?.ww_bolt }));
if (!res.death.on || res.deathPick.cur !== 'ww_peep') fail.push('ölüm ekranı satırı ' + JSON.stringify(res.death) + JSON.stringify(res.deathPick));
await page.evaluate(() => { const g = window.__game; g.respawn(g.playerSoldier); });
await page.waitForTimeout(800);
res.respawn = await page.evaluate(() => ({ item: window.__game.playerSoldier.item.id, optic: window.__game.playerSoldier.opticId }));
if (res.respawn.optic !== 'ww_peep') fail.push('ölüm ekranı seçimi doğuşta yok ' + JSON.stringify(res.respawn));
console.log(JSON.stringify(res, null, 1));
console.log('sayfa hatası', errs.length, errs.slice(0, 3));
console.log(fail.length || errs.length ? 'sonuç: HATA ' + fail.join(' · ') : 'sonuç: OK');
await browser.close();
process.exit(fail.length || errs.length ? 1 : 0);
