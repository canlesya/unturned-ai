import { InGameSettings } from './ingameSettings.js';
import { SwimHud } from './swimHud.js';
import { CaptureHud } from './captureHud.js';                         // 12.191 ele geçirme göstergesi + bayrak işaretleri
import { WSTATS, CLASS_DEFS, ZTYPES, ZT_ORDER, FRONT_KIT, OPTICS, OPTIC_ALLOWED } from './stats.js';
import { clamp, adsEase, ADS_HUD, SCOPE_ON } from './util.js';
import { codeLabel, slotOrder, SLOT_KEYS } from '../core/keybinds.js';
import { TUNE } from './balance.js';
import { ffaRanking, ffaMetric } from './match.js';
import { ScreenPaint } from './screenPaint.js';
import { paintColorOf, paintIndexOf } from './paint.js';
import { COL as ABCOL } from './abilityfx.js';
import { t as tr } from '../i18n/index.js';
import '../i18n/pb.js';
import { t, onLang, lang } from '../i18n/index.js';
import { mapName, modeLabel, className } from '../i18n/data.js';
import '../i18n/assist.js';                                              // sb.a (12.165 asist sütunu)
import { wName, wLabel, classDesc, ztName, ztDesc, abilName, opticName, fireName, teamName, popText, mapText, dispName, placeName } from '../i18n/game.js';

const EN = (s) => String(s).replace(/Paintball/g, '<span lang="en">Paintball</span>');   // tr büyük harfte 'PAİNTBALL' olmasın (marka adı)
const setH = (el, h) => { if (el._h !== h) { el._h = h; el.innerHTML = h; } };     // yalnız değişince yaz (her kare)
const NADE_SVG = '<svg class="hsi nd" viewBox="0 0 16 16"><ellipse cx="7.5" cy="10" rx="4.6" ry="5.2" fill="currentColor"/><rect x="5.6" y="2.6" width="4" height="2.6" fill="currentColor"/><path d="M9.6 3.6h3.2v3.4" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12.8" cy="8.4" r="1.3" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>';     // 12.144: el bombası öldürmesi
const HS_SVG = '<svg class="hsi" viewBox="0 0 16 16"><circle cx="8" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 0v4M8 10v6M0 7h4M12 7h4" stroke="currentColor" stroke-width="1.6"/></svg>';
const PEN_SVG = '<svg class="hsi pni" viewBox="0 0 16 16"><path d="M1 8h11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10.2 4.6 13.8 8l-3.6 3.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="4.4" y="3" width="1.8" height="10" rx=".6" fill="currentColor" opacity=".55"/><rect x="7.6" y="3" width="1.8" height="10" rx=".6" fill="currentColor" opacity=".55"/></svg>';     // 12.164: delip geçme öldürmesi (ok iki gövdeden geçer)
const FALL_SVG = '<svg class="fli" viewBox="0 0 16 16"><path d="M8 1v9M4.2 6.6 8 10.4l3.8-3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14.2h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';   // düşme (12.143): aşağı ok + zemin
const DROWN_SVG = '<svg class="fli" viewBox="0 0 16 16"><path d="M8 1.6C6 4.6 4 7 4 9.6a4 4 0 0 0 8 0C12 7 10 4.6 8 1.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';   // 12.180 boğuldu: su damlası
const CSS = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:Bahnschrift,'Rajdhani','Arial Narrow','Segoe UI',system-ui,sans-serif;color:#fff;user-select:none;z-index:5;letter-spacing:.5px;
  --acc:#ff8a1f;--acc2:#ffb347;--pan:rgba(9,13,19,.74);--pan2:rgba(14,19,27,.9);--ln:rgba(255,255,255,.12);--dim:rgba(255,255,255,.62)}
