// Tırmanma / iç mekân probu (Node): kit binalarını tek tek kurar, zemindeki bir noktadan başlayıp her hedefe
// (üst kat odaları, çatı, kule platformu, çan kulesi...) 3B yüzey grafiğinde yol bulur ve yolu GERÇEK World.move ile yürür.
// Kullanım: node scripts/probes/climb.mjs [filtre]
import { MapBuilder, makeRng } from '../../src/maps/builder.js';
import * as K from '../../src/maps/kit.js';
import * as T from '../../src/maps/kitTown.js';
import { Walk } from './nav3d.mjs';

const filter = process.argv[2] || '';
const NSEED = +(process.env.SEEDS || 1);
let SEED = 11;
const results = [];

let islandSpec = null;
function runScene(name, build) {
  if (filter && !name.includes(filter)) return;
  islandSpec = null;
  const b = new MapBuilder();
  const rng = makeRng(SEED);
  const targets = [];
  const start = build(b, rng, targets);
  const bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
  const w = new Walk(b.colliders, bounds, { region: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 } });
  const r = w.reach({ x: start.x, y: 0, z: start.z }, { maxDrop: 0.6 });
  if (r && islandSpec) checkIslands(w, r, name, islandSpec);
  for (const t of targets) {
    const path = r ? w.pathTo(r, t.x, t.y, t.z, 0.12, t.radius ?? 2.0) : null;
    if (!path) { results.push({ name, target: t.name, graph: false, walk: false }); continue; }
    const wk = w.walkPath(path);
    results.push({ name, target: t.name, graph: true, walk: wk.ok, y: +wk.y.toFixed(2), want: t.y, steps: wk.steps });
  }
}

// Bina içi zemin hücreleri: erişilemeyen bitişik bölgeler (kapalı oda / ada) ≥ 0.8 m² ise HATA
function checkIslands(w, r, name, sp) {
  const SQ = w.res * w.res;
  for (let k = 0; k < sp.floors; k++) {
    const y = k * sp.floorH;
    const un = new Set();
    for (let j = 0; j < w.nz; j++) for (let i = 0; i < w.nx; i++) {
      const x = w.cx(i), z = w.cz(j);
      if (Math.abs(x - sp.x) > sp.hw || Math.abs(z - sp.z) > sp.hd) continue;
      const L = w.surf[j * w.nx + i];
      for (let m = 0; m < L.length; m++) if (Math.abs(L[m] - y) < 0.05 && !r.seen.has(r.key(i, j, m))) un.add(j * w.nx + i);
    }
    const seen = new Set();
    for (const c of un) {
      if (seen.has(c)) continue;
      const st = [c]; seen.add(c); let n = 0, sx = 0, sz = 0;
      while (st.length) {
        const q = st.pop(); n++; const qi = q % w.nx, qj = (q / w.nx) | 0; sx += w.cx(qi); sz += w.cz(qj);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nq = (qj + dj) * w.nx + qi + di; if (un.has(nq) && !seen.has(nq)) { seen.add(nq); st.push(nq); } }
      }
      if (n * SQ >= 0.8) results.push({ name, target: `ADA@${y.toFixed(1)} (${(sx / n).toFixed(1)},${(sz / n).toFixed(1)}) ${(n * SQ).toFixed(1)}m2`, graph: false, walk: false });
    }
  }
}

