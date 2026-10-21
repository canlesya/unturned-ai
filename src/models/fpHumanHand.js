import * as THREE from 'three';

// İnsan eli (birinci şahıs, eldivenli): YUMUŞAK gölgeli, indeksli ağ. Parmaklar boğum boğum ayrı blok değil, eklemlerde hafif şişen
// kesintisiz konik tüpler (10 kenar, yuvarlak uç); kalın, yuvarlatılmış avuç + başparmak kası; bilekten ön kola kesintisiz tüp
// (bilek bükümü yumuşak eğriyle); kumaş eldiven: koyu sırt, biraz açık avuç içi, boğum hattında ince dikiş tonu.
// Çerçeve (c, sağ el) fpHands.js ile aynı: orijin sap merkezi, sap Z (işaret +Z), avuç +X tarafı, el sırtı +X, bilek → boğum +Y.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let MAT = null;
export const humanMat = () => (MAT ||= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.93, metalness: 0 }));

export class Mesh {
  constructor() { this.p = []; this.c = []; this.i = []; }
  // halka: c merkez, t teğet, up kalınlık yönü; w genişlik, h kalınlık; col(v: halka yönü birim vektör) → [r,g,b]; sq < 1 köşeli-yuvarlak kesit
  ring(c, t, up, w, h, col, n, sq = 1) {
    const e2 = up.clone().addScaledVector(t, -up.dot(t)); if (e2.lengthSq() < 1e-9) e2.set(1, 0, 0).addScaledVector(t, -t.x); e2.normalize();
    const e1 = new THREE.Vector3().crossVectors(e2, t);
    const s = this.p.length / 3, d = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const x = Math.sign(ca) * Math.abs(ca) ** sq, y = Math.sign(sa) * Math.abs(sa) ** sq;
      d.copy(e1).multiplyScalar(x).addScaledVector(e2, y);
      this.p.push(c.x + e1.x * x * w * 0.5 + e2.x * y * h * 0.5, c.y + e1.y * x * w * 0.5 + e2.y * y * h * 0.5, c.z + e1.z * x * w * 0.5 + e2.z * y * h * 0.5);
      this.c.push(...col(d.normalize()));
    }
    return s;
  }
  vert(p, rgb) { this.p.push(p.x, p.y, p.z); this.c.push(...rgb); return this.p.length / 3 - 1; }
  join(a, b, n) { for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; this.i.push(a + k, a + k1, b + k1, a + k, b + k1, b + k); } }
  capEnd(a, tip, n) { for (let k = 0; k < n; k++) this.i.push(a + k, a + ((k + 1) % n), tip); }
  capStart(a, tip, n) { for (let k = 0; k < n; k++) this.i.push(a + ((k + 1) % n), a + k, tip); }
  // Kesintisiz tüp: pts noktaları, ws/hs her noktada genişlik/kalınlık, ups her noktada kalınlık yönü; uçlar yuvarlak kapaklı
  tube(pts, ws, hs, ups, col, n = 10, o = {}) {
    const N = pts.length, T = [];
    for (let j = 0; j < N; j++) {
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(N - 1, j + 1)];
      T.push(b.clone().sub(a).normalize());
    }
    const rings = pts.map((p, j) => this.ring(p, T[j], ups[j], ws[j], hs[j], col, n, o.sq ?? 1));
    for (let j = 0; j < N - 1; j++) this.join(rings[j], rings[j + 1], n);
    const capAt = (j, dir, start) => {                       // yuvarlak kapak: iki küçülen halka + uç
      let r = rings[j];
      const ex = Math.min(ws[j], hs[j]) * 0.5 * (o.round ?? 1);
      for (const [k, f] of [[0.55, 0.78], [0.9, 0.42]]) {
        const c = pts[j].clone().addScaledVector(dir, ex * k), r2 = this.ring(c, T[j], ups[j], ws[j] * f, hs[j] * f, col, n, o.sq ?? 1);
        if (start) this.join(r2, r, n); else this.join(r, r2, n);
        r = r2;
      }
      const tip = this.vert(pts[j].clone().addScaledVector(dir, ex), col(dir.clone()));
      if (start) this.capStart(r, tip, n); else this.capEnd(r, tip, n);
    };
    if (o.capA !== false) capAt(0, T[0].clone().negate(), true);
    if (o.capB !== false) capAt(N - 1, T[N - 1].clone(), false);
  }
  // elipsoid kas / yastık (enlem-boylam, yumuşak)
  blob(c, ax, ay, az, col, nu = 10, nv = 6) {
    const s = this.p.length / 3, d = new THREE.Vector3();
    for (let v = 0; v <= nv; v++) for (let u = 0; u < nu; u++) {
      const th = (v / nv) * Math.PI, ph = (u / nu) * Math.PI * 2;
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      const p = c.clone().addScaledVector(ax, x).addScaledVector(ay, y).addScaledVector(az, z);
      d.copy(ax).normalize().multiplyScalar(x).addScaledVector(ay.clone().normalize(), y).addScaledVector(az.clone().normalize(), z);
      this.p.push(p.x, p.y, p.z); this.c.push(...col(d.normalize()));
    }
    for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
      const a = s + v * nu + u, b = s + v * nu + ((u + 1) % nu), c2 = a + nu, d2 = b + nu;
      this.i.push(a, b, c2, b, d2, c2);                                   // dışa bakan sarım (eskiden ters: kas yastıkları arka yüz olarak görünmüyordu)
    }
  }
}

