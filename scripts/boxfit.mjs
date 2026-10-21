// Kare el soket denetimi (tarayıcısız): her silah / eşya için fitSockets → el kutusunun soket dışı ham parçalara batması ≤ 3 mm (bekleme soketleri).
//   node scripts/boxfit.mjs [silah...]
import * as THREE from 'three';
import { createWeapon, WEAPONS } from '../src/models/weapons.js';
import { WSTATS } from '../src/game/stats.js';
import { fitSockets, handOverlap, partBoxes } from '../src/models/boxArm.js';
let fail = 0;
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(WEAPONS)) {
  const st = WSTATS[id]; if (!st || id === 'claws') continue;
  const w = createWeapon(id, 'reddot'), g = new THREE.Group(); g.add(w); g.userData = { ...w.userData };
  const hold = { medkit: 1, mine: 1, ammobox: 1 }[st.kind] ? 'box' : g.userData.hold;
  const raw = WEAPONS[id](), boxes = partBoxes(raw), H = fitSockets(g, hold, id, boxes), o = [];
  let bad = false;
  for (const k of ['R', 'L']) { const h = H[k]; if (!h) continue; const r = handOverlap(boxes, h.p, h.r, h.size, k === 'R' || !g.userData.gripL || h.onGrip ? g.userData.gripR : g.userData.gripL); if (r.mm > 3) bad = true; o.push(`${k}${h.vert ? ' (dikey tutamak)' : ''} ${r.mm} mm`); }
  if (!H.R) bad = true;
  if (bad) fail++;
  console.log(`${bad ? 'HATA ' : 'OK   '} ${id.padEnd(10)} ${hold.padEnd(8)} ${o.join(' · ')}`);
}
console.log(fail ? `${fail} HATA` : 'hepsi geçti');
process.exit(fail ? 1 : 0);
