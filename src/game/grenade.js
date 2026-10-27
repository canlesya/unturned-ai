import * as THREE from 'three';
import { TUNE } from './balance.js';
import { t as $t } from '../i18n/index.js';
import '../i18n/nade.js';

// Atılan bomba (el bombası / duman / flaş) ortak fiziği + yörünge önizlemesi (12.144) · PUBG tarzı atış (12.193).
// Fizik SABİT ADIMLIDIR (NADE.h = 1/60 sn): çevrimdışı oyun (değişken kare), sunucu (SIM_DT) ve istemci tahmini aynı yolu çizer;
// önizleme (NadeView) bırakma anındaki durumla aynı fonksiyonu (simulateNade → nadeTick) koşar → gösterilen iniş = gerçek patlama yeri.
// Yay: sağ omuzdan bakış yönü × hız + sabit yukarı itiş (lift) + koşu hızının yarısı. Sağ tık (PUBG) üstten ↔ alttan yuvarlama (kısa, alçak).
// 12.193: R = pimi çek (pişirme; çekilmezse fünye bırakınca başlar), fragDamage / blastClear / fragBlast (öldürücü iç yarıçap + düşüş, siper),
// flaş ilk değme fünyesi (st.impactFuse), gelen bomba uyarısı (NadeWarn), sekme / pim sesi, sağırlık (deafen).
// Sekme: yüzeyin normaline göre geri sekme (rest) + teğet sürtünme (fric); yumuşak zemin teması → yuvarlanma (roll m/sn² yavaşlama) → durma.
export const NADE = {
  h: 1 / 60, g: 14, lift: 2.5, inherit: 0.5, r: 0.07, side: 0.2, drop: 0.1,     // side / drop: atış noktası gözün 20 cm sağı, 10 cm altı (12.193)
  rest: 0.3, fric: 0.35, roll: 12, land: 2.2,                   // geri sekme katsayısı, çarpmada teğet hız payı, yuvarlanma yavaşlaması, bu hızın altında çarpan yere oturur
  under: { speed: 9, lift: 1.6, drop: 0.55 },                    // alttan atış: hız, itiş, çıkış noktası gözden bu kadar aşağı
};
const DOWN = new THREE.Vector3(0, -1, 0);
const _s = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Vector3(), _e = new THREE.Vector3();

// Atış başlangıcı: konum (göz; alttan atışta biraz aşağı) + hız. Gerçek atış, önizleme ve bot nişanı bunu kullanır.
export function throwState(s, st, under, outP, outV, world) {
  const d = s.aimDir(_d);
  s.eye(outP);
  if (world) {                                                  // 12.193: sağ omuzdan çıkar (PUBG gibi yay ekranda sağ-alttan kıvrılır); arada engel varsa gözden
    _e.copy(outP); outP.x += Math.cos(s.yaw) * NADE.side; outP.z -= Math.sin(s.yaw) * NADE.side; outP.y -= NADE.drop;
    if (!world.clear(_e, outP)) outP.copy(_e);
  }
  const sp = under ? NADE.under.speed : st.speed;
  outV.copy(d).multiplyScalar(sp);
  outV.y += under ? NADE.under.lift : NADE.lift;
  outV.x += s.vel.x * NADE.inherit; outV.z += s.vel.z * NADE.inherit;
  if (under && world) {
    _e.copy(outP); outP.y -= NADE.under.drop - NADE.drop;
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

// 12.193 Bir adım + fünye: oyun (çevrimdışı / sunucu / istemci), önizleme ve bot nişanı AYNI fonksiyonu koşar. p: { pos, vel, ground, rest, fuse, hit1, ph }.
// Araç gövdesinden sekme (vehicles.nadeBounce) önizlemede de hesaba katılır. st.impactFuse (flaş, PUBG gibi): ilk değmeden bu kadar sonra patlar.
export function nadeTick(p, world, st, vehicles) {
  const hit = vehicles?.nadeBounce(p, NADE.h) ? 3 : nadeStep(p, world, p.ph);
  p.fuse -= NADE.h;
  if (hit && st?.impactFuse && !p.hit1) { p.hit1 = true; if (p.fuse > st.impactFuse) p.fuse = st.impactFuse; }
  return hit;
}

// Önizleme / bot / test: atıştan patlamaya tüm yol. out.pts (her adım bir nokta, en çok max), out.end (patlama yeri), out.land (ilk değme), out.t
// st (isteğe bağlı): impactFuse için · vehicles (isteğe bağlı): araç gövdesinden sekme
const _sim = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), ground: false, rest: false, fuse: 0, hit1: false, ph: null };
export function simulateNade(world, pos, vel, fuse, out = {}, max = 600, st = null, vehicles = null) {
  const p = _sim; p.pos.copy(pos); p.vel.copy(vel); p.ground = false; p.rest = false; p.fuse = fuse; p.hit1 = false;
  p.ph = (out._ph ||= {});
  out.pts ||= []; out.n = 0; out.land = (out.land || new THREE.Vector3()); out.landed = false;
  const pts = out.pts;
  const push = () => { let a = pts[out.n]; if (!a) a = pts[out.n] = new THREE.Vector3(); a.copy(p.pos); out.n++; };
  push();
  let t = 0;
  while (p.fuse > 1e-9 && t < 30) {
    const hit = nadeTick(p, world, st, vehicles);
    t += NADE.h;
    if (hit && !out.landed) { out.landed = true; out.land.copy(p.pos); out.landT = t; }
    const last = p.fuse <= 1e-9;
    if ((!p.rest || last) && out.n < max) push();
    else if (p.rest && !last) { t += Math.ceil(p.fuse / NADE.h - 1e-6) * NADE.h; p.fuse = 0; if (out.n < max) push(); break; }   // durdu: kalan fünyeyi say, yol aynı nokta
  }
  if (!out.landed) { out.land.copy(p.pos); out.landT = t; }
  out.end = (out.end || new THREE.Vector3()).copy(p.pos);
  out.t = t;
  return out;
}

