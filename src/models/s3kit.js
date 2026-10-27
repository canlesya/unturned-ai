import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { finish } from './weapon_util.js';

// S3 (BattleBit tarzı) silah kiti — silah laboratuvarından (src/weaponlab/kit.js) oyuna taşındı: her parça geometrisine "wf" özniteliği yazılır (x = malzeme yuvası, y = gölge çarpanı, z = desen) → tüm silah TEK ağda birleşir, kaplama (skin) yalnız uniform değişimi.
// Yuvalar: gövde / mobilya (dipçik-kabza-tutamaç) / metal (namlu, küçük çelik) / aksesuar (nişangâh, ray) / mercek / ışıyan (retikül). Desen: 0 düz, 1 benekli kabza, 2 tırtıl / oluk.
// Konvansiyon oyunla aynı: köken = tabanca kabzası, namlu -Z, yukarı +Y, sağ +X. lod=true → ayrıntı (o.d) parçaları atlanır, pah yok, silindir 6 kenar (3. şahıs ≤ 600 üçgen).
const _gb = new THREE.Vector3(), _gc = new THREE.Vector3();
export const SL = { body: 0, furn: 1, metal: 2, acc: 3, lens: 4, glow: 5 };

export class Kit {
  constructor(lod = false) { this.lod = lod; this.lists = { main: [], mag: [], bolt: [], slide: [] }; this.parts = 0; this.grp = null; }      // grp: varsayılan alt grup (12.141: tabanca sürgüsü 'slide'; 3. şahısta (lod) ana ağa katılır)
  _push(geo, slot, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, a = new Float32Array(n * 3), sl = typeof slot === 'string' ? SL[slot] : slot;
    for (let i = 0; i < n; i++) { a[i * 3] = sl; a[i * 3 + 1] = o.sh ?? 1; a[i * 3 + 2] = o.pat ?? 0; }
    g.setAttribute('wf', new THREE.BufferAttribute(a, 3));
    if (o.rot || o.pos) g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...(o.pos || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot || [0, 0, 0]))), new THREE.Vector3(1, 1, 1)));   // parça merkezinde döner, sonra yerine taşınır
    if (o.cap) g.userData.cap = 1;      // 12.129: splitLens ±Z kapaklarını silmesin (mercekle aynı düzlemdeki ince göz çanı halkası)
    this.lists[o.g || (!this.lod && this.grp) || 'main'].push(g); this.parts++;
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
  // 12.194 Bileylenmiş ağız (kenar şeridi yerine gerçek "bileme yüzü"): T = gövdenin alt sınırı ([z, y], x = ±w/2), E = keskin kenar ([z, y], x = 0), eşit uzunlukta.
  // İki eğik yüz kenarda tek çizgide birleşir → eskiden ağız şeridinin dışa bakan 6,5 mm'lik dik duvarı yoktu, sıyırarak bakınca 1–2 piksellik parlak metal çizgisi titriyordu.
  // caps: [baş, son] kapak üçgenleri (T ile E aynı noktada bitiyorsa kapak yok). tip: [z, y] verilirse son çift ucun tek noktasına (x = 0) daralır.
  grind(T, E, w, slot, o = {}) {
    if (this.skip(o)) return;
    const h = w / 2, P = [], push = (a, b, c, ex) => {                              // ex: beklenen dış yön (sargı yönü buna göre)
      const n = _gb.subVectors(b, a).cross(_gc.subVectors(c, a));
      if (n.dot(ex) < 0) P.push(a, c, b); else P.push(a, b, c);
    };
    const V3 = (x, [z, y]) => new THREE.Vector3(x, y, z);
    for (let i = 0; i < T.length - 1; i++) for (const sx of [1, -1]) {
      const a = V3(sx * h, T[i]), b = V3(sx * h, T[i + 1]), c = V3(0, E[i + 1]), d = V3(0, E[i]);
      const ex = new THREE.Vector3(sx, E[i][1] - T[i][1] + E[i + 1][1] - T[i + 1][1], E[i][0] - T[i][0] + E[i + 1][0] - T[i + 1][0]).normalize();   // dışa + kenara doğru
      push(a, b, c, ex); push(a, c, d, ex);
    }
    if (o.tip) {
      const L = T.length - 1, t = V3(0, o.tip), ax = new THREE.Vector3(0, o.tip[1] - T[L][1], o.tip[0] - T[L][0]).normalize();
      for (const sx of [1, -1]) push(V3(sx * h, T[L]), t, V3(0, E[L]), new THREE.Vector3(sx, 0, 0).addScaledVector(ax, 0.3));
    }
    const caps = o.caps || [true, !o.tip];
    for (const [i, j] of [[0, 1], [T.length - 1, T.length - 2]]) {
      if (!caps[i === 0 ? 0 : 1]) continue;
      const ex = new THREE.Vector3(0, 0, Math.sign(T[i][0] - T[j][0]) || 1);
      push(V3(h, T[i]), V3(-h, T[i]), V3(0, E[i]), ex);
    }
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap((v) => [v.x, v.y, v.z]), 3));
    g.computeVertexNormals();
    return this._push(g, slot, { ...o, rot: null, pos: null });
  }
  // 12.194 Bıçak gövdesi (yassı yanlar + sırt) ucunda x = 0'a daralır: S = sırt ([z, y], dipten uca), G = bileme çizgisi (grind'in T'si), tip = uç ([z, y], x = 0).
  // Yanlar S + tip + ters G çokgeni (uca değen üçgenler eğik → sivri uç; eskiden 6,5 mm küt uç), sırt duvarı S boyunca, dip kapağı siperin içinde.
  bladeBody(S, G, tip, w, slot, o = {}) {
    if (this.skip(o)) return;
    const h = w / 2, P = [], V3 = (x, [z, y]) => new THREE.Vector3(x, y, z);
    const push = (a, b, c, ex) => { const n = _gb.subVectors(b, a).cross(_gc.subVectors(c, a)); if (n.dot(ex) < 0) P.push(a, c, b); else P.push(a, b, c); };
    const poly = [...S, tip, ...G.slice().reverse()], isTip = (i) => i === S.length;
    const tri = THREE.ShapeUtils.triangulateShape(poly.map(([z, y]) => new THREE.Vector2(z, y)), []);
    for (const sx of [1, -1]) for (const [a, b, c] of tri) push(V3(isTip(a) ? 0 : sx * h, poly[a]), V3(isTip(b) ? 0 : sx * h, poly[b]), V3(isTip(c) ? 0 : sx * h, poly[c]), new THREE.Vector3(sx, 0, 0));
    const sp = [...S, tip];
    let A2 = 0; for (let i = 0; i < poly.length; i++) { const [z0, y0] = poly[i], [z1, y1] = poly[(i + 1) % poly.length]; A2 += z0 * y1 - z1 * y0; }      // çokgen yönü (z, y düzleminde)
    for (let i = 0; i < sp.length - 1; i++) {                                         // sırt duvarı (dış yön: çokgenin dışına bakan dikme)
      const [z0, y0] = sp[i], [z1, y1] = sp[i + 1], sg = A2 > 0 ? 1 : -1, ex = new THREE.Vector3(0, -(z1 - z0) * sg, (y1 - y0) * sg).normalize();
      if (i === sp.length - 2) push(V3(h, sp[i]), V3(-h, sp[i]), V3(0, sp[i + 1]), ex);
      else { push(V3(h, sp[i]), V3(-h, sp[i]), V3(-h, sp[i + 1]), ex); push(V3(h, sp[i]), V3(-h, sp[i + 1]), V3(h, sp[i + 1]), ex); }
    }
    const ex0 = new THREE.Vector3(0, 0, Math.sign(S[0][0] - tip[0]));                 // dip kapağı (S0 – G0 arası)
    push(V3(h, S[0]), V3(-h, S[0]), V3(-h, G[0]), ex0); push(V3(h, S[0]), V3(-h, G[0]), V3(h, G[0]), ex0);
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap((v) => [v.x, v.y, v.z]), 3));
    g.computeVertexNormals();
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
    const lens = this.lod ? null : splitLens(this);
    mk(this.lists.main, g);
    if (lens) { const m = new THREE.Mesh(lens, LENS_MAT); m.renderOrder = 2; m.userData.lens = true; g.add(m); }      // mercekler: ayrı saydam ağ (yalnız birinci şahıs / vitrin)
    let mag = null, bolt = null;
    if (this.lists.mag.length) { mag = new THREE.Group(); g.add(mag); mk(this.lists.mag, mag); }
    if (this.lists.bolt.length) { bolt = new THREE.Group(); g.add(bolt); const piv = meta.boltPivot || 0; for (const x of this.lists.bolt) x.translate(0, -piv, 0); mk(this.lists.bolt, bolt); bolt.position.y = piv; }
    // 12.141: tabanca sürgüsü (geri-ileri kayar) / revolver silindiri (namlu ekseninde döner, pivot = eksen yüksekliği): yalnız birinci şahıs (lod'da ana ağda)
    let slide = null;
    if (this.lists.slide.length) {
      const sg = new THREE.Group(); g.add(sg); const piv = meta.slideKind === 'cyl' ? meta.slidePivot || 0 : 0;
      for (const x of this.lists.slide) x.translate(0, -piv, 0);
      mk(this.lists.slide, sg); sg.position.y = piv;
      slide = { g: sg, kind: meta.slideKind || 'slide', pivot: piv, travel: meta.slideTravel ?? 0.026 };
    }
    finish(g, { ...meta, mag, bolt: bolt ? { g: bolt, pivot: meta.boltPivot || 0 } : undefined, slide: slide || undefined });
    if (meta.sight) { g.userData.sight = meta.sight; g.userData.dist = meta.dist; }
    if (mag) { g.updateMatrixWorld(true); g.userData.magPos = new THREE.Box3().setFromObject(mag).getCenter(new THREE.Vector3()); }
    let tris = 0, calls = 0; g.traverse((o) => { if (o.isMesh) { calls++; tris += o.geometry.attributes.position.count / 3; } });
    g.userData.stats = { parts: this.parts, tris: Math.round(tris), calls };
    return g;
  }
}

