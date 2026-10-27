// 12.189 bot sürücü / pilot + bayrak çatışması GERÇEK GPU görüntüleri (çevrimdışı 10v10 Kuzey Ele Geçirme; oyuncu gökte asılı, botlar oynar).
//   URL=http://127.0.0.1:5713 OUT=/tmp/wb-qa7 node scripts/botvehshot.mjs
// Kamera araç kovalar (arkasından / yanından) ya da en kalabalık çekişmeli bayrağa bakar. HUD gizli. Ayrıca her karede durum (sürücü, hız, irtifa).
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5713', OUT = process.env.OUT || '/tmp/wb-qa7';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=10v10&map=kuzey&type=conquest&debug=1&nolock=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.evaluate(() => {
  const g = window.__game, me = g.playerSoldier;
  g.devGod = true; me.fly = true; me.pos.set(120, 260, 760); me.vel.set(0, 0, 0);
  if (me.model) me.model.root.visible = false;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () {
    const me = this.playerSoldier; me.pos.set(120, 260, 760); me.vel.set(0, 0, 0);
    const k = this._chase;
    if (k?.v?.st) {
      const st = k.v.st, fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
      const [back, side, up, look] = k.off;
      c.position.set(st.x - fx * back + rx * side, st.y + up, st.z - fz * back + rz * side);
      c.lookAt(st.x + fx * look, st.y + 1.2, st.z + fz * look);
      c.fov = 62; c.updateProjectionMatrix();
    } else if (k?.p) { c.position.set(...k.p); c.lookAt(...k.t); c.fov = k.fov || 62; c.updateProjectionMatrix(); }
    orig.call(this);
  };
});
const info = async () => page.evaluate(() => {
  const g = window.__game, V = g.vehicles;
  return V.list.filter((v) => v.alive && v.seats[0]?.brain?.vd).map((v) => ({ i: v.idx, id: v.id, type: v.type, st: v.seats[0].brain.vd.state, sp: +V.speed(v).toFixed(1), agl: +(v.st.y - g.world.heightAt(v.st.x, v.st.z)).toFixed(1), occ: v.seats.filter(Boolean).length, team: v.team, tg: !!v.seats[0].brain.vd.tg }));
});
const chase = async (pred, off, name, waitFor = 90000, after = 1500) => {
  const t0 = Date.now();
  let v = null;
  while (Date.now() - t0 < waitFor) { const L = await info(); v = L.find(pred); if (v) break; await page.waitForTimeout(1000); }
  if (!v) { console.log('BULUNAMADI', name); return null; }
  await page.evaluate(([i, off]) => { const g = window.__game; g._chase = { v: g.vehicles.list[i], off }; }, [v.i, off]);
  await page.waitForTimeout(after);
  const now = (await info()).find((x) => x.i === v.i) || v;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, JSON.stringify(now));
  return now;
};
await page.waitForTimeout(6000);
await chase((v) => v.type === 'jip' && v.st === 'drive' && v.sp > 8 && v.occ >= 2, [9, 2.5, 3.6, 8], '01-bot-jip-surus');
await chase((v) => v.type === 'tank' && v.st === 'drive' && v.sp > 4, [13, -4, 5.5, 10], '02-bot-tank-surus');
await chase((v) => v.type.startsWith('heli') && (v.st === 'climb' || v.st === 'wait'), [22, 10, 6, 6], '03-bot-heli-kalkis', 60000, 2500);
await chase((v) => v.type.startsWith('heli') && v.st === 'cruise' && v.agl > 25, [26, -8, 7, 20], '04-bot-heli-seyir', 90000, 1500);
await chase((v) => v.type === 'tank' && v.tg, [12, 5, 4.5, 30], '05-bot-tank-hedefte', 120000, 600);
await chase((v) => v.type.startsWith('heli') && v.st === 'orbit', [30, 14, 9, 25], '06-bot-heli-yorunge', 120000, 1500);
await chase((v) => v.type === 'jip' && (v.st === 'hold' || v.sp < 3) && v.occ >= 1, [10, 5, 4, 0], '07-bot-jip-varis', 90000, 300);
// bayrak çatışması: iki takımın en kalabalık olduğu bayrak, hedefi olan botun omzunun üstünden
for (let k = 0; k < 3; k++) {
  const ok = await page.evaluate(() => {
    const g = window.__game;
    let best = null, bs = 0;
    for (const o of g.mode.objectives) { let b = 0, r = 0; for (const s of g.soldiers) if (s.alive && !s.veh && Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < 80) s.team === 'blue' ? b++ : r++; const sc = Math.min(b, r); if (sc > bs) { bs = sc; best = o; } }
    const fighter = g.brains.find((b) => b.target && !b.s.veh && b.s.alive && (!best || Math.hypot(b.s.pos.x - best.x, b.s.pos.z - best.z) < 120)) || g.brains.find((b) => b.target && !b.s.veh);
    if (!fighter) return null;
    const s = fighter.s, t = fighter.target, dx = t.pos.x - s.pos.x, dz = t.pos.z - s.pos.z, L = Math.hypot(dx, dz) || 1;
    g._chase = { p: [s.pos.x - dx / L * 4 + dz / L * 1.2, s.pos.y + 2.6, s.pos.z - dz / L * 4 - dx / L * 1.2], t: [t.pos.x, t.pos.y + 1.2, t.pos.z], fov: 58 };
    return { flag: best?.id, dist: Math.round(L), n: bs };
  });
  if (ok) { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/0${8 + k}-catisma.png` }); console.log('catisma', JSON.stringify(ok)); }
  await page.waitForTimeout(9000);
}
const flagAir = await page.evaluate(() => {
  const g = window.__game;
  let best = null, bs = -1;
  for (const o of g.mode.objectives) { let b = 0, r = 0; for (const s of g.soldiers) if (s.alive && Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < 120) s.team === 'blue' ? b++ : r++; const sc = Math.min(b, r) * 10 + b + r; if (sc > bs) { bs = sc; best = o; } }
  const y = g.world.heightAt(best.x, best.z);
  g._chase = { p: [best.x + 70, y + 45, best.z + 70], t: [best.x, y, best.z], fov: 55 };
  return { flag: best.id, score: bs };
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/11-bayrak-kusbakisi.png` });
console.log('bayrak', JSON.stringify(flagAir));
const st = await page.evaluate(() => { const g = window.__game; return { t: Math.round(g.time), kills: g.soldiers.reduce((a, s) => a + s.kills, 0), vb: g.vbStats ? { ...g.vbStats, trips: g.vbStats.trips?.length } : null }; });
console.log('durum', JSON.stringify(st), 'sayfa hatası', errs.length, errs.slice(0, 3).join(' | '));
await browser.close();
