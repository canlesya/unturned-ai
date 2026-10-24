// Vagon haritası tasarım ölçümü (Maden Ocağı):  node scripts/plmap.mjs [çıktı.json]
// Her aşama için: doğuşlardan vagona / sıradaki kontrol noktasına / karşı doğuşa yürüme yolu (m + sn), iki takımın aynı anda varabildiği "cephe hattı"nın
// raya uzaklığı, en erken karşılaşma noktası, ray boyunca siper (açıklık) ve maruziyet, uzun görüş hatları (> 35 m), rayın 15 m dışında kalan ölü alan.
// Çıktı JSON'u scripts/plmap_plot.py kuşbakışı çizer.
import * as THREE from 'three';
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { NavGrid } from '../src/game/nav.js';
import { World } from '../src/game/collision.js';
import { makeTrack } from '../src/game/track.js';
import { TUNE } from '../src/game/balance.js';
import { WALK_SPEED } from '../src/sim/input.js';

const OUT = process.argv[2] || '/tmp/wb-maden/plmap.json';
const { buildMaden } = await import(process.env.MADEN || '../src/maps/maden.js');     // MADEN=…/eski-maden.js: önce / sonra karşılaştırma
const m = buildMaden(), B = m.bounds, P = m.payload;
const world = new World(m.colliders, m.bounds), nav = new NavGrid(m.colliders, m.bounds, null, !!m.layered);
const tr = makeTrack(P.track, P.radius), cps = P.checkpoints.map((i) => tr.corners[i]), end = tr.len - 0.01, start = P.start || 0;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RUN = WALK_SPEED * 1.5;
const f1 = (v) => +v.toFixed(1);

// çok kaynaklı Dijkstra (yürüme mesafesi, m) — findPath ile aynı komşuluk kuralları
function field(points) {
  const N = nav.w * nav.h, D = new Float64Array(N).fill(Infinity), W = nav.w;
  const heap = [];
  const push = (i, d) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let s = k; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s; } } return top; };
  for (const p of points) { const i = nav.nearestFree(p.x, p.z, 3); if (i >= 0 && D[i] > 0) { D[i] = 0; push(i, 0); } }
  while (heap.length) {
    const [d, cur] = pop();
    if (d > D[cur]) continue;
    const cx = cur % W, cz = Math.floor(cur / W);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= nav.h) continue;
      const ni = nz * W + nx;
      if (nav.blocked[ni]) continue;
      if (nav.floor && Math.abs(nav.floor[ni] - nav.floor[cur]) > 0.7) continue;
      if (dx && dz && (nav.blocked[cz * W + nx] || nav.blocked[nz * W + cx])) continue;
      const nd = d + (dx && dz ? 1.4142 : 1) * 0.5;
      if (nd < D[ni]) { D[ni] = nd; push(ni, nd); }
    }
  }
  return D;
}
const at = (D, x, z) => { const i = nav.nearestFree(x, z, 3); return i < 0 ? Infinity : D[i]; };
const segDist = (x, z, d0, d1) => { let best = 1e9; const q = {}; for (let d = d0; d <= d1 + 1e-6; d += 0.5) { tr.at(d, q); best = Math.min(best, Math.hypot(x - q.x, z - q.z)); } return best; };
const reach = nav.reachable(P.stages[0].blue[0].x, P.stages[0].blue[0].z);
const cells = [];
for (let i = 0; i < reach.length; i++) if (reach[i]) cells.push(i);

const out = { bounds: B, track: P.track, cps: cps.map((d) => { const q = tr.at(d); return [q.x, q.z]; }), len: f1(tr.len), stages: [], lanes: [], cover: [], dead: 0, colliders: m.colliders.filter((c) => c.max[1] > 0.9).map((c) => [c.min[0], c.min[2], c.max[0], c.max[2], c.max[1]]) };
console.log(`ray ${tr.len.toFixed(1)} m · başlangıç d=${start} · kontrol ${cps.map((c) => c.toFixed(1)).join(' / ')} · uç ${end.toFixed(1)}`);
const segs = [start, ...cps, end];
for (let i = 0; i < segs.length - 1; i++) console.log(`  bölüm ${i + 1}: ${(segs[i + 1] - segs[i]).toFixed(1)} m → 1 kişi ${Math.round((segs[i + 1] - segs[i]) / TUNE.plSpeed)} sn, 3 kişi ${Math.round((segs[i + 1] - segs[i]) / (TUNE.plSpeed * (1 + 2 * TUNE.plCrowd)))} sn`);

