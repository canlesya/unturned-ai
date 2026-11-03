// 12.226 Bomba modu tarayıcı testi (çevrimdışı + çevrim içi, gerçek tarayıcı, ekran görüntüleri /tmp/wb-bomba/):
//   URL=http://127.0.0.1:5226 WS=ws://127.0.0.1:8992 node scripts/bombatest.mjs        (sunucu BF_DEBUG=1 ile)
//   PARTS=off,rules,swap,bots,touch,menu,on (varsayılan hepsi) · MAP=colgecidi · SOFT=1 yazılım GPU
// Denetlenen: hazırlık (donuk, sınıf) · bomba rastgele saldırana · yalnız bölgede kurulur · E basılı 3 sn kurma · hareket / hasar iptal · 40 sn sayaç + patlama
// (yarıçap içi ölür) + saldıran kazanır · imha 10 sn / kitle 5 sn · iptal · imha → savunan kazanır · süre → savunan · eleme (kurmadan önce / sonra) ·
// taşıyan ölünce bomba düşer, saldıran üstünden geçince alır · devre arasında taraf değişimi · ilk 7'de maç sonu · menü · çevrim içi aynısı sunucu yetkili.
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.URL || 'http://127.0.0.1:5226', WS = process.env.WS || 'ws://127.0.0.1:8992', MAP = process.env.MAP || 'colgecidi';
const PARTS = (process.env.PARTS || 'off,rules,swap,bots,touch,menu,on').split(','), OUT = '/tmp/wb-bomba';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.SOFT ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0, pass = 0; const check = (ok, msg, x = '') => { console.log((ok ? 'OK    ' : 'HATA  ') + msg + (x !== '' ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); if (!ok) fail++; else pass++; };
const shots = [];
const shot = async (page, name) => { const p = `${OUT}/${name}.png`; await page.screenshot({ path: p }); shots.push(p); };

// sayfa yardımcıları (window.__B)
const HELP = () => {
  const g = window.__game, B = g.bomba;
  window.__B = {
    g, B,
    freeze() { g.brainsOff = [...(g.brainsOff || []), ...g.brains.splice(0)]; for (const s of g.soldiers) { s.vel.set(0, 0, 0); s.ads = false; s.sprinting = false; s.protT = 0; s.bmUse = false; } },
    put(s, x, z, yaw = 0, y) { s.pos.set(x, y ?? g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); g.world.settle(s); s.yaw = yaw; s.protT = 0; },
    live() { if (B.phase === 'prep') B.t = 0.01; },
    me() { return g.playerSoldier; },
    att() { return g.soldiers.filter((s) => s.team === B.att && !s.vacant); },
    def() { return g.soldiers.filter((s) => s.team === B.def && !s.vacant); },
    // oyuncuyu saldıran / savunan yap (doğuşlar yer değiştirir, raunt baştan; skor korunur)
    side(want) { const me = g.playerSoldier; if ((me.team === B.att) !== (want === 'att')) { B.swap(); } B.startRound(true); },
    give(s) { const b = B.bomb; b.st = 'carried'; b.carrier = s; b.prog = 0; b.who = null; },
    st() { const b = B.bomb; return { st: b.st, car: b.carrier?.id ?? -1, site: b.site, prog: +b.prog.toFixed(2), who: b.who?.id ?? -1, t: +B.t.toFixed(2), ph: B.phase, round: B.round, att: B.att, tk: [g.tickets.blue, g.tickets.red], last: B.last, why: B.why }; },
    // bölge içinde serbest nokta (yol ızgarası)
    inSite(i, k = 0) { const s = B.sites[i]; for (let n = 0; n < 300; n++) { const a = (n + k * 7) * 2.399, r = (n % 12) * 0.45, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r; if (g.nav.isFree(x, z) && B.siteAt({ x, y: g.world.heightAt(x, z), z }) === i && g.nav.isFree(x + 1, z) && g.nav.isFree(x - 1, z)) return { x, z }; } return { x: s.x, z: s.z }; },
    outSite(i) { const s = B.sites[i]; for (let n = 0; n < 400; n++) { const a = n * 2.399, r = (s.r || 6) + 3 + (n % 10) * 0.6, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r; if (g.nav.isFree(x, z) && B.siteAt({ x, y: g.world.heightAt(x, z), z }) < 0 && g.nav.isFree(x + 1, z) && g.nav.isFree(x - 1, z)) return { x, z }; } return null; },
    vis(id) { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; },
    txt(id) { return (document.getElementById(id)?.textContent || '').replace(/\s+/g, ' ').trim(); },
    feed() { return [...document.querySelectorAll('#killfeed .kf')].map((e) => e.textContent.replace(/\s+/g, ' ')).join(' | '); },
    marks() { return [...document.querySelectorAll('#bmmk .m')].filter((m) => m.style.display !== 'none').map((m) => m.className + ':' + m.textContent.trim()); },
  };
};
const hold = async (page, key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
// E basılıyken bir koşul sağlanana dek bekle (sayfa içi zaman ölçümü)
const holdUntil = (page, fn, ms) => page.evaluate(async ([fn, ms]) => {
  const f = new Function('return ' + fn), t0 = performance.now(), g0 = window.__game.time;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
  while (!f() && performance.now() - t0 < ms) await new Promise((r) => setTimeout(r, 20));
  const dt = (performance.now() - t0) / 1000, gt = window.__game.time - g0;
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e' }));
  return { ok: !!f(), dt: +dt.toFixed(2), gt: +gt.toFixed(2) };
}, [fn, ms]);

async function offPage(extra = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${BASE}/?autostart=5v5&type=bomba&map=${MAP}&debug=1&nolock=1${extra}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive && window.__game.bomba', null, { timeout: 300000 });
  await page.evaluate(HELP);
  page.errs = errs;
  return page;
}
const until = (p, fn, ms = 15000) => p.waitForFunction(fn, null, { timeout: ms, polling: 50 });

// ───── ÇEVRİMDIŞI: hazırlık, taşıyan, kurma, iptal, sayaç, patlama, imha, kit ─────
async function offline() {
  const page = await offPage();
  await wait(1000);
  const pre = await page.evaluate(() => ({ ...__B.st(), rounds: __B.B.rounds, need: __B.B.need, pips: __B.vis('bmpips'), prep: __B.vis('bmprep'), prepTxt: __B.txt('bmprep'), car: __B.B.bomb.carrier?.team, nSites: __B.B.sites.length }));
  check(pre.ph === 'prep' && pre.round === 1 && pre.rounds === 12 && pre.need === 7, 'maç 1. rauntun hazırlığıyla başlıyor (kısa: 12 raunt, ilk 7)', pre);
  check(pre.st === 'carried' && pre.car === pre.att && pre.nSites === 2, 'bomba raunt başında bir saldırana verildi (A / B bölgesi)', pre);
  check(pre.pips && pre.prep && /1/.test(pre.prepTxt), 'HUD: durum noktaları + hazırlıkta sınıf şeridi', pre.prepTxt);
  await shot(page, 'bomba-prep');
  const prep = await page.evaluate(async () => {
    const g = __B.g, me = g.playerSoldier, p0 = me.pos.clone();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit5' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit5' }));
    g.player.keys.add('KeyW'); await new Promise((r) => setTimeout(r, 600)); g.player.keys.delete('KeyW');
    return { cls: me.cls, moved: +Math.hypot(me.pos.x - p0.x, me.pos.z - p0.z).toFixed(2), kit: !!me.bmKit, def: me.team === __B.B.def };
  });
  check(prep.cls === 'engineer' && prep.moved < 0.05, 'hazırlıkta 5 tuşu → Mühendis, oyuncu donuk (W 0,6 sn)', prep);
  check(!prep.def || prep.kit, 'savunan Mühendis: imha kiti', prep);
  // rastgele taşıyan: 12 raunt kurulumunda hep bir saldıran (bot ya da insan)
  const carr = await page.evaluate(() => { const seen = new Set(); let bad = 0; for (let i = 0; i < 12; i++) { __B.B.startRound(true); const c = __B.B.bomb.carrier; if (!c || c.team !== __B.B.att) bad++; else seen.add(c.id); } return { bad, n: seen.size }; });
  check(carr.bad === 0 && carr.n >= 2, 'taşıyan her raunt rastgele bir saldıran (12 kurulumda ' + carr.n + ' farklı)', carr);

  // oyuncu saldıran + taşıyan
  await page.evaluate(() => { __B.side('att'); __B.freeze(); __B.live(); });
  await wait(300);
  const live = await page.evaluate(() => ({ ...__B.st(), tl: __B.txt('tm') }));
  check(live.ph === 'live' && live.t > 112 && /1:5/.test(live.tl), 'hazırlık bitti → raunt 1:55', live);
  await page.evaluate(() => { __B.give(__B.me()); const P = __B.outSite(0), s = __B.B.sites[0]; __B.put(__B.me(), P.x, P.z, Math.atan2(-(s.x - P.x), -(s.z - P.z))); });
  await wait(400);
  const car = await page.evaluate(() => ({ badge: __B.vis('bmbadge') && getComputedStyle(document.querySelector('#bmbadge .bomb')).display !== 'none', txt: __B.txt('bmbadge'), use: __B.vis('bmuse'), marks: __B.marks() }));
  check(car.badge && /BOMBA SENDE/.test(car.txt), 'HUD: bomba sende rozeti', car.txt);
  check(car.marks.some((m) => /site.*A/.test(m)), 'ekranda A bölge harfi', car.marks);
  await shot(page, 'bomba-carrier-hud');
  // bölge dışında E basılı 3,5 sn: kurulmaz, istem yok
  const outside = await holdUntil(page, "__B.B.bomb.st === 'planted'", 3500);
  const o2 = await page.evaluate(() => __B.st());
  check(!outside.ok && o2.st === 'carried' && !car.use, 'bölge dışında E basılı 3,5 sn: kurulmadı', o2);
  // bölgede kur: gerçek E tuşu, 3 sn
  await page.evaluate(() => { const P = __B.inSite(0), s = __B.B.sites[0]; __B.put(__B.me(), P.x, P.z, Math.atan2(-(s.x - P.x), -(s.z - P.z)) + (Math.hypot(s.x - P.x, s.z - P.z) < 1 ? 0 : 0)); __B.me().pitch = 0.25; });
  await wait(300);
  const u0 = await page.evaluate(() => ({ use: __B.vis('bmuse'), txt: __B.txt('bmuse'), tag: __B.vis('bmsite') && __B.txt('bmsite') }));
  check(u0.use && /E basılı tut: Bombayı kur/.test(u0.txt) && u0.tag === 'A BÖLGESİ', 'bölgede istem "E basılı tut: Bombayı kur" + "A BÖLGESİ" etiketi', u0);
  // iptal: 1,4 sn tut, sonra yürü (E basılı) → ilerleme sıfırlanır
  const cancel = await page.evaluate(async () => {
    const g = __B.g, B = __B.B;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await new Promise((r) => setTimeout(r, 1400));
    const p1 = B.bomb.prog;
    g.player.keys.add('KeyW'); await new Promise((r) => setTimeout(r, 350));
    const p2 = B.bomb.prog, txt = __B.txt('bmuse');
    g.player.keys.delete('KeyW');
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    return { p1: +p1.toFixed(2), p2: +p2.toFixed(2), st: B.bomb.st, txt };
  });
  check(cancel.p1 > 1.1 && cancel.p2 < 0.3 && cancel.st === 'carried', 'kurarken yürümek iptal eder (ilerleme sıfır)', cancel);
  await shot(page, 'bomba-planting');
  // hasar iptali
  const dmgc = await page.evaluate(async () => {
    const g = __B.g, B = __B.B, me = g.playerSoldier, P = __B.inSite(0); __B.put(me, P.x, P.z, Math.PI);
    await new Promise((r) => setTimeout(r, 200));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await new Promise((r) => setTimeout(r, 1500));
    const p1 = B.bomb.prog; me.takeDamage(5, __B.def()[0], 'body', me.pos, 'test');
    await new Promise((r) => setTimeout(r, 100));
    const p2 = B.bomb.prog;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    me.hp = me.maxHp;
    return { p1: +p1.toFixed(2), p2: +p2.toFixed(2), st: B.bomb.st };
  });
  check(dmgc.p1 > 1.2 && dmgc.p2 < 0.25 && dmgc.st === 'carried', 'kurarken hasar almak iptal eder', dmgc);
  await wait(300);
  const pl = await holdUntil(page, "__B.B.bomb.st === 'planted'", 6000);
  const ps = await page.evaluate(() => ({ ...__B.st(), tl: __B.txt('tm'), timer: __B.vis('bmtimer'), ttxt: __B.txt('bmtimer'), ban: __B.txt('bmban'), feed: __B.feed() }));
  check(pl.ok && pl.gt > 2.95 && pl.gt < 3.2 && pl.dt < 3.8, `bölgede E basılı: ${pl.gt} sn'de (oyun süresi; gerçek ${pl.dt} sn) kuruldu`, pl);
  check(ps.st === 'planted' && ps.site === 0 && ps.t > 38.5 && ps.timer && /BOMBA/.test(ps.ttxt), 'kuruldu: A bölgesi, raunt sayacı yerine 40 sn bomba sayacı', ps);
  check(/BOMBA KURULDU/.test(ps.ban) && /kurdu/.test(ps.feed), 'afiş "BOMBA KURULDU" + akış "kurdu"', ps);
  await wait(500);
  await page.evaluate(() => { const me = __B.me(); const b = __B.B.bomb; me.pos.set(b.x + 3, me.pos.y, b.z + 2); me.yaw = Math.atan2(-(b.x - me.pos.x), -(b.z - me.pos.z)); me.pitch = -0.35; });
  await wait(700);
  const vis = await page.evaluate(() => ({ model: __B.B.ui.model.visible, light: __B.B.ui.light.intensity, marks: __B.marks() }));
  check(vis.model && vis.marks.some((m) => /pl/.test(m)), 'kurulu bomba: dünyada model + işaret', vis);
  await shot(page, 'bomba-planted-timer');
  // patlama: yarıçap içindeki savunan ölür, uzaktaki yaşar, saldıran kazanır
  const boom = await page.evaluate(async () => {
    const g = __B.g, B = __B.B, b = B.bomb, D = __B.def(), me = __B.me();
    __B.put(D[0], b.x + 4, b.z, 0, b.y); D[0].hp = D[0].maxHp;
    const far = __B.outSite(1); __B.put(D[1], far.x, far.z, 0); D[1].hp = D[1].maxHp;
    // izleyen oyuncu: bombaya ~22 m, ona bakarak (patlama görüntüsü; ölümcül yarıçapın dışında)
    let best = null; for (let k = 0; k < 64; k++) { const a = k * 0.0982, x = b.x + Math.cos(a) * 22, z = b.z + Math.sin(a) * 22; if (g.nav.isFree(x, z) && g.world.clear?.(me.pos.clone().set(x, g.world.heightAt(x, z) + 1.6, z), me.pos.clone().set(b.x, b.y + 0.5, b.z))) { best = { x, z }; break; } }
    const P = best || __B.outSite(0); __B.put(me, P.x, P.z, Math.atan2(-(b.x - P.x), -(b.z - P.z))); me.pitch = -0.08;
    me.hp = me.maxHp; me.devGod = true; g.devGod = true;
    B.t = 0.3;
    await new Promise((r) => setTimeout(r, 420));
    return { ...__B.st(), near: D[0].alive, far: D[1].alive, ban: __B.txt('bmban'), meD: +Math.hypot(me.pos.x - b.x, me.pos.z - b.z).toFixed(1), meAlive: me.alive };
  });
  await shot(page, 'bomba-explosion');
  await page.evaluate(() => { __B.g.devGod = false; __B.me().devGod = false; });
  check(boom.st === 'exploded' && !boom.near && boom.far && boom.meAlive && boom.meD > 18, 'patlama: 4 m\'deki savunan öldü, diğer bölgedeki yaşıyor', boom);
  check(boom.ph === 'post' && boom.last === boom.att && /HEDEF YOK EDİLDİ/.test(boom.ban), 'bomba patladı → saldıran raundu aldı, afiş "HEDEF YOK EDİLDİ"', boom);
  await wait(600);
  await shot(page, 'bomba-round-banner');
  check(page.errs.length === 0, 'çevrimdışı sayfa hatası yok', page.errs.slice(0, 3));
  await page.close();
}

