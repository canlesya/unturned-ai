// 12.188 araç koltuklarının HUD görüntüleri (önce / sonra karşılaştırması):  URL=http://127.0.0.1:5196 OUT=/tmp/wb-qa6/hud/sonra node scripts/vehhudshots.mjs
// Koltuklar: tank sürücüsü (takip / kule gecikmesi / dürbün / yakınlaştırma), tank makinelisi, helikopter pilotu, kapı nişancısı, jip sürücüsü, jip yolcusu,
// telefon (Pixel 7) tank sürücüsü. Çevrimdışı, gerçek GPU (pencereli), sayfa hatası sayılır.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5196', OUT = process.env.OUT || '/tmp/wb-qa6/hud/sonra';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [];
async function open(ctxOpt = { viewport: { width: 1280, height: 720 } }, q = '') {
  const page = await (await browser.newContext(ctxOpt)).newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1${q}`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true;
    const reds = g.soldiers.filter((s) => s.team === 'red');
    [[350, -391.2], [350, -388.8], [352, -396]].forEach(([x, z], i) => { const e = reds[i]; e.vacant = false; e.spawn({ x, z, ry: Math.PI / 2 }, 0); g.world.settle(e); e.protT = 0; });
    window.__seat = (id, seat, x, z, yaw, opt = {}) => {
      const V = g.vehicles, me = g.playerSoldier, v = V.list.find((o) => o.id === id);
      if (me.veh) V.exit(me);
      if (!v.alive) V.trySpawn(v, true);
      v.st.x = x; v.st.z = z; v.st.y = opt.y ?? g.world.heightAt(x, z); v.st.yaw = yaw; if (v.def.turret) v.st.tyaw = yaw; v.st.vx = v.st.vy = v.st.vz = 0; v.sleep = false;
      if (opt.air) { v.st.air = true; v.st.rpm = 1; }
      me.pos.set(x + 3, g.world.heightAt(x + 3, z), z); g.world.settle(me);
      V.enter(me, v, seat); g.player.vehCam = opt.cam || 'third'; me.yaw = opt.look ?? yaw; me.pitch = opt.pitch ?? -0.02; me.ads = !!opt.ads;
    };
  });
  return page;
}
const shot = async (page, n, w = 1500) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('  ' + n); };
const page = await open();
const ev = (f, a) => page.evaluate(f, a);
const YE = -Math.PI / 2, TX = 292, HY = 26;
await ev(([YE, TX]) => window.__seat('B-T1', 0, TX, -390, YE, { pitch: -0.02 }), [YE, TX]); await shot(page, '01-tank-surucu-takip', 3500);
await ev(() => { const me = window.__game.playerSoldier; me.yaw += 1.1; }); await shot(page, '02-tank-kule-gecikmesi', 350);
await ev(([YE]) => { const me = window.__game.playerSoldier; me.yaw = YE; window.__game.player.vehCam = 'first'; }, [YE]); await shot(page, '03-tank-durbun', 2500);
await ev(() => { window.__game.playerSoldier.ads = true; }); await shot(page, '04-tank-durbun-yakin', 900);
await ev(() => { const g = window.__game; g.playerSoldier.ads = false; g.player.vehCam = 'third'; g.player.fireHeld = true; }); await page.waitForTimeout(90); await ev(() => { window.__game.player.fireHeld = false; }); await shot(page, '05-tank-dolum', 900);
await ev(([YE, TX]) => window.__seat('B-T1', 1, TX, -390, YE, { look: YE + 0.2, pitch: -0.03 }), [YE, TX]); await shot(page, '06-tank-makineli', 1500);
await ev(() => { window.__game.player.fireHeld = true; }); await shot(page, '07-tank-makineli-ates', 1800); await ev(() => { window.__game.player.fireHeld = false; });
await ev(([YE, TX]) => window.__seat('B-H1', 0, TX + 2, -404, YE, { pitch: -0.12 }), [YE, TX]); await shot(page, '08-heli-pilot', 3500);
await ev(() => { window.__game.player.fireHeld = true; }); await shot(page, '08b-heli-pilot-burun-topu', 700); await ev(() => { window.__game.player.fireHeld = false; });
await ev(() => { window.__game.playerSoldier.ads = true; }); await shot(page, '08c-heli-pilot-roket', 900); await ev(() => { window.__game.playerSoldier.ads = false; });
await ev(([YE, TX]) => window.__seat('B-H1', 1, TX + 2, -404, 0, { look: Math.PI / 2 + 0.2, pitch: -0.05 }), [YE, TX]); await shot(page, '09-heli-kapi-nisanci', 1500);
await ev(() => { window.__game.player.fireHeld = true; }); await shot(page, '10-heli-kapi-ates', 2500); await ev(() => { window.__game.player.fireHeld = false; });
await ev(([YE, TX]) => { window.__seat('B-H1', 1, TX + 2, -404, 0, { look: -Math.PI / 2, pitch: -0.05 }); }, [YE, TX]); await shot(page, '11-heli-kapi-yay-disi', 1200);
await ev(([YE, TX]) => window.__seat('B-J1', 0, TX + 4, -376, YE, {}), [YE, TX]); await shot(page, '12-jip-surucu', 1500);
await ev(([YE, TX]) => window.__seat('B-J1', 1, TX + 4, -376, YE, { look: YE + 0.15, pitch: -0.04 }), [YE, TX]); await shot(page, '13-jip-makineli', 1500);
await ev(() => { window.__game.player.fireHeld = true; }); await shot(page, '13b-jip-makineli-ates', 1500); await ev(() => { window.__game.player.fireHeld = false; });
await ev(([YE, TX]) => window.__seat('B-J1', 2, TX + 4, -376, YE, { look: YE + 0.4 }), [YE, TX]); await shot(page, '14-jip-yolcu', 1500);
// jip dışarıdan (makineli kundak): yanında yürüyen asker gözü
await ev(([YE, TX]) => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((o) => o.id === 'B-J1'); V.exit(me); const b = g.soldiers.find((s) => s.team === 'blue' && s !== me); b.vacant = false; b.spawn({ x: TX + 7, z: -376, ry: 0 }, 0); V.enter(b, v, 1); b.yaw = YE + 0.6; b.pitch = 0.1; me.pos.set(TX + 7.2, g.world.heightAt(TX + 7.2, -373.5), -373.5); g.world.settle(me); me.yaw = Math.atan2(-(TX + 4 - me.pos.x), -(-376 - me.pos.z)); me.pitch = -0.28; g.player.vehCam = 'third'; }, [YE, TX]);
await shot(page, '15-jip-disaridan-makineli', 1500);
await ev(([TX]) => { const g = window.__game, me = g.playerSoldier; me.pos.set(TX + 1, g.world.heightAt(TX + 1, -378.5), -378.5); g.world.settle(me); me.yaw = Math.atan2(-(TX + 4 - me.pos.x), -(-376 - me.pos.z)); me.pitch = -0.3; }, [TX]);
await shot(page, '16-jip-disaridan-2', 900);
await ev(([TX]) => { const g = window.__game, me = g.playerSoldier; const h = g.vehicles.list.find((o) => o.id === 'B-H1'); h.st.x = TX + 2; h.st.z = -404; h.st.yaw = -Math.PI / 2; me.pos.set(TX + 9, g.world.heightAt(TX + 9, -399), -399); g.world.settle(me); me.yaw = Math.atan2(-(TX + 2 - me.pos.x), -(-404 - me.pos.z)); me.pitch = -0.2; }, [TX]);
await shot(page, '17-heli-disaridan-silahlar', 1200);
await page.close();
// telefon (Pixel 7)
const mp = await open({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true }, '&touch=1');
await mp.evaluate(([YE]) => window.__seat('B-T1', 0, 292, -390, YE, { pitch: -0.02 }), [YE]);
await shot(mp, '20-telefon-tank', 3500);
await mp.evaluate(([YE]) => window.__seat('B-H1', 0, 294, -404, YE, { pitch: -0.12 }), [YE]);
await shot(mp, '21-telefon-heli-pilot', 2000);
{ const tap = async (k, ms = 400) => { const b = await mp.$(`#tc [data-b="${k}"]`); if (!b) return 'yok'; const r = await b.boundingBox(); if (!r) return 'gizli'; await mp.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); return 'ok'; };
  const rk0 = await mp.evaluate(() => window.__game.playerSoldier.veh.rk);
  const fb = await mp.$('#tc .fire'); const fr = fb && await fb.boundingBox();
  const ab = await (await mp.$('#tc [data-b="ads"]')).boundingBox(), cdp = await mp.context().newCDPSession(mp), pt = [{ x: ab.x + ab.width / 2, y: ab.y + ab.height / 2, id: 3 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }); await mp.waitForTimeout(900); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const rk1 = await mp.evaluate(() => [window.__game.playerSoldier.veh.rk, getComputedStyle(document.querySelector('#tc [data-b="ads"]')).display, document.querySelector('#tc [data-b="ads"]').className]);
  console.log('  telefon pilot: nişan butonu → roket', rk0, '→', JSON.stringify(rk1)); }
await mp.evaluate(([YE]) => window.__seat('B-J1', 1, 296, -376, YE, { look: YE + 0.15, pitch: -0.04 }), [YE]);
await shot(mp, '22-telefon-jip-makineli', 1500);
await browser.close();
console.log('sayfa hatası', errs.length, errs.slice(0, 3).join(' | '));