const KZ = [0.028, 0.0095, -0.0095, -0.027], KY = [0.012, 0.016, 0.012, 0.005];
const LENS = [[0.043, 0.026, 0.022], [0.048, 0.03, 0.023], [0.045, 0.028, 0.022], [0.035, 0.022, 0.019]];
const rgb = (hex, k = 1) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k]; };

// Bir poz için ağ (c çerçevesi). o.armC: bilekten dirseğe yön (c), o.split: kol ayrı (yalnız bileklik)
function buildHuman(M, o, pose) {
  const S = o.colors, back = rgb(S.glove), palm = rgb(S.palm);
  const DOR = V(1, 0, 0);
  const gcol = (d) => (d.x < -0.25 ? palm : back);              // avuç içi (−X yönündeki yüzler) biraz açık deri
  // avuç: yuvarlatılmış kalın blok (köşeli-yuvarlak kesit), bilekten boğumlara
  const P0 = V(0.034, -0.07, 0.0), P1 = V(0.033, 0.0, 0.0), P2 = V(0.031, 0.016, 0.0);
  M.tube([P0, P1, P2], [0.072, 0.086, 0.082], [0.04, 0.036, 0.03], [DOR, DOR, DOR], gcol, 14, { sq: 0.7, round: 0.6 });
  M.blob(V(0.046, 0.006, 0.0), V(0.006, 0, 0), V(0, 0.011, 0), V(0, 0, 0.041), gcol, 10, 5);        // el sırtı boğum hattı: tek yumuşak kabarıklık (ayrı blok değil)
  // başparmak kası (avuç içi, işaret tarafı alt) + serçe tarafı yastığı
  M.blob(V(0.022, -0.04, 0.026), V(0.017, 0, 0), V(0, 0.03, 0.004), V(0, -0.004, 0.019), (d) => (d.x < -0.2 ? palm : back), 10, 6);
  M.blob(V(0.027, -0.045, -0.026), V(0.01, 0, 0), V(0, 0.024, 0), V(0, 0, 0.011), (d) => (d.x < -0.2 ? palm : back), 8, 5);
  // parmaklar: boğumdan (avuç içinden başlayarak) kesintisiz tüp
  const q = new THREE.Quaternion();
  for (let i = 0; i < 4; i++) {
    const [spread, ...curls] = pose.f[i], L = LENS[i];
    let dir = V(0, Math.cos(spread), Math.sin(spread)), dor = DOR.clone();
    let p = V(0.031, KY[i] + KZ[i] * (pose.sl || 0), KZ[i]);                      // sl: boğum hattı eğimi (çapraz tutulan sap: işaret ileride, serçe bileğe yakın)
    const pts = [p.clone().addScaledVector(dir, -0.016)], ups = [dor.clone()], ws = [], hs = [];
    const W0 = i === 3 ? 0.0188 : 0.0214, H0 = i === 3 ? 0.0172 : 0.0194;      // eldivenli parmaklar dolgun, yan yana değer
    pts.push(p.clone()); ups.push(dor.clone());
    for (let j = 0; j < 3; j++) {
      const ax = new THREE.Vector3().crossVectors(dir, dor).normalize();
      q.setFromAxisAngle(ax, -curls[j]); dir.applyQuaternion(q); dor.applyQuaternion(q);
      const e = p.clone().addScaledVector(dir, L[j]);
      pts.push(p.clone().addScaledVector(dir, L[j] * 0.5)); ups.push(dor.clone());   // boğum ortası (biraz ince)
      pts.push(e); ups.push(dor.clone());
      p = e;
    }
    // genişlikler: taban, boğum, (orta, eklem) × 3 → uca doğru incelir, eklemlerde hafif şişer
    const k = [1.0, 1.04, 0.95, 1.0, 0.9, 0.93, 0.84, 0.8];
    for (const f of k) { ws.push(W0 * f); hs.push(H0 * f); }
    M.tube(pts, ws, hs, ups, gcol, 10, { capA: false, round: 0.9 });
  }
  // başparmak: kas içinden çıkan, üç noktalı yuvarlak tüp
  const t = pose.t, tp = [t[0].clone().lerp(t[1], -0.3), t[0], t[1], t[1].clone().lerp(t[2], 0.5), t[2], t[2].clone().lerp(t[3], 0.5), t[3]];
  const tw = [0.026, 0.025, 0.022, 0.02, 0.0205, 0.0185, 0.0175];
  const tu = tp.map(() => V(0.6, 0.0, -0.8).normalize());
  M.tube(tp, tw, tw.map((x) => x * 0.88), tu, gcol, 10, { capA: false, round: 0.9 });
  // bilek → ön kol: avucun altından kesintisiz; ilk 6 cm'de el ekseninden kol yönüne yumuşak dönüş (bükülme açısı kol yönüyle sınırlı)
  const down = V(0, -1, 0), ar = o.armC.clone().normalize();
  const W = V(0.034, -0.082, 0.0);
  const B1 = W.clone().addScaledVector(down, 0.028), B2 = B1.clone().addScaledVector(ar, 0.034);        // bilek eğrisi (ikinci derece Bezier)
  const cp = (d) => {
    if (d <= 0) return W.clone().addScaledVector(down, d);
    if (d >= 0.06) return B2.clone().addScaledVector(ar, d - 0.06);
    const t = d / 0.06; return W.clone().multiplyScalar((1 - t) ** 2).addScaledVector(B1, 2 * t * (1 - t)).addScaledVector(B2, t * t);
  };
  const cuff = rgb(S.cuff), strap = rgb(S.strap);
  const ds = [-0.016, 0.0, 0.018, 0.032, 0.05, 0.062];
  M.tube(ds.map(cp), [0.066, 0.062, 0.06, 0.062, 0.064, 0.064], [0.044, 0.042, 0.042, 0.044, 0.047, 0.047], ds.map(() => DOR), () => cuff, 12, { capA: false, capB: o.split ? true : false, sq: 0.8 });
  M.tube([cp(0.016), cp(0.03)], [0.0645, 0.0655], [0.0445, 0.0455], [DOR, DOR], () => strap, 12, { capA: false, capB: false, sq: 0.8 });   // cırt bant
  if (!o.split) sleevePart(M, o, cp, DOR);
}
// Kol (gömlek): kol ağzı + kesintisiz kol tüpü. wp(d): bilekten d uzaklık
function sleevePart(M, o, wp, up) {
  const S = o.colors, L = o.armLen ?? 0.55, sl = rgb(S.sleeve), sl2 = rgb(S.sleeve2);
  const ds = [0.05, 0.06, 0.085, 0.1];
  M.tube(ds.map(wp), [0.086, 0.094, 0.094, 0.088], [0.072, 0.08, 0.08, 0.076], ds.map(() => up), () => sl2, 12, { capB: false, round: 0.3 });   // kıvrık kol ağzı
  const ds2 = [0.09, 0.2, 0.35, L];
  M.tube(ds2.map(wp), [0.084, 0.092, 0.1, 0.108], [0.072, 0.08, 0.088, 0.096], ds2.map(() => up), () => sl, 12, { capA: false, round: 0.4 });
}
export const HUMAN_WRIST = 0.055;                                 // ayrı kol buradan başlar (bilekten)

