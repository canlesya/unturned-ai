import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCharacter } from './models/character.js';
import { createWeapon, WEAPONS } from './models/weapons.js';
import { applySkin } from './models/skins.js';
import { createItem, ITEMS } from './models/items.js';
import { gpuInfo } from './gpuCheck.js';
import { FramePacer, isHidden, unfocused, paceState, onPaceChange } from './framePace.js';
import { MenuBg, MENU_FPS_MAIN } from './menuBg.js';

// Menü arka planı: seçili haritanın canlı dönen kuş bakışı + sınıf/silah vitrini + silah ikonları. Oyun başlarken dispose() edilmelidir.
// 12.234: harita arka planı MenuBg (src/menuBg.js) — destekleyen tarayıcıda ayrı iş parçacığında (OffscreenCanvas), yoksa burada. Vitrin (Cephanelik)
// ve silah ikonları ana iş parçacığında, ayrı tuvalde (#mnShow) ve ilk gerektiğinde açılan ikinci WebGL bağlamında; vitrin yalnız Cephanelik'te çizilir.

// doğrusal (0..255) → sRGB (0..255) çevrim tablosu (ikon üretimi)
const SRGB = Uint8Array.from({ length: 256 }, (_, i) => { const v = i / 255; return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); });

export class MenuScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.soft = gpuInfo().soft;                     // 12.222 yazılım WebGL: kenar yumuşatma / gölge yok, düşük çözünürlük, ~30 FPS (menü tepkisiz kalmasın)
    this.mode = 'orbit';
    this.mapId = null; this.tod = null;
    this.iconCache = new Map();
    this.char = null;
    this.running = true;
    const q = new URLSearchParams(location.search), num = (k) => (q.has(k) && q.get(k) !== '' && isFinite(+q.get(k)) ? +q.get(k) : null);
    this.opts = { fps: num('mfps'), pr: num('mpr'), shadow: q.get('mshadow') || undefined };   // ölçüm: ?mfps=0 (her ekran karesi) / 30 · ?mpr=1.5 · ?mshadow=live|off
    this._maxMaps = matchMedia('(pointer:coarse)').matches ? 3 : 4;
    // son kullanıcı girdisi (ana iş parçacığı kipinde harita kurulumu kullanıcı boştayken yapılır)
    this._inputT = 0;
    this._onInput = () => { this._inputT = performance.now(); };
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) addEventListener(ev, this._onInput, { capture: true, passive: true });
    this._statsQ = new Map(); this._sq = 0;
    this._rs = () => this._resize();
    addEventListener('resize', this._rs);
    this._offPace = onPaceChange(() => this._sendState());
    // vitrin bağlamı (Cephanelik / silah ikonları) kullanıcı boştayken önceden açılır: Cephanelik'e ilk girişte bağlam + ortam dokusu hazır
    const idle = globalThis.requestIdleCallback || ((f) => setTimeout(f, 1200));
    const pre = () => { if (!this.running || this.show) return; if (this._inputT && performance.now() - this._inputT < 800) { setTimeout(() => idle(pre, { timeout: 4000 }), 800); return; } this._show(); };
    setTimeout(() => idle(pre, { timeout: 4000 }), 1500);                   // ilk harita / arayüz otursun
    const mode = q.get('menubg');
    if (mode !== 'main' && typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && canvas.transferControlToOffscreen) this._startWorker();
    else this._startLocal();
    globalThis.__menuScene = this;                  // betikler: await __menuScene.stats()
  }

  // ───── harita arka planı (MenuBg: iş parçacığı ya da yerel) ─────
  _state() { return { shown: !isHidden(), focused: !unfocused(), hz: paceState.hz }; }
  _sendState() { if (this.worker) this.worker.postMessage({ t: 'state', state: this._state() }); }
  _onBg(m) {
    if (m.t === 'fade') {                                                     // CSS geçişi: ana iş parçacığı meşgulken de bileşikleyicide akar
      const s = this.canvas.style;
      if (m.from != null) { s.transition = 'none'; s.opacity = String(m.from); void this.canvas.offsetWidth; }
      s.transition = `opacity ${m.ms}ms ease`; s.opacity = String(m.v);
    } else if (m.t === 'world') this.shown = m.id;
    else if (m.t === 'stats') { const f = this._statsQ.get(m.q); this._statsQ.delete(m.q); f?.(m.s); }
  }
  _startWorker() {
    let off;
    try { off = this.canvas.transferControlToOffscreen(); } catch (e) { this._startLocal(); return; }
    const w = (this.worker = new Worker(new URL('./menuBg.worker.js', import.meta.url), { type: 'module' }));
    this.bgKind = 'worker';
    const fail = (why) => {                                                   // iş parçacığı açılamadı (tek dosyalık sürüm / rAF yok / WebGL yok): ana iş parçacığında sürdür
      if (this.worker !== w) return;
      console.warn('menü arka planı iş parçacığında açılamadı, ana iş parçacığında:', why);
      w.terminate(); this.worker = null;
      if (!this.running) return;
      const c = document.createElement('canvas'); c.id = this.canvas.id; c.className = this.canvas.className;      // aktarılmış tuval geri alınamaz: yenisi
      this.canvas.replaceWith(c); this.canvas = c;
      this._startLocal();
    };
    w.onerror = (e) => { e.preventDefault?.(); fail(e.message || 'yüklenemedi'); };
    w.onmessage = (e) => { const m = e.data; if (m.t === 'err') { if (!this._ready || m.init) fail(m.m); else console.warn('menü arka planı:', m.m); return; } if (m.t === 'ready') this._ready = true; this._onBg(m); };
    w.postMessage({ t: 'init', canvas: off, w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, soft: this.soft, maxMaps: this._maxMaps, opts: this.opts, state: this._state() }, [off]);
    this._replay();
  }
  _startLocal() {
    this.bgKind = 'main';
    try {
      this.bg = new MenuBg(this.canvas, { w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, soft: this.soft, maxMaps: this._maxMaps, opts: this.opts, post: (m) => this._onBg(m), idleMs: () => performance.now() - this._inputT });
    } catch (e) { console.warn('menü sahnesi açılamadı', e); this.bg = null; return; }
    this._replay();
  }
  _bgSend(m) { if (this.worker) this.worker.postMessage(m); else if (this.bg) { if (m.t === 'world') this.bg.setWorld(m.id, m.tod); else if (m.t === 'mode') this.bg.setMode(m.mode); else if (m.t === 'prefetch') this.bg.prefetch(m.ids); } }
  _replay() {                                                                 // iş parçacığından yerele düşünce son istekler yeniden
    if (this.mapId) this._bgSend({ t: 'world', id: this.mapId, tod: this.tod });
    this._bgSend({ t: 'mode', mode: this.mode === 'showroom' ? 'showroom' : 'orbit' });
    if (this._pre) this._bgSend({ t: 'prefetch', ids: this._pre });
  }

  // Tıklama anında yalnız hedef kaydedilir; ağır iş (harita kurulumu → ortam → gölgelendirici derleme) MenuBg'de, eski arka plan dönmeye devam eder.
  setWorld(mapId, tod) {
    if (this.mapId === mapId && this.tod === tod) return;
    this.mapId = mapId; this.tod = tod;
    this._bgSend({ t: 'world', id: mapId, tod });
  }
  // Mod değişiminin zorladığı haritaları (ör. Enfekte → New York) önceden kurar (MenuBg: yalnız görünmüyorken / boştayken)
  prefetch(ids) { this._pre = ids; this._bgSend({ t: 'prefetch', ids }); }

  setMode(mode) {
    this.mode = mode;
    const sr = mode === 'showroom';
    this._bgSend({ t: 'mode', mode: sr ? 'showroom' : 'orbit' });
    if (sr) { const s = this._show(); if (s) { s.canvas.style.display = 'block'; this._offset(); s.pacer.start(); } }
    else if (this.show) { this.show.canvas.style.display = 'none'; this.show.pacer.stop(); }
  }

  _resize() {
    const W = innerWidth, H = innerHeight, d = devicePixelRatio || 1;
    if (this.worker) this.worker.postMessage({ t: 'size', w: W, h: H, dpr: d }); else this.bg?.resize(W, H, d);
    if (this.show) { this.show.renderer.setSize(W, H, false); this.show.cam.aspect = W / H; this.show.cam.updateProjectionMatrix(); this._offset(); }
  }
  _offset() {
    if (!this.show) return;
    const W = innerWidth, H = innerHeight;
    if (this.mode === 'showroom') {
      const sw = Math.min(W * 0.46, 760), cx = (350 + (W - sw - 44)) / 2;
      this.show.cam.setViewOffset(W, H, W / 2 - cx, 0, W, H);
    } else this.show.cam.clearViewOffset();
  }

  // betikler / ölçüm: arka planın son 600 çiziminin damgası + kamera açısı, harita geçişleri (kurulum / derleme ms), çizim çağrısı, çözünürlük
  stats() {
    const extra = { kind: this.bgKind, show: this.show ? { ...this.show.pacer.stats, k: this.show.pacer.k } : null };
    if (this.worker) return new Promise((res) => { const q = ++this._sq; this._statsQ.set(q, (s) => res({ ...s, ...extra })); this.worker.postMessage({ t: 'stats', q }); setTimeout(() => { if (this._statsQ.delete(q)) res({ ...extra, timeout: true }); }, 2000); });
    return Promise.resolve(this.bg ? { ...this.bg.stats(), ...extra } : extra);
  }

  // ───── sınıf / silah vitrini (ana iş parçacığı, ayrı tuval; ilk gerektiğinde) ─────
  _show() {
    if (this.show || !this.running) return this.show;
    if (this._showFail) return null;
    try {
      const canvas = document.createElement('canvas'); canvas.id = 'mnShow';
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none';
      this.canvas.after(canvas);
      const r = new THREE.WebGLRenderer({ canvas, antialias: !this.soft, alpha: false, preserveDrawingBuffer: false });
      r.debug.checkShaderErrors = false;          // ilk çizimde derleme sonucu eşzamanlı sorulmaz (getProgramInfoLog Cephanelik girişinde 65 ms bekletiyordu)
      r.setPixelRatio(this.soft ? 0.6 : Math.min(devicePixelRatio, 1.5));
      r.setSize(innerWidth, innerHeight, false);
      r.toneMapping = THREE.NeutralToneMapping;
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.shadowMap.enabled = !this.soft;
      r.shadowMap.type = THREE.PCFShadowMap;
      const pmrem = new THREE.PMREMGenerator(r);
      this._envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
      const { scene, cam } = this._buildShowroom();
      this.show = { canvas, renderer: r, scene, cam, t: Math.random() * 6, last: 0, dirty: true };
      // vitrin yavaş dönen bir model: ekran hızının ≈60'a en yakın tam böleni (12.234 snap), odaksız 10, gizli / Cephanelik dışında hiç
      const fps = this.opts.fps != null && this.opts.fps >= 0 ? this.opts.fps : this.soft ? 30 : MENU_FPS_MAIN;
      this.show.pacer = new FramePacer(this.show, (now) => this._showLoop(now), () => (unfocused() ? 10 : fps), { name: 'showroom', snap: true });
    } catch (e) { console.warn('vitrin açılamadı', e); this._showFail = true; this.show = null; }
    return this.show;
  }
  _buildShowroom() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c1118');
    scene.environment = this._envTex; scene.environmentIntensity = 0.55;
    scene.fog = new THREE.Fog('#0c1118', 9, 22);
    const key = new THREE.DirectionalLight('#fff1dc', 2.6); key.position.set(3, 5, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 14 });
    const rim = new THREE.DirectionalLight('#ff8a3c', 2.0); rim.position.set(-4, 3, -3);
    const fill = new THREE.DirectionalLight('#6fa4ff', 0.8); fill.position.set(-3, 1.5, 4);
    scene.add(key, rim, fill, new THREE.HemisphereLight('#aab8d0', '#1a1410', 0.5));
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.12, 40), new THREE.MeshStandardMaterial({ color: '#232b37', roughness: 0.6, metalness: 0.3 }));
    floor.position.y = -0.07; floor.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: '#ff8a3c' }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.002;
    const bg = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshBasicMaterial({ color: '#131b27', fog: false }));
    bg.position.set(0, 3, -7);
    scene.add(floor, ring, bg);
    const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 60);
    cam.position.set(0, 1.35, 5.6); cam.lookAt(0, 1.02, 0);
    return { scene, cam };
  }

  showCharacter({ team = 'blue', cls = 'assault', weapon = null, optic = 'reddot', wskin = 'std', wear = '', spin = false }) {
    const S = this._show(); if (!S) return;
    this._spin = spin;                                                           // 12.167 Görünüm sekmesi: model tam tur döner (önden / yandan / arkadan)
    const key = [team, cls, weapon, optic, wear].join('|');
    if (this.char && this._charKey === key) {                                   // yalnız kaplama değişti: karakter yeniden kurulmaz, elindeki silah yenilenir
      if (this._charSkin !== wskin) { this._charSkin = wskin; const w = this.char.setWeapon(this.char.weapon?.userData.id || null, optic, wskin); w?.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
      return;
    }
    if (this.char) { S.scene.remove(this.char.root); this.char = null; }
    this._charKey = key; this._charSkin = wskin;
    const ch = createCharacter({ team, cls, skinIndex: 1, weapon: weapon || undefined, optic, wskin, wear });
    ch.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    ch.root.rotation.y = Math.PI + 0.6;
    S.scene.add(ch.root); S.dirty = true;
    this.char = ch;
    this._charYaw = Math.PI + 0.6;
  }

  // Kaplamalı silahın canlı önizlemesi (12.122): vitrin platformunun önünde, ayrıntılı (birinci şahıs) model yavaşça döner; kaplama değişince yalnız uniform
  showWeapon(o) {
    const S = this._show(); if (!S) return;
    const key = o ? o.id + '|' + o.optic : '';
    if (this._wKey === key && this.wpn) { if (o && this.wpn.userData.skin !== o.skin) { applySkin(this.wpn, o.skin); this.wpn.userData.skin = o.skin; } return; }
    if (this.wpn) { S.scene.remove(this.wpnPiv); this.wpn.traverse((m) => { m.geometry?.dispose(); if (m.material?.userData?.skinMat && !m.material.userData.shared) m.material.dispose(); }); this.wpn = null; }
    this._wKey = key;
    if (!o) return;
    const w = createWeapon(o.id, o.optic, false, o.skin);
    w.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(w), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const k = Math.min(2.2, 1.15 / Math.max(0.3, sz.z));                            // tabanca (kısa silah) en çok ×2,2 büyütülür, tüfek ~1,15 m boyuna sığdırılır
    const piv = new THREE.Group(); w.position.copy(c).multiplyScalar(-1); piv.add(w); piv.scale.setScalar(k);
    piv.position.set(0.05, 0.42, 1.15);
    w.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    S.scene.add(piv); S.dirty = true;
    this.wpn = w; this.wpnPiv = piv; w.userData.skin = o.skin;
  }

  // ───── silah ikonu (yan görünüş, şeffaf) → dataURL ─────
  weaponIcon(id, optic = 'reddot') {
    const key = id + '|' + optic;
    if (this.iconCache.has(key)) return this.iconCache.get(key);
    const S = this._show(); if (!S) return '';
    const W = 320, H = 150;
    const r = S.renderer;
    const scene = new THREE.Scene();
    scene.environment = this._envTex; scene.environmentIntensity = 0.9;
    const dl = new THREE.DirectionalLight('#ffffff', 2.4); dl.position.set(2, 4, 5);
    scene.add(dl, new THREE.HemisphereLight('#ffffff', '#778', 0.9));
    let url = '';
    try {
      const isItem = !WEAPONS[id] && ITEMS[id];     // ilk yardım gibi eşyalar silah tablosunda değil
      const w = isItem ? createItem(id) : createWeapon(id, optic);
      w.rotation.y = isItem || w.userData.hold === 'item' ? -0.5 : -Math.PI / 2;  // namlu → ekranda sağa (ilk yardım: çapraz ön yüz)
      scene.add(w);
      w.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(w), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const half = Math.max(sz.x * 0.56, sz.y * 0.56 * (W / H), 0.1);
      const cam = new THREE.OrthographicCamera(-half, half, half * H / W, -half * H / W, 0.1, 20);
      cam.position.set(c.x, c.y, c.z + 6);
      cam.lookAt(c.x, c.y, c.z);
      cam.updateProjectionMatrix();
      const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
      const prevClear = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha();
      r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear();
      r.render(scene, cam);
      const buf = new Uint8Array(W * H * 4);
      r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
      r.setRenderTarget(null); r.setClearColor(prevClear, prevA);
      rt.dispose();
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d'), img = g.createImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      // S3 modelleri (12.123): hedef dokuya doğrusal renk yazılır, sRGB'ye çevrilmezse koyu çıkıyordu (paleti sRGB'de ayarlı, oyunda ekrana sRGB çizilir) → yalnız S3 ikonlarında doğrusal → sRGB
      if (w.userData.s3) { const d = img.data; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const a = d[i + 3] / 255; for (let c = 0; c < 3; c++) d[i + c] = SRGB[Math.min(255, Math.round(d[i + c] / a))]; } }      // kenar pikselleri: önceden çarpılmış alfa çözülür (putImageData düz alfa ister)
      g.putImageData(img, 0, 0);
      url = cv.toDataURL('image/png');
    } catch (e) { console.warn('ikon üretilemedi', id, e); }
    this.iconCache.set(key, url);
    return url;
  }

  _showLoop(now) {
    const S = this.show; if (!this.running || !S || this.mode !== 'showroom') return;
    const dt = S.last ? S.pacer.dtFix(now - S.last) : 0; S.last = now;
    if (S.dirty) {                                                            // yeni model: programlar önce arka planda derlenir (eşzamanlı bekleme yok), sonra çizilir
      S.dirty = false; S.wait = true;
      S.renderer.compileAsync(S.scene, S.cam).catch(() => {}).then(() => { S.wait = false; });
    }
    if (S.wait) return;
    S.t += dt;
    if (this.char) this.char.root.rotation.y = this._spin ? this._charYaw + S.t * 0.7 : this._charYaw + Math.sin(S.t * 0.5) * 0.35;
    if (this.wpnPiv) { this.wpnPiv.rotation.set(0.08, -Math.PI / 2 + Math.sin(S.t * 0.45) * 0.55, 0); this.wpnPiv.position.y = 0.42 + Math.sin(S.t * 0.9) * 0.012; }      // yan görünüş, hafif salınım
    S.renderer.render(S.scene, S.cam);
  }

  dispose() {
    this.running = false;
    removeEventListener('resize', this._rs);
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) removeEventListener(ev, this._onInput, { capture: true });
    this._offPace?.();
    if (this.worker) { const w = this.worker; this.worker = null; w.onmessage = null; w.postMessage({ t: 'dispose' }); setTimeout(() => w.terminate(), 500); }   // bağlamı kendisi kapatır, yine de 0,5 sn sonra sonlandırılır
    this.bg?.dispose(); this.bg = null;
    if (this.show) {
      this.show.pacer.dispose();
      this._envTex?.dispose();
      this.show.renderer.dispose();
      this.show.renderer.forceContextLoss?.();
      this.show.canvas.remove(); this.show = null;
    }
    if (globalThis.__menuScene === this) delete globalThis.__menuScene;
  }
}
