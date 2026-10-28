// 12.206 botu araçtan indirme (Battlefield: insan bottan öncelikli) + bot araç kapma kuralı. Tek betik:
//   1) başsız (sunucunun yolu: insan girdisi kuyruğu, Game.vehTick / humanTick): bot sürücülü duran jip → E: insan sürücü, bot makineliye geçer
//      (sürücü durumu temiz, yolcu olarak kalır) · hareketli jip → E: bot fren yapar, durunca takas · dolu jip (4 bot) → sürücü bot iner · tank /
//      yerdeki helikopter → bot nişancı / kapı koltuğuna · düşman botu indirilemez · ayrılan araç maçın 5. dakikasında da üste doğan insana kalır ·
//      araca yürüyen bot, insan yaklaşınca ayırmayı bırakır.
//   2) tarayıcı (gerçek GPU, pencereli, --use-angle=metal): çevrimdışı, gerçek E tuşu: ipucu "botu indir · sür", takas sonrası HUD (koltuklar) — görüntüler.
//   3) çevrim içi (WS erişilebilirse; BF_DEBUG sunucu): A + B istemcisi, sunucudaki bot sürücülü jip → A E'ye basar → sunucu takası, A sürücü (tahmin
//      düzeltmesi küçük), B'de de A sürücü + bot makinelide.
//   URL=http://127.0.0.1:5189 WS=ws://127.0.0.1:8978 OUT=/tmp/wb-heli2/takeover node scripts/vehtakeover.mjs   (ONLY=headless|gpu|online)
import { Game } from '../src/game/game.js';
import { VBOT, botMayTake } from '../src/game/vehicleBots.js';
import fs from 'fs';

const URL0 = process.env.URL || 'http://127.0.0.1:5189', WS = process.env.WS || 'ws://127.0.0.1:8978', OUT = process.env.OUT || '/tmp/wb-heli2/takeover', ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f1 = (v) => (+v).toFixed(1);

