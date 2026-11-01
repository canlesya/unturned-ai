// 12.223 Uyku Modu arayüzü (hud.js'e dokunmadan, kendi modülü; çevrimdışı oyun + çevrim içi istemci aynı):
// · üst çubuk: skor kutuları = kazanılan raunt (hud.js), altında iki takımın 5'er askerlik durum noktaları (ayakta / uyuyor + kanama dilimi / elendi) + "RAUNT 2/5 · İLK 3"
// · ortada afiş: raunt başı (hazırlık, maç raundu, taraf değişti), BAŞLA!, raunt sonu (aldınız / kaybettiniz / berabere + neden)
// · hazırlıkta sınıf şeridi (1–5), uyurken ekran kararır + kanama halkası, uyuyan arkadaşın yanında "Sağ tık basılı tut: Kaldır" + ilerleme halkası
// · dünyada ve mini haritada uyuyan takım arkadaşları (kalan kanama süresiyle), akışta "uyuttu / kaldırdı / bitirdi / uyanamadı", elenince izleme çubuğu
import * as THREE from 'three';
import { t } from '../i18n/index.js';
import { className } from '../i18n/data.js';
import { dispName, wLabel } from '../i18n/game.js';
import { LIMITS } from './balance.js';
import { CLASS_DEFS } from './stats.js';

