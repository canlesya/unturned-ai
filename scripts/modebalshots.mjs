// 12.197 görsel denetim (gerçek GPU): node scripts/modebalshots.mjs [url=http://127.0.0.1:5204]  → /tmp/wb-bal2/shot-*.png
//  Çöl Geçidi Ele Geçirme: yeni bayrak yerleri (pusula / harita / üç bayrağın başında birinci şahıs), TDM devre arası bildirimi, berabere sonuç ekranı
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5204', OUT = '/tmp/wb-bal2';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const errs = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
page.on('pageerror', (e) => errs.push(e.message));
const go = async (q) => { await page.goto(`${base}/?${q}&debug=1&nolock=1`, { timeout: 180000 }); await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 300000, polling: 500 }); await page.waitForTimeout(2500); };
await go('autostart=8v8&map=colgecidi&type=conquest&dev=1');
for (const id of ['uzun', 'orta', 'tunel']) {
  await page.evaluate((id) => {
    const g = window.__game, o = g.mode.objectives.find((q) => q.id === id), s = g.playerSoldier;
    g.brainsOff = g.brains.splice(0);
    s.pos.set(o.x - 6, g.world.heightAt(o.x - 6, o.z + 6), o.z + 6); g.world.settle(s); s.vel.set(0, 0, 0);
    s.yaw = Math.atan2(-(o.x - s.pos.x), -(o.z - s.pos.z)); s.pitch = -0.08;
  }, id);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/shot-cg-bayrak-${id}.png` });
}
// bayrağın içinde: ele geçirme yazısı
await page.evaluate(() => { const g = window.__game, o = g.mode.objectives.find((q) => q.id === 'orta'), s = g.playerSoldier; s.pos.set(o.x, g.world.heightAt(o.x, o.z), o.z); g.world.settle(s); });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/shot-cg-bayrak-alinıyor.png` });
// TDM devre arası + berabere
await go('autostart=6v6&map=colgecidi&type=tdm&tickets=20');
await page.evaluate(() => { const g = window.__game; g.tickets.blue = 10; g.tickets.red = 7; });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/shot-tdm-devre-arasi.png` });
const st = await page.evaluate(() => ({ half: window.__game.halfDone, swap: window.__game.swapSides }));
await page.evaluate(() => { const g = window.__game; g.tickets.blue = 15; g.tickets.red = 15; g.timeLeft = 0.2; });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/shot-tdm-berabere.png` });
const end = await page.evaluate(() => ({ t: document.querySelector('#etitle')?.textContent, i: document.querySelector('#einfo')?.textContent }));
console.log(JSON.stringify({ st, end, errs: errs.slice(0, 3) }));
await browser.close();
