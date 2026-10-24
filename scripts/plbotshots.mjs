// Vagon modu bot davranışı görüntüleri: kuşbakışı kamera vagonu izler, botların üstünde rol etiketi (E eskort · Ö öncü · Y yan · N nişancı · D durdurucu · S siper).
//   node scripts/plbotshots.mjs   [URL=http://127.0.0.1:5180] [OUT=/tmp/wb-pbots] [N=6] [AT=15,45,90,140,200,260]
// Maç tarayıcıda hızlandırılır (g.step döngüsü), her anda birkaç gerçek kare çizilip görüntü alınır. Hata sayısı 0 olmalı.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-pbots', N = process.env.N || '6';
const AT = (process.env.AT || '15,45,90,140,200,260').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon|WebSocket|ERR_CONNECTION/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await page.goto(`${URL0}/?autostart=${N}v${N}&map=maden&type=payload&debug=1&nolock=1&autoplay=1&tod=day`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const g = window.__game, c = g.camera;
  g.hud.root.style.display = 'none'; if (g.player?.vm) g.player.vm.render = () => {};
  const P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () { if (this._cam) { const pl = this.payload.p; c.position.set(pl.x - 14, 30, pl.z + 16); c.lookAt(pl.x + 2, 0, pl.z - 2); c.fov = 52; c.updateProjectionMatrix(); } orig.call(this); };
  g._cam = true;
  const cv = document.createElement('canvas'); cv.id = 'plOverlay'; cv.width = innerWidth; cv.height = innerHeight;
  Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, pointerEvents: 'none', zIndex: 99999 });
  document.body.appendChild(cv);
  window.__label = () => {
    const ctx = cv.getContext('2d'), pl = g.payload, v = c.position.clone();
    ctx.clearRect(0, 0, cv.width, cv.height);
    const L = { escort: 'E', screen: 'Ö', flank: 'Y', over: 'N', block: 'D', hold: 'S' };
    let ai = 0, di = 0;
    for (const s of g.soldiers) {
      if (!s.alive) continue;
      v.set(s.pos.x, s.pos.y + 2.3, s.pos.z).project(c);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * cv.width, y = (-v.y * 0.5 + 0.5) * cv.height, r = s.brain?.plRole;
      ctx.fillStyle = s.team === 'blue' ? '#1f6fe0' : '#d8342a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(L[r] || '·', x, y + 1);
      if (pl.distTo(s) < 3.5) { if (s.team === 'blue') ai++; else di++; }
    }
    const st = { push: 'İTİLİYOR', contest: 'ÇEKİŞME', back: 'GERİ KAYIYOR', block: 'DURDURULDU', idle: 'BEKLİYOR' }[pl.state];
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(10, 10, 560, 58);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`t=${Math.round(g.time)} sn · vagon ${st} · ilerleme %${Math.round(pl.progress * 100)} · kontrol ${pl.reached}/${pl.cps.length}`, 20, 16);
    ctx.font = '15px Arial';
    ctx.fillText(`yarıçapta: saldıran ${ai} · savunan ${di}   (E eskort Ö öncü Y yan N nişancı · D durdurucu S siper)`, 20, 42);
  };
});
const info = [];
let t = 0;
for (const at of AT) {
  const r = await page.evaluate((sec) => { const g = window.__game; let n = 0; while (g.time < sec && !g.ended && n < 30 * 400) { g.step(1 / 30); n++; } g.timeLeft = Math.max(g.timeLeft, 60); return { t: Math.round(g.time), ended: g.ended }; }, at);
  if (r.ended) break;
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__label());
  const f = `${OUT}/pbots-${String(at).padStart(3, '0')}s.png`;
  await page.screenshot({ path: f });
  info.push(await page.evaluate(() => { const g = window.__game, pl = g.payload; return { t: Math.round(g.time), state: pl.state, pct: Math.round(pl.progress * 100), roles: g.brains.filter((b) => b.s.alive).map((b) => b.s.team[0] + ':' + b.plRole).sort().join(' ') }; }));
  t = at;
}
console.log(JSON.stringify(info, null, 1));
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
process.exit(errs.length ? 1 : 0);
