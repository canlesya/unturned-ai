import * as THREE from 'three';
import { MAPS } from './maps/index.js';
import { setupEnvironment } from './maps/environment.js';
import { FramePacer, unfocused } from './framePace.js';

// 12.234 Menü 3B arka planı (seçili haritanın yavaş dönen kuş bakışı): ana iş parçacığından bağımsız çekirdek.
// Tarayıcı destekliyorsa ayrı iş parçacığında (menuBg.worker.js + OffscreenCanvas) koşar: harita kurulumu (Kasaba 350 ms, Batı Cephesi 440 ms,
// Kuzey Vadisi 1,6 sn tek parça eşzamanlı iş) ve çizim menü arayüzünü hiç bekletmez. Desteklemiyorsa (Safari'de iş parçacığında rAF yok,
// tek dosyalık sürüm, ?menubg=main) aynı sınıf ana iş parçacığında çalışır; kurulum o zaman kullanıcı 0,4 sn boşta kalınca yapılır.
//
// Ucuz çizim (12.232'de 30 FPS'te bile GPU süreci ~%26'ydı):
//  - Kare temposu ekran hızının ≈60'a en yakın tam böleni (60 Hz → 60, 120 → 60 = her 2. kare, 144 → 72, 240 → 60), kamera adımı ekran
//    karesi katı (FramePacer.dtFix: rAF damgası oynasa da her çizilen karede aynı açı).
//  - İç çözünürlük CSS pikseli × en çok 1 (Retina'da 1,5 idi → 2,25 kat az piksel), en çok ~2,1 MP; arayüzün arkasında, kenar yumuşatma açık.
//  - Gölge haritası harita değişince BİR KEZ çizilir (güneş sabit, sahne durağan; eskiden her karede bütün gölge düşürenler ikinci kez çiziliyordu).
// Geçiş: kurulmamış haritada tuval önce soluklaşır (CSS geçişi, bileşikleyicide akar), kurulum + gölgelendirici derleme o sırada, sonra açılır.

export const ORBIT = {
  kasaba: { r: 82, h: 34, look: [0, 3, 0], speed: 0.035 },
  vadi: { r: 112, h: 48, look: [0, 0, 0], speed: 0.03 },
  us: { r: 88, h: 38, look: [0, 3, 0], speed: 0.035 },
};
// Kare temposu (FramePacer snap). Ölçüm (masaüstü 120 Hz, derlenmiş sürüm, GPU süreci CPU'su): her ekran karesi (120) %25,5 = 12.232'nin düzensiz
// 30 FPS'i kadar; ≈60 (her 2. kare, düzenli) %15,8. Bu maliyet karenin bileşimi (çözünürlük ×0,7 / gölge her karede: ±%1,5), sahnenin kendisi değil.
// Yavaş dönen kamera için düzenli 60 akıcı; ?mfps=0 her ekran karesi (deneme).
export const MENU_FPS = 60, MENU_FPS_MAIN = 60;
const FADE_OUT = 160, FADE_IN = 450;              // ms
const MAX_PX = 2.1e6;                             // iç çözünürlük üst sınırı (piksel)

// iç çözünürlük çarpanı: CSS pikseli başına en çok `base` (vars. 1), toplam en çok MAX_PX; yazılım WebGL 0,6 (12.222)
export function menuPixelRatio(w, h, dpr, soft, base) {
  if (soft) return 0.6;
  const b = base > 0 ? base : Math.min(dpr || 1, 1);
  return Math.max(0.5, Math.min(b, Math.sqrt(MAX_PX / Math.max(1, w * h))));
}

