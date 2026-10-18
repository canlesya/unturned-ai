// Paintball v2 görüntüleri (Boya Kulesi, pb): halka nişangâh + düşüş çizgileri (masaüstü + Pixel 7 dokunmatik), seri atışta açılan halka,
// ekrana boya (yandan isabet, kafa, elenme + "BOYANDIN!", yakın geçen top), toplanabilir kutular (uzaktan, yakından, yeniden belirirken), bildirim.
//   GPU=1 node scripts/pb2shots.mjs [http://127.0.0.1:5207]      Çıktı: /tmp/wb-pb2-shots/*.png
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5221', OUT = process.env.OUT || '/tmp/wb-pb4-shots';
fs.mkdirSync(OUT, { recursive: true });
const GPU = !!process.env.GPU, ONLY = process.env.ONLY || '';
const browser = await chromium.launch(GPU ? { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };

async function setup(ctxOpt, q = '') {
  const ctx = await browser.newContext(ctxOpt);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
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
    window.__face = (s, t, h = 1.6) => { t = t.pos || t; const e = s.eye(new V()), dx = t.x - e.x, dz = t.z - e.z, dy = t.y + h - e.y; s.yaw = Math.atan2(-dx, -dz); s.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
    // bot oyuncuya bir top atar (düşüş telafili), h: hedef yükseklik (1,1 gövde, 1,7 kafa)
    window.__front = (i, d = 10) => { const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); const b = __bot(i, p.pos.x + fx * d, p.pos.y, p.pos.z + fz * d, p.yaw + Math.PI); b.hp = 9999; return b; };
    window.__side = (i, sgn) => {                     // yandan (sgn −1 sol / +1 sağ) açık görüş hattı olan bir yere bot koy
      const g = window.__game, rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw), fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), e = p.eye(new V());
      for (const d of [8, 6, 10, 5, 12, 4]) for (const f of [1, 0, 3, -1, 5]) { const x = p.pos.x + sgn * rx * d + fx * f, z = p.pos.z + sgn * rz * d + fz * f; if (g.world.clear(e, new V(x, p.pos.y + 1.6, z)) && g.world.clear(new V(p.pos.x, p.pos.y + 1.1, p.pos.z), new V(x, p.pos.y + 1.1, z))) { const b = __bot(i, x, p.pos.y, z, 0); b.hp = 9999; return b; } }
      return __bot(i, p.pos.x + sgn * rx * 6, p.pos.y, p.pos.z + sgn * rz * 6, 0);
    };
    window.__open = () => {                            // zeminde önü 9 m açık (kutu / siper yok) bir yer + bakış yönü
      const g = window.__game;
      for (let k = 0; k < 5000; k++) {
        const x = -22 + Math.random() * 44, z = -22 + Math.random() * 44, yaw = Math.random() * 6.283, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        if (Math.hypot(x, z) < 13 || Math.hypot(x + fx * 9, z + fz * 9) < 13 || Math.abs(x + fx * 9) > 23 || Math.abs(z + fz * 9) > 23) continue;
        if (g.pickups.list.some((q) => Math.hypot(q.x - x - fx * 4, q.z - z - fz * 4) < 5)) continue;
        let ok = true; for (const o of [-2.5, 0, 2.5]) for (const h of [0.3, 1.2, 2]) { const rx = Math.cos(yaw) * o, rz = -Math.sin(yaw) * o; if (!g.world.clear(new V(x + rx, h, z + rz), new V(x + rx + fx * 9, h, z + rz + fz * 9))) ok = false; }
        if (ok && !(g.world.raycast(new V(x, 3, z), new V(0, -1, 0), 4, {})?.point.y > 0.05)) return [x, 0, z, yaw];
      }
      return [-6, 0, 21, 0];
    };
    window.__shootMe = (b, h = 1.1, side = 0) => {
      if (!b.alive) { const P0 = b.pos.clone(); b.vacant = false; b.spawn({ x: P0.x, z: P0.z, ry: 0 }, 0); b.pos.copy(P0); b.model.root.visible = true; }
      b.hp = 9999; b.protT = 0; b.cur = 0; b.items[0] = { id: "pbrifle", mag: 50, reserve: 150 }; b.reloadT = 0; b.useT = 0; b.swing = null;
      const e = b.eye(new V()), d0x = p.pos.x - b.pos.x, d0z = p.pos.z - b.pos.z, d0 = Math.hypot(d0x, d0z) || 1, t = { x: p.pos.x - (d0z / d0) * side, y: p.pos.y, z: p.pos.z + (d0x / d0) * side }, dx = t.x - e.x, dz = t.z - e.z, dy = t.y + h - e.y, d = Math.hypot(dx, dz), st = { speed: 78, grav: 4 };
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
    const L = __side(1, -1); for (let k = 0; k < 3; k++) { const h0 = g.paint.stats.hits; __shootMe(L, 1.1); __adv(14); if (g.paint.stats.hits > h0) break; }      // ara sıra siper kenarına çarpar: en çok 3 deneme
  });
  await shot(page, '04-boya-soldan');
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier, rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw); const R = __side(2, 1); const h0 = g.paint.stats.hits; __shootMe(R, 1.0); __adv(40); window.__dbg2 = { hits: g.paint.stats.hits - h0, R: R.pos.toArray().map((v) => +v.toFixed(1)), P: p.pos.toArray().map((v) => +v.toFixed(1)), alive: R.alive, item: R.item.id, mag: R.item.mag }; });
  await shot(page, '05-boya-sagdan-akiyor');
  const n1 = await page.evaluate(() => window.__game.hud._sp.list.length); console.log('      ', JSON.stringify(await page.evaluate(() => window.__dbg2)));
  check(n1 >= 2, `iki isabet = ekranda ${n1} leke`);
  await page.evaluate(() => __adv(200));
  const n2 = await page.evaluate(() => ({ n: window.__game.hud._sp?.list.length, vis: window.__game.hud._sp?.cv.style.display }));
  check(n2.n === 0 && n2.vis === 'none', `~3 sn'de söndü, tuval gizli (${JSON.stringify(n2)})`);
  // kafa
  await page.evaluate(() => { const b = __front(3, 11); __shootMe(b, 1.66); __adv(24); });
  await shot(page, '06-boya-kafa');
  await page.evaluate(() => __adv(200));
  // yakından geçen top
  await page.evaluate(() => { const b = __front(3, 11); __shootMe(b, 1.6, 0.7); __adv(8); __shootMe(b, 1.5, -0.75); __adv(22); });
  await shot(page, '07-yakin-gecen-top');
  const nm = await page.evaluate(() => window.__game.hud._sp.drops.length);
  check(nm >= 1, `yakından geçen top kenarda damlacık bıraktı (${nm})`);
  await page.evaluate(() => __adv(150));
  // elenme
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; g.devGod = false; p.hp = 10; p.protT = 0; __shootMe(__front(3, 11), 1.1); __adv(22); });
  const txt = await page.evaluate(() => { const e = document.getElementById('pbdead'); return { on: e.classList.contains('on'), t: e.textContent }; });
  await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/08-elenme-boyandin.png` }); console.log('görüntü 08');
  const op = await page.evaluate(() => { const a = document.getElementById('pbdead').getAnimations()[0]; return a && a.playState === 'running' ? a.currentTime : -1; });
  check(txt.on && op > 150, `elenince "${txt.t}" yazısı canlanıyor (${Math.round(op)} ms)`);
  const dead = await page.evaluate(() => ({ hp: window.__game.playerSoldier.hp, b0: [__bots[0].alive, __bots[0].pos.toArray()], live: window.__game.paint.live.length, alive: window.__game.playerSoldier.alive, cover: window.__game.hud._sp.cover.length, rs: window.__game.hud.$('respawn').style.display }));
  console.log('      ', JSON.stringify(dead)); check(!dead.alive && dead.cover >= 5 && dead.rs !== 'flex', `elendi: ekran ${dead.cover} lekeyle kaplı, ölüm ekranı henüz yok`);
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
  await page.evaluate(() => {                                      // açık bir yönden 3 m geriden yürüyerek yaklaş
    const g = window.__game, p = g.playerSoldier, V = p.pos.constructor, pk = g.pickups.list.find((q) => q.name === 'Doğu Kuyu Kenarı'); p.hp = 55;
    let st = null; for (let k = 0; k < 16 && !st; k++) { const a = k / 16 * 6.283, x = pk.x + Math.sin(a) * 3, z = pk.z + Math.cos(a) * 3; if (g.world.clear(new V(x, 0.5, z), new V(pk.x, 0.5, pk.z)) && g.world.clear(new V(x, 1.5, z), new V(pk.x, 1.5, pk.z)) && Math.hypot(x, z) > 12) st = [x, z]; }
    __put(p, st[0], 0, st[1]); __face(p, { x: pk.x, y: 0, z: pk.z }, 0.9); g.player.keys.add('KeyW'); __adv(34); g.player.keys.delete('KeyW'); __adv(8); });
  await shot(page, '14-alindi-bildirim');
  const tk = await page.evaluate(() => { const g = window.__game, pk = g.pickups.list.find((q) => q.name === 'Doğu Kuyu Kenarı'); return { hp: g.playerSoldier.hp, t: pk.t, toast: [...g.hud.$('toasts').children].map((c) => c.textContent) }; });
  check(tk.hp === 95 && tk.t > 18 && tk.toast.some((t) => /\+40 CAN/.test(t)), `kutu alındı: can ${tk.hp}, ${tk.t.toFixed(1)} sn sonra yeniden, bildirim ${JSON.stringify(tk.toast)}`);
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.pos.x += 1.5 * Math.sin(p.yaw); p.pos.z += 1.5 * Math.cos(p.yaw); __face(p, { x: 13, y: 0, z: -3 }, 0.2); __adv(60 * 8); });
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

// ───────── paintball kıyafetleri: yakın (ön / arka), orta mesafe, 8 renkli grup, birinci şahıs kolu ─────────
if (!ONLY || ONLY === 'fit') {
  const page = await setup({ viewport: { width: 1280, height: 720 } });
  const fit = async (n, fn, arg) => { await page.evaluate(fn, arg); await shot(page, n); };
  await fit('30-kiyafet-yakin-on', () => { const g = window.__game, p = g.playerSoldier; window.__o = __open(); __put(p, ...window.__o); const b = __front(0, 2.3); b.yaw = p.yaw + Math.PI; __face(p, b, 1.25); p.pitch -= 0.02; g.player.vm.root && (g.player.vm.root.visible = false); __adv(4); });
  await fit('31-kiyafet-yakin-arka', () => { const g = window.__game, p = g.playerSoldier; const b = __bots[0]; b.yaw = p.yaw; __adv(4); });
  await fit('32-kiyafet-orta', () => { const g = window.__game, p = g.playerSoldier; const b = __bots[0]; b.yaw = p.yaw + Math.PI * 0.75; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); b.pos.set(p.pos.x + fx * 7, 0, p.pos.z + fz * 7); __face(p, b, 1.0); __adv(4); });
  await fit('33-kiyafet-grup-8-renk', () => {
    const g = window.__game, p = g.playerSoldier; __put(p, ...window.__o); __hide();
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const N = Math.min(8, __bots.length); for (let i = 0; i < N; i++) { const o = (i - (N - 1) / 2) * 1.05, d = 5.2 + (i % 2) * 0.9; const b = __bot(i, p.pos.x + fx * d + rx * o, 0, p.pos.z + fz * d + rz * o, p.yaw + Math.PI + (i % 3 - 1) * 0.5); b.hp = 9999; }
    p.pitch = -0.08; __adv(4);
  });
  await page.evaluate(() => { const g = window.__game; if (g.player.vm.root) g.player.vm.root.visible = true; __hide(); });
  await fit('34-birinci-sahis-kol', () => { const g = window.__game, p = g.playerSoldier; __put(p, -6, 0, 21, 0); p.pitch = -0.05; p.ads = false; __adv(30); });
  await fit('35-birinci-sahis-tabanca', () => { const g = window.__game, p = g.playerSoldier; p.cur = 1; g.player.refreshWeapon(); __adv(40); });
  const info = await page.evaluate(() => { const g = window.__game; return { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, look: g.player.vm.look, drawPerChar: (() => { let n = 0; g.soldiers[1].model.root.traverse((o) => { if (o.isMesh) n++; }); return n; })() }; });
  console.log('      kıyafet', JSON.stringify(info));
  check(info.look && info.look.shirt && info.drawPerChar <= 24, 'birinci şahıs kolu forma renginde, karakter başına ağ sayısı makul');
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
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; p.ads = false; __adv(20); const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw); const L = __side(1, -1); __shootMe(L, 1.1); __adv(14); __shootMe(__front(3, 9), 1.66); __adv(30); });
  await shot(page, '21-mobil-boya');
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; __adv(200); __put(p, -16.6, 9, -12.5); __face(p, { x: -9.5, y: 9, z: -2.9 }, 0.4); __adv(30); });
  await shot(page, '22-mobil-kutu');
  await page.close();
}
// ───────── çevrimiçi (sunucu BF_DEBUG=1, WS=ws://…): kutu alınca bildirim + kutu gizlenir, can sunucudan ─────────
if (process.env.WS && (!ONLY || ONLY === 'net')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?${new URLSearchParams({ debug: '1', nolock: '1', server: process.env.WS, online: 'new', type: 'pb', map: 'boyakulesi', per: '4', name: 'Boyacı' })}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier && window.__game.playerSoldier.alive', null, { timeout: 90000 });
  await page.evaluate(() => { const n = window.__game.online; n.send({ t: 'dbg', bots: false }); });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { const n = window.__game.online; n.send({ t: 'dbg', hp: 45 }); n.send({ t: 'dbg', tp: [13, -3] }); });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => { const g = window.__game, pk = g.pickups.list[8]; return { name: pk.name, t: pk.t, hp: g.playerSoldier.hp, toast: [...g.hud.$('toasts').children].map((c) => c.textContent) }; });
  await shot(page, '40-cevrimici-kutu-alindi');
  check(r.t > 15 && r.hp === 85 && r.toast.some((x) => /\+40/.test(x)), `çevrimiçi: ${r.name} alındı (can ${r.hp}, ${r.t.toFixed(1)} sn sonra yeniden), bildirim ${JSON.stringify(r.toast)}`);
  await ctx.close();
}
console.log('sayfa hatası:', errs.length, errs.slice(0, 5));
check(errs.length === 0, 'sayfa hatası yok');
await browser.close();
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