const CSS = `
#uypips{display:flex;align-items:center;gap:10px;margin-top:-2px;padding:3px 10px;background:rgba(9,13,19,.62);border:1px solid rgba(255,255,255,.1);font-weight:800;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
#uypips .tm{display:flex;gap:4px}#uypips .tm.red{flex-direction:row-reverse}
#uypips .p{position:relative;width:15px;height:15px;border-radius:50%;box-sizing:border-box;border:2px solid var(--c);background:var(--c)}
#uypips .blue .p{--c:#4aa3ff}#uypips .red .p{--c:#ff5a43}
#uypips .p.dn{background:conic-gradient(var(--c) var(--k,100%),rgba(0,0,0,.55) 0);border-color:#ffd36a;animation:uypulse 1s infinite}
#uypips .p.dn::after{content:'z';position:absolute;inset:0;font-size:9px;line-height:11px;text-align:center;color:#ffd36a;text-shadow:0 0 2px #000}
#uypips .p.out{background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.22)}
#uypips .p.out::after{content:'✕';position:absolute;inset:0;font-size:9px;line-height:11px;text-align:center;color:rgba(255,255,255,.55)}
#uypips .p.me{outline:2px solid #fff;outline-offset:1px}
#uypips .rd{min-width:118px;text-align:center;font-size:12px;letter-spacing:2px;line-height:1.1;white-space:nowrap}
#uypips .rd small{display:block;font-size:9px;letter-spacing:2px;opacity:.7;font-weight:700}
@keyframes uypulse{50%{box-shadow:0 0 8px #ffd36a}}
#uyban{position:absolute;left:50%;top:24%;transform:translate(-50%,0);text-align:center;font-weight:800;letter-spacing:5px;font-size:40px;text-shadow:0 3px 14px #000;opacity:0;transition:opacity .35s;pointer-events:none;white-space:nowrap}
#uyban small{display:block;font-size:15px;letter-spacing:2.5px;font-weight:700;opacity:.9;margin-top:6px}
#uyban em{display:inline-block;font-style:normal;font-size:13px;letter-spacing:3px;padding:3px 12px;margin-bottom:8px;background:rgba(255,211,106,.18);border:1px solid rgba(255,211,106,.6);color:#ffd36a}
#uyprep{position:absolute;left:50%;top:58%;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
#uyprep .h{font-size:13px;font-weight:800;letter-spacing:3px;color:#ffd36a;text-shadow:0 1px 4px #000}
#uyprep .row{display:flex;gap:6px}
#uyprep .c{padding:5px 11px;font-size:13px;font-weight:800;letter-spacing:1px;background:rgba(9,13,19,.75);border:1px solid rgba(255,255,255,.16);white-space:nowrap}
#uyprep .c b{color:#ffb347;margin-right:6px}#uyprep .c.on{border-color:#ffd36a;background:rgba(80,60,12,.82)}
#uydn{position:absolute;inset:0;display:none;pointer-events:none;background:radial-gradient(ellipse at center,rgba(20,24,44,.25) 0%,rgba(6,8,18,.82) 78%);-webkit-backdrop-filter:grayscale(.75) brightness(.72);backdrop-filter:grayscale(.75) brightness(.72)}
#uydn .bx{position:absolute;left:50%;top:56%;transform:translateX(-50%);text-align:center}
#uydn h2{margin:0;font-size:38px;letter-spacing:8px;font-weight:800;color:#cfd8ff;text-shadow:0 2px 12px #000}
#uydn p{margin:6px 0 0;font-size:14px;letter-spacing:1.5px;font-weight:700;opacity:.9;text-shadow:0 1px 4px #000}
#uydn p.rv{color:#9be07f}#uydn p.no{color:#ff9a88}
.uyring{position:relative;width:76px;height:76px;margin:10px auto 0}
.uyring svg{position:absolute;inset:0;transform:rotate(-90deg)}
.uyring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}
#uyrv{position:absolute;left:50%;top:60%;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:2px;pointer-events:none;text-shadow:0 1px 4px #000}
#uyrv .t{font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase}
#uyrv .t.no{color:#ff9a88}
#uyrv .uyring{width:54px;height:54px;margin:4px auto 0}#uyrv .uyring b{font-size:13px}
#uymk{position:absolute;inset:0;pointer-events:none}
#uymk .m{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:12px;letter-spacing:1px;text-shadow:0 1px 3px #000;white-space:nowrap}
#uymk .m i{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-style:normal;font-size:12px;color:#10141b;background:conic-gradient(#ffd36a var(--k,100%),rgba(60,50,20,.75) 0);border:2px solid #fff;box-shadow:0 0 8px rgba(255,211,106,.7)}
#uymk .m.rv i{background:conic-gradient(#7be06f var(--k,0%),rgba(20,50,20,.75) 0);box-shadow:0 0 10px rgba(123,224,111,.9)}
#uymk .m.lo i{animation:uypulse .5s infinite}
#uysp{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;padding:7px 22px;background:rgba(9,13,19,.78);border:1px solid rgba(255,255,255,.14);border-top:3px solid #ff7b6b;font-weight:800;letter-spacing:2px;text-align:center;pointer-events:none}
#uysp b{font-size:20px;color:#ff9a88;letter-spacing:5px}#uysp span{font-size:14px;margin-top:2px}#uysp small{font-size:11px;opacity:.7;letter-spacing:1.5px;margin-top:2px}
.kf .w.uy{color:#ffd36a;border-color:rgba(255,211,106,.4)}.kf .w.uv{color:#9be07f;border-color:rgba(155,224,127,.4)}.kf .w.uo{color:#ff9a88;border-color:rgba(255,154,136,.45)}
@media (max-height:520px){#uyban{font-size:26px}#uyban small{font-size:12px}#uydn h2{font-size:26px}#uypips .p{width:11px;height:11px}#uysp{bottom:80px}}
`;
const RING = (r, w) => { const C = 2 * Math.PI * r; return { C, svg: (col) => `<svg viewBox="0 0 ${2 * r + w} ${2 * r + w}"><circle cx="${r + w / 2}" cy="${r + w / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="${w}"/><circle class="fg" cx="${r + w / 2}" cy="${r + w / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0"/></svg>` }; };
const R1 = RING(34, 6), R2 = RING(23, 5);
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

