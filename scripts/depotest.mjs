// Depo haritası başsız denetimi: kurulum, çarpışma, doğuş (zemin / geometri / düşman doğuşundan görünürlük), hedeflere ulaşım, sızıntı,
// 5v5 ele geçirme + TDM + DM + GG bot maçları (öldürme, takılma, geçersiz konum), görüş mesafesi dağılımı.   node scripts/depotest.mjs [saniye=240]
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildDepo, DEPO_BOUNDS as B } from '../src/maps/depo.js';
import { NavGrid } from '../src/game/nav.js';
import { World } from '../src/game/collision.js';
import { Game } from '../src/game/game.js';

const SECS = +(process.argv[2] || 240);
let fail = 0;
const ok = (c, msg) => { console.log((c ? 'OK    ' : 'HATA  ') + msg); if (!c) fail++; };
const m = buildDepo();
const world = new World(m.colliders, m.bounds), nav = new NavGrid(m.colliders, m.bounds, null, true);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ── kurulum / çarpışma ──
const badBox = m.colliders.filter((c) => !(c.max[0] > c.min[0] && c.max[1] > c.min[1] && c.max[2] > c.min[2]));
const outBox = m.colliders.filter((c) => c.min[0] < B.minX - 0.7 || c.max[0] > B.maxX + 0.7 || c.min[2] < B.minZ - 0.7 || c.max[2] > B.maxZ + 0.7);
ok(badBox.length === 0 && outBox.length === 0, `çarpışma kutusu ${m.colliders.length} (bozuk ${badBox.length}, duvar dışı ${outBox.length})`);

// ── doğuşlar ──
const hitAt = (x, y, z, h = 1.78) => world._hits(world.query(x - 1, z - 1, x + 1, z + 1, []), x, y, z, h);
for (const t of ['blue', 'red']) {
  const S = m.spawns[t], bad = S.filter((p) => hitAt(p.x, 0.01, p.z) || !nav.isFree(p.x, p.z) || nav.floorAt(p.x, p.z) !== 0);
  ok(S.length >= 24 && bad.length === 0, `${t} doğuş ${S.length} nokta, zeminde ve geometri dışında (sorunlu ${bad.length})`);
}
let seen = 0;
for (const a of m.spawns.blue) for (const r of m.spawns.red) if (world.clear(V(a.x, 1.6, a.z), V(r.x, 1.6, r.z)) || world.clear(V(a.x, 1.0, a.z), V(r.x, 1.6, r.z))) seen++;
ok(seen === 0, `mavi ↔ kırmızı doğuş noktaları birbirini görmüyor (görünen çift ${seen})`);
// düşman doğuş AVLUSUNDAKİ her yürünebilir hücreden (göz 1,6) kendi doğuş noktalarına görüş
const reachB = nav.reachable(m.spawns.blue[0].x, m.spawns.blue[0].z);
let baseSeen = 0, cells = 0;
for (let i = 0; i < reachB.length; i += 2) {
  if (!reachB[i]) continue;
  const x = nav.cx(i), z = nav.cz(i);
  if (z > -24.2) continue;                                          // kırmızı üs bölgesi
  cells++;
  for (const p of m.spawns.blue) if (world.clear(V(x, 1.6, z), V(p.x, 1.4, p.z))) { baseSeen++; break; }
}
ok(baseSeen === 0, `kırmızı üs bölgesindeki ${cells} hücreden hiçbir mavi doğuş görünmüyor (${baseSeen})`);
// üs dışındaki (oyun alanı) hücrelerden görülebilen doğuş noktası oranı (bilgi)
let vis = 0;
const fieldCells = []; for (let i = 0; i < reachB.length; i += 3) if (reachB[i] && Math.abs(nav.cz(i)) < 24) fieldCells.push(i);
for (const p of m.spawns.blue) if (fieldCells.some((i) => world.clear(V(nav.cx(i), 1.6, nav.cz(i)), V(p.x, 1.4, p.z)))) vis++;
console.log(`bilgi  oyun alanından görülebilen mavi doğuş noktası: ${vis}/${m.spawns.blue.length}`);

// ── ulaşım / sızıntı ──
const reachR = nav.reachable(m.spawns.red[0].x, m.spawns.red[0].z);
for (const o of m.objectives) {
  const i = nav.nearestFree(o.x, o.z), pb = nav.findPath(m.spawns.blue[0].x, m.spawns.blue[0].z, o.x, o.z), pr = nav.findPath(m.spawns.red[0].x, m.spawns.red[0].z, o.x, o.z);
  const len = (p, s) => { let L = 0, a = s; for (const q of p || []) { L += Math.hypot(q.x - a.x, q.z - a.z); a = q; } return L.toFixed(1); };
  ok(reachB[i] && reachR[i] && pb && pr, `${o.label} (${o.name}) iki doğuştan yürünebilir: mavi ${len(pb, m.spawns.blue[0])} m, kırmızı ${len(pr, m.spawns.red[0])} m`);
}
const mz = nav.nearestFree(10.6, 0);
ok(reachB[mz] && Math.abs(nav.floor[mz] - 3) < 0.01, `asma kat (y 3) merdivenle ulaşılabilir`);
let outside = 0, high = 0, inside = 0;
for (let i = 0; i < reachB.length; i++) {
  if (!reachB[i]) continue;
  const x = nav.cx(i), z = nav.cz(i), f = nav.floor[i];
  if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) outside++;
  if (f > 3.05) high++;                                               // çatı / konteyner üstü: ulaşılmamalı
  if (hitAt(x, f + 0.02, z, 1.3) && !hitAt(x, f + 0.6, z, 0.1)) inside++;
}
ok(outside === 0 && high === 0, `sızıntı yok: sınır dışı ${outside}, 3 m üstü (çatı / konteyner) ${high} erişilebilir hücre`);
ok(reachB.reduce((a, v, i) => a + (v && !reachR[i] ? 1 : 0), 0) === 0, 'iki doğuş aynı yürünebilir bölgede (ada / kapalı oda yok)');
// fizikle: düz koşan sanal oyuncu duvara dayanınca sınır içinde kalır
{ const s = { pos: V(0, 0, 30), vel: V(0, 0, 0), height: 1.78, onGround: true };
  let maxOut = 0;
  for (const [vx, vz] of [[0, 9], [9, 0], [-9, 0], [6, 6], [-6, -6]]) { s.pos.set(-25, 0, 30); for (let k = 0; k < 400; k++) { s.vel.x = vx; s.vel.z = vz; world.move(s, 1 / 30); maxOut = Math.max(maxOut, Math.abs(s.pos.x) - 30, Math.abs(s.pos.z) - 34); } }
  ok(maxOut <= 0, `fizik: duvara koşan oyuncu sınır içinde (taşma ${Math.max(0, maxOut).toFixed(2)} m)`); }

