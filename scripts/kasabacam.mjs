// Bakış noktası denetimi (tarayıcısız): her kasabashots bakışında kamera bir duvarın / katın / eşyanın İÇİNDE mi, görüşü
// burnunun dibindeki bir yüzey mi kapatıyor?   node scripts/kasabacam.mjs [harita=kasaba]   (12.176)
//   İÇ   : kamera bir çarpışma kutusunun içinde (0,1 m pay) ya da 6 eksen ışınının hepsi önce bir ARKA yüze çarpıyor (kapalı katı içi)
//   YAKIN: kameraya 0,3 m'den yakın çarpışma kutusu (yakın kırpma düzlemi duvarı keser)
//   KAPALI: görüş alanındaki 9 × 5 ışının ≥ %30'u 2,5 m içinde bir yüzeye çarpıyor ya da bakış yönündeki ışın 2 m içinde çarpıyor (ör. çatı kulübesinin duvarı kadrajı dolduruyor)
// Çıkış kodu: sorunlu bakış varsa 1.
import * as THREE from 'three';
import { MAPS } from '../src/maps/index.js';
import { VIEWS, AIR } from './kasabaviews.mjs';

const map = MAPS[process.argv[2] || 'kasaba'].build();
const meshes = [];
map.group.updateMatrixWorld(true);
map.group.traverse((o) => { if (o.isMesh) { const m = Array.isArray(o.material) ? o.material : [o.material]; for (const q of m) q.side = THREE.DoubleSide; meshes.push(o); } });
const C = map.colliders;
const rc = new THREE.Raycaster();
const hit = (o, d, far = 1e4) => { rc.set(o, d); rc.far = far; const h = rc.intersectObjects(meshes, false); return h[0] || null; };
let bad = 0;
const want = process.env.VIEWS ? process.env.VIEWS.split(',') : null;
const extra = process.env.CAM ? [JSON.parse(process.env.CAM)] : [];   // CAM='["aday",[x,y,z],[tx,ty,tz],fov]' ile aday nokta dene
for (const [name, p, t, fov] of [...AIR, ...VIEWS, ...extra]) {
  if (want && !want.some((w) => name.startsWith(w))) continue;
  const o = new THREE.Vector3(...p), tgt = new THREE.Vector3(...t), fwd = tgt.clone().sub(o).normalize();
  const issues = [];
  // 1) çarpışma kutusu içi / yakını
  let dmin = 1e9, inBox = null;
  for (const c of C) {
    const dx = Math.max(c.min[0] - o.x, 0, o.x - c.max[0]), dy = Math.max(c.min[1] - o.y, 0, o.y - c.max[1]), dz = Math.max(c.min[2] - o.z, 0, o.z - c.max[2]);
    const d = Math.hypot(dx, dy, dz);
    if (d < dmin) dmin = d;
    if (o.x > c.min[0] - 0.1 && o.x < c.max[0] + 0.1 && o.y > c.min[1] - 0.1 && o.y < c.max[1] + 0.1 && o.z > c.min[2] - 0.1 && o.z < c.max[2] + 0.1) inBox = c;
  }
  if (inBox) issues.push(`İÇ: çarpışma kutusu ${inBox.oid} [${inBox.min.map((v) => v.toFixed(2))}]…[${inBox.max.map((v) => v.toFixed(2))}]`);
  else if (dmin < 0.3) issues.push(`YAKIN: en yakın kutu ${dmin.toFixed(2)} m`);
  // 2) kapalı katı içi: 6 eksen ışını da önce arka yüze çarpıyor
  let backs = 0;
  for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const dv = new THREE.Vector3(...d), h = hit(o, dv);
    if (h && h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(dv) > 0) backs++;
  }
  if (backs === 6) issues.push('İÇ: altı yönde de önce arka yüz (kapalı katının içinde)');
  // 3) kadrajı kapatan yakın yüzey
  const cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 1000); cam.position.copy(o); cam.lookAt(tgt); cam.updateMatrixWorld(true);
  let near = 0, n = 0, first = null;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) {
    const v = new THREE.Vector3(-0.9 + i * 0.225, -0.8 + j * 0.4, 0.5).unproject(cam).sub(o).normalize();
    const h = hit(o, v, 2.5); n++; if (h) near++;
  }
  const hf = hit(o, fwd); first = hf ? hf.distance : Infinity;
  if (near / n >= 0.3 || first < 2.0) issues.push(`KAPALI: ışınların %${Math.round(100 * near / n)}'i 2,5 m içinde bir yüzeye çarpıyor (ileri ışın ${first.toFixed(2)} m)`);
  if (issues.length) bad++;
  console.log(`${issues.length ? '✗' : '✓'} ${name.padEnd(20)} en yakın kutu ${dmin.toFixed(2)} m · ileri ışın ${Number.isFinite(first) ? first.toFixed(1) : '∞'} m · yakın ışın %${Math.round(100 * near / n)}${issues.length ? '\n    ' + issues.join('\n    ') : ''}`);
}
console.log(bad ? `sorunlu bakış ${bad}` : 'sonuç: bütün bakış noktaları açık');
process.exit(bad ? 1 : 0);
