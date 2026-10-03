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

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
