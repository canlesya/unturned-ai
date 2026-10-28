// 12.204 arazi motosikleti denetimi — node scripts/mototest.mjs
//   1) başsız: doğuş yerleri (zemin / kutu / ağaç / su / araç), azami hız + ivme + dönüş (jiple karşılaştırma; düz deneme dünyası + Kuzey yolu),
//      rampadan zıplama, devrilme (hafif: kalkar, binici kalır · sert: binici savrulur + hasar, motor yatıp doğrulur), su (stop → durur, derinde batar),
//      sürücü ateş edemez / arka yolcu kendi silahıyla eder, biniciye mermi (açıkta), motor canı (mermi / RPG), ~20 sn yeniden doğuş, ağ durumu,
//      botlar (uzak bayrağa motorla, yakında iner; hepsini kapmaz; insan yakındaysa almaz).
//   2) çevrim içi (WS erişilebilirse; yerel debug sunucu): istemci motoru sürer (tahmin düzeltmesi küçük), sunucu kazası istemciye yansır.
// Ortam: WS (ws://127.0.0.1:8970) · ONLY=headless|online
import { Game } from '../src/game/game.js';
import { VT, stepVehicle, makeVehicle, packVehState, applyVehState, obbBox } from '../src/sim/vehicle.js';
import { MOTO_SPAWNS } from '../src/maps/motoSpawns.js';
import { MOTO_BOT } from '../src/game/motorbike.js';
import WebSocket from 'ws';

const WS = process.env.WS || 'ws://127.0.0.1:8970', ONLY = process.env.ONLY || '';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2), kmh = (v) => Math.round(v * 3.6);
const mkG = (o = {}) => new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 16, type: 'conquest' }, ...o });

