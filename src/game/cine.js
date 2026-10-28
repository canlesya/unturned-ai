// 12.217 Sinema kamerası ("yönetmen"): ?cine=1 (çevrimdışı autostart) ile açılır. HUD + birinci şahıs silah / eller kapalı, yerel oyuncu da bot gibi
// savaşır (autoplay); kamera botları / araçları kendiliğinden izler. Yalnız g.cine varken çalışır: normal oyunun hiçbir yolu bu dosyayı çağırmaz.
// Çekimler: chase (arkadan takip), side (yandan takip), orbit (yörünge / dolly), low (yer seviyesi geçiş), flyby (havada sabit, geçen helikopter),
// heliTop (tepeden helikopter takibi), sniper (omuz üstü), scope (dürbün), wide (çatışmanın üstünden geniş plan), squad (piyade takip).
// Yönetmen: araç olayları (saldırı turu, hareket eden tank / motor), patlamalar, öldürme yoğunluğu (heat.js), kulede keskin nişancı; araç patlayınca
// yavaş çekim. Kamera arazi / duvar içine girmez (arazi kotu + hedeften kameraya ışın; yaprak kalınlığı açı seçiminde).
// Kayıt (scripts/cinerec.mjs): cine.manual() → döngü durur; cine.frame(dt) = sabit adım sim + kamera + çizim (kare kare, takılmasız).
import * as THREE from 'three';
import { toWorld, noseDir, mgPitch, mgAt } from '../sim/vehicle.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _hit = {};
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const wrap = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
// araç türüne göre: hedef noktası yüksekliği, kameranın araca en çok yaklaşacağı mesafe
const vk = (v) => VK[v.def.heli ? 'heli' : v.def.moto ? 'moto' : v.type] || VK.jip;
const VK = { heli: { h: 1.6, min: 11 }, tank: { h: 1.6, min: 7.5 }, jip: { h: 1.1, min: 5.5 }, moto: { h: 0.9, min: 3.2 }, hmg: { h: 1, min: 2.5 }, atgm: { h: 1, min: 2.5 } };
// yönetmenin araç / asker çekim ayarları (kayıt betiğinde denenmiş değerler)
const PRESET = {
  heli: { chase: { d: 15, h: 3.2, lead: 30, lag: 7, tk: 16, x: 2.5, turn: 2 }, heliTop: { d: 16, h: 9, x: 6, lead: 30, down: 26, fov: 60, lag: 3, turn: 1.4 }, flyby: {}, side: { d: 22, h: 2, lag: 5 }, orbit: { r: 28, h: 6, w: 0.12 } },
  tank: { low: { ahead: 2.6, off: 7.5, h: 0.45, fov: 42 }, side: { d: 11, h: 1.5, lag: 5 }, chase: { d: 13, h: 3.5 }, orbit: { r: 15, h: 4, w: 0.1 } },
  moto: { chase: { d: 6.5, h: 1.6, lead: 10, x: 0.8, lag: 5, fov: 56, turn: 3 }, side: { d: 8.5, h: 1.3, f: 2, slide: -0.9, lag: 6 }, low: { ahead: 2.4, off: 6, h: 0.5 } },
  jip: { chase: { d: 9, h: 2.4, lag: 5 }, side: { d: 8.5, h: 1.3, f: 2, slide: -0.9, lead: 3, lag: 6 }, low: { ahead: 2.4, off: 6.5, h: 0.5 } },
  sniper: { d: 2.3, x: 0.85, h: 0.35, fov: 40, side: 1, snapT: true }, scope: { fov: 6.5, snapT: true }, squad: { d: 5.5, h: 1.5, x: 1.2, lead: 14, fov: 58, lag: 4, turn: 2 },
};
// 12.221 araç içi / yer çekimleri: nose (helikopter burnu: burun topunun baktığı yön), door (kapı nişancısının omzu: makinelinin yönü), turret (tank
// kulesinin arkası: namlu yönü), watch (yerde sabit kamera: geçen helikoptere / araca bakar; mix: helikopterin nişan noktasına doğru)
const INSIDE = new Set(['scope', 'sniper', 'nose', 'door', 'turret']);
export const CINE_TYPES = ['pair', 'chase', 'side', 'orbit', 'low', 'flyby', 'heliTop', 'sniper', 'scope', 'wide', 'squad', 'still', 'nose', 'door', 'turret', 'watch'];

