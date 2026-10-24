// 12.156: Keskin nişancı dürbün sallanması + nefes tutma (yalnız yerel insan oyuncu; botlar ve sunucu bu dosyayı kullanmaz).
// · Sallanma (nefes / el titremesi): yavaş Lissajous benzeri 8 çizen kayma (BattleBit / CoD gibi). Bakış açısına (yaw / pitch) "sanal fare
//   hareketi" olarak eklenir → kamera, retikül ve mermi AYNI yere bakar (isabet dürüst). Çevrim içinde yaw / pitch zaten her girdiyle sunucuya
//   gider (game.humanTick: s.yaw = inp.yw), sunucu sallanmayı yeniden hesaplamaz → istemci ile sunucunun atış yönü birebir aynı, tohum gerekmez.
//   Genlik dürbün oturdukça (adsT 0,55 → 1) açılır, çıkınca / ölünce söner → ofset sıfıra döner (bakış kalıcı kaymaz).
// · Nefes tut (varsayılan Shift; dokunmatikte dürbündeyken çıkan nefes düğmesi): ~0,25 sn'de sallanma %5'e iner, en çok BREATH.hold sn.
//   Süre biterse zorla bırakılır (tuş bırakılana dek yeniden tutulamaz) + nefes nefese (sallanma birkaç sn ×2'ye kadar, daha hızlı); erken
//   bırakmada kullanılan nefesle orantılı kısa nefes nefese. Nefes ~BREATH.refill sn'de dolar (nefes nefeseyken yarı hızda).
// · Gösterge: dürbün katmanında alt-orta ince çubuk (hud kökünde #breath, #scope'tan hemen sonra); ses: hafif nefes alma / verme (sfx gürültüsü).
import { clamp } from './util.js';

export const BREATH = {
  hold: 4.5,          // en uzun nefes tutma (sn)
  refill: 4,          // boştan dolum (sn)
  minStart: 0.2,      // tutmaya başlamak için en az nefes
  gasp: 3,            // süre bitince nefes nefese (sn)
  yaw: 0.0045,        // temel genlik (rad): yatay / dikey (M24, ayakta, duran)
  pitch: 0.0032,
  heavy: { barrett: 1.25 },
};
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const CSS = `#breath{position:absolute;left:50%;top:76vh;width:15vh;height:max(3px,.42vh);margin-left:-7.5vh;background:rgba(0,0,0,.5);box-shadow:0 0 0 1px rgba(0,0,0,.35);display:none;opacity:0;transition:opacity .25s}
#breath i{position:absolute;left:0;top:0;bottom:0;width:100%;background:rgba(236,241,246,.92);transform-origin:0 50%}
#breath.low i{background:#ff7a3a}
body.mob #breath{top:80vh;width:20vh;margin-left:-10vh}`;

