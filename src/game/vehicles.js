import { VT, makeVehicle, stepVehicle, toWorld, toLocal2, obbBox, rayVehicle, packVehState, applyVehState, vehicleAtRest, groundAt } from '../sim/vehicle.js';
import { R as SR } from './collision.js';

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

export class Vehicles {
  // Haritada kullanılabilir araç doğuşu var mı (yoksa yönetici kurulmaz → diğer haritalarda davranış aynı)
  static wanted(game) { return !!(game.map.vehicles?.some((d) => VT[d.type]) && game.mode.type === 'conquest'); }

  constructor(game) {
    this.g = game;
    this.list = [];
    for (const d of game.map.vehicles) {
      if (!VT[d.type]) continue;
      const yaw = d.ry + Math.PI;                                     // veri: bakış (sin ry, cos ry) → asker yaw kuralı (−sin, −cos)
      const v = { idx: this.list.length, id: d.id, type: d.type, def: VT[d.type], spawn: { x: d.x, z: d.z, yaw, team: d.team },
        st: null, hp: 0, alive: false, wreck: false, seats: new Array(VT[d.type].seats).fill(null), team: null, paint: null,
        burn: false, deadT: 0, respawnT: 0, sunkT: 0, idleT: 0, lastHit: null, lastHitT: -99, lastDriver: null, lastDriverT: -99,
        lights: false, horn: false, sleep: false, sig: '', ramT: new Map(), pred: false, buf: [] };
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
      for (const o of this.list) if (o !== v && o.alive && Math.hypot(o.st.x - S.x, o.st.z - S.z) < 4.5) return false;
    }
    v.st = makeVehicle(v.type, S.x, groundAt(W, S.x, S.z, W.heightAt(S.x, S.z) + 1), S.z, S.yaw);
    stepVehicle(v.st, null, 1 / 60, W); stepVehicle(v.st, null, 1 / 60, W);      // zemine otur (eğim / yatış)
    v.st.vx = v.st.vz = v.st.vy = 0;
    v.hp = v.def.hp; v.alive = true; v.wreck = false; v.burn = false; v.deadT = 0; v.sunkT = 0; v.idleT = 0;
    v.team = team; v.paint = team; v.lights = false; v.horn = false; v.sleep = false; v.lastHit = null; v.lastDriver = null;
    v.seats.fill(null); v.spawnN = (v.spawnN || 0) + 1;
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
    if (s.seat === 0) s.ads = false;
  }

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
    s.veh = null; s.seat = -1; s.height = 1.78; s.eyeY = 1.62;
  }

  // İn: yan kapıdan (koltuğun tarafı), olmazsa öbür yan / arka / ön / üst. Hız aracın hızının yarısı, ilk iniş hasarsız
  exit(s) {
    const v = s.veh; if (!v) return false;
    const st = v.st, d = v.def, sp = d.seat[s.seat], side = Math.sign(sp[1]) || -1, W = this.g.world;
    const tries = [[sp[0], side * (d.hw + 0.62)], [sp[0], -side * (d.hw + 0.62)], [-(d.hl + 0.7), 0], [d.hl + 0.7, 0], [sp[0] - 0.6, side * (d.hw + 0.62)], [sp[0] + 0.6, side * (d.hw + 0.62)]];
    this.release(s);
    let ok = false;
    for (const [f, r] of tries) {
      const p = toWorld({ ...st, pitch: 0, roll: 0 }, f, r, 0, _p);
      s.pos.set(p.x, Math.max(st.y, W.heightAt(p.x, p.z)), p.z);
      W.settle(s);
      if (W.canStand(s) && Math.abs(s.pos.y - st.y) < 1.8 && !this.inside(s, 0.05)) { ok = true; break; }
    }
    if (!ok) { const p = toWorld(st, 0, 0, d.top + 0.05, _p); s.pos.set(p.x, p.y, p.z); }    // her yer kapalı: üstüne
    s.vel.set(st.vx * 0.5, Math.max(0, st.vy * 0.5), st.vz * 0.5);
    s.onGround = false; s.fallTop = s.pos.y; s.fallSafe = true;
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
    v.seats[n] = s; s.seat = n;
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
    if (st.hit > 9) this.damage(v, (st.hit - 9) * 14, v.lastHit && this.g.time - v.lastHitT < 6 ? v.lastHit : null, 'impact');
    if (st.land > 9) this.damage(v, (st.land - 9) * 12, null, 'impact');
  }

  // ── yetkili güncelleme (çevrimdışı / sunucu): Game.step, botlardan sonra ──
  update(dt) {
    const g = this.g;
    for (const v of this.list) {
      if (!v.alive) { this.deadTick(v, dt); continue; }
      // koltuktakiler: ölen / boşalan / sürücü koltuğundaki bot çıkar
      for (let i = 0; i < v.seats.length; i++) {
        const s = v.seats[i];
        if (!s) continue;
        if (!s.alive || s.vacant || s.veh !== v) { v.seats[i] = null; if (s.veh === v) { s.veh = null; s.seat = -1; } continue; }
        if (i === 0 && s.brain) this.exit(s);
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
  }

  deadTick(v, dt) {
    if (v.wreck) { v.deadT += dt; if (v.deadT >= v.def.wreck) { v.wreck = false; v.respawnT = v.def.respawn; } return; }
    if (!v.st && !v.spawnN) { this.trySpawn(v); return; }             // bayrak aracı: bayrak alınınca ilk doğuş
    v.respawnT -= dt;
    if (v.respawnT <= 0) this.trySpawn(v);
  }

  killerOf(v) { return v.lastHit && this.g.time - v.lastHitT < 15 ? v.lastHit : null; }

  // ── hasar ──
  // kind: 'bullet' (piyade silahı: × bulletMul) · 'blast' (patlama: × blastMul) · 'impact' (çarpma / iniş)
  damage(v, amount, attacker, kind = 'bullet', name) {
    if (!v.alive || !(amount > 0) || this.g.online) return;
    const d = v.def, a = amount * (kind === 'bullet' ? d.bulletMul : kind === 'blast' ? d.blastMul : 1);
    if (attacker && attacker.team !== this.teamOf(v)) { v.lastHit = attacker; v.lastHitT = this.g.time; }
    v.hp -= a; v.sleep = false;
    if (attacker && attacker !== this.driver(v) && attacker.isPlayer) this.g.emit('vehhit', { v, dmg: a, dead: v.hp <= 0 });
    else if (attacker?.human) this.g.netEvent({ e: 'vhm', by: attacker.id, i: v.idx, d: Math.round(a) });
    if (v.hp <= 0) this.destroy(v, attacker && attacker.team !== this.teamOf(v) ? attacker : this.killerOf(v), false, name);
  }

  // Patlama: aracın gövdesine en yakın noktaya uzaklıkla düşen hasar (duvar arkası değil: gövde merkezine açık hat)
  blast(pos, radius, dmg, owner, name) {
    if (this.g.online) return;
    for (const v of this.list) {
      if (!v.alive) continue;
      const L = toLocal2(v.st, pos.x, pos.z), d = v.def;
      const ex = Math.max(0, Math.abs(L.f) - d.hl), ez = Math.max(0, Math.abs(L.r) - d.hw), ey = Math.max(0, v.st.y - pos.y, pos.y - (v.st.y + d.top));
      const dist = Math.hypot(ex, ez, ey);
      if (dist > radius) continue;
      _p.x = v.st.x; _p.y = v.st.y + d.top * 0.6; _p.z = v.st.z;
      if (dist > 0.6 && !this.g.world.clear(pos, _p)) continue;
      this.damage(v, dmg * (1 - (dist / radius) ** 2), owner, 'blast', name);
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
    for (const s of occ) if (s.alive) { s.protT = 0; s.lastHit = killer || s; s.hp = 0; s.die(killer || s, wn, false); }
    // patlama: yakındaki askerler + araçlar (öldüren yoksa hasar yine de uygulanır, kimseye yazılmaz)
    const [R, D] = d.boom, o = { x: st.x, y: st.y + 0.8, z: st.z };
    g.effects.explosion?.(o, R); g.sfx.explosion?.(o);
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
        if (foe && sp >= d.ramMin) s.takeDamage((sp - d.ramMin + 1.2) * 16, drv || null, 'body', { x: st.x, y: st.y + 0.6, z: st.z }, d.name);
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
        if (dx * dx + dz * dz > 36 || Math.abs(A.y - B.y) > 2) continue;
        for (const ka of [-1, 1]) for (const kb of [-1, 1]) {
          const ra = a.def.hw + 0.05, rb = b.def.hw + 0.05, oa = (a.def.hl - ra) * ka, ob = (b.def.hl - rb) * kb;
          const ax = A.x - Math.sin(A.yaw) * oa, az = A.z - Math.cos(A.yaw) * oa, bx = B.x - Math.sin(B.yaw) * ob, bz = B.z - Math.cos(B.yaw) * ob;
          const ddx = bx - ax, ddz = bz - az, dd = Math.hypot(ddx, ddz), m = ra + rb;
          if (dd >= m || dd < 1e-4) continue;
          const nx = ddx / dd, nz = ddz / dd, pen = (m - dd) / 2;
          const wa = a.wreck || !a.alive ? 0 : 1, wb = b.wreck || !b.alive ? 0 : 1, sum = wa + wb || 1;
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
  raycast(o, d, maxT) {
    let best = null;
    for (const v of this.list) {
      if (!v.st || (!v.alive && !v.wreck)) continue;
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

  // İstemci: sunucunun 'vx' olayı (patladı / battı): efekt + ses + sarsıntı (durum anlık görüntüden gelir)
  netBoom(ev) {
    const v = this.list[ev.i], g = this.g;
    if (!v) return;
    const p = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
    if (!ev.q) {
      g.effects.explosion(p, v.def.boom[0]); g.sfx.explosion(p);
      const dc = Math.hypot(p.x - g.camera.position.x, p.y - g.camera.position.y, p.z - g.camera.position.z);
      g.effects.shake = Math.max(g.effects.shake, Math.max(0, Math.min(1, 1 - dc / 40)) * 1.2);
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
      if (v.pred || !v.buf.length) continue;
      const B = v.buf;
      let a = B[0], b = B[0];
      for (let i = 0; i < B.length; i++) { if (B[i].k <= rt) { a = B[i]; b = B[Math.min(i + 1, B.length - 1)]; } else break; }
      const t = b.k > a.k ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
      this.applyNetState(v, a.a, b.a, t, a === b && rt > a.k ? Math.min(extrap, (rt - a.k) / 60) : 0);
    }
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
