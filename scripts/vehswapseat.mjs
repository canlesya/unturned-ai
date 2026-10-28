// 12.218 araçta botla koltuk takası (1–4 / telefon koltuk düğmesi / panelde koltuğa dokunma) + dolu araca E ile binince botun yer açması.
//   1) başsız (sunucunun yolu: insan girdisi kuyruğu 'vs' / 've'): jipte sürücü ↔ 3. koltuktaki bot (araç hareketliyken: bot sürer, araç durmaz) ·
//      helikopter havada pilot ↔ kapı nişancısı (bot pilot olur, irtifa korunur) · tank sürücü ↔ makineli (+ geri takas) · insanla takas yok ·
//      dolu jip E (bot iner, ipucu verisi) · boş koltuklu jip E (bot makineliye) · sabit yuva E (bot iner, geri gelmez) · nişan / yakınlaştırma sıfır.
//   2) tarayıcı (gerçek GPU, pencereli, --use-angle=metal, gerçek klavye): aynı senaryolar + HUD koltuk listesi / ipucu görüntüleri; telefon (Pixel 7
//      öykünmesi): koltuk düğmesi + panelde koltuğa dokunma.
//   3) çevrim içi (iki istemci, BF_DEBUG sunucu): A bot sürücülü jipi alır (E), B arka koltuğa biner; A 3'e basar → B insan: takas yok ("koltuk
//      dolu (oyuncu)"); A 2'ye basar → botla takas (bot sürücü), B'de de aynı; A 1'e basar → geri sürücü, tahmin düzeltmesi küçük.
//   URL=http://127.0.0.1:5206 WS=ws://127.0.0.1:9002 OUT=/tmp/wb-swapseat node scripts/vehswapseat.mjs   (ONLY=headless|gpu|mob|online)
import { Game } from '../src/game/game.js';
import { vnavFree } from '../src/game/vehicleBots.js';
import { settleVehicle } from '../src/sim/vehicle.js';
import fs from 'fs';

const URL0 = process.env.URL || 'http://127.0.0.1:5206', WS = process.env.WS || 'ws://127.0.0.1:9002', OUT = process.env.OUT || '/tmp/wb-swapseat', ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f1 = (v) => (+v).toFixed(1);
// açık arazi: aracın önünde 110 m boyunca araç ızgarası serbest, eğim az (düz giden jip bir şeye çarpmasın) → aracı oraya koy
function openSpot(g, free, x0, z0) {
  for (let r = 0; r < 400; r += 20) for (let a = 0; a < 16; a++) {
    const x = x0 + Math.cos(a * 0.39) * r, z = z0 + Math.sin(a * 0.39) * r;
    for (let k = 0; k < 8; k++) {
      const yaw = k * Math.PI / 4, fx = -Math.sin(yaw), fz = -Math.cos(yaw), h0 = g.world.heightAt(x, z);
      let good = true;
      for (let d = -6; d <= 110 && good; d += 3) { const px = x + fx * d, pz = z + fz * d; if (!free(g, px, pz) || Math.abs(g.world.heightAt(px, pz) - h0) > d * 0.12 + 1.5) good = false; for (const o of [-3, 3]) if (good && !free(g, px - fz * o, pz + fx * o)) good = false; }
      if (good) return { x, z, yaw };
    }
  }
  return null;
}
function moveTo(g, v, p, settle) { const st = v.st; st.x = p.x; st.z = p.z; st.yaw = p.yaw; st.y = g.world.heightAt(p.x, p.z) + 0.5; st.vx = st.vy = st.vz = 0; settle(st, g.world); v.sleep = false; }
const kind = (v) => (v.def.heli ? 'heli' : v.def.cannon ? 'tank' : v.def.moto ? 'moto' : 'jip');

