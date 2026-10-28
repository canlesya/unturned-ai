import * as THREE from 'three';
import { makeTrack } from './track.js';
import { TUNE } from './balance.js';
import { WSTATS } from './stats.js';
import { t } from '../i18n/index.js';
import '../i18n/payload.js';
import { PayloadHud } from './payloadHud.js';

// ───── Vagon modu (payload) ─────
// Saldıran (Mavi) patlayıcı yüklü vagonu raylar boyunca iter; vagon yalnız yarıçapında saldıran varken ve savunan (Kırmızı) yokken ilerler
// (1 kişi taban hız, her ek kişi +%25, en çok 3 kişi). İkisi de varsa ÇEKİŞME: durur. Saldıran plBackDelay sn yoksa geri kayar, ama geçilen kontrol noktasının gerisine düşmez.
// Kontrol noktası: süreye +plBonus, iki takımın doğuş avlusu ileri kayar (map.payload.stages). Uç: maden kapısı patlar → Mavi kazanır. Süre biterken saldıran vagondaysa UZATMA.
// Karar çevrimdışında oyunda, çevrimiçinde sunucuda (Game.updateMode → update); istemci snapshot 'pl' alanından konum + durum alır (applyNet / netFrame).
// Vagon hareketli bir AABB çarpışma kutusudur: mermiyi keser, içinden geçilmez; yoluna giren savaşçıyı iter. Izgaraya rayın geçtiği hücrelere bir kez eklenir.
export const ATK = 'blue', DEF = 'red';
const HALF = 0.75, CART_H = 1.45, SR = 0.32;
const ST = { idle: 0, push: 1, contest: 2, back: 3, block: 4 };
const ST_NAME = Object.keys(ST);

export class Payload {
  constructor(game) {
    const P = (this.def = game.map.payload);
    this.g = game;
    this.track = makeTrack(P.track, P.radius);
    this.cps = P.checkpoints.map((i) => this.track.corners[i]);           // kontrol noktası yol mesafeleri
    this.end = this.track.len - 0.01;
    this.start = P.start || 0;
    this.d = this.start; this.shown = this.d; this.netD = this.d;
    this.reached = 0; this.stage = 0;
    this.pushers = 0; this.blockers = 0; this.state = 'idle'; this.idleT = 0;
    this.over = false; this.overGrace = 0; this.done = false;
    this.scoreT = 0; this.supT = 0; this.rumbleT = 0;
    this.p = this.track.at(this.d, {});
    // hareketli çarpışma kutusu: rayın geçtiği tüm ızgara hücrelerine bir kez eklenir (World.query hücreden toplar, _hits gerçek sınırı denetler)
    this.col = { min: [0, 0, 0], max: [0, CART_H, 0], tag: 'cart', oid: 'vagon', _s: 0, _i: -1 };
    const W = game.world, keys = new Set(), q = {};
    for (let d = 0; d <= this.track.len + 0.5; d += 0.5) {
      this.track.at(d, q);
      for (const ox of [-HALF - 0.2, HALF + 0.2]) for (const oz of [-HALF - 0.2, HALF + 0.2]) keys.add(Math.floor((q.x + ox) / W.cell) + ',' + Math.floor((q.z + oz) / W.cell));
    }
    for (const kk of keys) { let a = W.grid.get(kk); if (!a) W.grid.set(kk, (a = [])); a.push(this.col); }
    this.setBox();
    this.applyStage(0);
    if (!game.headless) this.buildVisual();
  }

  // ── aşamalar: doğuş + üs bölgesi ──
  applyStage(i) {
    const S = this.def.stages[Math.min(i, this.def.stages.length - 1)], m = this.g.map;
    this.stage = i;
    m.spawns.blue = S.blue; m.spawns.red = S.red;
    m.baseZones = { blue: S.zones.blue, red: S.zones.red };
  }

