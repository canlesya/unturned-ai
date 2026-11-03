// 12.226 Bomba modu arayüzü + dünyadaki bomba (hud.js'e dokunmadan kendi modülü; çevrimdışı oyun + çevrim içi istemci aynı):
// · üst çubuk: skor kutuları = kazanılan raunt (hud.js), altında iki takımın durum noktaları (sağ / ölü, bombayı taşıyan saldırana görünür) + "RAUNT 3/12 · İLK 7" + taraf
// · ortada afiş: raunt başı (maç raundu / taraf değişti), BAŞLA (saldır / savun), BOMBA KURULDU, raunt sonu (HEDEF YOK EDİLDİ / BOMBA İMHA EDİLDİ / … + aldınız / kaybettiniz)
// · bomba sayacı (kurulunca, belirgin), bomba sende / imha kiti rozetleri, kurma / imha istemi + ilerleme halkası, A / B bölge harfleri (ekranda + mini / büyük harita)
// · bombayı taşıyanın üstünde simge (saldırana), yerdeki bomba (model + işaret), kurulu bomba (yanıp sönen ışık + konumlu bip; son 10 sn hızlanır), patlama
// · akışta "kurdu / imha etti / düşürdü / aldı", ölünce izleme çubuğu, hazırlıkta sınıf şeridi
// · 12.229 tek bomba modeli (models/bombModel.js: elde / sırtta / yerde aynı), atılan bombanın uçuşu (sunucunun / yetkilinin yolu: 'bmd' f + u → aynı fizik),
//   rozette "5: eline al · sol tık: at", akışta "bombayı attı"
import * as THREE from 'three';
import { t } from '../i18n/index.js';
import { className } from '../i18n/data.js';
import { dispName } from '../i18n/game.js';
import { LIMITS } from './balance.js';
import { CLASS_DEFS } from './stats.js';
import { codeLabel } from '../core/keybinds.js';
import { makeBomb } from '../models/bombModel.js';
import { simulateNade, NADE } from './grenade.js';

