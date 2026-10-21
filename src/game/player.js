import * as THREE from 'three';
import { createWeapon, WEAPONS } from '../models/weapons.js';
import { pbLook } from '../models/character.js';
import { tintPaint } from '../models/paintball.js';
import { paintColorOf } from './paint.js';
import { createItem } from '../models/items.js';
import { TEAMS } from '../core/palette.js';
import { WSTATS, OPTICS, OPTIC_ALLOWED, ZT_ORDER } from './stats.js';
import { reloadAnim, meleePose } from './anim.js';
import { fpHand, handBasis, zombieColors } from '../models/fpHands.js';
import { BoxArm, armMaterial, fitSockets, ELBOW, handTargets, handOverlap, partBoxes } from '../models/boxArm.js';
import { POSE, POSE_ID, SCALE, SPRINT, ANIMS } from './fpAnims.js';
import { clamp, lerp, V3 } from './util.js';
import { applyInput } from '../sim/input.js';
import { TUNE } from './balance.js';
import { TouchControls, isTouch } from './touch.js';
import { norm, codeLabel } from '../core/keybinds.js';
import { t as $t } from '../i18n/index.js';
import { wName, opticName, fireName } from '../i18n/game.js';

const VM_SCALE = 0.92;                                                             // nişandaki model ölçeği (nişangâh görünümü / ADS hizası bununla)
export const FIRE_LABEL = { semi: 'Tek atış', burst: 'Seri (3-5 mermi)', auto: 'Otomatik' };
const ADS_FOV = 68;

// ───────────── Birinci şahıs silah modeli: kare eller (V3, BattleBit / Unturned tarzı) ─────────────
// Sahne: kamera → mirG (sol el modu: x aynası) → root (duruş: bel / nişan / koşu / animasyon) → model (ölçek: tüfek 1,5 · diğer 1,25 → nişanda 0,92) → silah.
// Kutu eller (models/boxArm.js) mirG altında kamera uzayında: el silah soketine rijit, ön kol ekran dışı dirsek çapasına prizma. Kol başına 1 ağ / 1 çizim çağrısı.
// Zombi pençesi (claws): eski organik pençe yolu aynen (fpHands, ayrı kollar, morph).
const CLAWS_IDLE = { pos: [0.0, -0.1, -0.44], rx: 0.12, ry: 0.0, rz: 0.0 };      // zombi elleri: iki el kalkık, pençelemeye hazır
// zombi eli (grup çerçevesinde): parmaklar yukarı-ileri ve hafif içe, el sırtı dışa-arkaya, ön kol ekranın altına iner
const ZH_MAP = handBasis(new THREE.Vector3(0.6, 0.12, 0.8), new THREE.Vector3(-0.12, 0.92, -0.35));
const ZH_ARM = new THREE.Vector3(0.22, -0.85, 0.45).normalize();
const ELBOW_CLAW = new THREE.Vector3(0.3, -0.75, -0.18);                         // zombi kolu dirseği (kamera uzayı, sağ el)
const ZAX = new THREE.Vector3(0, 0, 1), _w = new THREE.Vector3(), _e = new THREE.Vector3();
const _pc = new THREE.Vector3(), _fp = new THREE.Vector3(), _el = new THREE.Vector3(), _q = new THREE.Quaternion(), _qf = new THREE.Quaternion(), _eu = new THREE.Euler();
const BOX_KINDS = { medkit: 1, mine: 1, ammobox: 1 };                              // iki elle kenarından tutulan kutu / mayın

