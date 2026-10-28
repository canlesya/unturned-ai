// 12.177 araç (jip) denetimi — tek koşu:   node scripts/vehicletest.mjs
//   1) başsız (tarayıcısız, her zaman): kurulum, bin / in / sür / fren / koltuk, köprü, sığ geçit, derin su (batma), mermi / RPG hasarı, yanma +
//      patlama (içindeki ölür, öldürme yazılır), yeniden doğuş, yayaya çarpma (düşman ölür, takım arkadaşı yalnız itilir), gövdeden itme, savaş alanı
//      sınırı, bot yolcu (biner / iner), diğer haritalarda araç yok, adım maliyeti, ağ paketi.
//   2) tarayıcı çevrimdışı (URL erişilebilirse; vite): görüntüler → OUT/ (dışarıdan, sürücü içeriden / takip, yolcu, gece farları, hasarlı / yanan /
//      enkaz, su, telefon), sayfa hatası 0.
//   3) çevrim içi (SRV erişilebilirse; yerel debug sunucu: PORT=8941 ADMIN_PORT=8942 BF_DATA=/tmp/wb-x BF_DEBUG=1 node server/index.js): A sürer, B yolcu:
//      koltuklar, sürücü tahmin düzeltmesi, B'nin gördüğü araç ↔ A (gecikme kaydırmalı), bant genişliği (park ↔ sürüş), hareketli araçtan yolcu isabeti,
//      araç patlayınca iki istemcide enkaz + içindekiler ölür.
// Ortam: URL (http://127.0.0.1:5397) · SRV (ws://127.0.0.1:8941) · OUT (/tmp/wb-arac/jip) · ONLY=headless|browser|online
import { Game } from '../src/game/game.js';
import { VT, groundAt } from '../src/sim/vehicle.js';
import { WSTATS } from '../src/game/stats.js';
import fs from 'fs';

const URL0 = process.env.URL || 'http://127.0.0.1:5397', SRV = process.env.SRV || 'ws://127.0.0.1:8941', OUT = process.env.OUT || '/tmp/wb-arac/jip', ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2);

