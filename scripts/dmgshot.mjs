// 12.207 hasar ölçümü (gerçek GPU, pencereli, --use-angle=metal, çevrimdışı Kuzey Vadisi): helikopter burun topu / kapı makinelisi / roket bir
// askere vurur, el bombası patlar (uzaklığa göre hasar), geliştirici ölümsüzlüğünde (O) oyuncunun bindiği araç hasar almaz / yanmaz, botun aracı alır.
//   URL=http://127.0.0.1:5190 OUT=/tmp/wb-dmg node scripts/dmgshot.mjs
// Burun topu ve roket oyunun kendi döngüsünden ateşlenir (pilot girdisi: fireHeld + seçili silah); artı (kamera ışını) hedef askere konur.
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5190', OUT = process.env.OUT || '/tmp/wb-dmg';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
let bad = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  HATA ') + m); if (!c) bad++; };
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=8v8&map=kuzey&type=conquest&tod=day&dev=1&debug=1&nolock=1&nologin=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1500);
const ev = (f, a) => page.evaluate(f, a);
const R = {};

await ev(() => {
  const g = window.__game, me = g.playerSoldier, V = g.vehicles;
  g.brainsOff = g.brains.splice(0); g.devGod = true;
  window.__hits = [];
  for (const e of g.soldiers) { const td = e.takeDamage.bind(e); e.takeDamage = (a, at, z, fp, w) => { if (e !== me) window.__hits.push({ id: e.id, a: Math.round(a), z, w }); return td(a, at, z, fp, w); }; }
  window.__foes = g.soldiers.filter((e) => e.team !== me.team);
  window.__place = (e, x, z) => { e.vacant = false; e.spawn({ x, z, ry: 0 }, 0); g.world.settle(e); e.vel.set(0, 0, 0); e.protT = 0; e.maxHp = 100; e.hp = 100; e.crouching = false; e.prone = false; return e; };
  window.__park = () => { for (const [i, f] of window.__foes.entries()) window.__place(f, 300 + i * 6, -300); };
  window.__seat = (x, z, y, seat = 0) => {
    const v = V.list.find((o) => o.id === 'B-H1');
    if (me.veh) V.exit(me);
    if (!v.alive) V.trySpawn(v, true);
    v.hp = v.def.hp; v.rk = v.def.rockets.n; v.rkR = v.rkT = 0;
    v.st.x = x; v.st.z = z; v.st.y = y; v.st.yaw = 0; v.st.pitch = 0; v.st.roll = 0; v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = true; v.st.rpm = 1; v.sleep = false;
    me.pos.set(x + 3, y, z); V.enter(me, v, seat); g.player.vehCam = 'third'; me.yaw = 0; me.pitch = -0.3; me.vheat = 0; me.vhot = false; me.vw = 0;
    return v;
  };
  // artıyı (kamera ışını) T noktasına tut
  window.__aim = (T) => { clearInterval(window.__ai); const f = () => { const c = g.camera.position, dx = T.x - c.x, dy = T.y - c.y, dz = T.z - c.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(dy, Math.hypot(dx, dz)) + (me.veh && me.seat === 0 ? 0.16 : 0); const v = me.veh; if (v) { v.st.vx = v.st.vy = v.st.vz = 0; } }; f(); window.__ai = setInterval(f, 8); };
  window.__park();
});
const HX = 0, HZ = 430;
const HY = await ev(([x, z]) => window.__game.world.heightAt(x, z) + 30, [HX, HZ]);
// artının yerdeki noktası (kamera ışını) pitch eğiminde: hedef asker oraya konur (arazi tümseği ışını kesmesin)
const groundAim = (pt, yaw = 0) => ev(async ([pt, yaw]) => { const g = window.__game, me = g.playerSoldier; clearInterval(window.__ai); if (me.seat > 0) { me.yaw = yaw; await new Promise((r) => setTimeout(r, 100)); if (g.vehicles.gunState(me) === 'arc') yaw = -yaw; } const f = () => { me.pitch = pt; me.yaw = yaw; const v = me.veh; if (v) v.st.vx = v.st.vy = v.st.vz = 0; }; window.__ai = setInterval(f, 8); f(); await new Promise((r) => setTimeout(r, 1500)); const q = pt - 0.16, d = g.camera.position.clone().set(-Math.sin(me.yaw) * Math.cos(q), Math.sin(q), -Math.cos(me.yaw) * Math.cos(q)); /* player.js: 3. şahıs nişan = bakış − 0,16 */ const h = g.world.raycast(g.camera.position, d, 600, {}); const P = h && h.point; return P ? { x: P.x, y: P.y, z: P.z } : null; }, [pt, yaw]);

