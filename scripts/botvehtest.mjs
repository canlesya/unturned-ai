// 12.189 bot sürücü / pilot denetimi (Kuzey Vadisi) — node scripts/botvehtest.mjs
//   1) başsız: jip (bot boş jipe yürür, sürücü olur, yakındaki arkadaşını yolcu çağırır, yol ızgarasında Kavşak'a gider, ~40 m önünde durur, iner;
//      çarpma hasarı yok) · takım arkadaşı yolda → durur / kaçar (ezmez) · tank (bot sürer, yoldaki düşman askere ana topla ateş eder, öldürür;
//      dolum + zorluk beklemesi korunur; kolay / zor karşılaştırma) · helikopter (pilot + 2 kapı nişancısı: kalkış, güvenli irtifa, bayrak
//      çevresinde yörünge, düşman üssüne girmez, hasar alınca helipade dönüp iner, kaza yok) · yanan araçtan iner · VNav kurulum süresi / rota.
//   2) çevrim içi (WS erişilebilirse; yerel debug sunucu): botlu Kuzey odası → sunucudaki bot sürücülerin araçları anlık görüntüde hareket ediyor,
//      sürücü koltuğunda bot var.   WS=ws://127.0.0.1:8973 · ONLY=headless|online
import { Game } from '../src/game/game.js';
import { vnav, vRoute, VBOT, HELI } from '../src/game/vehicleBots.js';
import WebSocket from 'ws';

const WS = process.env.WS || 'ws://127.0.0.1:8973', ONLY = process.env.ONLY || '';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f1 = (v) => (+v).toFixed(1);

// Senaryo: yalnız seçilen botlar çalışır (diğerleri boş koltuk), mangal hedefi sabit
function scen(diff = 'normal', goal = 'C') {
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff, match: { perTeam: 4, type: 'conquest' } });
  g.assignSquads = () => {};
  const o = g.mode.objectives.find((q) => q.id === goal);
  g.squadGoals.blue = [o, o]; g.squadGoals.red = [o, o];
  const blue = g.soldiers.filter((s) => s.team === 'blue'), red = g.soldiers.filter((s) => s.team === 'red');
  const keep = new Set();
  const use = (s, x, z) => { keep.add(s); s.squad = 0; s.pos.set(x, g.world.heightAt(x, z), z); s.protT = 0; return s; };
  const done = () => {
    for (const s of g.soldiers) if (!keep.has(s)) { s.vacant = true; s.alive = false; }
    g.brains = g.brains.filter((b) => keep.has(b.s) && !b.s.static);
  };
  const V = g.vehicles, byId = (id) => V.list.find((v) => v.id === id);
  const only = (...ids) => { for (const v of V.list) if (!ids.includes(v.id)) v.botBad = 1e9; };
  const impact = { n: 0, sum: 0 };
  const d0 = V.damage.bind(V);
  V.damage = (v, a, by, kind, nm) => { if (kind === 'impact' && !impact.forced) { impact.n++; impact.sum += a; } return d0(v, a, by, kind, nm); };
  const run = (secs, each) => { for (let i = 0; i < secs * 30; i++) { g.step(1 / 30); if (each && each(g.time) === true) return true; } return false; };
  return { g, o, blue, red, use, done, V, byId, only, impact, run };
}

