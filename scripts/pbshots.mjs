// Paintball görüntüleri: iki silah 1. şahıs (bel + nişan), 3. şahıs karakter (bot + kendin), uçan toplar, duvarda farklı renk lekeler,
// vurulan oyuncunun üstündeki boya, çizim çağrısı / FPS ölçümü (8 bot paintball). Çıktı: /tmp/wb-pb-shots/*.png
//   node scripts/pbshots.mjs [http://127.0.0.1:5192]
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5192', OUT = '/tmp/wb-pb-shots';
fs.mkdirSync(OUT, { recursive: true });
// GPU=1: gerçek GPU (Mac: Metal) ile — FPS ölçümü için; varsayılan swiftshader (her makinede çalışır, yavaş)
const GPU = !!process.env.GPU;
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text())); page.on('response', (r) => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
await page.goto(`${BASE}/?autostart=8v8&map=kasaba&type=dm&tod=day&debug=1&dev=1&nolock=1`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
const shot = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('görüntü', n); };
// zamanı elle yürüt: döngü yalnız çizer
await page.evaluate(() => {
  const g = window.__game; g.simulate = false; g.brains.forEach((b) => (b.update = () => {}));
  window.__adv = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) g.step(dt); };
  window.__give = (s, ids) => { s.items = ids.map((id) => ({ id, mag: id === 'pbrifle' ? 50 : 12, reserve: 150 })); s.cur = 0; s.cd = 0; s.reloadT = 0; s.switchT = 0; if (s === g.playerSoldier) g.player.refreshWeapon(); else s._syncWeaponModel(true); };
  // açık bir duvar bul: oyuncudan yatay ışınla 7-11 m'de dik bir duvar
  const p = g.playerSoldier, V = p.pos.constructor;
  let best = null;
  for (let k = 0; k < 4000 && !best; k++) {
    const x = -60 + Math.random() * 120, z = -60 + Math.random() * 120;
    if (!g.nav.isFree(x, z)) continue;
    const a = Math.random() * 6.28, d = new V(-Math.sin(a), 0, -Math.cos(a)), e = new V(x, g.world.heightAt(x, z) + 1.6, z);
    const h = g.world.raycast(e, d, 12, {});
    if (!h || h.t < 7 || h.t > 11 || !h.collider || Math.abs(h.normal.y) > 0.2) continue;
    const h2 = g.world.raycast(e.clone().setY(e.y - 1), d, 12, {}), h3 = g.world.raycast(e.clone().setY(e.y + 0.8), d, 12, {});
    if (!h2 || !h3 || Math.abs(h2.t - h.t) > 0.3 || Math.abs(h3.t - h.t) > 0.3) continue;
    // arkada da yer olsun (3. şahıs kamera)
    if (g.world.raycast(e, d.clone().negate(), 4, {})) continue;
    best = { x, z, yaw: a, t: h.t };
  }
  window.__spot = best;
  p.pos.set(best.x, g.world.heightAt(best.x, best.z), best.z); p.yaw = best.yaw; p.pitch = 0; p.vel.set(0, 0, 0);
  g.devGod = true;
  for (const s of g.soldiers) if (s !== p) { s.alive = false; s.vacant = true; s.pos.x += 900; s.model.root.visible = false; }       // sahne sade: botlar sahneye sonra konur
});
await page.evaluate(() => { const g = window.__game; __give(g.playerSoldier, ['pbrifle', 'pbpistol']); __adv(50); });
await shot('01-tufek-bel');
await page.evaluate(() => { const g = window.__game; g.playerSoldier.ads = true; __adv(40); });
await shot('02-tufek-nisan');
await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.ads = false; __give(p, ['pbpistol', 'pbrifle']); __adv(50); });
await shot('03-tabanca-bel');
await page.evaluate(() => { const g = window.__game; g.playerSoldier.ads = true; __adv(40); });
await shot('04-tabanca-nisan');
// reload (hazne kapağı)
await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.ads = false; __give(p, ['pbrifle', 'pbpistol']); __adv(30); p.items[0].mag = 10; p.startReload(); __adv(55); });
await shot('05-tufek-doldurma');
await page.evaluate(() => { __adv(160); });

