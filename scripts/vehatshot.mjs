// 12.200 tanksavar bot GERÇEK GPU görüntüsü (Kuzey Vadisi, çevrimdışı): düşman tankı (içinde sürücü) açık arazide; RPG'li bot (mühendis) yaklaşır,
// öncülü nişan alır, roket atar. Tankın canı + isabet yönü (ön / yan / arka) + kaç isabette patladığı ölçülür; görüntüler OUT/ (kamera botun arkasında).
//   URL=http://127.0.0.1:5287 OUT=/tmp/wb-veh/at node scripts/vehatshot.mjs        (SIDE=rear: bot tankın arkasından başlar)
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5287', OUT = process.env.OUT || '/tmp/wb-veh/at', SIDE = process.env.SIDE || 'front';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
const setup = await page.evaluate((SIDE) => {
  const g = window.__game, V = g.vehicles, me = g.playerSoldier;
  g.devGod = true; me.fly = true;
  if (me.model) me.model.root.visible = false;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const tank = V.list.find((v) => v.id === 'R-T1');
  const X = 60, Z = 230;                                                 // Vadi Yolu ile Benzinlik arası açık çayır
  tank.st.x = X; tank.st.z = Z; tank.st.yaw = 0; tank.st.y = g.world.heightAt(X, Z); tank.sleep = false; tank.idleT = -1e9;
  const drv = g.soldiers.find((s) => s.team === 'red' && s.alive);
  g.brains = g.brains.filter((b) => b.s !== drv); drv.brain = null; drv.protT = 0;
  V.enter(drv, tank, 0);
  const eng = g.brains.find((b) => b.s.team === 'blue' && b.s.alive).s;
  eng.setClass('engineer'); eng.items[2] = { id: 'rpg', mag: 1, reserve: 3 };     // bu sahnede 4 roket (önden 4 isabet gösterilebilsin)
  for (const s of g.soldiers) if (s !== eng && s !== drv && s !== me) { s.alive = false; s.vacant = true; if (s.model?.root) s.model.root.visible = false; }
  g.brains = g.brains.filter((b) => b.s === eng);
  const f = SIDE === 'rear' ? 1 : -1;                                    // yaw 0: ileri = −z; ön = −z tarafı
  eng.pos.set(X + 6, g.world.heightAt(X + 6, Z + f * 75), Z + f * 75); eng.protT = 0;
  eng.brain.reset?.(); eng.brain.goal = null;
  const hits = [];
  const d0 = V.damage.bind(V);
  V.damage = (v, a, by, kind, nm) => { const h0 = v.hp; const r = d0(v, a, by, kind, nm); if (v === tank && by === eng) hits.push({ t: +g.time.toFixed(2), nm, d: Math.round(h0 - Math.max(0, v.hp)), hp: Math.round(Math.max(0, v.hp)) }); return r; };
  window.__at = { hits, tank, eng, drv };
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () {
    const e = window.__at.eng, t = window.__at.tank;
    if (e && t.st) { const dx = t.st.x - e.pos.x, dz = t.st.z - e.pos.z, L = Math.hypot(dx, dz) || 1; c.position.set(e.pos.x - dx / L * 7 + dz / L * 2.5, e.pos.y + 3.2, e.pos.z - dz / L * 7 - dx / L * 2.5); c.lookAt(t.st.x * 0.6 + e.pos.x * 0.4, t.st.y + 1.5, t.st.z * 0.6 + e.pos.z * 0.4); c.fov = 50; c.updateProjectionMatrix(); this.playerSoldier.pos.set(c.position.x, c.position.y - 1.6, c.position.z); }
    orig.call(this);
  };
  return { tank: tank.hp, eng: eng.id, drv: drv.id };
}, SIDE);
console.log('kurulum', JSON.stringify(setup));
let shots = 0, last = 0;
for (let i = 0; i < 160; i++) {
  await page.waitForTimeout(250);
  const s = await page.evaluate(() => { const A = window.__at, g = window.__game; return { t: +g.time.toFixed(1), hp: Math.round(A.tank.hp), alive: A.tank.alive, wreck: A.tank.wreck, n: A.hits.length, rk: g.projectiles.filter((p) => p.type === 'rocket').length, d: Math.round(Math.hypot(A.eng.pos.x - A.tank.st.x, A.eng.pos.z - A.tank.st.z)), mag: A.eng.items[2].mag + A.eng.items[2].reserve }; });
  if ((s.rk > 0 || s.n !== last) && shots < 14) { await page.screenshot({ path: `${OUT}/${SIDE}-${String(++shots).padStart(2, '0')}-t${s.t}-hp${s.hp}.png` }); last = s.n; }
  if (i % 8 === 0) console.log(JSON.stringify(s));
  if (!s.alive) { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${SIDE}-patladi.png` }); break; }
}
const hits = await page.evaluate(() => window.__at.hits);
console.log('isabetler', JSON.stringify(hits));
fs.writeFileSync(`${OUT}/${SIDE}-olcum.json`, JSON.stringify({ setup, hits }, null, 1));
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 5));
await browser.close();
