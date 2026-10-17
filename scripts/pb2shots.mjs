// Paintball v2 görüntüleri (Boya Kulesi, pb): halka nişangâh + düşüş çizgileri (masaüstü + Pixel 7 dokunmatik), seri atışta açılan halka,
// ekrana boya (yandan isabet, kafa, elenme + "BOYANDIN!", yakın geçen top), toplanabilir kutular (uzaktan, yakından, yeniden belirirken), bildirim.
//   GPU=1 node scripts/pb2shots.mjs [http://127.0.0.1:5207]      Çıktı: /tmp/wb-pb2-shots/*.png
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5207', OUT = '/tmp/wb-pb2-shots';
fs.mkdirSync(OUT, { recursive: true });
const GPU = !!process.env.GPU, ONLY = process.env.ONLY || '';
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };

async function setup(ctxOpt, q = '') {
  const ctx = await browser.newContext(ctxOpt);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${BASE}/?autostart=8v8&map=boyakulesi&type=pb&tod=day&debug=1&dev=1&nolock=1${q}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__game, p = g.playerSoldier, V = p.pos.constructor;
    g.simulate = false; g.brains.forEach((b) => (b.update = () => {}));
    window.__adv = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) g.step(dt); };
    p.fly = false; g.devGod = true; g.hud.$('pause').style.display = 'none';
    const bots = g.soldiers.filter((s) => s !== p);
    window.__bots = bots;
    window.__hide = () => { for (const b of bots) { b.alive = false; b.vacant = true; b.pos.set(900, -50, 900); b.model.root.visible = false; } };
    window.__hide();
    window.__put = (s, x, y, z, yaw = 0) => { s.pos.set(x, y, z); s.vel.set(0, 0, 0); s.yaw = yaw; s.pitch = 0; };
    window.__bot = (i, x, y, z, ry) => { const b = bots[i]; b.vacant = false; b.spawn({ x, z, ry }, 0); b.pos.set(x, y, z); b.protT = 0; b.model.root.visible = true; b.yaw = ry; return b; };
    window.__face = (s, t, h = 1.6) => { const e = s.eye(new V()), dx = t.x - e.x, dz = t.z - e.z, dy = t.y + h - e.y; s.yaw = Math.atan2(-dx, -dz); s.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
    // bot oyuncuya bir top atar (düşüş telafili), h: hedef yükseklik (1,1 gövde, 1,7 kafa)
    window.__shootMe = (b, h = 1.1) => {
      const e = b.eye(new V()), t = p.pos, dx = t.x - e.x, dz = t.z - e.z, dy = t.y + h - e.y, d = Math.hypot(dx, dz), st = { speed: 70, grav: 7 };
      b.yaw = Math.atan2(-dx, -dz); const tt = d / st.speed; b.pitch = Math.atan2(dy, d) + Math.atan2(0.5 * st.grav * tt * tt, d);
      b.bloom = 0; b.botExtraSpread = 0; b.cd = 0; b.switchT = 0; b.sinceShot = 9; b.adsT = 1; b.vel.set(0, 0, 0);
      const st0 = b.stat, sv = [st0.hip, st0.ads]; st0.hip = st0.ads = 0; b.tryFire(); [st0.hip, st0.ads] = sv;
    };
  });
  return page;
}
const shot = async (page, n) => { await page.waitForTimeout(220); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('görüntü', n); };

