// Sunucu savaş testi (ağsız, doğrudan Game): ateş, hasar, öldürme, olaylar, lag compensation.  node scripts/combattest.mjs
import { Game } from '../src/game/game.js';
import * as THREE from 'three';

let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli');
const ha = g.humans.get(A.id), hb = g.humans.get(B.id);
// bot beyinlerini sustur (test sade kalsın)
g.brains.length = 0;
const DT = 1 / 60; let q = 0;
const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(DT); };

// iki oyuncuyu, aralarında görüş hattı olan açık bir noktaya yerleştir
function place(dist = 14) {
  for (let k = 0; k < 4000; k++) {
    const x = -50 + Math.random() * 100, z = -50 + Math.random() * 100, a = Math.random() * 6.28;
    const bx = x + Math.cos(a) * dist, bz = z + Math.sin(a) * dist;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, bz)) continue;
    A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(bx, g.world.heightAt(bx, bz), bz);
    A.vel.set(0, 0, 0); B.vel.set(0, 0, 0);
    if (g.world.clear(A.eye(), B.center(new THREE.Vector3())) && g.world.clear(A.eye(), B.eye())) return true;
  }
  return false;
}
const aimAt = (from, to) => {
  const e = from.eye(), dx = to.x - e.x, dz = to.z - e.z, dy = to.y - e.y;
  return { yw: Math.atan2(-dx, -dz), pt: Math.atan2(dy, Math.hypot(dx, dz)) };
};
const input = (h, extra) => h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, c: 0, p: 0, u: 0, w: h.s.cur, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, ...extra });
const reset = () => { for (const s of [A, B]) { s.alive = true; s.hp = s.maxHp; s.protT = 0; for (const it of s.items) { it.mag = 30; it.reserve = 500; s.reloadT = 0; s.cd = 0; s.switchT = 0; } } g.netEvents.length = 0; step(3); };

check(place(), 'oyuncular görüş hattında yerleştirildi');
A.protT = B.protT = 0; step(130);               // doğma koruması bitsin
B.protT = 0;

// 1) sabit hedefe 1 sn ateş
reset(); place(); step(2);
let hp0 = B.hp, evs = [];
const ay = aimAt(A, B.center(new THREE.Vector3()));
for (let i = 0; i < 90; i++) { input(ha, { yw: ay.yw, pt: ay.pt, fh: 1, vt: g.tick }); step(); evs.push(...g.netEvents); g.netEvents.length = 0; }
const shots = evs.filter((e) => e.e === 'sh'), hms = evs.filter((e) => e.e === 'hm' && e.by === A.id), dm = evs.filter((e) => e.e === 'dmg' && e.v === B.id), kills = evs.filter((e) => e.e === 'kill');
console.log(`      atış ${shots.length}, isabet ${hms.length}, hasar ${dm.length}, kill ${kills.length}, B can ${hp0} → ${B.hp.toFixed(0)}`);
check(shots.length > 3, 'sunucu atışları işledi (sh olayları)');
check(hms.length > 0 && dm.length > 0, 'isabet (hm) ve hasar (dmg) olayları üretildi');
check(B.hp < hp0 || !B.alive, 'B hasar aldı');
check(!B.alive ? kills.some((k) => k.v === B.id && k.k === A.id) : true, 'öldüyse kill olayı doğru kişiye');
check(A.items[0].mag < 30, 'şarjör azaldı (sunucu otoriter cephane)');

// 2) lag compensation: hareket eden hedef — istemcinin gördüğü (6 adım önceki) konuma tek atış
function lagShot(useVt) {
  reset(); place(); step(2); B.protT = 0;
  const strafe = () => input(hb, { r: 1, yw: 0 });         // hedef yana koşuyor (insan simülasyonu girdi güdümlü)
  for (let i = 0; i < 6; i++) { strafe(); step(); }
  const tag = g.tick, seen = B.center(new THREE.Vector3());     // istemcinin gördüğü an ve konum
  for (let i = 0; i < 6; i++) { strafe(); step(); }
  const a = aimAt(A, seen);
  g.netEvents.length = 0;
  input(ha, { yw: a.yw, pt: a.pt, fh: 1, fp: 1, vt: useVt ? tag : null }); step();
  const evs2 = g.netEvents.filter((e) => e.e === 'sh');
  return evs2.some((e) => e.k === 'f');
}
let hitWith = 0, hitWithout = 0, N = 12;
for (let i = 0; i < N; i++) { A.cd = 0; if (lagShot(true)) hitWith++; A.cd = 0; if (lagShot(false)) hitWithout++; }
console.log(`      lag comp: geri sarmalı ${hitWith}/${N} isabet, sarmasız ${hitWithout}/${N}`);
check(hitWith >= N - 4, 'geri sarma ile (istemcinin gördüğü yere) isabet alınıyor');
check(hitWith > hitWithout, 'geri sarma olmadan aynı atışlar kaçıyor (lag comp gerçekten iş görüyor)');

// 3) doğuş: ölünce respawn + seçili sınıf
reset(); place(); step(2);
B.takeDamage(500, A, 'body', A.pos, 'test'); step(1);
check(!B.alive && B.respawnT > 3 && B.respawnT <= 5, `insan ölünce ${B.respawnT.toFixed(1)} sn sonra doğacak`);
hb.pendingClass = 'medic'; step(60 * 6);
check(B.alive && B.cls === 'medic', 'seçilen sınıfla yeniden doğdu');

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
