// Menü akışı testi: Özel Oyun'da mod → harita → ayar seç, özet güncelleniyor mu, Oyna ile doğru maç başlıyor mu. node scripts/menuflow.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?debug=1&nolock=1`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.mn-nav', { timeout: 30000 }); await page.waitForTimeout(1500);
await page.click('.mn-nav[data-v=custom]'); await page.waitForTimeout(800);
const sum = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.pvl li')].map((li) => [li.children[0].textContent, li.children[1].textContent])));
const title = () => page.evaluate(() => document.querySelector('.pv h2').textContent.toLocaleUpperCase('tr'));
check((await title()) === 'KASABA' && (await sum()).Mod.includes('Ele Geçirme'), 'başlangıç: Ele Geçirme · Kasaba');
// 1) mod: Silah Yarışı → harita listesi aynı (3), özet güncellenir
await page.click('.mdc[data-v=gg]'); await page.waitForTimeout(500);
check((await sum()).Mod.includes('Silah Yarışı'), 'mod değişince özet güncellendi');
check(await page.evaluate(() => document.querySelectorAll('#bs2 .mapc').length) === 4, 'Silah Yarışı: 3 harita + rastgele');
// 2) harita: Vadi
await page.click('.mapc[data-v=vadi]'); await page.waitForTimeout(400);
check((await title()) === 'VADİ', 'harita seçimi özette');
// 3) oyuncu sayısı: preset 6
await page.click('#bs3 [data-a=size][data-v="6"]'); await page.waitForTimeout(400);
check((await sum()).Oyuncu === '6 kişi', 'oyuncu sayısı 6');
// 4) Enfekte: harita New York'a sabitlenir, bot Zor, gün saati gece
await page.click('.mdc[data-v=inf]'); await page.waitForTimeout(500);
check((await title()) === 'NEW YORK' && await page.evaluate(() => document.querySelectorAll('#bs2 .mapc').length) === 1, 'Enfekte: yalnızca New York');
const s2 = await sum(); check(s2.Botlar === 'Zor' && s2['Gün saati'].includes('Gece'), `Enfekte: botlar ${s2.Botlar}, gün saati ${s2['Gün saati']}`);
// 5) TDM'e dön: harita Kasaba'ya düşer
await page.click('.mdc[data-v=tdm]'); await page.waitForTimeout(500);
check((await title()) === 'KASABA' && /skor/.test((await sum())['Skor sınırı'] || ''), 'Enfekte → TDM: harita Kasaba, skor sınırı satırı');
// 6) Oyna: Silah Yarışı + Vadi + 6 kişi ile başlat
await page.click('.mdc[data-v=gg]'); await page.click('.mapc[data-v=vadi]'); await page.click('#bs3 [data-a=size][data-v="6"]'); await page.waitForTimeout(400);
await page.click('.pvbtn .play');
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
const g = await page.evaluate(() => ({ type: window.__game.mode.type, map: window.__game.map.id, n: window.__game.soldiers.length }));
check(g.type === 'gg' && g.map === 'vadi' && g.n === 6, `başlayan maç: ${JSON.stringify(g)}`);
// Oda kur ekranı (sunucu yoksa düğme pasif: zorla aç)
await page.evaluate(() => { location.hash = ''; });
await page.reload(); await page.waitForSelector('.mn-nav', { timeout: 30000 }); await page.waitForTimeout(1200);
await page.click('.mn-nav[data-v=online]'); await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelector('[data-a=oview][data-v=ocreate]'); b.removeAttribute('disabled'); b.click(); });
await page.waitForTimeout(600);
check(await page.evaluate(() => !!document.querySelector('#ocName') && document.querySelectorAll('.bsteps button').length === 4), 'Oda kur: Oda + Mod + Harita + Ayarlar adımları');
await page.click('.mdc[data-v=inf]'); await page.waitForTimeout(400);
check((await title()) === 'NEW YORK' && (await sum()).Botlar === 'Zor', 'Oda kur: Enfekte → New York, Zor botlar');
await page.click('.mdc[data-v=gg]'); await page.waitForTimeout(400); await page.click('.mapc[data-v=us]'); await page.waitForTimeout(300);
await page.click('#bs3 [data-a=olset][data-k=bots][data-v=false]'); await page.waitForTimeout(300);
const s3 = await sum(); check((await title()) === 'ASKERİ ÜS' && s3.Botlar === 'Kapalı' && /botsuz/.test(s3.Oyuncu), `Oda kur: Silah Yarışı · Askeri Üs · botsuz (${s3.Oyuncu})`);
console.log('hata:', errs.length, errs.slice(0, 2));
await browser.close(); process.exit(fail ? 1 : 0);
