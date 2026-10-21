import * as THREE from 'three';
import { humanHand } from './fpHumanHand.js';
import { gloveHand, gloveColorsOf } from './fpGlove.js';

// Birinci şahıs elleri: kutu değil, kodla üretilen düşük poligonlu "organik" el (yüzey yüzey düz gölgeli üçgenler). Her el + ön kol + kol
// TEK ağ (köşe renkli, tek çizim çağrısı). İsteğe bağlı ikinci poz morph hedefi olarak eklenir (parmak açma / kapama, ağ yeniden kurulmaz).
// El çerçevesi (c, sağ el): orijin = kavranan sapın merkezi, sap ekseni Z (işaret parmağı +Z, serçe −Z), avuç +X tarafında (n = −X sapa bakar),
// el sırtı +X'e bakar, bilek → boğum yönü +Y. Parmaklar boğumdan +Y'ye çıkıp −X'e doğru (sapın üstünden dolanarak) bükülür.
// map: c → ebeveyn (silah / grup) dönüşü · mirror: ebeveynde x aynalanır (sol el) · arm: ebeveyn çerçevesinde bilekten dirseğe yön.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _c = new THREE.Color(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
let MAT = null;
export const handMat = () => (MAT ||= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 }));

// Üçgen toplayıcı: yön kararı (dışa bakan sarım) ilk pozda kaydedilir, morph pozunda aynen tekrarlanır (köşe sırası birebir aynı kalsın)
class Tris {
  constructor(jit, flips = null) { this.p = []; this.c = []; this.k = 0; this.q = 0; this.jit = jit; this.flips = flips || []; this.replay = !!flips; }
  tri(a, b, c, col, inside, tone = 1) {
    let flip;
    if (this.replay) flip = this.flips[this.k];
    else if (!inside) { flip = false; this.flips.push(flip); }
    else {
      _a.subVectors(b, a); _b.subVectors(c, a); _n.crossVectors(_a, _b);
      const cx = (a.x + b.x + c.x) / 3 - inside.x, cy = (a.y + b.y + c.y) / 3 - inside.y, cz = (a.z + b.z + c.z) / 3 - inside.z;
      flip = _n.x * cx + _n.y * cy + _n.z * cz < 0; this.flips.push(flip);
    }
    this.k++;
    const [p, q, r] = flip ? [a, c, b] : [a, b, c];
    this.p.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    _c.set(col).multiplyScalar(tone);
    for (let i = 0; i < 3; i++) this.c.push(_c.r, _c.g, _c.b);
  }
  quad(a, b, c, d, col, inside) { const t = 1 + (hash(this.q++) - 0.5) * this.jit; this.tri(a, b, c, col, inside, t); this.tri(a, c, d, col, inside, t); }
  // Konik prizma (parmak boğumu, avuç, kol): a→b, kesit elips (w: genişlik, h: kalınlık; h ekseni 'up' yönünde), uçları hafif kubbeli kapak
  limb(a, b, w0, h0, w1, h1, up, col, sides = 6, capA = 0.3, capB = 0.3, colB = null) {
    const t = _b.subVectors(b, a).clone(), L = t.length(); t.divideScalar(L || 1);
    const e2 = up.clone().addScaledVector(t, -up.dot(t)); if (e2.lengthSq() < 1e-8) e2.set(t.y, -t.x, 0.3); e2.normalize();
    const e1 = new THREE.Vector3().crossVectors(t, e2);
    const ring = (c, w, h) => { const r = []; for (let i = 0; i < sides; i++) { const th = ((i + 0.5) / sides) * Math.PI * 2; r.push(c.clone().addScaledVector(e1, Math.cos(th) * w * 0.5).addScaledVector(e2, Math.sin(th) * h * 0.5)); } return r; };
    const A = ring(a, w0, h0), mid = a.clone().add(b).multiplyScalar(0.5);
    const pointy = w1 <= 0;
    const B = pointy ? null : ring(b, w1, h1);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      if (pointy) this.tri(A[i], A[j], b, col, mid, 1 + (hash(this.q++) - 0.5) * this.jit);
      else this.quad(A[i], A[j], B[j], B[i], col, mid);
    }
    if (capA >= 0) { const ca = a.clone().addScaledVector(t, -capA * Math.min(w0, h0) * 0.5); for (let i = 0; i < sides; i++) this.tri(ca, A[(i + 1) % sides], A[i], col, mid, 0.97); }
    if (!pointy && capB >= 0) { const cb = b.clone().addScaledVector(t, capB * Math.min(w1, h1) * 0.5); for (let i = 0; i < sides; i++) this.tri(cb, B[i], B[(i + 1) % sides], colB || col, mid, 1.02); }
    return { e1, e2, t };
  }
}

