// Sabit bakış noktalarından doku karşılaştırma görüntüleri.  VIEWS='[["ad",x,y,z,yaw,pitch],...]' OUT=klasör [TOD=day|sunset|night] node scripts/cgshot.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || 'screenshots/doku'; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +process.env.W || 1000, height: +process.env.H || 560 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:5180/?editor=colgecidi&debug=1&nolock=1&tod=${process.env.TOD || 'day'}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 }); await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.mapEditor.toggle(false); g.hud.root.style.display = 'none'; g.playerSoldier.fly = true; });
// bakış: ["ad", x, y, z, yaw, pitch]  ya da  ["ad", "@Bölge", dx, dz, yaw, pitch, dy=1.7] (zemin + dy; dx, dz bölge merkezinden kayma)
const VIEWS = process.env.VIEWS ? JSON.parse(process.env.VIEWS) : JSON.parse(fs.readFileSync(process.env.VIEWFILE || 'scripts/doku-views.json', 'utf8'));
for (const [n, x, y, z, yaw, pitch, dy] of VIEWS) {
  await page.evaluate(([x, y, z, yaw, pitch, dy]) => { const g = window.__game, s = g.player.s; let px = x, py = y, pz = z; if (typeof x === 'string') { const c = g.map.callouts.find((q) => q.name === x.slice(1)); px = c.x + y; pz = c.z + z; py = g.world.heightAt(px, pz) + (dy ?? 1.7); } s.fly = true; s.pos.set(px, py, pz); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; }, [x, y, z, yaw, pitch, dy]);
  await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${n}.png` });
}
console.log('hata', errs.length, errs.slice(0, 3)); await browser.close();