export class ScopeBreath {
  constructor(game) {
    this.g = game;
    this.t = Math.random() * 40;              // faz (yerel; çevrim içinde sonuç yaw / pitch olarak gider)
    this.air = 1; this.hold = 0; this.gasp = 0; this.lock = false; this.holding = false;
    this.amp = 0; this.k = 0; this.ox = 0; this.oy = 0;
    this.el = null; this._ui = '';
  }
  reset() { this.amp = 0; this.ox = 0; this.oy = 0; this.hold = 0; this.holding = false; this.air = 1; this.gasp = 0; this.lock = false; this._show(false); }
  // Bu karede bakışa eklenecek [dyaw, dpitch] (rad). want: nefes tut tuşu / düğmesi basılı
  step(dt, s, want) {
    const on = s.alive && s.overlay === 'scope';
    const k = (this.k = on ? sm((s.adsT - 0.55) / 0.45) : 0), scoped = k > 0.6;
    if (!want) this.lock = false;
    let hold = scoped && want && !this.lock && (this.holding ? this.air > 0 : this.air > BREATH.minStart);
    if (this.holding && !hold) this._release(false);
    else if (!this.holding && hold) this._sfx('in');
    this.holding = hold;
    if (hold) {
      this.air -= dt / BREATH.hold;
      if (this.air <= 0) { this.air = 0; this.lock = true; this.holding = hold = false; this._release(true); }
    } else this.air = Math.min(1, this.air + (dt / BREATH.refill) * (this.gasp > 0 ? 0.5 : 1));
    this.gasp = Math.max(0, this.gasp - dt);
    this.hold += ((hold ? 1 : 0) - this.hold) * (1 - Math.exp(-dt * (hold ? 12 : 6)));        // 0,25 sn'de %95
    const gn = Math.min(1, this.gasp / 2);
    const sp = Math.hypot(s.vel.x, s.vel.z);
    const stance = s.prone ? 0.45 : s.crouching ? 0.7 : 1, mv = 1 + Math.min(1, sp / 2.5) * 0.9 + (s.onGround || s.fly ? 0 : 0.6);
    const tgt = k * (BREATH.heavy[s.item?.id] || 1) * stance * mv * (1 + 1.2 * gn) * (1 - 0.95 * this.hold);
    this.amp += (tgt - this.amp) * (1 - Math.exp(-dt * 7));
    this.t += dt * (1 + 0.6 * gn);
    const t = this.t;
    const fx = Math.sin(t * 1.6) * 0.8 + Math.sin(t * 0.61 + 1.1) * 0.35;                              // yatay: yavaş salınım + sürüklenme
    const fy = Math.sin(t * 3.2 + 0.6) * 0.55 + Math.sin(t * 0.93 + 2.3) * 0.3 + gn * Math.sin(t * 7.5) * 0.45;   // dikey: 2× frekans (8 çizer) + nefes nefese hızlı iniş-kalkış
    const ox = this.amp * BREATH.yaw * fx, oy = this.amp * BREATH.pitch * fy;
    const d = [ox - this.ox, oy - this.oy];
    this.ox = ox; this.oy = oy;
    this._draw(on && k > 0.9 && !!this.g?.player?.scopeOn);
    return d;
  }
  _release(forced) {
    this.gasp = Math.max(this.gasp, forced ? BREATH.gasp : 0.4 + 1.8 * (1 - this.air));
    this._sfx(forced ? 'gasp' : 'out');
  }
  _sfx(kind) {
    const x = this.g?.sfx; if (!x?.ctx) return;
    try {
      if (kind === 'in') x._noise({ pos: null, gain: 0.045, dur: 0.42, f0: 650, f1: 1500, type: 'bandpass', q: 0.9, att: 0.22 });
      else if (kind === 'out') x._noise({ pos: null, gain: 0.05, dur: 0.55, f0: 1300, f1: 450, type: 'lowpass', att: 0.04 });
      else for (let i = 0; i < 3; i++) x._noise({ pos: null, gain: 0.065 - i * 0.012, dur: 0.32, f0: 1500, f1: 520, type: 'lowpass', att: 0.03, delay: i * 0.42 });
    } catch (e) { /* ses yoksa sessiz */ }
  }
  _show(v) { if (this.el && (this.el.style.display === 'block') !== v) this.el.style.display = v ? 'block' : 'none'; }
  _draw(v) {
    if (!this.el) {
      const root = this.g?.hud?.root, sc = root?.querySelector('#scope'); if (!sc || typeof document === 'undefined') return;
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      this.el = document.createElement('div'); this.el.id = 'breath'; this.el.innerHTML = '<i></i>'; sc.after(this.el);
    }
    this._show(v);
    if (!v) return;
    const low = this.lock || this.gasp > 0.05 || this.air < 0.25;
    const key = this.air.toFixed(3) + (low ? 'l' : '') + (this.holding || this.air < 0.999 ? 'a' : '');
    if (key === this._ui) return;
    this._ui = key;
    this.el.firstChild.style.transform = `scaleX(${this.air.toFixed(3)})`;
    this.el.classList.toggle('low', low);
    this.el.style.opacity = this.holding || this.air < 0.999 ? '0.95' : '0.4';      // dolu ve tutulmuyorken soluk (göz merceğini kalabalıklaştırmasın)
  }
}
