import * as THREE from 'three';
import { smooth } from '../game/anim.js';

// Birinci şahıs "kare el" (V3, handlab4 → oyun; BattleBit / Unturned tarzı): el = tek pahlı kutu (parmak yok; parmak yüzünde 3 sığ koyu oluk şeridi + biraz açık üst yüz) + isteğe bağlı başparmak kutusu;
// ön kol = el merkezinden ekran dışı dirsek çapasına giden tek prizma (bilek 7×6 → dirsek 9×8 cm) + koyu manşet halkası. El silah soketine RİJİT bağlı; ön kol yönü 2 nokta kuralı, IK yok.
// Kol başına TEK ağ / TEK çizim çağrısı: köşe renkli indekssiz BufferGeometry; el + oluklar + başparmak sabit, ön kol + manşet köşeleri her kare yeniden yazılır. ≤ 60 üçgen.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const GLOVE = '#3a3d41', GLOVE_TOP = '#484c51', GROOVE = '#202226';
export const armMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });   // düz malzeme (abilityfx kopyası / mobil nişan saydamlığı uyumlu; karede değişmez)
const MAT = armMaterial();
const seg = (k, a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));
const sm = (k, a, b) => smooth(seg(k, a, b));

const FACES = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];   // -z, +z, -x, +x, +y, -y
function writeBox(pos, off, c) { let k = off; for (const f of FACES) for (const i of [0, 1, 2, 0, 2, 3]) { const p = c[f[i]]; pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2]; } return k; }
function writeQuad(pos, off, q) { let k = off; for (const i of [0, 1, 2, 0, 2, 3]) { const p = q[i]; pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2]; } return k; }
// pahlı kutu köşeleri: alt / üst yüz kenarları b kadar içeride (yuvarlak kenar izlenimi)
function cornersBox(cen, h, b = 0) {
  const o = [];
  for (const sy of [-1, 1]) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) o.push([cen[0] + sx * (h[0] - b), cen[1] + sy * h[1], cen[2] + sz * (h[2] - b)]);
  return o;
}
const _d = V(), _e1 = V(), _e2 = V(), UPH = V(0, 0, -1), ORG = V();
function cornersPrism(a, b, wa, ha, wb, hb, upHint) {
  _d.copy(b).sub(a).normalize(); _e1.crossVectors(_d, upHint); if (_e1.lengthSq() < 1e-6) _e1.set(1, 0, 0); _e1.normalize(); _e2.crossVectors(_e1, _d).normalize();
  const o = [], corner = (p, w, h, sx, sz) => [p.x + _e1.x * w * sx + _e2.x * h * sz, p.y + _e1.y * w * sx + _e2.y * h * sz, p.z + _e1.z * w * sx + _e2.z * h * sz];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) o.push(corner(a, wa, ha, sx, sz));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) o.push(corner(b, wb, hb, sx, sz));
  return o;
}
const fill = (arr, off, n, hex) => { const c = new THREE.Color(hex); for (let i = 0; i < n; i++) { arr[off + i * 3] = c.r; arr[off + i * 3 + 1] = c.g; arr[off + i * 3 + 2] = c.b; } };

