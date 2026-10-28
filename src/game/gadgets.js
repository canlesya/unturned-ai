import * as THREE from 'three';
import { createWeapon } from '../models/weapons.js';
import { WSTATS } from './stats.js';
import { clamp, rand } from './util.js';
import { t as $t } from '../i18n/index.js';
import { deafen } from './grenade.js';
import { toWorld, toLocal2 } from '../sim/vehicle.js';

// Gadget mantığı: duman (küre listesi, görüşü keser), flaşbang (körlük), claymore (mayın), cephane kutusu.
// game.smokes: [{ pos, r, rMax, life, max, group, puffs }] · game.deployables: kurulan nesneler

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const puffGeo = new THREE.IcosahedronGeometry(1, 1);
// Kurulan cephane kutusu: S3 modeli (12.123), kutu tabanı zemine (model kökeni kutu ortası, taban −0,09)
function ammoMesh() { const g = new THREE.Group(), m = createWeapon('ammobox'); m.position.y = 0.09; g.add(m); return g; }
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
  const nP = life > 15 ? 22 : 16;                                   // 12.193: uzun (PUBG) duman daha çok, daha yoğun bulut
  for (let i = 0; i < nP; i++) {
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

const smGrow = (sm) => (sm.max > 15 ? 2.4 : 1.3), smFade = (sm) => (sm.max > 15 ? 4 : 2);      // 12.193: 30 sn'lik dumanda 2,4 sn'de kabarır, son 4 sn'de dağılır
function smokeR(sm) {
  const grow = clamp((sm.max - sm.life) / smGrow(sm), 0, 1);       // kabarma
  const fade = clamp(sm.life / smFade(sm), 0, 1);                  // dağılma
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
    const k = sm.r / sm.rMax, fade = clamp(sm.life / smFade(sm), 0, 1);
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
// 12.193 PUBG sersemletici: en etkili menzil st.radius (20 m). DOĞRUDAN (açık hat + bakış konisinde): körlük 5,5 sn (yakında) → 1 sn (20 m'de),
// koni kenarına doğru azalır; DOLAYLI (bakmıyor / duvar arkası, st.near = 6,5 m içinde): en çok 3 sn (açık hat yoksa yarısı). Sağırlık + çınlama:
// near × 1,6 içinde (duvar arkasından da) en çok 10 sn, uzakta yalnız doğrudan bakana kısa. Takım arkadaşı ×0,6 (kendin tam).
export function flashBang(game, pos, owner, st) {
  game.sfx.flashbang(pos);
  game.effects.flashBurst?.(pos);
  game.alertNear?.(pos, owner.team, 40);
  const o = pos.clone(); o.y += 0.2;
  const R = st.radius || 20, N = st.near || 6.5;
  for (const e of game.soldiers) {
    if (!e.alive) continue;
    const eye = e.eye(_a);
    const d = eye.distanceTo(pos);
    if (d > R) continue;
    const los = game.world.clear(o, eye);
    const look = e.aimDir(_b);
    const to = _c.subVectors(pos, eye).normalize();
    const dot = look.dot(to);
    let t = 0, ring = 0;
    if (los && dot > 0.2) {                                                 // doğrudan: koni (≈ 55°) içinde tam, 0,2'ye doğru azalır
      const cone = dot > 0.57 ? 1 : 0.35 + 0.65 * (dot - 0.2) / 0.37;
      t = (5.5 - 4.5 * (d / R)) * cone;
    }
    if (d < N) t = Math.max(t, 3 * (1 - d / N) * (los ? 1 : 0.5) + (los ? 0.4 : 0));      // dolaylı
    if (d < N * 1.6) ring = 10 * (1 - d / (N * 1.6)) + 1;
    else if (t > 1.5) ring = t * 0.6;
    const mul = e.team === owner.team && e !== owner ? 0.6 : 1;
    t *= mul; ring *= mul;
    if (t >= 0.35) e.blind(t);
    if (e.isPlayer && (t >= 0.35 || ring > 1)) { game.sfx.ring?.(Math.min(10, Math.max(ring, t + 1))); deafen(game.sfx, Math.min(10, Math.max(ring, t))); game.emit('flashed', { t, ring }); }
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
  if (game.online) return true;        // çevrimiçi istemci: nesneyi sunucu olayı (dep) oluşturur; burada yalnızca animasyon/cephane tahmini
  const x = s.pos.x + fx * 0.9, z = s.pos.z + fz * 0.9;
  // önü duvarsa kurma
  const wall = game.world.raycast(new THREE.Vector3(s.pos.x, s.pos.y + 0.5, s.pos.z), new THREE.Vector3(fx, 0, fz), 1.0, {});
  if (wall && st.dep !== 'c4') return false;                                  // 12.208 C4 önündeki araca / duvara yapışır
  const y = groundAt(game, x, z, s.pos.y);
  if (st.dep === 'c4' || st.dep === 'atmine') return placeAT(game, s, st, x, y, z, fx, fz);
  if (st.kind === 'mine') {
    const mine = game.deployables.filter((d) => d.type === 'claymore' && d.owner === s);
    if (mine.length >= 3) removeDeployable(game, mine[0]);
    const mesh = createWeapon('claymore');
    mesh.scale.setScalar(2.2);
    mesh.position.set(x, y + 0.15, z);
    mesh.rotation.y = s.yaw;
    game.scene.add(mesh);
    const d = { id: ++game.pidN, type: 'claymore', owner: s, team: s.team, pos: new THREE.Vector3(x, y + 0.18, z), fx, fz, arm: 1.2, mesh, st, beep: 0, ry: s.yaw };
    game.deployables.push(d);
    game.netEvent({ e: 'dep', id: d.id, ty: 'c', p: [x, y, z], ry: +s.yaw.toFixed(3), tm: s.team, w: 'claymore', by: s.id });
    return true;
  }
  if (st.kind === 'ammobox') {
    const mesh = ammoMesh();
    mesh.scale.setScalar(1.7);
    mesh.position.set(x, y, z);
    mesh.rotation.y = s.yaw;
    game.scene.add(mesh);
    const d = { id: ++game.pidN, type: 'ammo', owner: s, team: s.team, pos: new THREE.Vector3(x, y + 0.2, z), mesh, life: st.life || 30, tick: 0.5, st, ry: s.yaw };
    game.deployables.push(d);
    game.netEvent({ e: 'dep', id: d.id, ty: 'a', p: [x, y, z], ry: +s.yaw.toFixed(3), tm: s.team, w: 'ammobox', by: s.id });
    if (s.isPlayer) game.hud.toast($t('hud.t.ammoBox'), '#cfe6ff');
    return true;
  }
  return false;
}

// ── 12.208 C4 (aracın dibindeyse gövdesine yapışır, yoksa yere; 5 sn fünye, bip sıklaşır) · tanksavar mayını (yola; üstünden geçen düşman aracı) ──
function atMesh(type) { const m = createWeapon(type === 'c4' ? 'c4' : 'atmine'); m.scale.setScalar(type === 'c4' ? 2.2 : 2.4); return m; }
function placeAT(game, s, st, x, y, z, fx, fz) {
  const type = st.dep, V = game.vehicles;
  let veh = null, lo = null;
  if (type === 'c4' && V) {                                         // gövdeye en yakın araç (oyuncunun önünde / yanında, stick m içinde)
    let bd = st.stick;
    for (const v of V.list) {
      if (!v.alive || !v.st) continue;
      const L = toLocal2(v.st, s.pos.x + fx * 0.6, s.pos.z + fz * 0.6), d = v.def;
      const ex = Math.max(0, Math.abs(L.f) - d.hl), ez = Math.max(0, Math.abs(L.r) - d.hw);
      const dd = Math.hypot(ex, ez); if (dd < bd && s.pos.y < v.st.y + d.top + 1.5) { bd = dd; veh = v; }
    }
    if (veh) {                                                       // yapışma noktası: gövde kutusunun oyuncuya bakan yüzü (yüksekte duruyorsa üstü)
      const d = veh.def, L = toLocal2(veh.st, s.pos.x, s.pos.z);
      const top = s.pos.y > veh.st.y + d.top - 0.3;
      let f = Math.max(-d.hl, Math.min(d.hl, L.f)), r = Math.max(-d.hw, Math.min(d.hw, L.r));
      if (!top) { if (Math.abs(L.f) / d.hl > Math.abs(L.r) / d.hw) f = Math.sign(L.f) * (d.hl + 0.05); else r = Math.sign(L.r) * (d.hw + 0.05); }
      lo = [f, r, top ? d.top + 0.08 : Math.min(d.top * 0.6, 1.0)];
    }
  }
  if (type === 'atmine') { const mine = game.deployables.filter((d) => d.type === 'atmine' && d.owner === s); if (mine.length >= (st.max || 4)) removeDeployable(game, mine[0]); }
  const mesh = atMesh(type);
  game.scene.add(mesh);
  const d = { id: ++game.pidN, type, owner: s, team: s.team, pos: new THREE.Vector3(x, y + 0.05, z), mesh, st, ry: s.yaw, veh, lo, fuse: st.fuse || 0, arm: st.arm || 0, beep: 0 };
  atFollow(d);
  mesh.rotation.y = s.yaw;
  game.deployables.push(d);
  game.netEvent({ e: 'dep', id: d.id, ty: type === 'c4' ? 'k' : 'm', p: [d.pos.x, d.pos.y, d.pos.z], ry: +s.yaw.toFixed(3), tm: s.team, w: type, by: s.id, vi: veh ? veh.idx : -1, lo: lo ? lo.map((q) => +q.toFixed(2)) : null });
  if (s.isPlayer) game.hud.toast(type === 'c4' ? (veh ? 'C4 araca yapıştı · 5 sn' : 'C4 kuruldu · 5 sn') : 'Tanksavar mayını kuruldu', '#ffc94a');
  return true;
}
const _f = { x: 0, y: 0, z: 0 };
function atFollow(d) {                                               // araca yapışık C4 aracın gövdesiyle gider
  if (d.veh && d.lo) {
    if (!d.veh.alive || !d.veh.st) { d.veh = null; return; }
    toWorld(d.veh.st, d.lo[0], d.lo[1], d.lo[2], _f); d.pos.set(_f.x, _f.y, _f.z);
    d.mesh.rotation.y = d.veh.st.yaw;
  }
  d.mesh.position.copy(d.pos);
}
function atBoom(game, d, hitV) {
  const st = d.st, pos = d.pos.clone();
  if (d.type === 'c4') {
    if (d.veh?.alive) d.veh._lastZone = '';
    game.netEvent({ e: 'boom', k: 'x', p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)], r: st.radius, by: d.owner.id });
    game.explode(pos, st.radius, st.dmg, d.owner, st.name, undefined, 'at', null);
  } else {
    game.netEvent({ e: 'boom', k: 'x', p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)], r: 3, by: d.owner.id });
    game.effects.explosion(pos, 3.5); game.sfx.explosion(pos); game.effects.boomShake?.(pos, 0.7, 30); game.alertNear?.(pos, d.team, 90);
    if (hitV) { hitV._lastZone = 'b'; game.vehicles.damage(hitV, st.vehDmg, d.owner, 'at', st.name); }
    for (const e of game.soldiers) {
      if (!e.alive || e.veh || e.team === d.team) continue;
      const dist = e.center(_a).distanceTo(pos); if (dist > st.radius) continue;
      e.takeDamage(st.dmg * (1 - (dist / st.radius) ** 2), d.owner, 'body', pos, st.name);
    }
  }
  removeDeployable(game, d);
}
function atTick(game, d, dt) {
  atFollow(d);
  if (d.type === 'c4') {
    d.fuse -= dt; d.beep -= dt;
    if (d.beep <= 0) { d.beep = d.fuse > 2 ? 0.8 : d.fuse > 1 ? 0.35 : 0.15; game.sfx.beep(d.pos); }
    if (d.fuse <= 0) atBoom(game, d);
    return;
  }
  if (d.arm > 0) { d.arm -= dt; if (d.arm <= 0) game.sfx.beep(d.pos); return; }
  const V = game.vehicles; if (!V) return;
  for (const v of V.list) {
    if (!v.alive || !v.st || (v.def.heli && v.st.air)) continue;
    const tm = V.teamOf(v); if (!tm || tm === d.team || !v.seats.some(Boolean)) continue;      // boş / dost araç tetiklemez
    if (Math.abs(v.st.y - d.pos.y) > 1.5) continue;
    const L = toLocal2(v.st, d.pos.x, d.pos.z), t = d.st.trigger;
    if (Math.abs(L.f) < v.def.hl + t && Math.abs(L.r) < v.def.hw + t) { atBoom(game, d, v); return; }
  }
}

