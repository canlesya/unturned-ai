// 12.177 araç (jip) denetimi — tek koşu:   node scripts/vehicletest.mjs
//   1) başsız (tarayıcısız, her zaman): kurulum, bin / in / sür / fren / koltuk, köprü, sığ geçit, derin su (batma), mermi / RPG hasarı, yanma +
//      patlama (içindeki ölür, öldürme yazılır), yeniden doğuş, yayaya çarpma (düşman ölür, takım arkadaşı yalnız itilir), gövdeden itme, savaş alanı
//      sınırı, bot yolcu (biner / iner), diğer haritalarda araç yok, adım maliyeti, ağ paketi.
//   2) tarayıcı çevrimdışı (URL erişilebilirse; vite): görüntüler → OUT/ (dışarıdan, sürücü içeriden / takip, yolcu, gece farları, hasarlı / yanan /
//      enkaz, su, telefon), sayfa hatası 0.
//   3) çevrim içi (SRV erişilebilirse; yerel debug sunucu: PORT=8941 ADMIN_PORT=8942 BF_DATA=/tmp/wb-x BF_DEBUG=1 node server/index.js): A sürer, B yolcu:
//      koltuklar, sürücü tahmin düzeltmesi, B'nin gördüğü araç ↔ A (gecikme kaydırmalı), bant genişliği (park ↔ sürüş), hareketli araçtan yolcu isabeti,
//      araç patlayınca iki istemcide enkaz + içindekiler ölür.
// Ortam: URL (http://127.0.0.1:5397) · SRV (ws://127.0.0.1:8941) · OUT (/tmp/wb-arac/jip) · ONLY=headless|browser|online
import { Game } from '../src/game/game.js';
import { VT } from '../src/sim/vehicle.js';
import fs from 'fs';

const URL0 = process.env.URL || 'http://127.0.0.1:5397', SRV = process.env.SRV || 'ws://127.0.0.1:8941', OUT = process.env.OUT || '/tmp/wb-arac/jip', ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2);

