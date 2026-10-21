import * as THREE from 'three';
import { createWeapon } from '../models/weapons.js';
import { createWeaponU, isNew } from './weaponsUnturned.js';
import { mat } from '../core/geo.js';
import { WSTATS } from '../game/stats.js';
import { ANIMS } from './anims.js';
import { BoxArm, fitFor, ELBOW, handTargets, handOverlap } from './boxarm.js';
import { WEAPONS } from '../models/weapons.js';
import { WEAPONS_U } from './weaponsUnturned.js';

// Elsiz birinci şahıs rig'i (lab4, Unturned tarzı): kamera → root (duruş) → wg (ölçek) → silah. El / kol YOK.
// V1 "tamamen elsiz" · V3 "kare el" (boxarm.js: pahlı kutu el + prizma ön kol, sokete rijit) · V2 "blok kol": kabza ve kundak soketinden ekranın sağ-alt / sol-alt köşesine inen rijit kutu kol kütükleri (IK yok, parmak yok).
// Bel duruşu: silah iri, sağ-altta, namlu hafif yukarı-sola (referans ekran görüntüsü) · Nişan: nişangâh merkezde · Koşu: silah iner, yana yatar.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const POSE = {                                                               // bel duruşu (kamera uzayı, ölçekli model): p konum, r Euler XYZ
  rifle:    { p: [0.25, -0.29, -0.3], r: [0.2, 0.32, -0.28], s: 1.5 },                     // iri, sağ-alt, namlu yukarı-sola, hafif sola yatık (şarjör görünür)
  launcher: { p: [0.25, -0.29, -0.3], r: [0.2, 0.32, -0.28], s: 1.5 },
  pistol:   { p: [0.15, -0.1, -0.36], r: [0.14, 0.18, -0.12] },
  melee:    { p: [0.15, -0.12, -0.28], r: [0.55, 0.45, -0.35] },                      // bıçak: sağ altta, ağız öne-yukarı-sola
  grenade:  { p: [0.16, -0.13, -0.34], r: [0.25, 0.1, 0.0] },
};
export const POSE_ID = { sniper: { p: [0.22, -0.26, -0.36], r: [0.12, 0.25, -0.05], s: 1.3 } };   // silaha özel bel duruşu (dürbün üstte kalsın)
export const SCALE = 1.25;                                                          // tabanca / bıçak / bomba; tüfekler POSE.s (1,5)                                                          // oyun 0,92; Unturned çerçevesi için daha iri
const SPRINT = { gun: { p: [-0.02, -0.03, 0.0], r: [-0.25, 0.3, 0.1] }, melee: { p: [-0.04, 0.05, -0.04], r: [0.65, 0.3, -0.1] } };   // koşu: silah iner, namlu sola-aşağı
const SLEEVE = { R: V(0.36, -0.56, -0.08), L: V(-0.08, -0.6, -0.3) };               // V2 kol kütüğü çapaları (kamera uzayı, ekran dışı)
const ZAX = V(0, 0, 1), _a = V(), _b = V(), _q = new THREE.Quaternion(), _eu = new THREE.Euler();

