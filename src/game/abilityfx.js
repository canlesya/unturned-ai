// Zombi özel gücü: YEREL oyuncunun ekranında hissedilen geri bildirim (1. şahıs). Yalnızca DOM/CSS katmanları + tuval CSS filtresi
// (ağır son işleme yok). Durum her karede yerel askerden okunur (abT / abActive) → çevrimiçi istemcide de anlık görüntüyle çalışır.
//   öfke: kalp atışı ritminde kızıl kenar, sarsıntı, FOV vuruşu, kızıl parlayan pençeler · atılış: hız çizgileri, FOV açılır
//   zırh: çelik mavisi kenar + çatlak zırh, isabette sekme parlaması + metal çınlaması · görünmezlik: soluk / hayalet ekran,
//   yarı saydam eller, ışıltı; bozulunca "GÖRÜNDÜN" parlaması · ışınlanma: parlama + çizgi geçişi + FOV sıkışması
//   gölge sıçrayışı (boss): koyu dumanlı mor kenar + derin gümbürtü. Ayrıca güç HAZIR olunca gösterge parlar + kısa ses.
import { t, lang } from '../i18n/index.js';
import { abilName } from '../i18n/game.js';
import '../i18n/zab.js';
const UP = (x) => String(x || '').toLocaleUpperCase(lang() === 'tr' ? 'tr' : 'en');      // Türkçede i → İ, İngilizcede değil

const CSS = `
#abfx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#abfx>div{position:absolute;inset:0;opacity:0;will-change:opacity,transform}
#abfx .ln,#abfx .ln2{inset:-30%;-webkit-mask-image:radial-gradient(circle at center,transparent 22%,rgba(0,0,0,.35) 34%,#000 58%);mask-image:radial-gradient(circle at center,transparent 22%,rgba(0,0,0,.35) 34%,#000 58%)}
#abfx .ln{background:repeating-conic-gradient(from 0deg,transparent 0deg 3.1deg,var(--lc,rgba(255,250,235,.7)) 3.3deg 3.55deg,transparent 3.8deg 8.2deg)}
#abfx .ln2{background:repeating-conic-gradient(from 2deg,transparent 0deg 5.4deg,var(--lc,rgba(255,250,235,.55)) 5.6deg 5.75deg,transparent 5.95deg 12.7deg)}
#abfx .cr svg{position:absolute;inset:0;width:100%;height:100%}
#abfx .cr{box-shadow:inset 0 0 0 3px rgba(170,205,240,.55),inset 0 0 90px rgba(90,140,200,.55)}
#abfx .sh{background:linear-gradient(105deg,transparent 30%,rgba(190,240,255,.16) 42%,rgba(255,255,255,.22) 47%,rgba(190,240,255,.16) 52%,transparent 64%);background-size:220% 100%}
#abfx .sm{inset:-12%;background:radial-gradient(ellipse 38% 46% at 0% 50%,rgba(20,0,34,.95),transparent 70%),radial-gradient(ellipse 38% 46% at 100% 50%,rgba(20,0,34,.95),transparent 70%),radial-gradient(ellipse 60% 34% at 50% 0%,rgba(36,6,56,.9),transparent 70%),radial-gradient(ellipse 60% 34% at 50% 100%,rgba(10,0,20,.95),transparent 70%),radial-gradient(ellipse 30% 30% at 12% 12%,rgba(0,0,0,.9),transparent 70%),radial-gradient(ellipse 30% 30% at 88% 88%,rgba(0,0,0,.9),transparent 70%)}
#abfx .lbl{inset:auto 0 24% 0;text-align:center;font-weight:800;font-size:46px;letter-spacing:12px;color:var(--ac,#fff);text-shadow:0 0 18px var(--ac,#fff),0 2px 6px #000;opacity:0}
#abfx .lbl small{display:block;font-size:13px;letter-spacing:4px;font-weight:700;opacity:.85;margin-top:2px;text-shadow:0 1px 4px #000}
#abfx .lbl.go{animation:abLbl 1.25s ease-out forwards}
#abfx .lbl.end{animation:abEnd .9s ease-out forwards;font-size:20px;letter-spacing:6px;color:#cfd3d8;text-shadow:0 1px 4px #000}
@keyframes abLbl{0%{opacity:0;transform:scale(1.9);filter:blur(6px)}14%{opacity:1;transform:scale(1);filter:blur(0)}70%{opacity:1;transform:scale(1.04)}100%{opacity:0;transform:scale(1.1) translateY(-14px)}}
@keyframes abEnd{0%{opacity:0;transform:translateY(8px)}20%{opacity:.9;transform:none}100%{opacity:0}}
#abil.rdyp{animation:abRdy .55s ease-in-out 3}
@keyframes abRdy{0%,100%{filter:none}50%{filter:drop-shadow(0 0 7px #8dff5a) drop-shadow(0 0 14px #8dff5a);transform:translateX(-50%) scale(1.08)}}
#abil .sec{font-size:22px;letter-spacing:1px;margin-left:4px}
body.mob #abfx .lbl{font-size:24px;letter-spacing:6px;bottom:30%}body.mob #abfx .lbl small{font-size:10px;letter-spacing:3px}
`;

