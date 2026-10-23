// Nişan (ADS) görüntüleri (gerçek GPU, headless:false): silah × nişangâh × adsT kareleri + ADS geçişi şeridi (gerçek zamanlı 1/60 sn adımlar, adsT oyundaki hızla artar).
//   node scripts/adsshots.mjs <çıktı klasörü> [taban url]    ONLY=regex (ad) · DEV=desk|mob · STRIP=m4a1:holo (geçiş şeridi silahı) · W=1600 H=900
// Dosyalar: <dev>-<silah>-<nişangâh>-<yüzde>.png ve <dev>-strip-<silah>-<nişangâh>-<kare>.png. Arayüz gizli, yalnız retikül öğeleri (#rdot / #holo / #scope / #idot / artı / kararma) açık.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-ads2/after', base = process.argv[3] || 'http://127.0.0.1:5301';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null, dev = process.env.DEV || 'desk';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${dev === 'mob' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.evaluate(async () => {
  const { WSTATS } = await import('/src/game/stats.js');
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
  g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
  s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0); s.yaw = 0.6; s.pitch = 0.05; s.protT = 1e9;
  for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';
  const h = document.getElementById('hud'); if (h) { h.style.visibility = 'visible'; for (const c of h.querySelectorAll(':scope > *')) c.style.visibility = /^(rdot|holo|scope|idot|cross|scopeblk|advig)$/.test(c.id) ? 'visible' : 'hidden'; }
  const reset = (o) => {
    const SL = WSTATS[o.id].slot === 'secondary' ? 1 : 0;
    s.cur = SL; s.items[SL] = { id: o.id, mag: 30, reserve: 90 }; s.optic = o.optic; if (s.model) s.model.optic = o.optic;
    p.refreshWeapon();
    const vm = p.vm; vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
    s.swing = null; s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0; s.recoilP = 0; s.leanT = 0;
  };
  const fin = () => { g.hud.update(1 / 60); };
  window.__pose = (o) => {                                                                   // sabit adsT (yay oturur)
    reset(o); s.ads = o.t > 0.5;
    for (let i = 0; i < 60; i++) { s.adsT = o.t; p.update(1 / 60); }
    fin();
  };
  window.__hip = (o) => { reset(o); s.ads = false; for (let i = 0; i < 60; i++) { s.adsT = 0; p.update(1 / 60); } fin(); };
  window.__adv = (n) => {                                                                     // geçiş: adsT oyundaki hızla (soldier.js: 9/sn, dürbün 6/sn)
    s.ads = true;
    for (let i = 0; i < n; i++) { s.adsT = Math.min(1, s.adsT + (s.overlay === 'scope' ? 6 : 9) / 60); p.update(1 / 60); }
    fin();
  };
});
const SHOTS = [['ak47', 'iron'], ['ak47', 'holo'], ['m4a1', 'reddot'], ['m4a1', 'acog'], ['m4a1', 'acog', 0.8], ['m4a1', 'holo'], ['scarh', 'holo'], ['mp5', 'reddot'], ['lmg', 'holo'], ['sniper', 'scope', 0.7], ['sniper', 'scope', 1], ['pistol', 'iron'], ['shotgun', 'holo'], ['aug', 'acog', 0.75]];
for (const [id, optic, t = 1] of SHOTS) {
  const name = `${dev}-${id}-${optic}-${Math.round(t * 100)}`;
  if (only && !only.test(name)) continue;
  await page.evaluate((o) => window.__pose(o), { id, optic, t });
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${out}/${name}.png` });
}
const [sid, sop] = (process.env.STRIP || 'm4a1:holo').split(':');
if (!only || only.test('strip')) {
  await page.evaluate((o) => window.__hip(o), { id: sid, optic: sop });
  let f = 0;
  for (const tgt of [0, 2, 4, 6, 9, 14, 24]) {                                                   // kare numarası (1/60 sn): 0, 33, 67, 100, 150, 233, 400 ms
    await page.evaluate((n) => window.__adv(n), tgt - f); f = tgt;
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${out}/${dev}-strip-${sid}-${sop}-${String(tgt).padStart(2, '0')}.png` });
  }
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
