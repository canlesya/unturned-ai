// Dokunmatik kontroller (telefon / tablet), PUBG / CoD Mobile tarzı.
// · Joystick (analog: az itince yavaş): SABİT (hep aynı yerde) ya da HAREKETLİ (sol yarıda parmağın değdiği yerde belirir).
//   Sonuna kadar ileri = koşu; daha da yukarı sürükleyip kilit işaretinde bırakınca KOŞU KİLİDİ (joysticke tekrar dokununca biter).
// · Sağ yarı: kaydırarak bakış (normal / nişan hassasiyeti ayrı). İsteğe bağlı jiroskop (kapalı / nişandayken / hep).
// · Butonlar: ateş (sabit ya da parmağı izleyen; basılıyken sürükleyince nişan alır), sol ateş (isteğe bağlı), nişan, zıpla, çömel, şarjör,
//   silah değiştir, ekipman, 3. şahıs, skor, duraklat, nişangâh seç (silahta birden çok nişangâh varsa; dokununca büyük kartlı seçici açılır,
//   masaüstündeki T tekerleğinin karşılığı). HUD'daki silah adına dokununca o silaha geçer.
// · Zombiyken (Enfekte): özel güç butonu (bekleme halkası, HAZIR parlar; masaüstündeki F / sağ tık); nişan, nişangâh, şarjör, silah değiştir
//   ve ekipman gizlenir (zombinin yalnız pençesi var). Düzenleyicide de role göre: zombiyken güç butonu taşınır, insanken ekipman.
// · Düzen düzenleyici (duraklat → Dokunmatik ayarlar): butonları sürükle, boyutlandır, saydamlık; ayarlar localStorage'da (cihaza özel).
// · Nişan yardımı (yalnız dokunmatik, Hassasiyet sekmesinden kapatılır): düşman üstünde bakış yavaşlar (sürtünme), hareket / ateş / nişan
//   sırasında görünen en yakın düşmana yumuşakça döner (mıknatıs), nişana girerken hafif çekiş. Görüş: game.botSees (duvar + duman + yaprak).
// Masaüstünde denemek için: ?touch=1
import * as THREE from 'three';
import { OPTICS } from './stats.js';
import { t } from '../i18n/index.js';
import '../i18n/touch.js';
import { wName, opticName } from '../i18n/game.js';