// köşelerden içeri uzanan çatlaklar (zırh): ekran oranına göre uzar (preserveAspectRatio none)
const CRACK = `<svg viewBox="0 0 1600 900" preserveAspectRatio="none"><g fill="none" stroke-linecap="round" stroke-linejoin="round">
<g stroke="rgba(10,20,35,.6)" stroke-width="6"><path d="M0 120L70 140L120 210L190 225L230 300M120 210L95 290M70 140L110 60L180 40"/><path d="M1600 90L1520 120L1470 100L1400 160L1330 170M1470 100L1480 30M1400 160L1420 240"/><path d="M0 780L90 760L150 800L230 770L290 820M150 800L170 880M90 760L60 690"/><path d="M1600 800L1510 770L1450 820L1370 800M1510 770L1530 690L1480 640M1450 820L1440 900"/></g>
<g stroke="rgba(225,240,255,.9)" stroke-width="2.2"><path d="M0 120L70 140L120 210L190 225L230 300M120 210L95 290M70 140L110 60L180 40"/><path d="M1600 90L1520 120L1470 100L1400 160L1330 170M1470 100L1480 30M1400 160L1420 240"/><path d="M0 780L90 760L150 800L230 770L290 820M150 800L170 880M90 760L60 690"/><path d="M1600 800L1510 770L1450 820L1370 800M1510 770L1530 690L1480 640M1450 820L1440 900"/></g></g></svg>`;

export const COL = { rage: '#ff3b2a', burst: '#ffd24a', shield: '#9cc8ff', cloak: '#a8ecff', blink: '#d58aff', shadow: '#b07cff' };

export class AbilityFx {
  constructor(game) {
    this.game = game;
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const el = (this.el = document.createElement('div')); el.id = 'abfx';
    el.innerHTML = '<div class="vg"></div><div class="sm"></div><div class="ln"></div><div class="ln2"></div><div class="cr">' + CRACK + '</div><div class="sh"></div><div class="fl"></div><div class="lbl"></div>';
    game.hud.root.prepend(el);                                         // HUD öğelerinin altında, oyun görüntüsünün üstünde
    const q = (c) => el.querySelector('.' + c);
    this.L = { vg: q('vg'), sm: q('sm'), ln: q('ln'), ln2: q('ln2'), cr: q('cr'), sh: q('sh'), fl: q('fl'), lbl: q('lbl') };
    this.id = '';            // etkin (ya da sönmekte olan) güç
    this.k = 0;              // şiddet zarfı 0..1
    this.t = 0;              // etkinleşmeden beri geçen süre
    this.flash = 0; this.flashCol = '255,255,255'; this.flashRad = false;
    this.fovAdd = 0; this.stepMul = 1; this.dimHits = false;
    this.prevAbT = 0; this.prevAct = 0; this.prevHp = 0; this.prevAlive = false; this.prevZ = false; this.rdy = false;
    this.beat = -1; this.filter = '';
    this.hands = null;       // el / pençe malzemesi kopyaları (asıl → kopya)
    this.state = { on: '', act: 0, flash: 0, label: '' };       // test / hata ayıklama için okunur
  }

  dispose() { this._handsOff(); this._setFilter(''); this.el.remove(); this.st.remove(); }

