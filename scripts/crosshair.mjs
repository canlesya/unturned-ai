// 12.186 Bel nişangâhı (artı) denetimi, gerçek GPU: her silah × durum (dur / yürü / çömel / seri ateş / koş / nişan) → artı boşluğu (--g, px) + ekran ortası kırpıntısı.
//   node scripts/crosshair.mjs <çıktı klasörü> [taban url=http://127.0.0.1:5180]    DEV=desk|mob · ONLY=regex (silah kimliği)
//   Çıktı: <klasör>/<dev>/<silah>-<durum>.png (ortadan 240×240 masaüstü / 160×160 telefon CSS px) + <klasör>/<dev>.json (boşluk / sapma / çizgi boyu).
//   Izgara: python3 scripts/crosshairsheet.py <klasör> (önce / sonra klasörleri yan yana).
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-crosshair/now', base = process.argv[3] || 'http://127.0.0.1:5180';
const DEV = process.env.DEV || 'desk', only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
mkdirSync(`${out}/${DEV}`, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = DEV === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${DEV !== 'desk' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.__game, s = g.playerSoldier;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; });
  s.protT = 1e9; g.devGod = true; s.fly = false;          // dev=1 uçuşla başlar: havada sapma (AIR_SPREAD) ölçümü bozar
  window.__home = { x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw: s.yaw };
});
const W = await page.evaluate(async () => { const m = await import('/src/game/stats.js'); window.__W = m.WSTATS; window.__OA = m.OPTIC_ALLOWED; return Object.entries(m.WSTATS).filter(([, s]) => s.kind === 'gun').map(([id]) => id); });
const list = W.filter((id) => !only || only.test(id));
const clipS = DEV === 'desk' ? 240 : 160;
const vp = page.viewportSize(), clip = { x: vp.width / 2 - clipS / 2, y: vp.height / 2 - clipS / 2, width: clipS, height: clipS };
const res = {};
const read = () => page.evaluate(() => {
  const g = window.__game, s = g.playerSoldier, c = document.getElementById('cross'), cs = getComputedStyle(c);
  const sp = [...c.querySelectorAll('span.h')][0];
  return { gap: parseFloat(c.style.getPropertyValue('--g')) || 0, shown: cs.display !== 'none' && !c.classList.contains('ads'), spread: +(s.spreadNow(s.stat) * 1000).toFixed(2), len: sp ? sp.getBoundingClientRect().width : 0, fov: +g.camera.fov.toFixed(1) };
});
for (const id of list) {
  await page.evaluate((id) => {
    const g = window.__game, p = g.player, s = g.playerSoldier, h = window.__home;
    const opt = (window.__OA[id] || ['iron'])[0];
    s.cur = 0; s.items[0] = { id, mag: 999, reserve: 999 }; s.optic = opt; if (s.model) s.model.optic = opt;
    p.refreshWeapon(); s.ads = false; s.adsT = 0; s.reloadT = 0; s.switchT = 0; s.bloom = 0;
    s.pos.set(h.x, h.y, h.z); s.vel.set(0, 0, 0); s.yaw = h.yaw; s.pitch = 0.05;
  }, id);
  await page.waitForTimeout(900);
  const r = {};
  const shot = async (st) => { r[st] = await read(); await page.screenshot({ path: `${out}/${DEV}/${id}-${st}.png`, clip }); };
  await shot('dur');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await shot('yuru'); await page.keyboard.up('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.down('KeyC'); await page.waitForTimeout(700); await shot('comel'); await page.keyboard.up('KeyC'); await page.evaluate(() => { window.__game.playerSoldier.crouching = false; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const s = window.__game.playerSoldier; s.pos.set(window.__home.x, window.__home.y, window.__home.z); s.yaw = window.__home.yaw; });
  await page.mouse.move(vp.width / 2, vp.height / 2);
  if (DEV === 'desk') { await page.mouse.down(); await page.waitForTimeout(450); await shot('ates'); await page.mouse.up(); }
  else {      // telefonda fare ateşi yok: seri ateşin durumu (bloom tavanı, son atış az önce) kurulur, kare çizilsin diye her karede tazelenir
    await page.evaluate(() => { const s = window.__game.playerSoldier; s.crouching = false; window.__spray = setInterval(() => { s.bloom = 0.005; s.sinceShot = 0.05; }, 4); });
    await page.waitForTimeout(400); await shot('ates'); await page.evaluate(() => clearInterval(window.__spray));
  }
  await page.evaluate(() => { const s = window.__game.playerSoldier; s.pitch = 0.05; s.recoilP = 0; s.pos.set(window.__home.x, window.__home.y, window.__home.z); s.yaw = window.__home.yaw; });
  await page.waitForTimeout(700);
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(700); await shot('kos'); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  await page.evaluate(() => { const s = window.__game.playerSoldier; s.pos.set(window.__home.x, window.__home.y, window.__home.z); s.yaw = window.__home.yaw; s.vel.set(0, 0, 0); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__game.playerSoldier.ads = true; }); await page.waitForTimeout(700); await shot('nisan');
  await page.evaluate(() => { window.__game.playerSoldier.ads = false; });
  res[id] = r;
  console.log(id.padEnd(10), Object.entries(r).map(([k, v]) => `${k} ${v.shown ? v.gap.toFixed(1) : '—'}px/${v.spread}`).join('  '));
}
writeFileSync(`${out}/${DEV}.json`, JSON.stringify({ dev: DEV, vp, res }, null, 1));
console.log('sayfa hatası:', errs.length, errs.slice(0, 3).join(' | '));
await browser.close();