// Bot nişanı: hedef noktaya (yerde) düşecek bakış açısı (pitch). Aynı fizikle (simulateNade) kaba tarama (−0,5 … 1,25 rad, 0,07 adım; düşük yaydan başlar,
// iyi bir açı bulunca durur) + en iyinin çevresinde ince ayar. Patlama hedefe tol m'den yakın, atanın 6 m'den uzağında (alttan: 3,5 m), hedefle aynı katta olmalı;
// yoksa null (yay engele çarpıp geri dönecekse ya da yanına düşecekse bot atmaz).
// o (12.193): { under: alttan yuvarlama, fuse: kalan fünye (pişirilmiş), vehicles } · dönüş: { yaw, pitch, miss, under, landT, t }
const _bp = new THREE.Vector3(), _bv = new THREE.Vector3(), _bo = {};
export function aimNade(s, st, target, world, tol = 3.5, o = {}) {
  const e = s.eye(new THREE.Vector3()), dx = target.x - e.x, dz = target.z - e.z, D = Math.hypot(dx, dz);
  const under = !!o.under, minSelf = under ? 3.5 : 6;
  if (D < (under ? 3 : 4)) return null;
  const fuse = Number.isFinite(o.fuse) ? o.fuse : st.fuse;
  const yaw = Math.atan2(-dx, -dz);
  const keepYaw = s.yaw, keepPitch = s.pitch, keepR = s.recoilP;
  let landT = 0, tt = 0;
  const score = (pt) => {
    s.yaw = yaw; s.pitch = pt; s.recoilP = 0;
    throwState(s, st, under, _bp, _bv, world);
    const r = simulateNade(world, _bp, _bv, fuse, _bo, 400, st, o.vehicles);
    const miss = Math.hypot(r.end.x - target.x, r.end.z - target.z), self = Math.hypot(r.end.x - e.x, r.end.z - e.z);
    return self > minSelf && Math.abs(r.end.y - target.y) < 2.5 ? miss : Infinity;
  };
  let best = Infinity, bp = 0;
  for (let pt = -0.5; pt <= 1.25; pt += 0.07) { const m = score(pt); if (m < best) { best = m; bp = pt; } if (best < 1.2) break; }
  if (best < Infinity) for (const d of [-0.035, 0.035, -0.018, 0.018]) { const m = score(bp + d); if (m < best) { best = m; bp += d; } }
  if (best < Infinity) { score(bp); landT = _bo.landT; tt = _bo.t; }
  s.yaw = keepYaw; s.pitch = keepPitch; s.recoilP = keepR;
  return best < tol ? { yaw, pitch: bp, miss: best, under, landT, t: tt } : null;
}

