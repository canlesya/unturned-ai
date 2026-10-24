// Paintball topu görünürlüğü (12.142): atıştan sonra 0 / 50 / 100 / 200 / 400 ms kare dizisi + her karede topun ekrandaki yeri / boyu.
// Çevrimdışı (zaman elle yürür, kare kesin): (1) kendi atışım birinci şahıs, (2) yandan geçen bot topu (3. şahıs görünüş), (3) bana doğru gelen top.
// Ölçülür: top ekranda mı, namlu ucundan mı çıkıyor (silah kamerasındaki namlu ucunun ekran noktasına uzaklığı), çapı kaç piksel, silah modelinin arkasında mı.
//   node scripts/pbball.mjs [url=http://127.0.0.1:5180]   env: DEV=desktop,pixel7  TAG=once|sonra  → /tmp/wb-pball/<TAG>-<dev>-<sahne>-<ms>.png
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5180', OUT = '/tmp/wb-pball', TAG = process.env.TAG || 'sonra';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${msg}`); if (!ok) fails++; };
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const DEVS = { desktop: { viewport: { width: 1280, height: 720 } }, pixel7: strip(devices['Pixel 7 landscape']) };
const TIMES = [0, 50, 100, 200, 400];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const summary = {};
for (const dv of (process.env.DEV || 'desktop,pixel7').split(',')) {
  const mob = dv !== 'desktop';
  const page = await browser.newPage(DEVS[dv]);
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=5v5&map=boyakulesi&type=pb&debug=1&nolock=1&tod=day&touch=${mob ? 1 : 0}`);
  await page.waitForFunction(() => window.__game?.running && window.__game.playerSoldier?.alive, null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const g = window.__game, me = g.playerSoldier, V = me.pos.constructor;
    g.simulate = false; g.brains.forEach((b) => (b.update = () => {})); g.devGod = true;
    window.__adv = (ms) => { const n = Math.round(ms / (1000 / 60)); for (let i = 0; i < n; i++) g.step(1 / 60); };
    // açık alan: P'den -z yönünde 24 m, yanlarda 10 m boş
    const free = (a, b) => g.world.clear(a, b);
    let best = null;
    let seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);   // aynı yer (önce / sonra karşılaştırması)
    for (let k = 0; k < 6000 && !best; k++) {
      const x = -45 + rnd() * 90, z = -45 + rnd() * 90;
      if (!g.nav.isFree(x, z) || !g.nav.isFree(x, z - 20) || !g.nav.isFree(x - 8, z - 10) || !g.nav.isFree(x + 10, z - 10)) continue;
      const y = g.world.heightAt(x, z); if (Math.abs(g.world.heightAt(x, z - 20) - y) > 0.3 || Math.abs(g.world.heightAt(x - 8, z - 10) - y) > 0.3 || Math.abs(g.world.heightAt(x + 10, z - 10) - y) > 0.3) continue;
      const e = new V(x, y + 1.5, z);
      if (!free(e, new V(x, y + 1.5, z - 22)) || !free(new V(x - 8, y + 1.5, z - 10), new V(x + 10, y + 1.5, z - 10)) || !free(e, new V(x - 8, y + 1.5, z - 10))) continue;
      best = { x, y, z };
    }
    window.__spot = best;
    for (const s of g.soldiers) if (s !== me) { s.alive = false; s.vacant = true; s.pos.x += 900; s.model.root.visible = false; }
    const others = g.soldiers.filter((s) => s !== me);
    window.__put = (i, x, z, yaw) => { const b = others[i]; b.vacant = false; b.spawn({ x, z, ry: 0 }, 0); b.pos.y = g.world.heightAt(x, z); b.yaw = yaw; b.pitch = 0; b.protT = 0; b.hp = 1e6; b.model.root.visible = true; return b; };
    me.pos.set(best.x, best.y, best.z); me.yaw = 0; me.pitch = 0; me.vel.set(0, 0, 0); me.hp = 1e6;
    // topların ekran ölçümü: çizilen örneklerin (paint.balls) dünya konumu + yarıçapı → ekran pikseli; birinci şahısta silah kamerasındaki namlu ucu
    window.__probe = () => {
      const bm = g.paint.balls, cam = g.camera, M = new cam.matrixWorld.constructor(), P = new V(), Q = new cam.quaternion.constructor(), S = new V(), out = [];
      const W = innerWidth, H = innerHeight, f = H / 2 / Math.tan((cam.fov * Math.PI) / 360);
      for (let i = 0; i < bm.count; i++) {
        bm.getMatrixAt(i, M); M.decompose(P, Q, S);
        const d = P.distanceTo(cam.position), c = P.clone().project(cam);
        out.push({ x: Math.round((c.x + 1) / 2 * W), y: Math.round((1 - c.y) / 2 * H), front: c.z < 1, dpx: +(2 * S.x / d * f).toFixed(1), d: +d.toFixed(2) });
      }
      let mz = null;
      const vm = g.player.vm, w = vm.model?.children?.[0];
      if (w?.userData?.muzzle && !g.showSelf) { w.updateWorldMatrix(true, false); const m = w.userData.muzzle.clone().applyMatrix4(w.matrixWorld).project(vm.cam); mz = { x: Math.round((m.x + 1) / 2 * W), y: Math.round((1 - m.y) / 2 * H) }; }
      return { balls: out, mz, live: g.paint.live.length, splats: g.paint.splatN, hits: g.paint.stats.hits };
    };
  });
  const spot = await page.evaluate(() => window.__spot);
  check(!!spot, `${dv}: açık atış yeri`);
  const scene = async (name, setup, fire) => {
    await page.evaluate(setup);
    await page.evaluate(() => { __adv(400); window.__game.render(); });
    const rows = [];
    await page.evaluate(`{ const R = Math.random; Math.random = () => 0; try { (${fire})(); } finally { Math.random = R; } }`);     // saçılımsız: tam nişan yönü (önce / sonra aynı yol)
    let t = 0;
    for (const T of TIMES) {
      await page.evaluate((ms) => { __adv(ms); window.__game.render(); }, T - t); t = T;
      await page.waitForTimeout(120);
      await page.evaluate(() => window.__game.render());
      await page.screenshot({ path: `${OUT}/${TAG}-${dv}-${name}-${String(T).padStart(3, '0')}.png` });
      const pr = await page.evaluate(() => __probe());
      rows.push({ T, ...pr });
      const b = pr.balls[0];
      console.log(`  ${dv} ${name} ${String(T).padStart(3)} ms: ${b ? `top (${b.x},${b.y}) çap ${b.dpx}px uzak ${b.d}m${b.front ? '' : ' KAMERA ARKASI'}` : 'top yok'}${pr.mz ? ` · namlu ucu (${pr.mz.x},${pr.mz.y})` : ''} · leke ${pr.splats} isabet ${pr.hits}`);
    }
    return rows;
  };
  // 1) kendi atışım (birinci şahıs): 20 m öndeki hedefe
  const own = await scene('1-kendi', () => {
    const g = window.__game, me = g.playerSoldier, sp = window.__spot;
    me.pos.set(sp.x, sp.y, sp.z); me.yaw = 0; me.pitch = 0.012; me.ads = false;
    __put(0, sp.x, sp.z - 20, Math.PI);
  }, () => { const me = window.__game.playerSoldier; me.cd = 0; me.bloom = 0; me.tryFire(); });
  // 2) yandan geçen top: bot soldan sağdaki hedefe sıkar (ben -z'ye bakıyorum, top 10 m önümden geçer)
  const side = await scene('2-yandan', () => {
    const g = window.__game, me = g.playerSoldier, sp = window.__spot;
    me.yaw = 0; me.pitch = 0;
    for (const s of g.soldiers) if (s !== me) { s.alive = false; s.model.root.visible = false; }
    __put(1, sp.x - 8, sp.z - 10, -Math.PI / 2); __put(2, sp.x + 10, sp.z - 10, Math.PI / 2);
  }, () => { const g = window.__game, s = g.soldiers.filter((x) => x !== g.playerSoldier)[1]; s.yaw = -Math.PI / 2; s.pitch = 0.01; s.cd = 0; s.bloom = 0; s.botExtraSpread = 0; s.tryFire(); });
  // 3) bana doğru gelen top: 20 m öndeki bot bana sıkar
  const inc = await scene('3-gelen', () => {
    const g = window.__game, me = g.playerSoldier, sp = window.__spot;
    me.yaw = 0; me.pitch = 0; g.devGod = true;
    for (const s of g.soldiers) if (s !== me) { s.alive = false; s.model.root.visible = false; }
    __put(3, sp.x - 1.2, sp.z - 20, 0);
  }, () => { const g = window.__game, me = g.playerSoldier, s = g.soldiers.filter((x) => x !== me)[3]; const e = me.eye(new me.pos.constructor()), o = s.eye(new me.pos.constructor()); s.yaw = Math.atan2(-(e.x - 0.6 - o.x), -(e.z - o.z)); s.pitch = 0.02; s.cd = 0; s.bloom = 0; s.botExtraSpread = 0; s.tryFire(); });
  // 4) kendi tabanca atışım (birinci şahıs, nişanda): namlu ucu tabancada başka yerde
  const pis = await scene('4-tabanca', () => {
    const g = window.__game, me = g.playerSoldier, sp = window.__spot;
    me.yaw = 0; me.pitch = 0.014; me.cur = 1; me.switchT = 0; me.cd = 0; me.ads = true; g.player.refreshWeapon();
    for (const s of g.soldiers) if (s !== me) { s.alive = false; s.model.root.visible = false; }
    __put(0, sp.x, sp.z - 20, Math.PI);
  }, () => { const me = window.__game.playerSoldier; me.cd = 0; me.switchT = 0; me.bloom = 0; me.tryFire(); });
  summary[dv] = { own, side, inc, pis };
  // ölçütler: top 50 / 100 ms'de ekranda ve okunaklı (≥ 4 px), birinci şahısta 0 ms'de namlu ucuna yakın (≤ 6 % ekran yüksekliği)
  const H = DEVS[dv].viewport.height;
  const vis = (rows, T, px) => { const r = rows.find((x) => x.T === T), b = r?.balls[0]; return !!b && b.front && b.dpx >= px && b.x >= 0 && b.y >= 0; };
  const o0 = own.find((r) => r.T === 0), b0 = o0?.balls[0];
  check(!!b0 && !!o0.mz && Math.hypot(b0.x - o0.mz.x, b0.y - o0.mz.y) <= H * 0.06, `${dv}: kendi topum 0 ms'de silah modelinin namlu ucunda (${b0 && o0.mz ? Math.round(Math.hypot(b0.x - o0.mz.x, b0.y - o0.mz.y)) : '-'} px)`);
  check(vis(own, 50, 4) && vis(own, 100, 4), `${dv}: kendi topum 50 / 100 ms'de görünür (çap ${own.find((r) => r.T === 50)?.balls[0]?.dpx} / ${own.find((r) => r.T === 100)?.balls[0]?.dpx} px)`);
  check(vis(side, 50, 4) && vis(side, 100, 4), `${dv}: yandan geçen bot topu görünür (çap ${side.find((r) => r.T === 100)?.balls[0]?.dpx} px)`);
  check(vis(inc, 50, 4) && vis(inc, 100, 4), `${dv}: bana gelen top görünür (çap ${inc.find((r) => r.T === 50)?.balls[0]?.dpx} / ${inc.find((r) => r.T === 100)?.balls[0]?.dpx} px)`);
  const p0 = pis.find((r) => r.T === 0), q0 = p0?.balls[0];
  check(!!q0 && !!p0.mz && Math.hypot(q0.x - p0.mz.x, q0.y - p0.mz.y) <= H * 0.06 && vis(pis, 50, 4), `${dv}: tabanca topu (nişanda) namlu ucundan çıkıp görünüyor (${q0 && p0.mz ? Math.round(Math.hypot(q0.x - p0.mz.x, q0.y - p0.mz.y)) : '-'} px)`);
  check(own.at(-1).hits + own.at(-1).splats > 0, `${dv}: kendi topum bir yere çarptı (isabet / leke)`);
  check(errs.length === 0, `${dv}: sayfa hatası yok ${errs.slice(0, 2).join(' | ')}`);
  await page.close();
}
fs.writeFileSync(`${OUT}/${TAG}-olcum.json`, JSON.stringify(summary, null, 1));
await browser.close();
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK'); process.exit(fails ? 1 : 0);