const KEY = 'warbyte.touch';
const DEF = { joy: 'fixed', fire: 'fixed', leftFire: true, opacity: 0.8, sens: 1, adsSens: 0.75, gyro: 'off', gyroSens: 1, gyroInvX: false, gyroInvY: false, aim: true, aimStr: 1, retSz: 1, layout: {} };
// Varsayılan düzen: merkez (x, y: ekranın oranı), boyut s (ekran yüksekliğinin oranı)
const LAYOUT = {
  joy: { x: 0.15, y: 0.70, s: 0.36 },
  fire: { x: 0.78, y: 0.60, s: 0.27 }, fire2: { x: 0.08, y: 0.36, s: 0.18 },
  ads: { x: 0.93, y: 0.36, s: 0.16 }, jump: { x: 0.93, y: 0.61, s: 0.18 }, crouch: { x: 0.93, y: 0.86, s: 0.16 },
  reload: { x: 0.655, y: 0.86, s: 0.15 }, swap: { x: 0.79, y: 0.89, s: 0.15 }, nade: { x: 0.655, y: 0.58, s: 0.15 }, abil: { x: 0.655, y: 0.6, s: 0.19 },
  third: { x: 0.655, y: 0.34, s: 0.12 }, optic: { x: 0.81, y: 0.36, s: 0.12 }, breath: { x: 0.72, y: 0.4, s: 0.12 }, pause: { x: 0.22, y: 0.075, s: 0.11 }, score: { x: 0.285, y: 0.075, s: 0.11 },
  veh: { x: 0.53, y: 0.62, s: 0.14 }, vcam: { x: 0.53, y: 0.4, s: 0.11 }, seat: { x: 0.53, y: 0.84, s: 0.11 },      // 12.177 araç: bin / in (yalnız yakında / içindeyken), kamera (sürücü), koltuk değiştir
};
const NAME = (id) => t('tc.n.' + id);                                            // düzenleyicideki buton adları (src/i18n/touch.js)
const I = {
  fire: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>', fire2: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  ads: '<circle cx="12" cy="12" r="3"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3"/><circle cx="12" cy="12" r="8"/>',
  jump: '<path d="M12 19V5M6 11l6-6 6 6"/>', crouch: '<path d="M12 5v14M6 13l6 6 6-6"/>', reload: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', nade: '<circle cx="12" cy="14" r="6"/><path d="M12 8V5h4M10 4h4"/>',
  third: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0112 0v3"/><path d="M3 4l3 3M21 4l-3 3"/>',
  optic: '<rect x="3" y="8" width="12" height="6" rx="1.5"/><path d="M15 9.5l5-2v7l-5-2M6.5 8V5.5h5V8"/>',
  abil: '<path d="M13 2L5 13h6l-1 9 8-12h-6z"/>',
  breath: '<path d="M3 9h11a3 3 0 10-3-3M3 15h14a3 3 0 11-3 3M3 12h8"/>',      // 12.156: nefes tut (dürbünde basılı tut)
  pause: '<path d="M8 5v14M16 5v14"/>', score: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  veh: '<path d="M4 15l2-6h12l2 6v4H4z"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M7 9l1.5-3h7L17 9"/>',
  vcam: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>',
  seat: '<path d="M7 4v9h9l2 7M7 13l-2 7M10 4h-3"/><path d="M14 4l3 3-3 3"/>',
};
// seçici kartlarında küçük nişangâh önizlemesi ve buton etiketi
const OPI = {
  iron: '<path d="M4 20h6v-8h4v8h6" stroke="#e8edf5" stroke-width="2" fill="none"/><rect x="11" y="6" width="2" height="9" fill="#e8edf5"/>',
  reddot: '<circle cx="12" cy="12" r="9" stroke="#8a929c" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="2.4" fill="#ff2a1a"/>',
  holo: '<circle cx="12" cy="12" r="7" stroke="#ff3326" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="1.4" fill="#ff3326"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#ff3326" stroke-width="1.6"/>',
  acog: '<circle cx="12" cy="12" r="10" stroke="#8a929c" stroke-width="1.5" fill="none"/><path d="M8.5 15L12 10.5l3.5 4.5" stroke="#ff2e1f" stroke-width="1.8" fill="none"/>',
  scope: '<circle cx="12" cy="12" r="10" stroke="#8a929c" stroke-width="1.5" fill="none"/><path d="M2 12h20M12 2v20" stroke="#e8edf5" stroke-width="1"/>',
};
OPI.scope6 = OPI.scope;
// 12.174 dönem nişangâhları: diyoptr halka + arpacık, öncü dürbün (direk + çizgi), üç direkli dürbün
OPI.ww_peep = '<circle cx="12" cy="12" r="7" stroke="#e8edf5" stroke-width="2" fill="none"/><rect x="11" y="10" width="2" height="7" fill="#e8edf5"/>';
OPI.ww_scout = '<circle cx="12" cy="12" r="10" stroke="#8a929c" stroke-width="1.5" fill="none"/><path d="M2 12h20" stroke="#e8edf5" stroke-width="1"/><path d="M10.6 22v-8L12 12l1.4 2v8z" fill="#e8edf5"/>';
OPI.ww_sc25 = OPI.ww_sc4 = '<circle cx="12" cy="12" r="10" stroke="#8a929c" stroke-width="1.5" fill="none"/><path d="M2 11h7.5v2H2zM14.5 11H22v2h-7.5zM10.8 22v-8L12 12l1.2 2v8z" fill="#e8edf5"/>';
const OPS = { acog: '3×', scope: '4×', scope6: '6×', ww_scout: '1,5×', ww_sc25: '2,5×', ww_sc4: '4×' }, opLabel = (id) => OPS[id] || (id ? t('tc.op.' + id) : '');   // nişangâh butonu etiketi
const CSS = `
#tc{position:fixed;inset:0;z-index:6;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;font-family:Bahnschrift,'Rajdhani','Arial Narrow',system-ui,sans-serif}
#tc.off{display:none}
#tc .b.vh{display:none}
#tc .jb{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(10,14,20,.28);pointer-events:none}
#tc .jb.float{display:none}
#tc .jk{position:absolute;left:50%;top:50%;width:42%;height:42%;transform:translate(-50%,-50%);border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 0 2px rgba(0,0,0,.25)}
#tc .jb.run{border-color:#ff8a1f}#tc .jb.run .jk{background:#ff8a1f}
#tc .lock{position:absolute;left:50%;bottom:calc(100% + 26%);transform:translateX(-50%);width:44px;height:44px;border-radius:50%;display:none;place-items:center;background:rgba(10,14,20,.5);border:2px solid rgba(255,255,255,.35)}
#tc .lock svg{width:22px;height:22px;stroke:#fff;fill:none;stroke-width:2}
#tc .jb.drag .lock{display:grid}#tc .jb.lockon .lock{background:#ff8a1f;border-color:#ff8a1f}
#tc .runlock{position:absolute;left:50%;top:-34px;transform:translateX(-50%);font-size:11px;letter-spacing:2px;color:#ff8a1f;display:none;white-space:nowrap}
#tc .jb.locked .runlock{display:block}
#tc .b{position:absolute;display:grid;place-items:center;border-radius:50%;background:rgba(10,14,20,.45);border:2px solid rgba(255,255,255,.3)}
#tc .b svg{width:46%;height:46%;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
#tc .b.on{background:rgba(255,138,31,.55);border-color:#ff8a1f}
#tc .b.fire{background:rgba(200,50,30,.4);border-color:rgba(255,120,90,.7)}#tc .b.fire.on{background:rgba(255,80,40,.7)}
#tc .b.sm{border-radius:10px}
#tc .b.hid{display:none}
#tc .b.zh{display:none!important}      /* role göre yok (zombi: silah butonları / insan: güç butonu), düzenleyicide de */
#tc .b[data-b=abil]{border-color:rgba(160,160,160,.5)}
#tc .b[data-b=abil] svg.i{width:40%;height:40%;margin-bottom:16%}
#tc .b[data-b=abil] .rg{position:absolute;inset:-4px;width:auto;height:auto;transform:rotate(-90deg);margin:0}
#tc .b[data-b=abil] .rg circle{fill:none;stroke:#8dff5a;stroke-width:3;stroke-linecap:round;transition:stroke-dashoffset .1s linear}
#tc .b[data-b=abil].cd .rg circle{stroke:#b9b9b9}#tc .b[data-b=abil].act .rg circle{stroke:#ff8a1f}
#tc .b[data-b=abil].rdy{background:rgba(90,190,50,.5);border-color:#8dff5a;box-shadow:0 0 14px 2px rgba(141,255,90,.55)}
#tc .b[data-b=abil].act{background:rgba(255,138,31,.55);border-color:#ff8a1f}
#tc .b[data-b=abil].cd svg.i{opacity:.55}
#tc .b[data-b=optic] svg{width:50%;height:50%;margin-bottom:22%}
#tc .b .ol{position:absolute;left:0;right:0;bottom:17%;text-align:center;color:#fff;font-weight:700;font-style:normal;letter-spacing:.5px;pointer-events:none;white-space:nowrap}
/* nişangâh seçici (oyun katmanı #tc'nin DIŞINDA: kartlara dokunmak tıklama üretsin) */
#tcOp{position:fixed;inset:0;z-index:8;display:none;place-items:center;background:radial-gradient(circle at 50% 45%,rgba(4,6,10,.2),rgba(4,6,10,.7));font-family:Bahnschrift,'Rajdhani','Arial Narrow',system-ui,sans-serif;color:#e8edf5;touch-action:manipulation;user-select:none;-webkit-user-select:none}
#tcOp.on{display:grid}
#tcOp .w{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:-6vh}
#tcOp h5{margin:0;font-size:13px;letter-spacing:4px;font-weight:600;opacity:.85}#tcOp h5 small{opacity:.6;letter-spacing:1px;margin-left:8px}
#tcOp .cs{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;max-width:92vw}
#tcOp button{min-width:max(92px,17vh);min-height:max(84px,24vh);padding:8px 12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(9,13,19,.86);border:2px solid rgba(255,255,255,.22);color:inherit;font:inherit;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:10px}
#tcOp button.cur{border-color:#7be07a;background:rgba(20,48,24,.9)}#tcOp button:active{border-color:#ff8a1f;background:rgba(80,42,8,.9)}
#tcOp button small{font-size:11px;font-weight:400;opacity:.7;letter-spacing:.5px;text-transform:none}
#tcOp button svg{width:34px;height:34px}
#tcOp .hint{font-size:11px;opacity:.55;letter-spacing:1px}
#tcEd .ep .rp{display:inline-grid;place-items:center;width:46px;height:40px;background:#c9b48a}
#tcEd .ep .rp i{width:24px;height:24px;border-radius:50%;border:2px solid #ff3326;display:grid;place-items:center;transform:scale(var(--rs,1))}
#tcEd .ep .rp i::before{content:'';width:5px;height:5px;border-radius:50%;background:#ff2414;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
#tc.sb .b:not([data-b=score]),#tc.sb .jb{visibility:hidden}
#tc.scoped .b:not(.fire):not([data-b=ads]):not([data-b=breath]),#tc.scoped .jb{opacity:.3!important}
#tc .rot{position:fixed;inset:0;z-index:30;display:none;place-items:center;background:#0b0e13;color:#fff;font-size:18px;text-align:center;padding:24px;letter-spacing:1px}
@media (orientation:portrait){#tc .rot{display:grid}}
/* düzen düzenleyici */
#tc.edit{background:rgba(5,8,12,.86);z-index:40}
#tc.edit .b,#tc.edit .jb{outline:2px dashed rgba(255,255,255,.45);outline-offset:3px;pointer-events:auto;cursor:move}
#tc.edit .b.hid{display:grid;opacity:.25!important}
#tc.edit .sel{outline-color:#ff8a1f}
#tcEd .ep{position:fixed;z-index:41;touch-action:auto;font-family:Bahnschrift,'Rajdhani','Arial Narrow',system-ui,sans-serif;left:50%;top:8px;transform:translateX(-50%);width:min(600px,76vw);max-height:calc(100vh - 16px);box-sizing:border-box;overflow:auto;-webkit-overflow-scrolling:touch;background:rgba(9,13,19,.94);border:1px solid rgba(255,255,255,.18);padding:10px 14px;color:#e8edf5;font-size:12px;display:none;pointer-events:auto;transition:opacity .15s}
#tcEd.on .ep{display:block}
#tcEd.dragging .ep{opacity:.12;pointer-events:none}
#tcEd .ep.min .body{display:none}
#tcEd .ep.min{top:50%;left:41%;transform:translate(-50%,-50%);width:auto}#tcEd .ep.min h4{display:none}
#tcEd .ep h4{margin:0;font-size:13px;letter-spacing:3px;color:#ffb347;text-transform:uppercase;flex:1}
#tcEd .ep .row{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap}
#tcEd .ep .lb{width:118px;opacity:.8;font-size:13px}
#tcEd .ep input[type=range]{flex:1;min-width:120px;height:40px;margin:0;accent-color:#ff8a1f}
#tcEd .ep .v{width:40px;text-align:right}
#tcEd .ep .seg{display:inline-flex;border:1px solid rgba(255,255,255,.2)}
#tcEd .ep .seg button,#tcEd .ep .tb{background:transparent;border:0;color:#cfd6e0;padding:6px 12px;font:inherit;font-size:13px;letter-spacing:1px;min-height:40px;min-width:44px}
#tcEd .ep .seg button.on{background:#ff8a1f;color:#160a02;font-weight:700}
#tcEd .ep .tb{border:1px solid rgba(255,255,255,.25)}
#tcEd .ep .tb.pri{background:#ff8a1f;color:#160a02;font-weight:700;border-color:#ff8a1f}
#tcEd .ep .tabs{display:flex;gap:6px}
#tcEd .ep .hint{opacity:.6;margin-top:6px}
#tcEd .ep .acts{position:sticky;bottom:-10px;margin-bottom:-10px;padding:6px 0 10px;background:rgba(9,13,19,.97)}      /* Kaydet / İptal hep görünür (kısa ekranda panel kayar) */
/* telefon HUD'u: masaüstü boyutundaki öğeler orantılı küçülür; mermi sağ üste, öldürme bildirimi mini haritanın altına (butonlara binmesin) */
body.mob #mmwrap{zoom:.5;left:10px;top:10px}
body.mob #topbar{zoom:.62;top:6px}
body.mob #killfeed{zoom:.58;top:calc(25vh / .58);bottom:auto;left:calc((8vw + 9vh + 10px) / .58);right:auto;align-items:flex-start}
body.mob #killfeed .kf{border-right:0;border-left:3px solid #888}body.mob #killfeed .kf.me{border-left-color:#ff8a1f}
body.mob #vitals{zoom:.55;left:16px;bottom:10px}
body.mob #ammo{zoom:.55;right:20px;top:14px;bottom:auto}
body.mob #toasts{zoom:.7;top:90px}
body.mob #abil,body.mob #msg,body.mob #zonew,body.mob #bosses{zoom:.65}
body.mob #abil #abk{display:none}      /* telefonda güç göstergesinde tuş etiketi (F / sağ tık) yok: güç butonu var */
body.mob #pops{zoom:.75;top:auto;bottom:calc((50vh + 34px) / .75);justify-content:flex-end}      /* 12.165: + puan / +ASİST yığını telefonda nişangâhın üstünde, yukarı büyür (öldürme kartı nişangâhın altında; eskiden üst üste biniyordu) */
body.mob #msg{left:calc(42vw / .65);top:calc(60vh / .65);width:max-content;max-width:calc(32vw / .65);white-space:normal;text-align:center;line-height:1.35}      /* durum mesajı joystick ile butonlar arasında, kayarak satıra bölünür */
/* sohbet (çevrimiçi): joystick ile şarjör butonu arasında, alt ortada; mesajlar yine 9 sn sonra solar */
body.mob #chat{zoom:.62;left:calc((15vw + 20vh) / .62);bottom:calc(3vh / .62);width:calc(32vw / .62)}
body.mob #chlog{max-height:calc(24vh / .62)}
body.mob #roombadge{zoom:.7;left:auto!important;right:calc((7vw + 8vh + 6px) / .7);top:calc(76px / .7)!important}      /* oda rozeti: sağ üstte, silah yuvalarının altında, nişan butonunun solunda (sol ateş / joystick üstünde kalıyordu) */
`;

