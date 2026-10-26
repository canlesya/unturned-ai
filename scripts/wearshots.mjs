// 12.167 Oyun içi kıyafet görüntüleri: çevrimdışı maçta botları oyuncunun önüne dizer (gündüz: sınıf varsayılanları + bot çeşitlemesi; gece: ışıklı set).
//   node scripts/wearshots.mjs [taban url]   OUT=/tmp/wb-karakter/son
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180', OUT = process.env.OUT || '/tmp/wb-karakter/son';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [];
const shot = async (name, q, codes) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }); const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/?autostart=6v6&map=colgecidi&type=tdm&debug=1&nolock=1&third=0&touch=0${q}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const place = (codes) => page.evaluate((codes) => {
    const g = window.__game, me = g.playerSoldier, list = g.soldiers.filter((s) => s !== me && !s.def.zombie).slice(0, 8);
    if (codes) list.forEach((s, i) => { const c = codes[i % codes.length]; if (s.wearCode !== c) { s.wearCode = c; s._buildModel(); s._modelWeapon = undefined; s._syncWeaponModel(true); } });
    const yaw = me.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    list.forEach((s, i) => { const k = i - 3.5, d = 4.6 + (i % 2) * 0.9; s.alive = true; s.hp = s.maxHp; s.model.root.visible = true; s.pos.set(me.pos.x + fx * d + rx * k * 0.95, me.pos.y, me.pos.z + fz * d + rz * k * 0.95); s.vel.set(0, 0, 0); s.yaw = yaw + Math.PI + (i % 3 - 1) * 0.6; s.pitch = 0; if (s.brain) s.brain.frozen = true; });
    me.pitch = -0.08;
  }, codes);
  for (let i = 0; i < 12; i++) { await place(codes); await page.waitForTimeout(60); }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
};
await shot('oyun_gunduz', '&tod=day', null);
await shot('oyun_kombin', '&tod=day', ['1100200000', '2232425230', '0333023333', '4414342414', '3013010300', '5525052525', '0626062626', '6646563636']);
await shot('oyun_gece_isikli', '&tod=night', ['6646563636', '6640560636', '0646563636', '1636463626']);
console.log('hatalar:', errs);
await browser.close();
