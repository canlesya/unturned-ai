// Uzay modu (12.157) birinci şahıs kareleri: 5 enerji silahı × bel / nişan, uzay kıyafeti kolu, Yörünge Üssü içinde.   GPU=1 URL=… OUT=… node scripts/spacefp.mjs  (MOB=1: Pixel 7)
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-uzay/fp';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = process.env.MOB ? await browser.newContext({ ...strip(devices['Pixel 7 landscape']) }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=3v3&map=yorunge&type=space&debug=1&dev=1&nolock=1&third=0&team=${process.env.TEAM || 'blue'}${process.env.MOB ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.evaluate(([x, z, yaw, pitch]) => {
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; });
  g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
  s.pos.set(x, 0, z); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; s.protT = 0;
  window.__hud = (on) => { for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = on ? '' : 'hidden'; };
  window.__pose = (o) => {
    g.simulate = false;
    s.cur = o.slot; s.items[o.slot] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic || 'reddot'; if (s.model) s.model.optic = s.optic;
    p.refreshWeapon();
    const vm = p.vm;
    vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0;
    s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0;
    s.ads = !!o.ads; s.adsT = o.ads ? o.ads : 0;
    for (let i = 0; i < 40; i++) { s.adsT = o.ads || 0; p.update(1 / 60); }
    for (let i = 0; i < 30; i++) g.hud.update(1 / 60);
    return s.opticId;
  };
}, (process.env.POS || '-24,-24,-1.9,0.04').split(',').map(Number));
const W = [['laser', 0, 'holo'], ['plasma', 0, 'reddot'], ['epistol', 1, 'iron'], ['railgun', 0, 'scope'], ['scatter', 0, 'iron']];
for (const [id, slot, optic] of W) {
  for (const ads of [0, 1]) {
    await page.evaluate(([o, hud]) => { window.__hud(hud); return window.__pose(o); }, [{ id, slot, optic, ads }, !!process.env.HUD]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${id}-${ads ? 'nisan' : 'bel'}.png` });
  }
}
console.log('hatalar:', errs);
await browser.close();
