// 12.201 araç nişanı — başsız (sunucunun yolu: Game.vehTick, insan girdisi kuyruğu): helikopter burnu artıyı izler (gy / gp), burun topu artının
// noktasına (koni), 12.206: W yokken burun aşağı = yerinde asılı, W + burun aşağı = öne; roket (vw + sol tık + gP) artının noktasına, eski 'rk' burnun yönünde; eski istemci (gy / gp yok) bozulmaz; tank topu
// tepeden aşağıdaki hedefe (−10°), jip makinelisi yan yatık jipte aşağı (gövdeye göre sınır). Sayısal çıktı + OK / HATA.
//   node scripts/vehaimhl.mjs
import { Game } from '../src/game/game.js';
import { VT, mgPitch, bodyPitchAlong } from '../src/sim/vehicle.js';

let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f2 = (v) => (+v).toFixed(2), f3 = (v) => (+v).toFixed(3), deg = (r) => (r * 57.2958).toFixed(1) + '°';
const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 8, type: 'conquest' } }), V = g.vehicles, W = g.world;
const s = g.claimSlot('blue', 'Pilot', 'assault', {}), h = g.humans.get(s.id);
let q = 0;
const inp = (o = {}) => ({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: s.pitch, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...o });
const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push(inp(typeof o === 'function' ? o(i) : o)); g.step(1 / 60); } };
const reds = g.soldiers.filter((o) => o.team === 'red');
const place = (e, x, z) => { e.vacant = false; e.spawn({ x, z, ry: 0 }, 0); W.settle(e); e.vel.set(0, 0, 0); e.fallTop = e.pos.y; e.zoneT = 0; e.protT = 0; e.maxHp = 100; e.hp = 100; e.static = true; return e; };
const put = (v, x, z, yaw, y) => { if (!v.alive) V.trySpawn(v, true); v.st.x = x; v.st.z = z; v.st.y = y ?? W.heightAt(x, z); v.st.yaw = yaw; v.st.pitch = 0; v.st.roll = 0; if (v.def.turret) { v.st.tyaw = yaw; v.st.gp = 0; } v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = y != null; if (v.def.heli) v.st.rpm = y != null ? 1 : 0; v.sleep = false; };
const shots = []; const sr = g.shootRay.bind(g);
g.shootRay = (sh, o, d, ...a) => { if (sh === s) shots.push({ o: { x: o.x, y: o.y, z: o.z }, d: { x: d.x, y: d.y, z: d.z } }); return sr(sh, o, d, ...a); };
const rks = []; const as = V.addShell.bind(V); V.addShell = (sh) => { if (sh.w && sh.by === s) rks.push(Math.atan2(sh.vy - (sh.v?.st.vy || 0), Math.hypot(sh.vx - (sh.v?.st.vx || 0), sh.vz - (sh.v?.st.vz || 0)))); return as(sh); };
const land = (S) => S.map((o) => { const r = W.raycast(o.o, o.d, 800, {}); return r ? { x: o.o.x + o.d.x * r.t, y: o.o.y + o.d.y * r.t, z: o.o.z + o.d.z * r.t } : null; });
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

