// Paintball silah testi (ağsız, doğrudan başsız Game = sunucu mantığı): top uçuşu / düşüşü, hasar (tüfek 6, tabanca 3, kafa ×1,5),
// duvarda durma, lag compensation, atış hızı, havuz (ayırma yok) + 8 botla yük; seri atışta açılma (bloom) + toparlanma, tohumlu saçılımın
// istemci = sunucu tutarlılığı, Boya Kulesi kutuları (alma, yeniden belirme, doluyken alınmaz, aynı kutuya iki kişi → biri).   node --expose-gc scripts/pbtest.mjs
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

// 2) hasar: tüfek 6 gövde isabeti, tabanca 3, kafa ×1,5
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
  check(r.killedAt === 6 && r.zones.every((z) => z === 0), 'paintball tüfeği gövdeye 6 isabette öldürür (18 × 6 = 108)');
  const p = killCount('pbpistol', 8);
  console.log(`      tabanca: ${p.killedAt} isabette öldü (bölgeler ${p.zones})`);
  check(p.killedAt === 3, 'paintball tabancası 3 isabette öldürür (34 × 3 = 102)');
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
  check(headDmg && headDmg.z === 2 && Math.abs(headDmg.d - 27) < 1e-6, 'kafa isabeti ×1,5 (27)');
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
  let hw = 0, hn = 0; const N = 12, st = WSTATS.pbrifle, sv = [st.hip, st.ads];
  st.hip = st.ads = 0;                                                              // yalnız geri sarmayı ölç: topun doğal sapması (7. bölüm) kapalı
  for (let i = 0; i < N; i++) { if (lagShot(true)) hw++; if (lagShot(false)) hn++; }
  [st.hip, st.ads] = sv;
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

// 7) seri atışta açılma (bloom): basılı tutunca büyür, bırakınca toparlanır; nişan / çömelme küçültür
{
  reset('pbrifle'); place(15); step(30);
  const st = WSTATS.pbrifle, sp = () => A.spreadNow(st);
  input(ha, { a: 0 }); input(hb, {}); step(); const hip0 = sp();
  for (let i = 0; i < 20; i++) { input(ha, { a: 1 }); input(hb, {}); step(); }
  const ads0 = sp();
  for (let i = 0; i < 18; i++) { input(ha, { a: 1, fh: 1 }); input(hb, {}); step(); A.items[0].mag = 50; }       // 3 top
  const s3 = sp();
  for (let i = 0; i < 90; i++) { input(ha, { a: 1, fh: 1 }); input(hb, {}); step(); A.items[0].mag = 50; }       // +15 top (1,8 sn basılı)
  const s18 = sp(), b18 = A.bloom;
  for (let i = 0; i < 36; i++) { input(ha, { a: 1 }); input(hb, {}); step(); }                                    // 0,6 sn bırak
  const rec = sp();
  console.log(`      sapma (rad): bel ${hip0.toFixed(4)} · nişan ${ads0.toFixed(4)} · 3 top ${s3.toFixed(4)} · 18 top ${s18.toFixed(4)} (bloom ${b18.toFixed(4)}) · 0,6 sn sonra ${rec.toFixed(4)}`);
  check(ads0 < hip0 * 0.5 && ads0 > 0, 'nişanda doğal sapma küçük ama sıfır değil (ilk top da hafif sapar)');
  check(s3 > ads0 * 1.5 && s18 > s3 * 1.6 && b18 >= st.bloomMax * 0.95, 'basılı tutunca açılma büyür, tavana (bloomMax) dayanır');
  check(rec < ads0 * 1.15, 'bırakınca 0,6 sn içinde toparlanır (kısa seri ödüllenir)');
  A.bloom = 0.02; A.adsT = 0; const stand = A.spreadNow(st); A.crouching = true; const cr = A.spreadNow(st); A.crouching = false; A.adsT = 1; const ad = A.spreadNow(st);
  check(cr < stand * 0.8 && ad < stand * 0.7, `açılmayı çömelme (${cr.toFixed(4)}) ve nişan (${ad.toFixed(4)}) küçültür (ayakta bel ${stand.toFixed(4)})`);
  // kısa seriler (3 top + 0,4 sn ara) uzun basılı tutmaktan isabetli: 25 m'de hedefe isabet oranı
  const rate = (burst) => {
    reset('pbrifle'); place(25); step(20); A.protT = B.protT = 0; let shots = 0, hits = 0;
    for (let i = 0; i < 1260; i++) {
      if (i && i % 420 === 0) { place(25); step(20); A.protT = B.protT = 0; A.bloom = 0; }          // 3 farklı yer
      const fire = burst ? i % 42 < 18 : true, a = aimAt(A, new THREE.Vector3(B.pos.x, B.pos.y + 1.1, B.pos.z), WSTATS.pbrifle);
      input(ha, { yw: a.yw, pt: a.pt - A.recoilP, a: 1, fh: fire ? 1 : 0, vt: g.tick }); input(hb, {}); step(); drain();
      shots += evs.filter((e) => e.e === 'pb' && e.by === A.id).length; hits += evs.filter((e) => e.e === 'pbh' && e.v === B.id).length; evs.length = 0;
      A.items[0].mag = 50; B.hp = B.maxHp; B.alive = true;
    }
    return hits / Math.max(1, shots);
  };
  const rb = rate(true), rf = rate(false);
  console.log(`      25 m isabet oranı: kısa seri ${(rb * 100).toFixed(0)}% · sürekli ${(rf * 100).toFixed(0)}%`);
  check(rb > rf * 1.25, 'kısa seri sürekli ateşten belirgin isabetli');
}

