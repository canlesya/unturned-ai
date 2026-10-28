import { t } from '../i18n/index.js';
import '../i18n/vehicle.js';
import { codeLabel } from '../core/keybinds.js';
import * as THREE from 'three';
import { gunPose, mgAt, seatGun, toWorld, noseDir, mgPitch } from '../sim/vehicle.js';
import { dirFromAngles } from './util.js';
import { nearCrate, crateAction, crateLabel } from './supply.js';      // 12.216 ikmal kutusu ipucu
import { MOTO_ICON } from './motorbike.js';                           // 12.204 motor simgesi

// 12.177 araç HUD'u (yalnız tarayıcı): yaklaşınca binme ipucu ("E · Jip · Sür / Bin"), araçtayken panel: ad, can çubuğu, hız (sürücü),
// 4 koltuk (benimki turuncu, dolu = takım rengi + ad), tuş ipuçları, yanma / su uyarısı; araca isabette küçük turuncu işaret + metal tıkırtısı.
const CSS = `
#vhPrompt{position:absolute;left:50%;top:calc(50% + 62px);transform:translateX(-50%);padding:6px 16px;background:rgba(9,13,19,.74);border:1px solid rgba(255,255,255,.18);border-left:3px solid var(--acc,#ff8a1f);font:600 15px Bahnschrift,Rajdhani,'Arial Narrow',sans-serif;letter-spacing:1.5px;color:#e8edf5;display:none;white-space:nowrap;text-shadow:0 1px 3px #000;text-transform:uppercase}
#vhPrompt b{display:inline-block;min-width:22px;padding:1px 7px;margin-right:8px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.45);text-align:center}
#vhPanel{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);width:380px;display:none;font-family:Bahnschrift,Rajdhani,'Arial Narrow',sans-serif;color:#e8edf5;text-shadow:0 1px 3px #000;padding:9px 14px 8px;background:linear-gradient(180deg,rgba(9,13,19,.55),rgba(9,13,19,.82));border-top:2px solid var(--acc,#ff8a1f)}
#vhPanel .top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px}
#vhPanel .nm{font-size:17px;font-weight:800;letter-spacing:4px}#vhPanel .nm .hsi,#vhPrompt .hsi{width:20px;height:20px;vertical-align:-4px;margin-right:6px}
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
/* 12.188 nişan (Battlefield 3 / 4 referansı): tank sürücüsünde TEK ana artı ekran ortasında (mermi artının gösterdiği noktaya düşer: top balistik
   olarak oraya hedeflenir) + çevresinde dolum halkası + menzil; kule / top henüz yetişmediyse küçük "namlu burada" işareti (hizalanınca kaybolur);
   V dürbün görünümünde nişancı dürbünü örtüsü. Helikopter pilotunda sabit burun artısı. Makineli koltuklarda piyade artısı + ısınma / yay durumu. */
#vhAim{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;pointer-events:none;display:none}
#vhAim svg{width:64px;height:64px;overflow:visible;filter:drop-shadow(0 0 1.5px #000)}
#vhAim .rg{fill:none;stroke:rgba(255,255,255,.9);stroke-width:1.6}
#vhAim .rl{fill:none;stroke:#ffb04a;stroke-width:2.6;stroke-linecap:round;transform:rotate(-90deg);transform-origin:32px 32px}
#vhAim.ld .rl{stroke:rgba(210,210,210,.75)}#vhAim.ld .rg{stroke:rgba(255,255,255,.5)}
#vhAim.foe .rg{stroke:#ff5a3a}
#vhAim .rn{position:absolute;left:70px;top:25px;font:700 11px Bahnschrift,Rajdhani,sans-serif;letter-spacing:1px;color:#e8edf5;text-shadow:0 1px 2px #000;white-space:nowrap}
#vhGun{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px solid rgba(255,176,74,.95);border-radius:50%;pointer-events:none;display:none;box-shadow:0 0 3px #000}
#vhGun::after{content:'';position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;background:#ffb04a;border-radius:50%}
#vhNose{position:absolute;width:36px;height:36px;margin:-18px 0 0 -18px;pointer-events:none;display:none}
#vhNose svg{width:36px;height:36px;overflow:visible;filter:drop-shadow(0 0 1.5px #000)}#vhNose path,#vhNose circle{fill:none;stroke:rgba(140,255,170,.95);stroke-width:1.6}
#vhNose.hot path,#vhNose.hot circle{stroke:#ff6a4a}
#vhNose.clp path,#vhNose.clp circle{stroke:rgba(140,255,170,.5)}
/* 12.201 roket düşüş işareti (burnun yönü + roket yayı; burun artısından ayrıysa) */
#vhRk{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none;display:none}
#vhRk svg{width:22px;height:22px;overflow:visible;filter:drop-shadow(0 0 1.5px #000)}#vhRk path{fill:none;stroke:rgba(255,200,120,.95);stroke-width:1.6}
#vhRk.ld path{stroke:rgba(200,200,200,.55)}
/* 12.206 roket seçiliyken: roket artısı (köşeli; roketler buraya yakınsar) + altında kalan roket / dolum; burun konisi sınırında soluk */
#vhRk.sel{width:34px;height:34px;margin:-17px 0 0 -17px}#vhRk.sel svg{width:34px;height:34px}#vhRk.sel path{stroke-width:2;stroke:#ffb04a}
#vhRk.sel.clp path{stroke:rgba(255,176,74,.5)}#vhRk.sel.ld path{stroke:rgba(200,200,200,.6)}
#vhRk i{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:3px;font:700 11px Bahnschrift,Rajdhani,sans-serif;letter-spacing:1px;color:#ffd9a8;text-shadow:0 1px 2px #000;white-space:nowrap;font-style:normal;display:none}
#vhRk.sel i{display:block}#vhRk.ld i{color:#cfd4da}
#vhRk::after{content:'';position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;background:#ffb04a;border-radius:50%;display:none}#vhRk.sel::after{display:block}
#vhPanel .wsel{display:none;gap:6px;margin-bottom:6px}#vhPanel .wsel b{flex:1;padding:3px 6px;font-size:11px;letter-spacing:1.5px;font-weight:700;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);opacity:.6;white-space:nowrap}
#vhPanel .wsel b.on{opacity:1;border-color:#ff8a1f;background:rgba(255,138,31,.22)}#vhPanel .wsel b small{float:right;opacity:.7;font-size:10px}
#vhSight{position:absolute;inset:0;pointer-events:none;display:none;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 30vh,rgba(4,6,8,.9) 31vh,rgba(4,6,8,.96) 100%)}
#vhSight i{position:absolute;background:rgba(20,24,20,.85)}
#vhSight .h{left:calc(50% - 30vh);width:calc(30vh - 44px);top:50%;height:2px;margin-top:-1px}#vhSight .h2{left:calc(50% + 44px);width:calc(30vh - 44px);top:50%;height:2px;margin-top:-1px}
#vhSight .v{left:50%;width:2px;margin-left:-1px;top:calc(50% + 44px);height:calc(30vh - 44px)}
#vhSight b{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(50% - 30vh + 10px);font:700 11px Bahnschrift,Rajdhani,sans-serif;letter-spacing:2px;color:#cfe8c8;text-shadow:0 1px 2px #000}
#vhState{position:absolute;left:50%;top:calc(50% + 26px);transform:translateX(-50%);font:700 11px Bahnschrift,Rajdhani,sans-serif;letter-spacing:3px;color:#cfd4da;pointer-events:none;text-shadow:0 1px 2px #000;display:none}
#vhState.hot{color:#ff6a4a}
#vhPanel .gun i b.hot{background:#ff5a3a}
#vhArm{position:absolute;left:50%;top:calc(50% + 22px);transform:translateX(-50%);font:700 11px Bahnschrift,Rajdhani,sans-serif;letter-spacing:3px;color:#cfd4da;opacity:0;pointer-events:none;text-shadow:0 1px 2px #000}
#vhTgt{position:absolute;left:50%;top:calc(50% + 46px);transform:translateX(-50%);min-width:190px;padding:5px 9px 6px;background:rgba(10,14,18,.62);border:1px solid rgba(255,176,74,.55);border-radius:3px;font:700 12px Bahnschrift,Rajdhani,sans-serif;letter-spacing:1px;color:#f1e6d2;text-shadow:0 1px 2px #000;pointer-events:none;opacity:0;text-align:center}
#vhTgt .bar{height:6px;margin-top:4px;background:rgba(255,255,255,.14);position:relative}#vhTgt .bar i{position:absolute;left:0;top:0;bottom:0;background:#ff7a3a}
#vhTgt .z{color:#ffb04a}#vhTgt .z.w{color:#ff4a2a}#vhTgt small{display:block;font-weight:600;font-size:10px;color:#cfd6dd;margin-top:3px}
#vhHit{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #ffb04a;transform:rotate(45deg) scale(.6);opacity:0;pointer-events:none}
body.mob #vhPanel{zoom:.6;bottom:auto;top:calc(74px / .6);left:50%}
body.mob #vhPanel .hint{display:none}body.mob #vhPanel .wsel small{display:none}
body.mob #vhPrompt{zoom:.75}
#vhPrompt.off{color:#c3c9d0;border-left-color:#8a929b;background:rgba(9,13,19,.6)}
`;