// düz deneme dünyası (saf fizik: arazi h(x, z), kutu yok)
const flat = (h = () => 0, cols = []) => ({ heightAt: h, query: (x0, z0, x1, z1, out = []) => { out.length = 0; for (const c of cols) if (c.max[0] > x0 && c.min[0] < x1 && c.max[2] > z0 && c.min[2] < z1) out.push(c); return out; }, terrain: null, bounds: null });
function topSpeed(type, W, secs = 20) {
  const v = makeVehicle(type, 0, 0, 0, 0); let mx = 0, t60 = -1;
  for (let i = 0; i < secs * 60; i++) { stepVehicle(v, { f: 1, r: 0 }, 1 / 60, W); const sp = Math.hypot(v.vx, v.vz); mx = Math.max(mx, sp); if (t60 < 0 && sp >= 60 / 3.6) t60 = i / 60; }
  return { mx, t60 };
}
function turn(type, W, sp0) {
  const v = makeVehicle(type, 0, 0, 0, 0);
  v.vz = -sp0;
  let yaw0 = 0;
  for (let i = 0; i < 120; i++) { stepVehicle(v, { f: 0.35, r: 1 }, 1 / 60, W); if (i === 59) yaw0 = v.yaw; }
  return Math.abs(((v.yaw - yaw0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);      // rad/sn (ikinci 1 sn; ±π sarması açılır)
}

function headless() {
  console.log('── başsız ──');
  // ─ doğuşlar ─
  {
    const g = mkG(), V = g.vehicles, W = g.world, T = W.terrain;
    for (const o of g.mode.objectives) o.owner = 'blue';
    for (const v of V.list) if (v.def.moto && !v.alive) V.trySpawn(v, true);
    const motos = V.list.filter((v) => v.def.moto);
    ok(motos.length === MOTO_SPAWNS.kuzey.length && motos.every((v) => v.alive), 'Kuzey: tüm motor doğuşları kuruldu (üs 4 + 4, bayrak 8, yol 4)', `${motos.length} motor`);
    const bad = [];
    for (const v of motos) {
      const st = v.st, h = W.heightAt(st.x, st.z), why = [];
      if (Math.abs(st.y - h) > 0.25) why.push('zemin ' + f2(st.y - h));
      if (Math.abs(st.pitch) > 0.2 || Math.abs(st.roll) > 0.25) why.push('eğim');
      const wy = T.waterY ? T.waterY(st.x, st.z) : -Infinity; if (wy > st.y - 0.05) why.push('su');
      for (const c of W.query(st.x - 2, st.z - 2, st.x + 2, st.z + 2, [])) { if (c.nocar || c.max[1] <= st.y + 0.12 || c.min[1] >= st.y + 2.4) continue; if (obbBox({ ...st, def: { ...v.def, hl: v.def.hl + 0.3, hw: v.def.hw + 0.3 } }, c)) { why.push('kutu'); break; } }
      for (const sp of g.map.sight || []) if (Math.hypot(sp[0] - st.x, sp[2] - st.z) < sp[3] + 1.2 && sp[1] - sp[3] < st.y + 2.4) { why.push('ağaç'); break; }
      for (const o of V.list) if (o !== v && !o.def.moto && o.spawn && Math.hypot(o.spawn.x - v.spawn.x, o.spawn.z - v.spawn.z) < 9) { why.push('araç ' + o.id); break; }
      if (why.length) bad.push(v.id + ':' + why.join('/'));
    }
    ok(!bad.length, 'motor yerleri: zeminde, düz, ayak izinde kutu / ağaç / su / başka araç doğuşu yok', bad.join(' ') || `${motos.length} yer`);
    const others = ['kasaba', 'us', 'colgecidi'].map((map) => map + ':' + (mkG({ map, match: { perTeam: 2, type: 'conquest' } }).vehicles ? 'VAR' : 'yok'));
    ok(others.every((s) => s.endsWith('yok')), 'araçsız haritalara motor eklenmedi (yalnız Kuzey Vadisi araçlı)', others.join(' '));
  }
  // ─ hız / çeviklik (düz dünya) ─
  {
    const W = flat(), m = topSpeed('moto', W), j = topSpeed('jip', W);
    ok(m.mx > j.mx * 1.25, 'azami hız (düz): motor jipten hızlı', `motor ${f1(m.mx)} m/sn = ${kmh(m.mx)} km/s · jip ${f1(j.mx)} m/sn = ${kmh(j.mx)} km/s`);
    ok(m.t60 > 0 && m.t60 < j.t60, '0–60 km/s ivme: motor jipten çevik', `motor ${f2(m.t60)} sn · jip ${f2(j.t60)} sn`);
    const tm = turn('moto', W, 10), tj = turn('jip', W, 10), tm2 = turn('moto', W, 25), tj2 = turn('jip', W, 20);
    ok(tm > tj * 1.15, 'dönüş (10 m/sn, tam direksiyon): motor jipten keskin', `motor ${f2(tm)} rad/sn · jip ${f2(tj)} rad/sn · yüksek hız: motor 25 m/sn ${f2(tm2)} · jip 20 m/sn ${f2(tj2)}`);
    // rampa: 12 m'de 2,4 m yükselen rampa, sonra düz → havada süre / uzunluk
    const ramp = flat((x, z) => (z < 0 && z > -12 ? (-z) * 0.2 : 0));
    const jump = (type, sp) => { const v = makeVehicle(type, 0, 0, 6, 0); v.vz = -sp; let air = 0, z0 = null, z1 = null, top = 0; for (let i = 0; i < 300; i++) { stepVehicle(v, { f: 0.6, r: 0 }, 1 / 60, ramp); if (v.air) { air++; if (z0 == null) z0 = v.z; z1 = v.z; top = Math.max(top, v.y - ramp.heightAt(v.x, v.z)); } } return { t: air / 60, L: z0 == null ? 0 : z0 - z1, top }; };
    const jm = jump('moto', 22), jj = jump('jip', 22);
    ok(jm.t > 0.5 && jm.L > jj.L, 'rampadan zıplama (22 m/sn, %20 rampa)', `motor havada ${f2(jm.t)} sn · ${f1(jm.L)} m · tepe ${f2(jm.top)} m · jip ${f2(jj.t)} sn · ${f1(jj.L)} m`);
  }
  // ─ sığ su (deneme dünyası: düz zemin, z < −10'da 0,7 m su; Kuzey'de düz sığ su yok) ─
  {
    const Ws = { ...flat(), terrain: { waterY: (x, z) => (z < -10 ? 0.7 : -Infinity) } };
    const run = (type) => { const v = makeVehicle(type, 0, 0, 0, 0); v.vz = -12; let zs = null; for (let i = 0; i < 600; i++) { stepVehicle(v, { f: 1, r: 0 }, 1 / 60, Ws); if (zs == null && v.stall) zs = v.z; } return { v, zs, sp: Math.hypot(v.vx, v.vz) }; };
    const m = run('moto'), j = run('jip');
    ok(m.v.stall && m.sp < 0.3 && !m.v.sunk && m.zs != null && m.zs - m.v.z < 6, 'sığ su (0,7 m, düz): 12 m/sn giren motor stop eder, birkaç m içinde durur, batmaz; jip geçer', `motor suda ${f1(m.zs - m.v.z)} m gidip durdu · jip ${f1(-10 - j.v.z)} m ilerledi (hız ${f1(j.sp)} m/sn)`);
  }
  // ─ çevrim içi durum paketi ─
  {
    const v = makeVehicle('moto', 1, 2, 3, 0.4); v.fall = 1.234; v.fallK = -2;
    const a = packVehState(v), b = makeVehicle('moto', 0, 0, 0, 0); applyVehState(b, a);
    ok(b.fall === 1.234 && b.fallK === -2 && b.x === 1 && a.length === 13, 'ağ: tahmin durumu devrik süresi + türünü taşır', JSON.stringify(a));
  }
  // ─ gerçek harita: sürüş, kaza, su, koltuklar, hasar, doğuş ─
  const g = mkG({ match: { perTeam: 4, type: 'conquest' } }), V = g.vehicles, W = g.world;
  const s = g.claimSlot('blue', 'Test', 'assault', {}), h = g.humans.get(s.id);
  let q = 0;
  const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: 0, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...(typeof o === 'function' ? o(i) : o) }); g.step(1 / 60); } };
  const put = (v, x, z, yaw, sp = 0) => { const st = v.st; st.x = x; st.z = z; st.y = W.heightAt(x, z); st.yaw = yaw; st.vx = -Math.sin(yaw) * sp; st.vz = -Math.cos(yaw) * sp; st.vy = 0; st.air = false; st.sunk = false; st.fall = 0; st.fallK = 0; st.pitch = st.roll = 0; v.sleep = false; };
  const v = V.list.find((x) => x.id === 'B-M1'), jeep = V.list.find((x) => x.id === 'B-J1');
  // her alt denetim temiz başlar: araç doğuşunda yeni, oyuncu canlı, yanında, sürücü koltuğunda
  const fresh = (veh = v, x, z, yaw) => {
    for (const o of V.occupants(veh)) V.exit(o);
    if (s.veh) V.exit(s);
    if (!s.alive) g.respawn(s);
    s.hp = 100; s.protT = 0;
    veh.alive = false; veh.wreck = false; veh.st = null; V.trySpawn(veh, true);
    if (x != null) put(veh, x, z, yaw);
    s.pos.set(veh.st.x + 1.2, veh.st.y, veh.st.z); step(1, { ve: 1 }); step(1);
    return s.veh === veh;
  };
  s.pos.set(v.st.x + 1.2, v.st.y, v.st.z); s.protT = 0; step(2);
  ok(V.near(s)?.v === v && V.near(s).seat === 0, 'yanında: binilebilir = B-M1, sürücü');
  step(1, { ve: 1 }); step(1);
  ok(s.veh === v && s.seat === 0, 'E: motorun sürücüsü', `boy ${s.height}`);
  // Kuzey'in en uzun düz yolu (R13, Kırmızı üs kapısı → Kavşak yönü, 370 m, %5 yokuş aşağı): 12 sn tam gaz, motor ↔ jip
  const roadRun = (veh) => { const yaw = Math.atan2(-(-26 + 105), -(-255 + 614)); fresh(veh, -105, -614, yaw); let mx = 0, t60 = -1; step(720, (i) => { const sp = V.speed(veh); mx = Math.max(mx, sp); if (t60 < 0 && sp > 60 / 3.6) t60 = i / 60; return { f: 1, yw: yaw }; }); return { mx, t60, d: Math.hypot(veh.st.x + 105, veh.st.z + 614) }; };
  const mR = roadRun(v), jR = roadRun(jeep);
  for (const o of V.occupants(jeep)) V.exit(o);
  ok(mR.mx > jR.mx * 1.2, 'Kuzey yolu R13 (370 m düz, 12 sn tam gaz): motor jipten hızlı', `motor ${kmh(mR.mx)} km/s (0–60 ${f2(mR.t60)} sn, ${Math.round(mR.d)} m) · jip ${kmh(jR.mx)} km/s (0–60 ${f2(jR.t60)} sn, ${Math.round(jR.d)} m)`);
  fresh(v, 150, 652, Math.PI);
  // sürücü ateş edemez
  const mag0 = s.item.mag; ok(!s.tryFire() && s.item.mag === mag0, 'sürücü ateş edemez (silah yok, sol tık korna)');
  // arka yolcu (bot) kendi silahıyla ateş eder
  const pas = g.soldiers.find((e) => e.team === 'blue' && e !== s); pas.vacant = false; pas.spawn({ x: v.st.x - 1.2, z: v.st.z, ry: 0 }, 0); W.settle(pas); pas.protT = 0;
  V.enter(pas, v, 1); pas.reloadT = 0; const pm = pas.item.mag; for (let i = 0; i < 20; i++) { pas.tryFire(); g.step(1 / 30); }
  ok(pas.veh === v && pas.seat === 1 && pas.item.mag < pm, 'arka yolcu (koltuk 2) kendi piyade silahıyla ateş eder', `şarjör ${pm} → ${pas.item.mag}`);
  // biniciye mermi: açıkta (düşman askerden göğse ışın)
  const red = g.soldiers.find((e) => e.team === 'red'); red.vacant = false; red.spawn({ x: v.st.x + 25, z: v.st.z, ry: Math.PI / 2 }, 0); W.settle(red); red.protT = 0;
  const hit = (tg) => { const c = tg.center({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }); const e = red.eye(), d = { x: c.x - e.x, y: c.y + 0.25 - e.y, z: c.z - e.z }, L = Math.hypot(d.x, d.y, d.z); d.x /= L; d.y /= L; d.z /= L; const vr = V.raycast(e, d, L + 1); const sh = g.hitSoldier(tg, e, d, L + 1); return { veh: vr ? vr.t : 1e9, sol: sh ? sh.t : 1e9 }; };
  const hr = hit(s);
  ok(hr.sol < hr.veh, 'sürücü açıkta: yandan göğse ışın önce askere değer (motor gövdesi binicinin belinin altında)', `asker ${f2(hr.sol)} m · motor ${hr.veh > 1e8 ? '—' : f2(hr.veh)} m`);
  const hp0 = v.hp; V.damage(v, 30, red, 'bullet');
  ok(Math.abs(hp0 - v.hp - 30 * VT.moto.bulletMul) < 0.01, `motor zayıf: ${VT.moto.hp} can, mermi × ${VT.moto.bulletMul} (≈ ${Math.ceil(VT.moto.hp / (30 * VT.moto.bulletMul))} tüfek mermisi; jip ${VT.jip.hp} can × ${VT.jip.bulletMul})`, f1(hp0 - v.hp));
  v.hp = VT.moto.hp;
  // sert kaza: Mavi üs duvarına (z ≈ 628) 22 m/sn → iki binici savrulur + hasar, motor yatar, sonra doğrulur
  pas.hp = 100; put(v, 60, 642, 0, 22); s.hp = 100; for (const o of V.occupants(v)) V.place(o);
  let crashAt = -1, maxFall = 0, k = 0, ep = 0, was = false;
  step(240, (i) => { if (crashAt < 0 && !s.veh) crashAt = i; maxFall = Math.max(maxFall, Math.abs(v.st.fallK || 0)); const on = v.st.fall > 0; if (on && !was) ep++; if (on && ep === 1) k++; was = on; return { f: 1 }; });
  ok(crashAt > 0 && !s.veh && !pas.veh && s.hp < 100 && pas.hp < 100 && maxFall === 2, 'sert kaza (duvara 22 m/sn): sürücü + yolcu savrulur, hasar alır, motor yere yatar', `kaza ${f2(crashAt / 60)} sn · sürücü ${Math.round(s.hp)} · yolcu ${Math.round(pas.hp)} · motor ${Math.round(v.hp)} can`);
  ok(v.alive && !(v.st.fall > 0) && k / 60 > 2 && k / 60 < 2.6, 'devrilen motor ' + VT.moto.fallT + ' sn yatıp kendiliğinden doğrulur (boş)', `${f2(k / 60)} sn yerde`);
  // hafif devrilme: 9 m/sn duvara → binici kalır, motor ~1 sn yatar, kalkar
  fresh(v, 60, 642, 0);
  put(v, 60, 638, 0, 9.5); for (const o of V.occupants(v)) V.place(o);
  let soft = 0, maxK = 0; step(150, () => { if (v.st.fall > 0) soft++; maxK = Math.max(maxK, Math.abs(v.st.fallK || 0)); return { f: 0 }; });
  ok(s.veh === v && maxK === 1 && soft / 60 > 0.8 && soft / 60 < 1.4, 'hafif devrilme (9,5 m/sn): binici koltukta kalır, motor ~1 sn yan yatıp toparlanır', `${f2(soft / 60)} sn · ${s.veh ? 'koltukta' : 'düştü'}`);
  // su (Kuzey'de su yalnız baraj gölü: kıyısı dik) → baraj kıyısından suya 9 m/sn: motor stop eder, yamaçtan kayıp batar, sürücü iner
  const T = W.terrain; let bank = null;
  for (let x = 640; x < 780 && !bank; x += 1) for (let z = -160; z < 40 && !bank; z += 1) {
    const wy = T.waterY ? T.waterY(x, z) : -Infinity; if (!(wy > -1e9)) continue;
    if (wy - W.heightAt(x, z) > 0.3) continue;
    for (let k = 0; k < 8 && !bank; k++) { const q = (k / 8) * Math.PI * 2, x2 = x + Math.cos(q) * 6, z2 = z + Math.sin(q) * 6; if (T.waterY(x2, z2) - W.heightAt(x2, z2) > 1.5) { const x0 = x - Math.cos(q) * 10, z0 = z - Math.sin(q) * 10; if (!(T.waterY(x0, z0) > W.heightAt(x0, z0) - 0.02) && Math.abs(W.heightAt(x0, z0) - W.heightAt(x, z)) < 2.5) bank = [x0, z0, Math.atan2(-Math.cos(q), -Math.sin(q))]; } }
  }
  if (bank) {
    fresh(v, bank[0], bank[1], bank[2]); put(v, bank[0], bank[1], bank[2], 9); for (const o of V.occupants(v)) V.place(o);
    let stall = -1, t = 0, ex = -1; while (v.alive && t < 12) { step(6, { f: 1, yw: bank[2] }); t += 0.1; if (stall < 0 && v.st.stall) stall = t; if (ex < 0 && !s.veh) ex = t; }
    ok(stall > 0 && ex > 0 && !v.alive, 'baraj gölü (dik kıyı): suya giren motor stop eder, yamaçtan kayıp batar, sürücü iner, motor gider', `kıyı ${bank.slice(0, 2).map(Math.round)} · stop ${f1(stall)} sn · iniş ${f1(ex)} sn · gitti ${f1(t)} sn`);
  } else ok(false, 'baraj kıyısı bulunamadı');
  // ~20 sn yeniden doğuş (patlama)
  fresh(v); V.exit(s); s.pos.set(v.st.x + 30, v.st.y, v.st.z);
  V.destroy(v, red);
  let tr = 0; while (!v.alive && tr < 40) { g.step(0.1); tr += 0.1; }
  ok(v.alive && tr > 17 && tr < 23 && Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) < 0.5, 'patlayan motor ~20 sn sonra doğuşunda yenilenir', `${f1(tr)} sn`);
  // RPG: tek atış
  const P = (x, y, z) => ({ x, y, z, clone() { return P(this.x, this.y, this.z); }, distanceTo: () => 99 });
  g.explode(P(v.st.x, v.st.y + 0.8, v.st.z - 0.8), 6.5, 160, red, 'RPG-7');
  ok(!v.alive, 'RPG: motor tek atışta patlar');
  // ─ botlar ─
  bots();
}

