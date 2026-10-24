// Cephe modu birinci şahıs silah kareleri (bel + nişan): GPU=1 URL=http://127.0.0.1:5180 OUT=/tmp/wb-cephe/fp node scripts/frontfp.mjs [silah,…]
// Her silah: Batı Cephesi'nde Mavi siperinde, HUD gizli; bel / nişan (tam) / doldurma ortası (RL=1) kareleri. TEAM=red ile Kırmızı kolu.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-cephe/fp', TEAM = process.env.TEAM || 'blue';
fs.mkdirSync(OUT, { recursive: true });
const ids = (process.argv[2] || 'ww_bolt,ww_semi,ww_smgb,ww_smgr,ww_lmg,ww_sniper,ww_pistol,ww_nade').split(',');
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${URL0}/?autostart=4v4&map=cephe&type=front&debug=1&nolock=1&team=${TEAM}&cls=assault`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 180000 });
await page.waitForTimeout(1500);
const P = process.env.POS ? JSON.parse(process.env.POS) : TEAM === 'red' ? [9, -1.6, 21, Math.PI] : [-3, -1.6, 112.6, 0];
await page.evaluate((P) => {
  const g = window.__game;
  for (const s of g.soldiers) if (s !== g.playerSoldier) { s.brain = null; s.alive = false; s.respawnT = 1e9; s.model.root.visible = false; }
  g.brains.length = 0; g.timeLeft = 900; g.devGod = true;
  g.hud.root.style.display = 'none';
  const me = g.playerSoldier; me.pos.set(P[0], P[1], P[2]); me.yaw = P[3]; me.pitch = 0.02;
}, P);
const rep = {};
for (const id of ids) {
  await page.evaluate((id) => {
    const g = window.__game, s = g.playerSoldier, W = window.__WSTATS || g.constructor.WSTATS;
    const st = g.soldiers && s.stat && (window.__ws ||= null);
    s.items[0] = { id, mag: 1, reserve: 0 };
    const it = s.items[0]; s.cur = 0;
    g.player.refreshWeapon(); s.ads = false; s.reloadT = 0;
    it.mag = s.stat.mag; it.reserve = s.stat.reserve || 0;
  }, id);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${id}-bel.png` });
  if (id !== 'ww_nade') {
    await page.evaluate((sc) => { const g = window.__game; g.playerSoldier.ads = true; if (sc) g.hud.root.style.display = ''; }, id === 'ww_sniper');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${id}-nisan.png` });
    await page.evaluate(() => { window.__game.hud.root.style.display = 'none'; });
    await page.evaluate(() => { const g = window.__game, s = g.playerSoldier; s.ads = false; s.item.mag = 0; s.startReload(); });
    await page.waitForTimeout(+(process.env.RLT || 1100));
    await page.screenshot({ path: `${OUT}/${id}-doldurma.png` });
    await page.waitForTimeout(2400);
  }
  rep[id] = await page.evaluate(() => { const s = window.__game.playerSoldier; return { mag: s.item.mag, st: s.stat.name }; });
}
rep.errs = errs;
console.log(JSON.stringify(rep));
await browser.close();
