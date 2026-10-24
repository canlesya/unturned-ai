// Uzak mesafe atış ölçümü (12.146) — çevrimdışı, botlar donuk, hedef açık bir şeritte 25…200 m'de, tam göğüs ortasına nişan.
// Her silah × mesafe: tek tek atış (ilk atış isabeti) ve seri atış (bloom birikir, tepme kusursuz telafi), nişanda ve belde.
// Ölçülen: isabet % (hasar veren atış), atış başına ortalama hasar, iz (tracer) hedefe kadar çizildi mi, kan efekti oluştu mu,
// hedefin arkasındaki duvarda (ıskalayan atış) toz / iz var mı.
//   node scripts/farshot.mjs [map=colgecidi] [url=http://127.0.0.1:5180]     env: N=30 SHOT=1 (ekran görüntüleri screenshots/farshot/)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const MAP = process.argv[2] || 'colgecidi', BASE = process.argv[3] || 'http://127.0.0.1:5180', N = +(process.env.N || 30);
const WEAPONS = (process.env.W || 'm4a1,ak47,svd,sniper,mp5,pistol,shotgun').split(',');
const DISTS = (process.env.D || '25,50,75,100,150,200').split(',').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/?autostart=4v4&map=${MAP}&type=tdm&dev=1&debug=1&nolock=1`);
await page.waitForFunction(() => window.__game?.playerSoldier && window.__game.running, null, { timeout: 120000 });
await page.waitForTimeout(1500);
if (process.env.AIR) await page.evaluate(() => (window.__AIR = true));

const lane = await page.evaluate((DISTS) => {
  const g = window.__game, me = g.playerSoldier, V = me.pos.constructor;
  g.brains.forEach((b) => (b.update = () => {}));
  me.protT = 1e9; g.devGod = true;
  const others = g.soldiers.filter((s) => s !== me);
  for (const o of others) { o.pos.set(o.pos.x + 900, o.pos.y - 300, o.pos.z + 900); o.vel.set(0, 0, 0); }
  const f = others.find((s) => s.team !== me.team);
  window.__f = f;
  // açık şerit: göz → her mesafedeki hedefin göğsü / başı / ayağı engelsiz; yükseklik farkı ≤ 3 m; dört ana yön
  const b = g.map.bounds, eye = new V(), tp = new V(), d = new V();
  const dirs = Array.from({ length: 16 }, (_, a) => [Math.sin(a * Math.PI / 8), Math.cos(a * Math.PI / 8)]);
  const okAt = (x, y, z, dx, dz, D) => {
    const tx = x + dx * D, tz = z + dz * D, ty = g.world.heightAt(tx, tz);
    if (!Number.isFinite(ty) || Math.abs(ty - y) > 3 || (g.nav.isFree && !g.nav.isFree(tx, tz))) return false;
    for (const hy of [0.3, 1.1, 1.65]) if (!g.world.clear(eye, tp.set(tx, ty + hy, tz))) return false;
    return true;
  };
  if (window.__AIR) {                                                                          // AIR=1: haritanın 45 m üstünde, köşegen boyunca serbest şerit (yalnız atış mantığı; engel yok)
    const y = 45, x = b.minX + 5, z = b.minZ + 5, L = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ), dx = (b.maxX - b.minX) / L, dz = (b.maxZ - b.minZ) / L;
    me.pos.set(x, y, z); me.vel.set(0, 0, 0); me.fly = true;
    g.world.heightAt = ((h) => (px, pz) => (Math.abs(px - x) < 900 && window.__AIRON ? y : h(px, pz)))(g.world.heightAt.bind(g.world)); window.__AIRON = true;
    return { x, y, z, dx, dz, k: DISTS.length, max: DISTS.at(-1), air: true };
  }
  // her başlangıç × yön için DISTS'in sağlanan en uzun öneki; en uzunu seçilir (tam liste bulunursa hemen)
  let best = null;
  for (let x = b.minX + 3; x < b.maxX - 3 && best?.k !== DISTS.length; x += 3) for (let z = b.minZ + 3; z < b.maxZ - 3; z += 3) {
    if (g.nav.isFree && !g.nav.isFree(x, z)) continue;
    const y = g.world.heightAt(x, z); eye.set(x, y + 1.6, z);
    for (const [dx, dz] of dirs) {
      let k = 0; while (k < DISTS.length && okAt(x, y, z, dx, dz, DISTS[k])) k++;
      if (k && (!best || k > best.k)) best = { x, y, z, dx, dz, k, max: DISTS[k - 1] };
      if (k === DISTS.length) break;
    }
    if (best?.k === DISTS.length) break;
  }
  if (best) { me.pos.set(best.x, best.y, best.z); me.vel.set(0, 0, 0); }
  return best;
}, DISTS);
console.log('şerit', MAP, JSON.stringify(lane));
if (!lane) { await browser.close(); process.exit(1); }

const res = await page.evaluate(async ({ lane, WEAPONS, DISTS, N }) => {
  const g = window.__game, me = g.playerSoldier, f = window.__f, V = me.pos.constructor, E = g.effects;
  // efekt kancaları: iz uzunluğu, kan, toz
  const log = (window.__fx = { tr: [], blood: 0, dust: 0, decal: 0 });
  const tr = E.tracer.bind(E), bl = E.blood.bind(E), du = E.dust.bind(E), de = E.decal.bind(E);
  E.tracer = (a, b, c) => { log.tr.push(a.distanceTo(b)); return tr(a, b, c); };
  E.blood = (...a) => { log.blood++; return bl(...a); };
  E.dust = (...a) => { log.dust++; return du(...a); };
  E.decal = (...a) => { log.decal++; return de(...a); };
  const out = [];
  const place = (D) => {
    const tx = lane.x + lane.dx * D, tz = lane.z + lane.dz * D;
    f.alive = true; f.maxHp = f.hp = 1e9; f.protT = 0; f.vel.set(0, 0, 0); if (lane.air) f.fly = true;
    f.pos.set(tx, g.world.heightAt(tx, tz), tz); f.yaw = Math.atan2(lane.dx, lane.dz);      // bize bakar
    if (f.crouching) f.toggleCrouch?.();
  };
  const aim = () => {                                                                         // tam göğüs ortası (gövde kutusunun ortası)
    const e = me.eye(new V()), c = new V(f.pos.x, f.pos.y + f.height * 0.55, f.pos.z);
    me.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); me.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z));
    me.recoilP = 0;
  };
  for (const w of WEAPONS) {
    me.items[0] = { id: w, mag: 999, reserve: 0 }; me.cur = 0; me.switchT = 0; me.reloadT = 0;
    const st = me.stat;
    for (const ads of [1, 0]) for (const mode of ['tek', 'seri']) for (const D of DISTS) {
      if (D > lane.max) continue;
      place(D);
      me.ads = !!ads; me.adsT = ads; me.vel.set(0, 0, 0); me.onGround = true; me.sprinting = false; me.crouching = false;
      me.bloom = 0; me.sinceShot = 9;
      let hits = 0, dmg = 0, trToTarget = 0, bloodN = 0;
      const shots = mode === 'seri' && (st.pellets || 1) > 1 ? 0 : N;
      for (let i = 0; i < shots; i++) {
        if (mode === 'tek') { me.bloom = 0; me.sinceShot = 9; }
        else { const dt = 60 / st.rpm; if (i % 10 === 0) { me.bloom = 0; me.sinceShot = 9; } else { me.sinceShot = dt; me.bloom = Math.max(0, me.bloom - dt * 0.05); } }
        aim(); me.cd = 0; me.items[0].mag = 999;
        const hp0 = f.hp; log.tr.length = 0; const b0 = log.blood;
        me.tryFire();
        const dd = hp0 - f.hp; if (dd > 0) { hits++; dmg += dd; }
        if (log.blood > b0) bloodN++;
        if (log.tr.some((L) => L >= D - 2)) trToTarget++;
      }
      if (shots) out.push({ w, ads, mode, D, n: shots, hit: hits / shots, dmg: dmg / shots, perHit: hits ? dmg / hits : 0, tr: trToTarget / shots, blood: bloodN / shots });
    }
  }
  // arka duvar testi: hedefi kaldırıp şeridin sonuna (lane.max + birkaç m) ateş → toz / iz nereye kadar
  f.pos.set(f.pos.x + 900, f.pos.y - 300, f.pos.z + 900);
  const wall = [];
  for (const w of WEAPONS) {
    me.items[0] = { id: w, mag: 999, reserve: 0 }; me.cur = 0;
    const e = me.eye(new V()), dir = new V(lane.dx, 0, lane.dz);
    const hit = g.world.raycast(e, dir, 1000, {});
    me.yaw = Math.atan2(-lane.dx, -lane.dz); me.pitch = 0; me.recoilP = 0; me.adsT = 1; me.bloom = 0; me.sinceShot = 9; me.cd = 0;
    log.tr.length = 0; const d0 = log.dust, dc0 = log.decal;
    me.tryFire();
    wall.push({ w, wallAt: hit ? +hit.t.toFixed(1) : null, tracer: log.tr.map((x) => +x.toFixed(1)), dust: log.dust - d0, decal: log.decal - dc0 });
  }
  return { out, wall };
}, { lane, WEAPONS, DISTS, N });

const pad = (s, n) => String(s).padEnd(n);
for (const ads of [1, 0]) for (const mode of ['tek', 'seri']) {
  console.log(`\n== ${MAP} · ${ads ? 'NİŞANDA' : 'BELDEN'} · ${mode === 'tek' ? 'tek tek (ilk atış)' : 'seri (10\'luk, bloom)'} · isabet% / ort.hasar(atış başı) / iz hedefe% / kan% ==`);
  console.log(pad('silah', 9) + DISTS.map((D) => pad(D + ' m', 22)).join(''));
  for (const w of WEAPONS) {
    const row = res.out.filter((r) => r.w === w && r.ads === ads && r.mode === mode);
    if (!row.length) continue;
    console.log(pad(w, 9) + DISTS.map((D) => { const r = row.find((x) => x.D === D); return pad(r ? `${Math.round(r.hit * 100)}% ${r.dmg.toFixed(0)} t${Math.round(r.tr * 100)} k${Math.round(r.blood * 100)}` : '-', 22); }).join(''));
  }
}
console.log('\n== arka duvar (hedefsiz, nişanda tek atış): duvar mesafesi / iz uzunlukları / toz / iz-izi (decal) ==');
for (const r of res.wall) console.log(pad(r.w, 9), `duvar ${r.wallAt} m · iz ${JSON.stringify(r.tracer)} · toz ${r.dust} · iz-izi ${r.decal}`);

if (process.env.SHOT) {
  // ekran görüntüsü: nişanda hedefe (ya da D=wall: hedefsiz, şerit sonundaki duvara) bakılır, döngü durdurulur, tek atış + 0,04 sn efekt ilerlemesi + çizim
  const OUT = process.env.OUT || 'screenshots/farshot'; mkdirSync(OUT, { recursive: true });
  for (const [w, D] of (process.env.SHOT === '1' ? 'm4a1:150,pistol:150,shotgun:wall' : process.env.SHOT).split(',').map((x) => x.split(':'))) {
    await page.evaluate(({ lane, w, D }) => {
      const g = window.__game, me = g.playerSoldier, f = window.__f, V = me.pos.constructor;
      me.items[0] = { id: w, mag: 999, reserve: 0 }; me.cur = 0; me.switchT = 0; me.reloadT = 0;
      const tx = lane.x + lane.dx * D, tz = lane.z + lane.dz * D;
      if (D === 'wall') f.pos.set(f.pos.x + 900, f.pos.y - 300, f.pos.z + 900);
      else { f.alive = true; f.maxHp = f.hp = 1e9; if (lane.air) f.fly = true; f.vel.set(0, 0, 0); f.pos.set(tx, g.world.heightAt(tx, tz), tz); f.yaw = Math.atan2(lane.dx, lane.dz); }
      window.__aim = () => {
        const e = me.eye(new V());
        if (D === 'wall') { me.yaw = Math.atan2(-lane.dx, -lane.dz); me.pitch = 0; }
        else { const c = new V(f.pos.x, f.pos.y + f.height * 0.55, f.pos.z); me.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); me.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z)); }
        me.recoilP = 0; me.ads = true;
      };
      clearInterval(window.__aimT); window.__aimT = setInterval(window.__aim, 16);
    }, { lane, w, D: D === 'wall' ? 'wall' : +D });
    await page.waitForTimeout(+(process.env.SETTLE || 4000));
    await page.evaluate(() => {
      const g = window.__game, me = g.playerSoldier;
      clearInterval(window.__aimT); cancelAnimationFrame(g.raf); window.__aim();
      g.effects.update(60);                                                                  // önceki atışların kalan efektleri (kan / toz / iz-izi) temizlenir
      me.bloom = 0; me.sinceShot = 9; me.cd = 0; me.items[0].mag = 999; const fired = me.tryFire();
      g.effects.update(0.04); g.render();
      const E = g.effects; return { fired, parts: E.parts.length, tracers: E.tracers.length, size: E.parts.map((m) => +m.scale.x.toFixed(2)) };
    }).then((r) => console.log('kare', w, D, JSON.stringify(r)));
    const name = `${OUT}/${MAP}-${w}-${D}${D === 'wall' ? '' : 'm'}${process.env.TAG ? '-' + process.env.TAG : ''}`;
    await page.screenshot({ path: `${name}.png` });
    await page.screenshot({ path: `${name}-orta.png`, clip: { x: 640 - 120, y: 360 - 68, width: 240, height: 136 } });
    await page.evaluate(() => { const g = window.__game; g.last = performance.now(); g.raf = requestAnimationFrame(g.loop); });
  }
  console.log('ekran görüntüleri:', OUT);
}
console.log('sayfa hatası:', errs.length, errs[0] || '');
await browser.close();
