// 12.213 sabit yuvalar ÇEVRİM İÇİ: URL=http://127.0.0.1:5200 SRV=ws://127.0.0.1:8992 node scripts/emponline.mjs (yerel debug sunucu: BF_DEBUG=1)
// A (Mavi) Kavşak mevzisindeki ağır makineliye E ile geçer (sunucu koltuğa alır), silah bakışla döner (sunucu yaw'ı), 35 m önündeki düşmanı vurur;
// sonra tanksavara geçer, 70 m önündeki düşman tankına füze atar (sunucu 'ts' w 2, isabet tankın canını düşürür).
import { chromium } from 'playwright';
const URL0 = process.env.URL || 'http://127.0.0.1:5200', SRV = process.env.SRV || 'ws://127.0.0.1:8992', OUT = process.env.OUT || '/tmp/wb-tower';
const fails = [], ok = (c, m, d = '') => { if (!c) fails.push(m); console.log((c ? 'OK  ' : 'HATA') + ' ' + m + (d ? ' · ' + d : '')); };
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const A = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
const errs = []; A.on('pageerror', (e) => errs.push(e.message));
await A.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(SRV)}&map=kuzey&type=conquest&per=4&team=blue&debug=1&nolock=1&nologin=1`);
await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
await A.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
await A.waitForTimeout(1200);
const E = await A.evaluate(() => window.__game.vehicles.list.filter((v) => v.def.fixed).map((v) => ({ id: v.id, x: v.st?.x, z: v.st?.z, base: v.st?.base, alive: v.alive })));
ok(E.length === 15 && E.every((e) => e.alive), `istemcide ${E.length} yuva (anlık görüntüden canlı)`);
const hm = E.find((e) => e.id === 'Y-C-hmg--11');
await A.evaluate((h) => window.__game.online.send({ t: 'dbg', tp: [h.x + Math.sin(h.base) * 1.6, h.z + Math.cos(h.base) * 1.6] }), hm);
await A.waitForTimeout(1500);
await A.keyboard.press('KeyE'); await A.waitForTimeout(1000);
const st = await A.evaluate(() => { const me = window.__game.playerSoldier; return [me.veh?.id, me.seat]; });
ok(st[0] === 'Y-C-hmg--11' && st[1] === 0, 'E ile ağır makinelinin başına geçti (sunucu koltuğu)', JSON.stringify(st));
const foe = await A.evaluate((h) => { const g = window.__game, r = g.soldiers.find((s) => s.team === 'red' && s.alive); const X = h.x - Math.sin(h.base) * 35 + Math.cos(h.base) * 6, Z = h.z - Math.cos(h.base) * 35 - Math.sin(h.base) * 6; g.online.send({ t: 'dbg', tps: [r.id, X, Z, 0, 100] }); return r.id; }, hm);
await A.waitForTimeout(900);
const mg = await A.evaluate(async (id) => {
  const g = window.__game, me = g.playerSoldier, T = g.soldiers[id], v = me.veh, y0 = v.st.yaw;
  const aim = () => { const e = me.eye(), c = T.center(), dx = c.x - e.x, dz = c.z - e.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(c.y - e.y, Math.hypot(dx, dz)); };
  const i2 = setInterval(aim, 8); aim(); await new Promise((r) => setTimeout(r, 500)); g.player.fireHeld = true;
  await new Promise((r) => setTimeout(r, 1300)); g.player.fireHeld = false; clearInterval(i2);
  await new Promise((r) => setTimeout(r, 500));
  return { hp: T.hp, alive: T.alive, dyaw: +(v.st.yaw - y0).toFixed(3), heat: +(me.vheat || 0).toFixed(2), kf: [...document.querySelectorAll('#killfeed div, .kf div')].map((e) => e.textContent).slice(-2) };
}, foe);
ok(!mg.alive || mg.hp < 100, 'çevrim içi ağır makineli: 35 m\'deki düşmanı vurur (hasar sunucuda)', JSON.stringify(mg));
await A.screenshot({ path: `${OUT}/7-cevrimici-hmg.png` });
await A.keyboard.press('KeyE'); await A.waitForTimeout(800);
// tanksavar + tank
const at = E.find((e) => e.id === 'Y-C-atgm-12');
await A.evaluate((h) => window.__game.online.send({ t: 'dbg', tp: [h.x + Math.sin(h.base) * 1.8, h.z + Math.cos(h.base) * 1.8] }), at);
await A.waitForTimeout(1500);
const ti = await A.evaluate((h) => { const g = window.__game, t = g.vehicles.list.find((v) => v.id === 'R-T1'); const X = h.x - Math.sin(h.base) * 70, Z = h.z - Math.cos(h.base) * 70; g.online.send({ t: 'dbg', vtp: [X, Z, h.base + Math.PI, t.idx] }); return t.idx; }, at);      // yayadayken (koltuktayken vtp kendi aracını taşır); tank yuvaya bakar
await A.waitForTimeout(1200);
await A.keyboard.press('KeyE'); await A.waitForTimeout(1000);
const st2 = await A.evaluate(() => { const me = window.__game.playerSoldier; return [me.veh?.id, me.seat]; });
ok(st2[0] === 'Y-C-atgm-12', 'E ile tanksavarın başına geçti', JSON.stringify(st2));
await A.waitForTimeout(1500);
const fr = await A.evaluate(async (ti) => {
  const g = window.__game, me = g.playerSoldier, T = g.vehicles.list[ti], hp0 = T.hp;
  const aim = () => { const e = me.eye(), dx = T.st.x - e.x, dz = T.st.z - e.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(T.st.y + 1.2 - e.y, Math.hypot(dx, dz)); };
  const i2 = setInterval(aim, 8); aim(); await new Promise((r) => setTimeout(r, 600));
  let ts = 0; const h = (e) => { const m = JSON.parse(e.data); if (m.t === 'ev' && m.l.some((x) => x.e === 'ts' && x.w === 2)) ts++; }; g.online.ws.addEventListener('message', h);
  g.player.fireHeld = true; await new Promise((r) => setTimeout(r, 150)); g.player.fireHeld = false;
  await new Promise((r) => setTimeout(r, 1500)); clearInterval(i2);
  return { ts, hp0, hp: T.hp, rl: me.veh?.rl };
}, ti);
ok(fr.ts >= 1 && fr.hp < fr.hp0, 'çevrim içi tanksavar: sunucu füzeyi atar (ts w 2), tankın canı düşer, dolum istemcide görünür', JSON.stringify(fr));
await A.screenshot({ path: `${OUT}/8-cevrimici-tanksavar.png` });
if (errs.length) console.log('sayfa hataları:', errs.slice(0, 5));
await browser.close();
console.log(fails.length ? `SONUÇ: ${fails.length} HATA` : 'SONUÇ: OK');
process.exit(fails.length ? 1 : 0);
