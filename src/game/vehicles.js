import { VT, makeVehicle, stepVehicle, toWorld, toLocal2, obbBox, rayVehicle, packVehState, applyVehState, vehicleAtRest, groundAt, gunPose, mgAt, seatGun, shellVel, shellAdvance, heFalloff, noseDir, mgPitch } from '../sim/vehicle.js';
import { dirFromAngles } from './util.js';
import * as THREE from 'three';
import { R as SR } from './collision.js';
import { TUNE } from './balance.js';
import { motoSpawnsFor } from '../maps/motoSpawns.js';                   // 12.204 arazi motosikleti doğuşları (haritanın araç listesine eklenir)
import { motoAfterStep } from './motorbike.js';

// ───── Araçlar (12.177) ─────
// Yönetici: haritanın araç doğuş verisinden (map.vehicles; yalnız VT'de tanımlı türler, yalnız Ele Geçirme) araçları kurar. YETKİLİ taraf (çevrimdışı
// oyun / sunucu): sürücüsüz aracın fiziği, hasar / yanma / patlama / batma, yeniden doğuş, yayaya çarpma, araç–araç itişmesi, koltuktakilerin
// yerleşimi. Sürücülü aracın fiziği GİRDİ GÜDÜMLÜDÜR (askerin hareketi gibi): her sürücü girdisi bir adım (Game.humanTick / Player.update →
// drive) → istemci tahmini sunucuyla birebir, hız hilesi yok. Çevrim içi istemci: araç durumu anlık görüntüden (yalnız değişen araçlar, 'vh'),
// uzaktakiler interpolasyonla, kendi sürdüğü araç tahminle (NetClient.reconcile). Görsel / ses / kamera: vehicleView.js (yalnız tarayıcı).
// Asker alanları: s.veh (araç) · s.seat (0 sürücü … 3). Koltuktaki askerin konumu = koltuk (gövdeye göre; vuruş kutusu oturuşa göre kısalır).
export const SEAT_DROP = 0.5, SEAT_EYE = 1.28, SEAT_H = 1.45;      // koltuk yüzeyi − bu = askerin "ayak" kotu; göz / vuruş kutusu boyu bu tabana göre
const ENTER_R = 2.2;                                               // gövde kenarına bu kadar yakın asker binebilir
const RAM_CD = 0.45;
const _p = { x: 0, y: 0, z: 0 }, _rv = {};
const F_ALIVE = 1, F_AIR = 2, F_BURN = 4, F_LIGHT = 8, F_HORN = 16, F_SUNK = 32, F_WRECK = 64;
export const VEH_FLAGS = { F_ALIVE, F_AIR, F_BURN, F_LIGHT, F_HORN, F_SUNK, F_WRECK };
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;

// 12.200 yönlü zırh (Battlefield: tank önden güçlü, yandan zayıf, arkadan (motor) en zayıf): patlama noktasının gövdeye göre yeri → def.armor çarpanı.
// Gövde: yerel f / r'nin gövde boyuna oranı (ön / yan / arka). Gövde tepesinin üstü: kule yüzü kendi yönüne göre (kule önü = ön, yanı / arkası = yan),
// kulenin üstü / güverte (helikopter roketi, havadan) = yan. 'at' (RPG, tank topu, roket) ve 'blast' (el bombası) aynı tabloyu kullanır.
const _ta = { x: 0, y: 0, z: 0 };
export function armorAt(v, pos) {
  const d = v.def, A = d.armor; if (!A) return 1;
  const st = v.st, tu = d.turret, up = pos.y - st.y;
  if (up > d.top - 0.15) {
    if (!tu || up > tu.y1 - 0.12) return A.s;
    const c = toWorld(st, tu.f, 0, 0, _ta), dx = pos.x - c.x, dz = pos.z - c.z, ty = st.tyaw ?? st.yaw;
    const f = -dx * Math.sin(ty) - dz * Math.cos(ty), r = dx * Math.cos(ty) - dz * Math.sin(ty);
    if (Math.abs(f) > tu.hl + 0.6 || Math.abs(r) > tu.hw + 0.6) return A.s;            // kulenin dışında güverte (üstten)
    return f > 0 && f / tu.hl > Math.abs(r) / tu.hw ? A.f : A.s;
  }
  const L = toLocal2(st, pos.x, pos.z), fn = L.f / d.hl, rn = Math.abs(L.r) / d.hw;
  if (rn > Math.abs(fn)) return A.s;
  return fn >= 0 ? A.f : A.r;
}

export class Vehicles {
  // Haritada kullanılabilir araç doğuşu var mı (yoksa yönetici kurulmaz → diğer haritalarda davranış aynı)
  static wanted(game) { return !!([...(game.map.vehicles || []), ...motoSpawnsFor(game.map)].some((d) => VT[d.type]) && game.mode.type === 'conquest'); }

  constructor(game) {
    this.g = game;
    this.list = []; this.shells = []; this.shellN = 0;
    for (const d of [...(game.map.vehicles || []), ...motoSpawnsFor(game.map)]) {      // 12.204: motorlar listenin sonunda (sıra sunucu = istemci)
      if (!VT[d.type]) continue;
      const yaw = d.ry + Math.PI;                                     // veri: bakış (sin ry, cos ry) → asker yaw kuralı (−sin, −cos)
      const v = { idx: this.list.length, id: d.id, type: d.type, def: VT[d.type], spawn: { x: d.x, z: d.z, yaw, team: d.team },
        st: null, hp: 0, alive: false, wreck: false, seats: new Array(VT[d.type].seats).fill(null), team: null, paint: null,
        burn: false, deadT: 0, respawnT: 0, sunkT: 0, idleT: 0, lastHit: null, lastHitT: -99, lastDriver: null, lastDriverT: -99,
        lights: false, horn: false, sleep: false, sig: '', ramT: new Map(), pred: false, buf: [], rl: 0 };
      this.list.push(v);
    }
    for (const v of this.list) if (!game.online) this.trySpawn(v, true);
  }

  // Doğuşun takımı: 'blue' / 'red' ya da 'flag:X' → bayrağın sahibi (sahipsizse araç yok)
  spawnTeam(v) {
    const t = v.spawn.team;
    if (t === 'blue' || t === 'red') return t;
    if (typeof t === 'string' && t.startsWith('flag:')) return this.g.mode.objectives.find((o) => o.id === t.slice(5))?.owner || null;
    return null;
  }

  trySpawn(v, first = false) {
    const team = this.spawnTeam(v);
    if (!team && v.spawn.team) return false;
    const S = v.spawn, W = this.g.world;
    if (!first) {                                                     // doğuş yeri dolu (asker / araç) → bekle
      for (const s of this.g.soldiers) if (s.alive && Math.hypot(s.pos.x - S.x, s.pos.z - S.z) < 3.2) return false;
      for (const o of this.list) if (o !== v && o.alive && Math.hypot(o.st.x - S.x, o.st.z - S.z) < (v.def.moto && o.def.moto ? 2.2 : 4.5)) return false;      // 12.204: motorlar yan yana (2,6 m) dizilir
    }
    v.st = makeVehicle(v.type, S.x, groundAt(W, S.x, S.z, W.heightAt(S.x, S.z) + 1), S.z, S.yaw);
    stepVehicle(v.st, null, 1 / 60, W); stepVehicle(v.st, null, 1 / 60, W);      // zemine otur (eğim / yatış)
    v.st.vx = v.st.vz = v.st.vy = 0;
    v.hp = v.def.hp; v.alive = true; v.wreck = false; v.burn = false; v.deadT = 0; v.sunkT = 0; v.idleT = 0;
    v.team = team; v.paint = team; v.lights = false; v.horn = false; v.sleep = false; v.lastHit = null; v.lastDriver = null; v.rl = 0; v.dmgLog = null; v.rk = v.def.rockets?.n; v.rkT = v.rkR = 0;
    v.seats.fill(null); v.spawnN = (v.spawnN || 0) + 1; v.spawnT = this.g.time;      // 12.200 spawnT: botların araç kapma beklemesi (vehicleBots.botMayTake)
    this.g.emit('vehspawn', v);
    return true;
  }