// Parmak: boğumdan +Y başlar; spread: el sırtı ekseni (X) etrafında açılma (+ işaret tarafına), curls: her eklemde avuca (−X) bükülme
function finger(T, base, spread, curls, lens, w, h, col, o) {
  let dir = V(0, Math.cos(spread), Math.sin(spread)), dor = V(1, 0, 0);
  let p = base.clone();
  const q = new THREE.Quaternion();
  for (let j = 0; j < 3; j++) {
    const ax = new THREE.Vector3().crossVectors(dir, dor).normalize();         // bükülme ekseni (yaklaşık sap ekseni)
    q.setFromAxisAngle(ax, -curls[j]); dir.applyQuaternion(q); dor.applyQuaternion(q);
    const e = p.clone().addScaledVector(dir, lens[j]);
    const k0 = j === 0 ? 1.06 : 1.0, k1 = 0.9 - j * 0.04;                     // eklem şişkinliği: her boğum başı kalın, ucu ince
    T.limb(p, e, w * k0, h * k0, w * k1, h * k1, dor, col, o.sides, j === 0 ? -1 : 0.25, j === 2 ? 0.7 : 0.25);
    if (o.bump && j < 2) T.limb(e.clone().addScaledVector(dor, h * 0.25), e.clone().addScaledVector(dor, h * 0.25).addScaledVector(dir, 0.006), w * 0.92, h * 0.85, w * 0.8, h * 0.7, dor, o.bump, 5, 0.3, 0.3);   // kemikli eklem çıkıntısı
    p = e; w *= 0.93; h *= 0.92;
  }
  if (o.nail) {                                                                // sivri, kıvrık, koyu tırnak (pençe)
    const ax = new THREE.Vector3().crossVectors(dir, dor).normalize();
    const d2 = dir.clone().applyQuaternion(q.setFromAxisAngle(ax, -0.45));
    const s = p.clone().addScaledVector(dor, h * 0.18).addScaledVector(dir, -0.006);
    T.limb(s, s.clone().addScaledVector(d2, o.nailLen), w * 0.85, h * 0.6, 0, 0, dor, o.nail, 4, 0.2, -1);
  }
  return p;
}
// Başparmak: açık nokta zinciri (poz başına), kalınlıklar ws
function thumb(T, pts, ws, col, o) {
  const dor = V(0.6, 0.0, -0.8);
  let last = null;
  for (let j = 0; j < pts.length - 1; j++) {
    const a = pts[j], b = pts[j + 1];
    T.limb(a, b, ws[j], ws[j] * 0.92, ws[j + 1], ws[j + 1] * 0.9, dor, col, o.sides, j === 0 ? 0.2 : 0.25, j === pts.length - 2 ? 0.7 : 0.25);
    last = [a, b];
  }
  if (o.nail) { const d = _a.subVectors(last[1], last[0]).normalize().clone(); const s = last[1].clone().addScaledVector(d, -0.005); T.limb(s, s.clone().addScaledVector(d, o.nailLen * 0.8).add(V(-0.006, 0.004, 0)), ws[ws.length - 1] * 0.8, ws[ws.length - 1] * 0.55, 0, 0, dor, o.nail, 4, 0.2, -1); }
}

const KZ = [0.027, 0.009, -0.009, -0.026], KY = [0.009, 0.012, 0.009, 0.003];
const LENS = [[0.042, 0.026, 0.021], [0.047, 0.029, 0.022], [0.044, 0.027, 0.021], [0.034, 0.021, 0.018]];