// 1) burun topu: 45 m önde (yerde) duran asker
async function gunTest(label, seat, pt, shotName, yaw = 0) {
  await ev(([HX, HZ, HY, seat]) => { window.__park(); window.__seat(HX, HZ, HY, seat); }, [HX, HZ, HY, seat]);
  const P = await groundAim(pt, yaw);
  const r = await ev(async ([P, seat]) => {
    const g = window.__game, me = g.playerSoldier;
    const f = window.__foes[0], x = P.x, z = P.z;
    window.__place(f, x, z);
    const c = f.center(); window.__aim({ x: c.x, y: c.y, z: c.z });
    await new Promise((r) => setTimeout(r, 1500));
    window.__place(f, x, z); window.__hits = [];
    g.player.fireHeld = true;
    const t0 = performance.now();
    while (f.alive && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 16));
    g.player.fireHeld = false;
    window.__dbg = { gs: g.vehicles.gunState(me), P: me.gunAim?.P, vp: me.veh?.st.pitch };
    return { dbg: window.__dbg, dead: !f.alive, hits: window.__hits.filter((h) => h.id === f.id), t: Math.round(performance.now() - t0), range: +Math.hypot(f.pos.x - me.pos.x, f.pos.y - me.pos.y, f.pos.z - me.pos.z).toFixed(1) };
  }, [P, seat]);
  const direct = r.hits.filter((h) => h.w === shotName);
  if (!r.dead) console.log(JSON.stringify(r.dbg));
  console.log(`${label}: ${r.range} m · ${r.dead ? 'öldü' : 'YAŞIYOR'} · ${r.t} ms · isabetler ${JSON.stringify(r.hits.map((h) => h.a + (h.z === 'head' ? 'k' : '')))}`);
  return { ...r, direct };
}
const nose = await gunTest('burun topu', 0, -0.5, 'Burun topu');
await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/01-burun-topu-isabet.png` });
R.nose = nose;
ok(nose.dead && nose.direct.length <= 2 || nose.dead && nose.hits.length <= 3, `burun topu askeri 1–2 isabette öldürür (${nose.direct.length} doğrudan, ${nose.hits.length} hasar olayı)`);
const door = await gunTest('kapı makinelisi', 1, -0.55, 'Kapı makinelisi', Math.PI / 2);
await page.screenshot({ path: `${OUT}/01b-kapi-makinelisi.png` });
R.door = door;
ok(door.dead && door.direct.length >= 2 && door.direct.length <= 4, `kapı makinelisi askeri 3–4 mermide öldürür (${door.direct.length})`);

// 2) roket: artı askerin dibine (yere); çevreye 3 / 4,5 / 6 / 7,5 / 9 m'de askerler
await ev(([HX, HZ, HY]) => { window.__park(); window.__seat(HX, HZ, HY, 0); }, [HX, HZ, HY]);
const RT = await groundAim(-0.5);
R.rocket = await ev(async ([T]) => {
  const g = window.__game, me = g.playerSoldier, F = window.__foes, v = me.veh;
  const D = [0, 3, 4.5, 6, 7.5, 9];
  window.__aim(T); await new Promise((r) => setTimeout(r, 1500));
  D.forEach((d, i) => window.__place(F[i], T.x + d, T.z));
  window.__hits = []; me.vw = 1; g.player.fireHeld = true;
  await new Promise((r) => setTimeout(r, 60)); g.player.fireHeld = false;
  await new Promise((r) => setTimeout(r, 700));
  return { T, fired: 14 - v.rk, rows: D.map((d, i) => ({ d, dmg: window.__hits.filter((h) => h.id === F[i].id).reduce((s, h) => s + h.a, 0), dead: !F[i].alive })) };
}, [RT]);
await page.screenshot({ path: `${OUT}/02-roket-patlama.png` });
console.log('roket:', JSON.stringify(R.rocket));
{ const r = R.rocket.rows; ok(r[0].dead && r[1].dead && r[2].dead && !r[4].dead && r[4].dmg > 0, `roket: doğrudan + 3 / 4,5 m öldürür, 7,5 m yaralar (${r.map((x) => x.d + 'm ' + x.dmg + (x.dead ? '✝' : '')).join(' · ')})`); }

// 3) el bombası: aynı dizilim, bomba yerde patlar (oyunun fragBlast'ı)
R.nade = await ev(async () => {
  const g = window.__game, me = g.playerSoldier, F = window.__foes, V = g.vehicles;
  if (me.veh) V.exit(me);
  window.__park();
  const T = { x: 40, z: 380 }; T.y = g.world.heightAt(T.x, T.z) + 0.1;
  const D = [2, 4, 4.5, 6, 8, 9];
  D.forEach((d, i) => window.__place(F[i], T.x + d, T.z));
  me.pos.set(T.x - 14, g.world.heightAt(T.x - 14, T.z + 6), T.z + 6); me.yaw = Math.atan2(14, -6) - Math.PI; me.pitch = -0.25; g.player.vehCam = null;
  await new Promise((r) => setTimeout(r, 400));
  window.__hits = [];
  const st = (await import('/src/game/stats.js')).WSTATS.grenade;
  g.fragBlast(new (me.pos.constructor)(T.x, T.y, T.z), st, me);
  await new Promise((r) => setTimeout(r, 150));
  return D.map((d, i) => ({ d, dmg: window.__hits.filter((h) => h.id === F[i].id).reduce((s, h) => s + h.a, 0), dead: !F[i].alive }));
});
await page.screenshot({ path: `${OUT}/03-el-bombasi.png` });
console.log('el bombası:', JSON.stringify(R.nade));
{ const r = R.nade; ok(r[0].dead && r[1].dead && r[2].dead && !r[3].dead && r[3].dmg > 30 && r[5].dmg > 0, `el bombası: ≤ 4,5 m öldürür, 6 m orta, 9 m az (${r.map((x) => x.d + 'm ' + x.dmg + (x.dead ? '✝' : '')).join(' · ')})`); }

// 4) geliştirici ölümsüzlüğü: oyuncunun jipi hasar almaz / yanmaz; O kapalıyken alır; botun jipi alır
R.god = await ev(async () => {
  const g = window.__game, me = g.playerSoldier, V = g.vehicles, F = window.__foes;
  window.__park(); clearInterval(window.__ai);
  const jeeps = V.list.filter((o) => o.type === 'jip' && o.alive), j = jeeps[0], bj = jeeps[1];
  if (me.veh) V.exit(me);
  j.st.x = 20; j.st.z = 400; j.st.y = g.world.heightAt(20, 400); j.st.yaw = 0; j.st.vx = j.st.vy = j.st.vz = 0; j.sleep = false; j.hp = j.def.hp;
  me.pos.set(22, j.st.y, 400); V.enter(me, j, 0); g.player.vehCam = 'third'; me.yaw = Math.PI * 0.8; me.pitch = -0.2;
  const foe = F[0];
  g.devGod = true;
  const h0 = j.hp;
  V.damage(j, 5000, foe, 'at', 'RPG-7'); g.explode(new (me.pos.constructor)(j.st.x + 1, j.st.y + 0.5, j.st.z), 7.5, 160, foe, 'RPG-7', undefined, 'at');
  const h1 = j.hp; j.hp = j.def.hp * 0.1; await new Promise((r) => setTimeout(r, 1500));
  const godRes = { hp0: h0, hpAfterHits: h1, alive: j.alive, burn: j.burn, hpLow: Math.round(j.hp), meAlive: me.alive, hud: document.querySelector('#vhPanel .nm')?.textContent };
  j.hp = j.def.hp;
  // bot jipi (oyuncu içinde değil) hasar alır
  const bot = g.soldiers.find((s) => s.team === me.team && s !== me && !s.veh);
  bot.pos.set(bj.st.x + 2, bj.st.y, bj.st.z); bot.alive = true; V.enter(bot, bj, 0); const b0 = bj.hp; V.damage(bj, 100, foe, 'at', 'RPG-7'); const botDmg = b0 - bj.hp;
  V.exit(bot);
  // O kapalı: oyuncunun jipi hasar alır
  g.devGod = false; const p0 = j.hp; V.damage(j, 100, foe, 'at', 'RPG-7'); const offDmg = p0 - j.hp; g.devGod = true; j.hp = j.def.hp;
  return { ...godRes, hpNow: Math.round(j.hp), botDmg: Math.round(botDmg), offDmg: Math.round(offDmg) };
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/04-dev-olumsuz-arac-hud.png` });
console.log('ölümsüz araç:', JSON.stringify(R.god));
ok(R.god.alive && !R.god.burn && R.god.hpAfterHits === R.god.hp0 && R.god.hpLow > 0 && /ÖLÜMSÜZ|INVULNERABLE/.test(R.god.hud || ''), 'dev ölümsüz: oyuncunun jipi hasar almaz, yanmaz, HUD\'da ÖLÜMSÜZ');
ok(R.god.botDmg > 0 && R.god.offDmg > 0, `botun jipi hasar alır (${R.god.botDmg}), O kapalıyken oyuncununki de (${R.god.offDmg})`);

