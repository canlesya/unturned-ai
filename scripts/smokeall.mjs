// Toplu birleştirme duman testi: çevrimdışı (colgecidi tdm, maden payload) + çevrim içi (yerel sunucu) — sayfa hatası yok, oyun koşuyor, ekran görüntüsü.
//   node scripts/smokeall.mjs <istemci url> <ws url> <çıktı klasörü>
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const [base = 'http://127.0.0.1:5180', ws = 'ws://127.0.0.1:8956', out = '/tmp/wb-smoke'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
let fails = 0; const check = (ok, m) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${m}`); if (!ok) fails++; };
for (const [name, q] of [['tdm', '?autostart=4v4&map=colgecidi&type=tdm&debug=1&nolock=1'], ['payload', '?autostart=5v5&map=maden&type=payload&debug=1&nolock=1'], ['online', `?online=new&type=dm&per=6&map=colgecidi&debug=1&nolock=1&name=Smoke&server=${encodeURIComponent(ws)}`]]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('response', (r) => { if (r.status() >= 400 && !/\/audio\/music\//.test(r.url())) errs.push(`${r.status()} ${r.url()}`); }); page.on('requestfailed', (r) => { if (!/:8787\/|\/audio\/music\//.test(r.url())) errs.push('başarısız ' + r.url()); });      // :8787 = varsayılan sunucunun /balance'ı (yerelde kapalı, beklenen)
  await page.goto(base + '/' + q);
  const ok = await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier, null, { timeout: 120000 }).then(() => true, () => false);
  check(ok, `${name}: oyun koşuyor`);
  if (ok) {
    await page.evaluate(async () => { const g = window.__game, p = g.player, s = p.s; s.protT = 1e9; p.fireHeld = true; await new Promise((r) => setTimeout(r, 1500)); p.fireHeld = false; s.ads = true; await new Promise((r) => setTimeout(r, 800)); s.ads = false; });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  check(!errs.length, `${name}: sayfa hatası yok ${errs.slice(0, 3).join(' | ')}`);
  await page.close();
}
await browser.close();
console.log(fails ? `sonuç: HATA (${fails})` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
