// Kuzey Vadisi (12.172) denetimi (başsız, tarayıcısız): node --expose-gc scripts/kuzeytest.mjs
// 1 kurulum süresi / bellek (sunucu yolu) · 2 sunucu = istemci (çarpışma / görüş / doğuş / ganimet karması) · 3 doğuşlar · 4 bayraklara yol · 5 köprü + baraj tepesi
// yürüyüşü · 6 savaş alanı sınırı (10 sn → ölüm, içeride ölmez, botlar dışarı gitmez) · 7 sızıntı (rastgele yürüyüş: harita dışı / arazi altı / kutu içi / derin su)
// · 8 ganimet noktaları (bina içi, boş) · 9 kapıdan bina içine yol · 10 bot görüşü: buğday / çalı çiti / ağaç tepesi keser, açıkta görür · 11 hayvan / ses yalnız istemci
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
import { World } from '../src/game/collision.js';
import { NavGrid } from '../src/game/nav.js';
import { SightMap } from '../src/game/sight.js';
let fails = 0; const ok = (c, m, extra = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (extra ? ' · ' + extra : '')); if (!c) fails++; };
const hash = (a) => { let h = 2166136261; const s = JSON.stringify(a); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

MapBuilder.noVisual = true;
const { buildKuzey, KZ_PLAY } = await import('../src/maps/kuzey.js');
global.gc?.(); const m0 = process.memoryUsage().heapUsed;
let t0 = performance.now(); const S = buildKuzey(); const tS = performance.now() - t0;
global.gc?.(); const mem = (process.memoryUsage().heapUsed - m0) / 1e6;
t0 = performance.now(); const nav = new NavGrid(S.colliders, S.bounds, S.terrain, false, S.navCell); S.navPost(nav); const tN = performance.now() - t0;
ok(tS < 1000, '1 sunucu kurulumu < 1 sn', `${tS.toFixed(0)} ms + nav ${tN.toFixed(0)} ms · yığın +${mem.toFixed(1)} MB · ${S.colliders.length} kutu · ${S.sight.length} görüş küresi`);
MapBuilder.noVisual = false;
t0 = performance.now(); const V = buildKuzey(); const tV = performance.now() - t0;
const key = (M) => hash([M.colliders.map((c) => [...c.min, ...c.max].map((v) => +v.toFixed(3))), M.sight, M.spawns, M.lootSpots, M.objectives.map((o) => [o.id, o.x, o.z, +o.y.toFixed(2)])]);
ok(key(S) === key(V), '2 sunucu = istemci (çarpışma, görüş, doğuş, ganimet aynı)', `istemci kurulumu ${tV.toFixed(0)} ms · ${key(S)}`);

const W = new World(S.colliders, S.bounds, S.terrain), T = S.terrain, tmp = [];
const inBox = (x, y, z, h = 1.7) => W._hits(W.query(x - 1, z - 1, x + 1, z + 1, tmp), x, y, z, h);
let bad = 0;
for (const team of ['blue', 'red']) for (const p of S.spawns[team]) { const y = T.heightAt(p.x, p.z) + 0.05; if (inBox(p.x, y, p.z) || !nav.isFree(p.x, p.z) || y < 1 || p.x < KZ_PLAY.minX || p.x > KZ_PLAY.maxX || p.z < KZ_PLAY.minZ || p.z > KZ_PLAY.maxZ) bad++; }
ok(bad === 0 && S.spawns.blue.length >= 24 && S.spawns.red.length >= 24, '3 doğuş noktaları boş / yürünür / alan içi', `${S.spawns.blue.length}+${S.spawns.red.length}, hatalı ${bad}`);
const paths = [];
for (const team of ['blue', 'red']) for (const f of S.objectives) { const s = S.spawns[team][0], q = nav.findPath(s.x, s.z, f.x, f.z); paths.push(q ? 1 : 0); }
ok(paths.every(Boolean), '4 her iki üsten 7 bayrağa yol var', paths.join(''));

// 5 yürüyüş: fizik adımıyla düz yürü (köprü tabliyesi / baraj tepesi), hiç suya / araziye düşmeden karşıya geçmeli
function walk(x, z, vx, vz, secs) {
  const s = { pos: new THREE.Vector3(x, T.heightAt(x, z) + 0.05, z), vel: new THREE.Vector3(), height: 1.78, onGround: true, fallSafe: true };
  let minY = 1e9;
  for (let i = 0; i < secs * 30; i++) { s.vel.x = vx; s.vel.z = vz; W.move(s, 1 / 30); minY = Math.min(minY, s.pos.y); }
  return { x: s.pos.x, z: s.pos.z, y: s.pos.y, minY };
}
const B = walk(0, 60, 0, -5.6, 22);
ok(B.z < -45 && B.minY > 0.5, '5a Taş Köprü yürünür (güney → kuzey)', `son z ${B.z.toFixed(1)}, en alçak y ${B.minY.toFixed(2)}`);
const Wb = walk(-470, 20, 0, -5.6, 22);
ok(Wb.z < -85 && Wb.minY > 0.5, '5b Demir Köprü yürünür', `son z ${Wb.z.toFixed(1)}, en alçak y ${Wb.minY.toFixed(2)}`);
const D = walk(696.6, 20, 0, -5.6, 32);
ok(D.z < -130 && D.minY > 20, '5c baraj tepesi yürünür (24 m)', `son z ${D.z.toFixed(1)}, en alçak y ${D.minY.toFixed(2)}`);

// 6 savaş alanı sınırı
{
  MapBuilder.noVisual = true;
  const { Game } = await import('../src/game/game.js');
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 2, type: 'conquest' } });
  for (const b of g.brains) b.update = () => {};
  const [a, c] = g.soldiers;
  a.pos.set(780, T.heightAt(780, 0), 0); c.pos.set(700, T.heightAt(700, 200), 200);
  for (const s of [a, c]) s.protT = 0;
  let deadAt = null;
  for (let i = 0; i < 30 * 12; i++) { g.step(1 / 30); a.pos.x = 780; a.pos.z = 0; if (!a.alive && deadAt == null) deadAt = g.time; }
  ok(deadAt != null && deadAt > 9.5 && deadAt < 10.6 && c.alive, '6a alan dışında 10 sn sonra ölür, içeride yaşar', `ölüm ${deadAt?.toFixed(2)} sn`);
  let outCells = 0; for (let j = 0; j < nav.h; j += 3) for (let i = 0; i < nav.w; i += 3) { const x = nav.minX + (i + 0.5) * nav.cell, z = nav.minZ + (j + 0.5) * nav.cell; if (!nav.blocked[j * nav.w + i] && (x < KZ_PLAY.minX || x > KZ_PLAY.maxX || z < KZ_PLAY.minZ || z > KZ_PLAY.maxZ)) outCells++; }
  ok(outCells === 0, '6b bot yol ızgarası alan dışına çıkmaz', `${outCells} açık hücre`);
}

