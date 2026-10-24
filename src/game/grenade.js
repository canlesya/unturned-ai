import * as THREE from 'three';

// Atılan bomba (el bombası / duman / flaş) ortak fiziği + yörünge önizlemesi (12.144).
// Fizik SABİT ADIMLIDIR (NADE.h = 1/60 sn): çevrimdışı oyun (değişken kare), sunucu (SIM_DT) ve istemci tahmini aynı yolu çizer;
// önizleme (NadeView) bırakma anındaki durumla aynı fonksiyonu (simulateNade) koşar → gösterilen iniş = gerçek patlama yeri.
// Yay: bakış yönü × hız + sabit yukarı itiş (lift) + koşu hızının yarısı. Sağ tık basılıyken bırakılırsa "alttan yuvarla" (kısa, alçak).
// Sekme: yüzeyin normaline göre geri sekme (rest) + teğet sürtünme (fric); yumuşak zemin teması → yuvarlanma (roll m/sn² yavaşlama) → durma.
export const NADE = {
  h: 1 / 60, g: 14, lift: 2.5, inherit: 0.5, r: 0.07,
  rest: 0.3, fric: 0.35, roll: 12, land: 2.2,                   // geri sekme katsayısı, çarpmada teğet hız payı, yuvarlanma yavaşlaması, bu hızın altında çarpan yere oturur
  under: { speed: 9, lift: 1.6, drop: 0.55 },                    // alttan atış: hız, itiş, çıkış noktası gözden bu kadar aşağı
};
const DOWN = new THREE.Vector3(0, -1, 0);
const _s = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Vector3(), _e = new THREE.Vector3();

// Atış başlangıcı: konum (göz; alttan atışta biraz aşağı) + hız. Gerçek atış, önizleme ve bot nişanı bunu kullanır.
export function throwState(s, st, under, outP, outV, world) {
  const d = s.aimDir(_d);
  s.eye(outP);
  const sp = under ? NADE.under.speed : st.speed;
  outV.copy(d).multiplyScalar(sp);
  outV.y += under ? NADE.under.lift : NADE.lift;
  outV.x += s.vel.x * NADE.inherit; outV.z += s.vel.z * NADE.inherit;
  if (under && world) {
    _e.copy(outP); outP.y -= NADE.under.drop;
    if (!world.clear(_e, outP)) outP.copy(_e);                 // alçak tavan / kutu üstü: gözden çık
  }
  return outP;
}

// Tek sabit adım. p: { pos, vel, ground, rest } (yerinde değişir). Dönüş: çarpma hızı (ses için), çarpma yoksa 0.
export function nadeStep(p, world, ph) {
  if (p.rest) return 0;
  const h = NADE.h, v = p.vel;
  if (p.ground) {
    const sp = Math.hypot(v.x, v.z), ns = sp - NADE.roll * (world.grav ?? 1) * h;      // 12.157: düşük yer çekiminde (Uzay) yuvarlanma sürtünmesi de azalır
    if (ns <= 0.05) { v.set(0, 0, 0); p.rest = true; return 0; }
    const k = ns / sp; v.x *= k; v.z *= k; v.y = 0;
  } else v.y -= NADE.g * (world.grav ?? 1) * h;                   // 12.157: World.grav (Uzay 0,36) — sunucu, çevrimdışı ve önizleme aynı
  _s.copy(v).multiplyScalar(h);
  const L = _s.length();
  let impact = 0;
  if (L > 1e-7) {
    _d.copy(_s).divideScalar(L);
    const wh = world.raycast(p.pos, _d, L + NADE.r, ph);
    if (wh) {
      _n.copy(wh.normal);
      if (_n.lengthSq() < 0.5) _n.copy(_d).negate();            // içeriden başlayan ışın (normal yok): geri dön
      const vn = v.dot(_n);
      p.pos.copy(wh.point).addScaledVector(_n, NADE.r);
      if (vn < 0) {
        impact = -vn;
        _q.copy(_n).multiplyScalar(vn);                         // normal bileşen
        v.sub(_q);                                                // teğet
        if (_n.y > 0.6 && impact < NADE.land) p.ground = true;  // yumuşak düşüş: yere otur, yuvarlan
        else { v.multiplyScalar(NADE.fric); v.addScaledVector(_q, -NADE.rest); if (_n.y > 0.6 && v.y < 0.8) { v.y = 0; p.ground = true; } }
      }
    } else p.pos.add(_s);
  }
  if (p.ground) {                                                 // zemine yapış (rampa / basamak), kenardan düşerse yeniden uçar
    _e.copy(p.pos); _e.y += 0.1;
    const gh = world.raycast(_e, DOWN, NADE.r + 0.35, ph);
    if (gh && gh.normal.y > 0.6) p.pos.y = gh.point.y + NADE.r;
    else p.ground = false;
  }
  return impact;
}

