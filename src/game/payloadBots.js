import * as THREE from 'three';
import { TUNE } from './balance.js';
import { DIFFICULTY } from './stats.js';
import { clamp, rand } from './util.js';
import { ATK, DEF } from './payload.js';

// ───── Vagon modu bot beyni (yalnız payload; diğer modlar bu dosyaya hiç girmez) ─────
// Takım planı (PlPlan, 1,5 sn'de bir): her bota rol verir.
//   Saldıran: escort (vagonun itme yarıçapında, düşmana göre vagonun ARKASINDA: vagon mermiyi keser) · screen (vagonun 4–10 m önünde yol açar) ·
//             flank (ileride savunanın tuttuğu siperlere yandan) · over (nişancı: ilerisini gören yüksek nokta).
//             Escort oranı ~%62; vagon 8 sn / 20 sn ilerlemezse %78 / %88; çekişmede en az %72.
//   Savunan:  block (vagonun önüne girip itmeyi durdurur; sakin %28 / saldıran yakında %40 / vagon itilirken %65, kontrol noktasına 15 m kala +%15; yalnız vagona 22 m içindekiler) ·
//             hold (vagonla sıradaki kontrol noktası arasında, raya bakan siper noktası; vagon ilerledikçe geri çekilir) ·
//             flank (5+ kişide 1 bot: vagonun yanından / arkasından eskortu vurur) · over (nişancı).
// Çatışmada: escort / block yarıçaptan kopmaz (dışındaysa ateş ederek vagona yürür, içindeyse yalnız yana kayar); hold / screen siperinden 3,5 m'den
// fazla uzaklaşmaz; bu rollerdeki botlar ses / son görülen konum peşine düşmez. Hedef seçerken vagonu iten / durduran düşman öne alınır.
// Harita bağımsız: ray, ilerleme, kontrol noktaları, vagon konumu hep g.payload'dan (track.at / nearest / len, d, cps, reached, state, p, distTo).
export const PL_BOT = {
  roleT: 1.5,
  atkEscort: 0.62, atkEscortContest: 0.72, atkEscortStall: 0.78, atkEscortLong: 0.88, stallT: 8, stallLongT: 20,
  defBlock: 0.4, defBlockPush: 0.65, defBlockCp: 0.15, cpNear: 15, blockNear: 22,
  diff: { easy: -0.1, normal: 0, hard: 0.04 },                // zorluk: hedefe bağlılık (kolay botlar daha dağınık)
  holdAhead: [5, 26], screenAhead: [4.5, 10], flankAhead: [10, 32],
  bias: 15, biasAnchor: 25,                                   // hedef seçimi: vagonun yarıçapındaki düşmana mesafe indirimi (m)
};
const ANCHOR = new Set(['escort', 'block', 'hold', 'screen']);
const NEAR = new Set(['escort', 'block']);
const tA = new THREE.Vector3(), tB = new THREE.Vector3();

class PlPlan {
  constructor(g) {
    this.g = g; this.P = g.payload;
    this.nextT = 0; this.lastD = this.P.d; this.moveT = g.time;
    this.holds = this.buildHolds();
  }

  // Siper noktası havuzu (bir kez): ray boyunca 2,5 m'de bir, iki yana 2,5–11 m; yürünebilir, raya geri bakan (vagonun geleceği yolu gören), duvar dibi / rampa üstü öne
  buildHolds() {
    const g = this.g, P = this.P, nav = g.nav, q = {}, out = [], seen = new Set();
    for (let d = P.start; d <= P.end; d += 2.5) {
      P.track.at(d, q);
      for (const lat of [2.5, -2.5, 4, -4, 6, -6, 8.5, -8.5, 11, -11]) {
        const i = nav.nearestFree(q.x - q.dz * lat, q.z + q.dx * lat, 1.0);
        if (i < 0 || seen.has(i)) continue;
        seen.add(i);
        const x = nav.cx(i), z = nav.cz(i), f = nav.floorAt(x, z);
        if (!(f >= -0.2 && f <= 1.6)) continue;
        const n = P.track.nearest(x, z);
        if (n.dist < 1.6) continue;                                   // vagonun yolu değil
        let wall = 0;
        for (let a = 0; a < 8; a++) if (!nav.isFree(x + Math.cos(a * Math.PI / 4) * 0.8, z + Math.sin(a * Math.PI / 4) * 0.8)) wall++;
        if (wall > 5) continue;                                       // dar kuytu
        let vis = 0;
        tA.set(x, f + 1.5, z);
        for (const back of [5, 11, 18]) { P.track.at(Math.max(P.start, n.d - back), q); tB.set(q.x, 1.1, q.z); if (g.world.clear(tA, tB)) vis++; }
        if (!vis) continue;
        out.push({ x, z, y: f, d: n.d, lat: n.dist, sc: vis + Math.min(wall, 3) * 0.8 + (f > 0.5 ? 0.8 : 0) });
      }
    }
    return out;
  }