  // Etkinleşme anı (yerel durum değişiminden algılanır; sunucu ya da yerel useAbility fark etmez)
  _start(id) {
    const g = this.game, sfx = g.sfx;
    this.id = id; this.t = 0; this.k = 1; this.beat = -1;
    document.getElementById('abil')?.classList.remove('rdyp');                // hazır parlaması sürüyorsa kes (etkin renge geçsin)
    const lb = this.L.lbl, ab = g.playerSoldier.ability;
    this.name = ab ? abilName(ab) : '';
    lb.className = 'lbl'; lb.style.setProperty('--ac', COL[id]);
    lb.innerHTML = `${UP(this.name)}<small>${t('zab.sub.' + id)}</small>`;
    void lb.offsetWidth; lb.className = 'lbl go';
    const sh = (v) => { g.effects.shake = Math.max(g.effects.shake || 0, v); };
    switch (id) {
      case 'rage': sh(0.55); this._flash('255,40,20', 0.45, true);
        sfx._tone({ gain: 0.5, dur: 0.75, f0: 92, f1: 52, type: 'sawtooth' }); sfx._tone({ gain: 0.2, dur: 0.7, f0: 180, f1: 96, type: 'square', delay: 0.02 });
        sfx._noise({ gain: 0.3, dur: 0.6, f0: 520, f1: 160, type: 'bandpass', q: 1.1 }); break;
      case 'burst': sh(0.2); this._flash('255,240,200', 0.25, true);
        sfx._noise({ gain: 0.55, dur: 0.45, f0: 320, f1: 2600, type: 'bandpass', q: 1.4 }); sfx._noise({ gain: 0.22, dur: 1.8, f0: 1800, f1: 420, type: 'bandpass', q: 0.8, delay: 0.3 }); break;
      case 'shield': sh(0.25); this._flash('170,210,255', 0.5, false);
        sfx._tone({ gain: 0.3, dur: 0.55, f0: 640, f1: 610, type: 'triangle' }); sfx._tone({ gain: 0.12, dur: 0.3, f0: 1290, f1: 1250, type: 'square' });
        sfx._tone({ gain: 0.35, dur: 0.25, f0: 120, f1: 70, type: 'sine' }); sfx._noise({ gain: 0.25, dur: 0.08, f0: 6000, f1: 3000, type: 'highpass' }); break;
      case 'cloak': this._flash('200,245,255', 0.35, false);
        sfx._noise({ gain: 0.22, dur: 0.9, f0: 7000, f1: 2500, type: 'highpass' }); sfx._tone({ gain: 0.14, dur: 0.7, f0: 1100, f1: 260, type: 'sine' }); break;
      case 'blink': sh(0.3); this._flash('235,200,255', 1, true);
        sfx._noise({ gain: 0.5, dur: 0.2, f0: 3200, f1: 380, type: 'bandpass', q: 1.2 }); sfx._tone({ gain: 0.32, dur: 0.12, f0: 220, f1: 1500, type: 'sine', delay: 0.09 });
        sfx._tone({ gain: 0.18, dur: 0.16, f0: 1500, f1: 700, type: 'triangle', delay: 0.18 }); break;
      case 'shadow': sh(0.75); this._flash('40,0,60', 0.95, false);
        sfx._tone({ gain: 0.9, dur: 1.2, f0: 72, f1: 24, type: 'sine' }); sfx._noise({ gain: 0.7, dur: 1.0, f0: 1300, f1: 60 });
        sfx._tone({ gain: 0.22, dur: 0.9, f0: 52, f1: 30, type: 'sawtooth', delay: 0.05 }); break;
    }
  }
  _flash(rgb, a, rad) { this.flashCol = rgb; this.flash = Math.max(this.flash, a); this.flashRad = rad; }
  _label(txt, cls = 'end') { const lb = this.L.lbl; lb.className = 'lbl'; lb.textContent = txt; void lb.offsetWidth; lb.className = 'lbl ' + cls; }
  _bg(b) { const v = this.L.vg; if (v._bg !== b) { v._bg = b; v.style.background = b; } }        // aynı degrade her karede yeniden yazılmasın
  _setFilter(f) { if (f === this.filter) return; this.filter = f; const c = this.game.renderer?.domElement; if (c) c.style.filter = f; }

