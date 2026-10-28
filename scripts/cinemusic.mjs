// 12.217 Tanıtım videosu müziği: telifsiz, tamamen burada sentezlenen (Web Audio OfflineAudioContext) epik "trailer" parçası. Kesme / başlık
// anlarına göre kurgulanır (cues.json: dur, pulse, drums, hits[], brk [a,b] (yavaş çekim: davul susar), riser [a,b], end). Re minör, 100 BPM:
// alçak drone + 8'lik yaylı ostinato (i–VI–III–VII) + taiko / kick + başlık vuruşları (alçak gümbürtü + bakır akor) + yükselen gürültü.
//   node scripts/cinemusic.mjs cues.json out.wav
import { chromium } from 'playwright';
import fs from 'fs';
const [, , CUES, OUTW] = process.argv;
const cues = JSON.parse(fs.readFileSync(CUES, 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const b64 = await page.evaluate(async (C) => {
  const SR = 48000, D = C.dur + 0.5, ctx = new OfflineAudioContext(2, Math.ceil(SR * D), SR);
  const BEAT = 60 / (C.bpm || 100), S16 = BEAT / 4;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
  const ir = ctx.createBuffer(2, SR * 3, SR);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  const verb = ctx.createConvolver(); verb.buffer = ir; const vOut = ctx.createGain(); vOut.gain.value = 0.32; verb.connect(vOut); vOut.connect(master);
  const noise = ctx.createBuffer(1, SR * 2, SR); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const bus = (g, rv = 0) => { const x = ctx.createGain(); x.gain.value = g; x.connect(master); if (rv) { const s = ctx.createGain(); s.gain.value = rv; x.connect(s); s.connect(verb); } return x; };
  const inBrk = (t) => C.brk && t >= C.brk[0] && t < C.brk[1];
  const endT = C.end ?? C.dur;
  // ── drone: alçak re (+ la), yavaş kabaran alçak geçiren ──
  {
    const out = bus(0.0, 0.25), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.7; lp.connect(out);
    for (const [m, det] of [[38, -6], [38, 7], [45, 0], [26, 0]]) { const o = ctx.createOscillator(); o.type = m === 26 ? 'sine' : 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det; const g = ctx.createGain(); g.gain.value = m === 26 ? 0.5 : 0.18; o.connect(g); g.connect(lp); o.start(0); o.stop(D); }
    out.gain.setValueAtTime(0, 0); out.gain.linearRampToValueAtTime(0.55, 3); out.gain.setValueAtTime(0.55, endT); out.gain.linearRampToValueAtTime(0.0001, Math.min(D, endT + 4));
    lp.frequency.setValueAtTime(220, 0); lp.frequency.linearRampToValueAtTime(700, C.drums || 10); lp.frequency.linearRampToValueAtTime(1100, endT - 1); lp.frequency.linearRampToValueAtTime(300, Math.min(D, endT + 3));
  }
  // ── ostinato: 8'lik yaylılar (testere + kare, kısa zarf), akor kökü ölçü başına ──
  const PROG = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];           // Dm Bb F C
  const PAT = [0, 0, 2, 0, 1, 0, 2, 1];
  {
    const out = bus(0.0, 0.18), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 1.2; lp.connect(out);
    out.gain.setValueAtTime(0, 0); out.gain.setValueAtTime(0, C.pulse); out.gain.linearRampToValueAtTime(0.5, C.pulse + 2); out.gain.setValueAtTime(0.5, endT - 0.2); out.gain.linearRampToValueAtTime(0.0001, endT + 0.4);
    lp.frequency.setValueAtTime(700, C.pulse); lp.frequency.linearRampToValueAtTime(2200, endT);
    for (let t = C.pulse, i = 0; t < endT; t += BEAT / 2, i++) {
      if (inBrk(t)) continue;
      const bar = Math.floor(i / 8), ch = PROG[bar % 4], m = ch[PAT[i % 8]] - 12 + (i % 16 === 15 ? 12 : 0);
      for (const [type, det, g0] of [['sawtooth', -5, 0.11], ['sawtooth', 6, 0.11], ['square', 0, 0.05]]) {
        const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type; o.frequency.value = hz(m); o.detune.value = det;
        e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g0 * (i % 2 ? 0.7 : 1), t + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.45);
        o.connect(e); e.connect(lp); o.start(t); o.stop(t + BEAT * 0.5);
      }
    }
  }
  // ── davul: kick + taiko (alçak ton + gürültü) + yer yer tom ──
  const kick = (t, g = 1, f0 = 110, f1 = 38, dur = 0.5) => {
    const o = ctx.createOscillator(), e = ctx.createGain(), out = bus(1, 0.12); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.9 * g, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(e); e.connect(out); o.start(t); o.stop(t + dur + 0.05);
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ne = ctx.createGain(); n.buffer = noise; f.type = 'lowpass'; f.frequency.value = 900; ne.gain.setValueAtTime(0.0001, t); ne.gain.exponentialRampToValueAtTime(0.35 * g, t + 0.004); ne.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    n.connect(f); f.connect(ne); ne.connect(out); n.start(t, rnd()); n.stop(t + 0.2);
  };
  if (C.drums != null) {
    const P = 'x..x..x.x.....x.', P2 = 'x..x..x.x..x.xxx';
    for (let t = C.drums, i = 0; t < endT - 0.05; t += S16, i++) {
      if (inBrk(t)) continue;
      const bar = Math.floor(i / 16), pat = bar % 4 === 3 ? P2 : P, c = pat[i % 16];
      const k = Math.min(1, 0.55 + (t - C.drums) / 50);
      if (c === 'x') kick(t, k * (i % 16 === 0 ? 1 : 0.75), i % 16 >= 12 && bar % 4 === 3 ? 180 : 105, i % 16 >= 12 && bar % 4 === 3 ? 70 : 36, 0.45);
      if (i % 8 === 4) {                                                                      // trampet / el çırpma gibi gürültü
        const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain(), out = bus(1, 0.3); n.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
        e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.22 * k, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); n.connect(f); f.connect(e); e.connect(out); n.start(t, rnd()); n.stop(t + 0.25);
      }
    }
  }
  // ── başlık vuruşları: gümbürtü + bakır akor (filtre açılır) ──
  for (const h of C.hits || []) {
    const t = h.t ?? h, big = h.big ? 1.4 : 1;
    kick(t, 1.1 * big, 70, 24, 2.2 * big);
    const out = bus(0.0, 0.5), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5; lp.connect(out);
    lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2600 * big, t + 0.12); lp.frequency.exponentialRampToValueAtTime(400, t + 1.8 * big);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.42, t + 0.02); out.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 * big);
    for (const m of h.ch || [38, 50, 53, 57, 62]) for (const det of [-8, 0, 9]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + 2.6 * big); }
  }
  // ── yükselen gürültü (doruğa) ──
  for (const r of C.risers || []) {
    const [a, b] = r, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain(), out = bus(1, 0.4); n.buffer = noise; n.loop = true;
    f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, a); f.frequency.exponentialRampToValueAtTime(7000, b);
    e.gain.setValueAtTime(0.0001, a); e.gain.exponentialRampToValueAtTime(0.28, b - 0.02); e.gain.linearRampToValueAtTime(0.0001, b + 0.03);
    n.connect(f); f.connect(e); e.connect(out); n.start(a); n.stop(b + 0.1);
    const o = ctx.createOscillator(), oe = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(hz(50), a); o.frequency.exponentialRampToValueAtTime(hz(74), b);
    oe.gain.setValueAtTime(0.0001, a); oe.gain.exponentialRampToValueAtTime(0.05, b); oe.gain.linearRampToValueAtTime(0.0001, b + 0.03); o.connect(oe); oe.connect(out); o.start(a); o.stop(b + 0.1);
  }
  const buf = await ctx.startRendering();
  // tepe normalize (-1 dBFS) + 16 bit WAV
  const L = buf.getChannelData(0), R = buf.getChannelData(1); let pk = 1e-6; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const k = 0.89 / pk, n = L.length, ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * k)) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * k)) * 32767, true); }
  let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}, cues);
fs.writeFileSync(OUTW, Buffer.from(b64, 'base64'));
console.log('müzik', OUTW, cues.dur.toFixed(1), 'sn');
await browser.close();
