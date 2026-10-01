import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs=[]; p.on('pageerror', e=>errs.push(e.message)); p.on('console', m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://127.0.0.1:5173/'); await p.waitForTimeout(1500);
await p.click('.mapc[data-k=us]'); await p.waitForTimeout(300);
await p.screenshot({ path: 'screenshots/menu-haritalar.png' });
console.log(errs);
await b.close();
