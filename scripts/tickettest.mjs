// 1v1 bayrak maçında biletlerin zamanla nasıl azaldığını (bayrak kanaması) gösterir.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=1v1&tickets=50&debug=1&nolock=1&type=conquest`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 60000 });
const rows = await page.evaluate(() => {
  const g = window.__game, out = []; g.playerSoldier.invuln = 1e9;
  for (let t = 0; t <= 400; t++) {
    for (let i = 0; i < 30; i++) g.step(1 / 30);
    if (t % 20 === 0) out.push({ t, tk: [Math.round(g.tickets.blue), Math.round(g.tickets.red)], flags: g.mode.objectives.map((o) => (o.owner || '-')[0] + o.p.toFixed(1)).join(' '), ended: g.ended });
    if (g.ended) { out.push({ t, ended: true }); break; }
  }
  return out;
});
rows.forEach((r) => console.log(JSON.stringify(r)));
await browser.close();
