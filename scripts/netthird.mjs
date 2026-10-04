// 3. şahıs çevrimiçi: kamera ile karakter modeli arasındaki mesafe kareler arasında ne kadar oynuyor? (titreme ölçüsü) node scripts/netthird.mjs [lerp=1|0]
import { chromium } from 'playwright';
const lerp = process.argv[2] !== '0';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
if (process.env.HZ) await page.addInitScript((ms) => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), ms); }, 1000 / +process.env.HZ);
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?online=new&type=conquest&per=6&third=1&debug=1&nolock=1&server=${process.env.WSURL || 'ws://127.0.0.1:8790'}&name=T3`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await page.evaluate((lerp) => {
  const g = window.__game, P = Object.getPrototypeOf(g); g.modelLerp = lerp; const acc = (window.__j = { d: [], n: 0 });
  P.render = function () { const me = this.playerSoldier, c = this.camera.position, m = me.model.root.position; const L = (acc.L ||= { m: null, c: null, dm: [], dc: [] }); if (L.m) { L.dm.push(Math.hypot(m.x - L.m[0], m.z - L.m[1])); L.dc.push(Math.hypot(c.x - L.c[0], c.z - L.c[1])); (L.rel ||= []).push(c.x - m.x); } L.m = [m.x, m.z]; L.c = [c.x, c.z]; acc.d.push(1); };
}, lerp);
await page.waitForTimeout(2500);
if (!process.env.FIRST) { await page.keyboard.press('KeyH'); } await page.waitForTimeout(1500);
await page.evaluate(() => { window.__j.d.length = 0; window.__j.L.dm.length = 0; window.__j.L.dc.length = 0; });
await page.evaluate(() => { const g = window.__game; g.online.send({ t: 'dbg', tp: [-70, 0.6] }); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const p = window.__game.playerSoldier; p.yaw = -Math.PI / 2; });
await page.evaluate(() => { window.__j.L.dm.length = 0; window.__j.L.dc.length = 0; window.__j.L.rel = []; });
await page.keyboard.down('KeyW');
for (let i = 0; i < 9; i++) { await page.waitForTimeout(1000); await page.evaluate(() => { window.__game.playerSoldier.yaw = -Math.PI / 2; }); }
await page.keyboard.up('KeyW');
const r = await page.evaluate(() => {
  const st = (d) => { d = d.filter((x) => x > 0.0005); const mean = d.reduce((a, b) => a + b, 0) / d.length; const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length); return { n: d.length, adım: +mean.toFixed(4), sd: +sd.toFixed(4), cv: +(sd / mean).toFixed(2) }; };
  const L = window.__j.L; const rel = L.rel.slice(40), mean = rel.reduce((a, b) => a + b, 0) / rel.length; const sdRel = Math.sqrt(rel.reduce((a, b) => a + (b - mean) ** 2, 0) / rel.length);
  return { model: st(L.dm), kamera: st(L.dc), kameraModelFarkSd: +sdRel.toFixed(4), third: window.__game.player.third };
});
console.log('seri(kamera adım mm):', JSON.stringify(await page.evaluate(() => window.__j.L.dc.slice(60, 100).map((x) => Math.round(x * 1000)))), JSON.stringify(await page.evaluate(() => window.__j.L.dm.slice(60, 100).map((x) => Math.round(x * 1000)))));
console.log(`modelLerp=${lerp}:`, JSON.stringify(r), 'hata', errs.length);
await browser.close();