#hud *{box-sizing:border-box}
.blue{--c:#4aa3ff}.red{--c:#ff5a43}
#hud .glass{background:var(--pan);border:1px solid var(--ln);backdrop-filter:blur(4px)}
/* üst orta: skor kutuları + süre + bayraklar + pusula */
#topbar{position:absolute;left:50%;top:10px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#score{display:flex;align-items:stretch;height:54px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.45))}
#score .tk{position:relative;min-width:140px;padding:6px 18px 0;font-weight:800;font-size:30px;text-align:center;line-height:1.02;background:linear-gradient(180deg,rgba(16,22,31,.92),rgba(8,11,16,.8));border-top:3px solid var(--c);font-variant-numeric:tabular-nums}
#score .tk small{display:block;font-size:10px;font-weight:700;letter-spacing:3px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;margin:0 auto}
#score .tk .bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.1)}
#score .tk .bar i{display:block;height:100%;background:var(--c);box-shadow:0 0 8px var(--c);transition:width .3s}
#score .tk.blue{color:#a9d4ff;clip-path:polygon(0 0,100% 0,calc(100% - 14px) 100%,0 100%);padding-right:24px}
#score .tk.red{color:#ffbcae;clip-path:polygon(14px 0,100% 0,100% 100%,0 100%);padding-left:24px}
#score .tk.blue .bar i{float:right}
#score .tk.lead{color:#ffd36a;--c:#ffd36a}#score .tk.lead small{opacity:1}#score .tk.tie{color:#e8e8e8}
#timer{position:relative;margin:0 -7px;padding:7px 22px 0;line-height:1.05;font-size:24px;font-weight:800;min-width:100px;text-align:center;background:linear-gradient(180deg,#141b25,#0a0e14);clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,12px 100%);font-variant-numeric:tabular-nums;z-index:1}
#timer::after{content:'';position:absolute;left:16px;right:16px;bottom:0;height:3px;background:var(--acc)}
#timer small{display:block;font-size:10px;font-weight:700;letter-spacing:2px;color:var(--acc2);margin-top:0}
#flags{display:flex;gap:8px}
.flag{width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 50% 35%,rgba(30,38,50,.95),rgba(9,13,19,.85));border:3px solid #888;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;position:relative;box-shadow:0 2px 8px rgba(0,0,0,.5)}
.flag i{position:absolute;inset:-3px;border-radius:50%;-webkit-mask:radial-gradient(circle,transparent 58%,#000 60%);mask:radial-gradient(circle,transparent 58%,#000 60%)}
.flag span{position:relative;z-index:1}
#compass{width:460px;height:30px;position:relative;overflow:hidden;background:linear-gradient(90deg,transparent,rgba(9,13,19,.45) 20%,rgba(9,13,19,.45) 80%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent);mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)}
#compass canvas{width:100%;height:100%;display:block}
/* mini harita */
#mmwrap{position:absolute;left:16px;top:16px;padding:4px 4px 22px;border:1px solid rgba(255,255,255,.16);background:rgba(9,13,19,.78);box-shadow:0 6px 22px rgba(0,0,0,.5)}
#mmwrap::before{content:'';position:absolute;left:-1px;top:-1px;width:16px;height:16px;border-left:3px solid var(--acc);border-top:3px solid var(--acc)}
#mmwrap::after{content:'';position:absolute;right:-1px;bottom:-1px;width:16px;height:16px;border-right:3px solid var(--acc);border-bottom:3px solid var(--acc)}
#minimap{display:block;background:#2a3a1f}
#mmname{position:absolute;left:8px;right:8px;bottom:4px;font-size:11px;font-weight:700;letter-spacing:2px;color:#fff;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mmname b{color:var(--acc2);font-weight:700}
/* öldürme akışı */
#killfeed{position:absolute;right:16px;top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.kf{display:flex;align-items:center;background:linear-gradient(90deg,rgba(9,13,19,.35),rgba(9,13,19,.78) 22%);padding:4px 12px 4px 18px;font-size:15px;animation:kf 6s forwards;white-space:nowrap;border-right:3px solid rgba(255,255,255,.35);font-weight:700}
.kf.me{border-right-color:var(--acc);background:linear-gradient(90deg,rgba(60,34,8,.35),rgba(70,38,8,.85) 22%)}
.kf .b{color:#8cc4ff}.kf .r{color:#ff9a88}
.kf .w{font-size:11px;margin:0 9px;color:#ffe2bd;letter-spacing:1px;padding:1px 7px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);text-transform:uppercase;display:inline-flex;align-items:center;gap:5px}
.kf .w .hsi{width:12px;height:12px;color:#ff6a4a}.kf .w .nd{color:#c9d68a}
.kf .w .fli{width:12px;height:12px;color:#ffb36a}.kf .w .pni{color:#9fe2ff}
@keyframes kf{0%{opacity:0;transform:translateX(24px)}5%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
/* nişan */
#cross{position:absolute;left:50%;top:50%;width:0;height:0}
#cross span{position:absolute;background:#fff;box-shadow:0 0 2px #000}
#cross .h{width:8px;height:2px;top:-1px}#cross .v{width:2px;height:8px;left:-1px}
#cross .l{left:calc(-8px - var(--g,6px))}#cross .r{left:var(--g,6px)}#cross .t{top:calc(-8px - var(--g,6px))}#cross .b{top:var(--g,6px)}
#cross .dot{width:3px;height:3px;left:-1.5px;top:-1.5px;border-radius:50%}
#cross.ads span:not(.dot){display:none}
#rdot{position:absolute;left:50%;top:50%;width:.62vh;height:.62vh;margin:-.31vh 0 0 -.31vh;border-radius:50%;background:#ff3a26;box-shadow:0 0 1.5px .5px #ff2a1ae6,0 0 5px 1px #ff2a1a40;display:none}
#hitm{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;opacity:0;transition:opacity .25s}
#hitm::before,#hitm::after{content:'';position:absolute;left:12px;top:-2px;width:2px;height:30px;background:#fff;transform:rotate(45deg)}
#hitm::after{transform:rotate(-45deg)}
#hitm.k::before,#hitm.k::after{background:#ff3b2f}
/* enfekte: BOSS can çubukları */
#bosses{width:340px;margin-top:4px;pointer-events:none;text-shadow:0 1px 4px #000}
#bosses .bs{margin-bottom:6px;font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#ff6a4a;text-align:center}
#bosses .bs i{font-style:normal;color:#ff9a8a;letter-spacing:1px}
#bosses .bar{height:8px;background:rgba(0,0,0,.5);border:1px solid rgba(255,80,50,.55);margin-top:3px;transform:skewX(-18deg)}
#bosses .bar i{display:block;height:100%;background:linear-gradient(90deg,#8a1010,#ff3a1a);box-shadow:0 0 8px #ff3a1a88;transition:width .25s}
#bosses .dead{opacity:.45}
/* zombi özel gücü */
#abil{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);width:320px;white-space:nowrap;text-align:center;display:none;text-shadow:0 1px 4px #000;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:8px 12px 10px;background:linear-gradient(180deg,rgba(9,13,19,0),rgba(9,13,19,.7));}
#abil .an{font-size:14px;margin-bottom:6px;display:flex;align-items:center;justify-content:center}#abil b{display:inline-block;min-width:22px;padding:2px 7px;margin-right:10px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.4);font-size:12px}
#abil .bar{height:6px;background:rgba(255,255,255,.16);transform:skewX(-18deg)}#abil .bar i{display:block;height:100%;width:100%;background:#8dff5a;box-shadow:0 0 8px #8dff5a88}
#abil.cd .bar i{background:#a8a8a8;box-shadow:none}#abil.on .bar i{background:var(--abc,var(--acc));box-shadow:0 0 10px var(--abc,var(--acc))}#abil.on{color:var(--abc,var(--acc2))}
/* sağlık / sınıf */
#vitals{position:absolute;left:20px;bottom:20px;width:320px;text-shadow:0 1px 4px #000;padding:10px 14px 8px;background:linear-gradient(90deg,rgba(9,13,19,.72),rgba(9,13,19,0));border-left:3px solid var(--acc)}
#vitals .cls{font-size:13px;font-weight:700;letter-spacing:3px;opacity:.95;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#vitals .row{display:flex;align-items:flex-end;gap:12px;margin-top:2px}
#hpnum{font-size:54px;font-weight:800;line-height:.9;min-width:100px;font-variant-numeric:tabular-nums}
#hpnum small{font-size:15px;opacity:.65;margin-left:4px;font-weight:700;letter-spacing:1px}
#hpbar{flex:1;height:12px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.25);transform:skewX(-18deg);margin-bottom:7px;overflow:hidden;position:relative}
#hpbar::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(25% - 2px),rgba(0,0,0,.55) calc(25% - 2px) 25%)}
#hpfill{height:100%;background:linear-gradient(90deg,#3ecf5b,#8be67a);width:100%;transition:width .15s;box-shadow:0 0 10px rgba(110,230,120,.45)}
#stance{margin-top:5px;font-size:12px;letter-spacing:2px;opacity:.85;min-height:15px;text-transform:uppercase;white-space:nowrap}
/* cephane */
#ammo{position:absolute;right:22px;bottom:20px;text-align:right;text-shadow:0 1px 4px #000;padding:8px 14px 0 30px;background:linear-gradient(270deg,rgba(9,13,19,.62),rgba(9,13,19,0));border-right:3px solid var(--acc)}
#ammo .nm{font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.95;margin-bottom:0;color:#ffe2bd}
#ammo .n{font-size:64px;font-weight:800;line-height:.95;font-variant-numeric:tabular-nums}
#ammo .n small{font-size:26px;opacity:.6;font-weight:600}
#ammo .n.low #mag{color:#ff6a4a}
#slots{display:flex;gap:6px;justify-content:flex-end;margin:8px 0 8px}
.slot{padding:4px 10px;background:rgba(9,13,19,.66);font-size:12px;border:1px solid rgba(255,255,255,.14);opacity:.72;letter-spacing:1px;text-transform:uppercase;transform:skewX(-10deg);transition:opacity .15s}
.slot span{display:inline-block;transform:skewX(10deg)}
.slot b{color:var(--acc);margin-right:5px}
.slot.on{border-color:var(--acc);opacity:1;background:linear-gradient(180deg,rgba(110,58,10,.85),rgba(70,38,8,.85));box-shadow:0 0 10px rgba(255,138,31,.35)}
.slot.empty{opacity:.28;text-decoration:line-through}
/* bildirimler */
#toasts{position:absolute;left:50%;top:132px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px}
.toast{padding:7px 20px;background:linear-gradient(90deg,rgba(9,13,19,.2),rgba(9,13,19,.82) 14%,rgba(9,13,19,.82) 86%,rgba(9,13,19,.2));font-weight:700;font-size:17px;letter-spacing:1px;animation:ts 3.2s forwards;border-top:1px solid rgba(255,138,31,.55);border-bottom:1px solid rgba(255,138,31,.55);text-shadow:0 1px 3px #000;white-space:nowrap}
#topbar:has(#bosses:not(:empty)) ~ #toasts{top:184px}      /* enfekte: BOSS çubuklarının altına */
@keyframes ts{0%{opacity:0;transform:translateY(-8px)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
#pops{position:absolute;left:50%;top:56%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
.pop{font-size:22px;font-weight:800;letter-spacing:2px;color:#ffd27a;text-shadow:0 2px 6px #000;animation:pp 1.6s forwards}
.pop.head{color:#ff6a4a}
@keyframes pp{0%{opacity:0;transform:translateY(10px) scale(.8)}12%{opacity:1;transform:none scale(1.08)}80%{opacity:1}100%{opacity:0;transform:translateY(-20px)}}
#msg{position:absolute;left:50%;top:66%;transform:translateX(-50%);font-size:16px;font-weight:700;text-shadow:0 1px 4px #000;opacity:.95;letter-spacing:2px;text-transform:uppercase}
#msg:not(:empty){padding:5px 16px;background:rgba(9,13,19,.55);border-bottom:2px solid var(--acc)}
/* düşman üssü uyarısı */
#zonew{position:absolute;left:50%;top:22%;transform:translateX(-50%);display:none;padding:12px 34px 12px 62px;background:linear-gradient(90deg,rgba(120,14,8,.92),rgba(80,8,4,.88));border-top:2px solid #ff3b2f;border-bottom:2px solid #ff3b2f;font-size:22px;font-weight:800;letter-spacing:3px;text-align:center;animation:zw .6s infinite alternate;white-space:nowrap;clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,14px 100%,0 50%)}
#zonew::before{content:'!';position:absolute;left:24px;top:50%;width:26px;height:26px;margin-top:-13px;border:2px solid #fff;border-radius:50%;font-size:18px;line-height:22px;text-align:center}
#zonew small{display:block;font-size:13px;letter-spacing:2px;font-weight:700;color:#ffd0c8;margin-top:2px}
@keyframes zw{to{background:linear-gradient(90deg,rgba(180,24,12,.95),rgba(120,14,8,.9))}}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(200,0,0,.6) 100%);opacity:0;transition:opacity .4s}
#arrows{position:absolute;left:50%;top:50%;width:0;height:0}
.arrow{position:absolute;left:-14px;top:-130px;width:28px;height:40px;transform-origin:14px 130px;opacity:.9;animation:ar 1.4s forwards}
.arrow::before{content:'';position:absolute;left:0;top:0;border:14px solid transparent;border-bottom:26px solid #ff3b2f;border-top:0}
@keyframes ar{to{opacity:0}}
#holo{position:absolute;left:50%;top:50%;box-sizing:border-box;width:calc(9.47vh + 2px);height:calc(9.47vh + 2px);margin:calc(-4.735vh - 1px) 0 0 calc(-4.735vh - 1px);border-radius:50%;border:2px solid #ff2a1a;box-shadow:0 0 3px #ff2a1a66;display:none}
#holo::before{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#ff2a1a;box-shadow:0 0 2px #ff2a1a88}
#holo i{display:none}      /* 12.139 (BattleBit sade): ince halka + nokta; dış işaretler kalktı (3B halkada yoktu → tam nişanda zıplıyordu). Halka orta çizgisi 9,47vh = 3B halka (r 14,5 mm, göz 0,421 m, ADS_FOV 40) */
/* paintball halka nişangâhı (nişanda): halka = topun o anki sapması (seri atışta büyür), ortada nokta, altta 20 / 30 / 40 m düşüş çizgileri */
#pbret{position:absolute;left:50%;top:50%;width:0;height:0;display:none;--c:#ffe014;--r:10px}
#pbret .rg{position:absolute;left:calc(-1 * var(--r));top:calc(-1 * var(--r));width:calc(2 * var(--r));height:calc(2 * var(--r));border-radius:50%;border:2px solid var(--c);box-sizing:border-box;box-shadow:0 0 0 1px rgba(0,0,0,.55),inset 0 0 0 1px rgba(0,0,0,.45);transition:width .06s,height .06s,left .06s,top .06s}
#pbret .dt{position:absolute;left:-2px;top:-2px;width:4px;height:4px;border-radius:50%;background:var(--c);box-shadow:0 0 0 1px rgba(0,0,0,.7)}
#pbret .m{position:absolute;height:2px;background:var(--c);box-shadow:0 0 0 1px rgba(0,0,0,.55)}
#pbret .m span{position:absolute;font:700 10px/1 Bahnschrift,Arial Narrow,sans-serif;letter-spacing:0;color:#fff;text-shadow:0 0 2px #000,0 0 2px #000,0 1px 1px #000;white-space:nowrap}
#pbret .st{position:absolute;left:-0.5px;width:1px;background:var(--c);opacity:.75;box-shadow:0 0 0 1px rgba(0,0,0,.35)}
body.mob #pbret .rg{border-width:3px}body.mob #pbret .dt{width:6px;height:6px;left:-3px;top:-3px}body.mob #pbret .m{height:2px}body.mob #pbret .m span{font-size:12px}
/* paintball: elenince ekranda "BOYANDIN!" */
#pbdead{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%) rotate(-6deg);font:900 76px/1 Bahnschrift,'Arial Black',Arial,sans-serif;letter-spacing:4px;font-style:italic;-webkit-text-stroke:3px #10131a;paint-order:stroke;text-shadow:0 6px 0 rgba(0,0,0,.35);opacity:0;pointer-events:none;white-space:nowrap}
#pbdead.on{animation:pbd 2s forwards}
@keyframes pbd{0%{opacity:0;transform:translate(-50%,-50%) rotate(-6deg) scale(1.6)}10%{opacity:1;transform:translate(-50%,-50%) rotate(-6deg) scale(.95)}16%{transform:translate(-50%,-50%) rotate(-6deg) scale(1)}75%{opacity:1}100%{opacity:0}}
body.mob #pbdead{font-size:48px;-webkit-text-stroke:2px #10131a}
.toast.pk{font-size:21px;letter-spacing:2px;border-color:currentColor;background:rgba(9,13,19,.8)}
#advig{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.55) 100%)}
#scope{position:absolute;inset:-9vh -9vw;display:none;transform-origin:50% 50%}   /* 12.153: ekrandan taşkın (sürgüde halka kayınca kenar açılmasın) */
#scope .vg{position:absolute;left:50%;top:50%;width:68vh;height:68vh;margin:-34vh 0 0 -34vh;border-radius:50%;background:radial-gradient(circle,transparent 70%,rgba(0,0,0,.38) 100%)}   /* mercek içi hafif vinyet */
#scopeblk{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}   /* dürbüne girerken / çıkarken kısa kararma (göz merceğe yaklaşır) */
#scope .bl{position:absolute;inset:0;backdrop-filter:blur(10px) brightness(.3);-webkit-backdrop-filter:blur(10px) brightness(.3);
  -webkit-mask-image:radial-gradient(circle at center,transparent 35.6vh,#000 35.9vh);mask-image:radial-gradient(circle at center,transparent 35.6vh,#000 35.9vh)}
#scope .rg{position:absolute;left:50%;top:50%;width:72.4vh;height:72.4vh;margin:-36.2vh 0 0 -36.2vh;border-radius:50%;border:.9vh solid #0d0e10;box-sizing:border-box;box-shadow:0 0 0 .25vh #2a2d31,inset 0 0 2.2vh #000c}   /* 12.153: ince halka (eski 3,4 vh kalın kasnak) */
#scope svg{position:absolute;left:50%;top:50%;width:70vh;height:70vh;margin:-35vh 0 0 -35vh}
#scope .ww,#scope.ww .mil{display:none}#scope.ww .ww{display:block}   /* 12.174: dönem dürbünü (2,5× / 4×) — üç direk (German #1 tarzı genel çizim): yan direkler + sivri uçlu alt direk, uç = nişan noktası; ışıyan nokta / mil yok */
/* telefon: dürbün halkası ekran yüksekliğinin %94'ü (kısa ekranda küçük kalıyordu), dışı bulanık değil siyah (tam ekran backdrop-filter telefonda pahalı ve çamurlu) */
body.mob #scope .bl{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(0,0,0,.93);-webkit-mask-image:radial-gradient(circle at center,transparent 46.6vh,#000 47vh);mask-image:radial-gradient(circle at center,transparent 46.6vh,#000 47vh)}
body.mob #scope .rg{width:94vh;height:94vh;margin:-47vh 0 0 -47vh;border-width:1.2vh}
body.mob #scope svg{width:91.6vh;height:91.6vh;margin:-45.8vh 0 0 -45.8vh}
body.mob #scope .vg{width:90vh;height:90vh;margin:-45vh 0 0 -45vh}
body.mob #vitals,body.mob #ammo{background:none;border:0}       /* telefonda arka plan şeridi butonlara binmesin */
/* telefon nişangâhları: küçük yüksek DPI ekranda 5 px nokta / 2 px halka seçilmiyordu → daha büyük, kalın ve ince koyu kenarlı (açık kum / gök
   zemininde de seçilsin), parıltı az (hedefi örtmesin). Boyut: Dokunmatik ayarlar → Hassasiyet → Nişangâh boyutu (--rs, touch.js). Masaüstü aynı. */
#idot{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.7);display:none}
body.mob #idot.on{display:block;transform:scale(var(--rs,1))}      /* demir nişan (yalnız telefonda): silah yarı saydamken ön arpacık seçilmiyor, ortada küçük nokta */
body.mob #rdot{width:max(5px,.5vh);height:max(5px,.5vh);margin:min(-2.5px,-.25vh) 0 0 min(-2.5px,-.25vh);background:#ff2a18;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 3px 1px #ff2a1a66;transform:scale(var(--rs,1))}
body.mob #holo{width:calc(9.47vh + 1.5px);height:calc(9.47vh + 1.5px);margin:calc(-4.735vh - .75px) 0 0 calc(-4.735vh - .75px);border-width:1.5px;box-shadow:0 0 0 1px rgba(0,0,0,.35);transform:scale(var(--rs,1))}      /* 12.139: telefonda da ince (3 px + işaretler + iki koyu kontur kaba duruyordu) */
body.mob #holo::before{width:4.5px;height:4.5px;margin:-2.25px 0 0 -2.25px;box-shadow:0 0 0 1px rgba(0,0,0,.45)}
/* 12.127: telefon #holo eskiden sabit 78 px (3B çerçevenin ≈ 2,5 katı, iki halka üst üste): artık 3B çerçeveyle aynı 9,2vh (ADS_FOV 40) × nişangâh boyutu ayarı (--rs); red dot en az 9 px */
/* telefon dürbünü: çizgiler ≈ 2 kat kalın, merkez noktası büyük (halka 94vh, 1 birim ≈ 2 px) */
body.mob #scope .mil g path:first-child{stroke-width:.6}body.mob #scope .mil g path:nth-child(3){stroke-width:.7}
body.mob #scope svg>circle{transform:scale(1.9)}   /* yalnız kırmızı merkez (mil noktaları ölçeklenirse dışa kayar) */
/* katmanlar: duraklat, ölüm, skor, maç sonu */
.overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(ellipse at center,rgba(5,8,12,.5),rgba(5,8,12,.82));pointer-events:auto}
.overlay.intro{background-color:#05080c;background-size:cover;background-position:center}
.overlay.intro .panel{background:rgba(8,11,17,.82);backdrop-filter:blur(3px);min-width:460px;padding:26px 36px}
.pm{margin:2px 0 10px}.pm b{display:block;font-size:22px;letter-spacing:3px;text-transform:uppercase;color:var(--acc2)}.pm span{font-size:12px;letter-spacing:2px;opacity:.7;text-transform:uppercase}
.pdesc{max-width:520px;font-size:13px;line-height:1.5;opacity:.8;margin:2px 0 14px}
.panel{position:relative;background:linear-gradient(180deg,rgba(15,20,29,.96),rgba(9,12,18,.96));border:1px solid rgba(255,255,255,.12);border-top:3px solid var(--acc);padding:24px 32px;min-width:400px;max-width:94vw;box-shadow:0 18px 60px rgba(0,0,0,.65);clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%)}
.panel h2{margin:0 0 6px;font-size:34px;letter-spacing:4px;text-transform:uppercase;font-style:italic}.panel p{margin:4px 0;opacity:.85}
.btn{pointer-events:auto;cursor:pointer;background:linear-gradient(100deg,#ffb347,#ff7a12);color:#160a02;border:0;padding:11px 26px;font:inherit;font-size:17px;font-weight:800;margin:12px 8px 0 0;letter-spacing:3px;text-transform:uppercase;clip-path:polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%)}
.btn.sec{background:#26303e;color:#e8edf5}.btn:hover{filter:brightness(1.15)}
/* duraklat menüsü: dikey düğme listesi */
#pause .panel{min-width:440px;width:min(500px,94vw);padding:26px 34px 28px}
#pause .ptag{font-size:11px;letter-spacing:3px;color:var(--acc2);text-transform:uppercase;font-weight:700;margin-bottom:4px}
#pause .pbtns{display:flex;flex-direction:column;gap:8px;margin-top:16px}
#pause .pbtns .btn{margin:0;width:100%;text-align:left;padding:12px 20px;clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%)}
#pause .pbtns .btn.sec{background:linear-gradient(90deg,#222b38,#1a212c);border-left:3px solid transparent;transition:border-color .12s,background .12s}
#pause .pbtns .btn.sec:hover{border-left-color:var(--acc);background:linear-gradient(90deg,#2c3747,#1f2733);filter:none}
#pause #bQuit{color:#ffb3a6}
#pause #ptext{font-size:14px;opacity:.75}
#presume{position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;background:rgba(5,8,12,.28);animation:prsIn .15s .12s both}
#presume .pr{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 30px 12px;background:rgba(9,13,19,.9);border:1px solid rgba(255,255,255,.16);border-top:3px solid var(--acc,#ff8a1f);box-shadow:0 10px 34px rgba(0,0,0,.55);clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}
#presume .pr b{font-size:20px;letter-spacing:2px;text-transform:uppercase;font-style:italic}
#presume .pr b::before{content:'';display:inline-block;margin-right:10px;border-left:12px solid var(--acc,#ff8a1f);border-top:8px solid transparent;border-bottom:8px solid transparent;vertical-align:1px}
#presume .pr span{font-size:12px;letter-spacing:1.5px;opacity:.6}
@keyframes prsIn{from{opacity:0}}
/* ölüm / yeniden doğuş ekranı */
#respawn{background:radial-gradient(ellipse at 50% 30%,rgba(70,8,6,.35),rgba(5,8,12,.86) 75%)}
#respawn .dep{display:flex;flex-direction:column;gap:14px;width:min(1180px,94vw)}
#respawn .card{background:linear-gradient(180deg,rgba(15,20,29,.94),rgba(9,12,18,.94));border:1px solid rgba(255,255,255,.1);padding:14px 18px}
#respawn h3{margin:0 0 10px;font-size:12px;letter-spacing:3px;color:var(--acc2);text-transform:uppercase;white-space:nowrap}
#respawn h3 span{opacity:.6;letter-spacing:1px;text-transform:none;color:#fff}
#rkill{display:flex;align-items:stretch;gap:0;padding:0;border-top:3px solid #ff3b2f;overflow:hidden;position:relative}
#rkill .kl{flex:1;min-width:0;padding:14px 20px;background:linear-gradient(90deg,rgba(255,59,47,.16),transparent 70%)}
#rkill .kh{font-size:11px;letter-spacing:3px;color:#ff8f80;font-weight:700;text-transform:uppercase}
#rtitle{font-size:30px;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-style:italic;margin:2px 0 0;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rtitle.b{color:#8cc4ff}#rtitle.r{color:#ff9a88}
#rksub{font-size:13px;letter-spacing:2px;opacity:.75;text-transform:uppercase;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rkill .kw,#rkill .kd,#rkill .kp{padding:14px 20px;border-left:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;justify-content:center;min-width:150px}
#rkill .kv{font-size:24px;font-weight:800;letter-spacing:1px;white-space:nowrap;line-height:1.1}#rkill #rkw{text-transform:uppercase}
#rkill .kl2{font-size:10px;letter-spacing:3px;opacity:.6;text-transform:uppercase;margin-bottom:4px;white-space:nowrap}
#rkill .hs{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:2px 8px;font-size:11px;font-weight:800;letter-spacing:2px;color:#1a0602;background:#ff6a4a;align-self:flex-start;text-transform:uppercase}
#rkill .hs .hsi{width:12px;height:12px}
#rkill .hpb{height:6px;background:rgba(255,255,255,.12);margin-top:7px;transform:skewX(-18deg)}#rkill .hpb i{display:block;height:100%;background:linear-gradient(90deg,#3ecf5b,#8be67a)}
#rkill.self .kw,#rkill.self .kd,#rkill.self .kp{display:none}
#rkill.self{border-top-color:#9aa0a8}#rkill.self .kl{background:linear-gradient(90deg,rgba(255,255,255,.06),transparent 70%)}
#rinfo{margin:0;padding:10px 20px;font-size:14px;opacity:.95;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.18)}
#rinfo:empty{display:none}
#respawn .deploy{display:flex;gap:14px;align-items:stretch;justify-content:center}
#respawn .ccls{flex:1;min-width:0}
#respawn .cspn{width:250px;flex:none}
#respawn .ccnt{flex:none;display:flex;align-items:center;gap:14px;padding:10px 22px 10px 18px;border-left:1px solid rgba(255,255,255,.08);background:rgba(255,138,31,.06)}
#respawn .ring{position:relative;width:84px;height:84px;flex:none}
#respawn .ring svg{width:100%;height:100%;transform:rotate(-90deg)}
#respawn .ring circle{fill:none;stroke-width:7}
#respawn .ring .bg{stroke:rgba(255,255,255,.1)}#respawn .ring .fg{stroke:var(--acc);stroke-linecap:butt;filter:drop-shadow(0 0 6px rgba(255,138,31,.6));transition:stroke-dashoffset .2s linear}
#rcount{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;color:#fff;line-height:1;font-variant-numeric:tabular-nums}
#hcnt{color:var(--acc2);opacity:1}
#rcsub{font-size:12px;letter-spacing:2px;opacity:.75;text-transform:uppercase;max-width:110px;line-height:1.3}
#respawn .clsrow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
#frkit{display:none;margin-top:8px;gap:8px 14px;flex-wrap:wrap;align-items:center}#frkit.on{display:flex}#frkit .fl{font-size:11px;letter-spacing:2px;opacity:.6;text-transform:uppercase;margin-right:2px}
#frkit .fg{display:flex;gap:5px;flex-wrap:wrap;align-items:center}#frkit .cc{padding:5px 9px}#frkit .cc b{font-size:12px;letter-spacing:1px}#frkit .cc.on{border-color:var(--acc);background:rgba(255,138,31,.16)}   /* 12.174: Cephe doğuş ekranı silah + dönem nişangâhı */
.cc{pointer-events:auto;cursor:pointer;position:relative;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.12);padding:10px 12px;font-size:13px;text-align:left;transition:.12s}
.cc b{display:block;font-size:15px;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc b u{text-decoration:none;display:inline-block;min-width:18px;padding:0 4px;margin-right:6px;font-size:11px;line-height:16px;text-align:center;background:rgba(255,255,255,.12);color:var(--acc2);vertical-align:2px}
.cc small{opacity:.7;display:block;margin-top:4px;line-height:1.3}
.cc em{display:block;font-style:normal;margin-top:6px;font-size:11px;letter-spacing:1px;color:#ffe2bd;text-transform:uppercase;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc.on{border-color:var(--acc);background:linear-gradient(180deg,rgba(255,138,31,.26),rgba(255,138,31,.1));box-shadow:inset 0 -3px 0 var(--acc)}
.cc:hover{background:rgba(255,255,255,.12)}
.cc.dis{opacity:.4;pointer-events:none}
#spawnrow{display:flex;flex-direction:column;gap:6px}
#spawnrow .cc b{font-size:14px}
/* skor tablosu */
#scoreboard .panel{min-width:760px;text-align:center;padding:20px 26px}
#scoreboard .sbh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin:0 6px 12px;text-transform:uppercase;letter-spacing:3px}
#scoreboard .sbh b{font-size:20px;font-style:italic}#scoreboard .sbh span{font-size:12px;opacity:.65}
#scoreboard .cols{display:flex;gap:16px;justify-content:center;align-items:flex-start}
#scoreboard table{border-collapse:collapse;width:100%;font-size:15px;counter-reset:rk}
#scoreboard td,#scoreboard th{padding:5px 10px;text-align:right;font-variant-numeric:tabular-nums}
#scoreboard th{font-size:10px;letter-spacing:2px;opacity:.55;text-transform:uppercase;font-weight:700}
#scoreboard td:first-child,#scoreboard th:first-child{text-align:left}
#scoreboard tr+tr{counter-increment:rk;border-top:1px solid rgba(255,255,255,.05)}
#scoreboard tr+tr td:first-child::before{content:counter(rk);display:inline-block;width:22px;opacity:.45;font-size:12px}
#scoreboard tr+tr:nth-child(odd){background:rgba(255,255,255,.025)}
#scoreboard .team{flex:1;min-width:330px;max-width:520px;background:rgba(0,0,0,.18);border-top:3px solid var(--c)}
#scoreboard h3{margin:0;padding:8px 12px;letter-spacing:3px;text-transform:uppercase;display:flex;justify-content:space-between;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 28%,transparent),transparent)}
#scoreboard h3 em{font-style:normal;font-size:22px;line-height:1}
#scoreboard tr.me{background:rgba(255,138,31,.24)!important;font-weight:700;box-shadow:inset 3px 0 0 var(--acc)}
#scoreboard tr.dead{opacity:.5}
#scoreboard .scroll{max-height:62vh;overflow:auto}
#endscreen .panel{text-align:center;min-width:560px}
#etitle{font-size:64px!important;letter-spacing:8px!important}
#estats .mvp{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0}
#estats .st{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);padding:8px 16px}
#estats .st b{display:block;font-size:26px;color:var(--acc2)}
#estats .st small{font-size:11px;letter-spacing:2px;opacity:.7;text-transform:uppercase}
/* küçük ekran (telefon yatay): ölüm ekranı, duraklat ve skor tablosu sığsın */
@media (max-height:520px){
#respawn .dep{gap:6px;width:96vw;max-height:96vh}
#respawn .card{padding:7px 9px}
#respawn h3{font-size:10px;letter-spacing:2px;margin-bottom:5px}
#rkill .kl{padding:7px 12px}#rkill .kw,#rkill .kd,#rkill .kp{padding:7px 12px;min-width:0}
#rtitle{font-size:19px}#rksub{font-size:10px;letter-spacing:1px}#rkill .kh,#rkill .kl2{font-size:9px;letter-spacing:2px;margin-bottom:1px}
#rkill .kv{font-size:15px}#rkill .hs{margin-top:3px;font-size:9px;padding:1px 6px}
#rinfo{font-size:11px;padding:4px 12px}
#respawn .deploy{gap:6px}
#respawn .cspn{width:150px}#respawn .ccnt{padding:5px 10px;gap:8px}
#respawn .ring{width:50px;height:50px}#rcount{font-size:24px}#rcsub{font-size:9px;letter-spacing:1px;max-width:80px}
#respawn .clsrow{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
#respawn .cc{padding:5px 7px;font-size:11px;min-height:40px}#respawn .cc b{font-size:12px;letter-spacing:1px}#respawn .cc small{font-size:10px;line-height:1.2;margin-top:2px}
#respawn .cc em{display:none}#respawn .cc b u{display:none}
#spawnrow{gap:4px}#spawnrow .cc{padding:5px 7px}
#scoreboard .panel{min-width:0!important;width:96vw;max-height:92vh;padding:8px 10px}
#scoreboard .sbh{margin:0 4px 6px}#scoreboard .sbh b{font-size:14px}#scoreboard .sbh span{font-size:10px}
#scoreboard .cols{gap:8px}#scoreboard .team{min-width:0}
#scoreboard h3{padding:4px 8px;font-size:12px}#scoreboard h3 em{font-size:15px}
#scoreboard table{font-size:11px}#scoreboard td,#scoreboard th{padding:2px 6px}
#scoreboard .scroll{max-height:80vh;overflow:auto}
.overlay .panel{max-width:96vw}
#pause .panel{min-width:0;width:min(560px,92vw);max-height:94vh;overflow:auto;padding:12px 18px 14px}
#pause .panel h2{font-size:22px;margin-bottom:2px}#pause #ptext{font-size:12px}#pause .pdesc{display:none}.pm{margin:0 0 4px}.pm b{font-size:16px}
#pause .pbtns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
#pause .pbtns .btn{padding:8px 14px;font-size:14px;min-height:40px}
#pause .pbtns #bResume{grid-column:1/-1}
}
`;

export class Hud {
  constructor(game) {
    this.game = game;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.st = st;
    const el = (this.root = document.createElement('div'));
    el.id = 'hud';
    el.innerHTML = `
      <div id="scope"><div class="bl"></div><div class="vg"></div><div class="rg"></div>
        <svg viewBox="-100 -100 200 200" class="mil"><g stroke="#000" fill="none"><path d="M-100 0H-1.6M1.6 0H100M0 -100V-1.6M0 1.6V100" stroke-width=".3"/><path d="M-100 0H-58M58 0H100M0 -100V-58M0 58V100" stroke-width="1.5"/><path d="M-5 0V0M5 0V0M-15 -1.4V1.4M15 -1.4V1.4M-25 -1.4V1.4M25 -1.4V1.4M-35 -1.4V1.4M35 -1.4V1.4M-1.4 -15H1.4M-1.4 15H1.4M-1.4 -25H1.4M-1.4 25H1.4M-1.4 -35H1.4M-1.4 35H1.4" stroke-width=".35"/><g fill="#000" stroke="none"><circle cx="-40" r=".75"/><circle cy="-40" r=".75"/><circle cx="-30" r=".75"/><circle cy="-30" r=".75"/><circle cx="-20" r=".75"/><circle cy="-20" r=".75"/><circle cx="-10" r=".75"/><circle cy="-10" r=".75"/><circle cx="10" r=".75"/><circle cy="10" r=".75"/><circle cx="20" r=".75"/><circle cy="20" r=".75"/><circle cx="30" r=".75"/><circle cy="30" r=".75"/><circle cx="40" r=".75"/><circle cy="40" r=".75"/></g></g><circle r=".55" fill="#ff3b2a"/></svg>
        <svg viewBox="-100 -100 200 200" class="ww"><g fill="#08090a"><path d="M-101 -1.6H-13L-9.5 -0.45V0.45L-13 1.6H-101Z"/><path d="M101 -1.6H13L9.5 -0.45V0.45L13 1.6H101Z"/><path d="M-1.9 101V6.5L0 0L1.9 6.5V101Z"/></g></svg></div>
      <div id="mmwrap"><canvas id="minimap" width="236" height="168"></canvas><div id="mmname"></div></div>
      <div id="topbar">
        <div id="score"><div class="tk blue"><small id="tnB"></small><span id="tkB">0</span><div class="bar"><i id="tbB"></i></div></div><div id="timer"><span id="tm">0:00</span><small id="lim"></small></div><div class="tk red"><small id="tnR"></small><span id="tkR">0</span><div class="bar"><i id="tbR"></i></div></div></div>
        <div id="flags"></div>
        <div id="compass"><canvas width="920" height="60"></canvas></div>
        <div id="bosses"></div>
      </div>
      <div id="killfeed"></div>
      <div id="toasts"></div>
      <div id="vig"></div><div id="arrows"></div>
      <div id="advig"></div><div id="scopeblk"></div>

      <div id="cross"><span class="h l"></span><span class="h r"></span><span class="v t"></span><span class="v b"></span><span class="dot"></span></div>
      <div id="pbret"><i class="st"></i><i class="rg"></i><i class="dt"></i><b class="m"><span>20</span></b><b class="m"><span>30</span></b><b class="m"><span>40</span></b></div><div id="rdot"></div><div id="idot"></div><div id="holo"><i></i><i></i><i></i><i></i></div><div id="hitm"></div>
      <div id="pops"></div><div id="zonew"><span id="zonett"></span><small id="zonet"></small></div><div id="msg"></div>
      <div id="vitals"><div class="cls" id="clsname"></div><div class="row"><div id="hpnum">100</div><div id="hpbar"><div id="hpfill"></div></div></div><div id="stance"></div></div>
      <div id="abil"><div class="an"><b id="abk">F</b><span id="abn"></span></div><div class="bar"><i id="abbar"></i></div></div>
      <div id="ammo"><div class="nm" id="wname"></div><div class="n"><span id="mag">0</span> <small id="res">/ 0</small></div><div id="slots"></div></div>
      <div id="respawn" class="overlay"><div class="dep">
        <div class="card" id="rkill"><div class="kl"><div class="kh" id="rkh"></div><div id="rtitle"></div><div id="rksub"></div></div>
          <div class="kw"><div class="kl2" id="rkwl"></div><div class="kv" id="rkw"></div><div id="rkhs"></div></div>
          <div class="kd"><div class="kl2" id="rkdl"></div><div class="kv" id="rkd"></div></div>
          <div class="kp"><div class="kl2" id="rkpl"></div><div class="kv" id="rkp"></div><div class="hpb"><i id="rkpb"></i></div></div>
          <div class="ccnt"><div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" id="rring" cx="50" cy="50" r="44" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><div id="rcount"></div></div><div><div class="kl2" id="hcnt"></div><div id="rcsub"></div></div></div></div>
        <p id="rinfo"></p>
        <div class="deploy">
          <div class="card ccls"><h3><span id="hcls" style="opacity:1;letter-spacing:3px;text-transform:uppercase;color:inherit"></span> <span id="hclsk">(1–5)</span></h3><div class="clsrow" id="clsrow"></div><div id="frkit"></div></div>
          <div class="card cspn"><h3><span id="hspn" style="opacity:1;letter-spacing:3px;text-transform:uppercase;color:inherit"></span> <span id="spkeys"></span></h3><div id="spawnrow"></div></div>
        </div></div></div>
      <div id="scoreboard" class="overlay"><div class="panel"><div class="scroll" id="sbbody"></div></div></div>
      <div id="pause" class="overlay"><div class="panel"><div class="ptag" id="ptag"></div><h2 id="ptitle"></h2><div id="pmeta"></div><p id="ptext"></p>
        <div class="pbtns"><button class="btn" id="bResume"></button><button class="btn sec" id="bKill"></button><button class="btn sec" id="bSet"></button><button class="btn sec" id="bCtl"></button><button class="btn sec" id="bQuit"></button></div></div></div>
      <div id="presume"><div class="pr"><b id="prT"></b><span id="prS"></span></div></div>
      <div id="endscreen" class="overlay"><div class="panel"><h2 id="etitle"></h2><p id="einfo"></p><div id="estats" style="margin:10px 0"></div>
        <button class="btn" id="bAgain"></button><button class="btn sec" id="bMenu"></button></div></div>`;
    document.body.appendChild(el);
    this.$ = (id) => el.querySelector('#' + id);
    this.flagEls = [];
    for (const o of game.mode.objectives) {
      const f = document.createElement('div');
      f.className = 'flag'; f.innerHTML = `<i></i><span>${o.label || o.name[0]}</span>`; f.title = o.name; f._nm = o.name;
      this.$('flags').appendChild(f);
      this.flagEls.push(f);
    }
    this.cap = game.mode.objectives.length ? new CaptureHud(this) : null;
    this.mm = this.$('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.buildMinimapBase();
    this.hitT = 0; this.sel = null; this.zoneT = 0; this.cmp = this.root.querySelector('#compass canvas').getContext('2d');
    this.maxTk = game.ffa ? game.mode.killLimit : game.mode.infection ? game.mode.total : game.mode.tickets;
    if (game.mode.fixed) {                                                // Silah Yarışı / Paintball: sınıf/doğma seçimi yok
      this.$('spawnrow').parentElement.style.display = 'none'; this.$('clsrow').parentElement.style.display = 'none';
    }
    if (game.mode.infection) {                                            // Enfekte: sol = insanlar, sağ = zombiler; ölüm ekranında doğma seçimi yok
      this.$('spawnrow').parentElement.style.display = 'none';
      this._rowMode = null;                                                // ölüm ekranı satırı: 'z' zombi türü · 'cls' insan sınıfı · 'boss' (seçim yok)
    }
    this.death = null;                                                     // son ölüm: { k: öldüren, w: silah adı, hs, d: mesafe m }
    this.applyLang();
    this._offLang = onLang(() => this.applyLang());                        // canlı dil değişimi: sabit etiketler + satırlar yeniden yazılır
    this.$('bResume').onclick = () => { this.igs?.close(); game.requestLock(); };
    this.$('bSet').onclick = () => (this.igs ||= new InGameSettings(game)).show('settings');
    this.$('bCtl').onclick = () => (this.igs ||= new InGameSettings(game)).show('controls');
    this.$('bKill').onclick = () => { game.requestKill(); game.requestLock(); };
    this.$('bQuit').onclick = () => game.exit();
    this.$('bAgain').onclick = () => game.restart();
    this.$('bMenu').onclick = () => game.exit();
    this.$('pause').addEventListener('mousedown', (e) => { if (e.target.id === 'pause') game.requestLock(); });
    this.$('presume').addEventListener('mousedown', (e) => { if (e.button === 0) game.requestLock(); });      // 12.147: tek tık → kilit, oyun sürer
    this.pbMarks = [...this.root.querySelectorAll('#pbret .m')]; this._pbKey = '';
    game.on('spawn', (s) => { if (s === game.playerSoldier) this._sp?.clear(); });
  }

  // Paintball ekran boyası (ilk boya isabetinde kurulur; normal modlarda hiç oluşmaz)
  get sp() { return this._sp || (this._sp = new ScreenPaint(this.game, this.root)); }
  paintHit(by, zone, col) { this.sp.hit(by, zone, col); }
  paintNear(sx, sy, col) { this.sp.nearMiss(sx, sy, col); }
  pickupToast(text, color) {
    const t = document.createElement('div'); t.className = 'toast pk'; t.textContent = text; t.style.color = color;
    this.$('toasts').prepend(t);
    setTimeout(() => t.remove(), 3300);
  }

  // Dile bağlı sabit metinler (kurulumda ve dil değişince)
  applyLang() {
    const g = this.game, $ = this.$;
    $('tnB').textContent = g.mode.infection ? t('hud.humansUp') : g.ffa ? t('hud.you') : t('hud.blue');
    $('tnR').textContent = g.mode.infection ? t('hud.zombiesUp') : g.ffa ? t('hud.leader') : t('hud.red');
    this._ffaKey = null; this._bossKey = null; this._spKey = null; this._loc = null; this._slotKey = null; this._note = null;
    $('zonett').textContent = t('hud.zone.title');
    $('bResume').textContent = t('pause.start'); $('bKill').textContent = t('pause.kill'); $('bKill').title = t('pause.killTip');
    $('bSet').textContent = t('pause.settings'); $('bCtl').textContent = t('pause.controls'); $('bQuit').textContent = t('pause.menu');
    $('bAgain').textContent = t('pause.again'); $('bMenu').textContent = t('pause.menu');
    $('prT').textContent = t('pause.clickResume'); $('prS').textContent = t('pause.escMenu');
    $('hcls').textContent = t('death.pickClass'); $('hspn').textContent = t('death.spawn'); $('hcnt').textContent = t('death.deploy');
    $('rkwl').textContent = t('death.weapon'); $('rkdl').textContent = t('death.dist'); $('rkpl').textContent = t('death.hpLeft');
    this.flagEls.forEach((f) => (f.title = placeName(f._nm)));
    this.buildClassRow();
    if (g.mode.infection) { const m = this._rowMode; this._rowMode = null; if (m) this.setRowMode(m); }
    this.updateLocation(true);
    if (this.mmBase && g.map.callouts) this.buildMinimapBase();
    const pv = $('pause').style.display === 'flex';
    if (pv) this.setPaused(true);
    if (this.sbShown) this.renderScoreboard();
    this.igs?.open && this.igs.render();
  }

  dispose() { this.cap?.dispose(); this._offLang?.(); this.igs?.dispose(); this.root.remove(); this.st.remove(); }

  // Enfekte: ölüm ekranında zombi türü seçimi (1–5)
  buildZRow() {
    const row = this.$('clsrow');
    row.innerHTML = '';
    ZT_ORDER.forEach((k, i) => {
      const c = document.createElement('div');
      c.className = 'cc'; c.dataset.k = k;
      c.innerHTML = `<b><u>${i + 1}</u>${ztName(k)}</b><small>${ztDesc(k)}</small>`;
      c.onclick = () => this.game.requestZType(k);
      row.appendChild(c);
    });
  }
  // Enfekte ölüm ekranı: bir sonraki doğuşa göre satırı kur (zombi türü / insan sınıfı / boss)
  setRowMode(m) {
    if (m === this._rowMode) return;
    this._rowMode = m;
    const h = this.$('hcls'), k = this.$('hclsk');
    k.style.display = m === 'boss' ? 'none' : '';
    if (m === 'cls') { this.buildClassRow(); h.textContent = t('death.humanClass'); }
    else if (m === 'boss') { this.$('clsrow').innerHTML = `<div class="cc on"><b>BOSS</b><small>${t('death.bossDesc')}</small></div>`; h.textContent = t('death.zType'); }
    else { this.buildZRow(); h.textContent = t('death.zType'); }
  }
  markZ(k) { this.$('clsrow').querySelectorAll('.cc').forEach((c) => c.classList.toggle('on', c.dataset.k === k)); }

  buildClassRow() {
    const row = this.$('clsrow'), team = this.game.playerSoldier?.team || 'blue';
    row.innerHTML = '';
    Object.entries(CLASS_DEFS).forEach(([k, d], i) => {
      const c = document.createElement('div');
      const fk = this.game.mode.front && !d.zombie ? FRONT_KIT[k] : null;      // 12.174: Cephe'de 1940'lar silahı
      const pri = fk ? (this.game.opts.frontLoadouts?.[k]?.primary && fk.primary.includes(this.game.opts.frontLoadouts[k].primary) ? this.game.opts.frontLoadouts[k].primary : fk.d[team] || fk.d.blue) : d.primary?.[team] || d.primary?.blue, gd = fk ? null : d.gadget;
      c.className = 'cc'; c.dataset.k = k;
      c.innerHTML = `<b><u>${i + 1}</u>${className(k)}</b><small>${classDesc(k)}</small><em>${EN(pri ? wName(pri) : '')}${gd && gd[1] ? ` · ${wName(gd[0])} ×${gd[1]}` : ''}</em>`;
      c.onclick = () => this.game.requestClass(k);
      row.appendChild(c);
    });
  }

  // + puan / bildirim
  popup(text, head = false) {
    const d = document.createElement('div'); d.className = 'pop' + (head ? ' head' : ''); d.textContent = popText(text);
    const box = this.$('pops'); box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.remove(), 1700);
  }

  zoneWarn(left) {
    this.zoneT = 0.25;
    const z = this.$('zonew'); z.style.display = 'block';
    if (this._oob) { this._oob = false; this.$('zonett').textContent = t('hud.zone.title'); }
    this.$('zonet').textContent = left > 0 ? t('hud.zone.back', { n: Math.ceil(left) }) : t('hud.zone.hurt');
  }

  // 12.172 savaş alanı sınırı (büyük harita): aynı uyarı kutusu, başka başlık
  oobWarn(left) {
    this.zoneT = 0.25;
    this.$('zonew').style.display = 'block';
    if (!this._oob) { this._oob = true; this.$('zonett').textContent = t('hud.oob.title'); }
    this.$('zonet').textContent = t('hud.oob.back', { n: Math.ceil(left) });
  }

  onPlayerSpawn() { this._spKey = null; }
  swimHint() { (this.swim ||= new SwimHud(this)).hint(); }

  markSpawn(id) { this.$('spawnrow').querySelectorAll('.cc').forEach((c) => c.classList.toggle('on', c.dataset.k === id)); }

  buildSpawnRow() {
    const g = this.game, row = this.$('spawnrow');
    const opts = g.spawnOptions();
    const key = opts.map((o) => o.id + (o.ok ? 1 : 0)).join(',') + '|' + g.spawnChoice;
    if (key === this._spKey) return;
    this._spKey = key;
    const kb = g.binds;
    this.$('spkeys').textContent = `(${codeLabel(kb.codes('leanLeft')[0])} / ${codeLabel(kb.codes('leanRight')[0])})`;
    row.innerHTML = '';
    for (const o of opts) {
      const c = document.createElement('div');
      c.className = 'cc' + (o.ok ? '' : ' dis') + (g.spawnChoice === o.id ? ' on' : ''); c.dataset.k = o.id;
      c.innerHTML = `<b>${o.id === 'base' ? '⌂ ' + t('death.base') : '⚑ ' + placeName(o.name)}</b><small>${o.id === 'base' ? t('death.baseSafe') : o.ok ? t('death.flagOwned') : t('death.unavail')}</small>`;
      c.onclick = () => { g.requestSpawn(o.id); this._spKey = null; };
      row.appendChild(c);
    }
    if (!opts.find((o) => o.id === g.spawnChoice && o.ok)) g.spawnChoice = 'base';
  }

  drawCompass() {
    const g = this.game, p = g.playerSoldier, x = this.cmp, W = 920, H = 60;   // ±90°
    x.clearRect(0, 0, W, H);
    const bearing = ((-p.yaw * 180) / Math.PI % 360 + 360) % 360;
    const dirs = t('hud.cmp').split(',');                                    // K,KD,D,GD,G,GB,B,KB  ·  N,NE,E,SE,S,SW,W,NW
    x.font = 'bold 22px Bahnschrift, Arial Narrow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 5) {
      let rel = ((d - bearing + 540) % 360) - 180;
      if (Math.abs(rel) > 95) continue;
      const px = W / 2 + (rel / 180) * W;
      const major = d % 45 === 0, mid = d % 15 === 0;
      x.fillStyle = major ? '#fff' : 'rgba(255,255,255,.5)';
      x.fillRect(px - 1, major ? 6 : mid ? 12 : 17, 2, major ? 14 : mid ? 10 : 6);
      if (major) { x.fillStyle = d === 0 ? '#ff8a1f' : '#fff'; x.fillText(dirs[d / 45], px, 40); }
      else if (mid && Math.abs(rel) > 6) { x.font = '600 13px Bahnschrift, Arial Narrow, sans-serif'; x.fillStyle = 'rgba(255,255,255,.45)'; x.fillText(String(d), px, 40); x.font = 'bold 22px Bahnschrift, Arial Narrow, sans-serif'; }
    }
    for (const o of g.mode.objectives) {
      const brg = (Math.atan2(o.x - p.pos.x, -(o.z - p.pos.z)) * 180) / Math.PI;
      const rel = ((brg - bearing + 540) % 360) - 180;
      if (Math.abs(rel) > 92) continue;
      const px = W / 2 + (rel / 180) * W;
      x.fillStyle = o.owner === 'blue' ? '#4aa3ff' : o.owner === 'red' ? '#ff5a43' : '#d0d6de';
      x.beginPath(); x.moveTo(px, 4); x.lineTo(px + 11, 17); x.lineTo(px, 30); x.lineTo(px - 11, 17); x.closePath(); x.fill();
      x.fillStyle = '#0a0e14'; x.font = 'bold 15px Bahnschrift, sans-serif'; x.fillText(o.label || o.name[0], px, 18.5); x.font = 'bold 22px Bahnschrift, Arial Narrow, sans-serif';
    }
    x.fillStyle = '#ff8a1f'; x.beginPath(); x.moveTo(W / 2 - 9, 0); x.lineTo(W / 2 + 9, 0); x.lineTo(W / 2, 10); x.fill();
  }

  markClass(k) { this.$('clsrow').querySelectorAll('.cc').forEach((c) => c.classList.toggle('on', c.dataset.k === k)); }

  // 12.174 Cephe: ölüm / doğuş ekranında seçili sınıfın 1940'lar ana silahı + o silahın dönem nişangâhı (menü → Cephanelik → Cephe ile aynı kayıt)
  buildFrontKit(cls) {
    const g = this.game, el = this.$('frkit'), K = FRONT_KIT[cls], p = g.playerSoldier;
    if (!g.mode.front || !K || p.def?.zombie) { if (this._frKey) { this._frKey = ''; el.classList.remove('on'); el.innerHTML = ''; } return; }
    const fl = g.opts.frontLoadouts?.[cls], w = fl?.primary && K.primary.includes(fl.primary) ? fl.primary : K.d[p.team] || K.d.blue;
    const ol = (OPTIC_ALLOWED[w] || []).filter((o) => OPTICS[o]), cur = p.opticFor(w);
    const key = cls + '|' + w + '|' + cur + '|' + lang();
    if (key === this._frKey) return;
    this._frKey = key; el.classList.add('on');
    const chip = (a, v, txt, on) => `<div class="cc ${on ? 'on' : ''}" data-fa="${a}" data-v="${v}"><b>${EN(txt)}</b></div>`;
    el.innerHTML = `<span class="fl">${t('death.ww.kit')}</span><div class="fg">${K.primary.map((id) => chip('w', id, wName(id), id === w)).join('')}</div>`
      + (ol.length > 1 ? `<span class="fl">${t('death.ww.optic')}</span><div class="fg">${ol.map((o) => chip('o', o, opticName(o), o === cur)).join('')}</div>` : '');
    el.onclick = (e) => { const c = e.target.closest('[data-fa]'); if (!c) return; if (c.dataset.fa === 'w') g.frontPick(cls, c.dataset.v); else g.frontOptic(w, c.dataset.v); this._frKey = null; };
  }

  buildMinimapBase() {
    const g = this.game, b = g.map.bounds;
    const W = this.mm.width, H = this.mm.height;
    const pad = 4;
    this.mmS = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2) / (b.maxZ - b.minZ));
    this.mmX = (x) => W / 2 + x * this.mmS;
    this.mmY = (z) => H / 2 + z * this.mmS;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const mini = g.map.mini;                                              // haritaya özel minimap renkleri (çöl: kum zemin, koyu duvar)
    x.fillStyle = mini ? mini.bg : '#6d8a45'; x.fillRect(0, 0, W, H);
    if (g.terrain) {
      // arazi: yükseklik rengi + gölgelendirme, su mavi
      const T = g.terrain, img = x.createImageData(W, H);
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const wx = (px - W / 2) / this.mmS, wz = (py - H / 2) / this.mmS;
        const h = T.heightAt(wx, wz);
        const dx = T.heightAt(wx + 1.2, wz) - T.heightAt(wx - 1.2, wz), dz = T.heightAt(wx, wz + 1.2) - T.heightAt(wx, wz - 1.2);
        const sh = clamp(0.95 + (-dx - dz) * 0.09, 0.55, 1.3);
        let r, gg, b;
        if (h < -0.25) [r, gg, b] = mini?.pit || [74, 144, 184];                   // su (Boya Kulesi: kuyu, koyu)
        else if (mini) { const t = clamp(h / 5, 0, 1), sh2 = 0.9 + (sh - 0.95) * 0.5; r = (mini.ground[0] - 14 * t) * sh2; gg = (mini.ground[1] - 14 * t) * sh2; b = (mini.ground[2] - 16 * t) * sh2; }
        else { const t = clamp(h / 14, 0, 1); r = (109 + 50 * t) * sh; gg = (138 + 6 * t) * sh; b = (69 + 30 * t) * sh; }
        const k = (py * W + px) * 4;
        img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    }
    x.fillStyle = '#58703a';
    x.strokeStyle = '#2a3a1f'; x.lineWidth = 2; x.strokeRect(this.mmX(b.minX), this.mmY(b.minZ), (b.maxX - b.minX) * this.mmS, (b.maxZ - b.minZ) * this.mmS);
    x.fillStyle = g.map.roadColor || '#4b4f57';
    for (const r of g.map.roads || []) x.fillRect(this.mmX(r.x0), this.mmY(r.z0), (r.x1 - r.x0) * this.mmS, (r.z1 - r.z0) * this.mmS);
    for (const cl of g.map.colliders) {
      const w = cl.max[0] - cl.min[0], d = cl.max[2] - cl.min[2], h = cl.max[1] - cl.min[1];
      if (cl.max[1] < 0.5) continue;
      if (w > 60 || d > 60) continue;
      if (mini && cl.tag === 'roof') x.fillStyle = mini.roof;
      else x.fillStyle = mini ? (h > 4 && (w > 3 || d > 3) ? mini.wall : h > 1.5 ? mini.mid : mini.low) : h > 4 && (w > 3 || d > 3) ? '#d6cfba' : h > 1.5 ? '#9c9482' : '#7a7566';
      x.fillRect(this.mmX(cl.min[0]), this.mmY(cl.min[2]), Math.max(1, w * this.mmS), Math.max(1, d * this.mmS));
    }
    if (g.map.callouts) {                                                  // büyük bölgelerin adları minimap'te
      x.font = 'bold 8px Bahnschrift, Arial Narrow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 2.5; x.strokeStyle = 'rgba(20,14,6,.85)'; x.fillStyle = '#fff6dc';
      for (const cl of g.map.callouts) if (cl.major) { const px = this.mmX(cl.x), py = this.mmY(cl.z), nm = mapText(cl.name); x.strokeText(nm, px, py); x.fillText(nm, px, py); }
    }
    this.mmBase = c;
  }

  killFeed(killer, victim, weapon, hs, pn = 0) {
    const g = this.game, f = this.$('killfeed');
    if (victim && victim === g.playerSoldier) {                            // ölüm ekranı için: kim, neyle, kaç metreden, kafadan mı
      const k = killer && killer !== victim ? killer : null;
      this.death = { k, w: weapon || '', hs: !!hs, d: k ? Math.hypot(k.pos.x - victim.pos.x, k.pos.y - victim.pos.y, k.pos.z - victim.pos.z) : 0 };
      this._rsMax = 0;
    }
    const d = document.createElement('div'); d.className = 'kf' + ((killer && killer.isPlayer) || (victim && victim.isPlayer) ? ' me' : '');
    const cls = (s) => (g.ffa ? (s === g.playerSoldier ? 'b' : 'r') : s.team === 'blue' ? 'b' : 'r');
    const nm = dispName;
    const wl = wLabel(weapon);
    d.innerHTML = killer && killer !== victim
      ? `<span class="${cls(killer)}">${nm(killer)}</span><span class="w">${weapon === 'El Bombası' ? NADE_SVG : ''}${EN(wl)}${pn ? PEN_SVG : ''}${hs ? HS_SVG : ''}</span><span class="${cls(victim)}">${nm(victim)}</span>`
      : `<span class="${cls(victim)}">${nm(victim)}</span><span class="w">${weapon === 'Düştü' ? FALL_SVG : weapon === 'Boğuldu' ? DROWN_SVG : ''}${wl && !/^(İntihar)$/.test(weapon) ? wl : t('hud.kf.died')}</span>`;
    f.appendChild(d);
    while (f.children.length > 6) f.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  flagEvent(o, prev) { this.cap?.flagEvent(o, prev); }                    // 12.191 bayrak değişimi (game.onFlag)
  toast(text, color = '#fff') {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text; el.style.color = color;
    this.$('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  hitmarker(dead, head) {
    const h = this.$('hitm');
    h.classList.toggle('k', dead);
    h.style.opacity = 1;
    this.hitT = dead ? 0.35 : 0.14;
  }

  damageFrom(fromPos, me) {
    const dim = !!this.game.abfx?.dimHits;                                   // zırh açıkken kırmızı isabet göstergesi soluk (sekme parlaması abilityfx'te)
    this.$('vig').style.opacity = dim ? 0.3 : 1;
    this.vigT = 0.25;
    if (!fromPos) return;
    const dx = fromPos.x - me.pos.x, dz = fromPos.z - me.pos.z;
    // yaw artışı sola döner: ekran açısı = bakış yönüne göre göreli açı
    const rel = Math.atan2(-dx, -dz) - me.yaw;
    const a = document.createElement('div'); a.className = 'arrow'; if (dim) a.style.opacity = 0.4;
    a.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
    this.$('arrows').appendChild(a);
    setTimeout(() => a.remove(), 1400);
  }

  showScoreboard(v) { this.sbShown = v; this.$('scoreboard').style.display = v ? 'flex' : 'none'; if (v) this.renderScoreboard(); }

  renderScoreboard() {
    const g = this.game, inf = g.mode.infection;
    const head = `<div class="sbh"><b>${EN(modeLabel(g.mode.type || (g.mode.gungame ? 'gg' : g.mode.paintball ? 'pb' : inf ? 'inf' : g.ffa ? 'dm' : g.mode.scoreBased ? 'tdm' : 'conquest')))}</b><span>${mapName(g.mapDef?.id || g.opts.map)} · ${this.$('tm').textContent}</span></div>`;
    const th = (cols) => `<tr><th>${t('sb.player')}</th>${cols}<th>${t('sb.k')}</th><th>${t('sb.a')}</th><th>${t('sb.d')}</th><th>${t('sb.score')}</th></tr>`;
    const col = (team) => {
      const list = g.soldiers.filter((s) => s.team === team && !s.vacant).sort((a, b) => b.score - a.score);
      return `<div class="team ${team}"><h3 style="color:var(--c)"><span>${inf ? (team === 'blue' ? t('hud.humans') : t('hud.zombies')) : teamName(team)}</span><em>${Math.max(0, g.tickets[team])}</em></h3><table>${th('')}${
        list.map((s) => `<tr class="${s.isPlayer ? 'me' : ''} ${s.alive ? '' : 'dead'}"><td>${dispName(s)}</td><td>${s.kills}</td><td>${s.assists || 0}</td><td>${s.deaths}</td><td>${s.score}</td></tr>`).join('')}</table></div>`;
    };
    if (g.ffa) {                                                         // tek tablo, öldürmeye göre
      const gg = g.mode.gungame;
      const list = ffaRanking(g.soldiers, gg);
      const pc = (s) => (g.mode.paintball && g.paintColor ? `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:${g.paintColor(s)}"></i>` : '');   // Paintball: oyuncunun boya rengi (game.paintColor = paint.js paintColorOf)
      const ttl = gg ? t('sb.ggTitle', { n: g.mode.killLimit }) : g.mode.paintball ? t('sb.pbTitle', { n: g.mode.killLimit }) : t('sb.dmTitle', { n: g.mode.killLimit });
      this.$('sbbody').innerHTML = `${head}<div class="cols"><div class="team" style="--c:#ff8a1f;max-width:none"><h3 style="color:var(--c)"><span>${EN(ttl)}</span></h3><table>${th(gg ? `<th>${t('sb.level')}</th><th>${t('sb.weapon')}</th>` : '')}${
        list.map((s) => `<tr class="${s.isPlayer ? 'me' : ''} ${s.alive ? '' : 'dead'}"><td>${pc(s)}${dispName(s)}</td>${gg ? `<td>${s.ggLevel + 1}</td><td>${wName(s.items[0].id)}</td>` : ''}<td>${s.kills}</td><td>${s.assists || 0}</td><td>${s.deaths}</td><td>${s.score}</td></tr>`).join('')}</table></div></div>`;
      return;
    }
    this.$('sbbody').innerHTML = `${head}<div class="cols">${col('blue')}${col('red')}</div>`;
  }

  get pausedShown() { return this.$('pause').style.display === 'flex'; }
  get resumeShown() { return this.$('presume').style.display === 'flex'; }
  get endShown() { return this.$('endscreen').style.display === 'flex'; }
  // 12.147: menüde Esc → menü kapanır, kilit alınamazsa ortada küçük "Devam etmek için tıkla" (tıkla = oyun, Esc = menüye geri)
  showResume(v) {
    if (v) { this.igs?.close(); this.$('pause').style.display = 'none'; }
    this.$('presume').style.display = v ? 'flex' : 'none';
  }

  setPaused(v) {
    const ov = this.$('pause'), g = this.game;
    this.$('presume').style.display = 'none';
    if (!v) this.igs?.close();
    ov.style.display = v ? 'flex' : 'none';
    // maça girişte (henüz oynanmadı): sahne arkada görünmesin; harita görseliyle tam ekran kapak
    const intro = v && g.time <= 0.5;
    ov.classList.toggle('intro', intro);
    this.$('bKill').style.display = intro ? 'none' : '';             // girişte öldürülecek bir şey yok
    const m = g.mapDef || {}, mid = m.id || g.opts?.map;
    ov.style.backgroundImage = intro && m.thumb ? `linear-gradient(rgba(5,8,12,.35), rgba(5,8,12,.88)), url(${m.thumb})` : '';
    const tag = mapText(m.tag || '', `map.${mid}.tag`), desc = mapText(m.desc || '', `map.${mid}.desc`);
    this.$('pmeta').innerHTML = intro && m.name ? `<div class="pm"><b>${mapName(mid)}</b><span>${tag}</span></div>${desc ? `<div class="pdesc">${desc}</div>` : ''}` : '';
    this.$('ptag').innerHTML = EN(`${modeLabel(g.opts?.match?.type || g.mode.type || '')}${intro ? '' : ' · ' + mapName(mid)}`);
    if (!v) return;
    const bt = document.getElementById('bTouch'); if (bt) bt.textContent = t('pause.touch');   // touch.js'in eklediği düğme
    const mob = document.body.classList.contains('mob');
    if (g.time > 0.5) {
      this.$('ptitle').textContent = t('pause.paused');
      this.$('ptext').textContent = t('pause.resumeHint');
      this.$('bResume').textContent = t('pause.resume');
    } else {
      this.$('ptitle').textContent = t('pause.ready');
      this.$('ptext').textContent = mob ? t('pause.introTouch') : t('pause.intro');
      this.$('bResume').textContent = t('pause.start');
    }
  }

  showEnd(win, title, info, rows) {
    this.$('etitle').textContent = title;
    this.$('etitle').style.color = win ? '#7be06f' : '#ff7b6b';
    this.$('einfo').textContent = info;
    this.$('estats').innerHTML = rows;
    this.$('endscreen').style.display = 'flex';
    this.$('pause').style.display = 'none'; this.$('presume').style.display = 'none';
    this.$('respawn').style.display = 'none';
  }

  // Enfekte: canlı BOSS'ların üstte can çubuğu (herkes görür) + kalan can hakkı
  drawBosses() {
    const g = this.game, el = this.$('bosses');
    const list = g.soldiers.filter((s) => s.boss && s.def.zombie && !s.vacant);
    const key = list.map((s) => `${s.id}:${s.alive ? Math.ceil(s.hp / s.maxHp * 50) : -1}:${s.zLives}`).join('|');
    if (key === this._bossKey) return;
    this._bossKey = key;
    el.innerHTML = list.map((s) => `<div class="bs ${s.alive ? '' : 'dead'}"><span>BOSS · ${s.name} <i>${'♥'.repeat(Math.max(0, s.zLives))}</i></span><div class="bar"><i style="width:${s.alive ? Math.max(0, s.hp / s.maxHp * 100) : 0}%"></i></div></div>`).join('');
  }

  // Herkes-tek skor kutusu: öndeysen sol kutu 'SEN · LİDER +fark' (altın) ve sağda 2.; eşitse iki kutu BERABERE; gerideysen sağda lider adı (altın), solda sıran
  ffaScore(p) {
    const gg = this.game.mode.gungame, rk = ffaRanking(this.game.soldiers, gg), me = ffaMetric(p, gg);
    const rival = rk.find((s) => s !== p), ot = rival ? ffaMetric(rival, gg) : 0, nm = rival ? rival.name : '—';
    const st = me > ot ? 'lead' : me === ot ? 'tie' : 'back', rank = 1 + rk.filter((s) => ffaMetric(s, gg) > me).length;   // sıra: senden kesin önde olanlar + 1
    const key = st + '|' + nm + '|' + (me - ot) + '|' + rank;
    if (key !== this._ffaKey) {
      this._ffaKey = key;
      const B = this.root.querySelector('.tk.blue'), Rd = this.root.querySelector('.tk.red');
      const Y = t('hud.you'), L = t('hud.leader'), T = t('hud.tie');
      this.$('tnB').textContent = st === 'lead' ? `${Y} · ${L} +${me - ot}` : st === 'tie' ? `${Y} · ${T}` : `${Y} · ${rank}.`;
      this.$('tnR').textContent = st === 'lead' ? `2. · ${nm}` : st === 'tie' ? `${T} · ${nm}` : `${L} · ${nm}`;
      B.classList.toggle('lead', st === 'lead'); Rd.classList.toggle('lead', st === 'back');
      B.classList.toggle('tie', st === 'tie'); Rd.classList.toggle('tie', st === 'tie');
    }
    return [me, ot];
  }

  // Ölüm ekranı: öldüren kartı (ad, sınıf, silah, mesafe, kafadan, kalan canı) + doğuş geri sayımı
  drawDeath(p) {
    const g = this.game, $ = this.$, D = this.death;
    const k = (D && D.k) || (p.lastHit && p.lastHit !== p ? p.lastHit : null);
    const card = $('rkill');
    card.classList.toggle('self', !k);
    if (k) {
      $('rkh').textContent = D?.hs ? t('death.killedByHs') : t('death.killedBy');
      $('rtitle').textContent = k.name;
      $('rtitle').className = g.ffa ? 'r' : k.team === 'blue' ? 'b' : 'r';
      const kc = g.mode.infection && k.def?.zombie ? (k.boss ? 'BOSS' : ztName(ZT_ORDER.find((z) => ZTYPES[z] === k.zt) || 'walker')) : className(k.cls);
      $('rksub').textContent = g.ffa ? kc : `${kc} · ${g.mode.infection ? (k.team === 'blue' ? t('hud.humans') : t('hud.zombies')) : teamName(k.team)}`;
      $('rkw').innerHTML = EN(D?.w ? wLabel(D.w) : k.item ? wName(k.item.id) : '—');
      $('rkhs').innerHTML = D?.hs ? `<span class="hs">${HS_SVG}${t('death.hs')}</span>` : '';
      $('rkd').textContent = D && D.d ? `${Math.round(D.d)} m` : '—';
      const hp = Math.max(0, Math.ceil(k.hp));
      $('rkp').textContent = k.alive ? `${hp}` : t('death.dead');
      $('rkpb').style.width = (k.alive ? clamp(k.hp / (k.maxHp || 100) * 100, 0, 100) : 0) + '%';
    } else {
      $('rkh').textContent = t('death.status');
      $('rtitle').textContent = t('death.died'); $('rtitle').className = '';
      $('rksub').textContent = D?.w ? wLabel(D.w) : '';
    }
    // geri sayım halkası
    const rt = Math.max(0, p.respawnT || 0);
    this._rsMax = Math.max(this._rsMax || 0, rt);
    $('rcount').textContent = rt > 0 ? Math.ceil(rt) : '…';
    $('rring').style.strokeDashoffset = (276.5 * (1 - (this._rsMax ? rt / this._rsMax : 0))).toFixed(1);
    $('rcsub').textContent = rt > 0 ? t('death.respawnIn') : t('death.deploying');
  }

  update(dt) {
    const g = this.game, p = g.playerSoldier, $ = this.$;
    if (g.world?.terrain?.waterY) (this.swim ||= new SwimHud(this)).update(dt, p);      // 12.180 nefes çubuğu
    if (g.mode.infection) this.drawBosses();
    let kb = g.tickets.blue, kr = g.tickets.red;
    if (g.ffa) [kb, kr] = this.ffaScore(p);                           // herkes-tek: sol = sen, sağ = lider (sen öndeysen ikinci)
    $('tkB').textContent = Math.max(0, Math.round(kb));
    $('tkR').textContent = Math.max(0, Math.round(kr));
    if (!g.ffa && g.mode.objectives.length && !g.front) {           // bayrak kanaması (Cephe modunda yok: frontHud): daha çok bayrağı olan takım, farkı kadar rakip bileti 5 sn'de eksiltir
      const nb = g.mode.objectives.filter((o) => o.owner === 'blue').length, nr = g.mode.objectives.filter((o) => o.owner === 'red').length;
      const bb = nr > nb ? nr - nb : 0, br = nb > nr ? nb - nr : 0;
      $('tnB').textContent = t('hud.blue') + (bb ? ` ▼${bb}` : '');
      $('tnR').textContent = t('hud.red') + (br ? ` ▼${br}` : '');
      const mine = p.team === 'blue' ? bb : br, key = mine + ':' + (p.team === 'blue' ? br : bb);
      if (key !== this._bleedKey) {
        this._bleedKey = key;
        if (mine) this.toast(t('hud.bleedLose', { n: mine, s: TUNE.bleed }), '#ff8a6a');
        else if (p.team === 'blue' ? br : bb) this.toast(t('hud.bleedWin'), '#9fe6a8');
      }
    } else if (!g.ffa && !g.mode.infection) { $('tnB').textContent = t('hud.blue'); $('tnR').textContent = t('hud.red'); }
    $('tbB').style.width = clamp((kb / this.maxTk) * 100, 0, 100) + '%';
    $('tbR').style.width = clamp((kr / this.maxTk) * 100, 0, 100) + '%';
    const tl = Math.max(0, Math.ceil(g.timeLeft));
    $('lim').textContent = g.mode.scoreBased ? t('hud.first', { n: g.mode.tickets }) : '';
    $('tm').textContent = g.timeLeft === Infinity ? '∞' : `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
    this.drawCompass();
    if (this.zoneT > 0) { this.zoneT -= dt; if (this.zoneT <= 0) $('zonew').style.display = 'none'; }
    this.cap?.update(dt);                                                   // 12.191 bayraklar: üst çubuk + alan göstergesi + dünya işaretleri (captureHud.js)
    // oyuncu durumu
    const st = p.stat, it = p.item;
    const ab = p.ability;                                                   // zombi özel gücü göstergesi
    const abEl = $('abil');
    if (ab && p.alive) {
      abEl.style.display = 'block';
      const act = p.abActive > 0, rdy = p.abT <= 0 && !act, an = abilName(ab);
      abEl.classList.toggle('on', act); abEl.classList.toggle('cd', !act && !rdy);     // className değil: abilityfx'in 'rdyp' parlaması silinmesin
      if (abEl._abc !== ab.id) { abEl._abc = ab.id; abEl.style.setProperty('--abc', ABCOL[ab.id] || '#ff8a1f'); }
      $('abk').textContent = codeLabel(g.binds.codes('ability')[0]) + ' / ' + t('hud.rmb');
      $('abn').innerHTML = act ? `${an} <span class="sec">${p.abActive.toFixed(1)}</span>s` : rdy ? `${an} · ${t('hud.ready')}` : `${an} · ${Math.ceil(p.abT)}s`;
      $('abbar').style.width = (act ? p.abActive / ab.dur * 100 : rdy ? 100 : (1 - p.abT / ab.cd) * 100) + '%';
    } else abEl.style.display = 'none';
    $('hpnum').innerHTML = `${Math.max(0, Math.ceil(p.hp))}<small>HP</small>`;
    $('hpfill').style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
    $('hpfill').style.background = p.hp < 30 ? 'linear-gradient(90deg,#d63a2e,#f06a4a)' : 'linear-gradient(90deg,#3ecf5b,#7be06f)';
    const ztk = p.def.zombie && !p.boss ? ZT_ORDER.find((z) => ZTYPES[z] === p.zt) : null;
    setH($('clsname'), EN(g.mode.gungame ? t('hud.ggLevel', { n: p.ggLevel + 1, m: g.mode.killLimit }) : g.mode.paintball ? t('hud.pbElim', { n: p.kills, m: g.mode.killLimit }) : g.mode.infection ? (p.def.zombie ? `${p.boss ? 'BOSS' : className('zombie') + ' · ' + ztName(ztk || 'walker')} · ${'♥'.repeat(Math.max(0, p.zLives))}` : `${className(p.cls)} · ${t('hud.humans')}`) : g.ffa ? className(p.cls) : `${className(p.cls)} · ${teamName(p.team)}`));      // herkes tek modlarda takım adı yok (f0… çevrilmiyordu)
    const wn = wName(it.id);
    setH($('wname'), EN(p.reloadT > 0 ? `${wn} · ${t('hud.reloading')}` : p.useT > 0 ? `${wn} · ${t('hud.using')}` : wn));
    $('mag').textContent = it.mag;
    $('res').textContent = st.kind === 'throwable' || st.kind === 'medkit' || st.kind === 'melee' ? '' : '/ ' + it.reserve;
    const slotKey = p.items.map((x, i) => x.id + (i === p.cur ? '*' : '') + (p.canEquip(i) ? '' : '-')).join(',') + SLOT_KEYS.map((a) => g.binds?.codes(a)[0]).join();
    if (slotKey !== this._slotKey) {                                         // yalnız değişince yeniden yaz (dil değişince applyLang sıfırlar)
      this._slotKey = slotKey;
      // 12.140: tuş sırası (1 ana, 2 yedek, 3 bıçak, 4 ekipman); numara = o konuma atanmış ilk tuş (özel atama varsa o), data-i = items indeksi (dokunmatik)
      $('slots').innerHTML = slotOrder(p.items.length).map((i, k) => { const x = p.items[i], c = g.binds?.codes(SLOT_KEYS[k])[0]; return `<div class="slot ${i === p.cur ? 'on' : ''} ${p.canEquip(i) ? '' : 'empty'}" data-i="${i}"><span><b>${c ? codeLabel(c) : k + 1}</b>${EN(wName(x.id))}</span></div>`; }).join('');
    }
    this.$('ammo').querySelector('.n').classList.toggle('low', st.mag > 1 && it.mag <= st.mag * 0.25);
    // nişangâh / örtüler
    const cross = $('cross');
    const ov = p.overlay, adsL = p.adsT, ads = adsEase(adsL);           // adsL doğrusal (dürbün eşiği silah modeliyle aynı), ads görsel eğri
    const scopeOn = p.alive && ov === 'scope' && (g.player ? !!g.player.scopeOn : adsL > 0.9);      // 12.127: bayrak ViewModel'de (çıkışta dünya ×2'nin altına inene dek açık; model aynı bayrakla gizli)
    const tp = g.showSelf;                                   // 3. şahıs kamera: optik örtüsü yok, artı hep görünür
    const showCross = p.alive && (ads < 0.6 || tp) && !p.scoped;      // 12.174: dönem dürbünü takılı tüfekte de      // 12.156: dürbünlü keskin nişancıda belden artı yok (no-scope tahmine kalır; isabet işareti #hitm ayrı, çalışır)
    cross.style.display = showCross ? 'block' : 'none';
    cross.classList.toggle('ads', ads > 0.5 && !tp);
    const spread = p.spreadNow(st) * 900;
    cross.style.setProperty('--g', clamp(3 + spread, 3, 60) + 'px');
    this.pbReticle(p, st, ov === 'pbring' && p.alive && !tp && ads > 0.55);
    // HUD retikülü yalnız nişangâh tam oturunca (öncesinde modeldeki ışıyan nokta / halka görünür, ikisi ekran ortasında üst üste biner)
    $('rdot').style.display = p.alive && !tp && (ov === 'dot' || (ov === 'lens' && p.opticDef?.reticle === 'dot')) && ads > ADS_HUD ? 'block' : 'none';      // 12.174: öncü dürbün (reticle 'post') kendi 3B siyah retikülüyle      // 12.162: ACOG / PSO-1 de (saydam mercek + sade kırmızı nokta)
    $('holo').style.display = p.alive && !tp && ov === 'holo' && ads > ADS_HUD ? 'block' : 'none';
    $('idot').classList.toggle('on', p.alive && !tp && ov === 'none' && !!p.opticDef && ads > ADS_HUD);      // yalnız telefonda görünür (CSS body.mob)
    const sc = $('scope');
    sc.style.display = scopeOn ? 'block' : 'none';
    if (scopeOn) { const ww = p.opticDef?.reticle === 'post3'; if (ww !== this._scWW) { this._scWW = ww; sc.classList.toggle('ww', ww); } }      // 12.174: dönem dürbünü üç direkli retikül
    // dürbün kararması (12.153): göz merceğe yaklaşırken kararır (adsL 0,3 → SCOPE_ON, eski 0,55 → 0,9: arada 3B göz merceği ekranı kaplıyordu), örtü açılınca ~0,12 sn'de açılır
    // ve halka %94'ten oturur; çıkışta kısa kararma. Sürgü çekilirken (ViewModel.boltK) halka sağ-alta kayar / yatar: dürbünde kalınır, gözün mercekten kayması
    if (scopeOn !== !!this._scWas) { this._scWas = scopeOn; this._scBlk = 1; }
    this._scBlk = Math.max(0, (this._scBlk || 0) - dt * 8.5);
    const blk = p.alive && !tp && ov === 'scope' ? Math.max(this._scBlk, scopeOn ? 0 : Math.pow(clamp((adsL - 0.3) / (SCOPE_ON - 0.3), 0, 1), 1.2) * (p.ads ? 1 : 0.6)) : 0;
    if (scopeOn) {
      const bk = g.player?.vm.boltK || 0, sIn = this._scBlk * this._scBlk;
      const tf = bk > 0.001 || sIn > 0.001 ? `translate(${(bk * 2.4).toFixed(2)}vh,${(bk * 3.6).toFixed(2)}vh) rotate(${(bk * 2.2).toFixed(2)}deg) scale(${(1 - 0.06 * sIn).toFixed(4)})` : '';
      if (sc.style.transform !== tf) sc.style.transform = tf;
    }
    $('scopeblk').style.opacity = blk.toFixed(3);
    $('advig').style.opacity = p.alive && ov !== 'scope' && !tp ? (ads * 0.55).toFixed(2) : 0;
    const stTxt = [p.prone ? t('hud.prone') : p.crouching ? t('hud.crouch') : '', p.leanT > 0.3 ? t('hud.leanR') : p.leanT < -0.3 ? t('hud.leanL') : '', st.ball ? tr('pb.ring') : p.opticDef && st.kind === 'gun' ? opticName(p.opticId) : '', st.kind === 'gun' && st.auto ? `${fireName(p.fireModeNow, true)} [X]` : ''].filter(Boolean).join(' · ');
    $('stance').textContent = stTxt;
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $('hitm').style.opacity = 0; }
    if (this.vigT > 0) { this.vigT -= dt; if (this.vigT <= 0) $('vig').style.opacity = 0; }
    $('vig').style.opacity = p.alive && p.hp < 30 ? 0.55 : $('vig').style.opacity;
    // paintball: boyayla elendin → ekran boyanır, "BOYANDIN!", ölüm ekranı kısa bir süre sonra
    if (this._wasAlive && !p.alive && this._sp && g.time - this._sp.lastHitT < 0.8) this._sp.death(p.lastHit && p.lastHit !== p ? paintIndexOf(p.lastHit) : this._sp.lastCol ?? 0);
    this._wasAlive = p.alive;
    if (this._sp) this._sp.update(dt);
    // ölüm ekranı
    const rs = $('respawn');
    if (!p.alive && !g.ended && !(this._sp && this._sp.deathT > 0)) {
      rs.style.display = 'flex';
      this.drawDeath(p);
      let note = '';
      if (g.mode.gungame) note = t('death.ggNext', { n: p.ggLevel + 1, m: g.mode.killLimit, w: wName(p.items[0].id) });
      if (g.mode.infection) {
        const cure = p.willCure;
        this.setRowMode(cure ? 'cls' : p.boss ? 'boss' : 'z');
        note = cure ? `<b style="color:#7ec8ff">${p.boss ? t('death.bossDown') : ''}${t('death.asHuman')}</b> ${t('death.livesOut')}` : !p.def.zombie ? `<b style="color:#b6ff6a">${t('death.asZombie')}</b>` : t('death.zLives', { n: `<b style="color:#b6ff6a">${p.zLives}</b>` });
        if (cure) this.markClass(g.pendingClass || p.humanCls || ''); else if (!p.boss) this.markZ(g.pendingZ || '');
      }
      else if (!g.mode.fixed) { this.buildSpawnRow(); this.markClass(g.pendingClass || p.cls); this.buildFrontKit(g.pendingClass || p.cls); }
      if (note !== this._note) { this._note = note; $('rinfo').innerHTML = note; }
    } else { if (rs.style.display !== 'none') { rs.style.display = 'none'; this.death = null; } this._spKey = null; }
    // mesaj
    let msg = '';
    if (p.alive) {
      if (!msg && p.stat.kind === 'medkit' && p.item.mag > 0 && g.findRevivable(p)) msg = t('hud.revive');
      if (!msg && p.item.mag <= 0 && p.stat.kind === 'gun') msg = p.item.reserve > 0 ? t('hud.emptyR', { k: codeLabel(g.binds.codes('reload')?.[0]) || 'R' }) : t('hud.emptyNone');
    }
    if (g.mode.infection && g.graceLeft > 0) msg = p.def.zombie ? t('hud.graceZ', { n: Math.ceil(g.graceLeft) }) : t('hud.graceH', { n: Math.ceil(g.graceLeft) });
    $('msg').textContent = msg;
    if (this.sbShown) this.renderScoreboard();
    this.drawMinimap();
  }

  // Paintball halka nişangâhı: halka yarıçapı = o anki top sapması (ekran pikseli), düşüş çizgileri topun hızı / yerçekiminden (20 / 30 / 40 m'de top
  // nişan noktasının ne kadar altına düşer). Kamera FOV'u (nişan yakınlaştırması dahil) her karede okunur; stil yalnız değişince yazılır.
  pbReticle(p, st, on) {
    const el = this.$('pbret');
    if (!on) { if (this._pbOn) { el.style.display = 'none'; this._pbOn = false; } return; }
    if (!this._pbOn) { el.style.display = 'block'; this._pbOn = true; }
    const mob = document.body.classList.contains('mob'), k = innerHeight / 2 / Math.tan((this.game.camera.fov * Math.PI) / 360);   // piksel / tan(açı)
    const R = Math.round((mob ? 9 : 6) + Math.tan(p.spreadNow(st)) * k), col = paintColorOf(p);
    const ys = [20, 30, 40].map((d) => { const t = d / (st.speed || 70); return Math.round(Math.atan((0.5 * (st.grav || 0) * t * t) / d) * k); });
    const key = R + '|' + ys.join(',') + col + mob;
    if (key === this._pbKey) return;
    this._pbKey = key;
    el.style.setProperty('--r', R + 'px'); el.style.setProperty('--c', col);
    // düşüş çizgileri: uzak menzil = geniş çizgi (BDC dürbünü gibi); etiketler halkanın dışında sırayla sağ / sol / sağ, aynı yanda üst üste binmez (en az 10 / 12 px)
    const gap = mob ? 12 : 10, ly = [-99, -99];
    this.pbMarks.forEach((m, i) => {
      const w = (mob ? [12, 16, 20] : [8, 11, 14])[i], y = ys[i], sd = i & 1, yy = (ly[sd] = Math.max(y, ly[sd] + gap));
      m.style.width = w + 'px'; m.style.left = -w / 2 + 'px'; m.style.top = y - 1 + 'px'; m.style.display = y > 2 ? 'block' : 'none';
      const sp = m.firstChild, off = Math.max(R, w / 2) + 4 + w / 2;            // tik çizgisinin kenarından değil merkezden: halka dışı
      sp.style.left = sd ? '' : off + 'px'; sp.style.right = sd ? off + 'px' : ''; sp.style.top = yy - y - (mob ? 6 : 5) + 'px';
    });
    const stem = el.firstChild; stem.style.top = R + 'px'; stem.style.height = Math.max(0, ys[2] - R + 2) + 'px'; stem.style.display = ys[2] > R + 2 ? 'block' : 'none';
  }

  // Bulunduğun bölgenin adı (haritada callouts varsa): minimap altındaki başlıkta "HARİTA · Bölge"
  updateLocation(force) {
    const g = this.game, C = g.map.callouts, p = g.playerSoldier;
    const mn = mapName(g.mapDef?.id || g.opts?.map);
    if (!C || !p) { if (force) this.$('mmname').textContent = mn; return; }
    let best = null, bd = 1e9;
    for (const c of C) { const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z); if (d < bd) { bd = d; best = c; } }
    const nm = best && bd < (best.r || 14) ? mapText(best.name) : '';                     // 12.184 r: haritanın verdiği bölge yarıçapı (Kuzey Vadisi)
    if (nm !== this._loc || force) { this._loc = nm; this.$('mmname').innerHTML = ''; this.$('mmname').append(mn); if (nm) { const b = document.createElement('b'); b.textContent = ' · ' + nm; this.$('mmname').append(b); } }
  }

  drawMinimap() {
    const g = this.game, x = this.mmCtx, p = g.playerSoldier;
    this.updateLocation();
    x.clearRect(0, 0, this.mm.width, this.mm.height);
    x.drawImage(this.mmBase, 0, 0);
    this.cap?.drawMinimap(x, this.mmX, this.mmY, performance.now());     // 12.191 bayraklar: sahip + ilerleme halkası + alınıyor nabzı
    if (g.vehicles) for (const v of g.vehicles.list) {                    // 12.177 araçlar: dost / boş araç hep, düşman araç içindeki görüldüyse
      if (!v.alive || !v.st) continue;
      const occ = v.seats.filter(Boolean), tm = occ.length ? occ[0].team : v.paint;
      if (tm && tm !== p.team && !occ.some((o) => g.time - (o.spottedT ?? -99) < 2.5)) continue;
      x.save(); x.translate(this.mmX(v.st.x), this.mmY(v.st.z)); x.rotate(-v.st.yaw);
      x.fillStyle = tm === 'blue' ? '#4aa3ff' : tm === 'red' ? '#ff5a43' : '#d8d4c4'; x.strokeStyle = occ.length ? '#fff' : '#0008'; x.lineWidth = 1.2;
      x.fillRect(-2.6, -4.2, 5.2, 8.4); x.strokeRect(-2.6, -4.2, 5.2, 8.4); x.restore();
    }
    for (const s of g.soldiers) {
      if (!s.alive) continue;
      if (s.veh) continue;                                                  // araçtaki asker araç işaretinde
      const friendly = s.team === p.team;
      if (!friendly && !(g.time - (s.spottedT ?? -99) < 2.5)) continue;
      x.beginPath();
      x.fillStyle = s.team === 'blue' ? '#4aa3ff' : '#ff5a43';
      x.arc(this.mmX(s.pos.x), this.mmY(s.pos.z), s.isPlayer ? 0 : 2.6, 0, 6.3);
      x.fill();
      if (!friendly) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke(); }
    }
    if (p.alive) {
      x.save();
      x.translate(this.mmX(p.pos.x), this.mmY(p.pos.z));
      x.rotate(-p.yaw);
      x.fillStyle = '#fff';
      x.beginPath(); x.moveTo(0, -6); x.lineTo(4.5, 5); x.lineTo(0, 2.5); x.lineTo(-4.5, 5); x.closePath(); x.fill();
      x.strokeStyle = '#000'; x.lineWidth = 1; x.stroke();
      x.restore();
    }
  }
}
