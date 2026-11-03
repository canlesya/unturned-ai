// 12.229 Bomba modu: kurma / imha animasyonu + bombayı eline alıp atma (gerçek tarayıcı, çevrimdışı + çevrim içi; ekran görüntüleri /tmp/wb-bombanim/):
//   URL=http://127.0.0.1:5233 WS=ws://127.0.0.1:8993 node scripts/bombathrow.mjs        (sunucu BF_DEBUG=1 ile) · PARTS=off,tp,touch,on · SOFT=1 yazılım GPU
// Denetlenen: kurarken birinci şahısta silah gizli + bomba elleri görünür + kamera çöker, iptal / bitişte silah geri gelir · bot kurarken 3. şahısta
// diz çökme (kalça / gövde / silah gizli / elde bomba), kurunca kalkar, bomba önüne-sağına konur · imha eden bot da diz çöker · 5 = eline al (silah gizli,
// ateş / şarjör yok), sol tık atar: uçuş görünür, makul uzaklığa iner, 'dropped' · takım arkadaşı üstünden geçince alır · ölünce elden düşer ·
// çevrim içi: sunucu elde görür, öbür istemci 3. şahısta elde bomba + kurma diz çökmesi görür, atış öbür istemcide aynı noktaya iner, taşıyan olmayanın atışı reddedilir.
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.URL || 'http://127.0.0.1:5233', WS = process.env.WS || 'ws://127.0.0.1:8993', MAP = process.env.MAP || 'colgecidi';
const PARTS = (process.env.PARTS || 'off,tp,touch,on').split(','), OUT = '/tmp/wb-bombanim';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.SOFT ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0, pass = 0; const check = (ok, msg, x = '') => { console.log((ok ? 'OK    ' : 'HATA  ') + msg + (x !== '' ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); if (!ok) fail++; else pass++; };
const shots = [];
const shot = async (page, name) => { const p = `${OUT}/${name}.png`; await page.screenshot({ path: p }); shots.push(p); };
const key = (page, code) => page.evaluate((code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); }, code);
const until = (p, fn, ms = 15000) => p.waitForFunction(fn, null, { timeout: ms, polling: 50 });

const HELP = () => {
  const g = window.__game, B = g.bomba;
  window.__B = {
    g, B,
    freeze() { g.brainsOff = [...(g.brainsOff || []), ...g.brains.splice(0)]; for (const s of g.soldiers) { s.vel.set(0, 0, 0); s.ads = false; s.sprinting = false; s.protT = 0; s.bmUse = false; s.crouching = false; } },
    put(s, x, z, yaw = 0, y) { s.pos.set(x, y ?? g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); g.world.settle(s); s.yaw = yaw; s.protT = 0; },
    me() { return g.playerSoldier; },
    live() { if (B.phase === 'prep') B.t = 0.01; },
    side(want) { const me = g.playerSoldier; if ((me.team === B.att) !== (want === 'att')) B.swap(); B.startRound(true); },
    give(s) { const b = B.bomb; b.st = 'carried'; b.carrier = s; b.prog = 0; b.who = null; },
    // bölge içinde çevresi açık nokta (yol ızgarası)
    inSite(i, k = 0, R = 1.5) { const s = B.sites[i]; for (let n = 0; n < 400; n++) { const a = (n + k * 7) * 2.399, r = (n % 12) * 0.45, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r; if (B.siteAt({ x, y: g.world.heightAt(x, z), z }) === i && [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]].every(([dx, dz]) => g.nav.isFree(x + dx, z + dz))) return { x, z }; } return { x: s.x, z: s.z }; },
    // atış için önü açık nokta: yön (yaw) boyunca 14 m yürünebilir
    lane(i) { const s = B.sites[i]; for (let n = 0; n < 600; n++) { const a = n * 2.399, r = 4 + (n % 20) * 1.2, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r; if (!g.nav.isFree(x, z)) continue; for (let q = 0; q < 8; q++) { const yaw = q * Math.PI / 4, dx = -Math.sin(yaw), dz = -Math.cos(yaw); let ok = true; for (let d = 1; d <= 14 && ok; d++) ok = g.nav.isFree(x + dx * d, z + dz * d) && Math.abs(g.world.heightAt(x + dx * d, z + dz * d) - g.world.heightAt(x, z)) < 0.4; if (ok) return { x, z, yaw }; } } return null; },
    st() { const b = B.bomb; return { st: b.st, car: b.carrier?.id ?? -1, prog: +b.prog.toFixed(2), who: b.who?.id ?? -1, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), ph: B.phase, throws: B.stats.throws }; },
    fp() { const vm = g.player.vm, m = vm.bmv; return { low: +(vm.bmLower || 0).toFixed(2), dip: +(vm.bmDip || 0).toFixed(2), root: vm.root.visible, G: !!m?.G.visible, bomb: !!(m?.G.visible && m.bomb.visible) }; },
    tp(s) { const m = s.model, p = m.parts, P = s._bmP || {}; return { k: +(P.k || 0).toFixed(2), h: +(P.h || 0).toFixed(2), kind: P.kind, hipY: +p.legs.R.hip.position.y.toFixed(2), torsoX: +p.torso.rotation.x.toFixed(2), wpn: m.weapon ? m.weapon.visible : null, bomb: !!m.bmMesh?.visible, back: !!m.bmBack?.visible }; },
    // 3. şahıs görüntüsü için oyuncuyu s'ye çapraz önden baktır (bıçak elde: görüşü kapatmasın)
    look(s, dx = 1.9, dz = -2.1, pitch = -0.42) { const me = g.playerSoldier; this.put(me, s.pos.x + dx, s.pos.z + dz, Math.atan2(dx, dz)); me.pitch = pitch; me.devGod = true; g.player.vm.scene.visible = false; },      // birinci şahıs silahı görüntüde olmasın
    away(keep) { for (const s of g.soldiers) if (!keep.includes(s) && s.alive) this.put(s, s.pos.x + 300, s.pos.z, 0); },
    vis(id) { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; },
    txt(id) { return (document.getElementById(id)?.textContent || '').replace(/\s+/g, ' ').trim(); },
    feed() { return [...document.querySelectorAll('#killfeed .kf')].map((e) => e.textContent.replace(/\s+/g, ' ')).join(' | '); },
  };
};