// ───────── 1) başsız ─────────
function headless() {
  console.log('── başsız ──');
  const mkG = (o = {}) => new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 4, type: 'conquest' }, ...o });
  const g = mkG(), V = g.vehicles;
  { // 12.200: 36 araç — üs 10 jip + 4 tank + 4 helikopter, bayrak 13 jip (bayrak alınınca), yol kenarı 5 tarafsız jip (baştan)
    const VL = V ? V.list.filter((v) => !v.def.moto && !v.def.fixed) : [];      // 12.213: sabit yuvalar ayrı (scripts/towertest.mjs)      // 12.204: motorlar ayrı (scripts/mototest.mjs)
    const flagN = g.map.vehicles.filter((d) => VT[d.type] && !VT[d.type].moto && String(d.team).startsWith('flag:')).length, all = g.map.vehicles.filter((d) => VT[d.type] && !VT[d.type].moto).length;
    ok(V && VL.length === all && all >= 36 && VL.filter((v) => v.alive).length === all - flagN, 'kurulum: üs jip / tank / helikopter + tarafsız yol jipleri maç başında hazır, bayrak jipleri bayrak alınınca (12.200: 36 araç)', V ? `${VL.length} / ${VL.filter((v) => v.alive).length} · bayrak ${flagN}` : 'yok');
  }
  const others = [['kasaba', 'conquest'], ['colgecidi', 'tdm'], ['vadi', 'conquest']].map(([map, type]) => { const o = new Game(null, { headless: true, map, tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 2, type } }); return map + '/' + type + ':' + (o.vehicles ? 'VAR' : 'yok'); });
  ok(others.every((s) => s.endsWith('yok')), 'diğer haritalar: araç yöneticisi yok (davranış aynı)', others.join(' '));
  { // 12.219 Kuzey TDM: bütün harita araçlı — Ele Geçirme ile aynı liste (sıra aynı), bayrak araçları baştan TARAFSIZ (bayrak yok)
    const gt = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 4, type: 'tdm' } }), VT2 = gt.vehicles;
    const ids = (G) => G.vehicles.list.map((v) => v.id).join(',');
    const fl = VT2 ? VT2.list.filter((v) => String(v.spawn.team).startsWith('flag:')) : [];
    ok(VT2 && ids(gt) === ids(g) && fl.length > 0 && fl.every((v) => v.alive && v.team === null) && VT2.list.every((v) => v.alive), 'Kuzey TDM: araç listesi Ele Geçirme ile aynı, hepsi maç başında hazır, bayrak araçları tarafsız (12.219)', VT2 ? `${VT2.list.length} araç · tarafsız bayrak aracı ${fl.length}` : 'yok');
  }
  const s = g.claimSlot('blue', 'Test', 'assault', {}), h = g.humans.get(s.id);
  let q = 0;
  const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: 0, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...(typeof o === 'function' ? o(i) : o) }); g.step(1 / 60); } };
  const put = (v, x, z, yaw) => { v.st.x = x; v.st.z = z; v.st.y = g.world.heightAt(x, z); v.st.yaw = yaw; v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = false; v.st.sunk = false; v.sleep = false; };
  const v = V.list.find((x) => x.id === 'B-J1');
  s.pos.set(v.st.x + 2, v.st.y, v.st.z); s.protT = 0; step(2);
  ok(V.near(s)?.v === v && V.near(s).seat === 0, 'yanında: binilebilir araç = B-J1, sürücü koltuğu');
  step(1, { ve: 1 }); step(1);
  ok(s.veh === v && s.seat === 0 && Math.hypot(s.pos.x - v.st.x, s.pos.z - v.st.z) < 0.6, 'E: sürücü koltuğunda (konum koltukta)', `${f2(s.pos.x)},${f2(s.pos.z)} · boy ${s.height}`);
  put(v, 0, 300, 0); step(1);
  step(240, { f: 1 });
  const sp = V.speed(v);
  ok(sp > 15, '4 sn tam gaz (çayır)', `${f1(sp)} m/sn = ${Math.round(sp * 3.6)} km/s`);
  let n = 0; while (V.speed(v) > 0.05 && n < 300) { step(1, { j: 1 }); n++; }
  ok(n < 200, 'fren (Boşluk): durma süresi', `${f2(n / 60)} sn`);
  const y0 = v.st.yaw; step(120, { f: 0.6, r: 1 });
  ok(Math.abs(((v.st.yaw - y0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.8, 'D: sağa döner (yaw azalır)', `Δyaw ${f2(v.st.yaw - y0)}`);
  step(120, { j: 1 });
  step(1, { vs: 3 }); step(1);
  const s3 = s.seat, drvEmpty = !v.seats[0];
  step(1, { vs: 1 }); step(1);
  ok(s3 === 2 && drvEmpty && s.seat === 0, 'koltuk değiştir: 3 → arka sol, sürücü boşalır, 1 → sürücü', `${s3} → ${s.seat}`);
  // 12.182: eski nehir hattı kuru — Kavşak (eski Taş Köprü) ve Doğu Geçidi yolundan kesintisiz geçilir
  put(v, 0, 62, 0); step(1); let minY0 = 99; step(480, (i) => { minY0 = Math.min(minY0, v.st.y); return { f: 0.8 }; });
  ok(v.st.z < -15 && minY0 > 1 && !v.st.sunk, 'Kavşak: eski nehir hattını (çayır) yoldan kesintisiz geçer', `z ${f1(v.st.z)} · en alçak ${f2(minY0)}`);
  put(v, 336, 20, 0.05); step(1); let minY = 99; step(780, () => { minY = Math.min(minY, v.st.y); return { f: 1 }; });
  ok(v.st.z < -105 && minY > 1 && !v.st.sunk, 'Doğu Geçidi (toprak yol): eski geçit yerinden geçer, su yok', `z ${f1(v.st.z)} · en alçak ${f2(minY)}`);
  // savaş alanı sınırı: araçla dışarı → 10 sn sonra ölüm, boş araç dışarıda 15 sn sonra yenilenir
  put(v, 770, 300, 0); step(1);
  let tOut = 0; while (s.alive && tOut < 13) { step(6); tOut += 0.1; }
  ok(!s.alive && tOut > 9.5 && tOut < 11, 'savaş alanı dışında araçta: ~10 sn sonra ölüm (koltuk boşalır)', `${f1(tOut)} sn · araç boş: ${!v.seats.some(Boolean)}`);
  let tI = 0; while (v.alive && tI < 20) { g.step(0.1); tI += 0.1; }
  ok(!v.alive && tI > 13 && tI < 17, 'dışarıda bırakılan boş araç ~15 sn sonra kaldırılır (sonra doğuşunda yenilenir)', `${f1(tI)} sn`);
  g.respawn(s); s.protT = 0;
  let tR = 0; while (!v.alive && tR < 40) { g.step(0.1); tR += 0.1; }
  ok(v.alive && Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) < 0.5, 'yeniden doğuş (doğuş yerinde)', `${f1(tR)} sn`);
  // derin su: batar, içindeki iner, araç gider
  s.pos.set(v.st.x + 2, v.st.y, v.st.z); step(1, { ve: 1 }); step(1);
  put(v, 742, -62, 0); step(1); let tS = 0, exitAt = -1; while (v.alive && tS < 14) { step(6, { f: 0.6 }); tS += 0.1; if (exitAt < 0 && !s.veh) exitAt = tS; }
  ok(!v.alive && exitAt > 0 && s.alive, 'derin su (baraj gölü): motor boğulur → sürücü iner (yüzme su ajanında) → araç birkaç sn sonra gider', `iniş ${f1(exitAt)} sn · araç gitti ${f1(tS)} sn`);
  while (!v.alive) g.step(0.2);
  // hasar
  const red = g.soldiers.find((e) => e.team === 'red'); red.vacant = false; red.spawn({ x: v.st.x + 30, z: v.st.z, ry: 0 }, 0); g.world.settle(red); red.protT = 0;
  const hp0 = v.hp; V.damage(v, 30, red, 'bullet');
  ok(Math.abs(hp0 - v.hp - 30 * VT.jip.bulletMul) < 0.01, 'piyade mermisi: hasar × ' + VT.jip.bulletMul + ' (400 can ≈ 110 tüfek mermisi)', f1(hp0 - v.hp));
  const P = (x, y, z) => ({ x, y, z, clone() { return P(this.x, this.y, this.z); }, distanceTo: () => 99 });
  g.respawn(s); s.pos.set(v.st.x + 2, v.st.y, v.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
  const hp1 = v.hp; g.explode(P(v.st.x, v.st.y + 1.3, v.st.z - 1.6), 6.5, 160, red, 'RPG-7');
  ok(hp1 - v.hp > 200, 'RPG kaputa: ' + Math.round(hp1 - v.hp) + ' hasar (2 RPG = jip)', `can ${Math.round(v.hp)}`);
  const sHp = s.hp;
  g.explode(P(v.st.x, v.st.y + 1.3, v.st.z - 1.6), 6.5, 160, red, 'RPG-7');
  ok(!v.alive && !s.alive && red.kills >= 1, '2. RPG: araç patlar, sürücü ölür, öldürme RPG atana', `sürücü canı ${Math.round(sHp)} → öldü · ${red.name} öldürme ${red.kills}`);
  ok(v.wreck, 'enkaz kalır (' + VT.jip.wreck + ' sn), sonra ' + VT.jip.respawn + ' sn yeniden doğuş');
  while (!v.alive) g.step(0.25);
  // yanma: eşik altında can erir → patlar
  v.hp = VT.jip.hp * VT.jip.burnAt - 5; let tB = 0; while (v.alive && tB < 20) { g.step(0.1); tB += 0.1; }
  ok(!v.alive && tB > 8 && tB < 13, 'yanma: can %25 altında → ~' + Math.round(VT.jip.hp * VT.jip.burnAt / VT.jip.burnRate) + ' sn sonra patlar (inme süresi)', `${f1(tB)} sn`);
  while (!v.alive) g.step(0.25);
  // çarpma
  g.respawn(s); s.pos.set(v.st.x + 2, v.st.y, v.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
  put(v, 0, 300, 0);
  red.spawn({ x: 0, z: 270, ry: 0 }, 0); g.world.settle(red); red.protT = 0; red.hp = 100;
  const mate = g.soldiers.find((e) => e.team === 'blue' && e !== s); mate.vacant = false; mate.spawn({ x: 0.2, z: 240, ry: 0 }, 0); g.world.settle(mate); mate.protT = 0; mate.hp = 100;
  let ramSp = 0; step(240, () => { if (red.alive && red.hp === 100) ramSp = V.speed(v); return { f: 1 }; });
  ok(!red.alive, 'düşmana çarpma: öldü', `çarpma hızı ${f1(ramSp)} m/sn · öldüren ${red.lastHit?.name}`);
  ok(mate.alive && mate.hp === 100, 'takım arkadaşına çarpma: hasar yok (itilir)', `can ${mate.hp} · konum ${f1(mate.pos.x)},${f1(mate.pos.z)}`);
  step(120, { j: 1 });
  // gövdeden itme (yaya park etmiş araca yürür)
  step(1, { ve: 1 }); step(2);
  const xs = s.pos.x; let inside = 0;
  const tx = v.st.x, tz = v.st.z;
  s.pos.set(tx + 4, v.st.y, tz); s.yaw = Math.PI / 2;
  step(90, () => { if (V.inside(s, -0.05)) inside++; return { f: 1, yw: Math.PI / 2 }; });
  ok(inside === 0 && s.alive, 'yaya araca yürüyünce gövdeye girmez (itilir)', `içeride kare ${inside} · ${f2(xs)}`);
  // bot yolcu
  const gb = mkG({ bots: true, match: { perTeam: 6, type: 'conquest' } }), VB = gb.vehicles;
  for (const x of VB.list) x.botBad = 1e9;                                    // 12.189: botlar artık kendileri de sürer — bu denetim yalnız yolcu / nişancı kuralını ölçer
  const hb = gb.claimSlot('blue', 'Sürücü', 'assault', {}), hq = gb.humans.get(hb.id);
  const vb = VB.list.find((x) => x.id === 'B-J2');
  let qb = 0; const stepB = (n, o = {}) => { for (let i = 0; i < n; i++) { hq.queue.push({ q: ++qb, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: hb.yaw, pt: 0, w: hb.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...o }); gb.step(1 / 60); } };
  hb.pos.set(vb.st.x + 2, vb.st.y, vb.st.z); hb.protT = 0; stepB(1, { ve: 1 }); stepB(1);
  const mates = gb.soldiers.filter((e) => e.team === 'blue' && e.brain);
  mates.slice(0, 3).forEach((m, i) => { m.pos.set(vb.st.x - 6 - i * 2, vb.st.y, vb.st.z + 3); gb.world.settle(m); m.brain.target = null; m.brain.goal = null; });
  let tBo = 0; while (tBo < 10 && vb.seats.filter(Boolean).length < 3) { stepB(6, { fh: tBo < 1 ? 1 : 0 }); tBo += 0.1; }
  const riders = vb.seats.filter((o) => o && o.brain).length;
  if (riders < 2) console.log('  bot durumu', mates.slice(0, 3).map((m) => [m.alive, !!m.brain.target, m.brain.rideGoal ? 'hedef araç' : '-', Math.hypot(m.pos.x - vb.st.x, m.pos.z - vb.st.z).toFixed(1), m.veh ? 'araçta' : ''].join('/')).join(' '));
  ok(riders >= 2, 'bot yolcu: yakındaki takım arkadaşı botlar insanın sürdüğü durmuş araca biner (sürmezler)', `${riders} bot · ${f1(tBo)} sn`);
  stepB(1, { ve: 1 }); let tEx = 0; while (vb.seats.some(Boolean) && tEx < 8) { stepB(6); tEx += 0.1; }
  ok(!vb.seats.some(Boolean), 'sürücü inince botlar da iner', `${f1(tEx)} sn`);
  // bayrak jipi: bayrak alınınca o takım için doğar
  const gf = mkG(), fj = gf.vehicles.list.find((x) => x.id === 'B-J');
  const was = fj.alive; gf.mode.objectives.find((o) => o.id === 'B').owner = 'red'; for (let i = 0; i < 5; i++) gf.step(0.1);
  ok(!was && fj.alive && fj.team === 'red', 'bayrak jipi (Köy): bayrak sahibine doğar (sahipsizken yok)', `${was} → ${fj.alive} · ${fj.team}`);
  // maliyet + ağ
  const gp = mkG({ bots: true, match: { perTeam: 8, type: 'conquest' } });
  const t0 = performance.now(); for (let i = 0; i < 600; i++) gp.step(1 / 60); const ms = (performance.now() - t0) / 600;
  const t1 = performance.now(); for (let i = 0; i < 2000; i++) gp.vehicles.update(1 / 60); const vu = ((performance.now() - t1) / 2000) * 1000;
  const vv = gp.vehicles.list[0], d0 = performance.now(); for (let i = 0; i < 2000; i++) gp.vehicles.drive(vv, { f: 1, r: 0.3 }, 1 / 60); const du = ((performance.now() - d0) / 2000) * 1000;
  ok(vu < 40 && du < 40, 'sunucu maliyeti: araç yöneticisi (12 araç, park) / bir sürücü adımı', `${f1(vu)} µs / ${f1(du)} µs · 8v8 adım ${f2(ms)} ms`);
  const full = JSON.stringify(gp.vehicles.pack(true)).length; gp.vehicles.pack(false);
  const idle = gp.vehicles.pack(false).length;
  ok(idle === 0 || idle === 1, 'ağ: duran araç anlık görüntüye yazılmaz (yalnız değişen)', `tam liste ${full} B · değişen ${idle}`);
}

// ───────── 1b) başsız: TANK (12.178) ─────────
function headlessTank() {
  console.log('── başsız: tank ──');
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 6, type: 'conquest' } }), V = g.vehicles, D = VT.tank;
  const s = g.claimSlot('blue', 'Tankçı', 'assault', {}), h = g.humans.get(s.id);
  let q = 0;
  const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: s.pitch, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, ...(typeof o === 'function' ? o(i) : o) }); g.step(1 / 60); } };
  const put = (v, x, z, yaw) => { v.st.x = x; v.st.z = z; v.st.y = g.world.heightAt(x, z); v.st.yaw = yaw; v.st.tyaw = yaw; v.st.gp = 0; v.st.vx = v.st.vy = v.st.vz = 0; v.st.air = false; v.st.sunk = false; v.sleep = false; };
  const foe = (x, z) => { const e = g.soldiers.find((o) => o.team === 'red' && !o.alive || o.team === 'red' && o.vacant) || g.soldiers.filter((o) => o.team === 'red')[0]; e.vacant = false; e.spawn({ x, z, ry: 0 }, 0); g.world.settle(e); e.protT = 0; e.hp = e.maxHp; return e; };
  const t = V.list.find((x) => x.id === 'B-T1');
  s.pos.set(t.st.x + 2.4, t.st.y, t.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
  ok(s.veh === t && s.seat === 0 && V.hiddenSeat(s), 'tank: E ile sürücü (gövde içinde, görünmez; ana top da sürücüde)', `koltuk ${s.seat}`);
  put(t, 0, 330, 0); step(1);
  step(240, { f: 1, yw: 0 });
  const sp = V.speed(t);
  ok(sp > 8.5 && sp < 11.5, 'paletli: 4 sn tam gaz yavaş araç', `${f1(sp)} m/sn = ${Math.round(sp * 3.6)} km/s`);
  step(150, { j: 1 }); const y0 = t.st.yaw; step(120, { r: 1 });
  ok(V.speed(t) < 1 && Math.abs(t.st.yaw - y0) > 1.2, 'yerinde dönüş (D, gaz yok)', `Δyaw ${f2(t.st.yaw - y0)} · hız ${f2(V.speed(t))}`);
  const aim = t.st.tyaw + 1.6; let tt = 0; while (Math.abs(((t.st.tyaw - aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.02 && tt < 5) { step(6, { yw: aim, pt: 0.5 }); tt += 0.1; }
  ok(tt > 1.2 && tt < 2.5 && Math.abs(t.st.gp - D.turret.gunMax) < 0.02, 'kule bakışa sınırlı hızla döner (90° ≈ 1,7 sn), top açısı sınırda', `${f1(tt)} sn · top ${f2(t.st.gp)}`);
  const tyw = t.st.tyaw; step(90, { r: 1, yw: tyw, pt: 0 });
  ok(Math.abs(((t.st.tyaw - tyw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.03, 'dengeli kule: gövde dönerken nişan aynı yönde kalır', f2(t.st.tyaw - tyw));
  // ana top: 120 m'deki düşmana; yay + patlama
  const YE = -Math.PI / 2;                                             // üs düzlüğünde doğuya (eğimsiz: gövde eğimi top açısı sınırını değiştirir)
  put(t, 10, 715, YE); step(2, { yw: YE, pt: 0 });
  const e1 = foe(130, 715); e1.hp = 100;
  // nişan açısı: mermi yayının hedef gövde ortasından geçtiği top açısı (ikiye bölme; sim/vehicle gunPose + aynı yerçekimi)
  const dist = 120, tyAt = (pt) => { const tu = D.turret, y0 = t.st.y + tu.pivot, vz = Math.cos(pt) * D.cannon.speed, vy = Math.sin(pt) * D.cannon.speed, z0 = tu.len * Math.cos(pt) + tu.f, tf = (dist - z0) / vz; return y0 + tu.len * Math.sin(pt) + vy * tf - 0.5 * D.cannon.grav * tf * tf; };
  let lo = -0.1, hi = 0.3; const ty = e1.pos.y + 0.9; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (tyAt(mid) < ty) lo = mid; else hi = mid; }
  const el = (lo + hi) / 2;
  step(80, { yw: YE, pt: el });
  const nS = V.shells.length; step(1, { yw: YE, pt: el, fh: 1, fp: 1 });
  const fired = V.shells.length > nS, rl0 = t.rl;
  step(1, { yw: YE, pt: el, fh: 1, fp: 1 });
  const fired2 = V.shells.length > nS + 1;
  let ft = 0; while (V.shells.length && ft < 3) { step(3, { yw: YE, pt: el }); ft += 0.05; }
  ok(fired && !fired2 && Math.abs(rl0 - D.cannon.reload) < 0.05, 'ana top: tek atış, ' + D.cannon.reload + ' sn dolum (basılı tutmak ikinciyi atmaz)', `dolum ${f2(rl0)}`);
  if (e1.alive) console.log('  top debug', JSON.stringify({ e1: [e1.pos.x, e1.pos.y, e1.pos.z].map((x) => +x.toFixed(2)), t: [t.st.x, t.st.y, t.st.z, t.st.tyaw, t.st.gp, t.st.pitch].map((x) => +x.toFixed(3)), b: g.netEvents.filter((x) => x.e === 'tsb').slice(-1) }));
  ok(!e1.alive, '120 m: mermi düşüşüyle yayla gider (top açısı ' + f2(el * 180 / Math.PI) + '°), patlama askeri öldürür', `uçuş ${f2(ft)} sn · asker ${e1.alive ? 'canlı ' + Math.round(e1.hp) : 'öldü'}`);
  // zırh: mermi 0, el bombası az, RPG / tank topu çok
  const t2 = V.list.find((x) => x.id === 'R-T1'), e2 = foe(t2.st.x + 20, t2.st.z);
  const hp0 = t2.hp; V.damage(t2, 30, s, 'bullet'); const dB = hp0 - t2.hp;      // 12.188: atan = Mavi (R-T1 Kırmızı; dost ateşi araca işlemez)
  const P = (x, y, z) => new (s.pos.constructor)(x, y, z);
  g.explode(P(t2.st.x + 1.8, t2.st.y + 0.5, t2.st.z), 7.5, 130, s, 'El Bombası'); const dG = hp0 - t2.hp - dB;
  g.explode(P(t2.st.x, t2.st.y + 1.2, t2.st.z - 3.4), 6.5, 160, s, 'RPG-7', undefined, 'at'); const dR = hp0 - t2.hp - dB - dG;
  ok(dB === 0 && dG > 0 && dG < 75 && dR > 150, 'zırh: tüfek mermisi 0 · el bombası az · RPG çok (12.200 yönlü zırh: yan × 1,35)', `mermi ${f1(dB)} · el bombası ${f1(dG)} · RPG ${f1(dR)} (can ${D.hp} → ${Math.round(D.hp / dR + 0.5)} RPG)`);
  // tank topu ↔ jip: tek atış
  const j = V.list.find((x) => x.id === 'R-J1'); g.explode(P(j.st.x, j.st.y + 0.8, j.st.z), D.cannon.radius, D.cannon.dmg, s, D.cannon.name, undefined, 'at');
  ok(!j.alive, 'tank topu jipi tek atışta patlatır');
  // sürücü zırh arkasında: yanında el bombası → sürücüye hasar yok
  const sh0 = s.hp; g.explode(P(t.st.x + 2.2, t.st.y + 0.3, t.st.z), 7.5, 130, e2, 'El Bombası');
  ok(s.hp === sh0 && s.alive, 'tank içindeki sürücü el bombası sıçramasından korunur', `can ${sh0} → ${s.hp}`);
  // nişancı + makineli: 40 m'deki düşmanı vurur
  put(t, 0, 300, 0); step(2, { yw: 0 });
  const gunner = g.claimSlot('blue', 'Nişancı', 'assault', {}), hg = g.humans.get(gunner.id);
  gunner.pos.set(t.st.x - 2.4, t.st.y, t.st.z); gunner.protT = 0; V.enter(gunner, t, 1);
  const e3 = foe(t.st.x + 30, t.st.z - 25); e3.hp = 100;
  let k = 0, hits = 0;
  for (; k < 180 && e3.alive; k++) {
    const ey = gunner.eye(), c = e3.center(), dx = c.x - ey.x, dz = c.z - ey.z;
    hg.queue.push({ q: k + 1, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: Math.atan2(-dx, -dz), pt: Math.atan2(c.y - ey.y, Math.hypot(dx, dz)), w: gunner.cur, c: 0, p: 0, u: 0, fh: 1, fp: k === 0 ? 1 : 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null });
    h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: 0, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null });
    g.step(1 / 60);
  }
  ok(!e3.alive && gunner.items[0].mag === WSTATS[gunner.items[0].id].mag, 'nişancı: kule makinelisi 40 m\'deki düşmanı öldürür (kendi silahının cephanesi harcanmaz)', `${f2(k / 60)} sn`);
  // çarpma: yavaş tank da ezer; tank jipi iter
  V.exit(gunner);
  put(t, 0, 330, 0); step(2, { yw: 0 });
  const e4 = foe(0, 318); e4.hp = 100;
  step(150, { f: 1, yw: 0 });
  ok(!e4.alive, 'tank düşmanı ezer (≥ ' + D.ramMin + ' m/sn)', `${e4.alive ? 'canlı' : 'öldü'}`);
  const j2 = V.list.find((x) => x.id === 'B-J3'); put(j2, 0, t.st.z - 7.5, Math.PI / 2); put(t, 0, t.st.z, 0); step(1, { yw: 0 });
  const jz = j2.st.z; step(150, { f: 1, yw: 0 });
  ok(jz - j2.st.z > 3, 'tank yolundaki jipi iter (kütle)', `jip ${f1(jz - j2.st.z)} m itildi · tank hızı ${f1(V.speed(t))}`);
  // 12.182: eski nehir hattı (Kavşak / Doğu Geçidi) kuru + derin su yalnız baraj gölünde
  put(t, 0, 66, 0); step(1); let minY0 = 99; step(780, () => { minY0 = Math.min(minY0, t.st.y); return { f: 0.8, yw: 0 }; });
  ok(t.st.z < -15 && minY0 > 1 && !t.st.sunk, 'tank Kavşak\'tan (eski Taş Köprü yeri) kesintisiz geçer', `z ${f1(t.st.z)} · en alçak ${f2(minY0)}`);
  put(t, 336, 20, 0.05); step(1); let minY = 99; step(1500, () => { minY = Math.min(minY, t.st.y); return { f: 1, yw: 0.05 }; });
  ok(t.st.z < -105 && !t.st.sunk, 'tank Doğu Geçidi toprak yolundan geçer', `z ${f1(t.st.z)} · en alçak ${f2(minY)}`);
  put(t, 742, -62, 0); step(1); let tS = 0, out = -1; while (t.alive && tS < 14) { step(6, { f: 0.7, yw: 0 }); tS += 0.1; if (out < 0 && !s.veh) out = tS; }
  ok(!t.alive && out > 0 && s.alive, 'tank derin suda (baraj gölü) batar (sürücü çıkar, yüzer)', `iniş ${f1(out)} sn · araç gitti ${f1(tS)} sn`);
  // el bombası araçtan seker
  const jj = V.list.find((x) => x.id === 'B-J1'); put(jj, 50, 300, 0); g.step(1 / 60);
  const thrower = g.soldiers.find((o) => o.team === 'blue' && o !== s && o !== gunner); thrower.vacant = false; thrower.spawn({ x: 44, z: 300, ry: 0 }, 0); g.world.settle(thrower);
  const nade = g.spawnGrenade(thrower, P(44, jj.st.y + 0.9, 300), P(10, 3.5, 0), WSTATS.grenade, null, {});
  let minX = 99, maxX = -99; for (let i = 0; i < 60; i++) { g.step(1 / 60); maxX = Math.max(maxX, nade.pos.x); }
  ok(maxX < 50 - VT.jip.hw + 0.2 && nade.pos.x < maxX - 0.2, 'el bombası araç gövdesinden geri seker (içinden geçmez)', `en ileri x ${f2(maxX)} (gövde ${f2(50 - VT.jip.hw)}) · son ${f2(nade.pos.x)}`);
  // bot nişancı
  const gb = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: true, match: { perTeam: 6, type: 'conquest' } }), VB = gb.vehicles;
  for (const x of VB.list) x.botBad = 1e9;                                    // 12.189: botlar artık kendileri de sürer — bu denetim yalnız yolcu / nişancı kuralını ölçer
  const hb = gb.claimSlot('blue', 'Sürücü', 'assault', {}), hq = gb.humans.get(hb.id), tb = VB.list.find((x) => x.id === 'B-T2');
  hb.pos.set(tb.st.x + 2.4, tb.st.y, tb.st.z); hb.protT = 0; VB.enter(hb, tb, 0);
  const m = gb.soldiers.find((e) => e.team === 'blue' && e.brain); m.pos.set(tb.st.x - 7, tb.st.y, tb.st.z + 3); gb.world.settle(m); m.brain.target = null;
  let tb0 = 0; for (; tb0 < 8 && !tb.seats[1]; tb0 += 0.1) { for (let i = 0; i < 6; i++) { hq.queue.push({ q: tb0 * 100 + i, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: hb.yaw, pt: 0, w: hb.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null }); gb.step(1 / 60); } }
  ok(tb.seats[1]?.brain, 'bot nişancı: insanın sürdüğü tankın makineli koltuğuna biner', `${f1(tb0)} sn`);
  // maliyet
  const t0 = performance.now(); for (let i = 0; i < 2000; i++) V.drive(t.alive ? t : V.list.find((x) => x.type === 'tank' && x.alive), { f: 1, r: 0.3, yw: 1, pt: 0.1 }, 1 / 60);
  ok(true, 'tank sürücü adımı', `${f1((performance.now() - t0) / 2000 * 1000)} µs`);
}

// ───────── 1c) başsız: HELİKOPTER (12.179) ─────────
function headlessHeli() {
  console.log('── başsız: helikopter ──');
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: false, match: { perTeam: 6, type: 'conquest' } }), V = g.vehicles, D = VT['heli-n'];
  const s = g.claimSlot('blue', 'Pilot', 'assault', {}), h = g.humans.get(s.id);
  let q = 0;
  const I = (o = {}) => ({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: s.yaw, pt: s.pitch, w: s.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, dn: 0, ...o });
  const step = (n, o = {}) => { for (let i = 0; i < n; i++) { h.queue.push(I(typeof o === 'function' ? o(i) : o)); g.step(1 / 60); } };
  const H = V.list.find((x) => x.id === 'B-H1'), pad = g.map.helipads.find((p) => p.id === 'BH1');
  ok(H.alive && Math.hypot(H.st.x - pad.x, H.st.z - pad.z) < 0.5 && !H.st.air, 'helikopter helipadde (BH1) yerde doğar', `${f1(H.st.x)},${f1(H.st.z)} · y ${f2(H.st.y)}`);
  s.pos.set(H.st.x + 2.6, H.st.y, H.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
  ok(s.veh === H && s.seat === 0, 'E ile pilot koltuğu', s.seat);
  const y0 = H.st.y; step(60, { j: 1, yw: H.st.yaw });
  const early = H.st.y - y0;
  let tt = 0; while (H.st.y - y0 < 20 && tt < 12) { step(6, { j: 1, yw: H.st.yaw }); tt += 0.1; }
  ok(early < 0.3 && tt < 7, 'rotor önce döner (1 sn\'de kalkmaz), sonra Boşlukla yükselir', `ilk 1 sn ${f2(early)} m · 20 m'ye ${f1(tt + 1)} sn`);
  step(60, { yw: H.st.yaw }); const hy = H.st.y; step(180, { yw: H.st.yaw });
  ok(Math.abs(H.st.y - hy) < 0.6 && H.st.air, 'girdi yokken havada asılı kalır', `${f2(H.st.y - hy)} m / 3 sn`);
  const hy2 = H.st.y; H.st.x = 0; H.st.z = 400; step(300, { f: 1, yw: 0 });
  const spd = Math.hypot(H.st.vx, H.st.vz);
  ok(spd > 35 && Math.abs(H.st.y - hy2) < 1.5, 'W: ileri (burun aşağı eğilir), irtifa korunur', `${Math.round(spd * 3.6)} km/s · eğim ${f2(H.st.pitch)}`);
  const yw0 = H.st.yaw; step(90, { f: 1, yw: 1.2 });
  ok(Math.abs(H.st.yaw - 1.2) < 0.08, 'burun fareyle (bakış yaw) döner', `${f2(yw0)} → ${f2(H.st.yaw)}`);
  step(120, { f: -1, yw: 1.2 }); step(60, { yw: 1.2 });
  step(90, { r: 1, yw: 1.2 });
  ok(Math.abs(H.st.roll) > 0.1, 'D: yana kayma (gövde yatar)', `yatış ${f2(H.st.roll)}`);
  // yumuşak iniş
  H.st.x = 0; H.st.z = 300; H.st.vx = H.st.vz = 0; const hp0 = H.hp; let tl = 0; while (H.st.air && tl < 30) { step(6, { dn: 1, yw: 1.2 }); tl += 0.1; }
  ok(!H.st.air && H.hp === hp0, 'C ile alçal: yere yaklaşınca yavaşlar, hasarsız iner', `${f1(tl)} sn · can ${Math.round(hp0)} → ${Math.round(H.hp)}`);
  // kapı nişancısı: yay içinde vurur, dışında ateş etmez
  step(1, { j: 1 }); let k = 0; while (H.st.y - g.world.heightAt(H.st.x, H.st.z) < 12 && k < 600) { step(1, { j: 1, yw: 0 }); k++; } step(60, { yw: 0 });
  const gn = g.claimSlot('blue', 'Nişancı', 'assault', {}), hg = g.humans.get(gn.id); V.enter(gn, H, 1);
  const tgt = g.soldiers.find((o) => o.team === 'red'); tgt.vacant = false; tgt.spawn({ x: H.st.x - 25, z: H.st.z + 4, ry: 0 }, 0); g.world.settle(tgt); tgt.protT = 0; tgt.hp = 100;
  let n = 0; for (; n < 180 && tgt.alive; n++) { const e = gn.eye(), c = tgt.center(), dx = c.x - e.x, dz = c.z - e.z; hg.queue.push({ q: n + 1, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: Math.atan2(-dx, -dz), pt: Math.atan2(c.y - e.y, Math.hypot(dx, dz)), w: gn.cur, c: 0, p: 0, u: 0, fh: 1, fp: n === 0 ? 1 : 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null }); h.queue.push(I({ yw: 0 })); g.step(1 / 60); }
  ok(!tgt.alive, 'sol kapı nişancısı (havada) soldaki düşmanı makineliyle öldürür', `${f2(n / 60)} sn`);
  const t2 = tgt; t2.spawn({ x: H.st.x + 25, z: H.st.z, ry: 0 }, 0); g.world.settle(t2); t2.protT = 0; t2.hp = 100;
  for (let i = 0; i < 90; i++) { const e = gn.eye(), c = t2.center(), dx = c.x - e.x, dz = c.z - e.z; hg.queue.push({ q: 500 + i, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: Math.atan2(-dx, -dz), pt: Math.atan2(c.y - e.y, Math.hypot(dx, dz)), w: gn.cur, c: 0, p: 0, u: 0, fh: 1, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null }); h.queue.push(I({ yw: 0 })); g.step(1 / 60); }
  ok(t2.alive && t2.hp === 100, 'kapı yayı dışındaki (sağdaki) hedefe sol makineli ateş etmez', `can ${t2.hp}`);
  V.exit(gn);
  // hasar: mermi az, RPG çok; çarpma
  const hb = H.hp; V.damage(H, 30, t2, 'bullet'); const dB = hb - H.hp;
  g.explode(new (s.pos.constructor)(H.st.x, H.st.y + 1.5, H.st.z), 6.5, 160, t2, 'RPG-7', undefined, 'at'); const dR = hb - H.hp - dB;
  ok(dB > 3 && dB < 6 && dR > 200, 'hasar: mermi az (× ' + D.bulletMul + '), RPG çok (2–3 RPG)', `mermi ${f1(dB)} · RPG ${f1(dR)}`);
  H.hp = D.hp;
  // dağa çarpma → hasar / patlama (kuzey dağları x −765 ötesi; burada Radar Tepesi yamacı yerine doğrudan yüksek arazi: alçalıp yamaca)
  H.st.x = -560; H.st.z = 30; H.st.y = g.world.heightAt(-560, 30) + 6; H.st.vx = H.st.vz = H.st.vy = 0; H.st.air = true; H.st.yaw = 0;
  let tc = 0, minHp = H.hp; while (H.alive && tc < 8) { step(6, { f: 1, dn: 1, yw: 0 }); tc += 0.1; minHp = Math.min(minHp, H.hp); }
  ok(minHp < D.hp - 40, 'tam hızla yamaca / yere çarpma: ağır hasar (gövde / rotor ucu)', `can ${D.hp} → ${Math.round(Math.max(0, minHp))}${H.alive ? '' : ' (patladı)'}`);
  // pilot havada atlar: helikopter düşer + patlar; pilot düşme hasarı alır
  if (!H.alive) { while (!H.alive) g.step(0.25); }
  if (!s.alive) g.respawn(s);
  H.st.x = 0; H.st.z = 300; H.st.y = g.world.heightAt(0, 300); H.st.vx = H.st.vy = H.st.vz = 0; H.st.air = false; H.hp = D.hp;
  s.pos.set(H.st.x + 2.6, H.st.y, H.st.z); s.protT = 0; if (!s.veh) { step(1, { ve: 1 }); step(1); }
  let tu = 0; while ((H.st.y - g.world.heightAt(H.st.x, H.st.z) < 30 || H.st.rpm < 1) && tu < 15) { step(6, { j: 1, yw: H.st.yaw }); tu += 0.1; }
  step(1, { ve: 1 }); const shp = s.hp;
  let tf = 0; while (H.alive && tf < 20) { step(6, { yw: s.yaw }); tf += 0.1; }
  ok(!H.alive && H.wreck && (s.hp < shp || !s.alive), 'pilot havada atlarsa: rotor söner, helikopter düşüp patlar; pilot düşme hasarı alır', `${f1(tf)} sn · pilot ${s.alive ? Math.round(s.hp) : 'öldü'}`);
  // savaş alanı sınırı uçarken de geçerli
  while (!H.alive) g.step(0.25);
  if (!s.alive) g.respawn(s);
  s.pos.set(H.st.x + 2.6, H.st.y, H.st.z); s.protT = 0; step(1, { ve: 1 }); step(1);
  step(300, { j: 1, yw: H.st.yaw });
  H.st.x = 790; H.st.z = 0; let to = 0; while (s.alive && to < 13) { step(6, { yw: H.st.yaw }); to += 0.1; }
  ok(!s.alive && to > 9.5 && to < 11, 'savaş alanı dışında uçan pilot ~10 sn sonra ölür (yükseklik fark etmez)', `${f1(to)} sn · irtifa ${f1(H.st.y - g.world.heightAt(H.st.x, H.st.z))} m`);
  // bot kapı nişancısı: yerdeki helikoptere biner, uçarken inmez
  const gb = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', bots: true, match: { perTeam: 6, type: 'conquest' } }), VB = gb.vehicles;
  for (const x of VB.list) x.botBad = 1e9;                                    // 12.189: botlar artık kendileri de sürer — bu denetim yalnız yolcu / nişancı kuralını ölçer
  const pb = gb.claimSlot('blue', 'Pilot', 'assault', {}), hpq = gb.humans.get(pb.id), HB = VB.list.find((x) => x.id === 'B-H2');
  pb.pos.set(HB.st.x + 2.6, HB.st.y, HB.st.z); pb.protT = 0; VB.enter(pb, HB, 0);
  const m = gb.soldiers.filter((e) => e.team === 'blue' && e.brain).slice(0, 2);
  m.forEach((b, i) => { b.pos.set(HB.st.x - 8 - i * 2, HB.st.y, HB.st.z + 4); gb.world.settle(b); b.brain.target = null; });
  let qq = 0, tb = 0; const sb = (o = {}) => { hpq.queue.push({ q: ++qq, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: HB.st.yaw, pt: 0, w: pb.cur, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, ab: 0, vt: null, ve: 0, vs: 0, vl: 0, dn: 0, ...o }); gb.step(1 / 60); };
  for (; tb < 8 && HB.seats.filter((o) => o?.brain).length < 2; tb += 1 / 60) sb();
  const nB = HB.seats.filter((o) => o?.brain).length;
  for (let i = 0; i < 600; i++) sb({ j: 1 }); for (let i = 0; i < 400; i++) sb({});
  ok(nB >= 1 && HB.seats.filter((o) => o?.brain).length === nB && HB.st.air, 'bot nişancılar yerdeki helikoptere biner, havada asılıyken inmez', `${nB} bot · ${f1(tb)} sn · irtifa ${f1(HB.st.y - gb.world.heightAt(HB.st.x, HB.st.z))} m`);
  // 12.183: pilotsuz düşen helikopterin rotor ucu ağaç gövdesinin tepesine değince havada asılı kalmaz (eskiden y tutuluyordu: ~3,8 m'de asılı, can eriyordu)
  {
    const D2 = VT['heli-n'], W = g.world, H2 = V.list.find((x) => x.id === 'B-H2' && x.alive) || H;
    const trunks = W.colliders.filter((c) => c.max[0] - c.min[0] < 0.7 && c.max[2] - c.min[2] < 0.7 && c.max[1] - c.min[1] > 4 && Math.abs(c.min[0]) < 600 && Math.abs(c.min[2]) < 600);
    let hung = 0, n = 0;
    for (const c of trunks.filter((_, i) => i % Math.max(1, Math.floor(trunks.length / 12)) === 0).slice(0, 12)) {
      const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2, yaw = 0.7 + n, bx = Math.sin(yaw), bz = Math.cos(yaw), r = D2.rotorR * 0.9;      // arka rotor yoklaması (−0,9 R) gövdenin tam üstünde
      if (H2.seats.some(Boolean)) for (const o of H2.seats) if (o) V.release(o);
      H2.alive = true; H2.wreck = false; H2.hp = D2.hp; H2.sleep = false;
      Object.assign(H2.st, { x: cx - bx * r, z: cz - bz * r, y: c.max[1] - D2.rotorY + 6, yaw, vx: 0, vy: 0, vz: 0, pitch: 0, roll: 0, air: true, rpm: 0.4 });
      n++; let t = 0; while (H2.alive && t < 7) { g.step(1 / 30); t += 1 / 30; }
      if (H2.alive && H2.st.air && H2.st.y - groundAt(W, H2.st.x, H2.st.z, H2.st.y + 0.25, 0.35) > 1) hung++;
    }
    ok(n > 6 && hung === 0, 'pilotsuz düşen helikopter rotoruyla ağaç gövdesine takılıp havada asılı kalmaz', `${n} gövde · asılı ${hung}`);
    H2.alive = true; H2.wreck = false; H2.hp = D2.hp; H2.st.air = false; H2.st.y = g.world.heightAt(H2.st.x, H2.st.z);
  }
  // tank kulesi vuruş kutusu kuleyle döner
  const T = V.list.find((x) => x.type === 'tank' && x.alive), tu2 = VT.tank.turret, P = (x, y, z) => new (s.pos.constructor)(x, y, z);
  T.st.yaw = 0; T.st.pitch = 0; T.st.roll = 0; const cz = T.st.z + 0.35;     // kule ekseni (f −0,35 → z +0,35)
  T.st.tyaw = 0; const r0 = V.raycast(P(T.st.x + 1.45, T.st.y + 4, cz), P(0, -1, 0), 10);
  T.st.tyaw = Math.PI / 2; const r1 = V.raycast(P(T.st.x + 1.45, T.st.y + 4, cz), P(0, -1, 0), 10);
  ok((!r0 || r0.point.y < T.st.y + 1.8) && r1 && r1.point.y > T.st.y + 2.3, 'tank kulesinin vuruş kutusu kuleyle döner', `düz: ${r0 ? f2(r0.point.y - T.st.y) : '—'} · 90°: ${r1 ? f2(r1.point.y - T.st.y) : '—'}`);
}