  // 12.197 doğma süresi çarpanı: sabit (plAtkRespawn / plDefRespawn) × uzaklık dengesi. Vagona doğuşu daha YAKIN olan takım daha geç doğar (yürüyüş farkının
  // yarısı kadar), uzak olan daha erken: 1 + (rakibin uzaklığı − kendi uzaklığın) / plSpawnEq (80 m), 0,7–1,4 arası (0 = kapalı). Eskiden son aşamada savunan doğuşu
  // vagona ~20 m, saldıranınki ~33 m iken savunan yine ×0,75 ile daha çabuk doğuyordu: vagon 20 maçın yarısında %87–99'da, 2:1 öldürmeyle duruyordu.
  respawnMul(team) {
    const base = team === ATK ? TUNE.plAtkRespawn : TUNE.plDefRespawn, k = TUNE.plSpawnEq;
    if (!(k > 0)) return base;
    const dOf = (tm) => { const pts = this.g.map.spawns[tm]; let s = 0; for (const q of pts) s += Math.hypot(q.x - this.p.x, q.z - this.p.z); return s / pts.length; };
    const own = dOf(team), oth = dOf(team === ATK ? DEF : ATK);
    return base * Math.max(0.7, Math.min(1.4, 1 + (oth - own) / k));
  }

  get floorD() { return this.reached ? this.cps[this.reached - 1] : this.start; }
  get progress() { return Math.max(0, Math.min(1, (this.d - this.start) / (this.end - this.start))); }
  get nextName() { return this.def.names[Math.min(this.reached, this.def.names.length - 1)]; }
  distTo(s) { return Math.hypot(s.pos.x - this.p.x, s.pos.z - this.p.z); }

  setBox() {
    const p = this.track.at(this.shown, this.p), c = this.col;
    c.min[0] = p.x - HALF; c.max[0] = p.x + HALF; c.min[2] = p.z - HALF; c.max[2] = p.z + HALF;
  }

  // yoluna giren savaşçıyı vagonun dışına it (en az girişim ekseni)
  pushOut(s) {
    const c = this.col;
    if (!s.alive || s.fly || s.pos.y >= c.max[1] - 0.05 || s.pos.y + s.height <= c.min[1]) return;
    const px = Math.min(s.pos.x + SR - c.min[0], c.max[0] - (s.pos.x - SR)), pz = Math.min(s.pos.z + SR - c.min[2], c.max[2] - (s.pos.z - SR));
    if (px <= 0 || pz <= 0) return;
    if (px < pz) s.pos.x += (s.pos.x < (c.min[0] + c.max[0]) / 2 ? -px : px) * 1.02;
    else s.pos.z += (s.pos.z < (c.min[2] + c.max[2]) / 2 ? -pz : pz) * 1.02;
  }