async function offPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${BASE}/?autostart=5v5&type=bomba&map=${MAP}&debug=1&nolock=1`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive && window.__game.bomba', null, { timeout: 300000 });
  await page.evaluate(HELP);
  page.errs = errs;
  return page;
}
const fresh = (page) => page.evaluate(() => { __B.side('att'); __B.freeze(); __B.live(); });

// ───── ÇEVRİMDIŞI: birinci şahıs kurma animasyonu, eline al / at, alma, ölünce düşme ─────
async function offline() {
  const page = await offPage();
  await wait(800);
  await fresh(page); await wait(300);
  // kurma: E basılı (gerçek tuş) → silah gizli, bomba elleri, kamera çöker
  await page.evaluate(() => { const me = __B.me(); __B.give(me); const P = __B.inSite(0); __B.put(me, P.x, P.z, 0.4); me.pitch = -0.12; });
  await wait(400);
  const f0 = await page.evaluate(() => __B.fp());
  check(f0.root && !f0.G && f0.low < 0.05, 'kurmadan önce: silah görünür, bomba elleri yok', f0);
  await page.keyboard.down('KeyE');
  await wait(1250);
  const f1 = await page.evaluate(() => ({ ...__B.fp(), ...__B.st(), P: __B.me()._bmP.kind }));
  await shot(page, 'fp-plant-mid');
  check(f1.P === 'plant' && f1.prog > 0.9 && !f1.root && f1.G && f1.bomb && f1.low > 0.95 && f1.dip > 0.9, '1. şahıs kurma (1,2 sn): silah gizli, eller bombayı tutuyor, kamera çömeldi', f1);
  await page.keyboard.up('KeyE');                                                  // iptal
  await wait(700);
  const f2 = await page.evaluate(() => ({ ...__B.fp(), ...__B.st() }));
  check(f2.st === 'carried' && f2.root && !f2.G && f2.low < 0.05 && f2.dip < 0.1, 'iptal: silah yumuşakça geri geldi, bomba elleri gitti', f2);
  // tam kurma
  await page.keyboard.down('KeyE');
  await until(page, `__B.B.bomb.st === 'planted'`, 6000);
  await page.keyboard.up('KeyE');
  const f3a = await page.evaluate(() => ({ ...__B.fp(), ...__B.st(), me: [+__B.me().pos.x.toFixed(2), +__B.me().pos.z.toFixed(2)], yaw: __B.me().yaw }));
  await wait(800);
  const f3 = await page.evaluate(() => ({ ...__B.fp(), model: __B.B.ui.model.visible }));
  const off = Math.hypot(f3a.x - f3a.me[0], f3a.z - f3a.me[1]);
  check(f3.root && !f3.G && f3.low < 0.05 && f3.model, 'kurulunca: silah geri, bomba yerde (dünya modeli)', f3);
  check(off > 0.4 && off < 0.7, `kurulan bomba kuranın önüne-sağına kondu (${off.toFixed(2)} m)`, f3a);
  await shot(page, 'fp-planted');

  // ── eline al (5) ──
  await fresh(page); await wait(300);
  const L = await page.evaluate(() => { const me = __B.me(); __B.give(me); const P = __B.lane(0) || __B.lane(1); __B.put(me, P.x, P.z, P.yaw); me.pitch = 0.32; me.switchTo(0); return P; });
  await wait(500);
  const mag0 = await page.evaluate(() => __B.me().items[0].mag);
  await key(page, 'Digit5');
  await wait(600);
  const h1 = await page.evaluate(() => ({ hand: __B.me().bmHand, ...__B.fp(), badge: __B.txt('bmbadge') }));
  check(h1.hand && !h1.root && h1.G && h1.bomb, '5: bomba elde (silah gizli, eller bombayı tutuyor)', h1);
  check(/Sol tık: at/.test(h1.badge), 'rozet: "Sol tık: at · 5: silaha dön"', h1.badge);
  await shot(page, 'fp-bomb-in-hand');
  const noFire = await page.evaluate(() => { const me = __B.me(), m = me.items[0].mag; const a = me.triggerUpdate(true, 1); const r = me.startReload(); me.ads = true; me.update(0.016); return { a, r, m0: m, m1: me.items[0].mag, ads: me.adsT }; });
  check(!noFire.a && !noFire.r && noFire.m0 === noFire.m1 && noFire.ads === 0, 'bomba elde: ateş yok, şarjör değişmez, nişan yok', noFire);
  // 5 tekrar: silaha dön · 1: silaha dön
  await key(page, 'Digit5'); await wait(500);
  const h2 = await page.evaluate(() => ({ hand: __B.me().bmHand, ...__B.fp() }));
  await key(page, 'Digit5'); await wait(350);
  const h3a = await page.evaluate(() => __B.me().bmHand);
  await key(page, 'Digit1'); await wait(500);
  const h3 = await page.evaluate(() => ({ hand: __B.me().bmHand, cur: __B.me().cur, ...__B.fp() }));
  check(!h2.hand && h2.root && h3a && !h3.hand && h3.cur === 0 && h3.root, '5 tekrar / 1: silaha dönüldü (silah görünür)', { h2, h3 });
  // ── at: sol tık ──
  await key(page, 'Digit5'); await wait(500);
  await page.evaluate(() => { const me = __B.me(); me.pitch = 0.32; me.vel.set(0, 0, 0); });
  await page.mouse.down(); await wait(40); await page.mouse.up();
  await wait(140);
  const t1 = await page.evaluate(() => ({ ...__B.st(), hand: __B.me().bmHand, fly: !!__B.B.ui.fl, mv: __B.B.ui.model.visible, mag: __B.me().items[0].mag }));
  await shot(page, 'throw-flight');
  check(t1.st === 'dropped' && !t1.hand && t1.fly && t1.mv && t1.throws === 1, 'sol tık: bomba atıldı (uçuyor, elden çıktı)', t1);
  check(t1.mag === mag0, 'atış silahı ateşlemedi (şarjör aynı)', { mag0, mag: t1.mag });
  await until(page, '!__B.B.ui.fl', 6000).catch(() => {});
  await wait(300);
  const t2 = await page.evaluate(() => { const me = __B.me(), b = __B.B.bomb; return { ...__B.st(), d: +Math.hypot(b.x - me.pos.x, b.z - me.pos.z).toFixed(2), gy: +__B.g.world.heightAt(b.x, b.z).toFixed(2), my: +me.pos.y.toFixed(2), fly: !!__B.B.ui.fl, ...__B.fp(), feed: __B.feed() }; });
  check(t2.st === 'dropped' && t2.d > 4 && t2.d < 25 && !t2.fly && Math.abs(t2.y - t2.my) < 1.2, `atılan bomba ${t2.d} m öteye indi, yerde ('dropped')`, t2);
  check(t2.root && !t2.G, 'attıktan sonra silah geri geldi', t2);
  check(/bombayı attı/.test(t2.feed), 'akış: "bombayı attı"', t2.feed);
  // landed görüntüsü: bombaya bak
  await page.evaluate(() => { const me = __B.me(), b = __B.B.bomb; me.yaw = Math.atan2(-(b.x - me.pos.x), -(b.z - me.pos.z)); me.pitch = -Math.atan2(1.4, Math.hypot(b.x - me.pos.x, b.z - me.pos.z)); });
  await wait(300);
  await shot(page, 'throw-landed');
  // atan hemen geri alamaz; takım arkadaşı üstünden geçince alır
  const pk = await page.evaluate(async () => {
    const g = __B.g, B = __B.B, b = B.bomb, me = __B.me();
    const mate = g.soldiers.find((s) => s !== me && s.team === B.att && s.alive);
    __B.put(mate, b.x + 0.4, b.z, 0, b.y);
    await new Promise((r) => setTimeout(r, 400));
    return { ...__B.st(), mate: mate.id };
  });
  check(pk.st === 'carried' && pk.car === pk.mate, 'takım arkadaşı atılan bombanın üstünden geçince aldı', pk);
  // havadayken alınmaz (atış anında yanında duran arkadaş)
  await fresh(page); await wait(300);
  const air = await page.evaluate(async () => {
    const g = __B.g, B = __B.B, me = __B.me(), P = __B.lane(0) || __B.lane(1); __B.give(me); __B.put(me, P.x, P.z, P.yaw); me.pitch = 0.3;
    B.setHand(me, true); B.throwBomb(me);
    const b = B.bomb, mate = g.soldiers.find((s) => s !== me && s.team === B.att && s.alive);
    const ft = b.landT - g.time;
    __B.put(mate, b.x, b.z, 0, b.y);                                               // iniş noktasında bekleyen arkadaş: bomba inmeden almaz
    await new Promise((r) => setTimeout(r, Math.max(50, ft * 1000 * 0.4)));
    const mid = b.st;
    await new Promise((r) => setTimeout(r, ft * 1000 * 0.8 + 300));
    return { ft: +ft.toFixed(2), mid, end: b.st, car: b.carrier?.id ?? -1, mate: mate.id };
  });
  check(air.ft > 0.3 && air.mid === 'dropped' && air.end === 'carried' && air.car === air.mate, `uçarken alınmadı (uçuş ${air.ft} sn), inince arkadaş aldı`, air);
  // ölünce elden düşer
  await fresh(page); await wait(300);
  const die = await page.evaluate(async () => { const me = __B.me(), B = __B.B; __B.give(me); B.setHand(me, true); me.devGod = false; __B.g.devGod = false; me.protT = 0; me.takeDamage(999, null, 'body', me.pos, 'test'); await new Promise((r) => setTimeout(r, 200)); return { ...__B.st(), hand: me.bmHand, alive: me.alive }; });
  check(!die.alive && die.st === 'dropped' && !die.hand, 'bomba eldeyken ölünce yere düştü', die);
  check(page.errs.length === 0, 'sayfa hatası yok', page.errs.slice(0, 3));
  await page.close();
}

// ───── 3. ŞAHIS: bot kurarken diz çöker, bomba elinde; imha eden bot da; bomba elde / sırtta ─────
async function third() {
  const page = await offPage();
  await wait(800);
  await fresh(page); await wait(300);
  const bot = await page.evaluate(() => {
    const g = __B.g, B = __B.B, me = __B.me();
    const bot = g.soldiers.find((s) => s !== me && s.team === B.att && s.alive);
    __B.give(bot); const P = __B.inSite(0, 0, 2.2); __B.put(bot, P.x, P.z, 0.3);
    __B.away([bot, me]); __B.look(bot);
    window.__bot = bot; window.__iv = setInterval(() => { if (window.__bot) window.__bot.bmUse = true; }, 10);
    return bot.id;
  });
  await wait(400);
  const k0 = await page.evaluate(() => __B.tp(__bot));
  await wait(900);
  const k1 = await page.evaluate(() => ({ ...__B.tp(__bot), ...__B.st() }));
  await shot(page, 'tp-bot-plant-kneel');
  check(k1.kind === 'plant' && k1.k > 0.9 && k1.hipY < 0.55 && k1.torsoX < -0.6 && k1.wpn === false && k1.bomb, '3. şahıs: bot kurarken diz çöktü (kalça alçak, gövde öne eğik, silah gizli, bomba elinde)', { k0, k1 });
  await wait(1300);
  await shot(page, 'tp-bot-plant-keypad');
  await until(page, `__B.B.bomb.st === 'planted'`, 4000);
  await page.evaluate(() => { clearInterval(window.__iv); window.__bot.bmUse = false; });
  await wait(1100);
  const k2 = await page.evaluate(() => { const b = __B.B.bomb, s = __bot; return { ...__B.tp(s), d: +Math.hypot(b.x - s.pos.x, b.z - s.pos.z).toFixed(2), model: __B.B.ui.model.visible }; });
  check(k2.k < 0.05 && k2.hipY > 0.75 && k2.wpn === true && !k2.bomb && k2.model && k2.d > 0.4 && k2.d < 0.7, 'kurunca bot kalktı, silah elinde; bomba önünde yerde', k2);
  await shot(page, 'tp-bot-planted');
  // imha eden bot (savunan)
  const df = await page.evaluate(() => {
    const g = __B.g, B = __B.B, me = __B.me(), b = B.bomb;
    const d = g.soldiers.find((s) => s.team === B.def && s.alive);
    __B.put(d, b.x + 0.15, b.z + 0.68, Math.atan2(0.15, 0.68));                 // botun imha durduğu uzaklık (bombaBots: 0,75 m)
    window.__def = d; window.__iv = setInterval(() => { if (window.__def) window.__def.bmUse = true; }, 10);
    __B.away([d, me]); __B.look(d, -2.2, -0.9, -0.4);
    return d.id;
  });
  await wait(1300);
  const k3 = await page.evaluate(() => ({ ...__B.tp(__def), ...__B.st() }));
  await shot(page, 'tp-bot-defuse-kneel');
  check(k3.kind === 'defuse' && k3.k > 0.9 && k3.hipY < 0.55 && k3.wpn === false && !k3.bomb && k3.who === df, '3. şahıs: imha eden bot diz çöktü, eller bombada (elinde bomba yok)', k3);
  await page.evaluate(() => { clearInterval(window.__iv); window.__def.bmUse = false; });
  // bomba elde (3. şahıs) + sırtta
  await fresh(page); await wait(300);
  await page.evaluate(() => { const g = __B.g, B = __B.B, me = __B.me(), bot = g.soldiers.find((s) => s !== me && s.team === B.att && s.alive); window.__bot = bot; __B.give(bot); const P = __B.inSite(1, 0, 2); __B.put(bot, P.x, P.z, 0.2); __B.away([bot, me]); B.setHand(bot, true); __B.look(bot, 1.6, -2.2, -0.2); });
  await wait(900);
  const k4 = await page.evaluate(() => __B.tp(__bot));
  check(k4.h > 0.9 && k4.wpn === false && k4.bomb && k4.k < 0.05, '3. şahıs: bomba elde (iki el göğüs önünde, silah gizli)', k4);
  await shot(page, 'tp-bot-bomb-in-hand');
  await page.evaluate(() => { __B.B.setHand(__bot, false); __B.look(__bot, -1.4, 2.2, -0.25); });
  await wait(700);
  const k5 = await page.evaluate(() => __B.tp(__bot));
  check(k5.back && !k5.bomb && k5.wpn === true, '3. şahıs: taşıyanın sırtında bomba (saldıran görür)', k5);
  await shot(page, 'tp-bot-bomb-on-back');
  check(page.errs.length === 0, 'sayfa hatası yok', page.errs.slice(0, 3));
  await page.close();
}

// ───── DOKUNMATİK: BOMBA (elde) düğmesi yalnız taşıyana görünür, dokununca bomba elde, ATEŞ atar ─────
async function touch() {
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=5v5&type=bomba&map=${MAP}&debug=1&touch=1&shadows=0`);
  await page.waitForFunction(() => window.__game && window.__game.bomba && document.getElementById('bResume') && document.getElementById('pause').style.display === 'flex', null, { timeout: 300000 });
  await wait(500);
  { const b = await page.locator('#bResume').boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await wait(800); }
  await page.evaluate(HELP);
  await fresh(page); await wait(300);
  const hid0 = await page.evaluate(() => { const me = __B.me(), B = __B.B, o = __B.g.soldiers.find((s) => s !== me && s.team === B.att); __B.give(o); return new Promise((r) => setTimeout(() => r(document.querySelector('#tc [data-b="bmh"]')?.classList.contains('hid')), 300)); });
  await page.evaluate(() => { const me = __B.me(); __B.give(me); const P = __B.lane(0) || __B.lane(1); __B.put(me, P.x, P.z, P.yaw); me.pitch = 0.3; });
  await wait(400);
  const bb = await page.locator('#tc [data-b="bmh"]').boundingBox();
  check(hid0 === true && !!bb && bb.width > 15, 'dokunmatik: BOMBA (elde) düğmesi yalnız taşıyana görünür', { hid0, bb });
  if (bb) {
    await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await wait(500);
    const h = await page.evaluate(() => ({ hand: __B.me().bmHand, on: document.querySelector('#tc [data-b="bmh"]').classList.contains('on'), badge: __B.txt('bmbadge') }));
    check(h.hand && h.on && /ATEŞ: at/.test(h.badge), 'dokunmatik: düğmeye dokununca bomba elde (rozet "ATEŞ: at")', h);
    await shot(page, 'touch-bomb-in-hand');
    const fb = await page.locator('#tc [data-b="fire"]').boundingBox();
    await page.touchscreen.tap(fb.x + fb.width / 2, fb.y + fb.height / 2); await wait(300);
    const t = await page.evaluate(() => ({ ...__B.st(), hand: __B.me().bmHand }));
    check(t.st === 'dropped' && t.throws === 1 && !t.hand, 'dokunmatik: ATEŞ bombayı attı', t);
  }
  check(!errs.length, 'dokunmatik: sayfa hatası yok', errs.slice(0, 3));
  await ctx.close();
}

