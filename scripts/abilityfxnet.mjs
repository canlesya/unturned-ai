// Çevrimiçi zombi gücü hissi: gerçek istemci Enfekte odası kurar, ölür, zombi doğar, gücü 'ab' kenarıyla sunucuya yollar;
// abilityfx katmanı sunucudan gelen abT / abActive anlık görüntüsüyle açılmalı ve süre bitince kapanmalı. (önce: BF_DEBUG=1 sunucu + vite)
//   GPU=1 node scripts/abilityfxnet.mjs   BASE=http://127.0.0.1:5232 WS=ws://127.0.0.1:8843  → /tmp/wb-zab-shots/net-*.png
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5232', WS = process.env.WS || 'ws://127.0.0.1:8843', OUT = '/tmp/wb-zab-shots';
fs.mkdirSync(OUT, { recursive: true });
const GPU = process.env.GPU !== '0';
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
await page.goto(`${BASE}/?online=new&type=inf&map=${process.env.MAP || 'newyork'}&per=6&debug=1&nolock=1&server=${WS}&name=ZabTest`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 120000 });
await page.waitForTimeout(2000);
// öl → zombi doğ (insan olarak başlarsa)
for (let i = 0; i < 4; i++) {
  const z = await page.evaluate(() => window.__game.playerSoldier.def.zombie && window.__game.playerSoldier.alive);
  if (z) break;
  await page.evaluate(() => { const n = window.__game.online; n.send({ t: 'dbg', kill: 1 }); setTimeout(() => n.send({ t: 'dbg', kill: 1 }), 300); });
  await page.waitForTimeout(8000);
}
const info = await page.evaluate(() => { const p = window.__game.playerSoldier; return { z: p.def.zombie, alive: p.alive, id: p.ability?.id, grace: window.__game.graceLeft }; });
check(info.z && info.alive, `zombi olarak doğdu (${info.id}, hazırlık ${info.grace})`);
// hazırlık bitene kadar bekle, sonra güç (çevrimiçi: edge 'ab' → sunucu uygular → anlık görüntü)
const t0 = Date.now(); let on = '';
while (Date.now() - t0 < 60000) {
  const r = await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; if (g.graceLeft <= 0 && p.abT <= 0 && p.alive) g.player.zAbility(); return g.abfx.state.on; });
  if (r) { on = r; break; }
  await page.waitForTimeout(250);
}
check(on === info.id, `istemcide efekt açıldı (state.on=${on})`);
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/net-${info.id}-on.png` });
const ab = await page.evaluate(() => ({ abT: window.__game.playerSoldier.abT, act: window.__game.playerSoldier.abActive, abn: document.getElementById('abn').textContent }));
console.log('   sunucudan:', JSON.stringify(ab));
await page.waitForTimeout(8000);
const off = await page.evaluate(() => ({ on: window.__game.abfx.state.on, filter: window.__game.renderer.domElement.style.filter }));
await page.screenshot({ path: `${OUT}/net-${info.id}-off.png` });
check(off.on === '' && !off.filter, `süre bitince efekt kapandı (${JSON.stringify(off)})`);
check(!errs.length, `konsol hatası yok${errs.length ? ' → ' + errs.slice(0, 4).join(' | ') : ''}`);
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK'); process.exit(fail ? 1 : 0);
