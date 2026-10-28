// 12.214 gerçek GPU görüntüsü: daha önce az leş alan bot türlerini izler (headless:false, --use-angle=metal).
//   URL=http://127.0.0.1:5201 OUT=/tmp/wb-botk node scripts/botkshot.mjs
// 1) Kasaba TDM: pompalı mühendis bot uzak hedefe tabancayla ateş ediyor (12.214: range[1] × 1,25 ötesinde tabanca) — omzunun üstünden
// 2) Kuzey Vadisi fetih: makineli koltuğuna geçmiş jip / helikopter yolcusu (12.214) — ya da keskin nişancı bot uzak hedefte
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5201', OUT = process.env.OUT || '/tmp/wb-botk';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const setup = () => page.evaluate(() => {
  const g = window.__game, me = g.playerSoldier;
  g.devGod = true; me.fly = true; me.pos.set(0, 3000, 0); me.vel.set(0, 0, 0); me.protT = 99;
  if (me.model) me.model.root.visible = false;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () {
    const me = this.playerSoldier; me.pos.set(0, 3000, 0); me.vel.set(0, 0, 0); me.protT = 99;
    const f = this._follow;
    if (f && f.s.alive) {
      const s = f.s, tg = s.brain?.target, a = s.veh ? s.veh.st : s.pos;
      let yaw = s.yaw; if (tg) yaw = Math.atan2(-(tg.pos.x - s.pos.x), -(tg.pos.z - s.pos.z));
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      // omuz üstü kamera: göz → kamera hattı açık olan ilk ofset (bina / çatı içine girmesin)
      const E = s.eye(new c.position.constructor()), C = new c.position.constructor();
      const offs = [f.off, [f.off[0] * 0.6, f.off[1] * 0.5, f.off[2] * 0.8], [1.3, 0.35, s.height + 0.25], [0.7, 0.2, s.height + 0.15]];
      for (const [back, side, up] of offs) { C.set(s.pos.x - fx * back + rx * side, s.pos.y + up, s.pos.z - fz * back + rz * side); if (this.world.clear(E, C)) break; }
      c.position.copy(C);
      if (tg) c.lookAt(tg.pos.x, tg.pos.y + 1.1, tg.pos.z); else c.lookAt(s.pos.x + fx * 20, s.pos.y + 1.2, s.pos.z + fz * 20);
      c.fov = 55; c.updateProjectionMatrix(); void a;
    }
    orig.call(this);
  };
});
const wait = async (fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await page.evaluate(fn, arg); if (r) return r; await page.waitForTimeout(250); } return null; };
const report = [];

// ── 1) Kasaba TDM pompalı mühendis ──
await page.goto(`${URL0}/?autostart=10v10&map=kasaba&type=tdm&debug=1&nolock=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await setup();
for (let k = 0; k < 2; k++) {
  const r = await wait(() => {
    const g = window.__game, SG = ['shotgun', 'aa12', 'dbl'];
    for (const b of g.brains) {
      const s = b.s, tg = b.target;
      if (!s.alive || !tg || !SG.includes(s.items[0]?.id) || s.cur !== 1) continue;
      const d = Math.hypot(tg.pos.x - s.pos.x, tg.pos.z - s.pos.z);
      if (d < 36 || d > 80) continue;
      g._follow = { s, off: [3.2, 1.1, 2.1] };
      return { name: s.name, cls: s.cls, primary: s.items[0].id, holding: s.items[s.cur].id, dist: +d.toFixed(1), kills: s.kills, deaths: s.deaths };
    }
    return null;
  }, null, 120000);
  if (!r) { report.push('1: pompalı + tabanca anı bulunamadı'); break; }
  await page.waitForTimeout(400);
  if (!(await page.evaluate(() => { const f = window.__game._follow; return f && f.s.alive && f.s.brain.target && f.s.cur === 1; }))) { k--; continue; }
  await page.screenshot({ path: `${OUT}/0${k + 1}-kasaba-pompali-muhendis-tabancada.png` });
  report.push(`1.${k + 1}: ${JSON.stringify(r)} ${await page.evaluate(() => { const g = window.__game, f = g._follow, R = (v) => v.toArray().slice(0, 3).map((x) => +(+x).toFixed(2)); return JSON.stringify({ cam: R(g.camera.position), rot: R(g.camera.rotation), me: R(f.s.pos), tg: f.s.brain.target ? R(f.s.brain.target.pos) : null }); })}`);
  await page.waitForTimeout(6000);
}
// ── 2) Kuzey Vadisi: makineli koltuğuna geçen yolcu / keskin nişancı ──
await page.goto(`${URL0}/?autostart=10v10&map=kuzey&type=conquest&debug=1&nolock=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await setup();
const r2 = await wait(() => {
  const g = window.__game;
  for (const b of g.brains) {
    const s = b.s, v = s.veh;
    if (!s.alive || !v || s.seat === 0 || !v.def.mg?.seats.includes(s.seat) || (!b._seatMoved && Date.now() - (window._t0 ||= Date.now()) < 60000)) continue;
    if (!(g.vehicles.speed(v) > 3 || b.target)) continue;
    g._follow = { s, off: [v.def.heli ? 9 : 6, 2.5, v.def.heli ? 3.5 : 2.8] };
    return { name: s.name, veh: v.type, seat: s.seat, from: b._seatMoved ?? null, speed: +g.vehicles.speed(v).toFixed(1), target: !!b.target };
  }
  return null;
}, null, 150000);
if (r2) { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/03-kuzey-yolcu-makineliye-gecti.png` }); report.push(`2: ${JSON.stringify(r2)}`); }
else report.push('2: makineliye geçen yolcu bulunamadı');
const r3 = await wait(() => {
  const g = window.__game;
  for (const b of g.brains) {
    const s = b.s, tg = b.target;
    if (!s.alive || s.veh || !tg || !['sniper', 'svd', 'barrett'].includes(s.items[0]?.id) || s.cur !== 0) continue;
    const d = Math.hypot(tg.pos.x - s.pos.x, tg.pos.z - s.pos.z);
    if (d < 45) continue;
    g._follow = { s, off: [2.6, 0.9, 1.9] };
    return { name: s.name, w: s.items[0].id, dist: +d.toFixed(0), kills: s.kills };
  }
  return null;
}, null, 120000);
if (r3) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/04-kuzey-keskin-nisanci-uzak-hedef.png` }); report.push(`3: ${JSON.stringify(r3)}`); }
else report.push('3: uzak hedefli keskin nişancı bulunamadı');
console.log(report.join('\n'));
console.log('sayfa hatası:', errs.length, errs.slice(0, 3).join(' | '));
await browser.close();