function bots() {
  // senaryo: Mavi üste 8 bot, mangal hedefi uzak bayrak (Kavşak ~630 m), insan yok → motorların en çok 3'ü botlarda; yakında iner
  const sc = (withHuman) => {
    const g = mkG({ bots: true, match: { perTeam: 8, type: 'conquest' } }), V = g.vehicles;
    g.assignSquads = () => {};
    const o = g.mode.objectives.find((q) => q.id === 'C');
    g.squadGoals.blue = [o, o, o]; g.squadGoals.red = [o, o, o];
    for (const v of V.list) if (!v.def.moto) v.botBad = 1e9;                 // yalnız motorlar (jip / tank / helikopter bu denetimin dışında)
    const blue = g.soldiers.filter((e) => e.team === 'blue' && e.brain), red = g.soldiers.filter((e) => e.team === 'red');
    for (const e of red) { e.vacant = true; e.alive = false; }
    g.brains = g.brains.filter((b) => b.s.team === 'blue');
    blue.forEach((e, i) => { e.pos.set(126 + (i % 4) * 3, 0, 650 + Math.floor(i / 4) * 3); W(g).settle(e); e.protT = 0; });
    let hu = null;
    if (withHuman) { hu = g.claimSlot('blue', 'İnsan', 'assault', {}); hu.pos.set(138, W(g).heightAt(138, 648), 648); hu.protT = 0; }
    return { g, V, o, blue, hu };
  };
  const W = (g) => g.world;
  {
    const { g, V, o, blue } = sc(false);
    const motos = V.list.filter((v) => v.def.moto && v.team === 'blue' && v.spawn.team === 'blue');
    let maxBusy = 0, rode = new Set(), exits = [], arrive = [];
    const human = g.humans.size;
    for (let i = 0; i < 90 * 30; i++) {
      g.step(1 / 30);
      const n = motos.filter((v) => v.seats[0]).length; maxBusy = Math.max(maxBusy, n);
      for (const v of motos) if (v.seats[0]) rode.add(v.seats[0]);
      for (const e of blue) if (e.alive && !e.veh && rode.has(e) && !e._ex) { e._ex = true; exits.push(Math.round(Math.hypot(e.pos.x - o.x, e.pos.z - o.z))); }
    }
    const S = g.vbStats || {};
    for (const t of S.trips || []) if (t.k === 'moto') arrive.push(t.why + ':' + t.left + 'm/' + t.d + 'm');
    ok(rode.size >= 2, 'botlar uzak bayrağa (Kavşak ~630 m) motorla gider', `${rode.size} bot sürdü · ${arrive.slice(0, 4).join(' ')}`);
    ok(maxBusy <= Math.floor(motos.length * MOTO_BOT.shareNoHuman) && maxBusy >= 1, `hepsini kapmazlar: takımda insan yokken üstteki ${motos.length} motorun en çok ${Math.floor(motos.length * MOTO_BOT.shareNoHuman)}'ü botlarda`, `aynı anda en çok ${maxBusy} · insan ${human}`);
    ok(exits.length >= 2 && exits.filter((d) => d < 80).length >= Math.min(2, exits.length), 'bayrağa yaklaşınca inerler (Kavşak çevresinde)', `inişte bayrağa uzaklık: ${exits.join(', ')} m`);
  }
  {
    const { g, V, hu } = sc(true);
    const motos = V.list.filter((v) => v.def.moto && v.spawn.team === 'blue');
    const near = motos.filter((v) => Math.hypot(v.st.x - hu.pos.x, v.st.z - hu.pos.z) < MOTO_BOT.humanNear);
    let maxBusy = 0, nearTaken = 0;
    const hq = g.humans.get(hu.id); let qq = 0;
    for (let i = 0; i < 40 * 30; i++) {
      hq.queue.push({ q: ++qq, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, w: hu.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0 });
      g.step(1 / 30);
      maxBusy = Math.max(maxBusy, motos.filter((v) => v.seats[0] || (v.botRes && v.botRes.s.alive)).length);
      nearTaken = Math.max(nearTaken, near.filter((v) => v.seats[0] && v.seats[0] !== hu).length);
    }
    ok(nearTaken === 0, `insan oyuncu motorların ${MOTO_BOT.humanNear} m yakınında dururken botlar o motorlara binmez (bekler)`, `yakındaki ${near.length} motor · bot binen ${nearTaken}`);
    hu.pos.set(400, g.world.heightAt(400, 400), 400);
    const blue2 = g.soldiers.filter((e) => e.team === 'blue' && e.brain && e.alive && !e.veh);
    blue2.forEach((e, i) => { e.pos.set(126 + (i % 4) * 3, 0, 650 + Math.floor(i / 4) * 3); g.world.settle(e); e.brain.goal = null; e.brain.path = null; e.brain.goalT = 0; });      // botlar yeniden üste (önceki 40 sn'de yürüyüp gittiler)
    let busy2 = 0;
    for (let i = 0; i < 40 * 30; i++) { hq.queue.push({ q: ++qq, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, w: hu.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0 }); g.step(1 / 30); busy2 = Math.max(busy2, motos.filter((v) => v.seats[0]).length); }
    ok(busy2 >= 1 && busy2 <= Math.floor(motos.length * MOTO_BOT.share), `insan uzaklaşınca botlar alır ama takımda insan varken en çok yarısını (${Math.floor(motos.length * MOTO_BOT.share)})`, `aynı anda en çok ${busy2}`);
  }
}