  get(i) { return this.list[i] || null; }
  driver(v) { return v.seats[0]; }
  occupants(v) { return v.seats.filter(Boolean); }
  speed(v) { return v.st ? Math.hypot(v.st.vx, v.st.vz) : 0; }
  teamOf(v) { const o = v.seats.find(Boolean); return o ? o.team : v.team; }

  // ── koltuk konumu ──
  seatPos(v, i, out = _p) { const sp = v.def.seat[i]; return toWorld(v.st, sp[0], sp[1], sp[2], out); }
  place(s) {
    const v = s.veh; if (!v || !v.st) return;
    const p = this.seatPos(v, s.seat);
    s.pos.set(p.x, p.y - SEAT_DROP, p.z);
    s.vel.set(v.st.vx, v.st.vy, v.st.vz);
    s.onGround = true; s.onCollider = false; s.fallTop = s.pos.y; s.landH = 0; s.fallSafe = true;
    s.crouching = false; s.prone = false; s.sprinting = false; s.leanDir = 0; s.leanOff.set(0, 0, 0); s.leanK = 0; s.leanT = 0;
    s.crouchT = 0; s.proneT = 0; s.height = SEAT_H; s.eyeY = SEAT_EYE;
    s.swim = false; s.under = false;                                    // 12.180: koltukta yüzme / nefes yok (araç batarsa yönetici indirir → yüzme konumdan başlar)
    if (s.seat === 0 && !v.def.cannon && !v.def.nose) s.ads = false;    // tank sürücüsü / 12.201 helikopter pilotu sağ tıkla yakınlaştırır (roket: Q / orta tık); jip sürücüsünde nişan yok
  }
  // koltuk gövdenin içinde mi (tank sürücüsü: görünmez, zırh arkasında; patlama sıçraması işlemez)
  hiddenSeat(s) { return !!(s.veh && s.veh.def.hidden?.[s.seat]); }

  // ── binme / inme ──
  // Askerin binebileceği en yakın araç + koltuk (yoksa null). Dolu araca yalnız aynı takım; sürücü koltuğu boşsa önce o
  near(s) {
    if (!s.alive || s.veh || s.def.zombie) return null;
    let best = null, bd = ENTER_R;
    for (const v of this.list) {
      if (!v.alive || !v.st || v.st.sunk) continue;
      const L = toLocal2(v.st, s.pos.x, s.pos.z), d = v.def;
      const ex = Math.max(0, Math.abs(L.f) - d.hl), ez = Math.max(0, Math.abs(L.r) - d.hw), dist = Math.hypot(ex, ez);
      if (dist > bd || Math.abs(s.pos.y - v.st.y) > 2.2) continue;
      const occ = this.occupants(v);
      if (occ.length && occ[0].team !== s.team) continue;
      const seat = v.seats[0] ? v.seats.findIndex((o) => !o) : 0;
      if (seat < 0) continue;
      best = { v, seat }; bd = dist;
    }
    return best;
  }

  toggle(s) {
    if (s.veh) return this.exit(s);
    const n = this.near(s);
    if (n) this.enter(s, n.v, n.seat);
    return !!n;
  }

  enter(s, v, seat) {
    if (v.seats[seat] || !v.alive) return false;
    if (s.veh) this.release(s);
    v.seats[seat] = s; s.veh = v; s.seat = seat;
    s.ads = false; s.adsT = 0;                                          // 12.201: piyadedeki nişan (4× vb.) araca taşınmaz; koltukta sağ tık aracın yakınlaştırması
    if (s.cook) s.cook = null;
    s.swing = null; s.useT = 0;
    if (seat === 0) { v.lastDriver = s; v.lastDriverT = this.g.time; v.team = s.team; if (!v.lights && (this.g.night || this.g.tod === 'sunset')) v.lights = true; }
    if (!this.occupants(v).some((o) => o !== s)) v.team = s.team;
    v.sleep = false; v.idleT = 0;
    this.place(s);
    this.g.emit('vehenter', { s, v, seat });
    return true;
  }

  release(s) {
    const v = s.veh; if (!v) return;
    if (v.seats[s.seat] === s) v.seats[s.seat] = null;
    if (s.seat === 0) { v.horn = false; v.sleep = false; }
    s.veh = null; s.seat = -1; s.height = 1.78; s.eyeY = 1.62; s.gunAim = null; s.ads = false; s.adsT = 0;      // 12.201: inince nişan temiz (aç-kapa nişan açık kalmasın)
  }

  // İn: yan kapıdan (koltuğun tarafı), olmazsa öbür yan / arka / ön / üst. Hız aracın hızının yarısı, ilk iniş hasarsız
  exit(s) {
    const v = s.veh; if (!v) return false;
    const st = v.st, d = v.def, sp = d.seat[s.seat], side = Math.sign(sp[1]) || -1, W = this.g.world;
    const tries = [[sp[0], side * (d.hw + 0.62)], [sp[0], -side * (d.hw + 0.62)], [-(d.hl + 0.7), 0], [d.hl + 0.7, 0], [sp[0] - 0.6, side * (d.hw + 0.62)], [sp[0] + 0.6, side * (d.hw + 0.62)]];
    this.release(s);
    let ok = false;
    const fly = d.heli && st.air && st.y - W.heightAt(st.x, st.z) > 2;      // 12.179 uçan helikopter: kapıdan boşluğa (zemine oturtulmaz → düşer)
    for (const [f, r] of fly ? tries.slice(0, 2) : tries) {
      const p = toWorld({ ...st, pitch: 0, roll: 0 }, f, r, 0, _p);
      if (fly) { s.pos.set(p.x, st.y + 0.3, p.z); if (W.canStand(s)) { ok = true; break; } continue; }
      s.pos.set(p.x, Math.max(st.y, W.heightAt(p.x, p.z)), p.z);
      W.settle(s);
      if (W.canStand(s) && Math.abs(s.pos.y - st.y) < 1.8 && !this.inside(s, 0.05)) { ok = true; break; }
    }
    if (!ok) { const p = toWorld(st, 0, 0, d.top + 0.05, _p); s.pos.set(p.x, p.y, p.z); }    // her yer kapalı: üstüne
    s.vel.set(st.vx * 0.5, Math.max(0, st.vy * 0.5), st.vz * 0.5);
    s.onGround = false; s.fallTop = s.pos.y; s.fallSafe = !(d.heli && st.air && st.y - W.heightAt(st.x, st.z) > 2);      // uçan helikopterden atlayan düşme hasarı alır
    s.height = 1.78;
    this.g.emit('vehexit', { s, v });
    return true;
  }

  seatTo(s, n) {
    const v = s.veh;
    if (!v || n < 0 || n >= v.seats.length || n === s.seat || v.seats[n]) return false;
    if (n === 0 && s.brain) return false;                              // botlar sürmez (12.177 aşama 1)
    v.seats[s.seat] = null;
    if (s.seat === 0) v.horn = false;
    v.seats[n] = s; s.seat = n; s.ads = false; s.adsT = 0;          // 12.201: koltuk değişince nişan temiz
    if (n === 0) { v.lastDriver = s; v.lastDriverT = this.g.time; v.team = s.team; }
    this.place(s);
    this.g.emit('vehseat', { s, v, seat: n });
    return true;
  }

  // Sürücü girdisiyle bir adım (yetkili tarafta + istemci tahmininde aynı). Hasar / çarpma yalnız yetkili tarafta
  drive(v, inp, dt) {
    if (!v.alive || !v.st) return;
    v.sleep = false;
    if (this.g.online) { const p = (v.p0 ||= {}), st = v.st; p.x = st.x; p.y = st.y; p.z = st.z; p.yaw = st.yaw; p.pitch = st.pitch; p.roll = st.roll; }   // görünüm ara değerlemesi (önceki adım)
    stepVehicle(v.st, inp, dt, this.g.world);
    if (!this.g.online) this.afterStep(v, dt);
  }