function headless() {
  console.log('── başsız ──');
  // VNav
  {
    const S = scen(), N = vnav(S.g);
    let fail = 0, ms = 0;
    for (const v of S.V.list) { if (v.def.heli || !v.st) continue; for (const o of S.g.mode.objectives) { const t0 = performance.now(); if (!vRoute(N, v.st.x, v.st.z, o.x, o.z, VBOT.clr[v.def.cannon ? 'tank' : 'jip'])) fail++; ms = Math.max(ms, performance.now() - t0); } }
    ok(fail === 0, 'VNav: her üs araç doğuşundan her bayrağa rota (jip 1,6 m / tank 2,3 m açıklık)', `kurulum ${N.ms.toFixed(0)} ms · en uzun rota ${ms.toFixed(1)} ms · ızgara ${N.w}×${N.h}`);
  }
  // 1) jip: sürücü + çağrılan yolcu, Kavşak'a
  {
    const S = scen(), { g, blue, V } = S, v = S.byId('B-J1');
    S.only('B-J1');
    const X = S.use(blue[0], v.st.x + 6, v.st.z + 4), Y = S.use(blue[1], v.st.x + 10, v.st.z + 8);
    S.done();
    let tIn = -1, tB = -1, exitAt = null, minHp = v.hp, maxSp = 0, A = X, B = Y;
    S.run(170, (t) => {
      if (tIn < 0 && v.seats[0]) { tIn = t; A = v.seats[0]; B = A === X ? Y : X; }
      if (tB < 0 && tIn > 0 && B.veh === v) tB = t;
      if (A.veh === v) { maxSp = Math.max(maxSp, V.speed(v)); minHp = Math.min(minHp, v.hp); }
      if (tIn > 0 && !A.veh && !exitAt) exitAt = { t, d: Math.hypot(v.st.x - S.o.x, v.st.z - S.o.z) };
      if (exitAt && t - exitAt.t > 6) return true;
    });
    ok(tIn > 0 && tIn < 15, 'jip: bot boş jipe yürüyüp sürücü koltuğuna biner', `${f1(tIn)} sn`);
    ok(tB > 0 && tB < 15, 'jip: yakındaki takım arkadaşı yolcu olarak çağrılır ve biner', `${f1(tB)} sn`);
    ok(exitAt && exitAt.d < 70 && exitAt.d > 15, 'jip: Kavşak bayrağının önünde durur, sürücü iner (bayrağın içine dalmaz)', exitAt ? `${f1(exitAt.t)} sn · bayrağa ${f1(exitAt.d)} m` : 'varmadı');
    ok(S.impact.sum < 40 && minHp > 360, 'jip: yol boyunca çarpma / sert iniş hasarı yok', `çarpma ${S.impact.n} olay / ${f1(S.impact.sum)} · en düşük can ${Math.round(minHp)} · en yüksek hız ${f1(maxSp * 3.6)} km/s`);
    ok(B.alive && !B.veh, 'jip: yolcu varışta iner', `B araçta: ${!!B.veh}`);
    console.log('     vbStats', JSON.stringify({ ...g.vbStats, trips: undefined, failAt: undefined }));
  }
  // 2) takım arkadaşı yolda: jip durur / kaçar, ezmez (aynı takım hasar almaz zaten; yaklaşma mesafesi ölçülür)
  {
    const S = scen(), { g, blue, V } = S, v = S.byId('B-J1');
    S.only('B-J1');
    const A = S.use(blue[0], v.st.x + 6, v.st.z + 4), M = S.use(blue[2], 0, 0); M.static = true;
    S.done();
    let placed = false, minD = 1e9, hitT = 0;
    S.run(90, () => {
      const vd = A.brain.vd;
      if (!placed && vd?.state === 'drive' && vd.route && vd.ri > 25) {
        const p = vd.route[Math.min(vd.route.length - 1, vd.ri + 25)]; M.pos.set(p[0], g.world.heightAt(p[0], p[1]), p[1]); M.vel.set(0, 0, 0); placed = true;
      }
      if (placed) {
        M.vel.set(0, M.vel.y, 0);
        const d = Math.hypot(M.pos.x - v.st.x, M.pos.z - v.st.z), st = v.st, fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
        const lf = (M.pos.x - st.x) * fx + (M.pos.z - st.z) * fz, lr = (M.pos.x - st.x) * rx + (M.pos.z - st.z) * rz;
        minD = Math.min(minD, d);
        if (Math.abs(lf) < v.def.hl + 0.47 && Math.abs(lr) < v.def.hw + 0.47 && V.speed(v) > 2) hitT++;      // Vehicles.ramSoldiers temas koşulu
      }
      if (placed && vd?.state !== 'drive') return true;
    });
    ok(placed && hitT === 0, 'jip: yolda duran takım arkadaşına çarpmaz (yavaşlar, korna, yandan dolanır)', `merkezler arası en yakın ${f1(minD)} m · temas (> 2 m/sn) ${hitT} adım`);
  }
  // 3) tank: yoldaki düşmana ana top (normal / kolay / zor)
  for (const diff of ['normal', 'easy', 'hard']) {
    const S = scen(diff), { g, blue, red, V } = S, v = S.byId('B-T1');
    S.only('B-T1');
    const A = S.use(blue[0], v.st.x + 6, v.st.z + 5), E = S.use(red[0], 0, 0); E.static = true;
    S.done();
    const shots = [];
    const fc = V.fireCannon.bind(V); V.fireCannon = (vv, by) => { const r = fc(vv, by); if (r) shots.push(g.time); return r; };
    let placed = 0, killT = -1, dist0 = 0;
    S.run(120, (t) => {
      const vd = A.brain.vd;
      if (!placed && vd?.state === 'drive' && vd.ri > 20 && vd.route.length > vd.ri + 60) {
        // düz zemindeki rota noktası (yol setinin kenarında değil: yandan ıskalayan mermi setten aşağı düşer — gerçekçi ama denetimi şansa bağlar)
        const H = (x, z) => g.world.heightAt(x, z), flat = (p) => [[6, 0], [-6, 0], [0, 6], [0, -6]].every(([a, c]) => Math.abs(H(p[0] + a, p[1] + c) - H(p[0], p[1])) < 0.7);
        let k = vd.ri + 30; while (k < vd.route.length - 1 && k < vd.ri + 60 && !flat(vd.route[k])) k++;
        const p = vd.route[k]; E.pos.set(p[0], H(p[0], p[1]), p[1]); E.protT = 0; placed = t; dist0 = Math.hypot(E.pos.x - v.st.x, E.pos.z - v.st.z);
      }
      if (placed) E.vel.set(0, E.vel.y, 0);
      if (placed && !E.alive) { killT = t - placed; return true; }
      if (placed && t - placed > 45) return true;
    });
    const gaps = shots.slice(1).map((t, i) => t - shots[i]), minGap = gaps.length ? Math.min(...gaps) : 99;
    ok(A.veh === v && A.seat === 0 || killT > 0, `tank (${diff}): bot sürücü koltuğunda, rotada`, `durum ${A.brain.vd?.state}`);
    if (diff === 'easy') ok(shots.length >= 1, `tank (${diff}): yoldaki düşman askere ana topla ateş eder (kolayda isabet zayıf)`, `${shots.length} atış · ${killT > 0 ? f1(killT) + ' sn\'de öldürdü' : 'öldürmedi'} · ilk uzaklık ${f1(dist0)} m`);
    else ok(killT > 0 && killT < 40, `tank (${diff}): yoldaki düşman askere ana topla ateş edip öldürür`, killT > 0 ? `${f1(killT)} sn · ${shots.length} atış · ilk uzaklık ${f1(dist0)} m` : `öldürmedi · ${shots.length} atış`);
    ok(minGap >= v.def.cannon.reload + VBOT.gun[diff].cd - 0.05, `tank (${diff}): atışlar arası ≥ dolum ${v.def.cannon.reload} + bot beklemesi ${VBOT.gun[diff].cd} sn`, gaps.length ? `en kısa ${f1(minGap)} sn` : 'tek atış');
  }
  // 4) helikopter: pilot + 2 kapı nişancısı, Kavşak çevresinde yörünge, hasarla dönüş + iniş
  {
    const S = scen(), { g, blue, red, V } = S, v = S.byId('B-H1');
    S.only('B-H1');
    const crew = [S.use(blue[0], v.st.x + 8, v.st.z + 4), S.use(blue[1], v.st.x + 12, v.st.z - 6), S.use(blue[2], v.st.x - 10, v.st.z + 6)];
    let P = crew[0], nGun = 0;
    const E1 = S.use(red[0], S.o.x + 30, S.o.z + 25), E2 = S.use(red[1], S.o.x - 35, S.o.z - 20); E1.static = E2.static = true;      // bayrağın açık çevresinde (yıkık evlerin dışında)
    S.done();
    let tIn = -1, tAir = -1, tOrbit = -1, tDmg = -1, tLand = -1, minAgl = 1e9, maxAgl = 0, inBase = 0, states = new Set(), gunFire = 0, hpAtDmg = 0;
    const Z = g.map.baseZones.red;
    let nose = 0, rockets = 0;
    const mg = V.mgFire.bind(V); V.mgFire = (s, held, dt) => { const r = mg(s, held, dt); if (r) { if (s.seat === 0) nose++; else gunFire++; } return r; };
    const fr = V.fireRocket.bind(V); V.fireRocket = (vv, by) => { const r = fr(vv, by); if (r) rockets++; return r; };
    // 12.201 burun topu mermileri: çıkış pitch'i + yere / hedefe düştüğü yerin en yakın düşmana uzaklığı (burun artıyı izler, koni aşağı)
    const noseP = [], noseMiss = [], sr = g.shootRay.bind(g);
    g.shootRay = (sh, o, d, ...a) => { if (sh.veh?.def.heli && sh.seat === 0) { noseP.push(Math.asin(d.y)); const r = g.world.raycast(o, d, 400, {}), L = r ? r.t : 400, P = { x: o.x + d.x * L, z: o.z + d.z * L }; noseMiss.push(Math.min(...[E1, E2].map((e) => Math.hypot(e.pos.x - P.x, e.pos.z - P.z)))); } return sr(sh, o, d, ...a); };
    S.run(260, (t) => {
      if (tIn < 0 && v.seats[0]) { tIn = t; P = v.seats[0]; }
      nGun = Math.max(nGun, (v.seats[1] ? 1 : 0) + (v.seats[2] ? 1 : 0));
      const vd = P.brain?.vd;
      if (vd) states.add(vd.state);
      if (tAir < 0 && v.st.air && v.st.y - g.world.heightAt(v.st.x, v.st.z) > 5) tAir = t;
      if (vd && (vd.state === 'cruise' || vd.state === 'orbit')) { const a = v.st.y - g.world.heightAt(v.st.x, v.st.z); minAgl = Math.min(minAgl, a); maxAgl = Math.max(maxAgl, a); }
      if (v.st.x > Z.minX && v.st.x < Z.maxX && v.st.z > Z.minZ && v.st.z < Z.maxZ) inBase++;
      if (tOrbit < 0 && vd?.state === 'orbit') tOrbit = t;
      if (tOrbit > 0 && tDmg < 0 && t - tOrbit > 45) { tDmg = t; S.impact.forced = true; V.damage(v, v.hp - v.def.hp * 0.5, null, 'impact'); S.impact.forced = false; hpAtDmg = v.hp; }
      if (tDmg > 0 && tLand < 0 && tIn > 0 && !P.veh) { tLand = t; return true; }
    });
    const padD = Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z);
    ok(tIn > 0 && tIn < 12, 'helikopter: bot pilot helipade yürüyüp biner', `${f1(tIn)} sn`);
    ok(nGun === 2, 'helikopter: 2 kapı nişancısı çağrılır, biner', `${nGun} nişancı`);
    ok(tAir > 0 && tAir < 25, 'helikopter: rotor döner, nişancılar binince kalkar', `${f1(tAir)} sn`);
    ok(tOrbit > 0 && tOrbit < 110, 'helikopter: Kavşak çevresinde yörüngeye girer', `${f1(tOrbit)} sn`);
    ok(minAgl > 12 && maxAgl < 120, 'helikopter: seyir / yörüngede güvenli irtifa (yere / ağaca inmez)', `zeminden ${f1(minAgl)}–${f1(maxAgl)} m`);
    ok(gunFire > 0 && E1.deaths + E2.deaths > 0, 'helikopter: kapı nişancıları bayraktaki düşmana ateş eder, öldürür', `${gunFire} mermi · düşman ölümü ${E1.deaths + E2.deaths}`);
    ok(nose > 0, 'helikopter: pilot saldırı dalışında burun topunu kullanır (12.188 API: mgFire koltuk 0)', `${nose} burun mermisi · ${rockets} roket (roket yalnız araca / 2+ kişilik kümeye)`);
    const np = noseP.length ? noseP.reduce((a, b) => a + b, 0) / noseP.length : 0, near = noseMiss.filter((m) => m < 6).length;
    ok(noseP.length > 0 && np < -0.15 && near >= noseP.length * 0.3, 'helikopter: bot pilot (12.201 nişan sistemi) burun topuyla AŞAĞIDAKİ hedefe sıkar', `çıkış pitch ort. ${np.toFixed(3)} rad (${(np * 57.3).toFixed(1)}°) · en dik ${(Math.min(...noseP) * 57.3).toFixed(1)}° · ${near}/${noseP.length} mermi düşmanın 6 m yakınına`);
    ok(inBase === 0, 'helikopter: düşman üssüne girmez', `${inBase} adım`);
    ok(tLand > 0 && padD < 30 && v.alive, 'helikopter: hasar alınca (%50) helipade döner, iner, pilot iner', tLand > 0 ? `${f1(tLand - tDmg)} sn · pada ${f1(padD)} m · can ${Math.round(v.hp)}/${Math.round(hpAtDmg)}` : `inmedi · durumlar ${[...states].join(',')}`);
    ok(S.impact.sum < 60, 'helikopter: çarpma / sert iniş hasarı yok', `${S.impact.n} olay / ${f1(S.impact.sum)}`);
  }
  // 5) yanan araç: bot sürücü iner
  {
    const S = scen(), { g, blue, V } = S, v = S.byId('B-J2');
    S.only('B-J2');
    const A = S.use(blue[0], v.st.x + 5, v.st.z + 3);
    S.done();
    let burnT = -1, outT = -1, sp = 0;
    S.run(60, (t) => {
      if (burnT < 0 && A.brain.vd?.state === 'drive' && A.brain.vd.t > 6) { sp = V.speed(v); V.damage(v, v.hp - v.def.hp * 0.2, null, 'impact'); burnT = t; }
      if (burnT > 0 && !A.veh) { outT = t - burnT; return true; }
    });
    ok(outT >= 0 && outT < 3 && A.alive, 'yanan jipten bot sürücü hemen iner', outT >= 0 ? `${f1(outT)} sn · hız ${f1(sp)} m/sn · can ${Math.round(A.hp)}` : 'inmedi');
  }
}

