// Harita denetimi (Node, tarayıcı gerekmez): node scripts/probes/mapcheck.mjs [harita-id=kasaba]
//  1) her doğuş noktası → her hedef: A* ulaşılabilirlik (NavGrid)
//  2) ada/flood: doğuştan ulaşılamayan serbest hücre kümeleri (≥ 1.5 m²) — kapalı oda/ada
//  3) doğuş noktaları: canStand + nav serbest + baseZones içinde
//  4) görüş hattı: mavi↔kırmızı doğuş çiftleri (göz hizası), doğuştan 360° tarama (en uzun açık hat), ana cadde ekseni ilk 35 m
//  5) çarpışma kutusu sayısı, uzun görüş koridorları istatistiği
import * as THREE from 'three';
import { MAPS } from '../../src/maps/index.js';
import { World } from '../../src/game/collision.js';
import { NavGrid } from '../../src/game/nav.js';

const id = process.argv[2] || 'kasaba';
const map = MAPS[id].build();
const world = new World(map.colliders, map.bounds, map.terrain || null);
const nav = new NavGrid(map.colliders, map.bounds, map.terrain || null);
// ışın uzunluğunu harita sınırına kırp (sınır dışı boşluk "uzun hat" sayılmasın)
const toBounds = (o, d) => {
  const b = map.bounds; let t = 1e9;
  if (d.x > 1e-6) t = Math.min(t, (b.maxX - o.x) / d.x); else if (d.x < -1e-6) t = Math.min(t, (b.minX - o.x) / d.x);
  if (d.z > 1e-6) t = Math.min(t, (b.maxZ - o.z) / d.z); else if (d.z < -1e-6) t = Math.min(t, (b.minZ - o.z) / d.z);
  return Math.max(0, t);
};
const gh = (x, z) => (map.terrain ? map.terrain.heightAt(x, z) : 0);
let fail = 0;
const bad = (m) => { fail++; console.log('HATA  ' + m); };
const ok = (m) => console.log('OK    ' + m);

console.log(`${map.name}: çarpışma kutusu ${map.colliders.length}, sınır ${JSON.stringify(map.bounds)}`);

// 1) ulaşılabilirlik
const plen = (p, sx, sz) => { if (!p) return null; let d = 0, x = sx, z = sz; for (const w of p) { d += Math.hypot(w.x - x, w.z - z); x = w.x; z = w.z; } return Math.round(d); };
let reachBad = 0;
const rows = [];
for (const o of map.objectives) {
  const r = {};
  for (const team of ['blue', 'red']) {
    const lens = map.spawns[team].map((s) => plen(nav.findPath(s.x, s.z, o.x, o.z), s.x, s.z));
    if (lens.some((l) => l === null)) reachBad++;
    r[team] = `${Math.min(...lens.filter((l) => l !== null))}–${Math.max(...lens.filter((l) => l !== null))}m` + (lens.some((l) => l === null) ? ` (${lens.filter((l) => l === null).length} ULAŞILAMAZ)` : '');
  }
  rows.push(`  ${o.name.padEnd(10)} mavi ${r.blue.padEnd(18)} kırmızı ${r.red}`);
}
console.log(rows.join('\n'));
reachBad ? bad('hedef ulaşılabilirlik: bazı doğuş noktalarından ulaşılamıyor') : ok('5/5 hedef tüm doğuş noktalarından ulaşılabilir');

