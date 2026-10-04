import * as THREE from 'three';
import { createWeapon } from '../models/weapons.js';
import { createItem } from '../models/items.js';
import { TEAMS } from '../core/palette.js';
import { WSTATS, OPTICS, OPTIC_ALLOWED } from './stats.js';
import { reloadAnim, meleePose } from './anim.js';
import { box } from '../core/geo.js';
import { clamp, lerp, V3 } from './util.js';
import { applyInput } from '../sim/input.js';

const VM_SCALE = 0.92;
const ADS_FOV = 68;

// ───────────── Birinci şahıs silah modeli ─────────────
const Z = new THREE.Vector3(0, 0, 1);
const REST_L = new THREE.Vector3(-0.2, -0.3, 0.2);      // sol el dinlenme (kullanılmıyorsa ekran dışı)
const POUCH_VM = new THREE.Vector3(-0.3, -0.34, 0.3);   // yelek şarjör cebi (silah yerelinde)
const MELEE_IDLE = { pos: [0.1, -0.12, -0.46], rx: 0.5, ry: 0.22, rz: -0.35 };
const MELEE_SPRINT = { pos: [-0.04, 0.06, -0.06], rx: 0.65, ry: 0.3, rz: -0.1 };

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
    this.root = new THREE.Group();
    this.cam.add(this.root);
    this.model = null; this.id = null;
    this.kick = 0; this.kickR = 0; this.bobT = 0; this.raise = 1; this.raiseRate = 3.5;
    this.boltT = 0; this.hitKick = 0; this.throwT = 0; this.dryT = 0;
    this.camRoll = 0; this.camPitch = 0; this.inspectT = 0;
    this.pos = new THREE.Vector3(0.2, -0.21, -0.66);
    this.flash = null; this.flashT = 0;
    this.handL = null; this.handR = null;
  }

  setItem(id, team, kind, optic) {
    if (this.model) { this.root.remove(this.model); this.model.traverse((o) => o.geometry?.dispose()); }
    this.id = id;
    this.raise = 1;
    this.raiseRate = 1 / Math.max(0.15, Math.min(0.35, WSTATS[id]?.equip ?? 0.3));
    this.boltT = 0;
    const c = TEAMS[team];
    const g = new THREE.Group();
    this.flash = null;
    if (kind === 'medkit') {
      const m = createItem('medkit'); m.scale.setScalar(1.5); m.position.set(0, -0.08, 0); g.add(m);
      g.userData = { gripR: new THREE.Vector3(0.02, -0.02, 0.0), gripL: null, muzzle: new THREE.Vector3(), sight: [0, 0, 0], dist: 0.3, noAds: true };
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
    // eller + kollar (silaha bağlı). Eller ayrı gruplardır: yükleme animasyonunda bağımsız hareket eder
    const hand = (p, side) => {
      const grp = new THREE.Group();
      grp.position.copy(p);
      box(grp, [0.1, 0.1, 0.12], c.gloves, [0, 0, 0]);
      const dir = new THREE.Vector3(side * 0.12, -0.2, 0.42).normalize();
      const len = 0.5;
      const sleeve = box(grp, [0.11, 0.11, len], c.shirt, [0, 0, 0]);
      sleeve.position.copy(dir).multiplyScalar(len / 2 + 0.05);
      sleeve.quaternion.setFromUnitVectors(Z, dir);
      g.add(grp);
      return grp;
    };
    const u = g.userData;
    this.handR = u.gripR ? hand(u.gripR.clone().add(new THREE.Vector3(0.0, -0.02, 0.0)), 1) : null;
    this.hLfg = u.gripL ? u.gripL.clone().add(new THREE.Vector3(0, -0.03, 0)) : null;
    this.handL = (kind === 'gun' || kind === 'launcher') ? hand(this.hLfg || REST_L, -1) : null;
    if (this.handL && !this.hLfg) this.handL.visible = false;
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

  adsTarget(u) {
    const [sx, sy, sz] = u.sight || [0, 0.1, -0.1];
    const k = VM_SCALE;   // model ölçeklendiği için nişan noktası da ölçeklenir
    return new THREE.Vector3(-sx * k, -sy * k, -(u.dist ?? 0.3) - sz * k);
  }

  update(dt, p) {
    const s = p.s, st = s.stat;
    const u = this.model?.userData || {};
    const hip = this.pos;
    const ads = u.noAds ? 0 : s.adsT;
    const tgt = this.adsTarget(u);
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const isMelee = st.kind === 'melee';
    const isGun = st.kind === 'gun' || st.kind === 'launcher';
    this.bobT += dt * (speed > 0.5 && s.onGround ? 1 : 0) * (s.sprinting ? 12 : 8);
    const bobAmt = (1 - ads * 0.85) * clamp(speed / 5, 0, 1) * (s.sprinting ? 1.6 : 1);
    this.kick = Math.max(0, this.kick - dt * 6 * (0.2 + this.kick * 10));
    this.kickR = Math.max(0, this.kickR - dt * 5);
    this.raise = Math.max(0, this.raise - dt * this.raiseRate);
    this.hitKick = Math.max(0, this.hitKick - dt * 7);
    this.throwT = Math.max(0, this.throwT - dt * 3);
    this.dryT = Math.max(0, this.dryT - dt * 8);
    this.boltT = Math.max(0, this.boltT - dt / 0.95);
    const rz0 = this.raise * this.raise;

    let pos = new THREE.Vector3().lerpVectors(hip, tgt, ads);
    pos.x += Math.sin(this.bobT) * 0.012 * bobAmt;
    pos.y += Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmt - rz0 * 0.38;
    pos.z += this.kick * (0.9 - ads * 0.6);
    let rx = this.kickR * (0.4 - ads * 0.3), ry = -0.04 * (1 - ads), rz = 0;
    rx += this.dryT * 0.05 - rz0 * 0.5;

    // yeniden doldurma ilerlemesi
    let ra = null;
    if (s.reloadT > 0 && isGun) {
      const el = s.reloadTotal - s.reloadT;
      ra = reloadAnim(s.reloadStyle, clamp(el / s.reloadTotal, 0, 1), s.reloadEmpty, s.reloadStyle === 'shell' ? ((el / st.shell) % 1 + 1) % 1 : 0);
    }

    // sprint (bıçakta yukarıda tutulur; yüklerken sprint pozu azalır)
    const sp = s.sprinting ? 1 : 0;
    this.sprintT = lerp(this.sprintT || 0, sp, Math.min(1, dt * 9));
    const sprK = this.sprintT * (1 - (ra ? ra.tilt * 0.8 : 0));
    if (isMelee) {
      pos.x += MELEE_IDLE.pos[0] - hip.x; pos.y += MELEE_IDLE.pos[1] - hip.y; pos.z += MELEE_IDLE.pos[2] - hip.z;
      rx += MELEE_IDLE.rx; ry += MELEE_IDLE.ry; rz += MELEE_IDLE.rz;
      pos.x += MELEE_SPRINT.pos[0] * sprK; pos.y += MELEE_SPRINT.pos[1] * sprK; pos.z += MELEE_SPRINT.pos[2] * sprK;
      rx += MELEE_SPRINT.rx * sprK; ry += MELEE_SPRINT.ry * sprK; rz += MELEE_SPRINT.rz * sprK;
    } else {
      pos.x -= sprK * 0.1; pos.y -= sprK * 0.1; pos.z += sprK * 0.05;
      rx -= sprK * 0.55; ry += sprK * 0.7;
    }

    // ── silah inceleme: öne/ortaya al, yandan göster, ters çevir, üstten bak, geri indir ──
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
      pos.x -= 0.19 * insp; pos.y += 0.05 * insp; pos.z += 0.07 * insp;
      ry += 0.95 * a + 0.25 * b; rx += -0.2 * a + 0.5 * c; rz += -0.95 * b + 0.3 * c;
    }

    // ── yükleme: silah yana yatar, sol el şarjöre/kemere gider, şarjör çıkar-takılır, kol şarjı ──
    let camRoll = 0, camPitch = 0;
    if (ra) {
      pos.y += ra.tilt * 0.07 - ra.slap * 0.012; pos.x -= ra.tilt * 0.12; pos.z += ra.slap * 0.035 - ra.tilt * 0.1;
      rx -= ra.tilt * 0.22 + ra.slap * 0.05; rz -= ra.tilt * 0.62; ry += ra.tilt * 0.3;
    } else if (s.useT > 0) {
      const tot = Math.max(0.5, st.useTime || 1.4);
      const b = Math.sin(clamp(1 - s.useT / tot, 0, 1) * Math.PI);
      pos.y -= b * 0.18; pos.x -= b * 0.05; rx -= b * 0.7; rz += b * 0.5;
    }
    // sürgülü: ateşten sonra sürgü çekilir (kısa el hareketi)
    let boltK = 0;
    if (u.bolt && !ra) { const b = 1 - this.boltT; boltK = this.boltT > 0 ? Math.sin(Math.PI * clamp((b - 0.22) / 0.55, 0, 1)) : 0; rz -= boltK * 0.35; pos.x -= boltK * 0.02; }
    if (u.bolt) { const bb = ra ? ra.bolt : boltK; u.bolt.g.position.set(0, u.bolt.pivot, bb * 0.085); u.bolt.g.rotation.z = bb * 0.9; }
    // şarjör alt grubu
    if (u.mag) {
      const ax = u.magAxis || [0, -1, 0], off = ra ? ra.magOut * 0.24 : 0;
      u.mag.visible = ra ? ra.magVis : true;
      u.mag.position.set(ax[0] * off, ax[1] * off, ax[2] * off);
      u.mag.rotation.x = ra ? -ra.magOut * 0.35 : 0;
    }
    // sol el
    if (this.handL) {
      if (ra) {
        this.handL.visible = true;
        const fg = this.hLfg || REST_L;
        const mg = u.magPos ? u.magPos.clone().add(new THREE.Vector3(0, -0.02, 0)) : new THREE.Vector3(0, -0.03, -0.03);
        if (u.mag && ra.magOut > 0 && ra.w.mag > 0.4) mg.addScaledVector(new THREE.Vector3(...(u.magAxis || [0, -1, 0])), ra.magOut * 0.24);
        const ch = new THREE.Vector3(0.02, 0.07, -0.09);
        const w = ra.w;
        this.handL.position.set(0, 0, 0).addScaledVector(fg, w.fg).addScaledVector(mg, w.mag).addScaledVector(POUCH_VM, w.pouch).addScaledVector(ch, w.charge);
        this.handL.position.z += ra.charge * 0.08 * w.charge;    // kol şarjını geri çek
      } else {
        this.handL.visible = !!this.hLfg && insp < 0.15;               // incelerken sol el silahı bırakır
        if (this.hLfg) this.handL.position.copy(this.hLfg);
      }
    }
    // ── yakın dövüş savurması ──
    if (isMelee && s.swing) {
      const sw = s.swing;
      const mpz = meleePose(sw.kind, clamp(sw.t / sw.dur, 0, 1));
      pos.x += mpz.x * 1.9; pos.y += mpz.y * 1.7; pos.z += mpz.z * 1.6;
      rx += mpz.rx; ry += mpz.ry; rz += mpz.rz;
      camRoll = -mpz.ry * 0.025; camPitch = mpz.rx * 0.012;
    }
    // vuruş geri tepmesi ve fırlatma
    pos.z += this.hitKick * 0.06; rx += this.hitKick * 0.18;
    if (this.throwT > 0) { const t = 1 - this.throwT; pos.z += Math.sin(t * Math.PI) * 0.12; rx += Math.sin(Math.min(1, t * 1.4) * Math.PI) * -0.5; pos.y -= Math.sin(t * Math.PI) * 0.06; }
    // sallanma (mouse)
    this.sx = lerp(this.sx || 0, -p.lookDX * 0.0006, Math.min(1, dt * 12));
    this.sy = lerp(this.sy || 0, p.lookDY * 0.0006, Math.min(1, dt * 12));
    ry += clamp(this.sx, -0.05, 0.05) * (1 - ads);
    rx += clamp(this.sy, -0.05, 0.05) * (1 - ads);

    this.root.position.copy(pos);
    this.root.rotation.set(rx, ry, rz);
    this.root.scale.setScalar(VM_SCALE);
    this.camRoll = lerp(this.camRoll, camRoll, Math.min(1, dt * 14));
    this.camPitch = lerp(this.camPitch, camPitch, Math.min(1, dt * 14));

    if (this.flash) {
      this.flashT = Math.max(0, this.flashT - dt);
      this.flash.visible = this.flashT > 0;
    }
    // dürbünlü silahta tam nişanda modeli gizle
    this.root.visible = !(s.overlay === 'scope' && s.adsT > 0.9);
    this.cam.rotation.z = -s.leanT * 0.2;   // yana eğilirken silah da kafayla birlikte yatar
    // nişan alırken silah kamerasının görüş açısı genişler: silah/nişangâh ekranda küçülür, rakip örtülmez (dürbünsüz silahlarda)
    const fovT = 54 + (ADS_FOV - 54) * (u.noAds ? 0 : ads);
    if (Math.abs(this.cam.fov - fovT) > 0.01) { this.cam.fov = fovT; this.cam.updateProjectionMatrix(); }
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
    this.refreshWeapon();
    game.on('switch', (s) => { if (s === this.s) this.refreshWeapon(); });
    game.on('spawn', (s) => { if (s === this.s) this.refreshWeapon(); });
    if (this.devTools()) setTimeout(() => game.hud?.toast('Atölye: L uç · J/K silah değiştir (yuva başına) · 1-4 yuva', '#ffb347'), 2500);
    game.on('fire', (s) => { if (s === this.s) { this.vm.kick = Math.min(this.vm.kick + 0.045, 0.12); this.vm.kickR = Math.min(this.vm.kickR + 0.18, 0.5); this.vm.flashT = 0.045; } });
    game.on('bolt', (s) => { if (s === this.s) this.vm.kickR += 0.2; });
    game.on('melee', (s) => { if (s === this.s) this.vm.kick = 0.02; });
    game.on('meleehit', () => { this.vm.hitKick = 1; });
    game.on('throw', (s) => { if (s === this.s) this.vm.throwT = 1; });
    game.on('dry', (s) => { if (s === this.s) this.vm.dryT = 1; });
    game.on('firemode', (s) => { if (s === this.s) { this.game.hud.toast('Atış modu: ' + (s.item.semi ? 'Yarı otomatik' : 'Otomatik'), '#cfe6ff'); this.vm.dryT = 1; } });
    // flaşbang (beyaz) ve duman (gri) ekran örtüsü: HUD'dan bağımsız, kendi katmanı
    const ov = (this.fx = document.createElement('div'));
    ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;background:#fff';
    const sm = (this.fxSmoke = document.createElement('div'));
    sm.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:#9aa0a6';
    document.body.append(sm, ov);
  }

  // Geliştirici haritası (yalnızca çevrimdışı): L uçuş, J/K elindeki yuvadaki silahı sıradakiyle değiştirir
  devTools() { return !!this.game.mapDef?.dev && !this.game.online; }

  flyMove(f, r, k, dt) {
    const s = this.s, sp = k.has('ShiftLeft') ? 40 : 13, cp = Math.cos(s.pitch);
    const up = (k.has('Space') ? 1 : 0) - (k.has('KeyC') || k.has('ControlLeft') ? 1 : 0);
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
    this.game.hud.toast(`${st.name}  (${list.indexOf(id) + 1}/${list.length})`);
  }

  refreshWeapon() {
    const s = this.s;
    this.vm.setItem(s.item.id, s.team, s.stat.kind, s.optic);
  }

  on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); this._bound.push([target, ev, fn, opt]); }

  bind() {
    const cv = this.game.canvas;
    this.on(window, 'keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'F3') { if (this.game.running) e.preventDefault(); }   // basılı tutunca tekrar eden olaylar dahil
      if (e.repeat) return;
      this.keys.add(e.code);
      const s = this.s;
      if (!this.game.running) return;
      if (e.code === 'KeyT' && s.alive && !this.wheel) this.openWheel();
      if (e.code === 'KeyH' && s.alive) this.toggleThird();
      if (e.code === 'KeyY' && s.alive && !this.wheel) this.vm.inspect(s);                  // silah inceleme (CS tarzı)
      if (this.devTools() && s.alive) {
        if (e.code === 'KeyL') { s.fly = !s.fly; if (!s.fly) s.vel.set(0, 0, 0); this.game.hud.toast(s.fly ? 'Uçuş AÇIK · WASD/Boşluk/C · Shift hızlı' : 'Uçuş kapalı'); }
        if (e.code === 'KeyJ') this.cycleWeapon(-1);
        if (e.code === 'KeyK') this.cycleWeapon(1);
      }
      if (this.third && e.code === 'KeyQ') this.side = -1;                     // 3. şahıs: Q/E omuz değiştirir (eğilme yerine)
      if (this.third && e.code === 'KeyE') this.side = 1;
      if (e.code === 'KeyR') { s.startReload(); this.game.online?.edge('rl'); }
      if (s.alive && (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight')) { s.toggleCrouch(); this.game.online?.edge('c'); }
      if (s.alive && e.code === 'KeyZ') { s.toggleProne(); this.game.online?.edge('p'); }
      if (s.alive && e.code === 'KeyB') { this.game.online?.edge('o'); const o = s.cycleOptic(); if (o) this.game.hud.toast('Nişangâh: ' + o.label, '#cfe6ff'); }
      if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 4) s.switchTo(n); }
      if (e.code === 'KeyV') s.switchTo(3);
      if (e.code === 'KeyX' && s.alive) { s.toggleFireMode(); this.game.online?.edge('fm'); }
      if (e.code === 'KeyG') s.switchTo(2);
      if (e.code === 'Tab') { e.preventDefault(); this.game.hud.showScoreboard(true); }
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'Space' && s.alive && (s.prone || s.crouching)) { s.standUp(); this.game.online?.edge('u'); this.spaceLatch = true; }   // yatarken/çömelirken Boşluk = kalk
      if (e.code === 'Escape' && this.game.noPointerLock) this.game.togglePause();
      if (!s.alive && this.game.respawnReady() && e.code.startsWith('Digit')) {
        const keys = Object.keys(this.game.classDefs);
        const n = +e.code.slice(5) - 1;
        if (keys[n]) this.game.requestClass(keys[n]);
      }
    });
    this.on(window, 'blur', () => { this.keys.clear(); this.fireHeld = false; this.s.ads = false; this.game.hud.showScoreboard(false); this.closeWheel(); });     // pencere odağı gidince takılı tuş kalmasın
    this.on(window, 'keyup', (e) => {
      if (e.code === 'KeyT') this.closeWheel();
      if (e.code === 'Tab') e.preventDefault();
      this.keys.delete(e.code);
      if (e.code === 'Space') this.spaceLatch = false;
      if (e.code === 'Tab') this.game.hud.showScoreboard(false);
    });
    this.on(document, 'mousemove', (e) => {
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
      if (e.button === 0) { this.fireHeld = true; this.fireBuf = 0.15; this.game.online?.edge('fp'); }
      if (e.button === 2) this.s.ads = true;
    });
    this.on(window, 'mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.s.ads = false;
    });
    this.on(document, 'contextmenu', (e) => e.preventDefault());                      // sağ tık menüsü oyunda hiç çıkmasın (nişan alırken takılıyordu)
    this.on(window, 'wheel', (e) => {
      if (!this.locked || !this.s.alive) return;
      const dir = e.deltaY > 0 ? 1 : -1, s = this.s;
      for (let k = 1; k <= 4; k++) { const j = (s.cur + dir * k + 8) % 4; if (j !== s.cur && s.canEquip(j)) { s.switchTo(j); break; } }       // boş slotları atla
    }, { passive: true });
  }

  // ── 3. şahıs kamera (H) ──
  toggleThird() {
    const g = this.game;
    if (!g.thirdAllowed) { g.hud.toast('Bu odada 3. şahıs kamera kapalı', '#ffd27a'); return; }
    this.third = !this.third;
    g.hud.toast(this.third ? '3. şahıs kamera · Q / E ile omuz değiştir · H: 1. şahıs' : '1. şahıs kamera', '#cfe6ff');
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
    const list = (OPTIC_ALLOWED[s.item.id] || []).filter((id) => OPTICS[id]);
    if (list.length < 2) { g.hud.toast(`${s.stat.name}: seçilebilir nişangâh yok`, '#cfd3d8'); return; }
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:25;pointer-events:none;font-family:Bahnschrift,Rajdhani,Arial Narrow,sans-serif;color:#e8edf5;background:radial-gradient(circle at 50% 50%,rgba(4,6,10,.15),rgba(4,6,10,.62))';
    const R = 150, n = list.length;
    const opts = list.map((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, d = document.createElement('div');
      d.style.cssText = `position:absolute;left:calc(50% + ${Math.cos(a) * R}px);top:calc(50% + ${Math.sin(a) * R}px);transform:translate(-50%,-50%);min-width:130px;padding:10px 14px;text-align:center;background:rgba(9,13,19,.78);border:2px solid rgba(255,255,255,.2);letter-spacing:2px;text-transform:uppercase;transition:.08s`;
      d.innerHTML = `<div style="font-size:18px;font-weight:700">${OPTICS[id].label}</div><div style="font-size:11px;opacity:.65;margin-top:3px">${OPTICS[id].zoom ? OPTICS[id].zoom + 'x yakınlaştırma' : ''}</div>`;
      el.appendChild(d);
      return { id, a, d };
    });
    const head = document.createElement('div');
    head.style.cssText = 'position:absolute;left:50%;top:calc(50% - 14px);transform:translateX(-50%);font-size:13px;letter-spacing:4px;opacity:.8;text-align:center';
    head.innerHTML = `NİŞANGÂH<div style="font-size:11px;opacity:.7;letter-spacing:1px;margin-top:4px">${s.stat.name} · fareyle seç, sol tık</div>`;
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
    const id = w.hover.id, o = this.s.setOptic(id);
    if (o) { this.game.online?.send({ t: 'opt', optic: id }); this.game.hud.toast('Nişangâh: ' + o.label, '#cfe6ff'); }
    this.wheelPaint();
  }

  closeWheel() {
    if (!this.wheel) return;
    this.wheel.el.remove();
    this.wheel = null;
  }

  look(dx, dy) {
    const s = this.s;
    s.yaw -= dx;
    s.pitch = clamp(s.pitch - dy, -1.5, 1.5);
  }

  dispose() { this.closeWheel(); for (const [t, ev, fn, opt] of this._bound) t.removeEventListener(ev, fn, opt); this._bound = []; this.fx?.remove(); this.fxSmoke?.remove(); }

  update(dt) {
    const s = this.s, g = this.game;
    this.fireBuf = Math.max(0, this.fireBuf - dt);
    if (s.alive && this.locked && !g.opts.autoplay) {
      const kk = this.keys, sp = 1.9 * dt / Math.pow(Math.max(1, s.zoomNow && s.adsT > 0.5 ? s.zoomNow : 1), 0.7);
      if (kk.has('ArrowLeft')) s.yaw += sp;
      if (kk.has('ArrowRight')) s.yaw -= sp;
      if (kk.has('ArrowUp')) s.pitch = clamp(s.pitch + sp, -1.5, 1.5);
      if (kk.has('ArrowDown')) s.pitch = clamp(s.pitch - sp, -1.5, 1.5);
    }
    if (s.alive && !g.opts.autoplay) {
      const k = this.keys;
      const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
      const r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      const st = s.stat;
      const lean = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);                 // 3. şahısta da Q/E yatar (ve omuzu değiştirir)
      const inp = { f, r, lean, sprint: k.has('ShiftLeft'), jump: k.has('Space') && !this.spaceLatch };
      if (s.fly) this.flyMove(f, r, k, dt); else applyInput(s, inp, dt);
      if (g.online) g.online.pushInput(inp, s, this.fireHeld);
      if (!k.has('Space')) this.spaceLatch = false;

      // ateş
      if (this.locked) {
        if (st.kind === 'melee') { if (this.fireHeld || this.fireBuf > 0) { if (s.tryFire()) this.fireBuf = 0; } }
        else if (s.fireAuto) { if (this.fireHeld) s.tryFire(); }
        else if (this.fireBuf > 0 && s.tryFire()) this.fireBuf = 0;
      }
      // adım sesi
      const sp = Math.hypot(s.vel.x, s.vel.z);
      if (s.onGround && sp > 1.5 && !s.crouching && !s.prone) {
        s.stepT -= dt * (sp / 4.4);
        if (s.stepT <= 0) { s.stepT = 0.42; g.sfx.step(null); }
      }
    }

    // ── kamera ──
    const cam = g.camera;
    const baseFov = this.set.fov;
    const zoom = s.zoomNow && !this.vm.model?.userData.noAds ? lerp(1, s.zoomNow, s.adsT) : 1;
    const targetFov = baseFov / zoom;
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