// 5) geliştirici sınırsız cephanesi: piyade şarjörü / bomba / heli roket kapsülü eksilmez, HUD ∞; bot ve O kapalı normal
R.inf = await ev(async () => {
  const g = window.__game, me = g.playerSoldier, V = g.vehicles, wait = (t) => new Promise((r) => setTimeout(r, t));
  if (me.veh) V.exit(me); window.__park(); clearInterval(window.__ai);
  g.devGod = true; me.fly = false; me.switchTo(0); await wait(900);
  const it = me.items[0], m0 = it.mag, r0 = it.reserve;
  g.player.fireHeld = true; await wait(2500); g.player.fireHeld = false;
  const rifle = { m0, m1: it.mag, r0, r1: it.reserve, shots: me.shots ?? null, hud: document.getElementById('res')?.textContent };
  const gi = me.items.findIndex((x) => x.id === 'grenade' || x.id === 'ww_nade'); let nade = null;
  if (gi >= 0) { const n0 = me.items[gi].mag; me.switchTo(gi); await wait(700); me.cd = 0; const okT = me.tryFire(); await wait(300); nade = { n0, n1: me.items[gi].mag, okT, hud: document.getElementById('res')?.textContent }; }
  const v = window.__seat(0, 430, g.world.heightAt(0, 430) + 30, 0); me.vw = 1; await wait(600);
  for (let k = 0; k < 6; k++) { v.rkT = 0; V.fireRocket(v, me); await wait(30); }
  const rk = { rk: v.rk, n: v.def.rockets.n, hud: [...document.querySelectorAll('#vhPanel *')].map((e) => e.textContent).find((t) => /∞/.test(t)) || null };
  V.exit(me);
  // O kapalı: şarjör eksilir; bot normal
  me.switchTo(0); await wait(900); g.devGod = false; const it2 = me.items[0], q0 = it2.mag; g.player.fireHeld = true; await wait(600); g.player.fireHeld = false; const off = { m0: q0, m1: it2.mag }; g.devGod = true;
  const bot = g.soldiers.find((s) => s !== me && s.alive); return { rifle, nade, rk, off, botInf: bot.infAmmo };
});
await page.screenshot({ path: `${OUT}/05-dev-sinirsiz-cephane-hud.png` });
console.log('sınırsız cephane:', JSON.stringify(R.inf));
{ const r = R.inf; ok(r.rifle.m1 === r.rifle.m0 && r.rifle.r1 === r.rifle.r0 && /∞/.test(r.rifle.hud || ''), `dev: tüfek şarjörü / yedek eksilmez, HUD ∞ (${r.rifle.m0}/${r.rifle.r0} → ${r.rifle.m1}/${r.rifle.r1} · "${r.rifle.hud}")`);
  ok(!r.nade || r.nade.n1 === r.nade.n0, `dev: el bombası eksilmez (${JSON.stringify(r.nade)})`);
  ok(r.rk.rk === r.rk.n && !!r.rk.hud, `dev: heli roket kapsülü eksilmez, HUD ∞ (${r.rk.rk}/${r.rk.n} · "${r.rk.hud}")`);
  ok(r.off.m1 < r.off.m0 && r.botInf === false, `O kapalıyken şarjör eksilir (${r.off.m0} → ${r.off.m1}), bot sınırsız değil`); }
ok(!errs.length, 'sayfa hatası yok' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(R, null, 1));
await browser.close();
console.log(bad ? `sonuç: ${bad} HATA` : 'sonuç: OK');
process.exit(bad ? 1 : 0);