  tick() {
    const g = this.g, P = this.P;
    if (P.d > this.lastD + 0.02) this.moveT = g.time;
    if (Math.abs(P.d - this.lastD) > 0.02) this.lastD = P.d;
    if (g.time < this.nextT) return;
    this.nextT = g.time + PL_BOT.roleT;
    this.assign(ATK); this.assign(DEF);
  }

  get nextCp() { const P = this.P; return P.reached < P.cps.length ? P.cps[P.reached] : P.end; }

  assign(team) {
    const g = this.g, P = this.P;
    const bots = g.brains.filter((b) => b.s.team === team && b.s.alive && !b.s.def.zombie);
    const n = bots.length;
    if (!n) return;
    const adj = PL_BOT.diff[Object.keys(DIFFICULTY).find((k) => DIFFICULTY[k] === bots[0].d)] || 0;
    const set = (b, r) => { if (b.plRole !== r) { b.plRole = r; b.plHold = null; b.goalT = 0; } };
    const key = (b, keep, near) => P.distTo(b.s) - (b.plRole === keep ? 12 : 0) + (b.s.cls === 'sniper' ? 25 : 0) - (near && b.s.cls === 'medic' ? 4 : 0);
    if (team === ATK) {
      const stall = g.time - this.moveT;
      let f = PL_BOT.atkEscort;
      if (P.state === 'contest' || P.state === 'block') f = Math.max(f, PL_BOT.atkEscortContest);
      if (stall > PL_BOT.stallT) f = Math.max(f, PL_BOT.atkEscortStall);
      if (stall > PL_BOT.stallLongT) f = Math.max(f, PL_BOT.atkEscortLong);
      const nEsc = clamp(Math.round(n * clamp(f + adj, 0.3, 0.95)), 1, n);
      bots.sort((a, b) => key(a, 'escort', true) - key(b, 'escort', true));
      bots.forEach((b, i) => set(b, i < nEsc ? 'escort' : i === nEsc && n >= 3 ? 'screen' : b.s.cls === 'sniper' ? 'over' : 'flank'));
    } else {
      const atkNear = g.soldiers.some((e) => e.alive && e.team === ATK && P.distTo(e) < 14);
      let f = P.state === 'push' || P.state === 'contest' ? PL_BOT.defBlockPush : atkNear ? PL_BOT.defBlock : PL_BOT.defBlock * 0.7;
      if (this.nextCp - P.d < PL_BOT.cpNear) f += PL_BOT.defBlockCp;
      const near = bots.filter((b) => P.distTo(b.s) < PL_BOT.blockNear || b.plRole === 'block').length;      // uzaktaki (yeni doğan) tek tek koşup ölmesin: önce siper hattına, vagon yaklaşınca durdurucu
      const nBlock = clamp(Math.min(Math.round(n * clamp(f + adj, 0.1, 0.9)), near), P.state === 'push' ? 1 : 0, n);
      bots.sort((a, b) => key(a, 'block', false) - key(b, 'block', false));
      let flank = n >= 5 ? 1 : 0;
      bots.forEach((b, i) => {
        if (i < nBlock) set(b, 'block');
        else if (b.s.cls === 'sniper') set(b, 'over');
        else if (flank && i === n - 1) { set(b, 'flank'); flank--; }
        else set(b, 'hold');
      });
    }
  }

  // vagonun yarıçapında, düşmana göre vagonun arkasında (vagon kalkan): saldıran tehdit yoksa vagonun gerisinde, savunan önünde
  nearCart(b) {
    const g = this.g, P = this.P, s = b.s, R = TUNE.plRadius, p = P.p, nav = g.nav, q = P.track.at(P.d, {});
    let tx = 0, tz = 0, k = 0;
    for (const e of g.soldiers) if (e.alive && e.team !== s.team && P.distTo(e) < 35) { tx += e.pos.x; tz += e.pos.z; k++; }
    let ux, uz;
    if (k) { ux = p.x - tx / k; uz = p.z - tz / k; const L = Math.hypot(ux, uz); if (L > 0.5) { ux /= L; uz /= L; } else k = 0; }
    if (!k) { const sg = s.team === ATK ? -1 : 1; ux = q.dx * sg; uz = q.dz * sg; }
    const clear = s.team === ATK && (P.state === 'contest' || P.state === 'block');      // vagonda savunan var: eskort vagonun YANINA açılır (vagonun ardına çömelmiş durdurucuyu görsün)
    for (let t = 0; t < 10; t++) {
      const r = rand(1.45, R - 0.8), a = clear && t < 7 ? (Math.random() < 0.5 ? -1 : 1) * rand(1.0, 1.75) : rand(-1, 1) * (t < 6 ? 0.9 : 1.8), c = Math.cos(a), sn = Math.sin(a);
      const x = p.x + (ux * c - uz * sn) * r, z = p.z + (uz * c + ux * sn) * r;
      if (Math.abs(x - p.x) < 1.15 && Math.abs(z - p.z) < 1.15) continue;          // vagonun içi değil
      if (!nav.isFree(x, z) || Math.abs(nav.floorAt(x, z)) > 0.4) continue;
      return { x, z, t: rand(2.5, 4) };
    }
    const sd = Math.random() < 0.5 ? -1 : 1;
    return { x: p.x - q.dz * 1.7 * sd, z: p.z + q.dx * 1.7 * sd, t: 2 };
  }

