// 12.203 Uzak asker LOD'u görsel denetimi (gerçek GPU, pencereli): Kuzey Vadisi 32v32 çevrim dışı, botlar dondurulur, 8 asker bakış doğrultusunda
// 20–300 m'ye dizilir (Kırmızı / Mavi sırayla). Aynı sahne LOD açık ve kapalı (?lod=0) çekilir; nişangâhla (ACOG, sağ tık) bakışta uzak askerler tam modele döner.
//   node scripts/lodshots.mjs   BASE=http://127.0.0.1:5185  OUT=/tmp/wb-scale/lod   → on.png / off.png / on-ads.png / off-ads.png + kırpılmış yakın planlar, özet JSON
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5185', OUT = process.env.OUT || '/tmp/wb-scale/lod';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const CAM = { x: 400, z: 30 }, DISTS = [20, 50, 80, 110, 140, 170, 220, 300];
const rep = {};
for (const lod of ['on', 'off']) {
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=32v32&map=kuzey&type=conquest&debug=1&nolock=1&optic=acog&shadows=1${lod === 'off' ? '&lod=0' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  await page.evaluate(({ CAM, DISTS }) => {
    const g = window.__game, me = g.playerSoldier;
    g.devGod = true; g.brainsOff = g.brains.splice(0);
    me.fly = true; me.pos.set(CAM.x, g.world.heightAt(CAM.x, CAM.z) + 4, CAM.z); me.vel.set(0, 0, 0); me.yaw = 0; me.pitch = -0.035;
    const others = g.soldiers.filter((s) => s !== me);
    others.forEach((s, i) => { s.vel.set(0, 0, 0); if (i >= DISTS.length) { s.pos.set(-700 + i, g.world.heightAt(-700 + i, -700), -700); s.protT = 999; } });
    DISTS.forEach((d, i) => {
      const s = others.find((e) => e.team === (i % 2 ? 'blue' : 'red') && !e._lodPlaced); s._lodPlaced = true;
      if (!s.alive) s.spawn({ x: CAM.x, z: CAM.z, ry: 0 }, 0); s.respawnT = 999;
      const a = (i - 3.5) * 0.07, x = CAM.x + Math.sin(a) * d, z = CAM.z - Math.cos(a) * d;      // ±14° yelpaze: üst üste binmesin
      s.pos.set(x, g.world.heightAt(x, z) + 0.05, z); g.world.settle(s); s.yaw = Math.PI * (i % 3) / 2; s.protT = 0; s.hp = 1e6;
    });
  }, { CAM, DISTS });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${lod}.png` });
  await page.screenshot({ path: `${OUT}/${lod}-yakin.png`, clip: { x: 380, y: 420, width: 840, height: 150 } });
  rep[lod] = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; return { lod: g.farView?.stats || null, placed: g.soldiers.filter((s) => s._lodPlaced).map((s) => [s.team[0], Math.round(Math.hypot(s.pos.x - me.pos.x, s.pos.z - me.pos.z)), g.farView ? g.farView.tier(s) : -1, s.model.root.visible ? 1 : 0, s.model.root.matrixWorldAutoUpdate ? 1 : 0, s.alive ? 1 : 0, +s.pos.y.toFixed(1)]) }; });
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(300);
  await page.evaluate(() => { const me = window.__game.playerSoldier; me.yaw = 0; me.pitch = -0.02; });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const me = window.__game.playerSoldier; me.yaw = 0; me.pitch = -0.02; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${lod}-ads.png` });
  await page.screenshot({ path: `${OUT}/${lod}-ads-yakin.png`, clip: { x: 600, y: 360, width: 400, height: 180 } });
  rep[lod + 'Ads'] = await page.evaluate(() => ({ lod: window.__game.farView?.stats || null, zoom: window.__game.farView?.zoom, fov: window.__game.camera.fov }));
  await page.mouse.up({ button: 'right' });
  rep[lod + 'Errs'] = errs;
  await page.context().close();
}
fs.writeFileSync(`${OUT}/lod.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep));
await browser.close();
