// Tabanca hissi kare dizisi (12.141): atış anından sonra t = 0, 30, 60, 100, 160 ms (bel + nişan), son mermi (sürgü kilidi), çekme ve boş şarjör değişimi.
// Oyun döngüsü dondurulur (simulate = false), adımlar elle (1/240 sn) ilerletilir → her kare aynı zamanda alınır; önce / sonra karşılaştırması için.
//   node scripts/pistolfeel.mjs <çıktı klasörü> [taban url]    GPU=1 → gerçek GPU (headless:false) · ONLY=regex (silah adı)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-pistol/after', base = process.argv[3] || 'http://127.0.0.1:5180';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, GPU = process.env.GPU === '1';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
  for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';
  g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
  s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0);
  s.yaw = 0.6; s.pitch = 0.05; s.protT = 0;
  g.sfx.setVolume(0);
  const run = (sec) => { const n = Math.round(sec * 240); for (let i = 0; i < n; i++) g.step(1 / 240); };
  window.__run = run;
  window.__pose = (o) => {
    g.simulate = false;
    s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0); s.hp = s.maxHp; s.protT = 99;
    s.cur = 1; s.items[1] = { id: o.id, mag: o.mag ?? 10, reserve: 60 };
    p.refreshWeapon();
    const vm = p.vm;
    s.swing = null; s.reloadT = 0; s.adsT = 0; s.ads = false; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.switchT = 0;
    if (o.ads) { s.ads = true; s.adsT = 1; }
    p.fireHeld = false; p.fireBuf = 0; p.keys?.clear?.();
    if (o.raise == null) run(1.2);                                       // çekme bitti, tepme söndü
    vm.bobT = 0; vm.breathT = 0; s.pitch = 0.05; s.recoilP = 0; s.yaw = 0.6;
    if (o.raise == null) run(1 / 60);
  };
  window.__fire = () => { s.cd = 0; return s.tryFire(); };
});
const T = [0, 30, 60, 100, 160];
const W = ['pistol', 'm1911', 'deagle', 'revolver'];
for (const id of W) {
  if (only && !only.test(id)) continue;
  for (const ads of [0, 1]) {
    await page.evaluate(([id, ads]) => window.__pose({ id, ads }), [id, ads]);
    let last = 0;
    await page.evaluate(() => window.__fire());
    for (const t of T) {
      await page.evaluate((d) => window.__run(Math.max(1 / 240, d / 1000)), t - last); last = Math.max(t, 4);
      await page.waitForTimeout(60);
      await page.screenshot({ path: `${out}/${id}-${ads ? 'ads' : 'hip'}-t${String(t).padStart(3, '0')}.png` });
    }
  }
  // son mermi: sürgü geride kalır (160 ms sonra)
  await page.evaluate((id) => { window.__pose({ id, mag: 1 }); window.__fire(); window.__run(0.16); }, id);
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${out}/${id}-last-t160.png` });
  // çekme: 0, 50, 100, 160, 250 ms
  await page.evaluate((id) => window.__pose({ id, raise: 1 }), id);
  let last = 0;
  for (const t of [0, 50, 100, 160, 250]) {
    await page.evaluate((d) => window.__run(Math.max(1 / 240, d / 1000)), t - last); last = t;
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${out}/${id}-raise-t${String(t).padStart(3, '0')}.png` });
  }
  // boş şarjör değişimi: %30 / %66 / %74 / %80 / %95
  await page.evaluate((id) => { window.__pose({ id, mag: 0 }); const s = window.__game.player.s; s.startReload(); }, id);
  last = 0;
  const tot = await page.evaluate(() => window.__game.player.s.reloadTotal);
  for (const k of [0.3, 0.66, 0.74, 0.8, 0.95]) {
    await page.evaluate((d) => window.__run(d), tot * k - last); last = tot * k;
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${out}/${id}-reload-k${Math.round(k * 100)}.png` });
  }
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
