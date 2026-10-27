import * as THREE from 'three';
import { getCtx, noiseBuf, makeIR, isMobile, uiSound } from './actx.js';
import { SYN, SHOT_DRAFT, shotBuffers } from './gunsynth.js';
import { isSpaceShot, spaceShot } from './spaceSfx.js';

// WebAudio ile sentezlenmiş sesler (dosya yok). Her ses bir "ses kaynağı" (voice): mesafe kısması + mesafeye göre alçak geçiren (uzak = boğuk) + sağ/sol pan + ses hızı gecikmesi + yankı gönderimi.
// Katmanlar: çatlama (kısa yüksek geçiren gürültü) + gövde (taranan alçak geçiren gürültü) + gümbürtü (perdesi düşen ton) + kuyruk (uzun boğuk yankı). Bitince düğümler ayrılır (sızıntı yok, this.live sayar).
// Ortak AudioContext (actx.js): maç başına yeni bağlam açılmaz; ana çıkışta sınırlayıcı (kompresör) var, katmanlar üst üste binse de patlamaz (clip yok).
// 12.141: atış sesleri gunsynth.js'te (taslak B / C, önceden hesaplanmış tampon). Aşağıdaki GUN tablosu = taslak A (eski katmanlı sentez), ?sfx=A ile ya da SHOT_DRAFT = 'A' ile geri gelir.
// Silah ailesi profili: c = çatlama [kazanç, süre, yüksek geçiren Hz], b = gövde [kazanç, süre, f0, f1, tür?], t = gümbürtü [kazanç, süre, f0, f1, dalga?], k = kuyruk [kazanç, süre, f0, f1], r = yankı payı, m = mekanik tık (kendi silahın)
const GUN = {
  pistol: { c: [0.5, 0.018, 2500], b: [0.45, 0.1, 4500, 700], t: [0.32, 0.09, 190, 60], k: [0.12, 0.35, 1800, 250], r: 0.25, m: 1 },
  pistol45: { c: [0.5, 0.02, 2200], b: [0.55, 0.13, 3600, 500], t: [0.42, 0.12, 150, 50], k: [0.15, 0.4, 1500, 200], r: 0.27, m: 1 },
  magnum: { c: [0.7, 0.025, 2000], b: [0.8, 0.24, 3200, 280], t: [0.65, 0.22, 100, 36], k: [0.3, 0.7, 1300, 150], r: 0.35 },
  revolver: { c: [0.6, 0.022, 2100], b: [0.7, 0.2, 3400, 360], t: [0.55, 0.19, 115, 40], k: [0.24, 0.6, 1400, 170], r: 0.32 },
  smg: { c: [0.36, 0.012, 3000], b: [0.38, 0.085, 6000, 900], t: [0.22, 0.07, 210, 80], k: [0.08, 0.25, 2200, 300], r: 0.2, m: 1 },
  vector: { c: [0.3, 0.01, 3500], b: [0.3, 0.06, 7500, 1400], t: [0.16, 0.05, 320, 130, 'triangle'], k: [0.06, 0.2, 2500, 400], r: 0.18, m: 1 },
  p90: { c: [0.28, 0.01, 4000], b: [0.27, 0.055, 9000, 2500, 'bandpass'], t: [0.14, 0.05, 520, 260, 'triangle'], k: [0.06, 0.2, 2600, 400], r: 0.18, m: 1 },
  mac10: { c: [0.36, 0.011, 3000], b: [0.38, 0.07, 6500, 900], t: [0.2, 0.06, 260, 110, 'sawtooth'], k: [0.07, 0.22, 2300, 350], r: 0.18, m: 1 },
  carbine: { c: [0.5, 0.016, 2600], b: [0.5, 0.11, 5000, 700], t: [0.3, 0.1, 170, 58], k: [0.16, 0.45, 1700, 220], r: 0.28, m: 1 },
  battle: { c: [0.65, 0.02, 2200], b: [0.72, 0.18, 3800, 380], t: [0.52, 0.16, 110, 40], k: [0.25, 0.6, 1500, 180], r: 0.32, m: 1 },
  shotgun: { c: [0.6, 0.02, 1800], b: [0.85, 0.28, 4500, 300], t: [0.6, 0.24, 115, 34], k: [0.3, 0.7, 1200, 150], r: 0.36 },
  aa12: { c: [0.55, 0.018, 2000], b: [0.8, 0.2, 4200, 320], t: [0.5, 0.18, 100, 36], k: [0.2, 0.5, 1300, 160], r: 0.3, m: 1 },
  dbl: { c: [0.65, 0.022, 1700], b: [0.95, 0.32, 4500, 260], t: [0.7, 0.3, 95, 30], k: [0.34, 0.8, 1100, 140], r: 0.38 },
  sniper: { c: [0.9, 0.03, 1800], b: [0.9, 0.45, 5000, 200], t: [0.7, 0.38, 90, 28], k: [0.4, 1.2, 1100, 120], r: 0.42 },
  dmr: { c: [0.75, 0.025, 2000], b: [0.8, 0.28, 4200, 300], t: [0.58, 0.24, 100, 35], k: [0.3, 0.9, 1300, 140], r: 0.38 },
  barrett: { c: [1.0, 0.035, 1500], b: [1.1, 0.6, 3500, 150], t: [0.95, 0.55, 70, 24], k: [0.5, 1.5, 1000, 100], r: 0.45 },
  lmg: { c: [0.5, 0.016, 2400], b: [0.56, 0.15, 3600, 500], t: [0.45, 0.13, 100, 40], k: [0.18, 0.45, 1500, 200], r: 0.3, m: 1 },
  pkm: { c: [0.56, 0.018, 2200], b: [0.65, 0.16, 3400, 450], t: [0.5, 0.14, 88, 36], k: [0.2, 0.5, 1400, 180], r: 0.32, m: 1 },
  rpg: { b: [0.7, 0.6, 2500, 200], t: [0.5, 0.4, 80, 30], k: [0.25, 0.9, 900, 120], r: 0.35 },
  m79: { b: [0.4, 0.22, 1800, 200], t: [0.7, 0.18, 160, 45], r: 0.2 },
  def: { c: [0.5, 0.016, 2400], b: [0.6, 0.14, 4200, 600], t: [0.35, 0.12, 150, 50], k: [0.15, 0.4, 1600, 200], r: 0.28 },
};
const MOB = isMobile();

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.6;
    this.mix = { sfx: 1, amb: 1, rain: true };      // kanal seviyeleri: efekt / ortam; rain: yağmur sesi (Ayarlar'dan)
    this.listener = { pos: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0) };
    this.live = 0;                                  // çalan kaynak sayısı (test / sızıntı denetimi)
    this.world = null;                              // game.js verir: kapalı alan yoklaması (tavan var mı → daha çok yankı)
    this.indoor = 0; this._envT = 0;
    let q = null; try { q = new URLSearchParams(globalThis.location?.search || '').get('sfx'); } catch (e) { /* yok */ }
    this.draft = /^[ABC]$/.test(q || '') ? q : SHOT_DRAFT;                 // 12.141: atış sesi taslağı (A eski / B tok / C açık hava)
  }

  // ctx verilirse onu kullanır (test: OfflineAudioContext), yoksa ortak bağlam
  init(ctx) {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume?.(); return; }
    const c = ctx || getCtx();
    if (!c) return;
    this.ctx = c;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    const lim = (this.limiter = c.createDynamicsCompressor());                     // sınırlayıcı: üst üste binen patlamalar tavanı aşmasın
    lim.threshold.value = -9; lim.knee.value = 4; lim.ratio.value = 16; lim.attack.value = 0.002; lim.release.value = 0.18;
    const sh = (this.clip = c.createWaveShaper()), K = 1024, cv = new Float32Array(K);              // yumuşak tavan: 0,6'ya kadar doğrusal, üstü tanh ile 0,98'e bükülür (sınırlayıcı geç kalsa da kırpma yok)
    for (let i = 0; i < K; i++) { const x = (i / (K - 1)) * 2 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a < 0.6 ? a : 0.6 + 0.38 * Math.tanh((a - 0.6) / 0.38)); }
    sh.curve = cv;
    const lp = (this.uwLP = c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 22000; lp.Q.value = 0.6;     // 12.180 su altı: ana çıkış boğuklaşır (tek alçak geçirgen)
    this.master.connect(lp); lp.connect(lim); lim.connect(sh); sh.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);          // efektler
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);          // ortam: yağmur, rüzgâr
    this.verbIn = c.createGain(); this.verbIn.gain.value = 1;                 // yankı: tek ortak evrişim (telefonda kısa dürtü)
    this.verb = c.createConvolver(); this.verb.buffer = makeIR(c, MOB ? 0.6 : 1.1, MOB ? 3.6 : 3);
    this.verbOut = c.createGain(); this.verbOut.gain.value = 0.2;
    this.verbIn.connect(this.verb); this.verb.connect(this.verbOut); this.verbOut.connect(this.sfxBus);
    this.setMix(this.mix);
    this.noise = noiseBuf(c);
    // 12.141: atış tamponlarını boşta önceden hesapla (sınıf başına ~2–4 ms; ilk atışta takılma olmasın). Çevrimdışı (test) bağlamda gerektikçe.
    if (this.draft !== 'A' && !(globalThis.OfflineAudioContext && c instanceof OfflineAudioContext)) {
      const kinds = Object.keys(SYN).filter((k) => k !== 'def' && k !== 'suppressed');
      const tick = () => { if (this.ctx !== c || !kinds.length) return; try { shotBuffers(c, kinds.shift(), this.draft); } catch (e) { console.error(e); } setTimeout(tick, 40); };
      setTimeout(tick, 300);
    }
  }

  dispose() {
    for (const n of [this.master, this.uwLP, this._uwN, this._uwG, this.limiter, this.clip, this.sfxBus, this.ambBus, this.verbIn, this.verb, this.verbOut]) try { n?.disconnect(); } catch (e) { /* yok say */ }
    try { this._uwN?.stop(); } catch (e) { /* yok say */ }
    this._uwN = this._uwG = null; this._uwOn = false;
    this.ctx = null;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMix(m) {
    this.mix = { ...this.mix, ...m };
    if (this.sfxBus) { this.sfxBus.gain.value = this.mix.sfx; this.ambBus.gain.value = this.mix.amb; }
  }

  setListener(cam) {
    this.listener.pos.copy(cam.position);
    this.listener.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    if (this.world && this.verbOut && performance.now() > this._envT) {          // 0,4 sn'de bir: başın üstü 14 m kapalıysa iç mekân → yankı artar
      this._envT = performance.now() + 400;
      const up = (this._up ||= new THREE.Vector3()).copy(cam.position); up.y += 14;
      const inside = !this.world.clear(cam.position, up);
      if (inside !== !!this.indoor) { this.indoor = inside ? 1 : 0; this.verbOut.gain.setTargetAtTime(inside ? 0.42 : 0.2, this.ctx.currentTime, 0.25); }
    }
  }

  // Ses kaynağı: mesafe kısması (ref = yarım ses mesafesi), uzaksa alçak geçiren + gecikme, pan, yankı gönderimi. Dönen v katmanlara verilir.
  _voice(pos, gain = 1, { ref = 18, rv = 0, delay = 0 } = {}) {
    const c = this.ctx;
    const g = c.createGain(); const nodes = [g];
    let pan = 0, d = 0, out = g;
    if (pos) {
      const dx = pos.x - this.listener.pos.x, dy = pos.y - this.listener.pos.y, dz = pos.z - this.listener.pos.z;
      d = Math.hypot(dx, dy, dz);
      gain *= 1 / (1 + (d / ref) ** 1.6);
      if (d > 0.5) pan = THREE.MathUtils.clamp((dx * this.listener.right.x + dz * this.listener.right.z) / d, -1, 1);
      if (d > 14) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 19000 / (1 + d / 22)); lp.Q.value = 0.5; g.connect(lp); out = lp; nodes.push(lp); }   // hava emilimi: uzak ses boğuk
      if (d > 30) delay += Math.min(0.32, d / 343);                                                     // ses hızı: uzak çatışma geç duyulur
    }
    g.gain.value = gain;
    if (c.createStereoPanner && pan) { const p = c.createStereoPanner(); p.pan.value = pan * 0.85; out.connect(p); out = p; nodes.push(p); }
    out.connect(this.sfxBus);
    if (rv > 0 && this.verbIn && gain > 0.004) { const s = c.createGain(); s.gain.value = rv * (0.6 + Math.min(1, d / 60)); g.connect(s); s.connect(this.verbIn); nodes.push(s); }   // uzaklık arttıkça yankı payı artar
    return { in: g, nodes, n: 0, d, delay, gain };
  }
  // kaynağı başlat / bitince tüm zinciri ayır
  _play(v, src, chain, t0, t1, off = 0) {
    v.n++; this.live++;
    src.onended = () => { this.live--; for (const x of chain) x.disconnect(); if (--v.n === 0) for (const x of v.nodes) x.disconnect(); };
    src.start(t0, off); src.stop(t1);
  }
  _v(o) { return o.v || this._voice(o.pos, 1, { ref: o.ref, rv: o.rv }); }

  _noise(o) {
    if (!this.ctx) return;
    const { gain = 0.5, dur = 0.15, f0 = 4000, f1 = 600, type = 'lowpass', q = 0.7, delay = 0, att = 0.004 } = o;
    const v = this._v(o); if (!o.v && v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }      // duyulmayacak kadar uzak: hiç kurma
    const c = this.ctx, t = c.currentTime + delay + v.delay;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain, t + att); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(e); e.connect(v.in);
    this._play(v, src, [src, f, e], t, t + dur + 0.03, Math.random());
  }

  _tone(o) {
    if (!this.ctx) return;
    const { gain = 0.4, dur = 0.2, f0 = 120, f1 = 40, type = 'sine', delay = 0, att = 0.006 } = o;
    const v = this._v(o); if (!o.v && v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    const c = this.ctx, t = c.currentTime + delay + v.delay;
    const osc = c.createOscillator(); osc.type = type;
    osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain, t + att); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(e); e.connect(v.in);
    this._play(v, osc, [osc, e], t, t + dur + 0.03);
  }
  // metal tık: kısa bant geçiren gürültü + çınlayan küçük ton (şarjör, kol, emniyet)
  _clk(v, delay, f = 2400, g = 0.3) {
    this._noise({ v, gain: g, dur: 0.035, f0: f * 1.4, f1: f * 0.7, type: 'bandpass', q: 2.2, delay, att: 0.001 });
    this._tone({ v, gain: g * 0.35, dur: 0.06, f0: f * 1.9, f1: f * 1.75, type: 'triangle', delay: delay + 0.002, att: 0.001 });
  }

  // Silah ailesine göre ayırt edilebilir sesler (katmanlı; uzak atışta çatlama katmanı kurulmaz → hem doğal hem ucuz)
  shot(kind, pos) {
    if (!this.ctx) return;
    if (isSpaceShot(kind)) return spaceShot(this, kind, pos);              // 12.157 Uzay modu enerji silahları (spaceSfx.js)
    switch (kind) {
      case 'knife': this._noise({ pos, gain: 0.28, dur: 0.16, f0: 900, f1: 3200, type: 'bandpass', q: 1.2 }); return;
      case 'throw': this._noise({ pos, gain: 0.2, dur: 0.15, f0: 1500, f1: 600, type: 'bandpass' }); return;
      case 'marker': if (this.draft !== 'A') break; { const v = this._voice(pos, 1, { rv: 0.12 }); this._noise({ v, gain: 0.34, dur: 0.05, f0: 2200, f1: 700, type: 'bandpass', q: 1.4 }); this._tone({ v, gain: 0.26, dur: 0.05, f0: 300, f1: 120, type: 'triangle' }); this._noise({ v, gain: 0.1, dur: 0.09, f0: 6000, f1: 2500, type: 'highpass', delay: 0.01 }); return; }   // paintball: kuru "pop" + gaz tıslaması
      case 'pbpistol': if (this.draft !== 'A') break; { const v = this._voice(pos, 1, { rv: 0.1 }); this._noise({ v, gain: 0.3, dur: 0.045, f0: 2800, f1: 900, type: 'bandpass', q: 1.4 }); this._tone({ v, gain: 0.22, dur: 0.045, f0: 380, f1: 150, type: 'triangle' }); return; }
    }
    if (this.draft !== 'A') return this._shotS(kind, pos);
    const P = GUN[kind] || GUN.def, j = 0.94 + Math.random() * 0.12;            // her atış biraz farklı (makine tüfeği tekdüze olmasın)
    const v = this._voice(pos, 1, { ref: 30, rv: P.r });
    if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    if (P.c && v.d < 60) this._noise({ v, gain: P.c[0], dur: P.c[1], f0: P.c[2] * 3, f1: P.c[2], type: 'highpass', q: 0.6, att: 0.0008 });
    if (P.b) this._noise({ v, gain: P.b[0], dur: P.b[1] * j, f0: P.b[2] * j, f1: P.b[3], type: P.b[4] || 'lowpass', att: 0.002 });
    if (P.t) this._tone({ v, gain: P.t[0], dur: P.t[1], f0: P.t[2] * j, f1: P.t[3], type: P.t[4] || 'sine', att: 0.003 });
    if (P.k && (!MOB || P.k[1] > 0.4)) this._noise({ v, gain: P.k[0], dur: P.k[1], f0: P.k[2], f1: P.k[3], att: 0.03, delay: 0.015 });
    if (P.m && (!pos || v.d < 2.5)) this._clk(v, 0.03 + Math.random() * 0.012, 3000 + Math.random() * 600, 0.07);    // kendi silahın: sürgü / mekanizma tıkırtısı
    if (kind === 'shotgun') this.pump(pos, 0.34);
    else if (kind === 'dbl') this._noise({ v, gain: 0.7, dur: 0.3, f0: 4000, f1: 280, delay: 0.035 });
    else if (kind === 'sniper' || kind === 'ww_bolt') this.bolt(pos, 0.55);
    else if (kind === 'rpg') this._noise({ v, gain: 0.3, dur: 0.55, f0: 7000, f1: 2500, type: 'highpass', delay: 0.04, att: 0.05 });   // roket tıslaması
  }

  // 12.141 taslak B / C: önceden hesaplanmış tampon. Yakın (2 çeşit) ↔ uzak (boğuk, uzun kuyruk) mesafeyle yumuşak geçer (25 → 90 m); kendi silahında mekanik ses
  _shotS(kind, pos) {
    const P = SYN[kind] || SYN.def, v = this._voice(pos, 1, { ref: 30, rv: P.r });
    if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    const B = shotBuffers(this.ctx, SYN[kind] ? kind : 'def', this.draft), own = !pos || v.d < 2.5;
    const u = Math.min(1, Math.max(0, (v.d - 25) / 65)), m = u * u * (3 - 2 * u), rate = 0.965 + Math.random() * 0.07;
    if (m < 0.999) this._buf(v, B.near[Math.random() < 0.5 ? 0 : 1], 1 - m, rate);
    if (m > 0.001) this._buf(v, B.far, m, rate);
    if (own && B.mech) this._buf(v, B.mech, 1, 0.96 + Math.random() * 0.08);
    if (kind === 'shotgun') this.pump(pos, 0.34);
    else if (kind === 'sniper' || kind === 'ww_bolt') this.bolt(pos, 0.55);
  }
  _buf(v, buf, g, rate = 1, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay + v.delay, src = c.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const chain = [src];
    if (g !== 1) { const e = c.createGain(); e.gain.value = g; src.connect(e); e.connect(v.in); chain.push(e); } else src.connect(v.in);
    this._play(v, src, chain, t, t + buf.duration / rate + 0.02);
  }

  explosion(pos, big = false) {
    if (!this.ctx) return;
    const v = this._voice(pos, 1, { ref: big ? 70 : 42, rv: 0.55 });
    if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    if (v.d < 80) this._noise({ v, gain: 0.9, dur: 0.035, f0: 5000, f1: 1200, type: 'highpass', att: 0.0008 });   // ilk şok çatlaması
    this._noise({ v, gain: 1.1, dur: 0.9, f0: 2500, f1: 80, att: 0.003 });
    this._tone({ v, gain: 1.0, dur: 0.8, f0: 68, f1: 22, att: 0.004 });
    this._noise({ v, gain: 0.55, dur: 2.0, f0: 420, f1: 40, delay: 0.05, att: 0.08 });              // uzun gümbürtü
    if (!MOB) this._noise({ v, gain: 0.12, dur: 0.7, f0: 3500, f1: 1800, type: 'bandpass', q: 0.8, delay: 0.22, att: 0.05 });   // dökülen moloz
    if (big) { this._tone({ v, gain: 0.9, dur: 1.2, f0: 48, f1: 16, att: 0.006 }); this._noise({ v, gain: 0.35, dur: 1.4, f0: 900, f1: 60, delay: 0.12, att: 0.1 }); }      // 12.188 tank topu: daha derin gümbürtü + toprak yağmuru
  }
  // İsabet geri bildirimi (konumsuz, kuru): gövde = kısa "tık", kafa = metalik çan; dmg ile tok / parlak
  hit(dmg = 30) {
    if (!this.ctx) return;
    const v = this._voice(null, 1), k = Math.min(1.3, 0.75 + dmg / 90);
    this._tone({ v, gain: 0.2 * k, dur: 0.045, f0: 2300, f1: 1800, type: 'triangle', att: 0.001 });
    this._noise({ v, gain: 0.12 * k, dur: 0.022, f0: 5200, f1: 3000, type: 'bandpass', q: 1.5, att: 0.001 });
  }
  // 12.164: delip geçen merminin 2. / 3. hedefe isabeti — normal tıktan daha boğuk, peş peşe iki kısa vuruş (abartısız)
  hitPen() {
    if (!this.ctx) return;
    const v = this._voice(null, 1);
    this._tone({ v, gain: 0.16, dur: 0.05, f0: 1500, f1: 1100, type: 'triangle', att: 0.001 });
    this._tone({ v, gain: 0.13, dur: 0.06, f0: 1250, f1: 900, type: 'triangle', delay: 0.055, att: 0.001 });
    this._noise({ v, gain: 0.1, dur: 0.03, f0: 2600, f1: 1200, type: 'bandpass', q: 1.2, att: 0.001, delay: 0.05 });
  }
  headshot() {
    if (!this.ctx) return;
    const v = this._voice(null, 1);
    this._tone({ v, gain: 0.2, dur: 0.38, f0: 2650, f1: 2600, att: 0.001 });
    this._tone({ v, gain: 0.09, dur: 0.26, f0: 3990, f1: 3950, att: 0.001 });
    this._tone({ v, gain: 0.05, dur: 0.15, f0: 6120, f1: 6100, att: 0.001 });
    this._noise({ v, gain: 0.14, dur: 0.02, f0: 6000, f1: 3500, type: 'bandpass', q: 1.5, att: 0.001 });
  }
  // Öldürme onayı: tok "küt" + parlak iki notalı onay; çoklu öldürmede notalar yükselir, kafadansa çan eklenir
  kill(hs = false, n = 1) {
    if (!this.ctx) return;
    const v = this._voice(null, 1), up = Math.pow(2, Math.min(4, n - 1) * 2 / 12);
    this._tone({ v, gain: 0.42, dur: 0.14, f0: 150, f1: 52, att: 0.002 });
    this._noise({ v, gain: 0.22, dur: 0.07, f0: 1400, f1: 200, att: 0.002 });
    this._tone({ v, gain: 0.13, dur: 0.11, f0: 1046 * up, f1: 1040 * up, type: 'triangle', delay: 0.03, att: 0.002 });
    this._tone({ v, gain: 0.15, dur: 0.24, f0: 1568 * up, f1: 1560 * up, type: 'triangle', delay: 0.1, att: 0.002 });
    if (n >= 2) this._tone({ v, gain: 0.11, dur: 0.3, f0: 2093 * up, f1: 2090 * up, type: 'triangle', delay: 0.17, att: 0.002 });
    if (hs) this.headshot();
  }
  // Asist onayı (12.165): öldürme onayından kısa ve kısık, tek parlak "tık-tın" (hasar verdiğin düşmanı başkası öldürdü)
  assist() {
    if (!this.ctx) return;
    const v = this._voice(null, 1);
    this._tone({ v, gain: 0.09, dur: 0.06, f0: 1320, f1: 1310, type: 'triangle', att: 0.002 });
    this._tone({ v, gain: 0.08, dur: 0.16, f0: 1760, f1: 1755, type: 'triangle', delay: 0.06, att: 0.002 });
  }
  // Zombi hırıltısı / inlemesi: alçak, titrek testere + boğuk gürültü
  zombie(pos, big = false) {
    if (!this.ctx) return;
    const f = big ? 70 : 90 + Math.random() * 40, v = this._voice(pos, 1, { rv: 0.25 });
    this._tone({ v, gain: big ? 0.5 : 0.32, dur: big ? 0.9 : 0.6, f0: f * 1.5, f1: f * 0.7, type: 'sawtooth' });
    this._tone({ v, gain: 0.18, dur: big ? 0.9 : 0.6, f0: f * 3.1, f1: f * 1.4, type: 'square', delay: 0.03 });
    this._noise({ v, type: 'bandpass', gain: 0.22, dur: big ? 0.8 : 0.5, f0: 500, f1: 220 });
  }
  // ── 12.180 su ──
  // su altı: k (0..1) → ana çıkış alçak geçirgen (22 kHz → 380 Hz) + alçak su uğultusu (döngü gürültü, yalnız su altındayken çalar)
  setUnderwater(k) {
    const c = this.ctx; if (!c || !this.uwLP) return;
    const on = k > 0.5;
    if (on === this._uwOn) return;
    this._uwOn = on;
    const t = c.currentTime;
    this.uwLP.frequency.setTargetAtTime(on ? 380 : 22000, t, on ? 0.05 : 0.08);
    if (on && !this._uwN) {
      const n = (this._uwN = c.createBufferSource()); n.buffer = noiseBuf(c); n.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      const g = (this._uwG = c.createGain()); g.gain.value = 0;
      n.connect(f); f.connect(g); g.connect(this.ambBus); n.start();
    }
    if (this._uwG) this._uwG.gain.setTargetAtTime(on ? 0.22 : 0, t, 0.12);
  }
  // suya giriş / mermi sıçraması: ıslak "şlap" + köpük hışırtısı (big: asker)
  splash(pos, big = false) {
    if (!this.ctx) return;
    const v = this._voice(pos, 1, { ref: big ? 14 : 8, rv: 0.1 });
    if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    this._noise({ v, gain: big ? 0.5 : 0.2, dur: big ? 0.18 : 0.07, f0: big ? 1400 : 2600, f1: 260, q: 0.8, att: 0.003 });
    this._noise({ v, gain: big ? 0.22 : 0.08, dur: big ? 0.7 : 0.25, f0: 4200, f1: 1800, type: 'bandpass', q: 0.7, delay: 0.04, att: 0.03 });
    if (big) this._tone({ v, gain: 0.18, dur: 0.14, f0: 160, f1: 60, type: 'sine', delay: 0.01 });
  }
  // yüzme kulacı (yumuşak su hışırtısı)
  stroke(pos) {
    if (!this.ctx) return;
    const v = this._voice(pos, 1, { ref: 6 }), r = Math.random();
    if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    this._noise({ v, gain: 0.07 + r * 0.03, dur: 0.32, f0: 1500 + r * 500, f1: 500, type: 'bandpass', q: 0.6, att: 0.08 });
  }
  // boğulma: gurultu (baloncuk) + boğuk darbe
  drown() {
    if (!this.ctx) return;
    const v = this._voice(null, 1);
    for (let i = 0; i < 4; i++) this._tone({ v, gain: 0.12, dur: 0.07, f0: 380 + Math.random() * 300, f1: 900, type: 'sine', delay: i * 0.06 });
    this._noise({ v, gain: 0.2, dur: 0.14, f0: 500, f1: 120, att: 0.004 });
  }
  // yüzeye çıkıp derin nefes (nefes azaldıysa)
  gasp() {
    if (!this.ctx) return;
    const v = this._voice(null, 1);
    this._noise({ v, gain: 0.16, dur: 0.38, f0: 1800, f1: 3200, type: 'bandpass', q: 0.9, att: 0.05 });
  }
  hurt() {
    if (!this.ctx) return;
    const v = this._voice(null, 1);
    this._noise({ v, gain: 0.32, dur: 0.12, f0: 900, f1: 120, att: 0.002 });                       // tok darbe
    this._tone({ v, gain: 0.22, dur: 0.16, f0: 170, f1: 70, type: 'sawtooth' });
  }
  // Yükleme sesleri: animasyonla aynı zaman çizelgesi (şarjör çıkar → yeni şarjör takılır → kol şarjı); metal tık + sürtünme
  reload(pos, style = 'mag', total = 1.4, empty = true) {
    if (!this.ctx || style === 'shell') return;                // mermi başına ayrı (shell)
    const t = total, v = this._voice(pos, 1, { ref: 10, rv: 0.1 });
    if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    if (style === 'clip') { this.clipReload(v, pos, t); return; }                                // 12.158: şerit / en-bloc klips
    this._clk(v, t * 0.12, 3200, 0.2);                                                              // şarjör bırakma düğmesi
    this._noise({ v, gain: 0.16, dur: 0.11, f0: 1300, f1: 600, type: 'bandpass', q: 0.9, delay: t * 0.22, att: 0.02 });   // şarjör sıyrılır
    this._noise({ v, gain: 0.1, dur: 0.1, f0: 1700, f1: 900, type: 'bandpass', delay: t * 0.36, att: 0.02 });             // kemerden yeni şarjör
    this._clk(v, t * 0.56, 1900, 0.34); this._tone({ v, gain: 0.16, dur: 0.06, f0: 300, f1: 160, delay: t * 0.56 });     // takılır (tok)
    if (empty) { this._clk(v, t * 0.66, 2300, 0.26); this._clk(v, t * 0.78, 2800, 0.32); }                              // kol şarjı geri / ileri
    if (style === 'bolt') { this.bolt(pos, t * 0.66); this.bolt(pos, t * 0.82); }
  }
  dry(pos) { if (this.ctx) this._clk(this._voice(pos, 1, { ref: 8 }), 0, 3400, 0.2); }
  shell(pos) { if (!this.ctx) return; const v = this._voice(pos, 1, { ref: 10 }); this._noise({ v, gain: 0.26, dur: 0.05, f0: 2600, f1: 1400, type: 'bandpass' }); this._tone({ v, gain: 0.12, dur: 0.05, f0: 420, f1: 260, type: 'triangle', delay: 0.02 }); }
  pump(pos, delay = 0.3) { if (!this.ctx) return; const v = this._voice(pos, 1, { ref: 12 }); this._noise({ v, gain: 0.26, dur: 0.08, f0: 1800, f1: 800, type: 'bandpass', delay, att: 0.01 }); this._clk(v, delay + 0.06, 1500, 0.22); this._noise({ v, gain: 0.28, dur: 0.07, f0: 2400, f1: 1100, type: 'bandpass', delay: delay + 0.14, att: 0.008 }); this._clk(v, delay + 0.19, 2100, 0.28); }
  bolt(pos, delay = 0.5) { if (!this.ctx) return; const v = this._voice(pos, 1, { ref: 12 }); this._clk(v, delay, 1700, 0.24); this._noise({ v, gain: 0.18, dur: 0.08, f0: 1500, f1: 800, type: 'bandpass', delay: delay + 0.03 }); this._clk(v, delay + 0.18, 2400, 0.28); }
  knifeHit(pos, back) {
    if (!this.ctx) return;
    const v = this._voice(pos, 1);
    this._noise({ v, gain: back ? 0.5 : 0.4, dur: 0.1, f0: 1800, f1: 300 });
    this._tone({ v, gain: back ? 0.45 : 0.3, dur: 0.09, f0: back ? 140 : 200, f1: 60 });
    if (back) this._noise({ v, gain: 0.25, dur: 0.15, f0: 5000, f1: 2500, type: 'bandpass', delay: 0.03 });
  }
  knifeWall(pos) { if (!this.ctx) return; const v = this._voice(pos, 1); this._tone({ v, gain: 0.22, dur: 0.12, f0: 2600, f1: 1800, type: 'triangle' }); this._noise({ v, gain: 0.25, dur: 0.06, f0: 6000, f1: 2500, type: 'bandpass' }); }
  deploy(pos) { if (!this.ctx) return; const v = this._voice(pos, 1); this._noise({ v, gain: 0.3, dur: 0.1, f0: 900, f1: 400 }); this._tone({ v, gain: 0.2, dur: 0.06, f0: 240, f1: 120, delay: 0.08 }); }
  boing(pos) { if (!this.ctx) return; const v = this._voice(pos, 1); this._tone({ v, gain: 0.3, dur: 0.32, f0: 160, f1: 520 }); this._tone({ v, gain: 0.12, dur: 0.2, f0: 320, f1: 900, type: 'triangle', delay: 0.04 }); }   // zıplama minderi
  beep(pos) { this._tone({ pos, gain: 0.22, dur: 0.06, f0: 1800, f1: 1800, type: 'triangle' }); }
  chat() { if (!this.ctx) return; const v = this._voice(null, 1); this._tone({ v, gain: 0.08, dur: 0.07, f0: 1300, f1: 1300, type: 'triangle' }); this._tone({ v, gain: 0.07, dur: 0.1, f0: 1750, f1: 1750, type: 'triangle', delay: 0.06 }); }   // sohbet iletisi
  ui(kind) { uiSound(kind); }
  smokeHiss(pos) { if (!this.ctx) return; const v = this._voice(pos, 1, { rv: 0.2 }); this._noise({ v, gain: 0.45, dur: 1.4, f0: 6000, f1: 3000, type: 'highpass', att: 0.04 }); this._tone({ v, gain: 0.3, dur: 0.12, f0: 200, f1: 90 }); }
  flashbang(pos) {
    if (!this.ctx) return;
    const v = this._voice(pos, 1, { ref: 30, rv: 0.5 });
    this._noise({ v, gain: 0.9, dur: 0.03, f0: 8000, f1: 2000, type: 'highpass', att: 0.0008 });
    this._noise({ v, gain: 1.1, dur: 0.35, f0: 6000, f1: 800 });
    this._tone({ v, gain: 0.7, dur: 0.3, f0: 120, f1: 40 });
  }
  // flaşbang yiyen oyuncunun kulak çınlaması
  ring(dur = 3) { this._tone({ gain: 0.16, dur, f0: 3700, f1: 3500, type: 'sine', delay: 0.05, att: 0.05 }); }
  // ayak sesi: tok topuk + kum / çakıl sürtünmesi; her adım biraz farklı
  step(pos) {
    if (!this.ctx) return;
    const v = this._voice(pos, 1, { ref: 8 }), r = Math.random();
    if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    this._noise({ v, gain: 0.12, dur: 0.06 + r * 0.03, f0: 520 + r * 260, f1: 140, att: 0.003 });
    this._noise({ v, gain: 0.03 + r * 0.015, dur: 0.045, f0: 2600 + r * 900, f1: 1500, type: 'bandpass', q: 0.9, delay: 0.012, att: 0.006 });
  }
  // boya topu patlaması: ıslak "şlap" (oyuncuya isabet biraz daha tok)
  splat(pos, body = false) { if (!this.ctx) return; const v = this._voice(pos, 1); this._noise({ v, gain: body ? 0.34 : 0.22, dur: 0.07, f0: body ? 900 : 1500, f1: 260, q: 0.9 }); this._tone({ v, gain: body ? 0.16 : 0.08, dur: 0.05, f0: 180, f1: 70 }); }
  // paintball kutusu alındı: can = yükselen iki nota, boya topu = tıkırtılı "şıkır" + nota (pos: başkası aldıysa uzaktan)
  pickup(type, pos) {
    if (!this.ctx) return; const v = this._voice(pos || null, pos ? 0.6 : 1);
    if (type === 'health') { this._tone({ v, gain: 0.26, dur: 0.12, f0: 660, f1: 700, type: 'triangle' }); this._tone({ v, gain: 0.26, dur: 0.2, f0: 990, f1: 1060, type: 'triangle', delay: 0.09 }); }
    else { for (let i = 0; i < 4; i++) this._noise({ v, gain: 0.2, dur: 0.03, f0: 3200 - i * 300, f1: 1800, type: 'bandpass', q: 2, delay: i * 0.035 }); this._tone({ v, gain: 0.2, dur: 0.14, f0: 520, f1: 780, type: 'triangle', delay: 0.12 }); }
  }
  // paintball: yakından geçen top (vızıltı) / yüze çarpan topun ıslak şaplağı
  whiz(pos) { if (!this.ctx) return; const v = this._voice(pos, 1); this._noise({ v, gain: 0.16, dur: 0.09, f0: 2600, f1: 900, type: 'bandpass', q: 1.6 }); }
  facesplat() { if (!this.ctx) return; const v = this._voice(null, 1); this._noise({ v, gain: 0.42, dur: 0.11, f0: 1200, f1: 200, q: 0.8 }); this._tone({ v, gain: 0.2, dur: 0.08, f0: 160, f1: 70, type: 'sine' }); }
  // mermi çarpması: kuru çatlama + tok vuruş; arada bir sekme vızıltısı
  impact(pos) {
    if (!this.ctx) return;
    const v = this._voice(pos, 1, { ref: 14, rv: 0.12 });
    if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
    this._noise({ v, gain: 0.16, dur: 0.05, f0: 4200, f1: 1600, type: 'bandpass', q: 1.1, att: 0.001 });
    this._noise({ v, gain: 0.1, dur: 0.05, f0: 900, f1: 200, att: 0.002 });
    if (Math.random() < 0.16) { const f = 2600 + Math.random() * 1600; this._tone({ v, gain: 0.045, dur: 0.2, f0: f, f1: f * 0.45, delay: 0.01, att: 0.004 }); }
  }
  capture() { if (!this.ctx) return; const v = this._voice(null, 1); this._tone({ v, gain: 0.3, dur: 0.25, f0: 523, f1: 523, type: 'triangle' }); this._tone({ v, gain: 0.3, dur: 0.32, f0: 784, f1: 784, type: 'triangle', delay: 0.15 }); this._tone({ v, gain: 0.12, dur: 0.4, f0: 1046, f1: 1046, delay: 0.15 }); }
}