// Pozlar (c çerçevesi). f: [açılma, MCP, PIP, DIP] × 4 (işaret→serçe) · t: başparmak noktaları
export const POSES = {
  fist: { f: [[0, 1.33, 1.53, 0.96], [0, 1.36, 1.55, 0.96], [0, 1.38, 1.55, 0.98], [0, 1.45, 1.6, 1.0]], t: [V(0.03, -0.042, 0.026), V(0.014, -0.04, 0.04), V(-0.01, -0.032, 0.036), V(-0.028, -0.016, 0.03)] },
  // bıçak sapı (avuçta çapraz): yumruk + eğik boğum hattı → parmaklar eğik sapı sarar (sl ≈ tan(KNIFE_TILT))
  knife: { sl: 0.5, f: [[0, 1.3, 1.5, 0.95], [0, 1.34, 1.53, 0.96], [0, 1.37, 1.55, 0.98], [0, 1.43, 1.6, 1.0]], t: [V(0.03, -0.042, 0.026), V(0.014, -0.036, 0.044), V(-0.01, -0.022, 0.046), V(-0.028, -0.004, 0.042)] },
  // tabanca kabzası: işaret parmağı tetikte (yarı açık, öne uzanır), diğerleri sarar
  trigger: { f: [[0.05, 0.55, 0.9, 0.5], [0, 1.36, 1.55, 0.96], [0, 1.38, 1.55, 0.98], [0, 1.45, 1.6, 1.0]], t: [V(0.03, -0.042, 0.026), V(0.012, -0.036, 0.042), V(-0.012, -0.024, 0.038), V(-0.029, -0.006, 0.032)] },
  // ön kabza: daha geniş sapı saran gevşek kavrayış
  cup: { f: [[0.06, 1.05, 1.15, 0.7], [0.02, 1.1, 1.2, 0.7], [-0.03, 1.12, 1.2, 0.72], [-0.08, 1.18, 1.25, 0.75]], t: [V(0.03, -0.04, 0.028), V(0.012, -0.03, 0.05), V(-0.012, -0.012, 0.056), V(-0.028, 0.006, 0.052)] },
  // ön kundak (geniş, alttan): avuç kundağın altında, parmaklar sağ yandan yukarı sarar, başparmak sol yanda kundak boyunca öne uzanır (yukarı dikilmez)
  fg: { f: [[0.24, 0.7, 0.95, 0.6], [0.08, 0.78, 1.0, 0.62], [-0.08, 0.84, 1.02, 0.64], [-0.24, 0.9, 1.06, 0.66]], t: [V(0.03, -0.04, 0.028), V(0.02, -0.028, 0.05), V(0.013, -0.017, 0.068), V(0.009, -0.008, 0.084)],
    tg: [V(0.03, -0.04, 0.028), V(0.027, -0.03, 0.05), V(0.026, -0.024, 0.068), V(0.027, -0.019, 0.082)] },      // tg: çizgi film eldiveninde kalın başparmak kundağın yanında alçakta yatar (yukarı dikilmesin)
  // açık el (şarjör / kemer kavrama hazırlığı)
  open: { f: [[0.12, 0.45, 0.55, 0.3], [0.03, 0.4, 0.5, 0.3], [-0.06, 0.45, 0.55, 0.32], [-0.16, 0.55, 0.6, 0.35]], t: [V(0.03, -0.04, 0.028), V(0.016, -0.022, 0.056), V(0.002, 0.0, 0.074), V(-0.012, 0.016, 0.084)] },
  // bomba / yuvarlak nesne: parmaklar küreyi sarar
  ball: { f: [[0.1, 0.8, 0.85, 0.5], [0.03, 0.85, 0.9, 0.5], [-0.05, 0.88, 0.9, 0.52], [-0.14, 0.95, 0.95, 0.55]], t: [V(0.03, -0.042, 0.028), V(0.012, -0.03, 0.05), V(-0.012, -0.012, 0.058), V(-0.03, 0.006, 0.054)] },
  // boştaki sol el: gevşek, hafif kıvrık
  relax: { f: [[0.06, 0.55, 0.95, 0.5], [0.02, 0.7, 1.05, 0.55], [-0.03, 0.8, 1.1, 0.6], [-0.08, 0.9, 1.15, 0.6]], t: [V(0.03, -0.04, 0.028), V(0.02, -0.024, 0.052), V(0.008, -0.004, 0.068), V(-0.006, 0.012, 0.076)] },
  // zombi: "pençelemeye hazır" kanca parmaklar · claw2: savururken açılmış
  claw: { f: [[0.16, 0.35, 1.0, 0.8], [0.05, 0.3, 1.05, 0.85], [-0.07, 0.35, 1.05, 0.85], [-0.2, 0.42, 1.1, 0.9]], t: [V(0.034, -0.048, 0.024), V(0.022, -0.032, 0.042), V(0.004, -0.018, 0.05), V(-0.012, -0.006, 0.048)] },
  claw2: { f: [[0.3, 0.05, 0.4, 0.35], [0.09, 0.0, 0.35, 0.35], [-0.12, 0.05, 0.4, 0.35], [-0.34, 0.1, 0.45, 0.4]], t: [V(0.034, -0.048, 0.024), V(0.026, -0.03, 0.048), V(0.016, -0.012, 0.064), V(0.006, 0.004, 0.072)] },
};

