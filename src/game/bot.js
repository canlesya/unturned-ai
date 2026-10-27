import * as THREE from 'three';
import { DIFFICULTY, WSTATS } from './stats.js';
import { mgAt } from '../sim/vehicle.js';
import { TUNE } from './balance.js';
import { clamp, rand, angleDiff, yawFromDir, lerp, pick } from './util.js';
import { ballLead } from './paint.js';
import { aimNade } from './grenade.js';
import { tacRole, tacPickGoal, tacHold, tacAim, tacMayFire, tacFired, tacCombatMove, tacStrafeDir, tacHear, tacMateDown, tacOf } from './botTactics.js';
import { plTick, plPickGoal, plArrive, plAnchored, plTargetBias, plCombatMove, plStuck } from './payloadBots.js';
import { SWIM, waterYAt } from '../sim/swim.js';
import { frTick, frPickGoal, frArrive, frAnchored, frTargetBias, frCombatMove, frStuck, frDamaged } from './frontBots.js';     // 12.158 Cephe modu

// silah rolleri (bot davranışı)
const SNIPERS = new Set(['sniper', 'svd', 'barrett', 'ww_sniper']);
const LMGS = new Set(['lmg', 'pkm', 'ww_lmg', 'ww_mg']);
const isFrag = (id) => id === 'grenade' || WSTATS[id]?.gtype === 'frag' && WSTATS[id]?.kind === 'throwable';      // 12.158: saplı el bombası da
const SHOTGUNS = new Set(['shotgun', 'aa12', 'dbl']);
SNIPERS.add('railgun'); LMGS.add('elmg'); SHOTGUNS.add('scatter');      // 12.157 Uzay modu enerji silahları

// Enfekte insan botları ayarları: crowd = aynı hedefe kilitli her ek kişi için isabet düşüşü · desync = yeni hedefte ek tepki gecikmesi (sn) · kite = bu mesafeden yakına gelen zombiden geri çekilir
export const INF_BOT = { crowd: 0.12, desync: 0.3, kite: 9, kiteBoss: 14, kiteSpeed: 0.8 };

const NOIT = { id: '', mag: 0, reserve: 0 };                       // Silah Yarışı'nda eşya listesi 2 yuvalı: olmayan yuva boş sayılır
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
const AO = [0, 0, 0, 0];                                            // tacAim çıktısı

export class BotBrain {
  constructor(game, soldier, diffKey = 'normal') {
    this.game = game;
    this.s = soldier;
    this.d = DIFFICULTY[diffKey];
    this.dk = diffKey;                                               // zorluk anahtarı (botTactics.TACTICS davranış katmanı)
    soldier.brain = this;
    soldier.dmgMul = this.d.dmgMul;
    this.reset();
  }

  reset() {
    this.t = rand(0, 1);
    this.senseT = rand(0, 0.2);
    this.target = null; this.reactT = 0; this.lostT = 0; this.swimming = false; this.shore = null;
    this.lastKnown = null;
    this.goal = null; this.goalT = 0;
    this.path = null; this.repathT = 0;
    this.burstLeft = 0; this.burstPause = 0;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1; this.strafeT = rand(0.6, 1.6);
    this.alertT = -99; this.alertPos = null;
    this.stuckT = 0; this.stuckPos = new THREE.Vector3();
    this.gadgetT = rand(6, 14);
    this.nadeReady = (this.game.time || 0) + rand(6, 14); this.nadeSpot = null; this.pendNade = null;     // el bombası / flaş: kendi bekleme süresi (12.144)
    this.aimFrac = rand(0.55, 0.82);
    this.holdT = 0;
    this.via = null; this.perching = false; this.perch = null;
    this.role = undefined; this.spot = null; this.atSpot = false; this.aimTg = null; this.ambWait = 0; this.settleT = 0; this.settleNeed = null;     // 12.152 rol / mevzi / nişan (botTactics.js)
  }

  // flaşbang yedi: soldier.blind() çağırır; hedef unutulur
  onFlashed(t) { this.target = null; this.reactT = 0.6; this.lostT = 0; }

  // radius: sesin duyulma menzili (alertNear); zorluk menzili ölçekler, sese gitme olasılığı zorluğa / role göre (tacHear)
  hear(pos, radius) {
    const inv = this.game.mode.infection ? 0.25 : tacHear(this, pos, radius);
    if (inv < 0) return;
    this.alertT = this.game.time;
    this.alertPos = (this.alertPos || new THREE.Vector3()).copy(pos);
    if (!this.target && Math.random() < inv && this.goalT > 3 && !(this.game.payload && plAnchored(this)) && !(this.game.front && frAnchored(this))) this.setGoal(pos.x + rand(-6, 6), pos.z + rand(-6, 6), 8, pos.y);
  }

  onMateDown(victim, killer) { if (!this.s.def.zombie) tacMateDown(this, victim, killer); }

  onDamaged(attacker, fromPos) {
    this.alertT = this.game.time;
    if (this.game.front) frDamaged(this);                                         // Cephe: mevzideki bot vurulunca çömelir
    if (attacker && attacker.alive && (!this.target || Math.random() < 0.4)) {
      this.target = attacker; this.reactT = Math.min(this.reactT, rand(0.15, 0.35)); this.lostT = 0;
    }
  }

