// 3. şahıs kamera testi (ağsız, sunucu çekirdeği): atış kameradan çıkar, nişangâhın gösterdiği yere gider; oda izin vermiyorsa yok sayılır.
//   node scripts/thirdtest.mjs
import { Game } from '../src/game/game.js';
import * as THREE from 'three';

let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const DT = 1 / 60;

function setup(third) {
  const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', third, match: { perTeam: 2, type: 'tdm', tickets: 500 } });
  const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli');
  g.brains.length = 0;
  const ha = g.humans.get(A.id);
  let q = 0;
  const input = (extra) => ha.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: A.yaw, pt: A.pitch, c: 0, p: 0, u: 0, w: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, co: null, ...extra });
  const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(DT); };
  // iki oyuncuyu aralarında görüş hattı ve yan boşluk olan açık yere yerleştir
  let ok = false;
  for (let k = 0; k < 6000 && !ok; k++) {
    const x = -40 + Math.random() * 80, z = -40 + Math.random() * 80, a = Math.random() * 6.28, d = 16;
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, bz)) continue;
    A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(bx, g.world.heightAt(bx, bz), bz); A.vel.set(0, 0, 0); B.vel.set(0, 0, 0);
    // kamera konumu (sağ omuz, 2,5 m arkada) boş ve görüş hattı temiz olmalı
    ok = g.world.clear(A.eye(), B.center(new THREE.Vector3()));
  }
  step(130); A.protT = B.protT = 0;
  return { g, A, B, ha, input, step };
}

// kameradan hedef merkezine bakan açı + kamera ofseti (sağ omuz 0,72 m, 2,5 m arkada, 0,3 m yukarı)
function cameraAim(A, target) {
  const eye = A.eye(new THREE.Vector3());
  // önce yaklaşık yön, sonra ofsetli kamera konumundan hedefe tam yön
  let yaw = Math.atan2(-(target.x - eye.x), -(target.z - eye.z)), pitch = 0, off = new THREE.Vector3();
  for (let it = 0; it < 4; it++) {
    const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    off = fwd.clone().multiplyScalar(-2.5).addScaledVector(right, 0.72).add(new THREE.Vector3(0, 0.3, 0));
    const cam = eye.clone().add(off), d = target.clone().sub(cam);
    yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }
  return { yaw, pitch, off };
}

function shoot(third, useOffset, bad) {
  const { g, A, B, input, step } = setup(third);
  B.hp = B.maxHp;
  const t = B.center(new THREE.Vector3());
  const { yaw, pitch, off } = cameraAim(A, t);
  const eye0 = A.eye(new THREE.Vector3());
  if (useOffset && !bad && !g.world.clear(eye0, eye0.clone().add(off))) return null;       // kamera duvarın içine düşerdi (istemci kamerayı çeker): bu deneme geçersiz
  if (useOffset && !bad && !g.world.clear(eye0.clone().add(off), t)) return null;            // kamera hedefi görmüyor (direk/köşe): mermi engele çarpar, bu deneme nişan hizası için geçersiz
  const co = useOffset ? (bad ? [6, 0, 0] : [off.x, off.y, off.z]) : null;
  A.items[0].mag = 30; A.cd = 0;
  g.netEvents.length = 0;
  input({ yw: yaw, pt: pitch, fp: 1, fh: 1, co }); step(1);
  const sh = g.netEvents.find((e) => e.e === 'sh');
  return { hitFlesh: !!sh && sh.k === 'f', hpLost: B.maxHp - B.hp, origin: sh && sh.o };
}

const N = 20;
let withOff = 0, without = 0, denied = 0, tooFar = 0;
for (let i = 0; i < N; i++) {
  let r;
  do r = shoot(true, true, false); while (!r);                 // geçerli deneme: kamera boşta ve hedefi görüyor
  if (r.hitFlesh) withOff++;
  if (shoot(true, false, false).hitFlesh) without++;
  if (shoot(false, true, false)?.hitFlesh) denied++;           // oda 3. şahıs vermiyor: ofset yok sayılmalı
  if (shoot(true, true, true).hitFlesh) tooFar++;              // 4,5 m'den büyük ofset reddedilmeli
}
console.log(`      kameradan atış (ofsetli): ${withOff}/${N} isabet · gözden atış (aynı açı): ${without}/${N} · oda kapalıyken ofsetli: ${denied}/${N} · aşırı ofset: ${tooFar}/${N}`);
check(withOff >= N - 1, 'ofsetli atış, nişangâhın (kameranın) gösterdiği hedefe isabet ediyor');
check(without <= 3, 'aynı açıyla gözden atış hedefi ıskalıyor (ofset gerçekten iş görüyor)');
check(denied <= 3, 'oda 3. şahıs vermiyorsa ofset yok sayılıyor (hile yok)');
check(tooFar <= 3, '4,5 m\'den büyük ofset reddediliyor');

