// Kasaba başsız denetimi: çarpışma, doğuş (zemin / geometri / görüş), hedeflere ulaşım, sızıntı, bot maçları (ele geçirme / TDM / DM / GG).
//   node scripts/kasabatest.mjs [saniye=180]
import * as THREE from 'three';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildKasaba, KASABA_BOUNDS as B } from '../src/maps/kasaba.js';
import { NavGrid } from '../src/game/nav.js';
import { World } from '../src/game/collision.js';
import { Game } from '../src/game/game.js';

const SECS = +(process.argv[2] || 180);
let fail = 0;
const ok = (c, msg) => { console.log((c ? 'OK    ' : 'HATA  ') + msg); if (!c) fail++; };
const m = buildKasaba();
const world = new World(m.colliders, m.bounds), nav = new NavGrid(m.colliders, m.bounds, null, !!m.layered);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const badBox = m.colliders.filter((c) => !(c.max[0] > c.min[0] && c.max[1] > c.min[1] && c.max[2] > c.min[2]));
ok(badBox.length === 0, `çarpışma kutusu ${m.colliders.length} (bozuk ${badBox.length})`);
const hitAt = (x, y, z, h = 1.78) => world._hits(world.query(x - 1, z - 1, x + 1, z + 1, []), x, y, z, h);
for (const t of ['blue', 'red']) {
  const S = m.spawns[t], bad = S.filter((p) => hitAt(p.x, 0.01, p.z) || !nav.isFree(p.x, p.z));
  ok(S.length >= 16 && bad.length === 0, `${t} doğuş ${S.length} nokta, zeminde ve geometri dışında (sorunlu ${bad.length})`);
}
let seen = 0;
for (const a of m.spawns.blue) for (const r of m.spawns.red) if (world.clear(V(a.x, 1.6, a.z), V(r.x, 1.6, r.z))) seen++;
ok(seen === 0, `mavi ↔ kırmızı doğuş noktaları birbirini görmüyor (görünen çift ${seen})`);

const reachB = nav.reachable(m.spawns.blue[0].x, m.spawns.blue[0].z), reachR = nav.reachable(m.spawns.red[0].x, m.spawns.red[0].z);
const len = (p, s) => { let L = 0, a = s; for (const q of p || []) { L += Math.hypot(q.x - a.x, q.z - a.z); a = q; } return L.toFixed(1); };
for (const o of m.objectives) {
  const i = nav.nearestFree(o.x, o.z), pb = nav.findPath(m.spawns.blue[0].x, m.spawns.blue[0].z, o.x, o.z), pr = nav.findPath(m.spawns.red[0].x, m.spawns.red[0].z, o.x, o.z);
  ok(reachB[i] && reachR[i] && pb && pr, `${o.name} iki doğuştan yürünebilir: mavi ${len(pb, m.spawns.blue[0])} m, kırmızı ${len(pr, m.spawns.red[0])} m`);
}
let outside = 0, cells = 0;
for (let i = 0; i < reachB.length; i++) { if (!reachB[i]) continue; cells++; const x = nav.cx(i), z = nav.cz(i); if (x < B.minX - 1.05 || x > B.maxX + 1.05 || z < B.minZ - 1.05 || z > B.maxZ + 1.05) outside++; }
ok(outside === 0, `sızıntı yok: ${cells} yürünebilir hücre, sınır çitinin (sınır + 1 m) dışında ${outside}`);
ok(reachB.reduce((a, v, i) => a + (v && !reachR[i] ? 1 : 0), 0) === 0, 'iki doğuş aynı yürünebilir bölgede');
// bina girişleri: her binanın kapı önü (entry) yürünebilir ve iki doğuştan ulaşılır
let ent = 0, entBad = [];
for (const [name, inf] of Object.entries(m.infos || {})) { if (!inf || !inf.entry) continue; ent++; const i = nav.nearestFree(inf.entry.x, inf.entry.z); if (!(reachB[i] && reachR[i])) entBad.push(name); }
ok(entBad.length === 0, `bina girişleri ${ent}, ulaşılamayan ${entBad.length} ${entBad.join(' ')}`);

for (const [type, per] of [['conquest', 10], ['tdm', 10], ['dm', 12], ['gg', 8], ['conquest', 3]]) {
  const g = new Game(null, { headless: true, map: 'kasaba', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: per, type, time: SECS } });
  let kills = 0, flags = 0, err = null, stuck = 0, inGeo = 0, invalid = 0;
  const kdist = [], oKill = g.onKill.bind(g);
  g.onKill = (k, v, w, hs) => { if (k && k !== v) kdist.push(Math.hypot(k.pos.x - v.pos.x, k.pos.z - v.pos.z)); kills++; return oKill(k, v, w, hs); };
  const owned = new Set(), last = new Map(), track = new Map();
  try {
    for (let st = 0; st < SECS * 30 && !g.ended; st++) {
      g.step(1 / 30);
      for (const o of g.mode.objectives || []) { if (o.owner) owned.add(o.id); if (last.has(o.id) && last.get(o.id) !== o.owner) flags++; last.set(o.id, o.owner); }
      if (st % 15 === 0) for (const a of g.soldiers) {
        if (!a.alive) continue;
        const p = a.pos;
        if (!Number.isFinite(p.x + p.y + p.z) || p.y < -0.5 || p.x < B.minX - 0.01 || p.x > B.maxX + 0.01 || p.z < B.minZ - 0.01 || p.z > B.maxZ + 0.01) invalid++;
        const c = hitAt(p.x, p.y + 0.05, p.z, Math.max(0.3, a.height - 0.1));
        if (c) { inGeo++; if (inGeo < 4) console.log(`  geometri içi: ${a.name} ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} kutu ${c.min.map((v) => v.toFixed(2))} → ${c.max.map((v) => v.toFixed(2))} ${c.tag || ''}`); }
      }
      if (st % 300 === 0) for (const a of g.soldiers) {
        const prev = track.get(a.id);
        if (prev && a.alive && prev.alive && prev.deaths === a.deaths && Math.hypot(a.pos.x - prev.x, a.pos.z - prev.z) < 0.6) { stuck++; if (process.env.STUCK) console.log(`  takılma ${a.name} ${a.pos.x.toFixed(1)},${a.pos.y.toFixed(1)},${a.pos.z.toFixed(1)} t ${Math.round(g.time)}`); }
        track.set(a.id, { x: a.pos.x, z: a.pos.z, alive: a.alive, deaths: a.deaths });
      }
    }
  } catch (e) { err = e; }
  kdist.sort((p, q) => p - q);
  const med = kdist.length ? kdist[kdist.length >> 1].toFixed(1) : '-';
  ok(!err && kills > 5 && invalid === 0 && inGeo === 0 && (type !== 'conquest' || owned.size >= 1),
    `${type} ${per} · ${Math.round(g.time)} sn · öldürme ${kills} (medyan ${med} m) · bayrak değişimi ${flags}${type === 'conquest' ? ' (alınan ' + [...owned].join(' ') + ')' : ''} · ${g.ended ? 'bitti: ' + (g.winner || '') : 'süre'} · takılma ${stuck} · geometri içi ${inGeo} · geçersiz ${invalid}${err ? ' · ' + err.stack.split('\n').slice(0, 2).join(' ') : ''}`);
}
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
