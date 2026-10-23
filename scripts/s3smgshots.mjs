// S3 SMG / LMG / tabanca / RPG görüntüleri (gerçek GPU, headless:false): vitrin (silah × 5 kaplama, dönen açılar; FP + LOD), birinci şahıs bel / tam nişan (her izinli nişangâh), 3. şahıs askerler.
//   node scripts/s3smgshots.mjs <çıktı> [taban url]    PARTS=turn,hip,ads,third  ONLY=regex
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-s3c/after', base = process.argv[3] || 'http://127.0.0.1:5292';
const parts = (process.env.PARTS || 'turn,hip,ads,third').split(','), only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [];
const IDS = ['mp5', 'vector', 'p90', 'mac10', 'lmg', 'pkm', 'm1911', 'deagle', 'revolver', 'rpg'];
const W = { mp5: ['iron', 'reddot', 'holo', 'acog'], vector: ['iron', 'reddot', 'holo'], p90: ['iron', 'reddot', 'holo'], mac10: ['iron', 'reddot'], lmg: ['iron', 'reddot', 'holo', 'acog'],
  pkm: ['iron', 'reddot', 'holo'], m1911: ['iron', 'reddot'], deagle: ['iron', 'reddot'], revolver: ['iron'], rpg: ['iron'] };
const SLOT = { m1911: 1, deagle: 1, revolver: 1, mac10: 1, rpg: 2 };
if (parts.includes('turn')) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('turn: ' + e.message));
  await page.goto(base + '/scripts/s3turn.html'); await page.waitForFunction('window.__ready', null, { timeout: 60000 });
  const all = {};
  for (const [tag, lod] of [['fp', false], ['lod', true]]) for (const grp of [IDS.slice(0, 5), IDS.slice(5)]) {
    const r = await page.evaluate((o) => window.__turn(o), { ids: grp, lod, W: lod ? 300 : 420, H: lod ? 160 : 230 });
    writeFileSync(`${out}/turn-${tag}-${grp[0]}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
    for (const [id, s] of Object.entries(r.stats)) (all[id] ||= {})[tag] = s;
  }
  writeFileSync(`${out}/stats.json`, JSON.stringify(all, null, 1)); console.log(all);
  await ctx.close();
}
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0`);
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
      g.simulate = false;
      s.cur = o.slot; s.items[o.slot] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic || 'reddot'; if (s.model) s.model.optic = s.optic;
      if (o.skin) s.skins = { ...(s.skins || {}), [o.id]: o.skin };
      p.refreshWeapon();
      const vm = p.vm;
      vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0;
      s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0;
      s.ads = !!o.ads; s.adsT = o.ads ? o.ads : 0;
      for (let i = 0; i < 40; i++) { s.adsT = o.ads || 0; p.update(1 / 60); }
      for (let i = 0; i < 30; i++) g.hud.update(1 / 60);
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
if (parts.some((p) => ['hip', 'ads', 'third'].includes(p))) {
  const { ctx, page } = await open();
  if (parts.includes('hip')) for (const id of IDS) await shoot(page, `desk-${id}-hip`, { id, slot: SLOT[id] || 0, optic: W[id].includes('reddot') ? 'reddot' : W[id][0] }, false);
  if (parts.includes('ads')) for (const [id, os] of Object.entries(W)) for (const optic of os) await shoot(page, `desk-${id}-${optic}-ads`, { id, slot: SLOT[id] || 0, optic, ads: 1 });
  if (parts.includes('third')) for (const [tag, ws] of [['a', IDS.slice(0, 5)], ['b', IDS.slice(5)]]) {
    await page.evaluate((ws) => {
      const g = window.__game, p = g.player, s = p.s, sk = ['std', 'desert', 'wood', 'urban', 'gold'], SLOT = { m1911: 1, deagle: 1, revolver: 1, mac10: 1, rpg: 2 };
      g.simulate = false; window.__hud(false);
      const others = g.soldiers.filter((o) => o !== s && !o.def.zombie).slice(0, 5);
      others.forEach((o, i) => {
        const w = ws[i], sl = SLOT[w] || 0; o.alive = true; o.items[sl] = { id: w, mag: 30, reserve: 90 }; o.cur = sl; o.skins = { [w]: sk[i] }; o.optic = 'reddot';
        o.pos.set(s.pos.x - Math.sin(s.yaw) * 3.4 + Math.cos(s.yaw) * (i - 2) * 0.95, s.pos.y, s.pos.z - Math.cos(s.yaw) * 3.4 - Math.sin(s.yaw) * (i - 2) * 0.95);
        o.yaw = s.yaw - 1.25; o.pitch = 0; o.model.root.visible = true; o._syncWeaponModel(true); o.syncModel(0.016);
      });
      p.vm.root.visible = false; s.pitch = -0.12; s.adsT = 0; s.ads = false; p.update(1 / 60); p.vm.root.visible = false;
    }, ws);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/desk-third-${tag}.png` });
  }
  await ctx.close();
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