// ── Açık kapatma: duvarın/köşenin ARKASINDAN ateş edilemez ──
// Kamera köşeden hedefi görüyor ama göz→hedef arasında duvar var: mermi gözden çıktığı için duvara çarpmalı, hedefe değmemeli.
{
  const { g, A, B, ha, input, step } = setup(true);
  let n = 0, leaked = 0, wallHits = 0, legitAfter = 0, tries = 0;
  const T = new THREE.Vector3();
  while (n < 15 && tries++ < 60000) {
    const x = -45 + Math.random() * 90, z = -45 + Math.random() * 90, a = Math.random() * 6.28, d = 6 + Math.random() * 18;
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, bz)) continue;
    A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(bx, g.world.heightAt(bx, bz), bz); A.vel.set(0, 0, 0); B.vel.set(0, 0, 0);
    B.center(T);
    const eye = A.eye(new THREE.Vector3());
    const parts = [T.clone(), B.eye(new THREE.Vector3()), new THREE.Vector3(B.pos.x, B.pos.y + 0.25, B.pos.z), new THREE.Vector3(B.pos.x + 0.25, B.pos.y + 1.0, B.pos.z), new THREE.Vector3(B.pos.x - 0.25, B.pos.y + 1.0, B.pos.z)];
    if (parts.some((p) => g.world.clear(eye, p))) continue;                  // göz hedefin herhangi bir parçasını görüyorsa meşru isabet olabilir: sömürü değil
    const { yaw, pitch, off } = cameraAim(A, T);
    const cam = eye.clone().add(off);
    if (!g.world.clear(eye, cam) || !g.world.clear(cam, T)) continue;      // kamera geçerli konumda ve hedefi (köşeden) görüyor olmalı
    n++;
    B.hp = B.maxHp; B.alive = true; B.protT = 0; A.items[0].mag = 30; A.cd = 0; A.protT = 0; g.netEvents.length = 0;
    input({ yw: yaw, pt: pitch, fp: 1, fh: 1, co: [off.x, off.y, off.z] }); step(1);
    const sh = g.netEvents.find((e) => e.e === 'sh');
    if (sh && sh.k === 'f') {
      // isabet noktası gözden görünüyorsa meşru kısmi isabet (omuz/kafa kenarı); görünmüyorsa gerçek açık
      const hp = new THREE.Vector3(...sh.p);
      if (g.world.clear(eye, hp)) legitAfter++; else leaked++;
    } else if (sh && sh.k === 'w') wallHits++;
  }
  console.log(`      köşeden/duvar arkasından ateş denemesi: ${n} · hedefe isabet (açık): ${leaked} · duvara çarpan: ${wallHits}`);
  check(n >= 8, `yeterli sömürü senaryosu bulundu (${n})`);
  check(leaked === 0, 'duvarın arkasından hedefe isabet YOK (mermi gözden çıkıp araya giren engele çarpıyor)');
  check(wallHits + legitAfter >= n - 1, `mermi araya giren duvara çarptı (${wallHits}/${n}; gözden görünen kısma meşru isabet: ${legitAfter})`);
}

// ── Roket: köşeden/duvar arkasından atılamaz ──
{
  const { g, A, B, input, step } = setup(true);
  let n = 0, hit = 0, tries = 0;
  const T = new THREE.Vector3();
  while (n < 8 && tries++ < 60000) {
    const x = -45 + Math.random() * 90, z = -45 + Math.random() * 90, a = Math.random() * 6.28, d = 8 + Math.random() * 18;
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, bz)) continue;
    A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(bx, g.world.heightAt(bx, bz), bz); A.vel.set(0, 0, 0); B.vel.set(0, 0, 0);
    B.center(T);
    const eye = A.eye(new THREE.Vector3());
    const parts = [T.clone(), B.eye(new THREE.Vector3()), new THREE.Vector3(B.pos.x, B.pos.y + 0.25, B.pos.z)];
    if (parts.some((p) => g.world.clear(eye, p))) continue;
    const { yaw, pitch, off } = cameraAim(A, T);
    const cam = eye.clone().add(off);
    if (!g.world.clear(eye, cam) || !g.world.clear(cam, T)) continue;
    n++;
    B.hp = B.maxHp; B.alive = true; B.protT = 0; A.protT = 0; A.items[2] = { id: 'rpg', mag: 1, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; g.netEvents.length = 0;
    input({ w: 2, yw: yaw, pt: pitch, fp: 1, fh: 1, co: [off.x, off.y, off.z] });
    for (let i = 0; i < 120; i++) step(1);
    if (B.hp < B.maxHp) hit++;
    for (let i = 0; i < 5; i++) g.projectiles.length = 0;
  }
  console.log(`      roket (köşeden/duvar arkasından): ${n} deneme · hedefe hasar veren: ${hit}`);
  check(n >= 5 && hit <= 1, `roket duvarın arkasından hedefi vuramıyor (${hit}/${n})`);
}

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
