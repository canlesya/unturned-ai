// 12.166 Yana eğilme (Q / E) testi.
//   node scripts/leantest.mjs [off,sim,net]   (varsayılan: hepsi)
//   off : çevrimdışı (BASE) — açık alanda kafa kayması / düşüşü / kamera yatıklığı (gerçek karede), duvar dibinde rastgele 200 yerleşim:
//         kameranın yakın düzlemi duvara giriyor mu, göz → kamera doğrusu duvarı kesiyor mu (duvar arkası görme), 3. şahıs model kafası
//         eğilmeyle ne kadar kayıyor (vuruş kutusuyla aynı mı), nişanda eğilme (nişangâh merkezde), ekran görüntüleri (OUT)
//   sim : tarayıcısız sunucu Game'i — girdiyle (l: ±1) eğilen insanın leanOff'u + vuruş kutusu (kafa eğilen yerde vurulur, eski yerde vurulmaz)
//   net : çevrimiçi (WSURL, BF_DEBUG=1 sunucu) — istemcinin tahmin ettiği leanOff ile sunucununki aynı mı
// Eski kodla karşılaştırma: aynı betik eski sürümün vite'ına (BASE) çalıştırılır; ölçüm genel alanlardan (leanOff, kamera dönüşü) yapılır.
import { Game } from '../src/game/game.js';
import fs from 'fs';

const parts = (process.argv[2] || 'off,sim,net').split(',');
const BASE = process.env.BASE || 'http://127.0.0.1:5180', WSURL = process.env.WSURL || 'ws://127.0.0.1:8787', OUT = process.env.OUT || '/tmp/wb-lean';
const STRICT = process.env.STRICT !== '0';          // eski kodu ölçerken STRICT=0 (yalnız sayılar)
fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok || !STRICT ? (ok ? 'OK    ' : 'BİLGİ ') : 'HATA  ') + msg); if (!ok && STRICT) fail++; };

// ───────── sunucu simülasyonu ─────────
if (parts.includes('sim')) {
  const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
  const A = g.claimSlot('blue', 'Ali'), h = g.humans.get(A.id);
  g.brains.length = 0;
  const B = g.soldiers.find((e) => e !== A && e.team === 'red');
  const DT = 1 / 60; let q = 0;
  const tick = (l) => { h.queue.push({ q: ++q, f: 0, r: 0, l, s: 0, j: 0, a: 0, yw: A.yaw, pt: 0, c: 0, p: 0, u: 0, w: A.cur, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null }); A.hp = A.maxHp; g.step(DT); };
  for (let i = 0; i < 60; i++) tick(0);
  // açık yer: A'nın çevresinde 2 m içinde duvar yok
  const W = g.world, V = A.pos.constructor;
  let spot = null;
  for (let k = 0; k < 400 && !spot; k++) {
    const x = (Math.random() - 0.5) * 120, z = (Math.random() - 0.5) * 120, y = W.heightAt(x, z);
    const o = new V(x, y + 1.6, z); let ok = true;
    for (let a = 0; a < 8 && ok; a++) if (W.raycast(o, new V(Math.cos(a * 0.785), 0, Math.sin(a * 0.785)), 2.5, {})) ok = false;
    if (ok && !W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.05, z, 1.8)) spot = [x, y, z];
  }
  A.pos.set(...spot); A.vel.set(0, 0, 0); W.settle(A); A.yaw = 0;
  for (let i = 0; i < 20; i++) tick(0);
  const lo0 = A.leanOff.clone();
  for (let i = 0; i < 40; i++) tick(1);
  const lo = A.leanOff.clone(), side = Math.hypot(lo.x, lo.z);
  check(lo0.length() < 1e-6 && side > 0.42 && side < 0.46 && lo.y < -0.09, `sunucu: girdiyle sağa eğilme leanOff ${side.toFixed(3)} m yana, ${lo.y.toFixed(3)} m aşağı (yaw 0 → +x: ${lo.x.toFixed(3)})`);
  // vuruş kutusu: B, A'nın önünde 8 m'den kafaya nişan alır
  const head = (dx) => new V(A.pos.x + dx, A.pos.y + A.height - 0.16 + lo.y, A.pos.z);
  const o = new V(A.pos.x, A.pos.y + 1.6, A.pos.z - 8);
  const shot = (tgt) => { const d = tgt.clone().sub(o).normalize(); return g.hitSoldier(A, o, d, 30)?.zone || null; };
  const zLean = shot(head(lo.x)), zOld = shot(head(0).setY(A.pos.y + A.height - 0.16));
  check(zLean === 'head', `sunucu: eğilen kafanın yeni yeri vurulur → ${zLean}`);
  check(zOld !== 'head', `sunucu: kafanın eğilmeden önceki yeri artık kafa değil → ${zOld}`);
  for (let i = 0; i < 40; i++) tick(-1);
  check(Math.abs(A.leanOff.x + side) < 0.01, `sunucu: sola eğilme simetrik (${A.leanOff.x.toFixed(3)})`);
  // duvar dibi: sağda duvar varken leanOff kısalır (yan duvara 0,32 m = karakter yarıçapı)
  let wall = null;
  for (const c of W.colliders) { if (c.max[1] - c.min[1] < 2.5 || c.max[2] - c.min[2] < 3 || c.max[0] - c.min[0] < 1) continue; const x = c.min[0] - 0.33, z = (c.min[2] + c.max[2]) / 2, y = W.heightAt(x, z); if (Math.abs(y - c.min[1]) > 0.3) continue; if (W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.05, z, 1.8)) continue; wall = [x, y, z]; break; }
  if (wall) {
    A.pos.set(...wall); A.vel.set(0, 0, 0); W.settle(A); A.yaw = 0;
    for (let i = 0; i < 40; i++) tick(1);
    check(A.leanOff.x < 0.2 && A.leanOff.x >= 0, `sunucu: sağında duvar (0,33 m) → eğilme kısalır: ${A.leanOff.x.toFixed(3)} m`);
  }
  B.alive = false;
}

