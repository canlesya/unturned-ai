// Nişan görüş alanı denetimi: ADS pozunda ekran merkezi çevresinde (açısal yarıçap 3° / 6° / 10°) silah/nişangâh parçalarının kapattığı oran.
//   node scripts/adsview.mjs [silah] ; eşik: ekranda 6° içinde %33'ten fazla kapanıyorsa "BÜYÜK"
import * as THREE from 'three';
import { ViewModel } from '../src/game/player.js';
import { WSTATS, OPTIC_ALLOWED } from '../src/game/stats.js';

const only = process.argv[2];
const LIMIT6 = +(process.env.LIMIT || 33);
const FOVK = Math.tan(68 / 2 * Math.PI / 180) / Math.tan(54 / 2 * Math.PI / 180);   // ADS'de silah kamerası FOV 54→68: ekran açısı → silah ışın açısı
const vm = new ViewModel({ scene: { environment: null } });
const ray = new THREE.Raycaster(); ray.near = 0.012; ray.far = 3;
const fake = (id) => ({ stat: WSTATS[id], adsT: 1, vel: new THREE.Vector3(), onGround: true, sprinting: false, reloadT: 0, useT: 0, swing: null, overlay: 'none', leanT: 0, reloadTotal: 1, reloadStyle: 'mag', reloadEmpty: false });
const isGlass = (m) => { const mt = m.material; return mt && ((mt.transparent && mt.opacity < 0.75) || mt.blending === THREE.AdditiveBlending); };
const solid = (dir) => {
  ray.set(new THREE.Vector3(), dir);
  for (const h of ray.intersectObject(vm.model, true)) {
    let vis = true; for (let o = h.object; o; o = o.parent) if (!o.visible) vis = false;
    if (vis && !isGlass(h.object)) return true;
  }
  return false;
};
const rows = []; let bad = 0;
for (const id of Object.keys(WSTATS)) {
  const st = WSTATS[id];
  if (st.kind !== 'gun' || (only && id !== only)) continue;
  for (const optic of OPTIC_ALLOWED[id] || []) {
    if (optic === 'scope' || optic === 'scope6') continue;
    vm.setItem(id, 'blue', 'gun', optic); vm.raise = 0;
    const p = { s: fake(id), lookDX: 0, lookDY: 0 };
    for (let i = 0; i < 30; i++) vm.update(0.016, p);
    vm.scene.updateMatrixWorld(true);
    const res = {};
    for (const deg of [3, 6, 10]) {
      const R = Math.tan(deg * Math.PI / 180); let n = 0, b = 0;
      for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) {
        const x = i / 12 * R, y = j / 12 * R, fx = x * FOVK, fy = y * FOVK;
        if (x * x + y * y > R * R) continue;
        n++; if (solid(new THREE.Vector3(fx, fy, -1).normalize())) b++;
      }
      res[deg] = Math.round(100 * b / n);
    }
    const flag = res[6] > LIMIT6 ? 'BÜYÜK' : 'ok';
    if (flag !== 'ok') bad++;
    rows.push({ id, optic, '3°': res[3] + '%', '6°': res[6] + '%', '10°': res[10] + '%', durum: flag });
  }
}
console.table(rows.sort((a, b) => parseInt(b['6°']) - parseInt(a['6°'])).slice(0, +(process.env.TOP || 40)));
console.log(`${rows.length} kombinasyon, büyük: ${bad} (6° içinde >%${LIMIT6})`);
process.exit(bad ? 1 : 0);
