// Liman hızlı kurulum ölçümü (görsel dahil, Node): node scripts/limanprobe.mjs
import { buildLiman } from '../src/maps/liman.js';
const t = performance.now(); const m = buildLiman();
let tris = 0, meshes = 0; m.group.traverse((o) => { if (o.isMesh) { meshes++; tris += o.geometry.attributes.position.count / 3; } });
console.log('kurulum', (performance.now() - t).toFixed(0), 'ms · çarpışma', m.colliders.length, '· doğuş', m.spawns.blue.length, '/', m.spawns.red.length, '· ağ', meshes, '· üçgen', tris | 0);