// 3. şahıs: iki bot (tüfek + tabanca) oyuncunun önünde, oyuncuya dönük
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier, sp = window.__spot, fx = -Math.sin(sp.yaw), fz = -Math.cos(sp.yaw), rx = Math.cos(sp.yaw), rz = -Math.sin(sp.yaw);
  const bots = g.soldiers.filter((s) => s !== p).slice(0, 2);
  bots.forEach((b, i) => {
    const x = p.pos.x + fx * (2.6 + i * 0.9) + rx * (i ? 0.6 : -0.5), z = p.pos.z + fz * (2.6 + i * 0.9) + rz * (i ? 0.6 : -0.5);
    b.vacant = false; b.spawn({ x, z, ry: sp.yaw - Math.PI / 2 + (i ? -0.2 : 0.15) }, 0); b.pos.y = g.world.heightAt(x, z); b.protT = 0;
    __give(b, i ? ['pbpistol', 'pbrifle'] : ['pbrifle', 'pbpistol']);
  });
  window.__bots = bots.map((b) => b.id);
  __adv(30);
});
await shot('06-ucuncu-sahis-botlar');
await page.evaluate(() => { const g = window.__game, [a, b] = __bots.map((i) => g.soldiers[i]); a.ads = b.ads = true; a.pitch = b.pitch = 0; __adv(30); });
await shot('07-ucuncu-sahis-nisan');
// kendi karakterin 3. şahıs
await page.evaluate(() => { const g = window.__game; for (const i of __bots) { const s = g.soldiers[i]; s.alive = false; s.vacant = true; s.pos.x += 900; s.model.root.visible = false; } g.player.toggleThird(); __adv(60); });
await shot('08-kendin-ucuncu-sahis');
await page.evaluate(() => { const g = window.__game; g.player.toggleThird(); __adv(30); });

// uçan toplar: 6 farklı renkte atıcı oyuncunun 5 m önünde soldan sağa sıkar (toplar görüşü yandan keser)
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier, sp = window.__spot, fx = -Math.sin(sp.yaw), fz = -Math.cos(sp.yaw), rx = Math.cos(sp.yaw), rz = -Math.sin(sp.yaw);
  p.pos.set(sp.x, 0, sp.z); p.pos.y = g.world.heightAt(sp.x, sp.z); p.yaw = sp.yaw - 0.25; p.pitch = 0.03; p.ads = false;
  const sh = g.soldiers.filter((s) => s !== p).slice(0, 6);
  sh.forEach((b, i) => {
    const x = p.pos.x + fx * (3.2 + i * 0.55) - rx * (3.6 + (i % 2) * 0.5), z = p.pos.z + fz * (3.2 + i * 0.55) - rz * (3.6 + (i % 2) * 0.5);
    b.vacant = false; b.spawn({ x, z, ry: sp.yaw - Math.PI / 2 }, 0); b.pos.y = g.world.heightAt(x, z); b.protT = 0; __give(b, i % 3 === 2 ? ['pbpistol', 'pbrifle'] : ['pbrifle', 'pbpistol']);
  });
  window.__shooters = sh.map((s) => s.id);
  window.__fire = (n, yaw, spr = 0.3, pit = 0.04) => {
    for (let k = 0; k < n; k++) {
      for (const id of __shooters) { const s = g.soldiers[id]; s.yaw = yaw + (Math.random() - 0.5) * spr; s.pitch = pit + Math.random() * 0.12; s.cd = 0; s.items[s.cur].mag = 50; s.tryFire(); }
      g.step(1 / 60);
    }
  };
  __adv(10);
  for (let i = 0; i < 12; i++) { __fire(1, sp.yaw - Math.PI / 2 - 0.12, 0.12, 0.0); g.step(1 / 60); }
});
await shot('09-ucan-toplar');
// atıcılar duvara döner (oyuncunun arkasından)
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier, sp = window.__spot, fx = -Math.sin(sp.yaw), fz = -Math.cos(sp.yaw), rx = Math.cos(sp.yaw), rz = -Math.sin(sp.yaw);
  __shooters.forEach((id, i) => {
    const b = g.soldiers[id], off = (i - 2.5) * 0.8, back = 1.0 + (i % 2) * 0.7;
    b.pos.set(p.pos.x + rx * off - fx * back, 0, p.pos.z + rz * off - fz * back); b.pos.y = g.world.heightAt(b.pos.x, b.pos.z);
  });
  __adv(60);
});
// duvar lekeleri: herkes 3 sn sıksın, sonra oyuncu duvara yaklaşıp baksın
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier, sp = window.__spot, fx = -Math.sin(sp.yaw), fz = -Math.cos(sp.yaw);
  for (let i = 0; i < 30; i++) { __fire(1, sp.yaw, 0.3, 0.06); for (let k = 0; k < 5; k++) g.step(1 / 60); }
  __adv(90);
  p.pos.set(sp.x + fx * (sp.t - 4.2), p.pos.y, sp.z + fz * (sp.t - 4.2)); p.pos.y = g.world.heightAt(p.pos.x, p.pos.z); p.yaw = sp.yaw; p.pitch = 0.08;
  __adv(20);
});
await shot('10-duvar-lekeleri');
// vurulan oyuncu: bir bot hedef (ölümsüz), atıcılar ona sıkar; oyuncu yakından bakar
await page.evaluate(() => {
  const g = window.__game, p = g.playerSoldier, sp = window.__spot, fx = -Math.sin(sp.yaw), fz = -Math.cos(sp.yaw);
  const tgt = g.soldiers.filter((s) => s !== p && !__shooters.includes(s.id))[0];
  const tx = sp.x + fx * (sp.t - 1.6), tz = sp.z + fz * (sp.t - 1.6);
  tgt.vacant = false; tgt.spawn({ x: tx, z: tz, ry: sp.yaw + Math.PI }, 0); tgt.pos.y = g.world.heightAt(tx, tz); __give(tgt, ['pbrifle', 'pbpistol']); tgt.protT = 0;
  tgt.takeDamage = function () {};                                  // görüntü için ölmesin
  const E = (s) => s.eye();
  for (let i = 0; i < 26; i++) {
    for (const id of __shooters) {
      const s = g.soldiers[id], e = E(s), dx = tgt.pos.x - e.x, dz = tgt.pos.z - e.z, h = Math.hypot(dx, dz), ty = tgt.pos.y + 0.5 + Math.random() * 1.2;
      s.yaw = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 0.06; s.pitch = Math.atan2(ty - e.y, h) + 0.002 * h; s.cd = 0; s.items[0].mag = 50; s.tryFire();
    }
    for (let k = 0; k < 6; k++) g.step(1 / 60);
  }
  __adv(40);
  p.pos.set(tx - fx * 2.4, 0, tz - fz * 2.4); p.pos.y = g.world.heightAt(p.pos.x, p.pos.z); p.yaw = sp.yaw; p.pitch = -0.08;
  for (const id of __shooters) { const s = g.soldiers[id]; s.alive = false; s.vacant = true; s.pos.x += 900; s.model.root.visible = false; }
  tgt.yaw = sp.yaw + Math.PI - 0.5;
  __adv(20);
  window.__marks = tgt._pbMarks?.length || 0;
});
await shot('11-boyali-oyuncu');
console.log('hedefteki leke:', await page.evaluate(() => window.__marks));

