import * as THREE from 'three';
import { DIFFICULTY } from './stats.js';
import { clamp, rand, angleDiff, yawFromDir, lerp, pick } from './util.js';

const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();

export class BotBrain {
  constructor(game, soldier, diffKey = 'normal') {
    this.game = game;
    this.s = soldier;
    this.d = DIFFICULTY[diffKey];
    soldier.brain = this;
    soldier.dmgMul = this.d.dmgMul;
    this.reset();
  }

  reset() {
    this.t = rand(0, 1);
    this.senseT = rand(0, 0.2);
    this.target = null; this.reactT = 0; this.lostT = 0;
    this.lastKnown = null;
    this.goal = null; this.goalT = 0;
    this.path = null; this.repathT = 0;
    this.burstLeft = 0; this.burstPause = 0;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1; this.strafeT = rand(0.6, 1.6);
    this.alertT = -99; this.alertPos = null;
    this.stuckT = 0; this.stuckPos = new THREE.Vector3();
    this.gadgetT = rand(6, 14);
    this.aimFrac = rand(0.55, 0.82);
    this.holdT = 0;
  }

  hear(pos) {
    this.alertT = this.game.time;
    this.alertPos = (this.alertPos || new THREE.Vector3()).copy(pos);
    if (!this.target && Math.random() < 0.25 && this.goalT > 3) this.setGoal(pos.x + rand(-6, 6), pos.z + rand(-6, 6), 8);
  }

  onDamaged(attacker, fromPos) {
    this.alertT = this.game.time;
    if (attacker && attacker.alive && (!this.target || Math.random() < 0.4)) {
      this.target = attacker; this.reactT = Math.min(this.reactT, rand(0.15, 0.35)); this.lostT = 0;
    }
  }

  setGoal(x, z, time = 14) {
    this.goal = new THREE.Vector3(x, 0, z);
    this.goalT = time;
    this.path = null; this.repathT = 0;
  }

  pickGoal() {
    const g = this.game, s = this.s;
    const objs = g.mode.objectives;
    let best = null, bs = -1;
    for (const o of objs) {
      const mine = o.owner === s.team;
      const d = Math.hypot(o.x - s.pos.x, o.z - s.pos.z);
      const sc = (mine ? 0.25 : 1) / (1 + d / 70) + Math.random() * 0.5;
      if (sc > bs) { bs = sc; best = o; }
    }
    if (!best) return;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * best.r * 0.8;
    this.setGoal(best.x + Math.cos(a) * r, best.z + Math.sin(a) * r, rand(12, 26));
  }

