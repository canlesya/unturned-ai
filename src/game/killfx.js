// Vuruş / öldürme hissi: kendi DOM katmanı (#kfx, HUD kökünün içinde; hud.js düzenine dokunmaz). game.js yalnız hit() / kill() / died() çağırır.
//   • İsabet işareti: hasara göre büyür (az hasar küçük, çok hasar iri), gövde beyaz, kafa altın, öldürmede kırmızı iri X + hafif dönüş
//   • Merkez öldürme bildirimi: kurukafa simgesi + "ELENDİ" / "KAFADAN" rozeti + kurbanın adı + silah + puan; yenisi gelince eskisinin yerini alır
//   • Çoklu öldürme (4,5 sn içinde): ÇİFT / ÜÇLÜ / DÖRTLÜ / KATLİAM; ölmeden seri: 3 / 5 / 7 / 10'da çağrı · öldürme sesi katmanları (notalar yükselir)
//   • Seri sesi (streakSfx.js, 12.148): seri ≥ 2'de her öldürmede yükselen kısa "başarı" sesi (Ayarlar → Ses → Seri sesleri); takım arkadaşı / kendi ölümü sayılmaz
//   • Hafif ekran sarsıntısı + kenar parlaması, öldürme akışında kendi öldürmelerin altın vurgulu; telefonda (body.mob) küçük ve ortadan biraz yukarıda
import { t } from '../i18n/index.js';
import '../i18n/fx.js';
import { playStreak } from './streakSfx.js';

const CSS = `
#kfx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
#kfx .hm{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0;color:#fff}
#kfx .hm i{position:absolute;left:-1.5px;top:-15px;width:3px;height:9px;background:currentColor;border-radius:1px;box-shadow:0 0 3px rgba(0,0,0,.85);transform-origin:1.5px 15px}
#kfx .hm i:nth-child(1){transform:rotate(45deg)}#kfx .hm i:nth-child(2){transform:rotate(135deg)}#kfx .hm i:nth-child(3){transform:rotate(225deg)}#kfx .hm i:nth-child(4){transform:rotate(315deg)}
#kfx .fl{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,transparent 58%,rgba(255,170,90,.32) 100%)}
#kfx .fl.hs{background:radial-gradient(ellipse at center,transparent 58%,rgba(255,70,40,.36) 100%)}
#kfx .nt{position:absolute;left:50%;top:61%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#kfx .sk{font-weight:900;font-size:30px;letter-spacing:4px;font-style:italic;color:#ffd35a;text-shadow:0 0 14px rgba(255,140,30,.65),0 2px 0 #7a3a00,0 3px 8px #000;white-space:nowrap}
#kfx .sk b{display:inline-block;margin-left:10px;padding:0 8px;font-style:normal;font-size:20px;letter-spacing:1px;color:#1a0d00;background:#ffd35a;border-radius:2px;text-shadow:none;transform:translateY(-3px) skewX(-10deg)}
#kfx .sk.sm{font-size:19px;letter-spacing:3px;color:#ffe08a;text-shadow:0 0 8px rgba(255,150,40,.45),0 2px 0 #6a3400,0 3px 6px #000}#kfx .sk.sm b{font-size:15px;margin-left:8px;padding:0 6px;transform:translateY(-1px) skewX(-10deg)}
#kfx .sk.hot{color:#ff6a3a;text-shadow:0 0 16px rgba(255,60,20,.75),0 2px 0 #6a1000,0 3px 8px #000}#kfx .sk.hot b{background:#ff6a3a}
#kfx .cd{display:flex;align-items:center;gap:12px;padding:7px 18px 7px 10px;background:linear-gradient(90deg,rgba(10,13,18,0),rgba(10,13,18,.78) 18%,rgba(10,13,18,.78) 82%,rgba(10,13,18,0));white-space:nowrap}
#kfx .ic{width:34px;height:34px;flex:none;color:#fff;filter:drop-shadow(0 1px 2px #000)}
#kfx .cd.hs .ic{color:#ff5a3a}
#kfx .tx{display:flex;flex-direction:column;align-items:flex-start;line-height:1}
#kfx .lb{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:3px;color:#ffb35c}
#kfx .lb .hb{padding:2px 6px;background:#ff3b2f;color:#fff;letter-spacing:2px;border-radius:2px}
#kfx .nm{font-size:25px;font-weight:800;letter-spacing:1px;margin-top:3px;max-width:260px;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 4px #000}
#kfx .nm.b{color:#9fd0ff}#kfx .nm.r{color:#ffab9a}
#kfx .wp{font-size:12px;font-weight:700;letter-spacing:2px;opacity:.75;margin-top:3px;text-transform:uppercase}
#kfx .pt{font-size:26px;font-weight:900;color:#ffd35a;text-shadow:0 0 10px rgba(255,170,40,.55),0 2px 4px #000;margin-left:6px}
#killfeed .kf.mk{border-right-color:#ffd35a;background:linear-gradient(90deg,rgba(80,52,6,.55),rgba(110,70,8,.86));box-shadow:0 0 10px rgba(255,190,60,.25)}
#killfeed .kf.mk::before{content:'\\2620';margin-right:7px;color:#ffd35a}
#killfeed .kf.md{border-right-color:#ff3b2f;background:rgba(90,14,10,.8)}
body.mob #kfx .nt{top:calc(50% + 50px);zoom:.62}
body.mob #kfx .hm{zoom:1.15}
`;
const SKULL = '<svg class="ic" viewBox="0 0 32 32"><path fill="currentColor" d="M16 2C9 2 4 7 4 13.6c0 3.6 1.6 6.2 4 7.9V26a1 1 0 0 0 1 1h2v-3h2v3h2v-3h2v3h2v-3h2v3h2a1 1 0 0 0 1-1v-4.5c2.4-1.7 4-4.3 4-7.9C28 7 23 2 16 2Zm-5 16.5a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm10 0a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM16 19l2 3.2h-4z"/></svg>';
const HEAD = '<svg class="ic" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="16" cy="16" r="9"/><path d="M16 2v7M16 23v7M2 16h7M23 16h7"/></g><circle cx="16" cy="16" r="2.6" fill="currentColor"/></svg>';
const MULTI_WIN = 4.5;                               // sn: bu süre içinde gelen öldürmeler zincirlenir