export const isTouch = () => {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
};
function loadCfg() { try { const c = JSON.parse(localStorage.getItem(KEY) || '{}'); return { ...DEF, ...c, layout: { ...(c.layout || {}) } }; } catch { return { ...DEF, layout: {} }; } }
function saveCfg(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* yok say */ } }

export class TouchControls {
  constructor(player) {
    this.p = player; this.g = player.game;
    this.cfg = loadCfg();
    this.f = 0; this.r = 0; this.sprint = false; this.jump = false; this.runLock = false; this.breath = false;
    this.joy = null; this.looks = new Map(); this.btnTouch = new Map();
    if (!document.getElementById('tcCss')) { const st = document.createElement('style'); st.id = 'tcCss'; st.textContent = CSS; document.head.appendChild(st); }
    const el = (this.el = document.createElement('div'));
    el.id = 'tc'; el.className = 'off';
    el.innerHTML = `<div class="jb" data-k="joy"><div class="jk"></div><div class="lock"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></div><div class="runlock">${t('tc.runLock')}</div></div>
      <div class="rot">${t('tc.rot')}<br><small style="opacity:.6;font-size:13px">${t('tc.rotSub')}</small></div>`;
    document.body.appendChild(el);
    // ayar paneli oyun katmanının DIŞINDA: #tc'nin touch-action:none'ı ve dokunma engeli panelin düğme / kaydırıcılarına geçmesin
    this.ed = document.createElement('div'); this.ed.id = 'tcEd'; this.ed.innerHTML = '<div class="ep"></div>';
    document.body.appendChild(this.ed);
    document.body.classList.add('mob');
    // nişangâh seçici: dışarı dokunmak kapatır, karta dokunmak seçer
    this.op = document.createElement('div'); this.op.id = 'tcOp';
    this.op.addEventListener('click', (e) => { const b = e.target.closest('[data-o]'); if (b) this.p.pickOptic(b.dataset.o); this.closeOptics(); });
    document.body.appendChild(this.op);
    this.jb = el.querySelector('.jb'); this.jk = el.querySelector('.jk'); this.ep = this.ed.querySelector('.ep');
    this.b = {};
    for (const id of Object.keys(LAYOUT)) {
      if (id === 'joy') continue;
      const d = document.createElement('div');
      d.className = 'b' + (id === 'fire' || id === 'fire2' ? ' fire' : '') + (id === 'pause' || id === 'score' ? ' sm' : '');
      d.dataset.b = id; d.dataset.k = id;
      d.innerHTML = id === 'abil' ? `<svg class="rg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18.5" pathLength="100" stroke-dasharray="100"/></svg><svg class="i" viewBox="0 0 24 24">${I[id]}</svg><i class="ol"></i>`
        : `<svg viewBox="0 0 24 24">${I[id]}</svg>${id === 'optic' ? '<i class="ol"></i>' : ''}`;
      el.appendChild(d);
      this.b[id] = d;
    }
    this.layout();
    const opt = { passive: false };
    this.h = { s: (e) => this.start(e), m: (e) => this.move(e), e: (e) => this.end(e), rs: () => this.layout() };
    el.addEventListener('touchstart', this.h.s, opt);
    el.addEventListener('touchmove', this.h.m, opt);
    el.addEventListener('touchend', this.h.e, opt);
    el.addEventListener('touchcancel', this.h.e, opt);
    addEventListener('resize', this.h.rs);
    this.gyroOn();
    // görünürlük oyun döngüsünden bağımsız (duraklatılınca oyun güncellemesi durur, butonlar menünün üstünde kalmasın)
    const tick = () => { if (!this.el.isConnected) return; this.update(); this._raf = requestAnimationFrame(tick); };
    this._raf = requestAnimationFrame(tick);
    const pt = document.getElementById('ptext');
    if (pt) pt.textContent = t('pause.introTouch');
    // duraklat menüsüne "Dokunmatik ayarlar"
    const set = document.getElementById('bSet');
    if (set && !document.getElementById('bTouch')) {
      const b = document.createElement('button');
      b.id = 'bTouch'; b.className = set.className; b.textContent = t('tc.title');
      b.onclick = () => this.openEditor();
      set.after(b);
    }
  }

