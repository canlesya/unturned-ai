// Skor tabanlı TDM: öldürme takım skorunu artırır, sınıra ilk ulaşan kazanır. Ekran görüntüleri: tdm_hud.png, tdm_end.png
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?autostart=3v3&type=tdm&tickets=10&debug=1&nolock=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 60000 });
const r = await page.evaluate(() => {
  const g = window.__game, out = {}; g.playerSoldier.invuln = 1e9;
  out.start = { tk: { ...g.tickets }, lim: g.mode.tickets, score: g.mode.scoreBased };
  g.soldiers.forEach((s) => { s.protT = 0; });
  const bl = g.soldiers.find((s) => s.team === 'blue' && s !== g.playerSoldier), rd = g.soldiers.find((s) => s.team === 'red');
  rd.takeDamage(999, bl, 'body', rd.pos); rd.takeDamage(999, bl, 'body', rd.pos);   // ikinci çağrı ölü askere işlemez
  for (let i = 0; i < 10; i++) g.step(1 / 30);
  out.afterKill = { ...g.tickets };
  const tm = g.soldiers.find((s) => s.team === 'blue' && s !== bl && s !== g.playerSoldier); // takım arkadaşını öldürmek skor vermez
  const b2 = g.soldiers.find((s) => s.team === 'blue' && s.alive && s !== bl && s !== g.playerSoldier);
  if (b2) { b2.takeDamage(999, bl, 'body', b2.pos); } for (let i = 0; i < 10; i++) g.step(1 / 30);
  out.afterTeamKill = { ...g.tickets };
  out.hud = [document.getElementById('lim').textContent, document.getElementById('tkB').textContent, document.getElementById('tkR').textContent];
  return out;
});
console.log(JSON.stringify(r));
await page.screenshot({ path: 'tdm_hud.png', clip: { x: 340, y: 0, width: 600, height: 120 } });
const e = await page.evaluate(() => { const g = window.__game; g.tickets.blue = 10; for (let i = 0; i < 20; i++) g.step(1 / 30); return { ended: g.ended, winner: g.winner, why: g.endReason, text: document.querySelector('#end')?.innerText?.slice(0, 120) }; });
console.log(JSON.stringify(e));
await page.screenshot({ path: 'tdm_end.png' });
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
