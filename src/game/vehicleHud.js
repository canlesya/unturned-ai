import { t } from '../i18n/index.js';
import '../i18n/vehicle.js';
import { codeLabel } from '../core/keybinds.js';

// 12.177 araç HUD'u (yalnız tarayıcı): yaklaşınca binme ipucu ("E · Jip · Sür / Bin"), araçtayken panel: ad, can çubuğu, hız (sürücü),
// 4 koltuk (benimki turuncu, dolu = takım rengi + ad), tuş ipuçları, yanma / su uyarısı; araca isabette küçük turuncu işaret + metal tıkırtısı.
const CSS = `
#vhPrompt{position:absolute;left:50%;top:calc(50% + 62px);transform:translateX(-50%);padding:6px 16px;background:rgba(9,13,19,.74);border:1px solid rgba(255,255,255,.18);border-left:3px solid var(--acc,#ff8a1f);font:600 15px Bahnschrift,Rajdhani,'Arial Narrow',sans-serif;letter-spacing:1.5px;color:#e8edf5;display:none;white-space:nowrap;text-shadow:0 1px 3px #000;text-transform:uppercase}
#vhPrompt b{display:inline-block;min-width:22px;padding:1px 7px;margin-right:8px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.45);text-align:center}
#vhPanel{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);width:380px;display:none;font-family:Bahnschrift,Rajdhani,'Arial Narrow',sans-serif;color:#e8edf5;text-shadow:0 1px 3px #000;padding:9px 14px 8px;background:linear-gradient(180deg,rgba(9,13,19,.55),rgba(9,13,19,.82));border-top:2px solid var(--acc,#ff8a1f)}
#vhPanel .top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px}
#vhPanel .nm{font-size:17px;font-weight:800;letter-spacing:4px}
#vhPanel .spd{font-size:26px;font-weight:800;letter-spacing:1px;font-variant-numeric:tabular-nums}#vhPanel .spd small{font-size:11px;letter-spacing:2px;opacity:.7;margin-left:4px}
#vhPanel .hp{height:10px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.25);transform:skewX(-18deg);overflow:hidden;margin-bottom:7px}
#vhPanel .hp i{display:block;height:100%;background:#7fd36a;transition:width .15s}
#vhPanel .seats{display:flex;gap:6px;margin-bottom:6px}
#vhPanel .seats div{flex:1;min-width:0;padding:3px 5px;font-size:11px;letter-spacing:1px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#vhPanel .seats div b{margin-right:5px;opacity:.75}
#vhPanel .seats div.me{border-color:#ff8a1f;background:rgba(255,138,31,.22)}
#vhPanel .hint{font-size:11px;letter-spacing:.5px;opacity:.78;line-height:1.5}#vhPanel .hint b{color:#ffd9a8;font-weight:700}
#vhPanel .warn{display:none;margin-top:5px;text-align:center;font-size:13px;font-weight:800;letter-spacing:3px;color:#ff6a4a;animation:vhw .5s infinite alternate}
@keyframes vhw{to{opacity:.45}}
#vhHit{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #ffb04a;transform:rotate(45deg) scale(.6);opacity:0;pointer-events:none}
body.mob #vhPanel{zoom:.6;bottom:auto;top:calc(74px / .6);left:50%}
body.mob #vhPanel .hint{display:none}
body.mob #vhPrompt{zoom:.75}
`;

