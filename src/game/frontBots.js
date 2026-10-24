import * as THREE from 'three';
import { rand, clamp } from './util.js';
import { ATK, DEF } from './front.js';

// ───── Cephe modu bot beyni (yalnız front; diğer modlar bu dosyaya hiç girmez — bot.js yalnız g.front korumalı kanca çağırır) ─────
// Takım planı (FrPlan, 1,5 sn'de bir; sektör değişince sıfırlanır) her bota rol verir. Mevziler haritanın ipucu verisinden (map.front.hints[sektör]):
//   Savunan: post (ipucu mevzisi: 'fire' ateş basamağı tüfekçisi · 'mg' makineli yuvası (ağır destek önce) · 'sniper' kule / samanlık (keskin nişancı önce) ·
//            'ambush' ev içi / siper köşesi pusu · 'cover' siper) — yerinden kopmaz, sese koşmaz; sakinken çömel-kalk taraması, çatışmada atış dizisi ayakta,
//            arada çömelip saklanır (vurulunca hemen çömelir) · guard (etkin noktaların yanında; nokta kaptırılıyorsa oraya karşı saldırı).
//   Saldıran: assault (etkin sektörün noktalarından birine; az saldıranı olan / henüz alınmamış öne) — yolda krater / enkaz kapağında kısa duraklar (atlamalı ilerleme)
//             · flank (ipucu kanat rotası, son durak noktanın yanı) · over (keskin nişancı: noktayı gören yüksek / uzak nokta, oyunun perch'ü).
// Harita bağımsız: hint verisi yoksa (başka cephe haritası) savunan noktaların çevresinde, saldıran doğrudan noktaya gider.
export const FR_BOT = {
  roleT: 1.5, postFrac: { easy: 0.45, normal: 0.55, hard: 0.6 }, flankFrac: 0.2, coverP: 0.7, coverStop: [1.4, 3.2],
  peekUp: [2.6, 4.4], peekDown: [0.9, 1.8], fireCrouch: [0.6, 1.3], hitCrouch: [1.0, 1.8], bias: 14, atkPush: 0.8,
};
const ANCHOR = new Set(['post']);
const _v = new THREE.Vector3();

class FrPlan {
  constructor(g) { this.g = g; this.F = g.front; this.sector = -1; this.nextT = 0; }
  get hints() { const H = this.F.def.hints; return (H && H[Math.min(this.F.sector, H.length - 1)]) || { hold: [], flank: [], cover: [] }; }

  tick() {
    const g = this.g;
    if (this.F.sector !== this.sector) {                                         // yeni sektör: herkes yeniden yerleşir
      this.sector = this.F.sector; this.nextT = 0;
      for (const b of g.brains) { b.frRole = null; b.frPost = null; b.frRoute = null; b.goalT = 0; }
    }
    if (g.time < this.nextT) return;
    this.nextT = g.time + FR_BOT.roleT;
    this.assign(ATK); this.assign(DEF);
  }

  assign(team) {
    const g = this.g, bots = g.brains.filter((b) => b.s.team === team && b.s.alive && !b.s.def.zombie);
    const n = bots.length;
    if (!n) return;
    const set = (b, r) => { if (b.frRole !== r) { b.frRole = r; b.frPost = null; b.frRoute = null; b.goalT = 0; } };
    if (team === DEF) {
      const act = this.F.active(), threat = act.some((o) => o.owner !== DEF || o.p > -0.98);
      const nPost = Math.round(n * (FR_BOT.postFrac[b0dk(bots[0])] ?? 0.55) * (threat ? 0.8 : 1));
      // mevzisi olan / keskin nişancı / ağır önce postta kalır (rol değiştirme direnci)
      bots.sort((a, b) => postKey(b) - postKey(a));
      bots.forEach((b, i) => set(b, i < nPost ? 'post' : 'guard'));
    } else {
      let nFl = Math.round(n * FR_BOT.flankFrac);
      bots.forEach((b) => {
        if (b.s.cls === 'sniper') { set(b, 'over'); return; }
        if (b.frRole === 'flank' && nFl > 0) { nFl--; return; }
        set(b, nFl > 0 && Math.random() < 0.5 ? (nFl--, 'flank') : 'assault');
      });
    }
  }

