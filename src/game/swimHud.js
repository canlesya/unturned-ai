// 12.180 su HUD'u: nefes çubuğu (keskin nişancı nefes göstergesinden ayrı; ekranın alt ortası) + suya ilk girişte kısa ipucu.
// Yalnız su veren haritada kurulur. Nefes s.air'den (çevrim içinde istemci tahmini; boğulma hasarı sunucudan).
import { SWIM } from '../sim/swim.js';
import { t } from '../i18n/index.js';
import '../i18n/swim.js';

const CSS = `
#swimair{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);width:230px;pointer-events:none;opacity:0;transition:opacity .25s;font:700 11px Bahnschrift,'Segoe UI',sans-serif;letter-spacing:.12em;color:#d8f2f6;text-shadow:0 1px 2px #000a}
#swimair .l{display:flex;justify-content:space-between;margin-bottom:3px}
#swimair .b{height:7px;border-radius:4px;background:rgba(6,22,30,.62);border:1px solid rgba(160,220,235,.35);overflow:hidden}
#swimair .b i{display:block;height:100%;width:100%;transform-origin:left;background:linear-gradient(90deg,#4cc6e0,#9be6f4)}
#swimair.low .b i{background:linear-gradient(90deg,#e0603f,#f0a070)}
#swimair.low{animation:swimPulse .6s ease-in-out infinite alternate;color:#ffd0c0}
#swimair.drown .l b{color:#ff7a5a}
@keyframes swimPulse{from{filter:brightness(1)}to{filter:brightness(1.5)}}
@media (pointer:coarse){#swimair{bottom:96px;width:180px}}
`;

export class SwimHud {
  constructor(hud) {
    this.hud = hud; this.el = null; this.vis = false; this.hinted = false;
  }
  _build() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = (this.el = document.createElement('div')); el.id = 'swimair';
    el.innerHTML = `<div class="l"><b></b><span></span></div><div class="b"><i></i></div>`;
    (this.hud.root || document.body).appendChild(el);
    this.lbl = el.querySelector('b'); this.sec = el.querySelector('span'); this.bar = el.querySelector('i');
  }
  update(dt, s) {
    const air = s?.alive ? (s.air ?? SWIM.breath) : SWIM.breath, k = Math.max(0, Math.min(1, air / SWIM.breath));
    const show = !!s?.alive && (s.under || k < 0.999);
    if (!show && !this.vis) return;
    if (!this.el) this._build();
    if (show !== this.vis) { this.vis = show; this.el.style.opacity = show ? '1' : '0'; }
    if (!show) return;
    this.bar.style.transform = `scaleX(${k.toFixed(3)})`;
    const drown = air <= 0 && s.under, low = k < 0.3 && s.under;
    this.el.classList.toggle('low', low || drown); this.el.classList.toggle('drown', drown);
    const key = drown ? 'hud.swim.drown' : 'hud.swim.air';
    if (key !== this._k) { this._k = key; this.lbl.textContent = t(key); }
    const sec = Math.ceil(air); if (sec !== this._sec) { this._sec = sec; this.sec.textContent = drown ? '' : sec + ' s'; }
  }
  hint() {
    if (this.hinted) return;
    this.hinted = true;
    this.hud.toast?.(t(this.hud.game?.player?.touch ? 'hud.swim.hintTouch' : 'hud.swim.hint'), '#9be6f4');
  }
}
