// Dokunmatik kontroller (telefon / tablet). Klavye ile aynı girdiyi üretir: f / r (−1, 0, 1), koşu, zıplama, ateş.
// Sol yarı: parmağın değdiği yerde beliren joystick (sonuna kadar ileri = koşu). Sağ yarı: kaydırarak bakış.
// Butonlar: ateş (sürüklerken nişan da alır), nişan, zıpla, çömel, şarjör, silah değiştir, bomba / ekipman, skor, duraklat.
// Masaüstünde denemek için: ?touch=1
const CSS = `
#tc{position:fixed;inset:0;z-index:6;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;font-family:Bahnschrift,'Rajdhani','Arial Narrow',system-ui,sans-serif}
#tc.off{display:none}
#tc .jb{position:absolute;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;border:2px solid rgba(255,255,255,.28);background:rgba(10,14,20,.25);display:none;pointer-events:none}
#tc .jk{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 0 2px rgba(0,0,0,.25)}
#tc .jb.run{border-color:#ff8a1f}
#tc .jb.run .jk{background:#ff8a1f}
#tc .jh{position:absolute;left:calc(env(safe-area-inset-left) + 13vw);bottom:28vh;width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;border:2px dashed rgba(255,255,255,.18);pointer-events:none}
#tc .b{position:absolute;display:grid;place-items:center;border-radius:50%;background:rgba(10,14,20,.45);border:2px solid rgba(255,255,255,.3);color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;line-height:1.05}
#tc .b svg{width:46%;height:46%;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#tc .b.on{background:rgba(255,138,31,.55);border-color:#ff8a1f}
#tc .b.fire{background:rgba(200,50,30,.4);border-color:rgba(255,120,90,.7)}
#tc .b.fire.on{background:rgba(255,80,40,.7)}
#tc .b.sm{border-radius:10px;font-size:10px}
/* telefon HUD'u: masaüstü boyutundaki öğeler orantılı küçülür; mermi sağ üste (sağ alt butonlara kalır) */
body.mob #mmwrap{zoom:.5;left:10px;top:10px}
body.mob #topbar{zoom:.62;top:6px}
body.mob #killfeed{zoom:.58;top:auto;bottom:52vh;right:12px}
body.mob #vitals{zoom:.55;left:16px;bottom:10px}
body.mob #ammo{zoom:.55;right:20px;top:14px;bottom:auto}
body.mob #toasts{zoom:.7;top:90px}
body.mob #abil,body.mob #msg,body.mob #zonew,body.mob #bosses{zoom:.65}
body.mob #pops{zoom:.75}
#tc .rot{position:fixed;inset:0;z-index:30;display:none;place-items:center;background:#0b0e13;color:#fff;font-size:18px;text-align:center;padding:24px;letter-spacing:1px}
@media (orientation:portrait){#tc .rot{display:grid}}
`;
const I = {
  fire: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  ads: '<circle cx="12" cy="12" r="3"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3"/><circle cx="12" cy="12" r="8"/>',
  jump: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  crouch: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  reload: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  nade: '<circle cx="12" cy="14" r="6"/><path d="M12 8V5h4M10 4h4"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  score: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

export const isTouch = () => {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
};

export class TouchControls {
  constructor(player) {
    this.p = player; this.g = player.game;
    this.f = 0; this.r = 0; this.sprint = false; this.jump = false;
    this.sens = 0.0055;                            // radyan / piksel (ayarlardaki hassasiyetle ölçeklenir)
    this.joy = null; this.looks = new Map(); this.btnTouch = new Map();
    if (!document.getElementById('tcCss')) { const st = document.createElement('style'); st.id = 'tcCss'; st.textContent = CSS; document.head.appendChild(st); }
    const el = (this.el = document.createElement('div'));
    el.id = 'tc';
    el.className = 'off';
    el.innerHTML = `<div class="jh"></div><div class="jb"><div class="jk"></div></div><div class="rot">Telefonu yan çevir<br><small style="opacity:.6;font-size:13px">Oyun yatay ekranda oynanır</small></div>`;
    document.body.appendChild(el);
    document.body.classList.add('mob');
    this.jb = el.querySelector('.jb'); this.jk = el.querySelector('.jk');
    // buton: [ad, ikon/etiket, sağdan x (vw), alttan y (vh), boyut (px), sınıf]
    // boyutlar ekran yüksekliğine göre (vh), telefonda da tablette de başparmak erişiminde kalır
    const B = [
      ['fire', I.fire, 14, 24, 'min(104px,27vh)', 'fire'], ['ads', I.ads, 3, 52, 'min(64px,17vh)'], ['jump', I.jump, 3, 28, 'min(70px,19vh)'], ['crouch', I.crouch, 3, 5, 'min(60px,16vh)'],
      ['reload', I.reload, 26, 6, 'min(58px,15vh)'], ['swap', I.swap, 14.5, 3, 'min(58px,15vh)'], ['nade', I.nade, 25, 32, 'min(58px,15vh)'], ['fire2', I.fire, 0, 0, 'min(76px,20vh)', 'fire'],
      ['pause', I.pause, 0, 0, '40px', 'sm'], ['score', I.score, 0, 0, '40px', 'sm'],
    ];
    this.b = {};
    for (const [id, ico, x, y, sz, cls] of B) {
      const d = document.createElement('div');
      d.className = 'b ' + (cls || '');
      d.style.width = d.style.height = sz;
      if (id === 'pause') { d.style.left = 'calc(env(safe-area-inset-left) + 136px)'; d.style.top = '10px'; }        // mini haritanın sağında
      else if (id === 'score') { d.style.left = 'calc(env(safe-area-inset-left) + 182px)'; d.style.top = '10px'; }
      else if (id === 'fire2') { d.style.left = 'calc(env(safe-area-inset-left) + 3vw)'; d.style.top = '40vh'; }       // sol başparmakla da ateş (yürürken)
      else { d.style.right = `calc(env(safe-area-inset-right) + ${x}vw)`; d.style.bottom = `${y}vh`; }
      d.innerHTML = `<svg viewBox="0 0 24 24">${ico}</svg>`;
      d.dataset.b = id;
      el.appendChild(d);
      this.b[id] = d;
    }
    const opt = { passive: false };
    this.h = { s: (e) => this.start(e), m: (e) => this.move(e), e: (e) => this.end(e) };
    el.addEventListener('touchstart', this.h.s, opt);
    el.addEventListener('touchmove', this.h.m, opt);
    el.addEventListener('touchend', this.h.e, opt);
    el.addEventListener('touchcancel', this.h.e, opt);
    // görünürlük oyun döngüsünden bağımsız (duraklatılınca oyun güncellemesi durur, butonlar menünün üstünde kalmasın)
    const tick = () => { if (!this.el.isConnected) return; this.update(); this._raf = requestAnimationFrame(tick); };
    this._raf = requestAnimationFrame(tick);
    const pt = document.getElementById('ptext');
    if (pt) pt.textContent = 'Başlamak için BAŞLA\'ya dokun. Sol tarafta parmağınla yürü, sağ tarafta kaydırarak bak.';
  }

  start(e) {
    e.preventDefault();                                     // kaydırma / yakınlaştırma / sahte fare olayı yok
    this.g.sfx?.init?.();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    for (const t of e.changedTouches) {
      const bt = t.target.closest?.('[data-b]');
      if (bt) { this.btnTouch.set(t.identifier, bt.dataset.b); this.press(bt.dataset.b, true, t); continue; }
      if (t.clientX < innerWidth * 0.42 && !this.joy) {            // sol: joystick parmağın değdiği yerde
        this.joy = { id: t.identifier, x: t.clientX, y: t.clientY };
        Object.assign(this.jb.style, { left: t.clientX + 'px', top: t.clientY + 'px', display: 'block' });
        this.setJoy(0, 0);
      } else this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  }

  move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) { this.setJoy(t.clientX - this.joy.x, t.clientY - this.joy.y); continue; }
      const L = this.looks.get(t.identifier);
      if (L) { this.lookBy(t.clientX - L.x, t.clientY - L.y); L.x = t.clientX; L.y = t.clientY; }
    }
  }

  end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const bid = this.btnTouch.get(t.identifier);
      if (bid) { this.btnTouch.delete(t.identifier); this.press(bid, false, t); continue; }
      if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.jb.style.display = 'none'; this.setJoy(0, 0); continue; }
      this.looks.delete(t.identifier);
    }
  }

  // Joystick → klavyeyle aynı 8 yön (sunucu f / r'yi −1, 0, 1 alır); ileri sonuna kadar = koşu
  setJoy(dx, dy) {
    const R = 56, l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    this.jk.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    if (l < R * 0.28) { this.f = 0; this.r = 0; this.sprint = false; this.jb.classList.remove('run'); return; }
    const a = Math.atan2(-dy, dx), oct = Math.round(a / (Math.PI / 4));              // 8 dilim
    const dirs = { 0: [0, 1], 1: [1, 1], 2: [1, 0], 3: [1, -1], 4: [0, -1], '-4': [0, -1], '-3': [-1, -1], '-2': [-1, 0], '-1': [-1, 1] };
    [this.f, this.r] = dirs[oct];
    this.sprint = this.f === 1 && this.r === 0 && l > R * 1.05;
    this.jb.classList.toggle('run', this.sprint);
  }

  lookBy(dx, dy) {
    const p = this.p, s = p.s;
    if (!p.locked || !s.alive) return;
    const zoom = s.zoomNow && s.adsT > 0.5 ? 1 / Math.pow(s.zoomNow, 0.8) : 1;
    const k = this.sens * ((p.set.sens || 0.0022) / 0.0022) * zoom;                   // ayarlardaki fare hassasiyeti dokunmaya da yansır
    p.look(dx * k, dy * k);
  }

  press(id, down, t) {
    const p = this.p, g = this.g, s = p.s;
    const b = this.b[id];
    if (b) b.classList.toggle('on', down && id !== 'ads' && id !== 'crouch');
    if (id === 'fire' || id === 'fire2') {
      if (down) { if (!p.locked) g.requestLock(); p.fireHeld = true; p.fireBuf = 0.15; g.online?.edge('fp'); if (id === 'fire') this.looks.set(t.identifier, { x: t.clientX, y: t.clientY }); }
      else { p.fireHeld = !!this.anyFire(); this.looks.delete(t.identifier); }
      return;
    }
    if (id === 'score') { g.hud.showScoreboard(down); return; }
    if (!down) { if (id === 'jump') this.jump = false; return; }
    if (id === 'pause') { g.togglePause(); return; }
    if (!s.alive) return;
    if (id === 'jump') { if (s.prone || s.crouching) { s.standUp(); g.online?.edge('u'); } else this.jump = true; }
    else if (id === 'crouch') { s.toggleCrouch(); g.online?.edge('c'); }
    else if (id === 'reload') { s.startReload(); g.online?.edge('rl'); }
    else if (id === 'ads') { s.ads = !s.ads; }
    else if (id === 'swap') {                                                     // ana → yedek → yakın dövüş (boş yuvalar atlanır)
      const ord = [0, 1, 3], i = ord.indexOf(s.cur);
      for (let k = 1; k <= 3; k++) { const n = ord[(i + k + 3) % 3]; if (n !== s.cur && s.canEquip(n)) { s.switchTo(n); break; } }
    }
    else if (id === 'nade') { if (s.cur !== 2 && s.canEquip(2)) s.switchTo(2); else if (s.cur === 2) s.switchTo(0); }                // ekipmanı çek; tekrar basınca ana silaha dön
  }
  anyFire() { for (const v of this.btnTouch.values()) if (v === 'fire' || v === 'fire2') return true; return false; }

  // Her kare: ölü / duraklatılmış / maç bitti → kontroller gizli (ölüm ekranındaki kartlara dokunulabilsin); nişan ve çömelme düğmeleri durumu gösterir
  update() {
    const p = this.p, g = this.g, s = p.s;
    const show = s.alive && g.simulate && !g.ended && p.locked;
    this.el.classList.toggle('off', !show);
    if (!show) { this.f = this.r = 0; this.sprint = this.jump = false; this.joy = null; this.jb.style.display = 'none'; this.looks.clear(); if (p.fireHeld && this.anyFire()) p.fireHeld = false; this.btnTouch.clear(); return; }
    this.b.ads.classList.toggle('on', !!s.ads);
    this.b.crouch.classList.toggle('on', !!(s.crouching || s.prone));
    this.b.nade.classList.toggle('on', s.cur === 2);
  }

  dispose() { cancelAnimationFrame(this._raf); this.el.remove(); document.body.classList.remove('mob'); }
}
