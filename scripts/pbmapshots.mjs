// Boya Kulesi ekran görüntüleri (masaüstü 1280×720 + Pixel 7 yatay dokunmatik): havadan, dört kale, köprüden kuyuya bakış, kule tepesi, balkon yolu,
// zemin siperleri, minderden fırlarken havada, kule içi merdiven. Çıktı: /tmp/wb-pbmap-shots/*.png (depoya girmez). Yerel vite (BASE) çalışırken.
//   node scripts/pbmapshots.mjs            BASE=http://127.0.0.1:5193   ONLY=desk|mob   THUMB=1 → public/img/boyakulesi.png (menü küçük resmi kaynağı)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const OUT = '/tmp/wb-pbmap-shots', BASE = process.env.BASE || 'http://127.0.0.1:5193';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const D = Math.PI / 4;
const VIEWS = (process.env.VIEW ? (v) => v.filter((q) => q[0].includes(process.env.VIEW)) : (v) => v)([                                                      // ad, [x, y(ayak), z], yaw, pitch
  ['01-havadan', [-33, 26, 33], -D, -0.5],
  ['02-turuncu-kale', [-22.8, 9, -19.6], -3 * D, -0.12],
  ['03-mor-kale', [21.5, 9, -21.5], 3 * D, -0.12],
  ['04-turkuaz-kale', [21.5, 9, 21.5], D, -0.12],
  ['05-mavi-kale', [-21.5, 9, 21.5], -D, -0.12],
  ['06-kopru-kuyu', [-12.5, 9, -2.9], -Math.PI / 2 + 0.25, -0.62],
  ['07-kule-tepe', [2.9, 18.4, 2.9], -3 * D, -0.7],
  ['08-zemin-siper', [0, 0, -22.5], Math.PI, 0.04],
  ['09-balkon-yolu', [5.0, 13.5, -5.4], 0, -0.38],
  ['10-kuyu-kenari', [0, 0, -12.6], Math.PI, -0.95],
  ['11-kule-ici', [-3.3, 9, 0], -Math.PI / 2, 0.42],
  ['12-dogu-iskele', [22.9, 9, 13], 0, -0.05],
]);
async function shoot(ctxOpts, tag, list, { hud = false, touch = false } = {}) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${BASE}/?autostart=8v8&map=boyakulesi&type=pb&debug=1&nolock=1&dev=1&shadows=1${touch ? '&touch=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.evaluate((hud) => {
    const g = window.__game; g.simulate = true;
    for (const b of g.brains) b.update = () => {};                    // botlar donuk (görüntü sabit kalsın)
    if (!hud) { document.getElementById('hud').style.display = 'none'; g.player.vm.render = () => {}; }
    g.playerSoldier.fly = true;
  }, hud);
  for (const [name, p, yaw, pitch] of list) {
    await page.evaluate(([p, yaw, pitch]) => { const g = window.__game, s = g.playerSoldier; s.fly = true; s.pos.set(p[0], p[1], p[2]); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; g.player.pitchT = pitch; }, [p, yaw, pitch]);
    await page.waitForTimeout(450);
    await page.evaluate(([p, yaw, pitch]) => { const s = window.__game.playerSoldier; s.pos.set(p[0], p[1], p[2]); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = pitch; }, [p, yaw, pitch]);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  }
  // minderden fırlama: bir bot turuncu minderin üstüne yürür, 0,7 sn sonra havada; kamera yerden yana bakar (yükseklik hissi)
  if (list.length > 3) {
    const air = await page.evaluate(() => {
      const g = window.__game, s = g.soldiers.find((e) => e !== g.playerSoldier && e.alive);
      s.pos.set(-10.2, 0, -8.5); s.vel.set(0, 0, 0); s.yaw = Math.PI / 2; s.brain && (s.brain.update = () => {});
      let t = 0;
      for (let i = 0; i < 400 && t < 0.72; i++) { if (!(s.launchT > 0)) s.vel.x = -3; g.world.move(s, 1 / 60); if (s.launchT > 0) t += 1 / 60; }
      s.syncModel?.(0.016);
      const p = g.playerSoldier; p.fly = true; p.pos.set(-9.5, 0.4, -17.5); p.vel.set(0, 0, 0);
      const dx = s.pos.x - p.pos.x, dz = s.pos.z - p.pos.z, dy = s.pos.y + 1 - (p.pos.y + 1.6);
      p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)) + 0.12;
      window.__airBot = s; window.__airPos = s.pos.clone();
      return { y: +s.pos.y.toFixed(2), x: +s.pos.x.toFixed(2), launched: t > 0 };
    });
    await page.evaluate(() => { const s = window.__airBot; s.update = ((u) => function (dt) { u.call(this, dt); this.pos.copy(window.__airPos); this.vel.set(0, 0, 0); })(s.update); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${tag}-13-minder-havada.png` });
    console.log(tag, 'minder havada:', JSON.stringify(air));
  }
  const perf = await page.evaluate(() => { const g = window.__game, r = g.renderer.info.render; return { calls: r.calls, tris: r.triangles, fps: Math.round(g._perf?.fps || 0), ms: +(g._perf?.ms || 0).toFixed?.(2) }; });
  console.log(tag, 'perf', JSON.stringify(perf), 'hata', errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
const only = process.env.ONLY;
if (process.env.THUMB) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?autostart=8v8&map=boyakulesi&type=pb&debug=1&nolock=1&shadows=1`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.evaluate(() => {
    const g = window.__game, p = g.playerSoldier; p.protT = 999; g.simulate = true;
    for (let i = 0; i < 20 * 30; i++) g.step(1 / 30);
    p.fly = true; p.pos.set(-30, 24, 30); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 4; p.pitch = -0.5;
    for (const b of g.brains) b.update = () => {};
    document.getElementById('hud').style.display = 'none'; g.player.vm.render = () => {};
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'public/img/boyakulesi.png' });
  await ctx.close();
} else {
  if (only !== 'mob') await shoot({ viewport: { width: 1280, height: 720 } }, 'masa', VIEWS);
  if (only !== 'desk') await shoot({ ...(devices['Pixel 7 landscape'] || { viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true }), deviceScaleFactor: 1 }, 'mobil', [VIEWS[0], VIEWS[5], ['14-mobil-oyun', [-23.2, 9, -19.8], -3 * D, -0.08]], { hud: true, touch: true });
}
await browser.close();
