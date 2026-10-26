// Vadi kurulum ölçümü (12.169): sunucu (görselsiz) + istemci kurulum süresi, çarpışma / görüş küresi / doğuş sayısı, ağ ve üçgen dağılımı.
//   node scripts/vadismoke.mjs
import { MapBuilder } from '../src/maps/builder.js';
const { MAPS } = await import('../src/maps/index.js');
let t = Date.now(); MapBuilder.noVisual = true; const a = MAPS.vadi.build();
console.log('sunucu kurulumu', Date.now() - t, 'ms · çarpışma', a.colliders.length, '· görüş küresi', a.sight.length, '· doğuş', a.spawns.blue.length, '/', a.spawns.red.length);
MapBuilder.noVisual = false; t = Date.now(); const m = MAPS.vadi.build(); console.log('istemci kurulumu', Date.now() - t, 'ms');
let n = 0, tri = 0; const by = {};
m.group.traverse((o) => {
  if (!o.isMesh) return;
  n++;
  const c = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  const k = o.isInstancedMesh ? 'örnek:' + o.userData.vadiInst : o.userData.water ? 'su' : o.geometry.attributes.aAux ? 'arazi' : 'yapı';
  const v = o.isInstancedMesh ? c * o.count : c;
  by[k] = (by[k] || 0) + v; tri += v;
});
console.log('ağ', n, '· üçgen', Math.round(tri));
console.log(Object.entries(by).sort((p, q) => q[1] - p[1]).map(([k, v]) => k + ' ' + Math.round(v)).join(' | '));
if (m.editSkipped?.length) console.log('atlanan düzenleme', m.editSkipped.length);
