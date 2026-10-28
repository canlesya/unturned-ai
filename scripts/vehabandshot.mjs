// 12.212 terk edilen araç GERÇEK GPU görüntüsü (çevrimdışı 10v10 Kuzey Ele Geçirme; oyuncu gökte, uzakta).
//   URL=http://127.0.0.1:5199 OUT=/tmp/wb-aband node scripts/vehabandshot.mjs
// 1) Mavi jip, uzak bayrağa yürüyen mavi botun ~25 m önüne "terk edilmiş" bırakılır (son sürücü var, doğuşundan uzak) → bot biner mi.
// 2) Başka bir jip kimsenin olmadığı yere bırakılır, boşta sayacı 45 sn'ye alınır (bekleme kısaltma) → kendini yok edip üste yeniden doğar mı.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5199', OUT = process.env.OUT || '/tmp/wb-aband';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=10v10&map=kuzey&type=conquest&debug=1&nolock=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
await page.evaluate(() => {
  const g = window.__game, me = g.playerSoldier;
  g.devGod = true; me.fly = true;
  if (me.model) me.model.root.visible = false;
  g.hud.root.style.display = 'none'; g.player.vm.render = () => {};
  const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
  P.render = function () {
    const me = this.playerSoldier; me.pos.set(700, 300, 700); me.vel.set(0, 0, 0);
    const k = this._cam;
    if (k?.v?.st) { const st = k.v.st; c.position.set(st.x + k.o[0], st.y + k.o[1], st.z + k.o[2]); c.lookAt(st.x, st.y + 1, st.z); c.fov = 55; c.updateProjectionMatrix(); }
    orig.call(this);
  };
});
await page.waitForTimeout(25000);
const ok = [];
// 1) bot biner mi
let r = null;
page.on('console', (m) => { if (m.text().startsWith('aday')) console.log(m.text()); });
for (let k = 0; k < 30 && !r; k++) {
  r = await page.evaluate(() => {
    const g = window.__game, V = g.vehicles;
    const v = V.list.find((u) => u.alive && u.type === 'jip' && u.spawn.team === 'blue' && !u.seats.some(Boolean));
    const b = v && g.brains.find((o) => { const s = o.s, q = g.squadGoal?.(s); return s.team === 'blue' && s.alive && !s.veh && !o.target && !o.vRes && !o.vRide && q && Math.hypot(q.x - s.pos.x, q.z - s.pos.z) > 160 && Math.hypot(s.pos.x - 700, s.pos.z - 700) > 150 && Math.hypot(s.pos.x - v.spawn.x, s.pos.z - v.spawn.z) > 120; });
    if (!b || !v) { console.log('aday yok', !!b, !!v, g.brains.length, !!g.squadGoal); return null; }
    const q = g.squadGoal(b.s), dx = q.x - b.s.pos.x, dz = q.z - b.s.pos.z, L = Math.hypot(dx, dz), x = b.s.pos.x + dx / L * 25, z = b.s.pos.z + dz / L * 25;
    v.st.x = x; v.st.z = z; v.st.y = g.world.heightAt(x, z) + 0.6; v.st.vx = v.st.vy = v.st.vz = 0; v.sleep = false;
    v.lastDriver = b.s; v.lastDriverT = g.time; v.team = 'blue'; v.idleT = 0;
    g._cam = { v, o: [14, 9, 14] };
    return { i: v.idx, id: v.id, bot: b.s.name, x: Math.round(x), z: Math.round(z) };
  });
  if (!r) await page.waitForTimeout(1500);
}
if (!r) { console.log('uygun bot bulunamadı'); } else {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/01-terk-edilen-jip.png` });
  console.log('bırakıldı', JSON.stringify(r));
  let got = null;
  for (let t = 0; t < 45 && !got; t++) {
    await page.waitForTimeout(1000);
    got = await page.evaluate((i) => { const g = window.__game, v = g.vehicles.list[i], d = v.seats[0]; return d && d.brain ? { drv: d.name, t: Math.round(g.time), fromSpawn: Math.round(Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z)) } : null; }, r.i);
  }
  if (got) { await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}/02-bot-terk-edilen-jipe-bindi.png` }); }
  console.log(got ? 'OK   bot terk edilen jipe bindi ' + JSON.stringify(got) : 'HATA bot binmedi');
  ok.push(!!got);
}
// 2) uzakta terk edilen jip kendini yok edip üste döner
const r2 = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles;
  const v = V.list.find((u) => u.alive && u.type === 'jip' && u.spawn.team === 'red' && !u.seats.some(Boolean) && Math.hypot(u.st.x - u.spawn.x, u.st.z - u.spawn.z) < 6);
  if (!v) return null;
  const x = v.spawn.x * 0.4, z = v.spawn.z * 0.4 + 60;
  v.st.x = x; v.st.z = z; v.st.y = g.world.heightAt(x, z) + 0.6; v.st.vx = v.st.vy = v.st.vz = 0; v.sleep = false;
  v.lastDriver = g.soldiers.find((s) => s.team === 'red'); v.lastDriverT = g.time; v.team = 'red'; v.idleT = v.def.idleRespawn - 6; v.botBad = g.time + 60;      // bekleme kısaltma (görüntü için) · botlar almasın
  g._cam = { v, o: [12, 7, 12] };
  return { i: v.idx, id: v.id, x: Math.round(x), z: Math.round(z), spawn: [Math.round(v.spawn.x), Math.round(v.spawn.z)], idle: v.def.idleRespawn };
});
console.log('uzakta bırakıldı', JSON.stringify(r2));
let back = null;
for (let t = 0; t < 40 && r2 && !back; t++) {
  await page.waitForTimeout(1000);
  back = await page.evaluate((i) => { const g = window.__game, v = g.vehicles.list[i]; return v.alive && Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) < 4 ? { t: Math.round(g.time), spawnN: v.spawnN } : null; }, r2.i);
}
if (back) { await page.evaluate((i) => { const g = window.__game; g._cam = { v: g.vehicles.list[i], o: [10, 6, -12] }; }, r2.i); await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/03-terk-edilen-jip-uste-dondu.png` }); }
console.log(back ? 'OK   terk edilen jip üste yeniden doğdu ' + JSON.stringify(back) : 'HATA jip üste dönmedi');
ok.push(!!back);
console.log('sayfa hatası', errs.length, errs.slice(0, 3));
console.log(ok.every(Boolean) && !errs.length ? 'sonuç: OK' : 'sonuç: HATA');
await browser.close();