// Bir pozun üçgenlerini c çerçevesinde üretir
function build(T, o, pose) {
  const z = o.zombie, S = o.colors;
  const skin = z ? S.skin : S.glove;
  const fo = { sides: z ? 5 : 6, nail: z ? S.nail : null, nailLen: 0.03, bump: z ? S.knuckle : null };
  const fw = z ? 0.0158 : 0.0175, fh = z ? 0.0145 : 0.0165, lk = z ? 1.18 : 1;
  // avuç: bilekten boğumlara konik, pahlı (8 kenar) blok
  const W = V(0.032, -0.07, 0.0);
  T.limb(W, V(0.03, 0.012, 0.001), z ? 0.054 : 0.066, z ? 0.02 : 0.026, z ? 0.078 : 0.075, z ? 0.018 : 0.022, V(1, 0, 0), skin, 8, 0.2, 0.25);
  // el sırtı / boğum hattı
  if (!z) T.limb(V(0.044, 0.004, 0.037), V(0.044, 0.004, -0.035), 0.022, 0.011, 0.02, 0.01, V(1, 0, 0), S.pad, 6, 0.5, 0.5);        // sert boğum koruması (eldiven)
  else for (let i = 0; i < 4; i++) T.limb(V(0.04, KY[i] - 0.004, KZ[i]), V(0.043, KY[i] + 0.006, KZ[i]), 0.014, 0.008, 0.011, 0.006, V(1, 0, 0), S.knuckle, 5, 0.4, 0.6);   // kemikli boğumlar
  if (!z) T.limb(V(0.045, -0.055, 0.0), V(0.045, -0.012, 0.0), 0.05, 0.006, 0.054, 0.006, V(1, 0, 0), S.pad2, 6, 0.3, 0.3);           // el sırtı panel dikişi
  for (let i = 0; i < 4; i++) finger(T, V(0.026, KY[i], KZ[i]), pose.f[i][0], pose.f[i].slice(1), LENS[i].map((l) => l * lk), i === 3 ? fw * 0.86 : fw, i === 3 ? fh * 0.88 : fh, skin, fo);
  thumb(T, pose.t, z ? [0.021, 0.017, 0.015, 0.013] : [0.024, 0.02, 0.018, 0.016], skin, fo);
  // bilek → ön kol (kol yönü c çerçevesinde). split: kol ayrı ağdır (ViewModel her karede bilekten dirseğe çevirir), burada yalnız bileklik
  const ar = o.armC, up = V(1, 0, 0), wp = (d) => W.clone().addScaledVector(ar, d);
  if (!z) {
    T.limb(wp(-0.01), wp(0.045), 0.064, 0.046, 0.07, 0.052, up, S.cuff, 8, 0.2, 0.3);                     // eldiven bilekliği
    T.limb(wp(0.01), wp(0.03), 0.067, 0.049, 0.068, 0.05, up, S.strap, 8, -1, -1);                        // cırt bant
  } else {
    T.limb(wp(-0.014), wp(0.035), 0.056, 0.044, 0.058, 0.046, up, S.knuckle, 6, 0.3, -1);                 // kemikli bilek
    const sc = (a, b) => T.limb(a, b, 0.0035, 0.002, 0.0025, 0.0015, V(1, 0, 0), S.scar, 4, 0.3, 0.3);    // el sırtında ince koyu çizikler
    sc(V(0.045, -0.052, 0.022), V(0.046, -0.014, -0.012)); sc(V(0.045, -0.04, -0.016), V(0.046, -0.022, 0.0));
  }
  if (!o.split) armPart(T, o, (d) => wp(d), ar, up);
}
export const WRIST = { glove: 0.045, zombie: 0.03 };            // bileklik ucunun bilekten uzaklığı (ayrı kol buradan başlar)

