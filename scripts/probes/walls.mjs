// Duvar boşluğu denetimi (Node): bir binanın dört dış yüzüne 5 cm aralıkla ışın atar; ışın duvar düzlemini çarpışma kutusuna
// değmeden geçerse "açıklık" bulunur. Geçen bölgelerin bağlı bileşenleri çıkarılır: en küçük boyutu < 0.3 m olanlar (ince çatlak,
// köşe/derz boşluğu) HATA'dır; kapı/pencere gibi geniş açıklıklar normal sayılır. Ayrıca yukarıdan aşağı ışınla tavan/çatı deliği taranır.
// Kullanım: node scripts/probes/walls.mjs [filtre]
import * as THREE from 'three';
import { MapBuilder, makeRng } from '../../src/maps/builder.js';
import * as K from '../../src/maps/kit.js';
import * as T from '../../src/maps/kitTown.js';
import { World } from '../../src/game/collision.js';

const filter = process.argv[2] || '';
const bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
let fail = 0, total = 0;

function audit(name, build, fp) {
  if (filter && !name.includes(filter)) return;
  total++;
  const b = new MapBuilder();
  build(b, makeRng(5));
  const world = new World(b.colliders, bounds, null);
  const { x0, x1, z0, z1, H } = fp;
  const res = 0.05;
  const o = new THREE.Vector3(), d = new THREE.Vector3();
  const issues = [];
  // 4 yön: duvar düzlemi koordinatı ve geçiş (a,y) ızgarası
  const faces = [
    { n: 'kuzey', dir: [0, 0, 1], a0: x0, a1: x1, plane: z0, org: (a, y) => [a, y, z0 - 8] },
    { n: 'güney', dir: [0, 0, -1], a0: x0, a1: x1, plane: z1, org: (a, y) => [a, y, z1 + 8] },
    { n: 'batı', dir: [1, 0, 0], a0: z0, a1: z1, plane: x0, org: (a, y) => [x0 - 8, y, a] },
    { n: 'doğu', dir: [-1, 0, 0], a0: z0, a1: z1, plane: x1, org: (a, y) => [x1 + 8, y, a] },
  ];
  for (const f of faces) {
    const na = Math.floor((f.a1 - f.a0) / res), ny = Math.floor(H / res);
    const hole = new Uint8Array(na * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < na; i++) {
      const a = f.a0 + (i + 0.5) * res, y = 0.5 * res + j * res;
      const [ox, oy, oz] = f.org(a, y);
      o.set(ox, oy, oz); d.set(...f.dir);
      const h = world.raycast(o, d, 40, {});
      // dış yüz düzleminde (t=8) çarpmıyor, daha derinde çarpıyor/hiç çarpmıyorsa açıklık
      if (!h || h.t > 8 + 0.07) hole[j * na + i] = 1;
    }
    // bağlı bileşenler
    const seen = new Uint8Array(na * ny);
    for (let s = 0; s < na * ny; s++) {
      if (!hole[s] || seen[s]) continue;
      const st = [s]; seen[s] = 1;
      let mnI = 1e9, mxI = -1, mnJ = 1e9, mxJ = -1, cnt = 0;
      while (st.length) {
        const c = st.pop(); cnt++;
        const ci = c % na, cj = (c / na) | 0;
        mnI = Math.min(mnI, ci); mxI = Math.max(mxI, ci); mnJ = Math.min(mnJ, cj); mxJ = Math.max(mxJ, cj);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = ci + di, jj = cj + dj;
          if (ii < 0 || jj < 0 || ii >= na || jj >= ny) continue;
          const nn = jj * na + ii;
          if (hole[nn] && !seen[nn]) { seen[nn] = 1; st.push(nn); }
        }
      }
      const w = (mxI - mnI + 1) * res, h = (mxJ - mnJ + 1) * res;
      // bileşen dikdörtgen değilse (L/çatlak) alan oranına da bak
      const fill = cnt * res * res / (w * h);
      if (Math.min(w, h) < 0.3 || (fill < 0.6 && Math.min(w, h) < 0.6)) {
        issues.push(`${f.n}: a=${(f.a0 + mnI * res).toFixed(2)}…${(f.a0 + (mxI + 1) * res).toFixed(2)} y=${(mnJ * res).toFixed(2)}…${((mxJ + 1) * res).toFixed(2)} (${w.toFixed(2)}×${h.toFixed(2)})`);
      }
    }
  }
  // tavan/çatı: yukarıdan aşağı
  let roofHoles = 0; const hp = [];
  for (let z = z0 + 0.2; z < z1 - 0.2; z += 0.25) for (let x = x0 + 0.2; x < x1 - 0.2; x += 0.25) {
    o.set(x, H + 6, z); d.set(0, -1, 0);
    const h = world.raycast(o, d, 40, {});
    if (!h || h.point.y < H - 0.6) { roofHoles++; if (hp.length < 3) hp.push(`(${x.toFixed(1)},${z.toFixed(1)})`); }
  }
  const bad = issues.length > 0;
  if (bad) fail++;
  console.log((bad ? 'HATA ' : 'OK   ') + name.padEnd(18) + (bad ? ' ' + issues.slice(0, 6).join(' | ') + (issues.length > 6 ? ` … (+${issues.length - 6})` : '') : ' çatlak yok') + `  [tavan/çatı açık hücre: ${roofHoles}${roofHoles ? ' ' + hp.join(' ') : ''}]`);
}