export class VehicleHud {
  constructor(game) {
    this.g = game;
    if (!document.getElementById('vhCss')) { const st = document.createElement('style'); st.id = 'vhCss'; st.textContent = CSS; document.head.appendChild(st); }
    const root = game.hud.root;
    this.pr = document.createElement('div'); this.pr.id = 'vhPrompt';
    this.p = document.createElement('div'); this.p.id = 'vhPanel';
    this.p.innerHTML = `<div class="top"><span class="nm"></span><span class="spd"></span></div><div class="hp"><i></i></div><div class="wsel"><b></b><b></b></div><div class="gun"><span></span><i><b></b></i></div><div class="seats">${[0, 1, 2, 3].map(() => '<div></div>').join('')}</div><div class="hint"></div><div class="warn"></div>`;
    this.hit = document.createElement('div'); this.hit.id = 'vhHit';
    this.gunEl = document.createElement('div'); this.gunEl.id = 'vhGun';
    this.aim = document.createElement('div'); this.aim.id = 'vhAim';
    this.aim.innerHTML = '<svg viewBox="0 0 64 64"><circle class="rg" cx="32" cy="32" r="17" stroke-dasharray="20.7 6"/><circle class="rl" cx="32" cy="32" r="22" stroke-dasharray="138.2" stroke-dashoffset="0"/><circle cx="32" cy="32" r="1.6" fill="#fff"/><path class="rg" d="M32 4v8M32 52v8M4 32h8M52 32h8"/></svg><span class="rn"></span>';
    this.nose = document.createElement('div'); this.nose.id = 'vhNose';
    this.nose.innerHTML = '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="2"/><path d="M2 18h9M25 18h9M18 25v9M8 8l4 4M28 8l-4 4"/></svg>';
    this.rkEl = document.createElement('div'); this.rkEl.id = 'vhRk';
    this.rkEl.innerHTML = '<svg viewBox="0 0 22 22"><path d="M2 7V2h5M15 2h5v5M20 15v5h-5M7 20H2v-5"/></svg><i></i>';
    this.sight = document.createElement('div'); this.sight.id = 'vhSight'; this.sight.innerHTML = '<i class="h"></i><i class="h2"></i><i class="v"></i><b></b>';
    this.state = document.createElement('div'); this.state.id = 'vhState';
    this.arm = document.createElement('div'); this.arm.id = 'vhArm'; this.arm.textContent = t('veh.armor');
    this.tgt = document.createElement('div'); this.tgt.id = 'vhTgt';                // 12.208 vurduğun aracın can çubuğu + isabet bölgesi + kalan isabet tahmini
    root.append(this.sight, this.pr, this.p, this.hit, this.gunEl, this.aim, this.nose, this.rkEl, this.state, this.arm, this.tgt);
    this.q = { nm: this.p.querySelector('.nm'), spd: this.p.querySelector('.spd'), hp: this.p.querySelector('.hp i'), seats: [...this.p.querySelectorAll('.seats div')], hint: this.p.querySelector('.hint'), warn: this.p.querySelector('.warn'), gun: this.p.querySelector('.gun'), gunT: this.p.querySelector('.gun span'), gunB: this.p.querySelector('.gun i b'), wsel: this.p.querySelector('.wsel'), ws: [...this.p.querySelectorAll('.wsel b')] };
    this._k = {};
    game.on('vehhit', (e) => this.onHit(e));
  }

