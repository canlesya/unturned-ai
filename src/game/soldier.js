import * as THREE from 'three';
import { createCharacter } from '../models/character.js';
import { WSTATS, CLASS_DEFS } from './stats.js';
import { H_STAND, H_CROUCH } from './collision.js';
import { dirFromAngles, clamp, rand, lerp } from './util.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _o = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const EYE_STAND = 1.62;
export const EYE_CROUCH = 1.16;

function gunItem(id) { const s = WSTATS[id]; return { id, mag: s.mag, reserve: s.reserve }; }

export function buildLoadout(cls, team) {
  const def = CLASS_DEFS[cls];
  const [gid, gcount] = def.gadget;
  const gadget = gid === 'rpg' ? { id: 'rpg', mag: 1, reserve: gcount - 1 } : { id: gid, mag: gcount, reserve: 0 };
  return [gunItem(def.primary[team]), gunItem('pistol'), gadget, { id: 'knife', mag: 1, reserve: 0 }];
}

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
    this.sprinting = false; this.ads = false; this.adsT = 0;
    this.eyeY = EYE_STAND;
    this.alive = false;
    this.kills = 0; this.deaths = 0; this.score = 0;
    this.respawnT = 0; this.protT = 0;
    this.recoilP = 0; this.bloom = 0;
    this.cd = 0; this.reloadT = 0; this.switchT = 0; this.useT = 0;
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

  setClass(cls) {
    this.cls = cls;
    const def = CLASS_DEFS[cls];
    this.def = def;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.items = buildLoadout(cls, this.team);
    this.cur = 0;
    // görünüm: sınıf teçhizatı değişir → modeli yeniden kur
    if (this.model) this.game.scene.remove(this.model.root);
    this.model = createCharacter({ team: this.team, cls, skinIndex: this.id, weapon: this.items[0].id });
    this.model.root.visible = this.alive;
    this.game.scene.add(this.model.root);
    this._modelWeapon = this.items[0].id;
  }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeY, this.pos.z); }
  aimDir(out = new THREE.Vector3()) { return dirFromAngles(this.yaw, this.pitch + this.recoilP, out); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  center(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z); }

  spawn(point, protect = 2.5) {
    this.pos.set(point.x, 0, point.z);
    this.vel.set(0, 0, 0);
    this.yaw = point.ry; this.pitch = 0; this.recoilP = 0;
    this.alive = true; this.deadT = 0;
    this.hp = this.maxHp;
    this.items = buildLoadout(this.cls, this.team);
    this.cur = 0;
    this.cd = 0; this.reloadT = 0; this.switchT = 0; this.useT = 0;
    this.protT = protect;
    this.crouching = false; this.height = H_STAND; this.ads = false; this.adsT = 0;
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
    this.model.setWeapon(id);
  }

  switchTo(i) {
    if (i === this.cur || !this.items[i] || !this.alive) return;
    this.cur = i; this.switchT = 0.4; this.reloadT = 0; this.useT = 0; this.cd = Math.max(this.cd, 0.25);
    this._syncWeaponModel();
    this.game.emit('switch', this);
  }

  startReload() {
    const it = this.item, st = this.stat;
    if (this.reloadT > 0 || !(st.kind === 'gun' || st.kind === 'launcher') || it.mag >= st.mag || it.reserve <= 0) return false;
    this.reloadT = st.reload;
    this.ads = false;
    this.game.sfx.reload(this.pos);
    this.game.emit('reload', this);
    return true;
  }

  spreadNow(st) {
    let hipv = st.hip ?? 0.02, adsv = st.ads ?? 0.005;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    let s = lerp(hipv, adsv, this.adsT);
    s += Math.min(speed * 0.0018, 0.012) * (1 - this.adsT * 0.7);
    if (!this.onGround) s += 0.025;
    if (this.crouching) s *= 0.75;
    s += this.bloom;
    return s + this.botExtraSpread;
  }

  tryFire() {
    if (!this.alive || this.cd > 0 || this.switchT > 0 || this.reloadT > 0 || this.useT > 0) return false;
    const it = this.item, st = this.stat;
    if (st.kind === 'melee') return this._melee(st);
    if (st.kind === 'medkit') return this._medkit(it, st);
    if (it.mag <= 0) { this.startReload(); return false; }
    this.cd = 60 / st.rpm;
    it.mag--;
    this.sprinting = false;
    if (st.kind === 'throwable') return this._throw(st);
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
    this.bloom = Math.min(this.bloom + (st.kickV || 0.01) * 0.12, 0.02);
    if (this.isPlayer) {
      const k = (st.kickV || 0.01) * (this.adsT > 0.5 ? 0.7 : 1);
      this.recoilP += k;
      this.yaw += rand(-1, 1) * (st.kickH || 0.004);
      this.game.emit('fire', this);
    } else if (this.model.weapon) this.game.noiseAlert?.(this);
    if (st.bolt) this.game.emit('bolt', this);
    this.game.alertNear?.(this.pos, this.team, st.sound === 'pistol' ? 25 : 45);
  }

  _rocket(st) {
    const d = this.aimDir(new THREE.Vector3());
    const m = this.muzzleWorld(new THREE.Vector3());
    this.game.spawnRocket(this, m, d, st);
    this.game.sfx.shot('rpg', this.pos);
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
    if (this.item.mag <= 0) {
      // bomba bitti: birincil silaha dön
      setTimeout(() => { if (this.alive && this.stat.kind === 'throwable' && this.item.mag <= 0) this.switchTo(0); }, 350);
    }
    return true;
  }

  _melee(st) {
    this.cd = 60 / st.rpm;
    const o = this.eye(new THREE.Vector3()), d = this.aimDir(new THREE.Vector3());
    this.game.sfx.shot('knife', this.pos);
    this.game.emit('melee', this);
    this.flashT = 0;
    const hit = this.game.meleeHit(this, o, d, st.reach);
    if (hit) hit.victim.takeDamage(st.dmg * this.dmgMul, this, 'body', this.pos, st.name);
    return true;
  }

  _medkit(it, st) {
    if (it.mag <= 0 || this.hp >= this.maxHp) return false;
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
    if (ok && id === 'rpg' && it.mag <= 0 && it.reserve > 0) { it.mag = 1; it.reserve--; this.cd = 3.5; }
    return ok;
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
    if (attacker && attacker !== this && attacker.isPlayer) this.game.emit('hitmark', { victim: this, zone, dead: this.hp <= 0 });
    if (this.hp <= 0) this.die(attacker, weaponName, zone === 'head');
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  die(killer, weaponName, headshot) {
    if (!this.alive) return;
    this.alive = false; this.hp = 0;
    this.deaths++;
    this.deadT = 0; this.deadDir = Math.random() > 0.5 ? 1 : -1;
    this.ads = false; this.reloadT = 0; this.useT = 0;
    this.vel.set(0, 0, 0);
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
    this.bloom = Math.max(0, this.bloom - dt * 0.03);
    this.recoilP = Math.max(0, this.recoilP - dt * (0.06 + this.recoilP * 4.5));
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const it = this.item, st = this.stat;
        const need = st.mag - it.mag, take = Math.min(need, it.reserve);
        it.mag += take; it.reserve -= take;
        this.game.emit('reloaded', this);
      }
    }
    if (this.useT > 0) {
      this.useT -= dt;
      if (this.useT <= 0) {
        const it = this.useItem;
        if (it && it.mag > 0) { it.mag--; this.heal(WSTATS.medkit.heal); if (it.mag <= 0 && this.cur === 2) this.switchTo(0); }
      }
    }
    // hedef nişan geçişi
    const wantAds = this.ads && this.reloadT <= 0 && this.switchT <= 0 && this.stat.zoom && !this.sprinting;
    this.adsT = clamp(this.adsT + (wantAds ? 1 : -1) * dt * (this.stat.scope ? 6 : 9), 0, 1);
    const wantH = this.crouching ? H_CROUCH : H_STAND;
    this.height = wantH;
    this.crouchT = clamp(this.crouchT + (this.crouching ? 1 : -1) * dt * 7, 0, 1);
    this.eyeY = lerp(EYE_STAND, EYE_CROUCH, this.crouchT);
  }

  // Üçüncü şahıs model senkronu (oyuncu hariç)
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
    root.rotation.x = 0;
    p.torso.rotation.x = clamp(this.pitch + this.recoilP, -0.9, 0.9) * 0.7;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += sp * dt * 2.4;
    const amp = clamp(sp / 5.5, 0, 1) * 0.75 * (this.onGround ? 1 : 0.3);
    const sw = Math.sin(this.walkPhase) * amp;
    const c = this.crouchT;
    const L = p.legs.L, R = p.legs.R;
    L.hip.rotation.x = lerp(0.22 + sw, 0.9, c);
    R.hip.rotation.x = lerp(-0.2 - sw, 0.7, c);
    L.knee.rotation.x = lerp(-0.18 - Math.max(0, -sw) * 1.0, -1.6, c);
    R.knee.rotation.x = lerp(0.22 - Math.max(0, sw) * 1.0 * 1.0 - 0.2, -1.5, c);
    L.hip.position.y = R.hip.position.y = 0.88 - 0.27 * c;
    p.torso.position.y = 1.17 - 0.27 * c;
  }
}
