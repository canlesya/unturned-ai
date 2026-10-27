// 12.195 Yeniden doldurma noktaları (silah yerelinde): reloadPlan.js'teki adların modeldeki yeri. Birinci şahıs (player.js) ve üçüncü şahıs
// (character.js) aynı fonksiyonu kullanır; noktalar modelin şarjör ağından ölçülür (şarjörün sol yüzü / tabanı), silaha özel ayar RG tablosunda.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const HW = 0.05;                     // kutu el yarı eni (eldiven 0,1 m)
// Silaha özel ayarlar (m, silah yerelinde): G = şarjör tutma noktası (el merkezi), out = çıkış yönü, L = çıkış boyu, cH = kurma kolu (el merkezi),
// pull = kurma kolu çekme yönü × boy, vA / vC = ara noktalar, port = fişek ağzı (el merkezi), tT = üst kapak (makineli)
export const RG = {
  // P90: şarjör üstte yatar; sol el şarjörün sol yüzünden kavrar, arka ucu kalkarak geriye çekilir, takarken arkadan öne / aşağı kayar.
  // El silahın altından (kundak halkası) sol dış şeritten yukarı çıkar (eskiden gövdenin içinden geçip havada kalıyordu)
  p90: { G: [-0.082, 0.086, 0.035], out: [0, 0.42, 0.91], L: 0.17, vF: [-0.125, -0.13, -0.12], cH: [-0.086, 0.028, -0.19], pull: [0, 0, 0.06], vC: [-0.12, 0.03, -0.08] },
  // AR (M4 / Lazer / G36): T kol arka gezin altında kaldığından sol el gövdenin sol yanından çeker (gezin içinden geçmez)
  aug: { cH: [-0.075, 0.035, -0.12], vC: [-0.12, -0.02, 0.0] },                              // AUG: sol yan, ön
  scarh: { cH: [-0.078, 0.035, -0.22] }, mp5: { cH: [-0.072, 0.03, -0.27] }, 
  vector: { cH: [-0.075, 0.03, -0.03] }, mac10: { }, aa12: { cH: [-0.08, 0.04, -0.12] },
  svd: { cH: [-0.075, 0.03, -0.11] }, barrett: { cH: [-0.09, 0.04, -0.06] },
  lmg: { tT: [-0.02, 0.162, -0.02], vT: [-0.09, 0.08, -0.06], cH: [-0.085, 0.03, -0.03] },      // kapak: gövde üstü 0,107
  pkm: { tT: [-0.01, 0.156, -0.05], vT: [-0.088, 0.075, -0.06], cH: [-0.085, 0.025, -0.03] },      // kapak: gövde üstü 0,091
  rpg: { L: 0.3, G: [-0.1, 0.05, -0.53] },
  shotgun: { port: [0, -0.074, -0.095] },
  pbpistol: { L: 0.16 },
  railgun: { cH: [-0.08, 0.04, -0.08] }, elmg: { cH: [-0.09, 0.04, -0.1] },
  ww_mg: { L: 0.16 }, ww_smgr: { vF: [-0.065, -0.1, -0.2] }, ww_lmg: { cH: [-0.075, 0.03, -0.09] },
};

function magVerts(mag) {
  const pts = [], m = new THREE.Matrix4();
  mag.updateMatrix();
  mag.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    m.identity(); for (let p = o; p && p !== mag; p = p.parent) { p.updateMatrix(); m.premultiply(p.matrix); }
    const pa = o.geometry.attributes.position, v = V();
    const step = Math.max(1, Math.floor(pa.count / 600));
    for (let i = 0; i < pa.count; i += step) pts.push(v.fromBufferAttribute(pa, i).applyMatrix4(m).clone());
  });
  return pts;
}
function bbOf(pts) { const b = new THREE.Box3(); for (const p of pts) b.expandByPoint(p); return b; }

