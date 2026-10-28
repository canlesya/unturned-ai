// 12.210 önbellekten gelen birinci şahıs modeli = baştan kurulan model mi? (gerçek GPU, Metal)
// Her silah için: yükleme ortasında (şarjör elde / fişek elde / sürgü geride) silah değiştir, geri dön → 40 kare bekle → görünür ağ dökümü + ekran görüntüsü;
// sonra önbelleği boşaltıp aynı silahı baştan kur → aynı döküm + görüntü. İkisi aynı olmalı (artık parça, gizli el, açık şarjör kalmamalı).
//   node scripts/swapcheck.mjs <çıktı klasörü> [taban url]     DEV=desk|mob
import { chromium, devices } from 'playwright';
import fs from 'fs';
const out = process.argv[2] || '/tmp/wb-swap/check', base = process.argv[3] || 'http://127.0.0.1:5297', DEV = process.env.DEV || 'desk';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const { defaultBrowserType, ...px } = devices['Pixel 7 landscape'];
const ctx = await browser.newContext(DEV === 'mob' ? px : { viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=1v1&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0${DEV === 'mob' ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {})); g.devGod = true;
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; });
  for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';
  s.fly = false; s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0); s.yaw = 0.6; s.pitch = 0.05;
  g.simulate = false;
  const dump = () => { const vm = p.vm, L = []; vm.root.traverseVisible((o) => { if (o.isMesh) L.push((o.geometry.index?.count ?? o.geometry.attributes.position.count) + '@' + o.position.toArray().map((v) => v.toFixed(3)).join(',')); }); return L.sort().join(';'); };
  const steps = (n) => { for (let i = 0; i < n; i++) g.step(1 / 60); };
  window.__case = (id, slot, frac, other) => {
    s.items[slot] = { id, mag: 0, reserve: 90 }; s.cur = slot; p.refreshWeapon(); steps(30);
    s.startReload(); const tot = s.reloadTotal; steps(Math.round(tot * frac * 60));      // yükleme ortası
    const mid = { ra: s.reloadT > 0, items: Object.keys(p.vm._rlItems || {}) };
    s.switchTo(other); steps(40); s.switchTo(slot); steps(50);                           // başka silaha geç → geri dön (önbellekten)
    s.items[slot].mag = 5; s.reloadT = 0;
    steps(20);
    return { mid, d: dump() };
  };
  window.__fresh = (slot) => { p.vm._cache?.clear(); s.cur = slot; p.refreshWeapon(); steps(70); return dump(); };
});
const cases = [['m4a1', 0, 0.45, 3], ['revolver', 1, 0.6, 3], ['shotgun', 0, 0.5, 1], ['m79', 0, 0.5, 1], ['pistol', 1, 0.5, 0], ['sniper', 0, 0.6, 1]];
const rep = [];
for (const [id, slot, frac, other] of cases) {
  const a = await page.evaluate(([id, slot, frac, other]) => window.__case(id, slot, frac, other), [id, slot, frac, other]);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${DEV}-${id}-onbellek.png` });
  const b = await page.evaluate((slot) => window.__fresh(slot), slot);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${DEV}-${id}-yeni.png` });
  const same = a.d === b;
  rep.push({ id, mid: a.mid, same });
  console.log(id.padEnd(10), 'yükleme ortası', JSON.stringify(a.mid), '→ önbellek = yeni kurulum:', same ? 'AYNI' : 'FARKLI');
  if (!same) console.log('  önbellek:', a.d.slice(0, 400), '\n  yeni   :', b.slice(0, 400));
}
console.log('hata:', errs.length, errs.slice(0, 3));
fs.writeFileSync(`${out}/${DEV}-check.json`, JSON.stringify({ rep, errs }, null, 1));
await browser.close();
if (rep.some((r) => !r.same) || errs.length) process.exit(1);