// ───────── 2) çevrim içi ─────────
async function online() {
  console.log('── çevrim içi ──');
  const up = await new Promise((res) => { const w = new WebSocket(WS); w.on('open', () => { w.close(); res(true); }); w.on('error', () => res(false)); setTimeout(() => res(false), 2000); });
  if (!up) { console.log('  (sunucu yok: ' + WS + ' — atlandı)'); return; }
  const { chromium } = await import('playwright');
  const URL0 = process.env.URL || 'http://127.0.0.1:5180';
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(WS)}&map=kuzey&type=conquest&per=4&team=blue&tod=day&weather=clear&debug=1&nolock=1&nologin=1`);
  await page.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier && window.__game.playerSoldier.alive && window.__game.vehicles', null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  // motorun yanına ışınla (sunucuya: { tp } debug), bin, sür
  const r0 = await page.evaluate(async () => {
    const g = window.__game, V = g.vehicles, v = V.list.find((x) => x.id === 'B-M2');
    g.online.send({ t: 'dbg', bots: false }); g.online.send({ t: 'dbg', tp: [v.st.x + 1.6, v.st.z] });
    return { id: v.id, alive: v.alive };
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__game.online.edge('ve'));
  await page.waitForTimeout(800);
  const r1 = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier; return { veh: me.veh?.id, seat: me.seat }; });
  ok(r1.veh === 'B-M2' && r1.seat === 0, 'çevrim içi: sunucu motora bindirdi (sürücü)', JSON.stringify(r1));
  // 2,6 sn tam gaz (batıya, açık çayır) + hafif sağ: tahmin düzeltmesi
  await page.mouse.click(640, 360); await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD'); await page.waitForTimeout(750);
  const r2 = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, v = me.veh, st = g.online.stats; return { sp: v ? Math.hypot(v.st.vx, v.st.vz) : 0, fix: st.vehFix || 0, errMax: st.vehErrMax || 0, errAvg: (st.vehErrSum || 0) / Math.max(1, st.vehFix || 0), pred: !!v?.pred, x: v?.st.x, z: v?.st.z }; });
  await page.screenshot({ path: '/tmp/wb-moto/cevrimici-surus.png' });
  await page.keyboard.up('KeyW'); await page.keyboard.down('Space'); await page.waitForTimeout(1500); await page.keyboard.up('Space');
  ok(r2.pred && r2.sp > 15, 'çevrim içi: kendi motorum tahminle sürülür', `hız ${Math.round(r2.sp * 3.6)} km/s · ${Math.round(r2.x)},${Math.round(r2.z)}`);
  ok(r2.errMax < 1.0, 'çevrim içi: tahmin düzeltmesi küçük (sunucu = istemci fiziği)', `düzeltme ${r2.fix} · en büyük ${f2(r2.errMax)} · ort ${f2(r2.errAvg)}`);
  // sunucuda kaza: Mavi üs duvarına yönlendir (vtp ışınla) + gaz → sunucu sürücüyü atar, istemci aracından iner
  await page.evaluate(() => { const g = window.__game; const v = g.vehicles.list.find((x) => x.id === 'B-M2'); g.online.send({ t: 'dbg', vtp: [60, 650, 0, v.idx] }); });
  await page.waitForTimeout(600);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2600); await page.keyboard.up('KeyW');
  await page.waitForTimeout(800);
  const r3 = await page.evaluate(() => { const g = window.__game, me = g.playerSoldier, v = g.vehicles.list.find((x) => x.id === 'B-M2'); return { veh: me.veh?.id || null, hp: me.hp, fallK: v.st?.fallK, alive: v.alive, x: v.st?.x, z: v.st?.z }; });
  ok(!r3.veh && r3.hp < 100, 'çevrim içi: duvara sert kaza → sunucu sürücüyü savurdu (istemci indi, hasar aldı)', JSON.stringify(r3));
  ok(!errs.length, 'çevrim içi: sayfa hatası yok', errs.slice(0, 2).join(' | '));
  await browser.close();
}

if (ONLY !== 'online') headless();
if (ONLY !== 'headless') await online();
console.log(fails ? `\n${fails} HATA` : '\nhepsi OK');
process.exit(fails ? 1 : 0);