export function toGeo(M, m, sc, mirror) {
  const a = new Float32Array(M.p), v = new THREE.Vector3();
  for (let i = 0; i < a.length; i += 3) { v.set(a[i] * sc, a[i + 1] * sc, a[i + 2] * sc); if (m) v.applyMatrix4(m); a[i] = mirror ? -v.x : v.x; a[i + 1] = v.y; a[i + 2] = v.z; }
  const idx = M.i.slice(); if (mirror) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(M.c), 3));
  g.setIndex(idx);
  return g;
}

export function humanHand(o, POSES) {
  const m = o.map || new THREE.Matrix4(), mi = new THREE.Matrix4().copy(m).invert(), sc = o.scale || 1;
  const arm = (o.arm || V(0, -1, 0)).clone(); if (o.mirror) arm.x = -arm.x;
  o.armC = arm.transformDirection(mi);
  const M = new Mesh(); buildHuman(M, o, POSES[o.pose] || o.pose);
  const geo = toGeo(M, m, sc, o.mirror);
  geo.computeVertexNormals();
  if (o.pose2) {
    const M2 = new Mesh(); buildHuman(M2, o, POSES[o.pose2] || o.pose2);
    const g2 = toGeo(M2, m, sc, o.mirror); g2.computeVertexNormals();
    geo.morphAttributes.position = [g2.attributes.position]; geo.morphAttributes.normal = [g2.attributes.normal];
  }
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, humanMat());
  if (o.pose2) mesh.morphTargetInfluences = [0];
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.userData.fpHand = true;
  if (o.split) {
    const W = V(0.034, -0.082, 0.0).addScaledVector(o.armC, HUMAN_WRIST).multiplyScalar(sc).applyMatrix4(m); if (o.mirror) W.x = -W.x;
    mesh.userData.wrist = W;
    const A = new Mesh();
    sleevePart(A, o, (d) => V(0, 0, (d - HUMAN_WRIST) * sc), V(0, 1, 0));
    const ga = toGeo(A, null, 1, false); ga.computeVertexNormals(); ga.computeBoundingSphere();
    const am = new THREE.Mesh(ga, humanMat()); am.castShadow = false; am.receiveShadow = false; am.userData.fpHand = true;
    mesh.userData.arm = am;
  }
  return mesh;
}
