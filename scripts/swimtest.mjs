// Yüzme testi (12.180). Bölüm 1 (çevrimdışı, tarayıcısız): node scripts/swimtest.mjs
//   kıyıdan suya giriş · yüzme hızı · dalma / yüzeye çıkış (kaldırma) · nefes → boğulma · kıyıdan çıkış · köprüden / yüksekten suya iniş hasarsız ·
//   sınır kuralı suda da · göl merdiveninden çıkış · yüzerken silah kuralı · mermi suda durur · suya düşen bot kıyıya çıkar · botlar suya girmez
// Bölüm 2 (çevrim içi, tarayıcı): ONLINE=1 URL=http://127.0.0.1:5347 SRV=ws://127.0.0.1:8893 node scripts/swimtest.mjs
//   (sunucu: PORT=8893 ADMIN_PORT=8894 BF_DATA=/tmp/wb-swim BF_DEBUG=1 node server/index.js) — yüzme tahmini düzeltmesi küçük, ikinci istemci yüzeni doğru görür
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
let fails = 0; const ok = (c, m, extra = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (extra ? ' · ' + extra : '')); if (!c) fails++; };
const DT = 1 / 30;

if (!process.env.ONLINE || process.env.ONLINE === 'both') {
  MapBuilder.noVisual = true;
  const { Game } = await import('../src/game/game.js');
  const { applyInput } = await import('../src/sim/input.js');
  const { SWIM } = await import('../src/sim/swim.js');
  const { KZ_PLAY } = await import('../src/maps/kuzey.js');
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 3, type: 'conquest', time: 900 } });
  const T = g.world.terrain;
  const me = g.soldiers[0], foe = g.soldiers.find((s) => s.team !== me.team);
  for (const b of g.brains) b.update = () => {};                                  // botlar susar (bot bölümleri kendi açar)
  for (const s of g.soldiers) if (s !== me && s !== foe) { s.alive = false; s.respawnT = 1e9; s.pos.set(0, -50, 900); }
  const park = (s) => { s.pos.set(500, T.heightAt(500, 600), 600); s.vel.set(0, 0, 0); };
  park(foe); foe.protT = 1e9;
  const place = (x, y, z) => { me.alive = true; me.hp = me.maxHp; me.protT = 0; me.pos.set(x, y ?? T.heightAt(x, z), z); me.vel.set(0, 0, 0); me.onGround = y == null; me.fallSafe = false; me.fallTop = me.pos.y; me.air = SWIM.breath; me.drownAcc = 0; me.oobT = 0; me.lastHit = null; };
  // yön: yaw ile ileri = (−sin, −cos)
  const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
  const run = (secs, inp, each) => { for (let i = 0; i < secs / DT; i++) { g.step(DT); if (!me.alive) return i * DT; applyInput(me, { f: 0, r: 0, lean: 0, sprint: false, jump: false, dive: false, ...inp }, DT); if (each && each(i * DT) === false) return i * DT; } return secs; };

  // 1 kıyıdan suya giriş (x 100: kıyı z −50 → nehir ortası z −15), yüzme hızı
  place(100, null, -52); me.yaw = yawTo(0, 1); me.pitch = 0;
  let tSwim = null, minEye = 1e9, sp = [], minY = 1e9;
  run(14, { f: 1 }, (t) => { if (me.swim && tSwim == null) tSwim = t; if (me.swim) { minEye = Math.min(minEye, me.pos.y + me.eyeY - me.wY); if (t - tSwim > 2) sp.push(Math.hypot(me.vel.x, me.vel.z)); } minY = Math.min(minY, me.pos.y); });
  const spd = sp.reduce((a, b) => a + b, 0) / (sp.length || 1);
  ok(tSwim != null && me.swim && !me.under, '1a kıyıdan derin suya yürüyerek girilir (görünmez engel yok) → yüzer', `giriş ${tSwim?.toFixed(1)} sn, z ${me.pos.z.toFixed(1)}, ayak ${me.pos.y.toFixed(2)} (yatak ${T.heightAt(me.pos.x, me.pos.z).toFixed(2)})`);
  ok(spd > 1.9 && spd < 2.6, '1b yüzme hızı ~2,3 m/sn (koşu yok)', `${spd.toFixed(2)} m/sn`);
  ok(minEye > 0.08, '1c yüzeyde baş suyun üstünde (göz > su)', `göz − su en az ${minEye.toFixed(2)} m · en alçak ayak ${minY.toFixed(2)}`);
  // 2 dalma (C basılı) / bırakınca yüzeye çıkış
  const y0 = me.pos.y; let tUnder = null;
  run(2.5, { dive: true }, (t) => { if (me.under && tUnder == null) tUnder = t; });
  const dv = (y0 - me.pos.y) / 2.5;
  ok(me.under && dv > 0.5, '2a C basılıyken dalınır (baş su altına)', `${tUnder?.toFixed(2)} sn'de baş suda, ortalama ${dv.toFixed(2)} m/sn, ayak ${me.pos.y.toFixed(2)}`);
  let tUp = null; const yd = me.pos.y;
  run(8, {}, (t) => { if (!me.under && tUp == null) tUp = t; });
  ok(tUp != null && tUp > 0.4 && !me.under && Math.abs(me.pos.y - (me.wY - SWIM.float)) < 0.12, '2b bırakınca kaldırma kuvvetiyle yavaşça yüzeye çıkar', `${(me.wY - yd).toFixed(2)} m derinden ${tUp?.toFixed(2)} sn, dinlenme ayak ${me.pos.y.toFixed(2)}`);
  me.pitch = -0.5; let yb = me.pos.y; run(1.5, { f: 1, jump: true }); me.pitch = 0;
  ok(Math.abs(me.pos.y - (me.wY - SWIM.float)) < 0.3 && me.swim, '2c yüzeyde Space sudan fırlatmaz (titreme yok)', `ayak ${me.pos.y.toFixed(2)}`);
  // 3 su altında bakış yönünde yüzme (aşağı bakıp ileri)
  me.pitch = -0.9; yb = me.pos.y; run(1.5, { f: 1 }); me.pitch = 0;
  ok(me.pos.y < yb - 0.6 && me.under, '3 su altında bakış yönünde dalınır (aşağı bak + ileri)', `${(yb - me.pos.y).toFixed(2)} m indi`);
  // 4 nefes → boğulma (dipte C basılı)
  place(100, -2.9, -20); me.air = SWIM.breath; let tAir0 = null, firstDmg = null, hp0 = me.hp, dmgN = 0, lastHp = me.hp;
  const tDie = run(40, { dive: true }, (t) => { if (me.air <= 0 && tAir0 == null) tAir0 = t; if (me.hp < lastHp) { dmgN++; if (firstDmg == null) firstDmg = t; } lastHp = me.hp; });
  const kfOk = me.alive === false;
  ok(tAir0 != null && Math.abs(tAir0 - SWIM.breath) < 0.5, '4a su altında nefes ~18 sn', `${tAir0?.toFixed(1)} sn`);
  ok(firstDmg != null && firstDmg > SWIM.breath && kfOk && tDie > 26 && tDie < 30, '4b nefes bitince saniyede 10 boğulma hasarı → ölüm', `ilk hasar ${firstDmg?.toFixed(1)} sn, ${dmgN} vuruş, ölüm ${tDie.toFixed(1)} sn`);
  // yüzeye çıkınca nefes dolar
  place(100, -1.4, -20); me.air = 2; run(5.2, {});
  ok(me.air >= SWIM.breath - 0.01 && me.hp === me.maxHp, '4c yüzeyde nefes ~5 sn\'de dolar, hasar yok', `nefes ${me.air.toFixed(1)}`);
  // 5 kıyıdan çıkış: nehir ortasından güney kıyısına (z −50 tarafı) yüz, çık, kuru yerde dur
  place(100, -1.4, -18); me.yaw = yawTo(0, -1);
  let tOut = null;
  run(30, { f: 1 }, (t) => { if (tOut == null && !me.swim && me.onGround && me.pos.y > 0.3) tOut = t; if (tOut != null && t > tOut + 1.5) return false; });
  ok(tOut != null && !me.swim && me.pos.y > 0.3, '5a sığ kıyıdan yürüyerek çıkılır', `${tOut?.toFixed(1)} sn, z ${me.pos.z.toFixed(1)}, y ${me.pos.y.toFixed(2)}`);
  // 5b taş köprü ayağı / dik kıyı: yüksek kenara tırmanılmaz (köprü tabliyesine sudan çıkılmaz)
  place(0, -1.4, -2); me.yaw = yawTo(1, 0); run(10, { f: 1 });
  ok(me.pos.y < 2, '5b köprü ayağına / tabliyeye sudan çıkılmaz (≤ 1,15 m kenar kuralı)', `y ${me.pos.y.toFixed(2)} x ${me.pos.x.toFixed(1)}`);
  // 6 köprüden atla / yüksekten suya iniş hasarsız; karada aynı yükseklik öldürür (kontrol)
  const bridge = g.map.objectives.find((o) => o.id === 'C');
  place(0, 6.25, 9); me.onGround = true; me.yaw = yawTo(1, 0); let land = 0; const hpB = me.hp;
  let top = 0; run(8, { f: 1, jump: true }, () => { if (me.landH > land) land = me.landH; top = Math.max(top, me.pos.y); });     // korkuluğa (1 m) zıplayıp üstünden nehre
  ok(me.alive && me.hp === hpB && me.swim, '6a Taş Köprü\'den (korkuluk üstünden) nehre atlayış hasarsız', `can ${me.hp}, iniş ${land.toFixed(2)} m, en yüksek ${top.toFixed(2)}, şimdi ayak ${me.pos.y.toFixed(2)} (tabliye ${bridge?.y})`);
  place(60, 30, -6); me.onGround = false; run(5, {});
  ok(me.alive && me.hp === me.maxHp, '6b 30 m\'den derin nehre düşüş hasarsız', `can ${me.hp}, ayak ${me.pos.y.toFixed(2)}`);
  place(150, T.heightAt(150, 200) + 30, 200); me.onGround = false; run(4, {});
  ok(!me.alive, '6c kontrol: karada 30 m düşüş öldürür');
  // 7 sınır kuralı suda da: savaş alanı dışında (x −780) yüzerken 10 sn → ölüm
  place(-780, -1.4, 12); let tO = run(14, {});
  ok(!me.alive && tO > 9.5 && tO < 10.7, '7 savaş alanı dışında yüzen 10 sn sonra ölür', `${tO.toFixed(2)} sn, x ${me.pos.x.toFixed(0)} (sınır ${KZ_PLAY.minX})`);
  // 8 baraj gölü: merdivenden çıkış
  const ex = g.map.swimExits?.[0];
  ok(!!ex, '8a baraj gölü çıkış noktası (merdiven) var', JSON.stringify(ex));
  if (ex) {
    place(ex[0] + 14, 20 - 1.4, ex[2] - 6); me.yaw = yawTo(ex[0] - me.pos.x, ex[2] - me.pos.z);
    let climbed = null;
    run(20, { f: 1 }, (t) => { me.yaw = climbed == null ? yawTo(ex[0] - me.pos.x, ex[2] - me.pos.z) : yawTo(0, 1); if (climbed == null && !me.swim && me.pos.y > 20.2) climbed = t; if (climbed != null && me.pos.y > 23.9) return false; });
    ok(climbed != null && me.pos.y > 23.9, '8b gölden merdiven sahanlığına tutunup çıkılır, basamaklardan baraj tepesine (24 m)', `çıkış ${climbed?.toFixed(1)} sn, y ${me.pos.y.toFixed(2)}`);
  }
  // 9 silah kuralı: yüzeyde tüfek yok / tabanca var (nişan yok), su altında hiçbiri
  place(100, -1.4, -20); run(0.5, {});
  me.switchTo(0); run(0.8, {}); const rifle = me.tryFire();
  const sec = me.items.findIndex((it) => it && (it.id === 'pistol' || /m1911|deagle|revolver|mac10/.test(it.id)));
  me.switchTo(sec); run(0.8, {}); me.cd = 0; const pistol = me.tryFire(); me.ads = true; run(0.5, {}); const ads = me.adsT;
  me.ads = false; run(1.2, { dive: true }); me.cd = 0; const pUnder = me.tryFire();
  ok(!rifle && pistol && ads === 0 && !pUnder, '9 yüzerken: tüfek ateşlemez, yüzeyde tabanca ateşler (nişan yok), su altında ateş yok', `tüfek ${rifle} · tabanca ${pistol} · nişan ${ads} · su altı ${pUnder}`);
  // 10 mermi suda durur: yüzeydeki başa isabet, 2 m derindekine yok
  {
    const shooter = foe; shooter.alive = true; shooter.protT = 0;
    shooter.pos.set(100, T.heightAt(100, -55), -55); shooter.vel.set(0, 0, 0);
    const st = { ...shooter.stat, range: [40, 80], dmg: 30, minMul: 1, pen: null, pellets: 1 };
    const shoot = (tgt) => { const o = shooter.eye(new THREE.Vector3()), d = tgt.clone().sub(o).normalize(); const hp0 = me.hp; g.shootRay(shooter, o, d, st, o.clone()); return hp0 - me.hp; };
    place(100, -1.4, -25); run(0.2, {}); me.protT = 0;
    const hSurf = shoot(new THREE.Vector3(me.pos.x, me.pos.y + 1.66, me.pos.z));
    place(100, -3.0, -25); me.protT = 0; me.vel.set(0, 0, 0); me.pos.y = -3.0; const hDeep = shoot(new THREE.Vector3(me.pos.x, me.pos.y + 1.0, me.pos.z));
    ok(hSurf > 0 && hDeep === 0, '10 mermi su yüzeyinden 1,5 m sonra durur (yüzeydeki baş vurulur, dalan korunur)', `yüzey ${hSurf} · 2 m derin ${hDeep}`);
    park(shooter); shooter.protT = 1e9;
  }
  // 11 bot görüşü: dalan bot görüşünden saklı, yüzeydeki görünür
  {
    const a = new THREE.Vector3(100, T.heightAt(100, -55) + 1.6, -55);
    const surf = g.botSees(a, new THREE.Vector3(100, -0.25, -25)), deep = g.botSees(a, new THREE.Vector3(100, -2.0, -25));
    ok(surf && !deep, '11 bot görüşü: yüzeydeki yüzücüyü görür, dalanı görmez', `yüzey ${surf} · dalan ${deep}`);
  }
  // 12 suya düşen bot kıyıya çıkar (gerçek BotBrain), nehrin farklı yerlerinde
  {
    const { BotBrain } = await import('../src/game/bot.js');
    const spots = [[100, -20], [-150, 40], [260, -72], [-400, -18]], res = [];
    me.alive = false; me.respawnT = 1e9; me.pos.set(0, -50, 900);
    for (const [x, z] of spots) {
      const b = foe; b.alive = true; b.hp = b.maxHp; b.protT = 1e9; b.pos.set(x, -1.4, z); b.vel.set(0, 0, 0); b.air = SWIM.breath;
      const br = new BotBrain(g, b, 'normal'); br.pickGoal = () => {}; br.goal = null;
      let tOut = null, maxD = 0;
      for (let i = 0; i < 60 / DT; i++) { g.step(DT); br.update(DT); maxD = Math.max(maxD, b.wDepth || 0); if (!b.swim && !br.swimming && b.onGround && tOut == null) { tOut = i * DT; break; } }
      res.push({ x, z, t: tOut == null ? null : +tOut.toFixed(1), y: +b.pos.y.toFixed(2), free: g.nav.isFree(b.pos.x, b.pos.z) });
    }
    if (ex) {
      const b = foe; b.pos.set(ex[0] + 20, 18.6, ex[2] + 10); b.vel.set(0, 0, 0);
      const br = new BotBrain(g, b, 'normal'); br.pickGoal = () => {}; br.goal = null; let tOut = null;
      for (let i = 0; i < 60 / DT; i++) { g.step(DT); br.update(DT); if (!b.swim && !br.swimming && b.pos.y > 20.2 && tOut == null) { tOut = i * DT; break; } }
      res.push({ göl: true, t: tOut == null ? null : +tOut.toFixed(1), y: +b.pos.y.toFixed(2) });
    }
    park(foe);
    ok(res.every((r) => r.t != null && r.t < 45), '12 suya düşen bot en yakın kıyıya / merdivene yüzüp çıkar', JSON.stringify(res));
  }
  // 13 botlar suya kendiliğinden girmez: 8v8 botlu maç 150 sn (nehir iki yakada çatışma)
  {
    const g2 = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 8, type: 'conquest', time: 900 } });
    let swimS = 0, wade = 0, maxD = 0, who = new Set();
    for (let i = 0; i < 150 / DT; i++) { g2.step(DT); for (const s of g2.soldiers) if (s.alive) { if (s.swim) { swimS += DT; who.add(s.id); } if (s.wDepth > 0.6) wade += DT; maxD = Math.max(maxD, s.wDepth || 0); } }
    ok(swimS === 0, '13 botlar suya girmez (150 sn, 16 bot)', `yüzme ${swimS.toFixed(1)} bot·sn, > 0,6 m su ${wade.toFixed(1)} bot·sn, en derin ${maxD.toFixed(2)} m, öldürme ${g2.soldiers.reduce((a, s) => a + s.kills, 0)}`);
  }
}

