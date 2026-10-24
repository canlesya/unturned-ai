// Firefox ↔ Chromium görüntü karşılaştırması: aynı konum / bakış, botlar donuk, aynı kalite. HUD açık (yazı tipi / CSS farkı da görünsün).
//   node scripts/ffshots.mjs [etiket] [firefox,chromium]   BASE=http://127.0.0.1:5180  DPR=2  PRS=1,1.5,2   → /tmp/wb-ff/<etiket>/<tarayıcı>-<pr>-<bakış>.png + menu
import { firefox, chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5180';
const tag = process.argv[2] || 'shots', which = (process.argv[3] || 'firefox,chromium').split(',');
const DPR = +(process.env.DPR || 2), PRS = (process.env.PRS || '1,1.5,2').split(',');
const OUT = `/tmp/wb-ff/${tag}`; fs.mkdirSync(OUT, { recursive: true });
function launchOpt(name) {
  if (name !== 'firefox') return { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] };
  const home = process.env.FF_HOME || '/tmp/wb-ff/home';
  for (const d of ['Library/Caches', 'Library/Application Support']) fs.mkdirSync(`${home}/${d}`, { recursive: true });
  return { headless: false, env: { ...process.env, CFFIXED_USER_HOME: home } };
}
// Çöl Geçidi bakışları: [ad, x, z, yaw, pitch]
const VIEWS = [['mid', -2, -10, 0.2, -0.02], ['uzak', -36.5, 47.5, 0.6, -0.05], ['yakin', 10, 20, 2.4, -0.25]];
for (const name of which) {
  const browser = await (name === 'firefox' ? firefox : chromium).launch(launchOpt(name));
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [sayfa hatası]', e.message));
  // ana menü (yazı tipi / CSS)
  await page.goto(`${BASE}/`); await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${name}-menu.png` });
  for (const pr of PRS) {
    await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1&third=0&pr=${pr}&tod=day`);
    await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 180000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true; g.settings.adaptive = false; for (const s of g.soldiers) if (s !== g.playerSoldier) s.pos.x += 400; });
    for (const [vn, x, z, yaw, pitch] of VIEWS) {
      await page.evaluate(([x, z, yaw, pitch]) => { const g = window.__game, s = g.playerSoldier; s.pos.set(x, g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; }, [x, z, yaw, pitch]);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${name}-pr${pr}-${vn}.png` });
    }
    const st = await page.evaluate(() => { const g = window.__game, r = g.renderer, gl = r.getContext(); return { pr: r.getPixelRatio(), buf: [gl.drawingBufferWidth, gl.drawingBufferHeight], post: !!g.post?.on, shadow: r.shadowMap.enabled ? g.sun.shadow.mapSize.x : 0 }; });
    console.log(name, 'pr', pr, JSON.stringify(st));
  }
  await browser.close();
}
