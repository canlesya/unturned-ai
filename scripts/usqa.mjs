// Askeri Üs (ve her MapBuilder haritası) genel kalite taraması — tarayıcısız, haritanın KURULMUŞ çıktısına bakar (kit / kimlik düzeninden bağımsız; eski ve yeni harita aynı ölçüyle):
//   node scripts/usqa.mjs [harita=us] [--json çıktı.json] [--nobots] [--botsec 180]
//  A iç içe katı      : iki çarpışma kutusu her eksende ≥ 5 cm iç içe (katı parçalar yalnız yüz yüze değmeli)
//  A2 görsel iç içe   : iki opak görsel kutu (farklı çağrı zinciri) her eksende ≥ 5 cm iç içe
//  B z-fighting       : aynı yöne bakan iki opak yüz ≤ 2,5 cm arayla örtüşüyor (≥ 4 cm²). 24 bit derinlikte (yakın 0,05) 100 m'de çözünürlük ≈ 1,2 cm:
//                       MapBuilder'ın 1,3 cm itmesi uzakta yine titrer; ham sayı (itme öncesi) + itilen yüz sayısı
//  C görünmez çarpışma: çarpışma kutusunun yüzey örneklerinin > %5'i hiçbir opak görselin içinde değil
//  D içinden geçilen  : gövde bandında (0,1–1,7 m) opak, kalın (≥ 8 cm) görsel parçanın çarpışmadan > 0,3 m uzak bölümü
//  E havada           : yere hiçbir değme zinciriyle bağlanmayan görsel öbek (sınır içinde)
//  F sınır / doğuş    : sınır dışına taşan oynanış çarpışması, katı içinde doğuş / hedef merkezi
//  G nav / sızıntı    : Mavi doğuştan ulaşılan hücre, sınır dışı hücre, Kırmızı doğuş + hedeflere yol; zıplama zinciriyle çevre duvarı / sınır dışı
//  H doğuş görüşü     : Mavi ↔ Kırmızı doğuş noktaları arasında göz hizası açık hat; üs bölgesi dışından doğuş noktası gören hücre
//  I bot maçları      : conquest + tdm 8v8 (takılma / dk / bot, öldürme, yeraltı, hata) + takılma yerleri
import * as THREE from 'three';
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
import { MAPS } from '../src/maps/index.js';
import { Game } from '../src/game/game.js';
Error.stackTraceLimit = 40;
MapBuilder.zfix = true;
const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const botsec = args.includes('--botsec') ? +args[args.indexOf('--botsec') + 1] : 180;
const mapId = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--json' && args[i - 1] !== '--botsec') || 'us';
const FILE_RE = new RegExp(`src[\\/]maps[\\/](${mapId}\\.js|assets[\\/][^:]+):(\\d+)`, 'g');

// ── kayıt kancaları: her görsel parça (dünya köşeleri) + çağrı zinciri (harita dosyası satırları) ──
const prims = [], zex = []; let rec = true, B = null, rawZ = null;
const chainOf = () => { const s = new Error().stack; const out = []; for (const m of s.matchAll(FILE_RE)) if (!/us-kit\.js/.test(m[1]) && !/(us-furniture|us-vehicles)\.js$/.test(m[1]) || (/(us-furniture|us-vehicles)\.js$/.test(m[1]) && m[2] !== '7')) out.push(m[1].replace(/^assets[\\/]/, '').replace(/^common[\\/]/, '') + ':' + m[2]); return out.reverse().join('>'); };
const P = MapBuilder.prototype;
const _addGeo = P.addGeo;
P.addGeo = function (geometry, color, local, o) { const r = _addGeo.call(this, geometry, color, local, o); if (rec) prims.push({ g: r.g, key: r.key, color, o: o || {}, chain: chainOf(), oid: r.g.userData.oid }); return r; };
const _aabb = P._aabb;
P._aabb = function (...a) { const n = this.colliders.length; _aabb.apply(this, a); if (rec) this.colliders[n]._chain = chainOf(); };
const _build = P.build;
P.build = function () { if (rec) B = this; return _build.call(this); };
const _rz = P.resolveZFight;
P.resolveZFight = function () { if (rec) rawZ = zScan(); return _rz.call(this); };