// ───── KURALLAR: imha (kitsiz 10 / kitli 5 sn), iptal, imha → savunan, süre, eleme, düşme / alma ─────
async function rules() {
  const page = await offPage();
  await page.evaluate(() => { __B.side('def'); __B.freeze(); __B.live(); });
  await wait(300);
  const plantBy = () => page.evaluate(() => { const B = __B.B, c = __B.att()[0], P = __B.inSite(1, 3); __B.put(c, P.x, P.z); B.plant(c, 1); __B.put(c, P.x + 40, P.z + 40); const me = __B.me(); me.bmKit = false; const b = B.bomb; __B.put(me, b.x + 0.8, b.z, 0, b.y); return __B.st(); });
  const p0 = await plantBy();
  check(p0.st === 'planted' && p0.site === 1, 'test: bomba B bölgesine kuruldu (savunanım)', p0);
  await wait(300);
  const u = await page.evaluate(() => ({ use: __B.vis('bmuse'), txt: __B.txt('bmuse') }));
  check(u.use && /İmha et/.test(u.txt) && /10 sn/.test(u.txt), 'bombanın yanında istem "E basılı tut: İmha et · 10 sn"', u);
  // iptal: 2 sn, sonra yürü
  const c1 = await page.evaluate(async () => {
    const g = __B.g, B = __B.B;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); await new Promise((r) => setTimeout(r, 2000));
    const a = B.bomb.prog; g.player.keys.add('KeyS'); await new Promise((r) => setTimeout(r, 300)); const b2 = B.bomb.prog; g.player.keys.delete('KeyS');
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    return { a: +a.toFixed(2), b: +b2.toFixed(2), st: B.bomb.st };
  });
  check(c1.a > 1.6 && c1.b < 0.3 && c1.st === 'planted', 'imha ederken yürümek iptal eder', c1);
  // ateş iptali
  const c2 = await page.evaluate(async () => {
    const g = __B.g, B = __B.B, me = __B.me(), b = B.bomb; __B.put(me, b.x + 0.8, b.z, 0, b.y);
    await new Promise((r) => setTimeout(r, 300));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); await new Promise((r) => setTimeout(r, 1500));
    const a = B.bomb.prog; me.sinceShot = 0; await new Promise((r) => setTimeout(r, 60)); const b2 = B.bomb.prog;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    return { a: +a.toFixed(2), b: +b2.toFixed(2) };
  });
  check(c2.a > 1.2 && c2.b < 0.2, 'imha ederken ateş etmek iptal eder', c2);
  await page.evaluate(() => { const me = __B.me(), b = __B.B.bomb; __B.put(me, b.x + 0.8, b.z, 0, b.y); __B.B.t = 39; });
  await wait(300);
  const d10 = await holdUntil(page, "__B.B.bomb.st === 'defused'", 13000);
  const ds = await page.evaluate(() => ({ ...__B.st(), ban: __B.txt('bmban'), feed: __B.feed() }));
  check(d10.ok && d10.gt > 9.9 && d10.gt < 10.3 && d10.dt < 11, `kitsiz imha ${d10.gt} sn (gerçek ${d10.dt})`, d10);
  check(ds.ph === 'post' && ds.last === ds.att === false && ds.last !== ds.att && /BOMBA İMHA EDİLDİ/.test(ds.ban) && /imha etti/.test(ds.feed), 'imha → savunan raundu aldı, afiş "BOMBA İMHA EDİLDİ"', ds);
  await shot(page, 'bomba-defused');
  // kitli: 5 sn
  await page.evaluate(() => { __B.B.startRound(true); __B.freeze(); __B.live(); });
  await wait(300);
  await plantBy();
  const kit = await page.evaluate(async () => { const me = __B.me(); me.bmKit = true; await new Promise((r) => setTimeout(r, 300)); return { badge: getComputedStyle(document.querySelector('#bmbadge .kit')).display !== 'none', txt: __B.txt('bmuse') }; });
  check(kit.badge && /5 sn/.test(kit.txt), 'kit: HUD kit rozeti, istem 5 sn', kit);
  const d5p = page.evaluate(async () => { await new Promise((r) => setTimeout(r, 2300)); return __B.txt('bmuse'); });
  const d5 = await holdUntil(page, "__B.B.bomb.st === 'defused'", 8000);
  const d5txt = await d5p;
  check(d5.ok && d5.gt > 4.95 && d5.gt < 5.25 && d5.dt < 5.8, `kitli imha ${d5.gt} sn (gerçek ${d5.dt})`, d5);
  check(/İmha ediliyor/.test(d5txt), 'imha sürerken istem "İmha ediliyor…" + halka', d5txt);
  // süre → savunan
  await page.evaluate(() => { __B.B.startRound(true); __B.freeze(); __B.live(); });
  await wait(200);
  const to = await page.evaluate(async () => { __B.B.t = 0.2; await new Promise((r) => setTimeout(r, 500)); return { ...__B.st(), ban: __B.txt('bmban') }; });
  check(to.ph === 'post' && to.last !== to.att && to.why === 'time' && /SÜRE DOLDU/.test(to.ban), 'süre bitti (kurulmadı) → savunan, afiş "SÜRE DOLDU"', to);
  // eleme (kurmadan): saldıranların hepsi ölür → savunan
  await page.evaluate(() => { __B.B.startRound(true); __B.freeze(); __B.live(); });
  await wait(200);
  const e1 = await page.evaluate(async () => { for (const s of __B.att()) s.takeDamage(999, __B.me(), 'body', s.pos, 'test'); await new Promise((r) => setTimeout(r, 300)); return { ...__B.st(), ban: __B.txt('bmban') }; });
  check(e1.last !== e1.att && e1.why === 'elim' && /SALDIRANLAR ELENDİ/.test(e1.ban), 'saldıranların hepsi kurmadan öldü → savunan', e1);
  // eleme (kurduktan sonra): saldıranlar ölse de raunt sürer; imha edilmezse patlar
  await page.evaluate(() => { __B.B.startRound(true); __B.freeze(); __B.live(); });
  await wait(200);
  await plantBy();
  const e2 = await page.evaluate(async () => { for (const s of __B.att()) s.takeDamage(999, __B.me(), 'body', s.pos, 'test'); await new Promise((r) => setTimeout(r, 400)); const a = __B.st(); const me = __B.me(); __B.put(me, me.pos.x + 60, me.pos.z); __B.B.t = 0.2; await new Promise((r) => setTimeout(r, 500)); return { a, b: __B.st() }; });
  check(e2.a.ph === 'live' && e2.a.st === 'planted', 'kurulduktan sonra saldıranların hepsi öldü: raunt sürüyor (imha gerek)', e2.a);
  check(e2.b.st === 'exploded' && e2.b.last === e2.b.att && e2.b.why === 'boom', 'imha edilmedi → patladı, saldıran kazandı', e2.b);
  // savunanların hepsi öldü → saldıran
  await page.evaluate(() => { __B.B.startRound(true); __B.freeze(); __B.live(); });
  await wait(200);
  const e3 = await page.evaluate(async () => { for (const s of __B.def()) s.takeDamage(999, __B.att()[0], 'body', s.pos, 'test'); await new Promise((r) => setTimeout(r, 300)); return { ...__B.st(), ban: __B.txt('bmban') }; });
  check(e3.last === e3.att && e3.why === 'elim' && /SAVUNANLAR ELENDİ/.test(e3.ban), 'savunanların hepsi öldü → saldıran, afiş "SAVUNANLAR ELENDİ"', e3);
  // düşme / alma (oyuncu saldıran): taşıyan bot ölür → yere düşer; oyuncu üstünden geçince alır
  await page.evaluate(() => { __B.side('att'); __B.freeze(); __B.live(); });
  await wait(200);
  const dr = await page.evaluate(async () => {
    const B = __B.B, me = __B.me(), c = __B.att().find((s) => s !== me); __B.give(c);
    const P = __B.outSite(0); __B.put(c, P.x, P.z); __B.put(me, P.x + 6, P.z, Math.PI / 2); me.pitch = -0.3;
    c.takeDamage(999, __B.def()[0], 'body', c.pos, 'test');
    await new Promise((r) => setTimeout(r, 400));
    const a = { ...__B.st(), marks: __B.marks(), feed: __B.feed().split(' | ').slice(-2).join(' | '), bx: B.bomb.x, bz: B.bomb.z, model: B.ui.model.visible };
    return a;
  });
  check(dr.st === 'dropped' && dr.model && dr.marks.some((m) => /Bomba yerde/.test(m)) && /düşürdü/.test(dr.feed), 'taşıyan öldü → bomba yere düştü (model + "Bomba yerde" işareti + akış)', dr);
  await shot(page, 'bomba-dropped');
  const pk = await page.evaluate(async () => {
    const g = __B.g, B = __B.B, me = __B.me(), b = B.bomb;
    me.yaw = Math.atan2(-(b.x - me.pos.x), -(b.z - me.pos.z));
    g.player.keys.add('KeyW');
    const t0 = performance.now();
    while (B.bomb.st !== 'carried' && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 30));
    g.player.keys.delete('KeyW');
    return { ...__B.st(), me: me.id };
  });
  check(pk.st === 'carried' && pk.car === pk.me, 'oyuncu (saldıran) üstünden geçti → bombayı aldı', pk);
  // savunan yerdeki bombayı alamaz
  const np = await page.evaluate(async () => { const B = __B.B, me = __B.me(); B.drop(me); const d = __B.def()[0]; __B.put(d, B.bomb.x, B.bomb.z, 0, B.bomb.y); __B.put(me, B.bomb.x + 10, B.bomb.z); await new Promise((r) => setTimeout(r, 400)); return __B.st(); });
  check(np.st === 'dropped', 'savunan yerdeki bombayı almaz', np);
  check(page.errs.length === 0, 'kurallar: sayfa hatası yok', page.errs.slice(0, 3));
  await page.close();
}