// Ön kol / kol yeni: wp(d) bilekten d uzaklıktaki eksen noktası, ar kol yönü
function armPart(T, o, wp, ar, up) {
  const z = o.zombie, S = o.colors, L = o.armLen ?? 0.55;
  if (!z) {
    T.limb(wp(0.045), wp(0.09), 0.096, 0.084, 0.1, 0.088, up, S.sleeve2, 7, 0.3, -1);                     // kol ağzı (kıvrık)
    T.limb(wp(0.085), wp(L), 0.09, 0.08, 0.112, 0.1, up, S.sleeve, 7, -1, 0.2);                           // kol
    return;
  }
  const r = T.limb(wp(0.02), wp(L * 0.62), 0.054, 0.044, 0.072, 0.062, up, S.skin, 6, -1, -1);            // çıplak, kemikli ön kol
  for (const [d0, d1, a0, a1, col] of [[0.08, 0.17, 0.2, 0.7, S.scar], [0.12, 0.2, 2.3, 2.7, S.scar], [0.2, 0.3, 4.4, 4.0, S.wound], [0.26, 0.31, 1.0, 1.3, S.scar], [0.06, 0.12, 3.6, 3.3, S.scar]]) {
    const pt = (d, a) => { const k = (d - 0.02) / (L * 0.62 - 0.02), w = 0.054 + 0.018 * k, h = 0.044 + 0.018 * k; return wp(d).addScaledVector(r.e1, Math.cos(a) * w * 0.52).addScaledVector(r.e2, Math.sin(a) * h * 0.52); };
    T.limb(pt(d0, a0), pt(d1, a1), 0.005, 0.002, 0.004, 0.002, pt(d0, a0).sub(wp(d0)), col, 4, 0.3, 0.3);
  }
  // yırtık kumaş: kolun dibinde, ele doğru sivri dişli
  const d0 = L * 0.6, rr = T.limb(wp(d0), wp(L), 0.082, 0.07, 0.11, 0.098, up, S.sleeve, 7, -1, 0.2);
  for (let i = 0; i < 7; i++) {
    const a = ((i + 0.5) / 7) * Math.PI * 2, a2 = ((i + 1.5) / 7) * Math.PI * 2, ln = 0.025 + hash(i + 7) * 0.05;
    const p0 = wp(d0).addScaledVector(rr.e1, Math.cos(a) * 0.041).addScaledVector(rr.e2, Math.sin(a) * 0.035);
    const p1 = wp(d0).addScaledVector(rr.e1, Math.cos(a2) * 0.041).addScaledVector(rr.e2, Math.sin(a2) * 0.035);
    const tip = p0.clone().lerp(p1, 0.5).addScaledVector(ar, -ln);
    T.tri(p0, p1, tip, S.sleeve2, null, 1); T.tri(p1, p0, tip, S.sleeve2, null, 0.85);    // iki yüzlü diş
  }
}

const geoOf = (T, fix) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(fix(T.p), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(fix(T.c, true), 3));
  return geo;
};
const meshOf = (geo) => { geo.computeVertexNormals(); geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, handMat()); m.castShadow = false; m.receiveShadow = false; m.userData.fpHand = true; return m; };

