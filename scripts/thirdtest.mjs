// 3. şahıs kamera testi (ağsız, sunucu çekirdeği): mermi 1. şahıstaki gibi GÖZDEN, (yaw,pitch) yönünde çıkar; kamera atışı etkilemez.
// Yani 1. şahısta vuramadığın (duvarın arkasındaki) hedefi 3. şahısta da vuramazsın.   node scripts/thirdtest.mjs
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
  const input = (extra) => ha.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: A.yaw, pt: A.pitch, c: 0, p: 0, u: 0, w: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, ...extra });
  const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(DT); };
  step(130); A.protT = B.protT = 0;
  return { g, A, B, ha, input, step };
}
const place = (g, A, B) => {
  for (let k = 0; k < 20000; k++) {
    const x = -45 + Math.random() * 90, z = -45 + Math.random() * 90, a = Math.random() * 6.28, d = 6 + Math.random() * 12;
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, bz)) continue;
    A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(bx, g.world.heightAt(bx, bz), bz); A.vel.set(0, 0, 0); B.vel.set(0, 0, 0);
    return true;
  }
  return false;
};
const aim = (A, p) => { const e = A.eye(new THREE.Vector3()); return { yaw: Math.atan2(-(p.x - e.x), -(p.z - e.z)), pitch: Math.atan2(p.y - e.y, Math.hypot(p.x - e.x, p.z - e.z)) }; };

// ── 1) Aynı açı, oda 3. şahıs izinli/izinsiz: sonuç AYNI (kamera atışı değiştirmiyor) ──
// ── 2) Duvar arkası: gözden hedef görünmüyorsa (1. şahısta vurulamaz) 3. şahıs ayarında da vurulamaz ──
for (const third of [true, false]) {
  const { g, A, B, input, step } = setup(third);
  const T = new THREE.Vector3();
  let n = 0, leaked = 0, wallHits = 0, visHit = 0, visN = 0;
  for (let tries = 0; tries < 40000 && (n < 20 || visN < 20); tries++) {
    if (!place(g, A, B)) break;
    B.center(T);
    const eye = A.eye(new THREE.Vector3());
    const centerSeen = g.world.clear(eye, T);                                  // merkez görünüyor: açık görüş denemesi
    const anySeen = centerSeen || [B.eye(new THREE.Vector3()), new THREE.Vector3(B.pos.x, B.pos.y + 0.25, B.pos.z)].some((p) => g.world.clear(eye, p));
    if (anySeen && !centerSeen) continue;                                      // kısmen görünen: ne açık ne gizli, atla
    const seen = centerSeen;
    if (seen && visN >= 20) continue;
    if (!seen && n >= 20) continue;
    const { yaw, pitch } = aim(A, T);
    B.hp = B.maxHp; B.alive = true; B.protT = 0; A.items[0].mag = 30; A.cd = 0; A.protT = 0; g.netEvents.length = 0;
    input({ yw: yaw, pt: pitch, fp: 1, fh: 1 }); step(1);
    const sh = g.netEvents.find((e) => e.e === 'sh');
    if (!seen) { n++; if (sh && sh.k === 'f') { if (g.world.clear(eye, new THREE.Vector3(...sh.p))) wallHits++; else leaked++; } else if (sh && sh.k === 'w') wallHits++; }   // isabet noktası gözden görünüyorsa meşru kısmi isabet
    else { visN++; if (sh && sh.k === 'f') visHit++; }
  }
  console.log(`      oda 3. şahıs ${third ? 'AÇIK ' : 'KAPALI'}: duvar arkası ${n} deneme → hedefe isabet ${leaked}, duvara çarpan ${wallHits} · açık görüşte ${visHit}/${visN} isabet`);
  check(leaked === 0, `3. şahıs ${third ? 'açık' : 'kapalı'}: duvarın arkasındaki hedef vurulamıyor`);
  check(visHit >= visN * 0.6, `3. şahıs ${third ? 'açık' : 'kapalı'}: görünen hedefe normal isabet (${visHit}/${visN})`);
}

// ── 3) Girdideki eski 'co' alanı yok sayılır (hile denemesi): kameradan atış sonucu değişmemeli ──
{
  const { g, A, B, input, step } = setup(true);
  const T = new THREE.Vector3(); let n = 0, leaked = 0;
  for (let tries = 0; tries < 40000 && n < 15; tries++) {
    if (!place(g, A, B)) break;
    B.center(T);
    const eye = A.eye(new THREE.Vector3());
    if ([T.clone(), B.eye(new THREE.Vector3()), new THREE.Vector3(B.pos.x, B.pos.y + 0.25, B.pos.z)].some((p) => g.world.clear(eye, p))) continue;
    // saldırgan istemci: kameradan nişan alıp 'co' ofseti yolluyor
    const off = new THREE.Vector3(0.9, 0.3, 2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    const cam = eye.clone().add(off);
    const { yaw, pitch } = (() => { const d = T.clone().sub(cam); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; })();
    n++; B.hp = B.maxHp; B.alive = true; B.protT = 0; A.items[0].mag = 30; A.cd = 0; A.protT = 0; g.netEvents.length = 0;
    input({ yw: yaw, pt: pitch, fp: 1, fh: 1, co: [off.x, off.y, off.z] }); step(1);
    const sh = g.netEvents.find((e) => e.e === 'sh');
    if (sh && sh.k === 'f' && !g.world.clear(eye, new THREE.Vector3(...sh.p))) leaked++;
  }
  check(n >= 8 && leaked === 0, `sahte kamera ofseti (co) gönderen istemci duvarın arkasından vuramıyor (${n} deneme, ${leaked} sızıntı)`);
}

// ── 4) Roket: kameraya bağlı değil, gözden/aim yönünde; duvar arkası hasar yok ──
{
  const { g, A, B, input, step } = setup(true);
  const T = new THREE.Vector3(); let n = 0, hit = 0;
  for (let tries = 0; tries < 40000 && n < 8; tries++) {
    if (!place(g, A, B)) break;
    B.center(T);
    const eye = A.eye(new THREE.Vector3());
    if ([T.clone(), B.eye(new THREE.Vector3()), new THREE.Vector3(B.pos.x, B.pos.y + 0.25, B.pos.z)].some((p) => g.world.clear(eye, p))) continue;
    const { yaw, pitch } = aim(A, T);
    n++; B.hp = B.maxHp; B.alive = true; B.protT = 0; A.protT = 0; A.items[2] = { id: 'rpg', mag: 1, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; g.netEvents.length = 0;
    input({ w: 2, yw: yaw, pt: pitch, fp: 1, fh: 1 });
    for (let i = 0; i < 120; i++) step(1);
    if (B.hp < B.maxHp) hit++;
    g.projectiles.length = 0;
  }
  check(n >= 5 && hit <= 1, `roket duvarın arkasındaki hedefi vuramıyor (${hit}/${n})`);
}

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
