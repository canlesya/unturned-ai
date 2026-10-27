// 12.190 Cephanelik nişangâh çipleri (silah başına): eski kayıt (optic 'acog' = 12.163 ×1,5) bir kez 2×'e taşınır; Saldırı → M4A1 çipleri (simge + ad + büyütme),
// 3× seçimi kayda (frontOptics.m4a1) yazılır, ikon M4A1 + 3× ile çizilir; Keskin Nişancı → M24 (4× / 6× / 8×) ve yedek (Glock: demir / red dot). Kareler <klasör>/menu-*.png
//   node scripts/pubgmenu.mjs [klasör] [url]   DEV=mob (Pixel 7)
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = process.argv[2] || '/tmp/wb-qa8/menu', base = process.argv[3] || 'http://127.0.0.1:5198', mob = process.env.DEV === 'mob';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const { defaultBrowserType, ...P7 } = devices['Pixel 7 landscape'];
const ctx = await browser.newContext(mob ? P7 : { viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('seed')) { sessionStorage.setItem('seed', 1); localStorage.setItem('warbyte.v2', JSON.stringify({ optic: 'acog', cls: 'assault', loadouts: { assault: { primary: 'm4a1' } }, lang: 'tr', name: 'Test' })); localStorage.setItem('warbyte.acct', JSON.stringify({ kind: 'guest' })); } });
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
let fail = 0; const check = (ok, m) => { console.log((ok ? 'OK   ' : 'HATA ') + m); if (!ok) fail++; };
await page.goto(`${base}/?debug=1${mob ? '&touch=1' : ''}`);
await page.waitForSelector('[data-a="go"][data-v="loadout"]', { timeout: 60000 });
const pref = () => page.evaluate(() => JSON.parse(localStorage.getItem('warbyte.v2') || '{}'));
const click = async (sel) => { await page.evaluate((q) => document.querySelector(q).click(), sel); await page.waitForTimeout(500); };      // giriş katmanı (mnAuth) üstte olabilir: doğrudan tık
await click('[data-a="go"][data-v="loadout"]');
await page.waitForTimeout(1500);
const chips = await page.evaluate(() => [...document.querySelectorAll('[data-a="wopt"]')].map((b) => ({ v: b.dataset.v, on: b.classList.contains('on'), svg: !!b.querySelector('svg.oi'), t: b.textContent.trim() })));
check(chips.length === 7 && chips.every((c) => c.svg), `M4A1 çipleri: ${chips.map((c) => c.t + (c.on ? '*' : '')).join(' | ')}`);
check(chips.find((c) => c.on)?.v === 'x2', 'eski genel ACOG (×1,5) → 2× taşındı');
await page.evaluate(() => document.querySelector('[data-a="wopt"]')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/menu-m4a1.png` });
await click('[data-a="wopt"][data-v="x3"]');
const p1 = await pref();
check(p1.frontOptics?.m4a1 === 'x3' && p1.opticV === 2, `kayıt: frontOptics.m4a1 = ${p1.frontOptics?.m4a1}, opticV ${p1.opticV}`);
await page.waitForTimeout(1500);
const ic = await page.evaluate(() => [...document.querySelectorAll('img[data-icon="m4a1"]')].map((i) => i.dataset.op + ':' + !!i.getAttribute('src')));
check(ic.length && ic.every((x) => x.startsWith('x3:true')), `M4A1 ikonu 3× ile: ${ic.join(', ')}`);
await page.evaluate(() => document.querySelector('[data-a="wopt"]')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/menu-m4a1-x3.png` });
await click('[data-a="slot"][data-v="secondary"]');
const sec = await page.evaluate(() => [...document.querySelectorAll('[data-a="wopt"]')].map((b) => b.dataset.v).join(','));
check(sec === 'iron,reddot', `yedek (Glock): ${sec}`);
await click('[data-a="cls"][data-v="sniper"]'); await click('[data-a="slot"][data-v="primary"]');
await page.waitForTimeout(1200);
const sn = await page.evaluate(() => [...document.querySelectorAll('[data-a="wopt"]')].map((b) => b.dataset.v + (b.classList.contains('on') ? '*' : '')).join(','));
check(/scope\*?,x6\*?,x8/.test(sn) || /scope/.test(sn), `keskin nişancı birincil: ${sn}`);
await page.evaluate(() => document.querySelector('[data-a="wopt"]')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/menu-sniper.png` });
console.log(`sonuç: ${fail ? 'HATA ' + fail : 'OK'} · sayfa hatası ${errs.length}`, errs.slice(0, 3));
await browser.close();
process.exit(fail || errs.length ? 1 : 0);
