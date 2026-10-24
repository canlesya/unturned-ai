import { rand, clamp } from './util.js';

// ───── Cephe modu bot beyni (12.161 Cephe Hattı; yalnız front — bot.js yalnız g.front korumalı kanca çağırır) ─────
// Sabit saldıran / savunan yok: her takımın duruşu ETKİN NOKTAYA göre (front.stance): çubuk kendine yatıksa 'def', düşmanınkine yatıksa 'atk', tam ortada 'even'.
// Takım planı (FrPlan, 1,5 sn'de bir; etkin nokta / duruş değişince sıfırlanır) her bota rol verir:
//   def: post (etkin noktanın KENDİ tarafındaki mevzi: 'fire' ateş basamağı · 'mg' makineli yuvası (ağır önce) · 'sniper' kule / samanlık (keskin nişancı önce) ·
//        'ambush' ev içi / siper köşesi · 'cover' siper; yönlü mevziler yalnız yüzü düşmana bakıyorsa) — yerinden kopmaz, çömel-kalk ile ateş eder ·
//        guard (nokta yarıçapında: çubuğu kendi tarafına iter = cepheyi ilerletir; nokta kaptırılıyorsa oraya karşı saldırı).
//   atk: assault (noktaya; yolda krater / enkaz kapağında kısa duraklar) · flank (yandan dolanma ara noktası, sonra nokta) · over (keskin nişancı: noktayı gören yüksek yer).
//   even: biraz post (kendi tarafındaki mevziler), çoğu assault.
// Mevzi havuzu haritadan (map.front.holds: x, z, y, kind, face), kapaklar map.front.covers; etkin nokta + takım için bir kez süzülür.
export const FR_BOT = {
  roleT: 1.5, postFrac: { easy: 0.4, normal: 0.45, hard: 0.5 }, evenPost: 0.2, flankFrac: 0.2, coverP: 0.6, coverStop: [1.2, 2.8],
  peekUp: [2.6, 4.4], peekDown: [0.9, 1.8], fireCrouch: [0.6, 1.3], hitCrouch: [1.0, 1.8], bias: 14, atkPush: 0.85, holdR: 34, holdBehind: 8,
};
const ANCHOR = new Set(['post']);
const enemySide = (team) => (team === 'blue' ? -1 : 1);            // düşman zincirin hangi ucunda (z işareti): Mavi'nin düşmanı −z'de (kuzey), Kırmızı'nınki +z'de

class FrPlan {
  constructor(g) { this.g = g; this.F = g.front; this.key = ''; this.nextT = 0; this.cache = new Map(); }

  // etkin nokta + takım için mevzi listesi (kopya; bakış yönü hesaplı)
  holds(team) {
    const F = this.F, o = F.active, k = F.a + team;
    let L = this.cache.get(k);
    if (L) return L;
    const es = enemySide(team);
    L = (F.def.holds || []).filter((h) => {
      const d = Math.hypot(h.x - o.x, h.z - o.z);
      if (d > FR_BOT.holdR || (h.z - o.z) * es > FR_BOT.holdBehind) return false;     // noktanın düşman tarafına 8 m'den fazla taşmaz
      if (h.face && h.face !== es) return false;                                        // ateş basamağı / yuva / kule yüzü düşmana bakmalı
      return true;
    }).map((h) => {
      const d = Math.hypot(h.x - o.x, h.z - o.z);
      const look = h.face ? [0, h.face] : d > 12 ? [(o.x - h.x) / d, (o.z - h.z) / d] : [0, es];
      return { ...h, look };
    });
    this.cache.set(k, L);
    return L;
  }

  tick() {
    const g = this.g, F = this.F;
    const key = F.a + '|' + F.stance('blue');
    if (key !== this.key) {                                                         // etkin nokta / duruş değişti: herkes yeniden yerleşir
      const moved = this.key.split('|')[0] !== String(F.a);
      this.key = key; this.nextT = 0;
      for (const b of g.brains) { if (moved || b.frRole !== 'post') { b.frRole = null; b.frPost = null; b.frRoute = null; b.goalT = 0; } }
    }
    if (g.time < this.nextT) return;
    this.nextT = g.time + FR_BOT.roleT;
    this.assign('blue'); this.assign('red');
  }

  assign(team) {
    const g = this.g, F = this.F, bots = g.brains.filter((b) => b.s.team === team && b.s.alive && !b.s.def.zombie);
    const n = bots.length;
    if (!n) return;
    const set = (b, r) => { if (b.frRole !== r) { b.frRole = r; b.frPost = null; b.frRoute = null; b.goalT = 0; } };
    const st = F.stance(team), o = F.active;
    if (st === 'def' || st === 'even') {
      const threat = g.soldiers.some((e) => e.alive && e.team !== team && Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < o.r + 4);
      const frac = st === 'even' ? FR_BOT.evenPost : (FR_BOT.postFrac[b0dk(bots[0])] ?? 0.45) * (threat ? 0.8 : 1);
      const nPost = Math.min(this.holds(team).length, Math.round(n * frac));
      bots.sort((a, b) => postKey(b) - postKey(a));                                 // mevzisi olan / keskin nişancı / ağır önce postta kalır
      bots.forEach((b, i) => set(b, i < nPost ? 'post' : st === 'even' ? (b.s.cls === 'sniper' ? 'over' : 'assault') : 'guard'));
    } else {
      let nFl = Math.round(n * FR_BOT.flankFrac);
      bots.forEach((b) => {
        if (b.s.cls === 'sniper') { set(b, 'over'); return; }
        if (b.frRole === 'flank' && nFl > 0) { nFl--; return; }
        set(b, nFl > 0 && Math.random() < 0.5 ? (nFl--, 'flank') : 'assault');
      });
    }
  }