  // ── yetkili güncelleme (çevrimdışı oyun / sunucu): Game.updateMode içinde, checkEnd'den önce ──
  update(dt) {
    const g = this.g, R = TUNE.plRadius, p = this.p;
    let n = 0, m = 0;
    for (const s of g.soldiers) {
      if (!s.alive || s.vacant || Math.abs(s.pos.y - 0) > 3 || Math.hypot(s.pos.x - p.x, s.pos.z - p.z) > R) continue;
      if (s.team === ATK) n++; else if (s.team === DEF) m++;
    }
    this.pushers = n; this.blockers = m;
    const prevD = this.d;
    if (!this.done) {
      if (n > 0 && m === 0) { this.d = Math.min(this.end, this.d + TUNE.plSpeed * (1 + TUNE.plCrowd * (Math.min(n, 3) - 1)) * dt); this.idleT = 0; this.state = 'push'; }
      else if (n > 0) { this.idleT = 0; this.state = 'contest'; }
      else {
        this.idleT += dt;
        if (this.idleT > TUNE.plBackDelay && this.d > this.floorD) { this.d = Math.max(this.floorD, this.d - TUNE.plBackSpeed * dt); this.state = 'back'; }
        else this.state = m ? 'block' : 'idle';
      }
    }
    while (this.reached < this.cps.length && this.d >= this.cps[this.reached]) { this.reached++; this.onCheckpoint(this.reached, true); }
    this.shown = this.netD = this.d;
    this.setBox();
    for (const s of g.soldiers) this.pushOut(s);
    // puan: itenlere / durduranlara saniyede 2; vagon yanındaki saldırana ikmal (2 sn'de %8)
    this.scoreT += dt;
    if (this.scoreT >= 1) {
      this.scoreT -= 1;
      for (const s of g.soldiers) {
        if (!s.alive || Math.hypot(s.pos.x - p.x, s.pos.z - p.z) > R) continue;
        if ((s.team === ATK && this.state === 'push') || (s.team === DEF && (this.state === 'contest' || this.state === 'block'))) {
          s.score += 2; s.plT = (s.plT || 0) + 1;
          if (s.plT % 5 === 0 && s.isPlayer && !g.headless) g.hud.popup(s.team === ATK ? t('payload.popEscort') : t('payload.popDefend'));
        }
      }
    }
    this.supT += dt;
    if (this.supT >= 2) {
      this.supT = 0;
      for (const s of g.soldiers) if (s.alive && s.team === ATK && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < R) for (const it of s.items) { const st = WSTATS[it.id]; if (st && (st.kind === 'gun' || st.kind === 'launcher') && st.reserve) it.reserve = Math.min(st.reserve, it.reserve + Math.ceil(st.reserve * TUNE.plSupply)); }
    }
    // tickets: ilerleme yüzdesi (oda listesi / skor tablosu); gerçek kazanma kuralı result()'ta
    g.tickets.blue = Math.round(this.progress * 100); g.tickets.red = 100 - g.tickets.blue;
    // uzatma: süre bitti ama saldıran vagonda → itmeye devam; vagondan ayrılınca kısa pay sonra biter
    if (g.timeLeft !== Infinity && g.timeLeft <= 0) {
      g.timeLeft = 0;
      if (n > 0) { if (!this.over) { this.over = true; g.netEvent({ e: 'plo' }); this.notifyOver(); } this.overGrace = TUNE.plOverGrace; }
      else if (this.over) this.overGrace -= dt;
    }
    if (this.d >= this.end && !this.done) this.finish();
    if (!g.headless) this.frameVisual(dt, this.d - prevD);
  }

  // kazanan: [takım, gerekçe] ya da null
  result() {
    const g = this.g;
    if (this.done) return [ATK, t('payload.winAtk')];
    if (g.timeLeft !== Infinity && g.timeLeft <= 0 && (!this.over || this.overGrace <= 0)) return [DEF, t('payload.winDef', { pct: Math.min(99, Math.floor(this.progress * 100)), name: this.nextName })];      // 12.197 durdurulan vagon '%100' yazmasın (%99,6 yuvarlanıyordu)
    return null;
  }

  onCheckpoint(i, auth) {
    const g = this.g;
    if (auth) {
      if (g.timeLeft !== Infinity) g.timeLeft += TUNE.plBonus;
      g.netEvent({ e: 'plc', i });
      for (const s of g.soldiers) if (s.alive && s.team === ATK && this.distTo(s) < TUNE.plRadius + 2) { s.score += 100; if (s.isPlayer && !g.headless) g.hud.popup(t('payload.popCp'), true); }
    }
    this.applyStage(i);
    if (g.headless || !g.hud) return;
    const me = g.playerSoldier, name = this.def.names[i - 1];
    g.hud.toast(me && me.team === ATK ? t('payload.cpAtk', { name, bonus: TUNE.plBonus }) : t('payload.cpDef', { name }), me && me.team === ATK ? '#7ec8ff' : '#ff8a7a');
    g.sfx.capture?.();
    this.ui?.flash();
  }

  notifyOver() { if (!this.g.headless && this.g.hud) { this.g.hud.toast(t('payload.overtime'), '#ffd36a'); this.ui?.flash(); } }

