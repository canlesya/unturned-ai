// 12.123 görsel denetimi (gerçek GPU, headless:false): S3 eşyalar birinci / üçüncü şahıs, nişanda destek kolu, dürbün / ACOG geçişinde mercek, telefonda holo halkası.
//   node scripts/s3fix.mjs <çıktı klasörü> [taban url]    PART=items,ads,scope,holo (varsayılan hepsi) · DEV=desk,mob
// Çıktı: <klasör>/<cihaz>-<bölüm>-<ad>.png (önce / sonra tablosu: scripts/s3fixsheet.py)
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = process.argv[2] || '/tmp/wb-s3d/shots', base = process.argv[3] || 'http://127.0.0.1:5293';
const PARTS = (process.env.PART || 'items,ads,scope,holo').split(',');
mkdirSync(OUT, { recursive: true });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [];
for (const dev of (process.env.DEV || 'desk,mob').split(',')) {
  const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(dev + ': ' + e.message));
  await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev !== 'desk' ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.evaluate(async () => {
    const { WSTATS } = await import('/src/game/stats.js');
    const g = window.__game, p = g.player, s = p.s;
    g.brains.forEach((b) => (b.update = () => {}));
    g.simulate = true; for (let i = 0; i < 20; i++) g.step(1 / 30);
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.yaw = 0.6; s.pitch = 0.02; s.protT = 1e9;
    const others = g.soldiers.filter((o) => o !== s);
    others.forEach((o) => { o.pos.y = -90; });
    // birinci şahıs poz: id, adsT (0..1), fade (telefon soluklaşması açık mı)
    window.__fp = (o) => {
      g.simulate = false; others.forEach((x) => { x.pos.y = -90; if (x.model) x.model.root.visible = false; });
      const SL = { primary: 0, secondary: 1, gadget: 2, melee: 3 }[WSTATS[o.id].slot] ?? 0;
      s.cur = SL; s.items[SL] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic || 'iron'; if (s.model) s.model.optic = s.optic;
      p.refreshWeapon();
      const vm = p.vm; vm.noSway = true; vm.noFade = !o.fade; vm.forceShow = false;
      vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
      s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0; s.leanT = 0; s.ads = (o.ads || 0) > 0;
      for (let i = 0; i < 40; i++) { s.adsT = o.ads || 0; p.update(1 / 60); }
      s.adsT = o.ads || 0; p.update(1e-4); g.hud.update(1 / 60);
      return { overlay: s.overlay, root: vm.root.visible };
    };
    // üçüncü şahıs: bir bot oyuncunun 1,5 m önünde, eşya elinde (doğuş koruması kabarcığı kapalı)
    window.__tp = (o) => {
      const b = others[0], f = { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) };
      const SL = { primary: 0, secondary: 1, gadget: 2, melee: 3 }[WSTATS[o.id].slot] ?? 0;
      b.items[SL] = { id: o.id, mag: 3, reserve: 0 }; b.cur = SL; b.skins = o.skin ? { [o.id]: o.skin } : null;
      b.pos.set(s.pos.x + f.x * 1.5, 0, s.pos.z + f.z * 1.5); b.protT = 0; b.pos.y = g.world.heightAt(b.pos.x, b.pos.z); b.yaw = s.yaw + Math.PI - 0.9; b.vel.set(0, 0, 0);
      b._syncWeaponModel(true); b.model.root.visible = true;
      s.cur = 0; s.items[0] = { id: 'm4a1', mag: 30, reserve: 90 }; p.refreshWeapon(); p.vm.root.visible = false; p.vm.forceShow = false;
      g.simulate = true; for (let i = 0; i < 6; i++) g.step(1 / 60); g.simulate = false;
      p.vm.root.visible = false; s.pitch = -0.05;
      return true;
    };
  });
  const shot = async (name) => { const f = `${OUT}/${dev}-${name}.png`; await page.waitForTimeout(120); await page.screenshot({ path: f }); return f; };
  if (PARTS.includes('items')) {
    for (const id of ['knife', 'machete', 'tomahawk', 'grenade', 'smoke', 'flash', 'claymore', 'ammobox', 'medkit']) {
      await page.evaluate((id) => window.__fp({ id }), id); await shot(`items-fp-${id}`);
    }
    for (const [id, skin] of [['knife', 'std'], ['knife', 'gold'], ['machete', 'wood'], ['tomahawk', 'urban'], ['grenade'], ['smoke'], ['flash'], ['claymore'], ['ammobox']]) {
      await page.evaluate((o) => window.__tp(o), { id, skin }); await shot(`items-tp-${id}${skin ? '-' + skin : ''}`);
    }
  }
  if (PARTS.includes('ads')) for (const [id, optic] of [['ak47', 'iron'], ['m4a1', 'holo'], ['m4a1', 'reddot'], ['shotgun', 'iron'], ['mp5', 'reddot'], ['lmg', 'holo'], ['scarh', 'acog'], ['pkm', 'reddot'], ['vector', 'holo']]) {
    for (const a of [0.7, 1]) { await page.evaluate((o) => window.__fp(o), { id, optic, ads: a, fade: dev !== 'desk' }); await shot(`ads-${id}-${optic}-${Math.round(a * 100)}`); }
  }
  if (PARTS.includes('scope')) for (const [id, optic] of [['sniper', 'scope'], ['m4a1', 'acog'], ['ak47', 'acog'], ['svd', 'acog'], ['barrett', 'scope6']]) {
    for (const a of [0.55, 0.7, 0.82, 0.88]) { await page.evaluate((o) => window.__fp(o), { id, optic, ads: a, fade: dev !== 'desk' }); await shot(`scope-${id}-${optic}-${Math.round(a * 100)}`); }
  }
  if (PARTS.includes('holo')) for (const [id, optic] of [['m4a1', 'holo'], ['ak47', 'holo'], ['m4a1', 'reddot']]) {
    for (const a of [0.9, 1]) { await page.evaluate((o) => window.__fp(o), { id, optic, ads: a, fade: dev !== 'desk' }); await shot(`holo-${id}-${optic}-${Math.round(a * 100)}`); }
  }
  await ctx.close();
}
await browser.close();
console.log('sayfa hatası:', errs.length, errs.slice(0, 3));
process.exit(errs.length ? 1 : 0);