export class BoxArm {
  // side: 1 sağ / −1 sol · size [w,h,d] · thumb [w,h,d] | null · groove: 'front' (−Z: kabza / kundak eli) | 'top' (+Y: yumruk / açık avuç) | null · colors { glove, top, sleeve, cuff } · mat: paylaşılan malzeme
  constructor(side, { size = [0.085, 0.09, 0.08], thumb = null, groove = 'front', colors = {}, mat = MAT } = {}) {
    this.side = side; this.size = size; this.thumb = thumb; this.groove = groove; this.colors = { glove: GLOVE, top: GLOVE_TOP, sleeve: '#38608c', cuff: '#1d2530', ...colors };
    const h = [size[0] / 2, size[1] / 2, size[2] / 2], NB = 36, nGro = groove ? 3 * 6 : 0, n = NB + (thumb ? NB : 0) + nGro + NB * 2;
    this.pos = new Float32Array(n * 3); const col = new Float32Array(n * 3);
    let k = writeBox(this.pos, 0, cornersBox([0, 0, 0], h, 0.007)); fill(col, 0, NB, this.colors.glove); fill(col, 24 * 3, 6, this.colors.top);   // +y yüzü (5. yüz) biraz açık
    if (groove) {                                                                      // 3 sığ koyu oluk: parmak yüzünde yüzeyin 0,5 mm üstünde ince dörtgenler
      for (let i = 0; i < 3; i++) {
        const t = -0.3 + i * 0.3, q = groove === 'top'
          ? [[-h[0] * 0.8, h[1] + 0.0005, t * h[2] - 0.0025], [h[0] * 0.8, h[1] + 0.0005, t * h[2] - 0.0025], [h[0] * 0.8, h[1] + 0.0005, t * h[2] + 0.0025], [-h[0] * 0.8, h[1] + 0.0005, t * h[2] + 0.0025]]
          : [[-h[0] * 0.8, t * h[1] + 0.0025, -h[2] - 0.0005], [h[0] * 0.8, t * h[1] + 0.0025, -h[2] - 0.0005], [h[0] * 0.8, t * h[1] - 0.0025, -h[2] - 0.0005], [-h[0] * 0.8, t * h[1] - 0.0025, -h[2] - 0.0005]];
        k = writeQuad(this.pos, k, q);
      }
      fill(col, NB * 3, nGro, GROOVE);
    }
    if (thumb) { const t = thumb, tc = [side * (h[0] + t[0] / 2 - 0.005), h[1] * 0.3, -h[2] * 0.3]; k = writeBox(this.pos, k, cornersBox(tc, [t[0] / 2, t[1] / 2, t[2] / 2], 0.003)); fill(col, (NB + nGro) * 3, NB, this.colors.glove); }
    this.offArm = k; fill(col, k, NB, this.colors.cuff); fill(col, k + NB * 3, NB, this.colors.sleeve);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.userData.boxArm = true; this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    this.tris = n / 3; this._el = V(); this._qi = new THREE.Quaternion();
  }
  // el (kamera uzayı) konum + yönelim + ölçek → ön kol prizması el yerelinde: bilek = el merkezi (kutunun içinde gizli), dirsek = çapa (kamera uzayı; ölçekten bağımsız aynı noktaya varır)
  place(pos, quat, elbowCam, scale = 1) {
    this.mesh.position.copy(pos); this.mesh.quaternion.copy(quat); this.mesh.scale.setScalar(scale);
    this._el.copy(elbowCam).sub(pos).applyQuaternion(this._qi.copy(quat).invert()).divideScalar(scale);
    const L = this._el.length(), dir = _d.copy(this._el).divideScalar(L || 1).clone();
    const c0 = dir.clone().multiplyScalar(Math.max(0.02, Math.min(this.size[1], this.size[2]) * 0.45)), c1 = dir.clone().multiplyScalar(Math.min(0.09, L * 0.35));   // manşet halkası: el yüzeyinden ~5 cm, hafif geniş
    const k = writeBox(this.pos, this.offArm, cornersPrism(c0, c1, 0.041, 0.035, 0.042, 0.036, UPH));
    writeBox(this.pos, k, cornersPrism(ORG, this._el, 0.035, 0.03, 0.045, 0.04, UPH));                                 // ön kol: bilek 7×6 → dirsek 9×8 cm
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
  }
  dispose() { this.mesh.geometry.dispose(); }
}