// ───────── 2) tarayıcı (çevrimdışı) ─────────
async function browserOffline(chromium) {
  console.log('── tarayıcı (çevrimdışı) ──');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
  for (const tod of ['day', 'night']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=${tod}&debug=1&nolock=1&nologin=1&devMode=0`);
    await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
    await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a), shot = async (n) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${tod === 'night' ? 'gece-' : ''}${n}.png` }); };
    await ev(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true; g.playerSoldier.fly = false; });
    const near = await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-J2'); me.pos.set(v.st.x + 2.3, v.st.y, v.st.z + 1.2); g.world.settle(me); me.yaw = Math.PI / 2 + 0.35; me.pitch = -0.2; return !!V.near(me); });
    await shot('01-yaninda-ipucu');
    await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
    const inV = await ev(() => window.__game.playerSoldier.veh?.id);
    if (tod === 'day') ok(near && inV === 'B-J2', 'tarayıcı: E ipucu + E ile bin (çevrimdışı)', inV);
    await ev(() => { const g = window.__game, me = g.playerSoldier; g.player.vehCam = 'first'; me.yaw = me.veh.st.yaw; me.pitch = -0.1; me.veh.lights = g.night; });
    await shot('02-surucu-icerden');
    await ev(() => { const g = window.__game, me = g.playerSoldier; g.player.vehCam = 'third'; me.yaw = me.veh.st.yaw + 2.5; me.pitch = -0.28; });
    await shot('03-surucu-takip');
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await page.waitForTimeout(1000); await page.keyboard.up('KeyD'); await page.waitForTimeout(1600);
    await ev(() => { const g = window.__game, me = g.playerSoldier; me.yaw = me.veh.st.yaw + Math.PI * 0.85; me.pitch = -0.3; });
    await shot('04-surus-toz-farlar'); await page.keyboard.up('KeyW');
    const drove = await ev(() => { const v = window.__game.playerSoldier.veh; return Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z); });
    if (tod === 'day') ok(drove > 15, 'tarayıcı: W / D ile sürüş', `${drove.toFixed(1)} m`);
    await page.keyboard.press('Digit3'); await page.waitForTimeout(300);
    await ev(() => { const g = window.__game, me = g.playerSoldier; me.yaw = me.veh.st.yaw + 1.3; me.pitch = -0.05; });
    await shot('05-yolcu');
    const seat = await ev(() => window.__game.playerSoldier.seat);
    if (tod === 'day') ok(seat === 2, 'tarayıcı: 3 tuşu → arka sol koltuk (yolcu, silah elde)', seat);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-J2'), b = g.soldiers.find((s) => s.team === 'blue' && s !== me); b.spawn({ x: v.st.x + 3, z: v.st.z, ry: 0 }, 0); V.enter(b, v, 1); me.pos.set(v.st.x - 4, v.st.y, v.st.z + 5); g.world.settle(me); me.yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); me.pitch = -0.15; });
    await shot('06-disaridan-yolculu');
    await ev(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-J2'); v.hp = 150; });
    await page.waitForTimeout(1500); await shot('07-hasarli-duman');
    await ev(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-J2'); v.hp = 80; });
    await page.waitForTimeout(2000); await shot('08-yaniyor');
    await page.waitForTimeout(8500); await shot('09-enkaz');
    if (tod === 'day') {
      await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-J3'); me.pos.set(v.st.x + 2, v.st.y, v.st.z); g.world.settle(me); V.toggle(me); v.st.x = 332; v.st.z = -45; v.st.y = g.world.heightAt(332, -45); v.st.yaw = 0.05; g.player.vehCam = 'third'; me.yaw = 0.05 + 2.2; me.pitch = -0.3; });
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1700); await shot('10-gecit-su'); await page.keyboard.up('KeyW');
    }
    ok(!errs.length, `tarayıcı (${tod === 'day' ? 'gündüz' : 'gece'}): sayfa hatası yok`, errs.slice(0, 2).join(' | '));
    await page.context().close();
  }
  // 12.178 TANK görüntüleri → /tmp/wb-arac/tank (gündüz + gece)
  const TOUT = OUT.replace(/jip\/?$/, 'tank'); fs.mkdirSync(TOUT, { recursive: true });
  for (const tod of ['day', 'night']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=${tod}&debug=1&nolock=1&nologin=1`);
    await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
    await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a), shot = async (n, w = 400) => { await page.waitForTimeout(w); await page.screenshot({ path: `${TOUT}/${tod === 'night' ? 'gece-' : ''}${n}.png` }); };
    await ev(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true; g.playerSoldier.fly = false; });
    if (tod === 'day') {
      await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-T1'); me.pos.set(v.st.x + 7, v.st.y, v.st.z - 6); g.world.settle(me); me.yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); me.pitch = -0.12; });
      await shot('01-disaridan');
    }
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-T1'); me.pos.set(v.st.x + 2.6, v.st.y, v.st.z); g.world.settle(me); V.toggle(me); v.st.x = 0; v.st.z = 330; v.st.y = g.world.heightAt(0, 330); v.st.yaw = 0; v.st.tyaw = 0; v.lights = g.night; g.player.vehCam = 'third'; me.yaw = 0.7; me.pitch = -0.05; });
    await shot('02-surucu-takip-kule', 2200);
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA'); await page.waitForTimeout(1200); await page.keyboard.up('KeyA'); await page.waitForTimeout(1800);
    await ev(() => { const g = window.__game, me = g.playerSoldier; me.yaw = me.veh.st.yaw + Math.PI * 0.8; me.pitch = -0.25; });
    await shot('03-surus-palet-toz', 1500); await page.keyboard.up('KeyW');
    await page.keyboard.down('Space'); await page.waitForTimeout(800); await page.keyboard.up('Space');
    await ev(() => { const g = window.__game, me = g.playerSoldier; me.yaw = me.veh.st.yaw; me.pitch = 0.01; });
    await page.waitForTimeout(2200);
    await ev(() => { window.__game.player.fireHeld = true; }); await page.waitForTimeout(90); await ev(() => { window.__game.player.fireHeld = false; });
    await shot('04-ana-top-ates', 60);
    await shot('05-mermi-isabet', 900);
    const rl = await ev(() => window.__game.playerSoldier.veh.rl);
    await ev(() => { window.__game.player.vehCam = 'first'; }); await shot('06-nisanci-durbunu');
    await ev(() => { window.__game.playerSoldier.ads = true; }); await shot('07-durbun-yakinlastirma');
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier; me.ads = false; V.seatTo(me, 1); me.yaw = me.veh.st.yaw + 0.5; me.pitch = -0.05; });
    await ev(() => { window.__game.player.fireHeld = true; }); await shot('08-kule-makinelisi', 500); await ev(() => { window.__game.player.fireHeld = false; });
    const gun = await ev(() => { const me = window.__game.playerSoldier; return me.seat; });
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = me.veh; V.exit(me); const b = g.soldiers.find((s) => s.team === 'blue' && s !== me); b.spawn({ x: v.st.x + 4, z: v.st.z, ry: 0 }, 0); V.enter(b, v, 1); me.pos.set(v.st.x - 9, v.st.y, v.st.z + 6); g.world.settle(me); me.yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); me.pitch = -0.1; v.hp = 420; });
    await shot('09-disaridan-nisanci-hasarli', 1600);
    await ev(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-T1'); v.hp = 150; }); await shot('10-yaniyor', 2200);
    await ev(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-T1'); v.hp = 1; }); await shot('11-enkaz', 3500);
    if (tod === 'day') {
      ok(rl > 2.5 && gun === 1, 'tarayıcı tank: sol tık ana top (dolum başladı), 2 → nişancı makinelisi', `dolum ${rl.toFixed(1)} · koltuk ${gun}`);
      await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-T2'); me.pos.set(v.st.x + 2.6, v.st.y, v.st.z); g.world.settle(me); V.toggle(me); v.st.x = 333; v.st.z = -40; v.st.y = g.world.heightAt(333, -40); v.st.yaw = 0.05; v.st.tyaw = 0.05; g.player.vehCam = 'third'; me.yaw = 0.05 + 2.3; me.pitch = -0.3; });
      await page.keyboard.down('KeyW'); await shot('12-gecit-su', 2600); await page.keyboard.up('KeyW');
    }
    ok(!errs.length, `tarayıcı tank (${tod === 'day' ? 'gündüz' : 'gece'}): sayfa hatası yok`, errs.slice(0, 2).join(' | '));
    await page.context().close();
  }
  // 12.179 HELİKOPTER görüntüleri → /tmp/wb-arac/heli
  const HOUT = OUT.replace(/jip\/?$/, 'heli'); fs.mkdirSync(HOUT, { recursive: true });
  for (const tod of ['day', 'night']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=${tod}&debug=1&nolock=1&nologin=1`);
    await page.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
    await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a), shot = async (n, w = 400) => { await page.waitForTimeout(w); await page.screenshot({ path: `${HOUT}/${tod === 'night' ? 'gece-' : ''}${n}.png` }); };
    await ev(() => { const g = window.__game; g.brainsOff = g.brains.splice(0); g.devGod = true; g.playerSoldier.fly = false; });
    if (tod === 'day') { await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-H1'); me.pos.set(v.st.x + 9, v.st.y, v.st.z - 8); g.world.settle(me); me.yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); me.pitch = 0.05; }); await shot('01-helipadde'); }
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-H1'); me.pos.set(v.st.x + 2.6, v.st.y, v.st.z); g.world.settle(me); V.toggle(me); g.player.vehCam = 'third'; me.yaw = v.st.yaw; me.pitch = -0.2; v.lights = g.night; });
    await shot('02-pilot-rotor-donuyor', 1800);
    if (tod === 'day') await ev(() => { const g = window.__game, V = g.vehicles, v = g.playerSoldier.veh; g.soldiers.filter((s) => s.team === 'blue' && !s.isPlayer).slice(0, 2).forEach((b, i) => V.enter(b, v, i + 2)); });      // 12.192: sağ kapı nişancısı + kabin yolcusu (bot)
    await page.keyboard.down('Space'); await page.waitForTimeout(3200); await shot('03-kalkis-rotor-ruzgari', 0); await page.waitForTimeout(2500); await page.keyboard.up('Space');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(2800); await shot('04-ileri-ucus', 0);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(900); await shot('05-yana-yatis', 0);
    if (tod === 'day') {      // 12.192: eğik (ileri + yana) uçan helikopterde koltuktakilerin modeli gövdenin koltuğunda (eskiden 0,15–0,25 m kayıyordu), kapı nişancısı kapıya dönük
      const rs = await ev(() => { const g = window.__game, V = g.vehicles, v = g.playerSoldier.veh, M = g.vehView.items[v.idx].model, B = M.userData.body || M;
        return new Promise((res) => requestAnimationFrame(() => { M.updateMatrixWorld(true); res({ tilt: +(Math.abs(v.st.pitch) + Math.abs(v.st.roll)).toFixed(2), s: v.seats.map((s, i) => { if (!s || !s.model.root.visible) return null; const r = s.model.root, l = B.worldToLocal(r.getWorldPosition(new r.position.constructor())), sp = v.def.seat[i]; const q = B.getWorldQuaternion(new r.quaternion.constructor()).invert().multiply(r.quaternion), fx = new r.position.constructor(0, 0, -1).applyQuaternion(q); return [i, +Math.hypot(l.x - sp[1], l.z + sp[0]).toFixed(3), +Math.atan2(-fx.x, -fx.z).toFixed(2)]; }).filter(Boolean) }); })); });
      const off = Math.max(...rs.s.map((x) => x[1])), gun = rs.s.find((x) => x[0] === 2);
      ok(rs.tilt > 0.15 && rs.s.length >= 2 && off < 0.02 && gun && Math.abs(gun[2] + Math.PI / 2) < 0.15, 'tarayıcı helikopter: eğik uçuşta koltuktakiler gövdenin koltuğunda (kayma yok), sağ kapı nişancısı kapıya dönük', JSON.stringify(rs));
    }
    await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
    await ev(() => { window.__game.player.vehCam = 'first'; }); await shot('06-kokpit', 700);
    await ev(() => { const g = window.__game, me = g.playerSoldier; g.player.vehCam = 'third'; me.yaw = me.veh.st.yaw + 2.7; me.pitch = -0.35; }); await shot('07-onden-takip', 700);
    const flew = await ev(() => { const g = window.__game, v = g.playerSoldier.veh; return { alt: v.st.y - g.world.heightAt(v.st.x, v.st.z), d: Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) }; });
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier; V.seatTo(me, 1); me.yaw = me.veh.st.yaw + Math.PI / 2; me.pitch = -0.45; });
    await ev(() => { window.__game.player.fireHeld = true; }); await shot('08-kapi-nisancisi', 700); await ev(() => { window.__game.player.fireHeld = false; });
    const seat = await ev(() => window.__game.playerSoldier.seat);
    if (tod === 'day') ok(flew.alt > 15 && flew.d > 30 && seat === 1, 'tarayıcı helikopter: Boşluk kalkış, W ileri uçuş, 2 → sol kapı nişancısı', `irtifa ${flew.alt.toFixed(0)} m · ${flew.d.toFixed(0)} m · koltuk ${seat}`);
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = me.veh; V.seatTo(me, 0); });
    await page.keyboard.down('KeyC'); await page.waitForTimeout(4500); await page.keyboard.up('KeyC');
    await ev(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = me.veh; V.exit(me); me.pos.set(v.st.x - 12, g.world.heightAt(v.st.x - 12, v.st.z + 10), v.st.z + 10); g.world.settle(me); me.yaw = Math.atan2(-(v.st.x - me.pos.x), -(v.st.z - me.pos.z)); me.pitch = Math.atan2(v.st.y + 1.5 - me.pos.y - 1.6, Math.hypot(v.st.x - me.pos.x, v.st.z - me.pos.z)); v.hp = 140; });
    await shot('09-hasarli-yaniyor', 1800);
    await ev(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-H1'); v.hp = 1; }); await shot('10-enkaz', 3000);
    if (tod === 'day') {      // 12.192: geliştirici uçuşu (L) 3. şahısta: donmuş zıplama pozu yok (bacaklar sarkık, ileri uçuşta hafif yatış)
      await ev(() => { const g = window.__game, me = g.playerSoldier; if (!me.alive) g.respawn(me); if (me.veh) g.vehicles.exit(me); me.fly = true; me.pos.y += 15; if (!g.player.third) g.player.toggleThird(); });
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1200);
      const fp = await ev(() => { const me = window.__game.playerSoldier, p = me.model.parts; return { vis: me.model.root.visible, hipL: +p.legs.L.hip.rotation.x.toFixed(2), kneeL: +p.legs.L.knee.rotation.x.toFixed(2), lean: +(me.flyLean || 0).toFixed(2) }; });
      await shot('12-gelistirici-ucusu-3sahis', 0); await page.keyboard.up('KeyW');
      ok(fp.vis && fp.hipL < 0.35 && fp.kneeL > -0.6 && fp.lean > 0.1, 'tarayıcı: geliştirici uçuşu 3. şahıs — süzülme pozu (bacaklar sarkık, ileri yatış)', JSON.stringify(fp));
      await ev(() => { const g = window.__game, me = g.playerSoldier; me.fly = false; if (g.player.third) g.player.toggleThird(); });
    }
    ok(!errs.length, `tarayıcı helikopter (${tod === 'day' ? 'gündüz' : 'gece'}): sayfa hatası yok`, errs.slice(0, 2).join(' | '));
    await page.context().close();
  }
  // telefon (Pixel 7 profili): dokunmatik araç butonları
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', locale: 'tr-TR' });
  const mp = await ctx.newPage(); const merr = []; mp.on('pageerror', (e) => merr.push(e.message));
  await mp.goto(`${URL0}/?autostart=4v4&map=kuzey&type=conquest&tod=day&debug=1&nolock=1&nologin=1&touch=1`);
  await mp.waitForFunction('window.__game && window.__game.running', null, { timeout: 180000 });
  await mp.waitForTimeout(1500);
  await mp.evaluate(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, v = V.list.find((x) => x.id === 'B-J1'); g.brainsOff = g.brains.splice(0); me.fly = false; me.pos.set(v.st.x + 2.2, v.st.y, v.st.z + 1); g.world.settle(me); me.yaw = Math.PI / 2 + 0.3; me.pitch = -0.2; });
  await mp.waitForTimeout(500);
  const btn = await mp.evaluate(() => { const b = document.querySelector('#tc [data-b="veh"]'); return b && !b.classList.contains('hid') ? b.getBoundingClientRect().toJSON() : null; });
  await mp.screenshot({ path: `${OUT}/11-telefon-yaninda.png` });
  if (btn) await mp.touchscreen.tap(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await mp.waitForTimeout(500);
  const mv = await mp.evaluate(() => { const g = window.__game, me = g.playerSoldier; if (me.veh) { me.yaw = me.veh.st.yaw + 2.6; me.pitch = -0.3; } return { veh: me.veh?.id, vcam: !document.querySelector('#tc [data-b="vcam"]').classList.contains('hid'), seat: !document.querySelector('#tc [data-b="seat"]').classList.contains('hid') }; });
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: `${OUT}/12-telefon-surucu.png` });
  await mp.evaluate(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, t = V.list.find((x) => x.id === 'B-T1'); V.exit(me); me.pos.set(t.st.x + 2.6, t.st.y, t.st.z); g.world.settle(me); V.toggle(me); me.yaw = t.st.yaw + 2.6; me.pitch = -0.25; });
  await mp.waitForTimeout(900); await mp.screenshot({ path: `${OUT.replace(/jip\/?$/, 'tank')}/13-telefon-tank.png` });
  const mh = await mp.evaluate(() => { const g = window.__game, V = g.vehicles, me = g.playerSoldier, H = V.list.find((x) => x.id === 'B-H1'); V.exit(me); me.pos.set(H.st.x + 2.6, H.st.y, H.st.z); g.world.settle(me); V.toggle(me); me.yaw = H.st.yaw; me.pitch = -0.2; const vis = (k) => { const b = document.querySelector(`#tc [data-b="${k}"]`); return b && !b.classList.contains('hid') && !b.classList.contains('vh'); }; return { veh: me.veh?.id }; });
  await mp.waitForTimeout(3300);
  const jb = await mp.evaluate(() => document.querySelector('#tc [data-b="jump"]').getBoundingClientRect().toJSON());
  const y0 = await mp.evaluate(() => window.__game.playerSoldier.veh.st.y);
  await mp.touchscreen.tap(jb.x + jb.width / 2, jb.y + jb.height / 2);
  await mp.evaluate(() => { const T = window.__game.player.touch; T.jump = true; }); await mp.waitForTimeout(2500); await mp.evaluate(() => { window.__game.player.touch.jump = false; });
  const hm = await mp.evaluate((y0) => { const g = window.__game, v = g.playerSoldier.veh, vis = (k) => { const b = document.querySelector(`#tc [data-b="${k}"]`); return !!b && !b.classList.contains('hid') && !b.classList.contains('vh'); }; return { up: +(v.st.y - y0).toFixed(1), crouch: vis('crouch'), jump: vis('jump'), vcam: vis('vcam') }; }, y0);
  await mp.screenshot({ path: `${OUT.replace(/jip\/?$/, 'heli')}/11-telefon-pilot.png` });
  ok(mh.veh === 'B-H1' && hm.up > 5 && hm.crouch && hm.jump && hm.vcam, 'telefon helikopter: zıpla butonu basılıyken yükselir, çömel butonu = alçal, kamera butonu', JSON.stringify(hm));
  // 12.183: alçal (çömel) basılıyken inilip sonra bırakılınca alçal isteği takılı kalmasın
  const dk = await mp.evaluate(() => { const g = window.__game, T = g.player.touch; T.press('crouch', true); const held = T.down; T.press('veh', true); T.press('veh', false); const out = !g.playerSoldier.veh; T.press('crouch', false); return { held, out, after: !!T.down }; });
  ok(dk.held && dk.out && !dk.after, 'telefon helikopter: alçal basılıyken inip bırakınca alçal isteği söner (sonraki binişte kendiliğinden alçalmaz)', JSON.stringify(dk));
  ok(btn && mv.veh === 'B-J1' && mv.vcam && mv.seat && !merr.length, 'telefon: araç yanında "bin" butonu, dokununca sürücü; kamera + koltuk butonları (joystick = gaz / direksiyon, zıpla = fren, ateş = korna)', JSON.stringify(mv) + (merr.length ? ' · ' + merr[0] : ''));
  await browser.close();
}