// ───── ÇEVRİM İÇİ: sunucu yetkili elde tutma / atma, öbür istemci görür, taşıyan olmayanın atışı reddedilir ─────
async function online() {
  const open = async (name, team, code) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|favicon|Failed to load/.test(m.text())) errs.push(m.text()); });
    await page.goto(code ? `${BASE}/?online=${code}&debug=1&nolock=1&server=${WS}&name=${name}&team=${team}` : `${BASE}/?online=new&type=bomba&per=3&map=${MAP}&bots=0&debug=1&nolock=1&server=${WS}&name=${name}&team=${team}`);
    await page.waitForFunction('window.__game && window.__game.running && window.__game.bomba && window.__game.online && window.__game.playerSoldier', null, { timeout: 300000 });
    await page.evaluate(HELP);
    await page.evaluate(() => { const o = __B.g.online, om = o.onMessage.bind(o); o.onMessage = (m) => { if (m.t === 'dbg' && m.bm) o._bm = m.bm; return om(m); }; });
    page.errs = errs; page.nm = name;
    return page;
  };
  const A = await open('Ali', 'red');                                        // Çöl Geçidi'nde ilk yarıda Kırmızı saldırır: iki saldıran insan (atan + alan)
  const code = await A.evaluate(() => window.__game.opts.online.room);
  const dbg = (p, m) => p.evaluate((m) => __B.g.online.send({ t: 'dbg', ...m }), m);
  const ask = async (p) => { await p.evaluate(() => { __B.g.online._bm = null; __B.g.online.send({ t: 'dbg', bm: { ask: 1 } }); }); await p.waitForFunction(() => __B.g.online._bm, null, { timeout: 5000 }); return p.evaluate(() => __B.g.online._bm); };
  const Bp = await open('Bora', 'red', code);
  const C = await open('Cem', 'blue', code);
  await wait(900);
  await dbg(A, { bm: { restart: 1 } }); await until(A, `__B.B.phase === 'prep'`); await dbg(A, { bm: { t: 0.01 } });
  for (const p of [A, Bp, C]) await until(p, `__B.B.phase === 'live' && __B.me().alive`);
  await wait(400);
  const ids = await A.evaluate(() => Object.fromEntries(__B.g.soldiers.filter((s) => !s.vacant).map((s) => [s.name, [s.id, s.team]])));
  const att = await A.evaluate(() => __B.B.att);
  const P = { Ali: A, Bora: Bp, Cem: C };
  const atk = Object.keys(ids).filter((n) => ids[n][1] === att), dfs = Object.keys(ids).filter((n) => ids[n][1] !== att);
  console.log(`      saldıran: ${att} (${atk.join(', ')}) · savunan: ${dfs.join(', ')}`);
  const xn = atk[0], X = P[xn], xid = ids[xn][0];
  const yn = atk[1] || dfs[0], Y = P[yn];                                       // gözlemci (varsa takım arkadaşı)
  const zn = dfs[0], Z = P[zn];                                                 // taşıyan olmayan (savunan)
  await dbg(A, { bm: { give: xid } }); await until(X, `__B.B.bomb.carrier && __B.B.bomb.carrier.id === ${xid}`);
  // X bölgede, Y yanında (görüş), gerçek E: kurma diz çökmesi Y'de görünür (yeni ileti yok: b.who / b.prog)
  const sp = await X.evaluate(() => __B.inSite(0, 0, 2.2));
  await dbg(X, { tp: [sp.x, sp.z] });
  await dbg(Y, { tp: [sp.x + 1.9, sp.z - 2.1] });
  await wait(800);
  await Y.evaluate((xid) => { const me = __B.me(), x = __B.g.soldiers[xid]; me.yaw = Math.atan2(-(x.pos.x - me.pos.x), -(x.pos.z - me.pos.z)); me.pitch = -0.4; __B.g.player.vm.scene.visible = false; }, xid);
  await X.bringToFront(); await X.keyboard.down('KeyE');
  await wait(1500);
  const yk = await Y.evaluate((xid) => __B.tp(__B.g.soldiers[xid]), xid);
  const xf = await X.evaluate(() => ({ ...__B.fp(), prog: __B.B.bomb.prog }));
  await Y.bringToFront(); await shot(Y, 'online-remote-plant-kneel');
  await X.bringToFront(); await X.keyboard.up('KeyE');
  check(xf.G && !xf.root && xf.prog > 0.8, 'çevrim içi: kuran istemcide 1. şahıs kurma animasyonu', xf);
  check(yk.kind === 'plant' && yk.k > 0.8 && yk.hipY < 0.6 && yk.wpn === false, 'çevrim içi: öbür istemci kuranı diz çökmüş görüyor (b.who / b.prog anlık görüntüden)', yk);
  await wait(800);
  // eline al: gerçek 5 → sunucu elde görür, öbür istemcide elde bomba (3. şahıs)
  const ln = await X.evaluate(() => __B.lane(0) || __B.lane(1));
  await dbg(X, { tp: [ln.x, ln.z] });
  const fx = -Math.sin(ln.yaw), fz = -Math.cos(ln.yaw), rx = Math.cos(ln.yaw), rz = -Math.sin(ln.yaw);      // atış yönü / sağ
  const ys = await X.evaluate(([x, z, fx, fz, rx, rz]) => { for (const k of [4, -4, 3, -3, 2.5]) { const px = x - rx * k + fx * 2, pz = z - rz * k + fz * 2; if (__B.g.nav.isFree(px, pz)) return [px, pz]; } return [x - rx * 2.4, z - rz * 2.4]; }, [ln.x, ln.z, fx, fz, rx, rz]);
  await dbg(Y, { tp: ys });
  await wait(700);
  await X.evaluate((yaw) => { const me = __B.me(); me.yaw = yaw; me.pitch = 0.32; }, ln.yaw);
  await key(X, 'Digit5');
  await wait(700);
  const sv1 = await ask(X);
  const yh = await Y.evaluate((xid) => { const me = __B.me(), x = __B.g.soldiers[xid]; me.yaw = Math.atan2(-(x.pos.x - me.pos.x), -(x.pos.z - me.pos.z)); me.pitch = -0.15; return { hand: x.bmHand }; }, xid);
  await wait(500);
  const yh2 = await Y.evaluate((xid) => __B.tp(__B.g.soldiers[xid]), xid);
  check(sv1.hand.includes(xid) && sv1.car === xid, 'çevrim içi: sunucu bombayı X\'in elinde görüyor', sv1);
  check(yh.hand && yh2.h > 0.8 && yh2.wpn === false && yh2.bomb, 'çevrim içi: öbür istemci X\'i elinde bombayla görüyor', yh2);
  await Y.bringToFront(); await shot(Y, 'online-remote-bomb-in-hand'); await X.bringToFront();
  // taşıyan olmayanın atışı: Z girdiye bh + bt yazar → sunucu reddeder
  await Z.evaluate(() => { const me = __B.me(); me.bmHand = true; __B.g.online.edge('bt'); });
  await wait(500);
  await Z.evaluate(() => { __B.me().bmHand = false; });
  const sv2 = await ask(X);
  check(sv2.st === 'carried' && sv2.car === xid && sv2.throws === 0, 'çevrim içi: taşıyan olmayanın atışı sunucuda reddedildi', sv2);
  // X atar (gerçek sol tık); Y yolun ortasına bakar
  await Y.evaluate(([x, z, fx, fz]) => { const me = __B.me(), tx = x + fx * 5, tz = z + fz * 5; me.yaw = Math.atan2(-(tx - me.pos.x), -(tz - me.pos.z)); me.pitch = 0.05; }, [ln.x, ln.z, fx, fz]);
  await X.mouse.down(); await wait(40); await X.mouse.up();
  await wait(250);
  const yfly = await Y.evaluate(() => ({ fly: !!__B.B.ui.fl, st: __B.B.bomb.st }));
  await Y.bringToFront(); await shot(Y, 'online-remote-throw-flight'); await X.bringToFront();
  await wait(3200);
  const sv3 = await ask(X);
  const xv = await X.evaluate(() => { const b = __B.B.bomb, me = __B.me(); return { st: b.st, x: b.x, y: b.y, z: b.z, d: Math.hypot(b.x - me.pos.x, b.z - me.pos.z), hand: me.bmHand }; });
  const yv = await Y.evaluate(() => { const b = __B.B.bomb; return { st: b.st, x: b.x, y: b.y, z: b.z }; });
  const zv = await Z.evaluate(() => { const b = __B.B.bomb; return { st: b.st, x: b.x, y: b.y, z: b.z }; });
  const dd = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  check(sv3.st === 'dropped' && sv3.throws === 1 && xv.st === 'dropped' && !xv.hand && xv.d > 4 && xv.d < 25, `çevrim içi: X attı → sunucuda 'dropped', ${xv.d.toFixed(1)} m öteye`, { sv3, xv });
  check(yfly.fly && yv.st === 'dropped' && dd(xv, yv) < 0.05 && dd(zv, xv) < 0.05 && Math.hypot(sv3.p[0] - xv.x, sv3.p[2] - xv.z) < 0.05, 'çevrim içi: öbür istemciler uçuşu gördü, bomba aynı noktaya indi', { yfly, xv, yv, zv });
  // takım arkadaşı alır (varsa insan arkadaş)
  if (atk[1]) {
    const yid = ids[yn][0];
    await dbg(Y, { tp: [xv.x + 0.3, xv.z] });
    await wait(900);
    const sv4 = await ask(X);
    check(sv4.st === 'carried' && sv4.car === yid, 'çevrim içi: takım arkadaşı atılan bombanın üstünden geçince aldı', sv4);
  } else console.log('      (saldıran takımda ikinci insan yok: çevrim içi alma denetimi atlandı; çevrimdışı denetlendi)');
  for (const p of [A, Bp, C]) check(p.errs.length === 0, `${p.nm}: sayfa hatası yok`, p.errs.slice(0, 3));
  for (const p of [A, Bp, C]) await p.close();
}

const t0 = Date.now();
try {
  if (PARTS.includes('off')) await offline();
  if (PARTS.includes('tp')) await third();
  if (PARTS.includes('touch')) await touch();
  if (PARTS.includes('on')) await online();
} catch (e) { console.log('HATA  istisna: ' + (e && e.stack || e)); fail++; }
await browser.close();
console.log(`\n${pass} geçti · ${fail} hata · ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
console.log('ekran görüntüleri:\n  ' + shots.join('\n  '));
process.exit(fail ? 1 : 0);