  // havuzdan siper noktası: ray üzerinde [lo, hi] aralığında; aynı noktaya ikinci bot gitmez, önceki noktada kalmak öne
  pickHold(b, lo, hi, wantLat = 0) {
    const g = this.g;
    let best = null, bs = -1e9;
    for (const h of this.holds) {
      if (h.d < lo || h.d > hi) continue;
      let occ = 0;
      for (const o of g.brains) if (o !== b && o.s.alive && o.s.team === b.s.team && o.plHold && Math.hypot(o.plHold.x - h.x, o.plHold.z - h.z) < 4) occ++;
      const sc = h.sc + (h === b.plHold ? 1 : 0) - occ * 3 + (wantLat ? Math.min(h.lat, wantLat) * 0.25 : 0) - Math.hypot(h.x - b.s.pos.x, h.z - b.s.pos.z) * 0.012 + Math.random() * 1.5;
      if (sc > bs) { bs = sc; best = h; }
    }
    return best;
  }

  // rayın d noktasından yana lat metre (yürünebilir en yakın hücre)
  trackPoint(d, lat) {
    const P = this.P, nav = this.g.nav, q = P.track.at(clamp(d, P.start, P.end), {});
    const i = nav.nearestFree(q.x - q.dz * lat, q.z + q.dx * lat, 5);
    return i >= 0 ? { x: nav.cx(i), z: nav.cz(i) } : { x: q.x - q.dz * 1.7, z: q.z + q.dx * 1.7 };
  }

  goal(b) {
    const g = this.g, P = this.P, s = b.s, role = b.plRole || (s.team === ATK ? 'escort' : 'hold');
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    const H = PL_BOT;
    b.plHold = role === 'hold' || role === 'flank' ? b.plHold : null;
    if (role === 'escort' || role === 'block') return this.nearCart(b);
    if (role === 'screen') { const p = this.trackPoint(P.d + rand(H.screenAhead[0], H.screenAhead[1]), side() * rand(1.6, 4.5)); return { ...p, t: rand(3, 5) }; }
    if (role === 'over' && g.perch) {
      const q = P.track.at(Math.min(P.end, P.d + (s.team === ATK ? 10 : 3)), {});
      const pp = g.perch({ id: 'pl' + s.team + Math.round(P.d / 12), x: q.x, z: q.z }, s.team);
      if (pp) return { x: pp.x, z: pp.z, t: rand(18, 30), perch: true };
    }
    if (role === 'flank' && s.team === DEF) { const p = this.trackPoint(P.d - rand(5, 12), side() * rand(5, 10)); return { ...p, t: rand(6, 10) }; }
    // hold (savunan) · flank (saldıran: savunanın siperlerine yandan) · over yedeği
    const atk = s.team === ATK;
    const lo = P.d + (atk ? H.flankAhead[0] : H.holdAhead[0]);
    let hi = atk ? P.d + H.flankAhead[1] : Math.min(P.d + H.holdAhead[1], this.nextCp + 12);
    hi = Math.max(hi, lo + 12);
    const h = this.pickHold(b, lo, hi, atk ? 8 : 0) || this.pickHold(b, P.d + 4, P.d + 60);
    if (h) { b.plHold = h; return { x: h.x, z: h.z, y: h.y, t: atk ? rand(8, 14) : rand(10, 18) }; }
    const p = this.trackPoint(P.d + rand(8, 20), side() * rand(3, 8));
    return { ...p, t: rand(6, 10) };
  }
}

function plan(g) { const P = g.payload; return P._plan || (P._plan = new PlPlan(g)); }

// BotBrain.update başı (her kare): takım planı + hedefin bayatlaması (vagon uzaklaştı / siper geride kaldı)
export function plTick(b) {
  const g = b.game, P = g.payload, pl = plan(g);
  pl.tick();
  if (!b.goal || b.goalT <= 0 || b.perching || b.plDetour > g.time) return;
  const R = TUNE.plRadius;
  if (NEAR.has(b.plRole)) { if (Math.hypot(b.goal.x - P.p.x, b.goal.z - P.p.z) > R - 0.4) b.goalT = 0; }
  else if (b.plHold && (b.plRole === 'hold' || b.plRole === 'flank') && b.plHold.d < P.d + 3) b.goalT = 0;
}