P.stages.forEach((S, si) => {
  const d0 = segs[si], d1 = segs[si + 1], q0 = tr.at(d0), q1 = tr.at(d1), qm = tr.at((d0 + d1) / 2);
  const DB = field(S.blue), DR = field(S.red);
  const row = (name, x, z) => { const b = at(DB, x, z), r = at(DR, x, z); return `${name}: mavi ${b.toFixed(0)} m (${(b / RUN).toFixed(1)} sn koşu) · kırmızı ${r.toFixed(0)} m (${(r / RUN).toFixed(1)} sn)`; };
  console.log(`\n── aşama ${si + 1} (vagon d ${d0.toFixed(0)} → ${d1.toFixed(0)}) ──`);
  console.log('  ' + row('vagon (aşama başı)', q0.x, q0.z));
  console.log('  ' + row('bölüm ortası', qm.x, qm.z));
  console.log('  ' + row('sıradaki hedef', q1.x, q1.z));
  const bR = Math.min(...S.red.map((p) => at(DB, p.x, p.z)));
  console.log(`  doğuştan doğuşa (mavi → kırmızı avlu) ${bR.toFixed(0)} m (${(bR / RUN).toFixed(1)} sn koşu)`);
  // cephe hattı: iki takımın ±3 m eşit vardığı hücreler; raya (aktif bölüm) uzaklığı
  // yalnız hedefe giden makul yollar: hücre, takımın doğuşundan aktif ray bölümüne en kısa yoldan ≤ 12 m uzun bir rotanın üstündeyse (koridor)
  const segPts = []; for (let d = d0; d <= d1; d += 1) { const q = tr.at(d); segPts.push({ x: q.x - q.dz * 1.6, z: q.z + q.dx * 1.6 }, { x: q.x + q.dz * 1.6, z: q.z - q.dx * 1.6 }); }
  const DS = field(segPts);
  let minB = Infinity, minR = Infinity;
  for (const p of segPts) { minB = Math.min(minB, at(DB, p.x, p.z)); minR = Math.min(minR, at(DR, p.x, p.z)); }
  const front = [], fd = [], fdAll = [];
  let meet = null;
  for (const i of cells) {
    const b = DB[i], r = DR[i];
    if (!Number.isFinite(b) || !Number.isFinite(r)) continue;
    const x = nav.cx(i), z = nav.cz(i);
    if (Math.abs(b - r) <= 3) fdAll.push(segDist(x, z, d0, d1));
    if (!(b + DS[i] <= minB + 12 || r + DS[i] <= minR + 12)) continue;
    if (Math.abs(b - r) <= 3) { const sd = segDist(x, z, d0, d1); front.push([f1(x), f1(z), f1(sd)]); fd.push(sd); }
    const mm = Math.max(b, r);
    if (!meet || mm < meet.t) meet = { t: mm, x, z };
  }
  fd.sort((a, b) => a - b); fdAll.sort((a, b) => a - b);
  console.log(`  açık cephe (tüm haritada eşit varış ±3 m) ${fdAll.length} hücre: aktif raya ortanca ${fdAll[fdAll.length >> 1]?.toFixed(1)} m · > 20 m %${Math.round(fdAll.filter((v) => v > 20).length / Math.max(1, fdAll.length) * 100)}`);
  const pct = (lim) => Math.round(fd.filter((v) => v <= lim).length / Math.max(1, fd.length) * 100);
  const md = Math.hypot(meet.x - q0.x, meet.z - q0.z);
  // vagona varış farkı: savunanın vagonun ilerisine (8 m) gelmesi vs saldıranın vagona
  console.log(`  cephe hattı (hedefe giden rotalarda eşit varış ±3 m) ${front.length} hücre: raya ortanca ${fd[fd.length >> 1]?.toFixed(1)} m · ≤ 8 m %${pct(8)} · ≤ 15 m %${pct(15)} · > 20 m %${100 - pct(20)}`);
  console.log(`  en erken karşılaşma (${f1(meet.x)}, ${f1(meet.z)}) ${(meet.t / RUN).toFixed(1)} sn'de · vagona ${md.toFixed(0)} m · rayın aktif bölümüne ${segDist(meet.x, meet.z, d0, d1).toFixed(0)} m`);
  // ilk temas: iki takım doğuş merkezinden vagona koşarken (aynı hız) birbirini 30 m içinde ilk gördüğü an / yer
  const cen = (L) => { const c = L.reduce((a, p) => ({ x: a.x + p.x / L.length, z: a.z + p.z / L.length }), { x: 0, z: 0 }); const i = nav.nearestFree(c.x, c.z, 4); return { x: nav.cx(i), z: nav.cz(i) }; };
  const walkPath = (from) => { const g = nav.nearestFree(q0.x - q0.dz * 1.6, q0.z + q0.dx * 1.6, 3); const p = nav.findPath(from.x, from.z, nav.cx(g), nav.cz(g)) || []; return [new THREE.Vector3(from.x, 0, from.z), ...p]; };
  const posAt = (path, s) => { for (let k = 1; k < path.length; k++) { const L = path[k].distanceTo(path[k - 1]); if (s <= L) return path[k - 1].clone().lerp(path[k], s / L); s -= L; } return path[path.length - 1].clone(); };
  const pB = walkPath(cen(S.blue)), pR = walkPath(cen(S.red));
  let contact = null;
  for (let s = 0; s < 120; s += 0.5) {
    const a = posAt(pB, s), r = posAt(pR, s), dd = a.distanceTo(r);
    if (dd < 30 && world.clear(V(a.x, 1.6, a.z), V(r.x, 1.6, r.z))) { contact = { s, a, r, dd }; break; }
  }
  if (contact) {
    const mid = { x: (contact.a.x + contact.r.x) / 2, z: (contact.a.z + contact.r.z) / 2 };
    contact.cart = Math.hypot(mid.x - q0.x, mid.z - q0.z); contact.seg = segDist(mid.x, mid.z, d0, d1);
    contact.blueCart = Math.hypot(contact.a.x - q0.x, contact.a.z - q0.z); contact.redCart = Math.hypot(contact.r.x - q0.x, contact.r.z - q0.z); contact.redSeg = segDist(contact.r.x, contact.r.z, d0, d1);
    console.log(`  ilk temas (ikisi de vagona koşarken): ${(contact.s / RUN).toFixed(1)} sn · mavi (${f1(contact.a.x)}, ${f1(contact.a.z)}) vagona ${contact.blueCart.toFixed(0)} m · kırmızı (${f1(contact.r.x)}, ${f1(contact.r.z)}) vagona ${contact.redCart.toFixed(0)} m, aktif raya ${contact.redSeg.toFixed(0)} m · aradaki ${contact.dd.toFixed(0)} m`);
  } else console.log('  ilk temas: vagona varana dek yok');
  out.stages.push({ contact: contact && { a: [f1(contact.a.x), f1(contact.a.z)], r: [f1(contact.r.x), f1(contact.r.z)], redCart: f1(contact.redCart), redSeg: f1(contact.redSeg), blueCart: f1(contact.blueCart) }, pathB: pB.map((v) => [f1(v.x), f1(v.z)]), pathR: pR.map((v) => [f1(v.x), f1(v.z)]), blue: S.blue.map((p) => [p.x, p.z]), red: S.red.map((p) => [p.x, p.z]), zones: S.zones, d0, d1, front, meet: [meet.x, meet.z], cart: [q0.x, q0.z],
    toCart: [at(DB, q0.x, q0.z), at(DR, q0.x, q0.z)].map(f1), toNext: [at(DB, q1.x, q1.z), at(DR, q1.x, q1.z)].map(f1), frontAll: f1(fdAll[fdAll.length >> 1] || 0), spawnToSpawn: f1(bR), frontMedian: f1(fd[fd.length >> 1] || 0), frontNear8: pct(8), frontFar20: 100 - pct(20) });
});

