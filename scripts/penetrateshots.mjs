// 12.164 Delip geçme — ÇEVRİMDIŞI ekran görüntüleri (gerçek oyun, yerel oyuncu): (1) iki düşman arka arkaya, atış öncesi;
// (2) delip geçen ama öldürmeyen atış: 2. hedefe isabette artının altında "DELİP GEÇTİ" + isabet işareti; (3) tek mermide çifte öldürme ("ÇİFTE · TEK MERMİ").
// Atıştan ~150 ms sonra sayfanın tüm CSS / WAAPI canlandırmaları ve oyun döngüsü dondurulup kare alınır.
//   node scripts/penetrateshots.mjs   env: BASE=http://127.0.0.1:8891 (dist/ sunan sunucu ya da vite) OUT=/tmp/wb-pen
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8891', OUT = process.env.OUT || '/tmp/wb-pen';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 }, locale: 'tr-TR' });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1&cls=sniper&tickets=999`);
await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier?.alive', null, { timeout: 90000 });
await wait(1500);
// botlar donuk; iki kırmızı bot oyuncunun önünde 22 / 24 m'de arka arkaya (Çöl Geçidi, T Spawn → Outside Long açıklığı)
const setup = (hp) => page.evaluate((hp) => {
  const g = window.__game, me = g.playerSoldier, V = me.pos.constructor;
  if (!g.brainsOff) g.brainsOff = g.brains.splice(0);
  g.devGod = true;
  const reds = g.soldiers.filter((s) => s.team === 'red');
  const A = [-65, 57], dx = 1, dz = 0, D = 20;                                   // penetratenet'in bulduğu temiz şerit
  me.pos.set(A[0], g.world.heightAt(A[0], A[1]), A[1]); me.vel.set(0, 0, 0); me.fly = false; g.world.settle(me);
  reds.forEach((s, k) => {
    const x = A[0] + dx * (D + k * 2), z = A[1] + dz * (D + k * 2);
    if (k > 1) { s.pos.set(-200, 0, -200); return; }
    if (!s.alive) g.respawn(s);
    s.pos.set(x, g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); s.yaw = -Math.PI / 2; s.hp = s.maxHp = hp; s.protT = 0; s.alive = true; s.crouching = s.prone = false; s.proneT = 0; s.height = 1.78; s.leanOff.set(0, 0, 0); s.ads = false;
  });
  me.items[0] = { id: 'sniper', mag: 5, reserve: 10 }; me.cur = 0; me.cd = 0; me.reloadT = 0; me.switchT = 0;
  g.player.breath.step = () => [0, 0];
  window.__aimY = hp > 1000 ? 1.05 : 1.62;                                   // gövde / kafa hizası (m, ayakta)
  const aim = () => { const B = reds[0], e = me.eye(new V()), c = new V(B.pos.x, B.pos.y + window.__aimY, B.pos.z); me.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); me.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z)) - me.recoilP; me.ads = true; };
  if (!window.__aimHook) { window.__aimHook = true; const up = g.player.update.bind(g.player); g.player.update = (dt) => { if (window.__aimOn) aim(); return up(dt); }; }
  window.__aimOn = true;
  window.__kf = [];
  if (!window.__srHook) { window.__srHook = true; const sr = g.shootRay.bind(g); g.shootRay = (sh, o, d, ...a) => { if (sh === me) window.__sr = { o: [o.x, o.y, o.z].map((v) => +v.toFixed(2)), d: [d.x, d.y, d.z].map((v) => +v.toFixed(4)), h: reds.slice(0, 2).map((s) => [s.alive, s.team, s.protT, g.hitSoldier(s, o, d, 300)]), w: g.world.raycast(o, d, 300, {}, 'wood')?.t, cam: !!a[2], sp: me.spreadNow(a[0]), og: me.onGround, adsT: me.adsT, bl: me.bloom, bx: me.botExtraSpread, ss: me.sinceShot, v: [me.vel.x, me.vel.z], cr: me.crouching, fs: me.firedSprinting }; return sr(sh, o, d, ...a); }; }
  if (!window.__kfHook) { window.__kfHook = true; const kk = g.killfx.kill.bind(g.killfx); g.killfx.kill = (...a) => { const r = kk(...a); window.__kf.push(g.killfx.nt.textContent); return r; }; const hh = g.killfx.hit.bind(g.killfx); g.killfx.hit = (e) => { window.__kf.push('hit:' + (e.pn || 0) + (e.dead ? 'x' : '')); return hh(e); }; }
  return reds.slice(0, 2).map((s) => [s.id, +s.pos.x.toFixed(1), +s.pos.z.toFixed(1)]);
}, hp);
const freeze = () => page.evaluate(() => { const g = window.__game; cancelAnimationFrame(g.raf); g._frozen = true; document.getAnimations().forEach((a) => a.pause()); });
const thaw = () => page.evaluate(() => { const g = window.__game; document.getAnimations().forEach((a) => a.play()); g.last = performance.now(); g.raf = requestAnimationFrame(g.loop); });
const fire = () => page.evaluate(() => { const p = window.__game.player; window.__lk = p.locked; p.locked = true; p.fireHeld = true; p.fireBuf = 0.15; setTimeout(() => (p.fireHeld = false), 120); });
const ready = () => page.waitForFunction(() => { const me = window.__game.playerSoldier; return me.adsT >= 0.999 && me.cd <= 0 && me.onGround; }, null, { timeout: 8000 }).catch(async () => console.log('      hazır değil', await page.evaluate(() => { const me = window.__game.playerSoldier; return JSON.stringify({ y: me.pos.y, og: me.onGround, fly: me.fly, vy: me.vel.y, adsT: me.adsT, cd: me.cd }); })));

