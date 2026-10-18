// Paintball ekran boyası testi: hayattayken (kafa / gövde, her yönden) ekranın ortasındaki nişan alanı boş kalır; elenince orta boyanır.
//   node scripts/pbscreen.mjs [url=http://127.0.0.1:5180]   → /tmp/wb-pbs-shots/*.png   (DEV=desktop,pixel7)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5180', OUT = '/tmp/wb-pbs-shots';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${msg}`); if (!ok) fails++; };
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1600, height: 900 } }, pixel7: strip(devices['Pixel 7 landscape']) };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const dv of (process.env.DEV || 'desktop,pixel7').split(',')) {
  const mob = dv !== 'desktop';
  const page = await browser.newPage(DEVS[dv]);
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=5v5&map=boyakulesi&type=pb&debug=1&nolock=1&touch=${mob ? 1 : 0}`);
  await page.waitForFunction(() => window.__game?.playerSoldier && window.__game.hud, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  // ortadaki nişan alanında (yükseklik × %32 yarıçaplı daire) boyalı piksel oranı
  const centerInk = () => page.evaluate(() => {
    const sp = window.__game.hud.sp; sp.update(0);
    const cv = sp.cv, x = cv.getContext('2d'), W = cv.width, H = cv.height, R = H * 0.16;
    const d = x.getImageData(Math.round(W / 2 - R), Math.round(H / 2 - R), Math.round(R * 2), Math.round(R * 2)).data;
    let ink = 0, n = 0;
    for (let j = 0; j < R * 2; j++) for (let i = 0; i < R * 2; i++) { if (Math.hypot(i - R, j - R) > R) continue; n++; if (d[(j * Math.round(R * 2) + i) * 4 + 3] > 20) ink++; }
    return cv.style.display === 'none' ? 0 : ink / n;
  });
  let worst = 0;
  for (let round = 0; round < 6; round++) {
    await page.evaluate((round) => {
      const g = window.__game, me = g.playerSoldier, sp = g.hud.sp, foe = g.soldiers.find((s) => s !== me);
      me.protT = 99; me.hp = me.maxHp;
      for (let i = 0; i < 6; i++) {                                            // 6 yön: önden, arkadan, sağdan, soldan, çaprazlar
        const a = me.yaw + (i / 6) * Math.PI * 2 + round * 0.37;
        const by = { pos: { x: me.pos.x - Math.sin(a) * 15, z: me.pos.z - Math.cos(a) * 15 } };
        sp.hit(by, i % 2 ? 'head' : (round % 2 ? 'legs' : 'body'), (round + i) % 6);
      }
      sp.update(0.12);
    }, round);
    worst = Math.max(worst, await centerInk());
  }
  await page.screenshot({ path: `${OUT}/${dv}-hayatta.png` });
  check(worst <= 0.01, `${dv}: hayattayken 36 isabetten sonra ortadaki nişan alanında boya %${(worst * 100).toFixed(1)} (≤ %1)`);
  // yalnız kafa isabetleri, önden
  await page.evaluate(() => { const sp = window.__game.hud.sp; sp.clear(); const me = window.__game.playerSoldier; for (let i = 0; i < 8; i++) sp.hit({ pos: { x: me.pos.x - Math.sin(me.yaw) * 10, z: me.pos.z - Math.cos(me.yaw) * 10 } }, 'head', i % 6); sp.update(0.12); });
  const headInk = await centerInk();
  await page.screenshot({ path: `${OUT}/${dv}-kafa-onden.png` });
  check(headInk <= 0.01, `${dv}: önden 8 kafa isabeti sonrası ortada boya %${(headInk * 100).toFixed(1)}`);
  // elenme: orta boyanır
  await page.evaluate(() => { const sp = window.__game.hud.sp; sp.clear(); sp.death(2); sp.update(0.12); });
  const deathInk = await centerInk();
  await page.screenshot({ path: `${OUT}/${dv}-elendi.png` });
  check(deathInk > 0.5, `${dv}: elenince ortada boya %${(deathInk * 100).toFixed(0)} (> %50)`);
  check(!errs.length, `${dv}: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await page.close();
}
await browser.close();
console.log(fails ? `sonuç: HATA (${fails})` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
