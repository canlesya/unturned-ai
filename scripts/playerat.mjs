// 12.208 OYUNCU tanksavar ölçümü (GERÇEK GPU, headless:false, --use-angle=metal; Kuzey Vadisi çevrimdışı). Oyuncu gerçek girdiyle (fare / klavye)
// donanımını kullanır; karşıda içinde (beynsiz, hareketsiz) sürücü olan düşman tankı. Ölçülen: atış sayısı, isabet, hasar, patlama süresi (ilk atıştan),
// donanım bitti mi. Sınıf / donanım gerçek yükleme kuralıyla (soldier.choice + setClass → makeLoadout).
//   URL=http://127.0.0.1:5192 OUT=/tmp/wb-def/at KITS="engineer:rpg:front,engineer:rpg:rear,assault:grenade:rear" node scripts/playerat.mjs
//   KIT biçimi sınıf:donanım:yön (front | rear | side | top). c4: oyuncu tankın dibine gider, yapıştırır, uzaklaşır. atmine: oyuncu tankın önüne kurar, tank üstünden geçer.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5192', OUT = process.env.OUT || '/tmp/wb-def/at';
const KITS = (process.env.KITS || 'engineer:rpg:front,engineer:rpg:rear,assault:grenade:rear').split(',').map((k) => k.split(':'));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&dev=1&debug=1&nolock=1&nologin=1&tod=day&weather=clear`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 240000 });
await page.waitForFunction(() => { const t = window.__game.vehicles.list.find((v) => v.id === 'R-T1'); return t && t.alive && t.st; }, null, { timeout: 120000 });
await page.waitForTimeout(3000);
// açık alan: tankın önünden / arkasından / yanından 45 m'de göz hizasından tank ortası görünüyor (yaprak dahil), zemin düz
const spot = await page.evaluate(() => {
  const g = window.__game, W = g.world, V3 = g.camera.position.constructor;
  for (let r = 0; r < 400; r += 20) for (let a = 0; a < 6.28; a += 0.5) {
    const X = 60 + Math.cos(a) * r, Z = 230 + Math.sin(a) * r, y = W.heightAt(X, Z);
    if (!g.nav.isFree(X, Z)) continue;
    const c = new V3(X, y + 1.2, Z);
    let ok = true;
    for (const [dx, dz] of [[0, -45], [0, 45], [45, 0], [0, -16], [0, 16]]) { const h = W.heightAt(X + dx, Z + dz); if (Math.abs(h - y) > 3 || !g.botSees(new V3(X + dx, h + 1.6, Z + dz), c)) { ok = false; break; } }
    if (ok) { window.__ATX = X; window.__ATZ = Z; return [Math.round(X), Math.round(Z)]; }
  }
  return null;
});
console.log('açık alan', spot);
await page.mouse.move(640, 380);                                             // fare bir kez ortaya (nolock'ta fare hareketi bakışı çevirir)
await page.waitForTimeout(300);
const results = [];
for (const [cls, gad, side] of KITS) {
  const setup = await page.evaluate(({ cls, gad, side }) => {
    const g = window.__game, V = g.vehicles, me = g.playerSoldier;
    g.devGod = true; me.fly = false;
    const X = +(window.__ATX ?? 60), Z = +(window.__ATZ ?? 230);
    let tank = V.list.find((v) => v.id === 'R-T1');
    if (!tank.alive || !tank.st) { tank.respawnT = 0; tank.wreck = false; V.trySpawn(tank); }
    tank.hp = tank.def.hp;
    tank.st.x = X; tank.st.z = Z; tank.st.yaw = 0; tank.st.tyaw = 0; tank.st.vx = tank.st.vz = 0; tank.st.y = g.world.heightAt(X, Z); tank.sleep = false; tank.idleT = -1e9;
    let drv = tank.seats[0];
    if (!drv) { drv = g.soldiers.find((s) => s.team === 'red' && s.alive && !s.veh) || g.soldiers.find((s) => s.team === 'red'); if (!drv.alive) { drv.alive = true; drv.hp = 100; } V.enter(drv, tank, 0); }
    g.brains = g.brains.filter((b) => b.s.team === 'blue' && false);
    for (const s of g.soldiers) if (s !== drv && s !== me) { s.alive = false; s.vacant = true; if (s.model?.root) s.model.root.visible = false; }
    drv.brain = null;
    me.choice = { ...(me.choice || {}), gadget: gad }; me.setClass(cls); me.cur = 0;
    // konum: tankın önü (yaw 0 → ileri −z) / arkası / yanı; RPG 45 m, el bombası 18 m, C4 / mayın 12 m
    const R = gad === 'grenade' ? 16 : gad === 'c4' || gad === 'atmine' ? 12 : 45;
    const off = side === 'front' ? [0, -R] : side === 'side' ? [R, 0] : [0, R];
    me.pos.set(X + off[0], g.world.heightAt(X + off[0], Z + off[1]), Z + off[1]); me.vel.set(0, 0, 0);
    const dx = X - me.pos.x, dz = Z - me.pos.z;
    me.yaw = Math.atan2(-dx, -dz);
    const ty = tank.st.y + tank.def.top * (side === 'top' ? 1.0 : 0.45), ey = me.pos.y + 1.6;
    me.pitch = Math.atan2(ty - ey, Math.hypot(dx, dz)) + (gad === 'grenade' ? 0.1 : 0);
    if (g.player) { g.player.yaw = me.yaw; g.player.pitch = me.pitch; }
    const hits = [];
    window.__at = { hits, tank, me, t0: null, shots: 0, boomT: null };
    if (!V._atWrap) {
      V._atWrap = true;
      const d0 = V.damage.bind(V);
      V.damage = (v, a, by, kind, nm) => { const A = window.__at, h0 = v.hp; const r = d0(v, a, by, kind, nm); if (A && v === A.tank && by === A.me && h0 > v.hp) A.hits.push({ t: +(g.time - (A.t0 ?? g.time)).toFixed(2), nm, kind, d: Math.round(h0 - Math.max(0, v.hp)), hp: Math.round(Math.max(0, v.hp)), z: v._lastZone || '' }); if (A && v === A.tank && !v.alive && A.boomT == null) A.boomT = g.time; return r; };
      g.on('fire', (s) => { const A = window.__at; if (A && s === A.me) { A.shots++; if (A.t0 == null) A.t0 = g.time; } });
      g.on('throw', (s) => { const A = window.__at; if (A && s === A.me) { A.shots++; if (A.t0 == null) A.t0 = g.time; } });
    }
    const it = me.items[2];
    return { cls, gad, side, item: it ? { ...it } : null, tank: tank.hp, d: Math.round(Math.hypot(dx, dz)) };
  }, { cls, gad, side });
  await page.waitForTimeout(800);
  setup.at = await page.evaluate(() => { const A = window.__at, t = A.tank.st, m = A.me, g = window.__game, it = g.vehView?.items[A.tank.idx], M = it?.model; const mp = M && (M.root || M.group || M).position; return [Math.round(t.x), Math.round(t.z), Math.round(m.pos.x), Math.round(m.pos.z), mp ? [Math.round(mp.x), Math.round(mp.z)] : null, M ? Object.keys(M).slice(0, 6) : null, A.tank.idx, Math.round(g.camera.position.x), Math.round(g.camera.position.z), (M?.root || M?.group || M)?.visible]; });
  console.log('kurulum', JSON.stringify(setup));
  if (!setup.item || setup.item.id !== gad) { results.push({ ...setup, err: 'donanım yok (bu sınıfta seçilemiyor)' }); continue; }
  await page.keyboard.press('Digit4');
  await page.waitForTimeout(700);
  const tag = `${cls}-${gad}-${side}`;
  let shot = 0, idle = 0;
  for (let i = 0; i < 90; i++) {
    const s = await page.evaluate(() => { const A = window.__at, it = A.me.items[2]; return { alive: A.tank.alive, hp: Math.round(A.tank.hp), left: it.mag + it.reserve, cur: A.me.cur, n: A.hits.length, rl: A.me.reloadT > 0 || A.me.cd > 0.2 }; });
    if (!s.alive) break;
    if (s.left <= 0) { if (++idle > 8) break; await page.waitForTimeout(500); continue; }
    if (s.cur !== 2) { await page.keyboard.press('Digit4'); await page.waitForTimeout(600); continue; }
    if (s.rl) { await page.waitForTimeout(250); continue; }
    if (gad === 'c4') {
      // tankın dibine (gövdeye 1,5 m) yürüt (konumu doğrudan), yapıştır, 15 m geri çekil
      await page.evaluate((side) => { const A = window.__at, g = window.__game, t = A.tank.st, m = A.me; const f = side === 'front' ? -1 : 1, L = A.tank.def.hl + 1.0; m.pos.set(t.x, g.world.heightAt(t.x, t.z + f * L), t.z + f * L); m.yaw = side === 'front' ? Math.PI : 0; m.pitch = -0.3; if (g.player) { g.player.yaw = m.yaw; g.player.pitch = m.pitch; } }, side);
      await page.waitForTimeout(700);
      await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up();
      await page.waitForTimeout(1100);
      if (shot === 0) await page.screenshot({ path: `${OUT}/${tag}-yapisti.png` });
      shot++;
      const left = await page.evaluate(() => window.__at.me.items[2].mag);
      if (left <= 0) { await page.evaluate((side) => { const A = window.__at, g = window.__game, t = A.tank.st, m = A.me; const f = side === 'front' ? -1 : 1; m.pos.set(t.x, g.world.heightAt(t.x, t.z + f * 16), t.z + f * 16); m.yaw = side === 'front' ? Math.PI : 0; m.pitch = 0.02; if (g.player) { g.player.yaw = m.yaw; g.player.pitch = m.pitch; } }, side); await page.waitForTimeout(6500); }
      continue;
    }
    if (gad === 'atmine') {
      await page.evaluate(() => { const A = window.__at, g = window.__game, t = A.tank.st, m = A.me; const z = t.z - A.tank.def.hl - 6 - (A.mineN || 0) * 0.0; m.pos.set(t.x + (A.mineN || 0) * 0.6, g.world.heightAt(t.x, z), z); m.yaw = 0; m.pitch = -0.5; if (g.player) { g.player.yaw = m.yaw; g.player.pitch = m.pitch; } A.mineN = (A.mineN || 0) + 1; });
      await page.waitForTimeout(700);
      await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up();
      await page.waitForTimeout(1200);
      // oyuncu kenara çekilir, tank (sürücüsü) mayının üstünden 3 m/sn geçer
      await page.evaluate(() => { const A = window.__at, g = window.__game, t = A.tank.st, m = A.me; m.pos.set(t.x + 14, g.world.heightAt(t.x + 14, t.z - 8), t.z - 8); m.yaw = Math.PI / 2; m.pitch = -0.05; if (g.player) { g.player.yaw = m.yaw; g.player.pitch = m.pitch; } });
      if (shot === 0) await page.screenshot({ path: `${OUT}/${tag}-kuruldu.png` });
      for (let k = 0; k < 40; k++) {
        const done = await page.evaluate(() => { const A = window.__at, g = window.__game, t = A.tank.st; if (!A.tank.alive) return true; t.z -= 0.25; t.y = g.world.heightAt(t.x, t.z); A.tank.sleep = false; return false; });
        if (done) break;
        await page.waitForTimeout(60);
        if (k === 14) await page.screenshot({ path: `${OUT}/${tag}-patlama.png` });
      }
      await page.evaluate(() => { const A = window.__at, g = window.__game; if (A.tank.alive) { const t = A.tank.st; t.z += 10; t.y = g.world.heightAt(t.x, t.z); } });
      shot++;
      await page.waitForTimeout(600);
      continue;
    }
    // RPG / LAW / el bombası: ateşe bas (bombada basılı tut + bırak)
    await page.mouse.down(); await page.waitForTimeout(gad === 'grenade' ? 350 : 60); await page.mouse.up();
    shot++;
    await page.waitForTimeout(gad === 'grenade' ? 600 : 900);
    if (shot <= 4) await page.screenshot({ path: `${OUT}/${tag}-${String(shot).padStart(2, '0')}.png` });
    await page.waitForTimeout(gad === 'grenade' ? 5600 : 300);
  }
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => { const A = window.__at, g = window.__game; return { hits: A.hits, shots: A.shots, destroyed: !A.tank.alive, secs: A.boomT != null && A.t0 != null ? +(A.boomT - A.t0).toFixed(1) : null, hpLeft: Math.round(Math.max(0, A.tank.hp)), left: A.me.items[2].mag + A.me.items[2].reserve }; });
  await page.screenshot({ path: `${OUT}/${tag}-son${r.destroyed ? '-patladi' : ''}.png` });
  console.log(tag, JSON.stringify(r));
  results.push({ ...setup, ...r });
  await page.waitForTimeout(500);
}
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(results, null, 1));
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 5));
await browser.close();
