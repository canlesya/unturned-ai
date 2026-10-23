// S3 silah başarımı (gerçek GPU): birinci şahıs silah sahnesi (çizim çağrısı / üçgen / GPU ms) + 20 asker kalabalığı (3. şahıs LOD silahlar), önce / sonra karşılaştırması için.
//   node scripts/s3perf.mjs [taban url]   → JSON stdout.  GPU ms = çizim + readPixels eşitlemesi ortalaması (Mac GPU; telefon öykünmesi DEĞİL)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5281';
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=10v10&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=0`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
const res = await page.evaluate(async () => {
  const g = window.__game, p = g.player, s = p.s, r = g.renderer, gl = r.getContext(), px = new Uint8Array(4);
  g.brains.forEach((b) => (b.update = () => {})); g.simulate = false; if (g.post) g.post.on = false;
  s.pos.set(-36.5, 0, 47.5); s.pos.y = g.world.heightAt(s.pos.x, s.pos.z); s.yaw = 0.6; s.pitch = -0.05;
  const meas = (fn, n = 60) => { r.info.autoReset = false; r.info.reset(); fn(); const calls = r.info.render.calls, tris = r.info.render.triangles; r.info.autoReset = true; for (let i = 0; i < 5; i++) fn(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t0 = performance.now(); for (let i = 0; i < n; i++) { fn(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return { calls, tris, ms: +((performance.now() - t0) / n).toFixed(3) }; };
  const out = { fp: {}, crowd: {} };
  for (const [id, optic, slot] of [['m4a1', 'holo', 0], ['ak47', 'reddot', 0], ['m4a1', 'acog', 0], ['pistol', 'iron', 1], ['sniper', 'scope', 0], ['shotgun', 'iron', 0], ['mp5', 'holo', 0]]) {
    s.cur = slot; s.items[slot] = { id, mag: 30, reserve: 90 }; s.optic = optic; p.refreshWeapon(); p.vm.raise = 0; for (let i = 0; i < 10; i++) p.update(1 / 60);
    out.fp[`${id}:${optic}`] = meas(() => { r.clear(); p.vm.render(r, innerWidth, innerHeight); }, 120);
  }
  // 20 asker (her biri ana silahıyla), oyuncunun önünde 4 sıra
  const ws = ['ak47', 'm4a1', 'shotgun', 'sniper', 'mp5'];
  const others = g.soldiers.filter((o) => o !== s).slice(0, 19); out.crowd.soldiers = others.length;
  others.forEach((o, i) => { const w = ws[i % 5]; o.alive = true; o.items[0] = { id: w, mag: 30, reserve: 90 }; o.cur = 0; o.optic = 'holo'; if (o.skins !== undefined) o.skins = { [w]: ['std', 'desert', 'wood', 'urban', 'gold'][i % 5] };
    o.pos.set(s.pos.x - Math.sin(s.yaw) * (4 + Math.floor(i / 5) * 2.2) + Math.cos(s.yaw) * ((i % 5) - 2) * 1.5, s.pos.y, s.pos.z - Math.cos(s.yaw) * (4 + Math.floor(i / 5) * 2.2) - Math.sin(s.yaw) * ((i % 5) - 2) * 1.5); o.yaw = s.yaw + 2.4; o.model.root.visible = true; o._syncWeaponModel(true); o.syncModel(0.016); });
  let wt = 0, wc = 0; for (const o of others) o.model.weapon?.traverse((m) => { if (m.isMesh) { wc++; const gg = m.geometry; wt += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
  out.crowd.weaponTris = Math.round(wt); out.crowd.weaponCalls = wc;
  out.crowd.frame = meas(() => g.render(), 80);
  for (const o of others) if (o.model.weapon) o.model.weapon.visible = false;
  out.crowd.noWeapons = meas(() => g.render(), 80);
  return out;
});
console.log(JSON.stringify(res, null, 1));
console.log('hata:', errs.length, errs.slice(0, 3));
await browser.close();
