// 12.230 Performans paneli (F3 · ?perf=1 açar, ?perf=0 kapatır): tarayıcı ile masaüstü (Electron) sürümünü aynı ölçülerle karşılaştırmak için.
// Kare aralığı (rAF zaman damgası) + döngünün kendi işi (güncelle + çiz, performance.now) her karede halka tampona yazılır (ucuz; panel kapalıyken de);
// pahalı kısımlar (GPU zaman sorgusu, renderer.info biriktirme, sıralama, DOM) yalnız panel açıkken. DOM en çok 4 kez / sn ve yalnız metin değişince yazılır
// Yer: sağ kenar ortası (sol üst mini harita, sağ üst öldürme akışı). (12.222: aynı metni her karede yazmak bile stil + yerleşim hesabı demek). window.__perf betikler için aynı sayıları taşır; "Raporu kopyala" JSON özeti verir.
import { gpuInfo } from '../gpuCheck.js';
import { paceState } from '../framePace.js';

const N = 8192;                    // halka tampon (5 sn × ~1600 FPS'e kadar yeter; fazlası en eski örneği ezer)
const WIN = 5000;                  // 1% düşük / en uzun takılma penceresi (ms)
const KEY = 'warbyte.perf';
const f1 = (v) => (v == null || !isFinite(v) ? '—' : v.toFixed(1));
const f2 = (v) => (v == null || !isFinite(v) ? '—' : v.toFixed(2));

export class PerfPanel {
  constructor(game) {
    this.g = game;
    this.t = new Float64Array(N); this.dt = new Float32Array(N); this.cpu = new Float32Array(N); this.n = 0;      // kare sonu zamanı · kare aralığı · döngü işi (ms)
    this.gpu = []; this.gpuMs = null; this.pend = []; this.free = [];
    this.stats = { fps: 0 };
    this.desk = globalThis.__desktop || null;
    const q = new URLSearchParams(location.search).get('perf');
    let saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch { /* özel pencere */ }
    this.on = q === '1' || (q !== '0' && saved);
    this._kd = (e) => {
      if (e.code !== 'F3') return;
      e.preventDefault();
      if (e.repeat) return;
      if (e.shiftKey) { this.copy(); return; }                                     // Shift+F3: raporu kopyala (fare kilitliyken düğmeye basılamaz)
      this.toggle();
    };
    addEventListener('keydown', this._kd);
    const self = this;
    window.__perf = { get stats() { return self.stats; }, report: () => self.report(), toggle: (v) => self.toggle(v), get on() { return self.on; } };
    if (this.on) this.show();
  }

  toggle(v = !this.on) {
    this.on = !!v;
    try { localStorage.setItem(KEY, this.on ? '1' : '0'); } catch { /* yok say */ }
    if (this.on) this.show(); else this.hide();
  }

  show() {
    if (!this.el) {
      const el = (this.el = document.createElement('div'));
      el.style.cssText = 'position:fixed;right:8px;top:30%;z-index:60;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#d8f5d0;background:rgba(6,10,14,.78);border:1px solid rgba(155,224,127,.35);border-radius:6px;padding:6px 8px;pointer-events:none;white-space:pre;max-width:46vw;overflow:hidden;text-shadow:0 1px 0 #000';
      this.pre = document.createElement('div');
      const bar = document.createElement('div'); bar.style.cssText = 'margin-top:5px;display:flex;gap:6px;pointer-events:auto';
      const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font:11px ui-monospace,Menlo,Consolas,monospace;color:#0b0f14;background:#9be07f;border:0;border-radius:4px;padding:2px 7px;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); fn(b); }; bar.appendChild(b); return b; };
      btn('Raporu kopyala', () => this.copy());
      if (this.desk?.chooseFps) btn('FPS sınırı… (F9)', () => this.desk.chooseFps());                       // 12.232 Ekran hızı (VSync) / 60 / 144 / 240 / Sınırsız
      else if (this.desk?.setUncapped) btn(this.desk.uncapped ? 'VSync aç (yeniden başlat)' : 'VSync kapat (yeniden başlat)', () => this.desk.setUncapped(!this.desk.uncapped));
      el.append(this.pre, bar);
      document.body.appendChild(el);
      this._txt = '';
    }
    this.el.style.display = 'block';
    this.lastUi = 0;
  }

  hide() {
    if (this.el) this.el.style.display = 'none';
    const r = this.g.renderer; if (r) r.info.autoReset = true;
  }

  // Kare başı (loop'un en başı): t0 = döngü işinin başladığı an
  begin() {
    const r = this.g.renderer;
    if (!this.on || !r) return;
    r.info.autoReset = false; r.info.reset();                                      // gölge + sahne + silah + son işleme çizimleri bu karede toplanır (three her render()'da sıfırlardı)
  }