export function removeDeployable(game, d) {
  game.scene.remove(d.mesh);
  const i = game.deployables.indexOf(d);
  if (i >= 0) game.deployables.splice(i, 1);
  game.netEvent({ e: 'depx', id: d.id });
}

// Çevrimiçi istemci: sunucunun kurduğu nesneyi yalnızca görsel olarak oluştur / kaldır
export function netDeploy(game, ev) {
  const [x, y, z] = ev.p;
  let mesh;
  if (ev.ty === 'k' || ev.ty === 'm') {                               // 12.208 C4 / tanksavar mayını (araca yapışık C4 istemcide de aracı izler)
    const type = ev.ty === 'k' ? 'c4' : 'atmine', m = atMesh(type); m.rotation.y = ev.ry; game.scene.add(m);
    const d = { id: ev.id, type, team: ev.tm, mesh: m, pos: new THREE.Vector3(x, y, z), veh: ev.vi >= 0 ? game.vehicles?.list[ev.vi] : null, lo: ev.lo, net: true };
    atFollow(d); game.deployables.push(d); return;
  }
  if (ev.ty === 'c') { mesh = createWeapon('claymore'); mesh.scale.setScalar(2.2); mesh.position.set(x, y + 0.15, z); }
  else { mesh = ammoMesh(); mesh.scale.setScalar(1.7); mesh.position.set(x, y, z); }
  mesh.rotation.y = ev.ry;
  game.scene.add(mesh);
  game.deployables.push({ id: ev.id, type: ev.ty === 'c' ? 'claymore' : 'ammo', team: ev.tm, mesh, pos: new THREE.Vector3(x, y, z) });
}
export function netUndeploy(game, id) {
  const d = game.deployables.find((e) => e.id === id);
  if (d) removeDeployable(game, d);
}

