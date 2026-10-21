// Menü takılma ölçümü: Özel Oyun + Oda Kur ekranlarında her seçime (mod / harita / gün saati / hava / boyut) tıklayıp
// tık→boya süresini (Event Timing = INP) ve tıklamadan sonraki 1,5 s içindeki en uzun uzun-görevi (>50 ms, longtask; ertelenmiş harita kurulumu dahil) ve en uzun kare aralığını (rAF) raporlar; PROF=1 ile CDP CPU profili (en çok öz-süre).
//   node scripts/menuhitch.mjs [url=http://127.0.0.1:5198] [etiket]      DEV=desktop,pixel7 · GPU=swiftshader (varsayılan metal)
import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5198';
const tag = process.argv[3] || '';
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, pixel7: strip(devices['Pixel 7 landscape']) };
const gpu = process.env.GPU === 'swiftshader' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: gpu });
const PROF = !!process.env.PROF;
let worst = 0, worstEv = 0;
for (const dk of (process.env.DEV || 'desktop,pixel7').split(',')) {
  const D = DEVS[dk]; const mob = dk !== 'desktop';
  const ctx = await browser.newContext({ ...D });
  await ctx.addInitScript(() => {
    window.__lt = []; window.__fr = 0; window.__ev = 0; let last = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (/click|pointer|touch/.test(e.name)) window.__ev = Math.max(window.__ev, e.duration); }).observe({ type: 'event', durationThreshold: 16, buffered: false }); } catch (e) { /* yok */ }
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* yok */ }
    const f = (t) => { if (last) window.__fr = Math.max(window.__fr, t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  sayfa hatası', e.message));
  const cdp = await ctx.newCDPSession(page);
  if (PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); }
  await page.goto(base + '/?nolock=1&nologin=1', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#mnStage .home', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const rows = [];
  const step = async (name, sel) => {
    const L = page.locator(sel).first();
    if (!(await L.count())) { rows.push([name, 'yok']); return; }
    await L.evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(700);
    const b = await L.boundingBox();
    const hitOk = await L.evaluate((e, [x, y]) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); }, [b.x + b.width / 2, b.y + b.height / 2]);
    if (!hitOk) { rows.push([name, 'örtülü']); return; }                     // üstünde başka öğe (ör. telefonda alt Oyna çubuğu) varsa tıklama yanlış yere gider
    await page.evaluate(() => { window.__lt = []; window.__fr = 0; window.__ev = 0; });
    if (PROF) await cdp.send('Profiler.start');
    if (mob) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(1500);
    let top = '';
    if (PROF) {
      const { profile } = await cdp.send('Profiler.stop');
      const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map((n) => [n.id, n]));
      profile.samples.forEach((id, i) => { const n = byId.get(id), cf = n.callFrame; if (!cf.url && /idle|program|garbage/.test(cf.functionName)) return; const k = `${cf.functionName || '(anon)'}@${cf.url.split('/').pop().split('?')[0]}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
      top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(0)}ms`).join(' | ');
    }
    const r = await page.evaluate(() => ({ lt: window.__lt.length ? Math.max(...window.__lt) : 0, n: window.__lt.length, fr: window.__fr, ev: window.__ev }));
    rows.push([name, r, top]);
  };
  await step('ana→Özel Oyun', '[data-a=go][data-v=custom]');
  for (const m of ['tdm', 'dm', 'gg', 'inf', 'conquest', 'tdm']) await step('mod ' + m, `.mdc[data-a=type][data-v=${m}]`);
  for (const m of ['vadi', 'us', 'random', 'kasaba']) await step('harita ' + m, `.mapc[data-a=map][data-v=${m}]`);
  for (const t of ['sunset', 'night', 'day']) await step('saat ' + t, `[data-a=tod][data-v=${t}]`);
  await step('hava rain', '[data-a=weather][data-v=rain]');
  await step('boyut', '[data-a=size]:not(.on)');
  await step('süre', '[data-a=time]:not(.on)');
  await step('→Çevrimiçi', '[data-a=go][data-v=online]');
  await step('→Oda kur', '[data-a=oview][data-v=ocreate]');
  for (const m of ['tdm', 'dm', 'inf', 'conquest']) await step('oda mod ' + m, `.mdc[data-a=olset][data-k=type][data-v=${m}]`);
  await step('oda harita vadi', '.mapc[data-a=olset][data-k=map][data-v=vadi]');
  await step('oda saat night', '[data-a=olset][data-k=tod][data-v=night]');
  console.log(`\n== ${dk} ${tag} (${process.env.GPU || 'metal'}) ==`);
  for (const [n, r, top] of rows) {
    if (typeof r === 'string') { console.log(n.padEnd(20), r === 'yok' ? 'öğe yok' : 'öğe örtülü, atlandı'); continue; }
    worst = Math.max(worst, r.lt); worstEv = Math.max(worstEv, r.ev);
    console.log(n.padEnd(20), `tık→boya ${r.ev.toFixed(0).padStart(4)} ms · uzun görev max ${r.lt.toFixed(0).padStart(5)} ms (${r.n} adet) · en uzun kare ${r.fr.toFixed(0).padStart(5)} ms${r.lt > 50 ? '  <<' : ''}${top ? '\n      ' + top : ''}`);
  }
  await ctx.close();
}
await browser.close();
console.log(`\nEN KÖTÜ tık→boya (INP): ${worstEv.toFixed(0)} ms · EN KÖTÜ uzun görev: ${worst.toFixed(0)} ms`);
