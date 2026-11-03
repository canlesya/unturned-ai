// 12.229 Bomba modu animasyonları (yalnız görsel; kurallar bomba.js'te). Üç yerden çağrılır, durum tek yerden (bmPose):
// · bmPose(g, s, dt): askerin bomba duruşu — kurma / imha (diz çökme ağırlığı k, eylemde geçen süre t), bomba elde (h), atış savruluşu (thr 0..1).
//   Kaynak: yetkili tarafta b.who / b.prog (çevrim içinde anlık görüntüden: yeni ileti yok), yerel oyuncuda basılı kullanma tuşu (gecikmesiz), s.bmHand,
//   s._bmThrowT (atış anı: yerelde tahmin, başkasında 'bmd' olayı). Karede bir kez hesaplanır (birinci şahıs + 3. şahıs aynı sonucu okur).
// · FpBomb (birinci şahıs, ViewModel kamerasında): silah aşağı iner, kutu eller bombayı tutar (bomba eldeyken göğüs önünde); kurarken bomba öne-aşağı
//   iner, sağ işaret parmağı tuş takımına basar (lamba her basışta yanar), son 0,45 sn yere bırakılır; imha: iki el aşağıda kabloyla uğraşır;
//   atış: tıklama anında bomba elden çıkar (dünyadaki uçan model sağ omuzdan başlar), eller öne itip iner. Kurma / imhada kamera hafifçe çöker / aşağı bakar (Player: vm.bmDip).
// · bmTp (3. şahıs, Soldier.syncModel): sağ diz yerde, sol diz dik diz çökme, gövde öne eğik; kollar (character.js applyPose → tpBombArms) bombayı
//   göğüs önünden kurana göre önde-sağda yere indirir, tuşlar; imha: eller yerde. Bomba elde: iki el göğüs önünde, silah gizli. Taşıyan (elinde değilken):
//   sırtında küçük bomba (yalnız saldıran takım görür; çevrim içinde savunana taşıyan zaten bilinmez).
import * as THREE from 'three';
import { box } from '../core/geo.js';
import { TEAMS } from '../core/palette.js';
import { LIMITS } from './balance.js';
import { makeBomb } from '../models/bombModel.js';

export const BM_THROW_T = 0.5;                                    // atış savruluşu (sn)
export const BM_SPOT = { x: 0.12, z: -0.52, ry: 0.25 };          // kurulan bombanın yeri: kuranın gövde yerelinde önde-sağda (bomba.js plant aynı noktayı kullanır)
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const cl = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

// ───── ortak durum ─────
export function bmPose(g, s, dt) {
  const B = g.bomba;
  if (!B || !s) return null;
  const P = (s._bmP ||= { k: 0, h: 0, t: 0, kind: null, last: null, thr: -1, show: false, at: -1, lp: 0 });
  if (P.at === g.time) return P;
  P.at = g.time;
  const b = B.bomb, me = s === g.playerSoldier, ok = s.alive && !s.veh && B.live;
  let kind = null;
  if (ok && b.st === 'carried' && s.team === B.att && ((b.who === s && b.prog > 0) || (me && s.bmUse && B.useKind(s) === 'plant' && B.still(s)))) kind = 'plant';
  else if (ok && b.st === 'planted' && ((b.who === s && b.prog > 0) || (me && s.bmUse && B.useKind(s) === 'defuse' && B.still(s)))) kind = 'defuse';
  if (kind !== P.kind) P.t = 0; else if (kind) P.t += dt;
  if (kind && b.who === s) {                                       // yetkili ilerleme baştan aldıysa (ateş / hasar) ya da çok gerideysek ona otur
    if (b.prog + 0.25 < P.lp || Math.abs(P.t - b.prog) > 0.6) P.t = b.prog;
    P.lp = b.prog;
  } else P.lp = 0;
  P.kind = kind; if (kind) P.last = kind;
  const tt = s._bmThrowT != null ? (g.time - s._bmThrowT) / BM_THROW_T : -1;
  P.thr = s.alive && tt >= 0 && tt < 1 ? tt : -1;
  const hold = (s.alive && !s.veh && !!s.bmHand) || P.thr >= 0;
  P.k = lerp(P.k, kind ? 1 : 0, Math.min(1, dt * 7));
  P.h = lerp(P.h, hold ? 1 : 0, Math.min(1, dt * 8));
  if (!s.alive) { P.k = 0; P.h = 0; }
  P.show = b.st === 'carried' && (kind === 'plant' || !!s.bmHand || (P.last === 'plant' && P.k > 0.05 && (b.carrier === s || b.who === s || !b.carrier)));
  return P;
}

