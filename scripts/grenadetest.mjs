// El bombası testi (12.144), ağsız: doğrudan Game (sunucuyla aynı yol: insan girdisi → humanTick → triggerUpdate).
// Ölçer: bakış açısına göre menzil (ilk değme / patlama yeri / yuvarlanma), uçuş + fünye süresi, alttan atış, pişirme (kalan fünye, elde patlama),
// hasar–mesafe eğrisi (öldürme / yaralama yarıçapı), duvar arkası korunma, takım / kendi hasarı, önizleme (simulateNade) = gerçek patlama yeri,
// sekme (duvardan geri döner, sonsuza yuvarlanmaz), botların bomba kullanımı (başsız 5v5 maç).
//   node scripts/grenadetest.mjs [harita=colgecidi]
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import { TUNE } from '../src/game/balance.js';
import { NADE, throwState, simulateNade, killRadius } from '../src/game/grenade.js';
import * as THREE from 'three';

const MAP = process.argv[2] || 'colgecidi';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const V = THREE.Vector3;
const g = new Game(null, { headless: true, map: MAP, diff: 'normal', match: { perTeam: 3, type: 'tdm', tickets: 900 } });
const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli'), C = g.claimSlot('blue', 'Cem');
const ha = g.humans.get(A.id);
const brains = g.brains.splice(0);
const DT = 1 / 60; let q = 0;
const evs = [];
const step = (n = 1) => { for (let i = 0; i < n; i++) { g.step(DT); evs.push(...g.netEvents); g.netEvents.length = 0; } };
// w: istemci girdiyi kendi adımından SONRA yollar (attıktan sonra kendiliğinden döndüğü silah dahil) → sunucu okuduğu anda A.cur (getter)
const input = (extra) => { const m = { q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: A.yaw, pt: A.pitch, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, vt: null, ...extra }; if (!('w' in m)) Object.defineProperty(m, 'w', { get: () => A.cur, enumerable: true }); ha.queue.push(m); };
const park = (s, x, z) => { s.pos.set(x, g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); s.alive = true; s.hp = s.maxHp = 100; s.protT = 0; };
step(130);
for (const s of [A, B, C]) s.protT = 0;

// ── düz, açık şerit: 50 m boyunca zemin düz, 0,3–14 m yükseklikte engel yok ──
function findLane(len = 50) {
  for (let k = 0; k < 40000; k++) {
    const x = -110 + Math.random() * 220, z = -110 + Math.random() * 220, yaw = Math.random() * Math.PI * 2;
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw), h0 = g.world.heightAt(x, z);
    if (!g.nav.isFree(x, z)) continue;
    let ok = true;
    for (let d = 0; d <= len && ok; d += 0.5) if (Math.abs(g.world.heightAt(x + dx * d, z + dz * d) - h0) > 0.04) ok = false;
    const dir = new V(dx, 0, dz);
    for (const hy of [0.12, 0.5, 1, 2, 4, 8, 14]) if (ok) for (const side of [-0.4, 0, 0.4]) if (ok && g.world.raycast(new V(x + dz * side, h0 + hy, z - dx * side), dir, len, {})) ok = false;
    if (ok) return { x, z, yaw, h0, dx, dz };
  }
  return null;
}
const L = findLane();
check(!!L, `düz açık şerit bulundu (${MAP}) ${L ? [L.x.toFixed(1), L.z.toFixed(1)] : ''}`);
park(B, L.x - L.dz * 60, L.z + L.dx * 60); park(C, L.x - L.dz * 64, L.z + L.dx * 64);

