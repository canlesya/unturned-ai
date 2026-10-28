// 12.213 kule + sabit yuva GERÇEK GPU görüntüleri (Kuzey Vadisi, çevrimdışı): URL=http://127.0.0.1:5200 OUT=/tmp/wb-tower node scripts/towershots.mjs
// 1 kule dışarıdan · 2 merdivenden çıkış (3. şahıs) · 3 HMG başında birinci şahıs (ateş) · 4 tanksavarla tankı vurma · 5 bot HMG kullanıyor · 6 M haritası
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5200', OUT = process.env.OUT || '/tmp/wb-tower';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('görüntü', n); };
// ortak: botları dondur, serbest kamera kancası
await page.evaluate(() => {
  const g = window.__game, P = Object.getPrototypeOf(g), orig = P.render;
  g.devGod = true; window.__cam = null; const vr = g.player.vm.render.bind(g.player.vm); window.__vm = (on) => { g.player.vm.render = on ? vr : () => {}; }; window.__vm(false);
  P.render = function () { const C = window.__cam; if (C) { const c = this.camera; c.position.set(C.p[0], C.p[1], C.p[2]); c.lookAt(C.l[0], C.l[1], C.l[2]); c.fov = C.fov || 55; c.updateProjectionMatrix(); } orig.call(this); };
  g.brainsOff = g.brains.splice(0);                                       // N: botlar donuk
});
const T = await page.evaluate(() => window.__game.map.towers.map((t) => ({ id: t.id, x: t.x, z: t.z, top: t.top, y0: t.y0, foot: t.foot, pts: t.pts, ry: t.ry, mg: t.mg })));
const C = T.find((t) => t.id === 'kule:C');
// 1 dışarıdan (iki açı)
for (const [k, ang, dist, h] of [['1-kule-disaridan', 0.8, 17, 4], ['1b-kule-merdiven', -0.5, 14, 3]]) {
  await page.evaluate(([C, ang, dist, h]) => {
    const g = window.__game, me = g.playerSoldier; g.hud.root.style.display = 'none';
    const x = C.x + Math.cos(ang) * dist, z = C.z + Math.sin(ang) * dist;
    me.fly = true; me.pos.set(x, g.world.heightAt(x, z) + 1, z); if (me.model) me.model.root.visible = false;
    window.__cam = { p: [x, g.world.heightAt(x, z) + h, z], l: [C.x, C.y0 + 4, C.z], fov: 55 };
  }, [C, ang, dist, h]);
  await page.waitForTimeout(1500); await shot(k);
}
// 2 merdivenden çıkış: oyuncu (yaya) merdivende; kamera arkasında
await page.evaluate((C) => { const g = window.__game, me = g.playerSoldier; me.fly = false; window.__cam = null; g.hud.root.style.display = ''; if (me.model) me.model.root.visible = true; me.pos.set(C.foot.x, C.foot.y, C.foot.z); me.vel.set(0, 0, 0); }, C);
let hist = [];
for (let i = 1; i < C.pts.length; i++) {
  for (let n = 0; n < 60; n++) {
    const r = await page.evaluate(([P, last]) => {
      const g = window.__game, me = g.playerSoldier, dx = P.x - me.pos.x, dz = P.z - me.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) return { d, y: me.pos.y };
      me.vel.x = dx / d * 3; me.vel.z = dz / d * 3; me.yaw = Math.atan2(-dx, -dz); me.pitch = 0.25;
      const b = Math.atan2(-dx, -dz);
      window.__cam = { p: [me.pos.x + Math.sin(b) * 3.2 + Math.cos(b) * 1.2, me.pos.y + 2.2, me.pos.z + Math.cos(b) * 3.2 - Math.sin(b) * 1.2], l: [me.pos.x - Math.sin(b) * 3, me.pos.y + 1.4, me.pos.z - Math.cos(b) * 3], fov: 62 };
      return { d, y: me.pos.y };
    }, [C.pts[i], i === C.pts.length - 1]);
    hist.push(r.y);
    await page.waitForTimeout(50);
    if (r.d < 0.3) break;
  }
  if (i === 2) await shot('2-merdivenden-cikis');
}
await page.waitForTimeout(300);
const ym = await page.evaluate(() => window.__game.playerSoldier.pos.y);
console.log('merdiven: en yüksek', Math.max(...hist).toFixed(2), 'son', ym.toFixed(2), 'platform', C.top.toFixed(2));
await shot('2b-platformda');
// 3 HMG başında birinci şahıs: önüne iki düşman koy, ateş et
const hm = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((q) => q.id === 'Y-C-K');
  window.__cam = null; g.hud.root.style.display = ''; window.__vm(true);
  me.fly = false; V.enter(me, v, 0); me.yaw = v.st.base; me.pitch = -0.05;
  const foes = g.soldiers.filter((s) => s.team !== me.team && s.alive && !s.veh).slice(0, 2), fx = -Math.sin(v.st.base), fz = -Math.cos(v.st.base);
  foes.forEach((f, i) => { const X = v.st.x + fx * (40 + i * 6) + fz * (i ? 4 : -3), Z = v.st.z + fz * (40 + i * 6) - fx * (i ? 4 : -3); f.alive = true; f.hp = 100; f.pos.set(X, g.world.heightAt(X, Z), Z); f.vel.set(0, 0, 0); f.devGodOff = true; });
  const f0 = foes[0]; const dx = f0.pos.x - me.eye().x, dz = f0.pos.z - me.eye().z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(f0.pos.y + 1.1 - me.eye().y, Math.hypot(dx, dz));
  g.devGod = false;
  return { id: v.id, seat: me.seat, veh: !!me.veh };
});
console.log('HMG', JSON.stringify(hm));
await page.waitForTimeout(800); await shot('3-hmg-birinci-sahis');
await page.evaluate(() => { window.__game.player.fireHeld = true; window.__game.player.locked = true; });
await page.waitForTimeout(450); await shot('3b-hmg-ates');
await page.waitForTimeout(500);
const hr = await page.evaluate(() => { const g = window.__game; g.player.fireHeld = false; const me = g.playerSoldier; return { heat: +(me.vheat || 0).toFixed(2), foes: g.soldiers.filter((s) => s.team !== me.team && s.devGodOff).map((f) => ({ alive: f.alive, hp: Math.round(f.hp) })) }; });
console.log('HMG ateş', JSON.stringify(hr));
// sağ tık yakınlaştırma
await page.evaluate(() => { const g = window.__game; g.playerSoldier.ads = true; });
await page.waitForTimeout(600); await shot('3c-hmg-yakinlastirma');
await page.evaluate(() => { const g = window.__game; g.playerSoldier.ads = false; g.vehicles.exit(g.playerSoldier); });
// 4 tanksavar: düşman tankını C tanksavarının önüne (80 m) koy, ateşle
const at = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((q) => q.type === 'atgm' && q.spawn.flag === 'C' && q.id.includes('-12'));
  const tank = V.list.find((q) => q.id === 'R-T1'), fx = -Math.sin(v.st.base), fz = -Math.cos(v.st.base);
  const X = v.st.x + fx * 85, Z = v.st.z + fz * 85;
  tank.st.x = X; tank.st.z = Z; tank.st.y = g.world.heightAt(X, Z); tank.st.yaw = v.st.base + Math.PI;      // tank tanksavara bakar (önden isabet) tank.sleep = false; tank.idleT = -1e9; tank.hp = tank.def.hp;
  const drv = g.soldiers.find((s) => s.team === 'red' && s.alive && !s.veh && !s.devGodOff); g.brainsOff = g.brainsOff.filter((b) => b.s !== drv); drv.brain = null; V.enter(drv, tank, 0);
  V.enter(me, v, 0);
  const e = me.eye(), dx = X - e.x, dz = Z - e.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(tank.st.y + 1.2 - e.y, Math.hypot(dx, dz));
  window.__tk = { tank, hits: [] };
  const d0 = V.damage.bind(V); V.damage = (q, a, by, kind, nm) => { const h0 = q.hp; const r = d0(q, a, by, kind, nm); if (q === tank) window.__tk.hits.push({ nm, d: Math.round(h0 - Math.max(0, q.hp)), hp: Math.round(Math.max(0, q.hp)) }); return r; };
  return { id: v.id, tank: tank.hp, d: Math.round(Math.hypot(dx, dz)) };
});
console.log('tanksavar', JSON.stringify(at));
await page.waitForTimeout(700); await shot('4-tanksavar-nisan');
await page.evaluate(() => { const g = window.__game; g.player.fireHeld = true; });
await page.waitForTimeout(350); await page.evaluate(() => { window.__game.player.fireHeld = false; });
await shot('4b-tanksavar-fuze');
await page.waitForTimeout(600); await shot('4c-tanksavar-isabet');
for (let k = 0; k < 3; k++) { await page.waitForTimeout(5300); await page.evaluate(() => { window.__game.player.fireHeld = true; }); await page.waitForTimeout(300); await page.evaluate(() => { window.__game.player.fireHeld = false; }); }
await page.waitForTimeout(1200);
const tk = await page.evaluate(() => ({ hits: window.__tk.hits, alive: window.__tk.tank.alive }));
console.log('tank isabetleri', JSON.stringify(tk));
await shot('4d-tank-patladi');
// 5 bot HMG kullanıyor: kırmızı bot D kulesinin HMG'sinde, mavi düşman önünde; kamera kulenin yanında
const bm = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles, me = g.playerSoldier; V.exit(me);
  g.brains.push(...g.brainsOff); g.brainsOff = null;
  const v = V.list.find((q) => q.id === 'Y-D-K'), b = g.brains.find((q) => q.s.team === 'red' && q.s.alive && !q.s.veh).s;
  V.enter(b, v, 0); b.brain.empT = 0;
  const fx = -Math.sin(v.st.base), fz = -Math.cos(v.st.base), X = v.st.x + fx * 55, Z = v.st.z + fz * 55;
  const foe = g.soldiers.find((s) => s.team === 'blue' && s !== me && s.alive); foe.pos.set(X, g.world.heightAt(X, Z), Z); foe.hp = 100; if (foe.brain) { g.brains = g.brains.filter((q) => q !== foe.brain); foe.brain = null; }
  window.__bm = { b, foe, v };
  const rx = Math.cos(v.st.base), rz = -Math.sin(v.st.base);
  window.__cam = { p: [v.st.x - fx * 5 + rx * 3.5, v.st.y + 2.2, v.st.z - fz * 5 + rz * 3.5], l: [v.st.x + fx * 10, v.st.y + 0.6, v.st.z + fz * 10], fov: 60 };
  g.hud.root.style.display = 'none'; me.fly = true; me.pos.set(v.st.x - fx * 5 + rx * 3.5, v.st.y + 0.6, v.st.z - fz * 5 + rz * 3.5);
  return { bot: b.name, v: v.id };
});
console.log('bot HMG', JSON.stringify(bm));
let fired = 0;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(120);
  const s = await page.evaluate(() => { const B = window.__bm; return { flash: B.b.flashT > 0, foe: B.foe.alive, hp: Math.round(B.foe.hp), seat: B.b.veh === B.v }; });
  if (s.flash && fired < 2) { await shot(`5-bot-hmg-${++fired}`); }
  if (!s.foe) { console.log('bot düşmanı vurdu', JSON.stringify(s)); break; }
}
if (!fired) await shot('5-bot-hmg-1');
// 6 M haritası (Kavşak'a yakın)
await page.evaluate(() => { const g = window.__game; window.__cam = null; g.hud.root.style.display = ''; g.playerSoldier.fly = false; const me = g.playerSoldier; me.pos.set(20, g.world.heightAt(20, 20), 20); g.bigMap.toggle(true); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const B = window.__game.bigMap; if (B.vw) { B.vw.z = 5; B.vw.x = 0; B.vw.y = 9; B.vw.cx = 0; B.vw.cz = 9; } B.dirty = true; });
await page.waitForTimeout(800); await shot('6-m-haritasi');
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 8));
await browser.close();