function headless() {
  console.log('── başsız ──');
  const mk = () => {
    const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 8, type: 'conquest' } });
    const H = g.claimSlot('blue', 'Oyuncu', 'assault', {}), h = g.humans.get(H.id), V = g.vehicles;
    let q = 0;
    const inp = (o = {}) => ({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: H.yaw, pt: H.pitch, w: H.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...o });
    const step = (n, o = {}, each) => { for (let i = 0; i < n; i++) { if (H.alive) h.queue.push(inp(typeof o === 'function' ? o(i) : o)); g.step(1 / 60); if (each && each(i) === true) return true; } return false; };
    for (const v of V.list) v.spawnT = -1e9;
    const blues = g.soldiers.filter((s) => s.team === 'blue' && s !== H && s.brain), reds = g.soldiers.filter((s) => s.team === 'red' && s.brain);
    const byId = (id) => V.list.find((v) => v.id === id);
    // bot sürücü: vbBoard'un yaptığı gibi koltuğa + sürücü durumu (bekle → rota → sür)
    const drive = (b, v, seat = 0) => { b.alive = true; b.vacant = false; b.pos.set(v.st.x + 3, v.st.y, v.st.z); V.enter(b, v, seat); if (seat === 0) b.brain.vd = { state: 'wait', t: 0, kind: v.def.heli ? 'heli' : v.def.cannon ? 'tank' : v.def.moto ? 'moto' : 'jip', stuck: 0, prog: 1e9, progT: 0 }; };
    const door = (v, side = -1) => { const st = v.st, r = side * (v.def.hw + 0.7), f = v.def.seat[0][0]; return { x: st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z: st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r }; };
    const stand = (v, side) => { const p = door(v, side); H.pos.set(p.x, g.world.heightAt(p.x, p.z), p.z); H.vel.set(0, 0, 0); g.world.settle(H); };
    return { g, H, h, V, step, blues, reds, byId, drive, stand };
  };
  // 1) duran jip, bot sürücü (beklemede) → E
  {
    const T = mk(), { g, H, V, step, blues, byId, drive, stand } = T, v = byId('B-J1'), b = blues[0];
    g.brains = g.brains.filter((x) => x.s === b);                       // yalnız bu bot düşünür
    drive(b, v); step(10);
    ok(v.seats[0] === b && b.brain.vd, 'kurulum: bot jip sürücüsü (beklemede)');
    stand(v); step(2);
    const n = V.near(H);
    ok(n && n.v === v && n.seat === 0 && n.evict === b, 'insan kapıda: yakın araç = sürücü koltuğu + "botu indir"', n ? `koltuk ${n.seat}` : 'yok');
    step(1, { ve: 1 }); step(20);
    ok(H.veh === v && H.seat === 0, 'E: insan sürücü oldu', `koltuk ${H.seat}`);
    ok(b.veh === v && b.seat === 1 && !b.brain.vd, 'bot sürücü koltuğunu boşalttı, makineliye geçti (sürücü durumu temiz)', `bot koltuk ${b.seat}`);
    step(60 * 3, { f: 1 });
    ok(V.speed(v) > 4 && b.veh === v, 'insan sürer, bot makinelide yolcu kalır', `hız ${f1(V.speed(v))} m/sn`);
  }
  // 2) hareketli jip: E → bot fren yapar, durunca takas
  {
    const T = mk(), { g, H, V, step, blues, byId, drive, stand } = T, v = byId('B-J2'), b = blues[0];
    g.brains = g.brains.filter((x) => x.s === b);
    drive(b, v); v.st.vx = 0;
    let moving = false; step(60 * 40, {}, () => { if (V.speed(v) > 7) { moving = true; return true; } });
    const sp0 = V.speed(v);
    ok(moving, 'kurulum: bot jipi sürüyor', `hız ${f1(sp0)} m/sn`);
    stand(v); step(1, { ve: 1 });
    ok(!!v.yieldReq && v.seats[0] === b, 'hareketli araç: istek (bot hemen indirilmez)', `hız ${f1(V.speed(v))} m/sn`);
    let tSwap = -1;
    step(60 * 6, {}, (i) => { stand(v); if (H.veh === v) { tSwap = i / 60; return true; } });
    ok(tSwap > 0 && H.seat === 0 && b.seat > 0, 'bot fren yaptı, durunca takas: insan sürücü', `${f1(tSwap)} sn · hız ${f1(V.speed(v))} m/sn · bot koltuk ${b.seat}`);
  }
  // 3) dolu jip (4 bot): sürücü bot iner (yer yok)
  {
    const T = mk(), { g, H, V, step, blues, byId, drive, stand } = T, v = byId('B-J3');
    g.brains = g.brains.filter((x) => blues.slice(0, 4).includes(x.s));
    drive(blues[0], v); for (let i = 1; i < 4; i++) drive(blues[i], v, i);
    step(5); stand(v, 1); step(2); step(1, { ve: 1 }); step(10);
    ok(H.veh === v && H.seat === 0 && !blues[0].veh && v.seats.slice(1).every(Boolean), 'dolu jip: insan sürücü, sürücü bot iner, yolcular kalır', `eski sürücü araçta: ${!!blues[0].veh}`);
  }
  // 4) tank + yerdeki helikopter (bot pilot, rotor dönüyor) → bot nişancı / kapı koltuğuna
  {
    const T = mk(), { g, H, V, step, blues, byId, drive, stand } = T, t = byId('B-T1'), hl = byId('B-H1');
    g.brains = g.brains.filter((x) => x.s === blues[0] || x.s === blues[1]);
    drive(blues[0], t); step(5); stand(t); step(1, { ve: 1 }); step(10);
    ok(H.veh === t && H.seat === 0 && blues[0].seat === 1, 'tank: insan sürücü, bot kule makinelisine', `bot koltuk ${blues[0].seat}`);
    step(1, { ve: 1 }); step(30);
    drive(blues[1], hl); step(60);
    stand(hl); step(2); step(1, { ve: 1 }); step(10);
    ok(H.veh === hl && H.seat === 0 && (blues[1].seat === 1 || blues[1].seat === 2), 'yerdeki helikopter: insan pilot, bot kapı makinelisine', `bot koltuk ${blues[1].seat}`);
  }
  // 5) düşmanın / takım arkadaşı insanın koltuğu alınmaz
  {
    const T = mk(), { g, H, V, step, reds, blues, byId, drive, stand } = T, v = byId('R-J1');
    g.brains = g.brains.filter((x) => x.s === reds[0]);
    drive(reds[0], v); step(5); stand(v); step(2);
    ok(!V.near(H), 'düşman botun aracı: binilmez / indirilemez');
    const v2 = byId('B-J4'), H2 = g.claimSlot('blue', 'Arkadas', 'assault', {});
    H2.pos.set(v2.st.x + 3, v2.st.y, v2.st.z); V.enter(H2, v2, 0); stand(v2); step(2);
    const n = V.near(H);
    ok(n && n.v === v2 && n.seat !== 0 && !n.evict, 'insan sürücünün aracı: boş yolcu koltuğu (insan indirilmez)', n ? `koltuk ${n.seat}` : 'yok');
  }
  // 6) kapma kuralı: maçın 300. sn'sinde üste doğan insan — ayrılan araçlar hâlâ ayrılı (12.200'de 40 sn sonra botlara açılıyordu)
  {
    const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 10, type: 'conquest' } }), V = g.vehicles;
    const H = g.soldiers.find((s) => s.team === 'blue');
    g.brains = g.brains.filter((b) => b.s !== H); H.brain = null; H.human = true;
    const hq = g.map.vehicles.find((d) => d.id === 'B-J1');
    const park = (x, z) => { H.pos.set(x, g.world.heightAt(x, z) + 0.1, z); H.vel.set(0, 0, 0); H.alive = true; H.hp = H.maxHp; };
    for (let i = 0; i < 30 * 300; i++) { g.step(1 / 30); park(hq.x + 60, hq.z - 70); }      // üsün 90 m ötesinde (keepR içinde) bekleyen / doğan insan
    const bj = V.list.filter((v) => v.spawn.team === 'blue' && v.type === 'jip'), free = bj.filter((v) => v.alive && !v.lastDriver && !v.seats.some(Boolean));
    ok(free.length >= Math.ceil(bj.length * VBOT.grab.share) - 0 && free.length >= 1, '300. sn: üsteki jiplerin ayrılan yarısı hâlâ insana duruyor', `${free.length} / ${bj.length} boş jip (${free.map((v) => v.id).join(', ')})`);
    // insan üssün çok uzağındayken (> keepR, canlı) ayrılan araç botlara açılır (araç boşa yatmaz)
    park(-700, 700);
    ok(free.every((v) => botMayTake(g, v, 'blue')), 'insan uzaktayken (> 150 m, canlı) ayrılan araçlar botlara açık');
    // ölü insan (doğmayı bekliyor): ayrı kalır
    H.alive = false;
    ok(free.length && !botMayTake(g, free[0], 'blue'), 'insan ölü (doğuş bekliyor): ayrılan araç ayrılı kalır');
    H.alive = true;
  }
  // 7) araca yürüyen bot: insan araca bottan önce yaklaşınca ayırmayı bırakır
  {
    const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 10, type: 'conquest' } }), V = g.vehicles;
    for (const v of V.list) v.spawnT = -1e9;
    const H = g.soldiers.find((s) => s.team === 'blue');
    g.brains = g.brains.filter((b) => b.s !== H); H.brain = null; H.human = true;
    let res = null, t0 = 0;
    for (let i = 0; i < 30 * 60 && !res; i++) { g.step(1 / 30); H.pos.set(-700, g.world.heightAt(-700, 700), 700); res = V.list.find((v) => v.botRes && v.spawn.team === 'blue' && v.botRes.s.alive && Math.hypot(v.botRes.s.pos.x - v.st.x, v.botRes.s.pos.z - v.st.z) > 12); }
    if (res) {
      const b = res.botRes; H.pos.set(res.st.x + 5, g.world.heightAt(res.st.x + 5, res.st.z), res.st.z);
      for (let i = 0; i < 30 * 2; i++) { g.step(1 / 30); H.pos.set(res.st.x + 5, g.world.heightAt(res.st.x + 5, res.st.z), res.st.z); H.vel.set(0, 0, 0); }
      ok(res.botRes !== b && !res.seats[0], 'araca yürüyen bot, insan yaklaşınca ayırmayı bırakır', `${res.id}`);
    } else ok(false, 'araca yürüyen bot bulunamadı');
  }
}