// ── 12.193 PUBG tarzı parça tesirli hasar ──
// PUBG Frag: öldürücü ≤ 3,5 m, orta 3,5–8,5 m, az 8,5–10 m; yatana %20 az. Burada: d ≤ lethal → dmg (öldürür), sonra edge'den 0'a (radius'ta) eğriyle düşer.
// d = patlamadan hedefin gövde merkezine. Değerler stats.js (grenade: dmg 150, lethal 3,5, radius 10, edge 95).
export function fragDamage(st, d) {
  const R = st.radius, L = Math.min(st.lethal ?? 0, R * 0.95);
  if (d >= R) return 0;
  if (d <= L) return st.dmg;
  if (st.lethal == null) return st.dmg * (1 - (d / R) ** 2);                    // eski eğri (lethal tanımsız)
  return Math.min(st.dmg, st.edge ?? 95) * Math.pow(1 - (d - L) / (R - L), 1.6);
}

// Siper: patlamanın biraz üstünden (yerde duran bomba zemine / kaldırım taşına takılmasın) hedefin gövdesine, başına ya da dizine açık hat var mı.
// Üstü kapalıysa (masa altı, alçak tavan) patlama noktasının hemen üstünden denenir. Biri açıksa hasar (kısmen görünen hedef de etkilenir).
const _o1 = new THREE.Vector3(), _o2 = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3();
export function blastClear(world, pos, e) {
  _o2.copy(pos); _o2.y += 0.06;
  _o1.copy(pos); _o1.y += 0.4;
  const o = world.clear(_o2, _o1) ? _o1 : _o2;
  e.center(_t1); e.eye(_t2); _t3.set(e.pos.x, e.pos.y + Math.min(0.45, e.height * 0.3), e.pos.z);
  return world.clear(o, _t1) || world.clear(o, _t2) || world.clear(o, _t3);
}

// Parça tesirli bomba patlaması (kendi içinde: game.explode'a bağlı değil). Görsel + ses herkes için; hasar yalnız yetkili tarafta (çevrimdışı / sunucu).
// selfMul: atanın kendi hasar çarpanı (varsayılan TUNE.selfBlast; elde patlayan bomba 9 → öldürür). Araçlara az hasar (vehDmg / vehR).
const _c = new THREE.Vector3();
export function fragBlast(g, pos, st, owner, selfMul) {
  g.effects.explosion(pos, Math.min(7.5, st.radius));
  g.sfx.explosion(pos);
  g.alertNear?.(pos, owner.team, 90);
  const dc = pos.distanceTo(g.camera.position);
  g.effects.shake = Math.max(g.effects.shake || 0, Math.max(0, Math.min(1, 1 - dc / 35)) * 1.1);
  if (!g.headless) { const gh = g.world.raycast(new THREE.Vector3(pos.x, pos.y + 1, pos.z), DOWN, 6, {}); if (gh) g.effects.decal(gh.point, gh.normal, true); }
  if (g.online) return;
  g.vehicles?.blast(pos, st.vehR ?? 5, st.vehDmg ?? 60, owner, st.name, 'blast');
  for (const e of g.soldiers) {
    if (!e.alive) continue;
    if (e.team === owner.team && e !== owner) continue;
    if (g.vehicles?.hiddenSeat(e)) continue;
    const c = e.center(_c), d = c.distanceTo(pos);
    if (d > st.radius) continue;
    if (!blastClear(g.world, pos, e)) continue;
    let a = fragDamage(st, d) * (e.prone ? 0.8 : 1);
    if (e === owner) a *= selfMul ?? TUNE.selfBlast;
    if (a < 1) continue;
    e.takeDamage(a, owner, 'body', pos, st.name);
    e.vel.x += (c.x - pos.x) / (d + 0.5) * 3; e.vel.z += (c.z - pos.z) / (d + 0.5) * 3;
  }
}

// Sekme sesi: küçük metal "tink" + toprak tıkırtısı (konumlu, çarpma hızına göre)
export function bounceSfx(sfx, pos, sp) {
  if (!sfx || !sfx.ctx || !sfx._voice) return;
  const v = sfx._voice(pos, Math.min(1, 0.35 + sp / 10), { ref: 10 });
  if (v.gain < 0.003) { for (const x of v.nodes || []) x.disconnect(); return; }
  const f = 2400 + Math.random() * 900;
  sfx._tone({ v, gain: 0.09, dur: 0.07, f0: f, f1: f * 0.92, type: 'triangle', att: 0.001 });
  sfx._noise({ v, gain: 0.08, dur: 0.05, f0: 1800, f1: 500, type: 'bandpass', q: 1.2, att: 0.001 });
}