export class UykuHud {
  constructor(g, U) {
    this.g = g; this.U = U;
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const root = g.hud.root, top = root.querySelector('#topbar');
    const mk = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; return d; };
    this.pips = mk('uypips'); top.insertBefore(this.pips, top.querySelector('#flags'));
    const lim = g.hud.$('lim'); if (lim) lim.style.display = 'none';                // raunt yazısı noktaların ortasında
    this.ban = mk('uyban'); this.prepEl = mk('uyprep'); this.mk = mk('uymk');
    this.dn = mk('uydn', `<div class="bx"><h2></h2><div class="uyring">${R1.svg('#ffd36a')}<b></b></div><p></p></div>`);
    this.rv = mk('uyrv', `<div class="t"></div><div class="uyring">${R2.svg('#7be06f')}<b></b></div>`);
    this.sp = mk('uysp', '<b></b><span></span><small></small>');
    root.prepend(this.dn);                                                          // HUD'un altında (sayılar / akış görünür kalır)
    root.append(this.mk, this.ban, this.prepEl, this.rv, this.sp);
    this.v = new THREE.Vector3(); this.marks = []; this.banT = 0; this._k = {};
    for (const ev of U.pend.splice(0)) this.onEvent(ev);
  }

  // ───── olaylar (uyku.js fx) ─────
  onEvent(ev) {
    const g = this.g, S = g.soldiers, me = g.playerSoldier, U = this.U;
    switch (ev.e) {
      case 'uyd': {
        const v = S[ev.v], k = S[ev.k] || null; if (!v) return;
        v.uyDownT = g.time;
        if (k) this.feed(k, `${esc(wLabel(ev.w))} · ${t('uy.kf.down')}`, v, 'uy'); else this.feed(v, t('uy.kf.downSelf'), null, 'uy');
        g.heat?.add(v.pos.x, v.pos.z, 3, g.time);
        if (k === me && v !== me) g.killfx.kill(v, ev.w, !!ev.hs, undefined, { pn: 0, pc: 0, lbl: t('uy.fx.down') });
        if (v === me) { g.killfx.died?.(); g.sfx.hurt?.(); }
        else if (v.team === me.team) g.hud.toast(t('uy.t.down', { n: dispName(v) }), '#ffd36a');
        return;
      }
      case 'uyv': {
        const v = S[ev.v], r = S[ev.by]; if (!v || !r) return;
        this.feed(r, `⤴ ${t('uy.kf.rev')}`, v, 'uv');
        if (v === me) { g.hud.toast(t('uy.t.rev', { n: dispName(r) }), '#9be07f'); g.hud.onPlayerSpawn?.(); }
        if (r === me) { g.hud.popup(t('uy.pop.rev')); g.hud.toast(t('uy.t.revd', { n: dispName(v) }), '#9be07f'); }
        g.effects.spark?.(v.pos.clone().setY(v.pos.y + 0.8), 8, new THREE.Vector3(0, 1, 0), '#9be07f');
        return;
      }
      case 'uyo': {
        const v = S[ev.v], k = S[ev.k] || null; if (!v) return;
        if (k && !ev.r) this.feed(k, `✖ ${t('uy.kf.fin')}`, v, 'uo'); else this.feed(v, `✖ ${t('uy.kf.bleed')}`, null, 'uo');
        if (k === me) g.hud.popup(t('uy.pop.fin'));
        if (v === me) { U.specId = -1; g.hud.toast(t('uy.out'), '#ff9a88'); }
        return;
      }
      case 'uyr': {
        const mp = Math.max(g.tickets.blue, g.tickets.red) === U.need - 1;
        const half = U.half && ev.n === U.half + 1;
        this.banner(`${half ? `<em>${t('uy.half')}</em><br>` : mp ? `<em>${t('uy.matchPoint')}</em><br>` : ''}${t('uy.roundN', { n: ev.n })}`, t('uy.score', { b: g.tickets.blue, r: g.tickets.red }), '#ffffff', 2.6);
        g.sfx.capture?.();
        return;
      }
      case 'uyg': this.banner(t('uy.go'), t('uy.goSub'), '#ffd36a', 1.6); return;
      case 'uye': {
        const w = [null, 'blue', 'red', 'draw'][ev.w] || 'draw', why = ['elim', 'both', 'count', 'hp', 'tie'][ev.y] || 'tie';
        if (ev.sc) { g.tickets.blue = ev.sc[0]; g.tickets.red = ev.sc[1]; }
        const draw = w === 'draw', win = !draw && w === me.team;
        const sub = why === 'elim' ? t(win ? 'uy.why.elimW' : 'uy.why.elimL') : why === 'both' ? t('uy.why.both') : why === 'count' ? t('uy.why.count', { b: ev.u[0], r: ev.u[1] }) : why === 'hp' ? t('uy.why.hp', { b: ev.h[0], r: ev.h[1] }) : t('uy.why.tie');
        this.banner(draw ? t('uy.draw') : win ? t('uy.win') : t('uy.lose'), `${sub}<br>${t('uy.score', { b: g.tickets.blue, r: g.tickets.red })}`, draw ? '#ffd36a' : win ? '#7be06f' : '#ff7b6b', LIMITS.uyPost);
        if (win && me.alive && !me.downed) g.hud.popup(t('uy.pop.round'));
        if (win) g.sfx.capture?.();
      }
    }
  }

  // akış satırı (killfeed ile aynı görünüm): a [metin] b
  feed(a, txt, b, cls) {
    const g = this.g, f = g.hud.$('killfeed'), me = g.playerSoldier;
    const c = (s) => (s.team === 'blue' ? 'b' : 'r');
    const d = document.createElement('div'); d.className = 'kf' + (a === me || b === me ? ' me' : '');
    d.innerHTML = `<span class="${c(a)}">${esc(dispName(a))}</span><span class="w ${cls}">${txt}</span>${b ? `<span class="${c(b)}">${esc(dispName(b))}</span>` : ''}`;
    f.appendChild(d);
    while (f.children.length > 6) f.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  banner(html, sub, col, dur) {
    this.ban.innerHTML = `${html}${sub ? `<small>${sub}</small>` : ''}`;
    this.ban.style.color = col; this.ban.style.opacity = 1; this.banT = dur;
  }

  // ───── her kare (Hud.update sonunda) ─────
  update(dt) {
    const g = this.g, U = this.U, me = g.playerSoldier;
    if (this.banT > 0 && (this.banT -= dt) <= 0) this.ban.style.opacity = 0;
    this.drawPips();
    this.drawPrep();
    this.drawDown(me);
    this.drawRevive(me);
    this.drawMarks(me);
    this.drawSpec(me);
    if (me.downed) { const c = g.hud.$('cross'); if (c) c.style.display = 'none'; }
  }

  setK(k, v) { if (this._k[k] === v) return false; this._k[k] = v; return true; }

  drawPips() {
    const g = this.g, U = this.U, me = g.playerSoldier;
    const one = (team) => g.soldiers.filter((s) => s.team === team && !s.vacant).map((s) => {
      const st = !s.alive ? 'out' : s.downed ? 'dn' : 'up';
      const k = st === 'dn' ? Math.round(Math.max(0, Math.min(1, (s.bleedT || 0) / LIMITS.uyBleed)) * 10) * 10 : 100;
      return [st, k, s === me];
    });
    const B = one('blue'), R = one('red');
    const key = JSON.stringify([B, R, U.round, U.rounds, U.phase, U.need]);
    if (!this.setK('pips', key)) return;
    const html = (L) => L.map(([st, k, m]) => `<i class="p ${st === 'up' ? '' : st}${m ? ' me' : ''}" style="--k:${k}%"></i>`).join('');
    this.pips.innerHTML = `<div class="tm blue">${html(B)}</div><div class="rd">${t('uy.round', { n: U.round, m: U.rounds })}<small>${U.phase === 'prep' ? t('uy.prep') : t('uy.first', { k: U.need })}</small></div><div class="tm red">${html(R)}</div>`;
  }

  drawPrep() {
    const g = this.g, U = this.U, me = g.playerSoldier, on = U.phase === 'prep' && me.alive;
    if (this.setK('prepOn', on)) this.prepEl.style.display = on ? 'flex' : 'none';
    if (!on) return;
    const keys = Object.keys(CLASS_DEFS).filter((k) => !CLASS_DEFS[k].zombie), cur = g.pendingClass || me.cls, s = Math.max(0, Math.ceil(U.t));
    if (!this.setK('prep', cur + '|' + s)) return;
    this.prepEl.innerHTML = `<div class="h">${t('uy.prep')} · ${s}</div><div class="row">${keys.map((k, i) => `<div class="c ${k === cur ? 'on' : ''}"><b>${i + 1}</b>${esc(className(k))}</div>`).join('')}</div><div class="h" style="color:#cfd8e6;font-size:11px">${t('uy.prepSub', { s })}</div>`;
  }

  drawDown(me) {
    const on = !!me.downed && !this.g.ended;
    if (this.setK('dnOn', on)) this.dn.style.display = on ? 'block' : 'none';
    if (!on) return;
    const bl = Math.max(0, me.bleedT || 0), rv = me.rvP > 0 && me.rvBy, no = (me.rvdN | 0) >= LIMITS.uyRevMax;
    const frac = rv ? Math.min(1, me.rvP / LIMITS.uyRevive) : bl / LIMITS.uyBleed;
    const fg = this.dn.querySelector('.fg');
    fg.setAttribute('stroke', rv ? '#7be06f' : bl < 6 ? '#ff7b6b' : '#ffd36a');
    fg.setAttribute('stroke-dashoffset', (R1.C * (1 - frac)).toFixed(1));
    if (this.setK('dn', [Math.ceil(bl), rv ? me.rvBy.id : -1, no].join('|'))) {
      this.dn.querySelector('h2').textContent = t('uy.downTitle');
      this.dn.querySelector('b').textContent = Math.ceil(bl);
      const p = this.dn.querySelector('p');
      p.className = rv ? 'rv' : no ? 'no' : '';
      p.textContent = rv ? t('uy.beingRev', { n: dispName(me.rvBy) }) : no ? t('uy.downNoRev') : t('uy.downSub');
    }
  }

  // yanında uyuyan arkadaş: istem + ilerleme (kendi kaldırmanın ilerlemesi sunucudan: arkadaşın rvP / rvBy)
  drawRevive(me) {
    const U = this.U, c = me.alive && !me.downed ? U.candidate(me) : null;
    const on = !!c && U.phase === 'live';
    if (this.setK('rvOn', on)) this.rv.style.display = on ? 'flex' : 'none';
    if (!on) return;
    const mine = c.rvBy === me && c.rvP > 0, noMe = (me.rvN | 0) >= LIMITS.uyRevMax, noHim = (c.rvdN | 0) >= LIMITS.uyRevMax;
    const frac = mine ? Math.min(1, c.rvP / LIMITS.uyRevive) : 0;
    this.rv.querySelector('.fg').setAttribute('stroke-dashoffset', (R2.C * (1 - frac)).toFixed(1));
    const txt = noHim ? t('uy.revNoHis', { n: dispName(c) }) : noMe ? t('uy.revNoMine') : mine ? t('uy.revIng', { n: dispName(c) }) : `${t('uy.revHold')} · ${dispName(c)}`;
    if (this.setK('rv', txt + '|' + (mine ? Math.ceil((LIMITS.uyRevive - c.rvP) * 10) : -1))) {
      const el = this.rv.querySelector('.t'); el.textContent = txt; el.className = 't' + (noMe || noHim ? ' no' : '');
      this.rv.querySelector('.uyring').style.display = noMe || noHim ? 'none' : '';
      this.rv.querySelector('b').textContent = mine ? Math.max(0, LIMITS.uyRevive - c.rvP).toFixed(1) : '';
    }
  }

  // uyuyan takım arkadaşlarının ekran işareti (kanama süresi + uzaklık; kaldırılıyorsa yeşil ilerleme). Kameranın arkasındaysa gizli
  drawMarks(me) {
    const g = this.g, cam = g.camera, W = innerWidth, H = innerHeight;
    let n = 0;
    for (const s of g.soldiers) {
      if (!s.downed || s === me || s.team !== me.team || !s.alive) continue;
      const v = this.v.set(s.pos.x, s.pos.y + 0.9, s.pos.z).project(cam);
      if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) continue;
      let m = this.marks[n];
      if (!m) { m = document.createElement('div'); m.className = 'm'; m.innerHTML = '<i>z</i><span></span>'; this.mk.appendChild(m); this.marks.push(m); m._k = ''; }
      n++;
      m.style.display = 'flex';
      m.style.left = ((v.x + 1) / 2 * W).toFixed(0) + 'px'; m.style.top = ((1 - v.y) / 2 * H).toFixed(0) + 'px';
      const rv = s.rvP > 0, bl = Math.max(0, s.bleedT || 0), d = Math.round(Math.hypot(s.pos.x - cam.position.x, s.pos.z - cam.position.z));
      const k = rv ? Math.round(Math.min(1, s.rvP / LIMITS.uyRevive) * 100) : Math.round(bl / LIMITS.uyBleed * 100);
      const key = `${rv ? 1 : 0}|${k}|${Math.ceil(bl)}|${d}|${s.name}`;
      if (m._k !== key) {
        m._k = key;
        m.className = 'm' + (rv ? ' rv' : bl < 6 ? ' lo' : '');
        m.style.setProperty('--k', k + '%');
        m.children[0].textContent = rv ? '⤴' : Math.ceil(bl);
        m.children[1].textContent = `${dispName(s)} · ${d} m`;
      }
    }
    for (let i = n; i < this.marks.length; i++) if (this.marks[i].style.display !== 'none') this.marks[i].style.display = 'none';
  }

  drawSpec(me) {
    const U = this.U, on = !me.alive && !this.g.ended && U.phase !== 'over';
    if (this.setK('spOn', on)) this.sp.style.display = on ? 'flex' : 'none';
    if (!on) return;
    const tg = U.specTarget();
    if (!this.setK('sp', tg ? tg.id + tg.name : -1)) return;
    this.sp.children[0].textContent = t('uy.out');
    this.sp.children[1].textContent = tg ? t('uy.spec', { n: dispName(tg) }) : t('uy.specNone');
    this.sp.children[2].textContent = tg ? t('uy.specKeys') : t('uy.outSub');
  }

  // mini harita (Hud.drawMinimap): uyuyan takım arkadaşı = sarı halka + kalan kanama yayı; kaldırılıyorsa yeşil
  drawMinimap(x, X, Y) {
    const g = this.g, me = g.playerSoldier;
    for (const s of g.soldiers) {
      if (!s.downed || !s.alive || s.team !== me.team) continue;
      const px = X(s.pos.x), py = Y(s.pos.z), rv = s.rvP > 0, f = rv ? Math.min(1, s.rvP / LIMITS.uyRevive) : Math.max(0, (s.bleedT || 0) / LIMITS.uyBleed);
      x.beginPath(); x.arc(px, py, 5.5, 0, 6.3); x.fillStyle = 'rgba(0,0,0,.55)'; x.fill();
      x.beginPath(); x.arc(px, py, 5.5, -Math.PI / 2, -Math.PI / 2 + f * 6.283); x.strokeStyle = rv ? '#7be06f' : '#ffd36a'; x.lineWidth = 2.4; x.stroke();
      x.fillStyle = rv ? '#7be06f' : '#ffd36a'; x.font = 'bold 8px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', px, py + 0.5);
    }
  }

  dispose() { this.st.remove(); this.pips.remove(); this.ban.remove(); this.prepEl.remove(); this.mk.remove(); this.dn.remove(); this.rv.remove(); this.sp.remove(); }
}
