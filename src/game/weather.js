import * as THREE from 'three';

// Hava durumu: yağmur (damlalar + şimşek + yağmur sesi) ve sis. Görüş mesafesi botlar için game.visMul ile azalır.
export const WEATHERS = [['clear', 'Açık'], ['rain', 'Yağmurlu'], ['fog', 'Sisli']];

export class Weather {
  constructor(game, kind) {
    this.g = game; this.kind = kind;
    this.t = 0; this.flash = 0; this.nextBolt = 10 + Math.random() * 14;
    game.visMul = kind === 'fog' ? 0.5 : kind === 'rain' ? 0.8 : 1;
    const sc = game.scene;
    this.sun = game.sun;
    this.sunI = game.sun.intensity;
    if (kind === 'clear') return;
    const f = sc.fog;
    if (f) {
      const night = game.night;
      if (kind === 'rain') { f.far = Math.max(90, f.far * 0.55); f.near = Math.min(f.near, 12); f.color.lerp(new THREE.Color(night ? '#0b1220' : '#7d8794'), 0.7); }
      else { f.near = 3; f.far = night ? 55 : 80; f.color.set(night ? '#101828' : '#c9cfd4'); }
    }
    if (kind === 'rain') { game.sun.intensity *= 0.45; sc.backgroundIntensity = 0.55; sc.environmentIntensity *= 0.6; }
    else { game.sun.intensity *= 0.6; sc.backgroundIntensity = 0.75; }
    if (kind === 'fog' && f) sc.background = f.color.clone();
    if (kind === 'rain') this._initRain();
    this._initSound();
  }

  _initRain() {
    const N = 2200, W = 46, H = 24;
    this.W = W; this.H = H; this.N = N;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * W; this.pos[i * 3 + 1] = Math.random() * H; this.pos[i * 3 + 2] = (Math.random() - 0.5) * W;
      this.vel[i] = 24 + Math.random() * 10;
    }
    const seg = new Float32Array(N * 6);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(seg, 3));
    this.geo = g; this.seg = seg;
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c3cfe0', transparent: true, opacity: 0.33, depthWrite: false, fog: false }));
    this.mesh.frustumCulled = false;
    this.g.scene.add(this.mesh);
  }

  _initSound() {
    const sfx = this.g.sfx;
    if (!sfx.ctx || !sfx.noise) return;
    const c = sfx.ctx;
    const src = c.createBufferSource(); src.buffer = sfx.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = this.kind === 'rain' ? 'highpass' : 'lowpass'; f.frequency.value = this.kind === 'rain' ? 1400 : 380;
    const gn = c.createGain(); gn.gain.value = this.kind === 'rain' ? 0.12 : 0.05;
    src.connect(f); f.connect(gn); gn.connect(sfx.ambBus);
    src.start();
    this.snd = { src, gn, base: gn.gain.value };
    this.applyMix();
  }

  update(dt) {
    if (this.kind === 'clear') return;
    this.t += dt;
    const cam = this.g.camera.position;
    if (this.kind === 'rain') {
      const { pos, seg, vel, W, H, N } = this;
      const wx = 3.5, len = 0.07;
      for (let i = 0; i < N; i++) {
        let y = pos[i * 3 + 1] - vel[i] * dt;
        if (y < 0) y += H;
        pos[i * 3 + 1] = y;
        pos[i * 3] += wx * dt * 0.4;
        // kamerayı çevreleyen kutuda sar
        const x = cam.x + ((pos[i * 3] - cam.x + W * 1.5) % W) - W / 2;
        const z = cam.z + ((pos[i * 3 + 2] - cam.z + W * 1.5) % W) - W / 2;
        const yy = cam.y - 6 + y;
        seg[i * 6] = x; seg[i * 6 + 1] = yy; seg[i * 6 + 2] = z;
        seg[i * 6 + 3] = x + wx * len; seg[i * 6 + 4] = yy + vel[i] * len; seg[i * 6 + 5] = z;
      }
      this.geo.attributes.position.needsUpdate = true;
      // şimşek
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.nextBolt = 12 + Math.random() * 22; this.flash = 0.22; this._thunder(); }
      if (this.flash > 0) {
        this.flash -= dt;
        const k = this.flash > 0 ? 1 + Math.sin(this.flash * 60) * 0.5 : 0;
        this.g.sun.intensity = this.sunI * 0.45 + 2.6 * Math.max(0, k);
        this.g.scene.backgroundIntensity = 0.55 + Math.max(0, k) * 0.8;
        if (this.flash <= 0) { this.g.sun.intensity = this.sunI * 0.45; this.g.scene.backgroundIntensity = 0.55; }
      }
    }
  }

  // Ayarlar: yağmur sesi kapalıysa yağmur gürültüsü ve gök gürültüsü çalmaz (rüzgâr/sis ortam kanalında kalır)
  applyMix() {
    if (this.snd) this.snd.gn.gain.value = this.kind === 'rain' && !this.g.sfx.mix.rain ? 0 : this.snd.base;
  }

  _thunder() {
    const sfx = this.g.sfx;
    if (!sfx.ctx || !sfx.mix.rain) return;
    sfx._noise({ gain: 0.7, dur: 2.2, f0: 380, f1: 60, delay: 0.25 + Math.random() * 0.9 });
    sfx._tone({ gain: 0.35, dur: 1.8, f0: 70, f1: 30, type: 'sawtooth', delay: 0.3 });
  }

  dispose() {
    try { this.snd?.src.stop(); } catch (e) { /* zaten durmuş */ }
    if (this.mesh) { this.g.scene.remove(this.mesh); this.geo.dispose(); }
  }
}
