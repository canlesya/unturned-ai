// Paintball silah testi (ağsız, doğrudan başsız Game = sunucu mantığı): top uçuşu / düşüşü, hasar (tüfek 9, tabanca 4, kafa ×1,5),
// duvarda durma, lag compensation, atış hızı, havuz (ayırma yok) + 8 botla yük.   node --expose-gc scripts/pbtest.mjs
import { Game } from '../src/game/game.js';
import * as THREE from 'three';
import { WSTATS } from '../src/game/stats.js';
import { ballLead, paintColorOf, PAINT_COLORS } from '../src/game/paint.js';

let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const DT = 1 / 60; let q = 0;
const g = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli');
const ha = g.humans.get(A.id), hb = g.humans.get(B.id);
g.brains.length = 0;
for (const s of g.soldiers) if (s !== A && s !== B) { s.vacant = true; s.alive = false; }
const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(DT); };
const give = (s, id) => { const st = WSTATS[id]; s.items[0] = { id, mag: st.mag, reserve: st.reserve }; s.cur = 0; s.switchT = 0; s.cd = 0; s.reloadT = 0; };
const input = (h, extra) => h.queue.push({ q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, c: 0, p: 0, u: 0, w: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, ...extra });
const evs = []; const drain = () => { evs.push(...g.netEvents); g.netEvents.length = 0; };

function place(dist) {
  for (let k = 0; k < 6000; k++) {
    const x = -50 + Math.random() * 100, z = -50 + Math.random() * 100, a = Math.random() * 6.28;
    const bx = x + Math.cos(a) * dist, bz = z + Math.sin(a) * dist;
    if (!g.nav.isFree(x, z) || !g.nav.isFree(bx, bz)) continue;
    A.pos.set(x, g.world.heightAt(x, z), z); B.pos.set(bx, g.world.heightAt(bx, bz), bz);
    A.vel.set(0, 0, 0); B.vel.set(0, 0, 0);
    // top yaylı gider: göz → hedef arası birkaç yükseklikte açık olsun
    const e = A.eye(), c = B.center(new THREE.Vector3());
    if (g.world.clear(e, c) && g.world.clear(e, B.eye()) && g.world.clear(e.clone().setY(e.y + 0.6), c.clone().setY(c.y + 0.6))) return true;
  }
  return false;
}
// düşüş telafili nişan (bot nişanıyla aynı formül)
function aimAt(from, to, st) {
  const e = from.eye(), dx = to.x - e.x, dz = to.z - e.z, dy = to.y - e.y, h = Math.hypot(dx, dz);
  return { yw: Math.atan2(-dx, -dz), pt: Math.atan2(dy, h) + ballLead(st, Math.hypot(h, dy)) };
}
const reset = (id) => { for (const s of [A, B]) { s.alive = true; s.hp = s.maxHp; s.protT = 0; s.recoilP = 0; s.bloom = 0; } give(A, id); g.netEvents.length = 0; evs.length = 0; step(2); A.protT = B.protT = 0; };

check(place(15), 'oyuncular görüş hattında yerleştirildi');
step(130); A.protT = B.protT = 0;

// 1) uçuş süresi + düşüş (havada, engelsiz)
{
  const st = WSTATS.pbrifle, P = g.paint, o = new THREE.Vector3(0, 80, 0), d = new THREE.Vector3(1, 0, 0);
  const b = P.fire(A, o, d, st, null, null); g.netEvents.length = 0;
  for (let i = 0; i < 30; i++) P.update(DT);
  const t = 0.5, dx = b.x - o.x, drop = o.y - b.y, ex = st.speed * t, ed = 0.5 * st.grav * t * t;
  console.log(`      0,5 sn: yol ${dx.toFixed(2)} m (beklenen ${ex}), düşüş ${drop.toFixed(3)} m (beklenen ${ed.toFixed(3)})`);
  check(Math.abs(dx - ex) < 0.05 * ex && Math.abs(drop - ed) < 0.05 * ed, 'top hızı ve yerçekimi WSTATS speed/grav ile uyumlu');
  const st2 = WSTATS.pbpistol, b2 = P.fire(A, o, d, st2, null, null); g.netEvents.length = 0;
  for (let i = 0; i < 30; i++) P.update(DT);
  check(Math.abs((o.y - b2.y) - 0.5 * st2.grav * 0.25) < 0.05 && o.y - b2.y > drop, `tabanca topu daha çabuk düşer (${(o.y - b2.y).toFixed(2)} m)`);
  for (let i = P.live.length - 1; i >= 0; i--) P._kill(i);
}

