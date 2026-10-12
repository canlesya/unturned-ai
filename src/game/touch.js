// Dokunmatik kontroller (telefon / tablet), PUBG / CoD Mobile tarzı.
// · Joystick (analog: az itince yavaş): SABİT (hep aynı yerde) ya da HAREKETLİ (sol yarıda parmağın değdiği yerde belirir).
//   Sonuna kadar ileri = koşu; daha da yukarı sürükleyip kilit işaretinde bırakınca KOŞU KİLİDİ (joysticke tekrar dokununca biter).
// · Sağ yarı: kaydırarak bakış (normal / nişan hassasiyeti ayrı). İsteğe bağlı jiroskop (kapalı / nişandayken / hep).
// · Butonlar: ateş (sabit ya da parmağı izleyen; basılıyken sürükleyince nişan alır), sol ateş (isteğe bağlı), nişan, zıpla, çömel, şarjör,
//   silah değiştir, ekipman, 3. şahıs, skor, duraklat. HUD'daki silah adına dokununca o silaha geçer.
// · Düzen düzenleyici (duraklat → Dokunmatik ayarlar): butonları sürükle, boyutlandır, saydamlık; ayarlar localStorage'da (cihaza özel).
// Masaüstünde denemek için: ?touch=1
const KEY = 'warbyte.touch';
const DEF = { joy: 'fixed', fire: 'fixed', leftFire: true, opacity: 0.8, sens: 1, adsSens: 0.75, gyro: 'off', gyroSens: 1, gyroInvX: false, gyroInvY: false, layout: {} };
// Varsayılan düzen: merkez (x, y: ekranın oranı), boyut s (ekran yüksekliğinin oranı)
const LAYOUT = {
  joy: { x: 0.15, y: 0.70, s: 0.36 },
  fire: { x: 0.78, y: 0.60, s: 0.27 }, fire2: { x: 0.08, y: 0.36, s: 0.18 },
  ads: { x: 0.93, y: 0.36, s: 0.16 }, jump: { x: 0.93, y: 0.61, s: 0.18 }, crouch: { x: 0.93, y: 0.86, s: 0.16 },
  reload: { x: 0.655, y: 0.86, s: 0.15 }, swap: { x: 0.79, y: 0.89, s: 0.15 }, nade: { x: 0.655, y: 0.58, s: 0.15 },
  third: { x: 0.655, y: 0.34, s: 0.12 }, pause: { x: 0.22, y: 0.075, s: 0.11 }, score: { x: 0.285, y: 0.075, s: 0.11 },
};
const NAMES = { joy: 'Joystick', fire: 'Ateş', fire2: 'Sol ateş', ads: 'Nişan', jump: 'Zıpla', crouch: 'Çömel', reload: 'Şarjör', swap: 'Silah değiştir', nade: 'Ekipman', third: '3. şahıs', pause: 'Duraklat', score: 'Skor' };
const I = {
  fire: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>', fire2: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  ads: '<circle cx="12" cy="12" r="3"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3"/><circle cx="12" cy="12" r="8"/>',
  jump: '<path d="M12 19V5M6 11l6-6 6 6"/>', crouch: '<path d="M12 5v14M6 13l6 6 6-6"/>', reload: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', nade: '<circle cx="12" cy="14" r="6"/><path d="M12 8V5h4M10 4h4"/>',
  third: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0112 0v3"/><path d="M3 4l3 3M21 4l-3 3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>', score: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const CSS = `
#tc{position:fixed;inset:0;z-index:6;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;font-family:Bahnschrift,'Rajdhani','Arial Narrow',system-ui,sans-serif}
#tc.off{display:none}
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
#tc .rot{position:fixed;inset:0;z-index:30;display:none;place-items:center;background:#0b0e13;color:#fff;font-size:18px;text-align:center;padding:24px;letter-spacing:1px}
@media (orientation:portrait){#tc .rot{display:grid}}
/* düzen düzenleyici */
#tc.edit{background:rgba(5,8,12,.86);z-index:40}
#tc.edit .b,#tc.edit .jb{outline:2px dashed rgba(255,255,255,.45);outline-offset:3px;pointer-events:auto;cursor:move}
#tc.edit .b.hid{display:grid;opacity:.25!important}
#tc.edit .sel{outline-color:#ff8a1f}
#tc .ep{position:absolute;left:50%;top:8px;transform:translateX(-50%);width:min(560px,70vw);max-height:calc(100vh - 16px);overflow:auto;background:rgba(9,13,19,.94);border:1px solid rgba(255,255,255,.18);padding:10px 14px;color:#e8edf5;font-size:12px;display:none;pointer-events:auto;z-index:2;transition:opacity .15s}
#tc.edit .ep{display:block}
#tc.edit.dragging .ep{opacity:.12;pointer-events:none}
#tc .ep.min .body{display:none}
#tc .ep.min{top:50%;left:41%;transform:translate(-50%,-50%);width:auto}#tc .ep.min h4{display:none}
#tc .ep h4{margin:0;font-size:13px;letter-spacing:3px;color:#ffb347;text-transform:uppercase;flex:1}
#tc .ep .row{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
#tc .ep .lb{width:118px;opacity:.8}
#tc .ep input[type=range]{flex:1;min-width:120px;accent-color:#ff8a1f}
#tc .ep .v{width:40px;text-align:right}
#tc .ep .seg{display:inline-flex;border:1px solid rgba(255,255,255,.2)}
#tc .ep .seg button,#tc .ep .tb{background:transparent;border:0;color:#cfd6e0;padding:6px 10px;font:inherit;font-size:12px;letter-spacing:1px}
#tc .ep .seg button.on{background:#ff8a1f;color:#160a02;font-weight:700}
#tc .ep .tb{border:1px solid rgba(255,255,255,.25)}
#tc .ep .tb.pri{background:#ff8a1f;color:#160a02;font-weight:700;border-color:#ff8a1f}
#tc .ep .tabs{display:flex;gap:6px}
#tc .ep .hint{opacity:.6;margin-top:6px}
/* telefon HUD'u: masaüstü boyutundaki öğeler orantılı küçülür; mermi sağ üste, öldürme bildirimi mini haritanın altına (butonlara binmesin) */
body.mob #mmwrap{zoom:.5;left:10px;top:10px}
body.mob #topbar{zoom:.62;top:6px}
body.mob #killfeed{zoom:.58;top:46vh;bottom:auto;left:16px;right:auto;align-items:flex-start}
body.mob #killfeed .kf{border-right:0;border-left:3px solid #888}body.mob #killfeed .kf.me{border-left-color:#ff8a1f}
body.mob #vitals{zoom:.55;left:16px;bottom:10px}
body.mob #ammo{zoom:.55;right:20px;top:14px;bottom:auto}
body.mob #toasts{zoom:.7;top:90px}
body.mob #abil,body.mob #msg,body.mob #zonew,body.mob #bosses{zoom:.65}
body.mob #pops{zoom:.75}
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
    this.f = 0; this.r = 0; this.sprint = false; this.jump = false; this.runLock = false;
    this.joy = null; this.looks = new Map(); this.btnTouch = new Map();
    if (!document.getElementById('tcCss')) { const st = document.createElement('style'); st.id = 'tcCss'; st.textContent = CSS; document.head.appendChild(st); }
    const el = (this.el = document.createElement('div'));
    el.id = 'tc'; el.className = 'off';
    el.innerHTML = `<div class="jb" data-k="joy"><div class="jk"></div><div class="lock"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></div><div class="runlock">KOŞU KİLİTLİ</div></div>
      <div class="rot">Telefonu yan çevir<br><small style="opacity:.6;font-size:13px">Oyun yatay ekranda oynanır</small></div><div class="ep"></div>`;
    document.body.appendChild(el);
    document.body.classList.add('mob');
    this.jb = el.querySelector('.jb'); this.jk = el.querySelector('.jk'); this.ep = el.querySelector('.ep');
    this.b = {};
    for (const id of Object.keys(LAYOUT)) {
      if (id === 'joy') continue;
      const d = document.createElement('div');
      d.className = 'b' + (id === 'fire' || id === 'fire2' ? ' fire' : '') + (id === 'pause' || id === 'score' ? ' sm' : '');
      d.dataset.b = id; d.dataset.k = id;
      d.innerHTML = `<svg viewBox="0 0 24 24">${I[id]}</svg>`;
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
    if (pt) pt.textContent = "Başlamak için BAŞLA'ya dokun. Kontrolleri duraklat menüsündeki Dokunmatik ayarlar'dan değiştirebilirsin.";
    // duraklat menüsüne "Dokunmatik ayarlar"
    const set = document.getElementById('bSet');
    if (set && !document.getElementById('bTouch')) {
      const b = document.createElement('button');
      b.id = 'bTouch'; b.className = set.className; b.textContent = 'Dokunmatik ayarlar';
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
    this.jR = (this.pos('joy').s * H) / 2;
    if (!this.joy || this.cfg.joy === 'fixed') this.homeJoy();
    this.jb.style.opacity = op;
    this.jb.classList.toggle('sel', !!this.editing && this.sel === 'joy');
    this.jb.classList.toggle('float', this.cfg.joy === 'float' && !this.editing && !this.joy && !this.runLock);
  }
  homeJoy() { const L = this.pos('joy'), H = innerHeight, sz = L.s * H; Object.assign(this.jb.style, { width: sz + 'px', height: sz + 'px', left: L.x * innerWidth - sz / 2 + 'px', top: L.y * H - sz / 2 + 'px' }); this.jbc = { x: L.x * innerWidth, y: L.y * H }; }

  start(e) {
    e.preventDefault();                                     // kaydırma / yakınlaştırma / sahte fare olayı yok
    if (this.editing) return;
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
    e.preventDefault();
    if (this.editing) return;
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
    e.preventDefault();
    if (this.editing) return;
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
    const ads = s.adsT > 0.5, zoom = s.zoomNow && ads ? 1 / Math.pow(s.zoomNow, 0.8) : 1;
    const k = 0.0055 * this.cfg.sens * (ads ? this.cfg.adsSens : 1) * ((p.set.sens || 0.0022) / 0.0022) * zoom;
    p.look(dx * k, dy * k);
  }

  // HUD'daki silah yuvaları (#slots .slot): dokununca o silaha geç
  slotAt(x, y) {
    const list = document.querySelectorAll('#slots .slot');
    for (let i = 0; i < list.length; i++) { const r = list[i].getBoundingClientRect(); if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 6 && y <= r.bottom + 6) return i; }
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
    if (id === 'score') { g.hud.showScoreboard(down); return; }
    if (!down) { if (id === 'jump') this.jump = false; return; }
    if (id === 'pause') { g.togglePause(); return; }
    if (!s.alive) return;
    if (id === 'jump') { if (s.prone || s.crouching) { s.standUp(); g.online?.edge('u'); } else this.jump = true; }
    else if (id === 'crouch') { s.toggleCrouch(); g.online?.edge('c'); }
    else if (id === 'reload') { s.startReload(); g.online?.edge('rl'); }
    else if (id === 'ads') { s.ads = !s.ads; }
    else if (id === 'third') { p.toggleThird(); }
    else if (id === 'swap') {                                                     // ana → yedek → yakın dövüş (boş yuvalar atlanır)
      const ord = [0, 1, 3], i = ord.indexOf(s.cur);
      for (let k = 1; k <= 3; k++) { const n = ord[(i + k + 3) % 3]; if (n !== s.cur && s.canEquip(n)) { s.switchTo(n); break; } }
    } else if (id === 'nade') { if (s.cur !== 2 && s.canEquip(2)) s.switchTo(2); else if (s.cur === 2) s.switchTo(0); }   // ekipmanı çek; tekrar basınca ana silah
  }
  anyFire() { for (const v of this.btnTouch.values()) if (v === 'fire' || v === 'fire2') return true; return false; }

  // ── Jiroskop: telefonu çevirerek nişan (kapalı / yalnız nişandayken / hep). iOS izin ister (ayarlarda açarken). ──
  gyroOn() {
    if (this._gy) return;
    this._gy = (e) => {
      const c = this.cfg, s = this.p.s, rr = e.rotationRate;
      if (c.gyro === 'off' || !rr || !this.p.locked || !s.alive || this.editing) return;
      if (c.gyro === 'ads' && !s.ads) return;
      const now = performance.now(), dt = Math.min(0.05, (now - (this._gt || now)) / 1000); this._gt = now;
      const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 90, sg = ang === 270 || ang === -90 ? -1 : 1;
      const k = c.gyroSens * Math.PI / 180 * dt;
      const yaw = (rr.beta || 0) * sg * (c.gyroInvX ? -1 : 1), pitch = (rr.gamma || 0) * sg * (c.gyroInvY ? -1 : 1);       // yatay tutuşta: beta = sola/sağa dönüş, gamma = yukarı/aşağı eğme
      s.yaw += yaw * k; s.pitch = Math.max(-1.5, Math.min(1.5, s.pitch + pitch * k));
    };
    addEventListener('devicemotion', this._gy);
  }
  async gyroPermission() {
    const DM = window.DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === 'function') { try { return (await DM.requestPermission()) === 'granted'; } catch { return false; } }
    return true;
  }

  // ── Düzen düzenleyici ──
  openEditor() {
    if (this.editing) return;
    this.editing = true; this.sel = 'fire'; this.tab = 'layout';
    this.backup = JSON.parse(JSON.stringify(this.cfg));
    this.el.classList.remove('off'); this.el.classList.add('edit');
    this.layout();
    this.drawPanel();
    this._pd = (e) => {
      const tgt = e.target.closest('[data-k]');
      if (!tgt || e.target.closest('.ep')) return;
      e.preventDefault();
      const id = tgt.dataset.k, L = this.pos(id);
      this.sel = id; this.drawPanel(); this.layout();
      const ox = e.clientX - L.x * innerWidth, oy = e.clientY - L.y * innerHeight;
      this.el.classList.add('dragging');
      const mv = (ev) => { this.cfg.layout[id] = { ...this.pos(id), x: Math.max(0.03, Math.min(0.97, (ev.clientX - ox) / innerWidth)), y: Math.max(0.04, Math.min(0.96, (ev.clientY - oy) / innerHeight)) }; this.layout(); };
      const up = () => { this.el.classList.remove('dragging'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    this.el.addEventListener('pointerdown', this._pd);
  }
  drawPanel() {
    const c = this.cfg, sel = this.sel, L = this.pos(sel), base = LAYOUT[sel].s;
    const seg = (k, opts) => `<span class="seg">${opts.map(([v, t]) => `<button data-set="${k}" data-v="${v}" class="${String(c[k]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</span>`;
    const rng = (k, lo, hi, st, val, txt) => `<div class="row"><span class="lb">${txt}</span><input type="range" data-r="${k}" min="${lo}" max="${hi}" step="${st}" value="${val}"><span class="v">${Math.round(val * 100)}%</span></div>`;
    this.ep.classList.toggle('min', !!this.min);
    this.ep.innerHTML = `<div class="row" style="margin-top:0"><h4>Dokunmatik ayarlar</h4><span class="tabs"><button class="tb ${this.tab === 'layout' ? 'pri' : ''}" data-tab="layout">Düzen</button><button class="tb ${this.tab === 'sens' ? 'pri' : ''}" data-tab="sens">Hassasiyet</button><button class="tb" data-min>${this.min ? '▼ Aç' : '▲ Gizle'}</button></span></div>
      <div class="body">${this.tab === 'layout' ? `<div class="hint">Butonları sürükleyerek taşı. Seçili: <b style="color:#ff8a1f">${NAMES[sel]}</b></div>
        ${rng('size', 0.5, 1.8, 0.05, L.s / base, 'Seçili boyut')}
        ${rng('opacity', 0.2, 1, 0.05, c.opacity, 'Saydamlık')}
        <div class="row"><span class="lb">Joystick</span>${seg('joy', [['fixed', 'Sabit'], ['float', 'Hareketli']])}</div>
        <div class="row"><span class="lb">Sağ ateş butonu</span>${seg('fire', [['fixed', 'Sabit'], ['float', 'Parmağı izler']])}</div>
        <div class="row"><span class="lb">Sol ateş butonu</span>${seg('leftFire', [[true, 'Açık'], [false, 'Kapalı']])}</div>`
      : `${rng('sens', 0.3, 2.5, 0.05, c.sens, 'Bakış hassasiyeti')}${rng('adsSens', 0.2, 1.5, 0.05, c.adsSens, 'Nişan hassasiyeti')}
        <div class="row"><span class="lb">Jiroskop</span>${seg('gyro', [['off', 'Kapalı'], ['ads', 'Nişandayken'], ['on', 'Hep açık']])}</div>
        ${rng('gyroSens', 0.2, 3, 0.05, c.gyroSens, 'Jiroskop hassasiyeti')}
        <div class="row"><span class="lb">Jiroskop yönü</span>${seg('gyroInvX', [[false, 'Yatay normal'], [true, 'Yatay ters']])} ${seg('gyroInvY', [[false, 'Dikey normal'], [true, 'Dikey ters']])}</div>
        <div class="hint">Jiroskop: telefonu çevirerek ince nişan. Ters dönüyorsa yönü değiştir.</div>`}</div>
      <div class="row" style="justify-content:flex-end;margin-top:${this.min ? 6 : 12}px"><button class="tb" data-act="reset">Varsayılana dön</button><button class="tb" data-act="cancel">İptal</button><button class="tb pri" data-act="save">Kaydet</button></div>`;
    this.ep.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.min = false; this.drawPanel(); }));
    this.ep.querySelector('[data-min]').onclick = () => { this.min = !this.min; this.drawPanel(); };
    this.ep.querySelectorAll('[data-set]').forEach((b) => (b.onclick = async () => {
      const k = b.dataset.set, raw = b.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : raw;
      if (k === 'gyro' && v !== 'off' && !(await this.gyroPermission())) { this.g.hud.toast('Jiroskop izni verilmedi', '#ffd27a'); return; }
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
      if (a === 'save') { saveCfg(this.cfg); this.g.hud.toast('Dokunmatik ayarlar kaydedildi', '#9fe6a8'); }
      this.closeEditor();
    }));
  }
  closeEditor() {
    this.editing = false;
    this.el.classList.remove('edit');
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
      this.f = this.r = 0; this.sprint = this.jump = false; this.runLock = false; this.joy = null; this.looks.clear();
      this.jb.classList.remove('drag', 'run', 'locked', 'lockon');
      if (this.cfg.joy === 'float') this.jb.classList.add('float');
      if (p.fireHeld && this.anyFire()) p.fireHeld = false;
      this.btnTouch.clear(); return;
    }
    if (this.runLock) this.setJoy(0, -1);
    this.b.ads.classList.toggle('on', !!s.ads);
    this.b.crouch.classList.toggle('on', !!(s.crouching || s.prone));
    this.b.nade.classList.toggle('on', s.cur === 2);
    this.b.third.classList.toggle('on', !!p.third);
  }

  dispose() { cancelAnimationFrame(this._raf); removeEventListener('resize', this.h.rs); removeEventListener('devicemotion', this._gy); this.el.remove(); document.body.classList.remove('mob'); document.getElementById('bTouch')?.remove(); }
}
