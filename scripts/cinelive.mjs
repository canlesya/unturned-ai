// 12.217 canlı sinema kamerası denetimi (gerçek GPU, gerçek zamanlı döngü): ?cine=1 maçında yönetmen kendi çekimlerini seçiyor mu, HUD / silah
// gizli mi; ayrıca aynı maç cine'siz açılınca HUD görünüyor mu (normal oyun etkilenmemiş). Ekran görüntüleri OUT/.
//   OUT=/tmp/wb-cine/live SECS=40 node scripts/cinelive.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5204', OUT = process.env.OUT || '/tmp/wb-cine/live', SECS = +(process.env.SECS || 40);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let fail = 0; const check = (ok, m) => { console.log((ok ? 'OK    ' : 'HATA  ') + m); if (!ok) fail++; };
await page.goto(`${URL0}/?autostart=16v16&map=kuzey&type=conquest&debug=1&nolock=1&nologin=1&cine=1&tod=sunset`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.cine', null, { timeout: 300000 });
for (let t = 0; t < SECS; t += 5) {
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/cine-${String(t + 5).padStart(2, '0')}.jpg`, quality: 80 });
}
const st = await page.evaluate(() => {
  const g = window.__game, vis = [...document.body.children].filter((e) => e !== g.canvas && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE' && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
  return { log: g.cine.log, types: [...new Set(g.cine.log.map((l) => l.type))], visible: vis.map((e) => e.id || e.className || e.tagName), self: g.showSelf, fps: Math.round(g._perf?.fps || 0), t: Math.round(g.time) };
});
console.log(JSON.stringify(st));
check(st.log.length >= 3, `yönetmen ${SECS} sn'de ${st.log.length} çekim seçti (${st.types.join(', ')})`);
check(st.visible.length === 0, 'HUD / arayüz öğeleri gizli' + (st.visible.length ? ': ' + st.visible.join(',') : ''));
check(st.self, 'yerel oyuncunun gövdesi görünür (silah modeli çizilmez)');
// normal oyun: cine yok, HUD görünür
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&debug=1&nolock=1&nologin=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 300000 });
await page.waitForTimeout(3000);
const n = await page.evaluate(() => { const g = window.__game; return { cine: !!g.cine, hud: getComputedStyle(g.hud.root).visibility !== 'hidden' && g.hud.root.style.display !== 'none', self: g.showSelf, cls: document.body.classList.contains('wb-cine') }; });
await page.screenshot({ path: `${OUT}/normal.jpg`, quality: 80 });
check(!n.cine && n.hud && !n.cls && !n.self, `normal maç: cine yok, HUD görünür, birinci şahıs (${JSON.stringify(n)})`);
check(!errs.length, 'sayfa hatası yok' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''));
console.log(fail ? `sonuç: ${fail} HATA` : 'sonuç: OK');
await browser.close();
process.exit(fail ? 1 : 0);
