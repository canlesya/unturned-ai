// El bombası testi (12.144 → 12.193 PUBG tarzı), ağsız: doğrudan Game (sunucuyla aynı yol: insan girdisi → humanTick → triggerUpdate).
// Ölçer: bakış açısına göre menzil (ilk değme / patlama yeri / yuvarlanma), uçuş + fünye süresi, alttan atış (sağ tık = 'nu' girdisi), pişirme (R = 'rl':
// pimi çekince fünye başlar; çekmeden atılırsa tam fünye), elde patlama (öldürme akışı), pişirirken ölme / silah değiştirme, hasar–mesafe eğrisi
// (öldürücü iç yarıçap + düşüş, yatana %20 az), siper (duvar keser, yerdeki bomba / eğim yanlışlıkla kesmez), önizleme (simulateNade) = gerçek patlama
// (düz, duvar sekmesi, eğim; < 0,5 m), flaş ilk değme fünyesi, duman süresi, botların bomba kullanımı (pişirme / alttan; başsız 5v5 maç).
//   node scripts/grenadetest.mjs [harita=colgecidi]   (BOTSECS=180)
import { Game } from '../src/game/game.js';
import { WSTATS } from '../src/game/stats.js';
import { TUNE } from '../src/game/balance.js';
import { NADE, throwState, simulateNade, killRadius, fragDamage } from '../src/game/grenade.js';
import * as THREE from 'three';

const MAP = process.argv[2] || 'colgecidi';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const V = THREE.Vector3;
const g = new Game(null, { headless: true, map: MAP, diff: 'normal', match: { perTeam: 3, type: 'tdm', tickets: 900 } });
const A = g.claimSlot('blue', 'Ali'), B = g.claimSlot('red', 'Veli'), C = g.claimSlot('blue', 'Cem');
const ha = g.humans.get(A.id);
g.brains.splice(0);
const DT = 1 / 60; let q = 0;
const evs = [];
const step = (n = 1) => { for (let i = 0; i < n; i++) { g.step(DT); evs.push(...g.netEvents); g.netEvents.length = 0; } };
// w: istemci girdiyi kendi adımından SONRA yollar (attıktan sonra kendiliğinden döndüğü silah dahil) → sunucu okuduğu anda A.cur (getter)
const input = (extra) => { const m = { q: ++q, f: 0, r: 0, l: 0, s: 0, j: 0, a: 0, yw: A.yaw, pt: A.pitch, c: 0, p: 0, u: 0, fh: 0, fp: 0, rl: 0, fm: 0, o: 0, nu: 0, vt: null, ...extra }; if (!('w' in m)) Object.defineProperty(m, 'w', { get: () => A.cur, enumerable: true }); ha.queue.push(m); };
const park = (s, x, z, y) => { s.pos.set(x, y ?? g.world.heightAt(x, z), z); s.vel.set(0, 0, 0); s.alive = true; s.hp = s.maxHp = 100; s.protT = 0; s.prone = false; s.crouching = false; s.height = 1.8; };
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
    for (const hy of [0.12, 0.5, 1, 1.3, 1.5, 1.7, 2, 4, 8, 14]) if (ok) for (const side of [-0.4, 0, 0.2, 0.4]) if (ok && g.world.raycast(new V(x + dz * side, h0 + hy, z - dx * side), dir, len, {})) ok = false;
    if (ok) { const k0 = [A.pos.clone(), A.yaw, A.pitch]; A.pos.set(x, h0, z); A.yaw = yaw; A.pitch = 0; const p = new V(), v = new V(); throwState(A, WSTATS.grenade, false, p, v, g.world); const r = simulateNade(g.world, p, v, 5, {}, 600); A.pos.copy(k0[0]); A.yaw = k0[1]; A.pitch = k0[2]; if (Math.hypot(r.land.x - x, r.land.z - z) > 10) return { x, z, yaw, h0, dx, dz }; }      // 0° atış da şeritte engelsiz (ince direk / tente)
  }
  return null;
}
const L = findLane();
check(!!L, `düz açık şerit bulundu (${MAP}) ${L ? [L.x.toFixed(1), L.z.toFixed(1)] : ''}`);
park(B, L.x - L.dz * 60, L.z + L.dx * 60); park(C, L.x - L.dz * 64, L.z + L.dx * 64);