// ───── 12.158 Cephe modu: 1940'lar silah sesleri (taslak A = GUN tablosu, ayrı blok) + klips doldurma + yarı otomatik "ping" ─────
// ww_bolt: tok çatlama + uzun kuyruk, ardından sürgü · ww_semi: ağır tüfek · ww_smgb: kalın .45 "tok" · ww_smgr: hafif 9 mm · ww_lmg: ağır · ww_mg: çok kısa, sert, yırtıcı (1150 atış/dk) · ww_pistol: subay tabancası
Object.assign(GUN, {
  ww_bolt: { c: [0.85, 0.028, 1900], b: [0.9, 0.36, 4600, 240], t: [0.68, 0.32, 92, 30], k: [0.36, 1.05, 1150, 130], r: 0.4 },
  ww_semi: { c: [0.72, 0.022, 2100], b: [0.78, 0.22, 4000, 330], t: [0.56, 0.2, 105, 38], k: [0.27, 0.75, 1350, 160], r: 0.34, m: 1 },
  ww_smgb: { c: [0.42, 0.014, 2400], b: [0.5, 0.11, 3800, 520], t: [0.36, 0.1, 140, 52], k: [0.12, 0.32, 1700, 240], r: 0.24, m: 1 },
  ww_smgr: { c: [0.34, 0.012, 2900], b: [0.4, 0.085, 5600, 860], t: [0.24, 0.07, 200, 76], k: [0.08, 0.24, 2100, 300], r: 0.2, m: 1 },
  ww_lmg: { c: [0.62, 0.02, 2200], b: [0.7, 0.17, 3700, 400], t: [0.52, 0.15, 104, 40], k: [0.22, 0.55, 1450, 180], r: 0.32, m: 1 },
  ww_mg: { c: [0.6, 0.011, 2600], b: [0.62, 0.07, 4800, 700], t: [0.4, 0.06, 130, 60, 'sawtooth'], k: [0.12, 0.28, 1800, 260], r: 0.26, m: 1 },
  ww_pistol: { c: [0.5, 0.02, 2300], b: [0.55, 0.12, 3700, 520], t: [0.4, 0.11, 155, 52], k: [0.14, 0.38, 1500, 210], r: 0.26, m: 1 },
});
// klips doldurma (anim.js 'clip' ile aynı zaman çizgisi): sürgü açılır, klips kemerden, bastırılır (iki tık), sürgü kapanır
Sfx.prototype.clipReload = function (v, pos, t) {
  this._clk(v, t * 0.1, 1900, 0.24); this._noise({ v, gain: 0.14, dur: 0.07, f0: 1500, f1: 800, type: 'bandpass', delay: t * 0.12 });
  this._noise({ v, gain: 0.1, dur: 0.1, f0: 1700, f1: 900, type: 'bandpass', delay: t * 0.22, att: 0.02 });
  this._clk(v, t * 0.4, 2700, 0.26); this._noise({ v, gain: 0.16, dur: 0.12, f0: 2400, f1: 1200, type: 'bandpass', delay: t * 0.44, att: 0.01 }); this._clk(v, t * 0.56, 2300, 0.32);
  this._clk(v, t * 0.74, 1800, 0.3); this._clk(v, t * 0.82, 2500, 0.32);
};
// yarı otomatik tüfekte son mermi: boş en-bloc klipsin fırlaması (yüksek metalik "ping" + kısa çınlama)
Sfx.prototype.clipPing = function (pos) {
  if (!this.ctx) return;
  const v = this._voice(pos, 1, { ref: 14, rv: 0.15 });
  this._tone({ v, gain: 0.22, dur: 0.32, f0: 3100, f1: 2950, type: 'triangle', delay: 0.06, att: 0.002 });
  this._tone({ v, gain: 0.1, dur: 0.24, f0: 4650, f1: 4500, type: 'sine', delay: 0.06, att: 0.002 });
  this._noise({ v, gain: 0.08, dur: 0.03, f0: 7000, f1: 4000, type: 'highpass', delay: 0.055 });
};
// uzak top ateşi (Cephe ortamı, frontFx.js): konumsuz, boğuk, kısık gümbürtü
Sfx.prototype.distantBoom = function () {
  if (!this.ctx) return;
  const v = this._voice(null, 0.5, { rv: 0.35 });
  this._tone({ v, gain: 0.09, dur: 1.1, f0: 62, f1: 34, att: 0.06 });
  this._noise({ v, gain: 0.07, dur: 1.4, f0: 420, f1: 120, att: 0.08 });
};
