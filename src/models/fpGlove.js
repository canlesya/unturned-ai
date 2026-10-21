import * as THREE from 'three';
import { Mesh, toGeo } from './fpHumanHand.js';

// Çizgi film eldiveni (birinci şahıs): tombul, yuvarlak avuç + sosis gibi kalın kapsül parmaklar + iri başparmak + kısa kıvrık bilek ağzı + kalın kol.
// Çerçeve / pozlar fpHands.js ile aynı (c: orijin sap merkezi, sap Z, el sırtı +X, bilek→boğum +Y); iskelet sap ekseni çevresinde K kadar büyür
// (kalın parmak sapı daha geniş yarıçapta sarar, sapın içine gömülmez). Ana hat: aynı ağda ters sarımlı, normal boyunca şişirilmiş siyah kabuk
// (ters kabuk: arka yüzü kenardan taşar → çizgi film çizgisi; ek çizim çağrısı / son işleme yok). Işık: 3 basamaklı toon (silah ışığı yumuşak boyar).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const K = 1.22;                                                                  // iskelet büyütmesi (sap ekseni çevresinde)
const KZ = [0.028, 0.0095, -0.0095, -0.027].map((z) => z * K * 1.04), KY = [0.012, 0.016, 0.012, 0.005].map((y) => y * K);
const LENS = [[0.043, 0.026, 0.022], [0.048, 0.03, 0.023], [0.045, 0.028, 0.022], [0.035, 0.022, 0.019]].map((a) => a.map((l) => l * K * 0.94));
const rgb = (hex, k = 1) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k]; };

// Varyant: ?glove=white|dark (localStorage['warbyte.glove'] olarak kalır) · 'human' = eski gerçekçi el (karşılaştırma)
export function gloveStyle() {
  try {
    const q = new URLSearchParams(location.search).get('glove');
    if (q) { localStorage.setItem('warbyte.glove', q); return q; }
    return localStorage.getItem('warbyte.glove') || 'dark';
  } catch (e) { return 'dark'; }
}
export const STYLES = {
  white: { glove: '#f1f4fa', palm: '#e2e6ee', cuff: '#eaeef5', pad: '#d6dae2', sleeveOwn: '#e9edf4', line: '#0d0d10', lineW: 0.0024 },        // referans: beyaz çizgi film eldiveni, beyaz kalın kol, siyah çizgi
  dark: { glove: '#3b3f33', palm: '#45493c', cuff: '#2f322a', pad: '#25281f', sleeveOwn: null, line: '#0b0c09', lineW: 0.0013 },              // koyu taktik: koyu zeytin-kömür eldiven, takım renginde kol, ince çizgi
};

let GRAD = null; const MATS = new Map();
const gradTex = () => {                                                         // 3 basamak: gölge yarısı açık kalsın (beyaz eldiven griye boğulmasın)
  if (GRAD) return GRAD;
  GRAD = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 196, 196, 196, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
  return GRAD;
};
export const gloveMat = (style) => {
  if (!MATS.has(style)) MATS.set(style, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex() }));
  return MATS.get(style);
};