// ───────── masaüstü ─────────
if (!ONLY || ONLY === 'desk') {
  const page = await setup({ viewport: { width: 1280, height: 720 } });
  // zemin, güney kuşağı: oyuncu (−6, 0, 22) kuzeye bakar; hedef bot 25 m ötede kuyu kenarı yakınında değil, zeminde açık hatta
  const spot = await page.evaluate(() => {
    const g = window.__game, p = g.playerSoldier, V = p.pos.constructor;
    for (let k = 0; k < 3000; k++) {
      const x = -22 + Math.random() * 44, z = 14 + Math.random() * 9, a = Math.random() * 6.28, d = 24, bx = x + Math.sin(a) * d, bz = z - Math.cos(a) * d;
      if (Math.hypot(bx, bz) < 13 || Math.abs(bx) > 23 || Math.abs(bz) > 23 || Math.hypot(x, z) < 13) continue;
      const e = new V(x, 1.6, z), c = new V(bx, 1.1, bz), c2 = new V(bx, 1.7, bz), c0 = new V(bx, 0.4, bz);
      if (!g.world.clear(e, c) || !g.world.clear(e, c2) || !g.world.clear(e, c0) || !g.world.clear(e.clone().setY(2.4), c.clone().setY(2.2))) continue;
      if (g.world.raycast(new V(x, 3, z), new V(0, -1, 0), 4, {})?.point.y > 0.05 || g.world.raycast(new V(bx, 3, bz), new V(0, -1, 0), 4, {})?.point.y > 0.05) continue;
      return { x, z, bx, bz };
    }
    return null;
  });
  check(!!spot, 'açık 24 m atış hattı bulundu');
  await page.evaluate((s) => {
    const g = window.__game, p = g.playerSoldier;
    __put(p, s.x, 0, s.z); const b = __bot(0, s.bx, 0, s.bz, 0); __face(p, b, 1.1); __face(b, p, 1.6); p.ads = false; __adv(40);
  }, spot);
  await shot(page, '00-bel-artı');
  await page.evaluate(() => { const g = window.__game; g.playerSoldier.ads = true; __adv(40); });
  await shot(page, '01-nisan-halka-dusus');
  const ring0 = await page.evaluate(() => { const el = window.__game.hud.$('pbret'); return { on: el.style.display, r: el.style.getPropertyValue('--r'), marks: [...el.querySelectorAll('.m')].map((m) => m.style.top) }; });
  console.log('      halka', JSON.stringify(ring0));
  check(ring0.on === 'block' && parseFloat(ring0.r) < 16 && ring0.marks.length === 3, 'nişanda halka nişangâh + 3 düşüş çizgisi');
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.items[0].mag = 50; g.player.fireHeld = true; for (let i = 0; i < 90; i++) { __adv(1); window.__face(p, window.__bots[0], 1.1); p.pitch += 0.016 - p.recoilP; } });
  await shot(page, '02-seri-ates-acilma');
  const ring1 = await page.evaluate(() => { const g = window.__game; g.player.fireHeld = false; return parseFloat(g.hud.$('pbret').style.getPropertyValue('--r')); });
  check(ring1 > parseFloat(ring0.r) * 1.6, `seri atışta halka büyüdü (${ring0.r} → ${ring1}px)`);
  await page.evaluate(() => __adv(50));
  await shot(page, '03-biraktiktan-sonra');
  // ekrana boya: soldaki bot gövdeye vurur
  await page.evaluate(() => {
    const g = window.__game, p = g.playerSoldier; p.ads = false; __adv(20);
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const L = __bot(1, p.pos.x - rx * 9 + fx * 2, 0, p.pos.z - rz * 9 + fz * 2, 0); __shootMe(L, 1.1); __adv(14);
  });
  await shot(page, '04-boya-soldan');
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier, rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw); const R = __bot(2, p.pos.x + rx * 8, 0, p.pos.z + rz * 8, 0); __shootMe(R, 1.0); __adv(40); });
  await shot(page, '05-boya-sagdan-akiyor');
  const n1 = await page.evaluate(() => window.__game.hud._sp.list.length);
  check(n1 >= 2, `iki isabet = ekranda ${n1} leke`);
  await page.evaluate(() => __adv(200));
  const n2 = await page.evaluate(() => ({ n: window.__game.hud._sp?.list.length, vis: window.__game.hud._sp?.cv.style.display }));
  check(n2.n === 0 && n2.vis === 'none', `~3 sn'de söndü, tuval gizli (${JSON.stringify(n2)})`);
  // kafa
  await page.evaluate(() => { const b = __bots[0]; __face(window.__game.playerSoldier, b, 1.5); __shootMe(b, 1.66); __adv(24); });
  await shot(page, '06-boya-kafa');
  await page.evaluate(() => __adv(200));
  // yakından geçen top
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier, b = __bots[0]; const sv = p.pos.x; p.pos.x += 0.9 * Math.cos(p.yaw); p.pos.z -= 0.9 * Math.sin(p.yaw); __shootMe(b, 1.65); p.pos.x = sv; __adv(1); });
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw); p.pos.x -= rx * 0.9; p.pos.z -= rz * 0.9; __adv(22); });
  await shot(page, '07-yakin-gecen-top');
  const nm = await page.evaluate(() => window.__game.hud._sp.drops.length);
  check(nm >= 1, `yakından geçen top kenarda damlacık bıraktı (${nm})`);
  await page.evaluate(() => __adv(150));
  // elenme
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; g.devGod = false; p.hp = 10; p.protT = 0; __shootMe(__bots[0], 1.1); __adv(22); });
  await shot(page, '08-elenme-boyandin');
  const dead = await page.evaluate(() => ({ alive: window.__game.playerSoldier.alive, cover: window.__game.hud._sp.cover.length, rs: window.__game.hud.$('respawn').style.display }));
  check(!dead.alive && dead.cover >= 5 && dead.rs !== 'flex', `elendi: ekran ${dead.cover} lekeyle kaplı, ölüm ekranı henüz yok`);
  await page.evaluate(() => __adv(80));
  await shot(page, '09-sonra-olum-ekrani');
  const rs = await page.evaluate(() => window.__game.hud.$('respawn').style.display);
  check(rs === 'flex', 'BOYANDIN sonrası ölüm ekranı açıldı');
  await page.evaluate(() => { const g = window.__game; g.devGod = true; __adv(260); window.__hide(); });
  // kutular: uzaktan (Turuncu kale güvertesinden köprü + kule balkonu), yakından, yeniden belirirken
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; if (!p.alive) g.respawn(p); __put(p, -16.6, 9, -12.5); p.yaw = Math.atan2(16.6 - 9.5 - 4, -(-12.5 + 2.9 + 7)); __face(p, { x: -9.5, y: 9, z: -2.9 }, 0.4); __adv(30); });
  await shot(page, '10-kutu-kopru-can');
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; __put(p, -20.8, 9, -17.2); __face(p, { x: -23, y: 9, z: -23 }, 0.5); __adv(30); });
  await shot(page, '11-kutu-kulube-boya');
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; __put(p, 20, 0, 6); __face(p, { x: 13, y: 0, z: -3 }, 0.6); __adv(30); });
  await shot(page, '12-kutu-zemin-can-kuyu');
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; __put(p, -12, 0, 22); __face(p, { x: 0, y: 6, z: 0 }, 0); p.pitch = 0.18; __adv(30); });
  await shot(page, '13-kutular-uzaktan');
  // al: canı 55 iken doğu kuyu kenarındaki can kutusuna yürü
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.hp = 55; __put(p, 13, 0, 0.2); __face(p, { x: 13, y: 0, z: -6 }, 1.2); g.player.keys.add('KeyW'); __adv(30); g.player.keys.delete('KeyW'); __adv(8); });
  await shot(page, '14-alindi-bildirim');
  const tk = await page.evaluate(() => { const g = window.__game, pk = g.pickups.list.find((q) => q.name === 'Doğu Kuyu Kenarı'); return { hp: g.playerSoldier.hp, t: pk.t, toast: [...g.hud.$('toasts').children].map((c) => c.textContent) }; });
  check(tk.hp === 95 && tk.t > 18 && tk.toast.some((t) => /\+40 CAN/.test(t)), `kutu alındı: can ${tk.hp}, ${tk.t.toFixed(1)} sn sonra yeniden, bildirim ${JSON.stringify(tk.toast)}`);
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; __put(p, 17, 0, -3.5); __face(p, { x: 13, y: 0, z: -3 }, 0.2); __adv(60 * 8); });
  await shot(page, '15-yeniden-belirirken');
  // çizim çağrısı / FPS (8 bot, gerçek maç)
  const perf = await page.evaluate(async () => {
    const g = window.__game, p = g.playerSoldier; for (const b of __bots) { b.vacant = false; b.model.root.visible = true; g.respawn(b); }
    g.brains.forEach((b) => delete b.update); g.simulate = true; __put(p, -12, 0, 22); __face(p, { x: 0, y: 6, z: 0 }, 0);
    await new Promise((r) => setTimeout(r, 1500));
    const calls = g.renderer.info.render.calls, t0 = performance.now(); let n = 0;
    await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
    return { fps: Math.round(n / 3), calls, frame: g._perf };
  });
  console.log('      perf', JSON.stringify(perf));
  await page.close();
}