async function browserPart() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const errs = [];
  if (ONLY !== 'online') {
    console.log('── tarayıcı (çevrimdışı, gerçek GPU) ──');
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${URL0}/?autostart=8v8&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1`);
    await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
    await page.waitForTimeout(1500);
    const setup = await page.evaluate(() => {
      const g = window.__game, me = g.playerSoldier, V = g.vehicles, v = V.list.find((o) => o.id === 'B-J1');
      const b = g.soldiers.find((s) => s.team === me.team && s.brain && s !== me && s.alive);
      g.brainsOff = g.brains.filter((x) => x.s !== b); g.brains = g.brains.filter((x) => x.s === b);
      V.enter(b, v, 0); b.brain.vd = { state: 'wait', t: 0, kind: 'jip', stuck: 0, prog: 1e9, progT: 0 };
      const st = v.st, r = -(v.def.hw + 0.8), f = v.def.seat[0][0] - 1.2, x = st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z = st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r;
      me.pos.set(x, g.world.heightAt(x, z), z); g.world.settle(me); me.yaw = Math.atan2(-(st.x - x), -(st.z - z)); me.pitch = -0.3;
      window.__b = b; window.__v = v;
      return { bot: b.name };
    });
    await page.waitForTimeout(1200);
    const pr = await page.evaluate(() => { const e = document.getElementById('vhPrompt'); return { vis: getComputedStyle(e).display !== 'none', txt: e.textContent }; });
    await page.screenshot({ path: `${OUT}/01-ipucu-botu-indir.png` });
    ok(pr.vis && /sür · .+ (2\. koltuğa geçer|iner)/i.test(pr.txt), 'ipucu (12.218): "sür · <bot> 2. koltuğa geçer (makineli)"', pr.txt);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, b = window.__b; return { me: me.seat, inV: me.veh === window.__v, bot: b.seat, bInV: b.veh === window.__v, seats: [...document.querySelectorAll('#vhPanel .seats div')].map((e) => e.textContent) }; });
    await page.screenshot({ path: `${OUT}/02-sonra-surucu-oyuncu.png` });
    ok(r.inV && r.me === 0 && r.bInV && r.bot === 1, `E (gerçek tuş): oyuncu sürücü, ${setup.bot} makinelide`, r.seats.join(' | '));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(2500);
    await page.evaluate(() => { window.__game.player.vehCam = 'third'; });
    await page.screenshot({ path: `${OUT}/03-oyuncu-suruyor-bot-makinelide.png` });
    await page.keyboard.up('KeyW');
    await page.close();
  }
  if (ONLY !== 'gpu') {
    console.log('── çevrim içi ──');
    const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
    const q = `server=${encodeURIComponent(WS)}&debug=1&nolock=1&nologin=1`;
    const ready = (p) => p.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
    const A = await mk();
    await A.goto(`${URL0}/?online=new&type=conquest&per=8&map=kuzey&tod=day&time=3600&team=blue&name=Ali&${q}`);
    try { await ready(A); } catch { ok(false, 'çevrim içi oda açılamadı (sunucu?)'); await browser.close(); return; }
    const code = await A.evaluate(() => window.__game.opts.online.room);
    const B = await mk();
    await B.goto(`${URL0}/?online=${code}&team=blue&name=Veli&${q}`);
    await ready(B);
    const far = [-650, 650];
    for (const P of [A, B]) await P.evaluate((xz) => window.__game.online.send({ t: 'dbg', tp: xz }), far);      // insanlar uzakta: botlar üsteki jiplere binsin
    // sunucudaki bot sürücülü (mavi) jip
    let J = null;
    for (let i = 0; i < 90 && !J; i++) {
      await A.waitForTimeout(1000);
      J = await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; for (const v of g.vehicles.list) { const d = v.seats[0]; if (v.alive && v.st && !v.def.heli && !v.def.moto && d && d.team === me.team && !d.netHuman && d !== me) return { i: v.idx, id: v.id, bot: d.id, name: d.name }; } return null; });
    }
    ok(!!J, 'çevrim içi: sunucuda bot sürücülü takım jipi', JSON.stringify(J));
    if (J) {
      // A jipin yanına ışınlanır (her 150 ms; jip hareketliyse bot fren yapar), E
      const tpA = () => A.evaluate((i) => { const g = window.__game, v = g.vehicles.list[i], st = v.st, r = -(v.def.hw + 0.8), f = v.def.seat[0][0], x = st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z = st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r; g.online.send({ t: 'dbg', tp: [x, z] }); return Math.hypot(st.vx, st.vz); }, J.i);
      let sp = 0;
      for (let k = 0; k < 6; k++) { sp = await tpA(); await A.waitForTimeout(150); }
      const key = (p, type, code) => p.evaluate(([type, code]) => document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })), [type, code]);
      const prA = await A.evaluate(() => { const e = document.getElementById('vhPrompt'); return getComputedStyle(e).display !== 'none' ? e.textContent : ''; });
      await A.screenshot({ path: `${OUT}/net-01-A-ipucu.png` });
      await key(A, 'keydown', 'KeyE'); await A.waitForTimeout(80); await key(A, 'keyup', 'KeyE');
      let inA = null;
      for (let k = 0; k < 40 && !inA; k++) { await tpA(); await A.waitForTimeout(150); inA = await A.evaluate((i) => { const me = window.__game.playerSoldier; return me.veh?.idx === i ? { seat: me.seat } : null; }, J.i); }
      ok(!!inA && inA.seat === 0, `çevrim içi: A E'ye bastı (ipucu "${prA}", jip ${f1(sp)} m/sn) → sunucu takası, A sürücü`, JSON.stringify(inA));
      await A.waitForTimeout(800);
      const seen = await B.evaluate(([i, aid, bid]) => { const g = window.__game, v = g.vehicles.list[i]; return { drv: v.seats[0]?.id === aid, bot: g.soldiers[bid].veh === v ? g.soldiers[bid].seat : -1 }; }, [J.i, await A.evaluate(() => window.__game.playerSoldier.id), J.bot]);
      ok(seen.drv && seen.bot !== 0, `B'de de A sürücü, bot ${seen.bot > 0 ? 'koltuk ' + (seen.bot + 1) : 'indi'}`, JSON.stringify(seen));
      // A sürer: tahmin düzeltmesi
      const c0 = await A.evaluate(() => window.__game.online.stats?.corr ?? 0);
      await key(A, 'keydown', 'KeyW'); await A.waitForTimeout(3000); await key(A, 'keyup', 'KeyW');
      const r2 = await A.evaluate(([i, c0]) => { const g = window.__game, v = g.vehicles.list[i]; return { sp: Math.hypot(v.st.vx, v.st.vz), corr: (g.online.stats?.corr ?? 0) - c0 }; }, [J.i, c0]);
      await A.screenshot({ path: `${OUT}/net-02-A-suruyor.png` });
      await B.screenshot({ path: `${OUT}/net-03-B-goruyor.png` });
      ok(r2.sp > 3 && r2.corr <= 3, `A sürüyor (${f1(r2.sp)} m/sn), tahmin düzeltmesi ${r2.corr}`);
    }
  }
  await browser.close();
  console.log('sayfa hatası', errs.length, errs.slice(0, 3).join(' | '));
  if (errs.length) fails++;
}

if (!ONLY || ONLY === 'headless') headless();
if (ONLY !== 'headless') await browserPart();
console.log(fails ? `${fails} HATA` : 'hepsi OK');
process.exit(fails ? 1 : 0);