  // Eller / pençeler: malzemenin kopyası (asıl malzeme diğer modellerle paylaşılıyor olabilir) → parlama / saydamlık
  _handsOn(fn) {
    const vm = this.game.player?.vm; if (!vm) return;
    if (!this.hands) this.hands = { map: new Map(), meshes: [] };
    const H = this.hands;
    if (H.model !== vm.model || (H.scanT = (H.scanT || 0) - 1) <= 0) {        // silah/el değişince (ya da arada bir) yeniden tara
      H.model = vm.model; H.scanT = 20;
      vm.scene.traverse((o) => {
        if (!o.isMesh || o.userData.__abOrig) return;
        const orig = o.material, one = (m) => { let c = H.map.get(m); if (!c) { c = m.clone(); c.userData.__abBase = { e: m.emissive ? m.emissive.clone() : null, ei: m.emissiveIntensity ?? 1, op: m.opacity, tr: m.transparent, dw: m.depthWrite }; H.map.set(m, c); } return c; };
        o.userData.__abOrig = orig; o.material = Array.isArray(orig) ? orig.map(one) : one(orig); H.meshes.push(o);
      });
    }
    for (const c of H.map.values()) fn(c, c.userData.__abBase);
  }
  _handsOff() {
    const H = this.hands; if (!H) return;
    for (const o of H.meshes) { if (o.userData.__abOrig) { o.material = o.userData.__abOrig; delete o.userData.__abOrig; } }
    for (const c of H.map.values()) c.dispose();
    this.hands = null;
  }

  update(dt) {
    const g = this.game, p = g.playerSoldier, L = this.L;
    const zomb = !!(p && p.alive && p.def.zombie && p.ability);
    if (!zomb) {
      if (this.prevZ || this.k > 0 || this.id) { this.id = ''; this.k = 0; this.flash = 0; this._off(); }
      this.prevZ = false; this.prevAlive = !!p?.alive; this.rdy = false;
      return;
    }
    const ab = p.ability, act = p.abActive, abT = p.abT;
    if (!this.prevZ) { this.prevAbT = abT; this.prevAct = act; this.prevHp = p.hp; this.rdy = abT <= 0 && act <= 0; }
    // etkinleşme: bekleme süresi güç süresine sıçradı (başarısız ışınlanma 0,8 sn ve doğuş 2,5 sn bunu tetiklemez)
    if (abT > this.prevAbT + 0.5 && abT >= ab.cd * 0.6) this._start(ab.id);
    else if (this.id && this.id === ab.id && ab.dur > 0 && this.prevAct > 0 && act <= 0) {
      if (ab.id === 'cloak' || ab.id === 'shadow') {
        if (this.prevAct > 0.25) { this._flash('235,250,255', 0.75, false); this._label(t('zab.revealed')); g.sfx._tone({ gain: 0.26, dur: 0.22, f0: 320, f1: 1250, type: 'sine' }); g.sfx._noise({ gain: 0.2, dur: 0.12, f0: 5000, f1: 2000, type: 'bandpass' }); }
        else { this._label(t('zab.visible')); g.sfx._tone({ gain: 0.14, dur: 0.2, f0: 520, f1: 260, type: 'sine' }); }
      } else { this._label(t('zab.end', { name: UP(abilName(ab)) })); g.sfx._tone({ gain: 0.14, dur: 0.22, f0: 480, f1: 230, type: 'sine' }); }
    }
    // zırhlıyken isabet: sekme parlaması + metal çınlaması
    if (p.hp < this.prevHp - 0.5 && act > 0 && ab.id === 'shield') {
      this._flash('190,225,255', 0.55, true);
      g.sfx._tone({ gain: 0.28, dur: 0.12, f0: 2100, f1: 1800, type: 'square' }); g.sfx._tone({ gain: 0.26, dur: 0.4, f0: 930, f1: 880, type: 'triangle' }); g.sfx._noise({ gain: 0.22, dur: 0.05, f0: 7000, f1: 4000, type: 'bandpass' });
      this.deflectT = 0.18;
    }
    // hazır: gösterge parlar + kısa ses
    const rdy = abT <= 0 && act <= 0;
    if (rdy && !this.rdy && this.prevZ) {
      const ae = g.hud.$?.('abil') || document.getElementById('abil');
      if (ae) { ae.classList.remove('rdyp'); void ae.offsetWidth; ae.classList.add('rdyp'); setTimeout(() => ae.classList.remove('rdyp'), 1700); }
      g.sfx._tone({ gain: 0.16, dur: 0.09, f0: 660, f1: 660, type: 'triangle' }); g.sfx._tone({ gain: 0.18, dur: 0.16, f0: 990, f1: 990, type: 'triangle', delay: 0.08 });
    }
    this.rdy = rdy; this.prevZ = true; this.prevAbT = abT; this.prevAct = act; this.prevHp = p.hp;

    // zarf: etkinken 1, bitince ~0,35 sn'de söner; ışınlanma (süresiz) kısa bir geçiştir
    const id = this.id;
    this.t += dt;
    const on = id && id === ab.id && (act > 0 || (id === 'blink' && this.t < 0.5));
    this.k = on ? Math.min(1, this.k + dt * 8) : Math.max(0, this.k - dt * 3);
    if (!on && this.k <= 0 && this.flash <= 0.01) { if (id) { this.id = ''; this._off(); } return; }
    this._paint(dt, id, this.k, act, ab);
  }

