// 12.204 arazi motosikleti GERÇEK GPU görüntüleri (çevrimdışı Kuzey Ele Geçirme) + tarayıcı denetimleri.
//   URL=http://127.0.0.1:5196 OUT=/tmp/wb-moto node scripts/motoshots.mjs
// 01–03 model yakın planı (boş / binicili), 04 üste motorlar, 05–07 üçüncü şahıs sürüş + dönüşte yatma (yandan), 08–09 arka yolcu ateşi (1. şahıs +
// dışarıdan), 10 devrilme, 11 bot motorla gidiyor, 12–13 telefon (bin butonu + joystick ile sürüş). Sayfa hatası 0.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5196', OUT = process.env.OUT || '/tmp/wb-moto';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });

// ── masaüstü ──
{
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'tr-TR' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) console.log('  (yanıt ' + r.status() + ': ' + r.url() + ')'); });
  await page.goto(`${URL0}/?autostart=8v8&map=kuzey&type=conquest&tod=day&weather=clear&debug=1&nolock=1&nologin=1&devMode=0`);
  await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async (n, w = 350) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('  görüntü', `${OUT}/${n}.png`); };
  // serbest kamera: g._cam = { p, t, fov } (Game.render öncesi) · ya da { v, off: [geri, yan, yukarı, bakış ileri] } araç kovalar
  await ev(() => {
    const g = window.__game, c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
    g.brainsOff = g.brains.splice(0); g.devGod = true;
    const vmR = g.player.vm.render.bind(g.player.vm); g.player.vm.render = (...a) => { if (!g._cam) vmR(...a); };      // serbest kamerada silah modeli çizilmez
    P.render = function () {
      const k = this._cam;
      if (k?.v?.st) {
        const st = k.v.st, fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw), [back, side, up, look] = k.off;
        c.position.set(st.x - fx * back + rx * side, st.y + up, st.z - fz * back + rz * side);
        c.lookAt(st.x + fx * look, st.y + (k.ly ?? 0.8), st.z + fz * look); c.fov = k.fov || 50; c.updateProjectionMatrix();
      } else if (k?.p) { c.position.set(...k.p); c.lookAt(...k.t); c.fov = k.fov || 50; c.updateProjectionMatrix(); }
      orig.call(this);
    };
  });
  const hud = (on) => ev((on) => { const g = window.__game; g.hud.root.style.display = on ? '' : 'none'; }, on);
  const camOff = () => ev(() => { window.__game._cam = null; });
  // 01–02 model yakın planı (boş motor, üste)
  await hud(false);
  await ev(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-M1'), me = g.playerSoldier; me.pos.set(160, g.world.heightAt(160, 700), 700); g._cam = { v, off: [-2.6, 2.4, 1.25, 0], ly: 0.6, fov: 42 }; });
  await shot('01-model-yakin-on', 900);
  await ev(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-M1'); g._cam = { v, off: [2.9, -1.9, 1.5, 0], ly: 0.6, fov: 42 }; });
  await shot('02-model-yakin-arka');
  // 03 binicili (oyuncu sürücü + bot arka yolcu), 3. şahıs gövde görünür
  const r3 = await ev(() => {
    const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-M1');
    me.fly = false; me.pos.set(v.st.x + 1.2, v.st.y, v.st.z); g.world.settle(me); V.toggle(me);
    const b = g.soldiers.find((s) => s.team === 'blue' && s !== me && s.brain); b.spawn({ x: v.st.x - 1.5, z: v.st.z, ry: 0 }, 0); V.enter(b, v, 1);
    g.player.vehCam = 'third';
    g._cam = { v, off: [-1.2, 3.2, 1.35, 0], ly: 0.95, fov: 42 };
    return { seat: me.seat, pas: b.seat, veh: me.veh?.id };
  });
  ok(r3.veh === 'B-M1' && r3.seat === 0 && r3.pas === 1, 'tarayıcı: oyuncu motoru sürer, bot arka koltukta', JSON.stringify(r3));
  await shot('03-binici-poz-yandan', 700);
  // 04 Mavi üs motorları (kapı yanı)
  await ev(() => { const g = window.__game, y = g.world.heightAt(132, 642); g._cam = { p: [118, y + 7, 628], t: [132, y + 0.4, 642], fov: 45 }; });
  await shot('04-us-motorlar', 600);
  await ev(() => { const g = window.__game, y = g.world.heightAt(-132, -642); g._cam = { p: [-118, y + 7, -628], t: [-132, y + 0.4, -642], fov: 45 }; });
  await shot('04b-kirmizi-us-motorlar', 900);
  // 05–07 sürüş: takip kamerası (oyuncunun kendi kamerası) — düz yol, sonra dönüş (yatma)
  await camOff(); await hud(true);
  // Kuzey'in en uzun düz yolu R13 (Kırmızı üs kapısı → Kavşak yönü)
  await ev(() => { const g = window.__game, me = g.playerSoldier, v = me.veh, yaw = Math.atan2(-79, -359); v.st.x = -103; v.st.z = -606; v.st.y = g.world.heightAt(-103, -606); v.st.yaw = yaw; v.st.vx = v.st.vz = 0; me.yaw = yaw; me.pitch = -0.12; window._yaw = yaw; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3200);
  await shot('05-surus-takip', 0);
  const sp5 = await ev(() => { const g = window.__game, v = g.playerSoldier.veh; return Math.hypot(v.st.vx, v.st.vz) * 3.6; });
  await page.keyboard.down('KeyA'); await page.waitForTimeout(700);
  await shot('06-donuste-yatma-takip', 0);
  const lean = await ev(() => { const g = window.__game, it = g.vehView.items[g.playerSoldier.veh.idx]; return { lean: +it.lean.toFixed(2), z: +it.model.rotation.z.toFixed(2) }; });
  ok(lean.lean > 0.2, 'tarayıcı: sola dönüşte motor sola yatar (görsel)', JSON.stringify(lean) + ` · hız ${Math.round(sp5)} km/s`);
  await hud(false);
  await ev(() => { const g = window.__game, v = g.playerSoldier.veh; g._cam = { v, off: [-0.5, -6.5, 1.6, 0], ly: 0.9, fov: 45 }; });
  await page.waitForTimeout(400); await shot('07-donuste-yatma-yandan', 0);
  await page.keyboard.up('KeyA'); await page.keyboard.up('KeyW');
  await page.keyboard.down('Space'); await page.waitForTimeout(2200); await page.keyboard.up('Space');
  // 08–09 arka yolcu ateşi: oyuncu arka koltukta (2), bot sürücü (beyin donuk: koltukta kalır), düşman hedef
  const r8 = await ev(() => {
    const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = me.veh, b = v.seats[1];
    V.exit(b); V.seatTo(me, 1); V.enter(b, v, 0);
    b.brain.vd = { state: 'hold', kind: 'moto', t: 0, inp: {} };                  // donuk bot sürücü (koltukta kalsın)
    const red = g.soldiers.find((s) => s.team === 'red'); red.spawn({ x: v.st.x + Math.cos(v.st.yaw) * 14, z: v.st.z - Math.sin(v.st.yaw) * 14, ry: 0 }, 0); g.world.settle(red); red.protT = 0; red.hp = 100;
    const dx = red.pos.x - me.pos.x, dz = red.pos.z - me.pos.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = -0.02;
    window._red = red;
    return { seat: me.seat, drv: v.seats[0] === b };
  });
  await hud(true); await camOff();
  const mag0 = await ev(() => window.__game.playerSoldier.item.mag);
  await page.mouse.move(800, 450); await page.mouse.down(); await page.waitForTimeout(260);
  await shot('08-arka-yolcu-ates', 0);
  await page.waitForTimeout(500); await page.mouse.up();
  const r9 = await ev(() => { const g = window.__game, me = g.playerSoldier; return { mag: me.item.mag, red: Math.round(window._red.hp), alive: window._red.alive }; });
  ok(r8.seat === 1 && r8.drv && r9.mag < mag0, 'tarayıcı: arka yolcu (2) kendi silahıyla ateş eder', `şarjör ${mag0} → ${r9.mag} · hedef ${r9.alive ? r9.red + ' can' : 'öldü'}`);
  await hud(false);
  // dışarıdan: oyuncu sürücü, bot arka yolcu düşmana kendi tüfeğiyle ateş eder
  const r9b = await ev(() => {
    const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = me.veh, b = v.seats[0];
    V.exit(b); b.brain.vd = null; V.seatTo(me, 0); V.enter(b, v, 1);
    const red = window._red, dx = red.pos.x - b.pos.x, dz = red.pos.z - b.pos.z; b.yaw = Math.atan2(-dx, -dz); b.pitch = 0; b.reloadT = 0;
    g._cam = { v, off: [1.6, -3.6, 1.6, -0.4], ly: 1.1, fov: 45 };
    window._fireT = setInterval(() => { b.tryFire(); }, 50);
    return { pas: b.seat, mag: b.item.mag };
  });
  await page.waitForTimeout(450); await shot('09-arka-yolcu-disaridan', 0);
  const r9c = await ev(() => { clearInterval(window._fireT); const v = window.__game.playerSoldier.veh; return v.seats[1].item.mag; });
  ok(r9b.pas === 1 && r9c < r9b.mag, 'tarayıcı: bot arka yolcu da kendi silahıyla ateş eder (dışarıdan görüntü)', `${r9b.mag} → ${r9c}`);
  // 10 devrilme (sert kaza): üs duvarına
  const r10 = await ev(() => {
    const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = me.veh;
    for (const o of V.occupants(v)) V.exit(o);
    const st = v.st; st.x = 60; st.z = 642; st.y = g.world.heightAt(60, 642); st.yaw = 0; st.vx = 0; st.vz = -22; st.fall = 0; v.sleep = false;
    me.pos.set(st.x + 1.2, st.y, st.z); V.enter(me, v, 0);
    g._cam = { p: [66, st.y + 3, 634], t: [60, st.y + 0.5, 629], fov: 50 };
    return true;
  });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  const r10b = await ev(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-M1'); return { fallK: v.st.fallK, fall: +(v.st.fall || 0).toFixed(2), me: g.playerSoldier.veh?.id || null, hp: Math.round(g.playerSoldier.hp) }; });
  await shot('10-devrilme-kaza', 50);
  ok(r10 && Math.abs(r10b.fallK) === 2 && !r10b.me, 'tarayıcı: duvara sert kazada sürücü savrulur, motor yere yatar', JSON.stringify(r10b));
  // 11 bot motorla gidiyor (botlar açık; Mavi botlar üsten uzak bayrağa)
  await ev(() => { const g = window.__game, me = g.playerSoldier; g.brains = g.brainsOff; g.brainsOff = null; g.showSelf = false; me.pos.set(160, g.world.heightAt(160, 760) + 40, 760); me.fly = true; g._cam = null;
    for (const b of g.brains) if (b.s.team === 'blue' && b.s.alive && !b.s.veh) { b.s.pos.set(130 + Math.random() * 12, 0, 652 + Math.random() * 6); g.world.settle(b.s); } });
  let bot = null; const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    bot = await ev(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.def.moto && x.seats[0]?.brain?.vd?.state === 'drive' && Math.hypot(x.st.vx, x.st.vz) > 8); return v ? { i: v.idx, id: v.id, sp: Math.round(Math.hypot(v.st.vx, v.st.vz) * 3.6), occ: v.seats.filter(Boolean).length } : null; });
    if (bot) break; await page.waitForTimeout(1000);
  }
  ok(!!bot, 'tarayıcı: bot motorla uzak bayrağa gidiyor', bot ? JSON.stringify(bot) : 'bulunamadı');
  if (bot) { await ev((i) => { const g = window.__game; g._cam = { v: g.vehicles.list[i], off: [6.5, 2.2, 2.6, 6], ly: 0.9, fov: 50 }; }, bot.i); await page.waitForTimeout(2500); await shot('11-bot-motorla', 0); }
  // 14 öldürme akışı: motorla düşmana çarpma → akışta motor simgesi
  const kf = await ev(async () => {
    const g = window.__game, V = g.vehicles, me = g.playerSoldier;
    g.brainsOff = g.brains.splice(0); g._cam = null; me.fly = false; g.hud.root.style.display = '';
    const v = V.list.find((x) => x.id === 'B-M3' && x.alive) || V.list.find((x) => x.def.moto && x.alive && !x.seats.some(Boolean));
    if (me.veh) V.exit(me);
    for (const o of V.occupants(v)) V.exit(o);
    const st = v.st, yaw = Math.atan2(-79, -359); st.x = -103; st.z = -606; st.y = g.world.heightAt(-103, -606); st.yaw = yaw; v.sleep = false;
    me.pos.set(st.x + 1.2, st.y, st.z); V.enter(me, v, 0); me.yaw = yaw; me.pitch = -0.1;
    st.vx = -Math.sin(yaw) * 24; st.vz = -Math.cos(yaw) * 24;
    const red = g.soldiers.find((s) => s.team === 'red' && s.alive) || g.soldiers.find((s) => s.team === 'red'); red.spawn({ x: st.x - Math.sin(yaw) * 26, z: st.z - Math.cos(yaw) * 26, ry: 0 }, 0); g.world.settle(red); red.protT = 0; red.hp = 100;
    window._kfRed = red;
    return red.name;
  });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW');
  const kfr = await ev(() => { const f = document.getElementById('killfeed'), last = f?.lastElementChild; return { dead: !window._kfRed.alive, html: last ? last.innerHTML : '', txt: last ? last.textContent : '' }; });
  await page.screenshot({ path: `${OUT}/14-oldurme-akisi-motor.png`, clip: { x: 1100, y: 0, width: 500, height: 260 } });
  ok(kfr.dead && /viewBox="0 0 16 16"><circle cx="3.6"/.test(kfr.html) && /Motor/.test(kfr.txt), 'tarayıcı: motorla çarpılan düşman ölür, öldürme akışında motor simgesi + "Motor"', kfr.txt);
  ok(!errs.length, 'tarayıcı (masaüstü): sayfa hatası yok', errs.slice(0, 3).join(' | '));
  await page.context().close();
}

