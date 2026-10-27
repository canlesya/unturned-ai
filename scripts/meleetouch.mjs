// 12.194 Telefonda yakın dövüş (Pixel 7 yatay, touch=1): ateş düğmesi = hızlı kesik, nişan düğmesi basılı = ağır vuruş (bırakınca durur), silah değişince nişan bayrağı sönük.
//   node scripts/meleetouch.mjs [taban url]
import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const browser = await chromium.launch(process.env.GPU !== '0' ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const { defaultBrowserType, ...dev } = devices['Pixel 7 landscape'];
const page = await (await browser.newContext(dev)).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0&touch=1`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player && window.__game.player.touch', null, { timeout: 120000 });
const r = await page.evaluate(async () => {
  const g = window.__game, p = g.player, s = p.s, T = p.touch, out = {};
  g.brains.forEach((b) => (b.update = () => {}));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  s.ads = true; s.cur = 0; p.refreshWeapon();                          // tüfekte nişan açık …
  s.switchTo(3); await wait(500);                                      // … bıçağa geçince ağır vuruş kendiliğinden başlamasın
  out.adsAfterSwitch = s.ads; out.kind = s.stat.kind; out.swingAfterSwitch = !!s.swing;
  const log = []; const iv = setInterval(() => { const w = s.swing; if (w && log[log.length - 1]?.ref !== w) log.push({ ref: w, kind: w.kind, hv: !!w.hv }); }, 10);
  const seen = (from) => log.slice(from).map(({ kind, hv }) => ({ kind, hv }));
  await wait(400);
  const ft = { identifier: 99, clientX: 800, clientY: 300 }; T.press('fire', true, ft); await wait(150); T.press('fire', false, ft);
  await wait(500); out.fire = seen(0)[0] || null;
  await wait(400); const n0 = log.length;
  T.press('ads', true); await wait(300);
  out.heavy = seen(n0)[0] || null; out.adsBtnOn = T.b.ads.classList.contains('on');
  await wait(1600); out.heavyN = seen(n0).filter((x) => x.hv).length;          // basılı tutuldukça ağır vuruş tekrarlar
  T.press('ads', false); await wait(1200); const n1 = log.length; await wait(800);
  out.afterRelease = { ads: s.ads, newSwings: log.length - n1, on: T.b.ads.classList.contains('on') };
  clearInterval(iv);
  return out;
});
check(r.kind === 'melee' && r.adsAfterSwitch === false && !r.swingAfterSwitch, `bıçağa geçince nişan sönük, savurma yok ${JSON.stringify({ k: r.kind, a: r.adsAfterSwitch, s: r.swingAfterSwitch })}`);
check(r.fire && r.fire.kind === 'rl' && !r.fire.hv, `ateş düğmesi → hızlı kesik ${JSON.stringify(r.fire)}`);
check(r.heavy && r.heavy.hv && r.heavy.kind === 'stab' && r.adsBtnOn, `nişan düğmesi basılı → ağır saplama ${JSON.stringify(r.heavy)} (düğme yanık ${r.adsBtnOn})`);
check(r.heavyN >= 2, `basılı tuttukça ağır vuruş tekrar (${r.heavyN} ağır)`);
check(!r.afterRelease.ads && !r.afterRelease.newSwings && !r.afterRelease.on, `bırakınca durur ${JSON.stringify(r.afterRelease)}`);
check(errs.length === 0, `sayfa hatası yok ${errs.slice(0, 3)}`);
await browser.close();
console.log(fail ? `${fail} HATA` : 'hepsi geçti');
process.exit(fail ? 1 : 0);