  pos(id) { return { ...LAYOUT[id], ...(this.cfg.layout[id] || {}) }; }

  // Butonları ekrana yerleştir (oran → piksel); saydamlık, sol ateş ve 3. şahıs görünürlüğü
  layout() {
    const W = innerWidth, H = innerHeight, op = this.cfg.opacity;
    const place = (d, L) => { const sz = L.s * H; Object.assign(d.style, { width: sz + 'px', height: sz + 'px', left: L.x * W - sz / 2 + 'px', top: L.y * H - sz / 2 + 'px' }); };
    for (const [id, d] of Object.entries(this.b)) { place(d, this.pos(id)); d.style.opacity = op; d.classList.toggle('sel', !!this.editing && this.sel === id); }
    this.b.fire2.classList.toggle('hid', !this.cfg.leftFire);
    this.b.third.classList.toggle('hid', !this.g.thirdAllowed);
    for (const k of ['optic', 'abil']) this.b[k].querySelector('.ol').style.fontSize = Math.max(8, this.pos(k).s * H * (k === 'abil' ? 0.15 : 0.17)) + 'px';
    document.body.style.setProperty('--rs', this.cfg.retSz || 1);                           // HUD nişangâh boyutu (hud.js body.mob #rdot / #holo / #idot)
    this.jR = (this.pos('joy').s * H) / 2;
    if (!this.joy || this.cfg.joy === 'fixed') this.homeJoy();
    this.jb.style.opacity = op;
    this.jb.classList.toggle('sel', !!this.editing && this.sel === 'joy');
    this.jb.classList.toggle('float', this.cfg.joy === 'float' && !this.editing && !this.joy && !this.runLock);
  }
  homeJoy() { const L = this.pos('joy'), H = innerHeight, sz = L.s * H; Object.assign(this.jb.style, { width: sz + 'px', height: sz + 'px', left: L.x * innerWidth - sz / 2 + 'px', top: L.y * H - sz / 2 + 'px' }); this.jbc = { x: L.x * innerWidth, y: L.y * H }; }