// ───────── 1) başsız ─────────
function headless() {
  console.log('── başsız ──');
  const mkG = (o = {}) => new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 4, type: 'conquest' }, ...o });
  const g = mkG(), V = g.vehicles;
  ok(V && V.list.length === 12 && V.list.filter((v) => v.alive).length === 6, 'kurulum: 12 jip doğuşu (6 üs + 6 bayrak), maç başında üslerdeki 6 jip hazır, bayrak jipleri bayrak alınınca', V ? `${V.list.length} / ${V.list.filter((v) => v.alive).length}` : 'yok');
  const others = [['kasaba', 'conquest'], ['colgecidi', 'tdm'], ['kuzey', 'tdm'], ['vadi', 'conquest']].map(([map, type]) => { const o = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 2, type } }); return map + '/' + type + ':' + (o.vehicles ? 'VAR' : 'yok'); });
  ok(others.every((s) => s.endsWith('yok')), 'diğer haritalar / Kuzey TDM: araç yöneticisi yok (davranış aynı)', others.join(' '));
  const s = g.claimSlot('blue', 'Test', 'assault', {}), h = g.humans.get(s.id);
  let q = 0;
  const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: 0, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...(typeof o === 'function' ? o(i) : o) }); g.step(1 / 60); } };
  const put = (v, x, z, yaw) => { v.st.x = x; v.st.z = z; v.st.y = g.world.heightAt(x, z); v.st.yaw = yaw; v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = false; v.st.sunk = false; v.sleep = false; };
  const v = V.list.find((x) => x.id === 'B-J1');
  s.pos.set(v.st.x + 2, v.st.y, v.st.z); s.protT = 0; step(2);
  ok(V.near(s)?.v === v && V.near(s).seat === 0, 'yanında: binilebilir araç = B-J1, sürücü koltuğu');
  step(1, { ve: 1 }); step(1);
  ok(s.veh === v && s.seat === 0 && Math.hypot(s.pos.x - v.st.x, s.pos.z - v.st.z) < 0.6, 'E: sürücü koltuğunda (konum koltukta)', `${f2(s.pos.x)},${f2(s.pos.z)} · boy ${s.height}`);
  put(v, 0, 300, 0); step(1);
  step(240, { f: 1 });
  const sp = V.speed(v);
  ok(sp > 15, '4 sn tam gaz (çayır)', `${f1(sp)} m/sn = ${Math.round(sp * 3.6)} km/s`);
  let n = 0; while (V.speed(v) > 0.05 && n < 300) { step(1, { j: 1 }); n++; }
  ok(n < 200, 'fren (Boşluk): durma süresi', `${f2(n / 60)} sn`);
  const y0 = v.st.yaw; step(120, { f: 0.6, r: 1 });
  ok(Math.abs(((v.st.yaw - y0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.8, 'D: sağa döner (yaw azalır)', `Δyaw ${f2(v.st.yaw - y0)}`);
  step(120, { j: 1 });
  step(1, { vs: 3 }); step(1);
  const s3 = s.seat, drvEmpty = !v.seats[0];
  step(1, { vs: 1 }); step(1);
  ok(s3 === 2 && drvEmpty && s.seat === 0, 'koltuk değiştir: 3 → arka sol, sürücü boşalır, 1 → sürücü', `${s3} → ${s.seat}`);
  // köprü + sığ geçit
  put(v, 0, 62, 0); step(1); let maxY = -99; step(480, (i) => { maxY = Math.max(maxY, v.st.y); return { f: 0.8 }; });
  ok(v.st.z < -15 && maxY > 6 && !v.st.sunk, 'Taş Köprü: tabliyeden (6,2 m) nehri geçer', `z ${f1(v.st.z)} · en yüksek ${f2(maxY)}`);
  put(v, 336, 20, 0.05); step(1); let minY = 99; step(780, () => { minY = Math.min(minY, v.st.y); return { f: 1 }; });
  ok(v.st.z < -105 && minY < -0.2 && !v.st.sunk, 'Doğu sığ geçidi: sudan geçer (batmaz)', `z ${f1(v.st.z)} · en alçak ${f2(minY)}`);
  // savaş alanı sınırı: araçla dışarı → 10 sn sonra ölüm, boş araç dışarıda 15 sn sonra yenilenir
  put(v, 770, 300, 0); step(1);
  let tOut = 0; while (s.alive && tOut < 13) { step(6); tOut += 0.1; }
  ok(!s.alive && tOut > 9.5 && tOut < 11, 'savaş alanı dışında araçta: ~10 sn sonra ölüm (koltuk boşalır)', `${f1(tOut)} sn · araç boş: ${!v.seats.some(Boolean)}`);
  let tI = 0; while (v.alive && tI < 20) { g.step(0.1); tI += 0.1; }
  ok(!v.alive && tI > 13 && tI < 17, 'dışarıda bırakılan boş araç ~15 sn sonra kaldırılır (sonra doğuşunda yenilenir)', `${f1(tI)} sn`);
  g.respawn(s); s.protT = 0;
  let tR = 0; while (!v.alive && tR < 40) { g.step(0.1); tR += 0.1; }
  ok(v.alive && Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) < 0.5, 'yeniden doğuş (doğuş yerinde)', `${f1(tR)} sn`);
  // derin su: batar, içindeki iner, araç gider
  s.pos.set(v.st.x + 2, v.st.y, v.st.z); step(1, { ve: 1 }); step(1);
  put(v, -100, 62, 0); step(1); let tS = 0, exitAt = -1; while (v.alive && tS < 14) { step(6, { f: 0.6 }); tS += 0.1; if (exitAt < 0 && !s.veh) exitAt = tS; }
  ok(!v.alive && exitAt > 0 && s.alive, 'derin nehir: motor boğulur → sürücü iner (yüzme su ajanında) → araç birkaç sn sonra gider', `iniş ${f1(exitAt)} sn · araç gitti ${f1(tS)} sn`);
  while (!v.alive) g.step(0.2);
  // hasar
  const red = g.soldiers.find((e) => e.team === 'red'); red.vacant = false; red.spawn({ x: v.st.x + 30, z: v.st.z, ry: 0 }, 0); g.world.settle(red); red.protT = 0;
  const hp0 = v.hp; V.damage(v, 30, red, 'bullet');
  ok(Math.abs(hp0 - v.hp - 30 * VT.jip.bulletMul) < 0.01, 'piyade mermisi: hasar × ' + VT.jip.bulletMul + ' (400 can ≈ 110 tüfek mermisi)', f1(hp0 - v.hp));
  const P = (x, y, z) => ({ x, y, z, clone() { return P(this.x, this.y, this.z); }, distanceTo: () => 99 });
  g.respawn(s); s.pos.set(v.st.x + 2, v.st.y, v.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
  const hp1 = v.hp; g.explode(P(v.st.x, v.st.y + 1.3, v.st.z - 1.6), 6.5, 160, red, 'RPG-7');
  ok(hp1 - v.hp > 200, 'RPG kaputa: ' + Math.round(hp1 - v.hp) + ' hasar (2 RPG = jip)', `can ${Math.round(v.hp)}`);
  const sHp = s.hp;
  g.explode(P(v.st.x, v.st.y + 1.3, v.st.z - 1.6), 6.5, 160, red, 'RPG-7');
  ok(!v.alive && !s.alive && red.kills >= 1, '2. RPG: araç patlar, sürücü ölür, öldürme RPG atana', `sürücü canı ${Math.round(sHp)} → öldü · ${red.name} öldürme ${red.kills}`);
  ok(v.wreck, 'enkaz kalır (' + VT.jip.wreck + ' sn), sonra ' + VT.jip.respawn + ' sn yeniden doğuş');
  while (!v.alive) g.step(0.25);
  // yanma: eşik altında can erir → patlar
  v.hp = VT.jip.hp * VT.jip.burnAt - 5; let tB = 0; while (v.alive && tB < 20) { g.step(0.1); tB += 0.1; }
  ok(!v.alive && tB > 8 && tB < 13, 'yanma: can %25 altında → ~' + Math.round(VT.jip.hp * VT.jip.burnAt / VT.jip.burnRate) + ' sn sonra patlar (inme süresi)', `${f1(tB)} sn`);
  while (!v.alive) g.step(0.25);
  // çarpma
  g.respawn(s); s.pos.set(v.st.x + 2, v.st.y, v.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
  put(v, 0, 300, 0);
  red.spawn({ x: 0, z: 270, ry: 0 }, 0); g.world.settle(red); red.protT = 0; red.hp = 100;
  const mate = g.soldiers.find((e) => e.team === 'blue' && e !== s); mate.vacant = false; mate.spawn({ x: 0.2, z: 240, ry: 0 }, 0); g.world.settle(mate); mate.protT = 0; mate.hp = 100;
  let ramSp = 0; step(240, () => { if (red.alive && red.hp === 100) ramSp = V.speed(v); return { f: 1 }; });
  ok(!red.alive, 'düşmana çarpma: öldü', `çarpma hızı ${f1(ramSp)} m/sn · öldüren ${red.lastHit?.name}`);
  ok(mate.alive && mate.hp === 100, 'takım arkadaşına çarpma: hasar yok (itilir)', `can ${mate.hp} · konum ${f1(mate.pos.x)},${f1(mate.pos.z)}`);
  step(120, { j: 1 });
  // gövdeden itme (yaya park etmiş araca yürür)
  step(1, { ve: 1 }); step(2);
  const xs = s.pos.x; let inside = 0;
  const tx = v.st.x, tz = v.st.z;
  s.pos.set(tx + 4, v.st.y, tz); s.yaw = Math.PI / 2;
  step(90, () => { if (V.inside(s, -0.05)) inside++; return { f: 1, yw: Math.PI / 2 }; });
  ok(inside === 0 && s.alive, 'yaya araca yürüyünce gövdeye girmez (itilir)', `içeride kare ${inside} · ${f2(xs)}`);
  // bot yolcu
  const gb = mkG({ bots: true, match: { perTeam: 6, type: 'conquest' } }), VB = gb.vehicles;
  const hb = gb.claimSlot('blue', 'Sürücü', 'assault', {}), hq = gb.humans.get(hb.id);
  const vb = VB.list.find((x) => x.id === 'B-J2');
  let qb = 0; const stepB = (n, o = {}) => { for (let i = 0; i < n; i++) { hq.queue.push({ q: ++qb, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: hb.yaw, pt: 0, w: hb.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...o }); gb.step(1 / 60); } };
  hb.pos.set(vb.st.x + 2, vb.st.y, vb.st.z); hb.protT = 0; stepB(1, { ve: 1 }); stepB(1);
  const mates = gb.soldiers.filter((e) => e.team === 'blue' && e.brain);
  mates.slice(0, 3).forEach((m, i) => { m.pos.set(vb.st.x - 6 - i * 2, vb.st.y, vb.st.z + 3); gb.world.settle(m); m.brain.target = null; m.brain.goal = null; });
  let tBo = 0; while (tBo < 10 && vb.seats.filter(Boolean).length < 3) { stepB(6, { fh: tBo < 1 ? 1 : 0 }); tBo += 0.1; }
  const riders = vb.seats.filter((o) => o && o.brain).length;
  if (riders < 2) console.log('  bot durumu', mates.slice(0, 3).map((m) => [m.alive, !!m.brain.target, m.brain.rideGoal ? 'hedef araç' : '-', Math.hypot(m.pos.x - vb.st.x, m.pos.z - vb.st.z).toFixed(1), m.veh ? 'araçta' : ''].join('/')).join(' '));
  ok(riders >= 2, 'bot yolcu: yakındaki takım arkadaşı botlar insanın sürdüğü durmuş araca biner (sürmezler)', `${riders} bot · ${f1(tBo)} sn`);
  stepB(1, { ve: 1 }); let tEx = 0; while (vb.seats.some(Boolean) && tEx < 8) { stepB(6); tEx += 0.1; }
  ok(!vb.seats.some(Boolean), 'sürücü inince botlar da iner', `${f1(tEx)} sn`);
  // maliyet + ağ
  const gp = mkG({ bots: true, match: { perTeam: 8, type: 'conquest' } });
  const t0 = performance.now(); for (let i = 0; i < 600; i++) gp.step(1 / 60); const ms = (performance.now() - t0) / 600;
  const t1 = performance.now(); for (let i = 0; i < 2000; i++) gp.vehicles.update(1 / 60); const vu = ((performance.now() - t1) / 2000) * 1000;
  const vv = gp.vehicles.list[0], d0 = performance.now(); for (let i = 0; i < 2000; i++) gp.vehicles.drive(vv, { f: 1, r: 0.3 }, 1 / 60); const du = ((performance.now() - d0) / 2000) * 1000;
  ok(vu < 40 && du < 40, 'sunucu maliyeti: araç yöneticisi (12 araç, park) / bir sürücü adımı', `${f1(vu)} µs / ${f1(du)} µs · 8v8 adım ${f2(ms)} ms`);
  const full = JSON.stringify(gp.vehicles.pack(true)).length; gp.vehicles.pack(false);
  const idle = gp.vehicles.pack(false).length;
  ok(idle === 0 || idle === 1, 'ağ: duran araç anlık görüntüye yazılmaz (yalnız değişen)', `tam liste ${full} B · değişen ${idle}`);
}

// ───────── 2) tarayıcı (çevrimdışı) ─────────
async function browserOffline(chromium) {
  console.log('── tarayıcı (çevrimdışı) ──');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
  for (const tod of ['day', 'night']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=${tod}&debug=1&nolock=1&nologin=1&devMode=0`);
    await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
    await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a), shot = async (n) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${tod === 'night' ? 'gece-' : ''}${n}.png` }); };
    await ev(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true; g.playerSoldier.fly = false; });
    const near = await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-J2'); me.pos.set(v.st.x + 2.3, v.st.y, v.st.z + 1.2); g.world.settle(me); me.yaw = Math.PI / 2 + 0.35; me.pitch = -0.2; return !!V.near(me); });
    await shot('01-yaninda-ipucu');
    await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
    const inV = await ev(() => window.__game.playerSoldier.veh?.id);
    if (tod === 'day') ok(near && inV === 'B-J2', 'tarayıcı: E ipucu + E ile bin (çevrimdışı)', inV);
    await ev(() => { const g = window.__game, me = g.playerSoldier; g.player.vehCam = 'first'; me.yaw = me.veh.st.yaw; me.pitch = -0.1; me.veh.lights = g.night; });
    await shot('02-surucu-icerden');
    await ev(() => { const g = window.__game, me = g.playerSoldier; g.player.vehCam = 'third'; me.yaw = me.veh.st.yaw + 2.5; me.pitch = -0.28; });
    await shot('03-surucu-takip');
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await page.waitForTimeout(1000); await page.keyboard.up('KeyD'); await page.waitForTimeout(1600);
    await ev(() => { const g = window.__game, me = g.playerSoldier; me.yaw = me.veh.st.yaw + Math.PI * 0.85; me.pitch = -0.3; });
    await shot('04-surus-toz-farlar'); await page.keyboard.up('KeyW');
    const drove = await ev(() => { const v = window.__game.playerSoldier.veh; return Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z); });
    if (tod === 'day') ok(drove > 15, 'tarayıcı: W / D ile sürüş', `${drove.toFixed(1)} m`);
    await page.keyboard.press('Digit3'); await page.waitForTimeout(300);
    await ev(() => { const g = window.__game, me = g.playerSoldier; me.yaw = me.veh.st.yaw + 1.3; me.pitch = -0.05; });
    await shot('05-yolcu');
    const seat = await ev(() => window.__game.playerSoldier.seat);
    if (tod === 'day') ok(seat === 2, 'tarayıcı: 3 tuşu → arka sol koltuk (yolcu, silah elde)', seat);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-J2'), b = g.soldiers.find((s) => s.team === 'blue' && s !== me); b.spawn({ x: v.st.x + 3, z: v.st.z, ry: 0 }, 0); V.enter(b, v, 1); me.pos.set(v.st.x - 4, v.st.y, v.st.z + 5); g.world.settle(me); me.yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); me.pitch = -0.15; });
    await shot('06-disaridan-yolculu');
    await ev(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-J2'); v.hp = 150; });
    await page.waitForTimeout(1500); await shot('07-hasarli-duman');
    await ev(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-J2'); v.hp = 80; });
    await page.waitForTimeout(2000); await shot('08-yaniyor');
    await page.waitForTimeout(8500); await shot('09-enkaz');
    if (tod === 'day') {
      await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-J3'); me.pos.set(v.st.x + 2, v.st.y, v.st.z); g.world.settle(me); V.toggle(me); v.st.x = 332; v.st.z = -45; v.st.y = g.world.heightAt(332, -45); v.st.yaw = 0.05; g.player.vehCam = 'third'; me.yaw = 0.05 + 2.2; me.pitch = -0.3; });
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1700); await shot('10-gecit-su'); await page.keyboard.up('KeyW');
    }
    ok(!errs.length, `tarayıcı (${tod === 'day' ? 'gündüz' : 'gece'}): sayfa hatası yok`, errs.slice(0, 2).join(' | '));
    await page.context().close();
  }
  // telefon (Pixel 7 profili): dokunmatik araç butonları
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', locale: 'tr-TR' });
  const mp = await ctx.newPage(); const merr = []; mp.on('pageerror', (e) => merr.push(e.message));
  await mp.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1&touch=1`);
  await mp.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await mp.waitForTimeout(1500);
  await mp.evaluate(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-J1'); g.brainsOff = g.brains.splice(0); me.fly = false; me.pos.set(v.st.x + 2.2, v.st.y, v.st.z + 1); g.world.settle(me); me.yaw = Math.PI / 2 + 0.3; me.pitch = -0.2; });
  await mp.waitForTimeout(500);
  const btn = await mp.evaluate(() => { const b = document.querySelector('#tc [data-b="veh"]'); return b && !b.classList.contains('hid') ? b.getBoundingClientRect().toJSON() : null; });
  await mp.screenshot({ path: `${OUT}/11-telefon-yaninda.png` });
  if (btn) await mp.touchscreen.tap(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await mp.waitForTimeout(500);
  const mv = await mp.evaluate(() => { const g = window.__game, me = g.playerSoldier; if (me.veh) { me.yaw = me.veh.st.yaw + 2.6; me.pitch = -0.3; } return { veh: me.veh?.id, vcam: !document.querySelector('#tc [data-b="vcam"]').classList.contains('hid'), seat: !document.querySelector('#tc [data-b="seat"]').classList.contains('hid') }; });
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: `${OUT}/12-telefon-surucu.png` });
  ok(btn && mv.veh === 'B-J1' && mv.vcam && mv.seat && !merr.length, 'telefon: araç yanında "bin" butonu, dokununca sürücü; kamera + koltuk butonları (joystick = gaz / direksiyon, zıpla = fren, ateş = korna)', JSON.stringify(mv) + (merr.length ? ' · ' + merr[0] : ''));
  await browser.close();
}

// ───────── 3) çevrim içi ─────────
async function online(chromium) {
  console.log('── çevrim içi ──');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p; };
  const A = await mk(), B = await mk();
  await A.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(SRV)}&map=kuzey&type=conquest&per=4&team=blue&debug=1&nolock=1&nologin=1`);
  await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  const code = await A.evaluate(() => window.__game._badgeCode);
  await B.goto(`${URL0}/?online=${code}&name=Veli&team=blue&server=${encodeURIComponent(SRV)}&debug=1&nolock=1&nologin=1`);
  await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  for (const P of [A, B]) await P.evaluate(() => { const g = window.__game; g.online.send({ t: 'dbg', bots: false }); window.__bytes = 0; g.online.ws.addEventListener('message', (e) => { window.__bytes += e.data.length; }); });
  await A.waitForTimeout(1500);
  const jp = await A.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-J1'); return [v.st.x, v.st.z]; });
  await A.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] + 2, p[1]] }), jp);
  await B.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] - 2, p[1] + 0.5] }), jp);
  await A.waitForTimeout(1500);
  const bw0 = await A.evaluate(async () => { const b = window.__bytes; await new Promise((r) => setTimeout(r, 4000)); return (window.__bytes - b) / 4; });
  await A.keyboard.press('KeyE'); await A.waitForTimeout(600); await B.keyboard.press('KeyE'); await B.waitForTimeout(800);
  const seats = await Promise.all([A, B].map((P) => P.evaluate(() => { const me = window.__game.playerSoldier; return [me.veh?.id, me.seat]; })));
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', vtp: [0, 330, 0] }));              // açık çayıra (üs HESCO duvarı önünde)
  await A.waitForTimeout(800);
  ok(seats[0][0] === 'B-J1' && seats[0][1] === 0 && seats[1][0] === 'B-J1' && seats[1][1] === 1, 'çevrim içi: A sürücü, B ön yolcu (sunucu onayıyla)', JSON.stringify(seats));
  // hedef: kırmızı bir asker yolun yanına (B hareket hâlinde ona ateş eder)
  const tgt = await A.evaluate(() => { const g = window.__game, r = g.soldiers.find((s) => s.team === 'red' && s.alive); g.online.send({ t: 'dbg', tps: [r.id, 18, 262, 0, 100] }); return r.id; });
  await A.evaluate(() => { const g = window.__game; g.player.vehCam = 'third'; g.playerSoldier.yaw = g.playerSoldier.veh.st.yaw; });
  const rec = (P) => P.evaluate(() => { window.__rec = []; const id = setInterval(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-J1'); if (v?.st) window.__rec.push([Date.now(), v.st.x, v.st.z, g.online.stats.delay]); }, 30); window.__recStop = () => clearInterval(id); });
  await rec(A); await rec(B);
  const bwP = A.evaluate(async () => { const b = window.__bytes; await new Promise((r) => setTimeout(r, 8000)); return (window.__bytes - b) / 8; });
  await A.keyboard.down('KeyW'); await A.waitForTimeout(2200);
  // B: hareketli araçtan hedefe nişan + ateş (1,6 sn)
  const hit = B.evaluate(async (id) => {
    const g = window.__game, me = g.playerSoldier, t = g.soldiers[id], hp0 = t.hp;
    const aim = () => { const e = me.eye(), c = t.center(); const dx = c.x - e.x, dz = c.z - e.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(c.y - e.y, Math.hypot(dx, dz)); };
    const id2 = setInterval(aim, 8); aim(); g.player.fireHeld = true;
    await new Promise((r) => setTimeout(r, 1600));
    g.player.fireHeld = false; clearInterval(id2);
    await new Promise((r) => setTimeout(r, 400));
    return { hp0, hp: t.hp, alive: t.alive, d: Math.hypot(t.pos.x - me.pos.x, t.pos.z - me.pos.z) };
  }, tgt);
  await A.waitForTimeout(1200);
  await A.screenshot({ path: `${OUT}/20-cevrimici-A-surucu.png` }); await B.screenshot({ path: `${OUT}/21-cevrimici-B-yolcu.png` });
  const hr = await hit;
  await A.keyboard.down('KeyD'); await A.waitForTimeout(800); await A.keyboard.up('KeyD'); await A.waitForTimeout(1500);
  await A.keyboard.up('KeyW'); await A.keyboard.down('Space'); await A.waitForTimeout(1500); await A.keyboard.up('Space');
  const bwD = await bwP;
  const ra = await A.evaluate(() => { window.__recStop(); return window.__rec; }), rb = await B.evaluate(() => { window.__recStop(); return window.__rec; });
  const at = (r, t) => { for (let i = 1; i < r.length; i++) if (r[i][0] >= t) { const a = r[i - 1], b = r[i], k = (t - a[0]) / Math.max(1, b[0] - a[0]); return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; } return null; };
  const es = []; for (const s of rb) { const p = at(ra, s[0] - (s[3] || 100) - 15); if (p) es.push(Math.hypot(p[0] - s[1], p[1] - s[2])); }
  es.sort((a, b) => a - b);
  const st = await A.evaluate(() => { const s = window.__game.online.stats; return { fix: s.vehFix || 0, errMax: +(s.vehErrMax || 0).toFixed(3), corr: s.corrections, rtt: Math.round(s.rtt) }; });
  const dist = Math.hypot(ra[ra.length - 1][1] - ra[0][1], ra[ra.length - 1][2] - ra[0][2]);
  ok(dist > 40 && st.fix <= 2 && st.errMax < 0.3, 'sürücü tahmini: sunucuyla uyumlu (araç düzeltmesi az)', `yol ${dist.toFixed(0)} m · düzeltme ${st.fix} · en büyük ${st.errMax} m · asker düzeltmesi ${st.corr} · RTT ${st.rtt} ms`);
  ok(es.length > 100 && es[es.length >> 1] < 0.15 && es[Math.floor(es.length * 0.95)] < 0.4, 'B (yolcu) aracı A ile aynı yolda görür (interpolasyon gecikmesi kaydırılınca)', `medyan ${es[es.length >> 1]?.toFixed(3)} m · %95 ${es[Math.floor(es.length * 0.95)]?.toFixed(3)} m · ${es.length} örnek`);
  ok(bwD - bw0 < 6000, 'bant genişliği: park ↔ bir jip sürülürken (istemci başına)', `${(bw0 / 1024).toFixed(1)} → ${(bwD / 1024).toFixed(1)} KB/sn (+${((bwD - bw0) / 1024).toFixed(1)})`);
  ok(hr.hp < hr.hp0 || !hr.alive, 'hareketli araçtan yolcu isabeti (geri sarma atıcının koltuğuna da)', `${Math.round(hr.d)} m · can ${hr.hp0} → ${hr.hp}${hr.alive ? '' : ' (öldü)'}`);
  // araç patlat: iki istemcide enkaz, içindekiler ölür
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', vdmg: [window.__game.playerSoldier.veh.idx, 9999, 'blast'] }));
  await A.waitForTimeout(1500);
  const boom = await Promise.all([A, B].map((P) => P.evaluate(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-J1'), me = g.playerSoldier; return { wreck: v.wreck, alive: v.alive, me: me.alive, inV: !!me.veh }; })));
  await A.screenshot({ path: `${OUT}/22-cevrimici-patlama-A.png` });
  ok(boom.every((b) => b.wreck && !b.alive && !b.me && !b.inV), 'araç patlayınca: iki istemcide enkaz, sürücü + yolcu ölür, koltuk kaydı kalmaz', JSON.stringify(boom));
  ok(!A.errs.length && !B.errs.length, 'çevrim içi: sayfa hatası yok', [...A.errs, ...B.errs].slice(0, 2).join(' | '));
  await browser.close();
}

if (!ONLY || ONLY === 'headless') headless();
let chromium = null;
try { ({ chromium } = await import('playwright')); } catch { console.log('(playwright yok: tarayıcı bölümleri atlandı)'); }
const up = async (u) => { try { const r = await fetch(u); return r.ok; } catch { return false; } };
if (chromium && (!ONLY || ONLY === 'browser')) { if (await up(URL0)) await browserOffline(chromium); else console.log('(vite yok: ' + URL0 + ' — çevrimdışı tarayıcı bölümü atlandı)'); }
if (chromium && (!ONLY || ONLY === 'online')) { if (await up(SRV.replace(/^ws/, 'http') + '/health')) await online(chromium); else console.log('(sunucu yok: ' + SRV + ' — çevrim içi bölüm atlandı)'); }
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