export class ViewModel {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
    this.scene.add(this.cam);
    this.scene.environment = game.scene.environment;
    this.scene.environmentIntensity = 0.7;
    this.scene.add(new THREE.HemisphereLight('#cfe3ff', '#8a7a58', 1.5));
    const sun = new THREE.DirectionalLight('#fff0d2', 2.2);
    sun.position.set(2, 3, 2);
    this.scene.add(sun);
    this.mirG = new THREE.Group(); this.cam.add(this.mirG);                         // sol el modu aynası (silah + kutu eller birlikte)
    this.root = new THREE.Group();
    this.mirG.add(this.root);
    this.model = null; this.id = null; this.arms = []; this.box = { R: null, L: null }; this.armMat = armMaterial();
    this.kick = 0; this.kickR = 0; this.bobT = 0; this.raise = 1; this.raiseRate = 3.5;
    this.boltT = 0; this.hitKick = 0; this.throwT = 0; this.dryT = 0; this.pumpT = 0; this.pinT = 1;
    this.camRoll = 0; this.camPitch = 0; this.inspectT = 0;
    this.pos = new THREE.Vector3(0.13, -0.2, -0.41);           // zombi pençesi bel noktası (kare el duruşları fpAnims.POSE)
    this.flash = null; this.flashT = 0;
  }

  setItem(id, team, kind, optic, skin) {
    for (const a of this.arms || []) { this.cam.remove(a.mesh); a.mesh.geometry.dispose(); }
    for (const k of ['R', 'L']) if (this.box[k]) { this.mirG.remove(this.box[k].mesh); this.box[k].dispose(); this.box[k] = null; }
    this.arms = [];
    if (this.model) { const own = this.model.userData.ownMat; this.root.remove(this.model); this.model.traverse((o) => { o.geometry?.dispose(); if ((own || o.userData.magMat) && o.material && !Array.isArray(o.material)) o.material.dispose(); }); }      // setFade / şarjör kopyaları da
    this.id = id;
    this.raise = 1;
    this.raiseRate = 1 / Math.max(0.15, Math.min(0.35, WSTATS[id]?.equip ?? 0.3));
    this.boltT = 0; this.pumpT = 0; this.throwT = 0; this.pinT = kind === 'throwable' ? 0 : 1;
    const c = id !== 'claws' && this.look ? { ...TEAMS[team], ...this.look } : TEAMS[id === 'claws' ? 'zomb' : team];      // zombinin kolu/eli soluk yeşil; look: paintball forması (kol = boya rengi)
    const g = new THREE.Group();
    this.flash = null;
    this.zh = null; this.shell = null; this.magMats = [];
    if (kind === 'medkit') {
      const m = createItem('medkit'); m.scale.setScalar(1.15); m.position.set(0, -0.1, 0); g.add(m);
      g.userData = { hold: 'box', gripR: new THREE.Vector3(0, 0, 0), gripL: null, muzzle: new THREE.Vector3(), sight: [0, 0, 0], dist: 0.3, noAds: true };
    } else {
      const w = createWeapon(id, optic);
      g.add(w);
      const st = WSTATS[id];
      g.userData = { ...w.userData, sight: w.userData.sight ?? st.sight, dist: w.userData.dist ?? st.dist };
      if (kind === 'throwable' || kind === 'mine' || kind === 'ammobox' || kind === 'melee') g.userData.noAds = true;
      if (kind === 'gun' || kind === 'launcher') {
        // muzzle flash
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.18), new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
        f.position.copy(w.userData.muzzle).add(new THREE.Vector3(0, 0, -0.08));
        f.visible = false;
        w.add(f);
        this.flash = f;
      }
    }
    const u = g.userData;
    this.hold = BOX_KINDS[kind] ? 'box' : u.hold || 'rifle';
    this.style = WSTATS[id]?.reloadStyle || 'mag';
    if (id === 'claws') {                                                        // zombi: iki çıplak, kemikli, kanca parmaklı el (türün ten rengi)
      const addArm = (grp, mesh, elbow, s = 1) => { const a = mesh.userData.arm; if (!a) return; this.cam.add(a); this.arms.push({ follow: false, grp, mesh: a, wrist: mesh.userData.wrist, elbow, s }); };
      // iki bağımsız el grubu: her biri kendi omzundan (ekran altı) koşarken sağa / sola açılır ve dönüşümlü ileri-geri sallanır
      const w = g.children.find((o) => o.userData && o.userData.id === 'claws') || g.children[0];
      g.remove(w); w.traverse((o) => o.geometry?.dispose());                     // 3. şahıs pençe modeli birinci şahısta kullanılmaz
      const zc = zombieColors(skin || '#86a273', TEAMS.zomb.shirt);
      const mk = (mirror) => {
        const grp = new THREE.Group(), m = fpHand({ colors: zc, map: ZH_MAP, mirror, arm: ZH_ARM.clone().setX(ZH_ARM.x * (mirror ? -1 : 1)), armLen: 0.62, pose: 'claw', pose2: 'claw2', scale: 1.45, split: true });
        grp.add(m); g.add(grp); addArm(grp, m, ELBOW_CLAW.clone().setX(ELBOW_CLAW.x * (mirror ? -1 : 1)));
        return grp;
      };
      const hR = mk(false), hL = mk(true);
      this.zh = { R: hR, L: hL };
    } else {
      // kare eller: soketler ölçeksiz model üstünde bir kez (kundak altı ışınla ölçülür → eski modellerde de oturur); kol = takım gömleği (paintball: boya rengi), eldiven koyu
      const raw = WEAPONS[id] && kind !== 'medkit' ? WEAPONS[id]() : null;
      u.id = id; u.hands = fitSockets(g, this.hold, id, raw ? partBoxes(raw) : null); raw?.traverse((o) => o.geometry?.dispose?.());   // ham parçalar: el kutusu gövdeye > 3 mm batmasın
      const colors = { sleeve: c.shirt, cuff: (this.look ? TEAMS[team]?.gloves : c.gloves) || '#1d2530' }, H = u.hands;
      const mk = (side, f) => { const a = new BoxArm(side, { size: f.size, thumb: f.thumb, groove: f.groove, colors: f.top ? { ...colors, top: f.top } : colors, mat: this.armMat }); this.mirG.add(a.mesh); return a; };
      if (H.R) this.box.R = mk(1, H.R);
      if (H.L) this.box.L = mk(-1, H.L);
      else if (this.hold === 'melee' || this.hold === 'grenade') this.box.L = mk(-1, { size: [0.085, 0.045, 0.095], groove: 'top' });   // boştaki sol el (sol altta)
      // şarjör malzemeleri kopya: düşerken solsun (karede malzeme değişmez, yalnız saydamlık)
      if (u.mag) u.mag.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) { o.material = o.material.clone(); o.userData.magMat = true; this.magMats.push(o.material); } });
      if (this.style === 'shell' && u.port) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.013, 0.045), new THREE.MeshStandardMaterial({ color: '#d8322a', roughness: 0.6 })); sh.visible = false; g.children[0].add(sh); this.shell = sh; this.port = new THREE.Vector3(...u.port); }   // fişek: yuvaya sol alttan girer
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.model = g;
    this.root.add(g);
  }

  // Silah inceleme (Y): ~3,4 sn; ateş/nişan/yükleme/sprint/silah değişimi/savurma iptal eder
  inspect(s) {
    if (this.inspectT > 0) { this.inspectT = 0; return; }
    if (s.adsT > 0.05 || s.reloadT > 0 || s.sprinting || s.swing || s.useT > 0 || this.raise > 0.05 || this.kick > 0.02) return;
    this.inspectT = 0.0001;
  }

  update(dt, p) {
    if (this.id === 'claws') return this.updateClaws(dt, p);
    const s = p.s, st = s.stat, u = this.model?.userData || {}, hold = this.hold;
    const ads = u.noAds ? 0 : s.adsT;
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const isMelee = st.kind === 'melee', isGun = st.kind === 'gun' || st.kind === 'launcher';
    this.bobT += dt * (speed > 0.5 && s.onGround ? 1 : 0) * (s.sprinting ? 12 : 8);
    const bobAmt = (1 - ads * 0.85) * clamp(speed / 5, 0, 1) * (s.sprinting ? 1.6 : 1);
    this.kick = Math.max(0, this.kick - dt * 6 * (0.2 + this.kick * 10));
    this.kickR = Math.max(0, this.kickR - dt * 5);
    this.raise = Math.max(0, this.raise - dt * this.raiseRate);
    this.hitKick = Math.max(0, this.hitKick - dt * 7);
    this.dryT = Math.max(0, this.dryT - dt * 8);
    this.boltT = Math.max(0, this.boltT - dt / 0.95);
    this.pumpT = Math.max(0, this.pumpT - dt / 0.6);
    if (this.throwT > 0) {                                                       // fırlatma bitti: elde bomba kaldıysa yenisi alttan gelir, pim yeniden çekilir
      this.throwT = Math.max(0, this.throwT - dt / 0.6);
      if (this.throwT === 0 && st.kind === 'throwable' && s.item?.mag > 0) { this.raise = 1; this.pinT = 0; }
    }
    if (this.raise < 0.05 && this.pinT < 1) this.pinT = Math.min(1, this.pinT + dt / 0.75);
    const rz0 = this.raise * this.raise;

    // ── bel duruşu (tutuşa / silaha göre) ↔ nişan hedefi (nişangâh merkezi kamera ekseninde, göz-nişangâh uzaklığı dist; nişanda ölçek 0,92)
    const base = POSE_ID[this.id] || POSE[hold] || POSE.rifle, s0 = base.s || SCALE, sc = s0 + (VM_SCALE - s0) * ads;
    const [sx, sy, sz] = u.sight || [0, 0.1, -0.1], tgt = [-sx * sc, -sy * sc, -(u.dist ?? 0.3) - sz * sc];
    if (st.adsLow) for (let i = 0; i < 3; i++) tgt[i] += st.adsLow[i];                 // paintball: nişanda model iner / sağa kayar (hazne görüşü kapatmasın)
    const P = [0, 0, 0], R = [0, 0, 0];
    for (let i = 0; i < 3; i++) { P[i] = base.p[i] + (tgt[i] - base.p[i]) * ads; R[i] = base.r[i] * (1 - ads); }

    // ── etkin animasyon (oyun durumu → handlab4 eğrileri)
    let anim = 'idle', at = 0, ra = null;
    const ctx = { hold, kind: st.kind };
    if (s.reloadT > 0 && isGun) {
      const el = s.reloadTotal - s.reloadT, k = clamp(el / s.reloadTotal, 0, 1), ph = s.reloadStyle === 'shell' ? ((el / st.shell) % 1 + 1) % 1 : 0;
      ra = reloadAnim(s.reloadStyle, k, s.reloadEmpty, ph); ctx.ra = ra; ctx.ph = ph; anim = s.reloadStyle === 'shell' ? 'shell' : 'reload'; at = k;
    } else if (isMelee && s.swing) { anim = 'swing'; at = clamp(s.swing.t / s.swing.dur, 0, 1); ctx.kindSw = s.swing.kind; }
    else if (this.throwT > 0 && hold === 'grenade') { anim = 'throw'; at = 1 - this.throwT; }
    else if (this.boltT > 0 && u.bolt) { anim = 'bolt'; at = 1 - this.boltT; }
    else if (this.pumpT > 0 && u.pump) { anim = 'pump'; at = 1 - this.pumpT; }
    else if (this.pinT < 1 && hold === 'grenade') { anim = 'pin'; at = this.pinT; }
    // inceleme: öne/ortaya al, yandan göster, ters çevir, geri indir (ateş / nişan / yükleme / koşu / savurma iptal eder)
    if (this.inspectT > 0) {
      if (s.adsT > 0.05 || s.reloadT > 0 || s.sprinting || s.swing || s.useT > 0 || this.raise > 0.05 || this.kick > 0.02 || s.cd > 0.05) this.inspectT = 0;
      else this.inspectT += dt / 3.4;
      if (this.inspectT >= 1) this.inspectT = 0;
      if (this.inspectT > 0 && anim === 'idle') { anim = 'inspect'; at = this.inspectT; }
    }
    const a = anim === 'idle' ? null : ANIMS[anim].sample(at, ctx), fx = a?.fx || {};

    // ── koşu (yüklerken azalır), nefes + yürüyüş sallanması (nişanda sönümlü)
    this.sprintT = lerp(this.sprintT || 0, s.sprinting ? 1 : 0, Math.min(1, dt * 9));
    const sprK = this.sprintT * (1 - (ra ? ra.tilt * 0.8 : 0)), sp = isMelee ? SPRINT.melee : SPRINT.gun;
    for (let i = 0; i < 3; i++) { P[i] += sp.p[i] * sprK; R[i] += sp.r[i] * sprK; }
    this.breathT = (this.breathT || 0) + dt;
    const br = Math.sin(this.breathT * 1.55) * (1 - ads) * (1 - clamp(speed / 3, 0, 1) * 0.6), br2 = Math.sin(this.breathT * 0.8 + 1.3) * (1 - ads);
    P[1] += br * 0.0035 + Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmt; P[0] += br2 * 0.0015 + Math.sin(this.bobT) * 0.012 * bobAmt; R[0] += br * 0.008; R[2] += br2 * 0.008;
    if (isMelee) { R[2] += Math.sin(this.bobT) * 0.035 * bobAmt; R[0] += Math.abs(Math.cos(this.bobT)) * 0.025 * bobAmt; }   // yürürken bıçak eli hafif yalpalar
    if (a) for (let i = 0; i < 3; i++) { P[i] += a.p[i] * (i === 2 || !ads ? 1 : 0.4); R[i] += a.r[i]; }
    // ── ateş geri tepmesi, kuru tetik, kuşanma (aşağıdan gelir), kullanım (ilk yardım / kurulum), vuruş tepmesi, fare sallanması
    P[2] += this.kick * (0.9 - ads * 0.6); R[0] += this.kickR * (0.4 - ads * 0.3) + this.dryT * 0.05 - rz0 * 0.5; P[1] -= rz0 * 0.38;
    if (!ra && s.useT > 0) { const b = Math.sin(clamp(1 - s.useT / Math.max(0.5, st.useTime || 1.4), 0, 1) * Math.PI); P[1] -= b * 0.18; P[0] -= b * 0.05; R[0] -= b * 0.7; R[2] += b * 0.5; }
    P[2] += this.hitKick * 0.06; R[0] += this.hitKick * 0.18;
    this.sx = lerp(this.sx || 0, -p.lookDX * 0.0006, Math.min(1, dt * 12));
    this.sy = lerp(this.sy || 0, p.lookDY * 0.0006, Math.min(1, dt * 12));
    R[1] += clamp(this.sx, -0.05, 0.05) * (1 - ads); R[0] += clamp(this.sy, -0.05, 0.05) * (1 - ads);

    // sol el modu: silah + eller birlikte x ekseninde aynalanır (negatif ölçek yüz yönünü üç.js'te otomatik düzeltir)
    this.mirG.scale.set(this.game.leftHand ? -1 : 1, 1, 1);
    this.root.position.set(P[0], P[1], P[2]); this.root.rotation.set(R[0], R[1], R[2]); this.root.scale.setScalar(1);
    this.model.scale.setScalar(sc);
    this.camRoll = lerp(this.camRoll, fx.camRoll || 0, Math.min(1, dt * 14));
    this.camPitch = lerp(this.camPitch, fx.camPitch || 0, Math.min(1, dt * 14));

    // ── alt gruplar: şarjör (düşer + solar), kurma kolu, sürgü, pompa, tabanca sürgüsü, fişek, namlu alevi
    if (u.mag) { const ax = u.magAxis || [0, -1, 0], off = (fx.magOut || 0) * 0.24, fade = fx.magFade || 0; u.mag.visible = fx.magVis !== false; u.mag.position.set(ax[0] * off, ax[1] * off, ax[2] * off); u.mag.rotation.x = -(fx.magOut || 0) * 0.35; const mf = this.model.userData.fade || 0; for (const m of this.magMats) { m.transparent = fade > 0.001 || mf > 0; m.opacity = (m._op0 ?? 1) * (1 - fade) * (1 - mf); } }
    if (u.bolt) { const b = fx.bolt || 0; u.bolt.g.position.set(0, u.bolt.pivot, b * 0.085 + (fx.boltBack || 0) * 0.04); u.bolt.g.rotation.z = b * 0.9; }
    if (u.charge) u.charge.position.z = (fx.charge || 0) * 0.06;
    if (u.pump) u.pump.position.z = fx.pump || 0;
    if (u.slide) u.slide.position.z = Math.max(fx.slide || 0, hold === 'pistol' ? clamp(this.kick / 0.04, 0, 1) : 0) * 0.03;
    if (this.shell) { const sh = fx.shell; this.shell.visible = !!(sh && sh.vis); if (sh) this.shell.position.copy(this.port).add(_fp.set(-0.06 * (1 - sh.k), -0.05 * (1 - sh.k), 0.02 * (1 - sh.k))); }
    if (this.flash) { this.flashT = Math.max(0, this.flashT - dt); this.flash.visible = this.flashT > 0; }
    // dürbünlü silahta tam nişanda modeli (ve elleri) gizle; fırlatmada bomba bırakılınca model gizli, eller kalır
    this.root.visible = !(s.overlay === 'scope' && s.adsT > 0.9);
    this.model.visible = !fx.hideW;
    this.cam.rotation.z = -s.leanT * 0.2;   // yana eğilirken silah da kafayla birlikte yatar
    this.placeArms(anim, at, fx, u, sc, ads);
    // nişan alırken silah kamerasının görüş açısı genişler: silah/nişangâh ekranda küçülür, rakip örtülmez (dürbünsüz silahlarda)
    const fovT = 54 + (ADS_FOV - 54) * (u.noAds ? 0 : ads);
    if (Math.abs(this.cam.fov - fovT) > 0.01) { this.cam.fov = fovT; this.cam.updateProjectionMatrix(); }
    // dokunmatik: dürbünsüz nişanda silah modeli yarı saydamlaşır (küçük ekranda nişangâh gövdesi hedefi örtüyordu; nişangâh HUD'da net kalır)
    this.setFade(p.touch && s.overlay !== 'scope' ? clamp((ads - 0.55) / 0.4, 0, 1) * 0.5 : 0);
  }

  // Kutu eller: el hedefleri (model yerel) → kamera uzayı (mirG yereli); serbest hedeflerle karışım; ön kol dirsek çapasına
  placeArms(anim, at, fx, u, sc, ads) {
    const T = handTargets(anim, at, fx, u, this.hold, this.style);
    this.root.updateMatrix(); this.model.updateMatrix();
    const box = this.hold === 'box';
    for (const k of ['R', 'L']) {
      const arm = this.box[k], tg = T[k]; if (!arm) continue;
      if (!tg || !this.root.visible) { arm.mesh.visible = false; continue; }
      arm.mesh.visible = true;
      _pc.copy(tg.p).applyMatrix4(this.model.matrix).applyMatrix4(this.root.matrix);
      _q.copy(this.root.quaternion).multiply(_qf.setFromEuler(_eu.set(tg.r[0], tg.r[1], tg.r[2])));
      if (tg.free > 0 && tg.freeP) { const fp = tg.freeP; _pc.lerp(_fp.set(fp.p[0], fp.p[1], fp.p[2]), tg.free); _q.slerp(_qf.setFromEuler(_eu.set(fp.r[0], fp.r[1], fp.r[2])), tg.free); }
      if (k === 'R') _el.copy(box ? ELBOW.Rbox : ELBOW.R); else _el.copy(box ? ELBOW.Lbox : ELBOW.L);
      if (!box) _el.lerp(k === 'R' ? ELBOW.Rads : ELBOW.Lads, ads);
      if (tg.el > 0) _el.lerp(ELBOW[tg.elK || 'Lrel'], tg.el);
      arm.place(_pc, _q, _el, sc * 0.85);
    }
  }

  // El kutusu × silah parçası en büyük batma (mm; bekleme soketleri, ham model): fphands2 denetimi
  overlapReport() {
    const u = this.model?.userData, fn = WEAPONS[this.id]; if (!u?.hands || !fn) return null;
    const raw = fn(), boxes = partBoxes(raw), out = {};
    for (const k of ['R', 'L']) { const h = u.hands[k]; if (h) out[k] = handOverlap(boxes, h.p, h.r, h.size, k === 'R' || !u.gripL || h.onGrip ? u.gripR : u.gripL); }
    raw.traverse((o) => o.geometry?.dispose?.());
    return out;
  }

  // ── Zombi pençesi (eski organik el yolu, değişmedi): iki el kalkık; koşarken açılır, dönüşümlü sallanır; savurmada parmaklar açılır
  updateClaws(dt, p) {
    const s = p.s, u = this.model?.userData || {}, hip = this.pos, ads = 0;
    const speed = Math.hypot(s.vel.x, s.vel.z);
    this.bobT += dt * (speed > 0.5 && s.onGround ? 1 : 0) * (s.sprinting ? 12 : 8);
    const bobAmt = (1 - ads * 0.85) * clamp(speed / 5, 0, 1) * (s.sprinting ? 1.6 : 1);
    this.kick = Math.max(0, this.kick - dt * 6 * (0.2 + this.kick * 10));
    this.kickR = Math.max(0, this.kickR - dt * 5);
    this.raise = Math.max(0, this.raise - dt * this.raiseRate);
    this.hitKick = Math.max(0, this.hitKick - dt * 7);
    this.throwT = Math.max(0, this.throwT - dt * 3);
    this.dryT = Math.max(0, this.dryT - dt * 8);
    const rz0 = this.raise * this.raise;
    const pos = new THREE.Vector3().copy(hip);
    pos.x += Math.sin(this.bobT) * 0.012 * bobAmt;
    pos.y += Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmt - rz0 * 0.38;
    pos.z += this.kick * 0.9;
    let rx = this.kickR * 0.4, ry = 0.06, rz = 0;
    rx += this.dryT * 0.05 - rz0 * 0.5;
    this.breathT = (this.breathT || 0) + dt;
    const br = Math.sin(this.breathT * 1.55) * (1 - clamp(speed / 3, 0, 1) * 0.6), br2 = Math.sin(this.breathT * 0.8 + 1.3);
    pos.y += br * 0.0035; rx += br * 0.008; rz += br2 * 0.008; pos.x += br2 * 0.0015;
    rz += Math.sin(this.bobT) * 0.035 * bobAmt; rx += Math.abs(Math.cos(this.bobT)) * 0.025 * bobAmt;
    this.sprintT = lerp(this.sprintT || 0, s.sprinting ? 1 : 0, Math.min(1, dt * 9));
    const MI = CLAWS_IDLE;
    pos.x += MI.pos[0] - hip.x; pos.y += MI.pos[1] - hip.y; pos.z += MI.pos[2] - hip.z;
    rx += MI.rx; ry += MI.ry; rz += MI.rz;
    let insp = 0;
    if (this.inspectT > 0) {
      if (s.adsT > 0.05 || s.reloadT > 0 || s.sprinting || s.swing || s.useT > 0 || this.raise > 0.05 || this.kick > 0.02 || s.cd > 0.05) this.inspectT = 0;
      else this.inspectT += dt / 3.4;
      if (this.inspectT >= 1) this.inspectT = 0;
    }
    if (this.inspectT > 0) {
      const t = this.inspectT, sm = (x) => x * x * (3 - 2 * x);
      insp = sm(clamp(t / 0.12, 0, 1)) * sm(clamp((1 - t) / 0.14, 0, 1));
      const pl = (x) => Math.sin(clamp(x, 0, 1) * Math.PI);
      const a = pl((t - 0.1) / 0.36), b = pl((t - 0.42) / 0.3), c = pl((t - 0.66) / 0.24);
      pos.x -= 0.19 * insp; pos.y += 0.05 * insp; pos.z -= 0.14 * insp;
      ry += 0.95 * a + 0.25 * b; rx += -0.2 * a + 0.5 * c; rz += -0.95 * b + 0.3 * c;
    }
    let camRoll = 0, camPitch = 0;
    if (s.swing) {
      const sw = s.swing, mpz = meleePose(sw.kind, clamp(sw.t / sw.dur, 0, 1));
      pos.x += mpz.x * 1.9; pos.y += mpz.y * 1.7; pos.z += mpz.z * 1.6;
      rx += mpz.rx; ry += mpz.ry; rz += mpz.rz;
      camRoll = -mpz.ry * 0.025; camPitch = mpz.rx * 0.012;
    }
    pos.z += this.hitKick * 0.06; rx += this.hitKick * 0.18;
    this.sx = lerp(this.sx || 0, -p.lookDX * 0.0006, Math.min(1, dt * 12));
    this.sy = lerp(this.sy || 0, p.lookDY * 0.0006, Math.min(1, dt * 12));
    ry += clamp(this.sx, -0.05, 0.05); rx += clamp(this.sy, -0.05, 0.05);
    const kk = s.swing ? clamp(s.swing.t / s.swing.dur, 0, 1) : 1, spread = Math.sin(Math.PI * clamp(kk / 0.62, 0, 1));   // savurmada parmaklar açılır, vuruştan sonra yeniden kancalanır
    this.handMorph(this.zh.R, spread); this.handMorph(this.zh.L, spread * 0.7);
    const k = this.sprintT || 0, sw = Math.sin(this.bobT * 0.9) * k, br3 = Math.sin(this.game.time * 1.7) * 0.012;
    const R = this.zh.R, L = this.zh.L;
    R.position.set(0.17 + 0.16 * k, -0.02 * k + br3, -sw * 0.12 - 0.03 * k);
    L.position.set(-0.17 - 0.16 * k, -0.02 * k - br3, sw * 0.12 - 0.03 * k);
    R.rotation.set(sw * 0.35, -0.12 - 0.42 * k, -0.1 - 0.34 * k);
    L.rotation.set(-sw * 0.35, 0.12 + 0.42 * k, 0.1 + 0.34 * k);
    const mir = this.game.leftHand ? -1 : 1;
    this.mirG.scale.set(1, 1, 1);
    this.root.position.set(pos.x * mir, pos.y, pos.z);
    this.root.rotation.set(rx, ry * mir, rz * mir);
    this.root.scale.set(VM_SCALE * mir, VM_SCALE, VM_SCALE);
    this.camRoll = lerp(this.camRoll, camRoll, Math.min(1, dt * 14));
    this.camPitch = lerp(this.camPitch, camPitch, Math.min(1, dt * 14));
    this.root.visible = true;
    this.cam.rotation.z = -s.leanT * 0.2;
    this.cam.updateMatrixWorld(true);
    for (const a of this.arms) {                                                  // ayrı kollar: bilek ucundan dirsek noktasına (kamera uzayı; sol el modunda aynalı)
      const w = this.cam.worldToLocal(a.grp.localToWorld(_w.copy(a.wrist)));
      a.mesh.position.copy(w);
      _e.set(a.elbow.x * mir, a.elbow.y, a.elbow.z);
      a.mesh.quaternion.setFromUnitVectors(ZAX, _e.sub(w).normalize());
      const kS = VM_SCALE * a.s; a.mesh.scale.set(kS * mir, kS, kS);
      a.mesh.visible = this.root.visible && a.grp.visible;
    }
    if (Math.abs(this.cam.fov - 54) > 0.01) { this.cam.fov = 54; this.cam.updateProjectionMatrix(); }
    this.setFade(0); void u; void insp;
  }

  // El ağının morph hedefi (0: ana poz, 1: ikinci poz) — yalnız zombi pençesi
  handMorph(grp, v) { const m = grp && grp.children.find((o) => o.userData.fpHand); if (m && m.morphTargetInfluences) m.morphTargetInfluences[0] = v; }

  // Modelin (ve kutu ellerin) saydamlığı (0 = opak). Malzemeler önbellekte paylaşılıyor (3. şahıs silahları): ilk kullanımda bu modele özel kopyalanır
  setFade(f) {
    const m = this.model;
    if (!m || Math.abs(f - (m.userData.fade || 0)) < 0.01) return;
    if (!m.userData.ownMat) { m.traverse((o) => { if (o.isMesh && o.material && o.material.blending !== THREE.AdditiveBlending && !o.userData.magMat) o.material = Array.isArray(o.material) ? o.material.map((x) => x.clone()) : o.material.clone(); }); m.userData.ownMat = true; }
    m.userData.fade = f;
    const one = (x) => {
      if (x.blending === THREE.AdditiveBlending) return;
      if (x._op0 === undefined) x._op0 = x.opacity, x._tr0 = x.transparent;
      const tr = x._tr0 || f > 0;
      if (tr !== x.transparent) { x.transparent = tr; x.needsUpdate = true; }
      x.opacity = x._op0 * (1 - f);
    };
    m.traverse((o) => { if (o.isMesh && o.material) for (const x of Array.isArray(o.material) ? o.material : [o.material]) one(x); });
    one(this.armMat);
  }

  render(renderer, w, h) {
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(this.scene, this.cam);
  }
}

