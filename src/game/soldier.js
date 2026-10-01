import * as THREE from 'three';
import { createCharacter } from '../models/character.js';
import { WSTATS, CLASS_DEFS, OPTICS, OPTIC_ORDER, OPTIC_ALLOWED, resolveOptic, makeLoadout, TAC_RELOAD, BACKSTAB_DMG } from './stats.js';
import { SWING_HIT_K } from './anim.js';
import { H_STAND, H_CROUCH, H_PRONE } from './collision.js';
import { dirFromAngles, clamp, rand, lerp } from './util.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _o = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const EYE_STAND = 1.62;
export const EYE_CROUCH = 1.16;
export const EYE_PRONE = 0.42;

export { makeLoadout };
// Eski ad: seçim yoksa sınıf varsayılanı
export function buildLoadout(cls, team, choice = {}) { return makeLoadout(cls, team, choice); }

export class Soldier {
  constructor(game, { id, name, team, cls, isPlayer = false }) {
    this.game = game;
    this.id = id; this.name = name; this.team = team; this.cls = cls;
    this.isPlayer = isPlayer;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.height = H_STAND;
    this.onGround = true;
    this.crouching = false; this.crouchT = 0;
    this.prone = false; this.proneT = 0;
    this.leanDir = 0; this.leanT = 0; this.leanOff = new THREE.Vector3();
    this.optic = isPlayer ? (game.opts?.optic || 'reddot') : OPTIC_ORDER[Math.floor(Math.random() * OPTIC_ORDER.length)];
    this.sprinting = false; this.ads = false; this.adsT = 0;
    this.eyeY = EYE_STAND;
    this.alive = false;
    this.kills = 0; this.deaths = 0; this.score = 0;
    this.respawnT = 0; this.protT = 0;
    this.recoilP = 0; this.bloom = 0; this.sinceShot = 9;
    this.cd = 0; this.reloadT = 0; this.switchT = 0; this.useT = 0;
    this.reloadTotal = 1; this.reloadStyle = 'mag'; this.reloadEmpty = true; this.shellT = 0;
    this.swing = null; this.comboN = -1; this.comboT = 0; this.autoSwitchT = 0;
    this.blindT = 0; this.blindMax = 1;
    this.choice = isPlayer ? (game.opts?.loadout || {}) : { random: true };
    this.lastHit = null; this.lastDmgT = -99;
    this.walkPhase = 0; this.deadT = 0; this.deadDir = 1; this.flashT = 0;
    this.stepT = 0;
    this.botExtraSpread = 0;
    this.dmgMul = 1;
    this.model = null;
    this.setClass(cls);
  }

  get item() { return this.items[this.cur]; }
  get stat() { return WSTATS[this.item.id]; }
  get opticId() { return resolveOptic(this.item.id, this.optic); }
  get opticDef() { const o = this.opticId; return o ? OPTICS[o] : null; }
  get zoomNow() { const st = this.stat; if (!st.zoom) return 0; return this.opticDef ? this.opticDef.zoom : st.zoom; }
  get overlay() { return this.opticDef ? this.opticDef.overlay : 'none'; }

