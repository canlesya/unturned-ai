// 12.188 tank nişanı oyuncu gözüyle (önce / sonra): artı 80 / 130 m'deki yan yana iki düşmanın gövdesinde → mermi nereye düşer, ölür mü. OUT=/tmp/wb-qa6/sonra-patlama node scripts/tankaimview.mjs
// Oyuncu gözüyle: tank takip kamerası, 80 m'de yan yana iki düşman; artı (ekran ortası) düşmanın gövdesinde → nişangâh nerede, mermi nereye düşer
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5196', OUT = process.env.OUT || '/tmp/wb-qa6/once', MODE = process.env.MODE || 'cross';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1500);
const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true; const ex = g.explode.bind(g); g._booms = []; g.explode = (p, ...a) => { g._booms.push([+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]); return ex(p, ...a); }; });
await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-T1'); me.pos.set(v.st.x + 2.6, v.st.y, v.st.z); g.world.settle(me); V.toggle(me); v.st.x = 10; v.st.z = 715; v.st.y = g.world.heightAt(10, 715); v.st.yaw = -Math.PI / 2; v.st.tyaw = -Math.PI / 2; v.st.vx = v.st.vz = 0; g.player.vehCam = 'third'; me.yaw = -Math.PI / 2; me.pitch = 0; });
const res = [];
for (const [k, R] of [[0, 80], [1, 130]]) {
  const r = await ev(async ([R, MODE]) => {
    const g = window.__game, me = g.playerSoldier, v = me.veh;
    const reds = g.soldiers.filter((s) => s.team === 'red');
    const es = [reds[0], reds[1]];
    es.forEach((e, i) => { e.vacant = false; e.spawn({ x: 10 + R, z: 715 + (i ? 1.2 : -1.2), ry: Math.PI / 2 }, 0); g.world.settle(e); e.protT = 0; e.hp = 100; e.maxHp = 100; });
    // artı: kamera ışını e1 gövdesinden geçsin (takip kamerası bakış = nişan)
    const c = es[0].center();
    for (let it = 0; it < 30; it++) {
      await new Promise((r) => requestAnimationFrame(r));
      const cam = g.camera.position, dx = c.x - cam.x, dy = c.y - cam.y, dz = c.z - cam.z;
      if (MODE === 'cross') { me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }
    }
    await new Promise((r) => setTimeout(r, 2500));
    for (let it = 0; it < 10; it++) { await new Promise((r) => requestAnimationFrame(r)); const cam = g.camera.position, dx = c.x - cam.x, dy = c.y - cam.y, dz = c.z - cam.z; if (MODE === 'cross') { me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz)); } }
    const el = document.getElementById('vhGun'), rb = el.getBoundingClientRect();
    v.rl = 0;
    return { pitch: me.pitch, ret: [Math.round(rb.left + rb.width / 2), Math.round(rb.top + rb.height / 2)], disp: el.style.display, ids: es.map((e) => e.id) };
  }, [R, MODE]);
  await page.screenshot({ path: `${OUT}/${k}-nisan-${R}m.png` });
  const n0 = await ev(() => window.__game._booms.length);
  await ev(() => { window.__game.player.fireHeld = true; }); await page.waitForTimeout(80); await ev(() => { window.__game.player.fireHeld = false; });
  await page.waitForTimeout(R / 150 * 1000 + 120);
  await page.screenshot({ path: `${OUT}/${k}-patlama-${R}m.png` });
  await page.waitForTimeout(600);
  const out = await ev(([ids, n0]) => { const g = window.__game, b = g._booms.slice(n0).slice(-1)[0]; return { boom: b, hp: ids.map((i) => (g.soldiers[i].alive ? Math.round(g.soldiers[i].hp) : 'ÖLDÜ')) }; }, [r.ids, n0]);
  res.push({ R, ...r, ...out });
  console.log(JSON.stringify({ R, ...r, ...out }));
}
console.log('errs', errs.length, errs.slice(0, 2));
await browser.close();