export class HandlessRig {
  constructor(variant, team, cam, set = 'new') {
    this.variant = variant; this.cam = cam; this.set = set; this.team = team;
    this.root = new THREE.Group(); cam.add(this.root);
    this.wg = new THREE.Group(); this.root.add(this.wg);
    this.weapon = null; this.id = null; this.scale = SCALE; this.scaleOverride = 0; this.fov = 54; this.hip = null; this.hipRot = null; this.breathT = 0;
    this.sleeves = []; this.arms = { R: null, L: null };
    if (variant === 'v2') {                                                            // iki kütük: takım rengi kol + koyu manşet (kabza ucunda)
      const mk = () => { const g = new THREE.Group(); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 1), mat(team.shirt)); arm.position.z = 0.5; const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.086, 0.05), mat(team.gloves || '#1d2530')); cuff.position.z = 0.03; g.add(arm, cuff); cam.add(g); return g; };
      this.sleeves = [mk(), mk()];
    }
  }
  dispose() { this.cam.remove(this.root); for (const s of this.sleeves) this.cam.remove(s); for (const k of ['R', 'L']) if (this.arms[k]) { this.cam.remove(this.arms[k].mesh); this.arms[k].dispose(); } this.weapon?.traverse((o) => o.geometry?.dispose()); }
  setWeapon(id, optic = 'reddot') {
    if (this.weapon) { this.wg.remove(this.weapon); this.weapon.traverse((o) => o.geometry?.dispose()); }
    this.id = id; const st = WSTATS[id] || {}; this.kind = st.kind || 'gun';
    const w = this.set === 'new' && isNew(id) ? createWeaponU(id, optic) : createWeapon(id, optic);
    this.weapon = w; this.wg.add(w); this.wg.scale.setScalar(this.scale);
    this.u = { ...w.userData, sight: w.userData.sight ?? st.sight, dist: w.userData.dist ?? st.dist, noAds: !(this.kind === 'gun' || this.kind === 'launcher'), overlay: w.userData.overlay || (st.scope ? 'scope' : 'none') };
    this.style = st.reloadStyle || 'mag';
    // namlu alevi (oyundaki gibi toplamsal kutu)
    this.flash = null;
    if (this.u.muzzle && this.kind === 'gun') { const f = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.18), new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); f.position.copy(this.u.muzzle).add(V(0, 0, -0.08)); f.visible = false; w.add(f); this.flash = f; }
    // şarjör malzemeleri kopya: düşerken solsun
    this.magMats = [];
    if (this.u.mag) this.u.mag.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; this.magMats.push(o.material); } });
    // fişek (pompalı doldurma): kırmızı kutu, yuvaya sol-alttan girer
    this.shell = null;
    if (this.style === 'shell') { const s = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.013, 0.045), mat("#d8322a")); s.visible = false; w.add(s); this.shell = s; this.port = this.u.port ? V(...this.u.port) : V(0, -0.03, -0.03); }
    for (const s of this.sleeves) s.visible = this.variant === 'v2';
    // V3 kare eller: tutuşa göre kutu ölçüsü / başparmak; takım rengi kol (paintball: boya rengi)
    for (const k of ['R', 'L']) { if (this.arms[k]) { this.cam.remove(this.arms[k].mesh); this.arms[k].dispose(); this.arms[k] = null; } }
    if (this.variant === 'v3') {
      const fit = fitFor(id, this.u.hold), colors = { sleeve: this.team.shirt, cuff: this.team.gloves || '#1d2530' };
      if (fit.R && this.u.gripR) { this.arms.R = new BoxArm(1, { size: fit.R.size, thumb: fit.R.thumb || null, groove: fit.R.groove, colors }); this.cam.add(this.arms.R.mesh); }
      const hasL = (fit.L && (this.u.gripL || fit.L.onGrip)) || this.u.hold === 'melee' || this.u.hold === 'grenade';
      if (hasL) { const f = fit.L || { size: [0.085, 0.045, 0.095], groove: 'top' }; this.arms.L = new BoxArm(-1, { size: f.size, thumb: f.thumb || null, groove: f.groove, colors }); this.cam.add(this.arms.L.mesh); }
      // çarpışma raporu için ham parça OBB'leri (birleştirilmemiş model)
      const fn = this.set === 'new' && WEAPONS_U[id] ? WEAPONS_U[id] : WEAPONS[id]; this.boxes = [];
      if (fn) { const raw = fn(); raw.updateMatrixWorld(true); raw.traverse((m) => { if (!m.isMesh) return; m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3()), h = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); m.matrixWorld.decompose(p, q, sc); let tag = ''; for (let o = m; o && o !== raw; o = o.parent) if (o === raw.userData.mag) tag = 'mag'; this.boxes.push({ c: c.multiply(sc).applyQuaternion(q).add(p), h: h.multiply(sc), q, tag }); }); raw.traverse((o) => o.geometry?.dispose?.()); }
    }
  }
  // state: { anim, t, ads, sprint, bobT, time }
  update(st) {
    const u = this.u, A = ANIMS[st.anim] || ANIMS.idle, a = A.sample(st.t || 0, { style: this.style, hold: u.hold, kind: this.kind }), fx = a.fx || {};
    let ads = u.noAds ? 0 : (fx.ads ?? st.ads ?? 0), spr = fx.sprint ?? st.sprint ?? 0;
    const base = POSE_ID[this.id] || POSE[u.hold] || POSE.rifle, hp = this.hip ? this.hip.toArray() : base.p, hr = this.hipRot || base.r, s0 = this.scaleOverride || base.s || SCALE, s = s0 + (0.92 - s0) * ads;   // nişanda oyunun ölçeği (0,92): nişangâh görünümü oyunla aynı, dipçik kameraya girmez
    // nişan hedefi: nişangâh merkezi kamera ekseninde, göz-nişangâh uzaklığı dist
    const [sx, sy, sz] = u.sight || [0, 0.1, -0.1], tgt = [-sx * s, -sy * s, -(u.dist ?? 0.3) - sz * s];
    const p = [0, 0, 0], r = [0, 0, 0];
    for (let i = 0; i < 3; i++) { p[i] = hp[i] + (tgt[i] - hp[i]) * ads; r[i] = hr[i] * (1 - ads); }
    const sp = this.kind === 'melee' ? SPRINT.melee : SPRINT.gun;
    for (let i = 0; i < 3; i++) { p[i] += sp.p[i] * spr; r[i] += sp.r[i] * spr; }
    // nefes + yürüyüş sallanması (nişanda sönümlü)
    this.breathT = st.time || 0;
    const br = Math.sin(this.breathT * 1.55) * (1 - ads), br2 = Math.sin(this.breathT * 0.8 + 1.3) * (1 - ads), bob = st.bobT || 0, bobAmt = (1 - ads * 0.85) * (st.bobK ?? (bob ? 1 : 0));
    p[1] += br * 0.0035 + Math.abs(Math.cos(bob)) * 0.012 * bobAmt; p[0] += br2 * 0.0015 + Math.sin(bob) * 0.012 * bobAmt; r[0] += br * 0.008; r[2] += br2 * 0.008;
    for (let i = 0; i < 3; i++) { p[i] += a.p[i] * (i === 2 || !ads ? 1 : 0.4); r[i] += a.r[i]; }
    this.root.position.set(p[0], p[1], p[2]); this.root.rotation.set(r[0], r[1], r[2]);
    this.wg.scale.setScalar(s);
    this.weapon.visible = !fx.hideW && !(this.u.overlay === 'scope' && ads > 0.9);   // dürbün: tam nişanda model gizli (oyun gibi)
    // alt gruplar
    if (u.mag) { const ax = u.magAxis || [0, -1, 0], off = (fx.magOut || 0) * 0.24; u.mag.visible = fx.magVis !== false; u.mag.position.set(ax[0] * off, ax[1] * off, ax[2] * off); u.mag.rotation.x = -(fx.magOut || 0) * 0.35; for (const m of this.magMats) m.opacity = 1 - (fx.magFade || 0); }
    if (u.bolt) { const b = fx.bolt || 0; u.bolt.g.position.set(0, u.bolt.pivot, b * 0.085 + (fx.boltBack || 0) * 0.04); u.bolt.g.rotation.z = b * 0.9; }
    if (u.charge) u.charge.position.z = (fx.charge || 0) * 0.06;
    if (u.pump) u.pump.position.z = fx.pump || 0;
    if (u.slide) u.slide.position.z = (fx.slide || 0) * 0.03;
    if (this.shell) { const sh = fx.shell; this.shell.visible = !!(sh && sh.vis); if (sh) this.shell.position.copy(this.port).add(V(-0.06 * (1 - sh.k), -0.05 * (1 - sh.k), 0.02 * (1 - sh.k))); }
    if (this.flash) this.flash.visible = !!fx.flash;
    this.cam.rotation.set(fx.camPitch || 0, 0, fx.camRoll || 0);
    // V2 kol kütükleri: soket → çapa (kamera uzayı), rijit kutu, uzunluk soket-çapa mesafesi
    if (this.variant === 'v3') this.placeArms(st, fx, ads, s);
    if (this.sleeves.length) {
      this.cam.updateMatrixWorld(true); this.wg.updateMatrixWorld(true);
      const socks = [u.gripR ? u.gripR.clone() : null, u.gripL ? u.gripL.clone() : null];
      for (let i = 0; i < 2; i++) {
        const g = this.sleeves[i], sk = socks[i]; if (!sk || !this.weapon.visible) { g.visible = false; continue; }
        g.visible = true;
        if (u.hold === 'pistol' && i === 1) { g.visible = false; continue; }
        if (i === 0) sk.y -= 0.03;                                                  // kabza: kütük kabzanın altından çıkar
        const ws = this.wg.localToWorld(sk), cs = this.cam.worldToLocal(ws.clone()), anchor = i === 0 ? SLEEVE.R : SLEEVE.L;
        g.position.copy(cs); _a.copy(anchor).sub(cs); const len = _a.length(); g.quaternion.setFromUnitVectors(ZAX, _a.normalize());
        g.children[0].scale.z = len; g.children[0].position.z = len / 2;
      }
    }
  }
  // V3: el hedefleri (silah yerel) → kamera uzayı; serbest hedeflerle karışım; ön kol dirsek çapasına
  placeArms(st, fx, ads, s) {
    const u = this.u, T = handTargets(st.anim, st.t || 0, fx, u, u.hold, this.style); this.lastT = T;
    this.cam.updateMatrixWorld(true); this.wg.updateMatrixWorld(true);
    const hidden = !this.weapon.visible && !(fx.hideW && st.anim === 'throw');
    for (const k of ['R', 'L']) {
      const arm = this.arms[k], tg = T[k]; if (!arm) continue;
      if (!tg || hidden) { arm.mesh.visible = false; continue; }
      arm.mesh.visible = true;
      const pw = this.wg.localToWorld(tg.p.clone()), pc = this.cam.worldToLocal(pw), qc = this.root.quaternion.clone().multiply(_q.setFromEuler(_eu.set(tg.r[0], tg.r[1], tg.r[2])));
      if (tg.free > 0 && tg.freeP) { const fp = tg.freeP; pc.lerp(_a.set(fp.p[0], fp.p[1], fp.p[2]), tg.free); qc.slerp(_q.setFromEuler(_eu.set(fp.r[0], fp.r[1], fp.r[2])), tg.free); }
      const el = k === 'R' ? _b.copy(ELBOW.R).lerp(ELBOW.Rads, ads) : _b.copy(ELBOW.L).lerp(ELBOW.Lads, ads);
      arm.mesh.scale.setScalar(s * 0.85); arm.place(pc, qc, el);
    }
  }
  report() {
    const out = { id: this.id, parts: this.u.parts, variant: this.variant, overlap: {} };
    if (this.variant === 'v3' && this.lastT && this.boxes) for (const k of ['R', 'L']) { const tg = this.lastT[k]; if (tg && !tg.free) out.overlap[k] = handOverlap(this.boxes, tg.p, tg.r, fitFor(this.id, this.u.hold)[k]?.size || [0.085, 0.045, 0.095], k === 'R' ? this.u.gripR : (this.u.gripL || this.u.gripR)); }
    if (this.arms.R) out.armTris = this.arms.R.tris + (this.arms.L ? this.arms.L.tris : 0);
    return out;
  }
}
