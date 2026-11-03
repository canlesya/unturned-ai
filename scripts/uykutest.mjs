// 12.223 Uyku Modu tarayıcı testi (çevrimdışı + çevrim içi, gerçek tarayıcı, ekran görüntüleri /tmp/wb-uyku/):
//   URL=http://127.0.0.1:5196 WS=ws://127.0.0.1:8996 node scripts/uykutest.mjs        (sunucu BF_DEBUG=1 ile)
//   PARTS=off,swap,bots,on (varsayılan hepsi) · MAP=depo · SOFT=1 yazılım GPU
// Denetlenen: can 0 → ölüm yerine uyku (yatar, yürüyemez, ateş edemez, ekran kararır) · sağ tık basılı 3 sn → kaldırma (%30 can) · uzaklaşma iptal ·
// hak sınırları (kaldıran 2, kaldırılan 2) · 20 sn kanama → elenme · uyuyan düşmanı vurma → bitirme · raunt sonu: eleme / süre (sayı, can, berabere) ·
// 5 rauntluk maç sonu · 10 rauntta 5. rauntan sonra taraf değişimi · botlar gerçekten kaldırıyor · elenince izleme · çevrim içinde aynısı sunucu yetkili.
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.URL || 'http://127.0.0.1:5196', WS = process.env.WS || 'ws://127.0.0.1:8996', MAP = process.env.MAP || 'depo';
const PARTS = (process.env.PARTS || 'off,swap,bots,menu,on').split(','), OUT = process.env.OUT || '/tmp/wb-uyku';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.SOFT ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0; const check = (ok, msg, x = '') => { console.log((ok ? 'OK    ' : 'HATA  ') + msg + (x !== '' ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); if (!ok) fail++; };
const shots = [];
const shot = async (page, name) => { const p = `${OUT}/${name}.png`; await page.screenshot({ path: p }); shots.push(p); };

// sayfa yardımcıları (window.__U)
const HELP = () => {
  const g = window.__game, U = g.uyku;
  const free = (x, z, r0 = 0) => {
    for (let k = 0; k < 400; k++) {
      const a = k * 2.399, r = r0 + (k % 20) * 0.35, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (g.nav.isFree(px, pz) && g.nav.isFree(px + 1.3, pz) && g.nav.isFree(px - 1.3, pz) && g.nav.isFree(px, pz + 1.3)) return { x: px, z: pz };
    }
    return { x, z };
  };
  window.__U = {
    g, U,
    freeze() { g.brainsOff = [...(g.brainsOff || []), ...g.brains.splice(0)]; for (const s of g.soldiers) { s.vel.set(0, 0, 0); s.ads = false; s.sprinting = false; s.protT = 0; } },
    put(s, x, z, yaw = 0) { s.pos.set(x, g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); g.world.settle(s); s.yaw = yaw; s.protT = 0; },
    spot() { const sp = g.map.spawns[g.playerSoldier.team][0], o = g.map.spawns[g.playerSoldier.team === 'blue' ? 'red' : 'blue'][0]; return free(sp.x + (o.x - sp.x) * 0.35, sp.z + (o.z - sp.z) * 0.35); },
    live() { if (U.phase === 'prep') U.t = 0.01; },
    mates() { const me = g.playerSoldier; return g.soldiers.filter((s) => s !== me && s.team === me.team); },
    foes() { const me = g.playerSoldier; return g.soldiers.filter((s) => s.team !== me.team); },
    st(s) { return { id: s.id, alive: s.alive, downed: !!s.downed, hp: Math.round(s.hp), bleed: +(s.bleedT || 0).toFixed(1), rvN: s.rvN | 0, rvdN: s.rvdN | 0, out: !!s.uyOut, prone: s.prone }; },
    vis(id) { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; },
    txt(id) { return (document.getElementById(id)?.textContent || '').replace(/\s+/g, ' ').trim(); },
    feed() { return [...document.querySelectorAll('#killfeed .kf')].map((e) => e.textContent.replace(/\s+/g, ' ').replace(/\s+/g, ' ')).join(' | '); },
    // 12.227 baygın oyuncunun durumu (girdi kilidi denetimi) + kamera kimi izliyor
    lk() {
      const me = g.playerSoldier, c = g.camera.position, e = me.eye(), tg = U.specTarget?.(), te = tg?.eye();
      return { full: me.stat.mag, cur: me.cur, x: +me.pos.x.toFixed(3), z: +me.pos.z.toFixed(3), mag: me.item.mag, res: me.item.reserve, rl: +me.reloadT.toFixed(2), sw: +me.switchT.toFixed(2), prone: me.prone, cr: me.crouching, ads: !!me.ads,
        proj: g.projectiles.length, cook: !!me.cook, fm: me.fireModeNow, op: me.opticId, cls: me.cls, pcls: g.pendingClass || null, veh: !!me.veh, third: !!g.player.third,
        downed: !!me.downed, alive: me.alive, tg: tg ? tg.name : null, tgUp: tg ? tg.alive && !tg.downed : null, dTg: te ? +Math.hypot(c.x - te.x, c.y - te.y, c.z - te.z).toFixed(2) : -1, dMe: +Math.hypot(c.x - e.x, c.y - e.y, c.z - e.z).toFixed(2) };
    },
    // ekrandaki mod metinleri (istem / akış / afiş / bildirim / izleme): uyku sözcüğü olmamalı
    texts() { return ['uydn', 'uyrv', 'uyban', 'uysp', 'uymk', 'uyprep', 'killfeed', 'toasts', 'pops'].map((id) => document.getElementById(id)?.textContent || '').join(' ¦ ') + ' ¦ ' + (g.killfx?.nt?.textContent || '') + ' ¦ ' + [...document.querySelectorAll('#uypips .p')].map((e) => e.title).join(' '); },
  };
};
const SLEEPY = /uyu|uyan|uyut|sleep|asleep/i;
// 12.227 baygınken gerçek klavye / fare girdisi: silah (1–4, tekerlek), hareket (WASD, boşluk, Ctrl, Shift), duruş (C, Z), şarjör (R), bomba (G), ateş modu (X),
// nişangâh (B, T), araç / ikmal (E), bıçak (V), 3. şahıs (H), ateş (sol tık = izlenen arkadaşı değiştirir), nişan (sağ tık), sınıf isteği
async function pressAll(page) {
  await page.mouse.move(640, 360);
  for (const k of ['Digit2', 'Digit3', 'Digit4', 'Digit1', 'KeyR', 'KeyG', 'KeyX', 'KeyB', 'KeyT', 'KeyC', 'KeyZ', 'KeyE', 'KeyV', 'KeyH', 'KeyF', 'KeyY']) { await page.keyboard.press(k); await wait(40); }
  await page.mouse.wheel(0, 120); await wait(150); await page.mouse.wheel(0, -240); await wait(150);
  for (const k of ['KeyW', 'KeyA', 'ShiftLeft', 'Space']) await page.keyboard.down(k);
  await wait(600);
  for (const k of ['KeyW', 'KeyA', 'ShiftLeft', 'Space']) await page.keyboard.up(k);
  for (const k of ['KeyS', 'KeyD']) await page.keyboard.down(k);
  await wait(400);
  for (const k of ['KeyS', 'KeyD']) await page.keyboard.up(k);
  await page.keyboard.down('ControlLeft'); await wait(250); await page.keyboard.up('ControlLeft');
  await page.mouse.down({ button: 'right' }); await wait(200); await page.mouse.up({ button: 'right' });
  const tg0 = await page.evaluate(() => __U.lk().tg);
  await page.mouse.down(); await wait(350); await page.mouse.up();
  await page.evaluate(() => { const g = __U.g, k = Object.keys(g.classDefs).find((c) => c !== g.playerSoldier.cls && !g.classDefs[c].zombie); g.requestClass(k); });
  return tg0;
}
const sameLk = (a, b) => a.cur === b.cur && Math.hypot(a.x - b.x, a.z - b.z) < 0.05 && a.mag === b.mag && a.res === b.res && b.rl === 0 && b.sw === 0 && b.prone && !b.cr && !b.ads
  && a.proj === b.proj && !b.cook && a.fm === b.fm && a.op === b.op && a.cls === b.cls && a.pcls === b.pcls && !b.veh && !b.third && b.downed;
// sağ tık basılı (gerçek fare olayı, kanvas ortası)
const rmb = async (page, down) => { const v = page.viewportSize(); await page.mouse.move(v.width / 2, v.height / 2); if (down) await page.mouse.down({ button: 'right' }); else await page.mouse.up({ button: 'right' }); };

async function offPage(extra = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${BASE}/?autostart=5v5&type=uyku&map=${MAP}&debug=1&nolock=1${extra}`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive && window.__game.uyku', null, { timeout: 300000 });
  await page.evaluate(HELP);
  page.errs = errs;
  return page;
}

// ───── ÇEVRİMDIŞI: uyuma, kaldırma, haklar, kanama, bitirme, raunt sonu, maç sonu ─────
async function offline() {
  const page = await offPage();
  await wait(1200);
  const pre = await page.evaluate(() => ({ ph: __U.U.phase, t: __U.U.t, round: __U.U.round, rounds: __U.U.rounds, tk: [__U.g.tickets.blue, __U.g.tickets.red], pips: __U.vis('uypips'), prep: __U.vis('uyprep'), prepTxt: __U.txt('uyprep') }));
  check(pre.ph === 'prep' && pre.round === 1 && pre.rounds === 5, 'maç 1. rauntun hazırlığıyla başlıyor (5 raunt)', pre);
  check(pre.pips && pre.prep && /1/.test(pre.prepTxt), 'HUD: durum noktaları + hazırlıkta sınıf şeridi', pre.prepTxt);
  await shot(page, 'uyku-prep');
  // hazırlıkta sınıf seçimi (2 = sıhhiye) hemen geçerli + hazırlıkta yürünmez
  const prep = await page.evaluate(async () => {
    const g = __U.g, me = g.playerSoldier, p0 = me.pos.clone();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit2' }));
    g.player.keys.add('KeyW'); await new Promise((r) => setTimeout(r, 600)); g.player.keys.delete('KeyW');
    return { cls: me.cls, moved: +Math.hypot(me.pos.x - p0.x, me.pos.z - p0.z).toFixed(2) };
  });
  check(prep.cls === 'medic', 'hazırlıkta 2 tuşu → sınıf hemen Sıhhiye', prep.cls);
  check(prep.moved < 0.05, 'hazırlıkta oyuncu donuk (W basılı 0,6 sn)', prep.moved);
  await page.evaluate(() => { __U.freeze(); __U.live(); });
  await wait(300);
  const live = await page.evaluate(() => ({ ph: __U.U.phase, t: +__U.U.t.toFixed(1), tl: __U.txt('tm') }));
  check(live.ph === 'live' && live.t > 145 && /2:(2|3)/.test(live.tl), 'hazırlık bitti → raunt 2:30', live);
  // 1) bayılma: düşman vurur → ölmez, bayılır (yatar); 12.227: hiçbir girdi işlemez, kamera hemen ayaktaki arkadaşı izler
  // kontrol: ayaktayken aynı tuşlar gerçekten işliyor (2 tuşu ve tekerlek silah değiştirir)
  const ctl = await page.evaluate(() => { const g = __U.g, me = g.playerSoldier, P = __U.spot(); __U.put(me, P.x, P.z, 0); for (const [i, M] of __U.mates().entries()) __U.put(M, P.x - 3 - i * 2, P.z - 2, 0); return me.cur; });
  await page.mouse.move(640, 360);
  await page.keyboard.press('Digit2'); await wait(450); const k2 = await page.evaluate(() => __U.g.playerSoldier.cur);
  await page.keyboard.press('Digit1'); await wait(450);
  await page.mouse.wheel(0, 120); await wait(450); const cw = await page.evaluate(() => __U.g.playerSoldier.cur);
  await page.keyboard.press('Digit1'); await wait(450);
  check(k2 !== ctl && cw !== ctl, 'kontrol: ayaktayken 2 tuşu ve tekerlek silah değiştiriyor', { c0: ctl, k2, cw });
  const d1 = await page.evaluate(async () => {
    const g = __U.g, me = g.playerSoldier, E = __U.foes()[0], P = __U.spot();
    __U.put(me, P.x, P.z, 0); __U.put(E, P.x + 6, P.z, 0);
    me.item.mag = Math.max(1, me.item.mag - 6);                                          // şarjör eksik: R gerçekten şarjör değiştirebilirdi
    me.takeDamage(999, E, 'body', E.pos, 'AK-47');
    await new Promise((r) => setTimeout(r, 250));
    return { st: __U.st(me), lk: __U.lk(), dn: __U.vis('uydn'), txt: __U.txt('uydn'), feed: __U.feed(), kills: E.kills, texts: __U.texts() };
  });
  check(d1.st.alive && d1.st.downed && d1.st.hp === 0 && d1.st.prone, 'can 0 → ölmedi, bayıldı (yüzüstü)', d1.st);
  check(d1.lk.tg && d1.lk.tgUp && d1.lk.dTg < 4 && d1.lk.dMe > 1, 'bayılınca kamera HEMEN ayaktaki arkadaşı izliyor (250 ms)', d1.lk);
  check(d1.dn && /BAYILDIN · \d+/.test(d1.txt) && /İzlenen:/.test(d1.txt), 'altta kanama halkası "BAYILDIN · N" + izlenen arkadaş', d1.txt);
  check(/AK-47 · BAYILTTI/.test(d1.feed) && d1.kills === 1, 'akış: "AK-47 · BAYILTTI" + bayıltan öldürme aldı', d1.feed);
  await shot(page, 'uyfix-downed-spectate');
  { const kf = await page.$('#killfeed'); const bb = await kf?.boundingBox(); if (bb) { const p = `${OUT}/uyfix-feed.png`; await page.screenshot({ path: p, clip: { x: Math.max(0, bb.x - 200), y: Math.max(0, bb.y - 10), width: Math.min(1280 - Math.max(0, bb.x - 200), bb.width + 220), height: bb.height + 40 } }); shots.push(p); } }
  const lk0 = d1.lk, tgA = await pressAll(page);
  await wait(250);
  const lk1 = await page.evaluate(() => __U.lk());
  check(sameLk(lk0, lk1), 'baygın: 1–4 / tekerlek / WASD / boşluk / Ctrl / Shift / C / Z / R / G / X / B / T / E / V / H / sol-sağ tık / sınıf isteği hiçbiri işlemedi', { lk0, lk1 });
  check(lk1.tg && lk1.tg !== tgA && lk1.tgUp, 'baygın: sol tık izlenen arkadaşı değiştirdi (ateş etmedi)', `${tgA} → ${lk1.tg}`);
  // kaldırılıyor: arkadaş yanında sağ tık tutuyor (bot donuk: istek elle) → "X seni kaldırıyor" + ilerleme; kalkınca kamera hemen kendi gözüne
  const rv0 = await page.evaluate(async () => {
    const g = __U.g, me = g.playerSoldier, M = __U.mates().find((s) => s.alive && !s.downed);
    __U.put(M, me.pos.x - 1.3, me.pos.z, Math.PI / 2); M.rvWant = true; M.sinceShot = 9;
    const keep = setInterval(() => { M.rvWant = true; }, 20); window.__keepRv = keep;
    await new Promise((r) => setTimeout(r, 1500));
    return { txt: __U.txt('uydn'), rvP: +me.rvP.toFixed(2), by: me.rvBy?.name, M: M.name };
  });
  check(rv0.rvP > 0.8 && rv0.by === rv0.M && new RegExp(`${rv0.M} seni kaldırıyor`).test(rv0.txt), 'baygın: "X seni kaldırıyor" + ilerleme', rv0);
  await shot(page, 'uyfix-being-revived');
  const rv1 = await page.evaluate(() => new Promise((res) => { const g = __U.g, me = g.playerSoldier; const f = () => { if (!me.downed) { requestAnimationFrame(() => requestAnimationFrame(() => { clearInterval(window.__keepRv); for (const s of g.soldiers) s.rvWant = false; const r = { lk: __U.lk(), dn: __U.vis('uydn'), hp: Math.round(me.hp) }; me.rvdN = 0; for (const s of g.soldiers) s.rvN = 0; res(r); })); } else setTimeout(f, 20); }; f(); }));
  check(!rv1.lk.downed && rv1.lk.dMe < 0.3 && !rv1.dn && rv1.hp === 30, 'kaldırılınca kamera hemen kendi 1. şahsına döndü, baygın paneli kapandı', rv1);
  check(!SLEEPY.test(d1.texts), 'ekran metinlerinde uyku sözcüğü yok (bayılma)', d1.texts.slice(0, 300));
  // 2) oyuncu arkadaşını kaldırır: sağ tık basılı 3 sn → %30 can; istem + ilerleme halkası
  await page.evaluate(() => { const g = __U.g, me = g.playerSoldier; me.downed = false; me.hp = me.maxHp; me.prone = false; me.spawnN++; for (const s of __U.foes()) { __U.put(s, s.pos.x, s.pos.z); } });
  const r0 = await page.evaluate(() => {
    const g = __U.g, me = g.playerSoldier, M = __U.mates()[0], E = __U.foes()[0], P = __U.spot();
    __U.put(me, P.x, P.z, Math.PI / 2); __U.put(M, P.x - 1.3, P.z, 0); __U.put(E, P.x + 30, P.z + 30);
    M.takeDamage(999, E, 'body', E.pos, 'AK-47');
    return { M: __U.st(M), cand: __U.U.candidate(me)?.id, mid: M.id };
  });
  check(r0.M.downed && r0.cand === r0.mid, 'yanında uyuyan arkadaş: aday', r0);
  await wait(300);
  const pr = await page.evaluate(() => ({ on: __U.vis('uyrv'), txt: __U.txt('uyrv'), mk: document.querySelectorAll('#uymk .m').length }));
  check(pr.on && /Sağ tık basılı tut/i.test(pr.txt), 'istem: "Sağ tık basılı tut: Kaldır"', pr.txt);
  await shot(page, 'uyku-revive-prompt');
  const t0 = await page.evaluate(() => __U.g.time);
  await rmb(page, true);
  await wait(1500);
  const mid = await page.evaluate(() => { const g = __U.g, M = __U.mates()[0]; return { rvP: +M.rvP.toFixed(2), by: M.rvBy?.id, me: g.playerSoldier.id, ads: g.playerSoldier.adsT, txt: __U.txt('uyrv'), downed: M.downed }; });
  check(mid.downed && mid.rvP > 1 && mid.rvP < 2.2 && mid.by === mid.me, 'sağ tık basılı: kaldırma ilerliyor (1,5 sn)', mid);
  check(mid.ads < 0.05, 'sağ tık kaldırırken nişan açılmadı', mid.ads);
  await shot(page, 'uyku-revive-progress');
  const done = await page.evaluate(() => new Promise((res) => { const g = __U.g, M = __U.mates()[0]; const f = () => (!M.downed ? res({ t: g.time, M: __U.st(M), feed: __U.feed() }) : setTimeout(f, 30)); f(); }));
  await rmb(page, false);
  const dur = done.t - t0;
  check(dur > 2.85 && dur < 3.5, `kaldırma süresi ${dur.toFixed(2)} sn (3 sn)`);
  check(done.M.alive && !done.M.downed && done.M.hp === 30 && done.M.rvdN === 1, 'kaldırılan ayakta, can %30', done.M);
  check(/kaldırdı/i.test(done.feed), 'akış: "kaldırdı"', done.feed);
  // 3) uzaklaşma iptal eder
  const cancel = await page.evaluate(async () => {
    const g = __U.g, me = g.playerSoldier, M = __U.mates()[0], E = __U.foes()[0];
    M.takeDamage(999, E, 'body', E.pos, 'AK-47');
    return M.downed;
  });
  await rmb(page, true); await wait(1000);
  const c1 = await page.evaluate(async () => { const me = __U.g.playerSoldier, M = __U.mates()[0], a = M.rvP; __U.put(me, me.pos.x + 4, me.pos.z); await new Promise((r) => setTimeout(r, 300)); return { a: +a.toFixed(2), b: +M.rvP.toFixed(2), downed: M.downed }; });
  await rmb(page, false);
  check(cancel && c1.a > 0.6 && c1.b === 0 && c1.downed, 'uzaklaşınca kaldırma iptal (ilerleme sıfır)', c1);
  // ateş etmek de iptal eder
  await page.evaluate(() => { const me = __U.g.playerSoldier, M = __U.mates()[0]; __U.put(me, M.pos.x + 1.3, M.pos.z, Math.PI / 2); });
  await rmb(page, true); await wait(900);
  const c2 = await page.evaluate(async () => { const g = __U.g, M = __U.mates()[0], a = M.rvP; g.player.fireHeld = true; await new Promise((r) => setTimeout(r, 200)); g.player.fireHeld = false; return { a: +a.toFixed(2), b: +M.rvP.toFixed(2) }; });
  check(c2.a > 0.5 && c2.b < c2.a - 0.4, 'ateş edince kaldırma baştan', c2);
  // ikinci kaldırma (oyuncu 2, arkadaş 2)
  await wait(3300); await rmb(page, false);
  const lim = await page.evaluate(() => { const g = __U.g, me = g.playerSoldier, M = __U.mates()[0]; return { me: __U.st(me), M: __U.st(M) }; });
  check(!lim.M.downed && lim.M.rvdN === 2 && lim.me.rvN === 2, 'ikinci kaldırma: kaldıran 2, kaldırılan 2', lim);
  // 4) haklar: 3. kez uyuyan aynı arkadaşı kimse kaldıramaz; kaldıranın hakkı bitti → başka arkadaşı da kaldıramaz
  const L = await page.evaluate(async () => {
    const g = __U.g, U = __U.U, me = g.playerSoldier, [M, M2, M3] = __U.mates(), E = __U.foes()[0];
    M.takeDamage(999, E, 'body', E.pos, 'AK-47');
    __U.put(M2, M.pos.x, M.pos.z + 1.2);
    const out = { meCan: U.canRev(me, M), m2Can: U.canRev(M2, M), m2Ok: U.revOk(M2, M) };
    await new Promise((r) => setTimeout(r, 300));
    out.txt = __U.txt('uyrv');
    __U.put(M3, me.pos.x, me.pos.z + 1.3); M3.takeDamage(999, E, 'body', E.pos, 'AK-47');
    __U.put(M, M.pos.x + 25, M.pos.z);                                                  // M uzakta kalsın (istem M3 için)
    await new Promise((r) => setTimeout(r, 300));
    out.me3 = U.canRev(me, M3); out.txt3 = __U.txt('uyrv'); out.m2for3 = U.canRev(M2, M3) || Math.hypot(M2.pos.x - M3.pos.x, M2.pos.z - M3.pos.z) > 2.2;
    return out;
  });
  check(!L.meCan && !L.m2Can && !L.m2Ok, '2 kez kaldırılan asker 3. kez kaldırılamaz (kimse)', L);
  check(/2 kez/i.test(L.txt), 'istem: "bu raunt 2 kez kaldırıldı"', L.txt);
  check(!L.me3 && /hakkın bitti/i.test(L.txt3), 'kaldıranın hakkı bitti (2/2): başka arkadaşı da kaldıramaz', L.txt3);
  await rmb(page, true); await wait(800);
  const L2 = await page.evaluate(() => { const [, , M3] = __U.mates(); return { rvP: M3.rvP, downed: M3.downed }; });
  await rmb(page, false);
  check(L2.rvP === 0 && L2.downed, 'hak yokken sağ tık ilerletmiyor', L2);
  await shot(page, 'uyku-revive-limit');
  // 5) kanama: 20 sn sonra elenir (M3, kimse yanında değil)
  const b0 = await page.evaluate(() => { const g = __U.g, [, M2, M3] = __U.mates(); __U.put(g.playerSoldier, M3.pos.x + 8, M3.pos.z); __U.put(M2, M3.pos.x - 9, M3.pos.z); return { t: g.time, bl: M3.bleedT, down: M3.uyDownT }; });
  const b1 = await page.evaluate(() => new Promise((res) => { const g = __U.g, M3 = __U.mates()[2]; const f = () => (M3.alive ? setTimeout(f, 50) : res({ t: g.time, st: __U.st(M3), feed: __U.feed(), pips: document.querySelectorAll('#uypips .p.out').length })); f(); }));
  const bl = b1.t - b0.down;
  check(bl > 19.5 && bl < 20.6 && b1.st.out, `kanama: ${bl.toFixed(2)} sn sonra elendi (20 sn)`, b1.st);
  check(/kan kaybından öldü/i.test(b1.feed) && b1.pips >= 1 && !SLEEPY.test(b1.feed), 'akış "kan kaybından öldü" + nokta ✕', b1.feed);
  // 6) bitirme: uyuyan düşmanı vurmak raunt boyunca eler
  const f1 = await page.evaluate(() => {
    const g = __U.g, me = g.playerSoldier, E = __U.foes()[1], sc0 = me.score;
    __U.put(E, me.pos.x + 5, me.pos.z);
    E.takeDamage(999, me, 'body', me.pos, 'M4A1');
    const a = __U.st(E);
    E.takeDamage(12, me, 'legs', me.pos, 'M4A1');
    return { a, b: __U.st(E), dsc: me.score - sc0, feed: __U.feed() };
  });
  check(f1.a.downed && !f1.b.alive && f1.b.out, 'uyuyan düşmanı vurdu → bitirdi (elendi)', f1.b);
  check(f1.dsc === 150 && /bitirdi/i.test(f1.feed), 'puan: uyutma 100 + bitirme 50; akış "bitirdi"', f1.dsc);
  // takım arkadaşının hasarı uyuyanı bitirmez
  const ff = await page.evaluate(() => { const me = __U.g.playerSoldier, E = __U.foes()[2], E2 = __U.foes()[3]; E.takeDamage(999, me, 'body', me.pos, 'x'); E.takeDamage(50, E2, 'body', E2.pos, 'x'); const r = __U.st(E); E.downed = false; E.hp = 100; E.prone = false; return r; });
  check(ff.downed && ff.alive, 'dost hasarı uyuyanı bitirmez', ff);
  await shot(page, 'uyku-pips');
  // 7) raunt sonu: eleme (kırmızının hepsi baygın / elendi) → Mavi alır, afiş
  const e1 = await page.evaluate(async () => {
    const g = __U.g, me = g.playerSoldier;
    for (const e of __U.foes()) if (e.alive && !e.downed) e.takeDamage(999, me, 'body', me.pos, 'M4A1');
    await new Promise((r) => setTimeout(r, 250));
    return { ph: __U.U.phase, last: __U.U.last, why: __U.U.why, tk: [g.tickets.blue, g.tickets.red], ban: __U.txt('uyban'), op: getComputedStyle(document.getElementById('uyban')).opacity };
  });
  check(e1.ph === 'post' && e1.last === 'blue' && e1.why === 'elim' && e1.tk[0] === 1, 'raunt sonu: rakibin hepsi baygın/elendi → Mavi 1–0', e1);
  check(/RAUNDU ALDINIZ/.test(e1.ban), 'afiş: RAUNDU ALDINIZ', e1.ban);
  await shot(page, 'uyku-round-win');
  // raunt 2: herkes doğuşta, haklar sıfır, hazırlık
  await page.evaluate(() => { __U.U.t = 0.01; });
  await wait(400);
  const r2 = await page.evaluate(() => { const g = __U.g; return { round: __U.U.round, ph: __U.U.phase, alive: g.soldiers.filter((s) => s.alive && !s.downed).length, n: g.soldiers.length, rv: g.soldiers.reduce((a, s) => a + (s.rvN | 0) + (s.rvdN | 0), 0), ban: __U.txt('uyban'), d: Math.min(...g.soldiers.filter((s) => s.team === 'blue').map((s) => Math.hypot(s.pos.x - g.map.spawns.blue[0].x, s.pos.z - g.map.spawns.blue[0].z))) }; });
  check(r2.round === 2 && r2.ph === 'prep' && r2.alive === r2.n && r2.rv === 0, '2. raunt: herkes ayakta, haklar sıfır, hazırlık', r2);
  await shot(page, 'uyku-round-banner');
  // raunt 2: süre biter, ayakta 5–4 → Mavi (sayı)
  const tm = async (setup) => {
    await page.evaluate(() => { __U.freeze(); __U.live(); });
    await wait(200);
    return page.evaluate(async (setup) => {
      const g = __U.g, me = g.playerSoldier, F = __U.foes();
      if (setup === 'count') F[0].takeDamage(999, me, 'body', me.pos, 'x');
      if (setup === 'hp') { F[0].takeDamage(999, me, 'body', me.pos, 'x'); __U.mates()[0].takeDamage(999, F[1], 'body', F[1].pos, 'x'); F[1].hp = 40; }
      __U.U.t = 0.02;
      await new Promise((r) => setTimeout(r, 250));
      return { last: __U.U.last, why: __U.U.why, tk: [g.tickets.blue, g.tickets.red], ban: __U.txt('uyban') };
    }, setup);
  };
  const t2 = await tm('count');
  check(t2.last === 'blue' && t2.why === 'count' && /ayakta kalan 5–4/.test(t2.ban), 'süre bitti: ayakta çok olan (5–4) kazanır', t2);
  await page.evaluate(() => { __U.U.t = 0.01; }); await wait(300);
  const t3 = await tm('tie');
  check(t3.last === 'draw' && t3.why === 'tie' && /BERABERE/.test(t3.ban) && t3.tk[0] === 2 && t3.tk[1] === 0, 'süre bitti: ayakta ve can eşit → berabere (skor değişmez)', t3);
  await page.evaluate(() => { __U.U.t = 0.01; }); await wait(300);
  const t4 = await tm('hp');
  check(t4.last === 'blue' && t4.why === 'hp' && t4.tk[0] === 3, 'süre bitti: ayakta eşit (4–4) → toplam canı çok olan (Mavi) kazanır', t4);
  await shot(page, 'uyku-round-hp');
  // maç sonu: Mavi 3 → afişten sonra sonuç ekranı
  const end = await page.evaluate(() => new Promise((res) => { const g = __U.g; const f = () => (g.ended ? res({ ended: true, w: g.hud.$('etitle')?.textContent, info: g.hud.$('einfo')?.textContent, st: g.hud.$('estats')?.innerText, round: __U.U.round, hist: __U.U.hist }) : setTimeout(f, 100)); f(); setTimeout(() => res({ ended: g.ended }), 9000); }));
  check(end.ended && /ZAFER|KAZAN|VICTORY/i.test(end.w || '') && /3–0/.test(end.info + end.st), '5 rauntluk maç: Mavi ilk 3 → maç sonu ekranı', end);
  await shot(page, 'uyku-end');
  check(!page.errs.length, 'çevrimdışı: sayfa hatası yok', page.errs.slice(0, 3).join(' | '));
  await page.close();
}

// ───── 10 raunt: 5. rauntan sonra taraf değişimi, ilk 6 kazanır ─────
async function swap() {
  const page = await offPage('&rounds=10');
  const s0 = await page.evaluate(() => { const g = __U.g; __U.freeze(); return { rounds: __U.U.rounds, need: __U.U.need, blue: [g.map.spawns.blue[0].x, g.map.spawns.blue[0].z], red: [g.map.spawns.red[0].x, g.map.spawns.red[0].z] }; });
  check(s0.rounds === 10 && s0.need === 6, 'uzun maç: 10 raunt, ilk 6', s0);
  const res = [];
  for (let r = 1; r <= 6; r++) {
    const o = await page.evaluate(async (r) => {
      const g = __U.g, U = __U.U, me = g.playerSoldier;
      __U.freeze(); __U.live(); await new Promise((q) => setTimeout(q, 150));
      const sb = g.map.spawns.blue[0], dB = Math.min(...g.soldiers.filter((s) => s.team === 'blue').map((s) => Math.hypot(s.pos.x - sb.x, s.pos.z - sb.z)));
      const at = { round: U.round, blue: [sb.x, sb.z], dB: +dB.toFixed(1), meNear: +Math.min(...g.map.spawns.blue.map((p) => Math.hypot(me.pos.x - p.x, me.pos.z - p.z))).toFixed(1), ban: __U.txt('uyban') };
      U.endRound(r % 2 ? 'blue' : 'red', 'elim'); U.t = 0.01;
      await new Promise((q) => setTimeout(q, 300));
      at.next = { round: U.round, ban: __U.txt('uyban') };
      return at;
    }, r);
    res.push(o);
    if (r === 5) await shot(page, 'uyku-side-swap');
  }
  const r5 = res[4], r6 = res[5];
  check(res.slice(0, 5).every((o) => o.blue[0] === s0.blue[0] && o.blue[1] === s0.blue[1]), '1–5. raunt: Mavi kendi doğuşunda');
  check(r6.round === 6 && r6.blue[0] === s0.red[0] && r6.blue[1] === s0.red[1] && r6.dB < 12 && r6.meNear < 4, '6. raunt: taraflar değişti (Mavi eski Kırmızı doğuşunda)', r6);
  check(/TARAF DEĞİŞTİ/.test(r5.next.ban), 'afiş: TARAF DEĞİŞTİ', r5.next.ban);
  const sc = await page.evaluate(() => [__U.g.tickets.blue, __U.g.tickets.red]);
  check(sc[0] === 3 && sc[1] === 3 && !(await page.evaluate(() => __U.g.ended)), '6 raunt sonra 3–3: maç sürüyor (ilk 6)', sc);
  check(!page.errs.length, '10 raunt: sayfa hatası yok', page.errs.slice(0, 3).join(' | '));
  await page.close();
}

// ───── botlar: uyuyan takım arkadaşını kaldırıyor (Kırmızı uzakta, donuk) + elenen oyuncu izler ─────
async function bots() {
  const page = await offPage();
  const r = await page.evaluate(async () => {
    const g = __U.g, U = __U.U, me = g.playerSoldier;
    __U.live(); await new Promise((q) => setTimeout(q, 200));
    const reds = __U.foes(); g.brains = g.brains.filter((b) => b.s.team === me.team);       // Kırmızı botları sustur (kendi doğuşlarında kalırlar)
    for (const e of reds) { const sp = g.map.spawns[e.team][0]; __U.put(e, sp.x, sp.z); }
    const B = __U.mates(), V = B[0], P = __U.spot();
    for (const [i, s] of B.entries()) __U.put(s, P.x + i * 2.5, P.z + 4);
    __U.put(me, P.x - 3, P.z - 6);
    me.devGod = true; g.devGod = true;
    await new Promise((q) => setTimeout(q, 400));
    V.takeDamage(999, reds[0], 'body', reds[0].pos, 'AK-47');
    const t0 = g.time;
    return new Promise((res) => {
      const f = () => {
        if (!V.downed && V.alive) return res({ ok: true, dt: +(g.time - t0).toFixed(1), hp: Math.round(V.hp), by: g.soldiers.find((s) => s.rvN > 0)?.name, rev: U.stats.revives });
        if (!V.alive || g.time - t0 > 19) return res({ ok: false, st: __U.st(V) });
        setTimeout(f, 100);
      };
      f();
    });
  });
  check(r.ok && r.hp === 30, `bot uyuyan arkadaşını kaldırdı (${r.dt} sn, ${r.by})`, r);
  // bot hakları: aynı bot 2'den fazla kaldırmaz
  const lim = await page.evaluate(async () => {
    const g = __U.g, reds = __U.foes(), B = __U.mates(), R = B.find((s) => s.rvN > 0);
    const out = [];
    for (let k = 0; k < 3; k++) {
      const V = B.find((s) => s !== R && s.alive && !s.downed && (s.rvdN | 0) < 2);
      if (!V) break;
      { const sp = g.map.spawns[R.team]; let i = 0; for (const s of B) if (s !== R && s !== V && s.alive) { const p = sp[(i++ * 2) % sp.length]; __U.put(s, p.x, p.z); } }      // diğerleri doğuşta (uzak): yalnız R kaldırabilir
      __U.put(V, R.pos.x + 2, R.pos.z);
      V.takeDamage(999, reds[0], 'body', reds[0].pos, 'AK-47');
      const t0 = g.time;
      await new Promise((res) => { const f = () => (!V.downed || g.time - t0 > 9 ? res() : setTimeout(f, 100)); f(); });
      out.push({ v: V.name, revived: !V.downed && V.alive, rN: R.rvN, by: g.soldiers.filter((s) => s.team === R.team).map((s) => s.name + ':' + (s.rvN | 0)).join(' ') });
      if (V.downed) V.takeDamage(1, reds[0], 'body', reds[0].pos, 'x');      // kalanı bitir (sonraki deneme temiz)
    }
    return out;
  });
  check(lim.length >= 2 && lim[0].revived && lim.every((o) => o.rN <= 2) && lim[lim.length - 1].rN === 2, 'bot hakkı: aynı bot raunt başına en çok 2 kaldırır (3. uyuyanı başkası kaldırır / kimse)', lim);
  // elenen oyuncu takım arkadaşını izler
  const sp = await page.evaluate(async () => {
    const g = __U.g, me = g.playerSoldier, reds = __U.foes();
    me.devGod = false; g.devGod = false;
    me.takeDamage(999, reds[0], 'body', reds[0].pos, 'x'); me.takeDamage(5, reds[0], 'body', reds[0].pos, 'x');
    await new Promise((q) => setTimeout(q, 500));
    const tg = __U.U.specTarget(), c = g.camera.position;
    const e = tg?.eye(), a = { out: !me.alive, bar: __U.vis('uysp'), txt: __U.txt('uysp'), tg: tg?.name, d: tg ? +Math.hypot(c.x - e.x, c.y - e.y, c.z - e.z).toFixed(1) : -1, rs: __U.vis('respawn') };
    return a;
  });
  check(sp.out && sp.bar && /İzlenen/i.test(sp.txt) && sp.d >= 0 && sp.d < 4 && !sp.rs, 'elenince takım arkadaşı izleniyor (ölüm / doğuş ekranı yok)', sp);
  await shot(page, 'uyku-spectate');
  await page.mouse.click(640, 360);
  await wait(200);
  const sp2 = await page.evaluate(() => __U.U.specTarget()?.name);
  check(sp2 && sp2 !== sp.tg, 'tıkla: izlenen arkadaş değişti', `${sp.tg} → ${sp2}`);
  check(!page.errs.length, 'bot testi: sayfa hatası yok', page.errs.slice(0, 3).join(' | '));
  await page.close();
}

// ───── menü: Özel Oyun → Uyku Modu kartı, yalnız küçük haritalar (Kuzey yok), maç uzunluğu 5 / 10, Oyna → Uyku Modu maçı (10 raunt) ─────
async function menu() {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/?debug=1&nolock=1&nologin=1');
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-a="go"][data-v="custom"]')][0]; b?.click(); });
  await page.waitForTimeout(800);
  const card = await page.$('[data-a="type"][data-v="uyku"]');
  check(!!card, 'menü: Uyku Modu kartı var');
  if (card) { await card.click(); await page.waitForTimeout(900); }
  const st = await page.evaluate(() => ({ maps: [...document.querySelectorAll('.mapc[data-a="map"]')].map((e) => e.dataset.v), on: document.querySelector('.mapc.on')?.dataset.v, rounds: [...document.querySelectorAll('[data-a="rounds"]')].map((e) => e.dataset.v + (e.classList.contains('on') ? '*' : '')), card: document.querySelector('[data-a="type"][data-v="uyku"]')?.textContent.replace(/\s+/g, ' ').slice(0, 90), size: document.getElementById('vSize')?.textContent }));
  check(st.maps.length >= 3 && !st.maps.includes('kuzey') && !st.maps.includes('vadi') && st.maps.includes('depo') && st.maps.includes(st.on), 'menü: yalnız küçük haritalar (Kuzey / Vadi yok)', st.maps.join(',') + ' · seçili ' + st.on);
  check(st.rounds.join() === '5*,10' && /5\s*vs\s*5/.test(st.size || ''), 'menü: maç uzunluğu 5 (varsayılan) / 10, 5v5', st);
  const desc = await page.evaluate(() => document.querySelector('[data-a="type"][data-v="uyku"] small')?.textContent || '');
  check(/BAYILIR/.test(desc) && /3 sn/.test(desc) && /kan kaybından/.test(desc) && !SLEEPY.test(desc), 'menü: mod açıklaması bayılma / kaldırma anlatıyor, uyku sözcüğü yok', desc);
  { const el = await page.$('[data-a="type"][data-v="uyku"]'); await el?.scrollIntoViewIfNeeded(); const bb = await el?.boundingBox(); if (bb) { const p = `${OUT}/uyfix-menu-desc.png`; await page.screenshot({ path: p, clip: { x: Math.max(0, bb.x - 30), y: Math.max(0, bb.y - 30), width: Math.min(1280, bb.width + 60), height: Math.min(720, bb.height + 60) } }); shots.push(p); } }
  await page.click('[data-a="rounds"][data-v="10"]'); await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#bs3')?.scrollIntoView());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/uyku-menu.png` }); shots.push(`${OUT}/uyku-menu.png`);
  await page.evaluate(() => document.querySelector('.bld-side [data-a="quick"], [data-a="quick"]')?.click());
  await page.waitForFunction('window.__game && window.__game.running && window.__game.uyku', null, { timeout: 300000 });
  const g = await page.evaluate(() => ({ type: __game.mode.type, rounds: __game.uyku.rounds, per: __game.mode.perTeam, map: __game.map.id }));
  check(g.type === 'uyku' && g.rounds === 10 && g.per === 5, 'menü → Oyna: Uyku Modu maçı, 10 raunt, 5v5', g);
  check(!errs.length, 'menü: sayfa hatası yok', errs.slice(0, 3).join(' | '));
  await page.close();
}