// ───────── 3b) çevrim içi TANK (12.178): A sürücü + top, B nişancı (makineli) ─────────
async function onlineTank(chromium) {
  const tag = process.env.PROXY ? ' [vekil ' + process.env.PROXY + ']' : '';
  console.log('── çevrim içi: tank' + tag + ' ──');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p; };
  const A = await mk(), B = await mk();
  await A.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(SRV)}&map=kuzey&type=conquest&per=4&team=blue&debug=1&nolock=1&nologin=1`);
  await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  const code = await A.evaluate(() => window.__game._badgeCode);
  await B.goto(`${URL0}/?online=${code}&name=Veli&team=blue&server=${encodeURIComponent(SRV)}&debug=1&nolock=1&nologin=1`);
  await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  for (const P of [A, B]) await P.evaluate(() => window.__game.online.send({ t: 'dbg', bots: false }));
  await A.waitForTimeout(1500);
  const jp = await A.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-T1'); return [v.st.x, v.st.z]; });
  await A.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] + 2.6, p[1]] }), jp);
  await B.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] - 2.6, p[1] + 0.5] }), jp);
  await A.waitForTimeout(1500);
  await A.keyboard.press('KeyE'); await A.waitForTimeout(900); await B.keyboard.press('KeyE'); await B.waitForTimeout(900);
  const seats = await Promise.all([A, B].map((P) => P.evaluate(() => { const me = window.__game.playerSoldier; return [me.veh?.id, me.seat]; })));
  ok(seats[0][0] === 'B-T1' && seats[0][1] === 0 && seats[1][0] === 'B-T1' && seats[1][1] === 1, 'çevrim içi tank: A sürücü (top), B nişancı (makineli)' + tag, JSON.stringify(seats));
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', vtp: [0, 330, 0] }));
  await A.waitForTimeout(1800);
  const ids = await A.evaluate(() => { const g = window.__game, r = g.soldiers.filter((s) => s.team === 'red' && s.alive); g.online.send({ t: 'dbg', tps: [r[0].id, 0, 240, 0, 100] }); g.online.send({ t: 'dbg', tps: [r[1].id, 28, 300, 0, 100] }); g.player.vehCam = 'third'; g.playerSoldier.yaw = 0; g.playerSoldier.pitch = 0; return [r[0].id, r[1].id]; });
  await A.waitForTimeout(700);
  await A.evaluate(() => { const s = window.__game.online.stats; s.vehFix = 0; s.vehErrMax = 0; s.vehErrSum = 0; window.__c0 = s.corrections; });
  // sür + kuleyi çevir
  await A.keyboard.down('KeyW'); await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; window.__aimI = setInterval(() => { me.yaw = Math.sin(performance.now() / 600) * 0.8; }, 16); });
  await A.waitForTimeout(3500); await A.keyboard.up('KeyW');
  await A.keyboard.down('Space'); await A.waitForTimeout(1200); await A.keyboard.up('Space');
  await A.evaluate(() => clearInterval(window.__aimI));
  // nişan + ateş (A): hedef gövdesine top yayı (ikiye bölme, istemcinin gördüğü durumdan)
  const fireRes = await A.evaluate(async (id) => {
    const g = window.__game, me = g.playerSoldier, v = me.veh, D = v.def, T = g.soldiers[id];
    // 12.188: oyuncu gibi ARTIYI (kamera ışını) hedefin gövdesine koy — top balistik olarak artının noktasına hedeflenir (gy / gp girdisi)
    const aimAt = () => { const cam = g.camera.position, c = T.center(), dx = c.x - cam.x, dz = c.z - cam.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(c.y - cam.y, Math.hypot(dx, dz)); return Math.round(Math.hypot(c.x - v.st.x, c.z - v.st.z)); };
    const id2 = setInterval(aimAt, 16); const dist = aimAt();
    await new Promise((r) => setTimeout(r, 2600));
    let seen = 0; const h = (e) => { const m = JSON.parse(e.data); if (m.t === 'ev' && m.l.some((x) => x.e === 'ts')) seen++; }; g.online.ws.addEventListener('message', h);
    g.player.fireHeld = true; await new Promise((r) => setTimeout(r, 120)); g.player.fireHeld = false;
    await new Promise((r) => setTimeout(r, 2500)); clearInterval(id2);
    return { dist: Math.round(dist), seen, hp: T.hp, alive: T.alive, rl: +v.rl.toFixed(1) };
  }, ids[0]);
  ok(fireRes.seen >= 1 && (!fireRes.alive || fireRes.hp < 100), 'çevrim içi ana top: sunucu ateşler (ts), mermi yayla ' + fireRes.dist + ' m\'deki askeri öldürür, dolum sürer' + tag, JSON.stringify(fireRes));
  await A.screenshot({ path: `${OUT}/../tank/20-cevrimici-A-surucu${tag ? '-vekil' : ''}.png` });
  // B nişancı: 28 m yandaki düşmana makineli
  const mg = await B.evaluate(async (id) => {
    const g = window.__game, me = g.playerSoldier, T = g.soldiers[id];
    const aim = () => { const e = me.eye(), c = T.center(), dx = c.x - e.x, dz = c.z - e.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(c.y - e.y, Math.hypot(dx, dz)); };
    const i2 = setInterval(aim, 8); aim(); g.player.fireHeld = true;
    await new Promise((r) => setTimeout(r, 1500)); g.player.fireHeld = false; clearInterval(i2);
    await new Promise((r) => setTimeout(r, 500));
    return { hp: T.hp, alive: T.alive, d: Math.round(Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z)) };
  }, ids[1]);
  await B.screenshot({ path: `${OUT}/../tank/21-cevrimici-B-nisanci${tag ? '-vekil' : ''}.png` });
  ok(!mg.alive || mg.hp < 100, 'çevrim içi nişancı makinelisi isabet eder' + tag, JSON.stringify(mg));
  const st = await A.evaluate(() => { const s = window.__game.online.stats; return { fix: s.vehFix || 0, errMax: +(s.vehErrMax || 0).toFixed(3), avg: s.vehFix ? +(s.vehErrSum / s.vehFix).toFixed(3) : 0, corr: s.corrections - window.__c0, rtt: Math.round(s.rtt) }; });
  ok(st.errMax < (tag ? 0.6 : 0.3), 'tank sürücü tahmini (sürüş + kule)' + tag, `araç düzeltmesi ${st.fix} · en büyük ${st.errMax} m · ort ${st.avg} · RTT ${st.rtt} ms`);
  ok(!A.errs.length && !B.errs.length, 'çevrim içi tank: sayfa hatası yok' + tag, [...A.errs, ...B.errs].slice(0, 2).join(' | '));
  await browser.close();
}

// ───────── 3c) çevrim içi HELİKOPTER (12.179): A pilot, B sol kapı nişancısı ─────────
async function onlineHeli(chromium) {
  const tag = process.env.PROXY ? ' [vekil ' + process.env.PROXY + ']' : '';
  console.log('── çevrim içi: helikopter' + tag + ' ──');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p; };
  const A = await mk(), B = await mk();
  await A.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(SRV)}&map=kuzey&type=conquest&per=4&team=blue&debug=1&nolock=1&nologin=1`);
  await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  const code = await A.evaluate(() => window.__game._badgeCode);
  await B.goto(`${URL0}/?online=${code}&name=Veli&team=blue&server=${encodeURIComponent(SRV)}&debug=1&nolock=1&nologin=1`);
  await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  for (const P of [A, B]) await P.evaluate(() => { const g = window.__game; g.online.send({ t: 'dbg', bots: false }); window.__bytes = 0; g.online.ws.addEventListener('message', (e) => { window.__bytes += e.data.length; }); });
  await A.waitForTimeout(1500);
  const jp = await A.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-H1'); return [v.st.x, v.st.z, v.st.yaw]; });
  await A.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] + 2.4, p[1] - 1.5] }), jp);
  await B.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] - 2.2, p[1] + 0.3] }), jp);
  await A.waitForTimeout(1500);
  await A.keyboard.press('KeyE'); await A.waitForTimeout(900); await B.keyboard.press('KeyE'); await B.waitForTimeout(900);
  const seats = await Promise.all([A, B].map((P) => P.evaluate(() => { const me = window.__game.playerSoldier; return [me.veh?.id, me.seat]; })));
  ok(seats[0][0] === 'B-H1' && seats[0][1] === 0 && seats[1][0] === 'B-H1' && seats[1][1] === 1, 'çevrim içi helikopter: A pilot, B sol kapı nişancısı' + tag, JSON.stringify(seats));
  await A.evaluate(() => { const g = window.__game; g.player.vehCam = 'third'; g.playerSoldier.yaw = g.playerSoldier.veh.st.yaw; g.playerSoldier.pitch = -0.1; const s = g.online.stats; s.vehFix = 0; s.vehErrMax = 0; s.vehErrSum = 0; window.__c0 = s.corrections; });
  const bw0 = await A.evaluate(async () => { const b = window.__bytes; await new Promise((r) => setTimeout(r, 3000)); return (window.__bytes - b) / 3; });
  await A.keyboard.down('Space'); await A.waitForTimeout(6500); await A.keyboard.up('Space');
  // 12.183: pilotun KENDİ helikopterinde (tahmin edilen araç) rotor döner + bulanıklık diski; nişancı (B) da aynısını görür
  const rs = await Promise.all([A, B].map((P) => P.evaluate(async () => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-H1'), U = g.vehView.items[v.idx].model.userData, a0 = U.rotor.rotation.y; await new Promise((r) => setTimeout(r, 500)); return { spin: +(U.rotor.rotation.y - a0).toFixed(1), blur: U.blur.visible, pred: v.pred }; })));
  ok(rs.every((r) => r.spin > 8 && r.blur) && rs[0].pred, 'çevrim içi: pilotun kendi helikopterinde ve nişancıda rotor döner (bulanıklık diski)' + tag, JSON.stringify(rs));
  const bwP = A.evaluate(async () => { const b = window.__bytes; await new Promise((r) => setTimeout(r, 6000)); return (window.__bytes - b) / 6; });
  await A.keyboard.down('KeyW'); await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; window.__aimI = setInterval(() => { me.yaw += 0.006; }, 16); });
  await A.waitForTimeout(4500); await A.keyboard.up('KeyW'); await A.evaluate(() => clearInterval(window.__aimI));
  await A.waitForTimeout(1500);
  const bwF = await bwP;
  // B nişancı: helikopterin soluna kırmızı bir asker, havadan makineli
  const tg = await A.evaluate(() => { const g = window.__game, v = g.playerSoldier.veh, r = g.soldiers.find((s) => s.team === 'red' && s.alive), lx = Math.cos(v.st.yaw + Math.PI / 2), lz = -Math.sin(v.st.yaw + Math.PI / 2); const x = v.st.x - Math.sin(v.st.yaw + Math.PI / 2) * 28, z = v.st.z - Math.cos(v.st.yaw + Math.PI / 2) * 28; g.online.send({ t: 'dbg', tps: [r.id, x, z, 0, 100] }); return r.id; });
  await A.waitForTimeout(800);
  const mg = await B.evaluate(async (id) => {
    const g = window.__game, me = g.playerSoldier, T = g.soldiers[id];
    const aim = () => { const e = me.eye(), c = T.center(), dx = c.x - e.x, dz = c.z - e.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(c.y - e.y, Math.hypot(dx, dz)); };
    const i2 = setInterval(aim, 8); aim(); g.player.fireHeld = true;
    await new Promise((r) => setTimeout(r, 2000)); g.player.fireHeld = false; clearInterval(i2);
    await new Promise((r) => setTimeout(r, 500));
    return { hp: T.hp, alive: T.alive, d: Math.round(Math.hypot(T.pos.x - me.pos.x, T.pos.z - me.pos.z)), alt: Math.round(me.pos.y - g.world.heightAt(me.pos.x, me.pos.z)) };
  }, tg);
  await A.screenshot({ path: `${OUT}/../heli/20-cevrimici-A-pilot${tag ? '-vekil' : ''}.png` }); await B.screenshot({ path: `${OUT}/../heli/21-cevrimici-B-kapi-nisancisi${tag ? '-vekil' : ''}.png` });
  ok(!mg.alive || mg.hp < 100, 'çevrim içi kapı nişancısı uçan helikopterden isabet eder' + tag, JSON.stringify(mg));
  const st = await A.evaluate(() => { const s = window.__game.online.stats; return { fix: s.vehFix || 0, errMax: +(s.vehErrMax || 0).toFixed(3), corr: s.corrections - window.__c0, rtt: Math.round(s.rtt) }; });
  const bv = await Promise.all([A, B].map((P) => P.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-H1'); return [v.st.x, v.st.y, v.st.z]; })));
  ok(st.errMax < (tag ? 0.6 : 0.3), 'pilot tahmini (kalkış + ileri uçuş + dönüş)' + tag, `araç düzeltmesi ${st.fix} · en büyük ${st.errMax} m · RTT ${st.rtt} ms · A↔B konum farkı ${Math.hypot(bv[0][0] - bv[1][0], bv[0][1] - bv[1][1], bv[0][2] - bv[1][2]).toFixed(2)} m (durunca)`);
  ok(bwF - bw0 < 6000, 'bant genişliği: yerde ↔ uçarken (istemci başına)' + tag, `${(bw0 / 1024).toFixed(1)} → ${(bwF / 1024).toFixed(1)} KB/sn`);
  // pilot iner (havada): helikopter düşer, patlar; iki istemcide enkaz
  await A.evaluate(() => { const g = window.__game, me = g.playerSoldier; window.__fall = []; window.__fi = setInterval(() => { const H = g.vehicles.list.find((x) => x.id === 'B-H1'); window.__fall.push([+me.pos.y.toFixed(1), +(me.pos.y - g.world.heightAt(me.pos.x, me.pos.z)).toFixed(1), me.hp, me.alive, !!me.veh, me.swim ? 'S' : '', H.st ? +(H.st.y - g.world.heightAt(H.st.x, H.st.z)).toFixed(1) : null, H.st ? +(H.st.rpm || 0).toFixed(2) : null, Math.round(H.hp), H.alive, H.st ? [+H.st.x.toFixed(1), +H.st.y.toFixed(2), +H.st.z.toFixed(1), +H.st.pitch.toFixed(2), +H.st.roll.toFixed(2), H.st.air ? 1 : 0] : null]); }, 500); });
  await A.keyboard.press('KeyE'); await A.waitForTimeout(9000);
  const fall = await A.evaluate(() => { clearInterval(window.__fi); return window.__fall; }), pilotDied = fall.some((f) => !f[3]), fallH = Math.max(...fall.map((f) => f[1]));
  const boom = await Promise.all([A, B].map((P) => P.evaluate(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-H1'), me = g.playerSoldier; return { wreck: v.wreck, alive: v.alive, me: me.alive, y: +(v.st?.y - g.world.heightAt(v.st.x, v.st.z)).toFixed(1), rpm: +(v.st?.rpm || 0).toFixed(2), hp: Math.round(v.hp), seats: v.seats.map((s) => (s ? s.name : "-")).join("/") }; })));
  await B.screenshot({ path: `${OUT}/../heli/22-cevrimici-dusus${tag ? '-vekil' : ''}.png` });
  ok(boom.every((b) => !b.alive) && pilotDied, 'pilot havada inerse: helikopter düşüp patlar (iki istemcide), atlayan pilot düşüp ölür' + tag, `${JSON.stringify(boom)} · pilot ${fallH.toFixed(0)} m'den düştü${pilotDied && boom.every((b) => !b.alive) ? '' : ' · ' + JSON.stringify(fall.slice(0, 18))}`);
  ok(!A.errs.length && !B.errs.length, 'çevrim içi helikopter: sayfa hatası yok' + tag, [...A.errs, ...B.errs].slice(0, 2).join(' | '));
  await browser.close();
}

// ───────── 3) çevrim içi ─────────
async function online(chromium) {
  console.log('── çevrim içi ──');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'tr-TR' })).newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p; };
  const A = await mk(), B = await mk();
  await A.goto(`${URL0}/?online=new&name=Ali&server=${encodeURIComponent(SRV)}&map=kuzey&type=conquest&per=4&team=blue&tod=sunset&debug=1&nolock=1&nologin=1`);
  await A.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  const code = await A.evaluate(() => window.__game._badgeCode);
  await B.goto(`${URL0}/?online=${code}&name=Veli&team=blue&server=${encodeURIComponent(SRV)}&debug=1&nolock=1&nologin=1`);
  await B.waitForFunction('window.__game && window.__game.running && window.__game.playerSoldier.alive', null, { timeout: 240000 });
  for (const P of [A, B]) await P.evaluate(() => { const g = window.__game; g.online.send({ t: 'dbg', bots: false }); window.__bytes = 0; g.online.ws.addEventListener('message', (e) => { window.__bytes += e.data.length; }); });
  await A.waitForTimeout(1500);
  const jp = await A.evaluate(() => { const v = window.__game.vehicles.list.find((x) => x.id === 'B-J1'); return [v.st.x, v.st.z]; });
  await A.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] + 2, p[1]] }), jp);
  await B.evaluate((p) => window.__game.online.send({ t: 'dbg', tp: [p[0] - 2, p[1] + 0.5] }), jp);
  await A.waitForTimeout(1500);
  const bw0 = await A.evaluate(async () => { const b = window.__bytes; await new Promise((r) => setTimeout(r, 4000)); return (window.__bytes - b) / 4; });
  await A.keyboard.press('KeyE'); await A.waitForTimeout(600); await B.keyboard.press('KeyE'); await B.waitForTimeout(800);
  const seats = await Promise.all([A, B].map((P) => P.evaluate(() => { const me = window.__game.playerSoldier; return [me.veh?.id, me.seat]; })));
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', vtp: [0, 330, 0] }));              // açık çayıra (üs HESCO duvarı önünde)
  await A.waitForTimeout(1800);
  ok(seats[0][0] === 'B-J1' && seats[0][1] === 0 && seats[1][0] === 'B-J1' && seats[1][1] === 1, 'çevrim içi: A sürücü, B ön yolcu (sunucu onayıyla)', JSON.stringify(seats));
  // hedef: kırmızı bir asker yolun yanına (B hareket hâlinde ona ateş eder)
  const tgt = await A.evaluate(() => { const g = window.__game, r = g.soldiers.find((s) => s.team === 'red' && s.alive); g.online.send({ t: 'dbg', tps: [r.id, 18, 262, 0, 100] }); return r.id; });
  await A.evaluate(() => { const g = window.__game; g.player.vehCam = 'third'; g.playerSoldier.yaw = g.playerSoldier.veh.st.yaw; });
  const rec = (P) => P.evaluate(() => { window.__rec = []; const id = setInterval(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-J1'); if (v?.st) window.__rec.push([Date.now(), v.st.x, v.st.z, g.online.stats.delay]); }, 30); window.__recStop = () => clearInterval(id); });
  await rec(A); await rec(B);
  const bwP = A.evaluate(async () => { const b = window.__bytes; await new Promise((r) => setTimeout(r, 8000)); return (window.__bytes - b) / 8; });
  await A.evaluate(() => { const s = window.__game.online.stats; s.vehFix = 0; s.vehErrMax = 0; s.vehErrSum = 0; window.__c0 = s.corrections; });
  await A.keyboard.down('KeyW'); await A.waitForTimeout(2200);
  // B: hareketli araçtan hedefe nişan + ateş (1,6 sn)
  const hit = B.evaluate(async (id) => {
    const g = window.__game, me = g.playerSoldier, t = g.soldiers[id], hp0 = t.hp;
    const aim = () => { const e = me.eye(), c = t.center(); const dx = c.x - e.x, dz = c.z - e.z; me.yaw = Math.atan2(-dx, -dz); me.pitch = Math.atan2(c.y - e.y, Math.hypot(dx, dz)); };
    const id2 = setInterval(aim, 8); aim(); g.player.fireHeld = true;
    const m0 = me.item.mag, sv = new Promise((r) => { const h = (e) => { const m = JSON.parse(e.data); if (m.t === 'dbg') { g.online.ws.removeEventListener('message', h); r(m.sv); } }; g.online.ws.addEventListener('message', h); });
    await new Promise((r) => setTimeout(r, 1600));
    g.player.fireHeld = false; clearInterval(id2);
    const m1 = me.item.mag; g.online.send({ t: 'dbg', ask: 1 });
    await new Promise((r) => setTimeout(r, 400));
    return { hp0, hp: t.hp, alive: t.alive, d: Math.hypot(t.pos.x - me.pos.x, t.pos.z - me.pos.z), shots: m0 - m1, sv: await sv, tp: [t.pos.x, t.pos.y, t.pos.z].map((x) => +x.toFixed(1)), mp: [me.pos.x, me.pos.y, me.pos.z].map((x) => +x.toFixed(1)) };
  }, tgt);
  await A.waitForTimeout(1200);
  await A.screenshot({ path: `${OUT}/20-cevrimici-A-surucu.png` }); await B.screenshot({ path: `${OUT}/21-cevrimici-B-yolcu.png` });
  const hr = await hit;
  await A.keyboard.down('KeyD'); await A.waitForTimeout(800); await A.keyboard.up('KeyD'); await A.waitForTimeout(1500);
  await A.keyboard.up('KeyW'); await A.keyboard.down('Space'); await A.waitForTimeout(1500); await A.keyboard.up('Space');
  const bwD = await bwP;
  const ra = await A.evaluate(() => { window.__recStop(); return window.__rec; }), rb = await B.evaluate(() => { window.__recStop(); return window.__rec; });
  const at = (r, t) => { for (let i = 1; i < r.length; i++) if (r[i][0] >= t) { const a = r[i - 1], b = r[i], k = (t - a[0]) / Math.max(1, b[0] - a[0]); return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; } return null; };
  const rtts = await Promise.all([A, B].map((P) => P.evaluate(() => window.__game.online.stats.rtt || 0)));
  const lag = (rtts[0] + rtts[1]) / 2;                                // A'nın tahmini sunucunun ~RTT/2 önünde, B'nin görüntüsü sunucunun RTT/2 + interpolasyon gecikmesi arkasında
  const es = []; for (const s of rb) { const p = at(ra, s[0] - (s[3] || 100) - 15 - lag); if (p) es.push(Math.hypot(p[0] - s[1], p[1] - s[2])); }
  es.sort((a, b) => a - b);
  const st = await A.evaluate(() => { const s = window.__game.online.stats; return { fix: s.vehFix || 0, errMax: +(s.vehErrMax || 0).toFixed(3), corr: s.corrections - window.__c0, rtt: Math.round(s.rtt) }; });
  const dist = Math.hypot(ra[ra.length - 1][1] - ra[0][1], ra[ra.length - 1][2] - ra[0][2]);
  ok(dist > 40 && st.errMax < (process.env.PROXY ? 0.6 : 0.3), 'sürücü tahmini: sunucuyla uyumlu (araç düzeltmesi az)' + (process.env.PROXY ? ' [vekil ' + process.env.PROXY + ']' : ''), `yol ${dist.toFixed(0)} m · düzeltme ${st.fix} · en büyük ${st.errMax} m · asker düzeltmesi ${st.corr} · RTT ${st.rtt} ms`);
  ok(es.length > 100 && es[es.length >> 1] < (process.env.PROXY ? 0.6 : 0.25) && es[Math.floor(es.length * 0.95)] < (process.env.PROXY ? 1.2 : 0.4), 'B (yolcu) aracı A ile aynı yolda görür (interpolasyon gecikmesi + RTT kaydırılınca)', `medyan ${es[es.length >> 1]?.toFixed(3)} m · %95 ${es[Math.floor(es.length * 0.95)]?.toFixed(3)} m · ${es.length} örnek`);
  ok(bwD - bw0 < 6000, 'bant genişliği: park ↔ bir jip sürülürken (istemci başına)', `${(bw0 / 1024).toFixed(1)} → ${(bwD / 1024).toFixed(1)} KB/sn (+${((bwD - bw0) / 1024).toFixed(1)})`);
  ok(hr.hp < hr.hp0 || !hr.alive, 'hareketli araçtan yolcu isabeti (geri sarma atıcının koltuğuna da)', `${Math.round(hr.d)} m · ${hr.shots} atış · can ${hr.hp0} → ${hr.hp}${hr.alive ? '' : ' (öldü)'}` + (hr.hp < hr.hp0 || !hr.alive ? '' : ' · ' + JSON.stringify(hr)));
  // 12.183: sürücünün tahmin ettiği araçta far / yanma sunucudan (eskiden sürücüde hiç güncellenmiyordu: F ters, yanma uyarısı yok)
  const lt0 = await Promise.all([A, B].map((P) => P.evaluate(() => window.__game.vehicles.list.find((x) => x.id === 'B-J1').lights)));      // gün batımı: binince sunucu farı yakar
  await A.keyboard.press('KeyF'); await A.waitForTimeout(1300);
  const lt1 = await Promise.all([A, B].map((P) => P.evaluate(() => window.__game.vehicles.list.find((x) => x.id === 'B-J1').lights)));
  const lt = lt0[0] && lt0[1] && !lt1[0] && !lt1[1] ? [1, 1] : [lt0.join('/'), lt1.join('/')];
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', vdmg: [window.__game.playerSoldier.veh.idx, 330, 'impact'] })); await A.waitForTimeout(900);
  const bu = await A.evaluate(() => { const g = window.__game, v = g.playerSoldier.veh; return { burn: v?.burn, warn: g.vehHud.q.warn.style.display }; });
  ok(lt[0] === 1 && bu.burn && bu.warn === 'block', 'çevrim içi sürücü: far binişte (gün batımı) ve F sonrası B ile aynı, kendi aracının yandığını görür (uyarı)', `far (binişte / F sonrası) ${lt.join(' → ')} · ${JSON.stringify(bu)}`);
  // araç patlat: iki istemcide enkaz, içindekiler ölür
  await A.evaluate(() => window.__game.online.send({ t: 'dbg', vdmg: [window.__game.playerSoldier.veh.idx, 9999, 'blast'] }));
  await A.waitForTimeout(1500);
  const boom = await Promise.all([A, B].map((P) => P.evaluate(() => { const g = window.__game, v = g.vehicles.list.find((x) => x.id === 'B-J1'), me = g.playerSoldier; return { wreck: v.wreck, alive: v.alive, me: me.alive, inV: !!me.veh }; })));
  await A.screenshot({ path: `${OUT}/22-cevrimici-patlama-A.png` });
  ok(boom.every((b) => b.wreck && !b.alive && !b.me && !b.inV), 'araç patlayınca: iki istemcide enkaz, sürücü + yolcu ölür, koltuk kaydı kalmaz', JSON.stringify(boom));
  ok(!A.errs.length && !B.errs.length, 'çevrim içi: sayfa hatası yok', [...A.errs, ...B.errs].slice(0, 2).join(' | '));
  await browser.close();
}

if (!ONLY || ONLY === 'headless') headless();
if (!ONLY || ONLY === 'headless' || ONLY === 'tank') headlessTank();
if (!ONLY || ONLY === 'headless' || ONLY === 'heli') headlessHeli();
let chromium = null;
try { ({ chromium } = await import('playwright')); } catch { console.log('(playwright yok: tarayıcı bölümleri atlandı)'); }
const up = async (u) => { try { const r = await fetch(u); return r.ok; } catch { return false; } };
if (chromium && (!ONLY || ONLY === 'browser')) { if (await up(URL0)) await browserOffline(chromium); else console.log('(vite yok: ' + URL0 + ' — çevrimdışı tarayıcı bölümü atlandı)'); }
if (chromium && (!ONLY || ONLY === 'online' || ONLY === 'onlinetank' || ONLY === 'onlineheli')) {
  if (await up(SRV.replace(/^ws/, 'http') + '/health') || process.env.PROXY) { if (ONLY !== 'onlinetank' && ONLY !== 'onlineheli') await online(chromium); if (ONLY !== 'onlineheli') await onlineTank(chromium); await onlineHeli(chromium); }
  else console.log('(sunucu yok: ' + SRV + ' — çevrim içi bölüm atlandı)');
}
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