// ───────────── Oyuncu kontrolcüsü ─────────────
export class Player {
  constructor(game, soldier, settings) {
    this.game = game;
    this.s = soldier;
    this.set = settings;
    this.keys = new Set();
    this.kb = game.binds;
    this.fireHeld = false; this.fireBuf = 0;
    this.lookDX = 0; this.lookDY = 0;
    this.locked = false;
    this.vm = new ViewModel(game);
    this.fov = settings.fov;
    this.camPos = new THREE.Vector3();
    this.bodyVisible = false;
    this.third = false; this.thirdT = 0; this.side = 1; this.sideT = 1;      // 3. şahıs: açık mı, geçiş (0..1), omuz hedefi (±1), omuz geçişi
    this._tv = { p: new THREE.Vector3(), f: new THREE.Vector3(), r: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), q: new THREE.Vector3(), hit: {} };
    this._cs = null;
    this.deathCamT = 0;
    this._bound = [];
    this.bind();
    if (isTouch()) { game.noPointerLock = true; this.touch = new TouchControls(this); }      // telefon / tablet: fare kilidi yok, ekran kontrolleri
    this.refreshWeapon();
    game.on('switch', (s) => { if (s === this.s) this.refreshWeapon(); });
    game.on('spawn', (s) => { if (s === this.s) this.refreshWeapon(); });
    if (this.devTools()) setTimeout(() => game.hud?.toast($t('hud.t.workshop'), '#ffb347'), 2500);
    game.on('fire', (s) => { if (s === this.s) { const vm = this.vm; vm.kick = Math.min(vm.kick + 0.045, 0.12); vm.kickR = Math.min(vm.kickR + 0.18, 0.5); vm.flashT = 0.045; if (vm.model?.userData.pump && s.stat.reloadStyle === 'shell') vm.pumpT = 1; } });      // pompalı: atıştan sonra pompa çekilir
    game.on('bolt', (s) => { if (s === this.s) { this.vm.kickR += 0.2; this.vm.boltT = 1; } });      // sürgülü: atıştan sonra sürgü kalkar-çekilir (kare el topuzu tutar)
    game.on('melee', (s) => { if (s === this.s) this.vm.kick = 0.02; });
    game.on('meleehit', () => { this.vm.hitKick = 1; });
    game.on('throw', (s) => { if (s === this.s) { this.vm.throwT = 1; this.vm.pinT = 1; } });
    game.on('dry', (s) => { if (s === this.s) this.vm.dryT = 1; });
    game.on('firemode', (s) => { if (s === this.s) { this.game.hud.toast($t('hud.t.fireMode', { m: fireName(s.fireModeNow) }), '#cfe6ff'); this.vm.dryT = 1; } });
    // flaşbang (beyaz) ve duman (gri) ekran örtüsü: HUD'dan bağımsız, kendi katmanı
    const ov = (this.fx = document.createElement('div'));
    ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;background:#fff';
    const sm = (this.fxSmoke = document.createElement('div'));
    sm.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:#9aa0a6';
    document.body.append(sm, ov);
  }

  // Geliştirici haritası (yalnızca çevrimdışı): L uçuş, J/K elindeki yuvadaki silahı sıradakiyle değiştirir
  devTools() { return (!!this.game.mapDef?.dev || !!this.game.opts.devMode) && !this.game.online; }

  flyMove(f, r, k, dt) {
    const s = this.s, kb = this.kb, sp = (this.flySpeed || 13) * (kb.held('sprint', k) ? 3 : 1), cp = Math.cos(s.pitch);
    const up = (kb.held('jump', k) ? 1 : 0) - (kb.held('crouch', k) ? 1 : 0);
    let x = -Math.sin(s.yaw) * cp * f + Math.cos(s.yaw) * r, y = Math.sin(s.pitch) * f + up, z = -Math.cos(s.yaw) * cp * f - Math.sin(s.yaw) * r;
    const l = Math.hypot(x, y, z) || 1;
    s.vel.set((x / l) * sp, (y / l) * sp, (z / l) * sp);
    s.leanDir = 0; s.sprinting = false; s.crouching = false; s.prone = false;
  }

  cycleWeapon(dir) {
    const s = this.s, slot = ['primary', 'secondary', 'gadget', 'melee'][s.cur];
    const list = Object.keys(WSTATS).filter((id) => WSTATS[id].slot === slot);
    const id = list[(list.indexOf(s.item.id) + dir + list.length) % list.length], st = WSTATS[id], n = st.count || 1;
    s.items[s.cur] = st.kind === 'gun' ? { id, mag: st.mag, reserve: st.reserve } : st.kind === 'launcher' ? { id, mag: 1, reserve: n - 1 } : st.kind === 'melee' ? { id, mag: 1, reserve: 0 } : { id, mag: n, reserve: 0 };
    s.reloadT = 0; s.cd = 0; s.useT = 0; s.swing = null;
    this.refreshWeapon();
    this.game.hud.toast(`${wName(id)}  (${list.indexOf(id) + 1}/${list.length})`);
  }

  refreshWeapon() {
    const s = this.s;
    this.vm.look = this.game.mode.paintball && !s.def?.zombie ? pbLook(paintColorOf(s)) : null;      // paintball: birinci şahıs kolu / eldiven forma renginde (yalnız renk)
    this.vm.setItem(s.item.id, s.team, s.stat.kind, s.optic, s.def?.zombie ? s.zt?.skin : null);
    if (s.stat.ball) { tintPaint(this.vm.model, paintColorOf(s)); this.vm.flash?.removeFromParent(); this.vm.flash = null; }      // paintball: hazne / tüp kendi boya rengimde, namlu alevi yok
  }

  on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); this._bound.push([target, ev, fn, opt]); }

  // Zombi özel gücü: çevrimdışı hemen uygula; çevrimiçinde sunucu uygular (kenar olayı gönderilir)
  zAbility() {
    const s = this.s;
    if (this.game.online) this.game.online.edge('ab'); else s.useAbility();
  }

  bind() {
    const cv = this.game.canvas;
    this.on(window, 'keydown', (e) => {
      const code = norm(e.code), kb = this.kb;
      if (code === 'Tab' || code === 'Space' || code.startsWith('Arrow') || code === 'F3' || kb.is('scoreboard', code) || kb.is('jump', code)) { if (this.game.running) e.preventDefault(); }   // basılı tutunca tekrar eden olaylar dahil
      if (e.repeat) return;
      this.keys.add(code);
      const s = this.s;
      if (!this.game.running) return;
      if (kb.is('chat', code) && this.game.chat && this.locked && !this.wheel) { e.preventDefault(); this.game.chat.open(e.shiftKey); return; }      // sohbet (çevrimiçi): Enter herkese, Shift+Enter takıma
      if (kb.is('wheel', code) && s.alive && !this.wheel) this.openWheel();
      if (kb.is('third', code) && s.alive) this.toggleThird();
      if (kb.is('inspect', code) && s.alive && !this.wheel) this.vm.inspect(s);                  // silah inceleme (CS tarzı)
      if (kb.is('leftHand', code)) this.toggleHand();
      if (this.devTools() && s.alive) {
        if (e.code === 'KeyL') { s.fly = !s.fly; if (!s.fly) s.vel.set(0, 0, 0); this.game.hud.toast(s.fly ? $t('hud.t.flyOn') : $t('hud.t.flyOff')); }
        if (e.code === 'KeyP') { const g = this.game, c = g.map.callouts, p = s.pos; let nm = ''; if (c) { let bd = 1e9; for (const q of c) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; nm = q.name; } } } const t = `Konum x ${p.x.toFixed(1)} · y ${p.y.toFixed(1)} · z ${p.z.toFixed(1)}${nm ? ' · ' + nm : ''} · ${s.fly ? 'UÇUŞ AÇIK (çarpışma yok)' : 'yürüyorsun'}`; console.log('[geliştirici]', t); g.hud.toast(t, '#cfe6ff'); }
        if (e.code === 'KeyN') { const g = this.game; if (g.brainsOff) { g.brains.push(...g.brainsOff); g.brainsOff = null; g.hud.toast($t('hud.t.botsOn'), '#9fe6a8'); } else { g.brainsOff = g.brains.splice(0); g.hud.toast($t('hud.t.botsOff'), '#ffd27a'); } }
        if (e.code === 'KeyO') { const g = this.game; g.devGod = !g.devGod; g.hud.toast(g.devGod ? $t('hud.t.godOn') : $t('hud.t.godOff'), '#cfe6ff'); }
        if (e.code === 'KeyJ') this.cycleWeapon(-1);
        if (e.code === 'KeyK') this.cycleWeapon(1);
      }
      if (this.third && kb.is('leanLeft', code)) this.side = -1;                     // 3. şahıs: eğilme tuşları omuz değiştirir (aynı zamanda yatırır)
      if (this.third && kb.is('leanRight', code)) this.side = 1;
      if (kb.is('reload', code)) { s.startReload(); this.game.online?.edge('rl'); }
      if (s.alive && kb.is('crouch', code)) { s.toggleCrouch(); this.game.online?.edge('c'); }
      if (s.alive && kb.is('prone', code)) { s.toggleProne(); this.game.online?.edge('p'); }
      if (s.alive && kb.is('optic', code)) { this.game.online?.edge('o'); const o = s.cycleOptic(); if (o) this.game.hud.toast($t('hud.t.optic', { o: opticName(s.opticId) }), '#cfe6ff'); }
      const slot = kb.slotOf(code);
      if (slot >= 0) s.switchTo(slot);
      if (kb.is('fireMode', code) && s.alive) { s.toggleFireMode(); this.game.online?.edge('fm'); }
      if (kb.is('scoreboard', code)) { e.preventDefault(); this.game.hud.showScoreboard(true); }
      if (kb.is('ability', code) && s.alive && s.def.zombie && !e.repeat) this.zAbility();
      if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
      if (kb.is('jump', code) && s.alive && (s.prone || s.crouching)) { s.standUp(); this.game.online?.edge('u'); this.spaceLatch = true; }   // yatarken/çömelirken zıplama tuşu = kalk
      if (code === 'Escape' && this.game.noPointerLock) this.game.togglePause();
      if (!s.alive && this.game.respawnReady() && this.game.mode.infection) {                                  // Enfekte ölüm ekranı: 1-5 zombi türü
        const n = slot >= 0 ? slot : code === 'Digit5' ? 4 : -1;
        const ks = Object.keys(this.game.classDefs);
        if (s.willCure) { if (n >= 0 && ks[n]) this.game.requestClass(ks[n]); }                   // can hakkı bitti: insan olarak doğacaksın → sınıf seç
        else if (!s.boss && n >= 0 && ZT_ORDER[n]) this.game.requestZType(ZT_ORDER[n]);
      }
      if (!s.alive && this.game.respawnReady() && !this.game.mode.infection && !this.game.mode.fixed) {                                 // ölüm ekranında sınıf seç: yuva tuşları 1-4, Digit5 beşinci sınıf
        const keys = Object.keys(this.game.classDefs);
        const n = slot >= 0 ? slot : code === 'Digit5' ? 4 : -1;
        if (n >= 0 && keys[n]) this.game.requestClass(keys[n]);
        const step = kb.is('leanLeft', code) || code === 'ArrowLeft' ? -1 : kb.is('leanRight', code) || code === 'ArrowRight' ? 1 : 0;   // doğma noktası: sol/sağ eğil tuşları (ya da ← →) seçeneği değiştirir
        if (step) this.game.cycleSpawn(step);
      }
    });
    this.on(window, 'blur', () => { this.keys.clear(); this.fireHeld = false; this.s.ads = false; this.game.hud.showScoreboard(false); this.closeWheel(); });     // pencere odağı gidince takılı tuş kalmasın
    this.on(window, 'keyup', (e) => {
      const code = norm(e.code), kb = this.kb;
      if (kb.is('wheel', code)) this.closeWheel();
      if (code === 'Tab' || kb.is('scoreboard', code)) e.preventDefault();
      this.keys.delete(code);
      if (kb.is('jump', code)) this.spaceLatch = false;
      if (kb.is('scoreboard', code)) this.game.hud.showScoreboard(false);
    });
    this.on(document, 'mousemove', (e) => {
      if (this.game.chatOpen) return;                                                          // yazarken bakış donar
      if (this.skipMove > 0) { this.skipMove--; return; }                                    // kilit sonrası ilk olaylar sıçrar
      // ani sıçramaları (sürücü/Chrome hatası) kes: tek olayda 120 pikselden fazla gerçek bir fare hareketi değildir
      const mx = Math.max(-120, Math.min(120, e.movementX || 0)), my = Math.max(-120, Math.min(120, e.movementY || 0));
      if (this.wheel) { this.wheelMove(mx, my); return; }                                      // T basılıyken fare seçim imlecidir
      if (!this.locked) return;
      const k = this.set.sens * (this.s.zoomNow && this.s.adsT > 0.5 ? 1 / Math.pow(this.s.zoomNow, 0.8) : 1);
      this.look(mx * k, my * k);
      this.lookDX += mx; this.lookDY += my;
    });
    this.on(cv, 'mousedown', (e) => {
      if (this.wheel) { if (e.button === 0) this.wheelPick(); return; }                       // tekerlek açıkken tık = seçim (ateş değil)
      if (!this.locked) { this.game.requestLock(); return; }
      if (this.game.chatOpen) return;
      if (e.button === 0) { this.fireHeld = true; this.fireBuf = 0.15; this.game.online?.edge('fp'); }
      if (e.button === 2 && this.s.def.zombie) { this.zAbility(); return; }                  // zombi: sağ tık = özel güç
      if (e.button === 2) this.s.ads = this.game.opts.adsToggle ? !this.s.ads : true;          // Ayarlar: basılı tut ya da bir kez bas (aç-kapa)
    });
    this.on(window, 'mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2 && !this.game.opts.adsToggle) this.s.ads = false;
    });
    this.on(document, 'contextmenu', (e) => e.preventDefault());                      // sağ tık menüsü oyunda hiç çıkmasın (nişan alırken takılıyordu)
    this.on(window, 'wheel', (e) => {
      if (!this.locked || !this.s.alive) return;
      const dir = e.deltaY > 0 ? 1 : -1, s = this.s;
      if (s.fly && this.devTools()) { this.flySpeed = Math.max(3, Math.min(120, (this.flySpeed || 13) * (dir > 0 ? 0.8 : 1.25))); this.game.hud.toast($t('hud.t.flySpeed', { n: this.flySpeed.toFixed(0) }), '#cfe6ff'); return; }       // uçarken tekerlek hız ayarlar
      for (let k = 1; k <= 4; k++) { const j = (s.cur + dir * k + 8) % 4; if (j !== s.cur && s.canEquip(j)) { s.switchTo(j); break; } }       // boş slotları atla
    }, { passive: true });
  }

  // Silahı tutan eli değiştir (sağ ↔ sol): birinci şahıs modeli aynalanır; tercih kaydedilir
  toggleHand() {
    const g = this.game;
    g.leftHand = !g.leftHand;
    g.hud.toast(g.leftHand ? $t('hud.t.leftHand') : $t('hud.t.rightHand'), '#cfe6ff');
    g.opts.onPref?.({ leftHand: g.leftHand });
  }

  // ── 3. şahıs kamera (H) ──
  toggleThird() {
    const g = this.game;
    if (!g.thirdAllowed) { g.hud.toast($t('hud.t.thirdOff'), '#ffd27a'); return; }
    this.third = !this.third;
    g.hud.toast(this.third ? $t('hud.t.third', { a: codeLabel(this.kb.codes('leanLeft')[0]), b: codeLabel(this.kb.codes('leanRight')[0]), c: codeLabel(this.kb.codes('third')[0]) }) : $t('hud.t.first'), '#cfe6ff');
  }

  // Omuz üstü kamera: gözün arkasında ve yanında; duvara girerse yaklaşır, yere gömülmez; Q/E ile sağ-sol omuz akıcı geçer
  thirdCamera(dt, T) {
    const s = this.s, g = this.game, v = this._tv, cam = g.camera;
    const fwd = s.aimDir(v.f), right = s.right(v.r);
    const adsK = 1 - s.adsT * 0.45;                                             // nişan alırken kamera biraz yaklaşır
    const pivot = s.eye(v.p); pivot.y += 0.1;
    const des = v.d.copy(pivot).addScaledVector(fwd, -2.5 * adsK * T).addScaledVector(right, this.sideT * 0.72 * (1 - s.adsT * 0.3) * T);
    des.y += 0.2 * T;
    const dir = v.e.subVectors(des, pivot), len = dir.length();
    if (len > 1e-4) {
      dir.multiplyScalar(1 / len);
      const h = g.world.raycast(pivot, dir, len + 0.2, v.hit);
      const use = h ? Math.max(0.25, h.t - 0.22) : len;
      this.camHit = h ? h.t : 0;
      des.copy(pivot).addScaledVector(dir, Math.min(len, use));
    }
    des.y = Math.max(des.y, g.world.heightAt(des.x, des.z) + 0.3);              // yere gömülme
    if (!this._cs) this._cs = des.clone(); else this._cs.lerp(des, 1 - Math.exp(-28 * dt));
    cam.position.copy(this._cs);
    s.shotOff = (s.shotOff || (s.shotOff = new THREE.Vector3())).subVectors(cam.position, s.eye(v.q));
    // kamera duvar dibinde göze yapışırsa kendi kafan görüşü kapatmasın: gövdeyi gizle, 1. şahıs silahını göster (histerezis)
    this.bodyVisible = T > 0.3 && s.shotOff.length() > (this.bodyVisible ? 0.65 : 0.85);
  }

  // ── T tekerleği: silahın uygun nişangâhları (ileride silah özelleştirmeleri de buraya eklenir) ──
  openWheel() {
    const s = this.s, g = this.game;
    if (!this.locked && !g.opts.nolock) return;
    const list = this.opticList();
    if (list.length < 2) { g.hud.toast($t('hud.t.noOptic', { w: wName(s.item.id) }), '#cfd3d8'); return; }
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:25;pointer-events:none;font-family:Bahnschrift,Rajdhani,Arial Narrow,sans-serif;color:#e8edf5;background:radial-gradient(circle at 50% 50%,rgba(4,6,10,.15),rgba(4,6,10,.62))';
    const R = 150, n = list.length;
    const opts = list.map((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, d = document.createElement('div');
      d.style.cssText = `position:absolute;left:calc(50% + ${Math.cos(a) * R}px);top:calc(50% + ${Math.sin(a) * R}px);transform:translate(-50%,-50%);min-width:130px;padding:10px 14px;text-align:center;background:rgba(9,13,19,.78);border:2px solid rgba(255,255,255,.2);letter-spacing:2px;text-transform:uppercase;transition:.08s`;
      d.innerHTML = `<div style="font-size:18px;font-weight:700">${opticName(id)}</div><div style="font-size:11px;opacity:.65;margin-top:3px">${OPTICS[id].zoom ? $t('hud.zoom', { n: OPTICS[id].zoom }) : ''}</div>`;
      el.appendChild(d);
      return { id, a, d };
    });
    const head = document.createElement('div');
    head.style.cssText = 'position:absolute;left:50%;top:calc(50% - 14px);transform:translateX(-50%);font-size:13px;letter-spacing:4px;opacity:.8;text-align:center';
    head.innerHTML = `${$t('hud.wheel')}<div style="font-size:11px;opacity:.7;letter-spacing:1px;margin-top:4px">${$t('hud.wheelHint', { w: wName(s.item.id) })}</div>`;
    const cur = document.createElement('div');
    cur.style.cssText = 'position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#ff8a1f;box-shadow:0 0 12px #ff8a1f';
    el.append(head, cur);
    document.body.appendChild(el);
    this.wheel = { el, opts, cur, x: 0, y: 0, hover: null };
    this.fireHeld = false;
    this.wheelPaint();
  }

  wheelMove(dx, dy) {
    const w = this.wheel; if (!w) return;
    w.x += dx; w.y += dy;
    const l = Math.hypot(w.x, w.y), max = 210;
    if (l > max) { w.x *= max / l; w.y *= max / l; }
    w.cur.style.transform = `translate(${w.x}px,${w.y}px)`;
    // imleç merkezden yeterince uzaksa açıya göre en yakın seçenek
    w.hover = null;
    if (Math.hypot(w.x, w.y) > 55) {
      const ang = Math.atan2(w.y, w.x);
      let best = Infinity;
      for (const o of w.opts) { const d = Math.abs(((ang - o.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < best) { best = d; w.hover = o; } }
    }
    this.wheelPaint();
  }

  wheelPaint() {
    const w = this.wheel; if (!w) return;
    const now = this.s.opticId;
    for (const o of w.opts) {
      const on = o === w.hover, cur = o.id === now;
      o.d.style.borderColor = on ? '#ff8a1f' : cur ? '#7be07a' : 'rgba(255,255,255,.2)';
      o.d.style.background = on ? 'rgba(80,42,8,.88)' : 'rgba(9,13,19,.78)';
      o.d.style.transform = `translate(-50%,-50%) scale(${on ? 1.08 : 1})`;
    }
  }

  wheelPick() {
    const w = this.wheel; if (!w || !w.hover) return;
    this.pickOptic(w.hover.id);
    this.wheelPaint();
  }
  // Elimdeki silahın seçilebilir nişangâhları (T tekerleği ve dokunmatik nişangâh seçicisi ortak)
  opticList() { return (OPTIC_ALLOWED[this.s.item.id] || []).filter((id) => OPTICS[id]); }
  // Nişangâhı seç: yerelde hemen, çevrimiçinde sunucuya da (room.opt → setOptic). Dönen: nişangâh tanımı ya da null
  pickOptic(id) {
    const o = this.s.alive ? this.s.setOptic(id) : null;
    if (o) { this.game.online?.send({ t: 'opt', optic: id }); this.game.hud.toast($t('hud.t.optic', { o: opticName(id) }), '#cfe6ff'); }
    return o;
  }

  closeWheel() {
    if (!this.wheel) return;
    this.wheel.el.remove();
    this.wheel = null;
  }

  // Etkin nişan büyütmesi: dokunmatikte dürbünsüz nişangâhlar (demir / red dot / holo, ≤ 2×) daha çok yakınlaştırır (küçük ekranda hedef seçilsin):
  // demir 1,15 → 1,30×, red dot / holo 1,3 → 1,60× (önce ×1,6: 1,24 / 1,48); dürbünler (ACOG 3×, 4×, 6×) aynı
  zoomOf(z) { return this.touch && z > 1 && z < 2 ? 1 + (z - 1) * 2 : z; }
  zoomEff() { return this.zoomOf(this.s.zoomNow || 0); }
  // Dikey FOV (derece): masaüstünde ayar doğrudan dikey FOV; dokunmatikte ayar YATAY FOV'dur (2,2:1 telefonda dikey 75° → yatay 118°, düşman küçücük kalıyordu)
  baseFov() { const f = this.set.fov; if (!this.touch) return f; const a = this.game.camera.aspect || 16 / 9; return (2 * Math.atan(Math.tan((f * Math.PI) / 360) / a) * 180) / Math.PI; }

  look(dx, dy) {
    const s = this.s;
    s.yaw -= dx;
    s.pitch = clamp(s.pitch - dy, -1.5, 1.5);
  }

  dispose() { this.closeWheel(); for (const [t, ev, fn, opt] of this._bound) t.removeEventListener(ev, fn, opt); this._bound = []; this.fx?.remove(); this.fxSmoke?.remove(); this.touch?.dispose(); }

  update(dt) {
    const s = this.s, g = this.game;
    this.fireBuf = Math.max(0, this.fireBuf - dt);
    if (this.touch && !g.opts.autoplay) this.touch.assist(dt);                      // dokunmatik nişan yardımı (masaüstünde yok)
    if (s.alive && this.locked && !g.opts.autoplay) {
      const kk = this.keys, sp = 1.9 * dt / Math.pow(Math.max(1, s.zoomNow && s.adsT > 0.5 ? s.zoomNow : 1), 0.7);
      if (kk.has('ArrowLeft')) s.yaw += sp;
      if (kk.has('ArrowRight')) s.yaw -= sp;
      if (kk.has('ArrowUp')) s.pitch = clamp(s.pitch + sp, -1.5, 1.5);
      if (kk.has('ArrowDown')) s.pitch = clamp(s.pitch - sp, -1.5, 1.5);
    }
    if (s.alive && !g.opts.autoplay) {
      const k = this.keys;
      const kb = this.kb, T = this.touch;
      if (g.opts.adsToggle && (s.sprinting || s.cur !== this._adsCur)) s.ads = false;           // aç-kapa nişan: koşmak ve silah değiştirmek nişanı kapatır
      this._adsCur = s.cur;
      const f = (kb.held('forward', k) ? 1 : 0) - (kb.held('back', k) ? 1 : 0) || (T ? T.f : 0);
      const r = (kb.held('right', k) ? 1 : 0) - (kb.held('left', k) ? 1 : 0) || (T ? T.r : 0);
      const st = s.stat;
      const lean = (kb.held('leanRight', k) ? 1 : 0) - (kb.held('leanLeft', k) ? 1 : 0);                 // 3. şahısta da Q/E yatar (ve omuzu değiştirir)
      const inp = { f, r, lean, sprint: kb.held('sprint', k) || !!(T && T.sprint), jump: (kb.held('jump', k) && !this.spaceLatch) || !!(T && T.jump) };
      if (s.fly) this.flyMove(f, r, k, dt); else applyInput(s, inp, dt);
      if (g.online) g.online.pushInput(inp, s, this.fireHeld);
      if (!kb.held('jump', k)) this.spaceLatch = false;

      // ateş
      if (this.locked) {
        if (st.kind === 'melee') { if (this.fireHeld || this.fireBuf > 0) { if (s.tryFire()) this.fireBuf = 0; } }
        else if (s.triggerUpdate(this.fireHeld, this.fireBuf)) this.fireBuf = 0;
      }
      // adım sesi
      const sp = Math.hypot(s.vel.x, s.vel.z);
      if (s.onGround && sp > 1.5 && !s.crouching && !s.prone) {
        s.stepT -= dt * (sp / TUNE.walkSpeed) * (g.abfx?.stepMul || 1);             // atılış / öfke: adım temposu hızlanır
        if (s.stepT <= 0) { s.stepT = 0.42; g.sfx.step(null); }
      }
    }

    // ── kamera ──
    const cam = g.camera;
    g.abfx?.update(dt);                                                                // zombi gücü ekran efektleri (FOV vuruşu / adım temposu buradan)
    const baseFov = this.baseFov();
    const zoom = s.zoomNow && !this.vm.model?.userData.noAds ? lerp(1, this.zoomEff(), s.adsT) : 1;
    const targetFov = baseFov / zoom + (g.abfx?.fovAdd || 0);
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 18);
    cam.updateProjectionMatrix();
    const sh = g.effects.shake;
    // 3. şahıs geçişi: dürbünle nişan alırken (scope) otomatik 1. şahsa döner
    const wantThird = this.third && s.alive && !(s.overlay === 'scope' && s.adsT > 0.35) ? 1 : 0;
    this.thirdT += Math.sign(wantThird - this.thirdT) * Math.min(Math.abs(wantThird - this.thirdT), dt * 4.5);
    this.sideT += (this.side - this.sideT) * (1 - Math.exp(-9 * dt));
    s.stanceLeft = this.third && this.thirdT > 0.3 && this.side < 0;          // karakter modeli sol omuz duruşuna geçsin (aynalı)
    if (s.alive) {
      this.deathCamT = 0;
      s.eye(cam.position);
      cam.rotation.order = 'YXZ';
      cam.rotation.set(
        s.pitch + s.recoilP + (Math.random() - 0.5) * sh * 0.06 + this.vm.camPitch,
        s.yaw + (Math.random() - 0.5) * sh * 0.06,
        -s.leanT * 0.2 * (1 - 0.6 * this.thirdT) + this.vm.camRoll + (Math.random() - 0.5) * sh * 0.03,
      );
      if (this.thirdT > 0.002) this.thirdCamera(dt, this.thirdT); else { this._cs = null; s.shotOff = null; this.bodyVisible = false; }
      const vo = g.online && g.online.viewOff;                      // çevrimiçi: tahmin düzeltmesi kamerada yumuşatılır (bkz. NetClient.reconcile)
      if (vo) { const k = Math.exp(-dt * 11); vo.x *= k; vo.y *= k; vo.z *= k; cam.position.x += vo.x; cam.position.y += vo.y; cam.position.z += vo.z; }
      this.camPos.copy(cam.position);
    } else {
      s.shotOff = null; this._cs = null; this.bodyVisible = false;
      this.deathCamT += dt;
      const t = Math.min(1, this.deathCamT * 2.5);
      cam.position.set(this.camPos.x, Math.max(0.35, this.camPos.y - t * 1.1), this.camPos.z);
      const killer = s.lastHit && s.lastHit !== s ? s.lastHit : null;
      if (killer) {
        const dx = killer.pos.x - cam.position.x, dz = killer.pos.z - cam.position.z;
        const ty = Math.atan2(-dx, -dz);
        s.yaw += clamp(((ty - s.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2 * dt, 2 * dt);
      }
      cam.rotation.set(Math.max(-0.2, s.pitch * (1 - t) - t * 0.15), s.yaw, t * 0.5);
    }
    g.sfx.setListener(cam);
    // ekran örtüleri
    const bl = s.alive && s.blindT > 0 ? Math.min(1, s.blindT / (Math.max(0.5, s.blindMax) * 0.5)) : 0;
    this.fx.style.opacity = bl.toFixed(2);
    const sd = s.alive ? (g.smokeDensity?.(cam.position) || 0) : 0;
    this.fxSmoke.style.opacity = (sd * 0.92).toFixed(2);
    this.vm.update(dt, this);
    this.lookDX *= 0.5; this.lookDY *= 0.5;
  }
}