// A'yı yerleştir, bombayı ver, tetiğe bas; holdTicks kadar basılı tut (cookAt: o adımda R = pimi çek), bırak.
// Bırakma anındaki önizlemeyi (aynı fonksiyon, soldier._throw yakalanır) kaydet; patlama yeri / süresi ölçülür.
const st = WSTATS.grenade;
function throwOne(pitchDeg, { holdTicks = 1, cookAt = -1, under = false, id = 'grenade', at = L, yaw = L.yaw, move = null } = {}) {
  park(A, at.x, at.z, at.y); A.hp = 9999; A.maxHp = 9999; A.yaw = yaw; A.pitch = pitchDeg * Math.PI / 180;
  A.items[2] = { id, mag: 3, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.cook = null; A.backT = 0; A.reloadT = 0; A.useT = 0; A.nadeUnder = false;
  g.projectiles.length = 0; evs.length = 0;
  const base = { yw: yaw, pt: A.pitch, ...(move || {}) };
  input({ ...base, fp: 1, fh: 1, nu: under ? 1 : 0 }); step(1);
  for (let i = 1; i < holdTicks; i++) { input({ ...base, fh: 1, rl: i === cookAt ? 1 : 0 }); step(1); }
  let preview = null;
  const orig = A._throw.bind(A);
  A._throw = (s2, fuse, u, inHand) => { const p = new V(), v = new V(); throwState(A, s2, u, p, v, g.world); preview = { ...simulateNade(g.world, p, v, inHand ? 0 : fuse, {}, 600, s2, g.vehicles), fuse, under: u }; preview.end = preview.end.clone(); preview.land = preview.land.clone(); return orig(s2, fuse, u, inHand); };
  input({ ...base, fh: 0 });
  const t0 = g.time;
  let gr = null, boom = null, boomT = null, land = null, landT = null, maxY = -1e9, restT = null;
  for (let i = 0; i < 60 * 9 && !boom; i++) {
    if (i) input({ ...base, fh: 0 });
    step(1);
    for (const e of evs) { if (e.e === 'gr' && e.by === A.id) gr = e; if (e.e === 'boom' && gr && e.id === gr.id) { boom = new V(...e.p); boomT = g.time - t0; } }
    evs.length = 0;
    const p = g.projectiles.find((x) => x.type === 'grenade' && x.owner === A);
    if (p) { maxY = Math.max(maxY, p.pos.y); if (!land && p.bounces + (p.ground ? 1 : 0) > 0) { land = p.pos.clone(); landT = g.time - t0; } if (p.rest && restT === null) restT = g.time - t0; }
  }
  A._throw = orig;
  const D = (v) => (v ? Math.hypot(v.x - at.x, v.z - at.z) : NaN);
  return { gr, boom, boomT, land, landT, restT, landD: D(land), boomD: D(boom), apex: maxY - (at.h0 ?? at.y), preview, alive: A.alive, cur: A.cur, err: preview && boom ? preview.end.distanceTo(boom) : NaN };
}

// 1) menzil tablosu
console.log(`\n── Menzil (düz zemin, ayakta, duran oyuncu; fünye ${st.fuse} sn, pişirmeden) ──`);
console.log('  açı     ilk değme       patlama        yuvarlanma  tepe   önizleme farkı');
const R = {};
for (const deg of [-20, 0, 15, 30, 45, 60]) {
  const r = (R[deg] = throwOne(deg));
  console.log(`  ${String(deg).padStart(3)}°   ${r.landD.toFixed(1).padStart(5)} m @${r.landT?.toFixed(2)} sn   ${r.boomD.toFixed(1).padStart(5)} m @${r.boomT?.toFixed(2)} sn   ${(r.boomD - r.landD).toFixed(1).padStart(5)} m   ${r.apex.toFixed(1).padStart(4)} m   ${r.err.toFixed(3)} m`);
}
const U0 = throwOne(0, { under: true }), U30 = throwOne(30, { under: true });
console.log(`  alttan 0°: ilk değme ${U0.landD.toFixed(1)} m, patlama ${U0.boomD.toFixed(1)} m · alttan 30°: ${U30.landD.toFixed(1)} → ${U30.boomD.toFixed(1)} m`);
const maxR = Math.max(...Object.values(R).map((r) => r.boomD));
check(R[0].boomD >= 13 && R[0].boomD <= 26, `0° bakışta makul atış (${R[0].boomD.toFixed(1)} m)`);
check(maxR >= 25 && maxR <= 42, `tam güçle menzil 25–42 m (${maxR.toFixed(1)} m)`);
check(R[30].landD > R[15].landD && R[15].landD > R[0].landD && R[0].landD > R[-20].landD, 'yukarı baktıkça ilk değme uzar (0–30°)');
check(U0.preview?.under && U0.boomD < R[0].boomD * 0.7 && U0.boomD > 2, `sağ tık (nu) → alttan yuvarlama kısa (${U0.boomD.toFixed(1)} m)`);
check(U0.apex < 1.2, `alttan atış alçak (tepe ${U0.apex.toFixed(2)} m göz üstü/altı)`);
check(Object.values(R).every((r) => Math.abs(r.boomT - st.fuse) < 0.04), `pişirmeden: bırakmadan patlamaya ${R[0].boomT.toFixed(2)} sn (PUBG ${st.fuse} sn)`);
check(Object.values(R).every((r) => r.err < 0.05), 'önizleme = gerçek patlama yeri (her açı, < 5 cm)');
check(R[0].restT !== null && R[0].restT < st.fuse, `yuvarlanma fünyeden önce biter (${R[0].restT?.toFixed(2)} sn), sonsuz yuvarlanma yok`);
check(A.cur !== 2, 'attıktan sonra önceki silaha dönüldü');

// 2) pişirme (PUBG: R ile pim çekilir)
const nc = throwOne(30, { holdTicks: 90 });
check(Math.abs(nc.boomT - st.fuse) < 0.05, `R'ye basmadan 1,5 sn tutmak fünyeyi başlatmaz (${nc.boomT?.toFixed(2)} sn)`);
const ck = throwOne(30, { holdTicks: 150, cookAt: 30 });           // 30. adımda R → 120 adım (2 sn) pişti
check(Math.abs(ck.boomT - (st.fuse - 2)) < 0.05, `R + 2 sn pişirme: bırakınca ${ck.boomT?.toFixed(2)} sn sonra patladı (beklenen ${(st.fuse - 2).toFixed(2)}; havada ${(ck.boom.y - L.h0).toFixed(1)} m)`);
check(ck.err < 0.05, `pişirilmiş bombada önizleme = gerçek (${(ck.err * 100).toFixed(1)} cm)`);
{
  park(A, L.x, L.z); A.yaw = L.yaw; A.pitch = 0; A.hp = 100; A.maxHp = 100; A.protT = 0;
  A.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.cook = null;
  evs.length = 0;
  input({ w: 2, yw: L.yaw, pt: 0, fp: 1, fh: 1 }); step(1);
  input({ w: 2, yw: L.yaw, pt: 0, fh: 1, rl: 1 }); step(1);
  let t = 0;
  for (let i = 0; i < 400 && A.alive; i++) { input({ w: 2, yw: L.yaw, pt: 0, fh: 1 }); step(1); t++; }
  for (let i = 0; i < 10; i++) step(1);
  const k = evs.find((e) => e.e === 'kill' && e.v === A.id);
  check(!A.alive && k && k.k === A.id && /Bomba/.test(k.w), `aşırı pişirme: ${(t / 60).toFixed(2)} sn sonra elde patladı, atan öldü, öldürme akışı "${k ? k.w : 'kill yok'}" (kendi)`);
  check(Math.abs(t / 60 - st.fuse) < 0.05, `elde patlama fünye dolunca (${(t / 60).toFixed(2)} / ${st.fuse} sn)`);
  check(evs.some((e) => e.e === 'gr' && e.by === A.id && e.ih === 1) && evs.some((e) => e.e === 'boom' && e.k === 'x'), 'elde patlama ağ olayları (gr ih=1 + boom)');
  step(60 * 6); A.protT = 0;
}
// pişirirken ölürse bomba elden düşer (pim çekildiyse); çekilmediyse düşmez
for (const lit of [true, false]) {
  park(A, L.x, L.z); A.hp = 100; A.maxHp = 100; A.protT = 0; A.alive = true;
  A.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.cook = null; g.projectiles.length = 0;
  input({ w: 2, yw: L.yaw, pt: 0, fp: 1, fh: 1 }); step(1);
  for (let i = 0; i < 30; i++) { input({ w: 2, yw: L.yaw, pt: 0, fh: 1, rl: lit && i === 0 ? 1 : 0 }); step(1); }
  A.takeDamage(500, B, 'body', B.pos, 'test');
  const dropped = g.projectiles.find((p) => p.type === 'grenade' && p.owner === A);
  if (lit) check(!!dropped && Math.abs(dropped.fuse - (st.fuse - 30 / 60)) < 0.05, `pimi çekik ölen oyuncunun bombası kalan fünyeyle düşer (${dropped?.fuse.toFixed(2)} sn)`);
  else check(!dropped, 'pimi çekilmeden ölen oyuncunun bombası düşmez');
  step(60 * 6); A.protT = 0; A.alive || step(60);
}
// silah değiştirmek: pim çekilmediyse bomba cebe döner; çekildiyse ayağının dibine düşer (PUBG)
for (const lit of [false, true]) {
  park(A, L.x, L.z); A.hp = 100; A.maxHp = 100; A.protT = 0;
  A.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; A.cur = 2; A.switchT = 0; A.cd = 0; A.cook = null; g.projectiles.length = 0;
  input({ w: 2, yw: L.yaw, pt: 0, fp: 1, fh: 1 }); step(1);
  for (let i = 0; i < 20; i++) { input({ w: 2, yw: L.yaw, pt: 0, fh: 1, rl: lit && i === 0 ? 1 : 0 }); step(1); }
  input({ w: 0, yw: L.yaw, pt: 0, fh: 1 }); step(1);
  input({ w: 0, yw: L.yaw, pt: 0, fh: 0 }); step(2);
  const drop = g.projectiles.find((p) => p.owner === A);
  if (!lit) check(!A.cook && A.items[2].mag === 2 && !drop, 'pim çekilmeden silah değiştirince bomba harcanmaz, atılmaz');
  else check(A.items[2].mag === 1 && drop && drop.vel.length() < 1.5 && Math.abs(drop.fuse - (st.fuse - 20 / 60)) < 0.06, `pimi çekik bombayla silah değişince bomba ayağının dibine düşer (${drop?.fuse.toFixed(2)} sn kaldı)`);
  g.projectiles.length = 0; A.hp = 100; A.alive = true; step(5);
}

// 3) hasar – mesafe (yerde patlama, açık hat). Patlama g.fragBlast (oyunun kullandığı yol)
console.log('\n── Hasar (yerde patlama; PUBG: öldürücü ≤ 3,5 m, orta 3,5–8,5, az 8,5–10) ──');
const dmgAt = (d, who = B, { pos = null, prone = false } = {}) => {
  park(who, L.x + L.dx * (10 + d), L.z + L.dz * (10 + d));
  if (prone) { who.prone = true; who.height = 0.5; }
  park(A, L.x - L.dz * 40, L.z + L.dx * 40);
  const bp = pos || new V(L.x + L.dx * 10, L.h0 + NADE.r, L.z + L.dz * 10);
  g.fragBlast(bp, st, A);
  const r = 100 - Math.max(0, who.hp);
  who.prone = false; who.height = 1.8;
  return r;
};
const row = []; let killR = 0, woundR = 0;
for (let d = 0; d <= 11; d += 0.5) { const x = dmgAt(d); if (x >= 100) killR = d; if (x > 0) woundR = d; if (d % 1 === 0) row.push(`${d} m: ${x.toFixed(0)}`); }
console.log('  ' + row.join(' · '));
console.log(`  öldürme ≤ ${killR} m, yaralama ≤ ${woundR} m (yatay, 0,5 m adım) · eğri (gövde merkezine): 3,5 m ${fragDamage(st, 3.5)} · 4 m ${fragDamage(st, 4).toFixed(0)} · 6 m ${fragDamage(st, 6).toFixed(0)} · 8,5 m ${fragDamage(st, 8.5).toFixed(0)} · 10 m ${fragDamage(st, 10)}`);
check(killR >= 3 && killR <= 3.5, `öldürücü iç yarıçap ≈ 3,5 m (ayakta hedef, yatay ${killR} m)`);
check(woundR >= 9 && woundR <= 10, `yaralama yarıçapı ≈ 10 m (${woundR} m)`);
check(fragDamage(st, 6) > 30 && fragDamage(st, 6) < 60 && fragDamage(st, 9) < 10, 'düşüş: 6 m orta, 9 m az');
const st5 = dmgAt(5), pr5 = dmgAt(5, B, { prone: true });
check(pr5 > 0 && pr5 < st5, `yatan hedef daha az hasar alır (5 m: ayakta ${st5.toFixed(0)}, yatarken ${pr5.toFixed(0)})`);
check(dmgAt(1, C) === 0, 'takım arkadaşına hasar yok');
{ park(A, L.x, L.z); A.hp = 100; A.protT = 0; const bp = new V(L.x + L.dx * 5, L.h0 + NADE.r, L.z + L.dz * 5); g.fragBlast(bp, st, A); const self = 100 - A.hp; const exp = fragDamage(st, A.center(new V()).distanceTo(bp)) * TUNE.selfBlast; check(Math.abs(self - exp) < 1, `kendi bombası ×${TUNE.selfBlast} (5 m: ${self.toFixed(0)})`); A.hp = 100; A.alive = true; }
{ const vs = g.vehicles?.list || []; check(true, `araç hasarı: el bombası ${st.vehDmg} × araç çarpanı (${st.vehR} m içinde; ${vs.length} araç bu haritada)`); }

// 4) siper: patlama noktası ile hedef arasında tam duvar → hasar yok; aynı mesafe açıkta → hasar var
function findWall() {
  for (let k = 0; k < 150000; k++) {
    const x = -110 + Math.random() * 220, z = -110 + Math.random() * 220, a = Math.random() * Math.PI * 2;
    if (!g.nav.isFree(x, z)) continue;
    const h0 = g.world.heightAt(x, z), d = new V(Math.cos(a), 0, Math.sin(a));
    const ts = [];
    for (const sd of [-0.4, 0, 0.4]) for (const hy of [0.3, 1, 1.6, 2.2, 3]) ts.push(g.world.raycast(new V(x - d.z * sd, h0 + hy, z + d.x * sd), d, 4, {})?.t ?? null);      // en az 1,2 m geniş duvar (atış sağ omuzdan çıkar)
    if (ts.some((t) => t === null) || Math.max(...ts) - Math.min(...ts) > 0.15 || ts[0] < 1.5) continue;      // düz, dik, en az 3 m yüksek tek duvar
    const nh = g.world.raycast(new V(x, h0 + 1.6, z), d, 4, {});
    if (nh.normal.dot(d) > -0.95) continue;
    const t = Math.max(...ts) + 1.2, bx = x + d.x * t, bz = z + d.z * t;
    if (!g.nav.isFree(bx, bz) || Math.abs(g.world.heightAt(bx, bz) - h0) > 0.2) continue;
    return { x, z, h0, bx, bz, t, wall: Math.min(...ts) };
  }
}
const W = findWall();
if (W) {
  park(B, W.bx, W.bz); park(A, W.x + 40, W.z + 40);
  g.fragBlast(new V(W.x, W.h0 + NADE.r, W.z), st, A);
  const behind = 100 - B.hp;
  const open = dmgAt(W.t);
  check(behind === 0 && open > 0, `duvar arkasında ${W.t.toFixed(1)} m: hasar ${behind.toFixed(0)} (açıkta aynı mesafe: ${open.toFixed(0)})`);
} else check(false, 'duvar bulunamadı');
// yerdeki bomba (zemine gömülü / tam yer hizası) ve yatan hedef: zemin yanlışlıkla siper sayılmaz
{
  const a = dmgAt(3, B, { pos: new V(L.x + L.dx * 10, L.h0 + 0.005, L.z + L.dz * 10), prone: true });
  check(a >= 50, `yer hizasındaki bomba yatan hedefe (3 m) vurur: ${a.toFixed(0)}`);
}
// eğim: tepe / yamaçta bomba, hedef aşağıda ya da yukarıda (açık hava): yükseltilmiş çıkış noktası sayesinde hasar var
function findSlope() {
  for (let k = 0; k < 60000; k++) {
    const x = -110 + Math.random() * 220, z = -110 + Math.random() * 220, a = Math.random() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    if (!g.nav.isFree(x, z)) continue;
    const h0 = g.world.heightAt(x, z), h1 = g.world.heightAt(x + dx * 4, z + dz * 4), hm = g.world.heightAt(x + dx * 2, z + dz * 2);
    const sl = (h1 - h0) / 4;
    if (Math.abs(sl) < 0.12 || Math.abs(sl) > 0.5 || Math.abs(hm - (h0 + h1) / 2) > 0.15 || !g.nav.isFree(x + dx * 4, z + dz * 4)) continue;
    if (g.world.raycast(new V(x, h0 + 3, z), new V(0, 1, 0), 20, {})) continue;                              // açık hava
    const tgt = new V(x + dx * 4, h1 + 1.0, z + dz * 4);
    if (!g.world.clear(new V(x, h0 + 0.4, z), tgt)) continue;
    return { x, z, h0, tx: x + dx * 4, tz: z + dz * 4, sl };
  }
  return null;
}
{
  const S = findSlope();
  if (S) {
    park(B, S.tx, S.tz); park(A, S.x + 40, S.z + 40);
    const pos = new V(S.x, S.h0 + NADE.r, S.z);
    g.fragBlast(pos, st, A);
    check(100 - B.hp > 0, `eğimde (eğim ${(S.sl * 100).toFixed(0)}%) bomba 4 m ötedeki hedefe vurur: ${(100 - B.hp).toFixed(0)}`);
  } else console.log('  (bu haritada uygun eğim bulunamadı; eğim hasar denetimi atlandı)');
}

// 5) önizleme = gerçek: rastgele yerlerde, koşarken, duvarlara / kasalara sekerek, alttan, pişirilmiş (her açı) — sınır 0,5 m (iste ölçülen çok daha az)
let worst = 0, n = 0, nWall = 0, nUnder = 0, nCook = 0, nSlope = 0;
for (let k = 0; k < 600 && n < 40; k++) {
  const x = -100 + Math.random() * 200, z = -100 + Math.random() * 200;
  if (!g.nav.isFree(x, z)) continue;
  const h0 = g.world.heightAt(x, z), at = { x, z, h0 };
  const hold = 1 + Math.floor(Math.random() * 120), cookAt = Math.random() < 0.5 ? Math.floor(Math.random() * hold) : -1, under = Math.random() < 0.3;
  const r = throwOne(-10 + Math.random() * 55, { at, yaw: Math.random() * 6.28, under, holdTicks: hold, cookAt, move: Math.random() < 0.5 ? { f: 1, s: Math.random() < 0.5 ? 1 : 0 } : null });
  if (!r.boom || !r.preview) continue;
  n++; worst = Math.max(worst, r.err);
  if (r.gr && Math.hypot(r.boom.x - r.land?.x, r.boom.z - r.land?.z) > 0 && r.preview.n > 2) nWall += r.preview.landed ? 1 : 0;
  if (under) nUnder++; if (cookAt >= 1) nCook++;
  if (Math.abs(r.boom.y - h0) > 0.6) nSlope++;
}
check(n >= 30 && worst < 0.5, `önizleme = gerçek patlama: ${n} rastgele atış (alttan ${nUnder}, pişirilmiş ${nCook}, farklı kotta biten ${nSlope}), en büyük fark ${(worst * 100).toFixed(1)} cm (sınır 50 cm)`);

// 6) duvardan sekme: duvara 4 m'den düz at → geri seker, duvarın önünde kalır; önizleme de aynı
if (W) {
  const yaw = Math.atan2(-(W.bx - W.x), -(W.bz - W.z));
  const r = throwOne(5, { at: { x: W.x, z: W.z, h0: W.h0 }, yaw });
  const toWall = (p) => (p.x - W.x) * (W.bx - W.x) / W.t + (p.z - W.z) * (W.bz - W.z) / W.t;
  check(r.boom && toWall(r.boom) < W.wall, `duvardan sekti: patlama duvarın bu yanında (${toWall(r.boom).toFixed(1)} m, duvar ${W.wall.toFixed(1)} m)`);
  check(r.err < 0.5, `duvar sekmesinde önizleme = gerçek (${(r.err * 100).toFixed(1)} cm)`);
}

// 7) duman / flaş aynı atış sistemiyle
const sm = throwOne(20, { id: 'smoke', holdTicks: 60, cookAt: 10 });
check(sm.boom && Math.abs(sm.boomT - WSTATS.smoke.fuse) < 0.04, `duman pişirilmez (R etkisiz): fünye bırakınca ${sm.boomT?.toFixed(2)} sn, ${sm.boomD.toFixed(1)} m`);
const smk = g.smokes[g.smokes.length - 1];
check(smk && smk.max === WSTATS.smoke.smokeLife && smk.rMax === WSTATS.smoke.radius, `duman ${smk?.max} sn, ${smk?.rMax} m (PUBG gibi uzun)`);
const fl = throwOne(20, { id: 'flash', holdTicks: 30 });
check(fl.boom && fl.landT && Math.abs(fl.boomT - Math.min(WSTATS.flash.fuse, fl.landT + WSTATS.flash.impactFuse)) < 0.05, `flaş: ilk değmeden ${WSTATS.flash.impactFuse} sn sonra patlar (değme ${fl.landT?.toFixed(2)} → patlama ${fl.boomT?.toFixed(2)} sn), önizleme farkı ${(fl.err * 100).toFixed(1)} cm`);
const flc = throwOne(60, { id: 'flash', holdTicks: 80, cookAt: 2 });
check(flc.boom && flc.boomT < WSTATS.flash.fuse - 1.2 && flc.err < 0.5, `flaş pişirilir: R + 1,3 sn → havada ${flc.boomT?.toFixed(2)} sn sonra (yükseklik ${(flc.boom.y - L.h0).toFixed(1)} m)`);
{   // flaş körlüğü: bakan 5 m → uzun, 18 m → kısa; arkası dönük 3 m → dolaylı (≤ 3 sn)
  const { flashBang } = await import('../src/game/gadgets.js');
  const blindAt = (d, face) => { park(B, L.x + L.dx * d, L.z + L.dz * d); B.blindT = 0; B.yaw = face ? Math.atan2(L.dx, L.dz) : Math.atan2(-L.dx, -L.dz); B.pitch = -0.1; flashBang(g, new V(L.x, L.h0 + 0.3, L.z), A, WSTATS.flash); return B.blindT; };
  const b5 = blindAt(5, true), b18 = blindAt(18, true), bb = blindAt(3, false);
  check(b5 > 4 && b5 <= 5.5 && b18 >= 0.9 && b18 < 2 && bb > 0.5 && bb <= 3, `flaş körlüğü: bakan 5 m ${b5.toFixed(1)} sn · 18 m ${b18.toFixed(1)} sn · arkası dönük 3 m ${bb.toFixed(1)} sn`);
}

// 8) botlar: başsız 5v5 maç (herkes el bombalı) — kaç bomba, pişirme / alttan oranı, nişan isabeti, hedef patlamada 4 m içinde mi, art arda atma aralığı
{
  const { BotBrain } = await import('../src/game/bot.js');
  const recs = [], orig = BotBrain.prototype.tryNade;
  BotBrain.prototype.tryNade = function (gid, tp, dist, tg, turn) {
    const n0 = this.nadeReady, r = orig.call(this, gid, tp, dist, tg, turn);
    if (r && this.nadeReady !== n0) recs.push({ by: this.s.id, tp: new V(tp.x, tp.y, tp.z), tg, hidden: !!turn, cook: !!this.s.botCook || !!this.pendNade?.cook, t: this.game.time });
    return r;
  };
  const bg = new Game(null, { headless: true, map: MAP, diff: 'normal', match: { perTeam: 5, type: 'tdm', tickets: 2000 } });
  const arm = (x) => { if (x.brain) x.items[2] = { id: 'grenade', mag: 2, reserve: 0 }; };
  bg.soldiers.forEach(arm); bg.on('spawn', arm);
  const thr = [], kills = []; let drops = 0;
  const secs = +(process.env.BOTSECS || 180);
  for (let i = 0; i < secs * 30 && !bg.ended; i++) {
    bg.step(1 / 30);
    for (const e of bg.netEvents) {
      if (e.e === 'gr' && e.w === 'grenade' && !e.ih && Math.hypot(...e.v) < 2) { drops++; const rc = [...recs].reverse().find((r) => r.by === e.by && r.id === undefined); if (rc) rc.id = -1; continue; }      // pişirirken ölen botun düşen bombası (atış değil)
      if (e.e === 'gr' && e.w === 'grenade' && !e.ih) { const rc = [...recs].reverse().find((r) => r.by === e.by && r.id === undefined); thr.push({ t: bg.time, by: e.by, f: e.f, under: false }); if (rc) { rc.id = e.id; rc.f = e.f; } }
      if (e.e === 'kill') kills.push(e);
      if (e.e === 'boom' && e.k === 'x') { const rc = recs.find((r) => r.id === e.id); if (rc) { rc.aimErr = Math.hypot(rc.tp.x - e.p[0], rc.tp.z - e.p[2]); rc.hit = rc.tg ? (!rc.tg.alive && rc.tg.deadT < 3.5) || Math.hypot(rc.tg.pos.x - e.p[0], rc.tg.pos.z - e.p[2]) <= 4 : null; } }
    }
    bg.netEvents.length = 0;
  }
  BotBrain.prototype.tryNade = orig;
  const nk = kills.filter((k) => /Bomba/.test(k.w)).length, by = {}, done = recs.filter((r) => r.aimErr !== undefined), combat = done.filter((r) => r.hit !== null);
  let minGap = Infinity;
  for (const t of thr) { if (by[t.by] !== undefined) minGap = Math.min(minGap, t.t - by[t.by]); by[t.by] = t.t; }
  const aimOk = done.filter((r) => r.aimErr <= 3).length, hits = combat.filter((r) => r.hit).length, cooked = thr.filter((t) => t.f < st.fuse - 0.25).length;
  const self = kills.filter((k) => k.k === k.v && /Bomba/.test(k.w)).length;
  console.log(`\n── Botlar (${MAP} 5v5, hepsi el bombalı, ${secs} sn) ── el bombası ${thr.length} (pişirilmiş ${cooked}, ${done.filter((r) => r.hidden).length} saklanan düşmana), bomba öldürmesi ${nk} (kendini ${self}) / toplam ${kills.length} öldürme · pişirirken ölüp düşürülen ${drops}`);
  console.log(`   nişan → patlama ≤ 3 m: ${aimOk}/${done.length} · çatışma atışlarında hedef patlamada ≤ 4 m (ya da ölmüş): ${hits}/${combat.length} · aynı botta en kısa ara ${Number.isFinite(minGap) ? minGap.toFixed(1) + ' sn' : '—'}`);
  check(thr.length >= 2, 'botlar el bombası kullanıyor');
  check(cooked >= 1 && cooked < thr.length, `botlar bazen pişiriyor (${cooked}/${thr.length})`);
  check(done.length && aimOk / done.length >= 0.6, `bot nişanı: atışların %60'ı hedeflediği yere ≤ 3 m düşüyor (${aimOk}/${done.length})`);
  check(!combat.length || hits / combat.length >= 0.35, `çatışma bombalarının %35'i hedefi yakalıyor (${hits}/${combat.length})`);
  check(!Number.isFinite(minGap) || minGap >= 12, 'aynı bot art arda bomba yağdırmıyor (≥ 12 sn ara)');
  check(thr.length <= secs / 3, `bomba yağmuru yok (${thr.length} atış / ${secs} sn)`);
  check(self <= Math.max(1, thr.length * 0.1), `botlar kendini bombayla öldürmüyor (${self})`);
}

console.log(fail ? '\nsonuç: HATA' : '\nsonuç: OK'); process.exit(fail ? 1 : 0);