  // y: hedef kat (çok katlı yol bulmada hangi zemin: kale güvertesi / kule tepesi). Verilmezse botun kendi katı
  setGoal(x, z, time = 14, y) {
    const nav = this.game.nav;
    let gy = 0;
    if (nav.nearestNode) {                                                      // NavGridML: hedefi istenen kattaki en yakın yürünür düğüme al
      const n = nav.nearestNode(x, z, Number.isFinite(y) ? y : this.s.pos.y, 8);
      if (n >= 0) { const i = (n / nav.K) | 0; x = nav.cx(i); z = nav.cz(i); gy = nav.lf[n]; }
    } else if (nav.blocked[nav.idx(x, z)]) { const i = nav.nearestFree(x, z, 8); if (i >= 0) { x = nav.cx(i); z = nav.cz(i); } }      // hedef duvarın / kutunun içindeyse en yakın serbest noktaya al (yoksa bot orada boşuna bekler)
    this.goal = new THREE.Vector3(x, gy, z);
    this.goalT = time;
    this.path = null; this.repathT = 0;
  }

  // Mangal (squad) hedefi: Game.assignSquads belirler. Rol: keskin nişancı gözetleme noktası tutar, sıhhiye takım arkadaşını izler.
  pickGoal() {
    const g = this.game, s = this.s;
    const objs = g.mode.objectives;
    this.via = null;
    if (g.mode.infection) { this.huddle(); return; }      // Enfekte: insan botlar zombiye koşmaz, birbirine yakın durup birlikte savunur
    if (g.front) { frPickGoal(this); return; }            // Cephe: rol planı (frontBots.js): mevzi / nokta savunması · nokta saldırısı / kanat / nişancı
    if (g.payload) { plPickGoal(this); return; }          // Vagon: rol planı (payloadBots.js): eskort / öncü / yan · durdurucu / siper / yan
    if (tacPickGoal(this)) return;                       // 12.152: nişancı mevzisi / pusu noktası (botTactics.js)
    if (!objs.length) { this.roam(); return; }       // takım çatışması: haritada dolaş, düşmana yönel
    const sq = g.squadGoal(s);
    let obj = sq || null;
    if (!obj) {
      let bs = -1;
      for (const o of objs) {
        const d = Math.hypot(o.x - s.pos.x, o.z - s.pos.z);
        const sc = (o.owner === s.team ? 0.25 : 1) / (1 + d / (g.map.big ? 300 : 70)) + Math.random() * 0.5;
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
    const { x: gx, z: gz } = g.objPoint(obj, 0.8);                                   // 12.184 hedef kotunda (Baraj: tepe, alttaki kanyon değil)
    this.setGoal(gx, gz, g.map.big ? Math.max(rand(14, 28), Math.hypot(gx - s.pos.x, gz - s.pos.z) / 4.2 + 12) : rand(14, 28));   // 12.172 büyük harita: hedefe varacak kadar süre (yolun ortasında yeni hedef seçip gidip gelmesin)
    // yan kol: bazen ara nokta üzerinden dolan (kanat manevrası)
    if (Math.hypot(gx - s.pos.x, gz - s.pos.z) > 40 && Math.random() < (this.role === 'rusher' ? 0.7 : 0.45)) {
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
    if (R && Math.random() < (g.nav.nearestNode ? 0.65 : 0.5)) { const p = pick(R), j = p.length > 2 ? 1.5 : 4; this.setGoal(p[0] + rand(-j, j), p[1] + rand(-j, j), rand(8, 16), p[2]); return; }      // [x, z, y?]: katlı haritada kat noktası (küçük sapma)
    const t = foes.length && Math.random() < (R ? 0.5 : 0.7) ? pick(foes).pos : null;
    const b = g.map.bounds;
    const x = t ? t.x + rand(-12, 12) : rand(b.minX + 6, b.maxX - 6), z = t ? t.z + rand(-12, 12) : rand(b.minZ + 6, b.maxZ - 6);
    this.setGoal(x, z, rand(10, 20), t ? t.y : undefined);
  }

  // El bombası / flaş kararı (12.144): hedef 8–32 m (flaş 6–30) ve gerekçe varsa (kalabalık: hedefin 5 m yakınında başka düşman, hedef duruyor,
  // ya da %50 şans) aynı fizikle nişan (aimNade: yay engele çarpıp geri dönecekse ya da yanına düşecekse atmaz). Zorluk hatası kadar sapmalı hedef.
  // Bekleme: bot başına 16–28 sn, takım başına 3 sn (aynı anda iki bot bomba yağdırmaz). turn: önce dön (sakin anda), sonra at.
  // Saklanan düşman: görüşten çıktığında duruyorsa (siperde kamp) son görüldüğü yere (sense → nadeSpot, 4 sn içinde).
  tryNade(gid, tp, dist, tg, turn = false) {
    const g = this.game, s = this.s, it = s.items[2], st = WSTATS[gid];
    if (!it || it.id !== gid || it.mag <= 0 || !st) return false;
    if (dist < (gid === 'flash' ? 6 : 8) || dist > (gid === 'flash' ? 30 : 32)) return false;
    const tt = (g.nadeTeamT ||= {});
    if (g.time - (tt[s.team] ?? -99) < 3) return false;
    if (isFrag(gid) && tg) {
      let crowd = 0;
      for (const e of g.soldiers) if (e.alive && e !== tg && e.team === tg.team && Math.hypot(e.pos.x - tp.x, e.pos.z - tp.z) < 5) crowd++;
      const still = Math.hypot(tg.vel.x, tg.vel.z) < 1.5;
      if (!crowd && !still && Math.random() > 0.5) return false;
    }
    const e = this.d.err * 40, a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * e;
    tB.set(tp.x + Math.cos(a) * r, tp.y, tp.z + Math.sin(a) * r);
    const aim = aimNade(s, st, tB, g.world, gid === 'flash' ? 6 : 3.5);
    if (!aim) return false;
    tt[s.team] = g.time;
    this.nadeReady = g.time + rand(16, 28) * tacOf(this).nadeCd;
    if (turn && Math.abs(angleDiff(s.yaw, aim.yaw)) > 0.06) { this.pendNade = { gid, aim, t: 1.2 }; return true; }
    return this.throwNade(gid, aim);
  }

  throwNade(gid, aim) {
    const s = this.s;
    s.yaw = aim.yaw; s.pitch = aim.pitch; s.recoilP = 0;
    return s.useGadget(gid);
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
      const vis = g.night ? (e.flashOn || e.flashT > 0 ? TUNE.sightDay : TUNE.sightNight) : g.tod === 'sunset' ? TUNE.sightSunset : TUNE.sightDay;
      if (dist > vis * (g.visMul || 1)) continue;
      if (!alerted && (fwd.x * dx + fwd.z * dz) / (dist + 1e-6) < 0.3) continue;
      if (dist > 22 && e.crouching) { if (Math.random() < 0.3) continue; }
      let head = false;
      if (!g.botSees(eye, tc)) {                           // duman ve yaprak / çalı görüşü de keser (mermi geçer, bot görmez)
        if (!g.front) continue;
        tc.y = e.pos.y + e.height * 0.9;                   // 12.158 Cephe: gövde korkuluk / siper arkasında, baş görünüyorsa başa nişan (ateş basamağındaki düşman)
        if (!g.botSees(eye, tc)) continue;
        head = true;
      }
      const sc = g.mode.infection ? dist + this.crowd(e) * 12 + Math.random() * 6 : g.payload ? dist + plTargetBias(this, e) : g.front ? dist + frTargetBias(this, e) : dist;      // Vagon: vagonu iten / durduran düşman öne      // Enfekte: herkes aynı zombiyi seçmesin (yük dağılımı)
      if (sc < bd) { bd = sc; best = e; this._bHead = head; }
    }
    if (best) {
      this.frHead = !!this._bHead;
      if (best !== this.target) { this.target = best; this.reactT = rand(this.d.react[0], this.d.react[1]) * (this.atSpot && this.role === 'ambush' ? 0.7 : 1) + (g.mode.infection ? rand(0, INF_BOT.desync) : 0); this.aimFrac = rand(0.55, 0.85); this.ambWait = 0; }      // pusucu rotaya önceden nişanlı: daha çabuk
      this.lostT = 0;
      this.lastKnown = (this.lastKnown || new THREE.Vector3()).copy(best.pos);
    } else if (this.target) {
      this.lostT += 0.22;
      if (this.lostT > 0.5) {
        if (this.lastKnown && !(g.payload && plAnchored(this)) && !(g.front && frAnchored(this)) && !this.spot) this.setGoal(this.lastKnown.x, this.lastKnown.z, 6, this.lastKnown.y);
        if (this.lastKnown && this.target?.alive && Math.hypot(this.target.vel.x, this.target.vel.z) < 2) { this.nadeSpot = this.lastKnown.clone(); this.nadeSpotT = g.time; }   // siper arkasında durdu (kamp): oraya bomba düşünülebilir
        this.target = null;
      }
    }
  }

  // 12.177 araç (aşama 1: botlar SÜRMEZ, yalnız insan sürücünün aracına yolcu olur). Çatışmada değilken: yakındaki (≤ 18 m) takım arkadaşı insanın
  // sürdüğü yavaş araçta boş yolcu koltuğu varsa ona yürür ve biner; sürücü korna çalarsa 35 m'den gelir. Sürücü inerse / araç yanarsa / batarsa
  // ya da araç yola çıktıktan sonra 4 sn durursa (varış) iner.
  board() {
    const s = this.s, g = this.game, V = g.vehicles;
    if (this.target || s.hp < 30) return;
    let best = null, bd = 1e9;
    for (const v of V.list) {
      const drv = v.alive && v.st ? v.seats[0] : null;
      if (!drv || !drv.human && !drv.isPlayer || drv.team !== s.team || v.burn || v.st.sunk || (v.def.heli && v.st.air)) continue;      // helikoptere yalnız yerdeyken
      if (!v.seats.some((o, i) => i > 0 && !o)) continue;
      const d = Math.hypot(v.st.x - s.pos.x, v.st.z - s.pos.z), sp = V.speed(v);
      if ((d < 18 && sp < 3) || (v.horn && d < 35 && sp < 6)) if (d < bd) { bd = d; best = v; }
    }
    if (!best) { if (this.rideGoal) { this.rideGoal = null; this.rideTo = null; this.goalT = 0; } return; }
    if (bd < best.def.hl + 1.6 && Math.abs(s.pos.y - best.st.y) < 2) {             // kapıda: ilk boş yolcu koltuğuna
      const i = best.seats.findIndex((o, k) => k > 0 && !o);
      if (i > 0) { V.enter(s, best, i); this.rideGoal = null; this.rideTo = null; this.vstopT = 0; this.rodeMoved = false; this.target = null; }
      return;
    }
    const i = best.seats.findIndex((o, k) => k > 0 && !o), sp = best.def.seat[i], side = Math.sign(sp[1]) || 1;      // boş koltuğun kapısına (gövdenin içine yol aranmaz)
    const fx = -Math.sin(best.st.yaw), fz = -Math.cos(best.st.yaw), rx = Math.cos(best.st.yaw), rz = -Math.sin(best.st.yaw), r = side * (best.def.hw + 0.9);
    const gx = best.st.x + fx * sp[0] + rx * r, gz = best.st.z + fz * sp[0] + rz * r;
    this.rideGoal = best; this.rideTo = { x: gx, z: gz };
  }

  rideTick(dt) {
    const s = this.s, g = this.game, V = g.vehicles, v = s.veh, drv = v.seats[0];
    this.senseT -= dt;
    if (this.senseT <= 0) { this.senseT = 0.25 + Math.random() * 0.1; this.sense(); }
    if (this.target && !this.target.alive) this.target = null;
    const sp = V.speed(v);
    const flying = v.def.heli && v.st.air;                                      // 12.179: uçan helikopterden inilmez (yanıyor / pilotsuz olsa da: atlarsa düşer)
    if ((v.burn || v.st.sunk || !drv || !(drv.human || drv.isPlayer)) && !flying) { if (sp < 4 || v.burn || v.st.sunk) { V.exit(s); this.goalT = 0; } return; }
    if (sp > 3 || flying) this.rodeMoved = true;
    this.vstopT = sp < 0.8 && !flying ? (this.vstopT || 0) + dt : 0;
    if (this.vstopT > (this.rodeMoved ? 4 : 25)) { V.exit(s); this.vstopT = 0; this.rodeMoved = false; this.goalT = 0; return; }      // yola çıktıktan sonra 4 sn durdu = vardı (hiç kalkmadıysa 25 sn bekler)
    const st = s.stat, mg = !!mgAt(v.def, s.seat);                           // 12.178 tank nişancısı / 12.179 helikopter kapı nişancısı: makineli (cephane sınırsız)
    if (!mg && (st.kind === 'gun' || st.kind === 'launcher') && s.item.mag <= 0 && s.reloadT <= 0 && s.item.reserve > 0) s.startReload();
    if (!mg && st.kind !== 'gun') { if (s.items[0]?.mag + s.items[0]?.reserve > 0) s.switchTo(0); return; }
    let fire = false;
    if (this.target) {
      const tg = this.target, eye = s.eye(tA), tc = tg.center(tC);
      const dx = tc.x - eye.x, dz = tc.z - eye.z, dist = Math.hypot(dx, dz);
      const wantYaw = yawFromDir(dx, dz), wantPitch = Math.atan2(tc.y - eye.y, dist);
      const turn = this.d.turn * 0.8;
      const dyaw = angleDiff(s.yaw, wantYaw);
      s.yaw += clamp(dyaw, -turn * dt, turn * dt);
      s.pitch += clamp(wantPitch - s.pitch, -turn * dt, turn * dt);
      s.botExtraSpread = this.d.err * (0.9 + dist / 50) * (1 + Math.min(1, sp / 10));      // hareketli araçtan isabet düşer
      this.reactT -= dt;
      if (this.reactT <= 0 && Math.abs(dyaw) < 0.08 + 2 / (dist + 8)) {
        if (this.burstPause > 0) this.burstPause -= dt;
        else if (mg) { fire = true; if ((this.mgT = (this.mgT ?? rand(0.8, 1.6)) - dt) <= 0) { this.mgT = undefined; this.burstPause = rand(0.4, 1); } }
        else { if (this.burstLeft <= 0) this.burstLeft = Math.round(rand(this.d.burst[0], this.d.burst[1])); if (s.tryFire()) { this.burstLeft--; if (this.burstLeft <= 0) this.burstPause = rand(0.3, 0.9); } }
      }
    } else {
      s.botExtraSpread = 0; this.burstLeft = 0;
      const side = v.def.seat[s.seat][1] < 0 ? 1 : -1, arc = v.def.mg?.arc?.[s.seat], look = (arc ? v.st.yaw - arc * Math.PI / 2 : v.st.yaw + side * (s.seat >= 2 ? 1.2 : 0.7)) + Math.sin(g.time * 0.4 + s.id) * 0.4;   // koltuğun tarafına (dışarı) bakar · kapı nişancısı kapıdan
      s.yaw += clamp(angleDiff(s.yaw, look), -2 * dt, 2 * dt);
      s.pitch += (0 - s.pitch) * Math.min(1, dt * 3);
    }
    if (mg) V.mgFire(s, fire, dt);
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
    let moveX = 0, moveZ = 0, speed = TUNE.walkSpeed * s.spd * (s.stat.move || 1);
    s.ads = false; s.crouching = false; s.botExtraSpread = 0;
    if (s.blindT > 0 || g.graceLeft > 0) { if (s.blindT > 0) s.yaw += Math.sin(this.t * 2.2 + s.id) * dt * 1.4; s.vel.x *= 0.5; s.vel.z *= 0.5; return; }       // kör ya da hazırlık süresi: bekle
    if (tg) {
      const dx = tg.pos.x - s.pos.x, dz = tg.pos.z - s.pos.z, dist = Math.hypot(dx, dz);
      const eye = s.eye(tA), tc = tg.center(tC);
      const los = dist < 22 && g.botSees(eye, tc);
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
        if (s.onGround && dist > 3 && dist < 14 && Math.random() < 0.012) { s.vel.y = TUNE.jumpSpeed * s.jumpMul; s.onGround = false; }       // zombiler koşarken ara sıra yükseğe sıçrar
        if (s.onGround && high && dist < 4) { s.vel.y = TUNE.jumpSpeed * s.jumpMul; s.onGround = false; }                                       // platformdaki hedefe sıçrayarak vurur
      } else {
        this.repathT -= dt;
        if ((!this.path || this.repathT <= 0) && g.pathBudget > 0) {
          g.pathBudget--;
          this.path = g.nav.findPath(s.pos.x, s.pos.z, tg.pos.x, tg.pos.z, 1.15, s.pos.y);        // zombi 1.15 m basamağa kadar sıçrayarak çıkar
          this.repathT = rand(1.4, 2.6);
        }
        if (this.path && this.path.length) {
          let wp = this.path[0];
          while (this.path.length > 1 && Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z) < 0.9) { this.path.shift(); wp = this.path[0]; }
          const wd = Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z);
          moveX = (wp.x - s.pos.x) / (wd + 1e-6); moveZ = (wp.z - s.pos.z) / (wd + 1e-6);
          if (s.onGround && g.nav.floor && g.nav.floorAt(s.pos.x + moveX * 0.9, s.pos.z + moveZ * 0.9) - s.pos.y > 0.5) { s.vel.y = TUNE.jumpSpeed * s.jumpMul; s.onGround = false; }      // önünde yüksek basamak: sıçra
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

  // Hedefe yol takibi: [x, z, hız çarpanı] ya da null (hedef yok / yol bekleniyor). Sakin anda; katlı haritada çatışırken de (kat değiştirerek savaşır)
  followGoal(dt) {
    const s = this.s, g = this.game;
    if (!this.goal) return null;
    if (this.via && Math.hypot(this.via.x - s.pos.x, this.via.z - s.pos.z) < 3.5) { this.via = null; this.path = null; this.repathT = 0; }
    const gd = Math.hypot(this.goal.x - s.pos.x, this.goal.z - s.pos.z) + (g.nav.nearestNode ? Math.max(0, Math.abs(this.goal.y - s.pos.y) - 1.2) * 3 : 0);   // katlı: hedef katta değilse varılmış sayılmaz
    if (gd < 1.8 && !this.via) {
      this.holdT -= dt;
      if (this.perching) { if (this.spot) tacHold(this, dt); else { s.crouching = true; if (this.holdT <= 0) this.holdT = 3; } } else if (g.payload && this.plRole) plArrive(this); else if (g.front && this.frRole) frArrive(this, dt); else if (this.holdT <= 0) { this.holdT = rand(2, 5); if (g.nav.nearestNode && Math.random() < 0.6) this.pickGoal(); else this.setGoal(this.goal.x + rand(-6, 6), this.goal.z + rand(-6, 6), 10, this.goal.y); }      // katlı haritada yeni dolaşma noktası (kat değiştirsin)
      return [0, 0, 0];
    }
    this.repathT -= dt;
    if (!this.path || this.repathT <= 0) {
      if (g.pathBudget > 0) {
        g.pathBudget--;
        const tgt = this.via || this.goal;
        this.path = g.nav.findPath(s.pos.x, s.pos.z, tgt.x, tgt.z, 0.7, s.pos.y, tgt.y);
        if (this.path && g.nav.threadDoors) g.nav.threadDoors(this.path, s.pos.x, s.pos.z);      // 12.184 Kuzey Vadisi: kapıdan kapı ekseninde geç (pervaza takılma)
        this.repathT = rand(2.5, 4);
        if (!this.path) { this.goal = null; this.via = null; return null; }
        // 12.161 Cephe: hedef kapalı hücrede (ev duvarı içi vb.) ve en yakın boş hücre botun kendi hücresi → tek noktalı yol hemen düşer, bot HER ADIM yeniden ister ve
        // yol bütçesini (adım başına 1) tüketip sıradaki botları aç bırakırdı (maçın ortasında herkes donuyordu). Ulaşılamaz say, yeni hedef seçilsin.
        if (g.front && this.path.length === 1 && Math.hypot(this.path[0].x - s.pos.x, this.path[0].z - s.pos.z) < 0.6) { this.path = null; this.goal = null; this.via = null; return null; }
      }
    }
    if (!this.path || !this.path.length) return null;
    let wp = this.path[0];
    const off = (q) => (!g.nav.nearestNode ? 0 : Math.abs(q.y - s.pos.y) > 1.2 ? 9 : Math.abs(q.y - s.pos.y) > 0.2 ? 0.55 : 0);       // katlı: başka kattaki ara nokta (merdiven üstü) geçilmiş sayılmaz; basamak başı noktasına yakından varılır (yandan yüksek basamağa çarpmasın)
    // ara noktayı geçmiş say: 0,9 m içinde VE bir sonraki nokta buradan ızgarada görünüyorsa (kapı pervazı / köşe: görünmüyorsa noktaya 0,35 m'ye kadar yürür, köşeyi kesip pervaza sürtünmez)
    while (this.path.length > 1) {
      const dd = Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z) + off(wp);
      if (dd >= (wp.tight ? 0.4 : 0.9) || (dd > 0.35 && !g.nav.nearestNode && !g.nav.los(g.nav.idx(s.pos.x, s.pos.z), g.nav.idx(this.path[1].x, this.path[1].z)))) break;
      this.path.shift(); wp = this.path[0];
    }
    const wd = Math.hypot(wp.x - s.pos.x, wp.z - s.pos.z);
    if (wd + off(wp) < 0.6 && this.path.length === 1) { this.path = null; return null; }
    return [(wp.x - s.pos.x) / (wd + 1e-6), (wp.z - s.pos.z) / (wd + 1e-6), 1.35];
  }

  // 12.180 suya düşen bot: savaşmaz, en yakın kıyıya (yol ızgarasında açık, sığ hücre) ya da haritanın çıkış noktasına (baraj gölü merdiveni) yüzer,
  // kenara tutunup çıkar, sonra normal akışa döner. Botlar suya kendiliğinden girmez (yol ızgarası derin suyu kapalı sayar + adım koruması aşağıda).
  findShore() {
    const s = this.s, g = this.game, nav = g.nav, T = g.world.terrain, wy = s.wY > -1e9 ? s.wY : waterYAt(T, s.pos.x, s.pos.z);
    let best = null, bd = 1e18;
    for (const e of g.map.swimExits || []) { const d = Math.hypot(e[0] - s.pos.x, e[2] - s.pos.z); if (Math.abs(e[1] - wy) < 2 && d < bd) { bd = d; best = { x: e[0], z: e[2] }; } }
    const c = nav.cell, cx = Math.floor((s.pos.x - nav.minX) / c), cz = Math.floor((s.pos.z - nav.minZ) / c), R = Math.ceil(70 / c);
    for (let r = 1; r <= R; r++) {
      if ((r - 1) * c > bd) break;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const X = cx + dx, Z = cz + dz; if (X < 0 || Z < 0 || X >= nav.w || Z >= nav.h || nav.blocked[Z * nav.w + X]) continue;
        const x = nav.minX + (X + 0.5) * c, z = nav.minZ + (Z + 0.5) * c, h = T.heightAt(x, z);
        if (h < wy - 1.0 || h > wy + SWIM.climb + 1.5) continue;                          // köprü / baraj tabliyesi (altı derin su) ya da yüksek kıyı değil
        const d = Math.hypot(x - s.pos.x, z - s.pos.z); if (d < bd) { bd = d; best = { x, z }; }
      }
    }
    return best;
  }
  swimOut(dt) {
    const s = this.s, g = this.game;
    this.path = null; this.target = null; s.ads = false; s.sprinting = false; s.crouching = false; s.prone = false;
    if (!s.swim && (!this.shore || g.nav.isFree(s.pos.x, s.pos.z) || (s.wDepth || 0) < 0.25)) { this.shore = null; this.swimming = false; return false; }
    this.swimming = true;
    if (!this.shore || (this.shoreT -= dt) <= 0) { this.shore = this.findShore(); this.shoreT = 3; }
    let mx = 0, mz = 0;
    if (this.shore) {
      const dx = this.shore.x - s.pos.x, dz = this.shore.z - s.pos.z, d = Math.hypot(dx, dz) || 1;
      mx = dx / d; mz = dz / d;
      s.yaw += clamp(angleDiff(s.yaw, yawFromDir(mx, mz)), -4 * dt, 4 * dt);
    }
    s.pitch += (0 - s.pitch) * Math.min(1, dt * 3);
    const spd = s.swim ? SWIM.speed * (s.spd || 1) : TUNE.walkSpeed * 0.5, a = Math.min(1, dt * 4);
    s.vel.x = lerp(s.vel.x, mx * spd, a); s.vel.z = lerp(s.vel.z, mz * spd, a);
    return true;
  }

  update(dt) {
    const s = this.s, g = this.game;
    if (!s.alive) return;
    if ((s.swim || this.swimming) && this.swimOut(dt)) return;
    if (s.def.zombie) { this.updateZombie(dt); return; }
    if (s.veh) { this.rideTick(dt); return; }                                   // 12.177: yolcu bot (sürmez): yalnız nişan + ateş
    if (g.vehicles && (this.boardT = (this.boardT ?? rand(0, 0.3)) - dt) <= 0) { this.boardT = 0.3; this.board(); }
    if (this.rideGoal && this.rideTo && !this.target) {                     // araca doğrudan yürü (≤ 18 m: yol ızgarası araçları bilmez, 2 m hücrede kapı noktası kaba)
      const dx = this.rideTo.x - s.pos.x, dz = this.rideTo.z - s.pos.z, d = Math.hypot(dx, dz), k = Math.min(1, dt * 10), sp = d > 0.4 ? TUNE.walkSpeed * s.spd : 0;
      s.vel.x = lerp(s.vel.x, d > 0.4 ? dx / d * sp : 0, k); s.vel.z = lerp(s.vel.z, d > 0.4 ? dz / d * sp : 0, k);
      if (d > 0.4) s.yaw += clamp(angleDiff(s.yaw, yawFromDir(dx, dz)), -6 * dt, 6 * dt);
      s.sprinting = false; s.ads = false;
      return;
    }
    if (this.role === undefined) this.role = tacRole(this);
    if (this.atSpot && this.spot && Math.hypot(this.spot.x - s.pos.x, this.spot.z - s.pos.z) > 2.5) this.atSpot = false;
    this.t += dt;
    if (g.night) { this.torchT = this.target ? 0 : (this.torchT || 0) + dt; s.flashOn = this.torchT > 2.5; }      // 12.159: gece arama / dolaşmada fener açık (uzaktan görünür olur), çatışmada söner
    this.senseT -= dt;
    if (this.senseT <= 0) { this.senseT = 0.2 + Math.random() * 0.08; this.sense(); }
    this.goalT -= dt;
    if (g.front) frTick(this);                           // Cephe: takım rol planı (sektör değişince yeniden)
    if (g.payload) plTick(this);                         // Vagon: takım rol planı + bayat hedef (vagon uzaklaştı)
    if (!this.goal || this.goalT <= 0) { this.pickGoal(); if (this.retacT) { this.retacT = 0; this.goalT = Math.min(this.goalT, 2.5); } }     // mevzi verisi hazırlanıyor: kısa hedef, sonra yeniden
    if (g.pickups.list.length && (this.pkT = (this.pkT ?? rand(0, 1.5)) - dt) <= 0) {        // paintball: canı / cephanesi azsa yakındaki kutuya git (çatışma yokken)
      this.pkT = 1.5;
      const pk = !this.target && g.pickups.botWant(s);
      if (pk && (!this.goal || Math.hypot(this.goal.x - pk.x, this.goal.z - pk.z) > 1)) { this.setGoal(pk.x, pk.z, 12, pk.y); this.via = null; this.perching = false; }
    }
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
    let moveX = 0, moveZ = 0, speed = TUNE.walkSpeed * s.spd * (st.move || 1);
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

      const ty = tp.y + tg.height * (this.frHead ? 0.9 : this.aimFrac);      // Cephe: yalnız baş görünüyorsa başa
      const dy = ty - eye.y;
      const inf = g.mode.infection;
      if (!inf) tacAim(this, tg, dt, AO);                                     // 12.152 insani nişan: ilk hata + titreme + hareketli hedefi gecikmeli izleme
      const adx = inf ? dx : AO[2] - s.pos.x, adz = inf ? dz : AO[3] - s.pos.z;
      const wantYaw = yawFromDir(adx, adz) + (inf ? 0 : AO[0]);
      let wantPitch = Math.atan2(dy, Math.hypot(adx, adz)) + (inf ? 0 : AO[1]);
      if (dist > 35) wantPitch += dist * 0.0004;
      if (st.ball) wantPitch += ballLead(st, Math.hypot(dist, dy));                  // paintball: topun düşüşü kadar yukarı nişan
      const turn = this.d.turn * (0.7 + Math.min(Math.abs(angleDiff(s.yaw, wantYaw)), 1.5));
      const dyaw = angleDiff(s.yaw, wantYaw);
      s.yaw += clamp(dyaw, -turn * dt, turn * dt);
      s.pitch += clamp(wantPitch - s.pitch, -turn * dt, turn * dt);
      s.ads = (dist > 28 || st.scope) && st.kind !== 'melee';

      this.reactT -= dt;
      const aimed = Math.abs(dyaw) < 0.07 + 2 / (dist + 8);
      s.botExtraSpread = inf ? this.d.err * (0.6 + dist / 45) * (this.reactT > -0.8 ? 1.8 : 1) * (1 + INF_BOT.crowd * this.crowd(tg))
        : this.d.err * tacOf(this).spread * (0.6 + dist / 70) * (st.scope && s.adsT > 0.8 ? 0.6 : 1);      // nişan hatası artık açıda (tacAim); burada kalan küçük dağılma      // Enfekte: aynı hedefe çok kişi sıkarsa isabet düşer (herkesin aynı anda nişan alıp vurması engellenir)
      const may = inf || tacMayFire(this, tg, dist, aimed && this.reactT <= 0, dt);   // nişancı sabitlenir, pusucu yaklaştırır
      if (this.reactT <= 0 && aimed && may) {
        if (this.burstPause > 0) this.burstPause -= dt;
        else {
          if (this.burstLeft <= 0) this.burstLeft = Math.round(rand(this.d.burst[0], this.d.burst[1]));
          const fired = s.tryFire(st.kind === 'melee' && !!st.heavy && s.isBehind(tg));      // 12.194: bıçaklı bot hedefin arkasındaysa ağır vuruş (CS2)
          if (fired) {
            this.burstLeft--;
            if (!inf) tacFired(this);
            if (this.burstLeft <= 0) this.burstPause = rand(0.25, 0.9) * (st.auto ? 1 : 0.3);
          }
        }
      }
      // gadget
      this.gadgetT -= dt;
      if (this.gadgetT <= 0 && this.reactT <= 0) {
        const gid = s.items[2]?.id;
        if (isFrag(gid) || gid === 'flash') this.gadgetT = 2;                                  // el bombası / flaş: aşağıda (tryNade, kendi bekleme süresi)
        else if (gid === 'smoke' && s.hp < s.maxHp * 0.55 && dist > 8 && dist < 40) { s.pitch = Math.max(s.pitch, 0.25); if (s.useGadget('smoke')) this.gadgetT = rand(18, 30); }
        else if ((gid === 'rpg' || gid === 'm79') && dist > 14 && dist < (gid === 'rpg' ? 70 : 55) && Math.random() < 0.5) {
          if (gid === 'm79') s.pitch = Math.max(s.pitch, 0.0044 * dist);
          if (s.useGadget(gid)) this.gadgetT = rand(10, 16);
        }
        else this.gadgetT = 2;
      }

      { const gid = s.items[2]?.id; if ((isFrag(gid) || gid === 'flash') && this.reactT <= 0 && g.time >= this.nadeReady && !this.tryNade(gid, tp, dist, tg)) this.nadeReady = g.time + rand(1.5, 3); }
      // savaş hareketi
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeDir = tacStrafeDir(this, tg, -this.strafeDir); this.strafeT = rand(0.7, 2.0); }
      const nx = dx / (dist + 1e-6), nz = dz / (dist + 1e-6);
      const pid = s.items[0].id;
      const holdRange = pid === 'sniper' || pid === 'barrett' || pid === 'railgun' || pid === 'ww_sniper' ? 150 : pid === 'svd' ? 110 : LMGS.has(pid) ? 48 : 0;
      this.holdBudget = (this.holdBudget ?? 6) - dt;
      const holdPos = holdRange > 0 && dist < holdRange && dist > 14 && this.holdBudget > 0;
      if (this.holdBudget < -4) this.holdBudget = rand(5, 9);
      const kite = g.mode.infection && tg.def && tg.def.zombie && !(g.map.perches && s.pos.y > 0.8);      // platformdaki insan geri çekilmez, yüksekten ateş eder
      s.crouching = false;
      const plm = g.payload && !kite ? plCombatMove(this, dt, nx, nz) : g.front && !kite ? frCombatMove(this, dt, nx, nz) : null;      // Cephe: mevzideki bot yerinden kopmaz, çömel-kalk      // Vagon: eskort / durdurucu yarıçaptan, siperdeki siperinden kopmaz
      const tcm = !plm && !kite && !inf && s.cur !== 3 && st.kind !== 'melee' ? tacCombatMove(this, dist, tg) : null;      // 12.152 rol: nişancı / pusucu yerinde, taarruzcu yaklaşır, canı az geri çekilir
      if (plm) { moveX = plm[0]; moveZ = plm[1]; speed *= plm[2]; }
      else if (tcm) { moveX = nx * tcm[0] + (-nz) * this.strafeDir * tcm[1]; moveZ = nz * tcm[0] + nx * this.strafeDir * tcm[1]; speed *= tcm[2]; s.crouching = tcm[3]; }
      else if (kite) {                                           // zombiye karşı: yaklaşınca geri çekilerek ateş et, uzaktayken yerinde dur
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
        if (g.nav.nearestNode && s.cur !== 3 && st.kind !== 'melee' && (dist > 9 || Math.abs(tp.y - s.pos.y) > 2.5)) {      // katlı harita: çatışırken de hedef kata yürü (merdiven / köprü), yürürken ateş et
          const pm = this.followGoal(dt);
          if (pm && pm[2] > 0) { moveX = pm[0] * 0.9 + (-nz) * this.strafeDir * 0.25; moveZ = pm[1] * 0.9 + nx * this.strafeDir * 0.25; speed /= 0.62 * 1.15; }
        }
      }
    } else {
      s.ads = false; s.crouching = false; s.botExtraSpread = 0;
      this.burstLeft = 0;
      if (this.nadeSpot && g.time - this.nadeSpotT < 4 && g.time >= this.nadeReady && isFrag(s.items[2]?.id) && s.items[2].mag > 0) {    // gözden kaybolan düşmanın son yerine
        const sp = this.nadeSpot; this.nadeSpot = null;
        this.tryNade(s.items[2].id, sp, Math.hypot(sp.x - s.pos.x, sp.z - s.pos.z), null, true);
      }
      if (this.pendNade) {                                                    // önce o yöne dön, sonra at
        const pn = this.pendNade, d = angleDiff(s.yaw, pn.aim.yaw);
        s.yaw += clamp(d, -this.d.turn * 1.5 * dt, this.d.turn * 1.5 * dt);
        if ((pn.t -= dt) <= 0) this.pendNade = null;
        else if (Math.abs(d) < 0.06) { this.pendNade = null; this.throwNade(pn.gid, pn.aim); }
      }
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
      const pm = this.followGoal(dt);
      if (pm) { moveX = pm[0]; moveZ = pm[1]; speed *= pm[2]; }
      // yürüme yönüne dön, ya da son duyulan sese bak
      const ml = Math.hypot(moveX, moveZ);
      if (this.pendNade) { moveX *= 0.3; moveZ *= 0.3; }                       // bomba atmak için dönüyor: yürüme yönüne dönmez, yavaşlar
      else if (ml > 0.1) s.yaw += clamp(angleDiff(s.yaw, yawFromDir(moveX, moveZ)), -6 * dt, 6 * dt);
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
        if (g.payload) plStuck(this);                  // Vagon: kısa kaçış sapması (kapı pervazı / köşe), sonra rol hedefine
        else if (g.front) frStuck(this);               // Cephe: aynı kaçış, sonra rol hedefine
        else if (Math.random() < 0.4) this.setGoal(s.pos.x + rand(-10, 10), s.pos.z + rand(-10, 10), 6, s.pos.y);
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
    {                                                                          // 12.180: derin suya adım atma (doğrudan saldırıda da; köprü / baraj tabliyesindeyken serbest)
      const T = g.world.terrain;
      if (T?.waterY && ml > 0.05) {
        const ax = s.pos.x + (moveX / ml) * 0.8, az = s.pos.z + (moveZ / ml) * 0.8, wy = T.waterY(ax, az);
        if (wy > -1e9 && wy - T.heightAt(ax, az) > 0.9 && s.pos.y < wy + 0.6) { moveX = 0; moveZ = 0; }
      }
    }
    if (g.nav.safeAt && ml > 0.05 && s.onGround && !g.nav.safeAt(s.pos.x + (moveX / ml) * 0.55, s.pos.y, s.pos.z + (moveZ / ml) * 0.55)) { moveX = 0; moveZ = 0; }   // katlı harita: önü boşluk / kuyu / kat kenarıysa adım atma (köprüde yana kayarken düşmesin)
    const k = ml > 1 ? 1 / ml : 1;
    if (s.useT > 0) speed = 0;
    if (s.launchT > 0) return;                                                 // minderden fırladı: havada hız fiziğe bırakılır
    const wx = moveX * k * speed, wz = moveZ * k * speed;
    const a = Math.min(1, dt * 10);
    s.vel.x = lerp(s.vel.x, wx, a);
    s.vel.z = lerp(s.vel.z, wz, a);
    s.sprinting = !combat && speed > 5;
  }
}
