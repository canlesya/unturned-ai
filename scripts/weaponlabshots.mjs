// Silah laboratuvarı görüntüleri + başarım (gerçek GPU, headless:false):  node scripts/weaponlabshots.mjs <bölümler=fp,skins,third,big,perf,quick> [çıktı=/tmp/wb-wlab]   BASE=http://127.0.0.1:5271
//   quick: tek görüntü (Q="view=fp&style=s3&w=ak47") → <çıktı>/quick.png
import { chromium, devices } from 'playwright';
import fs from 'fs';
const parts = (process.argv[2] || 'fp,skins,third,big,perf').split(','), OUT = process.argv[3] || '/tmp/wb-wlab', BASE = process.env.BASE || 'http://127.0.0.1:5271';
fs.mkdirSync(`${OUT}/fp`, { recursive: true }); fs.mkdirSync(`${OUT}/big`, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const errs = [];
async function open(q, dev = 'desk', vp = { width: 1600, height: 900 }) {
  const ctx = dev === 'mob' ? await browser.newContext(strip(devices['Pixel 7 landscape'])) : await browser.newContext({ viewport: vp });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${BASE}/weaponlab.html?${q}`); await page.waitForFunction('window.__wlab', null, { timeout: 60000 }); await page.waitForTimeout(300);
  return { ctx, page };
}
const shot = async (page, path, o) => { if (o) await page.evaluate((o) => window.__wlab.set(o), o); await page.waitForTimeout(60); await page.screenshot({ path }); };
const W4 = ['ak47', 'm4a1', 'pistol', 'sniper'];

if (parts.includes('quick')) { const { ctx, page } = await open(process.env.Q || 'view=fp&style=s3&w=ak47', 'desk', { width: +(process.env.VW || 1600), height: +(process.env.VH || 900) }); await shot(page, `${OUT}/quick.png`); await ctx.close(); }
if (parts.includes('fp')) {                                              // satırlar S1/S2/S3/mevcut × 4 silah, bel duruşu
  const { ctx, page } = await open('view=fp&hud=0', 'desk', { width: 800, height: 450 });
  for (const st of ['s1', 's2', 's3', 'cur']) for (const w of W4) await shot(page, `${OUT}/fp/${st}-${w}.png`, { style: st, w, skin: 'std', ads: 0 });
  await ctx.close();
}
if (parts.includes('skins')) {                                           // vitrin: S3 4 silah + S2 AK × 5 kaplama
  const { ctx, page } = await open('view=row&ws=s3:ak47,s3:m4a1,s3:pistol,s3:sniper,s2:ak47', 'desk', { width: 2400, height: 1500 });
  await shot(page, `${OUT}/sheet-skins.png`); await ctx.close();
}
if (parts.includes('third')) {
  const { ctx, page } = await open('view=third&ws=cur:ak47,s1:ak47,s2:ak47,s3:ak47,s3:m4a1,s3:pistol,s3:sniper', 'desk', { width: 2000, height: 900 });
  await shot(page, `${OUT}/sheet-third.png`);
  await shot(page, `${OUT}/third-camo.png`, { skin: 'wood', ws: ['s3:ak47', 's3:m4a1', 's3:sniper', 's3:pistol'] });
  await ctx.close();
}
if (parts.includes('big')) {
  const B = [['s3-ak-hip', 'view=fp&style=s3&w=ak47'], ['s3-m4-ads', 'view=fp&style=s3&w=m4a1&ads=1'], ['s3-glock-hip', 'view=fp&style=s3&w=pistol'], ['s3-m24-hip', 'view=fp&style=s3&w=sniper'],
    ['s2-ak-hip', 'view=fp&style=s2&w=ak47'], ['s1-ak-hip', 'view=fp&style=s1&w=ak47'], ['s3-ak-camo-turntable', 'view=row&ws=s3:ak47&skins=wood&yaw=0.5'], ['s3-skins-row', 'view=row&ws=s3:ak47,s3:m4a1&skins=std,desert,wood,urban,gold'],
    ['s3-m4-hip', 'view=fp&style=s3&w=m4a1'], ['cur-ak-hip', 'view=fp&style=cur&w=ak47'], ['s3-ak-camo-hip', 'view=fp&style=s3&w=ak47&skin=wood'], ['s3-m4-urban-hip', 'view=fp&style=s3&w=m4a1&skin=urban'], ['s3-ak-gold-hip', 'view=fp&style=s3&w=ak47&skin=gold']];
  for (const [n, q] of B) { const { ctx, page } = await open(q + '&hud=1'); await shot(page, `${OUT}/big/${n}.png`); await ctx.close(); }
}
if (parts.includes('perf')) {
  const res = { note: 'GPU ms = render + readPixels eşitlemesi ortalaması (gerçek GPU, Chromium headless:false, --ignore-gpu-blocklist). Pixel 7 = Playwright öykünmesi (ekran boyutu + DPR 2,625), GERÇEK TELEFON DEĞİL: GPU Mac GPU’su.', counts: null, fp: {}, crowd: {}, skinSwap: null };
  { const { ctx, page } = await open('view=fp&hud=0'); res.counts = await page.evaluate(() => window.__wlab.counts());
    for (const st of ['cur', 's1', 's2', 's3']) for (const w of W4) { await page.evaluate((o) => window.__wlab.set(o), { style: st, w }); res.fp[`desk:${st}:${w}`] = await page.evaluate(() => window.__wlab.perfFP()); }
    await page.evaluate((o) => window.__wlab.set(o), { style: 's3', w: 'ak47' }); res.skinSwap = await page.evaluate(() => window.__wlab.skinSwap());
    await ctx.close(); }
  for (const dev of ['desk', 'mob']) {
    { const { ctx, page } = await open('view=fp&hud=0', dev); for (const st of ['cur', 's3']) for (const w of ['ak47', 'm4a1']) { await page.evaluate((o) => window.__wlab.set(o), { style: st, w }); res.fp[`${dev}:${st}:${w}`] = await page.evaluate(() => window.__wlab.perfFP()); } await ctx.close(); }
    for (const st of ['cur', 's3', 's2']) { const { ctx, page } = await open(`view=perf&style=${st}&n=20&hud=0`, dev); res.crowd[`${dev}:${st}`] = await page.evaluate(() => window.__wlab.perf(100)); if (dev === 'desk' && st === 's3') await page.screenshot({ path: `${OUT}/perf-scene.png` }); await ctx.close(); }
    { const { ctx, page } = await open('view=perf&style=s3&n=0&hud=0', dev); res.crowd[`${dev}:empty`] = await page.evaluate(() => window.__wlab.perf(100)); await ctx.close(); }
  }
  fs.writeFileSync(`${OUT}/perf.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res.crowd, null, 1));
}
console.log('hata:', errs.length, [...new Set(errs)].slice(0, 8));
await browser.close();