// 8) tohumlu saçılım tutarlılığı: aynı girdi dizisi iki ayrı oyunda (istemci tahmini ↔ sunucu) aynı top yönlerini verir (bloom / nişan / hareket dahil)
{
  const run = () => {
    const g3 = new Game(null, { headless: true, map: 'kasaba', diff: 'easy', match: { perTeam: 2, type: 'tdm', tickets: 500 } });
    const P = g3.claimSlot('blue', 'P'); g3.brains.length = 0; for (const s of g3.soldiers) if (s !== P) { s.vacant = true; s.alive = false; }
    const h = g3.humans.get(P.id); P.pos.set(0, g3.world.heightAt(0, 0) + 30, 0); P.fly = true;
    P.items[0] = { id: 'pbrifle', mag: 50, reserve: 150 }; P.cur = 0; P.switchT = 0; P.protT = 0;
    const dirs = []; const f0 = g3.paint.fire.bind(g3.paint); g3.paint.fire = (s, o, d, ...r) => { dirs.push([d.x, d.y, d.z]); return f0(s, o, d, ...r); };
    for (let i = 0; i < 480; i++) { h.queue.push({ q: i + 1, f: i % 50 < 20 ? 1 : 0, r: 0, l: 0, s: 0, j: 0, a: i % 160 > 60 ? 1 : 0, yw: 0.3 + i * 0.002, pt: 0.05, c: 0, p: 0, u: 0, w: 0, fh: i % 30 < 22 ? 1 : 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null }); g3.step(DT); g3.netEvents.length = 0; P.items[0].mag = 50; }
    return dirs;
  };
  const d1 = run(), d2 = run();
  const same = d1.length === d2.length && d1.every((d, i) => d.every((v, k) => Math.abs(v - d2[i][k]) < 1e-9));
  const spreadOk = new Set(d1.map((d) => d[0].toFixed(5))).size > d1.length * 0.8;
  console.log(`      ${d1.length} / ${d2.length} top, aynı: ${same}, farklı yön: ${spreadOk}`); check(d1.length > 60 && same && spreadOk, `aynı girdilerle iki oyunda ${d1.length} topun yönü birebir aynı (tohumlu saçılım + açılma durumu tutarlı)`);
}