  // savunan mevzisi: tür sınıfa uygun, boş, yakın olan
  pickPost(b) {
    const g = this.g, s = b.s, list = this.hints.hold || [];
    let best = null, bs = -1e9;
    for (const h of list) {
      if (g.brains.some((o) => o !== b && o.s.alive && o.s.team === s.team && o.frPost === h)) continue;
      const d = Math.hypot(h.x - s.pos.x, h.z - s.pos.z);
      let sc = -d / 30 + Math.random() * 0.8;
      if (h.kind === 'sniper') sc += s.cls === 'sniper' ? 4 : -2.5;
      else if (h.kind === 'mg') sc += s.cls === 'heavy' ? 3 : 0.3;
      else if (h.kind === 'fire') sc += s.cls === 'assault' ? 1 : 0.4;
      else if (h.kind === 'ambush') sc += s.cls === 'medic' || s.cls === 'engineer' ? 1.2 : 0.2;
      if (sc > bs) { bs = sc; best = h; }
    }
    return best;
  }

  // saldıranın hedef noktası: etkin sektörde az saldıranı olan / alınmamış öne
  pickObj(b) {
    const g = this.g, act = this.F.active();
    if (!act.length) return null;
    let best = null, bs = -1e9;
    for (const o of act) {
      const mates = g.brains.filter((q) => q !== b && q.s.team === b.s.team && q.frObj === o).length;
      const sc = (o.owner === ATK && o.p >= 1 ? -2 : 0) - mates * 0.6 - Math.hypot(o.x - b.s.pos.x, o.z - b.s.pos.z) / 60 + (b.frObj === o ? 0.8 : 0) + Math.random() * 0.5;
      if (sc > bs) { bs = sc; best = o; }
    }
    return best;
  }

  // bottan noktaya giderken önde kalan krater / enkaz kapağı (yoldan ≤ 14 m sapma, bottan 8–40 m)
  pickCover(b, o) {
    const s = b.s, list = this.hints.cover || [];
    const dx = o.x - s.pos.x, dz = o.z - s.pos.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    let best = null, bs = -1e9;
    for (const [x, z] of list) {
      const px = x - s.pos.x, pz = z - s.pos.z, along = px * ux + pz * uz, lat = Math.abs(px * uz - pz * ux);
      if (along < 8 || along > Math.min(40, L - 6) || lat > 14) continue;
      const sc = -lat / 6 - Math.abs(along - 18) / 12 + Math.random();
      if (sc > bs) { bs = sc; best = [x, z]; }
    }
    return best;
  }