// BotBrain.pickGoal yerine
export function plPickGoal(b) {
  const g = b.game, s = b.s;
  b.perching = false;
  if (s.cls === 'medic') { const c = g.nearestCorpse(s, 20); if (c && g.payload.distTo(c) < 20) { b.setGoal(c.pos.x, c.pos.z, 6); return; } }
  const gl = plan(g).goal(b);
  b.setGoal(gl.x, gl.z, gl.t, gl.y);
  b.perching = !!gl.perch;
  b.holdT = NEAR.has(b.plRole) ? rand(3, 6) : rand(6, 12);
}

// hedefe vardı (sakin): siperde çömel, bir süre bekle, sonra (vagon ilerlediyse) yeni nokta
export function plArrive(b) {
  const s = b.s;
  if (b.plRole === 'hold' || b.plRole === 'flank') s.crouching = true;
  if (b.holdT <= 0) b.pickGoal();                                                  // holdT yalnız hedefteyken azalır (followGoal)
}

// takıldı (sakin, 1,2 sn'de 0,35 m'den az): 2 kez üst üste aynı yerdeyse 2–3 sn rastgele yakın noktaya sap (kapı pervazı / köşe), sonra rol hedefi
export function plStuck(b) {
  const g = b.game, s = b.s;
  b.path = null; b.repathT = 0;
  if ((b.plStuckN = (b.plStuckN || 0) + 1) < 2 && b.plStuckAt && Math.hypot(b.plStuckAt.x - s.pos.x, b.plStuckAt.z - s.pos.z) > 1) { b.plStuckAt = { x: s.pos.x, z: s.pos.z }; return; }
  b.plStuckN = 0; b.plStuckAt = { x: s.pos.x, z: s.pos.z };
  const a = Math.random() * Math.PI * 2, r = rand(3, 7);
  b.setGoal(s.pos.x + Math.cos(a) * r, s.pos.z + Math.sin(a) * r, rand(2, 3), s.pos.y);
  b.plDetour = g.time + 2.5;
}

// bu rol sese / son görülen konuma koşmaz
export function plAnchored(b) { return ANCHOR.has(b.plRole); }

// hedef seçimi: vagonu iten / durduran düşman öne (mesafeden indirim)
export function plTargetBias(b, e) {
  const P = b.game.payload;
  return P.distTo(e) < TUNE.plRadius + 1.5 ? -(NEAR.has(b.plRole) ? PL_BOT.biasAnchor : PL_BOT.bias) : 0;
}

// çatışma hareketi: [x, z, hız çarpanı] ya da null (varsayılan çatışma hareketi)
export function plCombatMove(b, dt, nx, nz) {
  const role = b.plRole, s = b.s, g = b.game, P = g.payload, R = TUNE.plRadius;
  if (!ANCHOR.has(role) || s.cur === 3 || s.stat.kind === 'melee') return null;
  const sx = -nz * b.strafeDir, sz = nx * b.strafeDir;
  if (NEAR.has(role)) {
    if (P.distTo(s) > R - 0.8) {                                                    // yarıçap dışı: ateş ederek vagona yürü
      const pm = b.followGoal(dt);
      if (pm && pm[2] > 0) return [pm[0] * 0.92 + sx * 0.2, pm[1] * 0.92 + sz * 0.2, 1];
      const dx = P.p.x - s.pos.x, dz = P.p.z - s.pos.z, L = Math.hypot(dx, dz) || 1;
      return [dx / L, dz / L, 0.9];
    }
    if (Math.hypot(s.pos.x + sx * 0.7 - P.p.x, s.pos.z + sz * 0.7 - P.p.z) > R - 0.5) { b.strafeDir *= -1; return [-sx * 0.5, -sz * 0.5, 0.62]; }
    return [sx * 0.5, sz * 0.5, 0.62];                                               // eskort, yarıçap içi: yalnız yana kay
  }
  const gd = b.goal ? Math.hypot(b.goal.x - s.pos.x, b.goal.z - s.pos.z) : 0;
  if (gd > 3.5) { const pm = b.followGoal(dt); if (pm && pm[2] > 0) return [pm[0] * 0.9 + sx * 0.2, pm[1] * 0.9 + sz * 0.2, 0.85]; }
  if (role === 'hold') { s.crouching = true; return [sx * 0.15, sz * 0.15, 0.4]; }   // siperde çömelir (dar saçılım, küçük hedef), kovalamaz
  return [sx * 0.35, sz * 0.35, 0.55];                                               // öncü: az yana kay, kovalamaz
}