export class Cine {
  constructor(g) {
    this.g = g;
    this.shot = null; this.timeScale = 1; this.slow = null; this.auto = true; this.log = [];
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.fov = 50; this.roll = 0;
    this.focus = new THREE.Vector3(); this.overlay = { scope: 0, nose: 0 };
    this.booms = [];                                                        // son patlamalar (yönetmen + yavaş çekim)
    const cam = g.camera; cam.far = Math.max(cam.far, 2600); cam.updateProjectionMatrix();
    document.body.classList.add('wb-cine');
    const st = (this._st = document.createElement('style'));
    st.textContent = 'body.wb-cine>:not(canvas){visibility:hidden!important}body.wb-cine canvas{cursor:none}';
    document.head.appendChild(st);
    g.on('vehboom', (e) => { const v = e?.v; if (v?.st && !e.quiet) this.onBoom(_a.set(v.st.x, v.st.y + 1, v.st.z), 3, v); });      // { v, quiet } (batma: sessiz)
    this._key = (e) => { if (e.code === 'Space' || e.code === 'KeyV') { e.preventDefault(); this.next(); } };
    addEventListener('keydown', this._key);
    // 12.221 burun / kapı çekiminde kendi helikopterinin ışık konisi (saydam koni ağı) kameranın önünü kaplamasın: yalnız çizimde gizlenir (ışık yanar)
    const vv = g.vehView;
    if (vv) { const f0 = vv.frame.bind(vv); vv.frame = (dt) => { f0(dt); const sh = this.shot; if (sh?.v && (sh.type === 'nose' || sh.type === 'door')) for (const b of vv.items[sh.v.idx]?.model?.userData?.beams || []) b.visible = false; }; }
  }
  dispose() { removeEventListener('keydown', this._key); this._st?.remove(); document.body.classList.remove('wb-cine'); }

  // Game.explode kancası (game.js): her patlama
  onBoom(p, w = 1, v = null) {
    if (!p) return;
    this.booms.push({ x: p.x, y: p.y, z: p.z, w, t: this.g.time, v });
    if (this.booms.length > 40) this.booms.shift();
    const sh = this.shot;
    if (!sh || !this.slowOk) return;
    const T = this.tpos(sh, _b);                                               // çerçevedeki hedef patladı / hedefin yakınında büyük patlama → yavaş çekim
    if (T && (v && sh.v === v || Math.hypot(p.x - T.x, p.z - T.z) < (w >= 3 ? 30 : 12))) this.slowMo(w >= 3 ? 0.22 : 0.35, w >= 3 ? 2.2 : 1.3);
  }
  slowMo(k, dur) { if (!this.slow || this.slow.k > k) this.slow = { k, dur, t: 0 }; }
  get slowOk() { return this.shot?.slow !== false; }