// prim dünya AABB'si + eksen hizalı kutu mu (bütün köşeler AABB köşelerinde)
function finishPrim(p) {
  const pos = p.g.attributes.position, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.count; i++) for (let a = 0; a < 3; a++) { const v = pos.getComponent(i, a); if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
  let box = pos.count === 36;
  if (box) for (let i = 0; i < pos.count && box; i++) for (let a = 0; a < 3; a++) { const v = pos.getComponent(i, a); if (Math.abs(v - mn[a]) > 1e-3 && Math.abs(v - mx[a]) > 1e-3) { box = false; break; } }
  p.mn = mn; p.mx = mx; p.box = box;
  p.opaque = !p.o.transparent && !(p.o.opacity < 1);
}
const ov = (a, b, ax) => Math.min(a.mx[ax], b.mx[ax]) - Math.max(a.mn[ax], b.mn[ax]);
const cmn = (c) => c.min, cmx = (c) => c.max;
// x'e göre süpürme: f(i, j) her olası çift için
function sweep(list, lo, hi, pad, f) {
  const ord = list.map((_, i) => i).sort((a, b) => lo(list[a])[0] - lo(list[b])[0]);
  for (let oi = 0; oi < ord.length; oi++) { const A = list[ord[oi]]; const ax = hi(A)[0] + pad;
    for (let oj = oi + 1; oj < ord.length; oj++) { const Bq = list[ord[oj]]; if (lo(Bq)[0] > ax) break; f(A, Bq); } }
}
function zScan() {                                      // ham eş yönlü yakın yüzler (itme ÖNCESİ)
  const L = prims.filter((p) => { finishPrim(p); return p.box && p.opaque; });
  const OT = [[1, 2], [0, 2], [0, 1]]; let n = 0, sameCol = 0; const sites = new Map();
  sweep(L, (p) => p.mn, (p) => p.mx, 0.03, (A, Bq) => {
    if (Bq.mn[1] > A.mx[1] + 0.03 || A.mn[1] > Bq.mx[1] + 0.03 || Bq.mn[2] > A.mx[2] + 0.03 || A.mn[2] > Bq.mx[2] + 0.03) return;
    const flat = (q) => q.mx[1] - q.mn[1] <= 0.045 && q.mn[1] < 0.02 && q.mx[1] < 0.1;            // iki zemin kaplaması üst üste (yer düzlemi) da sayılır, ayrı sınıf yok
    for (let a = 0; a < 3; a++) { const o = OT[a]; const o0 = ov(A, Bq, o[0]), o1 = ov(A, Bq, o[1]); if (o0 < 0.02 || o1 < 0.02 || o0 * o1 < 0.0004) continue;
      for (const sd of [1, -1]) { const fa = sd > 0 ? A.mx[a] : A.mn[a], fb = sd > 0 ? Bq.mx[a] : Bq.mn[a]; if (Math.abs(fa - fb) >= 0.025) continue;
        // yüzlerden biri öbür kutunun içinde gömülü mü (görünmez): A'nın yüzü B'nin içinde ve B'nin yüzü A'nın dışında değilse ikisi de aynı düzlemde görünür
        n++; if (A.color === Bq.color) sameCol++; if (zex.length < 60) zex.push([+((Math.max(A.mn[0], Bq.mn[0]) + Math.min(A.mx[0], Bq.mx[0])) / 2).toFixed(2), +((Math.max(A.mn[1], Bq.mn[1]) + Math.min(A.mx[1], Bq.mx[1])) / 2).toFixed(2), +((Math.max(A.mn[2], Bq.mn[2]) + Math.min(A.mx[2], Bq.mx[2])) / 2).toFixed(2), 'xyz'[a] + (sd > 0 ? '+' : '-'), A.chain.split('>').pop(), Bq.chain.split('>').pop()]);
        const k = [A.chain.split('>').pop(), Bq.chain.split('>').pop()].sort().join(' ~ '); sites.set(k, (sites.get(k) || 0) + 1); } }
  });
  return { n, sameCol, sites: [...sites].sort((a, b) => b[1] - a[1]).slice(0, 12) };
}

