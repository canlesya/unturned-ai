// Müzik: önce dosya (public/audio/music/ altına eklenen dosyalar otomatik çalar), lobi için dosya yoksa PROSEDÜREL müzik (Web Audio sentezi, telifsiz: notalar burada üretilir).
//   lobby  → ana menü / lobi           : audio/music/lobby.mp3 (ya da .ogg) · yoksa LobbySynth
//   match  → maç içi (sırayla / karışık): audio/music/match1.mp3, match2.mp3, match3.mp3 (varsa; yoksa sessiz — maçta müzik yok)
// Yeni bir kanal/ad eklemek için TRACKS'e yaz; çalmak için music.play('ad'). Sesi Ayarlar → Müzik ve Ana ses belirler (setVolume = Ana × Müzik).
// Ses ilk kullanıcı hareketinden sonra başlar (actx.js onUnlock); açılışta yavaşça yükselir, durunca söner; sekme gizlenince susar.
import { getCtx, onUnlock, isMobile } from './actx.js';
const TRACKS = {
  lobby: ['lobby'],
  match: ['match1', 'match2', 'match3'],
};
const EXT = ['mp3', 'ogg', 'm4a'];
const BASE = '/audio/music/';

const exists = new Map();
async function probe(url) {
  if (exists.has(url)) return exists.get(url);
  let ok = false;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    ok = r.ok && /audio|ogg|mpeg|octet/i.test(r.headers.get('content-type') || '');
  } catch (e) { ok = false; }
  exists.set(url, ok);
  return ok;
}

// ── Prosedürel lobi müziği: 84 BPM, La minör sakin "hazırlık" havası. Akor dizisi Am9 – Fmaj7 – C(add9) – G6, yumuşak ped + arp (yankılı) + alçak bas + hafif davul.
// 24 ölçülük döngü: 0–7 davulsuz giriş, 8–23 davullu; arp deseni her 4 ölçüde bir değişir. Zamanlayıcı 0,6 sn ileriye nota kurar (setInterval 150 ms).
const BPM = 84, STEP = 60 / BPM / 4;               // 16'lık süresi
const CHORDS = [                                     // [bas, ped notaları (MIDI)]
  [45, [57, 60, 64, 67, 71]], [41, [53, 57, 60, 64, 67]], [48, [55, 60, 62, 64, 67]], [43, [55, 59, 62, 64, 67]],
];
const ARPS = [[0, 2, 1, 3, 2, 4, 3, 1], [0, 1, 2, 3, 4, 3, 2, 1], [4, 2, 3, 1, 2, 0, 1, 3], [0, 2, 4, 2, 1, 3, 4, 3]];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