  sense() {
    const g = this.game, s = this.s;
    const eye = s.eye(tA);
    const fwd = tB.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const alerted = g.time - this.alertT < 3;
    let best = null, bd = 1e9;
    for (const e of g.soldiers) {
      if (!e.alive || e.team === s.team || e.protT > 0.5) continue;
      const tc = e.center(tC);
      const dx = tc.x - eye.x, dz = tc.z - eye.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 130) continue;
      if (!alerted && (fwd.x * dx + fwd.z * dz) / (dist + 1e-6) < 0.3) continue;
      if (dist > 22 && e.crouching) { if (Math.random() < 0.3) continue; }
      if (!g.world.clear(eye, tc)) continue;
      if (dist < bd) { bd = dist; best = e; }
    }
    if (best) {
      if (best !== this.target) { this.target = best; this.reactT = rand(this.d.react[0], this.d.react[1]); this.aimFrac = rand(0.55, 0.85); }
      this.lostT = 0;
      this.lastKnown = (this.lastKnown || new THREE.Vector3()).copy(best.pos);
    } else if (this.target) {
      this.lostT += 0.22;
      if (this.lostT > 0.5) {
        if (this.lastKnown) this.setGoal(this.lastKnown.x, this.lastKnown.z, 6);
        this.target = null;
      }
    }
  }

  update(dt) {
    const s = this.s, g = this.game;
    if (!s.alive) return;
    this.t += dt;
    this.senseT -= dt;
    if (this.senseT <= 0) { this.senseT = 0.2 + Math.random() * 0.08; this.sense(); }
    this.goalT -= dt;
    if (!this.goal || this.goalT <= 0) this.pickGoal();
    if (this.target && !this.target.alive) { this.target = null; this.lostT = 0; }

    const st = s.stat;
    const eye = s.eye(tA);
    let moveX = 0, moveZ = 0, speed = 4.4 * s.def.speed * (st.move || 1);
    let combat = false;

    // ── reload / silah yönetimi ──
    const it = s.item;
    if ((st.kind === 'gun' || st.kind === 'launcher') && it.mag <= 0 && s.reloadT <= 0) {
      if (it.reserve > 0) s.startReload();
      else if (s.cur === 0 && s.items[1].mag + s.items[1].reserve > 0) s.switchTo(1);
    }
    if (!this.target && (st.kind === 'gun') && it.mag < st.mag * 0.4 && it.reserve > 0 && s.reloadT <= 0) s.startReload();
    if (!this.target && s.cur !== 0 && s.items[0].mag + s.items[0].reserve > 0) s.switchTo(0);
    if (!this.target && s.hp < 45 && s.items[2].id === 'medkit' && s.items[2].mag > 0) s.useGadget('medkit');

    if (this.target) {
      combat = true;
      const tg = this.target;
      const tp = tg.pos;
      const dx = tp.x - s.pos.x, dz = tp.z - s.pos.z;
      const dist = Math.hypot(dx, dz);
      // sniper yakında tabancaya geç
      if (s.items[0].id === 'sniper' && dist < 12 && s.cur === 0) s.switchTo(1);
      else if (s.cur === 1 && s.items[0].id === 'sniper' && dist > 25) s.switchTo(0);

      const ty = tp.y + tg.height * this.aimFrac;
      const dy = ty - eye.y;
      const wantYaw = yawFromDir(dx, dz);
      let wantPitch = Math.atan2(dy, dist);
      if (dist > 35) wantPitch += dist * 0.0004;
      const turn = this.d.turn * (0.7 + Math.min(Math.abs(angleDiff(s.yaw, wantYaw)), 1.5));
      const dyaw = angleDiff(s.yaw, wantYaw);
      s.yaw += clamp(dyaw, -turn * dt, turn * dt);
      s.pitch += clamp(wantPitch - s.pitch, -turn * dt, turn * dt);
      s.ads = dist > 28 || st.scope;

      this.reactT -= dt;
      const aimed = Math.abs(dyaw) < 0.07 + 2 / (dist + 8);
      s.botExtraSpread = this.d.err * (0.6 + dist / 45) * (this.reactT > -0.8 ? 1.8 : 1);
      if (this.reactT <= 0 && aimed) {
        if (this.burstPause > 0) this.burstPause -= dt;
        else {
          if (this.burstLeft <= 0) this.burstLeft = Math.round(rand(this.d.burst[0], this.d.burst[1]));
          const fired = s.tryFire();
          if (fired) {
            this.burstLeft--;
            if (this.burstLeft <= 0) this.burstPause = rand(0.25, 0.9) * (st.auto ? 1 : 0.3);
          }
        }
      }
      // gadget
      this.gadgetT -= dt;
      if (this.gadgetT <= 0 && this.reactT <= 0) {
        const gid = s.items[2].id;
        if (gid === 'grenade' && dist > 9 && dist < 30) { s.pitch = Math.max(s.pitch, 0.18 + dist * 0.004); if (s.useGadget('grenade')) this.gadgetT = rand(14, 25); }
        else if (gid === 'rpg' && dist > 14 && dist < 70 && Math.random() < 0.5) { if (s.useGadget('rpg')) this.gadgetT = rand(10, 16); }
        else this.gadgetT = 2;
      }

      // savaş hareketi
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = rand(0.7, 2.0); }
      const nx = dx / (dist + 1e-6), nz = dz / (dist + 1e-6);
      const pid = s.items[0].id;
      const holdRange = pid === 'sniper' ? 150 : pid === 'lmg' ? 48 : 0;
      this.holdBudget = (this.holdBudget ?? 6) - dt;
      const holdPos = holdRange > 0 && dist < holdRange && dist > 14 && this.holdBudget > 0;
      if (this.holdBudget < -4) this.holdBudget = rand(5, 9);
      if (holdPos) { speed = 0; s.crouching = pid === 'sniper'; }
      else {
        s.crouching = false;
        let fwd = 0;
        if (dist > (pid === 'lmg' ? 40 : 28)) fwd = 0.7; else if (dist < 7 && s.items[0].id !== 'shotgun') fwd = -0.6; else if (s.items[0].id === 'shotgun' && dist > 5) fwd = 0.9;
        moveX = nx * fwd + (-nz) * this.strafeDir * 0.55;
        moveZ = nz * fwd + (nx) * this.strafeDir * 0.55;
        speed *= 0.62;
      }
    } else {
      s.ads = false; s.crouching = false; s.botExtraSpread = 0;
      this.burstLeft = 0;
      s.pitch += (0 - s.pitch) * Math.min(1, dt * 4);
      // yol takibi
      if (this.goal) {
        const gd = Math.hypot(this.goal.x - s.pos.x, this.goal.z - s.pos.z);
        if (gd < 1.8) { this.holdT -= dt; if (this.holdT <= -0.01 && this.holdT > -5) { /* bekle */ } speed = 0; if (this.holdT <= 0) { this.holdT = rand(2, 5); this.setGoal(this.goal.x + rand(-6, 6), this.goal.z + rand(-6, 6), 10); } }
        else {
          this.repathT -= dt;
          if (!this.path || this.repathT <= 0) {
            if (g.pathBudget > 0) {
              g.pathBudget--;
              this.path = g.nav.findPath(s.pos.x, s.pos.z, this.goal.x, this.goal.z);
              this.repathT = rand(2.5, 4);
              if (!this.path) { this.goal = null; }
            }
          }
          if (this.path && this.path.length) {
            let wp = this.path[0];
            while (this.path.length > 1 && Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z) < 0.9) { this.path.shift(); wp = this.path[0]; }
            const wd = Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z);
            if (wd < 0.6 && this.path.length === 1) this.path = null;
            else { moveX = (wp.x - s.pos.x) / (wd + 1e-6); moveZ = (wp.z - s.pos.z) / (wd + 1e-6); }
            speed *= 1.35;
          }
        }
      }
      // yürüme yönüne dön, ya da son duyulan sese bak
      const ml = Math.hypot(moveX, moveZ);
      if (ml > 0.1) s.yaw += clamp(angleDiff(s.yaw, yawFromDir(moveX, moveZ)), -6 * dt, 6 * dt);
      else if (this.alertPos && g.time - this.alertT < 2.5) {
        const wy = yawFromDir(this.alertPos.x - s.pos.x, this.alertPos.z - s.pos.z);
        s.yaw += clamp(angleDiff(s.yaw, wy), -3 * dt, 3 * dt);
      }
    }

    // takılma kontrolü
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      if (!combat && (moveX || moveZ) && s.pos.distanceTo(this.stuckPos) < 0.35) {
        this.path = null; this.repathT = 0;
        if (Math.random() < 0.4) this.setGoal(s.pos.x + rand(-10, 10), s.pos.z + rand(-10, 10), 6);
      }
      this.stuckT = 0; this.stuckPos.copy(s.pos);
    }

    // ayrışma
    for (const o of g.soldiers) {
      if (o === s || !o.alive) continue;
      const dx = s.pos.x - o.pos.x, dz = s.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.1 && d2 > 1e-4) { const d = Math.sqrt(d2); moveX += (dx / d) * 0.7; moveZ += (dz / d) * 0.7; }
    }

    const ml = Math.hypot(moveX, moveZ);
    const k = ml > 1 ? 1 / ml : 1;
    const wx = moveX * k * speed, wz = moveZ * k * speed;
    const a = Math.min(1, dt * 10);
    s.vel.x = lerp(s.vel.x, wx, a);
    s.vel.z = lerp(s.vel.z, wz, a);
    s.sprinting = !combat && speed > 5;
  }
}