export class KillFx {
  constructor(game) {
    this.g = game;
    this.st = document.createElement('style'); this.st.textContent = CSS; document.head.appendChild(this.st);
    const el = (this.root = document.createElement('div'));
    el.id = 'kfx';
    el.innerHTML = '<div class="fl"></div><div class="nt"></div><div class="hm"><i></i><i></i><i></i><i></i></div>';
    (game.hud.root || document.body).appendChild(el);
    this.hm = el.querySelector('.hm'); this.fl = el.querySelector('.fl'); this.nt = el.querySelector('.nt');
    this.multi = 0; this.lastKill = -99; this.streak = 0; this.killT = 0;
    this.streakSfxN = 0; this.lastStreakSfx = null;                       // test: çalınan seri sesi sayısı / son çağrı
  }
  dispose() { this.root.remove(); this.st.remove(); }
  now() { return performance.now() / 1000; }

  // isabet: e = { zone, dead, dmg? } (çevrimiçide dmg gelmez → orta boy)
  hit(e) {
    const head = e.zone === 'head', dead = !!e.dead, dmg = e.dmg ?? 34;
    const s = dead ? 1.55 : 0.8 + Math.min(1, dmg / 100) * 0.55 + (head ? 0.15 : 0);
    if (!dead && this.now() - this.killT < 0.3) return;                    // öldürme X'i ekrandayken sıradan isabet onu ezmesin
    this.hm.style.color = dead ? '#ff3b2f' : head ? '#ffcf3a' : '#ffffff';
    this.hm.getAnimations?.().forEach((a) => a.cancel());
    this.hm.animate(dead
      ? [{ opacity: 1, transform: `scale(${s * 1.35}) rotate(-12deg)` }, { opacity: 1, transform: `scale(${s}) rotate(0deg)`, offset: 0.18 }, { opacity: 1, transform: `scale(${s})`, offset: 0.7 }, { opacity: 0, transform: `scale(${s * 1.1})` }]
      : [{ opacity: 1, transform: `scale(${s * 1.25})` }, { opacity: 1, transform: `scale(${s})`, offset: 0.25 }, { opacity: 0, transform: `scale(${s * 0.92})` }],
    { duration: dead ? 520 : head ? 260 : 190, easing: 'ease-out' });
    if (dead) this.killT = this.now();
    else if (head) this.g.sfx.headshot(); else this.g.sfx.hit(dmg);
  }