async function online() {
  console.log('── çevrim içi ──');
  const ws = await new Promise((res, rej) => { const w = new WebSocket(WS); w.msgs = []; w.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'snap' || m.t === 'welcome') w.msgs.push(m); }); w.on('open', () => res(w)); w.on('error', rej); });
  ws.send(JSON.stringify({ t: 'create', name: 'Test', cfg: { map: 'kuzey', type: 'conquest', perTeam: 8, bots: true, time: 900 } }));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let wl = null; for (let i = 0; i < 150 && !wl; i++) { await wait(100); wl = ws.msgs.find((m) => m.t === 'welcome'); }
  ok(!!wl, 'oda kuruldu (kuzey, 8v8 botlu)');
  await wait(45000);
  const snaps = ws.msgs.filter((m) => m.t === 'snap');
  const first = new Map(), last = new Map();
  for (const m of snaps) for (const a of m.vh || []) { if (!first.has(a[0])) first.set(a[0], a); last.set(a[0], a); }
  let moved = 0, maxD = 0;
  for (const [i, a] of last) { const b = first.get(i), d = Math.hypot(a[1] - b[1], a[3] - b[3]); if (d > 60) moved++; maxD = Math.max(maxD, d); }
  let drv = 0, air = 0;
  const lastS = snaps[snaps.length - 1];
  for (const s of lastS?.s || []) if (s.v && (s.v - 1) % 4 === 0) drv++;
  for (const a of last.values()) if (a[12] & 2) air++;
  ok(snaps.length > 100, 'anlık görüntü akıyor', `${snaps.length}`);
  ok(moved >= 3, 'çevrim içi: sunucudaki bot sürücülerin araçları hareket ediyor (anlık görüntüde)', `${moved} araç > 60 m · en uzak ${f1(maxD)} m · son anda sürücü koltuğunda ${drv} asker · havada ${air}`);
  ws.close();
}

if (ONLY !== 'online') headless();
if (ONLY !== 'headless') { try { await online(); } catch (e) { console.log('çevrim içi atlandı:', e.message); if (ONLY === 'online') fails++; } }
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