  // vagon maden ağzına ulaştı: kapı patlar (görsel), maç biter
  finish() {
    this.done = true; this.d = this.end; this.state = 'idle';
    const g = this.g;
    if (g.headless) return;
    const at = new THREE.Vector3(30, 1.6, -34.4);
    const dp = this.def.door?.position; if (dp) at.set(dp.x, 1.8, dp.z + 0.6);
    for (const [dx, dy, r] of [[0, 0, 7], [-1.8, 1.2, 5], [1.9, 0.6, 5], [0, 2.6, 6]]) g.effects.explosion(new THREE.Vector3(at.x + dx, at.y + dy, at.z), r);
    g.sfx.explosion?.(at);
    g.effects.boomShake?.(at, 0.7, 60);      // 12.199d (eskiden haritanın her yerinde en az 0,35)
    if (this.def.door) this.def.door.visible = false;
    if (this.cart) this.cart.visible = false;
    if (this.ring) this.ring.visible = false;
  }

  // ── çevrimiçi istemci ──
  pack() { return [Math.round(this.d * 100) / 100, Math.min(7, this.pushers) | (Math.min(7, this.blockers) << 3) | (ST[this.state] << 6) | (this.over ? 512 : 0)]; }
  applyNet(a) {
    this.netD = a[0];
    const f = a[1] | 0;
    this.pushers = f & 7; this.blockers = (f >> 3) & 7; this.state = ST_NAME[(f >> 6) & 7] || 'idle';
    const over = !!(f & 512);
    if (over && !this.over) this.notifyOver();
    this.over = over;
    this.d = this.netD;
    while (this.reached < this.cps.length && this.netD >= this.cps[this.reached] - 0.01) { this.reached++; this.onCheckpoint(this.reached, false); }
    if (this.netD >= this.end - 0.02 && !this.done) { this.shown = this.netD; this.finish(); }
  }
  // istemci her karesi: gösterilen konum sunucuya yumuşak yaklaşır, çarpışma kutusu + yerel oyuncu itme
  netFrame(dt) {
    const diff = this.netD - this.shown, prev = this.shown;
    this.shown = Math.abs(diff) > 3 ? this.netD : this.shown + diff * Math.min(1, dt * 8);
    this.setBox();
    if (this.g.playerSoldier) this.pushOut(this.g.playerSoldier);
    this.frameVisual(dt, this.shown - prev);
  }

  // ── botlar: src/game/payloadBots.js (rol planı; buradan track / d / cps / reached / state / p / distTo okur) ──