  // oyuncu birini öldürdü: bildirim + çağrı + ses + sarsıntı
  kill(victim, weapon, hs, pts) {
    const now = this.now(), g = this.g, me = g.playerSoldier;
    const mate = !g.ffa && !!victim && !!me && victim !== me && victim.team === me.team;    // takım arkadaşı: seriye / çoklu öldürmeye sayılmaz
    if (!mate) { this.multi = now - this.lastKill < MULTI_WIN ? this.multi + 1 : 1; this.lastKill = now; this.streak++; }
    const melee = me?.stat?.kind === 'melee';
    const ss = !mate && g.settings?.streakSound !== false && this.streak >= 2;             // seri sesi: öldürme onayı sabit kalır, yükselen kısım seri sesinde
    g.sfx.kill(hs, g.settings?.streakSound !== false ? 1 : this.multi);                         // kapalıysa eski davranış: çoklu öldürmede onay notaları yükselir
    if (ss && playStreak(g.sfx, this.streak, { multi: this.multi })) { this.streakSfxN++; this.lastStreakSfx = { n: this.streak, multi: this.multi, at: now }; }
    g.effects.shake = Math.max(g.effects.shake || 0, hs ? 0.34 : 0.24);
    this.fl.className = 'fl' + (hs ? ' hs' : '');
    this.fl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    // çağrı: çoklu öldürme önce, yoksa seri dönüm noktası (3 / 5 / 7 / 10 / 15 …), yoksa küçük "SERİ ×n" (seri ≥ 2)
    let call = null, hot = false, sm = false;
    if (mate) { /* çağrı yok */ }
    else if (this.multi >= 2) { call = t('fx.multi' + Math.min(5, this.multi)); hot = this.multi >= 3; }
    else if ([3, 5, 7, 10].includes(this.streak) || (this.streak > 10 && this.streak % 5 === 0)) { call = t('fx.spree' + (this.streak > 10 ? 10 : this.streak)); hot = this.streak >= 5; }
    else if (this.streak >= 2) { call = t('fx.spree'); sm = true; }
    const cls = g.ffa ? 'r' : victim?.team === 'blue' ? 'b' : 'r';
    const lbl = hs ? `<span class="hb">${t('fx.head')}</span>` : melee ? t('fx.melee') : t('fx.elim');
    this.nt.innerHTML = (call ? `<div class="sk${hot ? ' hot' : ''}${sm ? ' sm' : ''}"></div>` : '') +
      `<div class="cd${hs ? ' hs' : ''}">${hs ? HEAD : SKULL}<div class="tx"><div class="lb">${lbl}</div><div class="nm ${cls}"></div><div class="wp"></div></div><div class="pt"></div></div>`;
    this.nt.querySelector('.nm').textContent = victim?.name || '';
    this.nt.querySelector('.wp').textContent = weapon || '';
    this.nt.querySelector('.pt').textContent = t('fx.pts', { n: pts ?? (hs ? 150 : 100) });
    const sk = this.nt.querySelector('.sk');
    if (sk) {
      sk.textContent = call;
      if (this.streak >= 2 && this.multi < 2) { const b = document.createElement('b'); b.textContent = '×' + this.streak; sk.appendChild(b); }
      else if (this.multi >= 2) { const b = document.createElement('b'); b.textContent = '×' + this.multi; sk.appendChild(b); }
      sk.animate([{ opacity: 0, transform: 'scale(1.9)', filter: 'blur(3px)' }, { opacity: 1, transform: 'scale(.94)', filter: 'blur(0)', offset: 0.14 }, { transform: 'scale(1)', offset: 0.22 }, { opacity: 1, offset: 0.8 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 2400, easing: 'ease-out', fill: 'forwards' });
    }
    const cd = this.nt.querySelector('.cd');
    cd.animate([{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'scale(.97)', offset: 0.08 }, { transform: 'scale(1)', offset: 0.14 }, { opacity: 1, offset: 0.82 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 2300, easing: 'ease-out', fill: 'forwards' });
    clearTimeout(this._clr); this._clr = setTimeout(() => { this.nt.innerHTML = ''; }, 2450);
    this.markFeed('mk', hs);
  }
  // oyuncu öldü: seri sıfırlanır, akıştaki satır kırmızı
  died() { this.streak = 0; this.multi = 0; this.markFeed('md'); }
  markFeed(c, hs) { const r = this.g.hud.root?.querySelector('#killfeed')?.lastElementChild; if (r) { r.classList.add(c); if (hs) r.classList.add('hs'); } }
}