// ── 1) helikopter pilotu havada asılı, hedef 70 m önde yerde ──
console.log('── helikopter pilotu (sunucu yolu) ──');
const hl = V.list.find((x) => x.id === 'B-H1'), YE = -Math.PI / 2, X0 = 292, Z0 = -404, H0 = W.heightAt(X0, Z0) + 45;
put(hl, X0, Z0, YE, H0); s.pos.set(X0 + 3, W.heightAt(X0 + 3, Z0), Z0); s.protT = 0; V.enter(s, hl, 0);
const P = { x: X0 + 70, y: W.heightAt(X0 + 70, Z0), z: Z0 };
const aimIn = (o = {}) => () => { const A = V.noseAimAt(hl, P, {}); return { yw: A.y, pt: A.p, gy: A.y, gp: A.p, ...o }; };
step(240, aimIn({ f: 0, j: 0 }));                                     // 12.206 burun aşağı, W yok: yerinde asılı (eskiden S gerekiyordu)
const want = V.noseAimAt(hl, P, {}).p, sp0 = Math.hypot(hl.st.vx, hl.st.vz);
ok(hl.st.pitch < -0.35, 'burun artıyı izler: aşağıdaki hedefe bakınca burun eğilir', `burun ${f3(hl.st.pitch)} rad (${deg(hl.st.pitch)}), artı ${f3(want)} rad`);
ok(sp0 < 1.2, 'burun aşağı, W yok: yerinde asılı kalır (hover)', `yatay hız ${f2(sp0)} m/sn`);
shots.length = 0; step(60, aimIn({ f: 0, fh: 1 }));
const L1 = land(shots), miss1 = L1.map((p) => (p ? Math.hypot(p.x - P.x, p.y - P.y, p.z - P.z) : 99)), pit1 = shots.map((o) => Math.asin(o.d.y));
ok(shots.length >= 8 && mean(pit1) < -0.45 && mean(miss1) < 4, 'hover\'da burun topu aşağı, artının noktasına', `${shots.length} mermi · çıkış pitch ort. ${f3(mean(pit1))} rad (${deg(mean(pit1))}) · artıdan ort. ${f2(mean(miss1))} m (70 m önde, 45 m aşağıda)`);
rks.length = 0; step(60, aimIn({ f: 0, rk: 1 }));
ok(rks.length >= 3 && Math.abs(mean(rks) - hl.st.pitch) < 0.03, 'roketler (girdi rk) burnun yönünde', `${rks.length} roket · pitch ${f3(mean(rks))} · burun ${f3(hl.st.pitch)}`);
const R1 = { nose: hl.st.pitch, pitch: mean(pit1), miss: mean(miss1), n: shots.length };
// 12.206 roket: seçili silah roket (vw 1) + sol tık (fh) + artının noktası (gP) → roketler P'ye yakınsar (sunucunun 'tsb' patlama noktası)
{ const booms = [], ne = g.netEvent.bind(g); g.netEvent = (e) => { if (e.e === 'tsb' && e.w === 1) booms.push(e.p); return ne(e); };
  hl.rk = hl.def.rockets.n; hl.rkR = 0; step(150, () => ({ ...aimIn({ f: 0 })(), vw: 1, fh: 1, gP: [P.x, P.y, P.z] }));
  const m = booms.map((p) => Math.hypot(p[0] - P.x, p[1] - P.y, p[2] - P.z)), sp = Math.hypot(hl.st.vx, hl.st.vz);
  ok(booms.length >= 8 && mean(m) < 1 && shots.length === R1.n, '12.206 roket seçili + sol tık + gP: roketler artının noktasına (burun topu ateşlenmez)', `${booms.length} roket · artıdan ort. ${f2(mean(m))} m, en çok ${f2(Math.max(...m))} m · yatay hız ${f2(sp)} m/sn`);
  g.netEvent = ne; }
