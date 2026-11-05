import * as THREE from 'three';
import { WSTATS } from './stats.js';
import { VT } from '../sim/vehicle.js';

// 12.233 Ölüm hissi: yöntemsel ölüm animasyonu (3. şahıs, herkes aynı düşüşü görür), elden düşen silah, kafadan vurulunca uçan kask / şapka,
// ölenin kamerası (birinci şahıs) gövdeyle birlikte devrilir.
//
// Kod (sunucu ya da çevrimdışı Soldier.die → 'kill' olayının `da` alanı; eski istemci yok sayar): 14 bit
//   iy (6 bit) itiş yönü (vurulduğu yerden kurbana, 64 adım) · fd (2) düşüş yönü 0 geri / 1 ileri / 2 sol / 3 sağ (kurbanın baktığı yöne göre)
//   st (3) biçim 0 düz / 1 dizüstü çöküş / 2 kafadan (baş geri savrulur, anında gevşer) / 3 patlama (savrulur, yuvarlanır) / 4 bıçak (sendeler) / 5 yüzüstü
//   zn (2) bölge 0 gövde / 1 kafa / 2 bacak · 1<<13 geçerli bit
// Biçim + yön sunucuda seçilir (rastgele çeşit dahil) → her istemci aynı düşüşü oynar. Duvar / kenar denetimi istemcide (aynı harita → aynı sonuç):
// arkası duvarsa geri düşmek yerine dizüstü çöker (6 = duvar dibinde çöküş, yalnız istemci).
export const ST = { plain: 0, crumple: 1, head: 2, blast: 3, stagger: 4, prone: 5, slump: 6 };
const BACK = 0, FWD = 1, LEFT = 2, RIGHT = 3;
const K_GUN = 0, K_MELEE = 1, K_EXP = 2;
const VALID = 1 << 13, TAU = Math.PI * 2;
const DUR = [1.0, 1.25, 0.85, 1.05, 1.3, 0.6, 0.9];                 // biçim başına animasyon süresi (sn); sonra gövde yerde durur

const EXP_RE = /Bomba|C4|Claymore|Mayın|RPG|LAW|M79|Roket|Tank topu|üssü|Patlama/i;
let kinds = null;
export function deathKind(name) {
  if (!name) return K_GUN;
  if (!kinds) {
    kinds = new Map();
    for (const id in WSTATS) { const w = WSTATS[id]; if (w?.name) kinds.set(w.name, w.kind === 'melee' ? K_MELEE : w.kind === 'launcher' || w.kind === 'throwable' || w.kind === 'mine' ? K_EXP : K_GUN); }
    for (const id in VT) { const v = VT[id]; if (v?.name) kinds.set(v.name, K_EXP); if (v?.cannon?.name) kinds.set(v.cannon.name, K_EXP); }      // araç çarpması / patlaması / tank topu
  }
  let k = kinds.get(name);
  if (k === undefined) { const b = name.split(' · ')[0]; k = kinds.get(b); if (k === undefined) k = EXP_RE.test(name) ? K_EXP : K_GUN; kinds.set(name, k); }      // "Bıçak · arkadan" → Bıçak
  return k;
}
const wrap = (a) => ((a % TAU) + TAU * 1.5) % TAU - Math.PI;

// fx / fz: vuruşun geldiği yer (atıcı, patlama merkezi); yoksa (düşme, intihar) NaN → geriye devrilir
export function deathCode(s, fx, fz, zone, wname) {
  const k = deathKind(wname), sp = Math.hypot(s.vel?.x || 0, s.vel?.z || 0);
  let iy;
  const dx = s.pos.x - fx, dz = s.pos.z - fz;
  if (Number.isFinite(dx) && Number.isFinite(dz) && dx * dx + dz * dz > 1e-4) iy = Math.atan2(-dx, -dz);
  else iy = s.yaw + Math.PI;
  const rel = wrap(iy - s.yaw), ar = Math.abs(rel);
  let fd = ar < 0.95 ? FWD : ar > 2.2 ? BACK : rel > 0 ? LEFT : RIGHT;
  const zn = zone === 'head' ? 1 : zone === 'legs' ? 2 : 0, r = Math.random();
  let st;
  if (s.prone || (s.proneT || 0) > 0.5 || s.downed) { st = ST.prone; fd = FWD; }
  else if (k === K_EXP) st = ST.blast;
  else if (k === K_MELEE) st = ST.stagger;
  else if (zn === 1) st = ST.head;
  else if ((sp < 1.2 && r < 0.4) || (zn === 2 && r < 0.6) || (fd !== BACK && r < 0.18)) { st = ST.crumple; fd = FWD; }
  else st = ST.plain;
  const q = Math.round(((iy / TAU) % 1 + 1) % 1 * 64) & 63;
  return q | fd << 6 | st << 8 | zn << 11 | VALID;
}
export const deadDirOf = (c) => (c & VALID && ((c >> 6) & 3) === FWD ? -1 : 1);      // uzak asker vekili (farSoldiers) için kaba yön

// ── yardımcılar ──
const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sm = (a, b, t) => { const u = cl((t - a) / (b - a)); return u * u * (3 - 2 * u); };
const fall = (t, a, b) => { const u = cl((t - a) / (b - a)); return u * u * (1.3 - 0.3 * u); };          // devrilme: yavaş başlar, yere yaklaşınca hızlanır
const bounce = (t, at, amp) => (t > at ? Math.exp(-(t - at) * 11) * Math.sin((t - at) * 24) * amp : 0);   // yere çarpınca küçük sekme
const lerp = (a, b, k) => a + (b - a) * k;
const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _sc = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const _hit = {};
const MAX_ANIM = 10;                                                  // aynı anda canlandırılan en çok gövde (fazlası doğrudan yerde)
const MAX_SIM = 12;                                                   // aynı anda düşen en çok silah
const HAT_N = 6;                                                      // kask / şapka havuzu
const MEASURE_N = 3;
const CORR0 = [0.28, 0.21, 0.3, 0.3, 0.2];                           // ölçülemeyince: geri / ileri / sol / sağ / dizüstü yatışta kökün yerden yüksekliği (ölçümlerin ortalaması)