  // Çizimden hemen önce / sonra: GPU süresi (EXT_disjoint_timer_query_webgl2; tarayıcı vermiyorsa "—")
  gpuBegin() {
    if (!this.on) return;
    const gl = this.gl ||= this.g.renderer.getContext();
    if (this.ext === undefined) this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') || null;
    if (!this.ext || this.pend.length > 6) return;                                 // sonuç gelmeden 6'dan fazla sorgu açma (sınırsız FPS'te sonuç birkaç kare sonra gelir; yoklama gpuEnd'de her karede)
    const qq = this.free.pop() || gl.createQuery();
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, qq); this.q = qq;
  }
  gpuEnd() {
    const gl = this.gl, ext = this.ext;
    if (!ext) return;
    if (this.q) { gl.endQuery(ext.TIME_ELAPSED_EXT); this.pend.push(this.q); this.q = null; }
    while (this.pend.length && gl.getQueryParameter(this.pend[0], gl.QUERY_RESULT_AVAILABLE)) {
      const qq = this.pend.shift();
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { this.gpu.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6); if (this.gpu.length > 120) this.gpu.shift(); }
      this.free.push(qq);
    }
  }

  // Kare sonu: dt = rAF aralığı (sn), t0 = döngü işinin başı (performance.now)
  end(dt, t0) {
    const now = performance.now(), i = this.n++ % N;
    this.t[i] = now; this.dt[i] = dt * 1000; this.cpu[i] = now - t0;
    if (!this.on || now - this.lastUi < 250) return;
    this.lastUi = now;
    this.compute(now);
    this.draw();
  }

  compute(now) {
    const cnt = Math.min(this.n, N), buf = (this._sort ||= new Float32Array(N));
    let k = 0, sum = 0, cpu = 0, mx = 0, n1 = 0, s1 = 0, t1 = 0;
    for (let j = 1; j <= cnt; j++) {
      const i = (this.n - j) % N, age = now - this.t[i];
      if (age > WIN) break;
      const d = this.dt[i];
      if (d > 1000) continue;                                                       // duraklatma / sekme değişimi sayılmaz
      buf[k++] = d; sum += d; cpu += this.cpu[i]; if (d > mx) mx = d;
      if (age <= 1000) { n1++; s1 += d; t1 += this.cpu[i]; }
    }
    const st = this.stats, r = this.g.renderer, info = r?.info;
    st.frames = k;
    st.fps = n1 ? 1000 / (s1 / n1) : 0;
    st.avgMs = k ? sum / k : 0;
    st.cpuMs = n1 ? t1 / n1 : 0;
    st.cpuAvg5 = k ? cpu / k : 0;
    st.maxMs = mx;
    if (k >= 20) {
      const a = buf.subarray(0, k).sort(), m = Math.max(1, Math.round(k * 0.01));
      let w = 0; for (let j = k - m; j < k; j++) w += a[j];
      st.p99Ms = a[k - m]; st.low1Ms = w / m; st.low1Fps = 1000 / st.low1Ms;      // 1% düşük = en kötü %1 karenin ortalaması
    } else { st.p99Ms = st.low1Ms = st.low1Fps = null; }
    st.gpuMs = this.gpu.length ? this.gpu.reduce((a, b) => a + b, 0) / this.gpu.length : null;
    st.gpuTimer = this.ext === undefined ? null : !!this.ext;
    this.gpu.length = 0;
    if (info) {
      st.calls = info.render.calls; st.triangles = info.render.triangles; st.lines = info.render.lines; st.points = info.render.points;
      st.textures = info.memory.textures; st.geometries = info.memory.geometries; st.programs = info.programs?.length ?? 0;
    }
    const pm = performance.memory;
    st.heapMB = pm ? pm.usedJSHeapSize / 1048576 : null; st.heapLimitMB = pm ? pm.jsHeapSizeLimit / 1048576 : null;
    if (r) { st.pixelRatio = r.getPixelRatio(); st.buffer = [r.domElement.width, r.domElement.height]; }
    st.css = [innerWidth, innerHeight]; st.dpr = devicePixelRatio;
    st.adaptive = this.g.settings?.adaptive !== false;
    st.gpu = gpuInfo().renderer || '';

    const cap = +paceState.fpsCap || 0;
    st.vsync = this.desk ? (this.desk.uncapped ? (cap ? `kapalı · sınır ${cap} FPS` : 'kapalı (sınırsız)') : (cap ? `açık · sınır ${cap} FPS` : 'açık (ekran hızı)')) : 'açık (tarayıcı: ekran hızına kilitli)';
    st.paceFps = this.g.paceFps?.() ?? null; st.battery = !!paceState.battery; st.hz = paceState.hz || null;      // 12.232 o anki hedef (0 = sınır yok; boşta / odaksız 30)
    st.desktop = this.desk ? { version: this.desk.version, electron: this.desk.electron, chrome: this.desk.chrome, uncapped: !!this.desk.uncapped, fps: paceState.fps || this.desk.fps, fpsCap: cap, mode: this.desk.mode } : null;
    st.pacer = this.g.pacer ? { ...this.g.pacer.stats, displayMs: +(this.g.pacer.P || 0).toFixed(2) } : null;
    st.build = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
    st.map = this.g.map?.id || this.g.opts?.map; st.online = !!this.g.online; st.soldiers = this.g.soldiers?.length || 0;
  }

  draw() {
    const s = this.stats;
    const lines = [
      `${this.desk ? 'Masaüstü ' + (this.desk.version || '') + (this.desk.mode === 'local' ? ' · gömülü' : '') : 'Tarayıcı'} · VSync ${s.vsync}`,
      `FPS ${f1(s.fps)}   ort ${f2(s.avgMs)} ms`,
      `1% düşük ${f1(s.low1Fps)} FPS (${f1(s.low1Ms)} ms)   en uzun ${f1(s.maxMs)} ms`,
      `CPU (güncelle+çiz) ${f2(s.cpuMs)} ms   GPU ${s.gpuTimer === false ? '— (zaman sorgusu yok)' : f2(s.gpuMs) + ' ms'}`,
      `çizim ${s.calls ?? '—'}   üçgen ${s.triangles != null ? (s.triangles / 1000).toFixed(0) + 'k' : '—'}   doku ${s.textures ?? '—'}   program ${s.programs ?? '—'}`,
      `yığın ${s.heapMB != null ? s.heapMB.toFixed(0) + ' MB' : '—'}   piksel oranı ${f2(s.pixelRatio)}${s.adaptive ? ' (otomatik)' : ''}   ${s.buffer ? s.buffer[0] + '×' + s.buffer[1] : ''}`,
      `GPU ${s.gpu.slice(0, 64) || '—'}`,
      `tempo ${s.paceFps ? 'en çok ' + s.paceFps + ' FPS' : 'sınır yok'}${s.battery && this.desk?.uncapped ? ' (pil: ekran hızı)' : ''}${s.hz ? '   ekran ' + s.hz + ' Hz' : ''}`,
      `F3 kapat · Shift+F3 raporu kopyala${this.desk?.chooseFps ? ' · F9 FPS sınırı' : ''}`,
    ];
    const txt = lines.join('\n');
    if (txt !== this._txt) { this._txt = txt; this.pre.textContent = txt; }
  }

  report() {
    if (!this.on) this.compute(performance.now());
    const s = this.stats, r = (v, d = 2) => (v == null || !isFinite(v) ? null : +v.toFixed(d));
    return {
      at: new Date().toISOString(), build: s.build, where: s.desktop ? 'desktop' : 'browser', desktop: s.desktop, vsync: s.vsync,
      ua: navigator.userAgent, gpu: s.gpu, map: s.map, online: s.online, soldiers: s.soldiers,
      fps: r(s.fps, 1), avgMs: r(s.avgMs), low1Fps: r(s.low1Fps, 1), low1Ms: r(s.low1Ms), p99Ms: r(s.p99Ms), maxMs: r(s.maxMs), cpuMs: r(s.cpuMs), gpuMs: r(s.gpuMs), gpuTimer: s.gpuTimer,
      calls: s.calls, triangles: s.triangles, textures: s.textures, programs: s.programs, heapMB: r(s.heapMB, 0),
      pixelRatio: r(s.pixelRatio), dpr: s.dpr, buffer: s.buffer, css: s.css, adaptive: s.adaptive, paceFps: s.paceFps, battery: s.battery, hz: s.hz,
    };
  }

  copy() {
    const j = JSON.stringify(this.report(), null, 1);
    const ok = () => this.g.hud?.toast?.('Performans raporu panoya kopyalandı', '#9be07f');
    (navigator.clipboard?.writeText(j) || Promise.reject()).then(ok, () => { console.log('[perf]', j); this.g.hud?.toast?.('Kopyalanamadı: rapor konsola yazıldı (F12)', '#ffd27a'); });
  }

  dispose() {
    removeEventListener('keydown', this._kd);
    this.el?.remove(); this.el = null;
    const gl = this.gl;
    if (gl) for (const qq of [...this.pend, ...this.free]) gl.deleteQuery(qq);
    this.pend.length = this.free.length = 0;
    if (window.__perf && this.g.renderer) delete window.__perf;
  }
}