// 12.206 W + burun aşağı: öne hızlanır (BF dalışı)
step(180, aimIn({ f: 1 }));
const sp1 = Math.hypot(hl.st.vx, hl.st.vz), fwd = -(hl.st.vx * Math.sin(hl.st.yaw) + hl.st.vz * Math.cos(hl.st.yaw));
ok(fwd > 4, 'W + burun aşağı: öne hızlanır', `ileri hız ${f2(fwd)} m/sn (${f2(sp1 * 3.6)} km/s)`);
// koni: burun sınırının (−0,6) ötesi, dik aşağı (hedef 50 m önde, 45 m aşağıda) — burun topu koniyle daha aşağı
put(hl, X0, Z0, YE, H0); step(30, () => ({ yw: YE, pt: 0, gy: YE, gp: 0, f: 0 }));
const P2 = { x: X0 + 50, y: W.heightAt(X0 + 50, Z0), z: Z0 };      // ~36° aşağı: burun sınırının (−0,6 rad; S ile −0,52) altında
const aim2 = () => { const A = V.noseAimAt(hl, P2, {}); return { yw: A.y, pt: A.p, gy: A.y, gp: A.p, f: 0 }; };
step(240, aim2); shots.length = 0; step(40, () => ({ ...aim2(), fh: 1 }));
const pit2 = mean(shots.map((o) => Math.asin(o.d.y))), miss2 = mean(land(shots).map((p) => (p ? Math.hypot(p.x - P2.x, p.y - P2.y, p.z - P2.z) : 99)));
ok(pit2 < hl.st.pitch - 0.15 && miss2 < 4, 'dik aşağı hedef: burun sınırında, burun topu serbest koniyle daha aşağı', `burun ${f3(hl.st.pitch)} · mermi ${f3(pit2)} rad (${deg(pit2)}) · artıdan ${f2(miss2)} m`);
// eski istemci (gy / gp yok, pt = bakış): burun bakışı izler, top burnun yönünde −0,05 (bozulmaz)
put(hl, X0, Z0, YE, H0); step(200, { yw: YE, pt: -0.3, f: 0 }); shots.length = 0; step(30, { yw: YE, pt: -0.3, f: 0, fh: 1 });
const pit3 = mean(shots.map((o) => Math.asin(o.d.y)));
ok(shots.length > 3 && Math.abs(pit3 - (hl.st.pitch - 0.05)) < 0.03, 'eski istemci (gy / gp yok): burun bakışla eğilir, top burnun yönünde', `burun ${f3(hl.st.pitch)} · mermi ${f3(pit3)}`);
// kapı makinelisi: dik aşağı (eski sınır −1,25)
put(hl, X0, Z0, YE, H0); V.exit(s); s.pos.set(X0 + 3, W.heightAt(X0 + 3, Z0), Z0); V.enter(s, hl, 2);
s.yaw = YE - Math.PI / 2; shots.length = 0; step(40, () => ({ yw: YE - Math.PI / 2, pt: -1.5, fh: 1 }));
const pd = mean(shots.map((o) => Math.asin(o.d.y)));
ok(shots.length > 3 && pd < -1.38, 'kapı nişancısı dik aşağı', `${f3(pd)} rad (${deg(pd)}; eski en çok −1,25 = ${deg(-1.25)})`);
V.exit(s); hl.st.y = W.heightAt(X0 - 80, Z0 + 60); hl.st.x = X0 - 80; hl.st.z = Z0 + 60;

// ── 2) tank tepede, hedef 50 m ötede ~8–9° aşağıda (eski top sınırı −7°) ──
console.log('── tank topu (−10°…+20°) ──');
const t = V.list.find((x) => x.id === 'B-T1'), TX = -110, TZ = 160, TY = 0;      // düz tepe, +x yönünde 50 m'de ~8,8° aşağı (arazi taraması)
put(t, TX, TZ, TY - Math.PI / 2); s.pos.set(TX, W.heightAt(TX, TZ + 3), TZ + 3); V.enter(s, t, 0);
const foe = place(reds[0], TX + 50, TZ);
step(30, { yw: -Math.PI / 2, pt: 0 });
let booms = []; const ex0 = g.explode.bind(g); g.explode = (p, ...a) => { booms.push({ x: p.x, y: p.y, z: p.z, name: a[3] }); return ex0(p, ...a); };
const camAim = () => { const c = foe.center(), cam = { x: t.st.x - 10, y: t.st.y + 4, z: t.st.z }, L = Math.hypot(c.x - cam.x, c.y - cam.y, c.z - cam.z); return V.gunAimFor(t, cam, { x: (c.x - cam.x) / L, y: (c.y - cam.y) / L, z: (c.z - cam.z) / L }, s, {}); };
let A = camAim(); step(200, () => ({ yw: A.y, pt: A.p, gy: A.y, gp: A.p }));
A = camAim(); t.rl = 0; booms = []; step(1, { yw: A.y, pt: A.p, gy: A.y, gp: A.p, fh: 1, fp: 1 });
for (let n = 0; V.shells.length && n < 300; n++) step(1, { gy: A.y, gp: A.p });
const bt = booms.find((b) => b.name === VT.tank.cannon.name), tm = bt ? Math.hypot(bt.x - foe.pos.x, bt.z - foe.pos.z) : 99;
ok(A.p < -0.12 && t.st.gp < -0.12 && tm < 3 && !foe.alive, 'tepeden aşağıdaki hedef: top −7°\'nin altına iner, isabet', `gerekli ${f3(A.p)} rad (${deg(A.p)}) · top ${f3(t.st.gp)} · gövde ${f3(t.st.pitch)} · patlama hedeften ${f2(tm)} m · hedef ${foe.alive ? 'sağ' : 'öldü'}`);
ok(VT.tank.turret.gunMin <= -0.174 && VT.tank.turret.gunMax >= 0.349, 'tank top sınırı gövdeye göre −10°…+20°', `${deg(VT.tank.turret.gunMin)} … ${deg(VT.tank.turret.gunMax)}`);
V.exit(s);