// ── el yerleşimi: soket (silah yerel) + yerel dönüş + kutu ölçüsü. groove yüzü = parmakların sardığı yön
// R: tetik eli kabzada (lab −0,046 → −0,052: kutu gövdeye 8–9 mm batıyordu, ≤ 3 mm) · L under: kundak / pompa altı (oyunda alt yüz ışınla ölçülür → her modelde değer)
// pistol L: destek kutusu sol-altta, ayrı (lab: iki kutu üst üste koyu yumru gibiydi) · grenade R: açık avuç levhası topun ALTINDA · box: çanta / kutu / mayın iki yandan
export const HAND_FIT_ID = { sniper: { R: { p: [0, -0.064, 0.02], r: [0.3, 0, 0], size: [0.085, 0.08, 0.078], groove: 'front' } } };   // silaha özel: M24 gövde bloğu alçak, el daha aşağıda
const R_RIFLE = { p: [0, -0.052, 0.018], r: [0.3, 0, 0], size: [0.085, 0.085, 0.078], groove: 'front' }, L_UNDER = { p: [0, -0.026, 0], r: [0, 0, 0], size: [0.08, 0.05, 0.1], groove: 'top', under: true };
export const HAND_FIT = {
  rifle:    { R: R_RIFLE, L: L_UNDER },
  launcher: { R: R_RIFLE, L: L_UNDER },
  pistol:   { R: { p: [0, -0.03, 0.012], r: [0.2, 0, 0], size: [0.076, 0.09, 0.07], thumb: [0.026, 0.022, 0.04], groove: 'front' }, L: { p: [-0.066, -0.06, -0.004], r: [0.2, 0, 0.12], size: [0.05, 0.072, 0.064], groove: 'front', onGrip: true, top: '#5b6067' } },
  melee:    { R: { p: [0, -0.002, 0.012], r: [0, 0, 0], size: [0.07, 0.078, 0.1], thumb: [0.028, 0.024, 0.044], groove: 'top' } },
  grenade:  { R: { p: [0, -0.052, 0.0], r: [0, 0, 0], size: [0.09, 0.025, 0.1], thumb: [0.026, 0.02, 0.05], groove: 'top' } },      // açık avuç levhası topun ALTINDA
  box:      { R: { p: [0, 0, 0], r: [0, 0, 0.12], size: [0.05, 0.095, 0.095], groove: null, edge: 1 }, L: { p: [0, 0, 0], r: [0, 0, -0.12], size: [0.05, 0.095, 0.095], groove: null, edge: -1 } },   // kenardan kavrayan iki el (yan yüzler, ölçüden)
};
// kamera uzayı dirsek çapaları (ekran dışı): bel / nişan karışımı; Lrel: yükleme (sol el şarjör / cep; kol ekran kenarında kalsın) · Lpin: bomba pimi (sol alttan)
export const ELBOW = { R: V(0.34, -0.52, -0.02), Rads: V(0.2, -0.5, 0.0), L: V(-0.14, -0.56, -0.28), Lads: V(-0.12, -0.52, -0.2), Lrel: V(-0.42, -0.74, -0.16), Lpin: V(-0.36, -0.7, -0.12), Rbox: V(0.3, -0.62, -0.1), Lbox: V(-0.3, -0.62, -0.1) };
// serbest (kamera uzayı) el hedefleri: boştaki sol el, cep, fırlatma sonrası sağ el (açık avuç ekranın sağ altında kalır, kaybolmaz)
export const FREE = { restL: { p: [-0.2, -0.22, -0.4], r: [0.35, 0.45, 0.5] }, pouch: { p: [-0.3, -0.5, -0.25], r: [0.3, 0.4, 0.4] }, afterThrow: { p: [0.15, -0.12, -0.37], r: [0.55, -0.25, -0.3] } };