const HOUSES = [
  ['ev-1kat', { w: 9, d: 8, floors: 1 }],
  ['ev-2kat', { w: 10, d: 9, floors: 2 }],
  ['ev-duz-3kat', { w: 12, d: 9, floors: 3, flat: true, roofAccess: true }],
  ['dukkan', { w: 14, d: 10, floors: 2, theme: 'shop', flat: true, roofAccess: true }],
  ['kulube', { w: 6.5, d: 5.5, floors: 1 }],
  ['okul', { w: 11, d: 9, floors: 2, theme: 'school', flat: true }],
  ['bos-kabuk', { w: 9, d: 8, floors: 1, furnishing: false }],
];
for (const [name, c] of HOUSES) {
  const f = (c.floors || 1) * 3.1;
  audit(name, (b, rng) => K.house(b, rng, { x: 0, z: 0, ...c }), { x0: -c.w / 2 - 0.15, x1: c.w / 2 + 0.15, z0: -c.d / 2 - 0.15, z1: c.d / 2 + 0.15, H: f - 0.4 });
}
audit('ambar', (b, rng) => K.barn(b, rng, { x: 0, z: 0, w: 12, d: 18 }), { x0: -6.15, x1: 6.15, z0: -9.15, z1: 9.15, H: 4.8 });
audit('ambar-küçük', (b, rng) => K.barn(b, rng, { x: 0, z: 0, w: 10, d: 14 }), { x0: -5.15, x1: 5.15, z0: -7.15, z1: 7.15, H: 4.8 });
audit('depo', (b, rng) => K.warehouse(b, rng, { x: 0, z: 0 }), { x0: -11.175, x1: 11.175, z0: -7.175, z1: 7.175, H: 6.6 });
audit('kilise-nef', (b, rng) => K.church(b, rng, { x: 0, z: 0, w: 9, d: 14 }), { x0: -4.7, x1: 4.7, z0: -7.2, z1: 7.2, H: 5.0 });
audit('kilise-kule', (b, rng) => K.church(b, rng, { x: 0, z: 0, w: 9, d: 14 }), { x0: -3.4, x1: 3.4, z0: -13.9, z1: -7.8, H: 7.0 });
audit('benzinlik-market', (b, rng) => K.gasStation(b, rng, { x: 0, z: 0, store: 'n' }), { x0: -6.15, x1: 6.15, z0: -12.9, z1: -6.2, H: 2.7 });
if (process.argv.includes('--selftest')) {
  // yöntem doğrulaması: iki duvar arasında kasıtlı 10 cm çatlak — HATA vermeli
  audit('selftest-catlak', (b) => { b.box(-2.55, 0, 0, 4.9, 3, 0.3, '#888'); b.box(2.55, 0, 0, 4.9, 3, 0.3, '#888'); }, { x0: -5, x1: 5, z0: -0.15, z1: 0.15, H: 3 });
}
console.log(fail ? `\n${fail}/${total} yapıda çatlak` : `\n${total}/${total} yapıda çatlak yok`);
process.exit(fail ? 1 : 0);