  key(id) { const c = this.g.binds.codes(id)[0]; return c ? codeLabel(c) : '?'; }

  set(el, k, v, prop = 'textContent', dash) { if (this._k[k] !== v) { this._k[k] = v; if (dash) el.style.strokeDashoffset = v; else el[prop] = v; } }

  update() {
    const g = this.g, me = g.playerSoldier, V = g.vehicles;
    if (!V || !me) return;
    const v = me.alive ? me.veh : null;
    // binme ipucu
    const n = !v && me.alive && !g.ended ? V.near(me) : null;
    // 12.216 binilemeyen sabit yuva (dolu / yeniden kuruluyor) ya da ikmal kutusu: ipucu + neden (tuşsuz = kullanılamaz)
    const nb = !n && !v && me.alive && !g.ended ? V.fixedBlocked(me) : null, cr = !n && !nb && !v && me.alive && !g.ended ? nearCrate(g, me) : null;
    const k = g.player?.touch ? '⟲' : this.key('vehicle');
    const ca = cr ? crateAction(g, me, cr) : null, off = !!nb || ca?.act === 'enemy' || ca?.act === 'full';
    this.set(this.pr.style, 'prd', n || nb || cr ? 'block' : 'none', 'display');
    if (this._off !== off) { this._off = off; this.pr.classList.toggle('off', off); }
    if (nb) this.set(this.pr, 'prt', `${t('veh.' + nb.v.type)} — ${nb.why === 'down' ? (Number.isFinite(nb.eta) ? t('veh.rebuild', { n: Math.ceil(nb.eta) }) : t('veh.rebuildN')) : t(nb.why === 'foe' ? 'veh.busyFoe' : 'veh.busy')}`, 'innerHTML');
    else if (cr) this.set(this.pr, 'prt', (off ? '' : `<b>${k}</b> `) + `${t('sup.name')} — ${crateLabel(ca)}`, 'innerHTML');
    if (n) this.set(this.pr, 'prt',t('veh.prompt', { k: g.player?.touch ? '⟲' : this.key('vehicle'), n: (n.v.def.moto ? MOTO_ICON : '') + t('veh.' + n.v.type), s: (n.evict ? t(n.v.yieldReq?.s === me ? 'veh.yieldWait' : 'veh.evict') + ' · ' : '') + (n.seat === 0 ? t(n.v.def.fixed ? 'veh.use' : 'veh.drive') : t('veh.ride') + ' (' + t(n.v.def.seatKey?.[n.seat] || 'veh.seat.' + n.seat).toLowerCase() + ')') }), 'innerHTML');      // 12.206 sürücü / yolcu bot: "botu indir · sür"
    this.set(this.p.style, 'pd', v ? 'block' : 'none', 'display');
    this.aimHud(v && v.st ? v : null, me);
    const am = (this._am ||= this.g.hud.root.querySelector('#ammo')), hideAm = !!(v && (me.seat === 0 || mgAt(v.def, me.seat)));      // sürücü / makineli: kendi silahının cephanesi anlamsız
    if (am) this.set(am.style, 'amv', hideAm ? 'hidden' : '', 'visibility');
    if (!v || !v.st) return;
    const d = v.def, hp = Math.max(0, v.hp / d.hp);
    const god = V.godVeh(v);                                                 // 12.207 geliştirici ölümsüzlüğü (O): araç da ölümsüz
    this.set(this.q.nm, 'nm', (d.moto ? MOTO_ICON : '') + t('veh.' + v.type) + (god ? ` <small style="color:#7fc8ff;font-size:11px;letter-spacing:2px">· ${t('veh.god')}</small>` : ''), 'innerHTML');
    const spd = Math.round(Math.hypot(v.st.vx, v.st.vz) * 3.6);
    this.set(this.q.spd, 'spd', me.seat === 0 && !d.fixed ? `${spd}<small>${t('veh.kmh')}</small>` : '', 'innerHTML');
    this.set(this.q.hp.style, 'hpw', Math.round(hp * 100) + '%', 'width');
    this.set(this.q.hp.style, 'hpc', god ? '#7fc8ff' : hp > 0.5 ? '#7fd36a' : hp > d.burnAt ? '#ffc94a' : '#ff5a3a', 'background');
    this.q.seats.forEach((el, i) => this.set(el.style, 'sd' + i, i < v.seats.length ? '' : 'none', 'display'));
    const c = d.cannon, gunner = !!mgAt(d, me.seat), G = seatGun(d, me.seat);
    this.set(this.q.gun.style, 'gd', (c || d.atgm) && me.seat === 0 || G ? 'block' : 'none', 'display');
    let hot = false;
    if (d.atgm && me.seat === 0) { this.set(this.q.gunT, 'gt', v.rl > 0 ? t('veh.atLoad', { n: v.rl.toFixed(1) }) : t('veh.atReady')); this.set(this.q.gunB.style, 'gw', Math.round((1 - v.rl / d.atgm.reload) * 100) + '%', 'width'); this.set(this.q.gunB.style, 'gbg', v.rl > 0 ? '#9aa3ad' : '', 'background'); }      // 12.213 tanksavar dolumu
    else if (c && me.seat === 0) { this.set(this.q.gunT, 'gt', v.rl > 0 ? t('veh.reload', { n: v.rl.toFixed(1) }) : t('veh.ready')); this.set(this.q.gunB.style, 'gw', Math.round((1 - v.rl / c.reload) * 100) + '%', 'width'); }
    else if (G && d.rockets && me.seat === 0) {                           // 12.206 pilot: seçili silah (burun topu / roket kapsülü) + roket sayısı / dolum
      const R = d.rockets, n = v.rk ?? R.n, ld = (v.rkR || 0) > 0, rkSel = me.vw === 1;
      hot = !rkSel && !!me.vhot;
      const rkTxt = ld ? t('veh.rkLoad', { n: v.rkR.toFixed(1) }) : me.infAmmo ? t('veh.rkN', { n, m: '∞' }) : t('veh.rkN', { n, m: R.n });      // 12.207 geliştirici: kapsül bitmez
      this.set(this.q.ws[0], 'ws0', `${t('veh.nose')}${me.vhot ? ' · ' + t('veh.hot') : ''}<small>${this.key('vehAlt')}</small>`, 'innerHTML');
      this.set(this.q.ws[1], 'ws1', `${rkTxt}<small>${this.key('vehAlt')}</small>`, 'innerHTML');
      this.set(this.q.ws[0], 'wc0', rkSel ? '' : 'on', 'className'); this.set(this.q.ws[1], 'wc1', rkSel ? 'on' : '', 'className');
      this.set(this.q.gunT, 'gt', rkSel ? rkTxt : hot ? t('veh.hot') : t('veh.nose'));
      this.set(this.q.gunB.style, 'gw', Math.round((rkSel ? (ld ? 1 - v.rkR / R.reload : n / R.n) : (me.vheat || 0)) * 100) + '%', 'width');
      this.set(this.q.gunB.style, 'gbg', rkSel ? (ld ? '#9aa3ad' : '#ffb04a') : '', 'background');
    }
    else if (G) {                                                         // 12.188 makineli / burun topu: ısınma çubuğu
      hot = !!me.vhot;
      this.set(this.q.gunT, 'gt', hot ? t('veh.hot') : t(me.seat === 0 && !d.fixed ? 'veh.nose' : 'veh.mg'));
      this.set(this.q.gunB.style, 'gw', Math.round((me.vheat || 0) * 100) + '%', 'width');
      this.set(this.q.gunB.style, 'gbg', '', 'background');
    }
    this.set(this.q.wsel.style, 'wsd', G && d.rockets && me.seat === 0 ? 'flex' : 'none', 'display');
    this.set(this.q.gunB, 'gbc', hot ? 'hot' : '', 'className');
    if (d.heli && !(me.seat === 0 && G)) {                                                         // 12.179 helikopter: rotor devri + irtifa (zeminden)
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
    const hk = d.fixed ? 'veh.hint.' + v.type : d.moto ? (me.seat === 0 ? 'veh.hint.moto' : 'veh.hint.motoPas') : d.heli ? (me.seat === 0 ? 'veh.hint.heli' : gunner ? 'veh.hint.gunner' : 'veh.hint.pas') : c ? (me.seat === 0 ? 'veh.hint.tank' : 'veh.hint.gunner') : me.seat === 0 ? 'veh.hint.drv' : gunner ? 'veh.hint.gunner' : 'veh.hint.pas';
    this.set(this.q.hint, 'hint', t(hk, { f: this.key('flashlight'), v: this.key('vehCam'), e: this.key('vehicle'), q: this.key('vehAlt'), r: this.key('reload'), n: v.seats.length }), 'innerHTML');
    const w = v.burn ? t('veh.burn') : v.st.sunk ? t('veh.sunk') : v.st.stall ? t('veh.stall') : v.st.fallK && v.st.fall > 0 ? t('veh.fall') : d.heli && me.seat === 0 && (v.st.rpm || 0) < 0.85 ? t('veh.rotor') : '';
    this.set(this.q.warn, 'w', w); this.set(this.q.warn.style, 'wd', w ? 'block' : 'none', 'display');
  }

  // 12.178 top nişangâhı: merminin düşeceği nokta (namlu ucundan aynı yerçekimiyle yay; dünya / araç / 4 sn) ekrana izdüşürülür; dolumda gri
  // 12.188 koltuğa göre TEK nişan: tank sürücüsü → ortada ana artı (+ dolum halkası, menzil; kule / top yetişmediyse "namlu burada" işareti = gerçek
  // isabet noktası, Vehicles.predictShell; V dürbünde dürbün örtüsü) · helikopter pilotu → burun topunun sabit artısı (burnun gösterdiği nokta) ·
  // makineli koltukları → piyade artısı (hud.js) + yay dışı / aşırı ısınma yazısı (artı soluklaşır) · jip / helikopter sürücüsü silahsız → artı yok.
  aimHud(v, me) {
    const g = this.g, P = g.player, seat = v ? me.seat : -1, d = v?.def;
    const tank = !!(v && seat === 0 && d.cannon), G = v ? seatGun(d, seat) : null, pilot = !!(G && G.fixed);
    this.set(this.aim.style, 'aimd', tank ? 'block' : 'none', 'display');
    this.set(this.sight.style, 'sgd', tank && P?._vcam === 'first' ? 'block' : 'none', 'display');
    const rkSel = pilot && !!d.rockets && me.vw === 1;                  // 12.206 roket seçili: roket artısı ana artı, burun artısı gizli
    this.set(this.nose.style, 'nsd', pilot && !rkSel ? 'block' : 'none', 'display');
    const stt = v && G && !pilot ? g.vehicles.gunState(me) : (pilot && me.vhot ? 'hot' : '');
    this.set(this.state.style, 'std', stt ? 'block' : 'none', 'display');
    if (stt) { this.set(this.state, 'stt', t(stt === 'hot' ? 'veh.hot' : 'veh.arc')); this.set(this.state, 'stc', stt, 'className'); }
    const cr = (this._cr ||= g.hud.root.querySelector('#cross'));
    if (cr) this.set(cr.style, 'cro', stt ? '0.3' : '', 'opacity');
    if (!tank && !(G && !pilot)) { this.set(this.gunEl.style, 'gvd', 'none', 'display'); }
    if (!pilot) this.set(this.rkEl.style, 'rkd', 'none', 'display');
    if (G && !pilot) {                                                  // 12.201 makineli: bakış yükseliş sınırını aşınca mermi artıya gitmez → gerçek isabet noktası (turuncu halka)
      const pt = mgPitch(v.st, G, me.yaw, me.pitch);
      let show = false;
      if (Math.abs(pt - me.pitch) > 0.01) {
        const o = me.eye(), dd = dirFromAngles(me.yaw, pt, (this._md ||= new THREE.Vector3())), h = g.world.raycast(o, dd, 300, (this._mh ||= {})), L = h ? h.t : 200;
        show = this.place(this.gunEl, o.x + dd.x * L, o.y + dd.y * L, o.z + dd.z * L);
      }
      this.set(this.gunEl.style, 'gvd', show ? 'block' : 'none', 'display');
    }
    if (tank) {
      const c = d.cannon, k = 1 - v.rl / c.reload;
      this.set(this.aim, 'acl', (v.rl > 0 ? 'ld' : '') + (me.gunAim && me.gunAim.hit && this.foeAt(me.gunAim.P) ? ' foe' : ''), 'className');
      const rl = (this._rl ||= this.aim.querySelector('.rl'));
      this.set(rl, 'rlo', (138.2 * (1 - Math.max(0, Math.min(1, k)))).toFixed(1), 'style', true);
      this.set(this.aim.querySelector('.rn'), 'rn', me.gunAim ? (me.gunAim.hit ? Math.round(me.gunAim.dist) + ' m' : '—') : '');
      this.set(this.sight.querySelector('b'), 'sgz', me.ads ? '×2.6' : '×1.15');
      // gerçek isabet noktası (aynı fizik): ortadan 9 px'ten fazla ayrıysa (kule döner / top sınırda / araç hızla gidiyor) küçük işaret
      const r = g.vehicles.predictShell(v, me, (this._pr ||= {}));
      let show = false;
      if (r) {
        const q = (this._pp ||= new THREE.Vector3()).set(r.p.x, r.p.y, r.p.z).project(g.camera), x = (q.x + 1) / 2 * innerWidth, y = (1 - q.y) / 2 * innerHeight;
        show = q.z < 1 && Math.abs(q.x) < 1.1 && Math.abs(q.y) < 1.1 && Math.hypot(x - innerWidth / 2, y - innerHeight / 2) > 9;
        if (show) { this.gunEl.style.left = x.toFixed(1) + 'px'; this.gunEl.style.top = y.toFixed(1) + 'px'; }
      }
      this.set(this.gunEl.style, 'gvd', show ? 'block' : 'none', 'display');
    }
    if (pilot) {                                                        // 12.201 burun artısı = burun topunun gerçek yönü (noseDir: artının noktası, koni sınırında kırpılır)
      const st = v.st, o = toWorld(st, G.f, 0, G.u, (this._no ||= {})), nd = noseDir(st, G, me.gunAim, (this._ndd ||= {})), dd = dirFromAngles(nd.y, nd.p, (this._nd ||= new THREE.Vector3()));
      const h = g.world.raycast(o, dd, 400, (this._nh ||= {})), L = h ? h.t : 300;
      const nOn = this.place(this.nose, o.x + dd.x * L, o.y + dd.y * L, o.z + dd.z * L);
      this.set(this.nose.style, 'nsd', nOn && !rkSel ? 'block' : 'none', 'display');
      this.set(this.nose, 'ncl', me.vhot ? 'hot' : nd.c ? 'clp' : '', 'className');
      // 12.206 roket: artının noktasına yakınsar (rocketAimFor) → roket seçiliyken köşeli roket artısı gerçek düşüş noktasında (artıda; burun konisi
      // sınırında soluk) + altında kalan / dolum. Burun topu seçiliyken roket işareti yalnız burun artısından ayrıysa (koni sınırı) küçük gösterilir.
      const r = d.rockets ? g.vehicles.predictRocket(v, me, (this._rp ||= {})) : null;
      let rs = false;
      if (r) { rs = this.place(this.rkEl, r.p.x, r.p.y, r.p.z) && (rkSel || (nOn && Math.hypot(parseFloat(this.rkEl.style.left) - parseFloat(this.nose.style.left), parseFloat(this.rkEl.style.top) - parseFloat(this.nose.style.top)) > 12)); }
      else if (rkSel) { rs = true; this.rkEl.style.left = innerWidth / 2 + 'px'; this.rkEl.style.top = innerHeight / 2 + 'px'; }      // havaya: artıda
      this.set(this.rkEl.style, 'rkd', rs ? 'block' : 'none', 'display');
      const ld = (v.rkR || 0) > 0;
      this.set(this.rkEl, 'rkc', (rkSel ? 'sel' : '') + (ld ? ' ld' : '') + (rkSel && r?.c ? ' clp' : ''), 'className');
      if (rkSel) this.set((this._rki ||= this.rkEl.querySelector('i')), 'rki', ld ? t('veh.rkLoadS', { n: v.rkR.toFixed(1) }) : String(v.rk ?? d.rockets.n));
    }
  }
  // dünya noktasını ekrana koy (görünürse true)
  place(el, x, y, z) {
    const q = (this._pq ||= new THREE.Vector3()).set(x, y, z).project(this.g.camera);
    const on = q.z < 1 && Math.abs(q.x) < 1.1 && Math.abs(q.y) < 1.1;
    if (on) { el.style.left = ((q.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; el.style.top = ((1 - q.y) / 2 * innerHeight).toFixed(1) + 'px'; }
    return on;
  }
  foeAt(P) { const me = this.g.playerSoldier; for (const e of this.g.soldiers) if (e.alive && e.team !== me.team && Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 0.8 && P.y > e.pos.y - 0.2 && P.y < e.pos.y + e.height + 0.3) return true; return false; }

  onHit(e) {
    if (e.armor || e.dmg === 0) {                                     // zırh: mermi seker (hasar yok)
      this.arm.getAnimations?.().forEach((a) => a.cancel());
      this.arm.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' });
      this.g.sfx._tone?.({ gain: 0.08, dur: 0.1, f0: 2600, f1: 3400, type: 'triangle', att: 0.001 });
      return;
    }
    this.target(e);
    this.hit.getAnimations?.().forEach((a) => a.cancel());
    this.hit.animate([{ opacity: 1, transform: 'rotate(45deg) scale(1.1)' }, { opacity: 0, transform: 'rotate(45deg) scale(.7)' }], { duration: 220, easing: 'ease-out' });
    this.g.sfx._tone?.({ gain: 0.12, dur: 0.07, f0: 1700, f1: 1300, type: 'triangle', att: 0.001 });
  }

  // 12.208 hedef araç paneli: ad · can % + çubuk · bölge (ÖN / YAN / ARKA ×2 / ÜST ×2 zayıf nokta / ALT) · "≈n isabet daha" (bu isabetin hasarıyla)
  target(e) {
    const v = e.v; if (!v?.def) return;
    const me = this.g.playerSoldier; if (me && me.veh === v) return;
    const hp = e.hp != null ? e.hp : Math.max(0, v.hp) / v.def.hp, rem = hp * v.def.hp;
    const Z = { f: ['ÖN ZIRH', ''], s: ['YAN', ''], r: ['ARKA · ZAYIF NOKTA ×2', 'w'], t: ['ÜST · ZAYIF NOKTA ×2', 'w'], b: ['ALT (MAYIN)', 'w'] }[e.zone] || null;
    const n = e.dmg > 0 && rem > 0 ? Math.ceil(rem / e.dmg) : 0;
    this.tgt.innerHTML = `${t('veh.' + v.type)} · ${Math.round(hp * 100)}%${Z ? ` · <span class="z ${Z[1]}">${Z[0]}</span>` : ''}<div class="bar"><i style="width:${Math.round(hp * 100)}%"></i></div><small>${e.dead || rem <= 0 ? 'İMHA EDİLDİ' : `−${Math.round(e.dmg)} · ≈${n} isabet daha`}</small>`;
    this.tgt.getAnimations?.().forEach((a) => a.cancel());
    this.tgt.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 3200, easing: 'linear' });
  }

  dispose() { for (const e of [this.tgt, this.pr, this.p, this.hit, this.gunEl, this.aim, this.nose, this.rkEl, this.sight, this.state, this.arm]) e.remove(); }
}
