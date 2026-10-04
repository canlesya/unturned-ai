// Çevrimiçi istemci performansı (vekil gecikmesiyle): düzeltme sayısı, hata, kare süreleri. node scripts/netlag.mjs [sunucu=ws://127.0.0.1:8790] [saniye=30] [query]
import { chromium } from 'playwright';
const server = process.argv[2] || 'ws://127.0.0.1:8790', secs = +(process.argv[3] || 30), extra = process.argv[4] || 'type=conquest&per=12';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?online=new&${extra}&debug=1&nolock=1&server=${server}&name=Lag`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
await page.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g), acc = (window.__t = { step: 0, steps: 0, render: 0, renders: 0, longStep: 0, maxStep: 0 });
  const ws = P.stepOnline; let lastCam = null; acc.jumps = 0; acc.maxJump = 0; P.stepOnline = function (dt) { const t = performance.now(); ws.call(this, dt); { const c = this.camera.position; if (lastCam) { const d = Math.hypot(c.x - lastCam[0], c.y - lastCam[1], c.z - lastCam[2]); acc.maxJump = Math.max(acc.maxJump, d); if (d > 0.18) acc.jumps++; } lastCam = [c.x, c.y, c.z]; } const d = performance.now() - t; acc.step += d; acc.steps++; acc.maxStep = Math.max(acc.maxStep, d); if (d > 16) acc.longStep++; };
  const wr = P.render; if (wr) P.render = function () { const t = performance.now(); wr.apply(this, arguments); acc.render += performance.now() - t; acc.renders++; };
});
await page.waitForTimeout(3000);
const s0 = await page.evaluate(() => ({ ...window.__game.online.stats }));
// ileri yürü + dön (tahmin uzlaştırmayı zorla)
await page.keyboard.down('KeyW');
for (let i = 0; i < secs; i++) { if (i % 3 === 0) await page.keyboard.down('KeyD'); if (i % 3 === 1) await page.keyboard.up('KeyD'); if (i % 5 === 0) await page.keyboard.press('Space'); await page.waitForTimeout(1000); }
await page.keyboard.up('KeyW');
const r = await page.evaluate(() => { const o = window.__game.online, t = window.__t; return { stats: { ...o.stats }, t, soldiers: window.__game.soldiers.length, snapsBuf: o.snaps.length }; });
const d = { corr: r.stats.corrections - s0.corrections, snaps: r.stats.snaps - s0.snaps, rtt: Math.round(r.stats.rtt) };
console.log(`${secs} sn · RTT ${d.rtt} ms · snapshot ${d.snaps} (${(d.snaps / secs).toFixed(1)}/sn) · düzeltme ${d.corr} (${(d.corr / secs).toFixed(2)}/sn) · düzeltme boyu ort ${((r.stats.errSum || 0) / Math.max(1, r.stats.corrections)).toFixed(2)} m, en çok ${(r.stats.errMax || 0).toFixed(2)} m`);
console.log(`stepOnline ort ${(r.t.step / Math.max(1, r.t.steps)).toFixed(2)} ms (en çok ${r.t.maxStep.toFixed(1)} ms, >16ms: ${r.t.longStep}) · render ort ${(r.t.render / Math.max(1, r.t.renders)).toFixed(1)} ms · savaşçı ${r.soldiers}`);
console.log(`kamera: adım başına en büyük sıçrama ${r.t.maxJump.toFixed(2)} m · 0.18 m'yi aşan sıçrama sayısı ${r.t.jumps}`);
console.log('hata:', errs.length, errs.slice(0, 2));
await browser.close();