// Önizleme / bot / test: atıştan patlamaya tüm yol. out.pts (her adım bir nokta, en çok max), out.end (patlama yeri), out.land (ilk değme), out.t
const _sim = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), ground: false, rest: false };
export function simulateNade(world, pos, vel, fuse, out = {}, max = 600) {
  const p = _sim; p.pos.copy(pos); p.vel.copy(vel); p.ground = false; p.rest = false;
  const ph = (out._ph ||= {});
  out.pts ||= []; out.n = 0; out.land = (out.land || new THREE.Vector3()); out.landed = false;
  const pts = out.pts;
  const push = () => { let a = pts[out.n]; if (!a) a = pts[out.n] = new THREE.Vector3(); a.copy(p.pos); out.n++; };
  push();
  let t = 0;
  const steps = Math.max(0, Math.ceil(fuse / NADE.h - 1e-6));
  for (let i = 0; i < steps && out.n < max; i++) {
    const hit = nadeStep(p, world, ph);
    t += NADE.h;
    if (hit && !out.landed) { out.landed = true; out.land.copy(p.pos); out.landT = t; }
    if (!p.rest || i === steps - 1) push();
    if (p.rest) { t = steps * NADE.h; break; }
  }
  if (!out.landed) { out.land.copy(p.pos); out.landT = t; }
  out.end = (out.end || new THREE.Vector3()).copy(p.pos);
  out.t = t;
  return out;
}

// Bot nişanı: hedef noktaya (yerde) düşecek bakış açısı (pitch). Aynı fizikle (simulateNade) kaba tarama (−0,5 … 1,25 rad, 0,07 adım; düşük yaydan başlar,
// iyi bir açı bulunca durur) + en iyinin çevresinde ince ayar. Patlama hedefe tol m'den yakın, atanın 6 m'den uzağında, hedefle aynı katta olmalı;
// yoksa null (yay engele çarpıp geri dönecekse ya da yanına düşecekse bot atmaz).
const _bp = new THREE.Vector3(), _bv = new THREE.Vector3(), _bo = {};
export function aimNade(s, st, target, world, tol = 3.5) {
  const e = s.eye(new THREE.Vector3()), dx = target.x - e.x, dz = target.z - e.z, D = Math.hypot(dx, dz);
  if (D < 4) return null;
  const yaw = Math.atan2(-dx, -dz);
  const keepYaw = s.yaw, keepPitch = s.pitch, keepR = s.recoilP;
  const score = (pt) => {
    s.yaw = yaw; s.pitch = pt; s.recoilP = 0;
    throwState(s, st, false, _bp, _bv, world);
    const r = simulateNade(world, _bp, _bv, st.fuse, _bo, 400);
    const miss = Math.hypot(r.end.x - target.x, r.end.z - target.z), self = Math.hypot(r.end.x - e.x, r.end.z - e.z);
    return self > 6 && Math.abs(r.end.y - target.y) < 2.5 ? miss : Infinity;
  };
  let best = Infinity, bp = 0;
  for (let pt = -0.5; pt <= 1.25; pt += 0.07) { const m = score(pt); if (m < best) { best = m; bp = pt; } if (best < 1.2) break; }
  if (best < Infinity) for (const d of [-0.035, 0.035, -0.018, 0.018]) { const m = score(bp + d); if (m < best) { best = m; bp += d; } }
  s.yaw = keepYaw; s.pitch = keepPitch; s.recoilP = keepR;
  return best < tol ? { yaw, pitch: bp, miss: best } : null;
}

// Pim çekme sesi (konumsuz, kuru metal tık + yay): ses sistemine dokunmadan mevcut sentez araçlarıyla
export function pinSfx(sfx) {
  if (!sfx || !sfx.ctx || !sfx._voice) return;
  const v = sfx._voice(null, 1);
  sfx._tone({ v, gain: 0.12, dur: 0.05, f0: 3200, f1: 2600, type: 'triangle', att: 0.001 });
  sfx._noise({ v, gain: 0.1, dur: 0.06, f0: 6000, f1: 3000, type: 'bandpass', q: 2, att: 0.001, delay: 0.07 });
}

