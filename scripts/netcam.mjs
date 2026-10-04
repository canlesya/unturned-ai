import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
if (process.env.HZ) await page.addInitScript((ms) => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), ms); }, 1000 / +process.env.HZ);
if (process.env.NOLERP) await page.addInitScript(() => { window.__NOLERP = 1; });
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?online=new&type=conquest&per=6&third=1&debug=1&nolock=1&server=${process.env.WSURL || 'ws://127.0.0.1:8790'}&name=T3${process.env.NOLERP ? '&nolerp=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await page.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g), A = (window.__a = []); g.modelLerp = !window.__NOLERP; let last = performance.now();
  P.render = function () { const me = this.playerSoldier, c = this.camera.position, m = me.model.root.position, n = performance.now(); A.push({ dt: n - last, rx: c.x - m.x, mx: m.x, cx: c.x, ry: c.y - m.y, hit: this.player.camHit || 0, vo: Math.hypot(this.online.viewOff.x, this.online.viewOff.z) }); last = n; };
});
await page.waitForTimeout(2500); await page.keyboard.press('KeyH'); await page.waitForTimeout(1500);
await page.evaluate(() => { window.__game.online.send({ t: 'dbg', tp: [-70, 0.6] }); }); await page.waitForTimeout(1200);
await page.evaluate(() => { window.__game.playerSoldier.yaw = -Math.PI / 2; window.__a.length = 0; });
await page.keyboard.down('KeyW');
for (let i = 0; i < 4; i++) { await page.waitForTimeout(1000); await page.evaluate(() => { window.__game.playerSoldier.yaw = -Math.PI / 2; }); }
await page.keyboard.up('KeyW');
console.log(JSON.stringify(await page.evaluate(() => window.__a.slice(100, 118).map((x) => [Math.round(x.mx * 1000), Math.round(x.cx * 1000)].join(":")))));
console.log(JSON.stringify(await page.evaluate(() => { const v = window.__a.slice(60, 300).map((x) => x.rx * 100); const m = v.reduce((a, b) => a + b, 0) / v.length; return { n: v.length, rxSdCm: +Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length).toFixed(2), rxMinMax: [Math.min(...v), Math.max(...v)].map((x) => +x.toFixed(1)) }; })));
console.log('modelLerp=', await page.evaluate(() => window.__game.modelLerp), await page.evaluate(() => location.search.slice(-30)));
await browser.close();