// Flaş sağırlığı (PUBG: en çok 10 sn): efekt kanalı kısılır, süre boyunca yavaşça açılır; çınlama tonu ayrı (sfx.ring)
export function deafen(sfx, dur) {
  const bus = sfx?.sfxBus, c = sfx?.ctx;
  if (!bus || !c || !(dur > 0.2)) return;
  const base = sfx.mix?.sfx ?? 1, t = c.currentTime, g = bus.gain;
  try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(base * 0.12, t + 0.06); g.setValueAtTime(base * 0.12, t + Math.min(1.2, dur * 0.3)); g.linearRampToValueAtTime(base, t + dur); } catch (e) { /* eski tarayıcı */ }
}

// Pim çekme sesi (konumsuz, kuru metal tık + yay): ses sistemine dokunmadan mevcut sentez araçlarıyla
export function pinSfx(sfx, pos = null) {
  if (!sfx || !sfx.ctx || !sfx._voice) return;
  const v = sfx._voice(pos, pos ? 0.7 : 1, pos ? { ref: 6 } : undefined);
  if (v.gain < 0.003) { for (const x of v.nodes || []) x.disconnect(); return; }
  sfx._tone({ v, gain: 0.12, dur: 0.05, f0: 3200, f1: 2600, type: 'triangle', att: 0.001 });
  sfx._noise({ v, gain: 0.1, dur: 0.06, f0: 6000, f1: 3000, type: 'bandpass', q: 2, att: 0.001, delay: 0.07 });
}

// ── Yörünge önizlemesi (yalnız atan oyuncu görür) + pişirme göstergesi (12.144 → 12.193 PUBG tarzı) ──
// Ateş basılıyken (bomba hazır): 0,45 m arayla noktalı yay (4 px), ilk değmede küçük nokta, patlama yerinde halka (el bombasında öldürme yarıçapı kadar
// soluk kırmızı ikinci halka). Nişangâhın sağ altında: atış şekli (ÜSTTEN / ALTTAN), ipucu, pim çekilince (R) kalan fünye halkası + saniye (1 sn altında kırmızı).
const MAXP = 240;
const HUD_CSS = `
#nadehud{position:fixed;left:calc(50% + 30px);top:calc(50% + 22px);pointer-events:none;display:none;z-index:6;font:800 12px/1.15 Bahnschrift,'Rajdhani','Arial Narrow',system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;letter-spacing:1px}
#nadehud .rw{display:flex;align-items:center;gap:8px}
body.mob #nadehud{left:auto;right:calc(50% + 34px);top:calc(50% + 26px)}body.mob #nadehud .rw{flex-direction:row-reverse;text-align:right}      /* dokunmatik: bomba düğmesi sağda, gösterge solda */
#nadehud svg{width:40px;height:40px;display:none;filter:drop-shadow(0 1px 2px #000)}
#nadehud.lit svg{display:block}
#nadehud svg .bg{fill:rgba(10,14,20,.45);stroke:rgba(255,255,255,.25);stroke-width:3}
#nadehud svg .fg{fill:none;stroke:#fff;stroke-width:3.4;stroke-linecap:round;transform:rotate(-90deg);transform-origin:20px 20px}
#nadehud svg text{font:800 13px Bahnschrift,'Rajdhani',system-ui,sans-serif;fill:#fff;text-anchor:middle;dominant-baseline:central}
#nadehud.hot svg .fg{stroke:#ff5a4a}#nadehud.hot svg text{fill:#ff5a4a}
#nadehud .m{font-size:13px;white-space:nowrap}
#nadehud .m i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffd27a;margin-right:5px;vertical-align:1px}
#nadehud.u .m i{background:#7ec8ff}
#nadehud .k{font-weight:600;font-size:10.5px;opacity:.72;margin-top:2px;letter-spacing:.5px;white-space:nowrap}
#nadehud.lit .k{color:#ffb0a6;opacity:.95}
#nadewarn{position:fixed;left:50%;top:50%;width:0;height:0;pointer-events:none;z-index:6}
#nadewarn .w{position:absolute;left:0;top:0;width:58px;height:58px;margin:-29px 0 0 -29px;display:none}
#nadewarn .w svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 3px rgba(0,0,0,.85))}
#nadewarn .w .ic,#nadewarn .w .ar{fill:#fff}
#nadewarn .w.hot .ic,#nadewarn .w.hot .ar{fill:#ff4a3a}
#nadewarn .w .bd{fill:rgba(10,14,20,.6);stroke:#fff;stroke-width:1.4}
#nadewarn .w.hot .bd{fill:rgba(190,30,20,.7);stroke:#ffb0a6}
#nadewarn .w.hot .ic{fill:#fff}
`;
// ok (dışa, bombanın yönünü gösterir) + bomba simgesi (gövde + kaşık + pim halkası)
const WARN_SVG = '<svg viewBox="-23 -23 46 46"><path class="ar" d="M0 -23 L6 -15.5 L-6 -15.5 Z"/><circle class="bd" cx="0" cy="2" r="13"/>' +
  '<path class="ic" d="M-4 -6h8v2.2h-1.4c2.6 1.4 4.4 4 4.4 7.1a7 7 0 01-14 0c0-3.1 1.8-5.7 4.4-7.1H-4z"/><path class="ic" d="M3.2 -6.5l4.6-3.6 1 1.3-4.6 3.6z"/><circle cx="-5.5" cy="-7.5" r="2.2" fill="none" stroke="#fff" stroke-width="1.2"/></svg>';
