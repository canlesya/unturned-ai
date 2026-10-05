// Sıçrama testi: oyuncu W + Boşluk ile hedefe yürür (zıplayarak); hedefe ulaşıp ulaşmadığını ve en yüksek kotu yazar.  START='[x,y,z]' TARGET='[x,z,y]' node scripts/cgjump.mjs
import { chromium } from 'playwright';
const S = JSON.parse(process.env.START || '[-5,0,-14.4]'), T = JSON.parse(process.env.TARGET || '[2,-14.4,1.9]');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1');
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1000);
await page.evaluate(([x, y, z]) => { const g = window.__game, s = g.playerSoldier; g.brains.length = 0; s.fly = false; s.pos.set(x, y + 0.05, z); s.vel.set(0, 0, 0); s.hp = 9999; s.protT = 9999; }, S);
let best = 0, ok = false;
for (let i = 0; i < 80; i++) {
  const st = await page.evaluate(([tx, tz, ty]) => {
    const g = window.__game, s = g.playerSoldier, p = g.player, dx = tx - s.pos.x, dz = tz - s.pos.z; s.yaw = Math.atan2(-dx, -dz); s.pitch = 0; p.keys.add('KeyW'); p.keys.add('Space');
    return [s.pos.x, s.pos.y, s.pos.z, Math.hypot(dx, dz), s.onGround, s.fly];
  }, [T[0], T[1], T[2]]);
  best = Math.max(best, st[1]); if (i % 8 === 0) console.log(i, st.slice(0, 3).map((v) => v.toFixed(2)).join(' '), st[4] ? 'yerde' : 'havada');
  if (st[3] < 0.7 && Math.abs(st[1] - T[2]) < 0.6) { ok = true; console.log('ULAŞTI', st.slice(0, 3).map((v) => v.toFixed(2)).join(' ')); break; }
  await page.waitForTimeout(120);
}
await page.evaluate(() => window.__game.player.keys.clear());
console.log(ok ? 'sıçrama başarılı' : 'sıçrama BAŞARISIZ', 'en yüksek y', best.toFixed(2));
await browser.close();