  goal(b) {
    const g = this.g, s = b.s, role = b.frRole || (s.team === ATK ? 'assault' : 'guard');
    if (role === 'post') {
      const h = b.frPost && this.hints.hold.includes(b.frPost) ? b.frPost : this.pickPost(b);
      if (h) { b.frPost = h; return { x: h.x, z: h.z, y: h.y, t: rand(40, 70), post: h }; }
    }
    const act = this.F.active();
    if (role === 'guard') {
      const lost = act.filter((o) => o.owner !== DEF || o.p > -0.9);
      const o = lost.length ? lost[Math.floor(Math.random() * lost.length)] : act[Math.floor(Math.random() * act.length)];
      if (!o) return null;
      const a = Math.random() * Math.PI * 2, r = o.r * (lost.length ? rand(0.1, 0.6) : rand(0.4, 1.1));
      return { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r, t: lost.length ? rand(6, 10) : rand(10, 18) };
    }
    const o = this.pickObj(b); b.frObj = o;
    if (!o) return null;
    if (role === 'over' && g.perch) { const pp = g.perch(o, s.team); if (pp) return { x: pp.x, z: pp.z, t: rand(20, 35), perch: true }; }
    if (role === 'flank') {
      if (!b.frRoute) { const R = this.hints.flank || []; if (R.length) { const best = R.reduce((m, r) => (Math.hypot(r[r.length - 1][0] - o.x, r[r.length - 1][1] - o.z) < Math.hypot(m[m.length - 1][0] - o.x, m[m.length - 1][1] - o.z) ? r : m)); b.frRoute = best.map((p) => p.slice()); b.frRouteI = nearestIdx(best, s.pos); } }
      if (b.frRoute && b.frRouteI < b.frRoute.length) { const [x, z] = b.frRoute[b.frRouteI++]; return { x, z, t: 12, flank: true }; }
    }
    if (Math.hypot(o.x - s.pos.x, o.z - s.pos.z) > 20 && Math.random() < FR_BOT.coverP) {     // atlamalı ilerleme: önce kapak
      const c = this.pickCover(b, o);
      if (c) return { x: c[0], z: c[1], t: 8, cover: true };
    }
    const a = Math.random() * Math.PI * 2, r = o.r * rand(0.1, 0.7);
    return { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r, t: rand(8, 14) };
  }
}
const b0dk = (b) => b.dk || 'normal';
const postKey = (b) => (b.frRole === 'post' ? 3 : 0) + (b.s.cls === 'sniper' ? 2 : 0) + (b.s.cls === 'heavy' ? 1.5 : 0) + (b.s.cls === 'assault' ? 0.5 : 0) + Math.random() * 0.3;
const nearestIdx = (pts, p) => { let bi = 0, bd = 1e9; pts.forEach(([x, z], i) => { const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; bi = i; } }); return bi; };
function plan(g) { const F = g.front; return F._plan || (F._plan = new FrPlan(g)); }

// BotBrain.update başı: takım planı + bayat hedef (sektör değişti)
export function frTick(b) { plan(b.game).tick(); }

// BotBrain.pickGoal yerine
export function frPickGoal(b) {
  const g = b.game, s = b.s;
  b.perching = false; b.frAt = null; b.frCover = false;
  if (s.cls === 'medic' && b.frRole !== 'post') { const c = g.nearestCorpse(s, 18); if (c) { b.setGoal(c.pos.x, c.pos.z, 6); return; } }
  const gl = plan(g).goal(b);
  if (!gl) { b.roam?.(); return; }
  b.setGoal(gl.x, gl.z, gl.t, gl.y);
  b.perching = !!gl.perch; b.frAt = gl.post || null; b.frCover = !!gl.cover;
  b.holdT = gl.post ? 1e9 : gl.cover ? rand(FR_BOT.coverStop[0], FR_BOT.coverStop[1]) : gl.flank ? 0.2 : rand(4, 9);
}

// hedefe vardı (sakin): mevzide bakış yönüne dön + çömel-kalk taraması; kapakta kısa çömel, sonra devam; noktada bekle
export function frArrive(b, dt) {
  const s = b.s, h = b.frAt;
  if (h) {
    b.frPostT = (b.frPostT || 0) + dt;
    const want = Math.atan2(-h.look[0], -h.look[1]) + Math.sin(b.frPostT * 0.4 + s.id) * (h.kind === 'sniper' ? 0.35 : 0.5);
    let d = want - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (b.game.time - b.alertT > 2.5) s.yaw += clamp(d, -1.8 * dt, 1.8 * dt);
    peek(b, dt, false);
    return;
  }
  if (b.frCover) s.crouching = true;
  if (b.holdT <= 0) b.pickGoal();
}