// T: hedef poz (tek nesne, her karede yeniden doldurulur)
const mkT = () => ({ P: 0, R: 0, Y: 0, ox: 0, oz: 0, dr: 0, land: 0, tx: 0, ty: 0, tz: 0, hx: 0, hy: 0, hz: 0, hl: 0, kl: 0, hr: 0, kr: 0, zl: 0, zr: 0, ra: 0, rz: 0, rb: 0, la: 0, lz: 0, lb: 0, eyeP: 0, yw: 0 });

export class DeathFx {
  constructor(game) {
    this.g = game;
    this.T = mkT();
    this.sims = [];                                                   // düşmekte olan silahlar (yerine oturunca listeden çıkar)
    this.hats = [];
    this.stats = { starts: 0, pops: 0, drops: 0, last: null };        // test
    this.active = 0;
    const empty = new THREE.BufferGeometry();
    for (let i = 0; i < HAT_N; i++) {
      const gr = new THREE.Group(); gr.visible = false;
      const ms = [];
      for (let j = 0; j < 3; j++) { const m = new THREE.Mesh(empty); m.visible = false; m.castShadow = true; m.frustumCulled = false; gr.add(m); ms.push(m); }
      game.scene.add(gr);
      this.hats.push({ g: gr, ms, owner: null, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, floor: 0, done: true, at: -1, qT: new THREE.Quaternion(), hh: 0.06 });
    }
  }

  // ── animasyon başlangıcı (soldier.dSeq değişince bir kez) ──
  start(s) {
    const g = this.g, m = s.model, p = m.parts;
    const D = (s._dth ||= { q0: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], leg0: [0, 0, 0, 0, 0, 0], tor0: [0, 0, 0], hd0: [0, 0, 0] });
    s._dsSeen = s.dSeq;
    let c = s.dCode | 0;
    if (!(c & VALID)) { const fd = s.deadDir < 0 ? FWD : BACK; c = (Math.round(((s.yaw + (fd === BACK ? Math.PI : 0)) / TAU % 1 + 1) % 1 * 64) & 63) | fd << 6 | VALID; }      // kodsuz (eski sunucu / deadT=99): düz devrilme
    D.code = c; D.iy = ((c & 63) / 64) * TAU; D.fd = (c >> 6) & 3; D.st = (c >> 8) & 7; D.zone = (c >> 11) & 3;
    if (D.st > 5) D.st = ST.plain;
    D.restDone = false;
    const prone = s.prone || (s.proneT || 0) > 0.5;
    if (prone) { D.st = ST.prone; D.fd = FWD; }
    else if (D.st === ST.prone) D.st = ST.plain;
    D.yaw = s.yaw;                                                    // sunucu düşüş yönünü bakışa göre seçti; gövde (bacaklar gecikmeli döner) ilk 0,2 sn'de bakışa hizalanır
    D.yaw0 = Number.isFinite(s.bodyYaw) && !(s.isPlayer && !g.showSelf) ? s.bodyYaw : s.yaw;
    D.pitch0 = s.pitch || 0;
    let sd = (c * 2654435761 + s.id * 40503 + (s.dSeq | 0) * 977) >>> 0; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    D.v = [rnd(), rnd(), rnd(), rnd(), rnd(), rnd()];                 // sunucu kodundan türer → her istemcide aynı çeşit
    D.t0 = s.deadT;
    this.active = this.countActive();
    D.late = s.deadT > 2.5;
    D.instant = D.late || this.active >= MAX_ANIM;                    // geç görülen (uzaktan yaklaşılan) / kalabalık: doğrudan yerde
    // başlangıç pozu (son canlı kare) → ilk 0,15 sn bundan geçilir
    const L = p.legs.L, R = p.legs.R;
    D.leg0[0] = L.hip.rotation.x; D.leg0[1] = L.knee.rotation.x; D.leg0[2] = R.hip.rotation.x; D.leg0[3] = R.knee.rotation.x; D.leg0[4] = L.hip.rotation.z; D.leg0[5] = R.hip.rotation.z;
    D.tor0[0] = p.torso.rotation.x; D.tor0[1] = p.torso.rotation.y; D.tor0[2] = p.torso.rotation.z;
    D.hd0[0] = p.head.rotation.x; D.hd0[1] = p.head.rotation.y; D.hd0[2] = p.head.rotation.z;
    D.dr0 = Math.max(0, 0.88 - L.hip.position.y);
    D.q0[0].copy(p.armR.upper.quaternion); D.q0[1].copy(p.armR.fore.quaternion); D.q0[2].copy(p.armL.upper.quaternion); D.q0[3].copy(p.armL.fore.quaternion);