// Eldiven ağı (tek poz, c çerçevesi). o.armC: bilekten dirseğe yön, o.split: kol ayrı ağ
function buildGlove(M, o, pose) {
  const S = o.colors, back = rgb(S.glove), palm = rgb(S.palm), DOR = V(1, 0, 0);
  const gcol = (d) => (d.x < -0.3 ? palm : back);
  // avuç: kalın, yastık gibi yuvarlatılmış blok (bilek → boğum)
  const pp = [V(0.044, -0.09, 0.0), V(0.044, -0.064, 0.0), V(0.044, -0.034, 0.0), V(0.043, -0.006, 0.0), V(0.04, 0.017, 0.0)];
  M.tube(pp, [0.09, 0.1, 0.108, 0.112, 0.106], [0.058, 0.06, 0.059, 0.056, 0.048], pp.map(() => DOR), gcol, 18, { sq: 0.62, round: 0.75 });
  M.blob(V(0.026, -0.05, 0.034), V(0.022, 0, 0), V(0, 0.034, 0.004), V(0, -0.004, 0.024), gcol, 10, 6);       // başparmak kası (tombul)
  M.blob(V(0.058, -0.034, 0.0), V(0.012, 0, 0), V(0, 0.045, 0), V(0, 0, 0.045), gcol, 10, 6);                   // el sırtı kabarıklığı
  // boğum koruması (taktik eldiven): her parmağın boğumunda sert, yuvarlak yastık + altında ince bant
  const pad = rgb(S.pad || S.glove);
  for (let i = 0; i < 4; i++) M.blob(V(0.066, KY[i] - 0.004 + KZ[i] * (pose.sl || 0), KZ[i]), V(0.009, 0, 0), V(0, 0.012, 0), V(0, 0, i === 3 ? 0.01 : 0.0115), () => pad, 10, 6);
  M.blob(V(0.068, -0.026, 0.0), V(0.006, 0, 0), V(0, 0.016, 0), V(0, 0, 0.042), () => pad, 12, 6);
  // parmaklar: kalın kapsül (sosis), boğumdan kesintisiz; eklemde hafif boğum, uç yuvarlak ve dolgun
  const q = new THREE.Quaternion();
  for (let i = 0; i < 4; i++) {
    const [spread, ...curls] = pose.f[i], L = LENS[i];
    let dir = V(0, Math.cos(spread), Math.sin(spread)), dor = DOR.clone();
    let p = V(0.04, KY[i] + KZ[i] * (pose.sl || 0), KZ[i]);
    const pts = [p.clone().addScaledVector(dir, -0.02)], ups = [dor.clone()], ws = [], hs = [];
    const W0 = i === 3 ? 0.0245 : 0.0275, H0 = i === 3 ? 0.0235 : 0.026;      // kalın ama sosis değil (taktik eldiven)
    pts.push(p.clone()); ups.push(dor.clone());
    for (let j = 0; j < 3; j++) {
      const ax = new THREE.Vector3().crossVectors(dir, dor).normalize();
      q.setFromAxisAngle(ax, -curls[j]); dir.applyQuaternion(q); dor.applyQuaternion(q);
      const e = p.clone().addScaledVector(dir, L[j]);
      pts.push(p.clone().addScaledVector(dir, L[j] * 0.5)); ups.push(dor.clone());
      pts.push(e); ups.push(dor.clone());
      p = e;
    }
    for (const f of [1.0, 1.02, 0.97, 1.0, 0.96, 0.98, 0.95, 0.94]) { ws.push(W0 * f); hs.push(H0 * f); }   // uca doğru neredeyse aynı kalınlık (çizgi film)
    M.tube(pts, ws, hs, ups, gcol, 10, { round: 1.0 });                        // iki uç kapalı: açık tüp ucundan iç kabuk (siyah) görünmesin
  }
  // başparmak: iri, tombul, kas içinden çıkan yuvarlak tüp
  const t = (pose.tg || pose.t).map((v) => v.clone().multiplyScalar(K)), tp = [t[0].clone().lerp(t[1], -0.35), t[0], t[1], t[1].clone().lerp(t[2], 0.5), t[2], t[2].clone().lerp(t[3], 0.5), t[3]];
  const tw = [0.04, 0.038, 0.034, 0.032, 0.031, 0.03, 0.029];
  M.tube(tp, tw, tw.map((x) => x * 0.9), tp.map(() => V(0.6, 0.0, -0.8).normalize()), gcol, 10, { round: 1.0 });
  // bilek → kısa, geniş, kıvrık eldiven ağzı (bilek eğrisi yumuşak: ilk 6 cm el ekseninden kol yönüne Bezier)
  const ar = o.armC.clone().normalize(), cp = wristCurve(ar), cuff = rgb(S.cuff);
  const ds = [-0.02, 0.0, 0.03, 0.06, 0.09, 0.1];                              // uzun bilek ağzı (taktik eldiven): kol yeni bileğin 10 cm gerisinde başlar
  M.tube(ds.map(cp), [0.088, 0.084, 0.09, 0.1, 0.112, 0.11], [0.062, 0.06, 0.066, 0.076, 0.086, 0.084], ds.map(() => DOR), () => cuff, 14, { capA: false, capB: !!o.split, sq: 0.85, round: 0.35 });
  if (!o.split) sleevePart(M, o, cp, DOR);
}
const W_GLOVE = V(0.044, -0.1, 0.0);
const wristCurve = (ar) => {
  const down = V(0, -1, 0), B1 = W_GLOVE.clone().addScaledVector(down, 0.03), B2 = B1.clone().addScaledVector(ar, 0.034);
  return (d) => {
    if (d <= 0) return W_GLOVE.clone().addScaledVector(down, d);
    if (d >= 0.06) return B2.clone().addScaledVector(ar, d - 0.06);
    const t = d / 0.06; return W_GLOVE.clone().multiplyScalar((1 - t) ** 2).addScaledVector(B1, 2 * t * (1 - t)).addScaledVector(B2, t * t);
  };
};
// Kalın kol: ağız kenarı yuvarlak, ekran kenarına doğru hafif genişler. wp(d): bilekten d uzaklık
function sleevePart(M, o, wp, up) {
  const S = o.colors, L = o.armLen ?? 0.55, sl = rgb(S.sleeve), sl2 = rgb(S.sleeve2);
  const ds = [0.092, 0.102, 0.12];
  M.tube(ds.map(wp), [0.126, 0.138, 0.134], [0.112, 0.122, 0.118], ds.map(() => up), () => sl2, 14, { capB: false, round: 0.45 });     // kol ağzı (dolgun kenar)
  const ds2 = [0.115, 0.24, 0.38, L];
  M.tube(ds2.map(wp), [0.128, 0.136, 0.144, 0.152], [0.114, 0.122, 0.13, 0.138], ds2.map(() => up), () => sl, 14, { capA: false, round: 0.4 });
}
export const GLOVE_WRIST = 0.1;                                                 // ayrı kol buradan başlar (bilekten)