  setClass(cls) {
    this.cls = cls;
    const def = CLASS_DEFS[cls];
    this.def = def;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.items = makeLoadout(cls, this.team, this.choice);
    this.cur = 0;
    // görünüm: sınıf teçhizatı değişir → modeli yeniden kur
    if (this.model) this.game.scene.remove(this.model.root);
    this.model = createCharacter({ team: this.team, cls, skinIndex: this.id, weapon: this.items[0].id, optic: this.optic });
    this.model.root.visible = this.alive;
    this.game.scene.add(this.model.root);
    this._modelWeapon = this.items[0].id;
  }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x + this.leanOff.x, this.pos.y + this.eyeY + this.leanOff.y, this.pos.z + this.leanOff.z); }
  aimDir(out = new THREE.Vector3()) { return dirFromAngles(this.yaw, this.pitch + this.recoilP, out); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  center(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z); }

  spawn(point, protect = 2.5) {
    this.pos.set(point.x, 0, point.z);
    this.vel.set(0, 0, 0);
    this.yaw = point.ry; this.pitch = 0; this.recoilP = 0;
    this.alive = true; this.deadT = 0;
    this.hp = this.maxHp;
    this.items = makeLoadout(this.cls, this.team, this.choice);
    this.cur = 0;
    this.cd = 0; this.reloadT = 0; this.switchT = 0; this.useT = 0; this.swing = null; this.comboT = 0; this.autoSwitchT = 0; this.blindT = 0;
    this.protT = protect;
    this.crouching = false; this.prone = false; this.proneT = 0; this.crouchT = 0; this.leanDir = 0; this.leanT = 0; this.leanOff.set(0, 0, 0);
    this.height = H_STAND; this.ads = false; this.adsT = 0;
    this.model.root.visible = !this.isPlayer;
    this.model.root.rotation.x = 0;
    this._syncWeaponModel(true);
    this.game.emit('spawn', this);
  }

  _syncWeaponModel(force = false) {
    if (this.isPlayer) return;
    const id = this.stat.kind === 'medkit' ? null : this.item.id;
    if (!force && id === this._modelWeapon) return;
    this._modelWeapon = id;
    this.model.setWeapon(id, this.optic);
  }

  switchTo(i) {
    if (i === this.cur || !this.items[i] || !this.alive) return;
    const eq = Math.min(0.35, WSTATS[this.items[i].id].equip ?? 0.3);
    this.cur = i; this.switchT = eq; this.reloadT = 0; this.useT = 0; this.swing = null; this.autoSwitchT = 0;
    this._syncWeaponModel();
    this.game.emit('switch', this);
  }

  // R: hemen başlar (sprint iptal etmez). Şarjörde mermi varsa "taktik reload" daha hızlıdır.
  startReload() {
    const it = this.item, st = this.stat;
    if (this.reloadT > 0 || this.swing || this.useT > 0 || !(st.kind === 'gun' || st.kind === 'launcher') || it.mag >= st.mag || it.reserve <= 0) return false;
    const style = st.reloadStyle || 'mag';
    this.reloadStyle = style;
    this.reloadEmpty = it.mag <= 0;
    this.ads = false;
    if (style === 'shell') {
      const n = Math.min(st.mag - it.mag, it.reserve);
      this.shellT = st.shell * 0.8;                                       // ilk mermi biraz erken girer
      this.reloadT = this.reloadTotal = this.shellT + (n - 1) * st.shell;
    } else {
      this.reloadT = this.reloadTotal = st.reload * (it.mag > 0 ? TAC_RELOAD : 1);
    }
    this.game.sfx.reload(this.pos, style, this.reloadTotal, this.reloadEmpty);
    this.game.emit('reload', this);
    return true;
  }

  // pompalı/çift namlu doldururken ateşle iptal et
  cancelShellReload() {
    if (this.reloadT > 0 && this.reloadStyle === 'shell' && this.item.mag > 0) { this.reloadT = 0; return true; }
    return false;
  }

  // yarı otomatik / otomatik geçişi (yalnızca otomatik silahlarda)
  toggleFireMode() {
    const it = this.item, st = this.stat;
    if (st.kind !== 'gun' || !st.auto) return null;
    it.semi = !it.semi;
    this.game.emit('firemode', this);
    return it.semi ? 'semi' : 'auto';
  }
  get fireAuto() { return !!this.stat.auto && !this.item.semi; }

  spreadNow(st) {
    const hipv = st.hip ?? 0.01, adsv = st.ads ?? 0.002;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    let s = lerp(hipv, adsv, this.adsT);
    s += Math.min(speed * 0.0007, 0.0045) * (1 - this.adsT * 0.65);   // hareket cezası
    if (!this.onGround) s += 0.012;
    if (this.blindT > 0.5) s += 0.04;
    if (this.crouching) s *= 0.7;
    s += this.bloom;                                                   // seri atışta açılma
    // duran oyuncunun ilk atışı (kısa bir aradan sonra) isabetli olsun
    if (this.sinceShot > 0.3 && speed < 1.5 && this.onGround) s *= 0.2;
    return s + this.botExtraSpread;
  }

  tryFire() {
    if (!this.alive || this.cd > 0 || this.switchT > 0 || this.useT > 0) return false;
    if (this.reloadT > 0 && !this.cancelShellReload()) return false;
    const it = this.item, st = this.stat;
    if (st.kind === 'melee') return this._melee(st);
    if (st.kind === 'medkit') return this._medkit(it, st);
    if (it.mag <= 0) {
      if (!this.startReload()) { this.cd = 0.3; this.game.sfx.dry(this.pos); if (this.isPlayer) this.game.emit('dry', this); }
      return false;
    }
    this.cd = 60 / st.rpm;
    it.mag--;
    if (st.kind === 'throwable') { this.sprinting = false; return this._throw(st); }
    if (st.kind === 'mine' || st.kind === 'ammobox') { this.sprinting = false; return this._place(st, it); }
    this.sprinting = false;
    if (st.kind === 'launcher') return this._rocket(st);
    this._shoot(st);
    if (it.mag <= 0 && it.reserve > 0 && !this.isPlayer) this.startReload();
    return true;
  }

  muzzleWorld(out) {
    if (this.isPlayer) {
      const d = this.aimDir(_d), r = this.right(_v);
      return out.copy(this.eye(_o)).addScaledVector(r, 0.16).addScaledVector(UP, -0.1).addScaledVector(d, 0.8);
    }
    const w = this.model.weapon;
    if (w) { w.updateWorldMatrix(true, false); return out.copy(w.userData.muzzle).applyMatrix4(w.matrixWorld); }
    return this.eye(out);
  }

  _shoot(st) {
    const g = this.game;
    const origin = this.eye(_o);
    const base = this.aimDir(new THREE.Vector3());
    const spread = this.spreadNow(st);
    const pellets = st.pellets || 1;
    const muzzle = this.muzzleWorld(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(base, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, base).normalize();
    for (let i = 0; i < pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const d = base.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      g.shootRay(this, origin, d, st, muzzle);
    }
    g.effects.muzzle(muzzle, base);
    g.sfx.shot(st.sound, this.pos);
    this.flashT = 0.06;
    this.sinceShot = 0;
    this.bloom = Math.min(this.bloom + (st.kickV || 0.01) * 0.07, 0.005);
    if (this.isPlayer) {
      const k = (st.kickV || 0.01) * (this.adsT > 0.5 ? 0.7 : 1);
      this.pitch = Math.min(1.45, this.pitch + k * 0.55);   // kalıcı tırmanma: oyuncu aşağı çekerek telafi eder
      this.recoilP += k * 0.45;
      this.yaw += rand(-1, 1) * (st.kickH || 0.004);
      this.game.emit('fire', this);
    } else if (this.model.weapon) this.game.noiseAlert?.(this);
    if (st.bolt) this.game.emit('bolt', this);
    this.game.alertNear?.(this.pos, this.team, st.sound === 'pistol' ? 25 : 45);
  }

  _rocket(st) {
    const d = this.aimDir(new THREE.Vector3());
    const m = this.muzzleWorld(new THREE.Vector3());
    if (st.impact) this.game.spawnShell(this, m, d, st); else this.game.spawnRocket(this, m, d, st);
    this.game.sfx.shot(st.sound, this.pos);
    this.game.alertNear?.(this.pos, this.team, 40);
    if (this.isPlayer) { this.recoilP += st.kickV; this.game.emit('fire', this); }
    this.flashT = 0.1;
    return true;
  }

  _throw(st) {
    const d = this.aimDir(new THREE.Vector3());
    const p = this.eye(new THREE.Vector3()).addScaledVector(d, 0.5);
    const v = d.clone().multiplyScalar(st.speed);
    v.y += 3.2;
    v.x += this.vel.x * 0.5; v.z += this.vel.z * 0.5;
    this.game.spawnGrenade(this, p, v, st);
    this.game.sfx.shot('throw', this.pos);
    if (this.isPlayer) this.game.emit('throw', this);
    if (this.item.mag <= 0) this.autoSwitchT = 0.35;     // bitti: birincil silaha dön
    return true;
  }

  // Claymore / cephane kutusu: ayağının önüne kurulur
  _place(st, it) {
    const ok = this.game.placeDeployable?.(this, st);
    if (!ok) { it.mag++; this.cd = 0.3; return false; }
    this.game.sfx.deploy(this.pos);
    if (this.isPlayer) this.game.emit('throw', this);
    if (it.mag <= 0) this.autoSwitchT = 0.4;
    return true;
  }

  // Yakın dövüş: savurma başlar; vuruş animasyonun orta anında (gecikmeli) uygulanır. Kombo: sağ→sol, sol→sağ, saplama
  _melee(st) {
    const idx = this.comboT > 0 ? (this.comboN + 1) % 3 : 0;
    this.comboN = idx;
    const kind = st.swings[idx];
    const dur = kind === 'stab' ? st.stabT : st.swingT;
    this.swing = { t: 0, dur, kind, idx, done: false };
    this.comboT = dur + 0.38;
    this.cd = dur * 0.8;                                   // %80'de yeni savurma zincirlenebilir (hızlı çekme)
    this.sprinting = false;
    this.game.sfx.shot('knife', this.pos);
    this.game.emit('melee', this);
    this.flashT = 0;
    return true;
  }

  // Savurmanın vuruş anı
  _meleeStrike(sw) {
    const st = this.stat, g = this.game;
    if (st.kind !== 'melee') return;
    const o = this.eye(new THREE.Vector3()), d = this.aimDir(new THREE.Vector3());
    const hit = g.meleeHit(this, o, d, st.reach);
    g.effects.slash(o, d, sw.kind, st.reach, this.team);
    if (hit && hit.victim) {
      const v = hit.victim;
      const back = this.isBehind(v);
      const mul = sw.kind === 'stab' ? st.stabMul : 1;
      g.effects.blood(hit.point, back ? 14 : 8, d.clone().negate());
      g.sfx.knifeHit(hit.point, back);
      v.takeDamage((back ? BACKSTAB_DMG : st.dmg * mul) * this.dmgMul, this, 'body', this.pos, back ? st.name + ' · arkadan' : st.name);
      if (this.isPlayer) { g.effects.shake = Math.max(g.effects.shake, back ? 0.9 : 0.55); g.emit('meleehit', { flesh: true, back }); }
    } else if (hit && hit.wall) {
      g.effects.spark(hit.point, 7, hit.normal, '#ffe9a0', 5);
      g.effects.decal(hit.point, hit.normal);
      g.sfx.knifeWall(hit.point);
      if (this.isPlayer) { g.effects.shake = Math.max(g.effects.shake, 0.3); g.emit('meleehit', { flesh: false }); }
    }
    if (!this.isPlayer) g.alertNear?.(this.pos, this.team, 14);
  }

  // saldıran, kurbanın arkasında mı? (kurbanın baktığı yön ile saldırana olan yön)
  isBehind(v) {
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    let dx = v.pos.x - this.pos.x, dz = v.pos.z - this.pos.z;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    return fx * dx + fz * dz > 0.55;
  }

  _medkit(it, st) {
    if (it.mag <= 0) return false;
    // yakında canlandırılabilir bir dost cesedi varsa: canlandırma (3 sn)
    const body = this.game.findRevivable(this);
    if (body) {
      this.useT = 2.8; this.useItem = null; this.reviveTarget = body; this.cd = 3.0;
      this.game.sfx.reload(this.pos);
      this.game.emit('reload', this);
      return true;
    }
    if (this.hp >= this.maxHp) return false;
    this.useT = st.useTime; this.useItem = it; this.cd = st.useTime + 0.2;
    this.game.sfx.reload(this.pos);
    this.game.emit('reload', this);
    return true;
  }

  // Botlar: seçili silahı değiştirmeden gadget kullan
  useGadget(id) {
    const it = this.items[2];
    if (!it || it.id !== id || it.mag <= 0 || this.cd > 0 || this.reloadT > 0 || this.useT > 0 || this.switchT > 0) return false;
    const prev = this.cur;
    this.cur = 2;
    const ok = this.tryFire();
    this.cur = prev;
    this.autoSwitchT = 0;
    if (ok && WSTATS[id].kind === 'launcher' && it.mag <= 0 && it.reserve > 0) { it.mag = 1; it.reserve--; this.cd = WSTATS[id].reload + 0.7; }
    return ok;
  }

  // ── duruş değiştirme (ayakta ↔ çömel ↔ yat); yer yoksa reddedilir ──
  toggleCrouch() {
    const w = this.game.world;
    if (this.prone) { if (w.canStand(this, H_CROUCH)) { this.prone = false; this.crouching = true; } }
    else if (this.crouching) { if (w.canStand(this, H_STAND)) this.crouching = false; }
    else this.crouching = true;
  }
  toggleProne() {
    const w = this.game.world;
    if (!this.prone) { this.prone = true; this.crouching = false; this.sprinting = false; }
    else if (w.canStand(this, H_STAND)) this.prone = false;
    else if (w.canStand(this, H_CROUCH)) { this.prone = false; this.crouching = true; }
  }
  standUp() {
    const w = this.game.world;
    if (this.prone) {
      if (w.canStand(this, H_STAND)) { this.prone = false; return true; }
      if (w.canStand(this, H_CROUCH)) { this.prone = false; this.crouching = true; return true; }
      return false;
    }
    if (this.crouching && w.canStand(this, H_STAND)) { this.crouching = false; return true; }
    return !this.crouching;
  }
  // Nişangâh değiştir (B): silaha uygun olanlar arasında döner
  cycleOptic() {
    const allowed = OPTIC_ALLOWED[this.item.id] || [];
    const list = OPTIC_ORDER.filter((o) => allowed.includes(o));
    if (list.length < 2) return null;
    this.optic = list[(list.indexOf(this.opticId) + 1) % list.length];
    this.model.optic = this.optic;
    this._syncWeaponModel(true);
    this.game.emit('switch', this);
    return OPTICS[this.optic];
  }

  takeDamage(amount, attacker, zone, fromPos, weaponName) {
    if (!this.alive || this.protT > 0) return;
    this.hp -= amount;
    this.lastHit = attacker;
    this.lastDmgT = this.game.time;
    this.useT = 0;
    if (this.isPlayer) {
      this.game.hud.damageFrom(fromPos, this);
      this.game.sfx.hurt();
    } else if (this.brain) this.brain.onDamaged(attacker, fromPos);
    if (attacker && attacker !== this && attacker.isPlayer) this.game.emit('hitmark', { victim: this, zone, dead: this.hp <= 0, dmg: amount });
    if (this.hp <= 0) this.die(attacker, weaponName, zone === 'head');
  }

  // Flaşbang: kör/sağır
  blind(t) {
    if (!this.alive || t <= 0) return;
    this.blindT = Math.max(this.blindT, t); this.blindMax = Math.max(this.blindT, 0.5);
    if (this.brain) this.brain.onFlashed?.(t);
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  die(killer, weaponName, headshot) {
    if (!this.alive) return;
    this.alive = false; this.hp = 0;
    this.deaths++;
    this.deadT = 0; this.deadDir = Math.random() > 0.5 ? 1 : -1;
    this.ads = false; this.reloadT = 0; this.useT = 0; this.swing = null; this.autoSwitchT = 0;
    this.vel.set(0, 0, 0);
    this.revivable = !/RPG|Bomba|Claymore|M79|üssü/i.test(weaponName || '');
    if (killer && killer !== this) { killer.kills++; killer.score += headshot ? 150 : 100; }
    this.game.onKill(killer, this, weaponName, headshot);
  }

  // Her kare: zamanlayıcılar
  update(dt) {
    if (!this.alive) { this.deadT += dt; return; }
    this.cd = Math.max(0, this.cd - dt);
    this.switchT = Math.max(0, this.switchT - dt);
    this.protT = Math.max(0, this.protT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.blindT = Math.max(0, this.blindT - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.autoSwitchT > 0 && (this.autoSwitchT -= dt) <= 0 && this.alive && this.cur !== 0 && this.item.mag <= 0 && this.items[0]) this.switchTo(0);
    if (this.swing) {
      const sw = this.swing;
      sw.t += dt;
      if (!sw.done && sw.t >= sw.dur * SWING_HIT_K) { sw.done = true; this._meleeStrike(sw); }
      if (sw.t >= sw.dur) this.swing = null;
    }
    this.sinceShot += dt;
    this.bloom = Math.max(0, this.bloom - dt * 0.05);
    this.recoilP = Math.max(0, this.recoilP - dt * (0.06 + this.recoilP * 4.5));
    if (this.reloadT > 0) {
      const it = this.item, st = this.stat;
      if (this.reloadStyle === 'shell') {
        // mermi mermi: her mermi girdiğinde ses; dolunca biter
        this.shellT -= dt;
        while (this.shellT <= 0 && it.mag < st.mag && it.reserve > 0) {
          it.mag++; it.reserve--; this.shellT += st.shell;
          this.game.sfx.shell(this.pos);
        }
        const left = Math.min(st.mag - it.mag, it.reserve);
        if (left <= 0) { this.reloadT = 0; this.game.emit('reloaded', this); }
        else this.reloadT = Math.max(0.001, this.shellT + (left - 1) * st.shell);
      } else {
        this.reloadT -= dt;
        if (this.reloadT <= 0) {
          const need = st.mag - it.mag, take = Math.min(need, it.reserve);
          it.mag += take; it.reserve -= take;
          this.game.emit('reloaded', this);
        }
      }
    }
    if (this.useT > 0) {
      this.useT -= dt;
      if (this.useT <= 0) {
        const it = this.useItem;
        if (this.reviveTarget) {
          const bt = this.reviveTarget; this.reviveTarget = null;
          const mk = this.items[2];
          if (this.game.canRevive(bt, this)) { if (mk && mk.id === 'medkit' && mk.mag > 0) mk.mag--; this.game.revive(bt, this); }
        } else if (it && it.mag > 0) { it.mag--; this.heal(WSTATS.medkit.heal); if (it.mag <= 0 && this.cur === 2) this.switchTo(0); }
      }
    }
    // hedef nişan geçişi
    const wantAds = this.ads && this.reloadT <= 0 && this.switchT <= 0 && this.zoomNow && !this.sprinting;
    this.adsT = clamp(this.adsT + (wantAds ? 1 : -1) * dt * (this.overlay === 'scope' ? 6 : 9), 0, 1);
    if (this.prone) this.crouching = false;
    this.height = this.prone ? H_PRONE : this.crouching ? H_CROUCH : H_STAND;
    this.crouchT = clamp(this.crouchT + (this.crouching ? 1 : -1) * dt * 7, 0, 1);
    this.proneT = clamp(this.proneT + (this.prone ? 1 : -1) * dt * 4.5, 0, 1);
    this.eyeY = lerp(lerp(EYE_STAND, EYE_CROUCH, this.crouchT), EYE_PRONE, this.proneT);
    // yana eğilme (Q/E): kafa yana kayar, duvara girmesin diye ışınla sınırlanır
    const canLean = this.onGround && !this.sprinting && this.proneT < 0.3;
    this.leanT = lerp(this.leanT, canLean ? this.leanDir : 0, Math.min(1, dt * 10));
    if (Math.abs(this.leanT) > 0.01) {
      const sg = Math.sign(this.leanT);
      const r = this.right(_v);
      const from = _o.set(this.pos.x, this.pos.y + this.eyeY, this.pos.z);
      const hit = this.game.world.raycast(from, r.multiplyScalar(sg), 0.55, (this._lr ||= {}));
      const room = hit ? Math.max(0, hit.t - 0.17) : 0.55;
      const off = Math.min(Math.abs(this.leanT) * 0.36, room);
      const rr = this.right(_v);
      this.leanOff.set(rr.x * sg * off, -Math.abs(this.leanT) * 0.07, rr.z * sg * off);
    } else this.leanOff.set(0, 0, 0);
  }

  // Üçüncü şahıs model senkronu (oyuncu hariç): hıza bağlı adım döngüsü, gövde eğimi, kol sallanması
  syncModel(dt) {
    const m = this.model, root = m.root, p = m.parts;
    if (this.isPlayer) { root.visible = false; return; }
    root.visible = this.alive || this.deadT < 5;
    root.position.set(this.pos.x, this.pos.y + (m.groundOffset ?? m.root.position.y), this.pos.z);
    root.rotation.y = this.yaw;
    if (!this.alive) {
      const k = Math.min(1, this.deadT * 3.2);
      root.rotation.x = this.deadDir * k * (Math.PI / 2) * 0.96;
      root.position.y += k * 0.14;
      return;
    }
    const pr = this.proneT;
    root.rotation.x = -(Math.PI / 2) * pr;
    if (pr > 0.001) {
      const fx0 = -Math.sin(this.yaw), fz0 = -Math.cos(this.yaw);
      root.position.x -= fx0 * 0.82 * pr; root.position.z -= fz0 * 0.82 * pr; root.position.y += 0.17 * pr;
    }
    const T = this.game.time;
    const vx = this.vel.x, vz = this.vel.z, spd = Math.hypot(vx, vz);
    const fwdV = vx * -Math.sin(this.yaw) + vz * -Math.cos(this.yaw);
    const sideV = vx * Math.cos(this.yaw) + vz * -Math.sin(this.yaw);
    const c = this.crouchT;
    this.airT = lerp(this.airT || 0, this.onGround ? 0 : 1, Math.min(1, dt * 10));
    this.sprintT = lerp(this.sprintT || 0, this.sprinting && fwdV > 2 ? 1 : 0, Math.min(1, dt * 8));
    const moveAmt = clamp(spd / 1.3, 0, 1) * (1 - this.airT);
    const run = clamp((spd - 3.4) / 3.0, 0, 1);
    const sideBlend = spd > 0.3 ? Math.abs(sideV) / (Math.abs(fwdV) + Math.abs(sideV) + 1e-4) : 0;
    const dir = fwdV < -0.4 && Math.abs(fwdV) > Math.abs(sideV) ? -1 : 1;
    const stride = lerp(1.55, 2.3, run) * (1 - 0.15 * c);                 // bir tam adım döngüsü (m)
    this.walkPhase += dir * (spd / stride) * Math.PI * 2 * dt * (this.onGround ? 1 : 0.2);
    const ph = this.walkPhase;
    const amp = lerp(0.46, 0.86, run) * (1 - 0.5 * c) * (1 - 0.55 * sideBlend) * (dir < 0 ? 0.75 : 1);
    const flexMax = lerp(0.55, 1.4, run) * (1 - 0.4 * c);
    const sideSign = Math.sign(sideV) || 0;

    const legs = [[p.legs.L, ph, 0.22, -0.18, 0.9, -1.6, 0.65, -1.0], [p.legs.R, ph + Math.PI, -0.2, 0.22, 0.7, -1.5, -0.15, -0.5]];
    for (const [lg, phi, idleHip, idleKnee, crHip, crKnee, airHip, airKnee] of legs) {
      const sw = Math.sin(phi) * amp;
      const flex = Math.max(0, Math.cos(phi)) * flexMax;
      let hip = lerp(idleHip, 0.05 + sw, moveAmt);
      let knee = lerp(idleKnee, -(0.14 + flex), moveAmt);
      hip = lerp(hip, crHip + sw * 0.6 * moveAmt, c);
      knee = lerp(knee, crKnee - flex * 0.4 * moveAmt, c);
      hip = lerp(hip, airHip, this.airT);
      knee = lerp(knee, airKnee, this.airT);
      const crawlAmt = clamp(spd / 0.8, 0, 1);
      hip = lerp(hip, Math.sin(phi) * 0.2 * crawlAmt, pr);
      knee = lerp(knee, -Math.max(0, Math.cos(phi)) * 0.35 * crawlAmt, pr);
      lg.hip.rotation.x = hip;
      lg.knee.rotation.x = knee;
      lg.hip.rotation.z = sideSign * 0.3 * Math.sin(phi) * sideBlend * moveAmt;   // yan adımda bacak açılması
      lg.hip.position.y = 0.88 - 0.27 * c;
    }

    // gövde: öne eğim, hafif burulma, ağırlık aktarımı, nefes
    const breathe = Math.sin(T * 1.7 + this.id) * 0.004 * (1 - moveAmt);
    const lean = -(0.03 * moveAmt + 0.17 * run * moveAmt) - 0.09 * c;
    const aimP = clamp(this.pitch + this.recoilP, -0.9, 0.9) * 0.7;
    p.torso.rotation.x = (aimP + lean) * (1 - pr);
    p.torso.rotation.z = Math.sin(ph) * 0.035 * moveAmt * (1 + run) * (1 - pr) - this.leanT * 0.32;
    p.torso.position.x = this.leanT * 0.12;
    p.torso.position.y = 1.17 - 0.27 * c + breathe;
    p.head.rotation.x = (-lean * 0.7 - aimP * 0.25) * (1 - pr);
    p.head.rotation.z = this.leanT * 0.18;
    root.position.y -= (0.018 + 0.035 * run) * moveAmt * Math.sin(ph) ** 2;    // adım sırasında hafif çökme
    const twist = Math.sin(ph) * (0.05 + 0.08 * run) * moveAmt;
    const swing = Math.sin(ph + Math.PI) * moveAmt * (0.5 + 0.5 * run);
    let reload = null, melee = null;
    if (this.reloadT > 0 && this.stat.kind !== 'medkit') {
      const st = this.stat, shell = this.reloadStyle === 'shell';
      const el = this.reloadTotal - this.reloadT;
      reload = { style: this.reloadStyle, k: clamp(el / this.reloadTotal, 0, 1), empty: this.reloadEmpty, ph: shell ? ((el / st.shell) % 1 + 1) % 1 : 0 };
    }
    if (this.swing) melee = { kind: this.swing.kind, k: clamp(this.swing.t / this.swing.dur, 0, 1) };
    m.refreshHold({ sprint: this.sprintT * (1 - pr), kick: clamp(this.flashT / 0.06, 0, 1), twist: twist * (1 - pr), swing, prone: pr, aimP: clamp(this.pitch + this.recoilP, -0.8, 0.8), reload, melee });
  }
}
