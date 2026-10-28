// 12.220 gün batımı bakışları + düşman silueti okunurluğu:  URL=http://127.0.0.1:5208 OUT=/tmp/wb-sunset/once MAP=kuzey node scripts/sunsetshot.mjs
// Gerçek GPU (Metal, headless:false). Bakışlar güneş yönünden türetilir (her haritada aynı mantık): güneşe doğru / sırt / yan, yüksekten, doğuştan.
// 'oku-*' bakışlarında 22 m önde bir kırmızı asker durur; aynı kare askersiz de çekilir → fark maskesi = siluet; siluet ile çevresi arasındaki
// parlaklık farkı (Weber kontrastı) report.json'a yazılır. TOD=sunset|day|night WEATHER=clear|rain|fog, MOBILE=1 Pixel 7 yatay (touch), PR=2 (Yüksek + son işleme).
// HOUR=sayı: Kuzey'de saati sabitler (verilmezse maç başı saati = KZ_CYCLE[tod][0]). ONLY=ad1,ad2 yalnız bu bakışlar.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5208', OUT = process.env.OUT || '/tmp/wb-sunset/x', MAP = process.env.MAP || 'kuzey';
const TOD = process.env.TOD || 'sunset', WEATHER = process.env.WEATHER || 'clear', mobile = !!process.env.MOBILE, PR = process.env.PR || (mobile ? '1' : '2');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext(mobile
  ? { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', locale: 'tr-TR' }
  : { viewport: { width: 1280, height: 720 }, locale: 'tr-TR' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${URL0}/?autostart=4v4&map=${MAP}&type=${process.env.TYPE || 'conquest'}&debug=1&nolock=1&tod=${TOD}&weather=${WEATHER}&pr=${PR}${mobile ? '&touch=1' : ''}`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.waitForTimeout(2000);
await page.evaluate((hour) => {
  const g = window.__game;
  const foe = g.soldiers.find((s) => s.team !== g.playerSoldier.team);
  for (const s of g.soldiers) if (s !== g.playerSoldier) { s.brain = null; s.alive = s === foe; s.respawnT = 1e9; if (s.model) s.model.root.visible = false; }
  g.brains.length = 0; g.timeLeft = g.mode?.time || 900; if (g.playerSoldier.model) g.playerSoldier.model.root.visible = false;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  if (hour !== null && g.map.fx?.setHour) { g.map.fx.setHour(hour, g); const sh = g.map.fx.setHour; g.map.fx.setHour = () => {}; g.map.fx._sh = sh; }
  window.__foe = foe;
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () {
    if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); }
    const F = window.__foe, fp = window.__foePos;
    if (F && F.model) { if (fp) { F.pos.set(...fp); F.vel?.set(0, 0, 0); F.model.root.position.set(...fp); F.model.root.rotation.y = window.__foeRy || 0; } F.model.root.visible = !!fp; }
    orig.call(this);
  };
}, process.env.HOUR ? +process.env.HOUR : null);
// bakışlar: güneş yönünden
const base = await page.evaluate(() => {
  const g = window.__game, s = g.sunOff.clone().normalize(), o = g.map.objectives || [], sp = g.map.spawns.blue[0];
  const H = (x, z) => g.world.heightAt(x, z);
  const c = o.find((q) => q.label === 'C') || o[Math.floor(o.length / 2)] || { x: 0, z: 0 };
  return { s: [s.x, s.y, s.z], c: [c.x + 7, c.z + 7],      // bayrak direğinin altından değil, 10 m yanından
    sp: [sp.x, sp.z], hour: g.map.fx?.hour ?? null, alt: Math.asin(s.y) * 180 / Math.PI, map: g.map.id };
});
// yatay güneş yönü; Kuzey'de sabit (maç başı saati değişse de önce / sonra aynı bakış noktaları: 18:12 güneşinin yönü)
const [sx, , sz] = MAP === 'kuzey' && !process.env.FREE ? [-0.978, 0, 0.206] : base.s, L = Math.hypot(sx, sz), ux = sx / L, uz = sz / L;
const KZ = MAP === 'kuzey';
const VIEWS = [
  ['1-gunese', base.c, [ux, uz], 0.04, 1.7, 70],
  ['2-sirt', base.c, [-ux, -uz], 0.02, 1.7, 70],
  ['3-yan', base.c, [-uz, ux], 0.02, 1.7, 70],
  ['4-yuksek-gunese', base.c, [ux, uz], -0.22, KZ ? 90 : 40, 66],
  ['5-yuksek-sirt', base.c, [-ux, -uz], -0.22, KZ ? 90 : 40, 66],
  ['6-dogus', base.sp, [ux, uz], 0.03, 1.7, 70],
  ['oku-gunese', base.c, [ux, uz], 0.0, 1.7, 60, true],
  ['oku-sirt', base.c, [-ux, -uz], 0.0, 1.7, 60, true],
];
if (KZ) VIEWS.push(['7-kz-vadi-dag', [130, 640], [-0.27, -0.96], -0.09, 60, 60], ['8-kz-radar', [-490, 185], [-0.7, -0.65], -0.12, 28, 64]);
const rep = { base, views: {}, errs };
for (const [n, at, dir, pitch, hgt, fov, foe] of VIEWS) {
  if (ONLY && !ONLY.some((w) => n.startsWith(w))) continue;
  const info = await page.evaluate(([at0, dir, pitch, hgt, fov, foe]) => {
    const g = window.__game, V = g.camera.position.constructor;
    // siluet bakışı: önü (22 m) açık bir yer ara (duvar / ev arkasında kalmasın): c'nin yanında 8 m aralıklı adaylar
    let at = at0;
    if (foe) for (let k = 0; k < 40; k++) {
      const o = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 8, a = [at0[0] - dir[1] * o, at0[1] + dir[0] * o], ey = g.world.heightAt(a[0], a[1]) + 1.7;
      const fx = a[0] + dir[0] * 22, fz = a[1] + dir[1] * 22, fy = g.world.heightAt(fx, fz);
      if (g.world.clear(new V(a[0], ey, a[1]), new V(fx, fy + 1.6, fz)) && g.world.clear(new V(a[0], ey, a[1]), new V(fx, fy + 0.4, fz)) && Math.abs(fy + 1.7 - ey) < 1.5) { at = a; break; }
    }
    const gy = g.world.heightAt(at[0], at[1]);
    const p = [at[0], gy + hgt, at[1]], t = [p[0] + dir[0] * 100, p[1] + pitch * 100, p[2] + dir[1] * 100];
    g.playerSoldier.pos.set(at[0], gy, at[1]); g.playerSoldier.fly = true; g._cam = [p, t, fov];
    // düşman: 22 m önde, kameraya dönük
    const fx = at[0] + dir[0] * 22, fz = at[1] + dir[1] * 22;
    window.__foeAt = [fx, g.world.heightAt(fx, fz), fz]; window.__foeRy = Math.atan2(-dir[0], -dir[1]);
    window.__foePos = null;
    return { gy, at };
  }, [at, dir, pitch, hgt, fov, !!foe]);
  await page.waitForTimeout(1500);
  const file = `${OUT}/${base.map}-${n}${mobile ? '-pixel7' : ''}${WEATHER !== 'clear' ? '-' + WEATHER : ''}${TOD !== 'sunset' ? '-' + TOD : ''}.png`;
  if (foe) {
    await page.screenshot({ path: file.replace('.png', '-bos.png') });
    await page.evaluate(() => { window.__foePos = window.__foeAt; });
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: file });
  if (process.env.PERF) rep.views[n] = { ...info, ms: await page.evaluate(() => {          // GPU'ya bağlı kare süresi: 40 çizim + glFinish (vsync'ten bağımsız)
    const g = window.__game, gl = g.renderer.getContext(), px = new Uint8Array(4), one = () => { g.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    for (let i = 0; i < 8; i++) one();
    const t = performance.now(); for (let i = 0; i < 40; i++) one(); return +((performance.now() - t) / 40).toFixed(2);
  }) };
  if (foe) await page.evaluate(() => { window.__foePos = null; });
  rep.views[n] = { file, ...info, ...rep.views[n] };
}
rep.after = await page.evaluate(() => {
  const g = window.__game, U = g.env?.dome?.material.uniforms, f = g.scene.fog, hx = (c) => '#' + c.getHexString();
  return { hour: g.map.fx?.hour ?? null, sun: g.sun && [hx(g.sun.color), +g.sun.intensity.toFixed(2)], fog: f && [hx(f.color), f.density ?? [f.near, f.far]], sky: U && [hx(U.top.value), hx(U.mid.value), hx(U.hor.value)], exp: g.renderer.toneMappingExposure, post: !!g.post?.on };
});
fs.writeFileSync(`${OUT}/report-${base.map}${mobile ? '-pixel7' : ''}-${TOD}-${WEATHER}.json`, JSON.stringify(rep, null, 1));
console.log(JSON.stringify({ base, after: rep.after, errs }));
await browser.close();
