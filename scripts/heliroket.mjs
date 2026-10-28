// 12.206 helikopter pilotu roketleri: artı ↔ isabet ölçümü (önce / sonra aynı betik). Gerçek GPU (pencereli, --use-angle=metal), çevrimdışı.
//   URL=http://127.0.0.1:5189 OUT=/tmp/wb-heli2/once node scripts/heliroket.mjs
// Senaryolar (Kuzey Vadisi, Fabrika doğusu, 45 m irtifa): artı 3 farklı eğimde yere (yakın / orta / uzak), artı yana çevrilir çevrilmez ateş,
// ileri uçarken ateş. Her senaryoda: roketlerin düşüş noktasının artının gösterdiği noktaya (ateş anındaki) uzaklığı, burun topu mermilerinin
// aynı ölçüsü, tuşa basıştan ilk rokete süre, ateş boyunca helikopterin kayması; hedef noktaya konan düşman asker ölüyor mu. Ekran görüntüsü:
// HUD (artı, roket işareti, panel) + isabet anı. Tuşlar GERÇEK girdiyle (page.mouse / page.keyboard): önce = orta tık basılı, sonra = Q ile roket
// seç + sol tık basılı. Çıktı: OUT/*.png + OUT/olcum.json; sonda OK / HATA (yalnız "sonra" sistemi denetlenir; önce = ölçüm).
import { chromium } from 'playwright';
import fs from 'fs';
const URL0 = process.env.URL || 'http://127.0.0.1:5189', OUT = process.env.OUT || '/tmp/wb-heli2/sonra';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [], R = {};
let bad = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  HATA ') + m); if (!c) bad++; };
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1`);
await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
await page.waitForTimeout(1200);
const ev = (f, a) => page.evaluate(f, a);
const after = await ev(() => typeof window.__game.vehicles.rocketAimFor === 'function');
console.log(after ? 'SONRA (seçili silah sistemi)' : 'ÖNCE (Q / orta tık roket)');
await ev(() => {
  const g = window.__game, me = g.playerSoldier, V = g.vehicles;
  g.brainsOff = g.brains.splice(0); g.devGod = true;
  window.__log = { rk: [], rkHit: [], mg: [], t0: 0 };
  const ne = g.netEvent.bind(g);
  g.netEvent = (e) => {
    const L = window.__log;
    if (e.e === 'ts' && e.w === 1) { const P = me.gunAim?.P; L.rk.push({ id: e.id, t: performance.now() - L.t0, o: e.o, P: P ? { x: P.x, y: P.y, z: P.z } : null }); }
    if (e.e === 'tsb' && e.w === 1) L.rkHit.push({ id: e.id, p: e.p });
    return ne(e);
  };
  const sr = g.shootRay.bind(g);
  g.shootRay = (s, o, d, st, mz, co) => { if (s === me && s.veh) { const P = me.gunAim?.P, q = g.world.raycast(o, d, 800, {}); window.__log.mg.push({ P: P ? { x: P.x, y: P.y, z: P.z } : null, hit: q ? { x: o.x + d.x * q.t, y: o.y + d.y * q.t, z: o.z + d.z * q.t } : null }); } return sr(s, o, d, st, mz, co); };
  // hedef asker: kırmızı takımdan biri artının noktasına (yerde) konur, ölüp ölmediği izlenir
  window.__foe = g.soldiers.find((e) => e.team !== me.team && e.alive);
  if (window.__foe) { const f = window.__foe, die = f.die.bind(f); f.die = (...a) => { window.__foeDied = true; return die(...a); }; }
  window.__seat = (x, z, yaw, y) => {
    const v = V.list.find((o) => o.id === 'B-H1');
    if (me.veh) V.exit(me);
    if (!v.alive) V.trySpawn(v, true);
    v.hp = v.def.hp; v.rk = v.def.rockets.n; v.rkR = v.rkT = 0;
    v.st.x = x; v.st.z = z; v.st.y = y; v.st.yaw = yaw; v.st.pitch = 0; v.st.roll = 0; v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = true; v.st.rpm = 1; v.sleep = false;
    me.pos.set(x + 3, y, z);
    V.enter(me, v, 0); g.player.vehCam = 'third'; me.yaw = yaw; me.pitch = -0.1; me.ads = false; me.vheat = 0; me.vhot = false;
    me.vw = 0;
  };
  window.__placeFoe = () => { const f = window.__foe, P = me.gunAim?.P; if (!f || !P) return null; window.__foeDied = false; if (!f.alive) { f.alive = true; f.hp = 100; } f.hp = f.maxHp || 100; const X = P.x + 1.6, Z = P.z; f.pos.set(X, g.world.heightAt(X, Z), Z); /* artının 1,6 m yanında: ışını kesmesin, HE öldürmeli */ f.vel.set(0, 0, 0); return { x: X, z: Z }; };
  window.__res = () => {
    const L = window.__log, hits = new Map(L.rkHit.map((h) => [h.id, h.p]));
    const rk = L.rk.map((r) => { const p = hits.get(r.id); return p && r.P ? { t: r.t, d: Math.hypot(p[0] - r.P.x, p[1] - r.P.y, p[2] - r.P.z), dh: Math.hypot(p[0] - r.P.x, p[2] - r.P.z) } : { t: r.t, d: null }; });
    const mg = L.mg.filter((m) => m.P && m.hit).map((m) => Math.hypot(m.hit.x - m.P.x, m.hit.y - m.P.y, m.hit.z - m.P.z));
    const avg = (a) => (a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : null);
    const v = me.veh, P = L.rk[0]?.P;
    return { n: rk.length, landed: rk.filter((r) => r.d != null).length, rkErr: avg(rk.filter((r) => r.d != null).map((r) => r.d)), rkMax: rk.length ? +Math.max(...rk.filter((r) => r.d != null).map((r) => r.d)).toFixed(2) : null,
      first: rk.length ? +(rk[0].t / 1000).toFixed(3) : null, mgN: mg.length, mgErr: avg(mg), aimDist: P && v ? +Math.hypot(P.x - v.st.x, P.y - v.st.y, P.z - v.st.z).toFixed(1) : null,
      foeDead: !!window.__foeDied, nose: v ? +v.st.pitch.toFixed(3) : null };
  };
});
const YE = 0, TX = 0, TZ = 430;               // Benzinlik batısındaki açık mera (güneye bakış: hedefler çayırda)
const HY = await ev(([x, z]) => window.__game.world.heightAt(x, z) + 45, [TX, TZ]);
const cx = 640, cy = 360;
await page.mouse.move(cx, cy);
async function pressFire(ms, kind) {
  await ev(() => { window.__log.t0 = performance.now(); });
  if (kind === 'rk') {
    if (after) { await page.mouse.down({ button: 'left' }); await page.waitForTimeout(ms); await page.mouse.up({ button: 'left' }); }
    else { await page.mouse.down({ button: 'middle' }); await page.waitForTimeout(ms); await page.mouse.up({ button: 'middle' }); }
  } else { await page.mouse.down({ button: 'left' }); await page.waitForTimeout(ms); await page.mouse.up({ button: 'left' }); }
}
async function selectRockets(on) {
  if (!after) return;
  const cur = await ev(() => window.__game.playerSoldier.vw || 0);
  if (!!cur !== on) await page.keyboard.press('KeyQ');
  await page.waitForTimeout(150);
}
// senaryo: artı eğimi (pitch), artı yaw farkı (dy, ateşten hemen önce), bekleme (settle sn), ileri uçuş
async function scen(name, { pitch, dy = 0, settle = 2.4, fwd = false, shotAt = 900 }) {
  await ev(([TX, TZ, YE, HY]) => window.__seat(TX, TZ, YE, HY), [TX, TZ, YE, HY]);
  await ev(([p]) => { window.__game.playerSoldier.pitch = p; }, [pitch]);
  if (fwd) await page.keyboard.down('KeyW');
  await page.waitForTimeout(settle * 1000);
  let foe = await ev(() => window.__placeFoe());
  // burun topu kısa seri (aynı artıya)
  await selectRockets(false);
  await ev(() => { window.__log.mg.length = 0; });
  await pressFire(350, 'mg');
  const mgRes = await ev(() => window.__res());
  // roket (dy: artı yana çevrilir, 60 ms sonra ateş — burun henüz dönmedi)
  await selectRockets(true);
  if (dy) { await ev(([dy]) => { window.__game.playerSoldier.yaw += dy; }, [dy]); await page.waitForTimeout(60); }
  foe = await ev(() => window.__placeFoe());
  await ev(() => { const L = window.__log; L.rk.length = 0; L.rkHit.length = 0; });
  const p0 = await ev(() => { const s = window.__game.playerSoldier.veh.st; return [s.x, s.y, s.z]; });
  const fire = pressFire(1000, 'rk');
  await page.waitForTimeout(shotAt);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await fire;
  await page.waitForTimeout(2200);
  const p1 = await ev(() => { const s = window.__game.playerSoldier.veh.st; return [s.x, s.y, s.z]; });
  if (fwd) await page.keyboard.up('KeyW');
  const r = await ev(() => window.__res());
  r.mgErr = mgRes.mgErr; r.mgN = mgRes.mgN; r.drift = +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1); r.foe = foe;
  await selectRockets(false);
  console.log(`  ${name}: ${JSON.stringify(r)}`);
  R[name] = r;
  return r;
}
const a = await scen('01-orta-egim', { pitch: -0.3 });
const b = await scen('02-dik-egim', { pitch: -0.55 });
const c = await scen('03-uzak', { pitch: -0.16 });
const d = await scen('04-yana-donup-hemen', { pitch: -0.3, dy: 0.3, settle: 2.4 });
const e = await scen('05-ileri-ucarken', { pitch: -0.25, fwd: true, settle: 3 });
// HUD yakın görüntü: roket seçiliyken (sonra) / Q basılıyken (önce) panel + artı
await ev(([TX, TZ, YE, HY]) => window.__seat(TX, TZ, YE, HY), [TX, TZ, YE, HY]);
await ev(() => { window.__game.playerSoldier.pitch = -0.3; });
await page.waitForTimeout(2000);
await selectRockets(true);
await page.screenshot({ path: `${OUT}/06-hud-roket-secili.png` });
R.hud = await ev(() => { const p = document.querySelector('#vhPanel .gun span'); const sel = document.querySelector('#vhPanel .wsel'); return { panel: p?.textContent || '', sel: sel?.textContent || '' }; });
await ev(() => { const L = window.__log; L.rk.length = 0; });
await page.mouse.down({ button: after ? 'left' : 'middle' }); await page.waitForTimeout(3300); await page.mouse.up({ button: after ? 'left' : 'middle' });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/07-hud-dolum.png` });
R.hudLoad = await ev(() => { const p = document.querySelector('#vhPanel .gun span'); const v = window.__game.playerSoldier.veh; return { panel: p?.textContent || '', rk: v.rk, rkR: +(v.rkR || 0).toFixed(1), n: window.__log.rk.length }; });
console.log('  HUD', JSON.stringify(R.hud), JSON.stringify(R.hudLoad));
if (after) {
  for (const [k, r] of [['orta', a], ['dik', b], ['uzak', c], ['ileri', e]]) ok(r.landed >= 3 && r.rkErr < 3.5, `${k}: roket artının noktasına (ort. ${r.rkErr} m, en çok ${r.rkMax} m; ${r.aimDist} m'de; burun topu ${r.mgErr} m)`);
  ok(d.landed >= 3 && d.rkErr < 6, `yana dönüp hemen: roket ort. ${d.rkErr} m (önce burun yetişmeden burnun yönüne gidiyordu)`);
  ok(a.first != null && a.first < 0.12, `sol tık → ilk roket ${a.first} sn`);
  ok(/ROKET|ROCKET/i.test(R.hud.sel || R.hud.panel), `HUD seçili silah: "${R.hud.sel || R.hud.panel}"`);
  ok(R.hudLoad.n >= 14 && /DOL|RELOAD/i.test(R.hudLoad.panel), `kapsül boşalınca dolum HUD'da: "${R.hudLoad.panel}"`);
}
fs.writeFileSync(`${OUT}/olcum.json`, JSON.stringify(R, null, 1));
await browser.close();
console.log('sayfa hatası', errs.length, errs.slice(0, 3).join(' | '));
if (errs.length) bad++;
console.log(bad ? `HATA ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
