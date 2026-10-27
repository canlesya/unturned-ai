import { t } from '../i18n/index.js';
import '../i18n/vehicle.js';
import { codeLabel } from '../core/keybinds.js';
import * as THREE from 'three';
import { gunPose, mgAt } from '../sim/vehicle.js';

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
#vhPanel .gun{display:none;margin-bottom:6px;font-size:12px;letter-spacing:2px;font-weight:700}#vhPanel .gun i{display:block;height:5px;margin-top:3px;background:rgba(255,255,255,.12)}#vhPanel .gun i b{display:block;height:100%;background:#ffb04a}
#vhGun{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border:2px solid rgba(255,190,90,.95);border-radius:50%;pointer-events:none;display:none;box-shadow:0 0 4px #000}
#vhGun::after{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#ffbe5a;border-radius:50%}
#vhGun.rl{border-color:rgba(200,200,200,.5)}#vhGun.rl::after{background:#aaa}
#vhArm{position:absolute;left:50%;top:calc(50% + 22px);transform:translateX(-50%);font:700 11px Bahnschrift,Rajdhani,sans-serif;letter-spacing:3px;color:#cfd4da;opacity:0;pointer-events:none;text-shadow:0 1px 2px #000}
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
    this.p.innerHTML = `<div class="top"><span class="nm"></span><span class="spd"></span></div><div class="hp"><i></i></div><div class="gun"><span></span><i><b></b></i></div><div class="seats">${[0, 1, 2, 3].map(() => '<div></div>').join('')}</div><div class="hint"></div><div class="warn"></div>`;
    this.hit = document.createElement('div'); this.hit.id = 'vhHit';
    this.gunEl = document.createElement('div'); this.gunEl.id = 'vhGun';
    this.arm = document.createElement('div'); this.arm.id = 'vhArm'; this.arm.textContent = t('veh.armor');
    root.append(this.pr, this.p, this.hit, this.gunEl, this.arm);
    this.q = { nm: this.p.querySelector('.nm'), spd: this.p.querySelector('.spd'), hp: this.p.querySelector('.hp i'), seats: [...this.p.querySelectorAll('.seats div')], hint: this.p.querySelector('.hint'), warn: this.p.querySelector('.warn'), gun: this.p.querySelector('.gun'), gunT: this.p.querySelector('.gun span'), gunB: this.p.querySelector('.gun i b') };
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
    this.reticle(v && v.st && me.seat === 0 && v.def.cannon ? v : null);
    const am = (this._am ||= this.g.hud.root.querySelector('#ammo')), hideAm = !!(v && (me.seat === 0 || mgAt(v.def, me.seat)));      // sürücü / makineli: kendi silahının cephanesi anlamsız
    if (am) this.set(am.style, 'amv', hideAm ? 'hidden' : '', 'visibility');
    if (!v || !v.st) return;
    const d = v.def, hp = Math.max(0, v.hp / d.hp);
    this.set(this.q.nm, 'nm', t('veh.' + v.type));
    const spd = Math.round(Math.hypot(v.st.vx, v.st.vz) * 3.6);
    this.set(this.q.spd, 'spd', me.seat === 0 ? `${spd}<small>${t('veh.kmh')}</small>` : '', 'innerHTML');
    this.set(this.q.hp.style, 'hpw', Math.round(hp * 100) + '%', 'width');
    this.set(this.q.hp.style, 'hpc', hp > 0.5 ? '#7fd36a' : hp > d.burnAt ? '#ffc94a' : '#ff5a3a', 'background');
    this.q.seats.forEach((el, i) => this.set(el.style, 'sd' + i, i < v.seats.length ? '' : 'none', 'display'));
    const c = d.cannon, gunner = !!mgAt(d, me.seat);
    this.set(this.q.gun.style, 'gd', c && (me.seat === 0 || gunner) ? 'block' : 'none', 'display');
    if (c && me.seat === 0) { this.set(this.q.gunT, 'gt', v.rl > 0 ? t('veh.reload', { n: v.rl.toFixed(1) }) : t('veh.ready')); this.set(this.q.gunB.style, 'gw', Math.round((1 - v.rl / c.reload) * 100) + '%', 'width'); }
    else if (gunner) { this.set(this.q.gunT, 'gt', t('veh.mg')); this.set(this.q.gunB.style, 'gw', '100%', 'width'); }
    if (d.heli) {                                                         // 12.179 helikopter: rotor devri + irtifa (zeminden)
      const alt = Math.max(0, v.st.y - g.world.heightAt(v.st.x, v.st.z)), r = Math.round((v.st.rpm || 0) * 100);
      this.set(this.q.gun.style, 'gd', 'block', 'display');
      this.set(this.q.gunT, 'gt', t('veh.heliBar', { r, h: Math.round(alt) }));
      this.set(this.q.gunB.style, 'gw', r + '%', 'width');
    }
    v.seats.forEach((o, i) => {
      const el = this.q.seats[i], mine = o === me;
      this.set(el, 's' + i, `<b>${i + 1}</b>${o ? o.name : t('veh.empty')}`, 'innerHTML');
      this.set(el, 'sc' + i, mine ? 'me' : '', 'className');
      this.set(el.style, 'sb' + i, o && !mine ? (o.team === 'blue' ? 'rgba(74,163,255,.25)' : 'rgba(255,90,67,.25)') : '', 'background');
    });
    const hk = d.heli ? (me.seat === 0 ? 'veh.hint.heli' : gunner ? 'veh.hint.gunner' : 'veh.hint.pas') : c ? (me.seat === 0 ? 'veh.hint.tank' : 'veh.hint.gunner') : me.seat === 0 ? 'veh.hint.drv' : 'veh.hint.pas';
    this.set(this.q.hint, 'hint', t(hk, { f: this.key('flashlight'), v: this.key('vehCam'), e: this.key('vehicle'), n: v.seats.length }), 'innerHTML');
    const w = v.burn ? t('veh.burn') : v.st.sunk ? t('veh.sunk') : d.heli && me.seat === 0 && (v.st.rpm || 0) < 0.85 ? t('veh.rotor') : '';
    this.set(this.q.warn, 'w', w); this.set(this.q.warn.style, 'wd', w ? 'block' : 'none', 'display');
  }

  // 12.178 top nişangâhı: merminin düşeceği nokta (namlu ucundan aynı yerçekimiyle yay; dünya / araç / 4 sn) ekrana izdüşürülür; dolumda gri
  reticle(v) {
    const el = this.gunEl;
    if (!v) { this.set(el.style, 'gvd', 'none', 'display'); return; }
    const g = this.g, c = v.def.cannon, st = g.vehView ? g.vehView.pose(v) : v.st, o = (this._o ||= { x: 0, y: 0, z: 0 }), d = (this._d ||= { x: 0, y: 0, z: 0 });
    gunPose(st, o, d);
    const p = (this._pp ||= new THREE.Vector3()).set(o.x, o.y, o.z), vel = (this._vv ||= new THREE.Vector3()).set(d.x * c.speed, d.y * c.speed, d.z * c.speed), dir = (this._dd ||= new THREE.Vector3());
    let hit = null;
    for (let k = 0; k < 100 && !hit; k++) {
      const h = 0.04; vel.y -= c.grav * h;
      const L = vel.length() * h; dir.copy(vel).multiplyScalar(1 / vel.length());
      const w = g.world.raycast(p, dir, L, (this._h ||= {})), vr = g.vehicles.raycast(p, dir, w ? w.t : L, v);
      if (vr) hit = p.clone().addScaledVector(dir, vr.t); else if (w) hit = w.point.clone();
      p.addScaledVector(vel, h);
    }
    const q = (hit || p).project(g.camera);
    const on = q.z < 1 && Math.abs(q.x) < 1.2 && Math.abs(q.y) < 1.2;
    this.set(el.style, 'gvd', on ? 'block' : 'none', 'display');
    if (!on) return;
    el.style.left = ((q.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; el.style.top = ((1 - q.y) / 2 * innerHeight).toFixed(1) + 'px';
    this.set(el, 'gcl', v.rl > 0 ? 'rl' : '', 'className');
  }

  onHit(e) {
    if (e.armor || e.dmg === 0) {                                     // zırh: mermi seker (hasar yok)
      this.arm.getAnimations?.().forEach((a) => a.cancel());
      this.arm.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' });
      this.g.sfx._tone?.({ gain: 0.08, dur: 0.1, f0: 2600, f1: 3400, type: 'triangle', att: 0.001 });
      return;
    }
    this.hit.getAnimations?.().forEach((a) => a.cancel());
    this.hit.animate([{ opacity: 1, transform: 'rotate(45deg) scale(1.1)' }, { opacity: 0, transform: 'rotate(45deg) scale(.7)' }], { duration: 220, easing: 'ease-out' });
    this.g.sfx._tone?.({ gain: 0.12, dur: 0.07, f0: 1700, f1: 1300, type: 'triangle', att: 0.001 });
  }

  dispose() { this.pr.remove(); this.p.remove(); this.hit.remove(); this.gunEl.remove(); this.arm.remove(); }
}