// ───── TARAF DEĞİŞİMİ + MAÇ SONU (ilk 7) ─────
async function swap() {
  const page = await offPage();
  await page.evaluate(() => { __B.freeze(); __B.live(); });
  const s0 = await page.evaluate(() => ({ att: __B.B.att, sp: __B.g.map.spawns.blue[0].z }));
  const s1 = await page.evaluate(async () => { const B = __B.B; B.round = 6; __B.g.tickets.blue = 3; __B.g.tickets.red = 2; B.endRound(B.att, 'elim'); B.t = 0.01; await new Promise((r) => setTimeout(r, 300)); return { ...__B.st(), sw: B.swapped, ban: __B.txt('bmban'), sp: __B.g.map.spawns.blue[0].z }; });
  check(s1.round === 7 && s1.sw && s1.att !== s0.att && s1.sp !== s0.sp && /TARAF DEĞİŞTİ/.test(s1.ban), '6. rauntan sonra taraf değişti (saldıran ↔ savunan, doğuşlar), afiş "TARAF DEĞİŞTİ"', { s0, s1 });
  await shot(page, 'bomba-side-swap');
  const end = await page.evaluate(async () => { const B = __B.B, g = __B.g; B.t = 0.01; await new Promise((r) => setTimeout(r, 200)); g.tickets.blue = 6; g.tickets.red = 4; B.endRound('blue', 'defuse'); const f = B.final; B.t = 0.01; await new Promise((r) => setTimeout(r, 800)); return { f, over: B.over, ended: g.ended, endVis: !!document.querySelector('#end') && getComputedStyle(document.querySelector('#end')).display !== 'none', tk: [g.tickets.blue, g.tickets.red] }; });
  check(end.f && end.ended && end.tk[0] === 7, 'Mavi 7. raundu aldı → maç bitti (ilk 7)', end);
  await shot(page, 'bomba-end');
  // berabere: 12 rauntta 6–6
  const p2 = await offPage();
  const dr = await p2.evaluate(async () => { const B = __B.B, g = __B.g; __B.freeze(); __B.live(); await new Promise((r) => setTimeout(r, 200)); B.round = 12; g.tickets.blue = 6; g.tickets.red = 5; B.endRound('red', 'time'); B.t = 0.01; await new Promise((r) => setTimeout(r, 800)); return { over: B.over, ended: g.ended, tk: [g.tickets.blue, g.tickets.red] }; });
  check(dr.ended && dr.over?.[0] === 'draw' && dr.tk[0] === 6 && dr.tk[1] === 6, '12 raunt sonunda 6–6 → berabere', dr);
  // uzun maç: 24 raunt, ilk 13, 12. rauntan sonra değişim
  const p3 = await offPage('&rounds=24');
  const lg = await p3.evaluate(async () => { const B = __B.B; __B.freeze(); __B.live(); await new Promise((r) => setTimeout(r, 200)); const a0 = B.att; B.round = 6; B.endRound(B.att, 'elim'); B.t = 0.01; await new Promise((r) => setTimeout(r, 300)); const a7 = B.att; B.round = 12; B.endRound(B.att, 'elim'); B.t = 0.01; await new Promise((r) => setTimeout(r, 300)); return { rounds: B.rounds, need: B.need, same7: a7 === a0, sw13: B.att !== a0 && B.round === 13 }; });
  check(lg.rounds === 24 && lg.need === 13 && lg.same7 && lg.sw13, 'uzun maç: 24 raunt, ilk 13, taraf 12. rauntan sonra değişir', lg);
  for (const p of [page, p2, p3]) { if (p.errs.length) check(false, 'sayfa hatası', p.errs.slice(0, 3)); await p.close(); }
}