// ── ray boyunca siper: her 4 m'de 1,2 m yükseklikte 32 yatay ışın; 10 m içinde engel olmayan oran (açıklık) + 40 m içinde göz hizasından gören hücre sayısı (maruziyet)
console.log('\n── ray boyunca siper (her 8 m) ──');
const lattice = (st) => { const o = []; for (let z = B.minZ + st / 2; z < B.maxZ; z += st) for (let x = B.minX + st / 2; x < B.maxX; x += st) { const i = nav.idx(x, z); if (reach[i]) o.push(i); } return o; };
const grid3 = lattice(2);
let line = '';
for (let d = start; d <= end; d += 4) {
  const q = tr.at(d), o = V(q.x, 1.2, q.z);
  let open = 0;
  for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, dir = V(Math.cos(a), 0, Math.sin(a)); const h = world.raycast(o, dir, 10, {}); if (!h || (h.collider && h.collider.max[1] < 1.0)) open++; }
  let exp = 0;
  const e = V(q.x, 1.0, q.z);
  for (const i of grid3) { const x = nav.cx(i), z = nav.cz(i), dd = Math.hypot(x - q.x, z - q.z); if (dd < 40 && dd > 3 && world.clear(e, V(x, 1.6, z))) exp++; }
  out.cover.push({ d: f1(d), x: f1(q.x), z: f1(q.z), open: Math.round(open / 32 * 100), exp });
  line += `d${Math.round(d)}(${Math.round(q.x)},${Math.round(q.z)}) açık %${Math.round(open / 32 * 100)} maruz ${exp} · `;
  if (out.cover.length % 4 === 0) { console.log('  ' + line); line = ''; }
}
if (line) console.log('  ' + line);
const covAvg = out.cover.reduce((a, c) => a + c.open, 0) / out.cover.length, expAvg = out.cover.reduce((a, c) => a + c.exp, 0) / out.cover.length;
console.log(`  ortalama açıklık %${covAvg.toFixed(0)} · ortalama maruziyet ${expAvg.toFixed(0)} nokta (2 m ızgara, 40 m)`);
out.coverAvg = f1(covAvg); out.expAvg = f1(expAvg);