// 2) flood / ada
{
  const sp = map.spawns.blue[0];
  const start = nav.nearestFree(sp.x, sp.z);
  const W = nav.w, Hh = nav.h;
  const seen = new Uint8Array(W * Hh);
  const q = [start]; seen[start] = 1;
  while (q.length) {
    const c = q.pop(); const cx = c % W, cz = (c / W) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= Hh) continue;
      const i = z * W + x; if (seen[i] || nav.blocked[i]) continue; seen[i] = 1; q.push(i);
    }
  }
  // ulaşılamayan serbest hücre kümeleri
  const comp = new Uint8Array(W * Hh);
  const islands = [];
  for (let i = 0; i < W * Hh; i++) {
    if (nav.blocked[i] || seen[i] || comp[i]) continue;
    const st = [i]; comp[i] = 1; let n = 0, sx = 0, sz = 0;
    while (st.length) {
      const c = st.pop(); n++; sx += nav.cx(c); sz += nav.cz(c);
      const cx = c % W, cz = (c / W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= Hh) continue;
        const j = z * W + x; if (nav.blocked[j] || seen[j] || comp[j]) continue; comp[j] = 1; st.push(j);
      }
    }
    if (n * 0.25 >= 1.5) islands.push({ area: +(n * 0.25).toFixed(1), x: +(sx / n).toFixed(1), z: +(sz / n).toFixed(1) });
  }
  const objAda = map.objectives.filter((o) => !seen[nav.nearestFree(o.x, o.z)]);
  if (objAda.length) bad('hedef adada: ' + objAda.map((o) => o.name).join(','));
  islands.length ? bad(`ulaşılamayan serbest bölge (≥2 m²) ${islands.length} adet: ` + islands.slice(0, 12).map((s) => `(${s.x},${s.z}) ${s.area}m²`).join(' ')) : ok('ada yok (≥1.5 m² ulaşılamayan serbest bölge yok)');
}

// 3) doğuş noktaları
{
  const R = 0.32;
  for (const team of ['blue', 'red']) {
    const zone = map.baseZones && map.baseZones[team];
    let nb = 0;
    for (const s of map.spawns[team]) {
      const p = new THREE.Vector3(s.x, gh(s.x, s.z), s.z);
      const st = { pos: p, vel: new THREE.Vector3(), height: 1.78, onGround: true };
      if (!world.canStand(st)) { nb++; bad(`${team} doğuş (${s.x},${s.z}) sığmıyor`); }
      else if (!nav.isFree(s.x, s.z)) { nb++; bad(`${team} doğuş (${s.x},${s.z}) nav'da engelli`); }
      else if (zone && !(s.x >= zone.minX && s.x <= zone.maxX && s.z >= zone.minZ && s.z <= zone.maxZ)) { nb++; bad(`${team} doğuş baseZone dışında`); }
    }
    if (!nb) ok(`${team}: ${map.spawns[team].length} doğuş noktası geçerli` + (zone ? ' (baseZones içinde)' : ''));
  }
}

// 4) görüş hatları
{
  const eye = 1.62;
  const P = (s) => new THREE.Vector3(s.x, gh(s.x, s.z) + eye, s.z);
  let seenPairs = 0, pairs = 0;
  for (const a of map.spawns.blue) for (const c of map.spawns.red) { pairs++; if (world.clear(P(a), P(c))) seenPairs++; }
  seenPairs ? bad(`mavi↔kırmızı doğuş çiftlerinden ${seenPairs}/${pairs} birbirini görüyor`) : ok(`mavi↔kırmızı ${pairs} doğuş çiftinin hiçbirinde görüş hattı yok`);
  const dir = new THREE.Vector3();
  const sweep = (spawns, name, axisSign) => {
    let worst = 0, worstAxis = 0, w = null, wa = null;
    for (const s of spawns) {
      for (let a = 0; a < 360; a += 4) {
        const r = (a * Math.PI) / 180; dir.set(Math.sin(r), 0, -Math.cos(r));
        const h = world.raycast(P(s), dir, 400, {});
        const d = Math.min(h ? h.t : 400, toBounds(P(s), dir));
        if (d > worst) { worst = d; w = { x: s.x, z: s.z, a }; }
      }
      for (let a = -25; a <= 25; a += 5) {
        const r = (a * Math.PI) / 180; dir.set(axisSign * Math.cos(r), 0, Math.sin(r));
        const h = world.raycast(P(s), dir, 400, {});
        const d = Math.min(h ? h.t : 400, toBounds(P(s), dir));
        if (d > worstAxis) { worstAxis = d; wa = { x: s.x, z: s.z, a }; }
      }
    }
    return { worst, worstAxis, w, wa };
  };
  for (const [team, sg] of [['blue', 1], ['red', -1]]) {
    const r = sweep(map.spawns[team], team, sg);
    console.log(`  ${team}: doğuştan en uzun açık hat ${r.worst.toFixed(1)} m (${r.w ? `(${r.w.x},${r.w.z}) ${r.w.a}°` : ''}); ana cadde yönünde (±25°) ilk engel ≤ ${r.worstAxis.toFixed(1)} m` + (r.wa ? ` [en uzun: (${r.wa.x},${r.wa.z}) ${r.wa.a}°]` : ''));
    if (r.worstAxis > 35) bad(`${team} ana cadde yönünde ${r.worstAxis.toFixed(0)} m açık hat (>35 m)`);
    else ok(`${team}: ana cadde ekseninde ilk 35 m içinde görüş kesiliyor`);
  }
}

