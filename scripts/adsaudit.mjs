// Nişan denetimi (tarayıcısız): her silah × nişangâh için ADS pozunda ekran merkezinden (kırmızı nokta / nişan çizgisi) ışın atar;
// cam dışında bir parça (ön arpacık, gövde, namlu, el, kol) nişan noktasını kapatıyorsa raporlar.   node scripts/adsaudit.mjs [silah]
import * as THREE from 'three';
import { ViewModel } from '../src/game/player.js';
import { WSTATS, OPTIC_ALLOWED } from '../src/game/stats.js';

const only = process.argv[2];
const vm = new ViewModel({ scene: { environment: null } });
const ray = new THREE.Raycaster(); ray.near = 0.012; ray.far = 3;

// ADS pozunda sahte oyuncu
const fakeSoldier = (id) => ({
  stat: WSTATS[id], adsT: 1, vel: new THREE.Vector3(), onGround: true, sprinting: false, reloadT: 0, useT: 0, swing: null,
  overlay: 'none', leanT: 0, reloadTotal: 1, reloadStyle: 'mag', reloadEmpty: false,
});

const isGlass = (m) => { const mt = m.material; return mt && ((mt.transparent && mt.opacity < 0.75) || mt.blending === THREE.AdditiveBlending); };

function firstSolid(origin, dir) {
  ray.set(origin, dir);
  const hits = ray.intersectObject(vm.model, true);
  for (const h of hits) {
    let vis = true; for (let o = h.object; o; o = o.parent) if (!o.visible) vis = false;     // üst grup gizliyse (ör. ön arpacık) görünmez
    if (!vis || isGlass(h.object)) continue;
    return h;
  }
  return null;
}

const rows = []; let bad = 0, total = 0;
for (const id of Object.keys(WSTATS)) {
  const st = WSTATS[id];
  if (st.kind !== 'gun' || (only && id !== only)) continue;
  for (const optic of OPTIC_ALLOWED[id] || []) {
    if (optic === 'acog' || optic === 'scope' || optic === 'scope6') continue;   // dürbünlerde silah gizlenir
    total++;
    vm.setItem(id, 'blue', 'gun', optic);
    vm.raise = 0;
    const p = { s: fakeSoldier(id), lookDX: 0, lookDY: 0 };
    for (let i = 0; i < 30; i++) vm.update(0.016, p);
    vm.scene.updateMatrixWorld(true);
    // merkez ışın + etrafında 8 ışın (nokta ~ 6 mm yarıçap, 0,28 m uzaklıkta ≈ 0,02 eğim)
    const O = new THREE.Vector3(0, 0, 0), dirs = [[0, 0]];
    for (let k = 0; k < 8; k++) dirs.push([Math.cos(k * Math.PI / 4) * 0.014, Math.sin(k * Math.PI / 4) * 0.014]);
    const blocked = [];
    for (const [dx, dy] of dirs) {
      const h = firstSolid(O, new THREE.Vector3(dx, dy, -1).normalize());
      // demir nişanda ön arpacık nişan noktasının kendisidir; yalnızca arka nişangâhtan ÖNCE (göze yakın) giren parçalar (horoz, kabza, kurma kolu...) engeldir
      // iron: arka nişangâhtan önce giren parça VEYA arka-ön nişangâh arasında (namlunun ilk yarısında) hattı kesen parça engeldir; ön arpacık (namlu ucuna yakın) hedeftir
      const ironBlock = h && optic === 'iron' && (h.distance < (vm.model.userData.dist ?? 0.22) - 0.006 || vm.model.worldToLocal(h.point.clone()).z > 0.5 * vm.model.userData.muzzle.z);
      if (h && (optic !== 'iron' || ironBlock)) {
        const bb = new THREE.Box3().setFromObject(h.object), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
        blocked.push({ dx, dy, d: h.distance, local: vm.model.worldToLocal(h.point.clone()).toArray().map((v) => +v.toFixed(3)), sight: vm.model.userData.sight, boyut: sz.toArray().map((v) => +(v * 100).toFixed(1)).join('x') + ' cm', mesh: h.object });
      }
    }
    const center = blocked.find((b) => b.dx === 0 && b.dy === 0);
    const flag = center ? 'MERKEZ KAPALI' : blocked.length >= 3 ? 'ÇEVRE KAPALI' : blocked.length ? 'kısmi' : 'temiz';
    if (center || blocked.length >= 3) bad++;
    const b0 = center || blocked[0];
    rows.push({ id, optic, durum: flag, isin: `${blocked.length}/9`, mesafe: b0 ? +b0.d.toFixed(2) : '-', parca: b0 ? b0.boyut : '-' });
    if (process.env.DETAIL && b0) console.log(id, optic, 'çarpma noktası (silah yerel):', b0.local.join(', '), '| nişan noktası:', (b0.sight || []).join(', '));
  }
}
console.table(rows.filter((r) => r.durum !== 'temiz'));
console.log(`${total} kombinasyon, kapalı: ${bad}`);
process.exit(bad ? 1 : 0);
