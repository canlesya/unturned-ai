import * as THREE from 'three';
import { DIFFICULTY, WSTATS } from './stats.js';
import { JUMP_SPEED } from '../sim/input.js';
import { clamp, rand, angleDiff, yawFromDir, lerp, pick } from './util.js';

// silah rolleri (bot davranışı)
const SNIPERS = new Set(['sniper', 'svd', 'barrett']);
const LMGS = new Set(['lmg', 'pkm']);
const SHOTGUNS = new Set(['shotgun', 'aa12', 'dbl']);

// Enfekte insan botları ayarları: crowd = aynı hedefe kilitli her ek kişi için isabet düşüşü · desync = yeni hedefte ek tepki gecikmesi (sn) · kite = bu mesafeden yakına gelen zombiden geri çekilir
export const INF_BOT = { crowd: 0.12, desync: 0.3, kite: 9, kiteBoss: 14, kiteSpeed: 0.8 };

const NOIT = { id: '', mag: 0, reserve: 0 };                       // Silah Yarışı'nda eşya listesi 2 yuvalı: olmayan yuva boş sayılır
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
    this.via = null; this.perching = false; this.perch = null;
  }

  // flaşbang yedi: soldier.blind() çağırır; hedef unutulur
  onFlashed(t) { this.target = null; this.reactT = 0.6; this.lostT = 0; }

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
    const nav = this.game.nav;
    if (nav.blocked[nav.idx(x, z)]) { const i = nav.nearestFree(x, z, 8); if (i >= 0) { x = nav.cx(i); z = nav.cz(i); } }      // hedef duvarın / kutunun içindeyse en yakın serbest noktaya al (yoksa bot orada boşuna bekler)
    this.goal = new THREE.Vector3(x, 0, z);
    this.goalT = time;
    this.path = null; this.repathT = 0;
  }

  // Mangal (squad) hedefi: Game.assignSquads belirler. Rol: keskin nişancı gözetleme noktası tutar, sıhhiye takım arkadaşını izler.
  pickGoal() {
    const g = this.game, s = this.s;
    const objs = g.mode.objectives;
    this.via = null;
    if (g.mode.infection) { this.huddle(); return; }      // Enfekte: insan botlar zombiye koşmaz, birbirine yakın durup birlikte savunur
    if (!objs.length) { this.roam(); return; }       // takım çatışması: haritada dolaş, düşmana yönel
    const sq = g.squadGoal(s);
    let obj = sq || null;
    if (!obj) {
      let bs = -1;
      for (const o of objs) {
        const d = Math.hypot(o.x - s.pos.x, o.z - s.pos.z);
        const sc = (o.owner === s.team ? 0.25 : 1) / (1 + d / 70) + Math.random() * 0.5;
        if (sc > bs) { bs = sc; obj = o; }
      }
    }
    if (!obj) return;
    if (s.cls === 'sniper' && g.perch) {
      const pp = g.perch(obj, s.team);
      if (pp) { this.setGoal(pp.x, pp.z, rand(25, 45)); this.perching = true; return; }
    }
    this.perching = false;
    if (s.cls === 'medic') {
      const c = g.nearestCorpse(s, 45);
      if (c) { this.setGoal(c.pos.x, c.pos.z, 7); return; }
    }
    if (s.cls === 'medic' && Math.random() < 0.5) {
      let mate = null, md = 1e9;
      for (const a of g.soldiers) {
        if (a === s || !a.alive || a.team !== s.team || a.cls === 'medic') continue;
        const d = Math.hypot(a.pos.x - s.pos.x, a.pos.z - s.pos.z);
        if (d < md && d < 45) { md = d; mate = a; }
      }
      if (mate) { this.setGoal(mate.pos.x + rand(-3, 3), mate.pos.z + rand(-3, 3), rand(5, 9)); return; }
    }
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * obj.r * 0.8;
    const gx = obj.x + Math.cos(a) * r, gz = obj.z + Math.sin(a) * r;
    this.setGoal(gx, gz, rand(14, 28));
    // yan kol: bazen ara nokta üzerinden dolan (kanat manevrası)
    if (Math.hypot(gx - s.pos.x, gz - s.pos.z) > 40 && Math.random() < 0.45) {
      const mx = (gx + s.pos.x) / 2, mz = (gz + s.pos.z) / 2;
      const dx = gx - s.pos.x, dz = gz - s.pos.z, L = Math.hypot(dx, dz);
      const side = Math.random() < 0.5 ? -1 : 1, off = rand(18, 34);
      const vx = mx + (-dz / L) * off * side, vz = mz + (dx / L) * off * side;
      const vi = g.nav.nearestFree(vx, vz, 10);
      if (vi >= 0) this.via = new THREE.Vector3(g.nav.cx(vi), 0, g.nav.cz(vi));
    }
  }

  // Aynı hedefe kilitli diğer bot sayısı (en çok 8)
  crowd(tg) {
    let n = 0;
    for (const b of this.game.brains) if (b !== this && b.target === tg && b.s.alive) n++;
    return Math.min(n, 8);
  }

  // Enfekte (insan botu): haritada yüksek savunma noktaları (map.perches: platform, konteyner kulesi, çatı...) varsa oraya çıkıp yüksekten savunur;
  // yoksa zombilerden uzak, diğer insanlara yakın noktalara hareket eder. Doluluk (cap) ve zombi baskısı yer seçimini etkiler.
  huddle() {
    const g = this.game, s = this.s;
    const mates = g.soldiers.filter((e) => e !== s && e.alive && e.team === s.team);
    const zs = g.soldiers.filter((e) => e.alive && e.team !== s.team);
    this.perching = false;
    const P = g.map.perches;
    if (P && P.length) {
      let best = null, bs = -1e9;
      for (const p of P) {
        const occ = mates.filter((m) => Math.hypot(m.pos.x - p.x, m.pos.z - p.z) < p.r && Math.abs(m.pos.y - p.y) < 1.8).length;
        let zn = 0;
        for (const e of zs) if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < p.r + 7) zn += e.boss ? 2 : 1;
        const sc = p.y * 2 + (occ >= (p.cap || 4) ? -30 : (p.cap || 4) - occ) * 3 - zn * 3.5 + (this.perch === p ? 7 : 0) - Math.hypot(p.x - s.pos.x, p.z - s.pos.z) * 0.05 + Math.random() * 6;
        if (sc > bs) { bs = sc; best = p; }
      }
      if (best) {
        this.perch = best;
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * best.r * 0.8;
          const x = best.x + Math.cos(a) * r, z = best.z + Math.sin(a) * r;
          if (!g.nav.isFree(x, z) || Math.abs(g.nav.floorAt(x, z) - best.y) > 0.4) continue;
          this.setGoal(x, z, rand(18, 32));
          return;
        }
        this.setGoal(best.x, best.z, rand(18, 32));
        return;
      }
    }
    let cx = s.pos.x, cz = s.pos.z;
    if (mates.length) { cx = 0; cz = 0; for (const m of mates) { cx += m.pos.x; cz += m.pos.z; } cx /= mates.length; cz /= mates.length; }
    const b = g.map.bounds;
    let bestG = null, bsg = -1e9;
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 45;
      const x = clamp(s.pos.x + Math.cos(a) * r, b.minX + 6, b.maxX - 6), z = clamp(s.pos.z + Math.sin(a) * r, b.minZ + 6, b.maxZ - 6);
      const fi = g.nav.nearestFree(x, z, 6);
      if (fi < 0) continue;
      const px = g.nav.cx(fi), pz = g.nav.cz(fi);
      let zd = 1e9;
      for (const e of zs) zd = Math.min(zd, Math.hypot(e.pos.x - px, e.pos.z - pz));
      const sc = Math.min(zd, 90) * 0.9 - Math.hypot(px - cx, pz - cz) * 0.35 + Math.random() * 14;       // zombiden uzak + gruba yakın
      if (sc > bsg) { bsg = sc; bestG = { x: px, z: pz }; }
    }
    if (bestG) this.setGoal(bestG.x, bestG.z, rand(10, 20));
    else this.roam();
  }

  roam() {
    const g = this.game, s = this.s;
    const foes = g.soldiers.filter((e) => e.alive && e.team !== s.team);
    const R = g.map.roamPoints;                                                    // harita dolaşma noktaları verirse (duvarlı / asimetrik haritalar): yarısı hat noktalarına
    if (R && Math.random() < 0.5) { const p = pick(R); this.setGoal(p[0] + rand(-4, 4), p[1] + rand(-4, 4), rand(8, 16)); return; }
    const t = foes.length && Math.random() < (R ? 0.5 : 0.7) ? pick(foes).pos : null;
    const b = g.map.bounds;
    const x = t ? t.x + rand(-12, 12) : rand(b.minX + 6, b.maxX - 6), z = t ? t.z + rand(-12, 12) : rand(b.minZ + 6, b.maxZ - 6);
    this.setGoal(x, z, rand(10, 20));
  }

  sense() {
    const g = this.game, s = this.s;
    const eye = s.eye(tA);
    const fwd = tB.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const alerted = g.time - this.alertT < 3;
    let best = null, bd = 1e9;
    for (const e of g.soldiers) {
      if (!e.alive || e.team === s.team || e.protT > 0.5) continue;
      if (e.cloaked && Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) > 6) continue;       // görünmez zombi yakına gelmeden fark edilmez
      const tc = e.center(tC);
      const dx = tc.x - eye.x, dz = tc.z - eye.z;
      const dist = Math.hypot(dx, dz);
      const vis = g.night ? (e.flashOn || e.flashT > 0 ? 130 : 62) : g.tod === 'sunset' ? 105 : 130;
      if (dist > vis * (g.visMul || 1)) continue;
      if (!alerted && (fwd.x * dx + fwd.z * dz) / (dist + 1e-6) < 0.3) continue;
      if (dist > 22 && e.crouching) { if (Math.random() < 0.3) continue; }
      if (!g.losClear(eye, tc)) continue;                  // duman görüşü de keser
      const sc = g.mode.infection ? dist + this.crowd(e) * 12 + Math.random() * 6 : dist;      // Enfekte: herkes aynı zombiyi seçmesin (yük dağılımı)
      if (sc < bd) { bd = sc; best = e; }
    }
    if (best) {
      if (best !== this.target) { this.target = best; this.reactT = rand(this.d.react[0], this.d.react[1]) + (g.mode.infection ? rand(0, INF_BOT.desync) : 0); this.aimFrac = rand(0.55, 0.85); }
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

  // Zombi botu özel gücü: türüne göre uygun anda kullanır
  useZAbility(dist, los, near) {
    const s = this.s, ab = s.ability;
    if (!ab || s.abT > 0 || s.abActive > 0) return;
    const id = ab.id;
    if (id === 'blink') { if (!near && dist > 16 && dist < 40 && Math.random() < 0.05) s.useAbility(); }
    else if (id === 'shadow') { if (dist > 9 && dist < 40 && Math.random() < 0.06) s.useAbility(); }          // boss: sık sıçrayıp görünmez yaklaşır          // uzaktan ışınlanarak yaklaşır
    else if (id === 'cloak') { if (dist > 10 && dist < 50 && Math.random() < 0.04) s.useAbility(); }
    else if (id === 'shield') { if ((dist < 14 && Math.random() < 0.05) || s.hp < s.maxHp * 0.6) s.useAbility(); }
    else if (dist < 28 && Math.random() < 0.04) s.useAbility();                                                    // öfke / atılış
  }

  // ── Zombi botu: en yakın insanı kovalar (yol bulma), yakına gelince pençeler. Silah/ateş mantığı yok. ──
  updateZombie(dt) {
    const s = this.s, g = this.game;
    this.t += dt; this.senseT -= dt;
    if (this.senseT <= 0) {
      this.senseT = 0.3 + Math.random() * 0.15;
      let best = null, bd = 1e9;
      for (const e of g.soldiers) {
        if (!e.alive || e.team === s.team || e.protT > 1) continue;
        const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
        if (d < bd) { bd = d; best = e; }
      }
      this.target = best; this.tDist = bd;
    }
    const tg = this.target && this.target.alive ? this.target : null;
    let moveX = 0, moveZ = 0, speed = 4.4 * s.spd * (s.stat.move || 1);
    s.ads = false; s.crouching = false; s.botExtraSpread = 0;
    if (s.blindT > 0 || g.graceLeft > 0) { if (s.blindT > 0) s.yaw += Math.sin(this.t * 2.2 + s.id) * dt * 1.4; s.vel.x *= 0.5; s.vel.z *= 0.5; return; }       // kör ya da hazırlık süresi: bekle
    if (tg) {
      const dx = tg.pos.x - s.pos.x, dz = tg.pos.z - s.pos.z, dist = Math.hypot(dx, dz);
      const eye = s.eye(tA), tc = tg.center(tC);
      const los = dist < 22 && g.losClear(eye, tc);
      const want = yawFromDir(dx, dz);
      const high = tg.pos.y - s.pos.y > 0.6;                          // hedef yüksekte (platform): düz koşma, rampa/basamaktan ya da sıçrayarak çık
      if (dist < 3.2 || (los && !high)) {
        // yakın / görüş açık: doğrudan saldır
        s.yaw += clamp(angleDiff(s.yaw, want), -9 * dt, 9 * dt);
        s.pitch += clamp(Math.atan2(tc.y - eye.y, dist) - s.pitch, -6 * dt, 6 * dt);
        if (dist > 1.5) { moveX = dx / (dist + 1e-6); moveZ = dz / (dist + 1e-6); }
        if (dist < 2.2 && Math.abs(angleDiff(s.yaw, want)) < 0.5) s.tryFire();
        this.path = null;
        this.useZAbility(dist, los, true);
        if (s.onGround && dist > 3 && dist < 14 && Math.random() < 0.012) { s.vel.y = JUMP_SPEED * s.jumpMul; s.onGround = false; }       // zombiler koşarken ara sıra yükseğe sıçrar
        if (s.onGround && high && dist < 4) { s.vel.y = JUMP_SPEED * s.jumpMul; s.onGround = false; }                                       // platformdaki hedefe sıçrayarak vurur
      } else {
        this.repathT -= dt;
        if ((!this.path || this.repathT <= 0) && g.pathBudget > 0) {
          g.pathBudget--;
          this.path = g.nav.findPath(s.pos.x, s.pos.z, tg.pos.x, tg.pos.z, 1.15);        // zombi 1.15 m basamağa kadar sıçrayarak çıkar
          this.repathT = rand(1.4, 2.6);
        }
        if (this.path && this.path.length) {
          let wp = this.path[0];
          while (this.path.length > 1 && Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z) < 0.9) { this.path.shift(); wp = this.path[0]; }
          const wd = Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z);
          moveX = (wp.x - s.pos.x) / (wd + 1e-6); moveZ = (wp.z - s.pos.z) / (wd + 1e-6);
          if (s.onGround && g.nav.floor && g.nav.floorAt(s.pos.x + moveX * 0.9, s.pos.z + moveZ * 0.9) - s.pos.y > 0.5) { s.vel.y = JUMP_SPEED * s.jumpMul; s.onGround = false; }      // önünde yüksek basamak: sıçra
          s.yaw += clamp(angleDiff(s.yaw, yawFromDir(moveX, moveZ)), -8 * dt, 8 * dt);
          s.pitch += (0 - s.pitch) * Math.min(1, dt * 4);
          this.useZAbility(dist, false, false);
        } else { moveX = dx / (dist + 1e-6); moveZ = dz / (dist + 1e-6); s.yaw += clamp(angleDiff(s.yaw, want), -6 * dt, 6 * dt); }
      }
      speed *= 1.5;                                          // zombiler hep koşar
    } else { speed = 0; }
    // takılma
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      if ((moveX || moveZ) && s.pos.distanceTo(this.stuckPos) < 0.35) { this.path = null; this.repathT = 0; }
      this.stuckT = 0; this.stuckPos.copy(s.pos);
    }
    for (const o of g.soldiers) {
      if (o === s || !o.alive || o.team !== s.team) continue;
      const dx = s.pos.x - o.pos.x, dz = s.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 1.1 && d2 > 1e-4) { const d = Math.sqrt(d2); moveX += (dx / d) * 0.7; moveZ += (dz / d) * 0.7; }
    }
    const ml = Math.hypot(moveX, moveZ), k = ml > 1 ? 1 / ml : 1, a = Math.min(1, dt * 10);
    if (s.swing) speed *= 0.55;                                // savururken yavaşlar
    s.vel.x = lerp(s.vel.x, moveX * k * speed, a);
    s.vel.z = lerp(s.vel.z, moveZ * k * speed, a);
    s.sprinting = speed > 5.5;
  }

  update(dt) {
    const s = this.s, g = this.game;
    if (!s.alive) return;
    if (s.def.zombie) { this.updateZombie(dt); return; }
    this.t += dt;
    this.senseT -= dt;
    if (this.senseT <= 0) { this.senseT = 0.2 + Math.random() * 0.08; this.sense(); }
    this.goalT -= dt;
    if (!this.goal || this.goalT <= 0) this.pickGoal();
    if (this.target && !this.target.alive) { this.target = null; this.lostT = 0; }

    // flaşbang: kör, şaşkın; hedefsiz, kısa süre dönüp durur
    if (s.blindT > 0) {
      this.target = null; this.burstLeft = 0; s.ads = false; s.sprinting = false; s.botExtraSpread = 0.1;
      s.yaw += Math.sin(this.t * 2.2 + s.id) * dt * 1.4;
      s.vel.x *= 0.85; s.vel.z *= 0.85;
      return;
    }

    const st = s.stat;
    const eye = s.eye(tA);
    let moveX = 0, moveZ = 0, speed = 4.4 * s.spd * (st.move || 1);
    let combat = false;

    // ── reload / silah yönetimi ──
    const it = s.item;
    if ((st.kind === 'gun' || st.kind === 'launcher') && it.mag <= 0 && s.reloadT <= 0) {
      if (it.reserve > 0) s.startReload();
      else if (s.cur === 0 && !g.mode.gungame && s.items[1].mag + s.items[1].reserve > 0) s.switchTo(1);
    }
    if (!this.target && (st.kind === 'gun') && it.mag < st.mag * 0.4 && it.reserve > 0 && s.reloadT <= 0) s.startReload();
    if (!this.target && s.cur !== 0 && s.items[0].mag + s.items[0].reserve > 0) s.switchTo(0);
    if (!this.target && s.items[2]?.id === 'medkit' && s.items[2].mag > 0 && s.useT <= 0 && s.cd <= 0) {
      const body = g.findRevivable(s);
      if (body) { s.useGadget('medkit'); }
    }
    if (!this.target && s.hp < 45 && s.items[2]?.id === 'medkit' && s.items[2].mag > 0) s.useGadget('medkit');

    if (this.target) {
      combat = true;
      const tg = this.target;
      const tp = tg.pos;
      const dx = tp.x - s.pos.x, dz = tp.z - s.pos.z;
      const dist = Math.hypot(dx, dz);
      // sniper yakında tabancaya geç
      const p0 = s.items[0].id;
      if (SNIPERS.has(p0) && p0 !== 'svd' && dist < 12 && s.cur === 0 && !g.mode.gungame) s.switchTo(1);
      else if (s.cur === 1 && SNIPERS.has(p0) && dist > 25) s.switchTo(0);
      // bıçak dövüşü: çok yakında ve silah işe yaramıyorsa (yükleniyor/boş/ağır) bıçağa geç, uzaklaşınca geri dön
      const gunBusy = s.cur === 0 && (s.reloadT > 0.5 || s.item.mag <= 0 || LMGS.has(p0) || SNIPERS.has(p0));
      if (g.mode.infection) { if (s.cur === 3) s.switchTo(0); }                                  // Enfekte: zombiye bıçakla değil silahla karşılık verilir
      else if (dist < 2.1 && s.cur !== 3 && (gunBusy || dist < 1.4) && s.items[3] && Math.random() < 0.08) s.switchTo(3);
      else if (s.cur === 3 && dist > 3.6) s.switchTo(0);

      const ty = tp.y + tg.height * this.aimFrac;
      const dy = ty - eye.y;
      const wantYaw = yawFromDir(dx, dz);
      let wantPitch = Math.atan2(dy, dist);
      if (dist > 35) wantPitch += dist * 0.0004;
      const turn = this.d.turn * (0.7 + Math.min(Math.abs(angleDiff(s.yaw, wantYaw)), 1.5));
      const dyaw = angleDiff(s.yaw, wantYaw);
      s.yaw += clamp(dyaw, -turn * dt, turn * dt);
      s.pitch += clamp(wantPitch - s.pitch, -turn * dt, turn * dt);
      s.ads = (dist > 28 || st.scope) && st.kind !== 'melee';

      this.reactT -= dt;
      const aimed = Math.abs(dyaw) < 0.07 + 2 / (dist + 8);
      s.botExtraSpread = this.d.err * (0.6 + dist / 45) * (this.reactT > -0.8 ? 1.8 : 1) * (g.mode.infection ? 1 + INF_BOT.crowd * this.crowd(tg) : 1);      // Enfekte: aynı hedefe çok kişi sıkarsa isabet düşer (herkesin aynı anda nişan alıp vurması engellenir)
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
        const gid = s.items[2]?.id;
        if ((gid === 'grenade' || gid === 'flash') && dist > (gid === 'flash' ? 6 : 9) && dist < 30) { s.pitch = Math.max(s.pitch, 0.18 + dist * 0.004); if (s.useGadget(gid)) this.gadgetT = rand(14, 25); }
        else if (gid === 'smoke' && s.hp < s.maxHp * 0.55 && dist > 8 && dist < 40) { s.pitch = Math.max(s.pitch, 0.25); if (s.useGadget('smoke')) this.gadgetT = rand(18, 30); }
        else if ((gid === 'rpg' || gid === 'm79') && dist > 14 && dist < (gid === 'rpg' ? 70 : 55) && Math.random() < 0.5) {
          if (gid === 'm79') s.pitch = Math.max(s.pitch, 0.0044 * dist);
          if (s.useGadget(gid)) this.gadgetT = rand(10, 16);
        }
        else this.gadgetT = 2;
      }

      // savaş hareketi
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = rand(0.7, 2.0); }
      const nx = dx / (dist + 1e-6), nz = dz / (dist + 1e-6);
      const pid = s.items[0].id;
      const holdRange = pid === 'sniper' || pid === 'barrett' ? 150 : pid === 'svd' ? 110 : LMGS.has(pid) ? 48 : 0;
      this.holdBudget = (this.holdBudget ?? 6) - dt;
      const holdPos = holdRange > 0 && dist < holdRange && dist > 14 && this.holdBudget > 0;
      if (this.holdBudget < -4) this.holdBudget = rand(5, 9);
      const kite = g.mode.infection && tg.def && tg.def.zombie && !(g.map.perches && s.pos.y > 0.8);      // platformdaki insan geri çekilmez, yüksekten ateş eder
      if (kite) {                                           // zombiye karşı: yaklaşınca geri çekilerek ateş et, uzaktayken yerinde dur
        s.crouching = false;
        if (dist < (tg.boss ? INF_BOT.kiteBoss : INF_BOT.kite)) { moveX = -nx + (-nz) * this.strafeDir * 0.25; moveZ = -nz + nx * this.strafeDir * 0.25; speed *= INF_BOT.kiteSpeed; }
        else { moveX = (-nz) * this.strafeDir * 0.4; moveZ = nx * this.strafeDir * 0.4; speed *= 0.45; }
      } else if (holdPos) { speed = 0; s.crouching = SNIPERS.has(pid); }
      else {
        s.crouching = false;
        let fwd = 0;
        const shotty = SHOTGUNS.has(pid);
        if (s.cur === 3 || st.kind === 'melee') fwd = dist > 1.3 ? 0.95 : 0;           // bıçakla yaklaş (Silah Yarışı son seviye de)
        else if (dist > (LMGS.has(pid) ? 40 : 28)) fwd = 0.7; else if (dist < 7 && !shotty) fwd = -0.6; else if (shotty && dist > 5) fwd = 0.9;
        moveX = nx * fwd + (-nz) * this.strafeDir * 0.55;
        moveZ = nz * fwd + (nx) * this.strafeDir * 0.55;
        speed *= 0.62;
      }
    } else {
      s.ads = false; s.crouching = false; s.botExtraSpread = 0;
      this.burstLeft = 0;
      // sakin anlarda mayın / cephane kutusu kur
      this.gadgetT -= dt * 0.5;
      if (this.gadgetT <= 0) {
        const gi = s.items[2] || NOIT;
        if (gi.id === 'claymore' && gi.mag > 0 && this.goal && Math.hypot(this.goal.x - s.pos.x, this.goal.z - s.pos.z) < 7) { if (s.useGadget('claymore')) this.gadgetT = rand(25, 50); else this.gadgetT = 3; }
        else if (gi.id === 'ammobox' && gi.mag > 0 && s.items[0].reserve < WSTATS[s.items[0].id].reserve * 0.5) { if (s.useGadget('ammobox')) this.gadgetT = rand(30, 60); else this.gadgetT = 3; }
        else this.gadgetT = 4;
      }
      s.pitch += (0 - s.pitch) * Math.min(1, dt * 4);
      // yol takibi
      if (this.goal) {
        if (this.via && Math.hypot(this.via.x - s.pos.x, this.via.z - s.pos.z) < 3.5) { this.via = null; this.path = null; this.repathT = 0; }
        const gd = Math.hypot(this.goal.x - s.pos.x, this.goal.z - s.pos.z);
        if (gd < 1.8 && !this.via) { this.holdT -= dt; if (this.holdT <= -0.01 && this.holdT > -5) { /* bekle */ } speed = 0; if (this.perching) { s.crouching = true; if (this.holdT <= 0) this.holdT = 3; } else if (this.holdT <= 0) { this.holdT = rand(2, 5); this.setGoal(this.goal.x + rand(-6, 6), this.goal.z + rand(-6, 6), 10); } }
        else {
          this.repathT -= dt;
          if (!this.path || this.repathT <= 0) {
            if (g.pathBudget > 0) {
              g.pathBudget--;
              const tgt = this.via || this.goal;
              this.path = g.nav.findPath(s.pos.x, s.pos.z, tgt.x, tgt.z);
              this.repathT = rand(2.5, 4);
              if (!this.path) { this.goal = null; this.via = null; }
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
    if (s.useT > 0) speed = 0;
    const wx = moveX * k * speed, wz = moveZ * k * speed;
    const a = Math.min(1, dt * 10);
    s.vel.x = lerp(s.vel.x, wx, a);
    s.vel.z = lerp(s.vel.z, wz, a);
    s.sprinting = !combat && speed > 5;
  }
}
