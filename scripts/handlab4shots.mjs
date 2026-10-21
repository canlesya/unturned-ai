// Elsiz silah laboratuvarı v4 görüntüleri (gerçek GPU): satırlar = cur (mevcut eller) / v1-cur / v1-new / v2-cur / v2-new × 6 silah × bel / nişan × masaüstü / Pixel 7 × gündüz / gece
//   node scripts/handlab4shots.mjs <bölümler=stills,anims,third,perf,big,quick> [çıktı=/tmp/wb-lab4]   BASE=http://127.0.0.1:5253  ROWS=cur,v1-cur,v1-new,v2-cur,v2-new  DEV=desk,mob  TOD=day,night  ONLY=regex
import { chromium, devices } from 'playwright';
import fs from 'fs';
const parts = (process.argv[2] || 'stills,anims,third,perf,big').split(','), OUT = process.argv[3] || '/tmp/wb-lab4';
const BASE = process.env.BASE || 'http://127.0.0.1:5253', ROWS = (process.env.ROWS || 'cur,old,v1-cur,v1-new,v2-cur,v2-new,v3-cur,v3-new').split(','), only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const DEVS = (process.env.DEV || 'desk,mob').split(','), TODS = (process.env.TOD || 'day,night').split(',');
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const errs = [];
async function open(dev, q) {
  const ctx = dev === 'mob' ? await browser.newContext(strip(devices['Pixel 7 landscape'])) : await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(dev + ': ' + e.message));
  await page.goto(`${BASE}/handlab4.html?${q}`); await page.waitForFunction('window.__lab', null, { timeout: 60000 }); await page.waitForTimeout(400);
  return { ctx, page };
}
const rowQ = (r) => { const [d, s] = r.split('-'); return { draft: d, set: s || 'cur' }; };
for (const r of ROWS) fs.mkdirSync(`${OUT}/${r}`, { recursive: true });
fs.mkdirSync(`${OUT}/big`, { recursive: true });
const shot = async (page, path, o) => { await page.evaluate((o) => window.__lab.set(o), o); await page.waitForTimeout(50); await page.screenshot({ path }); };

const W6 = ['ak47', 'm4a1', 'shotgun', 'pistol', 'sniper', 'knife'];
const STILLS = []; for (const w of W6) { STILLS.push([`${w}-hip`, { w }]); if (w !== 'knife') STILLS.push([`${w}-ads`, { w, ads: 1 }]); }
STILLS.push(['ak47-sprint', { w: 'ak47', sprint: 1 }], ['grenade-idle', { w: 'grenade' }]);
const ANIMS = [['ak-reload', 'ak47', 'reload'], ['shotgun-shell', 'shotgun', 'shell'], ['sniper-bolt', 'sniper', 'bolt'], ['pistol-reload', 'pistol', 'reload'], ['knife-slash', 'knife', 'slash'], ['knife-stab', 'knife', 'stab'], ['grenade-throw', 'grenade', 'throw'], ['ak-sprint2ads', 'ak47', 'sprint2ads'], ['ak-fire', 'ak47', 'fire'], ['shotgun-pump', 'shotgun', 'pump']];
const BIG = [['v1-ak-hip', 'v1-new', { w: 'ak47' }], ['v1-m4-hip', 'v1-new', { w: 'm4a1' }], ['v1-shotgun-hip', 'v1-new', { w: 'shotgun' }], ['v1-pistol-hip', 'v1-new', { w: 'pistol' }], ['v1-knife-idle', 'v1-new', { w: 'knife' }], ['v1-ak-reload-mid', 'v1-new', { w: 'ak47', anim: 'reload', t: 0.2 }], ['v2-ak-hip', 'v2-new', { w: 'ak47' }], ['cur-ak-hip', 'cur', { w: 'ak47' }],
  ['v3-ak-hip', 'v3-new', { w: 'ak47' }], ['v3-m4-hip', 'v3-new', { w: 'm4a1' }], ['v3-shotgun-hip', 'v3-new', { w: 'shotgun' }], ['v3-pistol-hip', 'v3-new', { w: 'pistol' }], ['v3-knife-idle', 'v3-new', { w: 'knife' }], ['v3-grenade-idle', 'v3-new', { w: 'grenade' }], ['v3-ak-reload-mid', 'v3-new', { w: 'ak47', anim: 'reload', t: 0.2 }], ['v3-sniper-hip', 'v3-new', { w: 'sniper' }],
  ['old-ak-hip', 'old', { w: 'ak47' }], ['old-knife-idle', 'old', { w: 'knife' }], ['old-grenade-idle', 'old', { w: 'grenade' }]];

