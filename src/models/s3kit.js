import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { finish } from './weapon_util.js';

// S3 (BattleBit tarzı) silah kiti — silah laboratuvarından (src/weaponlab/kit.js) oyuna taşındı: her parça geometrisine "wf" özniteliği yazılır (x = malzeme yuvası, y = gölge çarpanı, z = desen) → tüm silah TEK ağda birleşir, kaplama (skin) yalnız uniform değişimi.
// Yuvalar: gövde / mobilya (dipçik-kabza-tutamaç) / metal (namlu, küçük çelik) / aksesuar (nişangâh, ray) / mercek / ışıyan (retikül). Desen: 0 düz, 1 benekli kabza, 2 tırtıl / oluk.
// Konvansiyon oyunla aynı: köken = tabanca kabzası, namlu -Z, yukarı +Y, sağ +X. lod=true → ayrıntı (o.d) parçaları atlanır, pah yok, silindir 6 kenar (3. şahıs ≤ 600 üçgen).
export const SL = { body: 0, furn: 1, metal: 2, acc: 3, lens: 4, glow: 5 };

export class Kit {
  constructor(lod = false) { this.lod = lod; this.lists = { main: [], mag: [], bolt: [] }; this.parts = 0; }
  _push(geo, slot, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, a = new Float32Array(n * 3), sl = typeof slot === 'string' ? SL[slot] : slot;
    for (let i = 0; i < n; i++) { a[i * 3] = sl; a[i * 3 + 1] = o.sh ?? 1; a[i * 3 + 2] = o.pat ?? 0; }
    g.setAttribute('wf', new THREE.BufferAttribute(a, 3));
    if (o.rot || o.pos) g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...(o.pos || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot || [0, 0, 0]))), new THREE.Vector3(1, 1, 1)));   // parça merkezinde döner, sonra yerine taşınır
    this.lists[o.g || 'main'].push(g); this.parts++;
    return g;
  }
  skip(o) { return o && o.d && this.lod; }
  // Kutu: o.c = pah (tüm kenarlar, dışbükey 24 nokta) · o.ax='x'|'y'|'z' → yalnız o eksene paralel 4 kenar pahlı (sekizgen prizma, 28 üçgen)
  box(size, pos, slot, o = {}) {
    if (this.skip(o)) return;
    const [w, h, d] = size, c = this.lod ? 0 : Math.min(o.c || 0, w / 2.2, h / 2.2, d / 2.2);
    let g;
    if (!c) g = new THREE.BoxGeometry(w, h, d);
    else if (o.ax) {
      const [a, b, L] = o.ax === 'z' ? [w, h, d] : o.ax === 'x' ? [d, h, w] : [w, d, h];
      g = extrudeXY(oct(a, b, c), L); g.translate(0, 0, -L / 2);
      if (o.ax === 'x') g.rotateY(Math.PI / 2); else if (o.ax === 'y') g.rotateX(Math.PI / 2);
    } else {
      const pts = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * (w / 2 - c), sy * h / 2, sz * (d / 2 - c)), new THREE.Vector3(sx * w / 2, sy * (h / 2 - c), sz * (d / 2 - c)), new THREE.Vector3(sx * (w / 2 - c), sy * (h / 2 - c), sz * d / 2));
      }
      g = new ConvexGeometry(pts);
    }
    if (o.top || o.bot) taper(g, o.top || [1, 1], o.bot || [1, 1]);
    return this._push(g, slot, { ...o, pos, rot: o.rot });
  }
  // Yan profil (z, y noktaları, dünya koordinatı) X boyunca w kalınlıkta çekilir; o.x merkez, o.c kenar pahı (silüet aynen kalır), o.holes = iç boşluk profilleri
  prof(pts, w, slot, o = {}) {
    if (this.skip(o)) return;
    const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
    for (const h of o.holes || []) if (!(this.lod && o.lodNoHoles !== false)) sh.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(-z, y))));
    const c = this.lod ? 0 : Math.min(o.c || 0, w / 2.5);
    const g = new THREE.ExtrudeGeometry(sh, { depth: w - 2 * c, bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelOffset: -c, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, -(w / 2 - c)); g.rotateY(Math.PI / 2); g.translate(o.x || 0, 0, 0);
    if (o.rot) { g.translate(0, -(o.piv?.[1] || 0), -(o.piv?.[2] || 0)); g.rotateX(o.rot[0] || 0); g.translate(0, o.piv?.[1] || 0, o.piv?.[2] || 0); }
    return this._push(g, slot, { ...o, rot: null, pos: null });
  }
  // Kesit (x, y noktaları) Z boyunca z0 → z1 çekilir (toz kapağı, tutamaç, ray kesiti); o.holes kesit boşlukları (nişangâh penceresi)
  xsec(pts, z0, z1, slot, o = {}) {
    if (this.skip(o)) return;
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of o.holes || []) if (!this.lod) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const L = Math.abs(z1 - z0), c = this.lod ? 0 : Math.min(o.c || 0, L / 2.5);
    const g = new THREE.ExtrudeGeometry(sh, { depth: L - 2 * c, bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelOffset: -c, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, Math.min(z0, z1) + c);
    return this._push(g, slot, o);
  }
  // Z ekseninde silindir (rf = namlu ucu yarıçapı); o.ax='y'|'x' döndürür; o.seg kenar sayısı
  cyl(rf, rr, len, pos, slot, o = {}) {
    if (this.skip(o)) return;
    const seg = this.lod ? Math.min(6, o.seg || 10) : o.seg || 10;
    const g = new THREE.CylinderGeometry(rr, rf, len, seg, 1, !!o.open);
    if (o.ax === 'y') { /* zaten Y */ } else if (o.ax === 'x') g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2);
    if (o.spin) g.rotateZ(o.spin);
    return this._push(g, slot, { ...o, pos });
  }
  ring(R, r, pos, slot, o = {}) {
    if (this.skip(o)) return;
    const g = new THREE.TorusGeometry(R, r, this.lod ? 3 : o.rs || 4, this.lod ? 6 : o.seg || 8);
    if (o.ax !== 'z') g.rotateY(Math.PI / 2);
    return this._push(g, slot, { ...o, pos });
  }
  // Silahı kur: ana gövde + şarjör / sürgü alt grupları, her biri tek ağ; malzeme dışarıdan (kaplama malzemesi)
  build(material, meta) {
    const g = new THREE.Group();
    const mk = (list, parent) => { if (!list.length) return null; const m = new THREE.Mesh(mergeGeometries(list, false), material); m.castShadow = m.receiveShadow = true; parent.add(m); for (const x of list) x.dispose(); return m; };
    mk(this.lists.main, g);
    let mag = null, bolt = null;
    if (this.lists.mag.length) { mag = new THREE.Group(); g.add(mag); mk(this.lists.mag, mag); }
    if (this.lists.bolt.length) { bolt = new THREE.Group(); g.add(bolt); const piv = meta.boltPivot || 0; for (const x of this.lists.bolt) x.translate(0, -piv, 0); mk(this.lists.bolt, bolt); bolt.position.y = piv; }
    finish(g, { ...meta, mag, bolt: bolt ? { g: bolt, pivot: meta.boltPivot || 0 } : undefined });
    if (meta.sight) { g.userData.sight = meta.sight; g.userData.dist = meta.dist; }
    if (mag) { g.updateMatrixWorld(true); g.userData.magPos = new THREE.Box3().setFromObject(mag).getCenter(new THREE.Vector3()); }
    let tris = 0, calls = 0; g.traverse((o) => { if (o.isMesh) { calls++; tris += o.geometry.attributes.position.count / 3; } });
    g.userData.stats = { parts: this.parts, tris: Math.round(tris), calls };
    return g;
  }
}