const CSS = `
#bmpips{display:flex;align-items:center;gap:10px;margin-top:-2px;padding:3px 10px;background:rgba(9,13,19,.62);border:1px solid rgba(255,255,255,.1);font-weight:800;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
#bmpips .tm{display:flex;gap:4px}#bmpips .tm.red{flex-direction:row-reverse}
#bmpips .p{position:relative;width:15px;height:15px;border-radius:50%;box-sizing:border-box;border:2px solid var(--c);background:var(--c)}
#bmpips .blue .p{--c:#4aa3ff}#bmpips .red .p{--c:#ff5a43}
#bmpips .p.out{background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.22)}
#bmpips .p.out::after{content:'✕';position:absolute;inset:0;font-size:9px;line-height:11px;text-align:center;color:rgba(255,255,255,.55)}
#bmpips .p.me{outline:2px solid #fff;outline-offset:1px}
#bmpips .p.bomb{border-color:#ffd36a;box-shadow:0 0 7px #ffb020}
#bmpips .p.bomb::after{content:'';position:absolute;inset:3px;border-radius:2px;background:#2a2a2a;border:1px solid #ffd36a}
#bmpips .p.kit::before{content:'';position:absolute;right:-3px;top:-3px;width:6px;height:6px;border-radius:50%;background:#7be06f;border:1px solid #102}
#bmpips .rd{min-width:128px;text-align:center;font-size:12px;letter-spacing:2px;line-height:1.1;white-space:nowrap}
#bmpips .rd small{display:block;font-size:9px;letter-spacing:2px;opacity:.75;font-weight:700}
#bmpips .rd small b{color:#ffd36a}
#bmban{position:absolute;left:50%;top:24%;transform:translate(-50%,0);text-align:center;font-weight:800;letter-spacing:5px;font-size:40px;text-shadow:0 3px 14px #000;opacity:0;transition:opacity .35s;pointer-events:none;white-space:nowrap}
#bmban small{display:block;font-size:15px;letter-spacing:2.5px;font-weight:700;opacity:.92;margin-top:6px}
#bmban em{display:inline-block;font-style:normal;font-size:13px;letter-spacing:3px;padding:3px 12px;margin-bottom:8px;background:rgba(255,211,106,.18);border:1px solid rgba(255,211,106,.6);color:#ffd36a}
#bmprep{position:absolute;left:50%;top:58%;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
#bmprep .h{font-size:13px;font-weight:800;letter-spacing:3px;color:#ffd36a;text-shadow:0 1px 4px #000}
#bmprep .row{display:flex;gap:6px}
#bmprep .c{padding:5px 11px;font-size:13px;font-weight:800;letter-spacing:1px;background:rgba(9,13,19,.75);border:1px solid rgba(255,255,255,.16);white-space:nowrap}
#bmprep .c b{color:#ffb347;margin-right:6px}#bmprep .c.on{border-color:#ffd36a;background:rgba(80,60,12,.82)}
#bmtimer{position:absolute;left:calc(50% + 196px);top:10px;display:none;align-items:center;gap:10px;padding:6px 18px;background:rgba(40,6,6,.82);border:2px solid #ff4a3a;box-shadow:0 0 18px rgba(255,60,40,.45);font-weight:800;pointer-events:none}
#bmtimer i{width:16px;height:16px;border-radius:50%;background:#ff3b2b;box-shadow:0 0 10px #ff3b2b}
#bmtimer i.off{background:#5a1410;box-shadow:none}
#bmtimer b{font-size:30px;letter-spacing:2px;font-variant-numeric:tabular-nums;color:#fff}
#bmtimer span{font-size:12px;letter-spacing:3px;color:#ffb0a6}
#bmtimer.lo b{color:#ff6a5a}
#bmbadge{position:absolute;left:50%;bottom:112px;transform:translateX(-50%);display:flex;gap:8px;pointer-events:none}
#bmbadge .bd{display:none;align-items:center;gap:8px;padding:5px 12px;background:rgba(9,13,19,.78);border:1px solid rgba(255,255,255,.16);font-weight:800;letter-spacing:2px;font-size:13px;white-space:nowrap}
#bmbadge .bd small{display:block;font-size:10px;letter-spacing:1px;opacity:.75;font-weight:700}
#bmbadge .bomb{border-color:#ffd36a;color:#ffd36a}#bmbadge .kit{border-color:#7be06f;color:#9be07f}
#bmbadge .ic{width:22px;height:22px;flex:none}
#bmuse{position:absolute;left:50%;top:60%;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:2px;pointer-events:none;text-shadow:0 1px 4px #000}
#bmuse .t{font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase}
#bmuse .t.warn{color:#ff9a88}
.bmring{position:relative;width:58px;height:58px;margin:4px auto 0}
.bmring svg{position:absolute;inset:0;transform:rotate(-90deg)}
.bmring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
#bmmk{position:absolute;inset:0;pointer-events:none}
#bmmk .m{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:11px;letter-spacing:1px;text-shadow:0 1px 3px #000;white-space:nowrap}
#bmmk .m i{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:4px;font-style:normal;font-size:15px;color:#fff;background:rgba(20,26,36,.72);border:2px solid #ffd36a}
#bmmk .m.site i{border-radius:50%;width:30px;height:30px;font-size:16px;border-color:#fff;background:rgba(30,36,48,.6)}
#bmmk .m.site.on i{background:rgba(255,180,40,.5);border-color:#ffd36a}
#bmmk .m.site.hot i{background:rgba(255,60,40,.7);border-color:#ff7b6b;animation:bmpulse .6s infinite}
#bmmk .m.car i{width:20px;height:20px;font-size:11px;background:rgba(60,44,8,.85)}
#bmmk .m.pl i{border-color:#ff5a43;background:rgba(80,12,8,.85);animation:bmpulse .6s infinite}
@keyframes bmpulse{50%{box-shadow:0 0 12px #ff5a43}}
#bmsite{position:absolute;left:50%;top:64%;transform:translateX(-50%);display:none;padding:3px 14px;background:rgba(80,60,12,.75);border:1px solid #ffd36a;color:#ffd36a;font-weight:800;letter-spacing:3px;font-size:13px;pointer-events:none;text-shadow:0 1px 3px #000}
#bmsite.hot{background:rgba(90,14,10,.8);border-color:#ff7b6b;color:#ffb0a6}
#bmsp{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;padding:7px 22px;background:rgba(9,13,19,.78);border:1px solid rgba(255,255,255,.14);border-top:3px solid #ff7b6b;font-weight:800;letter-spacing:2px;text-align:center;pointer-events:none}
#bmsp b{font-size:20px;color:#ff9a88;letter-spacing:5px}#bmsp span{font-size:14px;margin-top:2px}#bmsp small{font-size:11px;opacity:.7;letter-spacing:1.5px;margin-top:2px}
.kf .w.bmp{color:#ffb347;border-color:rgba(255,179,71,.45)}.kf .w.bmx{color:#9be07f;border-color:rgba(155,224,127,.45)}.kf .w.bmd{color:#cfd8e6;border-color:rgba(207,216,230,.35)}.kf .w.bmb{color:#ff7b6b;border-color:rgba(255,123,107,.45)}
@media (max-height:520px){#bmban{font-size:26px}#bmban small{font-size:12px}#bmpips .p{width:11px;height:11px}#bmsp{bottom:80px}#bmtimer{top:4px;left:calc(50% + 150px);padding:3px 10px}#bmtimer b{font-size:22px}#bmbadge{bottom:84px}}
`;
const BOMB_SVG = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="11" rx="1.5"/><path d="M7 8V5h10v3"/><circle cx="12" cy="13.5" r="2.2" fill="#ff3b2b" stroke="none"/></svg>';
const KIT_SVG = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20l7-7M14 4l6 6-3 3-6-6z"/><path d="M9 15l-3-3 2-2 3 3"/></svg>';
const RING = (r, w) => { const C = 2 * Math.PI * r; return { C, svg: (col) => `<svg viewBox="0 0 ${2 * r + w} ${2 * r + w}"><circle cx="${r + w / 2}" cy="${r + w / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="${w}"/><circle class="fg" cx="${r + w / 2}" cy="${r + w / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg>` }; };
const R2 = RING(25, 5);
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const WIN_OF = [null, 'blue', 'red', 'draw'], WHY = ['elim', 'time', 'boom', 'defuse', 'tie'];