// ── bot maçları ──
const hist = [0, 0, 0, 0, 0], kd = [0, 0, 0, 0, 0], bucket = (d) => (d < 10 ? 0 : d < 20 ? 1 : d < 35 ? 2 : d < 50 ? 3 : 4);
const tA = V(0, 0, 0), tB = V(0, 0, 0);
for (const [type, per] of [['conquest', 5], ['tdm', 5], ['dm', 10], ['gg', 8], ['conquest', 4]]) {
  const g = new Game(null, { headless: true, map: 'depo', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: SECS } });
  let kills = 0, flags = 0, err = null, stuck = 0, inGeo = 0, invalid = 0;
  const kdist = [];
  const oKill = g.onKill.bind(g);
  g.onKill = (k, v, w, hs) => { if (k && k !== v) { const d = Math.hypot(k.pos.x - v.pos.x, k.pos.z - v.pos.z); kdist.push(d); kd[bucket(d)]++; } kills++; return oKill(k, v, w, hs); };
  const owned = new Set(), last = new Map();
  const track = new Map();
  try {
    for (let st = 0; st < SECS * 30 && !g.ended; st++) {
      g.step(1 / 30);
      for (const o of g.mode.objectives) { if (o.owner) owned.add(o.id); if (last.has(o.id) && last.get(o.id) !== o.owner) flags++; last.set(o.id, o.owner); }
      if (st % 15 === 0) {
        for (const a of g.soldiers) {
          if (!a.alive) continue;
          const p = a.pos;
          if (!Number.isFinite(p.x + p.y + p.z) || p.y < -0.5 || p.x < B.minX - 0.01 || p.x > B.maxX + 0.01 || p.z < B.minZ - 0.01 || p.z > B.maxZ + 0.01) invalid++;
          { const c = hitAt(p.x, p.y + 0.05, p.z, Math.max(0.3, a.height - 0.1)); if (c) { inGeo++; if (inGeo < 4) console.log(`  geometri içi: ${a.name} ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} h ${a.height.toFixed(2)} kutu ${c.min.map((v) => v.toFixed(2))} → ${c.max.map((v) => v.toFixed(2))} ${c.tag || ''}`); } }
          for (const e of g.soldiers) if (e.alive && e.team !== a.team && e.id > a.id && g.botSees(a.eye(tA), e.center(tB))) hist[bucket(Math.hypot(p.x - e.pos.x, p.z - e.pos.z))]++;
        }
      }
      if (st % 300 === 0) {                                            // 10 sn'lik pencerede hiç kımıldamayan canlı bot (doğuş korumasındakiler hariç)
        for (const a of g.soldiers) {
          const prev = track.get(a.id);
          if (prev && a.alive && prev.alive && prev.deaths === a.deaths && Math.hypot(a.pos.x - prev.x, a.pos.z - prev.z) < 0.6) stuck++;
          track.set(a.id, { x: a.pos.x, z: a.pos.z, alive: a.alive, deaths: a.deaths });
        }
      }
    }
  } catch (e) { err = e; }
  kdist.sort((p, q) => p - q);
  const med = kdist.length ? kdist[kdist.length >> 1].toFixed(1) : '-';
  ok(!err && kills > 5 && invalid === 0 && inGeo === 0 && (type !== 'conquest' || owned.size >= 1) && stuck < g.soldiers.length,
    `${type} ${per} · ${Math.round(g.time)} sn · öldürme ${kills} (öldürme mesafesi medyan ${med} m) · bayrak değişimi ${flags}${type === 'conquest' ? ' (alınan ' + [...owned].join('') + ')' : ''} · ${g.ended ? 'bitti: ' + (g.winner || '') : 'süre'} · takılma ${stuck} · geometri içi ${inGeo} · geçersiz ${invalid}${err ? ' · ' + err.stack.split('\n').slice(0, 2).join(' ') : ''}`);
}
const sum = hist.reduce((a, b) => a + b, 0), ksum = kd.reduce((a, b) => a + b, 0);
const pct = (a, s) => a.map((v) => ((v / Math.max(1, s)) * 100).toFixed(0) + '%').join(' / ');
console.log(`görüş (birbirini gören düşman çiftleri, ${sum} örnek)  0-10 / 10-20 / 20-35 / 35-50 / 50+ m: ${pct(hist, sum)}`);
console.log(`öldürme mesafesi (${ksum})                          0-10 / 10-20 / 20-35 / 35-50 / 50+ m: ${pct(kd, ksum)}`);
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