// 2) hasar: tüfek 9 gövde isabeti, tabanca 4, kafa ×1,5
function killCount(id, every) {
  reset(id); place(15); step(2); A.protT = B.protT = 0;
  const st = WSTATS[id], hp0 = B.hp; let hits = 0, zones = new Set(), killedAt = 0, dmgSum = 0, last = B.hp;
  for (let i = 0; i < 240 && B.alive; i++) {
    const a = aimAt(A, new THREE.Vector3(B.pos.x, B.pos.y + 1.1, B.pos.z), st);
    input(ha, { yw: a.yw, pt: a.pt, a: 1, fh: every ? 0 : 1, fp: every && i % every === 0 ? 1 : 0, vt: g.tick });
    input(hb, {}); step(); drain();
    const hs = evs.filter((e) => e.e === 'pbh' && e.v === B.id); evs.length = 0;
    for (const h of hs) { hits++; zones.add(h.z); }
    if (B.hp < last) { dmgSum += last - Math.max(0, B.hp); last = B.hp; }
    if (!B.alive && !killedAt) killedAt = hits;
    A.items[0].mag = 50;
  }
  return { hits, killedAt, zones: [...zones], hp0 };
}
{
  const r = killCount('pbrifle', 0);
  console.log(`      tüfek: ${r.killedAt} isabette öldü (bölgeler ${r.zones})`);
  check(r.killedAt === 9 && r.zones.every((z) => z === 0), 'paintball tüfeği gövdeye 9 isabette öldürür (12 × 9 = 108)');
  const p = killCount('pbpistol', 8);
  console.log(`      tabanca: ${p.killedAt} isabette öldü (bölgeler ${p.zones})`);
  check(p.killedAt === 4, 'paintball tabancası 4 isabette öldürür (25 × 4)');
  // kafa
  reset('pbrifle'); place(12); step(2); A.protT = B.protT = 0;
  let headDmg = null;
  for (let i = 0; i < 60 && headDmg === null; i++) {
    const a = aimAt(A, new THREE.Vector3(B.pos.x, B.pos.y + B.height - 0.12, B.pos.z), WSTATS.pbrifle), hp = B.hp;
    input(ha, { yw: a.yw, pt: a.pt, a: 1, fp: i % 20 === 0 ? 1 : 0, fh: i % 20 === 0 ? 1 : 0, vt: g.tick }); input(hb, {}); step(); drain();
    const h = evs.find((e) => e.e === 'pbh' && e.v === B.id); evs.length = 0;
    if (h) headDmg = { z: h.z, d: hp - B.hp };
  }
  console.log(`      kafa atışı: bölge ${headDmg?.z}, hasar ${headDmg?.d}`);
  check(headDmg && headDmg.z === 2 && Math.abs(headDmg.d - 18) < 1e-6, 'kafa isabeti ×1,5 (18)');
}