// Grup ağ köşelerinin silah yerelindeki kutusu (grup dinlenme konumunda: konum / dönüş yok sayılır)
function groupVerts(grp) {
  const pts = [], m = new THREE.Matrix4();
  grp.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    m.identity(); for (let p = o; p && p !== grp; p = p.parent) { p.updateMatrix(); m.premultiply(p.matrix); }
    const pa = o.geometry.attributes.position, v = V();
    for (let i = 0; i < pa.count; i += Math.max(1, Math.floor(pa.count / 400))) pts.push(v.fromBufferAttribute(pa, i).applyMatrix4(m).clone());
  });
  return pts;
}

export function reloadGeo(u, id, mode) {
  if (u._rlg && u._rlg.mode === mode) return u._rlg;
  const o = RG[id] || {}, P = {};
  const out = V(...(o.out || u.magAxis || [0, -1, 0])).normalize();
  const L = o.L ?? (mode === 'clip' ? 0.07 : 0.2);
  let G = null, mbb = null;
  if (u.mag) {
    const pts = magVerts(u.mag); mbb = bbOf(pts);
    const c = mbb.getCenter(V());
    if (o.G) G = V(...o.G);
    else if (mode === 'clip') G = V(c.x - 0.012, mbb.max.y + HW + 0.004, c.z);                         // klips: başparmak üstten bastırır (el klipsin üstünde)
    else if (mode === 'hopper') G = V(c.x, mbb.max.y + HW, mbb.min.z - 0.02);
    else if (Math.abs(out.y) >= 0.7) {                                                                // dik şarjör: sol yüzün taban tarafı
      const h = mbb.max.y - mbb.min.y, yg = h < 0.1 ? c.y : out.y < 0 ? mbb.min.y + 0.045 : mbb.max.y - 0.045;
      const near = pts.filter((p) => Math.abs(p.y - yg) < 0.025);
      const xs = near.length ? Math.min(...near.map((p) => p.x)) : mbb.min.x, zs = near.length ? near.reduce((a, p) => a + p.z, 0) / near.length : c.z;
      G = V(xs - HW - 0.004, yg, zs);
    } else if (Math.abs(out.x) >= 0.7) G = V(c.x, mbb.min.y - HW - 0.004, c.z);                        // yan şarjör (tava / kutu): alttan
    else G = V(mbb.min.x - HW - 0.004, c.y, c.z);                                                    // boyuna şarjör (tüp / roket): sol yüz
  }
  if (!G) G = V(-0.08, -0.04, -0.06);
  P.mG = G; P.mO = G.clone().addScaledVector(out, L); P.mA = G.clone().addScaledVector(out, L * 0.55); P.mT = G.clone().addScaledVector(out, -0.012);
  P.vP = o.vP ? V(...o.vP) : P.mA.clone().add(V(-0.075, -0.02, 0.02));                                // cep ↔ şarjör yolu: solun dışından
  // kurma kolu (varsayılan: şarjör yuvasının üstünde sol yan) + çekilmiş hali
  const cz = mbb ? (mbb.min.z + mbb.max.z) / 2 + 0.03 : -0.08;
  P.cH = o.cH ? V(...o.cH) : V(-0.085, mbb ? Math.max(mbb.max.y + 0.045, -0.005) : 0.02, cz);
  P.cB = P.cH.clone().add(V(...(o.pull || [0, 0, 0.07])));
  P.vC = o.vC ? V(...o.vC) : P.cH.clone().lerp(G, 0.5).add(V(-0.02, 0, 0));
  // makineli üst kapak (kayışı yatır, kapağı vur)
  P.tT = o.tT ? V(...o.tT) : V(0, 0.12, cz);
  P.tF = P.tT.clone().add(V(-0.04, 0.05, -0.02));
  P.vT = o.vT ? V(...o.vT) : V(-0.12, (G.y + P.tF.y) / 2, (G.z + P.tF.z) / 2);
  // fişek ağzı (pompalı: gövde altı) / klips yaklaşma / hazne
  P.port = o.port ? V(...o.port) : V(0, -0.075, -0.08);
  P.pA = P.port.clone().add(V(-0.03, -0.06, 0.05));
  P.cA = P.mO.clone().add(V(-0.02, 0.07, 0.03));
  const geo = { mode, P, G, out, L, mbb, vA: o.vA ? V(...o.vA) : null, vF: o.vF ? V(...o.vF) : null };
  // eğilme ekseni: şarjör elde çekilirken tabanı hafifçe öne döner
  geo.tAx = Math.abs(out.x) >= 0.7 ? V(0, 0, 1) : V(1, 0, 0);
  // kırma namlu (M79 / çift namlu): menteşe ve yatak
  if (u.brk) {
    const pts = groupVerts(u.brk.g), b = bbOf(pts), piv = u.brk.pivot;
    geo.brk = { A: u.brk.angle ?? -0.6, piv: V(0, piv[0], piv[1]) };
    const back = pts.filter((p) => p.z > b.max.z - 0.004), ry = back.length ? back.reduce((a, p) => a + p.y, 0) / back.length : (b.min.y + b.max.y) / 2;
    const rear = V(0, ry + piv[0], b.max.z + 0.002 + piv[1]);                                          // namlu arka ağzı (kapalıyken; grup yereli + menteşe)                                        // namlu arka ağzı (kapalıyken)
    geo.brk.rear = rear;
  }
  // revolver silindiri
  if (u.slide?.kind === 'cyl') {
    const pts = groupVerts(u.slide.g), b = bbOf(pts);
    geo.cyl = { out: V(-0.044, -0.012, 0), rear: V(0, (b.min.y + b.max.y) / 2 + u.slide.pivot, b.max.z) };
  }
  // sürgü kolu (sağ el): sürgü grubunun en sağdaki noktası (topuz) · ww2: chargePos
  if (u.bolt) {
    const pts = groupVerts(u.bolt.g); let kn = pts[0] || V();
    for (const p of pts) if (p.x > kn.x) kn = p;
    kn = u.chargePos ? V(...u.chargePos) : kn.clone().add(V(0, u.bolt.pivot, 0));
    geo.knob = kn;
  }
  // paintball haznesinin kapağı: arka kenar menteşe
  if (mode === 'hopper' && mbb) { geo.lid = { piv: V(0, mbb.min.y, mbb.max.z), A: 1.7 }; P.lF = V(mbb.min.x - 0.02, mbb.max.y + 0.035, mbb.min.z - 0.01); P.lO = P.lF.clone().add(V(-0.03, 0.08, 0.06)); P.vH = V(-0.115, (P.lF.y + (u.gripL?.y ?? 0)) / 2, P.lF.z); P.pP = V(0, mbb.max.y + 0.12, (mbb.min.z + mbb.max.z) / 2); P.pA = P.pP.clone().add(V(-0.06, 0.06, 0.04)); }
  u._rlg = geo;
  return geo;
}