let _css = false;
function injectCss() { if (_css || !globalThis.document) return; _css = true; const st = document.createElement('style'); st.textContent = HUD_CSS; document.head.appendChild(st); }

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
    const ringMat = (op, c = '#ffffff') => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 32), ringMat(0.9));
    this.kill = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 48), ringMat(0.5, '#ff6a5a'));   // ölçek = öldürme yarıçapı
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), ringMat(0.9));
    this.grp = new THREE.Group();
    this.grp.add(this.line, this.ring, this.kill, this.dot);
    this.grp.visible = false;
    game.scene.add(this.grp);
    injectCss();
    this.el = document.createElement('div');
    this.el.id = 'nadehud';
    this.el.innerHTML = '<div class="rw"><svg viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="16"/><circle class="fg" cx="20" cy="20" r="16" stroke-dasharray="100.5" stroke-dashoffset="0"/><text x="20" y="20.5">5.0</text></svg><div><div class="m"><i></i><span></span></div><div class="k"></div></div></div>';
    this.fg = this.el.querySelector('.fg'); this.tx = this.el.querySelector('text'); this.mEl = this.el.querySelector('.m span'); this.kEl = this.el.querySelector('.k');
    document.body.appendChild(this.el);
    this.shown = false; this._key = '';
    this.warn = new NadeWarn(game);
  }

  // Şu an önizlenecek atış var mı: canlı, elde atılabilir, bomba hazır (tetik basılı) ya da hemen hazırlanacak
  active() {
    const g = this.g, s = g.playerSoldier, pl = g.player;
    if (!s || !s.alive || !pl || s.stat.kind !== 'throwable' || s.item.mag <= 0 || s.veh) return false;
    return !!(s.cook || ((pl.fireHeld || pl.qNade) && s.cd <= 0 && s.switchT <= 0));
  }

  draw() {
    const g = this.g, s = g.playerSoldier;
    this.warn.draw();
    const on = this.active();
    this.grp.visible = on;
    if (!on) { if (this.shown) { this.el.style.display = 'none'; this.shown = false; } return; }
    const st = s.stat, under = !!s.nadeUnder;
    // pişirme: bırakma bir sonraki adımda olur (o adımda fünye bir adım daha işler) → bir adım ileriden hesapla (çevrimiçi sabit SIM_DT, çevrimdışı son kare)
    const now = performance.now(), fdt = Math.min(0.05, Math.max(0, (now - (this._t || now)) / 1000)); this._t = now;
    const step = g.online ? NADE.h : fdt;
    const lit = !!(st.cook && s.cook?.lit);
    const fuse = lit ? Math.max(0, st.fuse - s.cook.t - step) : st.fuse;
    throwState(s, st, under, this._p, this._v, g.world);
    const r = simulateNade(g.world, this._p, this._v, fuse, this.sim, MAXP, st, g.vehicles);
    const L = (this.last ||= { end: new THREE.Vector3(), land: new THREE.Vector3() });      // test / hata ayıklama: son önizleme
    L.end.copy(r.end); L.land.copy(r.land); L.n = r.n; L.fuse = fuse; L.under = under; L.lit = lit;
    // yay: 0,45 m arayla noktalar (kesikli); gözden çıkan ilk ~1 m çizilmez (kameranın içinden geçer)
    let k = 0, acc = 0.45;
    for (let i = 1; i < r.n && k < MAXP; i++) {
      const a = r.pts[i - 1], b = r.pts[i], dl = a.distanceTo(b);
      acc += dl;
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
    // HUD: atış şekli + ipucu + pişirme halkası
    const touch = !!g.player?.touch;
    const key = (under ? 'u' : 'o') + (lit ? 'L' : '') + (st.cook ? 'c' : '') + (touch ? 't' : '');
    if (key !== this._key) {
      this._key = key;
      this.el.classList.toggle('u', under); this.el.classList.toggle('lit', lit);
      this.mEl.textContent = $t(under ? 'nade.under' : 'nade.over');
      this.kEl.textContent = lit ? $t('nade.lit') : $t(touch ? (st.cook ? 'nade.tHintCook' : 'nade.tHintNoCook') : (st.cook ? 'nade.hintCook' : 'nade.hintNoCook'));
    }
    if (lit) {
      const f = Math.max(0, fuse) / st.fuse;
      this.fg.setAttribute('stroke-dashoffset', (100.5 * (1 - f)).toFixed(1));
      this.tx.textContent = fuse.toFixed(1);
      this.el.classList.toggle('hot', fuse < 1);
    }
    if (!this.shown) { this.el.style.display = 'block'; this.shown = true; }
  }

  dispose() { this.g.scene.remove(this.grp); this.line.geometry.dispose(); this.el.remove(); this.warn.dispose(); }
}