// 3) duvarda durur (+ leke noktası duvar yüzeyinde)
{
  reset('pbrifle');
  let ok = 0, tried = 0, maxErr = 0;
  for (let k = 0; k < 400 && tried < 10; k++) {
    place(15); step(1); for (let i = g.paint.live.length - 1; i >= 0; i--) g.paint._kill(i);       // önceki testlerden uçan top kalmasın
    const e = A.eye(), a = Math.random() * 6.28, d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    B.pos.set(A.pos.x + 400, 0, A.pos.z);                                           // hedef yoldan çekilsin
    const wh = g.world.raycast(e, d, 18, {});
    if (!wh || wh.t < 4 || !wh.collider || Math.abs(wh.normal.y) > 0.3) continue;
    let flat = true;                                                                // saçılım koridoru (±30 cm dikey, ±15 cm yatay) aynı düz duvara çarpsın: araba tavanı / direk / köşe değil
    for (const dy of [-0.3, -0.2, -0.1, -0.05, 0.05, 0.1, 0.2, 0.3]) for (const dx of [-0.15, 0, 0.15]) {
      const o = e.clone(); o.y += dy; o.x += d.z * dx; o.z -= d.x * dx;
      const h = g.world.raycast(o, d, 18, {}); if (!h || Math.abs(h.t - wh.t) > 0.05) flat = false;
    }
    if (!flat) continue;
    // duvar ile göz arasındaki hat yere değmesin (top hafif düşer)
    tried++;
    const w0 = g.paint.stats.wall;
    A.cd = 0; A.switchT = 0;
    input(ha, { yw: Math.atan2(-d.x, -d.z), pt: ballLead(WSTATS.pbrifle, wh.t), a: 1, fp: 1, fh: 1, vt: g.tick }); input(hb, {}); step(40); drain();
    const err = g.paint.lastWall.distanceTo(wh.point);
    if (g.paint.stats.wall === w0 + 1 && err < 0.6 && g.paint.live.length === 0) ok++;
    maxErr = Math.max(maxErr, err);
    evs.length = 0;
  }
  console.log(`      duvar: ${ok}/${tried} top duvarda durdu (en büyük sapma ${maxErr.toFixed(2)} m)`);
  check(tried >= 6 && ok >= tried - 1, 'toplar duvarda durur, içinden geçmez');
}

// 4) lag compensation: hedef yana koşuyor, istemci 18 adım (300 ms) geride görüyor ve topun uçuş süresi kadar önünü alıyor
function lagShot(useVt) {
  reset('pbrifle');
  for (let k = 0; k < 50; k++) {                                                    // hedefin önü (+x) 6 m boş olsun: yana koşarken takılmasın
    place(14);
    let free = true; for (let dx = 0.5; dx <= 6; dx += 0.5) if (!g.nav.isFree(B.pos.x + dx, B.pos.z)) free = false;
    if (free) break;
  }
  step(2); A.protT = B.protT = 0;
  const LAG = 18, seen = [];
  for (let i = 0; i < 30; i++) { input(hb, { r: 1, yw: 0 }); input(ha, { a: 1, vt: g.tick }); step(); seen.push(B.center(new THREE.Vector3())); }
  const T = g.tick, P0 = seen[seen.length - 1 - LAG], P1 = seen[seen.length - 2 - LAG], v = P0.clone().sub(P1).multiplyScalar(60);
  const dist = A.eye().distanceTo(P0), tf = dist / WSTATS.pbrifle.speed;
  const aimP = P0.clone().addScaledVector(v, tf + DT);
  const a = aimAt(A, aimP, WSTATS.pbrifle);
  g.netEvents.length = 0; evs.length = 0; A.cd = 0;
  input(ha, { yw: a.yw, pt: a.pt, a: 1, fp: 1, fh: 1, vt: useVt ? T - LAG : null }); input(hb, { r: 1, yw: 0 }); step();
  for (let i = 0; i < 40; i++) { input(hb, { r: 1, yw: 0 }); input(ha, { vt: g.tick - LAG }); step(); }
  drain();
  return evs.some((e) => e.e === 'pbh' && e.v === B.id);
}
{
  let hw = 0, hn = 0; const N = 12;
  for (let i = 0; i < N; i++) { if (lagShot(true)) hw++; if (lagShot(false)) hn++; }
  console.log(`      lag comp: geri sarmalı ${hw}/${N}, sarmasız ${hn}/${N}`);
  check(hw >= N - 3, 'geri sarma ile istemcinin gördüğü (önünü aldığı) yere isabet');
  check(hw > hn + 3, 'geri sarma olmadan aynı atışlar kaçıyor');
}

