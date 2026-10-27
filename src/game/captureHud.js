import * as THREE from 'three';
import { t } from '../i18n/index.js';
import '../i18n/capture.js';
import { placeName } from '../i18n/game.js';
import { clamp } from './util.js';

// 12.191 Ele geçirme geri bildirimi (Battlefield 4 Fetih gibi): oyuncu bir bayrak alanındayken üst ortada ALAN GÖSTERGESİ — harf + ad, ilerleme halkası / çubuğu
// (sahibin rengi önce boşalır = nötrleştirme, sonra ele geçirenin rengi dolar), "~N sn" tahmini (o anki hız), alandaki dost / düşman sayısı, hız çarpanı (×1–×3),
// durum adı (ELE GEÇİRİLİYOR / NÖTRLEŞTİRİLİYOR / ÇEKİŞMELİ / SAVUNULUYOR / … / ELE GEÇİRİLDİ! / BÖLGEDEN ÇIKTIN). Üst çubuktaki bayraklar ve mini harita da
// ilerlemeyi + alınan bayrağın nabzını gösterir; dünyada bayrak işaretleri (harf, halka, uzaklık). Bayrak değişince bildirim + öldürme akışı + kazanma / kaybetme sesi.
// Kural tek yerde: alanda mı = game.inObjective, hız = game.capRate (updateMode ile aynı). Sayılar çevrimdışında updateMode'dan, çevrimiçinde sunucunun snapshot'ından
// (o.nb / o.nr); gösterilen ilerleme (o.pd) yetkili değerden o anki hızla ileri kestirilip yumuşatılır (snapshot arası sıçrama yok).
const COL = { blue: '#4aa3ff', red: '#ff5a43' }, TXT = { blue: '#a9d4ff', red: '#ffbcae' }, NEU = '#e8ecf0', AMB = '#ffcf5a';
const PERSON = '<svg viewBox="0 0 12 14"><circle cx="6" cy="3.3" r="2.7" fill="currentColor"/><path d="M.8 13.6c0-3.6 2.3-5.8 5.2-5.8s5.2 2.2 5.2 5.8z" fill="currentColor"/></svg>';
const CSS = `
#capw{display:none;position:relative;width:390px;margin-top:2px;padding:7px 12px 8px 10px;gap:11px;align-items:center;background:linear-gradient(180deg,rgba(14,19,27,.9),rgba(9,13,19,.8));border:1px solid rgba(255,255,255,.12);border-left:3px solid var(--sc,#e8ecf0);box-shadow:0 4px 14px rgba(0,0,0,.45);text-shadow:0 1px 3px #000}
#capw.on{display:flex}
#capw .ic{position:relative;flex:none;width:46px;height:46px;border-radius:50%;border:3px solid var(--oc,#9aa0a8);background:radial-gradient(circle at 50% 35%,rgba(30,38,50,.95),rgba(9,13,19,.85));display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:800}
#capw .ic i{position:absolute;inset:-3px;border-radius:50%;-webkit-mask:radial-gradient(circle,transparent 57%,#000 59%);mask:radial-gradient(circle,transparent 57%,#000 59%)}
#capw .ic b{position:relative}
#capw .bd{flex:1;min-width:0}
#capw .l1{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
#capw .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,.75)}
#capw .eta{font-size:11px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,.62);text-transform:lowercase}
#capw .eta b{font-size:19px;font-weight:800;color:#fff;margin-left:5px;font-variant-numeric:tabular-nums;letter-spacing:.5px}
#capw .l2{display:flex;align-items:baseline;gap:8px;white-space:nowrap;margin-top:-1px}
#capw .st{font-size:17px;font-weight:800;letter-spacing:2px;color:var(--sc,#fff)}
#capw .sub{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,.66)}
#capw .l3{display:flex;align-items:center;gap:7px;margin-top:4px}
#capw .bar{position:relative;flex:1;height:8px;background:rgba(255,255,255,.12);transform:skewX(-18deg);overflow:hidden}
#capw .bar i{position:absolute;left:0;top:0;bottom:0;background:var(--pc,#fff);box-shadow:0 0 8px var(--pc,#fff)}
#capw .bar u{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.35)}
#capw .cnt{display:inline-flex;align-items:center;gap:3px;font-size:14px;font-weight:800;min-width:30px;font-variant-numeric:tabular-nums}
#capw .cnt svg{width:10px;height:12px}
#capw .cnt.e{justify-content:flex-end}
#capw .x{font-size:11px;font-weight:800;letter-spacing:1px;padding:1px 5px;border:1px solid rgba(255,255,255,.25);color:#fff;background:rgba(255,255,255,.08);white-space:nowrap}
#capw .x.mx{border-color:${AMB};color:${AMB}}
#capw.ctd{animation:capct .7s infinite alternate}
@keyframes capct{to{border-left-color:#fff3c4;box-shadow:0 0 14px rgba(255,207,90,.35)}}
#capw.flash{animation:capfl .45s ease-out 3}
@keyframes capfl{0%{box-shadow:0 0 0 3px var(--sc),0 0 26px var(--sc)}100%{box-shadow:0 4px 14px rgba(0,0,0,.45)}}
#capw.left{opacity:.82}
#topbar:has(#capw.on) ~ #toasts{top:222px}
.flag.cap{animation:fpul .8s infinite alternate}
@keyframes fpul{to{box-shadow:0 0 0 3px var(--cc),0 0 12px var(--cc)}}
.flag.ctd{animation:fctd .5s infinite alternate}
@keyframes fctd{to{box-shadow:0 0 0 3px ${AMB},0 0 10px ${AMB}}}
.flag.here{transform:scale(1.14);margin:0 2px}
.flag.here::after{content:'';position:absolute;left:6px;right:6px;bottom:-8px;height:3px;background:var(--acc,#ff8a1f)}
#capmk{position:absolute;inset:0;pointer-events:none}
#capmk .cm{position:absolute;display:none;transform:translate(-50%,-100%);flex-direction:column;align-items:center;font-weight:800;font-size:11px;letter-spacing:1px;text-shadow:0 1px 3px #000;white-space:nowrap;color:#e8ecf0}
#capmk .cm b{position:relative;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:2px solid var(--oc,#9aa0a8);background:rgba(9,13,19,.62);font-size:13px}
#capmk .cm b i{position:absolute;inset:-2px;border-radius:50%;-webkit-mask:radial-gradient(circle,transparent 56%,#000 58%);mask:radial-gradient(circle,transparent 56%,#000 58%)}
#capmk .cm b span{position:relative}
#capmk .cm.cap b{animation:fpul .8s infinite alternate}
#capmk .cm.ctd b{animation:fctd .5s infinite alternate}
body.mob #capw{zoom:1.15;width:282px;padding:5px 9px 6px 8px;gap:8px}
body.mob #capw .ic{width:38px;height:38px;font-size:18px}
body.mob #capw .st{font-size:15px;letter-spacing:1.5px}
body.mob #capw .sub{font-size:10px;letter-spacing:.5px}
body.mob #capw .nm{font-size:11px;letter-spacing:1.5px}
body.mob #capw .eta{font-size:10px}
body.mob #topbar:has(#capw.on) ~ #toasts{top:calc(142px / .7)}
body.mob #topbar:has(#capw.on) ~ #toasts .toast{white-space:normal;max-width:300px;text-align:center;font-size:15px}      /* gösterge açıkken bildirim zıplama butonuna taşmasın */
body.mob #capmk .cm{transform:translate(-50%,-100%) scale(.82);transform-origin:50% 100%}
`;
const teamSign = (tm) => (tm === 'blue' ? 1 : -1);
const pcol = (p) => (p > 0 ? COL.blue : COL.red);
// halka: Mavi saat yönünde, Kırmızı tersine dolar (Cephe göstergesiyle aynı)
const ring = (p) => { const d = Math.abs(p) * 360; return Math.abs(p) < 0.015 ? 'none' : p > 0 ? `conic-gradient(${COL.blue} ${d}deg, transparent 0)` : `conic-gradient(from ${-d}deg, ${COL.red} ${d}deg, transparent 0)`; };
const setT = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
const setH = (el, s) => { if (el._h !== s) { el._h = s; el.innerHTML = s; } };
const setS = (el, k, v) => { if (el['_' + k] !== v) { el['_' + k] = v; el.style.setProperty(k, v); } };

