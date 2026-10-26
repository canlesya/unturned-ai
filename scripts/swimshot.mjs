// Su / yüzme görselleri (12.180):  URL=http://127.0.0.1:5347 OUT=/tmp/wb-su/sonra GPU=1 node scripts/swimshot.mjs [görünüm,…]
// Serbest kamera görünümleri (y MUTLAK; nehir yüzeyi 0, yatak −3,1) + birinci şahıs yüzme kareleri (fp-*: oyuncu suya konur, HUD görünür).
// MOBILE=1: Pixel 7 görüntü alanı (915×412 @2,6, dokunmatik, mobil kalite).
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5347', OUT = process.env.OUT || '/tmp/wb-su/sonra';
fs.mkdirSync(OUT, { recursive: true });
// [ad, kamera, hedef, fov]
const CAMS = [
  ['su-alti-akinti', [70, -1.7, -9], [20, -1.2, 4], 70],
  ['su-alti-kopru', [30, -1.5, 2], [2, -0.6, 9], 70],
  ['su-alti-dip', [60, -1.2, -6], [64, -3.1, -9], 70],
  ['alttan-yuzey', [60, -2.6, -6], [64, 0, -10], 70],
  ['yuzeyden-asagi', [60, 1.3, -14], [62, -3, -6], 70],
  ['ustten-nehir', [80, 7, -40], [40, -1, 0], 62],
  ['kiyi-yari', [60, 0.03, -6], [30, 0.2, 2], 70],
];
const FP = ['fp-yuzey', 'fp-dalis', 'fp-kiyi'];
// 3. şahıs yüzen asker: [ad, asker konumu, hız, kamera, hedef]
const TP = [
  ['tp-yuzen', [62, -1.4, -8], [1.6, 0, 0.3], [67, 1.1, -3], [62, -0.2, -8]],
  ['tp-dalan', [62, -2.6, -8], [1.4, -0.3, 0.2], [68, -2.0, -4], [62, -2.4, -8]],
];
const want = process.argv[2] ? process.argv[2].split(',') : null;
const mobile = !!process.env.MOBILE;
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&debug=1&nolock=1&tod=day&weather=clear&dev=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.__game;
  for (const s of g.soldiers) if (s !== g.playerSoldier) { s.brain = null; s.alive = false; s.respawnT = 1e9; if (s.model) s.model.root.visible = false; }
  g.brains.length = 0; g.timeLeft = 900; g.devGod = true; g.playerSoldier.protT = 0;
  if (g.map.fx?.setHour) g.map.fx.setHour(12, g);
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () { if (this._cam) { const [p, t, f] = this._cam; c.position.set(...p); c.lookAt(...t); c.fov = f; c.updateProjectionMatrix(); } orig.call(this); };
  const r = g.renderer, ro = r.render.bind(r);
  r.render = (sc, cam) => { ro(sc, cam); if (sc === g.scene) window.__info = { calls: r.info.render.calls, tris: r.info.render.triangles }; };
});
const rep = {};
const sfx = mobile ? '-telefon' : '';
for (const [n, pos, tgt, fov] of CAMS) {
  if (want && !want.some((w) => n.startsWith(w))) continue;
  await page.evaluate(([pos, tgt, fov]) => {
    const g = window.__game; g.hud.root.style.display = 'none'; g._vmHide ??= g.player.vm.render; g.player.vm.render = () => {};
    g.playerSoldier.pos.set(pos[0], 30, pos[2]); g.playerSoldier.fly = true; g.playerSoldier.vel.set(0, 0, 0); g._cam = [pos, tgt, fov];
  }, [pos, tgt, fov]);
  await page.waitForTimeout(+(process.env.WAIT || 1200));
  await page.screenshot({ path: `${OUT}/${n}${sfx}.png` });
  rep[n] = await page.evaluate(() => window.__info);
}
for (const [n, sp, sv, cp, ct] of TP) {
  if (want && !want.some((w) => n.startsWith(w))) continue;
  await page.evaluate(([sp, sv, cp, ct]) => {
    const g = window.__game, o = g.soldiers.find((s) => s !== g.playerSoldier && s.team !== g.playerSoldier.team) || g.soldiers[1];
    g.hud.root.style.display = 'none'; g._vmHide ??= g.player.vm.render; g.player.vm.render = () => {};
    o.alive = true; o.hp = o.maxHp; o.deadT = 0; o.respawnT = 1e9; o.pos.set(...sp); o.vel.set(...sv); o.yaw = Math.atan2(-sv[0], -sv[2]); o.pitch = sv[1] < 0 ? -0.5 : 0; o.model.root.visible = true;
    window.__tp = { o, sp, sv }; if (!window.__tpHook) { window.__tpHook = true; const st = g.step.bind(g); g.step = (dt) => { const T = window.__tp; if (T) { T.o.pos.set(...T.sp); T.o.vel.set(...T.sv); T.o.air = 18; } return st(dt); }; }
    g.playerSoldier.pos.set(cp[0], 30, cp[2]); g.playerSoldier.fly = true; g._cam = [cp, ct, 60];
  }, [sp, sv, cp, ct]);
  await page.waitForTimeout(+(process.env.WAIT || 1500));
  await page.screenshot({ path: `${OUT}/${n}${sfx}.png` });
  rep[n] = await page.evaluate(() => window.__info);
}
await page.evaluate(() => { const T = window.__tp; if (T) { T.o.alive = false; T.o.model.root.visible = false; window.__tp = null; } });
// birinci şahıs: oyuncu nehirde (x 60, z −6), kamera oyuncunun gözü
for (const n of FP) {
  if (want && !want.some((w) => n.startsWith(w))) continue;
  const r = await page.evaluate((n) => {
    const g = window.__game, s = g.playerSoldier; g._cam = null; g.hud.root.style.display = ''; if (g._vmHide) g.player.vm.render = g._vmHide;
    s.fly = false; s.vel.set(0, 0, 0); s.alive = true; s.hp = s.maxHp;
    if (n === 'fp-yuzey') { s.pos.set(60, -1.4, -6); s.yaw = 1.9; s.pitch = -0.05; }
    if (n === 'fp-dalis') { s.pos.set(60, -2.9, -6); s.yaw = 1.9; s.pitch = 0.1; s.air = 6; }
    if (n === 'fp-kiyi') { s.pos.set(100, -1.4, -24); s.yaw = Math.PI; s.pitch = -0.1; }
    return { y: s.pos.y };
  }, n);
  await page.waitForTimeout(n === 'fp-dalis' ? 250 : 1200);
  const st = await page.evaluate(() => { const s = window.__game.playerSoldier; return { y: +s.pos.y.toFixed(2), swim: !!s.swim, under: !!s.under, air: s.air, cam: +window.__game.camera.position.y.toFixed(2) }; });
  console.log(n, JSON.stringify(st));
  await page.screenshot({ path: `${OUT}/${n}${sfx}.png` });
  rep[n] = await page.evaluate(() => window.__info);
}
console.log('çizim', JSON.stringify(rep));
fs.writeFileSync(`${OUT}/report${sfx}.json`, JSON.stringify(rep, null, 1));
console.log('hata', errs.length, errs.slice(0, 5).join(' | '));
await browser.close();