// ───── birinci şahıs ─────
const ELB_R = new THREE.Vector3(0.34, -0.66, -0.06), ELB_L = new THREE.Vector3(-0.34, -0.66, -0.06), Z = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const FP_S = 0.5;                                                  // birinci şahısta bomba ölçeği (dünya modeli 0,42 m; elde ekranı kaplamasın)
export class FpBomb {
  constructor(vm) {
    this.vm = vm;
    this.G = new THREE.Group(); this.G.visible = false; vm.cam.add(this.G);
    this.bomb = makeBomb(); this.bomb.scale.setScalar(FP_S); this.G.add(this.bomb);
    this.bomb.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.key = ''; this.hR = this.hL = null; this.lower = 0; this.dip = 0; this.tapI = -1;
  }
  hands(team) {
    const look = this.vm.look, key = team + '|' + JSON.stringify(look || {});
    if (key === this.key) return;
    this.key = key;
    for (const h of [this.hR, this.hL]) if (h) { this.G.remove(h); h.traverse((o) => o.geometry?.dispose()); }
    const c = { ...TEAMS[team], ...(look || {}) };
    const mk = () => {
      const grp = new THREE.Group();
      box(grp, [0.046, 0.074, 0.085], c.gloves, [0, 0, 0]);                                // eldiven (bombanın yanını kavrar)
      box(grp, [0.048, 0.022, 0.03], c.gloves, [0, 0.042, -0.016]);                       // parmaklar üstten sarkar
      const fin = box(grp, [0.014, 0.042, 0.014], c.gloves, [-0.012, -0.05, -0.032]);       // işaret parmağı (yalnız tuşlarken: ucu tuşa iner)
      fin.visible = false; grp.userData.finger = fin;
      const sl = box(grp, [0.072, 0.072, 0.46], c.shirt, [0, 0, 0]);
      if (c.cuff) box(sl, [0.088, 0.088, 0.06], c.cuff, [0, 0, -0.2]);
      grp.userData.sleeve = sl;
      grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      this.G.add(grp);
      return grp;
    };
    this.hR = mk(); this.hL = mk();
  }
  // kol kutusu: elden kamera uzayındaki dirsek noktasına
  sleeve(h, elbow) {
    const sl = h.userData.sleeve;
    this.G.updateMatrix(); h.updateMatrix();
    _m.multiplyMatrices(this.G.matrix, h.matrix).invert();
    _a.copy(elbow).applyMatrix4(_m).normalize();
    sl.position.copy(_a).multiplyScalar(0.23 + 0.03); sl.quaternion.setFromUnitVectors(Z, _a);
  }
  update(dt, p, s) {
    const g = this.vm.game, P = bmPose(g, s, dt), vm = this.vm;
    if (!P || !s.alive || s.veh) { this.G.visible = false; this.lower = Math.max(0, this.lower - dt * 6); this.dip = lerp(this.dip, 0, Math.min(1, dt * 8)); vm.bmDip = this.dip; return this.lower; }
    const W = Math.max(P.h, P.k);
    this.lower = W;
    const kneel = P.last === 'defuse' ? 0 : 1, k = sm(P.k), h = sm(P.h);
    this.dip = lerp(this.dip, P.kind ? 1 : 0, Math.min(1, dt * 6)); vm.bmDip = this.dip;
    const up = sm(cl((W - 0.3) / 0.7));                              // silah indikten sonra eller yükselir
    this.G.visible = up > 0.01;
    if (!this.G.visible) return W;
    this.hands(s.team);
    const T = LIMITS.bmPlant, t = P.t, G = this.G, hR = this.hR, hL = this.hL;
    // tutuş (bomba elde) pozu
    let px = 0.05, py = -0.155, pz = -0.56, rx = 0.55, ry = -0.12, rz = 0.04;
    const sx = 0.21 * FP_S + 0.024, hy = 0.06;
    hR.position.set(sx, hy, 0.02); hL.position.set(-sx, hy, 0.02); hR.rotation.set(0, 0, 0); hL.rotation.set(0, 0, 0);
    let bombOn = P.show, tap = -1;
    hR.userData.finger.visible = false;
    if (P.thr >= 0) {                                                  // atış: bomba tıklama anında elden çıkar (dünyadaki uçan model sağ omuzdan başlar), eller öne-yukarı itip (0–0,3) iner
      const b2 = sm(P.thr / 0.28), c = sm((P.thr - 0.25) / 0.6);
      pz += -0.16 * b2; py += 0.05 * b2 - 0.4 * c; rx += 0.25 * b2 - 0.5 * c;
      bombOn = false;
    }
    if (P.last && k > 0.001) {
      if (P.last === 'plant') {                                        // kurma: öne-aşağı, tuşlama, sonda yere bırakma
        const e0 = sm(t / 0.35), e1 = sm((t - (T - 0.45)) / 0.45);
        const qx = 0.0, qy = -0.13 - 0.34 * e1, qz = -0.5 - 0.05 * e1, qrx = 0.8 + 0.3 * e1, qry = -0.04;
        px = lerp(px, qx, k * e0); py = lerp(py, qy, k * e0); pz = lerp(pz, qz, k * e0); rx = lerp(rx, qrx, k * e0); ry = lerp(ry, qry, k * e0); rz = lerp(rz, 0, k * e0);
        if (P.kind === 'plant' && t > 0.35 && t < T - 0.4) {          // sağ el tuş takımına: 0,22 sn'de bir başka tuş, basışta 1,2 cm iner
          const n = Math.floor((t - 0.35) / 0.22), f = ((t - 0.35) / 0.22) % 1, top = 0.17 * FP_S;
          const kx = (j) => (((j * 5) % 3) - 1) * 0.03 * FP_S, kz = (j) => (0.05 + (((j * 7) % 3) - 1) * 0.024) * FP_S;
          const mv = f < 0.5 ? 0 : sm((f - 0.5) / 0.5), press = f < 0.5 ? Math.sin((f / 0.5) * Math.PI) * 0.012 : -Math.sin(mv * Math.PI) * 0.008;      // bas → kalk, sıradaki tuşa geç
          const tx = lerp(kx(n), kx(n + 1), mv), tz = lerp(kz(n), kz(n + 1), mv);
          const a = sm(cl((t - 0.35) / 0.15));
          hR.position.set(lerp(sx, tx + 0.038, a), lerp(hy, top + 0.0345 - press, a), lerp(0.02, tz + 0.032, a));      // parmak ucu tuşta: el tuş takımının sağında, parmak sola-aşağı (görüşü kapatmaz)
          hR.rotation.set(0, 0, -0.6 * a);
          hR.userData.finger.visible = a > 0.5;
          tap = f < 0.5 ? n : -1;
        }
      } else {                                                         // imha: eller aşağıda, sağ el kabloyu döndürür / çeker
        const qx = 0, qy = -0.17, qz = -0.5, w = k;
        px = lerp(px, qx, w); py = lerp(py, qy, w); pz = lerp(pz, qz, w); rx = lerp(rx, 0.95, w); ry = lerp(ry, 0, w); rz = lerp(rz, 0, w);
        const f = t * 2.6;
        hR.position.set(lerp(sx, 0.06 + Math.sin(f) * 0.02, w), lerp(hy, 0.05 + Math.abs(Math.sin(f * 1.7)) * 0.02, w), lerp(0.02, 0.03 + Math.cos(f) * 0.015, w));
        hL.position.set(lerp(-sx, -0.08, w), lerp(hy, 0.045, w), lerp(0.02, 0.05, w));
        hR.rotation.set(-0.6 * w, 0, 0.3 * w); hL.rotation.set(-0.5 * w, 0, -0.2 * w);
        bombOn = false;
      }
    }
    // giriş / çıkış: aşağıdan gelir
    py -= (1 - up) * 0.32; rx -= (1 - up) * 0.5;
    G.position.set(px, py, pz); G.rotation.set(rx, ry, rz);
    this.bomb.visible = bombOn;
    hR.visible = hL.visible = true;
    this.sleeve(hR, ELB_R); this.sleeve(hL, ELB_L);
    // lamba: tuşa basınca kısa yanar, elde sönük
    if (tap !== this.tapI) { this.tapI = tap; if (tap >= 0) this.blink = 0.09; }
    this.blink = Math.max(0, (this.blink || 0) - dt);
    this.bomb.userData.lampMat.color.set(this.blink > 0 ? '#ff3b2b' : '#5a1410');
    return W;
  }
  dispose() { this.vm.cam.remove(this.G); this.G.traverse((o) => o.geometry?.dispose()); }
}

