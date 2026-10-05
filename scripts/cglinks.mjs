// Çöl Geçidi: gerçek haritada komşu olan bölge çiftlerinin yol uzunluğu / kuş uçuşu oranı (bağlantı hatalarını yakalar).  node scripts/cglinks.mjs
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi, CALLOUTS } from '../src/maps/colgecidi.js';
import { NavGrid } from '../src/game/nav.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const m = buildColGecidi(), nav = new NavGrid(m.colliders, m.bounds, m.terrain, !!m.layered);
const C = Object.fromEntries(CALLOUTS.map((c) => [c.name, c]));
const PAIRS = [['Lower Tunnels', 'Upper Tunnels'], ['Upper Tunnels', 'Outside Tunnels'], ['Outside Tunnels', 'T Spawn'], ['Outside Tunnels', 'Titanic'], ['T Spawn', 'Outside Long'], ['T Spawn', 'Top Mid'], ['Top Mid', 'Outside Long'],
  ['Outside Long', 'Long Doors'], ['Long Doors', 'Long Corner'], ['Long Corner', 'Pit'], ['Long Corner', 'Long'], ['Long', 'Ramp'], ['Ramp', 'A Site'], ['A Site', 'Goose'], ['Top Mid', 'Mid'], ['Mid', 'Xbox'],
  ['Xbox', 'Mid Doors'], ['Mid Doors', 'CT Mid'], ['Xbox', 'Short'], ['Short', 'Stairs'], ['Stairs', 'Short Stairs'], ['Short Stairs', 'A Site'], ['CT Spawn', 'Elevator'], ['Elevator', 'A Site'],
  ['CT Mid', 'B Doors'], ['B Doors', 'B Site'], ['CT Mid', 'Window'], ['Window', 'B Site'], ['B Site', 'B Plat'], ['B Plat', 'Back Plat'], ['Upper Tunnels', 'B Site'], ['Upper Tunnels', 'Fence'], ['Fence', 'Box'], ['Box', 'B Site'], ['B Plat', 'Back Plat'], ['CT Spawn', 'CT Mid'], ['Ninja', 'A Site'], ['Barrels', 'A Site'], ['Suicide', 'Mid Doors'], ['Lower Tunnels', 'Xbox'], ['Cat', 'Short'], ['Mid', 'Cat']];
let bad = 0; const badPairs = [];
for (const [a, b] of PAIRS) {
  const A = C[a], B = C[b], p = nav.findPath(A.x, A.z, B.x, B.z, 1.2);
  let L = 0; if (p) for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
  const e = Math.hypot(A.x - B.x, A.z - B.z), r = p ? L / Math.max(e, 1) : Infinity, flag = r > 1.9 && L - e > 18;
  if (flag) { bad++; badPairs.push([a, b]); }
  console.log(`${flag ? 'HATA  ' : 'OK    '}${a} ↔ ${b}: kuş uçuşu ${e.toFixed(0)} m · yol ${p ? L.toFixed(0) : 'YOK'} m · oran ${r.toFixed(2)}`);
}
if (process.env.WRITE) {                                                 // kopuk çiftleri çıkarım betiğine bildir (rampa açılacak çiftler birikir)
  const f = 'tools/ramp_pairs.json', old = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
  const all = [...old]; for (const p of badPairs) if (!all.some((q) => q[0] === p[0] && q[1] === p[1])) all.push(p);
  writeFileSync(f, JSON.stringify(all, null, 0)); console.log('rampa çiftleri:', all.length);
}
console.log(bad ? `sonuç: ${bad} şüpheli bağlantı` : 'sonuç: OK');
process.exit(0);