// Ters kabuk ana hattı: her köşe normali boyunca w kadar şişirilir, sarım ters, renk siyah (arka yüz yalnız kenardan görünür)
function withShell(geo, w, line, morph) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array, n = P.length / 3, I = geo.index.array;
  const cat = (a, b) => { const r = new Float32Array(a.length + b.length); r.set(a); r.set(b, a.length); return r; };
  const grow = (p, nn) => { const r = new Float32Array(p.length); for (let i = 0; i < p.length; i++) r[i] = p[i] + nn[i] * w; return r; };
  const lc = new Float32Array(n * 3); for (let i = 0; i < n; i++) lc.set(line, i * 3);
  const idx = new Uint32Array(I.length * 2); idx.set(I); for (let i = 0; i < I.length; i += 3) { idx[I.length + i] = I[i] + n; idx[I.length + i + 1] = I[i + 2] + n; idx[I.length + i + 2] = I[i + 1] + n; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(cat(P, grow(P, N)), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(cat(N, N), 3));
  g.setAttribute('color', new THREE.BufferAttribute(cat(C, lc), 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  if (morph) {
    const mp = morph.attributes.position.array, mn = morph.attributes.normal.array;
    g.morphAttributes.position = [new THREE.BufferAttribute(cat(mp, grow(mp, mn)), 3)]; g.morphAttributes.normal = [new THREE.BufferAttribute(cat(mn, mn), 3)];
  }
  g.computeBoundingSphere();
  return g;
}

export function gloveHand(o, POSES) {
  const st = STYLES[o.colors.style] || STYLES.dark, m = o.map || new THREE.Matrix4(), mi = new THREE.Matrix4().copy(m).invert(), sc = o.scale || 1;
  const arm = (o.arm || V(0, -1, 0)).clone(); if (o.mirror) arm.x = -arm.x;
  o.armC = arm.transformDirection(mi);
  const line = rgb(st.line), mk = (pose) => { const M = new Mesh(); buildGlove(M, o, POSES[pose] || pose); const g = toGeo(M, m, sc, o.mirror); g.computeVertexNormals(); return g; };
  const g1 = mk(o.pose), g2 = o.pose2 ? mk(o.pose2) : null;
  const mesh = new THREE.Mesh(withShell(g1, st.lineW, line, g2), gloveMat(o.colors.style));
  g1.dispose(); g2?.dispose();
  if (o.pose2) mesh.morphTargetInfluences = [0];
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.userData.fpHand = true;
  if (o.split) {
    const W = W_GLOVE.clone().addScaledVector(o.armC, GLOVE_WRIST).multiplyScalar(sc).applyMatrix4(m); if (o.mirror) W.x = -W.x;
    mesh.userData.wrist = W;
    const A = new Mesh();
    sleevePart(A, o, (d) => V(0, 0, (d - GLOVE_WRIST) * sc), V(0, 1, 0));
    const ga = toGeo(A, null, 1, false); ga.computeVertexNormals();
    const am = new THREE.Mesh(withShell(ga, st.lineW, line), gloveMat(o.colors.style)); ga.dispose();
    am.castShadow = false; am.receiveShadow = false; am.userData.fpHand = true;
    mesh.userData.arm = am;
  }
  return mesh;
}

// Renk takımı: varyantın eldiveni + kol (beyaz: beyaz kol; koyu: takım rengi; paintball: kol boya renginde, eldiven varyant renginde)
export function gloveColorsOf(style, c, pb) {
  const st = STYLES[style] || STYLES.dark, sh = new THREE.Color(pb || !st.sleeveOwn ? c.shirt : st.sleeveOwn);
  return { style: STYLES[style] ? style : 'dark', glove: st.glove, palm: st.palm, cuff: st.cuff, pad: st.pad, sleeve: '#' + sh.getHexString(), sleeve2: '#' + sh.clone().multiplyScalar(st.sleeveOwn && !pb ? 0.93 : 0.82).getHexString() };
}