function headless() {
  console.log('── başsız ──');
  const mk = () => {
    const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 8, type: 'conquest' } });
    const H = g.claimSlot('blue', 'Oyuncu', 'assault', {}), h = g.humans.get(H.id), V = g.vehicles;
    let q = 0;
    const inp = (o = {}) => ({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: H.yaw, pt: H.pitch, w: H.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...o });
    const step = (n, o = {}, each) => { for (let i = 0; i < n; i++) { if (H.alive) h.queue.push(inp(typeof o === 'function' ? o(i) : o)); g.step(1 / 60); if (each && each(i) === true) return true; } return false; };
    for (const v of V.list) v.spawnT = -1e9;
    const blues = g.soldiers.filter((s) => s.team === 'blue' && s !== H && s.brain);
    const byId = (id) => V.list.find((v) => v.id === id);
    const put = (b, v, seat) => { b.alive = true; b.vacant = false; b.pos.set(v.st.x + 3, v.st.y, v.st.z); V.enter(b, v, seat); if (seat === 0 && b.brain) b.brain.vd = { state: 'wait', t: 0, kind: kind(v), stuck: 0, prog: 1e9, progT: 0 }; };
    const door = (v, side = -1) => { const st = v.st, r = side * (v.def.hw + 0.7), f = v.def.seat[0][0]; return { x: st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z: st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r }; };
    const stand = (v, side) => { const p = door(v, side); H.pos.set(p.x, g.world.heightAt(p.x, p.z), p.z); H.vel.set(0, 0, 0); g.world.settle(H); };
    const only = (...bs) => { g.brains = g.brains.filter((x) => bs.includes(x.s)); };
    return { g, H, h, V, step, blues, byId, put, stand, only };
  };
  // 1) jip: insan sürücü, 3. koltukta (indeks 2) bot; araç ~12 m/sn giderken 3 → yer değiştir, bot sürmeye devam eder
  {
    const { g, H, V, step, blues, byId, put, only } = mk(), v = byId('B-J1'), b = blues[0];
    only(b); b.brain.seatT = 1e9;                                     // 12.214 boş makineliye kendiliğinden geçmesin (senaryo: bot 3. koltukta)
    const P = openSpot(g, vnavFree, v.st.x, v.st.z); if (P) moveTo(g, v, P, settleVehicle);
    put(H, v, 0); put(b, v, 2); step(5);
    step(60 * 3, { f: 1 });
    const sp0 = V.speed(v);
    H.ads = true; H.adsT = 1;
    step(1, { vs: 3 }); step(2);
    ok(H.seat === 2 && v.seats[0] === b && b.seat === 0 && b.brain.vd?.swap, 'jip 3: insan 3. koltukta, bot sürücü (sürücü durumu kuruldu)', `insan ${H.seat + 1} · bot ${b.seat + 1} · durum ${b.brain.vd?.state}`);
    ok(H.adsT === 0 && !H.ads, 'takasta nişan / yakınlaştırma sıfırlandı');
    let minSp = 99; step(60 * 5, {}, () => { minSp = Math.min(minSp, V.speed(v)); });
    ok(v.seats[0] === b && H.veh === v && minSp > 2.5, 'araç takastan sonra durmadı: bot sürüyor (BF: nişancıya geçen oyuncunun aracı yoluna devam eder)', `takasta ${f1(sp0)} m/sn · sonraki 5 sn en düşük ${f1(minSp)} m/sn · şimdi ${f1(V.speed(v))} · durum ${b.brain.vd?.state}`);
    step(1, { vs: 1 }); step(2);
    ok(H.seat === 0 && b.seat === 2 && !b.brain.vd, '1 → geri sürücü: bot 3. koltuğa döner (sürücü durumu temiz)', `bot ${b.seat + 1}`);
    step(60 * 2, { f: 1 });
    ok(b.veh === v && V.speed(v) > 3, 'insan yine sürer, bot yolcu kalır', `${f1(V.speed(v))} m/sn`);
  }
  // 2) helikopter havada: insan pilot, sol kapıda bot → 2: bot pilot olur, helikopter düşmez
  {
    const { g, H, V, step, blues, byId, put, only } = mk(), hl = byId('B-H1'), b = blues[1];
    only(b);
    put(H, hl, 0); put(b, hl, 1); step(2);
    const gnd = () => g.world.heightAt(hl.st.x, hl.st.z);
    hl.st.y = gnd() + 45; hl.st.air = true; hl.st.rpm = 1; hl.st.vy = 0; hl.sleep = false;
    step(30);
    step(1, { vs: 2 }); step(2);
    ok(H.seat === 1 && b.seat === 0 && b.brain.vd?.state === 'cruise', 'helikopter (havada) 2: insan sol kapı nişancısı, bot pilot (seyir)', `insan ${H.seat + 1} · bot ${b.seat + 1} · ${b.brain.vd?.state}`);
    let minA = 1e9; step(60 * 8, {}, () => { minA = Math.min(minA, hl.st.y - gnd()); });
    ok(hl.alive && hl.st.air && minA > 15 && hl.seats[0] === b, 'bot pilot uçmaya devam eder (8 sn, irtifa korunur)', `en düşük irtifa ${f1(minA)} m · durum ${b.brain.vd?.state} · hız ${f1(V.speed(hl))} m/sn`);
  }
  // 3) tank: sürücü ↔ makineli, geri
  {
    const { g, H, V, step, blues, byId, put, only } = mk(), t = byId('B-T1'), b = blues[2];
    only(b);
    put(H, t, 0); put(b, t, 1); step(5);
    step(1, { vs: 2 }); step(2);
    ok(H.seat === 1 && b.seat === 0 && b.brain.vd?.kind === 'tank', 'tank 2: insan makinelide, bot sürücü (tank)', `insan ${H.seat + 1} · bot ${b.seat + 1}`);
    step(60 * 4);
    ok(t.seats[0] === b && H.veh === t, 'bot tankı kullanır (4 sn sonra hâlâ sürücü)', `hız ${f1(V.speed(t))} m/sn · durum ${b.brain.vd?.state}`);
    step(1, { vs: 1 }); step(2);
    ok(H.seat === 0 && b.seat === 1 && !b.brain.vd, '1 → insan yine tank sürücüsü, bot makineliye');
  }
  // 4) insanla takas yok
  {
    const { g, H, V, step, byId, put } = mk(), v = byId('B-J2'), H2 = g.claimSlot('blue', 'Arkadas', 'assault', {});
    put(H, v, 0); put(H2, v, 2); step(2);
    step(1, { vs: 3 }); step(2);
    ok(H.seat === 0 && H2.seat === 2, 'insanın koltuğu (3): takas yok', `insan ${H.seat + 1} · arkadaş ${H2.seat + 1}`);
    ok(!V.swapOk(H, H2), 'swapOk(insan, insan) = false');
    step(1, { vs: 2 }); step(2);
    ok(H.seat === 1 && !v.seats[0], 'boş koltuk (2): eskisi gibi geçer');
  }
  // 5) dolu jip (4 bot) E: sürücü bot iner · bot sürücü + boş koltuk: bot makineliye
  {
    const { g, H, V, step, blues, byId, put, stand, only } = mk(), v = byId('B-J3');
    only(...blues.slice(0, 4));
    for (let i = 0; i < 4; i++) put(blues[i], v, i);
    step(5); stand(v, 1); step(2);
    const n = V.near(H);
    ok(n && n.seat === 0 && n.evict === blues[0] && n.to === -1, 'dolu jip: ipucu verisi = sürücü koltuğu, bot iner (to −1)', n ? `koltuk ${n.seat + 1} · to ${n.to}` : 'yok');
    step(1, { ve: 1 }); step(10);
    ok(H.veh === v && H.seat === 0 && !blues[0].veh && v.seats.slice(1).every(Boolean), 'E: insan sürücü, eski sürücü bot indi, yolcular kalır');
    const v2 = byId('B-J4'), b = blues[4];
    only(b); put(b, v2, 0); step(5); V.exit(H); stand(v2); step(2);
    const n2 = V.near(H);
    ok(n2 && n2.seat === 0 && n2.to === 1, 'boş koltuklu jip: bot makineliye geçer (to 1)', n2 ? `to ${n2.to}` : 'yok');
  }
  // 6) sabit yuva (tek koltuk): bot yuvada → E: insan yuvayı alır, bot iner, geri dönmez
  {
    const { g, H, V, step, blues, put, only } = mk(), e = V.list.find((v) => v.def.fixed && v.def.emp === 'hmg' && v.alive && v.st && v.st.y - g.world.heightAt(v.st.x, v.st.z) < 1), b = blues[3];
    only(b);
    put(b, e, 0); step(5);
    const st = e.st, x = st.x + Math.cos(st.yaw) * 1.4, z = st.z - Math.sin(st.yaw) * 1.4;
    H.pos.set(x, st.y, z); H.vel.set(0, 0, 0); g.world.settle(H); step(2);
    const n = V.near(H);
    ok(n && n.v === e && n.evict === b && n.to === -1, 'yuva: ipucu verisi = kullan · bot iner', n ? `${n.v.id} to ${n.to}` : `yok (insan–yuva ${f1(Math.hypot(H.pos.x - st.x, H.pos.z - st.z))} m)`);
    step(1, { ve: 1 }); step(5);
    ok(H.veh === e && H.seat === 0 && b.veh !== e, 'E: insan yuvada, bot indi');
    step(60 * 6);
    ok(e.seats[0] === H && b.veh !== e, 'bot 6 sn içinde yuvaya geri binmez');
  }
}