export class BombaHud {
  constructor(g, B) {
    this.g = g; this.B = B;
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const root = g.hud.root, top = root.querySelector('#topbar');
    const mk = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; return d; };
    this.pips = mk('bmpips'); top.insertBefore(this.pips, top.querySelector('#flags'));
    const lim = g.hud.$('lim'); if (lim) lim.style.display = 'none';
    this.ban = mk('bmban'); this.prepEl = mk('bmprep'); this.mk = mk('bmmk');
    this.timer = mk('bmtimer', `<i></i><div><span>${t('bm.timer')}</span><br><b>40.0</b></div>`);
    this.badge = mk('bmbadge', `<div class="bd bomb">${BOMB_SVG}<div>${t('bm.carry')}<small></small></div></div><div class="bd kit">${KIT_SVG}<div>${t('bm.kit')}<small>${t('bm.kitSub')}</small></div></div>`);
    this.use = mk('bmuse', `<div class="t"></div><div class="bmring">${R2.svg('#ffd36a')}<b></b></div>`);
    this.sp = mk('bmsp', '<b></b><span></span><small></small>');
    this.siteTag = mk('bmsite');
    root.append(this.mk, this.ban, this.prepEl, this.timer, this.badge, this.use, this.sp, this.siteTag);
    this.v = new THREE.Vector3(); this.marks = []; this.banT = 0; this._k = {};
    this.beepT = 0; this.blink = 0;
    this.buildModel();
    for (const ev of B.pend.splice(0)) this.onEvent(ev);
  }

  // dünyadaki bomba (12.229: ortak C4 modeli, elde / sırtta görünenle aynı); kurulunca lamba + nokta ışık yanıp söner
  buildModel() {
    const G = makeBomb();
    this.lampMat = G.userData.lampMat;
    this.light = new THREE.PointLight('#ff3020', 0, 5, 2); this.light.position.set(0.075, 0.4, -0.03); G.add(this.light);
    G.visible = false;
    this.model = G; this.g.scene.add(G);
    this.fl = null;
  }

  // 12.229 atılan bombanın uçuşu: başlangıç f + hız u → el bombası fiziğiyle (yetkili tarafla aynı yol) noktalar; t0 = atış anı (oyun saati).
  // Atanın kendi tahmini (çevrim içi) sunucunun 'bmd'si gelince aynı t0 ile sunucunun yoluna geçer (sıçrama yok: iki yol aynı)
  fly(f, u, t0, id, end = null) {
    const g = this.g, o = (this._fo ||= {});
    const r = simulateNade(g.world, f, u, 6, o, 400);
    const pts = r.pts.slice(0, r.n).map((q) => q.clone());
    this.fl = { pts, n: r.n, t0, id, end: end ? new THREE.Vector3(end[0], end[1], end[2]) : null, spin: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 4) };
  }
  flyPos(out) {
    const F = this.fl; if (!F) return null;
    const el = this.g.time - F.t0, i = el / NADE.h, i0 = Math.floor(i);
    if (i0 >= F.n - 1 || el < 0) return null;
    return out.copy(F.pts[i0]).lerp(F.pts[i0 + 1], i - i0);
  }

  // ───── olaylar (bomba.js fx) ─────
  onEvent(ev) {
    const g = this.g, S = g.soldiers, me = g.playerSoldier, B = this.B;
    const amAtt = me.team === B.att;
    switch (ev.e) {
      case 'bmk': {
        const v = S[ev.v]; if (!v) return;
        if (me.team !== v.team) return;                                             // taşıyan yalnız saldırana
        if (v === me) { g.hud.toast(t('bm.t.got'), '#ffd36a'); g.sfx.capTick?.(true); }
        else if (ev.k) { this.feed(v, t('bm.kf.pick'), null, 'bmd'); g.hud.toast(t('bm.t.pick', { n: dispName(v) }), '#ffd36a'); }
        else g.hud.toast(t('bm.t.has', { n: dispName(v) }), '#ffd36a');
        return;
      }
      case 'bmd': {
        const v = S[ev.v];
        if (ev.th && Array.isArray(ev.f) && Array.isArray(ev.u)) {                  // 12.229 atış: yolu canlandır (atanın tahmini sürüyorsa aynı t0)
          const own = this.fl && this.fl.id === ev.v && g.time - this.fl.t0 < 1.5 && !this.fl.end;
          this.fly(new THREE.Vector3(...ev.f), new THREE.Vector3(...ev.u), own ? this.fl.t0 : g.time, ev.v, ev.p);
        } else if (ev.th && this.fl?.id === ev.v) this.fl = null;                   // geçersiz atış: ayağın dibine düştü
        if (v && amAtt) { this.feed(v, t(ev.th ? 'bm.kf.throw' : 'bm.kf.drop'), null, 'bmd'); if (v !== me) g.hud.toast(t(ev.th ? 'bm.t.throw' : 'bm.t.drop', { n: dispName(v) }), '#ffd36a'); }
        return;
      }
      case 'bmp': {
        const v = S[ev.v], s = B.siteName(ev.s);
        if (v) this.feed(v, `${BOMB_SVG.replace('class="ic"', 'class="ic" style="width:13px;height:13px;vertical-align:-2px"')} ${esc(t('bm.kf.plant', { s }))}`, null, 'bmp');
        this.banner(t('bm.planted'), t('bm.plantedSub', { s }), '#ff7b6b', 2.6);
        g.hud.toast(amAtt ? t('bm.t.plantedA') : t('bm.t.planted', { s }), '#ff9a88');
        if (v === me) g.hud.popup(t('bm.pop.plant'));
        this.chirp([1250, 1650], 0.1);
        this.beepT = 0.05;
        return;
      }
      case 'bmx': {
        const v = S[ev.v];
        if (v) this.feed(v, `✔ ${esc(t('bm.kf.defuse'))}`, null, 'bmx');
        if (v === me) g.hud.popup(t('bm.pop.defuse'));
        this.chirp([900, 1350, 1800], 0.09);
        return;
      }
      case 'bmb': {
        const P = new THREE.Vector3(ev.p[0], ev.p[1] + 0.5, ev.p[2]);
        const fx = g.effects;
        for (const [dx, dy, dz, r] of [[0, 0, 0, 9], [-2.5, 1.4, 1.5, 6], [2.4, 0.8, -1.8, 6], [0.6, 3.2, 0.4, 7], [-1, 0.4, -2.6, 5]]) fx.explosion?.(new THREE.Vector3(P.x + dx, P.y + dy, P.z + dz), r);
        fx.heBlast?.(P, new THREE.Vector3(0, 1, 0));
        fx.boomShake?.(P, 1.0, 80);
        g.sfx.explosion?.(P, true);
        g.heat?.add?.(P.x, P.z, 4, g.time);
        if (!g.online) { const dn = new THREE.Vector3(0, -1, 0); const gh = g.world.raycast(new THREE.Vector3(P.x, P.y + 1, P.z), dn, 6, {}); if (gh) fx.decal?.(gh.point, gh.normal, true); }
        this.feed(null, `✹ ${esc(t('bm.kf.boom'))}`, null, 'bmb');
        return;
      }
      case 'bmr': {
        const mp = Math.max(g.tickets.blue, g.tickets.red) === B.need - 1;
        const half = B.half && ev.n === B.half + 1;
        const side = me.team === B.att ? t('bm.att') : t('bm.def');
        this.banner(`${half ? `<em>${t('bm.half')}</em><br>` : mp ? `<em>${t('bm.matchPoint')}</em><br>` : ''}${t('bm.roundN', { n: ev.n })}`, `${side} · ${t('bm.score', { b: g.tickets.blue, r: g.tickets.red })}`, '#ffffff', 2.6);
        g.sfx.capture?.();
        this.model.visible = false; this.fl = null;
        return;
      }
      case 'bmg': {
        const a = me.team === B.att;
        this.banner(a ? t('bm.goAtt') : t('bm.goDef'), a ? t('bm.goAttSub') : t('bm.goDefSub'), '#ffd36a', 1.8);
        return;
      }
      case 'bme': {
        const w = WIN_OF[ev.w] || 'draw', why = WHY[ev.y] || 'elim', att = WIN_OF[ev.a] || B.att;
        if (ev.sc) { g.tickets.blue = ev.sc[0]; g.tickets.red = ev.sc[1]; }
        const draw = w === 'draw', win = !draw && w === me.team;
        const head = why === 'boom' ? t('bm.boom') : why === 'defuse' ? t('bm.defused') : why === 'time' ? t('bm.timeOut') : why === 'elim' ? (w === att ? t('bm.defOut') : t('bm.attOut')) : t('bm.draw');
        const sub = `${draw ? t('bm.draw') : win ? t('bm.win') : t('bm.lose')}${why === 'time' ? ' · ' + t('bm.timeOutSub') : ''}<br>${t('bm.score', { b: g.tickets.blue, r: g.tickets.red })}`;
        this.banner(head, sub, draw ? '#ffd36a' : win ? '#7be06f' : '#ff7b6b', LIMITS.bmPost);
        if (win && me.alive) g.hud.popup(t('bm.pop.round'));
        if (win) g.sfx.capture?.();
      }
    }
  }

  chirp(fs, gap) {
    const A = this.g.sfx; if (!A?.ctx || !A._tone) return;
    const v = A._voice(null, 1);
    fs.forEach((f, i) => A._tone({ v, gain: 0.14, dur: gap * 0.9, f0: f, f1: f, type: 'triangle', delay: i * gap }));
  }
  beep(P, hi) {
    const A = this.g.sfx; if (!A?.ctx || !A._tone) return;
    A._tone({ pos: P, ref: 22, gain: hi ? 0.5 : 0.4, dur: 0.07, f0: hi ? 2350 : 2000, f1: hi ? 2350 : 2000, type: 'square', att: 0.002 });
  }

  // akış satırı (killfeed ile aynı görünüm): a [metin] b
  feed(a, txt, b, cls) {
    const g = this.g, f = g.hud.$('killfeed'), me = g.playerSoldier;
    if (!f) return;
    const c = (s) => (s.team === 'blue' ? 'b' : 'r');
    const d = document.createElement('div'); d.className = 'kf' + (a === me || b === me ? ' me' : '');
    d.innerHTML = `${a ? `<span class="${c(a)}">${esc(dispName(a))}</span>` : ''}<span class="w ${cls}">${txt}</span>${b ? `<span class="${c(b)}">${esc(dispName(b))}</span>` : ''}`;
    f.appendChild(d);
    while (f.children.length > 6) f.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  banner(html, sub, col, dur) {
    this.ban.innerHTML = `${html}${sub ? `<small>${sub}</small>` : ''}`;
    this.ban.style.color = col; this.ban.style.opacity = 1; this.banT = dur;
  }

  setK(k, v) { if (this._k[k] === v) return false; this._k[k] = v; return true; }
  key() { return codeLabel(this.g.binds?.codes('use')?.[0]) || 'E'; }

  // ───── her kare (Hud.update sonunda) ─────
  update(dt) {
    const g = this.g, me = g.playerSoldier;
    if (this.banT > 0 && (this.banT -= dt) <= 0) this.ban.style.opacity = 0;
    if (g.ended && this.banT > 0) { this.banT = 0; this.ban.style.opacity = 0; }      // maç sonu ekranının üstünde afiş kalmasın
    this.drawPips(me);
    this.drawPrep(me);
    this.drawTimer();
    this.drawBadges(me);
    this.drawUse(me);
    this.drawMarks(me);
    this.drawSpec(me);
    this.drawWorld(dt);
  }

  drawPips(me) {
    const g = this.g, B = this.B, att = me.team === B.att, car = B.bomb.st === 'carried' ? B.bomb.carrier : null;
    const one = (team) => g.soldiers.filter((s) => s.team === team && !s.vacant).map((s) => [s.alive ? 1 : 0, s === me ? 1 : 0, att && s === car ? 1 : 0, s.team === me.team && s.bmKit ? 1 : 0]);
    const L = one('blue'), R = one('red');
    const key = JSON.stringify([L, R, B.round, B.rounds, B.phase, B.need, B.att, me.team]);
    if (!this.setK('pips', key)) return;
    const html = (A) => A.map(([a, m, b, k]) => `<i class="p ${a ? '' : 'out'}${m ? ' me' : ''}${b && a ? ' bomb' : ''}${k && a ? ' kit' : ''}"></i>`).join('');
    const side = me.team === B.att ? t('bm.att') : t('bm.def');
    this.pips.innerHTML = `<div class="tm blue">${html(L)}</div><div class="rd">${t('bm.round', { n: B.round, m: B.rounds })}<small>${B.phase === 'prep' ? t('bm.prep') : t('bm.first', { k: B.need })} · <b>${side}</b></small></div><div class="tm red">${html(R)}</div>`;
  }

  drawPrep(me) {
    const g = this.g, B = this.B, on = B.phase === 'prep' && me.alive;
    if (this.setK('prepOn', on)) this.prepEl.style.display = on ? 'flex' : 'none';
    if (!on) return;
    const keys = Object.keys(CLASS_DEFS).filter((k) => !CLASS_DEFS[k].zombie), cur = g.pendingClass || me.cls, s = Math.max(0, Math.ceil(B.t));
    if (!this.setK('prep', cur + '|' + s)) return;
    this.prepEl.innerHTML = `<div class="h">${t('bm.prep')} · ${s}</div><div class="row">${keys.map((k, i) => `<div class="c ${k === cur ? 'on' : ''}"><b>${i + 1}</b>${esc(className(k))}${k === 'engineer' && me.team !== B.att ? ' +' + t('bm.kit') : ''}</div>`).join('')}</div><div class="h" style="color:#cfd8e6;font-size:11px">${t('bm.prepSub', { s })}</div>`;
  }

  drawTimer() {
    const B = this.B, on = B.bomb.st === 'planted' && B.live && !this.g.ended;
    if (this.setK('tmOn', on)) this.timer.style.display = on ? 'flex' : 'none';
    if (!on) return;
    const s = Math.max(0, B.t);
    if (this.setK('tm', s.toFixed(1))) { this.timer.querySelector('b').textContent = s < 10 ? s.toFixed(1) : String(Math.ceil(s)); this.timer.classList.toggle('lo', s < 10); }
    this.timer.querySelector('i').className = this.blink > 0 ? '' : 'off';
  }

  drawBadges(me) {
    const B = this.B, bomb = me.alive && B.bomb.st === 'carried' && B.bomb.carrier === me, kit = me.alive && !!me.bmKit && me.team === B.def;
    if (this.setK('bdB', bomb)) this.badge.children[0].style.display = bomb ? 'flex' : 'none';
    if (this.setK('bdK', kit)) this.badge.children[1].style.display = kit ? 'flex' : 'none';
    const hk = codeLabel(this.g.binds?.codes('bombHand')?.[0]) || '5', touch = !!this.g.player?.touch;
    if (bomb && this.setK('bdBk', this.key() + hk + (me.bmHand ? 1 : 0) + touch)) this.badge.querySelector('.bomb small').textContent = `${t('bm.carrySub', { k: this.key() })} · ${t(me.bmHand ? (touch ? 'bm.handOnT' : 'bm.handOn') : touch ? 'bm.handHintT' : 'bm.handHint', { k: hk })}`;      // 12.229
  }

  // kurma / imha istemi + ilerleme (ilerleme yetkili taraftan: çevrim içinde anlık görüntüden)
  drawUse(me) {
    const B = this.B, kind = B.useKind(me), b = B.bomb;
    const on = !!kind;
    if (this.setK('useOn', on)) this.use.style.display = on ? 'flex' : 'none';
    if (!on) return;
    const mine = b.who === me && b.prog > 0, need = kind === 'plant' ? LIMITS.bmPlant : B.defuseTime(me);
    const moving = me.bmUse && !B.still(me);
    const frac = mine ? Math.min(1, b.prog / need) : 0;
    this.use.querySelector('.fg').setAttribute('stroke-dashoffset', (R2.C * (1 - frac)).toFixed(1));
    this.use.querySelector('.fg').setAttribute('stroke', kind === 'plant' ? '#ffd36a' : '#7be06f');
    const txt = moving ? t('bm.still') : mine ? t(kind === 'plant' ? 'bm.planting' : 'bm.defusing') : t(kind === 'plant' ? 'bm.holdPlant' : 'bm.holdDefuse', { k: this.key() }) + (kind === 'defuse' ? ` · ${need} sn` : '');
    if (this.setK('use', txt + '|' + (mine ? Math.ceil((need - b.prog) * 10) : -1))) {
      const el = this.use.querySelector('.t'); el.textContent = txt; el.className = 't' + (moving ? ' warn' : '');
      this.use.querySelector('b').textContent = mine ? Math.max(0, need - b.prog).toFixed(1) : '';
    }
  }

  // ekran işaretleri: A / B bölge harfleri (40 m içinde ya da bomba taşıyorsan / kurulduysa), taşıyan (saldırana), yerdeki bomba (saldırana), kurulu bomba (herkese)
  drawMarks(me) {
    const g = this.g, B = this.B, b = B.bomb, cam = g.camera, W = innerWidth, H = innerHeight;
    const att = me.team === B.att, list = [];
    const carrier = b.st === 'carried' && b.carrier === me;
    const live = B.phase !== 'over' && !g.ended;
    if (live) {
      for (const s of B.sites) {
        const d = Math.hypot(s.x - cam.position.x, s.z - cam.position.z);
        const hot = b.st === 'planted' && b.site === s.i, inside = me.alive && B.siteAt(me.pos) === s.i;
        if (d > 45 && !carrier && !hot && !(att && B.prep)) continue;
        list.push({ x: s.x, y: (s.y ?? me.pos.y) + 2.2, z: s.z, cls: 'site' + (hot ? ' hot' : inside ? ' on' : ''), ic: s.name, lb: inside ? t('bm.inSite', { s: s.name }) : `${Math.round(d)} m` });
      }
      if (att && b.st === 'carried' && b.carrier && b.carrier !== me && b.carrier.alive) list.push({ x: b.carrier.pos.x, y: b.carrier.pos.y + b.carrier.height + 0.55, z: b.carrier.pos.z, cls: 'car', ic: '▣', lb: '' });
      const fp = this.flyPos(this.v2 ||= new THREE.Vector3());                   // 12.229 uçarken işaret bombayla gider
      if (att && (b.st === 'dropped' || fp)) { const q = fp || b; list.push({ x: q.x, y: q.y + 0.6, z: q.z, cls: '', ic: '▣', lb: `${t('bm.dropped')} · ${Math.round(Math.hypot(q.x - cam.position.x, q.z - cam.position.z))} m` }); }
      if (b.st === 'planted') list.push({ x: b.x, y: b.y + 0.7, z: b.z, cls: 'pl', ic: '▣', lb: `${t('bm.bombLbl')} · ${Math.round(Math.hypot(b.x - cam.position.x, b.z - cam.position.z))} m` });
    }
    // bölgenin içindeyken sabit etiket ("A BÖLGESİ"; bomba oradaysa kırmızı)
    const inS = live && me.alive ? B.siteAt(me.pos) : -1, tagK = inS < 0 ? '' : inS + (b.st === 'planted' && b.site === inS ? 'h' : '');
    if (this.setK('tag', tagK)) { this.siteTag.style.display = tagK ? 'block' : 'none'; if (tagK) { this.siteTag.textContent = t('bm.inSite', { s: B.siteName(inS) }); this.siteTag.className = tagK.endsWith('h') ? 'hot' : ''; } }
    let n = 0;
    for (const q of list) {
      const v = this.v.set(q.x, q.y, q.z).project(cam);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;
      let m = this.marks[n];
      if (!m) { m = document.createElement('div'); m.innerHTML = '<i></i><span></span>'; this.mk.appendChild(m); this.marks.push(m); m._k = ''; }
      n++;
      m.style.display = 'flex';
      m.style.left = ((v.x + 1) / 2 * W).toFixed(0) + 'px'; m.style.top = ((1 - v.y) / 2 * H).toFixed(0) + 'px';
      const key = q.cls + '|' + q.ic + '|' + q.lb;
      if (m._k !== key) { m._k = key; m.className = 'm ' + q.cls; m.children[0].textContent = q.ic; m.children[1].textContent = q.lb; }
    }
    for (let i = n; i < this.marks.length; i++) if (this.marks[i].style.display !== 'none') this.marks[i].style.display = 'none';
  }

  drawSpec(me) {
    const B = this.B, on = !me.alive && !this.g.ended && B.phase !== 'over' && me.deadT >= 1.6;
    if (this.setK('spOn', on)) this.sp.style.display = on ? 'flex' : 'none';
    if (!on) return;
    const tg = B.specTarget();
    if (!this.setK('sp', tg ? tg.id + tg.name : -1)) return;
    this.sp.children[0].textContent = t('bm.out');
    this.sp.children[1].textContent = tg ? t('bm.spec', { n: dispName(tg) }) : t('bm.specNone');
    this.sp.children[2].textContent = tg ? t('bm.specKeys') : t('bm.outSub');
  }

  // dünyadaki bomba modeli + kurulu bombanın ışığı / bipi (aralık: 1 sn → son 10 sn'de 0,12 sn'ye hızlanır)
  drawWorld(dt) {
    const B = this.B, b = B.bomb, m = this.model;
    const fp = this.flyPos(this.v3 ||= new THREE.Vector3());
    if (!fp && this.fl) { this.fl = null; m.rotation.set(0, m.rotation.y, 0); }
    if (fp && (b.st === 'planted' || b.st === 'defused' || b.st === 'exploded' || B.phase === 'prep')) this.fl = null;
    if (this.fl) {                                                                  // 12.229 uçuş: yolda takla atarak (yere değince yuvarlanır)
      m.visible = true; this.light.intensity = 0; this.lampMat.color.set('#5a1410');
      m.position.set(fp.x, fp.y - NADE.r, fp.z);
      m.rotation.x += dt * this.fl.spin; m.rotation.z += dt * this.fl.spin * 0.35;
      return;
    }
    const show = (b.st === 'dropped' || b.st === 'planted' || b.st === 'defused') && B.phase !== 'prep';
    m.visible = show;
    this.blink = Math.max(0, this.blink - dt);
    if (!show) { this.light.intensity = 0; return; }
    m.position.set(b.x, b.y + 0.01, b.z);
    if (b.st === 'dropped') { m.rotation.x = 0; m.rotation.z = 0; m.rotation.y += dt * 0.8; this.lampMat.color.set('#5a1410'); this.light.intensity = 0; return; }
    m.rotation.set(0, b.ry || 0, 0);                                                 // 12.229 kurulu: kuranın koyduğu yönde (tuş takımı ona dönük)
    if (b.st === 'defused') { this.lampMat.color.set('#2bd94a'); this.light.color.set('#2bd94a'); this.light.intensity = 0.6; return; }
    this.light.color.set('#ff3020');
    if (B.live) {
      const left = Math.max(0, B.t), gap = left > 10 ? (left > 20 ? 1.0 : 0.75) : Math.max(0.12, 0.12 + (left / 10) * 0.38);
      if ((this.beepT -= dt) <= 0) { this.beepT = gap; this.blink = Math.min(0.12, gap * 0.5); this.beep(m.position, left < 10); }
    }
    const on = this.blink > 0;
    this.lampMat.color.set(on ? '#ff3b2b' : '#5a1410');
    this.light.intensity = on ? 2.2 : 0;
  }

  // mini harita (Hud.drawMinimap): bölge harfleri, kurulu bomba (yanıp sönen), yerdeki bomba / taşıyanın halkası (saldırana)
  drawMinimap(x, X, Y) { this.mapMarks(x, X, Y, 1, false); }
  // büyük harita (BigMap): aynısı, büyük ölçekte
  drawMap(x, X, Y, D) { this.mapMarks(x, X, Y, D, true); }
  mapMarks(x, X, Y, D, big) {
    const g = this.g, B = this.B, b = B.bomb, me = g.playerSoldier, att = me.team === B.att, now = performance.now();
    for (const s of B.sites) {
      const px = X(s.x), py = Y(s.z), hot = b.st === 'planted' && b.site === s.i, r = (big ? 12 : 6.5) * D;
      x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fillStyle = hot ? 'rgba(255,60,40,.75)' : 'rgba(20,24,32,.7)'; x.fill();
      x.strokeStyle = hot ? '#ffb0a6' : '#ffd36a'; x.lineWidth = 1.6 * D; x.stroke();
      x.fillStyle = '#fff'; x.font = `800 ${(big ? 13 : 8) * D}px Bahnschrift, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s.name, px, py + 0.5 * D);
    }
    const sq = (px, py, col, k = 1) => { const h = (big ? 5 : 3) * D * k; x.fillStyle = col; x.fillRect(px - h, py - h * 0.7, h * 2, h * 1.4); x.strokeStyle = '#000'; x.lineWidth = 1; x.strokeRect(px - h, py - h * 0.7, h * 2, h * 1.4); };
    if (b.st === 'planted' && (now % 600) < 380) sq(X(b.x), Y(b.z), '#ff3b2b', 1.1);
    if (att && b.st === 'dropped') sq(X(b.x), Y(b.z), '#ffd36a');
    if (att && b.st === 'carried' && b.carrier && b.carrier.alive && b.carrier !== me) {
      x.beginPath(); x.arc(X(b.carrier.pos.x), Y(b.carrier.pos.z), (big ? 7 : 4.5) * D, 0, 6.3); x.strokeStyle = '#ffd36a'; x.lineWidth = 1.8 * D; x.stroke();
    }
  }

  dispose() {
    this.st.remove(); this.pips.remove(); this.ban.remove(); this.prepEl.remove(); this.mk.remove(); this.timer.remove(); this.badge.remove(); this.use.remove(); this.sp.remove(); this.siteTag.remove();
    if (this.model) { this.g.scene?.remove(this.model); this.model.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
  }
}