// ───── BOTLAR: kurma, düşen bombayı alma, imha (tarayıcıda gerçek maç) ─────
async function bots() {
  const page = await offPage('&team=blue');
  await page.evaluate(() => { const me = __B.me(); me.devGod = true; __B.g.devGod = true; const P = __B.g.map.spawns[me.team][0]; me.pos.set(P.x, P.y ?? 0, P.z); });
  // oyuncu kenarda dursun (ölümsüz, ateş etmez); botlar oynasın: kurma / imha / düşen bombayı alma olaylarını say
  const r = await page.evaluate(async () => {
    const g = __B.g, B = __B.B, me = __B.me(), seen = { plant: 0, defuse: 0, pick: 0, drop: 0, boom: 0, rounds: [] };
    g.on('bmplant', () => seen.plant++); g.on('bmdefuse', () => seen.defuse++); g.on('bmboom', () => seen.boom++); g.on('bmround', (e) => seen.rounds.push(e.side + '/' + e.why));
    const ev0 = g.netEvent.bind(g); g.netEvent = (e) => { if (e.e === 'bmk' && e.k === 1) seen.pick++; if (e.e === 'bmd') seen.drop++; return ev0(e); };
    me.alive = false; me.hp = 0; me.respawnT = 1e9; me.deadT = 9;                      // oyuncu oyun dışı (izler): botlar 5v4
    const t0 = performance.now();
    while ((seen.rounds.length < 3 || !seen.plant) && performance.now() - t0 < 420000) await new Promise((r) => setTimeout(r, 250));
    return seen;
  });
  check(r.rounds.length >= 3, `botlar 3 raunt oynadı: ${r.rounds.join(', ')}`, r);
  check(r.plant >= 1, 'botlar bombayı kurdu', r);
  check(page.errs.length === 0, 'botlar: sayfa hatası yok', page.errs.slice(0, 3));
  await page.close();
}