    // yönler (dünya): ileri f, sağ r, itiş i
    const fx = -Math.sin(D.yaw), fz = -Math.cos(D.yaw), rx = Math.cos(D.yaw), rz = -Math.sin(D.yaw);
    D.ix = -Math.sin(D.iy); D.iz = -Math.cos(D.iy);
    D.tr = 0;
    const W = g.world, x0 = s.pos.x, y0 = s.pos.y, z0 = s.pos.z;
    D.base = this._sup(x0, y0 + 0.3, z0, 6);
    D.base = Number.isFinite(D.base) ? Math.min(0, D.base - y0) : 0;  // havada öldüyse yere iner
    const by = y0 + D.base;
    if (W && D.st === ST.blast) {                                     // savrulma mesafesi: önü açıksa ≤ 2,2 m
      _o.set(x0, by + 0.9, z0); _d.set(D.ix, 0, D.iz);
      const h = W.raycast(_o, _d, 4.2, _hit);
      D.tr = Math.max(0, Math.min(2.2, (h ? h.t : 4.2) - 1.9));
    } else if (W && D.st === ST.stagger) {
      _o.set(x0, by + 0.9, z0); _d.set(D.ix, 0, D.iz);
      const h = W.raycast(_o, _d, 1.0, _hit);
      D.tr = Math.max(0, Math.min(0.4, (h ? h.t : 1) - 0.55));
    }
    const lx = x0 + D.ix * D.tr, lz = z0 + D.iz * D.tr;              // düştüğü yer (savrulduysa ilerisi)
    // düşüş yönü açık mı (duvar / sandık / uçurum): değilse dizüstü çöküş, o da olmazsa yanlar, hiçbiri olmazsa duvar dibinde çöküş
    if (W && D.st !== ST.prone) {
      const dirOf = (fd, o) => { if (fd === BACK) o.set(-fx, 0, -fz); else if (fd === FWD) o.set(fx, 0, fz); else if (fd === LEFT) o.set(-rx, 0, -rz); else o.set(rx, 0, rz); return o; };
      const free = (fd, len) => this._free(lx, by, lz, dirOf(fd, _v2), len);
      const len = D.st === ST.crumple ? 1.3 : 1.7;
      if (!free(D.fd, len)) {
        if (D.st !== ST.crumple && free(FWD, 1.3)) { D.st = D.st === ST.blast ? ST.blast : ST.crumple; D.fd = FWD; }
        else if (free(LEFT, 1.6)) D.fd = LEFT;
        else if (free(RIGHT, 1.6)) D.fd = RIGHT;
        else { D.st = ST.slump; D.fd = FWD; }
      }
      // eğim: baş ucu ile ayak ucu arasındaki kot farkı gövdeyi yamaca yatırır
      dirOf(D.fd, _v2);
      const L1 = D.st === ST.crumple ? 1.15 : 1.5;
      const hHead = this._sup(lx + _v2.x * L1, by + 0.6, lz + _v2.z * L1, 1.6), hMid = this._sup(lx + _v2.x * L1 * 0.5, by + 0.6, lz + _v2.z * L1 * 0.5, 1.6);
      const hFeet = this._sup(lx, by + 0.6, lz, 1.6);
      const f0 = Number.isFinite(hFeet) ? hFeet : by, hh = Number.isFinite(hHead) ? hHead : f0, hm = Number.isFinite(hMid) ? hMid : f0;
      const a = Math.max(-0.35, Math.min(0.35, Math.atan2(hh - f0, L1)));
      D.sP = D.fd === BACK ? -a : D.fd === FWD ? a : 0;
      D.sR = D.fd === LEFT ? -a : D.fd === RIGHT ? a : 0;
      D.gnd = Math.min(f0, hh, hm);
      D.lift0 = f0 - by;                                               // ayak ucunun kotu (savrulduysa iniş yeri)
    } else { D.sP = 0; D.sR = 0; D.gnd = by; D.lift0 = 0; }
    D.dur = DUR[D.st];
    D.st0 = (c >> 8) & 7;
    D.wob = D.v[0] < 0.5 ? -1 : 1;
    s.deadDir = D.fd === FWD || D.st === ST.crumple ? -1 : 1;
    D.corr = 0;
    // silah elden düşer (gövde ölçümünden önce: ölçüme girmesin)
    this.dropWeapon(s, D, D.instant);
    // son poz: gövdenin en alt noktası zemine (yatan askerin kalınlığı kıyafete / sınıfa göre değişir → ölçülür)
    // ölçüm kare başına en çok MEASURE_N gövde (ağ köşeleri taranır, ~0,2 ms); fazlası yatış biçimine göre ortalama kalınlık
    const fr = g.renderer?.info.render.frame ?? 0;
    if (fr !== this._mFr) { this._mFr = fr; this._mN = 0; }
    if (D.st === ST.prone) D.corr = 0;
    else if (this._mN++ < MEASURE_N) {
      this._apply(s, D, D.dur + 1);
      m.root.updateMatrixWorld(true);
      const mn = this._minY(m.root);
      D.corr = Number.isFinite(mn) ? Math.max(-0.5, Math.min(0.6, D.gnd + 0.012 - mn)) : CORR0[D.st === ST.crumple || D.st === ST.slump ? 4 : D.fd];
    } else D.corr = CORR0[D.st === ST.crumple || D.st === ST.slump ? 4 : D.fd];
    this.stats.corr = D.corr;
    if (D.zone === 1 && D.st0 !== ST.blast && !D.late) this.popHat(s, D);
    this.stats.starts++;
    this.stats.last = { id: s.id, st: D.st, fd: D.fd, zone: D.zone, code: c, instant: D.instant };
    if (D.instant) D.t0 = -99;
  }
  countActive() { let n = 0; for (const s of this.g.soldiers) if (!s.alive && s._dth && s._dsSeen === s.dSeq && !s._dth.instant && s.deadT < s._dth.dur) n++; return n; }

  // ölü askerin pozu (Soldier.syncModel → !alive)
  pose(s, dt) {
    if (s._dsSeen !== s.dSeq || !s._dth) this.start(s);
    const D = s._dth;
    const t = D.t0 === -99 ? D.dur + 1 : s.deadT;
    const root = s.model.root;
    if (D.restDone && t > D.dur + 0.05) {                             // yerde: kollar / bacaklar değişmez, yalnız kök (syncModel kökü her kare sıfırdan kurar)
      root.rotation.order = 'YXZ'; root.rotation.set(D.rx, D.yaw, D.rz);
      root.position.set(s.pos.x + D.rox, s.pos.y + D.roy, s.pos.z + D.roz);
      return;
    }
    const w = s.model.weapon;
    if (w && w.visible && w.parent === s.model.parts.mount) w.visible = false;      // ölüyken gelen yeni silah modeli (çevrim içi donanım güncellemesi) gevşek elde asılı kalmasın
    this._apply(s, D, t);
    if ((D.restDone = t > D.dur + 0.05)) { D.rx = root.rotation.x; D.rz = root.rotation.z; D.rox = root.position.x - s.pos.x; D.roy = root.position.y - s.pos.y; D.roz = root.position.z - s.pos.z; }
  }

  // ── hedef poz: biçime göre ──
  _target(D, t, T) {
    const fd = D.fd, st = D.st;
    T.P = 0; T.R = 0; T.Y = 0; T.ox = 0; T.oz = 0; T.dr = 0; T.land = 0; T.eyeP = 0;
    T.tx = 0; T.ty = 0; T.tz = 0; T.hx = 0; T.hy = 0; T.hz = 0;
    // dinlenme pozu (yere yatınca): yön ve tohuma göre
    let rest = 0, a = 0;
    const rp = this._rest;
    this._restPose(D, rp);
    const LIMP = 0.12;
    let fl = 0, clu = 0, buck = 0;
    if (st === ST.plain) {
      const j = sm(0, 0.06, t) * (1 - sm(0.12, 0.42, t));
      a = fall(t, 0.06, 0.7); rest = sm(0.5, 0.95, t);
      this._topple(T, fd, a + bounce(t, 0.7, 0.07));
      buck = sm(0.03, 0.3, t) * (1 - sm(0.5, 0.85, t));
      T.dr = 0.16 * buck;
      T.tx = j * (fd === BACK ? 0.32 : fd === FWD ? -0.36 : 0.05); T.tz = j * (fd === LEFT ? -0.3 : fd === RIGHT ? 0.3 : 0);
      T.hx = j * (fd === BACK ? 0.35 : -0.3);
      fl = sm(0.05, 0.4, t) * (1 - rest);
      T.land = cl(a);
    } else if (st === ST.head) {
      const snap = sm(0, 0.05, t) * (1 - 0.65 * sm(0.1, 0.45, t));
      T.hx = snap * (fd === BACK ? 0.8 : fd === FWD ? -0.6 : 0.25); T.hz = snap * (fd === LEFT ? 0.45 : fd === RIGHT ? -0.45 : 0);
      T.eyeP = T.hx;
      buck = fall(t, 0.02, 0.3) * (1 - 0.8 * sm(0.4, 0.8, t));
      T.dr = 0.4 * buck;
      a = fall(t, 0.1, 0.6); rest = sm(0.45, 0.85, t);
      this._topple(T, fd, a + bounce(t, 0.6, 0.03));
      T.land = cl(a);
    } else if (st === ST.crumple) {
      const k1 = sm(0, 0.42, t);
      a = fall(t, 0.4, 1.02); rest = sm(0.8, 1.2, t);
      this._topple(T, fd, a + bounce(t, 1.02, 0.04));
      T.dr = 0.45 * k1;
      T.tx = -0.38 * k1 * (1 - a); T.hx = -0.32 * k1 * (1 - a);
      clu = k1 * (1 - sm(0.45, 0.9, t));
      T.land = cl(a);
    } else if (st === ST.blast) {
      const u = cl(t / 0.6), tr = D.tr, apex = 0.32 + 0.12 * tr;
      const e = 1 - (1 - u) * (1 - u);
      T.ox = D.ix * tr * e; T.oz = D.iz * tr * e;
      T.Y = 4 * apex * u * (1 - u);
      a = sm(0, 0.6, t); rest = sm(0.55, 1.0, t);
      this._topple(T, fd, a + bounce(t, 0.6, 0.08));
      const tum = Math.sin(Math.PI * u) * 0.55;
      if (fd === LEFT || fd === RIGHT) T.R += Math.sign(T.R) * tum; else T.P += Math.sign(T.P || 1) * tum;
      T.R += D.wob * 0.45 * Math.sin(TAU * u) * (1 - u);
      fl = Math.sin(Math.PI * u) * 1.2 * (1 - rest);
      T.land = u;
    } else if (st === ST.stagger) {
      const s1 = sm(0, 0.5, t), w = 1 - sm(0.4, 0.65, t);
      T.ox = D.ix * D.tr * s1; T.oz = D.iz * D.tr * s1;
      a = fall(t, 0.45, 1.05); rest = sm(0.85, 1.25, t);
      this._topple(T, fd, a + bounce(t, 1.05, 0.05));
      T.R += D.wob * 0.13 * Math.sin(t * 11) * w;
      T.tx = -0.42 * sm(0, 0.22, t) * (1 - a); T.hx = -0.25 * sm(0, 0.22, t) * (1 - a);
      clu = sm(0, 0.2, t) * (1 - sm(0.45, 0.8, t));
      buck = sm(0.3, 0.6, t) * (1 - a);
      T.dr = 0.22 * buck;
      T.land = cl(a);
      this._stepT = w * Math.sin(t * 12) * 0.38;                       // sendeleme adımı (bacaklar)
    } else if (st === ST.prone) {
      rest = sm(0, 0.5, t); a = 1;
      T.P = -Math.PI / 2;
      T.ox = Math.sin(D.yaw) * 0.82; T.oz = Math.cos(D.yaw) * 0.82; T.Y = 0.17;      // yüzüstü pozuyla aynı (soldier.syncModel)
      T.land = 0;
    } else {      // slump: duvar dibinde çöküş (her yön kapalı)
      const k1 = sm(0, 0.5, t);
      T.dr = 0.45 * k1; T.tx = -0.55 * k1; T.hx = -0.6 * k1; T.hy = 0.35 * k1 * D.wob;
      rest = 0; a = 0; T.land = 0;
    }
    // gövde / baş → dinlenme
    if (st !== ST.slump) {
      T.tx = lerp(T.tx, rp.tx, rest); T.tz = lerp(T.tz, rp.tz, rest);
      T.hx = lerp(T.hx, rp.hx, rest); T.hy = lerp(T.hy, rp.hy, rest); T.hz = lerp(T.hz, rp.hz, rest);
    }
    // bacaklar: büküm (diz bükülür) → dinlenme
    if (st === ST.crumple || st === ST.slump) {
      const k1 = sm(0, 0.42, t), kn = -1.5 + (st === ST.crumple ? 1.3 * a : 0);
      T.hl = lerp(0, rp.hl, a) ; T.kl = lerp(-1.5 * k1, Math.min(rp.kl, kn), a > 0 ? a : 0);
      T.hr = lerp(0, rp.hr, a); T.kr = lerp(-1.5 * k1, Math.min(rp.kr, kn), a > 0 ? a : 0);
      if (st === ST.slump) { T.kl = -1.5 * k1; T.kr = -1.5 * k1; T.hl = 0.05; T.hr = -0.05; }
      T.zl = -0.08 * a; T.zr = 0.08 * a;
    } else {
      const bh = 0.75 * buck, bk = -1.35 * buck, stp = st === ST.stagger ? this._stepT : 0;
      const flh = st === ST.blast ? fl * 0.5 : 0;
      T.hl = lerp(bh + stp + flh, rp.hl, rest); T.kl = lerp(bk - Math.max(0, stp) * 1.2 - flh, rp.kl, rest);
      T.hr = lerp(bh - stp + flh * 0.4, rp.hr, rest); T.kr = lerp(bk - Math.max(0, -stp) * 1.2 - flh * 0.6, rp.kr, rest);
      T.zl = lerp(-0.04, rp.zl, rest); T.zr = lerp(0.04, rp.zr, rest);
      if (st === ST.prone) { T.hl = lerp(0, rp.hl, rest); T.kl = lerp(-0.1, rp.kl, rest); T.hr = lerp(0, rp.hr, rest); T.kr = lerp(-0.1, rp.kr, rest); }
    }
    // kollar: gevşek → savrulma / tutunma → dinlenme (omuz yerelinde: a öne kalkış, z yana açılış, b dirsek)
    const F = this._flail; this._flailPose(D, F);
    T.ra = LIMP; T.rz = 0.14; T.rb = 0.25; T.la = LIMP; T.lz = -0.14; T.lb = 0.25;
    if (fl > 0) { const k = Math.min(1, fl); T.ra = lerp(T.ra, F.ra, k); T.rz = lerp(T.rz, F.rz, k); T.rb = lerp(T.rb, F.rb, k); T.la = lerp(T.la, F.la, k); T.lz = lerp(T.lz, F.lz, k); T.lb = lerp(T.lb, F.lb, k); }
    if (clu > 0) { T.ra = lerp(T.ra, 0.75, clu); T.rz = lerp(T.rz, -0.4, clu); T.rb = lerp(T.rb, 1.6, clu); T.la = lerp(T.la, 0.7, clu); T.lz = lerp(T.lz, 0.35, clu); T.lb = lerp(T.lb, 1.5, clu); }
    if (st === ST.slump) { T.ra = 0.05; T.rz = 0.2; T.rb = 0.2; T.la = 0.08; T.lz = -0.25; T.lb = 0.3; }
    else { T.ra = lerp(T.ra, rp.ra, rest); T.rz = lerp(T.rz, rp.rz, rest); T.rb = lerp(T.rb, rp.rb, rest); T.la = lerp(T.la, rp.la, rest); T.lz = lerp(T.lz, rp.lz, rest); T.lb = lerp(T.lb, rp.lb, rest); }
  }
  _topple(T, fd, k) {
    if (fd === BACK) T.P = 1.5 * k; else if (fd === FWD) T.P = -1.5 * k;
    else { T.R = (fd === LEFT ? 1.42 : -1.42) * k; T.P = -0.1 * k; }
  }
  // yattığı yöne göre dinlenme pozu (tohumlu çeşit)
  _restPose(D, o) {
    const v = D.v, fd = D.st === ST.crumple || D.st === ST.prone ? FWD : D.fd;
    if (fd === BACK) {
      o.tx = 0.08; o.tz = 0; o.hx = 0.12; o.hy = (v[1] - 0.5) * 1.1; o.hz = 0;
      o.hl = 0.1 + 0.35 * v[2]; o.kl = -0.15 - 0.6 * v[2]; o.hr = 0.05 + 0.15 * v[3]; o.kr = -0.12 - 0.3 * v[3]; o.zl = -0.13; o.zr = 0.15;
      // kollar yerde: sırtüstünde yer gövdenin arkası (+z) → hafif geri (a < 0) ya da başın üstünde (a > π); a ≈ π/2 kolu havaya dikerdi
      o.ra = v[4] < 0.7 ? -0.2 - 0.1 * v[1] : 3.32; o.rz = 0.45 + 0.8 * v[5]; o.rb = 0.2 + 0.4 * v[1]; o.la = v[5] < 0.7 ? -0.2 - 0.1 * v[2] : 3.3; o.lz = -0.45 - 0.8 * v[4]; o.lb = 0.2 + 0.5 * v[2];
    } else if (fd === FWD) {
      o.tx = -0.04; o.tz = 0; o.hx = 0.1; o.hy = v[1] < 0.5 ? 0.95 : -0.95; o.hz = 0;
      o.hl = 0.04; o.kl = -0.12 - 0.15 * v[2]; o.hr = 0.02; o.kr = -0.1; o.zl = -0.1 - 0.25 * v[3]; o.zr = 0.1 + 0.15 * v[2];
      o.ra = v[4] < 0.55 ? 0.18 : 2.95; o.rz = 0.3 + 0.5 * v[5]; o.rb = 0.2; o.la = v[5] < 0.45 ? 0.18 : 2.95; o.lz = -0.3 - 0.5 * v[4]; o.lb = 0.25;      // yüzüstü: yer önde (−z) → hafif öne / başın üstünde
    } else {
      const sL = fd === LEFT ? 1 : -1;                                // alttaki taraf: sol düşüşte sol kol / bacak
      o.tx = -0.12; o.tz = 0; o.hx = 0.05; o.hy = 0; o.hz = 0.28 * sL;
      const top = [0.75, -1.15], bot = [0.2, -0.35];
      if (sL > 0) { o.hl = bot[0]; o.kl = bot[1]; o.hr = top[0] + 0.2 * v[2]; o.kr = top[1]; } else { o.hr = bot[0]; o.kr = bot[1]; o.hl = top[0] + 0.2 * v[2]; o.kl = top[1]; }
      o.zl = -0.05; o.zr = 0.05;
      if (sL > 0) { o.la = 1.35; o.lz = -0.15; o.lb = 0.5; o.ra = 0.7 + 0.4 * v[4]; o.rz = -0.25; o.rb = 1.0; }
      else { o.ra = 1.35; o.rz = 0.15; o.rb = 0.5; o.la = 0.7 + 0.4 * v[4]; o.lz = 0.25; o.lb = 1.0; }
    }
  }
  _flailPose(D, o) {
    const fd = D.fd;
    if (fd === BACK || D.st === ST.blast) { o.ra = 1.6 + 0.3 * D.v[3]; o.rz = 0.55 + (D.st === ST.blast ? 0.5 : 0); o.rb = 0.4; o.la = 1.4 + 0.4 * D.v[4]; o.lz = -0.6 - (D.st === ST.blast ? 0.5 : 0); o.lb = 0.5; }
    else if (fd === FWD) { o.ra = 1.15; o.rz = 0.25; o.rb = 0.9; o.la = 1.05; o.lz = -0.3; o.lb = 0.95; }
    else { const sL = fd === LEFT ? 1 : -1; o.ra = sL > 0 ? 1.7 : 0.9; o.rz = sL > 0 ? 0.75 : 0.2; o.rb = 0.4; o.la = sL > 0 ? 0.9 : 1.7; o.lz = sL > 0 ? -0.2 : -0.75; o.lb = 0.4; }
  }
  get _rest() { return (this.__rest ||= mkT()); }
  get _flail() { return (this.__fl ||= mkT()); }

  // kök dönüşümü (konum + dönüş) → model
  _root(s, D, T) {
    const m = s.model, root = m.root;
    root.rotation.order = 'YXZ';
    root.rotation.set(T.P + D.sP * T.land, D.yaw + wrap(D.yaw0 - D.yaw) * (T.yw || 0), T.R + D.sR * T.land);
    const yl = (D.base + D.lift0) * T.land;
    root.position.set(s.pos.x + T.ox, s.pos.y + (m.groundOffset ?? 0) + T.Y + yl + D.corr * T.land, s.pos.z + T.oz);
  }
  _apply(s, D, t) {
    const T = this.T, m = s.model, p = m.parts;
    this._target(D, t, T);
    if (D.st === ST.prone) T.land = 0;
    T.yw = 1 - sm(0, 0.2, t);
    this._root(s, D, T);
    const w = 1 - sm(0, 0.15, t);                                     // ilk 0,15 sn: son canlı pozdan geçiş
    const dr = Math.max(T.dr, D.dr0 * w);
    const L = p.legs.L, R = p.legs.R;
    L.hip.rotation.x = lerp(T.hl, D.leg0[0], w); L.knee.rotation.x = lerp(T.kl, D.leg0[1], w);
    R.hip.rotation.x = lerp(T.hr, D.leg0[2], w); R.knee.rotation.x = lerp(T.kr, D.leg0[3], w);
    L.hip.rotation.z = lerp(T.zl, D.leg0[4], w); R.hip.rotation.z = lerp(T.zr, D.leg0[5], w);
    L.hip.position.y = 0.88 - dr; R.hip.position.y = 0.88 - dr;
    if (L.foot) L.foot.rotation.x = -(L.hip.rotation.x + L.knee.rotation.x) * 0.5 + 0.35;
    if (R.foot) R.foot.rotation.x = -(R.hip.rotation.x + R.knee.rotation.x) * 0.5 + 0.35;
    p.torso.position.y = 1.17 - dr; p.torso.position.x = 0;
    p.torso.rotation.set(lerp(T.tx, D.tor0[0], w), lerp(T.ty, D.tor0[1], w), lerp(T.tz, D.tor0[2], w));
    p.head.rotation.set(lerp(T.hx, D.hd0[0], w), lerp(T.hy, D.hd0[1], w), lerp(T.hz, D.hd0[2], w));
    this._arm(p.armR, T.ra, T.rz, T.rb, D.q0[0], D.q0[1], w);
    this._arm(p.armL, T.la, T.lz, T.lb, D.q0[2], D.q0[3], w);
  }
  // kol: üst kol yönü (öne kalkış a, yana açılış z) + dirsek bükümü b; ayırma yok
  _arm(arm, a, z, b, q0u, q0f, w) {
    const l1 = arm.l1 ?? 0.32, l2 = arm.l2 ?? 0.3;
    _e.set(a, 0, z, 'ZYX'); _q.setFromEuler(_e);
    if (w > 0) _q.slerp(q0u, w);
    arm.upper.position.copy(arm.shoulder); arm.upper.quaternion.copy(_q);
    _v.copy(DOWN).applyQuaternion(_q).multiplyScalar(l1).add(arm.shoulder);       // dirsek
    _e.set(b, 0, 0); _q2.setFromEuler(_e); _q2.premultiply(_q);
    if (w > 0) _q2.slerp(q0f, w);
    arm.fore.position.copy(_v); arm.fore.quaternion.copy(_q2);
    arm.hand.position.copy(DOWN).applyQuaternion(_q2).multiplyScalar(l2).add(_v); arm.hand.quaternion.copy(_q2);
  }

  // destek kotu: (x, y, z)'den aşağı ışın (kutu tepesi / çatı / arazi); yoksa NaN
  _sup(x, y, z, maxT) {
    const W = this.g.world; if (!W) return NaN;
    _o.set(x, y, z);
    const h = W.raycast(_o, DOWN, maxT, _hit);
    return h ? y - h.t : NaN;
  }
  // gövde boyunca yer var mı: diz / göğüs hizasında yatay ışın + baş ucunda zemin (kutu üstü değil, uçurum değil)
  _free(x, y, z, dir, len) {
    const W = this.g.world;
    _o.set(x, y + 0.45, z); if (W.raycast(_o, dir, len, _hit)) return false;
    _o.set(x, y + 1.05, z); if (W.raycast(_o, dir, len, _hit)) return false;
    const L1 = len - 0.2, h = this._sup(x + dir.x * L1, y + 0.7, z + dir.z * L1, 1.8);
    return Number.isFinite(h) && h - y < 0.45 && h - y > -0.75;
  }
  // görünen ağların en alt köşesi (dünya y): son pozun zemine oturması için
  _minY(root) {
    let mn = Infinity;
    const walk = (o) => {
      if (!o.visible && o !== root) return;
      if (o.isMesh && o.geometry?.attributes?.position && !o.material?.transparent) {
        const pa = o.geometry.attributes.position, dr = o.geometry.drawRange, a = dr.start, b = Math.min(pa.count, a + dr.count), me = o.matrixWorld.elements;
        for (let i = a; i < b; i++) {
          const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
          const wy = me[1] * x + me[5] * y + me[9] * z + me[13];
          if (wy < mn) mn = wy;
        }
      }
      for (const c of o.children) walk(c);
    };
    walk(root);
    return mn;
  }

  // ── elden düşen silah: modelin kendi silahı sahneye alınır (yeni ağ yok), doğunca eline döner ──
  dropWeapon(s, D, instant) {
    const m = s.model, w = m.weapon, mount = m.parts.mount;
    if (!w || w.parent !== mount || !w.visible) return;
    const r = (s._wd ||= { s, w: null, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scl: new THREE.Vector3(), qT: new THREE.Quaternion(), vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, floor: 0, done: true, model: null });
    r.w = w; r.model = m; r.pos.copy(w.position); r.quat.copy(w.quaternion); r.scl.copy(w.scale);
    m.root.updateMatrixWorld(true);
    this.g.scene.attach(w);
    const v = D.v;
    r.vx = (s.vel.x || 0) * 0.3 + D.ix * (D.st === ST.blast ? 3.2 : 1.1) + (v[2] - 0.5) * 0.8;
    r.vz = (s.vel.z || 0) * 0.3 + D.iz * (D.st === ST.blast ? 3.2 : 1.1) + (v[3] - 0.5) * 0.8;
    r.vy = D.st === ST.blast ? 3.2 : 0.9 + v[1] * 0.6;
    r.wx = (v[4] - 0.5) * 9; r.wy = (v[5] - 0.5) * 6; r.wz = (v[0] - 0.5) * 9;
    const fl = this._sup(w.position.x + r.vx * 0.45, w.position.y + 0.2, w.position.z + r.vz * 0.45, 4);
    r.floor = (Number.isFinite(fl) ? fl : s.pos.y + D.base) + 0.045;
    _e.set(0, D.yaw + (v[1] - 0.5) * 2.4, (v[0] < 0.5 ? 1 : -1) * Math.PI / 2, 'YXZ'); r.qT.setFromEuler(_e);      // yan yatmış
    r.done = false;
    this.stats.drops++;
    if (instant || this.sims.length >= MAX_SIM) this._settle(r, true);
    else this.sims.push(r);
  }
  _settle(r, snap) {
    const w = r.w;
    if (snap) { w.position.x += r.vx * 0.5; w.position.z += r.vz * 0.5; }
    w.position.y = r.floor; w.quaternion.copy(r.qT); r.done = true;
  }
  _restoreWeapon(s) {
    const r = s._wd; if (!r || !r.w) return;
    const w = r.w; r.w = null; r.done = true;
    const i = this.sims.indexOf(r); if (i >= 0) this.sims.splice(i, 1);
    if (w.parent === this.g.scene) {
      w.removeFromParent();
      if (r.model === s.model && r.model.weapon === w) { r.model.parts.mount.add(w); w.position.copy(r.pos); w.quaternion.copy(r.quat); w.scale.copy(r.scl); }
    }
    w.visible = true;
  }

  // ── kafadan öldürme: kask / şapka (kafa ağının sonuna dizilen parçalar, geo.mergeVC) kafadan ayrılıp uçar ──
  popHat(s, D) {
    const g = this.g, m = s.model, head = m.parts.head;
    if (s._hatPop) return;                                            // olay geç gelip animasyon yeniden başladıysa ikinci kez uçmaz
    s._hatPop = true;
    head.updateWorldMatrix(true, false);
    head.matrixWorld.decompose(_v, _q, _sc);
    // kafadan küçük parçacık bulutu (mevcut efekt havuzu: kan + gri kırıntı)
    _d.set(D.ix, 0.35, D.iz).normalize();
    _v2.set(0, 0.12, 0).applyMatrix4(head.matrixWorld);
    g.effects.blood?.(_v2, 10, _d);
    g.effects.spark?.(_v2, 4, UP, '#d9d4c8', 3);
    const hm = m.hatMeshes;
    if (!hm || !hm.length) return;
    let slot = this.hats.find((h) => !h.owner) || this.hats.reduce((a, b) => (a.at < b.at ? a : b));
    if (slot.owner && slot.owner !== s) this._hideHat(slot);
    slot.owner = s; slot.at = g.time;
    const c0 = hm[0].userData.hatC;
    _v2.copy(c0).applyMatrix4(head.matrixWorld);                     // kaskın merkezi (dünya)
    slot.g.position.copy(_v2); slot.g.quaternion.copy(_q); slot.g.scale.copy(_sc);
    for (let j = 0; j < slot.ms.length; j++) {
      const ms = slot.ms[j], src = hm[j];
      if (!src) { ms.visible = false; continue; }
      ms.geometry = src.userData.hatGeo; ms.material = src.material; ms.position.copy(c0).negate(); ms.visible = true;
      src.geometry.setDrawRange(0, src.userData.hatStart);
    }
    slot.g.visible = true;
    const v = D.v;
    slot.vx = D.ix * 2.4 + (v[2] - 0.5) * 1.2; slot.vz = D.iz * 2.4 + (v[3] - 0.5) * 1.2; slot.vy = 2.6 + v[4] * 1.2;
    slot.wx = (v[0] - 0.5) * 16 + 7 * Math.sign(D.ix || 1); slot.wy = (v[5] - 0.5) * 8; slot.wz = (v[1] - 0.5) * 14;
    const fl = this._sup(_v2.x + slot.vx * 0.7, _v2.y + 0.3, _v2.z + slot.vz * 0.7, 5);
    slot.hh = 0.07 * _sc.y;
    slot.floor = (Number.isFinite(fl) ? fl : s.pos.y + D.base) + slot.hh;
    _e.set(v[1] < 0.6 ? 0 : Math.PI, (v[2] - 0.5) * 6, 0.25 * (v[3] - 0.5), 'YXZ'); slot.qT.setFromEuler(_e);   // yere düz (bazen ters) oturur
    slot.done = false;
    this.stats.pops++;
  }
  _hideHat(slot) {
    const o = slot.owner; slot.owner = null; slot.g.visible = false; slot.done = true;
    for (const ms of slot.ms) ms.visible = false;
    void o;
  }

  // doğuş / model yenilenmesi: silah eline, kask başına
  restore(s) {
    this._restoreWeapon(s);
    for (const h of this.hats) if (h.owner === s) this._hideHat(h);
    const hm = s.model?.hatMeshes;
    if (hm) for (const x of hm) x.geometry.setDrawRange(0, Infinity);
    s._dsSeen = -1; s._hatPop = false;
    if (s._dth) { s._dth.restDone = false; }
  }

  // her kare: düşen silah / kask fiziği (basit: yerçekimi, tek sekme, yere düz oturma)
  update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    for (let i = this.sims.length - 1; i >= 0; i--) {
      const r = this.sims[i], w = r.w;
      if (!w || w.parent !== this.g.scene) { this.sims.splice(i, 1); continue; }
      if (this._phys(w, r, dt, 0.28)) this.sims.splice(i, 1);
    }
    for (const h of this.hats) {
      const o = h.owner;
      if (!o) continue;
      if (o.alive || o.deadT >= 5) { this._hideHat(h); continue; }      // gövde kaybolunca (deadT 5 sn) kask da
      if (!h.done && this._phys(h.g, h, dt, 0.35)) h.done = true;
    }
    for (const s of this.g.soldiers) { const r = s._wd; if (r && r.w && !s.alive && s.deadT >= 5 && r.w.visible) r.w.visible = false; }
  }
  _phys(o, r, dt, bnc) {
    r.vy -= 9.8 * dt * (this.g.mode?.space ? 0.35 : 1);
    o.position.x += r.vx * dt; o.position.y += r.vy * dt; o.position.z += r.vz * dt;
    if (r.wx) o.rotateX(r.wx * dt); if (r.wy) o.rotateY(r.wy * dt); if (r.wz) o.rotateZ(r.wz * dt);
    if (o.position.y <= r.floor && r.vy < 0) {
      o.position.y = r.floor;
      if (r.vy < -2.2) { r.vy = -r.vy * bnc; r.vx *= 0.45; r.vz *= 0.45; r.wx *= 0.4; r.wy *= 0.4; r.wz *= 0.4; return false; }
      r.vx *= 0.2; r.vz *= 0.2; r.vy = 0; r.wx = r.wy = r.wz = 0;
      o.quaternion.slerp(r.qT, Math.min(1, dt * 14));
      if (o.quaternion.angleTo(r.qT) < 0.02) { o.quaternion.copy(r.qT); r.done = true; return true; }
    }
    return false;
  }

  // ── ölenin kamerası: gövdeyle birlikte devrilir (birinci şahıs). true: kamerayı bu kurdu ──
  // Animasyon bitince göz yerde kalır, bakış yumuşakça öldürene döner (player.js eski ölüm kamerasının yaptığı gibi)
  eye(s, cam, dt, killer) {
    if (!s.model) return false;
    if (s._dsSeen !== s.dSeq || !s._dth) this.start(s);
    const D = s._dth, T = this.T, t = D.t0 === -99 ? D.dur + 1 : s.deadT;
    this._target(D, Math.min(t, D.dur + 0.2), T);
    if (D.st === ST.prone) T.land = 0;
    _e.set(T.P + D.sP * T.land, D.yaw, T.R + D.sR * T.land, 'YXZ');
    _q.setFromEuler(_e);
    _v.set(0, 1.6 - T.dr, -0.08).applyQuaternion(_q);
    const yl = (D.base + D.lift0) * T.land;
    cam.position.set(s.pos.x + T.ox + _v.x, s.pos.y + T.Y + yl + D.corr * T.land + _v.y, s.pos.z + T.oz + _v.z);
    const gy = this._sup(cam.position.x, cam.position.y + 0.6, cam.position.z, 3);
    const floorY = (Number.isFinite(gy) ? gy : s.pos.y + D.base) + 0.28;
    if (cam.position.y < floorY) cam.position.y = floorY;             // göz yerin içine girmesin (yüzüstü düşüşte yer kameraya yapışmasın)
    // bakış: gövdenin devrilmesi (geri: gökyüzüne, ileri: yere, yana: yatık) + kafadan vuruşta baş geri savrulur
    let pitch = D.pitch0 + T.eyeP * 0.6, roll = 0;
    if (D.st !== ST.prone) {
      const P = T.P + D.sP * T.land, R = T.R + D.sR * T.land;
      pitch += D.fd === FWD ? Math.max(-0.95, P * 0.6) : P * 0.75;
      roll = R * 0.75;
    }
    const k = sm(D.dur + 0.1, D.dur + 1.0, t);                        // sonra öldürene doğru yumuşakça dön
    let yaw = D.yaw;
    if (killer && k > 0) {
      const ty = Math.atan2(-(killer.pos.x - cam.position.x), -(killer.pos.z - cam.position.z));
      D.camYaw = (D.camYaw ?? D.yaw) + Math.max(-2 * dt, Math.min(2 * dt, wrap(ty - (D.camYaw ?? D.yaw)) * k));
      yaw = D.camYaw;
      pitch = lerp(pitch, -0.12, k); roll = lerp(roll, roll * 0.4 + 0.25 * Math.sign(roll || 1), k);
    } else if (k <= 0) D.camYaw = D.yaw;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(Math.max(-1.3, Math.min(1.3, pitch)), yaw, roll);
    return true;
  }
}