function claymoreBlast(game, d) {
  const st = d.st, pos = d.pos, R = st.radius;
  game.netEvent({ e: 'boom', k: 'x', p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)], r: +(R * 0.7).toFixed(2), by: d.owner.id });
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
  game.effects.boomShake?.(pos, 0.6, 25);      // 12.199d
  removeDeployable(game, d);
}

export function updateGadgets(game, dt, T) {
  updateSmokes(game, dt, T);
  if (game.online) { for (const d of game.deployables) if (d.veh) atFollow(d); return; }               // çevrimiçi istemci: mayın/cephane mantığı sunucuda (araca yapışık C4 görüntüsü aracı izler)
  for (let i = game.deployables.length - 1; i >= 0; i--) {
    const d = game.deployables[i];
    if (!game.deployables.includes(d)) continue;
    if (d.type === 'c4' || d.type === 'atmine') { atTick(game, d, dt); continue; }
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
            else if (ws.kind === 'throwable' && it.mag < (ws.count || 1) && (s.nadeRef = (s.nadeRef || 0) + 1) % 4 === 0) { it.mag++; any = true; }   // 12.144: bomba her 4 tikte (6 sn) bir
          }
          if (any && s.isPlayer) { game.hud.toast($t('hud.t.ammo'), '#9be07a'); game.sfx.deploy(s.pos); }
          else if (any && s.human) game.netEvent({ e: 'ammo', v: s.id });
        }
      }
    }
  }
}