export class CaptureHud {
  constructor(hud) {
    this.h = hud; this.g = hud.game;
    if (!document.getElementById('capCss')) { const st = document.createElement('style'); st.id = 'capCss'; st.textContent = CSS; document.head.appendChild(st); }
    const w = (this.w = document.createElement('div')); w.id = 'capw';
    w.innerHTML = '<div class="ic"><i></i><b></b></div><div class="bd"><div class="l1"><span class="nm"></span><span class="eta"></span></div><div class="l2"><span class="st"></span><span class="sub"></span></div>'
      + `<div class="l3"><span class="cnt f">${PERSON}<b></b></span><div class="bar"><i></i><u></u></div><span class="cnt e"><b></b>${PERSON}</span><span class="x"></span></div></div>`;
    const top = hud.root.querySelector('#topbar'); top.insertBefore(w, top.querySelector('#bosses'));
    const q = (s) => w.querySelector(s);
    this.e = { ic: q('.ic'), ring: q('.ic i'), lt: q('.ic b'), nm: q('.nm'), eta: q('.eta'), st: q('.st'), sub: q('.sub'), cf: q('.cnt.f'), cfn: q('.cnt.f b'), ce: q('.cnt.e'), cen: q('.cnt.e b'), fill: q('.bar i'), x: q('.x') };
    this.mk = document.createElement('div'); this.mk.id = 'capmk'; hud.root.prepend(this.mk);          // en altta: HUD öğelerinin arkasında kalır
    this.marks = this.g.mode.objectives.map((o) => { const m = document.createElement('div'); m.className = 'cm'; m.innerHTML = `<b><i></i><span>${o.label || o.name[0]}</span></b><em style="font-style:normal"></em>`; this.mk.appendChild(m); return { el: m, ring: m.querySelector('i'), d: m.querySelector('em'), b: m.querySelector('b') }; });
    this.zone = null; this.flash = null; this.left = null; this.v = new THREE.Vector3(); this.state = '';
  }