export const fitFor = (id, hold) => { const b = HAND_FIT[hold] || HAND_FIT.rifle, o = HAND_FIT_ID[id]; return o ? { ...b, ...o } : b; };
// ön kundağı ölç (ışın): alt yüz yüksekliği + yarı genişlik → el kundağa değsin (havada durmasın); dar ve alçak parça = dikey tutamak (kabza gibi sarılır)
const _rc = new THREE.Raycaster(), _ro = V(), _rd = V();
function foreFit(g, q) {
  g.updateMatrixWorld(true); _rc.near = 0; _rc.far = 1;
  const hit = (o, d, k) => { _rc.set(_ro.set(...o), _rd.set(...d)); const h = _rc.intersectObject(g, true).find((x) => x.object.visible && !x.object.userData.boxArm)?.point; return h ? h.getComponent(k) : null; };
  const bot = hit([0, q.y - 0.3, q.z], [0, 1, 0], 1);
  if (bot === null) return null;
  const half = hit([0.3, bot + 0.012, q.z], [-1, 0, 0], 0);
  return { bot, half: half ?? 0.03, vert: (half ?? 0.03) < 0.021 && bot < q.y - 0.015 };
}
const hand = (f, p) => ({ p, r: f.r.slice(), size: f.size, thumb: f.thumb || null, groove: f.groove, top: f.top || null });
// soketler (model yerel, birleştirilmemiş / ölçeksiz g üstünde bir kez): her silaha oturan kutu el konumu + ölçüsü. hold 'box': kutunun iki yan yüzü
// boxes (ham parça OBB'leri) verilirse: el kutusu soket dışı bir parçaya > 3 mm batıyorsa 1 mm adımlarla kaçar (tetik eli aşağı-geri, kundak eli aşağı, yumruk geri; en çok 6 cm)
export function fitSockets(g, hold, id, boxes = null) {
  const out = fitRaw(g, hold, id), u = g.userData;
  if (boxes && hold !== 'box') for (const k of ['R', 'L']) {
    const h = out[k]; if (!h) continue;
    const sock = k === 'R' || !u.gripL || out.L?.onGrip ? u.gripR : u.gripL, dir = hold === 'melee' ? V(0, 0, 1) : k === 'R' ? V(0, -1, 0.35).normalize() : V(0, -1, 0);
    for (let i = 0; i < 60 && handOverlap(boxes, h.p, h.r, h.size, sock).mm > 3; i++) h.p.addScaledVector(dir, 0.001);
  }
  return out;
}
function fitRaw(g, hold, id) {
  const u = g.userData, fit = fitFor(id, hold), out = { R: null, L: null };
  if (hold === 'box') {
    const bb = new THREE.Box3().setFromObject(g), cy = bb.min.y + (bb.max.y - bb.min.y) * 0.45, cz = (bb.min.z + bb.max.z) / 2, w = fit.R.size[0] / 2 - 0.012;
    out.R = hand(fit.R, V(bb.max.x + w, cy, cz)); out.L = hand(fit.L, V(bb.min.x - w, cy, cz));
    return out;
  }
  if (fit.R && u.gripR) {
    out.R = hand(fit.R, u.gripR.clone().add(V(...fit.R.p)));
    if (hold === 'grenade') { const bb = new THREE.Box3().setFromObject(g); out.R.p.y = bb.min.y - fit.R.size[1] / 2 + 0.004; }   // açık avuç levhası topun / tüpün tam altında (içine girmez)
  }
  if (fit.L && fit.L.onGrip && u.gripR) { out.L = hand(fit.L, u.gripR.clone().add(V(...fit.L.p))); out.L.onGrip = true; }
  else if (fit.L && u.gripL) {
    out.L = hand(fit.L, u.gripL.clone().add(V(...fit.L.p)));
    const f = fit.L.under ? foreFit(g, u.gripL) : null;
    if (f && f.vert) out.L = { p: V(0, f.bot + 0.045, u.gripL.z), r: [0.12, 0, 0], size: [0.075, 0.085, 0.075], thumb: null, groove: 'front', vert: true };   // dikey tutamak: kabza gibi sarar
    else if (f) out.L.p.y = f.bot - fit.L.size[1] / 2 + 0.003;                        // avuç üstü kundak alt yüzüne 3 mm değer
    out.L.under = !!fit.L.under && !out.L.vert;
  }
  return out;
}
// ── animasyona göre el hedefleri: { R, L } → { p (silah yerel), r (Euler, silah yerel), free (0..1 kamera uzayı ağırlığı), freeP, el (dirsek çapası ağırlığı) }
// u: model userData (u.hands = fitSockets sonucu) · fx.ra: reloadAnim sonucu (oyunun eğrisi, üçüncü şahısla aynı)
export function handTargets(anim, t, fx, u, hold, style) {
  const H = u.hands || {}, R = H.R ? { p: H.R.p.clone(), r: H.R.r.slice(), free: 0, freeP: null } : null;
  let L = H.L ? { p: H.L.p.clone(), r: H.L.r.slice(), free: 0, freeP: null } : null;
  if (L && H.L.under && u.pump) L.p.z += fx.pump || 0;
  if (hold === 'melee' || hold === 'grenade') L = { p: V(), r: [0, 0, 0], free: 1, freeP: FREE.restL };
  const mix = (tgt, p, w) => tgt.p.lerp(p, w);
  if ((anim === 'reload' || anim === 'shell') && L && fx.ra) {
    const w = fx.ra.w;
    if (style === 'shell') { const port = V(...(u.port || [0, -0.03, -0.03])).add(V(-0.035, -0.045, 0.01)); mix(L, port, w.mag); L.free = w.pouch; L.freeP = FREE.pouch; }
    else {
      const ax = u.magAxis || [0, -1, 0], mg = (u.magPos ? u.magPos.clone() : V(0, -0.08, -0.1)).add(V(-0.03, -0.035, 0)).addScaledVector(V(...ax), (fx.magOut || 0) * 0.24 * (w.mag > 0.4 ? 1 : 0));
      const ch = u.charge ? V(-0.02, 0.07, -0.05 + (fx.charge || 0) * 0.06) : V(0.0, 0.08, -0.09);
      if (hold === 'pistol') mg.set(u.gripR.x - 0.03, u.gripR.y - 0.13, u.gripR.z + 0.03);
      mix(L, mg, w.mag); mix(L, ch, w.charge); L.free = w.pouch; L.freeP = FREE.pouch;
      if (w.mag > 0.5) L.r = [0.3, 0, 0.3];                                           // şarjörü kavrarken el hafif döner
    }
    L.el = 1 - w.fg;                                                                   // kundaktan ayrılınca dirsek dışarı-aşağı (ön kol prizması ekran kenarında)
  }
  if (anim === 'bolt' && R && u.bolt?.g) {
    const to = sm(t, 0, 0.18) * (1 - sm(t, 0.86, 1)), knob = u.bolt.g.position.clone().add(V(0.078, -0.022, 0).applyAxisAngle(V(0, 0, 1), u.bolt.g.rotation.z)).add(V(0.0, -0.04, 0.02));
    mix(R, knob, to); R.r = [H.R.r[0] * (1 - to), 0, -0.6 * to];
  }
  if (anim === 'pin' && L) {                                                        // sol kutu el pimi sol alttan tutar, çeker, geri döner (kamera önüne gelmez)
    const lIn = sm(t, 0, 0.4), pull = sm(t, 0.45, 0.7), lOut = sm(t, 0.72, 1), w = lIn * (1 - lOut);
    L.free = 1 - w; L.freeP = FREE.restL; L.p.copy(u.gripR).add(V(-0.06, 0.005 + pull * 0.025, 0.012 - pull * 0.07)); L.r = [0.25, 0.25, 0.75]; L.el = w; L.elK = 'Lpin';
  }
  if (anim === 'throw' && R) { const a = sm(t, 0.4, 0.6); R.free = a; R.freeP = FREE.afterThrow; }   // bırakıştan sonra açık avuç sağ altta görünür kalır
  return { R, L };
}

