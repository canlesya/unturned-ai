// 12.228 Manga arkadaşının aracındaki boş koltuğa doğuş = normal binişle AYNI kamera / HUD / denetim durumu (gerçek GPU, `headless:false`, `--use-angle=metal`)
// + tank / araç birinci şahıs görünümü kararmıyor (dürbün vinyeti yalnız yakınlaştırınca).
// Her araç (helikopter, jip, tank, motor) için: bot arkadaş araçta → oyuncu ölür → doğuş haritasından arkadaşın koltuğuna doğ → parmak izi (A);
// sonra aynı koltuktan in + aynı koltuğa normal bin (çevrimdışı Vehicles.enter / çevrim içi E ile) → parmak izi (B). A ile B aynı olmalı.
// Parmak izi: koltuk, kamera kipi (P._vcam / vehCam), kamera koltukta mı, gövde görünür mü, yakınlaştırma, araç paneli + adı + koltuk listesi + ipucu,
// artı / tank nişanı / burun artısı / dürbün örtüsü, silah modeli çizimi, cephane göstergesi, ölüm ekranı / doğuş haritası kapalı.
// Ayrıca: kamera tuşu (birinci ↔ üçüncü şahıs) her koltukta çalışır; hareketli jip / uçan helikopterde doğuş; yakınlaştırma (sağ tık).
//   Çevrimdışı:  node scripts/vehspawncam.mjs                          (URL=http://127.0.0.1:5201)
//   Çevrim içi:  WS=ws://127.0.0.1:8902 node scripts/vehspawncam.mjs   (sunucu BF_DEBUG=1: { ven } botu koltuğa oturtur)
//   ENV: MODE=off,on · ONLY=heli,jip,tank,motor · TAG=sonra (görüntü adı soneki) · OUT=/tmp/wb-vehcam
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5201', WS = process.env.WS || '', OUT = process.env.OUT || '/tmp/wb-vehcam', TAG = process.env.TAG || 'sonra';
const MODES = (process.env.MODE || (WS ? 'off,on' : 'off')).split(','), ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
let fails = 0; const check = (ok, m) => { console.log(`${ok ? 'OK  ' : 'HATA'}  ${m}`); if (!ok) fails++; };
const CASES = [
  { k: 'heli', pred: '!!v.def.heli && !v.def.fixed', ms: 0, dy: 28 },          // pilot arkadaş, havada (28 m) → kapı nişancısı
  { k: 'heli', pred: '!!v.def.heli && !v.def.fixed', ms: 1, fill: true, tag: 'pilot' },      // arkadaş kapıda, öbür koltuklar dolu → pilot koltuğu
  { k: 'jip', pred: "v.type === 'jip'", ms: 0, move: 12 },                     // giden jip (12 m/sn) → makineli
  { k: 'jip', pred: "v.type === 'jip'", ms: 0, pre: [1], tag: 'arka' },         // makineli dolu → arka koltuk (yolcu, kendi silahı)
  { k: 'tank', pred: "v.type === 'tank'", ms: 1, tag: 'surucu' },              // arkadaş makinelide → tank sürücüsü (top + birinci şahıs dürbün)
  { k: 'tank', pred: "v.type === 'tank'", ms: 0 },                             // arkadaş sürücü → makineli
  { k: 'motor', pred: '!!v.def.moto', ms: 0 },                                 // arkadaş sürücü → arka koltuk
].filter((c) => !ONLY || ONLY.includes(c.k));

