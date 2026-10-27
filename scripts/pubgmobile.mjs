// 12.190 telefonda (Pixel 7 yatay, touch=1) nişangâh: GERÇEK dokunuşla nişangâh düğmesi → seçici (ikon + büyütme) → 2× / 3× / 4× ACOG / 6× → NİŞAN düğmesi; tam nişanda
// mercek katmanı (#lens) / dürbün örtüsü açık, retikül çizgileri ≥ 1,3 CSS px, nokta ≥ 5 px. Kareler: <klasör>/mob-<nişangâh>.png (+ seçici).
//   node scripts/pubgmobile.mjs [klasör] [url]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = process.argv[2] || '/tmp/wb-qa8/mobile', base = process.argv[3] || 'http://127.0.0.1:5198';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const { defaultBrowserType, ...D } = devices['Pixel 7 landscape'];
const page = await (await browser.newContext(D)).newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&touch=1`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player?.touch', null, { timeout: 120000 });
await page.evaluate(() => { const g = window.__game, s = g.player.s; g.brains.forEach((b) => (b.update = () => {})); s.protT = 1e9; s.cur = 0; s.items[0] = { id: 'm4a1', mag: 30, reserve: 90 }; s.optics = {}; g.player.refreshWeapon(); g.player.locked = true; });
await page.waitForTimeout(1500);
const tap = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('yok ' + sel); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(350); };
let fail = 0; const check = (ok, m) => { console.log((ok ? 'OK   ' : 'HATA ') + m); if (!ok) fail++; };
for (const o of ['x2', 'x3', 'acog', 'x6']) {
  await tap('#tc .b[data-b=optic]');
  if (o === 'x2') await page.screenshot({ path: `${OUT}/mob-secici.png` });
  await tap(`#tcOp [data-o=${o}]`);
  const cur = await page.evaluate(() => window.__game.player.s.opticId);
  check(cur === o, `seçici → ${o} (şimdi ${cur})`);
  await tap('#tc .b[data-b=ads]');
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const g = window.__game, s = g.player.s, L = document.getElementById('lens'), sc = document.getElementById('scope');
    const lines = [...L.querySelectorAll('rect.k')].map((e) => Math.min(+e.getAttribute('width'), +e.getAttribute('height'))), dot = L.querySelector('circle.r');
    return { adsT: +s.adsT.toFixed(2), zoom: +g.player.zoomCur().toFixed(2), lens: L.style.display, scope: sc.style.display, minLine: lines.length ? Math.min(...lines) : null, dot: dot ? +(2 * dot.getAttribute('r')).toFixed(1) : null, ov: s.overlay };
  });
  await page.screenshot({ path: `${OUT}/mob-${o}.png` });
  const view = r.ov === 'lens' ? r.lens === 'block' : r.scope === 'block';
  check(r.adsT === 1 && view, `${o}: nişan düğmesi → adsT ${r.adsT}, ×${r.zoom}, ${r.ov === 'lens' ? `#lens ${r.lens}` : `dürbün ${r.scope}`}`);
  if (r.ov === 'lens') check(r.minLine >= 1.29 && (r.dot === null || r.dot >= 5), `${o}: en ince çizgi ${r.minLine} px, nokta ${r.dot} px`);
  await tap('#tc .b[data-b=ads]'); await page.waitForTimeout(500);
}
console.log(`sonuç: ${fail ? 'HATA ' + fail : 'OK'} · sayfa hatası ${errs.length}`, errs.slice(0, 3));
await browser.close();
process.exit(fail || errs.length ? 1 : 0);
