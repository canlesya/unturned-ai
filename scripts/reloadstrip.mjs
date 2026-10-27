// 12.195 Yükleme kare şeridi (gerçek GPU, Metal): her silah × boş / taktik yükleme, reload süresi boyunca sırayla 1/60 sn adımlarla oynatılır,
// N eşit aralıklı anda ekran görüntüsü alınır (düşen şarjör vb. gerçek akışla). Çıktı: <klasör>/<silah>-<E|T>-<i>.png + meta.json
//   node scripts/reloadstrip.mjs <çıktı> [taban url] [silah regex]      N=10 · LEFT=1 (sol el) · ADS=1 (nişandan yükleme) · GPU=0 → swiftshader
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-qa12/after', base = process.argv[3] || 'http://127.0.0.1:5202', only = process.argv[4] ? new RegExp(process.argv[4]) : null;
const N = +(process.env.N || 10), GPU = process.env.GPU !== '0';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
const ids = await page.evaluate(async (L) => {
  const g = window.__game, p = g.player, s = p.s;
  g.brains.forEach((b) => (b.update = () => {}));
  g.soldiers.filter((o) => o !== s).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
  for (const e of document.body.children) if (e !== g.canvas && !e.contains(g.canvas)) e.style.visibility = 'hidden';
  g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
  s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.vel.set(0, 0, 0);
  s.yaw = 0.6; s.pitch = 0.05; s.protT = 0;
  g.leftHand = !!L;
  const { WSTATS } = await import('/src/game/stats.js');
  return Object.entries(WSTATS).filter(([, v]) => v.kind === 'gun' || v.kind === 'launcher').map(([k, v]) => [k, v.mag, v.reloadStyle || 'mag', !!v.ball, !!v.space]);
}, !!process.env.LEFT);
const meta = [];
for (const [id, cap, style, ball, space] of ids) {
  if (only && !only.test(id)) continue;
  const cases = cap <= 1 ? [true] : [true, false];
  for (const empty of cases) {
    const info = await page.evaluate(({ id, empty, ball, ads }) => {
      const g = window.__game, p = g.player, s = p.s, vm = p.vm;
      g.mode.paintball = ball;
      const slot = 0; s.cur = slot; s.items[slot] = { id, mag: empty ? 0 : 3, reserve: 300 };
      p.refreshWeapon();
      const S = s.stat;
      vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.hitKick = 0; vm.inspectT = 0; vm.bobT = 0; vm.sprintT = 0; vm.noSway = true;
      s.swing = null; s.reloadT = 0; s.adsT = ads ? 1 : 0; s.ads = !!ads; s.cd = 0; s.vel.set(0, 0, 0); s.sprinting = false; s.useT = 0;
      for (let i = 0; i < 30; i++) vm.update(1 / 60, p);
      s.reloadStyle = S.reloadStyle || 'mag'; s.reloadEmpty = empty;
      const shell = s.reloadStyle === 'shell';
      s.shellT = shell ? S.shell * 0.8 : 0;
      s.reloadTotal = shell ? S.shell * 0.8 + 3 * S.shell : S.reload * (empty ? 1 : 0.65);
      window.__rl = { t: 0, tot: s.reloadTotal };
      return { total: s.reloadTotal };
    }, { id, empty, ball, ads: !!process.env.ADS });
    const tag = `${id}-${empty ? 'E' : 'T'}`;
    for (let i = 0; i < N; i++) {
      const tk = (i / (N - 1)) * info.total;
      await page.evaluate((tk) => {
        const g = window.__game, p = g.player, s = p.s, vm = p.vm, R = window.__rl;
        while (R.t < tk - 1e-6) {
          const d = Math.min(1 / 60, tk - R.t); R.t += d;
          s.reloadT = Math.max(0, R.tot - R.t); if (s.reloadT <= 0) s.reloadT = 1e-4;
          if (s.adsT > 0) s.adsT = Math.max(0, s.adsT - d * 6);
          vm.update(d, p);
        }
      }, tk);
      await page.waitForTimeout(60);
      await page.screenshot({ path: `${out}/${tag}-${i}.png` });
    }
    meta.push({ id, tag, empty, total: info.total, style });
    process.stdout.write(tag + ' ');
  }
}
const old = existsSync(`${out}/meta.json`) ? JSON.parse(readFileSync(`${out}/meta.json`, 'utf8')).meta : [];      // aynı klasöre parça parça çekim: birleştir
const all = [...old.filter((m) => !meta.some((x) => x.tag === m.tag)), ...meta];
writeFileSync(`${out}/meta.json`, JSON.stringify({ N, meta: all }, null, 1));
console.log('\nhata:', errs.length, errs.slice(0, 5));
await browser.close();