// 7 sızıntı: 400 rastgele yürüyüş × 40 sn (yön 3 sn'de bir değişir, ara sıra zıplar)
{
  let leak = 0, under = 0, inside = 0, deep = 0, nan = 0, R = 12345; const rnd = () => ((R = (R * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 400; k++) {
    let x = (rnd() - 0.5) * 1500, z = (rnd() - 0.5) * 1500; if (T.heightAt(x, z) < 0.5) continue;
    const s = { pos: new THREE.Vector3(x, T.heightAt(x, z) + 0.05, z), vel: new THREE.Vector3(), height: 1.78, onGround: true, fallSafe: true };
    W.settle?.(s);
    let a = rnd() * 6.28;
    for (let i = 0; i < 40 * 30; i++) {
      if (i % 90 === 0) a = rnd() * 6.28;
      s.vel.x = Math.cos(a) * 8.4; s.vel.z = Math.sin(a) * 8.4; if (i % 70 === 0 && s.onGround) s.vel.y = 5.2;
      W.move(s, 1 / 30);
      const p = s.pos;
      if (!Number.isFinite(p.x + p.y + p.z)) { nan++; break; }
      if (p.x < S.bounds.minX - 0.01 || p.x > S.bounds.maxX + 0.01 || p.z < S.bounds.minZ - 0.01 || p.z > S.bounds.maxZ + 0.01) { leak++; break; }
      if (p.y < T.heightAt(p.x, p.z) - 0.3) { under++; break; }
      if (s.onGround && !s.onCollider && T.heightAt(p.x, p.z) < T.deepWater - 0.05) { deep++; if (process.env.DBG) console.log('derin', p.x.toFixed(1), p.y.toFixed(2), p.z.toFixed(1), 'başlangıç', x.toFixed(0), z.toFixed(0), 'adım', i); break; }
    }
    if (inBox(s.pos.x, s.pos.y + 0.02, s.pos.z, 1.5)) inside++;
  }
  ok(!leak && !under && !inside && !deep && !nan, '7 sızıntı yok (harita dışı / arazi altı / kutu içi / derin su)', `dışarı ${leak} · altta ${under} · kutu içi ${inside} · derin su ${deep} · NaN ${nan}`);
}

// 8 ganimet noktaları
{
  const L = S.lootSpots; let blocked = 0;
  for (const p of L) if (inBox(p.x, p.y + 0.05, p.z, 0.3)) blocked++;
  const kinds = {}; for (const p of L) kinds[p.k] = (kinds[p.k] || 0) + 1;
  const bk = {}; for (const p of L) if (inBox(p.x, p.y + 0.05, p.z, 0.3)) bk[p.k] = (bk[p.k] || 0) + 1;
  ok(L.length > 250 && blocked / L.length < 0.03, '8 ganimet noktaları (bina içi, boş)', `${L.length} nokta · dolu ${blocked} ${JSON.stringify(bk)} · ${JSON.stringify(kinds)}`);
}
// 9 kapıdan içeri yol (bot): her kapının dış ucundan iç ucuna
{
  let okN = 0, n = 0;
  const doors = S.navDoors || [];
  for (const d of doors.slice(0, 60)) { n++; const a = d.pts[0], b = d.pts[d.pts.length - 1], q = nav.findPath(a[0], a[1], b[0], b[1]); if (q && Math.hypot(q[q.length - 1].x - b[0], q[q.length - 1].z - b[1]) < 1.6) okN++; }
  ok(n > 30 && okN / n > 0.9, '9 botlar kapıdan binaya girebilir (nav)', `${okN}/${n} kapı · açılan hücre ${nav.opened}`);
}
// 10 bot görüşü
{
  const sm = new SightMap(S.sight), a = new THREE.Vector3(), b = new THREE.Vector3();
  const wheat = [330, 360]; a.set(255, T.heightAt(255, 361) + 1.6, 361); b.set(300, T.heightAt(300, 361) + 0.6, 361);                 // tarla kenarından 30 m içeride çömelen
  const t1 = sm.thickness(a, b); b.y += 1.0; const t2 = sm.thickness(a, b);
  ok(t1 > 1.1 && t2 <= 1.1, '10a buğdayda çömelen görünmez, ayakta görünür (bot)', `kalınlık ${t1.toFixed(1)} / ${t2.toFixed(1)} m`);
  a.set(330, T.heightAt(330, 312) + 1.4, 312); b.set(330, T.heightAt(330, 338) + 1.2, 338);
  ok(sm.blocked(a, b), '10b çalı çiti görüşü keser (z 325)', `kalınlık ${sm.thickness(a, b).toFixed(1)} m`);
  // açık görüş hatları: rastgele 2000 çift (150–500 m, ayakta göz) — arazi + kutu + bitki ile açık kalan oran
  let open = 0, open0 = 0, tot = 0, R = 777; const rnd = () => ((R = (R * 16807) % 2147483647) / 2147483647);
  const LOS = new World(S.colliders, S.bounds, S.terrain);
  while (tot < 2000) {
    const x = (rnd() - 0.5) * 1400, z = (rnd() - 0.5) * 1400, ang = rnd() * 6.28, dd = 150 + rnd() * 350, x2 = x + Math.cos(ang) * dd, z2 = z + Math.sin(ang) * dd;
    if (Math.abs(x2) > 700 || Math.abs(z2) > 700 || T.heightAt(x, z) < 1 || T.heightAt(x2, z2) < 1) continue;
    tot++; a.set(x, T.heightAt(x, z) + 1.6, z); b.set(x2, T.heightAt(x2, z2) + 1.3, z2);
    const cl = LOS.clear(a, b); if (cl) open0++; if (cl && !sm.blocked(a, b)) open++;
  }
  console.log(`     açık görüş hattı (150–500 m, ayakta göz → göğüs): arazi + yapı %${(open0 / tot * 100).toFixed(1)} → + bitki örtüsü %${(open / tot * 100).toFixed(1)}`);
}
// 11 istemci görselleri sunucuda kurulmaz
ok(!S.fx && !!V.fx && !S.veg, '11 hayvan / ot / ses / gece ışığı yalnız istemcide (sunucuda fx yok)');
console.log(fails ? `sonuç: ${fails} HATA` : 'sonuç: OK');
process.exit(fails ? 1 : 0);