// yük: 8 bot paintball ölüm maçı, gerçek zamanlı, FPS + çizim çağrısı (paint açık / kapalı fark)
const perf = await page.evaluate(async () => {
  const g = window.__game, p = g.playerSoldier;
  location.hash = '';
  for (const s of g.soldiers) if (s !== p) { s.vacant = false; if (!s.alive) g.respawn(s); }
  for (const b of g.brains) delete b.update;                       // beyinler eski haline (prototip yöntemi)
  const arm = (s) => { if (s !== p && s.items[0].id !== 'pbrifle') { s.items = [{ id: 'pbrifle', mag: 50, reserve: 150 }, { id: 'pbpistol', mag: 12, reserve: 48 }, { id: 'knife', mag: 1, reserve: 0 }]; s.cur = 0; s._syncWeaponModel(true); } };
  g.soldiers.forEach(arm); g.on('spawn', arm);
  p.pos.set(window.__spot.x, 0, window.__spot.z); p.pos.y = g.world.heightAt(p.pos.x, p.pos.z);
  g.simulate = true;
  await new Promise((r) => setTimeout(r, 8000));
  const r = g.renderer, info = r.info; info.autoReset = false;
  const measure = (ms) => new Promise((res) => {                    // kare başına toplam çizim çağrısı (sahne + silah modeli) ve FPS
    const t0 = performance.now(); let fr = 0, calls = 0, tris = 0;
    const f = () => { if (fr) { calls += info.render.calls; tris += info.render.triangles; } info.reset(); fr++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res({ fps: +((fr - 1) / ((performance.now() - t0) / 1000)).toFixed(1), calls: Math.round(calls / (fr - 1)), tris: Math.round(tris / (fr - 1)) }); };
    requestAnimationFrame(f);
  });
  const on = await measure(4000);
  const P0 = g.paint, ms = [P0.balls, P0.splats, P0.marks, P0.drops]; ms.forEach((m) => (m.visible = false));
  const off = await measure(2000); ms.forEach((m) => (m.visible = true));
  info.autoReset = true;
  const P = g.paint;
  return { on, off, live: P.live.length, splats: Math.min(P.splatN, 400), marks: P.markSlots.filter((m) => m.s).length, drops: P.dn, fired: P.stats.fired, hits: P.stats.hits };
});
console.log(`yük (${GPU ? 'GPU' : 'swiftshader'}, 1280x720):`, JSON.stringify(perf));
await shot('12-yuk-8-bot');
// modellerin kendisi (görüntüleyici; hazne / tüp varsayılan turuncu)
await page.close();
for (const [id, yaw] of [['pbrifle', 0], ['pbrifle', 2.6], ['pbpistol', 0]]) {
  const v = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  await v.goto(`${BASE}/viewer.html?view=weapon&id=${id}&yaw=${yaw}`, { timeout: 90000 }); await v.waitForTimeout(3000);
  await v.screenshot({ path: `${OUT}/00-model-${id}-${yaw}.png` }); await v.close(); console.log('görüntü model', id, yaw);
}
console.log('hata:', errs.length, errs.slice(0, 5));
await browser.close();