// çömel-kalk: ateş basamağı / yuva / pencere arkasında görünmek için ayağa kalkar, sonra saklanır. combat: atış dizisi bitince kısa çömel
function peek(b, dt, combat) {
  const s = b.s, h = b.frAt;
  if (!h) return;
  if (h.kind === 'ambush') { s.crouching = !combat; return; }                       // pusucu çömelik bekler, görünce kalkar
  b.frPeekT = (b.frPeekT ?? rand(0, 2)) - dt;
  if (b.frPeekT <= 0) {
    b.frUp = !b.frUp;
    b.frPeekT = b.frUp ? rand(FR_BOT.peekUp[0], FR_BOT.peekUp[1]) * (combat ? 1.3 : 1) : combat ? rand(FR_BOT.fireCrouch[0], FR_BOT.fireCrouch[1]) : rand(FR_BOT.peekDown[0], FR_BOT.peekDown[1]);
  }
  s.crouching = !b.frUp;
}

// vurulunca (mevzideyse): hemen çömel, kısa süre saklan
export function frDamaged(b) { if (b.frAt && b.frAt.kind !== 'ambush') { b.frUp = false; b.frPeekT = rand(FR_BOT.hitCrouch[0], FR_BOT.hitCrouch[1]); } }

// bu rol sese / son görülen konuma koşmaz
export function frAnchored(b) { return ANCHOR.has(b.frRole) && !!b.frAt; }

// hedef seçimi: savunan, noktayı alan düşmanı öne alır
export function frTargetBias(b, e) {
  if (b.s.team !== DEF) return 0;
  for (const o of b.game.front.active()) if (Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < o.r + 2) return -FR_BOT.bias;
  return 0;
}

// çatışma hareketi: [x, z, hız çarpanı] ya da null. Mevzideki bot yerinden kopmaz (uzaklaştıysa mevziye döner), çömel-kalk ile ateş eder.
export function frCombatMove(b, dt, nx, nz) {
  const s = b.s;
  if (s.cur === 3 || s.stat.kind === 'melee') return null;
  if (s.team === ATK && b.goal && b.frRole !== 'over') {                              // saldıran: ateş ederek hedefe (nokta / kapak) ilerler; kapakta çömelip ateş eder
    const gd = Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z), sx = -nz * b.strafeDir, sz = nx * b.strafeDir;
    if (b.frCover && gd < 1.8) { s.crouching = (b.frPeekT = (b.frPeekT ?? 1) - dt) % 3 > 1.2; return [sx * 0.1, sz * 0.1, 0.3]; }
    const near = b.target && Math.hypot(b.target.pos.x - s.pos.x, b.target.pos.z - s.pos.z) < 9;
    if (gd > 2.5 && !near) { const pm = b.followGoal(dt); if (pm && pm[2] > 0) return [pm[0] * 0.9 + sx * 0.25, pm[1] * 0.9 + sz * 0.25, FR_BOT.atkPush]; }
    if (gd <= 2.5) return [sx * 0.45, sz * 0.45, 0.6];                                // noktada: yana kay, kalırken ateş et
    return null;
  }
  if (!frAnchored(b)) return null;
  const h = b.frAt, d = Math.hypot(h.x - s.pos.x, h.z - s.pos.z);
  if (d > 1.4) { const pm = b.followGoal(dt); s.crouching = false; if (pm && pm[2] > 0) return [pm[0], pm[1], 0.9]; return [0, 0, 0]; }
  peek(b, dt, true);
  if (b.burstLeft > 0 && !s.crouching) b.frUp = true;                              // atış dizisi sürerken ayakta kal
  return [0, 0, 0];
}

// takıldı: kısa kaçış sapması (köşe / rampa ağzı), sonra rol hedefi
export function frStuck(b) {
  const g = b.game, s = b.s;
  b.path = null; b.repathT = 0;
  if (b.frAt && Math.hypot(b.frAt.x - s.pos.x, b.frAt.z - s.pos.z) < 1.6) return;
  const a = Math.random() * Math.PI * 2, r = rand(2.5, 6);
  b.setGoal(s.pos.x + Math.cos(a) * r, s.pos.z + Math.sin(a) * r, rand(2, 3), s.pos.y);
  b.frAt = null; b.frDetour = g.time + 2.5;
}
void _v;