// ───── ÇEVRİM İÇİ: 3 insan (Mavi A, B · Kırmızı C), botsuz oda, sunucu yetkili ─────
async function online() {
  const open = async (name, team, code) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|favicon|Failed to load/.test(m.text())) errs.push(m.text()); });
    await page.goto(code ? `${BASE}/?online=${code}&debug=1&nolock=1&server=${WS}&name=${name}&team=${team}` : `${BASE}/?online=new&type=uyku&per=3&map=${MAP}&bots=0&debug=1&nolock=1&server=${WS}&name=${name}&team=${team}`);
    await page.waitForFunction('window.__game && window.__game.running && window.__game.uyku && window.__game.online && window.__game.playerSoldier', null, { timeout: 300000 });      // raunt sürerken gelen (takımında arkadaşı varsa) raunt sonuna dek izler: canlı beklenmez
    await page.evaluate(HELP);
    page.errs = errs;
    return page;
  };
  const A = await open('Ali', 'blue');
  const code = await A.evaluate(() => window.__game.opts.online.room);
  const dbg = (p, m) => p.evaluate((m) => __U.g.online.send({ t: 'dbg', ...m }), m);
  const ask = (p) => p.evaluate(() => new Promise((r) => { const n = window.__game.online; const f = (e) => { try { const m = JSON.parse(e.data); if (m.t === 'dbg') { n.ws.removeEventListener('message', f); r(m); } } catch (x) { /* ikili */ } }; n.ws.addEventListener('message', f); n.send({ t: 'dbg', ask: 1 }); }));
  const until = (p, fn, ms = 15000) => p.waitForFunction(fn, null, { timeout: ms, polling: 50 });
  const B = await open('Bora', 'blue', code);
  await dbg(A, { uy: { restart: 1 } }); await until(B, `__U.U.phase === 'prep' && __U.g.playerSoldier.alive`);      // yavaş makinede B hazırlıktan sonra gelmiş olabilir (izliyordur): raunt baştan
  // rakipsiz raunt: Kırmızı boşken raunt başlar (sayılmaz, bitmez); Kırmızı'ya ilk gelen katılınca raunt baştan (12.223 düzeltmesi:
  // eskiden geç gelen elenmiş sayılıyor, Kırmızı'da ayakta kimse yok → Mavi raundu anında alıyordu)
  await dbg(A, { uy: { t: 0.01 } }); await until(A, `__U.U.phase === 'live'`);
  await wait(1500);
  const solo = await A.evaluate(() => ({ round: __U.U.round, ph: __U.U.phase, tk: [__U.g.tickets.blue, __U.g.tickets.red] }));
  check(solo.round === 1 && solo.ph === 'live' && solo.tk[0] === 0, 'rakipsiz raunt (Kırmızı boş): bitmiyor, sayılmıyor', solo);
  const C = await open('Cem', 'red', code);
  await wait(800);
  const ids = await A.evaluate(() => { const g = __U.g; return Object.fromEntries(g.soldiers.filter((s) => !s.vacant).map((s) => [s.name, [s.id, s.team]])); });
  check(ids.Ali?.[1] === 'blue' && ids.Bora?.[1] === 'blue' && ids.Cem?.[1] === 'red', 'çevrim içi: Uyku Modu odası, 2 Mavi + 1 Kırmızı insan', ids);
  const [ia, ib, ic] = [ids.Ali[0], ids.Bora[0], ids.Cem[0]];
  const ph = await C.evaluate(() => ({ ph: __U.U.phase, round: __U.U.round, tk: [__U.g.tickets.blue, __U.g.tickets.red], me: __U.st(__U.g.playerSoldier), pips: document.querySelectorAll('#uypips .p').length }));
  check(ph.round === 1 && ph.tk[0] === 0 && ph.tk[1] === 0 && ph.me.alive && !ph.me.out && ph.pips === 3, 'Kırmızı\'ya ilk gelen: 1. raunt baştan, skor 0–0, C doğdu (elenmiş değil), 3 nokta', ph);
  // sağlam başlangıç: (yavaş makinede katılım uzun sürebilir) raundu baştan al, hazırlığı atla
  await dbg(A, { uy: { restart: 1 } }); await until(A, `__U.U.round === 1 && __U.U.phase === 'prep'`);
  await dbg(A, { uy: { t: 0.01 } }); await until(A, `__U.U.phase === 'live'`); await until(B, `__U.U.phase === 'live'`); await until(C, `__U.U.phase === 'live'`);
  // yerleştir: A ve B yan yana, C 10 m ötede
  const P = await A.evaluate(() => __U.spot());
  await dbg(A, { tp: [P.x, P.z] }); await dbg(B, { tp: [P.x + 1.3, P.z] }); await dbg(C, { tp: [P.x + 10, P.z + 6] });
  await wait(700);
  const live = await B.evaluate(() => ({ ph: __U.U.phase, t: __U.U.t }));
  check(live.ph === 'live' && live.t > 140, 'istemci: raunt başladı (2:30)', live);
  // A şarjörünü biraz boşaltır (havaya): baygınken R gerçekten şarjör değiştirebilirdi
  await A.evaluate(() => { __U.g.playerSoldier.pitch = 1.3; });
  await A.mouse.move(640, 360); await A.mouse.down(); await wait(300); await A.mouse.up(); await wait(500);
  // C, A'yı bayıltır (sunucu: C vurmuş gibi)
  await dbg(C, { dmg: [ia, 9999] });
  await wait(600);
  const s0 = await ask(A), l0 = await A.evaluate(() => __U.lk());
  const a1 = await A.evaluate(() => ({ st: __U.st(__U.g.playerSoldier), dn: __U.vis('uydn'), txt: __U.txt('uydn'), feed: __U.feed() }));
  check(a1.st.alive && a1.st.downed && a1.st.bleed > 17, 'A (çevrim içi): bayıldı, kanama sayacı sunucudan', a1.st);
  check(l0.tg === 'Bora' && l0.dTg < 4 && l0.dMe > 1 && a1.dn && /BAYILDIN · \d+/.test(a1.txt), 'A: kamera hemen Bora\'yı izliyor, altta "BAYILDIN · N"', { l0, txt: a1.txt });
  await shot(A, 'uyfix-online-downed-spectate');
  const tgOn = await pressAll(A);
  await wait(300);
  // sunucu da yok sayıyor: istemci sahte girdi yollar (yürü / koş / zıpla / silah değiştir / duruş / şarjör / ateş / nişan / araç) + sınıf / nişangâh isteği
  await A.evaluate(async () => {
    const g = __U.g, n = g.online, me = g.playerSoldier, o = n.send, other = (me.cur + 1) % me.items.length;
    n.send = (m) => { if (m.t === 'in') Object.assign(m, { f: 1, r: 1, s: 1, j: 1, w: other, c: 1, p: 1, u: 1, rl: 1, fm: 1, o: 1, fh: 1, fp: 1, ve: 1, a: 1, rv: 1 }); return o.call(n, m); };
    o.call(n, { t: 'opt', cls: Object.keys(g.classDefs).find((c) => c !== me.cls && !g.classDefs[c].zombie), optic: 'reflex' });
    await new Promise((r) => setTimeout(r, 900));
    n.send = o;
  });
  await wait(500);
  const s1 = await ask(A), l1 = await A.evaluate(() => __U.lk());
  const sv0 = s0.sv, sv1 = s1.sv;
  check(sameLk(l0, l1) && l1.tg === 'Bora', 'A baygın (istemci): tuşlar / tekerlek / tıklar / sınıf isteği hiçbiri işlemedi', { l0, l1, tgOn });
  check(sv1.alive && sv1.cur === sv0.cur && Math.hypot(sv1.pos[0] - sv0.pos[0], sv1.pos[1] - sv0.pos[1]) < 0.05 && sv1.st === 'p' && sv1.mag === sv0.mag && sv1.rl === 0 && sv1.sw === 0 && sv1.fm === sv0.fm && s1.optic === s0.optic && sv0.mag < l0.full,
    'sunucu: baygının sahte girdileri (yürü / silah / duruş / şarjör / ateş / ateş modu / nişangâh) yok sayıldı', { sv0, sv1, op: [s0.optic, s1.optic] });
  const clsA0 = l0.cls;
  const b1 = await B.evaluate(() => ({ cand: __U.U.candidate(__U.g.playerSoldier)?.name, txt: __U.txt('uyrv'), feed: __U.feed(), mk: document.querySelectorAll('#uymk .m').length }));
  check(b1.cand === 'Ali' && /Sağ tık/i.test(b1.txt) && /BAYILTTI/.test(b1.feed) && !SLEEPY.test(b1.feed), 'B: istem "Sağ tık basılı tut: Kaldır" + akış "BAYILTTI"', b1);
  // B sağ tık basılı tutar (gerçek fare olayı → girdi rv → sunucu)
  const tb0 = Date.now();
  await rmb(B, true);
  await wait(1600);
  await shot(B, 'uyku-online-revive-progress');
  const arv = await A.evaluate(() => ({ txt: __U.txt('uydn'), lk: __U.lk(), texts: __U.texts() }));
  check(/Bora seni kaldırıyor/.test(arv.txt) && arv.lk.tg === 'Bora', 'A (izlerken): "Bora seni kaldırıyor" + ilerleme', arv.txt);
  check(!SLEEPY.test(arv.texts), 'A ekran metinlerinde uyku sözcüğü yok', arv.texts.slice(0, 300));
  await shot(A, 'uyfix-online-being-revived');
  const bm = await B.evaluate(() => { const g = __U.g, a = g.soldiers.find((s) => s.name === 'Ali'); return { rvP: a.rvP, by: a.rvBy?.name, ads: g.playerSoldier.adsT }; });
  check(bm.rvP > 0.8 && bm.rvP < 2.4 && bm.by === 'Bora' && bm.ads < 0.05, 'çevrim içi kaldırma ilerliyor (sunucu → anlık görüntü), nişan yok', bm);
  const ar = await A.evaluate(() => new Promise((res) => { const g = __U.g, me = g.playerSoldier; const f = () => (!me.downed ? (() => { const t = Date.now(); requestAnimationFrame(() => requestAnimationFrame(() => res({ t, st: __U.st(me), feed: __U.feed(), lk: __U.lk(), dn: __U.vis('uydn') }))); })() : setTimeout(f, 30)); f(); setTimeout(() => res({ t: 0, st: __U.st(me) }), 6000); }));
  await rmb(B, false);
  const odur = (ar.t - tb0) / 1000;
  check(ar.st.alive && !ar.st.downed && ar.st.hp === 30 && odur > 2.8 && odur < 3.8, `çevrim içi: A kaldırıldı ${odur.toFixed(2)} sn, can 30`, ar.st);
  check(/kaldırdı/i.test(ar.feed || ''), 'A akış: "kaldırdı"', ar.feed);
  check(ar.lk && ar.lk.dMe < 0.3 && !ar.dn, 'çevrim içi: kalkınca kamera hemen A\'nın 1. şahsına döndü', ar.lk);
  const a2 = await A.evaluate(async () => { const g = __U.g, me = g.playerSoldier, p0 = me.pos.clone(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); await new Promise((r) => setTimeout(r, 600)); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); return +Math.hypot(me.pos.x - p0.x, me.pos.z - p0.z).toFixed(2); });
  check(a2 > 1, 'kaldırılan A yeniden yürüyor', a2);
  // kanama: B uzakta (ayakta), C A'yı uyutur, kimse kaldırmaz → 20 sn sonra A elenir (raunt sürer: B ayakta)
  await dbg(B, { tp: [P.x - 14, P.z] }); await wait(500);
  await dbg(C, { dmg: [ia, 9999] });
  const ao = await A.evaluate(() => new Promise((res) => { const g = __U.g, me = g.playerSoldier; let dn = 0; const f = () => { if (me.downed && !dn) dn = Date.now(); if (dn && !me.alive) return res({ dn, out: Date.now(), ph: __U.U.phase }); setTimeout(f, 30); }; f(); setTimeout(() => res({ dn, out: 0 }), 30000); }));
  const bt = (ao.out - ao.dn) / 1000;
  check(ao.out && bt > 19.3 && bt < 20.8 && ao.ph === 'live', `çevrim içi kanama: A ${bt.toFixed(2)} sn sonra elendi (raunt sürüyor)`, ao);
  await wait(600);
  const a3 = await A.evaluate(() => ({ st: __U.st(__U.g.playerSoldier), sp: __U.vis('uysp'), txt: __U.txt('uysp'), feed: __U.feed() }));
  check(!a3.st.alive && a3.sp && /İzlenen: Bora/.test(a3.txt) && /kan kaybından öldü/i.test(a3.feed), 'A elendi: Bora\'yı izliyor, akış "kan kaybından öldü"', a3);
  await shot(A, 'uyku-online-spectate');
  // C, B'yi uyutur → Mavi'de ayakta kimse yok (A elendi, B uyuyor) → Kırmızı raundu alır (uyuyanlar da sayılır)
  await dbg(C, { dmg: [ib, 9999] }); await wait(500);
  const rr = await C.evaluate(() => ({ last: __U.U.last, ph: __U.U.phase, tk: [__U.g.tickets.blue, __U.g.tickets.red], ban: __U.txt('uyban') }));
  check(rr.last === 'red' && rr.ph === 'post' && rr.tk[1] === 1 && /RAUNDU ALDINIZ/.test(rr.ban), 'Mavi\'nin hepsi baygın / elendi → Kırmızı 1. raundu aldı (C afişi)', rr);
  const ra = await A.evaluate(() => __U.txt('uyban'));
  check(/KAYBETTİNİZ/.test(ra), 'A afişi: RAUNDU KAYBETTİNİZ', ra);
  await shot(C, 'uyku-online-round-banner');
  const startLive = async (n) => { await until(A, `__U.U.round === ${n} && __U.U.phase === 'prep' && __U.g.playerSoldier.alive`); await dbg(A, { uy: { t: 0.01 } }); await until(A, `__U.U.phase === 'live'`); };
  // 2. raunt: herkes doğdu, haklar sıfır
  await until(A, `__U.U.round === 2 && __U.U.phase === 'prep' && __U.g.playerSoldier.alive`);
  const r2 = await A.evaluate(() => ({ round: __U.U.round, ph: __U.U.phase, me: __U.st(__U.g.playerSoldier), ban: __U.txt('uyban') }));
  check(r2.round === 2 && r2.me.alive && !r2.me.downed && r2.me.rvN === 0 && r2.me.rvdN === 0 && /RAUNT 2/.test(r2.ban), 'çevrim içi 2. raunt: A doğdu, haklar sıfır, afiş', r2);
  const cls2 = await A.evaluate(() => __U.g.playerSoldier.cls);
  check(cls2 === clsA0, 'sunucu: baygınken istenen sınıf değişimi uygulanmadı (2. rauntta aynı sınıf)', `${clsA0} → ${cls2}`);
  await startLive(2);
  // bitirme: C, B'yi uyutup (A ayakta) bir kez daha vurur → B raunt sonuna dek elenir
  await dbg(C, { dmg: [ib, 9999] }); await wait(300); await dbg(C, { dmg: [ib, 10] }); await wait(500);
  const b2 = await B.evaluate(() => ({ st: __U.st(__U.g.playerSoldier), ph: __U.U.phase, feed: __U.feed(), sp: __U.vis('uysp') }));
  check(!b2.st.alive && b2.st.out && b2.ph === 'live' && b2.sp && /bitirdi/i.test(b2.feed), 'çevrim içi: uyuyan B vuruldu → bitirildi (izliyor)', b2);
  // süre sonu: ayakta 1–1, C'nin canı 40 → can 100–40 → Mavi
  await dbg(C, { hp: 40 }); await wait(300);
  await dbg(A, { uy: { t: 0.05 } }); await until(C, `__U.U.phase === 'post'`); await wait(150);
  const t3 = await C.evaluate(() => ({ last: __U.U.last, why: __U.U.why, tk: [__U.g.tickets.blue, __U.g.tickets.red], ban: __U.txt('uyban') }));
  check(t3.last === 'blue' && t3.why === 'hp' && t3.tk[0] === 1 && /can 100–40/.test(t3.ban), 'çevrim içi süre sonu: ayakta 1–1, can 100–40 → Mavi', t3);
  // 3. raunt: süre biter, ayakta 2–1 → Mavi (sayı)
  await startLive(3);
  await dbg(A, { uy: { t: 0.05 } }); await until(B, `__U.U.phase === 'post'`); await wait(150);
  const t2 = await B.evaluate(() => ({ last: __U.U.last, why: __U.U.why, tk: [__U.g.tickets.blue, __U.g.tickets.red], ban: __U.txt('uyban') }));
  check(t2.last === 'blue' && t2.why === 'count' && t2.tk[0] === 2 && /2–1/.test(t2.ban), 'çevrim içi süre sonu: ayakta 2–1 → Mavi', t2);
  // maç sonu: Kırmızı 2 raunt daha alır (Mavi 2, Kırmızı 3) → maç biter, üç istemcide sonuç ekranı
  for (const n of [4, 5]) { await startLive(n); await dbg(A, { uy: { end: 'red' } }); await until(A, `__U.U.phase === 'post' || __U.U.phase === 'over' || __U.g.ended`); }
  const ends = await Promise.all([A, B, C].map((p) => p.waitForFunction('window.__game.ended', null, { timeout: 12000 }).then(() => p.evaluate(() => ({ title: __U.g.hud.$('etitle')?.textContent, info: __U.g.hud.$('einfo')?.textContent }))).catch(() => null)));
  check(ends.every(Boolean) && /ZAFER|VICTORY/i.test(ends[2].title) && /YENİLGİ|DEFEAT/i.test(ends[0].title) && /3–2/.test(ends[0].info), 'çevrim içi maç sonu (Kırmızı 3–2): üç istemcide sonuç ekranı', ends);
  await shot(A, 'uyku-online-end');
  for (const [n, p] of [['A', A], ['B', B], ['C', C]]) check(!p.errs.length, `çevrim içi ${n}: sayfa hatası yok`, p.errs.slice(0, 3).join(' | '));
  for (const p of [A, B, C]) await p.close();
}

const T0 = Date.now();
try {
  if (PARTS.includes('off')) await offline();
  if (PARTS.includes('swap')) await swap();
  if (PARTS.includes('bots')) await bots();
  if (PARTS.includes('menu')) await menu();
  if (PARTS.includes('on')) await online();
} catch (e) { console.log('HATA  ', e.stack); fail++; }
await browser.close();
console.log('ekran görüntüleri:\n  ' + shots.join('\n  '));
console.log(`süre ${((Date.now() - T0) / 1000).toFixed(0)} sn · ` + (fail ? `sonuç: HATA (${fail})` : 'sonuç: OK'));
process.exit(fail ? 1 : 0);