// ── Yörünge önizlemesi (yalnız atan oyuncu görür) + pişirme göstergesi ──
// Bomba elde ve ateş tuşu basılıyken: 0,45 m arayla noktalı yay (4 px), ilk değmede küçük nokta, patlama yerinde halka
// (el bombasında öldürme yarıçapı kadar soluk ikinci halka). Pişirme: nişangâhın altında kalan fünye süresi (1 sn altında kırmızı).
const MAXP = 240;
export class NadeView {
  constructor(game) {
    this.g = game;
    this.sim = {};
    this._p = new THREE.Vector3(); this._v = new THREE.Vector3();
    const geo = new THREE.BufferGeometry();
    this.buf = new Float32Array(MAXP * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.buf, 3).setUsage(THREE.DynamicDrawUsage));
    this.line = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 4, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
    this.line.frustumCulled = false; this.line.renderOrder = 5;
    const ringMat = (op) => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 32), ringMat(0.9));
    this.kill = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48), ringMat(0.35));   // ölçek = öldürme yarıçapı
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), ringMat(0.9));
    this.grp = new THREE.Group();
    this.grp.add(this.line, this.ring, this.kill, this.dot);
    this.grp.visible = false;
    game.scene.add(this.grp);
    this.el = document.createElement('div');
    this.el.id = 'nadecook';
    this.el.style.cssText = 'position:fixed;left:calc(50% + 26px);top:calc(50% + 18px);font:800 15px/1 system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none;display:none;z-index:6;letter-spacing:1px';
    document.body.appendChild(this.el);
    this.shown = false;
  }

  // Şu an önizlenecek atış var mı: canlı, elde atılabilir, tetik basılı (pişiriliyor ya da hemen bırakılacak)
  active() {
    const g = this.g, s = g.playerSoldier, pl = g.player;
    if (!s || !s.alive || !pl || s.stat.kind !== 'throwable' || s.item.mag <= 0) return false;
    return !!(s.cook || (pl.fireHeld && s.cd <= 0 && s.switchT <= 0));
  }

  draw() {
    const g = this.g, s = g.playerSoldier;
    const on = this.active();
    this.grp.visible = on;
    if (!on) { if (this.shown) { this.el.style.display = 'none'; this.shown = false; } return; }
    const st = s.stat, under = !!s.ads;
    // pişirme: bırakma bir sonraki adımda olur (o adımda fünye bir adım daha işler) → bir adım ileriden hesapla (çevrimiçi sabit SIM_DT, çevrimdışı son kare)
    const now = performance.now(), fdt = Math.min(0.05, Math.max(0, (now - (this._t || now)) / 1000)); this._t = now;
    const step = g.online ? NADE.h : fdt;
    const fuse = st.cook && s.cook ? Math.max(0, st.fuse - s.cook.t - step) : st.fuse;
    throwState(s, st, under, this._p, this._v, g.world);
    const r = simulateNade(g.world, this._p, this._v, fuse, this.sim, MAXP);
    const L = (this.last ||= { end: new THREE.Vector3(), land: new THREE.Vector3() });      // test / hata ayıklama: son önizleme
    L.end.copy(r.end); L.land.copy(r.land); L.n = r.n; L.fuse = fuse; L.under = under;
    // yay: 0,45 m arayla noktalar (BattleBit gibi kesikli); gözden çıkan ilk ~1 m çizilmez (kameranın içinden geçer)
    let k = 0, acc = 0.45;
    for (let i = 1; i < r.n && k < MAXP; i++) {
      const a = r.pts[i - 1], b = r.pts[i], L = a.distanceTo(b);
      acc += L;
      if (acc < 0.45 || b.distanceToSquared(this._p) < 1) continue;
      acc = 0; this.buf[k * 3] = b.x; this.buf[k * 3 + 1] = b.y; this.buf[k * 3 + 2] = b.z; k++;
    }
    const geo = this.line.geometry;
    geo.setDrawRange(0, k);
    geo.attributes.position.needsUpdate = true;
    const lift = 0.03, cd = g.camera.position.distanceTo(r.end), rk = Math.min(3.5, Math.max(1, cd / 9));     // uzakta halka büyür (ekranda okunur)
    this.ring.position.copy(r.end); this.ring.position.y += lift - NADE.r; this.ring.rotation.set(-Math.PI / 2, 0, 0); this.ring.scale.setScalar(rk);
    const frag = !st.gtype || st.gtype === 'frag';
    this.kill.visible = frag;
    if (frag) {                                                    // ayakta hedefin gövde merkezi ~1 m yukarıda: yerdeki öldürme halkası yatay mesafe
      const kr = killRadius(st), kh = Math.sqrt(Math.max(0.25, kr * kr - 1));
      this.kill.position.copy(this.ring.position); this.kill.rotation.copy(this.ring.rotation); this.kill.scale.setScalar(kh);
    }
    this.dot.visible = r.landed && r.land.distanceTo(r.end) > 0.8;
    this.dot.position.copy(r.land); this.dot.position.y += lift - NADE.r; this.dot.rotation.set(-Math.PI / 2, 0, 0);
    const c = st.cook && s.cook ? fuse : null;
    if (c !== null) {
      this.el.textContent = c.toFixed(1);
      this.el.style.color = c < 1 ? '#ff5a4a' : '#ffffff';
      if (!this.shown) { this.el.style.display = 'block'; this.shown = true; }
    } else if (this.shown) { this.el.style.display = 'none'; this.shown = false; }
  }

  dispose() { this.g.scene.remove(this.grp); this.line.geometry.dispose(); this.el.remove(); }
}

// Öldürme yarıçapı (ayakta hedef, gövde merkezi; hasar = dmg × (1 − (d / r)²)): dmg ≥ 100 olan en uzak mesafe
export function killRadius(st, hp = 100) { return st.dmg > hp ? st.radius * Math.sqrt(1 - hp / st.dmg) : 0; }