async function browserPart() {
  const { chromium, devices } = await import('playwright');
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const errs = [];
  const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
  const boot = async (ctxOpt) => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR', ...ctxOpt })).newPage();
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${URL0}/?autostart=8v8&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1`);
    await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
    await page.waitForTimeout(1500);
    // yardımcılar sayfada: araçtan in, yalnız seçilen botlar düşünsün, botu koltuğa koy
    await page.evaluate(() => {
      const g = window.__game, V = g.vehicles;
      for (const v of V.list) v.spawnT = -1e9;
      g.brainsOff = g.brains.splice(0);
      window.__T = {
        bots: () => g.soldiers.filter((s) => s.team === g.playerSoldier.team && s.brain && s !== g.playerSoldier),
        put(b, v, seat) { if (b.veh) V.exit(b); b.alive = true; b.vacant = false; b.hp = b.maxHp; b.pos.set(v.st.x + 3, v.st.y, v.st.z); V.enter(b, v, seat); if (!g.brains.includes(b.brain)) g.brains.push(b.brain); if (seat === 0) b.brain.vd = { state: 'wait', t: 0, kind: v.def.heli ? 'heli' : v.def.cannon ? 'tank' : 'jip', stuck: 0, prog: 1e9, progT: 0 }; },
        reset() { const me = g.playerSoldier; for (const v of V.list) if (v.def.heli && v.st?.air) { v.st.y = g.world.heightAt(v.st.x, v.st.z) + 1; v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = false; } if (me.veh) V.exit(me); for (const b of this.bots()) { if (b.veh) V.exit(b); } g.brains.length = 0; me.hp = me.maxHp; },
        seats(v) { return v.seats.map((o) => (o ? (o === g.playerSoldier ? 'SEN' : o.name) : '-')); },
        panel: () => [...document.querySelectorAll('#vhPanel .seats div')].filter((e) => e.style.display !== 'none').map((e) => e.textContent),
        third() { g.player.vehCam = 'third'; },
      };
    });
    await page.evaluate(`window.__openSpot = ${openSpot}; window.__moveTo = ${moveTo};`);
    await page.evaluate(async () => { window.__vb = await import('/src/game/vehicleBots.js'); window.__sv = await import('/src/sim/vehicle.js'); });
    return page;
  };
  const ev = (p, f, a) => p.evaluate(f, a);
  if (!ONLY || ONLY === 'gpu') {
    console.log('── tarayıcı (çevrimdışı, gerçek GPU, gerçek klavye) ──');
    const page = await boot();
    // A) jip: oyuncu sürücü, 3. koltukta bot; giderken 3
    const A0 = await ev(page, () => {
      const g = window.__game, T = window.__T, V = g.vehicles, me = g.playerSoldier, v = V.list.find((o) => o.id === 'B-J1'), b = T.bots()[0];
      T.reset();
      const P = window.__openSpot(g, window.__vb.vnavFree, v.st.x, v.st.z); if (P) window.__moveTo(g, v, P, window.__sv.settleVehicle);
      me.pos.set(v.st.x + 3, v.st.y, v.st.z); V.enter(me, v, 0); T.put(b, v, 2); b.brain.seatT = 1e9; T.third();
      window.__v = v; window.__b = b; return { bot: b.name, open: !!P };
    });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(3000);
    await shot(page, '01-jip-once-surucu-ben-3te-bot');
    const pA = await ev(page, () => window.__T.panel());
    ok(pA.length === 4 && /SEN/.test(pA[0]) && /takas/i.test(pA[2]), 'jip HUD: koltuk listesi (1 SEN · 3 bot "⇄ takas")', pA.join(' | '));
    await page.keyboard.up('KeyW');
    const sp0 = await ev(page, () => Math.hypot(window.__v.st.vx, window.__v.st.vz));
    await page.keyboard.press('Digit3');
    await page.waitForTimeout(400);
    const A1 = await ev(page, () => { const g = window.__game, me = g.playerSoldier, v = window.__v, b = window.__b; return { me: me.seat, b: b.seat, vd: b.brain.vd?.state, sp: Math.hypot(v.st.vx, v.st.vz), toast: document.body.innerText.includes('yer değiştirdin') }; });
    await shot(page, '02-jip-3e-basinca-takas');
    ok(A1.me === 2 && A1.b === 0, `jip (gerçek 3 tuşu, ${f1(sp0)} m/sn): oyuncu 3. koltukta, ${A0.bot} sürücü`, JSON.stringify(A1));
    await page.waitForTimeout(4000);
    const A2 = await ev(page, () => { const v = window.__v; return { sp: Math.hypot(v.st.vx, v.st.vz), drv: v.seats[0] === window.__b, vd: window.__b.brain.vd?.state, panel: window.__T.panel() }; });
    await shot(page, '03-jip-bot-suruyor-ben-arkada');
    ok(A2.drv && A2.sp > 2.5, 'bot jipi sürmeye devam ediyor (4 sn sonra)', `${f1(A2.sp)} m/sn · ${A2.vd} · ${A2.panel.join(' | ')}`);
    // B) helikopter havada: pilot ↔ sol kapı nişancısı (2)
    await ev(page, () => {
      const g = window.__game, T = window.__T, V = g.vehicles, me = g.playerSoldier, hl = V.list.find((o) => o.id === 'B-H1'), b = T.bots()[1];
      T.reset(); me.pos.set(hl.st.x + 3, hl.st.y, hl.st.z); V.enter(me, hl, 0); T.put(b, hl, 1); T.third();
      hl.st.y = g.world.heightAt(hl.st.x, hl.st.z) + 45; hl.st.air = true; hl.st.rpm = 1; hl.st.vy = 0; hl.sleep = false;
      window.__v = hl; window.__b = b;
    });
    await page.waitForTimeout(700);
    await shot(page, '04-heli-once-pilot-ben');
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(500);
    const B1 = await ev(page, () => { const g = window.__game, me = g.playerSoldier, b = window.__b; return { me: me.seat, b: b.seat, vd: b.brain.vd?.state, panel: window.__T.panel() }; });
    ok(B1.me === 1 && B1.b === 0 && B1.vd === 'cruise', 'helikopter (gerçek 2): oyuncu sol kapı makinelisinde, bot pilot (seyir)', JSON.stringify(B1));
    let minA = 1e9;
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(500); minA = Math.min(minA, await ev(page, () => { const v = window.__v; return v.st.y - window.__game.world.heightAt(v.st.x, v.st.z); })); }
    await shot(page, '05-heli-bot-pilot-ben-kapi-makinelisi');
    ok(minA > 15, 'bot pilot uçuruyor (6 sn, düşmedi)', `en düşük irtifa ${f1(minA)} m`);
    // C) tank: sürücü ↔ makineli (2)
    await ev(page, () => {
      const g = window.__game, T = window.__T, V = g.vehicles, me = g.playerSoldier, t = V.list.find((o) => o.id === 'B-T1'), b = T.bots()[2];
      T.reset(); me.pos.set(t.st.x + 3, t.st.y, t.st.z); V.enter(me, t, 0); T.put(b, t, 1); T.third(); window.__v = t; window.__b = b;
    });
    await page.waitForTimeout(700);
    await shot(page, '06-tank-once-surucu-ben');
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(1500);
    const C1 = await ev(page, () => { const g = window.__game, me = g.playerSoldier, b = window.__b; return { me: me.seat, b: b.seat, vd: b.brain.vd?.kind, panel: window.__T.panel() }; });
    await shot(page, '07-tank-2-ben-makineli-bot-surucu');
    ok(C1.me === 1 && C1.b === 0 && C1.vd === 'tank', 'tank (gerçek 2): oyuncu makinelide, bot tank sürücüsü', JSON.stringify(C1));
    await page.keyboard.press('Digit1'); await page.waitForTimeout(400);
    const C2 = await ev(page, () => ({ me: window.__game.playerSoldier.seat, b: window.__b.seat }));
    ok(C2.me === 0 && C2.b === 1, 'tank (gerçek 1): geri sürücü', JSON.stringify(C2));
    // D) dolu jip: E → sürücü bot iner (ipucu)
    await ev(page, () => {
      const g = window.__game, T = window.__T, V = g.vehicles, me = g.playerSoldier, v = V.list.find((o) => o.id === 'B-J2'), bs = T.bots().slice(0, 4);
      T.reset(); bs.forEach((b, i) => T.put(b, v, i));
      const st = v.st, r = (v.def.hw + 0.8), f = v.def.seat[0][0] - 1.2, x = st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z = st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r;
      me.pos.set(x, g.world.heightAt(x, z), z); g.world.settle(me); me.yaw = Math.atan2(-(st.x - x), -(st.z - z)); me.pitch = -0.3; g.player.vehCam = 'first';
      window.__v = v; window.__b = bs[0];
    });
    await page.waitForTimeout(1000);
    const prD = await ev(page, () => document.getElementById('vhPrompt').textContent);
    await shot(page, '08-dolu-jip-ipucu-bot-iner');
    ok(/iner/i.test(prD), 'dolu jip ipucu: "sür · <bot> iner"', prD);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
    const D1 = await ev(page, () => { const g = window.__game, me = g.playerSoldier, v = window.__v; return { me: me.veh === v ? me.seat : -1, out: window.__b.veh !== v, seats: window.__T.seats(v) }; });
    await shot(page, '09-dolu-jip-E-sonra');
    ok(D1.me === 0 && D1.out, 'dolu jip (gerçek E): oyuncu sürücü, bot indi', JSON.stringify(D1));
    // D2) boş koltuklu, bot sürücülü jip: ipucu "bot 2. koltuğa geçer (makineli)"
    await ev(page, () => {
      const g = window.__game, T = window.__T, V = g.vehicles, me = g.playerSoldier, v = V.list.find((o) => o.id === 'B-J3'), b = T.bots()[5];
      T.reset(); T.put(b, v, 0);
      const st = v.st, r = -(v.def.hw + 0.8), f = v.def.seat[0][0] - 1.2, x = st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z = st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r;
      me.pos.set(x, g.world.heightAt(x, z), z); g.world.settle(me); me.yaw = Math.atan2(-(st.x - x), -(st.z - z)); me.pitch = -0.3;
    });
    await page.waitForTimeout(1000);
    const prD2 = await ev(page, () => document.getElementById('vhPrompt').textContent);
    await shot(page, '10-jip-ipucu-bot-makineliye-gecer');
    ok(/2\. koltu/i.test(prD2), 'bot sürücülü jip ipucu: "sür · <bot> 2. koltuğa geçer (makineli)"', prD2);
    // E) sabit yuva: bot yuvada → E
    await ev(page, () => {
      const g = window.__game, T = window.__T, V = g.vehicles, me = g.playerSoldier, e = V.list.find((v) => v.def.fixed && v.def.emp === 'hmg' && v.alive && v.st && v.st.y - g.world.heightAt(v.st.x, v.st.z) < 1), b = T.bots()[4];
      T.reset(); T.put(b, e, 0);
      const st = e.st, x = st.x + Math.cos(st.yaw) * 1.4, z = st.z - Math.sin(st.yaw) * 1.4;
      me.pos.set(x, st.y, z); g.world.settle(me); me.yaw = Math.atan2(-(st.x - x), -(st.z - z)); me.pitch = -0.2;
      window.__v = e; window.__b = b;
    });
    await page.waitForTimeout(1000);
    const prE = await ev(page, () => document.getElementById('vhPrompt').textContent);
    await shot(page, '11-yuva-ipucu-bot-iner');
    ok(/iner/i.test(prE), 'sabit yuva ipucu: "kullan · <bot> iner"', prE);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
    const E1 = await ev(page, () => { const g = window.__game, me = g.playerSoldier, v = window.__v; return { me: me.veh === v, out: window.__b.veh !== v }; });
    await shot(page, '12-yuva-E-sonra');
    ok(E1.me && E1.out, 'sabit yuva (gerçek E): oyuncu yuvada, bot indi', JSON.stringify(E1));
    await page.close();
  }
  if (!ONLY || ONLY === 'mob' || ONLY === 'gpu') {
    console.log('── telefon (Pixel 7 öykünmesi, dokunma) ──');
    const P7 = devices['Pixel 7'];
    const page = await boot({ ...P7, viewport: { width: 915, height: 412 }, screen: { width: 915, height: 412 } });
    const touch = await ev(page, () => !!window.__game.player.touch);
    ok(touch, 'telefon: dokunmatik denetimler açık');
    await ev(page, () => {
      const g = window.__game, T = window.__T, V = g.vehicles, me = g.playerSoldier, v = V.list.find((o) => o.id === 'B-J1'), b = T.bots()[0];
      T.reset(); me.pos.set(v.st.x + 3, v.st.y, v.st.z); V.enter(me, v, 0); T.put(b, v, 2); b.brain.seatT = 1e9; T.third(); window.__v = v; window.__b = b;
    });
    await page.waitForTimeout(800);
    const tapSel = async (sel) => { const r = await ev(page, (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel); if (r) await page.touchscreen.tap(r.x, r.y); return r; };
    await shot(page, '13-telefon-once');
    const r1 = await tapSel('[data-b="seat"]'); await page.waitForTimeout(400);
    const M1 = await ev(page, () => ({ me: window.__game.playerSoldier.seat, b: window.__b.seat }));
    ok(r1 && M1.me === 1 && M1.b === 2, 'telefon koltuk düğmesi: sıradaki boş koltuk (2)', JSON.stringify(M1));
    await tapSel('[data-b="seat"]'); await page.waitForTimeout(400);
    const M2 = await ev(page, () => ({ me: window.__game.playerSoldier.seat, b: window.__b.seat }));
    await shot(page, '14-telefon-dugme-botla-takas');
    ok(M2.me === 2 && M2.b === 1, 'telefon koltuk düğmesi: sıradaki botlu koltuk (3) → yer değiştir', JSON.stringify(M2));
    const r3 = await tapSel('#vhPanel .seats div:nth-child(2)'); await page.waitForTimeout(400);
    const M3 = await ev(page, () => ({ me: window.__game.playerSoldier.seat, b: window.__b.seat, panel: window.__T.panel() }));
    await shot(page, '15-telefon-panelde-koltuga-dokun');
    ok(r3 && M3.me === 1 && M3.b === 2, 'telefon: paneldeki 2. koltuğa (bot) dokun → yer değiştir', JSON.stringify(M3));
    await page.close();
  }
  if (!ONLY || ONLY === 'online') {
    console.log('── çevrim içi (iki istemci) ──');
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
    for (const P of [A, B]) await P.evaluate(() => window.__game.online.send({ t: 'dbg', tp: [-650, 650] }));
    let J = null;
    for (let i = 0; i < 120 && !J; i++) {
      await A.waitForTimeout(1000);
      J = await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; for (const v of g.vehicles.list) { const d = v.seats[0]; if (v.alive && v.st && !v.def.heli && !v.def.moto && !v.def.cannon && !v.def.fixed && d && d.team === me.team && !d.netHuman && d !== me && v.seats.filter(Boolean).length <= 2) return { i: v.idx, id: v.id, bot: d.id, name: d.name }; } return null; });
    }
    ok(!!J, 'çevrim içi: sunucuda bot sürücülü takım jipi (en çok 2 kişi)', JSON.stringify(J));
    if (J) {
      const tp = (P, side) => P.evaluate(([i, side]) => { const g = window.__game, v = g.vehicles.list[i], st = v.st, r = side * (v.def.hw + 0.8), f = v.def.seat[0][0], x = st.x - Math.sin(st.yaw) * f + Math.cos(st.yaw) * r, z = st.z - Math.cos(st.yaw) * f - Math.sin(st.yaw) * r; g.online.send({ t: 'dbg', tp: [x, z] }); return Math.hypot(st.vx, st.vz); }, [J.i, side]);
      const meSeat = (P) => P.evaluate((i) => { const me = window.__game.playerSoldier; return me.veh?.idx === i ? me.seat : -1; }, J.i);
      for (let k = 0; k < 6; k++) { await tp(A, -1); await A.waitForTimeout(150); }
      await A.bringToFront(); await A.keyboard.press('KeyE');
      let sa = -1; for (let k = 0; k < 40 && sa < 0; k++) { await tp(A, -1); await A.waitForTimeout(150); sa = await meSeat(A); }
      ok(sa === 0, 'A (gerçek E): bot sürücülü jipin sürücüsü oldu', `koltuk ${sa + 1}`);
      // B arka koltuğa (E)
      for (let k = 0; k < 6; k++) { await tp(B, 1); await B.waitForTimeout(150); }
      await B.bringToFront(); await B.keyboard.press('KeyE');
      let sb = -1; for (let k = 0; k < 30 && sb < 0; k++) { await tp(B, 1); await B.waitForTimeout(150); sb = await meSeat(B); }
      const st0 = await A.evaluate(([i]) => { const g = window.__game, v = g.vehicles.list[i]; return v.seats.map((o) => (o ? (o === g.playerSoldier ? 'A' : o.netHuman ? 'İ:' + o.name : 'B:' + o.name) : '-')); }, [J.i]);
      ok(sb > 0, `B (gerçek E): yolcu koltuğuna bindi (${sb + 1})`, st0.join(' | '));
      const botSeat = await A.evaluate(([i, bid]) => { const g = window.__game; return g.soldiers[bid].veh?.idx === i ? g.soldiers[bid].seat : -1; }, [J.i, J.bot]);
      ok(botSeat > 0 && botSeat !== sb, `bot yolcu koltuğunda (${botSeat + 1})`);
      if (sb > 0 && botSeat > 0) {
        // A, B'nin koltuğuna basar → takas yok
        await A.bringToFront(); await A.keyboard.press('Digit' + (sb + 1)); await A.waitForTimeout(900);
        const r1 = await A.evaluate(() => ({ seat: window.__game.playerSoldier.seat, toast: document.body.innerText.match(/Koltuk dolu[^\n]*/)?.[0] || '' }));
        await A.screenshot({ path: `${OUT}/net-01-A-insan-koltugu-dolu.png` });
        ok(r1.seat === 0 && /oyuncu/i.test(r1.toast), `A ${sb + 1}'e bastı (B'nin koltuğu): takas yok, ipucu "${r1.toast}"`);
        const sb2 = await meSeat(B);
        ok(sb2 === sb, 'B koltuğunda kaldı');
        // A botun koltuğuna basar → takas
        await A.keyboard.press('Digit' + (botSeat + 1));
        let ra = -1; for (let k = 0; k < 20 && ra !== botSeat; k++) { await A.waitForTimeout(150); ra = await meSeat(A); }
        await A.waitForTimeout(600);
        const seenA = await A.evaluate(([i, bid]) => { const g = window.__game, v = g.vehicles.list[i], me = g.playerSoldier; return { me: me.seat, bot: g.soldiers[bid].seat, pred: !!v.pred, ads: me.adsT, panel: [...document.querySelectorAll('#vhPanel .seats div')].filter((e) => e.style.display !== 'none').map((e) => e.textContent) }; }, [J.i, J.bot]);
        const aid = await A.evaluate(() => window.__game.playerSoldier.id);
        const seenB = await B.evaluate(([i, bid, aid]) => { const g = window.__game, v = g.vehicles.list[i]; return { a: g.soldiers[aid].veh === v ? g.soldiers[aid].seat : -1, bot: g.soldiers[bid].veh === v ? g.soldiers[bid].seat : -1 }; }, [J.i, J.bot, aid]);
        await A.screenshot({ path: `${OUT}/net-02-A-botla-takas.png` });
        await B.screenshot({ path: `${OUT}/net-03-B-goruyor.png` });
        ok(seenA.me === botSeat && seenA.bot === 0 && !seenA.pred, `A ${botSeat + 1}'e bastı: botla takas, bot sürücü, A'da araç tahmini kapandı`, JSON.stringify(seenA));
        ok(seenB.a === botSeat && seenB.bot === 0, "B'de de A makinelide / bot sürücü", JSON.stringify(seenB));
        // A 1 → geri sürücü, sürer, tahmin düzeltmesi
        await A.keyboard.press('Digit1');
        let r0 = -1; for (let k = 0; k < 20 && r0 !== 0; k++) { await A.waitForTimeout(150); r0 = await meSeat(A); }
        const c0 = await A.evaluate(() => window.__game.online.stats?.corr ?? 0);
        await A.keyboard.down('KeyW'); await A.waitForTimeout(3000); await A.keyboard.up('KeyW');
        const r2 = await A.evaluate(([i, c0]) => { const g = window.__game, v = g.vehicles.list[i]; return { sp: Math.hypot(v.st.vx, v.st.vz), pred: !!v.pred, corr: (g.online.stats?.corr ?? 0) - c0 }; }, [J.i, c0]);
        await A.screenshot({ path: `${OUT}/net-04-A-yine-surucu.png` });
        ok(r0 === 0 && r2.pred && r2.sp > 3 && r2.corr <= 3, `A 1: yine sürücü (tahmin açık), sürüyor ${f1(r2.sp)} m/sn, düzeltme ${r2.corr}`);
      }
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