// sekizgen kesit (pahlı dikdörtgen) ve XY şeklinden Z'ye çekme
function oct(w, h, c) { const x = w / 2, y = h / 2; return [[x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c], [-x + c, -y]]; }
function extrudeXY(pts, L) { return new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: L, bevelEnabled: false, curveSegments: 1 }); }
function taper(g, top, bot) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const s = a.getY(i) > 0 ? top : bot; a.setX(i, a.getX(i) * s[0]); a.setZ(i, a.getZ(i) * s[1]); } g.computeVertexNormals(); }

// İkinci dereceden Bézier boyunca nokta dizisi (kavisli şarjör kenarı)
export function bez(p0, p1, p2, n) { const r = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; r.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return r; }
// Dikdörtgen yan profil (z0..z1, y0..y1)
export const rect = (z0, z1, y0, y1) => [[z0, y0], [z1, y0], [z1, y1], [z0, y1]];
// Picatinny ray: kesit + üstte yarık dişleri (n diş); y = ray tabanı, w genişlik, x merkez; side=true → yan ray (Y-Z yerine kesit X'te döner)
export function rail(k, z0, z1, y, o = {}) {
  const w = o.w || 0.022, h = o.h || 0.008, x = o.x || 0, slot = o.slot || 'acc';
  k.xsec([[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + h * 0.45], [x + w * 0.36, y + h * 0.6], [x + w * 0.36, y + h], [x - w * 0.36, y + h], [x - w * 0.36, y + h * 0.6], [x - w / 2, y + h * 0.45]], z0, z1, slot, { c: 0 });
  if (k.lod) return;
  const n = o.n || Math.max(2, Math.round(Math.abs(z1 - z0) / 0.012)), st = (z1 - z0) / n;
  for (let i = 0; i < n; i++) k.box([w * 0.74, h * 0.35, Math.abs(st) * 0.45], [x, y + h * 1.0, z0 + st * (i + 0.5)], slot, { sh: 0.55 });   // yarık: koyu dişler arası
}
// Yan ray (sağ / sol): kesit X'e doğru
export function sideRail(k, z0, z1, y, xs, o = {}) {
  const h = o.h || 0.016, t = 0.006, slot = o.slot || 'acc';
  for (const sx of xs) {
    k.box([t, h, Math.abs(z1 - z0)], [sx, y, (z0 + z1) / 2], slot, { c: 0.0015, ax: 'z' });
    if (k.lod) continue;
    const n = Math.max(2, Math.round(Math.abs(z1 - z0) / 0.013));
    for (let i = 0; i < n; i++) k.box([0.003, h * 0.6, 0.005], [sx + Math.sign(sx) * 0.003, y, z0 + ((z1 - z0) * (i + 0.5)) / n], slot, { sh: 0.5 });
  }
}
export const meta = (o) => o;
