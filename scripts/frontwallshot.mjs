// Siper duvarı hatası önce / sonra görseli (12.161):  URL=http://127.0.0.1:5180 OUT=/tmp/wb-cephe2 node scripts/frontwallshot.mjs
// Oyuncu Mavi destek siperinde duvara 1 m uzakta, W ile 1,2 sn duvara yürür (dik + çapraz); OLD kipinde düzeltme kapatılır (yalnız merkez denetimi).
// Kare + oyuncu merkezinin duvara uzaklığı (gövde yarıçapı 0,32 m: sonra ≥ 0,32 olmalı, önce 0'a iner → kamera duvarın içinde).
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-cephe2';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=8v8&map=cephe&type=front&debug=1&nolock=1&team=blue`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 180000 });
const out = {};
for (const mode of ['once', 'sonra']) {
  fs.mkdirSync(`${OUT}/${mode}`, { recursive: true });
  for (const [name, ang] of [['duvar-dik', 0], ['duvar-capraz', 0.6]]) {
    await page.evaluate(([old, ang]) => {
      const g = window.__game, P = Object.getPrototypeOf(g.map.terrain);
      if (old) { P._po ??= P.pushOut; delete P.pushOut; } else if (P._po) P.pushOut = P._po;
      for (const s of g.soldiers) if (s !== g.playerSoldier) { s.alive = false; s.respawnT = 1e9; s.model.root.visible = false; }
      g.brains.length = 0;
      const s = g.playerSoldier; s.protT = 1e9; g.devGod = true;
      s.pos.set(-40, g.world.heightAt(-40, 105), 105); s.vel.set(0, 0, 0); g.world.settle(s);
      s.yaw = Math.PI + ang; s.pitch = -0.05;
      g.hud.root.style.display = 'none';
    }, [mode === 'once', ang]);
    await page.waitForTimeout(300);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1300); await page.keyboard.up('KeyW');
    await page.waitForTimeout(250);
    out[mode + ':' + name] = await page.evaluate(() => { const s = window.__game.playerSoldier; return { z: +s.pos.z.toFixed(3), wallGap: +(106 - s.pos.z).toFixed(3) }; });
    await page.screenshot({ path: `${OUT}/${mode}/${name}.png` });
  }
}
out.errs = errs;
console.log(JSON.stringify(out));
await browser.close();