// ── telefon (Pixel 7 profili): bin butonu, joystick ile sürüş ──
{
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', locale: 'tr-TR' });
  const mp = await ctx.newPage(); const merr = []; mp.on('pageerror', (e) => merr.push(e.message));
  await mp.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=day&weather=clear&debug=1&nolock=1&nologin=1&touch=1`);
  await mp.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  await mp.waitForTimeout(1500);
  await mp.evaluate(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-M3'); g.brainsOff = g.brains.splice(0); me.fly = false; me.pos.set(v.st.x + 1.3, v.st.y, v.st.z + 0.6); g.world.settle(me); me.yaw = Math.PI / 2 + 0.3; me.pitch = -0.25; });
  await mp.waitForTimeout(600);
  const btn = await mp.evaluate(() => { const b = document.querySelector('#tc [data-b="veh"]'); return b && !b.classList.contains('hid') ? b.getBoundingClientRect().toJSON() : null; });
  const prompt = await mp.evaluate(() => document.getElementById('vhPrompt')?.textContent || '');
  await mp.screenshot({ path: `${OUT}/12-mobil-yaninda.png` });
  if (btn) await mp.touchscreen.tap(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await mp.waitForTimeout(500);
  const inV = await mp.evaluate(() => { const g = window.__game, me = g.playerSoldier; if (me.veh) { me.yaw = me.veh.st.yaw; me.pitch = -0.15; } return me.veh?.id; });
  // joystick: CDP dokunma sürüklemesi (ileri + biraz sağ)
  const cdp = await ctx.newCDPSession(mp);
  const jz = await mp.evaluate(() => { const e = document.querySelector('#tc .jb'); if (e) { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; } return { x: innerWidth * 0.16, y: innerHeight * 0.72 }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jz.x, y: jz.y, id: 1 }] });
  for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jz.x + k * 0.5, y: jz.y - k * 11, id: 1 }] }); await mp.waitForTimeout(30); }
  await mp.waitForTimeout(2600);
  const drv = await mp.evaluate(() => { const g = window.__game, v = g.playerSoldier.veh, T = g.player.touch; return v ? { sp: Math.round(Math.hypot(v.st.vx, v.st.vz) * 3.6), d: Math.round(Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z)), f: T.f, r: T.r, hud: document.querySelector('#vhPanel .nm')?.textContent } : null; });
  await mp.screenshot({ path: `${OUT}/13-mobil-surus.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(btn && /MOTOR/i.test(prompt) && inV === 'B-M3', 'telefon: motor yanında "bin" butonu + ipucu, dokununca sürücü', `${prompt} · ${inV}`);
  ok(drv && drv.sp > 20 && drv.d > 10, 'telefon: joystick ile sürüş (gaz + direksiyon)', JSON.stringify(drv));
  ok(!merr.length, 'telefon: sayfa hatası yok', merr.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} HATA` : '\nhepsi OK');
process.exit(fails ? 1 : 0);
