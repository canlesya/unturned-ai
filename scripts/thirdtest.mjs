// 3. şahıs kamera testi (ağsız, sunucu çekirdeği).  node scripts/thirdtest.mjs
// Kural: nişan noktasını KAMERA ışını belirler (artının gösterdiği yer), mermi ise GÖZDEN o noktaya gider ve arada engel varsa ona çarpar.
//  - kamera hedefi görüyorsa ve gözden yol açıksa → isabet
//  - gözün göremediği (duvar/köşe arkası) hedef kameradan görünse bile → vurulamaz
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
  step(130); A.protT = B.protT = 0;
  return { g, A, B, ha, input, step };
}
const place = (g, A, B, dmin = 6, dspan = 12) => {
  for (let k = 0; k < 20000; k++) {
    const x = -45 + Math.random() * 90, z = -45 + Math.random() * 90, a = Math.random() * 6.28, d = dmin + Math.random() * dspan;
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, bz)) continue;
    A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(bx, g.world.heightAt(bx, bz), bz); A.vel.set(0, 0, 0); B.vel.set(0, 0, 0);
    return true;
  }
  return false;
};
// Kameradan hedef merkezine bakan açı + kamera ofseti (sağ omuz 0,72 m, 2,5 m arkada, 0,3 m yukarıda), Player.thirdCamera ile aynı düzen
function cameraAim(A, target) {
  const eye = A.eye(new THREE.Vector3());
  let yaw = Math.atan2(-(target.x - eye.x), -(target.z - eye.z)), pitch = 0, off = new THREE.Vector3();
  for (let it = 0; it < 5; it++) {
    const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    off = fwd.clone().multiplyScalar(-2.5).addScaledVector(right, 0.72).add(new THREE.Vector3(0, 0.3, 0));
    const d = target.clone().sub(eye.clone().add(off));
    yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }
  return { yaw, pitch, off };
}
const parts = (B) => [B.center(new THREE.Vector3()), B.eye(new THREE.Vector3()), new THREE.Vector3(B.pos.x, B.pos.y + 0.25, B.pos.z)];
const fire = (ctx, { yaw, pitch, co }) => {
  const { g, A, B, input, step } = ctx;
  B.hp = B.maxHp; B.alive = true; B.protT = 0; A.items[0].mag = 30; A.cd = 0; A.protT = 0; g.netEvents.length = 0;
  A.sinceShot = 1; A.bloom = 0; A.recoilP = 0;                          // dururken ilk atış gibi: önceki denemenin saçılma/geri tepmesi taşınmasın
  input({ yw: yaw, pt: pitch, fp: 1, fh: 1, co }); step(1);
  return g.netEvents.find((e) => e.e === 'sh');
};

// ── 1) Nişan hizası: kamera hedefi görüyor + gözden yol açık → mermi artının gösterdiği hedefe gider ──
// ── 2) Ofsetsiz aynı açı kaçırır (ofset gerçekten iş görüyor); oda kapalıyken / aşırı ofsette ofset yok sayılır ──
{
  const on = setup(true), off = setup(false);
  let n = 0, hitCam = 0, hitEyeOnly = 0, hitRoomOff = 0, hitTooFar = 0;
  const T = new THREE.Vector3();
  for (let tries = 0; tries < 40000 && n < 20; tries++) {
    if (!place(on.g, on.A, on.B)) break;
    on.B.center(T);
    const eye = on.A.eye(new THREE.Vector3());
    const { yaw, pitch, off: o } = cameraAim(on.A, T), cam = eye.clone().add(o);
    if (!on.g.world.clear(eye, T) || !on.g.world.clear(eye, cam) || !on.g.world.clear(cam, T)) continue;      // temiz görüş: kamera ve göz hedefi görüyor
    n++;
    const co = [o.x, o.y, o.z];
    const s1 = fire(on, { yaw, pitch, co }); if (s1 && s1.k === 'f') hitCam++;
    const s2 = fire(on, { yaw, pitch, co: null }); if (s2 && s2.k === 'f') hitEyeOnly++;
    off.A.pos.copy(on.A.pos); off.B.pos.copy(on.B.pos); off.A.vel.set(0, 0, 0); off.B.vel.set(0, 0, 0);       // oda 3. şahıs vermiyor: ofset yok sayılmalı
    const s3 = fire(off, { yaw, pitch, co }); if (s3 && s3.k === 'f') hitRoomOff++;
    const s4 = fire(on, { yaw, pitch, co: [6, 0, 0] }); if (s4 && s4.k === 'f') hitTooFar++;
  }
  console.log(`      ${n} temiz deneme: kameradan ${hitCam} · gözden aynı açı ${hitEyeOnly} · oda kapalı ${hitRoomOff} · aşırı ofset ${hitTooFar}`);
  check(n >= 12 && hitCam >= n - 1, `nişan hizası: artının gösterdiği hedefe isabet (${hitCam}/${n})`);
  check(hitEyeOnly <= Math.ceil(n * 0.15), `ofsetsiz aynı açı hedefi ıskalıyor (${hitEyeOnly}/${n}): ofset gerçekten işe yarıyor`);
  check(hitRoomOff <= Math.ceil(n * 0.15), `oda 3. şahıs vermiyorsa ofset yok sayılıyor (${hitRoomOff}/${n})`);
  check(hitTooFar <= Math.ceil(n * 0.15), `4,5 m'den büyük ofset reddediliyor (${hitTooFar}/${n})`);
}