// (1)+(2) delip geçen, öldürmeyen atış (can 5000)
console.log('hedefler', JSON.stringify(await setup(5000)));
await ready(); await wait(300);
await page.screenshot({ path: `${OUT}/off-1-oncesi.png` });
const hp0 = await page.evaluate(() => window.__game.soldiers.filter((s) => s.team === 'red').slice(0, 2).map((s) => s.hp));
await fire();
await page.waitForFunction(() => window.__kf.filter((t) => t.startsWith('hit:')).length >= 2, null, { timeout: 6000, polling: 16 }).catch(async () => console.log('      isabet gelmedi', await page.evaluate(() => JSON.stringify([window.__kf, window.__sr]))));
await wait(150); await freeze();                                              // etiket 0,1 sn'de tam görünür
await page.screenshot({ path: `${OUT}/off-2-delip-gecti.png` });
const r1 = await page.evaluate(() => ({ kf: window.__kf.slice(), pnt: document.querySelector('#kfx .pnt')?.textContent, op: getComputedStyle(document.querySelector('#kfx .pnt')).opacity, hp: window.__game.soldiers.filter((s) => s.team === 'red').slice(0, 2).map((s) => s.hp) }));
await thaw();

console.log('      ', JSON.stringify(r1), 'hasar', hp0.map((h, i) => +(h - r1.hp[i]).toFixed(1)).join(' / '));
check(r1.kf.includes('hit:0') && r1.kf.includes('hit:1'), 'iki isabet: ilk hedef pn=0, ikinci pn=1');
check(r1.pnt === 'DELİP GEÇTİ' && +r1.op > 0.5, 'artının altında "DELİP GEÇTİ" etiketi görünür');
check(Math.abs(hp0[0] - r1.hp[0] - 105) < 0.6 && Math.abs(hp0[1] - r1.hp[1] - 68.25) < 0.6, 'hasar 105 / 68 (M24 gövde, 2. hedef ×0,65)');

// (3) çifte öldürme (can 100, kafa hizası)
await wait(1500);
await setup(100);
await ready(); await wait(300);
await fire();
await page.waitForFunction(() => window.__kf.some((t) => /ÇİFTE/.test(t)), null, { timeout: 6000, polling: 16 }).catch(() => {});
await wait(480); await freeze();                                              // çağrı 0,34 sn'de tam görünür
await page.screenshot({ path: `${OUT}/off-3-cifte.png` });
const r2 = await page.evaluate(() => ({ kf: window.__kf.slice(), feed: [...document.querySelectorAll('#killfeed .kf')].slice(-2).map((d) => d.textContent + (d.innerHTML.includes('pni') ? ' [delme simgesi]' : '')) }));
await thaw();
console.log('      ', JSON.stringify(r2));
check(r2.kf.some((t) => /ÇİFTE · TEK MERMİ/.test(t)), 'çifte öldürme çağrısı "ÇİFTE · TEK MERMİ ×2"');
check(r2.feed.some((t) => t.includes('[delme simgesi]')), 'öldürme akışında 2. öldürmede delme simgesi');
check(errs.length === 0, 'sayfa hatası yok ' + (errs[0] || ''));
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