// 9) Boya Kulesi kutuları: alma, yeniden belirme (TUNE), doluyken alınmaz, aynı kutuya iki kişi aynı adımda → yalnız biri
{
  const { TUNE } = await import('../src/game/balance.js');
  const gk = new Game(null, { headless: true, map: 'boyakulesi', diff: 'easy', match: { perTeam: 4, type: 'pb' } });
  const X = gk.claimSlot('f0', 'X'), Y = gk.claimSlot('f1', 'Y'), hx = gk.humans.get(X.id), hy = gk.humans.get(Y.id);
  gk.brains.length = 0; for (const s of gk.soldiers) if (s !== X && s !== Y) { s.vacant = true; s.alive = false; }
  let qq = 0; const inK = (h) => h.queue.push({ q: ++qq, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: 0, pt: 0, c: 0, p: 0, u: 0, w: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null });
  const ev = []; const stepK = (n = 1) => { for (let i = 0; i < n; i++) { inK(hx); inK(hy); gk.step(DT); ev.push(...gk.netEvents); gk.netEvents.length = 0; } };
  stepK(150);                                                                     // doğma korumaları bitsin
  const L = gk.pickups.list, H = L.filter((p) => p.type === 'health'), AM = L.filter((p) => p.type === 'ammo');
  check(AM.length === 6 && H.length === 4, `Boya Kulesi'nde ${AM.length} boya topu + ${H.length} can kutusu (${L.map((p) => p.name).join(', ')})`);
  // her kutu yürünür yerde: gövde sığar, çevresinde 0,6 m açık, bot ızgarasında aynı katta düğüm var ve bir doğuş noktasından yol bulunur
  {
    const bad = []; const sp0 = gk.map.ffaSpawns[0];
    for (const p of L) {
      const fake = { pos: new THREE.Vector3(p.x, p.y, p.z) }; let open = gk.world.canStand(fake);
      for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) { fake.pos.set(p.x + dx, p.y, p.z + dz); if (!gk.world.canStand(fake)) open = false; }
      const n = gk.nav.nearestNode(p.x, p.z, p.y, 1.2), fy = n >= 0 ? gk.nav.lf[n] : NaN;
      const path = n >= 0 && gk.nav.findPath(sp0.x, sp0.z, p.x, p.z, 0.7, sp0.y ?? 0, p.y);
      if (!open || !(Math.abs(fy - p.y) < 0.4) || !path) bad.push(`${p.name} (açık ${open}, kat ${fy}, yol ${!!path})`);
    }
    check(!bad.length, `kutular yürünür ve bota ulaşılır ${bad.length ? bad.join('; ') : ''}`);
    const { Pickups } = await import('../src/game/pickups.js');
    const pk2 = new Pickups({ mode: { paintball: true }, map: { pickupSpots: [{ x: 1, y: 2, z: 3, kind: 'ammo' }, { x: 4, z: 5, kind: 'health' }] }, world: { heightAt: () => 0.5 }, headless: true });
    check(pk2.list.length === 2 && pk2.list[0].type === 'ammo' && pk2.list[1].type === 'health' && pk2.list[1].y === 0.5 && pk2.list[0].y === 2, "başka haritalar için map.pickupSpots ({ x, y, z, kind }) desteği (y yoksa zemin)");
    const pk3 = new Pickups({ mode: { paintball: false }, map: { pickupSpots: [{ x: 1, y: 2, z: 3, kind: 'ammo' }] }, world: { heightAt: () => 0 }, headless: true });
    check(pk3.list.length === 0, 'paintball dışı modlarda kutu yok');
  }
  const put = (s, p, ox = 0) => { s.pos.set(p.x + ox, p.y, p.z); s.vel.set(0, 0, 0); };
  const away = (s) => { s.pos.set(-20.8, 9, -17.2); s.vel.set(0, 0, 0); };
  // can kutusu: can doluyken alınmaz
  const h0 = H[0]; X.hp = X.maxHp; put(X, h0); away(Y); stepK(3);
  check(h0.t === 0 && X.hp === X.maxHp, `can doluyken can kutusu alınmaz (${h0.name})`);
  X.hp = 50; ev.length = 0; stepK(2);
  const e1 = ev.find((e) => e.e === 'pk' && e.i === h0.i && !e.a);
  check(X.hp === 50 + TUNE.pbHeal && h0.t > TUNE.pbHealthRespawn - 0.1 && e1 && e1.v === X.id && e1.t === TUNE.pbHealthRespawn, `can kutusu alındı: can 50 → ${X.hp} (+${TUNE.pbHeal}), 'pk' olayı, ${TUNE.pbHealthRespawn} sn sonra yeniden`);
  X.hp = 60; stepK(1);
  check(X.hp === 60, 'yeniden belirmeden tekrar alınamaz');
  away(X); ev.length = 0;
  const T0 = gk.time; let back = -1;
  for (let i = 0; i < 60 * 25 && back < 0; i++) { stepK(1); if (ev.some((e) => e.e === 'pk' && e.i === h0.i && e.a)) back = gk.time - T0; }
  check(Math.abs(back - TUNE.pbHealthRespawn) < 0.2 && h0.t === 0, `kutu ${back.toFixed(2)} sn sonra yeniden belirdi ('pk' a:1)`);
  X.hp = 80; put(X, h0); stepK(1);
  check(X.hp === X.maxHp, `can tavanı: 80 + ${TUNE.pbHeal} → ${X.hp} (en çok ${X.maxHp})`);
  // boya topu kutusu: cephane doluyken alınmaz; yedek boşalınca alınır, yedek tama dolar
  const a0 = AM[0]; away(X); X.items = [{ id: 'pbrifle', mag: 50, reserve: 150 }, { id: 'pbpistol', mag: 12, reserve: 48 }, { id: 'knife', mag: 1, reserve: 0 }];
  put(X, a0); stepK(3);
  check(a0.t === 0, 'cephane doluyken boya topu kutusu alınmaz');
  X.items[0].reserve = 0; X.items[1].reserve = 5; stepK(2);
  check(a0.t > 0 && X.items[0].reserve === 150 && X.items[1].reserve === 48, `boya topu kutusu: yedekler doldu (${X.items[0].reserve} / ${X.items[1].reserve})`);
  // aynı kutuya iki kişi aynı adımda: yalnız biri alır (en yakın)
  const h1 = H[1]; away(X); away(Y); stepK(1);
  X.hp = 40; Y.hp = 40; put(X, h1, 0.3); put(Y, h1, -0.5); ev.length = 0; stepK(1);
  const got = ev.filter((e) => e.e === 'pk' && e.i === h1.i && !e.a);
  check(got.length === 1 && (X.hp === 80) !== (Y.hp === 80), `aynı kutuya iki kişi: yalnız biri aldı (${got[0] && gk.soldiers[got[0].v].name}) · X ${X.hp} Y ${Y.hp}`);
  check(got[0] && got[0].v === X.id, 'en yakın olan alır');
  // uzaktan alınmaz (yarıçap)
  const h2 = H[2]; X.hp = 40; put(X, h2, 1.6); stepK(2);
  check(h2.t === 0, '1,6 m uzaktan alınmaz (yarıçap 1,2 m)');
  check(gk.pickups.netState().length >= 2, `katılan istemciye bekleyen kutular gider (welcome.pk: ${JSON.stringify(gk.pickups.netState())})`);
  // TUNE ile ayarlanır (admin paneli)
  const old = TUNE.pbAmmoRespawn; TUNE.pbAmmoRespawn = 7; const a1 = AM[1]; X.items[0].reserve = 0; put(X, a1); stepK(1);
  check(Math.abs(a1.t - 7) < 0.05, `yeniden belirme süresi TUNE.pbAmmoRespawn ile (${a1.t.toFixed(2)} sn)`); TUNE.pbAmmoRespawn = old;
  // botlar: 8 botlu paintball maçında canı / cephanesi azalan botlar kutulara gider
  const gb = new Game(null, { headless: true, map: 'boyakulesi', diff: 'normal', match: { perTeam: 8, type: 'pb', killLimit: 999, time: 999 } });
  const taken = { ammo: 0, health: 0 };
  const tk0 = gb.pickups.take.bind(gb.pickups); gb.pickups.take = (p, s) => { taken[p.type]++; return tk0(p, s); };
  for (let i = 0; i < 60 * 120; i++) { gb.step(DT); gb.netEvents.length = 0; }
  const kb = gb.soldiers.reduce((a, s) => a + s.kills, 0);
  console.log(`      120 sn, 8 bot (Boya Kulesi): ${kb} eleme · botlar ${taken.health} can + ${taken.ammo} boya topu kutusu aldı`);
  check(taken.health + taken.ammo >= 3 && kb > 5, 'botlar kutuları kullanıyor ve hâlâ eleyebiliyor');
  // tek bot, cephanesi bitmek üzere, rakip yok → en yakın boya topu kutusuna yürür ve alır
  {
    const g1 = new Game(null, { headless: true, map: 'boyakulesi', diff: 'normal', match: { perTeam: 3, type: 'pb', killLimit: 999, time: 999 } });
    const bb = g1.brains[0], bs = bb.s; for (const s of g1.soldiers) if (s !== bs) { s.vacant = true; s.alive = false; s.respawnT = 1e9; }
    g1.brains.length = 1; let got = -1;
    for (let i = 0; i < 60 * 40 && got < 0; i++) { if (bs.alive) { bs.items[0].reserve = 0; bs.items[0].mag = Math.min(bs.items[0].mag, 8); if (bs.items[1]) bs.items[1].reserve = 0; } g1.step(DT); if (g1.netEvents.some((e) => e.e === 'pk' && !e.a && e.v === bs.id)) got = g1.time; g1.netEvents.length = 0; }
    check(got > 0, `cephanesi azalan bot boya topu kutusuna gidip aldı (${got.toFixed(1)} sn)`);
  }
}

console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
