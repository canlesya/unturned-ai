import * as THREE from 'three';
import { createWeapon } from '../models/weapons.js';
import { createItem } from '../models/items.js';
import { WSTATS } from './stats.js';
import { clamp, rand } from './util.js';

// Gadget mantığı: duman (küre listesi, görüşü keser), flaşbang (körlük), claymore (mayın), cephane kutusu.
// game.smokes: [{ pos, r, rMax, life, max, group, puffs }] · game.deployables: kurulan nesneler

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const puffGeo = new THREE.IcosahedronGeometry(1, 1);
// Işıklandırmasız (Basic) malzeme: gölge/ışık hesabı olmadan çok katmanlı saydamlık ucuz kalır
const smokeMats = ['#d4d8dc', '#b9bec4', '#c4c9ce'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));

export function initGadgets(game) {
  game.smokes = [];
  game.deployables = [];
}

// ───────────── Duman ─────────────
export function spawnSmoke(game, pos, st, owner) {
  const rMax = st.radius || 5.2, life = st.smokeLife || 10;
  const center = pos.clone(); center.y += 1.4;
  const group = new THREE.Group();
  group.position.copy(center);
  const puffs = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(puffGeo, smokeMats[i % 3]);
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.45, 0.8), rand(-1, 1)).normalize();
    const off = dir.multiplyScalar(rand(0.2, 0.7) * rMax);
    m.userData = { off, s: rand(0.45, 0.75) * rMax, ph: Math.random() * 6 };
    group.add(m);
    puffs.push(m);
  }
  game.scene.add(group);
  game.smokes.push({ pos: center, r: 0.5, rMax, life, max: life, group, puffs, owner });
  game.sfx.smokeHiss(pos);
  // çıkış anında yerde toz fışkırması
  for (let i = 0; i < 10; i++) game.effects._part(pos, '#d8dbde', rand(0.2, 0.4), null, 4, rand(0.5, 1.0), -0.5);
  game.alertNear?.(pos, owner.team, 30);
}

function smokeR(sm) {
  const grow = clamp((sm.max - sm.life) / 1.3, 0, 1);              // 1.3 sn'de büyür
  const fade = clamp(sm.life / 2.0, 0, 1);                         // son 2 sn'de dağılır
  return sm.rMax * (0.25 + 0.75 * grow) * (0.35 + 0.65 * fade);
}

export function updateSmokes(game, dt, T) {
  for (let i = game.smokes.length - 1; i >= 0; i--) {
    const sm = game.smokes[i];
    sm.life -= dt;
    if (sm.life <= 0) {
      game.scene.remove(sm.group);
      game.smokes.splice(i, 1);
      continue;
    }
    sm.r = smokeR(sm);
    const k = sm.r / sm.rMax, fade = clamp(sm.life / 2.0, 0, 1);
    sm.group.rotation.y += dt * 0.12;
    for (const m of sm.puffs) {
      const u = m.userData;
      m.position.copy(u.off).multiplyScalar(k);
      m.scale.setScalar(u.s * k * (1 + 0.06 * Math.sin(T * 0.9 + u.ph)));
      m.material.opacity = 0.9 * (0.4 + 0.6 * fade);
    }
  }
}

// a→b doğrusu bir duman küresinden geçiyor mu?
export function smokeBlocks(game, a, b) {
  const sms = game.smokes;
  if (!sms.length) return false;
  _a.subVectors(b, a);
  const L2 = _a.lengthSq();
  for (const sm of sms) {
    const r = sm.r * 0.82;
    if (r < 0.6) continue;
    _b.subVectors(sm.pos, a);
    const t = L2 > 1e-6 ? clamp(_b.dot(_a) / L2, 0, 1) : 0;
    _c.copy(a).addScaledVector(_a, t);
    if (_c.distanceToSquared(sm.pos) < r * r) return true;
  }
  return false;
}

// bir noktadaki duman yoğunluğu (0..1): oyuncu içindeyken ekran grileşir
export function smokeDensity(game, p) {
  let d = 0;
  for (const sm of game.smokes) {
    const r = sm.r * 0.95;
    if (r < 0.6) continue;
    const dist = p.distanceTo(sm.pos);
    if (dist < r) d = Math.max(d, clamp((r - dist) / (r * 0.3), 0, 1));
  }
  return d;
}

// ───────────── Flaşbang ─────────────
export function flashBang(game, pos, owner, st) {
  game.sfx.flashbang(pos);
  game.effects.flashBurst?.(pos);
  game.alertNear?.(pos, owner.team, 40);
  const o = pos.clone(); o.y += 0.2;
  for (const e of game.soldiers) {
    if (!e.alive) continue;
    const eye = e.eye(_a);
    const d = eye.distanceTo(pos);
    if (d > st.radius) continue;
    if (!game.world.clear(o, eye)) continue;
    const look = e.aimDir(_b);
    const to = _c.subVectors(pos, eye).normalize();
    const dot = look.dot(to);
    const facing = dot > 0.15 ? 0.5 + 0.5 * clamp((dot - 0.15) / 0.55, 0, 1) : 0.28;   // bakmayan da biraz etkilenir
    let t = 4.4 * facing * (0.3 + 0.7 * (1 - d / st.radius));
    if (e.team === owner.team && e !== owner) t *= 0.6;
    if (t < 0.35) continue;
    e.blind(t);
    if (e.isPlayer) game.sfx.ring?.(Math.min(4, t + 1));
  }
}

