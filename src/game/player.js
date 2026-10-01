import * as THREE from 'three';
import { createWeapon } from '../models/weapons.js';
import { createItem } from '../models/items.js';
import { TEAMS } from '../core/palette.js';
import { WSTATS } from './stats.js';
import { box } from '../core/geo.js';
import { clamp, lerp, V3 } from './util.js';

const VM_SCALE = 0.92;

// ───────────── Birinci şahıs silah modeli ─────────────
class ViewModel {
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
    this.kick = 0; this.kickR = 0; this.bobT = 0; this.raise = 1; this.reloadMax = 1;
    this.pos = new THREE.Vector3(0.2, -0.21, -0.66);
    this.flash = null; this.flashT = 0;
  }

  setItem(id, team, kind, optic) {
    if (this.model) this.root.remove(this.model);
    this.id = id;
    this.raise = 1;
    const c = TEAMS[team];
    const g = new THREE.Group();
    if (kind === 'medkit') {
      const m = createItem('medkit'); m.scale.setScalar(1.5); m.position.set(0, -0.08, 0); g.add(m);
      g.userData = { gripR: new THREE.Vector3(0.02, -0.02, 0.0), gripL: null, muzzle: new THREE.Vector3(), sight: [0, 0, 0], dist: 0.3, noAds: true };
    } else {
      const w = createWeapon(id, optic);
      g.add(w);
      const st = WSTATS[id];
      g.userData = { ...w.userData, sight: w.userData.sight ?? st.sight, dist: w.userData.dist ?? st.dist };
      // muzzle flash
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.18), new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      f.position.copy(w.userData.muzzle).add(new THREE.Vector3(0, 0, -0.08));
      f.visible = false;
      w.add(f);
      this.flash = f;
    }
    // eller + kollar (silaha bağlı)
    const hand = (p, side) => {
      const gl = box(g, [0.1, 0.1, 0.12], c.gloves, [p.x, p.y, p.z]);
      const from = new THREE.Vector3(p.x, p.y, p.z);
      const dir = new THREE.Vector3(side * 0.12, -0.2, 0.42).normalize();
      const len = 0.5;
      const sleeve = box(g, [0.11, 0.11, len], c.shirt, [0, 0, 0]);
      sleeve.position.copy(from).addScaledVector(dir, len / 2 + 0.05);
      sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      return gl;
    };
    const u = g.userData;
    if (u.gripR) hand(u.gripR.clone().add(new THREE.Vector3(0.0, -0.02, 0.0)), 1);
    if (u.gripL) hand(u.gripL.clone().add(new THREE.Vector3(0, -0.03, 0)), -1);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.model = g;
    this.root.add(g);
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
    this.bobT += dt * (speed > 0.5 && s.onGround ? 1 : 0) * (s.sprinting ? 12 : 8);
    const bobAmt = (1 - ads * 0.85) * clamp(speed / 5, 0, 1) * (s.sprinting ? 1.6 : 1);
    this.kick = Math.max(0, this.kick - dt * 6 * (0.2 + this.kick * 10));
    this.kickR = Math.max(0, this.kickR - dt * 5);
    this.raise = Math.max(0, this.raise - dt * 3.2);

    const pos = new THREE.Vector3().lerpVectors(hip, tgt, ads);
    pos.x += Math.sin(this.bobT) * 0.012 * bobAmt;
    pos.y += Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmt - this.raise * 0.35;
    pos.z += this.kick * (0.9 - ads * 0.6);
    let rx = this.kickR * (0.4 - ads * 0.3), ry = -0.04 * (1 - ads), rz = 0;

    // sprint
    const sp = s.sprinting ? 1 : 0;
    this.sprintT = lerp(this.sprintT || 0, sp, Math.min(1, dt * 9));
    pos.x -= this.sprintT * 0.1; pos.y -= this.sprintT * 0.1; pos.z += this.sprintT * 0.05;
    rx -= this.sprintT * 0.55; ry += this.sprintT * 0.7;

    // yeniden doldurma / kullanım
    const tot = this.reloadMax;
    if (s.reloadT > 0 || s.useT > 0) {
      const left = s.reloadT > 0 ? s.reloadT : s.useT;
      const k = 1 - clamp(left / tot, 0, 1);
      const b = Math.sin(k * Math.PI);
      pos.y -= b * 0.18; pos.x -= b * 0.05;
      rx -= b * 0.7; rz += b * 0.5;
    }
    // sallanma (mouse)
    this.sx = lerp(this.sx || 0, -p.lookDX * 0.0006, Math.min(1, dt * 12));
    this.sy = lerp(this.sy || 0, p.lookDY * 0.0006, Math.min(1, dt * 12));
    ry += clamp(this.sx, -0.05, 0.05) * (1 - ads);
    rx += clamp(this.sy, -0.05, 0.05) * (1 - ads);

    this.root.position.copy(pos);
    this.root.rotation.set(rx, ry, rz);
    this.root.scale.setScalar(VM_SCALE);

    if (this.flash) {
      this.flashT = Math.max(0, this.flashT - dt);
      this.flash.visible = this.flashT > 0;
    }
    // dürbünlü silahta tam nişanda modeli gizle
    this.root.visible = !(s.overlay === 'scope' && s.adsT > 0.9);
    this.cam.rotation.z = -s.leanT * 0.2;   // yana eğilirken silah da kafayla birlikte yatar
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
    this.deathCamT = 0;
    this._bound = [];
    this.bind();
    this.refreshWeapon();
    game.on('switch', (s) => { if (s === this.s) this.refreshWeapon(); });
    game.on('spawn', (s) => { if (s === this.s) this.refreshWeapon(); });
    game.on('fire', (s) => { if (s === this.s) { this.vm.kick = Math.min(this.vm.kick + 0.045, 0.12); this.vm.kickR = Math.min(this.vm.kickR + 0.18, 0.5); this.vm.flashT = 0.045; } });
    game.on('bolt', (s) => { if (s === this.s) this.vm.kickR += 0.2; });
    game.on('melee', (s) => { if (s === this.s) { this.vm.kick = 0.1; this.vm.kickR = 0.6; } });
    game.on('reload', (s) => { if (s === this.s) this.vm.reloadMax = Math.max(0.5, s.reloadT || s.useT || 1); });
  }

  refreshWeapon() {
    const s = this.s;
    this.vm.setItem(s.item.id, s.team, s.stat.kind, s.optic);
  }

  on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); this._bound.push([target, ev, fn, opt]); }

  bind() {
    const cv = this.game.canvas;
    this.on(window, 'keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const s = this.s;
      if (!this.game.running) return;
      if (e.code === 'KeyR') s.startReload();
      if (s.alive && (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight')) s.toggleCrouch();
      if (s.alive && e.code === 'KeyZ') s.toggleProne();
      if (s.alive && e.code === 'KeyB') { const o = s.cycleOptic(); if (o) this.game.hud.toast('Nişangâh: ' + o.label, '#cfe6ff'); }
      if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 4) s.switchTo(n); }
      if (e.code === 'KeyV') s.switchTo(3);
      if (e.code === 'KeyG') s.switchTo(2);
      if (e.code === 'Tab') { e.preventDefault(); this.game.hud.showScoreboard(true); }
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'Space' && s.alive && (s.prone || s.crouching)) { s.standUp(); this.spaceLatch = true; }   // yatarken/çömelirken Boşluk = kalk
      if (e.code === 'Escape' && this.game.noPointerLock) this.game.togglePause();
      if (!s.alive && this.game.respawnReady() && e.code.startsWith('Digit')) {
        const keys = Object.keys(this.game.classDefs);
        const n = +e.code.slice(5) - 1;
        if (keys[n]) this.game.requestClass(keys[n]);
      }
    });
    this.on(window, 'keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.spaceLatch = false;
      if (e.code === 'Tab') this.game.hud.showScoreboard(false);
    });
    this.on(document, 'mousemove', (e) => {
      if (!this.locked) return;
      const k = this.set.sens * (this.s.zoomNow && this.s.adsT > 0.5 ? 1 / Math.pow(this.s.zoomNow, 0.8) : 1);
      this.look(e.movementX * k, e.movementY * k);
      this.lookDX += e.movementX; this.lookDY += e.movementY;
    });
    this.on(cv, 'mousedown', (e) => {
      if (!this.locked) { this.game.requestLock(); return; }
      if (e.button === 0) { this.fireHeld = true; this.fireBuf = 0.15; }
      if (e.button === 2) this.s.ads = true;
    });
    this.on(window, 'mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.s.ads = false;
    });
    this.on(cv, 'contextmenu', (e) => e.preventDefault());
    this.on(window, 'wheel', (e) => {
      if (!this.locked || !this.s.alive) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.s.switchTo((this.s.cur + dir + 4) % 4);
    }, { passive: true });
  }

  look(dx, dy) {
    const s = this.s;
    s.yaw -= dx;
    s.pitch = clamp(s.pitch - dy, -1.5, 1.5);
  }

  dispose() { for (const [t, ev, fn, opt] of this._bound) t.removeEventListener(ev, fn, opt); this._bound = []; }

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
      const lean = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
      s.leanDir = lean;
      const wantSprint = k.has('ShiftLeft') && f > 0 && !s.ads && s.onGround && !s.prone && lean === 0;
      s.sprinting = wantSprint && s.reloadT <= 0;
      if (s.sprinting) { s.crouching = false; if (s.prone) s.prone = false; }
      let spd = 4.4 * s.def.speed * (st.move || 1);
      if (s.sprinting) spd *= 1.5;
      if (s.crouching) spd *= 0.52;
      if (s.prone) spd *= 0.27;
      if (s.adsT > 0.1) spd *= 1 - 0.4 * s.adsT;
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
      let wx = fx * f + rx * r, wz = fz * f + rz * r;
      const wl = Math.hypot(wx, wz);
      if (wl > 0) { wx = (wx / wl) * spd; wz = (wz / wl) * spd; }
      const acc = s.onGround ? 14 : 2.2;
      const a = 1 - Math.exp(-acc * dt);
      s.vel.x += (wx - s.vel.x) * a;
      s.vel.z += (wz - s.vel.z) * a;
      if (k.has('Space') && s.onGround && !s.prone && !s.crouching && !this.spaceLatch) { s.vel.y = 5.4; s.onGround = false; }
      if (!k.has('Space')) this.spaceLatch = false;

      // ateş
      if (this.locked) {
        if (st.auto) { if (this.fireHeld) s.tryFire(); }
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
    if (s.alive) {
      this.deathCamT = 0;
      s.eye(cam.position);
      cam.rotation.order = 'YXZ';
      cam.rotation.set(
        s.pitch + s.recoilP + (Math.random() - 0.5) * sh * 0.06,
        s.yaw + (Math.random() - 0.5) * sh * 0.06,
        -s.leanT * 0.2,
      );
      this.camPos.copy(cam.position);
    } else {
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
    this.vm.update(dt, this);
    this.lookDX *= 0.5; this.lookDY *= 0.5;
  }
}
