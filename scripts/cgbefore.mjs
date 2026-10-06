// Doku/detay turu: bölge adıyla, oyuncu gözünden 4 yöne bakış. OUT=klasör  AREAS="Mid,B Site" node scripts/cgbefore.mjs
import { chromium } from 'playwright';
const OUT = process.env.OUT || 'screenshots/doku-once';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
await page.goto(`http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&debug=1&nolock=1&tod=${process.env.TOD || 'day'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 }); await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.brains.length = 0; g.hud.root.style.display = 'none'; });
const names = (process.env.AREAS || 'Mid,B Site,A Site,Long,T Spawn,CT Spawn,Pit,Upper Tunnels,Lower Tunnels,Short,Xbox,Window,Suicide,Titanic').split(',');
const yaws = process.env.YAWS ? JSON.parse(process.env.YAWS) : [0, 1.57, 3.14, 4.71];
for (const n of names) for (let k = 0; k < yaws.length; k++) {
  await page.evaluate(([n, yaw]) => { const g = window.__game, s = g.playerSoldier, c = g.map.callouts.find((q) => q.name === n); s.fly = false; s.pos.set(c.x, g.world.heightAt(c.x, c.z) + 0.1, c.z); s.vel.set(0, 0, 0); g.world.settle(s); s.protT = 99; s.hp = 999; s.yaw = yaw; s.pitch = -0.05; }, [n, yaws[k]]);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${n.replace(/[ ()]/g, '_')}-${k}.png` });
}
await browser.close(); console.log('tamam', names.length * yaws.length);