  // mevzi: tür sınıfa uygun, boş, yakın olan
  pickPost(b) {
    const g = this.g, s = b.s, list = this.holds(s.team);
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

  // bottan noktaya giderken önde kalan krater / enkaz kapağı (yoldan ≤ 14 m sapma, bottan 8–40 m)
  pickCover(b, o) {
    const s = b.s, list = this.F.def.covers || [];
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

  // kanat: noktanın yanından (kendi tarafından 16 m geride, 22–28 m yana) ulaşılabilir ara nokta
  flankPt(b, o) {
    const g = this.g, s = b.s, B = g.map.bounds, es = enemySide(s.team);
    const side = (b.frSide ??= Math.random() < 0.5 ? -1 : 1);
    for (const lat of [rand(22, 28), 16, 10]) {
      const x = clamp(o.x + side * lat, B.minX + 5, B.maxX - 5), z = o.z - es * 16;
      const i = g.nav.nearestFree(x, z, 3), cm = g.nav.comps?.(0.7), i0 = g.nav.nearestFree(s.pos.x, s.pos.z, 2);
      if (i >= 0 && (!cm || (i0 >= 0 && cm[i] === cm[i0]))) return [g.nav.cx(i), g.nav.cz(i)];
    }
    return null;
  }

  goal(b) {
    const g = this.g, s = b.s, F = this.F, role = b.frRole || 'assault', o = F.active;
    if (F.done) return null;
    if (role === 'post') {
      const L = this.holds(s.team), h = b.frPost && L.includes(b.frPost) ? b.frPost : this.pickPost(b);
      if (h) { b.frPost = h; return { x: h.x, z: h.z, y: h.y, t: rand(40, 70), post: h }; }
    }
    if (role === 'guard') {
      const lost = (s.team === 'blue' ? o.p < 0.2 : o.p > -0.2);
      const a = Math.random() * Math.PI * 2, r = o.r * (lost ? rand(0.1, 0.6) : rand(0.3, 0.9));
      return { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r, t: lost ? rand(6, 10) : rand(10, 16) };
    }
    if (role === 'over' && g.perch) {                                               // nişancı: noktayı gören yüksek / uzak nokta (oyunun perch'ü) — yalnız ulaşılabilirse
      const pp = g.perch(o, s.team), cm = g.nav.comps?.(0.7), i0 = g.nav.nearestFree(s.pos.x, s.pos.z, 2), i1 = pp ? g.nav.nearestFree(pp.x, pp.z, 2) : -1;
      if (pp && cm && i0 >= 0 && i1 >= 0 && cm[i0] === cm[i1]) return { x: pp.x, z: pp.z, t: rand(20, 35), perch: true };
    }
    const dO = Math.hypot(o.x - s.pos.x, o.z - s.pos.z);
    if (role === 'flank' && dO > 26 && !b.frRoute) {
      const p = this.flankPt(b, o);
      if (p) { b.frRoute = p; return { x: p[0], z: p[1], t: 12, flank: true }; }
    }
    if (dO > 20 && Math.random() < FR_BOT.coverP) {                                 // atlamalı ilerleme: önce kapak
      const c = this.pickCover(b, o);
      if (c) return { x: c[0], z: c[1], t: 8, cover: true };
    }
    const a = Math.random() * Math.PI * 2, r = o.r * rand(0.1, 0.7);
    return { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r, t: rand(8, 14) };
  }
}
const b0dk = (b) => b.dk || 'normal';
const postKey = (b) => (b.frRole === 'post' ? 3 : 0) + (b.s.cls === 'sniper' ? 2 : 0) + (b.s.cls === 'heavy' ? 1.5 : 0) + (b.s.cls === 'assault' ? 0.5 : 0) + Math.random() * 0.3;
function plan(g) { const F = g.front; return F._plan || (F._plan = new FrPlan(g)); }

// BotBrain.update başı: takım planı (etkin nokta / duruş değişince yeniden)
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

// hedef seçimi: etkin noktadaki (ya da noktaya çok yakın) düşman öne
export function frTargetBias(b, e) {
  const F = b.game.front, o = F && !F.done ? F.active : null;
  if (o && Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < o.r + 2) return -FR_BOT.bias;
  return 0;
}

// çatışma hareketi: [x, z, hız çarpanı] ya da null. Mevzideki bot yerinden kopmaz (uzaklaştıysa mevziye döner), çömel-kalk ile ateş eder;
// nokta / kapak / kanat hedefli bot ateş ederek ilerler (nokta alınmadan durmaz), noktadaysa yana kayar.
export function frCombatMove(b, dt, nx, nz) {
  const s = b.s;
  if (s.cur === 3 || s.stat.kind === 'melee') return null;
  if (b.goal && b.frRole !== 'over' && !frAnchored(b)) {
    const gd = Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z), sx = -nz * b.strafeDir, sz = nx * b.strafeDir;
    if (b.frCover && gd < 1.8) { s.crouching = (b.frPeekT = (b.frPeekT ?? 1) - dt) % 3 > 1.2; return [sx * 0.1, sz * 0.1, 0.3]; }
    const near = b.target && Math.hypot(b.target.pos.x - s.pos.x, b.target.pos.z - s.pos.z) < 9;
    if (gd > 2.5 && !near) { const pm = b.followGoal(dt); if (pm && pm[2] > 0) return [pm[0] * 0.9 + sx * 0.25, pm[1] * 0.9 + sz * 0.25, FR_BOT.atkPush]; }
    if (gd <= 2.5) return [sx * 0.45, sz * 0.45, 0.6];                                // hedefte: yana kay, kalırken ateş et
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
  b.frAt = null; b.frRoute = null; b.frDetour = g.time + 2.5;
}
