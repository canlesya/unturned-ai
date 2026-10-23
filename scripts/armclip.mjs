// Kol ↔ silah iç içe geçme denetimi (tarayıcısız, node, 12.124): birinci şahıs kutu ellerin kol kutusu (gömlek 0,11×0,11×0,5) belde / geçişte / tam nişanda silah yüzeyine kaç mm giriyor?
//   node scripts/armclip.mjs [silah regex]    LIMIT=5 (mm) · T=0,0.5,1 (adsT) · ALL=1 (tüm nişangâhlar; yoksa demir + ilk optik) · V=1 (en derin noktanın yeri)
// Yöntem: silah üçgenleri ~2,5 mm ızgarayla örneklenir (yalnız kutunun sınır kutusuna değen üçgenler), her nokta kolun yönlü kutusuna (OBB) dönüştürülür; içerideyse derinlik = en yakın yüze uzaklık.
// Eldiven kutusu kabzayı / kundağı TUTAR (iç içe olması tasarım gereği, sayılmaz); kol kutusu (gömlek) için silahın her yüzeyi sayılır (dipçik, kabza ucu, şarjör, gövde). Ölçüler silah yerelinde (VM_SCALE öncesi, m) → mm. Cam / namlu alevi / gizli parçalar sayılmaz.
import * as THREE from 'three';
import { WSTATS, OPTIC_ALLOWED } from '../src/game/stats.js';

const only = process.argv[2] ? new RegExp(process.argv[2]) : null, LIMIT = +(process.env.LIMIT || 5), STEP = 0.0025;
const TS = (process.env.T || '0,0.5,1').split(',').map(Number);
const { ViewModel } = await import(process.env.VM || '../src/game/player.js');      // VM=../src/game/player_eski.js → eski sürümle karşılaştırma
const vm = new ViewModel({ scene: { environment: null }, time: 0 });
const fake = (id, t) => ({ stat: WSTATS[id], adsT: t, ads: t > 0.5, vel: new THREE.Vector3(), onGround: true, sprinting: false, reloadT: 0, useT: 0, swing: null, overlay: 'none', leanT: 0, reloadTotal: 1, reloadStyle: 'mag', reloadEmpty: false });
const inv = new THREE.Matrix4(), m = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), q = new THREE.Vector3();

// Silah üçgenleri (model g yerelinde)
function weaponTris(g, w) {
  const tris = [];
  inv.copy(g.matrixWorld).invert();
  w.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    const mt = o.material; if (mt && (mt.userData?.glass || mt.blending === THREE.AdditiveBlending || (mt.transparent && mt.opacity < 0.5))) return;
    for (let p = o; p && p !== g; p = p.parent) if (!p.visible) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      tris.push([a.fromBufferAttribute(pos, ia).applyMatrix4(m).toArray(), b.fromBufferAttribute(pos, ib).applyMatrix4(m).toArray(), c.fromBufferAttribute(pos, ic).applyMatrix4(m).toArray()]);
    }
  });
  return tris;
}
// Kol kutuları (g yerelinde OBB): { name, toBox (g → kutu yereli), h (yarı boy), bb (sınır kutusu) }
function armBoxes(g, vm) {
  const out = [];
  inv.copy(g.matrixWorld).invert();
  for (const [nm, grp] of [['sağ', vm.handR], ['sol', vm.handL]]) {
    if (!grp || !grp.visible) continue;
    for (const mesh of grp.children) {
      if (!mesh.isMesh || !mesh.visible || mesh !== grp.userData.sleeve) continue;                    // yalnız kol kutusu (eldiven kabzayı / kundağı tutar: iç içe olması tasarım gereği)
      const P = mesh.geometry.parameters, h = [P.width / 2, P.height / 2, P.depth / 2], sleeve = mesh === grp.userData.sleeve;
      const toG = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld), toBox = toG.clone().invert();
      const bb = new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).applyMatrix4(toG);
      out.push({ name: `${nm} kol`, sleeve, toBox, h, bb });
    }
  }
  return out;
}
function penetration(tris, boxes) {
  const res = boxes.map(() => ({ d: 0, at: null }));
  const tb = new THREE.Box3();
  for (const [A, B, C] of tris) {
    tb.makeEmpty(); tb.expandByPoint(a.fromArray(A)); tb.expandByPoint(a.fromArray(B)); tb.expandByPoint(a.fromArray(C));
    boxes.forEach((bx, k) => {
      if (!tb.intersectsBox(bx.bb)) return;
      const L = Math.max(Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]), Math.hypot(C[0] - B[0], C[1] - B[1], C[2] - B[2]));
      const n = Math.max(1, Math.ceil(L / STEP));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, wv = 1 - u - v;
        q.set(A[0] * wv + B[0] * u + C[0] * v, A[1] * wv + B[1] * u + C[1] * v, A[2] * wv + B[2] * u + C[2] * v);
        const gy = q.y, gz = q.z, gx = q.x;
        q.applyMatrix4(bx.toBox);
        const dx = bx.h[0] - Math.abs(q.x), dy = bx.h[1] - Math.abs(q.y), dz = bx.h[2] - Math.abs(q.z);
        if (dx > 0 && dy > 0 && dz > 0) { const d = Math.min(dx, dy, dz); if (d > res[k].d) res[k] = { d, at: [gx, gy, gz] }; }
      }
    });
  }
  return res;
}

export function measure(vm, id, optic, t) {
  vm.setItem(id, 'blue', WSTATS[id].kind, optic); vm.raise = 0; vm.noSway = true;
  const p = { s: fake(id, t), lookDX: 0, lookDY: 0, touch: false };
  for (let i = 0; i < 90; i++) vm.update(1 / 60, p);
  vm.scene.updateMatrixWorld(true);
  const g = vm.model, boxes = armBoxes(g, vm), r = penetration(weaponTris(g, g.children[0]), boxes);
  return boxes.map((bx, k) => ({ n: bx.name, sleeve: bx.sleeve, d: r[k].d * 1000, at: r[k].at }));
}
export { vm };
if (process.argv[1]?.endsWith('armclip.mjs')) {
  const rows = []; let bad = 0;
  for (const [id, st] of Object.entries(WSTATS)) {
    if ((st.kind !== 'gun' && st.kind !== 'launcher') || st.ball || (only && !only.test(id))) continue;
    const ops = OPTIC_ALLOWED[id] || ['iron'], list = process.env.ALL ? ops : [...new Set([ops[0], ops.find((o) => o !== 'iron') || ops[0]])];
    for (const optic of list) {
      const row = { id, optic }; let worst = 0;
      for (const t of TS) {
        const parts = measure(vm, id, optic, t), sl = parts.filter((x) => x.sleeve && x.d > 0.05).sort((x, y) => y.d - x.d);
        const mx = sl[0]?.d || 0; worst = Math.max(worst, mx);
        row[`kol t${t}`] = mx ? `${mx.toFixed(1)} (${sl[0].n})` : '0';
        if (process.env.V && mx > LIMIT) console.log(id, optic, t, sl.map((x) => `${x.n} ${x.d.toFixed(1)}mm @ ${x.at.map((v) => v.toFixed(3)).join(',')}`).join(' | '));
      }
      row['kol mm'] = +worst.toFixed(1); row.durum = worst <= LIMIT ? 'ok' : 'GİRİYOR';
      if (worst > LIMIT) bad++;
      rows.push(row);
    }
  }
  console.table(rows);
  console.log(`${rows.length} kombinasyon, kol kutusu ${LIMIT} mm üstü giren: ${bad}`);
  if (process.env.JSON) (await import('fs')).writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
  process.exit(bad ? 1 : 0);
}
