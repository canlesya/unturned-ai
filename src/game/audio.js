import * as THREE from 'three';

// WebAudio ile sentezlenmiş sesler (dosya yok). Konumsal: mesafeye göre kısılır, sağ/sol pan.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.6;
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
    const len = this.ctx.sampleRate * 1.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

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
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
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

  shot(kind, pos) {
    switch (kind) {
      case 'pistol': this._noise({ pos, gain: 0.5, dur: 0.12, f0: 5000, f1: 700 }); this._tone({ pos, gain: 0.3, dur: 0.1, f0: 200, f1: 60 }); break;
      case 'smg': this._noise({ pos, gain: 0.42, dur: 0.1, f0: 6000, f1: 900 }); this._tone({ pos, gain: 0.22, dur: 0.08, f0: 220, f1: 80 }); break;
      case 'shotgun': this._noise({ pos, gain: 0.9, dur: 0.3, f0: 4500, f1: 300 }); this._tone({ pos, gain: 0.6, dur: 0.25, f0: 120, f1: 35 }); break;
      case 'sniper': this._noise({ pos, gain: 1.0, dur: 0.5, f0: 5000, f1: 200 }); this._tone({ pos, gain: 0.7, dur: 0.4, f0: 90, f1: 28 }); break;
      case 'lmg': this._noise({ pos, gain: 0.6, dur: 0.16, f0: 3600, f1: 500 }); this._tone({ pos, gain: 0.45, dur: 0.14, f0: 100, f1: 40 }); break;
      case 'rpg': this._noise({ pos, gain: 0.8, dur: 0.6, f0: 2500, f1: 200 }); this._tone({ pos, gain: 0.5, dur: 0.4, f0: 80, f1: 30 }); break;
      case 'knife': this._noise({ pos, gain: 0.25, dur: 0.12, f0: 3000, f1: 1500, type: 'bandpass' }); break;
      case 'throw': this._noise({ pos, gain: 0.2, dur: 0.15, f0: 1500, f1: 600, type: 'bandpass' }); break;
      default: this._noise({ pos, gain: 0.6, dur: 0.14, f0: 4200, f1: 600 }); this._tone({ pos, gain: 0.35, dur: 0.12, f0: 150, f1: 50 });
    }
  }

  explosion(pos) {
    this._noise({ pos, gain: 1.3, dur: 0.9, f0: 2500, f1: 80 });
    this._tone({ pos, gain: 1.0, dur: 0.7, f0: 70, f1: 22 });
  }
  hit() { this._tone({ gain: 0.35, dur: 0.07, f0: 1400, f1: 1000, type: 'square' }); }
  headshot() { this._tone({ gain: 0.4, dur: 0.1, f0: 2000, f1: 1500, type: 'square' }); }
  kill() { this._tone({ gain: 0.4, dur: 0.12, f0: 900, f1: 900, type: 'square' }); this._tone({ gain: 0.4, dur: 0.18, f0: 1350, f1: 1350, type: 'square', delay: 0.1 }); }
  hurt() { this._tone({ gain: 0.35, dur: 0.18, f0: 200, f1: 90, type: 'sawtooth' }); }
  reload(pos) { this._noise({ pos, gain: 0.25, dur: 0.05, f0: 3000, f1: 1500, type: 'bandpass' }); this._noise({ pos, gain: 0.3, dur: 0.06, f0: 2500, f1: 1200, type: 'bandpass', delay: 0.55 }); }
  step(pos) { this._noise({ pos, gain: 0.07, dur: 0.07, f0: 500, f1: 200 }); }
  impact(pos) { this._noise({ pos, gain: 0.18, dur: 0.08, f0: 3500, f1: 1200, type: 'bandpass' }); }
  capture() { this._tone({ gain: 0.35, dur: 0.25, f0: 520, f1: 520, type: 'triangle' }); this._tone({ gain: 0.35, dur: 0.3, f0: 780, f1: 780, type: 'triangle', delay: 0.15 }); }
}
