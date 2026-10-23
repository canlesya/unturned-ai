// S3 silahları + nişan görüntüleri (gerçek GPU, headless:false): bel / tam nişan × silah × izinli nişangâh, masaüstü 1600×900 + Pixel 7 yatay nişan.
//   node scripts/s3shots.mjs <çıktı> [taban url]    PARTS=hip,ads,mob,skin,mid  ONLY=regex  (önce / sonra karşılaştırması için aynı pozlar)
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-s3/after', base = process.argv[3] || 'http://127.0.0.1:5281';
const parts = (process.env.PARTS || 'hip,ads,mob').split(','), only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const errs = [];
const W = { ak47: ['iron', 'reddot', 'holo', 'acog'], m4a1: ['iron', 'reddot', 'holo', 'acog'], pistol: ['iron', 'reddot'], sniper: ['scope'], shotgun: ['iron', 'reddot', 'holo'],
  mp5: ['iron', 'reddot', 'holo', 'acog'], scarh: ['iron', 'reddot', 'holo', 'acog'], deagle: ['iron', 'reddot'], lmg: ['iron', 'reddot', 'holo', 'acog'] };
const SLOT = { pistol: 1, deagle: 1 };
async function open(dev) {
  const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices[dev === 'iph' ? 'iPhone 13 landscape' : 'Pixel 7 landscape']));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(dev + ': ' + e.message));
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev !== 'desk' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; });
    g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0);
    s.yaw = 0.6; s.pitch = 0.05; s.protT = 0;
    window.__hud = (on) => { for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = on ? '' : 'hidden'; };
    window.__pose = (o) => {
      g.simulate = false;                                                         // döngü yalnız çizsin: poz donuk kalır
      s.cur = o.slot; s.items[o.slot] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic || 'reddot'; if (s.model) s.model.optic = s.optic;
      if (o.skin) s.skins = { ...(s.skins || {}), [o.id]: o.skin };
      p.refreshWeapon();
      const vm = p.vm;
      vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0;
      s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0;
      s.ads = !!o.ads; s.adsT = o.ads ? o.ads : 0;
      for (let i = 0; i < 40; i++) { s.adsT = o.ads || 0; p.update(1 / 60); }
      for (let i = 0; i < 30; i++) g.hud.update(1 / 60);                       // HUD geçişleri (dürbün kararması) otursun
      return s.opticId;
    };
  });
  return { ctx, page };
}
async function shoot(page, name, o, hud = true) {
  if (only && !only.test(name)) return;
  await page.evaluate(([o, hud]) => { window.__hud(hud); return window.__pose(o); }, [o, hud]);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/${name}.png` });
}
{
  const { ctx, page } = await open('desk');
  if (parts.includes('hip')) for (const id of Object.keys(W)) await shoot(page, `desk-${id}-hip`, { id, slot: SLOT[id] || 0, optic: W[id].includes('reddot') ? 'reddot' : W[id][0] }, false);
  if (parts.includes('ads')) for (const [id, os] of Object.entries(W)) for (const optic of os) await shoot(page, `desk-${id}-${optic}-ads`, { id, slot: SLOT[id] || 0, optic, ads: 1 });
  if (parts.includes('mid')) for (const [id, os] of Object.entries(W)) for (const optic of os) await shoot(page, `desk-${id}-${optic}-ads70`, { id, slot: SLOT[id] || 0, optic, ads: 0.7 });
  if (parts.includes('skin')) for (const id of ['ak47', 'm4a1', 'pistol', 'sniper', 'shotgun']) for (const skin of ['std', 'desert', 'wood', 'urban', 'gold']) await shoot(page, `desk-${id}-skin-${skin}`, { id, slot: SLOT[id] || 0, optic: W[id].includes('reddot') ? 'reddot' : W[id][0], skin }, false);
  if (parts.includes('third')) {                                          // 3. şahıs: 5 asker yan yana, her biri farklı S3 silahı + kaplama (LOD)
    for (const [tag, sk] of [['skins', ['std', 'desert', 'wood', 'urban', 'gold']], ['std', ['std', 'std', 'std', 'std', 'std']]]) {
      await page.evaluate((sk) => {
        const g = window.__game, p = g.player, s = p.s, ws = ['ak47', 'm4a1', 'shotgun', 'sniper', 'pistol'];
        g.simulate = false; window.__hud(false);
        const others = g.soldiers.filter((o) => o !== s && !o.def.zombie).slice(0, 5);
        others.forEach((o, i) => {
          const w = ws[i]; o.alive = true; o.items[0] = { id: w, mag: 30, reserve: 90 }; o.cur = 0; o.skins = { [w]: sk[i] }; o.optic = 'holo';
          o.pos.set(s.pos.x - Math.sin(s.yaw) * 3.4 + Math.cos(s.yaw) * (i - 2) * 0.95, s.pos.y, s.pos.z - Math.cos(s.yaw) * 3.4 - Math.sin(s.yaw) * (i - 2) * 0.95);
          o.yaw = s.yaw - 1.25; o.pitch = 0; o.model.root.visible = true; o._syncWeaponModel(true); o.syncModel(0.016);
        });
        p.vm.root.visible = false; s.pitch = -0.12; s.adsT = 0; s.ads = false; p.update(1 / 60); p.vm.root.visible = false;
        window.__third = others.map((o) => o.model.weapon.userData.skin);
      }, sk);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/desk-third-${tag}.png` });
    }
  }
  await ctx.close();
}
if (parts.includes('mob')) for (const dev of ['mob', 'iph']) {
  const { ctx, page } = await open(dev);
  for (const [id, os] of Object.entries(W)) for (const optic of os) if (['ak47', 'm4a1', 'pistol', 'sniper', 'shotgun'].includes(id) || dev === 'mob') await shoot(page, `${dev}-${id}-${optic}-ads`, { id, slot: SLOT[id] || 0, optic, ads: 1 });
  await shoot(page, `${dev}-m4a1-hip`, { id: 'm4a1', slot: 0, optic: 'reddot' });
  await ctx.close();
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