// ───────── Pixel 7 (yatay, dokunmatik) ─────────
if (!ONLY || ONLY === 'mob') {
  const page = await setup({ ...devices['Pixel 7 landscape'] }, '&touch=1');
  await page.evaluate(() => {
    const g = window.__game, p = g.playerSoldier;
    __put(p, -6, 0, 21); const b = __bot(0, -6, 0, -3.5 + 0, 0); b.pos.set(6, 0, 18 - 24 + 0); __face(p, b, 1.1); p.ads = true; __adv(50);
  });
  await shot(page, '20-mobil-nisan-halka');
  const mob = await page.evaluate(() => ({ mob: document.body.classList.contains('mob'), touch: !!window.__game.player.touch, ring: window.__game.hud.$('pbret').style.display, r: window.__game.hud.$('pbret').style.getPropertyValue('--r') }));
  check(mob.mob && mob.touch && mob.ring === 'block', `telefonda dokunmatik nişanda halka (${JSON.stringify(mob)})`);
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.ads = false; __adv(20); const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw); const L = __bot(1, p.pos.x - rx * 8, 0, p.pos.z - rz * 8, 0); __shootMe(L, 1.1); __adv(14); __shootMe(__bots[0], 1.66); __adv(30); });
  await shot(page, '21-mobil-boya');
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; __adv(200); __put(p, -16.6, 9, -12.5); __face(p, { x: -9.5, y: 9, z: -2.9 }, 0.4); __adv(30); });
  await shot(page, '22-mobil-kutu');
  await page.close();
}
console.log('sayfa hatası:', errs.length, errs.slice(0, 5));
check(errs.length === 0, 'sayfa hatası yok');
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