// 5) atış hızı
{
  reset('pbrifle'); place(15); step(2);
  for (let i = 0; i < 60; i++) { input(ha, { yw: 0, pt: 0.3, fh: 1 }); input(hb, {}); step(); drain(); }
  const n = evs.filter((e) => e.e === 'pb' && e.by === A.id).length; evs.length = 0;
  check(n >= 9 && n <= 11, `tüfek 1 sn basılı: ${n} top (≈10/sn)`);
  reset('pbpistol'); step(2);
  for (let i = 0; i < 60; i++) { input(ha, { yw: 0, pt: 0.3, fp: 1 }); input(hb, {}); step(); drain(); }
  const m = evs.filter((e) => e.e === 'pb' && e.by === A.id).length; evs.length = 0;
  check(m >= 5 && m <= 8, `tabanca 1 sn her adım tetik: ${m} top (rpm ${WSTATS.pbpistol.rpm} → ≤ ${(WSTATS.pbpistol.rpm / 60).toFixed(1)})`);
  // tohumlu saçılım: aynı (id, q) → aynı yön (istemci tahmini = sunucu)
  const r1 = g.paint.rngFor({ id: 3, isPlayer: false, inSeq: 77 }), x1 = [r1(), r1()], r2 = g.paint.rngFor({ id: 3, inSeq: 77 }), x2 = [r2(), r2()];
  const r3 = g.paint.rngFor({ id: 3, inSeq: 78 }), x3 = r3();
  check(x1[0] === x2[0] && x1[1] === x2[1] && x3 !== x1[0], 'insan atışında saçılım (id, girdi no) tohumlu: istemci ve sunucu aynı');
  check(new Set(g.soldiers.map(paintColorOf)).size === Math.min(g.soldiers.length, PAINT_COLORS.length), 'her savaşçının ayrı boya rengi (paintColorOf)');
}

// 6) 8 botlu ölüm maçı: hepsi paintball tüfeği → havuz sabit, ayırma patlaması yok, botlar düşüşü telafi edip vurabiliyor
{
  const g2 = new Game(null, { headless: true, map: 'kasaba', diff: 'normal', match: { perTeam: 8, type: 'dm', killLimit: 999, time: 999 } });
  const arm = () => { for (const s of g2.soldiers) if (s.alive && s.items[0].id !== 'pbrifle') { s.items = [{ id: 'pbrifle', mag: 50, reserve: 150 }, { id: 'pbpistol', mag: 12, reserve: 48 }]; s.cur = 0; } };
  g2.on('spawn', arm); arm();
  const P = g2.paint, pool0 = P.pool.length;
  globalThis.gc?.(); const h0 = process.memoryUsage().heapUsed;
  let maxLive = 0, t0 = performance.now();
  for (let i = 0; i < 60 * 60; i++) { g2.step(DT); g2.netEvents.length = 0; maxLive = Math.max(maxLive, P.live.length); }
  const ms = (performance.now() - t0) / 3600;
  globalThis.gc?.(); const h1 = process.memoryUsage().heapUsed;
  const kills = g2.soldiers.reduce((a, s) => a + s.kills, 0);
  console.log(`      60 sn, 8 bot: ${P.stats.fired} top, ${P.stats.hits} isabet, ${P.stats.wall} duvar, ${kills} öldürme · en çok ${maxLive} top havada · adım ${ms.toFixed(3)} ms · yığın ${((h1 - h0) / 1048576).toFixed(1)} MB`);
  check(P.pool.length === pool0 && P.live.length + P.free.length === pool0 && P.stats.recycled === 0, `top havuzu sabit (${pool0}), geri dönüşüm ${P.stats.recycled}`);
  check(P.stats.fired > 500 && P.stats.hits > 30 && kills > 3, 'botlar paintball ile ateş ediyor, düşüşü telafi edip öldürebiliyor');
  check(globalThis.gc ? h1 - h0 < 8 * 1048576 : true, 'yığın büyümesi küçük (top başına ayırma yok)');
}

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
