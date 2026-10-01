import * as THREE from 'three';
import { setupEnvironment } from '../maps/environment.js';
import { buildKasaba } from '../maps/kasaba.js';
import { World } from './collision.js';
import { NavGrid } from './nav.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Hud } from './hud.js';
import { Soldier } from './soldier.js';
import { Player } from './player.js';
import { BotBrain } from './bot.js';
import { MODES, CLASS_DEFS, WSTATS, BOT_NAMES } from './stats.js';
import { rand, pick, clamp } from './util.js';
import { TEAMS } from '../core/palette.js';
import { mat } from '../core/geo.js';

const UP = new THREE.Vector3(0, 1, 0);

function rayBox(o, d, min, max, maxT) {
  let t0 = 0, t1 = maxT;
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    const inv = 1 / (dd[a] || 1e-9);
    let ta = (min[a] - oo[a]) * inv, tb = (max[a] - oo[a]) * inv;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t0;
}

export class Game {
  constructor(container, opts) {
    this.opts = opts;
    this.container = container;
    this.settings = opts.settings;
    this.listeners = new Map();
    this.time = 0; this.running = false; this.ended = false; this.simulate = true;
    this.soldiers = []; this.brains = []; this.projectiles = [];
    this.classDefs = CLASS_DEFS;
    this.pendingClass = null;
    this.pathBudget = 3;
    this.medicT = 0; this.resupplyT = 0; this.bleedT = 5; this.capT = 0;

    // ── renderer ──
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio, this.settings.pixelRatio || 1.5));
    r.setSize(innerWidth, innerHeight, false);   // CSS boyutunu biz belirleriz (yüksek DPI'da tuval taşmasın)
    r.autoClear = false;
    r.shadowMap.enabled = this.settings.shadows !== false;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = r.domElement;
    this.canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:block;';
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.05, 700);
    this.scene.add(this.camera);
    const env = setupEnvironment(this.scene, r, { shadowSize: 55, sunPos: [55, 85, 40] });
    this.sun = env.sun;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sunOff = new THREE.Vector3(55, 85, 40);

    // ── harita ──
    this.map = buildKasaba();
    this.scene.add(this.map.group);
    this.world = new World(this.map.colliders, this.map.bounds);
    this.nav = new NavGrid(this.map.colliders, this.map.bounds);

    this.mode = { ...MODES[opts.mode] };
    this.mode.objectives = this.map.objectives.filter((o) => this.mode.objectives.includes(o.id)).map((o) => ({ ...o, owner: null, p: 0 }));
    this.tickets = { blue: this.mode.tickets, red: this.mode.tickets };
    this.timeLeft = this.mode.time;

    this.effects = new Effects(this.scene);
    this.sfx = new Sfx();
    this.sfx.setVolume(this.settings.volume);
    this.sfx.init();

    // ── savaşçılar ──
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const order = ['assault', 'medic', 'assault', 'heavy', 'sniper', 'engineer', 'assault', 'medic', 'engineer', 'assault'];
    let id = 0;
    for (const team of ['blue', 'red']) {
      for (let i = 0; i < this.mode.perTeam; i++) {
        const isPlayer = team === opts.team && i === 0;
        const s = new Soldier(this, {
          id: id++, name: isPlayer ? 'Sen' : names.pop(), team,
          cls: isPlayer ? opts.cls : order[(i + (team === 'red' ? 2 : 0)) % order.length], isPlayer,
        });
        this.soldiers.push(s);
        if (isPlayer) this.playerSoldier = s;
        else this.brains.push(new BotBrain(this, s, opts.diff));
      }
    }
    if (opts.autoplay) this.brains.push(new BotBrain(this, this.playerSoldier, opts.diff));
    this.hud = new Hud(this);
    this.player = new Player(this, this.playerSoldier, this.settings);
    this.player.locked = !!opts.nolock;

    // olaylar
    this.on('hitmark', (e) => {
      this.hud.hitmarker(e.dead, e.zone === 'head');
      if (e.dead) this.sfx.kill(); else if (e.zone === 'head') this.sfx.headshot(); else this.sfx.hit();
    });
    document.addEventListener('pointerlockchange', this._plc = () => {
      const locked = document.pointerLockElement === this.canvas;
      this.player.locked = locked || !!this.opts.nolock;
      if (!this.ended) this.hud.setPaused(!this.player.locked);
      this.simulate = this.player.locked || this.ended;
    });
    document.addEventListener('pointerlockerror', this._ple = () => this.fallbackLock());
    addEventListener('resize', this._rs = () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight, false);
    });

    for (const s of this.soldiers) this.respawn(s, true);
    this.running = true;
    this.simulate = !!opts.nolock;
    this.hud.setPaused(!opts.nolock);
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    if (opts.debug) window.__game = this;
  }

  // ───── olaylar ─────
  on(n, fn) { (this.listeners.get(n) || this.listeners.set(n, []).get(n)).push(fn); }
  emit(n, p) { const a = this.listeners.get(n); if (a) for (const f of a) f(p); }

  requestLock() {
    this.sfx.init();
    if (this.opts.nolock) { this.player.locked = true; this.simulate = true; this.hud.setPaused(false); return; }
    if (this.noPointerLock) { this.player.locked = true; this.simulate = true; this.hud.setPaused(false); return; }
    try { const p = this.canvas.requestPointerLock(); p?.catch?.(() => this.fallbackLock()); } catch (e) { this.fallbackLock(); }
  }

  // Fare kilidi desteklenmiyorsa (gömülü sayfa vb.): ok tuşlarıyla bak, Esc ile duraklat
  fallbackLock() {
    if (this.noPointerLock) return;
    this.noPointerLock = true;
    this.player.locked = true; this.simulate = true;
    this.hud.setPaused(false);
    this.hud.toast('Fare kilitlenemedi · bakmak için ok tuşları, duraklatmak için Esc', '#ffd27a');
  }

  togglePause() {
    if (this.ended) return;
    this.simulate = !this.simulate;
    this.hud.setPaused(!this.simulate);
  }

  respawnReady() { return !this.playerSoldier.alive && !this.ended; }
  requestClass(k) { this.pendingClass = k; this.hud.markClass(k); }

  // ───── doğma ─────
  pickSpawn(team) {
    const pts = this.map.spawns[team];
    const free = pts.filter((p) => !this.soldiers.some((s) => s.alive && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 1.3));
    return pick(free.length ? free : pts);
  }

  respawn(s, first = false) {
    if (s.isPlayer && this.pendingClass && this.pendingClass !== s.cls) s.setClass(this.pendingClass);
    s.spawn(this.pickSpawn(s.team), first ? 1 : 2.5);
    this.world.settle(s);
    if (s.brain) s.brain.reset();
    if (s.isPlayer) this.pendingClass = null;
  }

  // ───── ana döngü ─────
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = clamp((now - this.last) / 1000 || 0.016, 0, 0.05);
    this.last = now;
    if (this.simulate && !this.ended) this.step(dt);
    else if (this.ended) { this.effects.update(dt); for (const s of this.soldiers) s.syncModel(dt); }
    this.render();
  }

  step(dt) {
    this.time += dt;
    this.pathBudget = 1;
    for (const s of this.soldiers) {
      s.update(dt);
      if (s.alive) this.world.move(s, dt);
    }
    this.player.update(dt);
    for (const b of this.brains) b.update(dt);
    this.updateProjectiles(dt);
    this.updateMode(dt);
    for (const s of this.soldiers) {
      if (!s.alive && !this.ended) {
        s.respawnT -= dt;
        if (s.respawnT <= 0) this.respawn(s);
      }
    }
    this.effects.update(dt);
    for (const s of this.soldiers) s.syncModel(dt);
    this.hud.update(dt);
  }

  render() {
    const r = this.renderer;
    // gölge kamerası oyuncuyu izler (kayma olmaması için ızgaraya yuvarla)
    const p = this.playerSoldier.pos;
    const q = (2 * 55) / 2048;
    const tx = Math.round(p.x / q) * q, tz = Math.round(p.z / q) * q;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx + this.sunOff.x, this.sunOff.y, tz + this.sunOff.z);
    r.clear();
    r.render(this.scene, this.camera);
    if (this.playerSoldier.alive) this.player.vm.render(r, innerWidth, innerHeight);
  }

  // ───── Savaş mantığı ─────
  hitSoldier(e, o, d, maxT) {
    const H = e.height, px = e.pos.x, py = e.pos.y, pz = e.pos.z;
    // kaba küre testi
    const cx = px - o.x, cy = py + H * 0.5 - o.y, cz = pz - o.z;
    const proj = cx * d.x + cy * d.y + cz * d.z;
    if (proj < -1.2 || proj > maxT + 1.2) return null;
    const dist2 = cx * cx + cy * cy + cz * cz - proj * proj;
    const rad = e.proneT > 0.5 ? 1.35 : 1.2;
    if (dist2 > rad * rad) return null;
    if (e.proneT > 0.5) {
      // yatan oyuncu: gövde yaw boyunca uzanır (eksen hizalı kutu), kafa önde
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), ax = Math.abs(fx), az = Math.abs(fz);
      const hx = ax * 0.82 + az * 0.27, hz = az * 0.82 + ax * 0.27;
      const hxp = px + fx * 0.72, hzp = pz + fz * 0.72;
      const th = rayBox(o, d, [hxp - 0.17, py + 0.1, hzp - 0.17], [hxp + 0.17, py + 0.5, hzp + 0.17], maxT);
      const tb = rayBox(o, d, [px - hx, py, pz - hz], [px + hx, py + 0.45, pz + hz], maxT);
      if (th >= 0 && (tb < 0 || th <= tb)) return { t: th, zone: 'head' };
      if (tb >= 0) return { t: tb, zone: 'body' };
      return null;
    }
    const lx = e.leanOff.x, lz = e.leanOff.z;       // eğilen oyuncunun kafası yana kayar
    const hh = H - 0.36;
    const th = rayBox(o, d, [px + lx - 0.2, py + hh + e.leanOff.y, pz + lz - 0.2], [px + lx + 0.2, py + H + e.leanOff.y, pz + lz + 0.2], maxT);
    const tb = rayBox(o, d, [px + lx * 0.45 - 0.29, py, pz + lz * 0.45 - 0.29], [px + lx * 0.45 + 0.29, py + hh, pz + lz * 0.45 + 0.29], maxT);
    if (th >= 0 && (tb < 0 || th <= tb)) return { t: th, zone: 'head' };
    if (tb >= 0) {
      const y = o.y + d.y * tb - py;
      return { t: tb, zone: y < H * 0.42 ? 'legs' : 'body' };
    }
    return null;
  }

  shootRay(shooter, origin, dir, st, muzzle) {
    const maxT = st.range ? st.range[1] * 2.2 : 300;
    const wh = this.world.raycast(origin, dir, maxT, (this._wh ||= {}));
    const tw = wh ? wh.t : Infinity;
    let bestE = null, bestT = Infinity, bestZ = null;
    for (const e of this.soldiers) {
      if (e === shooter || !e.alive || e.team === shooter.team) continue;
      const h = this.hitSoldier(e, origin, dir, Math.min(tw, bestT, maxT));
      if (h && h.t < bestT && h.t < tw) { bestE = e; bestT = h.t; bestZ = h.zone; }
    }
    shooter.spottedT = this.time;
    if (bestE) {
      const pt = origin.clone().addScaledVector(dir, bestT);
      const r0 = st.range[0], r1 = st.range[1];
      const f = bestT <= r0 ? 1 : lerpClamp(1, st.minMul, (bestT - r0) / (r1 - r0));
      const zm = bestZ === 'head' ? 2.1 : bestZ === 'legs' ? 0.8 : 1;
      this.effects.blood(pt, 7, dir.clone().negate());
      if (Math.random() < 0.6 || (st.pellets || 1) === 1) this.effects.tracer(muzzle, pt);
      bestE.takeDamage(st.dmg * f * zm * (shooter.dmgMul || 1), shooter, bestZ, shooter.pos, st.name);
    } else if (wh) {
      const pt = wh.point.clone();
      if (Math.random() < 0.7) this.effects.tracer(muzzle, pt);
      this.effects.spark(pt, 4, wh.normal);
      if (wh.collider || wh.normal.y > 0.5) this.effects.dust(pt, wh.normal);
      this.effects.decal(pt, wh.normal);
      if (shooter.isPlayer || pt.distanceTo(this.camera.position) < 25) this.sfx.impact(pt);
    } else {
      this.effects.tracer(muzzle, origin.clone().addScaledVector(dir, 120));
    }
  }

  meleeHit(attacker, o, d, reach) {
    let best = null, bt = reach;
    const wh = this.world.raycast(o, d, reach, (this._mh ||= {}));
    if (wh) bt = Math.min(bt, wh.t);
    for (const e of this.soldiers) {
      if (e === attacker || !e.alive || e.team === attacker.team) continue;
      const h = this.hitSoldier(e, o, d, bt);
      if (h && h.t <= bt) { bt = h.t; best = { victim: e }; }
    }
    return best;
  }

  alertNear(pos, team, radius) {
    for (const s of this.soldiers) {
      if (!s.alive || s.team === team || !s.brain) continue;
      if (Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z) < radius) s.brain.hear(pos);
    }
  }

  // ───── Mermi benzeri nesneler ─────
  spawnRocket(owner, pos, dir, st) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), mat('#4d5b3a'));
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), mat('#36422a'));
    nose.rotation.x = -Math.PI / 2; nose.position.z = -0.35;
    g.add(body, nose);
    g.position.copy(pos);
    g.lookAt(pos.clone().add(dir));
    this.scene.add(g);
    this.projectiles.push({ type: 'rocket', mesh: g, pos: pos.clone(), vel: dir.clone().multiplyScalar(st.speed), owner, st, life: 6, trail: 0 });
  }

  spawnGrenade(owner, pos, vel, st) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat('#4d5b3a'));
    m.position.copy(pos);
    m.castShadow = true;
    this.scene.add(m);
    this.projectiles.push({ type: 'grenade', mesh: m, pos: pos.clone(), vel: vel.clone(), owner, st, fuse: st.fuse, bounces: 0 });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      let boom = null;
      if (p.type === 'rocket') {
        p.life -= dt;
        const step = p.vel.clone().multiplyScalar(dt), L = step.length();
        const d = step.clone().normalize();
        const wh = this.world.raycast(p.pos, d, L + 0.1, (this._ph ||= {}));
        let hitT = wh ? wh.t : Infinity;
        for (const e of this.soldiers) {
          if (!e.alive || e === p.owner || e.team === p.owner.team) continue;
          const h = this.hitSoldier(e, p.pos, d, Math.min(L, hitT));
          if (h && h.t < hitT) hitT = h.t;
        }
        if (hitT <= L + 0.1) boom = p.pos.clone().addScaledVector(d, Math.max(0, hitT - 0.1));
        else if (p.life <= 0) boom = p.pos.clone();
        else {
          p.pos.add(step);
          p.mesh.position.copy(p.pos);
          p.trail -= dt;
          if (p.trail <= 0) { p.trail = 0.02; this.effects._part(p.pos, '#8a8a8a', 0.14, null, 0.6, 0.7, -0.5); this.effects._part(p.pos, '#ffb04a', 0.08, null, 0.3, 0.12, 0); }
        }
      } else {
        p.fuse -= dt;
        p.vel.y -= 14 * dt;
        const step = p.vel.clone().multiplyScalar(dt), L = step.length();
        if (L > 1e-5) {
          const d = step.clone().normalize();
          const wh = this.world.raycast(p.pos, d, L + 0.05, (this._ph ||= {}));
          if (wh) {
            p.pos.copy(wh.point).addScaledVector(wh.normal, 0.06);
            const n = wh.normal, vn = p.vel.dot(n);
            p.vel.addScaledVector(n, -2 * vn).multiplyScalar(0.45);
            if (Math.abs(n.y) > 0.5) { p.vel.x *= 0.7; p.vel.z *= 0.7; if (Math.abs(p.vel.y) < 1.2) p.vel.y = 0; }
            if (++p.bounces < 6 && p.vel.length() > 1.5) this.sfx.impact(p.pos);
          } else p.pos.add(step);
        }
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.x += dt * 8; p.mesh.rotation.z += dt * 6;
        if (p.fuse <= 0) boom = p.pos.clone();
      }
      if (boom) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        this.explode(boom, p.st.radius, p.st.dmg, p.owner, p.st.name);
      }
    }
  }

  explode(pos, radius, dmg, owner, name) {
    this.effects.explosion(pos, radius);
    this.sfx.explosion(pos);
    this.alertNear(pos, owner.team, 90);
    const dc = pos.distanceTo(this.camera.position);
    this.effects.shake = Math.max(this.effects.shake, clamp(1 - dc / 35, 0, 1) * 1.1);
    const o = pos.clone(); o.y += 0.3;
    for (const e of this.soldiers) {
      if (!e.alive) continue;
      if (e.team === owner.team && e !== owner) continue;
      const c = e.center(new THREE.Vector3());
      const d = c.distanceTo(pos);
      if (d > radius) continue;
      if (!this.world.clear(o, c)) continue;
      let a = dmg * (1 - (d / radius) ** 2);
      if (e === owner) a *= 0.55;
      e.takeDamage(a, owner, 'body', pos, name);
      e.vel.x += (c.x - pos.x) / (d + 0.5) * 3; e.vel.z += (c.z - pos.z) / (d + 0.5) * 3;
    }
    const dn = new THREE.Vector3(0, -1, 0);
    const gh = this.world.raycast(new THREE.Vector3(pos.x, pos.y + 1, pos.z), dn, 6, {});
    if (gh) this.effects.decal(gh.point, gh.normal, true);
  }

  // ───── Mod: hedef ele geçirme + bilet ─────
  updateMode(dt) {
    this.timeLeft -= dt;
    this.capT -= dt;
    if (this.capT <= 0) {
      const step = 0.1;
      this.capT = step;
      for (const o of this.mode.objectives) {
        let b = 0, r = 0;
        for (const s of this.soldiers) {
          if (!s.alive) continue;
          if (Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r && s.pos.y < 8) (s.team === 'blue' ? b++ : r++);
        }
        const net = clamp(b - r, -3, 3);
        if (net !== 0) {
          const prev = o.owner;
          o.p = clamp(o.p + net * 0.085 * step, -1, 1);
          if (o.p >= 1 && o.owner !== 'blue') o.owner = 'blue';
          else if (o.p <= -1 && o.owner !== 'red') o.owner = 'red';
          else if (o.owner === 'blue' && o.p <= 0) o.owner = null;
          else if (o.owner === 'red' && o.p >= 0) o.owner = null;
          if (o.owner !== prev) this.onFlag(o, prev);
        }
      }
    }
    this.bleedT -= dt;
    if (this.bleedT <= 0) {
      this.bleedT = 5;
      const nb = this.mode.objectives.filter((o) => o.owner === 'blue').length;
      const nr = this.mode.objectives.filter((o) => o.owner === 'red').length;
      if (nb > nr) this.tickets.red -= nb - nr;
      else if (nr > nb) this.tickets.blue -= nr - nb;
    }
    // sıhhiye aurası + ikmal
    this.medicT -= dt;
    if (this.medicT <= 0) {
      this.medicT = 0.5;
      for (const m of this.soldiers) {
        if (!m.alive || m.cls !== 'medic') continue;
        for (const a of this.soldiers) {
          if (a === m || !a.alive || a.team !== m.team || a.hp >= a.maxHp) continue;
          if (Math.hypot(a.pos.x - m.pos.x, a.pos.z - m.pos.z) < 6) a.heal(2.5);
        }
      }
    }
    this.resupplyT -= dt;
    if (this.resupplyT <= 0) {
      this.resupplyT = 2;
      for (const s of this.soldiers) {
        if (!s.alive) continue;
        const sp = this.map.spawns[s.team][0];
        const home = Math.hypot(s.pos.x - sp.x, s.pos.z - sp.z) < 14;
        const own = this.mode.objectives.some((o) => o.owner === s.team && Math.hypot(s.pos.x - o.x, s.pos.z - o.z) < o.r);
        if (!home && !own) continue;
        for (const it of s.items) {
          const st = WSTATS[it.id];
          if ((st.kind === 'gun' || st.kind === 'launcher') && st.reserve) it.reserve = Math.min(st.reserve, it.reserve + Math.ceil(st.reserve * 0.12));
        }
      }
    }
    this.checkEnd();
  }

  onFlag(o, prev) {
    const mine = this.playerSoldier.team;
    if (o.owner) {
      const good = o.owner === mine;
      this.hud.toast(`${o.name} ${good ? 'ele geçirildi' : 'düşman tarafından ele geçirildi'}`, good ? '#7ec8ff' : '#ff8a7a');
      this.sfx.capture();
    } else if (prev) this.hud.toast(`${o.name} tarafsız oldu`, '#cfd3d8');
  }

  onKill(killer, victim, weapon, hs) {
    this.tickets[victim.team] -= 1;
    this.hud.killFeed(killer, victim, weapon, hs);
    victim.respawnT = victim.isPlayer ? 5 : rand(3.5, 6);
    if (victim.isPlayer) this.player.camPos.copy(victim.eye());
  }

  checkEnd() {
    if (this.ended) return;
    let w = null, why = '';
    if (this.tickets.blue <= 0) { w = 'red'; why = 'Mavi takımın biletleri tükendi'; }
    else if (this.tickets.red <= 0) { w = 'blue'; why = 'Kırmızı takımın biletleri tükendi'; }
    else if (this.timeLeft <= 0) { w = this.tickets.blue >= this.tickets.red ? 'blue' : 'red'; why = 'Süre doldu'; }
    if (!w) return;
    this.ended = true;
    this.running = false;
    document.exitPointerLock?.();
    const me = this.playerSoldier;
    const win = w === me.team;
    const list = this.soldiers.filter((s) => s.team === me.team).sort((a, b) => b.score - a.score);
    const rows = `<b>Senin istatistiklerin:</b> ${me.kills} öldürme · ${me.deaths} ölüm · ${me.score} puan<br><small>Mavi ${Math.max(0, Math.round(this.tickets.blue))} – ${Math.max(0, Math.round(this.tickets.red))} Kırmızı · En iyi: ${list[0].name} (${list[0].score})</small>`;
    this.hud.showEnd(win, win ? 'ZAFER!' : 'YENİLGİ', `${why}. ${TEAMS[w].name} kazandı.`, rows);
  }

  exit() { this.dispose(); this.opts.onExit?.(); }
  restart() { this.dispose(); this.opts.onRestart?.(); }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.running = false;
    document.exitPointerLock?.();
    document.removeEventListener('pointerlockchange', this._plc);
    document.removeEventListener('pointerlockerror', this._ple);
    removeEventListener('resize', this._rs);
    this.player.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    if (window.__game === this) delete window.__game;
  }
}

function lerpClamp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