  // gösterilen ilerleme: yetkili o.p + hız × (son yetkili güncellemeden bu yana geçen süre), üstel yumuşatma; büyük farkta (geç katılım, test) atlar
  smooth(dt) {
    const g = this.g, now = performance.now();
    for (const o of g.mode.objectives) {
      const rate = g.capRate(o);
      const age = g.online ? Math.min(0.25, (now - (o._at || now)) / 1000) : clamp(0.1 - (g.capT || 0), 0, 0.1);
      const tgt = clamp(o.p + rate * age, -1, 1);
      if (o.pd === undefined || Math.abs(tgt - o.pd) > 0.3) o.pd = tgt;
      else o.pd += (tgt - o.pd) * (1 - Math.exp(-dt * 14));
      if (Math.abs(o.pd) > 0.9995) o.pd = Math.sign(o.pd);
    }
  }

  // oyuncunun bulunduğu alana göre durum: k (anahtar), renk, alt yazı, tahmin (sn) + etiketi
  status(o, me) {
    const g = this.g, S = teamSign(me.team), my = me.team, en = my === 'blue' ? 'red' : 'blue';
    let f = S > 0 ? o.nb || 0 : o.nr || 0; const e = S > 0 ? o.nr || 0 : o.nb || 0;
    if (f < 1) f = 1;                                                                // ben alandayım (yerel tahmin; sunucu sayısı bir snapshot geride olabilir)
    const q = (o.pd ?? o.p) * S, rq = g.capRate(o, S > 0 ? f : e, S > 0 ? e : f) * S, ours = o.owner === my, n = Math.min(3, Math.abs(f - e));
    const r = { f, e, n, over: Math.abs(f - e) > 3, q, col: NEU, sub: '', eta: null, el: '' };
    if (g.front && !g.front.capturable(o)) { const lk = Math.ceil(g.front.lockLeft?.() || 0); return { ...r, k: 'locked', col: '#9aa0a8', sub: lk > 0 && o === g.front.active ? t('cap.sub.lockN', { n: lk }) : t('cap.sub.locked'), n: 0 }; }
    if (f === e) return { ...r, k: 'contested', col: AMB, sub: t('cap.sub.contested') };
    if (rq > 0) {
      if (q >= 0.999) return { ...r, k: 'defending', col: TXT[my], sub: e ? t('cap.sub.outnum', { n: e }) : t('cap.sub.held') };
      if (q < 0) return { ...r, k: 'neutralizing', col: NEU, sub: t('cap.sub.neuIn', { n: Math.ceil(-q / rq) }), eta: (1 - q) / rq, el: t('cap.eta.cap') };
      if (ours) return { ...r, k: 'restoring', col: TXT[my], sub: t('cap.sub.restoring'), eta: (1 - q) / rq, el: t('cap.eta.restore') };
      return { ...r, k: 'capturing', col: TXT[my], eta: (1 - q) / rq, el: t('cap.eta.cap') };
    }
    if (q <= -0.999) return { ...r, k: 'enemyHeld', col: TXT[en], sub: t('cap.sub.enemyHeld') };
    if (q > 0 && ours) return { ...r, k: 'losing', col: TXT[en], sub: t('cap.sub.enemyMore'), eta: q / -rq, el: t('cap.eta.lose') };
    return { ...r, k: 'enemyCap', col: TXT[en], sub: t('cap.sub.enemyMore'), eta: (1 + q) / -rq, el: t('cap.eta.enemy') };
  }

