// ACOG nişanı kullanıcının durumunda (12.163): duvara yakın (sağda ~1 m) + düşman 3 m ve 30 m, bel → nişan kare dizisi (adsT 0 / 0,25 / 0,5 / 0,75 / 1).
//   node scripts/acogscene.mjs <çıktı klasörü> [taban url]   DEV=desk|mob  Q=acog=A (ek sorgu; önce = ×2)  TAG=ad (dosya öneki)  THIRD=1 (omuz üstü)  FOV=90  W=m4a1
// Kare adları: <TAG>-<dev>-<yüzde>.png ; her karede dünya büyütmesi + iki düşmanın ekran boyu (px, boy) konsola yazılır.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-acog3/scene', base = process.argv[3] || 'http://127.0.0.1:5180', dev = process.env.DEV || 'desk', tag = process.env.TAG || 'now';
const W = process.env.W || 'm4a1', FOV = +(process.env.FOV || 90);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const strip = (d) => { const { defaultBrowserType, ...r } = d; return r; };
const ctx = dev === 'desk' ? await browser.newContext({ viewport: { width: 1600, height: 900 } }) : await browser.newContext(strip(devices['Pixel 7 landscape']));
const page = await ctx.newPage(), errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?autostart=3v3&map=colgecidi&type=tdm&debug=1&dev=1&nolock=1&third=1${dev === 'mob' ? '&touch=1' : ''}${process.env.Q ? '&' + process.env.Q : ''}`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.player', null, { timeout: 120000 });
const info = await page.evaluate(({ W, FOV, third }) => {
  const g = window.__game, p = g.player, s = p.s, V = s.pos.constructor;
  g.brains.forEach((b) => (b.update = () => {}));
  const foes = g.soldiers.filter((o) => o !== s && o.team !== s.team).slice(0, 2);
  g.soldiers.filter((o) => o !== s && !foes.includes(o)).forEach((o) => { o.pos.y = -90; o.syncModel?.(0); });
  g.simulate = true; for (let i = 0; i < 30; i++) g.step(1 / 30); g.simulate = false;
  s.protT = 1e9; for (const f of foes) f.protT = 1e9;
  p.set.fov = FOV; p.third = third; p.thirdT = third ? 1 : 0; p._cs = null;
  // yer: ileri ≥ 34 m açık, sağda 0,8–1,4 m duvar (duvara yaslanmış bakış), haritanın ortasına yakın
  const eye = new V(), d = new V(), r = new V(); let best = null;
  for (let x = -70; x <= 70; x += 2) for (let z = -70; z <= 70; z += 2) {
    const y = g.world.heightAt(x, z); if (!(y > -5)) continue;
    for (let a = 0; a < 48; a++) {
      const yaw = (a / 48) * Math.PI * 2; eye.set(x, y + 1.6, z);
      d.set(-Math.sin(yaw), 0, -Math.cos(yaw)); r.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const hf = g.world.raycast(eye, d, 40, {}); if (hf && hf.t < 34) continue;
      const hr = g.world.raycast(eye, r, 3, {}); if (!hr || hr.t < 0.8 || hr.t > 1.4) continue;
      // düşmanların zemini düz olsun
      const p3 = [x + d.x * 3, z + d.z * 3], p30 = [x + d.x * 30, z + d.z * 30];
      if (Math.abs(g.world.heightAt(...p3) - y) > 0.3 || Math.abs(g.world.heightAt(...p30) - y) > 1.5) continue;
      const sc = Math.hypot(x, z) * 0.02 + a * 1e-4; if (!best || sc < best.sc) best = { x, z, y, yaw, sc, wall: hr.t };
    }
  }
  if (!best) return null;
  s.pos.set(best.x, best.y, best.z); s.yaw = best.yaw + 0.06; s.pitch = -0.02; s.vel.set(0, 0, 0);
  const fw = [-Math.sin(best.yaw), -Math.cos(best.yaw)], rt = [Math.cos(best.yaw), -Math.sin(best.yaw)];
  const put = (e, D, side) => { e.pos.set(best.x + fw[0] * D + rt[0] * side, 0, best.z + fw[1] * D + rt[1] * side); e.pos.y = g.world.heightAt(e.pos.x, e.pos.z); e.yaw = best.yaw + Math.PI; e.vel?.set(0, 0, 0); e.syncModel?.(0); };
  put(foes[0], 3, -0.55); put(foes[1], 30, -1.6);
  window.__foes = foes;
  s.cur = 0; s.items[0] = { id: W, mag: 30, reserve: 90 }; s.optic = 'acog'; if (s.model) s.model.optic = 'acog';
  p.refreshWeapon();
  const hudEls = [...document.body.children].filter((e) => e !== g.canvas && !e.contains(g.canvas));
  const T = (q) => Math.tan((q * Math.PI) / 360);
  window.__shot = (t) => {
    for (const e of hudEls) e.style.visibility = 'hidden';
    const h = document.getElementById('hud'); if (h) { h.style.visibility = 'visible'; for (const c of h.querySelectorAll(':scope > *')) c.style.visibility = /^(rdot|holo|scope|idot|cross|scopeblk|advig)$/.test(c.id) ? 'visible' : 'hidden'; }
    const vm = p.vm; vm.noSway = true; vm.raise = 0; vm.kick = 0; vm.kickR = 0; vm.bobT = 0; vm.sprintT = 0; vm.breathT = 0; vm.sx = 0; vm.sy = 0;
    s.reloadT = 0; s.cd = 0; s.vel.set(0, 0, 0); s.recoilP = 0; s.leanT = 0; s.ads = t > 0.5;
    for (let i = 0; i < 60; i++) { s.adsT = t; p.update(1 / 60); for (const f of foes) f.syncModel?.(1 / 60); }
    for (let i = 0; i < 20; i++) g.hud.update(1 / 60);
    const cam = g.camera; cam.updateMatrixWorld(true);
    const H = innerHeight, sz = foes.map((f) => { const a = new V(f.pos.x, f.pos.y, f.pos.z).project(cam), b = new V(f.pos.x, f.pos.y + 1.8, f.pos.z).project(cam); return +(Math.abs(a.y - b.y) * H / 2).toFixed(1); });
    return { mag: +(T(p.baseFov()) / T(cam.fov)).toFixed(3), foePx: sz, camZ: cam.position.toArray().map((v) => +v.toFixed(3)) };
  };
  return { best, wall: best.wall };
}, { W, FOV, third: !!process.env.THIRD });
console.log('yer', JSON.stringify(info));
if (!info) { await browser.close(); process.exit(1); }
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  const r = await page.evaluate((q) => window.__shot(q), t);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${tag}-${dev}-${Math.round(t * 100)}.png` });
  console.log(`${tag} ${dev} adsT ${t}: dünya ×${r.mag} · düşman 3 m ${r.foePx[0]} px, 30 m ${r.foePx[1]} px (oran ${(r.foePx[0] / r.foePx[1]).toFixed(2)}) · kamera ${r.camZ.join(', ')}`);
}
console.log('sayfa hatası:', errs.length, errs.slice(0, 3));
await browser.close();