  start(e) {
    if (this.editing) return;                               // düzenleyicide panel düğmelerinin tıklaması (click) üretilmeli: varsayılanı engelleme
    e.preventDefault();                                     // kaydırma / yakınlaştırma / sahte fare olayı yok
    this.g.sfx?.init?.();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    for (const t of e.changedTouches) {
      const bt = t.target.closest?.('[data-b]');
      if (bt && !bt.classList.contains('hid')) { this.btnTouch.set(t.identifier, bt.dataset.b); this.press(bt.dataset.b, true, t); continue; }
      const slot = this.slotAt(t.clientX, t.clientY);
      if (slot >= 0) { if (this.p.s.alive && this.p.s.canEquip(slot)) this.p.s.switchTo(slot); continue; }
      if (t.clientX < innerWidth * 0.45 && !this.joy) {
        this.runLock = false; this.jb.classList.remove('locked');
        if (this.cfg.joy === 'float') { const sz = this.jR * 2; Object.assign(this.jb.style, { left: t.clientX - sz / 2 + 'px', top: t.clientY - sz / 2 + 'px', width: sz + 'px', height: sz + 'px' }); this.jbc = { x: t.clientX, y: t.clientY }; this.jb.classList.remove('float'); }
        this.joy = { id: t.identifier };
        this.jb.classList.add('drag');
        this.setJoy(t.clientX - this.jbc.x, t.clientY - this.jbc.y);
      } else this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  }

  move(e) {
    if (this.editing) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) { this.setJoy(t.clientX - this.jbc.x, t.clientY - this.jbc.y); continue; }
      const L = this.looks.get(t.identifier);
      if (L) {
        this.lookBy(t.clientX - L.x, t.clientY - L.y); L.x = t.clientX; L.y = t.clientY;
        if (L.btn) L.btn.style.transform = `translate(${t.clientX - L.x0}px,${t.clientY - L.y0}px)`;     // hareketli ateş butonu parmağı izler
      }
    }
  }

  end(e) {
    if (this.editing) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const bid = this.btnTouch.get(t.identifier);
      if (bid) { this.btnTouch.delete(t.identifier); this.press(bid, false, t); continue; }
      if (this.joy && t.identifier === this.joy.id) {
        this.joy = null; this.jb.classList.remove('drag');
        if (this.jb.classList.contains('lockon')) { this.runLock = true; this.jb.classList.add('locked'); }   // kilit işaretinde bırakıldı: otomatik koşu
        this.jb.classList.remove('lockon');
        this.setJoy(0, 0);
        if (this.cfg.joy === 'float' && !this.runLock) this.jb.classList.add('float');
        continue;
      }
      this.looks.delete(t.identifier);
    }
  }

  // Joystick: analog f / r (−1..1, ölü bölge %12); kenara kadar ileri = koşu; yukarıda kilit işareti
  setJoy(dx, dy) {
    const R = this.jR || 60, l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    this.jk.style.transform = `translate(calc(-50% + ${dx * k}px),calc(-50% + ${dy * k}px))`;
    this.jb.classList.toggle('lockon', !!this.joy && dy < -R * 1.6 && Math.abs(dx) < R * 0.9);
    if (this.runLock) { this.f = 1; this.r = 0; this.sprint = true; this.jb.classList.add('run'); return; }
    if (l < R * 0.12) { this.f = 0; this.r = 0; this.sprint = false; this.jb.classList.remove('run'); return; }
    const nx = (dx * k) / R, ny = (dy * k) / R;
    this.f = Math.round(-ny * 100) / 100; this.r = Math.round(nx * 100) / 100;
    this.sprint = l > R * 0.95 && -ny > 0.75;
    this.jb.classList.toggle('run', this.sprint);
  }

  lookBy(dx, dy) {
    const p = this.p, s = p.s;
    if (!p.locked || !s.alive) return;
    const ads = s.adsT > 0.5, zoom = 1 / Math.pow(p.zoomCur(), 0.8);      // 12.127: büyütme payı sürekli (o anki büyütme); nişan hassasiyeti çarpanı (12.115) adsT 0,5'te aynen
    const k = 0.0055 * this.cfg.sens * (ads ? this.cfg.adsSens : 1) * ((p.set.sens || 0.0022) / 0.0022) * zoom * (this.aaSlow || 1);
    p.look(dx * k, dy * k);
    if (dx || dy) this.lookT = performance.now();
  }

  // ── Nişan yardımı (her sim adımında, Player.update'ten) ──
  // Aday: canlı düşman, göğsü nişangâha açısal olarak yakın (koni = 4° + gövde açısı, nişanda büyütmeyle daralır), 90 m'den yakın, gerçekten
  // görünür (game.botSees: duvar, duman, yaprak / çalı). (a) Sürtünme: üstündeyken parmak bakışı en çok %45 yavaşlar. (b) Mıknatıs: oyuncu
  // hareket ediyor / ateş ediyor / nişanda / parmakla bakıyorsa hedefe yumuşakça döner (hata ile orantılı, sınırlı hız: asla ani kilit yok;
  // uzakta zayıf). (c) Nişana girişte 0,18 sn daha güçlü çekiş. Çevrimiçinde de çalışır: yaw / pitch zaten istemciden gönderiliyor.
  // v2: koni ≈ 6,3° + gövde açısı, daha güçlü çekiş (≈75°/sn tavan), (d) takip: aynı hedef karede ne kadar açı kaydırdıysa nişangâh onun
  // büyük kısmıyla birlikte döner (koşan düşmanda geride kalmaz), (e) topçu silah (paintball): nişan noktası topun düşüşü + hedefin hızıyla öne alınır.
  assist(dt) {
    const p = this.p, g = this.g, s = p.s, c = this.cfg;
    this.aaSlow = 1; this._aaT = null;                                              // _aaT: son seçilen hedef (test / hata ayıklama)
    if (s.ads && !this._adsWas) this._snapT = 0.22;
    this._adsWas = !!s.ads;
    this._snapT = Math.max(0, (this._snapT || 0) - dt);
    const kind = s.stat.kind, st = s.stat;                                           // el bombası / mayın / sağlık çantasında yardım yok
    if (!c.aim || !(c.aimStr > 0) || !s.alive || !p.locked || this.editing || s.fly || (kind !== 'gun' && kind !== 'launcher' && kind !== 'melee')) { this._trk = null; return; }
    if (s.scoped && s.adsT < 0.5) { this._trk = null; return; }                    // 12.156: belden keskin nişancıda (artı yok, no-scope) nişan yardımı yok
    const e = s.eye(this._ae || (this._ae = new THREE.Vector3())), tp = this._at || (this._at = new THREE.Vector3());
    const ads = s.adsT > 0.5, z = ads ? Math.max(1, p.zoomEff()) : 1, pit = s.pitch + (s.recoilP || 0);
    let best = null, bw = 0;
    for (const o of g.soldiers) {
      if (o === s || !o.alive || o.vacant || o.team === s.team) continue;
      o.center(tp);
      let dx = tp.x - e.x, dy = tp.y - e.y, dz = tp.z - e.z, h = Math.hypot(dx, dz), d = Math.hypot(h, dy);
      if (d > 90 || d < 0.8) continue;
      if (!g.botSees(e, tp)) continue;
      const ay = Math.atan2(-dx, -dz), ap = Math.atan2(dy, h);                       // hedefin mutlak yönü (takip için)
      const wrap = (a) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
      let err = Math.hypot(wrap(ay - s.yaw) * Math.cos(pit), ap - pit);              // gövdeye göre hata (seçim: gövde ya da öne alınmış nokta, hangisi yakınsa)
      if (st.ball) {                                                                  // topçu silah: çekiş noktası uçuş süresi kadar öne + düşüş kadar yukarı
        const tf = d / (st.speed || 70), v = o.vel;
        if (v) { dx += v.x * tf; dz += v.z * tf; h = Math.hypot(dx, dz); }
        dy += 0.5 * (st.grav || 0) * tf * tf;
      }
      const ey = wrap(Math.atan2(-dx, -dz) - s.yaw), ep = Math.atan2(dy, h) - pit;
      err = Math.min(err, Math.hypot(ey * Math.cos(pit), ep));
      const cone = (0.11 + Math.atan(0.7 / d)) / Math.sqrt(z);
      if (err > cone) continue;
      const w = (1 - (err / cone) ** 2) * (d < 30 ? 1 : Math.max(0.35, 1 - (d - 30) / 70));
      if (w <= bw) continue;
      best = { ey, ep, o, d, ay, ap }; bw = w;
    }
    if (!best) { this._trk = null; return; }
    this._aaT = best; const str = Math.min(1.5, c.aimStr);
    this.aaSlow = 1 - Math.min(0.65, 0.55 * str * bw);
    const prev = this._trk; this._trk = { o: best.o, ay: best.ay, ap: best.ap };
    const looking = performance.now() - (this.lookT || 0) < 150;
    if (!(Math.abs(this.f) + Math.abs(this.r) > 0.1 || p.fireHeld || s.ads || looking)) return;
    let ty = 0, tpch = 0;                                                             // takip: hedefin bu karedeki açısal kayması (en çok 2 rad/sn)
    if (prev && prev.o === best.o) {
      let d = best.ay - prev.ay; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
      const f = Math.min(0.95, 0.85 * str * (0.5 + 0.5 * bw)), lim = 2.5 * dt;
      ty = Math.max(-lim, Math.min(lim, d * f)); tpch = Math.max(-lim, Math.min(lim, (best.ap - prev.ap) * f));
    }
    const k = 1 - Math.exp(-(this._snapT > 0 ? 12 : ads ? 7 : 5) * str * Math.max(0.45, bw) * dt), cap = 1.3 * dt;    // en çok ≈75°/sn; koni kenarında da çeker
    const my = Math.max(-cap, Math.min(cap, best.ey * k)), mp = Math.max(-cap, Math.min(cap, best.ep * k * 0.75));
    s.yaw += my + ty; s.pitch = Math.max(-1.5, Math.min(1.5, s.pitch + mp + tpch));
  }

  // HUD'daki silah yuvaları (#slots .slot): dokununca o silaha geç
  slotAt(x, y) {
    const list = document.querySelectorAll('#slots .slot');
    for (let i = 0; i < list.length; i++) { const r = list[i].getBoundingClientRect(); if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 6 && y <= r.bottom + 6) return +(list[i].dataset.i ?? i); }      // 12.140: şerit tuş sırasında; data-i = items indeksi
    return -1;
  }

  press(id, down, t) {
    const p = this.p, g = this.g, s = p.s;
    const b = this.b[id];
    if (b) b.classList.toggle('on', down && id !== 'ads' && id !== 'crouch');
    if (id === 'fire' || id === 'fire2') {
      if (down) {
        if (!p.locked) g.requestLock();
        p.fireHeld = true; p.fireBuf = 0.15; g.online?.edge('fp');
        const L = { x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, btn: id === 'fire' && this.cfg.fire === 'float' ? b : null };
        if (id === 'fire') this.looks.set(t.identifier, L);        // sağ ateş: basılıyken sürükleyerek nişan
      } else { p.fireHeld = this.anyFire(); this.looks.delete(t.identifier); if (b) b.style.transform = ''; }
      return;
    }
    if (id === 'breath') { this.breath = down; return; }                         // 12.156: basılı tutulduğu sürece nefes tut (Player → ScopeBreath)
    if (id === 'score') { g.hud.showScoreboard(down); return; }
    if (!down) { if (id === 'jump') this.jump = false; return; }
    if (id === 'pause') { g.togglePause(); return; }
    if (!s.alive) return;
    if (id === 'veh') { const V = g.vehicles; if (V && (s.veh || V.near(s))) { if (g.online) g.online.edge('ve'); else V.toggle(s); } return; }      // 12.177
    if (id === 'vcam') { if (s.veh) { p.vehCam = p.vehCam === 'first' ? 'third' : 'first'; } return; }
    if (id === 'seat') { const v = s.veh; if (v) { for (let k = 1; k <= v.seats.length; k++) { const n = (s.seat + k) % v.seats.length; if (!v.seats[n]) { if (g.online) g.online.edges.vs = n + 1; else g.vehicles.seatTo(s, n); break; } } } return; }
    if (s.veh && (id === 'crouch' || id === 'swap' && s.seat === 0 || id === 'nade' || id === 'third')) return;      // araçta çömelme / ekipman yok
    if (id === 'jump') { if (s.prone || s.crouching) { s.standUp(); g.online?.edge('u'); } else this.jump = true; }
    else if (id === 'crouch') { s.toggleCrouch(); g.online?.edge('c'); }
    else if (id === 'reload') { s.startReload(); g.online?.edge('rl'); }
    else if (id === 'ads') { s.ads = !s.ads; }
    else if (id === 'third') { p.toggleThird(); }
    else if (id === 'optic') { this.openOptics(); }
    else if (id === 'abil') { if (s.def.zombie) p.zAbility(); }                   // zombi özel gücü (çevrimiçinde sunucuya 'ab' kenarı)
    else if (id === 'swap') {                                                     // ana → yedek → yakın dövüş (boş yuvalar atlanır)
      const ord = [0, 1, 3], i = ord.indexOf(s.cur);
      for (let k = 1; k <= 3; k++) { const n = ord[(i + k + 3) % 3]; if (n !== s.cur && s.canEquip(n)) { s.switchTo(n); break; } }
    } else if (id === 'nade') { if (s.cur !== 2 && s.canEquip(2)) s.switchTo(2); else if (s.cur === 2) s.switchTo(0); }   // ekipmanı çek; tekrar basınca ana silah
  }
  // Nişangâh seçici: elimdeki silahın nişangâhları büyük kartlar halinde (mevcut yeşil); seçince / dışarı dokununca kapanır.
  // Çevrimdışı ve çevrimiçi aynı yol: Player.pickOptic (yerelde setOptic + sunucuya { t:'opt', optic }).
  openOptics() {
    const p = this.p, s = p.s, list = p.opticList();
    if (list.length < 2 || !s.alive) return;
    const now = s.opticId;
    this.op.innerHTML = `<div class="w"><h5>${t('tc.opTitle')}<small>${wName(s.item.id)}</small></h5><div class="cs">${list.map((id) => {
      const o = OPTICS[id];
      return `<button data-o="${id}" class="${id === now ? 'cur' : ''}"><svg viewBox="0 0 24 24">${OPI[id] || ''}</svg>${opticName(id)}<small>${o.zoom ? t('tc.opZoom', { n: +p.zoomOf(o.zoom, o).toFixed(2) }) : ''}</small></button>`;
    }).join('')}</div><div class="hint">${t('tc.opHint')}</div></div>`;
    this.op.classList.add('on'); this.opOpen = true;
  }
  closeOptics() { if (!this.opOpen) return; this.opOpen = false; this.op.classList.remove('on'); }
  anyFire() { for (const v of this.btnTouch.values()) if (v === 'fire' || v === 'fire2') return true; return false; }

  // ── Jiroskop: telefonu çevirerek nişan (kapalı / yalnız nişandayken / hep). iOS izin ister (ayarlarda açarken). ──
  // Ham dönüş hızı (devicemotion.rotationRate) eksenleri tutuşa (dik / yatık) ve platforma (iOS ↔ Android) göre değişiyor: sağa-sola
  // çevirme bir tutuşta hiç ölçülmüyordu. Bunun yerine cihaz YÖNELİMİ (deviceorientation, dünya Z-yukarı, ZXY Euler) → kameranın
  // baktığı yön (ekran açısı dahil; three.js DeviceOrientationControls yöntemi) → yaw / pitch; her olayda bir öncekiyle farkı uygulanır.
  gyroOn() {
    if (this._gy) return;
    this._gq = new THREE.Quaternion(); this._ge = new THREE.Euler(); this._gf = new THREE.Vector3();
    this._gq1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); this._gq0 = new THREE.Quaternion(); this._gz = new THREE.Vector3(0, 0, 1);
    this._gy = (e) => {
      const c = this.cfg, s = this.p.s;
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      const D = Math.PI / 180, ang = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * D;
      this._ge.set(e.beta * D, e.alpha * D, -e.gamma * D, 'YXZ');
      this._gq.setFromEuler(this._ge).multiply(this._gq1).multiply(this._gq0.setFromAxisAngle(this._gz, -ang));
      const f = this._gf.set(0, 0, -1).applyQuaternion(this._gq);
      const yaw = Math.atan2(-f.x, -f.z), pitch = Math.asin(Math.max(-1, Math.min(1, f.y)));
      const prev = this._gp; this._gp = { yaw, pitch };
      const active = c.gyro !== 'off' && this.p.locked && s.alive && !this.editing && (c.gyro !== 'ads' || s.ads);
      if (!prev || !active) return;
      let dy = yaw - prev.yaw; dy -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;      // ±180° sarması
      const dp = pitch - prev.pitch;
      if (Math.abs(dy) > 0.5 || Math.abs(dp) > 0.5) return;                           // sıçrama (ilk olay / yön değişimi) yok sayılır
      const k = c.gyroSens;
      if (Math.abs(pitch) < 1.35) s.yaw += dy * k * (c.gyroInvX ? -1 : 1);           // tam yukarı / aşağı bakarken yaw kararsız
      s.pitch = Math.max(-1.5, Math.min(1.5, s.pitch + dp * k * (c.gyroInvY ? -1 : 1)));
    };
    addEventListener('deviceorientation', this._gy);
  }
  async gyroPermission() {
    for (const E of [window.DeviceOrientationEvent, window.DeviceMotionEvent]) {
      if (E && typeof E.requestPermission === 'function') { try { if ((await E.requestPermission()) !== 'granted') return false; } catch { return false; } }
    }
    return true;
  }

  // ── Düzen düzenleyici ──
  openEditor() {
    if (this.editing) return;
    this.editing = true; this.sel = 'fire'; this.tab = 'layout'; this.closeOptics();
    this.backup = JSON.parse(JSON.stringify(this.cfg));
    this.el.classList.remove('off'); this.el.classList.add('edit'); this.ed.classList.add('on');
    this.layout();
    this.drawPanel();
    this._pd = (e) => {
      const tgt = e.target.closest('[data-k]');
      if (!tgt) return;
      e.preventDefault();
      const id = tgt.dataset.k, L = this.pos(id);
      this.sel = id; this.drawPanel(); this.layout();
      const ox = e.clientX - L.x * innerWidth, oy = e.clientY - L.y * innerHeight;
      this.el.classList.add('dragging'); this.ed.classList.add('dragging');
      const mv = (ev) => { this.cfg.layout[id] = { ...this.pos(id), x: Math.max(0.03, Math.min(0.97, (ev.clientX - ox) / innerWidth)), y: Math.max(0.04, Math.min(0.96, (ev.clientY - oy) / innerHeight)) }; this.layout(); };
      const up = () => { this.el.classList.remove('dragging'); this.ed.classList.remove('dragging'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    this.el.addEventListener('pointerdown', this._pd);
  }
  drawPanel() {
    const c = this.cfg, sel = this.sel, L = this.pos(sel), base = LAYOUT[sel].s;
    const seg = (k, opts) => `<span class="seg">${opts.map(([v, lb]) => `<button data-set="${k}" data-v="${v}" class="${String(c[k]) === String(v) ? 'on' : ''}">${t(lb)}</button>`).join('')}</span>`;
    const rng = (k, lo, hi, st, val, txt) => `<div class="row"><span class="lb">${t(txt)}</span><input type="range" data-r="${k}" min="${lo}" max="${hi}" step="${st}" value="${val}"><span class="v">${Math.round(val * 100)}%</span></div>`;
    this.ep.classList.toggle('min', !!this.min);
    this.ep.innerHTML = `<div class="row" style="margin-top:0"><h4>${t('tc.title')}</h4><span class="tabs"><button class="tb ${this.tab === 'layout' ? 'pri' : ''}" data-tab="layout">${t('tc.tLayout')}</button><button class="tb ${this.tab === 'sens' ? 'pri' : ''}" data-tab="sens">${t('tc.tSens')}</button><button class="tb" data-min>${t(this.min ? 'tc.open' : 'tc.hide')}</button></span></div>
      <div class="body">${this.tab === 'layout' ? `<div class="hint">${t('tc.dragHint')} <b style="color:#ff8a1f">${NAME(sel)}</b></div>${this._zb ? '' : `<div class="hint">${t('tc.zHint')}</div>`}
        ${rng('size', 0.5, 1.8, 0.05, L.s / base, 'tc.size')}
        ${rng('opacity', 0.2, 1, 0.05, c.opacity, 'tc.opacity')}
        <div class="row"><span class="lb">${t('tc.joy')}</span>${seg('joy', [['fixed', 'tc.fixed'], ['float', 'tc.float']])}</div>
        <div class="row"><span class="lb">${t('tc.rFire')}</span>${seg('fire', [['fixed', 'tc.fixed'], ['float', 'tc.follow']])}</div>
        <div class="row"><span class="lb">${t('tc.lFire')}</span>${seg('leftFire', [[true, 'tc.on'], [false, 'tc.off']])}</div>`
      : `${rng('sens', 0.3, 2.5, 0.05, c.sens, 'tc.sens')}${rng('adsSens', 0.2, 1.5, 0.05, c.adsSens, 'tc.adsSens')}
        <div class="row"><span class="lb">${t('tc.gyro')}</span>${seg('gyro', [['off', 'tc.off'], ['ads', 'tc.gyroAds'], ['on', 'tc.gyroOn']])}</div>
        ${rng('gyroSens', 0.2, 3, 0.05, c.gyroSens, 'tc.gyroSens')}
        <div class="row"><span class="lb">${t('tc.gyroDir')}</span>${seg('gyroInvX', [[false, 'tc.hN'], [true, 'tc.hI']])} ${seg('gyroInvY', [[false, 'tc.vN'], [true, 'tc.vI']])}</div>
        <div class="hint">${t('tc.gyroHint')}</div>
        <div class="row"><span class="lb">${t('tc.aim')}</span>${seg('aim', [[true, 'tc.on'], [false, 'tc.off']])}</div>
        ${rng('aimStr', 0.2, 1.5, 0.05, c.aimStr, 'tc.aimStr')}
        <div class="row"><span class="lb">${t('tc.retSz')}</span><input type="range" data-r="retSz" min="0.6" max="1.8" step="0.05" value="${c.retSz || 1}"><span class="v">${Math.round((c.retSz || 1) * 100)}%</span><span class="rp"><i></i></span></div>
        <div class="hint">${t('tc.aimHint')}</div>`}</div>
      <div class="row acts" style="justify-content:flex-end;margin-top:${this.min ? 6 : 8}px"><button class="tb" data-act="reset">${t('tc.reset')}</button><button class="tb" data-act="cancel">${t('tc.cancel')}</button><button class="tb pri" data-act="save">${t('tc.save')}</button></div>`;
    this.ep.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.min = false; this.drawPanel(); }));
    this.ep.querySelector('[data-min]').onclick = () => { this.min = !this.min; this.drawPanel(); };
    this.ep.querySelectorAll('[data-set]').forEach((b) => (b.onclick = async () => {
      const k = b.dataset.set, raw = b.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : raw;
      if (k === 'gyro' && v !== 'off' && !(await this.gyroPermission())) { this.g.hud.toast(t('tc.gyroDenied'), '#ffd27a'); return; }
      c[k] = v; this.layout(); this.drawPanel();
    }));
    this.ep.querySelectorAll('[data-r]').forEach((r) => (r.oninput = () => {
      const k = r.dataset.r, v = +r.value;
      if (k === 'size') c.layout[sel] = { ...this.pos(sel), s: LAYOUT[sel].s * v };
      else c[k] = v;
      r.nextElementSibling.textContent = Math.round(v * 100) + '%';
      this.layout();
    }));
    this.ep.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'reset') { this.cfg = { ...DEF, layout: {} }; this.layout(); this.drawPanel(); return; }
      if (a === 'cancel') this.cfg = this.backup;
      if (a === 'save') { saveCfg(this.cfg); this.g.hud.toast(t('tc.saved'), '#9fe6a8'); }
      this.closeEditor();
    }));
  }
  closeEditor() {
    this.editing = false;
    this.el.classList.remove('edit'); this.ed.classList.remove('on', 'dragging');
    this.el.removeEventListener('pointerdown', this._pd);
    this.layout();
  }

  // Her kare: ölü / duraklatılmış / maç bitti → kontroller gizli (ölüm ekranındaki kartlara dokunulabilsin); nişan / çömelme / ekipman durumu
  update() {
    if (this.editing) return;
    const p = this.p, g = this.g, s = p.s;
    const show = s.alive && g.simulate && !g.ended && p.locked;
    this.el.classList.toggle('off', !show);
    if (!show) {
      this.closeOptics();
      this.f = this.r = 0; this.sprint = this.jump = this.breath = false; this.runLock = false; this.joy = null; this.looks.clear();
      this.jb.classList.remove('drag', 'run', 'locked', 'lockon');
      if (this.cfg.joy === 'float') this.jb.classList.add('float');
      if (p.fireHeld && this.anyFire()) p.fireHeld = false;
      this.btnTouch.clear(); return;
    }
    if (this.runLock) this.setJoy(0, -1);
    this.el.classList.toggle('sb', !!g.hud.sbShown);                                       // skor tablosu açıkken yalnız Skor butonu (tabloyu örtmesin)
    this.el.classList.toggle('scoped', s.overlay === 'scope' && s.adsT > 0.9);            // dürbünde butonlar soluklaşır (görüş açık kalsın)
    this.b.ads.classList.toggle('on', !!s.ads);
    const bv = s.overlay === 'scope' && s.adsT > 0.6;                                     // 12.156: nefes düğmesi yalnız dürbündeyken
    if (bv !== this._bv) { this._bv = bv; this.b.breath.classList.toggle('hid', !bv); if (!bv) { this.breath = false; this.b.breath.classList.remove('on'); } }
    this.b.crouch.classList.toggle('on', !!(s.crouching || s.prone));
    this.b.nade.classList.toggle('on', s.cur === 2);
    this.b.third.classList.toggle('on', !!p.third);
    {                                                                                      // 12.177 araç butonları: bin / in yalnız araç yanında ya da içindeyken; kamera sürücüde; koltuk araçta
      const V = g.vehicles, inV = !!s.veh, near = !inV && V ? !!V.near(s) : false, drv = inV && s.seat === 0;
      const key = (inV ? 1 : 0) | (near ? 2 : 0) | (drv ? 4 : 0);
      if (key !== this._vk) {
        this._vk = key;
        this.b.veh.classList.toggle('hid', !inV && !near); this.b.veh.classList.toggle('on', inV);
        this.b.vcam.classList.toggle('hid', !drv); this.b.seat.classList.toggle('hid', !inV);
        for (const k of ['crouch', 'nade', 'third']) this.b[k].classList.toggle('vh', inV);
        for (const k of ['ads', 'reload', 'swap', 'optic']) this.b[k].classList.toggle('vh', drv);
      }
    }
    // zombi: güç butonu (halka = bekleme / etkin süre), silah butonları yok
    const zb = !!s.def.zombie, ab = zb ? s.ability : null;
    if (zb !== this._zb) { this._zb = zb; for (const k of ['ads', 'optic', 'reload', 'swap', 'nade']) this.b[k].classList.toggle('zh', zb); this.b.abil.classList.toggle('zh', !zb); }
    if (ab) {
      const act = s.abActive > 0, rdy = s.abT <= 0 && !act, B = this.b.abil;
      const f = act ? s.abActive / ab.dur : rdy ? 1 : 1 - s.abT / ab.cd;
      const st = act ? 'act' : rdy ? 'rdy' : 'cd', txt = act ? s.abActive.toFixed(1) : rdy ? t('tc.ready') : String(Math.ceil(s.abT));
      if (st !== this._abS) { this._abS = st; B.classList.remove('act', 'rdy', 'cd'); B.classList.add(st); }
      if (txt !== this._abTx) { this._abTx = txt; B.querySelector('.ol').textContent = txt; }
      const off = (100 - Math.max(0, Math.min(1, f)) * 100).toFixed(1);
      if (off !== this._abO) { this._abO = off; B.querySelector('.rg circle').style.strokeDashoffset = off; }
    }
    const n = zb ? 0 : p.opticList().length, oid = s.opticId;
    this.b.optic.classList.toggle('hid', n < 2);                                             // tek nişangâhlı silahta (dürbünlü tüfekler, çifte, revolver, RPG, M79) gizli
    if (n < 2) this.closeOptics();
    if (oid !== this._oid) { this._oid = oid; this.b.optic.querySelector('.ol').textContent = opLabel(oid); }
  }

  dispose() { cancelAnimationFrame(this._raf); removeEventListener('resize', this.h.rs); removeEventListener('deviceorientation', this._gy); this.el.remove(); this.ed.remove(); this.op.remove(); document.body.classList.remove('mob'); document.body.style.removeProperty('--rs'); document.getElementById('bTouch')?.remove(); }
}