export class VehicleHud {
  constructor(game) {
    this.g = game;
    if (!document.getElementById('vhCss')) { const st = document.createElement('style'); st.id = 'vhCss'; st.textContent = CSS; document.head.appendChild(st); }
    const root = game.hud.root;
    this.pr = document.createElement('div'); this.pr.id = 'vhPrompt';
    this.p = document.createElement('div'); this.p.id = 'vhPanel';
    this.p.innerHTML = `<div class="top"><span class="nm"></span><span class="spd"></span></div><div class="hp"><i></i></div><div class="seats">${[0, 1, 2, 3].map(() => '<div></div>').join('')}</div><div class="hint"></div><div class="warn"></div>`;
    this.hit = document.createElement('div'); this.hit.id = 'vhHit';
    root.append(this.pr, this.p, this.hit);
    this.q = { nm: this.p.querySelector('.nm'), spd: this.p.querySelector('.spd'), hp: this.p.querySelector('.hp i'), seats: [...this.p.querySelectorAll('.seats div')], hint: this.p.querySelector('.hint'), warn: this.p.querySelector('.warn') };
    this._k = {};
    game.on('vehhit', (e) => this.onHit(e));
  }

  key(id) { const c = this.g.binds.codes(id)[0]; return c ? codeLabel(c) : '?'; }

  set(el, k, v, prop = 'textContent') { if (this._k[k] !== v) { this._k[k] = v; el[prop] = v; } }

  update() {
    const g = this.g, me = g.playerSoldier, V = g.vehicles;
    if (!V || !me) return;
    const v = me.alive ? me.veh : null;
    // binme ipucu
    const n = !v && me.alive && !g.ended ? V.near(me) : null;
    this.set(this.pr.style, 'prd', n ? 'block' : 'none', 'display');
    if (n) this.set(this.pr, 'prt', t('veh.prompt', { k: g.player?.touch ? '⟲' : this.key('vehicle'), n: t('veh.' + n.v.type), s: n.seat === 0 ? t('veh.drive') : t('veh.ride') + ' (' + t('veh.seat.' + n.seat).toLowerCase() + ')' }), 'innerHTML');
    this.set(this.p.style, 'pd', v ? 'block' : 'none', 'display');
    if (!v || !v.st) return;
    const d = v.def, hp = Math.max(0, v.hp / d.hp);
    this.set(this.q.nm, 'nm', t('veh.' + v.type));
    const spd = Math.round(Math.hypot(v.st.vx, v.st.vz) * 3.6);
    this.set(this.q.spd, 'spd', me.seat === 0 ? `${spd}<small>${t('veh.kmh')}</small>` : '', 'innerHTML');
    this.set(this.q.hp.style, 'hpw', Math.round(hp * 100) + '%', 'width');
    this.set(this.q.hp.style, 'hpc', hp > 0.5 ? '#7fd36a' : hp > d.burnAt ? '#ffc94a' : '#ff5a3a', 'background');
    v.seats.forEach((o, i) => {
      const el = this.q.seats[i], mine = o === me;
      this.set(el, 's' + i, `<b>${i + 1}</b>${o ? o.name : t('veh.empty')}`, 'innerHTML');
      this.set(el, 'sc' + i, mine ? 'me' : '', 'className');
      this.set(el.style, 'sb' + i, o && !mine ? (o.team === 'blue' ? 'rgba(74,163,255,.25)' : 'rgba(255,90,67,.25)') : '', 'background');
    });
    this.set(this.q.hint, 'hint', t(me.seat === 0 ? 'veh.hint.drv' : 'veh.hint.pas', { f: this.key('flashlight'), v: this.key('vehCam'), e: this.key('vehicle') }), 'innerHTML');
    const w = v.burn ? t('veh.burn') : v.st.sunk ? t('veh.sunk') : '';
    this.set(this.q.warn, 'w', w); this.set(this.q.warn.style, 'wd', w ? 'block' : 'none', 'display');
  }

  onHit(e) {
    this.hit.getAnimations?.().forEach((a) => a.cancel());
    this.hit.animate([{ opacity: 1, transform: 'rotate(45deg) scale(1.1)' }, { opacity: 0, transform: 'rotate(45deg) scale(.7)' }], { duration: 220, easing: 'ease-out' });
    this.g.sfx._tone?.({ gain: 0.12, dur: 0.07, f0: 1700, f1: 1300, type: 'triangle', att: 0.001 });
  }

  dispose() { this.pr.remove(); this.p.remove(); this.hit.remove(); }
}