const HOUSES = [
  ['ev-2kat-s', { x: 0, z: 0, w: 10, d: 9, floors: 2, door: 's' }],
  ['ev-2kat-n', { x: 0, z: 0, w: 10, d: 9, floors: 2, door: 'n' }],
  ['ev-2kat-e', { x: 0, z: 0, w: 10, d: 9, floors: 2, door: 'e', backDoor: true }],
  ['ev-2kat-w', { x: 0, z: 0, w: 9, d: 8, floors: 2, door: 'w' }],
  ['ev-3kat-duz', { x: 0, z: 0, w: 12, d: 9, floors: 3, door: 's', flat: true, roofAccess: true }],
  ['ev-3kat-us', { x: 0, z: 0, w: 16, d: 12, floors: 3, door: 's', backDoor: true, flat: true }],
  ['dukkan-2kat', { x: 0, z: 0, w: 14, d: 10, floors: 2, door: 's', theme: 'shop', flat: true, roofAccess: true }],
  ['ev-1kat-cati', { x: 0, z: 0, w: 10, d: 8, floors: 1, door: 's', flat: true, roofAccess: true }],
  ['ev-1kat', { x: 0, z: 0, w: 9, d: 8, floors: 1, door: 's' }],
  ['kulube', { x: 0, z: 0, w: 6.5, d: 5.5, floors: 1, door: 'n' }],
];
for (let sd = 0; sd < NSEED; sd++) for (const [name0, c] of HOUSES) {
  SEED = 11 + sd * 977;
  const name = NSEED > 1 ? `${name0}#${sd}` : name0;
  runScene(name, (b, rng, targets) => {
    const info = K.house(b, rng, { wall: '#d9c79a', roof: '#a8432f', ...c });
    for (const t of info.targets) targets.push({ name: `${t.room}@${t.y.toFixed(1)}`, x: t.x, y: t.y, z: t.z });
    islandSpec = { x: c.x, z: c.z, hw: (c.door === 'e' || c.door === 'w' ? c.d : c.w) / 2 - 0.4, hd: (c.door === 'e' || c.door === 'w' ? c.w : c.d) / 2 - 0.4, floors: c.floors, floorH: 3.1 };
    return info.entry;
  });
}

// Gözetleme kulesi: dört yönde (ry) zeminden platforma
for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  runScene(`kule-ry${Math.round(ry * 180 / Math.PI)}`, (b, rng, targets) => {
    const info = K.watchtower(b, { x: 0, z: 0, ry });
    if (info && info.targets) for (const t of info.targets) targets.push(t);
    return info.entry;
  });
}

// Diğer yüksek / iç mekânlar: ambar samanlığı, depo asma katı, kilise çan kulesi, benzinlik marketi (+çatı)
const SPECIAL = [
  ['ambar', (b, rng) => K.barn(b, rng, { x: 0, z: 0, w: 12, d: 18 })],
  ['ambar-ry90', (b, rng) => K.barn(b, rng, { x: 0, z: 0, w: 10, d: 14, ry: Math.PI / 2, doors: 'front' })],
  ['depo', (b, rng) => K.warehouse(b, rng, { x: 0, z: 0 })],
  ['depo-ry180', (b, rng) => K.warehouse(b, rng, { x: 0, z: 0, ry: Math.PI })],
  ['kilise', (b, rng) => K.church(b, rng, { x: 0, z: 0 })],
  ['kilise-ry90', (b, rng) => K.church(b, rng, { x: 0, z: 0, ry: Math.PI / 2 })],
  ['su-kulesi', (b, rng) => T.waterTower(b, { x: 0, z: 0 })],
  ['su-kulesi-ry90', (b, rng) => T.waterTower(b, { x: 0, z: 0, ry: Math.PI / 2 })],
  ['su-kulesi-ry180', (b, rng) => T.waterTower(b, { x: 0, z: 0, ry: Math.PI })],
  ['benzinlik', (b, rng) => K.gasStation(b, rng, { x: 0, z: 0, store: 'n' })],
];
for (const [name, fn] of SPECIAL) {
  runScene(name, (b, rng, targets) => {
    const info = fn(b, rng);
    for (const t of info.targets) targets.push({ name: t.name || t.room || 'hedef', x: t.x, y: t.y, z: t.z });
    return info.entry || { x: 0, z: 14 };
  });
}

let bad = 0;
for (const r of results) {
  const ok = r.graph && r.walk;
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : 'HATA ') + r.name.padEnd(16) + ' ' + String(r.target).padEnd(16) + ' graf:' + r.graph + ' yürüme:' + r.walk + (r.y !== undefined ? ` y=${r.y}/${r.want}` : ''));
}
console.log(`\nsonuç: ${results.length - bad}/${results.length} hedefe fizikle yürüyerek çıkıldı`);
process.exit(bad ? 1 : 0);
