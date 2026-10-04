// Çöl Geçidi çevrimiçi: oda kur, taraf değişimi sunucu↔istemci tutarlı mı, doğuş doğru avluda mı.  node scripts/cgnet.mjs [tur=4]  (BF_DEBUG=1 sunucu + vite 5180)
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const rounds = +process.argv[2] || 4, seen = new Set();
for (let r = 0; r < rounds; r++) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${process.env.BASE || 'http://127.0.0.1:5180'}/?online=new&type=tdm&per=4&map=colgecidi&debug=1&nolock=1&server=${process.env.WSURL || 'ws://127.0.0.1:8787'}&name=Sinama&team=blue`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const o = await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; return { swap: g.swapSides, cfgSwap: g.opts.online.cfg.swap, x: p.pos.x, team: p.team, blueX: g.map.spawns.blue[0].x, redX: g.map.spawns.red[0].x, alive: p.alive }; });
  seen.add(o.swap);
  const ownX = o.team === 'blue' ? o.blueX : o.redX;
  check(o.swap === o.cfgSwap, `tur ${r + 1}: istemci taraf değişimi = sunucu cfg (${o.swap})`);
  check(Math.abs(o.x - ownX) < 25 && o.alive, `tur ${r + 1}: mavi oyuncu kendi avlusunda doğdu (x=${o.x.toFixed(0)}, avlu x≈${ownX.toFixed(0)}, ${o.swap ? 'CT doğuda (+)' : 'T batıda (−)'})`);
  check(errs.length === 0, `tur ${r + 1}: sayfa hatası yok ${errs.slice(0, 2)}`);
  if (r === 0) await page.screenshot({ path: 'screenshots/cg-net.png' });
  await page.close();
}
check(seen.size > 1 || rounds < 4, `taraf dağılımı iki yönlü görüldü: ${[...seen].join(',')}`);
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK');
await browser.close(); process.exit(fail ? 1 : 0);
