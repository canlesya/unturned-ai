// Harita editörü: yalnız taşıma / yalnız boyut / yalnız silme düzenlemesiyle "Haritayı yeniden yükle" sonrası panel dolu ve hatasız mı.  node scripts/editorload.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
let fail = 0; const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
const ready = async () => { await p.waitForFunction('window.__game && window.__game.running && window.__game.mapEditor', null, { timeout: 120000 }); await p.waitForTimeout(800); };
for (const [nm, op] of [['taşıma', 'e.move("kenar:18", [0.25, 0, 0])'], ['boyut', 'e.scale("kenar:18", [1.1, 1.1, 1.1])'], ['silme', 'e.del("kasa:3")']]) {
  await p.goto('http://127.0.0.1:5180/?editor=colgecidi&debug=1&nolock=1'); await ready();
  await p.evaluate((op) => { const e = window.__game.mapEditor; new Function('e', op)(e); e.cmd('reload'); }, op);
  await p.waitForTimeout(500); await ready();
  const r = await p.evaluate(() => ({ txt: document.querySelector('#med').innerText, n: window.__game.mapEditor.list().length })), e = errs.splice(0);
  const good = /HARİTA EDİTÖRÜ/i.test(r.txt) && !/Panel hatası/.test(r.txt) && r.n === 1 && !e.length; if (!good) fail++;
  console.log((good ? 'OK   ' : 'HATA ') + 'yalnız ' + nm + ' → yeniden yükle: panel dolu, düzenleme ' + r.n, e.slice(0, 2));
}
await b.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