// ───────────── Kurulabilir nesneler ─────────────
function groundAt(game, x, z, fromY) {
  const h = game.world.raycast(new THREE.Vector3(x, fromY + 1.2, z), new THREE.Vector3(0, -1, 0), 3.2, {});
  return h ? h.point.y : fromY;
}

export function placeDeployable(game, s, st) {
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
  if (!s.onGround) return false;
  const x = s.pos.x + fx * 0.9, z = s.pos.z + fz * 0.9;
  // önü duvarsa kurma
  const wall = game.world.raycast(new THREE.Vector3(s.pos.x, s.pos.y + 0.5, s.pos.z), new THREE.Vector3(fx, 0, fz), 1.0, {});
  if (wall) return false;
  const y = groundAt(game, x, z, s.pos.y);
  if (st.kind === 'mine') {
    const mine = game.deployables.filter((d) => d.type === 'claymore' && d.owner === s);
    if (mine.length >= 3) removeDeployable(game, mine[0]);
    const mesh = createWeapon('claymore');
    mesh.scale.setScalar(2.2);
    mesh.position.set(x, y + 0.15, z);
    mesh.rotation.y = s.yaw;
    game.scene.add(mesh);
    game.deployables.push({ type: 'claymore', owner: s, team: s.team, pos: new THREE.Vector3(x, y + 0.18, z), fx, fz, arm: 1.2, mesh, st, beep: 0 });
    return true;
  }
  if (st.kind === 'ammobox') {
    const mesh = createItem('ammoBox');
    mesh.scale.setScalar(1.7);
    mesh.position.set(x, y, z);
    mesh.rotation.y = s.yaw;
    game.scene.add(mesh);
    game.deployables.push({ type: 'ammo', owner: s, team: s.team, pos: new THREE.Vector3(x, y + 0.2, z), mesh, life: st.life || 30, tick: 0.5, st });
    if (s.isPlayer) game.hud.toast('Cephane kutusu kuruldu', '#cfe6ff');
    return true;
  }
  return false;
}

function removeDeployable(game, d) {
  game.scene.remove(d.mesh);
  const i = game.deployables.indexOf(d);
  if (i >= 0) game.deployables.splice(i, 1);
}

function claymoreBlast(game, d) {
  const st = d.st, pos = d.pos, R = st.radius;
  game.effects.explosion(pos, R * 0.7);
  game.sfx.explosion(pos);
  game.alertNear?.(pos, d.team, 70);
  const o = pos.clone(); o.y += 0.3;
  for (const e of game.soldiers) {
    if (!e.alive || e.team === d.team) continue;
    const c = e.center(_a);
    const dx = c.x - pos.x, dz = c.z - pos.z, dist = c.distanceTo(pos);
    if (dist > R) continue;
    if ((dx * d.fx + dz * d.fz) / (Math.hypot(dx, dz) + 1e-6) < -0.1) continue;       // arkasındakilere değmez
    if (!game.world.clear(o, c)) continue;
    e.takeDamage(st.dmg * (1 - (dist / R) ** 2), d.owner, 'body', pos, st.name);
    e.vel.x += dx / (dist + 0.5) * 2.5; e.vel.z += dz / (dist + 0.5) * 2.5;
  }
  const dc = pos.distanceTo(game.camera.position);
  game.effects.shake = Math.max(game.effects.shake, clamp(1 - dc / 30, 0, 1));
  removeDeployable(game, d);
}

export function updateGadgets(game, dt, T) {
  updateSmokes(game, dt, T);
  for (let i = game.deployables.length - 1; i >= 0; i--) {
    const d = game.deployables[i];
    if (!game.deployables.includes(d)) continue;
    if (d.type === 'claymore') {
      if (d.arm > 0) { d.arm -= dt; if (d.arm <= 0) game.sfx.beep(d.pos); continue; }
      d.beep -= dt;
      for (const e of game.soldiers) {
        if (!e.alive || e.team === d.team) continue;
        const dx = e.pos.x - d.pos.x, dz = e.pos.z - d.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > d.st.trigger || Math.abs(e.pos.y - d.pos.y) > 2.2) continue;
        if ((dx * d.fx + dz * d.fz) / (dist + 1e-6) < 0.5) continue;                 // yalnızca önündeki 120° koni
        if (!game.world.clear(d.pos, e.center(_a))) continue;
        claymoreBlast(game, d);
        break;
      }
    } else if (d.type === 'ammo') {
      d.life -= dt;
      d.tick -= dt;
      if (d.life <= 0) { removeDeployable(game, d); continue; }
      if (d.tick <= 0) {
        d.tick = 1.5;
        for (const s of game.soldiers) {
          if (!s.alive || s.team !== d.team) continue;
          if (Math.hypot(s.pos.x - d.pos.x, s.pos.z - d.pos.z) > d.st.radius) continue;
          let any = false;
          for (const it of s.items) {
            const ws = WSTATS[it.id];
            if ((ws.kind === 'gun' || ws.kind === 'launcher') && it.reserve < ws.reserve) {
              it.reserve = Math.min(ws.reserve, it.reserve + Math.ceil(ws.reserve * 0.3)); any = true;
            }
          }
          if (any && s.isPlayer) { game.hud.toast('Mühimmat dolduruldu', '#9be07a'); game.sfx.deploy(s.pos); }
        }
      }
    }
  }
}