// Mercek camı (12.123): eskiden mercek yuvası opak koyu renkti → dürbün / ACOG'a girerken ekranda kara disk. Artık loş saydam cam; HUD dürbünü (#scopeblk kararması) devralır
export const LENS_MAT = new THREE.MeshStandardMaterial({ color: '#8fb8d0', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.3, depthWrite: false });
LENS_MAT.userData.glass = true;
// Mercek parçalarını ana listeden ayırır; aynı eksendeki tüp parçalarının (gövde / çan / koni) ±Z kapaklarını mercekler arasında siler → camın arkası koyu kapak değil, açık tüp
// Kural parça başına: kutu merkezi mercek ekseninde (±3 mm), yarıçapı ≤ en büyük mercek × 1,2, Z aralığı merceklerin arası. Diğer silah dosyaları da (s3rifles vb.) otomatik yararlanır
function splitLens(k) {
  const list = k.lists.main;
  const isSlot = (g, s) => Math.round(g.attributes.wf.array[0]) === s, bb = new THREE.Box3();
  const lens = list.filter((g) => isSlot(g, SL.lens));
  if (!lens.length) return null;
  const groups = [];
  for (const g of lens) {
    bb.setFromBufferAttribute(g.attributes.position);
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, r = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) / 2;
    let gr = groups.find((q) => Math.abs(q.cx - cx) < 0.003 && Math.abs(q.cy - cy) < 0.003);
    if (!gr) groups.push(gr = { cx, cy, r: 0, z0: Infinity, z1: -Infinity });
    gr.r = Math.max(gr.r, r); gr.z0 = Math.min(gr.z0, bb.min.z - 0.004); gr.z1 = Math.max(gr.z1, bb.max.z + 0.004);
    gr.ls = (gr.ls || []).concat([[(bb.min.z + bb.max.z) / 2, r]]);
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = list.length - 1; i >= 0; i--) {
    const g = list[i];
    if (isSlot(g, SL.lens)) { list.splice(i, 1); continue; }
    if (isSlot(g, SL.glow) || g.userData.cap) continue;
    bb.setFromBufferAttribute(g.attributes.position);
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, r = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) / 2;
    const gr = groups.find((q) => Math.abs(q.cx - cx) < 0.003 && Math.abs(q.cy - cy) < 0.003 && r <= q.r * 1.2 && bb.max.z > q.z0 && bb.min.z < q.z1);
    if (!gr) continue;
    gr.minR = Math.min(gr.minR ?? Infinity, r);
    const P = g.attributes.position, keep = [];
    for (let t = 0; t < P.count; t += 3) {
      a.fromBufferAttribute(P, t); b.fromBufferAttribute(P, t + 1); c.fromBufferAttribute(P, t + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize(), z = (a.z + b.z + c.z) / 3;
      if (!(Math.abs(n.z) > 0.95 && z > gr.z0 && z < gr.z1)) keep.push(t);
    }
    if (keep.length * 3 === P.count) continue;
    const ng = new THREE.BufferGeometry();
    for (const k of Object.keys(g.attributes)) { const src = g.attributes[k], sz = src.itemSize, arr = new Float32Array(keep.length * 3 * sz); keep.forEach((t, j) => arr.set(src.array.subarray(t * sz, (t + 3) * sz), j * 3 * sz)); ng.setAttribute(k, new THREE.BufferAttribute(arr, sz)); }
    g.dispose(); list[i] = ng;
  }
  // tüp içi (ters yüzlü koyu silindir, mercekten merceğe): cam arkasında dış kabuğun arka yüzleri / kuleler görünmesin, içeriden bakınca karanlık tünel + ön mercekten dünya
  for (const gr of groups) {
    if (gr.ls.length < 2) continue;
    gr.ls.sort((p, q) => p[0] - q[0]);
    const zf = gr.ls[0][0], zb = gr.ls[gr.ls.length - 1][0], L = zb - zf, R = Math.min(gr.minR ?? Infinity, ...gr.ls.map((x) => x[1])) * 0.97;      // en dar tüp / mercek: dış kabuğun içinde kalır (yandan taşmaz)
    const t = new THREE.CylinderGeometry(R, R, L, 12, 1, true).toNonIndexed(); t.deleteAttribute('normal'); t.deleteAttribute('uv');
    const P = t.attributes.position.array;
    for (let i = 0; i < P.length; i += 9) for (let j = 0; j < 3; j++) { const q = P[i + 3 + j]; P[i + 3 + j] = P[i + 6 + j]; P[i + 6 + j] = q; }      // sarım ters → yüzler içe bakar
    t.computeVertexNormals(); t.rotateX(Math.PI / 2); t.translate(gr.cx, gr.cy, (zf + zb) / 2);
    k._push(t, 'acc', { sh: 0.35 });
  }
  const out = mergeGeometries(lens, false); for (const g of lens) g.dispose();
  out.deleteAttribute('wf');
  return out;
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
