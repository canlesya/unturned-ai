import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MAPS } from './maps/index.js';
import { setupEnvironment } from './maps/environment.js';
import { createCharacter } from './models/character.js';
import { createWeapon, WEAPONS } from './models/weapons.js';
import { applySkin } from './models/skins.js';
import { createItem, ITEMS } from './models/items.js';

// Menü arka planı: seçili haritanın canlı dönen kuş bakışı + sınıf/silah vitrini + silah ikonları.
// Tek WebGL tuvali kullanır; oyun başlarken dispose() edilmelidir.

const ORBIT = {
  kasaba: { r: 82, h: 34, look: [0, 3, 0], speed: 0.035 },
  vadi: { r: 112, h: 48, look: [0, 0, 0], speed: 0.03 },
  us: { r: 88, h: 38, look: [0, 3, 0], speed: 0.035 },
};

// doğrusal (0..255) → sRGB (0..255) çevrim tablosu (ikon üretimi)
const SRGB = Uint8Array.from({ length: 256 }, (_, i) => { const v = i / 255; return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); });

export class MenuScene {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false }));
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.setSize(innerWidth, innerHeight, false);
    r.toneMapping = THREE.NeutralToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.mode = 'orbit';
    this.t = Math.random() * 6;
    this.mapId = null; this.tod = null; this._job = 0;
    this._maps = new Map();                         // kurulmuş harita önbelleği (id → map)
    this.world = null; this.cam = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.5, 900);
    this.fade = 1;
    this.iconCache = new Map();
    this._pmrem = new THREE.PMREMGenerator(r);
    this._envTex = this._pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.showScene = this._buildShowroom();
    this.char = null;
    this.running = true;
    this._last = performance.now();
    this._rs = () => { r.setSize(innerWidth, innerHeight, false); this.cam.aspect = this.show.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); this.show.cam.updateProjectionMatrix(); this._offset(); };
    addEventListener('resize', this._rs);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ───── harita arka planı ─────
  // Tıklama anında yalnız hedef kaydedilir; ağır iş (harita kurulumu → ortam → gölgelendirici derleme) boyanmış kareden SONRA, ayrı karelere
  // bölünerek yapılır, eski arka plan bu sırada dönmeye devam eder. Kurulan harita önbellekte kalır: gün saati değişimi / aynı haritaya dönüş yeniden kurmaz.
  setWorld(mapId, tod) {
    if (this.mapId === mapId && this.tod === tod) return;
    this.mapId = mapId; this.tod = tod;
    this._swap(mapId, tod, ++this._job);
  }

  async _swap(mapId, tod, job) {
    const later = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));   // bir kare boyansın, sonra sürdür
    const live = () => this.running && job === this._job;                                        // bu arada yeni seçim geldiyse bu iş bırakılır
    await later(); if (!live()) return;
    let map = this._maps.get(mapId);
    if (!map) { map = MAPS[mapId].build(); this._maps.set(mapId, map); await later(); if (!live()) return; }
    this._maps.delete(mapId); this._maps.set(mapId, map);                                         // LRU sırası: en son kullanılan sona
    const scene = new THREE.Scene();
    const env = setupEnvironment(scene, this.renderer, { shadowSize: 70, sunPos: map.env?.sunPos || [60, 90, 40], env: map.env, tod });
    env.sun.shadow.mapSize.set(1024, 1024);
    env.sun.position.copy(new THREE.Vector3(...env.sunPos)); env.sun.target.position.set(0, 0, 0);
    try { await Promise.all([this.renderer.compileAsync(scene, this.cam), this.renderer.compileAsync(map.group, this.cam, scene)]); } catch (e) { /* derlenemezse ilk çizimde derlenir */ }
    if (!live()) { this._disposeEnv(scene, null); return; }
    const old = this.world;
    scene.add(map.group); env.applyGlow(map.group);                                               // grup eski sahneden yenisine geçer (aynı karede)
    this.world = { id: mapId, scene, map };
    this.fade = 0; this._done = job;
    if (old) this._disposeEnv(old.scene, old.map === map ? map.group : null);
    this._trim();
  }
  _max() { return matchMedia('(pointer:coarse)').matches ? 3 : 4; }
  _trim() {                                         // en çok 4 harita bellekte (telefonda 3); ekrandaki atılmaz
    const max = this._max();
    for (const [id, m] of this._maps) if (this._maps.size > max && m !== this.world?.map) { this._disposeMap(m); this._maps.delete(id); }
  }

  // Mod değişiminin zorladığı haritaları (ör. Enfekte → New York) boşta önceden kurar: o moda ilk geçişte de arka plan anında değişir.
  prefetch(ids) {
    this._pre = ids.filter((id) => MAPS[id]).slice(0, 3);
    const go = () => {
      if (!this.running) return;
      const id = this._pre.find((i) => !this._maps.has(i)); if (!id || this._maps.size >= this._max()) return;   // önbellek doluysa ön kurulum yok (birbirini atıp döngüye girmesin)
      if (this.world && this._job === this._done) { this._maps.set(id, MAPS[id].build()); this._trim(); }   // geçiş sürerken bekle
      this.prefetch(this._pre);
    };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1500);
  }

  _disposeEnv(scene, keep) {                       // ortam (gökyüzü / bulut / yıldız) atılır; önbellekteki harita grubu korunur
    for (const o of [...scene.children]) if (o !== keep && !this._isCached(o)) o.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
    scene.background?.dispose?.(); scene.environment?.dispose?.();
  }
  _isCached(o) { for (const m of this._maps.values()) if (m.group === o) return true; return false; }
  _disposeMap(m) { m.group.removeFromParent(); m.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

  setMode(mode) { this.mode = mode; this._offset(); }

  _offset() {
    const W = innerWidth, H = innerHeight;
    if (this.mode === 'showroom') {
      const sw = Math.min(W * 0.46, 760), cx = (350 + (W - sw - 44)) / 2;
      this.show.cam.setViewOffset(W, H, W / 2 - cx, 0, W, H);
    }
    else this.show.cam.clearViewOffset();
  }

  // ───── sınıf / silah vitrini ─────
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
    this.show = { scene, cam };
    return scene;
  }

  showCharacter({ team = 'blue', cls = 'assault', weapon = null, optic = 'reddot', wskin = 'std' }) {
    const key = [team, cls, weapon, optic].join('|');
    if (this.char && this._charKey === key) {                                   // yalnız kaplama değişti: karakter yeniden kurulmaz, elindeki silah yenilenir
      if (this._charSkin !== wskin) { this._charSkin = wskin; const w = this.char.setWeapon(this.char.weapon?.userData.id || null, optic, wskin); w?.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
      return;
    }
    if (this.char) { this.show.scene.remove(this.char.root); this.char = null; }
    this._charKey = key; this._charSkin = wskin;
    const ch = createCharacter({ team, cls, skinIndex: 1, weapon: weapon || undefined, optic, wskin });
    ch.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    ch.root.rotation.y = Math.PI + 0.6;
    this.show.scene.add(ch.root);
    this.char = ch;
    this._charYaw = Math.PI + 0.6;
  }

  // Kaplamalı silahın canlı önizlemesi (12.122): vitrin platformunun önünde, ayrıntılı (birinci şahıs) model yavaşça döner; kaplama değişince yalnız uniform
  showWeapon(o) {
    const key = o ? o.id + '|' + o.optic : '';
    if (this._wKey === key && this.wpn) { if (o && this.wpn.userData.skin !== o.skin) { applySkin(this.wpn, o.skin); this.wpn.userData.skin = o.skin; } return; }
    if (this.wpn) { this.show.scene.remove(this.wpnPiv); this.wpn.traverse((m) => { m.geometry?.dispose(); if (m.material?.userData?.skinMat && !m.material.userData.shared) m.material.dispose(); }); this.wpn = null; }
    this._wKey = key;
    if (!o) return;
    const w = createWeapon(o.id, o.optic, false, o.skin);
    w.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(w), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const k = Math.min(2.2, 1.15 / Math.max(0.3, sz.z));                            // tabanca (kısa silah) en çok ×2,2 büyütülür, tüfek ~1,15 m boyuna sığdırılır
    const piv = new THREE.Group(); w.position.copy(c).multiplyScalar(-1); piv.add(w); piv.scale.setScalar(k);
    piv.position.set(0.05, 0.42, 1.15);
    w.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    this.show.scene.add(piv);
    this.wpn = w; this.wpnPiv = piv; w.userData.skin = o.skin;
  }

  // ───── silah ikonu (yan görünüş, şeffaf) → dataURL ─────
  weaponIcon(id, optic = 'reddot') {
    const key = id + '|' + optic;
    if (this.iconCache.has(key)) return this.iconCache.get(key);
    const W = 320, H = 150;
    const r = this.renderer;
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

  // ───── döngü ─────
  loop(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
    this.t += dt;
    const r = this.renderer;
    if (this.mode !== 'showroom' && !this.world) { /* ilk harita henüz kuruluyor: boş kare (vitrin sahnesi araya girmesin) */ }
    else if (this.mode === 'showroom') {
      if (this.char) this.char.root.rotation.y = this._charYaw + Math.sin(this.t * 0.5) * 0.35;
      if (this.wpnPiv) { this.wpnPiv.rotation.set(0.08, -Math.PI / 2 + Math.sin(this.t * 0.45) * 0.55, 0); this.wpnPiv.position.y = 0.42 + Math.sin(this.t * 0.9) * 0.012; }      // yan görünüş, hafif salınım
      r.render(this.show.scene, this.show.cam);
    } else {
      const O = ORBIT[this.world.id] || ORBIT.kasaba, a = this.t * O.speed;
      this.cam.position.set(Math.cos(a) * O.r, O.h + Math.sin(this.t * 0.2) * 3, Math.sin(a) * O.r * 0.8);
      this.cam.lookAt(...O.look);
      r.render(this.world.scene, this.cam);
    }
    if (this.fade < 1) { this.fade = Math.min(1, this.fade + dt * 2.2); this.canvas.style.opacity = String(0.25 + 0.75 * this.fade); }
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this._rs);
    if (this.world) this._disposeEnv(this.world.scene, null);
    for (const m of this._maps.values()) this._disposeMap(m);
    this._maps.clear(); this.world = null;
    this._pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