for (const r of ROWS) {
  const base = { ...rowQ(r), anim: 'idle', t: 0, ads: 0, sprint: 0, view: 'game' };
  if (parts.includes('stills') || parts.includes('quick')) for (const tod of TODS) for (const dev of DEVS) {
    if (parts.includes('quick') && (tod !== 'day' || dev !== 'desk')) continue;
    const { ctx, page } = await open(dev, `draft=${base.draft}&set=${base.set}&hud=0&tod=${tod}`);
    for (const [n, o] of STILLS) { const nm = `${dev}-${tod}-${n}`; if (only && !only.test(nm)) continue; await shot(page, `${OUT}/${r}/${nm}.png`, { ...base, ...o }); }
    await ctx.close();
  }
  if (parts.includes('anims')) {
    const { ctx, page } = await open('desk', `draft=${base.draft}&set=${base.set}&hud=0`);
    for (const [n, w, anim] of ANIMS) { if (only && !only.test(n)) continue; for (let k = 0; k < 8; k++) await shot(page, `${OUT}/${r}/anim-${n}-${k}.png`, { ...base, w, anim, t: +(k / 7).toFixed(3) }); }
    await ctx.close();
  }
  if (parts.includes('perf') && r !== 'cur' && r !== 'old') {
    const { ctx, page } = await open('desk', `draft=${base.draft}&set=${base.set}&hud=0`);
    const perf = {}; for (const w of W6) { await page.evaluate((o) => window.__lab.set(o), { ...base, w }); perf[w] = await page.evaluate(() => window.__lab.perf()); if (base.draft === 'v3') { await page.evaluate((o) => window.__lab.set(o), { ...base, w, anim: 'reload', t: 0.2 }); perf[w].overlapReload = await page.evaluate(() => window.__lab.report().overlap); } }
    fs.writeFileSync(`${OUT}/${r}/perf.json`, JSON.stringify(perf, null, 1)); console.log(r, JSON.stringify(perf));
    await ctx.close();
  }
}
if (parts.includes('third')) for (const set of ['cur', 'new']) {                      // üçüncü şahıs: asker + silah (mevcut / taslak)
  fs.mkdirSync(`${OUT}/third-${set}`, { recursive: true });
  const { ctx, page } = await open('desk', `draft=v1&set=${set}&view=third&hud=0`);
  for (const w of W6) await shot(page, `${OUT}/third-${set}/${w}.png`, { w, anim: 'idle', t: 0, sprint: 0, view: 'third' });
  await shot(page, `${OUT}/third-${set}/ak47-reload.png`, { w: 'ak47', anim: 'reload', t: 0.2, view: 'third' });
  await shot(page, `${OUT}/third-${set}/knife-slash.png`, { w: 'knife', anim: 'slash', t: 0.4, view: 'third' });
  await ctx.close();
}
if (parts.includes('big')) for (const [n, r, o] of BIG) {
  const b = rowQ(r), { ctx, page } = await open('desk', `draft=${b.draft}&set=${b.set}&hud=0`);
  await shot(page, `${OUT}/big/${n}${r === 'cur' || r === 'old' ? '' : '-new'}.png`, { ...b, anim: 'idle', t: 0, ads: 0, sprint: 0, view: 'game', ...o });
  await ctx.close();
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
