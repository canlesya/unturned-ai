import * as THREE from 'three';

// WebAudio ile sentezlenmiş sesler (dosya yok). Konumsal: mesafeye göre kısılır, sağ/sol pan.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.6;
    this.mix = { sfx: 1, amb: 1, rain: true };      // kanal seviyeleri: efekt / ortam; rain: yağmur sesi (Ayarlar'dan)
    this.listener = { pos: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0) };
  }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);          // efektler
    this.ambBus = this.ctx.createGain(); this.ambBus.connect(this.master);          // ortam: yağmur, rüzgâr
    this.setMix(this.mix);
    const len = this.ctx.sampleRate * 1.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMix(m) {
    this.mix = { ...this.mix, ...m };
    if (this.sfxBus) { this.sfxBus.gain.value = this.mix.sfx; this.ambBus.gain.value = this.mix.amb; }
  }

  setListener(cam) {
    this.listener.pos.copy(cam.position);
    this.listener.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
  }

  _route(pos, gain) {
    const c = this.ctx;
    const g = c.createGain();
    let pan = 0;
    if (pos) {
      const dx = pos.x - this.listener.pos.x, dy = pos.y - this.listener.pos.y, dz = pos.z - this.listener.pos.z;
      const d = Math.hypot(dx, dy, dz);
      gain *= 1 / (1 + (d / 18) ** 1.6);
      if (d > 0.5) pan = THREE.MathUtils.clamp((dx * this.listener.right.x + dz * this.listener.right.z) / d, -1, 1);
    }
    g.gain.value = gain;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = pan * 0.85;
      g.connect(p); p.connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    return g;
  }

  _noise({ pos, gain = 0.5, dur = 0.15, f0 = 4000, f1 = 600, type = 'lowpass', q = 0.7, delay = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(1, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(e); e.connect(this._route(pos, gain));
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  _tone({ pos, gain = 0.4, dur = 0.2, f0 = 120, f1 = 40, type = 'sine', delay = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(1, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e); e.connect(this._route(pos, gain));
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Silah ailesine göre ayırt edilebilir sesler
  shot(kind, pos) {
    const N = (o) => this._noise({ pos, ...o }), T = (o) => this._tone({ pos, ...o });
    switch (kind) {
      case 'pistol': N({ gain: 0.5, dur: 0.12, f0: 5000, f1: 700 }); T({ gain: 0.3, dur: 0.1, f0: 200, f1: 60 }); break;
      case 'pistol45': N({ gain: 0.6, dur: 0.14, f0: 3800, f1: 500 }); T({ gain: 0.4, dur: 0.12, f0: 160, f1: 55 }); break;
      case 'magnum': N({ gain: 0.9, dur: 0.26, f0: 3200, f1: 280 }); T({ gain: 0.65, dur: 0.22, f0: 100, f1: 38 }); N({ gain: 0.25, dur: 0.3, f0: 1500, f1: 200, delay: 0.05 }); break;
      case 'revolver': N({ gain: 0.75, dur: 0.22, f0: 3500, f1: 380 }); T({ gain: 0.55, dur: 0.2, f0: 120, f1: 42 }); break;
      case 'smg': N({ gain: 0.42, dur: 0.1, f0: 6000, f1: 900 }); T({ gain: 0.22, dur: 0.08, f0: 220, f1: 80 }); break;
      case 'vector': N({ gain: 0.34, dur: 0.07, f0: 7500, f1: 1400 }); T({ gain: 0.16, dur: 0.06, f0: 320, f1: 130, type: 'square' }); break;
      case 'p90': N({ gain: 0.3, dur: 0.06, f0: 9000, f1: 2500, type: 'bandpass' }); T({ gain: 0.14, dur: 0.05, f0: 520, f1: 260, type: 'triangle' }); break;
      case 'mac10': N({ gain: 0.42, dur: 0.08, f0: 6500, f1: 900 }); T({ gain: 0.22, dur: 0.07, f0: 260, f1: 110, type: 'sawtooth' }); break;
      case 'carbine': N({ gain: 0.55, dur: 0.12, f0: 5000, f1: 700 }); T({ gain: 0.3, dur: 0.1, f0: 180, f1: 62 }); break;
      case 'battle': N({ gain: 0.78, dur: 0.2, f0: 3800, f1: 380 }); T({ gain: 0.55, dur: 0.18, f0: 110, f1: 40 }); N({ gain: 0.3, dur: 0.1, f0: 8000, f1: 3000, type: 'highpass' }); break;
      case 'shotgun': N({ gain: 0.9, dur: 0.3, f0: 4500, f1: 300 }); T({ gain: 0.6, dur: 0.25, f0: 120, f1: 35 }); this.pump(pos, 0.34); break;
      case 'aa12': N({ gain: 0.85, dur: 0.22, f0: 4200, f1: 320 }); T({ gain: 0.55, dur: 0.2, f0: 100, f1: 36 }); break;
      case 'dbl': N({ gain: 1.0, dur: 0.34, f0: 4500, f1: 260 }); T({ gain: 0.7, dur: 0.3, f0: 95, f1: 30 }); N({ gain: 0.7, dur: 0.3, f0: 4000, f1: 280, delay: 0.035 }); break;
      case 'sniper': N({ gain: 1.0, dur: 0.5, f0: 5000, f1: 200 }); T({ gain: 0.7, dur: 0.4, f0: 90, f1: 28 }); this.bolt(pos, 0.55); break;
      case 'dmr': N({ gain: 0.85, dur: 0.3, f0: 4200, f1: 300 }); T({ gain: 0.6, dur: 0.25, f0: 100, f1: 35 }); N({ gain: 0.25, dur: 0.4, f0: 1800, f1: 200, delay: 0.08 }); break;
      case 'barrett': N({ gain: 1.2, dur: 0.7, f0: 3500, f1: 150 }); T({ gain: 0.95, dur: 0.6, f0: 70, f1: 24 }); N({ gain: 0.5, dur: 0.7, f0: 1200, f1: 120, delay: 0.1 }); break;
      case 'lmg': N({ gain: 0.6, dur: 0.16, f0: 3600, f1: 500 }); T({ gain: 0.45, dur: 0.14, f0: 100, f1: 40 }); break;
      case 'pkm': N({ gain: 0.7, dur: 0.17, f0: 3400, f1: 450 }); T({ gain: 0.5, dur: 0.15, f0: 88, f1: 36 }); break;
      case 'rpg': N({ gain: 0.8, dur: 0.6, f0: 2500, f1: 200 }); T({ gain: 0.5, dur: 0.4, f0: 80, f1: 30 }); break;
      case 'm79': T({ gain: 0.7, dur: 0.18, f0: 160, f1: 45 }); N({ gain: 0.4, dur: 0.22, f0: 1800, f1: 200 }); break;
      case 'knife': N({ gain: 0.28, dur: 0.16, f0: 900, f1: 3200, type: 'bandpass', q: 1.2 }); break;
      case 'throw': N({ gain: 0.2, dur: 0.15, f0: 1500, f1: 600, type: 'bandpass' }); break;
      default: N({ gain: 0.6, dur: 0.14, f0: 4200, f1: 600 }); T({ gain: 0.35, dur: 0.12, f0: 150, f1: 50 });
    }
  }

  explosion(pos) {
    this._noise({ pos, gain: 1.3, dur: 0.9, f0: 2500, f1: 80 });
    this._tone({ pos, gain: 1.0, dur: 0.7, f0: 70, f1: 22 });
  }
  hit() { this._tone({ gain: 0.35, dur: 0.07, f0: 1400, f1: 1000, type: 'square' }); }
  headshot() { this._tone({ gain: 0.4, dur: 0.1, f0: 2000, f1: 1500, type: 'square' }); }
  kill() { this._tone({ gain: 0.4, dur: 0.12, f0: 900, f1: 900, type: 'square' }); this._tone({ gain: 0.4, dur: 0.18, f0: 1350, f1: 1350, type: 'square', delay: 0.1 }); }
  // Zombi hırıltısı / inlemesi: alçak, titrek testere + boğuk gürültü
  zombie(pos, big = false) {
    const f = big ? 70 : 90 + Math.random() * 40;
    this._tone({ pos, gain: big ? 0.5 : 0.32, dur: big ? 0.9 : 0.6, f0: f * 1.5, f1: f * 0.7, type: 'sawtooth' });
    this._tone({ pos, gain: 0.18, dur: big ? 0.9 : 0.6, f0: f * 3.1, f1: f * 1.4, type: 'square', delay: 0.03 });
    this._noise({ pos, type: 'bandpass', gain: 0.22, dur: big ? 0.8 : 0.5, f0: 500, f1: 220 });
  }
  hurt() { this._tone({ gain: 0.35, dur: 0.18, f0: 200, f1: 90, type: 'sawtooth' }); }
  // Yükleme sesleri: animasyonla aynı zaman çizelgesi (şarjör çıkar → yeni şarjör takılır → kol şarjı)
  reload(pos, style = 'mag', total = 1.4, empty = true) {
    const N = (o) => this._noise({ pos, type: 'bandpass', ...o }), T = (o) => this._tone({ pos, ...o });
    if (style === 'shell') return;                         // mermi başına ayrı (shell)
    const t = total;
    N({ gain: 0.22, dur: 0.05, f0: 3000, f1: 1500, delay: t * 0.12 });                       // şarjör bırakma düğmesi
    N({ gain: 0.18, dur: 0.1, f0: 1200, f1: 600, delay: t * 0.22 });                          // şarjör sıyrılır
    N({ gain: 0.12, dur: 0.1, f0: 1600, f1: 900, delay: t * 0.36 });                          // kemerden yeni şarjör
    N({ gain: 0.34, dur: 0.07, f0: 2500, f1: 1000, delay: t * 0.56 }); T({ gain: 0.18, dur: 0.06, f0: 300, f1: 160, delay: t * 0.56 });   // takılır
    if (empty) {
      N({ gain: 0.3, dur: 0.06, f0: 2200, f1: 1200, delay: t * 0.66 });                       // kol şarjı geri
      N({ gain: 0.34, dur: 0.07, f0: 2800, f1: 1300, delay: t * 0.78 });                      // kol şarjı ileri
    }
    if (style === 'bolt') { this.bolt(pos, t * 0.66); this.bolt(pos, t * 0.82); }
  }
  dry(pos) { this._noise({ pos, gain: 0.22, dur: 0.04, f0: 3500, f1: 2500, type: 'bandpass' }); }
  shell(pos) { this._noise({ pos, gain: 0.3, dur: 0.05, f0: 2600, f1: 1400, type: 'bandpass' }); this._tone({ pos, gain: 0.12, dur: 0.05, f0: 420, f1: 260, type: 'triangle', delay: 0.02 }); }
  pump(pos, delay = 0.3) { this._noise({ pos, gain: 0.3, dur: 0.07, f0: 1800, f1: 900, type: 'bandpass', delay }); this._noise({ pos, gain: 0.34, dur: 0.07, f0: 2400, f1: 1100, type: 'bandpass', delay: delay + 0.14 }); }
  bolt(pos, delay = 0.5) { this._noise({ pos, gain: 0.28, dur: 0.07, f0: 1500, f1: 800, type: 'bandpass', delay }); this._noise({ pos, gain: 0.3, dur: 0.07, f0: 2300, f1: 1100, type: 'bandpass', delay: delay + 0.18 }); }
  knifeHit(pos, back) {
    this._noise({ pos, gain: back ? 0.5 : 0.4, dur: 0.1, f0: 1800, f1: 300 });
    this._tone({ pos, gain: back ? 0.45 : 0.3, dur: 0.09, f0: back ? 140 : 200, f1: 60 });
    if (back) this._noise({ pos, gain: 0.25, dur: 0.15, f0: 5000, f1: 2500, type: 'bandpass', delay: 0.03 });
  }
  knifeWall(pos) { this._tone({ pos, gain: 0.25, dur: 0.12, f0: 2600, f1: 1800, type: 'square' }); this._noise({ pos, gain: 0.25, dur: 0.06, f0: 6000, f1: 2500, type: 'bandpass' }); }
  deploy(pos) { this._noise({ pos, gain: 0.3, dur: 0.1, f0: 900, f1: 400 }); this._tone({ pos, gain: 0.2, dur: 0.06, f0: 240, f1: 120, delay: 0.08 }); }
  beep(pos) { this._tone({ pos, gain: 0.25, dur: 0.06, f0: 1800, f1: 1800, type: 'square' }); }
  smokeHiss(pos) { this._noise({ pos, gain: 0.5, dur: 1.4, f0: 6000, f1: 3000, type: 'highpass' }); this._tone({ pos, gain: 0.3, dur: 0.12, f0: 200, f1: 90 }); }
  flashbang(pos) {
    this._noise({ pos, gain: 1.3, dur: 0.35, f0: 6000, f1: 800 });
    this._tone({ pos, gain: 0.7, dur: 0.3, f0: 120, f1: 40 });
  }
  // flaşbang yiyen oyuncunun kulak çınlaması
  ring(dur = 3) { this._tone({ gain: 0.18, dur, f0: 3700, f1: 3500, type: 'sine', delay: 0.05 }); }
  step(pos) { this._noise({ pos, gain: 0.07, dur: 0.07, f0: 500, f1: 200 }); }
  impact(pos) { this._noise({ pos, gain: 0.18, dur: 0.08, f0: 3500, f1: 1200, type: 'bandpass' }); }
  capture() { this._tone({ gain: 0.35, dur: 0.25, f0: 520, f1: 520, type: 'triangle' }); this._tone({ gain: 0.35, dur: 0.3, f0: 780, f1: 780, type: 'triangle', delay: 0.15 }); }
}