// A'yı şeridin başına koy, bombayı ver, tetiği bas; holdTicks kadar basılı tut (pişirme), bırak. Atış anındaki önizlemeyi (aynı fonksiyon) kaydet.
const st = WSTATS.grenade;
function throwOne(pitchDeg, { holdTicks = 1, under = false, id = 'grenade', at = L, yaw = L.yaw, move = null } = {}) {
  park(A, at.x, at.z); A.hp = 9999; A.maxHp = 9999; A.yaw = yaw; A.pitch = pitchDeg * Math.PI / 180;
  A.items[2] = { id, mag: 3, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.cook = null; A.backT = 0; A.reloadT = 0; A.useT = 0;
  g.projectiles.length = 0; evs.length = 0;
  const base = { yw: yaw, pt: A.pitch, a: under ? 1 : 0, ...(move || {}) };              // w: A.cur (istemci gibi: attıktan sonra kendi döndüğü silah)
  input({ ...base, fp: 1, fh: 1 }); step(1);
  for (let i = 1; i < holdTicks; i++) { input({ ...base, fh: 1 }); step(1); }
  // bırakma girdisinden hemen önceki durumla önizleme: humanTick sırası (update+move, sonra girdi) → aynı adımı elle ilerletip ölçemeyiz;
  // bunun yerine bırakma anında soldier._throw'u yakalayıp oradaki durumdan simüle et
  let preview = null;
  const orig = A._throw.bind(A);
  A._throw = (s2, fuse, u, inHand) => { const p = new V(), v = new V(); throwState(A, s2, u, p, v, g.world); preview = { ...simulateNade(g.world, p, v, inHand ? 0 : fuse, {}), fuse }; preview.end = preview.end.clone(); preview.land = preview.land.clone(); return orig(s2, fuse, u, inHand); };
  input({ ...base, fh: 0 });
  const t0 = g.time;
  let gr = null, boom = null, boomT = null, land = null, landT = null, maxY = -1e9, restT = null;
  for (let i = 0; i < 60 * 8 && !boom; i++) {
    if (i) input({ ...base, fh: 0 });
    step(1);
    for (const e of evs) { if (e.e === 'gr' && e.by === A.id) gr = e; if (e.e === 'boom' && gr && e.id === gr.id) { boom = new V(...e.p); boomT = g.time - t0; } }
    evs.length = 0;
    const p = g.projectiles.find((x) => x.type === 'grenade' && x.owner === A);
    if (p) { maxY = Math.max(maxY, p.pos.y); if (!land && p.bounces + (p.ground ? 1 : 0) > 0) { land = p.pos.clone(); landT = g.time - t0; } if (p.rest && restT === null) restT = g.time - t0; }
  }
  A._throw = orig;
  const D = (v) => (v ? Math.hypot(v.x - at.x, v.z - at.z) : NaN);
  return { gr, boom, boomT, land, landT, restT, landD: D(land), boomD: D(boom), apex: maxY - at.h0, preview, alive: A.alive, cur: A.cur };
}

// 1) menzil tablosu
console.log('\n── Menzil (düz zemin, ayakta, duran oyuncu; fünye 3 sn) ──');
console.log('  açı     ilk değme       patlama        yuvarlanma  tepe   önizleme farkı');
const R = {};
for (const deg of [-20, 0, 15, 30, 45, 60]) {
  const r = (R[deg] = throwOne(deg));
  const pd = r.preview ? r.preview.end.distanceTo(r.boom) : NaN;
  console.log(`  ${String(deg).padStart(3)}°   ${r.landD.toFixed(1).padStart(5)} m @${r.landT?.toFixed(2)} sn   ${r.boomD.toFixed(1).padStart(5)} m @${r.boomT?.toFixed(2)} sn   ${(r.boomD - r.landD).toFixed(1).padStart(5)} m   ${r.apex.toFixed(1).padStart(4)} m   ${pd.toFixed(3)} m`);
}
const U0 = throwOne(0, { under: true }), U30 = throwOne(30, { under: true });
console.log(`  alttan 0°: ilk değme ${U0.landD.toFixed(1)} m, patlama ${U0.boomD.toFixed(1)} m · alttan 30°: ${U30.landD.toFixed(1)} → ${U30.boomD.toFixed(1)} m`);
const maxR = Math.max(...Object.values(R).map((r) => r.boomD));
check(R[0].boomD >= 13 && R[0].boomD <= 26, `0° bakışta makul atış (${R[0].boomD.toFixed(1)} m)`);
check(maxR >= 25 && maxR <= 42, `tam güçle menzil 25–42 m (${maxR.toFixed(1)} m)`);
check(R[30].landD > R[15].landD && R[15].landD > R[0].landD && R[0].landD > R[-20].landD, 'yukarı baktıkça ilk değme uzar (0–30°)');
check(U0.boomD < R[0].boomD * 0.7 && U0.boomD > 2, `alttan atış kısa (${U0.boomD.toFixed(1)} m)`);
check(Object.values(R).every((r) => Math.abs(r.boomT - st.fuse) < 0.04), `fünye: bırakmadan patlamaya ${R[0].boomT.toFixed(2)} sn (${st.fuse} sn)`);
check(Object.values(R).every((r) => r.preview && r.preview.end.distanceTo(r.boom) < 0.05), 'önizleme = gerçek patlama yeri (her açı, < 5 cm)');
check(R[0].restT !== null && R[0].restT < st.fuse, `yuvarlanma fünyeden önce biter (${R[0].restT?.toFixed(2)} sn), sonsuz yuvarlanma yok`);
check(R[0].boomD - R[0].landD < 6, `düz atışta yuvarlanma < 6 m (${(R[0].boomD - R[0].landD).toFixed(1)} m)`);
check(A.cur !== 2, 'attıktan sonra önceki silaha dönüldü');

// 2) pişirme: 1,5 sn basılı → bırakınca kalan 1,5 sn; 3,2 sn basılı → elde patlar, atan ölür
const ck = throwOne(30, { holdTicks: 90 });
check(Math.abs(ck.boomT - (st.fuse - 1.5)) < 0.05, `pişirme: 1,5 sn tutunca bırakmadan ${ck.boomT?.toFixed(2)} sn sonra patladı (havada: ${(ck.boom.y - L.h0).toFixed(1)} m)`);
check(ck.preview && ck.preview.end.distanceTo(ck.boom) < 0.05, 'pişirilmiş bombada da önizleme = gerçek patlama');
{
  park(A, L.x, L.z); A.yaw = L.yaw; A.pitch = 0; A.hp = 100; A.maxHp = 100; A.protT = 0;
  A.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.cook = null;
  evs.length = 0;
  input({ w: 2, yw: L.yaw, pt: 0, fp: 1, fh: 1 }); step(1);
  for (let i = 0; i < 200 && A.alive; i++) { input({ w: 2, yw: L.yaw, pt: 0, fh: 1 }); step(1); }
  for (let i = 0; i < 10; i++) step(1);
  const k = evs.find((e) => e.e === 'kill' && e.v === A.id);
  check(!A.alive && k && /Bomba/.test(k.w), `elde patlayan bomba atanı öldürür (${k ? k.w : 'kill yok'})`);
  check(evs.some((e) => e.e === 'gr' && e.by === A.id && e.ih === 1) && evs.some((e) => e.e === 'boom' && e.k === 'x'), 'elde patlama ağ olayları (gr ih=1 + boom)');
  step(60 * 6); A.protT = 0;
}
// pişirirken ölürse bomba elden düşer
{
  park(A, L.x, L.z); A.hp = 100; A.maxHp = 100; A.protT = 0; A.alive = true;
  A.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.cook = null;
  evs.length = 0;
  input({ w: 2, yw: L.yaw, pt: 0, fp: 1, fh: 1 }); step(1);
  for (let i = 0; i < 30; i++) { input({ w: 2, yw: L.yaw, pt: 0, fh: 1 }); step(1); }
  A.takeDamage(500, B, 'body', B.pos, 'test');
  const dropped = g.projectiles.find((p) => p.type === 'grenade' && p.owner === A);
  check(!!dropped && Math.abs(dropped.fuse - (st.fuse - 31 / 60)) < 0.05, `pişirirken ölen oyuncunun bombası kalan fünyeyle düşer (${dropped?.fuse.toFixed(2)} sn)`);
  step(60 * 6); A.protT = 0; A.alive || step(60);
}
// silah değiştirmek pişirmeyi iptal eder (bomba harcanmaz)
{
  park(A, L.x, L.z); A.hp = 100; A.maxHp = 100; A.protT = 0;
  A.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.cook = null; g.projectiles.length = 0;
  input({ w: 2, yw: L.yaw, pt: 0, fp: 1, fh: 1 }); step(1);
  for (let i = 0; i < 20; i++) { input({ w: 2, yw: L.yaw, pt: 0, fh: 1 }); step(1); }
  input({ w: 0, yw: L.yaw, pt: 0, fh: 1 }); step(1);
  input({ w: 0, yw: L.yaw, pt: 0, fh: 0 }); step(30);
  check(!A.cook && A.items[2].mag === 2 && !g.projectiles.some((p) => p.owner === A), 'silah değiştirince pim geri takılır (bomba harcanmaz, atılmaz)');
}

// 3) hasar – mesafe (yerde patlama, ayakta hedef, açık hat)
console.log('\n── Hasar (yerde patlama, ayakta hedef) ──');
const dmgAt = (d, who = B, pos = null) => {
  park(who, L.x + L.dx * (10 + d), L.z + L.dz * (10 + d));
  park(A, L.x - L.dz * 40, L.z + L.dx * 40);
  const bp = pos || new V(L.x + L.dx * 10, L.h0 + NADE.r, L.z + L.dz * 10);
  g.explode(bp, st.radius, st.dmg, A, st.name);
  return 100 - Math.max(0, who.hp);
};
const row = []; let killR = 0, woundR = 0;
for (let d = 0; d <= 8; d += 0.5) { const x = dmgAt(d); if (x >= 100) killR = d; if (x > 0) woundR = d; if (d % 1 === 0) row.push(`${d} m: ${x.toFixed(0)}`); }
console.log('  ' + row.join(' · '));
console.log(`  öldürme ≤ ${killR} m, yaralama ≤ ${woundR} m (yatay, 0,5 m adım) · hesap: öldürme yarıçapı ${killRadius(st).toFixed(2)} m (gövde merkezine)`);
check(killR >= 3 && killR <= 4.5, `öldürme yarıçapı 3–4,5 m (${killR} m)`);
check(woundR >= 6 && woundR <= 8, `yaralama yarıçapı 6–8 m (${woundR} m)`);
check(dmgAt(1, C) === 0, 'takım arkadaşına hasar yok');
{ park(A, L.x, L.z); A.hp = 100; A.protT = 0; g.explode(new V(L.x + L.dx * 1, L.h0 + NADE.r, L.z + L.dz * 1), st.radius, st.dmg, A, st.name); const self = 100 - A.hp; check(Math.abs(self - st.dmg * (1 - (A.center(new V()).distanceTo(new V(L.x + L.dx, L.h0 + NADE.r, L.z + L.dz)) / st.radius) ** 2) * TUNE.selfBlast) < 1, `kendi bombası ×${TUNE.selfBlast} (1 m: ${self.toFixed(0)})`); A.hp = 100; A.alive = true; }

// 4) duvar arkası: patlama noktası ile hedef arasında tam duvar → hasar yok; aynı mesafe açıkta → hasar var
function findWall() {
  for (let k = 0; k < 40000; k++) {
    const x = -110 + Math.random() * 220, z = -110 + Math.random() * 220, a = Math.random() * Math.PI * 2;
    if (!g.nav.isFree(x, z)) continue;
    const h0 = g.world.heightAt(x, z), d = new V(Math.cos(a), 0, Math.sin(a));
    const ts = [0.3, 1, 1.6, 2.2, 3].map((hy) => g.world.raycast(new V(x, h0 + hy, z), d, 4, {})?.t ?? null);
    if (ts.some((t) => t === null) || Math.max(...ts) - Math.min(...ts) > 0.15 || ts[0] < 1.5) continue;      // düz, dik, en az 3 m yüksek tek duvar
    const nh = g.world.raycast(new V(x, h0 + 1.6, z), d, 4, {});
    if (nh.normal.dot(d) > -0.95) continue;                                                                        // duvara dik bakılıyor (eğik duvarda bomba duvar boyunca kayar)
    const t = Math.max(...ts) + 1.2, bx = x + d.x * t, bz = z + d.z * t;
    if (!g.nav.isFree(bx, bz) || Math.abs(g.world.heightAt(bx, bz) - h0) > 0.2) continue;
    return { x, z, h0, bx, bz, t, wall: Math.min(...ts) };
  }
}
const W = findWall();
if (W) {
  park(B, W.bx, W.bz); park(A, W.x + 40, W.z + 40);
  g.explode(new V(W.x, W.h0 + NADE.r, W.z), st.radius, st.dmg, A, st.name);
  const behind = 100 - B.hp;
  const open = dmgAt(W.t);
  check(behind === 0 && open > 0, `duvar arkasında ${W.t.toFixed(1)} m: hasar ${behind.toFixed(0)} (açıkta aynı mesafe: ${open.toFixed(0)})`);
} else check(false, 'duvar bulunamadı');

// 5) önizleme = gerçek: rastgele yerlerde, koşarken, duvarlara / kasalara sekerek (her açı)
let worst = 0, n = 0, bounced = 0;
for (let k = 0; k < 400 && n < 24; k++) {
  const x = -100 + Math.random() * 200, z = -100 + Math.random() * 200;
  if (!g.nav.isFree(x, z)) continue;
  const h0 = g.world.heightAt(x, z), at = { x, z, h0 };
  const r = throwOne(-10 + Math.random() * 55, { at, yaw: Math.random() * 6.28, under: Math.random() < 0.25, holdTicks: 1 + Math.floor(Math.random() * 60), move: Math.random() < 0.5 ? { f: 1, s: Math.random() < 0.5 ? 1 : 0 } : null });
  if (!r.boom || !r.preview) continue;
  n++; worst = Math.max(worst, r.preview.end.distanceTo(r.boom));
  if (g.projectiles.length === 0 && r.gr) bounced++;
}
check(n >= 15 && worst < 0.05, `önizleme = gerçek patlama: ${n} rastgele atış (koşarak / alttan / pişirilmiş / sekmeli), en büyük fark ${(worst * 100).toFixed(1)} cm`);

// 6) duvardan sekme: duvara 4 m'den düz at → geri seker, duvarın önünde kalır
if (W) {
  const yaw = Math.atan2(-(W.bx - W.x), -(W.bz - W.z));
  const r = throwOne(5, { at: { x: W.x, z: W.z, h0: W.h0 }, yaw });
  const toWall = (p) => (p.x - W.x) * (W.bx - W.x) / W.t + (p.z - W.z) * (W.bz - W.z) / W.t;
  check(r.boom && toWall(r.boom) < W.wall, `duvardan sekti: patlama duvarın bu yanında (${toWall(r.boom).toFixed(1)} m, duvar ${W.wall.toFixed(1)} m)`);
}

// 7) duman / flaş aynı atış sistemiyle (pişirme yok: fünye bırakınca başlar)
const sm = throwOne(20, { id: 'smoke', holdTicks: 60 }), fl = throwOne(20, { id: 'flash', holdTicks: 60 });
check(sm.boom && Math.abs(sm.boomT - WSTATS.smoke.fuse) < 0.04 && evs.length >= 0, `duman: 1 sn tutulsa da fünye bırakınca başlar (${sm.boomT?.toFixed(2)} sn), ${sm.boomD.toFixed(1)} m`);
check(fl.boom && Math.abs(fl.boomT - WSTATS.flash.fuse) < 0.04, `flaş: ${fl.boomT?.toFixed(2)} sn, ${fl.boomD.toFixed(1)} m`);
check(g.smokes.length > 0, 'duman küresi oluştu');

// 8) botlar: başsız 5v5 maç (3 dk, herkes el bombalı) — kaç bomba, kaç öldürme, nişan isabeti (hedeflenen nokta ↔ patlama), hedef patlamada
//    4 m içinde mi (ya da o ana kadar ölmüş mü), aynı botun art arda atma aralığı
{
  const { BotBrain } = await import('../src/game/bot.js');
  const recs = [], orig = BotBrain.prototype.tryNade;
  BotBrain.prototype.tryNade = function (gid, tp, dist, tg, turn) {
    const n0 = this.nadeReady, r = orig.call(this, gid, tp, dist, tg, turn);
    if (r && this.nadeReady !== n0) recs.push({ by: this.s.id, tp: new V(tp.x, tp.y, tp.z), tg, hidden: !!turn });
    return r;
  };
  const bg = new Game(null, { headless: true, map: MAP, diff: 'normal', match: { perTeam: 5, type: 'tdm', tickets: 2000 } });
  const arm = (x) => { if (x.brain) x.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; };      // herkes el bombalı (ekipman rastgele seçilir; test kararlı olsun)
  bg.soldiers.forEach(arm); bg.on('spawn', arm);
  const thr = [], kills = [];
  const secs = +(process.env.BOTSECS || 180);
  for (let i = 0; i < secs * 30 && !bg.ended; i++) {
    bg.step(1 / 30);
    for (const e of bg.netEvents) {
      if (e.e === 'gr' && e.w === 'grenade') { thr.push({ t: bg.time, by: e.by }); const rc = [...recs].reverse().find((r) => r.by === e.by && r.id === undefined); if (rc) rc.id = e.id; }
      if (e.e === 'kill') kills.push(e);
      if (e.e === 'boom' && e.k === 'x') { const rc = recs.find((r) => r.id === e.id); if (rc) { rc.aimErr = Math.hypot(rc.tp.x - e.p[0], rc.tp.z - e.p[2]); rc.hit = rc.tg ? (!rc.tg.alive && rc.tg.deadT < 3.5) || Math.hypot(rc.tg.pos.x - e.p[0], rc.tg.pos.z - e.p[2]) <= 4 : null; } }
    }
    bg.netEvents.length = 0;
  }
  BotBrain.prototype.tryNade = orig;
  const nk = kills.filter((k) => /Bomba/.test(k.w)).length, by = {}, done = recs.filter((r) => r.aimErr !== undefined), combat = done.filter((r) => r.hit !== null);
  let minGap = Infinity;
  for (const t of thr) { if (by[t.by] !== undefined) minGap = Math.min(minGap, t.t - by[t.by]); by[t.by] = t.t; }
  const aimOk = done.filter((r) => r.aimErr <= 3).length, hits = combat.filter((r) => r.hit).length;
  console.log(`\n── Botlar (${MAP} 5v5, hepsi el bombalı, ${secs} sn) ── el bombası ${thr.length} (${done.filter((r) => r.hidden).length} saklanan düşmana), bomba öldürmesi ${nk} / toplam ${kills.length} öldürme`);
  console.log(`   nişan → patlama ≤ 3 m: ${aimOk}/${done.length} · çatışma atışlarında hedef patlamada ≤ 4 m (ya da ölmüş): ${hits}/${combat.length} · aynı botta en kısa ara ${Number.isFinite(minGap) ? minGap.toFixed(1) + ' sn' : '—'}`);
  check(thr.length >= 2, 'botlar el bombası kullanıyor');
  check(done.length && aimOk / done.length >= 0.7, `bot nişanı: atışların %70'i hedeflediği yere ≤ 3 m düşüyor (${aimOk}/${done.length})`);
  check(!combat.length || hits / combat.length >= 0.4, `çatışma bombalarının %40'ı hedefi yakalıyor (${hits}/${combat.length})`);
  check(!Number.isFinite(minGap) || minGap >= 12, 'aynı bot art arda bomba yağdırmıyor (≥ 12 sn ara)');
  check(thr.length <= secs / 3, `bomba yağmuru yok (${thr.length} atış / ${secs} sn)`);
}

console.log(fail ? '\nsonuç: HATA' : '\nsonuç: OK'); process.exit(fail ? 1 : 0);