// sayfada: parmak izi
const FP = () => {
  const g = window.__game, p = g.playerSoldier, P = g.player, c = g.camera, v = p.alive ? p.veh : null;
  const el = (s) => document.querySelector(s), disp = (s) => { const e = el(s); return e ? getComputedStyle(e).display : 'x'; };
  const e = p.eye(), r2 = (x) => +x.toFixed(2);
  const vmOn = !g.cine && p.alive && !p.downed && !g.showSelf && !(p.veh && (p.seat === 0 || (p.veh.def.mg?.seats || []).includes(p.seat)));
  return {
    alive: p.alive, veh: v?.type ?? null, vi: v?.idx ?? null, seat: v ? p.seat : -1, inSeats: v ? v.seats[p.seat] === p : null,
    vcam: P._vcam ?? null, vehCam: P.vehCam || 'third', body: !!P.bodyVisible, model: !!p.model.root.visible,
    camEye: r2(c.position.distanceTo(e)), camVeh: v ? r2(Math.hypot(c.position.x - v.st.x, c.position.y - v.st.y, c.position.z - v.st.z)) : null,
    zoom: r2(P.baseFov() / c.fov), ads: !!p.ads, vehK: r2(P._vehK || 0),
    panel: disp('#vhPanel'), nm: el('#vhPanel .nm')?.textContent || '', me: el('#vhPanel .seats .me')?.textContent || '', hint: (el('#vhPanel .hint')?.textContent || '').slice(0, 40),
    cross: disp('#cross'), aim: disp('#vhAim'), sight: disp('#vhSight'), sightZ: el('#vhSight')?.classList.contains('z') || false, nose: disp('#vhNose'), scope: disp('#scope'),
    advig: +(+getComputedStyle(el('#advig') || document.body).opacity || 0).toFixed(2), ammo: el('#ammo') ? getComputedStyle(el('#ammo')).visibility : 'x', vm: vmOn,
    respawn: disp('#respawn'), map: !!g.bigMap?.open, dct: r2(P.deathCamT || 0),
  };
};
// karşılaştırılan alanlar (konuma / zamana / bakış yönüne bağlı olanlar dışında: burun artısı ekranda mı bakışa bağlı → doğuşta ayrıca denetlenir)
const KEYS = ['alive', 'veh', 'vi', 'seat', 'inSeats', 'vcam', 'vehCam', 'body', 'model', 'zoom', 'ads', 'vehK', 'panel', 'nm', 'me', 'hint', 'cross', 'aim', 'sight', 'sightZ', 'scope', 'ammo', 'vm', 'respawn', 'map'];
const diff = (a, b) => KEYS.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k}: ${JSON.stringify(a[k])} ≠ ${JSON.stringify(b[k])}`);
// kamera nerede olmalı: sürücü (vehCamera) üçüncü şahısta aracın arkasında, birinci şahısta araçta; diğer koltuklar gözde (birinci) / arkada (üçüncü)
const camOk = (f) => f.vcam === 'third' ? f.camVeh > 4 && f.camVeh < 22 && f.body : f.seat === 0 ? f.camVeh < 4.5 : f.camEye < 0.05;
const modeOf = (f) => (f.vcam === 'third' ? 'third' : 'first');

async function open(mode) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'tr-TR' });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const q = 'map=kuzey&type=conquest&dev=1&debug=1&nolock=1&tod=day&weather=clear';
  await page.goto(mode === 'on' ? `${URL0}/?online=new&per=8&bots=1&time=3600&team=blue&name=Deneme&server=${encodeURIComponent(WS)}&${q}` : `${URL0}/?autostart=8v8&${q}`);
  await page.waitForFunction(() => window.__game?.running && window.__game.vehicles && window.__game.playerSoldier && window.__game.time > 1.5, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate((fp) => { window.__vcFp = new Function('return (' + fp + ')()'); const g = window.__game; if (g.online) g.online.send({ t: 'dbg', bots: false }); else g.brainsOff = g.brains.splice(0); }, FP.toString());
  return { ctx, page, errs };
}
const fp = (page) => page.evaluate(() => window.__vcFp());
// arkadaşı (aynı manga, bot) türdeki takım aracına koltuk ms'e oturt; pre: önceden doldurulacak koltuklar (başka bot), fill: kalan koltuklar (doğulacak koltuk dışında)
async function mateInVeh(page, c) {
  const mv = await page.evaluate((c) => {
    const g = window.__game, me = g.playerSoldier, V = g.vehicles;
    const mates = g.soldiers.filter((s) => s !== me && s.team === me.team && s.squad === me.squad && !s.vacant && s.alive && !s.human);
    const L = V.list.filter((v) => v.alive && v.st && !v.st.sunk && !v.burn && new Function('v', 'return ' + c.pred)(v) && (v.spawn?.team === me.team || v.team === me.team));
    L.sort((a, b) => Math.hypot(a.st.x - me.pos.x, a.st.z - me.pos.z) - Math.hypot(b.st.x - me.pos.x, b.st.z - me.pos.z));
    const v = L[0], m = mates[0];
    if (!v || !m) return null;
    const others = g.soldiers.filter((s) => s !== me && s !== m && s.team === me.team && s.alive && !s.vacant && !s.human && !s.veh);
    return { vi: v.idx, id: v.id, type: v.type, mid: m.id, seats: v.seats.length, mg: v.def.mg?.seats || [], others: others.map((s) => s.id) };
  }, c);
  if (!mv) return null;
  const online = await page.evaluate(() => !!window.__game.online);
  const sit = async (sid, seat, dy, clr = 0) => {
    if (online) { await page.evaluate(([sid, vi, seat, dy, clr]) => window.__game.online.send({ t: 'dbg', ven: [sid, vi, seat, dy || 0, clr] }), [sid, mv.vi, seat, dy, clr]); await page.waitForTimeout(250); }
    else await page.evaluate(([sid, vi, seat, dy]) => {
      const g = window.__game, V = g.vehicles, v = V.list[vi], o = g.soldiers[sid];
      if (o.veh) V.exit(o);
      v.burn = false; v.hp = v.def.hp; v.st.roll = v.st.pitch = 0; if (v.st.fall) v.st.fall = 0;
      if (dy) { v.st.y += dy; v.st.air = true; v.st.rpm = 1; const y = v.st.y; window.__vcHold = setInterval(() => { v.st.y = y; v.st.vy = 0; v.st.air = true; }, 16); }      // havada asılı (botlar donuk: pilot girdisi yok)
      V.enter(o, v, seat); o._sqSt = null; if (seat === 0 && o.brain) o.brain.vd = { v, test: 1 };
    }, [sid, mv.vi, seat, dy]);
  };
  // önce araçtaki herkes iner (çevrimdışı; çevrim içinde ven ilk oturtmada boşaltır)
  if (!online) await page.evaluate((vi) => { const g = window.__game, V = g.vehicles, v = V.list[vi]; for (const s of [...v.seats]) if (s) V.exit(s); }, mv.vi);
  await sit(mv.mid, c.ms, online ? 0 : c.dy, 1);      // çevrim içinde pilotsuz (donuk bot) helikopter havada düşer: yerde
  const want = [...(c.pre || [])];
  if (c.fill) for (let i = 0; i < mv.seats; i++) if (i !== c.ms && i !== 0) want.push(i);
  let k = 0; for (const seat of want) if (mv.others[k] != null) await sit(mv.others[k++], seat, 0);
  if (c.move) {
    if (online) await page.evaluate(([vi, sp]) => { /* çevrim içinde aracı süren bot yok: hareketli doğuş çevrimdışında ölçülür */ }, [mv.vi, c.move]);
    else await page.evaluate(([vi, sp]) => { const g = window.__game, v = g.vehicles.list[vi]; window.__vcMove = setInterval(() => { const st = v.st; if (!st) return; st.vx = -Math.sin(st.yaw) * sp; st.vz = -Math.cos(st.yaw) * sp; }, 16); }, [mv.vi, c.move]);
  }
  await page.waitForTimeout(400);
  return mv;
}
async function kill(page) {
  await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; if (g.online) g.online.send({ t: 'dbg', kill: 1 }); else { p.protT = 0; g.devGod = false; p.takeDamage(999, g.soldiers.find((s) => s.team !== p.team), 'body', p.pos, 'AK-47'); } });
  await page.waitForFunction(() => !window.__game.playerSoldier.alive, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
}
async function deploy(page, mid) {
  await page.evaluate((mid) => { const g = window.__game; g.soldiers[mid]._sqSt = null; g.requestSpawn('sq:' + mid); }, mid);
  await page.waitForTimeout(400);
  await page.click('#respawn .dgo').catch(() => {});
  await page.waitForFunction(() => window.__game.playerSoldier.alive, null, { timeout: 25000 }).catch(() => {});
}

for (const mode of MODES) {
  if (mode === 'on' && !WS) { console.log('WS yok: çevrim içi atlandı'); continue; }
  const { ctx, page, errs } = await open(mode);
  const L = mode === 'on' ? 'ağ' : 'yerel';
  for (const c of CASES) {
    if (mode === 'on' && c.move) continue;
    const name = `${c.k}${c.tag ? '-' + c.tag : ''}`;
    await kill(page);
    const mv = await mateInVeh(page, c);
    if (!mv) { check(false, `${L} ${name}: araç / arkadaş bulunamadı`); continue; }
    await deploy(page, mv.mid);
    const f0 = await fp(page);                                          // doğduğu ilk kare
    await page.waitForTimeout(900);
    const A = await fp(page);
    await page.screenshot({ path: `${OUT}/${mode}-${name}-dogus-${TAG}.png` });
    const okSeat = A.alive && A.vi === mv.vi && A.inSeats;
    check(okSeat, `${L} ${name}: arkadaşın aracına doğdu (koltuk ${A.seat}, ${A.veh})`);
    if (!okSeat) { console.log('     A', JSON.stringify(A)); await page.evaluate(() => { clearInterval(window.__vcMove); clearInterval(window.__vcHold); }); continue; }
    check(f0.alive && f0.vi === mv.vi && f0.inSeats, `${L} ${name}: doğduğu ilk karede koltukta (${JSON.stringify({ seat: f0.seat, vcam: f0.vcam })})`);
    check(camOk(A) && modeOf(A) === A.vehCam, `${L} ${name}: kamera araç görünümünde, tercih ${A.vehCam} (${A.vcam || 'göz'}, göze ${A.camEye} m, araca ${A.camVeh} m, gövde ${A.body})`);
    check(A.panel === 'block' && A.nm && A.me && A.respawn === 'none' && !A.map && A.dct === 0, `${L} ${name}: araç HUD'u (${A.nm} · ${A.me}), ölüm ekranı / harita kapalı`);
    // takip kamerasında gerçek isabet: düşmanı aracın 24 m önüne-yanına koy, ARTIYI (kamera ışını) gövdesine tut, 1,5 sn ateş (çevrim içinde sunucu isabeti)
    if (A.vcam === 'third' && A.seat > 0 && !c.dy && (c.k === 'tank' || c.k === 'jip')) {
      const tid = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, v = me.veh, r = g.soldiers.find((s) => s.team !== me.team && s.alive && !s.veh && !s.human), a = v.st.yaw + 0.5, x = v.st.x - Math.sin(a) * 24, z = v.st.z - Math.cos(a) * 24;
        if (g.online) g.online.send({ t: 'dbg', tps: [r.id, x, z, 0, 100] }); else { r.pos.set(x, g.world.heightAt(x, z), z); r.hp = 100; r.protT = 0; g.world.settle(r); } return r.id; });
      await page.waitForTimeout(700);
      const hr = await page.evaluate(async (id) => {
        const g = window.__game, me = g.playerSoldier, T = g.soldiers[id];
        const aim = () => { const c = g.camera.position, t = T.center(), dx = t.x - c.x, dz = t.z - c.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(t.y - c.y, Math.hypot(dx, dz)); };
        const i2 = setInterval(aim, 8); aim(); await new Promise((r) => setTimeout(r, 300)); g.player.fireHeld = true;
        await new Promise((r) => setTimeout(r, 1500)); g.player.fireHeld = false; clearInterval(i2);
        await new Promise((r) => setTimeout(r, 500));
        return { hp: Math.round(T.hp), alive: T.alive, d: Math.round(Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z)), mg: !!me.veh?.def.mg?.seats?.includes(me.seat) };
      }, tid);
      check(!hr.alive || hr.hp < 100, `${L} ${name}: takip kamerasında artıdaki düşmana ${hr.mg ? 'makineli' : 'kendi silahı'} isabet eder (${hr.d} m, can ${hr.hp})`);
    }
    if (A.seat === 0 && c.k === 'heli') check(A.nose === 'block', `${L} ${name}: pilot koltuğunda burun artısı (${A.nose})`);
    // takip kamerasında artı = atış: makineli gözden artının noktasına (mgAim), yolcu kendi silahıyla kamera ışınından (shotOff)
    if (A.vcam === 'third' && A.seat > 0) {
      const am = await page.evaluate(async () => {
        const g = window.__game, p = g.playerSoldier, c = g.camera, THREE = await import('/node_modules/three/build/three.module.js');
        const cd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion), h = g.world.raycast(c.position, cd, 500, {}), t = h ? h.t : 500;
        const P = c.position.clone().addScaledVector(cd, t), e = p.eye();
        if (p.mgAim) { const d = new THREE.Vector3(-Math.sin(p.mgAim.y) * Math.cos(p.mgAim.p), Math.sin(p.mgAim.p), -Math.cos(p.mgAim.y) * Math.cos(p.mgAim.p)), L = e.distanceTo(P); return { k: 'mg', err: +e.clone().addScaledVector(d, L).distanceTo(P).toFixed(2), L: +L.toFixed(1) }; }
        return { k: 'own', so: p.shotOff ? +p.shotOff.length().toFixed(2) : 0, err: p.shotOff ? +e.clone().add(p.shotOff).distanceTo(c.position).toFixed(3) : 9 };
      });
      check(am.err < (am.k === 'mg' ? 0.6 : 0.05), `${L} ${name}: takip kamerasında atış artıya (${am.k === 'mg' ? `makineli, ${am.L} m'de sapma ${am.err} m` : `kendi silahı kamera ışınından, ofset ${am.so} m`})`);
    }
    // normal biniş: aynı koltuktan in + aynı koltuğa bin
    const seat = A.seat;
    if (mode === 'on') {
      // çevrim içinde: E ile in → E ile yeniden bin (sunucu koltuğu seçer) → 1–4 ile aynı koltuğa geç (vs)
      await page.evaluate(() => window.__game.online.edge('ve')); await page.waitForTimeout(900);
      const out = await fp(page);
      check(out.alive && out.veh === null, `${L} ${name}: E ile indi`);
      await page.evaluate((vi) => { const g = window.__game, v = g.vehicles.list[vi], me = g.playerSoldier; me.yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); g.online.edge('ve'); }, mv.vi); await page.waitForTimeout(900);
      let cur = await fp(page);
      if (cur.vi === mv.vi && cur.seat !== seat) { await page.evaluate((n) => { window.__game.online.edges.vs = n + 1; }, seat); await page.waitForTimeout(900); }
    } else {
      await page.evaluate(() => { const g = window.__game, p = g.playerSoldier; window.__vcSeat = [p.veh.idx, p.seat]; g.vehicles.exit(p); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { const g = window.__game, p = g.playerSoldier, [vi, s] = window.__vcSeat, v = g.vehicles.list[vi]; g.vehicles.enter(p, v, s); });
    }
    await page.waitForTimeout(900);
    const B = await fp(page);
    await page.screenshot({ path: `${OUT}/${mode}-${name}-binis-${TAG}.png` });
    const dd = diff(A, B);
    check(B.vi === mv.vi && B.seat === seat && !dd.length, `${L} ${name}: doğuş = normal biniş (koltuk ${B.seat}${dd.length ? ' · FARK ' + dd.join(' · ') : ''})`);
    if (dd.length || !camOk(A)) { console.log('     A', JSON.stringify(A)); console.log('     B', JSON.stringify(B)); }
    // kamera tuşu (birinci ↔ üçüncü şahıs) — doğuştan sonra ve binişten sonra aynı davranır
    await page.keyboard.press('KeyV'); await page.waitForTimeout(700);
    const T = await fp(page);
    await page.screenshot({ path: `${OUT}/${mode}-${name}-kamera-tusu-${TAG}.png` });
    check(T.vehCam !== B.vehCam && modeOf(T) === T.vehCam && camOk(T), `${L} ${name}: kamera tuşu ${modeOf(B)} → ${modeOf(T)} (araca ${T.camVeh} m, göze ${T.camEye} m, gövde ${T.body})`);
    await page.keyboard.press('KeyV'); await page.waitForTimeout(500);
    // yakınlaştırma (sağ tık) silahlı koltukta
    const armed = await page.evaluate(() => { const p = window.__game.playerSoldier, d = p.veh?.def; return !!d && (p.seat === 0 ? !!(d.cannon || d.nose || d.mg?.seats?.includes(0)) : !!d.mg?.seats?.includes(p.seat)); });
    if (armed) {
      await page.mouse.move(640, 380); await page.mouse.down({ button: 'right' }); await page.waitForTimeout(700);
      const Z = await fp(page);
      await page.screenshot({ path: `${OUT}/${mode}-${name}-yakin-${TAG}.png` });
      await page.mouse.up({ button: 'right' }); await page.waitForTimeout(500);
      check(Z.zoom > 1.2 && Z.scope === 'none', `${L} ${name}: sağ tık aracın yakınlaştırması ×${Z.zoom} (piyade dürbünü ${Z.scope})`);
    }
    await page.evaluate(() => { clearInterval(window.__vcMove); clearInterval(window.__vcHold); });
    if (c.dy && mode !== 'on') await page.evaluate(([vi, dy]) => { const v = window.__game.vehicles.list[vi]; v.st.y -= dy; v.st.air = false; v.st.vy = 0; }, [mv.vi, c.dy]);
  }
  // tank birinci şahıs: kararma yok (yakınlaşmadan), yakınlaşınca dürbün örtüsü
  if (!ONLY || ONLY.includes('tank')) {
    await kill(page);
    const mv = await mateInVeh(page, { pred: "v.type === 'tank'", ms: 1 });
    await deploy(page, mv.mid); await page.waitForTimeout(800);
    const S0 = await fp(page);
    if (S0.seat === 0) {
      await page.evaluate(() => { window.__game.player.vehCam = 'first'; }); await page.waitForTimeout(800);
      const lum = async () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
        // ekran görüntüsü yerine: #vhSight örtüsünün kenar opaklığı (radyal geçişin dış rengi) + görünürlük
        const e = document.querySelector('#vhSight'), cs = getComputedStyle(e);
        res({ disp: cs.display, bg: cs.backgroundImage.slice(0, 160), z: e.classList.contains('z') });
      })));
      const F = await fp(page), F1 = await lum();
      await page.screenshot({ path: `${OUT}/${mode}-tank-1sahis-${TAG}.png` });
      const dark = /rgba\(\s*4,\s*6,\s*8,\s*0\.9/.test(F1.bg) && !F1.z && F1.disp !== 'none';
      check(F.vcam === 'first' && !dark, `${L} tank 1. şahıs: koyu dürbün vinyeti yok (sight ${F1.disp}, yakın ${F1.z})`);
      await page.mouse.move(640, 380); await page.mouse.down({ button: 'right' }); await page.waitForTimeout(800);
      const Z1 = await lum(), Z = await fp(page);
      await page.screenshot({ path: `${OUT}/${mode}-tank-1sahis-yakin-${TAG}.png` });
      await page.mouse.up({ button: 'right' }); await page.waitForTimeout(400);
      check(Z.zoom > 2 && Z1.z && Z1.disp !== 'none', `${L} tank 1. şahıs sağ tık: ×${Z.zoom} + dürbün örtüsü (yakın ${Z1.z})`);
    } else check(false, `${L} tank: sürücü koltuğuna doğulamadı (${S0.seat})`);
  }
  check(!errs.length, `${L}: sayfa hatası yok ${errs.slice(0, 3).join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} HATA` : '\nhepsi tamam');
process.exit(fails ? 1 : 0);