// ── Bölüm 2: çevrim içi (tarayıcı + yerel BF_DEBUG sunucusu) ──
if (process.env.ONLINE) {
  const { chromium } = await import('playwright');
  const URL0 = process.env.URL || 'http://127.0.0.1:5347', SRV = process.env.SRV || 'ws://127.0.0.1:8893', OUT = process.env.OUT || '/tmp/wb-su/sonra';
  const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'tr-TR' })).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p; };
  const A = await mk(), B = await mk();
  await A.goto(`${URL0}/?online=new&name=Yuzucu&server=${encodeURIComponent(SRV)}&map=kuzey&type=tdm&per=2&bots=0&time=900&debug=1&nolock=1&nologin=1&shadows=0`);
  await A.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  const code = await A.evaluate(() => window.__game.online?.room || window.__game._badgeCode);
  await B.goto(`${URL0}/?online=${code}&name=Izleyen&server=${encodeURIComponent(SRV)}&debug=1&nolock=1&nologin=1&shadows=0`);
  await B.waitForFunction('window.__game && window.__game.running', null, { timeout: 240000 });
  await A.waitForTimeout(3000);
  // A nehre (x 100, z −20) ışınlanır, 8 sn yüzer (ileri), 3 sn dalar, sonra bırakır; tahmin hataları ölçülür
  const r = await A.evaluate(async () => {
    const g = window.__game, me = g.playerSoldier, n = g.online, P = g.player;
    n.send({ t: 'dbg', tpy: [100, -1.4, -30] });
    for (let i = 0; i < 60 && Math.abs(me.pos.z + 30) > 1; i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 800));
    me.yaw = Math.PI; n.stats.errMax = 0; const c0 = n.stats.corrections, e0 = n.stats.errSum || 0, sw = [];
    P.keys.add('KeyW');
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 200)); sw.push(me.swim ? 1 : 0); }
    P.keys.delete('KeyW'); P.keys.add('KeyC');
    let under = false; for (let i = 0; i < 15; i++) { await new Promise((r) => setTimeout(r, 200)); under = under || me.under; }
    const yDive = me.pos.y;
    P.keys.delete('KeyC');
    await new Promise((r) => setTimeout(r, 4000));
    return { corr: n.stats.corrections - c0, errSum: +((n.stats.errSum || 0) - e0).toFixed(3), errMax: +(n.stats.errMax || 0).toFixed(3), swimFrac: sw.reduce((a, b) => a + b, 0) / sw.length, under, yDive: +yDive.toFixed(2), y: +me.pos.y.toFixed(2), z: +me.pos.z.toFixed(1), air: me.air, id: me.id };
  });
  ok(r.swimFrac > 0.9 && r.under && r.y > -1.6, '14a çevrim içi: yüzer, C ile dalar, bırakınca yüzeye çıkar (istemci tahmini)', JSON.stringify(r));
  ok(r.corr <= 3 && r.errSum < 0.5, '14b yüzme tahmini düzeltmesi düşük (sunucu = istemci aynı kod)', `düzeltme ${r.corr}, toplam hata ${r.errSum} m, en büyük ${r.errMax} m`);
  // B, A'yı yüzerken görür: konumu suda, model yüzme pozunda
  await A.evaluate(() => { window.__game.player.keys.add('KeyW'); });
  await B.waitForTimeout(1500);
  const vb = await B.evaluate((id) => {
    const g = window.__game, o = g.soldiers.find((s) => s.id === id), m = o?.model?.root;
    const wy = g.world.terrain.waterY(o.pos.x, o.pos.z);
    // B kamerasını A'ya çevir (görsel)
    const c = g.camera, P = Object.getPrototypeOf(g), orig = P.render;
    P.render = function () { c.position.set(o.pos.x + 5, 1.6, o.pos.z + 4); c.lookAt(o.pos.x, o.pos.y + 1.2, o.pos.z); orig.call(this); };
    return { depth: +(wy - o.pos.y).toFixed(2), swimT: +(o.swimT || 0).toFixed(2), tilt: +(m?.rotation.x || 0).toFixed(2), vis: !!m?.visible };
  }, r.id);
  await B.waitForTimeout(800);
  await B.screenshot({ path: `${OUT}/cevrimici-B-yuzeni-goruyor.png` });
  await A.screenshot({ path: `${OUT}/cevrimici-A-yuzuyor.png` });
  ok(vb.depth > 1.1 && vb.depth < 1.8 && vb.swimT > 0.8 && vb.tilt < -0.5 && vb.vis, '14c ikinci istemci yüzeni suda ve yüzme pozunda görür', JSON.stringify(vb));
  // A boğulma: sunucu canı düşer, ölüm akışı "Boğuldu"
  const d = await A.evaluate(async () => {
    const g = window.__game, me = g.playerSoldier, n = g.online, P = g.player;
    P.keys.delete('KeyW');
    n.send({ t: 'dbg', hp: 100 }); n.send({ t: 'dbg', tpy: [100, -3.0, -20] });
    await new Promise((r) => setTimeout(r, 400));
    P.keys.add('KeyC');
    let minAir = 99, hp20 = null; const t0 = performance.now();
    while (me.alive && performance.now() - t0 < 34000) { await new Promise((r) => setTimeout(r, 250)); minAir = Math.min(minAir, me.air); if (hp20 == null && performance.now() - t0 > 21500) hp20 = me.hp; }
    P.keys.delete('KeyC');
    await new Promise((r) => setTimeout(r, 600));
    const bar = document.getElementById('swimair');
    return { alive: me.alive, hp20, minAir: +minAir.toFixed(2), kf: [...document.querySelectorAll('#killfeed .kf')].map((e) => e.textContent).pop() || '', bar: !!bar };
  });
  ok(!d.alive && d.hp20 < 100 && /Boğuldu|Drowned/.test(d.kf) && d.bar, '14d çevrim içi boğulma: sunucu canı düşer, ölüm "Boğuldu", nefes çubuğu', JSON.stringify(d));
  ok(!A.errs.length && !B.errs.length, '14e sayfa hatası yok', [...A.errs, ...B.errs].slice(0, 3).join(' | '));
  await browser.close();
}
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
