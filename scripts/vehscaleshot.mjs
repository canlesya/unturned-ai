// 12.206 oyuncu sayısına göre araç sayısı — gerçek GPU görüntüleri (pencereli, --use-angle=metal) + sayım tablosu.
//   URL=http://127.0.0.1:5189 OUT=/tmp/wb-heli2/scale PERS=10,32,64 node scripts/vehscaleshot.mjs
// Her takım büyüklüğünde Kuzey Ele Geçirme açılır (botlar dondurulur), iki üs tepeden + eğik açıdan çekilir, araçlar türe göre sayılır.
// Oda sınırı (LIMITS.maxPerTeam 32) başka işte yükseltilir; 64 / 128 denemesi için yalnız bu betikte balance.js isteği yeniden yazılır.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5189', OUT = process.env.OUT || '/tmp/wb-heli2/scale', PERS = (process.env.PERS || '10,32,64').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [], table = [];
for (const per of PERS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/\/src\/game\/balance\.js/, async (route) => { const r = await route.fetch(); const body = (await r.text()).replace('maxPerTeam: 32', 'maxPerTeam: 128'); await route.fulfill({ response: r, body }); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL0}/?autostart=${per}v${per}&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1&dev=1`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  const cnt = await page.evaluate(() => {
    const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true;
    for (const s of g.soldiers) if (s !== g.playerSoldier) { s.alive = false; s.vacant = true; }
    const k = (v) => (v.def.heli ? 'heli' : v.def.cannon ? 'tank' : v.def.moto ? 'moto' : 'jip'), o = { per: g.mode.perTeam, total: g.vehicles.list.length };
    for (const t of ['blue', 'red']) for (const v of g.vehicles.list) if (v.spawn.team === t) { const key = t + '.' + k(v); o[key] = (o[key] || 0) + 1; }
    const r = g.renderer, rr = r.render.bind(r);
    r.render = (sc, cam) => { const C = window.__cam; if (C) g.player.vm.root.visible = false; if (C && cam === g.camera) { cam.position.set(C[0], C[1], C[2]); cam.lookAt(C[3], C[4], C[5]); cam.fov = C[6] || 50; cam.updateProjectionMatrix(); } return rr(sc, cam); };
    document.getElementById('hud') && (document.getElementById('hud').style.visibility = 'hidden');
    return o;
  });
  console.log(JSON.stringify(cnt));
  table.push(cnt);
  for (const [t, x, z, s] of [['mavi', 120, 700, 1], ['kirmizi', -120, -700, -1]]) {
    await page.evaluate(([x, z]) => { window.__cam = [x + 0.01, 230, z + 0.01, x, 30, z, 50]; }, [x, z]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${per}v${per}-${t}-tepeden.png` });
    await page.evaluate(([x, z, s]) => { window.__cam = [x + 60 * s, 95, z + 150 * s, x, 34, z - 5 * s, 55]; }, [x, z, s]);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${per}v${per}-${t}-egik.png` });
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/sayim.json`, JSON.stringify(table, null, 1));
await browser.close();
console.log('sayfa hatası', errs.length, errs.slice(0, 3).join(' | '));
process.exit(errs.length ? 1 : 0);