// 5) uzun koridor istatistiği (nav serbest hücrelerden 16 yön, göz hizası)
{
  const eye = 1.62, o = new THREE.Vector3(), dir = new THREE.Vector3();
  let rays = 0, long = 0, longer = 0;
  const worst = [];
  for (let z = map.bounds.minZ + 2; z < map.bounds.maxZ - 2; z += 3) for (let x = map.bounds.minX + 2; x < map.bounds.maxX - 2; x += 3) {
    if (!nav.isFree(x, z)) continue;
    o.set(x, gh(x, z) + eye, z);
    for (let a = 0; a < 16; a++) {
      const r = (a / 16) * Math.PI * 2; dir.set(Math.sin(r), 0, -Math.cos(r));
      const h = world.raycast(o, dir, 200, {});
      const d = Math.min(h ? h.t : 200, toBounds(o, dir));
      rays++; if (d > 40) long++; if (d > 70) { longer++; worst.push({ x, z, a: Math.round((a / 16) * 360), d }); }
    }
  }
  if (process.argv.includes('--map')) {
    // uzun (>40 m) ışın yoğunluğu haritası: her 6×6 m için 16 yönün kaçı >40 m
    const rows = [];
    for (let z = map.bounds.minZ + 3; z < map.bounds.maxZ; z += 6) {
      let r = '';
      for (let x = map.bounds.minX + 3; x < map.bounds.maxX; x += 6) {
        if (!nav.isFree(x, z)) { r += '#'; continue; }
        o.set(x, gh(x, z) + eye, z); let c = 0;
        for (let a = 0; a < 16; a++) { const rr = (a / 16) * Math.PI * 2; dir.set(Math.sin(rr), 0, -Math.cos(rr)); const h = world.raycast(o, dir, 200, {}); const d = Math.min(h ? h.t : 200, toBounds(o, dir)); if (d > 40) c++; }
        r += c === 0 ? '.' : c < 3 ? '1' : c < 5 ? '2' : c < 8 ? '3' : '4';
      }
      rows.push(r);
    }
    console.log(rows.join('\n'));
  }
  console.log(`  görüş: ${rays} ışın, >40 m: %${(100 * long / rays).toFixed(1)}, >70 m: %${(100 * longer / rays).toFixed(1)}`);
  worst.sort((p, q) => q.d - p.d);
  // satır/sütun bazında özetle (aynı koridoru tekrar etme)
  const seenLine = new Set(); let shown = 0;
  for (const w of worst) {
    const horiz = (w.a % 180) === 90;
    const key = (horiz ? 'z' + Math.round(w.z / 4) : (w.a % 180) === 0 ? 'x' + Math.round(w.x / 4) : 'd' + Math.round(w.x / 8) + ',' + Math.round(w.z / 8) + w.a);
    if (seenLine.has(key)) continue; seenLine.add(key);
    console.log(`    uzun hat (${w.x},${w.z}) ${w.a}° → ${w.d.toFixed(0)} m`);
    if (++shown >= 10) break;
  }
}

console.log(fail ? `\n${fail} HATA` : '\nTümü OK');
process.exit(fail ? 1 : 0);