class LobbySynth {
  constructor() { this.on = false; this.timer = null; this.out = null; this.vol = 0.3; this.live = 0; }
  setVolume(v) { this.vol = v; if (this.out && this.on) this.out.gain.setTargetAtTime(v * 0.55, this.c.currentTime, 0.15); }
  start(ctx) {                                                                   // ctx: test için OfflineAudioContext
    const c = (this.c = ctx || getCtx()); if (!c || this.on) return;
    this.on = true; this.mob = isMobile();
    if (!this.out) {
      this.out = c.createGain(); this.out.gain.value = 0.0001;
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
      this.out.connect(this.comp); this.comp.connect(c.destination);
      this.padF = c.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 900; this.padF.Q.value = 0.6; this.padF.connect(this.out);
      this.lfo = c.createOscillator(); this.lfo.frequency.value = 0.07; this.lfoG = c.createGain(); this.lfoG.gain.value = 380; this.lfo.connect(this.lfoG); this.lfoG.connect(this.padF.frequency); this.lfo.start();   // ped yavaşça açılıp kapanır
      this.dly = c.createDelay(1); this.dly.delayTime.value = STEP * 3; this.fb = c.createGain(); this.fb.gain.value = 0.36;   // noktalı 8'lik yankı (arp)
      this.dF = c.createBiquadFilter(); this.dF.type = 'lowpass'; this.dF.frequency.value = 2400;
      this.dly.connect(this.dF); this.dF.connect(this.fb); this.fb.connect(this.dly); this.dF.connect(this.out);
      this.arpBus = c.createGain(); this.arpBus.gain.value = 1; this.arpBus.connect(this.out); this.arpBus.connect(this.dly);
      this.noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t); this.out.gain.linearRampToValueAtTime(this.vol * 0.55, t + 2.5);   // yavaş giriş
    this.step = 0; this.next = t + 0.08;
    this.timer = setInterval(() => this.tick(), 150); this.tick();
  }
  stop(fade = 0.9) {
    if (!this.on) return;
    this.on = false; clearInterval(this.timer); this.timer = null;
    const c = this.c, t = c.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t); this.out.gain.linearRampToValueAtTime(0.0001, t + fade);
  }
  tick() {
    const c = this.c; if (!this.on) return;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;            // sekme uyandı / gecikme: yetiş, üst üste yığma
    while (this.next < c.currentTime + 0.6) { this.play(this.step, this.next); this.step++; this.next += STEP; }
  }
  // tek nota: osilatör → zarf → hedef; bitince ayrılır
  note(type, f, t, dur, g, dest, att = 0.01, det = 0) {
    const c = this.c, o = c.createOscillator(), e = c.createGain();
    o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + att); e.gain.setTargetAtTime(0.0001, t + Math.max(att, dur - dur * 0.35), dur * 0.22);
    o.connect(e); e.connect(dest); o.start(t); o.stop(t + dur + dur * 0.6);
    this.live++; o.onended = () => { this.live--; o.disconnect(); e.disconnect(); };
  }
  hit(t, dur, g, f0, f1, type) {                                                 // davul: gürültü (hi-hat / fırça) ya da ton (kick)
    const c = this.c, e = c.createGain();
    let s;
    if (type === 'kick') { s = c.createOscillator(); s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7); s.connect(e); }
    else { s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = f0; f.Q.value = 0.8; s.connect(f); f.connect(e); s._f = f; }
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    e.connect(this.out); s.start(t); s.stop(t + dur + 0.02);
    this.live++; s.onended = () => { this.live--; s.disconnect(); s._f?.disconnect(); e.disconnect(); };
  }
  play(st, t) {
    const bar = Math.floor(st / 16) % 24, s = st % 16, [bass, pad] = CHORDS[bar % 4], bl = STEP * 16;
    const drums = bar >= 8, arp = ARPS[Math.floor(bar / 4) % 4];
    if (s === 0) {                                                               // ped: ölçü boyu, yavaş açılan
      for (let i = 0; i < (this.mob ? 3 : 4); i++) {
        this.note('sawtooth', hz(pad[i]), t, bl * 1.02, 0.028, this.padF, 0.9, -7);
        if (!this.mob) this.note('sawtooth', hz(pad[i]), t, bl * 1.02, 0.028, this.padF, 0.9, 8);
      }
      this.note('sine', hz(bass), t, STEP * 7, 0.2, this.out, 0.02);
    }
    if (s === 8) this.note('sine', hz(bass), t, STEP * 5, 0.16, this.out, 0.02);
    if (s === 14 && bar % 2) this.note('sine', hz(bass + 7), t, STEP * 2, 0.12, this.out, 0.01);
    if (s % 2 === 0 && (bar >= 2 || s >= 8)) {                                   // arp: 8'likler, bir oktav yukarı; arada boşluk bırakır
      const k = arp[(s / 2) % 8], m = pad[k] + 12;
      if (!(bar % 4 === 3 && s >= 12)) this.note('triangle', hz(m), t, STEP * 1.6, s % 4 ? 0.035 : 0.05, this.arpBus, 0.005);
    }
    if (drums) {
      if (s === 0 || s === 10) this.hit(t, 0.32, 0.32, 120, 42, 'kick');
      if (s === 4 || s === 12) this.hit(t, 0.16, 0.05, 1800, 0, 'bandpass');     // fırça trampet
      if (s % 2 === 1 || (s % 4 === 2 && !this.mob)) this.hit(t, 0.04, s % 4 === 3 ? 0.03 : 0.018, 8000, 0, 'highpass');   // hi-hat
    }
    if (bar === 23 && s === 12) this.hit(t, 1.6, 0.05, 5200, 0, 'highpass');    // döngü sonu: zil "şşş"
  }
}

class Music {
  constructor() {
    this.vol = 0.3; this.audio = null; this.group = null; this.token = 0; this.synth = new LobbySynth();
    if (globalThis.document) document.addEventListener('visibilitychange', () => {   // gizli sekmede zamanlayıcı kısılır: sustur, dönünce sürdür
      if (this.group !== 'lobby' || this.audio) return;
      if (document.hidden) this.synth.stop(0.2); else onUnlock(() => { if (this.group === 'lobby' && !document.hidden) this.synth.start(); });
    });
  }

  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); if (this.audio) this.audio.volume = this.vol; this.synth.setVolume(this.vol); }

  // grup çalmaya başlar (zaten çalıyorsa dokunmaz); dosya bulunamazsa: lobi → prosedürel müzik, diğerleri → sessiz
  async play(group) {
    if (this.group === group && (this.audio || this.synth.on)) return;
    this.stop();
    this.group = group;
    const tok = ++this.token;
    const names = (TRACKS[group] || []).slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const found = [];
    for (const n of names) for (const e of EXT) { const u = `${BASE}${n}.${e}`; if (await probe(u)) { found.push(u); break; } if (tok !== this.token) return; }
    if (tok !== this.token) return;
    if (!found.length) {
      if (group === 'lobby') onUnlock(() => { if (tok === this.token && !document.hidden) this.synth.start(); });
      return;
    }
    let i = 0;
    const next = () => {
      if (tok !== this.token) return;
      const a = new Audio(found[i++ % found.length]);
      a.volume = this.vol;
      a.loop = found.length === 1;
      a.onended = next;
      this.audio = a;
      a.play().catch(() => {                                    // tarayıcı otomatik oynatmayı engelledi: ilk tıklama/tuşta dene
        const retry = () => { removeEventListener('pointerdown', retry, true); removeEventListener('keydown', retry, true); if (tok === this.token) a.play().catch(() => {}); };
        addEventListener('pointerdown', retry, true); addEventListener('keydown', retry, true);
      });
    };
    next();
  }

  stop() {
    this.token++;
    this.group = null;
    this.synth.stop();
    if (this.audio) { try { this.audio.pause(); } catch (e) { /* yok say */ } this.audio.onended = null; this.audio = null; }
  }
}

export const music = new Music();
export { LobbySynth, STEP };
