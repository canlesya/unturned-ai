// Bir noktanın çevresindeki çarpışma kutuları ve yürünebilirlik ızgarası (metin çizim).  node scripts/cgnear.mjs x z [yarıçap=8]
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { NavGrid } from '../src/game/nav.js';
const [cx, cz, R = 8] = process.argv.slice(2).map(Number);
const m = buildColGecidi(); const nav = new NavGrid(m.colliders, m.bounds, m.terrain, false);
let out = '';
for (let z = cz - R; z <= cz + R; z += 0.5) {
  let row = '';
  for (let x = cx - R; x <= cx + R; x += 0.5) {
    const i = nav.idx(x, z); const hit = m.colliders.find((c) => x >= c.min[0] && x <= c.max[0] && z >= c.min[2] && z <= c.max[2] && c.max[1] - m.terrain.heightAt(x, z) > 0.45);
    row += nav.blocked[i] ? (hit ? (hit.tag === 'wall' ? '#' : 'o') : '+') : '.';
  }
  out += row + '  z=' + z.toFixed(1) + '\n';
}
console.log('x:', (cx - R), '→', (cx + R), ' (# duvar, o kutu, + yalnızca nav payı, . serbest)\n' + out);