  // ── hedefler ──
  vehOf(sh) { const v = sh.v; return v && v.alive && v.st ? v : null; }
  tpos(sh, out) {
    if (sh.v && sh.v2) { const a = sh.v.st, b = sh.v2.st; if (!a || !b) return null; return out.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.5, (a.z + b.z) / 2); }      // iki araç: orta nokta
    if (sh.v) { const v = sh.v; if (!v.st) return null; const k = vk(v); return out.set(v.st.x, v.st.y + k.h, v.st.z); }
    if (sh.s) { const s = sh.s; if (!s.alive && !sh.keepDead) return sh.last ? out.copy(sh.last) : null; return s.center(out); }
    if (sh.p) return out.copy(sh.p);
    return null;
  }
  // ileri yön (yatay): araç gövdesi / helikopterde hız yönü (yavaşsa gövde) / asker bakışı
  tfwd(sh, out) {
    let yaw = 0;
    if (sh.v?.st) {
      const st = sh.v.st, sp = Math.hypot(st.vx, st.vz);
      yaw = st.yaw;
      if (sh.v.def.heli && sp > 4) yaw = Math.atan2(-st.vx, -st.vz);
    } else if (sh.s) yaw = sh.s.yaw;
    else yaw = sh.yaw || 0;
    return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  }
  tvel(sh, out) { if (sh.v?.st) return out.set(sh.v.st.vx, sh.v.st.vy || 0, sh.v.st.vz); if (sh.s) return out.copy(sh.s.vel); return out.set(0, 0, 0); }

  groundY(x, z) { const tm = this.g.map.fx?.tm; return tm?.renderedHeightAt ? Math.max(tm.renderedHeightAt(x, z), this.g.world.heightAt(x, z)) : this.g.world.heightAt(x, z); }
  // a (hedef) → b (kamera) arası örtü: 0 açık; katı engelde 10; yaprak kalınlığı m
  occl(a, b) {
    const W = this.g.world;
    if (!W.clear(a, b)) return 10;
    return this.g.sightMap ? this.g.sightMap.thickness(b, a, 6) : 0;
  }

  // ── çekim başlat ──
  // o: { type, v (araç) | s (asker) | p (nokta), dur, ...çekim ayarları }. Kesme: kamera yeni çekimin ilk pozuna oturur (blend > 0: yumuşak geçiş sn)
  cut(o) {
    const sh = { t: 0, dur: 7, side: Math.random() < 0.5 ? -1 : 1, ...o };
    if (o.p && !(o.p instanceof THREE.Vector3)) sh.p = new THREE.Vector3(o.p.x, o.p.y ?? this.groundY(o.p.x, o.p.z), o.p.z);
    if (sh.s && sh.s.alive) sh.last = sh.s.center(new THREE.Vector3());
    this.shot = sh; this.slow = null; this.timeScale = 1; this.roll = 0;
    const T = this.tpos(sh, _b);
    if (!T) { this.shot = null; return null; }
    sh.T = T.clone(); sh.F = this.tfwd(sh, new THREE.Vector3()); sh.hy = Math.atan2(-sh.F.x, -sh.F.z);
    this.setup(sh);
    this.pose(sh, 0);
    sh.P = sh.wp.clone(); sh.L = sh.wl.clone(); sh.fv = sh.wf;
    sh.pull = 1e9;
    if (!(o.blend > 0)) { this.pos.copy(sh.P); this.look.copy(sh.L); this.fov = sh.wf; }
    else sh.bl = { t: 0, d: o.blend, p: this.pos.clone(), l: this.look.clone(), f: this.fov };
    this.apply(0);
    this.log.push({ t: +this.g.time.toFixed(2), type: sh.type, v: sh.v ? sh.v.type + '#' + sh.v.idx : null, s: sh.s ? sh.s.id : null });
    return sh;
  }

  // çekimin sabit parametreleri (açı seçimi: hedeften açık görüşlü tarafı yeğle)
  setup(sh) {
    const T = sh.T, F = sh.F, R = _c.set(-F.z, 0, F.x);                                  // R: sağ (F × yukarı)
    const best = (cands) => {                                                          // aday kamera noktaları: en az örtülü olanı
      let bp = null, bs = 1e9;
      for (const c of cands) { const sc = this.occl(T, c) + (c.y < this.groundY(c.x, c.z) + 0.3 ? 20 : 0); if (sc < bs) { bs = sc; bp = c; } }
      return bp;
    };
    if (sh.type === 'low' || sh.type === 'flyby') {
      // hedefin önünde (yolunun üstünde değil, yanında) sabit kamera; hedef kameranın yanından geçer
      const V = this.tvel(sh, _d); let sp = Math.hypot(V.x, V.z); if (sp < 1) { V.copy(F).multiplyScalar(4); sp = 4; }
      const ahead = sh.ahead ?? (sh.type === 'flyby' ? 2.6 : 2.2), off = sh.off ?? (sh.type === 'flyby' ? 26 : 7), C = [];
      for (const sd of [sh.side, -sh.side]) for (const k of [1, 0.75, 1.3]) {
        const p = new THREE.Vector3(T.x + V.x * ahead * k + R.x * off * sd, 0, T.z + V.z * ahead * k + R.z * off * sd);
        p.y = sh.type === 'flyby' ? Math.max(T.y + (sh.dy ?? -6), this.groundY(p.x, p.z) + 3) : this.groundY(p.x, p.z) + (sh.h ?? 0.55);
        C.push(p);
      }
      sh.anchor = best(C);
    } else if (sh.type === 'wide' || sh.type === 'still') {
      if (!sh.ang) {
        let ba = 0, bs = 1e9;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + 0.3, r = sh.r ?? 80, p = _a.set(T.x + Math.sin(a) * r, 0, T.z + Math.cos(a) * r); p.y = Math.max(this.groundY(p.x, p.z) + 4, T.y + (sh.h ?? 40));
          const sc = this.occl(T, p); if (sc < bs) { bs = sc; ba = a; }
        }
        sh.ang = ba;
      }
    } else if (sh.type === 'orbit' && sh.ang == null) {
      let ba = 0, bs = 1e9;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, r = sh.r ?? 14, p = _a.set(T.x + Math.sin(a) * r, 0, T.z + Math.cos(a) * r); p.y = Math.max(this.groundY(p.x, p.z) + 1, T.y + (sh.h ?? 4));
        const sc = this.occl(T, p); if (sc < bs) { bs = sc; ba = a; }
      }
      sh.ang = ba;
    } else if ((sh.type === 'side' || sh.type === 'chase') && sh.pickSide !== false) {
      const D = sh.d ?? 10, a = new THREE.Vector3().copy(T).addScaledVector(R, D), b = new THREE.Vector3().copy(T).addScaledVector(R, -D);
      a.y += 2; b.y += 2;
      if (this.occl(T, b) + 0.5 < this.occl(T, a) && sh.type === 'side') sh.side = -1; else if (sh.type === 'side' && this.occl(T, a) + 0.5 < this.occl(T, b)) sh.side = 1;
    }
  }

  // istenen poz (sh.wp kamera, sh.wl bakış, sh.wf FOV) — yumuşatma apply()'da
  pose(sh, dt) {
    const T = sh.T, k = sh.t;
    if (!sh.wp) { sh.wp = new THREE.Vector3(); sh.wl = new THREE.Vector3(); sh.wf = 50; }
    const P = sh.wp, L = sh.wl;
    // ileri yönü yumuşat (gövde dönüşü kamerayı savurmasın)
    const F0 = this.tfwd(sh, _a), hy = Math.atan2(-F0.x, -F0.z);
    sh.hy += wrap(hy - sh.hy) * (dt ? damp(sh.turn ?? 2.2, dt) : 1);
    const F = sh.F.set(-Math.sin(sh.hy), 0, -Math.cos(sh.hy)), R = _c.set(-F.z, 0, F.x);
    switch (sh.type) {
      case 'chase': {
        const D = sh.d ?? 12, H = sh.h ?? 3.2;
        P.copy(T).addScaledVector(F, -D).addScaledVector(R, (sh.x ?? 1.2) * sh.side); P.y = T.y + H;
        L.copy(T).addScaledVector(F, sh.lead ?? 10); L.y = T.y + (sh.ly ?? 0.4);
        sh.wf = sh.fov ?? 52; break;
      }
      case 'side': {
        const D = sh.d ?? 10, H = sh.h ?? 1.6, f = (sh.f ?? 1) + (sh.slide ?? -0.6) * k;
        P.copy(T).addScaledVector(R, D * sh.side).addScaledVector(F, f); P.y = T.y + H;
        L.copy(T).addScaledVector(F, sh.lead ?? 2.5); L.y = T.y + (sh.ly ?? 0.2);
        sh.wf = sh.fov ?? 46; break;
      }
      case 'orbit': {
        const a = sh.ang + (sh.w ?? 0.16) * k, r = (sh.r ?? 14) + (sh.dr ?? 0) * k;
        P.set(T.x + Math.sin(a) * r, T.y + (sh.h ?? 4) + (sh.dh ?? 0) * k, T.z + Math.cos(a) * r);
        L.copy(T); L.y += sh.ly ?? 0;
        sh.wf = sh.fov ?? 48; break;
      }
      case 'low': case 'flyby': {
        P.copy(sh.anchor); if (sh.drift) P.addScaledVector(sh.drift, k);
        L.copy(T); L.y += sh.ly ?? (sh.type === 'low' ? 0.2 : 0);
        sh.wf = sh.fov ?? (sh.type === 'low' ? 44 : 40); break;
      }
      case 'heliTop': {
        P.copy(T).addScaledVector(F, -(sh.d ?? 16)).addScaledVector(R, (sh.x ?? 7) * sh.side); P.y = T.y + (sh.h ?? 9);
        L.copy(T).addScaledVector(F, sh.lead ?? 28); L.y = Math.max(this.groundY(L.x, L.z), T.y - (sh.down ?? 22));
        sh.wf = sh.fov ?? 58; break;
      }
      case 'sniper': case 'scope': {
        const s = sh.s, E = s.alive ? s.eye(_d) : _d.copy(T), yaw = s.yaw, pt = sh.type === 'sniper' ? Math.max(-0.3, Math.min(0.2, s.pitch)) : s.pitch;      // omuz üstü: göğe / yere bakarken çerçeve kaçmasın
        const dir = _b.set(-Math.sin(yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(yaw) * Math.cos(pt));
        const r = _a.set(Math.cos(yaw), 0, -Math.sin(yaw));
        if (sh.type === 'scope') { if (s.crouching) E.y = Math.max(E.y, s.pos.y + 1.55); P.copy(E).addScaledVector(dir, 0.25); L.copy(E).addScaledVector(dir, 120); sh.wf = sh.fov ?? 7; }
        else { P.copy(E).addScaledVector(dir, -(sh.d ?? 1.5)).addScaledVector(r, (sh.x ?? 0.62) * sh.side); P.y = Math.max(P.y + (sh.h ?? 0.22), s.pos.y + 1.95); L.copy(E).addScaledVector(dir, 60); sh.wf = sh.fov ?? 44; }      // çömelmişse siperin üstünden (kamera ayakta göz kotu)
        break;
      }
      case 'squad': {
        const D = sh.d ?? 4.5, H = sh.h ?? 1.7;
        P.copy(T).addScaledVector(F, -D).addScaledVector(R, (sh.x ?? 1) * sh.side); P.y = T.y + H;
        L.copy(T).addScaledVector(F, sh.lead ?? 12); L.y = T.y + 0.6;
        sh.wf = sh.fov ?? 55; break;
      }
      case 'pair': {                                                                // iki araç (helikopter düellosu): ikisini birden gören yan açı, yavaş dönüş
        const a = sh.v.st, b = sh.v2.st, dx = b.x - a.x, dz = b.z - a.z, AB = Math.hypot(dx, dz) || 1;
        if (sh.ots) {                                                                 // omuz üstü: A'nın arkasından B'ye bakış (ikisi de hep kadrajda)
          const ux = dx / AB, uz = dz / AB, rx = -uz, rz = ux;
          P.set(a.x - ux * (sh.d ?? 26) + rx * (sh.x ?? 9) * sh.side, a.y + (sh.h ?? 6), a.z - uz * (sh.d ?? 26) + rz * (sh.x ?? 9) * sh.side);
          L.set(a.x + dx * 0.62, a.y + (b.y - a.y) * 0.62 + 1, a.z + dz * 0.62); sh.wf = sh.fov ?? 50; break;
        }
        const na = Math.atan2(-dz / AB, dx / AB) + (sh.w ?? 0.04) * k, D = Math.max(sh.d ?? 40, AB * (sh.fit ?? 0.95));
        sh.pa = sh.pa == null ? na : sh.pa + wrap(na - sh.pa) * (dt ? damp(1.2, dt) : 1);
        P.set(T.x + Math.sin(sh.pa) * D * sh.side, T.y + (sh.h ?? 8), T.z + Math.cos(sh.pa) * D * sh.side);      // AB'ye dik
        L.copy(T); sh.wf = sh.fov ?? 50; break;
      }
      case 'nose': {                                                                 // 12.221 helikopter burnu: kamera burun topunun üstünde, topun yönüne
        const v = sh.v, st = v?.st; if (!st) break;
        const N = v.def.nose, pl = v.seats[0], nd = noseDir(st, N, pl?.gunAim, (sh._nd ||= {}));
        toWorld(st, N.f + (sh.f ?? 0.3), sh.x ?? 0, N.u + (sh.u ?? 0.42), P);
        const cp = Math.cos(nd.p + (sh.dp ?? -0.02));
        L.set(P.x - Math.sin(nd.y) * cp * 90, P.y + Math.sin(nd.p + (sh.dp ?? -0.02)) * 90, P.z - Math.cos(nd.y) * cp * 90);
        sh.wf = sh.fov ?? 62; sh.wr = -(st.roll || 0) * (sh.rk ?? 0.8); break;
      }
      case 'door': {                                                                 // 12.221 kapı nişancısı: omzunun arkasından makinelinin yönüne
        const v = sh.v, st = v?.st; if (!st) break;
        const seat = sh.seat ?? 1, gs = v.seats[seat], M = mgAt(v.def, seat), side = M?.arc?.[seat] ?? (seat === 2 ? 1 : -1);
        const sp = v.def.seat[seat];
        const E = toWorld(st, sp[0], sp[1], sp[2] + 0.75, _d);
        const rest = -side * Math.PI / 2, aw = Math.min(M?.arcW ?? 1.3, sh.aw ?? 0.85), rel = gs && gs.alive ? wrap(gs.yaw - st.yaw) : rest + (sh.yo ?? 0);
        const dy = st.yaw + rest + Math.max(-aw, Math.min(aw, wrap(rel - rest))), dp = gs && gs.alive && M ? mgPitch(st, M, dy, gs.pitch) : (sh.po ?? -0.5);      // kapı makinelisinin yayı (vehicleView ile aynı)
        sh.dy = sh.dy == null ? dy : sh.dy + wrap(dy - sh.dy) * (dt ? damp(sh.aimK ?? 6, dt) : 1);
        sh.dpp = sh.dpp == null ? dp : sh.dpp + (dp - sh.dpp) * (dt ? damp(sh.aimK ?? 6, dt) : 1);
        const ay = sh.dy, ap = Math.max(-0.95, Math.min(0.2, sh.dpp)), cp = Math.cos(ap);
        const dir = _b.set(-Math.sin(ay) * cp, Math.sin(ap), -Math.cos(ay) * cp), r = _a.set(Math.cos(ay), 0, -Math.sin(ay));
        // kabinin içinden, nişancının omzunun arkasından kapıya (yay ±0,85 rad: hep dışarı bakar). Geri çekilme yatayda: aşağı nişanda kamera tavana girmesin
        P.set(E.x + Math.sin(ay) * (sh.d ?? 1.25), E.y + (sh.h ?? 0.3), E.z + Math.cos(ay) * (sh.d ?? 1.25)).addScaledVector(r, (sh.x ?? 0.45) * (sh.xs ?? 1));
        L.copy(E).addScaledVector(dir, 70);
        sh.wf = sh.fov ?? 58; sh.wr = -(st.roll || 0) * (sh.rk ?? 0.6); break;
      }
      case 'turret': {                                                               // 12.221 tank kulesinin arkasından namlunun yönüne
        const v = sh.v, st = v?.st; if (!st || !v.def.turret) break;
        const tu = v.def.turret, C = toWorld(st, tu.f, 0, tu.pivot, _d), pt = (st.gp || 0) * 0.5 + (sh.dp ?? -0.03), cp = Math.cos(pt);
        sh.ty = sh.ty == null ? st.tyaw : sh.ty + wrap(st.tyaw - sh.ty) * (dt ? damp(sh.aimK ?? 5, dt) : 1);
        const dir = _b.set(-Math.sin(sh.ty) * cp, Math.sin(pt), -Math.cos(sh.ty) * cp), r = _a.set(Math.cos(sh.ty), 0, -Math.sin(sh.ty));
        P.copy(C).addScaledVector(dir, -(sh.d ?? 6.5)).addScaledVector(r, (sh.x ?? 1.1) * sh.side); P.y = C.y + (sh.h ?? 1.5);
        L.copy(C).addScaledVector(dir, 60); L.y = C.y + (sh.ly ?? 0.2);
        sh.wf = sh.fov ?? 50; break;
      }
      case 'watch': {                                                                // 12.221 yerde sabit kamera (sh.at: { x, z, h }); hedefe bakar
        if (!sh.anchor) { const a = sh.at; sh.anchor = new THREE.Vector3(a.x, (a.y ?? this.groundY(a.x, a.z)) + (a.h ?? 1.6), a.z); }
        P.copy(sh.anchor); if (sh.drift) P.addScaledVector(sh.drift, k);
        L.copy(T);
        const ap = sh.mix && sh.v?.seats[0]?.gunAim?.P;
        if (ap) { sh.am = sh.am ? sh.am.lerp(ap, dt ? damp(2, dt) : 1) : new THREE.Vector3().copy(ap); L.lerp(sh.am, sh.mix); }
        L.y += sh.ly ?? 0;
        if (sh.fit) { const D = P.distanceTo(T); sh.wf = Math.max(sh.fmin ?? 24, Math.min(sh.fov ?? 60, 2 * Math.atan(sh.fit / D) * 180 / Math.PI)); }
        else sh.wf = sh.fov ?? 55;
        break;
      }
      case 'wide': case 'still': {
        const a = sh.ang + (sh.w ?? (sh.type === 'still' ? 0 : 0.035)) * k, r = (sh.r ?? 80) + (sh.dr ?? 0) * k;
        P.set(T.x + Math.sin(a) * r, 0, T.z + Math.cos(a) * r); P.y = Math.max(this.groundY(P.x, P.z) + 4, T.y + (sh.h ?? 40) + (sh.dh ?? 0) * k);
        L.copy(T); L.y += sh.ly ?? 0;
        sh.wf = sh.fov ?? 50; break;
      }
    }
    if (sh.zoom) sh.wf *= 1 + sh.zoom * ease(k / sh.dur);                              // yavaş itme (zoom < 0) / çekilme
  }

  // kameranın duvar / arazi / araç içine girmemesi
  solve(sh, P, T, dt) {
    const v = sh.v, kk = v ? vk(v) : null;
    if (INSIDE.has(sh.type) && sh.type !== 'scope' && sh.type !== 'sniper' || sh.type === 'watch') { const gy = this.groundY(P.x, P.z) + 0.4; if (P.y < gy) P.y = gy; return; }      // 12.221 araç içi / sabit yer kamerası: itme yok
    if (v?.st && kk && !(sh.type === 'scope' || sh.type === 'sniper' || (sh.type === 'pair' && !sh.ots))) {            // araca en az min m
      const dx = P.x - v.st.x, dy = P.y - v.st.y, dz = P.z - v.st.z, d = Math.hypot(dx, dy, dz);
      if (d < kk.min && d > 1e-3) P.set(v.st.x + dx / d * kk.min, v.st.y + dy / d * kk.min, v.st.z + dz / d * kk.min);
    }
    if (sh.type !== 'scope') {
      const dx = P.x - T.x, dy = P.y - T.y, dz = P.z - T.z, L = Math.hypot(dx, dy, dz);
      if (L > 0.5) {
        const d = _d.set(dx / L, dy / L, dz / L);
        const o = _a.copy(T).addScaledVector(d, 0.6);
        const h = this.g.world.raycast(o, d, L - 0.6, _hit);
        let allow = h ? Math.max(0.8, h.t + 0.6 - 0.45) : L;
        if (allow < sh.pull) sh.pull = allow; else sh.pull += (allow - sh.pull) * damp(1.5, dt || 0.016);      // içeri hemen, dışarı yavaş
        if (sh.pull < L) P.copy(T).addScaledVector(d, sh.pull);
      }
    }
    const gy = this.groundY(P.x, P.z) + (sh.type === 'low' ? 0.3 : 0.6);
    if (P.y < gy) P.y = gy;
  }

  // ── her kare ──
  update(dt) {
    const g = this.g, sh = this.shot;
    // yavaş çekim: oyun zamanı ölçeği (gerçek zaman dt)
    if (this.slow) {
      const S = this.slow; S.t += dt;
      const inK = ease(S.t / 0.25), outK = ease((S.dur - S.t) / 0.5);
      this.timeScale = 1 + (S.k - 1) * Math.min(inK, outK);
      if (S.t >= S.dur) { this.slow = null; this.timeScale = 1; }
    }
    if (this.auto && (!sh || sh.t >= sh.dur || this.lost(sh))) this.next();
    const s2 = this.shot;
    if (!s2) return this.apply(dt);
    const gdt = dt * (s2.realTime ? 1 : this.timeScale);
    s2.t += gdt;
    const T = this.tpos(s2, _b);
    if (T) { if (s2.s && s2.s.alive) s2.last?.copy(T); s2.T.lerp(T, s2.snapT ? 1 : damp(s2.tk ?? 9, dt)); }
    this.pose(s2, gdt);
    const p = s2.P, l = s2.L, kp = damp(s2.lag ?? 4, dt), kl = damp(s2.lagL ?? 7, dt);
    if (s2.type === 'scope' || s2.type === 'sniper' || s2.type === 'nose' || s2.type === 'door' || s2.type === 'turret') { p.copy(s2.wp); l.lerp(s2.wl, damp(s2.lagL ?? 14, dt)); }
    else if (s2.type === 'watch') { p.copy(s2.wp); l.lerp(s2.wl, kl); }
    else { p.lerp(s2.wp, kp); l.lerp(s2.wl, kl); }
    s2.fv += (s2.wf - s2.fv) * damp(3, dt);
    this.solve(s2, p, s2.T, dt);
    if (s2.bl) {
      const B = s2.bl; B.t += dt; const e = ease(B.t / B.d);
      this.pos.lerpVectors(B.p, p, e); this.look.lerpVectors(B.l, l, e); this.fov = B.f + (s2.fv - B.f) * e;
      if (B.t >= B.d) s2.bl = null;
    } else { this.pos.copy(p); this.look.copy(l); this.fov = s2.fv; }
    this.overlay.scope = s2.type === 'scope' ? 1 : 0;
    this.overlay.nose = s2.type === 'nose' && s2.reticle !== false ? 1 : 0;
    this.roll += ((s2.wr || 0) - this.roll) * damp(6, dt);
    this.apply(dt);
  }
  lost(sh) {
    if (sh.hold) return false;
    if (sh.v && (!sh.v.alive || !sh.v.st) && !sh.keepDead) return sh.t > 2.5;          // patlayan araç: enkazda 2,5 sn kal
    if (sh.s && !sh.s.alive) return sh.t > 3;
    return false;
  }
  apply(dt) {
    const c = this.g.camera, sk = Math.min(0.25, this.g.effects?.shake || 0) * 0.02;      // patlama sarsıntısı: oyuncu kamerasının ~%3'ü
    c.position.copy(this.pos);
    if (sk) c.position.add(_a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(sk));
    c.up.copy(UP); c.lookAt(this.look);
    if (this.roll) c.rotateZ(this.roll);
    if (Math.abs(c.fov - this.fov) > 1e-3) { c.fov = this.fov; c.updateProjectionMatrix(); }
    this.focus.copy(this.shot?.T || this.look);
    this.g.sfx?.setListener?.(c);
  }

  // ── yönetmen: sıradaki ilginç çekim ──
  candidates() {
    const g = this.g, out = [], last = this.shot, V = g.vehicles?.list || [];
    const same = (o) => last && ((o.v && o.v === last.v) || (o.s && o.s === last.s));
    for (const v of V) {
      if (!v.alive || !v.st || v.def.fixed || !v.seats[0] || v.seats[0].isPlayer) continue;
      const st = v.st, sp = Math.hypot(st.vx, st.vz), b = v.seats[0].brain;
      let sc = 0, types;
      if (v.def.heli) { if (!st.air) continue; sc = 5 + (b?.vd?.mode === 'strike' ? 5 : 0) + (b?.vd?.atk ? 2 : 0); types = ['chase', 'heliTop', 'flyby', 'side', 'orbit']; }
      else if (v.type === 'tank') { sc = sp > 2 ? 5 : 2.5; types = sp > 2 ? ['low', 'side', 'chase', 'orbit'] : ['orbit', 'low']; }
      else if (v.def.moto) { if (sp < 4) continue; sc = 4.5; types = ['chase', 'side', 'low']; }
      else { if (sp < 4) continue; sc = 3; types = ['chase', 'side', 'low']; }
      if (v.hp < v.def.hp * 0.5) sc += 1.5;
      const type = types[Math.floor(Math.random() * types.length)], pk = v.def.heli ? 'heli' : v.def.moto ? 'moto' : v.type === 'tank' ? 'tank' : 'jip';
      out.push({ sc: sc - (same({ v }) ? 6 : 0) + Math.random() * 2, o: { ...(PRESET[pk]?.[type] || {}), v, type, dur: 6 + Math.random() * 3 } });
    }
    for (const s of g.soldiers) {                                                     // kulede / tepede keskin nişancı
      if (!s.alive || s.veh || s.cls !== 'sniper') continue;
      const agl = s.pos.y - g.world.heightAt(s.pos.x, s.pos.z);
      const tg = !!s.brain?.target;
      if (!(agl > 3.5 && agl < 12) && !(s.brain?.perching && tg)) continue;            // kule / çatı (helikopter yolcusu değil) ya da mevzide hedefli
      const type = tg && Math.random() < 0.5 ? 'scope' : 'sniper';
      out.push({ sc: 4 + (agl > 3.5 ? 2 : 0) + (tg ? 2 : 0) - (same({ s }) ? 6 : 0) + Math.random() * 2, o: { ...PRESET[type], s, type, dur: 5 + Math.random() * 2 } });
    }
    if (g.heat) {                                                                     // öldürme / atış yoğunluğu: geniş plan ya da piyade takibi
      const L = g.heat.list(g.time).sort((a, b) => b[2] - a[2]);
      if (L.length && L[0][2] > 0.25) {
        const [x, z, w] = L[0];
        out.push({ sc: 3 + w * 4 + Math.random() * 2, o: { p: { x, z }, type: 'wide', dur: 7, r: 70 + Math.random() * 30, h: 30 + Math.random() * 20 } });
        let bs = null, bd = 40;
        for (const s of g.soldiers) { if (!s.alive || s.veh) continue; const d = Math.hypot(s.pos.x - x, s.pos.z - z); if (d < bd) { bd = d; bs = s; } }
        if (bs) out.push({ sc: 2.5 + w * 3 + Math.random() * 2 - (same({ s: bs }) ? 6 : 0), o: { ...PRESET.squad, s: bs, type: 'squad', dur: 6 } });
      }
    }
    return out.sort((a, b) => b.sc - a.sc);
  }
  next() {
    const C = this.candidates();
    for (const c of C.slice(0, 4)) if (this.cut(c.o)) return this.shot;
    const A = this.g.soldiers.filter((q) => q.alive && !q.veh && !q.isPlayer), s = A[Math.floor(Math.random() * A.length)];
    if (s) return this.cut({ ...PRESET.squad, s, type: 'squad', dur: 6 });
    return null;
  }

  // ── kayıt: döngüyü durdur, kare kare ilerlet ──
  manual() { cancelAnimationFrame(this.g.raf); this.g.raf = 0; this.g.loop = () => {}; this.isManual = true; }
  // dt: çıktı karesinin süresi; oyun timeScale ile ilerler (yavaş çekim). sim false: yalnız kamera + çizim
  frame(dt = 1 / 60, sim = true) {
    const g = this.g;
    g._rdt = dt;
    g.farView?.begin();
    if (sim && !g.ended) {
      let k = dt * this.timeScale;
      while (k > 1e-6) { const s = Math.min(k, 1 / 50); g.step(s); k -= s; }
    }
    this.update(dt);
    g.render();
  }
  // hızlı ileri sarma (çizimsiz): sn kadar oyun zamanı
  skip(sec, dt = 1 / 30) { const g = this.g; for (let t = 0; t < sec && !g.ended; t += dt) g.step(dt); }
}
