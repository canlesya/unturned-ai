// 12.213 kule + sabit yuva başsız testi: node scripts/towertest.mjs
// (1) kule çarpışmaları: iç içe geçen kutu yok, merdiven basamakları ≤ 0,31 m, platform kotu = yuva kotu; (2) yürüyerek çıkış (World.move ile
// merdivenden platforma, sonra iniş); (3) yuvalar doğdu mu, kalkan önden mermiyi keser / arkadan nişancı vurulur; (4) hasarlar: HMG piyade kaç
// mermide, jipe; tanksavar tanka önden / arkadan kaç isabet; (5) bot nav: yerden kule tepesine yol + gerçek bot kuleye çıkıp nişancı mevzisinde durur;
// (6) bot yuvaya biner ve düşmana ateş eder. Hata sayısı 0 olmalı.
import * as THREE from 'three';
import { Game } from '../src/game/game.js';
import { VT } from '../src/sim/vehicle.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'OK  ' : 'HATA') + ' ' + m); };
const game = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 6, type: 'conquest' } });
const W = game.world, V = game.vehicles, M = game.map;
// ── 1 çarpışma ──
for (const t of M.towers) {
  const C = M.colliders.filter((c) => c.oid === t.id);
  let over = 0;
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const a = C[i], b = C[j], ox = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]), oy = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]), oz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    if (ox > 0.01 && oy > 0.01 && oz > 0.01) over++;
  }
  const plat = C.find((c) => c.tag === 'plat');
  ok(over === 0, `${t.id}: ${C.length} kutu, iç içe ${over}`);
  ok(plat && Math.abs(plat.max[1] - t.top) < 0.01, `${t.id}: platform üstü ${plat?.max[1].toFixed(2)} = kule ${t.top.toFixed(2)} · ${t.n} basamak × ${t.rs.toFixed(3)} m`);
  ok(t.rs <= 0.31, `${t.id}: basamak yüksekliği ${t.rs.toFixed(3)} ≤ 0,31`);
}
// ── 2 yürüyerek çıkış / iniş ──
const me = game.soldiers.find((s) => s.team === 'blue');
for (const t of M.towers) {
  const s = me; s.alive = true; s.veh = null; s.brain && (s.brain.frozen = true);
  s.pos.set(t.foot.x, W.heightAt(t.foot.x, t.foot.z), t.foot.z); s.vel.set(0, 0, 0); s.onGround = true;
  let k = 0, top = 0;
  for (const P of t.pts.slice(1)) {
    for (let n = 0; n < 240; n++) {
      const dx = P.x - s.pos.x, dz = P.z - s.pos.z, d = Math.hypot(dx, dz); if (d < 0.25) break;
      s.vel.x = dx / d * 3.5; s.vel.z = dz / d * 3.5; W.move(s, 1 / 60); k++;
    }
    top = Math.max(top, s.pos.y);
  }
  ok(Math.abs(s.pos.y - t.top) < 0.05, `${t.id}: yürüyerek platforma çıktı (y ${s.pos.y.toFixed(2)} / ${t.top.toFixed(2)}, ${k} adım)`);
  for (const P of t.pts.slice(0, -1).reverse()) for (let n = 0; n < 240; n++) { const dx = P.x - s.pos.x, dz = P.z - s.pos.z, d = Math.hypot(dx, dz); if (d < 0.25) break; s.vel.x = dx / d * 3.5; s.vel.z = dz / d * 3.5; W.move(s, 1 / 60); }
  s.vel.set(0, 0, 0); for (let n = 0; n < 40; n++) W.move(s, 1 / 60);
  ok(s.pos.y - W.heightAt(s.pos.x, s.pos.z) < 0.1, `${t.id}: merdivenden indi (zeminden ${(s.pos.y - W.heightAt(s.pos.x, s.pos.z)).toFixed(2)} m)`);
}
// ── 3 yuvalar ──
const E = V.list.filter((v) => v.def.fixed);
ok(E.length === M.emplacements.length && E.every((v) => v.alive), `${E.length} yuva doğdu (${E.filter((v) => v.type === 'hmg').length} HMG, ${E.filter((v) => v.type === 'atgm').length} tanksavar)`);
for (const v of E) if (v.spawn.tower) { const t = M.towers.find((q) => q.id === v.spawn.tower); ok(Math.abs(v.st.y - t.top) < 0.01, `${v.id}: kule tepesinde (y ${v.st.y.toFixed(2)})`); }
const hv = E.find((v) => v.spawn.tower), gunner = game.soldiers.find((s) => s.team === 'blue' && s !== me);
V.enter(gunner, hv, 0);
ok(gunner.veh === hv && Math.abs(gunner.pos.y - (hv.st.y + hv.def.seat[0][2] - 0.5)) < 0.05, `nişancı koltukta (ayak ${(gunner.pos.y - hv.st.y).toFixed(2)} m)`);
{
  const st = hv.st, fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), c = gunner.center(new THREE.Vector3());
  const o = new THREE.Vector3(c.x + fx * 30, c.y, c.z + fz * 30), d = new THREE.Vector3(c.x - o.x, 0, c.z - o.z).normalize();
  const vr = V.raycast(o, d, 40), hs = game.hitSoldier(gunner, o, d, 40);
  ok(vr && vr.v === hv && (!hs || vr.t < hs.t), `önden göğse mermi kalkana çarpar (araç ${vr?.t.toFixed(2)} m, asker ${hs?.t.toFixed(2)} m)`);
  const o2 = new THREE.Vector3(c.x - fx * 30, c.y, c.z - fz * 30), d2 = new THREE.Vector3(c.x - o2.x, 0, c.z - o2.z).normalize();
  const vr2 = V.raycast(o2, d2, 40), hs2 = game.hitSoldier(gunner, o2, d2, 40);
  ok(hs2 && (!vr2 || hs2.t < vr2.t), `arkadan nişancı vurulur (asker ${hs2?.t.toFixed(2)} m)`);
}
// ── 4 hasar ──
{
  const M2 = VT.hmg.mg, tg = game.soldiers.find((s) => s.team === 'red');
  ok(Math.ceil(100 / M2.dmg) <= 4 && Math.ceil(100 / (M2.dmg * M2.minMul)) <= 4, `HMG piyade: yakın ${Math.ceil(100 / M2.dmg)}, uzak ${Math.ceil(100 / (M2.dmg * M2.minMul))} mermi`);
  ok(VT.tank.hmgMul === 0, 'HMG tanka işlemez (hmgMul 0)');
  ok(Math.ceil(VT.jip.hp / (M2.vdmg * VT.jip.hmgMul)) <= 25, `HMG jipe ${Math.ceil(VT.jip.hp / (M2.vdmg * VT.jip.hmgMul))} isabet`);
  void tg;
}
const tank = V.list.find((v) => v.type === 'tank' && v.alive), at = E.find((v) => v.type === 'atgm');
for (const side of ['ön', 'arka', 'yan']) {
  let hits = 0;
  tank.hp = tank.def.hp; tank.alive = true;
  const red = game.soldiers.find((s) => s.team === 'red' && s !== gunner);
  tank.seats[0] = null; V.enter(red, tank, 0);
  while (tank.alive && hits < 6) {
    const st = tank.st, f = side === 'ön' ? 1 : side === 'arka' ? -1 : 0, r = side === 'yan' ? -1 : 0;
    const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
    const P = { x: st.x + fx * f * (tank.def.hl - 0.05) + rx * r * (tank.def.hw - 0.05), y: st.y + 1.0, z: st.z + fz * f * (tank.def.hl - 0.05) + rz * r * (tank.def.hw - 0.05) };
    // tanksavarı hedefin 60 m önüne ışınla (o yöne bakan), ateşle, mermiyi uçur
    let ox = 0, oz = 0;
    for (const L of [60, 45, 80, 35, 100, 30, 120, 25]) { ox = P.x + (fx * f + rx * r) * L; oz = P.z + (fz * f + rz * r) * L; if (W.clear({ x: ox, y: W.heightAt(ox, oz) + 1.2, z: oz }, P) && !W._hits(W.query(ox - 2, oz - 2, ox + 2, oz + 2, []), ox, W.heightAt(ox, oz), oz, 1.7)) break; }
    at.st.x = ox; at.st.z = oz; at.st.y = W.heightAt(ox, oz); at.st.base = at.st.yaw = Math.atan2(ox - P.x, oz - P.z); at.rl = 0;
    const shooter = game.soldiers.find((s) => s.team === 'blue' && s !== gunner && s !== me);
    if (!at.seats[0]) V.enter(shooter, at, 0);
    const sh = at.seats[0];
    at.hp = at.def.hp; const fired = V.fireAtgm(at, sh, P); if (!fired) { console.log('atılmadı', { alive: at.alive, rl: at.rl, sh: !!sh, st: !!at.st }); break; }
    for (let n = 0; n < 120 && V.shells.length; n++) V.updateShells(1 / 60);
    if (process.env.DBG) console.log(side, 'hp', Math.round(tank.hp), 'from', ox.toFixed(1), oz.toFixed(1), 'P', P.x.toFixed(1), P.z.toFixed(1), 'tank', tank.st.x.toFixed(1), tank.st.z.toFixed(1), tank.alive);
    hits++;
  }
  if (at.seats[0]) V.exit(at.seats[0]);
  ok(!tank.alive, `tanksavar → tank ${side}dan ${hits} isabette patladı`);
  V.trySpawn(tank, true);
}
// ── 5 bot nav: yerden kule tepesine yol ──
for (const t of M.towers) {
  const p = t.perch[0], fx = t.foot.x + 25, fz = t.foot.z + 10;
  const path = game.nav.findPath(fx, fz, p.x, p.z, 0.7, W.heightAt(fx, fz), p.y);
  ok(path && path.length && Math.abs(path[path.length - 1].y - t.top) < 0.05, `${t.id}: nav yolu yerden platforma (${path?.length} nokta)`);
  const back = game.nav.findPath(p.x, p.z, fx, fz, 0.7, p.y);
  ok(back && back.length > 3 && back[0].y > t.top - 0.5, `${t.id}: platformdan aşağı yol (${back?.length} nokta)`);
}
// gerçek bot: kule tepesine yürüsün
{
  const t = M.towers.find((q) => q.flag === 'C'), b = game.soldiers.find((s) => s.brain && s.team === 'red' && !s.veh && s.alive && s.cls !== 'sniper');
  const p = t.perch[0];
  b.pos.set(t.foot.x + 12, W.heightAt(t.foot.x + 12, t.foot.z + 6), t.foot.z + 6); b.vel.set(0, 0, 0);
  for (const s of game.soldiers) if (s.team === 'blue') { s.alive = false; s.respawnT = 999; }      // düşman yok: bot savaşmadan çıkar
  b.brain.target = null; b.brain.setGoal(p.x, p.z, 60, p.y); b.brain.perching = true;
  let t0 = 0, best = 0;
  for (let n = 0; n < 30 * 40; n++) { game.step(1 / 30); b.brain.goalT = 60; best = Math.max(best, b.pos.y - W.heightAt(b.pos.x, b.pos.z)); if (Math.abs(b.pos.y - t.top) < 0.1 && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 1.8) { t0 = n / 30; break; } }
  ok(t0 > 0, `bot kule tepesine çıktı (${t0.toFixed(1)} sn; en yüksek ${best.toFixed(1)} m)`);
}
// ── 6 bot yuvaya biner + ateş ──
{
  const v = E.find((q) => q.type === 'hmg' && !q.spawn.tower && !q.seats[0]);
  const b = game.soldiers.find((s) => s.brain && s.team === 'red' && !s.veh && s.alive);
  b.pos.set(v.st.x + Math.sin(v.st.base) * 6, v.st.y, v.st.z + Math.cos(v.st.base) * 6); W.settle(b);
  const obj = game.mode.objectives.find((o) => o.id === v.spawn.flag || Math.hypot(o.x - v.st.x, o.z - v.st.z) < 80); obj.owner = 'red';
  b.brain.empCD = 0; b.brain.empScan = 0; b.hp = 100;
  const oldC = (await import('../src/game/empBots.js')).EMPB; oldC.chance = 1;
  let inT = 0;
  for (let n = 0; n < 30 * 25 && !inT; n++) { game.step(1 / 30); if (b.veh === v) inT = n / 30; }
  ok(inT > 0, `bot ağır makineli yuvasına bindi (${inT.toFixed(1)} sn)`);
  // önüne düşman koy
  const foe = game.soldiers.find((s) => s.team === 'blue');
  foe.alive = true; foe.hp = 100; foe.respawnT = 0; foe.protT = 0;
  const fx = -Math.sin(v.st.base), fz = -Math.cos(v.st.base), X = v.st.x + fx * 45, Z = v.st.z + fz * 45;
  foe.pos.set(X, W.heightAt(X, Z), Z); foe.vel.set(0, 0, 0); if (foe.brain) foe.brain.frozen = true;
  let shots = 0, dead = 0; const h0 = V.mgFire.bind(V); V.mgFire = (s, held, dt) => { const r = h0(s, held, dt); if (r && s === b) shots++; return r; };
  for (let n = 0; n < 30 * 15 && !dead; n++) { game.step(1 / 30); foe.pos.set(X, W.heightAt(X, Z), Z); foe.vel.set(0, 0, 0); if (!foe.alive) dead = n / 30; }
  ok(shots > 0, `bot makineliyle ateş etti (${shots} mermi, düşman ${dead ? dead.toFixed(1) + ' sn\'de öldü' : 'yaşıyor'})`);
}
console.log(fails.length ? `SONUÇ: ${fails.length} HATA` : 'SONUÇ: OK');
process.exit(fails.length ? 1 : 0);