// ── 3) Açık kapatma: gözün göremediği (duvar/köşe arkası) hedef, kameradan görünse bile vurulamaz ──
{
  const ctx = setup(true), { g, A, B } = ctx;
  let n = 0, leaked = 0, wall = 0, legit = 0;
  const T = new THREE.Vector3();
  for (let tries = 0; tries < 80000 && n < 40; tries++) {
    if (!place(g, A, B, 4, 20)) break;
    B.center(T);
    const eye = A.eye(new THREE.Vector3());
    if (parts(B).some((p) => g.world.clear(eye, p))) continue;               // gözün hedefin hiçbir parçasını görmediği durum
    const { yaw, pitch, off } = cameraAim(A, T), cam = eye.clone().add(off);
    if (!g.world.clear(eye, cam) || !g.world.clear(cam, T)) continue;         // kamera köşeden hedefi görüyor
    n++;
    const sh = fire(ctx, { yaw, pitch, co: [off.x, off.y, off.z] });
    if (sh && sh.k === 'f') { if (g.world.clear(eye, new THREE.Vector3(...sh.p))) legit++; else leaked++; }
    else if (sh && sh.k === 'w') wall++;
  }
  console.log(`      duvar/köşe arkası: ${n} deneme · açık (gözden görünmeyen yere isabet) ${leaked} · duvara çarpan ${wall} · meşru kısmi isabet ${legit}`);
  check(n >= 20, `yeterli sömürü senaryosu (${n})`);
  check(leaked === 0, 'gözün göremediği yere isabet YOK (mermi araya giren duvara çarpıyor)');
}

// ── 4) Çok yakın hedef: kamera ofseti büyük sapma yaratır → gözden düz atışa düşer, yine duvar delinmez ──
{
  const ctx = setup(true), { g, A, B } = ctx;
  let n = 0, leaked = 0;
  const T = new THREE.Vector3();
  for (let tries = 0; tries < 80000 && n < 25; tries++) {
    if (!place(g, A, B, 1.2, 2.2)) break;
    B.center(T);
    const eye = A.eye(new THREE.Vector3());
    if (parts(B).some((p) => g.world.clear(eye, p))) continue;
    const { yaw, pitch, off } = cameraAim(A, T), cam = eye.clone().add(off);
    if (!g.world.clear(eye, cam)) continue;
    n++;
    const sh = fire(ctx, { yaw, pitch, co: [off.x, off.y, off.z] });
    if (sh && sh.k === 'f' && !g.world.clear(eye, new THREE.Vector3(...sh.p))) leaked++;
  }
  check(n >= 10 && leaked === 0, `çok yakın mesafede de duvar delinmiyor (${n} deneme, ${leaked} sızıntı)`);
}

// ── 5) Roket: köşeden/duvar arkasından atılamaz ──
{
  const { g, A, B, input, step } = setup(true);
  let n = 0, hit = 0;
  const T = new THREE.Vector3();
  for (let tries = 0; tries < 80000 && n < 8; tries++) {
    if (!place(g, A, B, 8, 14)) break;
    B.center(T);
    const eye = A.eye(new THREE.Vector3());
    if (parts(B).some((p) => g.world.clear(eye, p))) continue;
    const { yaw, pitch, off } = cameraAim(A, T), cam = eye.clone().add(off);
    if (!g.world.clear(eye, cam) || !g.world.clear(cam, T)) continue;
    n++;
    B.hp = B.maxHp; B.alive = true; B.protT = 0; A.protT = 0; A.items[2] = { id: 'rpg', mag: 1, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; g.netEvents.length = 0;
    input({ w: 2, yw: yaw, pt: pitch, fp: 1, fh: 1, co: [off.x, off.y, off.z] });
    for (let i = 0; i < 120; i++) step(1);
    if (B.hp < B.maxHp) hit++;
    g.projectiles.length = 0;
  }
  check(n >= 5 && hit <= 1, `roket duvarın arkasındaki hedefi vuramıyor (${hit}/${n})`);
}

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