// ── Gelen bomba uyarısı (PUBG / CoD tarzı): yakındaki (yarıçap + 1 m içinde) canlı el bombası için nişangâh çevresinde, bombanın yönünü gösteren simge.
// Öldürme yarıçapındaysa kırmızı ve hızlı yanıp söner. Kendi / takım arkadaşının bombası da gösterilir (kendine de zarar verir). Yalnız el bombası (parça tesirli).
const _wv = new THREE.Vector3(), _wc = new THREE.Vector3();
export class NadeWarn {
  constructor(game) {
    this.g = game;
    this.el = document.createElement('div'); this.el.id = 'nadewarn';
    document.body.appendChild(this.el);
    this.pool = [];
    this.last = [];                                                    // test: son karede gösterilen uyarılar
  }
  draw() {
    const g = this.g, me = g.playerSoldier, cam = g.camera;
    let n = 0;
    this.last.length = 0;
    if (me && me.alive && !g.ended) {
      const yaw = me.yaw;
      const R = Math.min(150, Math.max(90, Math.min(innerWidth, innerHeight) * 0.2));
      for (const p of g.projectiles) {
        if (p.type !== 'grenade' || p.shell || p.hold || p.inHand) continue;
        const st = p.st; if (st.gtype && st.gtype !== 'frag') continue;
        const d = _wv.copy(p.pos).sub(me.center(_wc)).length();
        if (d > st.radius + 1 || p.fuse > 6) continue;
        const dx = p.pos.x - cam.position.x, dz = p.pos.z - cam.position.z;
        let a = -(Math.atan2(-dx, -dz) - yaw);                         // ekranda saat yönü (0 = tam önde, + = sağda)
        a -= Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
        let w = this.pool[n];
        if (!w) { w = document.createElement('div'); w.className = 'w'; w.innerHTML = WARN_SVG; this.el.appendChild(w); this.pool.push(w); }
        const hot = d <= killRadius(st) + 0.5;
        const x = Math.sin(a) * R, y = -Math.cos(a) * R;
        const blink = 0.55 + 0.45 * Math.abs(Math.sin(g.time * (hot ? 12 : 6)));
        w.style.display = 'block';
        w.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${a.toFixed(3)}rad) scale(${(0.8 + 0.4 * (1 - d / (st.radius + 1))).toFixed(2)})`;
        w.style.opacity = blink.toFixed(2);
        w.classList.toggle('hot', hot);
        this.last.push({ d, hot, a });
        n++;
      }
    }
    for (let i = n; i < this.pool.length; i++) if (this.pool[i].style.display !== 'none') this.pool[i].style.display = 'none';
  }
  dispose() { this.el.remove(); }
}

// Öldürme yarıçapı (ayakta hedef, gövde merkezi): fragDamage ≥ hp olan en uzak mesafe
export function killRadius(st, hp = 100) {
  if (st.lethal != null) return st.dmg >= hp ? Math.min(st.lethal, st.radius * 0.95) : 0;
  return st.dmg > hp ? st.radius * Math.sqrt(1 - hp / st.dmg) : 0;
}