// ── kurulum ──
const t0 = performance.now();
const map = MAPS[mapId].build();
const tBuild = performance.now() - t0;
rec = false;
for (const p of prims) if (!p.mn) finishPrim(p);
const cols = map.colliders, bounds = map.bounds;
const pushed = B.zfightReport ? B.zfightReport.length : 0;
const inB = (mn, mx, pad = 0) => mx[0] > bounds.minX - pad && mn[0] < bounds.maxX + pad && mx[2] > bounds.minZ - pad && mn[2] < bounds.maxZ + pad;
const vis = prims.filter((p) => p.opaque && inB(p.mn, p.mx, 1));
let tris = 0; for (const p of prims) tris += p.g.attributes.position.count / 3;
console.log(`=== ${mapId}: görsel parça ${prims.length} (sınır içi opak ${vis.length}), çarpışma ${cols.length}, üçgen ${Math.round(tris / 1000)} bin · kurulum ${tBuild.toFixed(0)} ms`);
const R = {}, ex = {};
const top = (m, k = 6) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);

// A iç içe katı
{
  let n = 0; const sites = new Map(); const gp = cols.filter((c) => inB(c.min, c.max, 2) && c.max[0] - c.min[0] < 300 && c.max[2] - c.min[2] < 300);
  sweep(gp, cmn, cmx, 0, (a, b) => { for (let k = 0; k < 3; k++) if (Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) < 0.05) return; n++;
    const s = [a._chain?.split('>').pop() || '?', b._chain?.split('>').pop() || '?'].sort().join(' ~ '); sites.set(s, (sites.get(s) || 0) + 1);
    if ((ex.A ||= []).length < 60) ex.A.push([+((Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2).toFixed(2), +((Math.max(a.min[1], b.min[1]) + Math.min(a.max[1], b.max[1])) / 2).toFixed(2), +((Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2).toFixed(2), s]); });
  R.A = n; console.log(`A  iç içe katı (çarpışma ∩ ≥ 5 cm)          ${n}   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// A2 görsel iç içe (farklı çağrı zinciri)
{
  let n = 0; const sites = new Map(); const L = vis.filter((p) => p.box);
  sweep(L, (p) => p.mn, (p) => p.mx, 0, (a, b) => { if (a.chain === b.chain) return; for (let k = 0; k < 3; k++) if (ov(a, b, k) < 0.05) return; n++;
    const s = [a.chain.split('>').pop(), b.chain.split('>').pop()].sort().join(' ~ '); sites.set(s, (sites.get(s) || 0) + 1); });
  R.A2 = n; console.log(`A2 görsel iç içe (farklı çağrı, ≥ 5 cm)       ${n}   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// B z-fighting
R.B = rawZ ? rawZ.n : 0; R.Bpushed = pushed;
console.log(`B  z-fighting (eş yönlü yüz ≤ 2,5 cm)        ${R.B} (aynı renk ${rawZ?.sameCol ?? 0}) · MapBuilder itmesi ${pushed}   ${(rawZ?.sites || []).slice(0, 6).map(([k, v]) => k + '×' + v).join(' | ')}`);

// görsel uzaysal karma (C, D, E)
const H = new Map(), HC = 4; const hk = (x, z) => x + ',' + z;
const hashAdd = (map_, item, mn, mx) => { for (let x = Math.floor(mn[0] / HC); x <= Math.floor(mx[0] / HC); x++) for (let z = Math.floor(mn[2] / HC); z <= Math.floor(mx[2] / HC); z++) { const k = hk(x, z); let a = map_.get(k); if (!a) map_.set(k, (a = [])); a.push(item); } };
const visAll = prims.filter((p) => inB(p.mn, p.mx, 1));                  // C: saydam (tel örgü, cam) da görünürdür
for (const p of visAll) if (p.mx[0] - p.mn[0] < 200 && p.mx[2] - p.mn[2] < 200) hashAdd(H, p, p.mn, p.mx);
const big = visAll.filter((p) => !(p.mx[0] - p.mn[0] < 200 && p.mx[2] - p.mn[2] < 200));
const visAt = (x, y, z, tol) => { const gx = Math.floor(x / HC), gz = Math.floor(z / HC), L = [...big]; for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) L.push(...(H.get(hk(ix, iz)) || [])); for (const p of L) if (x >= p.mn[0] - tol && x <= p.mx[0] + tol && y >= p.mn[1] - tol && y <= p.mx[1] + tol && z >= p.mn[2] - tol && z <= p.mx[2] + tol) return true; return false; };
// C görünmez çarpışma
{
  let n = 0; const sites = new Map();
  for (const c of cols) {
    if (!inB(c.min, c.max, 0.5)) continue;
    const d = [0, 1, 2].map((a) => c.max[a] - c.min[a]); if (d[0] > 150 || d[2] > 150) continue;
    const st = d.map((v) => Math.max(1, Math.min(8, Math.ceil(v / 0.3)))); let tot = 0, bad = 0;
    for (let i = 0; i <= st[0]; i++) for (let j = 0; j <= st[1]; j++) for (let k = 0; k <= st[2]; k++) {
      if (i > 0 && i < st[0] && j > 0 && j < st[1] && k > 0 && k < st[2]) continue;                 // yalnız yüzey
      const x = c.min[0] + 0.03 + (d[0] - 0.06) * i / st[0], y = c.min[1] + 0.03 + (d[1] - 0.06) * j / st[1], z = c.min[2] + 0.03 + (d[2] - 0.06) * k / st[2];
      tot++; if (!visAt(x, y, z, 0.04)) bad++;
    }
    if (bad > tot * 0.05) { n++; const s = c._chain?.split('>').pop() || '?'; sites.set(s, (sites.get(s) || 0) + 1); if ((ex.C ||= []).length < 40) ex.C.push([+((c.min[0] + c.max[0]) / 2).toFixed(1), +c.min[1].toFixed(1), +((c.min[2] + c.max[2]) / 2).toFixed(1), Math.round(bad / tot * 100)]); }
  }
  R.C = n; console.log(`C  görünmez çarpışma (> %5 yüzey görselsiz)   ${n}   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// D içinden geçilen opak görsel (gövde bandı)
{
  const CH = new Map(); for (const c of cols) if (c.max[0] - c.min[0] < 200 && c.max[2] - c.min[2] < 200) hashAdd(CH, c, c.min, c.max);
  const near = (x, y, z, r) => { const gx = Math.floor(x / HC), gz = Math.floor(z / HC); for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) for (const c of CH.get(hk(ix, iz)) || []) if (y >= c.min[1] - 0.05 && y <= c.max[1] + 0.05 && x >= c.min[0] - r && x <= c.max[0] + r && z >= c.min[2] - r && z <= c.max[2] + r) return true; return false; };
  let n = 0; const sites = new Map();
  for (const p of vis) {
    if (!inB(p.mn, p.mx, 0)) continue;
    const d = [0, 1, 2].map((a) => p.mx[a] - p.mn[a]); if (Math.min(d[0], d[2]) < 0.08 || d[1] < 0.08) continue;
    if (Math.min(p.mx[1], 1.7) <= Math.max(p.mn[1], 0.1)) continue;
    if (p.o.glow && d[0] * d[1] * d[2] < 0.02) continue;
    let bad = 0;
    const pts = [];
    if (p.box) {                                                    // kutu: 6 yüzün ızgara örnekleri
      const st = d.map((v) => Math.max(1, Math.min(10, Math.ceil(v / 0.25))));
      for (let i = 0; i <= st[0]; i++) for (let j = 0; j <= st[1]; j++) for (let k = 0; k <= st[2]; k++) { if (i > 0 && i < st[0] && j > 0 && j < st[1] && k > 0 && k < st[2]) continue; pts.push([p.mn[0] + d[0] * i / st[0], p.mn[1] + d[1] * j / st[1], p.mn[2] + d[2] * k / st[2]]); }
    } else {                                                        // diğer: köşeler + üçgen ortaları (gerçek yüzey)
      const P = p.g.attributes.position, nT = P.count / 3, step = Math.max(1, Math.floor(nT / 150));
      for (let t = 0; t < nT; t += step) { let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += P.getX(t * 3 + k); y += P.getY(t * 3 + k); z += P.getZ(t * 3 + k); pts.push([P.getX(t * 3 + k), P.getY(t * 3 + k), P.getZ(t * 3 + k)]); } pts.push([x / 3, y / 3, z / 3]); }
    }
    for (const [x, y, z] of pts) { if (y < 0.1 || y > 1.7) continue; if (!near(x, y, z, 0.3)) { bad++; if (process.env.DBGD) console.log('D?', x.toFixed(3), y.toFixed(3), z.toFixed(3), p.color, p.chain); break; } }
    if (bad) { n++; const s = p.chain.split('>').pop(); sites.set(s, (sites.get(s) || 0) + 1); if ((ex.D ||= []).length < 40) ex.D.push([+((p.mn[0] + p.mx[0]) / 2).toFixed(1), +p.mn[1].toFixed(1), +((p.mn[2] + p.mx[2]) / 2).toFixed(1), p.color]); }
  }
  R.D = n; console.log(`D  içinden geçilen opak görsel              ${n}   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// E havada duran öbek (görsel + çarpışma düğümleri, ≤ 2 cm değme)
{
  const nodes = [...vis.map((p) => ({ mn: p.mn, mx: p.mx, p })), ...cols.filter((c) => inB(c.min, c.max, 1)).map((c) => ({ mn: c.min, mx: c.max }))];
  const par = nodes.map((_, i) => i); const f = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  nodes.forEach((q, i) => (q.i = i));
  sweep(nodes, (q) => q.mn, (q) => q.mx, 0.02, (a, b) => { for (let k = 0; k < 3; k++) if (ov(a, b, k) < -0.02) return; const ra = f(a.i), rb = f(b.i); if (ra !== rb) par[ra] = rb; });
  const ground = new Set(); for (const q of nodes) if (q.mn[1] <= 0.03) ground.add(f(q.i));
  const comps = new Map(); for (const q of nodes) { const r = f(q.i); if (ground.has(r)) continue; if (!comps.has(r)) comps.set(r, []); comps.get(r).push(q); }
  const list = [...comps.values()].filter((c) => c.some((q) => q.p));
  R.E = list.length;
  ex.E = list.slice(0, 30).map((c) => { const q = c.find((q) => q.p); return [+((q.mn[0] + q.mx[0]) / 2).toFixed(1), +q.mn[1].toFixed(2), +((q.mn[2] + q.mx[2]) / 2).toFixed(1), c.length, q.p.chain.split('>').pop()]; });
  console.log(`E  havada duran öbek                        ${R.E}   ${ex.E.slice(0, 5).map((e) => e.join(' ')).join(' | ')}`);
}

// F sınır / doğuş / hedef
const g = new Game(null, { headless: true, map: mapId, diff: 'normal', match: { perTeam: 1, type: 'conquest' } });
const W = g.world, nav = g.nav, V = (x, y, z) => new THREE.Vector3(x, y, z);
{
  const out = cols.filter((c) => c.max[1] > 0.3 && (c.min[0] < bounds.minX - 1.5 || c.max[0] > bounds.maxX + 1.5 || c.min[2] < bounds.minZ - 1.5 || c.max[2] > bounds.maxZ + 1.5) && c.max[0] - c.min[0] < 300).length;
  const tmp = []; let sIn = 0;
  for (const t of ['blue', 'red']) for (const s of map.spawns[t]) if (W._hits(W.query(s.x - 1, s.z - 1, s.x + 1, s.z + 1, tmp), s.x, (s.y || 0) + 0.3, s.z, 1.4)) sIn++;
  let oIn = 0; for (const o of map.objectives || []) if (W._hits(W.query(o.x - 1, o.z - 1, o.x + 1, o.z + 1, tmp), o.x, 0.3, o.z, 1.4)) oIn++;
  R.F = out + sIn + oIn; console.log(`F  sınır dışı çarpışma ${out} · katı içinde doğuş ${sIn} · hedef merkezi katı içinde ${oIn}`);
}
// G nav / sızıntı
{
  const sb = map.spawns.blue, sr = map.spawns.red, seen = nav.reachable(sb[0].x, sb[0].z);
  let cells = 0, outside = 0, free = 0;
  for (let i = 0; i < seen.length; i++) { if (!nav.blocked[i]) free++; if (!seen[i]) continue; cells++; const x = nav.cx(i), z = nav.cz(i); if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) outside++; }
  const redOk = !!seen[nav.nearestFree ? nav.nearestFree(sr[0].x, sr[0].z) : nav.idx(sr[0].x, sr[0].z)];
  const plen = (p, a) => { let L = 0; for (const w of p || []) { L += a.distanceTo(w); a = w; } return Math.round(L); };
  const paths = (map.objectives || []).map((o) => { const pb = nav.findPath(sb[0].x, sb[0].z, o.x, o.z), pr = nav.findPath(sr[0].x, sr[0].z, o.x, o.z); return `${o.id} ${pb ? plen(pb, V(sb[0].x, 0, sb[0].z)) : 'YOK'}/${pr ? plen(pr, V(sr[0].x, 0, sr[0].z)) : 'YOK'}`; });
  // zıplama zinciri: çarpışma üst yüzeyleri (üstü 1,8 m boş) — zeminden / ulaşılan yüzeyden ≤ 1,0 m yukarı ve ≤ 0,9 m yatay aralıkla çıkılır
  const tops = cols.filter((c) => Math.min(c.max[0] - c.min[0], c.max[2] - c.min[2]) >= 0.2 && Math.max(c.max[0] - c.min[0], c.max[2] - c.min[2]) >= 0.3 && c.max[1] > 0.45 && c.max[0] - c.min[0] < 300);      // basamak gövdesi 0,23 m
  const clearAbove = (c) => !cols.some((d) => d !== c && d.min[1] < c.max[1] + 1.75 && d.max[1] > c.max[1] + 0.05 && d.min[0] <= c.min[0] + 0.05 && d.max[0] >= c.max[0] - 0.05 && d.min[2] <= c.min[2] + 0.05 && d.max[2] >= c.max[2] - 0.05);
  const T = tops.filter(clearAbove); const reach = new Uint8Array(T.length); const q = [];
  const gap = (a, b) => Math.max(0, Math.max(a.min[0] - b.max[0], b.min[0] - a.max[0])) + Math.max(0, Math.max(a.min[2] - b.max[2], b.min[2] - a.max[2]));
  T.forEach((c, i) => { if (c.max[1] <= 1.45) { const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2; let ok = false; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = dx > 0 ? c.max[0] + 0.6 : dx < 0 ? c.min[0] - 0.6 : cx, z = dz > 0 ? c.max[2] + 0.6 : dz < 0 ? c.min[2] - 0.6 : cz; const k = nav.idx(x, z); if (k >= 0 && k < seen.length && seen[k]) ok = true; } if (ok) { reach[i] = 1; q.push(i); } } });
  // merdiven / basamak (tepesi ≤ 0,5 m komşudan) da aynı kuralla: 1,0 m
  const from = new Int32Array(T.length).fill(-1);
  while (q.length) { const i = q.pop(), a = T[i]; for (let j = 0; j < T.length; j++) { if (reach[j]) continue; const b = T[j], dy = b.max[1] - a.max[1]; const gp = gap(a, b); if (dy > 1.45 || gp > (dy > 0 ? 1.0 : 4.0)) continue; if (dy > 0 && b.min[1] > a.max[1] + 0.05 && gp < 0.3) continue; /* tavan / saçak altından tepeye çıkılmaz */ reach[j] = 1; from[j] = i; q.push(j); } }
  if (process.env.DBGG) { const [gx, gz, gy] = process.env.DBGG.split(',').map(Number); const k = T.findIndex((c, i) => reach[i] && gx >= c.min[0] - 0.1 && gx <= c.max[0] + 0.1 && gz >= c.min[2] - 0.1 && gz <= c.max[2] + 0.1 && Math.abs(c.max[1] - gy) < 0.2);
    for (let i = k; i >= 0; i = from[i]) console.log('G<', T[i].min.map((v) => v.toFixed(2)).join(','), '/', T[i].max.map((v) => v.toFixed(2)).join(','), T[i]._chain); }        // tırmanma: zıplama zirvesi 0,97 + basamak 0,5 ≈ 1,45 m; iniş: koşarak 4 m'ye kadar
  let hiTop = 0, leak = 0; const leakAt = [];
  T.forEach((c, i) => { if (!reach[i]) return; hiTop = Math.max(hiTop, c.max[1]); if (c.max[0] > bounds.maxX + 0.2 || c.min[0] < bounds.minX - 0.2 || c.max[2] > bounds.maxZ + 0.2 || c.min[2] < bounds.minZ - 0.2) { leak++; if (leakAt.length < 8) leakAt.push(`${c.min[0].toFixed(0)},${c.max[1].toFixed(1)},${c.min[2].toFixed(0)}`); } });
  R.G = outside + leak + (redOk ? 0 : 1) + paths.filter((p) => p.includes('YOK')).length;
  console.log(`G  nav: Mavi doğuştan ${cells} hücre (serbest ${free}), sınır dışı ${outside}, Kırmızı doğuşa yol ${redOk ? 'var' : 'YOK'} · zıplamayla ulaşılan en yüksek yüzey ${hiTop.toFixed(1)} m, sınır dışına taşan ${leak} ${leakAt.join(' ')}`);
  console.log(`   hedeflere yol (Mavi / Kırmızı doğuştan, m): ${paths.join(' · ')}`);
  ex.reach = T.filter((_, i) => reach[i]).map((c) => [+c.min[0].toFixed(1), +c.min[2].toFixed(1), +c.max[0].toFixed(1), +c.max[2].toFixed(1), +c.max[1].toFixed(1)]);
  // H doğuş görüşü
  let vs = 0; for (const a of sb) for (const b of sr) if (W.clear(V(a.x, 1.6, a.z), V(b.x, 1.6, b.z))) vs++;
  const zoneIn = (zn, x, z) => zn && x >= zn.minX && x <= zn.maxX && z >= zn.minZ && z <= zn.maxZ;
  const expo = { blue: 0, red: 0 }, at = [];
  for (let i = 0; i < seen.length; i++) { if (!seen[i] || (i % nav.w) % 4 || Math.floor(i / nav.w) % 4) continue; const x = nav.cx(i), z = nav.cz(i);
    for (const [tm, pts] of [['blue', sb], ['red', sr]]) { if (zoneIn(map.baseZones?.[tm], x, z)) continue; for (let k = 0; k < pts.length; k += 2) if (Math.hypot(pts[k].x - x, pts[k].z - z) < 120 && W.clear(V(x, 1.6, z), V(pts[k].x, 1.4, pts[k].z))) { expo[tm]++; if (at.length < 10) at.push(`${tm[0]}:${x.toFixed(0)},${z.toFixed(0)}`); break; } } }
  R.H = vs; R.Hexp = expo.blue + expo.red;
  console.log(`H  doğuş ↔ doğuş açık hat ${vs} çift · üs bölgesi dışından doğuş noktası gören hücre (2 m ızgara) Mavi ${expo.blue} / Kırmızı ${expo.red}  ${at.join(' ')}`);
}
// I bot maçları
if (!args.includes('--nobots')) {
  const stuckAt = new Map();
  for (const type of ['conquest', 'tdm']) {
    const gg = new Game(null, { headless: true, map: mapId, diff: 'normal', match: { perTeam: 8, type, time: 0, tickets: 9999 } });
    const last = new Map(); let stuck = 0, err = 0, flags = 0; gg.on?.('flag', () => flags++);
    const ts = performance.now();
    try {
      for (let i = 0; i < botsec * 30; i++) {
        gg.step(1 / 30);
        if (i % 180 === 0) for (const s of gg.soldiers) { const b = s.brain; if (!s.alive || !b) { last.delete(s); continue; } const p = last.get(s);
          if (p && p.spawnN === s.spawnN && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 0.6 && !(b.target && b.target.alive) && !b.perching && !b.atSpot) { stuck++; const k = `${Math.round(s.pos.x / 3) * 3},${Math.round(s.pos.z / 3) * 3}`; stuckAt.set(k, (stuckAt.get(k) || 0) + 1); }
          last.set(s, { x: s.pos.x, z: s.pos.z, spawnN: s.spawnN }); }
      }
    } catch (e) { err++; console.log(e.stack); }
    const kills = gg.soldiers.reduce((a, s) => a + s.kills, 0), under = gg.soldiers.filter((s) => s.pos.y < -1 || !Number.isFinite(s.pos.x)).length, perMin = stuck / (botsec / 60) / 16;
    R['I_' + type] = +perMin.toFixed(3);
    console.log(`I  ${type} 8v8 ${botsec} sn: öldürme ${kills} · bayrak olayı ${flags} · takılma ${perMin.toFixed(2)} / dk / bot · yeraltı ${under} · hata ${err} · ${(performance.now() - ts).toFixed(0)} ms · hedefler ${gg.mode.objectives.map((o) => o.id + ':' + (o.owner || '-')).join(',')}`);
  }
  ex.stuck = top(stuckAt, 12);
  console.log(`   takılma yerleri: ${ex.stuck.map(([k, v]) => k + '×' + v).join(' ')}`);
}
if (args.includes('--v')) {
  console.log('A:', JSON.stringify(ex.A)); console.log('B:', JSON.stringify(zex)); console.log('C:', JSON.stringify(ex.C)); console.log('D:', JSON.stringify(ex.D)); console.log('E:', JSON.stringify(ex.E));
}
ex.B = zex;
if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ map: mapId, R, ex, bounds, spawns: map.spawns, objectives: map.objectives, baseZones: map.baseZones,
    cols: cols.filter((c) => inB(c.min, c.max, 3) && c.max[0] - c.min[0] < 300).map((c) => [+c.min[0].toFixed(2), +c.min[1].toFixed(2), +c.min[2].toFixed(2), +c.max[0].toFixed(2), +c.max[1].toFixed(2), +c.max[2].toFixed(2)]) }));
  console.log('json →', jsonOut);
}
