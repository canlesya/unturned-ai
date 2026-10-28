import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = '/tmp/wb-squad/once';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const kill = () => { const g = window.__game; g.playerSoldier.protT = 0; g.playerSoldier.takeDamage(999, g.soldiers.find((s) => s.team !== g.playerSoldier.team), 'body', g.playerSoldier.pos, 'AK-47'); };
for (const [nm, map] of [['kuzey', 'kuzey'], ['cg', 'colgecidi']]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`http://127.0.0.1:5184/?autostart=8v8&map=${map}&type=conquest&debug=1&nolock=1`);
  await page.waitForFunction(() => window.__game?.running && window.__game.time > 1, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${nm}-hud.png` });
  await page.evaluate(kill);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${nm}-death.png` });
  await ctx.close();
}
const ctx = await browser.newContext({ ...(({ defaultBrowserType, ...r }) => r)(devices['Pixel 7 landscape']) });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5184/?autostart=8v8&map=kuzey&type=conquest&debug=1&nolock=1&touch=1');
await page.waitForFunction(() => window.__game?.running && window.__game.time > 1, null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/mob-hud.png` });
await page.evaluate(kill);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/mob-death.png` });
console.log(await page.evaluate(() => [innerWidth, innerHeight]));
await browser.close();