// ── uzun görüş hatları (> 35 m, göz hizası 1,6 m, 3 m ızgara) ──
const g3 = lattice(3);
let lanes = 0, longest = [];
for (let a = 0; a < g3.length; a++) for (let b = a + 1; b < g3.length; b++) {
  const ax = nav.cx(g3[a]), az = nav.cz(g3[a]), bx = nav.cx(g3[b]), bz = nav.cz(g3[b]), L = Math.hypot(ax - bx, az - bz);
  if (L < 35) continue;
  if (!world.clear(V(ax, 1.6, az), V(bx, 1.6, bz))) continue;
  lanes++; longest.push([L, ax, az, bx, bz]);
}
longest.sort((a, b) => b[0] - a[0]);
out.lanes = longest.slice(0, 400).map((l) => l.map(f1));
console.log(`\n── uzun görüş hatları (> 35 m): ${lanes} çift (3 m ızgara, ${g3.length} nokta) · en uzun ${longest.slice(0, 5).map((l) => `${l[0].toFixed(0)} m (${l[1].toFixed(0)},${l[2].toFixed(0)})↔(${l[3].toFixed(0)},${l[4].toFixed(0)})`).join(' · ')}`);
out.laneCount = lanes;
// doğuş avlusu çıkışından karşı takımın vagona gidiş yoluna uzun hat: her aşamada mavi avlu noktalarından görülen, kırmızı avluya 12 m içindeki hücre
P.stages.forEach((S, si) => {
  let n = 0;
  const zr = S.zones.red, zb = S.zones.blue;
  const near = (Z, x, z, r) => x > Z.minX - r && x < Z.maxX + r && z > Z.minZ - r && z < Z.maxZ + r;
  const bs = S.blue.filter((_, k) => k % 3 === 0), rs = S.red.filter((_, k) => k % 3 === 0);
  const rc = g3.filter((i) => near(zr, nav.cx(i), nav.cz(i), 10) && !near(zr, nav.cx(i), nav.cz(i), 0)), bc = g3.filter((i) => near(zb, nav.cx(i), nav.cz(i), 10) && !near(zb, nav.cx(i), nav.cz(i), 0));
  for (const p of bs) for (const i of rc) if (world.clear(V(p.x, 1.6, p.z), V(nav.cx(i), 1.6, nav.cz(i)))) n++;
  for (const p of rs) for (const i of bc) if (world.clear(V(p.x, 1.6, p.z), V(nav.cx(i), 1.6, nav.cz(i)))) n++;
  console.log(`  aşama ${si + 1}: doğuş noktasından karşı avlunun 10 m önüne görüş ${n} çift`);
  out.stages[si].spawnPeek = n;
});

// ── ölü alan: rayın 15 m'den uzak, erişilebilir alan ──
let dead = 0, far = [];
for (const i of cells) { const x = nav.cx(i), z = nav.cz(i), sd = tr.nearest(x, z).dist; if (sd > 15) { dead++; far.push([f1(x), f1(z)]); } }
const inZone = (x, z) => P.stages.some((S) => ['blue', 'red'].some((t) => { const Z = S.zones[t]; return x >= Z.minX && x <= Z.maxX && z >= Z.minZ && z <= Z.maxZ; }));
const deadNoSpawn = far.filter(([x, z]) => !inZone(x, z)).length;
console.log(`\n── ölü alan: erişilebilir ${cells.length * 0.25} m² · raydan > 15 m ${dead * 0.25} m² (%${Math.round(dead / cells.length * 100)}) · avlular hariç ${deadNoSpawn * 0.25} m² (%${Math.round(deadNoSpawn / cells.length * 100)})`);
out.dead = Math.round(dead / cells.length * 100); out.deadNoSpawn = Math.round(deadNoSpawn / cells.length * 100); out.far = far.filter((_, k) => k % 4 === 0);
out.walk = cells.filter((_, k) => k % 2 === 0).map((i) => [f1(nav.cx(i)), f1(nav.cz(i))]);
fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('json → ' + OUT);
