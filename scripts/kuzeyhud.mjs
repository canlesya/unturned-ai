// Kuzey Vadisi (12.172) oyun içi denetim (tarayıcı): savaş alanı uyarısı + 10 sn sonra ölüm, ön hat doğuş seçeneği, maç boyu gün ışığı (gün batımı),
// hayvan / ses / pencere ışığı nesneleri.  node scripts/kuzeyhud.mjs [klasör]
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5391', OUT = process.argv[2] || '/tmp/wb-buyuk/son';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x ? ' · ' + x : '')); if (!c) fails++; };
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&debug=1&nolock=1&tod=sunset&time=1200`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
await page.waitForTimeout(1500);
// 1 gün döngüsü: başlangıç saati ve maç sonuna yakın saat
const h0 = await page.evaluate(() => window.__game.map.fx.hour);
await page.screenshot({ path: `${OUT}/dongu-baslangic.png` });
await page.evaluate(() => { const g = window.__game; g.timeLeft = 60; });
await page.waitForTimeout(3500);
const h1 = await page.evaluate(() => window.__game.map.fx.hour);
await page.screenshot({ path: `${OUT}/dongu-son.png` });
ok(h0 < 16.6 && h1 > 19.4, '1 maç boyu gün ışığı (gün batımı: ikindi → alacakaranlık)', `${h0.toFixed(2)} → ${h1.toFixed(2)}`);
// 2 savaş alanı uyarısı + ölüm
await page.evaluate(() => { const g = window.__game, s = g.playerSoldier; g.timeLeft = 900; for (const b of g.brains) b.update = () => {}; s.protT = 0; s.pos.set(782, g.world.heightAt(782, 0) + 0.1, 0); window.__oobPin = setInterval(() => { if (s.alive) { s.pos.x = 782; s.pos.z = 0; } }, 50); });
await page.waitForTimeout(2500);
const w = await page.evaluate(() => ({ shown: document.getElementById('zonew').style.display, t: document.getElementById('zonett').textContent, n: document.getElementById('zonet').textContent }));
await page.screenshot({ path: `${OUT}/sinir-uyari.png` });
ok(w.shown === 'block' && /SAVAŞ ALANINA/.test(w.t), '2a "Savaş alanına dön" uyarısı + geri sayım', `${w.t} · ${w.n}`);
await page.waitForTimeout(9000);
const dead = await page.evaluate(() => ({ alive: window.__game.playerSoldier.alive }));
await page.screenshot({ path: `${OUT}/sinir-olum.png` });
ok(!dead.alive, '2b 10 sn sonra ölüm');
await page.evaluate(() => clearInterval(window.__oobPin));
// 3 ön hat doğuşu
const sp = await page.evaluate(() => { const g = window.__game, o = g.mode.objectives; o[1].owner = 'blue'; o[2].owner = 'red'; const opts = g.spawnOptions('blue'); const f = g.frontFlag('blue'); return { ids: opts.map((q) => q.id + (q.ok ? '' : '×')), front: f?.id }; });
ok(sp.ids.includes('front') && sp.front, '3 ön hat doğuş seçeneği (sahip olunan, düşmana en yakın bayrak)', `${sp.ids.join(' ')} → ${sp.front}`);
// 4 görsel katmanlar
const vis = await page.evaluate(() => { const fx = window.__game.map.fx; return { cows: fx.fauna.kinds.cow.im.count, crows: fx.fauna.kinds.crow.im.count, deer: fx.fauna.kinds.deer.im.count, grass: fx.grass.count, windows: fx.life.windows.geometry.attributes.position.count / 6, smoke: fx.life.smoke.geometry.attributes.position.count, amb: !!fx.atm }; });
ok(vis.cows > 0 && vis.crows > 0 && vis.windows > 50, '4 hayvan / ot / pencere / duman katmanları', JSON.stringify(vis));
ok(!errs.length, '5 sayfa hatası yok', errs.slice(0, 3).join(' | '));
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
await browser.close();
process.exit(fails ? 1 : 0);
