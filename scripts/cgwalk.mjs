// Fizikle yürüme testi: oyuncu W ile ara noktalar arasında yürür; takılma (duvar / basamak) ve yükseklik izi.  WALK='[[x,y,z],[x,z],...]' node scripts/cgwalk.mjs
import { chromium } from 'playwright';
const W = JSON.parse(process.env.WALK || '[]');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1');
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(1000);
const [sx, sy, sz] = W[0];
await page.evaluate(([x, y, z]) => { const g = window.__game, s = g.playerSoldier; g.brains.length = 0; s.pos.set(x, y + 0.2, z); s.vel.set(0, 0, 0); s.hp = 9999; s.protT = 9999; }, [sx, sy, sz]);
let fail = 0;
for (let i = 1; i < W.length; i++) {
  const [tx, tz] = W[i];
  let best = 1e9, still = 0, t = 0, trace = [];
  while (true) {
    const st = await page.evaluate(([tx, tz]) => {
      const g = window.__game, s = g.playerSoldier, p = g.player; s.hp = 9999;
      const dx = tx - s.pos.x, dz = tz - s.pos.z; s.yaw = Math.atan2(-dx, -dz); s.pitch = 0; p.keys.add('KeyW');
      return [s.pos.x, s.pos.y, s.pos.z, Math.hypot(dx, dz)];
    }, [tx, tz]);
    trace.push(st.slice(0, 3).map((v) => v.toFixed(1)).join(','));
    if (st[3] < 0.8) break;
    if (st[3] < best - 0.3) { best = st[3]; still = 0; } else still++;
    if (still > 12 || ++t > 400) { fail++; console.log(`TAKILDI → (${tx},${tz}) konum ${st.slice(0, 3).map((v) => v.toFixed(2)).join(' ')}`); break; }
    await page.waitForTimeout(150);
  }
  console.log(`(${tx},${tz}) y izi:`, trace.filter((_, k) => k % 4 === 0).map((q) => q.split(',')[1]).join(' '));
}
await page.evaluate(() => window.__game.player.keys.clear());
console.log(fail ? `${fail} takılma` : 'yol temiz', 'hata', errs.length, errs.slice(0, 2));
await browser.close();
