// Çöl Geçidi sistematik tarama: yürünebilir noktalardan 4 yöne bakan kareler → screenshots/sweep/f_<idx>_<yön>.png + sweep/manifest.json
// Kullanım: node scripts/cgsweep.mjs               (otomatik: SPACING m aralıklı nokta ızgarası, varsayılan 9)
//           POINTS='[["ad",x,z],...]' node scripts/cgsweep.mjs   (elle noktalar; nokta başına 4 yön)
//           REGION='[x0,z0,x1,z1]' ile otomatik noktalar bölgeyle sınırlanır. YAWS='[0,90,180,-90]' yönleri değiştirir. SHEETS: python scripts/cgsheets.py
import { chromium } from 'playwright';
import fs from 'node:fs';
const SPACING = +process.env.SPACING || 9;
const YAWS = JSON.parse(process.env.YAWS || '[0,90,180,-90]');
const REGION = process.env.REGION ? JSON.parse(process.env.REGION) : null;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1&tod=day`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.hud.root.style.display = 'none'; g.player.vm.render = () => {}; });
let pts = process.env.POINTS ? JSON.parse(process.env.POINTS) : await page.evaluate(([sp, rg]) => {
  const g = window.__game, base = g.map.spawns.blue[0], seen = g.nav.reachable(base.x, base.z);
  let L = g.nav.spreadPoints(seen, { spacing: sp, max: 2000, clear: 1.0 }).map((p) => ['', +p.x.toFixed(1), +p.z.toFixed(1)]);
  if (rg) L = L.filter((p) => p[1] >= rg[0] && p[1] <= rg[2] && p[2] >= rg[1] && p[2] <= rg[3]);
  return L;
}, [SPACING, REGION]);
fs.mkdirSync('screenshots/sweep', { recursive: true });
const manifest = [];
for (let i = 0; i < pts.length; i++) {
  const [name, x, z] = pts[i];
  const info = await page.evaluate(([x, z]) => {
    const g = window.__game, s = g.playerSoldier, y = g.nav.floor ? g.nav.floorAt(x, z) : g.world.heightAt(x, z);
    s.fly = true; s.pos.set(x, y, z); s.vel.set(0, 0, 0); s.pitch = 0.02;
    let best = null, bd = 1e9; for (const c of g.map.callouts) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c.name; } }
    return { y: +y.toFixed(2), callout: best };
  }, [x, z]);
  for (let k = 0; k < YAWS.length; k++) {
    await page.evaluate((yaw) => { window.__game.playerSoldier.yaw = (yaw * Math.PI) / 180; }, YAWS[k]);
    await page.waitForTimeout(260);
    await page.screenshot({ path: `screenshots/sweep/f_${i}_${k}.png` });
  }
  manifest.push({ i, name, x, z, ...info });
  if (i % 20 === 0) console.log('nokta', i, '/', pts.length);
}
fs.writeFileSync('screenshots/sweep/manifest.json', JSON.stringify({ yaws: YAWS, pts: manifest }));
console.log('tamam', pts.length, 'nokta ×', YAWS.length, 'yön · sayfa hatası', errs.length, errs.slice(0, 2));
await browser.close();
