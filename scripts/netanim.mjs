// 3. şahıs çevrimiçi: yerel karakterin animasyon girdileri (hız, yerde mi, gövde eğimi) kareden kareye sıçrıyor mu?
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?online=new&type=conquest&per=6&third=1&debug=1&nolock=1&server=${process.env.WSURL || 'ws://127.0.0.1:8790'}&name=T3`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await page.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g), A = (window.__a = []);
  P.render = function () { const me = this.playerSoldier, m = me.model; A.push({ spd: Math.hypot(me.vel.x, me.vel.z), og: me.onGround ? 1 : 0, air: me.airT || 0, tx: m.parts.torso.rotation.x, tz: m.parts.torso.rotation.z, ry: m.root.rotation.y, ph: me.walkPhase, py: m.root.position.y, hipL: m.parts.legs.L.hip.rotation.x }); };
});
await page.waitForTimeout(2500); await page.keyboard.press('KeyH'); await page.waitForTimeout(1500);
await page.evaluate(() => { window.__game.online.send({ t: 'dbg', tp: [-70, 0.6] }); }); await page.waitForTimeout(1200);
await page.evaluate(() => { window.__game.playerSoldier.yaw = -Math.PI / 2; window.__a.length = 0; });
await page.keyboard.down('KeyW');
for (let i = 0; i < 8; i++) { await page.waitForTimeout(1000); await page.evaluate(() => { window.__game.playerSoldier.yaw = -Math.PI / 2; }); }
await page.keyboard.up('KeyW');
const r = await page.evaluate(() => {
  const A = window.__a.slice(60), out = {};
  for (const k of Object.keys(A[0])) {
    const v = A.map((x) => x[k]); const d = v.slice(1).map((x, i) => Math.abs(x - v[i]));
    const mean = v.reduce((a, b) => a + b, 0) / v.length; const dm = d.reduce((a, b) => a + b, 0) / d.length;
    out[k] = { mean: +mean.toFixed(3), min: +Math.min(...v).toFixed(3), max: +Math.max(...v).toFixed(3), dMean: +dm.toFixed(4), dMax: +Math.max(...d).toFixed(3) };
  }
  return { n: A.length, out, ogFlips: A.filter((x, i) => i && x.og !== A[i - 1].og).length };
});
console.log(JSON.stringify(r.out.spd), r.ogFlips); console.log("spd serisi:", JSON.stringify(await page.evaluate(() => window.__a.slice(60).map((x) => +x.spd.toFixed(1)))));
await browser.close();