// ───── DOKUNMATİK: bölgede KUR düğmesi görünür, basılı tutunca (gerçek dokunuş, CDP) kurulur ─────
async function touch() {
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?autostart=5v5&type=bomba&map=${MAP}&debug=1&touch=1&shadows=0`);
  await page.waitForFunction(() => window.__game && window.__game.bomba && document.getElementById('bResume') && document.getElementById('pause').style.display === 'flex', null, { timeout: 300000 });
  await wait(500);
  { const b = await page.locator('#bResume').boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await wait(800); }      // dokunmatikte oyun "Devam" ile başlar
  await page.evaluate(HELP);
  await page.evaluate(() => { __B.side('att'); __B.freeze(); __B.live(); });
  await wait(300);
  const hid0 = await page.evaluate(() => { __B.give(__B.me()); const P = __B.outSite(0); __B.put(__B.me(), P.x, P.z); return new Promise((r) => setTimeout(() => r(document.querySelector('#tc [data-b="bomb"]')?.classList.contains('hid')), 400)); });
  await page.evaluate(() => { const P = __B.inSite(0), s = __B.B.sites[0]; __B.put(__B.me(), P.x, P.z, Math.atan2(-(s.x - P.x), -(s.z - P.z))); });
  await wait(500);
  const bb = await page.locator('#tc [data-b="bomb"]').boundingBox();
  check(hid0 === true && !!bb && bb.width > 20, 'dokunmatik: KUR düğmesi bölge dışında gizli, bölgede görünür', { hid0, bb });
  if (bb) {
    const cdp = await ctx.newCDPSession(page), x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
    const g0 = await page.evaluate(() => __B.g.time);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    const r = await page.evaluate(() => new Promise((res) => { const t0 = performance.now(); const f = () => (__B.B.bomb.st === 'planted' || performance.now() - t0 > 6000 ? res(__B.B.bomb.st) : setTimeout(f, 30)); f(); }));
    const g1 = await page.evaluate(() => __B.g.time);
    await shot(page, 'bomba-touch');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(r === 'planted' && g1 - g0 > 2.9 && g1 - g0 < 3.6, `dokunmatik: düğme basılı → ${(g1 - g0).toFixed(2)} sn'de kuruldu`, r);
  }
  check(!errs.length, 'dokunmatik: sayfa hatası yok', errs.slice(0, 3));
  await ctx.close();
}

