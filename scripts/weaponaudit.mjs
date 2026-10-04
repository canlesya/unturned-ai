// Silah bütünlük denetimi: birleştirmeden önceki parçalar arasında ana gövdeye bağlı olmayan ("havada duran") parça var mı?
//   node scripts/weaponaudit.mjs [silah...]     (bağlantı payı 12 mm)
import * as THREE from 'three';
import { WEAPONS } from '../src/models/weapons.js';
const TOL = 0.012;
let total = 0;
for (const id of (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(WEAPONS))) {
  const g = WEAPONS[id](); g.updateMatrixWorld(true);
  const items = [];
  g.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); items.push({ b: new THREE.Box3().setFromObject(o), o }); } });
  const n = items.length, par = items.map((_, i) => i);
  const find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = items[i].b, b = items[j].b;
    if (a.min.x - TOL > b.max.x || b.min.x - TOL > a.max.x || a.min.y - TOL > b.max.y || b.min.y - TOL > a.max.y || a.min.z - TOL > b.max.z || b.min.z - TOL > a.max.z) continue;
    par[find(i)] = find(j);
  }
  const comps = new Map();
  items.forEach((_, i) => { const r = find(i); (comps.get(r) || comps.set(r, []).get(r)).push(i); });
  const sorted = [...comps.values()].sort((p, q) => q.length - p.length);
  const loose = sorted.slice(1);
  total += loose.length;
  const desc = loose.map((c) => { const bb = new THREE.Box3(); c.forEach((i) => bb.union(items[i].b)); const ct = bb.getCenter(new THREE.Vector3()); return `${c.length}p @(${ct.x.toFixed(2)},${ct.y.toFixed(2)},${ct.z.toFixed(2)})`; }).join('  ');
  console.log(`${loose.length ? 'HATA ' : 'OK   '} ${id.padEnd(10)} ${n} parça${loose.length ? ' · bağsız: ' + desc : ''}`);
}
process.exit(total ? 1 : 0);