// ── 3) jip makinelisi: düzde −0,5 rad (eski −0,35), yan yatık jipte aşağı yandaki hedefe gövdeye göre ──
console.log('── jip makinelisi ──');
const j = V.list.find((x) => x.id === 'B-J1'), JX = -600, JZ = 330;          // yan eğim ~0,24 (z yönünde alçalır), jip +x'e bakar → yatık
put(j, 292, -376, YE); s.pos.set(295, W.heightAt(295, -376), -376); V.enter(s, j, 1);
s.yaw = 0; shots.length = 0; step(30, { yw: 0, pt: -1.2, fh: 1 });
const pj0 = mean(shots.map((o) => Math.asin(o.d.y)));
ok(shots.length > 3 && pj0 < -0.45, 'jip makinelisi düzde aşağı', `${f3(pj0)} rad (${deg(pj0)}; eski −0,35 = ${deg(-0.35)})`);
V.exit(s); put(j, JX, JZ, YE); step(90);
s.pos.set(JX + 3, W.heightAt(JX + 3, JZ), JZ); V.enter(s, j, 1);
const roll = j.st.roll, look = bodyPitchAlong(j.st, Math.PI) < bodyPitchAlong(j.st, 0) ? Math.PI : 0, bp = bodyPitchAlong(j.st, look);      // aşağı yan (gövdenin o yöndeki eğimi negatif)
const expP = mgPitch(j.st, j.def.mg, look, -1.2), oldP = -0.35;
shots.length = 0; step(30, { yw: look, pt: -1.2, fh: 1 });
const pj1 = mean(shots.map((o) => Math.asin(o.d.y)));
console.log(`   jip ${f2(j.st.x)}, ${f2(j.st.z)} · yatış ${f3(roll)} rad (${deg(roll)}) · eğim ${f3(j.st.pitch)} · bakış yönü ${look ? '+z' : '−z'}, gövdenin o yöndeki eğimi ${f3(bp)}`);
ok(bp < -0.1 && shots.length > 3 && pj1 < oldP - 0.2 && Math.abs(pj1 - expP) < 0.03, 'yan yatık jipte makineli aşağı yandaki hedefe (sınır gövdeye göre)', `mermi ${f3(pj1)} rad (${deg(pj1)}) · beklenen ${f3(expP)} · eski dünya sınırı ${deg(oldP)}`);

console.log(JSON.stringify({ heli: R1, coneDown: pit2, door: pd, tank: { need: A.p, gp: t.st.gp, miss: tm }, jeep: { flat: pj0, roll, slope: pj1 } }));
console.log(fails ? `sonuç: HATA ${fails}` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
