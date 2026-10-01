// Menü ekran görüntüleri: node scripts/menushot.mjs <önek> [ekran,ekran...] ; ekranlar: home custom loadout settings controls
import { chromium } from 'playwright';
const [prefix = 'screenshots/tmp-menu', list = 'home,custom,loadout,settings,controls'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text()));
await p.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?${process.env.Q || ''}`);
await p.waitForSelector('.mn-nav', { timeout: 30000 });
await p.waitForTimeout(2500);
for (const s of list.split(',')) {
  await p.click(`.mn-nav[data-v=${s}]`);
  await p.waitForTimeout(s === 'loadout' ? 3500 : 2500);
  await p.screenshot({ path: `${prefix}-${s}.png` });
}
console.log('hatalar:', [...new Set(errs)].slice(0, 8));
await b.close();