// ───────── tarayıcı ─────────
let browser;
const launch = async () => { if (!browser) { const { chromium } = await import('playwright'); browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); } return browser; };

if (parts.includes('off')) {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=3v3&map=colgecidi&type=tdm&dev=1&debug=1&nolock=1`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true; const s = g.playerSoldier; s.fly = false; for (const e of g.soldiers) if (e !== s) { e.alive = false; e.model.root.visible = false; } });
  // sabit nokta (CT doğuşu yakını, açık) + gerçek karede ölçüm
  const place = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const g = window.__game, s = g.playerSoldier; s.pos.set(x, g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); g.world.settle(s); s.yaw = yaw; s.pitch = 0; s.onGround = true; }, [x, z, yaw]);
  const open = await page.evaluate(() => {
    const g = window.__game, W = g.world, V = g.playerSoldier.pos.constructor;
    let sd = 4242; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);      // tohumlu: eski / yeni kodda aynı yer
    for (let k = 0; k < 2000; k++) {
      const x = (rnd() - 0.5) * 140, z = (rnd() - 0.5) * 140, y = W.heightAt(x, z);
      const o = new V(x, y + 1.6, z); let ok = true;
      for (let a = 0; a < 8 && ok; a++) if (W.raycast(o, new V(Math.cos(a * 0.785), 0, Math.sin(a * 0.785)), 2.5, {})) ok = false;
      if (!ok) continue;
      if (!W.raycast(o, new V(0, 0, -1), 25, {})) continue;             // önünde (−z) 25 m içinde bir şey olsun (görüntüde yatıklık okunsun)
      if (!W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.05, z, 1.8)) return [x, z];
    }
    return null;
  });
  const leanReal = async (key) => {
    await page.evaluate((key) => { const p = window.__game.player; p.keys.clear(); if (key) p.keys.add(key); }, key);
    const want = key === 'KeyE' ? 1 : key === 'KeyQ' ? -1 : 0;                  // yavaş karede (swiftshader) oyun zamanı ağır akar: leanT oturana dek bekle
    await page.waitForFunction((w) => Math.abs(window.__game.playerSoldier.leanT - w) < 0.01, want, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page.evaluate(() => { const g = window.__game, s = g.playerSoldier, c = g.camera; const e = s.eye(); return { off: Math.hypot(s.leanOff.x, s.leanOff.z), dy: s.leanOff.y, roll: c.rotation.z, camX: c.position.x - s.pos.x, camZ: c.position.z - s.pos.z, eye: [e.x, e.y, e.z] }; });
  };
  await place(open[0], open[1], 0);
  const r0 = await leanReal(null);
  await page.screenshot({ path: `${OUT}/acik-duz.png` });
  const rE = await leanReal('KeyE');
  await page.screenshot({ path: `${OUT}/acik-sag-E.png` });
  const rQ = await leanReal('KeyQ');
  await page.screenshot({ path: `${OUT}/acik-sol-Q.png` });
  await leanReal(null);
  const deg = (r) => (r * 180 / Math.PI).toFixed(1);
  console.log(`      ölçüm (açık alan): sağ E kafa ${rE.off.toFixed(3)} m yana, ${rE.dy.toFixed(3)} m aşağı, kamera ${deg(rE.roll)}° · sol Q ${rQ.off.toFixed(3)} m, ${deg(rQ.roll)}° · düz ${r0.off.toFixed(3)} m ${deg(r0.roll)}°`);
  check(rE.off > 0.42 && rQ.off > 0.42 && Math.abs(rE.roll) > 0.23 && Math.abs(Math.abs(rE.roll) - Math.abs(rQ.roll)) < 0.02 && rE.roll < 0 && rQ.roll > 0, `açık alan: eğilme ≥ 0,42 m ve ≥ 13° (E sağ / Q sol, simetrik)`);

  // duvar dibi taraması: 200 yerleşim, sağa / sola eğil, yakın düzlem duvara girmesin, göz → kamera doğrusu duvarı kesmesin
  const sweep = await page.evaluate(() => {
    const g = window.__game, s = g.playerSoldier, W = g.world, cam = g.camera, V = s.pos.constructor;
    const tall = W.colliders.filter((c) => c.max[1] - c.min[1] > 2.2 && Math.max(c.max[0] - c.min[0], c.max[2] - c.min[2]) > 1.2);
    const inside = (p) => W.query(p.x - 0.01, p.z - 0.01, p.x + 0.01, p.z + 0.01, []).some((c) => p.x > c.min[0] && p.x < c.max[0] && p.y > c.min[1] && p.y < c.max[1] && p.z > c.min[2] && p.z < c.max[2]);
    const nearR = cam.near / Math.cos(Math.atan(Math.tan(cam.fov * Math.PI / 360) * Math.hypot(1, cam.aspect)));      // yakın düzlem köşesine uzaklık
    const hH = cam.near * Math.tan(cam.fov * Math.PI / 360), hW = hH * cam.aspect;
    let n = 0, clip = 0, through = 0, sumOff = 0, minOff = 9, cut = 0; const bad = [];
    let sd = 777; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    const keep = { pos: s.pos.clone(), yaw: s.yaw };
    for (let k = 0; k < 4000 && n < 200; k++) {
      const c = tall[Math.floor(rnd() * tall.length)];
      const face = Math.floor(rnd() * 4), ax = face < 2 ? 0 : 2, sgn = face % 2 ? 1 : -1;      // −x, +x, −z, +z yüzü
      const nx = ax === 0 ? sgn : 0, nz = ax === 2 ? sgn : 0;
      const along = ax === 0 ? 2 : 0, a0 = c.min[along] - 0.5, a1 = c.max[along] + 0.5, av = a0 + rnd() * (a1 - a0);
      const d = 0.33 + rnd() * 0.25;
      const x = ax === 0 ? (sgn > 0 ? c.max[0] : c.min[0]) + nx * d : av, z = ax === 2 ? (sgn > 0 ? c.max[2] : c.min[2]) + nz * d : av;
      const y = W.heightAt(x, z);
      if (y < c.min[1] - 0.2 || y > c.max[1] - 2) continue;
      if (W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.05, z, 1.8)) continue;
      // sağ (ya da sol) yön duvara doğru (normalin tersi) ± 60°
      const lean = rnd() < 0.5 ? 1 : -1, ang = (rnd() - 0.5) * 2 * 1.05;
      const wx = -nx, wz = -nz, dx = wx * Math.cos(ang) - wz * Math.sin(ang), dz = wx * Math.sin(ang) + wz * Math.cos(ang);
      // right = (cos yaw, 0, −sin yaw) = lean * (dx, dz)
      s.yaw = Math.atan2(-dz * lean, dx * lean); s.pitch = (rnd() - 0.5) * 0.6;
      s.pos.set(x, y, z); s.vel.set(0, 0, 0); s.onGround = true; s.sprinting = false; s.prone = false; s.crouching = rnd() < 0.25; s.leanT = 0; s.leanOff.set(0, 0, 0);
      if ('_leanRoom' in s) s._leanRoom = 0.44;
      for (let i = 0; i < 50; i++) { s.leanDir = lean; s.onGround = true; s.update(1 / 60); }
      n++;
      const e0 = new V(s.pos.x, s.pos.y + s.eyeY, s.pos.z), e = s.eye();
      const o = Math.hypot(s.leanOff.x, s.leanOff.z); sumOff += o; minOff = Math.min(minOff, o); if (o < 0.4) cut++;
      // yakın düzlem: merkez + kenar / köşe noktaları (yatıklıktan bağımsız: çember)
      cam.position.copy(e); cam.rotation.order = 'YXZ'; cam.rotation.set(s.pitch, s.yaw, 0); cam.updateMatrixWorld(true);
      const fw = new V(0, 0, -1).applyQuaternion(cam.quaternion), rt = new V(1, 0, 0).applyQuaternion(cam.quaternion), up = new V(0, 1, 0).applyQuaternion(cam.quaternion);
      let hitIn = inside(e);
      const R = Math.hypot(hW, hH);
      for (let a = 0; a < 16 && !hitIn; a++) { const p = e.clone().addScaledVector(fw, cam.near).addScaledVector(rt, Math.cos(a * Math.PI / 8) * R).addScaledVector(up, Math.sin(a * Math.PI / 8) * R); if (inside(p)) hitIn = true; }
      if (hitIn) { clip++; if (bad.length < 4) bad.push([+x.toFixed(2), +z.toFixed(2), +s.yaw.toFixed(2), lean, +o.toFixed(3)]); }
      if (!W.clear(e0, e)) through++;
    }
    s.pos.copy(keep.pos); s.yaw = keep.yaw; s.leanDir = 0;
    return { n, clip, through, avgOff: sumOff / Math.max(1, n), minOff, cut, bad, nearR };
  });
  console.log(`      duvar taraması: ${sweep.n} yerleşim, ort. eğilme ${sweep.avgOff.toFixed(3)} m (en az ${sweep.minOff.toFixed(3)}, kısalan ${sweep.cut}), yakın düzlem duvarda ${sweep.clip}, göz→kamera duvarı kesiyor ${sweep.through} ${sweep.bad.length ? JSON.stringify(sweep.bad) : ''}`);
  check(sweep.n >= 150 && sweep.clip === 0 && sweep.through === 0 && sweep.cut > 20, 'duvar dibi: kamera duvara girmiyor / duvar arkasını görmüyor (sızma 0), duvar varsa eğilme kısalıyor');

  // görüntü: duvar dibinde sağa eğil (duvar sağda, kısa eğilme)
  const wallSpot = await page.evaluate(() => {
    const g = window.__game, W = g.world;
    for (const c of W.colliders) {
      if (c.max[1] - c.min[1] < 3 || c.max[2] - c.min[2] < 4 || c.max[0] - c.min[0] < 2) continue;
      const x = c.min[0] - 0.34, z = c.min[2] + 1.0, y = W.heightAt(x, z);
      if (Math.abs(y - c.min[1]) > 0.3 || W._hits(W.query(x - 1, z - 1, x + 1, z + 1, []), x, y + 0.05, z, 1.8)) continue;
      return [x, z];
    }
    return null;
  });
  if (wallSpot) {
    await place(wallSpot[0], wallSpot[1], 0.35);     // duvar sağda, hafif duvara dönük; köşe solda-önde
    await leanReal(null); await page.screenshot({ path: `${OUT}/duvar-duz.png` });
    const rw = await leanReal('KeyE'); await page.screenshot({ path: `${OUT}/duvar-sag-E.png` });
    console.log(`      duvar dibi (sağda duvar): eğilme ${rw.off.toFixed(3)} m, kamera ${deg(rw.roll)}°`);
    await leanReal(null);
  }

  // 3. şahıs model: bir bot eğilir, kafası ne kadar kayıyor (vuruş kutusu kafası leanOff kadar kayar)
  const tp = await page.evaluate(async ([x, z]) => {
    const g = window.__game, s = g.playerSoldier, W = g.world, V = s.pos.constructor;
    const bot = g.soldiers.find((e) => e !== s);
    bot.alive = true; bot.hp = bot.maxHp; bot.protT = 0; bot.model.root.visible = true;
    bot.pos.set(x, W.heightAt(x, z - 2.2), z - 2.2); bot.vel.set(0, 0, 0); bot.yaw = Math.PI; bot.pitch = 0; bot.onGround = true;   // oyuncuya bakar
    const run = async (dir, ms) => { const t0 = performance.now(); let n = 0; while (performance.now() - t0 < 30000 && (Math.abs(bot.leanT - dir) > 0.01 || n < 3)) { bot.leanDir = dir; bot.onGround = true; bot.sprinting = false; bot.crouching = false; bot.prone = false; bot.vel.set(0, 0, 0); bot.yaw = Math.PI; n++; await new Promise((r) => requestAnimationFrame(r)); } };
    const headW = () => { bot.model.root.updateMatrixWorld(true); return bot.model.parts.head.getWorldPosition(new V()); };
    await run(0, 700); const h0 = headW();
    await run(1, 900); const h1 = headW(); const lo = bot.leanOff.clone();
    return { model: Math.hypot(h1.x - h0.x, h1.z - h0.z), modelX: h1.x - h0.x, hitX: lo.x, hit: Math.hypot(lo.x, lo.z), dy: h1.y - h0.y };
  }, open);
  await page.evaluate(() => { window.__game.playerSoldier.pitch = -0.05; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/ucuncu-bot-egik.png` });
  console.log(`      3. şahıs: model kafası ${tp.model.toFixed(3)} m yana (x ${tp.modelX.toFixed(3)}), ${tp.dy.toFixed(3)} m dikey · vuruş kutusu kafası ${tp.hit.toFixed(3)} m (x ${tp.hitX.toFixed(3)})`);
  check(Math.abs(tp.model - tp.hit) < 0.08 && Math.sign(tp.modelX) === Math.sign(tp.hitX), '3. şahıs: model kafası vuruş kutusuyla aynı yöne ≈ aynı kadar kayıyor (fark < 8 cm)');
  await page.evaluate(() => { const bot = window.__game.soldiers.find((e) => e !== window.__game.playerSoldier); bot.leanDir = 0; bot.alive = false; bot.model.root.visible = false; });

  // nişanda eğilme: nişangâh (ekran merkezi) = atış yönü (kamera ileri vektörü yatıklıktan etkilenmez)
  await place(open[0], open[1], 0);
  const ads = await page.evaluate(async () => {
    const g = window.__game, s = g.playerSoldier, p = g.player;
    s.ads = true; p.keys.clear(); p.keys.add('KeyE');
    const t0 = performance.now(); while (performance.now() - t0 < 30000 && !(s.adsT > 0.99 && s.leanT > 0.99)) { s.ads = true; await new Promise((r) => requestAnimationFrame(r)); }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const V = s.pos.constructor, fw = new V(0, 0, -1).applyQuaternion(g.camera.quaternion), aim = s.aimDir ? s.aimDir(new V()) : null;
    const want = new V(-Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.yaw) * Math.cos(s.pitch));
    return { adsT: s.adsT, leanT: s.leanT, ang: Math.acos(Math.min(1, fw.dot(want))) * 180 / Math.PI, roll: g.camera.rotation.z };
  });
  await page.screenshot({ path: `${OUT}/nisan-sag-E.png` });
  await page.evaluate(() => { const g = window.__game; g.player.keys.clear(); g.playerSoldier.ads = false; });
  console.log(`      nişanda eğilme: adsT ${ads.adsT.toFixed(2)}, leanT ${ads.leanT.toFixed(2)}, kamera ileri ↔ bakış ${ads.ang.toFixed(3)}°, yatıklık ${deg(ads.roll)}°`);
  check(ads.adsT > 0.9 && ads.leanT > 0.9 && ads.ang < 0.5, 'nişanda eğilme: nişan oturuyor, kamera ileri yönü bakışla aynı (nişangâh merkezde)');
  check(!errs.length, 'çevrimdışı: sayfa hatası yok' + (errs.length ? ' · ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();
}

if (parts.includes('net')) {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const q = new URLSearchParams({ online: 'new', type: 'tdm', per: '2', map: 'colgecidi', debug: '1', nolock: '1', server: WSURL, name: 'Egil', cls: 'assault' });
  await page.goto(`${BASE}/?${q}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const o = window.__game.online; const om = o.onMessage.bind(o); o.onMessage = (m) => { if (m.t === 'dbg' && m.sv) o._dbg = m; return om(m); }; o.send({ t: 'dbg', bots: false }); setInterval(() => o.send({ t: 'dbg', hp: 99999 }), 400); });
  const ask = async () => { await page.evaluate(() => { const o = window.__game.online; o._dbg = null; o.send({ t: 'dbg', ask: 1 }); }); await page.waitForFunction(() => window.__game.online._dbg, null, { timeout: 5000 }); return page.evaluate(() => { const g = window.__game, s = g.playerSoldier; return { sv: g.online._dbg.sv, cl: [s.leanOff.x, s.leanOff.y, s.leanOff.z], pos: [s.pos.x, s.pos.z] }; }); };
  const res = [];
  for (const key of ['KeyE', 'KeyQ', null]) {
    await page.evaluate((key) => { const p = window.__game.player; p.keys.clear(); if (key) p.keys.add(key); }, key);
    const want = key === 'KeyE' ? 1 : key === 'KeyQ' ? -1 : 0;
    await page.waitForFunction((w) => Math.abs(window.__game.playerSoldier.leanT - w) < 0.005, want, { timeout: 30000 }).catch(() => {});
    let r, d = 9;
    for (let k = 0; k < 8 && d >= 0.01; k++) {                                     // sunucu girdi kuyruğunu işleyene dek (yavaş karede istemci geride / ileride olabilir)
      await page.waitForTimeout(500);
      r = await ask();
      d = r.sv.lo ? Math.hypot(r.sv.lo[0] - r.cl[0], r.sv.lo[1] - r.cl[1], r.sv.lo[2] - r.cl[2]) : 9;
    }
    res.push(`${key || 'düz'}: istemci ${r.cl.map((v) => v.toFixed(3)).join(',')} · sunucu ${r.sv.lo ? r.sv.lo.join(',') : '?'} (fark ${d.toFixed(4)})`);
    check(d < 0.01 && (key ? Math.hypot(r.cl[0], r.cl[2]) > 0.05 : Math.hypot(r.cl[0], r.cl[2]) < 0.01), `çevrimiçi ${key || 'düz'}: istemci leanOff = sunucu leanOff (vuruş kutusu kayması) · ${res[res.length - 1]}`);
  }
  await page.evaluate(() => window.__game.player.keys.clear());
  check(!errs.length, 'çevrimiçi: sayfa hatası yok' + (errs.length ? ' · ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();
}

if (browser) await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
