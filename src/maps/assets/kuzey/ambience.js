import { LAKE } from './layout.js';

// Kuzey Vadisi ortam sesleri (12.172, yalnız istemci; Sfx'in ortam kanalı ambBus — Ayarlar → Ortam sesi). Sentez (dosya yok):
// sürekli: rüzgâr (yükseklikle / yağmurda artar), baraj gölü dalga şıpırtısı (göl kıyısına uzaklık; 12.182 nehir yok), fabrika uğultusu (D çevresi), gece cırcır böceği;
// olay: kuş cıvıltısı (gündüz, ağaç / çalı yakınında), kargalar (havalanınca), inek / koyun, ördek, uzak köy köpeği, balık şıpırtısı, baykuş (gece).
const FACT = [250, -300], VILL = [-230, 250];
export class Ambience {
  constructor(sfx) {
    this.sfx = sfx; this.c = sfx?.ctx; this.on = !!(this.c && sfx.noise && sfx.ambBus);
    this.t = 0; this.next = { bird: 2, dog: 20, owl: 12 };
    if (!this.on) return;
    const c = this.c, mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = sfx.noise; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(sfx.ambBus); s.start(0, Math.random()); return { s, fl, g }; };
    this.wind = mk('lowpass', 420, 0.7); this.wind2 = mk('bandpass', 900, 0.8);
    this.river = mk('bandpass', 700, 0.5); this.river2 = mk('highpass', 2400, 0.4);
    this.crick = mk('bandpass', 4700, 9);
    const o1 = c.createOscillator(), o2 = c.createOscillator(), hg = c.createGain(); o1.type = 'sawtooth'; o1.frequency.value = 58; o2.type = 'sine'; o2.frequency.value = 117; hg.gain.value = 0;
    const hl = c.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 260; o1.connect(hl); o2.connect(hl); hl.connect(hg); hg.connect(sfx.ambBus); o1.start(); o2.start();
    this.hum = { g: hg };
    this.lfo = c.createOscillator(); this.lfoG = c.createGain(); this.lfo.frequency.value = 13; this.lfoG.gain.value = 0; this.lfo.connect(this.lfoG); this.lfoG.connect(this.crick.g.gain); this.lfo.start();
  }
  // konumlu tek ses: uzaklık kısması + pan (ambBus'a)
  _v(x, y, z, gain, ref = 40) {
    const c = this.c, L = this.sfx.listener, dx = x - L.pos.x, dz = z - L.pos.z, d = Math.hypot(dx, y - L.pos.y, dz);
    const g = c.createGain(); g.gain.value = gain / (1 + (d / ref) ** 1.6);
    let out = g;
    if (d > 20) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(600, 16000 / (1 + d / 30)); g.connect(lp); out = lp; }
    if (c.createStereoPanner && d > 1) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (dx * L.right.x + dz * L.right.z) / d)) * 0.8; out.connect(p); out = p; }
    out.connect(this.sfx.ambBus);
    return { g, d, t0: c.currentTime + Math.min(0.4, d / 343) };
  }
  _osc(v, type, f0, f1, dur, gain, delay = 0, att = 0.01) {
    const c = this.c, o = c.createOscillator(), e = c.createGain(), t = v.t0 + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain, t + att); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e); e.connect(v.g); o.start(t); o.stop(t + dur + 0.05); o.onended = () => { e.disconnect(); };
  }
  _nz(v, type, f, q, dur, gain, delay = 0) {
    const c = this.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), e = c.createGain(), t = v.t0 + delay;
    s.buffer = this.sfx.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(e); e.connect(v.g); s.start(t, Math.random()); s.stop(t + dur + 0.05); s.onended = () => { fl.disconnect(); e.disconnect(); };
  }
  play(kind, x, z, y = 2) {
    if (!this.on) return;
    if (kind === 'bird') { const v = this._v(x, y, z, 0.16, 30), f = 2600 + Math.random() * 2400, n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) this._osc(v, 'sine', f * (1 + Math.random() * 0.25), f * (0.7 + Math.random() * 0.5), 0.06 + Math.random() * 0.08, 0.5, i * (0.09 + Math.random() * 0.08), 0.005); }
    else if (kind === 'crows') { for (let k = 0; k < 4; k++) { const v = this._v(x + (Math.random() - 0.5) * 20, 10, z + (Math.random() - 0.5) * 20, 0.22, 60); this._nz(v, 'bandpass', 1100 + Math.random() * 300, 3, 0.22, 0.8, k * 0.25 + Math.random() * 0.2); this._osc(v, 'sawtooth', 620, 480, 0.22, 0.12, k * 0.25); } this._nz(this._v(x, 3, z, 0.25, 50), 'highpass', 3000, 0.5, 0.9, 0.5); }
    else if (kind === 'cow') { const v = this._v(x, 1.5, z, 0.4, 45); this._osc(v, 'sawtooth', 140, 105, 1.3, 0.5, 0, 0.25); this._osc(v, 'sine', 280, 210, 1.2, 0.2, 0, 0.25); }
    else if (kind === 'sheep') { const v = this._v(x, 1, z, 0.3, 35); for (let i = 0; i < 5; i++) this._osc(v, 'sawtooth', 430 + (i % 2) * 40, 400, 0.12, 0.35, i * 0.1, 0.02); }
    else if (kind === 'duck') { const v = this._v(x, 0.5, z, 0.25, 25); for (let i = 0; i < 3; i++) { this._nz(v, 'bandpass', 900, 4, 0.12, 0.8, i * 0.18); this._osc(v, 'square', 520, 430, 0.12, 0.08, i * 0.18); } }
    else if (kind === 'dog') { const v = this._v(x, 2, z, 0.35, 90); const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { this._nz(v, 'bandpass', 650, 2.5, 0.16, 0.9, i * 0.32); this._osc(v, 'sawtooth', 300, 180, 0.14, 0.25, i * 0.32); } }
    else if (kind === 'fish') { const v = this._v(x, 0, z, 0.3, 25); this._nz(v, 'bandpass', 1700, 1.2, 0.25, 0.7); this._nz(v, 'bandpass', 900, 1.5, 0.18, 0.5, 0.55); }
    else if (kind === 'owl') { const v = this._v(x, 10, z, 0.22, 70); this._osc(v, 'sine', 420, 380, 0.5, 0.6, 0, 0.08); this._osc(v, 'sine', 400, 360, 0.7, 0.6, 0.7, 0.08); }
    else if (kind === 'deer') { const v = this._v(x, 1, z, 0.25, 30); this._nz(v, 'bandpass', 2200, 1.6, 0.25, 0.6); }
  }
  // her kare: sürekli katmanlar (yumuşak geçiş), rastgele olaylar
  update(dt, cam, { night = false, rain = false, treeNear = 0 } = {}) {
    if (!this.on) return;
    this.t += dt;
    const c = this.c, now = c.currentTime, set = (g, v) => g.gain.setTargetAtTime(v, now, 0.6);
    const alt = Math.max(0, cam.y - 20), windG = Math.min(0.2, 0.035 + alt * 0.0016) * (rain ? 1.7 : 1);
    set(this.wind.g, windG); set(this.wind2.g, windG * 0.35 * (0.6 + 0.4 * Math.sin(this.t * 0.31)));
    this.wind.fl.frequency.setTargetAtTime(340 + 160 * Math.sin(this.t * 0.17), now, 1.5);
    let rd = 1e9; for (let i = 0; i < LAKE.length - 1; i++) { const a = LAKE[i], b = LAKE[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = ((cam.x - a[0]) * dx + (cam.z - a[1]) * dz) / l2; t = Math.max(0, Math.min(1, t)); rd = Math.min(rd, Math.hypot(a[0] + dx * t - cam.x, a[1] + dz * t - cam.z) - a[2]); }
    const rv = 0.06 / (1 + Math.max(0, rd + 20) / 30) ** 1.5; set(this.river.g, rv); set(this.river2.g, rv * 0.35);
    const fd = Math.hypot(cam.x - FACT[0], cam.z - FACT[1]); set(this.hum.g, 0.05 / (1 + (fd / 70) ** 2));
    set(this.crick.g, 0); this.lfoG.gain.setTargetAtTime(night ? 0.02 : 0, now, 1);
    if (!night && !rain && (this.next.bird -= dt) <= 0) { this.next.bird = 0.6 + Math.random() * (treeNear ? 2.2 : 6); const a = Math.random() * 6.28, r = 8 + Math.random() * 30; this.play('bird', cam.x + Math.cos(a) * r, cam.z + Math.sin(a) * r, 6 + Math.random() * 6); }
    if ((this.next.dog -= dt) <= 0) { this.next.dog = 25 + Math.random() * 50; this.play('dog', VILL[0] + (Math.random() - 0.5) * 120, VILL[1] + (Math.random() - 0.5) * 120); }
    if (night && (this.next.owl -= dt) <= 0) { this.next.owl = 18 + Math.random() * 30; const a = Math.random() * 6.28; this.play('owl', cam.x + Math.cos(a) * 60, cam.z + Math.sin(a) * 60); }
  }
}