// ───── 3. şahıs ─────
// Soldier.syncModel (bacaklar / gövde hesaplandıktan sonra, refreshHold'dan önce): diz çökme + refreshHold'a giden kol seçenekleri (yoksa null)
export function bmTp(s, m, p, dt) {
  const g = s.game, P = bmPose(g, s, dt), B = g.bomba;
  p.torso.position.z = 0;
  if (!P) return null;
  const b = B.bomb, viewer = g.playerSoldier;
  const back = b.st === 'carried' && b.carrier === s && s.alive && !s.veh && !s.bmHand && P.thr < 0 && !!viewer && viewer.team === B.att;
  const k = sm(P.k);
  if (k > 0.001) {
    const L = p.legs.L, R = p.legs.R;
    // sağ diz yerde (uyluk öne 0,61, baldır geriye yatay, ayak parmakları yerde), sol ayak düz basar (uyluk ~yatay, baldır geriye eğik)
    R.hip.rotation.x = lerp(R.hip.rotation.x, 0.61, k); R.knee.rotation.x = lerp(R.knee.rotation.x, -2.18, k); if (R.foot) R.foot.rotation.x = lerp(R.foot.rotation.x, 0, k);
    L.hip.rotation.x = lerp(L.hip.rotation.x, 1.4, k); L.knee.rotation.x = lerp(L.knee.rotation.x, -2.07, k); if (L.foot) L.foot.rotation.x = lerp(L.foot.rotation.x, 0.67, k);
    R.hip.rotation.z = lerp(R.hip.rotation.z, 0.06, k); L.hip.rotation.z = lerp(L.hip.rotation.z, -0.1, k);
    R.hip.position.y = lerp(R.hip.position.y, 0.44, k); L.hip.position.y = lerp(L.hip.position.y, 0.44, k);
    const lean = P.last === 'defuse' ? 0.78 : 0.88;
    p.torso.position.y = lerp(p.torso.position.y, 0.73, k);
    p.torso.position.z = -0.1 * k;
    p.torso.rotation.x = lerp(p.torso.rotation.x, -lean, k);
    p.torso.rotation.z = lerp(p.torso.rotation.z, 0, k);
    p.head.rotation.x = lerp(p.head.rotation.x, 0.42, k);
  }
  if (P.k < 0.003 && P.h < 0.003 && !back) { if (m.bmMesh) m.bmMesh.visible = false; if (m.bmBack) m.bmBack.visible = false; return null; }
  // imha: eller kurulu bombanın gerçek yerine (kök yerelinde; kolun yetiştiği kadar)
  let bx = null, bz = null;
  if (P.last === 'defuse' && (b.st === 'planted' || b.st === 'defused')) { const dx = b.x - s.pos.x, dz = b.z - s.pos.z, a = s.bodyYaw ?? s.yaw, c = Math.cos(a), sn = Math.sin(a); bx = dx * c - dz * sn; bz = dx * sn + dz * c; }
  return { k, h: sm(P.h), kind: P.last, t: P.t, thr: P.thr, show: P.show, gy: -(m.groundOffset ?? 0), back, bx, bz };
}