// Eli üretir. o: { colors, map (Matrix4 c→ebeveyn), mirror, arm (ebeveynde yön), armLen, pose, pose2, scale, split }
// split: mesh.userData.arm = ayrı kol ağı (yerel +Z boyunca, orijin bilek ucu), mesh.userData.wrist = bilek ucu (ebeveyn çerçevesinde)
export function fpHand(o) {
  o.zombie = o.zombie || !!o.colors.zombie;
  if (!o.zombie) return o.colors.style ? gloveHand(o, POSES) : humanHand(o, POSES);     // çizgi film eldiveni (fpGlove.js) · style yoksa eski gerçekçi el (fpHumanHand.js)
  const m = o.map || new THREE.Matrix4(), mi = new THREE.Matrix4().copy(m).invert(), sc = o.scale || 1;
  const arm = (o.arm || V(0, -1, 0)).clone(); if (o.mirror) arm.x = -arm.x;
  o.armC = arm.transformDirection(mi);
  const fix = (src, isCol) => {
    const a = new Float32Array(src), v = new THREE.Vector3();
    if (!isCol) for (let i = 0; i < a.length; i += 3) { v.set(a[i] * sc, a[i + 1] * sc, a[i + 2] * sc).applyMatrix4(m); a[i] = o.mirror ? -v.x : v.x; a[i + 1] = v.y; a[i + 2] = v.z; }
    if (o.mirror) for (let i = 0; i < a.length; i += 9) for (let k = 0; k < 3; k++) { const t = a[i + 3 + k]; a[i + 3 + k] = a[i + 6 + k]; a[i + 6 + k] = t; }   // aynada sarım ters
    return a;
  };
  const T = new Tris(o.zombie ? 0.16 : 0.1);
  build(T, o, POSES[o.pose] || o.pose);
  const geo = geoOf(T, fix);
  if (o.pose2) {
    const T2 = new Tris(T.jit, T.flips);
    build(T2, o, POSES[o.pose2] || o.pose2);
    geo.morphAttributes.position = [new THREE.BufferAttribute(fix(T2.p), 3)];
  }
  const mesh = meshOf(geo);
  if (o.pose2) mesh.morphTargetInfluences = [0];
  if (o.split) {
    const wr = o.zombie ? WRIST.zombie : WRIST.glove;
    const w = V(0.032, -0.07, 0.0).addScaledVector(o.armC, wr).multiplyScalar(sc).applyMatrix4(m); if (o.mirror) w.x = -w.x;
    mesh.userData.wrist = w;
    const TA = new Tris(T.jit);
    armPart(TA, o, (d) => V(0, 0, (d - wr) * sc), V(0, 0, 1), V(0, 1, 0));
    if (sc !== 1) for (let i = 0; i < TA.p.length; i += 3) { TA.p[i] *= sc; TA.p[i + 1] *= sc; }            // kesit de ölçeklensin
    mesh.userData.arm = meshOf(geoOf(TA, (a) => new Float32Array(a)));
  }
  return mesh;
}

// c → ebeveyn dönüşü: c'nin X (el sırtı) ve Y (bilek→boğum) eksenlerinin ebeveyndeki karşılıkları (Z = X × Y: işaret parmağı yönü)
export function handBasis(x, y) {
  const X = x.clone().normalize(), Y = y.clone().addScaledVector(X, -y.dot(X)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
  return new THREE.Matrix4().makeBasis(X, Y, Z);
}

// Renk takımları
export function gloveColors(c, style = 'white', pb = false) {
  if (style !== 'human') return gloveColorsOf(style, c, pb);                                                   // çizgi film eldiveni: beyaz / koyu
  const g = new THREE.Color(c.gloves).lerp(new THREE.Color('#454a3a'), 0.65), sh = new THREE.Color(c.shirt);      // mat, koyu zeytin-siyah kumaş eldiven
  return {
    glove: '#' + g.getHexString(), palm: '#' + g.clone().lerp(new THREE.Color('#5c574a'), 0.18).getHexString(), pad: '#' + g.clone().multiplyScalar(0.6).getHexString(), pad2: '#' + g.clone().multiplyScalar(0.8).getHexString(),
    cuff: '#' + g.clone().multiplyScalar(0.75).getHexString(), strap: '#' + g.clone().lerp(new THREE.Color('#3a3f45'), 0.5).getHexString(),
    sleeve: '#' + sh.getHexString(), sleeve2: '#' + sh.clone().multiplyScalar(0.78).getHexString(),
  };
}
export function zombieColors(skin, shirt = '#4a5440') {
  const s = new THREE.Color(skin).lerp(new THREE.Color('#6f7466'), 0.22).multiplyScalar(0.86);          // solgun, gri-yeşil (hastalıklı)
  return {
    zombie: true, skin: '#' + s.getHexString(), knuckle: '#' + s.clone().multiplyScalar(0.82).getHexString(), scar: '#' + s.clone().multiplyScalar(0.45).getHexString(),
    wound: '#4a221c', nail: '#24221c', sleeve: shirt, sleeve2: '#' + new THREE.Color(shirt).multiplyScalar(0.7).getHexString(),
  };
}
