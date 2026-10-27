// Kuzey Vadisi kalite taraması (12.182; usqa / kasabaqa'nın araziye uyarlanmışı) — tarayıcısız, haritanın KURULMUŞ çıktısına bakar:
//   node scripts/kuzeyqa.mjs [--v] [--json çıktı.json]
//  A  iç içe katı        : farklı nesnelerin iki çarpışma kutusu her eksende ≥ 5 cm iç içe (katılar yalnız yüz yüze değmeli)
//  A2 görsel iç içe      : farklı nesnelerin iki opak görsel kutusu her eksende ≥ 5 cm iç içe
//  B  z-fighting         : farklı nesnelerin aynı yöne bakan iki opak yüzü, MapBuilder'ın kurulumdaki itmesinden sonra hâlâ < 6 mm arayla örtüşüyor (≥ 4 cm²)
//  C  görünmez çarpışma  : çarpışma kutusunun yüzey örneklerinin > %5'i hiçbir görselin içinde değil (ağaç gövdesi / kaya: örnekli bitki ağı → ayrı sayılır)
//  D  içinden geçilen    : gövde bandında (zeminden 0,1–1,7 m) opak, kalın (≥ 8 cm) görsel parçanın çarpışmadan > 0,3 m uzak bölümü
//  E  havada / gömülü    : araziye hiçbir değme zinciriyle bağlanmayan öbek · zeminin tamamen altında kalan görsel
//  R  yol koridoru       : yol (asfalt / toprak; köy sokakları hariç) ekseni ± yarı genişlik içinde zeminden 0,15–4,5 m'de katı (baraj tabliyesi hariç)
//  V  araç / heliped     : araç doğuş noktası (±4,5 m) ve heliped (r + 2 m) içinde başka nesnenin katısı
//  F  doğuş / hedef      : katı içinde doğuş, bayrak merkezi katı içinde, sınır dışı çarpışma
//  G  nav                : iki üsten 7 bayrağa yol (2 m ızgara + navPost), bayrak alanında serbest hücre oranı
import * as THREE from 'three';
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
Error.stackTraceLimit = 40;
MapBuilder.zfix = true;
const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const FILE_RE = /src[\\/]maps[\\/](kuzey\.js|assets[\\/][^:]+):(\d+)/g;
const prims = []; let rec = true;
const chainOf = () => { const s = new Error().stack; const out = []; for (const m of s.matchAll(FILE_RE)) if (!/chunks\.js$/.test(m[1])) out.push(m[1].replace(/^assets[\\/]/, '').replace(/^common[\\/]/, '') + ':' + m[2]); return { c: out.reverse().join('>'), veg: /vegetationColliders/.test(s), veh: /maps[\\/]vehicles\.js/.test(s) }; };
const P = MapBuilder.prototype, _addGeo = P.addGeo, _aabb = P._aabb;
P.addGeo = function (geometry, color, local, o) { const r = _addGeo.call(this, geometry, color, local, o); if (rec && !this.isFar) { const ch = chainOf(); prims.push({ g: r.g, color, o: o || {}, chain: ch.c, oid: r.g.userData.oid, veh: ch.veh }); } return r; };
P._aabb = function (...a) { const n = this.colliders.length; _aabb.apply(this, a); if (rec) { const ch = chainOf(); this.colliders[n]._chain = ch.c; this.colliders[n]._veg = ch.veg; } };
// z-fighting: MapBuilder (tarayıcıdaki gibi, zfix) eş yönlü yakın yüzleri kurulumda iter; B itmeden SONRA kalan (< 6 mm) çiftleri sayar