// character.js applyPose sonunda (silah pozu çözüldükten sonra): kolları bombaya götürür, bomba modelini yerleştirir (gövde yerelinde)
const HOLD_P = new THREE.Vector3(0.0, -0.09, -0.36), HOLD_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0));
const SIDE_R = new THREE.Vector3(0.235, 0.1, 0.0), SIDE_L = new THREE.Vector3(-0.235, 0.1, 0.0);
const _inv = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _gp = new THREE.Vector3(), _gq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bq = new THREE.Quaternion();
const _hr = new THREE.Vector3(), _hl = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
export function tpBombArms(api, w, o, poseArm) {
  const { torso, armR, armL } = api.parts;
  // sırttaki bomba (taşıyan, elinde değil)
  if (o.back && !api.bmBack) {
    const bk = api.bmBack = makeBomb(); bk.scale.setScalar(0.6); bk.rotation.x = Math.PI / 2;
    const bb = new THREE.Box3(), tb = new THREE.Box3();
    for (const c of torso.children) if (c.isMesh && c.geometry) { c.geometry.computeBoundingBox(); tb.copy(c.geometry.boundingBox).applyMatrix4(c.matrix); bb.union(tb); }
    bk.position.set(0, -0.06, (bb.isEmpty() ? 0.13 : bb.max.z) + 0.003);
    torso.add(bk);
  }
  const W = Math.max(o.k, o.thr >= 0 ? o.h * (o.thr > 0.5 ? 1 - (o.thr - 0.5) / 0.5 : 1) : o.h);
  if (api.bmBack) api.bmBack.visible = !!o.back && W < 0.3;
  if (W < 0.003) { if (api.bmMesh) api.bmMesh.visible = false; if (w) w.visible = true; return; }
  if (o.show && !api.bmMesh) { api.bmMesh = makeBomb(); torso.add(api.bmMesh); }
  torso.updateMatrix(); _inv.copy(torso.matrix).invert(); _tq.copy(torso.quaternion).invert();
  // yer noktası (kök yerelinde: kuranın önü-sağı, yer kotu) → gövde yereli
  _gp.set(BM_SPOT.x, o.gy, BM_SPOT.z);
  if (o.bx != null) { const L = Math.hypot(o.bx, o.bz), d = cl(L, 0.32, 0.6); if (L > 1e-3 && o.bz / L < -0.3) _gp.set((o.bx / L) * d, o.gy, (o.bz / L) * d); }      // imha: bombaya doğru (önündeyse)
  _gp.applyMatrix4(_inv);
  _gq.copy(_tq).multiply(_q.setFromAxisAngle(_Y, BM_SPOT.ry));
  // bomba pozu: göğüs önü (tutuş / atış) → yer (kurma)
  _bp.copy(HOLD_P); _bq.copy(HOLD_Q);
  if (o.thr >= 0) { const b2 = sm(o.thr / 0.3); _bp.y += 0.28 * b2; _bp.z -= 0.3 * b2; }                // atış: eller öne-yukarı itilir (bomba tıklama anında elden çıktı)
  const kn = o.kind === 'plant' ? o.k * sm(o.t / 0.5) : 0;
  if (kn > 0) { _bp.lerp(_gp, kn); _bq.slerp(_gq, kn); }
  // eller: bombanın iki yanı; kurarken (bomba yerde) sağ el tuş takımına basar, sol el bombayı tutar; imhada iki el yerde
  _hr.copy(SIDE_R).applyQuaternion(_bq).add(_bp); _hl.copy(SIDE_L).applyQuaternion(_bq).add(_bp);
  if (o.kind === 'plant' && kn > 0.98) {
    const tt = o.t - 0.5, n = Math.floor(tt / 0.25), f = (tt / 0.25) % 1, press = tt > 0 ? Math.sin(cl(f / 0.5) * Math.PI) * 0.025 : 0;
    _t1.set(((n * 5) % 3 - 1) * 0.03, 0.235 - press, 0.06).applyQuaternion(_gq).add(_gp);
    _hr.lerp(_t1, sm(tt / 0.2));
    _t2.set(-0.17, 0.2, 0.02).applyQuaternion(_gq).add(_gp); _hl.lerp(_t2, sm(tt / 0.2));
  } else if (o.kind === 'defuse' && o.k > 0) {
    const f = o.t * 2.6;
    _t1.set(0.05 + Math.sin(f) * 0.03, 0.22 + Math.abs(Math.sin(f * 1.7)) * 0.03, 0.05).applyQuaternion(_gq).add(_gp);
    _t2.set(-0.1, 0.21, 0.07).applyQuaternion(_gq).add(_gp);
    _hr.lerp(_t1, o.k); _hl.lerp(_t2, o.k);
  }
  const wv = Math.min(1, W * 1.25);
  _hr.copy(_t1.copy(armR.hand.position).lerp(_hr, wv)); _hl.copy(_t2.copy(armL.hand.position).lerp(_hl, wv));
  poseArm(armR, _hr); poseArm(armL, _hl);
  if (w) w.visible = W < 0.45;
  const bm = api.bmMesh;
  if (bm) { bm.visible = !!o.show && W > 0.45 && !(o.thr >= 0); bm.position.copy(_bp); bm.quaternion.copy(_bq); }
}
