// Seri "başarı" sesi (12.148): oyuncu ölmeden art arda öldürdükçe (seri 2, 3, 4, 5, 6+; 10 / 15 / 20 … özel) yükselen kısa prosedürel ses.
// Ses sisteminin (audio.js Sfx) yalnız çıkışını kullanır: sfx.ctx + sfx.sfxBus (Efekt sesi ayarı) + sfx.verbIn (ortak yankı); Sfx sınıfına dokunmaz.
// Konumsuz, yalnız yerel oyuncuya çalar (killfx.kill çağırır). Hazır ses / anons yok: hepsi osilatör + gürültü.
// Üç stil (taslak; /tmp/wb-streak/ karşılaştırma sayfası scripts/streakwav.mjs ile üretilir):
//   A = sade arpej (üçgen dalga majör arpej + hafif oktav parıltısı; 5+ çan, 6+ yumuşak akor, 10'da iki oktav koşu + akor + çift çan)
//   B = arcade (filtreli kare dalga, hızlı arpej + "jeton" sıçraması; 5+ yankı tekrarı, 10'da güç-yükselme taraması + kare akor)
//   C = tok / askerî (filtre zarflı testere "boru" ile borazan notaları + trampet tıkı; 5+ timpani, 10'da trampet rulosu + fanfar)
// Varsayılanı değiştirmek: STREAK_STYLE sabiti ('A' | 'B' | 'C').
import { noiseBuf } from './actx.js';

export const STREAK_STYLE = 'A';
export const STREAK_STYLES = ['A', 'B', 'C'];
export const STREAK_DELAY = 0.2;     // sn: öldürme onay sesinin ("küt" + iki nota) ilk iki notası duyulduktan sonra başlar → üst üste binip gürültü olmaz
const OUT = 0.55;                    // genel düzey (öldürme sesiyle dengeli; sınırlayıcı Sfx'te)
const GAP_MIN = 0.3;                 // sn: aynı karede gelen öldürmeler (el bombası) üst üste değil sırayla çalar
const QUEUE_MAX = 0.9;               // sn: sıra bundan uzarsa eski seri sesi atlanır (birikmesin)
const ST = (s) => Math.pow(2, s / 12);
const Q = new WeakMap();             // Sfx → sıradaki boş zaman

// seri → ses kademesi: 2..6 (6+ = 6), 10 / 15 / 20 … = 10 (özel)
export function streakTier(n) { return n >= 10 && n % 5 === 0 ? 10 : Math.max(2, Math.min(6, n)); }

// tek seslik kurulum: kendi kazanç düğümü → sfxBus (+ yankı gönderimi); tüm kaynaklar bitince zincir ayrılır, sfx.live sayar (sızıntı denetimi)
function kit(sfx) {
  const c = sfx.ctx, bus = c.createGain(); bus.gain.value = OUT; bus.connect(sfx.sfxBus || c.destination);
  let rv = null;
  if (sfx.verbIn) { rv = c.createGain(); rv.gain.value = 0.3; bus.connect(rv); rv.connect(sfx.verbIn); }
  let n = 0, end = 0;
  const run = (src, chain, a, b) => {
    n++; sfx.live = (sfx.live || 0) + 1; end = Math.max(end, b);
    src.onended = () => { sfx.live--; for (const x of chain) x.disconnect(); if (--n === 0) { bus.disconnect(); rv?.disconnect(); } };
    src.start(a); src.stop(b);
  };
  const envGain = (t, g, att, dur) => { const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + att); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); return e; };
  // ton: f → f1 (kayma), lp = [başlangıç, tepe, son] alçak geçiren zarfı (boru), vib = [Hz, cent]
  const tone = (t, f, dur, { type = 'triangle', g = 0.15, att = 0.004, f1, det = 0, lp, vib } = {}) => {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9); if (det) o.detune.value = det;
    const e = envGain(t, g, att, dur), chain = [o, e];
    let head = o;
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1.2; fl.frequency.setValueAtTime(lp[0], t); fl.frequency.exponentialRampToValueAtTime(lp[1], t + Math.min(0.05, dur * 0.3)); fl.frequency.exponentialRampToValueAtTime(lp[2], t + dur); o.connect(fl); head = fl; chain.push(fl); }
    head.connect(e); e.connect(bus);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib[0]; lg.gain.value = vib[1]; l.connect(lg); lg.connect(o.detune); run(l, [l, lg], t, t + dur + 0.02); }
    run(o, chain, t, t + dur + 0.02);
  };
  const noise = (t, dur, { g = 0.1, f0 = 2000, f1 = 1500, type = 'bandpass', q = 1, att = 0.002 } = {}) => {
    const s = c.createBufferSource(); s.buffer = noiseBuf(c); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const e = envGain(t, g, att, dur);
    s.connect(fl); fl.connect(e); e.connect(bus);
    n++; sfx.live = (sfx.live || 0) + 1; end = Math.max(end, t + dur + 0.02);
    s.onended = () => { sfx.live--; s.disconnect(); fl.disconnect(); e.disconnect(); if (--n === 0) { bus.disconnect(); rv?.disconnect(); } };
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  };
  // çan: uyumsuz kısmi tonlar (1 · 2,76 · 5,4), uzun sönüm
  const bell = (t, f, g = 0.1, dur = 0.9) => { tone(t, f, dur, { type: 'sine', g, att: 0.002 }); tone(t, f * 2.76, dur * 0.55, { type: 'sine', g: g * 0.4, att: 0.002 }); tone(t, f * 5.4, dur * 0.3, { type: 'sine', g: g * 0.18, att: 0.002 }); };
  return { c, tone, noise, bell, get end() { return end; } };
}