// ── çarpışma raporu: el kutusunun silah parçalarıyla (soketin oturduğu parça hariç, ince parçalar hariç) en büyük batma (mm). boxes: silah yerel OBB listesi {c,h,q,tag}
export function handOverlap(boxes, handP, handR, size, socket) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...handR)), h = [size[0] / 2, size[1] / 2, size[2] / 2], pts = [];
  for (const sx of [-1, 0, 1]) for (const sy of [-1, 0, 1]) for (const sz of [-1, 0, 1]) pts.push(V(sx * h[0], sy * h[1], sz * h[2]).applyQuaternion(q).add(handP));
  let worst = 0, part = '';
  const l = V();
  for (const b of boxes) {
    if (b.tag === 'mag' || b.h.x < 0.008 || b.h.y < 0.008 || b.h.z < 0.008) continue;   // şarjör (yüklemede el sarar) ve ince parça (tetik koruması, oluk) sayılmaz
    const qi = b.q.clone().invert(); l.copy(socket).sub(b.c).applyQuaternion(qi);
    if (Math.abs(l.x) <= b.h.x + 0.004 && Math.abs(l.y) <= b.h.y + 0.004 && Math.abs(l.z) <= b.h.z + 0.004) continue;   // soketin oturduğu parça (kabza / kundak): sarılması normal
    for (const p of pts) {
      l.copy(p).sub(b.c).applyQuaternion(qi);
      const dx = b.h.x - Math.abs(l.x), dy = b.h.y - Math.abs(l.y), dz = b.h.z - Math.abs(l.z), pen = Math.min(dx, dy, dz);
      if (pen > worst) { worst = pen; part = b.name || ''; }
    }
  }
  return { mm: Math.round(worst * 1000), part };
}
// ham parça OBB'leri (birleştirilmemiş model; çarpışma raporu için)
export function partBoxes(raw) {
  const out = []; raw.updateMatrixWorld(true);
  raw.traverse((m) => {
    if (!m.isMesh || !m.visible) return; m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox, c = bb.getCenter(V()), h = bb.getSize(V()).multiplyScalar(0.5), p = V(), q = new THREE.Quaternion(), sc = V(); m.matrixWorld.decompose(p, q, sc);
    let tag = ''; for (let o = m; o && o !== raw; o = o.parent) { if (o === raw.userData.mag) tag = 'mag'; else if (o.userData.frontSight) tag = 'sight'; }
    out.push({ c: c.multiply(sc).applyQuaternion(q).add(p), h: h.multiply(sc), q, tag });
  });
  return out;
}