  _off() {
    for (const k in this.L) if (k !== 'lbl') this.L[k].style.opacity = 0;
    this._setFilter(''); this._handsOff();
    this.fovAdd = 0; this.stepMul = 1; this.dimHits = false;
    this.state = { on: '', act: 0, flash: 0, label: this.L.lbl.className };
  }

  _paint(dt, id, k, act, ab) {
    const L = this.L, mob = document.body.classList.contains('mob'), t = this.t;
    const o = { vg: 0, sm: 0, ln: 0, ln2: 0, cr: 0, sh: 0 };
    let filt = '', fov = 0; this.stepMul = 1; this.dimHits = false;
    this.flash = Math.max(0, this.flash - dt * (id === 'shadow' ? 2.2 : 3.2));
    if (id === 'rage') {
      const ph = t % 0.72, beat = Math.exp(-ph * 9) + 0.7 * Math.exp(-Math.max(0, ph - 0.17) * 9) * (ph > 0.17 ? 1 : 0);     // lub-dub
      const bi = Math.floor(t / 0.72);
      if (bi !== this.beat && k > 0.5) { this.beat = bi; this.game.sfx._tone({ gain: 0.42, dur: 0.13, f0: 62, f1: 40, type: 'sine' }); this.game.sfx._tone({ gain: 0.3, dur: 0.12, f0: 58, f1: 38, type: 'sine', delay: 0.17 }); }
      this._bg('radial-gradient(ellipse at center,transparent 42%,rgba(150,0,0,.55) 72%,rgba(210,10,0,.92) 100%)');
      o.vg = k * (0.5 + 0.45 * Math.min(1, beat));
      filt = `saturate(${1 + 0.35 * k}) contrast(${1 + 0.06 * k})`;
      fov = 9 * Math.exp(-t * 5) * k + 2.5 * k;          // ilk vuruş, sonra hafif geniş
      this.stepMul = 1.15;
      this._handsOn((m, b) => { if (m.emissive) { m.emissive.setRGB(1, 0.07, 0.02); m.emissiveIntensity = (0.1 + 0.22 * Math.min(1, beat)) * k; } });
    } else if (id === 'burst') {
      this._bg('radial-gradient(ellipse at center,transparent 50%,rgba(255,200,90,.35) 100%)');
      o.vg = 0.7 * k; o.ln = (mob ? 0.4 : 0.55) * k; o.ln2 = (mob ? 0.3 : 0.45) * k;
      L.ln.style.setProperty('--lc', 'rgba(255,250,235,.7)'); L.ln2.style.setProperty('--lc', 'rgba(255,250,235,.55)');
      L.ln.style.transform = `rotate(${(Math.random() * 360).toFixed(1)}deg) scale(${(1 + Math.random() * 0.06).toFixed(3)})`;
      L.ln2.style.transform = `rotate(${(Math.random() * 360).toFixed(1)}deg)`;
      fov = 13 * k; this.stepMul = 1.35;
    } else if (id === 'shield') {
      this._bg('radial-gradient(ellipse at center,transparent 48%,rgba(60,105,165,.5) 80%,rgba(90,140,200,.85) 100%)');
      const d = (this.deflectT = Math.max(0, (this.deflectT || 0) - dt));
      o.vg = k * (0.6 + 0.8 * d); o.cr = k * (0.75 + 1.4 * d);
      L.cr.style.transform = d > 0 ? `translate(${((Math.random() - 0.5) * 6).toFixed(1)}px,${((Math.random() - 0.5) * 6).toFixed(1)}px)` : '';
      filt = `saturate(${1 - 0.25 * k}) brightness(${1 - 0.03 * k})`;
      this.dimHits = true;
      if (act > 0 && act < 1.2) o.cr *= 0.55 + 0.45 * Math.abs(Math.sin(t * 14));       // bitmek üzere: titrer
      this._handsOn((m) => { if (m.emissive) { m.emissive.setRGB(0.35, 0.55, 0.9); m.emissiveIntensity = 0.22 * k; } if ('metalness' in m) { m.metalness = 0.55 * k; m.roughness = 0.86 - 0.5 * k; } });
    } else if (id === 'cloak') {
      this._bg('radial-gradient(ellipse at center,transparent 40%,rgba(120,180,215,.35) 78%,rgba(150,210,240,.6) 100%)');
      o.vg = k * 0.85; o.sh = k * (0.55 + 0.25 * Math.sin(t * 2.3));
      L.sh.style.backgroundPosition = `${(((t * 0.35) % 1) * 220 - 60).toFixed(1)}% 0`;
      filt = `saturate(${(1 - 0.72 * k).toFixed(2)}) brightness(${(1 + 0.07 * k).toFixed(2)}) contrast(${(1 - 0.08 * k).toFixed(2)})`;
      if (act > 0 && act < 1.3) o.sh *= 0.4 + 0.6 * Math.abs(Math.sin(t * 12));
      this._handsOn((m, b) => { m.transparent = true; m.opacity = 1 - 0.68 * k; m.depthWrite = k < 0.5; if (m.emissive) { m.emissive.setRGB(0.4, 0.75, 0.9); m.emissiveIntensity = 0.3 * k; } });
    } else if (id === 'blink') {
      const e = Math.max(0, 1 - t / 0.42);                                        // geçiş 0,4 sn
      L.ln.style.setProperty('--lc', 'rgba(225,175,255,.85)'); L.ln2.style.setProperty('--lc', 'rgba(255,255,255,.7)');
      o.ln = e; o.ln2 = e * 0.8;
      L.ln.style.transform = `scale(${(0.55 + t * 3).toFixed(3)}) rotate(${(t * 40).toFixed(1)}deg)`; L.ln2.style.transform = `scale(${(0.7 + t * 2.4).toFixed(3)})`;
      this._bg('radial-gradient(ellipse at center,transparent 35%,rgba(150,60,220,.7) 100%)');
      o.vg = e;
      if (!mob && e > 0) filt = `blur(${(2.5 * e).toFixed(2)}px) saturate(${(1 + e).toFixed(2)}) hue-rotate(${(-25 * e).toFixed(0)}deg)`;
      fov = t < 0.1 ? -16 : 7 * Math.exp(-(t - 0.1) * 6);                     // sıkış → bırak
    } else if (id === 'shadow') {
      this._bg('radial-gradient(ellipse at center,transparent 30%,rgba(40,0,70,.6) 68%,rgba(12,0,22,.95) 100%)');
      o.vg = k; o.sm = k * (0.85 + 0.15 * Math.sin(t * 3));
      L.sm.style.transform = `scale(${(1.04 + 0.04 * Math.sin(t * 1.7)).toFixed(3)}) rotate(${(Math.sin(t * 0.9) * 3).toFixed(2)}deg)`;
      filt = `saturate(${(1 - 0.5 * k).toFixed(2)}) brightness(${(1 - 0.16 * k).toFixed(2)}) contrast(${(1 + 0.1 * k).toFixed(2)})`;
      fov = t < 0.12 ? -14 : 6 * Math.exp(-(t - 0.12) * 4);
      this._handsOn((m) => { m.transparent = true; m.opacity = 1 - 0.55 * k; m.depthWrite = k < 0.5; if (m.emissive) { m.emissive.setRGB(0.45, 0.12, 0.8); m.emissiveIntensity = 0.35 * k; } });
    }
    for (const n in o) L[n].style.opacity = o[n].toFixed(3);
    const f = this.flash;
    const fk = this.flashCol + this.flashRad; if (L.fl._k !== fk) L.fl._k = fk, L.fl.style.background = this.flashRad ? `radial-gradient(circle at center,rgba(${this.flashCol},1) 0%,rgba(${this.flashCol},.55) 45%,rgba(${this.flashCol},.15) 100%)` : `rgba(${this.flashCol},.9)`;
    L.fl.style.opacity = f.toFixed(3);
    this._setFilter(filt);
    this.fovAdd = fov;
    if (this.k <= 0 && !(id === 'blink')) this._handsOff();
    this.state = { on: id, act: +act.toFixed(2), k: +this.k.toFixed(2), flash: +f.toFixed(2), vg: +o.vg.toFixed(2), ln: +o.ln.toFixed(2), cr: +o.cr.toFixed(2), sm: +o.sm.toFixed(2), sh: +o.sh.toFixed(2), filter: filt, fov: +fov.toFixed(1), label: L.lbl.className };
  }
}