export class MenuBg {
  // canvas: HTMLCanvasElement ya da OffscreenCanvas · post(msg): ana iş parçacığına (soluklaşma, istatistik) · idleMs(): son girdiden beri ms (yalnız ana iş parçacığında)
  constructor(canvas, { w, h, dpr = 1, soft = false, post = () => {}, idleMs = null, maxMaps = 4, opts = {} }) {
    this.canvas = canvas; this.soft = soft; this.post = post; this.idleMs = idleMs; this.maxMaps = maxMaps; this.opts = opts;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !soft, alpha: false, preserveDrawingBuffer: false }));
    r.debug.checkShaderErrors = false;            // derleme durumu eşzamanlı sorulmaz (GPU sürecini bekletiyordu); gölgelendiriciler zaten oyunda denetleniyor
    r.toneMapping = THREE.NeutralToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.shadow = soft ? 'off' : opts.shadow || 'once';
    r.shadowMap.enabled = this.shadow !== 'off';
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = this.shadow === 'live';
    this.resize(w, h, dpr);
    this.mode = 'orbit';
    this.t = Math.random() * 6;
    this.mapId = null; this.tod = null; this._job = 0; this._done = 0;
    this._maps = new Map();                       // kurulmuş harita önbelleği (id → map), LRU
    this._pre = [];
    this.world = null;
    this.cam = new THREE.PerspectiveCamera(48, w / h, 0.5, 900);
    this.running = true;
    this._last = 0;
    this.rec = { t: new Float64Array(600), a: new Float64Array(600), n: 0 };                    // son 600 çizimin rAF damgası + kamera açısı (betikler)
    this.swaps = [];
    const fps = opts.fps != null && opts.fps >= 0 ? opts.fps : soft ? 30 : idleMs ? MENU_FPS_MAIN : MENU_FPS;   // ?mfps=0: her ekran karesi (sınırsızda bile)
    this.pacer = new FramePacer(this, (now) => this.loop(now), () => (unfocused() ? 10 : fps), { name: 'menu', snap: true });
    this.pacer.start();
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.pr = menuPixelRatio(w, h, dpr, this.soft, this.opts.pr);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    if (this.cam) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  }

  setMode(mode) {                                 // vitrin (Cephanelik) ana iş parçacığında ayrı tuvalde: arka plan o sırada çizilmez
    this.mode = mode;
    if (mode === 'showroom') { this.pacer.stop(); this._prefetchTick(); } else if (this.running) { this._last = 0; this.pacer.start(); }
  }

  // ───── harita ─────
  setWorld(mapId, tod) {
    if (!MAPS[mapId] || (this.mapId === mapId && this.tod === tod)) return;
    this.mapId = mapId; this.tod = tod;
    this._swap(mapId, tod, ++this._job);
  }

  async _swap(mapId, tod, job) {
    const T0 = performance.now(), live = () => this.running && job === this._job;     // bu arada yeni seçim geldiyse bu iş bırakılır
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    let map = this._maps.get(mapId), build = 0;
    if (this.world) { this.post({ t: 'fade', v: 0.25, ms: FADE_OUT }); await wait(FADE_OUT + 20); if (!live()) return; }   // eski harita dönerken soluklaşır
    if (!map) {
      // ana iş parçacığında: kullanıcı tıklamayı / kaydırmayı bitirsin (0,4 sn boşta), kurulum arayüzün arasına girmesin (en çok 2,5 sn bekler)
      if (this.idleMs) for (let i = 0; i < 25 && this.idleMs() < 400; i++) { await wait(100); if (!live()) return; }
      const b0 = performance.now();
      map = MAPS[mapId].build(); build = performance.now() - b0;
      this._maps.set(mapId, map);
      await wait(0); if (!live()) return;
    }
    this._maps.delete(mapId); this._maps.set(mapId, map);                                         // LRU sırası: en son kullanılan sona
    const c0 = performance.now();
    const scene = new THREE.Scene();
    const env = setupEnvironment(scene, this.renderer, { shadowSize: 70, sunPos: map.env?.sunPos || [60, 90, 40], env: map.env, tod });
    env.sun.shadow.mapSize.set(1024, 1024);
    env.sun.position.copy(new THREE.Vector3(...env.sunPos)); env.sun.target.position.set(0, 0, 0);
    try { await Promise.all([this.renderer.compileAsync(scene, this.cam), this.renderer.compileAsync(map.group, this.cam, scene)]); } catch (e) { /* derlenemezse ilk çizimde derlenir */ }
    if (!live()) { this._disposeEnv(scene, null); return; }
    const old = this.world;
    scene.add(map.group); env.applyGlow(map.group);                                               // grup eski sahneden yenisine geçer (aynı karede)
    scene.traverse((o) => { if (o.isMesh || o.isPoints) { o.matrixAutoUpdate = false; o.updateMatrix(); } });   // durağan sahne: her karede matris hesabı yok
    scene.updateMatrixWorld(true);
    this.world = { id: mapId, scene, map, sun: env.sun };
    this.renderer.shadowMap.needsUpdate = true;                                                   // gölge haritası bu harita için bir kez
    this._done = job;
    if (old) this._disposeEnv(old.scene, old.map === map ? map.group : null);
    this._trim();
    this.post({ t: 'fade', v: 1, ms: FADE_IN, from: old ? null : 0.25 });
    this.swaps.push({ id: mapId, tod, cached: !build, build: Math.round(build), compile: Math.round(performance.now() - c0), total: Math.round(performance.now() - T0) });
    if (this.swaps.length > 40) this.swaps.shift();
    this.post({ t: 'world', id: mapId, tod });
  }
  _trim() {                                       // en çok 4 harita bellekte (telefonda 3); ekrandaki atılmaz
    for (const [id, m] of this._maps) if (this._maps.size > this.maxMaps && m !== this.world?.map) { this._disposeMap(m); this._maps.delete(id); }
  }

  // Mod değişiminin zorladığı haritaları (ör. Enfekte → New York) önceden kurar. Kurulum tek parça iş olduğundan yalnız görünmüyorken / boştayken:
  // iş parçacığında arka plan çizilmezken (Cephanelik vitrini), ana iş parçacığında kullanıcı 1,5 sn boştayken (requestIdleCallback).
  prefetch(ids) {
    if (this.soft) return;                        // 12.222 yazılım WebGL: ön kurulum yok
    this._pre = ids.filter((id) => MAPS[id]).slice(0, 3);
    this._prefetchTick();
  }
  _prefetchTick() {
    clearTimeout(this._preTm);
    if (!this.running || !this._pre.length) return;
    const id = this._pre.find((i) => !this._maps.has(i));
    if (!id || this._maps.size >= this.maxMaps) return;                                          // önbellek doluysa ön kurulum yok (birbirini atıp döngüye girmesin)
    const busy = !this.world || this._job !== this._done;                                         // geçiş sürüyor
    const ok = this.idleMs ? this.idleMs() > 1500 : this.mode === 'showroom';
    if (busy || !ok) { if (this.idleMs || this.mode === 'showroom') this._preTm = setTimeout(() => this._prefetchTick(), 700); return; }
    const go = () => { if (!this.running || this._maps.has(id) || (this.idleMs && this.idleMs() < 1500)) return this._prefetchTick(); this._maps.set(id, MAPS[id].build()); this._trim(); this._prefetchTick(); };
    if (this.idleMs && globalThis.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else this._preTm = setTimeout(go, 50);
  }

  _disposeEnv(scene, keep) {                       // ortam (gökyüzü / bulut / yıldız) atılır; önbellekteki harita grubu korunur
    for (const o of [...scene.children]) if (o !== keep && !this._isCached(o)) o.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
    scene.background?.dispose?.(); scene.environment?.dispose?.();
  }
  _isCached(o) { for (const m of this._maps.values()) if (m.group === o) return true; return false; }
  _disposeMap(m) { m.group.removeFromParent(); m.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

  // ───── döngü ─────
  loop(now) {
    if (!this.running) return;
    const dt = this._last ? this.pacer.dtFix(now - this._last) : 0; this._last = now;
    if (this.mode === 'showroom' || !this.world) return;                                         // ilk harita henüz kuruluyor: boş kare
    this.t += dt;
    const O = ORBIT[this.world.id] || ORBIT.kasaba, a = this.t * O.speed;
    this.cam.position.set(Math.cos(a) * O.r, O.h + Math.sin(this.t * 0.2) * 3, Math.sin(a) * O.r * 0.8);
    this.cam.lookAt(...O.look);
    this.renderer.render(this.world.scene, this.cam);
    const R = this.rec, i = R.n++ % 600; R.t[i] = now; R.a[i] = this.t;
  }

  stats() {
    const R = this.rec, n = Math.min(R.n, 600), t = [], a = [];
    for (let k = R.n - n; k < R.n; k++) { t.push(R.t[k % 600]); a.push(R.a[k % 600]); }
    const inf = this.renderer.info;
    return { t, a, swaps: this.swaps.slice(), calls: inf.render.calls, tris: inf.render.triangles, programs: inf.programs?.length || 0, pr: this.pr, w: Math.round(this.w * this.pr), h: Math.round(this.h * this.pr),
      world: this.world?.id || null, cached: [...this._maps.keys()], shadow: this.shadow, pace: { ...this.pacer.stats, P: +this.pacer.P.toFixed(2), k: this.pacer.k, fps: this.pacer.fps() } };
  }

  dispose() {
    this.running = false; clearTimeout(this._preTm);
    this.pacer.dispose();
    if (this.world) this._disposeEnv(this.world.scene, null);
    for (const m of this._maps.values()) this._disposeMap(m);
    this._maps.clear(); this.world = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
