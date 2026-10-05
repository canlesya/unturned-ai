// Harita editörü: kayıtlı düzenlemelerle (yalnız taşıma / yalnız boyut / yalnız silme) yeniden açılınca panel dolu mu.  node scripts/editorload.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
let fail = 0; const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
for (const saved of [[{ id: 'kenar:18', at: [-1.413, -0.35, -11.742], d: [0.25, 0, 0] }], [{ id: 'kenar:18', at: [-1.413, -0.35, -11.742], s: [1.1, 1.1, 1.1] }], [{ id: 'kasa:3', del: true }]]) {
  await p.goto('http://127.0.0.1:5180/'); await p.evaluate((v) => localStorage.setItem('warbyte.harita-duzenleme.colgecidi', JSON.stringify(v)), saved);
  await p.goto('http://127.0.0.1:5180/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1');
  await p.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 }); await p.waitForTimeout(800);
  await p.keyboard.press('KeyI'); await p.waitForTimeout(300);
  const txt = await p.evaluate(() => document.querySelector('#med').innerText), e = errs.splice(0);
  const good = /HARİTA EDİTÖRÜ/i.test(txt) && !/Panel hatası/.test(txt) && !e.length; if (!good) fail++;
  console.log((good ? 'OK   ' : 'HATA ') + 'kayıt ' + JSON.stringify(saved[0]).slice(0, 70), e.slice(0, 2));
}
await p.evaluate(() => localStorage.removeItem('warbyte.harita-duzenleme.colgecidi')); await b.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