  // ── görsel (yalnız tarayıcı) ──
  buildVisual() {
    const g = this.g, root = (this.cart = new THREE.Group());
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.15, flatShading: true, ...o });
    const box = (w, h, d, m, x, y, z, parent = root) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; parent.add(b); return b; };
    const iron = M('#3b3f45', { metalness: 0.4, roughness: 0.55 }), rust = M('#6e5444'), band = M('#2c2f33', { metalness: 0.4 }), wood = M('#8a6a44', { metalness: 0 }), tnt = M('#c4482e', { metalness: 0 }), wht = M('#efe8d8', { metalness: 0 });
    box(1.1, 0.2, 1.42, iron, 0, 0.3, 0);                                              // şasi
    box(1.38, 0.74, 1.44, rust, 0, 0.77, 0);                                           // kasa
    box(1.2, 0.04, 1.28, M('#2a2622'), 0, 1.15, 0);                                    // kasa içi
    for (const z of [-0.6, 0, 0.6]) box(1.42, 0.76, 0.08, band, 0, 0.77, z);           // demir kuşak
    for (const z of [-0.74, 0.74]) box(0.9, 0.12, 0.06, band, 0, 0.36, z);             // tampon
    this.wheels = [];
    for (const x of [-0.6, 0.6]) for (const z of [-0.46, 0.46]) {
      const w = new THREE.Group(); w.position.set(x, 0.22, z); root.add(w);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 12), iron); r.rotation.z = Math.PI / 2; r.castShadow = true; w.add(r);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.05), band); w.add(sp);
      this.wheels.push(w);
    }
    // kasa ağzında sarı-siyah tehlike şeridi (uzun kenarlar) + yük: kırmızı patlayıcı sandıkları, dinamit demeti, sarı zamanlayıcı kutusu (zarf 1,45 m)
    const yel = M('#e2b52c', { metalness: 0 }), blk = M('#1c1d20', { metalness: 0 });
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) box(0.02, 0.12, 0.18, i % 2 ? blk : yel, s * 0.716, 1.08, -0.63 + i * 0.18);
    for (const s of [-1, 1]) box(1.2, 0.12, 0.02, yel, 0, 1.08, s * 0.73);
    for (const [x, z, s] of [[-0.3, -0.33, 0.46], [0.3, -0.33, 0.42]]) { box(s, 0.3, s, tnt, x, 1.17 + 0.15, z); box(s + 0.02, 0.08, s * 0.62, wht, x, 1.32, z); }
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.56, 8), tnt); c.rotation.z = Math.PI / 2; c.position.set(0, 1.23 + Math.floor(i / 3) * 0.1, 0.18 + (i % 3) * 0.11); c.castShadow = true; root.add(c); }
    box(0.6, 0.03, 0.05, band, 0, 1.36, 0.29);                                         // demet bağı
    box(0.3, 0.16, 0.2, yel, -0.28, 1.25, 0.5); box(0.12, 0.05, 0.02, M('#ff3a20', { emissive: '#ff3a20', emissiveIntensity: 1.2 }), -0.28, 1.27, 0.61);   // zamanlayıcı
    // ışık direği: duruma göre renk (itiliyor mavi · çekişme sarı · geri kayıyor kırmızı · bekliyor beyaz)
    box(0.06, 0.55, 0.06, band, 0.56, 1.42, 0.62);
    this.beaconM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.4, roughness: 0.4 });
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), this.beaconM); this.beacon.position.set(0.56, 1.76, 0.62); root.add(this.beacon);
    g.scene.add(root);
    // itme yarıçapı halkası (zeminde)
    this.ringM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(TUNE.plRadius - 0.09, TUNE.plRadius, 56), this.ringM);
    this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 3;
    g.scene.add(this.ring);
    this.frameVisual(0, 0);
  }

  stateColor() {
    return this.state === 'push' ? '#4aa3ff' : this.state === 'contest' ? '#ffd36a' : this.state === 'back' ? '#ff5a43' : this.state === 'block' ? '#ff8a6a' : '#e8edf5';
  }

  frameVisual(dt, dd) {
    if (!this.cart) return;
    const p = this.track.at(this.shown, this.p);
    this.cart.position.set(p.x, 0.02, p.z);
    let a = p.yaw - this.cart.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
    this.cart.rotation.y += Math.abs(a) > 1.2 ? a : a * Math.min(1, dt * 10);
    for (const w of this.wheels) w.rotation.x -= dd / 0.22;
    const col = this.stateColor();
    this.beaconM.color.set(col); this.beaconM.emissive.set(col);
    this.beacon.scale.setScalar(this.state === 'contest' || this.state === 'back' ? 1 + 0.25 * Math.sin(this.g.time * 9) : 1);
    this.ringM.color.set(col); this.ringM.opacity = this.state === 'idle' ? 0.25 : 0.5;
    this.ring.position.set(p.x, 0.035, p.z);
    // tekerlek gıcırtısı (hareket ederken)
    if (Math.abs(dd) > 1e-4 && (this.rumbleT -= dt) <= 0) {
      this.rumbleT = 0.42;
      const pos = this.cart.position;
      if (pos.distanceTo(this.g.camera.position) < 45) this.g.sfx._noise?.({ pos, gain: 0.1, dur: 0.38, f0: 240, f1: 120, type: 'lowpass' });
    }
  }

  // her kare (tarayıcı): arayüz modülü
  frame(dt) {
    const g = this.g;
    if (g.headless || !g.hud || !g.hud.root) return;
    (this.ui ||= new PayloadHud(g, this)).update(dt);
  }

  dispose() {
    this.ui?.dispose();
    if (this.cart) this.g.scene.remove(this.cart, this.ring);
  }
}
