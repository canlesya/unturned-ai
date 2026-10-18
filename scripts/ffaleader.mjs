// Herkes-tek skor kutusu testi (Ölüm Maçı + Silah Yarışı; çevrimdışı + çevrimiçi): öndeyken / eşitken / gerideyken sol-sağ kutu metni, skor tablosu sırası, süre bitiminde kazanan.
// Önce: vite (BASE, vars. :5180) + BF_DEBUG=1 sunucu (WS, vars. ws://127.0.0.1:8787).  node scripts/ffaleader.mjs   · görüntüler: /tmp/wb-ldr-shots/
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5180', WS = process.env.WS || 'ws://127.0.0.1:8787', OUT = process.env.OUT || '/tmp/wb-ldr-shots';
fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1280, height: 720 }, locale: 'tr-TR' }, pixel7: { ...strip(devices['Pixel 7 landscape']), locale: 'tr-TR' } };      // Türkçe metin denetlenir (i18n: dil tarayıcıdan)
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const box = (page) => page.evaluate(() => { const q = (id) => document.getElementById(id).textContent, c = (s) => document.querySelector(s).className; return { lb: q('tnB'), vb: q('tkB'), lr: q('tnR'), vr: q('tkR'), cb: c('#score .tk.blue'), cr: c('#score .tk.red') }; });
const settle = async (page) => { await page.waitForTimeout(300); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };   // HUD kareyle güncellenir
// v: sırayla [ben, rakip1, rakip2…] öldürme (gg: seviye-1); rakip adı döner
const setK = (page, v, gg) => page.evaluate(({ v, gg }) => { const g = window.__game, p = g.playerSoldier, o = g.soldiers.filter((s) => s !== p && !s.vacant); [p, ...o].forEach((s, i) => { if (gg) { s.ggLevel = Math.max(0, (v[i] ?? 1) - 1); s.kills = 0; } else s.kills = v[i] ?? 0; s.score = 0; }); return o.map((s) => s.name); }, { v, gg });

for (const [dev, ctxOpt] of Object.entries(DEVS)) {
  for (const type of ['dm', 'gg']) {
    const gg = type === 'gg', ctx = await browser.newContext(ctxOpt), page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${BASE}/?autostart=6v6&type=${type}&map=kasaba&debug=1&nolock=1&time=600&touch=${dev === 'pixel7' ? 1 : 0}`);
    await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
    await page.evaluate(() => { const g = window.__game; g.brains.forEach((b) => (b.update = () => {})); });
    const T = `${dev}/${type}`;
    // 1) öndeyim: 9 – 7
    let names = await setK(page, [9, 7, 3, 1], gg); await settle(page);
    let b = await box(page);
    check(b.lb === 'SEN · LİDER +2' && b.vb === '9' && b.lr === `2. · ${names[0]}` && b.vr === '7' && b.cb.includes('lead') && !b.cr.includes('lead'), `${T} öndeyim: ${JSON.stringify(b)}`);
    await page.screenshot({ path: `${OUT}/${dev}-${type}-1-onde.png` });
    // 2) eşitim: 7 – 7
    names = await setK(page, [7, 3, 7, 1], gg); await settle(page);
    b = await box(page);
    check(b.lb === 'SEN · BERABERE' && b.vb === b.vr && b.vb === '7' && b.lr === `BERABERE · ${names[1]}` && b.cb.includes('tie'), `${T} berabere: ${JSON.stringify(b)}`);
    await page.screenshot({ path: `${OUT}/${dev}-${type}-2-berabere.png` });
    // 3) gerideyim: 3 – 9, araya 5 giren biri → 3.
    names = await setK(page, [3, 5, 9, 1], gg); await settle(page);
    b = await box(page);
    check(b.lb === 'SEN · 3.' && b.vb === '3' && b.lr === `LİDER · ${names[1]}` && b.vr === '9' && b.cr.includes('lead') && !b.cb.includes('lead'), `${T} gerideyim: ${JSON.stringify(b)}`);
    await page.screenshot({ path: `${OUT}/${dev}-${type}-3-geride.png` });
    // skor tablosu sırası = kutudaki lider
    if (dev === 'desktop') {
      await page.evaluate(() => window.__game.hud.showScoreboard(true)); await settle(page);
      const first = await page.evaluate(() => document.querySelector('#sbbody tr:nth-child(2) td').textContent);
      check(first === names[1], `${T} skor tablosu ilk sıra lider (${first})`);
      await page.screenshot({ path: `${OUT}/${dev}-${type}-4-tablo.png` });
      await page.evaluate(() => window.__game.hud.showScoreboard(false));
      // süre biter → lider kazanır, metinde adı geçer
      await page.evaluate(() => { const g = window.__game; g.timeLeft = 0; g.checkEnd(); }); await settle(page);
      const end = await page.evaluate(() => document.getElementById('end')?.innerText || document.body.innerText.slice(0, 400));
      check(/YENİLGİ|DEFEAT/.test(end) && end.includes(names[1]) && /Süre doldu/.test(end), `${T} süre bitti, kazanan lider: ${end.replace(/\s+/g, ' ').slice(0, 160)}`);
      await page.screenshot({ path: `${OUT}/${dev}-${type}-5-son.png` });
    }
    check(!errs.length, `${T} sayfa hatası yok ${errs.slice(0, 2)}`);
    await ctx.close();
  }
}

// çevrimiçi: öldürmeler sunucudan snapshot ile gelir (kl); BF_DEBUG kl komutuyla ayarla
{
  const ctx = await browser.newContext(DEVS.desktop), page = await ctx.newPage();
  await page.goto(`${BASE}/?online=new&type=dm&per=5&map=kasaba&debug=1&nolock=1&server=${WS}&name=Test`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier', null, { timeout: 90000 });
  const ids = await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; g.online.send({ t: 'dbg', bots: false }); return [p.id, ...g.soldiers.filter((s) => s !== p && !s.vacant).map((s) => s.id)]; });
  const net = async (v) => { await page.evaluate(({ ids, v }) => window.__game.online.send({ t: 'dbg', kl: ids.map((id, i) => [id, v[i] ?? 0]) }), { ids, v }); await page.waitForTimeout(1500); await settle(page); console.log('      ', await page.evaluate(() => window.__game.soldiers.filter((s) => !s.vacant).map((s) => s.id + ':' + s.name + '=' + s.kills).join(' '))); return box(page); };
  let b = await net([9, 7, 3]);
  check(b.lb === 'SEN · LİDER +2' && b.vb === '9' && b.vr === '7', `çevrimiçi öndeyim: ${JSON.stringify(b)}`);
  await page.screenshot({ path: `${OUT}/online-dm-1-onde.png` });
  b = await net([7, 7, 3]);
  check(b.lb === 'SEN · BERABERE' && b.vb === '7' && b.vr === '7', `çevrimiçi berabere: ${JSON.stringify(b)}`);
  b = await net([2, 9, 3]);
  check(b.lb === 'SEN · 3.' && b.lr.startsWith('LİDER · ') && b.vr === '9', `çevrimiçi gerideyim: ${JSON.stringify(b)}`);
  await page.screenshot({ path: `${OUT}/online-dm-3-geride.png` });
  await ctx.close();
}
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK'); process.exit(fail ? 1 : 0);