// ── stiller: (k, t, kademe, hızlı=çoklu öldürme) → çalma süresi (sn)
const STYLES = {
  // A: sade arpej — C majör içinde kök yükselir (C D E G A), nota sayısı kademeyle artar; son nota uzun; 5+ çan, 6+ akor, 10 iki oktav koşu
  A(k, t, tier, fast) {
    const root = 523.25 * ST(tier >= 10 ? 0 : [0, 2, 4, 7, 9][tier - 2]), CH = [0, 4, 7, 12, 16, 19, 24, 28];
    const cnt = tier >= 10 ? 8 : [3, 3, 4, 4, 5][tier - 2], gap = (tier >= 10 ? 0.045 : 0.058) * (fast ? 0.78 : 1);
    for (let i = 0; i < cnt; i++) {
      const f = root * ST(CH[i]), last = i === cnt - 1, tt = t + i * gap;
      k.tone(tt, f, last ? 0.45 : 0.2, { g: 0.15 + i * 0.008 });
      k.tone(tt, f * 2, last ? 0.28 : 0.1, { type: 'sine', g: 0.045 });
    }
    const tl = t + (cnt - 1) * gap;
    if (tier >= 5) k.bell(tl + 0.02, root * 2 * ST(tier >= 10 ? 12 : 0), 0.085, tier >= 10 ? 1.4 : 0.9);
    if (tier >= 6) for (const s of [0, 4, 7]) k.tone(tl, root * ST(s), tier >= 10 ? 1.2 : 0.7, { type: 'sine', g: 0.05, att: 0.03, det: s ? 4 : -4 });
    if (tier >= 10) { for (const s of [12, 16, 19]) k.tone(tl + 0.02, root * ST(s), 1.1, { g: 0.055, att: 0.02, det: 6 }); k.bell(tl + 0.16, root * 4, 0.05, 0.9); }
    return (cnt - 1) * gap + (tier >= 10 ? 1.4 : tier >= 5 ? 0.9 : 0.45);
  },
  // B: arcade — filtreli kare dalga, hızlı arpej, sonda +5 yarım ses "jeton" sıçraması; 5+ yankı tekrarı (gecikmeli kopya), 10 güç-yükselme taraması
  B(k, t, tier, fast) {
    const root = 659.25 * ST(tier >= 10 ? 0 : [0, 2, 4, 7, 9][tier - 2]), CH = [0, 7, 12, 16, 19, 24];
    const cnt = tier >= 10 ? 6 : [2, 3, 3, 4, 5][tier - 2], gap = 0.038 * (fast ? 0.8 : 1);
    const seq = (t0, g) => {
      for (let i = 0; i < cnt; i++) k.tone(t0 + i * gap, root * ST(CH[i]), 0.07, { type: 'square', g, att: 0.002, lp: [5200, 5200, 2600] });
      const tj = t0 + cnt * gap, top = root * ST(CH[cnt - 1]);
      k.tone(tj, top, 0.07, { type: 'square', g, att: 0.002, lp: [5200, 5200, 3000] });
      k.tone(tj + 0.07, top * ST(5), 0.32, { type: 'square', g, att: 0.002, lp: [6000, 6000, 1800], vib: tier >= 5 ? [9, 14] : null });
      return tj + 0.39 - t0;
    };
    let t1 = t, len = 0;
    if (tier >= 10) { k.tone(t, 260, 0.34, { type: 'square', g: 0.07, f1: 1560, lp: [2500, 5000, 5000] }); t1 = t + 0.3; }    // güç-yükselme taraması
    len = seq(t1, 0.1) + (t1 - t);
    if (tier >= 5) seq(t1 + 0.11, 0.035);                                                           // yankı tekrarı
    if (tier >= 10) for (const s of [12, 16, 19]) k.tone(t + len - 0.05, root * ST(s), 0.6, { type: 'square', g: 0.045, att: 0.01, lp: [4000, 4000, 1200], det: 5 });
    return len + (tier >= 5 ? 0.15 : 0) + (tier >= 10 ? 0.55 : 0);
  },
  // C: tok / askerî — borazan notaları (C'nin doğal harmonikleri: G4 C5 E5 G5 C6), filtre zarflı testere + kare; her notada trampet tıkı; 5+ timpani, 10 rulo + fanfar
  C(k, t, tier, fast) {
    const tr = ST(tier >= 10 ? 0 : [0, 2, 4, 5, 7][tier - 2]), G4 = 392 * tr, C5 = 523.25 * tr, E5 = 659.25 * tr, G5 = 784 * tr, C6 = 1046.5 * tr;
    const PAT = { 2: [G4, C5], 3: [G4, C5, E5], 4: [G4, C5, E5, G5], 5: [C5, E5, G5, E5, G5], 6: [G4, C5, E5, G5, C6], 10: [G4, G4, G4, C5, E5, G5, C6] }[tier];
    const gap = (tier >= 10 ? 0.075 : 0.085) * (fast ? 0.8 : 1), cnt = PAT.length;
    if (tier >= 10) for (let i = 0; i < 10; i++) k.noise(t + i * 0.026, 0.05, { g: 0.05 + i * 0.006, f0: 2400, f1: 1500, q: 0.8 });       // trampet rulosu
    const t0 = t + (tier >= 10 ? 0.26 : 0);
    const brass = (tt, f, dur, g) => { k.tone(tt, f, dur, { type: 'sawtooth', g, att: 0.012, lp: [700, Math.min(5200, f * 4.5), f * 1.6] }); k.tone(tt, f, dur, { type: 'square', g: g * 0.35, att: 0.012, det: 7, lp: [600, f * 3, f * 1.4] }); };
    for (let i = 0; i < cnt; i++) {
      const last = i === cnt - 1, tt = t0 + i * gap;
      brass(tt, PAT[i], last ? (tier >= 10 ? 0.9 : 0.42) : gap * 0.92, 0.14);
      k.noise(tt, 0.045, { g: 0.045, f0: 2200, f1: 1400, q: 0.8 });                                  // trampet tıkı
    }
    const tl = t0 + (cnt - 1) * gap;
    if (tier >= 5) { k.tone(tl, 98, 0.55, { type: 'sine', g: 0.3, f1: 70, att: 0.003 }); k.noise(tl, 0.18, { type: 'lowpass', g: 0.14, f0: 420, f1: 120 }); }   // timpani
    if (tier >= 6) for (const f of [C5, E5]) brass(tl, f, tier >= 10 ? 0.9 : 0.42, 0.075);
    return tl - t + (tier >= 10 ? 0.95 : tier >= 5 ? 0.55 : 0.45);
  },
};

// Seri sesi çal: n = seri (≥ 2), multi = çoklu öldürme sayısı (≥ 2 → arpej sıkışır). Dönen: süre (sn), çalınmadıysa 0.
export function playStreak(sfx, n, { multi = 1, style = STREAK_STYLE, delay = STREAK_DELAY } = {}) {
  if (!sfx?.ctx || n < 2) return 0;
  const c = sfx.ctx;
  let t = c.currentTime + delay;
  const q = Q.get(sfx) || 0;
  if (t < q) { if (q - t > QUEUE_MAX) return 0; t = q; }
  const len = (STYLES[style] || STYLES.A)(kit(sfx), t, streakTier(n), multi >= 2);
  Q.set(sfx, t + Math.min(len, GAP_MIN));
  return len;
}