const _q = new THREE.Quaternion(), _ax = V(1, 0, 0);
// Kırma namlunun t (0..1) açıklığında bir noktanın yeri
export function brkPoint(geo, p, t, out = V()) {
  out.copy(p); if (!geo.brk || !t) return out;
  _q.setFromAxisAngle(_ax, geo.brk.A * t);
  return out.sub(geo.brk.piv).applyQuaternion(_q).add(geo.brk.piv);
}
// Ada göre nokta (silah yerelinde). ex: { fg, gR, pouch, ra } (pouch silah yerelinde, kareye göre)
export function namedPoint(geo, name, ra, ex, out = V()) {
  const P = geo.P;
  switch (name) {
    case 'fg': return out.copy(ex.fg || ex.pouch);
    case 'fgB': return brkPoint(geo, ex.fg || ex.pouch, ra?.brk ?? 1, out);                         // el namluyla birlikte döner (açılırken / kapanırken)
    case 'vB': return brkPoint(geo, ex.fg || ex.pouch, 1, out).add(_t2.set(-0.06, -0.02, 0.03));         // açık namluya sol alttan
    case 'pouch': return out.copy(ex.pouch);
    case 'gR': return out.copy(ex.gR);
    case 'vR': return out.copy(ex.gR).add(_vrOff);                                            // sağ el kabzadan sürgüye sağ dıştan
    case 'vF': { if (geo.vF) return out.copy(geo.vF); return out.copy(ex.fg || ex.pouch).add(_vfOff); }      // kundağa sol alttan girip çıkar
    case 'vA': { if (geo.vA) return out.copy(geo.vA); const f = ex.fg || ex.pouch; out.copy(f).lerp(geo.G, 0.5); out.x = Math.min(out.x - 0.035, geo.G.x, -0.09); out.y -= 0.02; return out; }
    case 'bH': return out.copy(geo.knob || ex.gR).add(_kOff);
    case 'bO': return boltOpen(ex.u, geo.knob || ex.gR, out).add(_kOff);
    case 'bA': case 'bP': case 'port': case 'pA': {                                            // kırma namlu yatağı: parça (40 mm / fişek) elin sağında, namlu ekseninde içeri itilir
      const b = geo.brk; if (!b) return out.copy(P[name === 'bA' ? 'pA' : name === 'bP' ? 'port' : name]);
      const far = name === 'bA' || name === 'pA', it = geo.mode === 'shell' ? 'shell' : 'round';
      brkPoint(geo, b.rear, 1, out).sub(itemOff(geo, it, 1, _t1)).add(_t2.set(0, 0, far ? 0.09 : -0.012).applyAxisAngle(_ax, b.A));
      if (far) out.add(_t2.set(-0.025, 0.02, 0)); return out;
    }
    case 'sA': case 'sP': { const c = geo.cyl; if (!c) return out.copy(P.port); out.copy(c.rear).add(c.out).add(_ldOff); if (name === 'sA') out.add(V(-0.02, -0.02, 0.07)); return out; }
    default: return out.copy(P[name] || ex.fg || ex.pouch);
  }
}
// el merkezine göre parçanın yeri: sürgü topuzu el merkezinin solunda (el topuzun sağında) · 40 mm el üstünde önde · doldurucu el önünde
const _vfOff = V(-0.045, -0.035, 0.02), _vrOff = V(0.075, 0.03, 0.0), _kOff = V(0.046, -0.008, 0.0), _ldOff = V(-0.042, -0.005, 0.07);
export const ITEM_OFF = { shell: V(0, 0.056, -0.012), round: V(0, 0.058, -0.055), loader: V(0.042, 0.005, -0.07), pod: V(0, 0.07, -0.01) };
const ITEM_BRK = { shell: V(0.066, 0.0, -0.03), round: V(0.078, 0.0, -0.035) };            // kırma namluda parça elin sağında (el gövdenin solundan gelir)
const _t1 = V(), _t2 = V();
// eldeki parçanın el merkezine göre yeri (kırma namluda namluyla aynı açıda)
export function itemOff(geo, name, t, out = V()) {
  if (geo.brk && ITEM_BRK[name]) return out.copy(ITEM_BRK[name]).applyAxisAngle(_ax, geo.brk.A * t);
  return out.copy(ITEM_OFF[name] || ITEM_OFF.shell);
}
function boltOpen(u, kn, out) {
  out.copy(kn);
  if (!u?.bolt) return out;
  const piv = u.bolt.pivot;
  if (!u.boltSlide) { out.y -= piv; out.applyAxisAngle(V(0, 0, 1), 0.9); out.y += piv; }
  out.z += 0.085;
  return out;
}
// Karışım katsayılarından konum
export function blendPoint(geo, list, ra, ex, out = V()) {
  out.set(0, 0, 0); const t = V();
  for (const [n, c] of list) out.addScaledVector(namedPoint(geo, n, ra, ex, t), c);
  return out;
}