  // bayrak değişti (game.onFlag → hud.flagEvent): bildirim + öldürme akışı + ses; oyuncu o alandaysa (ya da az önce çıktıysa) göstergede kısa parlama
  flagEvent(o, prev) {
    const g = this.g, h = this.h, me = g.playerSoldier, my = me?.team, l = o.label || o.name[0], f = placeName(o.name);
    if (o.owner) {
      const good = o.owner === my;
      h.toast(t(good ? 'cap.t.won' : prev === my ? 'cap.t.lost' : 'cap.t.enemyTook', { l, f }), good ? TXT[my] : TXT[o.owner]);
      if (good) g.sfx.flagWin?.(); else g.sfx.flagLose?.();
      this.feed(o.owner, 'cap.kf.took', l, f);
    } else if (prev) {
      const good = prev !== my;                                                       // düşmanınkini nötrleştirdik
      h.toast(t(good ? 'cap.t.neuEnemy' : 'cap.t.neuOurs', { l, f }), good ? NEU : TXT[prev === 'blue' ? 'red' : 'blue']);
      g.sfx.flagNeutral?.(good);
      this.feed(prev === 'blue' ? 'red' : 'blue', 'cap.kf.neu', l, f);
    }
    const near = (this.zone === o || this.left?.o === o) && me?.alive;
    if (near) {
      const k = o.owner ? (o.owner === my ? 'captured' : 'lost') : prev === my ? 'losing' : 'neutralized';
      if (k !== 'losing') { this.flash = { o, k, T: k === 'captured' ? 2.4 : 1.8 }; this.w.classList.remove('flash'); void this.w.offsetWidth; this.w.classList.add('flash'); }
    }
  }
  feed(team, key, l, f) {
    const box = this.h.$('killfeed'); if (!box) return;
    const d = document.createElement('div'); d.className = 'kf';
    d.innerHTML = `<span class="${team === 'blue' ? 'b' : 'r'}">${t(team === 'blue' ? 'hud.blue' : 'hud.red')}</span><span class="w">⚑ ${t(key)}</span><span>${l} · ${f}</span>`;
    box.appendChild(d); while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  update(dt) {
    const g = this.g, me = g.playerSoldier, objs = g.mode.objectives;
    if (!objs.length || !me) return;
    this.smooth(dt);
    let z = null;
    if (me.alive && !g.ended) for (const o of objs) if (g.inObjective(me.pos, o)) { z = o; break; }
    if (this.zone && this.zone !== z && me.alive) this.left = { o: this.zone, T: 1.8, q: this.zone.pd };
    if (z) this.left = null;
    if (this.zone !== z) this._tick = null;
    this.zone = z;
    if (this.flash && (this.flash.T -= dt) <= 0) { this.flash = null; this.w.classList.remove('flash'); }
    if (this.left && (this.left.T -= dt) <= 0) this.left = null;
    this.drawWidget(z, me);
    this.topFlags(z, me);
    this.drawMarks(z, me);
  }

  drawWidget(z, me) {
    const w = this.w, E = this.e, show = me.alive && (z || this.flash || this.left);
    w.classList.toggle('on', !!show);
    if (!show) { this.state = ''; w.dataset.st = ''; return; }
    const fl = this.flash, o = fl ? fl.o : z || this.left.o, my = me.team;
    let s;
    if (fl) s = { k: fl.k, col: fl.k === 'lost' ? TXT[my === 'blue' ? 'red' : 'blue'] : fl.k === 'captured' ? TXT[my] : NEU, sub: t(fl.k === 'captured' ? 'cap.sub.capNow' : fl.k === 'lost' ? 'cap.sub.lostNow' : 'cap.sub.neuNow'), eta: null, f: -1 };
    else if (!z) s = { k: 'left', col: '#c3c8cf', sub: Math.abs(o.pd) > 0.02 && Math.abs(o.pd) < 0.999 ? t('cap.sub.keep') : t('cap.sub.left'), eta: null, f: -1 };
    else s = this.status(o, me);
    this.state = s.k; w.dataset.st = s.k;
    w.classList.toggle('ctd', s.k === 'contested'); w.classList.toggle('left', s.k === 'left');
    setS(w, '--sc', s.col);
    setS(w, '--oc', o.owner ? COL[o.owner] : '#9aa0a8');
    const pd = o.pd ?? o.p;
    const rg = ring(pd); if (E.ring._bg !== rg) { E.ring._bg = rg; E.ring.style.background = rg; }
    setT(E.lt, o.label || o.name[0]);
    setT(E.nm, `${o.label || o.name[0]} · ${placeName(o.name)}`);
    setT(E.st, t('cap.st.' + s.k));
    setT(E.sub, s.sub || '');
    setH(E.eta, s.eta != null && Number.isFinite(s.eta) ? `${s.el}<b>~${s.eta > 99 ? '99+' : Math.max(1, Math.ceil(s.eta))} ${t('cap.sec')}</b>` : s.k === 'contested' ? '<b>—</b>' : s.k === 'defending' || s.k === 'captured' ? '<b>✓</b>' : '');
    E.fill.style.width = (Math.abs(pd) * 100).toFixed(1) + '%';
    setS(E.fill.parentElement, '--pc', Math.abs(pd) < 0.01 ? NEU : pcol(pd));
    const cnt = s.f >= 0;
    E.cf.style.visibility = E.ce.style.visibility = cnt ? 'visible' : 'hidden';
    if (cnt) { setT(E.cfn, String(s.f)); setT(E.cen, String(s.e)); E.cf.style.color = TXT[my]; E.ce.style.color = s.e ? TXT[my === 'blue' ? 'red' : 'blue'] : 'rgba(255,255,255,.35)'; }
    const xs = cnt && s.n > 0 && s.k !== 'enemyHeld' && s.k !== 'defending' ? (s.over ? t('cap.rateMax') : t('cap.rate', { n: s.n })) : '';
    setT(E.x, xs); E.x.style.display = xs ? '' : 'none'; E.x.classList.toggle('mx', !!s.over || s.n === 3);
    // ele geçirirken her %25'te hafif tık (yükselen / alçalan)
    if (z && !fl && (s.k === 'capturing' || s.k === 'neutralizing' || s.k === 'restoring' || s.k === 'losing' || s.k === 'enemyCap')) {
      const step = Math.floor((s.q + 1) * 4 + 1e-6);
      if (this._tick != null && step !== this._tick) this.g.sfx.capTick?.(step > this._tick);
      this._tick = step;
    }
  }

  // üst çubuktaki bayraklar: halka = ilerleme (yönlü), çerçeve = sahip, nabız = şu an alınıyor (alanın sayılarından), sarı = çekişmeli, alt çizgi = bulunduğun alan
  topFlags(z) {
    const g = this.g, els = this.h.flagEls;
    g.mode.objectives.forEach((o, i) => {
      const f = els[i]; if (!f) return;
      const st = this.flagState(o);
      setS(f, 'border-color', o.owner ? COL[o.owner] : '#9aa0a8');
      const rg = ring(Math.abs(o.pd) >= 0.999 ? 0 : o.pd), ie = f.firstElementChild;
      if (ie._bg !== rg) { ie._bg = rg; ie.style.background = rg; }
      f.classList.toggle('cap', st.cap); f.classList.toggle('ctd', st.ctd); f.classList.toggle('here', o === z);
      if (st.cap) setS(f, '--cc', pcol(st.rate));
    });
  }
  flagState(o) {
    const rate = this.g.capRate(o), b = o.nb || 0, r = o.nr || 0;
    const moving = rate !== 0 && !(rate > 0 && o.p >= 1) && !(rate < 0 && o.p <= -1);
    return { rate, cap: moving, ctd: !moving && b > 0 && b === r && !(this.g.front && !this.g.front.capturable(o)) };
  }

  // mini harita bayrakları (hud.drawMinimap çağırır): dolgu = sahip, dış halka = ilerleme, nabız = alınıyor
  drawMinimap(x, mx, my, now) {
    const g = this.g;
    for (const o of g.mode.objectives) {
      const X = mx(o.x), Y = my(o.z), st = this.flagState(o), pd = o.pd ?? o.p;
      if (st.cap || st.ctd) { const k = (now / 700) % 1; x.beginPath(); x.arc(X, Y, 10 + k * 7, 0, 6.3); x.strokeStyle = st.ctd ? `rgba(255,207,90,${1 - k})` : (st.rate > 0 ? `rgba(74,163,255,${1 - k})` : `rgba(255,90,67,${1 - k})`); x.lineWidth = 2; x.stroke(); }
      x.beginPath(); x.arc(X, Y, 9, 0, 6.3);
      x.fillStyle = o.owner === 'blue' ? '#4aa3ffaa' : o.owner === 'red' ? '#ff5a43aa' : '#ffffff55';
      x.fill(); x.strokeStyle = o === this.zone ? '#ff8a1f' : '#fff'; x.lineWidth = o === this.zone ? 2.2 : 1.5; x.stroke();
      if (Math.abs(pd) > 0.015 && Math.abs(pd) < 0.999) { x.beginPath(); const a0 = -Math.PI / 2, a = Math.abs(pd) * Math.PI * 2; if (pd > 0) x.arc(X, Y, 11.5, a0, a0 + a); else x.arc(X, Y, 11.5, a0 - a, a0); x.strokeStyle = pcol(pd); x.lineWidth = 3; x.stroke(); }
      x.fillStyle = '#fff'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(o.label || o.name[0], X, Y + 0.5);
    }
  }

  // dünyada bayrak işaretleri (direğin üstünde): harf + ilerleme halkası + uzaklık; ekran ortasına yakınken soluk (nişanı örtmesin); bulunduğun alanınki gizli (gösterge var)
  drawMarks(z, me) {
    const g = this.g, cam = g.camera, W = innerWidth, H = innerHeight;
    const hide = !!g.front || !me.alive;                                              // Cephe: kendi işaretleri (frontHud)
    if (!this._tbT || performance.now() - this._tbT > 250) { this._tbT = performance.now(); this._tb = this.h.root.querySelector('#topbar').getBoundingClientRect(); }   // üst çubuk + gösterge alanı: işaret oraya binmesin
    const tb = this._tb;
    g.mode.objectives.forEach((o, i) => {
      const M = this.marks[i];
      if (hide || o === z) { if (M.on) { M.on = false; M.el.style.display = 'none'; } return; }
      const top = g.objFx?.top(o) ?? g.objY(o) + 6;
      const v = this.v.set(o.x, top + 1.2, o.z), d = Math.hypot(o.x - me.pos.x, o.z - me.pos.z);
      v.project(cam);
      const vis = v.z < 1 && Math.abs(v.x) < 0.96 && Math.abs(v.y) < 0.92;
      if (!vis) { if (M.on) { M.on = false; M.el.style.display = 'none'; } return; }
      const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
      if (sx > tb.left - 24 && sx < tb.right + 24 && sy < tb.bottom + 34) { if (M.on) { M.on = false; M.el.style.display = 'none'; } return; }
      if (!M.on) { M.on = true; M.el.style.display = 'flex'; }
      M.el.style.left = sx.toFixed(0) + 'px'; M.el.style.top = sy.toFixed(0) + 'px';
      const c = Math.hypot(sx - W / 2, sy - H / 2), op = c < 70 ? 0.3 : c < 140 ? 0.3 + (c - 70) / 70 * 0.6 : 0.9;
      if (M._op !== op) { M._op = op; M.el.style.opacity = op.toFixed(2); }
      setT(M.d, d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m');
      setS(M.b, '--oc', o.owner ? COL[o.owner] : '#9aa0a8');
      M.el.style.color = o.owner ? TXT[o.owner] : NEU;
      const rg = ring(Math.abs(o.pd) >= 0.999 ? 0 : o.pd); if (M.ring._bg !== rg) { M.ring._bg = rg; M.ring.style.background = rg; }
      const st = this.flagState(o); M.el.classList.toggle('cap', st.cap); M.el.classList.toggle('ctd', st.ctd);
      if (st.cap) setS(M.b, '--cc', pcol(st.rate));
    });
  }

  dispose() { this.w.remove(); this.mk.remove(); }
}