// ───── MENÜ: mod kartı, yalnız bölgeli haritalar, maç uzunluğu 12 / 24 → Oyna ─────
async function menu() {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/?debug=1&nolock=1&nologin=1');
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-a="go"][data-v="custom"]')][0]; b?.click(); });
  await page.waitForTimeout(800);
  const card = await page.$('[data-a="type"][data-v="bomba"]');
  check(!!card, 'menü: Bomba kartı var');
  if (card) { await card.click(); await page.waitForTimeout(900); }
  const st = await page.evaluate(() => ({ maps: [...document.querySelectorAll('.mapc[data-a="map"]')].map((e) => e.dataset.v).filter((v) => v !== 'random'), on: document.querySelector('.mapc.on')?.dataset.v, rounds: [...document.querySelectorAll('[data-a="rounds"]')].map((e) => e.dataset.v + (e.classList.contains('on') ? '*' : '')), size: document.getElementById('vSize')?.textContent, time: document.querySelector('#bs3')?.textContent.includes('1:55') }));
  check(st.maps.join() === 'colgecidi,uykukoy' && st.on === 'colgecidi', 'menü: yalnız bölgeli haritalar (Çöl Geçidi varsayılan, Kum Köyü)', st.maps.join(',') + ' · seçili ' + st.on);
  check(st.rounds.join() === '12*,24' && /5\s*vs\s*5/.test(st.size || '') && st.time, 'menü: maç uzunluğu kısa (ilk 7, varsayılan) / uzun (ilk 13), 5v5, 1:55', st);
  await page.click('[data-a="rounds"][data-v="24"]'); await page.waitForTimeout(400);
  await page.click('.mapc[data-a="map"][data-v="uykukoy"]'); await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#bs3')?.scrollIntoView());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/bomba-menu.png` }); shots.push(`${OUT}/bomba-menu.png`);
  await page.evaluate(() => document.querySelector('.bld-side [data-a="quick"], [data-a="quick"]')?.click());
  await page.waitForFunction('window.__game && window.__game.running && window.__game.bomba', null, { timeout: 300000 });
  const g = await page.evaluate(() => ({ type: __game.mode.type, rounds: __game.bomba.rounds, need: __game.bomba.need, per: __game.mode.perTeam, map: __game.map.id, sites: __game.bomba.sites.map((s) => s.name).join('') }));
  check(g.type === 'bomba' && g.rounds === 24 && g.need === 13 && g.per === 5 && g.map === 'uykukoy' && g.sites === 'AB', 'menü → Oyna: Bomba maçı Kum Köyü, 24 raunt (ilk 13), 5v5, A / B bölgesi', g);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = __game, B = g.bomba, me = g.playerSoldier; if (B.phase === 'prep') B.t = 0.01; const s = B.sites[0]; me.pos.set(s.x + 1, 0, s.z + 7); g.world.settle(me); me.yaw = 0; me.pitch = -0.15; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/bomba-koy-siteA.png` }); shots.push(`${OUT}/bomba-koy-siteA.png`);
  check(!errs.length, 'menü: sayfa hatası yok', errs.slice(0, 3).join(' | '));
  await page.close();
}

// ───── ÇEVRİM İÇİ: 3 insan (Mavi A, B · Kırmızı C), botsuz oda, sunucu yetkili ─────
async function online() {
  const open = async (name, team, code) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|favicon|Failed to load/.test(m.text())) errs.push(m.text()); });
    await page.goto(code ? `${BASE}/?online=${code}&debug=1&nolock=1&server=${WS}&name=${name}&team=${team}` : `${BASE}/?online=new&type=bomba&per=3&map=${MAP}&bots=0&debug=1&nolock=1&server=${WS}&name=${name}&team=${team}`);
    await page.waitForFunction('window.__game && window.__game.running && window.__game.bomba && window.__game.online && window.__game.playerSoldier', null, { timeout: 300000 });
    await page.evaluate(HELP);
    page.errs = errs; page.nm = name;
    return page;
  };
  const A = await open('Ali', 'blue');
  const code = await A.evaluate(() => window.__game.opts.online.room);
  const dbg = (p, m) => p.evaluate((m) => __B.g.online.send({ t: 'dbg', ...m }), m);
  const B = await open('Bora', 'blue', code);
  await dbg(A, { bm: { restart: 1 } }); await until(B, `__B.B.phase === 'prep' && __B.g.playerSoldier.alive`);
  // rakipsiz raunt (Kırmızı boş): bitmiyor, sayılmıyor
  await dbg(A, { bm: { t: 0.01 } }); await until(A, `__B.B.phase === 'live'`);
  await wait(1500);
  const solo = await A.evaluate(() => ({ round: __B.B.round, ph: __B.B.phase, tk: [__B.g.tickets.blue, __B.g.tickets.red] }));
  check(solo.round === 1 && solo.ph === 'live' && solo.tk[0] === 0 && solo.tk[1] === 0, 'rakipsiz raunt (Kırmızı boş): bitmiyor, sayılmıyor', solo);
  const C = await open('Cem', 'red', code);
  await wait(900);
  const ids = await A.evaluate(() => Object.fromEntries(__B.g.soldiers.filter((s) => !s.vacant).map((s) => [s.name, [s.id, s.team]])));
  const ph = await C.evaluate(() => ({ ph: __B.B.phase, round: __B.B.round, tk: [__B.g.tickets.blue, __B.g.tickets.red], alive: __B.me().alive, pips: document.querySelectorAll('#bmpips .p').length }));
  check(ids.Ali?.[1] === 'blue' && ids.Bora?.[1] === 'blue' && ids.Cem?.[1] === 'red', 'çevrim içi: Bomba odası, 2 Mavi + 1 Kırmızı insan', ids);
  check(ph.round === 1 && ph.tk[0] === 0 && ph.alive && ph.pips === 3, 'Kırmızı\'ya ilk gelen: 1. raunt baştan, 0–0, C doğdu', ph);
  const P = { Ali: A, Bora: B, Cem: C };
  const fresh = async () => { await dbg(A, { bm: { restart: 1 } }); await until(A, `__B.B.phase === 'prep'`); await dbg(A, { bm: { t: 0.01 } }); for (const p of [A, B, C]) await until(p, `__B.B.phase === 'live' && __B.me().alive`); await wait(400); };
  await fresh();
  const att = await A.evaluate(() => __B.B.att);
  const atk = Object.keys(ids).filter((n) => ids[n][1] === att), dfs = Object.keys(ids).filter((n) => ids[n][1] !== att);
  console.log(`      saldıran: ${att} (${atk.join(', ')}) · savunan: ${dfs.join(', ')}`);
  // taşıyan: saldıran istemcisinde görünür, savunanda gizli
  const carA = await P[atk[0]].evaluate(() => ({ st: __B.B.bomb.st, car: __B.B.bomb.carrier?.name || null }));
  const carD = await P[dfs[0]].evaluate(() => ({ st: __B.B.bomb.st, car: __B.B.bomb.carrier?.name || null }));
  check(carA.st === 'carried' && atk.includes(carA.car), 'bomba bir saldıran insanda (saldıran istemcisi görüyor)', carA);
  check(carD.st === 'carried' && carD.car === null, 'savunan istemcisinde taşıyan gizli', carD);
  const X = P[carA.car], Y = P[dfs[0]];
  // kurma: taşıyan A bölgesine ışınlanır, gerçek E (girdi bu → sunucu)
  const spot = await X.evaluate(() => __B.inSite(0));
  await dbg(X, { tp: [spot.x, spot.z] }); await wait(700);
  const pre = await X.evaluate(() => ({ kind: __B.B.useKind(__B.me()), use: __B.vis('bmuse'), txt: __B.txt('bmuse') }));
  check(pre.kind === 'plant' && pre.use && /Bombayı kur/.test(pre.txt), 'çevrim içi: bölgede istem', pre);
  await X.bringToFront(); await wait(300);
  const pl = await holdUntil(X, "__B.B.bomb.st === 'planted'", 7000);
  check(pl.ok && pl.dt > 2.9 && pl.dt < 3.8, `çevrim içi kurma ${pl.dt} sn (sunucu → anlık görüntü)`, pl);
  await wait(500);
  const yv = await Y.evaluate(() => ({ st: __B.B.bomb.st, site: __B.B.bomb.site, timer: __B.vis('bmtimer'), ban: __B.txt('bmban'), t: __B.B.t }));
  check(yv.st === 'planted' && yv.site === 0 && yv.timer && /BOMBA KURULDU/.test(yv.ban) && yv.t > 37, 'savunan istemcisi: BOMBA KURULDU, 40 sn sayaç', yv);
  await shot(Y, 'bomba-online-planted');
  // imha (kitsiz 10 sn): savunan bombanın yanına, gerçek E
  const bp = await Y.evaluate(() => ({ x: __B.B.bomb.x, y: __B.B.bomb.y, z: __B.B.bomb.z }));
  await dbg(Y, { bm: { kit: [ids[Y.nm][0], 0] } });
  await dbg(Y, { tp: [bp.x + 0.7, bp.z] }); await dbg(X, { tp: [bp.x + 25, bp.z + 25] }); await wait(800);
  const cc = await Y.evaluate(async () => { const g = __B.g, B = __B.B; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); await new Promise((r) => setTimeout(r, 2000)); const a = B.bomb.prog, w = B.bomb.who?.name; g.player.keys.add('KeyS'); await new Promise((r) => setTimeout(r, 500)); const b = B.bomb.prog; g.player.keys.delete('KeyS'); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); return { a, b, w }; });
  check(cc.a > 1.3 && cc.b < 0.4 && cc.w === Y.nm, 'çevrim içi imha ilerliyor (anlık görüntü), yürüyünce iptal', cc);
  await dbg(Y, { tp: [bp.x + 0.7, bp.z] }); await dbg(Y, { bm: { t: 30 } }); await wait(800);
  const dp = Y.evaluate(async () => { await new Promise((r) => setTimeout(r, 3000)); return __B.txt('bmuse'); });
  await Y.bringToFront();
  const df = await holdUntil(Y, "__B.B.bomb.st === 'defused'", 14000);
  await shot(Y, 'bomba-online-defused');
  const dpt = await dp;
  check(df.ok && df.dt > 9.8 && df.dt < 10.9, `çevrim içi kitsiz imha ${df.dt} sn`, df);
  check(/İmha ediliyor/.test(dpt), 'imha sürerken istem + halka', dpt);
  await wait(400);
  const r1 = await X.evaluate(() => ({ ...__B.st(), ban: __B.txt('bmban') }));
  check(r1.ph === 'post' && r1.last !== att && r1.why === 'defuse' && /BOMBA İMHA EDİLDİ/.test(r1.ban) && /kaybettiniz/.test(r1.ban), 'imha → savunan raundu aldı (saldıran afişi)', r1);
  // kitli imha 5 sn
  await fresh();
  await dbg(A, { bm: { plant: 1 } }); await wait(600);
  const bp2 = await Y.evaluate(() => ({ x: __B.B.bomb.x, z: __B.B.bomb.z, st: __B.B.bomb.st }));
  await dbg(Y, { bm: { kit: [ids[Y.nm][0], 1] } }); await dbg(Y, { tp: [bp2.x + 0.7, bp2.z] }); await wait(900);
  const kb = await Y.evaluate(() => ({ kit: __B.me().bmKit, badge: getComputedStyle(document.querySelector('#bmbadge .kit')).display !== 'none' }));
  check(bp2.st === 'planted' && kb.kit && kb.badge, 'kit sunucudan (anlık görüntü), HUD kit rozeti', kb);
  const d5 = await holdUntil(Y, "__B.B.bomb.st === 'defused'", 9000);
  check(d5.ok && d5.dt > 4.8 && d5.dt < 5.9, `çevrim içi kitli imha ${d5.dt} sn`, d5);
  // patlama: kur, 0,3 sn → patlar; yakındaki savunan ölür, saldıran kazanır
  await fresh();
  await dbg(A, { bm: { plant: 0 } }); await wait(500);
  const bp3 = await Y.evaluate(() => ({ x: __B.B.bomb.x, z: __B.B.bomb.z }));
  await dbg(Y, { tp: [bp3.x + 3, bp3.z] }); await dbg(X, { tp: [bp3.x + 60, bp3.z + 40] }); await wait(500);
  await dbg(A, { bm: { t: 0.3 } }); await wait(1200);
  const bx = await Y.evaluate(() => ({ ...__B.st(), alive: __B.me().alive, ban: __B.txt('bmban') }));
  check(bx.st === 'exploded' && !bx.alive && bx.last === att && /HEDEF YOK EDİLDİ/.test(bx.ban), 'çevrim içi patlama: 3 m\'deki savunan öldü, saldıran kazandı, afiş', bx);
  await shot(Y, 'bomba-online-explosion');
  await wait(1500);
  const sp = await Y.evaluate(() => ({ sp: __B.vis('bmsp'), txt: __B.txt('bmsp'), dead: !__B.me().alive }));
  check(!sp.dead || sp.sp || dfs.length === 1, 'ölünce izleme çubuğu (takımda arkadaş varsa)', sp);
  // düşme / alma (çevrim içi): taşıyan ölür → yerde; (varsa) öbür saldıran üstünden geçince alır
  await fresh();
  const car2 = await P[atk[0]].evaluate(() => __B.B.bomb.carrier?.name);
  const cx = await P[car2].evaluate(() => __B.outSite(0));
  await dbg(P[car2], { tp: [cx.x, cx.z] }); await wait(400);
  await dbg(Y, { dmg: [ids[car2][0], 9999] }); await wait(700);
  const dr = await P[atk[0]].evaluate(() => ({ st: __B.B.bomb.st, x: __B.B.bomb.x, z: __B.B.bomb.z }));
  const drD = await Y.evaluate(() => ({ st: __B.B.bomb.st, x: __B.B.bomb.x }));
  check(dr.st === 'dropped' && drD.st === 'dropped', 'çevrim içi: taşıyan öldü → bomba yerde (iki tarafta da)', { dr, drD });
  const other = atk.find((n) => n !== car2);
  if (other) {
    await dbg(P[other], { tp: [dr.x, dr.z] }); await wait(800);
    const pk = await P[other].evaluate(() => ({ st: __B.B.bomb.st, car: __B.B.bomb.carrier?.name, badge: getComputedStyle(document.querySelector('#bmbadge .bomb')).display !== 'none' }));
    check(pk.st === 'carried' && pk.car === other && pk.badge, `çevrim içi: ${other} üstünden geçti → bombayı aldı, "bomba sende"`, pk);
  }
  // eleme: savunanların hepsi ölür → saldıran
  const killer = P[atk.find((n) => n !== car2) || atk[0]];
  if (other) {
    for (const n of dfs) await dbg(killer, { dmg: [ids[n][0], 9999] });
    await wait(700);
    const el = await A.evaluate(() => ({ ...__B.st(), ban: __B.txt('bmban') }));
    check(el.last === att && el.why === 'elim' && /SAVUNANLAR ELENDİ/.test(el.ban), 'çevrim içi: savunanların hepsi öldü → saldıran', el);
  } else {
    const el = await A.evaluate(() => ({ ...__B.st(), ban: __B.txt('bmban') }));
    check(el.last !== att && el.why === 'elim' && /SALDIRANLAR ELENDİ/.test(el.ban), 'çevrim içi: tek saldıran kurmadan öldü → savunan', el);
  }
  // maç sonu: skor 6–x → 7. galibiyet → üç istemcide sonuç ekranı
  await until(A, `__B.B.phase === 'prep'`, 15000);
  await dbg(A, { bm: { t: 0.01, sc: att === 'blue' ? [6, 2] : [2, 6] } }); await until(A, `__B.B.phase === 'live'`);
  for (const p of [A, B, C]) await until(p, `__B.me().alive`);
  for (const n of dfs) await dbg(P[atk[0]], { dmg: [ids[n][0], 9999] });
  for (const p of [A, B, C]) await until(p, '__B.g.ended', 20000).catch(() => {});
  const ends = await Promise.all([A, B, C].map((p) => p.evaluate(() => ({ ended: __B.g.ended, tk: [__B.g.tickets.blue, __B.g.tickets.red] }))));
  check(ends.every((e) => e.ended && Math.max(...e.tk) === 7), 'çevrim içi: 7. galibiyet → üç istemcide maç sonu', ends);
  await shot(C, 'bomba-online-end');
  for (const p of [A, B, C]) { if (p.errs.length) check(false, `${p.nm}: sayfa hatası`, p.errs.slice(0, 3)); await p.close(); }
}

const t0 = Date.now();
try {
  if (PARTS.includes('off')) await offline();
  if (PARTS.includes('rules')) await rules();
  if (PARTS.includes('swap')) await swap();
  if (PARTS.includes('bots')) await bots();
  if (PARTS.includes('touch')) await touch();
  if (PARTS.includes('menu')) await menu();
  if (PARTS.includes('on')) await online();
} catch (e) { console.log('HATA  istisna: ' + (e.stack || e)); fail++; }
console.log(`\n${pass} OK · ${fail} HATA · ${((Date.now() - t0) / 1000).toFixed(0)} sn · görüntüler: ${shots.join(', ')}`);
await browser.close();
process.exit(fail ? 1 : 0);