  // adım sonrası: çarpma / iniş hasarı (yetkili)
  afterStep(v, dt) {
    const st = v.st, d = v.def;
    if (d.moto) motoAfterStep(this, v);                              // 12.204 motor: sert kazada biniciler savrulur (hasardan önce: patlarsa içinde ölmesinler)
    const k = 1 / (d.mass || 1), hs = d.hitSafe ?? 9, ls = d.landSafe ?? 9;      // ağır araç (tank) çarpmadan az etkilenir · helikopter: düşük eşik, yüksek çarpan (sert iniş / rotor çarpması)
    if (st.hit > hs) this.damage(v, (st.hit - hs) * (d.hitMul ?? 14) * k, v.lastHit && this.g.time - v.lastHitT < 6 ? v.lastHit : null, 'impact');
    if (st.land > ls) this.damage(v, (st.land - ls) * (d.landMul ?? 12) * k, v.lastHit && this.g.time - v.lastHitT < 10 ? v.lastHit : null, 'impact');
  }

  // ── yetkili güncelleme (çevrimdışı / sunucu): Game.step, botlardan sonra ──
  update(dt) {
    const g = this.g;
    for (const v of this.list) {
      if (!v.alive) { this.deadTick(v, dt); continue; }
      // koltuktakiler: ölen / boşalan / sürücü koltuğundaki (sürücü olmayan) bot çıkar
      for (let i = 0; i < v.seats.length; i++) {
        const s = v.seats[i];
        if (!s) continue;
        if (!s.alive || s.vacant || s.veh !== v) { v.seats[i] = null; if (s.veh === v) { s.veh = null; s.seat = -1; } continue; }
        if (i === 0 && s.brain && !s.brain.vd) this.exit(s);                      // 12.189: kendi bindiği araçtaki bot sürücü kalır (vehicleBots.js)
      }
      const drv = v.seats[0];
      if (!drv) {
        v.horn = false;
        if (!v.sleep) { stepVehicle(v.st, null, dt, g.world); this.afterStep(v, dt); if (vehicleAtRest(v.st)) v.sleep = true; }
      }
      // takım: içindekilerin (yoksa doğuşun / son sürücünün)
      const occ = this.occupants(v);
      if (occ.length) v.team = occ[0].team;
      // batma: derin suda motor boğulur, içindekiler iner, birkaç sn sonra araç gider
      if (v.st.sunk) {
        v.sunkT += dt;
        if (v.sunkT > 0.6) for (const s of occ) this.exit(s);
        if (v.sunkT > 6) { this.destroy(v, null, true); continue; }
      }
      // yanma: can eşiğin altında → can erir → patlar
      v.burn = v.hp > 0 && v.hp < v.def.hp * v.def.burnAt;
      if (v.burn) { v.hp -= v.def.burnRate * dt; if (v.hp <= 0) { this.destroy(v, this.killerOf(v)); continue; } }
      // boş bırakılan araç: doğuşundan uzaktaysa (ya da savaş alanı dışında) bir süre sonra yenilenir
      const A = g.map.playArea, out = A && (v.st.x < A.minX || v.st.x > A.maxX || v.st.z < A.minZ || v.st.z > A.maxZ);
      if (!occ.length && (out || Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) > 25)) {
        v.idleT += dt;
        if (v.idleT > (out ? 15 : v.def.idleRespawn)) { this.destroy(v, null, true); continue; }
      } else v.idleT = 0;
      // sahipsiz bayrak aracı: hiç kullanılmamış (doğuşunda), bayrak el değiştirdiyse yeni sahibine boyanır
      if (!occ.length && !v.lastDriver && typeof v.spawn.team === 'string' && v.spawn.team.startsWith('flag:')) { const t = this.spawnTeam(v); if (t && t !== v.team) { v.team = t; v.paint = t; } }
      for (const s of occ) this.place(s);
    }
    this.collideVehicles();
    this.ramSoldiers(dt);
    for (const v of this.list) {
      if (v.rl > 0) v.rl = Math.max(0, v.rl - dt);
      if (v.rkT > 0) v.rkT = Math.max(0, v.rkT - dt);                       // 12.188 roket: atış arası / dolum
      if (v.rkR > 0 && (v.rkR = Math.max(0, v.rkR - dt)) <= 0) v.rk = v.def.rockets.n;
    }
    this.updateShells(dt);
  }

  deadTick(v, dt) {
    if (v.wreck && v.def.heli && v.st?.air) stepVehicle(v.st, null, dt, this.g.world);      // 12.179: havada patlayan helikopterin enkazı düşer
    if (v.wreck) { v.deadT += dt; if (v.deadT >= v.def.wreck) { v.wreck = false; v.respawnT = v.def.respawn; } return; }
    if (!v.st && !v.spawnN) { this.trySpawn(v); return; }             // bayrak aracı: bayrak alınınca ilk doğuş
    v.respawnT -= dt;
    if (v.respawnT <= 0) this.trySpawn(v);
  }

  killerOf(v) { return v.lastHit && this.g.time - v.lastHitT < 15 ? v.lastHit : null; }

  // ── hasar ──
  // kind: 'bullet' (piyade silahı: × bulletMul) · 'blast' (patlama, el bombası: × blastMul) · 'at' (tanksavar: RPG, tank topu: × atMul) · 'impact' (çarpma / iniş)
  // 12.188 dost ateşi (askerdeki kuralla aynı): takım arkadaşının mermisi / patlaması dost araca (boş dost araç dahil) işlemez; kendi
  // bindiği araca kendi patlaması × TUNE.selfBlast (dibindeki duvara top atan tankçı aracını hafif hırpalar). Çarpma / iniş hasarı hep işler.
  damage(v, amount, attacker, kind = 'bullet', name) {
    if (!v.alive || !(amount > 0) || this.g.online) return;
    const d = v.def, team = this.teamOf(v);
    let a = amount * (kind === 'bullet' ? d.bulletMul : kind === 'hmg' ? d.hmgMul ?? d.bulletMul : kind === 'blast' ? d.blastMul : kind === 'at' ? d.atMul ?? d.blastMul : 1);
    const mate = !!(attacker && kind !== 'impact' && !this.g.ffa && team && attacker.team === team);
    if (mate) { if (attacker.veh !== v || kind === 'bullet' || kind === 'hmg') return; a *= TUNE.selfBlast; }
    if (attacker && attacker !== this.driver(v) && attacker.isPlayer) this.g.emit('vehhit', { v, dmg: a, dead: v.hp - a <= 0, armor: a <= 0 });
    else if (attacker?.human && !mate) this.g.netEvent({ e: 'vhm', by: attacker.id, i: v.idx, d: Math.round(a) });
    if (!(a > 0)) return;                                                 // zırh: hasar yok (yalnız isabet geri bildirimi "zırh")
    const foe = !!(attacker && attacker.team !== team);
    if (foe) {
      v.lastHit = attacker; v.lastHitT = this.g.time;
      const log = (v.dmgLog ||= []), now = this.g.time;                 // 12.188 asist: araca hasar verenler, araç patlayınca içindekilerin ölümüne katkı sayılır
      log.push({ a: attacker, d: Math.min(a, v.hp), t: now });
      while (log.length > 32 || (log.length && now - log[0].t > 15)) log.shift();
    }
    v.hp -= a; v.sleep = false;
    if (v.hp <= 0) this.destroy(v, foe ? attacker : this.killerOf(v), false, name);
  }

  // Patlama: aracın gövdesine en yakın noktaya uzaklıkla düşen hasar (duvar arkası değil: gövde merkezine açık hat)
  // opt.vehInner (12.188 tank topu HE): gövdeden bu kadar içinde tam hasar, sonra heFalloff; yoksa eski (1 − (d/R)²). opt.n: yüzey normali (görüş çıkışı)
  blast(pos, radius, dmg, owner, name, kind = 'blast', opt = null) {
    if (this.g.online) return;
    const o = (this._bo ||= { x: 0, y: 0, z: 0 }); o.x = pos.x; o.y = pos.y; o.z = pos.z;
    if (opt?.n) { o.x += opt.n.x * 0.3; o.y += opt.n.y * 0.3; o.z += opt.n.z * 0.3; }
    for (const v of this.list) {
      if (!v.alive) continue;
      const L = toLocal2(v.st, pos.x, pos.z), d = v.def;
      const ex = Math.max(0, Math.abs(L.f) - d.hl), ez = Math.max(0, Math.abs(L.r) - d.hw), ey = Math.max(0, v.st.y - pos.y, pos.y - (v.st.y + d.top));
      const dist = Math.hypot(ex, ez, ey);
      if (dist > radius) continue;
      _p.x = v.st.x; _p.y = v.st.y + d.top * 0.6; _p.z = v.st.z;
      if (dist > 0.6 && !this.g.world.clear(o, _p)) continue;
      const f = opt?.vehInner != null ? heFalloff(dist, radius, opt.vehInner) : 1 - (dist / radius) ** 2;
      this.damage(v, dmg * f * (d.armor ? armorAt(v, pos) * (opt?.pierce || 1) : 1), owner, kind, name);
    }
  }

  // Yok et: patlama (ya da sessiz: battı / boş bırakıldı), içindekiler ölür, enkaz bir süre kalır, sonra yeniden doğuş sayacı
  destroy(v, killer, quiet = false, name) {
    if (!v.alive) return;
    const g = this.g, st = v.st, d = v.def;
    v.alive = false; v.hp = 0; v.burn = false; v.horn = false; v.deadT = 0;
    v.wreck = !quiet; v.respawnT = quiet ? d.respawn * 0.5 : d.respawn;
    const occ = this.occupants(v);
    for (const s of occ) this.release(s);
    v.seats.fill(null);
    g.netEvent({ e: 'vx', i: v.idx, p: [r2(st.x), r2(st.y + 0.8), r2(st.z)], q: quiet ? 1 : 0 });
    g.emit('vehboom', { v, quiet });
    if (quiet) { for (const s of occ) { /* battı: yolcular zaten indi */ } return; }
    const wn = name || d.name;
    // 12.188 asist: son 15 sn'de araca hasar veren (öldüren dışındaki) düşmanlar içindekilerin ölümüne katkı yazılır (aracın canına oranla askerin canı
    // kadar: araca %25+ hasar verdiysen asist; assist.js eşikleri aynı)
    const log = v.dmgLog || [];
    for (const s of occ) if (s.alive) {
      for (const e of log) if (e.a !== killer && e.a !== s) (s.dmgLog ||= []).push({ a: e.a, d: e.d / d.hp * (s.maxHp || 100), t: e.t });
      s.protT = 0; s.lastHit = killer || s; s.hp = 0; s.die(killer || s, wn, false); s.revivable = false;      // yanan araçta ölen canlandırılamaz
    }
    v.dmgLog = null;
    // patlama: yakındaki askerler + araçlar (öldüren yoksa hasar yine de uygulanır, kimseye yazılmaz)
    const [R, D] = d.boom, o = { x: st.x, y: st.y + 0.8, z: st.z };
    g.effects.explosion?.(o, R); g.sfx.explosion?.(o); g.effects.boomShake?.(o, 0.7, 35);      // 12.199d
    for (const s of g.soldiers) {
      if (!s.alive) continue;
      if (killer && s.team === killer.team && s !== killer) continue;
      const c = s.center(_cv), dist = Math.hypot(c.x - o.x, c.y - o.y, c.z - o.z);
      if (dist > R || !g.world.clear(o, c)) continue;
      s.takeDamage(D * (1 - (dist / R) ** 2), killer, 'body', o, wn);
    }
    this.blast(o, R, D * 0.6, killer, wn);
  }

  // ── yayaya çarpma + askeri gövdeden dışarı itme ──
  // Yaya, gövdenin (OBB) içine girmişse en kısa yönden dışarı itilir (her taraf, her askerde; istemci yerel oyuncu için de). Hızlı araç düşmana
  // (sürücüsüz yuvarlanan araçta son sürücünün düşmanına) çarparsa hasar + savrulma (yetkili); takım arkadaşı yalnız itilir.
  pushSoldier(s) {
    if (!s.alive || s.veh || s.fly) return;
    for (const v of this.list) {
      if (!v.st || (!v.alive && !v.wreck)) continue;
      const st = v.st, d = v.def;
      if (Math.abs(s.pos.x - st.x) > d.hl + 1.5 || Math.abs(s.pos.z - st.z) > d.hl + 1.5) continue;
      if (s.pos.y >= st.y + d.top - 0.05 || s.pos.y + s.height <= st.y + d.clear) continue;
      const L = toLocal2(st, s.pos.x, s.pos.z), pf = d.hl + SR - Math.abs(L.f), pr = d.hw + SR - Math.abs(L.r);
      if (pf <= 0 || pr <= 0) continue;
      const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
      if (pf < pr) { const k = (L.f > 0 ? 1 : -1) * (pf + 0.002); s.pos.x += fx * k; s.pos.z += fz * k; }
      else { const k = (L.r > 0 ? 1 : -1) * (pr + 0.002); s.pos.x += rx * k; s.pos.z += rz * k; }
    }
  }
  inside(s, pad = 0) {
    for (const v of this.list) {
      if (!v.st || (!v.alive && !v.wreck)) continue;
      const st = v.st, d = v.def;
      if (s.pos.y >= st.y + d.top || s.pos.y + 1.7 <= st.y) continue;
      const L = toLocal2(st, s.pos.x, s.pos.z);
      if (Math.abs(L.f) < d.hl + SR + pad && Math.abs(L.r) < d.hw + SR + pad) return v;
    }
    return null;
  }

  ramSoldiers(dt) {
    const g = this.g, now = g.time;
    for (const v of this.list) {
      if (!v.alive || v.sleep) continue;
      const sp = this.speed(v), d = v.def;
      if (sp < 2) continue;
      const st = v.st, drv = v.seats[0] || (now - v.lastDriverT < 4 ? v.lastDriver : null), team = drv ? drv.team : v.team;
      for (const s of g.soldiers) {
        if (!s.alive || s.veh || Math.abs(s.pos.x - st.x) > d.hl + 1.2 || Math.abs(s.pos.z - st.z) > d.hl + 1.2) continue;
        if (s.pos.y >= st.y + d.top || s.pos.y + s.height <= st.y + d.clear * 0.5) continue;
        const L = toLocal2(st, s.pos.x, s.pos.z);
        if (Math.abs(L.f) > d.hl + SR + 0.15 || Math.abs(L.r) > d.hw + SR + 0.15) continue;
        const t0 = v.ramT.get(s) || -9;
        if (now - t0 < RAM_CD) continue;
        v.ramT.set(s, now);
        const foe = g.ffa || s.team !== team;
        // savrulma: aracın hızının bir kısmı + biraz yukarı
        const k = foe ? 0.8 : 0.35;
        s.vel.x += st.vx * k; s.vel.z += st.vz * k; if (sp > 6) { s.vel.y = Math.max(s.vel.y, 2.2); s.onGround = false; }
        if (foe && sp >= d.ramMin) s.takeDamage((sp - d.ramMin + 1.2) * (d.ramMul || 16), drv || null, 'body', { x: st.x, y: st.y + 0.6, z: st.z }, d.name);
      }
    }
  }

  // araç ↔ araç: iki daire (ön / arka) yaklaşımıyla it, hızları paylaştır
  collideVehicles() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (!a.st || (!a.alive && !a.wreck)) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (!b.st || (!b.alive && !b.wreck)) continue;
        if (a.sleep && b.sleep) continue;
        const A = a.st, B = b.st, dx = B.x - A.x, dz = B.z - A.z;
        const R0 = a.def.hl + b.def.hl + 0.5;
        if (dx * dx + dz * dz > R0 * R0 || Math.abs(A.y - B.y) > 2.5) continue;
        for (const ka of [-1, 1]) for (const kb of [-1, 1]) {
          const ra = a.def.hw + 0.05, rb = b.def.hw + 0.05, oa = (a.def.hl - ra) * ka, ob = (b.def.hl - rb) * kb;
          const ax = A.x - Math.sin(A.yaw) * oa, az = A.z - Math.cos(A.yaw) * oa, bx = B.x - Math.sin(B.yaw) * ob, bz = B.z - Math.cos(B.yaw) * ob;
          const ddx = bx - ax, ddz = bz - az, dd = Math.hypot(ddx, ddz), m = ra + rb;
          if (dd >= m || dd < 1e-4) continue;
          const nx = ddx / dd, nz = ddz / dd, pen = (m - dd) / 2;
          const wa = a.wreck || !a.alive ? 0 : 1 / (a.def.mass || 1), wb = b.wreck || !b.alive ? 0 : 1 / (b.def.mass || 1), sum = wa + wb || 1;      // ağır araç az itilir (tank jipi iter)
          A.x -= nx * pen * 2 * wa / sum; A.z -= nz * pen * 2 * wa / sum; B.x += nx * pen * 2 * wb / sum; B.z += nz * pen * 2 * wb / sum;
          const rv = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
          if (rv < 0) { const imp = -rv * 0.6; A.vx -= nx * imp * wa / sum * 2; A.vz -= nz * imp * wa / sum * 2; B.vx += nx * imp * wb / sum * 2; B.vz += nz * imp * wb / sum * 2; if (-rv > 9 && !this.g.online) { this.damage(a, (-rv - 9) * 8, null, 'impact'); this.damage(b, (-rv - 9) * 8, null, 'impact'); } }
          a.sleep = b.sleep = false;
        }
      }
    }
  }

  // ── mermi / roket ışını ──
  // En yakın araç gövdesi (yoksa null): { t, v, normal, point }
  raycast(o, d, maxT, skip = null) {
    let best = null;
    for (const v of this.list) {
      if (!v.st || (!v.alive && !v.wreck) || v === skip) continue;
      const st = v.st, cx = st.x - o.x, cz = st.z - o.z, pr = cx * d.x + cz * d.z;
      if (pr < -5 || pr > maxT + 5) continue;
      if (cx * cx + cz * cz - pr * pr / Math.max(1e-6, d.x * d.x + d.z * d.z) > 16) continue;
      const t = rayVehicle(st, o, d, best ? best.t : maxT, _rv);
      if (t < 0 || (best && t >= best.t)) continue;
      const n = { x: 0, y: 0, z: 0 };                                  // yerel normal (x sağ, z geri) → yalnız yaw ile dünyaya (yatış / eğim küçük)
      if (_rv.ax === 1) n.y = _rv.sg; else { const lx = _rv.ax === 0 ? _rv.sg : 0, lz = _rv.ax === 2 ? _rv.sg : 0, c = Math.cos(st.yaw), sn = Math.sin(st.yaw); n.x = lx * c + lz * sn; n.z = -lx * sn + lz * c; }
      best = { t, v, normal: n, point: { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t } };
    }
    return best;
  }

  // ── 12.178 tank: ana top (patlayıcı mermi, düşüşlü yay) + kule makinelisi ──
  // Ateş YETKİLİ tarafta (çevrimdışı / sunucu): dolum dolmuşsa namlu ucundan mermi; 'ts' olayı istemcilerde aynı fizikle uçar (görsel), isabeti sunucu
  // belirler ('tsb' → patlama efekti). Mermi: yer çekimi grav, dünya + araç gövdesi + düşman askeri; isabette patlama (askere dmg, araca 'at').
  fireCannon(v, by) {
    const c = v.def.cannon;
    if (!c || !v.alive || !v.st || v.rl > 0 || this.g.online) return false;
    v.rl = c.reload;
    const o = { x: 0, y: 0, z: 0 }, d = { x: 0, y: 0, z: 0 };
    gunPose(v.st, o, d);
    // 12.188 namlu duvara / yamaca girmişse mermi namlunun değdiği yüzeyden çıkar (hemen patlar; duvarın arkasına top atılamaz)
    const tl = v.def.turret.len, piv = { x: o.x - d.x * tl, y: o.y - d.y * tl, z: o.z - d.z * tl }, bh = this.g.world.raycast(piv, d, tl, (this._bh ||= {}));
    if (bh) { const k = Math.max(0, bh.t - 0.12); o.x = piv.x + d.x * k; o.y = piv.y + d.y * k; o.z = piv.z + d.z * k; }
    const id = ++this.shellN, vel = shellVel(v.st, d, {});
    this.addShell({ id, v, by, x: o.x, y: o.y, z: o.z, vx: vel.vx, vy: vel.vy, vz: vel.vz, t: 0, auth: true });
    this.g.netEvent({ e: 'ts', id, i: v.idx, by: by ? by.id : -1, o: [r2(o.x), r2(o.y), r2(o.z)], d: [r2(vel.vx), r2(vel.vy), r2(vel.vz)] });
    by && (by.spottedT = this.g.time);
    this.g.alertNear?.(o, by?.team, 140);
    return true;
  }
  addShell(sh) { this.shells.push(sh); this.g.emit('vehfire', sh); }
  netShell(ev) {
    const v = this.list[ev.i]; if (!v) return;
    const w = ev.w === 1 ? v.def.rockets : null;
    this.addShell({ id: ev.id, v, w, by: this.g.soldiers[ev.by] || null, x: ev.o[0], y: ev.o[1], z: ev.o[2], vx: ev.d[0], vy: ev.d[1], vz: ev.d[2], t: 0, auth: false });
    if (!w) v.rl = v.def.cannon.reload;
  }
  netShellBoom(ev) {
    const i = this.shells.findIndex((x) => x.id === ev.id);
    if (i >= 0) this.shells.splice(i, 1);
    const v = this.list[ev.i], c = ev.w === 1 ? v?.def.rockets : (v || this.list.find((x) => x.def.cannon))?.def.cannon;
    const by = this.g.soldiers[ev.by] || this.g.playerSoldier;
    const n = ev.n ? new THREE.Vector3(ev.n[0], ev.n[1], ev.n[2]) : null;
    this.g.explode(new THREE.Vector3(ev.p[0], ev.p[1], ev.p[2]), c?.radius || 5, 0, by, '', undefined, 'at', { he: true, n });      // çevrim içi istemci: yalnız efekt / ses / sarsıntı / iz
  }

  // 12.188 merminin bu adımdaki (o → o + d·L) İLK isabeti: dünya (arazi + kutular: duvar, kum torbası, çit), araç gövdesi, düşman askeri (doğrudan),
  // ya da yakın geçiş (c.prox: gövde ekseninin bu kadar yakınından geçerse, askere açık hat varsa en yakın noktada patlar). Sunucu, istemci görseli
  // ve HUD nişangâhı aynı fonksiyonu kullanır. Dönen { t, n, k: 'w' | 'v' | 's' | 'p' } ya da null. skip: yok sayılan araç (atanın kendisi, ilk 0,3 sn)
  shellTrace(o, d, L, c, by, skip) {
    const g = this.g, W = g.world, out = (this._st ||= { t: 0, n: { x: 0, y: 0, z: 0 }, k: '' });
    let bt = L, k = '', nx = 0, ny = 1, nz = 0;
    const wh = W.raycast(o, d, L, (this._sw ||= {}));
    if (wh) { bt = wh.t; k = 'w'; nx = wh.normal.x; ny = wh.normal.y; nz = wh.normal.z; }
    const vr = this.raycast(o, d, bt, skip);
    if (vr && vr.t < bt) { bt = vr.t; k = 'v'; nx = vr.normal.x; ny = vr.normal.y; nz = vr.normal.z; }
    const dh = Math.hypot(d.x, d.z) || 1e-6, P = c.prox || 0;
    for (const e of g.soldiers) {
      if (!e.alive || e === by || (by && !g.ffa && e.team === by.team) || this.hiddenSeat(e)) continue;
      const ex = e.pos.x - o.x, ez = e.pos.z - o.z;
      if (Math.abs(ex) > L + P + 2 || Math.abs(ez) > L + P + 2) continue;
      const h = g.hitSoldier(e, o, d, bt);
      if (h && h.t < bt) { bt = h.t; k = 's'; nx = -d.x; ny = -d.y; nz = -d.z; continue; }
      if (!P) continue;
      // yakın geçiş: yatay düzlemde eksene en yakın an, o andaki dikey boşluk (ayaktan başın 0,25 m üstüne)
      const s = Math.max(0, Math.min(bt, (ex * d.x + ez * d.z) / (dh * dh)));
      const px = o.x + d.x * s - e.pos.x, pz = o.z + d.z * s - e.pos.z, py = o.y + d.y * s;
      const y0 = e.pos.y, y1 = e.pos.y + e.height + 0.25, vy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
      if (px * px + pz * pz + vy * vy > P * P || s >= bt) continue;
      const q = (this._sq ||= { x: 0, y: 0, z: 0 }); q.x = o.x + d.x * s; q.y = py; q.z = o.z + d.z * s;
      if (!W.clear(q, e.center(_cv))) continue;
      bt = s; k = 'p'; nx = -d.x; ny = -d.y; nz = -d.z;
    }
    if (!k) return null;
    out.t = bt; out.k = k; out.n.x = nx; out.n.y = ny; out.n.z = nz;
    return out;
  }

  updateShells(dt) {
    const g = this.g, W = g.world;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i], c = sh.w || sh.v.def.cannon;
      sh.t += dt;
      const o = (this._so ||= { x: 0, y: 0, z: 0 }); o.x = sh.x; o.y = sh.y; o.z = sh.z;
      shellAdvance(sh, dt, c.grav);
      const dx = sh.x - o.x, dy = sh.y - o.y, dz = sh.z - o.z, L = Math.hypot(dx, dy, dz) || 1e-6, d = (this._sd ||= { x: 0, y: 0, z: 0 });
      d.x = dx / L; d.y = dy / L; d.z = dz / L;
      // arazinin altında başlayan adım (namlu yamaçta / önceki adım yüzeyi kıl payı kaçırdı): yüzeyde patlar — eskiden mermi arazinin altından uçup gidiyordu
      const g0 = W.heightAt(o.x, o.z), g1 = W.heightAt(sh.x, sh.z);
      let h = o.y < g0 - 0.02 ? { t: 0, k: 'w', n: { x: 0, y: 1, z: 0 }, under: g0 } : this.shellTrace(o, d, L, c, sh.by, sh.t < 0.3 ? sh.v : null);
      if (!h && sh.y < g1 - 0.02) h = { t: L, k: 'w', n: { x: 0, y: 1, z: 0 }, under: g1 };
      if (h || sh.t > 6 || sh.y < -50) {
        const t = h ? h.t : L, back = !h ? 0 : h.k === 'w' || h.k === 'v' ? 0.15 : h.k === 's' ? 0.1 : 0;
        const p = { x: o.x + d.x * Math.max(0, t - back), y: o.y + d.y * Math.max(0, t - back), z: o.z + d.z * Math.max(0, t - back) };
        if (h?.under != null) p.y = Math.max(p.y, W.heightAt(p.x, p.z) + 0.05);
        const n = h ? { x: h.n.x, y: h.n.y, z: h.n.z } : { x: 0, y: 1, z: 0 };
        this.shells.splice(i, 1);
        if (!sh.auth) { sh.done = true; continue; }                      // istemci: patlamayı sunucunun 'tsb' olayı çizer
        g.netEvent({ e: 'tsb', id: sh.id, i: sh.v.idx, w: sh.w ? 1 : undefined, by: sh.by ? sh.by.id : -1, p: [r2(p.x), r2(p.y), r2(p.z)], n: [r2(n.x), r2(n.y), r2(n.z)] });
        const owner = sh.by || this.driver(sh.v);
        if (owner) g.explode(new THREE.Vector3(p.x, p.y, p.z), c.radius, c.dmg, owner, c.name, undefined, 'at', { he: true, inner: c.inner, vehInner: c.vehInner, n: new THREE.Vector3(n.x, n.y, n.z) });
        continue;
      }
    }
  }

  // 12.188 nişan yakınsaması (Battlefield 3 / 4 gibi: "mermi artının ortasına gider"): kamera ışınının çarptığı nokta P (dünya, araç, düşman asker; yoksa
  // 700 m) → kulenin hedef yaw'ı (kule ekseninden P'ye) + topun hedef açısı (namlu ucundan P'ye düşük yay balistik çözümü; namlu boyu için 3 yineleme).
  // Sürücü girdisinde bakış yerine yollanır (gy / gp); kule bu hedefe sınırlı hızla döner. Menzil dışı → 45°'ye (top sınırına takılır).
  gunAimFor(v, co, cd, by, out = {}) {
    const g = this.g, W = g.world, tu = v.def.turret, c = v.def.cannon;
    let t = 700;
    const wh = W.raycast(co, cd, t, (this._ga ||= {})); if (wh) t = wh.t;
    const vr = this.raycast(co, cd, t, v); if (vr && vr.t < t) t = vr.t;
    for (const e of g.soldiers) { if (!e.alive || e === by || (by && e.team === by.team) || e.veh === v) continue; const h = g.hitSoldier(e, co, cd, t); if (h && h.t < t) t = h.t; }
    const P = { x: co.x + cd.x * t, y: co.y + cd.y * t, z: co.z + cd.z * t };
    const pv = toWorld(v.st, tu.f, 0, tu.pivot, (this._gp ||= {}));
    const dx = P.x - pv.x, dz = P.z - pv.z, D0 = Math.hypot(dx, dz), h0 = P.y - pv.y, v2 = c.speed * c.speed, G = c.grav;
    let th = Math.atan2(h0, D0);
    for (let i = 0; i < 3; i++) {
      const D = Math.max(0.5, D0 - tu.len * Math.cos(th)), h = h0 - tu.len * Math.sin(th);
      const disc = v2 * v2 - G * (G * D * D + 2 * h * v2);
      th = disc < 0 ? Math.PI / 4 : Math.atan2(v2 - Math.sqrt(disc), G * D);
    }
    out.y = Math.atan2(-dx, -dz); out.p = th; out.P = P; out.dist = D0; out.hit = !!(wh || vr) || t < 700;      // dist: kuleden yatay menzil (HUD)
    return out;
  }

  // 12.188 HUD top nişangâhı: merminin şu an ateşlense ilk isabet noktası (aynı integral + aynı isabet / yakın geçiş kuralları; 4 sn'ye dek).
  // Dönen { p: {x,y,z}, k, dist } ya da null (havaya)
  predictShell(v, by, out = {}) {
    const c = v.def.cannon, o = { x: 0, y: 0, z: 0 }, d = { x: 0, y: 0, z: 0 };
    gunPose(v.st, o, d);
    const sh = { x: o.x, y: o.y, z: o.z, ...shellVel(v.st, d, {}) }, a = { x: 0, y: 0, z: 0 }, dd = { x: 0, y: 0, z: 0 }, h0 = 1 / 30;
    for (let k = 0; k < 120; k++) {
      a.x = sh.x; a.y = sh.y; a.z = sh.z;
      shellAdvance(sh, h0, c.grav);
      const dx = sh.x - a.x, dy = sh.y - a.y, dz = sh.z - a.z, L = Math.hypot(dx, dy, dz);
      dd.x = dx / L; dd.y = dy / L; dd.z = dz / L;
      const h = this.shellTrace(a, dd, L, c, by, v);
      if (h) { out.p = { x: a.x + dd.x * h.t, y: a.y + dd.y * h.t, z: a.z + dd.z * h.t }; out.k = h.k; out.dist = Math.hypot(out.p.x - o.x, out.p.z - o.z); return out; }
    }
    return null;
  }
  // 12.201 helikopter burun topunun hedefi (Battlefield: mermi artıya gider): kamera ışınının çarptığı nokta P (dünya, araç, düşman; yoksa 600 m)
  // → burun topu ağzından P'ye yaw / pitch. Pilot girdisinde gy / gp olarak yollanır: burun bu yöne eğilir / döner (stepHeli), top koni içinde tam
  // oraya (noseDir). Botlar hedefin noktasını doğrudan verir (noseAimAt).
  noseAimFor(v, co, cd, by, out = {}) {
    const g = this.g, W = g.world;
    let t = 600;
    const wh = W.raycast(co, cd, t, (this._na ||= {})); if (wh) t = wh.t;
    const vr = this.raycast(co, cd, t, v); if (vr && vr.t < t) t = vr.t;
    for (const e of g.soldiers) { if (!e.alive || e === by || (by && e.team === by.team) || e.veh === v) continue; const h = g.hitSoldier(e, co, cd, t); if (h && h.t < t) t = h.t; }
    return this.noseAimAt(v, { x: co.x + cd.x * t, y: co.y + cd.y * t, z: co.z + cd.z * t }, out, t < 600);
  }
  noseAimAt(v, P, out = {}, hit = true) {
    const M = v.def.nose, o = toWorld(v.st, M.f, 0, M.u, (this._nm ||= {})), dx = P.x - o.x, dy = P.y - o.y, dz = P.z - o.z;
    out.y = Math.atan2(-dx, -dz); out.p = Math.atan2(dy, Math.hypot(dx, dz)); out.P = P; out.dist = Math.hypot(dx, dy, dz); out.hit = hit;
    return out;
  }
  // 12.201 HUD roket işareti: şu an atılan roketin ilk isabet noktası (fireRocket ile aynı çıkış + aynı integral / isabet; 3 sn'ye dek) ya da null
  predictRocket(v, by, out = {}) {
    const R = v.def.rockets, st = v.st; if (!R || !st) return null;
    const pod = R.pods[0], o = toWorld(st, pod[0], 0, pod[2], { x: 0, y: 0, z: 0 }), d = dirFromAngles(st.yaw, (st.pitch || 0) + (R.dp || 0), (this._rd ||= new THREE.Vector3()));
    const sh = { x: o.x, y: o.y, z: o.z, vx: d.x * R.speed + st.vx, vy: d.y * R.speed + st.vy, vz: d.z * R.speed + st.vz }, a = { x: 0, y: 0, z: 0 }, dd = { x: 0, y: 0, z: 0 }, h0 = 1 / 30;
    for (let k = 0; k < 90; k++) {
      a.x = sh.x; a.y = sh.y; a.z = sh.z;
      shellAdvance(sh, h0, R.grav);
      const dx = sh.x - a.x, dy = sh.y - a.y, dz = sh.z - a.z, L = Math.hypot(dx, dy, dz);
      dd.x = dx / L; dd.y = dy / L; dd.z = dz / L;
      const h = this.shellTrace(a, dd, L, R, by, v);
      if (h) { out.p = { x: a.x + dd.x * h.t, y: a.y + dd.y * h.t, z: a.z + dd.z * h.t }; out.k = h.k; return out; }
    }
    return null;
  }
  // İstemci: kendi atış görseli olmayan istemcide mermi uçuşu (yetkili olmayan), adım başına
  clientShells(dt) { if (this.g.online) this.updateShells(dt); }

  // 12.188 koltuğun silahı ateşlenebilir mi: yay (kapı makinelisi), aşırı ısınma. HUD de bunu okur. Dönen: '' (hazır) · 'arc' (yay dışı) · 'hot' (aşırı ısındı)
  gunState(s) {
    const v = s.veh, M = v ? seatGun(v.def, s.seat) : null;
    if (!M) return '';
    if (s.vhot) return 'hot';
    if (M.arc) { const side = M.arc[s.seat], dy = ((s.yaw - (v.st.yaw - side * Math.PI / 2) + Math.PI * 3) % (Math.PI * 2)) - Math.PI; if (Math.abs(dy) > M.arcW) return 'arc'; }      // 12.179 kapı makinelisi: kapının yönünde yay (sol kapı −1 = yaw + 90°)
    return '';
  }

  // Araç makinelisi (nişancı koltukları + 12.188 helikopter pilotunun burun topu): basılı tutulunca rpm'de mermi; çıkış = nişancının gözü (kapak / kundak),
  // yön = bakış (yükseliş sınırında kırpılır) + sapma (tohumlu: istemci izi sunucuyla aynı). Sabit silah (M.fixed, burun topu): araç burnundan, burnun
  // yönünde (+ dp aşağı). Isınma (M.heat / atış, M.cool / sn soğuma): 1'de kilitlenir, 0,35'e inince açılır. Botlar için de aynı API: mgFire(asker, tetik, dt).
  mgFire(s, held, dt) {
    const v = s.veh, M = v ? seatGun(v.def, s.seat) : null;
    if (!M) return false;
    s.vcd = Math.max(0, (s.vcd || 0) - dt);
    if (M.heat && !(held && !s.vhot)) { s.vheat = Math.max(0, (s.vheat || 0) - M.cool * dt); if (s.vhot && s.vheat <= 0.35) s.vhot = false; }      // ateş ederken soğumaz
    if (!held || s.vcd > 0 || !v.alive || this.gunState(s)) return false;
    s.vcd = 60 / M.rpm;
    if (M.heat) { s.vheat = Math.min(1, (s.vheat || 0) + M.heat); if (s.vheat >= 1) s.vhot = true; }
    const g = this.g, rnd = g.paint.rngFor(s);
    let o, base, yaw;
    if (M.fixed) {                                                    // 12.201 burun topu: artının noktasına (s.gunAim) burnun koni sınırında
      const st = v.st, nd = noseDir(st, M, s.gunAim, (this._nd2 ||= {})); o = new THREE.Vector3(); toWorld(st, M.f, 0, M.u, o);
      yaw = nd.y; base = dirFromAngles(nd.y, nd.p);
    } else {
      o = s.eye(); yaw = s.yaw; base = dirFromAngles(s.yaw, mgPitch(v.st, M, s.yaw, s.pitch));      // 12.201 rel: sınır gövdeye göre (yokuşta aşağı)
    }
    const sp = M.hip + Math.min(this.speed(v) * 0.0008, 0.01) + (s.brain ? s.botExtraSpread : 0), a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * sp;
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const dd = base.clone(); dd.x += right.x * Math.cos(a) * rr; dd.z += right.z * Math.cos(a) * rr; dd.y += Math.sin(a) * rr; dd.normalize();
    const mz = M.fixed ? o.clone() : base.clone().multiplyScalar(M.mz?.[0] ?? 0.9).add(o); if (!M.fixed) mz.y -= M.mz?.[1] ?? 0.12;      // M.mz: namlu ağzı (gözden ileri, aşağı)
    g._firstPellet = true;
    g.shootRay(s, M.fixed ? o.clone() : o.clone().addScaledVector(base, 0.6), dd, M, mz, null);
    if (!g.headless) { g.effects.muzzle(mz, base); g.sfx.shot(M.sound, s.isPlayer ? null : s.pos); }
    s.flashT = 0.06; s.protT = 0; s.spottedT = g.time;
    if (s.isPlayer) g.emit('vehmg', s);
    return true;
  }

  // 12.188 helikopter roketleri (pilot; 12.201: Q / orta tık / telefonda ROKET, eskiden sağ tık): YETKİLİ tarafta (tank topu gibi 'ts' olayı, w: 1) — kapsüllerden sırayla, burnun yönünde; HE sıçrama
  // (shellTrace / explode ortak). v.rk kalan, v.rkT atış arası, v.rkR dolum (boşalınca R.reload sn). Botlar için: fireRocket(araç, pilot).
  fireRocket(v, by) {
    const R = v.def.rockets;
    if (!R || !v.alive || !v.st || this.g.online || (v.rkT || 0) > 0 || (v.rkR || 0) > 0) return false;
    if (v.rk == null) v.rk = R.n;
    if (v.rk <= 0) return false;
    const st = v.st, pod = R.pods[(R.n - v.rk) % R.pods.length], o = toWorld(st, pod[0], pod[1], pod[2], { x: 0, y: 0, z: 0 }), d = dirFromAngles(st.yaw, (st.pitch || 0) + (R.dp || 0));
    v.rk--; v.rkT = R.rate; if (v.rk <= 0) v.rkR = R.reload;
    const id = ++this.shellN, vel = { vx: d.x * R.speed + st.vx, vy: d.y * R.speed + st.vy, vz: d.z * R.speed + st.vz };
    this.addShell({ id, v, by, w: R, x: o.x, y: o.y, z: o.z, ...vel, t: 0, auth: true });
    this.g.netEvent({ e: 'ts', id, i: v.idx, w: 1, by: by ? by.id : -1, o: [r2(o.x), r2(o.y), r2(o.z)], d: [r2(vel.vx), r2(vel.vy), r2(vel.vz)] });
    by && (by.spottedT = this.g.time);
    this.g.alertNear?.(o, by?.team, 120);
    return true;
  }

  // 12.178 el bombası ↔ araç gövdesi: bu adımın yolunda gövde varsa hız yüzey normaline göre yansır (sekme 0,35, sürtünme 0,7), bomba yüzeyin dışına konur
  nadeBounce(p, h) {
    if (p.rest) return false;
    const sp = p.vel.length(); if (sp < 0.4) return false;
    const d = (this._nd ||= new THREE.Vector3()).copy(p.vel).multiplyScalar(1 / sp), r = this.raycast(p.pos, d, sp * h + 0.1);
    if (!r) return false;
    const n = r.normal, vn = p.vel.x * n.x + p.vel.y * n.y + p.vel.z * n.z;
    if (vn >= 0) return false;
    p.vel.x -= 1.35 * vn * n.x; p.vel.y -= 1.35 * vn * n.y; p.vel.z -= 1.35 * vn * n.z; p.vel.multiplyScalar(0.7);
    p.pos.set(r.point.x + n.x * 0.08, r.point.y + n.y * 0.08, r.point.z + n.z * 0.08);
    return true;
  }

  // İstemci: sunucunun 'vx' olayı (patladı / battı): efekt + ses + sarsıntı (durum anlık görüntüden gelir)
  netBoom(ev) {
    const v = this.list[ev.i], g = this.g;
    if (!v) return;
    const p = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
    if (!ev.q) {
      g.effects.explosion(p, v.def.boom[0]); g.sfx.explosion(p);
      g.effects.boomShake?.(p, 0.7, 35);      // 12.199d
    }
    g.emit('vehboom', { v, quiet: !!ev.q });
  }

  // ── ağ ──
  // Anlık görüntü listesi: değişen (ya da force) araçlar. [i, x, y, z, yaw, pitch, roll, vx, vy, vz, steer, hp, bayrak, gaz, takım]
  pack(force) {
    const out = [];
    for (const v of this.list) {
      const st = v.st;
      const fl = (v.alive ? F_ALIVE : 0) | (st?.air ? F_AIR : 0) | (v.burn ? F_BURN : 0) | (v.lights ? F_LIGHT : 0) | (v.horn ? F_HORN : 0) | (st?.sunk ? F_SUNK : 0) | (v.wreck ? F_WRECK : 0);
      const tm = v.paint === 'blue' ? 1 : v.paint === 'red' ? 2 : 0;
      const a = st ? [v.idx, r2(st.x), r2(st.y), r2(st.z), r3(st.yaw), r3(st.pitch), r3(st.roll), r2(st.vx), r2(st.vy), r2(st.vz), r3(st.steer), Math.round(v.hp), fl, r2(st.thr), tm] : [v.idx, 0, -999, 0, 0, 0, 0, 0, 0, 0, 0, 0, fl, 0, tm];
      if (st && v.def.turret) a.push(r3(st.tyaw), r3(st.gp), Math.ceil(v.rl * 10) / 10);      // 12.178 kule yaw, top açısı, dolum (sn)
      else if (st && v.def.heli) a.push(r2(st.rpm), v.rk ?? v.def.rockets?.n ?? 0, Math.ceil((v.rkR || 0) * 10) / 10);      // 12.188 roket (kalan, dolum sn) ·                        // 12.179 rotor devri
      else if (st && v.def.moto) a.push(r2(st.fall || 0), st.fallK || 0);            // 12.204 motor: devrik süresi + türü (yan yatış görünümü)
      const sig = a.join(',');
      if (!force && sig === v.sig) continue;
      v.sig = sig;
      out.push(a);
    }
    return out;
  }

  // İstemci: anlık görüntüdeki araç durumları (adım k) → araç başına tampon
  netSnap(k, list) {
    for (const a of list) {
      const v = this.list[a[0]]; if (!v) continue;
      v.buf.push({ k, a });
      if (v.buf.length > 24) v.buf.shift();
      v.hp = a[11]; v.paint = a[14] === 1 ? 'blue' : a[14] === 2 ? 'red' : null;
    }
  }

  // İstemci: gösterilen adımda (rt) durum ara değerlemesi. Tahmin edilen (kendi sürdüğüm) araç atlanır
  netInterp(rt, extrap = 0) {
    const me = this.g.playerSoldier;
    for (const v of this.list) {
      v.pred = !!(me && me.alive && me.veh === v && me.seat === 0);                 // tahmin yalnız canlı sürücünün kendi aracında (ölünce / inince hemen ağa döner)
      if (!v.buf.length) continue;
      if (v.pred) { this.predFlags(v, v.buf[v.buf.length - 1].a[12]); continue; }
      const B = v.buf;
      let a = B[0], b = B[0];
      for (let i = 0; i < B.length; i++) { if (B[i].k <= rt) { a = B[i]; b = B[Math.min(i + 1, B.length - 1)]; } else break; }
      const t = b.k > a.k ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
      this.applyNetState(v, a.a, b.a, t, a === b && rt > a.k ? Math.min(extrap, (rt - a.k) / 60) : 0);
    }
  }

  // 12.183: tahmin edilen (kendi sürdüğüm) aracın fiziği yerelde, ama yanma / enkaz / far YETKİLİ tarafın: en son anlık görüntüden. Eskiden hiç
  // uygulanmıyordu → sürücü kendi aracının yandığını görmüyordu ("ARAÇ YANIYOR — İN!" yok), gece binişte sunucunun yaktığı far sürücüde kapalı
  // görünüyor, F ters çalışıyordu. Far: F'ye basınca yerel tahmin 1 sn korunur (sunucu kenarı işleyene dek eski durum ezmesin)
  predFlags(v, fl) {
    v.burn = !!(fl & F_BURN); v.wreck = !!(fl & F_WRECK);
    if (!(performance.now() - (v.lightT || -1e9) < 1000)) v.lights = !!(fl & F_LIGHT);
  }

  applyNetState(v, A, B, t, ex) {
    const fl = A[12];
    const was = v.alive;
    v.alive = !!(fl & F_ALIVE); v.wreck = !!(fl & F_WRECK); v.burn = !!(fl & F_BURN); v.lights = !!(fl & F_LIGHT); v.horn = !!(fl & F_HORN);
    if (A[2] < -900) { v.st = null; return; }
    if (!v.st) v.st = makeVehicle(v.type, A[1], A[2], A[3], A[4]);
    const st = v.st, L = (i) => A[i] + (B[i] - A[i]) * t;
    const la = (x, y) => x + (((y - x + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;
    st.x = L(1) + A[7] * ex; st.y = L(2); st.z = L(3) + A[9] * ex; st.yaw = la(A[4], B[4]); st.pitch = L(5); st.roll = L(6);
    st.vx = A[7]; st.vy = A[8]; st.vz = A[9]; st.steer = L(10); st.thr = A[13]; st.air = !!(fl & F_AIR); st.sunk = !!(fl & F_SUNK);
    if (A.length > 15 && B.length > 15) { if (v.def.moto) { st.fall = A[15]; st.fallK = A[16]; } else if (v.def.turret) { st.tyaw = la(A[15], B[15]); st.gp = L(16); v.rl = A[17]; } else if (v.def.heli) { st.rpm = L(15); if (A.length > 16) { v.rk = A[16]; v.rkR = A[17]; } } }
    if (v.alive && !was) { v.spawnN = (v.spawnN || 0) + 1; this.g.emit('vehspawn', v); }
  }

  // İstemci: koltuktaki askerleri (yerel yolcu dahil) aracın gösterilen durumuna oturt; s.veh ağdan (packSoldier 'v') gelir
  placeAll() {
    for (const v of this.list) v.seats.fill(null);
    for (const s of this.g.soldiers) {
      if (!s.veh) continue;
      if (!s.alive || !s.veh.st) { s.veh = null; s.seat = -1; continue; }
      s.veh.seats[s.seat] = s;
      this.place(s);
    }
  }
}
const _cv = { x: 0, y: 0, z: 0 };
_cv.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };

export { packVehState, applyVehState, stepVehicle, VT };