const { buildKuzey, KZ_PLAY } = await import('../src/maps/kuzey.js');
const t0 = performance.now();
const map = buildKuzey();
const tBuild = performance.now() - t0;
rec = false;
const T = map.terrain, cols = map.colliders;
const gAt = (x, z) => T.heightAt(x, z);
for (const p of prims) {
  const pos = p.g.attributes.position, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.count; i++) for (let a = 0; a < 3; a++) { const v = pos.getComponent(i, a); if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
  let box = pos.count === 36;
  if (box) for (let i = 0; i < pos.count && box; i++) for (let a = 0; a < 3; a++) { const v = pos.getComponent(i, a); if (Math.abs(v - mn[a]) > 1e-3 && Math.abs(v - mx[a]) > 1e-3) { box = false; break; } }
  p.mn = mn; p.mx = mx; p.box = box; p.opaque = !p.o.transparent && !(p.o.opacity < 1);
  p.site = p.chain.split('>').pop() || '?';
}
const inPlay = (mn, mx) => mx[0] > -800 && mn[0] < 800 && mx[2] > -800 && mn[2] < 800;
const vis = prims.filter((p) => p.opaque && inPlay(p.mn, p.mx) && !p.veh);                 // araç modelleri (vehicles.js: yer tutucu / enkaz) ayrı profil: vparts (kaput / cam boşluğu) → C / D / E dışı
const nVehP = prims.filter((p) => p.veh).length;
console.log(`=== kuzey: görsel parça ${prims.length} (opak ${vis.length}), çarpışma ${cols.length}, görüş küresi ${map.sight.length} · kurulum ${tBuild.toFixed(0)} ms`);
const R = {}, ex = {};
const top = (m, k = 6) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);
const ov = (a, b, ax) => Math.min(a.mx[ax], b.mx[ax]) - Math.max(a.mn[ax], b.mn[ax]);
function sweep(list, lo, hi, pad, f) {
  const ord = list.map((_, i) => i).sort((a, b) => lo(list[a])[0] - lo(list[b])[0]);
  for (let oi = 0; oi < ord.length; oi++) { const A = list[ord[oi]]; const ax = hi(A)[0] + pad;
    for (let oj = oi + 1; oj < ord.length; oj++) { const Bq = list[ord[oj]]; if (lo(Bq)[0] > ax) break; f(A, Bq); } }
}
const rec_ = (key, k, item) => { (ex[key] ||= []).length < 60 && ex[key].push(item); };
// A
{
  let n = 0; const sites = new Map();
  const gp = cols.filter((c) => c.max[0] - c.min[0] < 300 && c.max[2] - c.min[2] < 300);
  sweep(gp, (c) => c.min, (c) => c.max, 0, (a, b) => {
    if (a.oid === b.oid) return;
    for (let k = 0; k < 3; k++) if (Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) < 0.05) return;
    n++; const s = [a._chain?.split('>').pop() || '?', b._chain?.split('>').pop() || '?'].sort().join(' ~ '); sites.set(s, (sites.get(s) || 0) + 1);
    rec_('A', 0, [+((Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2).toFixed(1), +Math.max(a.min[1], b.min[1]).toFixed(1), +((Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2).toFixed(1), a.oid, b.oid]);
  });
  R.A = n; console.log(`A  iç içe katı (farklı nesne, ≥ 5 cm)        ${n}   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// A2
{
  let n = 0; const sites = new Map(); const L = vis.filter((p) => p.box);
  sweep(L, (p) => p.mn, (p) => p.mx, 0, (a, b) => { if (a.oid === b.oid) return; for (let k = 0; k < 3; k++) if (ov(a, b, k) < 0.05) return; n++;
    const s = [a.site, b.site].sort().join(' ~ '); sites.set(s, (sites.get(s) || 0) + 1);
    rec_('A2', 0, [+((a.mn[0] + a.mx[0]) / 2).toFixed(1), +a.mn[1].toFixed(1), +((a.mn[2] + a.mx[2]) / 2).toFixed(1), a.oid, b.oid]); });
  R.A2 = n; console.log(`A2 görsel iç içe (farklı nesne, ≥ 5 cm)      ${n}   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// B
{
  const L = vis.filter((p) => p.box); const OT = [[1, 2], [0, 2], [0, 1]]; let n = 0; const sites = new Map();
  const CG = new Map(); for (const c of cols) if (c.max[0] - c.min[0] < 200 && c.max[2] - c.min[2] < 200) for (let x = Math.floor(c.min[0] / 4); x <= Math.floor(c.max[0] / 4); x++) for (let z = Math.floor(c.min[2] / 4); z <= Math.floor(c.max[2] / 4); z++) { const k = x + ',' + z; let q = CG.get(k); if (!q) CG.set(k, (q = [])); q.push(c); }
  const rests = (y, x, z) => Math.abs(y - gAt(x, z)) < 0.06 || y < gAt(x, z) || (CG.get(Math.floor(x / 4) + ',' + Math.floor(z / 4)) || []).some((c) => Math.abs(c.max[1] - y) < 0.015 && x >= c.min[0] && x <= c.max[0] && z >= c.min[2] && z <= c.max[2]);
  sweep(L, (p) => p.mn, (p) => p.mx, 0.03, (A, Bq) => {
    if (A.oid === Bq.oid) return;
    if (Bq.mn[1] > A.mx[1] + 0.03 || A.mn[1] > Bq.mx[1] + 0.03 || Bq.mn[2] > A.mx[2] + 0.03 || A.mn[2] > Bq.mx[2] + 0.03) return;
    for (let a = 0; a < 3; a++) { const o = OT[a]; const o0 = ov(A, Bq, o[0]), o1 = ov(A, Bq, o[1]); if (o0 < 0.02 || o1 < 0.02 || o0 * o1 < 0.0004) continue;
      for (const sd of [1, -1]) { const fa = sd > 0 ? A.mx[a] : A.mn[a], fb = sd > 0 ? Bq.mx[a] : Bq.mn[a]; if (Math.abs(fa - fb) >= 0.006) continue;
        if (a === 1 && sd < 0 && rests(fa, (Math.max(A.mn[0], Bq.mn[0]) + Math.min(A.mx[0], Bq.mx[0])) / 2, (Math.max(A.mn[2], Bq.mn[2]) + Math.min(A.mx[2], Bq.mx[2])) / 2)) continue;   // alt yüzü bir katının üstüne / araziye oturan iki parça: alt yüzler görünmez
        n++; const k = [A.site, Bq.site].sort().join(' ~ '); sites.set(k, (sites.get(k) || 0) + 1);
        rec_('B', 0, [+((Math.max(A.mn[0], Bq.mn[0]) + Math.min(A.mx[0], Bq.mx[0])) / 2).toFixed(1), +fa.toFixed(2), +((Math.max(A.mn[2], Bq.mn[2]) + Math.min(A.mx[2], Bq.mx[2])) / 2).toFixed(1), 'xyz'[a] + (sd > 0 ? '+' : '-'), A.oid, Bq.oid]); } }
  });
  R.B = n; console.log(`B  z-fighting (farklı nesne, itme sonrası < 6 mm) ${n}   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// uzaysal karma
const HC = 4, hk = (x, z) => x + ',' + z;
const hashAdd = (M, item, mn, mx) => { for (let x = Math.floor(mn[0] / HC); x <= Math.floor(mx[0] / HC); x++) for (let z = Math.floor(mn[2] / HC); z <= Math.floor(mx[2] / HC); z++) { const k = hk(x, z); let a = M.get(k); if (!a) M.set(k, (a = [])); a.push(item); } };
const H = new Map(); for (const p of prims) if (inPlay(p.mn, p.mx) && p.mx[0] - p.mn[0] < 200 && p.mx[2] - p.mn[2] < 200) hashAdd(H, p, p.mn, p.mx);
const visAt = (x, y, z, tol) => { const gx = Math.floor(x / HC), gz = Math.floor(z / HC); for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) for (const p of H.get(hk(ix, iz)) || []) if (x >= p.mn[0] - tol && x <= p.mx[0] + tol && y >= p.mn[1] - tol && y <= p.mx[1] + tol && z >= p.mn[2] - tol && z <= p.mx[2] + tol) return true; return false; };
// C
{
  let n = 0, nVeg = 0, nVeh = 0; const sites = new Map();
  for (const c of cols) {
    if (!inPlay(c.min, c.max)) continue;
    if (c._veg) { nVeg++; continue; }
    if (c.tag === 'veh') { nVeh++; continue; }                                      // ağaç gövdesi / kaya: görseli örnekli bitki ağında (Forest), kutu gövdenin / kayanın içine çizilir
    const d = [0, 1, 2].map((a) => c.max[a] - c.min[a]); if (d[0] > 150 || d[2] > 150) continue;
    const st = d.map((v) => Math.max(1, Math.min(8, Math.ceil(v / 0.3)))); let tot = 0, bad = 0;
    for (let i = 0; i <= st[0]; i++) for (let j = 0; j <= st[1]; j++) for (let k = 0; k <= st[2]; k++) {
      if (i > 0 && i < st[0] && j > 0 && j < st[1] && k > 0 && k < st[2]) continue;
      const x = c.min[0] + 0.03 + (d[0] - 0.06) * i / st[0], y = c.min[1] + 0.03 + (d[1] - 0.06) * j / st[1], z = c.min[2] + 0.03 + (d[2] - 0.06) * k / st[2];
      if (y < gAt(x, z) - 0.02) continue;                                  // toprak altında kalan kısım görünmez olabilir
      tot++; if (!visAt(x, y, z, 0.04)) bad++;
    }
    if (tot && bad > tot * 0.05) { n++; const s = c._chain?.split('>').pop() || '?'; sites.set(s, (sites.get(s) || 0) + 1); rec_('C', 0, [+((c.min[0] + c.max[0]) / 2).toFixed(1), +c.min[1].toFixed(1), +((c.min[2] + c.max[2]) / 2).toFixed(1), Math.round(bad / tot * 100), c.oid]); }
  }
  R.C = n; console.log(`C  görünmez çarpışma (> %5 yüzey görselsiz)   ${n}   (bitki ağı gövde / kaya kutusu ${nVeg} · araç modeli kutusu ${nVeh}, görsel ${nVehP})   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// D
{
  const CH = new Map(); for (const c of cols) if (c.max[0] - c.min[0] < 200 && c.max[2] - c.min[2] < 200) hashAdd(CH, c, c.min, c.max);
  const near = (x, y, z, r) => { const gx = Math.floor(x / HC), gz = Math.floor(z / HC); for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) for (const c of CH.get(hk(ix, iz)) || []) if (y >= c.min[1] - 0.05 && y <= c.max[1] + 0.05 && x >= c.min[0] - r && x <= c.max[0] + r && z >= c.min[2] - r && z <= c.max[2] + r) return true; return false; };
  let n = 0; const sites = new Map();
  for (const p of vis) {
    const d = [0, 1, 2].map((a) => p.mx[a] - p.mn[a]); if (Math.min(d[0], d[2]) < 0.08 || d[1] < 0.08) continue;
    if (p.o.glow && d[0] * d[1] * d[2] < 0.02) continue;
    if (/kasaba-shapes\.js:104/.test(p.chain)) continue;                     // yaprak (saksı bitkisi): ince yaprak çarpışmasız (bitki kuralı)
    const pts = [];
    if (p.box) { const st = d.map((v) => Math.max(1, Math.min(10, Math.ceil(v / 0.25)))); for (let i = 0; i <= st[0]; i++) for (let j = 0; j <= st[1]; j++) for (let k = 0; k <= st[2]; k++) { if (i > 0 && i < st[0] && j > 0 && j < st[1] && k > 0 && k < st[2]) continue; pts.push([p.mn[0] + d[0] * i / st[0], p.mn[1] + d[1] * j / st[1], p.mn[2] + d[2] * k / st[2]]); } }
    else { const Pp = p.g.attributes.position, nT = Pp.count / 3, step = Math.max(1, Math.floor(nT / 150)); for (let t = 0; t < nT; t += step) { let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += Pp.getX(t * 3 + k); y += Pp.getY(t * 3 + k); z += Pp.getZ(t * 3 + k); } pts.push([x / 3, y / 3, z / 3]); } }
    let bad = false;
    for (const [x, y, z] of pts) { const g = gAt(x, z); if (y < g + 0.1 || y > g + 1.7) continue; if (!near(x, y, z, 0.3)) { bad = true; break; } }
    if (bad) { n++; sites.set(p.site, (sites.get(p.site) || 0) + 1); rec_('D', 0, [+((p.mn[0] + p.mx[0]) / 2).toFixed(1), +p.mn[1].toFixed(1), +((p.mn[2] + p.mx[2]) / 2).toFixed(1), p.color, p.oid]); }
  }
  R.D = n; console.log(`D  içinden geçilen opak görsel              ${n}   ${top(sites).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// E
{
  const nodes = [...vis.map((p) => ({ mn: p.mn, mx: p.mx, p })), ...cols.filter((c) => inPlay(c.min, c.max) && !c._veg && c.tag !== 'veh').map((c) => ({ mn: c.min, mx: c.max, c }))];
  const par = nodes.map((_, i) => i); const f = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  nodes.forEach((q, i) => (q.i = i));
  sweep(nodes, (q) => q.mn, (q) => q.mx, 0.02, (a, b) => { for (let k = 0; k < 3; k++) if (ov(a, b, k) < -0.02) return; const ra = f(a.i), rb = f(b.i); if (ra !== rb) par[ra] = rb; });
  const gMin = (q) => { let m = 1e9; const nx = Math.max(1, Math.ceil((q.mx[0] - q.mn[0]) / 2)), nz = Math.max(1, Math.ceil((q.mx[2] - q.mn[2]) / 2)); for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) m = Math.min(m, gAt(q.mn[0] + (q.mx[0] - q.mn[0]) * i / nx, q.mn[2] + (q.mx[2] - q.mn[2]) * j / nz)); return m; };
  const ground = new Set(); for (const q of nodes) if (q.mn[1] <= gMin(q) + 0.05) ground.add(f(q.i));
  const comps = new Map(); for (const q of nodes) { const r = f(q.i); if (ground.has(r)) continue; if (!comps.has(r)) comps.set(r, []); comps.get(r).push(q); }
  const list = [...comps.values()].filter((c) => c.some((q) => q.p));
  // gömülü: görselin en üstü bile arazinin altında (her köşede)
  let buried = 0; const bs = new Map();
  for (const p of vis) { if (p.mx[1] < Math.min(gAt(p.mn[0], p.mn[2]), gAt(p.mx[0], p.mx[2]), gAt(p.mn[0], p.mx[2]), gAt(p.mx[0], p.mn[2])) - 0.02 && p.mx[1] - p.mn[1] < 30) { buried++; bs.set(p.site, (bs.get(p.site) || 0) + 1); } }
  R.E = list.length; R.Eb = buried;
  ex.E = list.slice(0, 40).map((c) => { const q = c.find((q) => q.p); return [+((q.mn[0] + q.mx[0]) / 2).toFixed(1), +q.mn[1].toFixed(2), +((q.mn[2] + q.mx[2]) / 2).toFixed(1), c.length, q.p.oid, q.p.site]; });
  console.log(`E  havada duran öbek ${R.E} · tamamen toprak altında görsel ${buried}   ${ex.E.slice(0, 4).map((e) => e.join(' ')).join(' | ')}   ${top(bs).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// R yol koridoru
{
  const CH = new Map(); for (const c of cols) if (c.max[0] - c.min[0] < 200 && c.max[2] - c.min[2] < 200 && c.tag !== 'deck') hashAdd(CH, c, c.min, c.max);
  const bad = new Map(); let n = 0;
  for (const r of T.roads) {
    if (r.t === 'lane') continue;
    const hw = r.w / 2;
    for (let i = 0; i < r.pts.length; i++) {
      const [x, z] = r.pts[i], g = gAt(x, z), gx = Math.floor(x / HC), gz = Math.floor(z / HC);
      if (Math.hypot(x - 700, z + 60) < 95) continue;                            // baraj tepesi (tabliye)
      if (Math.hypot(x + 230, z - 250) < 14) continue;                           // köy meydanı (yolların bittiği meydan: lamba / çeşme meydanda)
      for (let ix = gx - 2; ix <= gx + 2; ix++) for (let iz = gz - 2; iz <= gz + 2; iz++) for (const c of CH.get(hk(ix, iz)) || []) {
        if (c.max[1] < g + 0.15 || c.min[1] > g + 4.5) continue;
        // eksene uzaklık (kutunun ayak izine en yakın nokta)
        const qx = Math.max(c.min[0], Math.min(x, c.max[0])), qz = Math.max(c.min[2], Math.min(z, c.max[2]));
        if (Math.hypot(qx - x, qz - z) > hw - 0.05) continue;
        if (bad.has(c)) continue; bad.set(c, r.id); n++; rec_('R', 0, [r.id, +x.toFixed(1), +z.toFixed(1), c.oid, c._chain?.split('>').pop()]);
      }
    }
  }
  R.R = n; const by = new Map(); for (const [c, id] of bad) { const k = id + ':' + (c._chain?.split('>').pop() || '?'); by.set(k, (by.get(k) || 0) + 1); }
  console.log(`R  yol koridorunda katı                     ${n}   ${top(by, 8).map(([k, v]) => k + '×' + v).join(' | ')}`);
}
// V araç doğuşları / heliped
{
  let n = 0; const s = [];
  const hitIn = (x0, x1, z0, z1, y0, y1, ignore) => cols.filter((c) => c.max[0] > x0 && c.min[0] < x1 && c.max[2] > z0 && c.min[2] < z1 && c.max[1] > y0 && c.min[1] < y1 && !ignore(c));
  for (const v of map.vehicles) { const g = gAt(v.x, v.z), h = hitIn(v.x - 4.5, v.x + 4.5, v.z - 4.5, v.z + 4.5, g + 0.2, g + 4, (c) => /^araç-doğuş/.test(c.oid) || /^heliped/.test(c.oid)); if (h.length) { n += h.length; s.push(v.id + ':' + h[0].oid); } }
  for (const hp of map.helipads) { const g = gAt(hp.x, hp.z), r = hp.r + 2, h = hitIn(hp.x - r, hp.x + r, hp.z - r, hp.z + r, g + 0.3, g + 12, (c) => /^heliped/.test(c.oid)); if (h.length) { n += h.length; s.push(hp.id + ':' + h[0].oid); } }
  R.V = n; console.log(`V  araç doğuşu / heliped içinde katı         ${n}   ${s.slice(0, 8).join(' | ')}`);
}
// F + G
{
  const { World } = await import('../src/game/collision.js');
  const { NavGrid } = await import('../src/game/nav.js');
  const W = new World(cols, map.bounds, T), tmp = [];
  let sIn = 0; for (const t of ['blue', 'red']) for (const p of map.spawns[t]) { const y = gAt(p.x, p.z) + 0.05; if (W._hits(W.query(p.x - 1, p.z - 1, p.x + 1, p.z + 1, tmp), p.x, y, p.z, 1.7)) sIn++; }
  let oIn = 0; for (const o of map.objectives) if (W._hits(W.query(o.x - 1, o.z - 1, o.x + 1, o.z + 1, tmp), o.x, o.y + 0.05, o.z, 1.7)) oIn++;
  const out = cols.filter((c) => c.max[1] > -50 && (c.min[0] < -801 || c.max[0] > 801 || c.min[2] < -801 || c.max[2] > 801)).length;
  R.F = sIn + oIn + out; console.log(`F  katı içinde doğuş ${sIn} · bayrak merkezi katı içinde ${oIn} · sınır dışı çarpışma ${out}`);
  const nav = new NavGrid(cols, map.bounds, T, false, map.navCell); map.navPost(nav);
  const res = []; let miss = 0;
  for (const f of map.objectives) {
    const pb = nav.findPath(map.spawns.blue[0].x, map.spawns.blue[0].z, f.x, f.z), pr = nav.findPath(map.spawns.red[0].x, map.spawns.red[0].z, f.x, f.z);
    const len = (p, x, z) => { if (!p) return 'YOK'; let L = 0; for (const q of p) { L += Math.hypot(q.x - x, q.z - z); x = q.x; z = q.z; } return Math.round(L); };
    if (!pb || !pr) miss++;
    let fr = 0, tot = 0; for (let dz = -f.r; dz <= f.r; dz += 2) for (let dx = -f.r; dx <= f.r; dx += 2) { if (dx * dx + dz * dz > f.r * f.r) continue; tot++; if (nav.isFree(f.x + dx, f.z + dz)) fr++; }
    res.push(`${f.id} ${len(pb, map.spawns.blue[0].x, map.spawns.blue[0].z)}/${len(pr, map.spawns.red[0].x, map.spawns.red[0].z)} m (%${Math.round(100 * fr / tot)} serbest)`);
  }
  R.G = miss; console.log(`G  nav: bayraklara yol (Mavi / Kırmızı)      ${res.join(' · ')}`);
}
const total = R.A + R.A2 + R.B + R.C + R.D + R.E + R.R + R.V + R.F + R.G;                       // Eb (tamamen toprak altında, görünmez) bilgi
console.log(`TOPLAM SORUN ${total}  ${JSON.stringify(R)}`);
if (args.includes('--v')) for (const k of ['A', 'A2', 'B', 'C', 'D', 'E', 'R']) console.log(k + ':', JSON.stringify((ex[k] || []).slice(0, 30)));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ R, ex }));
process.exit(total ? 1 : 0);
